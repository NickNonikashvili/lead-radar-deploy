// Weekly learner: turns the routing log (picks, cost, 👍/👎, regenerate, switch) into satisfaction
// stats, proposes routing-table changes, and reports the phase-1 gate metrics ("people keep
// auto-pick on and credits cover API costs"). Reads only metadata columns: the requests table holds
// no prompts or answers.
//
// Proposals compare like with like. Each routing cell (job x tier) gets the requests that were
// routed to that column (requests.tier): the budget pick only ever sees easy prompts and the
// quality pick the hard ones, so pooling them would make the cheapest model "win" every column.
// A cell changes only when both its current model and the challenger have enough ratings in that
// cell, and a quality or balanced cell never moves to a model users liked less.
const { getModel, getRoutes, listModels, setRoute } = require("../seed/catalog");
const { now, microsToUsd, safeJsonParse } = require("../util");
const { routeJob, ROUTED_TIERS } = require("./pick");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 28 * DAY_MS;
const DEFAULT_MIN_SAMPLES = 20;
// Laplace prior: a model with no signals scores (0 + 1) / (0 + 2).
const PRIOR_SCORE = 0.5;
const BUDGET_SCORE_TOLERANCE = 0.02;
// A quality challenger must beat the current pick by this much: equal scores are noise.
const QUALITY_MIN_GAIN = 0.02;
const BALANCED_COST_WEIGHT = 0.15;
const LEARN_RUN_SOURCES = ["admin", "cli", "schedule"];
// Callers pass "since" either as an epoch-ms timestamp or as a lookback in ms (the admin route has
// "days", the script has --days). No real timestamp is below 1e11 ms (March 1973) and no sensible
// lookback is above it (~3 years), so both readings can be told apart safely.
const LOOKBACK_CUTOFF_MS = 1e11;

function resolveSince(sinceMs) {
  if (sinceMs === undefined || sinceMs === null) return now() - DEFAULT_WINDOW_MS;
  const n = Number(sinceMs);
  if (!Number.isFinite(n) || n < 0) throw new TypeError("sinceMs must be a non-negative number of milliseconds");
  return n > 0 && n < LOOKBACK_CUTOFF_MS ? now() - n : n;
}

function laplaceScore({ up, down, regenerated, overridden }) {
  return (up + 1) / (up + down + regenerated + overridden + 2);
}

const round = (x, dp) => (x === null ? null : Math.round(x * 10 ** dp) / 10 ** dp);
const ratio = (num, den) => (den > 0 ? num / den : null);
const pct = (num, den) => (den > 0 ? round((num / den) * 100, 1) : null);

const SUM_COLUMNS = ["n", "up", "down", "regenerated", "overridden", "cost_sum", "latency_sum", "latency_n"];

/**
 * Raw signal sums per (job, model), or per (job, tier, model), since `since`. Only answers that
 * completed (status 'ok') count: an error says nothing about the model's answers, and a stopped
 * answer is neutral (the user may have had what they needed, or may not).
 */
function signalRows(db, since, { byTier = false } = {}) {
  const keys = byTier ? "job, tier, model_id" : "job, model_id";
  return db
    .prepare(
      `SELECT ${keys},
              COUNT(*) AS n,
              COALESCE(SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), 0) AS up,
              COALESCE(SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END), 0) AS down,
              COALESCE(SUM(regenerated), 0) AS regenerated,
              COALESCE(SUM(overridden), 0) AS overridden,
              COALESCE(SUM(api_cost_micros), 0) AS cost_sum,
              COALESCE(SUM(latency_ms), 0) AS latency_sum,
              COUNT(latency_ms) AS latency_n
         FROM requests
        WHERE created_at >= ? AND status = 'ok' AND job IS NOT NULL AND model_id IS NOT NULL
              ${byTier ? "AND tier IS NOT NULL" : ""}
        GROUP BY ${keys}
        ORDER BY ${keys}`
    )
    .all(since);
}

function toStat(row) {
  const counts = {
    up: Number(row.up),
    down: Number(row.down),
    regenerated: Number(row.regenerated),
    overridden: Number(row.overridden),
  };
  const n = Number(row.n);
  return {
    job: row.job,
    ...(row.tier !== undefined ? { tier: row.tier } : {}),
    model_id: row.model_id,
    n,
    // Satisfaction signals behind the score. minSamples counts these, not requests: an unrated
    // answer is no evidence either way, and the 0.5 prior must never decide a routing change.
    ratings: counts.up + counts.down + counts.regenerated + counts.overridden,
    ...counts,
    avg_cost_micros: n ? Math.round(Number(row.cost_sum) / n) : 0,
    avg_latency_ms: Number(row.latency_n) ? Math.round(Number(row.latency_sum) / Number(row.latency_n)) : null,
    score: laplaceScore(counts),
  };
}

/** Sum rows that fold into the same key (phase 1 answers `action` with the chat routes). */
function foldRows(rows, keyOf) {
  const merged = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    const acc = merged.get(key) || { ...row, job: routeJob(row.job), ...Object.fromEntries(SUM_COLUMNS.map((k) => [k, 0])) };
    for (const k of SUM_COLUMNS) acc[k] += Number(row[k]);
    merged.set(key, acc);
  }
  return [...merged.values()].map(toStat);
}

/**
 * Per (job, model) satisfaction and cost over the window (the admin page's model table).
 * @param {object} db
 * @param {{ sinceMs?: number }} [opts]  epoch-ms lower bound (or a lookback in ms); default 28 days
 */
function computeStats(db, { sinceMs } = {}) {
  return signalRows(db, resolveSince(sinceMs)).map(toStat);
}

/**
 * Per routing cell: (job, tier, model) stats, `action` folded into chat. What the learner compares.
 * @returns {Array<{ job, tier, model_id, n, ratings, up, down, regenerated, overridden, avg_cost_micros, avg_latency_ms, score }>}
 */
function computeCellStats(db, { sinceMs } = {}) {
  const rows = signalRows(db, resolveSince(sinceMs), { byTier: true });
  return foldRows(rows, (r) => `${routeJob(r.job)}\u0000${r.tier}\u0000${r.model_id}`);
}

/** Map "job\0tier" -> Map(model_id -> stat). */
function cellIndex(db, since) {
  const cells = new Map();
  for (const stat of computeCellStats(db, { sinceMs: since })) {
    const key = `${stat.job}\u0000${stat.tier}`;
    if (!cells.has(key)) cells.set(key, new Map());
    cells.get(key).set(stat.model_id, stat);
  }
  return cells;
}

const usd = (micros) => `$${microsToUsd(micros).toFixed(4)}`;
const cheaperFirst = (a, b) => a.avg_cost_micros - b.avg_cost_micros || b.score - a.score || a.model_id.localeCompare(b.model_id);

// One selection rule per tier: (pool, current) -> { stat, rule } or null. The pool holds every
// model with enough ratings in this cell, the current pick included; `current` always has data.
const SELECTORS = {
  // Highest satisfaction (ties -> cheaper), and clearly better than the current pick.
  quality: (pool, current) => {
    const [best] = [...pool].sort((a, b) => b.score - a.score || cheaperFirst(a, b));
    return best && best.score > current.score + QUALITY_MIN_GAIN ? { stat: best, rule: "best satisfaction" } : null;
  },
  // Cheapest model that is about as satisfying as the current budget pick, and cheaper than it.
  budget: (pool, current) => {
    const ok = pool
      .filter((s) => s.score >= current.score - BUDGET_SCORE_TOLERANCE && s.avg_cost_micros < current.avg_cost_micros)
      .sort(cheaperFirst);
    return ok.length ? { stat: ok[0], rule: `cheapest within ${BUDGET_SCORE_TOLERANCE} of the current satisfaction` } : null;
  },
  // Satisfaction minus a cost penalty (cost normalised to the dearest candidate); never a model
  // users liked less than the current pick.
  balanced: (pool, current) => {
    const maxCost = Math.max(0, ...pool.map((s) => s.avg_cost_micros));
    const value = (s) => s.score - BALANCED_COST_WEIGHT * (maxCost > 0 ? s.avg_cost_micros / maxCost : 0);
    const [best] = pool.filter((s) => s.score >= current.score).sort((a, b) => value(b) - value(a) || cheaperFirst(a, b));
    return best && value(best) > value(current) + 1e-9 ? { stat: best, rule: "best satisfaction for the cost" } : null;
  },
};

function describe(stat, model) {
  return `${model?.label || stat.model_id} ${stat.score.toFixed(2)} (${stat.ratings} ratings, ${stat.n} answers, avg ${usd(stat.avg_cost_micros)})`;
}

/**
 * Propose routing changes from the per-cell stats. A cell (job x routed tier) is considered only
 * when its current model has >= minSamples ratings in that cell; a challenger needs >= minSamples
 * ratings in the same cell (same job, same tier: comparable traffic). The private tier is never
 * touched (it is a privacy decision, not a satisfaction one).
 * @returns {Array<{ job, tier, current_model_id, proposed_model_id, reason, current_score,
 *                   proposed_score, current_n, proposed_n, current_requests, proposed_requests }>}
 *   current_n / proposed_n are rating counts (what minSamples is compared with).
 */
function proposeRoutes(db, { minSamples = DEFAULT_MIN_SAMPLES, sinceMs } = {}) {
  const min = Math.max(1, Math.floor(Number(minSamples) || DEFAULT_MIN_SAMPLES));
  const cells = cellIndex(db, resolveSince(sinceMs));
  const models = new Map(listModels(db).map((m) => [m.id, m]));
  const proposals = [];

  for (const route of getRoutes(db)) {
    const { job, tier, model_id: currentId } = route;
    // `action` cells are unused in phase 1 (action routes as chat), and private is off limits.
    if (!ROUTED_TIERS.includes(tier) || routeJob(job) !== job) continue;
    const cell = cells.get(`${job}\u0000${tier}`);
    if (!cell) continue;
    const current = cell.get(currentId);
    // No evidence on the current pick in this cell: nothing to compare against (the prior would
    // decide, and any model "beats" 0.5 by chance).
    if (!current || current.ratings < min) continue;

    const pool = [...cell.values()].filter((s) => {
      const m = models.get(s.model_id);
      return s.ratings >= min && m && m.enabled && m.jobs.includes(job);
    });
    if (!pool.some((s) => s.model_id === currentId)) pool.push(current);

    const choice = SELECTORS[tier](pool, current);
    if (!choice || choice.stat.model_id === currentId) continue;
    const proposed = choice.stat;
    proposals.push({
      job,
      tier,
      current_model_id: currentId,
      proposed_model_id: proposed.model_id,
      reason: `learn ${job}/${tier}, ${choice.rule}: ${describe(proposed, models.get(proposed.model_id))} vs ${describe(current, models.get(currentId))}`,
      current_score: round(current.score, 4),
      proposed_score: round(proposed.score, 4),
      current_n: current.ratings,
      proposed_n: proposed.ratings,
      current_requests: current.n,
      proposed_requests: proposed.n,
    });
  }
  return proposals;
}

function assertProposal(p, i) {
  const ok = p && typeof p === "object" && typeof p.job === "string" && typeof p.tier === "string" && typeof p.proposed_model_id === "string";
  if (!ok) throw new TypeError(`applyProposals: proposals[${i}] needs job, tier and proposed_model_id`);
}

/**
 * Write proposals to the routing table (with route_history). Skips, rather than clobbers, cells
 * that changed since the proposal was made, private cells, and models that are gone or disabled.
 * @returns {number} routes changed
 */
function applyProposals(db, proposals, { source = "learn" } = {}) {
  if (!Array.isArray(proposals)) throw new TypeError("applyProposals: proposals must be an array");
  proposals.forEach(assertProposal);
  let applied = 0;
  db.tx(() => {
    for (const p of proposals) {
      // Only routed columns: the private cell is a privacy decision (zero-retention or self-hosted
      // only), never something satisfaction scores may change.
      if (!ROUTED_TIERS.includes(p.tier)) continue;
      const route = db.prepare("SELECT model_id, effort_override FROM routes WHERE job = ? AND tier = ?").get(p.job, p.tier);
      // An admin (or an earlier run) changed this cell after the proposal was computed.
      if (route && p.current_model_id !== undefined && route.model_id !== p.current_model_id) continue;
      if (route && route.model_id === p.proposed_model_id) continue;
      const model = getModel(db, p.proposed_model_id);
      if (!model || !model.enabled || !model.jobs.includes(p.job)) continue;
      const reason =
        p.reason ||
        `learn ${p.job}/${p.tier}: score ${p.current_score ?? "?"} (n=${p.current_n ?? "?"}) -> ${p.proposed_score ?? "?"} (n=${p.proposed_n ?? "?"})`;
      // The cell's effort override is an admin setting for the cell; keep it.
      setRoute(db, { job: p.job, tier: p.tier, model_id: p.proposed_model_id, effort_override: route?.effort_override ?? null }, { source, reason });
      applied += 1;
    }
  });
  return applied;
}

// ---------------------------------------------------------------------------------------------
// Stored runs (admin page, CLI, weekly schedule): what was proposed and what was applied, so an
// admin can review a run and apply exactly that run.

function rowToRun(row) {
  if (!row) return null;
  const proposals = safeJsonParse(row.proposals, []);
  return {
    id: Number(row.id),
    source: row.source,
    days: Number(row.days),
    proposals: Array.isArray(proposals) ? proposals : [],
    applied: Number(row.applied),
    created_at: Number(row.created_at),
  };
}

/** Store one learner run. Returns its id. */
function recordLearnRun(db, { source, days, proposals = [], applied = 0 }) {
  if (!LEARN_RUN_SOURCES.includes(source)) throw new TypeError(`recordLearnRun: unknown source ${String(source).slice(0, 20)}`);
  const info = db
    .prepare("INSERT INTO learn_runs (source, days, proposals, applied, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(source, Math.max(0, Math.round(Number(days) || 0)), JSON.stringify(Array.isArray(proposals) ? proposals : []), Math.max(0, Number(applied) || 0), now());
  return Number(info.lastInsertRowid);
}

/** Add `applied` routes to a stored run (an admin applying a reviewed run). */
function markLearnRunApplied(db, id, applied) {
  db.prepare("UPDATE learn_runs SET applied = applied + ? WHERE id = ?").run(Math.max(0, Number(applied) || 0), id);
}

function getLearnRun(db, id) {
  return rowToRun(db.prepare("SELECT * FROM learn_runs WHERE id = ?").get(id));
}

/** Most recent runs first. */
function listLearnRuns(db, { limit = 20, source = null } = {}) {
  const n = Math.min(200, Math.max(1, Math.floor(Number(limit) || 20)));
  const rows = source
    ? db.prepare("SELECT * FROM learn_runs WHERE source = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(source, n)
    : db.prepare("SELECT * FROM learn_runs ORDER BY created_at DESC, id DESC LIMIT ?").all(n);
  return rows.map(rowToRun);
}

// ---------------------------------------------------------------------------------------------

/**
 * Phase-1 gate: do people keep auto-pick on, and do credits cover API costs?
 * `users` counts users active in the window (the auto-pick denominator: sign-ups who never chatted
 * say nothing about trust in the router); `total_users` counts everyone.
 * Rates are fractions (0..1), *_pct fields are percentages; each is null when its denominator is 0.
 *
 * Auto-pick: `auto_pick_kept_pct` is measured from the requests themselves (active users who sent
 * no request with auto-pick off in the window), so someone who switched it off, sent a manual
 * request and left still counts against it; `auto_pick_on_pct` is today's setting of the same users.
 *
 * Money: `api_cost_usd` is every upstream cost in the window, failed and stopped requests included.
 * `charged_usd` is what was deducted from balances, whoever paid for that balance: the signup bonus
 * and dev top-ups are free credit, so `credits_cover_api_costs` (charges, free credit included, vs
 * API cost) can say yes with no purchases at all. `cash_covers_api_costs` (purchases in the window vs
 * API cost) and `free_credit_share_pct` say how much of it is real money: that is the gate figure.
 *
 * Deleted accounts: "delete everything" removes their requests rows but keeps their purchases in
 * the ledger (unlinked), so their requests' per-day totals live on in usage_archive and are added
 * back here (request counts, API cost, charges, ratings). Archived days count when the day starts
 * at or after the start of the window's first UTC day. Auto-pick figures cover live accounts only.
 */
function gateMetrics(db, { sinceMs } = {}) {
  const since = resolveSince(sinceMs);
  const r = db
    .prepare(
      `SELECT COUNT(*) AS requests,
              COALESCE(SUM(CASE WHEN kind = 'auto' THEN 1 ELSE 0 END), 0) AS auto,
              COALESCE(SUM(CASE WHEN kind = 'manual' THEN 1 ELSE 0 END), 0) AS manual,
              COALESCE(SUM(CASE WHEN kind = 'switch' THEN 1 ELSE 0 END), 0) AS switches,
              COALESCE(SUM(api_cost_micros), 0) AS api,
              COALESCE(SUM(CASE WHEN status <> 'ok' THEN api_cost_micros ELSE 0 END), 0) AS api_failed,
              COALESCE(SUM(charged_micros), 0) AS charged,
              COALESCE(SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), 0) AS up,
              COALESCE(SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END), 0) AS down
         FROM requests WHERE created_at >= ?`
    )
    .get(since);
  const u = db
    .prepare(
      `SELECT COUNT(*) AS users,
              COALESCE(SUM(CASE WHEN u.auto_pick = 1 THEN 1 ELSE 0 END), 0) AS auto_on,
              COALESCE(SUM(CASE WHEN a.manual = 0 THEN 1 ELSE 0 END), 0) AS kept
         FROM (SELECT user_id, SUM(CASE WHEN kind = 'manual' THEN 1 ELSE 0 END) AS manual
                 FROM requests WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY user_id) a
         JOIN users u ON u.id = a.user_id`
    )
    .get(since);
  const l = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'purchase' THEN delta_micros ELSE 0 END), 0) AS purchases,
              COALESCE(SUM(CASE WHEN kind IN ('signup_bonus', 'dev_topup') THEN delta_micros ELSE 0 END), 0) AS free,
              COALESCE(SUM(CASE WHEN kind = 'admin_adjust' THEN delta_micros ELSE 0 END), 0) AS adjusted
         FROM ledger WHERE created_at >= ?`
    )
    .get(since);
  const totalUsers = Number(db.prepare("SELECT COUNT(*) AS n FROM users").get().n);
  const a = db
    .prepare(
      `SELECT COALESCE(SUM(requests), 0) AS requests, COALESCE(SUM(auto), 0) AS auto, COALESCE(SUM(manual), 0) AS manual,
              COALESCE(SUM(switches), 0) AS switches, COALESCE(SUM(api_micros), 0) AS api,
              COALESCE(SUM(failed_api_micros), 0) AS api_failed, COALESCE(SUM(charged_micros), 0) AS charged,
              COALESCE(SUM(up), 0) AS up, COALESCE(SUM(down), 0) AS down
         FROM usage_archive WHERE day >= ?`
    )
    .get(since - (since % DAY_MS));
  // Live rows plus the archived totals of deleted accounts.
  for (const k of ["requests", "auto", "manual", "switches", "api", "api_failed", "charged", "up", "down"]) r[k] = Number(r[k]) + Number(a[k]);

  const requests = Number(r.requests);
  const api = Number(r.api);
  const charged = Number(r.charged);
  const users = Number(u.users);
  const purchases = Number(l.purchases);
  const free = Number(l.free);
  const newRequests = Number(r.auto) + Number(r.manual);
  return {
    users,
    total_users: totalUsers,
    auto_pick_kept_pct: pct(Number(u.kept), users),
    auto_pick_on_pct: pct(Number(u.auto_on), users),
    auto_requests_pct: pct(Number(r.auto), newRequests),
    override_rate: round(ratio(Number(r.switches), Number(r.auto)), 4),
    requests,
    api_cost_usd: microsToUsd(api),
    failed_api_cost_usd: microsToUsd(Number(r.api_failed)),
    charged_usd: microsToUsd(charged),
    gross_margin_pct: pct(charged - api, charged),
    thumbs_up_rate: round(ratio(Number(r.up), Number(r.up) + Number(r.down)), 4),
    credits_cover_api_costs: requests ? charged >= api : null,
    purchases_usd: microsToUsd(purchases),
    free_credit_usd: microsToUsd(free),
    adjusted_usd: microsToUsd(Number(l.adjusted)),
    free_credit_share_pct: pct(free, free + purchases),
    cash_covers_api_costs: requests ? purchases >= api : null,
    // Of `requests`: those of accounts deleted since (their totals come from usage_archive).
    deleted_account_requests: Number(a.requests),
    since_ms: since,
  };
}

module.exports = {
  computeStats,
  computeCellStats,
  proposeRoutes,
  applyProposals,
  gateMetrics,
  recordLearnRun,
  markLearnRunApplied,
  getLearnRun,
  listLearnRuns,
  laplaceScore,
  resolveSince,
  PRIOR_SCORE,
  BUDGET_SCORE_TOLERANCE,
  QUALITY_MIN_GAIN,
  BALANCED_COST_WEIGHT,
  LEARN_RUN_SOURCES,
};
