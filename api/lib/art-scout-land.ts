// Art Scout land decisions.
//
// The 2026-09-21 batch ended stop_reason pause_turn: web_search notes, no
// artist JSON. parseJSON returned null and the poller dequeued it.
// Partial JSON is salvaged and landed. Prose or an empty body is held on
// the queue with the notes attached. Nothing here submits another scout.

import { parseJSON } from './anthropic-batch';

export const ART_SCOUT_MODEL = 'claude-sonnet-4-6';
export const ART_SCOUT_MAX_TOKENS = 16000;
/** Stay under the batch server-tool iteration cap so the schema can still be emitted. */
export const ART_SCOUT_SEARCH_BUDGET = 30;

const ARTIST_PROPERTIES = {
  name: { type: 'string' },
  location: { type: 'string' },
  medium: { type: 'string' },
  score: { type: 'number' },
  priceRange: { type: 'string' },
  whyInteresting: { type: 'string' },
  showsPress: { type: 'string' },
  instagram: { type: 'string' },
  website: { type: 'string' },
  status: { type: 'string', enum: ['Scouted'] },
} as const;

const ARTIST_REQUIRED = Object.keys(ARTIST_PROPERTIES);

/** Grammar-constrained final message. Web search still runs; the last text block must match this. */
export const ART_SCOUT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    artists: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: ARTIST_PROPERTIES,
        required: ARTIST_REQUIRED,
      },
    },
  },
  required: ['artists'],
};

export const ART_SCOUT_OUTPUT_CONFIG = {
  format: {
    type: 'json_schema',
    schema: ART_SCOUT_OUTPUT_SCHEMA,
  },
};

/**
 * Strict tool alternative. The poller lands this if a batch ends on tool_use
 * instead of schema text. Not sent by default: json_schema already forces the
 * final text, and a client tool can stop the turn before that text exists.
 */
export const SUBMIT_ARTISTS_TOOL = {
  name: 'submit_artists',
  description: 'Submit the curated artist list. This tool call is the batch result. Prose is not landed.',
  strict: true,
  input_schema: ART_SCOUT_OUTPUT_SCHEMA,
};

export interface ArtScoutArtifact {
  stopReason: string;
  reason: string;
  notes: string;
  excerpt: string;
}

export type ArtScoutPlan =
  | { action: 'land'; artists: any[] }
  | { action: 'hold'; reason: string; stopReason: string; artifact: ArtScoutArtifact };

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

function payloadFromValue(parsed: any): { ok: true; artists: any[] } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) {
    const artists = artistsFromParsed(parsed);
    if (!artists.length) return null;
    return { ok: true, artists };
  }
  if (Array.isArray(parsed.artists)) {
    const artists = artistsFromParsed(parsed);
    // A non-empty list that salvages to nobody is incomplete. Hold it.
    // An explicit empty array is a finished schema result.
    if (!artists.length && parsed.artists.length > 0) return null;
    return { ok: true, artists };
  }
  return null;
}

/** Schema text, salvaged partial JSON, or a submit_artists tool_use input. */
export function artistPayload(resultItem: any): { ok: true; artists: any[] } | { ok: false } {
  const content = resultItem?.result?.message?.content;
  if (Array.isArray(content)) {
    for (let i = content.length - 1; i >= 0; i--) {
      const block = content[i];
      if (block?.type !== 'tool_use' || block.name !== 'submit_artists') continue;
      const input = typeof block.input === 'string' ? parseJSON(block.input) : block.input;
      const payload = payloadFromValue(input);
      if (payload) return payload;
    }
  }

  const blocks = textBlocks(resultItem);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const payload = payloadFromValue(parseJSON(blocks[i]));
    if (payload) return payload;
  }
  if (blocks.length > 1) {
    const payload = payloadFromValue(parseJSON(blocks.join('\n')));
    if (payload) return payload;
  }
  return { ok: false };
}

export function planArtScout(resultItem: any): ArtScoutPlan {
  if (!resultItem) {
    return hold('empty result', 'empty', '');
  }

  const resultType = resultItem?.result?.type;
  const stopReason = String(resultItem?.result?.message?.stop_reason ?? resultType ?? 'unknown');
  const notes = researchNotes(resultItem).trim();

  if (resultType === 'succeeded') {
    const payload = artistPayload(resultItem);
    if (payload.ok) return { action: 'land', artists: payload.artists };
    return hold(`no artist payload (stop_reason=${stopReason})`, stopReason, notes);
  }

  const failType = resultType ?? 'unknown';
  return hold(`result type=${failType}`, stopReason, notes);
}

function hold(reason: string, stopReason: string, notes: string): ArtScoutPlan {
  return {
    action: 'hold',
    reason,
    stopReason,
    artifact: {
      stopReason,
      reason,
      notes,
      excerpt: notes.slice(0, 500),
    },
  };
}
