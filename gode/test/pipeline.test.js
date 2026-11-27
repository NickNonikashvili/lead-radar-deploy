"use strict";
// Chat pipeline: real catalog, keyring, redactor, classifier, picker, credits and providers on an
// in-memory DB. Mock mode (GODE_MOCK=1) for most scenarios, through a thin recorder around the real
// mock provider; test/helpers/mock-upstream.js with GODE_MOCK=0 for the real OpenRouter,
// self-hosted and fal adapters. Every scenario ends by checking the ledger invariant, that no hold
// is left behind, and that the personal details never reached the database or the logs in plaintext.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { seedCatalog, getModel } = require("../src/seed/catalog");
const { createKeyring, sha256 } = require("../src/crypto");
const { createRedactor } = require("../src/redact");
const { createProviders } = require("../src/providers");
const { createMockProvider } = require("../src/providers/mock");
const { createClassifier } = require("../src/router/classify");
const { createPicker } = require("../src/router/pick");
const { createCredits } = require("../src/billing/credits");
const { createAuth } = require("../src/auth");
const { AppError, usdToMicros } = require("../src/util");
const {
  createPipeline,
  formatChip,
  formatCost,
  chipFor,
  sessionIdFor,
  buildSystemPrompt,
  historyContent,
  estimateMediaUnits,
  expectedOutputTokens,
  providerCostMicros,
  PLACEHOLDER_NOTE,
} = require("../src/chat/pipeline");
const { startMockUpstream } = require("./helpers/mock-upstream");

// ---------------------------------------------------------------------------------------------
// fixtures

const NAME = "Ada Lovelace";
const EMAIL = "ada@example.com";
const PII_TEXT = `Hi, my name is ${NAME} and my email is ${EMAIL}. Please draft a short reply to my landlord.`;
// Lower-cased needles for the plaintext scans ("ada" alone is too short to search for).
const NEEDLES = ["ada lovelace", "lovelace", "ada@example.com"];
const TODAY = () => new Date().toISOString().slice(0, 10);

const SONNET = "openrouter:anthropic/claude-sonnet-5.5";
const HAIKU = "openrouter:anthropic/claude-haiku-5.5";
const DEEPSEEK = "openrouter:deepseek/deepseek-v4.1-flash";
const SELF_QWEN = "selfhosted:qwen3.8-27b";

function collectingLogger() {
  const lines = [];
  const push = (...args) => lines.push(args.map(String).join(" "));
  return { lines, info: push, warn: push, error: push, log: push };
}

/**
 * Wraps the real mock provider (mock mode serves every gateway through it) to record calls and to
 * script failures or exact outputs for one call.
 */
function recordingMock(config) {
  const base = createMockProvider(config);
  const ctl = { chatCalls: [], jsonCalls: [], mediaCalls: [], failNext: false, script: null, usageOnAbort: false };
  const usage = { type: "usage", inputTokens: 100, outputTokens: 20, reasoningTokens: 0, costUsd: null, upstreamProvider: "mock" };
  const provider = {
    ...base,
    async *streamChat(args) {
      ctl.chatCalls.push(args);
      if (ctl.failNext) {
        ctl.failNext = false;
        throw new AppError(502, "upstream_error", "mock: simulated upstream failure");
      }
      if (!ctl.script) {
        yield* base.streamChat(args);
        return;
      }
      const script = ctl.script;
      ctl.script = null;
      for (const text of script) {
        await new Promise((resolve) => setImmediate(resolve));
        if (args.signal?.aborted) {
          // A provider that reports the tokens it already produced before giving up.
          if (ctl.usageOnAbort) yield usage;
          throw args.signal.reason;
        }
        yield { type: "delta", text };
      }
      yield usage;
    },
    async completeJSON(args) {
      ctl.jsonCalls.push(args);
      return base.completeJSON(args);
    },
    async generateMedia(args) {
      ctl.mediaCalls.push(args);
      return base.generateMedia(args);
    },
  };
  return { ctl, provider };
}

/**
 * @param {object} [env]
 * @param {{ classify?: Function, pick?: Function }} [wrap]  wrap(args, real) stand-ins for
 *   classifier.classify / picker.pick, to script a classification or record what was passed
 */
function setup(env = {}, wrap = {}) {
  const config = loadConfig({ GODE_MOCK: "1", ...env });
  const db = openDb(":memory:");
  seedCatalog(db);
  const keyring = createKeyring(crypto.randomBytes(32));
  const logger = collectingLogger();
  const recorder = config.mock ? recordingMock(config) : null;
  const redactor = createRedactor(config, { logger });
  const providers = createProviders(config, recorder ? { providers: { mock: recorder.provider } } : {});
  const realClassifier = createClassifier({ config, db, providers, redactor, logger });
  const realPicker = createPicker({ db, config, providers });
  const calls = { classify: [], pick: [] };
  const classifier = {
    ...realClassifier,
    classify: (args) => {
      calls.classify.push(args);
      return wrap.classify ? wrap.classify(args, realClassifier.classify) : realClassifier.classify(args);
    },
  };
  const picker = {
    ...realPicker,
    pick: (args) => {
      calls.pick.push(args);
      return wrap.pick ? wrap.pick(args, realPicker.pick) : realPicker.pick(args);
    },
  };
  const credits = createCredits(db, config, { logger });
  const pipeline = createPipeline({ db, config, keyring, redactor, classifier, picker, providers, credits, logger });
  const h = { config, db, keyring, redactor, providers, classifier, picker, credits, pipeline, logger, calls, ctl: recorder?.ctl };
  h.user = (opts) => makeUser(h, opts);
  h.turn = (args) => runTurn(h, args);
  return h;
}

function makeUser(h, { balanceUsd = 1, plan = "balanced", strict = false, euOnly = false } = {}) {
  const id = crypto.randomUUID();
  h.db
    .prepare(
      `INSERT INTO users (id, email, password_hash, wrapped_dek, plan, strict_privacy, eu_only, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, `owner-${id.slice(0, 8)}@test.invalid`, "scrypt$unused", h.keyring.newWrappedDek(), plan, strict ? 1 : 0, euOnly ? 1 : 0, Date.now());
  if (balanceUsd > 0) h.credits.grant(id, usdToMicros(balanceUsd), "dev_topup");
  return h.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

async function runTurn(h, { onEvent, ...args }) {
  const events = [];
  await h.pipeline.run({
    ...args,
    emit: (event, data) => {
      events.push({ event, data });
      if (onEvent) onEvent(event, data);
    },
  });
  const of = (name) => events.filter((e) => e.event === name).map((e) => e.data);
  const text = of("delta").map((d) => d.text).join("");
  return {
    events,
    names: events.map((e) => e.event),
    of,
    route: of("route")[0],
    done: of("done")[0],
    error: of("error")[0],
    replace: of("replace")[0],
    text,
    finalText: of("replace")[0]?.text ?? text,
  };
}

/** Exactly one terminal event, last; done means no error and the reverse. */
function assertTerminal(r, kind) {
  const terminals = r.names.filter((n) => n === "done" || n === "error");
  assert.deepEqual(terminals, [kind], `terminal events: ${r.names.join(",")}`);
  assert.equal(r.names[r.names.length - 1], kind);
}

function balance(h, userId) {
  return h.db.prepare("SELECT balance_micros FROM users WHERE id = ?").get(userId).balance_micros;
}

function messages(h, conversationId, { all = false } = {}) {
  const rows = h.db
    .prepare(
      `SELECT m.*, u.wrapped_dek FROM messages m JOIN users u ON u.id = m.user_id
        WHERE conversation_id = ? ${all ? "" : "AND superseded = 0"} ORDER BY m.created_at, m.rowid`
    )
    .all(conversationId);
  return rows.map((r) => ({ ...r, content: h.keyring.decrypt(r.wrapped_dek, r.content_enc, { json: true }) }));
}

function requestRow(h, id) {
  return h.db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
}

function count(h, table, where = "1 = 1", ...params) {
  return h.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...params).n;
}

/** The ledger invariant, and no credit hold left behind by any path. */
function assertLedger(h) {
  for (const u of h.db.prepare("SELECT id, balance_micros FROM users").all()) {
    const sum = h.db.prepare("SELECT COALESCE(SUM(delta_micros), 0) AS s FROM ledger WHERE user_id = ?").get(u.id).s;
    assert.equal(u.balance_micros, sum, "users.balance_micros == SUM(ledger.delta_micros)");
  }
  assert.equal(count(h, "holds"), 0, "no credit hold left behind");
}

/** Every column of every row that holds user data, plus the server logs, are free of plaintext PII. */
function assertNoPlaintext(h) {
  for (const table of ["users", "sessions", "conversations", "messages", "requests", "ledger", "holds"]) {
    for (const row of h.db.prepare(`SELECT * FROM ${table}`).all()) {
      for (const [col, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        const s = String(value).toLowerCase();
        for (const n of NEEDLES) assert.ok(!s.includes(n), `${table}.${col} holds plaintext "${n}"`);
      }
    }
  }
  const logs = h.logger.lines.join("\n").toLowerCase();
  for (const n of NEEDLES) assert.ok(!logs.includes(n), `server log holds plaintext "${n}"`);
}

function checkInvariants(h) {
  assertLedger(h);
  assertNoPlaintext(h);
}

const containsPII = (s) => {
  const t = String(s).toLowerCase();
  return NEEDLES.some((n) => t.includes(n));
};

// ---------------------------------------------------------------------------------------------
// mock upstream (GODE_MOCK=0 scenarios)

let up;
before(async () => {
  up = await startMockUpstream();
});
after(async () => {
  await up?.close();
});

function upstreamEnv(extra = {}) {
  return { ...up.env, GODE_MOCK: "0", ...extra };
}

const chatStreams = () => up.find("/chat/completions").filter((r) => r.body?.stream === true);
const jsonCalls = () => up.find("/chat/completions").filter((r) => r.body?.stream === false);

// ---------------------------------------------------------------------------------------------
// pure helpers

test("formatChip and formatCost follow the chip rules", () => {
  assert.equal(formatChip("Claude Opus 5.5", "high", 0.04), "Claude Opus 5.5 · high effort · $0.04");
  assert.equal(formatChip("DeepSeek V4.1 Flash", "none", 0.0031), "DeepSeek V4.1 Flash · no thinking · $0.0031");
  assert.equal(formatChip("Mistral Large 4", "low", 1.2), "Mistral Large 4 · low effort · $1.20");
  assert.equal(formatChip("FLUX.3 Klein", null, 0.0117), "FLUX.3 Klein · $0.01");
  assert.equal(formatChip("FLUX.3 Klein", null, 0.0047), "FLUX.3 Klein · $0.0047");

  assert.equal(formatCost(0), "$0.00");
  assert.equal(formatCost(0.00004), "<$0.0001");
  assert.equal(formatCost(0.0001), "$0.0001");
  assert.equal(formatCost(0.003), "$0.003");
  assert.equal(formatCost(0.0031), "$0.0031");
  assert.equal(formatCost(0.00314), "$0.0031");
  assert.equal(formatCost(0.00996), "$0.01"); // rounds up into the 2-decimal range
  assert.equal(formatCost(0.045), "$0.05"); // no binary float surprise (0.045 * 100 = 4.4999...)
  assert.equal(formatCost(12.5), "$12.50");

  assert.equal(chipFor({ label: "Qwen Image 3", job: "image", effort: "none", costUsd: 0.052 }), "Qwen Image 3 · $0.05");
  assert.equal(chipFor({ label: "Claude", job: "action", effort: "medium", costUsd: 0.02 }), "Claude · medium effort · $0.02");
});

test("helpers: session id, system prompt, history text, media units, costs", () => {
  const id = crypto.randomUUID();
  assert.match(sessionIdFor(id), /^[0-9a-f]{32}$/);
  assert.equal(sessionIdFor(id), sha256(`gode-session:${id}`).slice(0, 32));
  assert.notEqual(sessionIdFor(id), sessionIdFor(crypto.randomUUID()));

  const plain = buildSystemPrompt({ date: "2026-11-26" });
  assert.match(plain, /2026-11-26 \(UTC\)/);
  assert.ok(!plain.includes("placeholder"));
  assert.ok(buildSystemPrompt({ date: "2026-11-26", placeholders: true }).includes(PLACEHOLDER_NOTE));
  assert.match(buildSystemPrompt({ date: "2026-11-26", action: true }), /cannot act in other apps/);

  assert.equal(historyContent({ text: "hello" }), "hello");
  assert.equal(historyContent({ text: "", media: [{ type: "image", url: "x" }] }), "[generated image]");
  assert.equal(historyContent({ text: "A fox", media: [{ type: "video", url: "x" }] }), "[generated video] A fox");

  const m = (id) => getModel(seededDb, id);
  assert.equal(estimateMediaUnits(m("fal:fal-ai/veo3.1/lite"), "x"), 4); // "4s"
  assert.equal(estimateMediaUnits(m("fal:elevenlabs/music/v2.5"), "x"), 1); // 30 000 ms -> 1 minute
  assert.equal(estimateMediaUnits(m("fal:elevenlabs/tts/eleven-v4"), "a".repeat(1500)), 1.5);
  assert.equal(estimateMediaUnits(m("fal:alibaba/qwen-image-3/text-to-image"), "x"), 1);
  assert.equal(estimateMediaUnits(m("fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan"), "x"), 1); // per request

  assert.equal(expectedOutputTokens("short", "none", 4096), 300);
  assert.equal(expectedOutputTokens("long", "high", 4096), 4096); // capped at MAX_OUTPUT_TOKENS

  const deepseek = m(DEEPSEEK);
  assert.deepEqual(providerCostMicros(deepseek, { usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.00042 } }), { micros: 420, unpriced: false });
  // 1000 x $0.0507 + 500 x $0.2028 per 1M tokens = 50.7 + 101.4 -> 153 micro-USD (rounded up)
  assert.equal(providerCostMicros(deepseek, { usage: { inputTokens: 1000, outputTokens: 500, costUsd: null } }).micros, 153);
  assert.equal(providerCostMicros(m("fal:alibaba/qwen-image-3/text-to-image"), { media: { units: 2, costUsd: null } }).micros, 80_000);
  assert.equal(providerCostMicros({ id: "x", price_in: null, price_out: null }, { usage: { inputTokens: 5, outputTokens: 5 } }).unpriced, true);
});

const seededDb = (() => {
  const db = openDb(":memory:");
  seedCatalog(db);
  return db;
})();

// ---------------------------------------------------------------------------------------------
// text: redaction, restoration, response filter (real OpenRouter adapter)

test("auto text via OpenRouter: PII redacted upstream, restored in deltas, replace and storage", async () => {
  up.reset();
  up.setScenario({
    chat: {
      // Placeholders split across chunks, plus a card number that is not the user's.
      deltas: ["Dear [PER", "SON_1], I", " will write to [EMA", "IL_1", "] today. Card on file: 5425 2334 3010 9903", "."],
      content: { job: "chat", difficulty: 2, private: false, output: { length: "short", format: "text" }, title: "Reply for [PERSON_1]" },
    },
  });
  const h = setup(upstreamEnv({ OPENROUTER_API_KEY: "sk-or-test" }));
  const user = h.user();
  const before = balance(h, user.id);

  const r = await h.turn({ user, text: PII_TEXT });
  assertTerminal(r, "done");
  assert.equal(r.names[0], "route");
  const convId = r.route.conversation_id;

  // route event
  assert.equal(r.route.job, "chat");
  assert.equal(r.route.model.id, DEEPSEEK);
  assert.equal(r.route.tier, "budget");
  assert.equal(r.route.private, false);
  assert.equal(r.route.zdr, false);
  assert.equal(r.route.effort, "low");
  assert.deepEqual(r.route.redactions, { PERSON: 1, EMAIL: 1 });
  assert.equal(r.route.title, `Reply for ${NAME}`);
  assert.ok(r.route.est_cost_usd > 0);
  for (const k of ["request_id", "user_message_id", "message_id"]) assert.match(r.route[k], /^[0-9a-f-]{36}$/);

  // deltas: restored, never a placeholder or a piece of one
  const expected = `Dear ${NAME}, I will write to ${EMAIL} today. Card on file: 5425 2334 3010 9903.`;
  assert.equal(r.text, expected);
  for (const d of r.of("delta")) assert.ok(!/\[|PERSON|EMAIL/.test(d.text), `delta leaked a placeholder: ${d.text}`);
  // response filter: the foreign card is masked, the restored values stay
  assert.equal(r.replace.text, `Dear ${NAME}, I will write to ${EMAIL} today. Card on file: [redacted CARD].`);

  // upstream: nothing personal left Gode, in any request
  assert.equal(up.requests.length, 2);
  for (const req of up.requests) assert.ok(!containsPII(req.rawBody), `upstream ${req.path} received plaintext PII`);
  const [chat] = chatStreams();
  const [cls] = jsonCalls();
  assert.equal(chat.body.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(chat.body.session_id, sessionIdFor(convId));
  assert.equal(chat.body.user, undefined);
  assert.equal(chat.body.max_completion_tokens, h.config.router.maxOutputTokens);
  assert.equal(chat.body.messages[0].role, "system");
  assert.ok(chat.body.messages[0].content.includes(TODAY()));
  assert.ok(chat.body.messages[0].content.includes(PLACEHOLDER_NOTE));
  const lastUser = chat.body.messages[chat.body.messages.length - 1];
  assert.equal(lastUser.content, "Hi, my name is [PERSON_1] and my email is [EMAIL_1]. Please draft a short reply to my landlord.");
  assert.match(JSON.parse(cls.body.messages[1].content).text, /\[PERSON_1\].*\[EMAIL_1\]/);

  // storage: encrypted, real values, filtered answer, restored title
  const stored = messages(h, convId);
  assert.deepEqual(stored.map((m) => m.role), ["user", "assistant"]);
  assert.equal(stored[0].content.text, PII_TEXT);
  assert.equal(stored[1].content.text, r.replace.text);
  assert.equal(stored[1].parent_id, stored[0].id);
  assert.equal(stored[1].request_id, r.route.request_id);
  const conv = h.db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  assert.equal(h.keyring.decrypt(user.wrapped_dek, conv.title_enc), `Reply for ${NAME}`);
  assert.deepEqual(JSON.parse(conv.pins).chat, { model_id: DEEPSEEK, tier: "budget", source: "auto" });
  const map = h.keyring.decrypt(user.wrapped_dek, conv.pii_map_enc, { json: true });
  assert.equal(map.byPlaceholder["[PERSON_1]"], NAME);

  // billing: provider-reported cost (answer 420 + classifier 420 micros), plus the 30% margin
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "ok");
  assert.equal(row.kind, "auto");
  assert.equal(row.message_id, r.done.message_id);
  assert.equal(row.api_cost_micros, 840);
  assert.equal(row.charged_micros, 1092);
  assert.equal(row.upstream_provider, "MockProvider");
  assert.equal(row.classifier_model, DEEPSEEK);
  assert.deepEqual([row.input_tokens, row.output_tokens, row.reasoning_tokens], [12, 9, 3]);
  assert.deepEqual(JSON.parse(row.redactions), { PERSON: 1, EMAIL: 1 });
  assert.equal(balance(h, user.id), before - 1092);
  assert.equal(r.done.cost_usd, 0.001092);
  assert.equal(r.done.api_cost_usd, 0.00084);
  assert.equal(r.done.balance_usd, (before - 1092) / 1e6);
  assert.equal(r.done.chip, "DeepSeek V4.1 Flash · low effort · $0.0011");
  checkInvariants(h);
});

test("a later turn re-redacts history with the stored map: same placeholders, nothing plain upstream", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: PII_TEXT });
  assertTerminal(r1, "done");
  // The mock echoes the (redacted) prompt: restoration shows the real values to the user.
  assert.ok(r1.text.includes(NAME) && r1.text.includes(EMAIL));
  assert.equal(r1.route.title, `Hi my name is ${NAME}`);
  const convId = r1.route.conversation_id;

  const r2 = await h.turn({ user, conversationId: convId, text: `Thanks. Write to ${EMAIL} again tomorrow, please.` });
  assertTerminal(r2, "done");
  assert.equal(r2.route.title, undefined, "the title is only set on the first exchange");
  assert.deepEqual(r2.route.redactions, { EMAIL: 1 }, "counts cover the new text only");

  const call = h.ctl.chatCalls[1];
  assert.deepEqual(call.messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
  for (const m of call.messages) assert.ok(!containsPII(m.content), `upstream message holds PII: ${m.role}`);
  assert.ok(call.messages[1].content.includes("[PERSON_1]") && call.messages[1].content.includes("[EMAIL_1]"));
  assert.ok(call.messages[2].content.includes("[PERSON_1]"), "the restored answer is redacted again");
  assert.equal(call.messages[3].content, "Thanks. Write to [EMAIL_1] again tomorrow, please.");
  assert.equal(call.sessionId, sessionIdFor(convId));
  assert.equal(call.zdr, false);
  // Classifier context: the redacted latest text plus up to 4 earlier redacted messages.
  const envelope = JSON.parse(h.ctl.jsonCalls[1].user);
  assert.equal(envelope.text, "Thanks. Write to [EMAIL_1] again tomorrow, please.");
  assert.equal(envelope.history.length, 2);
  assert.ok(!containsPII(h.ctl.jsonCalls[1].user));

  assert.deepEqual(messages(h, convId).map((m) => m.role), ["user", "assistant", "user", "assistant"]);
  checkInvariants(h);
});

test("response filter: high-risk data the model invents is masked with a replace event and stored masked", async () => {
  const h = setup();
  const user = h.user();
  h.ctl.script = ["Sure. An example ", "number: 078-05-", "1120", " (made up)."];
  const r = await h.turn({ user, text: "What does a US social security number look like?" });
  assertTerminal(r, "done");
  assert.equal(r.text, "Sure. An example number: 078-05-1120 (made up).");
  assert.equal(r.replace.text, "Sure. An example number: [redacted SSN] (made up).");
  assert.deepEqual(r.names.slice(-2), ["replace", "done"]);
  const [, answer] = messages(h, r.route.conversation_id);
  assert.equal(answer.content.text, "Sure. An example number: [redacted SSN] (made up).");
  checkInvariants(h);
});

test("history sent upstream is capped at HISTORY_MESSAGES", async () => {
  const h = setup({ HISTORY_MESSAGES: "2" });
  const user = h.user();
  const r1 = await h.turn({ user, text: "First question about tea." });
  const convId = r1.route.conversation_id;
  await h.turn({ user, conversationId: convId, text: "Second question about coffee." });
  await h.turn({ user, conversationId: convId, text: "Third question about cocoa." });
  const call = h.ctl.chatCalls[2];
  assert.deepEqual(call.messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
  assert.equal(call.messages[1].content, "Second question about coffee.");
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// media

test("media job (mock): progress and media events, a generic prompt, stored media, history marker", async () => {
  const h = setup();
  const user = h.user();
  const r = await h.turn({ user, text: `Draw a poster that says ${EMAIL} in big letters` });
  assertTerminal(r, "done");
  assert.equal(r.route.job, "image");
  assert.equal(r.route.model.id, "fal:alibaba/qwen-image-3/text-to-image");
  assert.equal(r.route.effort, "none");
  assert.deepEqual(r.route.redactions, { EMAIL: 1 });
  assert.deepEqual(r.of("progress"), [{ status: "queued", position: 0 }, { status: "running" }]);
  const media = r.of("media");
  assert.equal(media.length, 1);
  assert.equal(media[0].type, "image");
  assert.equal(media[0].mime, "image/svg+xml");
  assert.deepEqual(r.of("delta"), []);

  const call = h.ctl.mediaCalls[0];
  assert.equal(call.prompt, "Draw a poster that says an email address in big letters");
  assert.equal(call.job, "image");
  assert.deepEqual(call.params, { aspect: "1:1" });
  const svg = Buffer.from(media[0].url.split(",")[1], "base64").toString("utf8");
  assert.ok(!containsPII(svg));

  const [question, answer] = messages(h, r.route.conversation_id);
  assert.equal(question.content.text, `Draw a poster that says ${EMAIL} in big letters`);
  assert.deepEqual(answer.content, { text: "", media });
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.media_units, 1);
  assert.equal(row.input_tokens, null);
  assert.equal(r.done.media_units, 1);
  assert.equal(r.done.input_tokens, null);
  assert.ok(!r.done.chip.includes("thinking"));
  // 1 image x $0.04 + the classifier, then the margin
  assert.ok(row.api_cost_micros >= 40_000 && row.charged_micros === h.credits.priceFor(row.api_cost_micros));

  // The next text turn sees the image as a short marker, not a data URL.
  const r2 = await h.turn({ user, conversationId: r.route.conversation_id, text: "Nice. Now describe it in one line." });
  assertTerminal(r2, "done");
  const history = h.ctl.chatCalls[0].messages;
  assert.equal(history[2].role, "assistant");
  assert.equal(history[2].content, "[generated image]");
  checkInvariants(h);
});

test("media job via the real fal adapter: queue progress, aspect, generic prompt, unit pricing", async () => {
  up.reset();
  // FAL_KEY only: the classifier models are unavailable, so the heuristic classifier runs.
  const h = setup(upstreamEnv({ FAL_KEY: "fal-test-key" }));
  const user = h.user();
  const before = balance(h, user.id);
  const r = await h.turn({ user, text: `Draw a landscape picture of a red fox holding a sign that says ${EMAIL}` });
  assertTerminal(r, "done");
  assert.equal(r.route.job, "image");
  assert.equal(r.route.model.id, "fal:alibaba/qwen-image-3/text-to-image");
  assert.deepEqual(r.of("progress"), [{ status: "queued", position: 1 }, { status: "queued", position: 0 }, { status: "running" }]);
  // fal.media links go to the browser through Gode's media proxy; the message keeps the real URL.
  assert.deepEqual(r.of("media"), [{ type: "image", url: `/api/media/${r.done.message_id}/0`, mime: "image/png" }]);

  const submit = up.find("/fal/").find((req) => req.method === "POST");
  assert.equal(submit.path, "/fal/alibaba/qwen-image-3/text-to-image");
  assert.equal(submit.headers.authorization, "Key fal-test-key");
  assert.equal(submit.headers["x-fal-store-io"], "0");
  assert.deepEqual(submit.body, {
    image_size: "landscape_16_9", // classifier aspect 16:9 -> fal preset
    num_images: 1,
    prompt: "Draw a landscape picture of a red fox holding a sign that says an email address",
  });
  for (const req of up.requests) assert.ok(!containsPII(req.rawBody), `upstream ${req.path} received plaintext PII`);

  const row = requestRow(h, r.route.request_id);
  assert.equal(row.gateway, "fal");
  assert.equal(row.classifier_model, "heuristic");
  assert.equal(row.media_units, 1);
  assert.equal(row.api_cost_micros, 40_000); // 1 image x $0.04, no classifier cost
  assert.equal(row.charged_micros, 52_000);
  assert.equal(r.done.cost_usd, 0.052);
  assert.equal(r.done.chip, "Qwen Image 3 · $0.05");
  assert.equal(balance(h, user.id), before - 52_000);
  const [, answer] = messages(h, r.route.conversation_id);
  assert.deepEqual(answer.content.media, [{ type: "image", url: "https://v3.fal.media/files/mock/image.png", mime: "image/png" }]);
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// credits

test("insufficient credits: refused before classification, no ghost conversation, nothing billed", async () => {
  const h = setup();
  const broke = h.user({ balanceUsd: 0 });
  const r = await h.turn({ user: broke, text: PII_TEXT });
  assertTerminal(r, "error");
  assert.deepEqual(r.names, ["error"]);
  assert.equal(r.error.code, "insufficient_credits");
  assert.equal(r.error.conversation_id, undefined);
  assert.equal(h.ctl.jsonCalls.length, 0, "no classifier call for a user who can't pay");
  assert.equal(count(h, "conversations"), 0);
  assert.equal(count(h, "requests"), 0);

  // Same in an existing conversation: it is kept and named in the error, no question is stored.
  const user = h.user();
  const first = await h.turn({ user, text: "Hello there, a quick question about tea." });
  h.credits.grant(user.id, -balance(h, user.id), "admin_adjust");
  const r2 = await h.turn({ user, conversationId: first.route.conversation_id, text: "And about coffee?" });
  assertTerminal(r2, "error");
  assert.equal(r2.error.code, "insufficient_credits");
  assert.equal(r2.error.conversation_id, first.route.conversation_id);
  assert.equal(messages(h, first.route.conversation_id).length, 2);
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// privacy routing

test("private request goes to self-hosted with unredacted text (REDACT_SELF_HOSTED off); filter still runs", async () => {
  up.reset();
  up.setScenario({ chat: { deltas: [`Take care, ${NAME}. `, "Reference 078-05-1120."] } });
  const h = setup(upstreamEnv({ OPENROUTER_API_KEY: "sk-or-test", SELFHOSTED_BASE_URL: up.urls.selfhosted }));
  assert.equal(h.config.privacy.redactSelfHosted, false);
  const user = h.user();
  const text = `My name is ${NAME} and my diagnosis came back. Email me at ${EMAIL} with advice.`;
  const r = await h.turn({ user, text });
  assertTerminal(r, "done");
  assert.equal(r.route.private, true);
  assert.equal(r.route.tier, "private");
  assert.equal(r.route.model.id, SELF_QWEN);
  assert.equal(r.route.zdr, true);
  assert.deepEqual(r.route.redactions, {}, "nothing was hidden from the self-hosted model");

  // The classifier (an outside gateway) saw placeholders; the self-hosted model saw the real text.
  const [cls] = jsonCalls();
  assert.ok(!containsPII(cls.rawBody));
  const [self] = chatStreams();
  assert.equal(self.body.model, "qwen3.8-27b");
  assert.equal(self.body.messages[self.body.messages.length - 1].content, text);
  assert.ok(!self.body.messages[0].content.includes("placeholder"), "no placeholder note when none were sent");
  assert.equal(self.body.provider, undefined);

  assert.equal(r.replace.text, `Take care, ${NAME}. Reference [redacted SSN].`);
  const [, answer] = messages(h, r.route.conversation_id);
  assert.equal(answer.content.text, r.replace.text);
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.private, 1);
  assert.equal(row.zdr, 1);
  assert.equal(row.gateway, "selfhosted");
  assert.equal(row.redactions, "{}");

  // Sticky privacy: an innocent follow-up in the same conversation stays on the private tier.
  const r2 = await h.turn({ user, conversationId: r.route.conversation_id, text: "Thanks, what should I ask at the next visit?" });
  assertTerminal(r2, "done");
  assert.equal(r2.route.private, true);
  assert.equal(r2.route.model.id, SELF_QWEN);
  checkInvariants(h);
});

test("strict privacy: the classifier and the answering model both get zero-retention routing", async () => {
  up.reset();
  const h = setup(upstreamEnv({ OPENROUTER_API_KEY: "sk-or-test" }));
  const user = h.user({ strict: true });
  const r = await h.turn({ user, text: PII_TEXT });
  assertTerminal(r, "done");
  const zdr = { zdr: true, data_collection: "deny" };
  const [cls] = jsonCalls();
  const [chat] = chatStreams();
  assert.deepEqual(cls.body.provider, zdr);
  assert.deepEqual(chat.body.provider, zdr);
  assert.equal(r.route.zdr, true);
  assert.equal(getModel(h.db, r.route.model.id).zdr, true);
  assert.equal(requestRow(h, r.route.request_id).zdr, 1);
  for (const req of up.requests) assert.ok(!containsPII(req.rawBody));
  checkInvariants(h);
});

test("no ghost conversation: a new chat that fails after classification leaves no conversation behind", async () => {
  const h = setup();
  const user = h.user({ strict: true }); // no media model is zero-retention -> private_blocked
  const before = balance(h, user.id);
  const r = await h.turn({ user, text: `Draw a cat on a skateboard for ${EMAIL}` });
  assertTerminal(r, "error");
  assert.deepEqual(r.names, ["error"]);
  assert.equal(r.error.code, "private_blocked");
  assert.equal(r.error.conversation_id, undefined);
  assert.equal(count(h, "conversations"), 0);
  assert.equal(count(h, "messages"), 0);
  const [row] = h.db.prepare("SELECT * FROM requests").all();
  assert.equal(row.status, "error");
  assert.equal(row.error_code, "private_blocked");
  assert.equal(row.conversation_id, null);
  assert.equal(row.job, "image");
  assert.equal(row.charged_micros, 0);
  assert.equal(r.error.request_id, row.id);
  assert.equal(balance(h, user.id), before);
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// regenerate, switch, manual

test("regenerate: same job and pinned model, no re-classify, old answer superseded on success", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: PII_TEXT });
  const convId = r1.route.conversation_id;
  const classifierCalls = h.ctl.jsonCalls.length;

  const r = await h.turn({ user, mode: "regenerate", targetMessageId: r1.done.message_id });
  assertTerminal(r, "done");
  assert.equal(h.ctl.jsonCalls.length, classifierCalls, "no re-classification");
  assert.equal(r.route.replaces_message_id, r1.done.message_id);
  assert.equal(r.route.user_message_id, r1.route.user_message_id);
  assert.equal(r.route.conversation_id, convId);
  assert.equal(r.route.model.id, r1.route.model.id);
  assert.equal(r.route.pinned, true);
  assert.equal(r.route.job, r1.route.job);
  assert.equal(r.route.difficulty, r1.route.difficulty);
  assert.ok(r.text.includes(NAME), "the original question is answered again");

  const all = messages(h, convId, { all: true });
  assert.equal(all.filter((m) => m.role === "user").length, 1, "no new user message");
  const old = all.find((m) => m.id === r1.done.message_id);
  const fresh = all.find((m) => m.id === r.done.message_id);
  assert.equal(old.superseded, 1);
  assert.equal(fresh.superseded, 0);
  assert.equal(fresh.parent_id, r1.route.user_message_id);
  assert.equal(fresh.created_at, old.created_at, "the new answer takes the old one's place");
  assert.deepEqual(messages(h, convId).map((m) => m.id), [r1.route.user_message_id, r.done.message_id]);

  const oldReq = requestRow(h, r1.route.request_id);
  const newReq = requestRow(h, r.route.request_id);
  assert.equal(oldReq.regenerated, 1);
  assert.equal(newReq.kind, "regenerate");
  assert.equal(newReq.classifier_model, null);
  assert.deepEqual([newReq.job, newReq.difficulty, newReq.private], [oldReq.job, oldReq.difficulty, oldReq.private]);
  assert.equal(newReq.status, "ok");
  checkInvariants(h);
});

test("regenerate failure keeps the old answer visible, still records the regenerate signal, refunds", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: "Explain how tides work, briefly." });
  const convId = r1.route.conversation_id;
  const before = balance(h, user.id);

  h.ctl.failNext = true;
  const r = await h.turn({ user, mode: "regenerate", targetMessageId: r1.done.message_id });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "upstream_error");
  assert.equal(r.error.conversation_id, convId);
  assert.ok(r.names.includes("route"));
  assert.deepEqual(messages(h, convId).map((m) => m.id), [r1.route.user_message_id, r1.done.message_id]);
  assert.equal(count(h, "messages", "superseded = 1"), 0);
  assert.equal(requestRow(h, r1.route.request_id).regenerated, 1);
  const failed = requestRow(h, r.route.request_id);
  assert.equal(failed.kind, "regenerate");
  assert.equal(failed.status, "error");
  assert.equal(failed.error_code, "upstream_error");
  assert.equal(failed.message_id, null);
  assert.equal(balance(h, user.id), before);

  // Bad targets: a user message, someone else's answer, an answer already replaced.
  const asQuestion = await h.turn({ user, mode: "regenerate", targetMessageId: r1.route.user_message_id });
  assert.equal(asQuestion.error.code, "bad_request");
  const stranger = h.user();
  const notMine = await h.turn({ user: stranger, mode: "regenerate", targetMessageId: r1.done.message_id });
  assert.equal(notMine.error.code, "not_found");
  const ok = await h.turn({ user, mode: "regenerate", targetMessageId: r1.done.message_id });
  assertTerminal(ok, "done");
  const again = await h.turn({ user, mode: "regenerate", targetMessageId: r1.done.message_id });
  assert.equal(again.error.code, "conflict");
  checkInvariants(h);
});

test("regenerating an older answer uses only the history before it and keeps its position", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: "First question about tea." });
  const convId = r1.route.conversation_id;
  const r2 = await h.turn({ user, conversationId: convId, text: "Second question about coffee." });
  const r = await h.turn({ user, mode: "regenerate", targetMessageId: r1.done.message_id });
  assertTerminal(r, "done");
  const call = h.ctl.chatCalls[h.ctl.chatCalls.length - 1];
  assert.deepEqual(call.messages.map((m) => m.role), ["system", "user"]);
  assert.equal(call.messages[1].content, "First question about tea.");
  assert.deepEqual(
    messages(h, convId).map((m) => m.id),
    [r1.route.user_message_id, r.done.message_id, r2.route.user_message_id, r2.done.message_id]
  );
  checkInvariants(h);
});

test("switch: answers with the chosen model, pins it for the conversation, records overridden", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: "Explain how tides work, briefly." });
  const convId = r1.route.conversation_id;
  assert.equal(r1.route.model.id, DEEPSEEK);

  const r = await h.turn({ user, mode: "switch", modelId: SONNET, targetMessageId: r1.done.message_id });
  assertTerminal(r, "done");
  assert.equal(r.route.model.id, SONNET);
  assert.equal(r.route.pinned, true);
  assert.ok(r.text.startsWith("Claude Sonnet 5.5 (mock)"));
  assert.equal(requestRow(h, r1.route.request_id).overridden, 1);
  assert.equal(requestRow(h, r.route.request_id).kind, "switch");
  const pins = JSON.parse(h.db.prepare("SELECT pins FROM conversations WHERE id = ?").get(convId).pins);
  assert.equal(pins.chat.model_id, SONNET);
  assert.equal(pins.chat.source, "user");
  assert.deepEqual(messages(h, convId).map((m) => m.id), [r1.route.user_message_id, r.done.message_id]);

  // The user's pick sticks for the next message.
  const next = await h.turn({ user, conversationId: convId, text: "And why are there two a day?" });
  assertTerminal(next, "done");
  assert.equal(next.route.model.id, SONNET);
  assert.equal(next.route.pinned, true);

  // An ineligible target is refused and the current answer stays.
  const bad = await h.turn({ user, mode: "switch", modelId: "fal:alibaba/qwen-image-3/text-to-image", targetMessageId: next.done.message_id });
  assertTerminal(bad, "error");
  assert.equal(bad.error.code, "bad_request");
  assert.equal(messages(h, convId).length, 4);
  checkInvariants(h);
});

test("manual mode: the chosen model answers and is pinned; it must still be eligible", async () => {
  const h = setup();
  const user = h.user();
  const r = await h.turn({ user, mode: "manual", modelId: HAIKU, text: "Explain how tides work, briefly." });
  assertTerminal(r, "done");
  assert.equal(r.route.model.id, HAIKU);
  assert.equal(r.route.pinned, true);
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.kind, "manual");
  assert.equal(row.model_id, HAIKU);
  const pins = JSON.parse(h.db.prepare("SELECT pins FROM conversations WHERE id = ?").get(r.route.conversation_id).pins);
  assert.deepEqual(pins.chat, { model_id: HAIKU, tier: "budget", source: "user" });

  // A text model picked by hand answers a media-looking request as chat instead of failing.
  const draw = await h.turn({ user, mode: "manual", modelId: HAIKU, text: "Draw a cat on a skateboard" });
  assertTerminal(draw, "done");
  assert.equal(draw.route.job, "chat");
  assert.equal(draw.route.model.id, HAIKU);

  h.db.prepare("UPDATE models SET enabled = 0 WHERE id = ?").run(HAIKU);
  const disabled = await h.turn({ user, mode: "manual", modelId: HAIKU, text: "Explain how tides work, briefly." });
  assertTerminal(disabled, "error");
  assert.equal(disabled.error.code, "bad_request");
  assert.equal(disabled.error.conversation_id, undefined);
  const missing = await h.turn({ user, mode: "manual", text: "Hello" });
  assert.equal(missing.error.code, "bad_request");
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// aborts, retries, errors

test("stop mid-stream: the partial answer is stored as stopped and charged for what streamed", async () => {
  const h = setup();
  const user = h.user();
  const before = balance(h, user.id);
  const controller = new AbortController();
  h.ctl.script = ["Dear [PERSON_1], ", "thanks for ", "the note."];
  const r = await h.turn({
    user,
    text: PII_TEXT,
    signal: controller.signal,
    onEvent: (event) => {
      if (event === "delta") controller.abort();
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "aborted");
  assert.equal(r.error.stopped, true);
  assert.equal(r.of("delta").length, 1);
  const convId = r.route.conversation_id;
  assert.equal(r.error.conversation_id, convId);
  assert.equal(r.error.message_id, r.route.message_id);

  // What the user saw is kept, restored, and marked as stopped.
  const stored = messages(h, convId);
  assert.deepEqual(stored.map((m) => m.role), ["user", "assistant"]);
  assert.deepEqual(stored[1].content, { text: `Dear ${NAME}, `, stopped: true });
  assert.equal(stored[1].id, r.route.message_id);

  // Charged: estimated input + the streamed text at catalog prices (+ classifier), never above the hold.
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "stopped");
  assert.equal(row.error_code, null);
  assert.equal(row.message_id, r.route.message_id);
  assert.ok(row.input_tokens > 0 && row.output_tokens > 0, "estimated tokens recorded");
  assert.ok(row.charged_micros > 0);
  assert.equal(row.charged_micros, h.credits.priceFor(row.api_cost_micros));
  const [hold] = h.credits.ledger(user.id, { kinds: ["hold"] });
  assert.ok(row.charged_micros <= -hold.delta_micros, "capped at the hold");
  assert.equal(balance(h, user.id), before - row.charged_micros);
  assert.equal(r.error.cost_usd, row.charged_micros / 1e6);
  assert.equal(r.error.balance_usd, balance(h, user.id) / 1e6);

  // Re-sending the same text after a stopped answer is a new question (the old one was answered).
  const again = await h.turn({ user, conversationId: convId, text: PII_TEXT });
  assertTerminal(again, "done");
  assert.notEqual(again.route.user_message_id, r.route.user_message_id);
  checkInvariants(h);
});

test("stop before any delta: hold released, nothing stored, request logged as aborted", async () => {
  const h = setup();
  const user = h.user();
  const before = balance(h, user.id);
  const controller = new AbortController();
  h.ctl.script = ["One ", "two"];
  const r = await h.turn({
    user,
    text: "Count to two.",
    signal: controller.signal,
    onEvent: (event) => {
      if (event === "route") controller.abort();
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "aborted");
  assert.equal(r.error.stopped, undefined);
  assert.equal(r.of("delta").length, 0);
  assert.deepEqual(messages(h, r.route.conversation_id).map((m) => m.role), ["user"]);
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "error");
  assert.equal(row.error_code, "aborted");
  assert.equal(row.charged_micros, 0);
  assert.equal(balance(h, user.id), before);

  // Already aborted before anything happened: nothing at all is stored.
  const gone = new AbortController();
  gone.abort();
  const r2 = await h.turn({ user, text: "Hello again", signal: gone.signal });
  assert.deepEqual(r2.names, ["error"]);
  assert.equal(r2.error.code, "aborted");
  assert.equal(count(h, "conversations"), 1);
  checkInvariants(h);
});

test("stop after the provider reported usage: that usage is charged and the partial answer stored", async () => {
  const h = setup();
  const user = h.user();
  const before = balance(h, user.id);
  const controller = new AbortController();
  h.ctl.script = ["One ", "two ", "three"];
  h.ctl.usageOnAbort = true;
  const r = await h.turn({
    user,
    text: "Count to three.",
    signal: controller.signal,
    onEvent: (event) => {
      if (event === "delta") controller.abort();
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "aborted");
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "stopped");
  assert.deepEqual([row.input_tokens, row.output_tokens], [100, 20], "the provider's own usage");
  assert.ok(row.charged_micros > 0);
  assert.equal(row.charged_micros, h.credits.priceFor(row.api_cost_micros));
  assert.equal(balance(h, user.id), before - row.charged_micros);
  const stored = messages(h, r.route.conversation_id);
  assert.deepEqual(stored[1].content, { text: "One ", stopped: true });
  checkInvariants(h);
});

test("a server shutdown mid-stream is not charged; the estimated upstream cost is recorded", async () => {
  const h = setup();
  const user = h.user();
  const before = balance(h, user.id);
  const controller = new AbortController();
  h.ctl.script = ["Part one. ", "Part two."];
  const r = await h.turn({
    user,
    text: "Tell me two things.",
    signal: controller.signal,
    onEvent: (event) => {
      if (event === "delta") controller.abort(new DOMException("The server is shutting down.", "AbortError"));
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "interrupted");
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "error");
  assert.equal(row.error_code, "interrupted");
  assert.equal(row.charged_micros, 0);
  assert.ok(row.api_cost_micros > 0 && row.output_tokens > 0, "upstream spend is visible to the gate metrics");
  assert.equal(balance(h, user.id), before);
  assert.deepEqual(messages(h, r.route.conversation_id).map((m) => m.role), ["user"]);
  checkInvariants(h);
});

test("a stopped regenerate is charged but keeps the old answer", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: "Explain how tides work, briefly." });
  const convId = r1.route.conversation_id;
  const before = balance(h, user.id);
  const controller = new AbortController();
  h.ctl.script = ["Tides are ", "caused by the moon."];
  const r = await h.turn({
    user,
    mode: "regenerate",
    targetMessageId: r1.done.message_id,
    signal: controller.signal,
    onEvent: (event) => {
      if (event === "delta") controller.abort();
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.stopped, true);
  assert.equal(r.error.message_id, undefined, "nothing replaced the old answer");
  assert.deepEqual(messages(h, convId).map((m) => m.id), [r1.route.user_message_id, r1.done.message_id]);
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "stopped");
  assert.equal(row.message_id, null);
  assert.ok(row.charged_micros > 0);
  assert.equal(balance(h, user.id), before - row.charged_micros);
  checkInvariants(h);
});

test("retry dedupe: re-sending an unanswered question reuses it instead of storing a duplicate", async () => {
  const h = setup();
  const user = h.user();
  h.ctl.failNext = true;
  const failed = await h.turn({ user, text: PII_TEXT });
  assertTerminal(failed, "error");
  const convId = failed.error.conversation_id;
  assert.equal(convId, failed.route.conversation_id);
  assert.deepEqual(messages(h, convId).map((m) => m.role), ["user"]);

  const retry = await h.turn({ user, conversationId: convId, text: PII_TEXT });
  assertTerminal(retry, "done");
  assert.equal(retry.route.user_message_id, failed.route.user_message_id);
  assert.deepEqual(messages(h, convId).map((m) => m.role), ["user", "assistant"]);
  const call = h.ctl.chatCalls[1];
  assert.deepEqual(call.messages.map((m) => m.role), ["system", "user"], "no duplicate question upstream");

  // A different text after a failure is a new message; the unanswered one stays in the history.
  h.ctl.failNext = true;
  const lost = await h.turn({ user, conversationId: convId, text: "What about the deposit?" });
  assertTerminal(lost, "error");
  const other = await h.turn({ user, conversationId: convId, text: "Actually, what about the rent?" });
  assertTerminal(other, "done");
  assert.notEqual(other.route.user_message_id, lost.route.user_message_id);
  assert.deepEqual(messages(h, convId).map((m) => m.role), ["user", "assistant", "user", "user", "assistant"]);
  checkInvariants(h);
});

test("upstream error mid-stream (real OpenRouter adapter): safe error, refund, nothing stored", async () => {
  up.reset();
  up.setScenario("chat_midstream_error");
  const h = setup(upstreamEnv({ OPENROUTER_API_KEY: "sk-or-test" }));
  const user = h.user();
  const before = balance(h, user.id);
  const r = await h.turn({ user, text: PII_TEXT });
  assertTerminal(r, "error");
  assert.equal(r.text, "Hello");
  assert.equal(r.error.code, "upstream_error");
  assert.match(r.error.error, /^openrouter: /);
  assert.ok(!containsPII(r.error.error) && !r.error.error.includes("draft"));
  const convId = r.error.conversation_id;
  assert.deepEqual(messages(h, convId).map((m) => m.role), ["user"]);
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "error");
  assert.equal(row.error_code, "upstream_error");
  assert.equal(row.charged_micros, 0);
  // Not charged, but our upstream spend is recorded: the classifier's 420 micros plus an estimate
  // of the input sent and the text streamed before the error.
  assert.ok(row.api_cost_micros > 420, `api_cost_micros ${row.api_cost_micros}`);
  assert.ok(row.input_tokens > 0 && row.output_tokens > 0);
  assert.equal(balance(h, user.id), before);
  assert.ok(h.logger.lines.some((l) => l.includes(r.route.request_id) && l.includes("upstream_error")));
  checkInvariants(h);
});

test("mock upstream failure before any text: error after route, hold released", async () => {
  const h = setup();
  const user = h.user();
  const before = balance(h, user.id);
  const r = await h.turn({ user, text: "Please answer GODE_MOCK_FAIL now" });
  assertTerminal(r, "error");
  assert.deepEqual(r.names, ["route", "error"]);
  assert.equal(r.error.code, "upstream_error");
  assert.equal(balance(h, user.id), before);
  checkInvariants(h);
});

test("account deleted mid-answer: settle conflict tolerated, nothing stored, ledger intact", async () => {
  const h = setup();
  const auth = createAuth({ db: h.db, config: h.config, keyring: h.keyring, credits: h.credits });
  const user = h.user();
  const bystander = h.user();
  let deleted = false;
  const r = await h.turn({
    user,
    text: PII_TEXT,
    onEvent: (event) => {
      if (event === "delta" && !deleted) {
        deleted = true;
        auth.deleteEverything(user.id);
      }
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "not_found");
  assert.equal(r.error.conversation_id, undefined);
  for (const table of ["conversations", "messages", "requests", "holds"]) assert.equal(count(h, table), 0, table);
  assert.equal(count(h, "ledger", "user_id IS NULL"), 2, "grant + hold rows kept anonymously");
  assert.equal(balance(h, bystander.id), 1_000_000);
  checkInvariants(h);
});

test("input validation: empty text, unknown mode, someone else's conversation, missing user, bad emit", async () => {
  const h = setup();
  const user = h.user();
  assert.equal((await h.turn({ user, text: "   " })).error.code, "bad_request");
  assert.equal((await h.turn({ user, text: "Hi", mode: "bogus" })).error.code, "bad_request");
  const owner = h.user();
  const theirs = await h.turn({ user: owner, text: "Hello there, a question about tea." });
  const r = await h.turn({ user, conversationId: theirs.route.conversation_id, text: "Hi" });
  assert.equal(r.error.code, "not_found");
  assert.equal(r.error.conversation_id, undefined);
  assert.equal((await h.turn({ user: { id: "nope" }, text: "Hi" })).error.code, "unauthorized");
  await assert.rejects(() => h.pipeline.run({ user, text: "Hi" }), TypeError);
  assert.equal(count(h, "requests", "user_id = ?", user.id), 0);
  checkInvariants(h);
});

test("an unexpected internal error is reported generically and logged by name only", async () => {
  const h = setup();
  const user = h.user();
  const realPick = h.picker.pick;
  h.picker.pick = () => {
    throw new SyntaxError(`Unexpected token in ${PII_TEXT}`);
  };
  try {
    const r = await h.turn({ user, text: PII_TEXT });
    assertTerminal(r, "error");
    assert.deepEqual(r.error, { error: "Something went wrong.", code: "internal", request_id: r.error.request_id });
    assert.equal(requestRow(h, r.error.request_id).error_code, "internal");
    assert.ok(h.logger.lines.some((l) => l.includes("internal (SyntaxError)")));
  } finally {
    h.picker.pick = realPick;
  }
  checkInvariants(h);
});

test("REDACTION=off: real text goes upstream, no placeholder note, nothing reported hidden, storage still encrypted", async () => {
  const h = setup({ REDACTION: "off" });
  const user = h.user();
  const r = await h.turn({ user, text: PII_TEXT });
  assertTerminal(r, "done");
  assert.deepEqual(r.route.redactions, {});
  const call = h.ctl.chatCalls[0];
  assert.equal(call.messages[call.messages.length - 1].content, PII_TEXT);
  assert.ok(!call.messages[0].content.includes("placeholder"));
  assert.ok(r.text.includes(NAME));
  assert.equal(h.db.prepare("SELECT pii_map_enc FROM conversations").get().pii_map_enc, null);
  checkInvariants(h);
});

// ---------------------------------------------------------------------------------------------
// review fixes: sticky privacy, one turn per conversation, billing of failures, media requests,
// context trimming, titles, affordability, pins

const { durationFor } = require("../src/seed/catalog");
const VEO_LITE = "fal:fal-ai/veo3.1/lite";
const PRIVATE_TEXT = "My HIV diagnosis came back positive and my therapist wants me to tell my boss.";

/** Wrap the real classification: keep its usage/model, replace the decision fields. */
const scripted = (fields) => async (args, real) => ({ ...(await real(args)), ...fields });

const conversationRow = (h, id) => h.db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);

test("a private turn that fails or is stopped still makes the conversation private", async () => {
  const h = setup();
  const user = h.user();
  h.ctl.failNext = true;
  const failed = await h.turn({ user, text: PRIVATE_TEXT });
  assertTerminal(failed, "error");
  assert.equal(failed.route.private, true);
  const convId = failed.route.conversation_id;
  assert.equal(conversationRow(h, convId).private, 1, "set with the question, before the answer");

  const next = await h.turn({ user, conversationId: convId, text: "What's the capital of France?" });
  assertTerminal(next, "done");
  const cls = h.calls.classify.at(-1);
  const pick = h.calls.pick.at(-1);
  assert.equal(cls.conversationPrivate, true, "the classifier is told (it then stays local)");
  assert.equal(pick.conversationPrivate, true, "the picker is told");

  // Stopped after the first delta: same.
  const controller = new AbortController();
  h.ctl.script = ["I'm sorry ", "to hear that."];
  const stopped = await h.turn({
    user,
    text: PRIVATE_TEXT,
    signal: controller.signal,
    onEvent: (event) => event === "delta" && controller.abort(),
  });
  assert.equal(stopped.error.code, "aborted");
  assert.equal(conversationRow(h, stopped.route.conversation_id).private, 1);

  // A non-private chat stays non-private, and the flag is never cleared.
  const plain = await h.turn({ user, text: "What's the capital of Spain?" });
  assert.equal(conversationRow(h, plain.route.conversation_id).private, 0);
  assert.equal(h.calls.classify.at(-1).conversationPrivate, false);
  checkInvariants(h);
});

test("a private media turn makes the conversation private too", async () => {
  const h = setup({}, { classify: scripted({ job: "image", difficulty: 2, private: true, output: { length: "short", format: "image", aspect: "1:1" } }) });
  const user = h.user();
  const r = await h.turn({ user, text: "Make an image of my lab results printout on a desk" });
  assertTerminal(r, "done");
  assert.equal(r.route.private, true);
  assert.equal(conversationRow(h, r.route.conversation_id).private, 1);
  checkInvariants(h);
});

// The routing side of C1 (picker.pick honours conversationPrivate) lives in src/router/pick.js;
// this end-to-end check runs once that is in place.
const pickerHonoursConversationPrivate = (() => {
  const h = setup();
  try {
    return h.picker.pick({ job: "chat", difficulty: 1, private: false, conversationPrivate: true, user: h.user(), pins: {} }).private === true;
  } catch {
    return false;
  }
})();

test("after a failed private turn, an innocent follow-up is routed privately", { skip: !pickerHonoursConversationPrivate && "needs picker C1" }, async () => {
  const h = setup();
  const user = h.user();
  h.ctl.failNext = true;
  const failed = await h.turn({ user, text: PRIVATE_TEXT });
  const next = await h.turn({ user, conversationId: failed.route.conversation_id, text: "What's the capital of France?" });
  assertTerminal(next, "done");
  assert.equal(next.route.private, true);
  assert.equal(next.route.zdr, true);
  checkInvariants(h);
});

test("one turn at a time per conversation: a second one gets busy before any work", async () => {
  const h = setup();
  const user = h.user();
  const r1 = await h.turn({ user, text: "Explain how tides work, briefly." });
  const convId = r1.route.conversation_id;
  const classifierCalls = h.ctl.jsonCalls.length;

  let second = null;
  h.ctl.script = ["Waves ", "come and go."];
  const first = await h.turn({
    user,
    conversationId: convId,
    text: "And waves?",
    onEvent: (event) => {
      if (event === "delta" && !second) second = h.turn({ user, conversationId: convId, text: "And currents?" });
    },
  });
  assertTerminal(first, "done");
  const busy = await second;
  assert.deepEqual(busy.events, [{ event: "error", data: { error: "Wait for the current answer to finish.", code: "busy" } }]);
  assert.equal(h.ctl.jsonCalls.length, classifierCalls + 1, "the busy turn never reached the classifier");
  assert.equal(count(h, "requests", "conversation_id = ?", convId), 2, "no row for the busy turn");

  // Two regenerates of one answer: the second is refused before any upstream call.
  let regen2 = null;
  const chatCalls = h.ctl.chatCalls.length;
  h.ctl.script = ["Tides ", "again."];
  const regen1 = await h.turn({
    user,
    mode: "regenerate",
    targetMessageId: first.done.message_id,
    onEvent: (event) => {
      if (event === "delta" && !regen2) regen2 = h.turn({ user, mode: "regenerate", targetMessageId: first.done.message_id });
    },
  });
  assertTerminal(regen1, "done");
  assert.equal((await regen2).error.code, "busy");
  assert.equal(h.ctl.chatCalls.length, chatCalls + 1);
  // Free again afterwards.
  assertTerminal(await h.turn({ user, conversationId: convId, text: "Thanks!" }), "done");
  assert.deepEqual(h.pipeline.activeHoldIds(), []);
  checkInvariants(h);
});

test("an answer that finished but could not be stored (chat deleted mid-answer) is still charged", async () => {
  const h = setup();
  const user = h.user();
  const first = await h.turn({ user, text: "Explain how tides work, briefly." });
  const convId = first.route.conversation_id;
  const before = balance(h, user.id);
  let deleted = false;
  const r = await h.turn({
    user,
    conversationId: convId,
    text: "And why are there two a day?",
    onEvent: (event) => {
      if (event === "delta" && !deleted) {
        deleted = true;
        h.db.prepare("DELETE FROM conversations WHERE id = ?").run(convId);
      }
    },
  });
  assertTerminal(r, "error");
  assert.equal(r.error.code, "not_found");
  const row = requestRow(h, r.route.request_id);
  assert.equal(row.status, "error");
  assert.ok(row.api_cost_micros > 0 && row.output_tokens > 0);
  assert.ok(row.charged_micros > 0);
  assert.equal(r.error.cost_usd, row.charged_micros / 1e6, "the error says what was charged");
  assert.equal(row.charged_micros, h.credits.priceFor(row.api_cost_micros));
  assert.equal(balance(h, user.id), before - row.charged_micros);
  checkInvariants(h);
});

test("media: the classifier's media_prompt (genericized) and duration reach the model; the hold covers it", async () => {
  const mediaPrompt = "A red fox sitting in the snow at sunset, animated, with [PERSON_1] waving";
  let scriptNext = false;
  const h = setup({}, {
    classify: async (args, real) => {
      const c = await real(args);
      if (!scriptNext) return c;
      return { ...c, job: "video", difficulty: 2, private: false, output: { length: "short", format: "video", aspect: "16:9", duration_s: 20, media_prompt: mediaPrompt } };
    },
  });
  const user = h.user();
  const r1 = await h.turn({ user, text: PII_TEXT });
  scriptNext = true;
  const r = await h.turn({ user, conversationId: r1.route.conversation_id, text: "now make a 20 second video of it" });
  assertTerminal(r, "done");
  assert.equal(r.route.model.id, VEO_LITE);
  assert.deepEqual(r.route.redactions, { PERSON: 1 });

  const call = h.ctl.mediaCalls[0];
  assert.equal(call.prompt, "A red fox sitting in the snow at sunset, animated, with a person waving");
  assert.ok(!containsPII(call.prompt));
  const model = getModel(h.db, VEO_LITE);
  assert.equal(durationFor(model, 20), "8s", "20 s snaps to Veo's longest clip");
  assert.deepEqual(call.params, { aspect: "16:9", duration: "8s" });
  assert.equal(call.model.params.duration_options, undefined, "catalog-only keys never reach the adapter");

  // Hold: 8 s x $0.05 plus the classifier, with the margin.
  const row = requestRow(h, r.route.request_id);
  const classifierCost = row.api_cost_micros - 50_000; // the mock bills 1 unit
  const holds = h.credits.ledger(user.id, { kinds: ["hold"] });
  assert.equal(-holds[0].delta_micros, h.credits.priceFor(8 * 50_000 + classifierCost));
  assert.ok(!h.logger.lines.some((l) => l.includes("emit failed")));
  checkInvariants(h);
});

test("media events are sent only after the answer is stored", async () => {
  const h = setup();
  const user = h.user();
  let storedAtMedia = null;
  const r = await h.turn({
    user,
    text: "Draw a cat on a skateboard",
    onEvent: (event) => {
      if (event === "media") storedAtMedia = count(h, "messages", "role = 'assistant'") === 1 && count(h, "holds") === 0;
    },
  });
  assertTerminal(r, "done");
  assert.equal(storedAtMedia, true);
  checkInvariants(h);
});

test("history is trimmed to the model's context window, newest kept; a message too long alone is refused", async () => {
  const h = setup({ MAX_OUTPUT_TOKENS: "500" });
  h.db.prepare("UPDATE models SET context_length = 1500 WHERE id = ?").run(DEEPSEEK);
  const user = h.user();
  const para = (topic) => `${topic}: ${"tea and biscuits ".repeat(90)}`.trim(); // ~1,500 chars
  const r1 = await h.turn({ user, mode: "manual", modelId: DEEPSEEK, text: para("First") });
  const convId = r1.route.conversation_id;
  await h.turn({ user, conversationId: convId, mode: "manual", modelId: DEEPSEEK, text: para("Second") });
  const r3 = await h.turn({ user, conversationId: convId, mode: "manual", modelId: DEEPSEEK, text: para("Third") });
  assertTerminal(r3, "done");
  const call = h.ctl.chatCalls.at(-1);
  const sent = call.messages.map((m) => m.content).join("\n");
  const budget = Math.floor(1500 * 0.9) - 500;
  assert.ok(Math.ceil(sent.length / 4) <= budget + 20, `estimated ${Math.ceil(sent.length / 4)} tokens > budget ${budget}`);
  assert.equal(call.messages.at(-1).content, para("Third"), "the latest message is always sent");
  assert.ok(!sent.includes("First:"), "the oldest message was dropped");
  assert.equal(call.messages[1].role, "user", "the kept history starts on a user turn");

  const before = balance(h, user.id);
  const huge = await h.turn({ user, conversationId: convId, mode: "manual", modelId: DEEPSEEK, text: "x ".repeat(2000) });
  assertTerminal(huge, "error");
  assert.equal(huge.error.code, "bad_request");
  assert.match(huge.error.error, /too long for DeepSeek V4\.1 Flash/);
  assert.equal(balance(h, user.id), before);
  checkInvariants(h);
});

test("titles restore names but keep card numbers and other high-risk values masked", async () => {
  const h = setup({}, { classify: scripted({ title: "Card [CARD_1] for [PERSON_1]" }) });
  const user = h.user();
  const r = await h.turn({ user, text: `My name is ${NAME}. Card 4532 0151 1283 0366 was charged twice, what now?` });
  assertTerminal(r, "done");
  assert.equal(r.route.title, `Card •••• 0366 for ${NAME}`);
  const conv = conversationRow(h, r.route.conversation_id);
  assert.equal(h.keyring.decrypt(user.wrapped_dek, conv.title_enc), `Card •••• 0366 for ${NAME}`);
  checkInvariants(h);
});

test("a low balance gets a shorter answer instead of an overdraft; too low is refused; media needs its full price", async () => {
  const h = setup();
  const sonnet = getModel(h.db, SONNET);
  const user = h.user({ balanceUsd: 0.02 });
  const r = await h.turn({ user, mode: "manual", modelId: SONNET, text: "Explain how tides work, briefly." });
  assertTerminal(r, "done");
  const call = h.ctl.chatCalls.at(-1);
  assert.ok(call.maxTokens < h.config.router.maxOutputTokens && call.maxTokens >= h.config.billing.minAffordableOutputTokens, `maxTokens ${call.maxTokens}`);
  const [hold] = h.credits.ledger(user.id, { kinds: ["hold"] });
  assert.ok(-hold.delta_micros <= 20_000, "the hold fits the balance");
  assert.ok(balance(h, user.id) >= 0, "never below zero");
  assert.ok(sonnet.price_out > 0);

  const poor = h.user({ balanceUsd: 0.001 });
  const refused = await h.turn({ user: poor, mode: "manual", modelId: SONNET, text: "Explain how tides work, briefly." });
  assertTerminal(refused, "error");
  assert.equal(refused.error.code, "insufficient_credits");
  assert.match(refused.error.error, /too low for an answer from Claude Sonnet 5\.5/);
  assert.equal(refused.error.conversation_id, undefined, "nothing stored");
  assert.equal(balance(h, poor.id), 1000);

  const h2 = setup({}, { classify: scripted({ job: "video", difficulty: 2, private: false, output: { length: "short", format: "video", aspect: "16:9", duration_s: 4 } }) });
  const viewer = h2.user({ balanceUsd: 0.1 });
  const video = await h2.turn({ user: viewer, text: "Make a video of waves at sunset" });
  assertTerminal(video, "error");
  assert.equal(video.error.code, "insufficient_credits");
  assert.match(video.error.error, /^This costs about \$0\.26 and your balance is \$0\.10\./);
  assert.equal(h2.ctl.mediaCalls.length, 0);
  assert.equal(balance(h2, viewer.id), 100_000);
  checkInvariants(h);
  checkInvariants(h2);
});

test("an automatic pin never overwrites a user's pin stored while the turn ran", async () => {
  const h = setup();
  const user = h.user();
  const userPin = { model_id: SONNET, tier: "quality", source: "user" };
  let convId = null;
  const r = await h.turn({
    user,
    text: "Explain how tides work, briefly.",
    onEvent: (event, data) => {
      if (event === "route") convId = data.conversation_id;
      // Another process (or a tab on an older build) pins a model mid-answer.
      if (event === "delta" && convId) h.db.prepare("UPDATE conversations SET pins = ? WHERE id = ?").run(JSON.stringify({ chat: userPin }), convId);
    },
  });
  assertTerminal(r, "done");
  assert.deepEqual(JSON.parse(conversationRow(h, convId).pins).chat, userPin);
  checkInvariants(h);
});

test("redaction is skipped only on the selfhosted gateway, never for a mislabelled third-party model", async () => {
  const h = setup();
  // Bypass validation, as an old database row would.
  h.db.prepare("UPDATE models SET self_hosted = 1, region = 'self' WHERE id = ?").run(DEEPSEEK);
  const user = h.user();
  const r = await h.turn({ user, mode: "manual", modelId: DEEPSEEK, text: PII_TEXT });
  assertTerminal(r, "done");
  const call = h.ctl.chatCalls.at(-1);
  assert.ok(!call.messages.some((m) => containsPII(m.content)), "placeholders only");
  assert.deepEqual(r.route.redactions, { PERSON: 1, EMAIL: 1 });
  checkInvariants(h);
});

test("the classifier gets euOnly and conversationPrivate; running holds are reported for the sweep", async () => {
  const h = setup();
  const user = h.user({ euOnly: true });
  let during = null;
  const r = await h.turn({
    user,
    text: "Explain how tides work, briefly.",
    onEvent: (event) => {
      if (event === "delta" && !during) during = h.pipeline.activeHoldIds();
    },
  });
  assertTerminal(r, "done");
  assert.equal(h.calls.classify[0].euOnly, true);
  assert.equal(h.calls.classify[0].conversationPrivate, false);
  assert.equal(during.length, 1);
  assert.deepEqual(h.pipeline.activeHoldIds(), []);
  checkInvariants(h);
});

test("direct-OpenAI pricing: cached input at the cache rate, long prompts at the long-context rate", () => {
  const astra = getModel(seededDb, "openai:gpt-6.2-astra");
  // 10k uncached x $8 + 90k cached x $0.40 + 1k out x $40 per 1M tokens
  assert.equal(providerCostMicros(astra, { usage: { inputTokens: 100_000, cachedTokens: 90_000, outputTokens: 1000, costUsd: null } }).micros, 156_000);
  // Above 272K input tokens: $16 / $60
  assert.equal(providerCostMicros(astra, { usage: { inputTokens: 300_000, outputTokens: 1000, costUsd: null } }).micros, 300_000 * 16 + 1000 * 60);
  // A reported cost still wins; a model without params.pricing prices cached tokens at the input rate.
  assert.equal(providerCostMicros(astra, { usage: { inputTokens: 300_000, outputTokens: 1000, costUsd: 0.5 } }).micros, 500_000);
  const deepseek = getModel(seededDb, DEEPSEEK);
  assert.equal(
    providerCostMicros(deepseek, { usage: { inputTokens: 1000, cachedTokens: 900, outputTokens: 500, costUsd: null } }).micros,
    providerCostMicros(deepseek, { usage: { inputTokens: 1000, outputTokens: 500, costUsd: null } }).micros
  );
  const credits = createCredits(seededDb, loadConfig({ GODE_MOCK: "1" }));
  assert.equal(credits.estimateApiCostMicros({ model: astra, inputTokens: 300_000, maxOutputTokens: 100 }), 300_000 * 16 + 100 * 60);
  assert.equal(credits.estimateApiCostMicros({ model: astra, inputTokens: 1000, maxOutputTokens: 100 }), 1000 * 8 + 100 * 40);
});

test("'now make a video of it' through the real fal adapter: the subject, a neutral name, the asked length", async () => {
  up.reset();
  // FAL_KEY only: the heuristic classifier writes the media_prompt from the previous message.
  const h = setup(upstreamEnv({ FAL_KEY: "fal-test-key" }));
  const user = h.user({ balanceUsd: 5 });
  const r1 = await h.turn({ user, text: `My friend ${NAME} wants a picture: draw a red fox sitting in the snow at sunset` });
  assertTerminal(r1, "done");
  up.reset();
  const r = await h.turn({ user, conversationId: r1.route.conversation_id, text: "now make a 20 second video of it" });
  assertTerminal(r, "done");
  assert.equal(r.route.model.id, VEO_LITE);
  const submit = up.find("/fal/").find((req) => req.method === "POST");
  assert.match(submit.body.prompt, /red fox sitting in the snow/);
  assert.ok(!containsPII(submit.rawBody));
  assert.equal(submit.body.duration, "8s");
  assert.equal(submit.body.duration_options, undefined, "catalog-only keys stay home");
  assert.equal(r.done.media_units, 8);
  assert.equal(requestRow(h, r.route.request_id).api_cost_micros, 8 * 50_000);
  checkInvariants(h);
});
