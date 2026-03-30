export const config = { maxDuration: 60 };

import { kvGet, kvSet } from '../lib/kv';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';
import { parseJSON } from '../lib/anthropic-batch';

const MODEL = 'claude-sonnet-4-6';
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are the Art Scout for Bernard Studia, an Atlanta-based creative studio and art advisory firm founded by Ant Kinnel (Black American male, 35, business founder).

Bernard Studia provides non-exclusive artist representation and advisory services for emerging contemporary artists. You identify talent aligned with this taste profile:

REFERENCE ARTISTS: Egon Schiele, Jean-Michel Basquiat, Gustav Klimt, Cortney Herron, Lorenzo Amos, Jullia Kim, Gene A'Hern, Cato, Mark Fleuridor, Natasha Bakhshov, Tamara "Solem" Al-Issa, Hugo Winder-Lind

STYLE PREFERENCES: Contemporary abstraction, gestural work, mixed media with depth, diasporic narratives, figurative work with psychological intensity, material-forward practices. Values: craft, conviction, and cultural depth over decoration. Underrepresented voices strongly preferred. Black and POC artists prioritized.

SCORING RUBRIC (0–100):
- Taste Fit: 30% — alignment with aesthetic above
- Market Pricing: 20% — current $5K–$20K range, trajectory to $50K+
- Upside Potential: 25% — career stage, trajectory, buzz
- Show History: 15% — galleries, residencies, biennials, awards
- No Representation: 10% — unrepresented or very early-stage only

HARD RULES:
1. Use web_search to find and verify EVERY artist. Do not rely on training data alone.
2. Every artist MUST have a verified, working website URL AND a verified Instagram handle — search to confirm both are active. Skip any artist missing either. No exceptions.
3. Do NOT suggest artists already listed in the pipeline (provided in user message).
4. Prioritize Black, POC, and underrepresented artists. Diasporic narratives strongly preferred.
5. All artists must be actively producing work in 2024–2026.
6. Return ONLY valid JSON — no markdown fences, no prose before or after.

RESPONSE FORMAT:
{
  "artists": [
    {
      "name": "Full Name",
      "location": "City, Country",
      "medium": "e.g. Oil painting, mixed media",
      "score": 0,
      "priceRange": "$X,000–$Y,000",
      "whyInteresting": "2-3 sentences on why this artist fits Bernard Studia",
      "showsPress": "Recent exhibitions and press, with years",
      "instagram": "@handle",
      "website": "domain.com",
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
    // Load current pipeline for exclusion list
    const snapshot = await kvGet('pipeline:snapshot');
    const existingArtists: any[] = snapshot?.artists ?? [];
    const existingNames: string[] = existingArtists.map((a: any) => a.name).filter(Boolean);

    const exclusionBlock = existingNames.length > 0
      ? `\n\nARTISTS ALREADY IN PIPELINE — do not suggest any of these:\n${existingNames.join('\n')}`
      : '';

    const userMessage = `Scout exactly 5 emerging contemporary artists for Bernard Studia. Every artist must have both a verified website URL and a verified Instagram handle — use web search to confirm each one.${exclusionBlock}\n\nReturn exactly 5 artists as JSON.`;

    // Synchronous Messages API call (not Batch) for immediate result
    const res = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[test/art-scout]', res.status, err);
      return new Response(JSON.stringify({ error: 'Anthropic API call failed', detail: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const aiResponse = await res.json();
    const textBlock = aiResponse?.content?.find((b: any) => b.type === 'text');
    const text = textBlock?.text ?? null;

    if (!text) {
      return new Response(JSON.stringify({ error: 'No text in response', raw: aiResponse }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const parsed = parseJSON(text);
    if (!parsed?.artists?.length) {
      return new Response(JSON.stringify({ error: 'Could not parse artists from response', raw: text }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Build new PipelineArtist objects and merge into snapshot
    const today = new Date().toISOString().split('T')[0];
    const batchLabel = `test-${today}`;
    const existingNames2 = new Set(existingArtists.map((a: any) => a.name));

    const newArtists = parsed.artists
      .filter((a: any) => a.name && !existingNames2.has(a.name))
      .map((a: any, i: number) => ({
        sheetRow: 0,
        dateScouted: today,
        batch: batchLabel,
        name: a.name,
        location: a.location ?? '',
        medium: a.medium ?? '',
        score: a.score ?? 0,
        priceRange: a.priceRange ?? '',
        whyInteresting: a.whyInteresting ?? '',
        showsPress: a.showsPress ?? '',
        link: a.website ?? '',
        instagram: a.instagram ?? '',
        website: a.website ?? '',
        status: 'Scouted',
        antRating: '',
        hasDeepDive: false,
        deepDive: null,
      }));

    if (newArtists.length === 0) {
      return new Response(JSON.stringify({ error: 'All returned artists already in pipeline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const updatedArtists = [...existingArtists, ...newArtists];
    const ok = await kvSet('pipeline:snapshot', {
      artists: updatedArtists,
      snapshotAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: ok,
      added: newArtists.length,
      artists: newArtists,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (e) {
    console.error('[test/art-scout]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
