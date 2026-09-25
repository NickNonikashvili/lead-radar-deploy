#!/usr/bin/env node
/* ============================================================
   MatHub test runner:  node tests/run.js [name ...]
   Starts PHP's built-in server on 127.0.0.1:8766 serving calc1/ when
   nothing answers there (and a local Pyodide mirror on :8767 when
   tests/pyodide/package exists), then runs every tests/*.test.js in
   turn (or only the names given) and prints a summary.
   Requires: node 18+, php 8+, `npm install` inside tests/ (Playwright
   and its Chromium), and api/data with the seeded test accounts.
   ============================================================ */
'use strict';
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(n => f.includes(n)))).sort();
const alive = (port, p = '/') => new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: p, timeout: 1500 }, x => { x.resume(); res(true); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
const children = [];
async function ensure(port, args, cwd, label) {
  if (await alive(port)) return console.log(`${label}: already running on :${port}`);
  const child = spawn('php', args, { cwd, stdio: 'ignore', env: Object.assign({}, process.env, { no_proxy: '127.0.0.1,localhost', NO_PROXY: '127.0.0.1,localhost' }) }); children.push(child);
  for (let i = 0; i < 30; i++) { if (await alive(port)) break; await new Promise(r => setTimeout(r, 200)); }
  console.log(`${label}: started on :${port}`);
}
(async () => {
  if (spawnSync('php', ['-v']).status !== 0) { console.error('php is not on PATH'); process.exit(2); }
  await ensure(8766, ['-S', '127.0.0.1:8766', '-t', ROOT], ROOT, 'site');
  if (fs.existsSync(path.join(__dirname, 'pyodide', 'package'))) await ensure(8767, ['-S', '127.0.0.1:8767', 'router.php'], path.join(__dirname, 'pyodide'), 'pyodide mirror');
  else console.log('pyodide mirror: not present, the playground test uses the CDN');
  // the suites log in many times; clear the login rate limits of the development database so they never lock the test accounts out
  const dbFile = path.join(ROOT, 'api', 'data', 'mathub.sqlite');
  if (fs.existsSync(dbFile)) spawnSync('php', ['-r', 'try { (new PDO("sqlite:" . $argv[1]))->exec("DELETE FROM rate WHERE key LIKE \'login:%\' OR key LIKE \'issue:%\'"); } catch (Throwable $e) {}', dbFile], { stdio: 'ignore' });
  const results = [];
  for (const f of files) {
    console.log(`\n━━━ ${f} ━━━`); const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: 600000, env: process.env });
    results.push([f, r.status === 0, Math.round((Date.now() - t0) / 1000)]);
  }
  console.log('\n━━━ summary ━━━'); results.forEach(([f, ok, s]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${s}s)`));
  children.forEach(c => c.kill());
  process.exit(results.every(r => r[1]) ? 0 : 1);
})();
