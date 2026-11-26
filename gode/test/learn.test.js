// Learner: per-model stats from the routing log, route proposals, applying them, gate metrics.
// Synthetic `requests` rows on an in-memory DB with a small fixture catalog (never the real seed).
const test = require("node:test");
const assert = require("node:assert/strict");

const { openDb } = require("../src/db");
const { upsertModel, setRoute, getRoutes } = require("../src/seed/catalog");
const { newId, now } = require("../src/util");
const { computeStats, proposeRoutes, applyProposals, gateMetrics, laplaceScore, resolveSince } = require("../src/router/learn");

const DAY = 24 * 60 * 60 * 1000;
const TEXT = ["chat", "code", "action"];

function model(id, over = {}) {
  const i = id.indexOf(":");
  return {
    id, label: over.label || id.slice(i + 1), vendor: "Test", region: "us", gateway: id.slice(0, i), slug: id.slice(i + 1),
    jobs: TEXT, price_in: 1, price_out: 2, price_unit: null, price_per_unit: null, zdr: true, retention_note: null,
    open_weights: false, self_hosted: false, supports_reasoning: true, context_length: 1000, params: {}, enabled: true,
    ...over,
  };
}

const A = "openrouter:l/a"; // quality (current)
const B = "openrouter:l/b"; // balanced (current)
const C = "openrouter:l/c"; // budget (current)
const D = "openrouter:l/d"; // cheap alternate
const S = "selfhosted:l/s"; // private
const X = "openrouter:l/x"; // disabled alternate

function fixtureDb() {
  const db = openDb(":memory:");
  upsertModel(db, model(A, { label: "Model A", price_in: 4, price_out: 20 }));
  upsertModel(db, model(B, { label: "Model B", price_in: 1, price_out: 3 }));
  upsertModel(db, model(C, { label: "Model C", price_in: 0.1, price_out: 0.3 }));
  upsertModel(db, model(D, { label: "Model D", price_in: 0.05, price_out: 0.2 }));
  upsertModel(db, model(S, { label: "Model S", region: "self", self_hosted: true, price_in: 0.2, price_out: 0.6 }));
  upsertModel(db, model(X, { label: "Model X", enabled: false }));
  setRoute(db, { job: "chat", tier: "quality", model_id: A }, { source: "seed" });
  setRoute(db, { job: "chat", tier: "balanced", model_id: B }, { source: "seed" });
  setRoute(db, { job: "chat", tier: "budget", model_id: C, effort_override: "low" }, { source: "seed" });
  setRoute(db, { job: "chat", tier: "private", model_id: S }, { source: "seed" });
  return db;
}

function addUser(db, { id = newId(), autoPick = 1 } = {}) {
  db.prepare(
    "INSERT INTO users (id, email, password_hash, wrapped_dek, auto_pick, created_at) VALUES (?, ?, 'x', 'x', ?, ?)"
  ).run(id, `${id}@example.test`, autoPick, now());
  return id;
}

function addRequest(db, r) {
  const row = {
    id: newId(), user_id: null, kind: "auto", job: "chat", model_id: A, status: "ok", feedback: null,
    regenerated: 0, overridden: 0, api: 0, charged: 0, latency: null, created_at: now(), ...r,
  };
  db.prepare(
    `INSERT INTO requests (id, user_id, kind, job, model_id, status, feedback, regenerated, overridden,
       api_cost_micros, charged_micros, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.user_id, row.kind, row.job, row.model_id, row.status, row.feedback, row.regenerated, row.overridden, row.api, row.charged, row.latency, row.created_at);
}

/** n requests for one model: the first `up` thumbs-up, the next `down` thumbs-down, the rest neutral. */
function addMany(db, { model_id, job = "chat", n, up = 0, down = 0, regenerated = 0, overridden = 0, api = 1000, latency = 500, ...rest }) {
  for (let i = 0; i < n; i++) {
    addRequest(db, {
      model_id, job, api, latency,
      feedback: i < up ? 1 : i < up + down ? -1 : null,
      regenerated: i < regenerated ? 1 : 0,
      overridden: i < overridden ? 1 : 0,
      ...rest,
    });
  }
}

/** The scenario from the design: B beats A on satisfaction, D is as good as C and cheaper. */
function scenarioDb() {
  const db = fixtureDb();
  addMany(db, { model_id: A, n: 10, up: 4, down: 4, api: 20000 }); // 5/10  = 0.5
  addMany(db, { model_id: B, n: 10, up: 8, api: 4000 }); //           9/10  = 0.9
  addMany(db, { model_id: C, n: 10, up: 5, down: 3, api: 500 }); //   6/10  = 0.6
  addMany(db, { model_id: D, n: 10, up: 5, down: 3, api: 200 }); //   6/10  = 0.6
  addMany(db, { model_id: S, n: 10, up: 2, down: 2, api: 300 }); //   3/6   = 0.5
  addMany(db, { model_id: X, n: 10, up: 10, api: 100 }); //           disabled: never proposed
  return db;
}

test("laplaceScore is (up + 1) / (signals + 2)", () => {
  assert.equal(laplaceScore({ up: 0, down: 0, regenerated: 0, overridden: 0 }), 0.5);
  assert.equal(laplaceScore({ up: 6, down: 2, regenerated: 1, overridden: 0 }), 7 / 11);
});

test("computeStats aggregates ok requests in the window per job and model", () => {
  const db = fixtureDb();
  addMany(db, { model_id: A, n: 10, up: 6, down: 2, regenerated: 1, overridden: 1, api: 1500, latency: 400 });
  addRequest(db, { model_id: A, status: "error", feedback: -1 }); // errors don't count
  addRequest(db, { model_id: A, created_at: now() - 60 * DAY, feedback: -1 }); // outside the window
  addRequest(db, { model_id: A, job: "code", feedback: 1, api: 3000 }); // other job, separate row
  addRequest(db, { model_id: B, latency: null }); // latency unknown

  const stats = computeStats(db, { sinceMs: now() - 28 * DAY });
  const a = stats.find((s) => s.job === "chat" && s.model_id === A);
  assert.deepEqual(a, {
    job: "chat", model_id: A, n: 10, up: 6, down: 2, regenerated: 1, overridden: 1,
    avg_cost_micros: 1500, avg_latency_ms: 400, score: 7 / 12,
  });
  assert.equal(stats.find((s) => s.job === "code" && s.model_id === A).n, 1);
  assert.equal(stats.find((s) => s.model_id === B).avg_latency_ms, null);
  assert.equal(stats.length, 3);
  // The default window (28 days) gives the same answer; a lookback in ms is accepted too.
  assert.deepEqual(computeStats(db), stats);
  assert.deepEqual(computeStats(db, { sinceMs: 28 * DAY }), stats);
  assert.equal(computeStats(db, { sinceMs: 0 }).find((s) => s.job === "chat" && s.model_id === A).n, 11, "since 0 = all time");
});

test("resolveSince accepts a timestamp or a lookback and rejects junk", () => {
  const t = now() - 5 * DAY;
  assert.equal(resolveSince(t), t);
  assert.ok(Math.abs(resolveSince(7 * DAY) - (now() - 7 * DAY)) < 1000);
  assert.throws(() => resolveSince(-1), TypeError);
  assert.throws(() => resolveSince("soon"), TypeError);
});

test("proposeRoutes: quality = best score, budget = cheapest within 0.02, balanced kept when already best value", () => {
  const db = scenarioDb();
  const proposals = proposeRoutes(db, { minSamples: 5 });
  const byTier = Object.fromEntries(proposals.map((p) => [`${p.job}/${p.tier}`, p]));
  assert.deepEqual(Object.keys(byTier).sort(), ["chat/budget", "chat/quality"]);

  const q = byTier["chat/quality"];
  assert.equal(q.current_model_id, A);
  assert.equal(q.proposed_model_id, B);
  assert.equal(q.current_score, 0.5);
  assert.equal(q.proposed_score, 0.9);
  assert.equal(q.current_n, 10);
  assert.equal(q.proposed_n, 10);
  assert.match(q.reason, /best satisfaction/);
  assert.match(q.reason, /Model B 0\.90 \(n=10/);
  assert.match(q.reason, /Model A 0\.50 \(n=10/);

  const b = byTier["chat/budget"];
  assert.equal(b.current_model_id, C);
  assert.equal(b.proposed_model_id, D);
  assert.match(b.reason, /cheapest within 0\.02/);

  assert.ok(!proposals.some((p) => p.tier === "private"), "private tier is never touched");
  assert.ok(!proposals.some((p) => p.proposed_model_id === X), "disabled models are never proposed");
});

test("proposeRoutes: budget does not move to a cheaper model that is clearly less liked", () => {
  const db = fixtureDb();
  addMany(db, { model_id: C, n: 10, up: 6, down: 2, api: 500 }); // 7/12 = 0.583
  addMany(db, { model_id: D, n: 10, up: 3, down: 5, api: 200 }); // 4/12 = 0.333
  const proposals = proposeRoutes(db, { minSamples: 5 });
  assert.ok(!proposals.some((p) => p.tier === "budget"));
});

test("proposeRoutes: balanced maximises score - 0.15 x normalised cost", () => {
  const db = fixtureDb();
  addMany(db, { model_id: A, n: 10, up: 9, api: 10000 }); // 10/11 = 0.909, cost 1.0 -> 0.759
  addMany(db, { model_id: B, n: 10, up: 5, down: 5, api: 5000 }); // 0.5, cost 0.5 -> 0.425
  addMany(db, { model_id: D, n: 10, up: 8, down: 1, api: 1000 }); // 9/11 = 0.818, cost 0.1 -> 0.803
  const balanced = proposeRoutes(db, { minSamples: 5 }).find((p) => p.tier === "balanced");
  assert.equal(balanced.proposed_model_id, D);
  assert.match(balanced.reason, /best satisfaction for the cost/);
});

test("proposeRoutes: minSamples on both sides, unless the current pick has no data", () => {
  const db = fixtureDb();
  addMany(db, { model_id: A, n: 3, down: 3 }); // current quality: some data but too little -> wait
  addMany(db, { model_id: B, n: 10, up: 10 });
  addMany(db, { model_id: D, n: 4, up: 4 }); // too few samples to be proposed anywhere
  const proposals = proposeRoutes(db, { minSamples: 5 });
  assert.ok(!proposals.some((p) => p.tier === "quality"), "current pick has 0 < n < minSamples");
  assert.ok(!proposals.some((p) => p.proposed_model_id === D));

  // Current budget pick C has no data at all: proposals are allowed, compared with the 0.5 prior,
  // but never towards a model the catalog says is dearer.
  const budget = proposals.find((p) => p.tier === "budget");
  assert.equal(budget, undefined, "B is dearer than C in the catalog");
  const db2 = fixtureDb();
  addMany(db2, { model_id: D, n: 10, up: 6, api: 200 });
  const p2 = proposeRoutes(db2, { minSamples: 5 }).find((p) => p.tier === "budget");
  assert.equal(p2.proposed_model_id, D);
  assert.equal(p2.current_score, 0.5);
  assert.equal(p2.current_n, 0);
  assert.match(p2.reason, /Model C \(no data\)/);
});

test("proposeRoutes folds action requests into chat (phase 1 routes action as chat)", () => {
  const db = fixtureDb();
  setRoute(db, { job: "action", tier: "quality", model_id: A }, { source: "seed" });
  addMany(db, { model_id: A, n: 6, down: 6 });
  addMany(db, { model_id: B, job: "action", n: 3, up: 3 });
  addMany(db, { model_id: B, job: "chat", n: 3, up: 3 });
  const proposals = proposeRoutes(db, { minSamples: 5 });
  const q = proposals.find((p) => p.job === "chat" && p.tier === "quality");
  assert.equal(q.proposed_model_id, B);
  assert.equal(q.proposed_n, 6);
  assert.ok(!proposals.some((p) => p.job === "action"), "unused action cells are left alone");
});

test("applyProposals writes routes + history with scores and n, keeps effort overrides, skips stale ones", () => {
  const db = scenarioDb();
  const proposals = proposeRoutes(db, { minSamples: 5 });
  assert.equal(applyProposals(db, proposals), 2);

  const routes = Object.fromEntries(getRoutes(db).map((r) => [`${r.job}/${r.tier}`, r]));
  assert.equal(routes["chat/quality"].model_id, B);
  assert.equal(routes["chat/quality"].source, "learn");
  assert.equal(routes["chat/budget"].model_id, D);
  assert.equal(routes["chat/budget"].effort_override, "low", "cell effort override is kept");
  assert.equal(routes["chat/private"].model_id, S);

  const history = db.prepare("SELECT * FROM route_history WHERE source = 'learn' ORDER BY id").all();
  assert.equal(history.length, 2);
  assert.equal(history[0].old_model_id, A);
  assert.equal(history[0].new_model_id, B);
  assert.match(history[0].reason, /0\.90 \(n=10/);
  assert.match(history[0].reason, /0\.50 \(n=10/);

  // Re-applying the same proposals changes nothing (the cells no longer hold current_model_id).
  assert.equal(applyProposals(db, proposals), 0);
  // An admin changed the cell after the proposal was made: skipped, not clobbered.
  setRoute(db, { job: "chat", tier: "balanced", model_id: A }, { source: "admin" });
  assert.equal(applyProposals(db, [{ job: "chat", tier: "balanced", current_model_id: B, proposed_model_id: D, reason: "x" }]), 0);
  assert.equal(getRoutes(db).find((r) => r.tier === "balanced").model_id, A);
  // Private cells and disabled/unknown models are never written.
  assert.equal(applyProposals(db, [{ job: "chat", tier: "private", current_model_id: S, proposed_model_id: D }]), 0);
  assert.equal(applyProposals(db, [{ job: "chat", tier: "balanced", current_model_id: A, proposed_model_id: X }]), 0);
  assert.equal(applyProposals(db, [{ job: "chat", tier: "balanced", current_model_id: A, proposed_model_id: "openrouter:gone" }]), 0);
  // Custom source is recorded.
  assert.equal(applyProposals(db, [{ job: "chat", tier: "balanced", current_model_id: A, proposed_model_id: C, reason: "manual" }], { source: "admin" }), 1);
  assert.equal(getRoutes(db).find((r) => r.tier === "balanced").source, "admin");
  // Malformed input is a programming error.
  assert.throws(() => applyProposals(db, null), TypeError);
  assert.throws(() => applyProposals(db, [{ job: "chat" }]), TypeError);
});

test("gateMetrics: auto-pick share of active users, override rate, margin, thumbs-up rate", () => {
  const db = fixtureDb();
  const u1 = addUser(db, { autoPick: 1 });
  const u2 = addUser(db, { autoPick: 0 });
  addUser(db, { autoPick: 1 }); // signed up, never chatted: not an active user
  const u4 = addUser(db, { autoPick: 1 });
  addRequest(db, { user_id: u4, created_at: now() - 90 * DAY }); // active only long ago

  for (let i = 0; i < 4; i++) addRequest(db, { user_id: u1, kind: "auto", api: 1000, charged: 1300, feedback: i < 3 ? 1 : null });
  addRequest(db, { user_id: u1, kind: "switch", api: 2000, charged: 2600, feedback: -1 });
  addRequest(db, { user_id: u2, kind: "manual", api: 500, charged: 650 });
  addRequest(db, { user_id: u2, kind: "manual", status: "error", api: 0, charged: 0 });

  const g = gateMetrics(db, { sinceMs: now() - 28 * DAY });
  assert.equal(g.users, 2);
  assert.equal(g.total_users, 4);
  assert.equal(g.auto_pick_on_pct, 50);
  assert.equal(g.override_rate, 0.25);
  assert.equal(g.requests, 7);
  assert.equal(g.api_cost_usd, 0.0065);
  assert.equal(g.charged_usd, 0.00845);
  assert.equal(g.gross_margin_pct, 23.1); // (8450 - 6500) / 8450
  assert.equal(g.thumbs_up_rate, 0.75);
  assert.equal(g.credits_cover_api_costs, true);
});

test("gateMetrics on an empty window reports nulls, not fake zeros", () => {
  const db = fixtureDb();
  addUser(db);
  const g = gateMetrics(db, {});
  assert.equal(g.users, 0);
  assert.equal(g.total_users, 1);
  assert.equal(g.requests, 0);
  assert.equal(g.auto_pick_on_pct, null);
  assert.equal(g.override_rate, null);
  assert.equal(g.gross_margin_pct, null);
  assert.equal(g.thumbs_up_rate, null);
  assert.equal(g.credits_cover_api_costs, null);
  assert.equal(g.api_cost_usd, 0);
});

test("gateMetrics flags a negative margin", () => {
  const db = fixtureDb();
  const u = addUser(db);
  addRequest(db, { user_id: u, api: 2000, charged: 1000 });
  const g = gateMetrics(db, {});
  assert.equal(g.gross_margin_pct, -100);
  assert.equal(g.credits_cover_api_costs, false);
});
