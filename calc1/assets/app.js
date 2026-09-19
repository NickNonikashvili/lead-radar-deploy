/* ============================================================
   MatHub — application shell
   Multi-course: each course is a data module registered on
   window.Courses (calc, physics, precalc). This file provides utilities,
   per-course storage, the math parser, routing (#/course/view/param),
   the landing page, layout, search, pomodoro and the reference views.
   Tool views live in tools.js (shared), calc-tools.js, physics-tools.js,
   precalc-tools.js. Accounts and preview gating live in auth.js.
   ============================================================ */
(function (global) {
  'use strict';
  const BUILD = global.MATHUB_BUILD || 'dev';
  const Courses = global.Courses || (global.Courses = {});
  const COURSE_ORDER = ['calc', 'physics', 'precalc'];
  const GLOBAL_VIEWS = ['contact', 'forum', 'policy'];   // pages that work without a course, e.g. #/contact
  const SITE = 'MatHub';
  let D = null, QZ = null;        // current course data and quiz module
  const courseHooks = [];

  /* ---------- tiny DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Delegated handlers. Re-binding the same root replaces the handler map instead of stacking listeners.
  function bind(root, map) {
    root.__actions = map;
    if (!root.__boundClick) {
      root.__boundClick = true;
      root.addEventListener('click', e => { const el = e.target.closest('[data-action]'); if (!el || !root.contains(el)) return; const fn = root.__actions && root.__actions[el.dataset.action]; if (fn) fn(el, e); });
    }
  }
  function on(root, evt, sel, fn) {
    root.__on = root.__on || {}; const key = evt + '|' + sel; root.__on[key] = fn; root.__onBound = root.__onBound || {};
    if (!root.__onBound[key]) { root.__onBound[key] = true; root.addEventListener(evt, e => { const el = e.target.closest(sel); if (el && root.contains(el)) root.__on[key](el, e); }); }
  }
  function toast(msg, ms = 1800) { $$('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }

  /* ---------- icons ---------- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>', sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
    cards: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/>', list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>', chart: '<path d="M3 20h18"/><path d="M4 16c3-2 5-8 8-8s4 6 8 3"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5L20 7"/>', play: '<path d="M7 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M6 11l6 6 6-6"/><path d="M4 21h16"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    right: '<path d="M9 6l6 6-6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    fire: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1 .3-2 1-3 0 2 1 3 2 3 0-3-1-5 1-9z"/>', external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', zoomin: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>', zoomout: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>', up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>', reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 7 7v4"/>',
    pin: '<path d="M12 17v5"/><path d="M8 3h8l-1 7 3 3H6l3-3z"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', canvas: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14l3 3 5-5"/>', wifi_off: '<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01"/><path d="M3 3l18 18"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', swap: '<path d="M7 16V4M7 4L3 8M7 4l4 4"/><path d="M17 8v12M17 20l4-4M17 20l-4-4"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- storage: one bucket per course, one global bucket ---------- */
  const readJSON = key => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } };
  const writeJSON = (key, obj) => { try { localStorage.setItem(key, JSON.stringify(obj)); } catch { /* storage unavailable */ } };
  const storeKey = id => 'studyhub-' + id;
  const store = {
    id: null, data: {},
    load(id) {
      this.id = id;
      if (id === 'calc' && !localStorage.getItem(storeKey('calc')) && localStorage.getItem('m171-study-v1')) { writeJSON(storeKey('calc'), readJSON('m171-study-v1')); }
      this.data = readJSON(storeKey(id));
    },
    get(k, def) { return (k in this.data) ? this.data[k] : def; },
    set(k, v) { this.data[k] = v; writeJSON(storeKey(this.id), this.data); if (global.App && global.App.auth) global.App.auth.noteWrite(this.id); },
    replace(id, data) { data = data && typeof data === 'object' ? data : {}; writeJSON(storeKey(id), data); if (this.id === id) this.data = data; },
    exportJSON() { return JSON.stringify({ course: this.id, data: this.data, settings: readJSON('studyhub-settings') }, null, 2); },
    importJSON(txt) { const obj = JSON.parse(txt); if (!obj || typeof obj !== 'object') throw new Error('Not a valid export'); const data = obj.data && typeof obj.data === 'object' ? obj.data : obj; this.data = data; writeJSON(storeKey(this.id), data); if (obj.settings) writeJSON('studyhub-settings', obj.settings); if (global.App && global.App.auth) global.App.auth.noteWrite(this.id); },
    reset() { this.data = {}; try { localStorage.removeItem(storeKey(this.id)); } catch {} if (global.App && global.App.auth) global.App.auth.noteWrite(this.id); },
    peek(id) { return readJSON(storeKey(id)); }
  };
  const settings = () => Object.assign({ theme: 'system' }, readJSON('studyhub-settings'));
  const setSetting = (k, v) => { const s = settings(); s[k] = v; writeJSON('studyhub-settings', s); };
  const courseSetting = (courseId, k, def) => { const s = settings(); return (s[courseId] && k in s[courseId]) ? s[courseId][k] : def; };
  const setCourseSetting = (courseId, k, v) => { const s = settings(); s[courseId] = Object.assign({}, s[courseId], { [k]: v }); writeJSON('studyhub-settings', s); };

  /* ---------- dates ---------- */
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parseISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const asOf = () => { const v = settings().asof; return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };
  const today = () => { const ov = asOf(); const d = ov ? parseISO(ov) : new Date(); d.setHours(0, 0, 0, 0); return d; };
  const todayISO = () => toISO(today());
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const fmtDate = (iso, long = false) => { const d = parseISO(iso); return long ? `${DOW[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()}` : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; };
  const shortDate = iso => { const d = parseISO(iso); return `${MON[d.getMonth()]} ${d.getDate()}`; };
  const relDays = n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? `${-n} day${n === -1 ? '' : 's'} ago` : `in ${n} days`;

  /* ---------- MathJax ---------- */
  function typeset(el) {
    if (!el) return; const MJ = global.MathJax;
    if (MJ && MJ.typesetPromise) MJ.typesetPromise([el]).catch(() => {});
    else if (MJ && MJ.startup && MJ.startup.promise) MJ.startup.promise.then(() => MJ.typesetPromise([el])).catch(() => {});
  }

  /* ---------- expression parser (x or t; + - * / ^; implicit multiplication; functions; e, pi; scientific notation) ---------- */
  const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, sqrt: Math.sqrt, abs: Math.abs, cbrt: Math.cbrt, floor: Math.floor, ceil: Math.ceil };
  const CONST = { e: Math.E, pi: Math.PI };
  const NAMES = Object.keys(FUN).concat(Object.keys(CONST), ['x', 't']).sort((a, b) => b.length - a.length);
  function compileExpr(src) {
    const s = String(src || '').replace(/\s+/g, '').replace(/π/g, 'pi').replace(/−/g, '-').replace(/\*\*/g, '^').replace(/×/g, '*').replace(/÷/g, '/');
    if (!s) throw new Error('Enter an expression.');
    let i = 0, absDepth = 0;
    const peek = () => s[i]; const isDigit = c => c >= '0' && c <= '9'; const isAlpha = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    const expect = c => { if (s[i] !== c) throw new Error(`Expected "${c}" at position ${i + 1}.`); i++; };
    function parseExpr() { let l = parseTerm(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = parseTerm(); const L = l; l = op === '+' ? x => L(x) + r(x) : x => L(x) - r(x); } return l; }
    function parseTerm() { let l = parseUnary(); for (;;) { const c = peek(); if (c === '*' || c === '/') { i++; const r = parseUnary(); const L = l; l = c === '*' ? x => L(x) * r(x) : x => L(x) / r(x); } else if (c && (isDigit(c) || isAlpha(c) || c === '(' || (c === '|' && absDepth === 0))) { const r = parseUnary(); const L = l; l = x => L(x) * r(x); } else break; } return l; }
    function parseUnary() { if (peek() === '-') { i++; const r = parseUnary(); return x => -r(x); } if (peek() === '+') { i++; return parseUnary(); } return parsePower(); }
    function parsePower() { const base = parseAtom(); if (peek() === '^') { i++; const ex = parseUnary(); return x => Math.pow(base(x), ex(x)); } return base; }
    function parseAtom() {
      const c = peek(); if (c === undefined) throw new Error('Unexpected end of expression.');
      if (isDigit(c) || c === '.') {
        let j = i; while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
        if ((s[j] === 'e' || s[j] === 'E') && (isDigit(s[j + 1]) || ((s[j + 1] === '-' || s[j + 1] === '+') && isDigit(s[j + 2])))) { j++; if (s[j] === '-' || s[j] === '+') j++; while (j < s.length && isDigit(s[j])) j++; }
        const v = parseFloat(s.slice(i, j)); if (isNaN(v)) throw new Error('Bad number.'); i = j; return () => v;
      }
      if (c === '(') { i++; const e = parseExpr(); expect(')'); return e; }
      if (c === '|') { i++; absDepth++; const e = parseExpr(); absDepth--; expect('|'); return x => Math.abs(e(x)); }
      if (isAlpha(c)) {
        const name = NAMES.find(n => s.startsWith(n, i));
        if (!name) { let j = i; while (j < s.length && isAlpha(s[j])) j++; throw new Error(`Unknown symbol "${s.slice(i, j)}".`); }
        i += name.length;
        if (FUN[name]) { const F = FUN[name]; let arg; if (peek() === '(') { i++; arg = parseExpr(); expect(')'); } else arg = parseUnary(); return x => F(arg(x)); }
        if (name in CONST) { const v = CONST[name]; return () => v; }
        return x => x;
      }
      throw new Error(`Unexpected "${c}" at position ${i + 1}.`);
    }
    const fn = parseExpr(); if (i < s.length) throw new Error(`Unexpected "${s[i]}" at position ${i + 1}.`);
    return x => { const v = fn(x); return typeof v === 'number' ? v : NaN; };
  }
  const d1 = (f, x, hh = 1e-5) => (f(x + hh) - f(x - hh)) / (2 * hh);
  const d2 = (f, x, hh = 1e-4) => (f(x + hh) - 2 * f(x) + f(x - hh)) / (hh * hh);
  function parseNumber(str) { const t = String(str || '').trim(); if (!t) return NaN; try { return compileExpr(t)(0); } catch { return NaN; } }
  const fmtNum = (x, p = 4) => { if (!isFinite(x)) return '—'; const r = Math.round(x * 10 ** p) / 10 ** p; return String(r); };

  /* ---------- canvas helpers ---------- */
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function fitCanvas(c) { const dpr = window.devicePixelRatio || 1; const r = c.getBoundingClientRect(); const W = Math.max(50, Math.round(r.width)), H = Math.max(50, Math.round(r.height)); if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, W, H }; }
  const niceStep = range => { const raw = range / 8; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

  /* ---------- progress ---------- */
  function progress() { return store.get('progress', {}); }
  function recordAnswer(topic, ok) {
    const p = progress(); const t = p[topic] || { a: 0, c: 0 }; t.a++; if (ok) t.c++; p[topic] = t; store.set('progress', p);
    const hist = store.get('history', []); hist.push({ t: topic, ok, d: todayISO(), k: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); if (hist.length > 500) hist.splice(0, hist.length - 500); store.set('history', hist); markActivity();
  }
  function markActivity() { const days = store.get('activity', {}); days[todayISO()] = true; store.set('activity', days); }
  function streakOf(data) { const days = data.activity || {}; let n = 0; let d = today(); if (!days[toISO(d)]) d = addDays(d, -1); while (days[toISO(d)]) { n++; d = addDays(d, -1); } return n; }
  const streak = () => streakOf(store.data);
  function unitMastery(unit) { const p = progress(); const topics = QZ.topicsForUnits([unit]); let a = 0, c = 0; topics.forEach(t => { if (p[t]) { a += p[t].a; c += p[t].c; } }); return { a, c, pct: a ? Math.round(100 * c / a) : 0 }; }
  function cardsMastered(unit) { const fc = store.get('flashcards', {}); const cards = D.FLASHCARDS.filter(c => !unit || c.unit === unit); return { total: cards.length, mastered: cards.filter(c => (fc[c.id] || 0) >= 3).length }; }
  function checklistState(examId) { const items = D.CHECKLISTS[examId] || []; const st = store.get('checklists', {})[examId] || {}; return { items, done: items.filter((_, i) => st[i]).length }; }

  /* ---------- course helpers (take a course object so the landing can use any course) ---------- */
  const eventsOn = (C, iso) => C.CALENDAR.filter(e => e[0] === iso);
  const isHoliday = (C, iso) => eventsOn(C, iso).some(e => e[1] === 'holiday');
  const inSemester = (C, iso) => iso >= C.SEMESTER.start && iso <= C.SEMESTER.end;
  function nextExam(C) { const t = todayISO(); return C.EXAMS.find(e => (e.endDate || e.date) >= t) || null; }
  function examStatus(ex) { const t = todayISO(); const n = daysBetween(t, ex.date); if (n > 0) return { n, big: String(n), label: n === 1 ? 'day to go' : 'days to go', chip: n === 1 ? 'tomorrow' : `${n} days` }; if (ex.endDate && t <= ex.endDate) return { n: 0, big: 'This week', label: ex.dateLabel || 'exam week', chip: 'this week' }; if (n === 0) return { n: 0, big: 'Today', label: 'exam day', chip: 'today' }; return { n, big: 'Done', label: 'exam over', chip: 'done' }; }
  function currentSection(C) { const t = todayISO(); const lec = C.CALENDAR.filter(e => e[1] === 'lecture' && e[3] && e[0] <= t).pop(); const id = lec ? lec[3] : (C.SECTIONS[0] && C.SECTIONS[0].id); return C.SECTIONS.find(s => s.id === id) || C.SECTIONS[0]; }
  function upcomingDeadlines(C, count = 6) {
    const items = []; const start = today(); const labDow = courseSetting(C.id, 'labDay', 'tue') === 'thu' ? 4 : 2;
    for (let k = 0; k < 28; k++) {
      const d = addDays(start, k), iso = toISO(d), dow = d.getDay(); if (!inSemester(C, iso)) continue; const hol = isHoliday(C, iso);
      (C.RECURRING || []).forEach(r => {
        if (r.quiet) return; if (r.from && iso < r.from) return; if (r.skipHolidays && hol) return; if (r.skipIfAdmin && eventsOn(C, iso).some(e => e[1] === 'admin' && /due/i.test(e[2]))) return;
        if (r.dows && r.dows.includes(dow)) items.push({ date: iso, time: r.time, title: r.title, type: 'recurring' });
        if (r.afterLabDay && dow === labDow + 1 && !isHoliday(C, toISO(addDays(d, -1)))) items.push({ date: iso, time: r.time, title: r.title, type: 'recurring' });
      });
      eventsOn(C, iso).filter(e => e[1] === 'exam' || e[1] === 'admin').forEach(e => items.push({ date: iso, time: e[1] === 'exam' ? '' : '', title: e[2], type: e[1] }));
    }
    const cv = Canvas.data && Canvas.data.configured ? Canvas.events(C.id, toISO(start), 28) : [];
    if (cv.length) { const real = cv.map(e => ({ date: e.date, time: e.time, title: e.title, type: 'canvas', url: e.url })); const keep = items.filter(x => x.type !== 'recurring'); items.length = 0; items.push(...keep, ...real); }
    const seen = new Set(); const uniq = items.filter(x => { const k = x.date + '|' + x.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.sort((a, b) => a.date.localeCompare(b.date)); return uniq.slice(0, count);
  }
  function semesterState(C) {
    const t = todayISO(); const S = C.SEMESTER;
    if (t < S.start) return { phase: 'before', days: daysBetween(t, S.start), week: 0 };
    if (t > S.end) return { phase: 'after', days: daysBetween(S.end, t), week: Math.floor(daysBetween(S.start, S.end) / 7) + 1 };
    const finalEx = C.EXAMS[C.EXAMS.length - 1]; const finals = finalEx && finalEx.endDate && t >= finalEx.date && t <= finalEx.endDate;
    return { phase: finals ? 'finals' : 'during', week: Math.floor(daysBetween(S.start, t) / 7) + 1, weeks: Math.floor(daysBetween(S.start, S.end) / 7) + 1 };
  }
  const secById = id => D.SECTIONS.find(s => s.id === id);
  const secLabel = id => { const s = secById(id); return s ? s.label : ('§' + id); };
  const topicsForSection = secId => Object.keys(QZ.TOPICS).filter(t => QZ.TOPICS[t].sec === secId);

  /* ---------- Canvas feed + announcement (fetched once per session, cached 5 minutes) ---------- */
  const Canvas = {
    data: null, at: 0, pending: null,
    load() {
      if (this.data && Date.now() - this.at < 300000) return Promise.resolve(this.data);
      if (this.pending) return this.pending;
      this.pending = fetch('api/index.php?r=canvas', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub' } }).then(r => r.json()).then(j => { if (!j || j.ok === false) throw new Error((j && j.error) || 'unavailable'); this.data = j; this.at = Date.now(); return j; }).catch(() => { this.data = this.data || { configured: false, events: [], announcement: '' }; this.at = Date.now(); return this.data; }).finally(() => { this.pending = null; });
      return this.pending;
    },
    events(courseId, fromISO, days = 28) { const d = this.data; if (!d || !d.events) return []; const to = toISO(addDays(parseISO(fromISO), days)); return d.events.filter(e => (!courseId || e.course === courseId) && e.date >= fromISO && e.date <= to); },
    async fill(el, courseId, count = 6) {
      if (!el) return; const t = todayISO();
      try { await this.load(); } catch {}
      const d = this.data; if (!d || !d.configured) { el.innerHTML = ''; return; }
      const evs = this.events(courseId, t).slice(0, count);
      el.innerHTML = `<div class="panel canvas-panel"><div class="panel-h"><div class="panel-title">${icon('canvas')} From Canvas</div><span class="small muted">${d.error ? '<span style="color:var(--warn)">using the last copy</span>' : d.fetched ? `synced ${relTime(d.fetched)}` : ''}</span></div>
        ${evs.length ? evs.map(e => `<div class="today-ev"><span class="when">${daysBetween(t, e.date) === 0 ? 'Today' : daysBetween(t, e.date) === 1 ? 'Tomorrow' : esc(fmtDate(e.date))}</span><span>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}${e.time ? ` <span class="muted small">· ${esc(e.time)}</span>` : ''}${!courseId ? ` <span class="chip course-${esc(e.course)}" style="margin-left:6px">${esc((Courses[e.course] || { short: e.course }).short)}</span>` : ''}</div>`).join('') : `<div class="empty">Nothing on the Canvas calendar for the next ${days} days.</div>`}
        <p class="small muted mt-2">Real due dates from the instructor's Canvas calendar, refreshed hourly.</p></div>`;
    }
  };
  const relTime = ts => { const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  function paintAnnouncement(root) {
    Canvas.load().then(d => { const txt = (d && d.announcement || '').trim(); if (!txt) return; let dismissed = ''; try { dismissed = localStorage.getItem('mathub-ann-dismissed') || ''; } catch {} if (dismissed === txt) return; const host = $('#announcement-slot', root); if (!host) return; host.innerHTML = `<div class="announce"><span>${icon('flag', 14)} ${esc(txt)}</span><button class="icon-btn" data-action="ann-dismiss" aria-label="Dismiss">${icon('x', 14)}</button></div>`; on(host, 'click', '[data-action="ann-dismiss"]', () => { try { localStorage.setItem('mathub-ann-dismissed', txt); } catch {} host.innerHTML = ''; }); }).catch(() => {});
  }

  /* ---------- App object ---------- */
  const App = { views: {}, current: null, icon, esc, $, $$, bind, on, toast, store, settings, setSetting, courseSetting, setCourseSetting, typeset, compileExpr, d1, d2, parseNumber, fmtNum, cssVar, fitCanvas, niceStep,
    recordAnswer, markActivity, progress, streak, unitMastery, cardsMastered, checklistState, todayISO, toISO, parseISO, fmtDate, shortDate, addDays, daysBetween, relDays, examStatus, secLabel, secById, topicsForSection,
    nextExam: () => nextExam(D), currentSection: () => currentSection(D), upcomingDeadlines: n => upcomingDeadlines(D, n), eventsOn: iso => eventsOn(D, iso),
    onCourse(fn) { courseHooks.push(fn); if (D) fn(D); }, BUILD, SITE, COURSE_ORDER, asOf, semesterState: () => semesterState(D) };
  App.toggleTheme = () => toggleTheme();
  App.guest = () => !!(App.auth && App.auth.ready && !App.auth.user);
  App.limit = k => App.guest() && App.auth.limits && App.auth.limits[k] != null ? App.auth.limits[k] : Infinity;
  App.lockCard = (t, x, o) => App.auth ? App.auth.lockCard(t, x, o) : '';
  App.logoSvg = (size = 28) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mh-g${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B55B8"/><stop offset="1" stop-color="#0E7C86"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#mh-g${size})"/><path d="M15 46V21l17 17 17-17v25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="38" r="4.2" fill="#F2C14E"/><circle cx="15" cy="21" r="3.4" fill="#F2C14E"/><circle cx="49" cy="21" r="3.4" fill="#F2C14E"/></svg>`;
  Object.defineProperty(App, 'D', { get: () => D }); Object.defineProperty(App, 'Q', { get: () => QZ });
  App.Canvas = Canvas;
  App.link = (view, param, query) => { let hs = '#/' + (D ? D.id : 'calc') + '/' + view + (param ? '/' + param : ''); if (query) hs += '?' + new URLSearchParams(query).toString(); return hs; };
  App.go = (view, param, query) => { const hs = App.link(view, param, query); if (location.hash === hs) { render(); return; } try { location.hash = hs; } catch { render(); } };
  App.replaceHash = hs => { try { history.replaceState(null, '', hs); } catch {} };
  const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
  App.pageHead = pageHead;
  const L = App.link;

  /* ---------- course selection / routing ---------- */
  function setCourse(id) {
    if (D && D.id === id) return;
    D = Courses[id]; QZ = D.quiz; store.load(id);
    document.documentElement.setAttribute('data-course', id);
    Search.index = null; buildNav(); courseHooks.forEach(fn => { try { fn(D); } catch (e) { console.error(e); } });
    if (App.auth && App.auth.user) App.auth.pullCourse(id, true).catch(() => {});
  }
  function route() {
    const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const parts = path.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    if (!parts.length || !Courses[parts[0]]) return { course: null, view: GLOBAL_VIEWS.includes(parts[0]) ? parts[0] : 'home', param: parts.slice(1).join('/') || null, query };
    const view = parts[1] || 'dashboard';
    return { course: parts[0], view: App.views[view] ? view : 'dashboard', param: parts.slice(2).join('/') || null, query };
  }
  function render() {
    const { course, view, param, query } = route();
    if (App.current && App.current.unmount) { try { App.current.unmount(); } catch {} }
    const app = $('.app'); const stale = $('#view'); const root = stale.cloneNode(false); stale.replaceWith(root); window.scrollTo(0, 0);
    if (query.asof !== undefined) { setSetting('asof', /^\d{4}-\d{2}-\d{2}$/.test(query.asof) ? query.asof : ''); }
    if (!course) {
      app.classList.add('landing'); document.documentElement.removeAttribute('data-course');
      if (view !== 'home') { const V = App.views[view]; App.current = V; document.title = `${V.title} · ${SITE}`; V.render(root, param, query, true); applyTheme(); }
      else { App.current = Landing; document.title = `${SITE} · Fall 2026`; Landing.render(root); }
      typeset(root); if (App.auth) App.auth.bindLocks(root); return;
    }
    app.classList.remove('landing'); setCourse(course);
    const V = App.views[view]; App.current = V;
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#topbar-title').textContent = V.title; document.title = `${V.title} · ${D.code} · ${SITE}`;
    if (App.auth && App.auth.ready && App.auth.gate(view) === 'hard') App.auth.renderLocked(root, V, view); else V.render(root, param, query);
    if (App.auth) App.auth.bindLocks(root);
    typeset(root); app.classList.remove('nav-open'); updateExamChip(); paintAsOf();
  }
  App.rerender = () => render();
  function paintAsOf() {
    const ov = asOf(); let el = $('#asof-chip');
    if (!ov) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.id = 'asof-chip'; el.className = 'exam-chip asof'; el.dataset.action = 'asof-clear'; $('#topbar .topbar-actions').prepend(el); }
    el.innerHTML = `${icon('clock', 13)} <span>Viewing as ${esc(fmtDate(ov))}</span> <b>clear</b>`; el.title = 'You are previewing the site as of another date. Click to return to today.';
  }
  function updateExamChip() {
    const ex = nextExam(D); const chip = $('#exam-chip');
    if (!ex) { chip.innerHTML = `${icon('flag', 14)} <span>${semesterState(D).phase === 'after' ? 'Semester complete' : 'No exams left'}</span>`; return; }
    const st = examStatus(ex); chip.innerHTML = `${icon('flag', 14)} <span>${esc(ex.name)} ·</span> <b>${esc(st.chip)}</b>`;
  }
  function applyTheme() {
    const t = settings().theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('.theme-btn').forEach(b => b.innerHTML = icon(dark ? 'sun' : 'moon', 16));
  }
  function toggleTheme() { const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); setSetting('theme', isDark ? 'light' : 'dark'); applyTheme(); }
  function buildNav() {
    $('#brand-code').textContent = D.code; $('#brand-name').innerHTML = `${esc(D.name)}<small>${esc(D.term)}</small>`;
    $('#course-switch').innerHTML = COURSE_ORDER.filter(id => Courses[id]).map(id => `<a class="switch-btn${id === D.id ? ' on' : ''}" href="#/${id}/dashboard" title="${esc(Courses[id].name)}">${esc(Courses[id].short)}</a>`).join('') + `<a class="switch-btn home" href="#/" title="All courses">${icon('grid', 14)}</a>`;
    $('#sidebar-nav').innerHTML = D.NAV.map(gp => `<div class="nav-label">${gp.label}</div>` + gp.items.map(([id, label, ic]) => `<button class="nav-item" data-view="${id}" data-action="nav">${icon(ic)}<span>${label}</span></button>`).join('')).join('');
  }
  function buildLayout() {
    const app = $('.app');
    bind($('#sidebar'), { nav: el => App.go(el.dataset.view), 'pomo-toggle': () => Pomo.toggle(), 'pomo-reset': () => Pomo.reset(), 'pomo-mode': () => Pomo.switchMode() });
    bind($('#topbar'), { menu: () => app.classList.toggle('nav-open'), search: () => Search.open(), theme: toggleTheme, 'exam-chip': () => App.go('dashboard'), 'asof-clear': () => { setSetting('asof', ''); render(); toast('Back to today'); }, inbox: () => { if (App.auth && !App.auth.user) App.auth.open('login'); else App.go('forum', 'inbox'); } });
    $('#nav-backdrop').addEventListener('click', () => app.classList.remove('nav-open'));
    applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (D) Search.open(); } if (e.key === 'Escape') { Search.close(); app.classList.remove('nav-open'); } });
    window.addEventListener('hashchange', render);
  }

  /* ---------- Pomodoro ---------- */
  const Pomo = {
    mode: 'focus', left: 25 * 60, running: false, tick: null,
    len() { return this.mode === 'focus' ? 25 * 60 : 5 * 60; },
    draw() { const m = Math.floor(this.left / 60), s = this.left % 60; $('#pomo-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; $('#pomo-mode').textContent = this.mode === 'focus' ? 'Focus' : 'Break'; $('#pomo-toggle').innerHTML = icon(this.running ? 'pause' : 'play', 15); },
    toggle() { this.running ? this.pause() : this.start(); },
    start() { if (this.running) return; this.running = true; this.tick = setInterval(() => { this.left--; if (this.left <= 0) this.finish(); this.draw(); }, 1000); this.draw(); },
    pause() { this.running = false; clearInterval(this.tick); this.draw(); },
    reset() { this.pause(); this.left = this.len(); this.draw(); },
    switchMode() { this.mode = this.mode === 'focus' ? 'break' : 'focus'; this.reset(); },
    finish() { this.pause(); this.beep(); if (D) markActivity(); toast(this.mode === 'focus' ? 'Focus block done. Take a 5-minute break.' : 'Break over. Back to it.', 4000); this.mode = this.mode === 'focus' ? 'break' : 'focus'; this.left = this.len(); },
    beep() { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), gn = ac.createGain(); o.connect(gn); gn.connect(ac.destination); o.frequency.value = 880; gn.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); ac.close(); }, 500); } catch {} }
  };

  /* ---------- Search (per course) ---------- */
  const Search = {
    index: null, sel: 0, results: [],
    build() {
      const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\$[^$]*\$/g, m => m.replace(/\\[a-zA-Z]+|[{}$^_\\]/g, ' '));
      const ix = [];
      D.NAV.forEach(gp => gp.items.forEach(([id, label]) => ix.push({ type: 'page', t: label, s: gp.label, go: () => App.go(id), key: label.toLowerCase() })));
      ix.push({ type: 'page', t: 'Contact', s: SITE, go: () => App.go('contact'), key: 'contact creator nikoloz nonikashvili phone email help feedback' });
      D.SECTIONS.forEach(s => ix.push({ type: 'notes', t: `${s.label} ${s.title}`, s: `Unit ${s.unit}`, go: () => App.go('notes', s.id), key: (`${s.label} ${s.title} ` + s.ideas.map(strip).join(' ') + ' ' + s.pitfalls.map(strip).join(' ')).toLowerCase() }));
      D.FORMULAS.forEach(gp => gp.items.forEach(f => ix.push({ type: 'formula', t: f.n, s: gp.group, go: () => App.go('formulas', null, { q: f.n }), key: (f.n + ' ' + gp.group + ' ' + strip('$' + f.t + '$')).toLowerCase() })));
      D.FLASHCARDS.forEach(c => ix.push({ type: 'card', t: strip(c.f), s: secLabel(c.sec), go: () => App.go('flashcards', c.id), key: (strip(c.f) + ' ' + strip(c.b)).toLowerCase() }));
      D.CALENDAR.forEach(e => ix.push({ type: 'calendar', t: e[2], s: fmtDate(e[0]), go: () => App.go('calendar', e[0]), key: (e[2] + ' ' + fmtDate(e[0], true)).toLowerCase() }));
      Object.entries(QZ.TOPICS).forEach(([id, t]) => ix.push({ type: 'practice', t: `Practice: ${t.label}`, s: secLabel(t.sec), go: () => App.go('practice', null, { topics: id }), key: ('practice quiz ' + t.label + ' ' + secLabel(t.sec)).toLowerCase() }));
      this.index = ix;
    },
    open() {
      if (!D) return; if (!this.index) this.build();
      if ($('#search-modal')) { $('#search-input').focus(); return; }
      const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'search-modal';
      m.innerHTML = `<div class="modal" role="dialog" aria-label="Search"><input id="search-input" class="search-input" placeholder="Search ${esc(D.short)} notes, formulas, flashcards, calendar…" autocomplete="off"><div class="search-results" id="search-results"></div><div class="search-foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div></div>`;
      document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) this.close(); });
      const inp = $('#search-input'); inp.focus(); inp.addEventListener('input', () => this.query(inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); this.sel = Math.min(this.sel + 1, this.results.length - 1); this.paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); this.sel = Math.max(this.sel - 1, 0); this.paint(); } else if (e.key === 'Enter') { const r = this.results[this.sel]; if (r) { this.close(); r.go(); } } });
      on($('#search-results'), 'click', '.search-item', el => { const r = this.results[+el.dataset.i]; if (r) { this.close(); r.go(); } });
      this.query('');
    },
    close() { const m = $('#search-modal'); if (m) m.remove(); },
    query(q) { q = q.trim().toLowerCase(); const words = q.split(/\s+/).filter(Boolean); this.results = !q ? this.index.filter(r => r.type === 'page').slice(0, 12) : this.index.map(r => ({ r, score: words.reduce((s, w) => s + (r.t.toLowerCase().includes(w) ? 3 : r.key.includes(w) ? 1 : -100), 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 14).map(x => x.r); this.sel = 0; this.paint(); },
    paint() { const box = $('#search-results'); if (!box) return; box.innerHTML = this.results.length ? this.results.map((r, i) => `<div class="search-item${i === this.sel ? ' active' : ''}" data-i="${i}"><span class="type">${r.type}</span><span class="t">${esc(r.t)}</span><span class="s">${esc(r.s)}</span></div>`).join('') : '<div class="empty">No matches.</div>'; }
  };

  /* ======================================================
     Landing page (course chooser)
     ====================================================== */
  const Landing = {
    title: SITE,
    render(root) {
      const t = todayISO(); const d = today();
      const cards = COURSE_ORDER.filter(id => Courses[id]).map(id => {
        const C = Courses[id]; const data = store.peek(id); const ex = nextExam(C); const st = ex ? examStatus(ex) : null; const ss = semesterState(C);
        const hist = data.history || []; const acc = hist.length ? Math.round(100 * hist.filter(x => x.ok).length / hist.length) : null;
        const cur = currentSection(C); const dl = upcomingDeadlines(C, 3);
        const chip = ss.phase === 'after' ? 'Semester complete' : ss.phase === 'before' ? `Starts ${esc(shortDate(C.SEMESTER.start))}` : ex ? `${esc(ex.name)} · ${esc(st.chip)}` : 'Exams done';
        return `<a class="course-card ${id}" href="#/${id}/dashboard">
          <div class="course-card-head"><span class="course-code">${esc(C.code)}</span><span class="chip exam">${chip}</span></div>
          <h2>${esc(C.name)}</h2><p class="muted">${esc(C.tagline || '')}</p>
          <div class="course-meta">
            <div><span class="eyebrow">${ss.phase === 'after' ? 'Last topic' : ss.phase === 'before' ? 'First topic' : 'Now covering'}</span><div>${esc(cur.label)} ${esc(cur.title)}</div></div>
            <div><span class="eyebrow">Next exam</span><div>${ex ? esc(ex.dateLabel || fmtDate(ex.date, true)) : ss.phase === 'after' ? 'All done' : '—'}</div></div>
            <div><span class="eyebrow">Due soon</span><div>${dl.length ? dl.map(x => `${esc(x.title)} · ${daysBetween(t, x.date) === 0 ? 'today' : daysBetween(t, x.date) === 1 ? 'tomorrow' : esc(fmtDate(x.date))}`).slice(0, 2).join('<br>') : 'Nothing scheduled'}</div></div>
            <div><span class="eyebrow">Your stats</span><div>${streakOf(data)}-day streak · ${acc === null ? 'no questions yet' : acc + '% accuracy'}</div></div>
          </div>
          <span class="btn primary course-open">Open ${esc(C.short)} ${icon('right', 14)}</span></a>`;
      }).join('');
      const merged = COURSE_ORDER.filter(id => Courses[id]).flatMap(id => upcomingDeadlines(Courses[id], 8).map(x => Object.assign({ course: Courses[id] }, x))).filter(x => daysBetween(t, x.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
      const first = Courses[COURSE_ORDER[0]]; const ss = semesterState(first);
      const greeting = d.getHours() < 12 ? 'this morning' : d.getHours() < 18 ? 'this afternoon' : 'tonight';
      const sub = ss.phase === 'before' ? `Classes start ${esc(fmtDate(first.SEMESTER.start, true))}. Get a head start on the first topics.` : ss.phase === 'after' ? 'The semester is over. Everything stays here for review.' : `Which class are you working on ${greeting}?`;
      root.innerHTML = `<div class="landing-wrap">
        <header class="landing-top hero"><div><div class="eyebrow">${esc(fmtDate(t, true))} · ${esc(first.term)}${ss.phase === 'during' ? ` · Week ${ss.week}` : ''}</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>${SITE}</h1><p class="hero-sub">${sub}</p><p class="muted small hero-note">Notes, endless practice, simulators, planners and a class board for Montana State math and physics. Free for students.</p></div><div class="row gap-sm hero-actions"><span id="landing-account"></span><button class="icon-btn theme-btn" data-action="theme" aria-label="Toggle theme"></button></div></header>
        <div id="announcement-slot"></div>
        <div class="course-grid">${cards}</div>
        <div id="landing-canvas" class="mt-3"></div>
        <div class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('clock')} Next seven days, all classes</div><span class="small muted">Standing due rules from each syllabus plus exam and drop dates</span></div>
          ${merged.length ? `<div class="table-wrap"><table class="table compact"><tbody>${merged.map(x => `<tr><td style="width:120px" class="mono small">${daysBetween(t, x.date) === 0 ? 'Today' : daysBetween(t, x.date) === 1 ? 'Tomorrow' : esc(fmtDate(x.date))}</td><td style="width:90px"><span class="chip course-${x.course.id}">${esc(x.course.short)}</span></td><td>${esc(x.title)}${x.time ? ` <span class="muted small">· ${esc(x.time)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing due in the next week.</div>'}
        </div>
        <div class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('chat')} Latest discussions</div><a class="btn sm" href="#/forum">${icon('chat', 13)} Open discussions</a></div><div id="landing-forum"><div class="empty small">Loading…</div></div></div>
        <div class="landing-features grid cols-4 mt-3">${[['list', 'Endless quizzers', 'Procedurally generated problems with worked explanations, per topic and per exam.'], ['book', 'Notes on every topic', 'Big ideas, formulas, a worked example, pitfalls and an exam tip, linked to the free textbook.'], ['flask', 'Interactive tools', 'Graphers, simulators, solvers, a unit circle, grade calculators and a scratchpad.'], ['chat', 'Discussions', 'Ask classmates, share resources and organize study groups on a members-only board.']].map(([ic, h, p]) => `<div class="card-link"><div class="eyebrow">${icon(ic, 14)}</div><h4>${h}</h4><p>${p}</p></div>`).join('')}</div>
        <p class="small muted mt-2" style="text-align:center">${App.guest() ? 'Preview freely. Sign up with a montana.edu email to unlock every tool and keep your progress on all your devices.' : 'Progress, flashcards and grades are saved for each class and synced to your account.'}</p></div>`;
      bind(root, { theme: toggleTheme }); applyTheme();
      const slot = $('#landing-account', root); if (slot && App.auth) App.auth.paintLandingAccount(slot);
      const lf = $('#landing-forum', root); if (lf) { if (App.forumLatest) { const go = () => App.forumLatest(lf); if (App.auth && App.auth.ready) go(); else if (App.auth) App.auth.onChange(function once() { go(); }); } else lf.innerHTML = ''; }
      Canvas.fill($('#landing-canvas', root), null, 8); paintAnnouncement(root);
    }
  };

  /* ======================================================
     VIEW: Dashboard
     ====================================================== */
  App.views.dashboard = {
    title: 'Dashboard',
    render(root) {
      const t = todayISO(); const d = today(); const ex = nextExam(D); const ss = semesterState(D); const wk = ss.week;
      const todayEv = eventsOn(D, t); const dl = upcomingDeadlines(D, 6); const st = streak();
      const hist = store.get('history', []); const answered = hist.length, correct = hist.filter(x => x.ok).length; const cm = cardsMastered(); const cur = currentSection(D);
      const weekMon = addDays(d, -((d.getDay() + 6) % 7)); const weekDays = Array.from({ length: 5 }, (_, i) => toISO(addDays(weekMon, i)));
      const cl = ex ? checklistState(ex.id) : { items: [], done: 0 }; const p = progress();
      const weak = Object.entries(p).filter(([k, v]) => QZ.TOPICS[k] && v.a >= 3 && v.c / v.a < 0.7).sort((a, b) => (a[1].c / a[1].a) - (b[1].c / b[1].a)).slice(0, 4);
      const es = ex ? examStatus(ex) : null;
      const examTile = ex ? `<div class="panel lift hero-exam">
          <div class="countdown"><div class="countdown-num${es.big.length > 3 ? ' small' : ''}">${esc(es.big)}</div><div class="countdown-label">${esc(es.label)}</div></div>
          <div><div class="eyebrow">Next exam · ${ex.weight}% of the grade</div>
            <h2 style="font-size:26px;margin-top:2px">${esc(ex.name)} <span class="muted" style="font-size:16px;font-weight:400">· ${esc(ex.dateLabel || fmtDate(ex.date, true))}</span></h2>
            <p class="muted mt-1">Covers ${esc(ex.covers)}. Closed book, no devices.</p>
            <div class="bar-row mt-2"><span>Prep checklist</span><span class="mono">${cl.done} / ${cl.items.length}</span><div class="bar"><div class="bar-fill gold" style="width:${cl.items.length ? 100 * cl.done / cl.items.length : 0}%"></div></div></div>
            <div class="row mt-2">${D.PRACTICE && D.PRACTICE[ex.id] ? `<a class="btn primary" href="${L('exam', ex.id)}">${icon('flag', 14)} ${esc(ex.name)} practice set</a>` : `<a class="btn primary" href="${L('exam', ex.id)}">${icon('flag', 14)} ${esc(ex.name)} prep</a>`}<a class="btn" href="${L('practice', null, { exam: ex.id })}">${icon('list', 14)} Drill ${esc(ex.name)} topics</a><a class="btn" href="${L('flashcards', null, { unit: ex.units[ex.units.length - 1] })}">${icon('cards', 14)} Flashcards</a></div>
          </div></div>` : `<div class="panel lift hero-exam"><div class="countdown"><div class="countdown-num small">Done</div><div class="countdown-label">all exams</div></div><div><div class="eyebrow">${esc(D.code)}</div><h2 style="font-size:26px;margin-top:2px">Semester complete</h2><p class="muted mt-1">Every exam on the calendar has passed. Everything stays here for review, and the grade calculator can settle your final letter grade.</p><div class="row mt-2"><a class="btn primary" href="${L('grades')}">${icon('calc', 14)} Grade calculator</a><a class="btn" href="${L('practice')}">${icon('list', 14)} Keep practicing</a></div></div></div>`;
      const pre = ss.phase === 'before' ? `<div class="panel callout"><b>Classes start ${esc(fmtDate(D.SEMESTER.start, true))}</b> (${ss.days === 1 ? 'tomorrow' : `in ${ss.days} days`}). Everything below already follows the Fall 2026 calendar; the first topic is ready when you are.</div>` : '';
      const weekLabel = ss.phase === 'before' ? `Starts ${esc(shortDate(D.SEMESTER.start))}` : ss.phase === 'after' ? 'Semester over' : ss.phase === 'finals' ? 'Finals week' : `Week ${wk} of ${ss.weeks}`;
      const smart = App.smartReview ? App.smartReview(3) : { picked: [] };
      const plan = App.planToday ? App.planToday() : null;
      root.innerHTML = `<div class="page-head"><div><div class="eyebrow">${esc(fmtDate(t, true))} · ${weekLabel} · ${esc(D.code)}</div><h1 class="page-title">Good ${d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening'}. Here's where ${esc(D.short)} stands.</h1></div></div><div id="announcement-slot"></div>${pre}
        <div class="stack">${examTile}
          <div class="grid cols-3">
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} Today</div><a href="${L('calendar')}" class="small">Full calendar</a></div>
              ${todayEv.length ? todayEv.map(e => `<div class="today-ev"><span class="chip ${e[1]}">${e[1]}</span><span>${esc(e[2])}</span></div>`).join('') : `<div class="empty">No class today.${(() => { const nx = D.CALENDAR.find(e => e[0] > t && (e[1] === 'lecture' || e[1] === 'exam')); return nx ? ` Next: ${esc(nx[2])} on ${fmtDate(nx[0])}.` : ''; })()}</div>`}
              <div class="divider"></div><div class="eyebrow mb-1">Current topic</div>
              <a class="card-link" href="${L('notes', cur.id)}"><h4>${esc(cur.label)} ${esc(cur.title)}</h4><p>Open the notes, worked example and practice for this topic.</p></a>
              ${D.CALENDAR_NOTE ? `<p class="small muted mt-1">${esc(D.CALENDAR_NOTE)}</p>` : ''}</div>
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('clock')} Due soon</div>${(D.RECURRING || []).some(r => r.afterLabDay) ? `<span class="small muted">Lab day: ${courseSetting(D.id, 'labDay', 'tue') === 'thu' ? 'Thu' : 'Tue'} · <a href="${L('settings')}">change</a></span>` : ''}</div>
              ${dl.length ? dl.map(x => `<div class="today-ev"><span class="when">${daysBetween(t, x.date) === 0 ? 'Today' : daysBetween(t, x.date) === 1 ? 'Tomorrow' : esc(fmtDate(x.date))}</span><span>${esc(x.title)}${x.time ? ` <span class="muted small">· ${esc(x.time)}</span>` : ''}</span></div>`).join('') : '<div class="empty">Nothing scheduled.</div>'}
              <p class="small muted mt-2">Standing rules from the syllabus. Confirm exact assignments in Canvas.</p></div>
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('fire')} Your progress</div></div>
              <div class="grid cols-2" style="gap:10px"><div class="stat"><div class="stat-num">${st}</div><div class="stat-label">day streak</div></div><div class="stat"><div class="stat-num">${answered ? Math.round(100 * correct / answered) : 0}%</div><div class="stat-label">accuracy · ${answered} answered</div></div><div class="stat"><div class="stat-num">${cm.mastered}<span class="muted" style="font-size:15px">/${cm.total}</span></div><div class="stat-label">flashcards mastered</div></div><div class="stat"><div class="stat-num">${hist.filter(x => x.d === t).length}</div><div class="stat-label">questions today</div></div></div>
              <div class="divider"></div>
              ${D.UNITS.map(u => { const m = unitMastery(u.n); return `<div class="bar-row"><span>Unit ${u.n} · ${esc(u.title)}</span><span class="mono">${m.a ? m.pct + '%' : '—'}</span><div class="bar"><div class="bar-fill ${m.pct >= 80 ? 'good' : m.pct >= 60 ? 'warn' : m.a ? 'bad' : ''}" style="width:${m.a ? m.pct : 0}%"></div></div></div>`; }).join('')}</div>
          </div>
          <div class="grid cols-3">
            <div class="panel span-2"><div class="panel-h"><div class="panel-title">${icon('calendar')} This week</div><span class="small muted">${esc(shortDate(weekDays[0]))} – ${esc(shortDate(weekDays[4]))}</span></div>
              <div class="week-strip">${weekDays.map(iso => { const dd = parseISO(iso); const evs = eventsOn(D, iso); return `<div class="week-day${iso === t ? ' today' : iso < t ? ' past' : ''}"><div class="d">${DOW[dd.getDay()]}<span>${dd.getDate()}</span></div>${evs.length ? evs.map(e => `<div class="ev ${e[1]}">${esc(e[2])}</div>`).join('') : '<div class="ev muted">—</div>'}</div>`; }).join('')}</div></div>
            <div class="panel smart-panel"><div class="panel-h"><div class="panel-title">${icon('target')} Smart review</div></div>
              ${smart.picked.length ? `<p class="small muted mb-1">Your weakest and least-recent topics right now:</p>${smart.picked.map(r => `<div class="bar-row"><span>${esc(r.label)}</span><span class="mono">${r.acc === null ? 'new' : Math.round(r.acc * 100) + '%'}</span><div class="bar"><div class="bar-fill ${r.acc === null ? '' : r.acc < 0.6 ? 'bad' : r.acc < 0.8 ? 'warn' : 'good'}" style="width:${r.acc === null ? 0 : 100 * r.acc}%"></div></div><span class="small muted">${esc(r.why)}</span></div>`).join('')}<a class="btn primary sm mt-2" href="${L('practice', null, { smart: 1 })}">${icon('target', 13)} Review for me</a>` : '<div class="empty">Answer a few quizzer questions and a personalized review set will appear here.</div>'}</div>
          </div>
          <div class="grid cols-3">
            <div class="panel span-2 plan-panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} ${plan ? (plan.isToday ? 'Today’s plan' : `Next study day · ${esc(fmtDate(plan.date))}`) : 'Study planner'}</div>${plan ? `<span class="small muted">${plan.done}/${plan.total} done · <a href="${L('planner')}">open plan</a></span>` : ''}</div>
              ${plan ? (plan.items.length ? plan.items.map(i => `<label class="check plan-item${i.done ? ' done' : ''}" style="padding:4px 0"><input type="checkbox" data-plan="${i.id}" ${i.done ? 'checked' : ''}><span class="plan-label">${esc(i.label)}</span>${i.link ? `<a class="btn xs" href="${i.link}">Open</a>` : ''}</label>`).join('') : '<div class="empty">Rest day. Nothing planned.</div>') : `<div class="empty">No plan yet. Pick an exam and your study days and MatHub spreads the work across them. <a class="btn sm mt-2" href="${L('planner')}">Build a plan</a></div>`}</div>
            <div id="dash-canvas"></div>
          </div>
          <div class="grid cols-4">${D.NAV.find(gp => gp.label === 'Tools').items.map(([id, label, ic]) => `<a class="card-link" href="${L(id)}"><div class="eyebrow">${icon(ic, 14)} Tool</div><h4>${esc(label)}</h4></a>`).join('')}</div>
        </div>`;
      on(root, 'change', 'input[data-plan]', el => { const p = store.get('plan', null); if (!p) return; const it = p.items.find(i => i.id === el.dataset.plan); if (it) { it.done = el.checked; store.set('plan', p); markActivity(); el.closest('.plan-item').classList.toggle('done', el.checked); } });
      Canvas.fill($('#dash-canvas', root), D.id, 6); paintAnnouncement(root);
    }
  };

  /* ======================================================
     VIEW: Calendar
     ====================================================== */
  App.views.calendar = {
    title: 'Calendar',
    render(root, param) {
      const t = todayISO(); const start = parseISO(D.SEMESTER.start); const weeks = [];
      for (let w = 0; ; w++) { const mon = addDays(start, 7 * w); if (toISO(mon) > D.SEMESTER.end) break; weeks.push(Array.from({ length: 5 }, (_, i) => toISO(addDays(mon, i)))); }
      root.innerHTML = pageHead(`${esc(D.term)} calendar`, D.CALENDAR_NOTE || 'Subject to change; the instructor’s Canvas calendar wins.', `<button class="btn" data-action="today">${icon('target', 14)} Jump to today</button><button class="btn" data-action="print">${icon('print', 14)} Print</button>`) + `
        <div class="grid cols-3 mb-2"><div class="panel span-2"><div class="cal-legend"><span class="chip lecture">Lecture</span><span class="chip lab">Lab</span><span class="chip exam">Exam</span><span class="chip admin">Due / deadline</span><span class="chip holiday">No class</span><span class="chip review">Review</span></div></div>
          <div class="panel"><div class="eyebrow mb-1">Standing due times</div>${D.COURSE.deadlines.map(x => `<div class="small" style="padding:4px 0"><b>${esc(x.name)}.</b> ${esc(x.rule)}</div>`).join('')}</div></div>
        <div class="cal-head"><span>Week</span><span>Monday</span><span>Tuesday</span><span>Wednesday</span><span>Thursday</span><span>Friday</span></div>
        ${weeks.map((wk, i) => `<div class="cal-week"><div class="cal-wk">Wk ${i + 1}</div>${wk.map(iso => { const dd = parseISO(iso); const evs = eventsOn(D, iso); const isExam = evs.some(e => e[1] === 'exam' && !/^Finals week$/.test(e[2])); return `<div class="cal-day${iso === t ? ' today' : ''}${iso < t ? ' past' : ''}${isExam ? ' exam-day' : ''}" id="cal-${iso}"><div class="cal-date"><b>${dd.getDate()}</b><span>${MON[dd.getMonth()]}</span></div>${evs.map(e => `<div class="cal-ev ${e[1]}">${esc(e[2])}</div>`).join('')}<div class="cal-canvas" data-date="${iso}"></div></div>`; }).join('')}</div>`).join('')}`;
      bind(root, { today: () => { const el = $('#cal-' + t) || $('.cal-day'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, print: () => window.print() });
      const target = param && $('#cal-' + param); if (target) setTimeout(() => target.scrollIntoView({ block: 'center' }), 50);
      Canvas.load().then(d => { if (!d || !d.configured) return; const byDate = {}; d.events.filter(e => e.course === D.id).forEach(e => (byDate[e.date] = byDate[e.date] || []).push(e)); $$('.cal-canvas', root).forEach(el => { const evs = byDate[el.dataset.date]; if (evs) el.innerHTML = evs.map(e => `<div class="cal-ev canvas" title="From Canvas${e.time ? ' · ' + esc(e.time) : ''}">${icon('canvas', 10)} ${esc(e.title)}</div>`).join(''); }); const lg = $('.cal-legend', root); if (lg) lg.insertAdjacentHTML('beforeend', '<span class="chip canvas">From Canvas</span>'); }).catch(() => {});
    }
  };

  /* ======================================================
     VIEW: Notes
     ====================================================== */
  App.views.notes = {
    title: 'Notes',
    render(root, param) {
      const sec = secById(param) || currentSection(D); const idx = D.SECTIONS.indexOf(sec); const prev = D.SECTIONS[idx - 1], next = D.SECTIONS[idx + 1];
      const ex = D.EXAMS.find(e => e.sections.includes(sec.id)); const topics = topicsForSection(sec.id);
      const freeN = App.limit('sections'); const lockedSec = idx >= freeN;
      const navHtml = D.UNITS.map(u => `<div class="nav-label">Unit ${u.n} · ${esc(u.title)}</div>` + u.sections.map(id => { const s = secById(id); const k = D.SECTIONS.indexOf(s); return `<button class="sec-link${s.id === sec.id ? ' active' : ''}${k >= freeN ? ' locked' : ''}" data-action="open" data-id="${s.id}"><span class="num">${esc(s.label.replace('§', ''))}</span><span>${esc(s.title)}</span></button>`; }).join('')).join('');
      if (lockedSec) {
        root.innerHTML = `<div class="notes-layout"><div class="panel sec-nav">${navHtml}</div><div class="stack"><div class="panel">
          <div class="note-head"><span class="note-num">${esc(sec.label)}</span><span class="chip">Unit ${sec.unit}</span>${ex ? `<span class="chip exam">${esc(ex.name)}</span>` : ''}</div>
          <h2 class="note-title">${esc(sec.title)}</h2>
          <div class="note-block"><h4>Big ideas</h4><ul class="list">${sec.ideas.slice(0, 2).map(i => `<li>${i}</li>`).join('')}<li class="muted">… and ${Math.max(0, sec.ideas.length - 2)} more, plus formulas, a worked example, common mistakes and an exam tip.</li></ul></div>
          ${App.lockCard(`Notes beyond the first ${freeN} topics are for members`, `Sign up free to read every ${D.short} topic (${D.SECTIONS.length} in total) with worked examples and exam tips.`)}
          <div class="row between mt-3"><div>${prev ? `<button class="btn" data-action="open" data-id="${prev.id}">${icon('left', 14)} ${esc(prev.label)}</button>` : ''}</div><div>${next ? `<button class="btn" data-action="open" data-id="${next.id}">${esc(next.label)} ${icon('right', 14)}</button>` : ''}</div></div>
          </div></div></div>`;
        bind(root, { open: el => App.go('notes', el.dataset.id) }); return;
      }
      root.innerHTML = `<div class="notes-layout"><div class="panel sec-nav">${navHtml}</div><div class="stack"><div class="panel">
        <div class="note-head"><span class="note-num">${esc(sec.label)}</span><span class="chip">Unit ${sec.unit}</span>${ex ? `<span class="chip exam">${esc(ex.name)}</span>` : ''}<a class="small" style="margin-left:auto" href="${sec.link}" target="_blank" rel="noopener">Read in the textbook ${icon('external', 12)}</a></div>
        <h2 class="note-title">${esc(sec.title)}</h2>
        <div class="note-block"><h4>Big ideas</h4><ul class="list">${sec.ideas.map(i => `<li>${i}</li>`).join('')}</ul></div>
        <div class="note-block"><h4>Key formulas</h4>${sec.formulas.map(f => `<div class="formula-row"><div class="name">${esc(f.n)}</div><div class="tex">$$${f.t}$$</div></div>`).join('')}</div>
        <div class="note-block"><h4>Worked example</h4><div class="callout"><div>${sec.example.p}</div><button class="btn sm mt-2" data-action="reveal">${icon('eye', 14)} Show solution</button><div class="reveal mt-2" id="sol">${sec.example.s}</div></div></div>
        <div class="note-block"><h4>Common mistakes</h4><ul class="list">${sec.pitfalls.map(i => `<li>${i}</li>`).join('')}</ul></div>
        <div class="note-block"><div class="callout tip"><div class="eyebrow">Exam tip</div>${sec.tip}</div></div>
        <div class="row between mt-3"><div>${prev ? `<button class="btn" data-action="open" data-id="${prev.id}">${icon('left', 14)} ${esc(prev.label)}</button>` : ''}</div><div class="row">${topics.length ? `<a class="btn primary" href="${L('practice', null, { topics: topics.join(',') })}">${icon('list', 14)} Practice ${esc(sec.label)}</a>` : ''}<a class="btn" href="${L('flashcards', null, { sec: sec.id })}">${icon('cards', 14)} Cards</a></div><div>${next ? `<button class="btn" data-action="open" data-id="${next.id}">${esc(next.label)} ${icon('right', 14)}</button>` : ''}</div></div>
      </div></div></div>`;
      bind(root, { open: el => App.go('notes', el.dataset.id), reveal: el => { const s = $('#sol', root); s.classList.toggle('open'); el.innerHTML = s.classList.contains('open') ? `${icon('eye', 14)} Hide solution` : `${icon('eye', 14)} Show solution`; } });
    }
  };

  /* ======================================================
     VIEW: Formula sheet
     ====================================================== */
  App.views.formulas = {
    title: 'Formula sheet',
    render(root, param, query) {
      const freeG = App.limit('formulaGroups');
      const paint = filter => { const f = filter.toLowerCase(); const groups = D.FORMULAS.slice(0, freeG); const hidden = D.FORMULAS.length - groups.length; $('#fs-body', root).innerHTML = `<div class="grid cols-2">${groups.map(gp => { const items = gp.items.filter(it => !f || it.n.toLowerCase().includes(f) || gp.group.toLowerCase().includes(f)); if (!items.length) return ''; return `<div class="panel fs-group"><h3>${esc(gp.group)}</h3>${items.map(it => `<div class="fs-row"><div class="name">${esc(it.n)}</div><div class="tex">$$${it.t}$$</div></div>`).join('')}</div>`; }).join('') || '<div class="empty">No formulas match.</div>'}</div>${hidden > 0 ? `<div class="mt-2">${App.lockCard(`${hidden} more formula group${hidden === 1 ? '' : 's'} for members`, `The full ${D.short} sheet covers ${D.FORMULAS.map(g => g.group.toLowerCase()).join(', ')}. Sign up free to see and print all of it.`)}</div>` : ''}`; typeset($('#fs-body', root)); if (App.auth) App.auth.bindLocks(root); };
      root.innerHTML = pageHead('Formula sheet', 'Everything on one page. Exams are closed-book: use this to test what you can rewrite from memory.', `<input class="input" id="fs-filter" placeholder="Filter (e.g. chain, torque)…" value="${esc(query.q || '')}" style="width:220px"><button class="btn" data-action="print">${icon('print', 14)} Print</button>`) + '<div id="fs-body"></div>';
      paint(query.q || ''); $('#fs-filter', root).addEventListener('input', e => paint(e.target.value)); bind(root, { print: () => window.print() });
    }
  };

  /* ======================================================
     VIEW: Flashcards
     ====================================================== */
  App.views.flashcards = {
    title: 'Flashcards', state: {},
    render(root, param, query) {
      const st = this.state[D.id] = this.state[D.id] || { unit: 0, sec: null, deck: [], i: 0, flipped: false, mode: 'due' };
      if (query.unit) st.unit = +query.unit; if (query.sec) st.sec = query.sec; else if (!param) st.sec = null;
      const boxes = () => store.get('flashcards', {});
      const freeC = App.limit('cards');
      const buildDeck = () => { const b = boxes(); let cards = D.FLASHCARDS.filter(c => (!st.unit || c.unit === st.unit) && (!st.sec || c.sec === st.sec)); st.total = cards.length; cards = QZ.helpers.shuffle(cards); if (st.mode === 'due') cards.sort((x, y) => (b[x.id] || 0) - (b[y.id] || 0)); if (cards.length > freeC) cards = cards.slice(0, freeC); st.deck = cards; st.i = 0; st.flipped = false; if (param) { const k = cards.findIndex(c => c.id === param); if (k >= 0) st.i = k; } };
      buildDeck();
      const paint = () => {
        const b = boxes(); const c = st.deck[st.i]; const mastered = st.deck.filter(x => (b[x.id] || 0) >= 3).length;
        $('#fc-stats', root).innerHTML = `<span class="chip good">${mastered} mastered</span><span class="chip">${st.deck.length}${st.total > st.deck.length ? ` of ${st.total}` : ''} cards</span>`;
        const lk = $('#fc-lock', root); if (lk) lk.innerHTML = st.total > st.deck.length ? App.lockCard(`${st.total - st.deck.length} more cards for members`, `Preview shows ${st.deck.length} cards per deck. Sign up free for all ${D.FLASHCARDS.length} ${D.short} flashcards and saved mastery boxes.`, { compact: true }) : '';
        const stage = $('#fc-stage', root); if (!c) { stage.innerHTML = '<div class="empty">No cards match this filter.</div>'; $('#fc-controls', root).innerHTML = ''; return; }
        const box = b[c.id] || 0;
        stage.innerHTML = `<div class="fc-card${st.flipped ? ' flipped' : ''}" id="fc-card" tabindex="0" role="button" aria-label="Flip card"><div class="fc-face fc-front"><span class="eyebrow">Card ${st.i + 1} / ${st.deck.length} · box ${box}</span><span class="sec chip">${esc(secLabel(c.sec))}</span><div>${c.f}</div><div class="fc-hint">Click or press space to flip</div></div><div class="fc-face fc-back"><span class="eyebrow">Answer</span><span class="sec chip">${esc(secLabel(c.sec))}</span><div>${c.b}</div></div></div>`;
        $('#fc-controls', root).innerHTML = `<button class="btn" data-action="prev" ${st.i === 0 ? 'disabled' : ''}>${icon('left', 14)} Prev</button><button class="btn danger" data-action="again">Again <span class="kbd">1</span></button><button class="btn primary" data-action="good">Got it <span class="kbd">2</span></button><button class="btn" data-action="next" ${st.i >= st.deck.length - 1 ? 'disabled' : ''}>Next ${icon('right', 14)}</button>`;
        typeset(stage);
      };
      root.innerHTML = pageHead('Flashcards', 'Definitions, laws and formulas. "Got it" moves a card up a box; three boxes means mastered. "Again" sends it back to the start.') + `<div class="panel"><div class="row between mb-2"><div class="chips">${[0, 1, 2, 3, 4].map(u => `<span class="chip toggle${st.unit === u ? ' on' : ''}" data-action="unit" data-u="${u}">${u ? 'Unit ' + u : 'All units'}</span>`).join('')}${st.sec ? `<span class="chip accent">${esc(secLabel(st.sec))} <span data-action="clearsec" style="cursor:pointer">✕</span></span>` : ''}</div><div class="row"><span id="fc-stats" class="row gap-sm"></span><button class="btn sm" data-action="mode">${st.mode === 'due' ? 'Order: weakest first' : 'Order: shuffled'}</button><button class="btn sm" data-action="reshuffle">${icon('rotate', 13)} Reshuffle</button><button class="btn sm ghost" data-action="reset">Reset progress</button></div></div><div class="fc-stage" id="fc-stage"></div><div class="fc-controls" id="fc-controls"></div><div id="fc-lock" class="mt-2"></div></div>`;
      paint();
      const grade = up => { const c = st.deck[st.i]; if (!c) return; const b = boxes(); b[c.id] = up ? Math.min(3, (b[c.id] || 0) + 1) : 0; store.set('flashcards', b); markActivity(); if (st.i < st.deck.length - 1) st.i++; st.flipped = false; paint(); };
      const flip = () => { st.flipped = !st.flipped; const el = $('#fc-card', root); if (el) el.classList.toggle('flipped', st.flipped); };
      bind(root, { unit: el => { st.unit = +el.dataset.u; st.sec = null; App.go('flashcards', null, { unit: st.unit }); }, clearsec: () => { st.sec = null; App.go('flashcards'); }, mode: () => { st.mode = st.mode === 'due' ? 'shuffle' : 'due'; this.render(root, null, {}); }, reshuffle: () => { buildDeck(); paint(); }, reset: () => { if (confirm('Reset flashcard progress for this class?')) { store.set('flashcards', {}); paint(); toast('Flashcard progress reset'); } }, prev: () => { if (st.i > 0) { st.i--; st.flipped = false; paint(); } }, next: () => { if (st.i < st.deck.length - 1) { st.i++; st.flipped = false; paint(); } }, again: () => grade(false), good: () => grade(true) });
      on(root, 'click', '#fc-card', flip);
      this.keys = e => { if (e.target.matches('input, textarea, select') || $('#search-modal')) return; if (e.key === ' ') { e.preventDefault(); flip(); } else if (e.key === '1') grade(false); else if (e.key === '2') grade(true); else if (e.key === 'ArrowLeft') { if (st.i > 0) { st.i--; st.flipped = false; paint(); } } else if (e.key === 'ArrowRight') { if (st.i < st.deck.length - 1) { st.i++; st.flipped = false; paint(); } } };
      document.addEventListener('keydown', this.keys);
    },
    unmount() { if (this.keys) document.removeEventListener('keydown', this.keys); }
  };

  /* ======================================================
     VIEW: Textbook & links
     ====================================================== */
  App.views.textbook = {
    title: 'Textbook & links',
    render(root) {
      const C = D.COURSE;
      root.innerHTML = pageHead('Textbook & links', `${esc(C.textbook.title)} is free online. Every topic below links straight to its chapter.`) + `<div class="stack">
        <div class="grid cols-3">${(C.links || []).map(l => `<a class="card-link" href="${l.url}" target="_blank" rel="noopener"><div class="eyebrow">${esc(l.eyebrow)}</div><h4>${esc(l.title)} ${icon('external', 12)}</h4><p>${esc(l.desc)}</p></a>`).join('')}</div>
        <div class="panel"><div class="panel-h"><div class="panel-title">${icon('book')} Topics covered this semester</div></div>
          ${D.UNITS.map(u => `<div class="eyebrow mt-2 mb-1">Unit ${u.n} · ${esc(u.title)}</div><div class="link-grid">${u.sections.map(id => { const s = secById(id); return `<div class="card-link" style="padding:10px 12px"><h4 style="font-size:14px"><a href="${s.link}" target="_blank" rel="noopener">${esc(s.label)} ${esc(s.title)} ${icon('external', 11)}</a></h4><p style="margin-top:2px"><a href="${L('notes', s.id)}">Notes on this site</a></p></div>`; }).join('')}</div>`).join('')}</div>
        ${C.pdf ? `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('file')} Hosted PDF</div><a class="btn sm" href="${C.pdf}" target="_blank" rel="noopener">${icon('external', 13)} Open in new tab</a></div><iframe class="pdf-frame" src="${C.pdf}" title="Textbook PDF"></iframe><p class="small muted mt-1">Blank frame? Upload <code>${esc(C.pdf)}</code> next to this site’s <code>index.html</code>, or use the online links above.</p></div>` : ''}
      </div>`;
    }
  };

  /* ======================================================
     VIEW: Grades (supports "best n of a group", e.g. drop the lowest exam)
     ====================================================== */
  function gradeModel(vals) {
    const G = D.GRADING; const cats = G.categories; const groups = G.groups || {};
    let num = 0, den = 0; const used = {};
    const groupCats = {}; cats.forEach(c => { if (c.group) (groupCats[c.group] = groupCats[c.group] || []).push(c); });
    cats.filter(c => !c.group).forEach(c => { if (c.id in vals) { num += c.weight * vals[c.id]; den += c.weight; used[c.id] = c.weight; } });
    Object.entries(groupCats).forEach(([gname, members]) => { const rule = groups[gname] || { keepBest: members.length, weight: members.reduce((s, c) => s + c.weight, 0) }; const entered = members.filter(c => c.id in vals).sort((a, b) => vals[b.id] - vals[a.id]).slice(0, rule.keepBest); const w = rule.weight / rule.keepBest; entered.forEach(c => { num += w * vals[c.id]; den += w; used[c.id] = w; }); });
    return { cur: den ? num / den : NaN, banked: num / 100, den, used };
  }
  function overallWith(vals, fill) { const all = {}; D.GRADING.categories.forEach(c => { all[c.id] = (c.id in vals) ? vals[c.id] : fill; }); return gradeModel(all).cur; }
  App.views.grades = {
    title: 'Grade calculator',
    render(root) {
      const G = D.GRADING; const cats = G.categories; const saved = store.get('grades', {}); const letterFor = pct => G.scale.find(s => pct >= s.min)?.letter || 'F';
      const compute = () => {
        const vals = {}; cats.forEach(c => { const v = parseFloat($(`#g-${c.id}`, root).value); if (!isNaN(v)) vals[c.id] = Math.max(0, Math.min(100, v)); });
        store.set('grades', vals); const out = $('#g-out', root); const m = gradeModel(vals);
        if (!m.den) { out.innerHTML = '<div class="empty">Enter a percentage for at least one category.</div>'; return; }
        const finalId = G.finalId; const finalEntered = finalId in vals;
        const need = finalEntered ? [] : G.scale.filter(s => s.letter !== 'F').map(s => { const f = x => overallWith(Object.assign({}, vals, { [finalId]: x }), m.cur) - s.min; let lo = 0, hi = 100; if (f(0) >= 0) return { letter: s.letter, needed: 0 }; if (f(100) < 0) return { letter: s.letter, needed: 101 }; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(mid) >= 0) hi = mid; else lo = mid; } return { letter: s.letter, needed: hi }; });
        out.innerHTML = `<div class="grid cols-3"><div class="stat"><div class="grade-letter">${letterFor(m.cur)}</div><div class="stat-label">current letter grade</div></div><div class="stat"><div class="stat-num">${m.cur.toFixed(1)}%</div><div class="stat-label">weighted average of what you entered (${Math.round(m.den)}% of the grade)</div></div><div class="stat"><div class="stat-num">${m.banked.toFixed(1)}</div><div class="stat-label">points already banked out of 100</div></div></div>
          ${finalEntered ? '' : `<div class="divider"></div><div class="eyebrow mb-1">What you need on the ${esc(cats.find(c => c.id === finalId)?.name.split(' (')[0] || 'final')}</div><p class="small muted mb-1">Assumes categories you left blank end up at your current average${Object.keys(G.groups || {}).length ? ', and applies the drop-lowest rule' : ''}.</p><div class="table-wrap"><table class="table compact"><thead><tr><th>Target</th><th class="num">Score needed</th><th>Verdict</th></tr></thead><tbody>${need.map(n => `<tr><td><b>${n.letter}</b></td><td class="num">${n.needed <= 0 ? 'any score' : n.needed > 100 ? '> 100%' : n.needed.toFixed(1) + '%'}</td><td class="small">${n.needed <= 0 ? '<span class="chip good">locked in</span>' : n.needed > 100 ? '<span class="chip bad">out of reach</span>' : n.needed > 90 ? '<span class="chip warn">tough</span>' : '<span class="chip good">doable</span>'}</td></tr>`).join('')}</tbody></table></div>`}`;
      };
      root.innerHTML = pageHead('Grade calculator', `Weights come straight from the ${esc(D.code)} syllabus. Leave a category blank if it has not happened yet.${G.note ? ' ' + esc(G.note) : ''}`) + `<div class="grid cols-3"><div class="panel span-2"><div class="panel-h"><div class="panel-title">${icon('calc')} Your scores</div><button class="btn sm ghost" data-action="clear">Clear</button></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th class="num">Weight</th><th>Your %</th></tr></thead><tbody>${cats.map(c => `<tr class="grade-row"><td>${esc(c.name)}</td><td class="num">${(+c.weight.toFixed(1))}%</td><td><input class="input mono" id="g-${c.id}" type="number" min="0" max="100" step="0.1" placeholder="—" value="${saved[c.id] ?? ''}"></td></tr>`).join('')}</tbody></table></div>
          ${Object.values(G.groups || {}).map(gp => `<p class="small muted mt-1">${esc(gp.note || '')}</p>`).join('')}</div>
        <div class="stack"><div class="panel" id="g-out"></div><div class="panel"><div class="eyebrow mb-1">Letter grade scale</div><div class="table-wrap"><table class="table compact"><thead><tr><th>Grade</th><th class="num">Percent</th>${G.scale[0].fourPt ? '<th class="num">4-point</th>' : ''}</tr></thead><tbody>${G.scale.map(s => `<tr><td><b>${s.letter}</b></td><td class="num">${s.min === 0 ? '< ' + G.scale[G.scale.length - 2].min : '≥ ' + s.min}</td>${s.fourPt ? `<td class="num">${s.fourPt}</td>` : ''}</tr>`).join('')}</tbody></table></div></div></div></div>
        ${G.rubric ? `<div class="panel mt-2"><div class="panel-h"><div class="panel-title">${icon('list')} ${G.rubricTitle || (D.id === 'physics' ? 'How each lab is scored (20 points)' : 'How written work is scored (4-point rubric)')}</div></div><div class="table-wrap"><table class="table compact"><tbody>${G.rubric.map(r => `<tr><td style="width:140px"><b>${r.score} · ${esc(r.name)}</b></td><td>${esc(r.desc)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
      compute(); $$('input', root).forEach(i => i.addEventListener('input', compute)); bind(root, { clear: () => { $$('input', root).forEach(i => i.value = ''); compute(); } });
    }
  };

  /* ======================================================
     VIEW: Course info
     ====================================================== */
  App.views.course = {
    title: 'Syllabus & policies',
    render(root) {
      const C = D.COURSE;
      root.innerHTML = pageHead('Syllabus & policies', `${esc(C.code)} ${esc(C.name)} · ${esc(C.term)} · ${esc(C.school)}. The essentials from the syllabus, in one place.`) + `<div class="grid cols-2">${D.INFO.map(p => `<div class="panel${p.span2 ? ' span-2' : ''}"><div class="panel-h"><div class="panel-title">${icon(p.icon || 'info')} ${esc(p.title)}</div></div>${p.html}</div>`).join('')}</div>`;
    }
  };

  /* ======================================================
     VIEW: Contact (works with or without a course: #/contact or #/calc/contact)
     ====================================================== */
  const CREATOR = { name: 'Nikoloz Nonikashvili', phone: '6465448765', phoneLabel: '(646) 544-8765', email: 'nonikashvilinikolozi@gmail.com' };
  App.CREATOR = CREATOR;
  App.views.contact = {
    title: 'Contact',
    render(root, param, query, standalone) {
      const wrap = standalone ? '<div class="landing-wrap contact-wrap">' : '';
      root.innerHTML = `${wrap}${standalone ? `<header class="landing-top"><div><div class="eyebrow">${SITE}</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Contact</h1><p class="muted">Questions, a wrong date, a broken problem, or an idea for the site? Get in touch.</p></div><div class="row gap-sm"><a class="btn" href="#/">${icon('left', 14)} All classes</a><button class="icon-btn theme-btn" data-action="theme" aria-label="Toggle theme"></button></div></header>` : pageHead('Contact', 'Questions, a wrong date, a broken problem, or an idea for the site? Get in touch.')}
        <div class="grid cols-3">
          <div class="panel span-2 contact-card">
            <div class="contact-head"><div class="avatar big">${esc(CREATOR.name.split(' ').map(w => w[0]).join(''))}</div><div><div class="eyebrow">Created by</div><h2>${esc(CREATOR.name)}</h2><p class="muted">Montana State University student. Built ${SITE} to make studying for math and physics classes easier.</p></div></div>
            <div class="divider"></div>
            <div class="contact-rows">
              <div class="contact-row"><span class="contact-ic">${icon('clock', 18)}</span><div><div class="eyebrow">Phone</div><a class="contact-val mono" href="tel:+1${CREATOR.phone}">${esc(CREATOR.phoneLabel)}</a></div><div class="row gap-sm"><a class="btn sm" href="sms:+1${CREATOR.phone}">Text</a><button class="btn sm" data-action="copy" data-v="${CREATOR.phone}">Copy</button></div></div>
              <div class="contact-row"><span class="contact-ic">${icon('link', 18)}</span><div><div class="eyebrow">Email</div><a class="contact-val" href="mailto:${CREATOR.email}?subject=${encodeURIComponent(SITE + ' question')}">${esc(CREATOR.email)}</a></div><div class="row gap-sm"><a class="btn sm primary" href="mailto:${CREATOR.email}?subject=${encodeURIComponent(SITE + ' question')}">Email</a><button class="btn sm" data-action="copy" data-v="${CREATOR.email}">Copy</button></div></div>
            </div>
          </div>
          <div class="stack">
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('bulb')} Reporting a problem</div></div><p class="small">The more specific, the faster the fix. Include:</p><ul class="list small mt-1"><li>the class and the page (for example “Precalc · Quizzer”)</li><li>the topic or problem number</li><li>what you expected and what you saw</li></ul></div>
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('info')} About the content</div></div><p class="small muted">Dates and rules come from each course's Fall 2026 syllabus; weekly lecture topics for physics and precalculus are estimates. Canvas and your instructor always win. ${SITE} is a student project and is not affiliated with Montana State University.</p></div>
          </div>
        </div>${standalone ? '</div>' : ''}`;
      bind(root, { copy: el => { const v = el.dataset.v; const done = () => { el.textContent = 'Copied'; setTimeout(() => el.textContent = 'Copy', 1500); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, () => toast(v, 3000)); else toast(v, 3000); }, theme: toggleTheme });
      if (standalone) applyTheme();
    }
  };

  /* ======================================================
     VIEW: Settings
     ====================================================== */
  App.views.settings = {
    title: 'Settings',
    render(root) {
      const s = settings(); const hasLab = (D.RECURRING || []).some(r => r.afterLabDay);
      root.innerHTML = pageHead('Settings', 'Preferences apply to every class. Progress is stored per class and, when you are logged in, synced to your account.') + `<div class="grid cols-2"><div id="acct-panel" class="span-2"></div>
        <div class="panel"><div class="panel-h"><div class="panel-title">${icon('sliders')} Preferences</div></div>
          <div class="field mb-2"><label>Theme</label><select class="select" id="s-theme"><option value="system"${s.theme === 'system' ? ' selected' : ''}>Match system</option><option value="light"${s.theme === 'light' ? ' selected' : ''}>Light</option><option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Dark</option></select></div>
          ${hasLab ? `<div class="field"><label>Your ${esc(D.short)} lab day</label><select class="select" id="s-lab"><option value="tue"${courseSetting(D.id, 'labDay', 'tue') !== 'thu' ? ' selected' : ''}>Tuesday</option><option value="thu"${courseSetting(D.id, 'labDay', 'tue') === 'thu' ? ' selected' : ''}>Thursday</option></select><span class="help">Sets when lab sheets show as due on the dashboard (8:00 pm the day after lab).</span></div>` : ''}
          <div class="field mt-2"><label for="s-asof">Preview the site as of a date</label><div class="row gap-sm"><input class="input" id="s-asof" type="date" value="${esc(s.asof || '')}" min="${D.SEMESTER.start}" max="${D.SEMESTER.end}" style="max-width:200px"><button class="btn sm ghost" data-action="asof-clear">Back to today</button></div><span class="help">Jump ahead to see what the dashboard, countdowns and due lists will show later in the semester.</span></div>
          <div class="divider"></div><div class="eyebrow mb-1">Keyboard shortcuts</div>
          <ul class="list-plain small"><li><span class="kbd">Ctrl</span> + <span class="kbd">K</span> search this class</li><li><span class="kbd">Space</span> flip a flashcard · <span class="kbd">1</span> again · <span class="kbd">2</span> got it · <span class="kbd">←</span> <span class="kbd">→</span> move</li><li><span class="kbd">1</span>–<span class="kbd">4</span> choose an answer in the quizzer · <span class="kbd">Enter</span> check a typed answer</li></ul></div>
        <div class="panel"><div class="panel-h"><div class="panel-title">${icon('download')} Your ${esc(D.short)} data</div></div><p class="small muted mb-2">Quiz history, flashcard boxes, checklists, grade entries and scratchpad strokes for this class.</p>
          <div class="row"><button class="btn" data-action="export">${icon('download', 14)} Export backup</button><label class="btn">${icon('rotate', 14)} Import backup <input type="file" id="s-import" accept="application/json" hidden></label><button class="btn danger" data-action="reset">${icon('trash', 14)} Reset ${esc(D.short)} progress</button></div>
          <textarea class="input mono mt-2" id="s-json" rows="8" placeholder="Export writes your backup here; paste a backup here and click Import from text." spellcheck="false"></textarea><button class="btn sm mt-1" data-action="import-text">Import from text</button></div></div>`;
      $('#s-theme', root).addEventListener('change', e => { setSetting('theme', e.target.value); applyTheme(); });
      $('#s-asof', root).addEventListener('change', e => { setSetting('asof', e.target.value || ''); render(); if (e.target.value) toast(`Viewing the site as of ${fmtDate(e.target.value)}`); });
      const acct = $('#acct-panel', root); if (acct && App.auth) acct.replaceWith(Object.assign(App.auth.settingsPanel(root), { className: 'panel span-2' }));
      const lab = $('#s-lab', root); if (lab) lab.addEventListener('change', e => { setCourseSetting(D.id, 'labDay', e.target.value); toast('Lab day saved'); });
      $('#s-import', root).addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(txt => { try { store.importJSON(txt); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } }); });
      bind(root, { export: () => { const txt = store.exportJSON(); $('#s-json', root).value = txt; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `studyhub-${D.id}-${todayISO()}.json`; a.click(); } catch {} toast('Backup ready'); }, 'import-text': () => { try { store.importJSON($('#s-json', root).value); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } }, reset: () => { if (confirm(`Erase all saved ${D.short} progress on this device?`)) { store.reset(); toast('Progress reset'); render(); } }, 'asof-clear': () => { setSetting('asof', ''); render(); } });
    }
  };

  /* ---------- boot ---------- */
  global.App = App;
  function staleShell() {
    // An old cached index.html can load a newer app.js. If the page is missing the pieces this build needs, reload once bypassing the cache.
    const need = ['#account-box', '#course-switch', '#sidebar-nav'].every(sel => $(sel)) && Object.keys(Courses).length >= 1;
    if (need) return false;
    let tried = false; try { tried = sessionStorage.getItem('mathub-reloaded') === BUILD; sessionStorage.setItem('mathub-reloaded', BUILD); } catch {}
    if (tried) return false;
    fetch(location.pathname, { cache: 'reload' }).catch(() => {}).finally(() => location.reload());
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => { if (staleShell()) return; buildLayout(); Pomo.draw(); render(); if (global.MathJax && global.MathJax.startup && global.MathJax.startup.promise) global.MathJax.startup.promise.then(() => typeset($('#view'))); });
})(window);
