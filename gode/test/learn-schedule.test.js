// Weekly in-process learner (src/router/schedule.js): due-check from stored runs, store-only by
// default, apply only with LEARN_AUTO_APPLY, timers never keep the process alive.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const { openDb } = require("../src/db");
const { loadConfig } = require("../src/config");
const { upsertModel, setRoute, getRoutes } = require("../src/seed/catalog");
const { newId, now } = require("../src/util");
const { listLearnRuns } = require("../src/router/learn");
const { startLearnScheduler, WEEK_MS } = require("../src/router/schedule");

const A = "openrouter:s/a";
const B = "openrouter:s/b";

function db() {
  const d = openDb(":memory:");
  for (const [id, label] of [[A, "A"], [B, "B"]]) {
    upsertModel(d, {
      id, label, vendor: "T", region: "us", gateway: "openrouter", slug: id.slice(11), jobs: ["chat", "code", "action"],
      price_in: 1, price_out: 2, zdr: true, supports_reasoning: false, params: {}, enabled: true,
    });
  }
  setRoute(d, { job: "chat", tier: "quality", model_id: A }, { source: "seed" });
  // B clearly beats A in the quality cell.
  const ins = d.prepare("INSERT INTO requests (id, kind, job, tier, model_id, status, feedback, created_at) VALUES (?, 'auto', 'chat', 'quality', ?, 'ok', ?, ?)");
  for (let i = 0; i < 6; i++) {
    ins.run(newId(), A, -1, now());
    ins.run(newId(), B, 1, now());
  }
  return d;
}

const quiet = { info() {}, warn() {} };
const cfg = (env) => loadConfig({ LEARN_MIN_SAMPLES: "5", ...env });

test("schedule off: nothing runs", () => {
  const d = db();
  const s = startLearnScheduler({ db: d, config: cfg({}), logger: quiet });
  assert.equal(s.tick(), null);
  s.stop();
  assert.equal(listLearnRuns(d).length, 0);
});

test("weekly: stores the run for review, at most once a week, without applying", () => {
  const d = db();
  const lines = [];
  const logger = { info: (l) => lines.push(l), warn: (l) => lines.push(l) };
  let clock = Date.now();
  const s = startLearnScheduler({ db: d, config: cfg({ LEARN_SCHEDULE: "weekly" }), logger, now: () => clock, firstCheckMs: 1e9 });
  const run = s.tick();
  assert.equal(run.proposals.length, 1);
  assert.equal(run.applied, 0);
  const [stored] = listLearnRuns(d);
  assert.equal(stored.source, "schedule");
  assert.equal(stored.days, 28);
  assert.equal(stored.proposals[0].proposed_model_id, B);
  assert.equal(getRoutes(d).find((r) => r.tier === "quality").model_id, A, "LEARN_AUTO_APPLY is off");
  assert.match(lines[0], /^\[learn\] weekly run \d+: 1 proposal, review them on the admin page$/);

  assert.equal(s.tick(), null, "not due again within the week");
  clock += WEEK_MS + 1000;
  assert.ok(s.tick(), "due a week later");
  assert.equal(listLearnRuns(d).length, 2);
  s.stop();
});

test("weekly with LEARN_AUTO_APPLY applies the proposals and records it", () => {
  const d = db();
  const s = startLearnScheduler({ db: d, config: cfg({ LEARN_SCHEDULE: "weekly", LEARN_AUTO_APPLY: "1" }), logger: quiet, firstCheckMs: 1e9 });
  const run = s.tick();
  assert.equal(run.applied, 1);
  assert.equal(getRoutes(d).find((r) => r.tier === "quality").model_id, B);
  assert.equal(listLearnRuns(d)[0].applied, 1);
  s.stop();
});

test("a failing run is logged by error name only and retried later", () => {
  const d = db();
  const lines = [];
  const s = startLearnScheduler({ db: d, config: cfg({ LEARN_SCHEDULE: "weekly" }), logger: { info() {}, warn: (l) => lines.push(l) }, firstCheckMs: 1e9 });
  d.exec("DROP TABLE learn_runs");
  assert.equal(s.tick(), null);
  assert.deepEqual(lines, ["[learn] weekly run failed (Error)"]);
  s.stop();
});

test("the schedule's timers never keep a process alive", () => {
  const script = `
    const { openDb } = require(${JSON.stringify(path.join(__dirname, "..", "src", "db"))});
    const { loadConfig } = require(${JSON.stringify(path.join(__dirname, "..", "src", "config"))});
    const { startLearnScheduler } = require(${JSON.stringify(path.join(__dirname, "..", "src", "router", "schedule"))});
    startLearnScheduler({ db: openDb(":memory:"), config: loadConfig({ LEARN_SCHEDULE: "weekly" }), logger: { info() {}, warn() {} } });
  `;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["-e", script], { timeout: 20_000, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(Date.now() - t0 < 15_000);
});
