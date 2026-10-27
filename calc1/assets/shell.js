/* ============================================================
   Mathub — the frame on every page of the website
   The sidebar and the header used to belong to class pages only;
   now every page has them (the iOS and Android apps keep their own
   frame, assets/app-native.js, and the faculty workspace its own).
   Sidebar, top to bottom:
   - Bo and the wordmark, and a button that tucks the sidebar away
   - Now: the date, a live clock, and how far through the semester,
     the month and the week you are
   - New: one button for the quick-add dialog and six shortcuts
   - the class you are in (its own pages, unchanged: app.js)
   - Home, Today, Ask Bo; Your classes (pages outside a class);
     School, Life, Future and Explore, each folding away
   - a month calendar with a dot on every day something is due
   - the account and the pomodoro (unchanged)
   Header: the page's place ("School › Timetable"), the next exam
   (the class's, or the soonest of all your classes), a clock that
   opens a bigger clock with the time back home, then search, sounds,
   theme and the account as before.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, settings, setSetting } = App;
  const Courses = global.Courses;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const Life = () => App.life;
  const native = () => !!(document.documentElement.dataset.app || (global.MATHUB_APP && global.MATHUB_APP.native));

  /* ---------- what lives where ---------- */
  const TOP = [['home', '#/', 'Home', 'home'], ['today', '#/today', 'Today', 'flag'], ['tutor', '#/tutor', 'Ask Bo', 'bo']];
  const GROUPS = [
    { id: 'school', label: 'School', items: [['tasks', 'Tasks', 'todo'], ['timetable', 'Timetable', 'table'], ['agenda', 'Calendar', 'calendar'], ['timelog', 'Time tracker', 'timer'], ['projects', 'Projects & thesis', 'folder'], ['focus', 'Focus room', 'clock'], ['gpa', 'GPA calculator', 'calc']] },
    { id: 'office', label: 'Office', items: [['docs', 'Docs', 'docpage'], ['decks', 'Slides', 'present'], ['sheets', 'Sheets', 'grid3']] },
    { id: 'life', label: 'Life', items: [['habits', 'Habits', 'repeat'], ['goals', 'Goals', 'target'], ['wheel', 'Wheel of life', 'wheel'], ['journal', 'Journal', 'note'], ['money', 'Money', 'wallet']] },
    { id: 'future', label: 'Future', items: [['career', 'Internships & jobs', 'briefcase'], ['portfolio', 'Portfolio', 'star']] },
    { id: 'explore', label: 'Explore', items: [['resources', 'Resources', 'link'], ['guides', 'Study guides', 'book'], ['tools', 'Tools', 'sliders'], ['forum', 'Discussions', 'chat'], ['leagues', 'Leagues', 'gem'], ['badges', 'Badges', 'award'], ['whatsnew', 'What’s new', 'zap']] }
  ];
  const PLACE = {}; GROUPS.forEach(g => g.items.forEach(([v, l]) => { PLACE[v] = [g.label, l]; }));
  Object.assign(PLACE, { home: [null, 'Home'], today: [null, 'Today'], tutor: [null, 'Ask Bo'], settings: [null, 'Settings'], contact: [null, 'Contact'], policy: [null, 'Terms & privacy'], plan: [null, 'Your plan'], calls: [null, 'Usage'], usage: [null, 'Usage'], create: [null, 'Create a class'], request: [null, 'Request a class'], people: ['Explore', 'People'], recap: [null, 'Your week'], sheet: [null, 'Character sheet'], mistakes: ['School', 'Mistakes'], challenge: ['Explore', 'Daily challenge'], admin: [null, 'Admin'], class: [null, 'Join a class'], c: [null, 'A shared class'], join: [null, 'Join a classmate'], notfound: [null, 'Page not found'] });
  App.shellGroups = GROUPS;

  const route = () => { const raw = location.hash.replace(/^#\/?/, '').split('?')[0]; const parts = raw.split('/').filter(Boolean); if (!parts.length) return { course: null, view: 'home' }; if (Courses[parts[0]]) return { course: parts[0], view: parts[1] || 'dashboard' }; return { course: null, view: parts[0] }; };
  const navOpen = () => settings().navOpen || {};
  const groupOpen = (id, dflt) => { const m = navOpen(); const k = 'g:' + id; return m[k] === undefined ? dflt : !!m[k]; };

  /* ---------- the clocks ---------- */
  const pct = (a, b, x) => Math.max(0, Math.min(100, Math.round(((x - a) / Math.max(1, b - a)) * 100)));
  function progress() {
    const iso = App.todayISO(); const d = App.parseISO(iso); const n = new Date(); const day = new Date(d.getFullYear(), d.getMonth(), d.getDate(), n.getHours(), n.getMinutes()).getTime();
    const r = route(); const ids = App.myCourses().filter(id => Courses[id] && Courses[id].SEMESTER); const C = r.course && Courses[r.course] && Courses[r.course].SEMESTER ? Courses[r.course] : ids.length ? Courses[ids[0]] : null;
    const out = [];
    if (C && iso >= C.SEMESTER.start && iso <= C.SEMESTER.end) { const a = App.parseISO(C.SEMESTER.start).getTime(), b = App.parseISO(C.SEMESTER.end).getTime() + 86400000; const wk = Math.floor(App.daysBetween(C.SEMESTER.start, iso) / 7) + 1, wks = Math.floor(App.daysBetween(C.SEMESTER.start, C.SEMESTER.end) / 7) + 1; out.push({ k: 'sem', label: t('Week {1} of {2}', wk, wks), sub: t('Semester'), p: pct(a, b, day) }); }
    else { const a = new Date(d.getFullYear(), 0, 1).getTime(), b = new Date(d.getFullYear() + 1, 0, 1).getTime(); out.push({ k: 'year', label: String(d.getFullYear()), sub: t('Year'), p: pct(a, b, day) }); }
    { const a = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), b = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); out.push({ k: 'month', label: Life().monthName(d.getMonth()), sub: t('Month'), p: pct(a, b, day) }); }
    { const ws = App.parseISO(Life().weekStart(iso)).getTime(); out.push({ k: 'week', label: t('This week'), sub: t('Week'), p: pct(ws, ws + 7 * 86400000, day) }); }
    return out;
  }
  App.timeProgress = progress;
  const clockTxt = (d = new Date(), tz) => { try { return d.toLocaleTimeString(App.lang === 'en' ? 'en-US' : App.lang, Object.assign({ hour: 'numeric', minute: '2-digit' }, tz ? { timeZone: tz } : {})); } catch (e) { return d.toLocaleTimeString(); } };
  const dateTxt = (d, opts) => { try { return d.toLocaleDateString(App.lang === 'en' ? 'en-US' : App.lang, opts); } catch (e) { return d.toDateString(); } };
  // an analog clock face; the hands are set by tickClocks()
  App.clockFace = (size = 120, cls = '') => {
    const ticks = Array.from({ length: 60 }, (_, i) => { const a = i * 6 * Math.PI / 180; const r1 = i % 5 ? 44 : 40, r2 = 47; return `<line x1="${(50 + r1 * Math.sin(a)).toFixed(2)}" y1="${(50 - r1 * Math.cos(a)).toFixed(2)}" x2="${(50 + r2 * Math.sin(a)).toFixed(2)}" y2="${(50 - r2 * Math.cos(a)).toFixed(2)}" class="${i % 5 ? 'ck-min' : 'ck-hr'}"/>`; }).join('');
    const nums = [12, 3, 6, 9].map((n, i) => { const a = i * 90 * Math.PI / 180; return `<text x="${(50 + 32 * Math.sin(a)).toFixed(1)}" y="${(50 - 32 * Math.cos(a) + 4.2).toFixed(1)}">${n}</text>`; }).join('');
    return `<svg class="ck-face ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(t('Clock'))}"><circle cx="50" cy="50" r="48" class="ck-rim"/>${ticks}${nums}<line x1="50" y1="50" x2="50" y2="27" class="ck-h" data-hand="h"/><line x1="50" y1="54" x2="50" y2="17" class="ck-m" data-hand="m"/><line x1="50" y1="58" x2="50" y2="12" class="ck-s" data-hand="s"/><circle cx="50" cy="50" r="3" class="ck-pin"/></svg>`;
  };
  function setHands(svg, d) {
    const tz = svg.dataset.tz; let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    if (tz) { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(d); const g = k => +((p.find(x => x.type === k) || {}).value || 0); h = g('hour') % 24; m = g('minute'); s = g('second'); } catch (e) {} }
    const rot = (el, deg) => { if (el) el.setAttribute('transform', `rotate(${deg.toFixed(2)} 50 50)`); };
    rot(svg.querySelector('[data-hand="h"]'), (h % 12) * 30 + m * 0.5); rot(svg.querySelector('[data-hand="m"]'), m * 6 + s * 0.1); rot(svg.querySelector('[data-hand="s"]'), s * 6);
  }
  function tickClocks() {
    const d = new Date(); $$('svg.ck-face').forEach(svg => setHands(svg, d));
    $$('[data-clock]').forEach(el => { const tz = el.dataset.clock || undefined; const v = clockTxt(d, tz); if (el.textContent !== v) el.textContent = v; });
  }
  App.tickClocks = tickClocks;

  /* home time: the clock back home, for students far from it */
  const ZONES = [['America/Los_Angeles', 'Los Angeles'], ['America/Denver', 'Bozeman'], ['America/Chicago', 'Chicago'], ['America/New_York', 'New York'], ['America/Mexico_City', 'Mexico City'], ['America/Bogota', 'Bogotá'], ['America/Sao_Paulo', 'São Paulo'], ['America/Argentina/Buenos_Aires', 'Buenos Aires'], ['Europe/London', 'London'], ['Europe/Madrid', 'Madrid'], ['Europe/Paris', 'Paris'], ['Europe/Berlin', 'Berlin'], ['Europe/Rome', 'Rome'], ['Europe/Lisbon', 'Lisbon'], ['Europe/Kyiv', 'Kyiv'], ['Europe/Moscow', 'Moscow'], ['Asia/Tbilisi', 'Tbilisi'], ['Asia/Yerevan', 'Yerevan'], ['Asia/Baku', 'Baku'], ['Europe/Istanbul', 'Istanbul'], ['Asia/Dubai', 'Dubai'], ['Africa/Lagos', 'Lagos'], ['Africa/Nairobi', 'Nairobi'], ['Asia/Kolkata', 'Delhi'], ['Asia/Dhaka', 'Dhaka'], ['Asia/Kathmandu', 'Kathmandu'], ['Asia/Almaty', 'Almaty'], ['Asia/Bangkok', 'Bangkok'], ['Asia/Shanghai', 'Beijing'], ['Asia/Seoul', 'Seoul'], ['Asia/Tokyo', 'Tokyo'], ['Asia/Manila', 'Manila'], ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland'], ['Pacific/Honolulu', 'Honolulu']];
  App.homeZones = ZONES;
  const homeZone = () => { const z = Life() ? Life().cfg('homeZone', '') : ''; if (!z) return null; const f = ZONES.find(x => x[0] === z); return { tz: z, label: (Life().cfg('homeLabel', '') || (f ? f[1] : z.split('/').pop().replace(/_/g, ' '))) }; };
  App.homeZone = homeZone;
  const offsetTxt = tz => { try { const d = new Date(); const here = new Date(d.toLocaleString('en-US')); const there = new Date(d.toLocaleString('en-US', { timeZone: tz })); const h = Math.round((there - here) / 360000) / 10; return h === 0 ? t('same time as here') : h > 0 ? t('{1} h ahead', h) : t('{1} h behind', -h); } catch (e) { return ''; } };
  App.zoneOffset = offsetTxt;

  /* ---------- sidebar ---------- */
  function barsHtml() { return progress().map(b => `<div class="sb-bar" data-k="${b.k}"><div class="sb-bar-row"><span>${esc(b.label)}</span><b>${b.p}%</b></div><div class="sb-track" role="progressbar" aria-label="${esc(b.sub)}: ${esc(b.label)}" aria-valuenow="${b.p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${b.p}%"></i></div></div>`).join(''); }
  function paintNow() {
    const el = $('#sb-now'); if (!el) return; const d = App.parseISO(App.todayISO());
    const hz = homeZone();
    el.innerHTML = `<div class="sb-now-top"><div><div class="sb-date">${esc(dateTxt(d, { weekday: 'short', month: 'short', day: 'numeric' }))}</div>${hz ? `<div class="sb-home">${icon('globe', 12)} ${esc(hz.label)} <span data-clock="${esc(hz.tz)}">${esc(clockTxt(new Date(), hz.tz))}</span></div>` : ''}</div><button class="sb-time" type="button" data-action="clock" aria-haspopup="dialog" title="${esc(t('Open the clock'))}"><span data-clock="">${esc(clockTxt())}</span><span class="sr-only">, ${esc(t('Open the clock'))}</span></button></div><div class="sb-bars">${barsHtml()}</div>`;
  }
  function paintQuick() {
    const el = $('#sb-quick'); if (!el || el.dataset.done) return; el.dataset.done = '1';
    const keys = ['task', 'assignment', 'exam', 'event', 'todo', 'slot'];
    el.innerHTML = `<button class="btn primary sb-new" type="button" data-qa="task" aria-keyshortcuts="Alt+N" title="${esc(t('Add anything: a task, an exam, an event… (Alt+N)'))}">${icon('plus', 15)} ${esc(t('New'))}</button><div class="sb-qa" role="group" aria-label="${esc(t('Quick add'))}">${keys.map(k => { const q = Life().QA.find(x => x[0] === k); return `<button type="button" class="sb-qa-btn" data-qa="${k}" title="${esc(t('New {1}', t(q[1]).toLowerCase()))}">${icon(q[2], 15)}<span>${esc(t(q[1]))}</span></button>`; }).join('')}</div>`;
  }
  const boIc = () => (App.logoSvg ? App.logoSvg(16) : icon('chat'));
  function counts() {
    const L = Life(); if (!L) return {}; const iso = App.todayISO(); const end = L.addDaysISO(iso, 6);
    const due = L.all('tasks').filter(x => x.status !== 'done' && x.due && x.due <= end).length;
    const habits = L.all('habits').filter(h => !h.archived && !(h.log || {})[iso]).length;
    return { tasks: due, habits };
  }
  function paintNav() {
    const el = $('#sb-nav'); if (!el) return; const r = route(); const inClass = !!r.course; const c = counts();
    const item = (v, href, label, ic, n) => `<a class="nav-item sb-item${!inClass && r.view === v ? ' active' : ''}" href="${href}" data-sv="${v}"${!inClass && r.view === v ? ' aria-current="page"' : ''}>${ic === 'bo' ? `<span class="sb-bo">${boIc()}</span>` : icon(ic)}<span>${esc(t(label))}</span>${n ? `<b class="sb-count">${n}</b>` : ''}</a>`;
    let h = `<div class="sb-top-items">${TOP.map(([v, href, l, ic]) => item(v, href, l, ic, v === 'today' && c.tasks ? c.tasks : 0)).join('')}</div>`;
    if (!inClass) {
      const ids = App.myCourses().filter(id => Courses[id]); const o = groupOpen('classes', true);
      const rows = ids.map(id => { const C = Courses[id]; let ex = null; try { ex = App.nextExamOf(C); } catch (e) {} const n = ex && ex.date ? App.daysBetween(App.todayISO(), ex.date) : null; return `<a class="nav-item sb-class" style="${Life().ccStyle(id)}" href="#/${esc(id)}/dashboard" title="${esc(C.name)}"><i class="sb-dot"></i><span>${esc(C.short)}</span>${n != null && n >= 0 && n <= 14 ? `<b class="sb-exam${n <= 3 ? ' soon' : ''}" title="${esc(ex.name)}">${n === 0 ? esc(t('today')) : esc(t('{1}d', n))}</b>` : ''}</a>`; }).join('');
      // administrators add classes; everyone else asks for one (assets/requests.js)
      const add = App.canMakeClasses && App.canMakeClasses() ? `<a class="nav-item sb-add" href="#/create">${icon('plus')}<span>${esc(t('Add a class'))}</span></a>` : App.views.request ? `<a class="nav-item sb-add" href="#/request">${icon('path')}<span>${esc(t('Request a class'))}</span></a>` : '';
      h += group('classes', t('Your classes'), ids.length, o, rows + add);
    }
    GROUPS.forEach(g => {
      const items = g.items.filter(([v]) => App.views[v]); if (!items.length) return;
      const has = !inClass && items.some(([v]) => v === r.view); const o = has || groupOpen(g.id, !inClass && g.id !== 'explore');
      h += group(g.id, t(g.label), items.length, o, items.map(([v, l, ic]) => item(v, '#/' + v, l, ic, v === 'tasks' ? c.tasks : v === 'habits' ? c.habits : 0)).join(''));
    });
    if (!inClass && App.auth && App.auth.user && App.auth.user.mod) h += `<div class="sb-top-items">${item('admin', '#/admin', App.auth.user.admin ? 'Admin panel' : 'Moderation', 'shield')}</div>`;
    el.innerHTML = h;
  }
  function group(id, label, n, open, inner) { return `<div class="sb-group" data-g="${id}"><button class="nav-label nav-toggle sb-toggle${open ? ' open' : ''}" type="button" data-sg="${id}" aria-expanded="${open}"><span>${esc(label)}</span><small>${n}</small>${icon('chevron', 12)}</button><div class="nav-group${open ? '' : ' closed'}"><div class="nav-group-in">${inner}</div></div></div>`; }

  /* the month calendar */
  let calOff = 0;
  function paintCal() {
    const el = $('#sb-cal'); if (!el) return; const L = Life(); const iso = App.todayISO(); const base = App.parseISO(iso);
    const m0 = new Date(base.getFullYear(), base.getMonth() + calOff, 1); const y = m0.getFullYear(), mo = m0.getMonth();
    const first = App.toISO(m0); const last = App.toISO(new Date(y, mo + 1, 0));
    const ws = L.cfg('weekStart', 1); const lead = (m0.getDay() - ws + 7) % 7; const start = L.addDaysISO(first, -lead);
    const items = L.items(start, L.addDaysISO(start, 41)); const by = {}; items.forEach(x => { if (x.kind === 'holiday' || x.kind === 'note') return; (by[x.date] = by[x.date] || []).push(x); });
    const open = groupOpen('cal', true);
    const heads = Array.from({ length: 7 }, (_, i) => `<span>${esc(t(L.DOW[(ws + i) % 7]).slice(0, 2))}</span>`).join('');
    let cells = ''; for (let i = 0; i < 42; i++) { const d = L.addDaysISO(start, i); const dd = App.parseISO(d); const list = by[d] || []; const exam = list.some(x => x.kind === 'exam'); const due = list.filter(x => !x.done).length;
      if (i >= 35 && d > last) break;
      cells += `<a class="sb-day${d.slice(0, 7) !== first.slice(0, 7) ? ' out' : ''}${d === iso ? ' today' : ''}${exam ? ' exam' : ''}" href="#/agenda?d=${d}" title="${esc(App.fmtDate(d, true))}${list.length ? ' · ' + esc(list.slice(0, 3).map(x => x.title).join(', ')) + (list.length > 3 ? '…' : '') : ''}"><span>${dd.getDate()}</span>${due ? `<i class="${exam ? 'ex' : ''}"></i>` : ''}</a>`; }
    el.innerHTML = `<div class="sb-cal-h"><button class="sb-toggle-cal nav-toggle${open ? ' open' : ''}" type="button" data-sg="cal" aria-expanded="${open}">${icon('chevron', 12)}<span>${esc(L.monthName(mo))} ${y}</span></button><span class="sb-cal-nav"><button class="icon-btn xs" type="button" data-cal="-1" aria-label="${esc(t('Previous month'))}">${icon('left', 12)}</button><button class="icon-btn xs" type="button" data-cal="0" aria-label="${esc(t('This month'))}" ${calOff ? '' : 'hidden'}>${icon('target', 12)}</button><button class="icon-btn xs" type="button" data-cal="1" aria-label="${esc(t('Next month'))}">${icon('right', 12)}</button></span></div><div class="nav-group${open ? '' : ' closed'}"><div class="nav-group-in"><div class="sb-grid" role="group" aria-label="${esc(L.monthName(mo))} ${y}"><div class="sb-heads" aria-hidden="true">${heads}</div><div class="sb-days">${cells}</div></div></div></div>`;
  }

  function paintSidebar() { if (native() || !$('#sb-nav')) return; paintNow(); paintQuick(); paintNav(); paintCal(); }
  App.paintSidebar = paintSidebar;

  /* ---------- header ---------- */
  function paintTop() {
    if (native()) return; const r = route(); const top = $('#topbar'); if (!top) return;
    // the clock in the header
    const acts = $('#topbar .topbar-actions'); if (acts && !$('#tb-clock')) { const b = document.createElement('button'); b.id = 'tb-clock'; b.className = 'tb-clock'; b.type = 'button'; b.dataset.action = 'clock'; b.setAttribute('aria-haspopup', 'dialog'); b.title = t('Open the clock'); b.innerHTML = `${icon('clock', 14)}<span data-clock="">${esc(clockTxt())}</span><span class="sr-only">, ${esc(t('Open the clock'))}</span>`; const s = $('.search-btn', acts); acts.insertBefore(b, s || null); }
    if (r.course) return;   // a class page writes its own title and exam (app.js)
    const p = PLACE[r.view] || [null, (App.views[r.view] && App.views[r.view].title) || 'Mathub'];
    $('#topbar-title').innerHTML = `${p[0] ? `<span class="crumb">${esc(t(p[0]))}</span><span class="crumb-sep">›</span>` : ''}<span class="crumb-cur">${esc(t(p[1]))}</span>`;
    // the soonest exam across your classes
    const chip = $('#exam-chip'); if (chip) {
      let best = null; App.myCourses().forEach(id => { const C = Courses[id]; if (!C || !C.EXAMS) return; let ex = null; try { ex = App.nextExamOf(C); } catch (e) {} if (ex && (!best || ex.date < best.ex.date)) best = { id, C, ex }; });
      if (best) { const st = App.examStatus(best.ex); chip.hidden = false; chip.dataset.href = `#/${best.id}/dashboard`; chip.title = `${best.C.name} · ${best.ex.name}`; chip.innerHTML = `${icon('flag', 14)} <span>${esc(best.C.short)} ${esc(best.ex.name)} ·</span> <b>${esc(st.chip)}</b>`; }
      else { chip.hidden = true; delete chip.dataset.href; }
    }
  }
  function openClock(anchor) {
    if (!App.popover) return; const hz = homeZone(); const d = new Date(); const L = Life();
    const zones = ZONES.map(([z, l]) => `<option value="${esc(z)}"${hz && hz.tz === z ? ' selected' : ''}>${esc(l)}</option>`).join('');
    const pop = App.popover(anchor, `<div class="ck-pop"><div class="ck-pop-faces"><div class="ck-one">${App.clockFace(132)}<b data-clock="">${esc(clockTxt(d))}</b><small>${esc(t('Here'))}</small></div>${hz ? `<div class="ck-one home">${App.clockFace(96, 'small').replace('<svg ', `<svg data-tz="${esc(hz.tz)}" `)}<b data-clock="${esc(hz.tz)}">${esc(clockTxt(d, hz.tz))}</b><small>${esc(hz.label)} · ${esc(offsetTxt(hz.tz))}</small></div>` : ''}</div>
      <div class="ck-date">${esc(dateTxt(App.parseISO(App.todayISO()), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</div>
      <div class="sb-bars ck-bars">${barsHtml()}</div>
      <label class="ck-zone"><span>${icon('globe', 14)} ${esc(t('Time back home'))}</span><select data-zone><option value="">${esc(t('Not shown'))}</option>${zones}</select></label>
      <div class="ck-links"><a class="btn sm" href="#/timetable">${icon('table', 13)} ${esc(t('Timetable'))}</a><a class="btn sm" href="#/focus">${icon('clock', 13)} ${esc(t('Focus room'))}</a></div></div>`, {}, { cls: 'pop-clock' });
    if (!pop) return; tickClocks();
    const sel = $('[data-zone]', pop); if (sel) sel.addEventListener('change', () => { L.setCfg('homeZone', sel.value); L.setCfg('homeLabel', ''); App.closePopover(); paintNow(); openClock(anchor); });
  }

  /* ---------- wiring ---------- */
  function wire() {
    const side = $('#sidebar'); if (!side || side.__shell) return; side.__shell = true;
    side.addEventListener('click', e => {
      const qa = e.target.closest('[data-qa]'); if (qa) { e.preventDefault(); closeDrawer(); App.quickAdd(qa.dataset.qa); return; }
      const sg = e.target.closest('[data-sg]'); if (sg) { const m = Object.assign({}, navOpen()); const k = 'g:' + sg.dataset.sg; const now = sg.classList.contains('open'); m[k] = !now; setSetting('navOpen', m); sg.classList.toggle('open', !now); sg.setAttribute('aria-expanded', String(!now)); const g = sg.dataset.sg === 'cal' ? sg.closest('#sb-cal').querySelector('.nav-group') : sg.nextElementSibling; if (g) g.classList.toggle('closed', now); return; }
      const cal = e.target.closest('[data-cal]'); if (cal) { calOff = +cal.dataset.cal === 0 ? 0 : calOff + +cal.dataset.cal; paintCal(); return; }
      const ck = e.target.closest('[data-action="clock"]'); if (ck) { openClock(ck); return; }
      if (e.target.closest('a.nav-item, a.sb-day')) closeDrawer();
    });
    const top = $('#topbar'); if (top) top.addEventListener('click', e => { const ck = e.target.closest('[data-action="clock"]'); if (ck) openClock(ck); });
    const hide = $('#sb-hide'); if (hide) hide.addEventListener('click', () => { setSetting('sideHidden', true); applyHidden(); if (App.toast) App.toast(t('The sidebar is hidden. The menu button at the top left brings it back.'), 4000); const m = $('#topbar .menu-btn'); if (m) m.focus(); });
  }
  function closeDrawer() { const app = $('.app'); if (app) app.classList.remove('nav-open'); }
  function applyHidden() {
    const app = $('.app'); if (!app) return; const off = !!settings().sideHidden && innerWidth > 900; app.classList.toggle('side-hidden', off);
    const m = $('#topbar .menu-btn'); if (m) { const l = off ? t('Show the sidebar') : t('Menu'); m.setAttribute('aria-label', l); m.title = off ? l : ''; }
  }
  App.toggleSidebar = () => { const app = $('.app'); if (!app) return; if (innerWidth <= 900) { app.classList.toggle('nav-open'); return; } setSetting('sideHidden', !settings().sideHidden); applyHidden(); };
  App.shellApplyHidden = applyHidden;

  App.onRender = App.onRender || [];
  App.onRender.push(() => { if (native()) return; wire(); applyHidden(); paintTop(); paintSidebar(); });
  document.addEventListener('DOMContentLoaded', () => {
    if (native()) return;
    if (Life()) Life().onChange(() => { clearTimeout(paintSidebar.t); paintSidebar.t = setTimeout(() => { paintNav(); paintCal(); }, 120); });
    if (App.auth && App.auth.onChange) App.auth.onChange(() => setTimeout(() => { paintNav(); paintCal(); }, 50));
    window.addEventListener('resize', () => { clearTimeout(applyHidden.t); applyHidden.t = setTimeout(applyHidden, 150); });
    tickClocks(); setInterval(tickClocks, 1000);
    let day = App.todayISO(); setInterval(() => { const now = App.todayISO(); if (now !== day) { day = now; paintSidebar(); } else if (document.visibilityState === 'visible') { const b = $('#sb-now .sb-bars'); if (b) b.innerHTML = barsHtml(); } }, 60000);
  });
})(window);
