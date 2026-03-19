/**
 * Upstash Redis KV helper for Vercel Edge Functions.
 * Uses the REST API — no npm packages needed.
 *
 * Env vars (set in Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xyz.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */

// JSONBlob fallback URLs — used when Upstash is not configured yet
const JSONBLOB_FALLBACK: Record<string, string> = {
  'pipeline:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0383-2640-745f-84c7-25cb0c2b5c22',
  'pipeline:changes': 'https://jsonblob.com/api/jsonBlob/019d0383-29d9-701c-9d19-80d8ad7b90b0',
  'family:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0383-2d1c-725f-a620-562275328269',
  'family:changes': 'https://jsonblob.com/api/jsonBlob/019d0383-2f00-7716-82a8-333126e6cb6e',
  'business:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0383-3260-7552-9484-ebcfdac9f3d6',
  'business:changes': 'https://jsonblob.com/api/jsonBlob/019d0383-343a-75d1-b335-8d64f823e6b7',
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
