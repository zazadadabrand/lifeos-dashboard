export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { getBatch, getBatchResults, extractText, parseJSON } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const today = () => new Date().toISOString().split('T')[0];

// Auto-push art-scout results directly into pipeline:snapshot
async function pushArtists(artists: any[]): Promise<number> {
  const snapshot = await kvGet('pipeline:snapshot');
  const existing: any[] = snapshot?.artists ?? [];
  const existingNames = new Set(existing.map((a: any) => a.name));

  const newArtists = artists
    .filter((a: any) => a.name && !existingNames.has(a.name))
    .map((a: any) => ({
      sheetRow: 0,
      dateScouted: today(),
      batch: `art-scout-${today()}`,
      link: a.website ?? '',
      antRating: '',
      hasDeepDive: false,
      deepDive: null,
      ...a,
      status: a.status ?? 'Scouted',
    }));

  if (newArtists.length === 0) return 0;

  await kvSet('pipeline:snapshot', {
    artists: [...existing, ...newArtists],
    snapshotAt: new Date().toISOString(),
  });

  return newArtists.length;
}

// Auto-push job-scout and grants-scout results directly into business:snapshot
async function pushDeals(deals: any[], agentType: string): Promise<number> {
  const snapshot = await kvGet('business:snapshot');
  const existing: any[] = snapshot?.deals ?? [];
  const existingNames = new Set(existing.map((d: any) => d.name));

  const isGrant = agentType === 'grants-scout';
  const dealType = isGrant ? 'Grant' : 'Job';

  const newDeals = deals
    .filter((d: any) => {
      const name = d.name ?? d.company ?? d.title;
      return name && !existingNames.has(name);
    })
    .map((d: any) => {
      const name = d.name ?? d.company ?? d.title;
      if (isGrant) {
        return {
          type: 'Grant',
          name,
          organization: d.organization ?? '',
          amount: d.amount ?? '',
          deadline: d.deadline ?? '',
          url: d.url ?? '',
          eligibility: d.eligibility ?? '',
          whyFit: d.whyFit ?? '',
          status: 'Researching',
          dateAdded: today(),
          batch: `${agentType}-${today()}`,
        };
      } else {
        return {
          type: 'Job',
          name,
          company: d.company ?? '',
          title: d.title ?? d.role ?? '',
          salary: d.salary ?? d.compensation ?? '',
          url: d.url ?? '',
          whyFit: d.whyFit ?? '',
          status: 'Researching',
          dateAdded: today(),
          batch: `${agentType}-${today()}`,
        };
      }
    });

  if (newDeals.length === 0) return 0;

  await kvSet('business:snapshot', {
    deals: [...existing, ...newDeals],
    snapshotAt: new Date().toISOString(),
  });

  return newDeals.length;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const batchStore = await kvGet('agent:batches');
    const pendingBatches: any[] = batchStore?.batches ?? [];

    if (pendingBatches.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'No pending batches' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const remaining: any[] = [];
    const log: string[] = [];
    let processed = 0;

    for (const entry of pendingBatches) {
      const { batchId, agentType, submittedAt } = entry;

      const batch = await getBatch(batchId);
      if (!batch) {
        remaining.push(entry);
        continue;
      }

      if (batch.processing_status !== 'ended') {
        remaining.push(entry);
        continue;
      }

      // Batch complete — retrieve and auto-push
      const lines = await getBatchResults(batchId);
      const resultLine = lines[0];
      const text = extractText(resultLine);

      if (text) {
        const parsed = parseJSON(text);
        if (parsed) {
          let added = 0;
          if (agentType === 'art-scout') {
            added = await pushArtists(parsed.artists ?? []);
            log.push(`art-scout: +${added} artists`);
          } else if (agentType === 'job-scout') {
            added = await pushDeals(parsed.jobs ?? [], agentType);
            log.push(`job-scout: +${added} jobs`);
          } else if (agentType === 'grants-scout') {
            added = await pushDeals(parsed.grants ?? [], agentType);
            log.push(`grants-scout: +${added} grants`);
          }
          processed++;
        } else {
          log.push(`${agentType}: JSON parse failed`);
          console.error(`[batch-poller] Failed to parse JSON for ${agentType} ${batchId}`);
          console.error('[batch-poller] Raw text:', text.slice(0, 500));
        }
      } else {
        const failType = resultLine?.result?.type ?? 'unknown';
        log.push(`${agentType}: result type=${failType}`);
        console.error(`[batch-poller] ${agentType} ${batchId} result type: ${failType}`);
      }
      // Remove from queue regardless of success/failure
    }

    await kvSet('agent:batches', { batches: remaining });

    return new Response(JSON.stringify({ success: true, processed, remaining: remaining.length, log }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[batch-poller]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
