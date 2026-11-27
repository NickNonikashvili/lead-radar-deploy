// Seed catalog: data invariants the router, billing and /privacy page rely on, plus the
// seed / export / import helpers and the scripts/seed.js CLI.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { openDb } = require("../src/db");
const catalog = require("../src/seed/catalog");

const {
  JOBS, TEXT_JOBS, MEDIA_JOBS, TIERS, MODELS, ROUTES, CLASSIFIER_MODEL_ID, CLASSIFIER_MODEL_CANDIDATES,
  validateModel, seedCatalog, setRoute, upsertModel, exportCatalog, importCatalog, getModel, listModels, getRoutes,
} = catalog;

const GATEWAYS = ["openrouter", "fal", "openai", "selfhosted"];
const REGIONS = ["us", "cn", "eu", "self"];
const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const PRICE_UNITS = ["image", "megapixel", "second", "song", "1k_chars", "minute", "request"];
const REQUIRED_KEYS = [
  "id", "label", "vendor", "region", "gateway", "slug", "jobs", "price_in", "price_out", "price_unit",
  "price_per_unit", "zdr", "retention_note", "open_weights", "self_hosted", "supports_reasoning",
  "context_length", "params",
];

const byId = new Map(MODELS.map((m) => [m.id, m]));
const isText = (m) => m.jobs.every((j) => TEXT_JOBS.includes(j));
const isMedia = (m) => m.jobs.every((j) => MEDIA_JOBS.includes(j));
const route = (job, tier) => ROUTES.find((r) => r.job === job && r.tier === tier);

function seededDb() {
  const db = openDb(":memory:");
  seedCatalog(db);
  return db;
}

/** The Model shape rowToModel should give back for a seed entry. */
function expectedModel(m) {
  return {
    id: m.id,
    label: m.label,
    vendor: m.vendor ?? null,
    region: m.region ?? null,
    gateway: m.gateway,
    slug: m.slug,
    jobs: m.jobs,
    price_in: m.price_in ?? null,
    price_out: m.price_out ?? null,
    price_unit: m.price_unit ?? null,
    price_per_unit: m.price_per_unit ?? null,
    zdr: Boolean(m.zdr),
    retention_note: m.retention_note ?? null,
    open_weights: Boolean(m.open_weights),
    self_hosted: Boolean(m.self_hosted),
    supports_reasoning: Boolean(m.supports_reasoning),
    context_length: m.context_length ?? null,
    params: m.params ?? {},
    enabled: m.enabled === undefined ? true : Boolean(m.enabled),
  };
}

const routeKey = (r) => ({ job: r.job, tier: r.tier, model_id: r.model_id, effort_override: r.effort_override ?? null });
const sortRoutes = (rs) => rs.map(routeKey).sort((a, b) => `${a.job}/${a.tier}`.localeCompare(`${b.job}/${b.tier}`));

// ---------- seeding ----------

test("seeding an empty :memory: database inserts every model and route with history", () => {
  const db = openDb(":memory:");
  const result = seedCatalog(db);
  assert.deepEqual(result, { seeded: true, models: MODELS.length, routes: ROUTES.length });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM models").get().n, MODELS.length);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM routes").get().n, ROUTES.length);
  const sources = db.prepare("SELECT DISTINCT source FROM routes").all().map((r) => r.source);
  assert.deepEqual(sources, ["seed"]);
  const history = db.prepare("SELECT * FROM route_history").all();
  assert.equal(history.length, ROUTES.length);
  assert.ok(history.every((h) => h.source === "seed" && h.reason === "initial seed" && h.old_model_id === null));
});

test("every seed model survives the DB round-trip unchanged", () => {
  const db = seededDb();
  for (const m of MODELS) assert.deepEqual(getModel(db, m.id), expectedModel(m), m.id);
  assert.equal(listModels(db, { enabledOnly: true }).length, MODELS.filter((m) => m.enabled !== false).length);
});

// ---------- routing table ----------

test("every job x tier has exactly one route, also in the DB", () => {
  assert.equal(ROUTES.length, JOBS.length * TIERS.length);
  const keys = new Set(ROUTES.map((r) => `${r.job}/${r.tier}`));
  assert.equal(keys.size, ROUTES.length, "duplicate job/tier cell");
  for (const job of JOBS) for (const tier of TIERS) assert.ok(route(job, tier), `missing route ${job}/${tier}`);
  const dbKeys = new Set(getRoutes(seededDb()).map((r) => `${r.job}/${r.tier}`));
  assert.deepEqual([...dbKeys].sort(), [...keys].sort());
});

test("every route points at a seed model that serves that job", () => {
  for (const r of ROUTES) {
    const m = byId.get(r.model_id);
    assert.ok(m, `route ${r.job}/${r.tier} -> unknown model ${r.model_id}`);
    assert.ok(m.jobs.includes(r.job), `${m.id} does not serve ${r.job}`);
    assert.ok(r.effort_override == null || ["none", "low", "medium", "high"].includes(r.effort_override));
  }
});

test("action routes mirror chat (phase 1)", () => {
  for (const tier of TIERS) assert.equal(route("action", tier).model_id, route("chat", tier).model_id, tier);
});

test("text private routes are self-hosted open weights; media private routes follow the ZDR rule", () => {
  for (const job of TEXT_JOBS) {
    const m = byId.get(route(job, "private").model_id);
    assert.equal(m.gateway, "selfhosted", job);
    assert.equal(m.self_hosted, true, job);
    assert.equal(m.zdr, true, job);
    assert.equal(m.region, "self", job);
    assert.equal(m.open_weights, true, job);
  }
  // Contract: best ZDR-flagged media model, or the budget pick when the job has none.
  for (const job of MEDIA_JOBS) {
    const privateModel = byId.get(route(job, "private").model_id);
    const zdrCandidates = MODELS.filter((m) => m.jobs.includes(job) && (m.zdr || m.self_hosted));
    if (zdrCandidates.length) assert.ok(privateModel.zdr || privateModel.self_hosted, job);
    else assert.equal(privateModel.id, route(job, "budget").model_id, job);
  }
});

test("quality, balanced and budget picks are distinct models for every job", () => {
  for (const job of JOBS) {
    const ids = ["quality", "balanced", "budget"].map((t) => route(job, t).model_id);
    assert.equal(new Set(ids).size, 3, job);
  }
});

test("each job has at least 3 candidates including unrouted alternates", () => {
  const routed = new Set(ROUTES.map((r) => r.model_id));
  for (const job of JOBS) {
    const candidates = MODELS.filter((m) => m.jobs.includes(job));
    assert.ok(candidates.length >= 3, `${job}: ${candidates.length} candidates`);
    assert.ok(candidates.some((m) => !routed.has(m.id)), `${job} has no alternate`);
  }
});

test("direct-OpenAI models cover chat, code and image for OpenAI-only deployments", () => {
  for (const job of ["chat", "code", "image"]) {
    assert.ok(MODELS.some((m) => m.gateway === "openai" && m.jobs.includes(job)), job);
  }
});

test("EU-only users have at least one EU or self-hosted model for every text job", () => {
  for (const job of TEXT_JOBS) {
    assert.ok(MODELS.some((m) => m.jobs.includes(job) && m.region === "eu"), job);
  }
});

// ---------- model rows ----------

test("model ids are unique, '<gateway>:<slug>', and pass validateModel", () => {
  assert.equal(byId.size, MODELS.length, "duplicate model id");
  for (const m of MODELS) {
    assert.ok(GATEWAYS.includes(m.gateway), m.id);
    assert.equal(m.id, `${m.gateway}:${m.slug}`);
    assert.deepEqual(validateModel(m), [], m.id);
  }
});

test("every model fills every column with a sensible value", () => {
  for (const m of MODELS) {
    for (const k of REQUIRED_KEYS) assert.ok(k in m, `${m.id} missing ${k}`);
    assert.ok(typeof m.label === "string" && m.label.length > 0 && m.label.length <= 32, `${m.id} label`);
    assert.ok(typeof m.vendor === "string" && m.vendor.length > 0, `${m.id} vendor`);
    assert.ok(REGIONS.includes(m.region), `${m.id} region ${m.region}`);
    for (const k of ["zdr", "open_weights", "self_hosted", "supports_reasoning"]) {
      assert.equal(typeof m[k], "boolean", `${m.id} ${k}`);
    }
    assert.ok(typeof m.retention_note === "string" && m.retention_note.length >= 40, `${m.id} retention_note`);
    assert.ok(m.params && typeof m.params === "object" && !Array.isArray(m.params), `${m.id} params`);
    assert.ok(isText(m) || isMedia(m), `${m.id} mixes text and media jobs`);
  }
});

test("self-hosted means region 'self' and zero retention, and nothing else claims 'self'", () => {
  for (const m of MODELS) {
    assert.equal(m.self_hosted, m.gateway === "selfhosted", m.id);
    assert.equal(m.region === "self", m.self_hosted, m.id);
    if (m.self_hosted) assert.equal(m.zdr, true, m.id);
  }
});

test("text models have token prices; media models have a unit price", () => {
  for (const m of MODELS) {
    if (isText(m)) {
      assert.ok(Number.isFinite(m.price_in) && m.price_in > 0, `${m.id} price_in`);
      assert.ok(Number.isFinite(m.price_out) && m.price_out > 0, `${m.id} price_out`);
      assert.equal(m.price_unit, null, `${m.id} price_unit`);
      assert.equal(m.price_per_unit, null, `${m.id} price_per_unit`);
      assert.ok(Number.isInteger(m.context_length) && m.context_length >= 32768, `${m.id} context_length`);
    } else {
      assert.ok(PRICE_UNITS.includes(m.price_unit), `${m.id} price_unit ${m.price_unit}`);
      assert.ok(Number.isFinite(m.price_per_unit) && m.price_per_unit > 0, `${m.id} price_per_unit`);
      assert.equal(m.price_in, null, `${m.id} price_in`);
      assert.equal(m.price_out, null, `${m.id} price_out`);
      assert.equal(m.supports_reasoning, false, `${m.id} supports_reasoning`);
    }
  }
});

test("params.reasoning matches supports_reasoning and only uses known effort levels", () => {
  for (const m of MODELS) {
    const r = m.params.reasoning;
    if (!m.supports_reasoning) {
      assert.equal(r, undefined, `${m.id} has reasoning params but no reasoning support`);
      continue;
    }
    assert.ok(r && typeof r.mandatory === "boolean", `${m.id} reasoning.mandatory`);
    assert.ok(Array.isArray(r.efforts) && r.efforts.length > 0, `${m.id} reasoning.efforts`);
    assert.equal(new Set(r.efforts).size, r.efforts.length, `${m.id} duplicate efforts`);
    for (const e of r.efforts) assert.ok(EFFORT_LEVELS.includes(e), `${m.id} unknown effort ${e}`);
    // A mandatory-reasoning endpoint rejects 'none'; an optional one must offer it so easy requests
    // can skip thinking (the main cost saving).
    assert.equal(r.efforts.includes("none"), !r.mandatory, `${m.id} none vs mandatory`);
  }
});

test("media defaults bound the cost the unit price assumes", () => {
  for (const m of MODELS.filter(isMedia)) {
    const p = m.params;
    assert.equal(p.reasoning, undefined, m.id);
    if (m.price_unit === "second") {
      // Per-second video: duration and resolution must be pinned (fal defaults to 1080p for Wan 3.0).
      assert.ok(Number.isFinite(parseFloat(p.duration)) && parseFloat(p.duration) <= 10, `${m.id} duration`);
      assert.ok(typeof p.resolution === "string", `${m.id} resolution`);
    }
    if (m.price_unit === "minute") assert.ok(p.music_length_ms <= 60000, `${m.id} bills one minute at most`);
    if (m.jobs.includes("image") && m.gateway === "fal") assert.equal(p.num_images, 1, m.id);
    if (m.jobs.includes("image") && m.gateway === "openai") assert.equal(p.size, "1024x1024", m.id);
    if (m.jobs.includes("voice")) assert.ok([undefined, "text"].includes(p.prompt_field), `${m.id} prompt_field`);
  }
  // ElevenLabs and Qwen TTS take their text in a field named "text", not "prompt".
  for (const id of ["fal:elevenlabs/tts/eleven-v4", "fal:elevenlabs/tts/eleven-v4-turbo", "fal:alibaba/qwen-audio-3-tts"]) {
    assert.equal(byId.get(id).params.prompt_field, "text", id);
  }
});

test("voice models declare the longest text they accept (params.max_chars)", () => {
  const expected = {
    "fal:alibaba/qwen-audio-3-tts": 2000,
    "fal:elevenlabs/tts/eleven-v4": 5000,
    "fal:elevenlabs/tts/eleven-v4-turbo": 5000,
    "fal:fal-ai/elevenlabs/tts/eleven-v3": 3000, // no documented limit found: conservative
    "fal:fal-ai/minimax/speech-2.8-hd": 5000, // no documented limit found: safe cap
  };
  for (const [id, n] of Object.entries(expected)) assert.equal(byId.get(id).params.max_chars, n, id);
  for (const m of MODELS.filter((x) => x.jobs.includes("voice"))) {
    assert.ok(Number.isInteger(m.params.max_chars) && m.params.max_chars > 0, `${m.id} has no max_chars`);
  }
  for (const m of MODELS.filter((x) => !x.jobs.includes("voice"))) assert.equal(m.params.max_chars, undefined, m.id);
});

test("EU-region OpenRouter models are pinned to their EU host with no fallback", () => {
  const { providerPreferences } = require("../src/providers/openrouter");
  const eu = MODELS.filter((m) => m.gateway === "openrouter" && m.region === "eu");
  assert.deepEqual(eu.map((m) => m.id).sort(), ["openrouter:mistralai/ministral-3b-2512", "openrouter:mistralai/mistral-large-4-0"]);
  for (const m of eu) {
    assert.deepEqual(m.params.openrouter_provider, { only: ["mistral"], allow_fallbacks: false }, m.id);
    assert.equal(m.zdr, true, `${m.id}: the pinned host is also its zero-retention endpoint`);
  }
  // Every pin in the catalog passes the adapter's validation (a bad one would fail every request).
  for (const m of MODELS) {
    if (m.params.openrouter_provider !== undefined) assert.equal(m.gateway, "openrouter", `${m.id}: openrouter_provider on another gateway`);
    assert.doesNotThrow(() => providerPreferences(m), m.id);
  }
});

test("text model params hold only adapter inputs, never upstream body fields", () => {
  for (const m of MODELS.filter(isText)) {
    for (const k of Object.keys(m.params)) assert.ok(["reasoning", "openrouter_provider", "pricing"].includes(k), `${m.id} params.${k}`);
    // params.pricing only matters where the gateway reports no cost.
    if (m.params.pricing) assert.notEqual(m.gateway, "openrouter", `${m.id}: OpenRouter reports the real cost`);
  }
});

test("direct-OpenAI models carry their cache-read and long-prompt rates", () => {
  const astra = byId.get("openai:gpt-6.2-astra");
  assert.deepEqual(astra.params.pricing, { cached_in: 0.4, long_context: { above_input_tokens: 272000, in_mult: 2, out_mult: 1.5 } });
  assert.deepEqual(catalog.textRates(astra, 1000), { in: 8, out: 40, cachedIn: 0.4 });
  assert.deepEqual(catalog.textRates(astra, 272001), { in: 16, out: 60, cachedIn: 0.8 });
  assert.deepEqual(catalog.textRates(astra, 272000), { in: 8, out: 40, cachedIn: 0.4 }, "the long rate starts above the threshold");
  assert.equal(byId.get("openai:gpt-6-luna").params.pricing.cached_in, 0.01);
  // No params.pricing: cached tokens cost the input rate, unknown prices stay unknown.
  assert.deepEqual(catalog.textRates(byId.get("openai:gpt-6.2-sol"), 500000), { in: 2, out: 10, cachedIn: 2 });
  assert.deepEqual(catalog.textRates({ price_in: null, price_out: null }, 10), { in: null, out: null, cachedIn: null });
});

test("media models with a duration input list the durations their endpoint accepts", () => {
  for (const m of MODELS.filter(isMedia)) {
    const p = m.params;
    if (p.duration_options === undefined) continue;
    assert.notEqual(p.duration, undefined, `${m.id}: duration_options without a default duration`);
    assert.deepEqual(catalog.validateParams(p), [], m.id);
    // The catalog default is itself one of the allowed values.
    assert.equal(catalog.durationFor(m, parseFloat(p.duration)), p.duration, m.id);
  }
  for (const id of ["fal:fal-ai/veo3.1/lite", "fal:fal-ai/veo3.1", "fal:alibaba/wan-3.0/text-to-video", "fal:fal-ai/ltx-2.3/text-to-video/fast"]) {
    assert.ok(byId.get(id).params.duration_options, `${id} has duration_options`);
  }
  const veo = byId.get("fal:fal-ai/veo3.1/lite");
  const wan = byId.get("fal:alibaba/wan-3.0/text-to-video");
  const ltx = byId.get("fal:fal-ai/ltx-2.3/text-to-video/fast");
  assert.equal(catalog.durationFor(veo, 5), "4s", "a tie goes to the shorter, cheaper clip");
  assert.equal(catalog.durationFor(veo, 7), "6s");
  assert.equal(catalog.durationFor(veo, 20), "8s");
  assert.equal(catalog.durationFor(wan, 20), 20);
  assert.equal(catalog.durationFor(wan, 0.5), 2, "clamped up to the shortest allowed clip");
  assert.equal(catalog.durationFor(wan, 1), 2);
  assert.equal(catalog.durationFor(wan, 90), 30);
  assert.equal(catalog.durationFor(ltx, 13), 12);
  assert.equal(catalog.durationFor(ltx, 3), 6);
  assert.equal(catalog.durationFor(veo, undefined), null);
  assert.equal(catalog.durationFor(veo, -4), null);
  // No duration input (ElevenLabs Music uses music_length_ms) or no options: the default stays.
  assert.equal(catalog.durationFor(byId.get("fal:elevenlabs/music/v2.5"), 20), null);
  assert.equal(catalog.durationFor({ params: { duration: 5 } }, 20), null);
  assert.equal(catalog.durationFor({ params: { duration: "5", duration_options: { min: 2, max: 10 } } }, 8), "8");
  assert.equal(catalog.durationFor({ params: { duration: "5s", duration_options: { min: 2, max: 10 } } }, 8), "8s");
});

test("direct-OpenAI image models store WebP, not multi-megabyte PNG data URLs", () => {
  const images = MODELS.filter((m) => m.gateway === "openai" && m.jobs.includes("image"));
  assert.equal(images.length, 3);
  for (const m of images) {
    assert.equal(m.params.output_format, "webp", m.id);
    assert.equal(m.params.output_compression, 85, m.id);
  }
});

test("Google, direct-OpenAI and fal models are not marked zero-retention", () => {
  for (const m of MODELS) {
    if (m.vendor === "Google" || m.gateway === "openai" || m.gateway === "fal") assert.equal(m.zdr, false, m.id);
  }
});

// ---------- classifier ----------

test("classifier ids exist, serve chat, and can run without reasoning", () => {
  assert.equal(CLASSIFIER_MODEL_CANDIDATES[0], CLASSIFIER_MODEL_ID);
  assert.ok(CLASSIFIER_MODEL_CANDIDATES.length >= 2);
  for (const id of CLASSIFIER_MODEL_CANDIDATES) {
    const m = byId.get(id);
    assert.ok(m, `unknown classifier model ${id}`);
    assert.ok(m.jobs.includes("chat"), id);
    assert.ok(m.price_in <= 0.2 && m.price_out <= 1, `${id} is not cheap`);
    if (m.supports_reasoning) assert.ok(m.params.reasoning.efforts.includes("none"), `${id} cannot disable reasoning`);
  }
  // A deployment with only an OpenAI key must still classify with a model.
  assert.ok(CLASSIFIER_MODEL_CANDIDATES.some((id) => byId.get(id).gateway === "openai"));
});

// ---------- re-seed / force ----------

test("re-seeding without force is a no-op", () => {
  const db = seededDb();
  setRoute(db, { job: "chat", tier: "quality", model_id: "openai:gpt-6.2-astra" }, { source: "admin", reason: "test" });
  const historyBefore = db.prepare("SELECT COUNT(*) AS n FROM route_history").get().n;
  const priceBefore = getModel(db, "openai:gpt-6.2-astra").price_in;

  assert.deepEqual(seedCatalog(db), { seeded: false });

  const r = db.prepare("SELECT * FROM routes WHERE job = 'chat' AND tier = 'quality'").get();
  assert.equal(r.model_id, "openai:gpt-6.2-astra");
  assert.equal(r.source, "admin");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM route_history").get().n, historyBefore);
  assert.equal(getModel(db, "openai:gpt-6.2-astra").price_in, priceBefore);
});

test("re-seeding with force upserts seed models and seeded routes, keeping extra models", () => {
  const db = seededDb();
  const carbon = byId.get("openrouter:google/gemini-4-carbon");
  upsertModel(db, { ...carbon, price_in: 99, enabled: false });
  setRoute(db, { job: "chat", tier: "quality", model_id: "openai:gpt-6.2-astra" }, { source: "admin" });
  const extra = { ...byId.get("openai:gpt-6-luna"), id: "openai:gpt-custom", slug: "gpt-custom", label: "Custom" };
  upsertModel(db, extra);

  const result = seedCatalog(db, { force: true });
  assert.deepEqual(result, { seeded: true, models: MODELS.length, routes: ROUTES.length });

  assert.deepEqual(getModel(db, carbon.id), expectedModel(carbon));
  const r = db.prepare("SELECT * FROM routes WHERE job = 'chat' AND tier = 'quality'").get();
  assert.equal(r.model_id, carbon.id);
  assert.equal(r.source, "seed");
  const last = db
    .prepare("SELECT * FROM route_history WHERE job = 'chat' AND tier = 'quality' ORDER BY id DESC LIMIT 1")
    .get();
  assert.equal(last.old_model_id, "openai:gpt-6.2-astra");
  assert.equal(last.new_model_id, carbon.id);
  assert.equal(last.reason, "reseed");
  assert.ok(getModel(db, extra.id), "non-seed model must survive a forced reseed");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM models").get().n, MODELS.length + 1);
});

// ---------- export / import ----------

test("export -> import into an empty database round-trips models and routes", () => {
  const source = seededDb();
  const exported = exportCatalog(source);
  assert.equal(exported.models.length, MODELS.length);
  assert.equal(exported.routes.length, ROUTES.length);

  // Through JSON, as the admin export/import endpoints do.
  const payload = JSON.parse(JSON.stringify(exported));
  const target = openDb(":memory:");
  assert.deepEqual(importCatalog(target, payload), { models: MODELS.length, routes: ROUTES.length });

  const again = exportCatalog(target);
  assert.deepEqual(again.models, exported.models);
  assert.deepEqual(sortRoutes(again.routes), sortRoutes(exported.routes));
  assert.deepEqual(sortRoutes(again.routes), sortRoutes(ROUTES));
  assert.ok(again.routes.every((r) => r.source === "admin"));
});

test("import rejects an invalid model without writing anything", () => {
  const db = openDb(":memory:");
  const good = byId.get("openai:gpt-6-luna");
  const bad = { ...good, id: "openai:wrong", slug: "gpt-6-luna" };
  assert.throws(() => importCatalog(db, { models: [good, bad], routes: [] }), (e) => e.status === 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM models").get().n, 0);
});

test("validateModel checks the catalog-only params keys adapters read on every request", () => {
  const luna = byId.get("openai:gpt-6-luna");
  const withParams = (params) => catalog.validateModel({ ...luna, params });
  assert.deepEqual(withParams({}), []);
  assert.deepEqual(withParams({ openrouter_provider: { only: ["mistral"], allow_fallbacks: false }, max_chars: 2000 }), []);
  assert.match(withParams({ openrouter_provider: { onyl: ["mistral"] } }).join(), /openrouter_provider\.onyl is not a supported provider setting/);
  assert.match(withParams({ openrouter_provider: { allow_fallbacks: "no" } }).join(), /allow_fallbacks has the wrong type/);
  for (const bad of [0, -5, 2.5, "2000"]) assert.match(withParams({ max_chars: bad }).join(), /max_chars must be a positive whole number/, String(bad));
  assert.match(withParams({ prompt_field: "te xt" }).join(), /prompt_field/);
  assert.match(withParams({ reasoning: { efforts: ["ultra"] } }).join(), /reasoning\.efforts/);
  assert.match(withParams({ reasoning: { mandatory: "yes" } }).join(), /reasoning\.mandatory/);
  assert.match(withParams([]).join(), /params must be an object/);
  // pricing
  assert.deepEqual(withParams({ pricing: { cached_in: 0.01, long_context: { above_input_tokens: 272000, in_mult: 2, out_mult: 1.5 } } }), []);
  assert.match(withParams({ pricing: "cheap" }).join(), /params\.pricing must be an object/);
  assert.match(withParams({ pricing: { cached: 0.1 } }).join(), /params\.pricing\.cached is not supported/);
  assert.match(withParams({ pricing: { cached_in: -1 } }).join(), /cached_in must be a price/);
  assert.match(withParams({ pricing: { long_context: { above_input_tokens: 1.5 } } }).join(), /above_input_tokens must be a positive whole number/);
  assert.match(withParams({ pricing: { long_context: { above_input_tokens: 10, in_mult: 0 } } }).join(), /in_mult must be a positive number/);
  assert.match(withParams({ pricing: { long_context: { above_input_tokens: 10, tier: 2 } } }).join(), /long_context\.tier is not supported/);
  // duration_options
  assert.deepEqual(withParams({ duration: "4s", duration_options: ["4s", "6s", 8] }), []);
  assert.deepEqual(withParams({ duration: 5, duration_options: { min: 2, max: 30 } }), []);
  assert.match(withParams({ duration_options: [4] }).join(), /needs a default params\.duration/);
  assert.match(withParams({ duration: 4, duration_options: [] }).join(), /1 to 100 durations/);
  assert.match(withParams({ duration: 4, duration_options: ["four"] }).join(), /entries must be durations/);
  assert.match(withParams({ duration: 4, duration_options: { min: 5, max: 2 } }).join(), /0 < min <= max/);
  assert.match(withParams({ duration: 4, duration_options: { min: 1, max: 5, step: 2 } }).join(), /0 < min <= max/);
  assert.match(withParams({ duration: 4, duration_options: "4s" }).join(), /a list or \{ min, max \}/);
});

test("validateModel ties privacy flags to what the gateway can enforce", () => {
  const flash = byId.get("openrouter:deepseek/deepseek-v4.1-flash");
  const sol = byId.get("openai:gpt-6.2-sol");
  const flux = byId.get("fal:blackforestlabs/flux-3/klein/text-to-image");
  const self = byId.get("selfhosted:qwen3.8-27b");
  // self_hosted and region "self" only on the selfhosted gateway (that gateway alone gets real text).
  assert.match(validateModel({ ...flash, self_hosted: true }).join(), /self_hosted is only for models on the selfhosted gateway/);
  assert.match(validateModel({ ...flash, region: "self" }).join(), /region "self" is only for/);
  assert.deepEqual(validateModel(self), []);
  // zdr: never on fal; on openai only when OpenAI approved zero retention for the key.
  assert.match(validateModel({ ...flux, zdr: true }).join(), /zdr is not possible on fal/);
  assert.match(validateModel({ ...sol, zdr: true }).join(), /OPENAI_ZDR_APPROVED/);
  assert.deepEqual(validateModel({ ...sol, zdr: true }, { openaiZdrApproved: true }), []);
  assert.deepEqual(validateModel({ ...flash, zdr: true }), [], "OpenRouter enforces zdr per request");

  // importCatalog applies the same rules (an export with a mislabelled row is refused).
  const db = openDb(":memory:");
  assert.throws(() => importCatalog(db, { models: [{ ...flash, self_hosted: true }], routes: [] }), (e) => e.status === 400 && /self_hosted/.test(e.message));
  assert.throws(() => importCatalog(db, { models: [{ ...sol, zdr: true }], routes: [] }), (e) => e.status === 400);
  assert.deepEqual(importCatalog(db, { models: [{ ...sol, zdr: true }], routes: [] }, { openaiZdrApproved: true }), { models: 1, routes: 0 });
});

test("repairCatalog clears privacy flags old rows claim but their gateway can't enforce", () => {
  const db = openDb(":memory:");
  seedCatalog(db);
  assert.deepEqual(catalog.repairCatalog(db), [], "the seeds are clean");
  const flash = "openrouter:deepseek/deepseek-v4.1-flash";
  const sol = "openai:gpt-6.2-sol";
  const flux = "fal:blackforestlabs/flux-3/klein/text-to-image";
  db.prepare("UPDATE models SET self_hosted = 1, region = 'self' WHERE id = ?").run(flash);
  db.prepare("UPDATE models SET zdr = 1 WHERE id IN (?, ?)").run(sol, flux);
  // With OpenAI's approval the openai zdr flag is legitimate and stays.
  assert.deepEqual(catalog.repairCatalog(db, { openaiZdrApproved: true }), [flux, flash].sort());
  assert.equal(getModel(db, sol).zdr, true);
  assert.deepEqual(catalog.repairCatalog(db), [sol]);
  const fixed = getModel(db, flash);
  assert.equal(fixed.self_hosted, false);
  assert.equal(fixed.region, null);
  assert.equal(fixed.zdr, true, "OpenRouter's own zdr flag is untouched");
  assert.equal(getModel(db, flux).zdr, false);
  assert.equal(getModel(db, sol).zdr, false);
  assert.equal(getModel(db, "selfhosted:qwen3.8-27b").self_hosted, true);
  assert.deepEqual(catalog.repairCatalog(db), []);
});

test("setRoute and importCatalog report bad input as AppError 400", () => {
  const { AppError } = require("../src/util");
  const db = openDb(":memory:");
  seedCatalog(db);
  const is400 = (e) => e instanceof AppError && e.status === 400 && e.code === "bad_request";
  assert.throws(() => setRoute(db, { job: "chat", tier: "budget", model_id: "openai:nope" }), (e) => is400(e) && /unknown model/.test(e.message));
  assert.throws(() => setRoute(db, { job: "dance", tier: "budget", model_id: "openai:gpt-6-luna" }), (e) => is400(e) && /unknown job/.test(e.message));
  assert.throws(() => setRoute(db, { job: "chat", tier: "budget", model_id: "openai:gpt-6-luna", effort_override: "max" }), is400);
  const bad = { ...byId.get("openai:gpt-6-luna"), params: { max_chars: -1 } };
  assert.throws(() => importCatalog(db, { models: [bad], routes: [] }), (e) => is400(e) && /models\[0\]: params\.max_chars/.test(e.message));
});

// ---------- scripts/seed.js ----------

function runSeedCli(args, dbPath) {
  const script = path.join(__dirname, "..", "scripts", "seed.js");
  // Minimal env so no real gateway keys or a developer's DATABASE_PATH leak into the run.
  const env = { PATH: process.env.PATH, DATABASE_PATH: dbPath, NODE_ENV: "test" };
  return spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", cwd: path.join(__dirname, "..") });
}

test("scripts/seed.js seeds a database file, is a no-op on rerun, and reseeds with --force", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-seed-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, "nested", "gode.db");

  const first = runSeedCli([], dbPath);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, new RegExp(`Seeded ${MODELS.length} models and ${ROUTES.length} routes`));
  assert.match(first.stdout, new RegExp(`Default classifier: ${CLASSIFIER_MODEL_ID.replace(/[.]/g, "\\.")}`));

  const second = runSeedCli([], dbPath);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /nothing changed/);

  const forced = runSeedCli(["--force"], dbPath);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, new RegExp(`Re-seeded ${MODELS.length} models`));

  const db = openDb(dbPath);
  t.after(() => db.close());
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM models").get().n, MODELS.length);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM routes").get().n, ROUTES.length);
});

test("scripts/seed.js rejects unknown arguments with exit code 2", () => {
  const res = runSeedCli(["--forse"], path.join(os.tmpdir(), "gode-seed-unused.db"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown argument: --forse/);
  assert.match(res.stderr, /Usage: node scripts\/seed\.js/);
});

test("seed CLI parser and messages", () => {
  const { parseArgs, describeResult } = require("../scripts/seed");
  assert.deepEqual(parseArgs([]), { force: false, help: false });
  assert.deepEqual(parseArgs(["--force"]), { force: true, help: false });
  assert.deepEqual(parseArgs(["-h"]), { force: false, help: true });
  assert.throws(() => parseArgs(["x"]), /unknown argument/);
  const lines = describeResult(
    { seeded: false },
    { force: false, databasePath: "/x.db", models: 3, routes: 4, classifierModelId: "a:b" }
  );
  assert.match(lines[0], /already has 3 models/);
  assert.match(lines[1], /3 models, 4 routes\. Default classifier: a:b\./);
});
