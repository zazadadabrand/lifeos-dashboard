export const config = { runtime: 'edge' };

const FAMILY_SNAPSHOT_BLOB = "https://jsonblob.com/api/jsonBlob/019d0383-2d1c-725f-a620-562275328269";

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  try {
    if (req.method === 'PUT') {
      const body = await req.text();
      const resp = await fetch(FAMILY_SNAPSHOT_BLOB, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body,
      });
      return new Response(JSON.stringify({ success: resp.ok }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // GET
    const resp = await fetch(FAMILY_SNAPSHOT_BLOB, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Family snapshot fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
