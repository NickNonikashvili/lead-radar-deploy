#!/usr/bin/env node
// Makes an upload-ready zip of the website, including the PHP libraries the chat assistant needs:
//   node site-builder/package.mjs        ->  dist/evosoft-site-YYYYMMDD.zip
// Upload the zip to Hostinger's File Manager inside public_html and extract it there.
// Needs Node 18+, `zip`, and Composer (or an existing evosoft-site/api/vendor folder).
// © 2026 EvoSoft Solutions. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC = path.join(REPO, 'evosoft-site');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const DIST = path.join(REPO, 'dist');
const STAGE = path.join(DIST, `evosoft-site-${stamp}`);
const ZIP = `${STAGE}.zip`;

const has = (cmd) => { try { execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }); return true; } catch { return false; } };

console.log('Building the site…');
execFileSync(process.execPath, [path.join(HERE, 'build.mjs')], { stdio: 'inherit' });

fs.rmSync(STAGE, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(DIST, { recursive: true });
const skip = new Set(['api/config.php', 'api/data', 'api/vendor']);
fs.cpSync(SRC, STAGE, {
  recursive: true,
  filter: (from) => {
    const rel = path.relative(SRC, from).split(path.sep).join('/');
    return !skip.has(rel) && !path.basename(from).startsWith('_og');
  },
});

const api = path.join(STAGE, 'api');
if (has('composer')) {
  console.log('Installing the PHP libraries for the chat assistant…');
  execFileSync('composer', ['install', '--no-dev', '--prefer-dist', '--optimize-autoloader', '--no-interaction', '--no-progress'], { cwd: api, stdio: 'inherit' });
} else if (fs.existsSync(path.join(SRC, 'api/vendor/autoload.php'))) {
  console.log('Composer not found: copying the existing api/vendor folder.');
  fs.cpSync(path.join(SRC, 'api/vendor'), path.join(api, 'vendor'), { recursive: true });
} else {
  console.warn('WARNING: no Composer and no api/vendor. The site works, but the chat assistant will use its built-in answers until you run `composer install` in api/.');
}
// Version-control folders don't belong on the server.
const prune = (dir) => {
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === '.git') fs.rmSync(p, { recursive: true, force: true }); else prune(p); }
  }
};
prune(path.join(api, 'vendor'));

if (!has('zip')) {
  console.log(`No zip command found. Upload the contents of ${path.relative(REPO, STAGE)} instead.`);
  process.exit(0);
}
execFileSync('zip', ['-qr', ZIP, '.'], { cwd: STAGE });
const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
console.log(`\nReady: ${path.relative(REPO, ZIP)} (${mb} MB)`);
console.log('Upload it into public_html, extract, then add your settings file (see site-builder/README.md, "Chat assistant").');
