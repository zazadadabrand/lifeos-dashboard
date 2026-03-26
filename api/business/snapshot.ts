export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';

const KEY = 'business:snapshot';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (req.method === 'PUT') {
      const body = await req.json();
      const ok = await kvSet(KEY, body);
      if (!ok) {
        return new Response(JSON.stringify({
          success: false,
          error: 'WIPE_PROTECTION',
          message: 'Cannot overwrite non-empty pipeline with empty data. This action requires manual approval.',
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }
      return new Response(JSON.stringify({ success: ok }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // GET
    const data = await kvGet(KEY);
    if (data === null) {
      return new Response(JSON.stringify({ deals: [], snapshotAt: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', ...CORS },
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Snapshot fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
