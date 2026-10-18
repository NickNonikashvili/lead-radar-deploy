/* ============================================================
   Mathub — your own planner: the store, sync and quick add
   Everything a student keeps for themselves outside a class's own
   pages: tasks and assignments, to-dos, events and reminders, the
   timetable, habits, goals, the wheel of life, the journal, money,
   career and projects. One document in localStorage (mathub-life)
   that follows the account (api/life.php): every record carries an
   id and "u" (when it last changed), and two copies merge record by
   record, so a phone and a laptop never overwrite each other.
   Deleting leaves a tombstone ({ id, u, del: 1 }) for 90 days.
   A signed-in account's copy is removed from the browser when they
   log out (it lives in the account); a guest's copy moves into the
   account when they sign in.
   App.life: all, get, add, put, remove, restore, day, setDay, rec,
   setRec, cfg, setCfg, onChange, items(from, to), form(), sync().
   App.quickAdd(type, preset): the one dialog behind every New button.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, toast } = App;
  const Courses = global.Courses;
  const KEY = 'mathub-life'; const NOTIFIED = 'mathub-life-notified';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);

  /* ---------- marks the planner pages use ---------- */
  Object.assign(App.ICONS || {}, {
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><path d="M20 11h-4a2 2 0 0 0 0 4h4"/><path d="M16 13h.01"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h8M8 19h5"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M12 2v3"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21M5.6 5.6l4.6 4.6M13.8 13.8l4.6 4.6M18.4 5.6l-4.6 4.6M10.2 13.8l-4.6 4.6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    pie: '<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2 1.5M4 5l3-2.5M20 5l-3-2.5"/>',
    todo: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 5-5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><path d="M14.5 12.5h.01"/>',
    grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>'
  });

  /* ---------- the document ---------- */
  const now = () => Date.now();
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
  const blank = () => ({ v: 1 });
  const readState = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.doc && typeof s.doc === 'object') return s; } catch (e) {} return { doc: blank(), dirty: false, owner: null, synced: 0 }; };
  let S = readState(); let edits = 0;
  function write() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!write.warned) { write.warned = true; toast(t('This browser has no room left for your planner. Sign in to keep it in your account.'), 4200); } } }

  // the same merge as api/life.php: lists of records by id, maps of records by key, the newer "u" wins
  const isRecList = (a, b) => Array.isArray(a) && Array.isArray(b) && (a.length || b.length) && a.concat(b).every(r => r && typeof r === 'object' && r.id != null);
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(a, b) {
    if (isRecList(a, b)) {
      const by = new Map(); [a, b].forEach(list => list.forEach(r => { const k = String(r.id); const o = by.get(k); if (!o || (r.u || 0) >= (o.u || 0)) by.set(k, r); }));
      const cut = now() - 90 * 86400000; return [...by.values()].filter(r => !r.del || (r.u || 0) > cut);
    }
    if (isObj(a) && isObj(b)) {
      if (a.u != null || b.u != null) return (b.u || 0) >= (a.u || 0) ? b : a;
      const out = Object.assign({}, a); Object.keys(b).forEach(k => { out[k] = k in a ? merge(a[k], b[k]) : b[k]; }); return out;
    }
    return b === undefined ? a : b;
  }

  /* ---------- the API every page uses ---------- */
  const listeners = [];
  function changed(col) { listeners.forEach(fn => { try { fn(col); } catch (e) { console.error(e); } }); }
  function save(col) { S.dirty = true; edits++; write(); if (App.searchReset) App.searchReset(); changed(col); schedulePush(); }
  const Life = {
    all(col) { return (S.doc[col] || []).filter(r => r && !r.del); },
    get(col, id) { return (S.doc[col] || []).find(r => r && r.id === id && !r.del) || null; },
    add(col, rec) { const r = Object.assign({ id: uid(), c: now() }, rec, { u: now() }); (S.doc[col] = Array.isArray(S.doc[col]) ? S.doc[col] : []).push(r); save(col); return r; },
    put(col, id, patch) { const list = S.doc[col] || []; const i = list.findIndex(r => r && r.id === id); if (i < 0) return null; list[i] = Object.assign({}, list[i], patch, { u: now() }); save(col); return list[i]; },
    remove(col, id) { const list = S.doc[col] || []; const i = list.findIndex(r => r && r.id === id); if (i < 0) return null; const old = list[i]; list[i] = { id, u: now(), del: 1 }; save(col); return old; },
    restore(col, rec) { if (!rec) return; const list = S.doc[col] = S.doc[col] || []; const i = list.findIndex(r => r && r.id === rec.id); const r = Object.assign({}, rec, { u: now() }); if (i < 0) list.push(r); else list[i] = r; save(col); },
    // remove with an Undo in the toast
    drop(col, id, what) { const old = Life.remove(col, id); if (!old) return; const tt = $$('.toast'); tt.forEach(x => x.remove()); const el = document.createElement('div'); el.className = 'toast lf-undo'; el.innerHTML = `<span>${esc(what || t('Deleted'))}</span><button class="linkbtn" type="button">${esc(t('Undo'))}</button>`; document.body.appendChild(el); const kill = setTimeout(() => (App.dismiss ? App.dismiss(el, 200) : el.remove()), 5000); el.querySelector('button').addEventListener('click', () => { clearTimeout(kill); el.remove(); Life.restore(col, old); }); },
    day(map, key) { const v = (S.doc[map] || {})[key]; return v && !v.del ? v : null; },
    days(map) { const m = S.doc[map] || {}; return Object.keys(m).filter(k => m[k] && !m[k].del).sort().map(k => Object.assign({ key: k }, m[k])); },
    setDay(map, key, val) { S.doc[map] = isObj(S.doc[map]) ? S.doc[map] : {}; S.doc[map][key] = val ? Object.assign({}, val, { u: now() }) : { u: now(), del: 1 }; save(map); },
    rec(name) { return S.doc[name] || {}; },
    setRec(name, patch) { S.doc[name] = Object.assign({}, S.doc[name], patch, { u: now() }); save(name); },
    cfg(k, d) { const c = S.doc.cfg || {}; return c[k] !== undefined ? c[k] : d; },
    setCfg(k, v) { Life.setRec('cfg', { [k]: v }); },
    onChange(fn) { listeners.push(fn); },
    uid, merge,
    exportJSON() { return JSON.stringify({ app: 'Mathub planner', exported: new Date().toISOString(), life: S.doc }, null, 2); },
    importJSON(txt) { const o = JSON.parse(txt); const doc = o && o.life && typeof o.life === 'object' ? o.life : o; if (!isObj(doc)) throw new Error('Not a planner file'); S.doc = merge(S.doc, doc); save('*'); },
    size() { try { return JSON.stringify(S.doc).length; } catch (e) { return 0; } },
    state: () => ({ owner: S.owner, dirty: S.dirty, synced: S.synced })
  };
  App.life = Life;

  /* ---------- following the account ---------- */
  const user = () => App.auth && App.auth.ready && App.auth.user && !App.auth.user.local ? App.auth.user : null;
  const online = () => !!(user() && App.auth.mode === 'server' && !App.auth.unreachable);
  const whoOf = u => String(u.id || u.email || '');
  async function req(method, body) {
    const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'MatHub', Accept: 'application/json' } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch('api/index.php?r=life', opts); let j = null; try { j = await r.json(); } catch (e) {}
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || t('Could not reach your account.')), { status: r.status });
    return j;
  }
  let pushTimer = null; let pushing = null; let lastPull = 0;
  function schedulePush(ms = 2200) { if (!online()) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, ms); }
  async function push() {
    if (!online()) return; if (pushing) { schedulePush(800); return; }
    const sent = edits; const body = { life: S.doc };
    pushing = req('PUT', body).then(j => { S.doc = merge(j.life || {}, S.doc); S.synced = j.updated || now(); if (edits === sent) S.dirty = false; write(); if (edits !== sent) schedulePush(400); }).catch(e => { if (e.status === 413 && !push.warned) { push.warned = true; toast(e.message, 5000); } }).finally(() => { pushing = null; });
    return pushing;
  }
  async function pull() {
    if (!online()) return; lastPull = now();
    try { const j = await req('GET'); const before = JSON.stringify(S.doc); S.doc = merge(j.life || {}, S.doc); S.synced = j.updated || S.synced; const after = JSON.stringify(S.doc); write(); if (after !== before) changed('*'); if (S.dirty || after !== JSON.stringify(j.life || {})) schedulePush(300); } catch (e) {}
  }
  Life.sync = () => (online() ? pull() : Promise.resolve());
  function onAuth() {
    if (!App.auth || !App.auth.ready) return; const u = user();
    if (u) {
      const who = whoOf(u);
      if (S.owner && S.owner !== who) { S = { doc: blank(), dirty: false, owner: who, synced: 0 }; write(); changed('*'); }   // another account used this browser before
      else if (!S.owner) { S.owner = who; if (Object.keys(S.doc).length > 1) S.dirty = true; write(); }   // a guest's planner moves into the account
      pull();
    } else if (S.owner && App.auth.mode === 'server') { S = { doc: blank(), dirty: false, owner: null, synced: 0 }; write(); changed('*'); }   // logged out: the planner lives in the account, not on this computer
  }
  function hookAuth() { if (!App.auth || hookAuth.done) return; hookAuth.done = true; App.auth.onChange(onAuth); onAuth(); }
  document.addEventListener('DOMContentLoaded', () => setTimeout(hookAuth, 0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && online() && now() - lastPull > 60000) pull(); if (document.visibilityState === 'hidden' && S.dirty && online()) { clearTimeout(pushTimer); push(); } });
  window.addEventListener('storage', e => { if (e.key === KEY) { S = readState(); changed('*'); } });   // another tab changed it

  /* ---------- dates and small pieces the pages share ---------- */
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  const today = () => App.todayISO();
  const addDaysISO = (iso, n) => App.toISO(App.addDays(App.parseISO(iso), n));
  const dowOf = iso => App.parseISO(iso).getDay();
  const weekStart = iso => { const d = dowOf(iso); const ws = Life.cfg('weekStart', 1); return addDaysISO(iso, -((d - ws + 7) % 7)); };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const toMin = hm => { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const fromMin = n => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  // month names as a heading ("October", "Октябрь"), not the form used inside a date
  const monthName = (m, short) => { try { const v = new Intl.DateTimeFormat(App.lang === 'en' ? 'en-US' : App.lang, { month: short ? 'short' : 'long' }).format(new Date(2026, m, 15)); return v.charAt(0).toUpperCase() + v.slice(1); } catch (e) { return short ? MONTHS[m].slice(0, 3) : MONTHS[m]; } };
  const h12 = () => { try { return new Intl.DateTimeFormat(App.lang === 'en' ? 'en-US' : App.lang, { hour: 'numeric' }).resolvedOptions().hour12 !== false; } catch (e) { return true; } };
  const fmtTime = hm => { const n = toMin(hm); if (n == null) return ''; const H = Math.floor(n / 60), M = n % 60; if (!h12()) return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; const ap = H < 12 ? 'am' : 'pm'; const h = H % 12 || 12; return M ? `${h}:${String(M).padStart(2, '0')} ${ap}` : `${h} ${ap}`; };
  const relDay = iso => { const n = App.daysBetween(today(), iso); return n === 0 ? t('Today') : n === 1 ? t('Tomorrow') : n === -1 ? t('Yesterday') : n > 1 && n < 7 ? t(DOW_LONG[dowOf(iso)]) : App.shortDate(iso); };
  const mine = () => App.myCourses().filter(id => Courses[id] && !Courses[id].preview);
  const classOptions = (none = 'No class') => [['', t(none)]].concat(mine().map(id => [id, `${Courses[id].short} · ${Courses[id].code}`]));
  // each class's colours as --cc, --cc-soft, --cc-deep… (App.classStyle reads the site's own class rules; kept per theme)
  const ccCache = new Map();
  const ccStyle = id => { if (!id || !Courses[id] || !App.classStyle) return ''; const k = id + '|' + (document.documentElement.dataset.theme || (global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'd' : 'l')) + '|' + (document.documentElement.dataset.skin || ''); if (!ccCache.has(k)) ccCache.set(k, App.classStyle(id)); return ccCache.get(k); };
  const classChip = id => id && Courses[id] ? `<span class="lf-cls" style="${ccStyle(id)}" title="${esc(Courses[id].name)}"><i></i>${esc(Courses[id].short)}</span>` : '';
  Object.assign(Life, { today, addDaysISO, dowOf, weekStart, DOW, DOW_LONG, MONTHS, monthName, toMin, fromMin, fmtTime, relDay, mine, classOptions, classChip, ccStyle, ISO_RE });

  /* ---------- everything dated, from every source, for the calendar, the sidebar and the start page ---------- */
  const DUE_KIND = { task: 'task', assignment: 'assignment', exam: 'exam', quiz: 'exam', reading: 'task', project: 'assignment' };
  function classItems(id, from, to) {
    const C = Courses[id]; const out = []; if (!C || !C.SEMESTER) return out;
    (C.EXAMS || []).forEach(ex => { if (ex.date >= from && ex.date <= to) out.push({ date: ex.date, title: `${ex.name}`, kind: 'exam', course: id, src: 'class', href: `#/${id}/exam`, sub: ex.covers || '' }); });
    (C.CALENDAR || []).forEach(e => { if (e[0] < from || e[0] > to) return; if (e[1] === 'admin') out.push({ date: e[0], title: e[2], kind: /\bdue\b|deadline|submit/i.test(e[2]) ? 'deadline' : 'note', course: id, src: 'class', href: `#/${id}/calendar` }); else if (e[1] === 'holiday') out.push({ date: e[0], title: e[2], kind: 'holiday', course: id, src: 'class' }); });
    const sStart = C.SEMESTER.start, sEnd = C.SEMESTER.end; const hol = new Set((C.CALENDAR || []).filter(e => e[1] === 'holiday').map(e => e[0]));
    if (C.RECURRING && C.RECURRING.length) {
      let d = from > sStart ? from : sStart; const last = to < sEnd ? to : sEnd; let guard = 0;
      while (d <= last && guard++ < 400) { const dw = dowOf(d); C.RECURRING.forEach(r => { if (r.quiet || (r.from && d < r.from) || (r.skipHolidays && hol.has(d))) return; if (r.dows && r.dows.includes(dw)) out.push({ date: d, time: to24(r.time), title: r.title, kind: 'deadline', course: id, src: 'class', href: `#/${id}/calendar` }); }); d = addDaysISO(d, 1); }
    }
    const Cv = App.Canvas; if (Cv && Cv.data && Cv.data.configured) { const days = Math.max(1, App.daysBetween(from, to) + 1); Cv.events(id, from, days).forEach(e => out.push({ date: e.date, time: to24(e.time), title: e.title, kind: 'deadline', course: id, src: 'canvas', href: e.url })); }
    return out;
  }
  function to24(s) { if (!s) return ''; if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0'); const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(String(s).trim()); if (!m) return ''; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return `${String(h).padStart(2, '0')}:${m[2] || '00'}`; }
  Life.to24 = to24;
  Life.items = function (from, to, opts = {}) {
    let out = [];
    Life.all('tasks').forEach(x => { if (x.due && x.due >= from && x.due <= to) out.push({ date: x.due, time: x.time || '', title: x.title, kind: DUE_KIND[x.kind] || 'task', course: x.course || '', src: 'mine', col: 'tasks', id: x.id, done: x.status === 'done', prio: x.priority }); });
    Life.all('events').forEach(x => { if (x.date && x.date >= from && x.date <= to) out.push({ date: x.date, time: x.time || '', end: x.end || '', title: x.title, kind: 'event', course: x.course || '', src: 'mine', col: 'events', id: x.id, sub: x.place || '' }); });
    Life.all('todos').forEach(x => { if (x.date && x.date >= from && x.date <= to) out.push({ date: x.date, title: x.title, kind: 'todo', src: 'mine', col: 'todos', id: x.id, done: !!x.done }); });
    Life.all('projects').forEach(p => { if (p.due && p.due >= from && p.due <= to) out.push({ date: p.due, title: p.title, kind: 'assignment', course: p.course || '', src: 'mine', href: '#/projects', sub: t('Project due') }); (p.steps || []).forEach(s => { if (s.date && s.date >= from && s.date <= to) out.push({ date: s.date, title: `${p.title}: ${s.title}`, kind: 'task', course: p.course || '', src: 'mine', href: '#/projects', done: !!s.done }); }); });
    Life.all('apps').forEach(a => { if (a.deadline && a.deadline >= from && a.deadline <= to && !['offer', 'rejected', 'applied', 'interview'].includes(a.status)) out.push({ date: a.deadline, title: `${a.company}${a.role ? ' · ' + a.role : ''}`, kind: 'deadline', src: 'mine', href: '#/career', sub: t('Application deadline') }); });
    if (opts.classes !== false) mine().forEach(id => { out = out.concat(classItems(id, from, to)); });
    // a task the student made from a class deadline replaces that deadline
    const keys = new Set(out.filter(x => x.src === 'mine').map(x => x.date + '|' + x.title.toLowerCase()));
    out = out.filter(x => x.src === 'mine' || !keys.has(x.date + '|' + x.title.toLowerCase()));
    const RANK = { exam: 0, deadline: 1, assignment: 2, task: 3, event: 4, todo: 5, note: 6, holiday: 7 };
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || (RANK[a.kind] - RANK[b.kind]));
  };
  // the timetable's meetings on one day
  Life.slotsOn = iso => { const dw = dowOf(iso); return Life.all('slots').filter(s => (s.days || []).includes(dw) && (!s.from || iso >= s.from) && (!s.until || iso <= s.until)).sort((a, b) => (a.start || '').localeCompare(b.start || '')); };

  /* ---------- a form in a dialog: every New and Edit uses it ---------- */
  let FORM = null;
  function closeForm() { if (!FORM) return; const f = FORM; FORM = null; document.removeEventListener('keydown', f.key, true); if (App.dismiss) App.dismiss(f.el, 160); else f.el.remove(); if (f.back && f.back.isConnected) try { f.back.focus(); } catch (e) {} }
  function fieldHtml(f, v) {
    const id = 'lf-' + f.k; const req = f.req ? ' required' : ''; const ph = f.ph ? ` placeholder="${esc(t(f.ph))}"` : '';
    const lab = `<label class="lf-label" for="${id}">${esc(t(f.label))}${f.opt ? ` <span class="muted">${esc(t('optional'))}</span>` : ''}</label>`;
    const val = v == null ? '' : v;
    switch (f.type) {
      case 'textarea': return `${lab}<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}"${ph}${req}>${esc(val)}</textarea>`;
      case 'select': case 'class': { const opts = f.type === 'class' ? classOptions(f.none || 'No class') : f.options; return `${lab}<select id="${id}" name="${f.k}"${req}>${opts.map(([o, l]) => `<option value="${esc(o)}"${String(o) === String(val) ? ' selected' : ''}>${esc(t(l))}</option>`).join('')}</select>`; }
      case 'seg': return `<span class="lf-label" id="${id}-l">${esc(t(f.label))}</span><div class="lf-seg" role="radiogroup" aria-labelledby="${id}-l">${f.options.map(([o, l]) => `<label class="lf-seg-opt${f.tone ? ' tone-' + o : ''}"><input type="radio" name="${f.k}" value="${esc(o)}"${String(o) === String(val || f.options[0][0]) ? ' checked' : ''}><span>${esc(t(l))}</span></label>`).join('')}</div>`;
      case 'days': { const set = new Set(Array.isArray(val) ? val : []); const order = [1, 2, 3, 4, 5, 6, 0]; return `<span class="lf-label" id="${id}-l">${esc(t(f.label))}</span><div class="lf-days" role="group" aria-labelledby="${id}-l">${order.map(d => `<label class="lf-day"><input type="checkbox" name="${f.k}" value="${d}"${set.has(d) ? ' checked' : ''}><span title="${esc(t(DOW_LONG[d]))}">${esc(t(DOW[d]))}</span></label>`).join('')}</div>`; }
      case 'check': return `<label class="lf-check"><input type="checkbox" id="${id}" name="${f.k}"${val ? ' checked' : ''}><span>${esc(t(f.label))}</span></label>`;
      case 'range': return `${lab}<div class="lf-range"><input type="range" id="${id}" name="${f.k}" min="${f.min ?? 0}" max="${f.max ?? 10}" step="${f.step ?? 1}" value="${esc(val === '' ? (f.min ?? 0) : val)}"><output for="${id}">${esc(val === '' ? (f.min ?? 0) : val)}</output></div>`;
      default: return `${lab}<input id="${id}" name="${f.k}" type="${f.type || 'text'}"${f.type === 'number' ? ` inputmode="decimal" step="${f.step || 'any'}"${f.min != null ? ` min="${f.min}"` : ''}` : ''}${f.max != null && f.type !== 'number' ? ` maxlength="${f.max}"` : ''} value="${esc(val)}"${ph}${req}${f.auto ? ' autofocus' : ''} autocomplete="off">`;
    }
  }
  function readForm(form, fields) {
    const out = {};
    fields.forEach(f => {
      if (f.type === 'days') out[f.k] = $$(`input[name="${f.k}"]:checked`, form).map(i => +i.value);
      else if (f.type === 'check') out[f.k] = !!$(`input[name="${f.k}"]`, form).checked;
      else if (f.type === 'seg') { const c = $(`input[name="${f.k}"]:checked`, form); out[f.k] = c ? c.value : ''; }
      else if (f.type === 'html') return;
      else { const el = form.elements[f.k]; let v = el ? String(el.value).trim() : ''; if (f.type === 'number' || f.type === 'range') v = v === '' ? '' : +v.replace(',', '.'); out[f.k] = v; }
    });
    return out;
  }
  /* Life.form({ title, icon, fields, values, submit, onSave(values) → false keeps it open, onDelete, top (html above the fields), wide }) */
  Life.form = function (o) {
    closeForm(); const back = document.activeElement;
    const el = document.createElement('div'); el.className = 'modal-backdrop lf-back';
    const rows = o.fields.map(f => f.type === 'html' ? `<div class="lf-f full">${f.html}</div>` : `<div class="lf-f${f.half ? ' half' : ''}${f.third ? ' third' : ''}" data-k="${f.k}">${fieldHtml(f, o.values ? o.values[f.k] : undefined)}</div>`).join('');
    el.innerHTML = `<form class="modal lf-modal${o.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="lf-title" novalidate>
      <div class="lf-head"><span class="lf-head-ic">${icon(o.icon || 'plus', 18)}</span><h2 id="lf-title">${esc(t(o.title))}</h2><button class="icon-btn" type="button" data-x aria-label="${esc(t('Close'))}">${icon('x', 15)}</button></div>
      ${o.top || ''}<div class="lf-body">${rows}</div><p class="lf-err" role="alert" hidden></p>
      <div class="lf-foot">${o.onDelete ? `<button class="btn ghost lf-del" type="button" data-del>${icon('trash', 14)} ${esc(t(o.deleteLabel || 'Delete'))}</button>` : ''}<span class="lf-sp"></span><button class="btn" type="button" data-x>${esc(t('Cancel'))}</button><button class="btn primary" type="submit">${icon(o.submitIcon || 'check', 14)} ${esc(t(o.submit || 'Save'))}</button></div>
    </form>`;
    document.body.appendChild(el);
    const form = $('form', el); const err = $('.lf-err', el);
    $$('input[type="range"]', el).forEach(r => r.addEventListener('input', () => { const out = r.parentElement.querySelector('output'); if (out) out.textContent = r.value; }));
    el.addEventListener('mousedown', e => { if (e.target === el) el.__down = true; }); el.addEventListener('click', e => { if (e.target === el && el.__down) closeForm(); el.__down = false; if (e.target.closest('[data-x]')) closeForm(); if (e.target.closest('[data-del]')) { if (o.onDelete() !== false) closeForm(); } });
    form.addEventListener('submit', e => {
      e.preventDefault(); const v = readForm(form, o.fields);
      const miss = o.fields.find(f => f.req && (f.type === 'days' ? !v[f.k].length : v[f.k] === '' || v[f.k] == null));
      if (miss) { err.hidden = false; err.textContent = t('{1} is needed.', t(miss.label)); const m = $(`[data-k="${miss.k}"] input, [data-k="${miss.k}"] select, [data-k="${miss.k}"] textarea`, form); if (m) m.focus(); return; }
      const bad = o.fields.find(f => f.type === 'number' && v[f.k] !== '' && !isFinite(v[f.k]));
      if (bad) { err.hidden = false; err.textContent = t('{1} must be a number.', t(bad.label)); return; }
      if (o.check) { const msg = o.check(v); if (msg) { err.hidden = false; err.textContent = t(msg); return; } }
      if (o.onSave(v) !== false) closeForm();
    });
    if (o.wire) o.wire(form, el);
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closeForm(); } };
    document.addEventListener('keydown', key, true); FORM = { el, key, back };
    setTimeout(() => { const first = $('[autofocus], input:not([type="radio"]):not([type="checkbox"]):not([type="range"]), textarea, select', form); if (first) first.focus(); }, 30);
    return form;
  };
  Life.closeForm = closeForm;

  /* ---------- quick add: Task, Assignment, Exam, Event, To-do, Class meeting, Spending, Note ---------- */
  const PRIO = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
  const STATUS = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  const KINDS = [['task', 'Task'], ['assignment', 'Assignment'], ['exam', 'Exam or quiz'], ['reading', 'Reading']];
  const SLOT_KIND = [['lecture', 'Lecture'], ['lab', 'Lab'], ['recitation', 'Recitation'], ['seminar', 'Seminar'], ['office', 'Office hours'], ['study', 'Study block'], ['work', 'Work shift'], ['club', 'Club or team'], ['other', 'Other']];
  const REMIND = [['', 'No reminder'], ['0', 'At the time'], ['10', '10 minutes before'], ['60', '1 hour before'], ['1440', 'The day before']];
  const SPEND = ['Food', 'Rent', 'Books & supplies', 'Transport', 'Fun', 'Bills', 'Health', 'Shopping', 'Other'];
  const EARN = ['Job', 'Family', 'Scholarship', 'Loan', 'Other'];
  Object.assign(Life, { PRIO, STATUS, KINDS, SLOT_KIND, REMIND, SPEND, EARN });
  Life.taskFields = (kind = 'task') => [
    { k: 'title', label: kind === 'exam' ? 'What exam or quiz' : 'What needs doing', req: true, auto: true, max: 160, ph: kind === 'assignment' ? 'Problem set 4' : kind === 'exam' ? 'Midterm 2' : 'Email my advisor' },
    { k: 'kind', label: 'Kind', type: 'select', options: KINDS, half: true }, { k: 'course', label: 'Class', type: 'class', half: true },
    { k: 'due', label: kind === 'exam' ? 'Date' : 'Due', type: 'date', half: true }, { k: 'time', label: 'Time', type: 'time', half: true, opt: true },
    { k: 'priority', label: 'Priority', type: 'seg', options: PRIO, tone: true }, { k: 'status', label: 'Status', type: 'seg', options: STATUS },
    { k: 'notes', label: 'Notes', type: 'textarea', opt: true, rows: 2 }
  ];
  Life.eventFields = () => [
    { k: 'title', label: 'What', req: true, auto: true, max: 160, ph: 'Study group in the library' },
    { k: 'date', label: 'Date', type: 'date', req: true, half: true }, { k: 'course', label: 'Class', type: 'class', half: true },
    { k: 'time', label: 'Starts', type: 'time', half: true, opt: true }, { k: 'end', label: 'Ends', type: 'time', half: true, opt: true },
    { k: 'place', label: 'Where', opt: true, max: 120, ph: 'Renne Library, 2nd floor' }, { k: 'remind', label: 'Reminder', type: 'select', options: REMIND },
    { k: 'notes', label: 'Notes', type: 'textarea', opt: true, rows: 2 }
  ];
  Life.slotFields = () => [
    { k: 'title', label: 'Name', req: true, auto: true, max: 80, ph: 'Calculus I lecture' },
    { k: 'course', label: 'Class', type: 'class', half: true, none: 'Not a class' }, { k: 'kind', label: 'Kind', type: 'select', options: SLOT_KIND, half: true },
    { k: 'days', label: 'Days', type: 'days', req: true },
    { k: 'start', label: 'Starts', type: 'time', req: true, half: true }, { k: 'end', label: 'Ends', type: 'time', req: true, half: true },
    { k: 'place', label: 'Room', opt: true, max: 80, ph: 'Wilson 1-122', half: true }, { k: 'who', label: 'With', opt: true, max: 80, ph: 'Instructor or TA', half: true }
  ];
  Life.txFields = (type = 'out') => [
    { k: 'type', label: 'Money', type: 'seg', options: [['out', 'Spent'], ['in', 'Got']] },
    { k: 'amount', label: 'Amount', type: 'number', req: true, min: 0, auto: true, half: true, ph: '12.50' }, { k: 'date', label: 'Date', type: 'date', req: true, half: true },
    { k: 'cat', label: 'Category', type: 'select', options: (type === 'in' ? EARN : SPEND).map(c => [c, c]), half: true }, { k: 'note', label: 'Note', opt: true, max: 120, half: true, ph: 'Groceries at Town & Country' }
  ];
  Life.saveTask = (v, id) => { const rec = { title: v.title, kind: v.kind || 'task', course: v.course || '', due: v.due || '', time: v.time || '', priority: v.priority || 'medium', status: v.status || 'todo', notes: v.notes || '' }; if (rec.status === 'done') rec.doneAt = now(); return id ? Life.put('tasks', id, rec) : Life.add('tasks', rec); };
  Life.editTask = (id) => { const x = Life.get('tasks', id); if (!x) return; Life.form({ title: 'Edit task', icon: 'pen', fields: Life.taskFields(x.kind), values: x, onSave: v => { Life.saveTask(v, id); toast(t('Saved')); }, onDelete: () => Life.drop('tasks', id, t('Task deleted')) }); };
  Life.editEvent = (id) => { const x = Life.get('events', id); if (!x) return; Life.form({ title: 'Edit event', icon: 'pen', fields: Life.eventFields(), values: x, onSave: v => { Life.put('events', id, v); toast(t('Saved')); }, onDelete: () => Life.drop('events', id, t('Event deleted')) }); };
  Life.editSlot = (id) => { const x = Life.get('slots', id); if (!x) return; Life.form({ title: 'Edit class meeting', icon: 'pen', fields: Life.slotFields(), values: x, check: v => toMin(v.end) <= toMin(v.start) ? 'It has to end after it starts.' : '', onSave: v => { Life.put('slots', id, v); toast(t('Saved')); }, onDelete: () => Life.drop('slots', id, t('Removed from your timetable')) }); };

  const QA = [
    ['task', 'Task', 'todo'], ['assignment', 'Assignment', 'file'], ['exam', 'Exam', 'flag'], ['event', 'Event', 'calendar'],
    ['todo', 'To-do', 'check'], ['slot', 'Class time', 'table'], ['money', 'Spending', 'wallet'], ['note', 'Note', 'note']
  ];
  Life.QA = QA;
  App.quickAdd = function (type = 'task', preset = {}) {
    const p = Object.assign({}, preset); const tIso = today();
    const pick = `<div class="lf-types" role="tablist" aria-label="${esc(t('What to add'))}">${QA.map(([k, l, ic]) => `<button type="button" class="lf-type${k === type ? ' on' : ''}" role="tab" aria-selected="${k === type}" data-type="${k}">${icon(ic, 15)}<span>${esc(t(l))}</span></button>`).join('')}</div>`;
    const wireTypes = (form) => { $$('.lf-type', form).forEach(b => b.addEventListener('click', () => { const keep = {}; const ti = form.elements.title; if (ti && ti.value) keep.title = ti.value; App.quickAdd(b.dataset.type, Object.assign({}, p, keep)); })); };
    const inClass = App.inCourse && App.inCourse() && App.D ? App.D.id : '';
    if (['task', 'assignment', 'exam'].includes(type)) {
      const v = Object.assign({ kind: type, course: inClass, due: type === 'task' ? tIso : '', priority: type === 'exam' ? 'high' : 'medium', status: 'todo' }, p);
      return Life.form({ title: type === 'exam' ? 'New exam' : type === 'assignment' ? 'New assignment' : 'New task', icon: QA.find(q => q[0] === type)[2], top: pick, fields: Life.taskFields(type), values: v, submit: 'Add', submitIcon: 'plus', wire: wireTypes, onSave: v2 => { Life.saveTask(v2); toast(t('Added to your tasks')); } });
    }
    if (type === 'event') return Life.form({ title: 'New event', icon: 'calendar', top: pick, fields: Life.eventFields(), values: Object.assign({ date: tIso, course: inClass, remind: '60' }, p), submit: 'Add', submitIcon: 'plus', wire: wireTypes, onSave: v => { Life.add('events', v); toast(t('Added to your calendar')); if (v.remind !== '' && global.Notification && Notification.permission === 'default') try { Notification.requestPermission(); } catch (e) {} } });
    if (type === 'todo') return Life.form({ title: 'New to-do', icon: 'check', top: pick, fields: [{ k: 'title', label: 'To-do', req: true, auto: true, max: 160, ph: 'Buy a blue book' }, { k: 'date', label: 'For', type: 'date', opt: true }], values: p, submit: 'Add', submitIcon: 'plus', wire: wireTypes, onSave: v => { Life.add('todos', { title: v.title, date: v.date || '', done: false }); toast(t('Added to your to-dos')); } });
    if (type === 'slot') return Life.form({ title: 'Add to your timetable', icon: 'table', top: pick, fields: Life.slotFields(), values: Object.assign({ course: inClass, title: inClass && Courses[inClass] ? Courses[inClass].name : '', kind: inClass ? 'lecture' : 'study', days: [] }, p), submit: 'Add', submitIcon: 'plus', wire: wireTypes, check: v => toMin(v.end) <= toMin(v.start) ? 'It has to end after it starts.' : '', onSave: v => { Life.add('slots', v); toast(t('Added to your timetable')); } });
    if (type === 'money') return Life.form({ title: 'Add spending or income', icon: 'wallet', top: pick, fields: Life.txFields(p.type || 'out'), values: Object.assign({ type: 'out', date: tIso, cat: 'Food' }, p), submit: 'Add', submitIcon: 'plus', wire: (form) => { wireTypes(form); $$('input[name="type"]', form).forEach(r => r.addEventListener('change', () => { const sel = form.elements.cat; const list = r.value === 'in' ? EARN : SPEND; sel.innerHTML = list.map(c => `<option value="${esc(c)}">${esc(t(c))}</option>`).join(''); })); }, onSave: v => { Life.add('tx', { type: v.type, amount: Math.round(Math.abs(v.amount) * 100) / 100, date: v.date, cat: v.cat, note: v.note }); toast(t('Saved to Money')); } });
    if (type === 'note') return Life.form({ title: 'Quick note', icon: 'note', top: pick, fields: [{ k: 'text', label: 'Note', type: 'textarea', req: true, rows: 4, ph: 'Anything you want to remember' }], values: p, submit: 'Save to journal', wire: wireTypes, onSave: v => { const day = Life.day('journal', tIso) || {}; const text = (day.text ? day.text.trim() + '\n\n' : '') + v.text; Life.setDay('journal', tIso, Object.assign({}, day, { text })); toast(t('Saved to today in your journal')); } });
    return App.quickAdd('task', p);
  };
  document.addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'n' && e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); App.quickAdd('task'); } });   // Alt+N: quick add

  /* ---------- reminders: a nudge when an event's reminder time comes while Mathub is open ---------- */
  function notified() { try { return JSON.parse(localStorage.getItem(NOTIFIED) || '{}'); } catch (e) { return {}; } }
  function tickReminders() {
    const n = Date.now(); const seen = notified(); let dirty = false;
    Life.all('events').forEach(ev => {
      if (ev.remind === '' || ev.remind == null || !ev.date) return; const at = new Date(`${ev.date}T${ev.time || '09:00'}:00`).getTime() - (+ev.remind) * 60000; const k = ev.id + '@' + at;
      if (n >= at && n - at < 3 * 3600000 && !seen[k]) {
        seen[k] = n; dirty = true; const when = ev.time ? fmtTime(ev.time) : relDay(ev.date); const msg = `${ev.title} · ${when}`;
        toast(`<b>${icon('alarm', 14)}</b> ${esc(msg)}`, 6000);
        try { if (global.Notification && Notification.permission === 'granted') new Notification('Mathub', { body: msg, icon: 'assets/icon-192.png', tag: k }); } catch (e) {}
      }
    });
    if (dirty) { const keep = {}; Object.keys(seen).forEach(k => { if (n - seen[k] < 7 * 86400000) keep[k] = seen[k]; }); try { localStorage.setItem(NOTIFIED, JSON.stringify(keep)); } catch (e) {} }
  }
  setInterval(tickReminders, 20000); document.addEventListener('DOMContentLoaded', () => setTimeout(tickReminders, 4000));
})(window);
