export const config = { runtime: 'edge' };

/**
 * One-time migration: reads Artists from pipeline KV + Jobs/Grants from business KV,
 * then writes them into the corresponding Airtable tables.
 *
 * POST /api/airtable/migrate?table=artists|jobs|grants
 * Returns { migrated: number } on success.
 */

import { kvGet } from '../lib/kv';

const BASE_ID = 'appRiVlukeNES8GO3';
const TABLES: Record<string, string> = {
  artists: 'tbl24XojZAZ17nfHe',
  jobs:    'tbl6rwdbWpN2IpaNc',
  grants:  'tblhGYQzsyvhQIZKi',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function airtableBatchCreate(tableId: string, records: any[]): Promise<number> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT not configured');

  let created = 0;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Airtable error: ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    created += data.records?.length || 0;
  }
  return created;
}

function mapArtist(a: any) {
  return {
    fields: {
      'Name': a.name || '',
      'Date Scouted': a.dateScouted || undefined,
      'Batch': a.batch || '',
      'Location': a.location || '',
      'Medium': a.medium || '',
      'Score': typeof a.score === 'number' ? a.score : undefined,
      'Price Range': a.priceRange || '',
      'Why Interesting': a.whyInteresting || '',
      'Shows Press': a.showsPress || '',
      'Link': a.link || undefined,
      'Instagram': a.instagram || '',
      'Website': a.website || undefined,
      'Email': a.email || undefined,
      'Status': a.status || 'Scouted',
      'Ant Rating': a.antRating || '',
      'Notes': '',
    },
  };
}

function mapJob(d: any) {
  return {
    fields: {
      'Name': d.name || '',
      'Company': d.company || d.client || '',
      'Role': d.role || '',
      'Description': d.description || '',
      'Stage': d.applicationJourney || d.applicationStage || 'Bookmarked',
      'Salary Range': d.salaryRange || '',
      'URL': d.url || undefined,
      'Contact Name': d.contactName || '',
      'Contact Email': d.contactEmail || undefined,
      'Notes': d.notes || '',
      'Date Added': d.addedAt || d.dateAdded || undefined,
    },
  };
}

function mapGrant(d: any) {
  return {
    fields: {
      'Name': d.grantName || d.name || '',
      'Organization': d.organization || d.client || '',
      'Description': d.description || '',
      'Stage': d.grantStage || 'Found',
      'Amount': d.amount || '',
      'Eligibility': d.eligibility || '',
      'Why Fit': d.whyFit || '',
      'Notes': d.notes || '',
      'Date Added': d.addedAt || d.dateAdded || undefined,
    },
  };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') return jsonResp({ error: 'POST only' }, 405);

  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table')?.toLowerCase();

    if (table === 'artists') {
      const snapshot = await kvGet('pipeline:snapshot');
      if (!snapshot?.artists?.length) return jsonResp({ error: 'No artist data in KV', migrated: 0 });
      const records = snapshot.artists.map(mapArtist);
      const count = await airtableBatchCreate(TABLES.artists, records);
      return jsonResp({ migrated: count, source: 'pipeline:snapshot' });
    }

    if (table === 'jobs') {
      const snapshot = await kvGet('business:snapshot');
      if (!snapshot?.deals?.length) return jsonResp({ error: 'No business data in KV', migrated: 0 });
      const jobDeals = snapshot.deals.filter((d: any) => d.type === 'Job');
      const records = jobDeals.map(mapJob);
      const count = await airtableBatchCreate(TABLES.jobs, records);
      return jsonResp({ migrated: count, source: 'business:snapshot (Jobs)' });
    }

    if (table === 'grants') {
      const snapshot = await kvGet('business:snapshot');
      if (!snapshot?.deals?.length) return jsonResp({ error: 'No business data in KV', migrated: 0 });
      const grantDeals = snapshot.deals.filter((d: any) => d.type === 'Grant');
      const records = grantDeals.map(mapGrant);
      const count = await airtableBatchCreate(TABLES.grants, records);
      return jsonResp({ migrated: count, source: 'business:snapshot (Grants)' });
    }

    return jsonResp({ error: `Unknown table: ${table}. Use artists, jobs, or grants.` }, 400);
  } catch (e: any) {
    return jsonResp({ error: e.message || 'Migration failed' }, 500);
  }
}
