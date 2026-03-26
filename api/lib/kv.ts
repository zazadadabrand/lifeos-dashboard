/**
 * Upstash Redis KV helper for Vercel Edge Functions.
 * Uses the REST API — no npm packages needed.
 *
 * Env vars (set in Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xyz.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */

// JSONBlob fallback URLs — REBUILT 2026-03-26 (8th rebuild due to free-tier TTL expiry)
const JSONBLOB_FALLBACK: Record<string, string> = {
  'pipeline:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2abc-afb5-7357-a8eb-ef52113b2ab2',
  'pipeline:changes': 'https://jsonblob.com/api/jsonBlob/019d2abc-b135-73a2-b519-e00f43751481',
  'family:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2abc-b61e-76c3-a3ef-a32aef0d0d1c',
  'family:changes': 'https://jsonblob.com/api/jsonBlob/019d2abc-b795-72a0-93fe-a41e3a539580',
  'business:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2abc-b2c0-7c41-bfbd-2b1cbc006e5a',
  'business:changes': 'https://jsonblob.com/api/jsonBlob/019d2abc-b488-7113-96f0-a171201feccf',
  'notes:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2abc-b93e-7ffe-81f1-aff2648f1da1',
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
