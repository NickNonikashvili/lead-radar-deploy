// Model picker: turns a classification + the user's settings + the conversation's pins into one
// concrete model, tier and effort. The routing table and catalog are read from the database on
// every call (they are tiny), so admin edits and learned routes apply to the very next request.
const { JOBS, TEXT_JOBS, listModels, getRoutes } = require("../seed/catalog");
const { AppError, safeJsonParse } = require("../util");
const { EFFORTS, TIER_RANK, chooseTier, clampDifficulty, difficultyToEffort, isMediaJob, normalizePlan } = require("./effort");

const ROUTED_TIERS = ["quality", "balanced", "budget"];
const EU_REGIONS = ["eu", "self"];

// "Typical request" sizes used only to ORDER models by price (switch menu, cheapest fallback, the
// learner's budget guard). Billing always uses real usage.
const TYPICAL_INPUT_TOKENS = 1000;
const TYPICAL_OUTPUT_TOKENS = 500;
const TYPICAL_TTS_CHARS = 500;
const DEFAULT_CLIP_SECONDS = 5;

/** Phase 1 answers `action` with the chat route (see "Core vocabulary"). */
function routeJob(job) {
  return job === "action" ? "chat" : job;
}

function clipSeconds(params) {
  const raw = params?.duration;
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CLIP_SECONDS;
}

/** Approximate USD for one typical request, or null when the catalog has no price. */
function typicalPriceUsd(model) {
  if (!model) return null;
  if (!model.price_unit) {
    if (model.price_in === null && model.price_out === null) return null;
    return ((model.price_in || 0) * TYPICAL_INPUT_TOKENS + (model.price_out || 0) * TYPICAL_OUTPUT_TOKENS) / 1e6;
  }
  const ppu = model.price_per_unit;
  if (ppu === null || ppu === undefined || !Number.isFinite(Number(ppu))) return null;
  const p = model.params || {};
  switch (model.price_unit) {
    case "image":
      return ppu * (Number(p.num_images) || 1);
    case "second":
      return ppu * clipSeconds(p);
    case "minute": {
      const seconds = Number(p.music_length_ms) / 1000 || clipSeconds(p);
      return ppu * Math.max(1, Math.ceil(seconds / 60));
    }
    case "1k_chars":
      return (ppu * TYPICAL_TTS_CHARS) / 1000;
    default: // megapixel (~1 MP at the default size), request, song
      return Number(ppu);
  }
}

/** Sort comparator on typical price; models without a price always sort last. */
function byPrice(direction) {
  return (a, b) => {
    const pa = typicalPriceUsd(a);
    const pb = typicalPriceUsd(b);
    if (pa === null || pb === null) return (pa === null) - (pb === null) || a.id.localeCompare(b.id);
    return direction * (pa - pb) || a.id.localeCompare(b.id);
  };
}

function normalizePins(pins) {
  const obj = typeof pins === "string" ? safeJsonParse(pins, {}) : pins;
  return obj && typeof obj === "object" && !Array.isArray(obj) ? { ...obj } : {};
}

function validPin(pin) {
  return pin && typeof pin === "object" && typeof pin.model_id === "string" && pin.model_id ? pin : null;
}

/**
 * Text jobs share one message history, so once any text job in a conversation was answered in
 * private mode, every later text request re-sends that private content and must stay private too.
 * Media prompts carry only the latest message, so media jobs are not affected.
 */
function conversationIsPrivate(pins, job) {
  if (!TEXT_JOBS.includes(job)) return false;
  return Object.entries(pins).some(([j, p]) => TEXT_JOBS.includes(j) && validPin(p) && p.tier === "private");
}

function rankOf(tier) {
  return tier in TIER_RANK ? TIER_RANK[tier] : -1;
}

/** Other routed tiers, nearest first; ties go to the cheaper tier. */
function walkOrder(tier) {
  const r = rankOf(tier);
  return ROUTED_TIERS.filter((t) => t !== tier).sort((a, b) => Math.abs(rankOf(a) - r) - Math.abs(rankOf(b) - r) || rankOf(a) - rankOf(b));
}

/**
 * @param {object} deps
 * @param {object} deps.db
 * @param {object} deps.config     uses config.router.privateFallback ('zdr' | 'block')
 * @param {object} deps.providers  isAvailable(model) -> boolean
 */
function createPicker({ db, config, providers } = {}) {
  if (!db) throw new TypeError("createPicker: db is required");
  if (!providers || typeof providers.isAvailable !== "function") throw new TypeError("createPicker: providers.isAvailable is required");
  const privateFallback = () => (config?.router?.privateFallback === "block" ? "block" : "zdr");

  function loadCatalog() {
    const models = new Map(listModels(db).map((m) => [m.id, m]));
    const routes = {};
    for (const r of getRoutes(db)) (routes[r.job] ||= {})[r.tier] = r;
    return { models, routes };
  }

  function buildContext({ job, difficulty, private: isPrivate, user, pins }) {
    if (!JOBS.includes(job)) throw new AppError(400, "bad_request", `Unknown job "${String(job).slice(0, 20)}"`);
    const u = user && typeof user === "object" ? user : {};
    const rjob = routeJob(job);
    const pinMap = normalizePins(pins);
    const classifiedPrivate = Boolean(isPrivate);
    const stickyPrivate = !classifiedPrivate && conversationIsPrivate(pinMap, rjob);
    return {
      job: rjob,
      originalJob: job,
      difficulty: clampDifficulty(difficulty),
      plan: normalizePlan(u.plan),
      strict: Boolean(u.strict_privacy),
      euOnly: Boolean(u.eu_only),
      private: classifiedPrivate || stickyPrivate,
      stickyPrivate,
      pins: pinMap,
      ...loadCatalog(),
    };
  }

  /** Why a model can't serve this request, or null when it can. Messages are safe to show users. */
  function ineligibleReason(model, ctx) {
    if (!model) return "Unknown model";
    if (!model.enabled) return `${model.label} is turned off`;
    if (!model.jobs.includes(ctx.job)) return `${model.label} can't do ${ctx.job}`;
    if (!providers.isAvailable(model)) return `${model.label} is not available right now`;
    const privateSafe = model.zdr || model.self_hosted;
    if (ctx.strict && !privateSafe) return "Strict privacy allows only zero-retention or self-hosted models";
    // Media: no media model is zero-retention today, so the admin's private cell for a media job
    // (prompts go out generically redacted) is accepted for private requests. Strict privacy, the
    // user's explicit opt-in, still only accepts zero-retention models.
    const privateMediaPick = isMediaJob(ctx.job) && ctx.routes[ctx.job]?.private?.model_id === model.id;
    if (ctx.private && !privateSafe && !privateMediaPick) {
      return "This conversation looks private, so only zero-retention or self-hosted models can answer it";
    }
    if (ctx.euOnly && TEXT_JOBS.includes(ctx.job) && !EU_REGIONS.includes(model.region)) {
      return `EU-only is on and ${model.label} is not EU-hosted`;
    }
    return null;
  }

  const eligible = (model, ctx) => Boolean(model) && ineligibleReason(model, ctx) === null;

  function routeModel(ctx, tier) {
    const route = ctx.routes[ctx.job]?.[tier];
    const model = route ? ctx.models.get(route.model_id) : null;
    return model && eligible(model, ctx) ? model : null;
  }

  function eligibleModels(ctx) {
    return [...ctx.models.values()].filter((m) => eligible(m, ctx));
  }

  /** The route row that configures `model` for this job (same tier first), for effort_override. */
  function routeFor(ctx, tier, modelId) {
    const rows = ctx.routes[ctx.job] || {};
    if (rows[tier]?.model_id === modelId) return rows[tier];
    return [...ROUTED_TIERS, "private"].map((t) => rows[t]).find((r) => r?.model_id === modelId) || null;
  }

  /** Routed tier holding this model for the job (switch menu picks are often routed models). */
  function routedTierOf(ctx, modelId) {
    const rows = ctx.routes[ctx.job] || {};
    return ROUTED_TIERS.find((t) => rows[t]?.model_id === modelId) || null;
  }

  function effortFor(ctx, model, route) {
    if (isMediaJob(ctx.job) || !model.supports_reasoning) return "none";
    const override = route?.effort_override;
    return EFFORTS.includes(override) ? override : difficultyToEffort(ctx.difficulty);
  }

  function autoLabel(ctx, tier) {
    const job = ctx.originalJob === ctx.job ? ctx.job : `${ctx.originalJob} (as ${ctx.job})`;
    const difficulty = isMediaJob(ctx.job) ? "" : ` · difficulty ${ctx.difficulty}`;
    return `auto: ${job}${difficulty} · ${ctx.plan} plan -> ${tier}`;
  }

  /**
   * Assemble the pick result. `pin` is the pin to store for this job, or null to leave pins as
   * they are (pinsUpdate is only returned when something actually changed).
   */
  function result(ctx, { model, tier, pinned, reason, pin }) {
    const route = routeFor(ctx, tier, model.id);
    const old = validPin(ctx.pins[ctx.job]);
    let pinsUpdate = null;
    if (pin) {
      const same = old && old.model_id === pin.model_id && old.tier === pin.tier && old.source === pin.source;
      if (!same) pinsUpdate = { ...ctx.pins, [ctx.job]: pin };
    }
    return {
      model,
      tier,
      effort: effortFor(ctx, model, route),
      // True when the answer comes from the conversation's pinned model (kept or just pinned by the user).
      pinned: pinned || Boolean(old && old.model_id === model.id),
      // Restrict the gateway to zero-retention endpoints whenever the request needs it and the model
      // has them. Also what the 🔒 badge shows, so it is never set for a model that can't honour it.
      zdrRequired: (ctx.private || ctx.strict) && Boolean(model.zdr || model.self_hosted),
      reason,
      pinsUpdate,
      private: ctx.private,
    };
  }

  // Rule 3: the user picked a model (manual mode or the switch menu).
  function pickOverride(ctx, overrideModelId) {
    const id = String(overrideModelId).trim();
    const model = ctx.models.get(id) || null;
    const why = ineligibleReason(model, ctx);
    if (why) throw new AppError(400, "bad_request", why);
    const tier = ctx.private ? "private" : routedTierOf(ctx, id) || chooseTier(ctx);
    return result(ctx, {
      model,
      tier,
      pinned: true,
      reason: `your pick: ${model.label} (pinned for this conversation)`,
      pin: { model_id: id, tier, source: "user" },
    });
  }

  // Rule 4: private requests go to the private tier (self-hosted), else to a zero-retention model.
  function pickPrivate(ctx) {
    const pin = validPin(ctx.pins[ctx.job]);
    const why = ctx.stickyPrivate ? "private (earlier in this conversation)" : "private";
    // The user's own pick is kept when it is private-safe: privacy is a hard filter, not a reason to
    // override an explicit choice.
    if (pin?.source === "user") {
      const model = ctx.models.get(pin.model_id);
      if (eligible(model, ctx)) {
        return result(ctx, {
          model,
          tier: "private",
          pinned: true,
          reason: `${why}: pinned for this conversation (your pick)`,
          pin: { model_id: model.id, tier: "private", source: "user" },
        });
      }
    }
    // Anything else becomes an auto private pin: a user-pinned model that is not private-safe can
    // no longer receive this conversation's history.
    const choose = (model, reason) =>
      result(ctx, { model, tier: "private", pinned: false, reason, pin: { model_id: model.id, tier: "private", source: "auto" } });

    const own = routeModel(ctx, "private");
    if (own) {
      const kind = own.self_hosted
        ? "self-hosted model"
        : own.zdr
          ? "zero-retention private pick"
          : `private pick (no zero-retention model makes ${ctx.job}; personal details are removed from the prompt)`;
      return choose(own, `${why}: ${kind}`);
    }

    if (privateFallback() === "block") {
      throw new AppError(409, "private_blocked", "This looks private and no self-hosted model is available, so it was not sent to any AI provider.");
    }
    const tier = chooseTier(ctx);
    for (const t of [tier, ...ROUTED_TIERS.filter((x) => x !== tier)]) {
      const model = routeModel(ctx, t);
      if (model) return choose(model, `${why}: no self-hosted model, using zero-retention model (${t} pick)`);
    }
    const [best] = eligibleModels(ctx).sort(byPrice(-1));
    if (best) return choose(best, `${why}: no self-hosted model, using zero-retention model`);
    throw new AppError(409, "private_blocked", "This looks private and no self-hosted or zero-retention model is available for it.");
  }

  // Rule 5: keep the conversation on its model. Returns null to fall through to the auto pick.
  function reusePin(ctx) {
    const pin = validPin(ctx.pins[ctx.job]);
    if (!pin) return null;
    const model = ctx.models.get(pin.model_id);
    if (!eligible(model, ctx)) return null;
    const tier = pin.tier in TIER_RANK ? pin.tier : chooseTier(ctx);
    const reuse = () =>
      result(ctx, {
        model,
        tier,
        pinned: true,
        reason: pin.source === "user" ? "pinned for this conversation (your pick)" : "pinned for this conversation",
        pin: null,
      });
    if (pin.source === "user") return reuse();
    // Auto pins only ever upgrade: a harder follow-up may move up a tier, an easy one never down.
    const wanted = chooseTier(ctx);
    if (rankOf(wanted) <= rankOf(pin.tier)) return reuse();
    const upgraded = pickAuto(ctx, { upgradeFrom: pin.tier });
    // Only a routed pick of a higher tier is an upgrade; the cheapest-model fallback is not.
    const isRouted = ctx.routes[ctx.job]?.[upgraded.tier]?.model_id === upgraded.model.id;
    return isRouted && rankOf(upgraded.tier) > rankOf(pin.tier) ? upgraded : reuse();
  }

  // Rule 6: the plan's tier for this difficulty, then the nearest other tier, then the cheapest.
  function pickAuto(ctx, { upgradeFrom = null, keepUserPin = false } = {}) {
    const tier = chooseTier(ctx);
    let label = autoLabel(ctx, tier);
    if (upgradeFrom) label += ` (upgraded from ${upgradeFrom})`;
    // An unusable user pin is left in place so the conversation returns to it once it is usable.
    const pinFor = (model, t) => (keepUserPin ? null : { model_id: model.id, tier: t, source: "auto" });
    const choose = (model, t, reason) => result(ctx, { model, tier: t, pinned: false, reason, pin: pinFor(model, t) });

    const routed = routeModel(ctx, tier);
    if (routed) return choose(routed, tier, label);
    for (const t of walkOrder(tier)) {
      const model = routeModel(ctx, t);
      if (model) return choose(model, t, `${label}; ${tier} pick can't be used here, using ${t}`);
    }
    const [cheapest] = eligibleModels(ctx).sort(byPrice(1));
    if (cheapest) return choose(cheapest, tier, `${label}; no routed pick available, using the cheapest available model`);
    throw noModelError(ctx);
  }

  /** Distinguish "your privacy settings exclude everything" from "nothing is configured". */
  function noModelError(ctx) {
    const relaxed = { ...ctx, strict: false, euOnly: false, private: false };
    const blockedBySettings = (ctx.strict || ctx.euOnly) && [...ctx.models.values()].some((m) => eligible(m, relaxed));
    if (blockedBySettings) {
      const setting = ctx.strict ? "Strict privacy" : "EU-only";
      return new AppError(409, "private_blocked", `${setting} is on and no model that meets it is available for ${ctx.job}.`);
    }
    return new AppError(503, "no_model", `No model is available for ${ctx.job} right now.`);
  }

  /**
   * @returns {{ model, tier, effort, pinned, zdrRequired, reason, pinsUpdate, private }}
   *   `private` is the effective privacy decision (classifier flag OR sticky conversation privacy).
   */
  function pick({ job, difficulty, private: isPrivate = false, user = {}, pins = null, overrideModelId = null } = {}) {
    const ctx = buildContext({ job, difficulty, private: isPrivate, user, pins });
    if (overrideModelId !== null && overrideModelId !== undefined && String(overrideModelId).trim()) {
      return pickOverride(ctx, overrideModelId);
    }
    if (ctx.private) return pickPrivate(ctx);
    const pinned = reusePin(ctx);
    if (pinned) return pinned;
    const userPin = validPin(ctx.pins[ctx.job])?.source === "user";
    return pickAuto(ctx, { keepUserPin: userPin });
  }

  /**
   * Eligible + available models for the switch menu: routed picks first (private pick first for a
   * private request, then quality, balanced, budget), then alternates by price, dearest first.
   * Pass `pins` to apply the conversation's sticky privacy.
   */
  function candidates({ job, user = {}, private: isPrivate = false, pins = null } = {}) {
    const ctx = buildContext({ job, difficulty: undefined, private: isPrivate, user, pins });
    const tiers = ctx.private ? ["private", ...ROUTED_TIERS] : ROUTED_TIERS;
    const seen = new Set();
    const out = [];
    for (const t of tiers) {
      const model = routeModel(ctx, t);
      if (model && !seen.has(model.id)) {
        seen.add(model.id);
        out.push(model);
      }
    }
    const rest = eligibleModels(ctx).filter((m) => !seen.has(m.id)).sort(byPrice(-1));
    return [...out, ...rest];
  }

  return { pick, candidates };
}

module.exports = { createPicker, routeJob, typicalPriceUsd, walkOrder, ROUTED_TIERS };
