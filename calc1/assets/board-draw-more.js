/* ============================================================
   More of Bo's drawings, so he can draw anything (added to assets/board-draw.js through App.boDraw.kind and
   graphPart; the prompts that describe them are MH_AI_DRAW and the call's draw_on_board tool in api/ai.php):
     svg       any diagram he writes as SVG (a cell, a circuit, a map, a timeline, a molecule, a free-body sketch):
               read with DOMParser and rebuilt from an allowlist (shapes, paths, text, gradients, markers), so no
               script, link, image, event or style can come through; ids are renamed so two drawings never clash.
               It sits on a white sheet in both themes, so his colours read as he chose them.
     image     a picture made by an image model from his description (a realistic or illustrated scene, a labelled
               diagram of something physical). The page asks the server (ai_image) for it, which costs credits and
               is kept, so the same picture is never paid for twice; meanwhile "Bo is drawing…" shows.
     surface   3D: a surface z = f(x, y), curves (x(t), y(t), z(t)) and points, shaded by height; drag (or the
               arrow keys) to turn it.
   On a graph (graphPart): implicit curves ("x^2 + y^2 = 25", "y^2 = x^3 - x"), polar curves (r = 1 + cos θ),
   slope fields (dy/dx = f(x, y)) with solution curves through given points, vector fields ([P, Q]), and contour
   maps of z = f(x, y), filled or as level lines.
   Any drawing that is not a graph has View large (the button in its corner): it fills the screen, to zoom and pan.
   Functions of x and y are read by compile2 below (no eval), like App.compileExpr is for x alone.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const D = App && App.boDraw; if (!D || !D.kind) return;
  const H = D.h; const { Ink, M, L, esc, pretty, lab, sig, str, list, col, svgOpen, r1 } = H;
  let uid = 0;

  /* ---------- functions of several variables: x, y (and z, t, theta) ---------- */
  const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, floor: Math.floor, ceil: Math.ceil, sign: Math.sign, sgn: Math.sign };
  const CONST = { pi: Math.PI, e: Math.E };
  function tidy2(src) {
    let s = String(src == null ? '' : src).slice(0, 300);
    s = s.replace(/\\left|\\right|\\,|\\;|\\!/g, '').replace(/\\cdot|\\times|·|×/g, '*').replace(/÷/g, '/').replace(/−|–/g, '-').replace(/π/g, 'pi').replace(/θ|\\theta/g, 'theta').replace(/\*\*/g, '^');
    for (let k = 0; k < 4; k++) s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
    s = s.replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|pi)/g, '$1').replace(/[{}]/g, m => (m === '{' ? '(' : ')'));
    s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, '');
    return s;
  }
  // compile2("x^2 - y^2", ["x", "y"]) → (x, y) => value, or null
  function compile2(src, vars) {
    const s = tidy2(src); if (!s || s.length > 300) return null;
    const names = Object.keys(FUN).concat(Object.keys(CONST), vars).sort((a, b) => b.length - a.length);
    let i = 0; const peek = () => s[i];
    const digit = c => c >= '0' && c <= '9', alpha = c => /[a-z]/i.test(c || '');
    const expect = c => { if (s[i] !== c) throw 0; i++; };
    function expr() { let l = term(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(), a = l; l = op === '+' ? v => a(v) + r(v) : v => a(v) - r(v); } return l; }
    function term() { let l = unary(); for (;;) { const c = peek(); if (c === '*' || c === '/') { i++; const r = unary(), a = l; l = c === '*' ? v => a(v) * r(v) : v => a(v) / r(v); } else if (c && (digit(c) || alpha(c) || c === '(' || c === '.')) { const r = power(), a = l; l = v => a(v) * r(v); } else return l; } }
    function unary() { if (peek() === '-') { i++; const r = unary(); return v => -r(v); } if (peek() === '+') { i++; return unary(); } return power(); }
    function power() { const b = atom(); if (peek() === '^') { i++; const e = unary(); return v => Math.pow(b(v), e(v)); } return b; }
    function atom() {
      const c = peek(); if (c === undefined) throw 0;
      if (digit(c) || c === '.') { let j = i; while (j < s.length && (digit(s[j]) || s[j] === '.')) j++; if ((s[j] === 'e' || s[j] === 'E') && (digit(s[j + 1]) || (/[+-]/.test(s[j + 1] || '') && digit(s[j + 2])))) { j += 2; while (j < s.length && digit(s[j])) j++; } const n = parseFloat(s.slice(i, j)); if (isNaN(n)) throw 0; i = j; return () => n; }
      if (c === '(') { i++; const e = expr(); expect(')'); return e; }
      if (c === '|') { i++; const e = expr(); expect('|'); return v => Math.abs(e(v)); }
      if (alpha(c)) {
        const name = names.find(n => s.startsWith(n, i)); if (!name) throw 0; i += name.length;
        if (FUN[name]) { const F = FUN[name]; let a; if (peek() === '(') { i++; a = expr(); expect(')'); } else a = unary(); return v => F(a(v)); }
        if (name in CONST) { const k = CONST[name]; return () => k; }
        const at = vars.indexOf(name); return v => v[at];
      }
      throw 0;
    }
    try {
      const f = expr(); if (i < s.length) return null;
      const g = (...a) => { const r = f(a); return typeof r === 'number' ? r : NaN; };
      g(0.37, 0.61, 0.23); return g;
    } catch (e) { return null; }
  }
  const uses = (src, v) => new RegExp(`(^|[^a-z])${v}([^a-z]|$)`, 'i').test(tidy2(src).replace(/(sqrt|exp|max|tanh|theta|sinh|cosh)/g, ''));
  // "x^2 + y^2 = 25" → "x^2 + y^2 - (25)"; "y = x^2" is not implicit (the graph draws it)
  function implicitOf(src) {
    const t = String(src || ''); const k = t.indexOf('='); if (k < 0 || t.indexOf('=', k + 1) >= 0) return null;
    const a = t.slice(0, k).trim(), b = t.slice(k + 1).trim(); if (!a || !b) return null;
    if (/^(y|f\(x\))$/i.test(a.replace(/\s/g, '')) && !uses(b, 'y')) return null;
    const F = `(${a})-(${b})`; return compile2(F, ['x', 'y']) && (uses(a, 'y') || uses(b, 'y')) ? F : null;
  }
  const num = (v, d) => { const x = D.value(v); return Number.isFinite(x) ? x : d; };
  const rng = (v, d) => { if (Array.isArray(v) && v.length >= 2) { const a = num(v[0], NaN), b = num(v[1], NaN); if (Number.isFinite(a) && Number.isFinite(b) && b > a) return [a, b]; } if (v && typeof v === 'object' && !Array.isArray(v)) return rng([v.min ?? v.from, v.max ?? v.to], d); return d; };

  /* ---------- marching squares: where F(x, y) = level, as line pieces in plot coordinates ---------- */
  function contourLines(F, x0, x1, y0, y1, nx, ny, level, X, Y) {
    const xs = [], ys = [], g = [];
    for (let i = 0; i <= nx; i++) xs.push(x0 + (x1 - x0) * i / nx);
    for (let j = 0; j <= ny; j++) ys.push(y0 + (y1 - y0) * j / ny);
    for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(F(xs[i], ys[j]) - level); g.push(row); }
    let d = '';
    const lerp = (a, b, va, vb) => a + (b - a) * (va / (va - vb));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], e = g[j + 1][i];
      if (![a, b, c, e].every(Number.isFinite)) continue;
      const big = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(e)); const mid = F((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2) - level;
      if (!Number.isFinite(mid) || Math.abs(mid) > big * 4 + 1e-9) continue;   // a pole (tan, 1/x), not a crossing
      const p = [];
      if ((a > 0) !== (b > 0)) p.push([lerp(xs[i], xs[i + 1], a, b), ys[j]]);
      if ((b > 0) !== (c > 0)) p.push([xs[i + 1], lerp(ys[j], ys[j + 1], b, c)]);
      if ((e > 0) !== (c > 0)) p.push([lerp(xs[i], xs[i + 1], e, c), ys[j + 1]]);
      if ((a > 0) !== (e > 0)) p.push([xs[i], lerp(ys[j], ys[j + 1], a, e)]);
      if (p.length === 2) d += `${M(X(p[0][0]), Y(p[0][1]))}${L(X(p[1][0]), Y(p[1][1]))}`;
      else if (p.length === 4) d += `${M(X(p[0][0]), Y(p[0][1]))}${L(X(p[1][0]), Y(p[1][1]))}${M(X(p[2][0]), Y(p[2][1]))}${L(X(p[3][0]), Y(p[3][1]))}`;
    }
    return d;
  }
  // the box around where F = 0, sampled on a window (for a graph with no range given)
  function zeroBox(F, x0, x1, y0, y1, n = 90) {
    let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity; const v = [];
    for (let j = 0; j <= n; j++) { v.push([]); for (let i = 0; i <= n; i++) v[j].push(F(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n)); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = [v[j][i], v[j][i + 1], v[j + 1][i], v[j + 1][i + 1]]; if (!q.every(Number.isFinite)) continue;
      if (q.some(a => a > 0) && q.some(a => a <= 0)) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * j / n; lx = Math.min(lx, x); hx = Math.max(hx, x); ly = Math.min(ly, y); hy = Math.max(hy, y); }
    }
    return Number.isFinite(lx) ? [lx, hx + (x1 - x0) / n, ly, hy + (y1 - y0) / n] : null;
  }
  // a colour for 0..1 (deep blue → teal → yellow → orange): heat maps and 3D surfaces
  const RAMP = [[43, 85, 184], [33, 150, 160], [116, 190, 90], [240, 200, 60], [232, 110, 40]];
  function ramp(t) { t = Math.max(0, Math.min(1, t)) * (RAMP.length - 1); const k = Math.min(RAMP.length - 2, Math.floor(t)), f = t - k; const a = RAMP[k], b = RAMP[k + 1]; return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * f)); }
  const rgb = (c, l = 1) => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * l)))).join(',')})`;

  /* ---------- on a graph: implicit and polar curves, fields, contour maps ---------- */
  D.graphPart({
    alias: ['implicit', 'implicitcurve', 'conic', 'conics', 'ellipse', 'hyperbola', 'polar', 'polarcurve', 'polargraph', 'rose', 'cardioid', 'slopefield', 'directionfield', 'vectorfield', 'field', 'differentialequation', 'ode', 'contour', 'contours', 'contourplot', 'contourmap', 'levelcurves', 'levelcurve', 'levelsets', 'heatmap', 'topographic'],
    test: (o, t) => !!(o.implicit || o.polar || o.slopefield || o.slope_field || o.vectorfield || o.vector_field || o.field || o.contour || o.heatmap || (typeof o.r === 'string' && !Number.isFinite(D.value(o.r)))),
    make(o, sp, P) {
      const type = String(o.type || o.kind || '').toLowerCase(); let any = false;
      // polar curves: r = f(θ), drawn as x = r cos θ, y = r sin θ
      const polar = [].concat(list(o.polar, 4), typeof o.r === 'string' ? [{ r: o.r, label: o.label, theta: o.theta ?? o.t }] : [], list(o.fns ?? o.functions ?? o.curves, 6).filter(g => g && typeof g === 'object' && typeof g.r === 'string'));
      polar.forEach((g, k) => {
        if (typeof g === 'string') g = { r: g }; if (!g || typeof g !== 'object') return;
        const r = str(String(g.r ?? g.f ?? '').replace(/^\s*r\s*=\s*/i, '').replace(/θ|\\theta|theta/g, 't'), 160); if (!r) return;
        const xt = `(${r})*cos(t)`, yt = `(${r})*sin(t)`; if (!H.compile(xt, P) || !H.compile(yt, P)) return;
        sp.fns.push({ f: '', xt, yt, t: rng(g.theta ?? g.t ?? g.range, [0, 2 * Math.PI]), label: str(g.label, 40) || `r = ${String(g.r).replace(/^\s*r\s*=\s*/i, '')}`.slice(0, 40), domain: null, c: col(g.color, sp.fns.length % 5), dash: !!g.dash });
        if (o.equal !== false) sp.equal = true; any = true;
      });
      // implicit curves: an equation in x and y
      const imp = [].concat(list(o.implicit, 4), list(o.fns ?? o.functions ?? o.curves ?? o.equations, 6).map(g => typeof g === 'string' ? g : g && typeof g === 'object' ? { eq: g.eq ?? g.equation ?? g.f ?? g.fn ?? g.expr, label: g.label, color: g.color } : null), typeof (o.equation ?? o.f) === 'string' && /=/.test(o.equation ?? o.f) ? [o.equation ?? o.f] : []);
      sp.implicit = [];
      imp.forEach(g => {
        if (!g) return; const src = typeof g === 'string' ? g : String(g.eq ?? ''); const F = implicitOf(src); if (!F || sp.implicit.some(q => q.F === F) || sp.implicit.length >= 4) return;
        sp.implicit.push({ F, label: str(typeof g === 'object' && g.label ? g.label : src, 40), c: col(typeof g === 'object' ? g.color : null, (sp.fns.length + sp.implicit.length) % 5) }); any = true;
      });
      if (sp.implicit.length && o.equal !== false && !sp.y) sp.equal = true;
      // a slope field (dy/dx = f(x, y)) or a vector field ([P, Q])
      const fl = o.slopefield ?? o.slope_field ?? o.vectorfield ?? o.vector_field ?? o.field ?? (/(slope|direction|vector)field|^field$|^ode$|differential/.test(type) ? o : null);
      sp.field = null;
      if (fl) {
        const f = typeof fl === 'string' ? fl : fl.dy ?? fl.dydx ?? fl.slope ?? (fl === o ? o.f ?? o.equation ?? o.dy : fl.f);
        const vx = typeof fl === 'object' ? fl.vx ?? fl.P ?? fl.dx ?? (Array.isArray(fl.v) ? fl.v[0] : null) : null, vy = typeof fl === 'object' ? fl.vy ?? fl.Q ?? (Array.isArray(fl.v) ? fl.v[1] : null) : null;
        const vec = Array.isArray(fl) && fl.length === 2 ? fl : vx != null && vy != null && !/slope|direction/.test(type) ? [vx, vy] : null;
        if (vec && compile2(vec[0], ['x', 'y']) && compile2(vec[1], ['x', 'y'])) sp.field = { kind: 'vector', P: str(vec[0], 120), Q: str(vec[1], 120) };
        else if (f != null) { const s = String(f).replace(/^\s*(dy\s*\/\s*dx|y'|y′)\s*=\s*/i, ''); if (compile2(s, ['x', 'y'])) sp.field = { kind: 'slope', f: str(s, 120) }; }
        if (sp.field) {
          sp.field.through = list((typeof fl === 'object' && !Array.isArray(fl) ? fl.through ?? fl.solutions ?? fl.initial : null) ?? o.through ?? o.solutions ?? o.initial, 4).map(p => Array.isArray(p) ? [num(p[0], NaN), num(p[1], NaN)] : p && typeof p === 'object' ? [num(p.x, NaN), num(p.y, NaN)] : null).filter(p => p && p.every(Number.isFinite));
          sp.field.label = sp.field.kind === 'slope' ? `dy/dx = ${sp.field.f}` : `⟨${sp.field.P}, ${sp.field.Q}⟩`; any = true;
        }
      }
      // a contour map of z = f(x, y)
      const ct = o.contour ?? o.heatmap ?? (/contour|level|heat|topo/.test(type) ? o : null); sp.contour = null;
      if (ct) {
        const z = String(typeof ct === 'string' ? ct : ct.z ?? ct.f ?? ct.fn ?? ct.function ?? (ct === o ? o.equation : '') ?? '').replace(/^\s*(z|f\(x,\s*y\))\s*=\s*/i, '');
        if (z && compile2(z, ['x', 'y'])) {
          const lv = typeof ct === 'object' ? ct.levels ?? ct.lines : null;
          sp.contour = { z: str(z, 160), levels: Array.isArray(lv) ? lv.map(v => num(v, NaN)).filter(Number.isFinite).slice(0, 16) : Math.max(3, Math.min(16, num(lv, 9))), fill: typeof ct === 'object' ? ct.fill !== false && ct.filled !== false : true, label: `z = ${str(z, 40)}` };
          if (/heat/.test(type) || (typeof ct === 'object' && ct.lines === false)) sp.contour.lines = false; any = true;
        }
      }
      return any;
    },
    extent(sp) {
      const xs = [], ys = [];
      (sp.implicit || []).forEach(q => { const F = compile2(q.F, ['x', 'y']); const w = sp.x || [-10, 10], h = sp.y || w; const b = F && zeroBox(F, w[0], w[1], h[0], h[1]); if (b) { xs.push(b[0], b[1]); ys.push(b[2], b[3]); } });
      if ((sp.field || sp.contour) && !sp.x) { xs.push(-4, 4); ys.push(-4, 4); }
      return { xs, ys };
    },
    draw(sp, g) {
      const { X, Y, x0, x1, y0, y1, W, pl, pr, pt, pb, ink, clip, labels } = g; const Hh = g.H;
      // the contour map first (under everything)
      if (sp.contour) {
        const F = compile2(sp.contour.z, ['x', 'y']);
        if (F) {
          const nx = 64, ny = Math.max(24, Math.round(64 * (Hh - pt - pb) / (W - pl - pr))); const vals = []; let lo = Infinity, hi = -Infinity;
          for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = F(x0 + (x1 - x0) * (i + 0.5) / nx, y1 - (y1 - y0) * (j + 0.5) / ny); vals.push(v); if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
          if (hi > lo) {
            const s = vals.filter(Number.isFinite).sort((a, b) => a - b); const q = p => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; const qlo = q(0.02), qhi = q(0.98);
            if (sp.contour.fill) { const cw = (W - pl - pr) / nx, chh = (Hh - pt - pb) / ny; let rects = ''; vals.forEach((v, k) => { if (!Number.isFinite(v)) return; const i = k % nx, j = Math.floor(k / nx); rects += `<rect x="${r1(pl + i * cw)}" y="${r1(pt + j * chh)}" width="${r1(cw + 0.6)}" height="${r1(chh + 0.6)}" fill="${rgb(ramp((v - qlo) / (qhi - qlo || 1)))}"/>`; }); ink.raw(`<g clip-path="url(#${clip})" class="bd-heat bd-pop" style="--i:${ink.next()}">${rects}</g>`); }
            if (sp.contour.lines !== false) {
              const levels = Array.isArray(sp.contour.levels) ? sp.contour.levels : (() => { const n = sp.contour.levels, st = H.niceStep(qhi - qlo, n); return H.ticks(qlo, qhi, st); })();
              const n = ink.next(); let d = ''; levels.forEach(lv => { d += contourLines(F, x0, x1, y0, y1, 90, 64, lv, X, Y); });
              if (d) { ink.raw(`<g clip-path="url(#${clip})">`); ink.path(d, 'bd-level', null, { i: n }); ink.raw('</g>'); }
            }
          }
        }
      }
      // a slope or vector field, and solution curves through his points
      if (sp.field) {
        const f = sp.field; const nx = 17, ny = Math.max(9, Math.round(17 * (Hh - pt - pb) / (W - pl - pr))); const cw = (W - pl - pr) / nx, chh = (Hh - pt - pb) / ny; const len = Math.min(cw, chh) * 0.36;
        const S = f.kind === 'slope' ? compile2(f.f, ['x', 'y']) : null, Pf = f.kind === 'vector' ? compile2(f.P, ['x', 'y']) : null, Qf = f.kind === 'vector' ? compile2(f.Q, ['x', 'y']) : null;
        let d = '', heads = ''; let mx = 0; const vs = [];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const px = pl + cw * (i + 0.5), py = pt + chh * (j + 0.5); const x = x0 + (px - pl) / (W - pl - pr) * (x1 - x0), y = y1 - (py - pt) / (Hh - pt - pb) * (y1 - y0);
          if (S) { const m = S(x, y); if (!Number.isFinite(m)) continue; const ux = (x1 - x0) / (W - pl - pr), uy = (y1 - y0) / (Hh - pt - pb); let dx = 1 / ux, dy = -m / uy; const k = len / Math.hypot(dx, dy); dx *= k; dy *= k; d += `${M(px - dx, py - dy)}${L(px + dx, py + dy)}`; }
          else { const a = Pf(x, y), b = Qf(x, y); if (!Number.isFinite(a) || !Number.isFinite(b)) continue; const m = Math.hypot(a, b); mx = Math.max(mx, m); vs.push([px, py, a, b, m]); }
        }
        vs.forEach(([px, py, a, b, m]) => {
          if (!m) return; const ux = (x1 - x0) / (W - pl - pr), uy = (y1 - y0) / (Hh - pt - pb); let dx = a / ux, dy = -b / uy; const k = (len * 2 * (0.35 + 0.65 * m / (mx || 1))) / Math.hypot(dx, dy); dx *= k; dy *= k;
          const ex = px + dx / 2, ey = py + dy / 2, sx = px - dx / 2, sy = py - dy / 2; d += `${M(sx, sy)}${L(ex, ey)}`; const an = Math.atan2(ey - sy, ex - sx), hs = 4.5; heads += `${M(ex - hs * Math.cos(an - 0.5), ey - hs * Math.sin(an - 0.5))}${L(ex, ey)}${L(ex - hs * Math.cos(an + 0.5), ey - hs * Math.sin(an + 0.5))}`;
        });
        const n = ink.next(); ink.raw(`<g clip-path="url(#${clip})">`); ink.path(d + heads, 'bd-field', 5, { i: n }); ink.raw('</g>');
        // solution curves (RK4 both ways) through the points he gave
        if (S && f.through.length) f.through.forEach((p, k) => {
          const step = (x1 - x0) / 300; const run = dir => { let x = p[0], y = p[1]; const out = [[x, y]]; for (let s = 0; s < 600; s++) { const h = dir * step; const k1 = S(x, y), k2 = S(x + h / 2, y + h * k1 / 2), k3 = S(x + h / 2, y + h * k2 / 2), k4 = S(x + h, y + h * k3); const ny2 = y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h; if (!Number.isFinite(ny2) || x < x0 || x > x1 || Math.abs(ny2 - (y0 + y1) / 2) > (y1 - y0) * 3) break; y = ny2; out.push([x, y]); } return out; };
          const pts = run(-1).reverse().concat(run(1).slice(1)); const dd = pts.map((q, i) => (i ? L : M)(X(q[0]), Y(q[1]))).join(''); const c = (k + 1) % 5; const nn = ink.next();
          ink.raw(`<g clip-path="url(#${clip})">`); ink.path(dd, 'bd-curve', c, { i: nn }); ink.raw('</g>'); ink.dot(X(p[0]), Y(p[1]), c, false, nn);
        });
      }
      // implicit curves on top
      (sp.implicit || []).forEach(q => {
        const F = compile2(q.F, ['x', 'y']); if (!F) return; const nx = Math.min(220, Math.round((W - pl - pr) / 2.2)), ny = Math.min(170, Math.round((Hh - pt - pb) / 2.2));
        const d = contourLines(F, x0, x1, y0, y1, nx, ny, 0, X, Y); if (!d) return; const n = ink.next();
        ink.raw(`<g clip-path="url(#${clip})">`); ink.path(d, 'bd-curve bd-imp', q.c, { i: n }); ink.raw('</g>');
        if (q.label) { const m = /M([\d.]+) ([\d.]+)/g; const at = []; let r; while ((r = m.exec(d)) && at.length < 40) at.push([+r[1], +r[2]]); if (at.length) labels.push({ at: [0.85, 0.6, 0.35, 0.1].map(f => at[Math.floor(at.length * f)]).filter(Boolean), t: q.label, c: q.c, n }); }
      });
    },
    plain(sp) {
      const w = [];
      (sp.implicit || []).forEach(q => w.push(`the curve ${pretty(q.label)}`));
      if (sp.field) w.push(`${sp.field.kind === 'slope' ? 'slope field' : 'vector field'} ${pretty(sp.field.label)}${sp.field.through.length ? `, with solution curves through ${sp.field.through.map(p => `(${sig(p[0])}, ${sig(p[1])})`).join(', ')}` : ''}`);
      if (sp.contour) w.push(`${sp.contour.lines === false ? 'heat map' : 'contour map'} of ${pretty(sp.contour.label)}`);
      return w.join('; ');
    }
  });

  /* ---------- svg: any diagram, rebuilt from an allowlist ---------- */
  const EL = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'marker', 'clippath', 'mask', 'pattern', 'title', 'desc', 'symbol', 'use']);
  const AT = new Set(['d', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'fill-opacity', 'fill-rule', 'clip-rule', 'opacity', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'letter-spacing', 'dx', 'dy', 'rotate', 'textlength', 'lengthadjust', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits', 'patterntransform', 'viewbox', 'preserveaspectratio', 'refx', 'refy', 'markerwidth', 'markerheight', 'markerunits', 'orient', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'clippathunits', 'maskunits', 'id', 'href', 'xlink:href', 'visibility', 'display', 'vector-effect', 'paint-order', 'pathlength']);
  const CSSOK = new Set(['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'fill-opacity', 'opacity', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'display', 'visibility', 'paint-order']);
  const CASE = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath', viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', gradientunits: 'gradientUnits', gradienttransform: 'gradientTransform', spreadmethod: 'spreadMethod', patternunits: 'patternUnits', patterntransform: 'patternTransform', refx: 'refX', refy: 'refY', markerwidth: 'markerWidth', markerheight: 'markerHeight', markerunits: 'markerUnits', clippathunits: 'clipPathUnits', maskunits: 'maskUnits', textlength: 'textLength', lengthadjust: 'lengthAdjust', pathlength: 'pathLength' };
  const BADV = /javascript:|data:|expression\(|@import|<|>|url\(\s*['"]?\s*(?!#)/i;
  function cleanSvg(src, pre) {
    if (!global.DOMParser) return null;
    let s = String(src || '').trim().replace(/^```[a-z]*\s*|\s*```$/gi, '');
    if (!/<svg[\s>]/i.test(s)) s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${s}</svg>`;
    s = s.replace(/<svg(?![^>]*xmlns=)/i, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
    let doc; try { doc = new DOMParser().parseFromString(s, 'image/svg+xml'); } catch (e) { return null; }
    const root = doc && doc.documentElement; if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    const ids = new Map(); let count = 0, texts = [];
    root.querySelectorAll('[id]').forEach(e => { const v = e.getAttribute('id'); if (/^[\w.:-]{1,60}$/.test(v)) ids.set(v, `${pre}-${v}`); });
    const ref = v => String(v).replace(/url\(\s*['"]?#([\w.:-]+)['"]?\s*\)/g, (m, k) => ids.has(k) ? `url(#${ids.get(k)})` : 'none');
    function walk(node, top) {
      if (++count > 3000) return '';
      if (node.nodeType === 3) return esc(node.nodeValue || '');
      if (node.nodeType !== 1) return '';
      const name = String(node.localName || '').toLowerCase();
      if (name === 'a' || name === 'switch') return Array.from(node.childNodes).map(c => walk(c, false)).join('');   // a link or a switch: what is inside it stays, the link does not
      if (!EL.has(name)) return '';
      if ((name === 'svg' && !top)) return '';
      const at = [];
      for (const a of Array.from(node.attributes)) {
        const k = a.name.toLowerCase(); let v = String(a.value);
        if (k === 'style') { v.split(';').forEach(d => { const m = /^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i.exec(d); if (m && CSSOK.has(m[1].toLowerCase()) && !BADV.test(m[2]) && !node.hasAttribute(m[1])) at.push(`${m[1].toLowerCase()}="${esc(ref(m[2]))}"`); }); continue; }
        if (!AT.has(k) || /^on/.test(k)) continue;
        if (k === 'href' || k === 'xlink:href') { const m = /^#([\w.:-]+)$/.exec(v.trim()); if (!m || !ids.has(m[1]) || name !== 'use') continue; at.push(`href="#${ids.get(m[1])}"`); continue; }
        if (k === 'id') { if (!ids.has(v)) continue; at.push(`id="${ids.get(v)}"`); continue; }
        if (BADV.test(v)) continue;
        if (top && (k === 'width' || k === 'height' || k === 'viewbox')) continue;
        at.push(`${CASE[k] || k}="${esc(ref(v)).slice(0, 4000)}"`);
      }
      if (name === 'text' || name === 'tspan') texts.push((node.textContent || '').trim());
      if (name === 'title' || name === 'desc') return '';
      const kids = Array.from(node.childNodes).map(c => walk(c, false)).join('');
      return top ? kids : `<${CASE[name] || name}${at.length ? ' ' + at.join(' ') : ''}>${kids}</${CASE[name] || name}>`;
    }
    const body = walk(root, true); if (!body || count < 2) return null;
    let vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) { const w = parseFloat(root.getAttribute('width')) || 400, h = parseFloat(root.getAttribute('height')) || 300; vb = [0, 0, w, h]; }
    return { body, vb, text: texts.filter(Boolean).slice(0, 30).join(', ').slice(0, 300) };
  }
  const SVGRAW = new Map();   // the sanitized SVG of each drawing, by its source (parse may run more than once)
  D.kind('svg', {
    alias: ['svgdrawing', 'vectordrawing', 'freeform', 'freehand', 'custom', 'illustrationsvg', 'schematic', 'circuit', 'map', 'timeline', 'molecule', 'anatomy', 'cell', 'labeleddiagram', 'infographic'],
    test: (o, t) => typeof (o.svg ?? o.markup) === 'string' && /<\s*(svg|g|path|rect|circle|line|polygon|polyline|text|ellipse)\b/i.test(o.svg ?? o.markup),
    make(o, sp) {
      const src = String(o.svg ?? o.markup ?? o.code ?? o.content ?? o.body ?? ''); if (!src || src.length > 60000) return false;
      const c = SVGRAW.get(src) || cleanSvg(src.startsWith('<svg') || !(o.viewBox || o.width) ? src : `<svg viewBox="${esc(String(o.viewBox || `0 0 ${num(o.width, 400)} ${num(o.height, 300)}`))}">${src}</svg>`, 'sv' + (++uid));
      if (!c) return false; SVGRAW.set(src, c); if (SVGRAW.size > 80) SVGRAW.delete(SVGRAW.keys().next().value);
      sp.vb = c.vb; sp.body = c.body; sp.text = c.text; sp.alt = str(o.alt ?? o.title ?? o.description, 200);
      return true;
    },
    html(sp, id) { return `<div class="bd-sheet"><svg viewBox="${sp.vb.join(' ')}" role="img" aria-labelledby="${id}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><title id="${id}">${esc(D.plain(sp))}</title>${sp.body}</svg></div>`; },
    plain: sp => `Drawing${sp.alt ? ': ' + pretty(sp.alt) : sp.caption ? '' : ' (a diagram)'}${sp.text ? `; labels: ${pretty(sp.text)}` : ''}`
  });

  /* ---------- image: a picture an image model makes (ai_image), kept on the server ---------- */
  const IMG = new Map();   // prompt key → { url } or { err } or a promise
  async function post(route, body) {
    let res, j; try { res = await fetch('api/index.php?r=' + route, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'MatHub' }, body: JSON.stringify(body) }); j = await res.json(); } catch (e) { throw new Error('The picture could not be made: no connection.'); }
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'The picture could not be made.'), { data: j || {} });
    return j;
  }
  // the picture itself comes from the API too (with its header), so it is shown from memory
  async function blobOf(u) { const r = await fetch(u, { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub' } }); if (!r.ok) throw new Error('The picture could not be loaded.'); return URL.createObjectURL(await r.blob()); }
  const cidNow = () => { const m = /^#\/([a-z0-9_-]+)/i.exec(location.hash || ''); return m ? m[1] : ''; };
  D.kind('image', {
    alias: ['img', 'photo', 'photograph', 'illustration', 'painting', 'render', 'rendering', 'generated', 'generate', 'generateimage', 'aiimage', 'artwork', 'art', 'realistic', 'scene'],
    test: (o, t) => typeof (o.prompt ?? o.image) === 'string' && !o.shapes && !o.svg && (o.prompt != null || /^(image|img|photo|picture|illustration)/.test(t)),
    make(o, sp) {
      const prompt = str(o.prompt ?? o.image ?? o.description ?? o.desc ?? o.of ?? o.subject, 900).trim(); if (prompt.length < 3) return false;
      const sh = String(o.shape ?? o.aspect ?? o.size ?? o.orientation ?? '').toLowerCase();
      sp.prompt = prompt; sp.style = str(o.style, 40).toLowerCase(); sp.shape = /wide|land|16:9|3:2|horizontal/.test(sh) ? 'wide' : /tall|portrait|9:16|2:3|vertical/.test(sh) ? 'tall' : 'square';
      sp.alt = str(o.alt ?? o.caption ?? prompt, 200); return true;
    },
    html(sp, id) {
      const key = JSON.stringify([sp.prompt, sp.style, sp.shape]); const have = IMG.get(key);
      const ratio = sp.shape === 'wide' ? '3 / 2' : sp.shape === 'tall' ? '2 / 3' : '1 / 1';
      const inner = have && have.url ? `<img src="${esc(have.url)}" alt="${esc(sp.alt)}" loading="lazy" decoding="async">` : `<div class="bd-img-wait" role="status"><span class="bd-img-dot" aria-hidden="true"></span><span>Bo is drawing this picture…</span></div>`;
      setTimeout(loadImages, 0); setTimeout(loadImages, 700);   // once it is on the page
      return `<figure class="bd-imgbox${have && have.url ? ' ok' : ''}" data-img="${esc(key)}" data-img-alt="${esc(sp.alt)}" style="aspect-ratio:${ratio}" id="${id}">${inner}</figure>`;
    },
    plain: sp => `Picture: ${pretty(sp.alt || sp.prompt)}`
  });
  function loadImages() {
    document.querySelectorAll('.bd-imgbox[data-img]:not(.ok):not(.busy)').forEach(box => {
      const key = box.dataset.img; let [prompt, style, shape] = []; try { [prompt, style, shape] = JSON.parse(key); } catch (e) { return; }
      box.classList.add('busy');
      let job = IMG.get(key);
      if (!job || job.err) { job = post('ai_image', { prompt, style, shape, cid: cidNow(), lang: App.lang || 'en' }).then(r => blobOf(r.url)).then(url => { const v = { url }; IMG.set(key, v); return v; }).catch(e => { const v = { err: (e && e.message) || 'This picture could not be made.', credits: !!(e && e.data && e.data.credits) }; IMG.set(key, v); return v; }); IMG.set(key, job); }
      Promise.resolve(job).then(v => {
        document.querySelectorAll(`.bd-imgbox[data-img="${CSS.escape(key)}"]`).forEach(b => {
          b.classList.remove('busy');
          if (v.url) { b.classList.add('ok'); b.innerHTML = `<img src="${esc(v.url)}" alt="${esc(b.dataset.imgAlt || '')}" decoding="async">`; }
          else b.innerHTML = `<div class="bd-img-wait bad" role="status"><span>${esc(v.err)}</span>${v.credits ? ' <a class="linkbtn" href="#/usage">Get credits</a>' : ` <button type="button" class="linkbtn" data-img-retry>Try again</button>`}</div>`;
        });
      });
    });
  }
  if (global.document) document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-img-retry]'); if (!b) return; const box = b.closest('.bd-imgbox'); if (!box) return; IMG.delete(box.dataset.img); box.classList.remove('busy'); box.innerHTML = '<div class="bd-img-wait" role="status"><span class="bd-img-dot" aria-hidden="true"></span><span>Bo is drawing this picture…</span></div>'; loadImages(); });

  /* ---------- surface: 3D, turned by dragging ---------- */
  const S3 = new Map();
  D.kind('surface', {
    alias: ['plot3d', 'surface3d', 'threed', 'graph3d', 'mesh', 'surfaceplot', 'paraboloid', 'saddle', 'multivariable', 'space', 'curve3d', 'helix', 'xyz'],
    test: (o, t) => /3d/.test(String(o.type || '')) || (typeof o.z === 'string' && compile2(String(o.z).replace(/^\s*z\s*=\s*/i, ''), ['x', 'y']) != null && !o.contour) || !!(o.surface && typeof o.surface !== 'boolean'),
    make(o, sp) {
      const zs = o.z ?? o.surface ?? o.f ?? o.function ?? o.equation; const z = typeof zs === 'string' ? str(zs.replace(/^\s*(z|f\(x,\s*y\))\s*=\s*/i, ''), 200) : '';
      sp.z = z && compile2(z, ['x', 'y']) ? z : '';
      sp.xr = rng(o.x ?? o.xrange ?? o.domain, [-3, 3]); sp.yr = rng(o.y ?? o.yrange ?? o.domain, sp.xr.slice());
      sp.curves = list(o.curves ?? o.curve ?? o.paths, 4).map((g, k) => g && typeof g === 'object' && compile2(g.x, ['t']) && compile2(g.y, ['t']) && compile2(g.z, ['t']) ? { x: str(g.x, 120), y: str(g.y, 120), z: str(g.z, 120), t: rng(g.t ?? g.range, [0, 2 * Math.PI]), c: col(g.color, k + 1), label: str(g.label, 30) } : null).filter(Boolean);
      sp.points = list(o.points, 20).map(p => Array.isArray(p) ? { p: [num(p[0], NaN), num(p[1], NaN), num(p[2], NaN)], label: str(p[3], 20) } : p && typeof p === 'object' ? { p: [num(p.x, NaN), num(p.y, NaN), num(p.z, NaN)], label: str(p.label, 20) } : null).filter(q => q && q.p.every(Number.isFinite));
      sp.az = num(o.az ?? o.azimuth ?? o.turn, -50); sp.el = num(o.el ?? o.elevation ?? o.tilt, 28);
      sp.zlabel = str(o.zlabel, 12) || 'z'; sp.label = z ? `z = ${z}` : '';
      return !!(sp.z || sp.curves.length || sp.points.length);
    },
    html(sp, id) { S3.set(id, sp); if (S3.size > 60) S3.delete(S3.keys().next().value); const g = draw3d(sp); return `${svgOpen(g.w, g.h, D.plain(sp), id).replace('<svg ', '<svg tabindex="0" ')}${g.body}</svg><p class="bd-3d-hint" aria-hidden="true">Drag to turn it (or the arrow keys)</p>`; },
    plain: sp => `3D ${sp.z ? `surface ${pretty(sp.label)} for x from ${sig(sp.xr[0])} to ${sig(sp.xr[1])} and y from ${sig(sp.yr[0])} to ${sig(sp.yr[1])}` : 'drawing'}${sp.curves.length ? `; ${sp.curves.length === 1 ? 'a curve' : sp.curves.length + ' curves'} (${sp.curves.map(c => `x = ${c.x}, y = ${c.y}, z = ${c.z}`).join('; ')})` : ''}${sp.points.length ? `; points ${sp.points.map(q => `${q.label ? q.label + ' ' : ''}(${q.p.map(v => sig(v)).join(', ')})`).join(', ')}` : ''}`
  });
  function draw3d(sp) {
    const W = sp._W || 360, Hh = sp._H || 280; const ink = Ink();
    const F = sp.z ? compile2(sp.z, ['x', 'y']) : null; const n = 30;
    const [xa, xb] = sp.xr, [ya, yb] = sp.yr; const grid = [];
    let zlo = Infinity, zhi = -Infinity;
    if (F) for (let j = 0; j <= n; j++) { grid.push([]); for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, y = ya + (yb - ya) * j / n; const z = F(x, y); grid[j].push(z); if (Number.isFinite(z)) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); } } }
    const cpts = sp.curves.map(c => { const fx = compile2(c.x, ['t']), fy = compile2(c.y, ['t']), fz = compile2(c.z, ['t']); const out = []; for (let k = 0; k <= 240; k++) { const t = c.t[0] + (c.t[1] - c.t[0]) * k / 240; const p = [fx(t), fy(t), fz(t)]; if (p.every(Number.isFinite)) { out.push(p); zlo = Math.min(zlo, p[2]); zhi = Math.max(zhi, p[2]); } } return out; });
    sp.points.forEach(q => { zlo = Math.min(zlo, q.p[2]); zhi = Math.max(zhi, q.p[2]); });
    if (!Number.isFinite(zlo)) { zlo = -1; zhi = 1; } if (zhi - zlo < 1e-9) { zlo -= 1; zhi += 1; }
    if (F) { const all = [].concat(...grid).filter(Number.isFinite).sort((a, b) => a - b); if (all.length > 40) { const q = p => all[Math.round(p * (all.length - 1))]; const lo = q(0.02), hi = q(0.98); if (hi > lo) { zlo = Math.min(lo, ...sp.points.map(q2 => q2.p[2])); zhi = Math.max(hi, ...sp.points.map(q2 => q2.p[2])); } } }
    const nx = v => 2 * (v - xa) / (xb - xa) - 1, ny = v => 2 * (v - ya) / (yb - ya) - 1, nz = v => 1.5 * (v - zlo) / (zhi - zlo) - 0.75;
    const az = sp.az * Math.PI / 180, el = sp.el * Math.PI / 180; const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const sc = Math.min(W, Hh) * 0.31; const cx = W / 2, cy = Hh / 2 + 6;
    // turned by az about the z axis, then seen from above at el: [screen x, screen y, how near the viewer]
    const P3 = (x, y, z) => { const X1 = x * ca - y * sa, Y1 = x * sa + y * ca; return [cx + X1 * sc, cy - (Y1 * se + z * ce) * sc, -Y1 * ce + z * se]; };
    // the box behind: the floor and the back edges
    const box = [[-1, -1, -.75], [1, -1, -.75], [1, 1, -.75], [-1, 1, -.75]].map(p => P3(...p));
    ink.raw(`<path d="${box.map((p, k) => (k ? L : M)(p[0], p[1])).join('')}Z" class="bd-3dfloor"/>`);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; const back = corners.map(c => P3(c[0], c[1], 0)).map((p, k) => [p[2], k]).sort((a, b) => a[0] - b[0])[0][1];   // the farthest corner
    const bc = corners[back]; const b0 = P3(bc[0], bc[1], -.75), b1 = P3(bc[0], bc[1], .75); ink.raw(`<path d="${M(b0[0], b0[1])}${L(b1[0], b1[1])}" class="bd-3dedge"/>`);
    // the surface: quads, far ones first, shaded by height and by how they face the light
    if (F) {
      const quads = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const zz = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]; if (!zz.every(Number.isFinite)) continue;
        const xs = [xa + (xb - xa) * i / n, xa + (xb - xa) * (i + 1) / n], ys = [ya + (yb - ya) * j / n, ya + (yb - ya) * (j + 1) / n];
        const q = [[xs[0], ys[0], zz[0]], [xs[1], ys[0], zz[1]], [xs[1], ys[1], zz[2]], [xs[0], ys[1], zz[3]]].map(p => [nx(p[0]), ny(p[1]), Math.max(-1.6, Math.min(1.6, nz(p[2])))]);
        const pr = q.map(p => P3(...p)); const depth = pr.reduce((a, p) => a + p[2], 0) / 4;
        const ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2], vx = q[3][0] - q[0][0], vy = q[3][1] - q[0][1], vz = q[3][2] - q[0][2];
        let N = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const ln = Math.hypot(...N) || 1; N = N.map(v => v / ln);
        const light = 0.62 + 0.38 * Math.abs(N[0] * 0.3 + N[1] * -0.4 + N[2] * 0.87);
        quads.push({ pr, depth, col: rgb(ramp(((zz[0] + zz[1] + zz[2] + zz[3]) / 4 - zlo) / (zhi - zlo)), light) });
      }
      quads.sort((a, b) => a.depth - b.depth);
      ink.raw(`<g class="bd-3dsurf">${quads.map(q => `<path d="${q.pr.map((p, k) => (k ? L : M)(p[0], p[1])).join('')}Z" fill="${q.col}"/>`).join('')}</g>`);
    }
    cpts.forEach((pts, k) => { if (pts.length < 2) return; const d = pts.map((p, i) => { const q = P3(nx(p[0]), ny(p[1]), nz(p[2])); return (i ? L : M)(q[0], q[1]); }).join(''); ink.path(d, 'bd-curve', sp.curves[k].c, { i: ink.next() }); });
    sp.points.forEach(q => { const p = P3(nx(q.p[0]), ny(q.p[1]), nz(q.p[2])); ink.dot(p[0], p[1], 1, false, ink.next()); if (q.label) ink.text(p[0] + 7, p[1] - 7, lab(q.label), 'bd-lab', {}); });
    // the axes' names and ranges
    const ax = (a, b, t) => { const p = P3(...a), q = P3(...b); ink.raw(`<path d="${M(p[0], p[1])}${L(q[0], q[1])}" class="bd-3dax"/>`); ink.text(q[0] + (q[0] > cx ? 6 : -6), q[1] + 4, t, 'bd-axl', { anchor: q[0] > cx ? 'start' : 'end' }); };
    ax([-1, -1, -.75], [1.18, -1, -.75], `x ${sig(xa)}…${sig(xb)}`); ax([-1, -1, -.75], [-1, 1.18, -.75], `y ${sig(ya)}…${sig(yb)}`); ax([-1, -1, -.75], [-1, -1, .95], `${esc(sp.zlabel)} ${sig(zlo)}…${sig(zhi)}`);
    if (sp.label) ink.text(12, 18, lab(sp.label), 'bd-lab', {});
    return { w: W, h: Hh, body: ink.out() };
  }
  // turning a 3D drawing: drag, or the arrow keys when it has focus
  function re3d(id) { const sp = S3.get(id); if (!sp) return; const g = draw3d(sp); document.querySelectorAll(`.bd[data-bd="${CSS.escape(id)}"] > svg, .bdv-stage [data-bd3="${CSS.escape(id)}"]`).forEach(svg => { const t = svg.querySelector('title'); svg.innerHTML = (t ? t.outerHTML : '') + g.body; }); }
  if (global.document) {
    let drag = null;
    document.addEventListener('pointerdown', e => { const box = e.target.closest && e.target.closest('.bd-surface, .bdv-stage [data-bd3]'); if (!box) return; const id = box.dataset.bd || box.dataset.bd3; if (!S3.has(id)) return; drag = { id, x: e.clientX, y: e.clientY }; box.setPointerCapture && box.setPointerCapture(e.pointerId); e.preventDefault(); });
    document.addEventListener('pointermove', e => { if (!drag) return; const sp = S3.get(drag.id); if (!sp) return; sp.az += (e.clientX - drag.x) * 0.6; sp.el = Math.max(-10, Math.min(85, sp.el + (e.clientY - drag.y) * 0.4)); drag.x = e.clientX; drag.y = e.clientY; requestAnimationFrame(() => re3d(drag ? drag.id : '')); });
    document.addEventListener('pointerup', () => { drag = null; }); document.addEventListener('pointercancel', () => { drag = null; });
    document.addEventListener('keydown', e => { const box = e.target.closest && e.target.closest('.bd-surface'); if (!box || !/^Arrow/.test(e.key)) return; const sp = S3.get(box.dataset.bd); if (!sp) return; e.preventDefault(); if (e.key === 'ArrowLeft') sp.az -= 10; if (e.key === 'ArrowRight') sp.az += 10; if (e.key === 'ArrowUp') sp.el = Math.min(85, sp.el + 6); if (e.key === 'ArrowDown') sp.el = Math.max(-10, sp.el - 6); re3d(box.dataset.bd); });
  }

  /* ---------- View large: any drawing on the whole screen, to zoom and pan ---------- */
  let V = null;
  function viewLarge(box, from) {
    if (V || !box) return; const id = box.dataset.bd;
    const el = V = document.createElement('div'); el.className = 'bdv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'The drawing, large');
    const art = box.querySelector(':scope > svg, :scope > .bd-sheet, :scope > .bd-imgbox, :scope > .bd-table-wrap'); const clone = art ? art.cloneNode(true) : null;
    if (clone && clone.tagName && clone.tagName.toLowerCase() === 'svg' && S3.has(id)) clone.setAttribute('data-bd3', id);
    el.innerHTML = `<div class="bdv-bar"><span class="bdv-t">${esc(box.getAttribute('aria-label') || (box.querySelector('title') || {}).textContent || 'Drawing').slice(0, 120)}</span><button type="button" class="bdv-b" data-bdv-z="in" aria-label="Zoom in">+</button><button type="button" class="bdv-b" data-bdv-z="out" aria-label="Zoom out">−</button><button type="button" class="bdv-b" data-bdv-z="fit" aria-label="Fit">⤢</button><button type="button" class="bdv-b bdv-x" data-bdv-x aria-label="Close">✕</button></div><div class="bdv-stage"><div class="bdv-art bd ${box.className.replace(/\bbd\b|\bbd-anim\b/g, '')}"></div></div>`;
    const holder = el.querySelector('.bdv-art'); if (clone) holder.appendChild(clone);
    document.body.appendChild(el); document.documentElement.classList.add('bdx-lock');
    const st = { k: 1, x: 0, y: 0 }; const paint = () => { holder.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.k})`; };
    const zoom = (f, cx, cy) => { const r = el.querySelector('.bdv-stage').getBoundingClientRect(); const px = (cx ?? r.left + r.width / 2) - r.left - r.width / 2, py = (cy ?? r.top + r.height / 2) - r.top - r.height / 2; const k = Math.max(0.5, Math.min(8, st.k * f)); st.x = px - (px - st.x) * k / st.k; st.y = py - (py - st.y) * k / st.k; st.k = k; paint(); };
    let pan = null; const stage = el.querySelector('.bdv-stage');
    stage.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
    stage.addEventListener('pointerdown', e => { if (e.target.closest('[data-bd3]')) return; pan = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (!pan) return; st.x += e.clientX - pan.x; st.y += e.clientY - pan.y; pan = { x: e.clientX, y: e.clientY }; paint(); });
    stage.addEventListener('pointerup', () => { pan = null; });
    stage.addEventListener('dblclick', e => zoom(2, e.clientX, e.clientY));
    const close = () => { removeEventListener('keydown', keys, true); el.remove(); V = null; document.documentElement.classList.remove('bdx-lock'); if (from && from.focus) try { from.focus({ preventScroll: true }); } catch (e) {} };
    const keys = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === '+' || e.key === '=') zoom(1.25); else if (e.key === '-') zoom(0.8); else if (e.key === '0') { st.k = 1; st.x = st.y = 0; paint(); } };
    addEventListener('keydown', keys, true);
    el.addEventListener('click', e => { if (e.target.closest('[data-bdv-x]')) return close(); const z = e.target.closest('[data-bdv-z]'); if (z) { if (z.dataset.bdvZ === 'fit') { st.k = 1; st.x = st.y = 0; paint(); } else zoom(z.dataset.bdvZ === 'in' ? 1.3 : 1 / 1.3); } });
    requestAnimationFrame(() => { el.classList.add('open'); const x = el.querySelector('[data-bdv-x]'); if (x) x.focus(); });
  }
  if (global.document) document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-bdv]'); if (!b) return; e.preventDefault(); e.stopPropagation(); viewLarge(b.closest('.bd'), b); });

  D.more = { compile2, cleanSvg, implicitOf, viewLarge };
})(window);
