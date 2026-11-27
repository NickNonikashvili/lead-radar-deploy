"use strict";
// POST /api/billing/checkout is rate limited per user (each call is a real Stripe API write), and
// the statement reports credit on hold for running answers.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");
const { CHECKOUT_LIMIT } = require("../src/routes/billing");

let up;
let t;
before(async () => {
  up = await startMockUpstream();
  t = await createTestApp({
    STRIPE_SECRET_KEY: "sk_test_checkout_limit",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_limit",
    STRIPE_API_BASE: up.urls.stripe,
  });
});
after(async () => {
  await t?.close();
  await up?.close();
});

test("checkout: at most 10 sessions per user per 15 minutes; other users are unaffected", async () => {
  assert.deepEqual(CHECKOUT_LIMIT, { windowMs: 15 * 60 * 1000, max: 10 });
  const a = t.client();
  await a.signup("limit-a@example.test");
  for (let i = 0; i < CHECKOUT_LIMIT.max; i++) {
    const r = await a.json("POST", "/api/billing/checkout", { pack_usd: 5 });
    assert.equal(r.status, 200, `checkout ${i + 1}`);
  }
  const stripeCalls = up.find("/v1/checkout/sessions").length;
  const limited = await a.json("POST", "/api/billing/checkout", { pack_usd: 5 });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "rate_limited");
  assert.equal(up.find("/v1/checkout/sessions").length, stripeCalls, "no Stripe call once limited");

  const b = t.client();
  await b.signup("limit-b@example.test");
  assert.equal((await b.json("POST", "/api/billing/checkout", { pack_usd: 5 })).status, 200);
});

test("the statement shows credit on hold", async () => {
  const c = t.client();
  const user = await c.signup("held@example.test");
  const empty = await c.json("GET", "/api/billing/ledger");
  assert.equal(empty.body.held_usd, 0);
  t.deps.credits.reserve(user.id, 20_000);
  const r = await c.json("GET", "/api/billing/ledger");
  assert.equal(r.body.held_usd, 0.02);
  assert.equal(r.body.balance_usd, 0.23);
});
