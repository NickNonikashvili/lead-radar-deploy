/* ============================================================
   StudyCat — the math check (App.mathCheck): exact arithmetic so Bo never agrees with something wrong.
   - claims(text, ctx): what is wrong in something said or written, in plain math, LaTeX or spoken words
     ("eleven minus three is six", "x = 11 - 3 so x = 6", "2x + 3 = 11 so x = 6"); with ctx (equations from
     the problem being worked, a question just asked) it also checks a bare answer ("x = 6", "6").
   - tool(args): Bo's check_math tool on a call: a value, two things equal, an equation and values for its
     letters, a derivative, an antiderivative, a limit, the steps of a solution.
   - board(lines): the lines of a page Bo writes: a false equality, or a step that does not follow from the one
     before (equations in one letter whose solutions share nothing).
   Numbers are compared exactly (with room for a stated rounding: "pi is 3.14" is fine); anything it cannot
   read is left alone, so it never cries wrong over notation it does not know. Used by assets/talk.js; the
   server has the same rules for typed and basic-voice questions (api/mathcheck.php).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- words and notation into plain math ---------- */
  const ONES = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const FRACW = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4, fifth: 5, fifths: 5 };
  // whole numbers said as words: "twenty one", "one hundred and five", "three thousand"
  function numberWords(s) {
    const W = Object.keys(ONES).concat(Object.keys(TENS), ['hundred', 'thousand']).join('|');
    return s.replace(new RegExp(`\\b(?:${W})(?:(?:[\\s-]+(?:and\\s+)?)(?:${W}))*\\b`, 'g'), m => {
      let total = 0, cur = 0, ok = false;
      for (const w of m.split(/[\s-]+/)) {
        if (w === 'and') continue;
        if (w in ONES) { cur += ONES[w]; ok = true; } else if (w in TENS) { cur += TENS[w]; ok = true; }
        else if (w === 'hundred') { cur = (cur || 1) * 100; ok = true; } else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; ok = true; }
      }
      return ok ? ` ${total + cur} ` : m;
    });
  }
  const EQ_WORDS = /\b(?:is\s+equal\s+to|equals?\s+to|equals?|equal|is|are|was|gives\s+(?:you|me|us)?|gives|makes|comes\s+(?:out\s+)?to|would\s+be|will\s+be|should\s+be|be)\b/g;
  function norm(src) {
    let s = ' ' + String(src || '') + ' ';
    s = s.replace(/\$\$?/g, ' ').replace(/\\left|\\right|\\[bB]igg?[lr]?|\\displaystyle|\\,|\\;|\\!|\\ /g, ' ');
    s = s.replace(/!=/g, ' ≠ ').replace(/([0-9)])!/g, '$1¡');   // 5! is a factorial, not the end of a sentence
    s = s.replace(/[−–—]/g, '-').replace(/[×·⋅∙✕]/g, '*').replace(/÷/g, '/').replace(/π/g, ' pi ').replace(/√/g, ' sqrt ').replace(/≈/g, ' ~= ').replace(/≠/g, ' != ').replace(/[≤≥<>]/g, ' ; ').replace(/⇒|→|⟹|∴/g, ' ; ');
    s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/¹/g, '^1').replace(/⁴/g, '^4');
    s = s.replace(/\\(?:cdot|times|ast)\b/g, '*').replace(/\\div\b/g, '/').replace(/\\pi\b/g, ' pi ').replace(/\\approx\b/g, ' ~= ').replace(/\\(?:ne|neq)\b/g, ' != ').replace(/\\(?:Rightarrow|implies|to|rightarrow|Longrightarrow|therefore|quad|qquad|text\{[^}]*\}|le|ge|leq|geq|lt|gt)\b/g, ' ; ');
    for (let k = 0; k < 10; k++) {   // innermost first
      const t = s.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\\sqrt\s*\[([^\[\]{}]*)\]\s*\{([^{}]*)\}/g, '(($2)^(1/($1)))').replace(/\\sqrt\s*\{([^{}]*)\}/g, ' sqrt($1)').replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
      if (t === s) break; s = t;
    }
    s = s.replace(/\\(sin|cos|tan|ln|log|exp|sqrt)\b/g, ' $1 ');
    s = s.toLowerCase();
    s = s.replace(/(\d),(\d{3})\b/g, '$1$2');   // 1,200
    // spoken math
    s = s.replace(/\b(an?|one)\s+(half|third|quarter|fourth|fifth)\b/g, (m, a, w) => ` (1/${FRACW[w]}) `);
    s = numberWords(s);
    s = s.replace(/(\d+)\s+(halves|thirds|quarters|fourths|fifths)\b/g, (m, n, w) => ` (${n}/${FRACW[w]}) `);
    s = s.replace(/(\d)\s+point\s+(\d+)/g, '$1.$2').replace(/\bpoint\s+(\d+)/g, '0.$1');
    s = s.replace(/\b(?:the\s+)?absolute\s+value\s+of\b/g, ' abs ').replace(/\bsquare\s+root\s+of\b/g, ' sqrt ').replace(/\bcube\s+root\s+of\b/g, ' cbrt ').replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3');
    s = s.replace(/\bto\s+the\s+power\s+of\b|\braised\s+to(?:\s+the)?\b|\bto\s+the\s+(?=\d)/g, '^').replace(/(\d+)(?:st|nd|rd|th)\s+power\b/g, '$1');
    s = s.replace(/\bplus\b/g, '+').replace(/\bminus\b|\btake\s+away\b|\bless\b(?!\s+than)/g, '-').replace(/\bnegative\b/g, ' -').replace(/\bmultiplied\s+by\b|\btimes\b/g, '*').replace(/\bdivided\s+by\b|\bover\b/g, '/');
    s = s.replace(/(\d)\s*%\s*of\b/g, '$1/100*').replace(/(\d)\s*%/g, '($1/100)').replace(/\bpercent\s+of\b/g, '/100*');
    s = s.replace(/\bx\s+to\s+the\s+/g, 'x^');
    s = s.replace(/\b(?:um+|uh+|erm|like|basically|actually|just|probably|maybe|literally|kind\s+of|sort\s+of|i\s+think|i\s+guess|i\s+believe|pretty\s+sure|it'?s|that'?s|i\s+got|i\s+get|you\s+get|we\s+get)\b/g, m => /^(it|that)/.test(m) ? ' is ' : ' ');
    // what joins two claims, and what says "equals"
    s = s.replace(/[!?;]|\.(?!\d)|,(?!\d{3})|\b(?:so|then|therefore|thus|hence|and\s+so|which\s+means|that\s+means|means|meaning|because|since|but|and|or|if|when|right|okay|ok|yeah|yes|no|wait|hmm+)\b/g, ' ; ');
    s = s.replace(/~=/g, ' ≈ ').replace(/¡/g, '!');
    s = s.replace(EQ_WORDS, ' = ').replace(/={2,}/g, '=');
    return s.replace(/\s+/g, ' ').trim();
  }

  /* ---------- a small parser: numbers, letters, + - * / ^ !, implicit multiplication, functions, pi and e ---------- */
  const FUN = { sqrt: Math.sqrt, cbrt: Math.cbrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: x => Math.log10(x), exp: Math.exp, abs: Math.abs };
  const CONST = { pi: Math.PI, e: Math.E };
  const NAMES = Object.keys(FUN).concat(Object.keys(CONST)).sort((a, b) => b.length - a.length);
  const LETTERS = 'abcdfghjkmnpqrstuvwxyz';   // single-letter unknowns (not e, i, l, o)
  // a run of letters as math: a name (sqrt, pi), a function and its letter (sinx), one unknown, or two (xy);
  // anything longer, or a short English word (at, if, is), is words, not math
  const EN2 = new Set('am an as at be by do go ha he hi if in is it me my no of oh ok on or so to up us we ya yo'.split(' '));
  const FUNS = Object.keys(FUN).sort((a, b) => b.length - a.length);
  function letters(m) {
    if (NAMES.includes(m)) return [{ t: FUN[m] ? 'f' : 'c', v: m }];
    const f = FUNS.find(w => m.startsWith(w) && m.length > w.length); if (f) { const rest = letters(m.slice(f.length)); return rest ? [{ t: 'f', v: f }].concat(rest) : null; }
    if (m.length === 1) return LETTERS.includes(m) ? [{ t: 'v', v: m }] : null;
    if (m.length === 2 && !EN2.has(m) && LETTERS.includes(m[0]) && LETTERS.includes(m[1])) return [{ t: 'v', v: m[0] }, { t: 'v', v: m[1] }];
    return null;
  }
  function tokens(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.]/.test(c)) { const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) return null; out.push({ t: 'n', v: parseFloat(m[1]), s: m[1] }); i += m[1].length; continue; }
      if (/[a-z]/.test(c)) { const m = /^[a-z]+/.exec(s.slice(i))[0]; const run = letters(m); if (!run) return null; out.push(...run); i += m.length; continue; }
      if ('+-*/^()|!'.includes(c)) { out.push({ t: c }); i++; continue; }
      return null;
    }
    return out;
  }
  function parse(src) {
    const T = tokens(String(src)); if (!T || !T.length) return null;
    let i = 0; const vars = new Set(); let abs = 0;
    const peek = () => T[i]; const is = t => T[i] && T[i].t === t;
    const fact = n => { if (n < 0 || n > 170 || Math.abs(n - Math.round(n)) > 1e-9) return NaN; let r = 1; for (let k = 2; k <= Math.round(n); k++) r *= k; return r; };
    function expr() { let l = term(); while (is('+') || is('-')) { const op = T[i++].t; const r = term(); const L = l; l = op === '+' ? e => L(e) + r(e) : e => L(e) - r(e); } return l; }
    function term() {
      let l = unary();
      for (;;) {
        if (is('*') || is('/')) { const op = T[i++].t; const r = unary(); const L = l; l = op === '*' ? e => L(e) * r(e) : e => L(e) / r(e); continue; }
        const p = peek(); if (!p) break;
        // implicit: 2x, 3(x + 1), x y, 2 sqrt 3; never two bare numbers side by side ("chapter 3 2")
        if (p.t === 'v' || p.t === 'c' || p.t === 'f' || p.t === '(' || (p.t === '|' && abs === 0)) { const r = unary(); const L = l; l = e => L(e) * r(e); continue; }
        break;
      }
      return l;
    }
    function unary() { if (is('-')) { i++; const r = unary(); return e => -r(e); } if (is('+')) { i++; return unary(); } return power(); }
    function power() { const b = post(); if (is('^')) { i++; const x = unary(); return e => Math.pow(b(e), x(e)); } return b; }
    function post() { let a = atom(); while (is('!')) { i++; const A = a; a = e => fact(A(e)); } return a; }
    function atom() {
      const p = T[i++]; if (!p) throw 0;
      if (p.t === 'n') { const v = p.v; if (T[i] && T[i].t === 'n') throw 0; return () => v; }
      if (p.t === 'c') { const v = CONST[p.v]; return () => v; }
      if (p.t === 'v') { const n = p.v; vars.add(n); return e => (e && n in e ? e[n] : NaN); }
      if (p.t === 'f') { const F = FUN[p.v]; let a; if (is('(')) { i++; a = expr(); if (!is(')')) throw 0; i++; } else a = unary(); return e => F(a(e)); }
      if (p.t === '(') { const a = expr(); if (!is(')')) throw 0; i++; return a; }
      if (p.t === '|') { abs++; const a = expr(); abs--; if (!is('|')) throw 0; i++; return e => Math.abs(a(e)); }
      throw 0;
    }
    try { const f = expr(); if (i < T.length) return null; return { f, vars: [...vars], ops: T.some(t => '+-*/^!'.includes(t.t) || t.t === 'f' || t.t === 'c') || T.filter(t => t.t !== '(' && t.t !== ')').length > 1 }; } catch (e) { return null; }
  }

  /* ---------- numbers ---------- */
  const close = (a, b, rel = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
  // "3.14" for pi, "0.33" for 1/3: a stated decimal counts as right when it is the true value rounded
  function sameAsSaid(truth, said, text) {
    if (close(truth, said)) return true;
    const m = /(\d)\.(\d+)\s*$/.exec(String(text || '')); if (!m || !Number.isFinite(truth)) return false;
    return Math.abs(truth - said) <= 0.5 * Math.pow(10, -m[2].length) + 1e-12;
  }
  function fmt(v) {
    if (!Number.isFinite(v)) return Number.isNaN(v) ? 'undefined' : (v > 0 ? 'infinity' : '-infinity');
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    for (let q = 2; q <= 12; q++) { const p = v * q; if (Math.abs(p - Math.round(p)) < 1e-9 * q) return `${Math.round(p)}/${q} (${+v.toPrecision(6)})`; }
    return String(+v.toPrecision(8));
  }
  const pretty = s => String(s).replace(/\s+/g, ' ').replace(/\*/g, '·').replace(/-/g, '−').trim();

  /* ---------- the parts of a claim: "left = right", chains, letters given a value ---------- */
  const MATHY = /^[0-9a-z.+\-*/^()|!\s]+$/;
  // the longest piece of math at the end (before "=") or at the start (after "=") of some words
  function edge(words, atEnd) {
    const w = words.trim().split(' ').filter(Boolean); if (!w.length) return '';
    let best = '';
    for (let k = 1; k <= w.length; k++) {
      const part = (atEnd ? w.slice(w.length - k) : w.slice(0, k)).join(' ');
      if (!MATHY.test(part)) break;
      if (parse(part)) best = part;
    }
    // one plain letter is math only when it is a usual unknown ("a" and "is it" are words)
    if (/^[a-z]$/.test(best) && !'xyznkmtpqrsuvw'.includes(best)) return '';
    return best;
  }
  function pieces(text) {
    const out = [];
    for (const clause of norm(text).split(';')) {
      if (!clause.includes('=') && !clause.includes('≈')) { out.push({ clause, sides: [] }); continue; }
      const raw = clause.split(/\s*(=|≈|≠)\s*/);   // [a, op, b, op, c…]
      const sides = [];
      for (let k = 0; k < raw.length; k += 2) {
        const first = k === 0, last = k === raw.length - 1; let s = raw[k];
        s = first ? edge(s, true) : last ? edge(s, false) : (parse(s.trim()) ? s.trim() : edge(s, false));
        sides.push({ s, op: k > 0 ? raw[k - 1] : '' });
      }
      out.push({ clause, sides });
    }
    return out;
  }
  const isDef = s => /^[a-z]\s*\(\s*[a-z]\s*\)/.test(s);   // f(x) = …, a definition
  const valOf = s => { const p = parse(s); return p && !p.vars.length ? p.f({}) : NaN; };

  /* ---------- an equation in one letter: its real solutions (scanning, then halving) ---------- */
  function roots(L, R, v) {
    const f = x => { const e = { [v]: x }; return L(e) - R(e); };
    const out = []; const add = x => { if (!out.some(y => Math.abs(y - x) < 1e-6 * Math.max(1, Math.abs(x)))) out.push(x); };
    let px = -200, pv = f(px);
    for (let k = 1; k <= 8000; k++) {
      const x = -200 + k * 0.05, y = f(x);
      if (Number.isFinite(y) && Math.abs(y) < 1e-10) add(+x.toFixed(10));
      else if (Number.isFinite(pv) && Number.isFinite(y) && pv * y < 0) {
        let a = px, b = x, fa = pv; for (let it = 0; it < 80; it++) { const m = (a + b) / 2, fm = f(m); if (!Number.isFinite(fm)) { a = b; break; } if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
        const r = (a + b) / 2; if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(r))) add(r);   // a sign change, not a jump (1/x)
      }
      px = x; pv = y;
    }
    return out.sort((a, b) => a - b);
  }
  const shared = (A, B) => A.some(a => B.some(b => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a))));
  // an equation as math: "2x + 3 = 11" → {L, R, v} when it has one letter
  function equation(text) {
    const n = norm(text).split(';').find(c => (c.match(/=/g) || []).length === 1); if (!n) return null;
    const [a, b] = n.split('='); const l = edge(a, true), r = edge(b, false); if (!l || !r || isDef(l)) return null;
    const P = parse(l), Q = parse(r); if (!P || !Q) return null;
    const vs = [...new Set(P.vars.concat(Q.vars))]; if (vs.length !== 1) return null;
    if (/^[a-z]$/.test(l.trim()) && !Q.vars.length) return null;   // "x = 6" is an answer, not the problem
    return { L: P.f, R: Q.f, v: vs[0], text: `${pretty(l)} = ${pretty(r)}` };
  }

  const ANSWERW = new Set('it the answer is i so that would be its thats get got a an my final we you oh well number equal to its it\'s that\'s'.split(' '));
  /* ---------- what is wrong in a sentence ----------
     ctx (optional): { eqs: ["2x + 3 = 11", …] (the problem being worked, newest last), ask: "11 - 3" (a question just asked) } */
  function claims(text, ctx) {
    ctx = ctx || {}; const wrong = [], right = [];
    const sets = {}; const eqs = [];
    const ps = pieces(text);
    for (const { sides } of ps) {
      for (let k = 1; k < sides.length; k++) {
        const a = sides[k - 1].s, b = sides[k].s, op = sides[k].op; if (!a || !b || op === '≠' || isDef(a)) continue;
        const A = parse(a), B = parse(b); if (!A || !B) continue;
        // a letter given a value: "x = 11 - 3", then later "x = 6"
        if (/^[a-z]$/.test(a.trim()) && !B.vars.length) {
          const v = a.trim(), val = B.f({}); if (!Number.isFinite(val)) continue;
          if (v in sets && sets[v].ops && !sameAsSaid(sets[v].val, val, b) && !sameAsSaid(val, sets[v].val, sets[v].src)) wrong.push({ kind: 'reassign', v, first: sets[v].src, firstVal: sets[v].val, said: b, saidVal: val, msg: `${v} = ${pretty(sets[v].src)} is ${fmt(sets[v].val)}, not ${pretty(b)}` });
          else if (!(v in sets) || B.ops) sets[v] = { val, src: b, ops: B.ops };
          continue;
        }
        if (A.vars.length || B.vars.length) {
          const vs = [...new Set(A.vars.concat(B.vars))]; if (vs.length === 1 && !(/^[a-z]$/.test(b.trim()) && !A.vars.length)) eqs.push({ L: A.f, R: B.f, v: vs[0], text: `${pretty(a)} = ${pretty(b)}` });
          continue;
        }
        if (!A.ops && !B.ops) continue;   // "3 is 4": not a claim about math
        const va = A.f({}), vb = B.f({});
        if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
        const ok = op === '≈' ? Math.abs(va - vb) <= 0.02 * Math.max(Math.abs(va), Math.abs(vb), 1e-9) : (B.ops ? close(va, vb) || sameAsSaid(vb, va, a) : sameAsSaid(va, vb, b));
        if (!ok && op !== '≈') { const alt = x => x.replace(/^\s*-\s*(\d+(?:\.\d+)?)(?=\s*\^)/, '(-$1)'); const A2 = alt(a) !== a ? parse(alt(a)) : null, B2 = alt(b) !== b ? parse(alt(b)) : null; if ((A2 && close(A2.f({}), vb)) || (B2 && close(va, B2.f({})))) continue; }
        (ok ? right : wrong).push({ kind: 'arith', expr: B.ops && !A.ops ? b : a, said: B.ops && !A.ops ? a : b, is: B.ops && !A.ops ? vb : va, msg: ok ? `${pretty(a)} = ${pretty(b)} is right` : `${pretty(B.ops && !A.ops ? b : a)} is ${fmt(B.ops && !A.ops ? vb : va)}, not ${pretty(B.ops && !A.ops ? a : b)}` });
      }
    }
    // calculus in words: "the derivative of x squared is 2x", "the antiderivative of 2x is x squared"
    for (const clause of norm(text).split(';')) {
      const m = /\b(derivative|antiderivative|integral)\s+of\s+(.+?)\s*=\s*(.+)$/.exec(clause); if (!m) continue;
      const f = edge(m[2], false), g = edge(m[3], false); if (!f || !g) continue;
      const kind = m[1] === 'derivative' ? 'derivative' : 'antiderivative'; const r = tool({ kind, f, answer: g });
      if (r.right === false) wrong.push({ kind, msg: `the ${kind} of ${pretty(f)} is not ${pretty(g)}` + (r.derivative_there ? ` (at ${r.at} it is ${r.derivative_there}, ${pretty(g)} gives ${r.answer_there})` : r.f_there ? ` (the derivative of ${pretty(g)} at ${r.at} is ${r.derivative_of_answer_there}, but ${pretty(f)} there is ${r.f_there})` : '') });
      else if (r.right) right.push({ kind, msg: `the ${kind} of ${pretty(f)} is ${pretty(g)}` });
    }
    // an answer for a letter, checked against the equation it is meant to solve (said together, or the problem being worked)
    const problems = eqs.concat((ctx.eqs || []).slice().reverse().map(equation).filter(Boolean));
    for (const v of Object.keys(sets)) {
      const eq = problems.find(e => e.v === v); if (!eq) continue;
      const x = sets[v].val, l = eq.L({ [v]: x }), r = eq.R({ [v]: x });
      if (!Number.isFinite(l) || !Number.isFinite(r)) continue;
      if (!close(l, r, 1e-7) && !wrong.some(w => w.v === v)) {
        const near = roots(eq.L, eq.R, v); if (near.some(z => sameAsSaid(z, x, sets[v].src))) continue;   // a rounded answer
        wrong.push({ kind: 'solve', v, eq: eq.text, said: sets[v].src, saidVal: x, left: l, right: r, roots: near, msg: `${v} = ${pretty(sets[v].src)} does not solve ${eq.text}: the left side is ${fmt(l)} and the right side is ${fmt(r)}` + (near.length && near.length <= 3 ? ` (${v} = ${near.map(fmt).join(' or ')} does)` : '') });
      } else if (close(l, r, 1e-7)) right.push({ kind: 'solve', v, eq: eq.text, msg: `${v} = ${fmt(x)} solves ${eq.text}` });
    }
    // a bare number answering a question just asked ("What's 11 minus 3?" … "six")
    if (ctx.ask && !wrong.length && !Object.keys(sets).length) {
      // only an answer that is just a number ("six", "it's 6", "the answer is 6"), not a number in other talk ("worth 20 percent")
      const q = parse(ctx.ask); const nums = norm(text).replace(/[;=]/g, ' ').split(' ').filter(w => w && !ANSWERW.has(w));
      if (q && !q.vars.length && q.ops && nums.length === 1 && /^(?:-?\d+(?:\.\d+)?|\(\d+\/\d+\))$/.test(nums[0])) {
        const want = q.f({}), got = valOf(nums[0]);
        if (Number.isFinite(want) && Number.isFinite(got)) { const ok = sameAsSaid(want, got, nums[0]); (ok ? right : wrong).push({ kind: 'answer', expr: ctx.ask, said: nums[0], is: want, msg: ok ? `${fmt(got)} is right: ${pretty(ctx.ask)} is ${fmt(want)}` : `${pretty(ctx.ask)} is ${fmt(want)}, not ${pretty(nums[0])}` }); }
      }
    }
    return { wrong, right };
  }
  // the question in something Bo said: the last sentence with "?" that holds a sum ("So what's 11 minus 3?")
  function question(text) {
    const qs = String(text || '').split(/(?<=[?])/).filter(s => /\?\s*$/.test(s));
    for (const s of qs.reverse()) { const n = norm(s.replace(/\bwhat'?s\b|\bwhat\s+is\b|\bwhat\s+do\s+you\s+get\s+(?:for|from)?\b/gi, ' ')).split(';').map(c => c.replace(/=/g, ' ').trim()); for (const c of n) { const e = edge(c, false) || edge(c, true); const p = e && parse(e); if (p && p.ops && !p.vars.length) return e; } }
    return '';
  }
  // equations in something said or written, newest last ("Solving 2x + 3 = 11"), for ctx.eqs
  function equations(text) { return String(text || '').split(/\n|:\s|\[\/?board\+?:?|\]/).map(norm).join(';').split(';').filter(c => (c.match(/=/g) || []).length === 1).map(c => { const [a, b] = c.split('='); const l = edge(a, true), r = edge(b, false); return l && r ? `${l} = ${r}` : ''; }).filter(e => e && equation(e)); }

  /* ---------- a page Bo writes: each line checked, and each step against the one before ---------- */
  function board(lines, title) {
    const out = []; let prev = title ? equation(title) : null;
    (lines || []).forEach((raw, i) => {
      const text = String(raw || ''); const parts = text.match(/\$\$?[^$]+\$\$?/g) || (/[=]/.test(text) ? [text.replace(/^[^:=]*:\s*/, '')] : []);
      for (const part of parts) {
        const c = claims(part); if (c.wrong.length) { out.push({ line: i + 1, msg: c.wrong[0].msg }); return; }
        const eq = equation(part);
        if (eq) {
          if (prev && prev.v === eq.v) { const A = roots(prev.L, prev.R, eq.v), B = roots(eq.L, eq.R, eq.v); if (A.length && B.length && !shared(A, B)) { out.push({ line: i + 1, msg: `${eq.text} does not follow from ${prev.text} (that one gives ${eq.v} = ${A.slice(0, 3).map(fmt).join(' or ')}, this one ${eq.v} = ${B.slice(0, 3).map(fmt).join(' or ')})` }); return; } }
          prev = eq;
        } else {
          // the answer line: "x = 4" against the last equation
          const n = norm(part); const m = /^\s*([a-z])\s*=\s*(.+)$/.exec(n.split(';').find(x => x.includes('=')) || '');
          if (m && prev && prev.v === m[1]) { const x = valOf(edge(m[2], false)); if (Number.isFinite(x)) { const l = prev.L({ [m[1]]: x }), r = prev.R({ [m[1]]: x }); if (Number.isFinite(l) && Number.isFinite(r) && !close(l, r, 1e-7)) { const A = roots(prev.L, prev.R, m[1]); if (!A.some(z => sameAsSaid(z, x, m[2]))) { out.push({ line: i + 1, msg: `${m[1]} = ${fmt(x)} does not solve ${prev.text}${A.length && A.length <= 3 ? ` (${m[1]} = ${A.map(fmt).join(' or ')} does)` : ''}` }); return; } } } }
        }
      }
    });
    return out;
  }

  /* ---------- Bo's tool on a call: check_math ---------- */
  const SAMPLE = [0.37, 1.13, -0.71, 2.29, -1.61, 0.83, 3.07];
  function fn1(s, v) { const p = parse(norm(String(s || '')).split(';')[0].replace(/^\s*[a-z]\s*\(\s*[a-z]\s*\)\s*=\s*|^\s*y\s*=\s*/, '')); if (!p) return null; const vv = v || p.vars[0] || 'x'; if (p.vars.some(x => x !== vv)) return null; return { f: x => p.f({ [vv]: x }), v: vv }; }
  const deriv = (f, x) => { const h = 1e-5 * Math.max(1, Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); };
  function tool(a) {
    a = a || {}; const kind = String(a.kind || a.check || (a.equation ? 'solves' : a.left != null ? 'equal' : a.f && a.answer && a.at != null ? 'limit' : a.lines ? 'steps' : 'value')).toLowerCase();
    try {
      if (kind === 'value') { const p = parse(norm(a.expression ?? a.expr ?? a.left ?? '').split(';')[0]); if (!p) return { error: 'Could not read that. Use + - * / ^ ( ), sqrt, sin, ln, pi.' }; if (p.vars.length) return { error: `It has a letter (${p.vars.join(', ')}); give it a value, or use kind "solves".` }; return { value: fmt(p.f({})) }; }
      if (kind === 'equal') {
        const A = parse(norm(a.left ?? '').split(';')[0]), B = parse(norm(a.right ?? '').split(';')[0]); if (!A || !B) return { error: 'Could not read left or right.' };
        const vs = [...new Set(A.vars.concat(B.vars))];
        if (!vs.length) { const l = A.f({}), r = B.f({}); const eq = close(l, r) || sameAsSaid(l, r, a.right) || sameAsSaid(r, l, a.left); return { equal: eq, left: fmt(l), right: fmt(r) }; }
        for (const [k, x0] of SAMPLE.entries()) { const e = {}; vs.forEach((v, j) => { e[v] = SAMPLE[(k + 2 * j) % SAMPLE.length] + 0.1 * j; }); const l = A.f(e), r = B.f(e); if (Number.isFinite(l) && Number.isFinite(r) && !close(l, r, 1e-7)) return { equal: false, counterexample: Object.fromEntries(vs.map(v => [v, +e[v].toFixed(4)])), left: fmt(l), right: fmt(r), note: 'Not the same for every value: they differ here.' }; }
        return { equal: true, note: 'The same for every value checked.' };
      }
      if (kind === 'solves' || kind === 'solve') {
        const eq = equation(a.equation ?? ''); if (!eq) { const n = norm(a.equation ?? ''); if (!/=/.test(n)) return { error: 'Give the equation, like "2x + 3 = 11".' }; }
        const raw = a.values ?? a.value ?? a.answer;
        if (kind === 'solve' || raw == null || raw === '') { if (!eq) return { error: 'Only one letter can be solved for here.' }; const r = roots(eq.L, eq.R, eq.v); return { equation: eq.text, solutions: r.slice(0, 6).map(x => `${eq.v} = ${fmt(x)}`), note: r.length ? 'Real solutions between -200 and 200.' : 'No real solution between -200 and 200.' }; }
        const env = {}; const vals = typeof raw === 'object' ? Object.entries(raw) : String(raw).split(/[,;]|\band\b/).map(x => x.split(/=/)).map(x => x.length === 2 ? [x[0].trim().toLowerCase(), x[1]] : [eq ? eq.v : 'x', x[0]]);
        for (const [k, v] of vals) { const x = valOf(norm(String(v)).split(';')[0]); if (!/^[a-z]$/.test(k) || !Number.isFinite(x)) return { error: `Could not read the value of ${k}.` }; env[k] = x; }
        const n = norm(a.equation).split(';').find(c => c.includes('=')); const [ls, rs] = n.split('='); const L = parse(edge(ls, true)), R = parse(edge(rs, false)); if (!L || !R) return { error: 'Could not read the equation.' };
        const miss = [...new Set(L.vars.concat(R.vars))].filter(v => !(v in env)); if (miss.length) return { error: `Give a value for ${miss.join(', ')}.` };
        const l = L.f(env), r = R.f(env); const ok = close(l, r, 1e-7) || (eq && Object.keys(env).length === 1 && roots(eq.L, eq.R, eq.v).some(z => sameAsSaid(z, env[eq.v], String(vals[0][1]))));
        return { solves: ok, left: fmt(l), right: fmt(r) };
      }
      if (kind === 'derivative' || kind === 'antiderivative') {
        const v = a.var || a.variable || undefined; const F = fn1(a.f ?? a.expression, v), G = fn1(a.answer, v || (F && F.v)); if (!F || !G) return { error: 'Could not read f or answer (one letter, like x).' };
        for (const x of SAMPLE) {
          const want = kind === 'derivative' ? deriv(F.f, x) : F.f(x), got = kind === 'derivative' ? G.f(x) : deriv(G.f, x);
          if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
          if (Math.abs(want - got) > 1e-4 * Math.max(1, Math.abs(want))) return kind === 'derivative' ? { right: false, at: `${F.v} = ${x}`, derivative_there: fmt(+want.toPrecision(6)), answer_there: fmt(+got.toPrecision(6)) } : { right: false, at: `${F.v} = ${x}`, f_there: fmt(+want.toPrecision(6)), derivative_of_answer_there: fmt(+got.toPrecision(6)) };
        }
        return { right: true, note: kind === 'antiderivative' ? 'Its derivative matches (any + C is fine).' : 'They match everywhere checked.' };
      }
      if (kind === 'limit') {
        const F = fn1(a.f ?? a.expression, a.var); if (!F) return { error: 'Could not read f.' };
        const at = String(a.at ?? '').trim().toLowerCase(); const inf = /^(\+?inf|infinity|∞|\+∞)$/.test(at) ? 1 : /^(-inf|-infinity|-∞)$/.test(at) ? -1 : 0;
        const c = inf ? 0 : valOf(norm(at)); if (!inf && !Number.isFinite(c)) return { error: 'Give at as a number, "inf" or "-inf".' };
        const side = s => { const vals = [1e-3, 1e-5, 1e-7].map(h => F.f(inf ? inf / h : c + s * h)); const last = vals[2]; return Number.isFinite(last) && Math.abs(last - vals[1]) <= 1e-3 * Math.max(1, Math.abs(last)) ? last : Math.abs(last) > 1e6 && Math.sign(last) === Math.sign(vals[1]) ? Math.sign(last) * Infinity : NaN; };
        const L = side(-1), R = inf ? L : side(1); const lim = close(L, R, 1e-4) || L === R ? L : NaN;
        const ans = String(a.answer ?? '').trim().toLowerCase(); const dne = /^(dne|none|does not exist|doesn't exist)$/.test(ans);
        const got = /^(inf|infinity|∞)$/.test(ans) ? Infinity : /^(-inf|-infinity|-∞)$/.test(ans) ? -Infinity : valOf(norm(ans));
        const right = Number.isNaN(lim) ? dne : (lim === got || close(lim, got, 1e-4) || sameAsSaid(lim, got, ans));
        return { right, limit: Number.isNaN(lim) ? (Number.isFinite(L) && Number.isFinite(R) ? `does not exist (from the left ${fmt(+L.toPrecision(6))}, from the right ${fmt(+R.toPrecision(6))})` : 'does not exist or could not be found') : fmt(+lim.toPrecision(5)) };
      }
      if (kind === 'steps') { const bad = board([].concat(a.lines || [])); return bad.length ? { ok: false, first_wrong: bad[0] } : { ok: true, note: 'Every line checked follows.' }; }
      return { error: 'kind is one of value, equal, solves, solve, derivative, antiderivative, limit, steps.' };
    } catch (e) { return { error: 'Could not check that.' }; }
  }

  /* ---------- a practice question for each thing that was wrong (the mistakes notebook): "What is 11 − 3?", "Solve 2x + 3 = 11." ---------- */
  const tex = s => String(s).replace(/\s+/g, ' ').replace(/\*|·/g, ' \\cdot ').replace(/−/g, '-').trim();
  const texNum = v => { if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v)); for (let q = 2; q <= 12; q++) { const p = v * q; if (Math.abs(p - Math.round(p)) < 1e-9 * q) return `${p < 0 ? '-' : ''}\\frac{${Math.abs(Math.round(p))}}{${q}}`; } return String(+v.toPrecision(6)); };
  function practice(wrong) {
    const out = [];
    for (const w of wrong || []) {
      if (w.kind === 'arith' || w.kind === 'answer') { if (Number.isFinite(w.is)) out.push({ prompt: `What is $${tex(w.expr)}$?`, answer: w.is, tex: texNum(w.is), why: `${pretty(w.expr)} is ${fmt(w.is)}.` }); }
      else if (w.kind === 'reassign') { if (Number.isFinite(w.firstVal)) out.push({ prompt: `What is $${tex(w.first)}$?`, answer: w.firstVal, tex: texNum(w.firstVal), why: `${pretty(w.first)} is ${fmt(w.firstVal)}.` }); }
      else if (w.kind === 'solve' && (w.roots || []).length === 1) out.push({ prompt: `Solve $${tex(w.eq)}$ for $${w.v}$.`, answer: w.roots[0], tex: texNum(w.roots[0]), why: `${w.v} = ${fmt(w.roots[0])} makes both sides equal.` });
    }
    return out.slice(0, 4);
  }

  const API = { norm, parse, claims, question, equations, board, tool, fmt, roots, practice };
  if (global.App) global.App.mathCheck = API;
  global.MathubMathCheck = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
