"use strict";
// Shared by the preview's contract tests: a fresh build of the preview into a temp dir (so tests
// never depend on a stale preview/dist), a simulated backend from that bundle, and a client with
// the same interface as test/helpers/app.js createClient (json, sse), so one scenario can run
// against the real server and against the preview.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { build } = require("../build");
const { parseSse } = require("../../test/helpers/app");

let built = null;

/** Build once per test process; returns { dir, api } where api is the bundle's exports. */
function previewBuild() {
  if (built) return built;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-preview-test-"));
  const result = build({ dir, quiet: true });
  const api = require(path.join(dir, "mock-api.js"));
  built = { dir, api, result };
  process.on("exit", () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // temp dir: the OS cleans up
    }
  });
  return built;
}

/** A window-like object with an in-memory localStorage (or one that throws, with blocked: true). */
function fakeWindow({ blocked = false, store = new Map() } = {}) {
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, location: { href: "https://preview.example/", origin: "https://preview.example" } };
  Object.defineProperty(win, "localStorage", {
    get() {
      if (blocked) throw new DOMException("The operation is insecure.", "SecurityError");
      return ls;
    },
  });
  return { win, store };
}

/** A simulated backend, seeded and ready. */
async function previewBackend({ window: win = null, persist = false, timing = "instant" } = {}) {
  const { api } = previewBuild();
  const backend = api.createBackend({ fixture: api.fixture, window: win, persist, timing });
  await backend.ready();
  return backend;
}

/** Same interface as test/helpers/app.js createClient(), over the preview's fetch. */
function previewClient(backend) {
  async function request(method, urlPath, { body, headers = {}, signal } = {}) {
    const h = { ...headers };
    let payload = body;
    if (body !== undefined && typeof body !== "string") {
      payload = JSON.stringify(body);
      if (!Object.keys(h).some((k) => k.toLowerCase() === "content-type")) h["Content-Type"] = "application/json";
    }
    return backend.fetch(urlPath, { method, headers: h, body: payload, signal });
  }

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

  async function sse(urlPath, body = {}, { onEvent, signal, headers = {} } = {}) {
    let res;
    try {
      res = await request("POST", urlPath, { body, signal, headers: { Accept: "text/event-stream", ...headers } });
    } catch (err) {
      if (signal && signal.aborted) return { status: 0, headers: null, events: [], comments: [], raw: "", aborted: true, body: null, error: err };
      throw err;
    }
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/event-stream")) {
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      return { status: res.status, headers: res.headers, events: [], comments: [], raw: text, aborted: false, body: parsed };
    }
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let raw = "";
    let seen = 0;
    let aborted = false;
    let error = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const complete = raw.slice(0, raw.lastIndexOf("\n\n") + 2);
        const { events } = parseSse(complete);
        for (; seen < events.length; seen++) if (onEvent) onEvent(events[seen]);
      }
    } catch (err) {
      if (!(signal && signal.aborted)) throw err;
      aborted = true;
      error = err;
    }
    const { events, comments } = parseSse(raw);
    return { status: res.status, headers: res.headers, events, comments, raw, aborted, body: null, error };
  }

  return { request, json, sse };
}

const keys = (o) => Object.keys(o || {}).sort();

module.exports = { previewBuild, previewBackend, previewClient, fakeWindow, keys };
