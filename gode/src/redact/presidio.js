"use strict";
// Presidio Analyzer REST client (POST {url}/analyze, GET {url}/health). Transport only: it throws on
// any failure and leaves fallback/logging policy to the redactor. Error messages never contain the
// analysed text or the response body, because both can hold personal data.

const crypto = require("crypto");

// Presidio entity_type -> Gode short label. Anything else (DATE_TIME, NRP, URL, UUID, ...) is dropped.
const PRESIDIO_LABELS = Object.freeze({
  PERSON: "PERSON",
  EMAIL_ADDRESS: "EMAIL",
  PHONE_NUMBER: "PHONE",
  CREDIT_CARD: "CARD",
  IBAN_CODE: "IBAN",
  US_SSN: "SSN",
  // An ITIN is a US tax ID in the SSN format with the same risk; treating it as SSN keeps the
  // label set unchanged while not dropping it.
  US_ITIN: "SSN",
  IP_ADDRESS: "IP",
  LOCATION: "LOCATION",
  US_PASSPORT: "PASSPORT",
  US_DRIVER_LICENSE: "LICENSE",
  US_BANK_NUMBER: "BANK_ACCOUNT",
  CRYPTO: "CRYPTO",
  URL_CREDENTIALS: "SECRET",
});

/** Short label for a Presidio entity type, or null when Gode does not redact that type. */
function labelForPresidioType(entityType) {
  if (typeof entityType !== "string") return null;
  if (Object.hasOwn(PRESIDIO_LABELS, entityType)) return PRESIDIO_LABELS[entityType];
  // Country-specific recognizers (UK_PASSPORT, ES_PASSPORT, UK_DRIVING_LICENCE, ...) when enabled.
  if (/^[A-Z]{2}_PASSPORT$/.test(entityType)) return "PASSPORT";
  if (/^[A-Z]{2}_(?:DRIVER_LICENSE|DRIVING_LICENCE)$/.test(entityType)) return "LICENSE";
  return null;
}

class PresidioError extends Error {
  constructor(message) {
    super(`presidio: ${message}`);
    this.name = "PresidioError";
    this.code = "presidio_unavailable";
  }
}

/**
 * Presidio (Python) reports offsets in Unicode code points; JS strings index UTF-16 code units. Text
 * with emoji or other astral characters would otherwise shift every later span.
 */
function codePointToUtf16Mapper(text) {
  if (!/[\uD800-\uDFFF]/.test(text)) return (i) => i;
  const offsets = [];
  let u = 0;
  for (const ch of text) {
    offsets.push(u);
    u += ch.length;
  }
  offsets.push(u);
  return (i) => (i >= 0 && i < offsets.length ? offsets[i] : -1);
}

const isWhitespace = (ch) => ch !== undefined && /\s/.test(ch);

/** Validate and convert Presidio results into { type, start, end, score } spans (no values). */
function toSpans(results, text, scoreThreshold) {
  if (!Array.isArray(results)) throw new PresidioError("unexpected response shape");
  const toUtf16 = codePointToUtf16Mapper(text);
  const spans = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const type = labelForPresidioType(r.entity_type);
    if (!type) continue;
    const score = Number(r.score);
    if (!Number.isFinite(score) || score < scoreThreshold) continue;
    if (!Number.isInteger(r.start) || !Number.isInteger(r.end)) continue;
    let start = toUtf16(r.start);
    let end = toUtf16(r.end);
    if (start < 0 || end < 0 || end > text.length || end <= start) continue;
    while (start < end && isWhitespace(text[start])) start++;
    while (end > start && isWhitespace(text[end - 1])) end--;
    if (end <= start) continue;
    spans.push({ type, start, end, score });
  }
  return spans;
}

async function requestJson(fetchImpl, url, init, timeoutMs) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new PresidioError(`timed out after ${timeoutMs} ms`);
    }
    throw new PresidioError(`request failed (${err?.cause?.code || err?.code || err?.name || "error"})`);
  }
  if (!res.ok) {
    await res.body?.cancel?.().catch(() => {}); // free the socket; the body is not needed
    throw new PresidioError(`HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new PresidioError("invalid JSON response");
  }
}

/**
 * @param {object} opts
 * @param {string} opts.url              analyzer base URL, e.g. http://localhost:5002
 * @param {string} [opts.language]       ISO-639-1 code sent as `language`
 * @param {number} [opts.scoreThreshold] sent as `score_threshold` and re-applied locally
 * @param {number} [opts.timeoutMs]      per request
 * @param {Function} [opts.fetch]        injectable for tests
 * @param {number} [opts.cacheSize]      LRU of recent analyses keyed by SHA-256 of the text. The
 *   chat pipeline re-redacts the whole history on every turn; without this every turn would resend
 *   every earlier message. Only offsets/types/scores are cached, never the text.
 */
function createPresidioClient({ url, language = "en", scoreThreshold = 0.5, timeoutMs = 1500, fetch: fetchImpl = globalThis.fetch, cacheSize = 256 } = {}) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) throw new TypeError("presidio: url must be an http(s) URL");
  if (typeof fetchImpl !== "function") throw new TypeError("presidio: fetch is not available");
  const base = url.replace(/\/+$/, "");
  const threshold = Number.isFinite(Number(scoreThreshold)) ? Number(scoreThreshold) : 0.5;
  const timeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 1500;
  const cache = new Map();

  function cacheGet(key) {
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key); // refresh LRU position
      cache.set(key, hit);
    }
    return hit;
  }

  function cacheSet(key, spans) {
    cache.set(key, spans);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  }

  // NER time grows with length: a pasted document must not hit the same 1.5 s budget as a question.
  const timeoutFor = (text) => Math.min(timeout + Math.floor(text.length / 1000) * 20, Math.max(timeout, 10_000));

  /** @returns {Promise<{type,start,end,score,value}[]>} */
  async function analyze(text) {
    if (typeof text !== "string") throw new TypeError("presidio: text must be a string");
    if (!text.trim()) return [];
    const key = cacheSize > 0 ? crypto.createHash("sha256").update(`${language}\u0000${text}`).digest("hex") : null;
    let spans = key ? cacheGet(key) : null;
    if (!spans) {
      const results = await requestJson(
        fetchImpl,
        `${base}/analyze`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ text, language, score_threshold: threshold }),
        },
        timeoutFor(text)
      );
      spans = toSpans(results, text, threshold);
      if (key) cacheSet(key, spans);
    }
    return spans.map((s) => ({ ...s, value: text.slice(s.start, s.end) }));
  }

  /** True when GET /health answers 2xx within the timeout. Never throws. */
  async function health() {
    try {
      const res = await fetchImpl(`${base}/health`, { signal: AbortSignal.timeout(timeout) });
      await res.body?.cancel?.().catch(() => {});
      return res.ok;
    } catch {
      return false;
    }
  }

  return { analyze, health, url: base };
}

module.exports = { createPresidioClient, labelForPresidioType, PRESIDIO_LABELS, PresidioError };
