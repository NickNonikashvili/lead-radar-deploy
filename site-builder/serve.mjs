#!/usr/bin/env node
// Preview the built site with its clean addresses, the way the .htaccess rules serve it on the host:
//   node site-builder/serve.mjs [port]        then open http://localhost:8080/home
// /home, /services, /ka/work/evo serve the .html files; /, /index.html, /services.html and /services/ redirect to the
// clean address; unknown addresses get the language's "page not found" page with a 404. Like on the host, only
// api/chat.php and api/quote.php are public, but the PHP itself doesn't run here: the chat falls back to its built-in
// answers (for a preview with PHP, see site-builder/router.php). It listens on this computer only.
// © 2026 EvoSoft Solutions. All rights reserved.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'evosoft-site');
const PORT = Number(process.argv[2]) || 8080;
const LANGS = ['ka', 'ru', 'es'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
  '.xml': 'application/xml', '.md': 'text/plain; charset=utf-8',
};
const isFile = (rel) => { try { return fs.statSync(path.join(ROOT, rel)).isFile(); } catch { return false; } };
const isDir = (rel) => { try { return fs.statSync(path.join(ROOT, rel)).isDirectory(); } catch { return false; } };

function handle(req, res) {
  // the path and query as sent: '//services.html' is a path here, never a host
  const [rawPath, ...q] = req.url.split('#')[0].split('?');
  const qs = q.length && q.join('?') !== '' ? '?' + q.join('?') : '';
  let p;
  try { p = decodeURIComponent(rawPath); } catch { p = rawPath; }
  p = ('/' + p).replace(/[\\/]+/g, '/'); // one slash at a time, so a redirect can never point at another host
  p = p.replace(/\/(?:\.\/)+/g, '/').replace(/\/\.$/, '/'); // and no '.' segments, so /./api/ is /api/
  if (p.includes('\0') || p.split('/').includes('..')) return send(404);
  const lang = LANGS.find((l) => p === `/${l}` || p.startsWith(`/${l}/`));
  const pre = lang ? `/${lang}/` : '/';
  const rest = p.slice(pre.length); // the address inside the language: '', 'services', 'work/evo.html', ...
  const go = (to) => { res.writeHead(301, { Location: encodeURI(to) + qs }); res.end(); };

  if (p === `/${lang}`) return go(`/${lang}/home`);
  if (/(^|\/)index\.html$/.test(rest)) return go(pre + rest.replace(/index\.html$/, 'home'));
  if (/^pricing(\.html|\/)?$/.test(rest)) return go(pre + 'contact');
  if (rest.endsWith('.html') && isFile(pre + rest)) return go(pre + rest.slice(0, -5));
  if (rest === '') return go(pre + 'home');
  if (/^work\/?$/.test(rest)) return go(pre + 'portfolio');
  if (rest.endsWith('/') && !isDir(pre + rest)) return go(pre + rest.replace(/\/+$/, ''));
  if (rest === '404') return send(404);
  if (rest === 'index') return go(pre + 'home');
  if (rest === 'home') return send(200, pre + 'index.html');
  if (path.basename(rest).startsWith('.ht')) return send(404);
  if (p.startsWith('/api/')) return send(404); // chat.php and quote.php need PHP: use router.php for those
  if (isFile(pre + rest)) return send(200, pre + rest);
  if (!rest.includes('.') && isFile(pre + rest + '.html')) return send(200, pre + rest + '.html');
  return send(404);

  function send(code, rel) {
    if (code === 404) rel = `${pre}404.html`;
    const file = path.join(ROOT, rel);
    res.writeHead(code, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }
}

http.createServer((req, res) => {
  try { handle(req, res); } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
}).listen(PORT, '127.0.0.1', () => console.log(`EvoSoft site: http://localhost:${PORT}/home`));
