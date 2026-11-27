// Admin learner endpoints: every run is stored, Apply applies exactly the reviewed run, stats show
// the per-cell numbers the learner compares and the last run.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createTestApp } = require("./helpers/app");

const OPUS = "openrouter:anthropic/claude-opus-5.5";
const HAIKU = "openrouter:anthropic/claude-haiku-5.5";
const SONNET = "openrouter:anthropic/claude-sonnet-5.5";
const GEMINI = "openrouter:google/gemini-4-carbon";
const MISTRAL = "openrouter:mistralai/mistral-large-4-0";

describe("admin learner runs", () => {
  let t;
  let admin;
  let member;
  const route = (job, tier) => t.deps.db.prepare("SELECT * FROM routes WHERE job = ? AND tier = ?").get(job, tier);

  function rate(job, tier, modelId, feedback, n) {
    const ins = t.deps.db.prepare(
      "INSERT INTO requests (id, user_id, kind, job, tier, model_id, status, feedback, created_at) VALUES (?, ?, 'auto', ?, ?, ?, 'ok', ?, ?)"
    );
    for (let i = 0; i < n; i++) ins.run(crypto.randomUUID(), member.id, job, tier, modelId, feedback, Date.now() - 1000);
  }

  before(async () => {
    t = await createTestApp({ ADMIN_EMAILS: "root@example.test" });
    admin = t.client();
    await admin.signup("root@example.test");
    member = await t.client().signup("member@example.test");
  });
  after(() => t.close());

  test("Run stores the proposals; Apply with run_id applies exactly that run, not a fresh computation", async () => {
    // code/quality: users dislike Opus and like Haiku in that column.
    rate("code", "quality", OPUS, -1, 3);
    rate("code", "quality", HAIKU, 1, 3);
    const dry = await admin.json("POST", "/api/admin/learn", { min_samples: 3 });
    assert.equal(dry.status, 200, dry.text);
    assert.equal(dry.body.applied, 0);
    assert.ok(Number.isInteger(dry.body.run_id));
    assert.deepEqual(dry.body.proposals.map((p) => `${p.job}/${p.tier} -> ${p.proposed_model_id}`), [`code/quality -> ${HAIKU}`]);
    assert.equal(route("code", "quality").model_id, OPUS, "a dry run changes nothing");

    // Feedback arrives between Run and Apply that would add a chat/quality change.
    rate("chat", "quality", GEMINI, -1, 3);
    rate("chat", "quality", MISTRAL, 1, 3);
    const applied = await admin.json("POST", "/api/admin/learn", { apply: true, run_id: dry.body.run_id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.body.applied, 1);
    assert.equal(applied.body.run_id, dry.body.run_id);
    assert.equal(route("code", "quality").model_id, HAIKU);
    assert.equal(route("code", "quality").source, "learn");
    assert.equal(route("chat", "quality").model_id, GEMINI, "not reviewed, not applied");

    const runs = (await admin.json("GET", "/api/admin/learn/runs")).body.runs;
    assert.equal(runs[0].id, dry.body.run_id);
    assert.equal(runs[0].source, "admin");
    assert.equal(runs[0].applied, 1);
    assert.equal(runs[0].proposals.length, 1);

    // Applying the same run again is a no-op (the cell no longer holds the reviewed current model).
    assert.equal((await admin.json("POST", "/api/admin/learn", { apply: true, run_id: dry.body.run_id })).body.applied, 0);
  });

  test("Apply with the reviewed proposals themselves; private cells and malformed proposals are refused", async () => {
    const proposals = [{ job: "code", tier: "balanced", current_model_id: SONNET, proposed_model_id: HAIKU, reason: "reviewed" }];
    const r = await admin.json("POST", "/api/admin/learn", { apply: true, proposals });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.applied, 1);
    assert.equal(route("code", "balanced").model_id, HAIKU);
    const history = t.deps.db.prepare("SELECT reason FROM route_history WHERE job = 'code' AND tier = 'balanced' ORDER BY id DESC").get();
    assert.equal(history.reason, "reviewed");

    const bad = [
      [{ apply: true, proposals: [{ ...proposals[0], tier: "private" }] }, /tier must be one of/],
      [{ apply: true, proposals: [{ ...proposals[0], job: "action" }] }, /not a routed job/],
      [{ apply: true, proposals: [{ job: "code", tier: "budget", proposed_model_id: HAIKU }] }, /current_model_id is required/],
      [{ apply: true, proposals: [{ ...proposals[0], sneaky: 1 }] }, /Unknown field/],
      [{ apply: true, proposals: "all" }, /must be an array/],
      [{ proposals }, /only used with apply/],
      [{ run_id: 1 }, /only used with apply/],
      [{ apply: true, run_id: 1, proposals }, /not both/],
      [{ apply: true, run_id: "1" }, /run_id must be a number/],
    ];
    for (const [body, message] of bad) {
      const res = await admin.json("POST", "/api/admin/learn", body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
      assert.match(res.body.error, message);
    }
    assert.equal((await admin.json("POST", "/api/admin/learn", { apply: true, run_id: 999999 })).status, 404);
  });

  test("GET /api/admin/stats shows per-cell stats and the last learner run", async () => {
    const r = await admin.json("GET", "/api/admin/stats");
    assert.equal(r.status, 200);
    const cell = r.body.cells.find((c) => c.job === "chat" && c.tier === "quality" && c.model_id === MISTRAL);
    assert.equal(cell.ratings, 3);
    assert.ok(r.body.last_learn_run && Number.isInteger(r.body.last_learn_run.id));
    assert.ok("auto_pick_kept_pct" in r.body.gate && "free_credit_share_pct" in r.body.gate);
  });

  test("learner endpoints are admin-only", async () => {
    const c = t.client();
    await c.signup("someone@example.test");
    assert.equal((await c.json("GET", "/api/admin/learn/runs")).status, 403);
    assert.equal((await c.json("POST", "/api/admin/learn", { apply: true, run_id: 1 })).status, 403);
  });
});
