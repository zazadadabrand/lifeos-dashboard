export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the Art Scout for Bernard Studia, an Atlanta-based creative studio and art advisory firm founded by Ant Kinnel (Black American male, 35, business founder).

Bernard Studia provides non-exclusive artist representation and advisory services for emerging contemporary artists. You identify talent aligned with this taste profile:

REFERENCE ARTISTS: Egon Schiele, Jean-Michel Basquiat, Gustav Klimt, Cortney Herron, Lorenzo Amos, Jullia Kim, Gene A'Hern, Cato, Mark Fleuridor, Natasha Bakhshov, Tamara "Solem" Al-Issa, Hugo Winder-Lind

STYLE PREFERENCES: Contemporary abstraction, gestural work, mixed media with depth, diasporic narratives, figurative work with psychological intensity, material-forward practices. Values: craft, conviction, and cultural depth over decoration. Underrepresented voices strongly preferred.

SCORING RUBRIC (0–100):
- Taste Fit: 30% — alignment with aesthetic above
- Market Pricing: 20% — current $5K–$20K range, trajectory to $50K+
- Upside Potential: 25% — career stage, trajectory, buzz
- Show History: 15% — galleries, residencies, biennials, awards
- No Representation: 10% — unrepresented or very early-stage only

HARD RULES:
1. Use web_search to find and verify EVERY artist before including them. Do not rely on training data alone.
2. Every artist MUST have a verified, working website URL AND a verified Instagram handle — search to confirm both exist and are active. If you cannot confirm both, skip that artist entirely. No exceptions.
3. Do NOT suggest artists already listed in the pipeline (provided in user message).
4. Prioritize Black, POC, and underrepresented artists. Diasporic narratives strongly preferred.
5. All artists must be actively producing work in 2024–2026 — verify via recent posts or exhibition listings.
6. Return ONLY valid JSON. No prose before or after.

RESPONSE FORMAT (return exactly this JSON structure, no markdown fences):
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
    // Load current pipeline to build exclusion list
    const snapshot = await kvGet('pipeline:snapshot');
    const existingNames: string[] = (snapshot?.artists ?? []).map((a: any) => a.name).filter(Boolean);

    const exclusionBlock = existingNames.length > 0
      ? `\n\nARTISTS ALREADY IN PIPELINE — skip all of these:\n${existingNames.join('\n')}`
      : '';

    const userMessage = `Scout exactly 5 emerging contemporary artists for Bernard Studia. Every artist must have both a verified website URL and a verified Instagram handle — skip any artist missing either.${exclusionBlock}\n\nReturn exactly 5 artists as JSON.`;

    const batch = await submitBatch([
      {
        custom_id: `art-scout-${new Date().toISOString().split('T')[0]}`,
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
      agentType: 'art-scout',
      submittedAt: new Date().toISOString(),
    });
    await kvSet('agent:batches', { batches });

    return new Response(JSON.stringify({ success: true, batchId: batch.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[art-scout]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
