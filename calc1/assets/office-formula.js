/* ============================================================
   Mathub — the formula engine for Sheets (assets/office-sheets.js): App.Formula
   Excel's rules where it matters, so a spreadsheet means the same thing here, in Excel and in the .xlsx it saves:
   - Cells hold what was typed. "=" starts a formula; a leading ' keeps text as text; 12, 1,234.5, 50%, $12.50 and
     TRUE/FALSE are read as numbers and booleans (decimals with a dot, here and in formulas), 2026-10-26 and
     10/26/2026 as dates (Excel's day numbers, shown as dates).
   - Formulas: numbers, "text", TRUE/FALSE, A1, $A$1, A1:B5, 'Sheet 2'!A1; - (unary, before ^: -2^2 is 4, as in Excel),
     %, ^, * /, + -, & and = <> < > <= >=; functions (FUNCS below).
   - Errors as in Excel: #DIV/0!, #VALUE!, #REF!, #NAME?, #N/A, #NUM!; a cell that depends on itself is #CIRC!
     (Excel warns instead; the .xlsx keeps the formula without a value, so Excel works it out again).
   - References move like Excel's: relative ones shift when a formula is copied, filled or sorted (translate), and
     inserting or deleting rows and columns rewrites every formula that points past them (shift; a deleted cell → #REF!).
   Pure: no page, no DOM; the tests load it in Node.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  const MAX_COL = 702, MAX_ROW = 10000;   // A..ZZ, 1..10000
  const E = code => ({ e: code });
  const isErr = v => v !== null && typeof v === 'object' && 'e' in v;

  /* ---------- addresses ---------- */
  const colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };   // 0 → A
  const colIndex = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const addr = (c, r) => colName(c) + (r + 1);
  const parseAddr = a => { const m = /^\$?([A-Za-z]{1,2})\$?(\d{1,5})$/.exec(a); if (!m) return null; const c = colIndex(m[1]), r = +m[2] - 1; return c < MAX_COL && r >= 0 && r < MAX_ROW ? { c, r } : null; };

  /* ---------- what was typed ---------- */
  /** A cell's input → its value and the format it suggests: { v, fmt } (formulas are evaluated elsewhere). */
  function literal(raw) {
    const s = String(raw == null ? '' : raw);
    if (s === '') return { v: null };
    if (s[0] === "'") return { v: s.slice(1) };
    const t = s.trim();
    if (/^(true|false)$/i.test(t)) return { v: /^true$/i.test(t) };
    let m = /^([-+]?)\$\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/.exec(t); if (m) return { v: +(m[1] + m[2].replace(/,/g, '')), fmt: 'usd' };
    m = /^([-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[-+]?\.\d+)\s?%$/.exec(t); if (m) return { v: +m[1].replace(/,/g, '') / 100, fmt: 'pct' };
    m = /^[-+]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.exec(t); if (m) return { v: +t.replace(/,/g, '') };
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t) || /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (m) { const iso = m[1].length === 4; const d = dayNumber(+(iso ? m[1] : m[3]), +(iso ? m[2] : m[1]), +(iso ? m[3] : m[2])); if (d !== null) return { v: d, fmt: 'date' }; }
    return { v: s };
  }

  /* ---------- reading a formula ---------- */
  const FN_RE = /^[A-Za-z][A-Za-z0-9.]*(?=\s*\()/;
  const REF_RE = /^(?:('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_ ]*?)!)?(\$?[A-Za-z]{1,2}\$?\d{1,5})(?::(\$?[A-Za-z]{1,2}\$?\d{1,5}))?(?![A-Za-z0-9_(])/;
  function tokenize(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const ch = src[i], rest = src.slice(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') { let j = i + 1, s = ''; for (;;) { if (j >= src.length) throw E('#VALUE!'); if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; } out.push({ t: 'str', v: s, at: i, end: j + 1 }); i = j + 1; continue; }
      let m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(rest);
      if (m && !/^[A-Za-z]/.test(rest.slice(m[0].length))) { out.push({ t: 'num', v: +m[0], at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = REF_RE.exec(rest);
      if (m && (m[1] || !FN_RE.test(rest))) { out.push({ t: 'ref', sheet: m[1] ? (m[1][0] === "'" ? m[1].slice(1, -1).replace(/''/g, "'") : m[1]) : null, a: m[2], b: m[3] || null, at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = FN_RE.exec(rest); if (m) { out.push({ t: 'fn', v: m[0].toUpperCase(), at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = /^(TRUE|FALSE)(?![A-Za-z0-9_])/i.exec(rest); if (m) { out.push({ t: 'bool', v: m[1].toUpperCase() === 'TRUE', at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = /^#(?:DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!)/.exec(rest); if (m) { out.push({ t: 'err', v: m[0], at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = /^(<>|<=|>=|[-+*/^&=<>%(),])/.exec(rest); if (m) { out.push({ t: 'op', v: m[0], at: i, end: i + m[0].length }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest); if (m) { out.push({ t: 'name', v: m[0], at: i, end: i + m[0].length }); i += m[0].length; continue; }
      throw E('#NAME?');
    }
    return out;
  }
  /** A formula (without "=") → its tree. Throws an error value when it cannot be read. */
  function parse(src) {
    const T = tokenize(src); let p = 0;
    const peek = () => T[p], take = () => T[p++];
    const isOp = (v) => T[p] && T[p].t === 'op' && T[p].v === v;
    const BIN = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']];
    function level(i) {
      if (i === BIN.length) return postfix();
      let a = level(i + 1);
      while (T[p] && T[p].t === 'op' && BIN[i].includes(T[p].v)) { const op = take().v; const b = level(i + 1); a = { k: 'bin', op, a, b }; }
      return a;
    }
    function postfix() { let a = unary(); while (isOp('%')) { take(); a = { k: 'pct', a }; } return a; }
    function unary() { if (isOp('-') || isOp('+')) { const op = take().v; const a = unary(); return op === '-' ? { k: 'neg', a } : a; } return primary(); }
    function primary() {
      const t = take(); if (!t) throw E('#VALUE!');
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'str') return { k: 'str', v: t.v };
      if (t.t === 'bool') return { k: 'bool', v: t.v };
      if (t.t === 'err') return { k: 'err', v: t.v };
      if (t.t === 'ref') { const A = parseAddr(t.a), B = t.b ? parseAddr(t.b) : null; if (!A || (t.b && !B)) return { k: 'err', v: '#REF!' }; return B ? { k: 'range', sheet: t.sheet, c1: Math.min(A.c, B.c), r1: Math.min(A.r, B.r), c2: Math.max(A.c, B.c), r2: Math.max(A.r, B.r) } : { k: 'ref', sheet: t.sheet, c: A.c, r: A.r }; }
      if (t.t === 'fn') {
        if (!isOp('(')) throw E('#NAME?'); take(); const args = [];
        if (!isOp(')')) { for (;;) { if (isOp(',') || isOp(')')) args.push({ k: 'blank' }); else args.push(level(0)); if (isOp(',')) { take(); continue; } break; } }
        if (!isOp(')')) throw E('#VALUE!'); take(); return { k: 'call', name: t.v, args };
      }
      if (t.t === 'op' && t.v === '(') { const a = level(0); if (!isOp(')')) throw E('#VALUE!'); take(); return a; }
      if (t.t === 'name') return { k: 'err', v: '#NAME?' };
      throw E('#VALUE!');
    }
    const tree = level(0); if (p !== T.length) throw E('#VALUE!'); return tree;
  }

  /* ---------- values ---------- */
  const SERIAL0 = Date.UTC(1899, 11, 30);   // Excel's day 0 (as in 1900 date system, after the 1900 leap-year bug)
  /** A real calendar date (1900–9999) → its day number; null when there is no such day (2026-02-30). */
  function dayNumber(y, m, d) { if (y < 1900 || y > 9999) return null; const ms = Date.UTC(y, m - 1, d); const t = new Date(ms); if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null; return Math.round((ms - SERIAL0) / 86400000); }
  const dateOf = n => new Date(SERIAL0 + Math.floor(n) * 86400000);
  const toNum = v => { if (isErr(v)) return v; if (v === null || v === '') return 0; if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; const l = literal(v); return typeof l.v === 'number' ? l.v : E('#VALUE!'); };
  const general = v => { if (!Number.isFinite(v)) return '#NUM!'; if (v === 0) return '0'; const a = Math.abs(v); if (a >= 1e11 || a < 1e-9) return v.toExponential(5).replace(/\.?0+e/, 'e').replace('e+', 'E+').replace('e-', 'E-'); if (Number.isInteger(v)) return String(v); return String(+v.toPrecision(10)); };
  const toText = v => isErr(v) ? v : v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? general(v) : String(v);
  const toBool = v => { if (isErr(v)) return v; if (typeof v === 'boolean') return v; if (v === null) return false; if (typeof v === 'number') return v !== 0; const s = String(v).toUpperCase(); if (s === 'TRUE') return true; if (s === 'FALSE') return false; return E('#VALUE!'); };
  const rank = v => v === null ? 0 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3;
  function compare(a, b) {   // Excel's order: numbers < text < booleans; text without case; an empty cell is 0 or ""
    if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    const ra = rank(a), rb = rank(b); if (ra !== rb) return ra - rb;
    if (typeof a === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const roundTo = (x, n) => { const f = Math.pow(10, n); const y = Math.abs(x) * f; const r = Math.round(y + Number.EPSILON * y * 4) / f; return Math.sign(x) * r; };   // half away from zero, as Excel

  /* ---------- the functions ---------- */
  // each gets its evaluated arguments; a range comes as { range: [values…] }; numbers(args) gives the numbers SUM-like
  // functions use: from ranges only numbers, given directly anything that reads as a number
  function numbers(args, strict) {
    const out = [];
    for (const a of args) {
      if (a && a.range) { for (const v of a.range) { if (isErr(v)) return v; if (typeof v === 'number') out.push(v); } continue; }
      if (isErr(a)) return a; if (a === null) continue;
      const n = toNum(a); if (isErr(n)) { if (strict) return n; continue; } out.push(n);
    }
    return out;
  }
  const flat = args => { const out = []; for (const a of args) { if (a && a.range) out.push(...a.range); else out.push(a); } return out; };
  function criteria(c) {   // COUNTIF's "criteria": >5, <>0, =apple, apple (wildcards * ?), 5
    if (isErr(c)) return () => false;
    if (typeof c === 'number' || typeof c === 'boolean') return v => v !== null && compare(v, c) === 0 && rank(v) === rank(c);
    const s = String(c); const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(s); const op = m[1] || '='; const lit = literal(m[2]).v;
    if (typeof lit === 'number' || typeof lit === 'boolean') return v => { if (v === null || isErr(v)) return op === '<>'; if (rank(v) !== rank(lit)) return op === '<>'; const d = compare(v, lit); return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op]; };
    const text = String(m[2]);
    if (op === '=' || op === '<>') { const re = new RegExp('^' + text.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?') + '$', 'is');
      return v => { const hit = text === '' ? v === null || v === '' : typeof v === 'string' && re.test(v); return op === '=' ? hit : !hit; }; }
    return v => { if (typeof v !== 'string') return false; const d = compare(v, text); return { '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op]; };
  }
  const need = (args, lo, hi) => args.length < lo || args.length > hi ? E('#VALUE!') : null;
  const num1 = (args, f) => { const e = need(args, 1, 1); if (e) return e; const x = toNum(args[0]); return isErr(x) ? x : f(x); };
  const FUNCS = {
    SUM: a => { const n = numbers(a); return isErr(n) ? n : n.reduce((s, x) => s + x, 0); },
    PRODUCT: a => { const n = numbers(a); return isErr(n) ? n : n.length ? n.reduce((s, x) => s * x, 1) : 0; },
    AVERAGE: a => { const n = numbers(a); return isErr(n) ? n : n.length ? n.reduce((s, x) => s + x, 0) / n.length : E('#DIV/0!'); },
    MIN: a => { const n = numbers(a); return isErr(n) ? n : n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = numbers(a); return isErr(n) ? n : n.length ? Math.max(...n) : 0; },
    MEDIAN: a => { const n = numbers(a); if (isErr(n)) return n; if (!n.length) return E('#NUM!'); const s = n.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; },
    STDEV: a => { const n = numbers(a); if (isErr(n)) return n; if (n.length < 2) return E('#DIV/0!'); const m = n.reduce((s, x) => s + x, 0) / n.length; return Math.sqrt(n.reduce((s, x) => s + (x - m) ** 2, 0) / (n.length - 1)); },
    VAR: a => { const n = numbers(a); if (isErr(n)) return n; if (n.length < 2) return E('#DIV/0!'); const m = n.reduce((s, x) => s + x, 0) / n.length; return n.reduce((s, x) => s + (x - m) ** 2, 0) / (n.length - 1); },
    COUNT: a => { let n = 0; for (const x of a) { if (x && x.range) { n += x.range.filter(v => typeof v === 'number').length; continue; } if (x === null || isErr(x)) continue; if (typeof x === 'number' || typeof x === 'boolean' || typeof toNum(x) === 'number') n++; } return n; },   // ranges: numbers; given directly: anything that reads as one
    COUNTA: a => flat(a).filter(v => v !== null && v !== '').length,
    COUNTBLANK: a => flat(a).filter(v => v === null || v === '').length,
    COUNTIF: a => { const e = need(a, 2, 2); if (e) return e; const f = criteria(a[1]); return (a[0] && a[0].range ? a[0].range : [a[0]]).filter(f).length; },
    SUMIF: a => { const e = need(a, 2, 3); if (e) return e; const f = criteria(a[1]); const R = a[0] && a[0].range ? a[0].range : [a[0]]; const S = a[2] ? (a[2].range || [a[2]]) : R; let s = 0; R.forEach((v, i) => { if (f(v) && typeof S[i] === 'number') s += S[i]; }); return s; },
    AVERAGEIF: a => { const e = need(a, 2, 3); if (e) return e; const f = criteria(a[1]); const R = a[0] && a[0].range ? a[0].range : [a[0]]; const S = a[2] ? (a[2].range || [a[2]]) : R; let s = 0, n = 0; R.forEach((v, i) => { if (f(v) && typeof S[i] === 'number') { s += S[i]; n++; } }); return n ? s / n : E('#DIV/0!'); },
    AND: a => { const v = flat(a).filter(x => x !== null && typeof x !== 'string'); if (v.some(isErr)) return v.find(isErr); if (!v.length) return E('#VALUE!'); return v.every(x => toBool(x) === true); },
    OR: a => { const v = flat(a).filter(x => x !== null && typeof x !== 'string'); if (v.some(isErr)) return v.find(isErr); if (!v.length) return E('#VALUE!'); return v.some(x => toBool(x) === true); },
    NOT: a => { const e = need(a, 1, 1); if (e) return e; const b = toBool(a[0]); return isErr(b) ? b : !b; },
    ROUND: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), n = a.length > 1 ? toNum(a[1]) : 0; if (isErr(x)) return x; if (isErr(n)) return n; return roundTo(x, Math.trunc(n)); },
    ROUNDUP: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), n = a.length > 1 ? toNum(a[1]) : 0; if (isErr(x)) return x; if (isErr(n)) return n; const f = Math.pow(10, Math.trunc(n)); return Math.sign(x) * Math.ceil(+(Math.abs(x) * f).toPrecision(15)) / f; },
    ROUNDDOWN: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), n = a.length > 1 ? toNum(a[1]) : 0; if (isErr(x)) return x; if (isErr(n)) return n; const f = Math.pow(10, Math.trunc(n)); return Math.sign(x) * Math.floor(+(Math.abs(x) * f).toPrecision(15)) / f; },
    INT: a => num1(a, Math.floor),
    ABS: a => num1(a, Math.abs),
    SQRT: a => num1(a, x => x < 0 ? E('#NUM!') : Math.sqrt(x)),
    EXP: a => num1(a, Math.exp),
    LN: a => num1(a, x => x <= 0 ? E('#NUM!') : Math.log(x)),
    LOG10: a => num1(a, x => x <= 0 ? E('#NUM!') : Math.log10(x)),
    LOG: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), b = a.length > 1 ? toNum(a[1]) : 10; if (isErr(x)) return x; if (isErr(b)) return b; if (x <= 0 || b <= 0 || b === 1) return E('#NUM!'); return b === 10 ? Math.log10(x) : b === 2 ? Math.log2(x) : +(Math.log(x) / Math.log(b)).toPrecision(15); },
    SIN: a => num1(a, Math.sin), COS: a => num1(a, Math.cos), TAN: a => num1(a, Math.tan),
    ASIN: a => num1(a, x => Math.abs(x) > 1 ? E('#NUM!') : Math.asin(x)), ACOS: a => num1(a, x => Math.abs(x) > 1 ? E('#NUM!') : Math.acos(x)), ATAN: a => num1(a, Math.atan),
    RADIANS: a => num1(a, x => x * Math.PI / 180), DEGREES: a => num1(a, x => x * 180 / Math.PI),
    PI: a => need(a, 0, 0) || Math.PI,
    POWER: a => { const e = need(a, 2, 2); if (e) return e; const x = toNum(a[0]), y = toNum(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; const r = Math.pow(x, y); return Number.isFinite(r) ? r : (x === 0 && y < 0 ? E('#DIV/0!') : E('#NUM!')); },
    MOD: a => { const e = need(a, 2, 2); if (e) return e; const x = toNum(a[0]), y = toNum(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; if (y === 0) return E('#DIV/0!'); return x - y * Math.floor(x / y); },
    LEN: a => { const e = need(a, 1, 1); if (e) return e; const s = toText(a[0]); return isErr(s) ? s : [...s].length; },
    UPPER: a => { const e = need(a, 1, 1); if (e) return e; const s = toText(a[0]); return isErr(s) ? s : s.toUpperCase(); },
    LOWER: a => { const e = need(a, 1, 1); if (e) return e; const s = toText(a[0]); return isErr(s) ? s : s.toLowerCase(); },
    TRIM: a => { const e = need(a, 1, 1); if (e) return e; const s = toText(a[0]); return isErr(s) ? s : s.trim().replace(/ {2,}/g, ' '); },
    LEFT: a => { const e = need(a, 1, 2); if (e) return e; const s = toText(a[0]), n = a.length > 1 ? toNum(a[1]) : 1; if (isErr(s)) return s; if (isErr(n)) return n; return n < 0 ? E('#VALUE!') : [...s].slice(0, Math.trunc(n)).join(''); },
    RIGHT: a => { const e = need(a, 1, 2); if (e) return e; const s = toText(a[0]), n = a.length > 1 ? toNum(a[1]) : 1; if (isErr(s)) return s; if (isErr(n)) return n; if (n < 0) return E('#VALUE!'); const c = [...s]; return Math.trunc(n) ? c.slice(-Math.trunc(n)).join('') : ''; },
    MID: a => { const e = need(a, 3, 3); if (e) return e; const s = toText(a[0]), st = toNum(a[1]), n = toNum(a[2]); if (isErr(s)) return s; if (isErr(st)) return st; if (isErr(n)) return n; if (st < 1 || n < 0) return E('#VALUE!'); return [...s].slice(Math.trunc(st) - 1, Math.trunc(st) - 1 + Math.trunc(n)).join(''); },
    CONCAT: a => { let s = ''; for (const v of flat(a)) { const t = toText(v); if (isErr(t)) return t; s += t; } return s; },
    TODAY: a => need(a, 0, 0) || Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000 - SERIAL0) / 86400000),
    NOW: a => need(a, 0, 0) || (Date.now() - new Date().getTimezoneOffset() * 60000 - SERIAL0) / 86400000,
    VLOOKUP: a => {
      const e = need(a, 3, 4); if (e) return e; let want = a[0]; if (want && want.range) want = want.range.length === 1 ? want.range[0] : E('#VALUE!'); if (isErr(want)) return want;
      const T = a[1] && a[1].table; if (!T) return E('#VALUE!'); const col = toNum(a[2]); if (isErr(col)) return col; if (col < 1) return E('#VALUE!'); if (col > T[0].length) return E('#REF!');
      const exact = a.length > 3 ? toBool(a[3] === null ? false : a[3]) === false : false;
      if (exact) { const f = typeof want === 'string' ? criteria(want) : v => v !== null && rank(v) === rank(want) && compare(v, want) === 0; const i = T.findIndex(row => f(row[0])); return i < 0 ? E('#N/A') : T[i][col - 1]; }
      let best = -1; for (let i = 0; i < T.length; i++) { const v = T[i][0]; if (v === null || rank(v) !== rank(want)) continue; if (compare(v, want) <= 0) best = i; else break; }
      return best < 0 ? E('#N/A') : T[best][col - 1];
    }
  };
  // statistics on pairs (SLOPE, INTERCEPT, CORREL, RSQ): two ranges of the same size; pairs where both are numbers
  function pairs(a, b) {
    const A = a && a.range ? a.range : [a], B = b && b.range ? b.range : [b]; if (A.length !== B.length) return E('#N/A');
    const x = [], y = []; for (let i = 0; i < A.length; i++) { if (isErr(A[i])) return A[i]; if (isErr(B[i])) return B[i]; if (typeof A[i] === 'number' && typeof B[i] === 'number') { x.push(A[i]); y.push(B[i]); } }
    if (!x.length) return E('#DIV/0!');
    const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return { mx, my, sxy, sxx, syy, n: x.length };
  }
  const tidy = v => typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(15) : v;
  const spread = (a, pop, root) => { const n = numbers(a); if (isErr(n)) return n; const k = pop ? n.length : n.length - 1; if (k < 1) return E('#DIV/0!'); const m = n.reduce((s, x) => s + x, 0) / n.length; const v = n.reduce((s, x) => s + (x - m) ** 2, 0) / k; return root ? Math.sqrt(v) : v; };
  const kth = (a, big) => { const e = need(a, 2, 2); if (e) return e; const n = numbers([a[0]]); if (isErr(n)) return n; const k = toNum(a[1]); if (isErr(k)) return k; const i = Math.ceil(k); if (i < 1 || i > n.length) return E('#NUM!'); return n.slice().sort((x, y) => big ? y - x : x - y)[i - 1]; };
  function ifs(a, from) {   // COUNTIFS-like pairs from a[from]: [range, criteria]…; → which positions every one accepts
    if ((a.length - from) < 2 || (a.length - from) % 2) return E('#VALUE!'); let len = -1; const tests = [];
    for (let i = from; i < a.length; i += 2) { const R = a[i] && a[i].range ? a[i].range : [a[i]]; if (len >= 0 && R.length !== len) return E('#VALUE!'); len = R.length; tests.push([R, criteria(a[i + 1])]); }
    const hit = []; for (let k = 0; k < len; k++) hit.push(tests.every(([R, f]) => f(R[k]))); return hit;
  }
  function fixedRound(x, sig, up) { if (sig === 0) return 0; if (x > 0 && sig < 0) return E('#NUM!'); const q = +(x / sig).toPrecision(15); return +((up ? Math.ceil(q) : Math.floor(q)) * sig).toPrecision(15); }
  const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  Object.assign(FUNCS, {
    'STDEV.S': a => spread(a, false, true), 'STDEV.P': a => spread(a, true, true), 'VAR.S': a => spread(a, false, false), 'VAR.P': a => spread(a, true, false),
    SLOPE: a => { const e = need(a, 2, 2); if (e) return e; const p = pairs(a[1], a[0]); if (isErr(p)) return p; return p.sxx === 0 ? E('#DIV/0!') : tidy(p.sxy / p.sxx); },
    INTERCEPT: a => { const e = need(a, 2, 2); if (e) return e; const p = pairs(a[1], a[0]); if (isErr(p)) return p; return p.sxx === 0 ? E('#DIV/0!') : tidy(p.my - (p.sxy / p.sxx) * p.mx); },
    CORREL: a => { const e = need(a, 2, 2); if (e) return e; const p = pairs(a[0], a[1]); if (isErr(p)) return p; const d = Math.sqrt(p.sxx * p.syy); return d === 0 ? E('#DIV/0!') : tidy(p.sxy / d); },
    RSQ: a => { const e = need(a, 2, 2); if (e) return e; const p = pairs(a[1], a[0]); if (isErr(p)) return p; const d = p.sxx * p.syy; return d === 0 ? E('#DIV/0!') : tidy(p.sxy * p.sxy / d); },
    LARGE: a => kth(a, true), SMALL: a => kth(a, false),
    RANK: a => { const e = need(a, 2, 3); if (e) return e; const x = toNum(a[0]); if (isErr(x)) return x; const n = numbers([a[1]]); if (isErr(n)) return n; if (!n.includes(x)) return E('#N/A'); const asc = a.length > 2 && a[2] !== null && toNum(a[2]) !== 0; return 1 + n.filter(v => asc ? v < x : v > x).length; },
    SUMPRODUCT: a => { if (!a.length) return E('#VALUE!'); const L = a.map(x => x && x.range ? x.range : [x]); if (L.some(l => l.length !== L[0].length)) return E('#VALUE!'); let s = 0; for (let i = 0; i < L[0].length; i++) { let p = 1; for (const l of L) { const v = l[i]; if (isErr(v)) return v; p *= typeof v === 'number' ? v : 0; } s += p; } return s; },
    SUMSQ: a => { const n = numbers(a); return isErr(n) ? n : n.reduce((s, x) => s + x * x, 0); },
    COUNTIFS: a => { const h = ifs(a, 0); return isErr(h) ? h : h.filter(Boolean).length; },
    SUMIFS: a => { const S = a[0] && a[0].range ? a[0].range : [a[0]]; const h = ifs(a, 1); if (isErr(h)) return h; if (h.length !== S.length) return E('#VALUE!'); let s = 0; h.forEach((ok, i) => { if (ok && typeof S[i] === 'number') s += S[i]; }); return s; },
    AVERAGEIFS: a => { const S = a[0] && a[0].range ? a[0].range : [a[0]]; const h = ifs(a, 1); if (isErr(h)) return h; if (h.length !== S.length) return E('#VALUE!'); let s = 0, n = 0; h.forEach((ok, i) => { if (ok && typeof S[i] === 'number') { s += S[i]; n++; } }); return n ? s / n : E('#DIV/0!'); },
    INDEX: a => { const e = need(a, 2, 3); if (e) return e; const T = a[0] && a[0].table; if (!T) return a.length === 2 && toNum(a[1]) === 1 ? a[0] : E('#VALUE!'); let r = toNum(a[1]), c = a.length > 2 && a[2] !== null ? toNum(a[2]) : null; if (isErr(r)) return r; if (isErr(c)) return c; if (c === null) { if (T.length === 1) { c = r; r = 1; } else c = 1; } r = Math.trunc(r); c = Math.trunc(c); if (r < 1 || c < 1 || r > T.length || c > T[0].length) return E('#REF!'); return T[r - 1][c - 1]; },
    MATCH: a => { const e = need(a, 2, 3); if (e) return e; let want = a[0]; if (want && want.range) want = want.range.length === 1 ? want.range[0] : E('#VALUE!'); if (isErr(want)) return want; const T = a[1] && a[1].table; if (!T || (T.length > 1 && T[0].length > 1)) return E('#N/A'); const L = T.length === 1 ? T[0] : T.map(r => r[0]); const type = a.length > 2 && a[2] !== null ? toNum(a[2]) : 1; if (isErr(type)) return type;
      if (type === 0) { const f = typeof want === 'string' ? criteria(want) : v => v !== null && rank(v) === rank(want) && compare(v, want) === 0; const i = L.findIndex(f); return i < 0 ? E('#N/A') : i + 1; }
      let best = -1; for (let i = 0; i < L.length; i++) { const v = L[i]; if (v === null || rank(v) !== rank(want)) continue; const d = compare(v, want); if (type > 0 ? d <= 0 : d >= 0) best = i; else break; } return best < 0 ? E('#N/A') : best + 1; },
    HLOOKUP: a => { const e = need(a, 3, 4); if (e) return e; const T = a[1] && a[1].table; if (!T) return E('#VALUE!'); const tt = T[0].map((_, c) => T.map(r => r[c])); return FUNCS.VLOOKUP([a[0], { table: tt, range: [] }, a[2], a.length > 3 ? a[3] : true]); },
    DATE: a => { const e = need(a, 3, 3); if (e) return e; let [y, m, d] = a.map(toNum); for (const v of [y, m, d]) if (isErr(v)) return v; y = Math.trunc(y); if (y >= 0 && y < 1900) y += 1900; if (y < 1900 || y > 9999) return E('#NUM!'); const ms = Date.UTC(y, Math.trunc(m) - 1, Math.trunc(d)); const n = Math.round((ms - SERIAL0) / 86400000); return n < 1 ? E('#NUM!') : n; },
    YEAR: a => num1(a, x => x < 0 ? E('#NUM!') : dateOf(x).getUTCFullYear()), MONTH: a => num1(a, x => x < 0 ? E('#NUM!') : dateOf(x).getUTCMonth() + 1), DAY: a => num1(a, x => x < 0 ? E('#NUM!') : dateOf(x).getUTCDate()),
    WEEKDAY: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]); if (isErr(x)) return x; if (x < 0) return E('#NUM!'); const w = dateOf(x).getUTCDay(); const t = a.length > 1 ? toNum(a[1]) : 1; return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; },
    DAYS: a => { const e = need(a, 2, 2); if (e) return e; const x = toNum(a[0]), y = toNum(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; return Math.floor(x) - Math.floor(y); },
    ISBLANK: a => need(a, 1, 1) || a[0] === null, ISNUMBER: a => need(a, 1, 1) || typeof a[0] === 'number', ISTEXT: a => need(a, 1, 1) || typeof a[0] === 'string', ISLOGICAL: a => need(a, 1, 1) || typeof a[0] === 'boolean', ISERROR: a => need(a, 1, 1) || isErr(a[0]),
    NA: a => need(a, 0, 0) || E('#N/A'), TRUE: a => need(a, 0, 0) || true, FALSE: a => need(a, 0, 0) || false,
    VALUE: a => { const e = need(a, 1, 1); if (e) return e; if (isErr(a[0])) return a[0]; if (typeof a[0] === 'number') return a[0]; const v = literal(String(a[0] === null ? '0' : a[0])).v; return typeof v === 'number' ? v : E('#VALUE!'); },
    CEILING: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), s = a.length > 1 ? toNum(a[1]) : 1; if (isErr(x)) return x; if (isErr(s)) return s; return fixedRound(x, s, true); },
    FLOOR: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), s = a.length > 1 ? toNum(a[1]) : 1; if (isErr(x)) return x; if (isErr(s)) return s; return fixedRound(x, s, false); },
    TRUNC: a => { const e = need(a, 1, 2); if (e) return e; const x = toNum(a[0]), n = a.length > 1 ? toNum(a[1]) : 0; if (isErr(x)) return x; if (isErr(n)) return n; const f = Math.pow(10, Math.trunc(n)); return Math.trunc(+(x * f).toPrecision(15)) / f; },
    SIGN: a => num1(a, Math.sign),
    FACT: a => num1(a, x => x < 0 ? E('#NUM!') : x > 170 ? E('#NUM!') : fact(Math.trunc(x))),
    COMBIN: a => { const e = need(a, 2, 2); if (e) return e; const n = Math.trunc(toNum(a[0])), k = Math.trunc(toNum(a[1])); if (Number.isNaN(n) || Number.isNaN(k)) return E('#VALUE!'); if (n < 0 || k < 0 || k > n) return E('#NUM!'); let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); },
    PERMUT: a => { const e = need(a, 2, 2); if (e) return e; const n = Math.trunc(toNum(a[0])), k = Math.trunc(toNum(a[1])); if (Number.isNaN(n) || Number.isNaN(k)) return E('#VALUE!'); if (n < 0 || k < 0 || k > n) return E('#NUM!'); let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; }
  });
  FUNCS.STDEVP = FUNCS['STDEV.P']; FUNCS.VARP = FUNCS['VAR.P']; FUNCS['RANK.EQ'] = FUNCS.RANK; FUNCS.PEARSON = FUNCS.CORREL;
  FUNCS.CONCATENATE = FUNCS.CONCAT;
  const LAZY = {
    IF: (a, ev) => { if (a.length < 2 || a.length > 3) return E('#VALUE!'); const c = toBool(ev(a[0])); if (isErr(c)) return c; return c ? ev(a[1]) : a.length > 2 ? ev(a[2]) : false; },
    IFERROR: (a, ev) => { if (a.length !== 2) return E('#VALUE!'); const v = ev(a[0]); return isErr(v) ? ev(a[1]) : v; },
    IFS: (a, ev) => { if (a.length < 2 || a.length % 2) return E('#VALUE!'); for (let i = 0; i < a.length; i += 2) { const c = toBool(ev(a[i])); if (isErr(c)) return c; if (c) return ev(a[i + 1]); } return E('#N/A'); },
    CHOOSE: (a, ev) => { if (a.length < 2) return E('#VALUE!'); const i = toNum(ev(a[0])); if (isErr(i)) return i; const k = Math.trunc(i); return k < 1 || k >= a.length ? E('#VALUE!') : ev(a[k]); }
  };
  /** Functions that take ranges as they are; the rest get one value per argument. */
  const RANGE_FNS = new Set(['SUM', 'PRODUCT', 'AVERAGE', 'MIN', 'MAX', 'MEDIAN', 'STDEV', 'VAR', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'SUMIF', 'AVERAGEIF', 'AND', 'OR', 'CONCAT', 'CONCATENATE', 'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH',
    'STDEV.S', 'STDEV.P', 'STDEVP', 'VAR.S', 'VAR.P', 'VARP', 'SLOPE', 'INTERCEPT', 'CORREL', 'PEARSON', 'RSQ', 'LARGE', 'SMALL', 'RANK', 'RANK.EQ', 'SUMPRODUCT', 'SUMSQ', 'COUNTIFS', 'SUMIFS', 'AVERAGEIFS']);
  /** Newer functions Excel writes with a _xlfn. prefix in its files (without it, Excel shows #NAME?). */
  const XLFN = new Set(['STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'RANK.EQ', 'CONCAT', 'DAYS', 'IFS']);
  const FUNCTION_NAMES = Object.keys(FUNCS).concat(Object.keys(LAZY)).sort();

  /* ---------- a whole workbook ---------- */
  const TREES = new Map();   // formula text → its tree, kept across calculations (trees are never changed)
  function parsed(src) { let t = TREES.get(src); if (t) return t; try { t = parse(src); } catch (e) { t = { k: 'err', v: isErr(e) ? e.e : '#VALUE!' }; } if (TREES.size > 20000) TREES.clear(); TREES.set(src, t); return t; }
  /** Works out every cell of every sheet. book: { sheets: [{ name, cells: { A1: { v: raw } } }] }.
      Returns sheets → { A1: value } (formulas' results), with every cell that has something in it. */
  function evaluate(book) {
    const sheets = book.sheets || []; const byName = {}; sheets.forEach((s, i) => { byName[String(s.name).toLowerCase()] = i; });
    const out = sheets.map(() => ({})); const state = sheets.map(() => ({}));   // state: 1 working out, 2 done
    const trees = sheets.map(() => ({}));
    const sheetOf = (name, cur) => name == null ? cur : byName[String(name).toLowerCase()];
    function value(si, a) {
      const st = state[si][a]; if (st === 2) return out[si][a]; if (st === 1) return E('#CIRC!');
      const cell = (sheets[si].cells || {})[a]; if (!cell || cell.v == null || cell.v === '') { state[si][a] = 2; return (out[si][a] = null); }
      const raw = String(cell.v);
      if (raw[0] !== '=' || raw.length < 2) { state[si][a] = 2; return (out[si][a] = literal(raw).v); }
      state[si][a] = 1; let v;
      try { const t = trees[si][a] || (trees[si][a] = parsed(raw.slice(1))); v = ev(t, si); if (v && v.range) v = v.range.length === 1 ? v.range[0] : E('#VALUE!'); if (v && v.table) v = E('#VALUE!'); }
      catch (e) { v = isErr(e) ? e : E('#VALUE!'); }
      if (typeof v === 'number' && !Number.isFinite(v)) v = E('#NUM!');
      if (isErr(v) && v.e === '#NAME?' && cell.c !== undefined) v = cell.c;   // a function Excel has and this does not: the value the file came with
      if (v === null) v = 0;   // a formula pointing at an empty cell shows 0, as in Excel
      state[si][a] = 2; out[si][a] = v; return v;
    }
    function ev(n, si) {
      switch (n.k) {
        case 'num': case 'str': case 'bool': return n.v;
        case 'err': return E(n.v);
        case 'blank': return null;
        case 'ref': { const s = sheetOf(n.sheet, si); if (s === undefined) return E('#REF!'); return value(s, addr(n.c, n.r)); }
        case 'range': {
          const s = sheetOf(n.sheet, si); if (s === undefined) return E('#REF!');
          if ((n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1) > 200000) return E('#NUM!');
          const vals = [], table = [];
          for (let r = n.r1; r <= n.r2; r++) { const row = []; for (let c = n.c1; c <= n.c2; c++) { const v = value(s, addr(c, r)); row.push(v); vals.push(v); } table.push(row); }
          return { range: vals, table };
        }
        case 'neg': { const x = toNum(single(ev(n.a, si))); return isErr(x) ? x : -x; }
        case 'pct': { const x = toNum(single(ev(n.a, si))); return isErr(x) ? x : x / 100; }
        case 'bin': {
          const a = single(ev(n.a, si)), b = single(ev(n.b, si));
          if (n.op === '&') { const x = toText(a), y = toText(b); if (isErr(x)) return x; if (isErr(y)) return y; return x + y; }
          if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) { if (isErr(a)) return a; if (isErr(b)) return b; const d = compare(a, b); return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[n.op]; }
          const x = toNum(a), y = toNum(b); if (isErr(x)) return x; if (isErr(y)) return y;
          switch (n.op) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? E('#DIV/0!') : x / y; case '^': { if (x === 0 && y < 0) return E('#DIV/0!'); const r = Math.pow(x, y); return Number.isNaN(r) ? E('#NUM!') : r; } }
          return E('#VALUE!');
        }
        case 'call': {
          if (LAZY[n.name]) return LAZY[n.name](n.args, x => single(ev(x, si)));
          const f = FUNCS[n.name]; if (!f) return E('#NAME?');
          const args = n.args.map(x => ev(x, si));
          return f(RANGE_FNS.has(n.name) ? args : args.map(single));
        }
      }
      return E('#VALUE!');
    }
    const single = v => v && v.range ? (v.range.length === 1 ? v.range[0] : E('#VALUE!')) : v;
    sheets.forEach((s, si) => Object.keys(s.cells || {}).forEach(a => value(si, a)));
    return out;
  }

  /* ---------- formulas that move ---------- */
  /** Rewrites each reference in a formula: fn({ sheet, c, r, absC, absR, end }) → { c, r } or null (#REF!); end: 0 a single
      cell, 1 the first corner of a range, 2 the last. A range whose corners cross becomes #REF!. Text in quotes is untouched. */
  function mapRefs(formula, fn) {
    if (formula[0] !== '=') return formula; let T; try { T = tokenize(formula.slice(1)); } catch (e) { return formula; }
    let out = '=', at = 1;
    for (const t of T) {
      if (t.t !== 'ref') continue;
      out += formula.slice(at, t.at + 1);
      const one = (s, end) => { const m = /^(\$?)([A-Za-z]{1,2})(\$?)(\d{1,5})$/.exec(s); const r = fn({ sheet: t.sheet, c: colIndex(m[2]), r: +m[4] - 1, absC: !!m[1], absR: !!m[3], end }); return r && r.c >= 0 && r.r >= 0 && r.c < MAX_COL && r.r < MAX_ROW ? { s: m[1] + colName(r.c) + m[3] + (r.r + 1), c: r.c, r: r.r } : null; };
      const pre = formula.slice(t.at + 1, t.end + 1).replace(/(\$?[A-Za-z]{1,2}\$?\d{1,5})(?::(\$?[A-Za-z]{1,2}\$?\d{1,5}))?$/, '');
      const a = one(t.a, t.b ? 1 : 0), b = t.b ? one(t.b, 2) : null;
      const bad = !a || (t.b && (!b || b.c < a.c || b.r < a.r));
      out += bad ? '#REF!' : pre + a.s + (t.b ? ':' + b.s : '');
      at = t.end + 1;
    }
    return out + formula.slice(at);
  }
  /** A formula copied dr rows down and dc columns across: relative references move with it. */
  const translate = (formula, dr, dc) => mapRefs(formula, x => ({ c: x.absC ? x.c : x.c + dc, r: x.absR ? x.r : x.r + dr }));
  /** Rows (axis 'r') or columns ('c') inserted (n > 0) or deleted (n < 0) at index i, on sheet `sheet` (null: the formula's own):
      references past them move; references into deleted ones become #REF!. `here`: the name of the sheet the formula is on. */
  const shift = (formula, axis, i, n, sheet, here) => mapRefs(formula, x => {
    const target = x.sheet == null ? here : x.sheet; if (String(target).toLowerCase() !== String(sheet).toLowerCase()) return { c: x.c, r: x.r };
    const k = axis === 'r' ? x.r : x.c; let v = k;
    if (n > 0 && k >= i) v = k + n;
    else if (n < 0) {
      if (k >= i && k < i - n) { if (x.end === 0) return null; v = x.end === 1 ? i : i - 1; }   // a range's corner in what was deleted: the range shrinks
      else if (k >= i - n) v = k + n;
    }
    return axis === 'r' ? { c: x.c, r: v } : { c: v, r: x.r };
  });

  /** Function names in a formula rewritten (text in quotes untouched): fn(NAME) → the name to write. */
  function mapFns(formula, fn) { let T; try { T = tokenize(formula); } catch (e) { return formula; } let out = '', at = 0; for (const t of T) { if (t.t !== 'fn') continue; out += formula.slice(at, t.at) + fn(formula.slice(t.at, t.end).toUpperCase()); at = t.end; } return out + formula.slice(at); }
  /** A cell's formula as an .xlsx keeps it (no "=", newer functions with _xlfn.), and back. */
  const toFile = f => mapFns(f.slice(1), n => XLFN.has(n) ? '_xlfn.' + n : n);
  const fromFile = f => '=' + String(f).replace(/_xlfn\.|_xlws\./gi, '');

  /* ---------- showing a value ---------- */
  /** A value as the cell shows it, in its format: gen (General), num (1,234.50), int (1,235), pct (12.5%), usd ($1,234.50), date. */
  function show(v, fmt) {
    if (v === null) return ''; if (isErr(v)) return v.e; if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; if (typeof v === 'string') return v;
    const nf = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    switch (fmt) {
      case 'num': return nf(v, 2);
      case 'int': return nf(Math.round(v), 0);
      case 'pct': { const p = v * 100; return (Number.isInteger(+p.toFixed(6)) ? nf(p, 0) : nf(p, Math.min(4, Math.max(1, (String(+p.toFixed(4)).split('.')[1] || '').length)))) + '%'; }
      case 'usd': return (v < 0 ? '-$' : '$') + nf(Math.abs(v), 2);
      case 'date': { if (v < 0 || v > 2958465) return '#NUM!'; const d = new Date(SERIAL0 + Math.round(v * 86400000)); return d.toISOString().slice(0, 10); }
    }
    return general(v);
  }

  /** The format a cell shows in: its own, or the one what was typed suggests ($12 → currency, 50% → percent, a date). */
  const fmtOf = cell => !cell ? '' : (cell.s && cell.s.fmt) || (typeof cell.v === 'string' && cell.v[0] !== '=' && cell.v[0] !== "'" ? literal(cell.v).fmt || '' : '');
  App.Formula = { fmtOf, colName, colIndex, addr, parseAddr, literal, parse, tokenize, evaluate, translate, shift, show, general, isErr, dayNumber, toFile, fromFile, FUNCTION_NAMES, MAX_COL, MAX_ROW, SERIAL0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = App.Formula;
})(typeof window !== 'undefined' ? window : globalThis);
