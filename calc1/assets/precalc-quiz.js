/* ============================================================
   Mathub — Precalculus procedural question generators
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;
  const TOPICS = {
    'fn-eval':   { unit: 1, sec: 'fn', label: 'Function notation & evaluation' },
    'aroc':      { unit: 1, sec: 'rate', label: 'Average rate of change' },
    'linear':    { unit: 1, sec: 'rate', label: 'Linear functions & models' },
    'models':    { unit: 1, sec: 'models', label: 'Basic functions & piecewise' },
    'transform': { unit: 1, sec: 'transform', label: 'Transformations' },
    'absval':    { unit: 1, sec: 'absdom', label: 'Absolute value' },
    'domain':    { unit: 1, sec: 'absdom', label: 'Domain & range' },
    'variation': { unit: 2, sec: 'variation', label: 'Variation' },
    'exponents': { unit: 2, sec: 'exponents', label: 'Exponents & radicals' },
    'expgrowth': { unit: 2, sec: 'expgrowth', label: 'Exponential growth & decay' },
    'logs':      { unit: 2, sec: 'logs', label: 'Logarithms' },
    'expmodels': { unit: 2, sec: 'expmodels', label: 'Half-life & doubling' },
    'inverse':   { unit: 2, sec: 'inverse', label: 'Inverse functions' },
    'logfn':     { unit: 2, sec: 'logfn', label: 'ln, e and log equations' },
    'quadratics':{ unit: 3, sec: 'quadratics', label: 'Quadratics & parabolas' },
    'poly':      { unit: 3, sec: 'poly', label: 'Polynomial graphs' },
    'complex':   { unit: 3, sec: 'complex', label: 'Complex numbers' },
    'rational':  { unit: 3, sec: 'rational', label: 'Rational functions' },
    'triangles': { unit: 3, sec: 'triangles', label: 'Triangles & similarity' },
    'righttri':  { unit: 3, sec: 'righttri', label: 'Right-triangle trig' },
    'laws':      { unit: 4, sec: 'laws', label: 'Laws of Sines & Cosines' },
    'trigfn':    { unit: 4, sec: 'trigfn', label: 'Reference angles & unit circle' },
    'identities':{ unit: 4, sec: 'identities', label: 'Identities & trig equations' },
    'radians':   { unit: 4, sec: 'radians', label: 'Radians & arclength' },
    'sinusoid':  { unit: 4, sec: 'sinusoid', label: 'Sinusoidal functions' },
    'invtrig':   { unit: 4, sec: 'invtrig', label: 'Inverse & reciprocal trig' },
    'quadform':  { unit: 4, sec: 'quadform', label: 'Quadratic-in-form equations' }
  };
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const nz = (a, b) => { let v = 0; while (v === 0) v = ri(a, b); return v; };
  const rnd = (a, b, step) => { const n = Math.round((b - a) / step); return +(a + step * ri(0, n)).toFixed(6); };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return d === 1 ? `${n}` : (n < 0 ? '-' : '') + R`\frac{${Math.abs(n)}}{${d}}`; };
  const s3 = x => !isFinite(x) ? String(x) : (Math.abs(x) < 1e-9 ? '0' : String(+x.toPrecision(4)));
  const rad = d => d * Math.PI / 180;
  const term = (c, p, first, v = 'x') => { if (c === 0) return ''; const sign = c < 0 ? '-' : (first ? '' : '+'); const a = Math.abs(c); const co = a === 1 && p > 0 ? '' : `${a}`; const body = p === 0 ? `${a}` : p === 1 ? `${co}${v}` : `${co}${v}^{${p}}`; return (first ? sign : ` ${sign} `) + body; };
  const poly = (terms, v = 'x') => { let s = '', first = true; for (const [c, p] of terms) { if (!c) continue; s += term(c, p, first, v); first = false; } return s || '0'; };
  const lin = (m, k, v = 'x') => poly([[m, 1], [k, 0]], v);
  const signed = k => (k === 0 ? '' : k < 0 ? `- ${Math.abs(k)}` : `+ ${k}`);
  function mc(topic, prompt, correct, distractors, explanation, hint) { const opts = [correct]; for (const d of distractors) if (!opts.includes(d)) opts.push(d); const options = shuffle(opts); return { topic, type: 'mc', prompt, options, answer: options.indexOf(correct), explanation, hint }; }
  function num(topic, prompt, answer, answerTex, explanation, hint) { return { topic, type: 'num', prompt, answer, answerTex: answerTex || s3(answer), explanation, hint, tol: 0.01 }; }

  /* ---------- Unit 1 ---------- */
  function qFnEval() {
    const a = nz(-3, 3), b = ri(-6, 6), c = ri(-9, 9); const fx = poly([[a, 2], [b, 1], [c, 0]]); const f = x => a * x * x + b * x + c;
    const k = ri(0, 3);
    if (k === 0) { const p = ri(-4, 4); return num('fn-eval', R`If $f(x) = ${fx}$, find $f(${p})$.`, f(p), `${f(p)}`, R`$f(${p}) = ${a}(${p})^2${b ? ` ${signed(b)}(${p})` : ''}${c ? ` ${signed(c)}` : ''} = ${f(p)}$.`); }
    if (k === 1) { const cor = `$${poly([[a, 2], [2 * a + b, 1], [a + b + c, 0]])}$`; return mc('fn-eval', R`If $f(x) = ${fx}$, which is $f(x + 1)$ simplified?`, cor, [`$${poly([[a, 2], [b, 1], [c + 1, 0]])}$`, `$${poly([[a, 2], [b + 1, 1], [c, 0]])}$`, `$${poly([[a, 2], [2 * a + b, 1], [c, 0]])}$`], R`$f(x+1) = ${poly([[a, 2], [b, 1], [c, 0]]).replace(/x/g, '(x+1)')} = ${a}(x^2 + 2x + 1)${b ? ` ${signed(b)}(x + 1)` : ''}${c ? ` ${signed(c)}` : ''} = ${poly([[a, 2], [2 * a + b, 1], [a + b + c, 0]])}$.`, 'Replace every x by (x + 1), then expand.'); }
    if (k === 2) { const r1 = ri(-4, 4), r2 = r1 + ri(1, 5); const cc = a * r1 * r2; const bb = -a * (r1 + r2); const g = poly([[a, 2], [bb, 1], [cc, 0]]); return num('fn-eval', R`If $g(x) = ${g}$, find the <b>larger</b> solution of $g(x) = 0$.`, r2, `${r2}`, R`$${g} = ${a === 1 ? '' : a}(${lin(1, -r1)})(${lin(1, -r2)}) = 0 \Rightarrow x = ${r1}$ or $x = ${r2}$.`); }
    const bank = [
      { q: 'Which relation is NOT a function of x?', ok: 'The table (1, 4), (2, 7), (1, 9)', bad: ['The table (1, 4), (2, 4), (3, 4)', 'y = x² − 5', 'The graph of y = |x|'], why: 'Input 1 has two different outputs. A constant output is fine; each input still has one output.' },
      { q: 'The statement f(3) = 7 means', ok: 'when the input is 3 the output is 7; the point (3, 7) is on the graph', bad: ['f times 3 equals 7', 'the point (7, 3) is on the graph', 'the function has slope 7/3'], why: 'Function notation pairs an input with its single output.' },
      { q: '"Solve f(x) = 2" asks you to', ok: 'find every input x whose output is 2', bad: ['compute f(2)', 'find the y-intercept', 'find the slope at x = 2'], why: 'Solving an equation means finding inputs; evaluating means computing an output.' }
    ];
    const it = pick(bank); return mc('fn-eval', it.q, it.ok, it.bad, it.why);
  }
  function qAroc() {
    const a = nz(-2, 2), b = ri(-5, 5), c = ri(-6, 6); const p = ri(-3, 3), q = p + ri(1, 4); const f = x => a * x * x + b * x + c; const av = (f(q) - f(p)) / (q - p);
    return num('aroc', R`Find the average rate of change of $f(x) = ${poly([[a, 2], [b, 1], [c, 0]])}$ on $[${p}, ${q}]$.`, av, s3(av), R`$\dfrac{f(${q}) - f(${p})}{${q} - (${p})} = \dfrac{${f(q)} - (${f(p)})}{${q - p}} = ${s3(av)}$.`, 'Compute both outputs first, then Δy/Δx.');
  }
  function qLinear() {
    const k = ri(0, 4);
    if (k === 0) { const x1 = ri(-5, 5), y1 = ri(-8, 8), x2 = x1 + nz(-5, 5), y2 = ri(-8, 8); const m = (y2 - y1) / (x2 - x1); return num('linear', R`Find the slope of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`, m, frac(y2 - y1, x2 - x1), R`$m = \dfrac{${y2} - (${y1})}{${x2} - (${x1})} = ${frac(y2 - y1, x2 - x1)}$.`); }
    if (k === 1) { const m = nz(-4, 4), b = ri(-9, 9), x1 = nz(-5, 5); const y1 = m * x1 + b; const x2 = x1 + nz(-4, 4); const y2 = m * x2 + b; return num('linear', R`A line passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Find its $y$-intercept.`, b, `${b}`, R`Slope $m = \dfrac{${y2} - (${y1})}{${x2} - (${x1})} = ${m}$; then $y - (${y1}) = ${m}(x - (${x1})) \Rightarrow y = ${lin(m, b)}$. Intercept $${b}$.`); }
    if (k === 2) { const base = pick([2.5, 3, 3.5, 4]), rate = pick([1.5, 2, 2.25, 2.5, 0.75]); const miles = ri(3, 20); const cost = base + rate * miles; return num('linear', R`A ride costs \$${base} plus \$${rate} per mile. What does a $${miles}$-mile ride cost (dollars)?`, cost, s3(cost), R`$C(m) = ${base} + ${rate}m$, so $C(${miles}) = ${base} + ${rate}(${miles}) = ${s3(cost)}$.`); }
    if (k === 3) { const base = pick([20, 35, 50]), rate = pick([0.1, 0.25, 0.5, 2]); const total = base + rate * ri(20, 200); const x = (total - base) / rate; return num('linear', R`A plan costs \$${base} per month plus \$${rate} per unit. With a bill of \$${s3(total)}, how many units were used?`, x, s3(x), R`$${base} + ${rate}x = ${s3(total)} \Rightarrow x = \dfrac{${s3(total)} - ${base}}{${rate}} = ${s3(x)}$.`); }
    const m = nz(-3, 3), b = ri(-5, 9); const xs = [0, 2, 4, 6]; const linearTable = Math.random() < 0.5; const ys = xs.map(x => linearTable ? m * x + b : b + m * x * x / 4 + (x === 0 ? 0 : 1));
    return mc('linear', R`A table has $x = ${xs.join(', ')}$ and $y = ${ys.join(', ')}$. Is $y$ a linear function of $x$?`, linearTable ? `Yes: every step of 2 in x changes y by ${2 * m}` : 'No: equal x-steps give unequal y-steps', linearTable ? ['No: equal x-steps give unequal y-steps', 'Yes, because the values are all integers', 'Cannot tell without a graph'] : [`Yes: every step of 2 in x changes y by ${ys[1] - ys[0]}`, 'Yes, because y increases', 'Cannot tell without more points'], linearTable ? `Differences: ${ys[1] - ys[0]}, ${ys[2] - ys[1]}, ${ys[3] - ys[2]}: constant, so linear with slope ${m}.` : `Differences: ${ys[1] - ys[0]}, ${ys[2] - ys[1]}, ${ys[3] - ys[2]}: not constant, so not linear.`, 'Check whether Δy is the same for each equal Δx.');
  }
  function qModels() {
    const k = ri(0, 3);
    if (k === 0) { const P = pick([12, 16, 20, 24, 28, 32, 40]); return num('models', R`The area of a square is a function of its perimeter $P$. Find $A(${P})$.`, P * P / 16, `${P * P / 16}`, R`Side $= P/4 = ${P / 4}$, so $A = ${P / 4}^2 = ${P * P / 16}$.`); }
    if (k === 1) { const c = ri(-2, 3), m1 = nz(-3, 3), b1 = ri(-4, 4), m2 = nz(-3, 3), b2 = ri(-4, 4); const x = pick([c - 2, c - 1, c, c + 1, c + 3]); const val = x < c ? m1 * x + b1 : m2 * x + b2; return num('models', R`Let $f(x) = \begin{cases} ${lin(m1, b1)} & x < ${c} \\ ${lin(m2, b2)} & x \ge ${c} \end{cases}$. Find $f(${x})$.`, val, `${val}`, R`Since $${x} ${x < c ? '<' : '\\ge'} ${c}$, use the ${x < c ? 'first' : 'second'} piece: $${x < c ? lin(m1, b1) : lin(m2, b2)}$ at $x = ${x}$ gives $${val}$.`, 'Check which condition the input satisfies (watch ≤ vs <).'); }
    const bank = [
      { q: 'Which basic function is decreasing on (0, ∞)?', ok: 'y = 1/x', bad: ['y = √x', 'y = x³', 'y = |x|'], why: '1/x falls as x grows; the others rise for positive x.' },
      { q: 'Which basic function has domain [0, ∞)?', ok: 'y = √x', bad: ['y = ∛x', 'y = x²', 'y = 1/x'], why: 'Even roots need a non-negative radicand; cube roots and squares take all reals; 1/x excludes only 0.' },
      { q: 'Which function is even (symmetric about the y-axis)?', ok: 'y = 1/x²', bad: ['y = x³', 'y = 1/x', 'y = √x'], why: 'f(−x) = f(x) for 1/x². x³ and 1/x are odd; √x has no negative inputs.' },
      { q: 'The range of y = x² is', ok: '[0, ∞)', bad: ['all real numbers', '(0, ∞)', '[1, ∞)'], why: 'Squares are never negative and 0 is achieved at x = 0.' }
    ];
    const it = pick(bank); return mc('models', it.q, it.ok, it.bad, it.why);
  }
  function qTransform() {
    const k = ri(0, 3); const h = nz(-5, 5), kk = nz(-5, 5), a = pick([2, 3, 0.5, -1, -2]);
    const base = pick([['x^2', 'x^2'], ['\\sqrt{x}', 'sqrt'], ['|x|', 'abs'], ['x^3', 'x^3']]);
    const inner = h > 0 ? `x - ${h}` : `x + ${-h}`;
    const formula = base[1] === 'sqrt' ? R`\sqrt{${inner}}` : base[1] === 'abs' ? R`|${inner}|` : `(${inner})^${base[0].slice(-1)}`;
    const aTex = a === -1 ? '-' : a === 1 ? '' : `${a}`;
    const g = R`${aTex}${formula} ${signed(kk)}`;
    const desc = `shift ${h > 0 ? 'right' : 'left'} ${Math.abs(h)}, ${Math.abs(a) === 1 ? '' : (Math.abs(a) > 1 ? 'stretch vertically by ' + Math.abs(a) + ', ' : 'compress vertically by ' + Math.abs(a) + ', ')}${a < 0 ? 'reflect across the x-axis, ' : ''}shift ${kk > 0 ? 'up' : 'down'} ${Math.abs(kk)}`;
    if (k === 0) return mc('transform', R`Describe how the graph of $y = ${base[0]}$ is transformed into $y = ${g}$.`, desc, [desc.replace(h > 0 ? 'right' : 'left', h > 0 ? 'left' : 'right'), desc.replace(kk > 0 ? 'up' : 'down', kk > 0 ? 'down' : 'up'), `shift ${h > 0 ? 'right' : 'left'} ${Math.abs(h)} and shift ${kk > 0 ? 'up' : 'down'} ${Math.abs(kk)} only`], R`Inside the function: $x ${h > 0 ? '-' : '+'} ${Math.abs(h)}$ shifts ${h > 0 ? 'right' : 'left'} $${Math.abs(h)}$. The factor $${a}$ ${Math.abs(a) > 1 ? 'stretches' : Math.abs(a) < 1 ? 'compresses' : 'scales'} vertically${a < 0 ? ' and reflects' : ''}. The $${signed(kk)}$ shifts ${kk > 0 ? 'up' : 'down'}.`, 'Inside the parentheses: horizontal, sign reversed. Outside: vertical, as written.');
    if (k === 1) { const wantX = Math.random() < 0.5; return num('transform', R`Find the $${wantX ? 'x' : 'y'}$-coordinate of the vertex (or corner) of $y = ${g}$.`, wantX ? h : kk, `${wantX ? h : kk}`, R`The anchor point of $y = ${base[0]}$ is the origin; it moves to $(${h}, ${kk})$.`); }
    if (k === 2) { const cor = `$y = ${g}$`; return mc('transform', R`Which formula gives the graph of $y = ${base[0]}$ shifted ${h > 0 ? 'right' : 'left'} $${Math.abs(h)}$, ${a < 0 ? 'reflected across the x-axis, ' : ''}${Math.abs(a) !== 1 ? 'stretched vertically by ' + Math.abs(a) + ', ' : ''}and shifted ${kk > 0 ? 'up' : 'down'} $${Math.abs(kk)}$?`, cor, [`$y = ${aTex}${formula.replace(inner, h > 0 ? `x + ${h}` : `x - ${-h}`)} ${signed(kk)}$`, `$y = ${aTex}${formula} ${signed(-kk)}$`, `$y = ${aTex === '-' ? '' : aTex === '' ? '-' : aTex.startsWith('-') ? aTex.slice(1) : '-' + aTex}${formula} ${signed(kk)}$`], R`Horizontal shift goes inside with the opposite sign; vertical stretch and reflection multiply outside; vertical shift is added at the end: $y = ${g}$.`); }
    const dom = base[1] === 'sqrt' ? `[${h}, ∞)` : 'all real numbers'; const range = base[1] === 'x^3' ? 'all real numbers' : (a > 0 ? `[${kk}, ∞)` : `(−∞, ${kk}]`);
    return mc('transform', R`State the range of $y = ${g}$.`, range, [base[1] === 'x^3' ? `[${kk}, ∞)` : (a > 0 ? `(−∞, ${kk}]` : `[${kk}, ∞)`), `[${h}, ∞)`, 'all real numbers' === range ? `(−∞, ${kk}]` : 'all real numbers'], R`The parent ${base[1] === 'x^3' ? 'takes all values' : 'has range [0, ∞)'}; multiplying by $${a}$ ${a < 0 ? 'flips it to (−∞, 0]' : 'keeps it'}, then shifting by $${kk}$ gives ${range}. (Domain: ${dom}.)`);
  }
  function qAbsVal() {
    const k = ri(0, 2);
    if (k === 0) { const a = ri(1, 4), b = ri(-9, 9), kk = ri(1, 12); const x1 = (kk - b) / a, x2 = (-kk - b) / a; return num('absval', R`Find the <b>larger</b> solution of $|${lin(a, b)}| = ${kk}$.`, Math.max(x1, x2), s3(Math.max(x1, x2)), R`$${lin(a, b)} = ${kk}$ or $${lin(a, b)} = -${kk}$, giving $x = ${s3(x1)}$ or $x = ${s3(x2)}$. Larger: $${s3(Math.max(x1, x2))}$.`, 'Two cases: the inside equals k or −k.'); }
    if (k === 1) { const c = ri(-6, 6), kk = ri(1, 6); return mc('absval', R`Solve $|x ${signed(-c)}| < ${kk}$.`, `(${c - kk}, ${c + kk})`, [`(−∞, ${c - kk}) ∪ (${c + kk}, ∞)`, `(${-c - kk}, ${-c + kk})`, `[${c - kk}, ${c + kk}]`], R`$|x - (${c})| < ${kk}$ means $x$ is within $${kk}$ of $${c}$: $${c - kk} < x < ${c + kk}$.`, '|x − c| < k means "within k of c".'); }
    const c = ri(-6, 6), kk = ri(1, 6); return mc('absval', R`Solve $|x ${signed(-c)}| \ge ${kk}$.`, `(−∞, ${c - kk}] ∪ [${c + kk}, ∞)`, [`[${c - kk}, ${c + kk}]`, `(−∞, ${c - kk}) ∪ (${c + kk}, ∞)`, `[${c + kk}, ∞)`], R`Distance from $${c}$ is at least $${kk}$: $x \le ${c - kk}$ or $x \ge ${c + kk}$.`);
  }
  function qDomain() {
    const k = ri(0, 2);
    if (k === 0) { const a = ri(1, 3), b = ri(-9, 9), c = nz(-6, 6); const edge = b / a; const inside = poly([[a, 1], [b, 0]]); const edgeTex = frac(b, a); const cor = c < edge ? `(−∞, ${c}) ∪ (${c}, ${edgeTex.replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2')}]` : `(−∞, ${edgeTex.replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2')}]`; // keep simple: pick b so edge is integer
      return qDomain(); }
    if (k === 1) { const a = pick([1, 2]), e = ri(-5, 5), c = nz(-6, 6); const b = a * e; const inside = poly([[-a, 1], [b, 0]]); // sqrt(b - a x): need x <= e
      const parts = c < e ? `(−∞, ${c}) ∪ (${c}, ${e}]` : `(−∞, ${e}]`;
      return mc('domain', R`Find the domain of $h(x) = \dfrac{\sqrt{${inside}}}{x ${signed(-c)}}$.`, parts, [`(−∞, ${e})`, `[${e}, ∞)`, c < e ? `(−∞, ${e}]` : `(−∞, ${c}) ∪ (${c}, ${e}]`], R`Radicand: $${inside} \ge 0 \Rightarrow x \le ${e}$. Denominator: $x \ne ${c}$${c < e ? ', which lies inside that interval and must be removed' : ', which is already excluded'}. Domain: ${parts}.`, 'Even radicand ≥ 0 and denominator ≠ 0.'); }
    const c = nz(-5, 5); const bank = [
      { f: R`\dfrac{x + 1}{x ${signed(-c)}}`, ok: `all real numbers except ${c}`, bad: [`all real numbers except −1`, 'all real numbers', `(${c}, ∞)`], why: `Only the denominator restricts: x ≠ ${c}.` },
      { f: R`\sqrt{x ${signed(-c)}}`, ok: `[${c}, ∞)`, bad: [`(${c}, ∞)`, `(−∞, ${c}]`, 'all real numbers'], why: `The radicand must be ≥ 0: x ≥ ${c}.` },
      { f: R`\sqrt[3]{x ${signed(-c)}}`, ok: 'all real numbers', bad: [`[${c}, ∞)`, `(−∞, ${c}]`, `all real numbers except ${c}`], why: 'Cube roots accept negative inputs.' }
    ];
    const it = pick(bank); return mc('domain', R`Find the domain of $f(x) = ${it.f}$.`, it.ok, it.bad, it.why);
  }

  /* ---------- Unit 2 ---------- */
  function qVariation() {
    const inv = Math.random() < 0.5; const n = pick([1, 1, 2]); const x1 = ri(2, 6), y1 = ri(2, 20) * (inv ? 10 : 1), x2 = pick([x1 * 2, x1 * 3, x1 + ri(1, 5)]);
    const kk = inv ? y1 * Math.pow(x1, n) : y1 / Math.pow(x1, n); const y2 = inv ? kk / Math.pow(x2, n) : kk * Math.pow(x2, n);
    return num('variation', R`$y$ varies ${inv ? 'inversely' : 'directly'} with ${n === 1 ? '$x$' : 'the square of $x$'}. If $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`, y2, s3(y2), R`${inv ? `$y = k/x^{${n}}$, so $k = ${y1}\\cdot${x1}^{${n}} = ${s3(kk)}$ and $y = ${s3(kk)}/${x2}^{${n}} = ${s3(y2)}$.` : `$y = kx^{${n}}$, so $k = ${y1}/${x1}^{${n}} = ${s3(kk)}$ and $y = ${s3(kk)}\\cdot${x2}^{${n}} = ${s3(y2)}$.`}`, 'Write the variation equation with k, find k from the given pair, then evaluate.');
  }
  function qExponents() {
    const k = ri(0, 3);
    if (k === 0) { const it = pick([[8, 2, 3, 4], [27, 2, 3, 9], [16, 3, 4, 8], [32, 2, 5, 4], [81, 3, 4, 27], [64, 2, 3, 16], [25, 3, 2, 125], [4, 5, 2, 32], [16, -1, 2, 0.25], [8, -2, 3, 0.25], [27, -1, 3, 1 / 3], [9, -3, 2, 1 / 27]]); return num('exponents', R`Evaluate $${it[0]}^{${it[1]}/${it[2]}}$.`, it[3], it[3] < 1 ? frac(1, Math.round(1 / it[3])) : `${it[3]}`, R`$${it[0]}^{${it[1]}/${it[2]}} = \left(\sqrt[${it[2]}]{${it[0]}}\right)^{${it[1]}} = ${Math.round(Math.pow(it[0], 1 / it[2]))}^{${it[1]}} = ${it[3] < 1 ? frac(1, Math.round(1 / it[3])) : it[3]}$.`, 'Take the root first, then the power. A negative exponent means reciprocal.'); }
    if (k === 1) { const a = ri(3, 5), m = ri(3, 5), p = ri(1, 3); return mc('exponents', R`Simplify $\dfrac{(${a}x^{${m}})^2}{x^{${p}}}$.`, `$${a * a}x^{${2 * m - p}}$`, [`$${a}x^{${2 * m - p}}$`, `$${a * a}x^{${m * m - p}}$`, `$${a * a}x^{${2 * m + p}}$`], R`$(${a}x^{${m}})^2 = ${a * a}x^{${2 * m}}$; dividing by $x^{${p}}$ subtracts exponents: $${a * a}x^{${2 * m - p}}$.`); }
    if (k === 2) { const p = pick([2, 3, 1.5, 2.5, 0.5]); const x = pick([4, 9, 16, 25]); const kk = Math.pow(x, p); return num('exponents', R`Solve $x^{${p === 1.5 ? '3/2' : p === 2.5 ? '5/2' : p === 0.5 ? '1/2' : p}} = ${s3(kk)}$ for $x > 0$.`, x, `${x}`, R`Raise both sides to the reciprocal power: $x = ${s3(kk)}^{${p === 1.5 ? '2/3' : p === 2.5 ? '2/5' : p === 0.5 ? '2' : '1/' + p}} = ${x}$.`); }
    const bank = [
      { q: R`Which is equal to $x^{-3}$?`, ok: R`$\dfrac{1}{x^3}$`, bad: [R`$-x^3$`, R`$\dfrac{1}{3x}$`, R`$-\dfrac{1}{x^3}$`], why: 'A negative exponent is a reciprocal, not a sign change.' },
      { q: R`Which is equal to $\sqrt[3]{x^2}$?`, ok: R`$x^{2/3}$`, bad: [R`$x^{3/2}$`, R`$x^{6}$`, R`$\dfrac{2}{3}x$`], why: 'The root index is the denominator, the power is the numerator.' },
      { q: R`Which is equal to $(2x)^{-2}$?`, ok: R`$\dfrac{1}{4x^2}$`, bad: [R`$\dfrac{2}{x^2}$`, R`$-4x^2$`, R`$\dfrac{1}{2x^2}$`], why: 'Both the 2 and the x are squared and moved to the denominator.' },
      { q: R`$\sqrt{x^2 + 16}$ equals`, ok: R`$\sqrt{x^2 + 16}$ (it does not simplify)`, bad: [R`$x + 4$`, R`$|x| + 4$`, R`$x + 16$`], why: 'The square root of a sum is not the sum of square roots. Test x = 3: √25 = 5 ≠ 7.' }
    ];
    const it = pick(bank); return mc('exponents', it.q, it.ok, it.bad, it.why);
  }
  function qExpGrowth() {
    const k = ri(0, 3);
    if (k === 0) { const A0 = ri(2, 90) * 100, r = pick([3, 4, 5, 6, 8, 12]), t = ri(3, 15), decay = Math.random() < 0.4; const b = decay ? 1 - r / 100 : 1 + r / 100; const A = A0 * Math.pow(b, t); return num('expgrowth', R`A quantity starts at $${A0}$ and ${decay ? 'decays' : 'grows'} by $${r}\%$ per year. Find its value after $${t}$ years.`, A, s3(A), R`$A(t) = ${A0}(${b})^t$; $A(${t}) = ${A0}(${b})^{${t}} = ${s3(A)}$.`, 'Growth factor = 1 ± rate; multiply repeatedly (use the power).'); }
    if (k === 1) { const r = pick([2, 5, 7, 12, 15, 25]), decay = Math.random() < 0.5; return mc('expgrowth', `What is the ${decay ? 'decay' : 'growth'} factor for ${r}% ${decay ? 'decay' : 'growth'} per period?`, `${decay ? (1 - r / 100).toFixed(2) : (1 + r / 100).toFixed(2)}`, [`${(r / 100).toFixed(2)}`, `${decay ? (1 + r / 100).toFixed(2) : (1 - r / 100).toFixed(2)}`, `${r}`], `Each period multiplies by 1 ${decay ? '−' : '+'} ${r / 100} = ${decay ? (1 - r / 100).toFixed(2) : (1 + r / 100).toFixed(2)}.`); }
    if (k === 2) { const b = pick([1.5, 2, 3, 0.5, 1.2]); const a = ri(2, 12); const x1 = ri(0, 2), x2 = x1 + ri(1, 3); const y1 = a * Math.pow(b, x1), y2 = a * Math.pow(b, x2); return num('expgrowth', R`An exponential function $f(x) = ab^x$ passes through $(${x1}, ${s3(y1)})$ and $(${x2}, ${s3(y2)})$. Find $b$.`, b, `${b}`, R`Divide: $\dfrac{ab^{${x2}}}{ab^{${x1}}} = \dfrac{${s3(y2)}}{${s3(y1)}} \Rightarrow b^{${x2 - x1}} = ${s3(y2 / y1)} \Rightarrow b = ${b}$.`, 'Divide the two equations to cancel a.'); }
    const base = pick([2, 3, 5]); const p = ri(2, 5), q = ri(2, 5); const lhsPow = ri(1, 3); return num('expgrowth', R`Solve $${Math.pow(base, p)}^{x} = ${Math.pow(base, q)}$ by writing both sides with base $${base}$.`, q / p, frac(q, p), R`$${Math.pow(base, p)} = ${base}^{${p}}$ and $${Math.pow(base, q)} = ${base}^{${q}}$, so $${base}^{${p}x} = ${base}^{${q}} \Rightarrow ${p}x = ${q} \Rightarrow x = ${frac(q, p)}$.`);
  }
  function qLogs() {
    const k = ri(0, 4);
    if (k === 0) { const b = pick([2, 3, 4, 5, 10]); const e = ri(-2, 4); const x = Math.pow(b, e); return num('logs', R`Evaluate $\log_{${b}} ${x < 1 ? frac(1, Math.round(1 / x)) : x}$.`, e, `${e}`, R`$${b}^{${e}} = ${x < 1 ? frac(1, Math.round(1 / x)) : x}$, so the log is $${e}$.`, 'A log asks: which exponent?'); }
    if (k === 1) { const p = ri(2, 5), q = ri(2, 5); return mc('logs', R`Expand $\log\dfrac{x^{${p}}\sqrt{y}}{z^{${q}}}$.`, R`$${p}\log x + \tfrac12\log y - ${q}\log z$`, [R`$${p}\log x + \tfrac12\log y + ${q}\log z$`, R`$\dfrac{${p}\log x \cdot \tfrac12\log y}{${q}\log z}$`, R`$${p}\log x + 2\log y - ${q}\log z$`], 'Products become sums, quotients differences, powers multipliers; √y = y^{1/2}.'); }
    if (k === 2) { const b = pick([2, 3, 5, 7, 1.5, 1.08]); const c = ri(5, 200); const x = Math.log(c) / Math.log(b); return num('logs', R`Solve $${b}^{x} = ${c}$. Give $x$ to three significant figures.`, x, s3(x), R`$x = \log_{${b}} ${c} = \dfrac{\log ${c}}{\log ${b}} = ${s3(x)}$.`, 'Take log of both sides, or use change of base.'); }
    if (k === 3) { const b = pick([2, 3, 10]); const e = ri(1, 3); const c = nz(-4, 4); const x = Math.pow(b, e) - c; return num('logs', R`Solve $\log_{${b}}(x ${signed(c)}) = ${e}$.`, x, `${x}`, R`Exponential form: $x ${signed(c)} = ${b}^{${e}} = ${Math.pow(b, e)} \Rightarrow x = ${x}$. Check: the argument is $${Math.pow(b, e)} > 0$ ✓.`); }
    const bank = [
      { q: R`Which statement is TRUE for all positive $a, b$?`, ok: R`$\log(ab) = \log a + \log b$`, bad: [R`$\log(a + b) = \log a + \log b$`, R`$\dfrac{\log a}{\log b} = \log a - \log b$`, R`$\log(a^b) = (\log a)^b$`], why: 'Only the product rule is a real property. There is no rule for logs of sums.' },
      { q: R`$\log_b 1$ and $\log_b b$ equal`, ok: '0 and 1', bad: ['1 and 0', '0 and b', 'undefined and 1'], why: R`$b^0 = 1$ and $b^1 = b$.` },
      { q: R`$\log_2(-8)$ is`, ok: 'undefined: the argument of a log must be positive', bad: ['−3', '3', '−8'], why: 'No power of 2 is negative.' }
    ];
    const it = pick(bank); return mc('logs', it.q, it.ok, it.bad, it.why);
  }
  function qExpModels() {
    const k = ri(0, 2);
    if (k === 0) { const A0 = pick([80, 100, 160, 200, 400, 500]), H = pick([3, 5, 6, 8, 12, 24]), t = H * ri(1, 4); const A = A0 * Math.pow(0.5, t / H); return num('expmodels', R`A substance has a half-life of $${H}$ hours. Starting with $${A0}$ mg, how much remains after $${t}$ hours?`, A, s3(A), R`$${t}/${H} = ${t / H}$ half-lives: $${A0}\left(\tfrac12\right)^{${t / H}} = ${s3(A)}$ mg.`, 'Count the halvings.'); }
    if (k === 1) { const A0 = ri(1, 9) * 1000, r = pick([3, 4, 5, 6, 8]), target = A0 * pick([2, 3, 4]); const b = 1 + r / 100; const t = Math.log(target / A0) / Math.log(b); return num('expmodels', R`A population of $${A0}$ grows $${r}\%$ per year. How many years until it reaches $${target}$? (three significant figures)`, t, s3(t), R`$${A0}(${b})^t = ${target} \Rightarrow (${b})^t = ${target / A0} \Rightarrow t = \dfrac{\log ${target / A0}}{\log ${b}} = ${s3(t)}$ years.`); }
    const r = pick([2, 3, 4, 5, 6, 7, 8, 10]); const D = Math.log(2) / Math.log(1 + r / 100); return num('expmodels', R`Find the doubling time (years) for growth of $${r}\%$ per year.`, D, s3(D), R`$(${1 + r / 100})^t = 2 \Rightarrow t = \dfrac{\log 2}{\log ${1 + r / 100}} = ${s3(D)}$ years.`, 'Rule of 70 estimate: 70/r; the log computation is exact.');
  }
  function qInverse() {
    const k = ri(0, 2);
    if (k === 0) { const m = nz(-4, 4), b = ri(-9, 9); const y = m * ri(-4, 4) + b; const x = (y - b) / m; return num('inverse', R`If $f(x) = ${lin(m, b)}$, find $f^{-1}(${y})$.`, x, `${x}`, R`$f^{-1}(${y})$ is the input whose output is $${y}$: $${lin(m, b)} = ${y} \Rightarrow x = ${x}$.`, 'Solve f(x) = the given value.'); }
    if (k === 1) { const m = nz(2, 5), b = ri(-9, 9); const cor = R`$f^{-1}(x) = \dfrac{x ${signed(-b)}}{${m}}$`; return mc('inverse', R`Find the inverse of $f(x) = ${lin(m, b)}$.`, cor, [R`$f^{-1}(x) = \dfrac{1}{${lin(m, b)}}$`, R`$f^{-1}(x) = \dfrac{x ${signed(b)}}{${m}}$`, R`$f^{-1}(x) = ${m}x ${signed(-b)}$`], R`Swap and solve: $x = ${lin(m, b, 'y')} \Rightarrow y = \dfrac{x ${signed(-b)}}{${m}}$. The inverse is not the reciprocal.`); }
    const bank = [
      { q: 'Which function has an inverse function (is one-to-one)?', ok: 'f(x) = x³', bad: ['f(x) = x²', 'f(x) = |x|', 'f(x) = x⁴ − 1'], why: 'x³ passes the horizontal line test; the others repeat outputs.' },
      { q: 'If (2, 9) is on the graph of f, then on the graph of f⁻¹ we find', ok: '(9, 2)', bad: ['(2, 1/9)', '(−2, −9)', '(1/2, 1/9)'], why: 'Inverse swaps inputs and outputs.' },
      { q: 'The domain of f⁻¹ equals', ok: 'the range of f', bad: ['the domain of f', 'all real numbers', 'the reciprocal of the domain of f'], why: 'Inputs of f⁻¹ are outputs of f.' }
    ];
    const it = pick(bank); return mc('inverse', it.q, it.ok, it.bad, it.why);
  }
  function qLogFn() {
    const k = ri(0, 3);
    if (k === 0) { const kk = pick([0.02, 0.03, 0.05, 0.08, 0.1, 0.2]), A0 = ri(1, 9) * 100, c = pick([2, 3, 5, 10]); const t = Math.log(c) / kk; return num('logfn', R`Solve $${A0}e^{${kk}t} = ${A0 * c}$ for $t$ (three significant figures).`, t, s3(t), R`$e^{${kk}t} = ${c} \Rightarrow ${kk}t = \ln ${c} \Rightarrow t = \dfrac{\ln ${c}}{${kk}} = ${s3(t)}$.`); }
    if (k === 1) { const a = ri(2, 4), b = ri(-5, 5), e = ri(1, 3); const x = (Math.exp(e) - b) / a; return num('logfn', R`Solve $\ln(${lin(a, b)}) = ${e}$ (three significant figures).`, x, s3(x), R`$${lin(a, b)} = e^{${e}} \Rightarrow x = \dfrac{e^{${e}} ${signed(-b)}}{${a}} = ${s3(x)}$.`); }
    if (k === 2) { const kk = pick([0.02, 0.035, 0.045, 0.06, 0.09]); return num('logfn', R`Find the doubling time for continuous growth at rate $k = ${kk}$ (per year).`, Math.LN2 / kk, s3(Math.LN2 / kk), R`$e^{${kk}t} = 2 \Rightarrow t = \dfrac{\ln 2}{${kk}} = ${s3(Math.LN2 / kk)}$ years.`); }
    const bank = [
      { q: R`The graph of $y = \log_2 x$ has`, ok: 'a vertical asymptote at x = 0 and passes through (1, 0)', bad: ['a horizontal asymptote at y = 0 and passes through (0, 1)', 'domain all real numbers', 'a vertical asymptote at x = 1'], why: 'Logs are inverses of exponentials: the asymptote and intercept swap roles.' },
      { q: R`$e^{\ln 7}$ equals`, ok: '7', bad: ['ln 7', '1', 'e⁷'], why: 'e^x and ln x undo each other.' },
      { q: 'A continuous growth rate of 5% corresponds to an annual growth factor of', ok: R`$e^{0.05} \approx 1.0513$`, bad: ['1.05 exactly', '0.05', R`$\ln 1.05$`], why: R`$b = e^k$, slightly more than 1 + k.` }
    ];
    const it = pick(bank); return mc('logfn', it.q, it.ok, it.bad, it.why);
  }

  /* ---------- Unit 3 ---------- */
  function qQuadratics() {
    const k = ri(0, 3); const a = pick([1, 1, 2, -1, -2]), r1 = ri(-5, 3), r2 = r1 + ri(1, 6); const b = -a * (r1 + r2), c = a * r1 * r2; const fx = poly([[a, 2], [b, 1], [c, 0]]);
    if (k === 0) return num('quadratics', R`Find the <b>larger</b> $x$-intercept of $y = ${fx}$.`, r2, `${r2}`, R`$${fx} = ${a === 1 ? '' : a}(${lin(1, -r1)})(${lin(1, -r2)})$, zeros $${r1}$ and $${r2}$.`, 'Factor, or use the quadratic formula.');
    if (k === 1) { const xv = (r1 + r2) / 2; const yv = a * xv * xv + b * xv + c; return num('quadratics', R`Find the $${Math.random() < 0.5 ? 'x' : 'y'}$-coordinate of the vertex of $y = ${fx}$.`.replace('$x$-coordinate', 'x-coordinate'), Math.random() < 0.5 ? xv : yv, null, R`Vertex $x = -\dfrac{b}{2a} = ${s3(xv)}$ (midway between the roots $${r1}$ and $${r2}$); $y = ${s3(yv)}$.`).__fix || (() => { const wantX = Math.random() < 0.5; return num('quadratics', R`Find the ${wantX ? '$x$' : '$y$'}-coordinate of the vertex of $y = ${fx}$.`, wantX ? xv : yv, s3(wantX ? xv : yv), R`Vertex $x = -\dfrac{b}{2a} = \dfrac{${-b}}{${2 * a}} = ${s3(xv)}$ (midway between the roots $${r1}$ and $${r2}$); $y = ${s3(yv)}$. The vertex is a ${a > 0 ? 'minimum' : 'maximum'}.`); })(); }
    if (k === 2) { const disc = pick([-1, 0, 1]); const aa = 1, bb = ri(-6, 6); const cc = disc === 0 ? bb * bb / 4 : disc > 0 ? bb * bb / 4 - ri(1, 5) : bb * bb / 4 + ri(1, 5); if (!Number.isInteger(cc)) return qQuadratics(); const dv = bb * bb - 4 * aa * cc; return mc('quadratics', R`How many real solutions does $${poly([[1, 2], [bb, 1], [cc, 0]])} = 0$ have?`, dv > 0 ? 'Two' : dv === 0 ? 'One (a repeated root)' : 'None (two complex roots)', [dv > 0 ? 'One (a repeated root)' : 'Two', dv < 0 ? 'One (a repeated root)' : 'None (two complex roots)', 'Three'], R`Discriminant $b^2 - 4ac = ${bb}^2 - 4(${cc}) = ${dv}$, which is ${dv > 0 ? 'positive' : dv === 0 ? 'zero' : 'negative'}.`); }
    const xv = (r1 + r2) / 2; const yv = a * xv * xv + b * xv + c; return mc('quadratics', R`State the range of $y = ${fx}$.`, a > 0 ? `[${s3(yv)}, ∞)` : `(−∞, ${s3(yv)}]`, [a > 0 ? `(−∞, ${s3(yv)}]` : `[${s3(yv)}, ∞)`, 'all real numbers', `[${s3(xv)}, ∞)`], R`Vertex at $x = ${s3(xv)}$, $y = ${s3(yv)}$; the parabola opens ${a > 0 ? 'up' : 'down'}, so the range is ${a > 0 ? `[${s3(yv)}, ∞)` : `(−∞, ${s3(yv)}]`}.`);
  }
  function qPoly() {
    const k = ri(0, 3);
    if (k === 0) { const n = ri(3, 6), an = nz(-3, 3); const even = n % 2 === 0; const right = an > 0 ? 'up' : 'down'; const left = even ? right : (an > 0 ? 'down' : 'up'); return mc('poly', R`Describe the end behavior of $y = ${an}x^{${n}} ${signed(ri(-5, 5))}x^{${n - 1}} ${signed(ri(-9, 9))}$.`, `left end ${left}, right end ${right}`, [`left end ${left === 'up' ? 'down' : 'up'}, right end ${right}`, `left end ${left}, right end ${right === 'up' ? 'down' : 'up'}`, `left end ${left === 'up' ? 'down' : 'up'}, right end ${right === 'up' ? 'down' : 'up'}`], `Only the leading term ${an}x^${n} matters: degree ${n} is ${even ? 'even (ends match)' : 'odd (ends opposite)'} and the coefficient is ${an > 0 ? 'positive' : 'negative'}, so the right end goes ${right}.`, 'Look only at the leading term.'); }
    if (k === 1) { const r1 = ri(-4, 4), r2 = r1 + ri(1, 4), m1 = pick([1, 2, 3]), m2 = pick([1, 2]); return mc('poly', R`For $y = (${lin(1, -r1)})^{${m1}}(${lin(1, -r2)})^{${m2}}$, what happens at the zeros?`, `${m1 % 2 ? 'crosses' : 'touches and turns'} at x = ${r1}; ${m2 % 2 ? 'crosses' : 'touches and turns'} at x = ${r2}`, [`${m1 % 2 ? 'touches and turns' : 'crosses'} at x = ${r1}; ${m2 % 2 ? 'crosses' : 'touches and turns'} at x = ${r2}`, `${m1 % 2 ? 'crosses' : 'touches and turns'} at x = ${r1}; ${m2 % 2 ? 'touches and turns' : 'crosses'} at x = ${r2}`, `crosses at both x = ${-r1} and x = ${-r2}`], 'Odd multiplicity crosses the axis; even multiplicity bounces.'); }
    if (k === 2) { const r1 = ri(-4, 4), r2 = r1 + ri(1, 4), m1 = pick([1, 2, 3]), m2 = pick([1, 2]); const a = nz(-3, 3); return num('poly', R`Find the $y$-intercept of $y = ${a}(${lin(1, -r1)})^{${m1}}(${lin(1, -r2)})^{${m2}}$.`, a * Math.pow(-r1, m1) * Math.pow(-r2, m2), `${a * Math.pow(-r1, m1) * Math.pow(-r2, m2)}`, R`Set $x = 0$: $${a}(${-r1})^{${m1}}(${-r2})^{${m2}} = ${a * Math.pow(-r1, m1) * Math.pow(-r2, m2)}$.`); }
    const r1 = ri(-4, 4), r2 = r1 + ri(1, 4), yint = nz(-12, 12); const a = yint / (r1 * r2 * r2); if (r1 === 0 || r2 === 0 || !Number.isInteger(a)) return qPoly(); return num('poly', R`A polynomial has zeros $${r1}$ (multiplicity 1) and $${r2}$ (multiplicity 2) and $y$-intercept $${yint}$. Find its leading coefficient $a$ in $y = a(${lin(1, -r1)})(${lin(1, -r2)})^2$.`, a, `${a}`, R`At $x = 0$: $a(${-r1})(${-r2})^2 = ${yint} \Rightarrow a = ${a}$.`);
  }
  function qComplex() {
    const k = ri(0, 3); const a = nz(-4, 4), b = nz(-4, 4), c = nz(-4, 4), d = nz(-4, 4);
    const ctex = (re, im) => `${re} ${im < 0 ? '-' : '+'} ${Math.abs(im)}i`;
    if (k === 0) { const re = a * c - b * d, im = a * d + b * c; return mc('complex', R`Compute $(${ctex(a, b)})(${ctex(c, d)})$.`, `$${ctex(re, im)}$`, [`$${ctex(a * c + b * d, im)}$`, `$${ctex(a * c, b * d)}$`, `$${ctex(re, a * d - b * c)}$`], R`FOIL: $${a * c} ${signed(a * d)}i ${signed(b * c)}i ${signed(b * d)}i^2 = ${a * c} ${signed(-b * d)} ${signed(a * d + b * c)}i = ${ctex(re, im)}$ using $i^2 = -1$.`); }
    if (k === 1) { const n = ri(5, 30); const v = ['1', 'i', '-1', '-i'][n % 4]; return mc('complex', R`Simplify $i^{${n}}$.`, `$${v}$`, ['$1$', '$i$', '$-1$', '$-i$'].filter(x => x !== `$${v}$`), R`Powers of $i$ cycle every 4: $${n} = 4(${Math.floor(n / 4)})${n % 4 ? ` + ${n % 4}` : ''}$, so $i^{${n}} = i^{${n % 4}} = ${v}$.`); }
    if (k === 2) { const p = nz(-4, 4), q = ri(1, 4); const bb = -2 * p, cc = p * p + q * q; return mc('complex', R`Solve $x^2 ${signed(bb)}x ${signed(cc)} = 0$.`, `$x = ${p} \\pm ${q}i$`, [`$x = ${-p} \\pm ${q}i$`, `$x = ${p} \\pm ${q}$`, `$x = ${p} \\pm ${q * q}i$`], R`$x = \dfrac{${-bb} \pm \sqrt{${bb * bb} - ${4 * cc}}}{2} = \dfrac{${-bb} \pm \sqrt{${bb * bb - 4 * cc}}}{2} = ${p} \pm ${q}i$.`); }
    const n = pick([4, 9, 16, 25, 36, 49, 8, 12, 18, 20]); const sq = Math.sqrt(n); const ok = Number.isInteger(sq) ? `$${sq}i$` : n === 8 ? '$2i\\sqrt2$' : n === 12 ? '$2i\\sqrt3$' : n === 18 ? '$3i\\sqrt2$' : '$2i\\sqrt5$'; return mc('complex', R`Simplify $\sqrt{-${n}}$.`, ok, [`$-${Number.isInteger(sq) ? sq : Math.floor(sq)}$`, `$${Number.isInteger(sq) ? sq : n}$`, `$-${Number.isInteger(sq) ? sq : Math.floor(sq)}i$`], R`$\sqrt{-${n}} = i\sqrt{${n}} = ${ok.replace(/\$/g, '')}$.`);
  }
  function qRational() {
    const k = ri(0, 3); const p = nz(-5, 5), q = nz(-5, 5); if (p === q) return qRational();
    if (k === 0) return num('rational', R`Find the vertical asymptote of $f(x) = \dfrac{${lin(1, -q)}}{${lin(1, -p)}}$.`, p, `x = ${p}`, R`The denominator is zero at $x = ${p}$ and the numerator is not, so $x = ${p}$ is a vertical asymptote. (The $x$-intercept is $${q}$.)`);
    if (k === 1) { const a = nz(-4, 4), b = nz(1, 4); return num('rational', R`Find the horizontal asymptote $y = ?$ of $f(x) = \dfrac{${poly([[a, 2], [ri(-5, 5), 1], [ri(-5, 5), 0]])}}{${poly([[b, 2], [ri(-5, 5), 1], [ri(1, 5), 0]])}}$.`, a / b, frac(a, b), R`Equal degrees: the horizontal asymptote is the ratio of leading coefficients, $y = ${frac(a, b)}$.`); }
    if (k === 2) return mc('rational', R`For $f(x) = \dfrac{(${lin(1, -p)})(${lin(1, -q)})}{(${lin(1, -p)})(x ${signed(-(p + 7))})}$, the graph has`, `a hole at x = ${p} and a vertical asymptote at x = ${p + 7}`, [`vertical asymptotes at x = ${p} and x = ${p + 7}`, `a hole at x = ${p + 7} and a vertical asymptote at x = ${p}`, `an x-intercept at x = ${p}`], R`The factor $(${lin(1, -p)})$ cancels: a hole at $x = ${p}$. The remaining denominator factor gives the asymptote at $x = ${p + 7}$.`, 'Cancelled factor = hole; remaining denominator factor = asymptote.');
    const c = ri(2, 6), s = nz(-5, 5); const x = s; return num('rational', R`Solve $\dfrac{${c}}{x} + 1 = \dfrac{${c + s}}{x}$.`, s, `${s}`, R`Multiply by $x$ ($x \ne 0$): $${c} + x = ${c + s} \Rightarrow x = ${s}$. Check: $x = ${s} \ne 0$ ✓.`);
  }
  function qTriangles() {
    const k = ri(0, 3);
    if (k === 0) { const A = ri(20, 80), B = ri(20, 80); return num('triangles', R`Two angles of a triangle measure $${A}^\circ$ and $${B}^\circ$. Find the third angle (degrees).`, 180 - A - B, `${180 - A - B}`, R`$180 - ${A} - ${B} = ${180 - A - B}^\circ$.`); }
    if (k === 1) { const tr = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]]); const m = ri(1, 3); return num('triangles', R`A right triangle has legs $${tr[0] * m}$ and $${tr[1] * m}$. Find the hypotenuse.`, tr[2] * m, `${tr[2] * m}`, R`$\sqrt{${tr[0] * m}^2 + ${tr[1] * m}^2} = \sqrt{${(tr[0] * m) ** 2 + (tr[1] * m) ** 2}} = ${tr[2] * m}$.`); }
    if (k === 2) { const h = rnd(1.5, 2, 0.1), sh = rnd(2, 4, 0.5), tsh = ri(8, 30); const H = h * tsh / sh; return num('triangles', R`A $${h}$ m person casts a $${sh}$ m shadow while a tree casts a $${tsh}$ m shadow. How tall is the tree (m)?`, H, s3(H), R`Similar triangles: $\dfrac{H}{${tsh}} = \dfrac{${h}}{${sh}} \Rightarrow H = ${s3(H)}$ m.`, 'Height/shadow is the same ratio for both.'); }
    const hh = nz(-5, 5), kk = ri(-5, 5), r = ri(1, 6); const sq = (v, k) => k === 0 ? `${v}^2` : `(${v} ${signed(-k)})^2`; return mc('triangles', R`Which equation describes the circle with center $(${hh}, ${kk})$ and radius $${r}$?`, `$${sq('x', hh)} + ${sq('y', kk)} = ${r * r}$`, [`$${sq('x', -hh)} + ${sq('y', -kk)} = ${r * r}$`, `$${sq('x', hh)} + ${sq('y', kk)} = ${r}$`, `$x^2 + y^2 = ${r * r}$`], R`$(x - h)^2 + (y - k)^2 = r^2$ with $h = ${hh}$, $k = ${kk}$, $r^2 = ${r * r}$.`);
  }
  function qRightTri() {
    const k = ri(0, 3);
    if (k === 0) { const th = ri(15, 75), hyp = ri(5, 40); const wantOpp = Math.random() < 0.5; const v = wantOpp ? hyp * Math.sin(rad(th)) : hyp * Math.cos(rad(th)); return num('righttri', R`In a right triangle the hypotenuse is $${hyp}$ and one acute angle is $${th}^\circ$. Find the side ${wantOpp ? 'opposite' : 'adjacent to'} that angle (three significant figures).`, v, s3(v), R`$${wantOpp ? '\\sin' : '\\cos'}${th}^\circ = \dfrac{\text{${wantOpp ? 'opp' : 'adj'}}}{${hyp}} \Rightarrow \text{${wantOpp ? 'opp' : 'adj'}} = ${hyp}${wantOpp ? '\\sin' : '\\cos'}${th}^\circ = ${s3(v)}$.`, 'SOH-CAH-TOA: pick the ratio that links the known and wanted sides.'); }
    if (k === 1) { const opp = ri(2, 20), adj = ri(2, 20); const th = Math.atan(opp / adj) * 180 / Math.PI; return num('righttri', R`A right triangle has legs $${opp}$ (opposite the angle $\theta$) and $${adj}$ (adjacent). Find $\theta$ in degrees.`, th, s3(th), R`$\tan\theta = \dfrac{${opp}}{${adj}} \Rightarrow \theta = \tan^{-1}\!\left(\dfrac{${opp}}{${adj}}\right) = ${s3(th)}^\circ$.`); }
    if (k === 2) { const bank = [['\\sin 30^\\circ', 0.5, R`\frac12`], ['\\cos 60^\\circ', 0.5, R`\frac12`], ['\\sin 45^\\circ', Math.SQRT1_2, R`\frac{\sqrt2}{2}`], ['\\cos 45^\\circ', Math.SQRT1_2, R`\frac{\sqrt2}{2}`], ['\\tan 45^\\circ', 1, '1'], ['\\sin 60^\\circ', Math.sqrt(3) / 2, R`\frac{\sqrt3}{2}`], ['\\cos 30^\\circ', Math.sqrt(3) / 2, R`\frac{\sqrt3}{2}`], ['\\tan 60^\\circ', Math.sqrt(3), R`\sqrt3`], ['\\tan 30^\\circ', 1 / Math.sqrt(3), R`\frac{\sqrt3}{3}`]]; const it = pick(bank); return num('righttri', R`Give the exact value of $${it[0]}$ (you may type sqrt(3)/2, etc.).`, it[1], it[2], R`From the special triangles: $${it[0]} = ${it[2]}$.`, '30-60-90: 1, √3, 2. 45-45-90: 1, 1, √2.'); }
    const L = ri(4, 12), th = ri(55, 80); const h = L * Math.sin(rad(th)); return num('righttri', R`A $${L}$ m ladder makes a $${th}^\circ$ angle with the ground. How high (m) up the wall does it reach?`, h, s3(h), R`Height is opposite the angle: $${L}\sin${th}^\circ = ${s3(h)}$ m.`);
  }

  /* ---------- Unit 4 ---------- */
  function qLaws() {
    const k = ri(0, 3);
    if (k === 0) { const a = ri(4, 15), b = ri(4, 15), C = pick([30, 45, 60, 75, 100, 120, 135]); const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(C))); return num('laws', R`In triangle $ABC$, $a = ${a}$, $b = ${b}$, and the included angle $C = ${C}^\circ$. Find $c$ (three significant figures).`, c, s3(c), R`Law of Cosines: $c^2 = ${a}^2 + ${b}^2 - 2(${a})(${b})\cos${C}^\circ = ${s3(c * c)} \Rightarrow c = ${s3(c)}$.`, 'SAS → Law of Cosines.'); }
    if (k === 1) { const A = ri(30, 80), B = ri(30, 80); if (A + B >= 170) return qLaws(); const a = ri(5, 20); const b = a * Math.sin(rad(B)) / Math.sin(rad(A)); return num('laws', R`In triangle $ABC$, $A = ${A}^\circ$, $B = ${B}^\circ$, $a = ${a}$. Find $b$ (three significant figures).`, b, s3(b), R`Law of Sines: $\dfrac{b}{\sin${B}^\circ} = \dfrac{${a}}{\sin${A}^\circ} \Rightarrow b = ${s3(b)}$.`, 'Two angles and a side → Law of Sines.'); }
    if (k === 2) { const tr = pick([[7, 8, 9], [5, 6, 7], [8, 11, 13], [6, 9, 12], [10, 12, 15]]); const [a, b, c] = tr; const C = Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180 / Math.PI; return num('laws', R`A triangle has sides $${a}$, $${b}$, $${c}$. Find the angle opposite the side of length $${c}$ (degrees).`, C, s3(C), R`$\cos C = \dfrac{${a}^2 + ${b}^2 - ${c}^2}{2(${a})(${b})} = ${s3((a * a + b * b - c * c) / (2 * a * b))} \Rightarrow C = ${s3(C)}^\circ$.`, 'SSS → Law of Cosines solved for the angle.'); }
    const a = ri(4, 15), b = ri(4, 15), C = pick([30, 45, 60, 90, 120, 150]); const area = 0.5 * a * b * Math.sin(rad(C)); return num('laws', R`Find the area of a triangle with sides $${a}$ and $${b}$ enclosing an angle of $${C}^\circ$.`, area, s3(area), R`Area $= \tfrac12 ab\sin C = \tfrac12(${a})(${b})\sin${C}^\circ = ${s3(area)}$.`);
  }
  const EXACT = { 0: [0, 1, 0], 30: [0.5, Math.sqrt(3) / 2, 1 / Math.sqrt(3)], 45: [Math.SQRT1_2, Math.SQRT1_2, 1], 60: [Math.sqrt(3) / 2, 0.5, Math.sqrt(3)], 90: [1, 0, Infinity] };
  const EXTEX = { 0: ['0', '1', '0'], 30: [R`\frac12`, R`\frac{\sqrt3}{2}`, R`\frac{\sqrt3}{3}`], 45: [R`\frac{\sqrt2}{2}`, R`\frac{\sqrt2}{2}`, '1'], 60: [R`\frac{\sqrt3}{2}`, R`\frac12`, R`\sqrt3`], 90: ['1', '0', R`\text{undefined}`] };
  function refAngle(th) { th = ((th % 360) + 360) % 360; if (th <= 90) return th; if (th <= 180) return 180 - th; if (th <= 270) return th - 180; return 360 - th; }
  function quadrant(th) { th = ((th % 360) + 360) % 360; return th < 90 ? 1 : th < 180 ? 2 : th < 270 ? 3 : 4; }
  function qTrigFn() {
    const k = ri(0, 3);
    if (k === 0) { const th = pick([100, 110, 135, 150, 160, 200, 210, 225, 240, 250, 300, 315, 330, 350, 400, 480, -30, -120]); return num('trigfn', R`Find the reference angle (degrees) of $${th}^\circ$.`, refAngle(th), `${refAngle(th)}`, R`$${th}^\circ$ is coterminal with $${((th % 360) + 360) % 360}^\circ$, in quadrant ${['I', 'II', 'III', 'IV'][quadrant(th) - 1]}; reference angle $${refAngle(th)}^\circ$.`, 'Acute angle between the terminal side and the x-axis.'); }
    if (k === 1) { const th = pick([120, 135, 150, 210, 225, 240, 300, 315, 330, 180, 270]); const fn = pick(['sin', 'cos']); const r = refAngle(th); const q = quadrant(th); const base = r === 0 ? (fn === 'sin' ? [0, '0'] : [1, '1']) : (fn === 'sin' ? [EXACT[r][0], EXTEX[r][0]] : [EXACT[r][1], EXTEX[r][1]]); let sign = 1; if (th === 180) sign = fn === 'sin' ? 1 : -1; else if (th === 270) sign = fn === 'sin' ? -1 : 1; else sign = fn === 'sin' ? (q <= 2 ? 1 : -1) : (q === 1 || q === 4 ? 1 : -1); const val = th === 180 ? (fn === 'sin' ? 0 : -1) : th === 270 ? (fn === 'sin' ? -1 : 0) : sign * base[0]; const tex = th === 180 ? (fn === 'sin' ? '0' : '-1') : th === 270 ? (fn === 'sin' ? '-1' : '0') : (sign < 0 ? '-' : '') + base[1]; return num('trigfn', R`Give the exact value of $\${fn} ${th}^\circ$ (type sqrt(3)/2, -1/2, etc.).`, val, tex, R`Quadrant ${['I', 'II', 'III', 'IV'][q - 1]}, reference angle $${r}^\circ$; ${fn === 'sin' ? 'sine' : 'cosine'} is ${sign < 0 ? 'negative' : 'positive'} there: $${tex}$.`, 'Reference angle for the size, quadrant for the sign.'); }
    if (k === 2) { const bank = [{ v: R`\cos\theta = -\tfrac12`, ok: '120° and 240°', bad: ['60° and 300°', '120° and 300°', '60° and 120°'], why: 'Reference angle 60°; cosine is negative in quadrants II and III.' }, { v: R`\sin\theta = \tfrac{\sqrt2}{2}`, ok: '45° and 135°', bad: ['45° and 315°', '45° and 225°', '135° and 225°'], why: 'Reference angle 45°; sine positive in I and II.' }, { v: R`\tan\theta = -\sqrt3`, ok: '120° and 300°', bad: ['60° and 240°', '120° and 240°', '60° and 300°'], why: 'Reference angle 60°; tangent negative in II and IV.' }, { v: R`\sin\theta = -\tfrac12`, ok: '210° and 330°', bad: ['30° and 150°', '210° and 150°', '30° and 330°'], why: 'Reference angle 30°; sine negative in III and IV.' }]; const it = pick(bank); return mc('trigfn', R`Find all $\theta$ in $[0^\circ, 360^\circ)$ with $${it.v}$.`, it.ok, it.bad, it.why); }
    const th = pick([100, 200, 300, 160, 250, 340]); const q = quadrant(th); return mc('trigfn', R`For $\theta = ${th}^\circ$, which is TRUE?`, ['sin θ > 0 and cos θ > 0', 'sin θ > 0 and cos θ < 0', 'sin θ < 0 and cos θ < 0', 'sin θ < 0 and cos θ > 0'][q - 1], ['sin θ > 0 and cos θ > 0', 'sin θ > 0 and cos θ < 0', 'sin θ < 0 and cos θ < 0', 'sin θ < 0 and cos θ > 0'].filter((_, i) => i !== q - 1), `Quadrant ${['I', 'II', 'III', 'IV'][q - 1]}: ${['all positive', 'only sine positive', 'only tangent positive', 'only cosine positive'][q - 1]}.`);
  }
  function qIdentities() {
    const k = ri(0, 2);
    if (k === 0) { const bank = [{ e: R`\frac{1 - \cos^2\theta}{\sin\theta}`, ok: R`$\sin\theta$`, bad: [R`$\cos\theta$`, R`$\tan\theta$`, R`$1$`], why: R`$1 - \cos^2\theta = \sin^2\theta$; divide by $\sin\theta$.` }, { e: R`\sin\theta\cdot\frac{\cos\theta}{\sin\theta}`, ok: R`$\cos\theta$`, bad: [R`$\sin\theta$`, R`$\tan\theta$`, R`$\cot\theta$`], why: 'The sines cancel.' }, { e: R`\tan\theta\cos\theta`, ok: R`$\sin\theta$`, bad: [R`$\cos^2\theta$`, R`$1$`, R`$\sec\theta$`], why: R`$\tan\theta = \sin\theta/\cos\theta$.` }, { e: R`(1 - \sin\theta)(1 + \sin\theta)`, ok: R`$\cos^2\theta$`, bad: [R`$1 - \sin\theta$`, R`$\sin^2\theta$`, R`$1$`], why: R`Difference of squares gives $1 - \sin^2\theta = \cos^2\theta$.` }, { e: R`\frac{\sin(-\theta)}{\cos(-\theta)}`, ok: R`$-\tan\theta$`, bad: [R`$\tan\theta$`, R`$-\cot\theta$`, R`$\sin\theta$`], why: 'Sine is odd, cosine is even.' }]; const it = pick(bank); return mc('identities', R`Simplify $${it.e}$.`, it.ok, it.bad, it.why); }
    if (k === 1) { const bank = [[3, 5, 4], [5, 13, 12], [8, 17, 15], [7, 25, 24]]; const t = pick(bank); const q = pick([2, 3]); const sinv = q === 2 ? t[0] / t[1] : -t[0] / t[1]; const cosv = -t[2] / t[1]; const wantTan = Math.random() < 0.5; const ans = wantTan ? sinv / cosv : cosv; return num('identities', R`If $\sin\theta = ${q === 2 ? '' : '-'}\dfrac{${t[0]}}{${t[1]}}$ and $\theta$ is in quadrant ${q === 2 ? 'II' : 'III'}, find $${wantTan ? '\\tan' : '\\cos'}\theta$ exactly (type a fraction).`, ans, wantTan ? frac(q === 2 ? -t[0] : t[0], t[2]) : frac(-t[2], t[1]), R`$\cos^2\theta = 1 - \sin^2\theta = \dfrac{${t[2] * t[2]}}{${t[1] * t[1]}}$; cosine is negative in quadrant ${q === 2 ? 'II' : 'III'}, so $\cos\theta = -\dfrac{${t[2]}}{${t[1]}}$${wantTan ? `; then $\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta} = ${frac(q === 2 ? -t[0] : t[0], t[2])}$` : ''}.`, 'Pythagorean identity, then choose the sign from the quadrant.'); }
    const bank = [{ e: R`2\sin^2\theta = 1`, n: 4, why: R`$\sin\theta = \pm\tfrac{\sqrt2}{2}$: 45°, 135°, 225°, 315°.` }, { e: R`2\cos\theta + 1 = 0`, n: 2, why: R`$\cos\theta = -\tfrac12$: 120°, 240°.` }, { e: R`\sin\theta\cos\theta = 0`, n: 4, why: R`$\sin\theta = 0$ (0°, 180°) or $\cos\theta = 0$ (90°, 270°).` }, { e: R`\tan^2\theta = 3`, n: 4, why: R`$\tan\theta = \pm\sqrt3$: 60°, 120°, 240°, 300°.` }, { e: R`\sin\theta = 2`, n: 0, why: 'Sine never exceeds 1.' }]; const it = pick(bank); return num('identities', R`How many solutions does $${it.e}$ have in $[0^\circ, 360^\circ)$?`, it.n, `${it.n}`, it.why, 'Isolate the trig function first.');
  }
  function qRadians() {
    const k = ri(0, 4);
    if (k === 0) { const d = pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]); const r = d * Math.PI / 180; const g = gcd(d, 180); return num('radians', R`Convert $${d}^\circ$ to radians (type e.g. 5pi/6).`, r, R`\frac{${d / g === 1 ? '' : d / g}\pi}{${180 / g}}`.replace(R`\frac{\pi}{1}`, R`\pi`).replace(/\\frac\{(\d*)\\pi\}\{1\}/, '$1\\pi'), R`$${d}\cdot\dfrac{\pi}{180} = \dfrac{${d / g}\pi}{${180 / g}}$.`, 'Multiply by π/180 and reduce.'); }
    if (k === 1) { const it = pick([[Math.PI / 6, '\\pi/6', 30], [Math.PI / 4, '\\pi/4', 45], [Math.PI / 3, '\\pi/3', 60], [2 * Math.PI / 3, '2\\pi/3', 120], [3 * Math.PI / 4, '3\\pi/4', 135], [5 * Math.PI / 6, '5\\pi/6', 150], [7 * Math.PI / 6, '7\\pi/6', 210], [5 * Math.PI / 4, '5\\pi/4', 225], [4 * Math.PI / 3, '4\\pi/3', 240], [5 * Math.PI / 3, '5\\pi/3', 300], [11 * Math.PI / 6, '11\\pi/6', 330], [1, '1', 57.3], [2.5, '2.5', 143.2]]); return num('radians', R`Convert $${it[1]}$ radians to degrees.`, it[2], s3(it[2]), R`$${it[1]}\cdot\dfrac{180}{\pi} = ${s3(it[2])}^\circ$.`); }
    if (k === 2) { const r = ri(2, 20), d = pick([30, 40, 45, 60, 72, 90, 120, 150]); const s = r * rad(d); return num('radians', R`Find the arclength (three significant figures) cut off by a central angle of $${d}^\circ$ on a circle of radius $${r}$.`, s, s3(s), R`$\theta = ${d}\cdot\dfrac{\pi}{180} = ${s3(rad(d))}$ rad; $s = r\theta = ${r}(${s3(rad(d))}) = ${s3(s)}$.`, 'Convert to radians before using s = rθ.'); }
    if (k === 3) { const r = ri(2, 12), d = pick([30, 45, 60, 90, 120, 135]); const A = 0.5 * r * r * rad(d); return num('radians', R`Find the area of a sector with radius $${r}$ and central angle $${d}^\circ$ (three significant figures).`, A, s3(A), R`$A = \tfrac12 r^2\theta = \tfrac12(${r})^2(${s3(rad(d))}) = ${s3(A)}$.`); }
    const it = pick([['\\sin\\frac{\\pi}{6}', 0.5, R`\frac12`], ['\\cos\\frac{\\pi}{3}', 0.5, R`\frac12`], ['\\cos\\frac{5\\pi}{6}', -Math.sqrt(3) / 2, R`-\frac{\sqrt3}{2}`], ['\\sin\\frac{3\\pi}{2}', -1, '-1'], ['\\cos\\pi', -1, '-1'], ['\\sin\\frac{4\\pi}{3}', -Math.sqrt(3) / 2, R`-\frac{\sqrt3}{2}`], ['\\tan\\frac{\\pi}{4}', 1, '1'], ['\\cos\\frac{7\\pi}{4}', Math.SQRT1_2, R`\frac{\sqrt2}{2}`], ['\\sin\\frac{11\\pi}{6}', -0.5, R`-\frac12`]]); return num('radians', R`Give the exact value of $${it[0]}$.`, it[1], it[2], R`Convert to degrees if it helps, find the reference angle and the quadrant sign: $${it[2]}$.`);
  }
  function qSinusoid() {
    const k = ri(0, 3); const A = pick([2, 3, 4, 5, 0.5, 1.5]), B = pick([1, 2, 3, 4, 0.5, Math.PI / 6]), kk = ri(-4, 6);
    const Btex = B === Math.PI / 6 ? R`\frac{\pi}{6}` : `${B}`;
    if (k === 0) return num('sinusoid', R`Find the period of $y = ${A}\sin(${Btex}x) ${signed(kk)}$ (radians; type 2pi/3 etc.).`, 2 * Math.PI / B, B === Math.PI / 6 ? '12' : (2 / B === 1 ? R`2\pi` : R`\frac{2\pi}{${B}}`), R`Period $= \dfrac{2\pi}{B} = \dfrac{2\pi}{${Btex}} = ${s3(2 * Math.PI / B)}$.`, 'Period = 2π / B.');
    if (k === 1) return mc('sinusoid', R`For $y = ${A}\cos(${Btex}x) ${signed(kk)}$, the amplitude, midline and maximum are`, `amplitude ${A}, midline y = ${kk}, maximum ${kk + A}`, [`amplitude ${A}, midline y = ${kk}, maximum ${A}`, `amplitude ${kk}, midline y = ${A}, maximum ${kk + A}`, `amplitude ${2 * A}, midline y = ${kk}, maximum ${kk + 2 * A}`], `|A| = ${A} is the amplitude, k = ${kk} the midline, and the maximum is k + |A| = ${kk + A}.`);
    if (k === 2) { const mx = ri(6, 30), mn = mx - ri(2, 10); const want = pick(['amplitude', 'midline']); return num('sinusoid', R`A quantity oscillates between a minimum of $${mn}$ and a maximum of $${mx}$. Find the ${want} of the sinusoidal model.`, want === 'amplitude' ? (mx - mn) / 2 : (mx + mn) / 2, s3(want === 'amplitude' ? (mx - mn) / 2 : (mx + mn) / 2), R`Midline $= \dfrac{${mx} + ${mn}}{2} = ${(mx + mn) / 2}$; amplitude $= \dfrac{${mx} - ${mn}}{2} = ${(mx - mn) / 2}$.`); }
    const P = pick([4, 6, 8, 10, 12, 24, 365]); return num('sinusoid', R`A sinusoid has period $${P}$. Find $B$ in $y = A\sin(Bx) + k$ (type 2pi/${P} or a decimal).`, 2 * Math.PI / P, R`\frac{2\pi}{${P}}`, R`$B = \dfrac{2\pi}{\text{period}} = \dfrac{2\pi}{${P}} = ${s3(2 * Math.PI / P)}$.`);
  }
  function qInvTrig() {
    const k = ri(0, 3);
    if (k === 0) { const bank = [['\\sin^{-1}\\left(\\tfrac12\\right)', 30], ['\\cos^{-1}\\left(\\tfrac12\\right)', 60], ['\\tan^{-1}(1)', 45], ['\\sin^{-1}\\left(-\\tfrac{\\sqrt2}{2}\\right)', -45], ['\\cos^{-1}\\left(-\\tfrac12\\right)', 120], ['\\tan^{-1}(-\\sqrt3)', -60], ['\\cos^{-1}(0)', 90], ['\\sin^{-1}(-1)', -90], ['\\cos^{-1}\\left(-\\tfrac{\\sqrt3}{2}\\right)', 150]]; const it = pick(bank); return num('invtrig', R`Evaluate $${it[0]}$ in degrees.`, it[1], `${it[1]}`, R`The inverse returns the angle in its restricted range ($\sin^{-1},\tan^{-1}$: $-90^\circ$ to $90^\circ$; $\cos^{-1}$: $0^\circ$ to $180^\circ$): $${it[1]}^\circ$.`, 'Pick the angle in the restricted range with the right sign.'); }
    if (k === 1) { const th = pick([100, 120, 150, 160, 200, 210, 250, 300, 330]); const s = Math.sin(rad(th)); let ans = Math.asin(s) * 180 / Math.PI; return num('invtrig', R`Evaluate $\sin^{-1}(\sin ${th}^\circ)$ in degrees.`, ans, `${Math.round(ans)}`, R`$\sin${th}^\circ = ${s3(s)}$, and $\sin^{-1}$ returns the angle between $-90^\circ$ and $90^\circ$ with that sine: $${Math.round(ans)}^\circ$, not $${th}^\circ$.`, 'The answer must lie in [−90°, 90°].'); }
    if (k === 2) { const t = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]); const fn = pick(['sin', 'cos']); const inner = fn === 'sin' ? [t[0], t[2]] : [t[1], t[2]]; const want = pick(['cos', 'tan']); let ans, tex; if (fn === 'sin') { ans = want === 'cos' ? t[1] / t[2] : t[0] / t[1]; tex = want === 'cos' ? frac(t[1], t[2]) : frac(t[0], t[1]); } else { ans = want === 'cos' ? t[1] / t[2] : t[0] / t[1]; if (want === 'cos') { ans = t[1] / t[2]; tex = frac(t[1], t[2]); } else { ans = t[0] / t[1]; tex = frac(t[0], t[1]); } } if (fn === 'cos' && want === 'cos') return qInvTrig(); return num('invtrig', R`Evaluate $\${want}\left(\${fn}^{-1}\dfrac{${inner[0]}}{${inner[1]}}\right)$ exactly (type a fraction).`, ans, tex, R`Draw the right triangle: ${fn === 'sin' ? `opposite ${t[0]}, hypotenuse ${t[2]}, adjacent ${t[1]}` : `adjacent ${t[1]}, hypotenuse ${t[2]}, opposite ${t[0]}`}. Then $\${want} = ${tex}$.`, 'Sketch the triangle the inverse function describes.'); }
    const bank = [['\\sec 60^\\circ', 2, '2'], ['\\csc 30^\\circ', 2, '2'], ['\\cot 45^\\circ', 1, '1'], ['\\sec 45^\\circ', Math.SQRT2, R`\sqrt2`], ['\\csc 90^\\circ', 1, '1'], ['\\cot 30^\\circ', Math.sqrt(3), R`\sqrt3`], ['\\sec 180^\\circ', -1, '-1']]; const it = pick(bank); return num('invtrig', R`Evaluate $${it[0]}$ exactly.`, it[1], it[2], R`Take the reciprocal of the matching function: $${it[0]} = ${it[2]}$.`);
  }
  function qQuadForm() {
    const k = ri(0, 2);
    if (k === 0) { const r1 = ri(1, 3), r2 = r1 + ri(1, 3); const b = -(r1 * r1 + r2 * r2), c = r1 * r1 * r2 * r2; return num('quadform', R`Find the <b>largest</b> real solution of $x^4 ${signed(b)}x^2 ${signed(c)} = 0$.`, r2, `${r2}`, R`Let $u = x^2$: $u^2 ${signed(b)}u ${signed(c)} = (u - ${r1 * r1})(u - ${r2 * r2}) = 0$, so $x^2 = ${r1 * r1}$ or $${r2 * r2}$: $x = \pm${r1}, \pm${r2}$. Largest: $${r2}$.`, 'Let u = x².'); }
    if (k === 1) { const r1 = ri(1, 4), r2 = r1 + ri(1, 4); const b = -(r1 + r2), c = r1 * r2; return num('quadform', R`Find the <b>larger</b> solution of $x ${signed(b)}\sqrt{x} ${signed(c)} = 0$.`, r2 * r2, `${r2 * r2}`, R`Let $u = \sqrt x$: $u^2 ${signed(b)}u ${signed(c)} = (u - ${r1})(u - ${r2}) = 0 \Rightarrow \sqrt x = ${r1}, ${r2} \Rightarrow x = ${r1 * r1}, ${r2 * r2}$.`, 'Let u = √x.'); }
    const bank = [{ e: R`2\sin^2\theta - \sin\theta - 1 = 0`, n: 3, why: R`$(2\sin\theta + 1)(\sin\theta - 1) = 0$: $\sin\theta = -\tfrac12$ (210°, 330°) or $1$ (90°).` }, { e: R`2\cos^2\theta + \cos\theta - 1 = 0`, n: 3, why: R`$(2\cos\theta - 1)(\cos\theta + 1) = 0$: $\cos\theta = \tfrac12$ (60°, 300°) or $-1$ (180°).` }, { e: R`\tan^2\theta - \tan\theta = 0`, n: 4, why: R`$\tan\theta(\tan\theta - 1) = 0$: 0°, 180°, 45°, 225°.` }, { e: R`\sin^2\theta - 3\sin\theta + 2 = 0`, n: 1, why: R`$(\sin\theta - 1)(\sin\theta - 2) = 0$; only $\sin\theta = 1$ is possible: 90°.` }]; const it = pick(bank); return num('quadform', R`How many solutions does $${it.e}$ have in $[0^\circ, 360^\circ)$?`, it.n, `${it.n}`, it.why, 'Factor as a quadratic in the trig function, then count valid angles.');
  }

  const GENERATORS = [qFnEval, qAroc, qLinear, qModels, qTransform, qAbsVal, qDomain, qVariation, qExponents, qExpGrowth, qLogs, qExpModels, qInverse, qLogFn, qQuadratics, qPoly, qComplex, qRational, qTriangles, qRightTri, qLaws, qTrigFn, qIdentities, qRadians, qSinusoid, qInvTrig, qQuadForm];
  const BY_TOPIC = {};
  for (const g of GENERATORS) { const t = g().topic; (BY_TOPIC[t] = BY_TOPIC[t] || []).push(g); }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]); if (!pool.length) return []; const out = []; const order = shuffle(pool); let guard = 0;
    while (out.length < n && guard++ < n * 25) { const t = order[out.length % order.length]; let q; try { q = pick(BY_TOPIC[t])(); } catch (e) { continue; } if (!q || (q.type === 'mc' && q.options.length < 2)) continue; if (out.some(o => o.prompt === q.prompt)) continue; q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); out.push(q); }
    return out;
  }
  global.Courses = global.Courses || {}; global.Courses.precalc = global.Courses.precalc || {};
  global.Courses.precalc.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt: s3, shuffle } };
})(window);
