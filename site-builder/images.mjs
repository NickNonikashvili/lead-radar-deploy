#!/usr/bin/env node
// Makes WebP versions of every screenshot in evosoft-site/assets/shots (800 and 1600 px wide)
// and writes their sizes to data/images.json for build.mjs. Needs ImageMagick (`convert`, `identify`).
//   node site-builder/images.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(HERE, '../evosoft-site/assets/shots');
const WIDTHS = [800, 1600];
const out = {};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const files = fs.existsSync(SHOTS) ? walk(SHOTS).filter((f) => /\.(jpe?g|png)$/i.test(f)) : [];
for (const file of files) {
  const rel = path.relative(SHOTS, file).split(path.sep).join('/');
  const [w, h] = execFileSync('identify', ['-format', '%w %h', file + '[0]']).toString().trim().split(' ').map(Number);
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  const made = [];
  for (const target of WIDTHS) {
    if (target > w && made.length) continue; // no upscaling beyond the first size
    const tw = Math.min(target, w);
    const dest = `${base}-${target}.webp`;
    const srcTime = fs.statSync(file).mtimeMs;
    if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < srcTime) {
      execFileSync('convert', [file, '-resize', `${tw}x`, '-strip', '-quality', '78', '-define', 'webp:method=6', dest]);
    }
    made.push(target);
  }
  out[rel] = { w, h, webp: made };
}

fs.writeFileSync(path.join(HERE, 'data/images.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Processed ${files.length} screenshots.`);
