/**
 * Upstash Redis KV helper for Vercel Edge Functions.
 * Uses the REST API — no npm packages needed.
 *
 * Env vars (set in Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xyz.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */

// JSONBlob fallback URLs — used when Upstash is not configured yet
// JSONBlob fallback URLs — REBUILT 2026-03-25 (7th rebuild due to free-tier TTL expiry)
const JSONBLOB_FALLBACK: Record<string, string> = {
  'pipeline:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2583-5d2f-7024-9fa1-663d586da0b5',
  'pipeline:changes': 'https://jsonblob.com/api/jsonBlob/019d2583-5e97-7157-9956-0019ff314bdc',
  'family:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2583-5f3d-76b3-be6e-2ae65f31f9ae',
  'family:changes': 'https://jsonblob.com/api/jsonBlob/019d2583-6063-7f34-b908-0b9b537cafaf',
  'business:snapshot': 'https://jsonblob.com/api/jsonBlob/019d2583-6138-729b-914b-5d687c24ccbf',
  'business:changes': 'https://jsonblob.com/api/jsonBlob/019d2583-61e7-78d6-a2f6-2955b8a9e6dd',
};

function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const getUrl = () => process.env.UPSTASH_REDIS_REST_URL!;
const getToken = () => process.env.UPSTASH_REDIS_REST_TOKEN!;

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

/** SET a JSON value by key (no expiry) */
export async function kvSet(key: string, value: any): Promise<boolean> {
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
