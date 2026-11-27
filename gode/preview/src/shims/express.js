"use strict";
// The slice of Express 4 that Gode's route files (src/routes/*.js) use: express.Router() with
// get/post/put/patch/delete/use, ":param" paths, middleware chains and next(err). The preview's
// app (preview/src/http.js) mounts these routers under /api exactly as src/app.js does.
//
// Semantics kept from Express 4: paths match case-insensitively with an optional trailing slash;
// params are URI-decoded (a malformed escape is a URIError -> 400 via the error handler); a
// handler that throws synchronously goes to the error handler; next(err) skips the remaining
// handlers; next("route") skips to the next route; HEAD is served by GET routes.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "/conversations/:id" -> { regex, keys } (end: false for router.use prefixes). */
function compile(path, end) {
  const keys = [];
  let source = "";
  for (const part of String(path).split("/").filter(Boolean)) {
    if (part.startsWith(":")) {
      keys.push(part.slice(1));
      source += "\\/([^\\/]+?)";
    } else {
      source += "\\/" + escapeRegExp(part);
    }
  }
  const regex = new RegExp(`^${source || ""}${end ? "\\/?$" : "(?:\\/|$)"}`, "i");
  return { regex, keys };
}

function decodeParam(value) {
  // URIError on a malformed escape, as Express (decode_param) reports it.
  return decodeURIComponent(value);
}

function Router() {
  const layers = [];

  function add(method) {
    return (path, ...handlers) => {
      const { regex, keys } = compile(path, true);
      layers.push({ method, regex, keys, handlers: handlers.flat() });
      return router;
    };
  }

  function use(path, ...handlers) {
    if (typeof path === "function") {
      handlers.unshift(path);
      path = "/";
    }
    const { regex, keys } = compile(path, false);
    layers.push({ method: "USE", regex, keys, handlers: handlers.flat() });
    return router;
  }

  /** Run req through the layers; out(err?) when nothing here answered. */
  function handle(req, res, out) {
    let index = 0;
    const path = req.path || "/";

    function nextLayer(err) {
      if (err && err !== "route" && err !== "router") return out(err);
      if (err === "router") return out();
      while (index < layers.length) {
        const layer = layers[index++];
        if (layer.method !== "USE") {
          const method = req.method === "HEAD" ? "GET" : req.method;
          if (layer.method !== method) continue;
        }
        const m = layer.regex.exec(path);
        if (!m) continue;
        let params;
        try {
          params = {};
          layer.keys.forEach((k, i) => {
            if (m[i + 1] !== undefined) params[k] = decodeParam(m[i + 1]);
          });
        } catch (e) {
          return out(e);
        }
        req.params = params;
        return runHandlers(layer.handlers, 0);
      }
      return out();
    }

    function runHandlers(handlers, i) {
      if (i >= handlers.length) return nextLayer();
      const fn = handlers[i];
      let called = false;
      const next = (err) => {
        if (called) return;
        called = true;
        if (err === "route") return nextLayer();
        if (err) return out(err);
        runHandlers(handlers, i + 1);
      };
      try {
        fn(req, res, next);
      } catch (e) {
        next(e);
      }
      return undefined;
    }

    nextLayer();
  }

  const router = {
    get: add("GET"),
    post: add("POST"),
    put: add("PUT"),
    patch: add("PATCH"),
    delete: add("DELETE"),
    use,
    handle,
    layers,
  };
  return router;
}

function unsupported(name) {
  return () => {
    throw new Error(`preview: express.${name} is not part of the preview's Express shim`);
  };
}

const express = unsupported("()");
express.Router = Router;
express.json = unsupported("json");
express.raw = unsupported("raw");
express.static = unsupported("static");

module.exports = express;
