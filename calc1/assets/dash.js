/* ============================================================
   Mathub — "Your day" on the website's start page
   The planner at a glance, in Big Sky cards under the hero:
   - Today's schedule: the timetable, events and exams of the day,
     with what is on now and next
   - Due this week: your tasks and every class's deadlines, tick
     them off right there, add one in a line
   - The clock: a face that ticks, the time back home, the semester
   - Pomodoro: the sidebar's timer, bigger, with focus, short and
     long breaks
   - To-dos, reminders and events, habits to tick, this quarter's
     goals, the wheel of life
   - This week: seven days with everything dated on them
   It starts with today's schedule, what is due and the week; Customize
   picks the cards (settings.homeHide).
   Data: assets/life.js. Used by the Landing view in assets/app.js.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const L = App && App.life; if (!App || !L) return;
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const Courses = global.Courses;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const tIso = () => L.today();
  const WIDGETS = [['schedule', 'Today’s schedule'], ['due', 'Due this week'], ['clock', 'Clock'], ['pomo', 'Pomodoro'], ['todos', 'To-dos'], ['events', 'Reminders & events'], ['habits', 'Habits'], ['goals', 'Goals this quarter'], ['wheel', 'Wheel of life'], ['week', 'This week']];
  // a first look shows three cards: today, what is due and the week; Customize brings back the rest
  const START_HIDE = ['clock', 'pomo', 'todos', 'events', 'habits', 'goals', 'wheel'];
  const hidden = () => new Set(Array.isArray(settings().homeHide) ? settings().homeHide : START_HIDE);
  const card = (id, title, ic, href, body, extra = '') => `<section class="panel dw dwc-${id}" data-w="${id}" aria-labelledby="dw-${id}-t"><div class="dw-h"><span class="dw-ic">${icon(ic, 16)}</span><h3 id="dw-${id}-t">${esc(t(title))}</h3>${extra}${href ? `<a class="dw-more" href="${href}" aria-label="${esc(t('Open {1}', t(title)))}">${icon('right', 14)}</a>` : ''}</div><div class="dw-b">${body}</div></section>`;
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
  const BUILD = {
    schedule: () => card('schedule', 'Today’s schedule', 'clock', '#/timetable', schedule()),
    due: () => card('due', 'Due this week', 'todo', '#/tasks', due()),
    clock: () => card('clock', 'Clock', 'globe', '', clock()),
    pomo: () => card('pomo', 'Pomodoro', 'timer', '#/focus', pomo()),
    todos: () => card('todos', 'To-dos', 'check', '', todos()),
    events: () => card('events', 'Reminders & events', 'alarm', '#/agenda', events()),
    habits: () => card('habits', 'Habits', 'repeat', '#/habits', habits()),
    goals: () => card('goals', 'Goals this quarter', 'target', '#/goals', goals()),
    wheel: () => card('wheel', 'Wheel of life', 'wheel', '#/wheel', wheel()),
    week: () => card('week', 'This week', 'calendar', '#/agenda', week())
  };

  /* ---------- the section ---------- */
  App.dash = {
    WIDGETS,
    html() { return `<section class="land-sec dash" id="dash" aria-labelledby="lsec-day"><div class="sec-h"><h2 class="sec-title" id="lsec-day">${esc(t('Your day'))}</h2><span class="dash-acts"><button class="btn sm" type="button" data-dw="quick">${icon('plus', 13)} ${esc(t('New'))}</button><button class="btn sm ghost" type="button" data-dw="custom">${icon('sliders', 13)} ${esc(t('Customize'))}</button></span></div><div class="dash-grid" id="dash-grid"></div></section>`; },
    paint(root) {
      const grid = $('#dash-grid', root); if (!grid) return; const hid = hidden();
      grid.innerHTML = WIDGETS.filter(([id]) => !hid.has(id)).map(([id]) => { try { return BUILD[id](); } catch (e) { console.error(e); return ''; } }).join('') || `<div class="lf-empty">${icon('sliders', 26)}<b>${esc(t('Every card is hidden'))}</b><p>${esc(t('Use Customize to bring some back.'))}</p></div>`;
      if (App.tickClocks) App.tickClocks();
      this.wire(root);
    },
    wire(root) {
      const sec = $('#dash', root); if (!sec || sec.__wired) return; sec.__wired = true;
      const repaint = () => { const y = window.scrollY; this.paint(root); window.scrollTo(0, y); };
      sec.addEventListener('click', e => {
        const b = e.target.closest('[data-dw]'); if (!b) return; const k = b.dataset.dw; const id = b.dataset.id;
        if (k === 'done') { L.put('tasks', id, { status: 'done', doneAt: Date.now() }); toast(t('Done')); repaint(); }
        else if (k === 'todo') { const x = L.get('todos', id); if (x) L.put('todos', id, { done: !x.done }); repaint(); }
        else if (k === 'todo-del') { L.drop('todos', id, t('To-do deleted')); repaint(); }
        else if (k === 'habit') { if (L.toggleHabit) L.toggleHabit(id); repaint(); }
        else if (k === 'event') L.editEvent(id);
        else if (k === 'new-event') App.quickAdd('event');
        else if (k === 'new-goal') { if (App.quickAddGoal) App.quickAddGoal(); }
        else if (k === 'quick') App.quickAdd('task');
        else if (k === 'pomo') { const P = App.pomo(); P.toggle(); }
        else if (k === 'reset') { const P = App.pomo(); P.reset(); }
        else if (k === 'mode') { const P = App.pomo(); if (P.running && !confirm(t('Stop the timer and switch?'))) return; P.setMode(b.dataset.m); }
        else if (k === 'custom') {
          const hid = hidden(); L.form({ title: 'Customize your day', icon: 'sliders', fields: WIDGETS.map(([w, l]) => ({ k: w, label: l, type: 'check' })), values: Object.fromEntries(WIDGETS.map(([w]) => [w, !hid.has(w)])), submit: 'Save',
            onSave: v => { setSetting('homeHide', WIDGETS.map(([w]) => w).filter(w => !v[w])); repaint(); } });
        }
      });
      sec.addEventListener('submit', e => { const f = e.target.closest('[data-dw-form]'); if (!f) return; e.preventDefault(); const title = f.title.value.trim(); if (!title) return; if (f.dataset.dwForm === 'todo') L.add('todos', { title, date: '', done: false }); else L.saveTask({ title, due: tIso(), priority: 'medium', status: 'todo', kind: 'task' }); repaint(); const again = $(`[data-dw-form="${f.dataset.dwForm}"] input`, root); if (again) again.focus(); });
      sec.addEventListener('change', e => { const z = e.target.closest('[data-dw-zone]'); if (z && z.value) { L.setCfg('homeZone', z.value); repaint(); if (App.paintSidebar) App.paintSidebar(); } });
      // the big timer follows the sidebar's
      const P = App.pomo ? App.pomo() : null;
      if (P && !P.__dash) { P.__dash = true; P.watchers.push(p => { const el = $('#dw-pomo-time'); if (!el) return; const w = el.closest('.dw-pomo'); const mode = w && $$('.dw-modes button', w).find(x => x.classList.contains('on')); if (!w || p.running !== w.classList.contains('on') || (mode && mode.dataset.m !== p.mode)) { const host = el.closest('.dw-b'); if (host) host.innerHTML = pomo(); return; } el.textContent = `${String(Math.floor(p.left / 60)).padStart(2, '0')}:${String(p.left % 60).padStart(2, '0')}`; const fg = $('.dw-ring-fg', w); if (fg) { const C = 2 * Math.PI * 52; fg.setAttribute('stroke-dashoffset', (C * (p.left / p.len())).toFixed(1)); } }); }
    }
  };
  // on each class card: your tasks for it and its exams
  App.dash.classStats = id => {
    const C = Courses[id]; if (!C) return ''; const iso = tIso();
    const tasks = L.all('tasks').filter(x => x.course === id); const open = tasks.filter(x => x.status !== 'done').length; const done = tasks.length - open;
    const ex = (C.EXAMS || []); const left = ex.filter(e => (e.endDate || e.date) >= iso).length; const past = ex.length - left;
    const week = L.items(iso, L.addDaysISO(iso, 6)).filter(x => x.course === id && ['deadline', 'assignment', 'task', 'exam'].includes(x.kind) && !x.done).length;
    return `<div class="cc-stats" aria-label="${esc(t('This class in numbers'))}"><span><b>${week}</b>${esc(t('due this week'))}</span><span><b>${open}</b>${esc(t('tasks open'))}</span><span><b>${done}</b>${esc(t('done'))}</span><span><b>${left}</b>${esc(t(left === 1 ? 'exam left' : 'exams left'))}</span>${tasks.length ? `<div class="cc-bar" title="${esc(t('{1} of {2} tasks done', done, tasks.length))}"><i style="width:${Math.round(done / tasks.length * 100)}%"></i></div>` : ''}</div>`;
  };
  // planner changes repaint the start page's cards while it is open
  L.onChange(() => { const root = $('#view'); if (!root || !$('#dash-grid', root)) return; const a = document.activeElement; if (a && a.closest && a.closest('#dash') && a.matches('input, select, textarea')) return; clearTimeout(App.dash.t); App.dash.t = setTimeout(() => App.dash.paint(root), 150); });
})(window);
