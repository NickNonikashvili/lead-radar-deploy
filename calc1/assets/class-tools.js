/* ============================================================
   StudyCat — a Tools page for every class (October 2026)
   #/<class>/toolkit: the tools that class needs, one open at a time. Calculus gets Riemann sums and a limit
   table, Physics a formula solver and its constants, Biology a Punnett square and a chi-square test, Writing a
   word counter, citations and revision checklists, history a timeline you can be quizzed on…
   Where the list comes from, first match wins:
     1. the class's own TOOLS (a class you made: the class maker's Tools tab, or what Bo suggested from the syllabus);
     2. the curated kit for a Montana State class (assets/class-kits.js);
     3. a kit guessed from the class's subject (its code, CHMY or HSTR…, then its kind).
   On top, each student's own changes for that class: tools hidden, tools added, formulas of their own
   (settings → <class>.tools = { hide: [ids], add: [tools] }). Only they see them.
   A tool is data, never code: { kind, title?, desc?, …its settings }. Every expression is read by App.compileExpr
   (no eval), every text is escaped, and anything that does not make sense is dropped (clean() below).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, settings, courseSetting, setCourseSetting, compileExpr, pageHead } = App;
  let C = null; App.onCourse(c => { C = c; });

  /* ---------- small helpers ---------- */
  const str = (v, n = 120) => (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '';
  const fin = v => typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(App.parseNumber(v));
  const numv = v => typeof v === 'number' ? v : App.parseNumber(String(v == null ? '' : v));
  const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
  const sig = (v, n = 5) => { if (!Number.isFinite(v)) return '—'; if (v === 0) return '0'; const a = Math.abs(v); const s = a >= 1e9 || a < 1e-4 ? v.toExponential(n - 1).replace(/\.?0+e/, 'e').replace('e+', 'e') : String(Number(v.toPrecision(n))); return s.replace(/^-/, '−'); };
  const field = (id, label, val = '', extra = '') => `<div class="field"><label for="${id}">${label}</label><input class="input mono" id="${id}" value="${esc(String(val))}" autocomplete="off" spellcheck="false"${extra}></div>`;
  const draw = spec => { if (!App.boDraw) return ''; try { const sp = App.boDraw.parse(spec); return sp ? `<figure class="ct-fig">${App.boDraw.html(sp, false)}</figure>` : ''; } catch (e) { return ''; } };
  const nums = text => String(text || '').split(/[\s,;]+/).map(t => t.trim()).filter(Boolean).map(t => App.parseNumber(t)).filter(Number.isFinite).slice(0, 2000);
  const bad = msg => `<p class="ct-bad" role="alert">${msg}</p>`;
  const live = (root, fn) => { let tm = 0; const own = e => !(e.target && e.target.closest && e.target.closest('.ct-fig')); root.addEventListener('input', e => { if (own(e)) { clearTimeout(tm); tm = setTimeout(fn, 180); } }); root.addEventListener('change', e => { if (own(e)) fn(); }); fn(); };   // a slider inside the drawing moves the drawing, not the tool
  const store = (tool, k, v) => { if (!C) return; const all = Object.assign({}, courseSetting(C.id, 'toolData', {})); const key = tool.id + (k ? ':' + k : ''); if (v === undefined) return all[key]; all[key] = v; setCourseSetting(C.id, 'toolData', all); };

  /* ---------- names in a formula: v0, theta, C1… replaced by numbers; function names stay ---------- */
  const RESERVED = new Set('sin cos tan sec csc cot asin acos atan arcsin arccos arctan sinh cosh tanh exp ln log log10 log2 sqrt abs cbrt floor ceil e pi'.split(' '));
  const VAR_RE = /^[A-Za-z][A-Za-z0-9_]{0,11}$/;
  function names(src) { const out = []; String(src).replace(/(\d*\.?\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)/g, (m, n, w) => { if (w && !out.includes(w)) out.push(w); return m; }); return out; }
  function subst(src, map) {
    return String(src).replace(/(\d*\.?\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)/g, (m, n, w) => w && Object.prototype.hasOwnProperty.call(map, w) ? map[w] : m);
  }
  const sides = eq => { const k = String(eq).indexOf('='); return k < 0 ? [String(eq), '0'] : [String(eq).slice(0, k), String(eq).slice(k + 1)]; };
  /* every x where g(x) = 0: sign changes on a wide grid (or across [lo, hi]), each narrowed by halving; poles are not roots */
  function roots(g, lo, hi) {
    let xs = [];
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) for (let k = 0; k <= 800; k++) xs.push(lo + (hi - lo) * k / 800);
    else {
      const pos = []; for (let e = -6; e <= 9; e++) [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8.5].forEach(m => pos.push(m * 10 ** e));
      xs = pos.map(v => -v).reverse().concat([0], pos);
      if (Number.isFinite(lo)) xs = [lo].concat(xs.filter(x => x > lo)); if (Number.isFinite(hi)) xs = xs.filter(x => x < hi).concat([hi]);
    }
    const out = []; const add = r => { r = Math.abs(r - Math.round(r)) < 1e-10 ? Math.round(r) : r; if (!out.some(q => Math.abs(q - r) <= 1e-8 * Math.max(1, Math.abs(r)))) out.push(r); };
    const G = x => { try { return g(x); } catch (e) { return NaN; } };
    let px = xs[0], pv = G(px); if (pv === 0) add(px);
    for (let k = 1; k < xs.length && out.length < 12; k++) {
      const x = xs[k], v = G(x);
      if (v === 0) add(x);
      else if (Number.isFinite(v) && Number.isFinite(pv) && pv !== 0 && Math.sign(v) !== Math.sign(pv)) {
        let a = px, b = x, fa = pv;
        for (let it = 0; it < 200; it++) { const m = (a + b) / 2; if (m === a || m === b) break; const fm = G(m); if (!Number.isFinite(fm)) break; if (fm === 0) { a = b = m; break; } if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
        const r = (a + b) / 2, fr = G(r); if (Number.isFinite(fr) && Math.abs(fr) < Math.min(Math.abs(pv), Math.abs(v))) add(r);
      }
      px = x; pv = v;
    }
    return out.sort((a, b) => (a >= 0) !== (b >= 0) ? (a >= 0 ? -1 : 1) : Math.abs(a) - Math.abs(b));   // positive answers first, smallest first
  }

  /* ---------- the kinds ---------- */
  const K = {};
  const kind = (id, label, ic, desc, def) => { K[id] = Object.assign({ label, icon: ic, desc }, def); };

  kind('grapher', 'Grapher', 'chart', 'Graph up to three functions. Letters like a, b and c get sliders; drag to move, scroll to zoom, point to read.', {
    clean: (t, o) => { t.fns = arr(o.fns || (o.f ? [o.f] : null), 3).map(f => str(f, 140)).filter(Boolean); if (!t.fns.length) t.fns = ['sin(x)']; t.x = pair(o.x, [-10, 10]); t.y = o.y ? pair(o.y, [-6, 6]) : null; t.sliders = arr(o.sliders, 4).filter(x => x && typeof x === 'object' && /^[a-z]$/.test(String(x.name || ''))); },   // the drawing engine checks each slider's numbers
    html: t => `<div class="grid cols-3">${[0, 1, 2].map(i => field(`ctg-f${i}`, `${['First', 'Second', 'Third'][i]} function: y =`, t.fns[i] || '')).join('')}</div><div class="ct-out" id="ctg-out"></div>`,
    bind: (el, t) => live(el, () => { const fns = [0, 1, 2].map(i => $(`#ctg-f${i}`, el).value.trim()).filter(Boolean); const out = $('#ctg-out', el); if (!fns.length) { out.innerHTML = bad('Type a function of x, such as x^2 - 3 or a*sin(b*x).'); return; } const used = fns.flatMap(names); const sl = t.sliders.filter(x => used.includes(x.name)); out.innerHTML = draw(Object.assign({ type: 'graph', fns: fns.map(f => ({ f })), x: t.x }, t.y ? { y: t.y } : {}, sl.length ? { sliders: sl } : {})) || bad('That could not be drawn. Check the brackets, and write * between letters: a*x, not ax.'); App.typeset(out); })
  });
  kind('equation', 'Equation solver', 'target', 'Type an equation in x and get every solution, with the graph that shows them.', {
    clean: (t, o) => { t.eq = str(o.eq, 160) || 'x^3 - 2*x = 5'; t.x = o.x ? pair(o.x, [-10, 10]) : null; },
    html: t => `${field('cte-eq', 'Equation in x', t.eq)}<div class="ct-out" id="cte-out" aria-live="polite"></div>`,
    bind: (el, t) => live(el, () => {
      const out = $('#cte-out', el); const eq = $('#cte-eq', el).value.trim(); if (!eq) { out.innerHTML = ''; return; }
      const [L, R] = sides(eq); let g; try { g = compileExpr(`(${L})-(${R})`); } catch (e) { out.innerHTML = bad(esc(e.message)); return; }
      const lo = t.x ? t.x[0] : NaN, hi = t.x ? t.x[1] : NaN; const rs = roots(g, lo, hi);
      const vis = rs.filter(r => Math.abs(r) < 1e4); const span = vis.length ? Math.max(4, ...vis.map(r => Math.abs(r) * 1.4)) : 10;
      out.innerHTML = `${rs.length ? `<p class="ct-ans">${rs.slice(0, 8).map(r => `<b>x = ${sig(r, 6)}</b>`).join('<span class="ct-sep">·</span>')}</p>` : '<p class="ct-ans">No real solution found.</p>'}<p class="small muted">The solutions are where the left side minus the right side crosses zero.</p>${draw({ type: 'graph', fns: [{ f: `(${L})-(${R})`, label: 'left − right' }], x: t.x || [-span, span], points: vis.slice(0, 8).map(r => ({ x: r, y: 0 })) })}`;
    })
  });
  kind('solver', 'Formula solver', 'wand', 'Pick a formula, fill in what you know and leave one box empty: that is the one it finds.', {
    clean: (t, o) => {
      t.formulas = arr(o.formulas, 16).map(f => {
        if (!f || typeof f !== 'object') return null; const eq = str(f.eq, 220); if (!eq.includes('=')) return null;
        const vars = arr(f.vars, 10).map(v => Array.isArray(v) ? { s: str(v[0], 12), l: str(v[1], 80), u: str(v[2], 20), min: numv(v[3]), max: numv(v[4]) } : v && typeof v === 'object' ? { s: str(v.s || v.name || v.sym, 12), l: str(v.l || v.label, 80), u: str(v.u || v.unit, 20), min: numv(v.min), max: numv(v.max) } : null).filter(v => v && VAR_RE.test(v.s) && !RESERVED.has(v.s));
        const used = names(eq); if (used.some(w => !RESERVED.has(w) && !vars.some(v => v.s === w))) return null;   // a letter nobody explained: it could not be worked out
        const vs = vars.filter(v => used.includes(v.s)); if (vs.length < 2) return null;
        return { n: str(f.n || f.name, 70) || eq, eq, tex: str(f.tex, 240), note: str(f.note, 240), vars: vs };
      }).filter(Boolean);
      if (!t.formulas.length) return false;
    },
    html: t => `${t.formulas.length > 1 ? `<div class="field"><label for="cts-pick">Formula</label><select class="select" id="cts-pick">${t.formulas.map((f, i) => `<option value="${i}">${esc(f.n)}</option>`).join('')}</select></div>` : ''}<div id="cts-form"></div>`,
    bind: (el, t) => {
      const paint = () => {
        const f = t.formulas[+(($('#cts-pick', el) || {}).value || 0)] || t.formulas[0]; const box = $('#cts-form', el);
        box.innerHTML = `<div class="ct-eq">${f.tex ? `\\(${esc(f.tex)}\\)` : `<span class="mono">${esc(f.eq)}</span>`}</div>${f.note ? `<p class="small muted">${esc(f.note)}</p>` : ''}<p class="small">Fill in what you know and leave the one you want empty.</p>
          <div class="grid cols-2 ct-vars">${f.vars.map((v, i) => field(`cts-v${i}`, `<b class="mono">${esc(v.s)}</b>${v.l ? ` · ${esc(v.l)}` : ''}${v.u ? ` <span class="muted">(${esc(v.u)})</span>` : ''}`, '', ` inputmode="decimal" data-v="${i}"`)).join('')}</div>
          <div class="row gap-sm"><button class="btn primary" data-action="cts-go">${icon('wand', 14)} Solve</button><button class="btn ghost" data-action="cts-clear">Clear</button></div><div class="ct-out" id="cts-out" aria-live="polite"></div>`;
        App.typeset(box);
        const solve = () => {
          const out = $('#cts-out', box); const vals = f.vars.map((v, i) => $(`#cts-v${i}`, box).value.trim()); const empty = vals.map((x, i) => x ? -1 : i).filter(i => i >= 0);
          const badI = vals.findIndex(x => x && !Number.isFinite(App.parseNumber(x))); if (badI >= 0) { out.innerHTML = bad(`${esc(f.vars[badI].s)} is not a number. Fractions, powers and 2e-3 work.`); return; }
          const [L, R] = sides(f.eq); const map = {}; f.vars.forEach((v, i) => { if (vals[i]) map[v.s] = `(${App.parseNumber(vals[i])})`; });
          if (!empty.length) { let l, r; try { l = compileExpr(subst(L, map))(0); r = compileExpr(subst(R, map))(0); } catch (e) { out.innerHTML = bad(esc(e.message)); return; } const ok = Math.abs(l - r) <= 1e-6 * Math.max(1, Math.abs(l), Math.abs(r)); out.innerHTML = `<p class="ct-ans">${ok ? `${icon('check', 15)} These numbers fit the formula.` : 'These numbers do not fit the formula.'}</p><p class="small muted">Left side ${sig(l)}, right side ${sig(r)}. Empty one box to solve for it.</p>`; return; }
          if (empty.length > 1) { const which = empty.map(i => f.vars[i].s).join(', '); out.innerHTML = bad(`Leave just one box empty, not ${esc(which)}.`); return; }
          const u = f.vars[empty[0]]; map[u.s] = '(x)'; let g; try { g = compileExpr(subst(`(${L})-(${R})`, map)); } catch (e) { out.innerHTML = bad(esc(e.message)); return; }
          const rs = roots(g, u.min, u.max); if (!rs.length) { out.innerHTML = bad(`No value of ${esc(u.s)} fits these numbers${Number.isFinite(u.min) || Number.isFinite(u.max) ? ` between ${sig(u.min)} and ${sig(u.max)}` : ''}. Check the units and the signs.`); return; }
          const show = r => `<b class="mono">${esc(u.s)} = ${sig(r, 5)}</b>${u.u ? ` ${esc(u.u)}` : ''}`;
          out.innerHTML = `<p class="ct-ans">${show(rs[0])}</p>${rs.length > 1 ? `<p class="small">The formula also allows ${rs.slice(1, 4).map(show).join(', ')}. Pick the one that makes sense for the problem.</p>` : ''}<p class="small muted">${u.l ? esc(u.l) + '. ' : ''}Check: put it back in and both sides agree.</p>`;
          if (App.burst) App.burst($('.ct-ans', out), 'pop');
        };
        bind(box, { 'cts-go': solve, 'cts-clear': () => { $$('input', box).forEach(i => { i.value = ''; }); $('#cts-out', box).innerHTML = ''; const first = $('input', box); if (first) first.focus(); } });
        box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); solve(); } });
      };
      const pick = $('#cts-pick', el); if (pick) pick.addEventListener('change', paint); paint();
    }
  });
  kind('integral', 'Riemann sums', 'sigma', 'Left, right, midpoint, trapezoid and Simpson sums for any function, drawn as the rectangles they add up.', {
    clean: (t, o) => { t.f = str(o.f, 140) || 'x^2'; t.a = fin(o.a) ? numv(o.a) : 0; t.b = fin(o.b) ? numv(o.b) : 2; t.n = Math.max(1, Math.min(200, Math.round(numv(o.n)) || 4)); },
    html: t => `<div class="grid cols-4">${field('cti-f', 'f(x) =', t.f)}${field('cti-a', 'From a =', t.a)}${field('cti-b', 'To b =', t.b)}${field('cti-n', 'Pieces n =', t.n, ' inputmode="numeric"')}</div><div class="field"><label for="cti-r">Draw</label><select class="select" id="cti-r"><option value="left">Left endpoints</option><option value="right">Right endpoints</option><option value="mid" selected>Midpoints</option><option value="trap">Trapezoids</option></select></div><div class="ct-out" id="cti-out"></div>`,
    bind: el => live(el, () => {
      const out = $('#cti-out', el); let f; try { f = compileExpr($('#cti-f', el).value); } catch (e) { out.innerHTML = bad(esc(e.message)); return; }
      const a = App.parseNumber($('#cti-a', el).value), b = App.parseNumber($('#cti-b', el).value), n = Math.round(App.parseNumber($('#cti-n', el).value));
      if (![a, b].every(Number.isFinite) || !(n >= 1 && n <= 400) || a === b) { out.innerHTML = bad('Use two different numbers for a and b, and a whole number of pieces from 1 to 400.'); return; }
      const S = sums(f, a, b, n); const exact = sums(f, a, b, 2000).simpson; const rule = $('#cti-r', el).value;
      const rows = [['Left', S.left], ['Right', S.right], ['Midpoint', S.mid], ['Trapezoid', S.trap], [`Simpson${n % 2 ? ` (n = ${n + 1})` : ''}`, S.simpson]];
      out.innerHTML = `<table class="table compact ct-table"><thead><tr><th>Rule</th><th>Sum</th><th>Off by</th></tr></thead><tbody>${rows.map(([l, v]) => `<tr><td>${l}</td><td class="mono">${sig(v, 7)}</td><td class="mono muted">${sig(v - exact, 3)}</td></tr>`).join('')}<tr class="ct-best"><td>Integral (very fine Simpson)</td><td class="mono"><b>${sig(exact, 8)}</b></td><td></td></tr></tbody></table>${draw({ type: 'graph', fns: [{ f: $('#cti-f', el).value }], riemann: { f: $('#cti-f', el).value, from: a, to: b, n: Math.min(n, 60), rule }, x: [Math.min(a, b) - Math.abs(b - a) * 0.15, Math.max(a, b) + Math.abs(b - a) * 0.15] })}`;
    })
  });
  kind('limit', 'Limit table', 'zoomin', 'Close in on a point from both sides and see what the values settle on.', {
    clean: (t, o) => { t.f = str(o.f, 140) || 'sin(x)/x'; t.at = fin(o.at) ? str(o.at, 20) : /inf/i.test(String(o.at)) ? 'inf' : '0'; },
    html: t => `<div class="grid cols-2">${field('ctl-f', 'f(x) =', t.f)}${field('ctl-a', 'As x approaches (a number, or inf)', t.at)}</div><div class="ct-out" id="ctl-out"></div>`,
    bind: el => live(el, () => {
      const out = $('#ctl-out', el); let f; try { f = compileExpr($('#ctl-f', el).value); } catch (e) { out.innerHTML = bad(esc(e.message)); return; }
      const raw = $('#ctl-a', el).value.trim(); const inf = /^\+?(inf|infinity|∞)$/i.test(raw); const a = inf ? Infinity : App.parseNumber(raw);
      if (!inf && !Number.isFinite(a)) { out.innerHTML = bad('Type the number x approaches, such as 0, 2 or pi/2, or inf.'); return; }
      const hs = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6]; const X = inf ? [10, 100, 1e3, 1e4, 1e5, 1e6] : null;
      const left = inf ? X.map(x => f(-x)) : hs.map(h => f(a - h)), right = inf ? X.map(x => f(x)) : hs.map(h => f(a + h));
      const settle = v => { const [p, q, r] = v.slice(-3); if (![p, q, r].every(Number.isFinite)) return null; if (Math.abs(r) >= 1e5 && Math.abs(r) > Math.abs(q) * 2 && Math.abs(q) > Math.abs(p) * 2) return Math.sign(r) * Infinity; return Math.abs(r - q) <= 2e-3 * Math.max(1, Math.abs(r)) && Math.abs(q - p) <= 2e-2 * Math.max(1, Math.abs(q)) ? r : null; };
      const L = settle(left), R = settle(right); const name = v => v === Infinity ? '∞' : v === -Infinity ? '−∞' : nice(v);
      const verdict = inf ? (R == null ? 'As x grows, the values do not settle.' : `As x → ∞, f(x) → <b>${name(R)}</b>${L != null ? `; as x → −∞, f(x) → <b>${name(L)}</b>` : ''}.`)
        : L != null && R != null && (L === R || (Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= 1e-3 * Math.max(1, Math.abs(L)))) ? `Both sides head to <b>${name(R)}</b>, so the limit ${Number.isFinite(R) ? `is ${name(R)}` : `is ${name(R)} (it grows without bound)`}.`
        : L != null && R != null ? `From the left it heads to <b>${name(L)}</b>, from the right to <b>${name(R)}</b>. The sides disagree, so the limit does not exist.` : 'The values do not settle on one number (they may swing back and forth), so the table shows no limit.';
      const fa = inf ? NaN : f(a);
      out.innerHTML = `<p class="ct-ans">${verdict}</p>${inf ? '' : `<p class="small muted">${Number.isFinite(fa) ? `f(${sig(a)}) = ${sig(fa, 6)}` : `f(${sig(a)}) is undefined`}, and that does not change the limit: only the values near it count.</p>`}
        <table class="table compact ct-table"><thead><tr><th>${inf ? 'x' : 'Distance h'}</th><th>${inf ? 'f(−x)' : 'f(a − h)'}</th><th>${inf ? 'f(x)' : 'f(a + h)'}</th></tr></thead><tbody>${(inf ? X : hs).map((h, i) => `<tr><td class="mono">${sig(h)}</td><td class="mono">${sig(left[i], 8)}</td><td class="mono">${sig(right[i], 8)}</td></tr>`).join('')}</tbody></table>
        ${inf ? '' : draw({ type: 'graph', fns: [{ f: $('#ctl-f', el).value }], x: [a - 2, a + 2], vlines: [a] })}`;
    })
  });
  kind('series', 'Series explorer', 'layers', 'Type the nth term and watch the partial sums: do they settle on a number or keep going?', {
    clean: (t, o) => { t.term = str(o.term, 140) || '1/n^2'; t.from = Math.max(0, Math.min(5, Math.round(numv(o.from)) || 1)); },
    html: t => `<div class="grid cols-2">${field('ctr-a', 'nth term a(n) =', t.term)}${field('ctr-n', 'Start at n =', t.from, ' inputmode="numeric"')}</div><div class="ct-out" id="ctr-out"></div>`,
    bind: el => live(el, () => {
      const out = $('#ctr-out', el); let a; try { a = compileExpr(subst($('#ctr-a', el).value, { n: 'x' })); } catch (e) { out.innerHTML = bad(esc(e.message)); return; }
      const n0 = Math.max(0, Math.min(5, Math.round(App.parseNumber($('#ctr-n', el).value)) || 0)); const S = []; let s = 0, okAll = true;
      for (let n = n0; n < n0 + 20000; n++) { const v = a(n); if (!Number.isFinite(v)) { okAll = false; break; } s += v; S.push(s); }
      if (!okAll || S.length < 1000) { out.innerHTML = bad('A term is undefined (a division by zero?). Try starting at n = 1.'); return; }
      const at = N => S[N - 1]; let aN = 0; for (let k = 19800; k < 20000; k++) aN = Math.max(aN, Math.abs(a(n0 + k))); const ratio = Math.abs(a(n0 + 1001) / a(n0 + 1000));
      const d1 = Math.abs(at(20000) - at(2000)), d0 = Math.abs(at(2000) - at(200));
      const verdict = aN > 1e-3 ? `The terms do not shrink to 0 (after 20,000 terms they are still as big as ${sig(aN, 3)}), so the series <b>diverges</b> (the nth-term test).`
        : Number.isFinite(ratio) && ratio < 0.97 ? `Each term is about ${sig(ratio, 3)} times the one before, so it <b>converges</b> (ratio test), to about <b>${sig(at(20000), 8)}</b>.`
        : d1 < d0 / 4 || d1 < 1e-9 ? `The partial sums are settling, slowly, near <b>${sig(at(20000), 6)}</b>: this looks like a series that <b>converges</b>.`
        : 'After 20,000 terms the partial sums are still growing, like the harmonic series. A table cannot tell a very slow series from one that diverges: settle it with a test (comparison, integral or p-series).';
      const marks = [1, 2, 3, 4, 5, 10, 100, 1000, 10000];
      out.innerHTML = `<p class="ct-ans">${verdict}</p><p class="small muted">The numbers are evidence, not a proof: name the test that proves it.</p><table class="table compact ct-table"><thead><tr><th>Terms</th><th>Last term</th><th>Partial sum</th></tr></thead><tbody>${marks.map(N => `<tr><td class="mono">${N}</td><td class="mono">${sig(a(n0 + N - 1), 6)}</td><td class="mono">${sig(at(N), 9)}</td></tr>`).join('')}</tbody></table>${draw({ type: 'scatter', points: S.slice(0, 25).map((v, i) => [i + 1, v]), fit: false, r: false, xlabel: 'terms', ylabel: 'partial sum' })}`;
    })
  });
  kind('unitcircle', 'Unit circle', 'compass', 'Any angle: radians, its reference angle, and exact sine, cosine and tangent.', {
    clean: (t, o) => { t.angle = fin(o.angle) ? numv(o.angle) : 150; },
    html: t => `<div class="grid cols-2">${field('ctu-a', 'Angle', t.angle, ' inputmode="decimal"')}<div class="field"><label for="ctu-u">In</label><select class="select" id="ctu-u"><option value="deg">degrees</option><option value="rad">radians (pi/6, 2.1…)</option></select></div></div><input type="range" class="ct-range" id="ctu-s" min="0" max="360" step="15" value="${Math.round(((t.angle % 360) + 360) % 360)}" aria-label="Angle in degrees"><div class="ct-out" id="ctu-out"></div>`,
    bind: el => {
      const inp = $('#ctu-a', el), unit = $('#ctu-u', el), sl = $('#ctu-s', el);
      sl.addEventListener('input', () => { unit.value = 'deg'; inp.value = sl.value; });
      live(el, () => {
        const out = $('#ctu-out', el); const v = App.parseNumber(inp.value); if (!Number.isFinite(v)) { out.innerHTML = bad('Type an angle such as 225, -30 or 3pi/4.'); return; }
        const d = unit.value === 'rad' ? v * 180 / Math.PI : v; const n = ((d % 360) + 360) % 360; const q = n % 90 === 0 ? 'on an axis' : `quadrant ${['I', 'II', 'III', 'IV'][Math.floor(n / 90)]}`;
        const ref = n <= 90 ? n : n <= 180 ? 180 - n : n <= 270 ? n - 180 : 360 - n; const ex = exact(n);
        const rows = [['cos θ', ex ? ex.c : sig(Math.cos(d * Math.PI / 180), 6)], ['sin θ', ex ? ex.s : sig(Math.sin(d * Math.PI / 180), 6)], ['tan θ', ex ? ex.t : Math.abs(Math.cos(d * Math.PI / 180)) < 1e-12 ? 'undefined' : sig(Math.tan(d * Math.PI / 180), 6)]];
        out.innerHTML = `<div class="grid cols-2 ct-uc"><div>${draw({ type: 'unitcircle', angles: [0, 90, 180, 270], highlight: n, labels: 'deg' })}</div><div><table class="table compact ct-table"><tbody><tr><td>Degrees</td><td class="mono">${sig(d, 6)}°${n !== d ? ` (same spot as ${sig(n, 6)}°)` : ''}</td></tr><tr><td>Radians</td><td class="mono">${radName(d)}</td></tr><tr><td>Where</td><td>${q}</td></tr><tr><td>Reference angle</td><td class="mono">${sig(ref, 6)}°</td></tr>${rows.map(([k, x]) => `<tr><td>${k}</td><td class="mono"><b>${x}</b></td></tr>`).join('')}</tbody></table>${ex ? '<p class="small muted">An exact value: a special angle.</p>' : ''}</div></div>`;
      });
    }
  });
  kind('calculator', 'Calculator', 'calc', 'Scientific, in degrees or radians, with this class’s constants a tap away.', {
    clean: (t, o) => { t.consts = arr(o.consts, 10).map(c => Array.isArray(c) && fin(c[1]) ? [str(c[0], 12), str(c[1], 30), str(c[2], 60)] : null).filter(c => c && c[0]); },
    html: t => `${t.consts.length ? `<div class="ct-consts" role="group" aria-label="Constants">${t.consts.map(([n, v, l]) => `<button class="chip" data-ct-const="${esc(v)}" title="${esc(l || n)}">${esc(n)} = ${esc(v)}</button>`).join('')}</div>` : ''}${App.utilTools ? App.utilTools.calc[0]() : ''}`,
    bind: el => { if (!App.utilTools) return; App.utilTools.calc[1](el); $$('[data-ct-const]', el).forEach(b => b.addEventListener('click', () => { const inp = $('#tc-in', el); const v = `(${b.dataset.ctConst})`; const at = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, at) + v + inp.value.slice(inp.selectionEnd ?? at); inp.focus(); inp.setSelectionRange(at + v.length, at + v.length); })); }
  });
  kind('units', 'Unit converter', 'swap', 'Convert between units; the table lists every unit at once.', {
    clean: (t, o) => { const all = App.utilTools ? App.utilTools.unitCats : []; t.cats = arr(o.cats, 14).filter(c => all.includes(c)); },
    html: t => App.utilTools ? App.utilTools.units[0](t.cats) : '', bind: el => { if (App.utilTools) App.utilTools.units[1](el); }
  });
  kind('sigfigs', 'Sig figs', 'sigma', 'Count significant figures and round to any number of them.', { html: () => App.utilTools ? App.utilTools.sig[0]() : '', bind: el => { if (App.utilTools) App.utilTools.sig[1](el); } });
  kind('cite', 'Citations', 'quill', 'MLA 9 and APA 7 for a website, a book or an article.', { html: () => App.utilTools ? App.utilTools.cite[0]() : '', bind: el => { if (App.utilTools) App.utilTools.cite[1](el); } });
  kind('wordcount', 'Word counter', 'pen', 'Words, sentences, reading time and readability. Nothing leaves your browser.', { html: () => App.utilTools ? App.utilTools.words[0]() : '', bind: el => { if (App.utilTools) App.utilTools.words[1](el); } });
  kind('stats', 'Statistics', 'pie', 'Paste numbers: mean, median, spread, quartiles and outliers, with a box plot and a histogram.', {
    clean: (t, o) => { t.data = arr(o.data, 500).map(numv).filter(Number.isFinite); if (!t.data.length) t.data = [12, 15, 15, 18, 20, 21, 22, 22, 22, 25, 27, 30, 41]; t.label = str(o.label, 40); },
    html: t => `<div class="field"><label for="ctt-in">Numbers${t.label ? ` (${esc(t.label)})` : ''}, separated by spaces, commas or new lines</label><textarea class="input mono" id="ctt-in" rows="3">${esc(t.data.join(', '))}</textarea></div><div class="ct-out" id="ctt-out"></div>`,
    bind: el => live(el, () => {
      const out = $('#ctt-out', el); const d = nums($('#ctt-in', el).value).sort((a, b) => a - b); if (d.length < 2) { out.innerHTML = bad('Paste at least two numbers.'); return; }
      const n = d.length, mean = d.reduce((s, v) => s + v, 0) / n, med = median(d); const lo = d.slice(0, Math.floor(n / 2)), hi = d.slice(Math.ceil(n / 2)); const q1 = median(lo), q3 = median(hi), iqr = q3 - q1;
      const ss = d.reduce((s, v) => s + (v - mean) ** 2, 0); const sd = Math.sqrt(ss / (n - 1)), psd = Math.sqrt(ss / n);
      const cnt = {}; d.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; }); const top = Math.max(...Object.values(cnt)); const modes = top > 1 ? Object.keys(cnt).filter(k => cnt[k] === top).map(Number) : [];
      const outl = d.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
      const k = Math.min(12, Math.max(4, Math.ceil(Math.log2(n) + 1))); const w = (d[n - 1] - d[0]) / k || 1; const bins = Array.from({ length: k }, (_, i) => [`${sig(d[0] + i * w, 3)}–${sig(d[0] + (i + 1) * w, 3)}`, 0]); d.forEach(v => { bins[Math.min(k - 1, Math.floor((v - d[0]) / w))][1]++; });
      const rows = [['Count n', n], ['Mean', mean], ['Median', med], ['Mode', modes.length ? modes.slice(0, 4).map(v => sig(v)).join(', ') : 'none (no value repeats)'], ['Standard deviation s (sample)', sd], ['σ (whole population)', psd], ['Minimum', d[0]], ['Q1', q1], ['Q3', q3], ['Maximum', d[n - 1]], ['Range', d[n - 1] - d[0]], ['IQR', iqr]];
      out.innerHTML = `<div class="grid cols-2"><table class="table compact ct-table"><tbody>${rows.map(([l, v]) => `<tr><td>${l}</td><td class="mono"><b>${typeof v === 'number' ? sig(v, 6) : v}</b></td></tr>`).join('')}<tr><td>Outliers (1.5 × IQR rule)</td><td class="mono">${outl.length ? outl.slice(0, 8).map(v => sig(v)).join(', ') : 'none'}</td></tr></tbody></table><div>${draw({ type: 'boxplot', data: d.slice(0, 500) })}${draw({ type: 'bars', hist: true, bars: bins })}</div></div><p class="small muted">Q1 and Q3 are the medians of the lower and upper halves, as a TI-84 finds them.</p>`;
    })
  });
  kind('scatter', 'Best-fit line', 'target', 'Paste x, y pairs: the scatter plot, the least-squares line, r and r², and a prediction.', {
    clean: (t, o) => { t.points = arr(o.points, 200).map(p => Array.isArray(p) && fin(p[0]) && fin(p[1]) ? [numv(p[0]), numv(p[1])] : null).filter(Boolean); if (t.points.length < 2) t.points = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1], [6, 12.2]]; t.xl = str(o.xlabel, 30); t.yl = str(o.ylabel, 30); },
    html: t => `<div class="field"><label for="ctx-in">One pair per line: x, y${t.xl ? ` (${esc(t.xl)}, ${esc(t.yl)})` : ''}</label><textarea class="input mono" id="ctx-in" rows="5">${esc(t.points.map(p => p.join(', ')).join('\n'))}</textarea></div>${field('ctx-p', 'Predict y at x =', '')}<div class="ct-out" id="ctx-out"></div>`,
    bind: (el, t) => live(el, () => {
      const out = $('#ctx-out', el); const P = $('#ctx-in', el).value.split('\n').map(l => nums(l)).filter(p => p.length >= 2).map(p => [p[0], p[1]]).slice(0, 200);
      if (P.length < 2) { out.innerHTML = bad('Paste at least two pairs, one per line, like 3, 4.5'); return; }
      const n = P.length, mx = P.reduce((s, p) => s + p[0], 0) / n, my = P.reduce((s, p) => s + p[1], 0) / n; let sxx = 0, syy = 0, sxy = 0; P.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
      if (sxx < 1e-12) { out.innerHTML = bad('Every x is the same, so there is no line to fit.'); return; }
      const b = sxy / sxx, a = my - b * mx, r = syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : NaN; const px = App.parseNumber($('#ctx-p', el).value);
      const strength = !Number.isFinite(r) ? '' : Math.abs(r) >= 0.8 ? 'strong' : Math.abs(r) >= 0.5 ? 'moderate' : Math.abs(r) >= 0.3 ? 'weak' : 'little or no';
      out.innerHTML = `<p class="ct-ans"><b class="mono">ŷ = ${sig(a, 5)} ${b < 0 ? '−' : '+'} ${sig(Math.abs(b), 5)}x</b><span class="ct-sep">·</span>r = ${sig(r, 4)}<span class="ct-sep">·</span>r² = ${sig(r * r, 4)}</p><p class="small">${strength ? `A ${strength} ${b >= 0 ? 'positive' : 'negative'} straight-line relationship: ${sig(r * r * 100, 3)}% of the spread in y goes with x.` : ''} ${Number.isFinite(px) ? `At x = ${sig(px)}, the line predicts y = <b>${sig(a + b * px, 5)}</b>${px < Math.min(...P.map(p => p[0])) || px > Math.max(...P.map(p => p[0])) ? ' (outside your data: extrapolation, so be careful)' : ''}.` : ''}</p><p class="small muted">Correlation is not causation: a third thing may move both.</p>${draw({ type: 'scatter', points: P, fit: true, r: false, xlabel: t.xl, ylabel: t.yl, predict: Number.isFinite(px) ? px : undefined })}`;
    })
  });
  kind('chisq', 'Chi-square test', 'flask', 'Observed counts against an expected ratio (9:3:3:1, 3:1…): χ², degrees of freedom and the p-value.', {
    clean: (t, o) => { t.cats = arr(o.cats, 12).map(c => Array.isArray(c) ? [str(c[0], 30), fin(c[1]) ? numv(c[1]) : 0, fin(c[2]) ? numv(c[2]) : 1] : null).filter(Boolean); if (t.cats.length < 2) t.cats = [['round, yellow', 315, 9], ['round, green', 108, 3], ['wrinkled, yellow', 101, 3], ['wrinkled, green', 32, 1]]; },
    html: t => `<p class="small">Each row: a category, how many you counted, and its share of the expected ratio.</p><div class="ct-rows" id="ctc-rows">${t.cats.map(c => chiRow(c)).join('')}</div><div class="row gap-sm"><button class="btn sm" data-action="ctc-add">${icon('plus', 13)} Add a category</button></div><div class="ct-out" id="ctc-out"></div>`,
    bind: el => {
      bind(el, { 'ctc-add': () => { const rows = $('#ctc-rows', el); if (rows.children.length < 12) { rows.insertAdjacentHTML('beforeend', chiRow(['', '', 1])); } }, 'ctc-del': b => { const rows = $('#ctc-rows', el); if (rows.children.length > 2) { b.closest('.ct-row').remove(); el.dispatchEvent(new Event('input')); } } });
      live(el, () => {
        const out = $('#ctc-out', el); const rows = $$('.ct-row', el).map(r => [$('[data-c="n"]', r).value.trim() || '—', App.parseNumber($('[data-c="o"]', r).value), App.parseNumber($('[data-c="e"]', r).value)]);
        if (rows.some(r => !Number.isFinite(r[1]) || r[1] < 0 || !Number.isFinite(r[2]) || r[2] <= 0)) { out.innerHTML = bad('Every row needs a count (0 or more) and an expected share above 0.'); return; }
        const N = rows.reduce((s, r) => s + r[1], 0), W = rows.reduce((s, r) => s + r[2], 0); if (!N) { out.innerHTML = bad('Add your counts.'); return; }
        const E = rows.map(r => N * r[2] / W); const parts = rows.map((r, i) => (r[1] - E[i]) ** 2 / E[i]); const X = parts.reduce((s, v) => s + v, 0); const df = rows.length - 1; const p = 1 - gammaP(df / 2, X / 2);
        const crit = [3.841, 5.991, 7.815, 9.488, 11.07, 12.592, 14.067, 15.507, 16.919, 18.307, 19.675][df - 1];
        out.innerHTML = `<table class="table compact ct-table"><thead><tr><th>Category</th><th>Observed</th><th>Expected</th><th>(O − E)²/E</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${esc(r[0])}</td><td class="mono">${sig(r[1])}</td><td class="mono">${sig(E[i], 5)}</td><td class="mono">${sig(parts[i], 4)}</td></tr>`).join('')}</tbody></table>
          <p class="ct-ans">χ² = <b class="mono">${sig(X, 4)}</b><span class="ct-sep">·</span>df = ${df}<span class="ct-sep">·</span>p = <b class="mono">${p < 1e-4 ? '< 0.0001' : sig(p, 3)}</b></p>
          <p class="small">${p >= 0.05 ? `p is above 0.05${crit ? ` (χ² is below the critical value ${crit})` : ''}: the counts fit the expected ratio, and the differences are what chance alone would give. You fail to reject the null hypothesis.` : `p is below 0.05${crit ? ` (χ² is above the critical value ${crit})` : ''}: the counts differ from the expected ratio more than chance would explain. You reject the null hypothesis.`}</p>${E.some(e => e < 5) ? '<p class="small muted">An expected count is under 5, so the test is not reliable here.</p>' : ''}`;
      });
    }
  });
  kind('punnett', 'Punnett square', 'grid', 'Cross two parents (Aa × Aa, AaBb × aabb…): the square, the genotypes and the phenotype ratio.', {
    clean: (t, o) => { const ok = g => /^[A-Za-z]{2,6}$/.test(g) && g.length % 2 === 0; t.p1 = ok(str(o.p1, 6)) ? str(o.p1, 6) : 'Aa'; t.p2 = ok(str(o.p2, 6)) ? str(o.p2, 6) : 'Aa'; t.traits = o.traits && typeof o.traits === 'object' ? Object.fromEntries(Object.entries(o.traits).slice(0, 3).map(([k, v]) => [str(k, 1), [str((v || [])[0], 30), str((v || [])[1], 30)]])) : {}; },
    html: t => `<div class="grid cols-2">${field('ctp-1', 'Parent 1', t.p1)}${field('ctp-2', 'Parent 2', t.p2)}</div><p class="small muted">One pair of letters per gene; a capital letter is dominant. Up to three genes, like AaBbCc.</p><div class="ct-out" id="ctp-out"></div>`,
    bind: (el, t) => live(el, () => {
      const out = $('#ctp-out', el); const a = $('#ctp-1', el).value.trim(), b = $('#ctp-2', el).value.trim();
      const genes = g => { if (!/^[A-Za-z]{2,6}$/.test(g) || g.length % 2) return null; const out = []; for (let i = 0; i < g.length; i += 2) { if (g[i].toLowerCase() !== g[i + 1].toLowerCase()) return null; out.push([g[i], g[i + 1]]); } return out; };
      const A = genes(a), B = genes(b);
      if (!A || !B || A.length !== B.length || A.some((g, i) => g[0].toLowerCase() !== B[i][0].toLowerCase())) { out.innerHTML = bad('Write both parents with the same genes, a pair of letters each: Aa × aa, or AaBb × AaBb.'); return; }
      const gam = G => G.reduce((acc, pair) => { const nx = []; acc.forEach(s => pair.forEach(x => nx.push(s + x))); return nx; }, ['']);
      const geno = (x, y) => x.split('').map((ch, i) => [ch, y[i]].sort((p, q) => (p === p.toUpperCase() ? 0 : 1) - (q === q.toUpperCase() ? 0 : 1)).join('')).join('');
      const g1 = gam(A), g2 = gam(B); const G = {}, P = {};
      const pheno = gt => gt.match(/../g).map(pr => { const L = pr[0].toUpperCase(); const dom = pr !== pr.toLowerCase(); const tr = t.traits[L] || t.traits[L.toLowerCase()]; return tr && tr[0] ? (dom ? tr[0] : tr[1] || 'recessive') : dom ? `${L}_` : pr.toLowerCase(); }).join(', ');
      const cells = g2.map(y => g1.map(x => { const gt = geno(x, y); G[gt] = (G[gt] || 0) + 1; const ph = pheno(gt); P[ph] = (P[ph] || 0) + 1; return gt; }));
      const tot = g1.length * g2.length; const gcd = (p, q) => q ? gcd(q, p % q) : p; const ratio = o => { const v = Object.values(o); const gg = v.reduce(gcd); return v.map(x => x / gg).join(' : '); };
      const sortK = o => Object.entries(o).sort((p, q) => q[1] - p[1]);
      out.innerHTML = `<div class="ct-scroll"><table class="table compact ct-punnett"><thead><tr><th scope="col"><span class="sr-only">Gametes</span></th>${g1.map(x => `<th scope="col" class="mono">${esc(x)}</th>`).join('')}</tr></thead><tbody>${cells.map((row, j) => `<tr><th scope="row" class="mono">${esc(g2[j])}</th>${row.map(c => `<td class="mono">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="grid cols-2"><div><h3 class="ct-h">Genotypes</h3><ul class="list">${sortK(G).map(([k, v]) => `<li><b class="mono">${esc(k)}</b>: ${v}/${tot} (${sig(v / tot * 100, 3)}%)</li>`).join('')}</ul><p class="small muted">Ratio ${ratio(G)}</p></div><div><h3 class="ct-h">Phenotypes</h3><ul class="list">${sortK(P).map(([k, v]) => `<li><b>${esc(k)}</b>: ${v}/${tot} (${sig(v / tot * 100, 3)}%)</li>`).join('')}</ul><p class="small muted">Ratio ${ratio(P)}${Object.keys(t.traits).length ? '' : '. A_ means at least one dominant A.'}</p></div></div>`;
    })
  });
  kind('base', 'Number bases', 'keyboard', 'Binary, octal, decimal and hexadecimal, with the bits grouped and the character a number stands for.', {
    html: () => `<div class="grid cols-2">${field('ctb-v', 'Number', '202')}<div class="field"><label for="ctb-b">Written in</label><select class="select" id="ctb-b"><option value="10">decimal (base 10)</option><option value="2">binary (base 2)</option><option value="8">octal (base 8)</option><option value="16">hexadecimal (base 16)</option></select></div></div><div class="ct-out" id="ctb-out"></div>`,
    bind: el => live(el, () => {
      const out = $('#ctb-out', el); const raw = $('#ctb-v', el).value.trim().replace(/[\s_]/g, '').replace(/^0[bxo]/i, ''); const base = +$('#ctb-b', el).value; const neg = raw.startsWith('-'); const digits = neg ? raw.slice(1) : raw;
      const ok = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i }[base]; if (!digits || !ok.test(digits) || digits.length > 64) { out.innerHTML = bad(`That is not a whole number in base ${base}.`); return; }
      let v = 0n; for (const ch of digits.toLowerCase()) v = v * BigInt(base) + BigInt(parseInt(ch, 16)); const sgn = neg && v ? '−' : '';
      const bin = v.toString(2).replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
      const two = neg && v <= 128n ? ((256n - v) & 255n).toString(2).padStart(8, '0') : !neg && v < 256n ? v.toString(2).padStart(8, '0') : '';
      const ch = !neg && v >= 32n && v <= 126n ? String.fromCharCode(Number(v)) : '';
      out.innerHTML = `<table class="table compact ct-table"><tbody><tr><td>Decimal</td><td class="mono"><b>${sgn}${v.toString(10)}</b></td></tr><tr><td>Binary</td><td class="mono"><b>${sgn}${bin}</b></td></tr><tr><td>Octal</td><td class="mono"><b>${sgn}${v.toString(8)}</b></td></tr><tr><td>Hexadecimal</td><td class="mono"><b>${sgn}${v.toString(16).toUpperCase()}</b></td></tr><tr><td>Bits needed</td><td class="mono">${v ? v.toString(2).length : 1}</td></tr>${two ? `<tr><td>One byte${neg ? ' (two’s complement)' : ''}</td><td class="mono">${two}</td></tr>` : ''}${ch ? `<tr><td>Character (ASCII)</td><td class="mono">'${esc(ch)}' · chr(${v})</td></tr>` : ''}</tbody></table><p class="small muted">In Python: bin(${sgn ? '-' : ''}${v}), oct(…), hex(…), and int('${esc(digits)}', ${base}) goes back.</p>`;
    })
  });
  kind('timeline', 'Timeline', 'clock', 'The class’s dates in order. Search them, add your own, or get quizzed on the order.', {
    clean: (t, o) => { t.events = arr(o.events, 120).map(e => Array.isArray(e) ? [str(e[0], 40), str(e[1], 200)] : e && typeof e === 'object' ? [str(e.when || e.date || e.year, 40), str(e.what || e.text || e.event, 200)] : null).filter(e => e && e[0] && e[1] && Number.isFinite(yearOf(e[0]))); },
    html: () => `<div class="row gap-sm ct-tl-bar">${field('ctl-q', 'Search', '', ' type="search" placeholder="Edo, 1868, Westphalia…"')}<button class="btn" data-action="tl-quiz">${icon('d20', 14)} Quiz me on the order</button></div><div id="tl-quiz"></div><ol class="ct-tl" id="tl-list"></ol>
      <details class="ct-add"><summary>${icon('plus', 13)} Add a date of your own</summary><div class="grid cols-2">${field('ctl-w', 'When (1603, 1603–1868, 300 BCE)', '')}${field('ctl-e', 'What happened', '')}</div><button class="btn sm" data-action="tl-add">Add it</button></details>`,
    bind: (el, t) => {
      const mine = () => (store(t, 'mine') || []).filter(e => Array.isArray(e) && Number.isFinite(yearOf(e[0])));
      const all = () => t.events.map(e => e.concat([0])).concat(mine().map(e => [e[0], e[1], 1])).sort((a, b) => yearOf(a[0]) - yearOf(b[0]));
      const paint = () => { const q = $('#ctl-q', el).value.trim().toLowerCase(); const list = all().filter(e => !q || (e[0] + ' ' + e[1]).toLowerCase().includes(q)); $('#tl-list', el).innerHTML = list.length ? list.map(e => `<li${e[2] ? ' class="mine"' : ''}><b class="mono">${esc(e[0])}</b><span>${esc(e[1])}</span>${e[2] ? `<button class="icon-btn xs" data-action="tl-del" data-k="${esc(e[0] + '|' + e[1])}" aria-label="Remove this date" title="Remove">${icon('x', 12)}</button>` : ''}</li>`).join('') : `<li class="muted">${t.events.length || mine().length ? 'Nothing matches.' : 'No dates yet: add the ones from your readings below.'}</li>`; };
      $('#ctl-q', el).addEventListener('input', paint);
      bind(el, {
        'tl-add': () => { const w = $('#ctl-w', el).value.trim(), e = $('#ctl-e', el).value.trim(); if (!w || !e || !Number.isFinite(yearOf(w))) { App.toast('Give a year (1603, 300 BCE) and what happened.'); return; } store(t, 'mine', mine().concat([[w.slice(0, 40), e.slice(0, 200)]]).slice(-80)); $('#ctl-w', el).value = ''; $('#ctl-e', el).value = ''; paint(); },
        'tl-del': b => { store(t, 'mine', mine().filter(e => e[0] + '|' + e[1] !== b.dataset.k)); paint(); },
        'tl-quiz': () => {
          const pool = all().filter((e, i, a) => a.findIndex(x => yearOf(x[0]) === yearOf(e[0])) === i); const box = $('#tl-quiz', el); if (pool.length < 4) { box.innerHTML = bad('The quiz needs at least four dates with different years.'); return; }
          const pick = pool.slice().sort(() => Math.random() - 0.5).slice(0, 4); let order = pick.slice().sort(() => Math.random() - 0.5);
          const show = (done) => { box.innerHTML = `<div class="callout ct-quiz"><p class="small"><b>Put these in order, earliest first.</b></p><ol class="ct-order">${order.map((e, i) => `<li><span>${esc(e[1])}${done ? ` <b class="mono">(${esc(e[0])})</b>` : ''}</span>${done ? '' : `<span class="row gap-sm"><button class="icon-btn xs" data-action="tl-up" data-i="${i}" aria-label="Move up"${i ? '' : ' disabled'}>${icon('up', 12)}</button><button class="icon-btn xs" data-action="tl-dn" data-i="${i}" aria-label="Move down"${i < 3 ? '' : ' disabled'}>${icon('down', 12)}</button></span>`}</li>`).join('')}</ol>${done ? `<p class="ct-ans">${done}</p>` : `<button class="btn sm primary" data-action="tl-check">Check</button>`}</div>`; };
          box.onclick = e => { const b = e.target.closest('[data-action]'); if (!b) return; e.stopPropagation(); const i = +b.dataset.i; if (b.dataset.action === 'tl-up' && i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; show(); } else if (b.dataset.action === 'tl-dn' && i < 3) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; show(); } else if (b.dataset.action === 'tl-check') { const right = order.every((x, k) => k === 0 || yearOf(order[k - 1][0]) <= yearOf(x[0])); order = order.slice().sort((p, q) => yearOf(p[0]) - yearOf(q[0])); show(right ? `${icon('check', 15)} All in order.` : 'Not quite. Here is the right order.'); } };
          show();
        }
      });
      paint();
    }
  });
  kind('checklist', 'Checklist', 'check', 'Tick off criteria as you go.', {
    clean: (t, o) => { t.sets = arr(o.sets, 8).map(s => s && typeof s === 'object' ? { name: str(s.name, 60), items: arr(s.items, 24).map(i => str(i, 220)).filter(Boolean), need: Math.max(0, Math.min(24, Math.round(numv(s.need)) || 0)), note: str(s.note, 300) } : null).filter(s => s && s.name && s.items.length); if (!t.sets.length) return false; t.warn = str(o.warn, 240); },
    html: t => `${t.warn ? `<div class="callout ct-warn">${icon('info', 14)} ${esc(t.warn)}</div>` : ''}${t.sets.length > 1 ? `<div class="row gap-sm ct-sets" role="group" aria-label="Which list">${t.sets.map((s, i) => `<button class="chip toggle${i ? '' : ' on'}" data-action="ck-set" data-i="${i}">${esc(s.name)}</button>`).join('')}</div>` : ''}<div id="ck-box"></div>`,
    bind: (el, t) => {
      let cur = 0;
      const paint = () => {
        const s = t.sets[cur]; const ticks = store(t, s.name) || []; const n = s.items.filter((x, i) => ticks.includes(i)).length;
        $('#ck-box', el).innerHTML = `${s.note ? `<p class="small">${esc(s.note)}</p>` : ''}<ul class="ct-ck">${s.items.map((x, i) => `<li><label><input type="checkbox" data-i="${i}"${ticks.includes(i) ? ' checked' : ''}> <span>${esc(x)}</span></label></li>`).join('')}</ul>
          <p class="ct-ans" aria-live="polite">${n} of ${s.items.length} ticked${s.need ? `: ${n >= s.need ? `${icon('check', 14)} that meets the count of ${s.need}` : `the count needed is ${s.need}`}` : n === s.items.length ? ` ${icon('check', 14)}` : ''}</p><button class="btn sm ghost" data-action="ck-clear">Untick all</button>`;
      };
      el.addEventListener('change', e => { if (!e.target.matches('.ct-ck input')) return; const s = t.sets[cur]; const ticks = $$('.ct-ck input', el).filter(x => x.checked).map(x => +x.dataset.i); store(t, s.name, ticks); paint(); });
      bind(el, { 'ck-set': b => { cur = +b.dataset.i; $$('[data-action="ck-set"]', el).forEach(x => x.classList.toggle('on', x === b)); paint(); }, 'ck-clear': () => { store(t, t.sets[cur].name, []); paint(); } });
      paint();
    }
  });
  kind('matrix', 'Decision matrix', 'table', 'Score each option against weighted criteria; the best total wins. Your scores are kept for this class.', {
    clean: (t, o) => { t.options = arr(o.options, 6).map(x => str(x, 40)).filter(Boolean); if (t.options.length < 2) t.options = ['Option A', 'Option B', 'Option C']; t.criteria = arr(o.criteria, 10).map(c => Array.isArray(c) ? [str(c[0], 40), Math.max(1, Math.min(5, Math.round(numv(c[1])) || 3))] : [str(c, 40), 3]).filter(c => c[0]); if (!t.criteria.length) t.criteria = [['Cost', 3], ['Performance', 5], ['Ease', 2]]; },
    html: () => `<div class="ct-scroll" id="mx-box"></div><div class="row gap-sm"><button class="btn sm" data-action="mx-opt">${icon('plus', 13)} Option</button><button class="btn sm" data-action="mx-crit">${icon('plus', 13)} Criterion</button><button class="btn sm ghost" data-action="mx-reset">Start again</button></div><div class="ct-out" id="mx-out" aria-live="polite"></div>`,
    bind: (el, t) => {
      const st = () => { const s = store(t, 'm'); return s && Array.isArray(s.options) && Array.isArray(s.criteria) ? s : { options: t.options.slice(), criteria: t.criteria.map(c => c.slice()), scores: {} }; };
      let S = st();
      const save = () => store(t, 'm', S);
      const total = i => S.criteria.reduce((s, c, j) => s + c[1] * (+(S.scores[`${i}:${j}`]) || 0), 0);
      const paint = () => {
        $('#mx-box', el).innerHTML = `<table class="table compact ct-mx"><thead><tr><th scope="col">Criterion</th><th scope="col">Weight (1–5)</th>${S.options.map((o, i) => `<th scope="col"><input class="input sm" data-mx="o" data-i="${i}" value="${esc(o)}" aria-label="Option ${i + 1} name"></th>`).join('')}</tr></thead><tbody>${S.criteria.map((c, j) => `<tr><th scope="row"><input class="input sm" data-mx="c" data-j="${j}" value="${esc(c[0])}" aria-label="Criterion ${j + 1}"></th><td><select class="select sm" data-mx="w" data-j="${j}" aria-label="Weight of ${esc(c[0])}">${[1, 2, 3, 4, 5].map(w => `<option${w === c[1] ? ' selected' : ''}>${w}</option>`).join('')}</select></td>${S.options.map((o, i) => `<td><select class="select sm" data-mx="s" data-i="${i}" data-j="${j}" aria-label="${esc(o)}, ${esc(c[0])}"><option value="">–</option>${[1, 2, 3, 4, 5].map(v => `<option${+S.scores[`${i}:${j}`] === v ? ' selected' : ''}>${v}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}<tr class="ct-best"><th scope="row">Total</th><td></td>${S.options.map((o, i) => `<td class="mono"><b>${total(i)}</b></td>`).join('')}</tr></tbody></table>`;
        const tots = S.options.map((o, i) => total(i)); const best = Math.max(...tots); const win = S.options.filter((o, i) => tots[i] === best);
        $('#mx-out', el).innerHTML = best > 0 ? `<p class="ct-ans">${win.length === 1 ? `${icon('award', 15)} <b>${esc(win[0])}</b> scores best, with ${best} of ${S.criteria.reduce((s, c) => s + c[1] * 5, 0)}.` : `A tie between ${win.map(esc).join(' and ')}: add a criterion to split them.`}</p><p class="small muted">Score each option from 1 (poor) to 5 (excellent) on each criterion; a criterion's weight says how much it matters.</p>` : '<p class="small muted">Score each option from 1 (poor) to 5 (excellent) on each criterion.</p>';
      };
      el.addEventListener('change', e => { const x = e.target.closest('[data-mx]'); if (!x) return; const m = x.dataset.mx; if (m === 'o') S.options[+x.dataset.i] = x.value.slice(0, 40); else if (m === 'c') S.criteria[+x.dataset.j][0] = x.value.slice(0, 40); else if (m === 'w') S.criteria[+x.dataset.j][1] = +x.value; else if (m === 's') S.scores[`${x.dataset.i}:${x.dataset.j}`] = x.value ? +x.value : ''; save(); paint(); });
      bind(el, { 'mx-opt': () => { if (S.options.length < 6) { S.options.push(`Option ${String.fromCharCode(65 + S.options.length)}`); save(); paint(); } }, 'mx-crit': () => { if (S.criteria.length < 10) { S.criteria.push(['New criterion', 3]); save(); paint(); } }, 'mx-reset': () => { store(t, 'm', null); S = st(); paint(); } });
      paint();
    }
  });
  const GAMES = { pd: ['Prisoner’s dilemma', ['Cooperate', 'Defect'], [[3, 3], [0, 5], [5, 0], [1, 1]]], chicken: ['Chicken', ['Swerve', 'Stay'], [[0, 0], [-1, 1], [1, -1], [-10, -10]]], stag: ['Stag hunt', ['Stag', 'Hare'], [[4, 4], [0, 3], [3, 0], [3, 3]]], bos: ['Battle of the sexes', ['Opera', 'Football'], [[2, 1], [0, 0], [0, 0], [1, 2]]], pennies: ['Matching pennies', ['Heads', 'Tails'], [[1, -1], [-1, 1], [-1, 1], [1, -1]]], arms: ['Arms race', ['Disarm', 'Arm'], [[3, 3], [1, 4], [4, 1], [2, 2]]] };
  kind('game', '2×2 game', 'users', 'Two players, two choices each: best responses, dominant strategies and Nash equilibria, pure and mixed.', {
    clean: (t, o) => { t.presets = arr(o.presets, 6).filter(k => GAMES[k]); if (!t.presets.length) t.presets = ['pd', 'chicken', 'stag', 'bos', 'pennies']; t.players = arr(o.players, 2).map(p => str(p, 20)); if (t.players.length < 2) t.players = ['Row', 'Column']; },
    html: t => `<div class="row gap-sm ct-sets" role="group" aria-label="Classic games">${t.presets.map((k, i) => `<button class="chip toggle${i ? '' : ' on'}" data-action="gm-pick" data-k="${k}">${esc(GAMES[k][0])}</button>`).join('')}</div><div id="gm-box"></div><div class="ct-out" id="gm-out" aria-live="polite"></div>`,
    bind: (el, t) => {
      const [P1, P2] = t.players; let names = GAMES[t.presets[0]][1].slice(), pay = GAMES[t.presets[0]][2].map(p => p.slice());
      const paint = () => {
        $('#gm-box', el).innerHTML = `<p class="small">Each cell: the payoff to ${esc(P1)}, then to ${esc(P2)}. Change any number.</p><div class="ct-scroll"><table class="table compact ct-game"><thead><tr><th></th><th scope="col">${esc(P2)}: ${esc(names[0])}</th><th scope="col">${esc(P2)}: ${esc(names[1])}</th></tr></thead><tbody>${[0, 1].map(r => `<tr><th scope="row">${esc(P1)}: ${esc(names[r])}</th>${[0, 1].map(c => { const k = r * 2 + c; return `<td data-cell="${k}"><input class="input sm mono" data-g="${k}:0" value="${pay[k][0]}" aria-label="${esc(P1)} payoff, ${esc(names[r])} and ${esc(names[c])}" inputmode="decimal"> , <input class="input sm mono" data-g="${k}:1" value="${pay[k][1]}" aria-label="${esc(P2)} payoff, ${esc(names[r])} and ${esc(names[c])}" inputmode="decimal"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
        solve();
      };
      const solve = () => {
        const R = k => pay[k][0], Cc = k => pay[k][1]; const nash = [];
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const k = r * 2 + c; const rowBest = R(k) >= R((1 - r) * 2 + c); const colBest = Cc(k) >= Cc(r * 2 + (1 - c)); if (rowBest && colBest) nash.push(k); }
        $$('[data-cell]', el).forEach(td => td.classList.toggle('ct-nash', nash.includes(+td.dataset.cell)));
        const domR = R(0) > R(2) && R(1) > R(3) ? names[0] : R(2) > R(0) && R(3) > R(1) ? names[1] : '';
        const domC = Cc(0) > Cc(1) && Cc(2) > Cc(3) ? names[0] : Cc(1) > Cc(0) && Cc(3) > Cc(2) ? names[1] : '';
        const den1 = Cc(0) - Cc(1) - Cc(2) + Cc(3), den2 = R(0) - R(2) - R(1) + R(3); const p = den1 ? (Cc(3) - Cc(2)) / den1 : NaN, q = den2 ? (R(3) - R(1)) / den2 : NaN;
        const mixed = p > 0 && p < 1 && q > 0 && q < 1;
        const cellName = k => `(${esc(names[Math.floor(k / 2)])}, ${esc(names[k % 2])})`;
        $('#gm-out', el).innerHTML = `<p class="ct-ans">${nash.length ? `${nash.length > 1 ? 'Two Nash equilibria' : 'The Nash equilibrium'}: <b>${nash.map(cellName).join(' and ')}</b>. There, neither player gains by switching alone.` : 'No pure-strategy Nash equilibrium: in every cell, someone would rather switch.'}</p>
          <ul class="list small">${domR ? `<li>${esc(P1)} has a dominant strategy: <b>${esc(domR)}</b> is better whatever ${esc(P2)} does.</li>` : `<li>${esc(P1)} has no dominant strategy.</li>`}${domC ? `<li>${esc(P2)} has a dominant strategy: <b>${esc(domC)}</b>.</li>` : `<li>${esc(P2)} has no dominant strategy.</li>`}${mixed ? `<li>Mixed equilibrium: ${esc(P1)} plays ${esc(names[0])} ${sig(p * 100, 3)}% of the time, ${esc(P2)} plays ${esc(names[0])} ${sig(q * 100, 3)}% of the time, so neither can be exploited.</li>` : ''}${nash.length === 1 && [0, 1, 2, 3].some(k => k !== nash[0] && R(k) > R(nash[0]) && Cc(k) > Cc(nash[0])) ? '<li>Both would be better off in another cell, but neither can get there alone: the dilemma.</li>' : ''}</ul>`;
      };
      el.addEventListener('input', e => { const x = e.target.closest('[data-g]'); if (!x) return; const [k, w] = x.dataset.g.split(':').map(Number); const v = App.parseNumber(x.value); if (Number.isFinite(v)) { pay[k][w] = v; solve(); } });
      bind(el, { 'gm-pick': b => { const g = GAMES[b.dataset.k]; names = g[1].slice(); pay = g[2].map(p => p.slice()); $$('[data-action="gm-pick"]', el).forEach(x => x.classList.toggle('on', x === b)); paint(); } });
      paint();
    }
  });
  kind('link', 'Page', 'right', '', {
    clean: (t, o) => { t.view = str(o.view, 20); if (!/^[a-z]+$/.test(t.view) || !App.views[t.view] || t.view === 'toolkit') return false; }
  });

  /* ---------- numbers behind the kinds ---------- */
  function pair(v, def) { const p = Array.isArray(v) ? v : v && typeof v === 'object' ? [v.min, v.max] : null; const a = p && numv(p[0]), b = p && numv(p[1]); return p && Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : def; }
  function sums(f, a, b, n) {
    const h = (b - a) / n; let L = 0, R = 0, M = 0; for (let i = 0; i < n; i++) { L += f(a + i * h); R += f(a + (i + 1) * h); M += f(a + (i + 0.5) * h); }
    const m = n % 2 ? n + 1 : n, k = (b - a) / m; let S = f(a) + f(b); for (let i = 1; i < m; i++) S += (i % 2 ? 4 : 2) * f(a + i * k);
    return { left: L * h, right: R * h, mid: M * h, trap: (L + R) * h / 2, simpson: S * k / 3 };
  }
  const median = d => { const n = d.length; if (!n) return NaN; return n % 2 ? d[(n - 1) / 2] : (d[n / 2 - 1] + d[n / 2]) / 2; };
  function nice(v) {   // 0.5 → 0.5 (1/2); 3.14159… → π
    if (!Number.isFinite(v)) return sig(v); const s = sig(v, 6); if (Math.abs(v - Math.round(v)) < 1e-6) return String(Math.round(v)).replace('-', '−');
    for (let q = 2; q <= 12; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-6 && Math.abs(p) < 1000) return `${s} (that is ${p < 0 ? '−' : ''}${Math.abs(p)}/${q})`; }
    for (const [c, nm] of [[Math.PI, 'π'], [Math.E, 'e'], [Math.SQRT2, '√2'], [Math.sqrt(3), '√3']]) for (let q = 1; q <= 6; q++) { const p = Math.round(v * q / c); if (p && Math.abs(v - p * c / q) < 1e-6) return `${s} (that is ${p === 1 ? '' : p === -1 ? '−' : p}${nm}${q > 1 ? '/' + q : ''})`; }
    return s;
  }
  function radName(d) { const r = Math.round(d * 1e6) / 1e6; if (r === 0) return '0'; if (Number.isInteger(r)) { const g = (a, b) => b ? g(b, a % b) : a; const k = g(Math.abs(r), 180); const P = r / k, Q = 180 / k; if (Q <= 12) return `${P === 1 ? '' : P === -1 ? '−' : String(P).replace('-', '−')}π${Q > 1 ? '/' + Q : ''} ≈ ${sig(d * Math.PI / 180, 5)}`; } return sig(d * Math.PI / 180, 6); }
  function exact(n) {   // a special angle's exact cos, sin and tan
    const r = Math.round(n * 1e6) / 1e6; if (!Number.isInteger(r) || (r % 30 && r % 45)) return null;
    const T = { 0: ['1', '0', '0'], 30: ['√3/2', '1/2', '√3/3'], 45: ['√2/2', '√2/2', '1'], 60: ['1/2', '√3/2', '√3'], 90: ['0', '1', 'undefined'] };
    const ref = r <= 90 ? r : r <= 180 ? 180 - r : r <= 270 ? r - 180 : 360 - r; const [c, s, t] = T[ref]; const neg = x => x === '0' || x === 'undefined' ? x : '−' + x;
    const qc = r < 90 || r > 270 ? 1 : r === 90 || r === 270 ? 0 : -1, qs = r > 0 && r < 180 ? 1 : r === 0 || r === 180 ? 0 : -1;
    return { c: qc < 0 ? neg(c) : c, s: qs < 0 ? neg(s) : s, t: t === 'undefined' ? t : qc * qs < 0 ? neg(t) : t };
  }
  function yearOf(w) {   // 1603, 1603–1868, c. 14,000–300 BCE, 300 BCE–300 CE: the first year, negative before the common era
    const t = String(w || ''); const m = /(\d{1,3}(?:,\d{3})+|\d{1,5})/.exec(t); if (!m) return NaN; const y = +m[1].replace(/,/g, '');
    // BCE, and the way the other languages write it (a. C., av. J.-C., v. Chr., до н. э.)
    const BC = /\bB\.?C\.?(E\.?)?(?![A-Za-z])|\ba\.\s?C\.|\bav\.\s?J\.-C\.|\bv\.\s?Chr\.|до\s?н\.\s?э\./i; const first = t.split(/[–—]|-(?=\s*\d)/)[0];
    return BC.test(first) || (BC.test(t) && !/\b(C\.?E|A\.?D)\b/.test(t.replace(/B\.?C\.?E\.?/gi, ''))) ? -y : y;
  }
  const chiRow = c => `<div class="ct-row"><input class="input sm" data-c="n" value="${esc(c[0])}" aria-label="Category" placeholder="Category"><input class="input sm mono" data-c="o" value="${esc(String(c[1]))}" aria-label="Observed count" inputmode="numeric" placeholder="Count"><input class="input sm mono" data-c="e" value="${esc(String(c[2]))}" aria-label="Expected share" inputmode="decimal" placeholder="Share"><button class="icon-btn xs" data-action="ctc-del" aria-label="Remove this row" title="Remove">${icon('x', 12)}</button></div>`;
  function lnGamma(z) { const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z); z -= 1; let x = 0.99999999999980993; for (let i = 0; i < 8; i++) x += g[i] / (z + i + 1); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
  function gammaP(s, x) {   // the regularized lower incomplete gamma function: a series below s + 1, a continued fraction above
    if (x <= 0) return 0; const gl = lnGamma(s);
    if (x < s + 1) { let sum = 1 / s, del = sum, ap = s; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + s * Math.log(x) - gl); }
    let b = x + 1 - s, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - s); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
    return 1 - Math.exp(-x + s * Math.log(x) - gl) * h;
  }

  /* ---------- a list of tools, cleaned ---------- */
  function clean(list) {
    const out = []; const seen = {};
    arr(list, 16).forEach(o => {
      if (!o || typeof o !== 'object') return; const k = String(o.kind || '').toLowerCase(); const D = K[k]; if (!D) return;
      const t = { kind: k, title: str(o.title, 50), desc: str(o.desc, 160) };
      if (D.clean && D.clean(t, o) === false) return;
      const base = str(o.id, 24).replace(/[^a-z0-9-]/gi, '') || (k === 'link' ? 'go-' + t.view : k); seen[base] = (seen[base] || 0) + 1; t.id = seen[base] > 1 ? `${base}-${seen[base]}` : base;
      out.push(t);
    });
    return out;
  }
  /* a class with nothing chosen: the kit of its subject (assets/class-kits.js), by its code's letters (CHMY 121, HSTR 101…), then its kind */
  function guess(D) {
    const SK = global.MathubSubjectKits || { list: [], byKind: {} }; const pre = String(D.code || '').toUpperCase().match(/^[A-Z]+/); const hit = pre && SK.list.find(([re]) => re.test(pre[0]));
    return hit ? hit[1] : SK.byKind[D.kind] || SK.byKind.math || [{ kind: 'calculator' }];
  }
  /* the tools this class starts with (before the student's own changes) */
  function baseList(D) {
    if (Array.isArray(D.TOOLS) && D.TOOLS.length) { const t = clean(D.TOOLS); if (t.length) return t; }
    const kit = global.MathubKits && global.MathubKits[D.id]; if (kit) { const t = clean(kit); if (t.length) return t; }
    return clean(guess(D));
  }
  const mine = D => { const m = courseSetting(D.id, 'tools', null); return { hide: Array.isArray(m && m.hide) ? m.hide.map(String) : [], add: Array.isArray(m && m.add) ? m.add : [] }; };
  function toolsOf(D) {
    const m = mine(D); const base = baseList(D); const added = m.add.map((raw, i) => { const t = clean([raw])[0]; return t && Object.assign(t, { id: 'my-' + i, mine: true }); }).filter(Boolean);
    return base.concat(added).filter(t => !m.hide.includes(t.id));
  }
  App.classTools = { kinds: K, clean, toolsOf, baseList, guess, roots, subst, names, sums, gammaP, yearOf, exact, KIND_IDS: Object.keys(K).filter(k => k !== 'link') };

  /* ---------- the page ---------- */
  const titleOf = t => t.kind === 'link' ? (t.title || (App.views[t.view] && App.views[t.view].title) || t.view) : t.title || K[t.kind].label;
  const descOf = t => t.desc || (t.kind === 'link' ? (App.views[t.view] && App.views[t.view].blurb) || 'Opens this class’s page for it.' : K[t.kind].desc);
  const iconOf = t => t.kind === 'link' ? (App.viewIcon ? App.viewIcon(t.view, 'right') : 'right') : K[t.kind].icon;
  App.views.toolkit = {
    title: 'Tools',
    blurb: 'The tools this class needs: calculators, solvers and simulators. Pick one; it opens below.',
    render(root, param, query) {
      if (!C) { root.innerHTML = ''; return; }
      const D = C; const list = toolsOf(D); const open = list.filter(t => t.kind !== 'link');
      const want = (query && query.t) || param || courseSetting(D.id, 'toolOpen', ''); const cur = open.find(t => t.id === want) || open[0];
      root.innerHTML = pageHead('Tools', `Made for ${esc(D.short || D.code)}. Pick one; it opens below.`, `<button class="btn sm" data-action="ct-edit">${icon('sliders', 14)} Change tools</button>`) +
        `<div class="ct-cards" role="group" aria-label="Tools">${list.map(t => t.kind === 'link' ? `<a class="ct-card is-link" href="#/${esc(D.id)}/${esc(t.view)}"><span class="ct-ic" aria-hidden="true">${icon(iconOf(t), 18)}</span><span class="ct-t"><b>${esc(titleOf(t))}</b><small>${esc(descOf(t))}</small></span>${icon('right', 14)}</a>` : `<button class="ct-card${cur && t.id === cur.id ? ' on' : ''}" data-action="ct-open" data-id="${esc(t.id)}" aria-pressed="${cur && t.id === cur.id}" aria-controls="ct-pane"><span class="ct-ic" aria-hidden="true">${icon(iconOf(t), 18)}</span><span class="ct-t"><b>${esc(titleOf(t))}</b><small>${esc(descOf(t))}</small></span></button>`).join('')}</div>
        <section class="panel ct-pane" id="ct-pane" aria-labelledby="ct-pane-h"></section>`;
      const pane = $('#ct-pane', root);
      const show = (t, user) => {
        if (!t) { pane.innerHTML = `<h2 class="sr-only" id="ct-pane-h">Tools</h2><div class="empty small">No tools here yet. <button class="btn sm" data-action="ct-edit">${icon('plus', 13)} Add one</button></div>`; return; }
        const askBo = App.moduleOn && !App.moduleOn('tutor') ? '' : `<a class="btn sm ghost" href="#/tutor/${esc(D.id)}?q=${encodeURIComponent(`Help me use the ${titleOf(t)} on ${D.short}'s Tools page for my homework`)}">${icon('chat', 13)} Ask Bo how to use it</a>`;
        pane.innerHTML = `<div class="panel-h"><h2 class="panel-title" id="ct-pane-h">${icon(iconOf(t))} ${esc(titleOf(t))}</h2>${askBo}</div><p class="small muted ct-desc">${esc(descOf(t))}</p><div class="ct-body ct-${t.kind}">${K[t.kind].html(t)}</div>`;
        try { K[t.kind].bind($('.ct-body', pane), t); } catch (e) { console.error(e); }
        if (!user && pane.contains(document.activeElement)) document.activeElement.blur();   // a tool that focuses its box would open a phone's keyboard as the page loads
        App.typeset(pane); setCourseSetting(D.id, 'toolOpen', t.id);
        $$('.ct-card[data-id]', root).forEach(b => { const on = b.dataset.id === t.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      };
      bind(root, {
        'ct-open': b => { show(open.find(t => t.id === b.dataset.id), true); const top = pane.getBoundingClientRect().top; if (top > innerHeight * 0.7) pane.scrollIntoView({ behavior: App.motionReduced && App.motionReduced() ? 'auto' : 'smooth', block: 'start' }); },
        'ct-edit': () => editor(root, D)
      });
      show(cur);
    }
  };

  /* ---------- the student's own changes: hide, add, a formula of their own ---------- */
  function editor(root, D) {
    const m = mine(D); const base = baseList(D); const added = m.add.map((raw, i) => { const t = clean([raw])[0]; return t && Object.assign(t, { raw: i }); }).filter(Boolean);
    const pane = $('#ct-pane', root); $$('.ct-card', root).forEach(b => { b.classList.remove('on'); if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false'); });
    const save = (hide, add) => { setCourseSetting(D.id, 'tools', { hide, add }); App.views.toolkit.render(root, null, {}); };
    pane.innerHTML = `<div class="panel-h"><h2 class="panel-title" id="ct-pane-h">${icon('sliders')} Change ${esc(D.short || D.code)}’s tools</h2></div><p class="small muted">Only you see these changes, and they are kept for this class.</p>
      <h3 class="ct-h">On this page</h3><ul class="ct-ed">${base.map(t => `<li><label><input type="checkbox" data-hide="${esc(t.id)}"${m.hide.includes(t.id) ? '' : ' checked'}> ${icon(iconOf(t), 14)} <span>${esc(titleOf(t))}</span></label></li>`).join('')}${added.map(t => `<li><span class="ct-ed-mine">${icon(iconOf(t), 14)} <span>${esc(titleOf(t))}</span> <small class="muted">added by you</small></span><button class="btn xs ghost" data-action="ce-del" data-i="${t.raw}">${icon('trash', 12)} Remove</button></li>`).join('')}</ul>
      <h3 class="ct-h">Add a tool</h3><div class="ct-add-kinds">${App.classTools.KIND_IDS.filter(k => !['solver', 'checklist'].includes(k)).map(k => `<button class="chip" data-action="ce-add" data-k="${k}">${icon(K[k].icon, 13)} ${esc(K[k].label)}</button>`).join('')}</div>
      <h3 class="ct-h">A formula of your own</h3><p class="small muted">Write it with * between letters (P*V = n*R*T). Every other letter becomes a box to fill in.</p>
      <div class="grid cols-2">${field('ce-n', 'Name', '', ' placeholder="Ideal gas law"')}${field('ce-eq', 'Formula', '', ' placeholder="P*V = n*R*T"')}</div>
      <div class="field"><label for="ce-vars">What each letter means (optional, one a line: letter = meaning, unit)</label><textarea class="input mono" id="ce-vars" rows="3" placeholder="P = pressure, atm"></textarea></div>
      <div class="row gap-sm"><button class="btn primary" data-action="ce-formula">${icon('plus', 14)} Add the formula</button><span class="small" id="ce-msg" role="status"></span></div>
      <div class="row gap-sm mt-3"><button class="btn" data-action="ce-done">${icon('check', 14)} Done</button>${m.hide.length || m.add.length ? `<button class="btn ghost" data-action="ce-reset">${icon('undo', 14)} Back to the class’s own tools</button>` : ''}</div>`;
    const hidden = () => $$('[data-hide]', pane).filter(x => !x.checked).map(x => x.dataset.hide);
    bind(pane, {
      'ce-add': b => save(hidden(), m.add.concat([{ kind: b.dataset.k }]).slice(-10)),
      'ce-del': b => save(hidden(), m.add.filter((x, i) => i !== +b.dataset.i)),
      'ce-formula': () => {
        const n = $('#ce-n', pane).value.trim(), eq = $('#ce-eq', pane).value.trim(); const msg = $('#ce-msg', pane);
        if (!eq.includes('=')) { msg.textContent = 'A formula needs an = sign.'; return; }
        const said = {}; $('#ce-vars', pane).value.split('\n').forEach(l => { const mm = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*[=:]\s*([^,]*)(?:,\s*(.*))?$/.exec(l); if (mm) said[mm[1]] = [mm[2].trim(), (mm[3] || '').trim()]; });
        const letters = names(eq).filter(w => !RESERVED.has(w)); if (letters.length < 2) { msg.textContent = 'Use at least two letters, such as F = m*a.'; return; }
        const bad1 = letters.find(w => !VAR_RE.test(w)); if (bad1) { msg.textContent = `“${bad1}” is too long for a letter.`; return; }
        const tool = { kind: 'solver', title: n || 'My formula', formulas: [{ n: n || eq, eq, vars: letters.map(w => [w, (said[w] || [])[0] || '', (said[w] || [])[1] || '']) }] };
        const ok = clean([tool]); if (!ok.length) { msg.textContent = 'That formula could not be read. Check the brackets and write * between letters.'; return; }
        try { compileExpr(subst(`(${sides(eq)[0]})-(${sides(eq)[1]})`, Object.fromEntries(letters.map(w => [w, '(1)'])))); } catch (e) { msg.textContent = e.message; return; }
        save(hidden(), m.add.concat([tool]).slice(-10)); App.toast('Formula added. It is the last tool on the page.');
      },
      'ce-done': () => save(hidden(), m.add),
      'ce-reset': () => { setCourseSetting(D.id, 'tools', null); App.views.toolkit.render(root, null, {}); }
    });
    pane.scrollIntoView({ behavior: App.motionReduced && App.motionReduced() ? 'auto' : 'smooth', block: 'start' });
  }
})(window);
