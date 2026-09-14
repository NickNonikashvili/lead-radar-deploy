/* ============================================================
   M171 Study Hub — application core
   Utilities, storage, math parser, router, layout, search,
   pomodoro, and the reference views.
   Tool views (practice, exam prep, grapher, labs, scratchpad)
   live in tools.js and register on App.views.
   ============================================================ */
(function (global) {
  'use strict';
  const D = global.M171;
  const QZ = global.M171Quiz;

  /* ---------- tiny DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ''), '');
  // Delegated handlers. Re-binding the same root replaces the handler map instead of stacking listeners,
  // so a view can re-render into the same element without double-firing.
  function bind(root, map) {
    root.__actions = map;
    if (!root.__boundClick) {
      root.__boundClick = true;
      root.addEventListener('click', e => {
        const el = e.target.closest('[data-action]');
        if (!el || !root.contains(el)) return;
        const fn = root.__actions && root.__actions[el.dataset.action];
        if (fn) { fn(el, e); }
      });
    }
  }
  function on(root, evt, sel, fn) {
    root.__on = root.__on || {}; const key = evt + '|' + sel; root.__on[key] = fn;
    root.__onBound = root.__onBound || {};
    if (!root.__onBound[key]) {
      root.__onBound[key] = true;
      root.addEventListener(evt, e => { const el = e.target.closest(sel); if (el && root.contains(el)) root.__on[key](el, e); });
    }
  }
  function toast(msg, ms = 1800) {
    $$('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ---------- icons (inline SVG) ---------- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
    cards: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
    chart: '<path d="M3 20h18"/><path d="M4 16c3-2 5-8 8-8s4 6 8 3"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M6 11l6 6 6-6"/><path d="M4 21h16"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    fire: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1 .3-2 1-3 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- storage ---------- */
  const KEY = 'm171-study-v1';
  const store = {
    data: (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })(),
    get(k, def) { return (k in this.data) ? this.data[k] : def; },
    set(k, v) { this.data[k] = v; try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },
    exportJSON() { return JSON.stringify(this.data, null, 2); },
    importJSON(txt) { const obj = JSON.parse(txt); if (!obj || typeof obj !== 'object') throw new Error('Not a valid export'); this.data = obj; localStorage.setItem(KEY, JSON.stringify(obj)); },
    reset() { this.data = {}; try { localStorage.removeItem(KEY); } catch {} }
  };
  const settings = () => store.get('settings', { theme: 'system', labDay: 'tue' });
  const setSetting = (k, v) => { const s = settings(); s[k] = v; store.set('settings', s); };

  /* ---------- dates ---------- */
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parseISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const todayISO = () => toISO(today());
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const fmtDate = (iso, long = false) => { const d = parseISO(iso); return long ? `${DOW[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()}` : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; };
  const shortDate = iso => { const d = parseISO(iso); return `${MON[d.getMonth()]} ${d.getDate()}`; };
  const weekOf = iso => Math.floor(daysBetween(D.SEMESTER.start, iso) / 7) + 1;
  const relDays = n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? `${-n} day${n === -1 ? '' : 's'} ago` : `in ${n} days`;

  /* ---------- MathJax ---------- */
  function typeset(el) {
    if (!el) return;
    const MJ = global.MathJax;
    if (MJ && MJ.typesetPromise) { MJ.typesetPromise([el]).catch(() => {}); }
    else if (MJ && MJ.startup && MJ.startup.promise) { MJ.startup.promise.then(() => MJ.typesetPromise([el])).catch(() => {}); }
  }

  /* ---------- expression parser ----------
     Supports + - * / ^, parentheses, implicit multiplication (2x, x(x+1), 3sin(x)),
     functions (sin cos tan sec csc cot asin acos atan sinh cosh tanh exp ln log sqrt abs),
     constants e and pi, variable x (or t). Returns a JS function. */
  const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
    asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, sqrt: Math.sqrt, abs: Math.abs, cbrt: Math.cbrt, floor: Math.floor, ceil: Math.ceil };
  const CONST = { e: Math.E, pi: Math.PI };
  const NAMES = Object.keys(FUN).concat(Object.keys(CONST), ['x', 't']).sort((a, b) => b.length - a.length);
  function compileExpr(src) {
    const s = String(src || '').replace(/\s+/g, '').replace(/π/g, 'pi').replace(/−/g, '-').replace(/\*\*/g, '^').replace(/×/g, '*').replace(/÷/g, '/');
    if (!s) throw new Error('Enter a function of x.');
    let i = 0, absDepth = 0;
    const peek = () => s[i];
    const isDigit = c => c >= '0' && c <= '9';
    const isAlpha = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    const expect = c => { if (s[i] !== c) throw new Error(`Expected "${c}" at position ${i + 1}.`); i++; };
    function parseExpr() {
      let l = parseTerm();
      while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = parseTerm(); const L = l; l = op === '+' ? x => L(x) + r(x) : x => L(x) - r(x); }
      return l;
    }
    function parseTerm() {
      let l = parseUnary();
      for (;;) {
        const c = peek();
        if (c === '*' || c === '/') { i++; const r = parseUnary(); const L = l; l = c === '*' ? x => L(x) * r(x) : x => L(x) / r(x); }
        else if (c && (isDigit(c) || isAlpha(c) || c === '(' || (c === '|' && absDepth === 0))) { const r = parseUnary(); const L = l; l = x => L(x) * r(x); }
        else break;
      }
      return l;
    }
    function parseUnary() {
      if (peek() === '-') { i++; const r = parseUnary(); return x => -r(x); }
      if (peek() === '+') { i++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const base = parseAtom();
      if (peek() === '^') { i++; const ex = parseUnary(); return x => Math.pow(base(x), ex(x)); }
      return base;
    }
    function parseAtom() {
      const c = peek();
      if (c === undefined) throw new Error('Unexpected end of expression.');
      if (isDigit(c) || c === '.') {
        let j = i; while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
        const v = parseFloat(s.slice(i, j)); if (isNaN(v)) throw new Error('Bad number.'); i = j; return () => v;
      }
      if (c === '(') { i++; const e = parseExpr(); expect(')'); return e; }
      if (c === '|') { i++; absDepth++; const e = parseExpr(); absDepth--; expect('|'); return x => Math.abs(e(x)); }
      if (isAlpha(c)) {
        const name = NAMES.find(n => s.startsWith(n, i));
        if (!name) { let j = i; while (j < s.length && isAlpha(s[j])) j++; throw new Error(`Unknown symbol "${s.slice(i, j)}".`); }
        i += name.length;
        if (FUN[name]) {
          const F = FUN[name];
          let arg;
          if (peek() === '(') { i++; arg = parseExpr(); expect(')'); }
          else arg = parseUnary();
          return x => F(arg(x));
        }
        if (name in CONST) { const v = CONST[name]; return () => v; }
        return x => x;
      }
      throw new Error(`Unexpected "${c}" at position ${i + 1}.`);
    }
    const fn = parseExpr();
    if (i < s.length) throw new Error(`Unexpected "${s[i]}" at position ${i + 1}.`);
    return x => { const v = fn(x); return typeof v === 'number' ? v : NaN; };
  }
  const d1 = (f, x, hh = 1e-5) => (f(x + hh) - f(x - hh)) / (2 * hh);
  const d2 = (f, x, hh = 1e-4) => (f(x + hh) - 2 * f(x) + f(x - hh)) / (hh * hh);
  function parseNumber(str) {
    const t = String(str || '').trim();
    if (!t) return NaN;
    try { return compileExpr(t)(0); } catch { return NaN; }
  }
  const fmtNum = (x, p = 4) => { if (!isFinite(x)) return '—'; const r = Math.round(x * 10 ** p) / 10 ** p; return String(r); };

  /* ---------- progress helpers ---------- */
  function progress() { return store.get('progress', {}); }
  function recordAnswer(topic, ok) {
    const p = progress(); const t = p[topic] || { a: 0, c: 0 }; t.a++; if (ok) t.c++; p[topic] = t; store.set('progress', p);
    const hist = store.get('history', []); hist.push({ t: topic, ok, d: todayISO() }); if (hist.length > 500) hist.splice(0, hist.length - 500); store.set('history', hist);
    markActivity();
  }
  function markActivity() { const days = store.get('activity', {}); days[todayISO()] = true; store.set('activity', days); }
  function streak() {
    const days = store.get('activity', {}); let n = 0; let d = today();
    if (!days[toISO(d)]) d = addDays(d, -1);
    while (days[toISO(d)]) { n++; d = addDays(d, -1); }
    return n;
  }
  function unitMastery(unit) {
    const p = progress(); const topics = QZ.topicsForUnits([unit]);
    let a = 0, c = 0; topics.forEach(t => { if (p[t]) { a += p[t].a; c += p[t].c; } });
    return { a, c, pct: a ? Math.round(100 * c / a) : 0 };
  }
  function cardsMastered(unit) {
    const fc = store.get('flashcards', {});
    const cards = D.FLASHCARDS.filter(c => !unit || c.unit === unit);
    return { total: cards.length, mastered: cards.filter(c => (fc[c.id] || 0) >= 3).length };
  }
  function checklistState(examId) {
    const items = D.CHECKLISTS[examId] || []; const st = store.get('checklists', {})[examId] || {};
    return { items, done: items.filter((_, i) => st[i]).length };
  }

  /* ---------- course helpers ---------- */
  const eventsOn = iso => D.CALENDAR.filter(e => e[0] === iso);
  const isHoliday = iso => eventsOn(iso).some(e => e[1] === 'holiday');
  const inSemester = iso => iso >= D.SEMESTER.start && iso <= D.SEMESTER.end;
  function nextExam() { const t = todayISO(); return D.EXAMS.find(e => e.date >= t) || null; }
  function currentSection() {
    const t = todayISO();
    const lec = D.CALENDAR.filter(e => e[1] === 'lecture' && e[0] <= t).pop();
    if (!lec) return D.SECTIONS[0];
    const m = lec[2].match(/§(\d\.\d)/); return D.SECTIONS.find(s => s.id === (m ? m[1] : '1.1')) || D.SECTIONS[0];
  }
  function upcomingDeadlines(count = 6) {
    const items = []; const start = today(); const labDow = settings().labDay === 'thu' ? 4 : 2;
    for (let k = 0; k < 28; k++) {
      const d = addDays(start, k), iso = toISO(d), dow = d.getDay();
      if (!inSemester(iso)) continue;
      const hol = isHoliday(iso);
      if (!hol && [1, 2, 4].includes(dow)) items.push({ date: iso, time: '8:00 pm', title: 'WebWork due', type: 'webwork' });
      if (!hol && dow === 1) items.push({ date: iso, time: '8:00 pm', title: 'Written homework due (Gradescope)', type: 'written' });
      if (dow === labDow + 1 && !isHoliday(toISO(addDays(d, -1)))) items.push({ date: iso, time: '8:00 pm', title: 'Lab sheet due (Gradescope)', type: 'lab' });
      eventsOn(iso).filter(e => e[1] === 'exam' || e[1] === 'admin').forEach(e => items.push({ date: iso, time: e[1] === 'exam' ? 'in class' : '', title: e[2], type: e[1] }));
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, count);
  }

  /* ---------- router / layout ---------- */
  const App = { views: {}, current: null, icon, esc, h, $, $$, bind, on, toast, store, settings, setSetting, typeset, compileExpr, d1, d2, parseNumber, fmtNum,
    recordAnswer, markActivity, progress, streak, unitMastery, cardsMastered, checklistState, todayISO, toISO, parseISO, fmtDate, shortDate, addDays, daysBetween, relDays, weekOf, nextExam, currentSection, upcomingDeadlines, eventsOn };
  const NAV = [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Section notes', 'book'], ['formulas', 'Formula sheet', 'sigma'], ['flashcards', 'Flashcards', 'cards'], ['textbook', 'Textbook & links', 'link']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list'], ['exam1', 'Exam 1 prep', 'flag']] },
    { label: 'Tools', items: [['grapher', 'Grapher', 'chart'], ['labs', 'Labs', 'flask'], ['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ];
  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const view = parts[0] || 'dashboard';
    const param = parts.slice(1).join('/') || null;
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    return { view: App.views[view] ? view : 'dashboard', param, query };
  }
  App.go = (view, param, query) => { let hs = '#/' + view + (param ? '/' + param : ''); if (query) hs += '?' + new URLSearchParams(query).toString(); if (location.hash === hs) { render(); return; } try { location.hash = hs; } catch { render(); } };
  App.replaceHash = hs => { try { history.replaceState(null, '', hs); } catch { /* sandboxed host: ignore */ } };
  function render() {
    const { view, param, query } = route();
    if (App.current && App.current.unmount) { try { App.current.unmount(); } catch {} }
    const V = App.views[view]; App.current = V;
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#topbar-title').textContent = V.title;
    document.title = `${V.title} · M171 Study Hub`;
    const stale = $('#view'); const root = stale.cloneNode(false); stale.replaceWith(root); window.scrollTo(0, 0);
    V.render(root, param, query);
    typeset(root);
    $('.app').classList.remove('nav-open');
    updateExamChip();
  }
  function updateExamChip() {
    const ex = nextExam(); const chip = $('#exam-chip');
    if (!ex) { chip.innerHTML = `${icon('flag', 14)} <span>Semester complete</span>`; return; }
    const n = daysBetween(todayISO(), ex.date);
    chip.innerHTML = `${icon('flag', 14)} <span>${esc(ex.name)} ·</span> <b>${n === 0 ? 'today' : n === 1 ? 'tomorrow' : n + ' days'}</b>`;
  }
  function applyTheme() {
    const t = settings().theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const btn = $('#theme-btn'); if (btn) btn.innerHTML = icon(document.documentElement.getAttribute('data-theme') === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sun' : 'moon', 16);
  }
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    setSetting('theme', isDark ? 'light' : 'dark'); applyTheme();
  }
  function buildLayout() {
    const app = $('.app');
    const nav = NAV.map(g => `<div class="nav-label">${g.label}</div>` + g.items.map(([id, label, ic]) => `<button class="nav-item" data-view="${id}" data-action="nav">${icon(ic)}<span>${label}</span></button>`).join('')).join('');
    $('#sidebar-nav').innerHTML = nav;
    bind($('#sidebar'), { nav: el => App.go(el.dataset.view), 'pomo-toggle': () => Pomo.toggle(), 'pomo-reset': () => Pomo.reset(), 'pomo-mode': () => Pomo.switchMode() });
    bind($('#topbar'), { menu: () => app.classList.toggle('nav-open'), search: () => Search.open(), theme: toggleTheme, 'exam-chip': () => App.go('dashboard') });
    $('#nav-backdrop').addEventListener('click', () => app.classList.remove('nav-open'));
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Search.open(); }
      if (e.key === 'Escape') { Search.close(); app.classList.remove('nav-open'); }
    });
    window.addEventListener('hashchange', render);
  }

  /* ---------- Pomodoro ---------- */
  const Pomo = {
    mode: 'focus', left: 25 * 60, running: false, tick: null,
    len() { return this.mode === 'focus' ? 25 * 60 : 5 * 60; },
    draw() {
      const m = Math.floor(this.left / 60), s = this.left % 60;
      $('#pomo-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      $('#pomo-mode').textContent = this.mode === 'focus' ? 'Focus' : 'Break';
      $('#pomo-toggle').innerHTML = icon(this.running ? 'pause' : 'play', 15);
    },
    toggle() { this.running ? this.pause() : this.start(); },
    start() { if (this.running) return; this.running = true; this.tick = setInterval(() => { this.left--; if (this.left <= 0) { this.finish(); } this.draw(); }, 1000); this.draw(); },
    pause() { this.running = false; clearInterval(this.tick); this.draw(); },
    reset() { this.pause(); this.left = this.len(); this.draw(); },
    switchMode() { this.mode = this.mode === 'focus' ? 'break' : 'focus'; this.reset(); },
    finish() {
      this.pause(); this.beep(); markActivity();
      toast(this.mode === 'focus' ? 'Focus block done. Take a 5-minute break.' : 'Break over. Back to it.', 4000);
      this.mode = this.mode === 'focus' ? 'break' : 'focus'; this.left = this.len();
    },
    beep() { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); ac.close(); }, 500); } catch {} }
  };

  /* ---------- Search ---------- */
  const Search = {
    index: null, sel: 0, results: [],
    build() {
      const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\$[^$]*\$/g, m => m.replace(/\\[a-zA-Z]+|[{}$^_\\]/g, ' '));
      const ix = [];
      NAV.forEach(g => g.items.forEach(([id, label]) => ix.push({ type: 'page', t: label, s: g.label, go: () => App.go(id), key: label.toLowerCase() })));
      D.SECTIONS.forEach(s => ix.push({ type: 'notes', t: `§${s.id} ${s.title}`, s: `Unit ${s.unit}`, go: () => App.go('notes', s.id), key: (`${s.id} ${s.title} ` + s.ideas.map(strip).join(' ') + ' ' + s.pitfalls.map(strip).join(' ')).toLowerCase() }));
      D.FORMULAS.forEach(g => g.items.forEach(f => ix.push({ type: 'formula', t: f.n, s: g.group, go: () => App.go('formulas', null, { q: f.n }), key: (f.n + ' ' + g.group + ' ' + strip('$' + f.t + '$')).toLowerCase() })));
      D.FLASHCARDS.forEach(c => ix.push({ type: 'card', t: strip(c.f), s: `§${c.sec}`, go: () => App.go('flashcards', c.id), key: (strip(c.f) + ' ' + strip(c.b)).toLowerCase() }));
      D.CALENDAR.forEach(e => ix.push({ type: 'calendar', t: e[2], s: fmtDate(e[0]), go: () => App.go('calendar', e[0]), key: (e[2] + ' ' + fmtDate(e[0], true)).toLowerCase() }));
      Object.entries(QZ.TOPICS).forEach(([id, t]) => ix.push({ type: 'practice', t: `Practice: ${t.label}`, s: `§${t.sec}`, go: () => App.go('practice', null, { topics: id }), key: ('practice quiz ' + t.label + ' ' + t.sec).toLowerCase() }));
      this.index = ix;
    },
    open() {
      if (!this.index) this.build();
      if ($('#search-modal')) { $('#search-input').focus(); return; }
      const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'search-modal';
      m.innerHTML = `<div class="modal" role="dialog" aria-label="Search"><input id="search-input" class="search-input" placeholder="Search notes, formulas, flashcards, calendar…" autocomplete="off"><div class="search-results" id="search-results"></div><div class="search-foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) this.close(); });
      const inp = $('#search-input'); inp.focus();
      inp.addEventListener('input', () => this.query(inp.value));
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.sel = Math.min(this.sel + 1, this.results.length - 1); this.paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.sel = Math.max(this.sel - 1, 0); this.paint(); }
        else if (e.key === 'Enter') { const r = this.results[this.sel]; if (r) { this.close(); r.go(); } }
      });
      on($('#search-results'), 'click', '.search-item', el => { const r = this.results[+el.dataset.i]; if (r) { this.close(); r.go(); } });
      this.query('');
    },
    close() { const m = $('#search-modal'); if (m) m.remove(); },
    query(q) {
      q = q.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      this.results = !q ? this.index.filter(r => r.type === 'page').slice(0, 10)
        : this.index.map(r => ({ r, score: words.reduce((s, w) => s + (r.t.toLowerCase().includes(w) ? 3 : r.key.includes(w) ? 1 : -100), 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 14).map(x => x.r);
      this.sel = 0; this.paint();
    },
    paint() {
      const box = $('#search-results'); if (!box) return;
      box.innerHTML = this.results.length ? this.results.map((r, i) => `<div class="search-item${i === this.sel ? ' active' : ''}" data-i="${i}"><span class="type">${r.type}</span><span class="t">${esc(r.t)}</span><span class="s">${esc(r.s)}</span></div>`).join('') : `<div class="empty">No matches.</div>`;
    }
  };

  /* ---------- shared fragments ---------- */
  const secLink = s => `<a href="#/notes/${s.id}">§${s.id} ${esc(s.title)}</a>`;
  const unitBadge = u => `<span class="chip">Unit ${u}</span>`;
  const examFor = secId => D.EXAMS.find(e => e.sections.includes(secId));
  function topicsForSection(secId) { return Object.keys(QZ.TOPICS).filter(t => QZ.TOPICS[t].sec === secId); }
  const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;

  /* ======================================================
     VIEW: Dashboard
     ====================================================== */
  App.views.dashboard = {
    title: 'Dashboard',
    render(root) {
      const t = todayISO(); const d = today();
      const ex = nextExam();
      const wk = weekOf(t);
      const todayEv = eventsOn(t);
      const dl = upcomingDeadlines(6);
      const st = streak();
      const hist = store.get('history', []);
      const answered = hist.length, correct = hist.filter(x => x.ok).length;
      const cm = cardsMastered();
      const cur = currentSection();
      const weekMon = addDays(d, -((d.getDay() + 6) % 7));
      const weekDays = Array.from({ length: 5 }, (_, i) => toISO(addDays(weekMon, i)));
      const cl = ex ? checklistState(ex.id) : { items: [], done: 0 };
      const p = progress();
      const weak = Object.entries(p).filter(([k, v]) => v.a >= 3 && v.c / v.a < 0.7).sort((a, b) => (a[1].c / a[1].a) - (b[1].c / b[1].a)).slice(0, 4);

      const examTile = ex ? `
        <div class="panel lift hero-exam">
          <div class="countdown"><div class="countdown-num">${daysBetween(t, ex.date)}</div><div class="countdown-label">${daysBetween(t, ex.date) === 1 ? 'day' : 'days'} to go</div></div>
          <div>
            <div class="eyebrow">Next exam · ${ex.weight}% of the grade</div>
            <h2 style="font-size:26px;margin-top:2px">${esc(ex.name)} <span class="muted" style="font-size:16px;font-weight:400">· ${esc(ex.dateLabel || fmtDate(ex.date, true))}</span></h2>
            <p class="muted mt-1">Covers ${esc(ex.covers)}. No calculators, no electronics.</p>
            <div class="bar-row mt-2"><span>Prep checklist</span><span class="mono">${cl.done} / ${cl.items.length}</span><div class="bar"><div class="bar-fill gold" style="width:${cl.items.length ? 100 * cl.done / cl.items.length : 0}%"></div></div></div>
            <div class="row mt-2">
              ${ex.id === 'exam1' ? `<a class="btn primary" href="#/exam1">${icon('flag', 14)} Exam 1 practice set</a>` : ''}
              <a class="btn" href="#/practice?exam=${ex.id}">${icon('list', 14)} Drill ${esc(ex.name)} topics</a>
              <a class="btn" href="#/flashcards?unit=${ex.units[ex.units.length - 1]}">${icon('cards', 14)} Flashcards</a>
            </div>
          </div>
        </div>` : `<div class="panel lift"><h2>Semester complete</h2><p class="muted">Nice work. The final was the last exam on the calendar.</p></div>`;

      root.innerHTML = `
        <div class="page-head"><div><div class="eyebrow">${esc(fmtDate(t, true))} · Week ${wk} of the semester</div><h1 class="page-title">Good ${d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening'}. Here's where things stand.</h1></div></div>
        <div class="stack">
          ${examTile}
          <div class="grid cols-3">
            <div class="panel">
              <div class="panel-h"><div class="panel-title">${icon('calendar')} Today</div><a href="#/calendar" class="small">Full calendar</a></div>
              ${todayEv.length ? todayEv.map(e => `<div class="today-ev"><span class="chip ${e[1]}">${e[1]}</span><span>${esc(e[2])}</span></div>`).join('') : `<div class="empty">No class today.${(() => { const nx = D.CALENDAR.find(e => e[0] > t && (e[1] === 'lecture' || e[1] === 'exam')); return nx ? ` Next: ${esc(nx[2])} on ${fmtDate(nx[0])}.` : ''; })()}</div>`}
              <div class="divider"></div>
              <div class="eyebrow mb-1">Current section</div>
              <a class="card-link" href="#/notes/${cur.id}"><h4>§${cur.id} ${esc(cur.title)}</h4><p>Open the notes, worked example and practice for this section.</p></a>
            </div>
            <div class="panel">
              <div class="panel-h"><div class="panel-title">${icon('clock')} Due soon</div><span class="small muted">Lab day: ${settings().labDay === 'thu' ? 'Thu' : 'Tue'} · <a href="#/settings">change</a></span></div>
              ${dl.length ? dl.map(x => `<div class="today-ev"><span class="when">${daysBetween(t, x.date) === 0 ? 'Today' : daysBetween(t, x.date) === 1 ? 'Tomorrow' : esc(fmtDate(x.date))}</span><span>${esc(x.title)}${x.time ? ` <span class="muted small">· ${esc(x.time)}</span>` : ''}</span></div>`).join('') : '<div class="empty">Nothing scheduled.</div>'}
              <p class="small muted mt-2">Recurring rules from the syllabus. Confirm exact assignments in WebWork and Canvas.</p>
            </div>
            <div class="panel">
              <div class="panel-h"><div class="panel-title">${icon('fire')} Your progress</div></div>
              <div class="grid cols-2" style="gap:10px">
                <div class="stat"><div class="stat-num">${st}</div><div class="stat-label">day streak</div></div>
                <div class="stat"><div class="stat-num">${answered ? Math.round(100 * correct / answered) : 0}%</div><div class="stat-label">accuracy · ${answered} answered</div></div>
                <div class="stat"><div class="stat-num">${cm.mastered}<span class="muted" style="font-size:15px">/${cm.total}</span></div><div class="stat-label">flashcards mastered</div></div>
                <div class="stat"><div class="stat-num">${hist.filter(x => x.d === t).length}</div><div class="stat-label">questions today</div></div>
              </div>
              <div class="divider"></div>
              ${D.UNITS.map(u => { const m = unitMastery(u.n); return `<div class="bar-row"><span>Unit ${u.n} · ${esc(u.title)}</span><span class="mono">${m.a ? m.pct + '%' : '—'}</span><div class="bar"><div class="bar-fill ${m.pct >= 80 ? 'good' : m.pct >= 60 ? 'warn' : m.a ? 'bad' : ''}" style="width:${m.a ? m.pct : 0}%"></div></div></div>`; }).join('')}
            </div>
          </div>
          <div class="grid cols-3">
            <div class="panel span-2">
              <div class="panel-h"><div class="panel-title">${icon('calendar')} This week</div><span class="small muted">${esc(shortDate(weekDays[0]))} – ${esc(shortDate(weekDays[4]))}</span></div>
              <div class="week-strip">${weekDays.map(iso => { const dd = parseISO(iso); const evs = eventsOn(iso); return `<div class="week-day${iso === t ? ' today' : iso < t ? ' past' : ''}"><div class="d">${DOW[dd.getDay()]}<span>${dd.getDate()}</span></div>${evs.length ? evs.map(e => `<div class="ev ${e[1]}">${esc(e[2])}</div>`).join('') : '<div class="ev muted">—</div>'}</div>`; }).join('')}</div>
            </div>
            <div class="panel">
              <div class="panel-h"><div class="panel-title">${icon('target')} Needs work</div></div>
              ${weak.length ? weak.map(([k, v]) => `<div class="bar-row"><span>${esc(QZ.TOPICS[k]?.label || k)}</span><span class="mono">${Math.round(100 * v.c / v.a)}%</span><div class="bar"><div class="bar-fill bad" style="width:${100 * v.c / v.a}%"></div></div></div>`).join('') + `<a class="btn sm mt-2" href="#/practice?topics=${weak.map(w => w[0]).join(',')}">Practice these</a>` : `<div class="empty">Answer a few quizzer questions and your weakest topics will show up here.</div>`}
            </div>
          </div>
          <div class="grid cols-4">
            <a class="card-link" href="#/formulas"><div class="eyebrow">Reference</div><h4>Formula sheet</h4><p>Every rule from limits to the second FTC, printable.</p></a>
            <a class="card-link" href="#/grapher"><div class="eyebrow">Tool</div><h4>Grapher</h4><p>Type any f(x); see tangent and secant lines, f′ and f″.</p></a>
            <a class="card-link" href="#/labs"><div class="eyebrow">Tool</div><h4>Labs</h4><p>Limit tables, difference quotients, Riemann sums, data derivatives.</p></a>
            <a class="card-link" href="#/grades"><div class="eyebrow">Planning</div><h4>Grade calculator</h4><p>Where you stand and what you need on the final.</p></a>
          </div>
        </div>`;
    }
  };

  /* ======================================================
     VIEW: Calendar
     ====================================================== */
  App.views.calendar = {
    title: 'Calendar',
    render(root, param) {
      const t = todayISO();
      const start = parseISO(D.SEMESTER.start);
      const weeks = [];
      for (let w = 0; ; w++) { const mon = addDays(start, 7 * w); if (toISO(mon) > D.SEMESTER.end) break; weeks.push(Array.from({ length: 5 }, (_, i) => toISO(addDays(mon, i)))); }
      root.innerHTML = pageHead('Fall 2026 calendar', 'Lectures Mon · Wed · Fri, lab Tue or Thu. Subject to change; the instructor’s Canvas calendar wins.',
        `<button class="btn" data-action="today">${icon('target', 14)} Jump to today</button><button class="btn" data-action="print">${icon('print', 14)} Print</button>`) + `
        <div class="grid cols-3 mb-2">
          <div class="panel span-2">
            <div class="cal-legend"><span class="chip lecture">Lecture</span><span class="chip lab">Lab</span><span class="chip exam">Exam</span><span class="chip admin">Deadline</span><span class="chip holiday">No class</span><span class="chip review">Review</span></div>
          </div>
          <div class="panel">
            <div class="eyebrow mb-1">Standing due times</div>
            ${D.COURSE.deadlines.map(x => `<div class="small" style="padding:4px 0"><b>${esc(x.name)}.</b> ${esc(x.rule)}</div>`).join('')}
          </div>
        </div>
        <div class="cal-head"><span>Week</span><span>Monday</span><span>Tuesday</span><span>Wednesday</span><span>Thursday</span><span>Friday</span></div>
        ${weeks.map((wk, i) => `<div class="cal-week"><div class="cal-wk">Wk ${i + 1}</div>${wk.map(iso => { const dd = parseISO(iso); const evs = eventsOn(iso); const isExam = evs.some(e => e[1] === 'exam' && !/Finals week$/.test(e[2])); return `<div class="cal-day${iso === t ? ' today' : ''}${iso < t ? ' past' : ''}${isExam ? ' exam-day' : ''}" id="cal-${iso}"><div class="cal-date"><b>${dd.getDate()}</b><span>${MON[dd.getMonth()]}</span></div>${evs.map(e => `<div class="cal-ev ${e[1]}">${esc(e[2])}</div>`).join('')}</div>`; }).join('')}</div>`).join('')}`;
      bind(root, {
        today: () => { const el = $('#cal-' + t) || $('.cal-day'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
        print: () => window.print()
      });
      const target = param && $('#cal-' + param); if (target) setTimeout(() => target.scrollIntoView({ block: 'center' }), 50);
    }
  };

  /* ======================================================
     VIEW: Section notes
     ====================================================== */
  App.views.notes = {
    title: 'Section notes',
    render(root, param) {
      const sec = D.SECTIONS.find(s => s.id === param) || currentSection();
      const idx = D.SECTIONS.indexOf(sec);
      const prev = D.SECTIONS[idx - 1], next = D.SECTIONS[idx + 1];
      const ex = examFor(sec.id);
      const topics = topicsForSection(sec.id);
      const navHtml = D.UNITS.map(u => `<div class="nav-label">Unit ${u.n} · ${esc(u.title)}</div>` + u.sections.map(id => { const s = D.SECTIONS.find(x => x.id === id); return `<button class="sec-link${s.id === sec.id ? ' active' : ''}" data-action="open" data-id="${s.id}"><span class="num">${s.id}</span><span>${esc(s.title)}</span></button>`; }).join('')).join('');
      root.innerHTML = `
        <div class="notes-layout">
          <div class="panel sec-nav">${navHtml}</div>
          <div class="stack">
            <div class="panel">
              <div class="note-head"><span class="note-num">§${sec.id}</span>${unitBadge(sec.unit)}${ex ? `<span class="chip exam">${esc(ex.name)}</span>` : ''}<a class="small" style="margin-left:auto" href="${D.COURSE.textbookBase}${sec.slug}" target="_blank" rel="noopener">Read in Active Calculus ${icon('external', 12)}</a></div>
              <h2 class="note-title">${esc(sec.title)}</h2>
              <div class="note-block"><h4>Big ideas</h4><ul class="list">${sec.ideas.map(i => `<li>${i}</li>`).join('')}</ul></div>
              <div class="note-block"><h4>Key formulas</h4>${sec.formulas.map(f => `<div class="formula-row"><div class="name">${esc(f.n)}</div><div class="tex">$$${f.t}$$</div></div>`).join('')}</div>
              <div class="note-block"><h4>Worked example</h4><div class="callout"><div>${sec.example.p}</div><button class="btn sm mt-2" data-action="reveal">${icon('eye', 14)} Show solution</button><div class="reveal mt-2" id="sol">${sec.example.s}</div></div></div>
              <div class="note-block"><h4>Common mistakes</h4><ul class="list">${sec.pitfalls.map(i => `<li>${i}</li>`).join('')}</ul></div>
              <div class="note-block"><div class="callout tip"><div class="eyebrow">Exam tip</div>${sec.tip}</div></div>
              <div class="row between mt-3">
                <div>${prev ? `<button class="btn" data-action="open" data-id="${prev.id}">${icon('left', 14)} §${prev.id}</button>` : ''}</div>
                <div class="row">${topics.length ? `<a class="btn primary" href="#/practice?topics=${topics.join(',')}">${icon('list', 14)} Practice §${sec.id}</a>` : ''}<a class="btn" href="#/flashcards?sec=${sec.id}">${icon('cards', 14)} Cards</a></div>
                <div>${next ? `<button class="btn" data-action="open" data-id="${next.id}">§${next.id} ${icon('right', 14)}</button>` : ''}</div>
              </div>
            </div>
          </div>
        </div>`;
      bind(root, {
        open: el => App.go('notes', el.dataset.id),
        reveal: el => { const s = $('#sol', root); s.classList.toggle('open'); el.innerHTML = s.classList.contains('open') ? `${icon('eye', 14)} Hide solution` : `${icon('eye', 14)} Show solution`; }
      });
    }
  };

  /* ======================================================
     VIEW: Formula sheet
     ====================================================== */
  App.views.formulas = {
    title: 'Formula sheet',
    render(root, param, query) {
      const q = (query.q || '').toLowerCase();
      const paint = filter => {
        const f = filter.toLowerCase();
        $('#fs-body', root).innerHTML = `<div class="grid cols-2">${D.FORMULAS.map(g => { const items = g.items.filter(it => !f || it.n.toLowerCase().includes(f) || g.group.toLowerCase().includes(f)); if (!items.length) return ''; return `<div class="panel fs-group"><h3>${esc(g.group)}</h3>${items.map(it => `<div class="fs-row"><div class="name">${esc(it.n)}</div><div class="tex">$$${it.t}$$</div></div>`).join('')}</div>`; }).join('') || '<div class="empty">No formulas match.</div>'}</div>`;
        typeset($('#fs-body', root));
      };
      root.innerHTML = pageHead('Formula sheet', 'Everything from §1.1 to §5.2 on one page. Exams are closed-book: use this to test what you can rewrite from memory.',
        `<input class="input" id="fs-filter" placeholder="Filter (e.g. chain, FTC)…" value="${esc(query.q || '')}" style="width:220px"><button class="btn" data-action="print">${icon('print', 14)} Print</button>`) + `<div id="fs-body"></div>`;
      paint(q);
      $('#fs-filter', root).addEventListener('input', e => paint(e.target.value));
      bind(root, { print: () => window.print() });
    }
  };

  /* ======================================================
     VIEW: Flashcards
     ====================================================== */
  App.views.flashcards = {
    title: 'Flashcards',
    state: { unit: 0, sec: null, deck: [], i: 0, flipped: false, mode: 'due' },
    render(root, param, query) {
      const st = this.state;
      if (query.unit) st.unit = +query.unit;
      if (query.sec) st.sec = query.sec; else if (!param) st.sec = null;
      const boxes = () => store.get('flashcards', {});
      const buildDeck = () => {
        const b = boxes();
        let cards = D.FLASHCARDS.filter(c => (!st.unit || c.unit === st.unit) && (!st.sec || c.sec === st.sec));
        cards = QZ.helpers.shuffle(cards);
        if (st.mode === 'due') cards.sort((x, y) => (b[x.id] || 0) - (b[y.id] || 0));
        st.deck = cards; st.i = 0; st.flipped = false;
        if (param) { const k = cards.findIndex(c => c.id === param); if (k >= 0) st.i = k; }
      };
      buildDeck();
      const paint = () => {
        const b = boxes(); const c = st.deck[st.i];
        const mastered = st.deck.filter(x => (b[x.id] || 0) >= 3).length;
        $('#fc-stats', root).innerHTML = `<span class="chip good">${mastered} mastered</span><span class="chip">${st.deck.length} cards</span>`;
        const stage = $('#fc-stage', root);
        if (!c) { stage.innerHTML = '<div class="empty">No cards match this filter.</div>'; return; }
        const box = b[c.id] || 0;
        stage.innerHTML = `<div class="fc-card${st.flipped ? ' flipped' : ''}" id="fc-card" tabindex="0" role="button" aria-label="Flip card">
            <div class="fc-face fc-front"><span class="eyebrow">Card ${st.i + 1} / ${st.deck.length} · box ${box}</span><span class="sec chip">§${c.sec}</span><div>${c.f}</div><div class="fc-hint">Click or press space to flip</div></div>
            <div class="fc-face fc-back"><span class="eyebrow">Answer</span><span class="sec chip">§${c.sec}</span><div>${c.b}</div></div>
          </div>`;
        $('#fc-controls', root).innerHTML = `
          <button class="btn" data-action="prev" ${st.i === 0 ? 'disabled' : ''}>${icon('left', 14)} Prev</button>
          <button class="btn danger" data-action="again">Again <span class="kbd">1</span></button>
          <button class="btn primary" data-action="good">Got it <span class="kbd">2</span></button>
          <button class="btn" data-action="next" ${st.i >= st.deck.length - 1 ? 'disabled' : ''}>Next ${icon('right', 14)}</button>`;
        typeset(stage);
      };
      root.innerHTML = pageHead('Flashcards', 'Definitions, rules and theorems. "Got it" moves a card up a box; three boxes means mastered. "Again" sends it back to the start.') + `
        <div class="panel">
          <div class="row between mb-2">
            <div class="chips">${[0, 1, 2, 3, 4].map(u => `<span class="chip toggle${st.unit === u ? ' on' : ''}" data-action="unit" data-u="${u}">${u ? 'Unit ' + u : 'All units'}</span>`).join('')}${st.sec ? `<span class="chip accent">§${st.sec} <span data-action="clearsec" style="cursor:pointer">✕</span></span>` : ''}</div>
            <div class="row"><span id="fc-stats" class="row gap-sm"></span><button class="btn sm" data-action="mode">${st.mode === 'due' ? 'Order: weakest first' : 'Order: shuffled'}</button><button class="btn sm" data-action="reshuffle">${icon('rotate', 13)} Reshuffle</button><button class="btn sm ghost" data-action="reset">Reset progress</button></div>
          </div>
          <div class="fc-stage" id="fc-stage"></div>
          <div class="fc-controls" id="fc-controls"></div>
        </div>`;
      paint();
      const grade = up => { const c = st.deck[st.i]; if (!c) return; const b = boxes(); b[c.id] = up ? Math.min(3, (b[c.id] || 0) + 1) : 0; store.set('flashcards', b); markActivity(); if (st.i < st.deck.length - 1) st.i++; st.flipped = false; paint(); };
      const flip = () => { st.flipped = !st.flipped; const el = $('#fc-card', root); if (el) el.classList.toggle('flipped', st.flipped); };
      bind(root, {
        unit: el => { st.unit = +el.dataset.u; st.sec = null; App.go('flashcards', null, { unit: st.unit }); },
        clearsec: () => { st.sec = null; App.go('flashcards'); },
        mode: () => { st.mode = st.mode === 'due' ? 'shuffle' : 'due'; buildDeck(); this.render(root, null, {}); },
        reshuffle: () => { buildDeck(); paint(); },
        reset: () => { if (confirm('Reset flashcard progress for all cards?')) { store.set('flashcards', {}); paint(); toast('Flashcard progress reset'); } },
        prev: () => { if (st.i > 0) { st.i--; st.flipped = false; paint(); } },
        next: () => { if (st.i < st.deck.length - 1) { st.i++; st.flipped = false; paint(); } },
        again: () => grade(false), good: () => grade(true)
      });
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
      root.innerHTML = pageHead('Textbook & links', 'Active Calculus is free online. The hosted PDF below streams from your own server if you upload it as active_calculus.pdf next to index.html.') + `
        <div class="stack">
          <div class="grid cols-3">
            <a class="card-link" href="${D.COURSE.textbook.url}" target="_blank" rel="noopener"><div class="eyebrow">Textbook</div><h4>Active Calculus online ${icon('external', 12)}</h4><p>${esc(D.COURSE.textbook.title)}</p></a>
            <a class="card-link" href="${D.COURSE.webwork}" target="_blank" rel="noopener"><div class="eyebrow">Homework</div><h4>WebWork F26 M171 ${icon('external', 12)}</h4><p>Due 8:00 pm Mon / Tue / Thu. PreQuizzes live here too.</p></a>
            <a class="card-link" href="${D.COURSE.canvas}" target="_blank" rel="noopener"><div class="eyebrow">Course site</div><h4>Canvas ${icon('external', 12)}</h4><p>Unit packets, preview activities, videos, Gradescope links.</p></a>
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('book')} Sections covered this semester</div></div>
            ${D.UNITS.map(u => `<div class="eyebrow mt-2 mb-1">Unit ${u.n} · ${esc(u.title)}</div><div class="link-grid">${u.sections.map(id => { const s = D.SECTIONS.find(x => x.id === id); return `<a class="card-link" href="${D.COURSE.textbookBase}${s.slug}" target="_blank" rel="noopener" style="padding:10px 12px"><h4 style="font-size:14px">§${s.id} ${esc(s.title)}</h4><p style="margin-top:2px"><a href="#/notes/${s.id}">Notes on this site</a></p></a>`; }).join('')}</div>`).join('')}
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('file')} Hosted PDF</div><a class="btn sm" href="active_calculus.pdf" target="_blank" rel="noopener">${icon('external', 13)} Open in new tab</a></div>
            <iframe class="pdf-frame" src="active_calculus.pdf" title="Active Calculus PDF"></iframe>
            <p class="small muted mt-1">Blank frame? Upload <code>active_calculus.pdf</code> to the same folder as this site’s <code>index.html</code>, or use the online textbook links above.</p>
          </div>
        </div>`;
    }
  };

  /* ======================================================
     VIEW: Grades
     ====================================================== */
  App.views.grades = {
    title: 'Grade calculator',
    render(root) {
      const cats = D.GRADING.categories;
      const saved = store.get('grades', {});
      const letterFor = pct => D.GRADING.scale.find(s => pct >= s.min)?.letter || 'F';
      const compute = () => {
        const vals = {}; cats.forEach(c => { const v = parseFloat($(`#g-${c.id}`, root).value); if (!isNaN(v)) vals[c.id] = Math.max(0, Math.min(100, v)); });
        store.set('grades', vals);
        const entered = cats.filter(c => c.id in vals);
        const wSum = entered.reduce((s, c) => s + c.weight, 0);
        const cur = wSum ? entered.reduce((s, c) => s + c.weight * vals[c.id], 0) / wSum : NaN;
        const known = entered.reduce((s, c) => s + c.weight * vals[c.id], 0);
        const out = $('#g-out', root);
        if (!wSum) { out.innerHTML = '<div class="empty">Enter a percentage for at least one category.</div>'; return; }
        const remainingNoFinal = cats.filter(c => !(c.id in vals) && c.id !== 'final').reduce((s, c) => s + c.weight, 0);
        const finalEntered = 'final' in vals;
        const need = D.GRADING.scale.filter(s => s.letter !== 'F').map(s => {
          // assume unentered non-final categories score at the current average; solve for final
          const base = known + remainingNoFinal * cur;
          const needed = finalEntered ? null : (s.min * 100 - base) / 20;
          return { letter: s.letter, needed };
        });
        out.innerHTML = `
          <div class="grid cols-3">
            <div class="stat"><div class="grade-letter">${letterFor(cur)}</div><div class="stat-label">current letter grade</div></div>
            <div class="stat"><div class="stat-num">${cur.toFixed(1)}%</div><div class="stat-label">weighted average of what you entered (${wSum}% of the grade)</div></div>
            <div class="stat"><div class="stat-num">${(known / 100).toFixed(1)}</div><div class="stat-label">points already banked out of 100</div></div>
          </div>
          ${finalEntered ? '' : `<div class="divider"></div><div class="eyebrow mb-1">What you need on the final (20%)</div><p class="small muted mb-1">Assumes the categories you left blank end up at your current average.</p>
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Target</th><th class="num">Final exam score needed</th><th>Verdict</th></tr></thead><tbody>${need.map(n => `<tr><td><b>${n.letter}</b></td><td class="num">${n.needed <= 0 ? 'any score' : n.needed > 100 ? '> 100%' : n.needed.toFixed(1) + '%'}</td><td class="small">${n.needed <= 0 ? '<span class="chip good">locked in</span>' : n.needed > 100 ? '<span class="chip bad">out of reach</span>' : n.needed > 90 ? '<span class="chip warn">tough</span>' : '<span class="chip good">doable</span>'}</td></tr>`).join('')}</tbody></table></div>`}`;
      };
      root.innerHTML = pageHead('Grade calculator', 'Weights come straight from the syllabus. Leave a category blank if it has not happened yet.') + `
        <div class="grid cols-3">
          <div class="panel span-2">
            <div class="panel-h"><div class="panel-title">${icon('calc')} Your scores</div><button class="btn sm ghost" data-action="clear">Clear</button></div>
            <div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th class="num">Weight</th><th>Your %</th></tr></thead><tbody>
              ${cats.map(c => `<tr class="grade-row"><td>${esc(c.name)}</td><td class="num">${c.weight}%</td><td><input class="input mono" id="g-${c.id}" type="number" min="0" max="100" step="0.1" placeholder="—" value="${saved[c.id] ?? ''}"></td></tr>`).join('')}
            </tbody></table></div>
          </div>
          <div class="stack">
            <div class="panel" id="g-out"></div>
            <div class="panel">
              <div class="eyebrow mb-1">Letter grade scale</div>
              <div class="table-wrap"><table class="table compact"><thead><tr><th>Grade</th><th class="num">Percent</th><th class="num">4-point</th></tr></thead><tbody>${D.GRADING.scale.map(s => `<tr><td><b>${s.letter}</b></td><td class="num">${s.min === 0 ? '< 62.5' : '≥ ' + s.min}</td><td class="num">${s.fourPt}</td></tr>`).join('')}</tbody></table></div>
            </div>
          </div>
        </div>
        <div class="panel mt-2">
          <div class="panel-h"><div class="panel-title">${icon('list')} How written work is scored (4-point rubric)</div></div>
          <div class="table-wrap"><table class="table compact"><tbody>${D.GRADING.rubric.map(r => `<tr><td style="width:120px"><b>${r.score} · ${esc(r.name)}</b></td><td>${esc(r.desc)}</td></tr>`).join('')}</tbody></table></div>
          <p class="small muted mt-1">Answers alone earn little credit. Show work, explain your thinking, use correct notation, and do not submit scratch paper.</p>
        </div>`;
      compute();
      $$('input', root).forEach(i => i.addEventListener('input', compute));
      bind(root, { clear: () => { $$('input', root).forEach(i => i.value = ''); compute(); } });
    }
  };

  /* ======================================================
     VIEW: Course info
     ====================================================== */
  App.views.course = {
    title: 'Syllabus & policies',
    render(root) {
      const C = D.COURSE;
      root.innerHTML = pageHead('Syllabus & policies', `${C.code} ${C.name} · ${C.term} · ${C.school}. The essentials from the syllabus, in one place.`) + `
        <div class="grid cols-2">
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('info')} Course facts</div></div>
            <ul class="list-plain small">
              <li><b>Credits:</b> ${C.credits}. Plan on <b>${C.weeklyHours}+ hours per week</b> including class.</li>
              <li><b>Format:</b> ${esc(C.classDays)}. Bring a laptop to lab.</li>
              <li><b>Textbook:</b> <a href="${C.textbook.url}" target="_blank" rel="noopener">${esc(C.textbook.title)}</a> (free).</li>
              <li><b>Homework:</b> <a href="${C.webwork}" target="_blank" rel="noopener">WebWork</a> for online work; written work through Gradescope; everything else in Canvas.</li>
              <li><b>Exams:</b> four unit exams in class plus a cumulative final in finals week. <b>No calculators, electronics, or phones.</b></li>
              <li><b>Exam conflicts:</b> contact ${esc(C.successCoordinator)} with your name, section, reason, and exam. Work, travel, and long weekends do not count.</li>
              <li><b>Quizzes:</b> in-class and take-home, no make-ups, lowest score(s) dropped.</li>
            </ul>
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('clock')} Deadlines</div></div>
            <ul class="list-plain small">${C.deadlines.map(d => `<li><b>${esc(d.name)}.</b> ${esc(d.rule)}</li>`).join('')}</ul>
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('bulb')} Where to get help</div></div>
            <ul class="list-plain small">
              <li><b>${esc(C.helpCenter.name)}</b> · ${esc(C.helpCenter.where)} · ${esc(C.helpCenter.hours)}.</li>
              <li><b>Office hours</b> with your instructor and lab assistants (strongly encouraged).</li>
              <li><b>${esc(C.tutoring)}</b> tutoring support.</li>
              <li><b>Short videos</b> for each section, posted in Canvas modules.</li>
              <li><b>Study groups:</b> work together on concepts; submit your own work.</li>
              <li><b>Disability Services</b> · ${esc(C.disability.where)} · <a href="${C.disability.url}" target="_blank" rel="noopener">details</a>.</li>
            </ul>
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('flag')} Exams and weights</div></div>
            <div class="table-wrap"><table class="table compact"><thead><tr><th>Exam</th><th>Date</th><th>Covers</th><th class="num">Weight</th></tr></thead><tbody>${D.EXAMS.map(e => `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.dateLabel || fmtDate(e.date))}</td><td class="small">${esc(e.covers)}</td><td class="num">${e.weight}%</td></tr>`).join('')}</tbody></table></div>
          </div>
          <div class="panel span-2">
            <div class="panel-h"><div class="panel-title">${icon('list')} Written work expectations</div></div>
            <p class="small">Show all work and explain your reasoning in clear, precise mathematical language. Equations without explanation do not receive full credit; answers alone receive little or none. Be neat and use correct notation. Graded on the <a href="#/grades">four-point rubric</a>.</p>
            <div class="divider"></div>
            <div class="eyebrow mb-1">AI use policy (summary)</div>
            <p class="small">Generative AI is allowed as a <em>support</em> for learning: clarifying concepts, generating practice questions, checking your work for errors, making study plans. It must not replace your own thinking or produce submitted work. Attempt problems first, ask specific questions, and verify everything: you are responsible for correctness. All submitted work must be your own.</p>
            <div class="divider"></div>
            <div class="eyebrow mb-1">Academic integrity</div>
            <p class="small">Cheating and plagiarism, including copying from solution manuals or answer sites when not allowed, lead to disciplinary action up to a failing grade. When collaboration is permitted, acknowledge your collaborators and cite sources.</p>
          </div>
        </div>`;
    }
  };

  /* ======================================================
     VIEW: Settings
     ====================================================== */
  App.views.settings = {
    title: 'Settings',
    render(root) {
      const s = settings();
      root.innerHTML = pageHead('Settings', 'Preferences and your saved progress. Everything lives in this browser; export a backup before switching devices.') + `
        <div class="grid cols-2">
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('sliders')} Preferences</div></div>
            <div class="field mb-2"><label>Theme</label><select class="select" id="s-theme"><option value="system"${s.theme === 'system' ? ' selected' : ''}>Match system</option><option value="light"${s.theme === 'light' ? ' selected' : ''}>Light</option><option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Dark</option></select></div>
            <div class="field"><label>Your lab day</label><select class="select" id="s-lab"><option value="tue"${s.labDay !== 'thu' ? ' selected' : ''}>Tuesday</option><option value="thu"${s.labDay === 'thu' ? ' selected' : ''}>Thursday</option></select><span class="help">Sets when lab sheets show as due on the dashboard (8:00 pm the day after lab).</span></div>
            <div class="divider"></div>
            <div class="eyebrow mb-1">Keyboard shortcuts</div>
            <ul class="list-plain small">
              <li><span class="kbd">Ctrl</span> + <span class="kbd">K</span> search anything</li>
              <li><span class="kbd">Space</span> flip a flashcard · <span class="kbd">1</span> again · <span class="kbd">2</span> got it · <span class="kbd">←</span> <span class="kbd">→</span> move</li>
              <li><span class="kbd">1</span>–<span class="kbd">4</span> choose an answer in the quizzer · <span class="kbd">Enter</span> check a typed answer</li>
            </ul>
          </div>
          <div class="panel">
            <div class="panel-h"><div class="panel-title">${icon('download')} Your data</div></div>
            <p class="small muted mb-2">Quiz history, flashcard boxes, checklists, grade entries and scratchpad strokes.</p>
            <div class="row">
              <button class="btn" data-action="export">${icon('download', 14)} Export backup</button>
              <label class="btn">${icon('rotate', 14)} Import backup <input type="file" id="s-import" accept="application/json" hidden></label>
              <button class="btn danger" data-action="reset">${icon('trash', 14)} Reset everything</button>
            </div>
            <textarea class="input mono mt-2" id="s-json" rows="8" placeholder="Export writes your backup here; paste a backup here and click Import from text." spellcheck="false"></textarea>
            <button class="btn sm mt-1" data-action="import-text">Import from text</button>
          </div>
        </div>`;
      $('#s-theme', root).addEventListener('change', e => { setSetting('theme', e.target.value); applyTheme(); });
      $('#s-lab', root).addEventListener('change', e => { setSetting('labDay', e.target.value); toast('Lab day saved'); });
      $('#s-import', root).addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(txt => { try { store.importJSON(txt); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } }); });
      bind(root, {
        export: () => { const txt = store.exportJSON(); $('#s-json', root).value = txt; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `m171-backup-${todayISO()}.json`; a.click(); } catch {} toast('Backup ready'); },
        'import-text': () => { try { store.importJSON($('#s-json', root).value); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } },
        reset: () => { if (confirm('Erase all saved progress on this device?')) { store.reset(); toast('Progress reset'); render(); } }
      });
    }
  };

  /* ---------- boot ---------- */
  global.App = App;
  document.addEventListener('DOMContentLoaded', () => {
    buildLayout();
    Pomo.draw();
    render();
    if (global.MathJax && global.MathJax.startup && global.MathJax.startup.promise) global.MathJax.startup.promise.then(() => typeset($('#view')));
  });
})(window);
