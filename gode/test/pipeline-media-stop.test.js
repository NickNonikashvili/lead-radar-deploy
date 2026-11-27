// Stopping a media job (live fal adapter on test/helpers/mock-upstream.js). fal bills a generation
// once it has started, so a Stop after that is charged at the job's estimate (never more than the
// hold) and kept as a "stopped" answer; a Stop while the job was still queued (fal's cancel answers
// 200 OK) is free; a job fal finished anyway is kept and billed like any finished generation.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");
const { historyContent } = require("../src/chat/pipeline");

const PASSWORD = "correct-horse-battery";
const QWEN_IMAGE = "fal:alibaba/qwen-image-3/text-to-image";
const IMAGE_CLASSIFICATION = { job: "image", difficulty: 1, private: false, output: { length: "short", format: "image", aspect: "1:1" }, title: "Fox" };

let seq = 0;
const nextEmail = () => `stopper${++seq}@example.test`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeoutMs = 8000, stepMs = 20 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("waitFor: timed out");
    await sleep(stepMs);
  }
}

describe("stopping a media job", () => {
  let up;
  let t;
  let db;

  before(async () => {
    up = await startMockUpstream();
    t = await createTestApp({ ...up.env, GODE_MOCK: "0", OPENROUTER_API_KEY: "sk-or-test-stop", FAL_KEY: "fal-test-stop", FAL_POLL_INTERVAL_MS: "30" });
    db = t.deps.db;
  });
  after(async () => {
    await t.close();
    await up.close();
  });

  /** Start an image, Stop it when `stopWhen(progress)` says so, and wait for the pipeline to finish. */
  async function stopImage(fal, stopWhen) {
    up.reset();
    up.setScenario({ chat: { content: IMAGE_CLASSIFICATION }, fal });
    const c = t.client();
    const user = await c.signup(nextEmail(), PASSWORD);
    const ac = new AbortController();
    let route = null;
    await c.sse("/api/chat", { text: "Draw a red fox in the snow" }, {
      signal: ac.signal,
      onEvent: (e) => {
        if (e.event === "route") route = e.data;
        if (e.event === "progress" && stopWhen(e.data)) ac.abort();
      },
    });
    assert.ok(route, "the job was routed");
    assert.equal(route.model.id, QWEN_IMAGE);
    const row = await waitFor(() => db.prepare("SELECT * FROM requests WHERE id = ?").get(route.request_id));
    const ledger = db.prepare("SELECT kind, delta_micros FROM ledger WHERE user_id = ? ORDER BY id").all(user.id);
    const holds = db.prepare("SELECT COUNT(*) AS n FROM holds WHERE user_id = ?").get(user.id).n;
    const balance = db.prepare("SELECT balance_micros FROM users WHERE id = ?").get(user.id).balance_micros;
    const sum = db.prepare("SELECT SUM(delta_micros) AS s FROM ledger WHERE user_id = ?").get(user.id).s;
    assert.equal(balance, sum, "balance == SUM(ledger)");
    assert.equal(holds, 0, "no hold left behind");
    return { c, user, route, row, ledger, falCalls: up.find("/fal/").map((r) => `${r.method} ${r.path.split("/").pop()}`) };
  }

  test("Stop after fal reported the job running: charged at its estimate, kept as a stopped answer", async () => {
    const r = await stopImage({ polls: 40 }, (p) => p.status === "running");
    assert.ok(r.falCalls.includes("PUT cancel"), r.falCalls.join(","));
    const hold = r.ledger.find((l) => l.kind === "hold");
    const charge = r.ledger.find((l) => l.kind === "charge");
    assert.ok(charge, `charged: ${JSON.stringify(r.ledger)}`);
    assert.equal(-charge.delta_micros, -hold.delta_micros, "the job's estimate, exactly the hold");
    assert.equal(r.row.status, "stopped");
    assert.equal(r.row.error_code, null);
    assert.equal(r.row.charged_micros, -charge.delta_micros);
    assert.equal(r.row.charged_micros, t.deps.credits.priceFor(r.row.api_cost_micros), "api cost recorded at the estimate");

    // The thread shows it as a stopped answer with its cost, not as "No answer".
    const conv = await r.c.json("GET", `/api/conversations/${r.route.conversation_id}`);
    const [question, answer] = conv.body.messages;
    assert.equal(question.answered, true);
    assert.equal(answer.id, r.route.message_id);
    assert.equal(answer.stopped, true);
    assert.deepEqual(answer.media, []);
    assert.equal(answer.request.status, "stopped");
    assert.ok(answer.request.cost_usd > 0);
    // Repeating it can't drain fal for free: every running stop is paid.
    assert.ok(r.row.charged_micros > 0);
  });

  test("Stop while the job is still queued (cancel 200 OK): free, nothing stored", async () => {
    const r = await stopImage({ mode: "queued" }, (p) => p.status === "queued");
    assert.ok(r.falCalls.includes("PUT cancel"));
    assert.ok(!r.ledger.some((l) => l.kind === "charge"), JSON.stringify(r.ledger));
    assert.equal(r.row.status, "error");
    assert.equal(r.row.error_code, "aborted");
    assert.equal(r.row.charged_micros, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND role = 'assistant'").get(r.user.id).n, 0);
  });

  test("Stop while running and fal's cancel fails: charged (the job ran and fal may bill it)", async () => {
    const r = await stopImage({ polls: 40, cancel: "error" }, (p) => p.status === "running");
    assert.equal(r.row.status, "stopped");
    assert.ok(r.row.charged_micros > 0);
  });

  test("Stop while queued and fal's cancel fails: free (it never ran as far as we know)", async () => {
    const r = await stopImage({ mode: "queued", cancel: "error" }, (p) => p.status === "queued");
    assert.equal(r.row.status, "error");
    assert.equal(r.row.charged_micros, 0);
  });

  test("Stop just as fal finished (ALREADY_COMPLETED): the result is fetched, stored and billed like a finished job", async () => {
    const r = await stopImage({ polls: 40, cancel: "completed" }, (p) => p.status === "running");
    assert.ok(r.falCalls.includes("PUT cancel"));
    assert.equal(r.row.status, "ok");
    assert.ok(r.row.charged_micros > 0);
    assert.equal(r.row.media_units, 1);
    const conv = await r.c.json("GET", `/api/conversations/${r.route.conversation_id}`);
    const answer = conv.body.messages[1];
    assert.equal(answer.media.length, 1, "the paid-for image is kept");
    assert.ok(!answer.stopped);
  });

  test("a stopped empty media answer still reads as an answer in the history sent upstream", () => {
    assert.equal(historyContent({ text: "", media: [], stopped: true }), "[stopped before it was ready]");
    assert.equal(historyContent({ text: "partial", stopped: true }), "partial");
    assert.equal(historyContent({ text: "" }), "");
  });
});
