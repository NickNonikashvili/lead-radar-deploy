// The cross-team contracts (C1 to C9 in the wave-3 task) checked end to end over HTTP: the real
// app and pipeline, live gateway adapters against test/helpers/mock-upstream.js. Each test names
// the contract it covers. Unit-level checks of the same rules live with each module's own tests.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");
const { buildInput } = require("../src/providers/fal");
const { getModel } = require("../src/seed/catalog");

const PASSWORD = "correct-horse-battery";
const FAL_IMAGE_URL = "https://v3.fal.media/files/mock/image.png";
const SONNET = "openrouter:anthropic/claude-sonnet-5.5";
const QWEN_IMAGE = "fal:alibaba/qwen-image-3/text-to-image";

let emailSeq = 0;
const nextEmail = (name) => `${name}${++emailSeq}@example.test`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (r) => r.events.map((e) => e.event);
const first = (r, name) => r.events.find((e) => e.event === name)?.data;
const all = (r, name) => r.events.filter((e) => e.event === name).map((e) => e.data);
const requestRow = (db, id) => db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
const count = (db, sql, ...args) => db.prepare(sql).get(...args).n;

async function waitFor(fn, { timeoutMs = 3000, stepMs = 10 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("waitFor: timed out");
    await sleep(stepMs);
  }
}

/** A fake media CDN for the proxy: records what it was asked for. */
function fakeMediaHost(files) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const f = files[String(url)];
    if (!f) return new Response("missing", { status: 404 });
    return new Response(f.body, { status: 200, headers: { "content-type": f.type, "content-length": String(f.body.length) } });
  };
  fn.calls = calls;
  return fn;
}

describe("contract wires over HTTP (live adapters, mock upstream)", () => {
  let up;
  let t;
  let db;
  let admin;
  let alice;
  let bob;
  const media = fakeMediaHost({ [FAL_IMAGE_URL]: { type: "image/png", body: Buffer.from("PNG-BYTES-OF-A-FOX") } });

  before(async () => {
    up = await startMockUpstream();
    t = await createTestApp(
      {
        ...up.env,
        GODE_MOCK: "0",
        OPENROUTER_API_KEY: "sk-or-test-wires",
        FAL_KEY: "fal-test-wires",
        ADMIN_EMAILS: "root@example.test",
      },
      { mediaFetch: media }
    );
    db = t.deps.db;
    admin = t.client();
    await admin.signup("root@example.test", PASSWORD);
    alice = t.client();
    alice.user = await alice.signup(nextEmail("alice"), PASSWORD);
    bob = t.client();
    bob.user = await bob.signup(nextEmail("bob"), PASSWORD);
  });
  after(async () => {
    await t.close();
    await up.close();
  });

  test("C5/C8 media proxy: the live media event and the reloaded message both stream the stored file, owner only", async () => {
    up.reset();
    up.setScenario({ chat: { content: { job: "image", difficulty: 1, private: false, output: { length: "short", format: "image", aspect: "1:1" }, title: "Red fox" } } });
    const r = await alice.sse("/api/chat", { text: "Draw a picture of a red fox in the snow" });
    assert.equal(names(r).at(-1), "done", JSON.stringify(r.events.at(-1)));
    const route = first(r, "route");
    const done = first(r, "done");
    assert.equal(route.model.id, QWEN_IMAGE);

    // Live: the browser gets Gode's link, never the fal CDN URL.
    const proxied = `/api/media/${done.message_id}/0`;
    assert.deepEqual(all(r, "media"), [{ type: "image", url: proxied, mime: "image/png" }]);
    assert.ok(!r.raw.includes("fal.media"), "the fal URL never reaches the browser");

    // The link works for the owner: Gode fetches the stored upstream URL server-side.
    const live = await alice.request("GET", proxied);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await live.arrayBuffer()).toString(), "PNG-BYTES-OF-A-FOX");
    assert.deepEqual(media.calls, [FAL_IMAGE_URL]);

    // Reload: the stored message keeps the upstream URL, the API maps it to the same proxy link.
    const conv = await alice.json("GET", `/api/conversations/${done.conversation_id}`);
    const answer = conv.body.messages.find((m) => m.id === done.message_id);
    assert.equal(answer.media[0].url, proxied);
    const row = db.prepare("SELECT content_enc FROM messages WHERE id = ?").get(done.message_id);
    const stored = t.deps.keyring.decrypt(db.prepare("SELECT wrapped_dek FROM users WHERE id = ?").get(alice.user.id).wrapped_dek, row.content_enc, { json: true });
    assert.equal(stored.media[0].url, FAL_IMAGE_URL);
    const again = await alice.request("GET", answer.media[0].url);
    assert.equal(again.status, 200);
    await again.arrayBuffer();

    // Someone else's media is a 404, and the CDN is not even asked.
    const before = media.calls.length;
    const foreign = await bob.request("GET", proxied);
    assert.equal(foreign.status, 404);
    await foreign.arrayBuffer();
    assert.equal(media.calls.length, before);
  });

  test("C4/C5 the upstream provider is recorded for a stream that fails mid-way and for a stopped one", async () => {
    up.reset();
    up.setScenario("chat_midstream_error");
    const failed = await alice.sse("/api/chat", { text: "Tell me about lighthouses." });
    const err = first(failed, "error");
    assert.equal(err.code, "upstream_error");
    assert.ok(all(failed, "delta").length > 0, "text arrived before the error");
    const row = requestRow(db, err.request_id);
    assert.equal(row.status, "error");
    assert.equal(row.upstream_provider, "MockProvider", "who got the prompt is known from the stream, before usage");
    assert.equal(row.charged_micros, 0, "an upstream error is not charged");
    assert.ok(row.api_cost_micros > 0, "but its estimated upstream cost is recorded");

    up.reset();
    up.setScenario("chat_slow");
    const ac = new AbortController();
    let requestId = null;
    await alice.sse(
      "/api/chat",
      { text: "Count slowly to forty for me." },
      {
        signal: ac.signal,
        onEvent: (e) => {
          if (e.event === "route") requestId = e.data.request_id;
          if (e.event === "delta") ac.abort();
        },
      }
    );
    const stopped = await waitFor(() => {
      const r = requestRow(db, requestId);
      return r && r.status === "stopped" ? r : null;
    });
    assert.equal(stopped.upstream_provider, "MockProvider");
    assert.ok(stopped.charged_micros > 0, "a Stop after text is charged");

    // The transparency log shows both, with the host that got the prompt.
    const log = await alice.json("GET", "/api/transparency");
    const byId = new Map(log.body.requests.map((x) => [x.id, x]));
    assert.equal(byId.get(err.request_id).upstream_provider, "MockProvider");
    assert.equal(byId.get(requestId).upstream_provider, "MockProvider");
  });

  test("C2/C1 a conversation made private by a failed turn is classified on our side and routed privately", async () => {
    up.reset();
    up.setScenario("chat_midstream_error");
    // Private by Gode's own rules: the outside classifier must never see it.
    const r1 = await alice.sse("/api/chat", { text: "I was diagnosed with HIV last week. What should I ask my doctor?" });
    const e1 = first(r1, "error");
    assert.equal(first(r1, "route").private, true);
    assert.equal(e1.code, "upstream_error");
    const classifierCalls = () => up.find("/v1/chat/completions").filter((q) => q.body?.stream === false);
    assert.equal(classifierCalls().length, 0, "no third-party classifier call for a known-private prompt");
    const conv = db.prepare("SELECT private FROM conversations WHERE id = ?").get(e1.conversation_id);
    assert.equal(conv.private, 1, "the failed private turn made the conversation private");

    up.reset();
    const r2 = await alice.sse("/api/chat", { conversation_id: e1.conversation_id, text: "And what about the weather today?" });
    assert.equal(names(r2).at(-1), "done", JSON.stringify(r2.events.at(-1)));
    const route = first(r2, "route");
    assert.equal(route.private, true, "an innocent follow-up stays private");
    assert.equal(route.zdr, true);
    assert.equal(classifierCalls().length, 0, "every turn of a private conversation is classified locally");
    assert.equal(requestRow(db, route.request_id).classifier_model, "heuristic");
  });

  test("C7/C6 admin credit adjustments go through credits.adjust: ledger kind admin_adjust, never below zero", async () => {
    const found = await admin.json("GET", `/api/admin/users?email=${encodeURIComponent(bob.user.email)}`);
    assert.equal(found.status, 200);
    assert.equal(found.body.users.length, 1);
    const before = found.body.users[0].balance_usd;
    const add = await admin.json("POST", `/api/admin/users/${bob.user.id}/credit`, { usd: 2, note: "goodwill" });
    assert.equal(add.status, 200);
    assert.equal(add.body.balance_usd, before + 2);
    const take = await admin.json("POST", `/api/admin/users/${bob.user.id}/credit`, { usd: -1000 });
    assert.equal(take.body.balance_usd, 0, "clamped at zero");
    const kinds = db.prepare("SELECT kind, ref FROM ledger WHERE user_id = ? AND kind = 'admin_adjust' ORDER BY rowid").all(bob.user.id);
    assert.equal(kinds.length, 2);
    assert.match(kinds[0].ref, /^admin:\S+ goodwill$/);
    const sum = db.prepare("SELECT COALESCE(SUM(delta_micros), 0) AS s FROM ledger WHERE user_id = ?").get(bob.user.id).s;
    assert.equal(sum, 0, "balance == SUM(ledger)");
    // Credit restored for later tests.
    await admin.json("POST", `/api/admin/users/${bob.user.id}/credit`, { usd: 1 });
  });

  test("C7/C9 a model edit or import that would leave a private text cell neither zero-retention nor self-hosted is refused", async () => {
    // Route the chat private cell to a zero-retention OpenRouter model, then try to take its zdr away.
    assert.equal((await admin.json("PUT", "/api/admin/routes/chat/private", { model_id: SONNET })).status, 200);
    const refused = await admin.json("PUT", `/api/admin/models/${encodeURIComponent(SONNET)}`, { zdr: false });
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /private chat pick/);
    assert.equal(getModel(db, SONNET).zdr, true, "nothing changed");

    const exported = (await admin.json("GET", "/api/admin/catalog/export")).body;
    const sonnet = exported.models.find((m) => m.id === SONNET);
    const imp = await admin.json("POST", "/api/admin/catalog/import", { models: [{ ...sonnet, zdr: false }], routes: [] });
    assert.equal(imp.status, 400);
    assert.match(imp.body.error, /private chat pick/);

    // Moving the cell first makes the same edit fine.
    assert.equal((await admin.json("PUT", "/api/admin/routes/chat/private", { model_id: "selfhosted:qwen3.8-27b" })).status, 200);
    assert.equal((await admin.json("PUT", `/api/admin/models/${encodeURIComponent(SONNET)}`, { zdr: false })).status, 200);
    assert.equal((await admin.json("PUT", `/api/admin/models/${encodeURIComponent(SONNET)}`, { zdr: true })).status, 200);

    // C9: the admin routes pass OPENAI_ZDR_APPROVED (unset here) to validateModel.
    const luna = await admin.json("PUT", `/api/admin/models/${encodeURIComponent("openai:gpt-6-luna")}`, { zdr: true });
    assert.equal(luna.status, 400);
    assert.match(luna.body.error, /OPENAI_ZDR_APPROVED/);
    // And self_hosted off the selfhosted gateway is refused outright.
    const fake = await admin.json("PUT", `/api/admin/models/${encodeURIComponent(SONNET)}`, { self_hosted: true });
    assert.equal(fake.status, 400);
  });

  test("C9 catalog-only params never reach fal's input schema", () => {
    const model = { id: "fal:x/y", params: { duration: "5s", duration_options: ["4s", "8s"], pricing: { cached_in: 1 }, max_chars: 10, prompt_field: "prompt" } };
    const input = buildInput(model, { duration: "8s", duration_options: ["x"], pricing: {} }, "a fox");
    assert.deepEqual(input, { duration: "8s", prompt: "a fox" });
  });
});

describe("C3 Presidio outage over HTTP", () => {
  let up;
  before(async () => {
    up = await startMockUpstream();
  });
  after(async () => {
    await up.close();
  });

  async function appWith(failMode) {
    const t = await createTestApp({ ...up.env, PRESIDIO_ANALYZER_URL: up.urls.presidio, PRESIDIO_FAIL_MODE: failMode, ADMIN_EMAILS: "root@example.test" });
    const admin = t.client();
    await admin.signup("root@example.test", PASSWORD);
    const c = t.client();
    c.user = await c.signup(nextEmail("presidio"), PASSWORD);
    return { t, admin, c };
  }

  test("fail mode closed: the prompt is refused with redaction_unavailable; nothing stored, held or sent; the page keeps its promise", async () => {
    up.reset();
    up.setScenario("presidio_down");
    const { t, admin, c } = await appWith("closed");
    try {
      const before = t.deps.credits.balance(c.user.id);
      const r = await c.sse("/api/chat", { text: "Write to Jane Doe about the invoice, please." });
      assert.deepEqual(names(r), ["error"], JSON.stringify(r.events));
      const err = r.events[0].data;
      assert.equal(err.code, "redaction_unavailable");
      assert.match(err.error, /privacy filter is unavailable right now, so nothing was sent/);
      const db = t.deps.db;
      assert.equal(count(db, "SELECT COUNT(*) AS n FROM messages WHERE user_id = ?", c.user.id), 0);
      assert.equal(count(db, "SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?", c.user.id), 0);
      assert.equal(count(db, "SELECT COUNT(*) AS n FROM holds"), 0);
      assert.equal(t.deps.credits.balance(c.user.id), before);
      assert.equal(up.find("/v1/chat/completions").length, 0, "no model saw the unredacted prompt");

      // Nothing is sent without Presidio, so the privacy page may still name it; admins see the outage.
      const pub = await c.json("GET", "/api/public/providers");
      assert.equal(pub.body.presidio_state, "down");
      assert.equal(pub.body.presidio, true);
      const stats = await admin.json("GET", "/api/admin/stats");
      assert.equal(stats.body.presidio.state, "down");
      assert.equal(stats.body.presidio.failMode, "closed");
      assert.ok(stats.body.presidio.downSince > 0);
    } finally {
      await t.close();
    }
  });

  test("fail mode open: the answer goes through with built-in checks, and the page stops naming Presidio", async () => {
    up.reset();
    up.setScenario("presidio_down");
    const { t, c } = await appWith("open");
    try {
      const r = await c.sse("/api/chat", { text: "Say hello to my friend, my email is ada@example.com." });
      assert.equal(names(r).at(-1), "done", JSON.stringify(r.events.at(-1)));
      assert.deepEqual(first(r, "route").redactions, { EMAIL: 1 }, "the built-in recognizers still ran");
      const pub = await c.json("GET", "/api/public/providers");
      assert.equal(pub.body.presidio_state, "down");
      assert.equal(pub.body.presidio, false);
      const me = await c.json("GET", "/api/me");
      assert.equal(me.body.config.presidio, false);
      assert.equal(me.body.config.presidio_state, "down");
    } finally {
      await t.close();
    }
  });
});
