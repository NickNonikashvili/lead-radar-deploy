/* ============================================================
   MatHub — Calculus I procedural question generators
   Every generator returns:
   { topic, type:'mc'|'num', prompt, options?, answer, answerTex?, explanation, hint? }
   For 'mc', answer is the index of the correct option.
   For 'num', answer is a number; answerTex is shown after checking.
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;

  /* ---------- topic registry ---------- */
  const TOPICS = {
    'velocity':            { unit: 1, sec: '1.1', label: 'Velocity & position' },
    'aroc':                { unit: 1, sec: '1.1', label: 'Average rate of change' },
    'rate-units':          { unit: 1, sec: '1.1', label: 'Slope & units in context' },
    'limit-forms':         { unit: 1, sec: '1.2', label: 'Limit forms (0/0, c/0)' },
    'limit-algebra':       { unit: 1, sec: '1.2', label: 'Limits by algebra' },
    'limits-graph-table':  { unit: 1, sec: '1.2', label: 'One-sided limits & tables' },
    'limit-def':           { unit: 1, sec: '1.3', label: "Limit definition of f'" },
    'deriv-point':         { unit: 1, sec: '1.3', label: 'Derivative at a point' },
    'derivative-function': { unit: 1, sec: '1.4', label: "f vs. f' graphs" },
    'interpretation':      { unit: 1, sec: '1.5', label: "Interpreting f'(a)" },
    'estimating':          { unit: 1, sec: '1.5', label: 'Estimating from data' },
    'second-derivative':   { unit: 1, sec: '1.6', label: 'Second derivative & concavity' },
    'continuity':          { unit: 2, sec: '1.7', label: 'Continuity & differentiability' },
    'tangent-line':        { unit: 2, sec: '1.8', label: 'Tangent line approximation' },
    'basic-rules':         { unit: 2, sec: '2.1', label: 'Power, sum & exponential rules' },
    'trig':                { unit: 2, sec: '2.2', label: 'Trig derivatives' },
    'product-quotient':    { unit: 2, sec: '2.3', label: 'Product & quotient rules' },
    'chain-rule':          { unit: 2, sec: '2.5', label: 'Chain rule' },
    'inverse-functions':   { unit: 2, sec: '2.6', label: 'ln, logs & inverse trig' },
    'implicit':            { unit: 3, sec: '2.7', label: 'Implicit differentiation' },
    'lhopital':            { unit: 3, sec: '2.8', label: "L'Hôpital's rule" },
    'limits-infinity':     { unit: 3, sec: '2.8', label: 'Limits at infinity' },
    'extrema':             { unit: 3, sec: '3.1', label: 'Local extrema & tests' },
    'related-rates':       { unit: 3, sec: '3.5', label: 'Related rates' },
    'optimization':        { unit: 4, sec: '3.3', label: 'Global & applied optimization' },
    'distance':            { unit: 4, sec: '4.1', label: 'Distance from velocity' },
    'riemann':             { unit: 4, sec: '4.2', label: 'Riemann sums' },
    'definite-integral':   { unit: 4, sec: '4.3', label: 'Definite integral & properties' },
    'ftc':                 { unit: 4, sec: '4.4', label: 'FTC & total change' },
    'antiderivatives':     { unit: 4, sec: '5.1', label: 'Antiderivatives' },
    'ftc2':                { unit: 4, sec: '5.2', label: 'Second FTC' },
    'substitution':        { unit: 4, sec: '5.3', label: 'u-substitution (bonus)' }
  };

  /* ---------- helpers ---------- */
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const nz = (a, b) => { let v = 0; while (v === 0) v = ri(a, b); return v; };
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  function fracTex(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (d === 1) return `${n}`;
    return (n < 0 ? '-' : '') + R`\frac{${Math.abs(n)}}{${d}}`;
  }
  function fmt(x) {
    if (!isFinite(x)) return String(x);
    const r = Math.round(x * 10000) / 10000;
    return String(r);
  }
  // polynomial TeX from [[coef, power], ...]
  function term(c, p, first, v = 'x') {
    if (c === 0) return '';
    const sign = c < 0 ? '-' : (first ? '' : '+');
    const a = Math.abs(c);
    let body;
    if (p === 0) body = `${a}`;
    else { const co = a === 1 ? '' : `${a}`; body = p === 1 ? `${co}${v}` : `${co}${v}^{${p}}`; }
    return (first ? sign : ` ${sign} `) + body;
  }
  function poly(terms, v = 'x') { let s = '', first = true; for (const [c, p] of terms) { if (!c) continue; s += term(c, p, first, v); first = false; } return s || '0'; }
  const signed = k => (k < 0 ? ` - ${Math.abs(k)}` : ` + ${k}`); // " + 3" / " - 3"
  const lin = (m, k, v = 'x') => poly([[m, 1], [k, 0]], v);

  function mc(topic, prompt, correct, distractors, explanation, hint) {
    const opts = [correct];
    for (const d of distractors) if (!opts.includes(d)) opts.push(d);
    while (opts.length < 2) opts.push('None of these');
    const order = shuffle(opts.map((_, i) => i));
    const options = order.map(i => opts[i]);
    return { topic, type: 'mc', prompt, options, answer: options.indexOf(correct), explanation, hint };
  }
  function num(topic, prompt, answer, answerTex, explanation, hint) {
    return { topic, type: 'num', prompt, answer, answerTex: answerTex || fmt(answer), explanation, hint };
  }
  const evalPoly = (terms, x) => terms.reduce((s, [c, p]) => s + c * Math.pow(x, p), 0);

  /* ======================================================
     UNIT 1
     ====================================================== */
  function qRateUnits() {
    const c = pick([
      { story: 'The average cost of tuition and fees at public four-year colleges', y: 'T', ylabel: 'the cost in dollars', xlabel: 'years after 2024', yu: 'dollars', xu: 'year', m: ri(2, 9) * 100, b: ri(90, 140) * 100 },
      { story: 'The population of a mountain town', y: 'P', ylabel: 'the population in thousands', xlabel: 'years after 2020', yu: 'thousand people', xu: 'year', m: ri(2, 9), b: ri(40, 90) },
      { story: 'The total cost of a production run', y: 'C', ylabel: 'the cost in dollars', xlabel: 'the number of items produced', yu: 'dollars', xu: 'item', m: ri(3, 15), b: ri(20, 90) * 10 },
      { story: 'Your distance from Bozeman on a road trip', y: 'D', ylabel: 'the distance in miles', xlabel: 'hours of driving', yu: 'miles', xu: 'hour', m: ri(45, 70), b: ri(1, 9) * 10 },
      { story: 'The amount of water in a tank', y: 'W', ylabel: 'the volume in gallons', xlabel: 'minutes after the valve opens', yu: 'gallons', xu: 'minute', m: ri(2, 12), b: ri(5, 60) }
    ]);
    const prompt = R`${c.story} is modeled by $${c.y} = ${c.m}x + ${c.b}$, where $${c.y}$ is ${c.ylabel} and $x$ is ${c.xlabel}. What is the slope, and what are its units?`;
    return mc('rate-units', prompt,
      `${c.m} ${c.yu} per ${c.xu}`,
      [`${c.m} ${c.xu}s per ${c.yu.replace(/s$/, '')}`, `${c.b} ${c.yu} per ${c.xu}`, `${c.m} ${c.yu}`],
      R`In $y = mx + b$ the slope is the coefficient of $x$, here $${c.m}$. Units of a rate are output per input: <b>${c.yu} per ${c.xu}</b>. In context, $${c.y}$ grows by ${c.m} ${c.yu} for each additional ${c.xu}. (The intercept $${c.b}$ is the starting value.)`,
      'Slope units are always (units of the output) per (unit of the input).');
  }

  function qArocPoly() {
    const a = nz(-3, 3), b = ri(-6, 6), c = ri(-9, 9);
    let p = ri(-3, 4), q = p + ri(1, 4);
    const f = x => a * x * x + b * x + c;
    const av = (f(q) - f(p)) / (q - p);
    const fx = poly([[a, 2], [b, 1], [c, 0]]);
    return num('aroc', R`Find the average rate of change of $f(x) = ${fx}$ on the interval $[${p},\,${q}]$.`, av, fmt(av),
      R`$AV_{[${p},${q}]} = \dfrac{f(${q}) - f(${p})}{${q} - (${p})} = \dfrac{${f(q)} - (${f(p)})}{${q - p}} = ${fmt(av)}$.`,
      R`$AV_{[a,b]} = \dfrac{f(b)-f(a)}{b-a}$. Compute both function values first.`);
  }

  function qArocSqrt() {
    const sq = [1, 4, 9, 16, 25, 36, 49];
    const i = ri(0, sq.length - 2), j = ri(i + 1, sq.length - 1);
    const s1 = sq[i], s2 = sq[j], r1 = Math.sqrt(s1), r2 = Math.sqrt(s2);
    const c = ri(1, 9);
    const av = (r2 - r1) / (s2 - s1);
    return num('aroc', R`Let $f(x) = ${c} + \sqrt{x}$. Find the average rate of change of $f$ on $[${s1},\,${s2}]$.`, av, fracTex(r2 - r1, s2 - s1),
      R`$f(${s2}) = ${c + r2}$ and $f(${s1}) = ${c + r1}$, so $AV_{[${s1},${s2}]} = \dfrac{${c + r2} - ${c + r1}}{${s2} - ${s1}} = \dfrac{${r2 - r1}}{${s2 - s1}} = ${fracTex(r2 - r1, s2 - s1)}$.`,
      'Both endpoints are perfect squares, so the square roots are whole numbers.');
  }

  function qArocTable() {
    const step = pick([5, 10]);
    const n = 6;
    const t = Array.from({ length: n }, (_, i) => i * step);
    const d = [0];
    for (let i = 1; i < n; i++) d.push(d[i - 1] + ri(2, 9) / 2);
    const i = ri(0, n - 2), j = pick([i + 1, Math.min(i + 2, n - 1)]);
    const av = (d[j] - d[i]) / (t[j] - t[i]);
    const rows = t.map((tt, k) => `${tt}`).join(' & ');
    const vals = d.map(v => `${v}`).join(' & ');
    const table = R`\begin{array}{c|${'c'.repeat(n)}} t\ (\text{min}) & ${rows} \\ \hline d(t)\ (\text{miles}) & ${vals} \end{array}`;
    return num('aroc', R`Your bike odometer records the data below. Find the average velocity over $[${t[i]},\,${t[j]}]$ in miles per minute.<div class="qmath">$$${table}$$</div>`, av, fmt(av),
      R`$AV_{[${t[i]},${t[j]}]} = \dfrac{d(${t[j]}) - d(${t[i]})}{${t[j]} - ${t[i]}} = \dfrac{${d[j]} - ${d[i]}}{${t[j] - t[i]}} = ${fmt(av)}$ miles per minute.`,
      'Average velocity is change in distance over change in time.');
  }

  function qVelocity() {
    const v0 = pick([16, 32, 48, 64, 80]), h0 = pick([0, 6, 10, 20, 50]);
    const s = t => -16 * t * t + v0 * t + h0;
    const sx = poly([[-16, 2], [v0, 1], [h0, 0]], 't');
    const kind = ri(0, 2);
    if (kind === 0) {
      const t1 = ri(0, 2), t2 = t1 + ri(1, 2);
      const av = (s(t2) - s(t1)) / (t2 - t1);
      return num('velocity', R`A ball's height in feet after $t$ seconds is $s(t) = ${sx}$. Find its average velocity on $[${t1},\,${t2}]$ (ft/s).`, av, fmt(av),
        R`$AV_{[${t1},${t2}]} = \dfrac{s(${t2}) - s(${t1})}{${t2 - t1}} = \dfrac{${s(t2)} - ${s(t1)}}{${t2 - t1}} = ${fmt(av)}$ ft/s.`);
    }
    if (kind === 1) {
      const t0 = ri(0, 3);
      const v = -32 * t0 + v0;
      return num('velocity', R`A ball's height in feet after $t$ seconds is $s(t) = ${sx}$. Find its instantaneous velocity at $t = ${t0}$ (ft/s).`, v, fmt(v),
        R`Instantaneous velocity is $s'(t) = -32t + ${v0}$ (from the limit definition, or the derivative rules). $s'(${t0}) = ${v}$ ft/s.`,
        R`Compute $\lim_{h\to0}\frac{s(t_0+h)-s(t_0)}{h}$, or recall that $s'(t) = -32t + v_0$ for this kind of function.`);
    }
    const tmax = v0 / 32;
    return num('velocity', R`A ball's height in feet after $t$ seconds is $s(t) = ${sx}$. At what time (seconds) is its instantaneous velocity zero?`, tmax, fmt(tmax),
      R`Velocity is $s'(t) = -32t + ${v0}$. Setting $-32t + ${v0} = 0$ gives $t = ${fmt(tmax)}$ s (the top of the flight).`);
  }

  const FORM_BANK = [
    { e: R`\frac{\sin x}{x}`, a: '0', form: 'ind', why: R`\sin 0 = 0 and the denominator is 0: $\frac00$.` },
    { e: R`\frac{\sin x}{\cos x}`, a: '0', form: 'valid', why: R`\frac{0}{1} = 0.` },
    { e: R`\frac{x+1}{x-1}`, a: '0', form: 'valid', why: R`\frac{1}{-1} = -1.` },
    { e: R`\frac{x+4}{x}`, a: '0', form: 'va', why: R`\frac{4}{0}: nonzero over zero.` },
    { e: R`\frac{x}{\ln(x+1)}`, a: '0', form: 'ind', why: R`\ln 1 = 0, so $\frac00$.` },
    { e: R`\frac{x^2+1}{x^2-1}`, a: '1', form: 'va', why: R`\frac{2}{0}.` },
    { e: R`\frac{x^2-9}{x-3}`, a: '3', form: 'ind', why: R`\frac{0}{0}; factor to finish.` },
    { e: R`\frac{x-3}{x^2-9}`, a: '-3', form: 'va', why: R`\frac{-6}{0}.` },
    { e: R`\frac{e^x-1}{x}`, a: '0', form: 'ind', why: R`e^0 - 1 = 0 over 0.` },
    { e: R`\frac{1-\cos x}{x}`, a: '0', form: 'ind', why: R`1 - \cos 0 = 0 over 0.` },
    { e: R`\frac{\ln x}{x-1}`, a: '1', form: 'ind', why: R`\ln 1 = 0 over 0.` },
    { e: R`\frac{x^2+2x}{x+1}`, a: '-1', form: 'va', why: R`\frac{-1}{0}.` },
    { e: R`\frac{x^2-4}{x^2+4}`, a: '2', form: 'valid', why: R`\frac{0}{8} = 0.` },
    { e: R`\frac{\sqrt{x}}{x-4}`, a: '4', form: 'va', why: R`\frac{2}{0}.` },
    { e: R`\frac{\sqrt{x+7}-3}{x-2}`, a: '2', form: 'ind', why: R`\sqrt9 - 3 = 0 over 0.` },
    { e: R`\frac{\tan x}{x}`, a: '0', form: 'ind', why: R`\tan 0 = 0 over 0.` },
    { e: R`\frac{x^2}{x-1}`, a: '1', form: 'va', why: R`\frac{1}{0}.` },
    { e: R`\frac{2x-6}{x^2-9}`, a: '3', form: 'ind', why: R`\frac{0}{0}.` },
    { e: R`\frac{\cos x}{x}`, a: '0', form: 'va', why: R`\frac{1}{0}.` },
    { e: R`\frac{x^2-x}{x}`, a: '0', form: 'ind', why: R`\frac00; factor out $x$.` },
    { e: R`\frac{x+2}{x^2+1}`, a: '0', form: 'valid', why: R`\frac{2}{1} = 2.` },
    { e: R`\frac{e^x}{x}`, a: '0', form: 'va', why: R`\frac{1}{0}.` }
  ];
  const FORM_LABEL = { valid: 'Valid answer (the limit is that value)', va: 'Vertical asymptote (limit does not exist)', ind: 'Indeterminate form (do more algebra)' };
  function qLimitForm() {
    const it = pick(FORM_BANK);
    const opts = ['valid', 'va', 'ind'];
    return mc('limit-forms', R`As $x \to ${it.a}$, what form does $\displaystyle ${it.e}$ take?`,
      FORM_LABEL[it.form], opts.filter(o => o !== it.form).map(o => FORM_LABEL[o]),
      R`Substitute $x = ${it.a}$: $${it.why}$ <b>${FORM_LABEL[it.form]}.</b>`,
      R`Substitute the value into the numerator and denominator separately: $\frac{c}{d}$ valid, $\frac{c}{0}$ vertical asymptote, $\frac{0}{0}$ indeterminate.`);
  }

  function qLimitFactor() {
    const a = nz(-4, 4), b = ri(-5, 5);
    const numer = poly([[1, 2], [b - a, 1], [-a * b, 0]]);
    const den = lin(1, -a);
    const ans = a + b;
    return num('limit-algebra', R`Using algebra, evaluate $\displaystyle\lim_{x\to ${a}} \frac{${numer}}{${den}}$.`, ans, `${ans}`,
      R`Substitution gives $\frac00$. Factor: $${numer} = (${den})(${lin(1, b)})$. Cancel the common factor: $\lim_{x\to${a}} (${lin(1, b)}) = ${ans}$.`,
      R`The form is $\frac00$: factor the numerator; one factor must be $(${den})$.`);
  }

  function qLimitDiffSquares() {
    const a = nz(-6, 6);
    if (Math.random() < 0.5) {
      return num('limit-algebra', R`Evaluate $\displaystyle\lim_{x\to ${a}} \frac{x^2 - ${a * a}}{${lin(1, -a)}}$.`, 2 * a, `${2 * a}`,
        R`$x^2 - ${a * a} = (${lin(1, -a)})(${lin(1, a)})$. Cancel: $\lim_{x\to${a}}(${lin(1, a)}) = ${2 * a}$.`);
    }
    return num('limit-algebra', R`Evaluate $\displaystyle\lim_{x\to ${a}} \frac{${lin(1, -a)}}{x^2 - ${a * a}}$.`, 1 / (2 * a), fracTex(1, 2 * a),
      R`$x^2 - ${a * a} = (${lin(1, -a)})(${lin(1, a)})$. Cancel: $\lim_{x\to${a}}\dfrac{1}{${lin(1, a)}} = ${fracTex(1, 2 * a)}$.`);
  }

  function qLimitConjugate() {
    const k = ri(2, 5), a = ri(1, 9), c = k * k - a;
    const inside = c === 0 ? 'x' : (c > 0 ? `x + ${c}` : `x - ${-c}`);
    return num('limit-algebra', R`Using algebra, evaluate $\displaystyle\lim_{x\to ${a}} \frac{\sqrt{${inside}} - ${k}}{${lin(1, -a)}}$.`, 1 / (2 * k), fracTex(1, 2 * k),
      R`The form is $\frac00$. Multiply top and bottom by the conjugate $\sqrt{${inside}} + ${k}$: the numerator becomes $(${inside}) - ${k * k} = ${lin(1, -a)}$. Cancel with the denominator to get $\dfrac{1}{\sqrt{${inside}} + ${k}} \to \dfrac{1}{${k} + ${k}} = ${fracTex(1, 2 * k)}$.`,
      'Multiply by the conjugate of the numerator.');
  }

  function qLimitReciprocal() {
    const a = ri(2, 6);
    return num('limit-algebra', R`Using algebra, evaluate $\displaystyle\lim_{x\to ${a}} \frac{\frac{1}{x} - \frac{1}{${a}}}{${lin(1, -a)}}$.`, -1 / (a * a), fracTex(-1, a * a),
      R`Combine the numerator: $\dfrac{${a} - x}{${a}x}$. Then $\dfrac{${a}-x}{${a}x(x-${a})} = \dfrac{-1}{${a}x} \to -\dfrac{1}{${a * a}}$.`,
      'Get a common denominator in the numerator first.');
  }

  function qLimitTable() {
    const a = ri(2, 6), b = ri(-4, 6);
    const L = a + b;
    const xs = [a - 0.1, a - 0.01, a - 0.001, a + 0.001, a + 0.01, a + 0.1];
    const numer = poly([[1, 2], [b - a, 1], [-a * b, 0]]);
    const rows = xs.map(x => fmt(x)).join(' & ');
    const vals = xs.map(x => fmt(x + b)).join(' & ');
    const table = R`\begin{array}{c|cccccc} x & ${rows} \\ \hline f(x) & ${vals} \end{array}`;
    return num('limits-graph-table', R`The table shows values of $f(x) = \dfrac{${numer}}{${lin(1, -a)}}$ near $x = ${a}$. What does the table suggest for $\displaystyle\lim_{x\to ${a}} f(x)$?<div class="qmath">$$${table}$$</div>`, L, `${L}`,
      R`From both sides the outputs approach $${L}$, so the limit is $${L}$ even though $f(${a})$ is undefined. Algebraically, $f(x) = ${lin(1, b)}$ for $x \ne ${a}$.`);
  }

  function qPiecewise() {
    const a = ri(-2, 3), m1 = nz(-3, 3), c1 = ri(-5, 5), m2 = nz(-3, 3);
    const same = Math.random() < 0.4;
    const c2 = same ? m1 * a + c1 - m2 * a : ri(-5, 5);
    const left = m1 * a + c1, right = m2 * a + c2;
    const fdef = R`f(x) = \begin{cases} ${lin(m1, c1)} & x < ${a} \\ ${lin(m2, c2)} & x \ge ${a} \end{cases}`;
    const kind = ri(0, 2);
    if (kind === 0) return num('limits-graph-table', R`Let $${fdef}$. Find $\displaystyle\lim_{x\to ${a}^-} f(x)$.`, left, `${left}`,
      R`From the left, $x < ${a}$, so use the first piece: $${m1}(${a})${signed(c1)} = ${left}$.`);
    if (kind === 1) return num('limits-graph-table', R`Let $${fdef}$. Find $\displaystyle\lim_{x\to ${a}^+} f(x)$.`, right, `${right}`,
      R`From the right, $x \ge ${a}$, so use the second piece: $${m2}(${a})${signed(c2)} = ${right}$.`);
    const exists = left === right;
    return mc('limits-graph-table', R`Let $${fdef}$. Does $\displaystyle\lim_{x\to ${a}} f(x)$ exist?`,
      exists ? `Yes, it equals ${left}` : `No: the left limit is ${left} and the right limit is ${right}`,
      exists ? [`No: the left limit is ${left} and the right limit is ${right + 1}`, `Yes, it equals ${left + 2}`, 'No, because the two pieces have different slopes']
              : [`Yes, it equals ${left}`, `Yes, it equals ${right}`, 'Yes, because both pieces are lines'],
      R`Left limit (first piece): $${left}$. Right limit (second piece): $${right}$. ${exists ? 'They agree, so the limit exists and equals ' + left + '.' : 'They differ, so the two-sided limit does not exist (a jump).'}`);
  }

  function qLimitDefQuadratic() {
    const a = nz(-3, 3), b = nz(-6, 6), c = ri(-9, 9);
    const fx = poly([[a, 2], [b, 1], [c, 0]]);
    const correct = `$${poly([[2 * a, 1], [b, 0]])}$`;
    return mc('limit-def', R`Use the limit definition $f'(x) = \lim_{h\to0}\frac{f(x+h)-f(x)}{h}$ to find $f'(x)$ for $f(x) = ${fx}$.`,
      correct, [`$${poly([[a, 1], [b, 0]])}$`, `$${poly([[2 * a, 1]])}$`, `$${poly([[2 * a, 1], [-b, 0]])}$`, `$${poly([[2 * a, 1], [b, 0], [c, 0]])}$`],
      R`$f(x+h) = ${a}(x+h)^2 ${signed(b)}(x+h) ${signed(c)}$. Expanding and subtracting $f(x)$ leaves $${2 * a}xh ${signed(a)}h^2 ${signed(b)}h$. Divide by $h$: $${2 * a}x ${signed(a)}h ${signed(b)}$. Let $h\to0$: $f'(x) = ${poly([[2 * a, 1], [b, 0]])}$.`,
      R`Every term without an $h$ cancels; every surviving term has a factor of $h$ to divide out.`);
  }

  function qLimitDefReciprocal() {
    const k = ri(2, 9), m = ri(1, 6);
    if (Math.random() < 0.5) {
      return mc('limit-def', R`Use the limit definition to find $p'(u)$ for $p(u) = \dfrac{${k}}{${m} - u}$.`,
        R`$\dfrac{${k}}{(${m}-u)^2}$`, [R`$-\dfrac{${k}}{(${m}-u)^2}$`, R`$\dfrac{${k}}{${m}-u}$`, R`$-\dfrac{${k}}{${m}-u}$`],
        R`$p(u+h) - p(u) = \dfrac{${k}}{${m}-u-h} - \dfrac{${k}}{${m}-u} = \dfrac{${k}h}{(${m}-u-h)(${m}-u)}$. Divide by $h$ and let $h\to0$: $p'(u) = \dfrac{${k}}{(${m}-u)^2}$.`,
        'Combine the two fractions over a common denominator; the numerator will have a factor of h.');
    }
    return mc('limit-def', R`Use the limit definition to find $g'(x)$ for $g(x) = \dfrac{${k}}{x + ${m}}$.`,
      R`$-\dfrac{${k}}{(x+${m})^2}$`, [R`$\dfrac{${k}}{(x+${m})^2}$`, R`$-\dfrac{${k}}{x+${m}}$`, R`$\dfrac{${k}}{x+${m}}$`],
      R`$g(x+h) - g(x) = \dfrac{${k}}{x+h+${m}} - \dfrac{${k}}{x+${m}} = \dfrac{-${k}h}{(x+h+${m})(x+${m})}$. Divide by $h$, let $h\to0$: $g'(x) = -\dfrac{${k}}{(x+${m})^2}$.`);
  }

  function qLimitDefSqrt() {
    const a = ri(1, 3), s = ri(1, 5), p = ri(1, 5), b = s * s - a * p;
    const inside = poly([[a, 1], [b, 0]]);
    const ans = a / (2 * s);
    return num('limit-def', R`Use the limit definition to find $f'(${p})$ for $f(x) = \sqrt{${inside}}$.`, ans, fracTex(a, 2 * s),
      R`$f'(${p}) = \lim_{h\to0}\dfrac{\sqrt{${s * s} + ${a}h} - ${s}}{h}$. Multiply by the conjugate: $\dfrac{${a}h}{h(\sqrt{${s * s}+${a}h}+${s})} = \dfrac{${a}}{\sqrt{${s * s}+${a}h}+${s}} \to \dfrac{${a}}{${2 * s}} = ${fracTex(a, 2 * s)}$.`,
      R`$f(${p}) = ${s}$. After multiplying by the conjugate, the $h$ cancels.`);
  }

  function qDerivPointQuadratic() {
    const a = nz(-3, 3), b = ri(-6, 6), c = ri(-9, 9), p = ri(-3, 3);
    const fx = poly([[a, 2], [b, 1], [c, 0]]);
    const ans = 2 * a * p + b;
    return num('deriv-point', R`Find $f'(${p})$ for $f(x) = ${fx}$. (Use the limit definition, then check with the derivative rules.)`, ans, `${ans}`,
      R`$f'(x) = ${poly([[2 * a, 1], [b, 0]])}$, so $f'(${p}) = ${2 * a}(${p}) ${signed(b)} = ${ans}$. This is the slope of the tangent line at $x = ${p}$.`);
  }

  const CONTEXTS = [
    { F: 'M', v: 't', what: 'the amount of ibuprofen in the body', fu: 'milligrams', vu: 'hour', vdesc: 'hours after a dose', a: 1.5, c: -5.7 },
    { F: 'V', v: 'm', what: "a car's value", fu: 'dollars', vu: 'mile', vdesc: 'miles driven', a: 25000, c: -0.61 },
    { F: 'W', v: 'c', what: "a person's weight", fu: 'pounds', vu: 'Calorie per day', vdesc: 'daily Calories consumed', a: 1500, c: 5 },
    { F: 'T', v: 'h', what: 'the outdoor temperature', fu: 'degrees Fahrenheit', vu: 'hour', vdesc: 'hours after noon', a: 3, c: -2 },
    { F: 'P', v: 't', what: 'the population of a city', fu: 'thousand people', vu: 'year', vdesc: 'years after 2020', a: 4, c: 1.2 },
    { F: 'C', v: 'q', what: 'the total cost of production', fu: 'dollars', vu: 'item', vdesc: 'items produced', a: 200, c: 3.5 },
    { F: 'H', v: 't', what: "a plant's height", fu: 'centimeters', vu: 'day', vdesc: 'days after planting', a: 10, c: 0.8 },
    { F: 'D', v: 't', what: 'the distance a cyclist has traveled', fu: 'miles', vu: 'minute', vdesc: 'minutes into a ride', a: 40, c: 0.3 }
  ];
  function qInterpretation() {
    const c = pick(CONTEXTS);
    const dir = c.c < 0 ? 'decreasing' : 'increasing';
    const ac = Math.abs(c.c);
    const prompt = R`$${c.F}(${c.v})$ measures ${c.what} in ${c.fu}, where $${c.v}$ is ${c.vdesc}. What does $${c.F}'(${c.a}) = ${c.c}$ mean?`;
    return mc('interpretation', prompt,
      `When ${c.v} = ${c.a} ${c.vu}s, ${c.what} is ${dir} at a rate of ${ac} ${c.fu} per ${c.vu}.`,
      [`When ${c.v} = ${c.a} ${c.vu}s, ${c.what} is ${ac} ${c.fu}.`,
       `When ${c.v} = ${c.a} ${c.vu}s, ${c.what} is ${dir} at a rate of ${ac} ${c.vu}s per ${c.fu.replace(/s$/, '')}.`,
       `Over the first ${c.a} ${c.vu}s, ${c.what} changed by ${c.c} ${c.fu} on average.`],
      R`$${c.F}'(a)$ is an instantaneous rate with units <b>${c.fu} per ${c.vu}</b>. The sentence must name the input value with units, the direction (${dir}), and the rate with units. The sign tells the direction; the function value itself is not given.`,
      'Template: "When [input] = a [units], [quantity] is increasing/decreasing at a rate of |c| [output units] per [input unit]."');
  }
  function qUnits() {
    const c = pick(CONTEXTS);
    return mc('interpretation', R`$${c.F}(${c.v})$ is ${c.what} in ${c.fu}, and $${c.v}$ is ${c.vdesc}. What are the units of $${c.F}'(${c.v})$?`,
      `${c.fu} per ${c.vu}`, [`${c.vu}s per ${c.fu.replace(/s$/, '')}`, `${c.fu}`, `${c.fu} times ${c.vu}s`],
      R`The derivative is a limit of $\frac{\Delta ${c.F}}{\Delta ${c.v}}$, so its units are (units of $${c.F}$) per (unit of $${c.v}$): <b>${c.fu} per ${c.vu}</b>.`);
  }

  function qEstimateTable() {
    const h = pick([2, 4, 5, 10]);
    const t0 = pick([0, 1, 2, 5]);
    const n = 7;
    const t = Array.from({ length: n }, (_, i) => t0 + i * h);
    const dec = Math.random() < 0.5;
    const f = [ri(20, 40)];
    for (let i = 1; i < n; i++) f.push(f[i - 1] + (dec ? -1 : 1) * ri(1, 5));
    const i = ri(1, n - 2);
    const ans = (f[i + 1] - f[i - 1]) / (2 * h);
    const table = R`\begin{array}{c|${'c'.repeat(n)}} t & ${t.join(' & ')} \\ \hline f(t) & ${f.join(' & ')} \end{array}`;
    return num('estimating', R`Use the data to estimate $f'(${t[i]})$ with a central difference.<div class="qmath">$$${table}$$</div>`, ans, fracTex(f[i + 1] - f[i - 1], 2 * h),
      R`$f'(${t[i]}) \approx \dfrac{f(${t[i + 1]}) - f(${t[i - 1]})}{${t[i + 1]} - ${t[i - 1]}} = \dfrac{${f[i + 1]} - ${f[i - 1]}}{${2 * h}} = ${fracTex(f[i + 1] - f[i - 1], 2 * h)}$.`,
      'Central difference: use the neighbors on both sides and divide by their distance apart (2h).');
  }

  function qFBC() {
    const a = pick([10, 20, 50, 100, 1700]), h = pick([1, 2, 5, 10, 100]);
    const fa = ri(50, 200), fm = fa - ri(3, 25), fp = fa + ri(3, 25);
    const kind = pick(['forward', 'backward', 'central']);
    const ans = kind === 'forward' ? (fp - fa) / h : kind === 'backward' ? (fa - fm) / h : (fp - fm) / (2 * h);
    const formula = kind === 'forward' ? R`\dfrac{f(${a + h}) - f(${a})}{${h}} = \dfrac{${fp} - ${fa}}{${h}}` : kind === 'backward' ? R`\dfrac{f(${a}) - f(${a - h})}{${h}} = \dfrac{${fa} - ${fm}}{${h}}` : R`\dfrac{f(${a + h}) - f(${a - h})}{${2 * h}} = \dfrac{${fp} - ${fm}}{${2 * h}}`;
    return num('estimating', R`Suppose $f(${a - h}) = ${fm}$, $f(${a}) = ${fa}$, $f(${a + h}) = ${fp}$. Estimate $f'(${a})$ using the <b>${kind}</b> difference.`, ans, fmt(ans),
      R`${kind[0].toUpperCase() + kind.slice(1)} difference: $${formula} = ${fmt(ans)}$.`);
  }

  const SHAPES = [
    { fp: '>', fpp: '>', words: 'increasing and concave up (increasing at an increasing rate)' },
    { fp: '>', fpp: '<', words: 'increasing and concave down (increasing at a decreasing rate)' },
    { fp: '<', fpp: '>', words: 'decreasing and concave up (decreasing at a decreasing rate)' },
    { fp: '<', fpp: '<', words: 'decreasing and concave down (decreasing at an increasing rate)' }
  ];
  function qConcavitySigns() {
    const s = pick(SHAPES);
    if (Math.random() < 0.5) {
      return mc('second-derivative', R`On an interval, $f'(x) ${s.fp} 0$ and $f''(x) ${s.fpp} 0$. Which best describes $f$ there?`,
        s.words, SHAPES.filter(o => o !== s).map(o => o.words),
        R`$f' ${s.fp} 0$ means $f$ is ${s.fp === '>' ? 'increasing' : 'decreasing'}. $f'' ${s.fpp} 0$ means $f'$ is ${s.fpp === '>' ? 'increasing' : 'decreasing'}, so $f$ is concave ${s.fpp === '>' ? 'up' : 'down'}.`);
    }
    const sig = o => `$f'(x) ${o.fp} 0$ and $f''(x) ${o.fpp} 0$`;
    return mc('second-derivative', R`A function is described as "${s.words.split(' (')[1].replace(')', '')}". Which signs must hold?`,
      sig(s), SHAPES.filter(o => o !== s).map(sig),
      R`"${s.fp === '>' ? 'Increasing' : 'Decreasing'}" fixes the sign of $f'$. "At an ${s.fpp === '>' ? 'increasing' : 'decreasing'} rate" is about how the <em>rate</em> $f'$ is changing, which is the sign of $f''$. Note: "decreasing at a decreasing rate" means the drop is slowing, so $f''>0$.`);
  }

  const SD_CONTEXTS = [
    { text: R`A car's value satisfies $V(25000) = 23525$, $V'(25000) = -0.61$, $V''(25000) = 0.017$ (dollars, miles).`, correct: 'The value is decreasing, but the rate of decrease is slowing down.', wrong: ['The value is increasing by 0.017 dollars per mile.', 'The value is decreasing faster and faster.', 'The car is worth 0.61 dollars at 25,000 miles.'] },
    { text: R`A city's population satisfies $P(10) = 84$, $P'(10) = 2.1$, $P''(10) = -0.3$ (thousands, years).`, correct: 'The population is growing, but the growth is slowing.', wrong: ['The population is shrinking by 0.3 thousand per year.', 'The population is growing faster and faster.', 'The population is 2.1 thousand.'] },
    { text: R`A cooling cup of coffee satisfies $T(5) = 160$, $T'(5) = -4$, $T''(5) = 0.5$ (°F, minutes).`, correct: 'The coffee is cooling, but more and more slowly.', wrong: ['The coffee is warming at 0.5 °F per minute.', 'The coffee is cooling faster and faster.', 'The coffee is 4 °F below room temperature.'] },
    { text: R`A stock price satisfies $S(3) = 40$, $S'(3) = 2$, $S''(3) = 1.5$ (dollars, days).`, correct: 'The price is rising, and it is rising faster and faster.', wrong: ['The price is rising, but the rise is slowing.', 'The price is falling.', 'The price has risen 1.5 dollars in 3 days.'] },
    { text: R`A patient's fever satisfies $F(2) = 102$, $F'(2) = -0.8$, $F''(2) = -0.2$ (°F, hours).`, correct: 'The temperature is falling, and falling faster and faster.', wrong: ['The temperature is falling, but the fall is slowing.', 'The temperature is rising.', 'The temperature is 0.8 °F above normal.'] }
  ];
  function qSecondDerivContext() {
    const c = pick(SD_CONTEXTS);
    return mc('second-derivative', R`${c.text} Which statement is correct?`, c.correct, c.wrong,
      R`The sign of the first derivative gives the direction. The sign of the second derivative says whether that rate is increasing or decreasing: a positive second derivative makes a negative rate less negative (the decrease slows) and a positive rate larger (the increase speeds up).`,
      'First derivative sign: direction. Second derivative sign: is the rate itself growing or shrinking?');
  }

  function qDerivFunctionConcept() {
    const c = ri(-3, 4);
    const kind = ri(0, 2);
    if (kind === 0) return mc('derivative-function', R`$f$ is increasing on $(-\infty, ${c})$, has a local maximum at $x = ${c}$, and is decreasing on $(${c}, \infty)$. Which is true of $f'$?`,
      R`$f'(${c}) = 0$, $f' > 0$ for $x < ${c}$, and $f' < 0$ for $x > ${c}$`,
      [R`$f'(${c}) = 0$, $f' < 0$ for $x < ${c}$, and $f' > 0$ for $x > ${c}$`, R`$f'(${c})$ is a maximum value of $f'$`, R`$f' > 0$ everywhere`],
      R`Where $f$ rises, $f' > 0$; where $f$ falls, $f' < 0$; at a smooth peak the tangent is horizontal, so $f'(${c}) = 0$.`);
    if (kind === 1) return mc('derivative-function', R`The graph of $f$ has a sharp corner at $x = ${c}$ (like $|x - ${c}|$). What can you say about $f'(${c})$?`,
      R`$f'(${c})$ does not exist`, [R`$f'(${c}) = 0$`, R`$f'(${c}) = 1$`, R`$f'(${c}) = ${c}$`],
      R`At a corner the slopes from the left and right differ, so the limit defining $f'(${c})$ does not exist.`);
    return mc('derivative-function', R`The graph of $f'$ is below the $x$-axis on $(${c}, ${c + 3})$ and crosses it at $x = ${c + 3}$ going upward. What does $f$ do?`,
      R`$f$ decreases on $(${c}, ${c + 3})$ and has a local minimum at $x = ${c + 3}$`,
      [R`$f$ increases on $(${c}, ${c + 3})$ and has a local maximum at $x = ${c + 3}$`, R`$f$ is negative on $(${c}, ${c + 3})$`, R`$f$ has an inflection point at $x = ${c + 3}$`],
      R`$f' < 0$ means $f$ is decreasing. $f'$ changing from negative to positive at $x = ${c + 3}$ is the first derivative test for a local minimum.`);
  }

  /* ======================================================
     UNIT 2
     ====================================================== */
  function qPowerRulePoly() {
    const a = nz(-5, 5), n = ri(3, 6), b = nz(-6, 6), m = ri(1, 2), c = ri(-9, 9);
    const fx = poly([[a, n], [b, m], [c, 0]]);
    const correct = `$${poly([[a * n, n - 1], [b * m, m - 1]])}$`;
    return mc('basic-rules', R`Find $f'(x)$ for $f(x) = ${fx}$.`, correct,
      [`$${poly([[a * n, n], [b * m, m]])}$`, `$${poly([[a * n, n - 1], [b * m, m - 1], [c, 0]])}$`, `$${poly([[a, n - 1], [b, m - 1]])}$`],
      R`Power rule term by term: $\frac{d}{dx}[${term(a, n, true)}] = ${term(a * n, n - 1, true)}$, $\frac{d}{dx}[${term(b, m, true)}] = ${term(b * m, m - 1, true)}$, and the constant's derivative is $0$.`);
  }
  function qPowerRuleRoots() {
    const a = ri(2, 9), b = ri(2, 9);
    const kind = ri(0, 2);
    if (kind === 0) return mc('basic-rules', R`Find $f'(x)$ for $f(x) = ${a}\sqrt{x} + \dfrac{${b}}{x}$.`,
      R`$\dfrac{${a}}{2\sqrt{x}} - \dfrac{${b}}{x^2}$`, [R`$\dfrac{${a}}{2\sqrt{x}} + \dfrac{${b}}{x^2}$`, R`$${a}\sqrt{x} - \dfrac{${b}}{x^2}$`, R`$\dfrac{${a}}{\sqrt{x}} - \dfrac{${b}}{x}$`],
      R`Rewrite: $${a}x^{1/2} + ${b}x^{-1}$. Then $\frac{${a}}{2}x^{-1/2} - ${b}x^{-2} = \dfrac{${a}}{2\sqrt x} - \dfrac{${b}}{x^2}$.`, 'Rewrite roots and reciprocals as powers first.');
    if (kind === 1) return mc('basic-rules', R`Find $g'(x)$ for $g(x) = \dfrac{${a}}{x^{${b > 5 ? 3 : 2}}}$.`,
      b > 5 ? R`$-\dfrac{${3 * a}}{x^{4}}$` : R`$-\dfrac{${2 * a}}{x^{3}}$`,
      b > 5 ? [R`$\dfrac{${3 * a}}{x^{4}}$`, R`$-\dfrac{${a}}{x^{2}}$`, R`$-\dfrac{${3 * a}}{x^{2}}$`] : [R`$\dfrac{${2 * a}}{x^{3}}$`, R`$-\dfrac{${a}}{x}$`, R`$-\dfrac{${2 * a}}{x}$`],
      R`$${a}x^{-${b > 5 ? 3 : 2}}$ has derivative $${-a * (b > 5 ? 3 : 2)}x^{-${b > 5 ? 4 : 3}}$.`);
    return mc('basic-rules', R`Find $h'(x)$ for $h(x) = ${a}x^{2/3}$.`,
      R`$\dfrac{${2 * a}}{3}x^{-1/3}$`, [R`$\dfrac{${2 * a}}{3}x^{1/3}$`, R`$${a}x^{-1/3}$`, R`$\dfrac{2}{3}x^{-1/3}$`],
      R`Power rule with $n = \frac23$: $${a}\cdot\frac23 x^{2/3 - 1} = \frac{${2 * a}}{3}x^{-1/3}$.`);
  }
  function qExpRule() {
    const a = nz(-5, 5), b = nz(-5, 5), n = ri(2, 4);
    if (Math.random() < 0.5) return mc('basic-rules', R`Find $f'(x)$ for $f(x) = ${term(a, 0, true)}e^x ${signed(b)}x^{${n}}$.`,
      R`$${term(a, 0, true)}e^x ${signed(b * n)}x^{${n - 1}}$`, [R`$${term(a, 0, true)}e^{x-1} ${signed(b * n)}x^{${n - 1}}$`, R`$${term(a, 0, true)}xe^{x-1} ${signed(b * n)}x^{${n - 1}}$`, R`$${term(a, 0, true)}e^x ${signed(b)}x^{${n - 1}}$`],
      R`$e^x$ is its own derivative, and the power rule handles $x^{${n}}$.`);
    const base = pick([2, 3, 5, 10]);
    return mc('basic-rules', R`Find $g'(x)$ for $g(x) = ${Math.abs(a)}\cdot ${base}^x$.`,
      R`$${Math.abs(a)}\cdot ${base}^x \ln ${base}$`, [R`$${Math.abs(a)}x\cdot ${base}^{x-1}$`, R`$${Math.abs(a)}\cdot ${base}^x$`, R`$${Math.abs(a)}\cdot ${base}^{x}\ln x$`],
      R`$\frac{d}{dx}[a^x] = a^x\ln a$. The exponent is the variable, so the power rule does not apply.`);
  }
  function qTrigEval() {
    const a = nz(-5, 5), b = nz(-5, 5);
    const pts = [
      { x: '0', fp: a, tex: R`f'(0) = ${a}\cos 0 - (${b})\sin 0` },
      { x: R`\pi/2`, fp: -b, tex: R`f'(\pi/2) = ${a}\cos\frac{\pi}{2} - (${b})\sin\frac{\pi}{2}` },
      { x: R`\pi`, fp: -a, tex: R`f'(\pi) = ${a}\cos\pi - (${b})\sin\pi` }
    ];
    const p = pick(pts);
    return num('trig', R`Let $f(x) = ${term(a, 0, true)}\sin x ${signed(b)}\cos x$. Find $f'(${p.x})$.`, p.fp, `${p.fp}`,
      R`$f'(x) = ${term(a, 0, true)}\cos x ${signed(-b)}\sin x$. Then $${p.tex} = ${p.fp}$.`,
      R`$\frac{d}{dx}[\sin x] = \cos x$, $\frac{d}{dx}[\cos x] = -\sin x$.`);
  }
  function qProductRule() {
    const n = ri(2, 4);
    const kind = ri(0, 2);
    if (kind === 0) return mc('product-quotient', R`Differentiate $f(x) = x^{${n}}e^x$.`,
      R`$${n}x^{${n - 1}}e^x + x^{${n}}e^x$`, [R`$${n}x^{${n - 1}}e^x$`, R`$${n}x^{${n - 1}}e^{x-1}$`, R`$x^{${n}}e^x$`],
      R`Product rule: $(x^{${n}})'e^x + x^{${n}}(e^x)' = ${n}x^{${n - 1}}e^x + x^{${n}}e^x$.`);
    if (kind === 1) return mc('product-quotient', R`Differentiate $g(x) = x^{${n}}\sin x$.`,
      R`$${n}x^{${n - 1}}\sin x + x^{${n}}\cos x$`, [R`$${n}x^{${n - 1}}\cos x$`, R`$${n}x^{${n - 1}}\sin x - x^{${n}}\cos x$`, R`$x^{${n}}\cos x$`],
      R`Product rule: $${n}x^{${n - 1}}\sin x + x^{${n}}\cos x$.`);
    return mc('product-quotient', R`Differentiate $h(x) = e^x\cos x$.`,
      R`$e^x\cos x - e^x\sin x$`, [R`$-e^x\sin x$`, R`$e^x\cos x + e^x\sin x$`, R`$e^x\sin x$`],
      R`Product rule: $(e^x)'\cos x + e^x(\cos x)' = e^x\cos x - e^x\sin x$.`);
  }
  function qQuotientRule() {
    const a = nz(-4, 4), b = nz(-5, 5), c = nz(-3, 3), d = nz(-5, 5);
    const N = lin(a, b), D = lin(c, d);
    const k = a * d - b * c;
    if (k === 0) return qQuotientRule();
    if (Math.random() < 0.5) return mc('product-quotient', R`Differentiate $f(x) = \dfrac{${N}}{${D}}$.`,
      R`$\dfrac{${k}}{(${D})^2}$`, [R`$\dfrac{${-k}}{(${D})^2}$`, R`$\dfrac{${a}}{${c}}$`, R`$\dfrac{${a * d + b * c}}{(${D})^2}$`],
      R`Quotient rule: $\dfrac{(${a})(${D}) - (${N})(${c})}{(${D})^2} = \dfrac{${a * d} - (${b * c})}{(${D})^2} = \dfrac{${k}}{(${D})^2}$.`,
      '"Low d-high minus high d-low, over low squared."');
    const ans = k / (d * d);
    return num('product-quotient', R`Let $f(x) = \dfrac{${N}}{${D}}$. Find $f'(0)$.`, ans, fracTex(k, d * d),
      R`$f'(x) = \dfrac{${k}}{(${D})^2}$, so $f'(0) = \dfrac{${k}}{(${d})^2} = ${fracTex(k, d * d)}$.`);
  }
  function qChainPower() {
    const a = ri(1, 4), b = nz(-6, 6), n = ri(3, 6);
    const inner = poly([[a, 2], [b, 0]]);
    return mc('chain-rule', R`Differentiate $f(x) = (${inner})^{${n}}$.`,
      R`$${2 * a * n}x(${inner})^{${n - 1}}$`, [R`$${n}(${inner})^{${n - 1}}$`, R`$${n}(${2 * a}x)^{${n - 1}}$`, R`$${2 * a * n}x(${inner})^{${n}}$`],
      R`Outside: $u^{${n}}$ with derivative $${n}u^{${n - 1}}$. Inside: $u = ${inner}$ with $u' = ${2 * a}x$. Chain rule: $${n}(${inner})^{${n - 1}}\cdot ${2 * a}x$.`);
  }
  function qChainTrigExp() {
    const a = ri(2, 6), b = ri(2, 3);
    const items = [
      { f: R`\sin(${a}x^{${b}})`, ok: R`${a * b}x^{${b - 1}}\cos(${a}x^{${b}})`, bad: [R`\cos(${a * b}x^{${b - 1}})`, R`${a}\cos(x^{${b}})`, R`${a * b}x^{${b - 1}}\sin(${a}x^{${b}})`] },
      { f: R`e^{${a}x}`, ok: R`${a}e^{${a}x}`, bad: [R`e^{${a}x}`, R`${a}xe^{${a}x - 1}`, R`e^{${a}}`] },
      { f: R`\cos(${a}x)`, ok: R`-${a}\sin(${a}x)`, bad: [R`${a}\sin(${a}x)`, R`-\sin(${a}x)`, R`-${a}\cos(${a}x)`] },
      { f: R`e^{x^{${b}}}`, ok: R`${b}x^{${b - 1}}e^{x^{${b}}}`, bad: [R`e^{x^{${b}}}`, R`x^{${b}}e^{x^{${b}} - 1}`, R`${b}x^{${b - 1}}e^{${b}x^{${b - 1}}}`] },
      { f: R`\sqrt{${a}x + 1}`, ok: R`\dfrac{${a}}{2\sqrt{${a}x+1}}`, bad: [R`\dfrac{1}{2\sqrt{${a}x+1}}`, R`${a}\sqrt{${a}x+1}`, R`\dfrac{${a}}{\sqrt{${a}x+1}}`] },
      { f: R`\tan(${a}x)`, ok: R`${a}\sec^2(${a}x)`, bad: [R`\sec^2(${a}x)`, R`${a}\sec(${a}x)`, R`${a}\sec^2(x)`] },
      { f: R`\sin^{${b}}(x)`, ok: R`${b}\sin^{${b - 1}}(x)\cos x`, bad: [R`${b}\sin^{${b - 1}}(x)`, R`\cos^{${b}}(x)`, R`${b}\cos^{${b - 1}}(x)`] }
    ];
    const it = pick(items);
    return mc('chain-rule', R`Differentiate $f(x) = ${it.f}$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
      R`Chain rule: differentiate the outside function, keep the inside unchanged, then multiply by the derivative of the inside. Result: $${it.ok}$.`,
      'Identify the inside function first; its derivative must appear as a factor.');
  }
  function qChainNumeric() {
    const a = ri(2, 5), b = ri(1, 3), n = ri(2, 3);
    const items = [
      { f: R`e^{${a}x}`, p: 0, ans: a, why: R`f'(x) = ${a}e^{${a}x}, so f'(0) = ${a}` },
      { f: R`\sin(${a}x)`, p: 0, ans: a, why: R`f'(x) = ${a}\cos(${a}x), so f'(0) = ${a}` },
      { f: R`(${a}x + ${b})^{${n}}`, p: 0, ans: n * a * Math.pow(b, n - 1), why: R`f'(x) = ${n}(${a}x+${b})^{${n - 1}}\cdot${a}, so f'(0) = ${n}\cdot${a}\cdot${b}^{${n - 1}} = ${n * a * Math.pow(b, n - 1)}` },
      { f: R`\cos(${a}x)`, p: 0, ans: 0, why: R`f'(x) = -${a}\sin(${a}x), so f'(0) = 0` },
      { f: R`\sqrt{${a}x + ${b * b}}`, p: 0, ans: a / (2 * b), why: R`f'(x) = \dfrac{${a}}{2\sqrt{${a}x+${b * b}}}, so f'(0) = \dfrac{${a}}{${2 * b}}` },
      { f: R`e^{x^2}`, p: 1, ans: 2 * Math.E, why: R`f'(x) = 2xe^{x^2}, so f'(1) = 2e \approx 5.4366` }
    ];
    const it = pick(items);
    return num('chain-rule', R`Let $f(x) = ${it.f}$. Find $f'(${it.p})$.`, it.ans, fmt(it.ans), R`$${it.why}$.`);
  }
  function qOtherTrig() {
    const a = ri(2, 7);
    const items = [
      { f: R`${a}\tan x`, ok: R`${a}\sec^2 x`, bad: [R`${a}\sec x`, R`${a}\sec x\tan x`, R`-${a}\csc^2 x`] },
      { f: R`${a}\sec x`, ok: R`${a}\sec x\tan x`, bad: [R`${a}\sec^2 x`, R`-${a}\csc x\cot x`, R`${a}\tan x`] },
      { f: R`${a}\cot x`, ok: R`-${a}\csc^2 x`, bad: [R`${a}\csc^2 x`, R`-${a}\sec^2 x`, R`-${a}\csc x\cot x`] },
      { f: R`${a}\csc x`, ok: R`-${a}\csc x\cot x`, bad: [R`${a}\csc x\cot x`, R`-${a}\csc^2 x`, R`${a}\sec x\tan x`] },
      { f: R`x\sec x`, ok: R`\sec x + x\sec x\tan x`, bad: [R`\sec x\tan x`, R`\sec x + x\sec^2 x`, R`x\sec x\tan x`] }
    ];
    const it = pick(items);
    return mc('trig', R`Differentiate $f(x) = ${it.f}$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
      R`$\frac{d}{dx}\tan x = \sec^2x$, $\frac{d}{dx}\sec x = \sec x\tan x$, $\frac{d}{dx}\cot x = -\csc^2x$, $\frac{d}{dx}\csc x = -\csc x\cot x$. Result: $${it.ok}$.`);
  }
  function qLnLog() {
    const a = ri(2, 7), n = ri(2, 3), c = ri(1, 5), base = pick([2, 3, 10]);
    const items = [
      { f: R`${a}\ln x`, ok: R`\dfrac{${a}}{x}`, bad: [R`\dfrac{1}{${a}x}`, R`${a}\ln x`, R`\dfrac{${a}}{x\ln ${a}}`] },
      { f: R`\ln(x^{${n}} + ${c})`, ok: R`\dfrac{${n}x^{${n - 1}}}{x^{${n}}+${c}}`, bad: [R`\dfrac{1}{x^{${n}}+${c}}`, R`\dfrac{1}{${n}x^{${n - 1}}}`, R`${n}x^{${n - 1}}\ln(x^{${n}}+${c})`] },
      { f: R`\log_{${base}} x`, ok: R`\dfrac{1}{x\ln ${base}}`, bad: [R`\dfrac{1}{x}`, R`\dfrac{\ln ${base}}{x}`, R`\dfrac{${base}}{x}`] },
      { f: R`\arctan(${a}x)`, ok: R`\dfrac{${a}}{1 + ${a * a}x^2}`, bad: [R`\dfrac{1}{1+${a}x^2}`, R`\dfrac{${a}}{1+${a}x^2}`, R`\dfrac{${a}}{\sqrt{1-${a * a}x^2}}`] },
      { f: R`\arcsin x + ${a}x`, ok: R`\dfrac{1}{\sqrt{1-x^2}} + ${a}`, bad: [R`\dfrac{1}{1+x^2} + ${a}`, R`-\dfrac{1}{\sqrt{1-x^2}} + ${a}`, R`\dfrac{1}{\sqrt{1-x^2}}`] },
      { f: R`x\ln x`, ok: R`\ln x + 1`, bad: [R`\dfrac{1}{x}`, R`\ln x`, R`1`] },
      { f: R`\ln(\cos x)`, ok: R`-\tan x`, bad: [R`\dfrac{1}{\cos x}`, R`\tan x`, R`-\dfrac{1}{\sin x}`] }
    ];
    const it = pick(items);
    return mc('inverse-functions', R`Differentiate $f(x) = ${it.f}$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
      R`$\frac{d}{dx}\ln u = \frac{u'}{u}$, $\frac{d}{dx}\log_b x = \frac{1}{x\ln b}$, $\frac{d}{dx}\arctan u = \frac{u'}{1+u^2}$, $\frac{d}{dx}\arcsin x = \frac{1}{\sqrt{1-x^2}}$. Result: $${it.ok}$.`);
  }
  function qLnNumeric() {
    const a = ri(2, 9), p = ri(1, 4);
    if (Math.random() < 0.5) return num('inverse-functions', R`Let $f(x) = ${a}\ln x$. Find $f'(${p})$.`, a / p, fracTex(a, p), R`$f'(x) = \dfrac{${a}}{x}$, so $f'(${p}) = ${fracTex(a, p)}$.`);
    return num('inverse-functions', R`Let $g(x) = \ln(x^2 + 1)$. Find $g'(${p})$.`, 2 * p / (p * p + 1), fracTex(2 * p, p * p + 1), R`$g'(x) = \dfrac{2x}{x^2+1}$, so $g'(${p}) = \dfrac{${2 * p}}{${p * p + 1}} = ${fracTex(2 * p, p * p + 1)}$.`);
  }
  function qInverseFn() {
    const a = ri(1, 6), b = ri(1, 9), k = nz(-6, 6);
    return num('inverse-functions', R`Suppose $f(${a}) = ${b}$ and $f'(${a}) = ${k}$, and $f$ has an inverse. Find $(f^{-1})'(${b})$.`, 1 / k, fracTex(1, k),
      R`$(f^{-1})'(${b}) = \dfrac{1}{f'(f^{-1}(${b}))} = \dfrac{1}{f'(${a})} = ${fracTex(1, k)}$.`,
      R`Evaluate $f'$ at $f^{-1}(${b}) = ${a}$, not at ${b}.`);
  }
  function qTangentLineEq() {
    const kind = ri(0, 1);
    if (kind === 0) {
      const a = nz(-3, 3), b = ri(-5, 5), c = ri(-6, 6), p = ri(-2, 3);
      const fx = poly([[a, 2], [b, 1], [c, 0]]);
      const fp = a * p * p + b * p + c, m = 2 * a * p + b, k = fp - m * p;
      return mc('tangent-line', R`Find the equation of the tangent line to $f(x) = ${fx}$ at $x = ${p}$.`,
        `$y = ${lin(m, k)}$`, [`$y = ${lin(m, fp)}$`, `$y = ${lin(2 * a * p + b, -k)}$`, `$y = ${lin(m === 0 ? 1 : m + a, k)}$`],
        R`$f(${p}) = ${fp}$ and $f'(x) = ${poly([[2 * a, 1], [b, 0]])}$, so $f'(${p}) = ${m}$. Tangent line: $y = ${fp} + ${m}(x - (${p})) = ${lin(m, k)}$.`,
        R`$y = f(a) + f'(a)(x-a)$.`);
    }
    const items = [
      { f: 'e^x', p: 0, line: 'x + 1', bad: ['x', 'ex + 1', 'x - 1'] },
      { f: R`\ln x`, p: 1, line: 'x - 1', bad: ['x', 'x + 1', R`\tfrac1x x - 1`] },
      { f: R`\sin x`, p: 0, line: 'x', bad: ['1', '-x', 'x + 1'] },
      { f: R`\cos x`, p: 0, line: '1', bad: ['x', '-x + 1', 'x + 1'] },
      { f: R`\sqrt{x}`, p: 4, line: R`\tfrac14 x + 1`, bad: [R`\tfrac14 x + 2`, R`\tfrac12 x`, R`4x + 2`] }
    ];
    const it = pick(items);
    return mc('tangent-line', R`Find the tangent line to $f(x) = ${it.f}$ at $x = ${it.p}$.`, `$y = ${it.line}$`, it.bad.map(s => `$y = ${s}$`),
      R`Compute $f(${it.p})$ and $f'(${it.p})$, then $y = f(${it.p}) + f'(${it.p})(x - ${it.p}) = ${it.line}$.`);
  }
  function qLinearization() {
    const a = ri(1, 9), fa = ri(2, 30), fpa = pick([0.5, 1.5, 2, -1, -2.5, 3, 0.25]);
    const h = pick([0.1, 0.2, 0.5, 0.4]);
    const est = fa + fpa * h;
    if (Math.random() < 0.5) return num('tangent-line', R`Given $f(${a}) = ${fa}$ and $f'(${a}) = ${fpa}$, use the tangent line to estimate $f(${fmt(a + h)})$.`, est, fmt(est),
      R`$L(x) = ${fa} + ${fpa}(x - ${a})$, so $f(${fmt(a + h)}) \approx ${fa} + ${fpa}(${h}) = ${fmt(est)}$.`);
    const up = Math.random() < 0.5;
    return mc('tangent-line', R`$f(${a}) = ${fa}$, $f'(${a}) = ${fpa}$, and $f''(x) ${up ? '>' : '<'} 0$ for all $x$. The tangent-line estimate $f(${fmt(a + h)}) \approx ${fmt(est)}$ is:`,
      up ? 'an underestimate, because the graph is concave up and lies above its tangent line' : 'an overestimate, because the graph is concave down and lies below its tangent line',
      [up ? 'an overestimate, because the graph is concave up' : 'an underestimate, because the graph is concave down', 'exact, because f is differentiable', "impossible to judge without f''(a) itself"],
      R`Concave ${up ? 'up' : 'down'} graphs lie ${up ? 'above' : 'below'} their tangent lines, so the linear estimate is ${up ? 'too small' : 'too large'}.`);
  }
  function qContinuityK() {
    const c = ri(-2, 3), m = nz(-3, 3), n = ri(-5, 5);
    const k = m * c + n - c * c;
    return num('continuity', R`Find the value of $k$ that makes $f(x) = \begin{cases} x^2 + k & x < ${c} \\ ${lin(m, n)} & x \ge ${c} \end{cases}$ continuous at $x = ${c}$.`, k, `${k}`,
      R`Left limit: $${c * c} + k$. Right limit (and $f(${c})$): $${m}(${c}) ${signed(n)} = ${m * c + n}$. Continuity needs $${c * c} + k = ${m * c + n}$, so $k = ${k}$.`,
      'Set the two one-sided limits equal.');
  }
  const CD_STATEMENTS = [
    { t: 'If f is differentiable at a, then f is continuous at a.', ok: true },
    { t: 'If f is continuous at a, then f is differentiable at a.', ok: false },
    { t: 'f(x) = |x| is continuous but not differentiable at x = 0.', ok: true },
    { t: 'A function with a jump discontinuity at a can still be differentiable at a.', ok: false },
    { t: 'If the limit of f as x → a exists, then f is continuous at a.', ok: false },
    { t: 'A function can be continuous at a point where its graph has a sharp corner.', ok: true },
    { t: 'If f is not continuous at a, then f is not differentiable at a.', ok: true },
    { t: 'A vertical tangent line at a means f′(a) = 0.', ok: false },
    { t: 'Polynomials are continuous and differentiable everywhere.', ok: true }
  ];
  function qContDiffConcept() {
    const trues = shuffle(CD_STATEMENTS.filter(s => s.ok)), falses = shuffle(CD_STATEMENTS.filter(s => !s.ok));
    return mc('continuity', 'Which statement is TRUE?', trues[0].t, falses.slice(0, 3).map(s => s.t),
      'Differentiable implies continuous, never the reverse. Corners, cusps, vertical tangents and discontinuities all break differentiability; a corner or cusp does not break continuity.');
  }
  function qAbsNonDiff() {
    const a = ri(1, 4), b = ri(-8, 8);
    const inner = lin(a, b);
    return num('continuity', R`$f(x) = |${inner}|$ is continuous everywhere but fails to be differentiable at one point. Find that $x$-value.`, -b / a, fracTex(-b, a),
      R`The corner is where the inside is zero: $${inner} = 0 \Rightarrow x = ${fracTex(-b, a)}$.`);
  }

  /* ======================================================
     UNIT 3
     ====================================================== */
  function qImplicit() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const tr = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]);
      const sx = pick([1, -1]), sy = pick([1, -1]);
      const x0 = sx * tr[0], y0 = sy * tr[1], r2 = tr[2] * tr[2];
      return num('implicit', R`Find $\dfrac{dy}{dx}$ for the circle $x^2 + y^2 = ${r2}$ at the point $(${x0}, ${y0})$.`, -x0 / y0, fracTex(-x0, y0),
        R`$2x + 2y\,y' = 0 \Rightarrow y' = -\dfrac{x}{y}$. At $(${x0},${y0})$: $y' = ${fracTex(-x0, y0)}$.`, 'Differentiate both sides; every y-term picks up a dy/dx.');
    }
    if (kind === 1) {
      const x0 = ri(1, 3), y0 = ri(1, 3);
      const c = x0 ** 3 + y0 ** 3;
      return num('implicit', R`Find the slope of $x^3 + y^3 = ${c}$ at $(${x0}, ${y0})$.`, -(x0 * x0) / (y0 * y0), fracTex(-x0 * x0, y0 * y0),
        R`$3x^2 + 3y^2 y' = 0 \Rightarrow y' = -\dfrac{x^2}{y^2} = ${fracTex(-x0 * x0, y0 * y0)}$.`);
    }
    if (kind === 2) {
      const x0 = nz(-4, 4), y0 = nz(-4, 4);
      return num('implicit', R`Find $\dfrac{dy}{dx}$ for $xy = ${x0 * y0}$ at $(${x0}, ${y0})$.`, -y0 / x0, fracTex(-y0, x0),
        R`Product rule: $y + x\,y' = 0 \Rightarrow y' = -\dfrac{y}{x} = ${fracTex(-y0, x0)}$.`);
    }
    const x0 = ri(1, 3), y0 = ri(1, 3);
    const c = x0 * x0 + x0 * y0 + y0 * y0;
    const n = -(2 * x0 + y0), d = x0 + 2 * y0;
    return num('implicit', R`Find $\dfrac{dy}{dx}$ for $x^2 + xy + y^2 = ${c}$ at $(${x0}, ${y0})$.`, n / d, fracTex(n, d),
      R`$2x + (y + x y') + 2y y' = 0 \Rightarrow y'(x + 2y) = -(2x + y) \Rightarrow y' = -\dfrac{2x+y}{x+2y} = ${fracTex(n, d)}$.`);
  }
  function qRelatedRates() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const k = ri(1, 4), r = ri(2, 8);
      return mc('related-rates', R`The radius of a circle grows at $${k}$ cm/s. How fast is the area increasing when the radius is $${r}$ cm?`,
        `$${2 * r * k}\pi$ cm²/s`, [`$${r * k}\pi$ cm²/s`, `$${r * r * k}\pi$ cm²/s`, `$${2 * k}\pi$ cm²/s`],
        R`$A = \pi r^2 \Rightarrow \dfrac{dA}{dt} = 2\pi r\dfrac{dr}{dt} = 2\pi(${r})(${k}) = ${2 * r * k}\pi$ cm²/s.`, 'Differentiate A = πr² with respect to t before substituting r.');
    }
    if (kind === 1) {
      const tr = pick([[6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [3, 4, 5], [9, 12, 15]]);
      const k = ri(1, 4);
      const ans = -tr[0] * k / tr[1];
      return num('related-rates', R`A $${tr[2]}$ ft ladder leans against a wall. Its base slides away from the wall at $${k}$ ft/s. How fast (ft/s, signed) is the top moving when the base is $${tr[0]}$ ft from the wall?`, ans, fracTex(-tr[0] * k, tr[1]),
        R`$x^2 + y^2 = ${tr[2] ** 2} \Rightarrow 2x x' + 2y y' = 0$. When $x = ${tr[0]}$, $y = ${tr[1]}$: $${tr[0]}(${k}) + ${tr[1]}y' = 0 \Rightarrow y' = ${fracTex(-tr[0] * k, tr[1])}$ ft/s (negative: sliding down).`);
    }
    if (kind === 2) {
      const k = ri(1, 3), r = ri(1, 5);
      return mc('related-rates', R`A spherical balloon's radius increases at $${k}$ cm/s. How fast is the volume increasing when $r = ${r}$ cm?`,
        `$${4 * r * r * k}\pi$ cm³/s`, [`$${4 * r * k}\pi$ cm³/s`, `$\\tfrac43(${r ** 3})\pi$ cm³/s`, `$${r * r * k}\pi$ cm³/s`],
        R`$V = \tfrac43\pi r^3 \Rightarrow \dfrac{dV}{dt} = 4\pi r^2\dfrac{dr}{dt} = 4\pi(${r})^2(${k}) = ${4 * r * r * k}\pi$ cm³/s.`);
    }
    const x = ri(3, 10), y = ri(3, 10), xp = ri(1, 4), yp = nz(-4, 4);
    const ans = xp * y + x * yp;
    return num('related-rates', R`A rectangle's length $x$ grows at $${xp}$ cm/s and its width $y$ changes at $${yp}$ cm/s. How fast is the area changing when $x = ${x}$ cm and $y = ${y}$ cm? (cm²/s)`, ans, `${ans}`,
      R`$A = xy \Rightarrow A' = x'y + xy' = (${xp})(${y}) + (${x})(${yp}) = ${ans}$ cm²/s.`);
  }
  function qLHopital() {
    const k = ri(2, 9), a = ri(2, 7), b = ri(2, 7);
    const items = [
      { e: R`\lim_{x\to0}\frac{\sin(${k}x)}{x}`, ans: k, tex: `${k}`, why: R`\frac00 \to \lim \frac{${k}\cos(${k}x)}{1} = ${k}` },
      { e: R`\lim_{x\to0}\frac{e^{${k}x}-1}{x}`, ans: k, tex: `${k}`, why: R`\frac00 \to \lim \frac{${k}e^{${k}x}}{1} = ${k}` },
      { e: R`\lim_{x\to1}\frac{\ln x}{x-1}`, ans: 1, tex: '1', why: R`\frac00 \to \lim \frac{1/x}{1} = 1` },
      { e: R`\lim_{x\to0}\frac{1-\cos x}{x^2}`, ans: 0.5, tex: R`\frac12`, why: R`\frac00 \to \lim\frac{\sin x}{2x} \to \lim\frac{\cos x}{2} = \frac12` },
      { e: R`\lim_{x\to\infty}\frac{x}{e^x}`, ans: 0, tex: '0', why: R`\frac\infty\infty \to \lim \frac{1}{e^x} = 0` },
      { e: R`\lim_{x\to\infty}\frac{\ln x}{x}`, ans: 0, tex: '0', why: R`\frac\infty\infty \to \lim \frac{1/x}{1} = 0` },
      { e: R`\lim_{x\to0}\frac{\sin(${a}x)}{\sin(${b}x)}`, ans: a / b, tex: fracTex(a, b), why: R`\frac00 \to \lim\frac{${a}\cos(${a}x)}{${b}\cos(${b}x)} = ${fracTex(a, b)}` },
      { e: R`\lim_{x\to0}\frac{\tan(${k}x)}{x}`, ans: k, tex: `${k}`, why: R`\frac00 \to \lim \frac{${k}\sec^2(${k}x)}{1} = ${k}` },
      { e: R`\lim_{x\to\infty}\frac{x^2}{e^x}`, ans: 0, tex: '0', why: R`\frac\infty\infty \text{ twice} \to \lim\frac{2}{e^x} = 0` },
      { e: R`\lim_{x\to0}\frac{x}{e^x - 1}`, ans: 1, tex: '1', why: R`\frac00 \to \lim\frac{1}{e^x} = 1` }
    ];
    const it = pick(items);
    return num('lhopital', R`Evaluate $\displaystyle ${it.e}$.`, it.ans, it.tex, R`Form $${it.why}$.`, "Check the form first: L'Hôpital only applies to 0/0 or ∞/∞.");
  }
  function qLimitsInfinity() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const a = nz(-6, 6), b = nz(1, 6), c = ri(-5, 5), d = ri(-5, 5);
      const nP = poly([[a, 2], [c, 1], [ri(-9, 9), 0]]), dP = poly([[b, 2], [d, 1], [ri(-9, 9), 0]]);
      return num('limits-infinity', R`Evaluate $\displaystyle\lim_{x\to\infty}\frac{${nP}}{${dP}}$.`, a / b, fracTex(a, b),
        R`Equal degrees: divide numerator and denominator by $x^2$ (or compare dominating terms $${a}x^2$ and $${b}x^2$). The limit is the ratio of leading coefficients, $${fracTex(a, b)}$.`);
    }
    if (kind === 1) {
      const a = nz(-6, 6), b = nz(1, 6);
      const nP = poly([[a, 1], [ri(-9, 9), 0]]), dP = poly([[b, 2], [ri(-9, 9), 0]]);
      return num('limits-infinity', R`Evaluate $\displaystyle\lim_{x\to\infty}\frac{${nP}}{${dP}}$.`, 0, '0',
        R`The denominator's degree is higher, so the fraction shrinks to $0$: the dominating term $${b}x^2$ grows much faster than $${a}x$.`);
    }
    if (kind === 2) {
      const a = nz(-4, 4), b = nz(1, 4);
      const nP = poly([[a, 3], [ri(-9, 9), 1]]), dP = poly([[b, 2], [ri(1, 9), 0]]);
      const sign = a / b > 0 ? '+' : '-';
      return mc('limits-infinity', R`Evaluate $\displaystyle\lim_{x\to\infty}\frac{${nP}}{${dP}}$.`,
        sign === '+' ? R`$+\infty$ (does not exist)` : R`$-\infty$ (does not exist)`,
        [sign === '+' ? R`$-\infty$ (does not exist)` : R`$+\infty$ (does not exist)`, `$${fracTex(a, b)}$`, '$0$'],
        R`The numerator's degree is higher, so the quotient behaves like $\dfrac{${a}x^3}{${b}x^2} = ${fracTex(a, b)}x \to ${sign}\infty$.`);
    }
    const a = ri(2, 9), b = ri(1, 5);
    const items = [
      { e: R`\lim_{x\to\infty}\frac{${a}e^x + x^{5}}{${b}e^x + 1}`, ans: a / b, tex: fracTex(a, b), why: R`e^x dominates x^5 and 1, so the limit is ${fracTex(a, b)}` },
      { e: R`\lim_{x\to\infty}\frac{x^{${a}}}{e^x}`, ans: 0, tex: '0', why: R`e^x dominates any power of x` },
      { e: R`\lim_{x\to\infty}\frac{\ln x}{x^{${b}}}`, ans: 0, tex: '0', why: R`any positive power of x dominates \ln x` },
      { e: R`\lim_{x\to\infty}\frac{${a}x^2 + \ln x}{x^2}`, ans: a, tex: `${a}`, why: R`x^2 dominates \ln x` }
    ];
    const it = pick(items);
    return num('limits-infinity', R`Evaluate $\displaystyle ${it.e}$.`, it.ans, it.tex, R`Dominating terms: $${it.why}$.`, 'ln x ≪ powers of x ≪ eˣ as x → ∞.');
  }
  function qExtrema() {
    const kind = ri(0, 4);
    if (kind === 0) {
      const a = ri(-3, 2), b = a + ri(1, 4);
      const fx = poly([[2, 3], [-3 * (a + b), 2], [6 * a * b, 1]]);
      return num('extrema', R`Find the <b>larger</b> critical number of $f(x) = ${fx}$.`, b, `${b}`,
        R`$f'(x) = ${poly([[6, 2], [-6 * (a + b), 1], [6 * a * b, 0]])} = 6(${lin(1, -a)})(${lin(1, -b)})$, so the critical numbers are $${a}$ and $${b}$.`);
    }
    if (kind === 1) {
      const a = ri(-3, 2), b = a + ri(1, 4);
      return mc('extrema', R`Suppose $f'(x) = (${lin(1, -a)})(${lin(1, -b)})$. Classify the critical numbers of $f$.`,
        `Local max at x = ${a}, local min at x = ${b}`, [`Local min at x = ${a}, local max at x = ${b}`, `Local max at both x = ${a} and x = ${b}`, `Neither is an extremum`],
        R`Sign chart for $f'$: positive for $x<${a}$, negative on $(${a},${b})$, positive for $x>${b}$. $f'$ goes $+\to-$ at $${a}$ (local max) and $-\to+$ at $${b}$ (local min).`, 'Use a sign chart for f′ with a test point in each interval.');
    }
    if (kind === 2) {
      const c = ri(-3, 4), k = nz(-6, 6);
      return mc('extrema', R`$f'(${c}) = 0$ and $f''(${c}) = ${k}$. What does the second derivative test say?`,
        k > 0 ? `f has a local minimum at x = ${c}` : `f has a local maximum at x = ${c}`,
        [k > 0 ? `f has a local maximum at x = ${c}` : `f has a local minimum at x = ${c}`, `f has an inflection point at x = ${c}`, 'The test is inconclusive'],
        R`$f''(${c}) ${k > 0 ? '> 0' : '< 0'}$ means $f$ is concave ${k > 0 ? 'up' : 'down'} there; with a horizontal tangent that is a local ${k > 0 ? 'minimum' : 'maximum'}.`);
    }
    if (kind === 3) {
      const a = ri(-3, 3), b = ri(-5, 5), c = ri(-5, 5);
      const fx = poly([[1, 3], [-3 * a, 2], [b, 1], [c, 0]]);
      return num('extrema', R`Find the $x$-coordinate of the inflection point of $f(x) = ${fx}$.`, a, `${a}`,
        R`$f'(x) = ${poly([[3, 2], [-6 * a, 1], [b, 0]])}$ and $f''(x) = ${poly([[6, 1], [-6 * a, 0]])}$. $f''$ changes sign at $x = ${a}$.`);
    }
    const a = ri(-2, 3), b = a + ri(1, 3);
    return mc('extrema', R`Suppose $f'(x) = (${lin(1, -a)})^2(${lin(1, -b)})$. Classify the critical numbers.`,
      `No extremum at x = ${a}; local min at x = ${b}`, [`Local max at x = ${a}; local min at x = ${b}`, `Local min at x = ${a}; local max at x = ${b}`, `Local min at both`],
      R`The squared factor never changes sign, so $f'$ keeps its sign across $x = ${a}$ (no extremum). At $x = ${b}$, $f'$ changes from negative to positive: local min.`);
  }
  function qOptimization() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const p = ri(1, 4), q = ri(-5, 5), r = p + ri(1, 4);
      const f = x => x * x - 2 * p * x + q;
      const cands = [0, p, r].map(x => f(x));
      const mx = Math.max(...cands), mn = Math.min(...cands);
      const wantMax = Math.random() < 0.5;
      return num('optimization', R`Find the absolute ${wantMax ? 'maximum' : 'minimum'} <em>value</em> of $f(x) = ${poly([[1, 2], [-2 * p, 1], [q, 0]])}$ on $[0, ${r}]$.`, wantMax ? mx : mn, `${wantMax ? mx : mn}`,
        R`$f'(x) = ${poly([[2, 1], [-2 * p, 0]])} = 0 \Rightarrow x = ${p}$ (inside the interval). Candidates: $f(0) = ${f(0)}$, $f(${p}) = ${f(p)}$, $f(${r}) = ${f(r)}$. Absolute max $${mx}$, absolute min $${mn}$.`, 'Closed interval method: critical numbers inside plus the endpoints.');
    }
    if (kind === 1) {
      const P = ri(10, 60) * 4;
      return num('optimization', R`A rectangle has perimeter $${P}$ m. What is the largest possible area (m²)?`, (P / 4) ** 2, `${(P / 4) ** 2}`,
        R`$2x + 2y = ${P} \Rightarrow y = ${P / 2} - x$, $A = x(${P / 2} - x)$, $A' = ${P / 2} - 2x = 0 \Rightarrow x = ${P / 4}$. A square of side $${P / 4}$ gives area $${(P / 4) ** 2}$ m².`);
    }
    if (kind === 2) {
      const F = ri(5, 30) * 8;
      return num('optimization', R`A farmer has $${F}$ ft of fence for a rectangular pen along a straight river (no fence needed on the river side). What is the maximum area (ft²)?`, F * F / 8, `${F * F / 8}`,
        R`Let $x$ be the side perpendicular to the river: $2x + y = ${F}$, $A = x(${F} - 2x)$, $A' = ${F} - 4x = 0 \Rightarrow x = ${F / 4}$, $y = ${F / 2}$, $A = ${F * F / 8}$ ft².`);
    }
    const S = ri(5, 30) * 2;
    return num('optimization', R`Two positive numbers add to $${S}$. What is the largest possible value of their product?`, (S / 2) ** 2, `${(S / 2) ** 2}`,
      R`$P = x(${S} - x)$, $P' = ${S} - 2x = 0 \Rightarrow x = ${S / 2}$, product $${(S / 2) ** 2}$. ($P'' = -2 < 0$ confirms a max.)`);
  }

  /* ======================================================
     UNIT 4
     ====================================================== */
  function qRiemann() {
    const kind = pick(['L', 'R', 'M']);
    const b = pick([2, 4]), n = pick([2, 4]);
    const fkind = ri(0, 1);
    const c = ri(0, 3);
    const terms = fkind === 0 ? [[1, 2], [c, 0]] : [[2, 1], [c, 0]];
    const f = x => evalPoly(terms, x);
    const dx = b / n;
    let sum = 0; const parts = [];
    for (let i = 0; i < n; i++) {
      const x = kind === 'L' ? i * dx : kind === 'R' ? (i + 1) * dx : (i + 0.5) * dx;
      sum += f(x) * dx; parts.push(`f(${fmt(x)})`);
    }
    const name = kind === 'L' ? 'left' : kind === 'R' ? 'right' : 'midpoint';
    return num('riemann', R`Compute the ${name} Riemann sum $${kind}_{${n}}$ for $f(x) = ${poly(terms)}$ on $[0, ${b}]$.`, sum, fmt(sum),
      R`$\Delta x = \frac{${b}}{${n}} = ${fmt(dx)}$. $${kind}_{${n}} = \Delta x\,[${parts.join(' + ')}] = ${fmt(dx)}\,[${parts.map(p => fmt(f(parseFloat(p.slice(2, -1))))).join(' + ')}] = ${fmt(sum)}$.`,
      R`$\Delta x = (b-a)/n$; sample the ${name === 'midpoint' ? 'midpoint' : name + ' endpoint'} of each subinterval.`);
  }
  function qRiemannTable() {
    const h = pick([2, 5, 10]), n = 5;
    const t = Array.from({ length: n }, (_, i) => i * h);
    const v = Array.from({ length: n }, () => ri(2, 15));
    const kind = pick(['left', 'right']);
    const sum = (kind === 'left' ? v.slice(0, n - 1) : v.slice(1)).reduce((s, x) => s + x, 0) * h;
    const table = R`\begin{array}{c|ccccc} t\ (\text{s}) & ${t.join(' & ')} \\ \hline v(t)\ (\text{m/s}) & ${v.join(' & ')} \end{array}`;
    return num('riemann', R`A car's velocity is recorded every $${h}$ seconds. Use a ${kind} Riemann sum with $${n - 1}$ rectangles to estimate the distance traveled (m) on $[0, ${t[n - 1]}]$.<div class="qmath">$$${table}$$</div>`, sum, `${sum}`,
      R`${kind === 'left' ? 'Left' : 'Right'} sum: $${h}\,(${(kind === 'left' ? v.slice(0, n - 1) : v.slice(1)).join(' + ')}) = ${sum}$ m.`);
  }
  function qOverUnder() {
    const inc = Math.random() < 0.5, left = Math.random() < 0.5;
    const under = (inc && left) || (!inc && !left);
    return mc('riemann', R`$f$ is ${inc ? 'increasing' : 'decreasing'} on $[a,b]$. Is the ${left ? 'left' : 'right'} Riemann sum an overestimate or an underestimate of $\int_a^b f(x)\,dx$?`,
      under ? 'Underestimate' : 'Overestimate', [under ? 'Overestimate' : 'Underestimate', 'Exact', 'Cannot be determined'],
      R`For an ${inc ? 'increasing' : 'decreasing'} function the ${left ? 'left' : 'right'} endpoint is the ${under ? 'lowest' : 'highest'} point of each subinterval, so every rectangle ${under ? 'falls short of' : 'overshoots'} the area.`);
  }
  function qDefiniteIntegral() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const a = ri(1, 4), c = ri(-5, 5), b = ri(1, 3);
      const ans = a * b ** 3 / 3 + c * b;
      return num('definite-integral', R`Evaluate $\displaystyle\int_0^{${b}} (${poly([[a, 2], [c, 0]])})\,dx$.`, ans, fmt(ans),
        R`$\left[\frac{${a}}{3}x^3 ${signed(c)}x\right]_0^{${b}} = \frac{${a}}{3}(${b ** 3}) ${signed(c)}(${b}) = ${fmt(ans)}$.`);
    }
    if (kind === 1) {
      const A = ri(-6, 9), B = ri(-6, 9), k = ri(2, 4);
      const q = ri(0, 2);
      const asks = [
        { p: R`\int_0^5 f(x)\,dx`, ans: A + B, why: R`\int_0^5 f = \int_0^3 f + \int_3^5 f = ${A} + (${B}) = ${A + B}` },
        { p: R`\int_5^0 f(x)\,dx`, ans: -(A + B), why: R`\int_5^0 f = -\int_0^5 f = -(${A + B}) = ${-(A + B)}` },
        { p: R`\int_0^5 ${k}f(x)\,dx`, ans: k * (A + B), why: R`\int_0^5 ${k}f = ${k}\int_0^5 f = ${k}(${A + B}) = ${k * (A + B)}` }
      ][q];
      return num('definite-integral', R`Given $\int_0^3 f(x)\,dx = ${A}$ and $\int_3^5 f(x)\,dx = ${B}$, find $\displaystyle ${asks.p}$.`, asks.ans, `${asks.ans}`, R`$${asks.why}$.`);
    }
    if (kind === 2) {
      const a = ri(1, 4), c = ri(-4, 6), b = ri(2, 6);
      const avg = a * b / 2 + c;
      return num('definite-integral', R`Find the average value of $f(x) = ${lin(a, c)}$ on $[0, ${b}]$.`, avg, fmt(avg),
        R`$f_{\text{avg}} = \frac{1}{${b}}\int_0^{${b}} (${lin(a, c)})\,dx = \frac{1}{${b}}\left[\frac{${a}}{2}x^2 ${signed(c)}x\right]_0^{${b}} = \frac{1}{${b}}(${a * b * b / 2 + c * b}) = ${fmt(avg)}$.`);
    }
    const c = ri(1, 4), b = ri(c + 1, 8);
    const ans = b * b / 2 - c * b;
    return num('definite-integral', R`Evaluate $\displaystyle\int_0^{${b}} (x - ${c})\,dx$ and interpret the sign.`, ans, fmt(ans),
      R`$\left[\frac{x^2}{2} - ${c}x\right]_0^{${b}} = ${b * b / 2} - ${c * b} = ${fmt(ans)}$. The graph is below the axis on $[0,${c}]$ (negative area) and above on $[${c},${b}]$; the integral is the net signed area.`);
  }
  function qFTC() {
    const kind = ri(0, 2);
    if (kind === 0) {
      const items = [
        { e: R`\int_1^{2} 3x^2\,dx`, ans: 7, tex: '7', why: R`[x^3]_1^2 = 8 - 1 = 7` },
        { e: R`\int_0^{\pi} \sin x\,dx`, ans: 2, tex: '2', why: R`[-\cos x]_0^\pi = -(-1) - (-1) = 2` },
        { e: R`\int_0^{\pi/2} \cos x\,dx`, ans: 1, tex: '1', why: R`[\sin x]_0^{\pi/2} = 1 - 0 = 1` },
        { e: R`\int_0^1 e^x\,dx`, ans: Math.E - 1, tex: 'e - 1 \\approx 1.7183', why: R`[e^x]_0^1 = e - 1` },
        { e: R`\int_1^{e} \frac{1}{x}\,dx`, ans: 1, tex: '1', why: R`[\ln x]_1^e = 1 - 0 = 1` },
        { e: R`\int_1^{4} \sqrt{x}\,dx`, ans: 14 / 3, tex: R`\frac{14}{3}`, why: R`\left[\tfrac23 x^{3/2}\right]_1^4 = \tfrac23(8 - 1) = \tfrac{14}{3}` },
        { e: R`\int_0^{2} (4x^3 - 2x)\,dx`, ans: 12, tex: '12', why: R`[x^4 - x^2]_0^2 = 16 - 4 = 12` },
        { e: R`\int_0^{1} \frac{1}{1+x^2}\,dx`, ans: Math.PI / 4, tex: R`\frac{\pi}{4} \approx 0.7854`, why: R`[\arctan x]_0^1 = \frac\pi4` }
      ];
      const it = pick(items);
      return num('ftc', R`Evaluate $\displaystyle ${it.e}$.`, it.ans, it.tex, R`$${it.why}$.`, 'Find an antiderivative, then subtract: F(b) − F(a).');
    }
    if (kind === 1) {
      const a = ri(1, 6), b = ri(0, 5), V0 = ri(5, 50), T = ri(2, 6);
      const ans = V0 + a * T * T / 2 + b * T;
      return num('ftc', R`Water flows into a tank at $r(t) = ${lin(a, b, 't')}$ gallons per minute. The tank holds $${V0}$ gallons at $t = 0$. How many gallons are in it at $t = ${T}$?`, ans, fmt(ans),
        R`Change $= \int_0^{${T}} (${lin(a, b, 't')})\,dt = \left[\frac{${a}}{2}t^2 ${signed(b)}t\right]_0^{${T}} = ${a * T * T / 2 + b * T}$. Total: $${V0} + ${a * T * T / 2 + b * T} = ${fmt(ans)}$ gallons.`, 'Integrating the rate gives the net change; add the starting amount.');
    }
    const f0 = ri(-5, 20), I = ri(-10, 15), T = ri(2, 9);
    return num('ftc', R`Suppose $f(0) = ${f0}$ and $\displaystyle\int_0^{${T}} f'(t)\,dt = ${I}$. Find $f(${T})$.`, f0 + I, `${f0 + I}`,
      R`Total change theorem: $\int_0^{${T}} f'(t)\,dt = f(${T}) - f(0)$, so $f(${T}) = ${f0} + (${I}) = ${f0 + I}$.`);
  }
  function qAntiderivative() {
    const a = ri(2, 6), n = ri(2, 4), b = ri(1, 9), k = ri(2, 5);
    const items = [
      { f: R`${a}x^{${n}} + ${b}`, ok: R`\frac{${a}}{${n + 1}}x^{${n + 1}} + ${b}x + C`, bad: [R`${a * n}x^{${n - 1}} + C`, R`\frac{${a}}{${n + 1}}x^{${n + 1}} + C`, R`${a}x^{${n + 1}} + ${b}x + C`] },
      { f: R`e^{${k}x}`, ok: R`\frac{1}{${k}}e^{${k}x} + C`, bad: [R`${k}e^{${k}x} + C`, R`e^{${k}x} + C`, R`\frac{e^{${k}x + 1}}{${k}x+1} + C`] },
      { f: R`\cos(${k}x)`, ok: R`\frac{1}{${k}}\sin(${k}x) + C`, bad: [R`${k}\sin(${k}x) + C`, R`-\frac{1}{${k}}\sin(${k}x) + C`, R`\sin(${k}x) + C`] },
      { f: R`\frac{${a}}{x}`, ok: R`${a}\ln|x| + C`, bad: [R`-\frac{${a}}{x^2} + C`, R`\frac{${a}x^0}{0} + C`, R`\ln|${a}x| + C`] },
      { f: R`\sec^2 x`, ok: R`\tan x + C`, bad: [R`\sec x\tan x + C`, R`\frac{\sec^3 x}{3} + C`, R`-\cot x + C`] },
      { f: R`\sqrt{x}`, ok: R`\frac{2}{3}x^{3/2} + C`, bad: [R`\frac{1}{2\sqrt x} + C`, R`\frac{3}{2}x^{3/2} + C`, R`x^{3/2} + C`] },
      { f: R`\sin x - ${b}`, ok: R`-\cos x - ${b}x + C`, bad: [R`\cos x - ${b}x + C`, R`-\cos x + C`, R`-\cos x - ${b} + C`] },
      { f: R`\frac{1}{1+x^2}`, ok: R`\arctan x + C`, bad: [R`\ln(1+x^2) + C`, R`\arcsin x + C`, R`-\frac{2x}{(1+x^2)^2} + C`] }
    ];
    const it = pick(items);
    return mc('antiderivatives', R`Find $\displaystyle\int \left(${it.f}\right)dx$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
      R`Reverse the derivative rules and check by differentiating: $\frac{d}{dx}\left[${it.ok.replace(' + C', '')}\right] = ${it.f}$.`, 'Differentiate your answer to check it.');
  }
  function qAntiderivativeIVP() {
    const a = ri(1, 6), b = ri(-5, 5), c = ri(-9, 9), p = ri(1, 4);
    const F = x => a * x * x / 2 + b * x + c;
    return num('antiderivatives', R`$F'(x) = ${lin(a, b)}$ and $F(0) = ${c}$. Find $F(${p})$.`, F(p), fmt(F(p)),
      R`$F(x) = \frac{${a}}{2}x^2 ${signed(b)}x + C$; $F(0) = ${c}$ gives $C = ${c}$. Then $F(${p}) = ${fmt(a * p * p / 2)} ${signed(b * p)} ${signed(c)} = ${fmt(F(p))}$.`);
  }
  function qFTC2() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const items = [
        { f: R`\sin t`, up: 'x^2', ok: R`2x\sin(x^2)`, bad: [R`\sin(x^2)`, R`2x\cos(x^2)`, R`-\cos(x^2)`] },
        { f: R`e^{t^2}`, up: 'x', ok: R`e^{x^2}`, bad: [R`2xe^{x^2}`, R`\frac{e^{x^3}}{3}`, R`e^{x^2} - 1`] },
        { f: R`\sqrt{1+t^3}`, up: 'x', ok: R`\sqrt{1+x^3}`, bad: [R`\frac{3x^2}{2\sqrt{1+x^3}}`, R`\sqrt{1+x^3} - 1`, R`\frac{2}{3}(1+x^3)^{3/2}`] },
        { f: R`\cos t`, up: '3x', ok: R`3\cos(3x)`, bad: [R`\cos(3x)`, R`\sin(3x)`, R`-3\sin(3x)`] },
        { f: R`\ln t`, up: 'x^3', ok: R`3x^2\ln(x^3)`, bad: [R`\ln(x^3)`, R`\frac{3x^2}{x^3}`, R`x^3\ln(x^3) - x^3`] }
      ];
      const it = pick(items);
      return mc('ftc2', R`Find $\displaystyle\frac{d}{dx}\int_0^{${it.up}} ${it.f}\,dt$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
        R`Second FTC with the chain rule: replace $t$ by the upper limit and multiply by its derivative. Result: $${it.ok}$.`, 'Do not integrate. Copy the integrand at the upper limit, times the upper limit’s derivative.');
    }
    if (kind === 1) {
      const c = ri(1, 4);
      return num('ftc2', R`Let $A(x) = \displaystyle\int_0^x (t^2 - ${c * c})\,dt$. Find $A'(${c})$.`, 0, '0',
        R`$A'(x) = x^2 - ${c * c}$ by the second FTC, so $A'(${c}) = 0$. ($x = ${c}$ is a critical number of $A$; $A$ has a local min there since $A'$ goes from negative to positive.)`);
    }
    if (kind === 2) {
      const c = ri(1, 4), p = ri(c + 1, c + 4);
      return num('ftc2', R`Let $A(x) = \displaystyle\int_1^x (t^2 - ${c * c})\,dt$. Find $A'(${p})$.`, p * p - c * c, `${p * p - c * c}`,
        R`$A'(x) = x^2 - ${c * c}$, so $A'(${p}) = ${p * p} - ${c * c} = ${p * p - c * c}$.`);
    }
    const c = ri(1, 4);
    return mc('ftc2', R`Let $F(x) = \displaystyle\int_0^x f(t)\,dt$ where $f$ is positive on $(0, ${c})$ and negative on $(${c}, ${c + 3})$. Which is true?`,
      `F is increasing on (0, ${c}) and has a local maximum at x = ${c}`, [`F is decreasing on (0, ${c}) and has a local minimum at x = ${c}`, `F has an inflection point at x = ${c}`, `F is negative on (0, ${c})`],
      R`$F' = f$. Positive $f$ means $F$ increases; the sign change of $f$ from $+$ to $-$ at $${c}$ is a local max of $F$.`);
  }
  function qDistance() {
    const kind = ri(0, 2);
    if (kind === 0) {
      const k = ri(1, 5), T = ri(2, 8);
      return num('distance', R`An object moves with velocity $v(t) = ${k}t$ m/s for $0 \le t \le ${T}$. How far does it travel (m)?`, k * T * T / 2, fmt(k * T * T / 2),
        R`The region under $v$ is a triangle with base $${T}$ and height $${k * T}$: area $= \frac12(${T})(${k * T}) = ${fmt(k * T * T / 2)}$ m. (Or $\int_0^{${T}} ${k}t\,dt$.)`, 'Distance is the area under the velocity graph.');
    }
    if (kind === 1) {
      const c = ri(1, 5);
      const total = Math.random() < 0.5;
      return num('distance', R`$v(t) = t - ${c}$ m/s on $[0, ${2 * c}]$. Find the <b>${total ? 'total distance traveled' : 'net change in position'}</b> (m).`, total ? c * c : 0, total ? `${c * c}` : '0',
        R`$v$ is negative on $[0,${c}]$ (triangle of area $${c * c / 2}$ below the axis) and positive on $[${c},${2 * c}]$ (area $${c * c / 2}$ above). Net change $= -${c * c / 2} + ${c * c / 2} = 0$; total distance $= ${c * c / 2} + ${c * c / 2} = ${c * c}$ m.`);
    }
    const v1 = ri(2, 8), t1 = ri(1, 4), v2 = ri(2, 8), t2 = ri(1, 4);
    return num('distance', R`A runner goes $${v1}$ m/s for $${t1}$ s, then $${v2}$ m/s for $${t2}$ s. Total distance (m)?`, v1 * t1 + v2 * t2, `${v1 * t1 + v2 * t2}`,
      R`Two rectangles under the velocity graph: $${v1}\cdot${t1} + ${v2}\cdot${t2} = ${v1 * t1 + v2 * t2}$ m.`);
  }
  function qUsub() {
    const k = ri(2, 5), n = ri(2, 4);
    const items = [
      { f: R`2x\cos(x^2)`, ok: R`\sin(x^2) + C`, bad: [R`x^2\sin(x^2) + C`, R`-\sin(x^2) + C`, R`2\sin(x^2) + C`] },
      { f: R`x e^{x^2}`, ok: R`\frac12 e^{x^2} + C`, bad: [R`e^{x^2} + C`, R`2e^{x^2} + C`, R`\frac{x^2}{2}e^{x^2} + C`] },
      { f: R`(${k}x + 1)^{${n}}`, ok: R`\frac{(${k}x+1)^{${n + 1}}}{${k * (n + 1)}} + C`, bad: [R`\frac{(${k}x+1)^{${n + 1}}}{${n + 1}} + C`, R`${k * n}(${k}x+1)^{${n - 1}} + C`, R`\frac{(${k}x+1)^{${n}}}{${k}} + C`] },
      { f: R`\frac{2x}{x^2+1}`, ok: R`\ln(x^2+1) + C`, bad: [R`\arctan x + C`, R`\frac{1}{x^2+1} + C`, R`2\ln(x^2+1) + C`] },
      { f: R`\sin(${k}x)`, ok: R`-\frac{1}{${k}}\cos(${k}x) + C`, bad: [R`\frac{1}{${k}}\cos(${k}x) + C`, R`-${k}\cos(${k}x) + C`, R`-\cos(${k}x) + C`] }
    ];
    const it = pick(items);
    return mc('substitution', R`Find $\displaystyle\int ${it.f}\,dx$.`, `$${it.ok}$`, it.bad.map(s => `$${s}$`),
      R`Let $u$ be the inside function; its derivative appears (up to a constant) as a factor. Result: $${it.ok}$. Check by differentiating.`);
  }

  /* ---------- registry ---------- */
  const GENERATORS = [
    qRateUnits, qArocPoly, qArocSqrt, qArocTable, qVelocity, qLimitForm, qLimitFactor, qLimitDiffSquares, qLimitConjugate, qLimitReciprocal,
    qLimitTable, qPiecewise, qLimitDefQuadratic, qLimitDefReciprocal, qLimitDefSqrt, qDerivPointQuadratic, qInterpretation, qUnits, qEstimateTable, qFBC,
    qConcavitySigns, qSecondDerivContext, qDerivFunctionConcept,
    qPowerRulePoly, qPowerRuleRoots, qExpRule, qTrigEval, qProductRule, qQuotientRule, qChainPower, qChainTrigExp, qChainNumeric, qOtherTrig, qLnLog, qLnNumeric, qInverseFn,
    qTangentLineEq, qLinearization, qContinuityK, qContDiffConcept, qAbsNonDiff,
    qImplicit, qRelatedRates, qLHopital, qLimitsInfinity, qExtrema, qOptimization,
    qRiemann, qRiemannTable, qOverUnder, qDefiniteIntegral, qFTC, qAntiderivative, qAntiderivativeIVP, qFTC2, qDistance, qUsub
  ];
  // map topic -> generators (a generator may emit only its own topic)
  const BY_TOPIC = {};
  for (const g of GENERATORS) {
    // sample once to learn its topic (generators are pure in topic)
    const t = g().topic;
    (BY_TOPIC[t] = BY_TOPIC[t] || []).push(g);
  }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }

  /* generate a set of n questions from the given topics, spreading across topics */
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]);
    if (!pool.length) return [];
    const out = [];
    const order = shuffle(pool);
    let guard = 0;
    while (out.length < n && guard++ < n * 20) {
      const t = order[out.length % order.length];
      const g = pick(BY_TOPIC[t]);
      const q = g();
      if (q.type === 'mc' && q.options.length < 2) continue;
      // avoid exact duplicate prompts
      if (out.some(o => o.prompt === q.prompt)) continue;
      q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      out.push(q);
    }
    return out;
  }

  global.Courses = global.Courses || {};
  global.Courses.calc = global.Courses.calc || {};
  global.Courses.calc.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt, fracTex, shuffle } };
})(window);
