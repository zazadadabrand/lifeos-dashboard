import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJSON } from './anthropic-batch.ts';
import { planArtScout, artistsFromParsed } from './art-scout-land.ts';

const ARTIST = {
  name: 'Ada Lott',
  location: 'Atlanta, USA',
  medium: 'Oil painting',
  score: 81,
  priceRange: '$800–$2,000',
  whyInteresting: 'Material-forward abstraction with a thin exhibition record.',
  showsPress: 'MFA thesis 2025',
  instagram: '@adalott',
  website: 'adalott.com',
  status: 'Scouted',
};

const SECOND = { ...ARTIST, name: 'Bea Moss', instagram: '@beamoss', website: 'beamoss.com' };

describe('parseJSON salvage', () => {
  it('parses a clean artists payload', () => {
    const parsed = parseJSON(JSON.stringify({ artists: [ARTIST, SECOND] }));
    assert.equal(artistsFromParsed(parsed).length, 2);
  });

  it('strips fences and leading prose', () => {
    const text = 'Here is the list:\n```json\n' + JSON.stringify({ artists: [ARTIST] }) + '\n```\nDone.';
    const parsed = parseJSON(text);
    assert.equal(artistsFromParsed(parsed)[0].name, 'Ada Lott');
  });

  it('repairs a trailing comma', () => {
    const text = '{"artists":[{"name":"Ada Lott","score":81,},]}';
    const parsed = parseJSON(text) as { artists: { name: string; score: number }[] };
    assert.equal(parsed.artists[0].name, 'Ada Lott');
    assert.equal(parsed.artists[0].score, 81);
  });

  it('salvages complete artists when the JSON is truncated mid-next object', () => {
    const full = JSON.stringify({ artists: [ARTIST, SECOND] });
    const cut = full.slice(0, full.lastIndexOf('"Bea Moss"') + 4);
    assert.throws(() => JSON.parse(cut));
    const parsed = parseJSON(cut);
    const artists = artistsFromParsed(parsed);
    assert.equal(artists.length, 1);
    assert.equal(artists[0].name, 'Ada Lott');
    assert.equal(artists[0].instagram, '@adalott');
  });

  it('returns null for research prose with no JSON', () => {
    const prose = 'I can confirm: Benji Stiles is represented by Foltz Fine Art and Heights Art Gallery — RED FLAG. Let me do some final targeted checks.';
    assert.equal(parseJSON(prose), null);
  });
});

describe('planArtScout', () => {
  const pauseTurn = {
    custom_id: 'art-scout-2026-09-21',
    result: {
      type: 'succeeded',
      message: {
        stop_reason: 'pause_turn',
        content: [
          { type: 'text', text: 'Aaron Feltman — aaronfeltman.weebly.com / @aaronjfeltman confirmed. Ariel Oakley — arieloakley.com / @arieloakleypelletier confirmed.' },
          { type: 'server_tool_use', name: 'web_search', input: { query: 'more artists' } },
          { type: 'text', text: 'I can confirm: Benji Stiles is represented by Foltz Fine Art — RED FLAG. Let me look at some other sources.' },
          { type: 'server_tool_use', name: 'web_search', input: { query: 'SAIC MFA 2026' } },
        ],
      },
    },
  };

  it('holds a pause_turn batch that never emitted JSON and keeps the notes', () => {
    const plan = planArtScout(pauseTurn);
    assert.equal(plan.action, 'hold');
    if (plan.action !== 'hold') return;
    assert.equal(plan.stopReason, 'pause_turn');
    assert.match(plan.artifact.notes, /Aaron Feltman/);
    assert.match(plan.artifact.excerpt, /Benji Stiles/);
  });

  it('holds an empty result instead of dropping it', () => {
    const plan = planArtScout(undefined);
    assert.equal(plan.action, 'hold');
    if (plan.action !== 'hold') return;
    assert.equal(plan.stopReason, 'empty');
  });

  it('lands a submit_artists tool call even when the text is prose', () => {
    const item = {
      result: {
        type: 'succeeded',
        message: {
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'I can confirm: Benji Stiles is represented by Foltz Fine Art — RED FLAG.' },
            { type: 'tool_use', name: 'submit_artists', input: { artists: [ARTIST] } },
          ],
        },
      },
    };
    const plan = planArtScout(item);
    assert.equal(plan.action, 'land');
    if (plan.action !== 'land') return;
    assert.equal(plan.artists[0].name, 'Ada Lott');
  });

  it('lands an explicit empty artists array from the schema', () => {
    const item = {
      result: {
        type: 'succeeded',
        message: {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: '{"artists":[]}' }],
        },
      },
    };
    const plan = planArtScout(item);
    assert.equal(plan.action, 'land');
    if (plan.action !== 'land') return;
    assert.equal(plan.artists.length, 0);
  });

  it('lands truncated JSON instead of holding', () => {
    const full = JSON.stringify({ artists: [ARTIST, SECOND] });
    const cut = full.slice(0, full.indexOf('"Bea Moss"') + 5);
    const item = {
      result: {
        type: 'succeeded',
        message: {
          stop_reason: 'max_tokens',
          content: [
            { type: 'text', text: 'Checking a few more names.' },
            { type: 'text', text: cut },
          ],
        },
      },
    };
    const plan = planArtScout(item);
    assert.equal(plan.action, 'land');
    if (plan.action !== 'land') return;
    assert.equal(plan.artists.length, 1);
    assert.equal(plan.artists[0].name, 'Ada Lott');
  });

  it('lands a fenced final text block that follows tool use', () => {
    const item = {
      result: {
        type: 'succeeded',
        message: {
          stop_reason: 'end_turn',
          content: [
            { type: 'server_tool_use', name: 'web_search' },
            { type: 'web_search_tool_result', content: [] },
            { type: 'text', text: '```json\n' + JSON.stringify({ artists: [ARTIST] }) + '\n```' },
          ],
        },
      },
    };
    const plan = planArtScout(item);
    assert.equal(plan.action, 'land');
  });
});
