// Full Gode app for HTTP tests: the real dependency graph on an in-memory database (or a temp
// file), listening on a free port, plus a tiny fetch client with a cookie jar.
//
//   const { createTestApp } = require("./helpers/app");
//   const t = await createTestApp({ ALLOW_DEV_TOPUP: "1" });
//   const alice = t.client();
//   await alice.json("POST", "/api/auth/signup", { email: "a@example.test", password: "password123" });
//   const { status, body } = await alice.json("GET", "/api/me");
//   const { events } = await alice.sse("/api/chat", { text: "hi" });   // [{ event, data }]
//   await t.close();
//
// env is merged over GODE_MOCK=1 and a random GODE_MASTER_KEY (so no key file is written).
// overrides:
//   pipeline      an object with run(), or a factory (deps) => pipeline. Default: the real
//                 src/chat/pipeline.js (createPipeline on the same dependencies).
//   db | keyring | redactor | providers | classifier | picker | credits | stripe | auth
//                 replace that dependency (later ones are built from the replacement)
//   dbFile        use this SQLite file instead of :memory:
//   seed          false to start with an empty catalog (default: seeded)
//   rateLimits, ssePingMs, logger, mediaFetch   passed to createApp
//   pipelineLogger                  the real pipeline's logger (default: warnings silent)
const crypto = require("crypto");
const http = require("http");

const { loadConfig } = require("../../src/config");
const { openDb } = require("../../src/db");
const { loadMasterKey, createKeyring } = require("../../src/crypto");
const { seedCatalog } = require("../../src/seed/catalog");
const { createRedactor } = require("../../src/redact");
const { createProviders } = require("../../src/providers");
const { createClassifier } = require("../../src/router/classify");
const { createPicker } = require("../../src/router/pick");
const { createCredits } = require("../../src/billing/credits");
const { createStripe } = require("../../src/billing/stripe");
const { createAuth } = require("../../src/auth");
const { createPipeline } = require("../../src/chat/pipeline");
const { createApp } = require("../../src/app");

/** The chat pipeline for this app: a test's stand-in, or the real one on the same dependencies. */
function buildPipeline(override, deps) {
  if (override) return typeof override === "function" ? override(deps) : override;
  // Expected failures (upstream errors, aborts) log warnings: keep those quiet, show real errors.
  return createPipeline({ ...deps, logger: deps.logger || { warn() {}, error: (...a) => console.error(...a) } });
}

// ---------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------

/** Parse a complete SSE text into [{ event, data }] (data JSON-parsed) and the comment lines. */
function parseSse(text) {
  const events = [];
  const comments = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) comments.push(line.slice(1).trim());
      else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) continue;
    const raw = data.join("\n");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    events.push({ event, data: parsed });
  }
  return { events, comments };
}

/**
 * @param {string} baseUrl
 * @param {{ origin?: string|null }} [opts]  Origin header to send (default: baseUrl; null for none)
 */
function createClient(baseUrl, { origin = baseUrl } = {}) {
  const jar = new Map();

  function cookieHeader() {
    return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function storeCookies(res) {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const [pair, ...attrs] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a)) || value === "";
      if (expired) jar.delete(name);
      else jar.set(name, value);
    }
  }

  /** Raw fetch with the jar and the default Origin. body: object (JSON), string or Buffer. */
  async function request(method, urlPath, { body, headers = {}, signal } = {}) {
    const h = { ...headers };
    const has = (name) => Object.keys(h).some((k) => k.toLowerCase() === name);
    if (origin && !has("origin")) h.Origin = origin;
    if (jar.size && !has("cookie")) h.Cookie = cookieHeader();
    let payload = body;
    if (body !== undefined && typeof body !== "string" && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      if (!has("content-type")) h["Content-Type"] = "application/json";
    }
    const res = await fetch(baseUrl + urlPath, { method, headers: h, body: payload, signal, redirect: "manual" });
    storeCookies(res);
    return res;
  }

  /**
   * JSON round trip -> { status, body (parsed JSON or null), text, headers }. A raw string/Buffer
   * body (bad JSON, a signed webhook) can be passed as opts.body with body undefined.
   */
  async function json(method, urlPath, body, opts = {}) {
    const res = await request(method, urlPath, { ...opts, body: body === undefined ? opts.body : body });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, text, headers: res.headers };
  }

  /**
   * POST and collect the event stream until it ends.
   * opts.onEvent({event, data}) runs per event; opts.signal aborts (the result then has aborted: true).
   * -> { status, headers, events, comments, raw, aborted, body (JSON error body when not a stream) }
   */
  async function sse(urlPath, body = {}, { onEvent, signal, headers = {} } = {}) {
    let res;
    try {
      res = await request("POST", urlPath, { body, signal, headers: { Accept: "text/event-stream", ...headers } });
    } catch (err) {
      if (signal?.aborted) return { status: 0, headers: null, events: [], comments: [], raw: "", aborted: true, body: null };
      throw err;
    }
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/event-stream")) {
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {}
      return { status: res.status, headers: res.headers, events: [], comments: [], raw: text, aborted: false, body: parsed };
    }
    const decoder = new TextDecoder();
    let raw = "";
    let seen = 0;
    let aborted = false;
    const emitNew = () => {
      // Hand complete events to onEvent as they arrive (the abort tests react to them).
      const complete = raw.slice(0, raw.lastIndexOf("\n\n") + 2);
      const { events } = parseSse(complete);
      for (; seen < events.length; seen++) onEvent?.(events[seen]);
    };
    try {
      for await (const chunk of res.body) {
        raw += decoder.decode(chunk, { stream: true });
        emitNew();
      }
      raw += decoder.decode();
    } catch (err) {
      if (!signal?.aborted) throw err;
      aborted = true;
    }
    const { events, comments } = parseSse(raw);
    return { status: res.status, headers: res.headers, events, comments, raw, aborted, body: null };
  }

  return {
    request,
    json,
    sse,
    cookies: jar,
    /** Sign up (or log in when the account exists) and return the public user. */
    async signup(email, password = "correct-horse-battery") {
      const r = await json("POST", "/api/auth/signup", { email, password });
      if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${r.text}`);
      return r.body.user;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// createTestApp
// ---------------------------------------------------------------------------------------------

/**
 * @param {Record<string,string>} [env]
 * @param {object} [overrides]  see the header comment
 * @returns {Promise<{ url, close, deps, app, server, config, client: (opts?) => ReturnType<typeof createClient> }>}
 */
async function createTestApp(env = {}, overrides = {}) {
  const config = loadConfig({
    GODE_MOCK: "1",
    GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64"),
    ...env,
  });
  const ownDb = !overrides.db;
  const db = overrides.db || openDb(overrides.dbFile || ":memory:");
  if (overrides.seed !== false) seedCatalog(db);
  const keyring = overrides.keyring || createKeyring(loadMasterKey(config));
  const redactor = overrides.redactor || createRedactor(config, { logger: { warn() {} } });
  const providers = overrides.providers || createProviders(config);
  const classifier = overrides.classifier || createClassifier({ config, db, providers, redactor, logger: { warn() {} } });
  const picker = overrides.picker || createPicker({ db, config, providers });
  const credits = overrides.credits || createCredits(db, config);
  const stripe = overrides.stripe || createStripe(config, credits, db, { log: { warn() {} } });
  const auth = overrides.auth || createAuth({ db, config, keyring, credits });
  const base = { db, config, keyring, redactor, providers, classifier, picker, credits, stripe, auth };
  const pipeline = buildPipeline(overrides.pipeline, { ...base, logger: overrides.pipelineLogger });
  const deps = { ...base, pipeline };

  const app = createApp({ ...deps, rateLimits: overrides.rateLimits, ssePingMs: overrides.ssePingMs, logger: overrides.logger, mediaFetch: overrides.mediaFetch });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await app.locals.shutdown({ timeoutMs: 2000 });
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(() => resolve()));
    if (ownDb) db.close();
  }

  return { url, server, app, deps, config, close, client: (opts) => createClient(url, opts) };
}

module.exports = { createTestApp, createClient, parseSse };
