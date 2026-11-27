// Defence in depth for the self_hosted flag: the picker, the classifier and the admin routing
// rules decide "runs on our own servers" by the gateway, never by the editable flag (validateModel
// and the boot-time repairCatalog keep bad rows out, but a row written before those rules existed,
// or by hand, must not open a privacy hole). Plus the classifier's own call pricing.
const test = require("node:test");
const assert = require("node:assert/strict");

const { openDb } = require("../src/db");
const { loadConfig } = require("../src/config");
const { upsertModel, setRoute, onOwnServers, privateSafe } = require("../src/seed/catalog");
const { createClassifier, _internal } = require("../src/router/classify");
const { createPicker } = require("../src/router/pick");

const TEXT = ["chat", "code", "action"];
function textModel(id, over = {}) {
  const i = id.indexOf(":");
  return {
    id, label: over.label || id.slice(i + 1), vendor: "Test", region: "us", gateway: id.slice(0, i), slug: id.slice(i + 1), jobs: TEXT,
    price_in: 1, price_out: 2, price_unit: null, price_per_unit: null, zdr: false, retention_note: null, open_weights: false,
    self_hosted: false, supports_reasoning: true, context_length: 100000, params: {}, enabled: true, ...over,
  };
}

// A third-party model whose row claims self_hosted (and region "self"), but is not zero-retention.
const FAKE_SELF = "openrouter:t/claims-self-hosted";
const ZDR = "openrouter:t/zdr";
const PLAIN = "openrouter:t/plain";
const OWN = "selfhosted:t/own";

function fixture() {
  const db = openDb(":memory:");
  upsertModel(db, textModel(FAKE_SELF, { label: "Claims Self", self_hosted: true, region: "self", price_in: 0.1, price_out: 0.2 }));
  upsertModel(db, textModel(ZDR, { label: "ZDR", zdr: true, price_in: 1, price_out: 3 }));
  upsertModel(db, textModel(PLAIN, { label: "Plain", price_in: 2, price_out: 8 }));
  for (const job of ["chat", "code"]) {
    for (const tier of ["quality", "balanced", "budget"]) setRoute(db, { job, tier, model_id: PLAIN }, { source: "seed" });
    // Written straight to the table, as an old row could be: the admin route would refuse it.
    db.prepare("INSERT OR REPLACE INTO routes (job, tier, model_id, effort_override, source, updated_at) VALUES (?, 'private', ?, NULL, 'seed', ?)").run(job, FAKE_SELF, Date.now());
  }
  return db;
}

const providers = (calls = []) => ({
  calls,
  isAvailable: (m) => Boolean(m && m.enabled),
  get: () => ({
    completeJSON: async (args) => {
      calls.push(args.model.id);
      return { json: { job: "chat", difficulty: 2, private: true, output: { length: "short", format: "text" }, title: "x" }, usage: { inputTokens: 10, outputTokens: 5 } };
    },
  }),
});

test("onOwnServers and privateSafe read the gateway, not the flag", () => {
  assert.equal(onOwnServers(textModel(FAKE_SELF, { self_hosted: true })), false);
  assert.equal(onOwnServers(textModel(OWN)), true);
  assert.equal(privateSafe(textModel(FAKE_SELF, { self_hosted: true })), false);
  assert.equal(privateSafe(textModel(ZDR, { zdr: true })), true);
  assert.equal(privateSafe(textModel(OWN)), true);
  assert.equal(privateSafe(null), false);
});

test("the picker never treats a mislabelled third-party model as private-safe", async () => {
  const db = fixture();
  const picker = createPicker({ db, config: loadConfig({}), providers: providers() });
  const user = { plan: "balanced", strict_privacy: 0, eu_only: 0 };
  const r = await picker.pick({ job: "chat", difficulty: 2, private: true, user, pins: {} });
  assert.notEqual(r.model.id, FAKE_SELF, "a private request must not go to a model whose only claim is the flag");
  assert.equal(r.model.id, ZDR);
  assert.equal(r.zdrRequired, true);
  // Strict privacy: the same rule.
  const strict = await picker.pick({ job: "chat", difficulty: 2, private: false, user: { ...user, strict_privacy: 1 }, pins: {} });
  assert.equal(strict.model.id, ZDR);
  // And the switch menu for a private chat does not offer it.
  const menu = picker.candidates({ job: "chat", user, private: true, pins: {} }).map((m) => m.id);
  assert.ok(!menu.includes(FAKE_SELF));
  // EU-only: its region "self" does not make a third-party model EU-hosted.
  const eu = picker.candidates({ job: "chat", user: { ...user, eu_only: 1 }, private: false, pins: {} }).map((m) => m.id);
  assert.ok(!eu.includes(FAKE_SELF));
});

test("a prompt our own checks call private is never classified by a mislabelled third-party model", async () => {
  const db = fixture();
  const calls = [];
  const classifier = createClassifier({ config: loadConfig({ CLASSIFIER_MODEL_ID: FAKE_SELF }), db, providers: providers(calls), logger: { warn() {} } });
  const r = await classifier.classify({ text: "My psychiatrist says my depression is getting worse.", history: [], redactionCounts: {} });
  assert.equal(r.private, true);
  assert.deepEqual(calls, [], "no outside model saw it");
  assert.equal(r.classifierModel, "heuristic");
  // EU-only: region "self" on a third-party gateway is not EU, so the heuristic again.
  const eu = await classifier.classify({ text: "What's a good name for a cat?", history: [], redactionCounts: {}, euOnly: true });
  assert.deepEqual(calls, []);
  assert.equal(eu.classifierModel, "heuristic");
});

test("the classifier call is priced with the model's cache and long-context rates (direct OpenAI reports no cost)", () => {
  const luna = textModel("openai:t/luna", { price_in: 0.1, price_out: 0.4, params: { pricing: { cached_in: 0.01, long_context: { above_input_tokens: 1000, in_mult: 2, out_mult: 1.5 } } } });
  // 600 input tokens, 400 of them cached, 100 output: 200 x 0.1 + 400 x 0.01 + 100 x 0.4 = 64 micros.
  assert.deepEqual(_internal.usageFrom({ inputTokens: 600, outputTokens: 100, cachedTokens: 400 }, luna), { inputTokens: 600, outputTokens: 100, costMicros: 64 });
  // Above the threshold: input x2 (cached too), output x1.5. 1000 x 0.2 + 1000 x 0.02 + 100 x 0.6 = 280.
  assert.deepEqual(_internal.usageFrom({ inputTokens: 2000, outputTokens: 100, cachedTokens: 1000 }, luna).costMicros, 280);
  // A reported cost still wins.
  assert.equal(_internal.usageFrom({ inputTokens: 2000, outputTokens: 100, costUsd: 0.0005 }, luna).costMicros, 500);
  // Without pricing params: plain rates, cached tokens at the input rate.
  assert.equal(_internal.usageFrom({ inputTokens: 600, outputTokens: 100, cachedTokens: 400 }, textModel(PLAIN)).costMicros, 600 * 1 + 100 * 2);
});
