// Admin: the routing table, the model catalog, the learner and catalog export/import. Every route
// here needs an admin (auth.requireAdmin: 401 signed out, 403 signed in without the role). The
// first account and any address in ADMIN_EMAILS are admins (src/auth.js signup).
const express = require("express");
const {
  JOBS,
  TEXT_JOBS,
  TIERS,
  validateModel,
  upsertModel,
  setRoute,
  getModel,
  listModels,
  getRoutes,
  exportCatalog,
  importCatalog,
} = require("../seed/catalog");
const { computeStats, gateMetrics, proposeRoutes, applyProposals } = require("../router/learn");
const { EFFORTS } = require("../router/effort");
const { EFFORT_RANK } = require("../providers/effort-map");
const { AppError, now } = require("../util");
const { badRequest, bodyObject, isPlainObject, onlyKeys, idField, intQuery, booleanField, numberField, stringField } = require("./validate");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;
const MAX_IMPORT_ITEMS = 2000;

const MODEL_FIELDS = [
  "id", "label", "vendor", "region", "gateway", "slug", "jobs", "price_in", "price_out", "price_unit",
  "price_per_unit", "zdr", "retention_note", "open_weights", "self_hosted", "supports_reasoning",
  "context_length", "params", "enabled",
];
const BOOLEAN_FIELDS = ["zdr", "open_weights", "self_hosted", "supports_reasoning", "enabled"];
const PRICE_FIELDS = ["price_in", "price_out", "price_per_unit"];
const PRICE_UNITS = ["image", "megapixel", "second", "song", "1k_chars", "minute", "request"];
// Fields that make up a model's identity ("<gateway>:<slug>"). Changing them means a new model.
const IDENTITY_FIELDS = ["id", "gateway", "slug"];
// Exported routes carry bookkeeping columns; import accepts and ignores them.
const ROUTE_FIELDS = ["job", "tier", "model_id", "effort_override", "source", "updated_at"];

const JOB_ORDER = new Map(JOBS.map((j, i) => [j, i]));
const TIER_ORDER = new Map(TIERS.map((t, i) => [t, i]));

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

/**
 * Effort override for a routing cell: null, or a level the routing table can hold. Every value
 * must be a known level (EFFORT_RANK, what resolveEffort accepts); the table itself stores only
 * Gode's own levels (none/low/medium/high: setRoute and the picker ignore anything else).
 */
function effortOverride(value, where = "effort_override") {
  if (value === null) return null;
  if (typeof value !== "string" || !EFFORT_RANK.includes(value)) {
    throw badRequest(`${where} must be null or one of: ${EFFORTS.join(", ")}.`);
  }
  if (!EFFORTS.includes(value)) throw badRequest(`${where} "${value}" is not supported here; use one of: ${EFFORTS.join(", ")}.`);
  return value;
}

/** Type checks on (part of) a model. validateModel() then checks ids, gateway, jobs and params. */
function checkModelFields(m, where) {
  if (!isPlainObject(m)) throw badRequest(`${where} must be an object.`);
  onlyKeys(m, MODEL_FIELDS, where);
  const field = (k) => `${where}.${k}`;
  if (m.label !== undefined) stringField(m.label, field("label"), { required: true, max: 120 });
  for (const k of ["vendor", "region"]) if (m[k] !== undefined) stringField(m[k], field(k), { max: 80 });
  if (m.retention_note !== undefined) stringField(m.retention_note, field("retention_note"), { max: 4000 });
  if (m.price_unit !== undefined && m.price_unit !== null && !PRICE_UNITS.includes(m.price_unit)) {
    throw badRequest(`${field("price_unit")} must be null or one of: ${PRICE_UNITS.join(", ")}.`);
  }
  for (const k of PRICE_FIELDS) if (m[k] !== undefined) numberField(m[k], field(k), { nullable: true, min: 0, max: 1e6 });
  for (const k of BOOLEAN_FIELDS) if (m[k] !== undefined) booleanField(m[k], field(k));
  if (m.context_length !== undefined) numberField(m.context_length, field("context_length"), { nullable: true, min: 1, max: 1e9, integer: true });
  if (m.params !== undefined && !isPlainObject(m.params)) throw badRequest(`${field("params")} must be an object.`);
  if (m.jobs !== undefined && !Array.isArray(m.jobs)) throw badRequest(`${field("jobs")} must be an array.`);
}

/** A complete model ready for upsertModel, or a 400 naming the first problems. */
function checkFullModel(m, where) {
  checkModelFields(m, where);
  if (m.label === undefined) throw badRequest(`${where}.label is required.`);
  const errors = validateModel(m);
  if (errors.length) throw badRequest(`${where}: ${errors.slice(0, 3).join("; ")}.`);
  return m;
}

/** A model can be routed to a cell when it exists, is on, does the job, and (private text) is private-safe. */
function routableModel(model, job, tier, { requireEnabled = true } = {}) {
  if (!model) return "Unknown model.";
  if (requireEnabled && !model.enabled) return `${model.label} is turned off.`;
  if (!model.jobs.includes(job)) return `${model.label} can't do ${job}.`;
  // Text jobs re-send the whole history, so the private cell must keep it: zero-retention or
  // self-hosted only. (Media private cells may hold the budget pick: no media model is ZDR.)
  if (tier === "private" && TEXT_JOBS.includes(job) && !(model.zdr || model.self_hosted)) {
    return `The private ${job} pick must be zero-retention or self-hosted; ${model.label} is neither.`;
  }
  return null;
}

function daysQuery(req, dflt) {
  return intQuery(req.query.days, "days", { min: 1, max: MAX_DAYS, dflt });
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createAdminRoutes({ db, config, auth, classifier }) {
  const router = express.Router();
  router.use("/admin", auth.requireAdmin);

  const sortedRoutes = () =>
    getRoutes(db).sort((a, b) => (JOB_ORDER.get(a.job) ?? 99) - (JOB_ORDER.get(b.job) ?? 99) || (TIER_ORDER.get(a.tier) ?? 99) - (TIER_ORDER.get(b.tier) ?? 99));

  router.get("/admin/routing", (req, res) => {
    // The classifier model actually in use: the first enabled + available candidate, else the
    // keyword heuristic.
    const active = typeof classifier?.resolveModel === "function" ? classifier.resolveModel() : null;
    res.json({ models: listModels(db), routes: sortedRoutes(), classifier_model_id: active ? active.id : "heuristic" });
  });

  router.put("/admin/routes/:job/:tier", (req, res) => {
    const { job, tier } = req.params;
    if (!JOBS.includes(job)) throw badRequest(`Unknown job. Use one of: ${JOBS.join(", ")}.`);
    if (!TIERS.includes(tier)) throw badRequest(`Unknown tier. Use one of: ${TIERS.join(", ")}.`);
    const body = bodyObject(req);
    onlyKeys(body, ["model_id", "effort_override"]);
    const modelId = idField(body.model_id, "model_id", { required: true });
    const why = routableModel(getModel(db, modelId), job, tier);
    if (why) throw badRequest(why);
    // Omitted: keep the cell's current override (like the learner does). null clears it.
    const current = db.prepare("SELECT effort_override FROM routes WHERE job = ? AND tier = ?").get(job, tier);
    const effort = body.effort_override === undefined ? current?.effort_override ?? null : effortOverride(body.effort_override);
    setRoute(db, { job, tier, model_id: modelId, effort_override: effort }, { source: "admin", reason: "admin edit" });
    res.json({ ok: true });
  });

  router.post("/admin/models", (req, res) => {
    const model = checkFullModel(bodyObject(req), "model");
    if (getModel(db, model.id)) throw new AppError(409, "conflict", "A model with this id already exists. Edit it instead.");
    upsertModel(db, model);
    res.status(201).json({ ok: true });
  });

  router.put("/admin/models/:id", (req, res) => {
    const existing = getModel(db, req.params.id);
    if (!existing) throw new AppError(404, "not_found", "Model not found.");
    const patch = bodyObject(req);
    checkModelFields(patch, "model");
    for (const k of IDENTITY_FIELDS) {
      if (patch[k] !== undefined && patch[k] !== existing[k]) throw badRequest(`${k} can't be changed; add a new model instead.`);
    }
    if (!Object.keys(patch).length) throw badRequest("Nothing to update.");
    upsertModel(db, checkFullModel({ ...existing, ...patch }, "model"));
    res.json({ ok: true });
  });

  router.get("/admin/stats", (req, res) => {
    const days = daysQuery(req, config.learn.windowDays);
    const sinceMs = now() - days * DAY_MS;
    res.json({ days, gate: gateMetrics(db, { sinceMs }), models: computeStats(db, { sinceMs }) });
  });

  // Propose routing changes from the feedback signals; apply them only when asked.
  router.post("/admin/learn", (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["apply", "days", "min_samples"]);
    const apply = body.apply === undefined ? false : booleanField(body.apply, "apply");
    const days = body.days === undefined ? config.learn.windowDays : numberField(body.days, "days", { min: 1, max: MAX_DAYS, integer: true });
    const minSamples =
      body.min_samples === undefined ? config.learn.minSamples : numberField(body.min_samples, "min_samples", { min: 1, max: 1e6, integer: true });
    const proposals = proposeRoutes(db, { minSamples, sinceMs: now() - days * DAY_MS });
    const applied = apply && proposals.length ? applyProposals(db, proposals, { source: "learn" }) : 0;
    res.json({ proposals, applied });
  });

  router.get("/admin/catalog/export", (req, res) => {
    res.setHeader("Content-Disposition", 'attachment; filename="gode-catalog.json"');
    res.json(exportCatalog(db));
  });

  // Upsert models, then routes, in one transaction (all or nothing). Everything is checked first so
  // a bad file gets a clear 400 instead of a half-applied catalog.
  router.post("/admin/catalog/import", (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["models", "routes"]);
    const { models = [], routes = [] } = body;
    if (!Array.isArray(models) || !Array.isArray(routes)) throw badRequest("models and routes must be arrays.");
    if (models.length > MAX_IMPORT_ITEMS || routes.length > MAX_IMPORT_ITEMS) throw badRequest("Too many entries in one import.");

    models.forEach((m, i) => checkFullModel(m, `models[${i}]`));
    const incoming = new Map(models.map((m) => [m.id, m]));
    routes.forEach((r, i) => {
      const where = `routes[${i}]`;
      if (!isPlainObject(r)) throw badRequest(`${where} must be an object.`);
      onlyKeys(r, ROUTE_FIELDS, where);
      if (!JOBS.includes(r.job)) throw badRequest(`${where}.job is unknown.`);
      if (!TIERS.includes(r.tier)) throw badRequest(`${where}.tier is unknown.`);
      const modelId = idField(r.model_id, `${where}.model_id`, { required: true });
      // A routed model may be disabled (the picker then skips the cell), so an export always
      // imports back; it must still exist and be able to do the job.
      const why = routableModel(incoming.get(modelId) || getModel(db, modelId), r.job, r.tier, { requireEnabled: false });
      if (why) throw badRequest(`${where}: ${why}`);
      if (r.effort_override !== undefined) effortOverride(r.effort_override, `${where}.effort_override`);
    });

    // importCatalog / setRoute throw AppError 400 for anything the checks above missed.
    importCatalog(db, { models, routes }, { source: "admin" });
    res.json({ ok: true, models: models.length, routes: routes.length });
  });

  return router;
}

module.exports = { createAdminRoutes };
