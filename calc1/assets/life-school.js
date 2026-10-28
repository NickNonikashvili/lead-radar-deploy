/* ============================================================
   StudyCat — your planner, school pages (data: assets/life.js)
   #/tasks      Tasks: this week by day, everything open, a board
                (to do, in progress, done) and what is done;
                deadlines from your classes come in with one click
   #/timetable  Timetable: build your week (classes, labs, shifts,
                study blocks); class meeting times are read from
                each class's syllabus; print it or add it to your
                phone's calendar (.ics)
   #/agenda     Calendar: a month, a week or a list of everything
                dated, from your classes and your planner
   #/timelog    Time tracker: a timer per class and manual entries,
                with the Focus room's minutes counted too
   #/projects   Projects & thesis: big work in steps, word counts,
                sources; templates for a thesis, a paper, a lab report
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const L = App && App.life; if (!App || !L) return;
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const Courses = global.Courses;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const tIso = () => L.today();
  const head = (title, sub, actions = '') => App.pageHead(esc(t(title)), sub ? esc(t(sub)) : '', actions);
  const PRIO_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
  const KIND_LABEL = { task: 'Task', assignment: 'Assignment', exam: 'Exam', reading: 'Reading', project: 'Project', quiz: 'Quiz' };
  const empty = (ic, title, text, action = '') => `<div class="lf-empty">${icon(ic, 28)}<b>${esc(t(title))}</b><p>${esc(t(text))}</p>${action}</div>`;
  const dueTxt = iso => { if (!iso) return t('No date'); const n = App.daysBetween(tIso(), iso); if (n < 0) return n === -1 ? t('Yesterday') : t('{1} days late', -n); return L.relDay(iso); };

  // repaint the open page when the planner changes elsewhere (another tab, a sync), but never under someone's typing
  let pending = false;
  const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#view') && a.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select')); };
  L.onChange(() => { const V = App.current; if (!V || !V.repaint) return; if (typing()) { pending = true; return; } V.repaint(); });
  document.addEventListener('focusout', () => setTimeout(() => { if (pending && !typing()) { pending = false; const V = App.current; if (V && V.repaint) V.repaint(); } }, 120));
  const keepScroll = fn => { const y = window.scrollY; fn(); window.scrollTo(0, y); };

  /* ======================================================
     TASKS
     ====================================================== */
  const isOpen = x => x.status !== 'done';
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99').localeCompare(b.time || '99') || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]);
  function taskRow(x, opts = {}) {
    const late = isOpen(x) && x.due && x.due < tIso();
    return `<div class="tk-row${x.status === 'done' ? ' done' : ''}${late ? ' late' : ''}" data-id="${esc(x.id)}">
      <button class="tk-check" type="button" data-act="toggle" role="checkbox" aria-checked="${x.status === 'done'}" aria-label="${esc(x.status === 'done' ? t('Mark as not done') : t('Mark as done'))}: ${esc(x.title)}">${icon('check', 14)}</button>
      <button class="tk-main" type="button" data-act="edit"><span class="tk-title">${esc(x.title)}</span><span class="tk-meta">${L.classChip(x.course)}${x.kind && x.kind !== 'task' ? `<span class="lf-chip">${esc(t(KIND_LABEL[x.kind] || x.kind))}</span>` : ''}${x.status === 'doing' ? `<span class="lf-chip doing">${esc(t('In progress'))}</span>` : ''}${x.notes ? `<span class="lf-chip ghost" title="${esc(x.notes)}">${icon('note', 12)}</span>` : ''}</span></button>
      ${opts.noPrio ? '' : `<span class="lf-prio p-${esc(x.priority || 'medium')}" title="${esc(t('Priority'))}">${esc(t(PRIO_LABEL[x.priority] || 'Medium'))}</span>`}
      <span class="tk-due${late ? ' late' : ''}">${esc(dueTxt(x.due))}${x.time ? `<small>${esc(L.fmtTime(x.time))}</small>` : ''}</span>
    </div>`;
  }
  function wireTasks(root, repaint) {
    root.addEventListener('click', e => {
      const row = e.target.closest('[data-id]'); const act = e.target.closest('[data-act]'); if (!row || !act || !root.contains(row)) return;
      const id = row.dataset.id; const x = L.get('tasks', id); if (!x) return;
      if (act.dataset.act === 'toggle') { const done = x.status !== 'done'; L.put('tasks', id, { status: done ? 'done' : 'todo', doneAt: done ? Date.now() : 0 }); if (done) { const left = L.all('tasks').filter(y => isOpen(y) && y.due && y.due <= L.addDaysISO(tIso(), 6)).length; toast(left ? t('Done. {1} left this week.', left) : t('Done. Nothing else due this week.')); } repaint(); }
      else if (act.dataset.act === 'edit') Life_editTask(id);
      else if (act.dataset.act === 'move') { L.put('tasks', id, { status: act.dataset.to, doneAt: act.dataset.to === 'done' ? Date.now() : 0 }); repaint(); }
    });
  }
  const Life_editTask = id => L.editTask(id);
  function importDeadlines() {
    const from = tIso(), to = L.addDaysISO(from, 20);
    const have = new Set(L.all('tasks').map(x => (x.due || '') + '|' + x.title.toLowerCase()));
    const list = L.items(from, to).filter(x => x.src !== 'mine' && ['deadline', 'exam'].includes(x.kind) && !have.has(x.date + '|' + x.title.toLowerCase()));
    if (!list.length) { toast(t('Every deadline in the next three weeks is already in your tasks.')); return; }
    const rows = list.map((x, i) => `<label class="lf-pick"><input type="checkbox" name="imp" value="${i}" checked><span>${L.classChip(x.course)}<b>${esc(x.title)}</b><small>${esc(L.relDay(x.date))}${x.time ? ' · ' + esc(L.fmtTime(x.time)) : ''}</small></span></label>`).join('');
    L.form({ title: 'Add deadlines from your classes', icon: 'download', fields: [{ type: 'html', html: `<p class="muted small">${esc(t('From each class’s syllabus and the Canvas calendar, the next three weeks. Pick the ones to track as tasks.'))}</p><div class="lf-picks">${rows}</div>` }], submit: 'Add to my tasks', submitIcon: 'plus', wide: true,
      onSave: (v) => { const form = $('.lf-modal'); const picks = $$('input[name="imp"]:checked', form).map(i => list[+i.value]); picks.forEach(x => L.add('tasks', { title: x.title, kind: x.kind === 'exam' ? 'exam' : 'assignment', course: x.course || '', due: x.date, time: x.time || '', priority: x.kind === 'exam' ? 'high' : 'medium', status: 'todo', notes: '', from: x.src })); toast(t('{1} added to your tasks', picks.length)); } });
  }
  App.views.tasks = {
    title: 'Tasks', blurb: 'Everything you have to hand in or get done, from every class.',
    render(root) {
      const tab = settings().tasksTab || 'week';
      root.innerHTML = `<div class="lf-page tk-page">${head('Tasks', this.blurb, `<button class="btn" type="button" data-action="import">${icon('download', 14)} ${esc(t('Deadlines from your classes'))}</button><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New task'))}</button>`)}
        <div id="tk-stats"></div>
        <form class="lf-inline" id="tk-quick" autocomplete="off"><span class="lf-inline-ic">${icon('plus', 16)}</span><input name="title" maxlength="160" placeholder="${esc(t('Add a task and press Enter'))}" aria-label="${esc(t('New task'))}"><select name="course" aria-label="${esc(t('Class'))}">${L.classOptions().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select><input name="due" type="date" value="${tIso()}" aria-label="${esc(t('Due'))}"><button class="btn sm primary" type="submit">${esc(t('Add'))}</button></form>
        <div class="dash-tabs" data-store="tasksTab" role="tablist">${[['week', 'This week', 'calendar'], ['open', 'Everything open', 'list'], ['board', 'Board', 'kanban'], ['done', 'Done', 'check']].map(([k, l, ic]) => `<button class="tab" type="button" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${esc(t(l))}</span></button>`).join('')}</div>
        <div class="panes"><div class="pane" data-pane="week" id="tk-week"></div><div class="pane" data-pane="open" id="tk-open"></div><div class="pane" data-pane="board" id="tk-board"></div><div class="pane" data-pane="done" id="tk-done"></div></div></div>`;
      void tab;
      const paint = () => keepScroll(() => this.paint(root));
      this.repaint = paint; paint();
      App.bind(root, { new: () => App.quickAdd('task'), import: importDeadlines, 'clear-done': () => { const old = L.all('tasks').filter(x => x.status === 'done' && (x.doneAt || x.u) < Date.now() - 30 * 86400000); old.forEach(x => L.remove('tasks', x.id)); toast(t('{1} cleared', old.length)); paint(); }, 'f-class': el => { this.filter = el.dataset.c || ''; paint(); } });
      wireTasks(root, paint);
      $('#tk-quick', root).addEventListener('submit', e => { e.preventDefault(); const f = e.target; const title = f.title.value.trim(); if (!title) { f.title.focus(); return; } L.saveTask({ title, course: f.course.value, due: f.due.value, priority: 'medium', status: 'todo', kind: 'task' }); f.title.value = ''; f.title.focus(); paint(); });
      this.wireBoard(root, paint);
    },
    paint(root) {
      const all = L.all('tasks'); const today = tIso(); const end = L.addDaysISO(today, 6); const ws = L.weekStart(today);
      const fit = x => !this.filter || (this.filter === '@none' ? !x.course : (x.course || '') === this.filter); const open = all.filter(isOpen).filter(fit);
      const late = open.filter(x => x.due && x.due < today); const dueToday = open.filter(x => x.due === today); const week = open.filter(x => x.due && x.due >= today && x.due <= end);
      const doneWeek = all.filter(x => x.status === 'done' && (x.doneAt || 0) >= App.parseISO(ws).getTime());
      $('#tk-stats', root).innerHTML = `<div class="lf-stats">${[[late.length, 'Late', 'warn', 'clock'], [dueToday.length, 'Due today', '', 'flag'], [week.length, 'Due in the next 7 days', '', 'calendar'], [doneWeek.length, 'Done this week', 'good', 'check']].map(([n, l, c, ic]) => `<div class="lf-stat ${c}"><span class="lf-stat-ic">${icon(ic, 16)}</span><b>${n}</b><span>${esc(t(l))}</span></div>`).join('')}</div>`;
      const classes = [...new Set(all.filter(isOpen).map(x => x.course || ''))];
      const filt = classes.length > 1 ? `<div class="lf-filter" role="group" aria-label="${esc(t('Show'))}"><button type="button" class="lf-fchip${!this.filter ? ' on' : ''}" data-action="f-class" data-c="">${esc(t('All'))}</button>${classes.filter(Boolean).map(id => `<button type="button" class="lf-fchip${this.filter === id ? ' on' : ''}" data-action="f-class" data-c="${esc(id)}" style="${L.ccStyle(id)}"><i></i>${esc(Courses[id] ? Courses[id].short : id)}</button>`).join('')}${classes.includes('') ? `<button type="button" class="lf-fchip${this.filter === '@none' ? ' on' : ''}" data-action="f-class" data-c="@none">${esc(t('No class'))}</button>` : ''}</div>` : '';
      // this week: late, then day by day
      const days = []; for (let i = 0; i < 7; i++) days.push(L.addDaysISO(today, i));
      const grp = (label, list, cls = '') => list.length ? `<section class="tk-day ${cls}"><h3>${esc(label)}<small>${list.length}</small></h3>${list.sort(byDue).map(x => taskRow(x)).join('')}</section>` : '';
      let w = grp(t('Late'), late, 'late') + days.map(d => grp(`${L.relDay(d)}${App.daysBetween(today, d) > 1 ? '' : ' · ' + App.shortDate(d)}`, open.filter(x => x.due === d))).join('');
      const later = open.filter(x => !x.due || x.due > end);
      if (later.length) w += `<p class="muted small tk-later">${esc(t('{1} more without a date or due later. See Everything open.', later.length))}</p>`;
      $('#tk-week', root).innerHTML = filt + (w.trim() ? w : empty('todo', 'Nothing due this week', 'Add a task above, or bring in the deadlines from your classes.', `<button class="btn" type="button" data-action="import">${icon('download', 14)} ${esc(t('Deadlines from your classes'))}</button>`));
      $('#tk-open', root).innerHTML = filt + (open.length ? `<div class="tk-list">${open.sort(byDue).map(x => taskRow(x)).join('')}</div>` : empty('check', 'All done', 'Nothing open. Enjoy it.'));
      // the board
      const col = (st, label, list) => `<div class="kb-col" data-status="${st}"><div class="kb-h"><b>${esc(t(label))}</b><small>${list.length}</small></div><div class="kb-drop" data-drop="${st}">${list.map(x => `<div class="kb-card" draggable="true" data-id="${esc(x.id)}"><button class="kb-open" type="button" data-act="edit"><span class="tk-title">${esc(x.title)}</span><span class="tk-meta">${L.classChip(x.course)}<span class="lf-prio p-${esc(x.priority || 'medium')}">${esc(t(PRIO_LABEL[x.priority] || 'Medium'))}</span>${x.due ? `<span class="tk-due${isOpen(x) && x.due < today ? ' late' : ''}">${esc(dueTxt(x.due))}</span>` : ''}</span></button><span class="kb-move">${st !== 'todo' ? `<button class="icon-btn xs" type="button" data-act="move" data-to="${st === 'done' ? 'doing' : 'todo'}" aria-label="${esc(t('Move back'))}">${icon('left', 12)}</button>` : ''}${st !== 'done' ? `<button class="icon-btn xs" type="button" data-act="move" data-to="${st === 'todo' ? 'doing' : 'done'}" aria-label="${esc(t('Move on'))}">${icon('right', 12)}</button>` : ''}</span></div>`).join('') || `<p class="kb-none">${esc(t('Drop a task here'))}</p>`}</div></div>`;
      const recentDone = all.filter(x => x.status === 'done' && (x.doneAt || x.u || 0) > Date.now() - 7 * 86400000).filter(fit);
      $('#tk-board', root).innerHTML = filt + `<div class="kb">${col('todo', 'To do', open.filter(x => x.status !== 'doing').sort(byDue))}${col('doing', 'In progress', open.filter(x => x.status === 'doing').sort(byDue))}${col('done', 'Done', recentDone.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)))}</div>`;
      const done = all.filter(x => x.status === 'done').sort((a, b) => (b.doneAt || b.u || 0) - (a.doneAt || a.u || 0));
      $('#tk-done', root).innerHTML = done.length ? `<div class="tk-list">${done.slice(0, 80).map(x => taskRow(x, { noPrio: true })).join('')}</div>${done.some(x => (x.doneAt || x.u) < Date.now() - 30 * 86400000) ? `<button class="btn sm ghost mt-2" type="button" data-action="clear-done">${icon('trash', 13)} ${esc(t('Clear what was done over a month ago'))}</button>` : ''}` : empty('check', 'Nothing done yet', 'Tick a task and it lands here.');
    },
    wireBoard(root, repaint) {
      let drag = null;
      root.addEventListener('dragstart', e => { const c = e.target.closest('.kb-card'); if (!c) return; drag = c.dataset.id; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', drag); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
      root.addEventListener('dragend', e => { const c = e.target.closest('.kb-card'); if (c) c.classList.remove('dragging'); $$('.kb-drop.over', root).forEach(z => z.classList.remove('over')); drag = null; });
      root.addEventListener('dragover', e => { const z = e.target.closest('.kb-drop'); if (!z || !drag) return; e.preventDefault(); $$('.kb-drop.over', root).forEach(o => o !== z && o.classList.remove('over')); z.classList.add('over'); });
      root.addEventListener('drop', e => { const z = e.target.closest('.kb-drop'); if (!z || !drag) return; e.preventDefault(); const st = z.dataset.drop; L.put('tasks', drag, { status: st, doneAt: st === 'done' ? Date.now() : 0 }); drag = null; repaint(); });
    }
  };

  /* ======================================================
     TIMETABLE
     ====================================================== */
  // meeting times written in a syllabus: "Mon / Wed / Fri, 9:00–9:50 am, Lewis 306", "Tue · Thu 9:25–10:40 am", "Section 01: …. Section 02: …"
  const DAY_WORDS = [[/\b(sun(day)?|su)\b/i, 0], [/\b(mon(day)?|mo|m)\b/i, 1], [/\b(tue(s(day)?)?|tu)\b/i, 2], [/\b(wed(nesday)?|we|w)\b/i, 3], [/\b(thu(rs(day)?)?|th|r)\b/i, 4], [/\b(fri(day)?|fr|f)\b/i, 5], [/\b(sat(urday)?|sa)\b/i, 6]];
  function parseDays(s) { const out = new Set(); let x = ' ' + s.replace(/[·/,&+]|\band\b/gi, ' ') + ' '; const packed = /\b([MTWRF]{2,5})\b/.exec(x); if (packed) { packed[1].split('').forEach(ch => out.add({ M: 1, T: 2, W: 3, R: 4, F: 5 }[ch])); x = x.replace(packed[0], ' '); } if (/\bTTh\b|\bTuTh\b/i.test(x)) { out.add(2); out.add(4); } DAY_WORDS.forEach(([re, d]) => { if (re.test(x)) out.add(d); }); if (/mon\w*\s*[–-]\s*thu/i.test(s)) [1, 2, 3, 4].forEach(d => out.add(d)); if (/mon\w*\s*[–-]\s*fri/i.test(s)) [1, 2, 3, 4, 5].forEach(d => out.add(d)); return [...out].sort(); }
  function parseTimes(s) {
    const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|noon)?/i.exec(s);
    const conv = (h, mi, ap, ref) => { h = +h; mi = +(mi || 0); const a = (ap || '').toLowerCase(); if (a.startsWith('p') && h < 12) h += 12; if (a.startsWith('a') && h === 12) h = 0; if (a === 'noon') { h = 12; mi = 0; } if (!a && ref != null && h < ref / 60 && h + 12 < 24) h += 12; return h * 60 + mi; };
    if (m) { let end = m[6] === undefined && /noon/i.test(s.slice(m.index, m.index + m[0].length + 6)) ? 12 * 60 : null; const endAp = m[6] || ''; const startAp = m[3] || (endAp && !/noon/i.test(endAp) && +m[1] <= +m[4] ? endAp : ''); const st = conv(m[1], m[2], startAp); if (end == null) end = conv(m[4], m[5], endAp || startAp, st); if (end <= st) end += 12 * 60; if (end - st > 0 && end - st <= 5 * 60) return { start: L.fromMin(st), end: L.fromMin(end) }; }
    const one = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(s); if (one) { const st = conv(one[1], one[2], one[3]); return { start: L.fromMin(st), end: L.fromMin(st + 50) }; }
    return null;
  }
  function parseMeets(text) {
    if (!text) return [];
    const parts = String(text).split(/(?:\.\s+|;\s*)(?=section|sect|lab|\b(?:mon|tue|wed|thu|fri)\w*\b)/i).map(x => x.trim()).filter(Boolean);
    const out = [];
    parts.forEach(p => {
      const label = (/^(section\s*\d+|sect\.?\s*\d+)/i.exec(p) || [])[1] || '';
      const days = parseDays(p.replace(/^(section|sect\.?)\s*\d+:?/i, '')); const tm = parseTimes(p); if (!days.length) return;
      const after = tm ? p.split(/\b(?:am|pm|noon)\b/i).pop() : ''; const room = (/,\s*([A-Z][A-Za-z.]+(?:\s+[A-Za-z.]+)?\s+\d{2,4}[A-Z]?)\b/.exec(after || p) || /\bin\s+([A-Z][A-Za-z.]+(?:\s+[A-Za-z.]+)?\s+\d{2,4}[A-Z]?)\b/.exec(p) || [])[1] || '';
      out.push({ label, days, start: tm ? tm.start : '', end: tm ? tm.end : '', place: room });
    });
    // "11:00 am (Sect 1) or 1:10 pm (Sect 2)": one option per time
    const alt = /(\d{1,2}:\d{2}\s*(?:am|pm))\s*\((sect[^)]*)\)\s*or\s*(\d{1,2}:\d{2}\s*(?:am|pm))\s*\((sect[^)]*)\)/i.exec(text);
    if (alt && out.length === 1) { const base = out[0]; const a = parseTimes(alt[1]), b = parseTimes(alt[3]); return [Object.assign({}, base, a, { label: alt[2] }), Object.assign({}, base, b, { label: alt[4] })]; }
    return out;
  }
  L.parseMeets = parseMeets;
  function suggestions(id) {
    const C = Courses[id]; const K = (C && C.COURSE) || {}; const out = [];
    parseMeets(K.lectures || K.meets || K.schedule || '').forEach(m => out.push(Object.assign({ kind: 'lecture' }, m)));
    if (!out.length && K.classDays) { const d = parseDays(K.classDays.split(/,|plus/i)[0]); if (d.length) out.push({ kind: 'lecture', days: d, start: '', end: '', place: '', label: '' }); }
    if (K.labs) parseMeets(K.labs).forEach(m => out.push(Object.assign({ kind: 'lab' }, m)));
    else if (/plus (one|a weekly|a tuesday|a thursday)? ?lab/i.test(K.classDays || '')) { const d = parseDays((/lab \(([^)]*)\)/i.exec(K.classDays) || /plus a (\w+) lab/i.exec(K.classDays) || ['', ''])[1]); out.push({ kind: 'lab', days: d.length === 1 ? d : [], start: '', end: '', place: '', label: '' }); }
    return out;
  }
  function importTimetable() {
    const have = L.all('slots'); const ids = L.mine();
    const blocks = ids.map(id => { const C = Courses[id]; const sug = suggestions(id); const has = have.some(s => s.course === id);
      const rows = sug.length ? sug.map((m, i) => `<div class="tt-imp-row" data-c="${esc(id)}" data-i="${i}"><label class="lf-check"><input type="checkbox" name="pick" ${has || (m.label && i > 0) || !m.start ? '' : 'checked'}><span><b>${esc(t(m.kind === 'lab' ? 'Lab' : 'Lecture'))}${m.label ? ' · ' + esc(m.label) : ''}</b></span></label><span class="tt-imp-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="lf-day sm"><input type="checkbox" name="d${d}" ${m.days.includes(d) ? 'checked' : ''}><span>${esc(t(L.DOW[d]).slice(0, 2))}</span></label>`).join('')}</span><input type="time" name="start" value="${esc(m.start)}" aria-label="${esc(t('Starts'))}"><input type="time" name="end" value="${esc(m.end)}" aria-label="${esc(t('Ends'))}"><input name="place" value="${esc(m.place)}" placeholder="${esc(t('Room'))}" aria-label="${esc(t('Room'))}"></div>`).join('') : `<p class="muted small">${esc(t('Its syllabus does not say when it meets. Add its times yourself.'))}</p>`;
      return `<section class="tt-imp" style="${L.ccStyle(id)}"><h3><i></i>${esc(C.short)} <small>${esc(C.name)}</small>${has ? `<span class="lf-chip">${esc(t('already in your timetable'))}</span>` : ''}</h3>${C.COURSE && (C.COURSE.lectures || C.COURSE.meets) ? `<p class="tt-imp-src">${icon('file', 12)} ${esc(C.COURSE.lectures || C.COURSE.meets)}</p>` : ''}${rows}</section>`; }).join('');
    L.form({ title: 'Your classes in your timetable', icon: 'download', wide: true, fields: [{ type: 'html', html: `<p class="muted small">${esc(t('Read from each class’s syllabus. Check the days and times for your section, then add them.'))}</p><div class="tt-imps">${blocks || `<p>${esc(t('Pick your classes first.'))}</p>`}</div>` }], submit: 'Add to my timetable', submitIcon: 'plus',
      onSave: () => { const form = $('.lf-modal'); let n = 0; const bad = []; $$('.tt-imp-row', form).forEach(r => { if (!$('input[name="pick"]', r).checked) return; const id = r.dataset.c; const sug = suggestions(id)[+r.dataset.i]; const days = [0, 1, 2, 3, 4, 5, 6].filter(d => $(`input[name="d${d}"]`, r).checked); const start = $('input[name="start"]', r).value, end = $('input[name="end"]', r).value; if (!days.length || !start || !end || L.toMin(end) <= L.toMin(start)) { bad.push(Courses[id].short); return; } L.add('slots', { title: `${Courses[id].short} ${t(sug.kind === 'lab' ? 'lab' : 'lecture')}`, course: id, kind: sug.kind, days, start, end, place: $('input[name="place"]', r).value.trim(), who: '' }); n++; }); if (bad.length) { toast(t('Check the days and times for {1}.', bad.join(', ')), 3600); return false; } toast(t('{1} added to your timetable', n)); } });
  }
  // lay a day's meetings side by side where they overlap
  function lanes(list) { const sorted = list.slice().sort((a, b) => L.toMin(a.start) - L.toMin(b.start)); const ends = []; const out = []; let cluster = []; let clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map(c => c.lane + 1)); cluster.forEach(c => { c.n = n; out.push(c); }); cluster = []; };
    sorted.forEach(s => { const st = L.toMin(s.start), en = L.toMin(s.end); if (st >= clusterEnd && cluster.length) { flush(); ends.length = 0; } let lane = ends.findIndex(e => e <= st); if (lane < 0) { lane = ends.length; ends.push(en); } else ends[lane] = en; cluster.push({ s, lane }); clusterEnd = Math.max(clusterEnd, en); });
    if (cluster.length) flush(); return out; }
  function ttGrid(opts = {}) {
    const slots = L.all('slots'); const weekend = L.cfg('ttWeekend', false) || slots.some(s => (s.days || []).some(d => d === 0 || d === 6));
    const days = weekend ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5];
    const mins = slots.flatMap(s => [L.toMin(s.start), L.toMin(s.end)]).filter(x => x != null);
    const startH = Math.max(0, Math.min(8, mins.length ? Math.floor(Math.min(...mins) / 60) : 8)); const endH = Math.min(24, Math.max(18, mins.length ? Math.ceil(Math.max(...mins) / 60) : 18));
    const PPH = opts.pph || 54; const H = (endH - startH) * PPH; const today = L.dowOf(tIso()); const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const hours = []; for (let h = startH; h < endH; h++) hours.push(h);
    const col = d => { const list = slots.filter(s => (s.days || []).includes(d)); const laid = lanes(list);
      return `<div class="tt-col${d === today ? ' today' : ''}" data-dow="${d}" style="height:${H}px">${hours.map(h => `<button class="tt-cell" type="button" data-add="${d}" data-h="${h}" style="top:${(h - startH) * PPH}px;height:${PPH}px" aria-label="${esc(t('Add something on {1} at {2}', t(L.DOW_LONG[d]), L.fmtTime(L.fromMin(h * 60))))}"></button>`).join('')}
        ${laid.map(({ s, lane, n }) => { const st = L.toMin(s.start), en = L.toMin(s.end); const top = (st - startH * 60) / 60 * PPH, ht = Math.max(22, (en - st) / 60 * PPH - 3); const clash = n > 1;
          return `<button class="tt-block${clash ? ' clash' : ''}${ht < 44 ? ' short' : ''}" type="button" data-slot="${esc(s.id)}" style="top:${top}px;height:${ht}px;left:calc(${(lane / n) * 100}% + 3px);width:calc(${100 / n}% - 6px);${s.course ? L.ccStyle(s.course) : ''}" title="${esc(s.title)} · ${esc(L.fmtTime(s.start))}–${esc(L.fmtTime(s.end))}${s.place ? ' · ' + esc(s.place) : ''}${clash ? ' · ' + esc(t('overlaps another')) : ''}"><b>${esc(s.title)}</b><span>${esc(L.fmtTime(s.start))}–${esc(L.fmtTime(s.end))}</span>${s.place ? `<span>${icon('door', 11)} ${esc(s.place)}</span>` : ''}</button>`; }).join('')}
        ${d === today && nowMin >= startH * 60 && nowMin <= endH * 60 ? `<i class="tt-now" style="top:${(nowMin - startH * 60) / 60 * PPH}px" aria-hidden="true"></i>` : ''}</div>`; };
    return `<div class="tt-wrap"><div class="tt" style="--tt-cols:${days.length}"><div class="tt-corner"></div>${days.map(d => `<div class="tt-dh${d === today ? ' today' : ''}"><b>${esc(t(L.DOW[d]))}</b></div>`).join('')}
      <div class="tt-hours" style="height:${H}px">${hours.map(h => `<span style="top:${(h - startH) * PPH}px">${esc(L.fmtTime(L.fromMin(h * 60)))}</span>`).join('')}</div>${days.map(col).join('')}</div></div>`;
  }
  function icsFor(slots) {
    const pad = n => String(n).padStart(2, '0'); const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const sem = L.mine().map(id => Courses[id] && Courses[id].SEMESTER).filter(Boolean)[0]; const until = (sem ? sem.end : L.addDaysISO(tIso(), 112)).replace(/-/g, '') + 'T235959';
    const first = d => { let x = tIso(); for (let i = 0; i < 7; i++) { if (L.dowOf(x) === d) return x; x = L.addDaysISO(x, 1); } return tIso(); };
    const esc2 = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyCat//Timetable//EN', 'CALSCALE:GREGORIAN'];
    slots.forEach(s => { const d0 = Math.min(...s.days.map(d => App.daysBetween(tIso(), first(d)))); const day = L.addDaysISO(tIso(), d0).replace(/-/g, ''); const [sh, sm] = s.start.split(':'), [eh, em] = s.end.split(':');
      lines.push('BEGIN:VEVENT', `UID:${s.id}@studycat.org`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${day}T${pad(sh)}${pad(sm)}00`, `DTEND:${day}T${pad(eh)}${pad(em)}00`, `RRULE:FREQ=WEEKLY;BYDAY=${s.days.map(d => BY[d]).join(',')};UNTIL=${until}`, `SUMMARY:${esc2(s.title)}`, s.place ? `LOCATION:${esc2(s.place)}` : '', 'END:VEVENT'); });
    lines.push('END:VCALENDAR'); return lines.filter(Boolean).join('\r\n');
  }
  App.views.timetable = {
    title: 'Timetable', blurb: 'Your week: classes, labs, work shifts and study blocks. Click an empty hour to add something there.',
    render(root) {
      const slots = L.all('slots');
      root.innerHTML = `<div class="lf-page tt-page">${head('Timetable', this.blurb, `<button class="btn" type="button" data-action="import">${icon('download', 14)} ${esc(t('From your classes'))}</button><button class="btn tt-has" type="button" data-action="ics" title="${esc(t('A calendar file for Google, Apple or Outlook Calendar'))}"${slots.length ? '' : ' hidden'}>${icon('calendar', 14)} ${esc(t('Add to your phone'))}</button><button class="btn tt-has" type="button" data-action="print"${slots.length ? '' : ' hidden'}>${icon('print', 14)} ${esc(t('Print'))}</button><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('Add'))}</button>`)}
        <div id="tt-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, { new: () => App.quickAdd('slot'), import: importTimetable, print: () => global.print(), weekend: () => { L.setCfg('ttWeekend', !L.cfg('ttWeekend', false)); paint(); },
        ics: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([icsFor(L.all('slots'))], { type: 'text/calendar' })); a.download = 'mathub-timetable.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast(t('Open the file to add your timetable to your calendar')); } });
      root.addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { L.editSlot(b.dataset.slot); return; } const c = e.target.closest('[data-add]'); if (c) { const h = +c.dataset.h; App.quickAdd('slot', { days: [+c.dataset.add], start: L.fromMin(h * 60), end: L.fromMin(h * 60 + 50) }); } });
    },
    paint(root) {
      const slots = L.all('slots'); const body = $('#tt-body', root); const iso = tIso();
      $$('.tt-has', root).forEach(b => { b.hidden = !slots.length; });
      if (!slots.length) { body.innerHTML = `<div class="panel tt-start"><div class="tt-start-in">${icon('table', 34)}<div><h2>${esc(t('Build your week'))}</h2><p>${esc(t('StudyCat can read when your classes meet from their syllabi. Then add labs, work shifts and study blocks, and see your whole week at a glance.'))}</p><div class="row gap-sm mt-2" style="flex-wrap:wrap"><button class="btn primary" type="button" data-action="import">${icon('download', 14)} ${esc(t('Bring in my classes'))}</button><button class="btn" type="button" data-action="new">${icon('plus', 14)} ${esc(t('Add something myself'))}</button></div></div></div></div>` + ttGrid(); return; }
      const todays = L.slotsOn(iso); const nowM = new Date().getHours() * 60 + new Date().getMinutes(); const next = todays.find(s => L.toMin(s.end) > nowM);
      const hours = slots.reduce((n, s) => n + (L.toMin(s.end) - L.toMin(s.start)) * (s.days || []).length, 0) / 60;
      const byKind = {}; slots.forEach(s => { const h = (L.toMin(s.end) - L.toMin(s.start)) * (s.days || []).length / 60; byKind[s.kind || 'other'] = (byKind[s.kind || 'other'] || 0) + h; });
      body.innerHTML = `<div class="tt-top"><div class="panel tt-now-card"><div class="lf-label-row">${icon('clock', 15)} <b>${esc(t('Today'))}</b><span class="muted small">${esc(App.fmtDate(iso, true))}</span></div>${todays.length ? `<ul class="tt-today">${todays.map(s => { const st = L.toMin(s.start), en = L.toMin(s.end); const state = en <= nowM ? 'past' : st <= nowM ? 'now' : ''; return `<li class="${state}" style="${s.course ? L.ccStyle(s.course) : ''}"><span class="tt-t">${esc(L.fmtTime(s.start))}</span><span class="tt-dot"></span><button type="button" data-slot="${esc(s.id)}"><b>${esc(s.title)}</b><small>${esc(L.fmtTime(s.start))}–${esc(L.fmtTime(s.end))}${s.place ? ' · ' + esc(s.place) : ''}</small></button>${state === 'now' ? `<span class="lf-chip now">${esc(t('now'))}</span>` : s === next ? `<span class="lf-chip">${esc(t('in {1} min', st - nowM))}</span>` : ''}</li>`; }).join('')}</ul>` : `<p class="muted">${esc(t('Nothing on your timetable today.'))}</p>`}</div>
        <div class="panel tt-sum"><div class="lf-label-row">${icon('pie', 15)} <b>${esc(t('Your week'))}</b></div><div class="tt-sum-big"><b>${Math.round(hours * 10) / 10}</b><span>${esc(t('hours planned'))}</span></div><div class="tt-kinds">${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, h]) => `<span class="lf-chip">${esc(t((L.SLOT_KIND.find(x => x[0] === k) || [k, k])[1]))} · ${Math.round(h * 10) / 10} h</span>`).join('')}</div><button class="btn sm ghost" type="button" data-action="weekend">${icon('calendar', 13)} ${esc(t(L.cfg('ttWeekend', false) ? 'Hide the weekend' : 'Show the weekend'))}</button></div></div>` + ttGrid() +
        `<div class="tt-days-list" aria-label="${esc(t('Day by day'))}">${[1, 2, 3, 4, 5, 6, 0].map(d => { const list = slots.filter(s => (s.days || []).includes(d)).sort((a, b) => a.start.localeCompare(b.start)); return list.length ? `<section><h3>${esc(t(L.DOW_LONG[d]))}</h3>${list.map(s => `<button class="tt-li" type="button" data-slot="${esc(s.id)}" style="${s.course ? L.ccStyle(s.course) : ''}"><i></i><b>${esc(s.title)}</b><span>${esc(L.fmtTime(s.start))}–${esc(L.fmtTime(s.end))}${s.place ? ' · ' + esc(s.place) : ''}</span></button>`).join('')}</section>` : ''; }).join('')}</div>`;
    }
  };
  L.ttGrid = ttGrid;

  /* ======================================================
     CALENDAR (agenda)
     ====================================================== */
  const KIND_IC = { exam: 'flag', deadline: 'clock', assignment: 'file', task: 'todo', event: 'calendar', todo: 'check', holiday: 'sun', note: 'info' };
  const KIND_NAME = { exam: 'Exam', deadline: 'Deadline', assignment: 'Assignment', task: 'Task', event: 'Event', todo: 'To-do', holiday: 'No class', note: 'Note' };
  function itemChip(x, compact) {
    const cls = `ag-item k-${x.kind}${x.done ? ' done' : ''}`; const st = x.course ? L.ccStyle(x.course) : '';
    const inner = `${icon(KIND_IC[x.kind] || 'calendar', 12)}<span>${x.time && !compact ? `<small>${esc(L.fmtTime(x.time))}</small> ` : ''}${esc(x.title)}</span>`;
    if (x.col) return `<button class="${cls}" type="button" style="${st}" data-col="${x.col}" data-id="${esc(x.id)}" title="${esc(x.title)}">${inner}</button>`;
    return x.href ? `<a class="${cls}" style="${st}" href="${esc(x.href)}"${/^https?:/.test(x.href) ? ' target="_blank" rel="noopener"' : ''} title="${esc(x.title)}${x.sub ? ' · ' + esc(x.sub) : ''}">${inner}</a>` : `<span class="${cls}" style="${st}" title="${esc(x.title)}">${inner}</span>`;
  }
  function openItem(col, id) { if (col === 'tasks') L.editTask(id); else if (col === 'events') L.editEvent(id); else if (col === 'todos') { const x = L.get('todos', id); if (x) { L.put('todos', id, { done: !x.done }); } } }
  App.views.agenda = {
    title: 'Calendar', blurb: 'Every exam, deadline, task and event, from all your classes and your own planner.',
    render(root, param, query) {
      if (query && L.ISO_RE.test(query.d || '')) { this.sel = query.d; this.anchor = query.d; }
      this.sel = this.sel || tIso(); this.anchor = this.anchor || this.sel;
      const mode = settings().agendaMode || 'month';
      root.innerHTML = `<div class="lf-page ag-page">${head('Calendar', this.blurb, `<div class="lf-seg-btns" role="group" aria-label="${esc(t('View'))}">${[['month', 'Month'], ['week', 'Week'], ['list', 'List']].map(([k, l]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-action="mode" data-m="${k}" aria-pressed="${mode === k}">${esc(t(l))}</button>`).join('')}</div><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New event'))}</button>`)}
        <div class="ag-bar"><button class="icon-btn" type="button" data-action="prev" aria-label="${esc(t('Earlier'))}">${icon('left', 15)}</button><h2 id="ag-label"></h2><button class="icon-btn" type="button" data-action="next" aria-label="${esc(t('Later'))}">${icon('right', 15)}</button><button class="btn sm" type="button" data-action="today">${esc(t('Today'))}</button><span class="ag-legend">${['exam', 'deadline', 'task', 'event'].map(k => `<span class="ag-lg k-${k}">${icon(KIND_IC[k], 12)} ${esc(t(KIND_NAME[k]))}</span>`).join('')}</span></div>
        <div id="ag-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      const step = dir => { const m = settings().agendaMode || 'month'; const a = App.parseISO(this.anchor); if (m === 'month') this.anchor = App.toISO(new Date(a.getFullYear(), a.getMonth() + dir, 1)); else this.anchor = L.addDaysISO(this.anchor, dir * (m === 'week' ? 7 : 30)); paint(); };
      App.bind(root, { mode: el => { setSetting('agendaMode', el.dataset.m); $$('[data-action="mode"]', root).forEach(b => { const on = b.dataset.m === el.dataset.m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); paint(); }, prev: () => step(-1), next: () => step(1), today: () => { this.anchor = this.sel = tIso(); paint(); }, new: () => App.quickAdd('event', { date: this.sel }), 'add-day': el => App.quickAdd(el.dataset.t || 'event', { date: el.dataset.d, due: el.dataset.d }) });
      root.addEventListener('click', e => { const it = e.target.closest('[data-col]'); if (it) { openItem(it.dataset.col, it.dataset.id); return; } const day = e.target.closest('[data-day]'); if (day && !e.target.closest('a, button.ag-item, [data-action]')) { this.sel = day.dataset.day; paint(); } });
    },
    paint(root) {
      const mode = settings().agendaMode || 'month'; const body = $('#ag-body', root); const label = $('#ag-label', root); const today = tIso();
      if (mode === 'month') {
        const a = App.parseISO(this.anchor); const first = App.toISO(new Date(a.getFullYear(), a.getMonth(), 1)); const last = App.toISO(new Date(a.getFullYear(), a.getMonth() + 1, 0)); const ws = L.cfg('weekStart', 1);
        const start = L.addDaysISO(first, -((App.parseISO(first).getDay() - ws + 7) % 7)); const weeks = Math.ceil((App.daysBetween(start, last) + 1) / 7); const end = L.addDaysISO(start, weeks * 7 - 1);
        const items = L.items(start, end); const by = {}; items.forEach(x => (by[x.date] = by[x.date] || []).push(x));
        label.textContent = `${L.monthName(a.getMonth())} ${a.getFullYear()}`;
        let cells = ''; for (let i = 0; i < weeks * 7; i++) { const d = L.addDaysISO(start, i); const list = (by[d] || []).filter(x => x.kind !== 'note'); const show = list.slice(0, 3);
          cells += `<div class="ag-cell${d.slice(0, 7) !== first.slice(0, 7) ? ' out' : ''}${d === today ? ' today' : ''}${d === this.sel ? ' sel' : ''}${list.some(x => x.kind === 'holiday') ? ' hol' : ''}" data-day="${d}" role="group" aria-label="${esc(App.fmtDate(d, true))}: ${list.length ? esc(t('{1} things', list.length)) : esc(t('nothing'))}"><span class="ag-n">${App.parseISO(d).getDate()}</span>${show.filter(x => x.kind !== 'holiday').map(x => itemChip(x, true)).join('')}${list.length > 3 ? `<span class="ag-more">${esc(t('+{1} more', list.length - 3))}</span>` : ''}</div>`; }
        body.innerHTML = `<div class="ag-month"><div class="ag-heads">${Array.from({ length: 7 }, (_, i) => `<span>${esc(t(L.DOW[(ws + i) % 7]))}</span>`).join('')}</div><div class="ag-grid">${cells}</div></div>${this.dayPanel(this.sel, by[this.sel] || L.items(this.sel, this.sel))}`;
      } else if (mode === 'week') {
        const ws = L.weekStart(this.anchor); const we = L.addDaysISO(ws, 6); const items = L.items(ws, we); const by = {}; items.forEach(x => (by[x.date] = by[x.date] || []).push(x));
        label.textContent = `${App.shortDate(ws)} – ${App.shortDate(we)}`;
        body.innerHTML = `<div class="ag-week">${Array.from({ length: 7 }, (_, i) => { const d = L.addDaysISO(ws, i); const list = (by[d] || []).filter(x => x.kind !== 'note'); const slots = L.slotsOn(d);
          return `<section class="ag-wday${d === today ? ' today' : ''}" data-day="${d}"><h3><span>${esc(t(L.DOW[L.dowOf(d)]))}</span><b>${App.parseISO(d).getDate()}</b></h3>${slots.map(s => `<div class="ag-slot" style="${s.course ? L.ccStyle(s.course) : ''}"><small>${esc(L.fmtTime(s.start))}</small> ${esc(s.title)}</div>`).join('')}${list.map(x => itemChip(x)).join('')}<button class="ag-add" type="button" data-action="add-day" data-d="${d}" aria-label="${esc(t('Add on {1}', App.fmtDate(d, true)))}">${icon('plus', 13)}</button></section>`; }).join('')}</div>`;
      } else {
        const from = this.anchor < today ? this.anchor : today; const to = L.addDaysISO(from, 34); const items = L.items(from, to).filter(x => x.kind !== 'note'); const by = {}; items.forEach(x => (by[x.date] = by[x.date] || []).push(x));
        label.textContent = `${App.shortDate(from)} – ${App.shortDate(to)}`;
        const days = Object.keys(by).sort();
        body.innerHTML = days.length ? `<div class="ag-list">${days.map(d => `<section class="ag-lday${d === today ? ' today' : ''}"><h3><b>${esc(L.relDay(d))}</b><span>${esc(App.fmtDate(d, true))}</span></h3><div>${by[d].map(x => `<div class="ag-lrow">${itemChip(x)}${x.course && Courses[x.course] ? `<span class="muted small">${esc(Courses[x.course].short)}</span>` : ''}${x.sub ? `<span class="muted small">${esc(x.sub)}</span>` : ''}</div>`).join('')}</div></section>`).join('')}</div>` : empty('calendar', 'A quiet five weeks', 'Nothing dated yet. Add an event, or pick your classes to see their exams and deadlines.');
      }
    },
    dayPanel(d, list) {
      list = (list || []).filter(x => x.kind !== 'note'); const slots = L.slotsOn(d);
      return `<div class="panel ag-day"><div class="ag-day-h"><div><h3>${esc(L.relDay(d))}</h3><span class="muted">${esc(App.fmtDate(d, true))}</span></div><div class="row gap-sm"><button class="btn sm" type="button" data-action="add-day" data-t="task" data-d="${d}">${icon('todo', 13)} ${esc(t('Task'))}</button><button class="btn sm primary" type="button" data-action="add-day" data-t="event" data-d="${d}">${icon('plus', 13)} ${esc(t('Event'))}</button></div></div>
        ${slots.length ? `<div class="ag-day-slots">${slots.map(s => `<span class="ag-slot" style="${s.course ? L.ccStyle(s.course) : ''}"><small>${esc(L.fmtTime(s.start))}–${esc(L.fmtTime(s.end))}</small> ${esc(s.title)}${s.place ? ` · ${esc(s.place)}` : ''}</span>`).join('')}</div>` : ''}
        ${list.length ? `<div class="ag-day-list">${list.map(x => `<div class="ag-lrow">${itemChip(x)}${x.course && Courses[x.course] ? `<span class="muted small">${esc(Courses[x.course].short)}</span>` : ''}${x.sub ? `<span class="muted small">${esc(x.sub)}</span>` : ''}</div>`).join('')}</div>` : `<p class="muted small">${esc(t('Nothing due. A good day to get ahead.'))}</p>`}</div>`;
    }
  };

  /* ======================================================
     TIME TRACKER
     ====================================================== */
  const fmtDur = m => { m = Math.round(m); const h = Math.floor(m / 60), mm = m % 60; return h ? (mm ? `${h} h ${mm} min` : `${h} h`) : `${mm} min`; };
  L.fmtDur = fmtDur;
  const hhmmss = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  L.timerStart = (course, what) => { L.setCfg('timer', { start: Date.now(), course: course || '', what: what || '' }); };
  L.timerStop = () => { const tm = L.cfg('timer', null); if (!tm || !tm.start) return null; const mins = (Date.now() - tm.start) / 60000; L.setCfg('timer', null); if (mins < 1) { toast(t('Under a minute, so it was not saved.')); return null; } const shift = Math.round((App.parseISO(L.today()) - App.parseISO(App.toISO(new Date()))) / 864e5);   // logged on the app’s date, which a date set for testing can move
    const rec = L.add('timelog', { date: L.addDaysISO(App.toISO(new Date(tm.start)), shift), course: tm.course || '', what: tm.what || '', mins: Math.round(mins) }); toast(t('{1} saved', fmtDur(mins))); return rec; };
  App.views.timelog = {
    title: 'Time tracker', blurb: 'Where your study hours go, class by class. The Focus room’s minutes count too.',
    render(root) {
      root.innerHTML = `<div class="lf-page tl-page">${head('Time tracker', this.blurb, `<button class="btn" type="button" data-action="manual">${icon('plus', 14)} ${esc(t('Add time by hand'))}</button>`)}<div id="tl-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, { start: () => { const f = $('#tl-form', root); L.timerStart(f.course.value, f.what.value.trim()); paint(); }, stop: () => { L.timerStop(); paint(); },
        manual: () => L.form({ title: 'Add study time', icon: 'timer', fields: [{ k: 'course', label: 'Class', type: 'class' }, { k: 'what', label: 'What you did', opt: true, max: 100, ph: 'Problem set 4' }, { k: 'date', label: 'Date', type: 'date', req: true, half: true }, { k: 'mins', label: 'Minutes', type: 'number', req: true, min: 1, half: true, ph: '45' }], values: { date: tIso(), course: '' }, submit: 'Add', onSave: v => { if (!(v.mins > 0)) return false; L.add('timelog', { date: v.date, course: v.course, what: v.what, mins: Math.round(v.mins) }); toast(t('Saved')); paint(); } }),
        del: el => { L.drop('timelog', el.dataset.id, t('Entry deleted')); paint(); } });
      clearInterval(this.tick); this.tick = setInterval(() => { const el = $('#tl-clock', root); const tm = L.cfg('timer', null); if (!root.isConnected) { clearInterval(this.tick); return; } if (el && tm && tm.start) el.textContent = hhmmss(Math.floor((Date.now() - tm.start) / 1000)); }, 1000);
    },
    unmount() { clearInterval(this.tick); },
    paint(root) {
      const tm = L.cfg('timer', null); const log = L.all('timelog'); const focus = settings().focusLog || {}; const today = tIso(); const ws = L.weekStart(today);
      const days = Array.from({ length: 7 }, (_, i) => L.addDaysISO(ws, i));
      const dayMin = d => log.filter(x => x.date === d).reduce((n, x) => n + (x.mins || 0), 0) + (focus[d] || 0);
      const max = Math.max(60, ...days.map(dayMin)); const weekMin = days.reduce((n, d) => n + dayMin(d), 0);
      const per = {}; log.filter(x => x.date >= ws).forEach(x => { per[x.course || ''] = (per[x.course || ''] || 0) + x.mins; }); const focusWeek = days.reduce((n, d) => n + (focus[d] || 0), 0); if (focusWeek) per['@focus'] = focusWeek;
      const perMax = Math.max(1, ...Object.values(per));
      $('#tl-body', root).innerHTML = `<div class="tl-top"><form class="panel tl-timer${tm && tm.start ? ' on' : ''}" id="tl-form" onsubmit="return false"><div class="tl-clock" id="tl-clock" aria-live="off">${tm && tm.start ? hhmmss(Math.floor((Date.now() - tm.start) / 1000)) : '00:00:00'}</div>
        ${tm && tm.start ? `<p class="tl-on">${icon('timer', 14)} ${esc(tm.what || t('Studying'))}${tm.course && Courses[tm.course] ? ' · ' + esc(Courses[tm.course].short) : ''}</p><button class="btn primary lg" type="button" data-action="stop">${icon('stop', 15)} ${esc(t('Stop and save'))}</button>` : `<div class="tl-fields"><select name="course" aria-label="${esc(t('Class'))}">${L.classOptions('Not for a class').map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select><input name="what" maxlength="100" placeholder="${esc(t('What are you working on?'))}" aria-label="${esc(t('What are you working on?'))}"></div><button class="btn primary lg" type="button" data-action="start">${icon('play', 15)} ${esc(t('Start the timer'))}</button>`}
        <p class="muted small">${esc(t('The timer keeps running if you close the page.'))}</p></form>
        <div class="panel tl-week"><div class="lf-label-row">${icon('chart', 15)} <b>${esc(t('This week'))}</b><span class="tl-total">${esc(fmtDur(weekMin))}</span></div><div class="tl-bars">${days.map(d => { const m = dayMin(d); return `<div class="tl-bar${d === today ? ' today' : ''}"><span class="tl-bar-v">${m ? esc(fmtDur(m)) : ''}</span><i style="height:${Math.round((m / max) * 100)}%"></i><b>${esc(t(L.DOW[L.dowOf(d)]).slice(0, 2))}</b></div>`; }).join('')}</div></div></div>
        <div class="grid cols-2 mt-2"><div class="panel"><div class="lf-label-row">${icon('pie', 15)} <b>${esc(t('By class, this week'))}</b></div>${Object.keys(per).length ? Object.entries(per).sort((a, b) => b[1] - a[1]).map(([id, m]) => `<div class="tl-per" style="${id && id !== '@focus' ? L.ccStyle(id) : ''}"><span>${esc(id === '@focus' ? t('Focus room') : id && Courses[id] ? Courses[id].short : t('Not for a class'))}</span><div class="sb-track"><i style="width:${Math.round(m / perMax * 100)}%"></i></div><b>${esc(fmtDur(m))}</b></div>`).join('') : `<p class="muted small">${esc(t('Start the timer when you sit down to study.'))}</p>`}</div>
        <div class="panel"><div class="lf-label-row">${icon('list', 15)} <b>${esc(t('Recent'))}</b></div>${log.length ? `<div class="tl-log">${log.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.c || 0) - (a.c || 0)).slice(0, 12).map(x => `<div class="tl-row">${L.classChip(x.course) || `<span class="lf-chip">${esc(t('Other'))}</span>`}<span>${esc(x.what || t('Study time'))}</span><span class="muted small">${esc(L.relDay(x.date))}</span><b>${esc(fmtDur(x.mins))}</b><button class="icon-btn xs" type="button" data-action="del" data-id="${esc(x.id)}" aria-label="${esc(t('Delete'))}">${icon('trash', 12)}</button></div>`).join('')}</div>` : `<p class="muted small">${esc(t('Nothing logged yet.'))}</p>`}</div></div>`;
    }
  };

  /* ======================================================
     PROJECTS & THESIS
     ====================================================== */
  const TEMPLATES = {
    thesis: ['Pick a topic and a question', 'Meet your advisor', 'Proposal', 'Literature review', 'Methods', 'Collect data', 'Results', 'Discussion', 'Full draft', 'Revisions with your advisor', 'Final submission'],
    paper: ['Pick a topic', 'Find 5 sources', 'Outline', 'First draft', 'Peer review or writing center', 'Revise', 'Cite and format', 'Submit'],
    lab: ['Read the lab handout', 'Collect the data', 'Analysis and graphs', 'Draft: methods and results', 'Discussion and conclusion', 'Proofread and submit'],
    talk: ['Pick the main message', 'Outline the slides', 'Make the slides', 'Rehearse twice', 'Present'],
    other: []
  };
  const TYPE_NAME = { thesis: 'Thesis', paper: 'Research paper', lab: 'Lab report', talk: 'Presentation', other: 'Project' };
  function spread(steps, due) { if (!due) return steps.map(s => ({ id: L.uid(), title: s, date: '', done: false })); const n = steps.length; const span = Math.max(n, App.daysBetween(tIso(), due)); return steps.map((s, i) => ({ id: L.uid(), title: s, date: L.addDaysISO(tIso(), Math.round(((i + 1) / n) * span)), done: false })); }
  App.views.projects = {
    title: 'Projects & thesis', blurb: 'Big pieces of work, broken into steps you can finish, with word counts and sources.',
    render(root) {
      root.innerHTML = `<div class="lf-page pj-page">${head('Projects & thesis', this.blurb, `<button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New project'))}</button>`)}<div id="pj-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, {
        new: () => L.form({ title: 'New project', icon: 'folder', fields: [{ k: 'title', label: 'Name', req: true, max: 120, ph: 'Senior thesis' }, { k: 'type', label: 'Kind', type: 'select', options: Object.entries(TYPE_NAME), half: true }, { k: 'course', label: 'Class', type: 'class', half: true }, { k: 'due', label: 'Due', type: 'date', half: true }, { k: 'words', label: 'Word goal', type: 'number', opt: true, min: 0, half: true, ph: '8000' }, { k: 'tpl', label: 'Start with the usual steps for this kind', type: 'check' }], values: { type: 'paper', tpl: true }, submit: 'Create',
          onSave: v => { const p = L.add('projects', { title: v.title, type: v.type, course: v.course, due: v.due, goal: v.words || 0, wrote: 0, steps: v.tpl ? spread(TEMPLATES[v.type] || [], v.due) : [], sources: [], notes: '' }); this.open = p.id; toast(t('Project created')); paint(); } }),
        open: el => { this.open = this.open === el.dataset.id ? null : el.dataset.id; paint(); },
        edit: el => { const p = L.get('projects', el.dataset.id); if (!p) return; L.form({ title: 'Edit project', icon: 'pen', fields: [{ k: 'title', label: 'Name', req: true, max: 120 }, { k: 'type', label: 'Kind', type: 'select', options: Object.entries(TYPE_NAME), half: true }, { k: 'course', label: 'Class', type: 'class', half: true }, { k: 'due', label: 'Due', type: 'date', half: true }, { k: 'goal', label: 'Word goal', type: 'number', opt: true, min: 0, half: true }], values: p, onSave: v => { L.put('projects', p.id, v); paint(); }, onDelete: () => { L.drop('projects', p.id, t('Project deleted')); paint(); } }); },
        step: el => { const p = L.get('projects', el.dataset.p); if (!p) return; const steps = (p.steps || []).map(s => s.id === el.dataset.s ? Object.assign({}, s, { done: !s.done }) : s); L.put('projects', p.id, { steps }); paint(); },
        'step-del': el => { const p = L.get('projects', el.dataset.p); if (!p) return; L.put('projects', p.id, { steps: (p.steps || []).filter(s => s.id !== el.dataset.s) }); paint(); },
        'src-del': el => { const p = L.get('projects', el.dataset.p); if (!p) return; L.put('projects', p.id, { sources: (p.sources || []).filter(s => s.id !== el.dataset.s) }); paint(); }
      });
      root.addEventListener('submit', e => {
        const f = e.target; const p = f.dataset.p && L.get('projects', f.dataset.p); if (!p) return; e.preventDefault();
        if (f.dataset.f === 'step') { const title = f.title.value.trim(); if (!title) return; L.put('projects', p.id, { steps: (p.steps || []).concat([{ id: L.uid(), title, date: f.date.value, done: false }]) }); }
        if (f.dataset.f === 'src') { const title = f.title.value.trim(); if (!title) return; const url = f.url.value.trim(); L.put('projects', p.id, { sources: (p.sources || []).concat([{ id: L.uid(), title, url: /^https?:\/\//i.test(url) ? url : '', note: '' }]) }); }
        if (f.dataset.f === 'words') { const n = Math.max(0, Math.round(+f.wrote.value || 0)); L.put('projects', p.id, { wrote: n }); toast(t('{1} words. Keep going.', n.toLocaleString())); }
        paint();
      });
      root.addEventListener('change', e => { const ta = e.target.closest('textarea[data-notes]'); if (ta) L.put('projects', ta.dataset.notes, { notes: ta.value }); });
    },
    paint(root) {
      const list = L.all('projects').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      if (this.open === undefined && list.length === 1) this.open = list[0].id;   // one project: open it
      if (!list.length) { $('#pj-body', root).innerHTML = empty('folder', 'No projects yet', 'A thesis, a research paper or a lab report: make it a project and StudyCat spreads its steps out until the due date.', `<button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New project'))}</button>`); return; }
      $('#pj-body', root).innerHTML = `<div class="pj-list">${list.map(p => { const steps = p.steps || []; const done = steps.filter(s => s.done).length; const pc = steps.length ? Math.round(done / steps.length * 100) : 0; const next = steps.find(s => !s.done); const open = this.open === p.id; const left = p.due ? App.daysBetween(tIso(), p.due) : null; const wp = p.goal ? Math.min(100, Math.round((p.wrote || 0) / p.goal * 100)) : 0;
        return `<article class="panel pj${open ? ' open' : ''}" style="${p.course ? L.ccStyle(p.course) : ''}">
          <div class="pj-h"><button class="pj-title" type="button" data-action="open" data-id="${esc(p.id)}" aria-expanded="${open}"><span class="pj-ic">${icon(p.type === 'thesis' ? 'cap' : p.type === 'lab' ? 'flask' : p.type === 'talk' ? 'megaphone' : 'folder', 18)}</span><span><b>${esc(p.title)}</b><small>${esc(t(TYPE_NAME[p.type] || 'Project'))}${p.course && Courses[p.course] ? ' · ' + esc(Courses[p.course].short) : ''}${p.due ? ' · ' + esc(t('due {1}', App.shortDate(p.due))) : ''}</small></span></button>${left != null ? `<span class="pj-left${left <= 7 ? ' soon' : ''}">${left < 0 ? esc(t('{1} days late', -left)) : left === 0 ? esc(t('due today')) : esc(t('{1} days left', left))}</span>` : ''}<button class="icon-btn" type="button" data-action="edit" data-id="${esc(p.id)}" aria-label="${esc(t('Edit'))}">${icon('pen', 14)}</button></div>
          <div class="pj-prog"><div class="sb-track"><i style="width:${pc}%"></i></div><span>${esc(t('{1} of {2} steps', done, steps.length))}</span>${next ? `<span class="pj-next">${esc(t('Next: {1}', next.title))}${next.date ? ' · ' + esc(L.relDay(next.date)) : ''}</span>` : steps.length ? `<span class="pj-next good">${esc(t('Every step done'))}</span>` : ''}</div>
          ${open ? `<div class="pj-body"><div class="pj-cols"><div><h4>${esc(t('Steps'))}</h4><ul class="pj-steps">${steps.map(s => `<li class="${s.done ? 'done' : ''}"><button class="tk-check" type="button" data-action="step" data-p="${esc(p.id)}" data-s="${esc(s.id)}" role="checkbox" aria-checked="${!!s.done}" aria-label="${esc(s.title)}">${icon('check', 13)}</button><span>${esc(s.title)}</span>${s.date ? `<small>${esc(App.shortDate(s.date))}</small>` : ''}<button class="icon-btn xs" type="button" data-action="step-del" data-p="${esc(p.id)}" data-s="${esc(s.id)}" aria-label="${esc(t('Remove'))}">${icon('x', 11)}</button></li>`).join('')}</ul><form class="lf-inline sm" data-f="step" data-p="${esc(p.id)}"><input name="title" maxlength="120" placeholder="${esc(t('Add a step'))}" aria-label="${esc(t('Add a step'))}"><input name="date" type="date" aria-label="${esc(t('Date'))}"><button class="btn sm" type="submit">${esc(t('Add'))}</button></form></div>
            <div>${p.goal ? `<h4>${esc(t('Words'))}</h4><div class="pj-words"><b>${(p.wrote || 0).toLocaleString()}</b><span>/ ${(+p.goal).toLocaleString()}</span></div><div class="sb-track"><i style="width:${wp}%"></i></div><form class="lf-inline sm mt-1" data-f="words" data-p="${esc(p.id)}"><input name="wrote" type="number" min="0" inputmode="numeric" value="${p.wrote || 0}" aria-label="${esc(t('Words written so far'))}"><button class="btn sm" type="submit">${esc(t('Update'))}</button></form>` : ''}
              <h4>${esc(t('Sources'))}</h4><ul class="pj-src">${(p.sources || []).map(s => `<li>${icon('link', 12)} ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : `<span>${esc(s.title)}</span>`}<button class="icon-btn xs" type="button" data-action="src-del" data-p="${esc(p.id)}" data-s="${esc(s.id)}" aria-label="${esc(t('Remove'))}">${icon('x', 11)}</button></li>`).join('') || `<li class="muted small">${esc(t('None yet'))}</li>`}</ul><form class="lf-inline sm" data-f="src" data-p="${esc(p.id)}"><input name="title" maxlength="200" placeholder="${esc(t('Author, title, year'))}" aria-label="${esc(t('Source'))}"><input name="url" type="url" placeholder="https://" aria-label="${esc(t('Link'))}"><button class="btn sm" type="submit">${esc(t('Add'))}</button></form>
              <h4>${esc(t('Notes'))}</h4><textarea class="pj-notes" data-notes="${esc(p.id)}" rows="4" placeholder="${esc(t('Ideas, feedback from your advisor, what to fix'))}">${esc(p.notes || '')}</textarea></div></div></div>` : ''}
        </article>`; }).join('')}</div>`;
    }
  };
})(window);
