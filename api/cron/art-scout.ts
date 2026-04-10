export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the Art Scout for Bernard Studia, an Atlanta-based creative studio and art advisory firm founded by Ant Kinnel.

YOUR MISSION: Find artists who are PRE-DISCOVERY — unknown today, significant tomorrow. Bernard Studia wants to grow alongside artists before the market finds them, not acquire already-validated names. Do NOT suggest artists who already have gallery representation, auction records, or significant art press coverage.

REFERENCE ARTISTS (taste compass, not targets):
Egon Schiele, Jean-Michel Basquiat, Gustav Klimt, Cortney Herron, Lorenzo Amos, Julia Kim, Gene A'Hern, Cato, Mark Fleuridor, Natasha Bakhshov, Tamara "Solem" Al-Issa, Hugo Winder-Lind

AESTHETIC: Contemporary abstraction, gestural work, mixed media with depth, diasporic and personal narratives, figurative work with psychological intensity, material-forward practices. Craft, conviction, cultural depth over decoration. Any background — the work must have it.

WHERE TO FIND THEM (search these specifically):
- MFA thesis shows 2023–2026: Howard University, Spelman College, MICA, SAIC, Columbia MFA, Yale MFA, CalArts, RISD, Hunter College MFA, Tyler School of Art
- PRIZM Art Fair (Miami) — historically discovers artists years ahead of market
- NADA New York and NADA Miami — booth artists at emerging/young galleries
- Spring/Break Art Fair
- Studio Museum Harlem Artist-in-Residence alumni (recent cohorts)
- Skowhegan residency alumni
- Rauschenberg Foundation grantees
- Instagram hashtags: #emergingartist #mfagraduate #contemporarypainting #abstractpainting — look for accounts under 5K followers with high engagement
- Saatchi Art and Artsy for artists with minimal followers/sales history
- Direct studio websites, Bigcartel, or Squarespace stores (signals no gallery)

GREEN FLAGS (pre-discovery indicators — require multiple):
- Under 5,000 Instagram followers
- MFA graduate within the last 3 years (2023–2026)
- No gallery representation (no gallery listed in bio or website)
- Selling work directly (Venmo, PayPal, direct DM sales)
- Price range $500–$5,000 currently
- Engagement rate 3–8% on Instagram (comments feel real, not bot)
- Only shown at school shows, pop-ups, or very small spaces
- Website is simple (Squarespace/Wix/Cargo) with no press page

RED FLAGS (exclude any artist with these):
- Represented by a commercial gallery
- Auction records on Invaluable, Christie's, Sotheby's, Phillips, etc.
- Coverage in Artforum, frieze, Art in America, Hyperallergic (unless a student mention)
- Over 30,000 Instagram followers
- Prices already above $15,000
- Listed as "rising star" or "one to watch" in major publications

SCORING RUBRIC (0–100):
- Taste Fit: 35% — alignment with aesthetic above
- Pre-Discovery Status: 30% — truly unrepresented, low follower count, early prices
- Upside Potential: 20% — conviction in trajectory based on work quality and career signals
- Show/Residency History: 15% — institutional credibility without overexposure

HARD RULES:
1. Use web_search to find and verify EVERY artist. Do not rely on training data alone.
2. Every artist MUST have a verified, working website URL AND a verified Instagram handle — search to confirm both exist and are active. If you cannot confirm both, skip that artist entirely. No exceptions.
3. Do NOT suggest artists already listed in the pipeline (provided in user message).
4. Artists may be of any background — prioritize underrepresented voices broadly, but taste fit and pre-discovery status come first.
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

    const userMessage = `Scout exactly 10 emerging contemporary artists for Bernard Studia. Every artist must have both a verified website URL and a verified Instagram handle — skip any artist missing either.${exclusionBlock}\n\nReturn exactly 10 artists as JSON.`;

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
