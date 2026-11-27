// Gate metrics and deleted accounts: "delete everything" removes the requests rows but keeps the
// purchases (unlinked) in the ledger. The requests' per-day totals go to usage_archive first, so the
// API cost they caused does not vanish from the gate while the purchases still count.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { createKeyring } = require("../src/crypto");
const { createCredits } = require("../src/billing/credits");
const { createAuth } = require("../src/auth");
const { gateMetrics } = require("../src/router/learn");
const { newId, now } = require("../src/util");

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = "correct-horse-battery";

function setup() {
  const config = loadConfig({ GODE_MOCK: "1", SIGNUP_CREDIT_USD: "0" });
  const db = openDb(":memory:");
  const keyring = createKeyring(crypto.randomBytes(32));
  const credits = createCredits(db, config, { logger: { warn() {} } });
  const auth = createAuth({ db, config, keyring, credits });
  return { db, auth, credits };
}

function addRequest(db, userId, { kind = "auto", api, charged, status = "ok", feedback = null, at = now() }) {
  db.prepare(
    `INSERT INTO requests (id, user_id, kind, job, tier, model_id, api_cost_micros, charged_micros, status, feedback, created_at)
     VALUES (?, ?, ?, 'chat', 'budget', 'openrouter:deepseek/deepseek-v4.1-flash', ?, ?, ?, ?, ?)`
  ).run(newId(), userId, kind, api, charged, status, feedback, at);
}

test("deleting an account keeps its API cost and charges in the gate, next to its purchases", async () => {
  const { db, auth, credits } = setup();
  const gone = await auth.signup({ email: "gone@example.test", password: PASSWORD });
  const stays = await auth.signup({ email: "stays@example.test", password: PASSWORD });
  credits.grant(gone.id, 5_000_000, "purchase", "cs_gone");
  addRequest(db, gone.id, { api: 4_000_000, charged: 5_200_000, feedback: 1 });
  addRequest(db, gone.id, { api: 1_000_000, charged: 0, status: "error", at: now() - 2 * DAY });
  addRequest(db, gone.id, { kind: "switch", api: 500_000, charged: 650_000, at: now() - 2 * DAY });
  addRequest(db, stays.id, { kind: "manual", api: 100_000, charged: 130_000 });

  const before = gateMetrics(db, { sinceMs: 28 * DAY });
  auth.deleteEverything(gone.id);
  const after = gateMetrics(db, { sinceMs: 28 * DAY });

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM requests WHERE user_id = ?").get(gone.id).n, 0, "the rows are gone");
  for (const k of ["requests", "api_cost_usd", "failed_api_cost_usd", "charged_usd", "gross_margin_pct", "purchases_usd", "cash_covers_api_costs", "credits_cover_api_costs", "override_rate", "thumbs_up_rate"]) {
    assert.deepEqual(after[k], before[k], k);
  }
  assert.equal(after.api_cost_usd, 5.6);
  assert.equal(after.purchases_usd, 5);
  assert.equal(after.cash_covers_api_costs, false, "5.00 of purchases do not cover 5.60 of API cost");
  assert.equal(after.deleted_account_requests, 3);
  assert.equal(before.deleted_account_requests, 0);

  // Only counts and amounts are kept: no user, conversation or model.
  const cols = db.prepare("PRAGMA table_info(usage_archive)").all().map((c) => c.name);
  assert.deepEqual(cols.sort(), ["api_micros", "auto", "charged_micros", "day", "down", "failed_api_micros", "manual", "requests", "switches", "up"].sort());
  // Two UTC days of requests -> two rows; a second deletion on the same day adds to them.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM usage_archive").get().n, 2);
  const third = await auth.signup({ email: "third@example.test", password: PASSWORD });
  addRequest(db, third.id, { api: 10, charged: 13 });
  auth.deleteEverything(third.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM usage_archive").get().n, 2);
  assert.equal(gateMetrics(db, { sinceMs: 28 * DAY }).deleted_account_requests, 4);
  // Outside the window it does not count.
  assert.equal(gateMetrics(db, { sinceMs: now() + DAY }).requests, 0);
});

test("credits_cover_api_costs counts charges paid from free credit; cash_covers_api_costs does not", async () => {
  const { db, auth, credits } = setup();
  const u = await auth.signup({ email: "free@example.test", password: PASSWORD });
  credits.grant(u.id, 250_000, "signup_bonus", "signup");
  addRequest(db, u.id, { api: 100_000, charged: 130_000 });
  const g = gateMetrics(db, {});
  assert.equal(g.purchases_usd, 0);
  assert.equal(g.credits_cover_api_costs, true, "charges (incl. free credit) cover API cost");
  assert.equal(g.cash_covers_api_costs, false, "no real money came in");
});
