// Art Scout land decisions. The batch API pauses a long web_search turn with
// stop_reason "pause_turn" and no final JSON (server tools guide). Parsing
// that prose fails; dropping the batch is how 2026-09-21 landed zero rows.
// A paused turn is finalized from the research notes already in the result,
// without another search.

import { parseJSON } from './anthropic-batch';

export const ART_SCOUT_MODEL = 'claude-sonnet-4-6';
export const ART_SCOUT_MAX_TOKENS = 16000;
/** Stay under the batch server-tool iteration cap so the model can still emit JSON. */
export const ART_SCOUT_SEARCH_BUDGET = 30;

export const ART_SCOUT_FINALIZE_SYSTEM = `You turn Art Scout research notes into the final artist list for Bernard Studia.

Return ONLY valid JSON. No markdown fences. No prose before or after.

Include an artist ONLY when the notes explicitly confirm both a website and an Instagram handle AND do not mark them as a red flag (gallery representation, auction record, or major-press validation). Skip everyone else. Do not invent URLs, handles, or names that are not in the notes. Fewer than 10 artists is success. An empty list is success when nobody was fully verified.

Schema:
{
  "artists": [
    {
      "name": "Full Name",
      "location": "City, Country",
      "medium": "medium",
      "score": 0,
      "priceRange": "$X–$Y",
      "whyInteresting": "2-3 sentences grounded in the notes",
      "showsPress": "exhibitions and press from the notes",
      "instagram": "@handle",
      "website": "domain.com",
      "status": "Scouted"
    }
  ]
}`;

export interface ArtScoutFinalizeRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: 'user'; content: string }[];
  };
}

export type ArtScoutPlan =
  | { action: 'land'; artists: any[] }
  | { action: 'finalize'; notes: string; stopReason: string }
  | { action: 'drop'; reason: string };

export function textBlocks(resultItem: any): string[] {
  const content = resultItem?.result?.message?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text);
}

export function researchNotes(resultItem: any): string {
  return textBlocks(resultItem).join('\n\n').slice(0, 20000);
}

export function artistsFromParsed(parsed: any): any[] {
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.artists)
      ? parsed.artists
      : [];
  return list.filter((a: any) => {
    if (!a || typeof a !== 'object') return false;
    const name = String(a.name ?? '').trim();
    const website = String(a.website ?? a.site ?? a.url ?? '').trim();
    const instagram = String(a.instagram ?? a.ig ?? '').trim();
    // A truncated tail object often has a name and nothing else. Both
    // contacts are required before a row can land.
    return Boolean(name && website && instagram);
  });
}

/** Try every text block, last first, then the joined notes. */
export function parseArtScoutPayload(resultItem: any): any | null {
  const blocks = textBlocks(resultItem);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const parsed = parseJSON(blocks[i]);
    if (artistsFromParsed(parsed).length) return parsed;
  }
  if (blocks.length > 1) {
    const joined = parseJSON(blocks.join('\n'));
    if (artistsFromParsed(joined).length) return joined;
  }
  return null;
}

export function planArtScout(resultItem: any, phase?: string): ArtScoutPlan {
  if (resultItem?.result?.type !== 'succeeded') {
    const failType = resultItem?.result?.type ?? 'unknown';
    return { action: 'drop', reason: `result type=${failType}` };
  }

  const artists = artistsFromParsed(parseArtScoutPayload(resultItem));
  if (artists.length) return { action: 'land', artists };

  const stopReason = String(resultItem?.result?.message?.stop_reason ?? 'unknown');
  if (phase === 'finalize') {
    return { action: 'drop', reason: `finalize produced no artists (stop_reason=${stopReason})` };
  }

  const notes = researchNotes(resultItem).trim();
  if (!notes) {
    return { action: 'drop', reason: `JSON parse failed (stop_reason=${stopReason})` };
  }

  // pause_turn is the batch web_search cap. max_tokens / end_turn with no
  // JSON is the same failure: notes exist, the artist list does not.
  return { action: 'finalize', notes, stopReason };
}

export function artScoutFinalizeRequest(notes: string, batchDay: string): ArtScoutFinalizeRequest {
  return {
    custom_id: `art-scout-finalize-${batchDay}`,
    params: {
      model: ART_SCOUT_MODEL,
      max_tokens: 8000,
      system: ART_SCOUT_FINALIZE_SYSTEM,
      messages: [{
        role: 'user',
        content: `These are the research notes from an Art Scout turn that was paused before it returned JSON. Emit the artists array now.\n\n${notes}`,
      }],
    },
  };
}
