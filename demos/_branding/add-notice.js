#!/usr/bin/env node
// © 2026 EvoSoft Solutions. All rights reserved.
//
// add-notice.js: put the EvoSoft copyright notice tags into an HTML page, idempotently.
//
//   node add-notice.js --product Evo [--surface register] [--base /__evosoft/] <in.html> [out.html]
//   node add-notice.js --check <file.html>          exit 0 when the page has exactly one notice block
//
// Inserts, on its own line just before </head>:
//   <!-- evosoft-notice --><link rel="stylesheet" href="/__evosoft/evosoft-notice.css"><script
//   src="/__evosoft/evosoft-notice.js" data-product="Evo" defer></script><!-- /evosoft-notice -->
// An existing block (from an earlier run) is removed first, so running it again changes nothing.
// Without out.html the file is changed in place (written to a temporary file, then renamed).
//
// Safety checks before anything is written: the page has a </head>; with the block taken out again the
// result is byte-for-byte the input (minus any old block); and every inline <script> is unchanged, so
// CSP hashes of inline scripts (Evo's script-src 'sha256-…') still match. Exit 1 on any problem.
// Node 18+, no dependencies.
'use strict';
const fs = require('fs');
const path = require('path');

const START = '<!-- evosoft-notice -->';
const END = '<!-- /evosoft-notice -->';
const BLOCK_RE = /[ \t]*<!-- evosoft-notice -->[\s\S]*?<!-- \/evosoft-notice -->[ \t]*\r?\n?/g;

function fail(msg) { process.stderr.write(`add-notice: ${msg}\n`); process.exit(1); }

const args = process.argv.slice(2);
const opt = { product: '', surface: '', base: '/__evosoft/', check: false, files: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--check') opt.check = true;
  else if (a === '--product' || a === '--surface' || a === '--base') opt[a.slice(2)] = args[++i] ?? '';
  else if (/^--(product|surface|base)=/.test(a)) { const [k, ...v] = a.slice(2).split('='); opt[k] = v.join('='); }
  else if (a === '-h' || a === '--help') { process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n'); process.exit(0); }
  else if (a.startsWith('--')) fail(`unknown option ${a}`);
  else opt.files.push(a);
}

const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((m) => !/\bsrc\s*=/i.test(m[1]) && m[2]).map((m) => m[2]);
const countBlocks = (html) => (html.match(/<!-- evosoft-notice -->/g) || []).length;

if (opt.check) {
  if (opt.files.length !== 1) fail('--check takes one file');
  const html = fs.readFileSync(opt.files[0], 'utf8');
  const n = countBlocks(html);
  if (n !== 1) { process.stderr.write(`add-notice: ${opt.files[0]}: ${n} notice blocks\n`); process.exit(1); }
  process.stdout.write(`${opt.files[0]}: notice present\n`);
  process.exit(0);
}

if (opt.files.length < 1 || opt.files.length > 2) fail('usage: add-notice.js --product NAME [--surface NAME] in.html [out.html]');
if (!/^[A-Za-z0-9][\w .+&-]{0,39}$/.test(opt.product)) fail('--product must be a short plain name (letters, digits, spaces, . + & - _)');
if (opt.surface && !/^[a-z0-9-]{1,30}$/.test(opt.surface)) fail('--surface must be lowercase letters, digits or -');
if (!/^\/[\w./-]*\/$/.test(opt.base) || opt.base.includes('..')) fail('--base must be an absolute path ending in / (default /__evosoft/)');

const [inFile, outFile = inFile] = opt.files;
const original = fs.readFileSync(inFile, 'utf8');
const clean = original.replace(BLOCK_RE, '');
if (countBlocks(clean)) fail(`${inFile}: a broken notice block (start without end); fix the file by hand`);

const surfaceAttr = opt.surface ? ` data-surface="${opt.surface}"` : '';
const block = `${START}<link rel="stylesheet" href="${opt.base}evosoft-notice.css">`
  + `<script src="${opt.base}evosoft-notice.js" data-product="${opt.product}"${surfaceAttr} defer></script>${END}`;

const head = /^([ \t]*)<\/head>/im.exec(clean) || /<\/head>/i.exec(clean);
if (!head) fail(`${inFile}: no </head> found`);
const indent = head[1] !== undefined ? head[1] : '';
const nl = clean.includes('\r\n') ? '\r\n' : '\n';
const insert = head[1] !== undefined ? `${indent}  ${block}${nl}` : block;
const out = clean.slice(0, head.index) + insert + clean.slice(head.index);

// Checks: removing the block again gives the clean input back; inline scripts are untouched.
if (out.replace(BLOCK_RE, '') !== clean) fail(`${inFile}: internal check failed (the page would change beyond the notice)`);
if (JSON.stringify(inlineScripts(out)) !== JSON.stringify(inlineScripts(original))) fail(`${inFile}: inline scripts would change`);
if (countBlocks(out) !== 1) fail(`${inFile}: expected exactly one notice block`);

if (out === original && outFile === inFile) { process.stdout.write(`${inFile}: already up to date\n`); process.exit(0); }
const tmp = path.join(path.dirname(path.resolve(outFile)), `.${path.basename(outFile)}.${process.pid}.tmp`);
fs.writeFileSync(tmp, out, { mode: 0o644 });
fs.renameSync(tmp, outFile);
process.stdout.write(`${outFile}: notice ${original === clean ? 'added' : 'updated'}\n`);
