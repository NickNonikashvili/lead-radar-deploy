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

test("rule 6: unavailable routes walk to the nearest tier (ties -> cheaper), then a fallback priced for the tier, then no_model", () => {
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

  // No routed cell usable: the plan's column still matters. Remaining chat models by typical price:
  // self 0.0005 < zdrAlt 0.00125 < plain 0.006 < alt 0.009.
  const noCells = setup({ down: [M.quality, M.balanced, M.budget] }).picker;
  const cheapest = noCells.pick({ job: "chat", difficulty: 1, user: { plan: "saver" } });
  assert.equal(cheapest.model.id, M.self, "budget -> cheapest remaining eligible model");
  assert.equal(cheapest.tier, "budget");
  assert.match(cheapest.reason, /using the cheapest available model/);
  const mid = noCells.pick({ job: "chat", difficulty: 3, user: {} });
  assert.equal(mid.model.id, M.zdrAlt, "balanced -> the middle price");
  assert.match(mid.reason, /using a mid-priced available model/);
  const top = noCells.pick({ job: "chat", difficulty: 5, user: { plan: "best" } });
  assert.equal(top.model.id, M.alt, "quality -> the dearest");
  assert.match(top.reason, /using the highest-priced available model/);

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

test("candidates: routed picks first (quality, balanced, budget), then alternates by price, cheapest first", () => {
  const { picker } = setup({ down: [M.zdrAlt] });
  const ids = picker.candidates({ job: "chat", user: {} }).map((m) => m.id);
  assert.deepEqual(ids, [M.quality, M.balanced, M.budget, M.self, M.plain, M.alt]);
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
  // Every outside candidate gone: a self-hosted text model is the last resort (our own servers).
  assert.equal((await make([CLASSIFIER_ID, first]).classifier.classify({ text: "fix the bug" })).classifierModel, M.self);
  const none = make([CLASSIFIER_ID, first, "selfhosted"]);
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
    // A contact detail after "email" / "text" is not a request to send something.
    "My name is [PERSON_1], email [EMAIL_1]. I am pregnant, what should I avoid?": "chat",
    "Call me at [PHONE_1] or email [EMAIL_1] about the party next week.": "chat",
    "My email is [EMAIL_1], what is a good password manager?": "chat",
    // ...unless it is a command.
    "Email [EMAIL_1] and tell them the meeting moved to 3pm.": "action",
    "Please email [EMAIL_1] the report.": "action",
    "Can you text [PHONE_1] that I am running late?": "action",
    "Draft the note, then email [EMAIL_1].": "action",
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

// ---------------------------------------------------------------------------------------------
// review fixes: local-first classifier, EU-only classifier, media follow-ups, keyword precision

const { _internal: classifyInternal } = require("../src/router/classify");

/** A classifier whose LLM must never be called; records any call. */
function guardedClassifier({ env = {}, down = [], classifierOver = {} } = {}) {
  return classifierSetup({
    env,
    down,
    classifierOver,
    completeJSON: async ({ model }) => ({ json: { ...GOOD_REPLY, job: "chat", title: model.id }, usage: { inputTokens: 10, outputTokens: 5, costUsd: null } }),
  });
}

test("a prompt the local signals call private never reaches an outside classifier", async () => {
  const text = "My psychiatrist changed my medication and I feel worse, what should I ask her?";
  // No self-hosted model: the heuristic classifies it, nothing is sent anywhere.
  const off = guardedClassifier({ down: ["selfhosted"] });
  const r = await off.classifier.classify({ text });
  assert.equal(r.private, true);
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(off.providers.calls.length, 0);
  // Strict privacy changes nothing about that.
  assert.equal((await off.classifier.classify({ text, zdrOnly: true })).classifierModel, "heuristic");
  // A high-risk redaction (card number) is a local signal too.
  const card = await off.classifier.classify({ text: "charge [CARD_1] for the order", redactionCounts: { CARD: 1 } });
  assert.equal(card.private, true);
  assert.equal(off.providers.calls.length, 0);

  // With a self-hosted model available, that model classifies it, on our own servers.
  const self = guardedClassifier();
  const s = await self.classifier.classify({ text, history: [{ role: "user", content: "earlier" }] });
  assert.equal(s.classifierModel, M.self);
  assert.equal(s.private, true, "the local verdict holds whatever the model says");
  assert.deepEqual(self.providers.calls.map((c) => c.model.id), [M.self]);
});

test("conversationPrivate: every turn is classified locally, even an innocent one", async () => {
  const off = guardedClassifier({ down: ["selfhosted"] });
  const r = await off.classifier.classify({ text: "Thanks, what should I ask at the next visit?", conversationPrivate: true });
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(off.providers.calls.length, 0, "no history of a private conversation leaves for classification");
  const self = guardedClassifier();
  assert.equal((await self.classifier.classify({ text: "Thanks!", conversationPrivate: true })).classifierModel, M.self);
  // Not private and not in a private conversation: the normal (outside) classifier.
  const normal = guardedClassifier();
  assert.equal((await normal.classifier.classify({ text: "What is the capital of France?" })).classifierModel, CLASSIFIER_ID);
});

test("euOnly: the classifier must be EU-hosted or self-hosted, else the heuristic", async () => {
  // The configured classifier is region 'us' in the fixture.
  const self = guardedClassifier();
  assert.equal((await self.classifier.classify({ text: "Draft a reply to my landlord", euOnly: true })).classifierModel, M.self);
  const none = guardedClassifier({ down: ["selfhosted"] });
  const r = await none.classifier.classify({ text: "Draft a reply to my landlord", euOnly: true });
  assert.equal(r.classifierModel, "heuristic");
  assert.equal(none.providers.calls.length, 0);
  const eu = guardedClassifier({ classifierOver: { region: "eu" } });
  assert.equal((await eu.classifier.classify({ text: "Draft a reply to my landlord", euOnly: true })).classifierModel, CLASSIFIER_ID);
  // EU-only and strict together need both: an EU model that is not zero-retention is skipped.
  const euNoZdr = guardedClassifier({ classifierOver: { region: "eu", zdr: false }, down: ["selfhosted"] });
  assert.equal((await euNoZdr.classifier.classify({ text: "hello there", euOnly: true, zdrOnly: true })).classifierModel, "heuristic");
});

test("media follow-ups get a self-contained media_prompt from the earlier request", async () => {
  const history = [
    { role: "user", content: "Draw a red fox in the snow at dawn" },
    { role: "assistant", content: "[image]" },
  ];
  const h = heuristicClassify("now make a video of it", {}, { history });
  assert.equal(h.job, "video");
  assert.equal(h.output.media_prompt, "Draw a red fox in the snow at dawn. Now make a video of it");
  // A request with its own subject, a chat job, or no history gets none.
  assert.equal(heuristicClassify("Draw a cat and make it photorealistic", {}, { history }).output.media_prompt, undefined);
  assert.equal(heuristicClassify("Make a 10 second video of waves crashing on rocks", {}, { history }).output.media_prompt, undefined);
  assert.equal(heuristicClassify("explain it again", {}, { history }).output.media_prompt, undefined);
  assert.equal(heuristicClassify("now make a video of it", {}).output.media_prompt, undefined);
  // A chain of follow-ups walks back to the request; placeholders are kept.
  const chain = [
    { role: "user", content: "Draw [PERSON_1] as a knight" },
    { role: "assistant", content: "[image]" },
    { role: "user", content: "make it blue" },
    { role: "assistant", content: "[image]" },
  ];
  assert.equal(classifyInternal.followUpMediaPrompt("now animate it", chain, "video"), "Draw [PERSON_1] as a knight. make it blue. Now animate it");
  // Text to speech reads its prompt aloud: a voice follow-up takes the previous answer's text.
  const said = [
    { role: "user", content: "Write a welcome line for my dental office" },
    { role: "assistant", content: "Welcome to Maple Street Dental!" },
  ];
  assert.equal(classifyInternal.followUpMediaPrompt("now read it aloud", said, "voice"), "Welcome to Maple Street Dental!");

  // The LLM path adds it too, from the same history.
  const { classifier } = classifierSetup({ completeJSON: async () => ({ json: { ...GOOD_REPLY, job: "video", output: { length: "short", format: "video" } }, usage: {} }) });
  const r = await classifier.classify({ text: "now make a video of it", history });
  assert.equal(r.output.media_prompt, "Draw a red fox in the snow at dawn. Now make a video of it");
});

test("a media follow-up in a private conversation is private; a standalone media prompt is not", async () => {
  const off = guardedClassifier({ down: ["selfhosted"] });
  const history = [{ role: "user", content: "Draw the floor plan of [PERSON_1]'s clinic" }];
  const follow = await off.classifier.classify({ text: "now make a video of it", history, conversationPrivate: true });
  assert.equal(follow.job, "video");
  assert.equal(follow.private, true, "its prompt quotes the private conversation");
  const alone = await off.classifier.classify({ text: "Draw a cat wearing a top hat, watercolor", history, conversationPrivate: true });
  assert.equal(alone.job, "image");
  assert.equal(alone.private, false, "only the latest message goes to the media model");
});

test("keyword privacy: personal disclosures are private, generic developer questions are not", () => {
  const kp = classifyInternal.keywordPrivate;
  const privateOnes = [
    "how do I read my bank statement",
    "My doctor gave me a diagnosis of diabetes",
    "What's my salary after tax?",
    "My psychiatrist changed my medication and I feel worse, what should I ask her?",
    "My HIV diagnosis came back positive, which medications should I ask about?",
    "My divorce lawyer says my custody case looks bad, what are my options?",
    "I was diagnosed with depression last month",
    "We are going through a divorce and need advice",
    "[PERSON_1]'s custody hearing is next week",
    "Mom's lab results came back high, should I worry?",
    "Therapy has helped me a lot, how do I keep going?",
    "What's my Netflix password?",
    "Is this a good password for my bank: Hunter2!",
    "Here is our seed phrase, is it safe to store in Notes?",
  ];
  const generic = [
    "Write a Node.js function that hashes passwords with bcrypt and verifies a login",
    "Add a confidential flag column to this Postgres table",
    "Build a React form for a medical appointment booking app",
    "Write a regex to validate a strong password",
    "How do I calculate salary percentiles in SQL?",
    "Explain how HIV attacks the immune system",
    "What is a seed phrase?",
    "I'm building a medical records app in Django",
    "Design a database schema for storing patient prescriptions",
    "Write unit tests for our password reset flow",
    "Add a salary column to my employees table",
    "Write a blog post about mental health awareness",
    "I need to store my users' passwords securely",
  ];
  for (const t of privateOnes) assert.equal(kp(t), true, t);
  for (const t of generic) assert.equal(kp(t), false, t);
  // The LLM verdict is then what decides a developer question.
  assert.equal(heuristicClassify("Write a regex to validate a strong password", {}).private, false);
});

test("keyword false positives no longer force a developer question private through the LLM path", async () => {
  const { classifier, providers } = classifierSetup({ completeJSON: async () => ({ json: { ...GOOD_REPLY, private: false }, usage: {} }) });
  const r = await classifier.classify({ text: "Write a Node.js function that hashes passwords with bcrypt and verifies a login" });
  assert.equal(r.private, false);
  assert.equal(r.classifierModel, CLASSIFIER_ID);
  assert.equal(providers.calls.length, 1);
});

// ---------------------------------------------------------------------------------------------
// review fixes: picker

test("conversationPrivate keeps text jobs private like a private pin; media follows its own classification", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, conversationPrivate: true });
  assert.equal(r.private, true);
  assert.equal(r.model.id, M.self);
  assert.match(r.reason, /earlier in this conversation/);
  assert.equal(picker.pick({ job: "code", difficulty: 2, user: {}, conversationPrivate: 1 }).private, true);
  const img = picker.pick({ job: "image", difficulty: 2, user: { plan: "best" }, conversationPrivate: true });
  assert.equal(img.private, false);
  assert.equal(img.model.id, M.imgQ);
  // Self-hosted down: a zero-retention model, never the public quality pick.
  const { picker: p2 } = setup({ down: ["selfhosted"] });
  const z = p2.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, conversationPrivate: true });
  assert.equal(z.private, true);
  assert.equal(z.zdrRequired, true);
  assert.notEqual(z.model.id, M.quality);
  // The switch menu applies it too.
  const menu = picker.candidates({ job: "chat", user: {}, conversationPrivate: true }).map((m) => m.id);
  assert.ok(menu.length && !menu.includes(M.quality) && !menu.includes(M.alt), menu.join());
});

test("private zero-retention fallback keeps its model and only upgrades (no bounce between turns)", () => {
  const { picker } = setup({ down: ["selfhosted"] });
  let pins = {};
  const used = [];
  for (const d of [2, 4, 1, 5, 2]) {
    const r = picker.pick({ job: "chat", difficulty: d, private: true, user: {}, pins });
    assert.equal(r.tier, "private");
    assert.equal(r.zdrRequired, true);
    used.push(r.model.id);
    if (r.pinsUpdate) pins = r.pinsUpdate;
  }
  assert.deepEqual(used, [M.budget, M.balanced, M.balanced, M.balanced, M.balanced]);
  assert.deepEqual(pins.chat, { model_id: M.balanced, tier: "private", source: "auto", routed_from: "balanced" });
  // A sticky-private follow-up (no classification) keeps it too.
  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: {}, pins }).model.id, M.balanced);
  // The self-hosted model comes back: it wins over the fallback pin.
  const { picker: up } = setup();
  const back = up.pick({ job: "chat", difficulty: 1, private: true, user: {}, pins });
  assert.equal(back.model.id, M.self);
  assert.deepEqual(back.pinsUpdate.chat, { model_id: M.self, tier: "private", source: "auto" });
  // A legacy fallback pin (no routed_from) is read from the cell that holds its model.
  const legacy = { chat: { model_id: M.balanced, tier: "private", source: "auto" } };
  const kept = picker.pick({ job: "chat", difficulty: 1, private: true, user: {}, pins: legacy });
  assert.equal(kept.model.id, M.balanced);
  assert.equal(kept.pinned, true);
  assert.equal(kept.pinsUpdate, null);
});

test("private media never writes or replaces the job's pin", () => {
  const { picker } = setup();
  const r = picker.pick({ job: "image", difficulty: 2, private: true, user: { plan: "best" } });
  assert.equal(r.model.id, M.imgC);
  assert.equal(r.pinsUpdate, null);
  // The next, non-private image in the chat is routed normally.
  assert.equal(picker.pick({ job: "image", difficulty: 2, user: { plan: "best" }, pins: {} }).model.id, M.imgQ);
  // A user's media pick survives a private request that can't use it.
  const userPin = { image: { model_id: M.imgQ, tier: "quality", source: "user" } };
  const p = picker.pick({ job: "image", difficulty: 2, private: true, user: { plan: "best" }, pins: userPin });
  assert.equal(p.model.id, M.imgC);
  assert.equal(p.pinsUpdate, null);
  // A stuck auto pin left by an older private media request is ignored and replaced.
  const stuck = { image: { model_id: M.imgC, tier: "private", source: "auto" } };
  const next = picker.pick({ job: "image", difficulty: 2, user: { plan: "best" }, pins: stuck });
  assert.equal(next.model.id, M.imgQ);
  assert.deepEqual(next.pinsUpdate.image, { model_id: M.imgQ, tier: "quality", source: "auto" });
});

test("effort is what the model really runs at (the provider's mapping), in Gode's vocabulary", () => {
  const { db, picker } = setup();
  upsertModel(db, textModel(M.balanced, { label: "T Balanced", region: "eu", zdr: true, price_in: 1, price_out: 3, params: { reasoning: { mandatory: false, efforts: ["high", "none"] } } }));
  upsertModel(db, textModel(M.budget, { label: "T Budget", region: "cn", zdr: true, price_in: 0.1, price_out: 0.3, params: { reasoning: { mandatory: false, efforts: ["max", "high", "low", "none"] } } }));
  upsertModel(db, textModel(M.quality, { label: "T Quality", price_in: 5, price_out: 25, params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } } }));
  upsertModel(db, textModel(M.alt, { label: "T Alt", price_in: 3, price_out: 12, params: { reasoning: { mandatory: true, efforts: ["minimal", "low", "medium"] } } }));
  assert.equal(picker.pick({ job: "chat", difficulty: 3, user: {} }).effort, "high", "[high, none] runs medium as high");
  assert.equal(picker.pick({ job: "chat", difficulty: 3, user: { plan: "saver" } }).effort, "low", "[max, high, low, none]: medium -> low");
  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: {}, overrideModelId: M.quality }).effort, "low", "mandatory reasoning: none -> low");
  assert.equal(picker.pick({ job: "chat", difficulty: 1, user: {}, overrideModelId: M.alt }).effort, "low", "minimal is shown as low");
  assert.equal(picker.pick({ job: "chat", difficulty: 5, user: {}, overrideModelId: M.plain }).effort, "none", "no reasoning support");
});

test("for every seeded reasoning model the picked effort is exactly what the provider sends", () => {
  const { seedCatalog, MODELS } = require("../src/seed/catalog");
  const { resolveEffort } = require("../src/providers/effort-map");
  const db = openDb(":memory:");
  seedCatalog(db);
  const picker = createPicker({ db, config: loadConfig({}), providers: { isAvailable: (m) => Boolean(m && m.enabled) } });
  for (const m of MODELS.filter((x) => x.supports_reasoning && x.jobs.includes("chat"))) {
    for (const d of [1, 2, 3, 4, 5]) {
      const r = picker.pick({ job: "chat", difficulty: d, user: {}, overrideModelId: m.id });
      assert.ok(["none", "low", "medium", "high"].includes(r.effort), `${m.id} d${d} ${r.effort}`);
      assert.equal(resolveEffort(r.model, r.effort), r.effort, `${m.id} d${d}`);
    }
  }
});

test("no usable routing cell (OpenAI-only deployment): the plan still picks cheap or strong", () => {
  const { db, picker } = setup({ down: ["openrouter", "selfhosted"] });
  upsertModel(db, textModel("openai:t/strong", { label: "T Strong", price_in: 8, price_out: 40 }));
  upsertModel(db, textModel("openai:t/cheap", { label: "T Cheap", price_in: 0.1, price_out: 0.5 }));
  const best = picker.pick({ job: "code", difficulty: 5, user: { plan: "best" } });
  assert.equal(best.model.id, "openai:t/strong");
  assert.equal(best.tier, "quality");
  const saver = picker.pick({ job: "chat", difficulty: 1, user: { plan: "saver" } });
  assert.equal(saver.model.id, "openai:t/cheap");
  // A conversation that started cheap upgrades to the strong fallback on a hard turn...
  const up = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, pins: saver.pinsUpdate });
  assert.equal(up.model.id, "openai:t/strong");
  assert.match(up.reason, /upgraded from budget/);
  // ...and never moves down again.
  const down = picker.pick({ job: "chat", difficulty: 1, user: { plan: "saver" }, pins: up.pinsUpdate });
  assert.equal(down.model.id, "openai:t/strong");
  assert.equal(down.pinned, true);
});

test("switch menu: current model first, then the routed picks, then the rest cheapest first", () => {
  const { picker } = setup({ down: [M.zdrAlt] });
  const pins = { chat: { model_id: M.alt, tier: "budget", source: "user" } };
  const ids = picker.candidates({ job: "chat", user: {}, pins }).map((m) => m.id);
  assert.deepEqual(ids, [M.alt, M.quality, M.balanced, M.budget, M.self, M.plain]);
  // The answer's own model wins over the pin when given.
  assert.deepEqual(picker.candidates({ job: "chat", user: {}, pins, currentModelId: M.budget }).map((m) => m.id).slice(0, 4), [M.budget, M.quality, M.balanced, M.self]);
  // An ineligible current model is simply left out.
  assert.equal(picker.candidates({ job: "chat", user: { eu_only: true }, currentModelId: M.quality })[0].id, M.balanced);
});

test("switch menu for a private media answer lists only what the switch would accept", () => {
  const { picker } = setup();
  const menu = picker.candidates({ job: "image", user: {}, private: true }).map((m) => m.id);
  assert.deepEqual(menu, [M.imgC]);
  for (const id of [M.imgQ, M.imgB]) {
    assert.throws(() => picker.pick({ job: "image", difficulty: 2, private: true, user: {}, overrideModelId: id }), { status: 400 });
  }
  assert.equal(picker.pick({ job: "image", difficulty: 2, private: true, user: {}, overrideModelId: M.imgC }).model.id, M.imgC);
});

test("pinSource says who chose the model", () => {
  const { picker } = setup();
  const auto = picker.pick({ job: "chat", difficulty: 3, user: {} });
  assert.equal(auto.pinSource, "auto");
  const mine = picker.pick({ job: "chat", difficulty: 1, user: {}, overrideModelId: M.alt });
  assert.equal(mine.pinSource, "user");
  assert.equal(mine.tier, "budget", "the request's column is unchanged");
  const later = picker.pick({ job: "chat", difficulty: 5, user: { plan: "best" }, pins: mine.pinsUpdate });
  assert.equal(later.model.id, M.alt);
  assert.equal(later.pinSource, "user");
  const media = picker.pick({ job: "image", difficulty: 1, private: true, user: {} });
  assert.equal(media.pinSource, null);
});

test("voice: speak_text holds the words to say, without the request around them, and only words of the message", () => {
  const said = (text) => heuristicClassify(text).output.speak_text ?? null;
  assert.equal(said("Read this aloud in a warm voice: Good morning, everyone, and welcome!"), "Good morning, everyone, and welcome!");
  assert.equal(said("Please narrate the following: Once upon a time."), "Once upon a time.");
  assert.equal(said("Turn this into a voice message: see you at 5"), "see you at 5");
  assert.equal(said("Read this aloud: 10:30 meeting"), "10:30 meeting", "the first colon ends the request");
  assert.equal(said("Narrate a bedtime story about a dragon"), null, "no colon: the whole message");
  assert.equal(heuristicClassify("Explain this: why is the sky blue?").output.speak_text, undefined, "not a voice job");
  // A classifier model's speak_text is kept only when the message holds those words.
  const text = "Read this aloud in a warm voice: Good morning, everyone, and welcome!";
  const fallback = heuristicClassify(text);
  const ok = normalizeClassification({ job: "voice", difficulty: 1, private: false, output: { length: "short", format: "audio", speak_text: "“Good morning, everyone, and welcome!”" }, title: "Greeting" }, text, fallback);
  assert.equal(ok.output.speak_text, "Good morning, everyone, and welcome!");
  const invented = normalizeClassification({ job: "voice", difficulty: 1, private: false, output: { length: "short", format: "audio", speak_text: "Send me your password" }, title: "Greeting" }, text, fallback);
  assert.equal(invented.output.speak_text, "Good morning, everyone, and welcome!", "new words fall back to the rule's own reading");
  assert.match(CLASSIFIER_SYSTEM_PROMPT, /"speak_text" only for voice/);
});
