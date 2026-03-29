export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { submitBatch, WEB_SEARCH_TOOL } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

// CONFIDENTIAL — do not reference current employer or PIP in any output
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are a confidential job search assistant for a candidate conducting a private job search.

CANDIDATE PROFILE:
- Black American male, 35, based in Atlanta GA
- 8+ years in digital marketing
- Skills: Influencer ecosystems, brand partnerships, off-channel marketing, campaign strategy, content seeding, social media management, creator campaigns, clipping/repurposing, paid media, analytics reporting, project management
- Target roles: Director of Marketing, Senior Brand Manager, VP Marketing, Director of Brand Partnerships, Director of Social Media, Director of Content Strategy, Director of Influencer, Fractional CMO
- Salary floor: $150,000 minimum — do not suggest any role below this. Non-negotiable.
- Location: Remote preferred, Atlanta-based, or major market hybrid (NYC/LA/CHI/ATL)
- Preferred verticals: Direct response, influencer-heavy, creator economy, sports, entertainment, lifestyle, consumer brands

CONFIDENTIALITY: This is a private search. Never reference any current employer.

HARD RULES:
1. Use web_search to find currently open job postings — do not rely on training data. Search LinkedIn, Greenhouse, Lever, company career pages.
2. Salary must be $150K+. Skip anything below.
3. Include a real, direct application URL for every job — verify the link is live before including it.
4. Do not repeat companies from the exclusion list.
5. Return ONLY valid JSON. No prose before or after.

RESPONSE FORMAT (no markdown fences):
{
  "jobs": [
    {
      "company": "Company Name",
      "role": "Exact Job Title",
      "salaryRange": "$X–$Y",
      "location": "Remote / City, State",
      "url": "https://...",
      "fit": "Best Fit",
      "whyFit": "1-2 sentences on why this is a strong match",
      "deadline": "YYYY-MM-DD or null"
    }
  ]
}

Group jobs as: Best Fit (3-4 results), Worth a Look (2-3 results), Stretch (0-1 result). Use the "fit" field for this grouping.`;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    // Build exclusion list from existing business pipeline job deals
    const bizSnapshot = await kvGet('business:snapshot');
    const existingJobs: string[] = (bizSnapshot?.deals ?? [])
      .filter((d: any) => d.type === 'Job')
      .map((d: any) => d.company)
      .filter(Boolean);

    // Add hardcoded previously surfaced companies
    const alreadySurfaced = [
      'NinjaTrader', 'RYZE Superfoods', 'MEC', 'AXS', 'AEG Worldwide', 'Gong', 'Seed', 'Advarra',
      'GiveDirectly', 'Point of View Beauty', 'Maven Clinic', 'Alma', 'GitLab', 'Patrick Ta Beauty', 'IonQ',
      'PopSockets', 'Vacation Inc', 'Medium', 'Comfrt', 'Freebird', 'Impartner', 'Rockbot',
      'Zillow', 'HydraFacial',
    ];
    const exclusionList = [...new Set([...existingJobs, ...alreadySurfaced])];

    const userMessage = `Find 7 currently open director/senior manager level marketing jobs meeting all criteria. Salary $150K+ only. Include direct application URLs.\n\nSKIP THESE COMPANIES (already surfaced):\n${exclusionList.join(', ')}\n\nReturn 7 jobs as JSON, grouped as Best Fit / Worth a Look / Stretch.`;

    const batch = await submitBatch([
      {
        custom_id: `job-scout-${new Date().toISOString().split('T')[0]}`,
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

    const current = await kvGet('agent:batches');
    const batches: any[] = current?.batches ?? [];
    batches.push({
      batchId: batch.id,
      agentType: 'job-scout',
      submittedAt: new Date().toISOString(),
    });
    await kvSet('agent:batches', { batches });

    return new Response(JSON.stringify({ success: true, batchId: batch.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[job-scout]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
