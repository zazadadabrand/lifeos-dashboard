/**
 * Anthropic Messages Batch API helper.
 * Uses fetch directly — no SDK needed in edge functions.
 *
 * Requires env var: ANTHROPIC_API_KEY
 * Docs: https://docs.anthropic.com/en/api/creating-message-batches
 */

const BASE = 'https://api.anthropic.com/v1/messages/batches';

function headers(): Record<string, string> {
  return {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'message-batches-2024-09-24,web-search-2025-03-05',
    'content-type': 'application/json',
  };
}

// Web search tool — Anthropic executes searches server-side within the same request.
// No multi-turn needed; results are returned inline in the model's response.
export const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
};

export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    tools?: any[];
  };
}

export interface BatchRecord {
  id: string;
  processing_status: 'in_progress' | 'canceling' | 'ended';
  ended_at: string | null;
  created_at: string;
  expires_at: string;
}

/** Submit a batch. Returns the batch record or null on failure. */
export async function submitBatch(requests: BatchRequest[]): Promise<BatchRecord | null> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) {
      console.error('[anthropic-batch] submit failed:', res.status, await res.text());
      return null;
    }
    return res.json() as Promise<BatchRecord>;
  } catch (e) {
    console.error('[anthropic-batch] submit error:', e);
    return null;
  }
}

/** Get status of an existing batch. */
export async function getBatch(batchId: string): Promise<BatchRecord | null> {
  try {
    const res = await fetch(`${BASE}/${batchId}`, { headers: headers() });
    if (!res.ok) return null;
    return res.json() as Promise<BatchRecord>;
  } catch {
    return null;
  }
}

/** Get results for a completed batch. Returns array of NDJSON result lines. */
export async function getBatchResults(batchId: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/${batchId}/results`, { headers: headers() });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract text content from a succeeded batch result item.
 *  With web_search tool use, content may have multiple text blocks —
 *  the final one contains the JSON output. We try each text block in
 *  reverse order so the last (most complete) response is returned first.
 */
export function extractText(resultItem: any): string | null {
  if (resultItem?.result?.type !== 'succeeded') return null;
  const content = resultItem?.result?.message?.content;
  if (!Array.isArray(content)) return null;
  const textBlocks = content.filter((b: any) => b.type === 'text').map((b: any) => b.text);
  // Return last text block first (most likely to be the final JSON response)
  return textBlocks[textBlocks.length - 1] ?? null;
}

/** Parse JSON from model output — strips markdown fences and leading prose. */
export function parseJSON(text: string): any | null {
  // Strip ```json ... ``` fences if model wrapped output
  const fenceStripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(fenceStripped);
  } catch { /* try harder below */ }

  // If there's leading prose before the JSON object, extract from first { to last }
  const start = fenceStripped.indexOf('{');
  const end = fenceStripped.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(fenceStripped.slice(start, end + 1));
    } catch { /* give up */ }
  }
  return null;
}
