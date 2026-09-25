#!/usr/bin/env node
/* ============================================================
   MatHub — social preview cards (1200×630 PNG)
   Renders assets/og.png (site) and assets/og-<class>.png (one per
   class, in the class colour) with headless Chromium, so links to
   the app and to /learn pages show a proper card on iMessage,
   Discord, Slack, Facebook and X.
   Run from calc1/ after adding a class:  node scripts/build-og.js
   Needs Playwright: `npm install` inside tests/ provides it.
   ============================================================ */
'use strict';
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(ROOT, 'tests', 'node_modules', 'playwright'))); }
global.window = {}; require(path.join(ROOT, 'assets', 'courses-index.js')); const Courses = window.Courses;
const ORDER = ['calc', 'physics', 'precalc', 'writ', 'csci'].filter(id => Courses[id]);
const COLORS = { site: ['#0f1f4d', '#2B55B8', '#0E7C86'], calc: ['#0f1f4d', '#2B55B8', '#4C7BE0'], physics: ['#063d44', '#0E7C86', '#2AA6B0'], precalc: ['#4a1a08', '#B5451B', '#E07A3F'], writ: ['#33153f', '#7A3E9D', '#A66BC7'], csci: ['#0f3a12', '#2E7D32', '#5AA85E'] };
const LOGO = '<svg width="96" height="96" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/><path d="M15 46V21l17 17 17-17v25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="49" cy="17" r="5" fill="#F2C14E"/></svg>';
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@500;600;700&display=swap" rel="stylesheet"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter,system-ui,sans-serif}
  .card{position:relative;width:1200px;height:630px;color:#fff;padding:64px 72px;box-sizing:border-box}
  .glow{position:absolute;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(242,193,78,.35),transparent 60%);right:-160px;top:-200px}
  .glow2{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 60%);left:-140px;bottom:-240px}
  .brand{display:flex;align-items:center;gap:22px}
  .brand b{font-family:Fraunces,serif;font-size:74px;font-weight:700;letter-spacing:-.02em;line-height:1}
  .brand i{font-style:italic;color:#F2C14E}
  .brand small{font-size:26px;font-weight:600;opacity:.85;margin-left:auto;letter-spacing:.06em;text-transform:uppercase}
  .tag{font-family:Fraunces,serif;font-size:44px;font-weight:600;line-height:1.15;margin-top:44px;max-width:960px;letter-spacing:-.01em}
  .tag.big{font-size:56px;margin-top:38px}
  .sub{font-size:24px;opacity:.9;margin-top:18px;max-width:900px;line-height:1.4}
  .chips{position:absolute;left:72px;bottom:64px;display:flex;gap:12px}
  .chip{padding:10px 18px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);font-weight:700;font-size:22px;letter-spacing:.01em}
  .url{position:absolute;right:72px;bottom:70px;font-size:24px;font-weight:600;opacity:.85}
  .card.cls .chips{bottom:122px} .card.cls .url{left:72px;right:auto;bottom:66px}
</style></head><body>`;
const card = (colors, inner, cls = '') => `${HEAD}<div class="card${cls ? ' ' + cls : ''}" style="background:linear-gradient(135deg,${colors[0]} 0%,${colors[1]} 55%,${colors[2]} 100%)"><div class="glow"></div><div class="glow2"></div>${inner}</div></body></html>`;
const site = card(COLORS.site, `<div class="brand">${LOGO}<b>Mat<i>Hub</i></b></div>
<div class="tag">Free study hub for Montana State classes</div>
<div class="sub">Topic notes, endless practice, flashcards, deadline calendars, simulators, a Python playground and a class board. Built by a Bobcat, for Bobcats.</div>
<div class="chips">${ORDER.map(c => `<span class="chip">${esc(Courses[c].code)}</span>`).join('')}</div><div class="url">mathub.space</div>`);
const classCard = c => { const C = Courses[c]; const bits = [`${C.sectionCount} topic guides`, C.flashcardCount ? `${C.flashcardCount} flashcards` : null, C.hasQuiz ? 'endless practice' : (C.READINGS ? 'read-along readings' : null), 'deadline calendar'].filter(Boolean);
  return card(COLORS[c] || COLORS.site, `<div class="brand">${LOGO}<b>Mat<i>Hub</i></b><small>Montana State · ${esc(C.term)}</small></div>
<div class="tag big">${esc(C.code)} · ${esc(C.name)}</div>
<div class="sub">${esc(C.tagline || '')}</div>
<div class="chips">${bits.map(b => `<span class="chip">${esc(b)}</span>`).join('')}</div><div class="url">mathub.space/learn/${c}</div>`, 'cls'); };
(async () => {
  const exe = process.env.MATHUB_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell') ? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const shots = [['og.png', site]].concat(ORDER.map(c => [`og-${c}.png`, classCard(c)]));
  for (const [name, html] of shots) { await page.setContent(html); await page.waitForTimeout(name === 'og.png' ? 1500 : 400); const out = path.join(ROOT, 'assets', name); await page.screenshot({ path: out, type: 'png' }); console.log(name, Math.round(fs.statSync(out).size / 1024) + ' KB'); }
  await browser.close();
})();
