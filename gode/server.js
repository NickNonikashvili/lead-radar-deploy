// Gode server: config -> database -> seed -> services -> HTTP.
//
//   node server.js            (npm start; npm run dev for mock mode with test credit)
//
// start(env) is exported for tests: it boots the whole app on config.port (PORT=0 picks a free
// port) and resolves to { url, server, app, deps, close }. Running this file directly also loads
// .env, starts listening and shuts down cleanly on SIGINT/SIGTERM.
const http = require("http");
const { loadConfig } = require("./src/config");
const { openDb } = require("./src/db");
const { loadMasterKey, createKeyring } = require("./src/crypto");
const { seedCatalog } = require("./src/seed/catalog");
const { createRedactor } = require("./src/redact");
const { createProviders, GATEWAYS } = require("./src/providers");
const { createClassifier } = require("./src/router/classify");
const { createPicker } = require("./src/router/pick");
const { createCredits } = require("./src/billing/credits");
const { createStripe } = require("./src/billing/stripe");
const { createAuth } = require("./src/auth");
const { createApp } = require("./src/app");

// How long a shutdown waits for running answers to stop and connections to close.
const STREAM_DRAIN_MS = 5_000;
const CLOSE_TIMEOUT_MS = 10_000;

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

    const keyring = createKeyring(loadMasterKey(config));
    const redactor = createRedactor(config);
    const providers = createProviders(config);
    const classifier = createClassifier({ config, db, providers, redactor });
    const picker = createPicker({ db, config, providers });
    const credits = createCredits(db, config);
    // Crash safety: holds left by a process that died mid-answer go back to their owners.
    const released = credits.releaseStaleHolds();
    if (released) log.log(`[gode] released ${released} stale credit hold(s)`);
    const stripe = createStripe(config, credits, db);
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

    let closing = null;
    /** Stop taking requests, end running answers, wait for connections, then close the database. */
    function close() {
      if (closing) return closing;
      closing = (async () => {
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

    return { url, server, app, deps, config, close };
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

module.exports = { start, configuredGateways };
