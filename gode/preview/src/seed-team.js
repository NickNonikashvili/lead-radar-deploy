"use strict";
// Four fictional teammates of the demo account and three and a half weeks of their usage, so the
// admin pages have something to show on a first visit: the gate metrics and the per-model table,
// the users list, and a learner run that finds two routing changes worth proposing.
//
// What is real and what is made up:
// - The accounts are made by Gode's own auth.signup (signup bonus included) with a random password
//   nobody knows, and their settings by the same UPDATE PATCH /api/me runs. Their credit purchases
//   are credits.grant(..., "purchase"), and every answer is paid through credits.reserve() and
//   credits.settle() like the pipeline does, so balance == SUM(ledger) holds for each of them and
//   the gate's money figures add up with the ledger.
// - Each answer's model, tier and effort come from Gode's real picker (src/router/pick.js) for that
//   teammate's plan and the request's difficulty, and its cost from the catalog prices
//   (credits.estimateApiCostMicros, the pipeline's typical answer lengths, the 30% margin).
// - Only the routing log is made up: one `requests` row per answer (that table never holds a
//   prompt or an answer), with the thumbs, regenerations and switches a small team would leave.
//   The teammates have no conversations to look at, and nobody can sign in as them.
//
// The numbers are chosen so the learner (src/router/learn.js, 20 ratings per model and cell) has
// exactly two proposals: Chat · Quality to Claude Opus 5.5 (people kept switching to it from
// Gemini 4 Carbon) and Code · Budget to DeepSeek V4.1 Flash (as well liked as Qwen3 Coder Next for
// easy code, and cheaper). Everything else stays below the threshold. Deterministic: the same rows
// on every first visit (a seeded PRNG), shifted to end "now".
//
// All addresses are @example.com (reserved for examples); the names are made up.

const { newId, usdToMicros } = require("../../src/util");
const { expectedOutputTokens } = require("../../src/chat/pipeline");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MINUTE = 60_000;
const CLASSIFIER = "openrouter:deepseek/deepseek-v4.1-flash";
const UPSTREAM_PROVIDER = "preview (simulated)";

const TEAM = [
  { key: "alex", email: "alex@example.com", plan: "balanced", autoPick: true, joinedDaysAgo: 27, purchaseUsd: 25 },
  { key: "priya", email: "priya@example.com", plan: "best", autoPick: true, joinedDaysAgo: 26, purchaseUsd: 25 },
  { key: "jordan", email: "jordan@example.com", plan: "saver", autoPick: true, joinedDaysAgo: 25, purchaseUsd: 10 },
  // Mei turned auto-pick off and chooses every model herself (kind 'manual').
  { key: "mei", email: "mei@example.com", plan: "balanced", autoPick: false, joinedDaysAgo: 24, purchaseUsd: 10 },
];

const MODELS = {
  carbon: "openrouter:google/gemini-4-carbon",
  opus: "openrouter:anthropic/claude-opus-5.5",
  sonnet: "openrouter:anthropic/claude-sonnet-5.5",
  coder: "openrouter:qwen/qwen3-coder-next",
  flash: "openrouter:deepseek/deepseek-v4.1-flash",
};

/** mulberry32: a small deterministic PRNG, so every first visit gets the same history. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The history, one entry per answer, oldest first once shuffled into days:
 * { who, job, d (difficulty), model? (a pick by hand), kind, fb (1/-1/null), regen, over, status,
 *   then? (the follow-up this answer caused: a switch or a regenerate) }.
 */
function script() {
  const out = [];
  // n answers with these outcomes, in order: `up` thumbs up, `down` thumbs down, `regen`
  // regenerated (a regenerate answer follows, unrated), `over` switched away to `switchTo` (the
  // switch answer follows, with the outcome taken from `switchOutcomes`), the rest unrated.
  function batch({ who, job, d, n, up = 0, down = 0, regen = 0, over = 0, model = null, kind = model ? "manual" : "auto", switchTo = null, switchOutcomes = [], priv = false, status = "ok" }) {
    const whoList = [].concat(who);
    const dList = [].concat(d);
    for (let i = 0; i < n; i++) {
      const base = { who: whoList[i % whoList.length], job, d: dList[i % dList.length], model, kind, fb: null, regen: 0, over: 0, priv, status };
      let k = i;
      if (k < up) base.fb = 1;
      else if ((k -= up) < down) base.fb = -1;
      else if ((k -= down) < regen) {
        base.regen = 1;
        base.then = { kind: "regenerate", fb: null };
      } else if ((k -= regen) < over) {
        base.over = 1;
        base.then = { kind: "switch", model: switchTo, fb: switchOutcomes[k] === undefined ? null : switchOutcomes[k] };
      }
      out.push(base);
    }
  }

  // Chat · Quality: Gemini 4 Carbon is the routed pick; people switch to Claude Opus 5.5 and like it.
  batch({ who: ["priya", "priya", "alex"], job: "chat", d: [4, 5, 3, 2, 4], n: 28, up: 11, down: 6, regen: 2, over: 7, switchTo: MODELS.opus, switchOutcomes: [1, 1, 1, 1, 1, null, 1] });
  // (Priya is on Best, where difficulty 2-5 is the quality column; Alex on Balanced reaches it at 4-5.)
  for (const e of out) if (e.who === "alex" && e.d < 4) e.d = 4;
  // Mei picks Opus by hand for hard questions (the quality column of her Balanced plan).
  batch({ who: "mei", job: "chat", d: [4, 5], n: 15, model: MODELS.opus, up: 12, down: 2, regen: 1 });

  // Code · Budget: Qwen3 Coder Next is the routed pick; DeepSeek V4.1 Flash does as well for less.
  batch({ who: ["jordan", "jordan", "alex"], job: "code", d: [1, 2, 3, 2], n: 26, up: 12, down: 5, regen: 2, over: 3, switchTo: MODELS.flash, switchOutcomes: [1, 1, -1] });
  for (const e of out) if (e.who === "alex" && e.job === "code" && e.d > 2) e.d = 2;
  batch({ who: "mei", job: "code", d: [1, 2], n: 19, model: MODELS.flash, up: 14, down: 3, regen: 1 });

  // Everything else: real traffic, too few ratings per cell for the learner to act on.
  batch({ who: ["alex", "alex", "priya", "jordan"], job: "chat", d: [3, 3, 1, 4], n: 18, up: 6, down: 1 });
  batch({ who: ["jordan", "alex"], job: "chat", d: [1, 2], n: 20, up: 5, down: 2, regen: 1 });
  batch({ who: ["alex", "jordan"], job: "code", d: [3, 4], n: 12, up: 6, down: 1, over: 1, switchTo: MODELS.opus, switchOutcomes: [1] });
  batch({ who: "priya", job: "code", d: [3, 4, 5], n: 14, up: 8, down: 1, regen: 1 });
  batch({ who: "mei", job: "code", d: [3], n: 4, model: MODELS.sonnet, up: 3 });
  batch({ who: ["alex", "priya", "jordan"], job: "image", d: 2, n: 15, up: 6, down: 1, regen: 2 });
  batch({ who: ["priya", "alex"], job: "music", d: 2, n: 4, up: 2 });
  batch({ who: ["alex", "priya"], job: "voice", d: 2, n: 3, up: 1 });
  batch({ who: ["priya", "alex"], job: "video", d: 3, n: 3, up: 1 });
  // Private questions (health, money): redacted, sent to a zero-retention model.
  batch({ who: ["alex", "priya", "jordan"], job: "chat", d: [2, 3], n: 6, up: 2, priv: true });
  // A few that went wrong: provider errors (free) and answers stopped part-way (charged for what came).
  batch({ who: ["alex", "jordan", "priya"], job: "chat", d: [2, 3, 4], n: 3, status: "error" });
  batch({ who: ["priya", "alex"], job: "code", d: [4, 3], n: 2, status: "stopped" });
  return out;
}

const LENGTH_BY_DIFFICULTY = ["short", "short", "medium", "long", "long"];
const MEDIA_UNITS = { image: 1, video: 5, music: 1, voice: 0.6 };

/** A typical end-to-end latency for an answer (the seeds run with no pauses, so they measure ~0). */
function typicalLatencyMs({ job, outputTokens, effort }, jitter = (x) => x) {
  if (job === "video") return jitter(70_000);
  if (job === "image") return jitter(9_000);
  if (job === "music" || job === "voice") return jitter(14_000);
  return jitter(900 + (outputTokens || 400) * 6 + (effort === "high" ? 4_000 : 0));
}

function mediaUnits(model, job) {
  if (job === "video" && model.price_unit === "second") return 6;
  if (job === "music" && model.price_unit === "minute") return 0.5;
  return MEDIA_UNITS[job] ?? 1;
}

/**
 * @param {{ db, auth, credits, picker, config }} deps
 * @returns {Promise<{ users: string[], requests: number }>}
 */
async function seedTeam({ db, auth, credits, picker, config }) {
  const rand = prng(20261127);
  const jitter = (x, spread = 0.3) => Math.max(1, Math.round(x * (1 + (rand() * 2 - 1) * spread)));
  const now = Date.now();
  const users = {};

  // ---- accounts (oldest first), each with its welcome credit and one credit purchase --------
  const ledgerMark = () => db.rows("ledger").reduce((m, l) => Math.max(m, l.id), 0);
  const stampLedger = (after, at) => db.update("ledger", (l) => l.id > after, { created_at: at });
  const pass = () => {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(18));
    return "seed-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  for (const [i, m] of TEAM.entries()) {
    const joined = now - m.joinedDaysAgo * DAY - (3 + i) * HOUR;
    const mark = ledgerMark();
    const user = await auth.signup({ email: m.email, password: pass() });
    db.prepare("UPDATE users SET plan = ?, auto_pick = ? WHERE id = ?").run(m.plan, m.autoPick ? 1 : 0, user.id);
    db.update("users", (u) => u.id === user.id, { created_at: joined });
    db.update("bonus_claims", (b) => b.created_at > now - HOUR, { created_at: joined });
    stampLedger(mark, joined);
    const buy = ledgerMark();
    credits.grant(user.id, usdToMicros(m.purchaseUsd), "purchase", `preview_seed_team_${m.key}`);
    stampLedger(buy, joined + 20 * MINUTE);
    users[m.key] = { id: user.id, joined };
  }

  // ---- the routing log ------------------------------------------------------------------------
  const entries = script();
  // Spread over the 23 days after everyone joined, in working hours, in a stable shuffled order.
  const order = entries.map((e, i) => ({ e, r: rand(), i })).sort((a, b) => a.r - b.r);
  const start = now - 23 * DAY;
  const step = (23 * DAY - 6 * HOUR) / order.length;
  let count = 0;

  const insertRequest = (row) => {
    db.insert("requests", row);
    count += 1;
  };

  function answer({ who, job, d, model: chosen, kind, fb, regen, over, priv, status, pins, at }) {
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(users[who].id);
    const pick = picker.pick({ job, difficulty: d, private: priv, user: userRow, pins, overrideModelId: chosen || null });
    const model = pick.model;
    const media = Boolean(model.price_unit);
    let input = null;
    let output = null;
    let reasoning = null;
    let units = null;
    let api;
    if (media) {
      units = mediaUnits(model, job);
      api = credits.estimateApiCostMicros({ model, units });
    } else {
      input = jitter(120 + d * 260);
      reasoning = { none: 0, low: 300, medium: 1000, high: 2500 }[pick.effort] ?? 0;
      reasoning = reasoning ? jitter(reasoning, 0.4) : 0;
      output = jitter(expectedOutputTokens(LENGTH_BY_DIFFICULTY[d - 1], "none")) + reasoning;
      if (status === "stopped") output = Math.round(output * (0.25 + rand() * 0.3));
      api = status === "error" ? 0 : credits.estimateApiCostMicros({ model, inputTokens: input, maxOutputTokens: output });
      if (status === "error") {
        input = null;
        output = null;
        reasoning = null;
      }
    }
    const charged = status === "error" ? 0 : credits.priceFor(api);
    const id = newId();
    if (charged > 0) {
      const mark = ledgerMark();
      const { holdId } = credits.reserve(users[who].id, charged);
      credits.settle(holdId, charged, id);
      stampLedger(mark, at);
    }
    const latency = typicalLatencyMs({ job, outputTokens: output, effort: pick.effort }, jitter);
    insertRequest({
      id,
      user_id: users[who].id,
      conversation_id: newId(),
      message_id: newId(),
      kind,
      job,
      difficulty: d,
      private: pick.private ? 1 : 0,
      tier: pick.tier,
      model_id: model.id,
      gateway: model.gateway,
      // Simulated like every preview request, media included (see markSimulatedUpstream).
      upstream_provider: UPSTREAM_PROVIDER,
      effort: pick.effort,
      zdr: pick.zdrRequired ? 1 : 0,
      pinned: kind === "auto" ? 0 : 1,
      classifier_model: priv ? "heuristic" : CLASSIFIER,
      input_tokens: input,
      output_tokens: output,
      reasoning_tokens: reasoning,
      media_units: units,
      api_cost_micros: api,
      charged_micros: charged,
      latency_ms: status === "error" ? jitter(1_500) : latency,
      status,
      error_code: status === "error" ? "upstream_error" : status === "stopped" ? "aborted" : null,
      redactions: priv ? JSON.stringify(rand() < 0.5 ? { PERSON: 1 } : { PERSON: 1, EMAIL: 1 }) : "{}",
      feedback: fb,
      regenerated: regen,
      overridden: over,
      created_at: at,
      context_included: 0,
    });
    return { model, tier: pick.tier };
  }

  order.forEach(({ e }, i) => {
    const day = start + i * step;
    // Working hours (08:00-18:00 UTC), never later than half an hour ago.
    const at = Math.min(Math.round(day - (day % DAY) + 8 * HOUR + (day % DAY) * (10 / 24) + rand() * 20 * MINUTE), now - 30 * MINUTE - (order.length - i) * 1000);
    const first = answer({ ...e, at });
    if (e.then) {
      const pins = { [e.job]: { model_id: first.model.id, tier: first.tier, source: e.kind === "auto" ? "auto" : "user" } };
      const follow = e.then.kind === "switch" ? { model: e.then.model, kind: "switch" } : { model: first.model.id, kind: "regenerate" };
      answer({ ...e, ...follow, fb: e.then.fb, regen: 0, over: 0, pins, at: at + 2 * MINUTE + Math.round(rand() * 3 * MINUTE) });
    }
  });

  return { users: Object.keys(users), requests: count };
}

module.exports = { seedTeam, typicalLatencyMs, TEAM };
