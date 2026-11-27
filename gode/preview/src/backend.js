"use strict";
// The simulated Gode server: the same dependency graph server.js builds (catalog seed and repair,
// redactor, providers, classifier, picker, credits, auth, chat pipeline, routers), on the
// in-memory database of ./sqlite.js and the preview's own gateways (./providers.js).
//
// Real modules (bundled unchanged from src/): config defaults (via the build fixture), the model
// catalog and routing table, the redactor with its built-in recognizers, the classifier, the
// picker, credits (holds, settle, ledger), auth (sessions, password rules, signup bonus, delete
// everything), the learner and gate metrics, the chat pipeline, the SSE framing, and the route
// handlers of /api/auth, /api/me, /api/transparency, /api/conversations, /api/chat,
// /api/messages, /api/models, /api/public/providers, /api/billing and /api/admin. Preview-only:
// the gateways and their answers, the Stripe stand-in, the HTTP plumbing, the database stand-in,
// storage, and the demo data (./seed.js, ./seed-team.js).

const { sleep, AppError } = require("../../src/util");
const { seedCatalog, repairCatalog, getModel } = require("../../src/seed/catalog");
const { createRedactor } = require("../../src/redact");
const { createClassifier } = require("../../src/router/classify");
const { createPicker } = require("../../src/router/pick");
const { createCredits } = require("../../src/billing/credits");
const { createAuth } = require("../../src/auth");
const { createPipeline } = require("../../src/chat/pipeline");
const { createStreamTracker, DEFAULT_PING_MS } = require("../../src/routes/sse");
const { createAuthRoutes } = require("../../src/routes/auth");
const { createMeRoutes } = require("../../src/routes/me");
const { createConversationRoutes } = require("../../src/routes/conversations");
const { createChatRoutes } = require("../../src/routes/chat");
const { createModelRoutes } = require("../../src/routes/models");
const { createPublicRoutes } = require("../../src/routes/public");
const { createBillingRoutes } = require("../../src/routes/billing");
const { createAdminRoutes } = require("../../src/routes/admin");
const { createKeyring } = require("../../src/crypto");

const { createDatabase } = require("./sqlite");
const { STATEMENTS } = require("./statements");
const { createPreviewProviders, UPSTREAM_PROVIDER } = require("./providers");
const { createApp, createCookieJar } = require("./http");
const { createStorage } = require("./storage");
const { seedDemo, restoreDemo } = require("./seed");
const { createDemoRoutes } = require("./demo-routes");
const { seedTeam } = require("./seed-team");

const STATE_VERSION = 1;

/** Limiter stand-ins: the preview never rate-limits (one person, one browser). */
function noLimit() {
  const mw = (req, res, next) => next();
  mw.peek = () => 0;
  mw.hit = () => {};
  mw.undo = () => {};
  mw.clear = () => {};
  mw.stop = () => {};
  return mw;
}

// What POST /api/billing/checkout answers in the preview (the real route, with this stub's
// createCheckout): the same 503 gateway_not_configured a server without Stripe keys sends, with a
// message that says what to do instead. Nothing navigates anywhere.
const CHECKOUT_OFF_MESSAGE = "Payments are off in this preview, so no card can be charged. Use Developer top-up below to add free test credit.";

/**
 * The Stripe dependency (src/billing/stripe.js needs Node and a Stripe account). `enabled` is what
 * /api/me reports as stripe_enabled: true, so the Billing page shows its credit packs as on a live
 * server, and choosing one gets the preview's clear "payments are off" answer from the real
 * checkout route. There is no webhook and nothing to verify.
 */
function createPreviewStripe() {
  return {
    enabled: true,
    async createCheckout() {
      throw new AppError(503, "gateway_not_configured", CHECKOUT_OFF_MESSAGE);
    },
    verifyWebhook() {
      throw new AppError(503, "gateway_not_configured", CHECKOUT_OFF_MESSAGE);
    },
    handleEvent() {
      throw new AppError(503, "gateway_not_configured", CHECKOUT_OFF_MESSAGE);
    },
  };
}

/**
 * @param {object} opts
 * @param {object} opts.fixture         build fixture: { config, deployment }
 * @param {object} [opts.window]        where localStorage lives (default globalThis.window)
 * @param {boolean} [opts.persist]      keep state in localStorage when available (default true)
 * @param {"live"|"instant"} [opts.timing]  "instant": no pauses (tests, seeding)
 * @param {{ log, warn, error, debug }} [opts.logger]
 * @param {Array} [opts.statements]     extra SQL statement handlers (later builds)
 * @param {(ctx) => Array} [opts.extraRouters]  more routers, mounted after the built-in ones
 */
function createBackend({ fixture, window: win, persist = true, timing = "live", logger, statements = [], extraRouters } = {}) {
  if (!fixture || !fixture.config) throw new TypeError("createBackend: fixture.config is required");
  const config = fixture.config;
  const deployment = fixture.deployment || {};
  const log = logger || makeLogger();

  // ---- pacing ---------------------------------------------------------------------------------
  const pace = {
    instant: timing === "instant",
    sleep(ms, signal) {
      if (signal && signal.aborted) return Promise.reject(signal.reason !== undefined ? signal.reason : new DOMException("This operation was aborted", "AbortError"));
      return pace.instant ? Promise.resolve() : sleep(ms, signal);
    },
    rand(min, max) {
      return Math.round(min + Math.random() * (max - min));
    },
  };

  // ---- storage + database ---------------------------------------------------------------------
  const storage = createStorage({ key: deployment.storageKey || "gode-preview:v1", window: persist ? win : null });
  let jar = null;
  const db = createDatabase({ statements: [...STATEMENTS, ...statements], onCommit: () => scheduleSave() });
  const calledUpstream = new Set(); // request ids the simulated gateways got
  markSimulatedUpstream(db, calledUpstream);
  const snapshot = () => ({ v: STATE_VERSION, saved_at: Date.now(), db: db.dump(), cookies: jar ? jar.snapshot() : {} });
  function scheduleSave() {
    storage.schedule(snapshot);
  }

  const stored = storage.load();
  const restored = Boolean(stored && stored.v === STATE_VERSION && stored.db);
  if (restored) {
    try {
      db.load(stored.db);
    } catch (e) {
      log.warn("[preview] stored state unreadable; starting fresh", e);
      db.reset();
    }
  }
  jar = createCookieJar(restored ? stored.cookies : {}, () => scheduleSave());

  // ---- services (server.js order) --------------------------------------------------------------
  const seeded = seedCatalog(db);
  repairCatalog(db, { openaiZdrApproved: Boolean(config.gateways && config.gateways.openai && config.gateways.openai.zdrApproved) });
  const keyring = createKeyring();
  const redactor = createRedactor(config, { logger: log });

  const contexts = new WeakMap(); // pipeline signal -> { route, user, mode, ... }
  const providers = createPreviewProviders({
    gateways: deployment.gateways || { openrouter: true, openai: true, fal: true, selfhosted: false },
    pace,
    contextOf: (signal) => (signal ? contexts.get(signal) : undefined),
    margin: config.billing.margin,
    onCall(signal) {
      const turn = signal ? contexts.get(signal) : null;
      if (turn && turn.route && turn.route.request_id) calledUpstream.add(turn.route.request_id);
    },
  });
  const realClassifier = createClassifier({ config, db, providers, redactor, logger: log });
  // The classifier call takes a moment in the live app (a small model, or Gode's own rules). What
  // it did is kept for the answer's explanation (preview/src/answers.js): its cost, which the
  // pipeline adds to the bill, and why Gode's own rules classified the message when they did.
  const classifier = {
    resolveModel: realClassifier.resolveModel,
    async classify(args) {
      await pace.sleep(pace.rand(320, 620), args && args.signal);
      const result = await realClassifier.classify(args);
      const turn = args && args.signal ? contexts.get(args.signal) : null;
      if (turn) turn.classifier = classifierFacts(args, result);
      return result;
    },
  };

  /** { costMicros, label, reason, filters }: see classifierLine in answers.js. */
  function classifierFacts(args, result) {
    const usage = (result && result.usage) || {};
    const used = result && result.classifierModel && result.classifierModel !== "heuristic" ? getModel(db, result.classifierModel) : null;
    // job: what the classifier asked for, before a hand-picked text model turns it into chat
    // (pipeline manualJob), so the answer can say why no picture was made.
    const facts = { costMicros: Number(usage.costMicros) || 0, label: used ? used.label : null, reason: null, filters: [], job: (result && result.job) || null };
    if (used) return facts;
    const usual = realClassifier.resolveModel({});
    facts.label = usual ? usual.label : null;
    if (args.conversationPrivate) facts.reason = "private_chat";
    else if (result && result.private) facts.reason = "private";
    else if ((args.zdrOnly || args.euOnly) && !realClassifier.resolveModel({ zdrOnly: Boolean(args.zdrOnly), euOnly: Boolean(args.euOnly) })) {
      facts.reason = "filters";
      if (args.zdrOnly && !realClassifier.resolveModel({ zdrOnly: true })) facts.filters.push("Strict privacy");
      if (args.euOnly && !realClassifier.resolveModel({ euOnly: true })) facts.filters.push("EU-only");
      if (!facts.filters.length) facts.filters.push("Strict privacy", "EU-only");
    } else facts.reason = "fallback";
    return facts;
  }
  const picker = createPicker({ db, config, providers });
  const credits = createCredits(db, config, { logger: log });
  const stripe = createPreviewStripe();
  const auth = createAuth({ db, config, keyring, credits, logger: log });
  const realPipeline = createPipeline({ db, config, keyring, redactor, classifier, picker, providers, credits, logger: log });

  // What the answer composer needs about a turn: the routing decision (the route event), who asked,
  // how (auto/manual/regenerate/switch), and whether the chat was already private.
  const convPrivate = db.prepare("SELECT id, user_id, title_enc, pins, pii_map_enc, private FROM conversations WHERE id = ?");
  const routeCell = db.prepare("SELECT model_id, effort_override FROM routes WHERE job = ? AND tier = ?");
  /** The routing table's model for a cell, as the picker reads it: { id, label } or null. */
  function routedModel(job, tier) {
    const row = routeCell.get(job, tier);
    const model = row && row.model_id ? getModel(db, row.model_id) : null;
    return model ? { id: model.id, label: model.label, effort_override: row.effort_override || null } : null;
  }
  const pipeline = {
    activeHoldIds: realPipeline.activeHoldIds,
    run(args) {
      const ctx = {
        route: null,
        user: args.user,
        mode: args.mode,
        conversationWasPrivate: false,
        pinSource: null,
        classifier: null,
        routedModel,
        priceFor: credits.priceFor,
      };
      if (args.conversationId) {
        const row = convPrivate.get(args.conversationId);
        ctx.conversationWasPrivate = Boolean(row && row.private);
        try {
          const pins = row ? JSON.parse(row.pins || "{}") : {};
          ctx.pins = pins;
        } catch {
          ctx.pins = {};
        }
      }
      if (args.signal) contexts.set(args.signal, ctx);
      const emit = (event, data) => {
        if (event === "route") {
          ctx.route = data;
          const job = data.job === "action" ? "chat" : data.job;
          const pin = ctx.pins && ctx.pins[job];
          ctx.pinSource = pin && pin.model_id === (data.model && data.model.id) ? pin.source : null;
        }
        // A media answer's caption is stored as its text (the pipeline keeps the first 500
        // characters), but the live stream has no event for it: send it as a `replace` (part of
        // the SSE contract: "replace the text so far") right before `done`, so the live answer
        // looks like the stored one. Preview-only: real media models return no caption here.
        if (event === "done" && typeof ctx.caption === "string" && !ctx.captionSent) {
          ctx.captionSent = true;
          const text = ctx.caption.trim().slice(0, 500);
          if (text) args.emit("replace", { text });
        }
        return args.emit(event, data);
      };
      return realPipeline.run({ ...args, emit });
    },
  };

  // Crash safety, as at server boot: no answer is running, so every stored hold is stale.
  credits.releaseStaleHolds(0);

  const limiters = Object.fromEntries(["auth", "authEmail", "authEmailGlobal", "authEmailGroup", "authEmailGroups", "signup", "chat", "password", "checkout"].map((n) => [n, noLimit()]));
  // The real tracker, plus the running answers' settle promises: leave() waits for them.
  const realStreams = createStreamTracker();
  const running = new Set();
  const streams = {
    track(stream, emit, done) {
      running.add(done);
      done.finally(() => running.delete(done)).catch(() => {});
      return realStreams.track(stream, emit, done);
    },
    get size() {
      return realStreams.size;
    },
    drain: (opts) => realStreams.drain(opts),
  };
  const ctx = {
    db,
    config,
    keyring,
    redactor,
    providers,
    classifier,
    picker,
    credits,
    stripe,
    auth,
    pipeline,
    logger: log,
    limiters,
    streams,
    ssePingMs: DEFAULT_PING_MS,
    logError: (req, err) => log.error(`[api] ${req.method} ${req.path} failed`, err),
    deployment,
    pace,
  };

  // src/app.js order. The media proxy (src/routes/media.js) is not mounted: it streams files from a
  // media CDN with Node streams, and the preview's media are data: URLs that never go through it.
  // The demo account comes back when someone signs in with its credentials after Delete
  // everything removed it (preview-only; ./demo-routes.js). Mounted before the real auth routes,
  // which then sign the viewer in as usual. The seed's own requests skip it (seedRouters).
  let restoring = null;
  const demoCreds = (deployment && deployment.demo) || { email: "demo@example.com", password: "preview-demo" };
  const demoMissing = () => !db.rows("users").some((u) => u.email === demoCreds.email);
  const demoRoutes = createDemoRoutes({
    demo: demoCreds,
    missing: demoMissing,
    restoring: () => Boolean(restoring),
    restore() {
      if (!restoring) {
        const wasInstant = pace.instant;
        pace.instant = true;
        restoring = restoreDemo({ db, app: seedApp, credits, keyring, deployment, config })
          .finally(() => {
            pace.instant = wasInstant;
            restoring = null;
            scheduleSave();
            storage.flush();
          });
      }
      return restoring;
    },
  });
  const coreRouters = [
    createPublicRoutes(ctx),
    createAuthRoutes(ctx),
    createMeRoutes(ctx),
    createConversationRoutes(ctx),
    createChatRoutes(ctx),
    createModelRoutes(ctx),
    createBillingRoutes(ctx),
    createAdminRoutes(ctx),
    ...(typeof extraRouters === "function" ? extraRouters(ctx) : []),
  ];
  const routers = [coreRouters[0], demoRoutes, ...coreRouters.slice(1)];

  let readyPromise = null;
  const sessions = new Set(); // backend.session() apps (tests)
  const app = createApp({
    routers,
    authMiddleware: auth.middleware(),
    jar,
    logger: log,
    ready: () => readyPromise,
    afterResponse: () => scheduleSave(),
    latency: (signal) => pace.sleep(pace.rand(25, 90), signal),
  });

  // First visit (nothing stored): the demo account and its conversations, made through the API
  // itself with no pauses, so they are exactly what the app would have stored. The seed's own
  // requests go through an app instance that does not wait for the seed.
  const seedApp = createApp({ routers: coreRouters, authMiddleware: auth.middleware(), jar, logger: log, afterResponse: () => scheduleSave() });
  // Known now, so a first visit can open the welcome note before the seed has finished.
  const welcomeConversationId = restored ? null : globalThis.crypto.randomUUID();
  readyPromise = (async () => {
    if (restored) return;
    const wasInstant = pace.instant;
    pace.instant = true;
    try {
      await seedDemo({ db, app: seedApp, credits, keyring, deployment, welcomeId: welcomeConversationId });
      await seedTeam({ db, auth, credits, picker, config });
    } finally {
      pace.instant = wasInstant;
    }
    scheduleSave();
    storage.flush();
  })().catch((e) => {
    log.error("[preview] could not create the demo account", e);
  });

  return {
    fetch: app.fetch,
    ready: () => readyPromise,
    db,
    jar,
    ctx,
    storage,
    pace,
    seededCatalog: seeded,
    restored,
    welcomeConversationId,
    /**
     * Another browser on the same simulated server: its own cookie jar (not stored), so tests can
     * be signed in as two people at once. The page itself only ever uses `fetch`.
     */
    session() {
      const own = createCookieJar({}, () => {});
      const other = createApp({ routers, authMiddleware: auth.middleware(), jar: own, logger: log, ready: () => readyPromise, afterResponse: () => scheduleSave() });
      sessions.add(other);
      return { fetch: other.fetch, jar: own };
    },
    /**
     * The page is going away (pagehide): the answers still streaming lose their client, as on a
     * real server when the tab closes, so each is kept as a stopped answer and charged for what it
     * wrote. Their cleanup only waits on promises, never on timers, so it finishes in the
     * microtasks right after the pagehide handler; the state is then saved at once.
     */
    leave() {
      app.disconnectAll();
      for (const other of sessions) other.disconnectAll();
      return Promise.allSettled([...running]).then(() => {
        scheduleSave();
        storage.flush();
      });
    },
    /** Forget everything stored and start again (tests; a console helper in the page). */
    reset() {
      storage.clear();
    },
    logs: log.lines,
  };
}

/**
 * Every request the simulated gateways got is marked so in the transparency log, media and failed
 * or stopped answers too ("fal → preview (simulated)"), like a text answer's meta event makes it
 * "openrouter → preview (simulated)". The live pipeline stores no upstream host when the gateway
 * reports none (fal never does), which here would read as if the picture really went to fal.
 */
function markSimulatedUpstream(db, calledUpstream) {
  const prepare = db.prepare;
  db.prepare = (sql) => {
    const statement = prepare(sql);
    if (!/^\s*INSERT INTO requests\b/i.test(String(sql))) return statement;
    const run = statement.run;
    return {
      ...statement,
      run(params, ...rest) {
        const called = params && typeof params === "object" && calledUpstream.delete(params.$id);
        return run(called && params.$gateway && !params.$upstream_provider ? { ...params, $upstream_provider: UPSTREAM_PROVIDER } : params, ...rest);
      },
    };
  };
}

function makeLogger() {
  const lines = [];
  const keep = (level, args) => {
    const text = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" ");
    lines.push({ level, text, at: Date.now() });
    if (lines.length > 200) lines.shift();
    return text;
  };
  return {
    lines,
    log: (...a) => keep("log", a),
    info: (...a) => keep("info", a),
    debug: (...a) => keep("debug", a),
    // Expected outcomes (a stopped answer, a simulated upstream failure) are warnings in Gode's
    // logs: kept here, not printed, so the browser console stays quiet.
    warn: (...a) => keep("warn", a),
    // A real bug: kept and printed.
    error: (...a) => {
      keep("error", a);
      if (typeof console !== "undefined") console.error("[gode-preview]", ...a);
    },
  };
}

module.exports = { createBackend, makeLogger, STATE_VERSION, CHECKOUT_OFF_MESSAGE };
