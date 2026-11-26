// Central configuration. Every env var Gode reads is parsed here and nowhere else.
// Other modules receive the frozen `config` object (or call loadConfig(overrides) in tests).
const path = require("path");

function bool(v, dflt = false) {
  if (v === undefined || v === null || v === "") return dflt;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function num(v, dflt) {
  if (v === undefined || v === null || v === "") return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function str(v, dflt = "") {
  return v === undefined || v === null || v === "" ? dflt : String(v);
}

function list(v) {
  return str(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build a config object from an env-like map. Tests pass their own map so nothing leaks between them.
 * @param {Record<string,string|undefined>} env
 */
function loadConfig(env = process.env) {
  const production = str(env.NODE_ENV) === "production";
  const rootDir = path.resolve(__dirname, "..");
  const dataDir = path.resolve(rootDir, str(env.DATA_DIR, "data"));

  const keys = {
    openrouter: str(env.OPENROUTER_API_KEY),
    openai: str(env.OPENAI_API_KEY),
    fal: str(env.FAL_KEY),
    selfhosted: str(env.SELFHOSTED_API_KEY),
    stripe: str(env.STRIPE_SECRET_KEY),
    stripeWebhook: str(env.STRIPE_WEBHOOK_SECRET),
  };

  const selfhostedBaseUrl = str(env.SELFHOSTED_BASE_URL);
  // Mock mode: every gateway is served by the built-in mock provider. On automatically in
  // development when no real gateway key is configured, so `npm run dev` works out of the box.
  const anyGateway = Boolean(keys.openrouter || keys.openai || keys.fal || selfhostedBaseUrl);
  const mock = env.GODE_MOCK !== undefined && env.GODE_MOCK !== "" ? bool(env.GODE_MOCK) : !production && !anyGateway;

  const packs = list(env.CREDIT_PACKS || "5,10,25")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const config = {
    production,
    port: num(env.PORT, 3000),
    rootDir,
    dataDir,
    databasePath: path.resolve(rootDir, str(env.DATABASE_PATH, path.join(dataDir, "gode.db"))),
    publicUrl: str(env.PUBLIC_URL, `http://localhost:${num(env.PORT, 3000)}`).replace(/\/+$/, ""),
    masterKey: str(env.GODE_MASTER_KEY), // base64, 32 bytes. Auto-generated into dataDir in dev if empty.
    mock,
    trustProxy: bool(env.TRUST_PROXY, production),
    cookieSecure: bool(env.COOKIE_SECURE, production),
    sessionDays: num(env.SESSION_DAYS, 30),
    adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),

    gateways: {
      openrouter: {
        apiKey: keys.openrouter,
        baseUrl: str(env.OPENROUTER_BASE_URL, "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
      },
      openai: {
        apiKey: keys.openai,
        baseUrl: str(env.OPENAI_BASE_URL, "https://api.openai.com/v1").replace(/\/+$/, ""),
      },
      fal: {
        apiKey: keys.fal,
        queueBaseUrl: str(env.FAL_QUEUE_BASE_URL, "https://queue.fal.run").replace(/\/+$/, ""),
        pollIntervalMs: num(env.FAL_POLL_INTERVAL_MS, 1500),
        timeoutMs: num(env.FAL_TIMEOUT_MS, 10 * 60 * 1000),
      },
      selfhosted: {
        apiKey: keys.selfhosted,
        baseUrl: selfhostedBaseUrl.replace(/\/+$/, ""),
      },
    },

    router: {
      // models.id of the small model that classifies each request. Falls back to the heuristic classifier.
      classifierModelId: str(env.CLASSIFIER_MODEL_ID, ""),
      // What to do with a private request when no self-hosted model is available:
      //   "zdr"   -> use a zero-data-retention model, after redaction (phase 1 default)
      //   "block" -> refuse the request
      privateFallback: str(env.PRIVATE_FALLBACK, "zdr") === "block" ? "block" : "zdr",
      maxOutputTokens: num(env.MAX_OUTPUT_TOKENS, 4096),
      historyMessages: num(env.HISTORY_MESSAGES, 30),
    },

    privacy: {
      redaction: str(env.REDACTION, "on") !== "off",
      responseFilter: str(env.RESPONSE_FILTER, "on") !== "off",
      presidioUrl: str(env.PRESIDIO_ANALYZER_URL).replace(/\/+$/, ""),
      presidioScoreThreshold: num(env.PRESIDIO_SCORE_THRESHOLD, 0.5),
      presidioLanguage: str(env.PRESIDIO_LANGUAGE, "en"),
      // Redact prompts going to the self-hosted tier too? They never leave your servers, so off by default.
      redactSelfHosted: bool(env.REDACT_SELF_HOSTED, false),
    },

    billing: {
      margin: num(env.CREDIT_MARGIN, 0.3), // charged = api_cost * (1 + margin)
      signupCreditUsd: num(env.SIGNUP_CREDIT_USD, 0.25),
      packsUsd: packs.length ? packs : [5, 10, 25],
      currency: str(env.CURRENCY, "usd").toLowerCase(),
      stripeSecretKey: keys.stripe,
      stripeWebhookSecret: keys.stripeWebhook,
      stripeApiBase: str(env.STRIPE_API_BASE, "https://api.stripe.com").replace(/\/+$/, ""),
      allowDevTopup: bool(env.ALLOW_DEV_TOPUP, false) && !production,
    },

    learn: {
      minSamples: num(env.LEARN_MIN_SAMPLES, 20),
      windowDays: num(env.LEARN_WINDOW_DAYS, 28),
    },
  };

  config.stripeEnabled = Boolean(config.billing.stripeSecretKey);
  return Object.freeze(config);
}

module.exports = { loadConfig };
