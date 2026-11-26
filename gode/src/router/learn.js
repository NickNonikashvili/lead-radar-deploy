// Weekly learner: turns the routing log (picks, cost, 👍/👎, regenerate, switch) into per-model
// satisfaction stats, proposes routing-table changes, and reports the phase-1 gate metrics
// ("people keep auto-pick on and credits cover API costs"). Reads only metadata columns: the
// requests table holds no prompts or answers.
const { getModel, getRoutes, listModels, setRoute } = require("../seed/catalog");
const { now, microsToUsd } = require("../util");
const { routeJob, typicalPriceUsd, ROUTED_TIERS } = require("./pick");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 28 * DAY_MS;
const DEFAULT_MIN_SAMPLES = 20;
// Laplace prior: a model with no signals scores (0 + 1) / (0 + 2).
const PRIOR_SCORE = 0.5;
const BUDGET_SCORE_TOLERANCE = 0.02;
const BALANCED_COST_WEIGHT = 0.15;
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

/** Raw signal sums per (job, model) over successful requests since `since`. */
function signalRows(db, since) {
  return db
    .prepare(
      `SELECT job, model_id,
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
        GROUP BY job, model_id
        ORDER BY job, model_id`
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
    model_id: row.model_id,
    n,
    ...counts,
    avg_cost_micros: n ? Math.round(Number(row.cost_sum) / n) : 0,
    avg_latency_ms: Number(row.latency_n) ? Math.round(Number(row.latency_sum) / Number(row.latency_n)) : null,
    score: laplaceScore(counts),
  };
}

/**
 * Per (job, model) satisfaction and cost over the window.
 * @param {object} db
 * @param {{ sinceMs?: number }} [opts]  epoch-ms lower bound (or a lookback in ms); default 28 days
 */
function computeStats(db, { sinceMs } = {}) {
  return signalRows(db, resolveSince(sinceMs)).map(toStat);
}

/** Stats keyed by the job whose routes served them (phase 1 answers `action` with chat routes). */
function statsByRoutedJob(db, since) {
  const merged = new Map();
  for (const row of signalRows(db, since)) {
    const job = routeJob(row.job);
    const key = `${job}\u0000${row.model_id}`;
    const acc = merged.get(key) || { job, model_id: row.model_id, n: 0, up: 0, down: 0, regenerated: 0, overridden: 0, cost_sum: 0, latency_sum: 0, latency_n: 0 };
    for (const k of ["n", "up", "down", "regenerated", "overridden", "cost_sum", "latency_sum", "latency_n"]) acc[k] += Number(row[k]);
    merged.set(key, acc);
  }
  const byJob = new Map();
  for (const acc of merged.values()) {
    const stat = toStat(acc);
    if (!byJob.has(stat.job)) byJob.set(stat.job, new Map());
    byJob.get(stat.job).set(stat.model_id, stat);
  }
  return byJob;
}

const usd = (micros) => `$${microsToUsd(micros).toFixed(4)}`;
const cheaperFirst = (a, b) => a.avg_cost_micros - b.avg_cost_micros || b.score - a.score || a.model_id.localeCompare(b.model_id);

// One selection rule per tier. Each returns { stat, rule } or null.
const SELECTORS = {
  // Highest satisfaction; ties -> cheaper.
  quality: (pool) => ({ stat: [...pool].sort((a, b) => b.score - a.score || cheaperFirst(a, b))[0], rule: "best satisfaction" }),
  // Cheapest model that is about as satisfying as the current budget pick.
  budget: (pool, currentScore) => {
    const ok = pool.filter((s) => s.score >= currentScore - BUDGET_SCORE_TOLERANCE).sort(cheaperFirst);
    return ok.length ? { stat: ok[0], rule: `cheapest within ${BUDGET_SCORE_TOLERANCE} of the current satisfaction` } : null;
  },
  // Satisfaction minus a cost penalty, cost normalised to the dearest candidate.
  balanced: (pool) => {
    const maxCost = Math.max(0, ...pool.map((s) => s.avg_cost_micros));
    const value = (s) => s.score - BALANCED_COST_WEIGHT * (maxCost > 0 ? s.avg_cost_micros / maxCost : 0);
    return { stat: [...pool].sort((a, b) => value(b) - value(a) || cheaperFirst(a, b))[0], rule: "best satisfaction for the cost" };
  },
};

function describe(stat, model) {
  return `${model?.label || stat.model_id} ${stat.score.toFixed(2)} (n=${stat.n}, avg ${usd(stat.avg_cost_micros)})`;
}

/**
 * Propose routing changes from the stats. Only models with >= minSamples requests are considered,
 * and the current pick must have >= minSamples too unless it has no data at all. The private tier
 * is never touched (it is a privacy decision, not a satisfaction one).
 * @returns {Array<{ job, tier, current_model_id, proposed_model_id, reason, current_score,
 *                   proposed_score, current_n, proposed_n }>}
 */
function proposeRoutes(db, { minSamples = DEFAULT_MIN_SAMPLES, sinceMs } = {}) {
  const min = Math.max(1, Math.floor(Number(minSamples) || DEFAULT_MIN_SAMPLES));
  const stats = statsByRoutedJob(db, resolveSince(sinceMs));
  const models = new Map(listModels(db).map((m) => [m.id, m]));
  const proposals = [];

  for (const route of getRoutes(db)) {
    const { job, tier, model_id: currentId } = route;
    // `action` cells are unused in phase 1 (action routes as chat), and private is off limits.
    if (!ROUTED_TIERS.includes(tier) || routeJob(job) !== job) continue;
    const jobStats = stats.get(job);
    if (!jobStats) continue;
    const current = jobStats.get(currentId) || null;
    if (current && current.n < min) continue;

    const pool = [...jobStats.values()].filter((s) => {
      const m = models.get(s.model_id);
      return s.n >= min && m && m.enabled && m.jobs.includes(job);
    });
    if (!pool.length) continue;

    const currentScore = current ? current.score : PRIOR_SCORE;
    const choice = SELECTORS[tier](pool, currentScore);
    if (!choice || choice.stat.model_id === currentId) continue;
    const proposed = choice.stat;

    // With no observed cost for the current budget pick, only the catalog can tell whether the
    // proposal is cheaper; never let the learner make the budget column dearer on a guess.
    if (tier === "budget" && !current) {
      const currentPrice = typicalPriceUsd(models.get(currentId));
      const proposedPrice = typicalPriceUsd(models.get(proposed.model_id));
      if (currentPrice === null || proposedPrice === null || proposedPrice > currentPrice) continue;
    }

    const currentText = current ? describe(current, models.get(currentId)) : `${models.get(currentId)?.label || currentId} (no data)`;
    proposals.push({
      job,
      tier,
      current_model_id: currentId,
      proposed_model_id: proposed.model_id,
      reason: `learn ${job}/${tier}, ${choice.rule}: ${describe(proposed, models.get(proposed.model_id))} vs ${currentText}`,
      current_score: round(currentScore, 4),
      proposed_score: round(proposed.score, 4),
      current_n: current ? current.n : 0,
      proposed_n: proposed.n,
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

/**
 * Phase-1 gate: do people keep auto-pick on, and do credits cover API costs?
 * `users` counts users active in the window (the auto-pick denominator: sign-ups who never chatted
 * say nothing about trust in the router); `total_users` counts everyone.
 * Rates are fractions (0..1), *_pct fields are percentages; each is null when its denominator is 0.
 */
function gateMetrics(db, { sinceMs } = {}) {
  const since = resolveSince(sinceMs);
  const r = db
    .prepare(
      `SELECT COUNT(*) AS requests,
              COALESCE(SUM(CASE WHEN kind = 'auto' THEN 1 ELSE 0 END), 0) AS auto,
              COALESCE(SUM(CASE WHEN kind = 'switch' THEN 1 ELSE 0 END), 0) AS switches,
              COALESCE(SUM(api_cost_micros), 0) AS api,
              COALESCE(SUM(charged_micros), 0) AS charged,
              COALESCE(SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), 0) AS up,
              COALESCE(SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END), 0) AS down
         FROM requests WHERE created_at >= ?`
    )
    .get(since);
  const u = db
    .prepare(
      `SELECT COUNT(*) AS users, COALESCE(SUM(CASE WHEN auto_pick = 1 THEN 1 ELSE 0 END), 0) AS auto_on
         FROM users
        WHERE id IN (SELECT DISTINCT user_id FROM requests WHERE created_at >= ? AND user_id IS NOT NULL)`
    )
    .get(since);
  const totalUsers = Number(db.prepare("SELECT COUNT(*) AS n FROM users").get().n);

  const requests = Number(r.requests);
  const api = Number(r.api);
  const charged = Number(r.charged);
  const users = Number(u.users);
  return {
    users,
    total_users: totalUsers,
    auto_pick_on_pct: pct(Number(u.auto_on), users),
    override_rate: round(ratio(Number(r.switches), Number(r.auto)), 4),
    requests,
    api_cost_usd: microsToUsd(api),
    charged_usd: microsToUsd(charged),
    gross_margin_pct: pct(charged - api, charged),
    thumbs_up_rate: round(ratio(Number(r.up), Number(r.up) + Number(r.down)), 4),
    credits_cover_api_costs: requests ? charged >= api : null,
    since_ms: since,
  };
}

module.exports = {
  computeStats,
  proposeRoutes,
  applyProposals,
  gateMetrics,
  laplaceScore,
  resolveSince,
  PRIOR_SCORE,
  BUDGET_SCORE_TOLERANCE,
  BALANCED_COST_WEIGHT,
};
