// Seed model catalog + routing table, and helpers to read/write it.
// The routing table is DATA: admins edit it in /#/admin and the weekly learner rewrites picks.
// These seeds only fill an empty database (or `npm run seed -- --force`).
const { now, safeJsonParse } = require("../util");

const JOBS = ["chat", "code", "image", "video", "music", "voice", "action"];
const TEXT_JOBS = ["chat", "code", "action"];
const MEDIA_JOBS = ["image", "video", "music", "voice"];
const TIERS = ["quality", "balanced", "budget", "private"];

// ---- filled from the Nov 2026 research (see docs/ARCHITECTURE.md "Seed catalog") ----
/** @type {Array<object>} */
const MODELS = [];
/** @type {Array<{job:string,tier:string,model_id:string,effort_override?:string|null}>} */
const ROUTES = [];
const CLASSIFIER_MODEL_ID = "";
/** Ordered classifier fallbacks; the classifier uses the first enabled + available one. */
const CLASSIFIER_MODEL_CANDIDATES = [];

/** Convert a `models` DB row into the JS Model shape used everywhere. */
function rowToModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    vendor: row.vendor || null,
    region: row.region || null,
    gateway: row.gateway,
    slug: row.slug,
    jobs: safeJsonParse(row.jobs, []),
    price_in: row.price_in ?? null,
    price_out: row.price_out ?? null,
    price_unit: row.price_unit || null,
    price_per_unit: row.price_per_unit ?? null,
    zdr: Boolean(row.zdr),
    retention_note: row.retention_note || null,
    open_weights: Boolean(row.open_weights),
    self_hosted: Boolean(row.self_hosted),
    supports_reasoning: Boolean(row.supports_reasoning),
    context_length: row.context_length ?? null,
    params: safeJsonParse(row.params, {}),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
  };
}

const MODEL_COLUMNS = [
  "id", "label", "vendor", "region", "gateway", "slug", "jobs", "price_in", "price_out", "price_unit",
  "price_per_unit", "zdr", "retention_note", "open_weights", "self_hosted", "supports_reasoning",
  "context_length", "params", "enabled",
];

function modelToParams(m) {
  const b = (v) => (v ? 1 : 0);
  const n = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  return {
    id: String(m.id),
    label: String(m.label || m.id),
    vendor: m.vendor ?? null,
    region: m.region ?? null,
    gateway: String(m.gateway),
    slug: String(m.slug),
    jobs: JSON.stringify(Array.isArray(m.jobs) ? m.jobs : safeJsonParse(m.jobs, [])),
    price_in: n(m.price_in),
    price_out: n(m.price_out),
    price_unit: m.price_unit ?? null,
    price_per_unit: n(m.price_per_unit),
    zdr: b(m.zdr),
    retention_note: m.retention_note ?? null,
    open_weights: b(m.open_weights),
    self_hosted: b(m.self_hosted),
    supports_reasoning: b(m.supports_reasoning),
    context_length: n(m.context_length),
    params: JSON.stringify(m.params && typeof m.params === "object" ? m.params : safeJsonParse(m.params, {})),
    enabled: m.enabled === undefined ? 1 : b(m.enabled),
  };
}

function validateModel(m) {
  const errors = [];
  if (!m || typeof m !== "object") return ["model must be an object"];
  if (!m.id || typeof m.id !== "string") errors.push("id is required");
  if (!["openrouter", "fal", "openai", "selfhosted"].includes(m.gateway)) errors.push(`unknown gateway ${m.gateway}`);
  if (!m.slug) errors.push("slug is required");
  if (m.id && m.gateway && m.slug && m.id !== `${m.gateway}:${m.slug}`) errors.push(`id must be "${m.gateway}:${m.slug}"`);
  const jobs = Array.isArray(m.jobs) ? m.jobs : safeJsonParse(m.jobs, null);
  if (!Array.isArray(jobs) || !jobs.length || jobs.some((j) => !JOBS.includes(j))) errors.push("jobs must be a non-empty array of known jobs");
  return errors;
}

/** Insert or update one model row. */
function upsertModel(db, m) {
  const p = modelToParams(m);
  const cols = MODEL_COLUMNS.join(", ");
  const placeholders = MODEL_COLUMNS.map((c) => `$${c}`).join(", ");
  const updates = MODEL_COLUMNS.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
  db.prepare(
    `INSERT INTO models (${cols}, updated_at) VALUES (${placeholders}, $updated_at)
     ON CONFLICT(id) DO UPDATE SET ${updates}, updated_at = excluded.updated_at`
  ).run({ ...Object.fromEntries(Object.entries(p).map(([k, v]) => [`$${k}`, v])), $updated_at: now() });
}

/** Set one routing cell, recording history. */
function setRoute(db, { job, tier, model_id, effort_override = null }, { source = "admin", reason = null } = {}) {
  if (!JOBS.includes(job)) throw new Error(`unknown job ${job}`);
  if (!TIERS.includes(tier)) throw new Error(`unknown tier ${tier}`);
  if (effort_override && !["none", "low", "medium", "high"].includes(effort_override)) throw new Error("bad effort_override");
  const model = db.prepare("SELECT id FROM models WHERE id = ?").get(model_id);
  if (!model) throw new Error(`unknown model ${model_id}`);
  const old = db.prepare("SELECT model_id FROM routes WHERE job = ? AND tier = ?").get(job, tier);
  db.prepare(
    `INSERT INTO routes (job, tier, model_id, effort_override, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job, tier) DO UPDATE SET model_id = excluded.model_id, effort_override = excluded.effort_override,
       source = excluded.source, updated_at = excluded.updated_at`
  ).run(job, tier, model_id, effort_override || null, source, now());
  if (!old || old.model_id !== model_id) {
    db.prepare(
      "INSERT INTO route_history (job, tier, old_model_id, new_model_id, source, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(job, tier, old ? old.model_id : null, model_id, source, reason, now());
  }
}

/**
 * Fill an empty catalog with the seeds. force=true upserts every seed model and overwrites the
 * seeded routes (admin/learned routes for other cells are left alone only when force=false).
 */
function seedCatalog(db, { force = false } = {}) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM models").get().n;
  if (count > 0 && !force) return { seeded: false };
  db.tx(() => {
    for (const m of MODELS) upsertModel(db, m);
    for (const r of ROUTES) setRoute(db, r, { source: "seed", reason: force ? "reseed" : "initial seed" });
  });
  return { seeded: true, models: MODELS.length, routes: ROUTES.length };
}

function exportCatalog(db) {
  return {
    models: db.prepare("SELECT * FROM models ORDER BY id").all().map(rowToModel),
    routes: db.prepare("SELECT job, tier, model_id, effort_override, source, updated_at FROM routes ORDER BY job, tier").all(),
  };
}

/** Upsert models then routes from an exported catalog. Throws on validation errors (nothing written). */
function importCatalog(db, { models = [], routes = [] } = {}, { source = "admin" } = {}) {
  const errors = [];
  models.forEach((m, i) => validateModel(m).forEach((e) => errors.push(`models[${i}]: ${e}`)));
  if (errors.length) throw Object.assign(new Error(errors.join("; ")), { status: 400, code: "bad_request" });
  db.tx(() => {
    for (const m of models) upsertModel(db, m);
    for (const r of routes) setRoute(db, r, { source, reason: "import" });
  });
  return { models: models.length, routes: routes.length };
}

function getModel(db, id) {
  return rowToModel(db.prepare("SELECT * FROM models WHERE id = ?").get(id));
}

function listModels(db, { enabledOnly = false } = {}) {
  return db
    .prepare(`SELECT * FROM models ${enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY id`)
    .all()
    .map(rowToModel);
}

function getRoutes(db) {
  return db.prepare("SELECT job, tier, model_id, effort_override, source, updated_at FROM routes").all();
}

module.exports = {
  JOBS,
  TEXT_JOBS,
  MEDIA_JOBS,
  TIERS,
  MODELS,
  ROUTES,
  CLASSIFIER_MODEL_ID,
  CLASSIFIER_MODEL_CANDIDATES,
  rowToModel,
  modelToParams,
  validateModel,
  upsertModel,
  setRoute,
  seedCatalog,
  exportCatalog,
  importCatalog,
  getModel,
  listModels,
  getRoutes,
};
