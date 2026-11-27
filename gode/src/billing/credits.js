// Prepaid credits: balances, holds and the credit ledger.
//
// Every amount here is integer micro-USD at CUSTOMER prices (what the user pays), except
// estimateApiCostMicros, which estimates what WE pay upstream (priceFor turns that into a customer
// price). Each write runs inside one db.tx and keeps the invariant
//
//   users.balance_micros == SUM(ledger.delta_micros WHERE user_id = ?)
//
// A request first reserves a hold for its FULL estimate (so two concurrent requests cannot both
// spend the same credit, and no request starts that the balance can't pay for), then settles the
// hold against the real charge, capped at the hold, or releases it on error. Balances therefore
// never go below zero through spending. Zero-amount movements write no ledger row: they would only
// add noise to the user's statement, and the invariant holds either way.
const { newId, now, AppError, microsToUsd } = require("../util");
const { textRates } = require("../seed/catalog");

const GRANT_KINDS = new Set(["signup_bonus", "purchase", "dev_topup", "admin_adjust"]);
const LEDGER_KINDS = new Set([...GRANT_KINDS, "hold", "release", "charge"]);

// Used when a model row has no price for what is being estimated. Deliberately ABOVE the most
// expensive seeded model (text $8 / $40 per 1M tokens, media $0.60 per unit): the estimate only
// sizes a hold, and over-holding for a few seconds is harmless while under-holding lets a request
// overspend the balance. Self-hosted models priced 0 are "known and free", not unknown.
const DEFAULT_PRICES = Object.freeze({
  textInUsdPerMTok: 15,
  textOutUsdPerMTok: 75,
  mediaUsdPerUnit: 1,
});
// When the caller gives no output cap, assume a full default-length answer (MAX_OUTPUT_TOKENS default).
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_STALE_HOLD_MS = 15 * 60 * 1000;
const OUT_OF_CREDITS = "You're out of credits. Buy credits to continue.";
const MAX_LEDGER_LIMIT = 500;

/**
 * Round a non-negative amount of micros UP to an integer, ignoring binary floating-point noise:
 * 3000 tokens x $0.1 per 1M is 300.00000000000006 in floating point and must bill 300, not 301.
 */
function ceilMicros(x) {
  const nearest = Math.round(x);
  if (Math.abs(x - nearest) <= 1e-12 * Math.max(1, Math.abs(x))) return nearest;
  return Math.ceil(x);
}

/** Internal amounts come from our own code; a bad one is a bug, so fail loudly (500). */
function requireNonNegative(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
  return value;
}

function requireId(value, name) {
  if (typeof value !== "string" || value === "") throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

/** A price column: a finite non-negative number, or null when the catalog doesn't know it. */
function knownPrice(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function optionalCount(value, name, dflt) {
  if (value === undefined || value === null) return dflt;
  return requireNonNegative(value, name);
}

function isMediaEstimate(model, units) {
  if (model && model.price_unit) return true;
  if (model && (knownPrice(model.price_in) !== null || knownPrice(model.price_out) !== null)) return false;
  return units !== undefined && units !== null;
}

/**
 * @param {ReturnType<import('../db').openDb>} db
 * @param {{ billing: { margin: number } }} config
 * @param {{ logger?: { warn: Function } }} [options]  where capped charges are reported (ids only)
 */
function createCredits(db, config, { logger = console } = {}) {
  const margin = Number(config?.billing?.margin);
  if (!Number.isFinite(margin) || margin < 0) {
    // Fail at boot: a negative or missing margin would sell below cost on every request.
    throw new RangeError("config.billing.margin must be a non-negative number");
  }

  const stmt = {
    balance: db.prepare("SELECT balance_micros FROM users WHERE id = ?"),
    addBalance: db.prepare("UPDATE users SET balance_micros = balance_micros + ? WHERE id = ?"),
    insertLedger: db.prepare(
      "INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)"
    ),
    findPurchase: db.prepare("SELECT 1 AS found FROM ledger WHERE kind = 'purchase' AND ref = ?"),
    insertHold: db.prepare("INSERT INTO holds (id, user_id, amount_micros, created_at) VALUES (?, ?, ?, ?)"),
    getHold: db.prepare("SELECT id, user_id, amount_micros, created_at FROM holds WHERE id = ?"),
    deleteHold: db.prepare("DELETE FROM holds WHERE id = ?"),
    staleHolds: db.prepare("SELECT id, user_id, amount_micros FROM holds WHERE created_at <= ? ORDER BY created_at"),
    heldTotal: db.prepare("SELECT COALESCE(SUM(amount_micros), 0) AS n FROM holds WHERE user_id = ?"),
  };

  function readBalance(userId) {
    const row = stmt.balance.get(requireId(userId, "userId"));
    if (!row) throw new AppError(404, "not_found", "User not found");
    return row.balance_micros;
  }

  /** The only place balances change: one ledger row + the matching balance update. Call inside db.tx. */
  function applyDelta(userId, delta, kind, ref, at) {
    if (delta === 0) return;
    stmt.insertLedger.run(userId, delta, kind, ref === undefined || ref === null ? null : String(ref), at);
    const res = stmt.addBalance.run(delta, userId);
    if (res.changes !== 1) throw new AppError(404, "not_found", "User not found");
  }

  function releaseHoldRow(hold, at) {
    applyDelta(hold.user_id, hold.amount_micros, "release", hold.id, at);
    stmt.deleteHold.run(hold.id);
  }

  function balance(userId) {
    return readBalance(userId);
  }

  function priceFor(apiCostMicros) {
    const api = requireNonNegative(apiCostMicros, "apiCostMicros");
    if (api === 0) return 0;
    return ceilMicros(api * (1 + margin));
  }

  /**
   * Upstream cost estimate in micro-USD (what WE pay), used to size the hold before a request.
   * Text: inputTokens x price_in + maxOutputTokens x price_out, prices in USD per 1M tokens (which is
   * exactly micro-USD per token), at the long-prompt rate of params.pricing when the input is above
   * its threshold. Media: units x price_per_unit (USD per price_unit).
   */
  function estimateApiCostMicros({ model, inputTokens, maxOutputTokens, units } = {}) {
    if (isMediaEstimate(model, units)) {
      const n = optionalCount(units, "units", 1);
      const perUnit = knownPrice(model?.price_per_unit) ?? DEFAULT_PRICES.mediaUsdPerUnit;
      return ceilMicros(n * perUnit * 1_000_000);
    }
    const inTok = optionalCount(inputTokens, "inputTokens", 0);
    const outTok = optionalCount(maxOutputTokens, "maxOutputTokens", DEFAULT_MAX_OUTPUT_TOKENS);
    const rates = textRates(model, inTok);
    const priceIn = rates.in ?? DEFAULT_PRICES.textInUsdPerMTok;
    const priceOut = rates.out ?? DEFAULT_PRICES.textOutUsdPerMTok;
    return ceilMicros(inTok * priceIn + outTok * priceOut);
  }

  /**
   * The largest output cap (0..maxOutputTokens) whose full hold, priceFor(estimate + extra), fits
   * in `balanceMicros`, or -1 when not even the input fits. Lets a low balance still buy a shorter
   * answer instead of an overdraft. Binary search: the hold only grows with the cap.
   */
  function affordableOutputTokens({ model, inputTokens = 0, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS, extraApiMicros = 0, balanceMicros }) {
    const holdFor = (n) => priceFor(estimateApiCostMicros({ model, inputTokens, maxOutputTokens: n }) + extraApiMicros);
    const max = Math.max(0, Math.floor(maxOutputTokens));
    if (holdFor(max) <= balanceMicros) return max;
    if (holdFor(0) > balanceMicros) return -1;
    let lo = 0;
    let hi = max;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (holdFor(mid) <= balanceMicros) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Hold the full estimate. Refused (402) when the balance is empty or smaller than the estimate:
   * callers shrink text requests to what the balance affords first (affordableOutputTokens), and
   * media must be paid in full. `message` replaces the generic refusal text.
   */
  function reserve(userId, estimateChargedMicros, { message } = {}) {
    requireId(userId, "userId");
    const estimate = ceilMicros(requireNonNegative(estimateChargedMicros, "estimateChargedMicros"));
    return db.tx(() => {
      const current = readBalance(userId);
      if (current <= 0) throw new AppError(402, "insufficient_credits", OUT_OF_CREDITS);
      if (current < estimate) {
        throw new AppError(
          402,
          "insufficient_credits",
          message || `This request needs up to $${microsToUsd(estimate)} of credit and your balance is $${microsToUsd(current)}. Buy credits to continue.`
        );
      }
      const holdId = newId();
      const at = now();
      stmt.insertHold.run(holdId, userId, estimate, at);
      applyDelta(userId, -estimate, "hold", holdId, at);
      return { holdId, amount: estimate };
    });
  }

  /**
   * Release the hold and charge for the request, never more than the hold: a real cost above the
   * estimate (provider price drift, a tokenizer denser than chars/4) is absorbed by us, so a balance
   * cannot be pushed below zero. Returns the new balance and what was actually charged.
   */
  function settle(holdId, chargedMicros, ref) {
    requireId(holdId, "holdId");
    const wanted = ceilMicros(requireNonNegative(chargedMicros, "chargedMicros"));
    return db.tx(() => {
      const hold = stmt.getHold.get(holdId);
      // Settling twice would charge twice: refuse loudly instead of guessing.
      if (!hold) throw new AppError(409, "conflict", "Credit hold is already settled or released");
      const charged = Math.min(wanted, hold.amount_micros);
      if (charged < wanted) {
        // Ids only: amounts tied to a person stay out of the logs.
        logger?.warn?.(`[credits] charge for ${String(ref || hold.id).slice(0, 80)} capped at hold ${hold.id}; the overrun is absorbed`);
      }
      const at = now();
      releaseHoldRow(hold, at);
      applyDelta(hold.user_id, -charged, "charge", ref || hold.id, at);
      return { balance: readBalance(hold.user_id), charged };
    });
  }

  /**
   * Full refund of a hold. Idempotent, and a no-op without a hold id: it runs on error/abort paths,
   * where throwing would mask the original error (the pipeline may fail before it reserved anything).
   */
  function release(holdId) {
    if (holdId === undefined || holdId === null) return;
    requireId(holdId, "holdId");
    db.tx(() => {
      const hold = stmt.getHold.get(holdId);
      if (hold) releaseHoldRow(hold, now());
    });
  }

  function grant(userId, micros, kind, ref) {
    requireId(userId, "userId");
    if (!GRANT_KINDS.has(kind)) throw new TypeError(`unknown grant kind: ${kind}`);
    if (!Number.isSafeInteger(micros)) {
      throw new AppError(400, "bad_request", "Credit amount must be a whole number of micro-USD");
    }
    // Only admins may take credit away; every other kind adds credit.
    if (micros < 0 && kind !== "admin_adjust") throw new AppError(400, "bad_request", "Credit amount must be positive");
    if (kind === "purchase") requireId(ref, "purchase ref");
    return db.tx(() => {
      readBalance(userId);
      // BEGIN IMMEDIATE holds the write lock, so this check cannot race; the unique index
      // ledger_purchase_once is the backstop.
      if (kind === "purchase" && stmt.findPurchase.get(ref)) {
        return { balance: readBalance(userId), duplicate: true };
      }
      applyDelta(userId, micros, kind, ref, now());
      return { balance: readBalance(userId), duplicate: false };
    });
  }

  /**
   * Admin credit adjustment (kind 'admin_adjust'). A negative delta takes credit away but never
   * below zero: it is clamped to the current balance. Returns the new balance in micros.
   */
  function adjust(userId, deltaMicros, ref) {
    requireId(userId, "userId");
    if (!Number.isSafeInteger(deltaMicros)) throw new AppError(400, "bad_request", "Credit amount must be a whole number of micro-USD");
    return db.tx(() => {
      const current = readBalance(userId);
      const delta = deltaMicros < 0 ? -Math.min(-deltaMicros, Math.max(0, current)) : deltaMicros;
      applyDelta(userId, delta, "admin_adjust", ref, now());
      return readBalance(userId);
    });
  }

  /** Credit currently on hold for running requests (shown as "pending" on the billing page). */
  function held(userId) {
    return stmt.heldTotal.get(requireId(userId, "userId")).n;
  }

  function ledger(userId, { limit = 50, kinds } = {}) {
    requireId(userId, "userId");
    const n = Math.min(MAX_LEDGER_LIMIT, Math.max(1, Math.floor(Number(limit) || 50)));
    const params = [userId];
    let kindSql = "";
    if (kinds !== undefined) {
      if (!Array.isArray(kinds) || kinds.some((k) => !LEDGER_KINDS.has(k))) {
        throw new TypeError(`kinds must be an array of: ${[...LEDGER_KINDS].join(", ")}`);
      }
      if (kinds.length === 0) return [];
      kindSql = ` AND kind IN (${kinds.map(() => "?").join(", ")})`;
      params.push(...kinds);
    }
    params.push(n);
    return db
      .prepare(
        `SELECT id, kind, delta_micros, ref, created_at FROM ledger WHERE user_id = ?${kindSql}
         ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .all(...params);
  }

  /**
   * Crash safety: a process that died mid-request leaves holds behind. server.js releases every
   * hold at boot (maxAgeMs 0: one process per database, so none belongs to a live request), then
   * sweeps periodically with an age above the longest request. `keep` lists hold ids of requests
   * still running in this process, which are never released by the sweep.
   * @param {number} [maxAgeMs]
   * @param {{ keep?: Iterable<string> }} [opts]
   */
  function releaseStaleHolds(maxAgeMs = DEFAULT_STALE_HOLD_MS, { keep } = {}) {
    requireNonNegative(maxAgeMs, "maxAgeMs");
    const live = new Set(keep || []);
    return db.tx(() => {
      const at = now();
      const stale = stmt.staleHolds.all(at - maxAgeMs).filter((h) => !live.has(h.id));
      for (const hold of stale) releaseHoldRow(hold, at);
      return stale.length;
    });
  }

  return {
    balance,
    priceFor,
    estimateApiCostMicros,
    affordableOutputTokens,
    reserve,
    settle,
    release,
    grant,
    adjust,
    held,
    ledger,
    releaseStaleHolds,
  };
}

module.exports = { createCredits, ceilMicros, DEFAULT_PRICES, DEFAULT_MAX_OUTPUT_TOKENS, GRANT_KINDS };
