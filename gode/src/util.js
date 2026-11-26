// Small shared helpers. Keep this file dependency-free.
const crypto = require("crypto");

/** Random UUID v4 string. */
function newId() {
  return crypto.randomUUID();
}

/** Current time in milliseconds since epoch. One place so tests can reason about it. */
function now() {
  return Date.now();
}

// Money is stored as integer micro-dollars (1 USD = 1_000_000 micros) to avoid float drift.
const MICROS_PER_USD = 1_000_000;

function usdToMicros(usd) {
  return Math.round(Number(usd || 0) * MICROS_PER_USD);
}

function microsToUsd(micros) {
  return Number(micros || 0) / MICROS_PER_USD;
}

/**
 * Error with an HTTP status and a stable machine-readable code. Route handlers turn these into
 * `{ error, code }` JSON (or an SSE `error` event) without leaking internals.
 */
class AppError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    if (extra) this.extra = extra;
  }
}

/** Express helper: wrap an async handler so rejections reach the error middleware. */
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function safeJsonParse(s, fallback = null) {
  if (s === null || s === undefined || s === "") return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

/** The error an aborted signal stands for: its reason, or a standard AbortError. */
function abortReason(signal) {
  return signal.reason !== undefined ? signal.reason : new DOMException("This operation was aborted", "AbortError");
}

/**
 * Abortable delay. Resolves after `ms`; rejects with the signal's reason when `signal` aborts first.
 * The abort listener is removed as soon as the timer fires, so a long poll loop that sleeps on one
 * signal many times never piles up listeners (MaxListenersExceededWarning).
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

/** Rough token estimate when a provider doesn't report usage: ~4 chars per token. */
function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

module.exports = {
  newId,
  now,
  MICROS_PER_USD,
  usdToMicros,
  microsToUsd,
  AppError,
  ah,
  safeJsonParse,
  sleep,
  estimateTokens,
};
