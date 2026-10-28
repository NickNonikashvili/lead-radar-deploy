#!/usr/bin/env node
/* StudyCat — one command for a release.
     node scripts/release.js 2026.10.28.5          the build string everywhere, then the study guides and translations
     node scripts/release.js 2026.10.28.5 --zip    the same, then ../calc1-deploy-2026.10.28.5.zip for Hostinger
     node scripts/release.js --check               are the page, assets/ and learn/ stamped with the same build?
   The build string names the release in index.html (data-build and every ?v= on a script or stylesheet, so phones fetch
   the new files; data-news is the newest release note, for the account menu's dot), in assets/app.js and assets/styles.css (MATHUB_ASSETS_BUILD, --assets-build), in build-check.js and in
   learn/build.json (written by build-seo.js). build-check.js compares them on the live site: a folder an upload left
   behind shows up at once instead of as a broken page.
   The zip holds what public_html needs: never api/data, config.local.php, the tests, the docs or the apps. It says whether
   anything in api/ changed since the last zip this command made (scripts/.last-release.json). */
'use strict';
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const rel = p => path.join(ROOT, p);
const read = p => fs.readFileSync(rel(p), 'utf8');
const write = (p, s) => fs.writeFileSync(rel(p), s);
const args = process.argv.slice(2);
const fail = msg => { console.error('release: ' + msg); process.exit(1); };

const STAMPS = [
  ['assets/app.js', /(MATHUB_ASSETS_BUILD = ')([^']*)(')/],
  ['assets/styles.css', /(--assets-build: ")([^"]*)(")/],
  ['build-check.js', /(var BUILD = ')([^']*)(')/]
];
const pageBuild = () => (read('index.html').match(/data-build="([^"]+)"/) || [])[1] || '';
const stampOf = ([file, re]) => (read(file).match(re) || [])[2] || '';
const newestNote = () => (read('assets/changelog.js').match(/\{ v: '([^']+)'/) || [])[1] || '';
const learnBuild = () => { try { return JSON.parse(read('learn/build.json')).build || ''; } catch (e) { return ''; } };

function check() {
  const page = pageBuild(); const rows = [['index.html', page]].concat(STAMPS.map(s => [s[0], stampOf(s)]), [['learn/build.json', learnBuild()]]);
  const html = read('index.html'); const stale = [...new Set((html.match(/\?v=[0-9][0-9.]*/g) || []).map(v => v.slice(3)).filter(v => v !== page))];
  rows.forEach(([f, b]) => console.log(`  ${b === page ? '✓' : '✗'} ${f.padEnd(20)} ${b || '(none)'}`));
  if (stale.length) console.log(`  ✗ index.html also links files with ?v=${stale.join(', ')}`);
  const news = (html.match(/data-news="([^"]*)"/) || [])[1] || ''; const note = newestNote();
  console.log(`  ${news === note ? '✓' : '✗'} ${'data-news'.padEnd(20)} ${news || '(none)'} (newest note in What's new: ${note || 'none'})`);
  return rows.every(r => r[1] === page) && !stale.length && news === note;
}

function bump(next) {
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(next)) fail(`"${next}" is not a build string like 2026.10.28.5`);
  const prev = pageBuild(); if (!prev) fail('index.html has no data-build');
  let html = read('index.html');
  if (prev !== next) html = html.split('?v=' + prev).join('?v=' + next).replace(`data-build="${prev}"`, `data-build="${next}"`);
  const note = newestNote(); html = /data-news="/.test(html) ? html.replace(/data-news="[^"]*"/, `data-news="${note}"`) : html.replace(`data-build="${next}"`, `data-build="${next}" data-news="${note}"`);
  write('index.html', html);
  STAMPS.forEach(([file, re]) => { const s = read(file); if (!re.test(s)) fail(`${file} has no build stamp`); write(file, s.replace(re, `$1${next}$3`)); });
  console.log(`build ${prev} → ${next}`);
  if (!read('assets/changelog.js').includes(`v: '${next}'`)) console.log(`  note: assets/changelog.js has no entry for ${next} yet (What's new will not mention this release)`);
}

function rebuild() {
  // the text first (new phrases join the catalog), then the language files, then the study guides (they carry the build)
  for (const s of ['i18n-extract.js', 'build-i18n.js', 'build-seo.js']) execFileSync(process.execPath, [path.join(__dirname, s)], { cwd: ROOT, stdio: 'inherit' });
  const cat = JSON.parse(read('i18n/catalog.json')).filter(e => !e.gone);
  const missing = ['es', 'ru', 'fr', 'it', 'pt', 'de'].map(l => { const have = new Set(read(`i18n/${l}.tsv`).split('\n').filter(x => x && x[0] !== '#').map(x => +x.split('\t')[0])); return [l, cat.filter(e => !have.has(e.id)).length]; }).filter(x => x[1]);
  if (missing.length) console.log('  note: not translated yet: ' + missing.map(([l, n]) => `${n} in ${l}`).join(', '));
}

const apiHash = () => { const h = crypto.createHash('sha256'); const files = fs.readdirSync(rel('api')).filter(f => f.endsWith('.php') || f === '.htaccess' || f === '.user.ini').sort(); files.forEach(f => { h.update(f); h.update(fs.readFileSync(rel('api/' + f))); }); fs.readdirSync(rel('api/classdata')).filter(f => f.endsWith('.json')).sort().forEach(f => { h.update(f); h.update(fs.readFileSync(rel('api/classdata/' + f))); }); return h.digest('hex'); };

function zip(out) {
  const build = pageBuild();
  out = out ? path.resolve(out) : path.join(ROOT, '..', `calc1-deploy-${build}.zip`);
  if (fs.existsSync(out)) fs.unlinkSync(out);
  const z = list => execFileSync('zip', ['-qX', out].concat(list), { cwd: ROOT, stdio: 'inherit' });
  const exists = l => l.filter(f => fs.existsSync(rel(f)));
  z(exists(['index.html', 'build-check.js', '.htaccess', 'sw.js', 'robots.txt', 'sitemap.xml', 'README.md', '.well-known/security.txt']));
  z(['-r', 'assets', 'learn', 'scripts', '-x', '*/.DS_Store', '*/.gitignore', 'assets/app-boot.js', 'assets/app-native.js', 'assets/app.css', 'scripts/.last-release.json']);
  z(exists(['packs/README.md']).concat(fs.readdirSync(rel('packs')).filter(f => f.endsWith('.json')).map(f => 'packs/' + f)));
  z(fs.readdirSync(rel('api')).filter(f => f.endsWith('.php') && f !== 'config.local.php').map(f => 'api/' + f).concat(exists(['api/.htaccess', 'api/.user.ini']), fs.readdirSync(rel('api/classdata')).filter(f => f.endsWith('.json')).map(f => 'api/classdata/' + f)));
  const names = execFileSync('unzip', ['-Z1', out], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const leaks = names.filter(n => /config\.local|api\/data|^tests\/|^docs\/|DESIGN|PRODUCT|(^|\/)app\/|keystore|\.sqlite$/.test(n));
  if (leaks.length) { fs.unlinkSync(out); fail('these must never be in the zip: ' + leaks.join(', ')); }
  const body = execFileSync('unzip', ['-p', out], { maxBuffer: 1 << 30 });
  if (/sk_test|sk-ant-test|sk-openai-test|sk_v2_test|proj_test/.test(body.toString('latin1'))) { fs.unlinkSync(out); fail('a test key is inside the zip'); }
  const last = (() => { try { return JSON.parse(read('scripts/.last-release.json')); } catch (e) { return null; } })();
  const hash = apiHash(); const apiChanged = !last || last.api !== hash;
  write('scripts/.last-release.json', JSON.stringify({ build, api: hash, at: new Date().toISOString() }, null, 1) + '\n');
  console.log(`zip: ${out} (${names.length} files, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
  console.log(`api changed: ${apiChanged ? 'yes' : 'no'}${last ? ` (since ${last.build})` : ' (no earlier zip to compare with)'}`);
}

if (args[0] === '--check') { const ok = check(); process.exit(ok ? 0 : 1); }
const next = args.find(a => !a.startsWith('--'));
if (!next && !args.includes('--zip')) fail('usage: node scripts/release.js <build> [--zip [file]] | --check');
if (next) { bump(next); rebuild(); }
if (!check()) fail('the build stamps disagree (see above)');
if (args.includes('--zip')) { const i = args.indexOf('--zip'); const out = args[i + 1] && !args[i + 1].startsWith('--') && args[i + 1] !== next ? args[i + 1] : ''; zip(out); }
