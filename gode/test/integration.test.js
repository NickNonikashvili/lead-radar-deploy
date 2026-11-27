// End-to-end flows through the HTTP API with the REAL pipeline: sign-up credit, streamed answers,
// reload, switch/regenerate pins, feedback, media, privacy refusals, credit exhaustion, client
// disconnects, the transparency log and "delete everything".
//
// Two set-ups run the same kind of flow:
//   - mock mode (GODE_MOCK=1): every gateway is the offline mock provider;
//   - real adapters (GODE_MOCK=0) pointed at test/helpers/mock-upstream.js: the OpenRouter, OpenAI
//     and fal adapters speak their real wire formats to a local emulator, so costs are exact and we
//     can see what each upstream received.
// Every flow ends by checking the ledger invariant and that no credit hold was left behind.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");
const { chipFor, formatChip, formatCost } = require("../src/chat/pipeline");
const { usdToMicros } = require("../src/util");

const PASSWORD = "correct-horse-battery";
const SONNET = "openrouter:anthropic/claude-sonnet-5.5";
const DEEPSEEK = "openrouter:deepseek/deepseek-v4.1-flash";
const QWEN_IMAGE = "fal:alibaba/qwen-image-3/text-to-image";
// Personal details the redactor must hide from every upstream and every metadata table.
const NAME = "Ada Lovelace";
const EMAIL = "ada.lovelace@example.com";
const PII_PROMPT = `Hi, my name is ${NAME} and my email is ${EMAIL}. Write a short thank-you note to my landlord.`;
// Words from the prompts below that must never show up in metadata (requests rows, transparency).
const PROMPT_WORDS = ["Lovelace", EMAIL, "landlord", "red fox", "lighthouse", "Draw a picture"];

let emailSeq = 0;
const nextEmail = (name) => `${name}${++emailSeq}@example.test`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeoutMs = 3000, stepMs = 10 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("waitFor: timed out");
    await sleep(stepMs);
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const names = (r) => r.events.map((e) => e.event);
const first = (r, name) => r.events.find((e) => e.event === name)?.data;
const all = (r, name) => r.events.filter((e) => e.event === name).map((e) => e.data);
const streamedText = (r) => all(r, "delta").map((d) => d.text).join("");

/** A finished answer: route first, done last, no error. Returns { route, done }. */
function assertAnswered(r) {
  assert.equal(r.status, 200);
  const list = names(r);
  assert.equal(list[0], "route", `first event: ${JSON.stringify(r.events[0])}`);
  assert.equal(list.at(-1), "done", `last event: ${JSON.stringify(r.events.at(-1))}`);
  assert.ok(!list.includes("error"), "no error event");
  const route = first(r, "route");
  const done = first(r, "done");
  assert.equal(done.message_id, route.message_id);
  assert.equal(done.request_id, route.request_id);
  assert.equal(done.conversation_id, route.conversation_id);
  return { route, done };
}

/** A refused turn: exactly one event, an error with this code. Returns its data. */
function assertRefused(r, code) {
  assert.equal(r.status, 200, "pipeline failures arrive inside the event stream");
  assert.deepEqual(names(r), ["error"], JSON.stringify(r.events));
  const err = r.events[0].data;
  assert.equal(err.code, code);
  assert.equal(typeof err.error, "string");
  assert.ok(err.error.length > 5, "a message the UI can show");
  return err;
}

/** users.balance_micros == SUM(ledger) for every user, and nothing is still on hold. */
function assertBooksBalanced(db) {
  const rows = db
    .prepare(
      `SELECT u.id, u.balance_micros AS balance,
              COALESCE((SELECT SUM(delta_micros) FROM ledger l WHERE l.user_id = u.id), 0) AS total
         FROM users u`
    )
    .all();
  for (const r of rows) assert.equal(r.balance, r.total, `ledger invariant broken for ${r.id}`);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM holds").get().n, 0, "no credit hold left behind");
}

const balanceMicros = (db, userId) => db.prepare("SELECT balance_micros AS b FROM users WHERE id = ?").get(userId).b;
const requestRow = (db, id) => db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
const count = (db, sql, ...args) => db.prepare(sql).get(...args).n;

/** Every text column of every row: the metadata tables must never hold prompt or answer text. */
function assertNoPromptText(rows, where) {
  const blob = JSON.stringify(rows);
  for (const word of PROMPT_WORDS) assert.ok(!blob.includes(word), `${where} contains "${word}"`);
}

async function signedIn(t, name) {
  const c = t.client();
  const user = await c.signup(nextEmail(name), PASSWORD);
  return { c, user };
}

// ---------------------------------------------------------------------------------------------
// Mock mode: one account through the whole product
// ---------------------------------------------------------------------------------------------

describe("integration: one account end to end (mock mode)", () => {
  let t;
  let db;
  let me;
  // Shared by the steps below, in order.
  let conversationId;
  let firstAnswer;
  const requestIds = [];

  before(async () => {
    t = await createTestApp({ ALLOW_DEV_TOPUP: "1" });
    db = t.deps.db;
  });
  after(() => t.close());

  test("signup gets the signup credit", async () => {
    me = await signedIn(t, "ada");
    assert.equal(me.user.balance_usd, 0.25);
    assert.equal(balanceMicros(db, me.user.id), usdToMicros(t.config.billing.signupCreditUsd));
    const ledger = await me.c.json("GET", "/api/billing/ledger");
    assert.equal(ledger.status, 200);
    assert.equal(ledger.body.balance_usd, 0.25);
    assert.deepEqual(ledger.body.entries.map((e) => [e.kind, e.delta_usd]), [["signup_bonus", 0.25]]);
    assertBooksBalanced(db);
  });

  test("an auto chat streams route, deltas and done; chip, balance and ledger agree", async () => {
    const before = (await me.c.json("GET", "/api/me")).body.user.balance_usd;
    const r = await me.c.sse("/api/chat", { text: PII_PROMPT });
    const { route, done } = assertAnswered(r);
    assert.ok(all(r, "delta").length >= 3, "the answer streams in pieces");

    // Routing: the router picked (auto), and saw only placeholders.
    assert.equal(route.job, "chat");
    assert.ok(["budget", "balanced", "quality"].includes(route.tier));
    assert.equal(typeof route.model.label, "string");
    assert.deepEqual(route.redactions, { PERSON: 1, EMAIL: 1 });
    assert.ok(route.est_cost_usd > 0);
    assert.ok(route.title && !route.title.includes("[PERSON"), "title has the real name back, not a placeholder");
    // The mock echoes what it received; the stream restorer puts the real values back.
    const text = streamedText(r);
    assert.ok(text.includes(NAME) && text.includes(EMAIL), text);
    assert.ok(!/\[(PERSON|EMAIL)_\d+\]/.test(text), "no placeholder reaches the user");

    // The chip is the documented format of the done event's own numbers.
    assert.equal(done.chip, chipFor({ label: route.model.label, job: route.job, effort: route.effort, costUsd: done.cost_usd }));
    assert.equal(done.chip, formatChip(route.model.label, route.effort, done.cost_usd));
    assert.ok(done.cost_usd > 0 && done.api_cost_usd > 0 && done.cost_usd >= done.api_cost_usd);
    assert.ok(done.input_tokens > 0 && done.output_tokens > 0);
    assert.equal(done.media_units, null);

    // Billing: the balance dropped by exactly the charge, which the ledger records once.
    const charged = usdToMicros(done.cost_usd);
    assert.equal(usdToMicros(before) - balanceMicros(db, me.user.id), charged);
    assert.equal(done.balance_usd, (await me.c.json("GET", "/api/me")).body.user.balance_usd);
    const req = requestRow(db, done.request_id);
    assert.equal(req.status, "ok");
    assert.equal(req.charged_micros, charged);
    assert.equal(req.kind, "auto");
    const charges = db.prepare("SELECT delta_micros FROM ledger WHERE user_id = ? AND kind = 'charge' AND ref = ?").all(me.user.id, done.request_id);
    assert.deepEqual(charges.map((c) => c.delta_micros), [-charged]);
    assertBooksBalanced(db);

    conversationId = route.conversation_id;
    firstAnswer = { route, done, text };
    requestIds.push(done.request_id);
  });

  test("the conversation reloads with decrypted messages and request metadata", async () => {
    const list = await me.c.json("GET", "/api/conversations");
    const entry = list.body.conversations.find((c) => c.id === conversationId);
    assert.ok(entry, "listed");
    assert.equal(entry.title, firstAnswer.route.title);

    const conv = await me.c.json("GET", `/api/conversations/${conversationId}`);
    assert.equal(conv.status, 200);
    const [question, answer] = conv.body.messages;
    assert.equal(conv.body.messages.length, 2);
    assert.equal(question.role, "user");
    assert.equal(question.id, firstAnswer.route.user_message_id);
    assert.equal(question.text, PII_PROMPT, "the user's own words, decrypted");
    assert.equal(answer.role, "assistant");
    assert.equal(answer.id, firstAnswer.done.message_id);
    assert.equal(answer.parent_id, question.id);
    assert.equal(answer.text, firstAnswer.text, "stored answer == streamed answer");
    assert.deepEqual(answer.media, []);
    const meta = answer.request;
    assert.equal(meta.id, firstAnswer.done.request_id);
    assert.equal(meta.chip, firstAnswer.done.chip, "stored chip == live chip");
    assert.equal(meta.model_id, firstAnswer.route.model.id);
    assert.equal(meta.model_label, firstAnswer.route.model.label);
    assert.equal(meta.job, "chat");
    assert.equal(meta.tier, firstAnswer.route.tier);
    assert.equal(meta.effort, firstAnswer.route.effort);
    assert.equal(meta.cost_usd, firstAnswer.done.cost_usd);
    assert.deepEqual(meta.redactions, { PERSON: 1, EMAIL: 1 });
    assert.equal(meta.status, "ok");
    assert.equal(meta.feedback, null);

    // At rest: content, title and the placeholder map are ciphertext; metadata holds no text.
    const rows = db.prepare("SELECT content_enc FROM messages WHERE conversation_id = ?").all(conversationId);
    assertNoPromptText(rows, "messages.content_enc");
    const convRow = db.prepare("SELECT title_enc, pii_map_enc FROM conversations WHERE id = ?").get(conversationId);
    assert.ok(convRow.pii_map_enc, "the placeholder map is stored");
    assertNoPromptText([convRow], "conversations");
    assert.ok(!JSON.stringify(convRow).includes("Ada"));
  });

  test("switch then regenerate keep the pinned model", async () => {
    const menu = await me.c.json("GET", `/api/models?job=chat&conversation_id=${conversationId}`);
    assert.equal(menu.status, 200);
    assert.ok(menu.body.models.some((m) => m.id === SONNET), "Claude Sonnet 5.5 is offered");
    assert.notEqual(firstAnswer.route.model.id, SONNET, "switching to a different model");

    const sw = await me.c.sse(`/api/messages/${firstAnswer.done.message_id}/switch`, { model_id: SONNET });
    const switched = assertAnswered(sw);
    assert.equal(switched.route.model.id, SONNET);
    assert.equal(switched.route.replaces_message_id, firstAnswer.done.message_id);
    assert.equal(switched.route.user_message_id, firstAnswer.route.user_message_id, "same question, no new user message");
    assert.match(switched.done.chip, /^Claude Sonnet 5\.5 · /);

    const regen = await me.c.sse(`/api/messages/${switched.done.message_id}/regenerate`, {});
    const regenerated = assertAnswered(regen);
    assert.equal(regenerated.route.model.id, SONNET, "regenerate keeps the user's pick");
    assert.equal(regenerated.route.pinned, true);
    assert.equal(regenerated.route.replaces_message_id, switched.done.message_id);

    // A follow-up question in the same chat stays on the pinned model too.
    const next = await me.c.sse("/api/chat", { conversation_id: conversationId, text: "Thanks! Make it a bit warmer." });
    const followUp = assertAnswered(next);
    assert.equal(followUp.route.model.id, SONNET);
    assert.equal(followUp.route.pinned, true);

    const conv = await me.c.json("GET", `/api/conversations/${conversationId}`);
    assert.deepEqual(conv.body.messages.map((m) => m.role), ["user", "assistant", "user", "assistant"], "replaced answers are gone");
    assert.equal(conv.body.messages[1].id, regenerated.done.message_id);
    assert.equal(conv.body.messages[1].request.chip, regenerated.done.chip);
    assert.deepEqual(conv.body.conversation.pins.chat, { model_id: SONNET, tier: conv.body.conversation.pins.chat.tier, source: "user" });

    // The learner's signals: the auto answer was overridden, the switched one regenerated.
    assert.equal(requestRow(db, firstAnswer.done.request_id).overridden, 1);
    assert.equal(requestRow(db, switched.done.request_id).regenerated, 1);
    assert.deepEqual(
      [switched.done.request_id, regenerated.done.request_id, followUp.done.request_id].map((id) => requestRow(db, id).kind),
      ["switch", "regenerate", "auto"]
    );
    requestIds.push(switched.done.request_id, regenerated.done.request_id, followUp.done.request_id);
    firstAnswer = { ...firstAnswer, current: regenerated.done };
    assertBooksBalanced(db);
  });

  test("feedback is stored on the request", async () => {
    const answerId = firstAnswer.current.message_id;
    const requestId = firstAnswer.current.request_id;
    for (const [value, stored] of [[1, 1], [-1, -1], [0, null], [1, 1]]) {
      const r = await me.c.json("POST", `/api/messages/${answerId}/feedback`, { value });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { ok: true });
      assert.equal(requestRow(db, requestId).feedback, stored);
    }
    const conv = await me.c.json("GET", `/api/conversations/${conversationId}`);
    assert.equal(conv.body.messages[1].request.feedback, 1);
    // Someone else can't rate (or even see) this answer.
    const other = await signedIn(t, "eve");
    assert.equal((await other.c.json("POST", `/api/messages/${answerId}/feedback`, { value: -1 })).status, 404);
    assert.equal(requestRow(db, requestId).feedback, 1);
  });

  test("an image job produces a media event", async () => {
    const r = await me.c.sse("/api/chat", { text: "Draw a picture of a red fox in the snow" });
    const { route, done } = assertAnswered(r);
    assert.equal(route.job, "image");
    assert.equal(route.effort, "none");
    assert.ok(all(r, "progress").length >= 1, "queue progress");
    const media = all(r, "media");
    assert.equal(media.length, 1);
    assert.equal(media[0].type, "image");
    assert.match(media[0].url, /^data:image\/svg\+xml;base64,/);
    assert.ok(names(r).indexOf("media") < names(r).indexOf("done"));
    assert.equal(done.media_units, 1);
    assert.equal(done.input_tokens, null);
    assert.equal(done.chip, chipFor({ label: route.model.label, job: "image", effort: route.effort, costUsd: done.cost_usd }));
    assert.ok(!/effort|thinking/.test(done.chip), "no effort part under an image");

    const conv = await me.c.json("GET", `/api/conversations/${route.conversation_id}`);
    const answer = conv.body.messages[1];
    assert.deepEqual(answer.media, media);
    assert.equal(answer.request.chip, done.chip);
    requestIds.push(done.request_id);
    assertBooksBalanced(db);
  });

  test("a strict-privacy media job returns private_blocked", async () => {
    assert.equal((await me.c.json("PATCH", "/api/me", { strict_privacy: true })).body.user.strict_privacy, true);
    const before = balanceMicros(db, me.user.id);
    const conversations = count(db, "SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?", me.user.id);

    const r = await me.c.sse("/api/chat", { text: "Draw a picture of a lighthouse at dusk" });
    const err = assertRefused(r, "private_blocked");
    assert.match(err.error, /Strict privacy is on/);
    assert.equal(err.conversation_id, undefined, "nothing was stored, so no conversation to point at");
    assert.ok(err.request_id, "the refusal is in the routing log");
    const row = requestRow(db, err.request_id);
    assert.equal(row.status, "error");
    assert.equal(row.error_code, "private_blocked");
    assert.equal(row.charged_micros, 0);
    assert.equal(balanceMicros(db, me.user.id), before, "not charged");
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?", me.user.id), conversations, "no empty chat left behind");
    requestIds.push(err.request_id);

    // Text still works under strict privacy (zero-retention or self-hosted models only).
    const ok = await me.c.sse("/api/chat", { conversation_id: conversationId, text: "One more line, please." });
    const { route, done } = assertAnswered(ok);
    assert.equal(route.zdr, true);
    requestIds.push(done.request_id);
    await me.c.json("PATCH", "/api/me", { strict_privacy: false });
    assertBooksBalanced(db);
  });

  test("a client disconnect mid-stream aborts upstream; the partial answer is kept and charged", async () => {
    // Watch the signal the pipeline hands the provider.
    const { providers } = t.deps;
    const realGet = providers.get;
    const signals = [];
    providers.get = (gateway) => {
      const p = realGet(gateway);
      return {
        ...p,
        streamChat(args) {
          signals.push(args.signal);
          return p.streamChat(args);
        },
      };
    };
    try {
      const before = balanceMicros(db, me.user.id);
      const text = "Tell me a long story about a lighthouse keeper and the sea, with many words in it please.";
      const ac = new AbortController();
      let requestId = null;
      const r = await me.c.sse(
        "/api/chat",
        { conversation_id: conversationId, text },
        {
          signal: ac.signal,
          onEvent: (e) => {
            if (e.event === "route") requestId = e.data.request_id;
            if (e.event === "delta") ac.abort();
          },
        }
      );
      assert.equal(r.aborted, true);
      assert.ok(requestId, "the answer had started");
      await waitFor(() => t.app.locals.activeStreams() === 0);
      await waitFor(() => requestRow(db, requestId));

      assert.equal(signals.length, 1);
      assert.equal(signals[0].aborted, true, "the upstream call was told to stop");
      const row = requestRow(db, requestId);
      assert.equal(row.status, "stopped");
      assert.equal(row.error_code, null);
      // What streamed before the stop is paid for (estimated: input sent + text streamed).
      assert.ok(row.charged_micros > 0);
      assert.ok(row.message_id, "the partial answer was stored");
      assert.equal(balanceMicros(db, me.user.id), before - row.charged_micros);
      assertBooksBalanced(db);

      // The question and the stopped partial answer are both in the conversation.
      let conv = await me.c.json("GET", `/api/conversations/${conversationId}`);
      assert.deepEqual(conv.body.messages.slice(-2).map((m) => m.role), ["user", "assistant"]);
      assert.equal(conv.body.messages.at(-2).text, text);
      assert.equal(conv.body.messages.at(-1).id, row.message_id);
      // Asking again is a new question (the old one has its stopped answer).
      const retry = assertAnswered(await me.c.sse("/api/chat", { conversation_id: conversationId, text }));
      conv = await me.c.json("GET", `/api/conversations/${conversationId}`);
      assert.equal(conv.body.messages.at(-1).id, retry.done.message_id);
      requestIds.push(requestId, retry.done.request_id);
    } finally {
      providers.get = realGet;
    }
  });

  test("transparency lists the requests with no prompt text", async () => {
    const r = await me.c.json("GET", "/api/transparency?limit=200");
    assert.equal(r.status, 200);
    const rows = r.body.requests;
    const ownRequests = db.prepare("SELECT id FROM requests WHERE user_id = ?").all(me.user.id).map((x) => x.id);
    assert.deepEqual(new Set(rows.map((x) => x.id)), new Set(ownRequests), "every request, nobody else's");
    for (const id of requestIds) assert.ok(rows.some((x) => x.id === id), `request ${id} listed`);
    // The base columns, plus the classifier columns the transparency page may add; never text.
    const base = [
      "cost_usd", "created_at", "effort", "error_code", "gateway", "id", "job", "kind", "model_id", "model_label",
      "private", "redactions", "status", "tier", "upstream_provider", "zdr",
    ];
    const optional = ["classifier_label", "classifier_model"];
    for (const row of rows) {
      const keys = Object.keys(row);
      for (const k of base) assert.ok(keys.includes(k), `transparency row has ${k}`);
      for (const k of keys) assert.ok(base.includes(k) || optional.includes(k), `unexpected transparency column ${k}`);
    }
    const ok = rows.find((x) => x.id === requestIds[0]);
    assert.deepEqual(ok.redactions, { PERSON: 1, EMAIL: 1 }, "counts only");
    assert.equal(ok.status, "ok");
    const stopped = rows.find((x) => x.status === "stopped");
    assert.ok(stopped && stopped.cost_usd > 0, "the stopped answer is listed with what it cost");
    assert.equal(rows.find((x) => x.error_code === "private_blocked")?.cost_usd, 0);
    // Newest first.
    const times = rows.map((x) => x.created_at);
    assert.deepEqual(times, [...times].sort((a, b) => b - a));

    assertNoPromptText(rows, "GET /api/transparency");
    assertNoPromptText(db.prepare("SELECT * FROM requests").all(), "the requests table");
    assertNoPromptText(db.prepare("SELECT * FROM ledger").all(), "the ledger");
  });

  test("delete everything wipes the user's rows while ledger refs survive with user_id NULL", async () => {
    const uid = me.user.id;
    const ledgerBefore = db.prepare("SELECT id, delta_micros, kind, ref FROM ledger WHERE user_id = ? ORDER BY id").all(uid);
    assert.ok(ledgerBefore.length >= 10, "signup, charges and hold/release pairs");
    const total = db.prepare("SELECT SUM(delta_micros) AS s FROM ledger").get().s;
    const others = count(db, "SELECT COUNT(*) AS n FROM users WHERE id != ?", uid);

    // A wrong password changes nothing.
    const wrong = await me.c.json("DELETE", "/api/me", { password: "not-my-password" });
    assert.equal(wrong.status, 401);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users WHERE id = ?", uid), 1);

    const r = await me.c.json("DELETE", "/api/me", { password: PASSWORD });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
    assert.match(r.headers.get("set-cookie") || "", /gode_session=;/, "session cookie cleared");

    for (const table of ["conversations", "messages", "requests", "holds", "sessions"]) {
      assert.equal(count(db, `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, uid), 0, `${table} wiped`);
    }
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users WHERE id = ?", uid), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?", conversationId), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users"), others, "other accounts untouched");

    // The money trail stays (purchases must stay idempotent), detached from the person.
    const ledgerAfter = db.prepare(`SELECT id, delta_micros, kind, ref, user_id FROM ledger WHERE id IN (${ledgerBefore.map(() => "?").join(",")}) ORDER BY id`).all(...ledgerBefore.map((l) => l.id));
    assert.deepEqual(ledgerAfter.map(({ user_id: _u, ...rest }) => rest), ledgerBefore.map((l) => ({ ...l })));
    assert.ok(ledgerAfter.every((l) => l.user_id === null));
    assert.ok(ledgerAfter.some((l) => l.kind === "charge" && requestIds.includes(l.ref)), "charge refs are request ids");
    assert.equal(db.prepare("SELECT SUM(delta_micros) AS s FROM ledger").get().s, total);

    assert.equal((await me.c.json("GET", "/api/me")).status, 401, "signed out");
    assert.equal((await t.client().json("POST", "/api/auth/login", { email: me.user.email, password: PASSWORD })).status, 401);
    assertBooksBalanced(db);
  });
});

// ---------------------------------------------------------------------------------------------
// Mock mode: running out of credit
// ---------------------------------------------------------------------------------------------

describe("integration: insufficient credits", () => {
  let t;
  let db;
  before(async () => {
    t = await createTestApp({ SIGNUP_CREDIT_USD: "0", ALLOW_DEV_TOPUP: "1" });
    db = t.deps.db;
  });
  after(() => t.close());

  test("an empty balance gets an SSE error; nothing is held, charged or stored", async () => {
    const me = await signedIn(t, "broke");
    assert.equal(me.user.balance_usd, 0);
    const r = await me.c.sse("/api/chat", { text: "What is the capital of Portugal?" });
    const err = assertRefused(r, "insufficient_credits");
    assert.match(err.error, /out of credits/i);
    assert.equal(err.conversation_id, undefined);
    assert.equal(balanceMicros(db, me.user.id), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?", me.user.id), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM ledger WHERE user_id = ?", me.user.id), 0, "no hold was ever written");
    assertBooksBalanced(db);
  });

  test("a balance too small for any answer is refused up front; a small one buys a shorter answer, never an overdraft", async () => {
    const me = await signedIn(t, "nearly-broke");
    // One micro-dollar: not even the input fits, so nothing is held, sent or stored.
    assert.equal((await me.c.json("POST", "/api/billing/dev-topup", { usd: 0.000001 })).body.balance_usd, 0.000001);
    const r = await me.c.sse("/api/chat", { text: "What is the capital of Portugal?" });
    const err = assertRefused(r, "insufficient_credits");
    assert.match(err.error, /too low for an answer/);
    assert.equal(err.conversation_id, undefined);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id = ? AND kind = 'hold'").get(me.user.id).n, 0, "no hold");
    assert.equal(balanceMicros(db, me.user.id), 1);

    // A cent: the answer goes through with a cap that fits, and the balance stays >= 0.
    await me.c.json("POST", "/api/billing/dev-topup", { usd: 0.01 });
    const ok = assertAnswered(await me.c.sse("/api/chat", { text: "What is the capital of Spain?" }));
    const [hold] = db.prepare("SELECT delta_micros FROM ledger WHERE user_id = ? AND kind = 'hold'").all(me.user.id);
    assert.ok(-hold.delta_micros <= 10_001, "the hold fits the balance");
    assert.ok(balanceMicros(db, me.user.id) >= 0, "never below zero");
    assert.equal(balanceMicros(db, me.user.id), 10_001 - usdToMicros(ok.done.cost_usd));
    const ledger = await me.c.json("GET", "/api/billing/ledger?all=1");
    const sum = ledger.body.entries.reduce((s, e) => s + usdToMicros(e.delta_usd), 0);
    assert.equal(sum, balanceMicros(db, me.user.id));
    assert.equal(ledger.body.held_usd, 0);
    assertBooksBalanced(db);
  });
});

// ---------------------------------------------------------------------------------------------
// Mock mode: a voice model's text limit is enforced before any credit is held
// ---------------------------------------------------------------------------------------------

describe("integration: voice text limit", () => {
  let t;
  before(async () => {
    t = await createTestApp();
  });
  after(() => t.close());

  test("text longer than the voice model's max_chars is refused up front, uncharged", async () => {
    const me = await signedIn(t, "narrator");
    const db = t.deps.db;
    const text = `Read this aloud: ${"la ".repeat(800)}`; // ~2,400 characters
    const r = await me.c.sse("/api/chat", { text });
    const err = assertRefused(r, "bad_request");
    assert.match(err.error, /^This voice model accepts at most 2000 characters; shorten the text\.$/);
    const row = requestRow(db, err.request_id);
    assert.equal(row.job, "voice");
    assert.equal(row.model_id, "fal:alibaba/qwen-audio-3-tts", "the balanced voice pick (2,000-character limit)");
    assert.equal(row.status, "error");
    assert.equal(row.charged_micros, 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM ledger WHERE user_id = ? AND kind = 'hold'", me.user.id), 0, "no hold was taken");
    assert.equal(me.user.balance_usd, (await me.c.json("GET", "/api/me")).body.user.balance_usd);

    // Short enough: answered.
    const ok = await me.c.sse("/api/chat", { text: "Read this aloud: good morning, everyone." });
    const { route } = assertAnswered(ok);
    assert.equal(route.job, "voice");
    assert.equal(all(ok, "media")[0].type, "audio");
    assertBooksBalanced(db);
  });
});

// ---------------------------------------------------------------------------------------------
// Real adapters against test/helpers/mock-upstream.js
// ---------------------------------------------------------------------------------------------

describe("integration: real gateway adapters (mock upstream)", () => {
  let up;
  let t;
  let db;
  let me;
  const streamed = () => up.find("/v1/chat/completions").filter((r) => r.body?.stream === true);

  before(async () => {
    up = await startMockUpstream();
    t = await createTestApp({
      ...up.env,
      GODE_MOCK: "0",
      OPENROUTER_API_KEY: "sk-or-test-integration",
      OPENAI_API_KEY: "sk-test-integration",
      FAL_KEY: "fal-test-integration",
    });
    db = t.deps.db;
    me = await signedIn(t, "wire");
  });
  after(async () => {
    await t.close();
    await up.close();
  });

  test("chat over OpenRouter: placeholders upstream, real values back, exact cost from usage.cost", async () => {
    up.reset();
    up.setScenario("chat_echo"); // the upstream answers "You said: <what it received>"
    const before = balanceMicros(db, me.user.id);
    const r = await me.c.sse("/api/chat", { text: PII_PROMPT });
    const { route, done } = assertAnswered(r);
    assert.equal(route.model.id, DEEPSEEK, "the emulated classifier says chat, difficulty 2 -> budget");
    assert.equal(route.effort, "low");

    // What OpenRouter received: placeholders only, the session id, no user identifier.
    const sent = streamed().at(-1).body;
    const userTurn = sent.messages.at(-1).content;
    assert.ok(userTurn.includes("[PERSON_1]") && userTurn.includes("[EMAIL_1]"), userTurn);
    assert.ok(!JSON.stringify(sent).includes("Lovelace") && !JSON.stringify(sent).includes(EMAIL));
    assert.equal(sent.user, undefined);
    assert.match(sent.session_id, /^[0-9a-f]{32}$/);
    const classifierCall = up.find("/v1/chat/completions").find((q) => q.body?.stream !== true);
    assert.ok(!JSON.stringify(classifierCall.body).includes("Lovelace"), "the classifier sees redacted text too");

    // What the user got back: the real values, restored from the 3-character stream pieces.
    assert.equal(streamedText(r), `You said: ${PII_PROMPT}`);

    // Cost: OpenRouter's usage.cost ($0.00042) for the answer and for the classifier call, plus margin.
    const api = 420 + 420;
    assert.equal(usdToMicros(done.api_cost_usd), api);
    assert.equal(usdToMicros(done.cost_usd), t.deps.credits.priceFor(api));
    assert.equal(done.chip, "DeepSeek V4.1 Flash · low effort · $0.00109");
    assert.equal(before - balanceMicros(db, me.user.id), t.deps.credits.priceFor(api));
    const row = requestRow(db, done.request_id);
    assert.equal(row.upstream_provider, "MockProvider");
    assert.equal(row.classifier_model, DEEPSEEK);
    assert.equal(row.input_tokens, 12);
    assert.equal(row.output_tokens, 9);
    assert.equal(row.reasoning_tokens, 3);
    assertBooksBalanced(db);
  });

  test("image over fal: queue progress, the fal media URL, priced per image", async () => {
    up.reset();
    // The emulated classifier answers with this classification.
    up.setScenario({ chat: { content: { job: "image", difficulty: 1, private: false, output: { length: "short", format: "image", aspect: "1:1" }, title: "Red fox" } } });
    const r = await me.c.sse("/api/chat", { text: "Draw a picture of a red fox in the snow" });
    const { route, done } = assertAnswered(r);
    assert.equal(route.model.id, QWEN_IMAGE);
    assert.deepEqual(all(r, "progress").at(-1), { status: "running" });
    assert.ok(all(r, "progress").some((p) => p.status === "queued" && Number.isInteger(p.position)));
    // The browser gets Gode's media proxy link, after the answer was stored with the fal URL.
    assert.deepEqual(all(r, "media"), [{ type: "image", url: `/api/media/${done.message_id}/0`, mime: "image/png" }]);
    const submit = up.find("/fal/alibaba/qwen-image-3/text-to-image").find((q) => q.method === "POST");
    assert.equal(submit.headers.authorization, "Key fal-test-integration");
    assert.equal(submit.body.prompt, "Draw a picture of a red fox in the snow");
    const model = t.deps.picker.candidates({ job: "image", user: { plan: "balanced" }, private: false }).find((m) => m.id === QWEN_IMAGE);
    assert.equal(usdToMicros(done.api_cost_usd), usdToMicros(model.price_per_unit) + 420);
    // The chip's cost, at 3 significant digits ($0.0525: the image plus the classifier's read).
    assert.equal(done.chip, `Qwen Image 3 · ${formatCost(t.deps.credits.priceFor(usdToMicros(model.price_per_unit) + 420) / 1e6)}`);
    assert.match(done.chip, / · \$0\.\d{4}$/);
    assertBooksBalanced(db);
  });

  test("a client disconnect mid-stream closes the upstream request; what streamed is charged", async () => {
    up.reset();
    up.setScenario("chat_slow"); // 40 deltas, 40 ms apart
    const before = balanceMicros(db, me.user.id);
    const ac = new AbortController();
    let requestId = null;
    const r = await me.c.sse(
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
    assert.equal(r.aborted, true);
    await waitFor(() => t.app.locals.activeStreams() === 0);
    await waitFor(() => streamed().at(-1)?.closedEarly);
    const upstream = streamed().at(-1);
    assert.equal(upstream.closedEarly, true, "OpenRouter's stream was cut off, not read to the end");
    const row = await waitFor(() => requestRow(db, requestId));
    assert.equal(row.status, "stopped");
    // OpenRouter reports usage only at the end of a stream, so the charge is estimated from the
    // input sent and the text streamed, plus the classifier call (420 micros), with the margin.
    assert.ok(row.api_cost_micros > 420 && row.output_tokens > 0, `api_cost_micros ${row.api_cost_micros}`);
    assert.equal(row.charged_micros, t.deps.credits.priceFor(row.api_cost_micros));
    assert.equal(balanceMicros(db, me.user.id), before - row.charged_micros);
    assertBooksBalanced(db);
  });

  test("an upstream failure is a clean SSE error; the hold is released", async () => {
    up.reset();
    up.setScenario("chat_quota"); // OpenAI-style 429 insufficient_quota, also for the classifier call
    const before = balanceMicros(db, me.user.id);
    const r = await me.c.sse("/api/chat", { text: "Say hello in five words." });
    assert.deepEqual(names(r).slice(-1), ["error"]);
    const err = first(r, "error");
    assert.equal(err.code, "upstream_error");
    assert.match(err.error, /^openrouter: /);
    assert.ok(!/sk-or-test/.test(JSON.stringify(r.events)), "no key in what the user sees");
    const row = requestRow(db, err.request_id);
    assert.equal(row.status, "error");
    assert.equal(row.error_code, "upstream_error");
    assert.equal(row.classifier_model, "heuristic", "the classifier fell back when its call failed");
    assert.equal(balanceMicros(db, me.user.id), before);
    assertBooksBalanced(db);
  });
});
