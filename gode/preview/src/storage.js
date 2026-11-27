"use strict";
// Where the preview keeps its state: one versioned localStorage key when the browser allows it,
// otherwise memory only. Every access is guarded: in a private window, a preview pane or a
// thumbnail capture, localStorage can be missing, throw on access, or refuse writes (quota), and
// the preview must work the same (it just forgets everything on reload).

function probe(win) {
  try {
    const ls = win && win.localStorage;
    if (!ls) return null;
    const k = "__gode_preview_probe__";
    ls.setItem(k, "1");
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}

/**
 * @param {{ key: string, window?: object, debounceMs?: number }} opts
 * @returns {{ load(): object|null, save(state): boolean, schedule(getState): void, flush(): void,
 *             clear(): void, readonly persistent: boolean, readonly lastError: string|null }}
 */
function createStorage({ key, window: win = globalThis.window, debounceMs = 250 } = {}) {
  let ls = probe(win);
  let timer = null;
  let pending = null;
  let lastError = null;

  function load() {
    if (!ls) return null;
    try {
      const raw = ls.getItem(key);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state && typeof state === "object" ? state : null;
    } catch (e) {
      lastError = (e && e.name) || "error";
      return null;
    }
  }

  function save(state) {
    if (!ls) return false;
    try {
      ls.setItem(key, JSON.stringify(state));
      lastError = null;
      return true;
    } catch (e) {
      // Quota exceeded or storage revoked: keep running from memory.
      lastError = (e && e.name) || "error";
      return false;
    }
  }

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const get = pending;
      pending = null;
      save(get());
    }
  }

  /** Save soon (coalesces bursts of writes, such as the rows one answer stores). */
  function schedule(getState) {
    if (!ls) return;
    pending = getState;
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, debounceMs);
  }

  function clear() {
    pending = null;
    if (!ls) return;
    try {
      ls.removeItem(key);
    } catch {
      // nothing to do
    }
  }

  if (ls && win && typeof win.addEventListener === "function") {
    try {
      win.addEventListener("pagehide", flush);
      win.addEventListener("beforeunload", flush);
    } catch {
      // no unload hooks: the debounce still saves
    }
  }

  return {
    load,
    save,
    schedule,
    flush,
    clear,
    get persistent() {
      return Boolean(ls);
    },
    get lastError() {
      return lastError;
    },
    disable() {
      flush();
      ls = null;
    },
  };
}

/** A Storage-like object kept in memory (tests, and browsers that block storage). */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
  };
}

module.exports = { createStorage, memoryStorage };
