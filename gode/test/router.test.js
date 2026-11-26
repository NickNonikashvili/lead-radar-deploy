// Router: effort/tier tables, the classifier (LLM path + heuristic fallback) and the picker rules.
// Uses its own small fixture catalog on an in-memory DB, never the real seed contents.
const test = require("node:test");
const assert = require("node:assert/strict");

const { openDb } = require("../src/db");
const { loadConfig } = require("../src/config");
const { upsertModel, setRoute, MEDIA_JOBS, CLASSIFIER_MODEL_CANDIDATES } = require("../src/seed/catalog");
const {
  difficultyToEffort,
  chooseTier,
  clampDifficulty,
  TIER_BY_PLAN,
  MEDIA_TIER_BY_PLAN,
  TIER_RANK,
} = require("../src/router/effort");
const {
  createClassifier,
  heuristicClassify,
  normalizeClassification,
  sanitizeTitle,
  CLASSIFIER_SYSTEM_PROMPT,
} = require("../src/router/classify");
const { createPicker, walkOrder, typicalPriceUsd } = require("../src/router/pick");

// ---------------------------------------------------------------------------------------------
// fixtures

const TEXT = ["chat", "code", "action"];
function textModel(id, over = {}) {
  const [gateway, slug] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  return {
    id, label: over.label || slug, vendor: "Test", region: "us", gateway, slug, jobs: TEXT,
    price_in: 1, price_out: 2, price_unit: null, price_per_unit: null,
    zdr: false, retention_note: null, open_weights: false, self_hosted: false,
    supports_reasoning: true, context_length: 100000, params: {}, enabled: true,
    ...over,
  };
}
function imageModel(id, ppu, over = {}) {
  return textModel(id, {
    jobs: ["image"], price_in: null, price_out: null, price_unit: "image", price_per_unit: ppu,
    supports_reasoning: false, context_length: null, ...over,
  });
}

const M = {
  quality: "openrouter:t/quality",
  balanced: "openrouter:t/balanced",
  budget: "openrouter:t/budget",
  plain: "openrouter:t/plain",
  zdrAlt: "openrouter:t/zdr-alt",
  alt: "openai:t/alt",
  self: "selfhosted:t/private",
  imgQ: "fal:i/quality",
  imgB: "fal:i/balanced",
  imgC: "fal:i/budget",
};

function fixtureDb() {
  const db = openDb(":memory:");
  const models = [
    textModel(M.quality, { label: "T Quality", price_in: 5, price_out: 25 }),
    textModel(M.balanced, { label: "T Balanced", region: "eu", zdr: true, price_in: 1, price_out: 3 }),
    textModel(M.budget, { label: "T Budget", region: "cn", zdr: true, price_in: 0.1, price_out: 0.3 }),
    textModel(M.plain, { label: "T Plain", jobs: ["chat", "code"], supports_reasoning: false, price_in: 2, price_out: 8 }),
    textModel(M.zdrAlt, { label: "T ZDR Alt", zdr: true, price_in: 0.5, price_out: 1.5 }),
    textModel(M.alt, { label: "T Alt", price_in: 3, price_out: 12 }),
    textModel(M.self, { label: "T Self", region: "self", zdr: true, self_hosted: true, open_weights: true, price_in: 0.2, price_out: 0.6 }),
    imageModel(M.imgQ, 0.05, { label: "I Quality" }),
    imageModel(M.imgB, 0.03, { label: "I Balanced" }),
    imageModel(M.imgC, 0.01, { label: "I Budget" }),
  ];
  for (const m of models) upsertModel(db, m);
  for (const job of ["chat", "code"]) {
    setRoute(db, { job, tier: "quality", model_id: M.quality }, { source: "seed" });
    setRoute(db, { job, tier: "balanced", model_id: M.balanced }, { source: "seed" });
    setRoute(db, { job, tier: "budget", model_id: M.budget }, { source: "seed" });
    setRoute(db, { job, tier: "private", model_id: M.self }, { source: "seed" });
  }
  setRoute(db, { job: "image", tier: "quality", model_id: M.imgQ }, { source: "seed" });
  setRoute(db, { job: "image", tier: "balanced", model_id: M.imgB }, { source: "seed" });
  setRoute(db, { job: "image", tier: "budget", model_id: M.imgC }, { source: "seed" });
  setRoute(db, { job: "image", tier: "private", model_id: M.imgC }, { source: "seed" });
  return db;
}

/** isAvailable stub: `down` holds gateway names or model ids that are not callable. */
function stubProviders({ down = [], completeJSON } = {}) {
  const off = new Set(down);
  const calls = [];
  const provider = {
    name: "stub",
    completeJSON: async (args) => {
      calls.push(args);
      if (!completeJSON) throw new Error("completeJSON not expected");
      return completeJSON(args);
    },
  };
  return {
    calls,
    isAvailable: (m) => Boolean(m && m.enabled && !off.has(m.gateway) && !off.has(m.id)),
    get: () => provider,
  };
}

function setup({ env = {}, down = [] } = {}) {
  const db = fixtureDb();
  const config = loadConfig(env);
  const providers = stubProviders({ down });
  return { db, config, providers, picker: createPicker({ db, config, providers }) };
}

const silent = { warn() {} };

// ---------------------------------------------------------------------------------------------
// effort.js

test("difficultyToEffort maps 1..5 and clamps junk", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(difficultyToEffort), ["none", "low", "medium", "high", "high"]);
  assert.equal(difficultyToEffort(0), "none");
  assert.equal(difficultyToEffort(42), "high");
  assert.equal(difficultyToEffort("2"), "low");
  assert.equal(difficultyToEffort(3.6), "high");
  assert.equal(difficultyToEffort(undefined), "medium");
  assert.equal(clampDifficulty(NaN), 3);
});

test("TIER_BY_PLAN matches the contract and chooseTier reads it for every plan x difficulty", () => {
  assert.deepEqual(TIER_BY_PLAN, {
    saver: ["budget", "budget", "budget", "balanced", "balanced"],
    balanced: ["budget", "budget", "balanced", "quality", "quality"],
    best: ["balanced", "quality", "quality", "quality", "quality"],
  });
  for (const plan of ["saver", "balanced", "best"]) {
    for (let d = 1; d <= 5; d++) {
      for (const job of TEXT) assert.equal(chooseTier({ job, difficulty: d, plan }), TIER_BY_PLAN[plan][d - 1], `${plan} ${job} d${d}`);
    }
  }
  assert.equal(chooseTier({ job: "chat", difficulty: 4, plan: "nonsense" }), "quality", "unknown plan -> balanced");
  assert.deepEqual(TIER_RANK, { budget: 0, balanced: 1, quality: 2, private: 3 });
});

test("media tiers follow the plan only", () => {
  assert.deepEqual(MEDIA_TIER_BY_PLAN, { saver: "budget", balanced: "balanced", best: "quality" });
  for (const job of MEDIA_JOBS) {
    for (const plan of ["saver", "balanced", "best"]) {
      for (const d of [1, 5]) assert.equal(chooseTier({ job, difficulty: d, plan }), MEDIA_TIER_BY_PLAN[plan]);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// pick.js

test("auto pick follows plan x difficulty with a readable reason", () => {
  const { picker } = setup();
  const r1 = picker.pick({ job: "code", difficulty: 4, user: { plan: "balanced" } });
  assert.equal(r1.model.id, M.quality);
  assert.equal(r1.tier, "quality");
  assert.equal(r1.effort, "high");
  assert.equal(r1.pinned, false);
  assert.equal(r1.zdrRequired, false);
  assert.equal(r1.reason, "auto: code · difficulty 4 · balanced plan -> quality");
  assert.deepEqual(r1.pinsUpdate, { code: { model_id: M.quality, tier: "quality", source: "auto" } });

  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: { plan: "balanced" } }).model.id, M.budget);
  assert.equal(picker.pick({ job: "chat", difficulty: 3, user: { plan: "balanced" } }).model.id, M.balanced);
  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: { plan: "best" } }).model.id, M.balanced);
  assert.equal(picker.pick({ job: "chat", difficulty: 5, user: { plan: "saver" } }).model.id, M.balanced);
});

test("rule 1: action routes as chat (chat routes, chat pins)", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "action", difficulty: 2, user: { plan: "best" } });
  assert.equal(r.model.id, M.quality);
  assert.match(r.reason, /^auto: action \(as chat\)/);
  assert.deepEqual(Object.keys(r.pinsUpdate), ["chat"]);
});

test("media picks: plan tier, effort always none, no difficulty in the reason", () => {
  const { db, picker } = setup();
  setRoute(db, { job: "image", tier: "quality", model_id: M.imgQ, effort_override: "high" });
  const r = picker.pick({ job: "image", difficulty: 5, user: { plan: "best" } });
  assert.equal(r.model.id, M.imgQ);
  assert.equal(r.effort, "none");
  assert.equal(r.reason, "auto: image · best plan -> quality");
  assert.equal(picker.pick({ job: "image", difficulty: 5, user: { plan: "saver" } }).model.id, M.imgC);
});

test("rule 7: effort_override wins, no-reasoning models get none", () => {
  const { db, picker } = setup();
  setRoute(db, { job: "chat", tier: "quality", model_id: M.quality, effort_override: "low" });
  assert.equal(picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" } }).effort, "low");
  setRoute(db, { job: "chat", tier: "budget", model_id: M.plain, effort_override: "high" });
  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: { plan: "balanced" } }).effort, "none");
  // A user override to a routed model still uses that cell's override.
  assert.equal(picker.pick({ job: "chat", difficulty: 1, overrideModelId: M.quality }).effort, "low");
  // ...and an unrouted model falls back to difficulty.
  assert.equal(picker.pick({ job: "chat", difficulty: 3, overrideModelId: M.alt }).effort, "medium");
});

test("rule 3: a valid override is used and pinned for the user", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "chat", difficulty: 2, user: {}, overrideModelId: M.alt, pins: { chat: { model_id: M.budget, tier: "budget", source: "auto" } } });
  assert.equal(r.model.id, M.alt);
  assert.equal(r.pinned, true);
  assert.equal(r.pinsUpdate.chat.source, "user");
  assert.equal(r.pinsUpdate.chat.model_id, M.alt);
  assert.match(r.reason, /your pick: T Alt/);
  // A routed model's tier is reported as its cell.
  assert.equal(picker.pick({ job: "chat", difficulty: 1, overrideModelId: M.quality }).tier, "quality");
});

test("rule 3: an ineligible override is a 400 with a reason", () => {
  const { db, config } = setup();
  const picker = createPicker({ db, config, providers: stubProviders({ down: [M.zdrAlt] }) });
  const bad = (args, re) =>
    assert.throws(() => picker.pick({ job: "chat", difficulty: 2, user: {}, ...args }), (e) => e.status === 400 && e.code === "bad_request" && re.test(e.message));
  bad({ overrideModelId: "openrouter:nope" }, /Unknown model/);
  bad({ overrideModelId: M.imgQ }, /can't do chat/);
  bad({ overrideModelId: M.zdrAlt }, /not available/);
  bad({ overrideModelId: M.alt, private: true }, /private/);
  bad({ overrideModelId: M.alt, user: { strict_privacy: true } }, /Strict privacy/);
  bad({ overrideModelId: M.quality, user: { eu_only: true } }, /EU-only/);
  upsertModel(db, textModel(M.alt, { label: "T Alt", enabled: false }));
  bad({ overrideModelId: M.alt }, /turned off/);
});

test("rule 4: private uses the self-hosted private route, zdrRequired, auto pin at tier private", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "chat", difficulty: 4, private: true, user: { plan: "best" } });
  assert.equal(r.model.id, M.self);
  assert.equal(r.tier, "private");
  assert.equal(r.zdrRequired, true);
  assert.equal(r.private, true);
  assert.equal(r.effort, "high");
  assert.equal(r.reason, "private: self-hosted model");
  assert.deepEqual(r.pinsUpdate, { chat: { model_id: M.self, tier: "private", source: "auto" } });
});

test("rule 4: without self-hosted, zdr fallback uses the normal tier if ZDR, else walks to a ZDR route, then any ZDR model", () => {
  const { picker } = setup({ down: ["selfhosted"] });
  // balanced plan d3 -> balanced route, which is ZDR.
  const r1 = picker.pick({ job: "chat", difficulty: 3, private: true, user: {} });
  assert.equal(r1.model.id, M.balanced);
  assert.equal(r1.tier, "private");
  assert.equal(r1.zdrRequired, true);
  assert.match(r1.reason, /private: no self-hosted model, using zero-retention model/);
  // d4 -> quality route is not ZDR -> walk quality, balanced, budget.
  assert.equal(picker.pick({ job: "chat", difficulty: 4, private: true, user: {} }).model.id, M.balanced);

  const { picker: p2 } = setup({ down: ["selfhosted", M.balanced, M.budget] });
  assert.equal(p2.pick({ job: "chat", difficulty: 4, private: true, user: {} }).model.id, M.zdrAlt, "any ZDR candidate");

  const { picker: p3 } = setup({ down: ["selfhosted", M.balanced, M.budget, M.zdrAlt] });
  assert.throws(() => p3.pick({ job: "chat", difficulty: 4, private: true, user: {} }), { status: 409, code: "private_blocked" });
});

test("rule 4: privateFallback=block refuses private requests without self-hosted", () => {
  const { picker } = setup({ env: { PRIVATE_FALLBACK: "block" }, down: ["selfhosted"] });
  assert.throws(() => picker.pick({ job: "chat", difficulty: 2, private: true, user: {} }), { status: 409, code: "private_blocked" });
  // Non-private requests are unaffected.
  assert.equal(picker.pick({ job: "chat", difficulty: 2, user: {} }).model.id, M.budget);
  // With self-hosted up, block mode still serves private requests.
  const { picker: up } = setup({ env: { PRIVATE_FALLBACK: "block" } });
  assert.equal(up.pick({ job: "chat", difficulty: 2, private: true, user: {} }).model.id, M.self);
});

test("private media uses the admin's private cell (no ZDR media model exists) without claiming ZDR", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "image", difficulty: 2, private: true, user: { plan: "best" } });
  assert.equal(r.model.id, M.imgC);
  assert.equal(r.tier, "private");
  assert.equal(r.zdrRequired, false);
  assert.equal(r.effort, "none");
});

test("rule 2: strict_privacy keeps text on ZDR/self-hosted models and blocks non-ZDR media", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best", strict_privacy: 1 } });
  assert.equal(r.model.id, M.balanced, "quality pick is not ZDR -> nearest ZDR tier");
  assert.equal(r.tier, "balanced");
  assert.equal(r.zdrRequired, true);
  assert.match(r.reason, /quality pick can't be used here, using balanced/);
  assert.throws(() => picker.pick({ job: "image", difficulty: 1, user: { strict_privacy: true } }), (e) => e.code === "private_blocked" && /Strict privacy/.test(e.message));
});

test("rule 2: eu_only restricts text jobs to eu/self regions but not media", () => {
  const { picker } = setup();
  assert.equal(picker.pick({ job: "chat", difficulty: 5, user: { plan: "best", eu_only: true } }).model.id, M.balanced);
  // budget (cn) is skipped; nearest tier from budget is balanced (eu).
  assert.equal(picker.pick({ job: "code", difficulty: 1, user: { eu_only: true } }).model.id, M.balanced);
  assert.equal(picker.pick({ job: "image", difficulty: 1, user: { plan: "best", eu_only: true } }).model.id, M.imgQ, "media ignores eu_only");
  const { picker: p2 } = setup({ down: [M.balanced, "selfhosted"] });
  assert.throws(() => p2.pick({ job: "chat", difficulty: 3, user: { eu_only: true } }), (e) => e.code === "private_blocked" && /EU-only/.test(e.message));
});

test("rule 5: an eligible pin is reused; pinsUpdate only when something changed", () => {
  const { picker } = setup();
  const first = picker.pick({ job: "chat", difficulty: 3, user: {} });
  const second = picker.pick({ job: "chat", difficulty: 3, user: {}, pins: first.pinsUpdate });
  assert.equal(second.model.id, first.model.id);
  assert.equal(second.pinned, true);
  assert.equal(second.pinsUpdate, null);
  assert.equal(second.reason, "pinned for this conversation");
  // JSON-string pins are accepted too.
  assert.equal(picker.pick({ job: "chat", difficulty: 3, user: {}, pins: JSON.stringify(first.pinsUpdate) }).pinned, true);
});

test("rule 5: auto pins upgrade to a higher tier but never downgrade", () => {
  const { picker } = setup();
  const budgetPin = { chat: { model_id: M.budget, tier: "budget", source: "auto" }, image: { model_id: M.imgB, tier: "balanced", source: "auto" } };
  const up = picker.pick({ job: "chat", difficulty: 4, user: {}, pins: budgetPin });
  assert.equal(up.model.id, M.quality);
  assert.equal(up.tier, "quality");
  assert.equal(up.pinned, false);
  assert.match(up.reason, /upgraded from budget/);
  assert.deepEqual(up.pinsUpdate, { ...budgetPin, chat: { model_id: M.quality, tier: "quality", source: "auto" } }, "other jobs' pins are preserved");

  const qualityPin = { chat: { model_id: M.quality, tier: "quality", source: "auto" } };
  const down = picker.pick({ job: "chat", difficulty: 1, user: {}, pins: qualityPin });
  assert.equal(down.model.id, M.quality);
  assert.equal(down.pinned, true);
  assert.equal(down.pinsUpdate, null);
  assert.equal(down.effort, "none", "effort still follows this message's difficulty");
});

test("rule 5: an upgrade that can only reach the cheapest fallback keeps the pin", () => {
  const { picker } = setup({ down: [M.quality, M.balanced] });
  const pins = { chat: { model_id: M.budget, tier: "budget", source: "auto" } };
  const r = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, pins });
  assert.equal(r.model.id, M.budget);
  assert.equal(r.pinsUpdate, null);
});

test("rule 5: user pins never auto-change", () => {
  const { picker } = setup();
  const pins = { chat: { model_id: M.plain, tier: "budget", source: "user" } };
  for (const d of [1, 5]) {
    const r = picker.pick({ job: "chat", difficulty: d, user: { plan: "best" }, pins });
    assert.equal(r.model.id, M.plain);
    assert.equal(r.pinned, true);
    assert.equal(r.pinsUpdate, null);
    assert.match(r.reason, /your pick/);
  }
  // Pinned model temporarily unavailable: auto pick, but the user's pin is kept for later.
  const { picker: p2 } = setup({ down: [M.plain] });
  const r = p2.pick({ job: "chat", difficulty: 4, user: {}, pins });
  assert.equal(r.model.id, M.quality);
  assert.equal(r.pinsUpdate, null);
});

test("an ineligible auto pin is replaced", () => {
  const { picker } = setup({ down: [M.balanced] });
  const r = picker.pick({ job: "chat", difficulty: 3, user: {}, pins: { chat: { model_id: M.balanced, tier: "balanced", source: "auto" } } });
  assert.equal(r.model.id, M.budget);
  assert.deepEqual(r.pinsUpdate.chat, { model_id: M.budget, tier: "budget", source: "auto" });
});

test("private is sticky for text jobs: a private pin keeps later requests private", () => {
  const { picker } = setup();
  const first = picker.pick({ job: "chat", difficulty: 2, private: true, user: {} });
  const next = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, pins: first.pinsUpdate });
  assert.equal(next.model.id, M.self);
  assert.equal(next.private, true);
  assert.equal(next.pinned, true);
  assert.equal(next.zdrRequired, true);
  assert.match(next.reason, /earlier in this conversation/);
  // Code shares the history, so it is private too; media prompts don't carry history.
  assert.equal(picker.pick({ job: "code", difficulty: 2, user: {}, pins: first.pinsUpdate }).private, true);
  assert.equal(picker.pick({ job: "image", difficulty: 2, user: {}, pins: first.pinsUpdate }).private, false);
  // Self-hosted goes away mid-conversation: still private, so a ZDR model, never the public pick.
  const { picker: p2 } = setup({ down: ["selfhosted"] });
  const r = p2.pick({ job: "chat", difficulty: 4, user: {}, pins: first.pinsUpdate });
  assert.equal(r.model.zdr, true);
  assert.notEqual(r.model.id, M.quality);
});

test("private + user pin: a private-safe pick is kept, an unsafe one is replaced", () => {
  const { picker } = setup();
  const safe = picker.pick({ job: "chat", difficulty: 2, private: true, user: {}, pins: { chat: { model_id: M.zdrAlt, tier: "budget", source: "user" } } });
  assert.equal(safe.model.id, M.zdrAlt);
  assert.equal(safe.pinned, true);
  assert.deepEqual(safe.pinsUpdate.chat, { model_id: M.zdrAlt, tier: "private", source: "user" });

  const unsafe = picker.pick({ job: "chat", difficulty: 2, private: true, user: {}, pins: { chat: { model_id: M.alt, tier: "budget", source: "user" } } });
  assert.equal(unsafe.model.id, M.self);
  assert.deepEqual(unsafe.pinsUpdate.chat, { model_id: M.self, tier: "private", source: "auto" });
});

test("rule 6: unavailable routes walk to the nearest tier (ties -> cheaper), then the cheapest model, then no_model", () => {
  assert.deepEqual(walkOrder("quality"), ["balanced", "budget"]);
  assert.deepEqual(walkOrder("balanced"), ["budget", "quality"]);
  assert.deepEqual(walkOrder("budget"), ["balanced", "quality"]);

  const q = setup({ down: [M.quality] }).picker.pick({ job: "code", difficulty: 4, user: {} });
  assert.equal(q.model.id, M.balanced);
  assert.equal(q.tier, "balanced");
  const b = setup({ down: [M.balanced] }).picker.pick({ job: "code", difficulty: 3, user: {} });
  assert.equal(b.model.id, M.budget);
  const c = setup({ down: [M.budget, M.balanced] }).picker.pick({ job: "code", difficulty: 1, user: {} });
  assert.equal(c.model.id, M.quality);

  const cheapest = setup({ down: [M.quality, M.balanced, M.budget] }).picker.pick({ job: "chat", difficulty: 3, user: {} });
  assert.equal(cheapest.model.id, M.self, "cheapest remaining eligible model");
  assert.match(cheapest.reason, /cheapest available model/);

  const none = setup({ down: ["openrouter", "openai", "selfhosted"] }).picker;
  assert.throws(() => none.pick({ job: "chat", difficulty: 3, user: {} }), { status: 503, code: "no_model" });
});

test("disabled models are never picked", () => {
  const { db, picker } = setup();
  upsertModel(db, textModel(M.quality, { label: "T Quality", enabled: false, price_in: 5, price_out: 25 }));
  assert.equal(picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" } }).model.id, M.balanced);
});

test("unknown jobs are a 400", () => {
  const { picker } = setup();
  assert.throws(() => picker.pick({ job: "dance", difficulty: 1, user: {} }), { status: 400, code: "bad_request" });
});

test("candidates: routed picks first (quality, balanced, budget), then alternates by price desc", () => {
  const { picker } = setup({ down: [M.zdrAlt] });
  const ids = picker.candidates({ job: "chat", user: {} }).map((m) => m.id);
  assert.deepEqual(ids, [M.quality, M.balanced, M.budget, M.alt, M.plain, M.self]);
  assert.deepEqual(picker.candidates({ job: "action", user: {} }).map((m) => m.id), ids, "action lists chat models");

  const priv = picker.candidates({ job: "chat", user: {}, private: true }).map((m) => m.id);
  assert.deepEqual(priv, [M.self, M.balanced, M.budget]);
  const eu = picker.candidates({ job: "chat", user: { eu_only: true } }).map((m) => m.id);
  assert.deepEqual(eu, [M.balanced, M.self]);
  assert.deepEqual(picker.candidates({ job: "image", user: {} }).map((m) => m.id), [M.imgQ, M.imgB, M.imgC]);
});

test("typicalPriceUsd orders text and media models sensibly", () => {
  assert.ok(typicalPriceUsd(textModel("openrouter:a", { price_in: 5, price_out: 25 })) > typicalPriceUsd(textModel("openrouter:b", { price_in: 1, price_out: 3 })));
  assert.equal(typicalPriceUsd(imageModel("fal:x", 0.04)), 0.04);
  assert.equal(typicalPriceUsd(textModel("fal:v", { price_in: null, price_out: null, price_unit: "second", price_per_unit: 0.1, params: { duration: "4s" } })), 0.4);
  assert.equal(typicalPriceUsd(textModel("openrouter:n", { price_in: null, price_out: null })), null);
});

// ---------------------------------------------------------------------------------------------
// classify.js

const CLASSIFIER_ID = "openrouter:t/classifier";
function classifierSetup({ completeJSON, env = {}, down = [], classifierOver = {}, timeoutMs, redactor } = {}) {
  const db = fixtureDb();
  upsertModel(db, textModel(CLASSIFIER_ID, { label: "Classifier", zdr: true, price_in: 0.05, price_out: 0.2, ...classifierOver }));
  const config = loadConfig({ CLASSIFIER_MODEL_ID: CLASSIFIER_ID, ...env });
  const providers = stubProviders({ down, completeJSON });
  const classifier = createClassifier({ config, db, providers, redactor, timeoutMs, logger: silent });
  return { db, config, providers, classifier };
}

const GOOD_REPLY = { job: "code", difficulty: 4, private: false, output: { length: "long", format: "code" }, title: "Fix the parser bug" };

test("CLASSIFIER_SYSTEM_PROMPT carries the mock marker and defines every job", () => {
  assert.ok(CLASSIFIER_SYSTEM_PROMPT.includes("GODE_CLASSIFIER_V1"));
  for (const job of ["chat", "code", "image", "video", "music", "voice", "action"]) assert.ok(CLASSIFIER_SYSTEM_PROMPT.includes(`"${job}"`), job);
  assert.match(CLASSIFIER_SYSTEM_PROMPT, /\[PERSON_1\]/);
  assert.match(CLASSIFIER_SYSTEM_PROMPT, /ONLY one JSON object/);
});

test("classifier LLM path: validated result, model id, token-priced cost", async () => {
  const { classifier, providers } = classifierSetup({
    completeJSON: async () => ({ json: GOOD_REPLY, text: "", usage: { inputTokens: 1000, outputTokens: 100, costUsd: null } }),
  });
  const history = [
    { role: "user", content: "earlier question" },
    { role: "assistant", content: "earlier answer" },
  ];
  const r = await classifier.classify({ text: "my parser crashes on [PERSON_1]'s file", history, redactionCounts: { PERSON: 1 } });
  assert.deepEqual(r, {
    ...GOOD_REPLY,
    classifierModel: CLASSIFIER_ID,
    // 1000 x $0.05/M + 100 x $0.20/M = $0.00007 = 70 micros
    usage: { inputTokens: 1000, outputTokens: 100, costMicros: 70 },
  });
  const [call] = providers.calls;
  assert.equal(call.model.id, CLASSIFIER_ID);
  assert.equal(call.system, CLASSIFIER_SYSTEM_PROMPT);
  assert.ok(call.signal instanceof AbortSignal);
  assert.equal(call.zdr, true, "ZDR-capable classifier is kept on ZDR endpoints");
  const payload = JSON.parse(call.user);
  assert.equal(payload.text, "my parser crashes on [PERSON_1]'s file");
  assert.deepEqual(payload.history, [
    { role: "user", text: "earlier question" },
    { role: "assistant", text: "earlier answer" },
  ]);
});

test("classifier uses the provider-reported cost when present", async () => {
  const { classifier } = classifierSetup({ completeJSON: async () => ({ json: GOOD_REPLY, usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.000123 } }) });
  const r = await classifier.classify({ text: "fix my code" });
  assert.equal(r.usage.costMicros, 123);
});

test("classifier output is validated and clamped", async () => {
  const reply = {
    job: " Coding ",
    difficulty: 9,
    private: "true",
    output: { length: "HUGE", format: "spreadsheet" },
    title: '  "A very long title that keeps going on and on." ',
  };
  const { classifier } = classifierSetup({ completeJSON: async () => ({ json: reply, usage: {} }) });
  const r = await classifier.classify({ text: "write a python function" });
  assert.equal(r.job, "code");
  assert.equal(r.difficulty, 5);
  assert.equal(r.private, true);
  assert.deepEqual(r.output, { length: "long", format: "code" });
  assert.equal(r.title, "A very long title that keeps");
  assert.ok(r.title.split(" ").length <= 6);

  const fb = heuristicClassify("anything", {});
  assert.equal(normalizeClassification({ job: "banana", difficulty: 0 }, "hello", fb).job, "chat", "unknown job -> chat");
  assert.equal(normalizeClassification({ job: "chat", difficulty: "2" }, "hello", fb).difficulty, 2);
  assert.equal(normalizeClassification({ job: "chat", difficulty: "lots" }, "hello", fb).difficulty, fb.difficulty);
  const video = normalizeClassification({ job: "video", difficulty: 2, output: { length: "short", format: "text", duration_s: 999, aspect: "9x16" } }, "a clip", fb);
  assert.deepEqual(video.output, { length: "short", format: "video", duration_s: 30, aspect: "9:16" });
  const image = normalizeClassification({ job: "image", difficulty: 2, output: { aspect: "7:3" } }, "a cat", fb);
  assert.deepEqual(image.output.aspect, "1:1");
  assert.equal(normalizeClassification({ job: "chat", title: "" }, "Tell me about [PERSON_1]", fb).title, fb.title);
  assert.equal(sanitizeTitle("Trip to\n[LOCATION_1]!!"), "Trip to [LOCATION_1]");
});

test("invalid classifier output falls back to the heuristic", async () => {
  const thrown = classifierSetup({
    completeJSON: async () => {
      throw Object.assign(new Error("openrouter: model did not return a JSON object"), { code: "upstream_error" });
    },
  });
  const r1 = await thrown.classifier.classify({ text: "Draw a cat wearing a top hat" });
  assert.equal(r1.classifierModel, "heuristic");
  assert.equal(r1.job, "image");
  assert.deepEqual(r1.usage, { inputTokens: 0, outputTokens: 0, costMicros: 0 });

  for (const json of [null, [], "text", { difficulty: 3 }]) {
    const { classifier } = classifierSetup({ completeJSON: async () => ({ json, usage: { inputTokens: 100, outputTokens: 10, costUsd: null } }) });
    const r = await classifier.classify({ text: "Draw a cat wearing a top hat" });
    assert.equal(r.classifierModel, "heuristic", JSON.stringify(json));
    assert.equal(r.job, "image");
    assert.equal(r.usage.costMicros, 7, "the wasted call is still billed: 100 x 0.05 + 10 x 0.2");
  }
});

test("classifier timeout falls back to the heuristic, even if the provider ignores the signal", async () => {
  const ignoring = classifierSetup({ timeoutMs: 30, completeJSON: () => new Promise(() => {}) });
  const t0 = Date.now();
  const r = await ignoring.classifier.classify({ text: "Write a python function that reverses a list" });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(r.job, "code");

  let sawAbort = false;
  const honouring = classifierSetup({
    timeoutMs: 30,
    completeJSON: ({ signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => {
          sawAbort = true;
          reject(signal.reason);
        })
      ),
  });
  assert.equal((await honouring.classifier.classify({ text: "hi" })).classifierModel, "heuristic");
  assert.equal(sawAbort, true);
});

test("the product timeout is 4 s", () => {
  assert.equal(require("../src/router/classify").CLASSIFIER_TIMEOUT_MS, 4000);
});

test("a caller abort is rethrown, not turned into a classification", async () => {
  const { classifier } = classifierSetup({
    completeJSON: ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
  });
  const ac = new AbortController();
  const p = classifier.classify({ text: "hello there, explain monads", signal: ac.signal });
  ac.abort();
  await assert.rejects(p, (e) => e.name === "AbortError");
  await assert.rejects(classifier.classify({ text: "x", signal: AbortSignal.abort() }), (e) => e.name === "AbortError");
});

test("classifier model choice: configured id, then CLASSIFIER_MODEL_CANDIDATES; skips disabled/unavailable/media", async () => {
  const reply = async ({ model }) => ({ json: { ...GOOD_REPLY, title: model.id }, usage: {} });
  // Configured model unavailable -> first candidate.
  const db = fixtureDb();
  upsertModel(db, textModel(CLASSIFIER_ID, { zdr: true }));
  const [first, second] = CLASSIFIER_MODEL_CANDIDATES;
  const idOf = (id) => [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  for (const id of [first, second]) upsertModel(db, textModel(id, { slug: idOf(id)[1], gateway: idOf(id)[0], zdr: id === first }));
  const config = loadConfig({ CLASSIFIER_MODEL_ID: CLASSIFIER_ID });
  const make = (down) => {
    const providers = stubProviders({ down, completeJSON: reply });
    return { providers, classifier: createClassifier({ config, db, providers, logger: silent }) };
  };
  assert.equal((await make([]).classifier.classify({ text: "fix the bug" })).classifierModel, CLASSIFIER_ID);
  assert.equal((await make([CLASSIFIER_ID]).classifier.classify({ text: "fix the bug" })).classifierModel, first);
  assert.equal((await make([CLASSIFIER_ID, first]).classifier.classify({ text: "fix the bug" })).classifierModel, second);
  upsertModel(db, textModel(second, { slug: idOf(second)[1], gateway: idOf(second)[0], enabled: false }));
  const none = make([CLASSIFIER_ID, first]);
  const r = await none.classifier.classify({ text: "fix the bug" });
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(none.providers.calls.length, 0, "no model -> no upstream call");

  // zdrOnly (strict-privacy users) skips non-ZDR classifier models.
  upsertModel(db, textModel(CLASSIFIER_ID, { zdr: false }));
  const strict = make([]);
  assert.equal((await strict.classifier.classify({ text: "fix the bug", zdrOnly: true })).classifierModel, first);

  // A media model configured as classifier is ignored.
  upsertModel(db, imageModel("fal:i/classifier", 0.01));
  const mediaCfg = loadConfig({ CLASSIFIER_MODEL_ID: "fal:i/classifier" });
  const media = createClassifier({ config: mediaCfg, db, providers: stubProviders({ completeJSON: reply }), logger: silent });
  assert.equal((await media.classify({ text: "fix the bug" })).classifierModel, first);
});

test("empty text never calls the model", async () => {
  const { classifier, providers } = classifierSetup({ completeJSON: async () => ({ json: GOOD_REPLY, usage: {} }) });
  const r = await classifier.classify({ text: "   " });
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(r.difficulty, 1);
  assert.equal(providers.calls.length, 0);
});

test("private is OR-ed: LLM flag, redactor.isSensitive, keywords", async () => {
  const llm = (priv) => async () => ({ json: { ...GOOD_REPLY, job: "chat", private: priv }, usage: {} });
  const sensitive = { isSensitive: (counts) => Boolean(counts && counts.CARD) };
  const cases = [
    { priv: false, text: "what is a good name for a cat", counts: {}, want: false },
    { priv: true, text: "what is a good name for a cat", counts: {}, want: true },
    { priv: false, text: "charge [CARD_1] for the order", counts: { CARD: 1 }, want: true },
    { priv: false, text: "how do I read my bank statement", counts: {}, want: true },
    { priv: false, text: "Email [PERSON_1] the agenda", counts: { PERSON: 1 }, want: false },
  ];
  for (const c of cases) {
    const { classifier } = classifierSetup({ completeJSON: llm(c.priv), redactor: sensitive });
    assert.equal((await classifier.classify({ text: c.text, redactionCounts: c.counts })).private, c.want, c.text);
  }
  // Without a redactor, high-risk counts still mark the heuristic result private.
  assert.equal(heuristicClassify("pay with [IBAN_1]", { IBAN: 1 }).private, true);
  assert.equal(heuristicClassify("hello [PERSON_1]", { PERSON: 1 }).private, false);
});

test("the mock provider recognises the classifier prompt (marker integration)", async () => {
  const { createMockProvider } = require("../src/providers/mock");
  const db = fixtureDb();
  upsertModel(db, textModel(CLASSIFIER_ID, { zdr: true, price_in: 0.05, price_out: 0.2 }));
  const mock = createMockProvider({});
  const providers = { isAvailable: () => true, get: () => mock };
  const classifier = createClassifier({ config: loadConfig({ CLASSIFIER_MODEL_ID: CLASSIFIER_ID }), db, providers, logger: silent });
  const r = await classifier.classify({ text: "Draw a logo for my bakery" });
  assert.equal(r.classifierModel, CLASSIFIER_ID);
  assert.equal(r.job, "image");
  assert.ok(r.usage.costMicros > 0);
});

test("heuristic job detection", () => {
  const cases = {
    "hi": "chat",
    "What is the capital of France?": "chat",
    "Explain how transformers work": "chat",
    "Write a python function that reverses a linked list": "code",
    "Fix this:\n```js\nconst x = foo(;\n```": "code",
    "TypeError: undefined is not a function, what's wrong?": "code",
    "Write a python script that downloads all images from a page": "code",
    "Draw a cat wearing a top hat, watercolor": "image",
    "Can you create a logo for my bakery called Sunrise?": "image",
    "which image format is best for the web?": "chat",
    "draw a comparison between Rome and Athens": "chat",
    "How do I make a video in Premiere?": "chat",
    "Make a 10 second video of a dog surfing": "video",
    "animate my logo": "video",
    "Compose a lofi beat for studying": "music",
    "write lyrics for a breakup song": "chat",
    "Read this aloud: welcome to the show": "voice",
    "Email [PERSON_1] about the meeting tomorrow": "action",
    "Send an email to [EMAIL_1] saying I'm late": "action",
    "Write an email to my boss asking for a raise": "chat",
    "Post this on LinkedIn: we just launched!": "action",
    "Schedule a meeting with the team on Friday": "action",
    "Remind me to call mom at 5": "action",
  };
  for (const [text, job] of Object.entries(cases)) assert.equal(heuristicClassify(text, {}).job, job, text);
});

test("heuristic difficulty", () => {
  const d = (t) => heuristicClassify(t, {}).difficulty;
  assert.equal(d("hi"), 1);
  assert.equal(d("thanks!"), 1);
  assert.equal(d("What is the capital of France?"), 1);
  assert.ok(d("Explain how transformers work") >= 2);
  assert.ok(d("Write a python function that reverses a linked list") >= 3);
  assert.ok(d("Prove that there are infinitely many primes, step by step") >= 4);
  assert.equal(
    d("Design a scalable architecture for a chat app with 10M users. What are the trade-offs? How would you handle presence and message ordering across regions?"),
    5
  );
  assert.ok(d("Briefly, what is TCP?") <= 1);
  const long = "Please review this report. ".repeat(40);
  assert.ok(d(long) >= 4, "long input");
});

test("heuristic output, title and keywords", () => {
  const video = heuristicClassify("Make a 10 second vertical video of a dog surfing for tiktok", {});
  assert.deepEqual(video.output, { length: "medium", format: "video", duration_s: 10, aspect: "9:16" });
  assert.equal(heuristicClassify("Generate an image of a sunset in 16:9", {}).output.aspect, "16:9");
  assert.equal(heuristicClassify("Give me a table of planets and their moons", {}).output.format, "table");
  assert.equal(heuristicClassify("hi", {}).title, "New chat");
  const t = heuristicClassify("Can you please help me plan a trip to [LOCATION_1] with [PERSON_1] next week?", {}).title;
  assert.ok(t.split(" ").length <= 6, t);
  assert.ok(t.includes("[LOCATION_1]"), t);
  assert.equal(heuristicClassify("My doctor gave me a diagnosis of diabetes", {}).private, true);
  assert.equal(heuristicClassify("What's my salary after tax?", {}).private, true);
  assert.equal(heuristicClassify("Write a haiku about autumn", {}).private, false);
});
