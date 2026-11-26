// Shared helpers in src/util.js: the abortable sleep (incl. listener cleanup in long poll loops),
// money conversion, lenient JSON parsing and the AppError shape every module relies on.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getEventListeners } = require("node:events");
const { sleep, usdToMicros, microsToUsd, MICROS_PER_USD, safeJsonParse, AppError, estimateTokens, newId } = require("../src/util");

/** Collect process warnings emitted while `fn` runs (warnings are delivered on a later tick). */
async function warningsDuring(fn) {
  const seen = [];
  const onWarning = (w) => seen.push(w);
  process.on("warning", onWarning);
  try {
    await fn();
    await new Promise((r) => setImmediate(r));
  } finally {
    process.off("warning", onWarning);
  }
  return seen;
}

describe("sleep", () => {
  it("resolves after the delay, with or without a signal", async () => {
    const t0 = Date.now();
    assert.equal(await sleep(20), undefined);
    assert.ok(Date.now() - t0 >= 15, "should wait roughly the requested time");
    const ac = new AbortController();
    assert.equal(await sleep(1, ac.signal), undefined);
  });

  it("rejects with the signal's reason when aborted mid-sleep, without waiting for the timer", async () => {
    const ac = new AbortController();
    const t0 = Date.now();
    const p = sleep(5000, ac.signal);
    setTimeout(() => ac.abort(), 10);
    await assert.rejects(p, { name: "AbortError" });
    assert.ok(Date.now() - t0 < 1000, "abort must not wait for the 5 s timer");

    const custom = new AbortController();
    const reason = new Error("client left");
    const p2 = sleep(5000, custom.signal);
    custom.abort(reason);
    await assert.rejects(p2, (err) => err === reason);
  });

  it("rejects at once when the signal is already aborted", async () => {
    await assert.rejects(sleep(5000, AbortSignal.abort()), { name: "AbortError" });
    const reason = new Error("gone");
    await assert.rejects(sleep(5000, AbortSignal.abort(reason)), (err) => err === reason);
  });

  it("removes its abort listener when the timer fires", async () => {
    const ac = new AbortController();
    await sleep(1, ac.signal);
    assert.equal(getEventListeners(ac.signal, "abort").length, 0);
    // Aborting afterwards is a no-op: no late rejection, no unhandled promise.
    ac.abort();
  });

  it("removes its abort listener when aborted", async () => {
    const ac = new AbortController();
    const p = sleep(5000, ac.signal);
    assert.equal(getEventListeners(ac.signal, "abort").length, 1);
    ac.abort();
    await assert.rejects(p, { name: "AbortError" });
    assert.equal(getEventListeners(ac.signal, "abort").length, 0);
  });

  it("a long poll loop on one signal never triggers MaxListenersExceededWarning", async () => {
    const ac = new AbortController();
    const warnings = await warningsDuring(async () => {
      for (let i = 0; i < 50; i++) await sleep(0, ac.signal);
    });
    assert.equal(getEventListeners(ac.signal, "abort").length, 0);
    assert.deepEqual(
      warnings.filter((w) => w.name === "MaxListenersExceededWarning").map((w) => w.message),
      []
    );
  });
});

describe("money", () => {
  it("usdToMicros rounds to whole micro-dollars", () => {
    assert.equal(MICROS_PER_USD, 1_000_000);
    assert.equal(usdToMicros(1), 1_000_000);
    assert.equal(usdToMicros(1.23), 1_230_000);
    assert.equal(usdToMicros(0.1 + 0.2), 300_000); // float noise is rounded away
    assert.equal(usdToMicros(0.0000004), 0);
    assert.equal(usdToMicros(0.0000005), 1);
    assert.equal(usdToMicros(-2.5), -2_500_000);
    assert.equal(usdToMicros("2.5"), 2_500_000);
    for (const empty of [0, null, undefined, ""]) assert.equal(usdToMicros(empty), 0, String(empty));
    assert.ok(Number.isInteger(usdToMicros(19.999999)));
  });

  it("microsToUsd is the inverse for whole micros", () => {
    assert.equal(microsToUsd(1_230_000), 1.23);
    assert.equal(microsToUsd(1), 0.000001);
    assert.equal(microsToUsd(-500_000), -0.5);
    for (const empty of [0, null, undefined]) assert.equal(microsToUsd(empty), 0, String(empty));
    for (const usd of [0, 0.01, 0.13, 5, 25, 1234.567891]) assert.equal(microsToUsd(usdToMicros(usd)), usd, String(usd));
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON of any type", () => {
    assert.deepEqual(safeJsonParse('{"a":[1,2]}'), { a: [1, 2] });
    assert.deepEqual(safeJsonParse("[]", {}), []);
    assert.equal(safeJsonParse("42"), 42);
    assert.equal(safeJsonParse('"x"'), "x");
    assert.equal(safeJsonParse("false", true), false);
    assert.equal(safeJsonParse("null", "fallback"), null); // valid JSON null is not a failure
  });

  it("returns the fallback (default null) for invalid or empty input", () => {
    assert.equal(safeJsonParse("{oops"), null);
    assert.deepEqual(safeJsonParse("{oops", []), []);
    for (const empty of [null, undefined, ""]) assert.deepEqual(safeJsonParse(empty, { d: 1 }), { d: 1 }, String(empty));
    assert.equal(safeJsonParse(undefined), null);
  });

  it("an explicit undefined fallback still yields null (default parameter): use another sentinel to detect failure", () => {
    assert.equal(safeJsonParse("{oops", undefined), null);
  });
});

describe("AppError", () => {
  it("carries status, code and message, and is a real Error", () => {
    const err = new AppError(409, "private_blocked", "Strict privacy is on.");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof AppError);
    assert.equal(err.status, 409);
    assert.equal(err.code, "private_blocked");
    assert.equal(err.message, "Strict privacy is on.");
    assert.equal(typeof err.stack, "string");
    assert.equal("extra" in err, false);
  });

  it("keeps optional extra details only when given", () => {
    const err = new AppError(502, "upstream_error", "openrouter: rate limited (429)", { upstreamStatus: 429 });
    assert.deepEqual(err.extra, { upstreamStatus: 429 });
  });
});

describe("small helpers", () => {
  it("estimateTokens is ~4 characters per token, rounded up", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens(null), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
  });

  it("newId returns distinct UUID v4 strings", () => {
    const a = newId();
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(a, newId());
  });
});
