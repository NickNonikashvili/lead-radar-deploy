"use strict";
// server.js boot rules added with the billing review: the production PUBLIC_URL check for Stripe,
// releasing every credit hold left by a crashed process, the boot-time catalog repair, and clean
// shutdown of the background timers.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { start, publicUrlProblem } = require("../server");
const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { seedCatalog, getModel } = require("../src/seed/catalog");
const { createCredits } = require("../src/billing/credits");

function captureLogger() {
  const lines = [];
  const push = (...args) => lines.push(args.map(String).join(" "));
  return { lines, error: push, warn: push, log: push, info: push };
}

function tempDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-boot-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "gode.db");
}

const baseEnv = (file) => ({ GODE_MOCK: "1", PORT: "0", DATABASE_PATH: file, GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64") });
const stripeEnv = { STRIPE_SECRET_KEY: "sk_test_boot", STRIPE_WEBHOOK_SECRET: "whsec_boot" };

test("publicUrlProblem: production with Stripe needs a public https PUBLIC_URL", () => {
  const cfg = (env) => loadConfig({ GODE_MOCK: "1", ...env });
  const prod = { NODE_ENV: "production" };
  assert.match(publicUrlProblem(cfg(prod), { stripeEnabled: true }), /PUBLIC_URL must be the site's public https address/);
  for (const url of ["http://gode.example.com", "https://localhost", "https://127.0.0.1:8443", "https://app.localhost"]) {
    assert.match(publicUrlProblem(cfg({ ...prod, PUBLIC_URL: url }), { stripeEnabled: true }), /PUBLIC_URL/, url);
  }
  assert.equal(publicUrlProblem(cfg({ ...prod, PUBLIC_URL: "https://gode.example.com" }), { stripeEnabled: true }), null);
  // Only payments depend on it, and only production is checked.
  assert.equal(publicUrlProblem(cfg(prod), { stripeEnabled: false }), null);
  assert.equal(publicUrlProblem(cfg({}), { stripeEnabled: true }), null);
});

test("start() refuses production Stripe with the localhost PUBLIC_URL default, and boots with a real one", async (t) => {
  const file = tempDb(t);
  const env = { ...baseEnv(file), ...stripeEnv, NODE_ENV: "production", GODE_MOCK: "1" };
  await assert.rejects(start(env, { log: captureLogger() }), /PUBLIC_URL must be the site's public https address when Stripe payments are on \(got http:\/\/localhost:\d+\)/);
  const s = await start({ ...env, PUBLIC_URL: "https://gode.example.com" }, { log: captureLogger() });
  assert.equal(s.deps.stripe.enabled, true);
  await s.close();
});

test("boot releases every credit hold, even a seconds-old one from a crashed process", async (t) => {
  const file = tempDb(t);
  const config = loadConfig({ GODE_MOCK: "1" });
  const db = openDb(file);
  const credits = createCredits(db, config);
  db.prepare("INSERT INTO users (id, email, password_hash, wrapped_dek, created_at) VALUES ('u1', 'u1@example.test', 'x', 'x', ?)").run(Date.now());
  credits.grant("u1", 250_000, "dev_topup");
  credits.reserve("u1", 250_000); // the answer that was running when the process died
  assert.equal(credits.balance("u1"), 0);
  db.close();

  const log = captureLogger();
  const s = await start(baseEnv(file), { log });
  try {
    assert.ok(log.lines.includes("[gode] released 1 stale credit hold(s)"), log.lines.join("\n"));
    assert.equal(s.deps.credits.balance("u1"), 250_000);
    assert.equal(s.deps.db.prepare("SELECT COUNT(*) AS n FROM holds").get().n, 0);
    // The pipeline reports its running holds so the periodic sweep can skip them.
    assert.deepEqual(s.deps.pipeline.activeHoldIds(), []);
  } finally {
    await s.close();
  }
});

test("boot repairs catalog rows whose privacy flags the gateway can't enforce", async (t) => {
  const file = tempDb(t);
  const db = openDb(file);
  seedCatalog(db);
  db.prepare("UPDATE models SET self_hosted = 1 WHERE id = 'openrouter:deepseek/deepseek-v4.1-flash'").run();
  db.close();
  const log = captureLogger();
  const s = await start(baseEnv(file), { log });
  try {
    assert.ok(log.lines.some((l) => l === "[gode] cleared privacy flags the gateway can't enforce on: openrouter:deepseek/deepseek-v4.1-flash"), log.lines.join("\n"));
    assert.equal(getModel(s.deps.db, "openrouter:deepseek/deepseek-v4.1-flash").self_hosted, false);
  } finally {
    await s.close();
  }
});

test("start() runs the weekly learner schedule when LEARN_SCHEDULE=weekly, and not otherwise", async (t) => {
  const on = await start({ ...baseEnv(tempDb(t)), LEARN_SCHEDULE: "weekly" }, { log: captureLogger() });
  try {
    // The handle start() wired up: one due-check stores a 'schedule' run, the next one is not due.
    const ran = on.learner.tick();
    assert.ok(ran && Number.isInteger(ran.id));
    const rows = on.deps.db.prepare("SELECT source, applied FROM learn_runs").all().map((r) => ({ ...r }));
    assert.deepEqual(rows, [{ source: "schedule", applied: 0 }]);
    assert.equal(on.learner.tick(), null);
  } finally {
    await on.close();
  }
  const off = await start(baseEnv(tempDb(t)), { log: captureLogger() });
  try {
    assert.equal(off.learner.tick(), null);
    assert.equal(off.deps.db.prepare("SELECT COUNT(*) AS n FROM learn_runs").get().n, 0);
  } finally {
    await off.close();
  }
});

test("close() stops the background timers: the process can exit", async (t) => {
  const file = tempDb(t);
  const s = await start({ ...baseEnv(file), LEARN_SCHEDULE: "weekly" }, { log: captureLogger() });
  await s.close();
  assert.equal(s.server.listening, false);
  assert.throws(() => s.deps.db.prepare("SELECT 1"), "database closed");
});
