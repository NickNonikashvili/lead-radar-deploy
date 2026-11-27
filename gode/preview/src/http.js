"use strict";
// The preview's HTTP layer: what src/app.js and Node's http module do for Gode, done in the page.
// A fetch() to /api/... becomes an Express-like req/res pair, runs through the real routers (in
// src/app.js's order, with its JSON body limits, no-store header, JSON 404 and error handler),
// and comes back as a real Response: JSON bodies with their status codes, or a streamed
// text/event-stream body for the chat routes.
//
// Streams behave like a real fetch: the Response arrives when the server flushes its headers,
// chunks arrive as the route writes them, and aborting the request's signal errors the body
// reader with an AbortError DOMException while the route sees the connection close (res
// "close"), which is how src/routes/sse.js tells the pipeline the user pressed Stop.
//
// Cookies: Set-Cookie headers from the routes go into a cookie jar (like a browser's) and come
// back as the Cookie request header; they are never exposed on the Response, as in a browser.

const { AppError } = require("../../src/util");

const JSON_LIMIT_BYTES = 256 * 1024;
const encoder = new TextEncoder();

function abortError() {
  return new DOMException("The user aborted a request.", "AbortError");
}

// ---------------------------------------------------------------------------------------------
// Cookie jar
// ---------------------------------------------------------------------------------------------

/** A tiny cookie jar: name -> { value, expires }. `persist(state)` is called on every change. */
function createCookieJar(initial, persist) {
  const jar = new Map(Object.entries((initial && typeof initial === "object" && initial) || {}));
  const now = () => Date.now();

  function header() {
    const parts = [];
    for (const [name, c] of jar) {
      if (c.expires && c.expires <= now()) {
        jar.delete(name);
        continue;
      }
      parts.push(`${name}=${c.value}`);
    }
    return parts.join("; ");
  }

  function store(setCookie) {
    const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    if (!list.length) return;
    for (const line of list) {
      const [pair, ...attrs] = String(line).split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      let expires = null;
      for (const a of attrs) {
        const [k, v] = a.split("=").map((s) => (s || "").trim());
        if (/^max-age$/i.test(k)) expires = now() + Number(v) * 1000;
        else if (/^expires$/i.test(k) && expires === null) {
          const t = Date.parse(v);
          if (Number.isFinite(t)) expires = t;
        }
      }
      if (value === "" || (expires !== null && expires <= now())) jar.delete(name);
      else jar.set(name, { value, expires });
    }
    persist(Object.fromEntries(jar));
  }

  return {
    header,
    store,
    clear() {
      jar.clear();
      persist({});
    },
    snapshot: () => Object.fromEntries(jar),
  };
}

// ---------------------------------------------------------------------------------------------
// Response emulation
// ---------------------------------------------------------------------------------------------

class PreviewResponse {
  constructor({ resolve, reject, signal, onHeaders, onDone }) {
    this.statusCode = 200;
    this._headers = new Map();
    this._resolve = resolve;
    this._reject = reject;
    this._state = "pending"; // pending | streaming | done
    this._listeners = new Map();
    this._controller = null;
    this._onHeaders = onHeaders;
    this._onDone = onDone;
    this.writableEnded = false;
    this.destroyed = false;
    this.locals = {};
    if (signal) {
      const onAbort = () => this._clientAborted();
      if (signal.aborted) queueMicrotask(onAbort);
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  get headersSent() {
    return this._state !== "pending";
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  setHeader(name, value) {
    this._headers.set(String(name).toLowerCase(), value);
    return this;
  }

  getHeader(name) {
    return this._headers.get(String(name).toLowerCase());
  }

  removeHeader(name) {
    this._headers.delete(String(name).toLowerCase());
  }

  hasHeader(name) {
    return this._headers.has(String(name).toLowerCase());
  }

  set(name, value) {
    return this.setHeader(name, value);
  }

  _responseHeaders() {
    const h = new Headers();
    for (const [k, v] of this._headers) {
      if (k === "set-cookie") continue; // browsers never show Set-Cookie to page scripts
      h.set(k, Array.isArray(v) ? v.join(", ") : String(v));
    }
    return h;
  }

  _emit(event) {
    const fns = this._listeners.get(event);
    if (!fns) return;
    for (const fn of [...fns]) {
      try {
        fn();
      } catch (e) {
        // A listener's bug must not break the response; report it like an uncaught error.
        setTimeout(() => {
          throw e;
        });
      }
    }
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return this;
  }

  once(event, fn) {
    const wrapped = () => {
      this.off(event, wrapped);
      fn();
    };
    return this.on(event, wrapped);
  }

  off(event, fn) {
    const fns = this._listeners.get(event);
    if (fns) fns.delete(fn);
    return this;
  }

  removeListener(event, fn) {
    return this.off(event, fn);
  }

  /** Headers go out now; the body streams after (text/event-stream). */
  flushHeaders() {
    if (this._state !== "pending" || this.destroyed) return;
    this._state = "streaming";
    if (this._onHeaders) this._onHeaders(this);
    const self = this;
    const body = new ReadableStream({
      start(controller) {
        self._controller = controller;
      },
      cancel() {
        // The reader gave up (reader.cancel()): the connection is gone.
        self._clientAborted();
      },
    });
    this._resolve(new Response(body, { status: this.statusCode, headers: this._responseHeaders() }));
  }

  write(chunk) {
    if (this.writableEnded || this.destroyed) return false;
    if (this._state === "pending") this.flushHeaders();
    if (!this._controller) return false;
    try {
      this._controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      return true;
    } catch {
      return false;
    }
  }

  end(chunk) {
    if (this.writableEnded) return this;
    if (this._state === "pending") {
      this._state = "done";
      if (this._onHeaders) this._onHeaders(this);
      const nullBody = this.statusCode === 204 || this.statusCode === 304;
      if (!this.destroyed) this._resolve(new Response(nullBody ? null : chunk === undefined ? "" : chunk, { status: this.statusCode, headers: this._responseHeaders() }));
    } else {
      if (chunk !== undefined) this.write(chunk);
      this._state = "done";
      try {
        if (this._controller && !this.destroyed) this._controller.close();
      } catch {
        // already errored by an abort
      }
    }
    this.writableEnded = true;
    if (this._onDone) this._onDone(this);
    // Node emits 'finish' then 'close' after the response ends.
    queueMicrotask(() => {
      this._emit("finish");
      this._emit("close");
    });
    return this;
  }

  json(obj) {
    if (!this.hasHeader("content-type")) this.setHeader("Content-Type", "application/json; charset=utf-8");
    return this.end(JSON.stringify(obj));
  }

  send(body) {
    if (body !== null && typeof body === "object") return this.json(body);
    if (!this.hasHeader("content-type")) this.setHeader("Content-Type", "text/html; charset=utf-8");
    return this.end(body === undefined ? "" : String(body));
  }

  sendStatus(code) {
    this.statusCode = code;
    return this.send(String(code));
  }

  _clientAborted() {
    if (this.writableEnded || this.destroyed) return;
    this.destroyed = true;
    const err = abortError();
    if (this._state === "pending") this._reject(err);
    else if (this._controller) {
      try {
        this._controller.error(err);
      } catch {
        // closed already
      }
    }
    if (this._onDone) this._onDone(this);
    this._emit("close");
  }
}

// ---------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------

function parseQuery(search) {
  const out = {};
  for (const [k, v] of new URLSearchParams(search)) {
    if (Object.prototype.hasOwnProperty.call(out, k)) out[k] = [].concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

function headerMap(headers) {
  const out = {};
  if (!headers) return out;
  const entries = typeof headers.forEach === "function" && !(headers instanceof Array) && typeof headers.entries === "function" ? [...headers.entries()] : Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [k, v] of entries) out[String(k).toLowerCase()] = String(v);
  return out;
}

async function bodyText(body) {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.text();
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
  return String(body);
}

/** express.json(): a JSON body for JSON requests ({} otherwise), with its 400/413 answers. */
function parseJsonBody(req, text) {
  req.body = {};
  if (!text) return;
  const type = req.headers["content-type"] || "";
  if (!/\bjson\b/i.test(type)) return;
  if (encoder.encode(text).length > JSON_LIMIT_BYTES) throw Object.assign(new Error("request entity too large"), { status: 413, type: "entity.too.large", expose: true });
  try {
    req.body = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("invalid json"), { status: 400, type: "entity.parse.failed", expose: true });
  }
}

// ---------------------------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------------------------

/** Same mapping as src/app.js clientError(): body-parser and URI errors, with fixed messages. */
function clientError(err) {
  const status = Number(err && (err.status || err.statusCode));
  if (err instanceof URIError) return new AppError(400, "bad_request", "Bad request.");
  if (!Number.isInteger(status) || status < 400 || status > 499) return null;
  if (err.type === "entity.parse.failed") return new AppError(400, "bad_request", "Request body is not valid JSON.");
  if (err.type === "entity.too.large") return new AppError(413, "bad_request", "Request body is too large.");
  if (err.expose || status === 400) return new AppError(status, status === 404 ? "not_found" : "bad_request", "Bad request.");
  return null;
}

/**
 * @param {object} opts
 * @param {Array<{ handle(req, res, out) }>} opts.routers  mounted at /api, in src/app.js order
 * @param {Function} opts.authMiddleware                   auth.middleware()
 * @param {ReturnType<typeof createCookieJar>} opts.jar
 * @param {{ error: Function, warn: Function }} opts.logger
 * @param {() => Promise<void>} [opts.ready]              requests wait for this first
 * @param {() => void} [opts.afterResponse]                e.g. save state
 * @param {(ms) => Promise<void>} [opts.latency]          network-like delay before a request runs
 */
function createApp({ routers, authMiddleware, jar, logger = console, ready, afterResponse, latency }) {
  // Responses still open (an answer streaming): the page leaving closes them like a browser that
  // goes away closes its connections (disconnectAll).
  const open = new Set();
  function errorHandler(err, req, res) {
    const known = err instanceof AppError ? err : clientError(err);
    if (!known || known.status >= 500) {
      if (known) logger.warn(`[api] ${req.method} ${req.path} -> ${known.status} ${known.code}`);
      else logger.error(`[api] ${req.method} ${req.path} failed: ${(err && err.name) || "Error"}`, err);
    }
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!known) return res.status(500).json({ error: "Internal error", code: "internal" });
    const extra = known.extra && typeof known.extra === "object" ? known.extra : {};
    const { error: _e, code: _c, ...rest } = extra;
    return res.status(known.status).json({ error: known.message, code: known.code, ...rest });
  }

  function dispatch(req, res) {
    const fail = (err) => {
      try {
        errorHandler(err, req, res);
      } catch (e) {
        logger.error("[api] error handler failed", e);
      }
    };
    const chain = [
      (q, s, next) => authMiddleware(q, s, next),
      (q, s, next) => {
        s.setHeader("Cache-Control", "no-store");
        next();
      },
      ...routers.map((r) => (q, s, next) => r.handle(q, s, next)),
      (q, s) => s.status(404).json({ error: "Not found", code: "not_found" }),
    ];
    let i = 0;
    const next = (err) => {
      if (err) return fail(err);
      const fn = chain[i++];
      if (!fn) return undefined;
      try {
        return fn(req, res, next);
      } catch (e) {
        return fail(e);
      }
    };
    next();
  }

  /** fetch(input, init) for same-origin /api/* URLs. */
  async function fetchApi(input, init = {}) {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), "http://preview.invalid");
    const method = String(init.method || (request && request.method) || "GET").toUpperCase();
    const signal = init.signal || (request && request.signal) || null;
    const headers = headerMap(init.headers || (request && request.headers));
    const text = init.body !== undefined ? await bodyText(init.body) : request && method !== "GET" && method !== "HEAD" ? await request.text() : "";
    if (signal && signal.aborted) throw abortError();
    if (ready) await ready();
    if (latency) await latency(signal);
    if (signal && signal.aborted) throw abortError();

    return new Promise((resolve, reject) => {
      const res = new PreviewResponse({
        resolve,
        reject,
        signal,
        onHeaders: (r) => jar.store(r.getHeader("set-cookie")),
        onDone: (r) => {
          open.delete(r);
          if (afterResponse) afterResponse();
        },
      });
      open.add(res);
      const cookie = jar.header();
      if (cookie) headers.cookie = cookie;
      const fullPath = url.pathname;
      const req = {
        method,
        url: fullPath.replace(/^\/api(?=\/|$)/, "") + url.search,
        originalUrl: fullPath + url.search,
        baseUrl: "/api",
        path: fullPath.replace(/^\/api(?=\/|$)/, "") || "/",
        query: parseQuery(url.search),
        headers,
        params: {},
        body: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
        protocol: "https",
        secure: true,
        hostname: "preview.local",
        get(name) {
          return headers[String(name).toLowerCase()];
        },
        header(name) {
          return headers[String(name).toLowerCase()];
        },
        accepts(type) {
          const a = headers.accept || "*/*";
          return a.includes(type) || a.includes("*/*") ? type : false;
        },
        on() {
          return req;
        },
      };
      try {
        parseJsonBody(req, text);
      } catch (err) {
        errorHandler(err, req, res);
        return;
      }
      dispatch(req, res);
    });
  }

  /**
   * The page is going away (reload, close): every open response sees its client disconnect, as a
   * real server does when the tab closes. A streaming answer then ends the way a Stop ends it.
   */
  function disconnectAll() {
    for (const res of [...open]) res._clientAborted();
    return open.size;
  }

  return { fetch: fetchApi, dispatch, disconnectAll };
}

module.exports = { createApp, createCookieJar, PreviewResponse, clientError, parseQuery };
