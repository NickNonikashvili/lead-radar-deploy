// Billing: credits ledger (holds, settle, grants, invariant) and Stripe Checkout + webhooks.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { createCredits, ceilMicros, DEFAULT_PRICES, DEFAULT_MAX_OUTPUT_TOKENS } = require("../src/billing/credits");
const { createStripe, parseSignatureHeader, STRIPE_API_VERSION } = require("../src/billing/stripe");

const WEBHOOK_SECRET = "whsec_test_billing_secret";
const SECRET_KEY = "sk_test_billing_0123456789";

// ---- helpers ----

function setup(env = {}) {
  const config = loadConfig({ GODE_MOCK: "1", ...env });
  const db = openDb(":memory:");
  const credits = createCredits(db, config);
  return { config, db, credits };
}

/** Insert a user directly; the opening balance goes through the ledger so the invariant holds. */
function addUser(db, credits, id, balanceMicros = 0) {
  db.prepare(
    "INSERT INTO users (id, email, password_hash, wrapped_dek, created_at) VALUES (?, ?, 'x', 'x', ?)"
  ).run(id, `${id}@example.test`, Date.now());
  if (balanceMicros) credits.grant(id, balanceMicros, "admin_adjust", "test-opening-balance");
}

function assertInvariant(db) {
  const rows = db
    .prepare(
      `SELECT u.id, u.balance_micros AS balance,
              COALESCE((SELECT SUM(delta_micros) FROM ledger l WHERE l.user_id = u.id), 0) AS total
       FROM users u`
    )
    .all();
  for (const r of rows) assert.equal(r.balance, r.total, `ledger invariant broken for ${r.id}`);
}

function holdCount(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM holds").get().n;
}

/** Deterministic PRNG so a failing random sequence can be replayed. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rejectsWith(fn, status, code) {
  assert.throws(fn, (err) => err.status === status && err.code === code);
}

/** Local Stripe stand-in: records requests; `respond` decides the answer per test. */
async function startStripeStub() {
  const requests = [];
  const stub = {
    requests,
    respond: () => ({ status: 200, body: { id: "cs_test_stub", url: "https://checkout.stripe.com/c/pay/cs_test_stub" } }),
  };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const record = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
      requests.push(record);
      const { status, body, raw } = stub.respond(record);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(raw !== undefined ? raw : JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  stub.url = `http://127.0.0.1:${server.address().port}`;
  stub.close = () => new Promise((resolve) => server.close(resolve));
  return stub;
}

function signHeader(payload, { secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000) } = {}) {
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

function captureLog() {
  const lines = [];
  return { lines, log: { warn: (msg) => lines.push(String(msg)) } };
}

let eventSeq = 0;
function sessionEvent({
  type = "checkout.session.completed",
  eventId = `evt_test_${++eventSeq}`,
  sessionId = "cs_test_a",
  userId = "user-alpha",
  amountTotal = 500,
  paymentStatus = "paid",
  currency = "usd",
  metadata,
  extra = {},
} = {}) {
  return {
    id: eventId,
    object: "event",
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        status: "complete",
        payment_status: paymentStatus,
        amount_total: amountTotal,
        currency,
        client_reference_id: userId,
        metadata: metadata || { user_id: userId, credit_micros: String(amountTotal * 10_000) },
        ...extra,
      },
    },
  };
}

function stripeSetup(env = {}, options) {
  const base = setup({ STRIPE_SECRET_KEY: SECRET_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, ...env });
  const captured = captureLog();
  const stripe = createStripe(base.config, base.credits, base.db, options || { log: captured.log });
  return { ...base, stripe, logs: captured.lines };
}

// ---- credits: pricing ----

test("priceFor applies the margin and rounds up to whole micros", () => {
  const { credits } = setup(); // default margin 0.3
  assert.equal(credits.priceFor(0), 0);
  assert.equal(credits.priceFor(1), 2); // 1.3 -> 2
  assert.equal(credits.priceFor(3), 4); // 3.9 -> 4
  assert.equal(credits.priceFor(10), 13);
  assert.equal(credits.priceFor(100), 130); // 130.00000000000003 in floats must not become 131
  assert.equal(credits.priceFor(0.5), 1);
  assert.equal(credits.priceFor(1_000_000), 1_300_000);
  assert.throws(() => credits.priceFor(-1), RangeError);
  assert.throws(() => credits.priceFor(NaN), RangeError);
  assert.throws(() => credits.priceFor("5"), RangeError);

  const flat = setup({ CREDIT_MARGIN: "0" }).credits;
  assert.equal(flat.priceFor(123), 123);
  assert.equal(flat.priceFor(0.2), 1);
  assert.equal(setup({ CREDIT_MARGIN: "1" }).credits.priceFor(7), 14);
});

test("createCredits refuses a negative margin", () => {
  const db = openDb(":memory:");
  assert.throws(() => createCredits(db, { billing: { margin: -0.1 } }), RangeError);
});

test("ceilMicros ignores floating-point noise but rounds real fractions up", () => {
  assert.equal(ceilMicros(300.00000000000006), 300);
  assert.equal(ceilMicros(299.9999999999999), 300);
  assert.equal(ceilMicros(300.4), 301);
  assert.equal(ceilMicros(0), 0);
  assert.equal(ceilMicros(1e9 + 0.5), 1e9 + 1);
});

test("estimateApiCostMicros: text tokens, media units, unknown prices", () => {
  const { credits } = setup();
  const text = { price_in: 2, price_out: 10, price_unit: null, price_per_unit: null };
  // 1000 * $2/1M + 500 * $10/1M = $0.002 + $0.005 = 7000 micros
  assert.equal(credits.estimateApiCostMicros({ model: text, inputTokens: 1000, maxOutputTokens: 500 }), 7000);
  // float noise: 3000 * 0.1 = 300.00000000000006
  const cheap = { price_in: 0.1, price_out: 0.1 };
  assert.equal(credits.estimateApiCostMicros({ model: cheap, inputTokens: 3000, maxOutputTokens: 0 }), 300);
  // fractional micros round up
  assert.equal(credits.estimateApiCostMicros({ model: { price_in: 0.0507, price_out: 0.2028 }, inputTokens: 1, maxOutputTokens: 1 }), 1);
  // missing output cap -> a full default-length answer
  assert.equal(credits.estimateApiCostMicros({ model: text, inputTokens: 0 }), DEFAULT_MAX_OUTPUT_TOKENS * 10);
  // self-hosted price 0 is known and free
  assert.equal(credits.estimateApiCostMicros({ model: { price_in: 0, price_out: 0 }, inputTokens: 5000, maxOutputTokens: 4096 }), 0);

  const image = { price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.04 };
  assert.equal(credits.estimateApiCostMicros({ model: image, units: 2 }), 80_000);
  assert.equal(credits.estimateApiCostMicros({ model: image }), 40_000); // default 1 unit
  const video = { price_unit: "second", price_per_unit: 0.1 };
  assert.equal(credits.estimateApiCostMicros({ model: video, units: 8 }), 800_000);

  // Unknown prices fall back to the deliberately high defaults.
  assert.equal(
    credits.estimateApiCostMicros({ model: { price_in: null, price_out: null }, inputTokens: 1000, maxOutputTokens: 100 }),
    1000 * DEFAULT_PRICES.textInUsdPerMTok + 100 * DEFAULT_PRICES.textOutUsdPerMTok
  );
  assert.equal(
    credits.estimateApiCostMicros({ model: { price_unit: "image", price_per_unit: null }, units: 3 }),
    3 * DEFAULT_PRICES.mediaUsdPerUnit * 1_000_000
  );
  assert.equal(credits.estimateApiCostMicros({ model: null, units: 2 }), 2 * DEFAULT_PRICES.mediaUsdPerUnit * 1_000_000);
  assert.equal(
    credits.estimateApiCostMicros({ inputTokens: 10, maxOutputTokens: 10 }),
    10 * DEFAULT_PRICES.textInUsdPerMTok + 10 * DEFAULT_PRICES.textOutUsdPerMTok
  );
  assert.throws(() => credits.estimateApiCostMicros({ model: text, inputTokens: -1, maxOutputTokens: 1 }), RangeError);
});

// ---- credits: holds ----

test("reserve refuses an empty or negative balance and unknown users", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u-empty", 0);
  rejectsWith(() => credits.reserve("u-empty", 100), 402, "insufficient_credits");
  addUser(db, credits, "u-neg", -50);
  rejectsWith(() => credits.reserve("u-neg", 0), 402, "insufficient_credits");
  rejectsWith(() => credits.reserve("nobody", 100), 404, "not_found");
  assert.throws(() => credits.reserve("u-empty", -1), RangeError);
  assert.equal(holdCount(db), 0);
  assertInvariant(db);
});

test("reserve holds the full estimate and refuses a balance below it", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 30);
  // More than the balance: refused, with the amounts in the message; nothing is held.
  assert.throws(
    () => credits.reserve("u1", 100),
    (err) => err.status === 402 && err.code === "insufficient_credits" && /\$0\.0001 of credit and your balance is \$0\.00003/.test(err.message)
  );
  assert.throws(() => credits.reserve("u1", 100, { message: "Custom." }), (err) => err.message === "Custom.");
  assert.equal(holdCount(db), 0);
  assert.equal(credits.balance("u1"), 30);

  const { holdId, amount } = credits.reserve("u1", 30); // exactly the balance is fine
  assert.equal(amount, 30);
  assert.equal(credits.balance("u1"), 0);
  const hold = db.prepare("SELECT * FROM holds WHERE id = ?").get(holdId);
  assert.equal(hold.amount_micros, 30);
  assert.equal(hold.user_id, "u1");
  const [row] = credits.ledger("u1", { kinds: ["hold"] });
  assert.equal(row.delta_micros, -30);
  assert.equal(row.ref, holdId);
  // nothing left: the next request is refused until a top-up
  rejectsWith(() => credits.reserve("u1", 1), 402, "insufficient_credits");

  addUser(db, credits, "u2", 1000);
  const second = credits.reserve("u2", 250.2); // fractional estimates round up
  assert.equal(second.amount, 251);
  assert.equal(credits.balance("u2"), 749);
  assertInvariant(db);
});

test("concurrent reserves cannot spend the same credit twice, and none starts underfunded", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 100);
  assert.equal(credits.reserve("u1", 80).amount, 80);
  // 20 left: a second 80 hold is refused instead of starting on a capped 20.
  rejectsWith(() => credits.reserve("u1", 80), 402, "insufficient_credits");
  assert.equal(credits.reserve("u1", 20).amount, 20);
  rejectsWith(() => credits.reserve("u1", 1), 402, "insufficient_credits");
  assertInvariant(db);
});

test("affordableOutputTokens: the largest output cap whose full hold fits the balance", () => {
  const { db, credits } = setup();
  const model = { price_in: 8, price_out: 40 }; // micro-USD per token
  const holdFor = (n, extra = 0) => credits.priceFor(credits.estimateApiCostMicros({ model, inputTokens: 100, maxOutputTokens: n }) + extra);
  assert.equal(credits.affordableOutputTokens({ model, inputTokens: 100, maxOutputTokens: 4096, balanceMicros: 1e9 }), 4096);
  const n = credits.affordableOutputTokens({ model, inputTokens: 100, maxOutputTokens: 4096, balanceMicros: 10_000 });
  assert.ok(n > 0 && n < 4096);
  assert.ok(holdFor(n) <= 10_000 && holdFor(n + 1) > 10_000, `exact cap ${n}`);
  const withClassifier = credits.affordableOutputTokens({ model, inputTokens: 100, maxOutputTokens: 4096, extraApiMicros: 500, balanceMicros: 10_000 });
  assert.ok(withClassifier < n && holdFor(withClassifier, 500) <= 10_000);
  // Not even the input fits.
  assert.equal(credits.affordableOutputTokens({ model, inputTokens: 100, maxOutputTokens: 4096, balanceMicros: 100 }), -1);
  assert.equal(credits.affordableOutputTokens({ model, inputTokens: 100, maxOutputTokens: 4096, balanceMicros: -5 }), -1);
  assert.equal(holdCount(db), 0);
});

test("settle refunds the difference, charges, deletes the hold and refuses a second settle", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 1000);
  const { holdId } = credits.reserve("u1", 500);
  assert.equal(credits.balance("u1"), 500);
  const out = credits.settle(holdId, 200, "req-1");
  assert.deepEqual(out, { balance: 800, charged: 200 });
  assert.equal(credits.balance("u1"), 800);
  assert.equal(holdCount(db), 0);
  const rows = credits.ledger("u1").map((r) => [r.kind, r.delta_micros, r.ref]);
  assert.deepEqual(rows, [
    ["charge", -200, "req-1"],
    ["release", 500, holdId],
    ["hold", -500, holdId],
    ["admin_adjust", 1000, "test-opening-balance"],
  ]);
  rejectsWith(() => credits.settle(holdId, 200, "req-1"), 409, "conflict");
  assert.equal(credits.balance("u1"), 800);
  assertInvariant(db);
});

test("settle with zero charge writes no charge row; charge ref defaults to the hold id", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 1000);
  const a = credits.reserve("u1", 100);
  credits.settle(a.holdId, 0, "req-free");
  assert.equal(credits.balance("u1"), 1000);
  assert.equal(credits.ledger("u1", { kinds: ["charge"] }).length, 0);
  const b = credits.reserve("u1", 100);
  credits.settle(b.holdId, 40);
  assert.equal(credits.ledger("u1", { kinds: ["charge"] })[0].ref, b.holdId);
  assert.throws(() => credits.settle(b.holdId, -1), RangeError);
  assertInvariant(db);
});

test("settle never charges more than the hold: the overrun is absorbed and logged by id only", () => {
  const config = loadConfig({ GODE_MOCK: "1" });
  const db = openDb(":memory:");
  const lines = [];
  const credits = createCredits(db, config, { logger: { warn: (l) => lines.push(String(l)) } });
  addUser(db, credits, "u1", 100);
  const { holdId, amount } = credits.reserve("u1", 50);
  assert.equal(amount, 50);
  assert.deepEqual(credits.settle(holdId, 300, "req-big"), { balance: 50, charged: 50 });
  assert.equal(credits.ledger("u1", { kinds: ["charge"] })[0].delta_micros, -50);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[credits\] charge for req-big capped at hold [0-9a-f-]{36}; the overrun is absorbed$/);
  assert.ok(!/300|250|u1/.test(lines[0]), "no amounts or user ids in the log");
  // A charge within the hold logs nothing.
  const second = credits.reserve("u1", 50);
  credits.settle(second.holdId, 10, "req-small");
  assert.equal(lines.length, 1);
  assert.equal(credits.balance("u1"), 40);
  assertInvariant(db);
});

test("adjust: admin credit up or down, never below zero", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 1000);
  assert.equal(credits.adjust("u1", 500, "note-1"), 1500);
  assert.equal(credits.adjust("u1", -2000, "note-2"), 0, "clamped at zero");
  assert.equal(credits.adjust("u1", -10, "note-3"), 0, "nothing to take");
  const rows = credits.ledger("u1", { kinds: ["admin_adjust"] }).map((r) => [r.delta_micros, r.ref]);
  assert.deepEqual(rows, [[-1500, "note-2"], [500, "note-1"], [1000, "test-opening-balance"]]);
  rejectsWith(() => credits.adjust("u1", 1.5, "x"), 400, "bad_request");
  rejectsWith(() => credits.adjust("nobody", 5, "x"), 404, "not_found");
  // Credit on hold is already out of the balance, so it can't be taken twice.
  credits.adjust("u1", 300, "note-4");
  credits.reserve("u1", 200);
  assert.equal(credits.held("u1"), 200);
  assert.equal(credits.adjust("u1", -1000, "note-5"), 0);
  assertInvariant(db);
});

test("release refunds the full hold and is idempotent", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 1000);
  const { holdId } = credits.reserve("u1", 400);
  assert.equal(credits.balance("u1"), 600);
  assert.equal(credits.release(holdId), undefined);
  assert.equal(credits.balance("u1"), 1000);
  assert.equal(holdCount(db), 0);
  credits.release(holdId); // second release: no-op
  credits.release(undefined); // error before reserve: no-op
  credits.release(null);
  assert.equal(credits.balance("u1"), 1000);
  rejectsWith(() => credits.settle(holdId, 10), 409, "conflict"); // released holds can't be settled
  assert.deepEqual(
    credits.ledger("u1").map((r) => r.kind),
    ["release", "hold", "admin_adjust"]
  );
  assertInvariant(db);
});

test("releaseStaleHolds refunds only holds older than the cutoff", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 1000);
  addUser(db, credits, "u2", 1000);
  const old = credits.reserve("u1", 300);
  const fresh = credits.reserve("u2", 200);
  db.prepare("UPDATE holds SET created_at = ? WHERE id = ?").run(Date.now() - 16 * 60 * 1000, old.holdId);
  assert.equal(credits.releaseStaleHolds(), 1);
  assert.equal(credits.balance("u1"), 1000);
  assert.equal(credits.balance("u2"), 800);
  assert.equal(holdCount(db), 1);
  assert.equal(credits.releaseStaleHolds(), 0);
  // the fresh hold still settles normally
  credits.settle(fresh.holdId, 150, "req");
  assert.equal(credits.balance("u2"), 850);
  // a custom age: 0 releases everything outstanding
  credits.reserve("u1", 10);
  assert.equal(credits.releaseStaleHolds(0), 1);
  assert.throws(() => credits.releaseStaleHolds(-5), RangeError);
  // `keep`: holds of requests still running in this process survive the sweep, however old.
  const live = credits.reserve("u1", 20);
  const dead = credits.reserve("u1", 30);
  db.prepare("UPDATE holds SET created_at = ?").run(Date.now() - 60 * 60 * 1000);
  assert.equal(credits.held("u1"), 50);
  assert.equal(credits.releaseStaleHolds(30 * 60 * 1000, { keep: [live.holdId] }), 1);
  assert.equal(db.prepare("SELECT id FROM holds").get().id, live.holdId);
  assert.ok(!db.prepare("SELECT 1 FROM holds WHERE id = ?").get(dead.holdId));
  assert.equal(credits.held("u1"), 20);
  assertInvariant(db);
});

// ---- credits: grants and ledger ----

test("grant: purchase is idempotent per ref; other kinds validate amounts", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1");
  assert.deepEqual(credits.grant("u1", 5_000_000, "purchase", "cs_test_1"), { balance: 5_000_000, duplicate: false });
  assert.deepEqual(credits.grant("u1", 5_000_000, "purchase", "cs_test_1"), { balance: 5_000_000, duplicate: true });
  assert.equal(credits.grant("u1", 10_000_000, "purchase", "cs_test_2").balance, 15_000_000);
  assert.equal(credits.ledger("u1", { kinds: ["purchase"] }).length, 2);

  assert.equal(credits.grant("u1", 250_000, "signup_bonus").balance, 15_250_000);
  assert.equal(credits.grant("u1", 0, "signup_bonus").duplicate, false); // zero bonus: no row
  assert.equal(credits.ledger("u1", { kinds: ["signup_bonus"] }).length, 1);
  // admins may subtract
  assert.equal(credits.grant("u1", -250_000, "admin_adjust", "fix").balance, 15_000_000);

  rejectsWith(() => credits.grant("u1", -1, "dev_topup"), 400, "bad_request");
  rejectsWith(() => credits.grant("u1", 1.5, "dev_topup"), 400, "bad_request");
  rejectsWith(() => credits.grant("nobody", 1, "dev_topup"), 404, "not_found");
  assert.throws(() => credits.grant("u1", 1, "charge"), TypeError);
  assert.throws(() => credits.grant("u1", 1, "purchase"), TypeError); // purchases need a ref
  assert.equal(credits.balance("u1"), 15_000_000);
  assertInvariant(db);
});

test("purchase idempotency survives account deletion (ledger rows keep the ref)", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1");
  addUser(db, credits, "u2");
  credits.grant("u1", 1_000_000, "purchase", "cs_shared");
  db.prepare("UPDATE ledger SET user_id = NULL WHERE user_id = ?").run("u1");
  db.prepare("DELETE FROM users WHERE id = ?").run("u1");
  assert.equal(credits.grant("u2", 1_000_000, "purchase", "cs_shared").duplicate, true);
  assert.equal(credits.balance("u2"), 0);
});

test("ledger lists newest first with limit and kind filter", () => {
  const { db, credits } = setup();
  addUser(db, credits, "u1", 10_000);
  addUser(db, credits, "u2", 10_000);
  for (let i = 0; i < 5; i++) credits.settle(credits.reserve("u1", 100).holdId, 50, `req-${i}`);
  const all = credits.ledger("u1");
  assert.equal(all.length, 16); // opening + 5 x (hold, release, charge)
  assert.deepEqual(Object.keys(all[0]).sort(), ["created_at", "delta_micros", "id", "kind", "ref"]);
  assert.equal(all[0].ref, "req-4");
  assert.equal(all.at(-1).kind, "admin_adjust");
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i - 1].created_at > all[i].created_at || (all[i - 1].created_at === all[i].created_at && all[i - 1].id > all[i].id));
  }
  assert.equal(credits.ledger("u1", { limit: 3 }).length, 3);
  assert.equal(credits.ledger("u1", { limit: 10_000 }).length, 16);
  assert.deepEqual(
    credits.ledger("u1", { kinds: ["charge"] }).map((r) => r.ref),
    ["req-4", "req-3", "req-2", "req-1", "req-0"]
  );
  assert.deepEqual(credits.ledger("u1", { kinds: [] }), []);
  assert.throws(() => credits.ledger("u1", { kinds: ["bogus"] }), TypeError);
  assert.equal(credits.ledger("u2").length, 1); // other users' rows never leak
  assert.deepEqual(credits.ledger("nobody"), []);
});

test("invariant holds across a long random sequence of operations", () => {
  const { db, credits } = setup();
  const rand = mulberry32(0xc0ffee);
  const int = (n) => Math.floor(rand() * n);
  const users = ["ra", "rb", "rc"];
  const expected = {};
  for (const u of users) {
    addUser(db, credits, u, 5_000);
    expected[u] = 5_000;
  }
  let open = []; // { holdId, userId, amount }
  const closed = [];
  const purchaseRefs = [];

  for (let step = 0; step < 800; step++) {
    const u = users[int(users.length)];
    const op = int(7);
    if (op <= 1) {
      const est = int(4_000);
      if (expected[u] <= 0 || est > expected[u]) {
        rejectsWith(() => credits.reserve(u, est), 402, "insufficient_credits");
      } else {
        const r = credits.reserve(u, est);
        assert.equal(r.amount, est);
        expected[u] -= r.amount;
        open.push({ holdId: r.holdId, userId: u, amount: r.amount });
      }
    } else if (op === 2 && open.length) {
      const h = open.splice(int(open.length), 1)[0];
      const charged = int(Math.max(1, h.amount * 2)); // sometimes more than held: capped
      assert.equal(credits.settle(h.holdId, charged, `req-${step}`).charged, Math.min(charged, h.amount));
      expected[h.userId] += h.amount - Math.min(charged, h.amount);
      closed.push(h.holdId);
    } else if (op === 3 && open.length) {
      const h = open.splice(int(open.length), 1)[0];
      credits.release(h.holdId);
      expected[h.userId] += h.amount;
      closed.push(h.holdId);
    } else if (op === 4) {
      // purchases, some re-delivered
      const reuse = purchaseRefs.length && rand() < 0.4;
      const ref = reuse ? purchaseRefs[int(purchaseRefs.length)] : `cs_${step}`;
      const m = 1_000 + int(3_000);
      const out = credits.grant(u, m, "purchase", ref);
      assert.equal(out.duplicate, Boolean(reuse));
      if (!reuse) {
        purchaseRefs.push(ref);
        expected[u] += m;
      }
    } else if (op === 5) {
      const m = int(2_000) - 1_500;
      if (m !== 0) {
        credits.grant(u, m, "admin_adjust", `adj-${step}`);
        expected[u] += m;
      }
    } else if (op === 6 && closed.length) {
      // double settle / double release of finished holds never moves money
      const id = closed[int(closed.length)];
      if (rand() < 0.5) rejectsWith(() => credits.settle(id, 5), 409, "conflict");
      else credits.release(id);
    }
    if (step % 97 === 96) {
      // crash recovery mid-sequence: every open hold is refunded
      assert.equal(credits.releaseStaleHolds(0), open.length);
      for (const h of open) {
        expected[h.userId] += h.amount;
        closed.push(h.holdId);
      }
      open = [];
    }
    for (const x of users) assert.equal(credits.balance(x), expected[x], `step ${step} user ${x}`);
    assertInvariant(db);
  }
  assert.equal(holdCount(db), open.length);
});

// ---- Stripe: checkout ----

test("createCheckout posts the exact form to Stripe and returns url + id", async (t) => {
  const stub = await startStripeStub();
  t.after(() => stub.close());
  const { stripe } = stripeSetup({ STRIPE_API_BASE: stub.url, PUBLIC_URL: "https://gode.example/" });
  assert.equal(stripe.enabled, true);

  const out = await stripe.createCheckout({ user: { id: "user-alpha", email: "a@example.test" }, packUsd: 10 });
  assert.deepEqual(out, { url: "https://checkout.stripe.com/c/pay/cs_test_stub", id: "cs_test_stub" });

  assert.equal(stub.requests.length, 1);
  const req = stub.requests[0];
  assert.equal(req.method, "POST");
  assert.equal(req.url, "/v1/checkout/sessions");
  assert.equal(req.headers.authorization, `Bearer ${SECRET_KEY}`);
  assert.equal(req.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(req.headers["stripe-version"], STRIPE_API_VERSION);
  assert.deepEqual(
    [...new URLSearchParams(req.body)],
    [
      ["mode", "payment"],
      ["line_items[0][price_data][currency]", "usd"],
      ["line_items[0][price_data][product_data][name]", "Gode credits ($10)"],
      ["line_items[0][price_data][unit_amount]", "1000"],
      ["line_items[0][quantity]", "1"],
      ["success_url", "https://gode.example/#/billing?paid=1"],
      ["cancel_url", "https://gode.example/#/billing"],
      ["client_reference_id", "user-alpha"],
      ["metadata[user_id]", "user-alpha"],
      ["metadata[credit_micros]", "10000000"],
      ["metadata[gode]", "credit_pack"],
    ]
  );
  // Standard form encoding: brackets and the hash are percent-encoded on the wire.
  assert.match(req.body, /line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd/);
  assert.match(req.body, /success_url=https%3A%2F%2Fgode\.example%2F%23%2Fbilling%3Fpaid%3D1/);
  // The user's email never goes to Stripe from us.
  assert.ok(!req.body.includes("example.test"));
});

test("createCheckout: fractional packs, string packs, currency from config", async (t) => {
  const stub = await startStripeStub();
  t.after(() => stub.close());
  const { stripe } = stripeSetup({ STRIPE_API_BASE: stub.url, CREDIT_PACKS: "2.5,25", CURRENCY: "EUR" });
  await stripe.createCheckout({ user: { id: "u1" }, packUsd: 2.5 });
  let form = new URLSearchParams(stub.requests[0].body);
  assert.equal(form.get("line_items[0][price_data][product_data][name]"), "Gode credits ($2.50)");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "250");
  assert.equal(form.get("line_items[0][price_data][currency]"), "eur");
  assert.equal(form.get("metadata[credit_micros]"), "2500000");
  await stripe.createCheckout({ user: { id: "u1" }, packUsd: "25" });
  form = new URLSearchParams(stub.requests[1].body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "2500");
});

test("createCheckout rejects unknown packs, missing users and unusable config without calling Stripe", async (t) => {
  const stub = await startStripeStub();
  t.after(() => stub.close());
  const { stripe } = stripeSetup({ STRIPE_API_BASE: stub.url });
  for (const packUsd of [7, 0, -5, "abc", null, undefined, "5abc", 5.0001]) {
    await assert.rejects(stripe.createCheckout({ user: { id: "u1" }, packUsd }), (e) => e.status === 400 && e.code === "bad_request");
  }
  await assert.rejects(stripe.createCheckout({ user: null, packUsd: 5 }), (e) => e.status === 401);
  await assert.rejects(stripe.createCheckout({ user: {}, packUsd: 5 }), (e) => e.status === 401);

  const yen = stripeSetup({ STRIPE_API_BASE: stub.url, CURRENCY: "jpy" }).stripe;
  await assert.rejects(yen.createCheckout({ user: { id: "u1" }, packUsd: 5 }), (e) => e.status === 503 && e.code === "gateway_not_configured");

  const noKeys = createStripe(loadConfig({ STRIPE_API_BASE: stub.url }), null, openDb(":memory:"));
  assert.equal(noKeys.enabled, false);
  await assert.rejects(noKeys.createCheckout({ user: { id: "u1" }, packUsd: 5 }), (e) => e.status === 503 && e.code === "gateway_not_configured");

  // A secret key alone is not enough: we could take payments but never verify the webhook.
  const warned = captureLog();
  const noWebhook = createStripe(loadConfig({ STRIPE_SECRET_KEY: SECRET_KEY, STRIPE_API_BASE: stub.url }), null, openDb(":memory:"), {
    log: warned.log,
  });
  assert.equal(noWebhook.enabled, false);
  assert.equal(warned.lines.length, 1);
  assert.match(warned.lines[0], /STRIPE_WEBHOOK_SECRET/);
  assert.ok(!warned.lines[0].includes(SECRET_KEY));
  await assert.rejects(noWebhook.createCheckout({ user: { id: "u1" }, packUsd: 5 }), (e) => e.code === "gateway_not_configured");

  assert.equal(stub.requests.length, 0);
});

test("createCheckout maps Stripe errors to upstream_error without leaking the key", async (t) => {
  const stub = await startStripeStub();
  t.after(() => stub.close());
  const { stripe } = stripeSetup({ STRIPE_API_BASE: stub.url });
  const call = () => stripe.createCheckout({ user: { id: "u1" }, packUsd: 5 });
  const noKey = (e) => !e.message.includes(SECRET_KEY) && !e.message.includes("sk_test_");

  stub.respond = () => ({
    status: 400,
    body: { error: { type: "invalid_request_error", message: `Invalid currency: xyz (key ${SECRET_KEY})`, param: "currency" } },
  });
  await assert.rejects(call(), (e) => e.status === 502 && e.code === "upstream_error" && /^stripe: Invalid currency: xyz/.test(e.message) && noKey(e));

  stub.respond = () => ({ status: 400, body: { error: { message: "Expired API Key provided: sk_live_abcDEF123" } } });
  await assert.rejects(call(), (e) => e.code === "upstream_error" && !e.message.includes("sk_live_abcDEF123") && e.message.includes("[key]"));

  stub.respond = () => ({ status: 401, body: { error: { type: "invalid_request_error", message: `Invalid API Key provided: ${SECRET_KEY}` } } });
  await assert.rejects(call(), (e) => e.status === 502 && e.message === "stripe: authentication failed (check STRIPE_SECRET_KEY)");

  stub.respond = () => ({ status: 500, raw: "<html>oops</html>" });
  await assert.rejects(call(), (e) => e.code === "upstream_error" && e.message === "stripe: HTTP 500");

  stub.respond = () => ({ status: 200, raw: "not json" });
  await assert.rejects(call(), (e) => e.code === "upstream_error" && e.message === "stripe: invalid response");

  stub.respond = () => ({ status: 200, body: { id: "cs_x" } });
  await assert.rejects(call(), (e) => e.code === "upstream_error" && /no checkout URL/.test(e.message));

  const closed = await startStripeStub();
  await closed.close();
  const offline = stripeSetup({ STRIPE_API_BASE: closed.url }).stripe;
  await assert.rejects(
    offline.createCheckout({ user: { id: "u1" }, packUsd: 5 }),
    (e) => e.status === 502 && e.message === "stripe: unreachable"
  );
});

test("createCheckout works against the shared mock upstream", async (t) => {
  const { startMockUpstream } = require("./helpers/mock-upstream");
  const up = await startMockUpstream();
  t.after(() => up.close());
  const { stripe } = stripeSetup({ ...up.env });
  const out = await stripe.createCheckout({ user: { id: "user-mock" }, packUsd: 5 });
  assert.match(out.id, /^cs_test_/);
  assert.match(out.url, /^https:\/\/checkout\.stripe\.com\//);
  const sent = up.last("/v1/checkout/sessions");
  assert.equal(sent.body["metadata[user_id]"], "user-mock");
  assert.equal(sent.body["line_items[0][price_data][unit_amount]"], "500");
});

// ---- Stripe: webhook verification ----

test("verifyWebhook accepts a valid signature (Buffer or string) and returns the event", () => {
  const { stripe } = stripeSetup();
  const payload = JSON.stringify(sessionEvent({ eventId: "evt_valid" }));
  const header = signHeader(payload);
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), header).id, "evt_valid");
  assert.equal(stripe.verifyWebhook(payload, header).type, "checkout.session.completed");
  // unknown entries, spaces and v0 are ignored
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), `${header.replace(",", ", ")},v0=abc,destination=we_1,secret=whsec_****`).id, "evt_valid");
  // non-ASCII bodies are signed over the raw bytes
  const unicode = JSON.stringify({ id: "evt_u", type: "x", data: { object: { name: "Zoë ✓" } } });
  assert.equal(stripe.verifyWebhook(Buffer.from(unicode, "utf8"), signHeader(unicode)).id, "evt_u");
});

test("verifyWebhook accepts any of multiple v1 signatures (secret rotation)", () => {
  const { stripe } = stripeSetup();
  const payload = JSON.stringify(sessionEvent({ eventId: "evt_roll" }));
  const t = Math.floor(Date.now() / 1000);
  const good = signHeader(payload, { t }).split("v1=")[1];
  const old = signHeader(payload, { t, secret: "whsec_old" }).split("v1=")[1];
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), `t=${t},v1=${old},v1=${good}`).id, "evt_roll");
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), `t=${t},v1=deadbeef,v1=${good},v0=${old}`).id, "evt_roll");
  assert.throws(() => stripe.verifyWebhook(Buffer.from(payload), `t=${t},v1=${old},v0=${good}`), (e) => e.status === 400);
});

test("verifyWebhook rejects bad signatures, tampering and stale timestamps with 400", () => {
  const { stripe } = stripeSetup();
  const payload = JSON.stringify(sessionEvent({ eventId: "evt_bad" }));
  const now = Math.floor(Date.now() / 1000);
  const bad = (body, header) => assert.throws(() => stripe.verifyWebhook(body, header), (e) => e.status === 400 && e.code === "bad_request");

  bad(Buffer.from(payload), signHeader(payload, { secret: "whsec_wrong" }));
  bad(Buffer.from(payload + " "), signHeader(payload)); // body changed after signing
  bad(Buffer.from(payload), signHeader(payload).replace(/t=\d+/, `t=${now - 1}`)); // timestamp swapped
  bad(Buffer.from(payload), signHeader(payload, { t: now - 301 })); // outside 300 s
  bad(Buffer.from(payload), undefined);
  bad(Buffer.from(payload), "");
  bad(Buffer.from(payload), `t=${now}`); // no v1
  bad(Buffer.from(payload), `v1=${"a".repeat(64)}`); // no t
  bad(Buffer.from(payload), signHeader(payload).replace(/t=\d+/, "t=abc"));
  bad(Buffer.from(payload), `t=${now},v1=${"0".repeat(10)}`); // wrong length compares safely
  bad({ id: "evt_parsed" }, signHeader(payload)); // express.json() already ran
  const notJson = "not json";
  bad(Buffer.from(notJson), signHeader(notJson));
  const noType = JSON.stringify({ id: "evt_x" });
  bad(Buffer.from(noType), signHeader(noType));

  // inside the tolerance (and slight clock skew into the future) is fine
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), signHeader(payload, { t: now - 290 })).id, "evt_bad");
  assert.equal(stripe.verifyWebhook(Buffer.from(payload), signHeader(payload, { t: now + 30 })).id, "evt_bad");
});

test("verifyWebhook without a webhook secret is a configuration error", () => {
  const stripe = createStripe(loadConfig({ STRIPE_SECRET_KEY: SECRET_KEY }), null, openDb(":memory:"), { log: { warn() {} } });
  const payload = JSON.stringify(sessionEvent());
  assert.throws(() => stripe.verifyWebhook(Buffer.from(payload), signHeader(payload)), (e) => e.status === 503 && e.code === "gateway_not_configured");
});

test("parseSignatureHeader keeps t and every v1 only", () => {
  assert.deepEqual(parseSignatureHeader("t=12,v1=aa,v0=bb,v1=cc,secret=zz,junk"), { timestamp: 12, signatures: ["aa", "cc"] });
});

// ---- Stripe: event handling ----

test("handleEvent grants a paid checkout once, by event id and by session id", () => {
  const { db, credits, stripe, logs } = stripeSetup();
  addUser(db, credits, "user-alpha");
  const ev = sessionEvent({ eventId: "evt_paid_1", sessionId: "cs_paid_1", amountTotal: 1000 });
  assert.deepEqual(stripe.handleEvent(ev), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 10_000_000);
  const [row] = credits.ledger("user-alpha", { kinds: ["purchase"] });
  assert.equal(row.ref, "cs_paid_1");
  assert.equal(row.delta_micros, 10_000_000);

  // Stripe re-delivers the same event
  assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: true });
  // a different event for the same session (e.g. a late async_payment_succeeded)
  const again = sessionEvent({ type: "checkout.session.async_payment_succeeded", eventId: "evt_paid_2", sessionId: "cs_paid_1", amountTotal: 1000 });
  assert.deepEqual(stripe.handleEvent(again), { handled: false, duplicate: true });
  assert.equal(credits.balance("user-alpha"), 10_000_000);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stripe_events").get().n, 2);
  assert.deepEqual(logs, []);
  assertInvariant(db);
});

test("handleEvent: completed but unpaid waits for async_payment_succeeded", () => {
  const { db, credits, stripe } = stripeSetup();
  addUser(db, credits, "user-alpha");
  const pending = sessionEvent({ eventId: "evt_ach_1", sessionId: "cs_ach", paymentStatus: "unpaid", amountTotal: 2500 });
  assert.deepEqual(stripe.handleEvent(pending), { handled: false, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 0);
  assert.ok(db.prepare("SELECT 1 FROM stripe_events WHERE id = ?").get("evt_ach_1"));

  const succeeded = sessionEvent({ type: "checkout.session.async_payment_succeeded", eventId: "evt_ach_2", sessionId: "cs_ach", amountTotal: 2500 });
  assert.deepEqual(stripe.handleEvent(succeeded), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 25_000_000);
  assert.deepEqual(stripe.handleEvent(succeeded), { handled: false, duplicate: true });
  assert.equal(credits.balance("user-alpha"), 25_000_000);

  // no_payment_required (e.g. a 100% coupon) is not 'paid' either
  const free = sessionEvent({ eventId: "evt_free", sessionId: "cs_free", paymentStatus: "no_payment_required", amountTotal: 0 });
  assert.equal(stripe.handleEvent(free).handled, false);
  assert.equal(credits.balance("user-alpha"), 25_000_000);
  assertInvariant(db);
});

test("handleEvent: deleted account -> event recorded, no grant", () => {
  const { db, credits, stripe, logs } = stripeSetup();
  addUser(db, credits, "user-gone");
  db.prepare("DELETE FROM users WHERE id = ?").run("user-gone");
  const ev = sessionEvent({ eventId: "evt_gone", sessionId: "cs_gone", userId: "user-gone" });
  assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: false });
  assert.ok(db.prepare("SELECT 1 FROM stripe_events WHERE id = ?").get("evt_gone"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE ref = ?").get("cs_gone").n, 0);
  assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: true });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /deleted account/);
  assert.ok(logs.every((l) => !l.includes("user-gone")), "logs must not contain user ids");
});

test("handleEvent refuses a session whose amount paid does not match its credit pack", () => {
  const { db, credits, stripe, logs } = stripeSetup();
  addUser(db, credits, "user-alpha");
  const ev = sessionEvent({
    eventId: "evt_meta",
    sessionId: "cs_meta",
    amountTotal: 500,
    metadata: { user_id: "user-alpha", credit_micros: "25000000" },
  });
  assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /does not match the session's credit pack/);
  assert.ok(logs.every((l) => !l.includes("user-alpha")));
});

test("handleEvent skips sessions it cannot safely credit", () => {
  const { db, credits, stripe, logs } = stripeSetup();
  addUser(db, credits, "user-alpha");
  addUser(db, credits, "user-beta");
  const cases = [
    sessionEvent({ sessionId: "cs_eur", currency: "eur" }), // paid in another currency
    sessionEvent({ sessionId: "cs_null", amountTotal: null }),
    sessionEvent({ sessionId: "cs_nouser", metadata: {}, userId: null }),
    sessionEvent({ sessionId: "cs_mismatch", metadata: { user_id: "user-beta" } }), // client_reference_id = alpha
    sessionEvent({ sessionId: "cs_sub", extra: { mode: "subscription" } }),
    sessionEvent({ type: "checkout.session.async_payment_succeeded", sessionId: "cs_weird", paymentStatus: "unpaid" }),
    // A Payment Link for another product on the same Stripe account: ?client_reference_id=<our user>.
    sessionEvent({ sessionId: "cs_paymentlink", amountTotal: 300, metadata: {} }),
  ];
  for (const ev of cases) assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: false }, ev.data.object.id);
  assert.equal(credits.balance("user-alpha"), 0);
  assert.equal(credits.balance("user-beta"), 0);
  assert.equal(logs.length, 6); // every anomaly logged except the foreign subscription
  assert.ok(logs.some((l) => /no metadata\.user_id/.test(l) && l.includes("cs_paymentlink")));
  assert.ok(logs.every((l) => !l.includes("user-alpha") && !l.includes("user-beta")));

  // Older Adaptive Pricing sessions: the customer's currency, our amount in currency_conversion.
  const converted = sessionEvent({
    sessionId: "cs_conv",
    currency: "jpy",
    amountTotal: 780,
    metadata: { user_id: "user-alpha", credit_micros: "5000000" },
    extra: { currency_conversion: { source_currency: "usd", amount_total: 500, amount_subtotal: 500, fx_rate: "1.56" } },
  });
  assert.deepEqual(stripe.handleEvent(converted), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 5_000_000);

  // only metadata.user_id (no client_reference_id) is enough
  const metaOnly = sessionEvent({ sessionId: "cs_metaonly", userId: "user-beta", extra: { client_reference_id: null } });
  assert.equal(stripe.handleEvent(metaOnly).handled, true);
  assert.equal(credits.balance("user-beta"), 5_000_000);
  assertInvariant(db);
});

test("handleEvent ignores unrelated event types without recording them", () => {
  const { db, stripe } = stripeSetup();
  for (const type of ["payment_intent.succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"]) {
    assert.deepEqual(stripe.handleEvent({ id: `evt_${type}`, type, data: { object: { id: "x" } } }), { handled: false, duplicate: false });
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stripe_events").get().n, 0);
  assert.throws(() => stripe.handleEvent(null), (e) => e.status === 400);
  assert.throws(() => stripe.handleEvent({ id: "evt_1" }), (e) => e.status === 400);
  assert.throws(() => stripe.handleEvent({ id: "evt_2", type: "checkout.session.completed", data: {} }), (e) => e.status === 400);
});

test("handleEvent: a failed grant leaves the event unrecorded so Stripe's retry can apply it", () => {
  const { db, credits, config } = stripeSetup();
  addUser(db, credits, "user-alpha");
  const failing = { grant: () => { throw new Error("disk full"); } };
  const broken = createStripe(config, failing, db, { log: { warn() {} } });
  const ev = sessionEvent({ eventId: "evt_retry", sessionId: "cs_retry" });
  assert.throws(() => broken.handleEvent(ev), /disk full/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stripe_events").get().n, 0);

  const fixed = createStripe(config, credits, db, { log: { warn() {} } });
  assert.deepEqual(fixed.handleEvent(ev), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 5_000_000);
  assertInvariant(db);
});

test("end to end: signed webhook body -> verify -> handle", () => {
  const { db, credits, stripe } = stripeSetup();
  addUser(db, credits, "user-alpha", 1_000);
  const payload = JSON.stringify(sessionEvent({ eventId: "evt_e2e", sessionId: "cs_e2e", amountTotal: 2500 }));
  const event = stripe.verifyWebhook(Buffer.from(payload), signHeader(payload));
  assert.deepEqual(stripe.handleEvent(event), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 25_001_000);
  assertInvariant(db);
});

test("handleEvent credits a pack that was removed from CREDIT_PACKS while its Checkout Session was open", () => {
  // Bought as $50 under CREDIT_PACKS=5,10,25,50; the operator dropped the $50 pack before Stripe
  // delivered the event. The metadata matches what was paid, so it is one of our sessions.
  const { db, credits, stripe, logs } = stripeSetup({ CREDIT_PACKS: "5,10,25" });
  addUser(db, credits, "user-alpha");
  const ev = sessionEvent({ eventId: "evt_removed_pack", sessionId: "cs_removed_pack", amountTotal: 5000, metadata: { user_id: "user-alpha", credit_micros: "50000000" } });
  assert.deepEqual(stripe.handleEvent(ev), { handled: true, duplicate: false });
  assert.equal(credits.balance("user-alpha"), 50_000_000);
  assert.deepEqual(stripe.handleEvent(ev), { handled: false, duplicate: true }, "a resend grants nothing more");
  assert.equal(credits.balance("user-alpha"), 50_000_000);
  assert.equal(logs.length, 0);
});
