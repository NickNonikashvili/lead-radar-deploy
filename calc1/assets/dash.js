/* ============================================================
   StudyCat — your home: a dashboard of widgets you arrange yourself (the website's start page)
   - Widgets: Up next (the class you picked: its next exam, how ready you are, the next lesson), Today across your
     classes, Bo, your classes, today's schedule, what is due, this week, the clock, the pomodoro, to-dos, reminders,
     habits, goals, the wheel of life, the latest discussions, study guides, where you left off, and a note.
   - Arrange: drag a widget by its handle anywhere, resize it from its corner, let widgets overlap and bring one to
     the front or send it to the back, add and remove widgets, tidy them into a grid, or go back to the start. The
     grip works with the keyboard too (arrows move, Shift with the arrows resizes). The layout is saved with the
     account (settings.homeLayout, synced): 12 columns wide, rows of ROW pixels.
   - On a narrow screen the widgets stack in reading order (top to bottom, left to right); Arrange moves them up
     and down there.
   Data: assets/life.js, assets/home.js and the classes. Used by the start page in assets/app.js.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const L = App && App.life; if (!App || !L) return;
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const Courses = global.Courses;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const tIso = () => L.today();
  const card = (id, title, ic, href, body, extra = '') => `<section class="panel dw dwc-${id}" data-w="${id}" aria-labelledby="dw-${id}-t"><div class="dw-h"><button type="button" class="dw-grip" data-dwg="${id}" aria-label="${esc(t('Move {1}', t(title)))}" aria-describedby="dw-keys">${icon('grid', 15)}</button><span class="dw-ic">${icon(ic, 16)}</span><h3 id="dw-${id}-t">${esc(t(title))}</h3>${extra}${href ? `<a class="dw-more" href="${href}" aria-label="${esc(t('Open {1}', t(title)))}">${icon('right', 14)}</a>` : ''}<span class="dw-ed"><button type="button" class="icon-btn dw-st" data-dwe="up" aria-label="${esc(t('Move {1} up', t(title)))}">${icon('up', 14)}</button><button type="button" class="icon-btn dw-st" data-dwe="down" aria-label="${esc(t('Move {1} down', t(title)))}">${icon('down', 14)}</button><button type="button" class="icon-btn dw-fr" data-dwe="front" aria-label="${esc(t('Bring {1} to the front', t(title)))}" title="${esc(t('Bring to the front'))}">${icon('layers', 14)}</button><button type="button" class="icon-btn dw-fr" data-dwe="back" aria-label="${esc(t('Send {1} to the back', t(title)))}" title="${esc(t('Send to the back'))}">${icon('swap', 14)}</button><button type="button" class="icon-btn" data-dwe="remove" aria-label="${esc(t('Remove {1}', t(title)))}" title="${esc(t('Remove'))}">${icon('x', 14)}</button></span></div><div class="dw-b">${body}</div><span class="dw-rs" data-dwr="${id}" aria-hidden="true"></span></section>`;
  const none = (txt, action = '') => `<div class="dw-none"><p>${esc(t(txt))}</p>${action}</div>`;

  /* ---------- the cards ---------- */
  function schedule() {
    const iso = tIso(); const nowM = new Date().getHours() * 60 + new Date().getMinutes();
    const slots = L.slotsOn(iso).map(s => ({ t: s.start, end: s.end, title: s.title, sub: s.place, course: s.course, kind: 'slot', id: s.id }));
    const evs = L.all('events').filter(e => e.date === iso).map(e => ({ t: e.time || '', end: e.end || '', title: e.title, sub: e.place || '', course: e.course || '', kind: 'event', id: e.id }));
    const exams = L.items(iso, iso).filter(x => x.kind === 'exam' && x.src !== 'mine').map(x => ({ t: x.time || '', title: x.title, sub: x.course && Courses[x.course] ? Courses[x.course].short : '', course: x.course, kind: 'exam' }));
    const all = exams.concat(slots, evs).sort((a, b) => (a.t || '00:00').localeCompare(b.t || '00:00'));
    if (!all.length) return none(L.all('slots').length ? 'Nothing on your timetable today.' : 'Your classes, labs and shifts show up here once your timetable is set.', L.all('slots').length ? '' : `<a class="btn sm" href="#/timetable">${icon('table', 13)} ${esc(t('Build your timetable'))}</a>`);
    const next = all.find(x => x.t && L.toMin(x.end || x.t) > nowM);
    return `<ul class="dw-sched">${all.map(x => { const st = L.toMin(x.t), en = L.toMin(x.end || ''); const state = x.t && en != null && en <= nowM ? 'past' : x.t && st <= nowM && (en == null || en > nowM) ? 'now' : ''; return `<li class="${state} k-${x.kind}" style="${x.course ? L.ccStyle(x.course) : ''}"><span class="dw-t">${x.t ? esc(L.fmtTime(x.t)) : esc(t('All day'))}</span><span class="dw-dot"></span><span class="dw-what"><b>${x.kind === 'exam' ? icon('flag', 12) + ' ' : ''}${esc(x.title)}</b>${x.sub || x.end ? `<small>${x.end ? esc(L.fmtTime(x.t)) + '–' + esc(L.fmtTime(x.end)) : ''}${x.sub ? (x.end ? ' · ' : '') + esc(x.sub) : ''}</small>` : ''}</span>${state === 'now' ? `<span class="lf-chip now">${esc(t('now'))}</span>` : x === next && st > nowM ? `<span class="lf-chip">${esc(st - nowM < 60 ? t('in {1} min', st - nowM) : t('next'))}</span>` : ''}</li>`; }).join('')}</ul>`;
  }
  function due() {
    const iso = tIso(); const end = L.addDaysISO(iso, 6);
    const late = L.all('tasks').filter(x => x.status !== 'done' && x.due && x.due < iso).map(x => ({ date: x.due, title: x.title, kind: x.kind === 'exam' ? 'exam' : 'task', course: x.course || '', col: 'tasks', id: x.id, late: true, time: x.time }));
    const items = late.concat(L.items(iso, end).filter(x => ['task', 'assignment', 'deadline', 'exam'].includes(x.kind) && !x.done && !(x.kind === 'task' && x.src === 'mine' && x.col !== 'tasks')));
    const rows = items.slice(0, 7).map(x => `<li class="${x.late ? 'late' : ''}" style="${x.course ? L.ccStyle(x.course) : ''}">${x.col === 'tasks' ? `<button class="tk-check" type="button" data-dw="done" data-id="${esc(x.id)}" role="checkbox" aria-checked="false" aria-label="${esc(t('Mark as done'))}: ${esc(x.title)}">${icon('check', 13)}</button>` : `<span class="dw-kind k-${x.kind}">${icon(x.kind === 'exam' ? 'flag' : 'clock', 13)}</span>`}<span class="dw-what"><b>${esc(x.title)}</b><small>${L.classChip(x.course)}${x.src === 'class' || x.src === 'canvas' ? `<span class="muted">${esc(t('from the syllabus'))}</span>` : ''}</small></span><span class="dw-when${x.late ? ' late' : ''}">${esc(x.late ? t('late') : L.relDay(x.date))}${x.time ? `<small>${esc(L.fmtTime(x.time))}</small>` : ''}</span></li>`).join('');
    return `${items.length ? `<ul class="dw-due">${rows}</ul>${items.length > 7 ? `<p class="muted small">${esc(t('{1} more this week', items.length - 7))}</p>` : ''}` : none('Nothing due in the next seven days.')}<form class="lf-inline sm dw-add" data-dw-form="task" autocomplete="off"><span class="lf-inline-ic">${icon('plus', 14)}</span><input name="title" maxlength="160" placeholder="${esc(t('Add a task for today'))}" aria-label="${esc(t('New task'))}"></form>`;
  }
  function clock() {
    const hz = App.homeZone ? App.homeZone() : null; const bars = App.timeProgress ? App.timeProgress() : [];
    const zones = (App.homeZones || []).map(([z, l]) => `<option value="${esc(z)}">${esc(l)}</option>`).join('');
    return `<div class="dw-clock"><div class="dw-faces"><div>${App.clockFace ? App.clockFace(118) : ''}<b data-clock="">${esc(new Date().toLocaleTimeString(App.lang === 'en' ? 'en-US' : App.lang, { hour: 'numeric', minute: '2-digit' }))}</b><small>${esc(t('Here'))}</small></div>${hz ? `<div>${App.clockFace(82, 'small').replace('<svg ', `<svg data-tz="${esc(hz.tz)}" `)}<b data-clock="${esc(hz.tz)}"></b><small>${esc(hz.label)}</small></div>` : ''}</div>
      ${bars.length ? `<div class="sb-bars dw-bars">${bars.map(b => `<div class="sb-bar" data-k="${b.k}"><div class="sb-bar-row"><span>${esc(b.label)}</span><b>${b.p}%</b></div><div class="sb-track"><i style="width:${b.p}%"></i></div></div>`).join('')}</div>` : ''}
      ${hz ? '' : `<label class="dw-zone"><span>${icon('globe', 13)} ${esc(t('Add the time back home'))}</span><select data-dw-zone><option value="">${esc(t('Pick a city'))}</option>${zones}</select></label>`}</div>`;
  }
  function pomo() {
    const P = App.pomo ? App.pomo() : null; if (!P) return '';
    const total = P.len(); const pc = Math.round((1 - P.left / total) * 100);
    const r = 52, C = 2 * Math.PI * r;
    return `<div class="dw-pomo${P.running ? ' on' : ''}"><div class="lf-seg-btns dw-modes" role="group" aria-label="${esc(t('Timer'))}">${[['focus', 'Focus'], ['break', 'Short break'], ['long', 'Long break']].map(([m, l]) => `<button type="button" class="${P.mode === m ? 'on' : ''}" data-dw="mode" data-m="${m}" aria-pressed="${P.mode === m}">${esc(t(l))}</button>`).join('')}</div>
      <div class="dw-ring"><svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="dw-ring-bg"/><circle cx="60" cy="60" r="${r}" class="dw-ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pc / 100)).toFixed(1)}" transform="rotate(-90 60 60)"/></svg><b id="dw-pomo-time" aria-live="off">${String(Math.floor(P.left / 60)).padStart(2, '0')}:${String(P.left % 60).padStart(2, '0')}</b></div>
      <div class="dw-pomo-btns"><button class="btn primary" type="button" data-dw="pomo">${icon(P.running ? 'pause' : 'play', 14)} ${esc(t(P.running ? 'Pause' : 'Start'))}</button><button class="icon-btn" type="button" data-dw="reset" aria-label="${esc(t('Reset'))}">${icon('rotate', 15)}</button><a class="icon-btn" href="#/focus" aria-label="${esc(t('Focus room'))}" title="${esc(t('Focus room'))}">${icon('clock', 15)}</a></div></div>`;
  }
  function todos() {
    const list = L.all('todos').sort((a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9') || (a.c || 0) - (b.c || 0));
    const open = list.filter(x => !x.done); const recent = list.filter(x => x.done && (x.u || 0) > Date.now() - 2 * 86400000);
    return `${open.length || recent.length ? `<ul class="dw-todos">${open.concat(recent).slice(0, 8).map(x => `<li class="${x.done ? 'done' : ''}"><button class="tk-check" type="button" data-dw="todo" data-id="${esc(x.id)}" role="checkbox" aria-checked="${!!x.done}" aria-label="${esc(x.title)}">${icon('check', 13)}</button><span>${esc(x.title)}</span>${x.date && !x.done ? `<small>${esc(L.relDay(x.date))}</small>` : ''}<button class="icon-btn xs" type="button" data-dw="todo-del" data-id="${esc(x.id)}" aria-label="${esc(t('Delete'))}">${icon('x', 11)}</button></li>`).join('')}</ul>` : none('Little things to remember: a blue book, a form, a call.')}<form class="lf-inline sm dw-add" data-dw-form="todo" autocomplete="off"><span class="lf-inline-ic">${icon('plus', 14)}</span><input name="title" maxlength="160" placeholder="${esc(t('Add a to-do'))}" aria-label="${esc(t('New to-do'))}"></form>`;
  }
  function events() {
    const iso = tIso(); const list = L.all('events').filter(e => e.date >= iso).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')).slice(0, 5);
    return `${list.length ? `<ul class="dw-events">${list.map(e => `<li style="${e.course ? L.ccStyle(e.course) : ''}"><button type="button" data-dw="event" data-id="${esc(e.id)}"><span class="dw-date"><b>${App.parseISO(e.date).getDate()}</b><small>${esc(L.monthName(App.parseISO(e.date).getMonth(), true))}</small></span><span class="dw-what"><b>${esc(e.title)}</b><small>${esc(L.relDay(e.date))}${e.time ? ' · ' + esc(L.fmtTime(e.time)) : ''}${e.place ? ' · ' + esc(e.place) : ''}</small></span>${e.remind !== '' && e.remind != null ? `<span class="dw-bell" title="${esc(t('Reminder on'))}">${icon('alarm', 13)}</span>` : ''}</button></li>`).join('')}</ul>` : none('Study groups, office hours, a concert: add them here.')}<button class="btn sm dw-btn" type="button" data-dw="new-event">${icon('plus', 13)} ${esc(t('New event'))}</button>`;
  }
  function habits() {
    const iso = tIso(); const list = L.all('habits').filter(h => !h.archived);
    if (!list.length) return none('A habit you tick every day grows a streak.', `<a class="btn sm" href="#/habits">${icon('repeat', 13)} ${esc(t('Pick a habit'))}</a>`);
    return `<div class="dw-habits">${list.slice(0, 6).map(h => { const on = !!(h.log || {})[iso]; const s = L.habitStats ? L.habitStats(h) : { day: 0 }; return `<button class="dw-habit${on ? ' on' : ''}" type="button" data-dw="habit" data-id="${esc(h.id)}" role="checkbox" aria-checked="${on}"><span class="hb-ic">${icon(on ? 'check' : h.icon || 'repeat', 15)}</span><span class="dw-what"><b>${esc(h.name)}</b><small>${(h.target || 7) === 7 ? (s.day ? `${icon('fire', 11)} ${esc(t('{1} days', s.day))}` : esc(t('not yet today'))) : esc(t('{1} of {2} this week', s.thisWeek, h.target))}</small><span class="dw-hweek" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => { const d = L.addDaysISO(L.weekStart(iso), i); return `<i class="${(h.log || {})[d] ? 'on' : ''}${d === iso ? ' today' : ''}${d > iso ? ' fut' : ''}"></i>`; }).join('')}</span></span></button>`; }).join('')}</div>`;
  }
  function goals() {
    const q = L.quarterOf ? L.quarterOf(tIso()) : ''; const list = L.all('goals').filter(g => g.q === q);
    if (!list.length) return none('Two or three goals for this quarter keep the semester pointed somewhere.', `<button class="btn sm" type="button" data-dw="new-goal">${icon('target', 13)} ${esc(t('Set a goal'))}</button>`);
    return `<ul class="dw-goals">${list.slice(0, 5).map(g => { const p = L.goalPct(g); return `<li><div class="dw-goal-h"><b>${esc(g.title)}</b><span>${p}%</span></div><div class="sb-track"><i style="width:${p}%"></i></div></li>`; }).join('')}</ul>`;
  }
  function wheel() {
    const w = L.wheelNow ? L.wheelNow() : null;
    if (!w) return none('Score eight parts of your life once a month and see where to put your energy.', `<a class="btn sm" href="#/wheel">${icon('wheel', 13)} ${esc(t('Score them'))}</a>`);
    return `<a class="dw-wheel" href="#/wheel" aria-label="${esc(t('Wheel of life'))}">${L.radar(w.scores, { size: 210 })}</a>`;
  }
  function week() {
    const ws = L.weekStart(tIso()); const we = L.addDaysISO(ws, 6); const items = L.items(ws, we).filter(x => x.kind !== 'note' && x.kind !== 'holiday'); const by = {}; items.forEach(x => (by[x.date] = by[x.date] || []).push(x));
    return `<div class="dw-week">${Array.from({ length: 7 }, (_, i) => { const d = L.addDaysISO(ws, i); const list = by[d] || []; const slots = L.slotsOn(d).length; return `<a class="dw-day${d === tIso() ? ' today' : ''}${d < tIso() ? ' past' : ''}" href="#/agenda?d=${d}"><span class="dw-day-h"><small>${esc(t(L.DOW[L.dowOf(d)]))}</small><b>${App.parseISO(d).getDate()}</b></span>${list.slice(0, 4).map(x => `<span class="dw-it k-${x.kind}${x.done ? ' done' : ''}" style="${x.course ? L.ccStyle(x.course) : ''}">${esc(x.title)}</span>`).join('')}${list.length > 4 ? `<span class="dw-it more">${esc(t('+{1} more', list.length - 4))}</span>` : ''}${slots ? `<span class="dw-slots">${icon('table', 11)} ${esc(t('{1} on your timetable', slots))}</span>` : ''}</a>`; }).join('')}</div>`;
  }

  App.dash = {};
  /* ---------- widgets from the rest of StudyCat: your classes, Bo, discussions, guides ---------- */
  const H = () => App.home || {};
  const myIds = () => (App.myCourses ? App.myCourses() : []).filter(id => Courses[id] && !Courses[id].preview);
  const signedIn = () => !!(App.auth && App.auth.user && !App.auth.user.local);
  function nextBody() {
    const ids = myIds(); if (!ids.length) return none('Pick your classes and the next step for each shows here.', `<button class="btn sm" type="button" data-dw="choose">${esc(t('Choose classes'))}</button>`);
    const cur = H().curClass ? H().curClass() : ids[0]; const id = ids.includes(cur) ? cur : ids[0];
    // a few classes are buttons; more are a menu, so the widget stays short
    const pick = ids.length > 4 ? `<label class="dw-pick-sel"><span class="sr-only">${esc(t('Show a class'))}</span><select class="select sm" data-dw-pick>${ids.map(x => `<option value="${esc(x)}"${x === id ? ' selected' : ''}>${esc(Courses[x].short || Courses[x].code)}</option>`).join('')}</select></label>`
      : ids.length > 1 ? `<div class="wh-pick dw-pick" role="tablist" aria-label="${esc(t('Show a class'))}">${ids.map(x => `<button type="button" role="tab" class="wh-tab${x === id ? ' on' : ''}" aria-selected="${x === id}" data-dw="pick" data-id="${esc(x)}" style="${L.ccStyle(x)}">${esc(Courses[x].short || Courses[x].code)}</button>`).join('')}</div>` : '';
    return `${pick}<div class="dw-next" data-cid="${esc(id)}" style="${L.ccStyle(id)}"><div class="ah-loading" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
  }
  function fillNext(el) {
    const box = $('.dw-next', el); if (!box) return; const id = box.dataset.cid;
    App.loadCourse(id).then(C => { if (!box.isConnected) return; const xw = H().examWeekHtml ? H().examWeekHtml(C) : ''; box.innerHTML = (H().heroHtml ? H().heroHtml(C, { noExam: !!xw }) : '') + xw; if (App.typeset) try { App.typeset(box); } catch (e) {} })
      .catch(() => { if (box.isConnected) box.innerHTML = `<p class="small muted">${esc(t('This class could not be opened.'))} <a href="#/${esc(id)}/dashboard">${esc(t('Try its class page'))}</a></p>`; });
  }
  function classesBody() {
    const ids = myIds(); const iso = tIso();
    const rows = ids.map(id => { const C = Courses[id]; let ex = null; try { ex = App.nextExamOf(C); } catch (e) {} const n = ex && ex.date ? App.daysBetween(iso, ex.date) : null;
      return `<a class="dwk" data-c="${esc(id)}" href="#/${esc(id)}/dashboard" style="${L.ccStyle(id)}"><span class="dwk-tile" aria-hidden="true">${esc(C.short || C.code)}</span><span class="dwk-t"><b>${esc(C.code)} · ${esc(C.name)}</b><small>${ex && n != null && n >= 0 ? esc(t('{1} in {2} days', ex.name, n)).replace(/ in 0 days$/, ' ' + t('today')).replace(/ in 1 days$/, ' ' + t('tomorrow')) : esc(t('No exam coming up'))}</small></span>${icon('right', 15)}</a>`; }).join('');
    return `${rows ? `<div class="dwk-list">${rows}</div>` : none('No classes yet.')}<div class="dw-foot">${signedIn() ? `<button class="linkbtn small" type="button" data-dw="choose">${icon('sliders', 13)} ${esc(t('Choose classes'))}</button>` : ''}<a class="linkbtn small" href="#/maker">${icon('maker', 13)} ${esc(t('Class maker'))}</a></div>`;
  }
  const W = {
    next: { t: 'Up next', ic: 'play', href: '', w: 7, h: 11, body: nextBody, after: fillNext },
    today: { t: 'Today, all classes', ic: 'flag', href: '#/today', w: 5, h: 11, live: true, body: () => (H().todayHtml ? H().todayHtml() : none('Nothing for today.')) },
    bo: { t: 'Bo, your tutor', ic: 'chat', href: '', w: 7, h: 9, body: () => signedIn() ? '<div id="dw-bo-slot" class="dw-bo-slot"></div>' : `<a class="land-bo dw-bo-guest" href="#/max"><span class="lb-av" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(46) : ''}</span><span class="lb-t"><b>${esc(t('Stuck on a problem? Call Bo.'))}</b><small>${esc(t('A tutor who talks it through with you and writes on a board you share.'))}</small></span><span class="lb-go">${icon('play', 13)} ${esc(t('Watch a 1-minute demo'))}</span></a>` },
    classes: { t: 'Your classes', ic: 'cap', href: '', w: 12, h: 7, live: true, body: classesBody },
    schedule: { t: 'Today’s schedule', ic: 'clock', href: '#/timetable', w: 4, h: 9, live: true, body: schedule },
    due: { t: 'Due this week', ic: 'todo', href: '#/tasks', w: 5, h: 7, live: true, body: due },
    week: { t: 'This week', ic: 'calendar', href: '#/agenda', w: 8, h: 9, live: true, body: week },
    clock: { t: 'Clock', ic: 'globe', href: '', w: 4, h: 9, body: clock },
    pomo: { t: 'Pomodoro', ic: 'timer', href: '#/focus', w: 4, h: 10, body: pomo },
    todos: { t: 'To-dos', ic: 'check', href: '', w: 4, h: 9, live: true, body: todos },
    events: { t: 'Reminders & events', ic: 'alarm', href: '#/agenda', w: 4, h: 8, live: true, body: events },
    habits: { t: 'Habits', ic: 'repeat', href: '#/habits', w: 4, h: 8, live: true, body: habits },
    goals: { t: 'Goals this quarter', ic: 'target', href: '#/goals', w: 4, h: 8, live: true, body: goals },
    wheel: { t: 'Wheel of life', ic: 'wheel', href: '#/wheel', w: 4, h: 10, live: true, body: wheel },
    forum: { t: 'Latest discussions', ic: 'chat', href: '#/forum', w: 6, h: 9, body: () => '<div class="dw-forum"><p class="small muted">…</p></div>', after: el => { const f = $('.dw-forum', el); if (f && App.forumLatest) App.forumLatest(f); else if (f) f.innerHTML = ''; } },
    guides: { t: 'Study guides', ic: 'bulb', href: '#/guides', w: 6, h: 8, body: () => (App.guidesStrip ? App.guidesStrip() : '') },
    resume: { t: 'Pick up where you left off', ic: 'rotate', href: '', w: 6, h: 4, body: () => { const r = App.resumeCard ? App.resumeCard(myIds(), { noStrip: true }) : ''; return r || none('Open a lesson or a page and it waits here for you.'); } },
    note: { t: 'Note', ic: 'pen', href: '', w: 4, h: 7, body: () => `<label class="sr-only" for="dw-note">${esc(t('Note'))}</label><textarea class="input dw-note" id="dw-note" placeholder="${esc(t('Anything to remember. It is saved as you type.'))}">${esc(layout().note || '')}</textarea>` }
  };
  const IDS = Object.keys(W);
  App.dash.WIDGETS = IDS.map(id => [id, W[id].t]);

  /* ---------- the layout: 12 columns, rows of ROW px; widgets may overlap, z decides which is on top ---------- */
  const COLS = 12, ROW = 30, MINW = 3, MINH = 3;
  const START = { in: [['next', 0, 0, 7, 11], ['today', 7, 0, 5, 11], ['bo', 0, 11, 7, 9], ['due', 7, 11, 5, 9], ['schedule', 0, 20, 4, 9], ['week', 4, 20, 8, 9], ['classes', 0, 29, 12, 7]],
    out: [['classes', 0, 0, 7, 11], ['bo', 7, 0, 5, 11], ['guides', 0, 11, 12, 8], ['week', 0, 19, 8, 9], ['clock', 8, 19, 4, 9]] };
  // someone who has studied here (signed in, or with classes picked) starts with their next step; a first visit with the classes
  const returning = () => signedIn() || (Array.isArray(settings().courses) && settings().courses.length > 0) || !!settings().lastVisit;
  const fresh = () => ({ v: 1, items: START[returning() ? 'in' : 'out'].map(([id, x, y, w, h], i) => ({ id, x, y, w, h, z: i + 1 })), note: '' });
  function clampIt(it) { const w = Math.max(MINW, Math.min(COLS, Math.round(+it.w) || W[it.id].w)); return { id: it.id, w, h: Math.max(MINH, Math.min(60, Math.round(+it.h) || W[it.id].h)), x: Math.max(0, Math.min(COLS - w, Math.round(+it.x) || 0)), y: Math.max(0, Math.min(400, Math.round(+it.y) || 0)), z: Math.round(+it.z) || 1 }; }
  function layout() {
    const s = settings().homeLayout; if (!s || typeof s !== 'object' || !Array.isArray(s.items)) return fresh();
    const seen = new Set(); return { v: 1, items: s.items.filter(it => it && W[it.id] && !seen.has(it.id) && seen.add(it.id)).map(clampIt), note: typeof s.note === 'string' ? s.note.slice(0, 4000) : '' };
  }
  const save = Lx => setSetting('homeLayout', { v: 1, items: Lx.items.map(clampIt), note: Lx.note || '' });
  const narrow = canvas => canvas.clientWidth < 720;
  const order = items => items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  // pack widgets into the grid without overlaps, keeping their reading order (Tidy up)
  function tidy(items) {
    const taken = []; const free = (x, y, w, h) => taken.every(o => x + w <= o.x || o.x + o.w <= x || y + h <= o.y || o.y + o.h <= y);
    return order(items).map((it, i) => { let y = 0, x = 0; for (; ; y++) { for (x = 0; x <= COLS - it.w; x++) if (free(x, y, it.w, it.h)) break; if (x <= COLS - it.w) break; } const o = Object.assign({}, it, { x, y, z: i + 1 }); taken.push(o); return o; });
  }

  const D = { editing: false };
  App.dash.html = () => `<section class="land-sec dash home-dash" id="dash" aria-labelledby="lsec-day"><div class="sec-h dash-top"><h2 class="sec-title" id="lsec-day">${esc(t('Your home'))}</h2><span class="dash-acts"><button class="btn sm" type="button" data-dw="quick">${icon('plus', 13)} ${esc(t('New'))}</button><button class="btn sm" type="button" data-dw="add">${icon('grid', 13)} ${esc(t('Add a widget'))}</button><button class="btn sm${D.editing ? ' primary' : ''}" type="button" data-dw="arrange" aria-pressed="${D.editing}">${icon(D.editing ? 'check' : 'sliders', 13)} ${esc(t(D.editing ? 'Done' : 'Arrange'))}</button></span></div>
    <div class="dash-edit-bar" id="dash-edit-bar"${D.editing ? '' : ' hidden'}><span class="small">${icon('grid', 13)} ${esc(t('Drag a widget by its handle, resize it from its corner. Widgets can overlap: bring one to the front or send it to the back.'))}</span><span class="row gap-sm"><button class="btn sm ghost" type="button" data-dw="tidy">${esc(t('Tidy up'))}</button><button class="btn sm ghost" type="button" data-dw="home-reset">${esc(t('Start over'))}</button></span></div>
    <p class="sr-only" id="dw-keys">${esc(t('With Arrange on, the arrow keys move the widget and Shift with the arrow keys resizes it.'))}</p><p class="sr-only" aria-live="polite" id="dw-say"></p>
    <div class="dash-canvas${D.editing ? ' editing' : ''}" id="dash-canvas"></div></section>`;

  function place(canvas, el, it) {
    el.style.zIndex = String(it.z);
    if (narrow(canvas)) { ['left', 'top', 'width', 'height'].forEach(k => { el.style[k] = ''; }); return; }
    el.style.left = `calc(${(it.x / COLS) * 100}% + 6px)`; el.style.width = `calc(${(it.w / COLS) * 100}% - 12px)`;
    el.style.top = `${it.y * ROW + 6}px`; el.style.height = `${it.h * ROW - 12}px`;
  }
  function sizeCanvas(canvas, Lx) {
    const stack = narrow(canvas); canvas.classList.toggle('stacked', stack);
    if (stack) { canvas.style.height = ''; order(Lx.items).forEach((it, i) => { const el = $(`.dw[data-w="${it.id}"]`, canvas); if (el) el.style.order = String(i); }); return; }
    const rows = Lx.items.reduce((m, it) => Math.max(m, it.y + it.h), 0) + (D.editing ? 8 : 0);
    canvas.style.height = `${Math.max(rows, D.editing ? 14 : 4) * ROW}px`;
  }
  const say = msg => { const el = $('#dw-say'); if (el) el.textContent = msg; };

  App.dash.paint = function (root, only) {
    const canvas = $('#dash-canvas', root); if (!canvas) return; const Lx = layout();
    const items = Lx.items.filter(it => !only || only.includes(it.id));
    if (!only) canvas.innerHTML = Lx.items.length ? '' : `<div class="lf-empty dash-empty">${icon('grid', 26)}<b>${esc(t('Your home is empty'))}</b><p>${esc(t('Add the widgets you want, and put them anywhere.'))}</p><button class="btn primary" type="button" data-dw="add">${icon('plus', 14)} ${esc(t('Add a widget'))}</button></div>`;
    items.forEach(it => {
      const w = W[it.id]; let html; try { html = card(it.id, w.t, w.ic, w.href, w.body()); } catch (e) { console.error(e); html = card(it.id, w.t, w.ic, w.href, none('This widget could not be drawn.')); }
      const tmp = document.createElement('div'); tmp.innerHTML = html; const el = tmp.firstElementChild;
      const old = $(`.dw[data-w="${it.id}"]`, canvas); if (old) old.replaceWith(el); else canvas.appendChild(el);
      place(canvas, el, it); if (w.after) try { w.after(el); } catch (e) { console.error(e); }
    });
    sizeCanvas(canvas, Lx);
    if (App.tickClocks) App.tickClocks();
    this.wire(root);
    if (!only) { const ev = new CustomEvent('mathub:dash', { detail: { root } }); document.dispatchEvent(ev); }
  };
  // the widgets that show planner data are drawn again when it changes (not Bo, the class or the discussions)
  App.dash.repaintLive = root => App.dash.paint(root, IDS.filter(id => W[id].live));

  /* the widget picker: every widget, on or off */
  function picker(root) {
    const Lx = layout(); const on = new Set(Lx.items.map(it => it.id));
    L.form({ title: 'Add or remove widgets', icon: 'grid', fields: IDS.map(id => ({ k: id, label: W[id].t, type: 'check' })), values: Object.fromEntries(IDS.map(id => [id, on.has(id)])), submit: 'Save',
      onSave: v => {
        let items = Lx.items.filter(it => v[it.id]); const bottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0); let x = 0, y = bottom, rowH = 0;
        IDS.filter(id => v[id] && !on.has(id)).forEach(id => { const w = W[id]; if (x + w.w > COLS) { x = 0; y += rowH; rowH = 0; } items.push({ id, x, y, w: w.w, h: w.h, z: items.reduce((m, it) => Math.max(m, it.z), 0) + 1 }); x += w.w; rowH = Math.max(rowH, w.h); });
        save({ items, note: Lx.note }); App.dash.paint(root); toast(t('Your home is saved'));
      } });
  }
  function setEditing(root, on) {
    D.editing = on; const sec = $('#dash', root); if (!sec) return;
    const b = $('[data-dw="arrange"]', sec); if (b) { b.classList.toggle('primary', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = `${icon(on ? 'check' : 'sliders', 13)} ${esc(t(on ? 'Done' : 'Arrange'))}`; }
    const bar = $('#dash-edit-bar', sec); if (bar) bar.hidden = !on;
    const canvas = $('#dash-canvas', sec); canvas.classList.toggle('editing', on); sizeCanvas(canvas, layout());
    if (!on) toast(t('Your home is saved'));
  }

  /* dragging and resizing with the pointer: the widget follows, and lands on the grid */
  function drag(root, e, el, mode) {
    const canvas = $('#dash-canvas', root); if (narrow(canvas)) return;
    e.preventDefault(); const Lx = layout(); const it = Lx.items.find(x => x.id === el.dataset.w); if (!it) return;
    const colW = canvas.clientWidth / COLS; const st = { px: e.clientX, py: e.clientY, x: it.x, y: it.y, w: it.w, h: it.h };
    it.z = Lx.items.reduce((m, o) => Math.max(m, o.z), 0) + 1; place(canvas, el, it); el.classList.add(mode === 'move' ? 'dragging' : 'resizing');
    const ghost = document.createElement('div'); ghost.className = 'dw-ghost'; canvas.appendChild(ghost);
    const calc = ev => { const dx = ev.clientX - st.px, dy = ev.clientY - st.py; if (mode === 'move') { it.x = Math.max(0, Math.min(COLS - it.w, Math.round(st.x + dx / colW))); it.y = Math.max(0, Math.round(st.y + dy / ROW)); } else { it.w = Math.max(MINW, Math.min(COLS - it.x, Math.round(st.w + dx / colW))); it.h = Math.max(MINH, Math.round(st.h + dy / ROW)); } return { dx, dy }; };
    const move = ev => { const { dx, dy } = calc(ev); if (mode === 'move') el.style.transform = `translate(${dx}px, ${dy}px)`; else { el.style.width = `${st.w * colW - 12 + dx}px`; el.style.height = `${st.h * ROW - 12 + dy}px`; } place(canvas, ghost, Object.assign({}, it, { z: it.z - 1 })); if (ev.clientY > innerHeight - 40) scrollBy(0, 14); else if (ev.clientY < 60) scrollBy(0, -14); };
    const up = ev => { calc(ev); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); ghost.remove(); el.style.transform = ''; el.classList.remove('dragging', 'resizing'); place(canvas, el, it); save(Lx); sizeCanvas(canvas, Lx); if (mode !== 'move') App.dash.paint(root, [it.id]); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  /* the same with the keyboard, on a widget's grip */
  function key(root, e, el) {
    const k = e.key; const canvas = $('#dash-canvas', root); const Lx = layout(); const it = Lx.items.find(x => x.id === el.dataset.w); if (!it) return;
    const name = t(W[it.id].t); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (d) {
      e.preventDefault();
      if (narrow(canvas)) { if (!d[1]) return; const list = order(Lx.items); const i = list.indexOf(it), j = i + d[1]; if (j < 0 || j >= list.length) return; const o = list[j]; [it.y, o.y] = [o.y, it.y]; if (it.y === o.y) [it.x, o.x] = [o.x, it.x]; save(Lx); sizeCanvas(canvas, Lx); el.querySelector('.dw-grip').focus(); say(t('{1} moved', name)); return; }
      if (e.shiftKey) { it.w = Math.max(MINW, Math.min(COLS - it.x, it.w + d[0])); it.h = Math.max(MINH, it.h + d[1]); save(Lx); App.dash.paint(root, [it.id]); const g = $(`.dw[data-w="${it.id}"] .dw-grip`, canvas); if (g) g.focus(); say(t('{1}: {2} columns wide, {3} rows tall', name, it.w, it.h)); return; }
      it.x = Math.max(0, Math.min(COLS - it.w, it.x + d[0])); it.y = Math.max(0, it.y + d[1]); place(canvas, el, it); save(Lx); sizeCanvas(canvas, Lx); say(t('{1}: column {2}, row {3}', name, it.x + 1, it.y + 1));
    } else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); act(root, el, 'remove'); }
  }
  function act(root, el, what) {
    const Lx = layout(); const it = Lx.items.find(x => x.id === el.dataset.w); if (!it) return; const canvas = $('#dash-canvas', root);
    if (what === 'remove') { Lx.items = Lx.items.filter(x => x !== it); save(Lx); el.remove(); sizeCanvas(canvas, Lx); toast(t('{1} removed. Add it back any time.', t(W[it.id].t))); return; }
    if (what === 'up' || what === 'down') {   // a phone: the order they stack in
      const list = order(Lx.items); const i = list.indexOf(it), j = i + (what === 'up' ? -1 : 1); if (j < 0 || j >= list.length) return; const o = list[j];
      [it.x, o.x] = [o.x, it.x]; [it.y, o.y] = [o.y, it.y]; if (it.y === o.y && it.x === o.x) it.y += what === 'up' ? -1 : 1;
      save(Lx); sizeCanvas(canvas, Lx); const b = $(`[data-dwe="${what}"]`, el); if (b) b.focus(); say(t('{1} moved', t(W[it.id].t))); return;
    }
    const zs = Lx.items.map(o => o.z); it.z = what === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
    if (it.z < 1) { Lx.items.forEach(o => { o.z += 2 - it.z; }); }
    save(Lx); Lx.items.forEach(o => { const e2 = $(`.dw[data-w="${o.id}"]`, canvas); if (e2) e2.style.zIndex = String(o.z); });
    say(t(what === 'front' ? '{1} is in front' : '{1} is at the back', t(W[it.id].t)));
  }

  App.dash.wire = function (root) {
    const sec = $('#dash', root); if (!sec || sec.__wired) return; sec.__wired = true;
    const repaint = () => { const y = window.scrollY; App.dash.paint(root); window.scrollTo(0, y); };
    sec.addEventListener('pointerdown', e => {
      if (!D.editing || e.button > 0) return;
      const g = e.target.closest('.dw-grip'), r = e.target.closest('.dw-rs'); if (!g && !r) return;
      drag(root, e, (g || r).closest('.dw'), g ? 'move' : 'size');
    });
    sec.addEventListener('keydown', e => { const g = e.target.closest('.dw-grip'); if (g && D.editing) key(root, e, g.closest('.dw')); });
    sec.addEventListener('click', e => {
      const ed = e.target.closest('[data-dwe]'); if (ed) { act(root, ed.closest('.dw'), ed.dataset.dwe); return; }
      const b = e.target.closest('[data-dw]'); if (!b) return; const k = b.dataset.dw; const id = b.dataset.id;
      if (k === 'arrange') setEditing(root, !D.editing);
      else if (k === 'add') picker(root);
      else if (k === 'tidy') { const Lx = layout(); Lx.items = tidy(Lx.items); save(Lx); repaint(); say(t('Widgets tidied into a grid')); }
      else if (k === 'home-reset') { if (confirm(t('Put your home back as it came?'))) { save(fresh()); repaint(); } }
      else if (k === 'pick') { if (H().setClass) H().setClass(id); App.dash.paint(root, ['next']); }
      else if (k === 'choose') { const pk = document.getElementById('pick-classes'); if (pk) { pk.scrollIntoView({ behavior: 'smooth', block: 'start' }); const f = pk.querySelector('input'); if (f) f.focus({ preventScroll: true }); } else if (App.auth && App.auth.user) App.auth.onboard(true); else location.hash = '#/'; }   // the home page's class picker, or the class list
      else if (k === 'done') { L.put('tasks', id, { status: 'done', doneAt: Date.now() }); toast(t('Done')); App.dash.repaintLive(root); }
      else if (k === 'todo') { const x = L.get('todos', id); if (x) L.put('todos', id, { done: !x.done }); App.dash.repaintLive(root); }
      else if (k === 'todo-del') { L.drop('todos', id, t('To-do deleted')); App.dash.repaintLive(root); }
      else if (k === 'habit') { if (L.toggleHabit) L.toggleHabit(id); App.dash.repaintLive(root); }
      else if (k === 'event') L.editEvent(id);
      else if (k === 'new-event') App.quickAdd('event');
      else if (k === 'new-goal') { App.need(['life-self.js']).then(() => { if (App.quickAddGoal) App.quickAddGoal(); }).catch(e => App.toast(e.message)); }   // the goals page loads when first needed
      else if (k === 'quick') App.quickAdd('task');
      else if (k === 'pomo') { const P = App.pomo(); P.toggle(); }
      else if (k === 'reset') { const P = App.pomo(); P.reset(); }
      else if (k === 'mode') { const P = App.pomo(); if (P.running && !confirm(t('Stop the timer and switch?'))) return; P.setMode(b.dataset.m); }
    });
    sec.addEventListener('submit', e => { const f = e.target.closest('[data-dw-form]'); if (!f) return; e.preventDefault(); const title = f.title.value.trim(); if (!title) return; if (f.dataset.dwForm === 'todo') L.add('todos', { title, date: '', done: false }); else L.saveTask({ title, due: tIso(), priority: 'medium', status: 'todo', kind: 'task' }); App.dash.repaintLive(root); const again = $(`[data-dw-form="${f.dataset.dwForm}"] input`, root); if (again) again.focus(); });
    sec.addEventListener('change', e => { if (e.target.matches('[data-dw-pick]')) { if (H().setClass) H().setClass(e.target.value); App.dash.paint(root, ['next']); const s2 = $('[data-dw-pick]', root); if (s2) s2.focus(); return; } const z = e.target.closest('[data-dw-zone]'); if (z && z.value) { L.setCfg('homeZone', z.value); App.dash.paint(root, ['clock']); if (App.paintSidebar) App.paintSidebar(); } });
    let noteT = 0; sec.addEventListener('input', e => { if (e.target.id !== 'dw-note') return; clearTimeout(noteT); const v = e.target.value; noteT = setTimeout(() => { const Lx = layout(); Lx.note = v.slice(0, 4000); save(Lx); }, 500); });
    // the canvas follows the width of the page: stacked on a phone, placed on a larger screen
    if (global.ResizeObserver) { const canvas = $('#dash-canvas', sec); let wasNarrow = narrow(canvas); const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return; } const n = narrow(canvas); if (n !== wasNarrow) { wasNarrow = n; const Lx = layout(); Lx.items.forEach(it => { const el = $(`.dw[data-w="${it.id}"]`, canvas); if (el) place(canvas, el, it); }); sizeCanvas(canvas, Lx); } }); ro.observe(canvas); }
    // the big timer follows the sidebar's
    const P = App.pomo ? App.pomo() : null;
    if (P && !P.__dash) { P.__dash = true; P.watchers.push(p => { const el = $('#dw-pomo-time'); if (!el) return; const w = el.closest('.dw-pomo'); const mode = w && $$('.dw-modes button', w).find(x => x.classList.contains('on')); if (!w || p.running !== w.classList.contains('on') || (mode && mode.dataset.m !== p.mode)) { const host = el.closest('.dw-b'); if (host) host.innerHTML = pomo(); return; } el.textContent = `${String(Math.floor(p.left / 60)).padStart(2, '0')}:${String(p.left % 60).padStart(2, '0')}`; const fg = $('.dw-ring-fg', w); if (fg) { const C = 2 * Math.PI * 52; fg.setAttribute('stroke-dashoffset', (C * (p.left / p.len())).toFixed(1)); } }); }
  };
  App.dash.layout = layout; App.dash.tidy = tidy; App.dash.COLS = COLS; App.dash.ROW = ROW;
  // on each class card: your tasks for it and its exams
  App.dash.classStats = id => {
    const C = Courses[id]; if (!C) return ''; const iso = tIso();
    const tasks = L.all('tasks').filter(x => x.course === id); const open = tasks.filter(x => x.status !== 'done').length; const done = tasks.length - open;
    const ex = (C.EXAMS || []); const left = ex.filter(e => (e.endDate || e.date) >= iso).length; const past = ex.length - left;
    const week = L.items(iso, L.addDaysISO(iso, 6)).filter(x => x.course === id && ['deadline', 'assignment', 'task', 'exam'].includes(x.kind) && !x.done).length;
    return `<div class="cc-stats" aria-label="${esc(t('This class in numbers'))}"><span><b>${week}</b>${esc(t('due this week'))}</span><span><b>${open}</b>${esc(t('tasks open'))}</span><span><b>${done}</b>${esc(t('done'))}</span><span><b>${left}</b>${esc(t(left === 1 ? 'exam left' : 'exams left'))}</span>${tasks.length ? `<div class="cc-bar" title="${esc(t('{1} of {2} tasks done', done, tasks.length))}"><i style="width:${Math.round(done / tasks.length * 100)}%"></i></div>` : ''}</div>`;
  };
  // planner changes draw the widgets that show it again, while the start page is open
  L.onChange(() => { const root = $('#view'); if (!root || !$('#dash-canvas', root)) return; const a = document.activeElement; if (a && a.closest && a.closest('#dash') && a.matches('input, select, textarea')) return; clearTimeout(App.dash.t); App.dash.t = setTimeout(() => App.dash.repaintLive(root), 150); });
})(window);
