export const config = { runtime: 'edge' };

const SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019cf4cc-d5b8-705a-97d6-502d72422549";

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  try {
    const resp = await fetch(SNAPSHOT_BLOB, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Snapshot fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
