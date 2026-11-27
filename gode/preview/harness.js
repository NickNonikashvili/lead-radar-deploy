#!/usr/bin/env node
"use strict";
// A local stand-in for the Artifact host, to run and test preview/dist exactly as it will be served:
//
//   node preview/harness.js [port]        (port 0 or none: a free port; also PREVIEW_PORT / PORT)
//
// - GET / (and /index.html) wraps dist/index.html in the host's page skeleton.
// - Every response carries a CSP modelled on the host's: scripts and connections to the page's own
//   origin only (plus the CDNs the host allows, which the preview does not use), no frames.
// - Anything under /api/ answers 599 and logs "[harness] real /api request: <method> <path>":
//   the preview's simulated backend must answer every /api call in the page, so this must never
//   happen.
// - Page query switches: ?theme=dark|light sets data-theme on <html> (the viewer's explicit theme
//   choice), ?nostorage=1 makes localStorage and sessionStorage throw (private windows, previews),
//   ?safearea=1 pads :root like the phone app does (47px top, 34px bottom).
// - GET /frame.html?src=<page url> embeds the page in an iframe sandboxed like the viewer's frame
//   (allow-scripts allow-same-origin allow-forms allow-popups: no modals, downloads or top
//   navigation).
//
// Zero dependencies. Exports startHarness() for preview/smoke.js.

const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_DIST = path.join(__dirname, "dist");

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// The frame page itself must be allowed to embed the preview (same origin).
const FRAME_CSP = "default-src 'none'; frame-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const SKELETON_HEAD =
  '<!doctype html><html lang="en"{{HTML_ATTRS}}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
  "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>" +
  "{{HEAD_EXTRA}}</head><body>";
const SKELETON_TAIL = "</body></html>";

// Served as a file (inline scripts are blocked by the CSP, like on the host).
const NOSTORAGE_JS = `// harness: storage blocked, as in a private window or a thumbnail capture
(function () {
  function blocked() { throw new DOMException("The operation is insecure.", "SecurityError"); }
  for (var name of ["localStorage", "sessionStorage"]) {
    try { Object.defineProperty(window, name, { configurable: true, get: blocked }); } catch (e) {}
  }
})();
`;

function frameHtml(src) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Preview frame</title><style>html,body{margin:0;height:100%;background:#888}iframe{border:0;width:100%;height:100%;display:block}</style></head><body>" +
    `<iframe id="viewer" title="Artifact" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="${esc(src)}"></iframe>` +
    "</body></html>"
  );
}

/**
 * @param {{ port?: number, host?: string, dist?: string, log?: (line: string) => void }} [opts]
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void>, lines: string[], apiHits: string[] }>}
 */
function startHarness({ port = 0, host = "127.0.0.1", dist = DEFAULT_DIST, log = (l) => console.log(l) } = {}) {
  const lines = [];
  const apiHits = [];
  const say = (line) => {
    lines.push(line);
    log(line);
  };
  const root = path.resolve(dist);

  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const send = (status, type, body, csp = CSP) => {
      res.writeHead(status, {
        "Content-Type": type,
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    };

    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      const hit = `${req.method} ${url.pathname}`;
      apiHits.push(hit);
      say(`[harness] real /api request: ${hit}`);
      send(599, "application/json; charset=utf-8", JSON.stringify({ error: "The preview has no server.", code: "no_server" }));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(405, "text/plain; charset=utf-8", "Method not allowed");
      return;
    }
    if (url.pathname === "/__harness/nostorage.js") {
      send(200, TYPES[".js"], NOSTORAGE_JS);
      return;
    }
    if (url.pathname === "/frame.html") {
      const src = url.searchParams.get("src") || "/";
      send(200, TYPES[".html"], frameHtml(src), FRAME_CSP);
      return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      let fragment;
      try {
        fragment = fs.readFileSync(path.join(root, "index.html"), "utf8");
      } catch {
        send(500, "text/plain; charset=utf-8", "dist/index.html is missing: run npm run preview:build");
        return;
      }
      if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(fragment)) say("[harness] warning: dist/index.html is not a fragment (it has document tags)");
      const theme = url.searchParams.get("theme");
      const attrs = theme === "dark" || theme === "light" ? ` data-theme="${theme}"` : "";
      let extra = "";
      if (url.searchParams.get("nostorage") === "1") extra += '<script src="/__harness/nostorage.js"></script>';
      if (url.searchParams.get("safearea") === "1") extra += "<style>:root{padding-top:47px;padding-bottom:34px}</style>";
      send(200, TYPES[".html"], SKELETON_HEAD.replace("{{HTML_ATTRS}}", attrs).replace("{{HEAD_EXTRA}}", extra) + fragment + SKELETON_TAIL);
      return;
    }

    // Supporting files, by relative path; never outside dist.
    let rel;
    try {
      rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch {
      send(400, "text/plain; charset=utf-8", "Bad path");
      return;
    }
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || rel.split("/").includes("..")) {
      send(403, "text/plain; charset=utf-8", "Forbidden");
      return;
    }
    if (path.extname(file) === ".html") {
      // Supporting HTML pages are served without the skeleton, as on the host.
      say(`[harness] note: ${rel} is served without the page skeleton`);
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        say(`[harness] 404 ${url.pathname}`);
        send(404, "text/plain; charset=utf-8", "Not found");
        return;
      }
      send(200, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", buf);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      const url = `http://${host}:${actual}/`;
      resolve({
        url,
        port: actual,
        lines,
        apiHits,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (require.main === module) {
  const arg = process.argv[2];
  const port = Number(arg ?? process.env.PREVIEW_PORT ?? process.env.PORT ?? 0) || 0;
  startHarness({ port })
    .then(({ url }) => {
      console.log(`[harness] serving ${path.relative(process.cwd(), DEFAULT_DIST) || "dist"} at ${url}`);
      console.log(`[harness] try ${url}?theme=dark  ${url}?nostorage=1  ${url}?safearea=1  ${url}frame.html?src=/`);
    })
    .catch((err) => {
      console.error(`[harness] could not start: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { startHarness, CSP };
