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

/** Presidio entity names ("PERSON", "PHONE_NUMBER"): upper-cased, deduplicated, junk dropped. */
function entityList(v) {
  const names = list(v)
    .map((s) => s.toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9_]{0,63}$/.test(s));
  return [...new Set(names)];
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
    // ":memory:" is SQLite's in-memory database, not a file name: keep it as is.
    databasePath:
      str(env.DATABASE_PATH) === ":memory:" ? ":memory:" : path.resolve(rootDir, str(env.DATABASE_PATH, path.join(dataDir, "gode.db"))),
    publicUrl: str(env.PUBLIC_URL, `http://localhost:${num(env.PORT, 3000)}`).replace(/\/+$/, ""),
    masterKey: str(env.GODE_MASTER_KEY), // base64, 32 bytes. Auto-generated into dataDir in dev if empty.
    mock,
    trustProxy: bool(env.TRUST_PROXY, production),
    cookieSecure: bool(env.COOKIE_SECURE, production),
    sessionDays: num(env.SESSION_DAYS, 30),
    adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
    // "First account becomes admin" bootstrap. Only used when ADMIN_EMAILS is empty; off in
    // production unless explicitly enabled (use `node scripts/make-admin.js <email>` instead).
    firstUserAdmin: bool(env.FIRST_USER_ADMIN, !production),
    // With ADMIN_EMAILS set: does a listed address become admin by itself when it signs up? Emails
    // are not verified, so anyone could register a listed address first. Off in production: an
    // operator confirms each listed account once with `node scripts/make-admin.js <email>`. Removing
    // an address from ADMIN_EMAILS still revokes admin at once either way.
    adminEmailsAutoGrant: bool(env.ADMIN_EMAILS_AUTO_GRANT, !production),

    gateways: {
      openrouter: {
        apiKey: keys.openrouter,
        baseUrl: str(env.OPENROUTER_BASE_URL, "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
      },
      openai: {
        apiKey: keys.openai,
        baseUrl: str(env.OPENAI_BASE_URL, "https://api.openai.com/v1").replace(/\/+$/, ""),
        // Set only when OpenAI has approved zero data retention for this API key/project. Without
        // it, no direct-OpenAI model may be flagged zdr in the catalog.
        zdrApproved: bool(env.OPENAI_ZDR_APPROVED, false),
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
        // After a connection failure, treat the self-hosted server as down for this long so private
        // requests use the PRIVATE_FALLBACK policy instead of failing one after another.
        retryMs: num(env.SELFHOSTED_RETRY_MS, 30_000),
      },
      // Text streams: give up when the first byte, or the next byte mid-stream, takes longer than this.
      timeouts: {
        firstByteMs: num(env.TEXT_FIRST_BYTE_TIMEOUT_MS, 120_000),
        idleMs: num(env.TEXT_IDLE_TIMEOUT_MS, 90_000),
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
      // Which Presidio recognizers to ask for (sent as `entities` to /analyze). Empty = the
      // analyzer's default set. Built-in recognizers run either way.
      presidioEntities: entityList(env.PRESIDIO_ENTITIES),
      // Redact prompts going to the self-hosted tier too? They never leave your servers, so off by default.
      redactSelfHosted: bool(env.REDACT_SELF_HOSTED, false),
      // When PRESIDIO_ANALYZER_URL is set and the analyzer is unreachable:
      //   "closed" -> refuse to send the request (default: redaction is a promise, not best effort)
      //   "open"   -> continue with the built-in recognizers only
      presidioFailMode: str(env.PRESIDIO_FAIL_MODE, "closed") === "open" ? "open" : "closed",
      // Serve generated media through Gode (/api/media/...) so media hosts never see users' IPs.
      mediaProxy: bool(env.MEDIA_PROXY, true),
      // Hosts (and their subdomains) the media proxy may fetch from.
      mediaProxyHosts: list(env.MEDIA_PROXY_HOSTS || "fal.media").map((h) => h.toLowerCase()),
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
      // Max signup bonuses granted per UTC day across all accounts (0 = no cap).
      signupBonusDailyCap: num(env.SIGNUP_BONUS_DAILY_CAP, 200),
      // A text request is refused when the balance can't pay for at least this many output tokens.
      minAffordableOutputTokens: num(env.MIN_AFFORDABLE_OUTPUT_TOKENS, 256),
      // Holds older than this are released by the periodic sweep (must outlast the longest request).
      staleHoldMinutes: Math.max(num(env.STALE_HOLD_MINUTES, 30), Math.ceil(num(env.FAL_TIMEOUT_MS, 600_000) / 60_000) + 5),
    },

    learn: {
      minSamples: num(env.LEARN_MIN_SAMPLES, 20),
      windowDays: num(env.LEARN_WINDOW_DAYS, 28),
      // In-process weekly learner run: "off" | "weekly". Proposals are stored for the admin page and
      // applied automatically only when LEARN_AUTO_APPLY is on.
      schedule: str(env.LEARN_SCHEDULE, "off") === "weekly" ? "weekly" : "off",
      autoApply: bool(env.LEARN_AUTO_APPLY, false),
    },
  };

  config.stripeEnabled = Boolean(config.billing.stripeSecretKey);
  return Object.freeze(config);
}

module.exports = { loadConfig };
