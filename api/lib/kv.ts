/**
 * Upstash Redis KV helper for Vercel Edge Functions.
 * Uses the REST API — no npm packages needed.
 *
 * Env vars (set in Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://us1-xyz.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */

const getUrl = () => process.env.UPSTASH_REDIS_REST_URL!;
const getToken = () => process.env.UPSTASH_REDIS_REST_TOKEN!;

/** GET a JSON value by key */
export async function kvGet(key: string): Promise<any | null> {
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
