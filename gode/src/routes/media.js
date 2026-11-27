// GET /api/media/:messageId/:index: generated media, streamed through Gode.
//
// Media models (fal) return links on their own CDN. If the browser loaded those directly, the
// media host would see every viewer's IP address and user agent next to a URL it can tie to the
// generation and its prompt. With MEDIA_PROXY on (the default) the browser gets this same-origin
// link instead (src/media.js publicMediaUrl) and Gode fetches the file server-side, under its own
// identity.
//
// Rules:
// - Only the signed-in owner of the assistant message gets its media; anything else is a 404.
// - Only https URLs on MEDIA_PROXY_HOSTS are fetched (no SSRF): the URL comes from the stored,
//   encrypted message, never from the request. Redirects are followed only to allowed hosts.
// - Only image/video/audio types are passed through, never SVG or HTML: this is our origin, so a
//   scriptable document here would be stored XSS. Everything else is a download.
// - Range requests are forwarded so videos can seek. Nothing about the file is logged.
const express = require("express");
const { Readable } = require("stream");
const { AppError } = require("../util");
const { isProxyableUrl } = require("../media");
const { readContent } = require("./conversations");

// Waiting for the media host's response headers (the body then streams for as long as it takes).
const HEADERS_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
// Videos and songs are a few MB to a few hundred; anything bigger is cut off.
const MAX_BYTES = 512 * 1024 * 1024;
// Types a browser may render inline from our origin. SVG is an image type that runs script, so it
// is not here.
const INLINE_TYPE_RE = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm|ogg|quicktime)|audio\/(mpeg|mp3|mp4|aac|ogg|wav|x-wav|wave|webm|flac))$/;
const PASS_HEADERS = ["content-length", "content-range", "accept-ranges", "last-modified", "etag"];

const notFound = () => new AppError(404, "not_found", "This file isn't available.");

/**
 * @param {object} ctx  app context (see src/app.js); ctx.mediaFetch replaces global fetch (tests)
 */
function createMediaRoutes({ db, config, auth, keyring, mediaFetch, logger }) {
  const router = express.Router();
  const fetchImpl = mediaFetch || ((...args) => fetch(...args));
  const hosts = config.privacy?.mediaProxyHosts || [];
  const stmt = {
    message: db.prepare("SELECT id, user_id, role, content_enc FROM messages WHERE id = ? AND user_id = ?"),
  };

  /** fetch with manual redirects, each hop checked against the allowed hosts. */
  async function fetchAllowed(url, headers, signal) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isProxyableUrl(current, hosts)) throw notFound();
      const res = await fetchImpl(current, { headers, signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        res.body?.cancel?.().catch(() => {});
        current = new URL(res.headers.get("location"), current).toString();
        continue;
      }
      return res;
    }
    throw new AppError(502, "upstream_error", "This file couldn't be loaded.");
  }

  router.get("/media/:messageId/:index", auth.requireUser, async (req, res, next) => {
    const controller = new AbortController();
    // The viewer left (closed the tab, scrolled a video away): stop downloading for them.
    res.on("close", () => controller.abort());
    try {
      if (!config.privacy?.mediaProxy) throw notFound();
      if (!/^\d{1,3}$/.test(req.params.index)) throw notFound();
      const index = Number(req.params.index);
      const row = stmt.message.get(req.params.messageId, req.user.id);
      if (!row || row.role !== "assistant") throw notFound();
      const item = readContent(req.user, keyring, row.content_enc).media[index];
      const url = item && typeof item.url === "string" ? item.url : null;
      if (!url || !isProxyableUrl(url, hosts)) throw notFound();

      const headers = { Accept: "image/*,video/*,audio/*;q=0.9,*/*;q=0.5" };
      const range = req.headers.range;
      if (typeof range === "string" && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
      const timer = setTimeout(() => controller.abort(), HEADERS_TIMEOUT_MS);
      let upstream;
      try {
        upstream = await fetchAllowed(url, headers, controller.signal);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(502, "upstream_error", "This file couldn't be loaded right now.");
      } finally {
        clearTimeout(timer);
      }
      if (upstream.status === 404 || upstream.status === 403 || upstream.status === 410) {
        throw new AppError(404, "not_found", "This file has expired at the media provider.");
      }
      if (upstream.status === 416) throw new AppError(416, "bad_request", "Range not satisfiable.");
      if (upstream.status !== 200 && upstream.status !== 206) throw new AppError(502, "upstream_error", "This file couldn't be loaded right now.");
      const declared = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_BYTES) throw new AppError(502, "upstream_error", "This file is too large to show.");

      const type = String(upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      res.status(upstream.status);
      for (const h of PASS_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      if (INLINE_TYPE_RE.test(type)) {
        res.setHeader("Content-Type", type);
      } else {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", "attachment");
      }
      // Even if a browser were told to render this as a document, it gets no script and no origin.
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cache-Control", "private, no-store");
      if (!upstream.body) return res.end();

      let sent = 0;
      const body = Readable.fromWeb(upstream.body);
      body.on("data", (chunk) => {
        sent += chunk.length;
        if (sent > MAX_BYTES) body.destroy(new Error("media too large"));
      });
      body.on("error", () => {
        // Mid-stream: the status is sent, all we can do is stop (the browser sees a cut-off file).
        if (!res.writableEnded) res.destroy();
      });
      body.pipe(res);
    } catch (err) {
      if (controller.signal.aborted && res.destroyed) return undefined;
      if (!(err instanceof AppError)) logger?.warn?.(`[media] proxy failed (${err?.name || "error"})`);
      return next(err instanceof AppError ? err : new AppError(502, "upstream_error", "This file couldn't be loaded right now."));
    }
    return undefined;
  });

  return router;
}

module.exports = { createMediaRoutes, INLINE_TYPE_RE };
