/**
 * Upstash Redis KV helper for Vercel Edge Functions.
 * Uses the REST API — no npm packages needed.
 *
 * Env vars (set in Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xyz.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */

// JSONBlob fallback URLs — REBUILT 2026-03-28 (9th rebuild due to free-tier TTL expiry)
const JSONBLOB_FALLBACK: Record<string, string> = {
  'pipeline:snapshot': 'https://jsonblob.com/api/jsonBlob/019d3520-a282-7af9-b973-a01878c86dd4',
  'pipeline:changes': 'https://jsonblob.com/api/jsonBlob/019d3520-a9ae-7f33-8376-f82d99f6335f',
  'family:snapshot': 'https://jsonblob.com/api/jsonBlob/019d3520-bb2b-73d3-8b31-763cdc57d95c',
  'family:changes': 'https://jsonblob.com/api/jsonBlob/019d3520-bf7b-700c-900d-eab5e62b46bb',
  'business:snapshot': 'https://jsonblob.com/api/jsonBlob/019d3520-b136-78f6-b9b0-63ffd3958540',
  'business:changes': 'https://jsonblob.com/api/jsonBlob/019d3520-b6f4-76c6-a634-576b08ae471e',
  'notes:snapshot': 'https://jsonblob.com/api/jsonBlob/019d3520-c460-76d2-b638-4d7bdac5c974',
};

function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const getUrl = () => process.env.UPSTASH_REDIS_REST_URL!;
const getToken = () => process.env.UPSTASH_REDIS_REST_TOKEN!;

// ═══════════════════════════════════════════
// WIPE PROTECTION — hardcoded, no override
// Prevents any PUT from replacing a populated pipeline with empty data.
// Data can only be cleared via manual user action (not API calls).
// ═══════════════════════════════════════════

/** Returns the array field name for a given key, or null if not a protected key */
function getProtectedArrayField(key: string): string | null {
  if (key === 'pipeline:snapshot') return 'artists';
  if (key === 'business:snapshot') return 'deals';
  if (key === 'family:snapshot') return 'ideas';
  if (key === 'clipping:snapshot') return 'leads';
  return null;
}

/**
 * Check if a write would wipe a non-empty pipeline.
 * Returns true if the write should be BLOCKED.
 */
function wouldWipePipeline(key: string, newValue: any, existingValue: any): boolean {
  const field = getProtectedArrayField(key);
  if (!field) return false; // Not a protected key

  const existingItems = existingValue?.[field];
  const newItems = newValue?.[field];

  // If existing has items and new is empty/missing — BLOCK
  if (Array.isArray(existingItems) && existingItems.length > 0) {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      console.error(
        `[WIPE PROTECTION] BLOCKED: Attempted to overwrite ${key} ` +
        `(${existingItems.length} ${field}) with empty data. ` +
        `This requires manual approval.`
      );
      return true;
    }
  }

  return false;
}

/** GET a JSON value by key */
export async function kvGet(key: string): Promise<any | null> {
  // Fallback to JSONBlob if Upstash not configured
  if (!isUpstashConfigured()) {
    const fallbackUrl = JSONBLOB_FALLBACK[key];
    if (!fallbackUrl) return null;
    const resp = await fetch(fallbackUrl, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    return resp.json();
  }

  const resp = await fetch(`${getUrl()}/get/${key}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  // Upstash returns { result: "stringified JSON" } for GET
  if (json.result === null || json.result === undefined) return null;
  try {
    return typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
  } catch {
    return json.result;
  }
}

/** SET a JSON value by key (no expiry) — with WIPE PROTECTION */
export async function kvSet(key: string, value: any): Promise<boolean> {
  // ── WIPE PROTECTION: read existing data before writing ──
  const protectedField = getProtectedArrayField(key);
  if (protectedField) {
    const existing = await kvGet(key);
    if (wouldWipePipeline(key, value, existing)) {
      return false; // BLOCKED — do not write
    }
  }

  // Fallback to JSONBlob if Upstash not configured
  if (!isUpstashConfigured()) {
    const fallbackUrl = JSONBLOB_FALLBACK[key];
    if (!fallbackUrl) return false;
    const resp = await fetch(fallbackUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(value),
    });
    return resp.ok;
  }

  const payload = JSON.stringify(value);
  const resp = await fetch(`${getUrl()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, payload]),
  });
  if (!resp.ok) return false;
  const json = await resp.json();
  return json.result === 'OK';
}
