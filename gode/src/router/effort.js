// Difficulty -> reasoning effort, and plan x difficulty -> routing tier.
// These tables are product policy (how much quality each plan buys), so they live in one place and
// are kept as plain data that the admin docs and tests can read.
const { MEDIA_JOBS } = require("../seed/catalog");

const EFFORTS = Object.freeze(["none", "low", "medium", "high"]);
const PLANS = Object.freeze(["saver", "balanced", "best"]);
const DEFAULT_PLAN = "balanced";
// A missing or garbled difficulty is treated as an ordinary request rather than the cheapest or the
// most expensive one, so a classifier hiccup neither degrades nor overbills the answer.
const DEFAULT_DIFFICULTY = 3;

/** Index = difficulty - 1. Higher plans reach the quality column sooner. */
const TIER_BY_PLAN = Object.freeze({
  saver: Object.freeze(["budget", "budget", "budget", "balanced", "balanced"]),
  balanced: Object.freeze(["budget", "budget", "balanced", "quality", "quality"]),
  best: Object.freeze(["balanced", "quality", "quality", "quality", "quality"]),
});

// Media cost is driven by the output (an image, N seconds of video), not by how hard the prompt is,
// so media tiers follow the plan alone.
const MEDIA_TIER_BY_PLAN = Object.freeze({ saver: "budget", balanced: "balanced", best: "quality" });

// Used for "upgrade only" pin decisions. private ranks highest so a conversation that went private
// never drifts back to a public model through an automatic pick.
const TIER_RANK = Object.freeze({ budget: 0, balanced: 1, quality: 2, private: 3 });

/** Integer 1..5; anything unparseable becomes DEFAULT_DIFFICULTY. */
function clampDifficulty(d) {
  const n = typeof d === "string" && d.trim() !== "" ? Number(d) : d;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_DIFFICULTY;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function normalizePlan(plan) {
  return PLANS.includes(plan) ? plan : DEFAULT_PLAN;
}

/** 1 none, 2 low, 3 medium, 4-5 high. */
function difficultyToEffort(d) {
  const level = clampDifficulty(d);
  if (level <= 1) return "none";
  if (level === 2) return "low";
  if (level === 3) return "medium";
  return "high";
}

function isMediaJob(job) {
  return MEDIA_JOBS.includes(job);
}

/** Routing column for a request. Unknown plans fall back to 'balanced'. Never returns 'private'. */
function chooseTier({ job, difficulty, plan } = {}) {
  const p = normalizePlan(plan);
  if (isMediaJob(job)) return MEDIA_TIER_BY_PLAN[p];
  return TIER_BY_PLAN[p][clampDifficulty(difficulty) - 1];
}

module.exports = {
  EFFORTS,
  PLANS,
  DEFAULT_PLAN,
  DEFAULT_DIFFICULTY,
  TIER_BY_PLAN,
  MEDIA_TIER_BY_PLAN,
  TIER_RANK,
  clampDifficulty,
  normalizePlan,
  difficultyToEffort,
  isMediaJob,
  chooseTier,
};
