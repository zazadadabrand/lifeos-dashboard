export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { ART_SCOUT_MAX_TOKENS, ART_SCOUT_MODEL, ART_SCOUT_SEARCH_BUDGET } from '../lib/art-scout-land';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = ART_SCOUT_MODEL;
const MAX_TOKENS = ART_SCOUT_MAX_TOKENS;
const ARTISTS_BASE_ID = 'apppZ2gNZ9tjORpvp';
const ARTISTS_TABLE_ID = 'tblHBC8yJQbejxqHg';

function etDate(iso?: string): string {
  const parsed = iso ? new Date(iso) : new Date();
  const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(when);
}

async function artistsBatchExists(batchName: string): Promise<boolean> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return false;
  const qp = new URLSearchParams({
    pageSize: '1',
    filterByFormula: `{Batch}="${batchName}"`,
  });
  qp.append('fields[]', 'Name');
  try {
    const res = await fetch(`https://api.airtable.com/v0/${ARTISTS_BASE_ID}/${ARTISTS_TABLE_ID}?${qp}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return (data.records?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function pipelineNames(): Promise<string[]> {
  const names = new Set<string>();

  const snapshot = await kvGet('pipeline:snapshot');
  for (const artist of snapshot?.artists ?? []) {
    if (artist?.name) names.add(String(artist.name));
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return [...names];

  let offset: string | undefined;
  do {
    const qp = new URLSearchParams({ pageSize: '100' });
    qp.append('fields[]', 'Name');
    if (offset) qp.set('offset', offset);
    const res = await fetch(`https://api.airtable.com/v0/${ARTISTS_BASE_ID}/${ARTISTS_TABLE_ID}?${qp}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const record of data.records ?? []) {
      if (record.fields?.Name) names.add(String(record.fields.Name));
    }
    offset = data.offset;
  } while (offset);

  return [...names];
}

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
6. Return ONLY valid JSON. No prose before or after. The final message must be the JSON object, not a research diary.
7. SEARCH BUDGET: you have at most 30 web searches. When the budget is spent, stop searching immediately and return JSON for every artist you have fully verified. Fewer than 10 is success. Ending the turn on prose is failure.

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
    // Skip anyone already in KV or the Airtable Artists Pipeline (source of truth for the UI).
    const existingNames = await pipelineNames();

    const exclusionBlock = existingNames.length > 0
      ? `\n\nARTISTS ALREADY IN PIPELINE — skip all of these:\n${existingNames.join('\n')}`
      : '';

    const day = etDate();
    const batchName = `art-scout-${day}`;

    // One curation per ET day. A paused batch still in the queue (including
    // its no-search finalize) counts, so a manual re-run cannot double-curate.
    const current = await kvGet('agent:batches');
    const batches: any[] = current?.batches ?? [];
    const pendingToday = batches.filter((b) => b?.agentType === 'art-scout' && etDate(b.submittedAt) === day);
    if (pendingToday.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'pending',
        batchId: pendingToday[0].batchId,
        batch: batchName,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (await artistsBatchExists(batchName)) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'already-landed',
        batch: batchName,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const userMessage = `Scout up to 10 emerging contemporary artists for Bernard Studia. Every artist must have both a verified website URL and a verified Instagram handle — skip any artist missing either. You have at most ${ART_SCOUT_SEARCH_BUDGET} web searches. When you hit that budget, return JSON for the artists you have already verified.${exclusionBlock}\n\nReturn the artists as JSON.`;

    const batch = await submitBatch([
      {
        custom_id: batchName,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: [{ ...WEB_SEARCH_TOOL, max_uses: ART_SCOUT_SEARCH_BUDGET }],
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

    // Re-read so a batch queued while names were loading is not overwritten.
    const queued = await kvGet('agent:batches');
    const next: any[] = queued?.batches ?? [];
    if (next.some((b) => b?.agentType === 'art-scout' && etDate(b.submittedAt) === day)) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'pending',
        batchId: next.find((b) => b?.agentType === 'art-scout')?.batchId,
        batch: batchName,
        note: 'Another art-scout batch was queued while this one was submitting. This batch id was not stored.',
        droppedBatchId: batch.id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    next.push({
      batchId: batch.id,
      agentType: 'art-scout',
      submittedAt: new Date().toISOString(),
    });
    await kvSet('agent:batches', { batches: next });

    return new Response(JSON.stringify({ success: true, batchId: batch.id, batch: batchName, excluded: existingNames.length }), {
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
