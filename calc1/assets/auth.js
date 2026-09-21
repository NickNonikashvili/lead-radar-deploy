/* ============================================================
   MatHub — accounts, preview gating and progress sync
   Talks to api/index.php (PHP + SQLite). When the account server is
   unreachable (site opened as a file, api/ not uploaded) it falls back
   to a local sign-in that keeps progress in this browser only.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast } = App;
  const API = 'api/index.php?r=';
  const LOCAL_KEY = 'mathub-local-user';
  const LAST_KEY = 'mathub-last-user';
  const META_KEY = 'studyhub-meta';
  const HARD = new Set(['grades', 'scratchpad', 'grapher', 'labs', 'motion', 'solvers', 'explorer', 'unitcircle']);
  const LIMITS = { questions: 3, cards: 5, sections: 3, formulaGroups: 2 };

  const Auth = { user: null, mode: 'checking', ready: false, health: null, limits: LIMITS, lastPull: {}, pushing: {}, timers: {}, listeners: [] };
  App.auth = Auth;

  /* ---------- transport ---------- */
  async function call(route, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json;
    try { res = await fetch(API + route, opts); } catch (e) { Auth.unreachable = true; paintAccount(); throw Object.assign(new Error('You seem to be offline. MatHub keeps working; your progress syncs when you are back.'), { network: true }); }
    try { json = await res.json(); } catch (e) { throw Object.assign(new Error('The account server sent an unexpected reply (' + res.status + ').'), { network: true }); }
    if (json && json.offline) { Auth.unreachable = true; paintAccount(); throw Object.assign(new Error('You are offline. Your progress syncs when you are back.'), { network: true }); }
    if (Auth.unreachable) { Auth.unreachable = false; paintAccount(); }
    if (!json || json.ok === false) { const err = new Error((json && json.error) || 'Request failed.'); err.status = res.status; err.data = json; throw err; }
    return json;
  }
  const readJSON = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const writeJSON = (key, v) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  const meta = () => readJSON(META_KEY) || {};
  const setMeta = (course, patch) => { const m = meta(); m[course] = Object.assign({}, m[course], patch); writeJSON(META_KEY, m); };

  Auth.isIn = () => !!Auth.user;
  Auth.locked = () => !Auth.user;
  Auth.gate = view => (HARD.has(view) && !Auth.user) ? 'hard' : 'open';
  Auth.emailOk = email => { const m = /^[^\s@]+@([^\s@]+)$/.exec(String(email || '').trim().toLowerCase()); if (!m) return false; const dom = m[1]; const allowed = (Auth.health && Auth.health.domains) || ['montana.edu']; return allowed.some(d => dom === d || dom.endsWith('.' + d)); };
  Auth.onChange = fn => Auth.listeners.push(fn);
  Auth.setUnread = n => { if (Auth.user) Auth.user.unread = n; const b = $('#notif-badge'); if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !(n > 0); } const btn = $('#notif-btn'); if (btn) btn.hidden = !Auth.user || Auth.mode === 'offline'; $$('.inbox-pill').forEach(p => { p.textContent = n > 99 ? '99+' : String(n); p.hidden = !(n > 0); }); };
  function applyServerPrefs() {
    const u = Auth.user; if (!u || u.local) return;
    if (Array.isArray(u.courses)) App.setSetting('courses', u.courses);
    if (u.sections && typeof u.sections === 'object') Object.entries(u.sections).forEach(([cid, v]) => { if (!v) return; if (v.section !== undefined) App.setCourseSetting(cid, 'section', v.section || ''); if (v.examTime !== undefined) App.setCourseSetting(cid, 'examTime', v.examTime || ''); if (v.labDay) App.setCourseSetting(cid, 'labDay', v.labDay); });
  }
  /** Saves class/section/notification preferences to the account (server) and mirrors them locally. */
  Auth.savePrefs = async function (patch) {
    if (patch.courses) App.setSetting('courses', patch.courses);
    if (patch.sections) Object.entries(patch.sections).forEach(([cid, v]) => { App.setCourseSetting(cid, 'section', v.section || ''); App.setCourseSetting(cid, 'examTime', v.examTime || ''); if (v.labDay) App.setCourseSetting(cid, 'labDay', v.labDay); });
    if (Auth.user && Auth.mode === 'server' && !Auth.unreachable) { const r = await call('profile', patch); Auth.user = Object.assign(Auth.user, r.user); }
    else if (Auth.user) { Object.assign(Auth.user, patch); if (Auth.user.local) writeJSON(LOCAL_KEY, Auth.user); }
    if (App.rebuildNav) App.rebuildNav();
  };
  /** Onboarding: which classes, which section, exam time, lab day. Shown once after sign-up, or on demand from Settings. */
  Auth.onboard = function (force) {
    const u = Auth.user; if (!u) return; if (!force && Array.isArray(u.courses)) return;
    let dismissed = false; try { dismissed = localStorage.getItem('mathub-onboarded') === '1'; } catch {}
    if (!force && dismissed) return;
    const courses = App.COURSE_ORDER.filter(id => global.Courses[id]); const chosen = Array.isArray(u.courses) && u.courses.length ? u.courses : (App.settings().courses || courses);
    const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'onboard-modal';
    m.innerHTML = `<div class="modal auth-modal onboard-modal" role="dialog" aria-label="Your classes"><div class="auth-head"><span class="logo-mark">${App.logoSvg(26)}</span><div><b>Which classes are you taking?</b><div class="small muted">MatHub hides the rest and uses your section's times.</div></div><button class="icon-btn" data-action="close" aria-label="Close">${icon('x', 16)}</button></div>
      <div class="onboard-list">${courses.map(id => { const C = global.Courses[id]; const on = chosen.includes(id); const hasLab = (C.RECURRING || []).some(r => r.afterLabDay); return `<div class="onboard-course${on ? ' on' : ''}" data-c="${id}"><label class="check" style="padding:0"><input type="checkbox" data-course="${id}" ${on ? 'checked' : ''}><span><b>${esc(C.code)}</b> ${esc(C.name)}</span></label>
        <div class="onboard-fields grid cols-3" style="gap:8px"><div class="field"><label>Section</label><input class="input" data-sec="${id}" maxlength="20" placeholder="e.g. 002" value="${esc(App.courseSetting(id, 'section', ''))}"></div><div class="field"><label>Your lecture / exam time</label><input class="input" data-time="${id}" maxlength="60" placeholder="e.g. MWF 9:00 am" value="${esc(App.courseSetting(id, 'examTime', ''))}"></div>${hasLab ? `<div class="field"><label>Lab day</label><select class="select" data-lab="${id}"><option value="tue"${App.courseSetting(id, 'labDay', 'tue') !== 'thu' ? ' selected' : ''}>Tuesday</option><option value="thu"${App.courseSetting(id, 'labDay', 'tue') === 'thu' ? ' selected' : ''}>Thursday</option></select></div>` : '<div></div>'}</div></div>`; }).join('')}</div>
      <div class="eyebrow mt-2 mb-1">Daily XP goal</div><div class="goal-picks">${(App.GOALS || []).map(([n, nm]) => `<button type="button" class="goal-pick${(App.dailyGoal ? App.dailyGoal() : 30) === n ? ' on' : ''}" data-action="goal" data-n="${n}"><b>${n} XP</b><span>${nm}</span></button>`).join('')}</div><p class="small muted mt-1">A correct answer is 10 XP. You can change this any time in Settings.</p>
      <div class="row gap-sm mt-2"><button class="btn primary" data-action="save">Save</button><button class="btn" data-action="close">${force ? 'Cancel' : 'Skip for now'}</button></div><div class="auth-msg" id="onboard-msg"></div></div>`;
    document.body.appendChild(m);
    const done = () => { m.remove(); try { localStorage.setItem('mathub-onboarded', '1'); } catch {} };
    on(m, 'change', 'input[data-course]', el => { el.closest('.onboard-course').classList.toggle('on', el.checked); });
    bind(m, { goal: b => { $$('.goal-pick', m).forEach(x => x.classList.toggle('on', x === b)); }, close: () => { done(); if (!Array.isArray(u.courses)) Auth.savePrefs({ courses: courses }).catch(() => {}); },
      save: async () => { const picked = $$('input[data-course]', m).filter(i => i.checked).map(i => i.dataset.course); if (!picked.length) { $('#onboard-msg', m).textContent = 'Pick at least one class.'; return; } const sections = {}; courses.forEach(id => { const lab = $(`select[data-lab="${id}"]`, m); sections[id] = { section: $(`input[data-sec="${id}"]`, m).value.trim(), examTime: $(`input[data-time="${id}"]`, m).value.trim(), labDay: lab ? lab.value : '' }; }); const gp = $('.goal-pick.on', m); if (gp) App.setSetting('dailyGoal', +gp.dataset.n); try { await Auth.savePrefs({ courses: picked, sections }); done(); if (App.paintStats) App.paintStats(); toast('Saved. MatHub now shows ' + picked.map(id => global.Courses[id].short).join(', ') + '.', 3500); App.rerender(); } catch (e) { $('#onboard-msg', m).textContent = e.message; } } });
    m.addEventListener('click', e => { if (e.target === m) bind; });
  };
  function changed() { applyServerPrefs(); paintAccount(); paintBanner(); Auth.setUnread(Auth.user ? (Auth.user.unread || 0) : 0); if (Auth.user && !Auth.user.local && Auth.mode === 'server') writeJSON(LAST_KEY, { user: Auth.user, health: Auth.health ? { domains: Auth.health.domains } : null, at: Date.now() }); if (!Auth.user) writeJSON(LAST_KEY, null); Auth.listeners.forEach(fn => { try { fn(Auth.user); } catch (e) { console.error(e); } }); }

  /* ---------- boot ---------- */
  Auth.init = async function () {
    try {
      const h = await call('health'); Auth.health = h; Auth.mode = 'server'; Auth.user = h.user || null; Auth.unreachable = false; writeJSON(LAST_KEY, Auth.user ? { user: Auth.user, health: { domains: h.domains }, at: Date.now() } : null);
    } catch (e) {
      const last = readJSON(LAST_KEY);
      if (e.network && last && last.user) { Auth.mode = 'server'; Auth.unreachable = true; Auth.user = last.user; Auth.health = last.health || null; }
      else { Auth.mode = 'offline'; const lu = readJSON(LOCAL_KEY); Auth.user = lu && lu.email ? Object.assign({ local: true }, lu) : null; }
    }
    window.addEventListener('online', () => { if (Auth.unreachable) Auth.init(); });
    if (Auth.mode === 'server' && !Auth.unreachable) setInterval(() => { if (document.visibilityState === 'visible' && Auth.user) call('me').then(r => { if (r.user) { Auth.user = Object.assign(Auth.user, r.user); Auth.setUnread(r.user.unread || 0); } else if (Auth.user && !Auth.user.local) { Auth.user = null; changed(); App.rerender(); } }).catch(() => {}); }, 90000);
    Auth.ready = true; changed(); if (App.rebuildNav) App.rebuildNav();
    if (App.current && !(App.current === App.views.practice && App.views.practice.hasSession && App.views.practice.hasSession())) { try { App.rerender(); } catch (e) { console.error(e); } }
    if (Auth.user && Auth.mode === 'server') Auth.pullAll().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Auth.user && Auth.mode === 'server' && App.D) Auth.pullCourse(App.D.id, true).catch(() => {}); });
  };

  /* ---------- sync ---------- */
  Auth.noteWrite = function (course) {
    setMeta(course, { updated: Date.now() });
    if (!Auth.user || Auth.mode !== 'server') return;
    clearTimeout(Auth.timers[course]); Auth.timers[course] = setTimeout(() => Auth.pushCourse(course).catch(() => {}), 1500);
  };
  Auth.pushCourse = async function (course, force) {
    if (!Auth.user || Auth.mode !== 'server') return;
    const data = App.store.peek(course); const m = meta()[course] || {}; const updated = m.updated || Date.now();
    setSyncState('saving');
    try {
      const r = await call('data', { course, data, updated, force: !!force }, 'PUT');
      if (r.stale) { await Auth.pullCourse(course, true); } else setMeta(course, { synced: r.updated });
      setSyncState('ok'); if (App.social) App.social.refreshBadges();
    } catch (e) { setSyncState(e.status === 401 ? 'out' : 'error'); if (e.status === 401) { Auth.user = null; changed(); } throw e; }
  };
  Auth.pullCourse = async function (course, quiet) {
    if (!Auth.user || Auth.mode !== 'server') return;
    if (quiet && Auth.lastPull[course] && Date.now() - Auth.lastPull[course] < 45000) return;
    Auth.lastPull[course] = Date.now();
    const r = await call('data&course=' + encodeURIComponent(course));
    applyServer(course, r.data, r.updated);
  };
  Auth.pullAll = async function () {
    const r = await call('data_all'); const courses = r.courses || {};
    const ids = Object.keys(global.Courses || {});
    for (const id of ids) { const s = courses[id]; if (s) applyServer(id, s.data, s.updated); else if (Object.keys(App.store.peek(id)).length) { setMeta(id, { updated: (meta()[id] || {}).updated || Date.now() }); await Auth.pushCourse(id).catch(() => {}); } }
    setSyncState('ok');
  };
  /* Merge two progress blobs. Unions where possible, otherwise the newer side wins. Idempotent, so repeated pulls are safe. */
  function mergeData(local, server, localNewer) {
    const out = Object.assign({}, localNewer ? server : local, localNewer ? local : server);
    const L = local || {}, S = server || {};
    // quiz history: union by id (legacy entries without ids are kept from both sides)
    const seen = new Set(); const hist = [];
    for (const h of [...(S.history || []), ...(L.history || [])]) { if (h && h.k) { if (seen.has(h.k)) continue; seen.add(h.k); } hist.push(h); }
    hist.sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.k || '').localeCompare(b.k || '')); if (hist.length > 500) hist.splice(0, hist.length - 500); out.history = hist;
    // per-topic progress: keep the larger sample per topic
    const prog = {}; for (const src of [S.progress || {}, L.progress || {}]) for (const [t, v] of Object.entries(src)) { if (!prog[t] || (v.a || 0) > (prog[t].a || 0)) prog[t] = Object.assign({}, v); } out.progress = prog;
    // flashcard boxes: highest box wins
    const fc = Object.assign({}, S.flashcards || {}); for (const [id, box] of Object.entries(L.flashcards || {})) fc[id] = Math.max(fc[id] || 0, box || 0); out.flashcards = fc;
    // activity days, checklists and practice ticks: union
    out.activity = Object.assign({}, S.activity || {}, L.activity || {});
    const cl = {}; for (const src of [S.checklists || {}, L.checklists || {}]) for (const [ex, items] of Object.entries(src)) { cl[ex] = cl[ex] || {}; for (const [i, v] of Object.entries(items || {})) cl[ex][i] = cl[ex][i] || !!v; } out.checklists = cl;
    const pd = {}; for (const src of [S.practiceDone || {}, L.practiceDone || {}]) for (const [ex, items] of Object.entries(src)) { pd[ex] = pd[ex] || {}; for (const [i, v] of Object.entries(items || {})) pd[ex][i] = pd[ex][i] || !!v; } out.practiceDone = pd;
    // focus sessions: union by day (max minutes per day), streak freezes: union
    const sess = {}; for (const src of [S.sessions || [], L.sessions || []]) for (const x of src) if (x && x.d) sess[x.d] = Math.max(sess[x.d] || 0, x.m || 0); out.sessions = Object.keys(sess).sort().map(d => ({ d, m: sess[d] }));
    out.freezes = Object.assign({}, S.freezes || {}, L.freezes || {});
    const xp = {}; for (const src of [S.xp || [], L.xp || []]) for (const x of src) if (x && x.d) xp[x.d] = Math.max(xp[x.d] || 0, x.n || 0); out.xp = Object.keys(xp).sort().map(d => ({ d, n: xp[d] }));
    // grades and scratchpad strokes: the newer side already won via Object.assign, but never replace content with nothing
    if (!(out.grades && Object.keys(out.grades).length)) out.grades = (L.grades && Object.keys(L.grades).length) ? L.grades : (S.grades || {});
    if (!(out.scratch && out.scratch.length)) out.scratch = (L.scratch && L.scratch.length) ? L.scratch : (S.scratch || []);
    return out;
  }
  Auth.mergeData = mergeData;
  function applyServer(course, data, updated) {
    const m = meta()[course] || {}; const local = App.store.peek(course); const hasLocal = Object.keys(local).length > 0;
    if (!data) { if (hasLocal) Auth.pushCourse(course).catch(() => {}); return; }
    if (!hasLocal) { App.store.replace(course, data); setMeta(course, { updated, synced: updated }); rerenderIfSafe(course); return; }
    const synced = m.synced || 0;
    if (synced === updated && (m.updated || 0) <= synced) return;            // nothing changed on either side
    if (synced === updated && (m.updated || 0) > synced) { Auth.pushCourse(course).catch(() => {}); return; }   // only local changed
    const merged = mergeData(local, data, (m.updated || 0) > (updated || 0));
    App.store.replace(course, merged); const now = Date.now(); setMeta(course, { updated: now, synced: updated });
    Auth.pushCourse(course, true).catch(() => {}); rerenderIfSafe(course);
  }
  function rerenderIfSafe(course) { if (App.D && App.D.id === course && App.current && App.current !== App.views.scratchpad && !(App.views.practice.hasSession && App.views.practice.hasSession())) { try { App.rerender(); } catch {} } }
  function setSyncState(state) { Auth.sync = state; const el = $('#acct-sync'); if (el) el.innerHTML = syncLabel(); }
  const syncLabel = () => Auth.mode !== 'server' ? '<span class="muted">local only</span>' : Auth.unreachable ? '<span style="color:var(--warn)">offline · will sync</span>' : Auth.sync === 'saving' ? 'saving…' : Auth.sync === 'error' ? '<span style="color:var(--bad)">not synced</span>' : 'synced';

  /* ---------- account box (sidebar) & preview banner ---------- */
  function paintAccount() {
    const box = $('#account-box'); if (!box) return;
    if (!Auth.ready) { box.innerHTML = '<div class="acct small muted">Checking account…</div>'; return; }
    if (Auth.user) {
      const name = Auth.user.name || Auth.user.email.split('@')[0]; const initial = name.trim()[0].toUpperCase();
      box.innerHTML = `<div class="acct"><div class="avatar">${esc(initial)}</div><div class="acct-body"><div class="acct-name" title="${esc(Auth.user.email)}">${esc(name)}</div><div class="acct-sub" id="acct-sync">${syncLabel()}</div></div><button class="icon-btn" data-action="acct-menu" title="Account settings">${icon('gear', 14)}</button></div>`;
    } else {
      box.innerHTML = `<div class="acct guest"><div><div class="acct-name">Preview mode</div><div class="acct-sub">Sign up to unlock everything</div></div><div class="row gap-sm"><button class="btn xs primary" data-action="auth-signup">Sign up</button><button class="btn xs" data-action="auth-login">Log in</button></div></div>`;
    }
    bind(box, { 'auth-signup': () => Auth.open('signup'), 'auth-login': () => Auth.open('login'), 'acct-menu': () => App.go('settings') });
    let top = $('#topbar-account'); if (!top) { const ta = $('#topbar .topbar-actions'); if (ta) { top = document.createElement('span'); top.id = 'topbar-account'; top.className = 'acct-slot'; ta.append(top); } }
    if (top) accountMenu(top);
    $$('#landing-account').forEach(paintLandingAccount);
  }
  function paintLandingAccount(el) { el.innerHTML = '<span class="row gap-sm landing-acct"><span class="hub-slot"></span><span class="acct-menu-slot"></span></span>'; accountMenu($('.acct-menu-slot', el), { landing: true }); if (App.paintStats) App.paintStats(); }
  /* ---------- header account menu: avatar button; the menu itself opens as a page-level popover so no header can clip it ---------- */
  function accountMenu(el, opts = {}) {
    if (!Auth.ready) { el.innerHTML = ''; return; }
    if (!Auth.user) {
      el.innerHTML = opts.landing ? `<span class="row gap-sm" style="flex-wrap:nowrap"><button class="btn sm primary" data-action="landing-signup">${icon('fire', 14)} Sign up free</button><button class="btn sm" data-action="landing-login">Log in</button></span>` : `<span class="row gap-sm" style="flex-wrap:nowrap"><button class="btn sm primary" data-action="landing-signup">Sign up</button><button class="btn sm" data-action="landing-login">Log in</button></span>`;
      bind(el, { 'landing-signup': () => Auth.open('signup'), 'landing-login': () => Auth.open('login') }); return;
    }
    const u = Auth.user; const name = u.name || u.email.split('@')[0]; const initial = name.trim()[0].toUpperCase();
    el.innerHTML = `<span class="acct-menu"><button class="acct-btn" data-action="acct-toggle" aria-haspopup="true" aria-expanded="false" title="Account menu"><span class="avatar sm">${esc(initial)}</span><span class="acct-btn-name">${esc(name)}</span>${icon('chevron', 12)}</button></span>`;
    bind(el, { 'acct-toggle': btn => {
      const unread = u.unread || 0;
      App.popover(btn, `<div class="acct-dd-head"><div class="acct-name">${esc(name)}</div><div class="acct-sub mono">${esc(u.email)}</div>${u.role || u.admin || u.mod ? `<div class="row gap-sm mt-1">${u.role ? `<span class="chip staff">${esc(u.role)}</span>` : ''}${u.admin ? '<span class="chip accent">administrator</span>' : u.mod ? '<span class="chip accent">moderator</span>' : ''}</div>` : ''}</div>
        <a class="acct-dd-item" href="${App.settingsLink ? App.settingsLink() : '#/settings'}">${icon('gear', 15)}<span>Account settings</span></a>
        <a class="acct-dd-item" href="#/badges">${icon('award', 15)}<span>Your badges</span></a>
        <a class="acct-dd-item" href="#/people">${icon('users', 15)}<span>People</span></a>
        ${Auth.mode === 'server' ? `<a class="acct-dd-item" href="${App.inboxLink ? App.inboxLink() : '#/forum/inbox'}">${icon('bell', 15)}<span>Inbox</span><b class="pill inbox-pill"${unread ? '' : ' hidden'}>${unread > 99 ? '99+' : unread}</b></a>` : ''}
        ${u.mod ? `<a class="acct-dd-item" href="#/admin">${icon('shield', 15)}<span>${u.admin ? 'Admin panel' : 'Moderation'}</span></a>` : ''}
        <div class="acct-dd-sep"></div>
        <button class="acct-dd-item" data-action="landing-logout" data-close>${icon('logout', 15)}<span>Log out</span></button>`,
        { 'landing-logout': () => { App.closePopover(); Auth.logout(); } }, { cls: 'pop-account' });
    } });
  }
  window.addEventListener('hashchange', () => { const top = $('#topbar-account'); if (top && Auth.ready) accountMenu(top); });   // links in the menu follow the current class
  Auth.accountMenu = accountMenu;
  Auth.paintLandingAccount = paintLandingAccount;
  function paintBanner() {
    let b = $('#preview-banner');
    if (Auth.user || !Auth.ready) { if (b) b.remove(); document.documentElement.classList.toggle('guest', !Auth.user && Auth.ready); return; }
    document.documentElement.classList.add('guest');
    if (!b) { b = document.createElement('div'); b.id = 'preview-banner'; b.className = 'preview-banner'; const main = $('.main'); const top = $('#topbar'); if (main && top) main.insertBefore(b, top.nextSibling); else document.body.prepend(b); }
    b.innerHTML = `<span>${icon('eye', 14)} <b>Preview.</b> Sign up with your montana.edu email to unlock every tool and keep your progress on all your devices.</span><span class="row gap-sm"><button class="btn xs primary" data-action="b-signup">Sign up</button><button class="btn xs ghost" data-action="b-login">Log in</button></span>`;
    bind(b, { 'b-signup': () => Auth.open('signup'), 'b-login': () => Auth.open('login') });
  }

  /* ---------- lock cards used by views ---------- */
  Auth.lockCard = function (title, text, opts = {}) {
    return `<div class="lock-card${opts.compact ? ' compact' : ''}"><div class="lock-icon">${icon('flag', 22)}</div><div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="row gap-sm mt-2"><button class="btn primary" data-action="auth-signup">${icon('fire', 14)} Sign up free</button><button class="btn" data-action="auth-login">Log in</button></div><p class="small muted mt-1">Free for anyone with a montana.edu email.</p></div></div>`;
  };
  Auth.bindLocks = function (root) { on(root, 'click', '[data-action="auth-signup"]', () => Auth.open('signup')); on(root, 'click', '[data-action="auth-login"]', () => Auth.open('login')); };
  Auth.renderLocked = function (root, V, view) {
    const D = App.D; const label = (() => { for (const gp of D.NAV) for (const it of gp.items) if (it[0] === view) return it[1]; return V.title; })();
    root.innerHTML = App.pageHead(label, V.blurb || 'This tool is part of the full MatHub experience.') + Auth.lockCard(`${label} is for members`, `Create a free account to use the ${label.toLowerCase()} for ${D.name} and every other ${D.short} tool, and to keep your progress across devices.`) + `<div class="grid cols-3 mt-3">${(V.preview || []).map(p => `<div class="card-link"><h4>${esc(p[0])}</h4><p>${esc(p[1])}</p></div>`).join('')}</div>`;
    Auth.bindLocks(root);
  };

  /* ---------- modal ---------- */
  const M = { state: 'login', email: '', busy: false };
  Auth.open = function (state) {
    M.state = state || 'login'; M.msg = '';
    if (Auth.user) { App.go('settings'); return; }
    let m = $('#auth-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'auth-modal'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) Auth.close(); }); }
    paintModal();
  };
  Auth.close = () => { const m = $('#auth-modal'); if (m) m.remove(); };
  function paintModal() {
    const m = $('#auth-modal'); if (!m) return;
    const offline = Auth.mode === 'offline';
    const tabs = ['login', 'signup'].map(t => `<button class="tab${M.state === t || (t === 'signup' && M.state === 'verify') || (t === 'login' && (M.state === 'forgot' || M.state === 'reset')) ? ' active' : ''}" data-action="tab" data-t="${t}">${t === 'login' ? 'Log in' : 'Sign up'}</button>`).join('');
    const email = `<div class="field"><label for="au-email">Montana State email</label><input class="input" id="au-email" type="email" name="email" autocomplete="username" placeholder="you@montana.edu" value="${esc(M.email)}" required></div>`;
    let body = '';
    if (offline) {
      body = `<div class="callout small mb-2"><b>Account server unreachable.</b> This happens when the site is opened as a file or the <code>api</code> folder is not on the server. You can still sign in locally: your progress stays in this browser only.</div>${email}<div class="field"><label for="au-name">Name (optional)</label><input class="input" id="au-name" type="text" autocomplete="name" placeholder="Your name"></div><button class="btn primary mt-2" type="submit" style="width:100%">Continue locally</button>`;
    } else if (M.state === 'signup') {
      body = `${email}<div class="field"><label for="au-name">Name (optional)</label><input class="input" id="au-name" type="text" autocomplete="name" placeholder="What should we call you?"></div><div class="field"><label for="au-pass">Password</label><input class="input" id="au-pass" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required></div><button class="btn primary mt-2" type="submit" style="width:100%">${icon('fire', 14)} Create account</button><p class="small muted mt-2">We email a 6-digit code to confirm the address. Only montana.edu addresses can join. By creating an account you agree to the <a href="#/policy" target="_blank">Terms of Use and Privacy Policy</a>.</p>`;
    } else if (M.state === 'verify') {
      body = `<p class="small mb-2">We sent a 6-digit code to <b>${esc(M.email)}</b>. Check spam if it does not arrive in a minute.</p><div class="field"><label for="au-code">Code</label><input class="input mono" id="au-code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="123456" required></div><button class="btn primary mt-2" type="submit" style="width:100%">${icon('check', 14)} Verify and log in</button><div class="row between mt-2"><button class="btn xs ghost" type="button" data-action="resend">Resend code</button><button class="btn xs ghost" type="button" data-action="tab" data-t="signup">Use a different email</button></div>`;
    } else if (M.state === 'forgot') {
      body = `<p class="small mb-2">Enter your email and we will send a reset code.</p>${email}<button class="btn primary mt-2" type="submit" style="width:100%">Email me a code</button><div class="row mt-2"><button class="btn xs ghost" type="button" data-action="tab" data-t="login">Back to log in</button></div>`;
    } else if (M.state === 'reset') {
      body = `<p class="small mb-2">Enter the code we sent to <b>${esc(M.email)}</b> and choose a new password.</p><div class="field"><label for="au-code">Code</label><input class="input mono" id="au-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required></div><div class="field"><label for="au-pass">New password</label><input class="input" id="au-pass" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn primary mt-2" type="submit" style="width:100%">Set password and log in</button><div class="row mt-2"><button class="btn xs ghost" type="button" data-action="resend-reset">Resend code</button></div>`;
    } else {
      body = `${email}<div class="field"><label for="au-pass">Password</label><input class="input" id="au-pass" type="password" autocomplete="current-password" required></div><button class="btn primary mt-2" type="submit" style="width:100%">Log in</button><div class="row between mt-2"><button class="btn xs ghost" type="button" data-action="tab" data-t="forgot">Forgot password?</button><span class="small muted">New here? <a href="#" data-action="tab" data-t="signup">Sign up</a></span></div>`;
    }
    m.innerHTML = `<div class="modal auth-modal" role="dialog" aria-label="Account"><div class="auth-head"><span class="logo-mark" aria-hidden="true">${App.logoSvg ? App.logoSvg(26) : ''}</span><div><b>MatHub</b><div class="small muted">Free study hub for MSU math and physics</div></div><button class="icon-btn" data-action="close" aria-label="Close">${icon('x', 16)}</button></div>${offline ? '' : `<div class="tabs auth-tabs">${tabs}</div>`}<form id="auth-form" novalidate>${body}<div class="auth-msg${M.msgKind ? ' ' + M.msgKind : ''}" id="auth-msg">${M.msg ? esc(M.msg) : ''}</div></form></div>`;
    bind(m, { close: Auth.close, tab: (el, e) => { e.preventDefault(); M.state = el.dataset.t; M.msg = ''; paintModal(); }, resend: () => submit('resend'), 'resend-reset': () => submit('forgot-again') });
    const form = $('#auth-form', m); form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    const first = $('#au-email', m) && !M.email ? $('#au-email', m) : ($('#au-code', m) || $('#au-pass', m) || $('#au-email', m)); if (first) setTimeout(() => first.focus(), 30);
  }
  function msg(text, kind) { M.msg = text; M.msgKind = kind || ''; const el = $('#auth-msg'); if (el) { el.textContent = text; el.className = 'auth-msg ' + (kind || ''); } }
  function busy(b) { M.busy = b; $$('#auth-form button, #auth-form input').forEach(x => x.disabled = b); }
  async function submit(action) {
    if (M.busy) return;
    const m = $('#auth-modal'); if (!m) return;
    const v = id => { const el = $('#' + id, m); return el ? el.value.trim() : ''; };
    const email = v('au-email') || M.email; if (v('au-email')) M.email = v('au-email').toLowerCase();
    if (Auth.mode === 'offline') {
      if (!Auth.emailOk(email)) return msg('MatHub is for Montana State students: use your @montana.edu address.', 'bad');
      const u = { email: email.toLowerCase(), name: v('au-name'), local: true, created: Date.now() }; writeJSON(LOCAL_KEY, u); Auth.user = u; Auth.close(); changed(); toast(`Welcome, ${u.name || u.email.split('@')[0]}. Progress is saved in this browser.`, 3000); App.rerender(); return;
    }
    try {
      busy(true);
      if (action === 'resend') { await call('resend', { email: M.email }); msg('A new code is on its way.', 'good'); }
      else if (action === 'forgot-again') { await call('forgot', { email: M.email }); msg('A new reset code is on its way.', 'good'); }
      else if (M.state === 'signup') {
        if (!Auth.emailOk(email)) throw new Error('MatHub is for Montana State students: use your @montana.edu address.');
        const r = await call('signup', { email, password: v('au-pass'), name: v('au-name') }); M.email = r.email || email; M.state = 'verify'; M.msg = ''; paintModal(); msg('Code sent. It expires in 15 minutes.', 'good');
      } else if (M.state === 'verify') { const r = await call('verify', { email: M.email, code: v('au-code') }); finishLogin(r.user, true); }
      else if (M.state === 'forgot') { await call('forgot', { email }); M.email = email; M.state = 'reset'; M.msg = ''; paintModal(); msg('If that address has an account, a code is on its way.', 'good'); }
      else if (M.state === 'reset') { const r = await call('reset', { email: M.email, code: v('au-code'), password: v('au-pass') }); finishLogin(r.user, false); }
      else { const r = await call('login', { email, password: v('au-pass') }); if (r.pending) { M.email = r.email || email; M.state = 'verify'; M.msg = ''; paintModal(); msg(r.message || 'Verify your email to continue.', 'warn'); } else finishLogin(r.user, false); }
    } catch (e) {
      if (e.data && e.data.exists) { M.state = 'login'; paintModal(); }
      msg(e.message, 'bad');
    } finally { busy(false); }
  }
  function finishLogin(user, isNew) {
    Auth.user = user; Auth.close(); changed();
    toast(isNew ? `Welcome to MatHub, ${user.name || user.email.split('@')[0]}!` : `Welcome back, ${user.name || user.email.split('@')[0]}.`, 2600);
    Auth.pullAll().then(() => App.rerender()).catch(() => App.rerender());
    if (App.rebuildNav) App.rebuildNav();
    setTimeout(() => Auth.onboard(isNew || !Array.isArray(user.courses)), 900);
  }
  Auth.logout = async function () {
    if (Auth.mode === 'server') { try { await call('logout', {}); } catch {} }
    else writeJSON(LOCAL_KEY, null);
    Auth.user = null; writeJSON(LAST_KEY, null); changed(); toast('Logged out'); if (App.rebuildNav) App.rebuildNav(); App.rerender();
  };

  /* ---------- settings panel ---------- */
  Auth.settingsPanel = function (root) {
    const u = Auth.user; const server = Auth.mode === 'server'; let html;
    if (u) {
      const name = u.name || u.email.split('@')[0]; const initial = name.trim()[0].toUpperCase(); const S = App.social;
      const badgeLine = S && S.badges ? `${S.badges.badges.length} of ${S.badges.catalog.length} earned` : server ? 'See what you have earned' : 'Needs the account server';
      html = `<div class="panel acct-panel">
        <div class="acct-hero"><div class="avatar big">${esc(initial)}</div><div class="acct-hero-body"><h2 class="acct-hero-name">${esc(name)}</h2><div class="mono small muted">${esc(u.email)}</div><div class="row gap-sm mt-1" style="flex-wrap:wrap">${u.role ? `<span class="chip staff">${esc(u.role)}</span>` : ''}${u.admin ? '<span class="chip accent">administrator</span>' : u.mod ? '<span class="chip accent">moderator</span>' : ''}<span class="chip ${server ? (Auth.unreachable ? 'warn' : 'good') : 'warn'}">${server ? (Auth.unreachable ? 'offline · will sync' : 'synced across devices') : 'local browser only'}</span>${u.created ? `<span class="chip">member since ${esc(App.fmtDate(App.toISO(new Date(u.created * 1000))))}</span>` : ''}</div></div></div>
        <div class="link-tiles">
          <a class="link-tile gold" href="#/badges"><span class="tile-ic">${icon('award', 20)}</span><span class="tile-body"><b>Your badges</b><small id="acct-badge-count">${badgeLine}</small></span>${icon('right', 14)}</a>
          <a class="link-tile" href="#/people"><span class="tile-ic">${icon('users', 20)}</span><span class="tile-body"><b>People</b><small>Classmates and their badges</small></span>${icon('right', 14)}</a>
          ${server ? `<a class="link-tile" href="${App.inboxLink ? App.inboxLink() : '#/forum/inbox'}"><span class="tile-ic">${icon('bell', 20)}</span><span class="tile-body"><b>Inbox</b><small>${u.unread ? `${u.unread} unread ${u.unread === 1 ? 'reply' : 'replies'}` : 'Replies to your posts'}</small></span>${icon('right', 14)}</a>` : ''}
          ${u.mod ? `<a class="link-tile" href="#/admin"><span class="tile-ic">${icon('shield', 20)}</span><span class="tile-body"><b>${u.admin ? 'Admin panel' : 'Moderation'}</b><small>Members, reports and site settings</small></span>${icon('right', 14)}</a>` : ''}
        </div>
        <div class="acct-sections">
          <section><div class="eyebrow mb-1">Profile</div><div class="field"><label for="acct-name">Display name</label><div class="row gap-sm"><input class="input" id="acct-name" value="${esc(u.name || '')}" placeholder="Your name" maxlength="40" style="max-width:260px"><button class="btn sm" data-action="save-name">Save</button></div><span class="help">Shown on your posts, on leaderboards and on the People page.</span></div></section>
          ${server ? `<section><div class="eyebrow mb-1">Email me</div>
            <label class="check"><input type="checkbox" id="acct-notify" ${u.notify_email === false ? '' : 'checked'}><span>When someone replies to my posts or comments <span class="muted small">(at most one email per post every few hours)</span></span></label>
            <label class="check"><input type="checkbox" id="acct-reminder" ${u.reminder_email ? 'checked' : ''}><span>The evening before something is due <span class="muted small">(6 pm: tomorrow's Canvas due dates, sessions you joined, and a heads-up if your streak is about to end)</span></span></label>
            <label class="check"><input type="checkbox" id="acct-digest" ${u.digest_email === false ? '' : 'checked'}><span>The weekly digest <span class="muted small">(Sunday evening: what is due, top posts, your stats vs. the class)</span></span></label></section>
          <section><div class="eyebrow mb-1">Privacy</div>
            <label class="check"><input type="checkbox" id="acct-lb" ${u.show_on_leaderboard === false ? '' : 'checked'}><span>Show my name on leaderboards, helper lists and the People page <span class="muted small">(otherwise you appear as “Anonymous student”)</span></span></label></section>` : ''}
        </div>
        <div class="divider"></div>
        <div class="row gap-sm" style="flex-wrap:wrap">${server ? `<button class="btn sm" data-action="sync-now">${icon('rotate', 13)} Sync now</button><button class="btn sm" data-action="change-pass">${icon('lock', 13)} Change password</button>` : ''}<button class="btn sm" data-action="logout">${icon('logout', 13)} Log out</button><span style="flex:1"></span><button class="btn sm danger ghost" data-action="delete-acct">${icon('trash', 13)} Delete account</button></div>
        <p class="small muted mt-2">${server ? 'Quiz history, flashcard boxes, checklists and grades are saved to your account a moment after each change and load on any device where you log in.' : 'The account server is unreachable, so nothing leaves this browser.'}</p></div>`;
    } else {
      html = `<div class="panel acct-panel"><div class="panel-h"><div class="panel-title">${icon('user')} Account</div><span class="chip warn">preview</span></div>${Auth.lockCard('You are previewing MatHub', 'Sign up with your montana.edu email to unlock every tool, collect badges, join the People page and sync your progress across devices.', { compact: true })}</div>`;
    }
    const wrap = document.createElement('div'); wrap.innerHTML = html; const panel = wrap.firstElementChild;
    const pref = (id, key, onMsg, offMsg) => { const el = $('#' + id, panel); if (el) el.addEventListener('change', async () => { try { const r = await call('profile', { [key]: el.checked }); Auth.user = Object.assign(Auth.user, r.user); toast(el.checked ? onMsg : offMsg); } catch (e) { toast(e.message); el.checked = !el.checked; } }); };
    pref('acct-notify', 'notify_email', 'Reply emails on', 'Reply emails off'); pref('acct-reminder', 'reminder_email', 'Evening reminders on', 'Evening reminders off'); pref('acct-digest', 'digest_email', 'Weekly digest on', 'Weekly digest off'); pref('acct-lb', 'show_on_leaderboard', 'Your name shows on leaderboards and the People page', 'You appear as “Anonymous student”');
    if (u && server && App.social && App.social.refreshBadges) App.social.refreshBadges().then(r => { const el = $('#acct-badge-count', panel); if (el && r) el.textContent = `${r.badges.length} of ${r.catalog.length} earned`; }).catch(() => {});
    bind(panel, {
      'auth-signup': () => Auth.open('signup'), 'auth-login': () => Auth.open('login'), logout: () => Auth.logout(),
      'save-name': async () => { const name = $('#acct-name', panel).value.trim(); if (Auth.mode === 'server') { try { const r = await call('profile', { name }); Auth.user = r.user; } catch (e) { toast(e.message); return; } } else { Auth.user.name = name; writeJSON(LOCAL_KEY, Auth.user); } changed(); toast('Name saved'); const h = $('.acct-hero-name', panel); if (h) h.textContent = name || Auth.user.email.split('@')[0]; },
      'sync-now': async () => { try { for (const id of Object.keys(global.Courses)) await Auth.pushCourse(id); await Auth.pullAll(); toast('Everything is synced'); } catch (e) { toast(e.message); } },
      'change-pass': async () => { try { await call('forgot', { email: u.email }); M.email = u.email; M.state = 'reset'; const wasUser = Auth.user; Auth.user = null; Auth.open('reset'); Auth.user = wasUser; msg('We emailed you a code. Enter it with your new password.', 'good'); } catch (e) { toast(e.message); } },
      'delete-acct': async () => {
        if (!confirm('Delete your MatHub account and everything saved to it? This cannot be undone.')) return;
        if (Auth.mode === 'server') { const pass = prompt('Confirm with your password:'); if (pass === null) return; try { await call('account_delete', { password: pass }); } catch (e) { toast(e.message); return; } }
        else writeJSON(LOCAL_KEY, null);
        Auth.user = null; changed(); toast('Account deleted'); App.go('dashboard');
      }
    });
    return panel;
  };

  document.addEventListener('DOMContentLoaded', () => { Auth.init(); });
})(window);
