// Static preview of the built site with the same clean addresses as the .htaccess on Hostinger:
// `npm run dev` → http://localhost:8080 (PORT=… to change it; MFS_OUT=/some/dir or a folder argument to
// serve another build). /about serves about.html, /about.html and /about/ redirect to /about, folders get
// their slash (/tours → /tours/), old addresses redirect, unknown ones get the 404 page.
// There's no PHP here, so forms open the visitor's email app and the admin panel isn't available
// (use `php -S localhost:8080 -t dist scripts/router.php` for those).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || process.env.MFS_OUT || path.join(here, "..", "dist"));
const port = Number(process.env.PORT) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// Same rules as src/root/.htaccess.
const LEGACY = [
  [/^((?:\/[a-z]{2})?\/)tours\.html$/, "$1tours/"],
  [/^((?:\/[a-z]{2})?\/)travel-guide(?:\.html)?\/?$/, "$1guide/"],
  [/^((?:\/[a-z]{2})?\/)plan(?:\.html)?\/?$/, "$1guide/"],
  [/^((?:\/[a-z]{2})?\/)history(?:\.html)?\/?$/, "$1discover-georgia"],
  [/^((?:\/[a-z]{2})?\/)destinations(?:\.html)?\/?$/, "$1"],
];
const DENIED = [/\/\.(?!well-known(\/|$))/, /\.(sqlite3?|sqlite-wal|sqlite-shm|db|log|ini|lock)$/i, /(^|\/)(error_log|php_errorlog)$/, /^\/admin\/(lib|data)(\/|$)/];

const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const local = (p) => path.join(root, ...p.split("/").filter(Boolean));
const encode = (p) => p.split("/").map(encodeURIComponent).join("/");

function send(res, status, file, extra = {}) {
  const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", ...(type.startsWith("text/html") ? { "Cache-Control": "no-cache" } : {}), ...extra });
  fs.createReadStream(file).pipe(res);
}
const notFound = (res) => send(res, 404, path.join(root, "404.html"));
const deny = (res) => { res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Forbidden\n"); };

http
  .createServer((req, res) => {
    let url;
    let p;
    try {
      url = new URL(req.url, "http://localhost");
      p = decodeURIComponent(url.pathname);
    } catch {
      return notFound(res);
    }
    if (p.includes("\0") || p.split("/").includes("..")) return notFound(res);
    const go = (to) => {
      res.writeHead(301, { Location: encode(to) + url.search });
      res.end();
    };
    if (DENIED.some((re) => re.test(p))) return deny(res);
    for (const [re, to] of LEGACY) if (re.test(p)) return go(p.replace(re, to));

    // Asked for a file name: redirect to the clean address (/index.html → /, /about.html → /about).
    const index = p.match(/^(.*\/)index(?:\.html)?\/?$/);
    if (index && isFile(local(index[1] + "index.html"))) return go(index[1]);
    if (p.endsWith(".html") && !p.endsWith("/404.html") && isFile(local(p))) return go(p.slice(0, -5));
    // /about/ → /about
    if (p.length > 1 && p.endsWith("/") && !isDir(local(p)) && isFile(local(p.slice(0, -1) + ".html"))) return go(p.slice(0, -1));

    const file = local(p);
    // No settings from the admin panel yet: "no changes" rather than a 404 (see .htaccess).
    if (p === "/api/live.json" && !isFile(file)) return send(res, 200, path.join(root, "assets", "live-none.json"));
    if (isDir(file)) {
      if (!p.endsWith("/")) return go(p + "/");
      if (isFile(path.join(file, "index.html"))) return send(res, 200, path.join(file, "index.html"));
      return notFound(res); // no folder listings; index.php needs PHP
    }
    if (isFile(file)) {
      if (file.endsWith(".php")) {
        res.writeHead(501, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("PHP isn't available in this preview. Use: php -S localhost:8080 -t dist scripts/router.php\n");
      }
      return send(res, 200, file);
    }
    if (!p.endsWith("/") && !p.endsWith("/404") && isFile(file + ".html")) return send(res, 200, file + ".html");
    return notFound(res);
  })
  .listen(port, () => console.log(`Preview of ${path.relative(process.cwd(), root) || "."}: http://localhost:${port}`));
