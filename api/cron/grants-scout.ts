export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

// CRITICAL: Ant is a business founder, NOT a practicing artist.
// Only business grants — NEVER artist grants, residencies, or artist-specific funding.
const SYSTEM_PROMPT = `You are the Grants Scout for Bernard Studia, an Atlanta-based creative studio and business.

ABOUT THE APPLICANT:
- Ant Kinnel, Black American male, 35 (under 40), Atlanta GA (ZIP 30101)
- Business founder and operator — NOT a practicing or professional artist
- Bernard Studia is a registered for-profit business in Georgia
- Business focus: creative studio, artist representation, digital marketing services

ELIGIBLE GRANT TYPES (search ONLY these):
- Black-owned business grants
- Minority entrepreneur / minority-owned business grants
- Young entrepreneur grants (under 40)
- Small business startup and growth grants
- Creative economy / creative industry business grants (for businesses, not individual artists)
- Georgia and Atlanta metro area business funding
- SBA and federal small business programs
- Nonprofit and corporate foundations funding minority-owned businesses

STRICTLY FORBIDDEN:
- Artist grants, artist residencies, or any grant requiring practicing artist status
- Fellowships for individual artists
- Any grant where "artist" is a required eligibility criterion

HARD RULES:
1. Every grant must have a real, working application URL.
2. Only include grants that are currently open, rolling, or opening within 60 days.
3. Bernard Studia qualifies as a Black-owned creative BUSINESS — not as an artist practice.
4. Return ONLY valid JSON. No prose before or after.

RESPONSE FORMAT (no markdown fences):
{
  "grants": [
    {
      "name": "Grant Program Name",
      "organization": "Funding Organization",
      "amount": "$X,000 or range",
      "deadline": "YYYY-MM-DD or rolling",
      "url": "https://...",
      "eligibility": "Key eligibility requirements in 1 sentence",
      "whyFit": "Why Bernard Studia qualifies — 1-2 sentences"
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
    // Get existing grants to avoid duplicates
    const bizSnapshot = await kvGet('business:snapshot');
    const existingGrants: string[] = (bizSnapshot?.deals ?? [])
      .filter((d: any) => d.type === 'Grant')
      .map((d: any) => d.name)
      .filter(Boolean);

    const exclusionBlock = existingGrants.length > 0
      ? `\n\nGRANTS ALREADY IN PIPELINE — skip these:\n${existingGrants.join('\n')}`
      : '';

    const userMessage = `Find 3-5 currently open or rolling grant opportunities for Bernard Studia, a Black-owned creative business in Atlanta GA. Business grants ONLY — no artist grants.${exclusionBlock}\n\nReturn 3-5 grants as JSON.`;

    const batch = await submitBatch([
      {
        custom_id: `grants-scout-${new Date().toISOString().split('T')[0]}`,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
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

    const current = await kvGet('agent:batches');
    const batches: any[] = current?.batches ?? [];
    batches.push({
      batchId: batch.id,
      agentType: 'grants-scout',
      submittedAt: new Date().toISOString(),
    });
    await kvSet('agent:batches', { batches });

    return new Response(JSON.stringify({ success: true, batchId: batch.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[grants-scout]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
