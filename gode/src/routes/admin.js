// Admin: the routing table, the model catalog, the learner, catalog export/import, and user
// accounts (find a user, adjust their credit). Every route here needs an admin
// (auth.requireAdmin: 401 signed out, 403 signed in without the role). Who is an admin is decided
// in src/auth.js: exactly the ADMIN_EMAILS addresses when that is set (re-checked on every
// request), else the first account when FIRST_USER_ADMIN is on (development), plus anyone granted
// with scripts/make-admin.js.
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
  privateSafe,
} = require("../seed/catalog");
const {
  computeStats,
  computeCellStats,
  gateMetrics,
  proposeRoutes,
  applyProposals,
  recordLearnRun,
  markLearnRunApplied,
  getLearnRun,
  listLearnRuns,
} = require("../router/learn");
const { ROUTED_TIERS } = require("../router/pick");
const { EFFORTS } = require("../router/effort");
const { EFFORT_RANK } = require("../providers/effort-map");
const { AppError, now, usdToMicros, microsToUsd } = require("../util");
const { badRequest, bodyObject, isPlainObject, onlyKeys, idField, intQuery, booleanField, numberField, stringField } = require("./validate");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;
const MAX_IMPORT_ITEMS = 2000;
const MAX_PROPOSALS = 200;
const MAX_USERS_LISTED = 50;
// One adjustment, either way. A larger correction is several deliberate steps.
const MAX_ADJUST_USD = 10_000;
// Fields of a learner proposal an admin may send back to apply it as reviewed.
const PROPOSAL_FIELDS = [
  "job", "tier", "current_model_id", "proposed_model_id", "reason", "summary", "current_score", "proposed_score",
  "current_n", "proposed_n", "current_requests", "proposed_requests",
];

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

/**
 * A complete model ready for upsertModel, or a 400 naming the first problems. `opts` is passed to
 * validateModel (openaiZdrApproved: a direct-OpenAI model may be flagged zdr only with OpenAI's
 * zero-retention approval for this key).
 */
function checkFullModel(m, where, opts = {}) {
  checkModelFields(m, where);
  if (m.label === undefined) throw badRequest(`${where}.label is required.`);
  const errors = validateModel(m, opts);
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
  // Self-hosted by gateway (privateSafe), never by the editable flag.
  if (tier === "private" && TEXT_JOBS.includes(job) && !privateSafe(model)) {
    return `The private ${job} pick must be zero-retention or self-hosted; ${model.label} is neither.`;
  }
  return null;
}

/**
 * Private text cells an edited model would no longer be allowed in (it lost zdr, say). The picker
 * would skip such a cell silently and fall back, so the edit is refused instead: route another
 * model to the cell first. `routes` overrides the stored cells (an import brings its own).
 */
function brokenPrivateCells(db, model, routes = getRoutes(db)) {
  return routes
    .filter((r) => r.tier === "private" && TEXT_JOBS.includes(r.job) && r.model_id === model.id)
    .filter((r) => routableModel(model, r.job, r.tier, { requireEnabled: false }))
    .map((r) => r.job);
}

function daysQuery(req, dflt) {
  return intQuery(req.query.days, "days", { min: 1, max: MAX_DAYS, dflt });
}

/** Proposals sent back by the admin page to apply exactly what was reviewed. */
function checkProposals(list) {
  if (!Array.isArray(list)) throw badRequest("proposals must be an array.");
  if (list.length > MAX_PROPOSALS) throw badRequest("Too many proposals in one request.");
  return list.map((p, i) => {
    const where = `proposals[${i}]`;
    if (!isPlainObject(p)) throw badRequest(`${where} must be an object.`);
    onlyKeys(p, PROPOSAL_FIELDS, where);
    if (!JOBS.includes(p.job) || routeJobOf(p.job) !== p.job) throw badRequest(`${where}.job is not a routed job.`);
    // The private cell is a privacy decision: never changed from learner proposals.
    if (!ROUTED_TIERS.includes(p.tier)) throw badRequest(`${where}.tier must be one of: ${ROUTED_TIERS.join(", ")}.`);
    // current_model_id is what makes a stale proposal (the cell changed since) a no-op.
    const out = {
      job: p.job,
      tier: p.tier,
      current_model_id: idField(p.current_model_id, `${where}.current_model_id`, { required: true }),
      proposed_model_id: idField(p.proposed_model_id, `${where}.proposed_model_id`, { required: true }),
    };
    if (p.reason !== undefined && p.reason !== null) out.reason = stringField(p.reason, `${where}.reason`, { max: 1000 });
    // The proposal as the learner returned it may be sent back as is: its display sentence is kept.
    if (p.summary !== undefined && p.summary !== null) out.summary = stringField(p.summary, `${where}.summary`, { max: 1000 });
    for (const k of ["current_score", "proposed_score", "current_n", "proposed_n", "current_requests", "proposed_requests"]) {
      if (p[k] !== undefined && p[k] !== null) out[k] = numberField(p[k], `${where}.${k}`, { min: 0, max: 1e9 });
    }
    return out;
  });
}

// Phase 1 answers `action` with the chat routes; its cells are kept only for later phases.
const routeJobOf = (job) => (job === "action" ? "chat" : job);

/** The admin view of a user: no password hash, no keys, no settings. */
function adminUser(row) {
  return { id: row.id, email: row.email, balance_usd: microsToUsd(row.balance_micros), is_admin: Boolean(row.is_admin), created_at: row.created_at };
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createAdminRoutes({ db, config, auth, classifier, credits, redactor }) {
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
    // Editing an action cell would look like it changes something, but action requests route as chat.
    if (job !== routeJobOf(job)) throw badRequest("Action requests are answered with the chat routes for now; edit the chat cells instead.");
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

  const modelOpts = { openaiZdrApproved: Boolean(config?.gateways?.openai?.zdrApproved) };

  router.post("/admin/models", (req, res) => {
    const model = checkFullModel(bodyObject(req), "model", modelOpts);
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
    const next = checkFullModel({ ...existing, ...patch }, "model", modelOpts);
    const broken = brokenPrivateCells(db, next);
    if (broken.length) {
      throw badRequest(
        `${existing.label} is the private ${broken.join(" and ")} pick, which must be zero-retention or self-hosted. ` +
          "Route another model to that cell first."
      );
    }
    upsertModel(db, next);
    res.json({ ok: true });
  });

  router.get("/admin/stats", (req, res) => {
    const days = daysQuery(req, config.learn.windowDays);
    const sinceMs = now() - days * DAY_MS;
    const [lastRun] = listLearnRuns(db, { limit: 1 });
    res.json({
      days,
      gate: gateMetrics(db, { sinceMs }),
      models: computeStats(db, { sinceMs }),
      // What the learner compares: each routing cell's own traffic.
      cells: computeCellStats(db, { sinceMs }),
      last_learn_run: lastRun ? { id: lastRun.id, source: lastRun.source, created_at: lastRun.created_at, proposals: lastRun.proposals.length, applied: lastRun.applied } : null,
      // The overview shows a banner while the Presidio analyzer is down (prompts are refused in
      // fail mode 'closed', or sent with built-in checks only in 'open').
      presidio: typeof redactor?.presidioStatus === "function" ? redactor.presidioStatus() : null,
    });
  });

  // Propose routing changes from the feedback signals; apply them only when asked. Every call is
  // stored as a learner run (learn_runs). To apply what the admin reviewed, send that run's id
  // ({apply: true, run_id}) or the reviewed proposals themselves ({apply: true, proposals}): new
  // feedback between "Run" and "Apply" must not change what gets applied. {apply: true} alone
  // computes and applies in one step (scripts and automation).
  router.post("/admin/learn", (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["apply", "days", "min_samples", "run_id", "proposals"]);
    const apply = body.apply === undefined ? false : booleanField(body.apply, "apply");
    if ((body.run_id !== undefined || body.proposals !== undefined) && !apply) throw badRequest("run_id and proposals are only used with apply: true.");
    if (body.run_id !== undefined && body.proposals !== undefined) throw badRequest("Send run_id or proposals, not both.");

    if (body.run_id !== undefined) {
      const runId = numberField(body.run_id, "run_id", { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
      const run = getLearnRun(db, runId);
      if (!run) throw new AppError(404, "not_found", "Learner run not found.");
      const applied = run.proposals.length ? applyProposals(db, run.proposals, { source: "learn" }) : 0;
      markLearnRunApplied(db, run.id, applied);
      return res.json({ proposals: run.proposals, applied, run_id: run.id });
    }

    const days = body.days === undefined ? config.learn.windowDays : numberField(body.days, "days", { min: 1, max: MAX_DAYS, integer: true });
    if (body.proposals !== undefined) {
      const proposals = checkProposals(body.proposals);
      const applied = proposals.length ? applyProposals(db, proposals, { source: "learn" }) : 0;
      const runId = recordLearnRun(db, { source: "admin", days, proposals, applied });
      return res.json({ proposals, applied, run_id: runId });
    }

    const minSamples =
      body.min_samples === undefined ? config.learn.minSamples : numberField(body.min_samples, "min_samples", { min: 1, max: 1e6, integer: true });
    const proposals = proposeRoutes(db, { minSamples, sinceMs: now() - days * DAY_MS });
    const applied = apply && proposals.length ? applyProposals(db, proposals, { source: "learn" }) : 0;
    const runId = recordLearnRun(db, { source: "admin", days, proposals, applied });
    res.json({ proposals, applied, run_id: runId });
  });

  // Recent learner runs (admin page, CLI and the weekly schedule), newest first.
  router.get("/admin/learn/runs", (req, res) => {
    const limit = intQuery(req.query.limit, "limit", { min: 1, max: 200, dflt: 20 });
    res.json({ runs: listLearnRuns(db, { limit }) });
  });

  // Find users by (part of) their email address; without ?email=, the newest accounts.
  router.get("/admin/users", (req, res) => {
    const q = req.query.email;
    if (q !== undefined && typeof q !== "string") throw badRequest("email must be a single value.");
    const term = typeof q === "string" ? q.trim().slice(0, 200) : "";
    const cols = "id, email, balance_micros, is_admin, created_at";
    const rows = term
      ? db
          .prepare(`SELECT ${cols} FROM users WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC, id LIMIT ?`)
          .all(`%${escapeLike(term)}%`, MAX_USERS_LISTED)
      : db.prepare(`SELECT ${cols} FROM users ORDER BY created_at DESC, id LIMIT ?`).all(MAX_USERS_LISTED);
    res.json({ users: rows.map(adminUser) });
  });

  // Add or take back credit (a refund made in Stripe, a goodwill credit). Written to the ledger as
  // admin_adjust, so balance == SUM(ledger) still holds; the balance never goes below zero.
  router.post("/admin/users/:id/credit", (req, res) => {
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!target) throw new AppError(404, "not_found", "User not found.");
    const body = bodyObject(req);
    onlyKeys(body, ["usd", "note"]);
    const usd = numberField(body.usd, "usd", { min: -MAX_ADJUST_USD, max: MAX_ADJUST_USD });
    const micros = usdToMicros(usd);
    if (!micros) throw badRequest("usd must not be zero.");
    const note = stringField(body.note, "note", { max: 200 });
    if (typeof credits?.adjust !== "function") throw new AppError(503, "unavailable", "Credit adjustments are not available.");
    // The ref names the admin who made the change (and their note) for the ledger's audit trail.
    const ref = `admin:${req.user.id}${note ? ` ${note}` : ""}`.slice(0, 240);
    // A take-back stops at $0, so the change applied can be less than the one asked for: report
    // it (the handler is synchronous, so nothing else touches the balance between the two reads).
    const readMicros = () => Number(db.prepare("SELECT balance_micros FROM users WHERE id = ?").get(target.id).balance_micros);
    const before = readMicros();
    const out = credits.adjust(target.id, micros, ref);
    const balance = typeof out === "number" ? out : Number(out?.balance ?? readMicros());
    res.json({ balance_usd: microsToUsd(balance), applied_usd: microsToUsd(balance - before) });
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

    models.forEach((m, i) => checkFullModel(m, `models[${i}]`, modelOpts));
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

    // Stored private text cells this import does not replace must stay valid for the incoming models.
    const replaced = new Set(routes.map((r) => `${r.job}|${r.tier}`));
    const kept = getRoutes(db).filter((r) => !replaced.has(`${r.job}|${r.tier}`));
    for (const m of models) {
      const broken = brokenPrivateCells(db, m, kept);
      if (broken.length) throw badRequest(`${m.id} is the private ${broken.join(" and ")} pick and must stay zero-retention or self-hosted.`);
    }

    // importCatalog / setRoute throw AppError 400 for anything the checks above missed.
    importCatalog(db, { models, routes }, { source: "admin", ...modelOpts });
    res.json({ ok: true, models: models.length, routes: routes.length });
  });

  return router;
}

module.exports = { createAdminRoutes };
