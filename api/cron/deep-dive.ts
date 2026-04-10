export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

// Process up to 5 artists per run to stay within batch limits
const BATCH_SIZE = 5;

const SYSTEM_PROMPT = `You are a senior art researcher for Bernard Studia, an Atlanta-based creative studio and art advisory. Your task is to produce a comprehensive deep-dive research brief on a specific emerging artist.

USE WEB SEARCH EXTENSIVELY. Search for:
1. The artist's name + "exhibition" / "gallery" / "art"
2. Their Instagram handle to verify follower count and engagement
3. Their website for bio, CV, and pricing
4. Press coverage: search "[artist name] artist interview" and "[artist name] art review"
5. Gallery representation: search "[artist name] represented by" or check their website's "about" or "CV" page
6. Auction records: search "[artist name] auction" on Invaluable, Artnet, etc.

RESEARCH AREAS (fill in all you can find — leave fields empty/null only if truly not findable):

1. REPRESENTATION STATUS — Is this artist gallery-represented? If so, by whom? If unrepresented, note evidence.
2. CHARACTER SIGNALS — Does this artist align with Bernard Studia's values? Look for: community engagement, teaching, cultural depth, personal narrative in work, material innovation, collaboration spirit, longevity signals.
3. PRESS & INTERVIEWS — Find actual articles, interviews, reviews, or mentions. Include title, publication, URL, date, and a brief excerpt or relevance note.
4. RED FLAGS — Any concerns: market saturation, controversy, inconsistent output, gallery conflicts, prices rising too fast, bot followers, etc.
5. EXHIBITION HISTORY — Solo shows, group shows, residencies, awards, grants. Categorize them.
6. ARTIST STATEMENT — If available from their website or interviews, capture their artistic statement or philosophy.

RESPONSE FORMAT — Return ONLY valid JSON, no markdown fences, no prose:
{
  "artistName": "Full Name",
  "representation": {
    "status": "unrepresented" | "represented" | "unknown",
    "detail": "Explanation of representation status with evidence",
    "galleries": ["Gallery Name 1"]
  },
  "characterSignals": {
    "overallAlignment": "2-3 sentence narrative assessment of fit with Bernard Studia's mission",
    "communityEngagement": "Evidence of community involvement",
    "culturalDepth": "Cultural narrative and personal story in work",
    "materialInnovation": "Material or technique distinctiveness",
    "careerTrajectory": "Where this artist appears to be headed",
    "collaborationSpirit": "Evidence of collaborative or generous practice"
  },
  "pressClippings": [
    {
      "title": "Article Title",
      "source": "Publication Name",
      "url": "https://...",
      "date": "YYYY or YYYY-MM",
      "excerpt": "Key quote or summary (1-2 sentences)",
      "relevance": "Why this matters for Bernard Studia"
    }
  ],
  "redFlags": ["Concern 1", "Concern 2"],
  "exhibitionHistory": {
    "solo": [{"title": "Show Name", "venue": "Venue", "location": "City", "date": "YYYY"}],
    "group": [{"title": "Show Name", "venue": "Venue", "location": "City", "date": "YYYY"}],
    "residencies": ["Residency Name, YYYY"],
    "awards": ["Award Name, YYYY"]
  },
  "artistStatement": "Their statement or philosophy in their own words, if found",
  "researchNotes": "Any additional context, caveats, or observations from your research"
}`;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    // Load current pipeline snapshot
    const snapshot = await kvGet('pipeline:snapshot');
    const artists: any[] = snapshot?.artists ?? [];

    if (artists.length === 0) {
      return new Response(JSON.stringify({ success: true, queued: 0, message: 'No artists in pipeline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Find artists that need deep dive enrichment:
    // 1. Status is "Deep Dive" and no deep dive data yet
    // 2. OR any artist that has been moved past scouted but still has no enrichment
    const needsEnrichment = artists.filter((a: any) => {
      // Already has deep dive data — skip
      if (a.hasDeepDive && a.deepDive) return false;
      // Only enrich artists in Deep Dive stage (or beyond, if somehow missed)
      const enrichableStages = ['Deep Dive', 'Shortlisted', 'In Conversation', 'Active'];
      return enrichableStages.includes(a.status);
    });

    if (needsEnrichment.length === 0) {
      return new Response(JSON.stringify({ success: true, queued: 0, message: 'All artists already enriched or none in Deep Dive' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Take up to BATCH_SIZE artists per run
    const batch = needsEnrichment.slice(0, BATCH_SIZE);

    // Build batch requests — one per artist
    const requests = batch.map((artist: any) => {
      const userMessage = `Research this artist for Bernard Studia's deep-dive brief:

NAME: ${artist.name}
LOCATION: ${artist.location || 'Unknown'}
MEDIUM: ${artist.medium || 'Unknown'}
INSTAGRAM: ${artist.instagram || 'Not provided'}
WEBSITE: ${artist.website || artist.link || 'Not provided'}
INITIAL SCOUT NOTES: ${artist.whyInteresting || 'None'}
SHOWS/PRESS FROM SCOUT: ${artist.showsPress || 'None'}
PRICE RANGE: ${artist.priceRange || 'Unknown'}

Search the web thoroughly for this artist. Check their website, Instagram, and any press coverage. Return the full deep-dive research brief as JSON.`;

      return {
        custom_id: `deep-dive-${artist.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: [WEB_SEARCH_TOOL],
          messages: [{ role: 'user' as const, content: userMessage }],
        },
      };
    });

    const batchResult = await submitBatch(requests);

    if (!batchResult) {
      return new Response(JSON.stringify({ error: 'Failed to submit deep-dive batch' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Store batch ID for the poller — tagged as 'deep-dive' type
    const current = await kvGet('agent:batches');
    const batches: any[] = current?.batches ?? [];
    batches.push({
      batchId: batchResult.id,
      agentType: 'deep-dive',
      submittedAt: new Date().toISOString(),
      // Store artist names so the poller knows which artists to update
      artistNames: batch.map((a: any) => a.name),
    });
    await kvSet('agent:batches', { batches });

    return new Response(JSON.stringify({
      success: true,
      batchId: batchResult.id,
      queued: batch.length,
      artists: batch.map((a: any) => a.name),
      remaining: needsEnrichment.length - batch.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[deep-dive]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
