"use strict";
// Entry point of mock-api.js. In a browser, start() runs the simulated backend and routes every
// same-origin fetch() to /api/... into it; every other request goes to the browser's own fetch
// unchanged. Under Node (tests) the bundle only exports these functions.

const fixture = require("preview:fixture");
const { createBackend } = require("./backend");
const { installPage } = require("./page");

const API_PREFIX = "/api/";

function isApiRequest(win, input) {
  try {
    const raw = typeof Request !== "undefined" && input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
    const url = new URL(raw, win.location.href);
    return url.origin === win.location.origin && url.pathname.startsWith(API_PREFIX);
  } catch {
    return false;
  }
}

/** Route this window's same-origin /api/* fetches to `backend`. Returns the uninstall function. */
function installFetch(win, backend) {
  const realFetch = typeof win.fetch === "function" ? win.fetch.bind(win) : null;
  function previewFetch(input, init) {
    if (isApiRequest(win, input)) return backend.fetch(input, init || {});
    if (!realFetch) return Promise.reject(new TypeError("fetch is not available"));
    return realFetch(input, init);
  }
  win.fetch = previewFetch;
  return () => {
    if (win.fetch === previewFetch && realFetch) win.fetch = realFetch;
  };
}

/**
 * A first visit opens the welcome note (the app would show an empty new chat). Only when the page
 * was opened without a route of its own, and without adding a history entry.
 */
function openWelcome(win, backend) {
  if (!backend.welcomeConversationId) return;
  try {
    const hash = win.location.hash;
    if (hash && hash !== "#" && hash !== "#/") return;
    const target = "#/c/" + backend.welcomeConversationId;
    if (win.history && typeof win.history.replaceState === "function") win.history.replaceState(win.history.state, "", target);
    else win.location.hash = target;
  } catch {
    // a frame that may not touch its history: the app opens on a new chat instead
  }
}

function start(win) {
  const backend = createBackend({ fixture, window: win, persist: true, timing: "live" });
  installFetch(win, backend);
  // Reloading or closing mid-answer: as on the real server, the answer so far is kept (stopped,
  // and charged for what it wrote) instead of vanishing with the page.
  try {
    win.addEventListener("pagehide", () => {
      backend.leave();
    });
  } catch {
    // no unload hook: an answer cut off by a reload is simply not kept
  }
  openWelcome(win, backend);
  installPage(win);
  // For the preview's own checks and for curious developers (no secrets in here).
  Object.defineProperty(win, "__godePreview", {
    value: Object.freeze({
      ready: backend.ready,
      logs: backend.logs,
      persistent: () => backend.storage.persistent,
      deployment: fixture.deployment,
      reset() {
        backend.reset();
      },
    }),
    configurable: true,
  });
  return backend;
}

// The bundle's footer (preview/build.js) calls start(window) in a browser and exports this object
// under Node.
module.exports = { createBackend, installFetch, isApiRequest, openWelcome, fixture, start };
