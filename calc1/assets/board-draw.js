/* ============================================================
   Bo's drawings: what he sketches on his board, next to the steps.
   In a reply a drawing is one line of a board page, "draw: {JSON}"; on a call it comes from his
   draw_on_board tool. One of:
     graph       functions of x (and parametric curves), points, shaded areas, segments and vectors,
                 asymptotes, notes; the y range is found when he leaves it out
     numberline  points (open or closed) and intervals, to infinity or not
     figure      shapes in his own coordinates: polygons, segments, arrows, circles, angles (right
                 angles too), points, text and boxes; same scale both ways
     table       a small table of values (cells may hold $TeX$)
     bars        a bar chart or histogram
     normal      a normal curve with a shaded region and the mean ± 1, 2, 3 SD marked
     tree        a probability tree, up to three levels
   It is data, never code: functions are read by App.compileExpr (no eval), counts and sizes are
   capped, every label is escaped, and anything that does not make sense is left out. Bo "draws" it
   like a marker on a whiteboard (stroke by stroke), unless motion is reduced.
   App.boDraw: parse(text | object) → a clean spec or null, html(spec, animate) → markup, plain(spec) → words.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const esc = App.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const TYPES = ['graph', 'numberline', 'figure', 'table', 'bars', 'normal', 'tree'];
  const COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'gray'];
  let uid = 0;

  /* ---------- reading what Bo wrote ---------- */
  const fin = v => typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v);
  const num = (v, d) => fin(v) ? Math.max(-1e9, Math.min(1e9, +v)) : d;
  const pair = v => Array.isArray(v) && v.length >= 2 && fin(v[0]) && fin(v[1]) ? [num(v[0]), num(v[1])] : null;
  const range = v => { const p = pair(v); return p && p[1] > p[0] ? p : null; };
  const str = (v, n = 60) => (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/\s+/g, ' ').trim().slice(0, n) : '';
  const list = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];
  const col = (v, i) => { const k = COLORS.indexOf(String(v || '').toLowerCase()); return k >= 0 ? k : i % 5; };
  const compile = f => { const s = str(f, 160); if (!s || !App.compileExpr) return null; try { const fn = App.compileExpr(s.toLowerCase().replace(/^\s*(?:y|f\(x\)|x\(t\)|y\(t\))\s*=\s*/, '')); fn(0.5); return fn; } catch (e) { return null; } };

  function parse(input) {
    let o = input;
    if (typeof o === 'string') { const s = o.trim(); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a || s.length > 6000) return null; try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const type = String(o.type || '').toLowerCase(); if (!TYPES.includes(type)) return null;
    const sp = { type, caption: str(o.caption, 160) };
    if (type === 'graph') {
      sp.fns = list(o.fns || (o.f ? [{ f: o.f }] : []), 6).map((g, i) => g && typeof g === 'object' ? { f: str(g.f, 160), xt: str(g.x, 160), yt: str(g.y, 160), t: range(g.t), label: str(g.label, 40), domain: range(g.domain), c: col(g.color, i), dash: !!g.dash } : null).filter(g => g && (g.f ? compile(g.f) : g.xt && g.yt && compile(g.xt) && compile(g.yt)));   // only what can be plotted
      sp.points = list(o.points, 30).map(p => p && fin(p.x) && fin(p.y) ? { x: num(p.x), y: num(p.y), label: str(p.label, 30), open: !!p.open, c: col(p.color, 1) } : null).filter(Boolean);
      sp.segments = list(o.segments || o.lines, 20).map((s, i) => s && pair(s.from) && pair(s.to) ? { from: pair(s.from), to: pair(s.to), label: str(s.label, 30), arrow: !!s.arrow, dash: !!s.dash, c: col(s.color, i + 2) } : null).filter(Boolean);
      const sh = o.shade && typeof o.shade === 'object' ? o.shade : null;
      sp.shade = sh && (sh.f || sh.g) && fin(sh.from) && fin(sh.to) && +sh.to > +sh.from ? { f: str(sh.f || '0', 160), g: str(sh.g || '0', 160), from: num(sh.from), to: num(sh.to), c: col(sh.color, 0) } : null;
      sp.vlines = list(o.vlines, 6).map(v => v && fin(v.x) ? { v: num(v.x), label: str(v.label, 30) } : null).filter(Boolean);
      sp.hlines = list(o.hlines, 6).map(v => v && fin(v.y) ? { v: num(v.y), label: str(v.label, 30) } : null).filter(Boolean);
      sp.notes = list(o.notes || o.labels, 10).map(n => n && fin(n.x) && fin(n.y) && str(n.text) ? { x: num(n.x), y: num(n.y), text: str(n.text, 40) } : null).filter(Boolean);
      sp.x = range(o.x); sp.y = range(o.y); sp.equal = !!o.equal; sp.xlabel = str(o.xlabel, 24); sp.ylabel = str(o.ylabel, 24);
      if (!sp.fns.length && !sp.points.length && !sp.segments.length) return null;
    } else if (type === 'numberline') {
      sp.points = list(o.points, 16).map(p => p && fin(p.x) ? { x: num(p.x), label: str(p.label, 24), open: !!p.open, c: col(p.color, 0) } : null).filter(Boolean);
      sp.intervals = list(o.intervals, 4).map((v, i) => v && (fin(v.from) || fin(v.to)) ? { from: fin(v.from) ? num(v.from) : null, to: fin(v.to) ? num(v.to) : null, left: v.left === 'open' ? 'open' : 'closed', right: v.right === 'open' ? 'open' : 'closed', c: col(v.color, i) } : null).filter(Boolean);
      const xs = sp.points.map(p => p.x).concat(...sp.intervals.map(v => [v.from, v.to].filter(x => x !== null)));
      let lo = fin(o.min) ? +o.min : (xs.length ? Math.min(...xs) - 2 : -5), hi = fin(o.max) ? +o.max : (xs.length ? Math.max(...xs) + 2 : 5);
      if (!(hi > lo)) { lo -= 1; hi += 1; }
      sp.min = lo; sp.max = hi; sp.step = fin(o.step) && +o.step > 0 && (hi - lo) / +o.step <= 40 ? +o.step : 0;
      if (!sp.points.length && !sp.intervals.length) return null;
    } else if (type === 'figure') {
      const KINDS = ['point', 'segment', 'arrow', 'polygon', 'circle', 'angle', 'text', 'rect', 'curve'];
      sp.shapes = list(o.shapes, 60).map((s, i) => {
        if (!s || !KINDS.includes(s.kind)) return null; const c = col(s.color, s.kind === 'arrow' ? 1 : 0);
        const base = { kind: s.kind, label: str(s.label, 30), c, dash: !!s.dash, fill: !!s.fill };
        if (s.kind === 'point' || s.kind === 'text') { const at = pair(s.at); return at ? Object.assign(base, { at, text: str(s.text, 50) }) : null; }
        if (s.kind === 'segment' || s.kind === 'arrow') { const a = pair(s.from), b = pair(s.to); return a && b ? Object.assign(base, { from: a, to: b }) : null; }
        if (s.kind === 'polygon' || s.kind === 'curve') { const pts = list(s.points, 24).map(pair).filter(Boolean); return pts.length >= 2 ? Object.assign(base, { points: pts, labels: list(s.labels, 24).map(x => str(x, 12)) }) : null; }
        if (s.kind === 'circle') { const c0 = pair(s.center || s.at); const r = num(s.r, 0); return c0 && r > 0 ? Object.assign(base, { center: c0, r }) : null; }
        if (s.kind === 'angle') { const at = pair(s.at), a = pair(s.from), b = pair(s.to); return at && a && b ? Object.assign(base, { at, from: a, to: b, right: !!s.right }) : null; }
        if (s.kind === 'rect') { const at = pair(s.at); const w = num(s.w, 0), h = num(s.h, 0); return at && w > 0 && h > 0 ? Object.assign(base, { at, w, h, text: str(s.text, 40) }) : null; }
        return null;
      }).filter(Boolean);
      if (!sp.shapes.length) return null;
    } else if (type === 'table') {
      sp.head = list(o.head, 6).map(x => str(x, 40));
      sp.rows = list(o.rows, 12).map(r => list(r, 6).map(x => str(x, 60))).filter(r => r.length);
      if (!sp.rows.length) return null;
    } else if (type === 'bars') {
      sp.bars = list(o.bars, 24).map(b => b && fin(b.value) ? { label: str(b.label, 14), value: num(b.value) } : null).filter(Boolean);
      sp.hist = !!o.hist; sp.ylabel = str(o.ylabel, 24); sp.xlabel = str(o.xlabel, 24); sp.mark = fin(o.highlight) ? Math.round(+o.highlight) : -1;
      if (!sp.bars.length || sp.bars.every(b => b.value === 0)) return null;
    } else if (type === 'normal') {
      sp.mean = num(o.mean, 0); sp.sd = num(o.sd, 1); if (!(sp.sd > 0)) return null;
      sp.from = fin(o.from) ? num(o.from) : null; sp.to = fin(o.to) ? num(o.to) : null; sp.shade = 'from' in o || 'to' in o;
      sp.label = str(o.label || o.xlabel, 30); sp.marks = list(o.marks, 4).map(m => m && fin(m.x) ? { x: num(m.x), label: str(m.label, 20) } : fin(m) ? { x: num(m), label: '' } : null).filter(Boolean);
    } else if (type === 'tree') {
      const node = (b, d) => b && typeof b === 'object' ? { label: str(b.label, 16), p: str(b.p, 12), result: str(b.result, 24), children: d < 3 ? list(b.children, 4).map(c => node(c, d + 1)).filter(Boolean) : [] } : null;
      sp.root = str(o.root, 16); sp.branches = list(o.branches, 4).map(b => node(b, 1)).filter(Boolean);
      const leaves = n => n.children.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1;
      if (!sp.branches.length || sp.branches.reduce((s, b) => s + leaves(b), 0) > 16) return null;
    }
    return sp;
  }

  /* ---------- labels: a little TeX becomes plain symbols (x^2 → x², \theta → θ) ---------- */
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', x: 'ˣ', i: 'ⁱ', '(': '⁽', ')': '⁾', t: 'ᵗ', k: 'ᵏ' };
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', n: 'ₙ', x: 'ₓ', i: 'ᵢ', a: 'ₐ', o: 'ₒ', k: 'ₖ', t: 'ₜ' };
  const SYM = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', omega: 'ω', Omega: 'Ω', infty: '∞', cdot: '·', times: '×', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', pm: '±', to: '→', rightarrow: '→', circ: '°', degree: '°', sqrt: '√', int: '∫', angle: '∠', perp: '⊥', parallel: '∥', in: '∈', cup: '∪', cap: '∩' };
  const script = (x, map, mark) => [...x].every(ch => map[ch]) ? [...x].map(ch => map[ch]).join('') : mark + (x.length > 1 ? `(${x})` : x);
  function pretty(s) {
    let t = String(s || '').replace(/\$/g, '');
    t = t.replace(/\\(?:text|mathrm|operatorname|mathbf)\{([^{}]*)\}/g, '$1').replace(/\\left|\\right|\\,|\\;|\\!|\\ /g, m => m === '\\ ' || m === '\\,' || m === '\\;' ? ' ' : '');
    t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b) => `${/^[\w.]+$/.test(a) ? a : `(${a})`}/${/^[\w.]+$/.test(b) ? b : `(${b})`}`);
    t = t.replace(/\\sqrt\{([^{}]*)\}/g, (m, a) => /^[\w.]+$/.test(a) ? `√${a}` : `√(${a})`);
    t = t.replace(/\\([A-Za-z]+)/g, (m, w) => SYM[w] !== undefined ? SYM[w] : w);
    t = t.replace(/\^\{([^{}]*)\}/g, (m, x) => script(x, SUP, '^')).replace(/\^([0-9a-z+\-−])/gi, (m, x) => script(x, SUP, '^'));
    t = t.replace(/_\{([^{}]*)\}/g, (m, x) => script(x, SUB, '_')).replace(/_([0-9a-z])/gi, (m, x) => script(x, SUB, '_'));
    t = t.replace(/\b(theta|alpha|beta|lambda|sigma|mu|Delta|delta|omega|phi)\b/g, w => SYM[w]).replace(/\bpi\b/g, 'π').replace(/\binfinity\b/gi, '∞');
    t = t.replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠').replace(/\bsqrt\(/g, '√(').replace(/(\d)\s*\*\s*(\w)/g, '$1$2').replace(/\*/g, '·');
    return t.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  }
  const lab = s => esc(pretty(s));

  /* ---------- numbers on the axes ---------- */
  function niceStep(span, want) { const raw = span / Math.max(1, want); const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  const decimals = step => Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  const fmt = (v, step) => { const d = step ? decimals(step) : 2; let s = Math.abs(v) < 1e-12 ? '0' : (+v.toFixed(d)).toString(); if (Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-4)) s = (+v.toPrecision(3)).toExponential().replace('e+', 'e'); return s.replace('-', '−'); };
  const ticks = (a, b, step) => { const out = []; const k0 = Math.ceil(a / step - 1e-9), k1 = Math.floor(b / step + 1e-9); for (let k = k0; k <= k1 && out.length < 41; k++) out.push(+(k * step).toFixed(10)); return out; };
  const r1 = v => Math.round(v * 10) / 10;

  /* ---------- SVG pieces: every stroke is drawn in order (--i), labels appear after it ---------- */
  function Ink() {
    let i = 0; const parts = [];
    const add = s => { parts.push(s); return s; };
    return {
      next() { return i++; },
      path(d, cls, c, o = {}) { const n = o.i != null ? o.i : i++; return add(`<path d="${d}" class="${cls}${c != null ? ' bd-c' + c : ''}${o.dash ? ' bd-dash bd-pop' : ' bd-ink'}" pathLength="1" style="--i:${n}"${o.extra || ''}/>`); },
      fill(d, c, n) { return add(`<path d="${d}" class="bd-fill bd-c${c} bd-pop" style="--i:${n != null ? n : i}"/>`); },
      dot(x, y, c, open, n) { return add(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${open ? 4.2 : 4.6}" class="bd-dot bd-c${c}${open ? ' open' : ''} bd-pop" style="--i:${n != null ? n : i}"/>`); },
      text(x, y, t, cls, o = {}) { if (!t) return ''; return add(`<text x="${r1(x)}" y="${r1(y)}" class="${cls}${o.c != null ? ' bd-c' + o.c : ''} bd-pop"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} style="--i:${o.i != null ? o.i : Math.max(0, i - 1)}"${o.rot ? ` transform="rotate(${o.rot} ${r1(x)} ${r1(y)})"` : ''}>${t}</text>`); },
      raw(s) { return add(s); },
      out() { return parts.join(''); }
    };
  }
  const M = (x, y) => `M${r1(x)} ${r1(y)}`, L = (x, y) => `L${r1(x)} ${r1(y)}`;
  function head(ink, x0, y0, x1, y1, c, n) {   // an arrowhead at (x1, y1), pointing away from (x0, y0)
    const a = Math.atan2(y1 - y0, x1 - x0), s = 9;
    const p = (da) => [x1 - s * Math.cos(a + da), y1 - s * Math.sin(a + da)];
    const [ax, ay] = p(0.45), [bx, by] = p(-0.45);
    ink.raw(`<path d="${M(ax, ay)}${L(x1, y1)}${L(bx, by)}" class="bd-head ${c == null ? 'bd-axhead' : 'bd-c' + c} bd-pop" style="--i:${n}"/>`);
  }
  const svgOpen = (w, h, title, id) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}" xmlns="http://www.w3.org/2000/svg"><title id="${id}">${esc(title)}</title>`;

  /* ---------- graph ---------- */
  function graph(sp, id) {
    const W = 360, H = 250, pl = 30, pr = 14, pt = 14, pb = 24;
    const fns = sp.fns.map(g => {
      if (g.xt && g.yt) { const fx = compile(g.xt), fy = compile(g.yt); return fx && fy ? Object.assign({}, g, { par: true, fx, fy }) : null; }
      const f = compile(g.f); return f ? Object.assign({}, g, { fn: f }) : null;
    }).filter(Boolean);
    // the x range: what he asked for, or what holds his points, segments and shading
    const xs = [].concat(sp.points.map(p => p.x), ...sp.segments.map(s => [s.from[0], s.to[0]]), sp.shade ? [sp.shade.from, sp.shade.to] : [], sp.vlines.map(v => v.v), ...fns.filter(g => g.domain).map(g => g.domain));
    const samplesPar = []; fns.filter(g => g.par).forEach(g => { const [t0, t1] = g.t || [0, 2 * Math.PI]; for (let k = 0; k <= 240; k++) { const t = t0 + (t1 - t0) * k / 240; const X = g.fx(t), Y = g.fy(t); if (Number.isFinite(X) && Number.isFinite(Y)) samplesPar.push([X, Y]); } });
    samplesPar.forEach(p => xs.push(p[0]));
    let [x0, x1] = sp.x || (xs.length ? [Math.min(...xs), Math.max(...xs)] : [-5, 5]);
    if (!sp.x) { if (x1 - x0 < 1e-9) { x0 -= 2; x1 += 2; } const pad = (x1 - x0) * 0.25; x0 -= pad; x1 += pad; if (x0 > 0 && x0 < (x1 - x0) * 0.6) x0 = -(x1 - x0) * 0.06; if (x1 < 0 && -x1 < (x1 - x0) * 0.6) x1 = (x1 - x0) * 0.06; }
    // sample the curves; the y range is what most of them cover
    const N = 320; const curves = fns.map(g => {
      if (g.par) { const [t0, t1] = g.t || [0, 2 * Math.PI]; const pts = []; for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; pts.push([g.fx(t), g.fy(t)]); } return pts; }
      const a = g.domain ? Math.max(x0, g.domain[0]) : x0, b = g.domain ? Math.min(x1, g.domain[1]) : x1; const pts = [];
      if (b > a) for (let k = 0; k <= N; k++) { const x = a + (b - a) * k / N; pts.push([x, g.fn(x)]); }
      return pts;
    });
    let [y0, y1] = sp.y || (() => {
      const ys = [].concat(...curves.map(c => c.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= x0 && p[0] <= x1).map(p => p[1])), sp.points.map(p => p.y), ...sp.segments.map(s => [s.from[1], s.to[1]]), sp.hlines.map(h => h.v), sp.notes.map(n => n.y));
      if (!ys.length) return [-5, 5];
      const s = ys.slice().sort((a, b) => a - b); const q = p => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
      let lo = s.length > 40 ? q(0.03) : s[0], hi = s.length > 40 ? q(0.97) : s[s.length - 1];
      sp.points.forEach(p => { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
      if (lo > 0 && lo < (hi - lo) * 0.7) lo = -(hi - lo) * 0.05; if (hi < 0 && -hi < (hi - lo) * 0.7) hi = (hi - lo) * 0.05;
      return [lo, hi];
    })();
    if (sp.equal) { const kx = (W - pl - pr) / (x1 - x0), ky = (H - pt - pb) / (y1 - y0); if (kx > ky) { const m = (x0 + x1) / 2, h = (W - pl - pr) / ky / 2; x0 = m - h; x1 = m + h; } else { const m = (y0 + y1) / 2, h = (H - pt - pb) / kx / 2; y0 = m - h; y1 = m + h; } }
    const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = y => pt + (y1 - y) / (y1 - y0) * (H - pt - pb);
    const ink = Ink(); const clip = `${id}-c`;
    ink.raw(`<defs><clipPath id="${clip}"><rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}"/></clipPath></defs>`);
    // the grid and the axes
    const sx = niceStep(x1 - x0, 8), sy = niceStep(y1 - y0, 6); const tx = ticks(x0, x1, sx), ty = ticks(y0, y1, sy);
    ink.raw(`<g class="bd-grid">${tx.map(v => `<path d="${M(X(v), pt)}${L(X(v), H - pb)}"/>`).join('')}${ty.map(v => `<path d="${M(pl, Y(v))}${L(W - pr, Y(v))}"/>`).join('')}</g>`);
    const ax = Y(Math.min(Math.max(0, y0), y1)), ay = X(Math.min(Math.max(0, x0), x1)); const n0 = ink.next();
    ink.path(`${M(pl, ax)}${L(W - pr + 4, ax)}`, 'bd-axis', null, { i: n0 }); ink.path(`${M(ay, H - pb)}${L(ay, pt - 4)}`, 'bd-axis', null, { i: n0 });
    const lblX = tx.filter(v => Math.abs(X(v) - ay) > 6 || ay <= pl + 1), lblY = ty.filter(v => Math.abs(Y(v) - ax) > 6);
    const every = (arr, max) => arr.filter((v, k) => arr.length <= max || k % Math.ceil(arr.length / max) === 0);
    const taken = [];   // label boxes already on the page: {x: centre, y: baseline, w}
    every(lblX, 9).forEach(v => { const t = fmt(v, sx), y = Math.min(H - 6, ax + 14); ink.text(X(v), y, t, 'bd-tick', { anchor: 'middle', i: n0 }); taken.push({ x: X(v), y, w: t.length * 6.2 }); });
    every(lblY, 7).forEach(v => { const t = fmt(v, sy), x = Math.max(ay - 5, 24); ink.text(x, Y(v) + 3.5, t, 'bd-tick', { anchor: 'end', i: n0 }); taken.push({ x: x - t.length * 3.1, y: Y(v) + 3.5, w: t.length * 6.2 }); });
    if (sp.xlabel) ink.text(W - pr, ax - 6, lab(sp.xlabel), 'bd-axl', { anchor: 'end', i: n0 });
    if (sp.ylabel) ink.text(ay + 6, pt + 8, lab(sp.ylabel), 'bd-axl', { i: n0 });
    // the shaded area (under the curves)
    if (sp.shade) {
      const f = compile(sp.shade.f), g = compile(sp.shade.g);
      if (f && g) { const a = Math.max(x0, sp.shade.from), b = Math.min(x1, sp.shade.to); const up = [], dn = []; for (let k = 0; k <= 120; k++) { const x = a + (b - a) * k / 120; const fy = f(x), gy = g(x); if (Number.isFinite(fy) && Number.isFinite(gy)) { up.push([X(x), Y(Math.max(y0 - 1, Math.min(y1 + 1, fy)))]); dn.push([X(x), Y(Math.max(y0 - 1, Math.min(y1 + 1, gy)))]); } }
        if (up.length > 1) ink.raw(`<g clip-path="url(#${clip})"><path d="${up.map((p, k) => (k ? L : M)(p[0], p[1])).join('')}${dn.reverse().map(p => L(p[0], p[1])).join('')}Z" class="bd-fill bd-c${sp.shade.c} bd-pop" style="--i:${ink.next()}"/></g>`); }
    }
    // the curves: a gap where a function jumps (an asymptote) or is undefined
    const spanY = y1 - y0; const labels = [];
    curves.forEach((pts, k) => {
      const g = fns[k]; let d = '', pen = false, prev = null;
      pts.forEach(p => {
        const ok = Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1] - (y0 + y1) / 2) < spanY * 20;
        if (!ok) { pen = false; prev = null; return; }
        if (prev && !g.par && Math.abs(p[1] - prev[1]) > spanY * 1.5) pen = false;
        d += (pen ? L : M)(X(p[0]), Y(p[1])); pen = true; prev = p;
      });
      if (!d) return; const n = ink.next();
      ink.raw(`<g clip-path="url(#${clip})">`); ink.path(d, 'bd-curve', g.c, { i: n, dash: g.dash }); ink.raw('</g>');
      if (g.label) { const vis = pts.filter(p => Number.isFinite(p[1]) && p[1] > y0 && p[1] < y1 && p[0] >= x0 && p[0] <= x1); const at = [0.88, 0.78, 0.66, 0.54, 0.42, 0.3, 0.18, 0.08].map(f => vis[Math.floor(vis.length * f)]).filter(Boolean).map(p => [X(p[0]), Y(p[1])]); if (at.length) labels.push({ at, t: g.label, c: g.c, n }); }
    });
    // where labels can go: as far as possible from the curves and from labels already placed
    // what is drawn: the curves, the axes, the dashed lines, the segments and the points
    const ink2 = []; curves.forEach(pts => pts.forEach(p => { if (Number.isFinite(p[1]) && p[1] >= y0 && p[1] <= y1 && p[0] >= x0 && p[0] <= x1) ink2.push([X(p[0]), Y(p[1])]); }));
    const line = (a, b, c, d) => { const n = Math.max(2, Math.ceil(Math.hypot(c - a, d - b) / 6)); for (let k = 0; k <= n; k++) ink2.push([a + (c - a) * k / n, b + (d - b) * k / n]); };
    line(pl, ax, W - pr, ax); line(ay, pt, ay, H - pb);
    sp.vlines.forEach(v => { if (v.v >= x0 && v.v <= x1) line(X(v.v), pt, X(v.v), H - pb); }); sp.hlines.forEach(v => { if (v.v >= y0 && v.v <= y1) line(pl, Y(v.v), W - pr, Y(v.v)); });
    sp.segments.forEach(g => line(X(g.from[0]), Y(g.from[1]), X(g.to[0]), Y(g.to[1]))); sp.points.forEach(q => ink2.push([X(q.x), Y(q.y)]));
    // how good a spot is for a label box (x..x+w, baseline y, about 13px tall): clear of the ink, and never on
    // top of another label (that costs the most); -100 if it would leave the plot
    const room = (x, y, w) => {
      if (x < pl || x + w > W - pr || y - 11 < pt - 2 || y + 2 > H - pb + 2) return -100;
      let c = 1e9, t = 1e9;
      for (const q of ink2) { const dx = Math.max(0, x - q[0], q[0] - (x + w)), dy = Math.max(0, (y - 11) - q[1], q[1] - (y + 2)); c = Math.min(c, Math.hypot(dx, dy)); }
      for (const o of taken) { const dx = Math.max(0, Math.abs(o.x - (x + w / 2)) - (w + o.w) / 2), dy = Math.max(0, Math.abs(o.y - y) - 13); t = Math.min(t, Math.hypot(dx, dy)); }
      return Math.min(c, 18) + (t < 1 ? -40 : Math.min(t, 18));
    };
    const textW = t => pretty(t).length * 7.2 + 4;
    const best = (cands, w) => cands.reduce((b, c, k) => { const r = room(c.x, c.y, w) - k * 0.3; return r > b.r ? Object.assign({ r }, c) : b; }, { r: -1e9 });
    const place = (t, cands, o) => { const w = textW(t); const b = best(cands, w); if (b.r <= -90) return; taken.push({ x: b.x + w / 2, y: b.y, w }); ink.text(b.x, b.y, lab(t), 'bd-lab', Object.assign({}, o)); };
    // asymptotes and guide lines
    sp.vlines.forEach(v => { if (v.v < x0 || v.v > x1) return; const n = ink.next(); ink.path(`${M(X(v.v), pt)}${L(X(v.v), H - pb)}`, 'bd-guide', 5, { i: n, dash: true }); if (v.label) { const w = textW(v.label); place(v.label, [[pt + 12, 1], [pt + 12, -1], [H - pb - 6, 1], [H - pb - 6, -1], [(pt + H - pb) / 2, 1]].map(([y, sd]) => ({ x: sd > 0 ? X(v.v) + 5 : X(v.v) - 5 - w, y })), { i: n }); } });
    sp.hlines.forEach(v => { if (v.v < y0 || v.v > y1) return; const n = ink.next(); ink.path(`${M(pl, Y(v.v))}${L(W - pr, Y(v.v))}`, 'bd-guide', 5, { i: n, dash: true }); if (v.label) { const w = textW(v.label); place(v.label, [[W - pr - 4 - w, -6], [pl + 6, -6], [W - pr - 4 - w, 15], [pl + 6, 15]].map(([x, dy]) => ({ x, y: Y(v.v) + dy })), { i: n }); } });
    // segments and vectors
    sp.segments.forEach(s => { const n = ink.next(); const [a, b] = [[X(s.from[0]), Y(s.from[1])], [X(s.to[0]), Y(s.to[1])]]; ink.path(`${M(a[0], a[1])}${L(b[0], b[1])}`, 'bd-seg', s.c, { i: n, dash: s.dash }); if (s.arrow) head(ink, a[0], a[1], b[0], b[1], s.c, n); if (s.label) { const w = textW(s.label), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l; place(s.label, [[1, 12], [-1, 12], [1, 20], [-1, 20]].map(([sd, d]) => ({ x: mx + sd * nx * d - w / 2, y: my + sd * ny * d + 4 })), { i: n, c: s.c }); } });
    // the curves' names, then the points on top
    labels.forEach(l => { const w = textW(l.t); place(l.t, [].concat(...l.at.map(([x, y]) => [{ x: x + 9, y: y - 10 }, { x: x - 9 - w, y: y - 10 }, { x: x + 9, y: y + 19 }, { x: x - 9 - w, y: y + 19 }, { x: x + 12, y: y + 4 }, { x: x - 12 - w, y: y + 4 }, { x: x + 16, y: y - 22 }, { x: x - 16 - w, y: y - 22 }, { x: x + 16, y: y + 30 }, { x: x - 16 - w, y: y + 30 }])), { i: l.n, c: l.c }); });
    sp.points.forEach(p => { if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return; const n = ink.next(); const px = X(p.x), py = Y(p.y); ink.dot(px, py, p.c, p.open, n); if (p.label) { const w = textW(p.label); place(p.label, [{ x: px + 8, y: py - 8 }, { x: px - 8 - w, y: py - 8 }, { x: px + 8, y: py + 17 }, { x: px - 8 - w, y: py + 17 }, { x: px - w / 2, y: py - 13 }, { x: px - w / 2, y: py + 22 }, { x: px + 11, y: py + 4 }, { x: px - 11 - w, y: py + 4 }], { i: n }); } });
    sp.notes.forEach(o => { if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) return; ink.text(X(o.x), Y(o.y), lab(o.text), 'bd-note', { anchor: 'middle', i: ink.next() }); });
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- number line ---------- */
  function numberline(sp) {
    const W = 360, H = 96, pl = 18, pr = 18, y = 58;
    const X = x => pl + 10 + (x - sp.min) / (sp.max - sp.min) * (W - pl - pr - 20);
    const ink = Ink(); const n0 = ink.next();
    ink.path(`${M(pl, y)}${L(W - pr, y)}`, 'bd-axis', null, { i: n0 }); head(ink, W - pr - 10, y, W - pr, y, null, n0); head(ink, pl + 10, y, pl, y, null, n0);
    const step = sp.step || niceStep(sp.max - sp.min, 10); const tk = ticks(sp.min, sp.max, step);
    ink.raw(`<g class="bd-ticks">${tk.map(v => `<path d="${M(X(v), y - 5)}${L(X(v), y + 5)}"/>`).join('')}</g>`);
    tk.filter((v, k) => tk.length <= 13 || k % Math.ceil(tk.length / 13) === 0).forEach(v => ink.text(X(v), y + 20, fmt(v, step), 'bd-tick', { anchor: 'middle', i: n0 }));
    const lanes = [];
    sp.intervals.forEach(v => {
      const n = ink.next(); const lo = v.from === null ? -Infinity : v.from, hi = v.to === null ? Infinity : v.to;
      let lane = 0; while (lanes.some(o => o.lane === lane && lo <= o.hi && hi >= o.lo)) lane++; lanes.push({ lo, hi, lane }); const lift = y - lane * 9; const a = v.from === null ? pl + 2 : X(Math.max(sp.min, v.from)), b = v.to === null ? W - pr - 2 : X(Math.min(sp.max, v.to));
      ink.path(`${M(a, lift)}${L(b, lift)}`, 'bd-band', v.c, { i: n });
      if (v.from === null) head(ink, a + 10, lift, a, lift, v.c, n); else ink.dot(a, lift, v.c, v.left === 'open', n);
      if (v.to === null) head(ink, b - 10, lift, b, lift, v.c, n); else ink.dot(b, lift, v.c, v.right === 'open', n);
    });
    sp.points.forEach(p => { if (p.x < sp.min || p.x > sp.max) return; const n = ink.next(); ink.dot(X(p.x), y, p.c, p.open, n); if (p.label) ink.text(X(p.x), y - 16, lab(p.label), 'bd-lab', { anchor: 'middle', i: n }); });
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- figure: shapes in Bo's own coordinates, the same scale both ways, y up ---------- */
  function figure(sp) {
    const pts = []; sp.shapes.forEach(s => {
      if (s.at) pts.push(s.at); if (s.from) pts.push(s.from); if (s.to) pts.push(s.to); if (s.points) pts.push(...s.points);
      if (s.kind === 'circle') { pts.push([s.center[0] - s.r, s.center[1] - s.r], [s.center[0] + s.r, s.center[1] + s.r]); }
      if (s.kind === 'rect') pts.push([s.at[0] + s.w, s.at[1] + s.h]);
    });
    let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
    if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1; } if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const W = 360, m = 30; const k = Math.min((W - 2 * m) / (x1 - x0), (300 - 2 * m) / (y1 - y0)); const H = Math.max(150, Math.round((y1 - y0) * k + 2 * m));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const X = x => ox + (x - x0) * k, Y = y => H - oy - (y - y0) * k;
    const cx = X((x0 + x1) / 2), cy = Y((y0 + y1) / 2);
    const ink = Ink();
    const away = (x, y, d) => { const dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy) || 1; return [x + dx / l * d, y + dy / l * d]; };
    sp.shapes.forEach(s => {
      const n = ink.next(); const c = s.c;
      if (s.kind === 'polygon' || s.kind === 'curve') {
        const P = s.points.map(p => [X(p[0]), Y(p[1])]); const d = P.map((p, j) => (j ? L : M)(p[0], p[1])).join('') + (s.kind === 'polygon' ? 'Z' : '');
        if (s.fill && s.kind === 'polygon') ink.fill(d, c, n); ink.path(d, 'bd-shape', c, { i: n, dash: s.dash });
        (s.labels || []).forEach((t, j) => { if (!t || !P[j]) return; const [lx, ly] = away(P[j][0], P[j][1], 13); ink.text(lx, ly + 4, lab(t), 'bd-lab', { anchor: 'middle', i: n }); });
        if (s.label) { const gx = P.reduce((a, p) => a + p[0], 0) / P.length, gy = P.reduce((a, p) => a + p[1], 0) / P.length; ink.text(gx, gy + 4, lab(s.label), 'bd-note', { anchor: 'middle', i: n }); }
      } else if (s.kind === 'segment' || s.kind === 'arrow') {
        const a = [X(s.from[0]), Y(s.from[1])], b = [X(s.to[0]), Y(s.to[1])]; ink.path(`${M(a[0], a[1])}${L(b[0], b[1])}`, 'bd-shape', c, { i: n, dash: s.dash });
        if (s.kind === 'arrow') head(ink, a[0], a[1], b[0], b[1], c, n);
        if (s.label) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l; if ((mx + nx - cx) * nx + (my + ny - cy) * ny < 0) { nx = -nx; ny = -ny; } ink.text(mx + nx * 12, my + ny * 12 + 4, lab(s.label), 'bd-lab', { anchor: 'middle', i: n, c }); }
      } else if (s.kind === 'circle') {
        const x = X(s.center[0]), y = Y(s.center[1]), r = s.r * k;
        const d = `${M(x + r, y)}A${r1(r)} ${r1(r)} 0 1 0 ${r1(x - r)} ${r1(y)}A${r1(r)} ${r1(r)} 0 1 0 ${r1(x + r)} ${r1(y)}`;
        if (s.fill) ink.fill(d, c, n); ink.path(d, 'bd-shape', c, { i: n, dash: s.dash });
        if (s.label) ink.text(x + r * 0.72 + 4, y - r * 0.72 - 4, lab(s.label), 'bd-lab', { i: n, c });
      } else if (s.kind === 'angle') {
        const vx = X(s.at[0]), vy = Y(s.at[1]); const a1 = Math.atan2(Y(s.from[1]) - vy, X(s.from[0]) - vx), a2 = Math.atan2(Y(s.to[1]) - vy, X(s.to[0]) - vx);
        let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const r = 18; const mid = a1 + da / 2;
        if (s.right) { const u = [Math.cos(a1), Math.sin(a1)], v = [Math.cos(a2), Math.sin(a2)], q = 11; ink.path(`${M(vx + u[0] * q, vy + u[1] * q)}${L(vx + (u[0] + v[0]) * q, vy + (u[1] + v[1]) * q)}${L(vx + v[0] * q, vy + v[1] * q)}`, 'bd-mark', c, { i: n }); }
        else ink.path(`${M(vx + r * Math.cos(a1), vy + r * Math.sin(a1))}A${r} ${r} 0 0 ${da > 0 ? 1 : 0} ${r1(vx + r * Math.cos(a2))} ${r1(vy + r * Math.sin(a2))}`, 'bd-mark', c, { i: n });
        if (s.label) ink.text(vx + 32 * Math.cos(mid), vy + 32 * Math.sin(mid) + 4, lab(s.label), 'bd-lab', { anchor: 'middle', i: n, c });
      } else if (s.kind === 'point') {
        const x = X(s.at[0]), y = Y(s.at[1]); ink.dot(x, y, c, false, n); const t = s.label || s.text; if (t) { const [lx, ly] = away(x, y, 14); ink.text(lx, ly + 4, lab(t), 'bd-lab', { anchor: lx < x - 2 ? 'end' : lx > x + 2 ? 'start' : 'middle', i: n }); }
      } else if (s.kind === 'text') {
        ink.text(X(s.at[0]), Y(s.at[1]) + 4, lab(s.text || s.label), 'bd-note', { anchor: 'middle', i: n });
      } else if (s.kind === 'rect') {
        const x = X(s.at[0]), y = Y(s.at[1] + s.h), w = s.w * k, h = s.h * k; const d = `${M(x, y)}${L(x + w, y)}${L(x + w, y + h)}${L(x, y + h)}Z`;
        if (s.fill) ink.fill(d, c, n); ink.path(d, 'bd-shape', c, { i: n, dash: s.dash });
        const t = s.text || s.label; if (t) ink.text(x + w / 2, y + h / 2 + 4, lab(t), 'bd-lab', { anchor: 'middle', i: n });
      }
    });
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- bar chart or histogram ---------- */
  function bars(sp) {
    const W = 360, H = 230, pl = 34, pr = 10, pt = 14, pb = sp.xlabel ? 40 : 28;
    const hi = Math.max(0, ...sp.bars.map(b => b.value)), lo = Math.min(0, ...sp.bars.map(b => b.value)); const step = niceStep((hi - lo) || 1, 5);
    const top = Math.ceil(hi / step) * step || step, bot = Math.floor(lo / step) * step;
    const Y = v => pt + (top - v) / (top - bot) * (H - pt - pb); const n = sp.bars.length; const slot = (W - pl - pr) / n; const bw = sp.hist ? slot : slot * 0.64;
    const ink = Ink(); const n0 = ink.next();
    ink.raw(`<g class="bd-grid">${ticks(bot, top, step).map(v => `<path d="${M(pl, Y(v))}${L(W - pr, Y(v))}"/>`).join('')}</g>`);
    ticks(bot, top, step).forEach(v => ink.text(pl - 5, Y(v) + 3.5, fmt(v, step), 'bd-tick', { anchor: 'end', i: n0 }));
    ink.path(`${M(pl, Y(0))}${L(W - pr, Y(0))}`, 'bd-axis', null, { i: n0 }); ink.path(`${M(pl, pt - 4)}${L(pl, H - pb)}`, 'bd-axis', null, { i: n0 });
    sp.bars.forEach((b, k) => {
      const i = ink.next(); const x = pl + slot * k + (slot - bw) / 2; const ya = Y(Math.max(0, b.value)), yb = Y(Math.min(0, b.value));
      const c = sp.mark === k ? 1 : 0; const d = `${M(x, yb)}${L(x, ya)}${L(x + bw, ya)}${L(x + bw, yb)}`;
      ink.fill(`${d}Z`, c, i); ink.path(d, 'bd-shape', c, { i });
      if (n <= 12) ink.text(x + bw / 2, ya - 5, fmt(b.value, b.value % 1 ? 0.01 : 1), 'bd-tick', { anchor: 'middle', i });
      if (b.label) ink.text(x + bw / 2, H - pb + 14, esc(b.label.slice(0, n > 10 ? 5 : 12)), 'bd-tick', { anchor: 'middle', i });
    });
    if (sp.ylabel) ink.text(pl + 4, pt + 4, lab(sp.ylabel), 'bd-axl', { i: n0 });
    if (sp.xlabel) ink.text((W + pl) / 2, H - 6, lab(sp.xlabel), 'bd-axl', { anchor: 'middle', i: n0 });
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- normal curve: the shaded share and the mean ± 1, 2, 3 SD ---------- */
  function normal(sp) {
    const W = 360, H = 210, pl = 12, pr = 12, pt = 16, pb = sp.label ? 44 : 30; const mu = sp.mean, s = sp.sd;
    const x0 = mu - 3.6 * s, x1 = mu + 3.6 * s; const pdf = x => Math.exp(-0.5 * ((x - mu) / s) ** 2); const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = v => H - pb - v * (H - pb - pt);
    const ink = Ink(); const n0 = ink.next();
    ink.path(`${M(pl, Y(0))}${L(W - pr, Y(0))}`, 'bd-axis', null, { i: n0 });
    if (sp.shade) { const a = Math.max(x0, sp.from === null ? x0 : sp.from), b = Math.min(x1, sp.to === null ? x1 : sp.to); if (b > a) { let d = M(X(a), Y(0)); for (let k = 0; k <= 80; k++) { const x = a + (b - a) * k / 80; d += L(X(x), Y(pdf(x))); } ink.fill(`${d}${L(X(b), Y(0))}Z`, 0, ink.next()); } }
    let d = ''; for (let k = 0; k <= 200; k++) { const x = x0 + (x1 - x0) * k / 200; d += (k ? L : M)(X(x), Y(pdf(x))); } ink.path(d, 'bd-curve', 0, { i: ink.next() });
    const n1 = ink.next();
    [-3, -2, -1, 0, 1, 2, 3].forEach(k => { const x = mu + k * s; ink.raw(`<path d="${M(X(x), Y(0) - 4)}${L(X(x), Y(0) + 4)}" class="bd-tickline"/>`); ink.text(X(x), Y(0) + 16, fmt(x, s / 10), 'bd-tick', { anchor: 'middle', i: n1 }); });
    ink.raw(`<path d="${M(X(mu), Y(0))}${L(X(mu), Y(1))}" class="bd-guide bd-c5 bd-dash bd-pop" style="--i:${n1}"/>`);
    sp.marks.forEach(m => { if (m.x < x0 || m.x > x1) return; const n = ink.next(); ink.path(`${M(X(m.x), Y(0))}${L(X(m.x), Y(pdf(m.x)) - 6)}`, 'bd-guide', 1, { i: n }); if (m.label) ink.text(X(m.x), Y(pdf(m.x)) - 10, lab(m.label), 'bd-lab', { anchor: 'middle', i: n }); });
    if (sp.label) ink.text(W / 2, H - 8, lab(sp.label), 'bd-axl', { anchor: 'middle', i: n1 });
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- probability tree ---------- */
  function tree(sp) {
    const depth = n => n.children.length ? 1 + Math.max(...n.children.map(depth)) : 1;
    const leaves = n => n.children.length ? n.children.reduce((a, c) => a + leaves(c), 0) : 1;
    const D = Math.max(...sp.branches.map(depth)); const total = sp.branches.reduce((a, b) => a + leaves(b), 0);
    const tw = t => pretty(t).length * 7.3;
    // the widest label at each level, and the widest result at the ends
    const lw = Array(D + 1).fill(0); let rw = 0;
    (function walk(ns, d) { ns.forEach(n => { lw[d] = Math.max(lw[d], tw(n.label)); if (!n.children.length && n.result) rw = Math.max(rw, tw(n.result) + 10); walk(n.children, d + 1); }); })(sp.branches, 1);
    const pl = 14, edge0 = 76; const need = pl + 8 + lw.reduce((a, b) => a + b, 0) + D * (edge0 + 8) + rw + 12; const W = Math.max(360, Math.round(need));
    const edge = (W - pl - 8 - lw.reduce((a, b) => a + b, 0) - D * 8 - rw - 12) / D;
    const inX = [0], outX = [pl + 4]; for (let d = 1; d <= D; d++) { inX[d] = outX[d - 1] + edge; outX[d] = inX[d] + lw[d] + 8; }
    const rowH = 30, H = Math.max(110, total * rowH + 24); const ink = Ink(); let row = 0;
    const lay = (n, d) => { n.d = d; if (!n.children.length) n.y = 12 + rowH * (row++ + 0.5); else { n.children.forEach(c => lay(c, d + 1)); n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2; } };
    sp.branches.forEach(b => lay(b, 1)); const root = { y: (sp.branches[0].y + sp.branches[sp.branches.length - 1].y) / 2 };
    ink.dot(pl, root.y, 5, false, ink.next()); if (sp.root) ink.text(pl - 2, root.y - 10, lab(sp.root), 'bd-tick', { i: 0 });
    const draw = (fx, fy, n) => {
      const i = ink.next(); const tx = inX[n.d] - 4, ty = n.y;
      ink.path(`${M(fx, fy)}${L(tx, ty)}`, 'bd-shape', 0, { i });
      if (n.p) { const mx = (fx + tx) / 2, my = (fy + ty) / 2; const up = ty <= fy; ink.text(mx, my + (up ? -6 : 14), lab(n.p), 'bd-prob', { anchor: 'middle', i }); }
      ink.text(inX[n.d], ty + 4.5, lab(n.label), 'bd-lab', { i });
      if (!n.children.length && n.result) ink.text(outX[n.d] + 4, ty + 4.5, lab(n.result), 'bd-note', { i });
      n.children.forEach(c => draw(inX[n.d] + tw(n.label) + 5, ty, c));
    };
    sp.branches.forEach(b => draw(pl + 5, root.y, b));
    return { w: W, h: H, body: ink.out() };
  }

  /* ---------- table (HTML, so $TeX$ in cells is typeset) ---------- */
  const cell = t => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const table = sp => `<div class="bd-table-wrap"><table class="bd-table">${sp.head.length ? `<thead><tr>${sp.head.map(h => `<th scope="col">${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${sp.rows.map(r => `<tr>${r.map((c, j) => j === 0 && sp.head.length ? `<th scope="row">${cell(c)}</th>` : `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  /* ---------- in words: for screen readers, copying and the chat ---------- */
  function plain(sp) {
    if (!sp) return 'A drawing';
    const P = x => pretty(x); const pt = p => { const c = `(${fmt(p.x)}, ${fmt(p.y)})`; const l = p.label ? P(p.label) : ''; return !l || l.replace(/\s|−/g, m => m === '−' ? '-' : '') === c.replace(/\s|−/g, m => m === '−' ? '-' : '') ? c : `${l} ${c}`; };
    let s = '';
    if (sp.type === 'graph') s = `Graph of ${sp.fns.length ? sp.fns.map(g => P(g.label || (g.f ? 'y = ' + g.f : `x = ${g.xt}, y = ${g.yt}`))).join(' and ') : 'points'}${sp.x ? ` for x from ${fmt(sp.x[0])} to ${fmt(sp.x[1])}` : ''}${sp.points.length ? `; points ${sp.points.map(pt).join(', ')}` : ''}${sp.shade ? `; shaded from x = ${fmt(sp.shade.from)} to ${fmt(sp.shade.to)}` : ''}${sp.vlines.length ? `; dashed line${sp.vlines.length > 1 ? 's' : ''} at x = ${sp.vlines.map(v => fmt(v.v)).join(', ')}` : ''}`;
    else if (sp.type === 'numberline') s = `Number line${sp.intervals.length ? ' showing ' + sp.intervals.map(v => `${v.from === null ? '−∞' : (v.left === 'open' ? '(' : '[') + fmt(v.from)} to ${v.to === null ? '∞' : fmt(v.to) + (v.right === 'open' ? ')' : ']')}`).join(' and ') : ''}${sp.points.length ? `; points at ${sp.points.map(p => fmt(p.x) + (p.open ? ' (open)' : '')).join(', ')}` : ''}`;
    else if (sp.type === 'figure') s = `Figure: ${sp.shapes.map(x => x.kind === 'polygon' ? `${x.points.length === 3 ? 'triangle' : 'polygon'}${x.labels.length ? ' ' + x.labels.join('') : ''}` : x.kind === 'angle' ? `${x.right ? 'right ' : ''}angle${x.label ? ' ' + P(x.label) : ''}` : `${x.kind}${x.label || x.text ? ' ' + P(x.label || x.text) : ''}`).slice(0, 8).join(', ')}`;
    else if (sp.type === 'table') s = `Table${sp.head.length ? ' of ' + sp.head.map(P).join(', ') : ''}: ${sp.rows.map(r => r.map(P).join(', ')).join('; ')}`;
    else if (sp.type === 'bars') s = `${sp.hist ? 'Histogram' : 'Bar chart'}${sp.ylabel ? ' of ' + P(sp.ylabel) : ''}: ${sp.bars.map(b => `${b.label || '?'} ${fmt(b.value)}`).join(', ')}`;
    else if (sp.type === 'normal') s = `Normal curve, mean ${fmt(sp.mean)}, standard deviation ${fmt(sp.sd)}${sp.shade ? `, shaded ${sp.from === null ? 'below' : 'from ' + fmt(sp.from)} ${sp.to === null ? (sp.from === null ? '' : 'up') : (sp.from === null ? fmt(sp.to) : 'to ' + fmt(sp.to))}` : ''}`;
    else if (sp.type === 'tree') { const walk = (n, pre) => n.children.length ? n.children.map(c => walk(c, pre.concat(n))).join('; ') : pre.concat(n).map(x => `${P(x.label)}${x.p ? ' (' + P(x.p) + ')' : ''}`).join(' then ') + (n.result ? ` = ${P(n.result)}` : ''); s = `Probability tree: ${sp.branches.map(b => walk(b, [])).join('; ')}`; }
    return (s + (sp.caption ? `. ${P(sp.caption)}` : '')).replace(/\s+/g, ' ').trim();
  }

  /* ---------- the drawing as markup ---------- */
  function html(sp, animate) {
    if (!sp) return '';
    const id = `bd${++uid}`; let inner;
    try {
      if (sp.type === 'table') inner = table(sp);
      else { const g = ({ graph, numberline, figure, bars, normal, tree })[sp.type](sp, id); inner = `${svgOpen(g.w, g.h, plain(sp), id)}${g.body}</svg>`; }
    } catch (e) { return `<p class="bd-bad">This drawing could not be shown.</p>`; }
    return `<div class="bd bd-${sp.type}${animate ? ' bd-anim' : ''}">${inner}</div>${sp.caption ? `<figcaption class="bd-cap">${esc(sp.caption).replace(/\$([^$]+)\$/g, '\\($1\\)')}</figcaption>` : ''}`;
  }

  App.boDraw = { parse, html, plain, pretty };
})(window);
