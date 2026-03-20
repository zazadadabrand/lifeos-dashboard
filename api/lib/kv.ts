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
  'pipeline:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0bac-10d8-7d9c-bf5c-251ae9ec3bb1',
  'pipeline:changes': 'https://jsonblob.com/api/jsonBlob/019d0c8a-faf3-728a-956c-755b6ccf03fb',
  'family:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0c8b-54c8-7b73-aeb6-fe1b072d307b',
  'family:changes': 'https://jsonblob.com/api/jsonBlob/019d0c8b-5589-71f2-b6f5-7400030bd815',
  'business:snapshot': 'https://jsonblob.com/api/jsonBlob/019d0913-7de1-73dc-9c6d-3e0b65fe5cc0',
  'business:changes': 'https://jsonblob.com/api/jsonBlob/019d0913-92d5-785b-bba0-701e44e34f06',
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
