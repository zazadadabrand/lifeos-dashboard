export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { getBatch, getBatchResults, extractText, parseJSON } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

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

    const resultStore = await kvGet('agent:results');
    const existingResults: any[] = resultStore?.results ?? [];

    const remaining: any[] = [];
    let processed = 0;

    for (const entry of pendingBatches) {
      const { batchId, agentType, submittedAt } = entry;

      const batch = await getBatch(batchId);
      if (!batch) {
        // Can't reach API — keep in queue, try again next poll
        remaining.push(entry);
        continue;
      }

      if (batch.processing_status !== 'ended') {
        // Still running
        remaining.push(entry);
        continue;
      }

      // Batch complete — fetch results
      const lines = await getBatchResults(batchId);
      const resultLine = lines[0]; // Each scout submits exactly 1 request per batch
      const text = extractText(resultLine);

      if (text) {
        const parsed = parseJSON(text);
        if (parsed) {
          existingResults.push({
            id: `${agentType}-${batchId}`,
            agentType,
            batchId,
            data: parsed,
            receivedAt: new Date().toISOString(),
            reviewed: false,
          });
          processed++;
        } else {
          console.error(`[batch-poller] Failed to parse JSON for ${agentType} batch ${batchId}`);
          console.error('[batch-poller] Raw text:', text.slice(0, 500));
        }
      } else {
        // Log the failure type for debugging
        const failType = resultLine?.result?.type ?? 'unknown';
        console.error(`[batch-poller] ${agentType} batch ${batchId} result type: ${failType}`);
      }
      // Whether successful or failed, remove from pending queue
    }

    // Write back updated stores
    await kvSet('agent:batches', { batches: remaining });
    if (processed > 0) {
      await kvSet('agent:results', { results: existingResults });
    }

    return new Response(JSON.stringify({ success: true, processed, remaining: remaining.length }), {
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
