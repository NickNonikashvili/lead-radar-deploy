"use strict";
// The redactor: finds personal data, swaps it for placeholders before anything leaves Gode, puts the
// real values back into answers (also while streaming), and masks high-risk data a model emits on
// its own. Built-in recognizers always run; Presidio adds NER when configured. Nothing in this file
// logs or transmits text: only counts and error codes are ever logged.

const { detectBuiltin, resolveOverlaps, isCommonWord, isDateLike, escapeRegExp } = require("./patterns");
const { createPresidioClient, PresidioError } = require("./presidio");

const LABELS = Object.freeze(["PERSON", "EMAIL", "PHONE", "CARD", "IBAN", "SSN", "IP", "LOCATION", "PASSPORT", "LICENSE", "BANK_ACCOUNT", "CRYPTO", "SECRET"]);
const HIGH_RISK_TYPES = Object.freeze(["CARD", "IBAN", "SSN", "BANK_ACCOUNT", "PASSPORT", "SECRET"]);
const HIGH_RISK = new Set(HIGH_RISK_TYPES);

// Media models cannot round-trip placeholders, so media prompts get a neutral phrase instead.
// [first distinct value, every further distinct value of the same type]
const GENERIC_PHRASES = Object.freeze({
  PERSON: ["a person", "another person"],
  EMAIL: ["an email address", "another email address"],
  PHONE: ["a phone number", "another phone number"],
  CARD: ["a card number", "another card number"],
  IBAN: ["a bank account number", "another bank account number"],
  SSN: ["an ID number", "another ID number"],
  IP: ["an IP address", "another IP address"],
  LOCATION: ["a place", "another place"],
  PASSPORT: ["a passport number", "another passport number"],
  LICENSE: ["a license number", "another license number"],
  BANK_ACCOUNT: ["a bank account number", "another bank account number"],
  CRYPTO: ["a crypto wallet address", "another crypto wallet address"],
  SECRET: ["a secret", "another secret"],
});
const GENERIC_FALLBACK = ["a private detail", "another private detail"];

// ---------------------------------------------------------------------------------------------
// Placeholder syntax. One regex serves restore() and look-alike detection, so "what restore would
// replace" and "what we protect in user text" can never drift apart. Tolerates case changes, a
// missing bracket on either side, and markdown escapes ("\[PERSON\_1\]").
// ---------------------------------------------------------------------------------------------
const LABEL_ALT = [...LABELS]
  .sort((a, b) => b.length - a.length)
  .map((l) => l.replace(/_/g, String.raw`\\?_`))
  .join("|");
const PLACEHOLDER_SOURCE = String.raw`(?:\\?\[)?(?<![A-Za-z0-9_])(${LABEL_ALT})\\?_(\d{1,6})(?![A-Za-z0-9_])(?:\\?\])?`;
const PLACEHOLDER_KEY_RE = /^\[([A-Z][A-Z_]*)_(\d+)\]$/;

function placeholderRegex() {
  return new RegExp(PLACEHOLDER_SOURCE, "gi");
}

function canonicalType(raw) {
  return raw.replace(/\\/g, "").toUpperCase();
}

function placeholderKey(rawType, num) {
  return `[${canonicalType(rawType)}_${num}]`;
}

// ---------------------------------------------------------------------------------------------
// Placeholder map: { v: 1, byValue: { "<TYPE>\0<normalized>": "[TYPE_n]" },
//                    byPlaceholder: { "[TYPE_n]": "<original>" }, counters: { TYPE: n } }
// ---------------------------------------------------------------------------------------------

function emptyMap() {
  return { v: 1, byValue: {}, byPlaceholder: {}, counters: {} };
}

const ownEntries = (obj) => (obj && typeof obj === "object" && !Array.isArray(obj) ? Object.entries(obj) : []);

/**
 * Defensive copy of a stored map. Keys are validated (the map comes back from storage as JSON, and
 * "__proto__" must never become a prototype), dangling entries are dropped, and counters are raised
 * to the highest index in use so a placeholder is never issued twice.
 */
function cloneMap(map) {
  const out = emptyMap();
  if (map === null || map === undefined) return out;
  if (typeof map !== "object" || Array.isArray(map)) throw new TypeError("redact: placeholder map must be an object or null");
  for (const [k, v] of ownEntries(map.byPlaceholder)) {
    if (PLACEHOLDER_KEY_RE.test(k) && typeof v === "string") out.byPlaceholder[k] = v;
  }
  for (const [k, v] of ownEntries(map.byValue)) {
    if (k.includes("\u0000") && typeof v === "string" && Object.hasOwn(out.byPlaceholder, v)) out.byValue[k] = v;
  }
  for (const [k, v] of ownEntries(map.counters)) {
    if (/^[A-Z][A-Z_]*$/.test(k) && Number.isInteger(v) && v >= 0) out.counters[k] = v;
  }
  for (const k of Object.keys(out.byPlaceholder)) {
    const [, type, n] = PLACEHOLDER_KEY_RE.exec(k);
    out.counters[type] = Math.max(out.counters[type] || 0, Number(n));
  }
  return out;
}

/** Canonical form used to decide "same real value" (map key). */
function normalizeValue(type, value) {
  const v = String(value ?? "").normalize("NFKC").trim();
  switch (type) {
    case "EMAIL":
    case "IP":
      return v.toLowerCase();
    case "PHONE": {
      let d = v.replace(/\D/g, "");
      if (/^\s*00/.test(v)) d = d.slice(2); // 0044… == +44…
      if (d.length === 11 && d.startsWith("1")) d = d.slice(1); // +1 555… == 555…
      return d;
    }
    case "CARD":
    case "SSN":
      return v.replace(/\D/g, "");
    case "IBAN":
    case "PASSPORT":
    case "LICENSE":
    case "BANK_ACCOUNT":
      return v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    case "SECRET":
    case "CRYPTO":
      return v; // case-sensitive by nature
    default:
      // Names, places: "Ada  Lovelace", "ada lovelace", "Ada Lovelace." are one person.
      return v.replace(/[’‘]/g, "'").replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").toLowerCase();
  }
}

function assignPlaceholder(state, type, value) {
  const key = `${type}\u0000${normalizeValue(type, value)}`;
  if (Object.hasOwn(state.byValue, key)) return state.byValue[key];
  let n = state.counters[type] || 0;
  let placeholder;
  do {
    n += 1;
    placeholder = `[${type}_${n}]`;
  } while (Object.hasOwn(state.byPlaceholder, placeholder));
  state.counters[type] = n;
  state.byValue[key] = placeholder;
  state.byPlaceholder[placeholder] = value;
  return placeholder;
}

// ---------------------------------------------------------------------------------------------
// Extra entities for redactMessages: values already in the map, and placeholder look-alikes.
// ---------------------------------------------------------------------------------------------

const WORD_START = /^[\p{L}\p{N}_]/u;
const WORD_END = /[\p{L}\p{N}_]$/u;

/** Regex source for one literal value, word-bounded where the value starts/ends with a word char. */
function valueSource(v) {
  const body = escapeRegExp(v).replace(/\s+/g, String.raw`\s+`);
  const pre = WORD_START.test(v) ? String.raw`(?<![\p{L}\p{N}_])` : "";
  const post = WORD_END.test(v) ? String.raw`(?![\p{L}\p{N}_])` : "";
  return pre + body + post;
}

/**
 * Matchers for values the conversation already mapped. This is what keeps a name redacted in later
 * turns (and in restored assistant messages) where no trigger phrase like "my name is" appears.
 * Values are grouped into one alternation per (type, score, case mode): a long conversation can
 * hold hundreds of values and every history message is scanned on every turn.
 */
function knownValueMatchers(state) {
  const groups = new Map();
  const add = (type, value, score, caseSensitive) => {
    const id = `${type}|${score}|${caseSensitive}`;
    if (!groups.has(id)) groups.set(id, { type, score, caseSensitive, values: new Set() });
    groups.get(id).values.add(value.trim());
  };
  for (const [key, placeholder] of Object.entries(state.byValue)) {
    const type = key.slice(0, key.indexOf("\u0000"));
    const value = state.byPlaceholder[placeholder];
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (!v || placeholderRegex().test(v)) continue; // look-alikes are found by their own pass
    if (v.length < 3 && !/\d/.test(v)) continue; // "Al", "Jo": too short to search blindly
    const textual = type === "PERSON" || type === "LOCATION";
    const single = !/\s/.test(v);
    const caseSensitive = type === "SECRET" || type === "CRYPTO" || (textual && single && isCommonWord(v));
    add(type, v, 0.95, caseSensitive);
    if (type === "PERSON" && !single) {
      // "Ada Lovelace" known → a later bare "Ada" is the same person.
      for (const tok of v.split(/\s+/)) {
        if (tok.length >= 3 && /^\p{Lu}/u.test(tok) && !isCommonWord(tok) && !tok.endsWith(".")) add(type, tok, 0.6, true);
      }
    }
  }
  return [...groups.values()].map((g) => {
    // Longest first, so "Ada Lovelace" wins over "Ada" at the same position.
    const alts = [...g.values].sort((a, b) => b.length - a.length).map(valueSource);
    return { type: g.type, score: g.score, re: new RegExp(`(?:${alts.join("|")})`, g.caseSensitive ? "gu" : "giu") };
  });
}

/** "[PERSON_1]" typed by the user is text, not one of our placeholders: it gets mapped like a value. */
function lookalikeEntities(text) {
  const out = [];
  for (const m of text.matchAll(placeholderRegex())) {
    out.push({ type: canonicalType(m[1]), start: m.index, end: m.index + m[0].length, score: 1, literal: true });
  }
  return out;
}

function collectEntities(text, fresh, matchers, withLookalikes) {
  const all = [...fresh];
  if (withLookalikes) all.push(...lookalikeEntities(text));
  for (const m of matchers) {
    for (const x of text.matchAll(m.re)) all.push({ type: m.type, start: x.index, end: x.index + x[0].length, score: m.score, known: true });
  }
  return resolveOverlaps(all, text);
}

function applyPlaceholders(text, entities, state, counts) {
  let out = "";
  let last = 0;
  for (const e of entities) {
    out += text.slice(last, e.start) + assignPlaceholder(state, e.type, e.value);
    last = e.end;
    if (!e.literal) counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return out + text.slice(last);
}

function applyGeneric(text, entities, seenByType, counts) {
  let out = "";
  let last = 0;
  for (const e of entities) {
    if (e.literal) continue; // a typed "[PERSON_1]" is not personal data; leave it
    if (!seenByType.has(e.type)) seenByType.set(e.type, new Map());
    const seen = seenByType.get(e.type);
    const norm = normalizeValue(e.type, e.value);
    const phrases = GENERIC_PHRASES[e.type] || GENERIC_FALLBACK;
    if (!seen.has(norm)) seen.set(norm, seen.size === 0 ? phrases[0] : phrases[1]);
    out += text.slice(last, e.start) + seen.get(norm);
    last = e.end;
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return out + text.slice(last);
}

// ---------------------------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------------------------

/** Replace placeholders that exist in `byPlaceholder`; matches starting before `from` are context only. */
function restoreText(text, byPlaceholder, from = 0) {
  return text.replace(placeholderRegex(), (match, type, num, offset) => {
    if (offset < from) return match;
    const key = placeholderKey(type, num);
    return Object.hasOwn(byPlaceholder, key) ? byPlaceholder[key] : match;
  });
}

function placeholdersOf(map) {
  const src = map && typeof map === "object" ? map.byPlaceholder : null;
  const out = {};
  for (const [k, v] of ownEntries(src)) if (PLACEHOLDER_KEY_RE.test(k) && typeof v === "string") out[k] = v;
  return out;
}

/** Placeholders → real values. Unknown placeholders and everything else stay as they are. */
function restore(text, map) {
  if (typeof text !== "string") return text === null || text === undefined ? "" : String(text);
  const byPlaceholder = placeholdersOf(map);
  if (!text || !Object.keys(byPlaceholder).length) return text;
  return restoreText(text, byPlaceholder);
}

const ASCII_WORD = /[A-Za-z0-9_]/;

/**
 * Could `s` (a buffer suffix) still turn into a placeholder from the map once more text arrives?
 * `prev` is the character before `s`, needed for the word boundary a bare "PERSON_1" requires.
 */
function couldBePlaceholder(s, prev, bodies) {
  let rest = s;
  let bracket = false;
  if (rest.startsWith("\\[")) {
    rest = rest.slice(2);
    bracket = true;
  } else if (rest.startsWith("[")) {
    rest = rest.slice(1);
    bracket = true;
  } else if (rest === "\\") {
    return true; // may become "\["
  }
  if (!bracket && prev && ASCII_WORD.test(prev)) return false;
  if (rest === "") return bracket;
  let core = rest.endsWith("\\") ? rest.slice(0, -1) : rest; // an escape for "_" or "]" may follow
  if (core.includes("]")) return false; // closed: nothing later can change this match
  core = core.replace(/\\_/g, "_").toUpperCase();
  if (!/^[A-Z0-9_]*$/.test(core)) return false;
  return bodies.some((b) => b.startsWith(core));
}

/**
 * Streaming restore. push() returns only text that can no longer be part of a placeholder; the
 * shortest tail that still could ("[", "[PER", "PERSON_1") is held until the next chunk or flush().
 * Concatenated output always equals restore(fullText, map), whatever the chunk boundaries.
 */
function createStreamRestorer(map) {
  const byPlaceholder = placeholdersOf(map);
  const bodies = Object.keys(byPlaceholder).map((k) => k.slice(1, -1));
  if (!bodies.length) {
    return { push: (chunk) => (chunk === null || chunk === undefined ? "" : String(chunk)), flush: () => "" };
  }
  // Longest form: "\[" + body with every "_" escaped + "\]"
  const maxHold = Math.max(...bodies.map((b) => b.length + (b.match(/_/g) || []).length)) + 4;
  let pending = "";
  let prev = ""; // last raw character already emitted: context for word boundaries

  function holdStart(buf) {
    for (let i = Math.max(0, buf.length - maxHold); i < buf.length; i++) {
      if (couldBePlaceholder(buf.slice(i), i > 0 ? buf[i - 1] : prev, bodies)) return i;
    }
    return buf.length;
  }

  function emit(segment) {
    if (!segment) return "";
    const out = prev ? restoreText(prev + segment, byPlaceholder, prev.length).slice(prev.length) : restoreText(segment, byPlaceholder);
    prev = segment[segment.length - 1];
    return out;
  }

  return {
    push(chunk) {
      if (chunk === null || chunk === undefined || chunk === "") return "";
      pending += String(chunk);
      const cut = holdStart(pending);
      const segment = pending.slice(0, cut);
      pending = pending.slice(cut);
      return emit(segment);
    },
    flush() {
      const segment = pending;
      pending = "";
      return emit(segment);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Response filter and sensitivity signal
// ---------------------------------------------------------------------------------------------

const looseForm = (v) => String(v).replace(/[^A-Za-z0-9]/g, "").toUpperCase();

function ownValueIndex(map) {
  const keys = new Set();
  const loose = new Set();
  const byPlaceholder = placeholdersOf(map);
  for (const [key, placeholder] of ownEntries(map && map.byValue)) {
    keys.add(key);
    const original = byPlaceholder[placeholder];
    const lf = typeof original === "string" ? looseForm(original) : "";
    if (lf) loose.add(lf);
  }
  return (type, value) => keys.has(`${type}\u0000${normalizeValue(type, value)}`) || loose.has(looseForm(value));
}

/**
 * Mask high-risk data that appears in model output but is not one of the user's own values (models
 * can regurgitate card numbers or keys from training data). Synchronous: built-in recognizers only.
 */
// Public test/documentation values (Stripe and network test cards, AWS docs keys). Code answers
// legitimately contain them; they identify no one.
const PUBLIC_TEST_CARDS = new Set([
  "4242424242424242", "4111111111111111", "4000056655665556", "5555555555554444", "2223003122003222",
  "5200828282828210", "5105105105105100", "378282246310005", "371449635398431", "6011111111111117",
  "6011000990139424", "3056930009020004", "36227206271667", "3566002020360505", "6200000000000005",
  "4012888888881881", "4222222222222",
]);

function isPublicExample(type, value) {
  if (type === "CARD") return PUBLIC_TEST_CARDS.has(value.replace(/\D/g, ""));
  if (type === "SECRET") return /EXAMPLE/i.test(value);
  return false;
}

function filterResponse(text, map) {
  const masked = {};
  if (typeof text !== "string" || !text) return { text: typeof text === "string" ? text : "", masked };
  const isOwn = ownValueIndex(map);
  const hits = detectBuiltin(text).filter((e) => HIGH_RISK.has(e.type) && !isOwn(e.type, e.value) && !isPublicExample(e.type, e.value));
  if (!hits.length) return { text, masked };
  let out = "";
  let last = 0;
  for (const e of hits) {
    out += `${text.slice(last, e.start)}[redacted ${e.type}]`;
    last = e.end;
    masked[e.type] = (masked[e.type] || 0) + 1;
  }
  return { text: out + text.slice(last), masked };
}

/** True when redaction counts include a high-risk type: a privacy signal for the router. */
function isSensitive(counts) {
  if (!counts || typeof counts !== "object") return false;
  return HIGH_RISK_TYPES.some((t) => Number(counts[t]) > 0);
}

// ---------------------------------------------------------------------------------------------
// Redactor
// ---------------------------------------------------------------------------------------------

// Presidio serves one request at a time (gunicorn 1 worker / the shim's lock). Firing 30 history
// messages at once would make the last ones wait past their timeout and trip the fallback.
const ANALYZE_CONCURRENCY = 4;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** NER sanity checks: spaCy happily tags "Thanks" or a date as an entity. */
function plausibleExternal(e) {
  if (e.type === "PERSON" || e.type === "LOCATION") {
    if (e.value.length < 2 || !/\p{L}/u.test(e.value)) return false;
    if (!/\s/.test(e.value) && isCommonWord(e.value)) return false;
    if (placeholderRegex().test(e.value)) return false;
  }
  if (e.type === "PHONE" && isDateLike(e.value.trim())) return false;
  return true;
}

/**
 * @param {object} config full app config (uses config.privacy)
 * @param {object} [opts] { fetch, logger, presidioRetryMs } — injectable for tests
 */
function createRedactor(config, opts = {}) {
  const privacy = (config && config.privacy) || {};
  const logger = opts.logger || console;
  // While Presidio is failing, skip it for a while instead of adding a timeout to every request.
  const retryMs = Number.isFinite(opts.presidioRetryMs) ? opts.presidioRetryMs : 30_000;
  const presidio = privacy.presidioUrl
    ? createPresidioClient({
        url: privacy.presidioUrl,
        language: privacy.presidioLanguage || "en",
        scoreThreshold: Number.isFinite(privacy.presidioScoreThreshold) ? privacy.presidioScoreThreshold : 0.5,
        timeoutMs: Number.isFinite(opts.presidioTimeoutMs) ? opts.presidioTimeoutMs : 1500,
        fetch: opts.fetch,
      })
    : null;

  let presidioDown = false;
  let retryAt = 0;

  async function presidioEntities(text) {
    if (!presidio || !text.trim()) return [];
    if (presidioDown && Date.now() < retryAt) return [];
    try {
      const found = await presidio.analyze(text);
      if (presidioDown) {
        presidioDown = false;
        logger.info?.("[redact] Presidio analyzer reachable again");
      }
      return found.filter(plausibleExternal);
    } catch (err) {
      if (!presidioDown) {
        // err.message of a PresidioError is built by us and never contains text.
        const why = err instanceof PresidioError ? err.message : err?.name || "error";
        logger.warn?.(`[redact] Presidio analyzer unavailable (${why}); using built-in recognizers only`);
      }
      presidioDown = true;
      retryAt = Date.now() + retryMs;
      return [];
    }
  }

  async function analyze(text) {
    if (typeof text !== "string" || !text) return [];
    const builtin = detectBuiltin(text);
    const external = await presidioEntities(text);
    return external.length ? resolveOverlaps([...builtin, ...external], text) : builtin;
  }

  async function redactMessages(messages, map, { mode = "placeholder" } = {}) {
    if (!Array.isArray(messages)) throw new TypeError("redact: messages must be an array");
    if (mode !== "placeholder" && mode !== "generic") throw new TypeError(`redact: unknown mode "${mode}"`);
    const state = cloneMap(map);
    const counts = {};
    const texts = messages.map((m) => (m && typeof m.content === "string" ? m.content : ""));
    const fresh = await mapLimit(texts, ANALYZE_CONCURRENCY, (t) => analyze(t));
    const placeholder = mode === "placeholder";

    if (placeholder) {
      // Pass 1: register what this call detects, in order of appearance, so a name first introduced
      // in message 5 is also caught in message 2 (and numbering follows the conversation).
      const initial = knownValueMatchers(state);
      texts.forEach((t, i) => {
        if (!t) return;
        for (const e of collectEntities(t, fresh[i], initial, true)) assignPlaceholder(state, e.type, e.value);
      });
    }

    // Pass 2: rewrite every message with the complete set of known values.
    const matchers = knownValueMatchers(state);
    const seenGeneric = new Map();
    const out = messages.map((m, i) => {
      if (!texts[i]) return m && typeof m === "object" ? { ...m } : m;
      const entities = collectEntities(texts[i], fresh[i], matchers, placeholder);
      const content = placeholder ? applyPlaceholders(texts[i], entities, state, counts) : applyGeneric(texts[i], entities, seenGeneric, counts);
      return { ...m, content };
    });
    return { messages: out, map: state, counts };
  }

  return {
    analyze,
    redactMessages,
    restore,
    createStreamRestorer,
    filterResponse,
    isSensitive,
    /** Whether a Presidio URL is configured (not whether it is up). */
    presidioEnabled: Boolean(presidio),
    /** Live check of the configured analyzer; false when none is configured. */
    presidioHealth: () => (presidio ? presidio.health() : Promise.resolve(false)),
  };
}

module.exports = {
  createRedactor,
  restore,
  createStreamRestorer,
  filterResponse,
  isSensitive,
  normalizeValue,
  emptyMap,
  cloneMap,
  LABELS,
  HIGH_RISK_TYPES,
  GENERIC_PHRASES,
};
