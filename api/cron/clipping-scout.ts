export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 6144;

// Minimum leads the scout must return each run.
const DAILY_TARGET = 12; // request 12 so dedup attrition still nets >= 10/day

const SYSTEM_PROMPT = `You are the YT Clipping Scout for Bernard Studia, a short-form video clipping service founded by Ant Kinnel. Bernard Studia turns a creator's long-form YouTube into high-performing short-form clips (Shorts, Reels, TikToks).

YOUR MISSION: Find CLIPPING-NATIVE personality creators whose long-form is already popping but who are NOT already clipping heavily — so Bernard Studia can own their short-form channel.

THE ICP (all must hold):
- 100K–5M subscribers (hard band — skip anyone outside it)
- Personality-driven: a real on-camera (or distinctive-voice) character, not a faceless explainer
- High moment density: throws off lots of self-contained 20–60s moments (reactions, hot takes, blow-ups, punchlines, "wait what" beats)
- Long-form is performing well (recent uploads getting strong views/engagement)
- Does NOT already run a dedicated clips/shorts channel and is NOT already clipping heavily

LANES (pick the best fit for each creator):
- Cooking-with-personality (the chef IS the show, e.g. loud/charismatic/quirky — not a calm recipe explainer)
- Comedy / lifestyle
- Reaction / commentary
- Reality / challenge / social-experiment
- Expert storyteller (ENTERTAINMENT-FIRST only — dense quotable moments, not slow educational narration)

HARD DISQUALIFIERS (exclude entirely):
- Under 100K or over 5M subscribers
- Already runs a dedicated clips/shorts channel (e.g. "X Clips", "X Shorts")
- Calm instructional/educational creator where the value is the whole video (low moment density) — these look high-view but clip poorly
- Locked up by a big MCN/management that forecloses an independent clipping deal
- Cannot verify a real, current @handle

CLIPPABILITY SCORE (0–100) — weight these:
- Personality pull (35%)
- Moment density (30%)
- Self-containment of moments (20%)
- Source volume / upload cadence (10%)
- Serviceability — reachable, no existing clipper (5%)

HARD RULES:
1. Use web_search to find and VERIFY every creator. Do not rely on training data alone.
2. Every creator MUST have a verified, current YouTube @handle that actually resolves — search to confirm. NEVER construct a handle from the name. If you cannot confirm the real handle, skip that creator.
3. Do NOT suggest creators already in the pipeline (provided in the user message).
4. Verify the subscriber count is within 100K–5M before including.
5. Return ONLY valid JSON. No prose before or after, no markdown fences.

RESPONSE FORMAT (return exactly this JSON structure):
{
  "leads": [
    {
      "channelName": "Channel / Creator Name",
      "lane": "Cooking-with-personality | Comedy / lifestyle | Reaction / commentary | Reality / challenge | Expert storyteller",
      "subs": "e.g. 1.2M or 480K",
      "score": 0,
      "whyClip": "2-3 sentences on personality + moment density — why this clips well",
      "showsPress": "Recent notable uploads / momentum signals, with rough dates",
      "ytHandle": "@verifiedhandle",
      "youtubeUrl": "https://www.youtube.com/@verifiedhandle",
      "instagram": "@handle or empty",
      "email": "published business email if found, else empty",
      "contactStatus": "Published email | Agency / mgmt | Contact form only | Private / none found",
      "status": "Scouted"
    }
  ]
}`;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    // Load current clipping pipeline to build exclusion list
    const snapshot = await kvGet('clipping:snapshot');
    const existingNames: string[] = (snapshot?.leads ?? [])
      .map((l: any) => l.channelName ?? l.name)
      .filter(Boolean);

    const exclusionBlock = existingNames.length > 0
      ? `\n\nCREATORS ALREADY IN PIPELINE — skip all of these:\n${existingNames.join('\n')}`
      : '';

    const userMessage = `Scout exactly ${DAILY_TARGET} clipping-native personality creators for Bernard Studia. Every creator must be 100K–5M subs, personality-driven, moment-dense, and must have a verified current YouTube @handle — skip any you cannot verify or that already run a clips/shorts channel.${exclusionBlock}\n\nReturn exactly ${DAILY_TARGET} creators as JSON.`;

    const batch = await submitBatch([
      {
        custom_id: `clipping-scout-${new Date().toISOString().split('T')[0]}`,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: [WEB_SEARCH_TOOL],
          messages: [{ role: 'user', content: userMessage }],
        },
      },
    ]);

    if (!batch) {
      return new Response(JSON.stringify({ error: 'Failed to submit batch' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Store batch ID for the poller
    const current = await kvGet('agent:batches');
    const batches: any[] = current?.batches ?? [];
    batches.push({
      batchId: batch.id,
      agentType: 'clipping-scout',
      submittedAt: new Date().toISOString(),
    });
    await kvSet('agent:batches', { batches });

    return new Response(JSON.stringify({ success: true, batchId: batch.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[clipping-scout]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
