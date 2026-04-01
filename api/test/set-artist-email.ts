export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

// One-shot endpoint: PATCH email onto a named artist in pipeline:snapshot
// POST body: { "name": "Artist Name", "email": "email@example.com" }
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const { name, email } = await req.json() as { name: string; email: string };
    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const snapshot = await kvGet('pipeline:snapshot');
    const artists: any[] = snapshot?.artists ?? [];
    const idx = artists.findIndex((a: any) => a.name === name);

    if (idx === -1) {
      return new Response(JSON.stringify({ error: `Artist "${name}" not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    artists[idx] = { ...artists[idx], email };
    const ok = await kvSet('pipeline:snapshot', { artists, snapshotAt: new Date().toISOString() });

    return new Response(JSON.stringify({ success: ok, updated: name, email }), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
