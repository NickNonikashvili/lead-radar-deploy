// Gode server: config -> database -> seed -> services -> HTTP.
//
//   node server.js            (npm start; npm run dev for mock mode with test credit)
//
// start(env) is exported for tests: it boots the whole app on config.port (PORT=0 picks a free
// port) and resolves to { url, server, app, deps, config, close, learner }. Running this file
// directly also loads .env, starts listening and shuts down cleanly on SIGINT/SIGTERM.
const http = require("http");
const { loadConfig } = require("./src/config");
const { openDb } = require("./src/db");
const { loadMasterKey, createKeyring } = require("./src/crypto");
const { seedCatalog, repairCatalog } = require("./src/seed/catalog");
const { createRedactor } = require("./src/redact");
const { createProviders, GATEWAYS } = require("./src/providers");
const { createClassifier } = require("./src/router/classify");
const { createPicker } = require("./src/router/pick");
const { createCredits } = require("./src/billing/credits");
const { createStripe } = require("./src/billing/stripe");
const { createAuth } = require("./src/auth");
const { createApp } = require("./src/app");
const { startLearnScheduler } = require("./src/router/schedule");

// How long a shutdown waits for running answers to stop and connections to close.
const STREAM_DRAIN_MS = 5_000;
const CLOSE_TIMEOUT_MS = 10_000;
// How often stale credit holds are swept (holds older than STALE_HOLD_MINUTES, never a live one).
const HOLD_SWEEP_MS = 5 * 60 * 1000;
const PRESIDIO_PROBE_MS = 20_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/**
 * Production misconfiguration that would break payments: Stripe sends paying customers back to
 * PUBLIC_URL, so it must be the public https address, not the http://localhost default.
 * Returns an error message, or null when the configuration is fine.
 */
function publicUrlProblem(config, { stripeEnabled }) {
  if (!config.production || !stripeEnabled) return null;
  let u;
  try {
    u = new URL(config.publicUrl);
  } catch {
    return `PUBLIC_URL is not a valid URL ("${String(config.publicUrl).slice(0, 100)}"). Set it to the site's public https address, e.g. https://gode.example.com.`;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) {
    return `PUBLIC_URL must be the site's public https address when Stripe payments are on (got ${u.origin}); Stripe sends customers back there after paying. Set PUBLIC_URL, e.g. https://gode.example.com.`;
  }
  return null;
}

/** Gateways with credentials (or a base URL, for self-hosted), by name. Never the keys. */
function configuredGateways(config) {
  const g = config.gateways;
  const on = { openrouter: g.openrouter.apiKey, openai: g.openai.apiKey, fal: g.fal.apiKey, selfhosted: g.selfhosted.baseUrl };
  return GATEWAYS.filter((name) => Boolean(on[name]));
}

/**
 * Boot Gode.
 * @param {Record<string,string|undefined>} [env]  defaults to process.env
 * @param {{ log?: Console, createPipeline?: Function }} [options]
 *   createPipeline: test seam replacing src/chat/pipeline's factory
 */
async function start(env = process.env, { log = console, createPipeline } = {}) {
  const config = loadConfig(env);
  const db = openDb(config.databasePath);
  try {
    const seeded = seedCatalog(db); // only fills an empty catalog
    if (seeded.seeded) log.log(`[gode] seeded the model catalog (${seeded.models} models, ${seeded.routes} routes)`);
    // Rows saved before the catalog's gateway rules existed (e.g. self_hosted on an OpenRouter model).
    const repaired = repairCatalog(db, { openaiZdrApproved: Boolean(config.gateways.openai.zdrApproved) });
    if (repaired.length) log.log(`[gode] cleared privacy flags the gateway can't enforce on: ${repaired.join(", ")}`);

    const keyring = createKeyring(loadMasterKey(config));
    const redactor = createRedactor(config);
    const providers = createProviders(config);
    const classifier = createClassifier({ config, db, providers, redactor });
    const picker = createPicker({ db, config, providers });
    const warnLog = { warn: (line) => (log.warn || log.log).call(log, line) };
    const credits = createCredits(db, config, { logger: warnLog });
    // Crash safety: one process per database, so at boot no hold belongs to a live request. Every
    // hold left by a process that died mid-answer goes back to its owner, however recent.
    const released = credits.releaseStaleHolds(0);
    if (released) log.log(`[gode] released ${released} stale credit hold(s)`);
    const stripe = createStripe(config, credits, db);
    const urlProblem = publicUrlProblem(config, { stripeEnabled: stripe.enabled });
    if (urlProblem) throw new Error(urlProblem);
    const auth = createAuth({ db, config, keyring, credits });
    const pipelineFactory = createPipeline || require("./src/chat/pipeline").createPipeline;
    const pipeline = pipelineFactory({ db, config, keyring, redactor, classifier, picker, providers, credits });
    const deps = { db, config, keyring, redactor, providers, classifier, picker, credits, stripe, auth, pipeline };
    const app = createApp(deps);

    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, () => {
        server.off("error", reject);
        resolve();
      });
    });
    const url = `http://localhost:${server.address().port}`;
    const gateways = configuredGateways(config);
    log.log(`[gode] ${config.mock ? "mock" : "live"} mode · gateways: ${gateways.length ? gateways.join(", ") : "none"} · ${url}`);

    // Backstop for holds a failed cleanup left behind. Holds of answers still running are skipped,
    // and STALE_HOLD_MINUTES is longer than the longest media job.
    const staleHoldMs = Math.max(1, Number(config.billing.staleHoldMinutes) || 30) * 60 * 1000;
    const sweep = setInterval(() => {
      try {
        const n = credits.releaseStaleHolds(staleHoldMs, { keep: pipeline.activeHoldIds?.() || [] });
        if (n) warnLog.warn(`[gode] released ${n} stale credit hold(s)`);
      } catch (err) {
        warnLog.warn(`[gode] stale-hold sweep failed (${err?.code || err?.name || "error"})`);
      }
    }, HOLD_SWEEP_MS);
    sweep.unref?.();
    // While the Presidio analyzer is down, probe its health so the next prompt uses it as soon as it
    // is back instead of waiting out the redactor's circuit breaker.
    const presidioProbe = setInterval(() => {
      if (redactor.presidioStatus?.().state !== "down") return;
      redactor.presidioHealth?.().catch(() => {});
    }, PRESIDIO_PROBE_MS);
    presidioProbe.unref?.();
    const learner = startLearnScheduler({ db, config, logger: log });

    let closing = null;
    /** Stop taking requests, end running answers, wait for connections, then close the database. */
    function close() {
      if (closing) return closing;
      closing = (async () => {
        clearInterval(sweep);
        clearInterval(presidioProbe);
        learner?.stop?.();
        const serverClosed = new Promise((resolve) => server.close(() => resolve()));
        server.closeIdleConnections?.();
        // Running answers are aborted so their credit holds are released while the DB is open.
        await app.locals.shutdown({ timeoutMs: STREAM_DRAIN_MS });
        server.closeIdleConnections?.();
        let timer;
        const timedOut = new Promise((resolve) => {
          timer = setTimeout(() => resolve("timeout"), CLOSE_TIMEOUT_MS);
          timer.unref?.();
        });
        if ((await Promise.race([serverClosed, timedOut])) === "timeout") server.closeAllConnections?.();
        clearTimeout(timer);
        db.close();
      })();
      return closing;
    }

    // learner: the weekly schedule handle ({ stop, tick }), for tests and status checks.
    return { url, server, app, deps, config, close, learner };
  } catch (err) {
    db.close();
    throw err;
  }
}

if (require.main === module) {
  // Only when run directly: a test that requires this file must not pick up the developer's .env.
  require("dotenv").config({ quiet: true });
  start(process.env)
    .then(({ close }) => {
      let signals = 0;
      const onSignal = (signal) => {
        signals += 1;
        if (signals > 1) process.exit(1); // second Ctrl-C: don't wait any longer
        console.log(`[gode] ${signal}: shutting down`);
        close().then(
          () => process.exit(0),
          (err) => {
            console.error(`[gode] shutdown failed: ${err && err.name}`);
            process.exit(1);
          }
        );
      };
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    })
    .catch((err) => {
      // Boot errors are configuration problems (missing master key, port in use): show the message.
      console.error(`[gode] failed to start: ${err && err.message}`);
      process.exit(1);
    });
}

module.exports = { start, configuredGateways, publicUrlProblem };
