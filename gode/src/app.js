// The Express app: security headers, the Stripe webhook (raw body), JSON parsing, sessions, the
// CSRF origin check, the /api routers, the static frontend and one JSON error handler.
//
// Order matters:
//   1. securityHeaders          every response, static files included
//   2. POST /api/billing/webhook express.raw: Stripe's signature covers the exact bytes, so this
//                               runs before express.json and outside the origin check
//   3. express.json (256 KB)
//   4. auth.middleware()        req.user from the session cookie
//   5. requireSameOrigin        state-changing /api requests must come from our own pages
//   6. Cache-Control: no-store  API answers are per-user and never cached
//
// Logging: method, path, status, error codes and stack frames only. Never bodies, prompts,
// answers, emails or tokens.
const path = require("path");
const express = require("express");
const { securityHeaders, rateLimit } = require("./auth");
const { AppError } = require("./util");
const { createStreamTracker, DEFAULT_PING_MS } = require("./routes/sse");
const { createAuthRoutes } = require("./routes/auth");
const { createMeRoutes } = require("./routes/me");
const { createConversationRoutes } = require("./routes/conversations");
const { createChatRoutes } = require("./routes/chat");
const { createModelRoutes } = require("./routes/models");
const { createBillingRoutes, createWebhookHandler } = require("./routes/billing");
const { createAdminRoutes } = require("./routes/admin");
const { createPublicRoutes } = require("./routes/public");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
const MINUTE = 60 * 1000;

// Defaults per limiter; createApp's `rateLimits` option overrides them (tests).
const RATE_LIMITS = {
  // Sign-up and log-in, per client IP (needs 'trust proxy' behind a reverse proxy).
  auth: { windowMs: 15 * MINUTE, max: 20 },
  // Sign-up and log-in, per lower-cased email: stops password guessing spread over many IPs.
  authEmail: { windowMs: 15 * MINUTE, max: 10 },
  // Chat, regenerate and switch, per user.
  chat: { windowMs: MINUTE, max: 30 },
  // Password confirmation for "delete everything", per user.
  password: { windowMs: 15 * MINUTE, max: 10 },
};

const REQUIRED_DEPS = ["db", "config", "keyring", "redactor", "providers", "classifier", "picker", "credits", "stripe", "auth", "pipeline"];

/** Stack frames without the first line: an error message can quote content (JSON.parse does). */
function stackFrames(err) {
  const stack = typeof err?.stack === "string" ? err.stack.split("\n").slice(1).join("\n") : "";
  return stack || "(no stack)";
}

function errorLabel(err) {
  const name = (err && (err.name || err.constructor?.name)) || typeof err;
  return err && typeof err.code === "string" ? `${name} [${err.code}]` : name;
}

/** Path without the query string: queries are ids and flags today, but keep logs content-free. */
function pathOf(req) {
  return String(req.originalUrl || req.url || "").split("?")[0].slice(0, 300);
}

/**
 * express.json / express.raw / express.static report bad input with http-errors (expose = true,
 * status 4xx). Map those to our error shape with fixed messages: body-parser's own messages can
 * quote the request body.
 */
function clientError(err) {
  const status = Number(err?.status || err?.statusCode);
  if (!Number.isInteger(status) || status < 400 || status > 499) return null;
  if (err.type === "entity.parse.failed") return new AppError(400, "bad_request", "Request body is not valid JSON.");
  if (err.type === "entity.too.large") return new AppError(413, "bad_request", "Request body is too large.");
  if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") return new AppError(415, "bad_request", "Unsupported request encoding.");
  // Express fails to decode a malformed %-escape in a route parameter with a bare 400.
  if (err.expose || err instanceof URIError || status === 400) return new AppError(status, status === 404 ? "not_found" : "bad_request", "Bad request.");
  return null;
}

/**
 * @param {object} deps
 * @param {object} deps.db, deps.config, deps.keyring, deps.redactor, deps.providers, deps.classifier,
 *   deps.picker, deps.credits, deps.stripe, deps.auth, deps.pipeline   (see docs/ARCHITECTURE.md)
 * @param {object} [deps.rateLimits]  per-limiter overrides, e.g. { chat: { max: 2 } } (tests)
 * @param {number} [deps.ssePingMs]   keepalive interval for event streams (default 15 s)
 * @param {{ error: Function, warn: Function }} [deps.logger]  default console
 * @returns {import('express').Express}  with app.locals.shutdown(): abort live streams, stop timers
 */
function createApp(deps = {}) {
  const missing = REQUIRED_DEPS.filter((k) => !deps[k]);
  if (missing.length) throw new TypeError(`createApp: missing ${missing.join(", ")}`);
  const { config, auth } = deps;
  const logger = deps.logger || console;

  const limiters = {};
  for (const [name, dflt] of Object.entries(RATE_LIMITS)) {
    const opts = { ...dflt, ...(deps.rateLimits?.[name] || {}) };
    if (name === "authEmail") {
      opts.key = (req) => {
        const email = req.body?.email;
        return typeof email === "string" && email.trim() ? `email:${email.trim().toLowerCase().slice(0, 320)}` : null;
      };
    } else if (name === "chat" || name === "password") {
      opts.key = (req) => (req.user ? `user:${req.user.id}` : null);
    }
    limiters[name] = rateLimit(opts);
  }

  const streams = createStreamTracker();
  const logError = (req, err) => {
    logger.error(`[api] ${req.method} ${pathOf(req)} failed: ${errorLabel(err)}\n${stackFrames(err)}`);
  };
  // What every router receives: the dependency graph plus app-level helpers.
  const ctx = { ...deps, logger, limiters, streams, logError, ssePingMs: deps.ssePingMs || DEFAULT_PING_MS };

  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false); // API answers are no-store; static files keep their own ETags
  // Hop count 1 trusts only the reverse proxy in front of us. Never `true`: that believes every
  // X-Forwarded-For hop, so a client could pick its own IP and dodge the rate limits.
  app.set("trust proxy", config.trustProxy ? 1 : false);
  app.locals.config = config;

  // 1. Security headers.
  app.use(securityHeaders(config));

  // 2. Stripe webhook: raw body, no JSON parser, no origin check, no session.
  app.post("/api/billing/webhook", express.raw({ type: "*/*", limit: "1mb" }), createWebhookHandler(ctx));

  // 3-6.
  app.use(express.json({ limit: "256kb" }));
  app.use(auth.middleware());
  app.use("/api", auth.requireSameOrigin);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Routers. Each one is mounted at /api and declares its full sub-paths.
  app.use("/api", createPublicRoutes(ctx));
  app.use("/api", createAuthRoutes(ctx));
  app.use("/api", createMeRoutes(ctx));
  app.use("/api", createConversationRoutes(ctx));
  app.use("/api", createChatRoutes(ctx));
  app.use("/api", createModelRoutes(ctx));
  app.use("/api", createBillingRoutes(ctx));
  app.use("/api", createAdminRoutes(ctx));

  // Unknown API paths are JSON 404s, never the SPA page.
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found", code: "not_found" }));

  // Static frontend. express.static sets the MIME types (.js -> application/javascript, which
  // matters under X-Content-Type-Options: nosniff). HTML is revalidated on every load so a deploy
  // is picked up at once.
  app.use(
    express.static(PUBLIC_DIR, {
      index: "index.html",
      setHeaders(res, file) {
        if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    })
  );

  // SPA fallback: page-like GETs that want HTML get the app shell. Paths that look like files
  // (an extension in the last segment) are real 404s, so a missing asset is not answered with HTML.
  app.get("*", (req, res, next) => {
    if (/\.[A-Za-z0-9]{1,8}$/.test(req.path) || !req.accepts("html")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(INDEX_HTML);
  });

  // Our own 404 (express's default page carries its own restrictive CSP and HTML).
  app.use((req, res) => res.status(404).json({ error: "Not found", code: "not_found" }));

  // One error handler for everything: AppError -> its status and { error, code, ...extra }.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const known = err instanceof AppError ? err : clientError(err);
    if (!known || known.status >= 500) {
      if (known) logger.error(`[api] ${req.method} ${pathOf(req)} -> ${known.status} ${known.code}`);
      else logError(req, err);
    }
    if (res.headersSent) {
      // Mid-stream (an event stream or a file): the status is gone, all we can do is stop.
      if (!res.writableEnded) res.end();
      return;
    }
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    if (!known) return res.status(500).json({ error: "Internal error", code: "internal" });
    const extra = known.extra && typeof known.extra === "object" ? known.extra : {};
    const { error: _e, code: _c, ...rest } = extra;
    res.status(known.status).json({ error: known.message, code: known.code, ...rest });
  });

  /** Graceful shutdown: abort running streams (pipelines release their holds), stop the limiters. */
  app.locals.shutdown = async ({ timeoutMs = 5000 } = {}) => {
    await streams.drain({ timeoutMs });
    for (const limiter of Object.values(limiters)) limiter.stop();
  };
  app.locals.activeStreams = () => streams.size;

  return app;
}

module.exports = { createApp, RATE_LIMITS, PUBLIC_DIR };
