export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';

const KEY = 'agent:batches';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (req.method === 'PUT') {
      const body = await req.json();
      const ok = await kvSet(KEY, body);
      return new Response(JSON.stringify({ success: ok }), {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const data = await kvGet(KEY);
    return new Response(JSON.stringify(data ?? { batches: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', ...CORS },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
