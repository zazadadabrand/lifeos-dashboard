export const config = { runtime: 'edge' };

import { kvGet, kvSet } from '../lib/kv';
import { getBatch, getBatchResults, extractText, parseJSON } from '../lib/anthropic-batch';
import { isCronAuthorized, unauthorizedResponse, CORS } from '../lib/cron-auth';

const today = () => new Date().toISOString().split('T')[0];

// Auto-push art-scout results directly into pipeline:snapshot
async function pushArtists(artists: any[]): Promise<number> {
  const snapshot = await kvGet('pipeline:snapshot');
  const existing: any[] = snapshot?.artists ?? [];
  const existingNames = new Set(existing.map((a: any) => a.name));

  const newArtists = artists
    .filter((a: any) => a.name && !existingNames.has(a.name))
    .map((a: any) => ({
      sheetRow: 0,
      dateScouted: today(),
      batch: `art-scout-${today()}`,
      link: a.website ?? '',
      antRating: '',
      hasDeepDive: false,
      deepDive: null,
      ...a,
      status: a.status ?? 'Scouted',
    }));

  if (newArtists.length === 0) return 0;

  await kvSet('pipeline:snapshot', {
    artists: [...existing, ...newArtists],
    snapshotAt: new Date().toISOString(),
  });

  return newArtists.length;
}

// Auto-push deep-dive enrichment results back into pipeline:snapshot
async function pushDeepDives(results: any[], artistNames: string[]): Promise<number> {
  const snapshot = await kvGet('pipeline:snapshot');
  const artists: any[] = snapshot?.artists ?? [];

  let enriched = 0;

  for (const result of results) {
    if (!result || !result.artistName) continue;

    // Find matching artist in pipeline by name
    const idx = artists.findIndex((a: any) =>
      a.name.toLowerCase().trim() === result.artistName.toLowerCase().trim()
    );

    if (idx === -1) {
      // Try matching against the provided artistNames list
      const matchName = artistNames.find(n =>
        n.toLowerCase().trim() === result.artistName.toLowerCase().trim()
      );
      if (!matchName) continue;
      // Try again with the matched name
      const idx2 = artists.findIndex((a: any) =>
        a.name.toLowerCase().trim() === matchName.toLowerCase().trim()
      );
      if (idx2 === -1) continue;
      artists[idx2] = {
        ...artists[idx2],
        hasDeepDive: true,
        deepDive: result,
      };
      enriched++;
    } else {
      artists[idx] = {
        ...artists[idx],
        hasDeepDive: true,
        deepDive: result,
      };
      enriched++;
    }
  }

  if (enriched > 0) {
    await kvSet('pipeline:snapshot', {
      artists,
      snapshotAt: new Date().toISOString(),
    });
  }

  return enriched;
}

// Auto-push job-scout and grants-scout results directly into business:snapshot
async function pushDeals(deals: any[], agentType: string): Promise<number> {
  const snapshot = await kvGet('business:snapshot');
  const existing: any[] = snapshot?.deals ?? [];
  const existingNames = new Set(existing.map((d: any) => d.name));

  const isGrant = agentType === 'grants-scout';

  const newDeals = deals
    .filter((d: any) => {
      const name = d.name ?? d.company ?? d.title;
      return name && !existingNames.has(name);
    })
    .map((d: any) => {
      const name = d.name ?? d.company ?? d.title;
      const id = `${isGrant ? 'grant' : 'job'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const base = {
        id,
        client: '',
        description: d.whyFit ?? d.eligibility ?? '',
        tier: '',
        monthlyValue: 0,
        netMargin: 0,
        addedAt: new Date().toISOString(),
        notes: d.whyFit ?? '',
        dueDate: d.deadline ?? '',
        contactName: '',
        contactEmail: '',
        nextAction: '',
        stage: 'Lead',
        dateAdded: today(),
        batch: `${agentType}-${today()}`,
        url: d.url ?? '',
      };
      if (isGrant) {
        return {
          ...base,
          type: 'Grant',
          name,
          phase: 'short',
          organization: d.organization ?? '',
          amount: d.amount ?? '',
          deadline: d.deadline ?? '',
          eligibility: d.eligibility ?? '',
          whyFit: d.whyFit ?? '',
          grantStage: 'Found',
        };
      } else {
        return {
          ...base,
          type: 'Job',
          name: d.title ? `${d.title}${d.company ? ` @ ${d.company}` : ''}` : name,
          phase: 'cross',
          company: d.company ?? '',
          role: d.title ?? d.role ?? name,
          salaryRange: d.salary ?? d.compensation ?? '',
          applicationJourney: 'Bookmarked',
          interviewStage: 'Bookmarked',
          journeyHistory: [],
        };
      }
    });

  if (newDeals.length === 0) return 0;

  await kvSet('business:snapshot', {
    deals: [...existing, ...newDeals],
    snapshotAt: new Date().toISOString(),
  });

  return newDeals.length;
}

// Mirror new clipping leads into the Airtable "Clipping Leads" table so the
// workspace (which reads Airtable first) surfaces them. Best-effort.
const CLIPPING_BASE_ID = 'apppZ2gNZ9tjORpvp';
const CLIPPING_TABLE_ID = 'tblVkuHFCD96iJ4ia';

async function airtableCreateClipping(leads: any[]): Promise<void> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat || leads.length === 0) return;

  const records = leads.map((l: any) => ({
    fields: {
      'Channel Name': l.channelName ?? l.name ?? '',
      'Date Scouted': l.dateScouted ?? today(),
      'Batch': l.batch ?? `clipping-scout-${today()}`,
      'Lane': l.lane ?? '',
      'Subs': l.subs ?? '',
      'Score': typeof l.score === 'number' ? l.score : (parseInt(l.score, 10) || 0),
      'Why Clip': l.whyClip ?? '',
      'Shows Press': l.showsPress ?? '',
      'YT Handle': l.ytHandle ?? '',
      'Website': l.youtubeUrl ?? l.website ?? '',
      'Instagram': l.instagram ?? '',
      'Email': l.email ?? '',
      'Contact Status': l.contactStatus ?? 'Private / none found',
      'Status': l.status ?? 'Scouted',
    },
  }));

  // Airtable max 10 records per create request
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      await fetch(`https://api.airtable.com/v0/${CLIPPING_BASE_ID}/${CLIPPING_TABLE_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: batch, typecast: true }),
      });
    } catch (e) {
      console.error('[batch-poller] airtableCreateClipping failed', e);
    }
  }
}

// Auto-push clipping-scout results into clipping:snapshot (dedup) + Airtable
async function pushLeads(leads: any[]): Promise<number> {
  const snapshot = await kvGet('clipping:snapshot');
  const existing: any[] = snapshot?.leads ?? [];
  const existingNames = new Set(
    existing.map((l: any) => (l.channelName ?? l.name ?? '').toLowerCase().trim()).filter(Boolean)
  );

  const newLeads = leads
    .filter((l: any) => {
      const name = (l.channelName ?? l.name ?? '').toLowerCase().trim();
      return name && !existingNames.has(name);
    })
    .map((l: any) => ({
      dateScouted: today(),
      batch: `clipping-scout-${today()}`,
      antRating: '',
      ...l,
      status: l.status ?? 'Scouted',
    }));

  if (newLeads.length === 0) return 0;

  await kvSet('clipping:snapshot', {
    leads: [...existing, ...newLeads],
    snapshotAt: new Date().toISOString(),
  });

  // Mirror to Airtable for the workspace UI (best-effort)
  await airtableCreateClipping(newLeads);

  return newLeads.length;
}

// ═══════════════════════════════════════════
// CD SCOUT — daily creative director curation
// Completion contract: drop anything under 8, dedup against cd-scout:seen
// (forever registry), append new names to it, create rows in the Airtable
// "CD Pipeline" table (LifeOS base) with Stage = Curated.
// ═══════════════════════════════════════════
const CD_BASE_ID = 'apppZ2gNZ9tjORpvp';   // LifeOS base
const CD_TABLE_ID = 'tblH2zLUwGm6OoGle';  // CD Pipeline

async function airtableCreateCDs(cds: any[]): Promise<void> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat || cds.length === 0) return;

  const records = cds.map((c: any) => ({
    fields: {
      'Name': c.name ?? '',
      'Date': today(),
      'Role': c.role ?? '',
      'Disciplines': c.disciplines ?? '',
      'Tier': c.tier ?? (c.total >= 12 ? 'Study' : 'Watch'),
      'Total': typeof c.total === 'number' ? c.total : 0,
      'World': c.scores?.worldCoherence ?? 0,
      'Range': c.scores?.range ?? 0,
      'Taste': c.scores?.tasteSignal ?? 0,
      'Study': c.scores?.studyYield ?? 0,
      'Proximity': c.scores?.proximity ?? 0,
      'Signature Work 1': c.signatureWorks?.[0]?.url ?? '',
      'Signature Work 2': c.signatureWorks?.[1]?.url ?? '',
      'Signature Work 3': c.signatureWorks?.[2]?.url ?? '',
      'Why': c.whyTheyMadeTheCut ?? '',
      'Study Note': [
        c.studyNote ?? '',
        // Preserve work titles alongside URLs (URL fields hold links only)
        ...(Array.isArray(c.signatureWorks)
          ? [`\n\nWorks: ${c.signatureWorks.map((w: any) => w?.title).filter(Boolean).join(' · ')}`]
          : []),
      ].join(''),
      'Links': c.links ?? '',
      'Stage': 'Curated',
      'Batch': `cd-scout-${today()}`,
    },
  }));

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      await fetch(`https://api.airtable.com/v0/${CD_BASE_ID}/${CD_TABLE_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: batch, typecast: true }),
      });
    } catch (e) {
      console.error('[batch-poller] airtableCreateCDs failed', e);
    }
  }
}

async function pushCDs(cds: any[]): Promise<number> {
  // Score floor: anything under 8 is dropped by the poller
  const scored = cds.filter((c: any) => c.name && (typeof c.total === 'number' ? c.total : 0) >= 8);

  // Dedup against the forever registry (case-insensitive)
  const seen = await kvGet('cd-scout:seen');
  const seenNames: string[] = seen?.names ?? [];
  const seenSet = new Set(seenNames.map((n: string) => n.toLowerCase().trim()));

  const fresh = scored.filter((c: any) => !seenSet.has(c.name.toLowerCase().trim()));
  if (fresh.length === 0) return 0;

  // Append names to the registry — they never resurface, even after Pass
  await kvSet('cd-scout:seen', {
    names: [...seenNames, ...fresh.map((c: any) => c.name)],
    updatedAt: new Date().toISOString(),
  });

  // Rows land in the Airtable CD Pipeline table as Curated
  await airtableCreateCDs(fresh);

  return fresh.length;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!isCronAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const batchStore = await kvGet('agent:batches');
    const pendingBatches: any[] = batchStore?.batches ?? [];

    if (pendingBatches.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'No pending batches' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const remaining: any[] = [];
    const log: string[] = [];
    let processed = 0;

    for (const entry of pendingBatches) {
      const { batchId, agentType, submittedAt } = entry;

      const batch = await getBatch(batchId);
      if (!batch) {
        remaining.push(entry);
        continue;
      }

      if (batch.processing_status !== 'ended') {
        remaining.push(entry);
        continue;
      }

      // Batch complete — retrieve and auto-push
      const lines = await getBatchResults(batchId);
      const resultLine = lines[0];
      const text = extractText(resultLine);

      if (text) {
        const parsed = parseJSON(text);
        if (parsed) {
          let added = 0;
          if (agentType === 'art-scout') {
            added = await pushArtists(parsed.artists ?? []);
            log.push(`art-scout: +${added} artists`);
          } else if (agentType === 'deep-dive') {
            // Deep dive batches have multiple results (one per artist)
            // Each result line is a separate artist's enrichment
            const allResults: any[] = [];
            // First result is already parsed above; collect all result lines
            allResults.push(parsed);
            // Parse remaining result lines (batch has one result per request)
            for (let ri = 1; ri < lines.length; ri++) {
              const lineText = extractText(lines[ri]);
              if (lineText) {
                const lineParsed = parseJSON(lineText);
                if (lineParsed) allResults.push(lineParsed);
              }
            }
            const artistNames: string[] = entry.artistNames ?? [];
            added = await pushDeepDives(allResults, artistNames);
            log.push(`deep-dive: +${added} briefs enriched`);
          } else if (agentType === 'job-scout') {
            added = await pushDeals(parsed.jobs ?? [], agentType);
            log.push(`job-scout: +${added} jobs`);
          } else if (agentType === 'grants-scout') {
            added = await pushDeals(parsed.grants ?? [], agentType);
            log.push(`grants-scout: +${added} grants`);
          } else if (agentType === 'clipping-scout') {
            added = await pushLeads(parsed.leads ?? []);
            log.push(`clipping-scout: +${added} leads`);
          } else if (agentType === 'cd-scout') {
            added = await pushCDs(parsed.cds ?? []);
            log.push(`cd-scout: +${added} CDs`);
          }
          processed++;
        } else {
          log.push(`${agentType}: JSON parse failed`);
          console.error(`[batch-poller] Failed to parse JSON for ${agentType} ${batchId}`);
          console.error('[batch-poller] Raw text:', text.slice(0, 500));
        }
      } else {
        const failType = resultLine?.result?.type ?? 'unknown';
        log.push(`${agentType}: result type=${failType}`);
        console.error(`[batch-poller] ${agentType} ${batchId} result type: ${failType}`);
      }
      // Remove from queue regardless of success/failure
    }

    await kvSet('agent:batches', { batches: remaining });

    return new Response(JSON.stringify({ success: true, processed, remaining: remaining.length, log }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    console.error('[batch-poller]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
