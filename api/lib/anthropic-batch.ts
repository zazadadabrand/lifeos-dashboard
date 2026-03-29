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
    'anthropic-beta': 'message-batches-2024-09-24',
    'content-type': 'application/json',
  };
}

export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
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

/** Extract text content from a succeeded batch result item. */
export function extractText(resultItem: any): string | null {
  if (resultItem?.result?.type !== 'succeeded') return null;
  const content = resultItem?.result?.message?.content;
  if (!Array.isArray(content)) return null;
  const textBlock = content.find((b: any) => b.type === 'text');
  return textBlock?.text ?? null;
}

/** Parse JSON from model output — strips markdown fences if present. */
export function parseJSON(text: string): any | null {
  try {
    // Strip ```json ... ``` fences if model wrapped output
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
