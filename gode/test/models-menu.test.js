// GET /api/models as the switch menu: the answer's own privacy (?message_id=), the conversation's
// sticky privacy flag, the order (current model first) and the "Your pick" header.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createTestApp } = require("./helpers/app");

const OPUS = "openrouter:anthropic/claude-opus-5.5";
const GEMINI = "openrouter:google/gemini-4-carbon";
const SELF = "selfhosted:qwen3.8-27b";
const FLUX_KLEIN = "fal:blackforestlabs/flux-3/klein/text-to-image";
const SUNBURST = "openai:gpt-image-2.6-sunburst";

describe("GET /api/models as the switch menu", () => {
  let t;
  let c;
  let user;

  before(async () => {
    t = await createTestApp({});
    c = t.client();
    user = await c.signup("menu@example.test");
  });
  after(() => t.close());

  function conversation({ pins = {}, isPrivate = 0, owner = user.id } = {}) {
    const id = crypto.randomUUID();
    const at = Date.now();
    t.deps.db
      .prepare("INSERT INTO conversations (id, user_id, pins, private, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, owner, JSON.stringify(pins), isPrivate, at, at);
    return id;
  }

  /** A stored answer in `conversationId` produced by `modelId`, with its requests row. */
  function answer(conversationId, { job, modelId, isPrivate = 0, owner = user.id }) {
    const { db, keyring } = t.deps;
    const dek = db.prepare("SELECT wrapped_dek FROM users WHERE id = ?").get(owner).wrapped_dek;
    const q = crypto.randomUUID();
    const a = crypto.randomUUID();
    const r = crypto.randomUUID();
    const at = Date.now();
    const ins = db.prepare(
      "INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    ins.run(q, conversationId, owner, "user", keyring.encrypt(dek, { text: "a question" }, { json: true }), null, null, at);
    db.prepare("INSERT INTO requests (id, user_id, conversation_id, message_id, kind, job, private, tier, model_id, created_at) VALUES (?, ?, ?, ?, 'auto', ?, ?, ?, ?, ?)").run(
      r, owner, conversationId, a, job, isPrivate, isPrivate ? "private" : "budget", modelId, at
    );
    ins.run(a, conversationId, owner, "assistant", keyring.encrypt(dek, { text: "", media: [] }, { json: true }), q, r, at + 1);
    return a;
  }

  test("a private image answer's menu lists only the models a switch accepts", async () => {
    const conv = conversation();
    const msg = answer(conv, { job: "image", modelId: FLUX_KLEIN, isPrivate: 1 });
    const all = (await c.json("GET", "/api/models?job=image")).body.models.map((m) => m.id);
    assert.ok(all.includes(SUNBURST) && all.length > 1);
    const menu = await c.json("GET", `/api/models?job=image&message_id=${msg}`);
    assert.equal(menu.status, 200);
    assert.deepEqual(menu.body.models.map((m) => m.id), [FLUX_KLEIN]);
    // Every listed model is accepted by the switch: the picker's own rule.
    for (const m of menu.body.models) {
      assert.doesNotThrow(() => t.deps.picker.pick({ job: "image", difficulty: 2, private: true, user, pins: {}, overrideModelId: m.id }));
    }
    assert.throws(() => t.deps.picker.pick({ job: "image", difficulty: 2, private: true, user, pins: {}, overrideModelId: SUNBURST }), { status: 400 });
  });

  test("the answer's model comes first; a user pin says 'Your pick'", async () => {
    const conv = conversation({ pins: { chat: { model_id: OPUS, tier: "budget", source: "user" } } });
    const msg = answer(conv, { job: "chat", modelId: OPUS });
    const r = await c.json("GET", `/api/models?job=chat&message_id=${msg}`);
    assert.equal(r.body.models[0].id, OPUS);
    assert.equal(r.body.models[1].id, GEMINI, "then the routed picks, quality first");
    assert.equal(r.body.header, "Your pick, pinned for this chat");
    assert.equal((await c.json("GET", `/api/models?job=chat&conversation_id=${conv}`)).body.header, "Your pick, pinned for this chat");

    const auto = conversation({ pins: { chat: { model_id: GEMINI, tier: "quality", source: "auto" } } });
    const r2 = await c.json("GET", `/api/models?job=chat&conversation_id=${auto}`);
    assert.equal(r2.body.header, null);
    assert.equal(r2.body.models[0].id, GEMINI);
    assert.equal((await c.json("GET", "/api/models?job=chat")).body.header, null);
  });

  test("after the routed picks, the rest is sorted by price, cheapest first", async () => {
    const { typicalPriceUsd } = require("../src/router/pick");
    const { getModel } = require("../src/seed/catalog");
    const ids = (await c.json("GET", "/api/models?job=chat")).body.models.map((m) => m.id);
    const routed = t.deps.db.prepare("SELECT model_id FROM routes WHERE job = 'chat' AND tier IN ('quality', 'balanced', 'budget')").all().map((x) => x.model_id);
    assert.deepEqual(new Set(ids.slice(0, new Set(routed).size)), new Set(routed));
    const prices = ids.slice(new Set(routed).size).map((id) => typicalPriceUsd(getModel(t.deps.db, id)));
    const known = prices.filter((p) => p !== null);
    assert.deepEqual(known, [...known].sort((a, b) => a - b));
  });

  test("a conversation flagged private limits the menu like a private pin", async () => {
    const conv = conversation({ isPrivate: 1 });
    const menu = (await c.json("GET", `/api/models?job=chat&conversation_id=${conv}`)).body.models;
    assert.ok(menu.length > 0 && menu.every((m) => m.zdr || m.self_hosted), menu.map((m) => m.id).join());
    assert.equal(menu[0].id, SELF, "the private pick first");
    assert.ok(!menu.some((m) => m.id === GEMINI));
  });

  test("someone else's answer, a mismatched conversation or a non-answer is a 404", async () => {
    const other = await t.client().signup("other@example.test");
    const theirs = answer(conversation({ owner: other.id }), { job: "chat", modelId: GEMINI, owner: other.id });
    assert.equal((await c.json("GET", `/api/models?job=chat&message_id=${theirs}`)).status, 404);
    const mine = answer(conversation(), { job: "chat", modelId: GEMINI });
    assert.equal((await c.json("GET", `/api/models?job=chat&message_id=${mine}&conversation_id=${conversation()}`)).status, 404);
    const q = t.deps.db.prepare("SELECT parent_id FROM messages WHERE id = ?").get(mine).parent_id;
    assert.equal((await c.json("GET", `/api/models?job=chat&message_id=${q}`)).status, 404);
    assert.equal((await c.json("GET", "/api/models?job=chat&message_id=a&message_id=b")).status, 400);
  });
});
