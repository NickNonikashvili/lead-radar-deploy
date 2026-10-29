/* ============================================================
   StudyCat — application shell
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
  global.MATHUB_ASSETS_BUILD = '2026.10.29.7';   // the build these scripts belong to (scripts/release.js writes it; build-check.js compares it with the page's)
  const Courses = global.Courses || (global.Courses = {});
  const COURSE_ORDER = ['calc', 'physics', 'precalc', 'writ', 'csci', 'biob', 'kin', 'psyx'];
  const GLOBAL_VIEWS = ['instructors', 'contact', 'forum', 'policy', 'admin', 'challenge', 'people', 'settings', 'leagues', 'gpa', 'today', 'whatsnew', 'resources', 'guides', 'focus', 'recap', 'tools', 'mistakes', 'join', 'sheet', 'request', 'teach', 'class', 'syllabus', 'notfound', 'create', 'maker', 'c', 'tutor', 'plan', 'tasks', 'timetable', 'agenda', 'timelog', 'projects', 'habits', 'goals', 'wheel', 'journal', 'money', 'career', 'portfolio', 'max', 'unsubscribe', 'room', 'calls', 'usage', 'customize', 'off'];   // pages that work without a course, e.g. #/contact
  const SITE = 'StudyCat';
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
  function toast(msg, ms = 1800) { $$('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; if (/^\s*<(svg|b|i)\b/.test(msg)) t.innerHTML = msg; else t.textContent = msg; document.body.appendChild(t); setTimeout(() => (App.dismiss ? App.dismiss(t, 220) : t.remove()), ms); }

  /* ---------- icons ---------- */
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>', image: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>', megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    d20: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><path d="M12 6.5l5.2 9H6.8z"/><path d="M12 2v4.5M12 6.5L3.3 7M12 6.5L20.7 7M17.2 15.5L20.7 7M17.2 15.5L20.7 17M17.2 15.5L12 22M6.8 15.5L12 22M6.8 15.5L3.3 17M6.8 15.5L3.3 7"/>', wand: '<path d="M4 20l10-10"/><path d="M17 3l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/><path d="M20 13v2M19 14h2M8 4v2M7 5h2"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', orb: '<circle cx="12" cy="10" r="6.5"/><path d="M7 20h10M8.5 16.5L7 20M15.5 16.5L17 20"/><path d="M9.5 8.5a3 3 0 0 1 2.5-2"/>', sword: '<path d="M20 4l-10.5 10.5M20 4h-4.2M20 4v4.2M6.5 12.5l5 5M8 16l-3.5 3.5"/>', potion: '<path d="M9.5 3h5M10.5 3v5.2L6 15.5A4.5 4.5 0 0 0 10 22h4a4.5 4.5 0 0 0 4-6.5L13.5 8.2V3"/><path d="M7.5 14h9"/>', scroll: '<path d="M8 4h10a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M8 4a2 2 0 0 0-2 2v11M9.5 9h4M9.5 12.5h4"/>', quill: '<path d="M20 3C12 4 7 9 5.5 17.5L4 21"/><path d="M20 3c-1 6-5 10.5-12.5 13M9 12h5"/>', crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
    home: '<path d="M2.5 20l6.5-10.5 3.5 5 2.5-3.5 6.5 9z"/><path d="M9 9.5V3.5l4.5 1.8L9 7"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>', sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
    cards: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/>', list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>', chart: '<path d="M3 20h18"/><path d="M4 16c3-2 5-8 8-8s4 6 8 3"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5L20 7"/>', play: '<path d="M7 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', wifioff: '<path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M16.9 11.3a10 10 0 0 1 2.2 1.6"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M10.7 5c4-.4 8.1.9 11.3 3.8"/><path d="m2 2 20 20"/>', print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M6 11l6 6 6-6"/><path d="M4 21h16"/>', upload: '<path d="M12 16V4M6 9l6-6 6 6"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>', volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>', stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>', cc: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10.5 10a2.4 2.4 0 1 0 0 4M17 10a2.4 2.4 0 1 0 0 4"/>', keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>', micoff: '<path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.9 2.3"/><path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.5 2.6M12 18v3M8 21h8M3 3l18 18"/>', phone: '<path d="M5 3.5h3.2l1.6 4.2-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4.2 1.6V17a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5z"/>', phoneoff: '<path d="M3.6 13.9a12.5 12.5 0 0 1 16.8 0l-1.9 2.5-3.4-1.1-.3-2.6a9.4 9.4 0 0 0-5.6 0l-.3 2.6-3.4 1.1z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    right: '<path d="M9 6l6 6-6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>', thumbdown: '<path d="M7 14V3H4.5A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14z"/><path d="M7 14l4 7a2.5 2.5 0 0 0 2.5-2.5V15h5.3a2 2 0 0 0 2-2.3l-1.2-7.5A2 2 0 0 0 17.6 3H7"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    fire: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1 .3-2 1-3 0 2 1 3 2 3 0-3-1-5 1-9z"/>', external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', zoomin: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>', zoomout: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>', up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>', reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 7 7v4"/>',
    pin: '<path d="M12 17v5"/><path d="M8 3h8l-1 7 3 3H6l3-3z"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', canvas: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14l3 3 5-5"/>', wifi_off: '<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01"/><path d="M3 3l18 18"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', swap: '<path d="M7 16V4M7 4L3 8M7 4l4 4"/><path d="M17 8v12M17 20l4-4M17 20l-4-4"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2a5 5 0 0 1 6 4.8"/>', award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/><path d="M12 6.5l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 8.7l2.1-.3z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M15 16l4-4-4-4M19 12H9"/>', chevron: '<path d="M6 9l6 6 6-6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>', gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M6 9l6 12M18 9l-6 12"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>', path: '<path d="M5 5c9 0 9 7 0 7s-9 7 0 7h14"/><circle cx="5" cy="5" r="1.8"/><circle cx="19" cy="19" r="1.8"/>',
    maker: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/><path d="M12 6.5v7M8.5 10h7"/>',   // the class maker: a class (a book) with a plus
    planner: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6v3H9z"/><path d="M9 10.5h6M9 14h6M9 17.5h3.5"/>',   // the study planner: a clipboard of days, not the learning path's trail
    reportcard: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7.5h8M8 11h5"/><path d="M12.5 17.5l1.75-4.5 1.75 4.5M13.2 16h2.1"/>'   // the GPA calculator: a report card with its A
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
    peek(id) { return readJSON(storeKey(id)); },
    poke(id, fn) { if (id === this.id) { fn(this.data); writeJSON(storeKey(id), this.data); } else { const d = readJSON(storeKey(id)); fn(d); writeJSON(storeKey(id), d); } if (global.App && global.App.auth) global.App.auth.noteWrite(id); }
  };
  const settings = () => Object.assign({ theme: 'system' }, readJSON('studyhub-settings'));
  const setSetting = (k, v) => { const s = settings(); s[k] = v; writeJSON('studyhub-settings', s); if (global.App && global.App.onSetting) { try { global.App.onSetting(k); } catch (e) {} } };
  const courseSetting = (courseId, k, def) => { const s = settings(); return (s[courseId] && k in s[courseId]) ? s[courseId][k] : def; };
  const setCourseSetting = (courseId, k, v) => { const s = settings(); s[courseId] = Object.assign({}, s[courseId], { [k]: v }); writeJSON('studyhub-settings', s); };
  /* classes whose sections meet on different days (VARIANTS): calendar rows carry a section id in slot 4 and exams carry dates per section.
     The section comes from the Settings picker, or from the section number typed at sign-up ("01" → "1"). */
  const sectionVariant = C => { const V = C && C.VARIANTS; if (!V) return ''; const has = id => V.options.some(o => o.id === id); const pick = String(courseSetting(C.id, 'variant', '') || ''); if (has(pick)) return pick; const typed = String(parseInt(courseSetting(C.id, 'section', ''), 10) || ''); return has(typed) ? typed : V.default; };
  /* each student's own version of a class from the catalog, made in the class maker (assets/maker.js) and synced with
     their account as classCustom[id]: a nickname, their instructor, office hours and where it meets, exam dates and
     names, dates of their own and the grading weights. The class's own values stay in C._own, so a change can be undone. */
  const ISO_D = /^\d{4}-\d{2}-\d{2}$/;
  const classCustom = id => { const all = settings().classCustom; const k = all && typeof all === 'object' ? all[id] : null; return k && typeof k === 'object' ? k : null; };
  const OWN_COURSE = ['instructor', 'instructorEmail', 'officeHours', 'classDays', 'room'];
  const dayLabel = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return iso; } };
  const applyVariant = C => {
    if (!C) return;
    const K = classCustom(C.id); if (!C.VARIANTS && !K && !C._own) return;
    const v = sectionVariant(C);
    if (!C._own) C._own = { short: C.short };
    if (C.CALENDAR && C.CALENDAR !== C._calView) C._calAll = C.CALENDAR;
    if (C._calAll) {
      let cal = C.VARIANTS ? C._calAll.filter(e => !e[4] || e[4] === v) : C._calAll.slice();
      const mine = K && Array.isArray(K.events) ? K.events.filter(e => Array.isArray(e) && ISO_D.test(e[0] || '') && e[2]).map(e => Object.assign([e[0], e[1] || 'admin', String(e[2])], { mine: true })) : [];
      if (mine.length) cal = cal.concat(mine).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      C._calView = cal; C.CALENDAR = cal;
    }
    (C.EXAMS || []).forEach(ex => {
      if (!ex._own) ex._own = { date: ex.date, dateLabel: ex.dateLabel, name: ex.name };
      let date = ex._own.date, label = ex._own.dateLabel;
      if (C.VARIANTS && ex.dates && ex.dates[v]) { date = ex.dates[v]; if (ex.dateLabels && ex.dateLabels[v]) label = ex.dateLabels[v]; }
      const o = K && K.exams && K.exams[ex.id];
      if (o && ISO_D.test(o.date || '') && o.date !== date) { date = o.date; label = o.time ? `${dayLabel(o.date)} · ${o.time}` : undefined; }
      else if (o && o.time) label = `${dayLabel(date)} · ${o.time}`;
      ex.date = date; if (label) ex.dateLabel = label; else delete ex.dateLabel; ex.name = (o && o.name) || ex._own.name;
    });
    if (C.COURSE) { if (!C._own.course) C._own.course = Object.fromEntries(OWN_COURSE.map(k => [k, C.COURSE[k]])); OWN_COURSE.forEach(k => { const x = K && typeof K[k] === 'string' && K[k].trim() ? K[k].trim() : C._own.course[k]; if (x === undefined) delete C.COURSE[k]; else C.COURSE[k] = x; }); }
    if (C.GRADING && Array.isArray(C.GRADING.categories)) { C.GRADING.categories.forEach(c => { if (c._own === undefined) c._own = c.weight; const raw = K && K.weights ? K.weights[c.id] : null; const w = Number(raw); c.weight = raw != null && raw !== '' && w >= 0 && w <= 100 ? w : c._own; }); }
    C.short = (K && typeof K.short === 'string' && K.short.trim()) ? K.short.trim().slice(0, 14) : C._own.short;
    C.custom = !!K;
  };
  Object.keys(global.Courses || {}).forEach(id => applyVariant(global.Courses[id]));

  /* ---------- dates ---------- */
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parseISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  // the date StudyCat is pretending it is (settings.asof, for testing): read on every todayISO(), so the settings are
  // parsed again only when they changed
  let asofRaw, asofVal = null;
  const asOf = () => { let raw = null; try { raw = localStorage.getItem('studyhub-settings'); } catch (e) {} if (raw !== asofRaw) { asofRaw = raw; const v = readJSON('studyhub-settings').asof; asofVal = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; } return asofVal; };
  const today = () => { const ov = asOf(); const d = ov ? parseISO(ov) : new Date(); d.setHours(0, 0, 0, 0); return d; };
  const todayISO = () => toISO(today());
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  // in another language the browser writes the date ("jue 15 oct", "Do., 15. Okt."); in English, as it always was
  const LOC = () => { const l = global.MATHUB_LANG; return l && l !== 'en' && l !== 'qps' ? l : null; };
  const fmtDate = (iso, long = false) => { const d = parseISO(iso); const l = LOC(); if (l) return d.toLocaleDateString(l, long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }); return long ? `${DOW[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()}` : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; };
  const shortDate = iso => { const d = parseISO(iso); const l = LOC(); if (l) return d.toLocaleDateString(l, { month: 'short', day: 'numeric' }); return `${MON[d.getMonth()]} ${d.getDate()}`; };
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
    const hist = store.get('history', []); hist.push({ t: topic, ok, d: todayISO(), k: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); if (hist.length > 500) hist.splice(0, hist.length - 500); store.set('history', hist); markActivity(); if (App.addXP) App.addXP(ok ? 10 : 2); if (App.quest) { App.quest('answers'); if (ok) App.quest('correct'); App.quest('topics', 1, topic); }
  }
  function markActivity() { const days = store.get('activity', {}); days[todayISO()] = true; store.set('activity', days); }
  function streakOf(data) { const days = data.activity || {}; let n = 0; let d = today(); if (!days[toISO(d)]) d = addDays(d, -1); while (days[toISO(d)]) { n++; d = addDays(d, -1); } return n; }
  const streak = () => streakOf(store.data);
  function unitMastery(unit) { const p = progress(); const topics = QZ && QZ.topicsForUnits ? QZ.topicsForUnits([unit]) : []; let a = 0, c = 0; topics.forEach(t => { if (p[t]) { a += p[t].a; c += p[t].c; } }); return { a, c, pct: a ? Math.round(100 * c / a) : 0 }; }
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
    if (cv.length) { const real = cv.map(e => ({ date: e.date, time: e.time, title: e.title, type: 'canvas', url: e.url })); const keep = items.filter(x => x.type !== 'recurring' && !(x.type === 'admin' && /^due\b/i.test(x.title))); items.length = 0; items.push(...keep, ...real); }
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
  const topicsForSection = secId => QZ && QZ.TOPICS ? Object.keys(QZ.TOPICS).filter(t => QZ.TOPICS[t].sec === secId) : [];

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
      const evs = this.events(courseId, t).slice(0, count); if (!evs.length) { el.innerHTML = ''; return; }   // nothing coming up: no empty box
      el.innerHTML = `<div class="panel canvas-panel"><div class="panel-h"><div class="panel-title">${icon('canvas')} From Canvas</div><span class="small muted">${d.error ? '<span style="color:var(--warn)">using the last copy</span>' : d.fetched ? `synced ${relTime(d.fetched)}` : ''}</span></div>
        ${evs.map(e => `<div class="today-ev"><span class="when">${daysBetween(t, e.date) === 0 ? 'Today' : daysBetween(t, e.date) === 1 ? 'Tomorrow' : esc(fmtDate(e.date))}</span><span>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}${e.time ? ` <span class="muted small">· ${esc(e.time)}</span>` : ''}${!courseId ? ` <span class="chip course-${esc(e.course)}" style="margin-left:6px">${esc((Courses[e.course] || { short: e.course }).short)}</span>` : ''}</div>`).join('')}
        <p class="small muted mt-2">Real due dates from the instructor's Canvas calendar, refreshed hourly.</p></div>`;
    }
  };
  const relTime = ts => { const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  function paintAnnouncement(root) {
    Canvas.load().then(d => { const txt = (d && d.announcement || '').trim(); if (!txt) return; let dismissed = ''; try { dismissed = localStorage.getItem('mathub-ann-dismissed') || ''; } catch {} if (dismissed === txt) return; const host = $('#announcement-slot', root); if (!host) return; host.innerHTML = `<div class="announce"><span>${icon('flag', 14)} ${esc(txt)}</span><button class="icon-btn" data-action="ann-dismiss" aria-label="Dismiss">${icon('x', 14)}</button></div>`; on(host, 'click', '[data-action="ann-dismiss"]', () => { try { localStorage.setItem('mathub-ann-dismissed', txt); } catch {} host.innerHTML = ''; }); }).catch(() => {});
  }

  /* ---------- App object ---------- */
  const App = { views: {}, current: null, icon, esc, $, $$, bind, on, toast, store, settings, setSetting, courseSetting, setCourseSetting, applyVariant, sectionVariant, classCustom, typeset, compileExpr, d1, d2, parseNumber, fmtNum, cssVar, fitCanvas, niceStep,
    recordAnswer, markActivity, progress, streak, unitMastery, cardsMastered, checklistState, todayISO, toISO, parseISO, fmtDate, shortDate, addDays, daysBetween, relDays, examStatus, secLabel, secById, topicsForSection,
    nextExam: () => nextExam(D), currentSection: () => currentSection(D), upcomingDeadlines: n => upcomingDeadlines(D, n), eventsOn: iso => eventsOn(D, iso),
    onCourse(fn) { courseHooks.push(fn); if (D) fn(D); }, BUILD, SITE, COURSE_ORDER, asOf, semesterState: () => semesterState(D),
    upcomingDeadlinesOf: upcomingDeadlines, nextExamOf: nextExam, semesterStateOf: semesterState, streakOf, secLabelOf: (C, id) => { const x = (C.SECTIONS || []).find(z => z.id === id); return x ? x.label : id; } };
  // the interface's language (assets/i18n.js): App.t('…', a, b) for words that never reach the page; the page itself is translated as it is drawn
  const I18N = global.MathubI18n; App.lang = I18N ? I18N.lang : 'en'; App.t = I18N ? I18N.t : ((x, ...v) => String(x).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  App.toggleTheme = () => toggleTheme();
  App.applyTheme = () => applyTheme();   // after the theme, the look or synced preferences change (assets/modules.js, assets/auth.js)
  App.ICONS = ICONS;   // other files add their own marks (assets/life.js)
  /* One mark per page, everywhere a page is listed (the sidebar, a class's menu, the account menu, the Tools page,
     home): two pages never share one, so the Study planner and the Learning path, or Notes and Readings, are told
     apart at a glance. A class's own data may name an icon; this list wins. (The class calendar and your own
     calendar are the same thing and share the calendar.) */
  const VIEW_ICON = {
    home: 'home', today: 'sun', tasks: 'todo', agenda: 'calendar', timetable: 'table', timelog: 'timer', projects: 'folder', focus: 'clock',
    tools: 'grid', gpa: 'reportcard', habits: 'repeat', goals: 'target', wheel: 'wheel', journal: 'note', money: 'wallet', career: 'briefcase', portfolio: 'star',
    forum: 'chat', leagues: 'gem', people: 'users', challenge: 'trophy', resources: 'globe', guides: 'bulb', whatsnew: 'megaphone',
    plan: 'crown', usage: 'pie', settings: 'gear', customize: 'sliders', inbox: 'bell', install: 'download', admin: 'shield', instructor: 'user', recap: 'fire', sheet: 'd20',
    dashboard: 'cap', path: 'path', notes: 'book', readings: 'scroll', formulas: 'sigma', textbook: 'link', slides: 'layers', mynotes: 'marker',
    playground: 'keyboard', phonetics: 'mic', drafts: 'pen', notebook: 'quill', practice: 'list', flashcards: 'cards', exam: 'flag', checkwork: 'check',
    mistakes: 'undo', calendar: 'calendar', planner: 'planner', course: 'info', grapher: 'chart', labs: 'flask', motion: 'zap', solvers: 'wand',
    explorer: 'eye', unitcircle: 'compass', maker: 'maker', toolkit: 'calc'
  };
  App.VIEW_ICON = VIEW_ICON;
  App.viewIcon = (id, fallback) => VIEW_ICON[id] || fallback || 'file';
  App.pomo = () => Pomo;   // the sidebar's pomodoro, shared with the start page (assets/dash.js)
  // Your classes: the Montana State classes you picked (nobody gets them by default: the home page asks until you pick),
  // then the classes you made yourself, which are always yours
  App.myCourses = () => { const c = settings().courses; const mine = Array.isArray(c) ? c.filter(id => Courses[id] && !Courses[id].preview) : []; const own = App.myClasses ? App.myClasses.list().map(e => e.id).filter(id => Courses[id] && !mine.includes(id)) : []; return mine.concat(own); };
  // the Montana State classes to pick from (not the ones you made, not ones being previewed)
  App.catalogIds = () => COURSE_ORDER.filter(id => Courses[id] && !Courses[id].preview && !Courses[id].community && !(App.myClasses && App.myClasses.has(id)));
  App.isoWeek = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7)); const w1 = new Date(x.getFullYear(), 0, 4); return x.getFullYear() + '-W' + String(1 + Math.round(((x - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)).padStart(2, '0'); };
  App.guest = () => !!(App.auth && App.auth.ready && !App.auth.user);
  App.limit = k => App.guest() && App.auth.limits && App.auth.limits[k] != null ? App.auth.limits[k] : Infinity;
  App.lockCard = (t, x, o) => App.auth ? App.auth.lockCard(t, x, o) : '';
  // The StudyCat mark: Bo the bobcat's head, the same drawing as the mascot. Fixed colours (he is tan in every theme);
  // tile=true sets him on a navy rounded tile for places outside the page (icons, share cards).
  App.LOGO_PATHS = '<path d="M22 46L14 14l32 14z" fill="#C98B4B"/><path d="M98 46l8-32-32 14z" fill="#C98B4B"/><path d="M24 40l-6-19 20 10z" fill="#3B2A1C"/><path d="M96 40l6-19-20 10z" fill="#3B2A1C"/><ellipse cx="60" cy="58" rx="40" ry="34" fill="#D9A15B"/><ellipse cx="60" cy="69" rx="27" ry="21" fill="#F3DFB8"/><path d="M30 42c4 5 8 10 8 18M90 42c-4 5-8 10-8 18" stroke="#8B5A2B" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M19 70l17 2M19 78l17-1M101 70l-17 2M101 78l-17-1" stroke="#8B5A2B" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="46" cy="56" rx="7.5" ry="8.5" fill="#fff"/><ellipse cx="74" cy="56" rx="7.5" ry="8.5" fill="#fff"/><circle cx="47" cy="57.5" r="4.6" fill="#2A1B0E"/><circle cx="75" cy="57.5" r="4.6" fill="#2A1B0E"/><circle cx="48.6" cy="55.4" r="1.6" fill="#fff"/><circle cx="76.6" cy="55.4" r="1.6" fill="#fff"/><path d="M54 68h12l-6 6z" fill="#3B2A1C"/><path d="M60 74v3.5M60 77.5c-3 3-7 3-9 0M60 77.5c3 3 7 3 9 0" stroke="#3B2A1C" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
  App.logoSvg = (size = 28, tile = false) => tile
    ? `<svg class="mh-logo tile" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#14213D"/><g transform="translate(-2.8 1.3) scale(0.58)">${App.LOGO_PATHS}</g></svg>`
    : `<svg class="mh-logo bo-mark" width="${Math.round(size * 1.16)}" height="${size}" viewBox="10 10 100 86" aria-hidden="true">${App.LOGO_PATHS}</svg>`;
  App.wordmark = (cls = '') => `<span class="brand-word${cls ? ' ' + cls : ''}">StudyCat</span>`;
  App.tagline = (cls = '') => `<span class="brand-tag${cls ? ' ' + cls : ''}">Learn <i>/</i> Practice <i>/</i> Excel</span>`;
  Object.defineProperty(App, 'D', { get: () => D }); Object.defineProperty(App, 'Q', { get: () => QZ });
  App.Canvas = Canvas;
  /* the site's address for links people share; inside the iOS app the page lives at capacitor://localhost, so links point at studycat.org */
  App.siteBase = () => (window.MATHUB_APP && window.MATHUB_APP.native ? window.MATHUB_APP.api : location.origin + location.pathname.replace(/index\.html$/, ''));
  App.link = (view, param, query) => { let hs = '#/' + (D ? D.id : 'calc') + '/' + view + (param ? '/' + param : ''); if (query) hs += '?' + new URLSearchParams(query).toString(); return hs; };
  App.go = (view, param, query) => { const hs = App.link(view, param, query); if (location.hash === hs) { render(); return; } try { location.hash = hs; } catch { render(); } };
  App.replaceHash = hs => { try { history.replaceState(null, '', hs); } catch {} };
  const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
  App.pageHead = pageHead;
  const L = App.link;

  /* ---------- course selection / routing ---------- */
  /* Pages every class gets on top of its own list (C.NAV, from its data): the learning path, the mistakes notebook,
     the daily challenge, Bo's learning tools (assets/learn.js), a writing class's drafts and notebook, Discussions
     and resources. Where each one sits in the menu is NAV_PLAN's job, not this list's order. */
  function augmentNav(C) {
    const has = id => C.NAV.some(g => g.items.some(x => x[0] === id));
    const add = (id, label, ok = true) => { if (ok && App.views[id] && !has(id)) C.NAV[0].items.push([id, label, VIEW_ICON[id] || 'file']); };
    add('path', 'Learning path', !!C.quiz);
    add('mistakes', 'Mistakes', !!C.quiz);
    add('challenge', 'Daily challenge', !!C.quiz);
    add('mynotes', 'My notes', !!((C.SECTIONS || []).length && (C.SECTIONS[0].ideas || C.SECTIONS[0].bullets)));
    add('drafts', 'Draft feedback', !!(C.DRAFTS || []).length);
    add('notebook', 'Writer’s notebook', !!(C.NOTEBOOK && C.NOTEBOOK.count));
    add('slides', 'Notes from slides');
    add('checkwork', 'Check my work', !C.kind || C.kind === 'science');
    add('toolkit', 'Tools');   // the class's own tools (assets/class-tools.js): calculators, solvers, simulators
    add('forum', 'Discussions');
    add('resources', 'Resources & guides');
  }
  function setCourse(id) {
    if (D && D.id === id) { document.documentElement.setAttribute('data-course', id); return; }   // back into the same class from a page outside it: its colour again
    D = Courses[id]; QZ = D.quiz; store.load(id); augmentNav(D);
    document.documentElement.setAttribute('data-course', id);
    Search.index = null; buildNav(); courseHooks.forEach(fn => { try { fn(D); } catch (e) { console.error(e); } });
    if (App.auth && App.auth.user) App.auth.pullCourse(id, true).catch(() => {});
  }
  /* ---------- on-demand class loading: the shell ships light stubs (assets/courses-index.js); the full files come when a class is opened ---------- */
  const loading = {};
  /* each class's lessons (assets/lessons/<id>.js): for every topic, the idea in plain words, a picture (a drawing spec,
     App.boDraw), worked examples and a self-check, laid over its notes when the class loads */
  const LESSON_IDS = new Set(['calc', 'precalc', 'physics', 'csci', 'biob', 'kin', 'psyx', 'writ', 'emec100', 'jpns150d', 'm170', 'm172', 'psci230d']);
  function mergeLessons(F) {
    const L = global.MathubLessons && global.MathubLessons[F.id]; if (!L || F._lessons) return F;
    (F.SECTIONS || []).forEach(s => { const x = L[s.id]; if (!x) return; Object.keys(x).forEach(k => { if (k !== 'addExamples') s[k] = x[k]; }); if (x.addExamples) s.examples = (s.examples || (s.example && s.example.p ? [s.example] : [])).concat(x.addExamples); }); F._lessons = true; return F;
  }
  const lessonsFor = (F, one) => (LESSON_IDS.has(F.id) && !(global.MathubLessons && global.MathubLessons[F.id]) ? one('lessons/' + F.id).catch(() => {}) : Promise.resolve()).then(() => mergeLessons(F));
  App.loadCourse = function (id) {
    const C = Courses[id]; if (!C) return Promise.reject(new Error('Unknown class.'));
    const emit = (type, detail) => { try { document.dispatchEvent(new CustomEvent(type, { detail: Object.assign({ course: id }, detail) })); } catch (e) {} };
    if (C.pack && !C.loaded && App.packs) {   // a class uploaded in the admin panel (assets/classpacks.js): one JSON file from the server instead of scripts
      if (loading[id]) return loading[id];
      if (App.loadbar) App.loadbar.start();
      loading[id] = App.packs.load(id).then(F => lessonsFor(F, script)).then(F => { F.loaded = true; delete F.stub; applyVariant(F); Search.index = null; emit('mh:loaded', {}); return F; }).finally(() => { delete loading[id]; if (App.loadbar) App.loadbar.done(); });
      return loading[id];
    }
    if (C.loaded || !C.files || !C.files.length) { C.loaded = true; delete C.stub; return Promise.resolve(C); }
    if (loading[id]) return loading[id];
    const one = script;
    if (App.loadbar) App.loadbar.start();
    emit('mh:load', { files: C.files.slice() });
    loading[id] = (async () => { try { for (const f of C.files) await one(f); await lessonsFor(Courses[id], one); } finally { delete loading[id]; if (App.loadbar) App.loadbar.done(); } const F = Courses[id]; F.loaded = true; delete F.stub; applyVariant(F); Search.index = null; emit('mh:loaded', {}); return F; })();
    return loading[id];
    function script(src) { return new Promise((res, rej) => { if (document.querySelector(`script[data-src="${src}"]`)) return res(); const sc = document.createElement('script'); sc.src = `assets/${src}.js?v=${BUILD}`; sc.dataset.src = src; const t0 = performance.now(); sc.onload = () => { emit('mh:file', { src, url: sc.src, ms: Math.round(performance.now() - t0) }); res(); }; sc.onerror = () => { sc.remove(); rej(new Error(`Could not download ${src}.js. Check your connection and try again.`)); }; document.head.appendChild(sc); }); }
  };
  App.loadCourses = ids => Promise.all(ids.map(id => App.loadCourse(id).catch(() => null)));
  App.courseLoaded = id => !!(Courses[id] && Courses[id].loaded);
  function renderLoading(root, id) {
    const C = Courses[id]; document.documentElement.setAttribute('data-course', id);
    $('#topbar-title').innerHTML = `<a class="crumb" href="#/${id}/dashboard" title="${esc(C.name)}">${esc(C.short)}</a><span class="crumb-sep">›</span><span class="crumb-cur">Loading…</span>`; document.title = `${C.code} · ${SITE}`;
    root.innerHTML = `<div class="page-load" data-course="${id}" aria-busy="true" aria-live="polite"><div class="eyebrow">${esc(C.code)}</div><h1 class="page-title">${esc(C.name)}</h1><p class="muted small">Opening the class…</p>${App.pixel ? `<div class="px-loader" aria-hidden="true">${App.pixel('bo', 3)}<span class="px-label">Loading<span class="px-dots"></span></span></div>` : ''}${App.skeleton ? App.skeleton(6) : ''}</div>`;
  }
  function renderLoadError(root, id, err) {
    root.innerHTML = `<div class="page-load"><div class="empty px-gameover">${App.pixel ? `<div class="px-go-art">${App.pixel('boSad', 5)}</div><div class="px-label px-go-title" aria-hidden="true">Game over</div>` : ''}<p>${esc(err && err.message || 'Could not load this class.')}</p>${App.pixel ? '<div class="px-label px-go-q" aria-hidden="true">Continue?</div>' : ''}<div class="row gap-sm mt-2" style="justify-content:center"><button class="btn sm primary" data-action="retry">${icon('rotate', 13)} Try again</button><a class="btn sm" href="#/">All classes</a></div></div></div>`;
    bind(root, { retry: () => render() });
  }
  function prefetchLast() {
    const lv = settings().lastVisit; const id = lv && lv.course; if (!id || !Courses[id] || Courses[id].loaded || !App.myCourses().includes(id)) return;
    const idle = global.requestIdleCallback || (fn => setTimeout(fn, 1500)); idle(() => { if (navigator.onLine === false) return; App.loadCourse(id).catch(() => {}); });
  }
  function route() {
    const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const parts = path.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    if (!parts.length || !Courses[parts[0]]) return { course: null, view: !parts.length ? 'home' : GLOBAL_VIEWS.includes(parts[0]) && App.views[parts[0]] ? parts[0] : 'notfound', param: parts.length && !GLOBAL_VIEWS.includes(parts[0]) ? parts.join('/') : parts.slice(1).join('/') || null, query };
    const view = parts[1] || 'dashboard';
    return { course: parts[0], view: App.views[view] || !Courses[parts[0]].loaded ? view : 'dashboard', param: parts.slice(2).join('/') || null, query };
  }
  function render() {
    const { course, view, param, query } = route();
    if (App.current && App.current.unmount) { try { App.current.unmount(); } catch {} }
    const app = $('.app'); const stale = $('#view'); const root = stale.cloneNode(false); stale.replaceWith(root); window.scrollTo(0, 0);
    if (query.asof !== undefined) { setSetting('asof', /^\d{4}-\d{2}-\d{2}$/.test(query.asof) ? query.asof : ''); }
    if (!course) {
      app.classList.add('landing'); app.classList.remove('nav-open'); document.documentElement.removeAttribute('data-course');
      if (view === 'home' && App.startRedirect && App.startRedirect()) { render(); return; }   // the start page picked in Customize, once per visit
      if (view !== 'home' && App.moduleOn && !App.moduleOn(view)) { App.current = App.views.off; document.title = `${App.views.off.title} · ${SITE}`; App.views.off.render(root, view); applyTheme(); typeset(root); afterRender(root); return; }
      if (view !== 'home') { const V = App.views[view]; App.current = V; document.title = `${V.title} · ${SITE}`; V.render(root, param, query, true); applyTheme(); }
      else { App.current = App.homeView || Landing; document.title = `${SITE} · Fall 2026`; App.current.render(root); }   // App.homeView: the iOS and Android apps' own start page (assets/app-native.js)
      typeset(root); if (App.auth) App.auth.bindLocks(root); afterRender(root); return;
    }
    app.classList.remove('landing');
    if (!Courses[course].loaded) { App.current = null; renderLoading(root, course); App.loadCourse(course).then(() => { if (route().course === course && $('#view') === root) render(); }).catch(err => { if ($('#view') === root) renderLoadError(root, course, err); }); afterRender(root); return; }
    setCourse(course);
    if (App.courseGate && App.courseGate(course, root, view)) { App.current = null; afterRender(root); return; }   // a class made from a syllabus is locked while the student has no plan (assets/create.js)
    if (App.moduleOn && !App.moduleOn(view)) { App.current = App.views.off; document.title = `${App.views.off.title} · ${D.code} · ${SITE}`; App.views.off.render(root, view); updateExamChip(); afterRender(root); return; }   // a feature turned off in Customize
    const V = App.views[view]; App.current = V;
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const actNav = $('.nav-item.active'); if (actNav) { const g = actNav.closest('.nav-group'); if (g && g.classList.contains('closed')) { g.classList.remove('closed'); const tg = g.previousElementSibling; if (tg) { tg.classList.add('open'); tg.setAttribute('aria-expanded', 'true'); } } }
    $('#topbar-title').innerHTML = `<a class="crumb" href="#/${D.id}/dashboard" title="${esc(D.name)}">${esc(D.short)}</a><span class="crumb-sep">›</span><span class="crumb-cur">${esc(V.title)}</span>`; document.title = `${V.title} · ${D.code} · ${SITE}`;
    if (App.auth && App.auth.ready && App.auth.gate(view) === 'hard') App.auth.renderLocked(root, V, view); else V.render(root, param, query);
    if (App.auth) App.auth.bindLocks(root);
    typeset(root); app.classList.remove('nav-open'); updateExamChip(); paintAsOf(); afterRender(root);
    if (!['settings', 'contact', 'policy'].includes(view)) { const h = $('.note-title, .rd-title, .page-title', root); setSetting('lastVisit', { hash: location.hash, label: `${D.short} · ${V.title}`, detail: h && !h.classList.contains('dash-greet') && !/^Good (morning|afternoon|evening)/.test(h.textContent) && h.textContent.trim() !== V.title ? h.textContent.trim().slice(0, 70) : '', course: D.id, t: Date.now() }); }
  }
  /* ---------- an address that matches no page ---------- */
  App.views.notfound = {
    title: 'Page not found',
    render(root, param) {
      const first = String(param || '').split('/')[0]; const classy = /^[a-z]{1,6}\d{2,4}[a-z]?$/.test(first);
      root.innerHTML = `<div class="landing-wrap"><header class="landing-top"><div><div class="eyebrow">${SITE}</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>${classy ? 'This class is not open to you' : 'Page not found'}</h1><p class="muted">${classy ? `There is no class <b>${esc(first)}</b> on StudyCat that you can open. If your instructor set it up, join it with the class code they gave you.` : 'The link may be old or mistyped. Nothing was lost; pick where to go from here.'}</p></div></header>
        <div class="row gap-sm" style="flex-wrap:wrap"><a class="btn primary" href="#/">${icon('home', 14)} Start page</a>${classy ? `<a class="btn" href="#/class">${icon('users', 14)} Join a class with a code</a>${App.canRequest && App.canRequest() ? `<a class="btn" href="#/request?code=${encodeURIComponent(first.toUpperCase())}">${icon('path', 14)} Request this class</a>` : `<a class="btn" href="#/create">${icon('plus', 14)} Make it from its syllabus</a>`}` : `<a class="btn" href="#/contact">${icon('chat', 14)} Tell us about the broken link</a>`}</div></div>`;
    }
  };
  /* ---------- code that loads the first time it is needed ----------
     Pages most visits never open are not in index.html: the admin panel, What's new and the terms. App.need() loads
     files in order, once; a page's stand-in holds its place in App.views (so links, menus and the router know it)
     until its file arrives, and then the page is drawn again with the real one. Anything another file hung on the
     stand-in meanwhile (teach.js adds a tab to the admin panel) moves over to it. */
  const needing = {};
  App.need = files => Promise.all([].concat(files).map(f => needing[f] || (needing[f] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = `assets/${f}?v=${encodeURIComponent(BUILD)}`; s.async = false;
    s.onload = () => res(); s.onerror = () => { delete needing[f]; s.remove(); rej(new Error('This page could not load. Check your connection and try again.')); };
    document.head.appendChild(s);
  }))));
  App.lazyView = (name, files, title, blurb) => {
    if (App.views[name]) return;
    const stub = App.views[name] = {
      title, lazy: true, ...(blurb ? { blurb } : {}),
      render(root) {
        root.innerHTML = '<div class="empty">Loading…</div>';
        App.need(files).then(() => {
          const real = App.views[name]; if (!real || real === stub) return;
          Object.keys(stub).forEach(k => { if (!['title', 'lazy', 'render'].includes(k) && !(k in real)) real[k] = stub[k]; });
          if (root.isConnected) render();
        }).catch(e => { if (!root.isConnected) return; root.innerHTML = `<div class="empty">${esc(e.message)} <button class="btn sm" data-action="lazy-retry">Try again</button></div>`; bind(root, { 'lazy-retry': () => render() }); });
      }
    };
  };
  App.lazyView('admin', ['admin.js', 'admin-ops.js'], 'Admin');
  App.lazyView('whatsnew', ['changelog.js'], 'What’s new');
  App.lazyView('policy', ['policy.js'], 'Terms & Privacy');
  // pages that load when first opened, so a visit does not parse them up front: the planner and life pages, the writer's
  // notebook, peer review, study rooms, the GPA calculator, a class's Tools and draft feedback. Title and blurb as the files
  // have them (menus, the members card and the class Tools links read them before the page loads)
  App.LAZY_PAGES = [
    ['tasks', 'life-school.js', 'Tasks', 'Everything you have to hand in or get done, from every class.'],
    ['timetable', 'life-school.js', 'Timetable', 'Your week: classes, labs, work shifts and study blocks. Click an empty hour to add something there.'],
    ['agenda', 'life-school.js', 'Calendar', 'Every exam, deadline, task and event, from all your classes and your own planner.'],
    ['timelog', 'life-school.js', 'Time tracker', 'Where your study hours go, class by class. The Focus room’s minutes count too.'],
    ['projects', 'life-school.js', 'Projects & thesis', 'Big pieces of work, broken into steps you can finish, with word counts and sources.'],
    ['habits', 'life-self.js', 'Habits', 'Small things, most days. Tick them off and watch the streak grow.'],
    ['wheel', 'life-self.js', 'Wheel of life', 'Score each part of your life from 1 to 10, once a month. The lowest one is where a goal helps most.'],
    ['goals', 'life-self.js', 'Goals', 'A few goals for each quarter, each broken into steps you can tick.'],
    ['journal', 'life-self.js', 'Journal', 'A page a day: how it went and three good things. Saved to your account; nobody else on StudyCat sees it.'],
    ['money', 'life-self.js', 'Money', 'What came in, what went out, and how much is left this month.'],
    ['career', 'life-self.js', 'Internships & jobs', 'Every application in one place, from the wishlist to the offer.'],
    ['portfolio', 'life-self.js', 'Portfolio', 'Your best work on one page you can print, save as a PDF or send with an application.'],
    ['notebook', 'notebook.js', 'Writer’s notebook'],
    ['peer', 'peer.js', 'Peer review'],
    ['room', 'room.js', 'Study room'],
    ['gpa', 'gpa.js', 'GPA calculator'],
    ['toolkit', 'class-tools.js', 'Tools', 'The tools this class needs: calculators, solvers and simulators. Pick one; it opens below.'],
    ['drafts', 'drafts.js', 'Draft feedback'],
    ['draft-history', 'drafts.js', 'Revision history'],
  ];
  App.LAZY_PAGES.forEach(([name, file, title, blurb]) => App.lazyView(name, [file], title, blurb));
  // the account menu's dot: a release note this account has not opened (scripts/release.js writes the newest one's build on <html>)
  App.changelogUnseen = () => { const news = document.documentElement.getAttribute('data-news') || ''; return !!news && (settings().seenChangelog || '') !== news; };
  /* this student's classes, saved for offline use in the background: the service worker keeps what is fetched, and it no
     longer downloads every class on install. Not on a data saver or a 2G connection, and once per build. */
  App.warmClasses = async () => {
    const cn = navigator.connection;
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller || navigator.onLine === false || (cn && (cn.saveData || /2g$/.test(cn.effectiveType || '')))) return;
    let done; try { done = JSON.parse(localStorage.getItem('mathub-warm') || 'null'); } catch (e) { done = null; }
    if (!done || done.build !== BUILD) done = { build: BUILD, ids: [] };
    for (const id of App.myCourses()) {
      const C = Courses[id]; if (!C || C.pack || done.ids.includes(id) || !(C.files || []).length) continue;   // an open class too: it may have loaded before the worker took over
      const files = C.files.map(f => f + '.js').concat(LESSON_IDS.has(id) ? ['lessons/' + id + '.js'] : []);
      try { for (const f of files) { const r = await fetch(`assets/${f}?v=${encodeURIComponent(BUILD)}`); if (!r.ok) throw new Error(r.status); } } catch (e) { return; }
      done.ids.push(id); try { localStorage.setItem('mathub-warm', JSON.stringify(done)); } catch (e) {}
    }
    // and the pages that load when opened, so they work offline too
    if (!done.pages) { try { for (const f of [...new Set(App.LAZY_PAGES.map(x => x[1]))]) { const r = await fetch(`assets/${f}?v=${encodeURIComponent(BUILD)}`); if (!r.ok) throw new Error(r.status); } } catch (e) { return; } done.pages = 1; try { localStorage.setItem('mathub-warm', JSON.stringify(done)); } catch (e) {} }
  };
  /* ---------- invite landing: #/join?ref=CODE ---------- */
  App.views.join = {
    title: 'Join a classmate',
    render(root, param, query) {
      const ref = String(query.ref || param || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      root.innerHTML = `<div class="landing-wrap"><header class="landing-top"><div><div class="eyebrow">StudyCat</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>You're invited</h1><p class="muted" id="join-sub">Checking the invite…</p></div><div class="row gap-sm"><span id="landing-account"></span></div></header><div class="panel lift" id="join-card"><div class="empty small">Loading…</div></div></div>`;
      const card = $('#join-card', root); const sub = $('#join-sub', root);
      if (!ref) { sub.textContent = 'That link is missing its code.'; card.innerHTML = `<div class="row gap-sm" style="flex-wrap:wrap"><a class="btn primary" href="#/">Open StudyCat</a></div>`; return; }
      try { localStorage.setItem('mathub-ref', ref); } catch (e) {}
      fetch(`api/index.php?r=invite_info&ref=${ref}`, { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub' } }).then(r => r.json()).then(j => {
        const name = j && j.ok ? j.name : ''; try { sessionStorage.setItem('mathub-ref-name', name || ''); sessionStorage.setItem('mathub-ref-min', String(j && j.ok && (j.credits || 0) || '')); } catch (e) {}
        sub.textContent = name ? `${name} uses StudyCat for ${(j.courses || []).map(c => Courses[c] ? Courses[c].short : c).join(', ') || 'their classes'} and wants you in.` : 'A classmate wants you to study on StudyCat.';
        card.innerHTML = `<div class="grid cols-2" style="align-items:center"><div><h2 style="margin-top:0">${name ? `Study with ${esc(name)}` : 'Study together'}</h2><p>Free topic notes, endless practice, flashcards on a schedule, deadline calendars, a focus room and a class board for Montana State classes. ${j && j.ok && j.credits ? `Sign up with your montana.edu email and you both get ${j.credits} credits for Bo, the tutor you can call and work through problems with on a whiteboard.` : 'Sign up with your montana.edu email and you both get credits to use with Bo.'}</p><div class="row gap-sm" style="flex-wrap:wrap">${App.auth && App.auth.user ? `<a class="btn primary" href="#/">You are already signed in · open StudyCat</a>` : `<button class="btn primary lg" data-action="auth-signup">${icon('fire', 14)} Sign up free</button><button class="btn" data-action="auth-login">Log in</button>`}<a class="btn" href="#/">Look around first</a></div></div><div class="mascot-slot" data-size="120"></div></div>`;
        if (App.auth) App.auth.bindLocks(card); if (App.paintMascots) App.paintMascots();
      }).catch(() => { sub.textContent = 'Could not check the invite, but you can still sign up.'; card.innerHTML = `<div class="row gap-sm"><button class="btn primary" data-action="auth-signup">Sign up free</button><a class="btn" href="#/">Open StudyCat</a></div>`; if (App.auth) App.auth.bindLocks(card); });
      const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
    }
  };
  /* ---------- usage counts for the admin growth tab: which pages get opened, flushed quietly ---------- */
  const Track = { counts: {}, timer: null, hit(k) { if (!/^[a-z]+:[a-z0-9_-]{1,30}$/.test(k)) return; this.counts[k] = (this.counts[k] || 0) + 1; if (!this.timer) this.timer = setTimeout(() => this.flush(), 90000); },
    flush() { clearTimeout(this.timer); this.timer = null; const ev = this.counts; this.counts = {}; if (!Object.keys(ev).length || !navigator.onLine || !(App.auth && App.auth.mode === 'server' && !App.auth.unreachable)) return; try { fetch('api/index.php?r=track', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Content-Type': 'application/json' }, body: JSON.stringify({ events: ev }) }).catch(() => {}); } catch (e) {} } };
  App.track = k => Track.hit(k); document.addEventListener('visibilitychange', () => { if (document.hidden) Track.flush(); });
  App.ago = t => { const m = Math.round((Date.now() - t) / 60000); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago'); const d = Math.round(h / 24); return d + (d === 1 ? ' day ago' : ' days ago'); };
  App.resumeCard = (mine, opts = {}) => {
    const lv = settings().lastVisit; const all = COURSE_ORDER.filter(id => Courses[id]); const topics = all.reduce((n, id) => n + (Courses[id].SECTIONS || []).length, 0); const cards = all.reduce((n, id) => n + ((Courses[id].FLASHCARDS || []).length || Courses[id].flashcardCount || 0), 0);
    const strip = `<div class="stat-strip" aria-label="What is inside"><span><b>${all.length}</b> classes</span><span><b>${topics}</b> topic guides</span><span><b>${cards}</b> flashcards</span><span><b>∞</b> practice questions</span><span><b>$0</b> forever</span></div>`;
    if (opts.stripOnly) return strip; const tail = opts.noStrip ? '' : strip;
    if (!lv || !lv.hash || !Courses[lv.course] || !mine.includes(lv.course) || Date.now() - lv.t > 7 * 86400000 || Date.now() - lv.t < 20000) return tail;
    return `<a class="resume-card course-${lv.course}" href="${esc(lv.hash)}"><span class="resume-ic">${icon('play', 16)}</span><span class="resume-body"><small>Pick up where you left off · ${esc(App.ago(lv.t))}</small><b>${esc(lv.label)}${lv.detail ? ` · ${esc(lv.detail)}` : ''}</b></span>${icon('right', 16)}</a>` + tail;
  };
  const TABS_GLOBAL = [['#/', 'Home', 'home', 'home'], ['#/today', 'Today', 'flag', 'today'], ['#/focus', 'Focus', 'clock', 'focus'], ['#/forum', 'Board', 'chat', 'forum'], ['#/settings', 'Me', 'user', 'settings']];
  function paintTabbar(course, view) {
    // the website has no tab bar (the menu and the header carry it); the apps draw their own over this one
    if (!document.documentElement.hasAttribute('data-app')) { const old = $('#tabbar'); if (old) old.remove(); return; }
    let bar = $('#tabbar'); if (!bar) { bar = document.createElement('nav'); bar.id = 'tabbar'; bar.setAttribute('aria-label', 'Quick navigation'); document.body.appendChild(bar); }
    let tabs;
    if (course && D) { const learn = D.kind === 'writing' ? ['readings', 'Learn', 'book'] : ['notes', 'Learn', 'book']; const prac = D.quiz ? ['practice', 'Practice', 'list'] : D.kind === 'code' ? ['playground', 'Code', 'flask'] : ['calendar', 'Calendar', 'calendar']; tabs = [['dashboard', 'Home', 'home'], learn, prac, ['forum', 'Board', 'chat'], ['settings', 'Me', 'user']].map(([v, l, ic]) => [App.link(v), l, ic, v]); }
    else tabs = TABS_GLOBAL;
    bar.innerHTML = tabs.map(([href, label, ic, v]) => `<a class="tab-item${v === view ? ' active' : ''}" href="${href}"${v === view ? ' aria-current="page"' : ''}>${icon(ic, 20)}<span>${label}</span></a>`).join('');
  }
  const SHORTCUTS = [['Ctrl / ⌘ + K', 'Search notes, formulas and pages'], ['?', 'This list'], ['Esc', 'Close search, menus and dialogs'], ['← →', 'Previous or next paragraph in a reading, previous or next question in a lesson'], ['Space', 'Play or pause a reading'], ['Enter', 'Check an answer, then continue'], ['Ctrl / ⌘ + Enter', 'Run code in the playground'], ['Tab / Shift + Tab', 'Indent or outdent in the playground']];
  App.showShortcuts = () => {
    if ($('#shortcuts-modal')) return; const el = document.createElement('div'); el.className = 'modal-backdrop'; el.id = 'shortcuts-modal';
    el.innerHTML = `<div class="modal shortcuts-modal" role="dialog" aria-label="Keyboard shortcuts"><div class="row between mb-2"><div class="panel-title">${icon('zap')} Keyboard shortcuts</div><button class="icon-btn" data-action="close" aria-label="Close">${icon('x', 14)}</button></div><div class="shortcut-list">${SHORTCUTS.map(([k, d]) => `<div class="shortcut"><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div></div>`;
    document.body.appendChild(el); const close = () => App.dismiss(el); el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-action="close"]')) close(); }); const key = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', key); } }; document.addEventListener('keydown', key);
  };
  document.addEventListener('keydown', e => { if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.matches('input, textarea, select, [contenteditable]')) { e.preventDefault(); App.showShortcuts(); } });
  /* focus not hidden under the sticky top bar (WCAG 2.4.11): once the browser has scrolled a keyboard-focused part of the
     page into view, move it below the bar. Not scroll-padding on html: a top-bar button taking focus then scrolls the
     page (and a scroll closes its menu); not scroll-margin: that also shifts what is inside small scrolling boxes */
  let lastPointer = 0;
  document.addEventListener('pointerdown', () => { lastPointer = Date.now(); }, true);
  document.addEventListener('focusin', e => {
    const el = e.target; if (!el.closest || !el.closest('#view') || Date.now() - lastPointer < 600) return;
    requestAnimationFrame(() => { const bar = $('.topbar'); if (!bar || document.activeElement !== el) return; const b = bar.getBoundingClientRect().bottom, r = el.getBoundingClientRect(); if (b > 0 && r.bottom > 0 && r.top < b + 4) window.scrollBy(0, r.top - b - 12); });
  });
  function initToTop() { if ($('#totop')) return; const b = document.createElement('button'); b.id = 'totop'; b.className = 'totop'; b.title = 'Back to top'; b.setAttribute('aria-label', 'Back to top'); b.innerHTML = icon('up', 16); b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })); document.body.appendChild(b); let t = 0; window.addEventListener('scroll', () => { if (t) return; t = setTimeout(() => { t = 0; b.classList.toggle('show', window.scrollY > 400); }, 120); }, { passive: true }); }
  const trailSeen = new Set();
  // the winding trail between the run nodes: measured after layout so it follows the nodes at any width
  function drawTrail(root) {
    const wrap = $('.trail-board .tb-climb', root); const svg = wrap && $('.tb-path', wrap); if (!svg) return;
    const paint = () => {
      const wr = wrap.getBoundingClientRect(); if (!wr.width || !wr.height) return;
      const at = el => { const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2 - wr.left), Math.round(r.top + r.height / 2 - wr.top)]; };
      const pts = $$('.tb-node', wrap).map(at).sort((a, b) => b[1] - a[1]); const flag = $('.tb-flag', wrap), base = $('.tb-base-sign', wrap);
      if (base) { const b = at(base); pts.unshift([pts.length ? pts[0][0] : b[0], b[1] - 4]); }
      if (flag) { const f = flag.getBoundingClientRect(); pts.push([Math.round(f.left + 7 - wr.left), Math.round(f.bottom - 2 - wr.top)]); }
      if (pts.length < 2) return;
      let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const my = Math.round((y0 + y1) / 2); d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; }
      svg.setAttribute('viewBox', `0 0 ${Math.round(wr.width)} ${Math.round(wr.height)}`); svg.setAttribute('width', Math.round(wr.width)); svg.setAttribute('height', Math.round(wr.height));
      svg.innerHTML = `<path class="tb-path-bed" d="${d}"/><path class="tb-path-line" d="${d}"/>`;
    };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    if (global.ResizeObserver) { const ro = new ResizeObserver(() => { if (!wrap.isConnected) { ro.disconnect(); return; } paint(); }); ro.observe(wrap); }
  }
  App.drawTrail = drawTrail;   // classes whose trail board already drew itself this session
  function initTabs(root) {
    $$('.dash-tabs', root).forEach(bar => { const key = bar.dataset.store; const panes = bar.nextElementSibling; if (!panes) return; const pick = (id, save) => { $$('.tab', bar).forEach(b => { b.classList.toggle('on', b.dataset.tab === id); b.setAttribute('aria-selected', String(b.dataset.tab === id)); }); $$(':scope > .pane', panes).forEach(pn => { pn.hidden = pn.dataset.pane !== id; }); if (key && save) setSetting(key, id); slide(save); };
      // one pill slides between tabs instead of each tab lighting up on its own (transitions.dev "tabs sliding")
      let pill = $(':scope > .tab-pill', bar); if (!pill) { pill = document.createElement('span'); pill.className = 'tab-pill'; pill.setAttribute('aria-hidden', 'true'); bar.prepend(pill); bar.classList.add('has-pill'); }
      const slide = animate => { const b = $('.tab.on', bar); if (!b || !b.offsetWidth) return; if (!animate) pill.style.transition = 'none'; pill.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`; pill.style.width = b.offsetWidth + 'px'; pill.style.height = b.offsetHeight + 'px'; if (!animate) { void pill.offsetWidth; pill.style.transition = ''; } };
      if (global.ResizeObserver) { const ro = new ResizeObserver(() => { if (!bar.isConnected) { ro.disconnect(); return; } slide(false); }); ro.observe(bar); }
      bar.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) pick(b.dataset.tab, true); }); const saved = key ? settings()[key] : null; const first = $('.tab', bar); pick(saved && $(`.tab[data-tab="${saved}"]`, bar) ? saved : first.dataset.tab, false); });
  }
  App.initTabs = initTabs;
  function afterRender(root) {
    if (App.current) document.documentElement.classList.remove('mh-booting');   // a page is drawn (not a class still loading): the footer can show (assets/boot.js)
    initTabs(root); initToTop(); { const r = route(); paintTabbar(r.course, r.course ? r.view : (r.view === 'home' ? 'home' : r.view)); if (!r.course) prefetchLast(); const PRINTABLE = ['notes', 'formulas', 'course', 'calendar', 'planner', 'exam', 'checklist', 'gpa']; const pa = $('.page-head .page-actions', root) || (r.view === 'notes' ? $('.note-head', root) : null); if (pa && PRINTABLE.includes(r.view) && !$('.print-btn', pa)) pa.insertAdjacentHTML('beforeend', `<button class="btn sm print-btn" data-action="print-page" title="Print or save as PDF">${icon('print', 13)} Print</button>`); }
    (App.onRender || []).forEach(fn => { try { fn(root, route()); } catch (e) { console.error(e); } });
    if (App.motionRender) App.motionRender(root); { const r = route(); App.track('view:' + (r.course ? r.view : (r.view === 'home' ? 'landing' : r.view))); } if (App.paintStats) { App.paintStats(); App.paintMascots(); App.countUp(root); } if (App.paintQuests) App.paintQuests(); if (App.paintLeagueWidgets) App.paintLeagueWidgets(root); }
  App.rerender = () => render();
  App.searchReset = () => { Search.index = null; };   // the planner changed, so search reads it again
  App.currentSectionOf = C => currentSection(C);
  App.paintAnnouncement = root => paintAnnouncement(root);   // the apps' own start page shows the admin announcement too
  App.inCourse = () => !!route().course;
  App.settingsLink = () => App.inCourse() ? App.link('settings') : '#/settings';
  App.inboxLink = () => App.inCourse() ? App.link('forum', 'inbox') : '#/forum/inbox';
  function paintAsOf() {
    const ov = asOf(); let el = $('#asof-chip');
    if (!ov) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.id = 'asof-chip'; el.className = 'exam-chip asof'; el.dataset.action = 'asof-clear'; $('#topbar .topbar-actions').prepend(el); }
    el.innerHTML = `${icon('clock', 13)} <span>Viewing as ${esc(fmtDate(ov))}</span> <b>clear</b>`; el.title = 'You are previewing the site as of another date. Click to return to today.';
  }
  function updateExamChip() {
    const ex = nextExam(D); const chip = $('#exam-chip'); chip.hidden = false; delete chip.dataset.href; chip.title = 'Next exam';
    if (!ex) { chip.innerHTML = `${icon('flag', 14)} <span>${semesterState(D).phase === 'after' ? 'Semester complete' : (D.EXAMS || []).length ? 'No exams left' : 'No exams'}</span>`; return; }
    const st = examStatus(ex); chip.innerHTML = `${icon('flag', 14)} <span>${esc(ex.name)} ·</span> <b>${esc(st.chip)}</b>`;
  }
  function applyTheme() {
    if (App.applySkin) App.applySkin(); if (App.applyMotion) App.applyMotion(); if (App.applyLook) App.applyLook();
    const t = settings().theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('.theme-btn').forEach(b => b.innerHTML = icon(dark ? 'sun' : 'moon', 16));
  }
  function toggleTheme() { if (App.themeFade) App.themeFade(); const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); setSetting('theme', isDark ? 'light' : 'dark'); applyTheme(); }
  /* A class's menu, the same in every class: Learn (the overview, the learning path, the lessons and the class's
     reading), Practice, Plan (its calendar and the study planner), Explore (the class's Tools page, its own
     grapher, labs and simulators, and anything new) and Class (the syllabus, Discussions, resources, settings). Learn, Practice and
     Plan are open; the other two fold away. C.NAV stays the source list; this is only the view. */
  const NAV_PLAN = [['Learn', ['dashboard', 'path', 'notes', 'readings', 'formulas', 'textbook', 'slides', 'mynotes', 'playground', 'phonetics', 'drafts', 'notebook']], ['Practice', ['practice', 'flashcards', 'exam', 'checkwork', 'mistakes', 'challenge']], ['Plan', ['calendar', 'planner']], ['Explore', ['toolkit']], ['Class', ['course', 'forum', 'resources', 'settings']]];
  function groupNavBase(NAV) {
    const all = NAV.flatMap(g => g.items); const used = new Set();
    const groups = NAV_PLAN.map(([label, ids]) => ({ label, items: ids.map(id => all.find(x => x[0] === id)).filter(x => x && !used.has(x[0]) && used.add(x[0])) }));
    groups.find(g => g.label === 'Explore').items.push(...all.filter(x => !used.has(x[0]) && used.add(x[0])));   // the class's own tools (grapher, labs, solvers…) and anything new
    return groups.filter(g => g.items.length);
  }
  // then the student's own arrangement: order, groups, pages hidden, features turned off (assets/modules.js)
  const groupNav = (NAV, cid) => { const base = groupNavBase(NAV); return App.arrangeClassMenu ? App.arrangeClassMenu(base, cid || '') : base; };
  App.groupNav = groupNav; App.groupNavBase = groupNavBase;
  function buildNav() {
    $('#brand-code').textContent = D.code; $('#brand-name').innerHTML = `${esc(D.name)}<small>${esc(D.term)}</small>`;
    const mine = App.myCourses(); if (D && !mine.includes(D.id)) mine.push(D.id);
    $('#course-switch').innerHTML = COURSE_ORDER.filter(id => Courses[id] && mine.includes(id)).map(id => `<a class="switch-btn${id === D.id ? ' on' : ''}" data-c="${id}" href="#/${id}/dashboard" title="${esc(Courses[id].name)}">${esc(Courses[id].short)}</a>`).join('') + `<a class="switch-btn home" href="#/" title="All courses">${icon('grid', 14)}</a>` + (App.views.maker ? `<a class="switch-btn req" href="#/maker" title="Add a class from your syllabus or from scratch">${icon('maker', 13)} Add a class</a>` : '');
    const staff = App.auth && App.auth.user && App.auth.user.mod ? [{ label: App.auth.user.admin ? 'Admin' : 'Moderation', items: [['admin', 'Admin panel', 'shield']] }] : [];
    // the class's instructors (assets/instruct.js asks the server which classes this account teaches)
    const tch = App.teaches; if (tch && App.views.instructor && (tch.admin || (tch.courses || []).includes(D.id))) staff.unshift({ label: 'Teaching', items: [['instructor', 'Instructor', 'gear']] });
    const cur = (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[1]) || 'dashboard';
    const openMap = Object.assign({ Learn: true, Practice: true, Plan: true, Admin: true, Moderation: true, Teaching: true }, settings().navOpen || {});
    $('#sidebar-nav').innerHTML = groupNav(D.NAV, D.id).concat(staff).map(gp => { const o = !!openMap[gp.label] || gp.items.some(x => x[0] === cur); return `<button class="nav-label nav-toggle${o ? ' open' : ''}" data-action="navgroup" data-g="${esc(gp.label)}" aria-expanded="${o}"><span>${gp.label}</span><small>${gp.items.length}</small>${icon('chevron', 12)}</button><div class="nav-group${o ? '' : ' closed'}" data-g="${esc(gp.label)}"><div class="nav-group-in">` + gp.items.map(([id, label, ic]) => `<button class="nav-item" data-view="${id}" data-action="nav">${icon(VIEW_ICON[id] || ic)}<span>${label}</span></button>`).join('') + '</div></div>'; }).join('');
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === cur));
  }
  App.rebuildNav = () => { if (D) buildNav(); if (App.paintSidebar) App.paintSidebar(); };   // the class menu, and the sidebar's list of classes (a class added, renamed or made yours)
  App.searchReset = () => { Search.index = null; };
  App.forgetCourse = () => { D = null; QZ = null; };   // the next render sets the class up again (a class pack that changed under the open page)
  function buildLayout() {
    const app = $('.app');
    bind($('#sidebar'), { nav: el => App.go(el.dataset.view), navgroup: el => { const m = Object.assign({}, settings().navOpen || {}); const now = el.classList.contains('open'); m[el.dataset.g] = !now; setSetting('navOpen', m); el.classList.toggle('open', !now); el.setAttribute('aria-expanded', String(!now)); const g = el.nextElementSibling; if (g) g.classList.toggle('closed', now); }, 'pomo-toggle': () => Pomo.toggle(), 'pomo-reset': () => Pomo.reset(), 'pomo-mode': () => Pomo.switchMode() });
    document.addEventListener('click', e => { if (e.target.closest('[data-action="print-page"]')) global.print(); });
    bind($('#topbar'), { menu: () => (App.toggleSidebar ? App.toggleSidebar() : app.classList.toggle('nav-open')), search: () => Search.open(), theme: toggleTheme, 'exam-chip': el => { if (el.dataset.href && !App.inCourse()) location.hash = el.dataset.href; else App.go('dashboard'); }, 'asof-clear': () => { setSetting('asof', ''); render(); toast('Back to today'); }, inbox: () => { if (App.auth && !App.auth.user) App.auth.open('login'); else App.go('forum', 'inbox'); } });
    $('#nav-backdrop').addEventListener('click', () => app.classList.remove('nav-open'));
    applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Search.open(); } if (e.key === 'Escape') { Search.close(); app.classList.remove('nav-open'); } });
    window.addEventListener('hashchange', render);
    setTimeout(() => (global.requestIdleCallback || (f => f()))(() => { App.warmClasses().catch(() => {}); }), 12000);
  }

  /* ---------- Pomodoro ---------- */
  const Pomo = {
    mode: 'focus', left: 25 * 60, running: false, tick: null,
    len() { return this.mode === 'focus' ? 25 * 60 : this.mode === 'long' ? 15 * 60 : 5 * 60; },
    label() { return this.mode === 'focus' ? 'Focus' : this.mode === 'long' ? 'Long break' : 'Break'; },
    watchers: [], done: 0,   // the start page's big timer follows this one (assets/dash.js)
    draw() { const m = Math.floor(this.left / 60), s = this.left % 60; $('#pomo-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; $('#pomo-mode').textContent = this.label(); $('#pomo-toggle').innerHTML = icon(this.running ? 'pause' : 'play', 15); this.watchers.forEach(fn => { try { fn(this); } catch (e) {} }); },
    setMode(m) { this.mode = m; this.reset(); },
    toggle() { this.running ? this.pause() : this.start(); },
    accum: 0,
    start() { if (this.running) return; this.running = true; this.tick = setInterval(() => { this.left--; if (this.mode === 'focus') this.accum++; if (this.left <= 0) this.finish(); this.draw(); }, 1000); this.draw(); },
    pause() { this.running = false; clearInterval(this.tick); this.flush(); this.draw(); },
    reset() { this.pause(); this.left = this.len(); this.draw(); },
    switchMode() { this.mode = this.mode === 'focus' ? 'break' : this.mode === 'break' ? 'long' : 'focus'; this.reset(); },
    flush() { const mins = Math.floor(this.accum / 60); if (mins >= 1 && D) { const ss = store.get('sessions', []); const t = todayISO(); const last = ss[ss.length - 1]; if (last && last.d === t) last.m += mins; else ss.push({ d: t, m: mins }); if (ss.length > 400) ss.splice(0, ss.length - 400); store.set('sessions', ss); markActivity(); if (App.addXP) App.addXP(mins); if (App.quest) App.quest('focus', mins); } this.accum = this.accum % 60; },
    finish() { this.pause(); this.beep(); if (D) markActivity(); if (this.mode === 'focus') this.done++; const long = this.mode === 'focus' && this.done % 4 === 0; toast(this.mode === 'focus' ? (long ? 'Four focus blocks done. Take a 15-minute break.' : 'Focus block done. Take a 5-minute break.') : 'Break over. Back to it.', 4000); this.mode = this.mode === 'focus' ? (long ? 'long' : 'break') : 'focus'; this.left = this.len(); this.draw(); },
    beep() { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), gn = ac.createGain(); o.connect(gn); gn.connect(ac.destination); o.frequency.value = 880; gn.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); ac.close(); }, 500); } catch {} }
  };

  /* ---------- Search (per course) ---------- */
  const Search = {
    index: null, sel: 0, results: [], course: 'all',
    strip(str) { return String(str).replace(/<[^>]+>/g, '').replace(/\$[^$]*\$/g, m => m.replace(/\\[a-zA-Z]+|[{}$^_\\]/g, ' ')); },
    build() {
      const strip = this.strip; const ix = []; const goC = (c, view, param, query) => () => { location.hash = '#/' + c + '/' + view + (param ? '/' + encodeURIComponent(param) : '') + (query ? '?' + new URLSearchParams(query).toString() : ''); };
      [['today', 'Today', 'plan for today due cards lesson challenge'], ['sheet', 'Character sheet', 'character sheet abilities level class d20 dnd stats'], ['focus', 'Focus room', 'focus timer pomodoro study session sounds'], ['resources', 'Resources', 'resources links tutoring textbook videos help'], ['guides', 'Study guides', 'guides how to study exam anxiety notes office hours'], ['tools', 'Tools', 'calculator unit converter citation word counter significant figures'], ['recap', 'Your week', 'weekly recap stats share'], ['gpa', 'GPA calculator', 'gpa grade point average semester cumulative'], ['forum', 'Discussions', 'board forum posts questions classmates'], ['people', 'People', 'classmates members'], ['leagues', 'Leagues', 'weekly league xp rank'], ['settings', 'Settings', 'account settings classes notifications theme email'], ['whatsnew', "What's new", 'changelog updates releases news'], ['contact', 'Contact', 'contact creator nikoloz nonikashvili phone email help feedback'], ['tasks', 'Tasks', 'tasks assignments homework to do task manager priority board kanban due'], ['timetable', 'Timetable', 'timetable schedule builder class times weekly week lectures labs shifts'], ['agenda', 'Calendar', 'calendar month week agenda deadlines exams events academic'], ['timelog', 'Time tracker', 'time tracker hours study timer log'], ['projects', 'Projects & thesis', 'projects thesis paper lab report milestones word count sources'], ['habits', 'Habits', 'habits habit tracker streak routine'], ['goals', 'Goals', 'goals quarterly quarter key results'], ['wheel', 'Wheel of life', 'wheel of life balance scores areas'], ['journal', 'Journal', 'journal diary daily reflection mood gratitude'], ['money', 'Money', 'money finance budget spending expenses income tracker'], ['career', 'Internships & jobs', 'career internships jobs applications research scholarships'], ['portfolio', 'Portfolio', 'portfolio resume cv projects skills'], ['customize', 'Customize', 'customize features modules sidebar menu order hide pin look theme colour color accent text size font spacing corners start page']].filter(([id]) => !App.moduleOn || App.moduleOn(id)).forEach(([id, label, key]) => ix.push({ type: 'page', c: '', t: label, s: SITE, go: () => { location.hash = '#/' + id; }, key: (label + ' ' + key).toLowerCase() }));
      if (App.life) { const Lf = App.life; Lf.all('tasks').forEach(x => ix.push({ type: 'page', c: x.course || '', t: x.title, s: `Task${x.due ? ' · ' + fmtDate(x.due) : ''}`, go: () => { location.hash = '#/tasks'; setTimeout(() => Lf.editTask(x.id), 300); }, key: (x.title + ' ' + (x.notes || '') + ' task').toLowerCase() })); Lf.all('events').forEach(x => ix.push({ type: 'calendar', c: x.course || '', t: x.title, s: `Event · ${fmtDate(x.date)}`, go: () => { location.hash = '#/agenda?d=' + x.date; }, key: (x.title + ' ' + (x.place || '') + ' event').toLowerCase() })); Lf.all('apps').forEach(x => ix.push({ type: 'page', c: '', t: x.company + (x.role ? ' · ' + x.role : ''), s: 'Application', go: () => { location.hash = '#/career'; }, key: (x.company + ' ' + (x.role || '') + ' application').toLowerCase() })); }   // your own planner (assets/life.js)
      (global.MATHUB_RESOURCES ? global.MATHUB_RESOURCES.ITEMS : []).forEach(it => ix.push({ type: 'resource', c: Courses[it.g] ? it.g : '', t: it.t, s: `Resource · ${it.g === 'general' ? 'every class' : it.g === 'msu' ? 'Montana State' : Courses[it.g] ? Courses[it.g].short : it.g}`, go: () => { if (/^https?:/.test(it.u)) global.open(it.u, '_blank', 'noopener'); else location.hash = it.u; }, key: (it.t + ' ' + it.d + ' ' + (it.tags || []).join(' ')).toLowerCase() }));
      (global.MATHUB_GUIDES || []).forEach(g => ix.push({ type: 'guide', c: '', t: g.title, s: `Guide · ${g.minutes} min`, go: () => { location.hash = '#/guides/' + g.id; }, key: (g.title + ' ' + g.blurb + ' ' + g.tags.join(' ')).toLowerCase() }));
      COURSE_ORDER.filter(id => Courses[id]).forEach(id => {
        const C = Courses[id]; const secLabelC = sid => { const x = (C.SECTIONS || []).find(z => z.id === sid); return x ? x.label : sid; };
        if (C.NAV) C.NAV.forEach(gp => gp.items.filter(([v]) => !App.moduleOn || App.moduleOn(v)).forEach(([v, label]) => ix.push({ type: 'page', c: id, t: label, s: `${C.short} · ${gp.label}`, go: goC(id, v), key: (label + ' ' + C.short + ' ' + C.code).toLowerCase() })));
        else ix.push({ type: 'page', c: id, t: `${C.short} dashboard`, s: C.name, go: goC(id, 'dashboard'), key: (C.short + ' ' + C.code + ' ' + C.name + ' notes practice flashcards calendar').toLowerCase() });
        (C.SECTIONS || []).forEach(sec => ix.push({ type: 'notes', c: id, t: `${sec.label} ${sec.title}`, s: `${C.short} · Unit ${sec.unit}`, go: goC(id, 'notes', sec.id), key: (`${sec.label} ${sec.title} ` + (sec.ideas || []).map(strip).join(' ') + ' ' + (sec.pitfalls || []).map(strip).join(' ')).toLowerCase() }));
        (C.FORMULAS || []).forEach(gp => gp.items.forEach(f => ix.push({ type: 'formula', c: id, t: f.n, s: `${C.short} · ${gp.group}`, go: goC(id, 'formulas', null, { q: f.n }), key: (f.n + ' ' + gp.group + ' ' + strip(f.t ? '$' + f.t + '$' : (f.c || ''))).toLowerCase() })));
        (C.FLASHCARDS || []).forEach(cd => ix.push({ type: 'card', c: id, t: strip(cd.f), s: `${C.short} · ${cd.sec ? secLabelC(cd.sec) : 'Unit ' + cd.unit}`, go: goC(id, 'flashcards', cd.id), key: (strip(cd.f) + ' ' + strip(cd.b)).toLowerCase() }));
        (C.CALENDAR || []).forEach(e => ix.push({ type: 'calendar', c: id, t: e[2], s: `${C.short} · ${fmtDate(e[0])}`, go: goC(id, 'calendar', e[0]), key: (e[2] + ' ' + fmtDate(e[0], true)).toLowerCase() }));
        const T = (C.quiz && C.quiz.TOPICS) || C.quizTopics || {}; Object.entries(T).forEach(([tid, t]) => ix.push({ type: 'practice', c: id, t: `Practice: ${t.label}`, s: `${C.short} · ${secLabelC(t.sec)}`, go: goC(id, 'practice', null, { topics: tid }), key: ('practice quiz ' + t.label + ' ' + C.short + ' ' + secLabelC(t.sec)).toLowerCase() }));
      });
      this.index = ix;
    },
    open() {
      if (!this.index) this.build(); const seg = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]; this.course = Courses[seg] ? seg : 'all';
      if ($('#search-modal')) { $('#search-input').focus(); return; }
      const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'search-modal';
      const chips = [['all', 'All classes']].concat(COURSE_ORDER.filter(id => Courses[id]).map(id => [id, Courses[id].short]));
      m.innerHTML = `<div class="modal" role="dialog" aria-label="Search"><input id="search-input" class="search-input" placeholder="Search notes, formulas, flashcards, calendars, pages…" autocomplete="off" aria-label="Search StudyCat"><div class="search-chips" id="search-chips">${chips.map(([id, l]) => `<button type="button" class="chip toggle${id === this.course ? ' on' : ''}" data-c="${id}">${esc(l)}</button>`).join('')}</div><div class="search-results" id="search-results"></div><div class="search-foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">Enter</span> open</span><span><span class="kbd">Esc</span> close</span></div></div>`;
      document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) this.close(); });
      const inp = $('#search-input'); inp.focus(); inp.addEventListener('input', () => this.query(inp.value));
      const missing = App.myCourses().filter(id => Courses[id] && !Courses[id].loaded); if (missing.length) App.loadCourses(missing).then(r => { if (r.some(Boolean) && $('#search-modal')) { this.index = null; this.query(inp.value); } });
      inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); this.sel = Math.min(this.sel + 1, this.results.length - 1); this.paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); this.sel = Math.max(this.sel - 1, 0); this.paint(); } else if (e.key === 'Enter') { const r = this.results[this.sel]; if (r) { this.close(); r.go(); } } });
      on($('#search-chips'), 'click', '.chip', el => { this.course = el.dataset.c; $$('#search-chips .chip').forEach(c => c.classList.toggle('on', c === el)); this.query(inp.value); inp.focus(); });
      on($('#search-results'), 'click', '.search-item', el => { const r = this.results[+el.dataset.i]; if (r) { this.close(); r.go(); } });
      this.query('');
    },
    close() { const m = $('#search-modal'); if (m) App.dismiss(m); },
    query(q) {
      if (!this.index) this.build();
      q = q.trim().toLowerCase(); const words = q.split(/\s+/).filter(Boolean); const pool = this.index.filter(r => this.course === 'all' || !r.c || r.c === this.course);
      this.results = !q ? pool.filter(r => r.type === 'page').slice(0, 14) : pool.map(r => ({ r, score: words.reduce((sc, w) => sc + (r.t.toLowerCase().includes(w) ? 3 : r.key.includes(w) ? 1 : -100), 0) + (D && r.c === D.id ? 0.5 : 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 30).map(x => x.r);
      { const m = q.toUpperCase().replace(/[\s\-_.]+/g, ' ').match(/^([A-Z]{1,5}) ?([0-9]{3}[A-Z]{0,3})$/); const bare = c => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/([0-9])[A-Z]+$/, '$1');   // a course code StudyCat does not have: offer to request it
        if (m && App.views.maker && !COURSE_ORDER.some(id => Courses[id] && bare(Courses[id].code) === bare(m[1] + m[2]))) { const code = `${m[1]} ${m[2]}`; this.results.unshift({ type: 'request', t: `Make ${code}`, s: 'Not in your classes yet. Make it from your syllabus.', key: '', go: () => { location.hash = '#/maker?code=' + encodeURIComponent(code); } }); } }
      this.sel = 0; this.paint();
    },
    paint() { const box = $('#search-results'); if (!box) return; box.innerHTML = this.results.length ? this.results.map((r, i) => `<div class="search-item${i === this.sel ? ' active' : ''}" data-i="${i}"><span class="type">${r.type}</span><span class="t">${esc(r.t)}</span><span class="s">${r.c && Courses[r.c] ? `<span class="chip course-${r.c}">${esc(Courses[r.c].short)}</span> ` : ''}${esc(r.s)}</span></div>`).join('') : '<div class="empty small">No matches. Try another word or another class.</div>'; const a = $('.search-item.active', box); if (a) a.scrollIntoView({ block: 'nearest' }); }
  };

  /* ======================================================
     Landing page (course chooser)
     ====================================================== */
  /* ---------- picking your classes: everyone picks the Montana State classes they take (none come by default) ---------- */
  function pickClassesHtml() {
    const ids = App.catalogIds(); const cc = id => (App.life && App.life.ccStyle ? App.life.ccStyle(id) : '');
    return `<section class="panel pick-classes" id="pick-classes" aria-labelledby="pk-h">
      <div class="pk-head"><span class="pk-ic" aria-hidden="true">${icon('cap', 24)}</span><div><h2 class="pk-title" id="pk-h">Which classes are you taking?</h2><p class="muted">Pick yours to start. StudyCat shows only your classes: their notes, practice, dates and Bo. Change them any time in Settings.</p></div></div>
      <div class="pk-grid" role="group" aria-labelledby="pk-h">${ids.map(id => { const C = Courses[id]; return `<label class="pk-c" style="${cc(id)}"><input type="checkbox" value="${esc(id)}"><span class="pk-tile" aria-hidden="true">${esc(C.short || C.code)}</span><span class="pk-t"><b>${esc(C.name)}</b><small>${esc(C.code)}${C.term ? ` · ${esc(C.term)}` : ''}</small></span><span class="pk-tick" aria-hidden="true">${icon('check', 14)}</span></label>`; }).join('')}</div>
      <div class="pk-go"><button class="btn primary" type="button" id="pk-save" disabled>Pick at least one class</button>${App.createLink ? App.createLink('small') : ''}</div>
      <p class="small pk-msg" id="pk-msg" role="status"></p></section>`;
  }
  function wirePickClasses(root) {
    const box = $('#pick-classes', root); if (!box) return; const btn = $('#pk-save', box);
    const picked = () => $$('.pk-c input:checked', box).map(i => i.value);
    box.addEventListener('change', e => { const l = e.target.closest('.pk-c'); if (l) l.classList.toggle('on', e.target.checked); const n = picked().length; btn.disabled = !n; btn.textContent = n ? (n === 1 ? 'Save my class' : `Save my ${n} classes`) : 'Pick at least one class'; });
    btn.addEventListener('click', async () => {
      const ids = picked(); if (!ids.length) return; const own = App.myClasses ? App.myClasses.list().map(e => e.id) : [];
      const all = ids.concat((settings().courses || []).filter(id => own.includes(id) && !ids.includes(id)));
      setSetting('courses', all); btn.disabled = true;
      try { if (App.auth && App.auth.user && !App.auth.user.local && App.auth.savePrefs) await App.auth.savePrefs({ courses: all }); } catch (e) { $('#pk-msg', box).textContent = 'Saved on this device. It goes to your account when you are back online.'; }
      toast(ids.length === 1 ? 'Your class is set.' : `Your ${ids.length} classes are set.`, 2600);
      if (App.rebuildNav) App.rebuildNav(); App.rerender();
      if (App.promptCustomize) setTimeout(() => App.promptCustomize(ids), 400);   // make each one yours (assets/maker.js)
    });
  }

  const Landing = {
    title: SITE,
    render(root) {
      const t = todayISO(); const d = today();
      const guest = App.guest(); const mineIds = App.myCourses();
      const first = Courses[COURSE_ORDER[0]]; const ss = semesterState(first);
      const greeting = d.getHours() < 12 ? 'this morning' : d.getHours() < 18 ? 'this afternoon' : 'tonight';
      const who = App.auth && App.auth.user && !App.auth.user.local ? String(App.auth.user.name || '').trim().split(/\s+/)[0] : '';
      const sub = ss.phase === 'before' ? `Classes start ${esc(fmtDate(first.SEMESTER.start, true))}. Get a head start on the first topics.` : ss.phase === 'after' ? 'The semester is over. Everything stays here for review.' : `Which class is giving you trouble ${greeting}?`;
      const U = App.auth && App.auth.user && !App.auth.user.local ? App.auth.user : null;
      const fresh = !(App.xpTotal && App.xpTotal()) && !settings().lastVisit && !(U && Array.isArray(U.courses) && U.courses.length);   // someone who has not studied here yet
      const picking = !mineIds.length;   // nobody gets the Montana State classes by default: pick yours first
      const hello = who && ss.phase !== 'before' && ss.phase !== 'after' ? `${esc(who)}, which class is giving you trouble ${greeting}?` : sub;
      // the hero's Pick your classes: down to the class picker, its first class focused (below the hero on a phone)
      const goPick = () => { const box = $('#pick-classes', root); if (!box) return; box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); const f = $('.pk-c input', box); if (f) setTimeout(() => f.focus({ preventScroll: true }), 350); };
      if (App.startPitch) App.startPitch.clear();
      // a newcomer (not signed in, no class yet) gets the whole story of StudyCat on one page (assets/start.js)
      if (App.startPitch && App.startPitch.needed()) {
        root.innerHTML = App.startPitch.html({ when: `${fmtDate(t, true)} · ${first.term}${ss.phase === 'during' ? ` · Week ${ss.week}` : ''}`, picker: pickClassesHtml(), banners: (App.inviteBanner ? App.inviteBanner() : '') + (App.recapBanner ? App.recapBanner() : '') });
        bind(root, { 'go-pick': goPick }); wirePickClasses(root); paintAnnouncement(root); App.startPitch.wire(root);
        if (App.social && App.social.presencePing) { if (App.auth && App.auth.ready) App.social.presencePing(); else if (App.auth) App.auth.onChange(function once() { App.social.presencePing(); }); }
        return;
      }
      const startHere = fresh ? `<div class="start-steps">${[['1', 'Pick a class', 'Your classes are below, in Your home. Tap one to open it.'], ['2', 'Take a 5-minute lesson', 'A few questions with worked answers. No setup.'], ['3', guest ? 'Sign up to keep it' : 'Come back tomorrow', guest ? 'A free montana.edu account saves your progress everywhere.' : 'Your streak and daily plan pick up where you left off.']].map(([n, h, p]) => `<div class="start-step"><span class="ss-n">${n}</span><div><b>${h}</b><small>${p}</small></div></div>`).join('')}</div>` : '';
      root.innerHTML = `<div class="landing-wrap">
        <header class="landing-top hero dash-hero"><div><p class="hero-when">${esc(fmtDate(t, true))} · ${esc(first.term)}${ss.phase === 'during' ? ` · Week ${ss.week}` : ''}</p><h1 class="landing-title hero-sub">${hello}</h1>${guest ? '<p class="muted small hero-note">Every class you take, made simple: what is on the next exam, five-minute lessons and a tutor you can call. Free with a montana.edu email.</p>' : ''}${(() => { const soon = mineIds.map(id => ({ C: Courses[id], ex: nextExam(Courses[id]) })).filter(x => x.ex && x.ex.date >= t).sort((a, b) => a.ex.date.localeCompare(b.ex.date))[0]; if (!soon) return ''; const n = daysBetween(t, soon.ex.date); return `<a class="hero-count" href="#/${soon.C.id}/dashboard"><span class="hc-num count" data-count="${n}">${n}</span><span class="hc-body"><small>day${n === 1 ? '' : 's'} until ${esc(soon.ex.name)}</small><b>${esc(soon.C.short)} · ${esc(soon.ex.dateLabel || fmtDate(soon.ex.date, true))}${App.readiness ? (() => { const r = App.readiness(soon.C.id); return r && r.ok && r.score > 0 ? ` · ${r.score}% ready` : ''; })() : ''}</b></span>${icon('right', 14)}</a>`; })()}</div><div class="row gap-sm hero-actions">${picking ? `<button type="button" class="btn primary sm hero-today hero-pick" data-action="go-pick">${icon('cap', 14)} Pick your classes</button>` : `<a class="btn primary sm hero-today" href="#/today">${icon('flag', 14)} Today</a>`}<a class="btn sm hero-faculty" href="#/teach" title="StudyCat Faculty: write your syllabus and run your class">${icon('file', 14)} For professors</a></div><div class="mascot-slot hero-mascot" data-size="96"></div><div class="px-skyline" aria-hidden="true"></div></header>
        <div id="announcement-slot"></div>
        ${App.inviteBanner ? App.inviteBanner() : ''}${App.recapBanner ? App.recapBanner() : ''}${picking ? pickClassesHtml() : fresh ? startHere : ''}
        ${App.dash ? App.dash.html() : ''}
        ${guest ? '<p class="small muted mt-2" style="text-align:center">Look around as much as you like. Sign up with a montana.edu email to keep your progress on every device.</p>' : ''}</div>`;
      if (App.dash) App.dash.paint(root);   // your home: the widgets you arranged (assets/dash.js)
      // someone with no classes yet: the hero's button goes to the class picker (Today would be empty), below the hero on a phone
      bind(root, { theme: toggleTheme, search: () => Search.open(), 'go-pick': goPick }); applyTheme(); if (picking) wirePickClasses(root);
      const slot = $('#landing-account', root); if (slot && App.auth) App.auth.paintLandingAccount(slot);
      paintAnnouncement(root);
      if (App.ambient && App.ambient.paint) try { App.ambient.paint(); } catch (e) {}   // the sound button in the hero shows what is playing
      if (App.social && App.social.presencePing) { if (App.auth && App.auth.ready) App.social.presencePing(); else if (App.auth) App.auth.onChange(function once() { App.social.presencePing(); }); }
    }
  };

  /* ======================================================
     VIEW: Dashboard
     ====================================================== */
  function renderWritingDash(root) {
    const t = todayISO(); const d = today(); const ex = nextExam(D); const ss = semesterState(D); const wk = ss.week; const cur = currentSection(D); const st = streak(); const dl = upcomingDeadlines(D, 5); const todayEv = eventsOn(D, t);
    const weekLabel = ss.phase === 'before' ? `Starts ${esc(shortDate(D.SEMESTER.start))}` : ss.phase === 'after' ? 'Semester over' : ss.phase === 'finals' ? 'Finals week' : `Week ${wk} of ${ss.weeks}`;
    const es = ex ? examStatus(ex) : null; const cl = ex ? checklistState(ex.id) : { items: [], done: 0 }; const clState = ex ? (store.get('checklists', {})[ex.id] || {}) : {};
    const rp = App.readingProgress ? App.readingProgress(D) : { total: 0, done: 0, next: null }; const rprog = store.get('readings', {});
    const xpT = App.xpToday ? App.xpToday() : 0, goal = App.dailyGoal ? App.dailyGoal() : 30, lv = App.level ? App.level() : null; const gpct = Math.min(100, Math.round(100 * xpT / goal)); const RB = 2 * Math.PI * 26;
    const goalBlock = `<div class="today-goal"><span class="ring-big${gpct >= 100 ? ' done' : ''}"><svg viewBox="0 0 60 60" width="64" height="64" aria-hidden="true"><circle class="ring-bg" cx="30" cy="30" r="26"/><circle class="ring-fg" cx="30" cy="30" r="26" stroke-dasharray="${RB.toFixed(2)}" stroke-dashoffset="${(RB * (1 - gpct / 100)).toFixed(2)}"/></svg><span class="ring-txt">${gpct >= 100 ? icon('check', 18) : `<b>${xpT}</b><small>XP</small>`}</span></span><div class="today-goal-body"><div><b>${xpT} / ${goal} XP today</b>${lv ? ` <span class="chip accent">Level ${lv.n} · ${esc(lv.name)}</span>` : ''}</div><div class="small muted">${gpct >= 100 ? 'Daily goal done. Listening still counts toward your level.' : `${goal - xpT} XP to go · a paragraph is 1 XP, a finished reading 20`}</div></div></div>`;
    const gs = App.gettingStarted ? App.gettingStarted() : null;
    const gsCard = gs ? `<div class="panel gs-card"><div class="panel-h"><div class="panel-title">${icon('flag')} Getting started · ${gs.done} of ${gs.total}</div><button class="btn xs ghost" data-action="gs-dismiss">Hide</button></div><div class="gs-items">${gs.items.map(i => `<a class="gs-item${i.done ? ' done' : ''}" href="${i.href}"${i.action ? ` data-action="${i.action}"` : ''}><span class="gs-check">${icon('check', 12)}</span><span>${esc(i.label)}</span></a>`).join('')}</div></div>` : '';
    const weekMon = addDays(d, -((d.getDay() + 6) % 7)); const weekDays = Array.from({ length: 5 }, (_, i) => toISO(addDays(weekMon, i)));
    const units = D.UNITS.map(u => { const e = D.EXAMS.find(x => x.id === u.exam); const done = e ? (e.endDate || e.date) < t : false; const active = !done && e && D.EXAMS.filter(x => (x.endDate || x.date) >= t)[0] && u.sections.includes(cur.id); return { u, e, done, active }; });
    const remindNudge = App.auth && App.auth.user && !App.auth.user.local && App.auth.mode === 'server' && !App.auth.user.reminder_email && !settings().remindNudgeDismissed;
    const draftFor = ex && App.views.drafts ? (D.DRAFTS || []).find(p => p.draft === ex.id || p.revised === ex.id) : null;   // the next deadline is a project draft: Bo's feedback on it (assets/drafts.js)
    const deadlineTile = ex ? `<div class="panel lift hero-exam"><div class="countdown"><div class="countdown-num${es.big.length > 3 ? ' small' : ''}">${esc(es.big)}</div><div class="countdown-label">${esc(es.label)}</div></div>
        <div><div class="eyebrow">Next deadline${ex.weight ? ` · ${ex.weight}% of the grade` : ''}</div><h2 style="font-size:26px;margin-top:2px">${esc(ex.name)} <span class="muted" style="font-size:16px;font-weight:400">· ${esc(ex.dateLabel || fmtDate(ex.date, true))}</span></h2><p class="muted mt-1">Turn in ${esc(ex.covers)}.</p>
        <div class="bar-row mt-2"><span>Prep checklist</span><span class="mono">${cl.done} / ${cl.items.length}</span><div class="bar"><div class="bar-fill gold" style="width:${cl.items.length ? 100 * cl.done / cl.items.length : 0}%"></div></div></div>
        <div class="row mt-2">${draftFor ? `<a class="btn primary" href="${L('drafts', null, { p: draftFor.id, stage: draftFor.revised === ex.id ? 'revised' : 'draft' })}">${icon('pen', 14)} Get feedback on your draft</a><a class="btn" href="${L('course')}">${icon('info', 14)} Assignment details</a>` : `<a class="btn primary" href="${L('course')}">${icon('info', 14)} Assignment details</a>`}<a class="btn" href="${L('readings')}">${icon('book', 14)} Readings</a><a class="btn" href="${L('calendar')}">${icon('calendar', 14)} Calendar</a></div></div></div>`
      : `<div class="panel lift hero-exam"><div class="countdown"><div class="countdown-num small">Done</div><div class="countdown-label">all deadlines</div></div><div><div class="eyebrow">${esc(D.code)}</div><h2 style="font-size:26px;margin-top:2px">Semester complete</h2><p class="muted mt-1">Every deadline has passed. The readings and the grade calculator stay here.</p></div></div>`;
    root.innerHTML = `<div class="page-head"><div><div class="eyebrow">${esc(fmtDate(t, true))} · ${weekLabel} · ${esc(D.code)}</div><h1 class="page-title">Good ${d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening'}. Here's where ${esc(D.short)} stands.</h1></div><div class="page-actions"></div></div><div id="announcement-slot"></div>
      <div class="stack">${remindNudge ? `<div class="callout small row between" style="gap:10px"><span>${icon('bell', 14)} Want an email the evening before something is due, and a heads-up when your streak is about to end?</span><span class="row gap-sm"><button class="btn xs primary" data-action="remind-on">Turn on</button><button class="btn xs ghost" data-action="remind-no">No thanks</button></span></div>` : ''}${deadlineTile}${gsCard}
        <div class="grid cols-3">
          <div class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} Today</div><a href="${L('calendar')}" class="small">Full calendar</a></div>
            ${todayEv.length ? todayEv.map(e => `<div class="today-ev"><span class="chip ${e[1]}">${e[1] === 'lecture' ? 'class' : e[1]}</span><span>${esc(e[2])}</span></div>`).join('') : `<div class="empty small">No class today.${(() => { const nx = D.CALENDAR.find(e => e[0] > t && e[1] === 'lecture'); return nx ? ` Next: ${esc(fmtDate(nx[0]))}, ${esc(D.COURSE.meets.split(',')[1] || '9 am')}.` : ''; })()}</div>`}
            <div class="divider"></div><div class="eyebrow mb-1">${esc(cur.label)} · ${esc(cur.title)}</div><ul class="list-plain small">${(cur.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
            <div class="divider"></div><div class="eyebrow mb-1">Due soon</div>${dl.length ? dl.slice(0, 4).map(x => `<div class="today-ev"><span class="when">${daysBetween(t, x.date) === 0 ? 'Today' : daysBetween(t, x.date) === 1 ? 'Tomorrow' : esc(fmtDate(x.date))}</span><span>${esc(x.title)}${x.time ? ` <span class="muted small">· ${esc(x.time)}</span>` : ''}</span></div>`).join('') : '<div class="empty small">Nothing scheduled.</div>'}</div>
          <div class="panel"><div class="panel-h"><div class="panel-title">${icon('fire')} Your progress</div></div>
            ${goalBlock}
            <div class="grid cols-2" style="gap:10px"><div class="stat"><div class="stat-num" data-count="${st}">${st}</div><div class="stat-label">day streak</div></div><div class="stat"><div class="stat-num" data-count="${rp.done}">${rp.done}<span class="muted" style="font-size:15px">/${rp.total}</span></div><div class="stat-label">readings finished</div></div></div>
            <div class="divider"></div>
            ${units.map(({ u, e, done, active }) => `<div class="bar-row"><span>${esc(u.title)}</span><span class="mono">${done ? 'done' : e ? esc(shortDate(e.date)) : ''}</span><div class="bar"><div class="bar-fill ${done ? 'good' : active ? 'warn' : ''}" style="width:${done ? 100 : active ? 50 : 0}%"></div></div></div>`).join('')}</div>
          <div class="panel keep-going"><div class="panel-h"><div class="panel-title">${icon('book')} Keep going</div>${rp.next ? '<span class="small muted">next reading</span>' : ''}</div>
            <a class="btn keep-cta" href="${rp.next ? L('reading', rp.next.id, rprog[rp.next.id] && rprog[rp.next.id].i ? {} : { play: 1 }) : L('readings')}">${icon(rp.next ? 'play' : 'book', 15)} ${rp.next ? `${rp.started ? 'Resume' : 'Listen'}: ${esc(rp.next.title)}` : 'Browse the readings'}</a>
            <div class="eyebrow mt-3 mb-1">Readings</div>${(D.READINGS || []).map(r => { const pr = rprog[r.id] || {}; const n = r.parts.reduce((a, pt) => a + pt.p.length + (pt.h ? 1 : 0), 0); const pct = pr.done ? 100 : Math.round(100 * Math.min(pr.i || 0, n) / n); return `<a class="bar-row rd-row" href="${L('reading', r.id)}"><span>${esc(r.title)}<small class="muted"> · ${esc(r.author)}</small></span><span class="mono">${pr.done ? '✓' : pct + '%'}</span><div class="bar"><div class="bar-fill${pr.done ? ' good' : ''}" style="width:${pct}%"></div></div></a>`; }).join('')}
            ${D.NOTEBOOK && App.views.notebook ? `<a class="card-link mt-2" href="${L('notebook')}"><div class="eyebrow">${icon('quill', 13)} Writer’s notebook</div><h4>Your ${D.NOTEBOOK.count} entries</h4><p>Write each week’s entry here. They are kept with your account and download as one Word file for handing in.</p></a>` : ''}
            <a class="card-link mt-2" href="${L('phonetics')}"><div class="eyebrow">${icon('mic', 13)} Phonetics lab</div><h4>Sounds, IPA and stress</h4><p>${(() => { const pp = App.phoneticsProgress ? App.phoneticsProgress(D) : null; return pp && pp.answered ? `${pp.answered} answered · ${pp.pct}% right · ${pp.seen} of ${pp.symbols} symbols explored.` : 'Practice transcription, minimal pairs, syllables and stress. XP for every answer.'; })()}</p></a>
            <div class="eyebrow mt-3 mb-1">Daily quests</div><div class="quests-slot" data-compact="1"></div></div>
        </div>
        <div class="dash-tabs" data-store="dashTabW" role="tablist">${[['week', 'This week', 'calendar'], ['check', 'Checklist', 'check'], ['league', 'League', 'gem'], ['community', 'Community', 'chat']].map(([k, l, ic]) => `<button class="tab" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${l}</span></button>`).join('')}</div>
        <div class="panes">
          <div class="pane" data-pane="week"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} This week</div><span class="small muted">${esc(shortDate(weekDays[0]))} – ${esc(shortDate(weekDays[4]))}</span></div>
            <div class="week-strip">${weekDays.map(iso => { const dd = parseISO(iso); const evs = eventsOn(D, iso); return `<div class="week-day${iso === t ? ' today' : iso < t ? ' past' : ''}"><div class="d">${DOW[dd.getDay()]}<span>${dd.getDate()}</span></div>${evs.length ? evs.map(e => `<div class="ev ${e[1]}">${esc(e[2].replace(/^Week \d+ · /, ''))}</div>`).join('') : '<div class="ev muted">—</div>'}</div>`; }).join('')}</div></div><div class="mt-2"><div id="dash-canvas"></div></div></div>
          <div class="pane" data-pane="check"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('check')} ${ex ? esc(ex.name) + ' checklist' : 'Checklist'}</div>${ex ? `<span class="small muted">${cl.done} of ${cl.items.length} done</span>` : ''}</div>${cl.items.length ? cl.items.map((it, i) => `<label class="check"><input type="checkbox" data-cl="${i}" ${clState[i] ? 'checked' : ''}><span>${esc(it)}</span></label>`).join('') : '<div class="empty small">Nothing to check off right now.</div>'}</div></div>
          <div class="pane" data-pane="league"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('gem')} Your league</div><a class="small" href="${L('leagues')}">All leagues</a></div><div class="league-slot"></div></div></div>
          <div class="pane" data-pane="community"><div class="grid cols-3"><div id="dash-social" class="span-2 stack"></div><div id="dash-social-side"></div></div></div>
        </div>
      </div>`;
    bind(root, { 'remind-on': async () => { try { await App.auth.savePrefs({ reminder_email: true }); toast('Evening reminders on', 3000); render(); } catch (e) { toast(e.message); } }, 'remind-no': () => { setSetting('remindNudgeDismissed', true); render(); }, 'gs-dismiss': () => { setSetting('gsDismissed', true); render(); }, 'gs-signup': (el, e) => { e.preventDefault(); if (App.auth) App.auth.open('signup'); } });
    on(root, 'change', 'input[data-cl]', el => { if (!ex) return; const all = store.get('checklists', {}); all[ex.id] = all[ex.id] || {}; all[ex.id][el.dataset.cl] = el.checked; store.set('checklists', all); markActivity(); });
    Canvas.fill($('#dash-canvas', root), D.id, 6); paintAnnouncement(root);
    if (App.social) { const goS = () => App.social.fillDashboard($('#dash-social', root), D.id); if (App.auth && App.auth.ready) goS(); else if (App.auth) App.auth.onChange(function once() { goS(); }); }
  }
  App.views.dashboard = {
    title: 'Dashboard',
    render(root) {
      if (D.kind === 'writing') return renderWritingDash(root);
      const t = todayISO(); const d = today(); const ex = nextExam(D); const ss = semesterState(D); const wk = ss.week;
      const todayEv = eventsOn(D, t); const dl = upcomingDeadlines(D, 6); const st = streak();
      const hist = store.get('history', []); const answered = hist.length, correct = hist.filter(x => x.ok).length; const cm = cardsMastered(); const cur = currentSection(D);
      const weekMon = addDays(d, -((d.getDay() + 6) % 7)); const weekDays = Array.from({ length: 5 }, (_, i) => toISO(addDays(weekMon, i)));
      const cl = ex ? checklistState(ex.id) : { items: [], done: 0 }; const p = progress();
      const weak = Object.entries(p).filter(([k, v]) => QZ && QZ.TOPICS[k] && v.a >= 3 && v.c / v.a < 0.7).sort((a, b) => (a[1].c / a[1].a) - (b[1].c / b[1].a)).slice(0, 4);
      const es = ex ? examStatus(ex) : null;
      const rd = App.readiness ? App.readiness(D.id) : null; const weak0 = rd && rd.ok && rd.weakest && rd.weakest[0];
      const readyLine = rd && rd.ok ? `<div class="ready-line"><b>${rd.score}% ready</b> · ${esc(rd.label)}${weak0 ? ` · weakest: ${esc(weak0.label)}` : ''} <button class="linkbtn" data-action="tab-ready">How to raise it ${icon('right', 12)}</button></div>` : '';
      // the trail board: the exam is the summit, its sections are the runs, each marked by how hard it is for this student right now
      const trailTile = (() => {
        if (!ex || !rd || !rd.ok || !D.SECTIONS) return '';
        const bySec = {}; rd.topics.forEach(x => { (bySec[x.sec] = bySec[x.sec] || []).push(x); });
        const secIds = ex.cumulative ? D.SECTIONS.map(s => s.id).filter(id => bySec[id]) : (ex.sections || []).filter(id => bySec[id] || D.SECTIONS.some(s => s.id === id)); if (!secIds.some(id => bySec[id])) return '';
        const runs = secIds.map(id => { const s = D.SECTIONS.find(x => x.id === id) || { id, label: id, title: '' }; const ts = bySec[id] || []; const a = ts.reduce((n, x) => n + x.a, 0); const score = ts.length ? ts.reduce((n, x) => n + x.score, 0) / ts.length : 0; return { s, ts, a, score, grade: !a ? 'new' : score >= 0.65 ? 'easy' : score >= 0.35 ? 'mid' : 'hard' }; });
        const weakSec = rd.weakest && rd.weakest[0] ? rd.weakest[0].sec : null;
        const here = runs.find(r => r.s.id === weakSec) || runs.find(r => r.ts.length && r.grade !== 'easy') || runs.filter(r => r.ts.length).pop();
        const GRADE = { easy: 'green circle, solid', mid: 'blue square, getting there', hard: 'black diamond, hard for you right now', new: 'not tried yet', notes: 'notes only, no practice questions yet' };
        const runHref = r => r.ts.length ? L('practice', null, { topics: r.ts.map(x => x.t).join(',') }) : L('notes', r.s.id);
        const sect = courseSetting(D.id, 'section', ''), etime = courseSetting(D.id, 'examTime', '');
        const anim = !trailSeen.has(D.id); trailSeen.add(D.id); const hi = runs.indexOf(here);
        const glyph = g => `<i class="run-glyph ${g}" aria-hidden="true"></i>`;
        // each run sits on a winding trail: x offsets follow a gentle wave so the nodes zig-zag up the mountain
        const wave = i => Math.round(50 * Math.sin(i * 1.15 + 0.4));
        const scoreText = r => !r.ts.length ? 'notes only' : r.a ? `${Math.round(100 * r.score)}% · ${r.grade === 'easy' ? 'solid' : r.grade === 'mid' ? 'getting there' : 'hard for you'}` : 'not tried yet';
        const bo = x => App.bobcatSvg ? `<span class="tb-bo ${x < 0 ? 'bo-r' : 'bo-l'}" aria-hidden="true">${App.bobcatSvg(64)}</span>` : '';
        const readyPct = Math.max(0, Math.min(100, rd.score));
        const clDone = store.get('checklists', {})[ex.id] || {}; const nextChecks = cl.items.map((t, i) => [t, i]).filter(([, i]) => !clDone[i]).slice(0, 3);
        return `<div class="panel lift hero-exam trail-board${anim ? ' tb-anim' : ''}${runs.length > 9 ? ' tb-many' : ''}">
          <div class="tb-summit">
            <div class="tb-head">
              <h2 class="tb-exam">${esc(ex.name)}</h2>
              <div class="tb-date">${esc(ex.dateLabel || fmtDate(ex.date, true))}</div>
              ${sect || etime ? `<div class="tb-meta">Your section${sect ? ' ' + esc(sect) : ''}${etime ? ' · ' + esc(etime) : ''}</div>` : ''}
            </div>
            <div class="tb-days"><b>${esc(es.big)}</b><span>${esc(es.label)}</span></div>
            <p class="tb-covers">Covers ${esc(ex.covers)}. ${esc(ex.format || 'Closed book, no devices.')}${ex.weight ? ` ${ex.weight}% of the grade.` : ''}</p>
            <div class="tb-ready"><div class="ready-line"><b>${rd.score}% ready</b><span>${esc(rd.label)}</span><button class="linkbtn" data-action="tab-ready">How to raise it ${icon('right', 12)}</button></div><div class="tb-readybar" role="presentation"><i style="width:${readyPct}%"></i></div></div>
            ${cl.items.length ? `<div class="tb-checks"><div class="tb-checks-h"><b>Prep checklist</b><span>${cl.done} of ${cl.items.length} done</span></div>${nextChecks.map(([t, i]) => `<label class="tb-check"><input type="checkbox" data-cl="${i}"><span>${esc(t)}</span></label>`).join('')}</div>` : ''}
            <div class="tb-go"><a class="btn primary lg tb-next" href="${runHref(here)}"><span class="tb-next-a">${icon('play', 15)} Take the next run</span><span class="tb-next-b">${esc(here.s.label)} ${esc(here.s.title)}</span></a><p class="tb-more"><a href="${L('exam', ex.id)}">${esc(ex.name)} ${D.PRACTICE && D.PRACTICE[ex.id] ? 'practice set' : 'prep'}</a><a href="${L('practice', null, { exam: ex.id })}">Drill every run</a><a href="${L('flashcards', null, { unit: ex.units[ex.units.length - 1] })}">Flashcards</a></p></div>
          </div>
          <div class="tb-trail">
            <svg class="tb-scene" viewBox="0 0 600 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><circle class="tb-sun" cx="552" cy="128" r="30"/><path class="tb-cloud" d="M64 120h86a16 16 0 0 0-14-24 22 22 0 0 0-40-6 15 15 0 0 0-32 30z"/><path class="tb-cloud" d="M392 196h64a12 12 0 0 0-10-18 17 17 0 0 0-31-4 11 11 0 0 0-23 22z"/><path class="tb-m-far" d="M0 330L70 262l52 40 86-108 70 82 60-54 92 96 66-62 104 92V560H0z"/><path class="tb-m-near" d="M0 470c60-30 120-42 190-30s120 34 200 26 150-34 210-28V560H0z"/></svg>
            <div class="tb-ridge" aria-hidden="true"></div>
            <div class="tb-climb">
              <svg class="tb-peak" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="tb-peak-side" d="M50 0L100 100H0z"/><path class="tb-peak-shade" d="M50 0L100 100H62z"/><path class="tb-peak-snow" d="M50 0L58.5 15 54 12.5 50 17 46 12.5 41.5 15z"/></svg><svg class="tb-path" aria-hidden="true" focusable="false"></svg>
              <div class="tb-summit-row"><span class="tb-flag" aria-hidden="true"><svg viewBox="0 0 32 40" width="30" height="38"><path d="M6 38V3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path class="tb-flag-cloth" d="M8 4h19l-5 7 5 7H8z"/></svg></span><span class="tb-summit-text"><b>${esc(ex.name)}</b> · the summit</span></div>
              <ol class="tb-runs" aria-label="The runs to ${esc(ex.name)}, from the trailhead up">${runs.map((r, i) => { const x = wave(i); return `<li style="--k:${i};--x:${x}px"><a class="tb-run ${r.grade}${r === here ? ' here' : ''}${r.grade === 'easy' ? ' done' : ''}" href="${runHref(r)}" title="${esc(GRADE[r.ts.length ? r.grade : 'notes'])}"><span class="tb-band"><span class="tb-node">${glyph(r.grade)}</span>${r === here ? bo(x) : ''}</span><span class="tb-label"><span class="tb-sec">${esc(r.s.label)}</span><span class="tb-name">${esc(r.s.title)}<span class="sr-only"> (${esc(GRADE[r.ts.length ? r.grade : 'notes'])})</span></span>${r === here ? `<span class="tb-pin" style="--n:${hi}">You are here</span>` : `<span class="tb-score">${scoreText(r)}</span>`}</span></a></li>`; }).join('')}</ol>
              <div class="tb-base"><span class="tb-base-sign">Trailhead</span></div>
            </div>
            <div class="tb-legend" aria-hidden="true"><span>${glyph('easy sm')} solid</span><span>${glyph('mid sm')} getting there</span><span>${glyph('hard sm')} hard for you</span><span>${glyph('new sm')} not tried</span></div>
          </div></div>`;
      })();
      const examTile = trailTile || (ex ? `<div class="panel lift hero-exam">
          <div class="countdown"><div class="countdown-num${es.big.length > 3 ? ' small' : ''}">${esc(es.big)}</div><div class="countdown-label">${esc(es.label)}</div></div>
          <div><div class="eyebrow">Next exam${ex.weight ? ` · ${ex.weight}% of the grade` : ''}</div>
            <h2 style="font-size:26px;margin-top:2px">${esc(ex.name)} <span class="muted" style="font-size:16px;font-weight:400">· ${esc(ex.dateLabel || fmtDate(ex.date, true))}</span></h2>
            ${courseSetting(D.id, 'section', '') || courseSetting(D.id, 'examTime', '') ? `<p class="small" style="opacity:.85;margin-top:2px">${icon('info', 12)} Your section${courseSetting(D.id, 'section', '') ? ' ' + esc(courseSetting(D.id, 'section', '')) : ''}${courseSetting(D.id, 'examTime', '') ? ' · ' + esc(courseSetting(D.id, 'examTime', '')) : ''}</p>` : ''}
            <p class="muted mt-1">Covers ${esc(ex.covers)}. ${esc(ex.format || 'Closed book, no devices.')}</p>
            <div class="bar-row mt-2"><span>Prep checklist</span><span class="mono">${cl.done} / ${cl.items.length}</span><div class="bar"><div class="bar-fill gold" style="width:${cl.items.length ? 100 * cl.done / cl.items.length : 0}%"></div></div></div>${readyLine}
            <div class="row mt-2">${D.PRACTICE && D.PRACTICE[ex.id] ? `<a class="btn primary" href="${L('exam', ex.id)}">${icon('flag', 14)} ${esc(ex.name)} practice set</a>` : `<a class="btn primary" href="${L('exam', ex.id)}">${icon('flag', 14)} ${esc(ex.name)} prep</a>`}<a class="btn" href="${L('practice', null, { exam: ex.id })}">${icon('list', 14)} Drill ${esc(ex.name)} topics</a><a class="btn" href="${L('flashcards', null, { unit: ex.units[ex.units.length - 1] })}">${icon('cards', 14)} Flashcards</a></div>
          </div></div>` : !(D.EXAMS || []).length && ss.phase !== 'after' ? (() => { const nx = D.CALENDAR.find(e => e[0] >= t && e[1] === 'lecture'); const dd = nx ? daysBetween(t, nx[0]) : null; return `<div class="panel lift hero-exam"><div class="countdown"><div class="countdown-num${dd === 0 ? ' small' : ''}">${dd === null ? '–' : dd === 0 ? 'Today' : dd}</div><div class="countdown-label">${dd === null ? 'no more classes' : dd === 0 ? 'class meets' : `day${dd === 1 ? '' : 's'} to next class`}</div></div><div><div class="eyebrow">${esc(D.code)} · no exams</div><h2 style="font-size:26px;margin-top:2px">Graded on assignments and quizzes</h2><p class="muted mt-1">${esc((D.GRADING && D.GRADING.note) || 'There are no exams in this class.')}${nx ? ` Next class: ${esc(fmtDate(nx[0], true))}.` : ''}</p><div class="row mt-2"><a class="btn primary" href="${L('practice')}">${icon('list', 14)} Quizzer</a><a class="btn" href="${L('notes', cur.id)}">${icon('book', 14)} Topic notes</a><a class="btn" href="${L('calendar')}">${icon('calendar', 14)} Calendar</a></div></div></div>`; })() : `<div class="panel lift hero-exam"><div class="countdown"><div class="countdown-num small">Done</div><div class="countdown-label">all exams</div></div><div><div class="eyebrow">${esc(D.code)}</div><h2 style="font-size:26px;margin-top:2px">Semester complete</h2><p class="muted mt-1">Every exam on the calendar has passed. Everything stays here for review, and the grade calculator can settle your final letter grade.</p><div class="row mt-2"><a class="btn primary" href="${L('grades')}">${icon('calc', 14)} Grade calculator</a><a class="btn" href="${L('practice')}">${icon('list', 14)} Keep practicing</a></div></div></div>`);
      const pre = ss.phase === 'before' ? `<div class="panel callout"><b>Classes start ${esc(fmtDate(D.SEMESTER.start, true))}</b> (${ss.days === 1 ? 'tomorrow' : `in ${ss.days} days`}). Everything below already follows the Fall 2026 calendar; the first topic is ready when you are.</div>` : '';
      const weekLabel = ss.phase === 'before' ? `Starts ${esc(shortDate(D.SEMESTER.start))}` : ss.phase === 'after' ? 'Semester over' : ss.phase === 'finals' ? 'Finals week' : `Week ${wk} of ${ss.weeks}`;
      const smart = App.smartReview ? App.smartReview(3) : { picked: [] };
      const plan = App.planToday ? App.planToday() : null;
      const act = store.get('activity', {}); const yday = toISO(addDays(d, -1)), dby = toISO(addDays(d, -2)); const wk0 = App.isoWeek(d);
      const atRisk = !act[t] && !!act[yday] && st >= 2; const broken = !act[t] && !act[yday] && !!act[dby]; const freezes = store.get('freezes', {}); const freezeLeft = !freezes[wk0];
      const xpT = App.xpToday ? App.xpToday() : 0, goal = App.dailyGoal ? App.dailyGoal() : 30, lv = App.level ? App.level() : null; const gpct = Math.min(100, Math.round(100 * xpT / goal)); const curNode = App.pathNodes ? App.pathNodes().find(n => n.state === 'current') : null; const RB = 2 * Math.PI * 26;
      const goalBlock = `<div class="today-goal"><span class="ring-big${gpct >= 100 ? ' done' : ''}"><svg viewBox="0 0 60 60" width="64" height="64" aria-hidden="true"><circle class="ring-bg" cx="30" cy="30" r="26"/><circle class="ring-fg" cx="30" cy="30" r="26" stroke-dasharray="${RB.toFixed(2)}" stroke-dashoffset="${(RB * (1 - gpct / 100)).toFixed(2)}"/></svg><span class="ring-txt">${gpct >= 100 ? icon('check', 18) : `<b>${xpT}</b><small>XP</small>`}</span></span><div class="today-goal-body"><div><b>${xpT} / ${goal} XP today</b>${lv ? ` <span class="chip accent">Level ${lv.n} · ${esc(lv.name)}</span>` : ''}</div><div class="small muted">${gpct >= 100 ? 'Daily goal done. Extra XP still counts toward your level.' : `${goal - xpT} XP to go${lv ? ` · ${lv.toNext} XP to level ${lv.n + 1}` : ''}`}</div></div></div>`;
      const gs = App.gettingStarted ? App.gettingStarted() : null;
      const gsCard = gs ? `<div class="panel gs-card"><div class="panel-h"><div class="panel-title">${icon('flag')} Getting started · ${gs.done} of ${gs.total}</div><button class="btn xs ghost" data-action="gs-dismiss">Hide</button></div><div class="gs-items">${gs.items.map(i => `<a class="gs-item${i.done ? ' done' : ''}" href="${i.href}"${i.action ? ` data-action="${i.action}"` : ''}><span class="gs-check">${icon('check', 12)}</span><span>${esc(i.label)}</span></a>`).join('')}</div></div>` : '';
      const weekMins = COURSE_ORDER.filter(id => Courses[id]).reduce((sum, id) => sum + ((store.peek(id).sessions || []).filter(x => App.isoWeek(parseISO(x.d)) === wk0).reduce((a, x) => a + (x.m || 0), 0)), 0);
      const remindNudge = App.auth && App.auth.user && !App.auth.user.local && App.auth.mode === 'server' && !App.auth.user.reminder_email && !settings().remindNudgeDismissed;
      root.innerHTML = `<div class="page-head"><div><h1 class="page-title dash-greet">${ex && es && es.n > 1 ? `${es.n} days to ${esc(ex.name)}. Here's the way up.` : ex && es && es.n === 1 ? `${esc(ex.name)} is tomorrow. One more run.` : ex && es && es.n === 0 ? `${esc(ex.name)} is here. You've done the climbing.` : `Good ${d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening'}. Here's where ${esc(D.short)} stands.`}</h1><p class="page-sub dash-when">${esc(fmtDate(t, true))} · ${weekLabel} · ${esc(D.code)}</p></div><div class="page-actions">${App.callBo && App.callBo.ok() ? `<button class="btn sm primary" data-action="call-bo" data-cid="${D.id}">${icon('phone', 15)} Call Bo about ${esc(D.short)}</button>` : ''}<button class="btn sm d20-btn" data-roll="${D.id}" title="Roll a d20 and let it pick what to practice">${icon('d20', 15)} Roll a quest</button></div></div>${pre}
        <div class="stack">${examTile}<div id="announcement-slot"></div>${remindNudge ? `<div class="callout small row between" style="gap:10px"><span>${icon('bell', 14)} Want an email the evening before something is due, and a heads-up when your streak is about to end?</span><span class="row gap-sm"><button class="btn xs primary" data-action="remind-on">Turn on</button><button class="btn xs ghost" data-action="remind-no">No thanks</button></span></div>` : ''}${gsCard}${atRisk ? `<div class="callout warn small">${icon('fire', 13)} Your ${st}-day streak ends at midnight. <a href="${L('lesson', null, { smart: 1 })}">One quick lesson</a> keeps it.</div>` : broken ? `<div class="callout small">${icon('fire', 13)} Your streak broke yesterday.${freezeLeft ? ` <button class="btn xs primary" data-action="freeze">Use this week's freeze</button> to keep it alive.` : ' You used this week\'s freeze already.'}</div>` : ''}
          <div class="grid cols-2 dash-main">
            <div class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} Today</div><a href="${L('calendar')}" class="small">Full calendar</a></div>
              ${todayEv.length ? todayEv.map(e => `<div class="today-ev"><span class="chip ${e[1]}">${e[1]}</span><span>${esc(e[2])}</span></div>`).join('') : `<div class="empty">No class today.${(() => { const nx = D.CALENDAR.find(e => e[0] > t && (e[1] === 'lecture' || e[1] === 'exam')); return nx ? ` Next: ${esc(nx[2])} on ${fmtDate(nx[0])}.` : ''; })()}</div>`}
              <div class="divider"></div><div class="eyebrow mb-1">Due soon${(D.RECURRING || []).some(r => r.afterLabDay) ? ` · lab ${courseSetting(D.id, 'labDay', 'tue') === 'thu' ? 'Thu' : 'Tue'} <a href="${L('settings')}">change</a>` : ''}</div>
              ${dl.length ? dl.slice(0, 4).map(x => `<div class="today-ev"><span class="when">${daysBetween(t, x.date) === 0 ? 'Today' : daysBetween(t, x.date) === 1 ? 'Tomorrow' : esc(fmtDate(x.date))}</span><span>${esc(x.title)}${x.time ? ` <span class="muted small">· ${esc(x.time)}</span>` : ''}</span></div>`).join('') : '<div class="empty small">Nothing scheduled.</div>'}
              <div class="divider"></div><div class="eyebrow mb-1">Current topic</div>
              <a class="card-link" href="${L('notes', cur.id)}"><h3>${esc(cur.label)} ${esc(cur.title)}</h3><p>Notes, worked example and practice for this topic.</p></a></div>
            <div class="panel keep-going"><div class="panel-h"><div class="panel-title">${icon('play')} Keep going</div>${curNode ? '<span class="small muted">next on your path</span>' : ''}</div>
              <a class="btn keep-cta" href="${curNode ? L('lesson', null, { topics: curNode.t }) : L('lesson', null, { smart: 1 })}">${icon('play', 15)} ${curNode ? 'Continue: ' + esc(curNode.label) : 'Start a lesson'}</a>
              <div class="eyebrow mt-3 mb-1">Smart review</div>
              ${smart.picked.length ? `${smart.picked.map(r => `<div class="bar-row"><span>${esc(r.label)}</span><span class="mono">${r.acc === null ? 'new' : Math.round(r.acc * 100) + '%'}</span><div class="bar"><div class="bar-fill ${r.acc === null ? '' : r.acc < 0.6 ? 'bad' : r.acc < 0.8 ? 'warn' : 'good'}" style="width:${r.acc === null ? 0 : 100 * r.acc}%"></div></div></div>`).join('')}<a class="btn sm mt-1" href="${L('lesson', null, { smart: 1 })}">${icon('target', 13)} Review for me</a>` : '<p class="small muted">Answer a few questions and a personalized review appears here.</p>'}
              </div>
          </div>
          <div class="dash-tabs" data-store="dashTab" role="tablist">${[['week', 'This week', 'calendar'], ['ready', 'Readiness', 'target'], ['progress', 'Progress', 'fire'], ['plan', 'Planner', 'list'], ['community', 'Community', 'chat']].map(([k, l, ic]) => `<button class="tab" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${l}</span></button>`).join('')}</div>
          <div class="panes">
            <div class="pane" data-pane="week"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} This week</div><span class="small muted">${esc(shortDate(weekDays[0]))} – ${esc(shortDate(weekDays[4]))}</span></div>
              <div class="week-strip">${weekDays.map(iso => { const dd = parseISO(iso); const evs = eventsOn(D, iso); return `<div class="week-day${iso === t ? ' today' : iso < t ? ' past' : ''}"><div class="d">${DOW[dd.getDay()]}<span>${dd.getDate()}</span></div>${evs.length ? evs.map(e => `<div class="ev ${e[1]}">${esc(e[2])}</div>`).join('') : '<div class="ev muted">—</div>'}</div>`; }).join('')}</div></div><div class="mt-2"><div id="dash-canvas"></div></div></div>
            <div class="pane" data-pane="ready">${App.readinessPanel ? App.readinessPanel(D.id) : ''}</div>
            <div class="pane" data-pane="progress"><div class="grid cols-2"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('fire')} Your progress</div><a class="small" href="${L('path')}">Learning path</a></div>
              ${goalBlock}
              <div class="grid cols-2" style="gap:10px"><div class="stat"><div class="stat-num" data-count="${st}">${st}</div><div class="stat-label">day streak${freezeLeft ? '' : ' · freeze used'}</div></div><div class="stat"><div class="stat-num" data-count="${(weekMins / 60).toFixed(1)}">${(weekMins / 60).toFixed(1)}<span class="muted" style="font-size:15px"> h</span></div><div class="stat-label" id="dash-hours">focus this week</div></div><div class="stat"><div class="stat-num"><span data-count="${answered ? Math.round(100 * correct / answered) : 0}">${answered ? Math.round(100 * correct / answered) : 0}</span>%</div><div class="stat-label">accuracy · ${answered} answered</div></div><div class="stat"><div class="stat-num" data-count="${cm.mastered}">${cm.mastered}<span class="muted" style="font-size:15px">/${cm.total}</span></div><div class="stat-label">flashcards mastered</div></div></div>
              <div class="divider"></div>
              ${D.UNITS.map(u => { const m = unitMastery(u.n); return `<div class="bar-row"><span>Unit ${u.n} · ${esc(u.title)}</span><span class="mono">${m.a ? m.pct + '%' : '—'}</span><div class="bar"><div class="bar-fill ${m.pct >= 80 ? 'good' : m.pct >= 60 ? 'warn' : m.a ? 'bad' : ''}" style="width:${m.a ? m.pct : 0}%"></div></div></div>`; }).join('')}</div><div class="stack"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('zap')} Daily quests</div></div><div class="quests-slot" data-compact="1"></div></div><div class="panel"><div class="panel-h"><div class="panel-title">${icon('gem')} Your league</div><a class="small" href="${L('leagues')}">All leagues</a></div><div class="league-slot"></div></div></div></div></div>
            <div class="pane" data-pane="plan"><div class="panel plan-panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} ${plan ? (plan.isToday ? 'Today’s plan' : `Next study day · ${esc(fmtDate(plan.date))}`) : 'Study planner'}</div>${plan ? `<span class="small muted">${plan.done}/${plan.total} done · <a href="${L('planner')}">open plan</a></span>` : ''}</div>
              ${plan ? (plan.items.length ? plan.items.map(i => `<label class="check plan-item${i.done ? ' done' : ''}" style="padding:4px 0"><input type="checkbox" data-plan="${i.id}" ${i.done ? 'checked' : ''}><span class="plan-label">${esc(i.label)}</span>${i.link ? `<a class="btn xs" href="${i.link}">Open</a>` : ''}</label>`).join('') : '<div class="empty">Rest day. Nothing planned.</div>') : `<div class="empty">No plan yet. Pick an exam and your study days and StudyCat spreads the work across them. <a class="btn sm mt-2" href="${L('planner')}">Build a plan</a></div>`}</div></div>
            <div class="pane" data-pane="community"><div class="grid cols-3"><div id="dash-social" class="span-2 stack"></div><div id="dash-social-side"></div></div></div>
          </div>
        </div>`;
      bind(root, { 'tab-ready': () => { const b = $('.dash-tabs .tab[data-tab="ready"]', root); if (b) { b.click(); b.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, freeze: () => { if (App.useFreeze && App.useFreeze(yday)) render(); else toast('No streak freezes left. Hit your daily goal three days in a week to earn one.', 3500); }, 'remind-on': async () => { try { await App.auth.savePrefs({ reminder_email: true }); toast('Evening reminders on', 3000); render(); } catch (e) { toast(e.message); } }, 'remind-no': () => { setSetting('remindNudgeDismissed', true); render(); }, 'gs-dismiss': () => { setSetting('gsDismissed', true); render(); }, 'gs-signup': (el, e) => { e.preventDefault(); if (App.auth) App.auth.open('signup'); } });
      if (App.auth && App.auth.mode === 'server' && !App.auth.unreachable) fetch('api/index.php?r=stats_week', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub' } }).then(r => r.json()).then(j => { const el = $('#dash-hours', root); if (el && j && j.ok && j.stats && j.stats.median_hours !== null && j.stats.hours_users >= 3) el.textContent = `focus this week · class median ${j.stats.median_hours} h`; }).catch(() => {});
      on(root, 'change', 'input[data-plan]', el => { const p = store.get('plan', null); if (!p) return; const it = p.items.find(i => i.id === el.dataset.plan); if (it) { it.done = el.checked; store.set('plan', p); markActivity(); el.closest('.plan-item').classList.toggle('done', el.checked); } });
      Canvas.fill($('#dash-canvas', root), D.id, 6); paintAnnouncement(root); drawTrail(root);
      if (App.social) { const goS = () => App.social.fillDashboard($('#dash-social', root), D.id); if (App.auth && App.auth.ready) goS(); else if (App.auth) App.auth.onChange(function once() { goS(); }); }
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
      root.innerHTML = pageHead(`${esc(D.term)} calendar`, D.CALENDAR_NOTE || 'Subject to change; the instructor’s Canvas calendar wins.', `<button class="btn" data-action="today">${icon('target', 14)} Jump to today</button><button class="btn print-btn" data-action="print">${icon('print', 14)} Print</button>`) + `
        <div class="grid cols-3 mb-2"><div class="panel span-2"><div class="cal-legend"><span class="chip lecture">Lecture</span><span class="chip lab">Lab</span><span class="chip exam">Exam</span><span class="chip admin">Due / deadline</span><span class="chip holiday">No class</span><span class="chip review">Review</span></div>${(() => { const up = upcomingDeadlines(D, 6); return up.length ? `<div class="eyebrow mt-2 mb-1">Coming up</div>${up.map(x => `<div class="small cal-up"><span class="mono muted">${shortDate(x.date)}</span> ${esc(x.title)}${x.time ? ` <span class="muted">· ${esc(x.time)}</span>` : ''}</div>`).join('')}` : ''; })()}</div>
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
      const runOf = (() => { const p = progress(); const T = (QZ && QZ.TOPICS) || {}; const m = {}; Object.keys(T).forEach(k => { const o = m[T[k].sec] = m[T[k].sec] || { s: 0, n: 0, a: 0 }; const v = p[k]; o.n++; if (v && v.a) { o.a += v.a; o.s += (v.c / v.a) * (0.55 + 0.45 * Math.min(1, v.a / 15)); } }); return id => { const o = m[id]; if (!o || !o.a) return 'new'; const sc = o.s / o.n; return sc >= 0.65 ? 'easy' : sc >= 0.35 ? 'mid' : 'hard'; }; })();
      const navHtml = D.UNITS.map(u => `<div class="nav-label">Unit ${u.n} · ${esc(u.title)}</div>` + u.sections.map(id => { const s = secById(id); const k = D.SECTIONS.indexOf(s); const g = runOf(s.id); return `<button class="sec-link${s.id === sec.id ? ' active' : ''}${k >= freeN ? ' locked' : ''}" data-action="open" data-id="${s.id}">${g ? `<i class="run-glyph sm ${g}" aria-hidden="true"></i>` : ''}<span class="num">${esc(s.label.replace('§', ''))}</span><span>${esc(s.title)}</span></button>`; }).join('')).join('');
      if (lockedSec) {
        root.innerHTML = `<div class="notes-layout"><div class="panel sec-nav">${navHtml}</div><div class="stack"><div class="panel">
          <div class="note-head"><span class="note-num">${esc(sec.label)}</span><span class="chip">Unit ${sec.unit}</span>${ex ? `<span class="chip exam">${esc(ex.name)}</span>` : ''}</div>
          <h1 class="note-title">${esc(sec.title)}</h1>
          ${sec.plain ? `<div class="note-block lesson-idea"><h2>${icon('bulb', 16)} The idea</h2><div class="lesson-plain">${sec.plain}</div></div><p class="muted small">The full lesson adds a picture, the key points, worked examples, common mistakes and a self-check.</p>` : `<div class="note-block"><h2>Big ideas</h2><ul class="list">${sec.ideas.slice(0, 2).map(i => `<li>${i}</li>`).join('')}<li class="muted">… and ${Math.max(0, sec.ideas.length - 2)} more, plus formulas, a worked example, common mistakes and an exam tip.</li></ul></div>`}
          ${App.lockCard(`Notes beyond the first ${freeN} topics are for members`, `Sign up free to read every ${D.short} topic (${D.SECTIONS.length} in total) with worked examples and exam tips.`)}
          <div class="row between mt-3"><div>${prev ? `<button class="btn" data-action="open" data-id="${prev.id}">${icon('left', 14)} ${esc(prev.label)}</button>` : ''}</div><div>${next ? `<button class="btn" data-action="open" data-id="${next.id}">${esc(next.label)} ${icon('right', 14)}</button>` : ''}</div></div>
          </div></div></div>`;
        bind(root, { open: el => App.go('notes', el.dataset.id) }); return;
      }
      // the lesson: the idea in plain words, a picture, the key points and formulas, worked examples, the usual
      // mistakes and a self-check (assets/lessons/<id>.js lays them over the notes; a class of your own carries them)
      const examples = (Array.isArray(sec.examples) && sec.examples.length ? sec.examples : sec.example && sec.example.p ? [sec.example] : []).filter(x => x && x.p);
      const checks = (sec.check || []).map(c => (Array.isArray(c) ? { q: c[0], a: c[1] } : c)).filter(c => c && c.q);
      let fig = ''; if (sec.figure && App.boDraw) { try { const sp = App.boDraw.parse(sec.figure); if (sp) fig = `<figure class="lesson-fig">${App.boDraw.html(sp, false)}</figure>`; } catch (e) {} }
      const askBo = App.moduleOn && !App.moduleOn('tutor') ? '' : `<a class="btn sm ghost lesson-ask" href="#/tutor/${esc(D.id)}?q=${encodeURIComponent(`Explain ${sec.title} another way`)}">${icon('chat', 13)} Ask Bo to explain it another way</a>`;
      const lesson = !!(sec.plain || fig || checks.length);
      root.innerHTML = `<div class="notes-layout"><div class="panel sec-nav">${navHtml}</div><div class="stack"><article class="panel note-lesson${lesson ? ' is-lesson' : ''}">
        <div class="note-head"><span class="note-num">${esc(sec.label)}</span><span class="chip">Unit ${sec.unit}</span>${ex ? `<span class="chip exam">${esc(ex.name)}</span>` : ''}${sec.link ? `<a class="small" style="margin-left:auto" href="${sec.link}" target="_blank" rel="noopener">${esc(sec.linkLabel || (D.kind === 'code' ? 'Class site' : 'Read in the textbook'))} ${icon('external', 12)}</a>` : '<span style="margin-left:auto"></span>'}${App.flagButton ? App.flagButton({ course: D.id, view: 'Notes', ref: `${sec.label} ${sec.title}` }) : ''}</div>
        <h1 class="note-title">${esc(sec.title)}</h1>
        ${lesson ? `<nav class="lesson-toc" aria-label="In this lesson">${[sec.plain && ['idea', 'The idea'], fig && ['picture', 'Picture'], (sec.ideas || []).length && ['points', 'Key points'], examples.length && ['examples', examples.length > 1 ? 'Worked examples' : 'Worked example'], (sec.pitfalls || []).length && ['mistakes', 'Common mistakes'], checks.length && ['check', 'Check yourself']].filter(Boolean).map(([k, l]) => `<a href="#" data-action="jump" data-to="ls-${k}">${l}</a>`).join('')}</nav>` : ''}
        ${sec.plain ? `<section class="note-block lesson-idea" id="ls-idea"><h2>${icon('bulb', 16)} The idea</h2><div class="lesson-plain">${sec.plain}</div></section>` : ''}
        ${fig ? `<section class="note-block" id="ls-picture"><h2 class="sr-only">Picture</h2>${fig}</section>` : ''}
        ${(sec.ideas || []).length ? `<section class="note-block" id="ls-points"><h2>${lesson ? 'Key points' : 'Big ideas'}</h2><ul class="list">${(sec.ideas || []).map(i => `<li>${i}</li>`).join('')}</ul></section>` : ''}
        ${sec.formulas && sec.formulas.length ? `<div class="note-block"><h2>Key formulas</h2>${sec.formulas.map(f => `<div class="formula-row"><div class="name">${esc(f.n)}</div><div class="tex">$$${f.t}$$</div></div>`).join('')}</div>` : ''}
        ${sec.code && sec.code.length ? `<div class="note-block"><h2>Code you should know</h2>${sec.code.map((c, i) => `<div class="code-card"><div class="code-card-h"><span>${esc(c.t)}</span><a class="btn xs primary" href="${L('playground', null, { ex: `sec:${sec.id}:${i}`, run: 1 })}">${icon('play', 11)} Try it</a></div><pre class="code-ex">${esc(c.c)}</pre>${c.out ? `<div class="code-out"><span class="eyebrow">Output</span><pre>${esc(c.out)}</pre></div>` : ''}</div>`).join('')}</div>` : ''}
        ${examples.length ? `<section class="note-block" id="ls-examples"><h2>${examples.length > 1 ? 'Worked examples' : 'Worked example'}</h2>${examples.map((x, i) => `<div class="callout lesson-ex">${examples.length > 1 ? `<div class="eyebrow">Example ${i + 1}</div>` : ''}<div>${x.p}</div><button class="btn sm mt-2" data-action="reveal" data-i="${i}" aria-expanded="false" aria-controls="sol-${i}">${icon('eye', 14)} Show the solution</button><div class="reveal mt-2" id="sol-${i}">${x.s || ''}</div></div>`).join('')}</section>` : ''}
        ${sec.pitfalls && sec.pitfalls.length ? `<section class="note-block" id="ls-mistakes"><h2>Common mistakes</h2><ul class="list lesson-mistakes">${sec.pitfalls.map(i => `<li>${i}</li>`).join('')}</ul></section>` : ''}
        ${checks.length ? `<section class="note-block lesson-check" id="ls-check"><h2>${icon('check', 16)} Check yourself</h2><p class="small muted">Answer in your head or on paper, then look.</p><ol class="lesson-qs">${checks.map((c, i) => `<li><div class="chk-q">${c.q}</div><button class="btn sm" data-action="answer" data-i="${i}" aria-expanded="false" aria-controls="ans-${i}">${icon('eye', 13)} Show the answer</button><div class="reveal chk-a" id="ans-${i}">${c.a || ''}</div></li>`).join('')}</ol></section>` : ''}
        ${sec.tip ? `<div class="note-block"><div class="callout tip"><div class="eyebrow">Exam tip</div>${sec.tip}</div></div>` : ''}
        <div class="row between mt-3 note-foot"><div>${prev ? `<button class="btn" data-action="open" data-id="${prev.id}">${icon('left', 14)} ${esc(prev.label)}</button>` : ''}</div><div class="row" style="flex-wrap:wrap;justify-content:center">${topics.length ? `<a class="btn primary" href="${L('practice', null, { topics: topics.join(',') })}">${icon('list', 14)} Practice ${esc(sec.label)}</a>` : ''}<a class="btn" href="${L('flashcards', null, { sec: sec.id })}">${icon('cards', 14)} Cards</a>${askBo}</div><div>${next ? `<button class="btn" data-action="open" data-id="${next.id}">${esc(next.label)} ${icon('right', 14)}</button>` : ''}</div></div>
      </article></div></div>`;
      const flip = (el, box, show, hide) => { const on = box.classList.toggle('open'); el.setAttribute('aria-expanded', String(on)); el.innerHTML = on ? `${icon('eye', 14)} ${hide}` : `${icon('eye', 14)} ${show}`; if (on && App.typeset) App.typeset(box); };
      bind(root, { open: el => App.go('notes', el.dataset.id), reveal: el => flip(el, $('#sol-' + el.dataset.i, root), 'Show the solution', 'Hide the solution'), answer: el => flip(el, $('#ans-' + el.dataset.i, root), 'Show the answer', 'Hide the answer'), jump: (el, e) => { e.preventDefault(); const t = $('#' + el.dataset.to, root); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
      if (App.paintMyNotes) App.paintMyNotes(root, sec);
      if (App.scrollProgress) App.scrollProgress($('.notes-layout > .stack > .panel', root));
      // read to the end (its last row in view): Today ticks this week's topic off (assets/today.js)
      const foot = $('.note-foot', root);
      if (foot && 'IntersectionObserver' in global) { const io = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting) || !root.isConnected) return; io.disconnect(); const r = store.get('lessonsRead', {}); if (!r[sec.id]) { r[sec.id] = Date.now(); store.set('lessonsRead', r); } }, { threshold: 0.6 }); io.observe(foot); }
    }
  };

  /* ======================================================
     VIEW: Formula sheet
     ====================================================== */
  App.views.formulas = {
    get title() { const it = D && (D.NAV || []).flatMap(g => g.items).find(i => i[0] === 'formulas'); return it ? it[1] : 'Formula sheet'; },
    render(root, param, query) {
      const freeG = App.limit('formulaGroups');
      const paint = filter => { const f = filter.toLowerCase(); const groups = D.FORMULAS.slice(0, freeG); const hidden = D.FORMULAS.length - groups.length; $('#fs-body', root).innerHTML = `<div class="grid cols-2">${groups.map(gp => { const items = gp.items.filter(it => !f || it.n.toLowerCase().includes(f) || gp.group.toLowerCase().includes(f) || (it.d && it.d.toLowerCase().includes(f))); if (!items.length) return ''; return `<div class="panel fs-group"><h3>${esc(gp.group)}</h3>${items.map(it => `<div class="fs-row"><div class="name">${esc(it.n)}</div>${it.c ? `<pre class="code-ex fs-code">${esc(it.c)}</pre>` : it.d ? `<div class="fs-def">${it.d}</div>` : `<div class="tex">$$${it.t}$$</div>`}</div>`).join('')}</div>`; }).join('') || '<div class="empty">No formulas match.</div>'}</div>${hidden > 0 ? `<div class="mt-2">${App.lockCard(`${hidden} more formula group${hidden === 1 ? '' : 's'} for members`, `The full ${D.short} sheet covers ${D.FORMULAS.map(g => g.group.toLowerCase()).join(', ')}. Sign up free to see and print all of it.`)}</div>` : ''}`; typeset($('#fs-body', root)); if (App.auth) App.auth.bindLocks(root); };
      root.innerHTML = pageHead(this.title, D.formulasNote || 'Everything on one page. Exams are closed-book: use this to test what you can rewrite from memory.', `<input class="input" id="fs-filter" placeholder="Filter (e.g. ${esc(D.filterExample || 'chain, torque')})…" value="${esc(query.q || '')}" style="width:220px"><button class="btn print-btn" data-action="print">${icon('print', 14)} Print</button>`) + '<div id="fs-body"></div>';
      paint(query.q || ''); $('#fs-filter', root).addEventListener('input', e => paint(e.target.value)); bind(root, { print: () => window.print() });
    }
  };

  /* ======================================================
     VIEW: Flashcards
     ====================================================== */
  /* ---------- spaced review, shared by the Flashcards page and Today (assets/today.js) ----------
     A card's box says when it comes back: box 0 at once, then after a day, 3 days, a week, 16 days and 35 days (box 5).
     Box 3 and up counts as mastered. "Got it" moves a card up one box only when it was due (or new): going through a
     deck twice in one sitting does not fake mastery, and its date stays. "Again" sends it to box 0, and the page brings
     it back a few cards later in the same sitting. Leitner's boxes with widening gaps, after the spacing effect and
     successive relearning (Cepeda et al. 2006; Rawson & Dunlosky 2011). */
  const SRS_DAYS = [0, 1, 3, 7, 16, 35], SRS_SAY = ['later today', 'in 1 day', 'in 3 days', 'in 1 week', 'in 16 days', 'in 5 weeks'];
  App.srs = {
    MAX: SRS_DAYS.length - 1,
    dueAt: (box, at) => (box === undefined || !at ? 0 : at + SRS_DAYS[Math.min(SRS_DAYS.length - 1, box)] * 86400000),
    isDue: (box, at, now = Date.now()) => box === undefined || !at || now >= App.srs.dueAt(box, at),
    /** [box, time] after a grade */
    grade(box, at, up, now = Date.now()) {
      if (!up) return [0, now];
      if (!App.srs.isDue(box, at, now)) return [box, at];
      return [Math.min(App.srs.MAX, (box || 0) + 1), now];
    },
    /** what "Got it" would do, in a few words: "in 3 days", or "not due yet" */
    gap(box, at, now = Date.now()) { return App.srs.isDue(box, at, now) ? SRS_SAY[Math.min(App.srs.MAX, (box || 0) + 1)] : 'not due yet'; },
    /** when a time comes: "later today", "tomorrow", "in 3 days", "on Nov 12" */
    days(ts, now = Date.now()) { return Math.round((new Date(ts).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000); },
    when(ts, now = Date.now()) { const d = App.srs.days(ts, now); return d <= 0 ? 'later today' : d === 1 ? 'tomorrow' : d < 7 ? `in ${d} days` : `on ${new Date(ts).toLocaleDateString(document.documentElement.lang || 'en', { month: 'short', day: 'numeric' })}`; },
    /** the caught-up line, one whole sentence each so it translates */
    next(ts, now = Date.now()) { const d = App.srs.days(ts, now); return d <= 0 ? 'The next card comes back later today.' : d === 1 ? 'The next card comes back tomorrow.' : d < 7 ? `The next card comes back in ${d} days.` : `The next card comes back on ${new Date(ts).toLocaleDateString(document.documentElement.lang || 'en', { month: 'short', day: 'numeric' })}.`; }
  };

  App.views.flashcards = {
    title: 'Flashcards', state: {},
    render(root, param, query) {
      const st = this.state[D.id] = this.state[D.id] || { unit: 0, sec: null, deck: [], i: 0, flipped: false, mode: 'due' };
      if (query.unit) st.unit = +query.unit; if (query.sec) st.sec = query.sec; else if (!param) st.sec = null;
      const boxes = () => store.get('flashcards', {});
      const freeC = App.limit('cards');
      const times = () => store.get('fcAt', {});
      const buildDeck = () => {
        const b = boxes(), at = times(), now = Date.now(); let cards = D.FLASHCARDS.filter(c => (!st.unit || c.unit === st.unit) && (!st.sec || c.sec === st.sec));
        st.pool = cards; st.total = cards.length; st.later = []; st.reviewed = 0; cards = QZ.helpers.shuffle(cards);
        if (st.mode === 'due') {   // due now: cards you have seen first (lowest box first), then new ones
          st.later = cards.filter(c => !App.srs.isDue(b[c.id], at[c.id], now)); cards = cards.filter(c => App.srs.isDue(b[c.id], at[c.id], now));
          cards.sort((x, y) => (b[x.id] === undefined) - (b[y.id] === undefined) || (b[x.id] || 0) - (b[y.id] || 0));
        }
        if (param) { const card = D.FLASHCARDS.find(c => c.id === param); if (card && !cards.includes(card)) cards.unshift(card); }   // a card opened from search is always there
        st.capped = Math.max(0, cards.length - freeC); if (st.capped) cards = cards.slice(0, freeC);
        st.deck = cards; st.i = 0; st.flipped = false; if (param) { const k = cards.findIndex(c => c.id === param); if (k >= 0) st.i = k; }
      };
      buildDeck();
      const paint = () => {
        const b = boxes(), at = times(); const c = st.deck[st.i]; const mastered = st.pool.filter(x => (b[x.id] || 0) >= 3).length; const left = Math.max(0, st.deck.length - st.i);
        $('#fc-stats', root).innerHTML = `<span class="chip good">${mastered} mastered</span>${st.mode === 'due' ? `<span class="chip">${left} due now</span>` : ''}<span class="chip">${st.total} cards</span>`;
        const lk = $('#fc-lock', root); if (lk) lk.innerHTML = st.capped ? App.lockCard(`${st.capped} more cards for members`, `Preview shows ${st.deck.length} cards per deck. Sign up free for all ${D.FLASHCARDS.length} ${D.short} flashcards and saved mastery boxes.`, { compact: true }) : '';
        const stage = $('#fc-stage', root);
        if (!c) {   // the end of the deck, or nothing due
          const next = st.later.concat(st.deck).map(x => App.srs.dueAt(b[x.id], at[x.id])).filter(t => t > Date.now()).sort((x, y) => x - y)[0];
          const head = !st.pool.length ? 'No cards match this filter.' : st.reviewed ? `That’s the deck: ${st.reviewed} card${st.reviewed === 1 ? '' : 's'} reviewed.` : 'All caught up: nothing is due right now.';
          stage.innerHTML = `<div class="empty fc-done" role="status"><b>${esc(head)}</b>${st.pool.length ? `${next ? `<p class="small muted">${esc(App.srs.next(next))}</p>` : ''}<p class="small muted">Spacing them out is what makes them stick.</p><div class="row gap-sm" style="justify-content:center">${st.mode === 'due' ? `<button class="btn" data-action="mode">${icon('cards', 14)} Go through all ${st.total} anyway</button>` : `<button class="btn" data-action="reshuffle">${icon('rotate', 14)} Shuffle and go again</button>`}</div>` : ''}</div>`;
          $('#fc-controls', root).innerHTML = ''; return;
        }
        const box = b[c.id] || 0;
        stage.innerHTML = `<div class="fc-card${st.flipped ? ' flipped' : ''}" id="fc-card" tabindex="0" role="button"><span class="sr-only">Flip card: </span><div class="fc-face fc-front"><span class="eyebrow">Card ${st.i + 1} / ${st.deck.length} · box ${box}</span><span class="sec chip">${esc(c.sec ? secLabel(c.sec) : 'Unit ' + c.unit)}</span><div>${c.f}</div><div class="fc-hint">Tap or press space to flip</div></div><div class="fc-face fc-back"><span class="eyebrow">Answer</span><span class="sec chip">${esc(c.sec ? secLabel(c.sec) : 'Unit ' + c.unit)}</span><div>${c.b}</div></div></div>`;
        $('#fc-controls', root).innerHTML = `${App.flagButton ? App.flagButton({ course: D.id, view: 'Flashcards', ref: c.id, prompt: c.f }) : ''}<button class="btn" data-action="prev" ${st.i === 0 ? 'disabled' : ''}>${icon('left', 14)} Prev</button><button class="btn danger" data-action="again">Again <span class="fc-gap">later today</span> <span class="kbd">1</span></button><button class="btn primary" data-action="good">Got it <span class="fc-gap">${esc(App.srs.gap(b[c.id], at[c.id]))}</span> <span class="kbd">2</span></button><button class="btn" data-action="next" ${st.i >= st.deck.length - 1 ? 'disabled' : ''}>Next ${icon('right', 14)}</button>`;
        typeset(stage);
      };
      root.innerHTML = pageHead('Flashcards', 'Definitions, laws and formulas. Each card comes back just before you would forget it: "Got it" spaces it further out (a day, 3 days, a week, then longer), "Again" brings it back today. Box 3 and up means mastered.') + `<div class="panel"><div class="row between mb-2"><div class="chips">${[0, 1, 2, 3, 4].map(u => `<span class="chip toggle${st.unit === u ? ' on' : ''}" data-action="unit" data-u="${u}">${u ? 'Unit ' + u : 'All units'}</span>`).join('')}${st.sec ? `<span class="chip accent">${esc(secLabel(st.sec))} <span data-action="clearsec" style="cursor:pointer">✕</span></span>` : ''}</div><div class="row"><span id="fc-stats" class="row gap-sm"></span><button class="btn sm" data-action="mode" aria-pressed="${st.mode === 'due'}">${st.mode === 'due' ? 'Showing: due now' : 'Showing: all cards'}</button><button class="btn sm" data-action="reshuffle">${icon('rotate', 13)} Reshuffle</button><button class="btn sm ghost" data-action="reset">Reset progress</button></div></div><div class="fc-stage" id="fc-stage"></div><div class="fc-controls" id="fc-controls"></div><div id="fc-lock" class="mt-2"></div></div>`;
      paint();
      const grade = up => {
        const c = st.deck[st.i]; if (!c) return; const b = boxes(), at = times(); [b[c.id], at[c.id]] = App.srs.grade(b[c.id], at[c.id], up);
        store.set('flashcards', b); store.set('fcAt', at); markActivity(); st.reviewed++;
        if (!up) st.deck.splice(Math.min(st.deck.length, st.i + 4), 0, c);   // missed: it comes back a few cards later
        st.i++; st.flipped = false; paint();
      };
      const flip = () => { st.flipped = !st.flipped; const el = $('#fc-card', root); if (el) el.classList.toggle('flipped', st.flipped); };
      bind(root, { unit: el => { st.unit = +el.dataset.u; st.sec = null; App.go('flashcards', null, { unit: st.unit }); }, clearsec: () => { st.sec = null; App.go('flashcards'); }, mode: () => { st.mode = st.mode === 'due' ? 'shuffle' : 'due'; this.render(root, null, {}); }, reshuffle: () => { buildDeck(); paint(); }, reset: () => { if (confirm('Reset flashcard progress for this class?')) { store.set('flashcards', {}); buildDeck(); paint(); toast('Flashcard progress reset'); } }, prev: () => { if (st.i > 0) { st.i--; st.flipped = false; paint(); } }, next: () => { if (st.i < st.deck.length - 1) { st.i++; st.flipped = false; paint(); } }, again: () => { grade(false); if (App.addXP) App.addXP(1); if (App.quest) App.quest('cards'); }, good: () => { grade(true); if (App.addXP) App.addXP(2); if (App.quest) App.quest('cards'); } });
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
     VIEW: Course info
     ====================================================== */
  App.views.course = {
    title: 'Syllabus & policies',
    render(root) {
      const C = D.COURSE; const G = D.GRADING;
      // how the grade is made, straight from the syllabus: the weights, the letter scale and any rubric (read only)
      // how the grade is made, straight from the syllabus (read only): the weights, unless the class's own Grading
      // panel already lists them, then the letter scale and any rubric
      const shown = (D.INFO || []).some(p => /^grading\b/i.test(p.title || ''));
      const cats = !shown && G && (G.categories || []).length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Category</th><th class="num">Weight</th></tr></thead><tbody>${G.categories.map(c => `<tr class="grade-row"><td>${esc(c.name)}</td><td class="num">${(+(+c.weight).toFixed(1))}%</td></tr>`).join('')}</tbody></table></div>${Object.values(G.groups || {}).map(gp => gp.note ? `<p class="small muted mt-1">${esc(gp.note)}</p>` : '').join('')}` : '';
      const scale = G && (G.scale || []).length > 1 ? `<div class="table-wrap"><table class="table compact grade-scale"><thead><tr><th>Grade</th><th class="num">Percent</th>${G.scale[0].fourPt ? '<th class="num">4-point</th>' : ''}</tr></thead><tbody>${G.scale.map(sc => `<tr><td><b>${esc(sc.letter)}</b></td><td class="num">${sc.min === 0 ? '< ' + G.scale[G.scale.length - 2].min : '≥ ' + sc.min}</td>${sc.fourPt ? `<td class="num">${esc(String(sc.fourPt))}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '';
      const rubric = G && G.rubric ? `<div class="eyebrow mt-2 mb-1">${esc(G.rubricTitle || (D.id === 'physics' ? 'How each lab is scored (20 points)' : 'How written work is scored (4-point rubric)'))}</div><div class="table-wrap"><table class="table compact"><tbody>${G.rubric.map(r => `<tr><td style="width:140px"><b>${esc(String(r.score))} · ${esc(r.name)}</b></td><td>${esc(r.desc)}</td></tr>`).join('')}</tbody></table></div>` : '';
      const grading = cats || scale || rubric ? `<div class="panel span-2 grading-panel"><div class="panel-h"><div class="panel-title">${icon('reportcard')} ${cats ? 'How the grade is made' : 'Letter grades'}</div></div>${cats && G.note ? `<p class="small muted mb-2">${esc(G.note)}</p>` : ''}<div class="grid cols-2">${cats ? `<div>${cats}</div>` : ''}${scale ? `<div>${scale}</div>` : ''}</div>${rubric}</div>` : '';
      // the student's own details (the class maker): their instructor, office hours and where it meets
      const K = classCustom(D.id); const own = (App.packs && App.packs.local && App.packs.local.has(D.id)) || !!K;
      const det = own ? [['user', 'Instructor', C.instructor], ['send', 'Email', C.instructorEmail ? `<a href="mailto:${esc(C.instructorEmail)}">${esc(C.instructorEmail)}</a>` : ''], ['clock', 'Office hours', C.officeHours], ['calendar', 'When and where', [C.classDays, C.room].filter(Boolean).join(' · ')]].filter(r => r[2]) : [];
      const mine = det.length ? `<div class="panel span-2 own-panel"><div class="panel-h"><div class="panel-title">${icon('user')} ${K ? 'Your section' : 'Your class'}</div><a class="btn sm" href="#/maker/${esc(D.id)}">${icon('maker', 13)} Edit</a></div><dl class="own-list">${det.map(([ic, k, v]) => `<div><dt>${icon(ic, 13)} ${k}</dt><dd>${ic === 'send' ? v : esc(v)}</dd></div>`).join('')}</dl>${K && K.weights && Object.keys(K.weights).length ? '<p class="small muted mt-1">The grading weights below are the ones you set.</p>' : ''}</div>` : '';
      root.innerHTML = pageHead('Syllabus & policies', `${esc(C.code)} ${esc(C.name)} · ${esc(C.term)}${C.school ? ` · ${esc(C.school)}` : ''}. The essentials from the syllabus, in one place.`, `<a class="btn" href="#/maker/${esc(D.id)}">${icon('maker', 14)} ${own ? 'Edit this class' : 'Make it yours'}</a>`) + `<div class="grid cols-2">${mine}${(D.INFO || []).map(p => `<div class="panel${p.span2 ? ' span-2' : ''}"><div class="panel-h"><div class="panel-title">${icon(p.icon || 'info')} ${esc(p.title)}</div></div>${p.html}</div>`).join('')}${grading}</div>`;
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
    render(root, param, query, standalone) {
      const s = settings(); const C = standalone ? null : D; const hasLab = !!(C && (C.RECURRING || []).some(r => r.afterLabDay)); const V = C && C.VARIANTS;
      const mine = App.myCourses(); const sem = (C || Courses[mine[0]] || Courses[COURSE_ORDER[0]]).SEMESTER;
      const head = standalone
        ? `<header class="landing-top"><div><div class="eyebrow">StudyCat</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Settings</h1><p class="muted">Your account, notifications, classes and preferences. They apply everywhere on StudyCat.</p></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="#/">${icon('left', 14)} All classes</a></div></header>`
        : pageHead('Settings', 'Preferences apply to every class. Progress is stored per class and, when you are logged in, synced to your account.');
      const classesPanel = `<div class="panel span-2"><div class="panel-h"><div class="panel-title">${icon('grid')} Your classes</div><div class="row gap-sm"><a class="btn sm" href="#/maker">${icon('maker', 13)} Class maker</a><button class="btn sm" data-action="choose">Choose classes and sections</button></div></div><div class="row gap-sm" style="flex-wrap:wrap">${mine.map(id => `<span class="chip course-${id}">${esc(Courses[id].short)}${courseSetting(id, 'section', '') ? ' · sec ' + esc(courseSetting(id, 'section', '')) : ''}${courseSetting(id, 'examTime', '') ? ' · ' + esc(courseSetting(id, 'examTime', '')) : ''}</span>`).join('')}</div><p class="small muted mt-1">Only these classes show on the landing page, in the course switcher, in reminders and in the weekly digest. Make any of them yours, or add one from your syllabus, in the class maker.</p></div>`;
      const prefsPanel = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('sliders')} Preferences</div></div>
          ${I18N ? `<div class="field mb-2"><label for="s-lang">Language</label><select class="select" id="s-lang" translate="no">${I18N.langs.map(([c, n]) => `<option value="${c}"${c === App.lang ? ' selected' : ''}>${n}</option>`).join('')}</select><p class="muted small mt-1">The interface and Bo. Class notes and questions stay in the class’s own language.</p></div>` : ''}
          <div class="field mb-2"><label for="s-theme">Theme</label><select class="select" id="s-theme"><option value="system"${s.theme === 'system' ? ' selected' : ''}>Match system</option><option value="light"${s.theme === 'light' ? ' selected' : ''}>Light</option><option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Dark</option></select></div>
          <div class="field mb-2"><label>Look</label><div class="skin-pick" id="s-skins">${(App.SKINS || []).map(([id, name, sub, [bg, ac]]) => `<button type="button" class="skin-opt${(App.skinOf ? App.skinOf() : (s.skin || 'default')) === id ? ' on' : ''}" data-action="skin" data-skin="${id}" aria-pressed="${(App.skinOf ? App.skinOf() : (s.skin || 'default')) === id}"><span class="skin-swatch" style="background:${bg}"><i style="background:${ac}"></i><i></i></span><b>${name}</b><small>${sub}</small></button>`).join('')}</div></div>
          <label class="check" style="padding:0"><input type="checkbox" id="s-motion" ${s.motion === 'off' ? 'checked' : ''}><span>Reduce motion <span class="muted small">(no animations or transitions)</span></span></label>
          ${App.boCharPicker ? `<div class="field mb-2"><label>Bo’s character</label><p class="muted small mb-1">Who Bo is when he tutors you: in the chat, out loud and on calls. Each has his own voice.</p><div id="s-bochar">${App.boCharPicker({ name: 's-bochar' })}</div></div>` : ''}
          ${App.boFloat ? `<label class="check" style="padding:0"><input type="checkbox" id="s-bofloat" ${s.boFloat === false ? '' : 'checked'}><span>Bo on every page <span class="muted small">(he floats in a corner; tap him to ask about what you're looking at)</span></span></label>
          <label class="check" style="padding:0"><input type="checkbox" id="s-botips" ${s.boTips === false || s.boFloat === false ? '' : 'checked'}${s.boFloat === false ? ' disabled' : ''}><span>Tips from Bo <span class="muted small">(now and then he offers to help with the questions on a page)</span></span></label>` : ''}
          <label class="check" style="padding:0"><input type="checkbox" id="s-geek" ${s.geek === true ? 'checked' : ''}><span>Geek mode <span class="muted small">(headings decode, a terminal status line, scanlines and CRT dialogs between pages)</span></span></label>
          <div class="row gap-sm mt-2" style="flex-wrap:wrap"><button class="btn sm" data-action="tour-again">${icon('eye', 13)} Show the tour again</button><a class="btn sm" href="#/customize">${icon('sliders', 13)} Customize StudyCat</a><a class="btn sm" href="#/tools">${icon('grid', 13)} Tools</a><a class="btn sm" href="#/resources">${icon('link', 13)} Resources</a></div>
          <div class="field mb-2"><label for="s-goal">Daily XP goal</label><select class="select" id="s-goal">${(App.GOALS || [[30, 'Regular']]).map(([n, name]) => `<option value="${n}"${(App.dailyGoal ? App.dailyGoal() : 30) === n ? ' selected' : ''}>${n} XP · ${name}</option>`).join('')}</select><span class="help">A correct answer is 10 XP. The ring in the header fills up as you go; hit the goal every day to keep your streak strong.</span></div>
          <label class="check" style="padding:0"><input type="checkbox" id="s-sound" ${s.sound === false ? '' : 'checked'}><span>Sound effects <span class="muted small">(short cues for right, wrong and finished lessons)</span></span></label>
          <label class="check mb-2" style="padding:0"><input type="checkbox" id="s-livebg" ${s.liveBg === true ? 'checked' : ''}><span>Animated background <span class="muted small">(drifting symbols; off automatically when your system prefers reduced motion)</span></span></label>
          ${V ? `<div class="field"><label for="s-variant">${esc(V.label || 'Your section')}</label><select class="select" id="s-variant">${V.options.map(o => `<option value="${esc(o.id)}"${sectionVariant(C) === o.id ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select><span class="help">${esc(V.hint || 'Sets the lecture days and exam dates on your calendar.')}</span></div>` : ''}
          ${hasLab ? `<div class="field"><label>Your ${esc(C.short)} lab day</label><select class="select" id="s-lab"><option value="tue"${courseSetting(C.id, 'labDay', 'tue') !== 'thu' ? ' selected' : ''}>Tuesday</option><option value="thu"${courseSetting(C.id, 'labDay', 'tue') === 'thu' ? ' selected' : ''}>Thursday</option></select><span class="help">Sets when lab sheets show as due on the dashboard (8:00 pm the day after lab).</span></div>` : ''}
          <div class="field mt-2"><label for="s-asof">Preview the site as of a date</label><div class="row gap-sm"><input class="input" id="s-asof" type="date" value="${esc(s.asof || '')}" min="${sem.start}" max="${sem.end}" style="max-width:200px"><button class="btn sm ghost" data-action="asof-clear">Back to today</button></div><span class="help">Jump ahead to see what the dashboard, countdowns and due lists will show later in the semester.</span></div>
          <div class="divider"></div><div class="eyebrow mb-1">Keyboard shortcuts</div>
          <ul class="list-plain small"><li><span class="kbd">Ctrl</span> + <span class="kbd">K</span> search this class</li><li><span class="kbd">Space</span> flip a flashcard · <span class="kbd">1</span> again · <span class="kbd">2</span> got it · <span class="kbd">←</span> <span class="kbd">→</span> move</li><li><span class="kbd">1</span>–<span class="kbd">4</span> choose an answer in the quizzer · <span class="kbd">Enter</span> check a typed answer</li></ul></div>`;
      const dataPanel = C ? `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('download')} Your ${esc(C.short)} data</div></div><p class="small muted mb-2">Quiz history, flashcard boxes, checklists, grade entries and scratchpad strokes for this class.</p>
          <div class="row"><button class="btn" data-action="export">${icon('download', 14)} Export backup</button><label class="btn">${icon('rotate', 14)} Import backup <input type="file" id="s-import" accept="application/json" hidden></label><button class="btn danger" data-action="reset">${icon('trash', 14)} Reset ${esc(C.short)} progress</button></div>
          <textarea class="input mono mt-2" id="s-json" rows="8" placeholder="Export writes your backup here; paste a backup here and click Import from text." spellcheck="false"></textarea><button class="btn sm mt-1" data-action="import-text">Import from text</button></div>`
        : `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('download')} Backups and class data</div></div><p class="small muted mb-2">Quiz history, flashcard boxes, checklists, grades and scratchpads are stored per class. Open a class to export, import or reset its data.</p><div class="stack-sm">${mine.map(id => `<a class="card-link" href="#/${id}/settings"><h3>${esc(Courses[id].short)} · ${esc(Courses[id].name)}</h3><p>Backup, import or reset ${esc(Courses[id].short)} progress ${icon('right', 12)}</p></a>`).join('')}</div></div>`;
      root.innerHTML = `${standalone ? '<div class="landing-wrap settings-wrap">' : ''}${head}<div class="grid cols-2"><div id="acct-panel" class="span-2"></div>${classesPanel}${prefsPanel}${dataPanel}</div>${standalone ? '</div>' : ''}`;
      const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      $('#s-theme', root).addEventListener('change', e => { setSetting('theme', e.target.value); applyTheme(); });
      on(root, 'click', '[data-action="tour-again"]', () => { if (App.tour && App.tour.replay) App.tour.replay(); });
      on(root, 'click', '[data-action="skin"]', el => { setSetting('skin', el.dataset.skin); applyTheme(); $$('.skin-opt', root).forEach(b => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', b === el); }); toast(`${el.querySelector('b').textContent} look on.`, 1800); });
      const sl = $('#s-lang', root); if (sl) sl.addEventListener('change', e => I18N.set(e.target.value));
      const sm = $('#s-motion', root); if (sm) sm.addEventListener('change', e => { setSetting('motion', e.target.checked ? 'off' : 'on'); applyTheme(); });
      if (App.boCharWire) App.boCharWire($('#s-bochar', root));
      const sbf = $('#s-bofloat', root); if (sbf) sbf.addEventListener('change', e => { setSetting('boFloat', e.target.checked); const t = $('#s-botips', root); if (t) { t.disabled = !e.target.checked; t.checked = e.target.checked && settings().boTips !== false; } if (App.boFloat && App.boFloat.sync) App.boFloat.sync(); toast(e.target.checked ? 'Bo is back on every page.' : 'Bo stays on Ask Bo. Turn him back on here any time.'); });
      const sbt = $('#s-botips', root); if (sbt) sbt.addEventListener('change', e => setSetting('boTips', e.target.checked));
      const sgk = $('#s-geek', root); if (sgk) sgk.addEventListener('change', e => { setSetting('geek', e.target.checked); applyTheme(); if (e.target.checked && App.geekSweep) App.geekSweep(); toast(e.target.checked ? (App.geekOn && App.geekOn() ? 'Geek mode on.' : 'Geek mode on. It stays still while Reduce motion is on.') : 'Geek mode off.', 2200); });
      const sg = $('#s-goal', root); if (sg) sg.addEventListener('change', e => { setSetting('dailyGoal', +e.target.value); if (App.paintStats) { App.paintStats(); App.paintMascots(); } toast(`Daily goal: ${e.target.value} XP`); });
      const sd = $('#s-sound', root); if (sd) sd.addEventListener('change', e => { setSetting('sound', e.target.checked); if (e.target.checked && App.sfx) App.sfx.play('correct'); });
      const lb = $('#s-livebg', root); if (lb) lb.addEventListener('change', e => { setSetting('liveBg', e.target.checked); if (App.liveBg) App.liveBg.apply(); });
      $('#s-asof', root).addEventListener('change', e => { setSetting('asof', e.target.value || ''); render(); if (e.target.value) toast(`Viewing the site as of ${fmtDate(e.target.value)}`); });
      const acct = $('#acct-panel', root); if (acct && App.auth) acct.replaceWith(Object.assign(App.auth.settingsPanel(root), { className: 'panel span-2 acct-panel' }));
      const lab = $('#s-lab', root); if (lab) lab.addEventListener('change', e => { setCourseSetting(C.id, 'labDay', e.target.value); toast('Lab day saved'); });
      const vsel = $('#s-variant', root); if (vsel) vsel.addEventListener('change', e => { setCourseSetting(C.id, 'variant', e.target.value); applyVariant(C); toast(V.saved || 'Section saved. Your calendar and exam dates now follow it.'); });
      const imp = $('#s-import', root); if (imp) imp.addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(txt => { try { store.importJSON(txt); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } }); });
      bind(root, { export: () => { const txt = store.exportJSON(); $('#s-json', root).value = txt; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `studyhub-${C.id}-${todayISO()}.json`; a.click(); } catch {} toast('Backup ready'); }, 'import-text': () => { try { store.importJSON($('#s-json', root).value); toast('Backup imported'); render(); } catch (err) { alert('Could not import: ' + err.message); } }, reset: () => { if (confirm(`Erase all saved ${C.short} progress on this device?`)) { store.reset(); toast('Progress reset'); render(); } }, 'asof-clear': () => { setSetting('asof', ''); render(); }, choose: () => { if (App.auth && App.auth.user) App.auth.onboard(true); else if (App.auth) App.auth.open('signup'); } });
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
