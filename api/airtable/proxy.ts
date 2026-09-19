export const config = { runtime: 'edge' };

/**
 * Airtable proxy — keeps PAT server-side.
 *
 * GET  /api/airtable/proxy?table=Outreach           → list all records
 * GET  /api/airtable/proxy?table=Outreach&id=recXYZ → get one record
 * POST /api/airtable/proxy?table=Outreach            → create record(s)  body: { fields } or { records }
 * PATCH /api/airtable/proxy?table=Outreach&id=recXYZ → update record     body: { fields }
 * DELETE /api/airtable/proxy?table=Outreach&id=recXYZ → delete record
 */

const BASE_ID = 'apppZ2gNZ9tjORpvp';            // LifeOS base (default)
const BERNARD_OPS_BASE_ID = 'appRiVlukeNES8GO3'; // Bernard Studia Ops base

const ALLOWED_TABLES: Record<string, string> = {
  'artists':  'tblHBC8yJQbejxqHg',
  'outreach': 'tbluGWIHohMkLlJVb',
  'jobs':     'tbl2j7sXApKFtQ8kG',
  'grants':   'tbl8Yr902XCzid47O',
  'clipping': 'tbl8by0SmTy4BFbaE',  // YT Clipping Prospects — V2, in Bernard Studia Ops base (see TABLE_BASES)
  'clipsources': 'tblKtAbg12W2m6qxk', // Clip Sources (source videos) — Bernard Studia Ops base
  'clips':       'tblpwMCiW43m6sneP', // Clips (individual clips) — Bernard Studia Ops base
  'cds':         'tblH2zLUwGm6OoGle', // CD Pipeline (daily CD Scout curation) — LifeOS base
};

// Tables that live outside the default LifeOS base. Falls back to BASE_ID when absent.
const TABLE_BASES: Record<string, string> = {
  'clipping': BERNARD_OPS_BASE_ID,
  'clipsources': BERNARD_OPS_BASE_ID,
  'clips': BERNARD_OPS_BASE_ID,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function airtableFetch(path: string, opts: RequestInit = {}) {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return res;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const tableParam = (url.searchParams.get('table') || '').toLowerCase();
    const recordId = url.searchParams.get('id');

    const tableId = ALLOWED_TABLES[tableParam];
    if (!tableId) {
      return jsonResp({ error: `Unknown table: ${tableParam}. Allowed: ${Object.keys(ALLOWED_TABLES).join(', ')}` }, 400);
    }

    const baseId = TABLE_BASES[tableParam] || BASE_ID;
    const basePath = `${baseId}/${tableId}`;

    // GET — list or get single
    if (req.method === 'GET') {
      // Airtable paginates at 100 records; fetch all pages
      let allRecords: any[] = [];
      let offset: string | undefined;
      do {
        const qp = new URLSearchParams();
        if (recordId) break; // single record, no pagination
        if (offset) qp.set('offset', offset);
        qp.set('pageSize', '100');
        const res = await airtableFetch(`${basePath}${recordId ? `/${recordId}` : ''}?${qp}`);
        const data = await res.json();
        if (!res.ok) return jsonResp(data, res.status);
        if (recordId) return jsonResp(data);
        allRecords = allRecords.concat(data.records || []);
        offset = data.offset;
      } while (offset);
      return jsonResp({ records: allRecords });
    }

    // POST — create
    if (req.method === 'POST') {
      const body = await req.json();
      // Support single { fields } or batch { records: [{ fields }] }
      const payload = body.records ? body : { records: [{ fields: body.fields }] };

      // Airtable max 10 per batch — split if needed
      const allRecords = payload.records;
      const created: any[] = [];
      for (let i = 0; i < allRecords.length; i += 10) {
        const batch = allRecords.slice(i, i + 10);
        const res = await airtableFetch(basePath, {
          method: 'POST',
          body: JSON.stringify({ records: batch }),
        });
        const data = await res.json();
        if (!res.ok) return jsonResp(data, res.status);
        created.push(...(data.records || []));
      }
      return jsonResp({ records: created });
    }

    // PATCH — update
    if (req.method === 'PATCH') {
      if (!recordId) return jsonResp({ error: 'id param required for PATCH' }, 400);
      const body = await req.json();
      const res = await airtableFetch(`${basePath}/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: body.fields }),
      });
      const data = await res.json();
      return jsonResp(data, res.ok ? 200 : res.status);
    }

    // DELETE
    if (req.method === 'DELETE') {
      if (!recordId) return jsonResp({ error: 'id param required for DELETE' }, 400);
      const res = await airtableFetch(`${basePath}/${recordId}`, { method: 'DELETE' });
      const data = await res.json();
      return jsonResp(data, res.ok ? 200 : res.status);
    }

    return jsonResp({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    return jsonResp({ error: e.message || 'Internal error' }, 500);
  }
}
