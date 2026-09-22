// Salvage JSON from model text. Same structural repair as Substrate
// ENGINE_PARSE (lib/parse-model.js): strip fences, take the first JSON
// value, close a truncated tail, then parse. Incomplete trailing tokens
// are dropped so a cut-off artist/object does not discard earlier ones.

function scanStructure(s: string): { inString: boolean; escape: boolean; stack: string[] } {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }
  return { inString, escape, stack };
}

function trimIncompleteTail(s: string): string {
  let t = s.replace(/\s+$/g, '');
  if (t.endsWith('\\')) t = t.slice(0, -1);
  t = t.replace(/,?\s*"[^"]*$/, '');
  t = t.replace(/,?\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*:\s*$/, '');
  t = t.replace(/,?\s*(?:-?\d+\.(?:\d+)?)?$/, (m) => {
    const lit = m.trim();
    if (!lit) return '';
    if (/^-?\d+$/.test(lit)) return m;
    if (/^-?\d+\.\d+$/.test(lit)) return m;
    return '';
  });
  t = t.replace(/,?\s*(?:true|false|null|tru|fals?|nul)?$/i, (m) => {
    const lit = m.trim().toLowerCase();
    if (lit === 'true' || lit === 'false' || lit === 'null') return m;
    return '';
  });
  t = t.replace(/,\s*$/, '');
  return t;
}

/** Drop ``` fences and return text from the first { or [. */
export function extractJsonText(text: string): string {
  if (text == null) return '';
  const stripped = String(text).replace(/```(?:json)?/gi, '').trim();
  const obj = stripped.indexOf('{');
  const arr = stripped.indexOf('[');
  if (obj < 0 && arr < 0) return '';
  if (obj < 0) return stripped.slice(arr);
  if (arr < 0) return stripped.slice(obj);
  return stripped.slice(Math.min(obj, arr));
}

export function tryParseJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stripTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

/** First complete JSON object/array, or the unclosed tail if it never closes. */
export function sliceFirstJsonValue(text: string): string {
  const src = extractJsonText(text);
  if (!src) return '';
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) {
        stack.pop();
        if (stack.length === 0) return src.slice(0, i + 1);
      }
    }
  }
  return src;
}

export function closeTruncatedJson(text: string): string {
  const src = extractJsonText(text);
  if (!src) return '';
  let out = src;
  let state = scanStructure(out);
  if (state.inString) {
    if (state.escape && out.endsWith('\\')) out = out.slice(0, -1);
    out += '"';
  }
  out = trimIncompleteTail(out);
  state = scanStructure(out);
  if (state.inString) out += '"';
  out = out.replace(/,\s*$/, '');
  state = scanStructure(out);
  while (state.stack.length) {
    out += state.stack.pop();
    state = scanStructure(out);
  }
  return out;
}

/**
 * Parse model JSON. Returns the value when the text is valid or can be
 * repaired (fences, preamble, trailing commas, truncated structures).
 * Returns null when there is no JSON value.
 */
export function repairTruncatedJson(text: string): unknown | null {
  if (text == null || !String(text).trim()) return null;
  const slice = sliceFirstJsonValue(text);
  const direct = tryParseJson(stripTrailingCommas(slice));
  if (direct !== null) return direct;
  const closed = closeTruncatedJson(slice || text);
  const repaired = tryParseJson(stripTrailingCommas(closed));
  if (repaired !== null) return repaired;
  return null;
}
