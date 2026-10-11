/* ============================================================
   Mathub — for professors (#/teach) and their students (#/class)
   Instructors build the syllabus in a form (course facts, people,
   schedule, exams, grading, policies), see what a reviewer would flag,
   print it, and publish it: the class then appears for the students who
   join with its code, with the calendar, exam countdowns, the grade
   calculator with these weights, the syllabus page and a class board.
   Around that: roster, announcements (inbox + push), practice
   assignments drawn from Mathub's question banks, attendance check-in
   and class insights.
     #/teach                    the instructor's classes, or the access request
     #/teach/<id>/<tab>         one class: syllabus, schedule, grading, students,
                                announcements, assignments, attendance, insights
     #/class                    the classes a student joined, and a join box
     #/class/join/<CODE>        join a class
     #/class/<id>               a class's hub: announcements, assignments, check-in
     #/syllabus/<CODE>          the published syllabus as a printable page
   Server: api/teach.php. Everything typed here is saved as plain text.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const API = 'api/index.php?r=';

  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let json; try { json = await (await fetch(API + route, opts)).json(); } catch (e) { throw new Error(navigator.onLine === false ? 'You are offline.' : 'Cannot reach the server.'); }
    if (!json || json.ok === false) { const err = new Error((json && json.error) || 'Request failed.'); err.data = json; throw err; }
    return json;
  }
  const user = () => App.auth && App.auth.user;
  const signedOut = () => !user();

  /* ---------- dates (calendar days, no time zones) ---------- */
  const D0 = s => new Date(s + 'T12:00:00Z');
  const isoOf = d => d.toISOString().slice(0, 10);
  const plus = (s, n) => { const d = D0(s); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
  const fmt = (s, o = {}) => s ? D0(s).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }, o)) : '';
  const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`; };
  const ago = ts => App.ago ? App.ago(ts * 1000) : new Date(ts * 1000).toLocaleDateString();
  /* due dates are Montana time, whatever time zone the device is in (the class meets in Bozeman) */
  const dueText = ts => { if (!ts) return 'No due date'; const d = new Date(ts * 1000); const o = { timeZone: 'America/Denver' }; return 'Due ' + d.toLocaleDateString('en-US', Object.assign({ weekday: 'short', month: 'short', day: 'numeric' }, o)) + ', ' + d.toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit' }, o)) + ' MT'; };
  /* Montana State's days without classes that are certain; the generator says to check the academic calendar for anything else. */
  const NO_CLASS = { '2026-09-07': 'Labor Day', '2026-11-11': 'Veterans Day', '2026-11-23': 'Thanksgiving break', '2026-11-24': 'Thanksgiving break', '2026-11-25': 'Thanksgiving break', '2026-11-26': 'Thanksgiving', '2026-11-27': 'Thanksgiving break', '2027-01-18': 'Martin Luther King Jr. Day', '2027-02-15': 'Presidents’ Day', '2027-05-31': 'Memorial Day', '2027-07-05': 'Independence Day (observed)' };
  const TERMS = { 'Fall 2026': ['2026-08-24', '2026-12-11'], 'Spring 2027': ['', ''], 'Summer 2027': ['', ''] };
  const DAY_CODES = { M: 1, T: 2, W: 3, R: 4, F: 5, S: 6, U: 0 };
  const parseDays = s => { const t = String(s || '').toUpperCase().replace(/TH/g, 'R').replace(/SA/g, 'S').replace(/SU/g, 'U').replace(/[^MTWRFSU]/g, ''); return [...new Set([...t].map(c => DAY_CODES[c]))]; };

  /* ---------- paths into the syllabus object ---------- */
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };
  const val = (p, attrs = '') => `data-k="${p}" ${attrs}`;
  const inp = (S, p, ph = '', attrs = '') => `<input class="input" ${val(p, attrs)} value="${esc(getP(S.syl, p) ?? '')}" placeholder="${esc(ph)}">`;
  const area = (S, p, rows = 3, ph = '', attrs = '') => `<textarea class="input" rows="${rows}" ${val(p, attrs)} placeholder="${esc(ph)}">${esc(getP(S.syl, p) ?? '')}</textarea>`;
  const fieldW = (label, body, help = '', cls = '') => `<label class="field${cls ? ' ' + cls : ''}"><span class="tc-label">${label}</span>${body}${help ? `<span class="help">${help}</span>` : ''}</label>`;
  const pct = n => (Math.round(n * 100) / 100).toString();

  /* ============================================================
     The syllabus as a document (preview, print, public page)
     ============================================================ */
  function paras(t) { if (!t) return ''; return String(t).split(/\n{2,}/).map(p => `<p>${esc(p).replace(/(https?:\/\/[^\s<]+[^\s<.,;:)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>')}</p>`).join(''); }
  function docHtml(s, cls = {}) {
    const c = s.course || {}; const people = (s.people || []).filter(p => p.name); const meets = (c.meets || []).filter(m => m.days || m.room);
    const cats = ((s.grading || {}).categories || []).filter(x => x.name); const scale = ((s.grading || {}).scale || []).filter(x => x.letter);
    const exams = (s.exams || []).filter(e => e.name); const rows = (s.schedule || {}).rows || []; const p = s.policies || {};
    const sec = (t, body) => body ? `<section class="sy-sec"><h2>${t}</h2>${body}</section>` : '';
    const TYPE = { lecture: 'Class', lab: 'Lab', exam: 'Exam', review: 'Review', holiday: 'No class', due: 'Due', other: 'Note' };
    return `<article class="sy-doc">
      <header class="sy-head"><div class="sy-code">${esc(c.code || cls.code || '')}${c.section ? ` · Section ${esc(c.section)}` : ''}</div><h1>${esc(c.title || cls.title || 'Syllabus')}</h1><div class="sy-term">${esc(c.term || '')}${c.credits ? ` · ${esc(c.credits)} credits` : ''}${c.modality ? ` · ${esc(c.modality)}` : ''} · Montana State University</div></header>
      ${sec('Meetings', meets.length ? `<ul>${meets.map(m => `<li><b>${esc(m.kind || 'Class')}:</b> ${esc(m.days)} ${m.start ? esc(fmtTime(m.start)) + (m.end ? '–' + esc(fmtTime(m.end)) : '') : ''}${m.room ? ', ' + esc(m.room) : ''}</li>`).join('')}</ul>` : '')}
      ${sec(people.length > 1 ? 'Instructors' : 'Instructor', people.map(x => `<p><b>${esc(x.name)}</b>${x.pronouns ? ` (${esc(x.pronouns)})` : ''}, ${esc(x.role)}${x.email ? ` · <a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''}${x.office ? ` · ${esc(x.office)}` : ''}${x.hours ? `<br><span class="sy-muted">Office hours: ${esc(x.hours)}</span>` : ''}</p>`).join(''))}
      ${sec('Course description', paras(c.description) + (c.prereqs ? `<p><b>Prerequisites:</b> ${esc(c.prereqs)}</p>` : ''))}
      ${sec('Learning outcomes', (c.outcomes || []).length ? `<p>By the end of the course you will be able to:</p><ul>${c.outcomes.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : '')}
      ${sec('Materials', (s.materials || []).filter(m => m.title || m.url).length ? `<ul>${s.materials.filter(m => m.title || m.url).map(m => `<li>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title || m.url)}</a>` : `<b>${esc(m.title)}</b>`} <span class="sy-muted">(${m.required ? 'required' : 'optional'})</span>${m.note ? ` · ${esc(m.note)}` : ''}</li>`).join('')}</ul>` : '')}
      ${sec('Grading', cats.length ? `<table class="sy-table"><thead><tr><th>Category</th><th class="num">Share</th></tr></thead><tbody>${cats.map(x => `<tr><td>${esc(x.name)}${x.note ? ` <span class="sy-muted">${esc(x.note)}</span>` : ''}</td><td class="num">${esc(pct(x.weight))}%</td></tr>`).join('')}</tbody></table>${scale.length ? `<p><b>Letter grades:</b> ${scale.map(x => `${esc(x.letter)} ≥ ${esc(pct(x.min))}%`).join(', ')}</p>` : ''}${paras((s.grading || {}).notes)}` : '')}
      ${sec('Exams', exams.length ? `<ul>${exams.map(e => `<li><b>${esc(e.name)}:</b> ${e.date ? esc(fmt(e.date)) + (e.time ? ', ' + esc(fmtTime(e.time)) : '') + (e.place ? ', ' + esc(e.place) : '') : 'date to be announced'}${e.covers ? `<br><span class="sy-muted">${esc(e.covers)}</span>` : ''}</li>`).join('')}</ul>` : '')}
      ${sec('Schedule', rows.length ? `<table class="sy-table sy-sched"><thead><tr><th>Date</th><th>What</th></tr></thead><tbody>${rows.map(r => `<tr class="sy-${esc(r.type)}"><td class="sy-date">${esc(fmt(r.date))}</td><td><b>${esc(TYPE[r.type] || 'Class')}${r.title ? ':' : ''}</b> ${esc(r.title)}${r.notes ? `<br><span class="sy-muted">${esc(r.notes).replace(/\n/g, '<br>')}</span>` : ''}</td></tr>`).join('')}</tbody></table><p class="sy-muted">The schedule may change; changes are announced in class and on Mathub.</p>` : '')}
      ${sec('Policies', [['Attendance', p.attendance], ['Late work', p.late], ['AI tools', p.aiText], ['Academic integrity', p.integrity], ['Accommodations', p.accommodations], ['Wellbeing and support', p.wellbeing], ['Communication', p.communication]].concat((p.other || []).map(o => [o.title || 'Policy', o.text])).filter(x => x[1]).map(([t, x]) => `<h3>${esc(t)}</h3>${paras(x)}`).join(''))}
      <footer class="sy-foot">Made with Mathub · mathub.space</footer>
    </article>`;
  }
  function printDoc(html, title) {
    let host = $('#sy-print'); if (!host) { host = document.createElement('div'); host.id = 'sy-print'; document.body.appendChild(host); }
    host.innerHTML = html; document.body.classList.add('printing-syllabus'); const old = document.title; document.title = title || old;
    const done = () => { document.body.classList.remove('printing-syllabus'); host.innerHTML = ''; document.title = old; global.removeEventListener('afterprint', done); };
    global.addEventListener('afterprint', done); global.print(); setTimeout(() => { if (document.body.classList.contains('printing-syllabus') && !matchMedia('print').matches) done(); }, 1500);
  }
  function modal(inner, opts = {}) {
    const el = document.createElement('div'); el.className = 'modal-backdrop'; el.innerHTML = `<div class="modal tc-modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.label || 'Dialog')}">${inner}</div>`;
    document.body.appendChild(el); const close = () => { (App.dismiss || (x => x.remove()))(el); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', key);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    const f = $('input, textarea, button:not([data-close])', el) || $('button', el); if (f) setTimeout(() => f.focus(), 30);
    return { el, close };
  }

  /* ============================================================
     #/teach
     ============================================================ */
  const TABS = [['syllabus', 'Syllabus', 'file'], ['schedule', 'Schedule', 'calendar'], ['grading', 'Grading', 'calc'], ['students', 'Students', 'users'], ['announce', 'Announcements', 'megaphone'], ['assign', 'Assignments', 'target'], ['attendance', 'Attendance', 'check'], ['insights', 'Insights', 'chart']];
  let S = null;   // the open class: { id, cls, syl, lint, timer, saving, savedAt, dirty, tab }

  App.views.teach = {
    title: 'For professors',
    render(root, param, query, standalone) {
      const parts = String(param || '').split('/').filter(Boolean); const id = parseInt(parts[0], 10);
      if (S && S.id !== id) flush();
      root.innerHTML = `<div class="landing-wrap tc-wrap"><header class="landing-top"><div><div class="eyebrow">Mathub for professors</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>${id ? 'Your class' : 'Run your class on Mathub'}</h1>${id ? '' : `<p class="muted">Build the syllabus once. Your students get the calendar, exam countdowns, a grade calculator with your weights, the syllabus and a class board, and you get announcements, practice assignments, attendance and insights. Free.</p>`}</div><div class="row gap-sm"><span id="landing-account"></span>${id ? `<a class="btn" href="#/teach">${icon('left', 14)} All your classes</a>` : `<a class="btn" href="#/">${icon('left', 14)} Mathub</a>`}</div></header><div id="tc-body"><div class="empty">Loading…</div></div></div>`;
      const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      const body = $('#tc-body', root);
      if (App.auth && !App.auth.ready) { body.innerHTML = '<div class="empty">Checking your account…</div>'; return; }
      if (signedOut()) { body.innerHTML = intro() + App.lockCard('Sign in to start', 'Instructors sign in with their montana.edu email, then ask for instructor access (an administrator approves it, usually within a day).'); if (App.auth) App.auth.bindLocks(body); return; }
      if (id) openClass(body, id, TABS.some(t => t[0] === parts[1]) ? parts[1] : 'syllabus'); else home(body);
    },
    unmount() { flush(); }
  };
  function intro() {
    const step = (n, t, x, ic) => `<div class="tc-step"><span class="tc-step-n">${n}</span><div><b>${icon(ic, 14)} ${t}</b><p class="small muted">${x}</p></div></div>`;
    return `<div class="tc-steps">${step(1, 'Build the syllabus', 'A guided form with MSU’s accommodations, integrity and wellbeing statements already filled in, and a checklist of what students look for.', 'file')}${step(2, 'Publish it', 'Students join with a 6-character code. Their calendar, exam countdowns and grade calculator follow your syllabus.', 'send')}${step(3, 'Run the class', 'Announcements to their inbox and phone, practice sets from Mathub’s question banks, check-in codes and a view of where the class struggles.', 'chart')}</div>`;
  }
  async function home(body) {
    let me; try { me = await api('teach_me'); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!me.instructor) {
      const pending = me.request && me.request.status === 'new'; const declined = me.request && me.request.status === 'declined';
      body.innerHTML = intro() + (pending ? `<div class="panel tc-request"><div class="panel-h"><div class="panel-title">${icon('clock')} Your request is waiting</div><span class="chip warn">sent ${esc(ago(me.request.created))}</span></div><p class="small">An administrator checks that you teach at Montana State and turns on instructor access. You will get a message in your Mathub inbox.</p></div>`
        : `<form class="panel tc-request" id="tc-req" novalidate><div class="panel-h"><div class="panel-title">${icon('shield')} Ask for instructor access</div>${declined ? '<span class="chip muted">an earlier request was not approved</span>' : ''}</div>
          <p class="small muted mb-2">Instructor accounts are checked by hand so students can trust that a class on Mathub really comes from their instructor. Tell us who you are.</p>
          <div class="grid cols-2"><div class="field"><label for="tr-name">Your name, as students know it <span class="req">*</span></label><input class="input" id="tr-name" maxlength="80" value="${esc(user().name || '')}" placeholder="Dr. Jane Smith" required></div>
          <div class="field"><label for="tr-title">Title</label><input class="input" id="tr-title" maxlength="80" placeholder="Assistant Professor, Lecturer, GTA…"></div>
          <div class="field"><label for="tr-dept">Department <span class="req">*</span></label><input class="input" id="tr-dept" maxlength="120" placeholder="Mathematical Sciences" required></div>
          <div class="field"><label for="tr-courses">Courses you teach <span class="req">*</span></label><input class="input" id="tr-courses" maxlength="200" placeholder="M 171 sections 3 and 5" required></div></div>
          <div class="field mt-1"><label for="tr-msg">Anything else?</label><textarea class="input" id="tr-msg" rows="2" maxlength="800" placeholder="Optional"></textarea></div>
          <p class="small muted mt-1">You are signed in as <b>${esc(user().email)}</b>${/student\./i.test(user().email) ? '. That looks like a student address; instructors usually use their faculty address.' : '.'}</p>
          <div class="row gap-sm mt-2"><button class="btn primary" type="submit">${icon('send', 14)} Send request</button><span class="small muted" id="tr-status" role="status"></span></div></form>`)
        + (me.enrolled.length ? `<p class="small muted mt-2">Looking for a class you joined as a student? <a href="#/class">Open your classes</a>.</p>` : '');
      const f = $('#tc-req', body); if (f) f.addEventListener('submit', async e => { e.preventDefault(); const st = $('#tr-status', body); st.textContent = 'Sending…';
        try { await api('teach_request', { name: $('#tr-name', f).value, title: $('#tr-title', f).value, department: $('#tr-dept', f).value, courses: $('#tr-courses', f).value, message: $('#tr-msg', f).value }); toast('Request sent. You will hear back in your inbox.'); home(body); } catch (err) { st.textContent = err.message; } });
      return;
    }
    const card = c => `<a class="tc-card" href="#/teach/${c.id}"><div class="row between"><span class="tc-card-code">${esc(c.code)}${c.section ? ` · ${esc(c.section)}` : ''}</span>${statusChip(c)}</div><b class="tc-card-title">${esc(c.title)}</b><span class="small muted">${esc(c.term || 'No term yet')} · ${c.students} student${c.students === 1 ? '' : 's'}${c.access === 'staff' ? ' · co-teaching' : ''}</span><span class="tc-card-code-chip mono">${icon('users', 12)} ${esc(c.join_code)}</span></a>`;
    const termOpts = Object.keys(TERMS).map((t, i) => `<option${i === 0 ? ' selected' : ''}>${t}</option>`).join('');
    const quizClasses = App.COURSE_ORDER.filter(id => global.Courses[id] && (global.Courses[id].hasQuiz || global.Courses[id].quizTopics || ['calc', 'physics', 'precalc', 'csci', 'biob', 'kin', 'psyx'].includes(id)));
    body.innerHTML = `<section class="land-sec"><div class="sec-h"><h2 class="sec-title">Your classes</h2></div>
      ${me.teaching.length ? `<div class="tc-grid">${me.teaching.map(card).join('')}</div>` : `<div class="empty">No classes yet. Start one below: it takes about ten minutes to fill in a syllabus.</div>`}</section>
      <section class="land-sec"><form class="panel" id="tc-new" novalidate><div class="panel-h"><div class="panel-title">${icon('plus')} New class</div></div>
        <div class="grid cols-4 tc-new-grid"><div class="field"><label for="tn-code">Course code <span class="req">*</span></label><input class="input mono" id="tn-code" maxlength="20" placeholder="M 171" required></div>
        <div class="field span-2"><label for="tn-title">Course title <span class="req">*</span></label><input class="input" id="tn-title" maxlength="120" placeholder="Calculus I" required></div>
        <div class="field"><label for="tn-section">Section</label><input class="input" id="tn-section" maxlength="20" placeholder="003"></div>
        <div class="field"><label for="tn-term">Term</label><select class="select" id="tn-term">${termOpts}</select></div>
        <div class="field span-2"><label for="tn-from">Start from</label><select class="select" id="tn-from"><option value="blank">A new syllabus (MSU template)</option>${me.teaching.filter(c => c.access !== 'student').map(c => `<option value="copy:${c.id}">A copy of ${esc(c.code)} ${esc(c.title)}${c.term ? ' (' + esc(c.term) + ')' : ''}</option>`).join('')}</select><span class="help">A copy keeps your policies, grading and materials; dates start empty.</span></div>
        <div class="field"><label for="tn-link">Practice from</label><select class="select" id="tn-link"><option value="">None</option>${quizClasses.map(id => `<option value="${id}">${esc(global.Courses[id].code || global.Courses[id].short)} on Mathub</option>`).join('')}</select><span class="help">Question bank for assignments.</span></div></div>
        <div class="row gap-sm mt-2"><button class="btn primary" type="submit">${icon('plus', 14)} Create class</button><span class="small muted" id="tn-status" role="status"></span></div></form></section>
      ${me.enrolled.length ? `<p class="small muted">You also joined ${me.enrolled.length} class${me.enrolled.length === 1 ? '' : 'es'} as a student: <a href="#/class">open them</a>.</p>` : ''}`;
    const f = $('#tc-new', body); const code = $('#tn-code', f), link = $('#tn-link', f);
    code.addEventListener('input', () => { const b = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); const hit = quizClasses.find(id => String(global.Courses[id].code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[A-Z]+$/, '') === b.replace(/[A-Z]+$/, '')); if (hit && !link.dataset.touched) link.value = hit; });
    link.addEventListener('change', () => { link.dataset.touched = '1'; });
    f.addEventListener('submit', async e => { e.preventDefault(); const st = $('#tn-status', f); st.textContent = 'Creating…';
      try { const r = await api('teach_class_create', { code: code.value, title: $('#tn-title', f).value, section: $('#tn-section', f).value, term: $('#tn-term', f).value, from: $('#tn-from', f).value, link_course: link.value }); location.hash = `#/teach/${r.id}/syllabus`; } catch (err) { st.textContent = err.message; } });
  }
  const statusChip = c => c.status === 'published' ? `<span class="chip xs good">${icon('check', 11)} Published</span>` : `<span class="chip xs warn">Draft</span>`;

  /* ---------- one class ---------- */
  async function openClass(body, id, tab) {
    if (!S || S.id !== id) {
      body.innerHTML = '<div class="empty">Loading the class…</div>';
      let r; try { r = await api('teach_class_get&id=' + id); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)} <a href="#/teach">Back to your classes</a></div>`; return; }
      S = { id, cls: r.class, syl: r.syllabus, lint: r.lint, starter: r.starter, ai: r.ai_presets, staff: r.staff, owner: r.owner, dirty: r.dirty, timer: null, saving: false, unsaved: false };
    }
    S.tab = tab;
    const c = S.cls;
    body.innerHTML = `<div class="tc-head"><div><div class="tc-head-code">${esc(c.code)}${c.section ? ` · Section ${esc(c.section)}` : ''} · ${esc(c.term || 'no term')}</div><h2 class="tc-head-title">${esc(c.title)}</h2>
        <div class="row gap-sm tc-head-meta">${statusChip(c)}${S.dirty && c.status === 'published' ? '<span class="chip xs accent">changes not published</span>' : ''}<button class="chip xs tc-code-chip" data-action="copy-code" title="Copy the join link">${icon('users', 11)} Code <b class="mono">${esc(c.join_code)}</b> ${icon('copy', 11)}</button><span class="small muted" id="tc-save" role="status" aria-live="polite">${S.unsaved ? 'Not saved yet' : 'All changes saved'}</span></div></div>
      <div class="row gap-sm tc-head-actions"><button class="btn" data-action="preview">${icon('eye', 14)} Preview</button><button class="btn" data-action="print">${icon('print', 14)} Print / PDF</button><button class="btn primary" data-action="publish">${icon('send', 14)} ${c.status === 'published' ? 'Publish changes' : 'Publish to students'}</button></div></div>
      <nav class="tc-tabs" aria-label="Class sections">${TABS.map(([k, l, ic]) => `<a class="tc-tab${k === tab ? ' on' : ''}" href="#/teach/${id}/${k}"${k === tab ? ' aria-current="page"' : ''}>${icon(ic, 14)}<span>${l}</span></a>`).join('')}</nav>
      <div id="tc-pane"></div>`;
    const pane = $('#tc-pane', body);
    bind(body, {
      'copy-code': () => copy(joinLink(c.join_code), 'Join link copied: ' + joinLink(c.join_code)),
      preview: () => { const m = modal(`<div class="row between mb-2"><div class="panel-title">${icon('eye')} What students see</div><button class="icon-btn" data-close aria-label="Close">${icon('x', 14)}</button></div><div class="tc-preview">${docHtml(S.syl, c)}</div>`, { wide: true, label: 'Syllabus preview' }); },
      print: () => printDoc(docHtml(S.syl, c), `${c.code} ${c.title} syllabus`),
      publish: () => publish(body)
    });
    ({ syllabus: tabSyllabus, schedule: tabSchedule, grading: tabGrading, students: tabStudents, announce: tabAnnounce, assign: tabAssign, attendance: tabAttendance, insights: tabInsights })[tab](pane);
  }
  const joinLink = code => `${location.origin}${location.pathname}#/class/join/${code}`;
  function copy(text, msg) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg || 'Copied.')).catch(() => { const m = modal(`<div class="panel-title mb-1">Copy this</div><input class="input mono" value="${esc(text)}" readonly><div class="row mt-2"><button class="btn" data-close>Done</button></div>`); const i = $('input', m.el); i.select(); }); }

  /* ---------- saving ---------- */
  function changed() {
    S.unsaved = true; const st = $('#tc-save'); if (st) st.textContent = 'Saving soon…';
    clearTimeout(S.timer); S.timer = setTimeout(save, 900);
  }
  async function save() {
    if (!S || !S.unsaved) return; clearTimeout(S.timer); S.unsaved = false; const st = $('#tc-save'); if (st) st.textContent = 'Saving…';
    try { const r = await api('teach_class_save', { id: S.id, syllabus: S.syl, link_course: S.cls.link_course }); S.lint = r.lint; S.dirty = r.dirty; if (st) st.textContent = 'All changes saved'; paintLint(); }
    catch (e) { S.unsaved = true; if (st) st.textContent = 'Not saved: ' + e.message; }
  }
  function flush() { if (S && S.unsaved) save(); }
  global.addEventListener('beforeunload', e => { if (S && S.unsaved) { save(); e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && S && location.hash.startsWith('#/teach/')) { e.preventDefault(); save(); } });
  /** Inputs carrying data-k="path" write straight into the syllabus. */
  function wire(pane, after) {
    pane.__after = after || null; if (pane.__wired) return; pane.__wired = true;
    const on = e => { const el = e.target.closest('[data-k]'); if (!el || !S) return; let v = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.num !== undefined) v = v === '' ? 0 : Number(v); setP(S.syl, el.dataset.k, v); changed(); if (pane.__after) pane.__after(el); };
    pane.addEventListener('input', e => { if (!e.target.matches('select, input[type=checkbox]')) on(e); }); pane.addEventListener('change', e => { if (e.target.matches('select, input[type=checkbox]')) on(e); });
  }
  async function publish(body) {
    await save(); const errs = (S.lint || []).filter(x => x[0] === 'error');
    if (errs.length) { const m = modal(`<div class="panel-title mb-1">${icon('flag')} Almost there</div><p class="small">Fix these before publishing:</p><ul class="small">${errs.map(x => `<li>${esc(x[1])}</li>`).join('')}</ul><div class="row mt-2"><button class="btn primary" data-close>OK</button></div>`); return; }
    const first = S.cls.status !== 'published';
    const m = modal(`<div class="panel-title mb-1">${icon('send')} ${first ? 'Publish to students' : 'Publish the changes'}</div>
      <p class="small">${first ? `Students who join with the code <b class="mono">${esc(S.cls.join_code)}</b> get this class on Mathub: the calendar, exam countdowns, the grade calculator with your weights, the syllabus and a class board.` : 'Everyone in the class gets the updated syllabus and calendar right away.'}</p>
      ${first ? '' : `<div class="field mt-1"><label for="tp-note">Tell students what changed (optional)</label><input class="input" id="tp-note" maxlength="200" placeholder="Exam 2 moved to Nov 12"><span class="help">Sent to their inbox and phone.</span></div>`}
      <div class="row gap-sm mt-2"><button class="btn primary" data-go>${icon('send', 14)} Publish</button><button class="btn" data-close>Cancel</button><span class="small muted" data-st role="status"></span></div>`);
    $('[data-go]', m.el).addEventListener('click', async () => { const st = $('[data-st]', m.el); st.textContent = 'Publishing…';
      try { const r = await api('teach_class_publish', { id: S.id, note: ($('#tp-note', m.el) || {}).value || '' }); S.cls.status = 'published'; S.cls.pack_id = r.pack_id; S.dirty = false; App.teachForget(); m.close(); toast(first ? 'Published. Share the code with your students.' : `Published${r.told ? `; ${r.told} student${r.told === 1 ? '' : 's'} told` : ''}.`, 5000); if (App.packs && App.packs.sync) App.packs.sync(); openClass($('#tc-body'), S.id, S.tab); }
      catch (e) { st.textContent = e.message; } });
  }
  function paintLint() {
    const el = $('#tc-lint'); if (!el || !S) return; const L = S.lint || []; const n = { error: 0, warn: 0, tip: 0 }; L.forEach(x => n[x[0]]++);
    const score = Math.max(0, 100 - n.error * 20 - n.warn * 6 - n.tip * 2);
    el.innerHTML = `<div class="panel-h"><div class="panel-title">${icon('check')} Checklist</div><span class="chip xs ${n.error ? 'bad' : n.warn ? 'warn' : 'good'}">${n.error ? `${n.error} to fix` : n.warn ? 'Ready, with suggestions' : 'Ready to publish'}</span></div>
      <div class="tc-meter" role="img" aria-label="Syllabus ${score}% complete"><i style="width:${score}%"></i></div>
      ${L.length ? `<ul class="tc-lint">${L.map(([lv, m]) => `<li class="tc-l-${lv}">${icon(lv === 'error' ? 'x' : lv === 'warn' ? 'flag' : 'bulb', 12)}<span>${esc(m)}</span></li>`).join('')}</ul>` : '<p class="small tc-good">Nothing missing. Students will find everything they usually look for.</p>'}`;
  }

  /* ---------- tab: syllabus ---------- */
  function tabSyllabus(pane) {
    const s = S.syl; const listEd = (path, items, row, addLabel, empty) => `<div class="tc-list" data-list="${path}">${items.length ? items.map((it, i) => `<div class="tc-row">${row(i)}<button type="button" class="icon-btn tc-del" data-act="del" data-path="${path}" data-i="${i}" aria-label="Remove">${icon('trash', 13)}</button></div>`).join('') : `<div class="small muted">${empty}</div>`}<button type="button" class="btn sm" data-act="add" data-path="${path}">${icon('plus', 13)} ${addLabel}</button></div>`;
    const aiOpts = [['none', 'Not allowed'], ['disclose', 'Allowed with disclosure'], ['open', 'Allowed'], ['custom', 'My own wording']];
    pane.innerHTML = `<div class="tc-split"><div class="tc-main">
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('info')} Course</div></div>
        <div class="grid cols-4 tc-g">${fieldW('Code', inp(S, 'course.code', 'M 171'))}${fieldW('Title', inp(S, 'course.title', 'Calculus I'), '', 'span-2')}${fieldW('Section', inp(S, 'course.section', '003'))}
        ${fieldW('Term', inp(S, 'course.term', 'Fall 2026'))}${fieldW('Credits', inp(S, 'course.credits', '4'))}${fieldW('Format', `<select class="select" ${val('course.modality')}>${['In person', 'Hybrid', 'Online, scheduled', 'Online, self-paced'].map(o => `<option${s.course.modality === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`)}${fieldW('Canvas page', inp(S, 'course.canvas', 'https://montana.instructure.com/courses/…'))}</div>
        <div class="eyebrow mt-2 mb-1">When and where</div>
        ${listEd('course.meets', s.course.meets, i => `<input class="input tc-w-s" ${val(`course.meets.${i}.kind`)} value="${esc(s.course.meets[i].kind)}" placeholder="Lecture" aria-label="Kind"><input class="input tc-w-xs mono" ${val(`course.meets.${i}.days`)} value="${esc(s.course.meets[i].days)}" placeholder="MWF" aria-label="Days (M T W R F)"><input class="input tc-w-t" type="time" ${val(`course.meets.${i}.start`)} value="${esc(s.course.meets[i].start)}" aria-label="Starts"><input class="input tc-w-t" type="time" ${val(`course.meets.${i}.end`)} value="${esc(s.course.meets[i].end)}" aria-label="Ends"><input class="input" ${val(`course.meets.${i}.room`)} value="${esc(s.course.meets[i].room)}" placeholder="Wilson 1-112" aria-label="Room">`, 'Add a meeting', 'No meetings yet.')}
        <p class="help mt-1">Days as letters: M T W R F (R is Thursday).</p>
        ${fieldW('Prerequisites', inp(S, 'course.prereqs', 'M 151Q or placement'))}
      </section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('users')} Instructors, TAs and office hours</div></div>
        ${listEd('people', s.people, i => `<select class="select tc-w-s" ${val(`people.${i}.role`)} aria-label="Role">${['Instructor', 'Co-instructor', 'TA', 'Grader', 'Learning assistant'].map(o => `<option${s.people[i].role === o ? ' selected' : ''}>${o}</option>`).join('')}</select><input class="input" ${val(`people.${i}.name`)} value="${esc(s.people[i].name)}" placeholder="Name" aria-label="Name"><input class="input" type="email" ${val(`people.${i}.email`)} value="${esc(s.people[i].email)}" placeholder="name@montana.edu" aria-label="Email"><input class="input" ${val(`people.${i}.office`)} value="${esc(s.people[i].office)}" placeholder="Office" aria-label="Office"><input class="input tc-w-wide" ${val(`people.${i}.hours`)} value="${esc(s.people[i].hours)}" placeholder="Office hours: Tue 2–3, Wed 1–2, or by appointment" aria-label="Office hours">`, 'Add a person', 'Add at least yourself.')}
      </section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('book')} Description and outcomes</div></div>
        ${fieldW('Course description', area(S, 'course.description', 5, 'What the course is about and how it is taught.'))}
        <div class="field mt-1"><span class="tc-label">Learning outcomes</span>${listEd('course.outcomes', s.course.outcomes, i => `<input class="input" data-k="course.outcomes.${i}" value="${esc(s.course.outcomes[i])}" placeholder="Compute derivatives using the rules of differentiation" aria-label="Outcome ${i + 1}">`, 'Add an outcome', 'Students will be able to…')}</div>
      </section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('scroll')} Materials</div></div>
        ${listEd('materials', s.materials, i => `<input class="input" ${val(`materials.${i}.title`)} value="${esc(s.materials[i].title)}" placeholder="Active Calculus, 2nd ed." aria-label="Title"><input class="input" ${val(`materials.${i}.url`)} value="${esc(s.materials[i].url)}" placeholder="https://… (optional)" aria-label="Link"><label class="check tc-req"><input type="checkbox" ${val(`materials.${i}.required`)} ${s.materials[i].required ? 'checked' : ''}><span>Required</span></label><input class="input" ${val(`materials.${i}.note`)} value="${esc(s.materials[i].note)}" placeholder="Note (free online, bookstore…)" aria-label="Note">`, 'Add a material', 'Textbook, software, calculator…')}
      </section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('shield')} Policies</div><span class="small muted">MSU’s statements are filled in; edit them to match your course.</span></div>
        <div class="field"><label for="tc-ai">AI tools</label><div class="row gap-sm tc-ai-row"><select class="select" id="tc-ai" ${val('policies.ai')}>${aiOpts.map(([k, l]) => `<option value="${k}"${s.policies.ai === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>${area(S, 'policies.aiText', 3, '', 'id="tc-ai-text" aria-label="AI policy wording"')}</div>
        ${[['attendance', 'Attendance', 'What you expect, and how absences are handled.'], ['late', 'Late work', 'Deadlines, extensions, penalties.'], ['communication', 'Communication', 'How to reach you and how fast you reply.'], ['integrity', 'Academic integrity', ''], ['accommodations', 'Accommodations', ''], ['wellbeing', 'Wellbeing and support', '']].map(([k, l, ph]) => `<label class="field mt-1"><span class="tc-label">${l}${S.starter[k] && s.policies[k] === S.starter[k] ? ' <span class="chip xs muted">MSU template</span>' : ''}</span>${area(S, 'policies.' + k, k === 'attendance' || k === 'late' || k === 'communication' ? 2 : 3, ph)}</label>`).join('')}
        <div class="field mt-2"><span class="tc-label">Other policies</span>${listEd('policies.other', s.policies.other, i => `<input class="input tc-w-s" ${val(`policies.other.${i}.title`)} value="${esc(s.policies.other[i].title)}" placeholder="Title" aria-label="Title"><textarea class="input" rows="2" ${val(`policies.other.${i}.text`)} placeholder="Text" aria-label="Text">${esc(s.policies.other[i].text)}</textarea>`, 'Add a policy', 'Calculators, regrades, recordings…')}</div>
      </section>
    </div><aside class="tc-side"><div class="panel tc-sticky" id="tc-lint"></div></aside></div>`;
    paintLint(); wire(pane, el => { if (el.dataset.k === 'policies.ai' && S.ai[el.value]) { S.syl.policies.aiText = S.ai[el.value]; $('#tc-ai-text', pane).value = S.ai[el.value]; changed(); } });
    listActions(pane, tabSyllabus);
  }
  const BLANK = { 'course.meets': () => ({ days: '', start: '', end: '', room: '', kind: 'Lecture' }), people: () => ({ role: 'TA', name: '', email: '', office: '', hours: '', pronouns: '' }), 'course.outcomes': () => '', materials: () => ({ title: '', url: '', required: true, note: '' }), 'policies.other': () => ({ title: '', text: '' }), exams: () => ({ name: '', date: '', time: '', place: '', covers: '' }), 'schedule.rows': () => ({ date: '', type: 'lecture', title: '', notes: '' }), 'grading.categories': () => ({ name: '', weight: 0, note: '' }), 'grading.scale': () => ({ letter: '', min: 0 }) };
  function listActions(pane, rerender) {
    pane.__rerender = rerender; if (pane.__listWired) return; pane.__listWired = true;
    pane.addEventListener('click', e => {
      const b = e.target.closest('[data-act="add"], [data-act="del"]'); if (!b || !S) return; const path = b.dataset.path; const list = getP(S.syl, path) || []; const rerender = pane.__rerender;
      if (b.dataset.act === 'add') { list.push(BLANK[path] ? BLANK[path]() : ''); setP(S.syl, path, list); } else list.splice(Number(b.dataset.i), 1);
      changed(); const y = global.scrollY; rerender(pane); global.scrollTo(0, y);
      if (b.dataset.act === 'add') { const rows = $$(`[data-list="${path}"] .tc-row`, pane); const last = rows[rows.length - 1]; const f = last && $('input, select, textarea', last); if (f) f.focus(); }
    });
  }

  /* ---------- tab: schedule ---------- */
  function tabSchedule(pane) {
    const s = S.syl; const sc = s.schedule; const rows = sc.rows;
    const TYPES = [['lecture', 'Class'], ['lab', 'Lab'], ['review', 'Review'], ['exam', 'Exam'], ['due', 'Due date'], ['holiday', 'No class'], ['other', 'Note']];
    const term = TERMS[s.course.term] || null; const days = [...new Set((s.course.meets || []).flatMap(m => parseDays(m.days)))];
    pane.innerHTML = `<div class="tc-split"><div class="tc-main">
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} Term and meetings</div></div>
        <div class="grid cols-3 tc-g">${fieldW('First day of classes', `<input class="input" type="date" ${val('schedule.start')} value="${esc(sc.start || (term ? term[0] : ''))}">`)}${fieldW('Last day of classes', `<input class="input" type="date" ${val('schedule.end')} value="${esc(sc.end || (term ? term[1] : ''))}">`)}<div class="field"><span class="tc-label">Class meets</span><div class="tc-days">${days.length ? ['M', 'T', 'W', 'R', 'F', 'S', 'U'].filter(c => days.includes(DAY_CODES[c])).map(c => `<span class="chip">${{ M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri', S: 'Sat', U: 'Sun' }[c]}</span>`).join('') : '<span class="small muted">Set the days on the Syllabus tab (When and where).</span>'}</div></div></div>
        <div class="row gap-sm mt-2" style="flex-wrap:wrap"><button class="btn primary" data-action="gen"${days.length ? '' : ' disabled'}>${icon('calendar', 14)} Fill in class meetings</button><button class="btn" data-action="topics"${rows.length ? '' : ' disabled'}>${icon('list', 14)} Paste topics, one per line</button><button class="btn ghost" data-action="clear"${rows.length ? '' : ' disabled'}>${icon('trash', 14)} Clear schedule</button></div>
        <p class="help mt-1">Adds a row for every meeting between the first and last day, and marks Labor Day, Veterans Day, Thanksgiving week and Monday holidays as no class. Check MSU’s academic calendar for anything else. Rows you already have are kept.</p></section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('flag')} Exams</div><span class="small muted">Students get a countdown and an exam prep page for each dated exam.</span></div>
        <div class="tc-list" data-list="exams">${s.exams.map((e, i) => `<div class="tc-row"><input class="input tc-w-s" ${val(`exams.${i}.name`)} value="${esc(e.name)}" placeholder="Midterm 1" aria-label="Exam name"><input class="input tc-w-d" type="date" ${val(`exams.${i}.date`)} value="${esc(e.date)}" aria-label="Date"><input class="input tc-w-t" type="time" ${val(`exams.${i}.time`)} value="${esc(e.time)}" aria-label="Time"><input class="input tc-w-s" ${val(`exams.${i}.place`)} value="${esc(e.place)}" placeholder="Room" aria-label="Place"><input class="input" ${val(`exams.${i}.covers`)} value="${esc(e.covers)}" placeholder="What it covers" aria-label="Covers"><button type="button" class="icon-btn tc-del" data-act="del" data-path="exams" data-i="${i}" aria-label="Remove exam">${icon('trash', 13)}</button></div>`).join('') || '<div class="small muted">No exams yet.</div>'}<button type="button" class="btn sm" data-act="add" data-path="exams">${icon('plus', 13)} Add an exam</button></div></section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('list')} Day by day</div><span class="small muted">${rows.length} row${rows.length === 1 ? '' : 's'}</span></div>
        <div class="tc-sched" data-list="schedule.rows">${rows.map((r, i) => `<div class="tc-row tc-srow tc-t-${esc(r.type)}"><input class="input tc-w-d" type="date" ${val(`schedule.rows.${i}.date`)} value="${esc(r.date)}" aria-label="Date"><select class="select tc-w-s" ${val(`schedule.rows.${i}.type`)} aria-label="Type">${TYPES.map(([k, l]) => `<option value="${k}"${r.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select><input class="input" ${val(`schedule.rows.${i}.title`)} value="${esc(r.title)}" placeholder="${r.type === 'due' ? 'Homework 3' : r.type === 'holiday' ? 'Holiday' : 'Topic'}" aria-label="Title"><input class="input" ${val(`schedule.rows.${i}.notes`)} value="${esc(r.notes)}" placeholder="Reading, what to bring…" aria-label="Notes"><button type="button" class="icon-btn tc-del" data-act="del" data-path="schedule.rows" data-i="${i}" aria-label="Remove row">${icon('trash', 13)}</button></div>`).join('') || '<div class="empty">No rows yet. Fill in the class meetings above, or add rows one at a time.</div>'}
        <button type="button" class="btn sm" data-act="add" data-path="schedule.rows">${icon('plus', 13)} Add a row</button></div></section>
    </div><aside class="tc-side"><div class="panel tc-sticky" id="tc-lint"></div></aside></div>`;
    paintLint(); wire(pane, el => { if (/^schedule\.rows\.\d+\.type$/.test(el.dataset.k)) el.closest('.tc-srow').className = `tc-row tc-srow tc-t-${el.value}`; });
    listActions(pane, tabSchedule);
    const persistTermDefaults = () => { if (!sc.start && term && term[0]) sc.start = term[0]; if (!sc.end && term && term[1]) sc.end = term[1]; };
    bind(pane, {
      gen: () => { persistTermDefaults(); if (!sc.start || !sc.end || sc.end < sc.start) { toast('Set the first and last day of classes first.'); return; }
        const have = new Set(rows.map(r => r.date)); let added = 0;
        for (let d = sc.start; d <= sc.end; d = plus(d, 1)) { const wd = D0(d).getUTCDay(); if (!days.includes(wd) || have.has(d)) continue; rows.push(NO_CLASS[d] ? { date: d, type: 'holiday', title: NO_CLASS[d], notes: '' } : { date: d, type: 'lecture', title: '', notes: '' }); added++; }
        rows.sort((a, b) => a.date.localeCompare(b.date)); changed(); tabSchedule(pane); toast(added ? `Added ${added} meeting${added === 1 ? '' : 's'}. Now add the topics.` : 'Every meeting is already on the schedule.'); },
      topics: () => { const m = modal(`<div class="panel-title mb-1">${icon('list')} Paste the topics</div><p class="small muted">One per line, in order. They fill the class meetings that have no topic yet; holidays are skipped.</p><textarea class="input" rows="10" id="tp-list" placeholder="Velocity and limits\nComputing limits\nThe derivative"></textarea><div class="row gap-sm mt-2"><button class="btn primary" data-go>Fill topics</button><button class="btn" data-close>Cancel</button></div>`);
        $('[data-go]', m.el).addEventListener('click', () => { const lines = $('#tp-list', m.el).value.split('\n').map(x => x.trim()).filter(Boolean); let k = 0; rows.forEach(r => { if (k < lines.length && ['lecture', 'lab', 'review'].includes(r.type) && !r.title) r.title = lines[k++].slice(0, 140); }); changed(); m.close(); tabSchedule(pane); toast(`Filled ${k} topic${k === 1 ? '' : 's'}${lines.length > k ? `; ${lines.length - k} left over (add more meetings)` : ''}.`); }); },
      clear: () => { if (!confirm('Remove every row from the schedule? Exams stay.')) return; sc.rows = []; changed(); tabSchedule(pane); }
    });
  }

  /* ---------- tab: grading ---------- */
  const SCALES = { pm: [['A', 93], ['A-', 90], ['B+', 87], ['B', 83], ['B-', 80], ['C+', 77], ['C', 73], ['C-', 70], ['D+', 67], ['D', 63], ['D-', 60], ['F', 0]], plain: [['A', 90], ['B', 80], ['C', 70], ['D', 60], ['F', 0]] };
  function tabGrading(pane) {
    const g = S.syl.grading; const sum = () => g.categories.filter(x => x.name).reduce((a, x) => a + (Number(x.weight) || 0), 0);
    pane.innerHTML = `<div class="tc-split"><div class="tc-main">
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('calc')} Categories</div><span class="chip" id="tc-sum"></span></div>
        <div class="tc-list" data-list="grading.categories">${g.categories.map((x, i) => `<div class="tc-row"><input class="input" ${val(`grading.categories.${i}.name`)} value="${esc(x.name)}" placeholder="Homework" aria-label="Category"><span class="tc-num"><input class="input mono" type="number" min="0" max="100" step="0.5" ${val(`grading.categories.${i}.weight`, 'data-num')} value="${esc(String(x.weight))}" aria-label="Weight in percent">%</span><input class="input" ${val(`grading.categories.${i}.note`)} value="${esc(x.note)}" placeholder="Note (lowest two dropped…)" aria-label="Note"><button type="button" class="icon-btn tc-del" data-act="del" data-path="grading.categories" data-i="${i}" aria-label="Remove">${icon('trash', 13)}</button></div>`).join('')}<button type="button" class="btn sm" data-act="add" data-path="grading.categories">${icon('plus', 13)} Add a category</button></div>
        <p class="help mt-1">Students get a grade calculator with exactly these weights.</p></section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('award')} Letter grades</div><div class="row gap-sm"><button class="btn xs" data-action="scale" data-s="pm">A to F with + and −</button><button class="btn xs" data-action="scale" data-s="plain">A, B, C, D, F</button></div></div>
        <div class="tc-list tc-scale" data-list="grading.scale">${g.scale.map((x, i) => `<div class="tc-row"><input class="input mono tc-w-xs" ${val(`grading.scale.${i}.letter`)} value="${esc(x.letter)}" aria-label="Letter"><span class="small muted">at least</span><span class="tc-num"><input class="input mono" type="number" min="0" max="100" step="0.5" ${val(`grading.scale.${i}.min`, 'data-num')} value="${esc(String(x.min))}" aria-label="Minimum percent">%</span><button type="button" class="icon-btn tc-del" data-act="del" data-path="grading.scale" data-i="${i}" aria-label="Remove">${icon('trash', 13)}</button></div>`).join('')}<button type="button" class="btn sm" data-act="add" data-path="grading.scale">${icon('plus', 13)} Add a letter</button></div></section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('pen')} Grading notes</div></div>${area(S, 'grading.notes', 3, 'Rounding, curves, how the final can replace a midterm…')}</section>
    </div><aside class="tc-side"><div class="panel tc-sticky" id="tc-lint"></div></aside></div>`;
    const paintSum = () => { const t = sum(); const el = $('#tc-sum', pane); el.textContent = `Total ${pct(t)}%`; el.className = 'chip ' + (Math.abs(t - 100) < 0.01 ? 'good' : 'bad'); };
    paintSum(); paintLint(); wire(pane, paintSum); listActions(pane, tabGrading);
    bind(pane, { scale: (b) => { g.scale = SCALES[b.dataset.s].map(([letter, min]) => ({ letter, min })); changed(); tabGrading(pane); } });
  }

  /* ---------- tab: students ---------- */
  async function tabStudents(pane) {
    const c = S.cls; pane.innerHTML = '<div class="empty">Loading the roster…</div>';
    let r; try { r = await api('teach_roster&id=' + S.id); } catch (e) { pane.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const studs = r.members.filter(m => m.role === 'student'); const tas = r.members.filter(m => m.role === 'ta');
    pane.innerHTML = `<div class="grid cols-2">
      <section class="panel tc-join"><div class="panel-h"><div class="panel-title">${icon('users')} How students join</div></div>
        <div class="tc-bigcode mono" aria-label="Class code">${esc(c.join_code)}</div>
        <p class="small">Students open <b>mathub.space</b>, choose <b>Join a class</b> and type this code, or use the link:</p>
        <div class="row gap-sm" style="flex-wrap:wrap"><button class="btn sm primary" data-action="copy-link">${icon('copy', 13)} Copy join link</button><a class="btn sm" href="#/syllabus/${esc(c.join_code)}" target="_blank" rel="noopener">${icon('external', 13)} Public syllabus page</a><button class="btn sm ghost" data-action="new-code">${icon('rotate', 13)} New code</button></div>
        <p class="help mt-1">${c.status === 'published' ? 'Students who join get the class on their start page right away.' : 'Students can join now; the class appears for them once you publish the syllabus.'} A new code stops the old one from working; nobody is removed.</p></section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('shield')} Teaching team</div></div>
        <p class="small"><b>${esc(S.owner)}</b> <span class="chip xs">owner</span></p>${tas.map(t => `<div class="row between tc-team"><span class="small"><b>${esc(t.name)}</b> · ${esc(t.email)}</span><button class="btn xs ghost" data-action="rm" data-u="${t.id}" data-n="${esc(t.name)}">Remove</button></div>`).join('')}
        ${c.access === 'owner' || c.access === 'admin' ? `<form class="row gap-sm mt-1" id="tc-ta"><input class="input" type="email" id="tc-ta-email" placeholder="ta.name@montana.edu" aria-label="Email of a co-instructor or TA" required><button class="btn sm" type="submit">${icon('plus', 13)} Add</button></form><p class="help mt-1">Co-instructors and TAs can edit the syllabus, post, assign and see results. They need a Mathub account.</p>` : ''}</section></div>
      <section class="panel mt-2"><div class="panel-h"><div class="panel-title">${icon('list')} Students <span class="chip xs">${studs.length}</span></div>${studs.length ? `<button class="btn sm" data-action="csv">${icon('download', 13)} Download CSV</button>` : ''}</div>
        ${studs.length ? `<div class="table-wrap"><table class="table compact tc-roster"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th class="num">Assignments</th><th class="num">Average</th><th class="num">Check-ins</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>${studs.map(m => `<tr><td>${esc(m.name)}</td><td class="small">${esc(m.email)}</td><td class="small">${esc(new Date(m.joined * 1000).toLocaleDateString())}</td><td class="num">${m.done}/${r.assignments}</td><td class="num">${m.avg == null ? '–' : m.avg + '%'}</td><td class="num">${m.checkins}/${r.sessions}</td><td><button class="btn xs ghost" data-action="rm" data-u="${m.id}" data-n="${esc(m.name)}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">Nobody has joined yet. Share the code in class or on Canvas.</div>`}
        <p class="help mt-1">You see each student’s name, email, assignment results and check-ins for this class only. The rest of their Mathub activity stays private. Official grades stay in Canvas.</p></section>`;
    bind(pane, {
      'copy-link': () => copy(joinLink(c.join_code), 'Join link copied.'),
      'new-code': async () => { if (!confirm('Make a new class code? The old code stops working.')) return; try { const x = await api('teach_class_code', { id: S.id }); S.cls.join_code = x.join_code; openClass($('#tc-body'), S.id, 'students'); } catch (e) { toast(e.message); } },
      rm: async (b) => { if (!confirm(`Remove ${b.dataset.n} from the class? Their results for this class are kept until you delete the class.`)) return; try { await api('teach_member_remove', { id: S.id, user_id: Number(b.dataset.u) }); tabStudents(pane); } catch (err) { toast(err.message); } },
      csv: () => { const q = v => { let t = String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };   /* a leading = + - @ would run as a spreadsheet formula */ const lines = [['Name', 'Email', 'Joined', 'Assignments done', 'Average %', 'Check-ins'].map(q).join(',')].concat(studs.map(m => [m.name, m.email, new Date(m.joined * 1000).toISOString().slice(0, 10), m.done, m.avg == null ? '' : m.avg, m.checkins].map(q).join(','))); download(lines.join('\n'), `${c.code.replace(/\s+/g, '')}-roster.csv`, 'text/csv'); }
    });
    const f = $('#tc-ta', pane); if (f) f.addEventListener('submit', async e => { e.preventDefault(); try { await api('teach_staff_add', { id: S.id, email: $('#tc-ta-email', f).value }); toast('Added to the teaching team.'); tabStudents(pane); } catch (err) { toast(err.message, 5000); } });
  }
  function download(text, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- tab: announcements ---------- */
  async function tabAnnounce(pane) {
    pane.innerHTML = '<div class="empty">Loading…</div>';
    let h; try { h = await api('teach_hub&id=' + S.id); } catch (e) { pane.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    pane.innerHTML = `<div class="grid cols-2"><form class="panel" id="tc-post" novalidate><div class="panel-h"><div class="panel-title">${icon('megaphone')} New announcement</div></div>
        <div class="field"><label for="ta-title">Title <span class="req">*</span></label><input class="input" id="ta-title" maxlength="120" placeholder="Office hours moved this week" required></div>
        <div class="field mt-1"><label for="ta-body">Message</label><textarea class="input" id="ta-body" rows="5" maxlength="4000" placeholder="Details, links…"></textarea></div>
        <label class="check mt-1"><input type="checkbox" id="ta-pin"><span>Pin to the top of the class hub</span></label>
        <div class="row gap-sm mt-2"><button class="btn primary" type="submit">${icon('send', 14)} Post</button><span class="small muted" id="ta-st" role="status"></span></div>
        <p class="help mt-1">Every student in the class gets it in their Mathub inbox, and on their phone if they turned notifications on.</p></form>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('list')} Posted</div></div>${h.posts.length ? h.posts.map(p => `<div class="tc-post"><div class="row between"><b>${p.pinned ? icon('pin', 12) + ' ' : ''}${esc(p.title)}</b><button class="btn xs ghost" data-action="del-post" data-id="${p.id}">Delete</button></div><div class="small muted">${esc(p.author)} · ${esc(ago(p.created))}</div>${p.body ? `<div class="small tc-post-body">${paras(p.body)}</div>` : ''}</div>`).join('') : '<div class="empty">Nothing posted yet.</div>'}</section></div>`;
    $('#tc-post', pane).addEventListener('submit', async e => { e.preventDefault(); const st = $('#ta-st', pane); st.textContent = 'Posting…';
      try { const r = await api('teach_post', { id: S.id, title: $('#ta-title', pane).value, body: $('#ta-body', pane).value, pinned: $('#ta-pin', pane).checked }); toast(r.told ? `Posted and sent to ${r.told} student${r.told === 1 ? '' : 's'}.` : 'Posted.'); tabAnnounce(pane); } catch (err) { st.textContent = err.message; } });
    bind(pane, { 'del-post': async (b) => { if (!confirm('Delete this announcement?')) return; try { await api('teach_post_delete', { post_id: Number(b.dataset.id) }); tabAnnounce(pane); } catch (err) { toast(err.message); } } });
  }

  /* ---------- tab: assignments ---------- */
  const quizCourses = () => App.COURSE_ORDER.filter(id => { const C = global.Courses[id]; return C && !C.hidden && (C.quiz || C.hasQuiz || ['calc', 'physics', 'precalc', 'csci', 'biob', 'kin', 'psyx'].includes(id)); });
  async function topicsOf(id) { const C = global.Courses[id]; if (!C) return []; if (!C.quiz && App.loadCourse) { try { await App.loadCourse(id); } catch (e) {} } const T = (C.quiz && C.quiz.TOPICS) || C.quizTopics || {}; return Object.keys(T).map(k => ({ id: k, label: T[k].label || k, unit: T[k].unit || 1, sec: T[k].sec || '' })); }
  async function tabAssign(pane) {
    pane.innerHTML = '<div class="empty">Loading…</div>';
    let h; try { h = await api('teach_hub&id=' + S.id); } catch (e) { pane.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const courses = quizCourses(); const def = courses.includes(S.cls.link_course) ? S.cls.link_course : courses[0];
    pane.innerHTML = `<div class="tc-split"><div class="tc-main">
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('target')} Assignments</div><span class="small muted">${h.class.students} student${h.class.students === 1 ? '' : 's'}</span></div>
        ${h.assignments.length ? h.assignments.map(a => `<div class="tc-asg"><div class="row between"><div><b>${esc(a.title)}</b><div class="small muted">${a.count} questions · ${esc((global.Courses[a.course] || {}).short || a.course)} · ${esc(dueText(a.due))}${a.minutes ? ` · ${a.minutes} min` : ''}</div></div><div class="row gap-sm"><span class="chip xs ${h.class.students && a.submitted >= h.class.students ? 'good' : ''}">${a.submitted}/${h.class.students} done</span><button class="btn xs" data-action="res" data-id="${a.id}">Results</button><button class="btn xs ghost" data-act="del" data-id="${a.id}">Delete</button></div></div><div class="tc-asg-res" id="tc-res-${a.id}" hidden></div></div>`).join('') : '<div class="empty">No assignments yet. Create one on the right.</div>'}
        <p class="help mt-1">Practice for learning, not for the grade book: each student gets their own version of the questions, can retake it, and you see their best score. Official grades stay in Canvas.</p></section>
    </div><aside class="tc-side"><form class="panel tc-sticky" id="tc-asg" novalidate><div class="panel-title mb-1">${icon('plus')} New assignment</div>
      <div class="field"><label for="as-title">Title</label><input class="input" id="as-title" maxlength="120" placeholder="Limits practice" required></div>
      <div class="field mt-1"><label for="as-course">Questions from</label><select class="select" id="as-course">${courses.map(id => `<option value="${id}"${id === def ? ' selected' : ''}>${esc(global.Courses[id].code || global.Courses[id].short)} ${esc(global.Courses[id].name || '')}</option>`).join('')}</select></div>
      <div class="field mt-1" role="group" aria-labelledby="as-topics-l"><span class="tc-label" id="as-topics-l">Topics</span><div class="tc-topics" id="as-topics"><span class="small muted">Loading topics…</span></div></div>
      <div class="grid cols-2 mt-1"><div class="field"><label for="as-count">Questions</label><input class="input" id="as-count" type="number" min="3" max="40" value="10"></div><div class="field"><label for="as-min">Time limit (min)</label><input class="input" id="as-min" type="number" min="0" max="240" value="0"><span class="help">0 = suggested time only</span></div></div>
      <div class="field mt-1"><label for="as-due">Due</label><input class="input" id="as-due" type="datetime-local"></div>
      <div class="field mt-1"><label for="as-note">Note to students</label><input class="input" id="as-note" maxlength="500" placeholder="Optional"></div>
      <div class="row gap-sm mt-2"><button class="btn primary" type="submit">${icon('send', 14)} Assign</button><span class="small muted" id="as-st" role="status"></span></div></form></aside></div>`;
    const sel = $('#as-course', pane); const box = $('#as-topics', pane);
    const paintTopics = async () => { box.innerHTML = '<span class="small muted">Loading topics…</span>'; const T = await topicsOf(sel.value); box.innerHTML = T.length ? T.map(t => `<label class="check"><input type="checkbox" value="${esc(t.id)}"><span>${esc(t.label)} <span class="muted small">unit ${t.unit}</span></span></label>`).join('') : '<span class="small muted">This class has no question bank.</span>'; };
    if (sel.value) paintTopics(); sel.addEventListener('change', paintTopics);
    $('#tc-asg', pane).addEventListener('submit', async e => { e.preventDefault(); const st = $('#as-st', pane); const topics = $$('input:checked', box).map(x => x.value); if (!topics.length) { st.textContent = 'Pick at least one topic.'; return; } st.textContent = 'Assigning…';
      try { const r = await api('teach_assignment_save', { id: S.id, title: $('#as-title', pane).value, course: sel.value, topics, count: Number($('#as-count', pane).value), minutes: Number($('#as-min', pane).value), due: $('#as-due', pane).value, note: $('#as-note', pane).value }); toast(r.told ? `Assigned; ${r.told} student${r.told === 1 ? '' : 's'} told.` : 'Assigned.'); tabAssign(pane); } catch (err) { st.textContent = err.message; } });
    bind(pane, {
      del: async (b) => { if (!confirm('Delete this assignment and its results?')) return; try { await api('teach_assignment_delete', { id: S.id, assignment_id: Number(b.dataset.id) }); tabAssign(pane); } catch (err) { toast(err.message); } },
      res: async (b) => { const el = $('#tc-res-' + b.dataset.id, pane); if (!el.hidden) { el.hidden = true; return; } el.hidden = false; el.innerHTML = '<div class="small muted">Loading…</div>';
        try { const r = await api('teach_results&assignment_id=' + b.dataset.id); const C = global.Courses[r.assignment.course]; const lab = t => (C && ((C.quiz && C.quiz.TOPICS[t]) || (C.quizTopics || {})[t]) || {}).label || t;
          el.innerHTML = `${r.topics.length ? `<div class="tc-bars mb-1">${r.topics.map(t => `<div class="tc-bar"><span class="small">${esc(lab(t.topic))}</span><span class="tc-bar-track"><i style="width:${t.pct}%" class="${t.pct < 60 ? 'low' : t.pct < 80 ? 'mid' : 'high'}"></i></span><span class="small mono">${t.pct}%</span></div>`).join('')}</div>` : ''}
            <div class="table-wrap"><table class="table compact"><thead><tr><th>Student</th><th class="num">Best</th><th class="num">Tries</th><th class="num">Minutes</th><th>When</th></tr></thead><tbody>${r.students.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${s.done ? `${s.best}/${s.total}` : '–'}</td><td class="num">${s.attempts || ''}</td><td class="num">${s.minutes == null ? '' : s.minutes}</td><td class="small">${s.done ? esc(new Date(s.updated * 1000).toLocaleString()) + (s.late ? ' <span class="chip xs warn">late</span>' : '') : '<span class="muted">not yet</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No students yet.</td></tr>'}</tbody></table></div>`; }
        catch (err) { el.innerHTML = `<div class="small">${esc(err.message)}</div>`; } }
    });
  }

  /* ---------- tab: attendance ---------- */
  let attTimer = null;
  async function tabAttendance(pane) {
    clearInterval(attTimer); pane.innerHTML = '<div class="empty">Loading…</div>';
    let r; try { r = await api('teach_insights&id=' + S.id); } catch (e) { pane.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const open = r.open && r.open.closes * 1000 > Date.now() ? r.open : null;
    pane.innerHTML = `<div class="grid cols-2"><section class="panel tc-att"><div class="panel-h"><div class="panel-title">${icon('check')} Take attendance</div></div>
        ${open ? `<p class="small">Show this on the screen. Students open the class on Mathub and type it.</p><div class="tc-bigcode mono tc-att-code" aria-live="polite">${esc(open.code)}</div><p class="small tc-center"><b id="tc-att-left"></b> left · <span id="tc-att-n">${(r.attendance.find(x => x.id === open.id) || { n: 0 }).n}</span> of ${r.students} checked in</p><div class="row gap-sm"><button class="btn" data-action="close" data-id="${open.id}">${icon('lock', 14)} Close check-in</button></div>`
        : `<p class="small">Opens a 4-digit code for a few minutes. Students who are in class type it on the class hub.</p><div class="row gap-sm mt-1"><input class="input tc-w-s" id="at-label" maxlength="60" placeholder="Label (optional)"><select class="select tc-w-s" id="at-min" aria-label="How long"><option value="3">3 minutes</option><option value="5" selected>5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select><button class="btn primary" data-action="open">${icon('play', 14)} Open check-in</button></div>`}</section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('calendar')} Past sessions</div></div>${r.attendance.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Session</th><th>When</th><th class="num">Checked in</th></tr></thead><tbody>${r.attendance.map(a => `<tr><td>${esc(a.label)}</td><td class="small">${esc(new Date(a.opens * 1000).toLocaleString())}</td><td class="num">${a.n}/${r.students}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No sessions yet.</div>'}<p class="help mt-1">Per-student check-ins are on the Students tab.</p></section></div>`;
    bind(pane, {
      open: async () => { try { await api('teach_att_open', { id: S.id, minutes: Number($('#at-min', pane).value), label: $('#at-label', pane).value }); tabAttendance(pane); } catch (e) { toast(e.message); } },
      close: async (b) => { try { await api('teach_att_close', { id: S.id, session_id: Number(b.dataset.id) }); tabAttendance(pane); } catch (err) { toast(err.message); } }
    });
    if (open) { const tick = async () => { const left = Math.max(0, Math.round(open.closes - Date.now() / 1000)); const el = $('#tc-att-left', pane); if (!el || !pane.isConnected) { clearInterval(attTimer); return; } el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { clearInterval(attTimer); tabAttendance(pane); return; } if (left % 5 === 0) { try { const x = await api('teach_insights&id=' + S.id); const n = (x.attendance.find(a => a.id === open.id) || { n: 0 }).n; const ne = $('#tc-att-n', pane); if (ne) ne.textContent = n; } catch (e) {} } }; tick(); attTimer = setInterval(tick, 1000); }
  }

  /* ---------- tab: insights ---------- */
  async function tabInsights(pane) {
    pane.innerHTML = '<div class="empty">Loading…</div>';
    let r; try { r = await api('teach_insights&id=' + S.id); } catch (e) { pane.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const done = r.assignments.reduce((a, x) => a + x.done, 0), possible = r.assignments.length * r.students; const avgs = r.assignments.filter(x => x.avg != null);
    const stat = (n, l) => `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${l}</div></div>`;
    const lab = t => { for (const id of quizCourses()) { const C = global.Courses[id]; const T = (C.quiz && C.quiz.TOPICS) || C.quizTopics || {}; if (T[t]) return T[t].label; } return t; };
    pane.innerHTML = `<div class="stats tc-stats mb-2">${stat(r.students, 'students')}${stat(r.joined_week, 'joined this week')}${stat(possible ? Math.round(100 * done / possible) + '%' : '–', 'assignments completed')}${stat(avgs.length ? Math.round(avgs.reduce((a, x) => a + x.avg, 0) / avgs.length) + '%' : '–', 'average best score')}${stat(r.attendance.length ? Math.round(100 * r.attendance.reduce((a, x) => a + x.n, 0) / Math.max(1, r.attendance.length * r.students)) + '%' : '–', 'attendance')}</div>
      <div class="grid cols-2"><section class="panel"><div class="panel-h"><div class="panel-title">${icon('target')} Assignments</div></div>${r.assignments.length ? `<div class="tc-bars">${r.assignments.map(a => `<div class="tc-bar"><span class="small">${esc(a.title)}</span><span class="tc-bar-track"><i style="width:${r.students ? Math.round(100 * a.done / r.students) : 0}%"></i></span><span class="small mono">${a.done}/${r.students}${a.avg != null ? ` · ${a.avg}%` : ''}${a.late ? ` · ${a.late} late` : ''}</span></div>`).join('')}</div>` : '<div class="empty">No assignments yet.</div>'}</section>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('flag')} Where the class struggles</div><span class="small muted">topics with 5+ answers</span></div>${r.topics.length ? `<div class="tc-bars">${r.topics.map(t => `<div class="tc-bar"><span class="small">${esc(lab(t.topic))}</span><span class="tc-bar-track"><i style="width:${t.pct}%" class="${t.pct < 60 ? 'low' : t.pct < 80 ? 'mid' : 'high'}"></i></span><span class="small mono">${t.pct}% · ${t.answered}</span></div>`).join('')}</div><p class="help mt-1">Percent correct across every student’s latest attempt. Worth a few minutes in class when a topic sits below 60%.</p>` : '<div class="empty">Shows up once students finish assignments.</div>'}</section></div>`;
  }

  /* ============================================================
     #/class — students
     ============================================================ */
  App.views.class = {
    title: 'Your class',
    render(root, param) {
      const parts = String(param || '').split('/').filter(Boolean);
      root.innerHTML = `<div class="landing-wrap tc-wrap"><header class="landing-top"><div><div class="eyebrow">Mathub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>${parts[0] === 'join' ? 'Join a class' : parts[0] ? 'Class hub' : 'Your classes with an instructor'}</h1></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="${parts[0] && parts[0] !== 'join' ? '#/class' : '#/'}">${icon('left', 14)} ${parts[0] && parts[0] !== 'join' ? 'Your classes' : 'Mathub'}</a></div></header><div id="tc-body"><div class="empty">Loading…</div></div></div>`;
      const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      const body = $('#tc-body', root);
      if (parts[0] === 'join') return joinPage(body, (parts[1] || '').toUpperCase());
      if (App.auth && !App.auth.ready) { body.innerHTML = '<div class="empty">Checking your account…</div>'; return; }
      if (signedOut()) { body.innerHTML = App.lockCard('Sign in to see your classes', 'Your instructor gave you a class code. Sign in with your montana.edu email to join.') + joinBox(); if (App.auth) App.auth.bindLocks(body); wireJoinBox(body); return; }
      if (parts[0]) hub(body, parseInt(parts[0], 10)); else myClasses(body);
    }
  };
  const joinBox = () => `<form class="panel tc-joinbox" id="tc-joinbox" novalidate><div class="panel-title mb-1">${icon('users')} Join with a class code</div><div class="row gap-sm"><input class="input mono tc-codein" id="tj-code" maxlength="8" placeholder="ABC234" autocomplete="off" autocapitalize="characters" aria-label="Class code"><button class="btn primary" type="submit">Continue</button></div><p class="help mt-1">Six letters and numbers, from your instructor.</p></form>`;
  const wireJoinBox = body => { const f = $('#tc-joinbox', body); if (f) f.addEventListener('submit', e => { e.preventDefault(); const v = $('#tj-code', f).value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length === 6) location.hash = '#/class/join/' + v; else toast('Class codes have 6 letters and numbers.'); }); };
  async function myClasses(body) {
    let me; try { me = await api('teach_me'); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const card = c => `<a class="tc-card" href="#/class/${c.id}"><div class="row between"><span class="tc-card-code">${esc(c.code)}${c.section ? ` · ${esc(c.section)}` : ''}</span>${c.status === 'published' ? '' : '<span class="chip xs warn">syllabus coming</span>'}</div><b class="tc-card-title">${esc(c.title)}</b><span class="small muted">${esc(c.instructor)} · ${esc(c.term)}</span></a>`;
    body.innerHTML = `${me.enrolled.length ? `<div class="tc-grid">${me.enrolled.map(card).join('')}</div>` : '<div class="empty">You have not joined a class yet.</div>'}<div class="mt-2">${joinBox()}</div>${me.instructor || me.teaching.length ? `<p class="small muted mt-2">Teaching? <a href="#/teach">Open your classes as an instructor</a>.</p>` : `<p class="small muted mt-2">Are you an instructor? <a href="#/teach">Mathub for professors</a>.</p>`}`;
    wireJoinBox(body);
  }
  async function joinPage(body, code) {
    if (!/^[A-Z0-9]{6}$/.test(code)) { body.innerHTML = joinBox(); wireJoinBox(body); return; }
    let r; try { r = await api('teach_join_info&code=' + code); } catch (e) { body.innerHTML = `<div class="callout">${esc(e.message)}</div>${joinBox()}`; wireJoinBox(body); return; }
    const c = r.class; const already = c.access === 'student'; const teaching = ['owner', 'staff', 'admin'].includes(c.access);
    body.innerHTML = `<div class="grid cols-2 tc-joincard"><section class="panel"><div class="eyebrow">${esc(c.code)}${c.section ? ` · Section ${esc(c.section)}` : ''} · ${esc(c.term)}</div><h2 class="tc-h2">${esc(c.title)}</h2><p class="small">Taught by <b>${esc(c.instructor)}</b>${c.students ? ` · ${c.students} student${c.students === 1 ? '' : 's'} joined` : ''}</p>
        ${signedOut() ? App.lockCard('Sign in to join', 'Use your montana.edu email. It takes a minute.', { compact: true }) : already ? `<a class="btn primary" href="#/class/${c.id}">${icon('right', 14)} Open the class</a>` : teaching ? `<a class="btn primary" href="#/teach/${c.id}">${icon('right', 14)} You teach this class</a>` : `<button class="btn primary" data-action="join">${icon('check', 14)} Join ${esc(c.code)}</button>`}
        <div class="callout small mt-2">${icon('eye', 13)} <b>What your instructor sees:</b> your name and email, your results on this class’s practice assignments, and your attendance check-ins. Nothing else you do on Mathub is shared, and you can leave the class at any time.</div></section>
      <section class="panel"><div class="panel-title mb-1">${icon('file')} Syllabus</div>${c.syllabus ? `<p class="small">${esc((c.syllabus.course || {}).description || '').slice(0, 280)}${((c.syllabus.course || {}).description || '').length > 280 ? '…' : ''}</p><a class="btn sm" href="#/syllabus/${esc(code)}">${icon('eye', 13)} Read the full syllabus</a>` : '<p class="small muted">Your instructor has not published the syllabus yet. Join now and it appears when it is ready.</p>'}</section></div>`;
    if (App.auth) App.auth.bindLocks(body);
    bind(body, { join: async () => { try { const x = await api('teach_join', { code }); if (App.packs && App.packs.sync) await App.packs.sync(); if (App.auth && App.auth.refresh) App.auth.refresh(); App.teachForget(); toast(`You joined ${c.code}.`); location.hash = '#/class/' + x.id; } catch (e) { toast(e.message, 5000); } } });
  }
  async function hub(body, id) {
    let h; try { h = await api('teach_hub&id=' + id); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)} <a href="#/class">Your classes</a></div>`; return; }
    const c = h.class; const pid = c.pack_id;
    const live = c.status === 'published' && !!pid;   // the class list picks the class up on its own (and again when a link to it is opened)
    if (live && !global.Courses[pid] && App.packs && App.packs.sync) App.packs.sync().catch(() => {});
    const link = (v, l, ic) => live ? `<a class="tc-quick" href="#/${pid}/${v}">${icon(ic, 16)}<span>${l}</span></a>` : '';
    const now = Date.now() / 1000;
    body.innerHTML = `<div class="tc-hub-head"><div class="eyebrow">${esc(c.code)}${c.section ? ` · Section ${esc(c.section)}` : ''} · ${esc(c.term)}</div><h2 class="tc-h2">${esc(c.title)}</h2><p class="small muted">${esc(c.instructor)}${h.staff ? ' · you teach this class' : ''}</p></div>
      ${live ? `<nav class="tc-quicks" aria-label="Class pages">${link('course', 'Syllabus', 'file')}${link('calendar', 'Schedule', 'calendar')}${link('grades', 'Grade calculator', 'calc')}${link('exam', 'Exam prep', 'flag')}${link('forum', 'Class board', 'chat')}</nav>` : `<div class="callout small mb-2">${icon('clock', 13)} The syllabus is not published yet. Announcements and assignments still show up here.</div>`}
      ${h.attendance && !h.staff ? `<form class="panel tc-checkin" id="tc-checkin"><div class="panel-title">${icon('check')} ${h.attendance.done ? 'You checked in' : 'Check in: ' + esc(h.attendance.label)}</div>${h.attendance.done ? '<p class="small muted">See you next class.</p>' : `<div class="row gap-sm mt-1"><input class="input mono tc-codein" id="ci-code" inputmode="numeric" maxlength="4" placeholder="0000" aria-label="Code on the screen"><button class="btn primary" type="submit">Check in</button></div>`}</form>` : ''}
      <div class="grid cols-2">
        <section class="panel"><div class="panel-h"><div class="panel-title">${icon('target')} Assignments</div></div>${h.assignments.length ? h.assignments.map(a => { const m = a.mine; const late = a.due && now > a.due; return `<div class="tc-asg"><div class="row between"><div><b>${esc(a.title)}</b><div class="small muted">${a.count} questions · ${esc(dueText(a.due))}${a.minutes ? ` · ${a.minutes} min` : ''}</div>${a.note ? `<div class="small">${esc(a.note)}</div>` : ''}</div>${h.staff ? `<span class="chip xs">${a.submitted} done</span>` : `<div class="row gap-sm">${m ? `<span class="chip xs ${m.best === m.total ? 'good' : ''}">best ${m.best}/${m.total}</span>` : late ? '<span class="chip xs warn">past due</span>' : ''}<button class="btn sm${m ? '' : ' primary'}" data-action="start" data-id="${a.id}">${m ? 'Try again' : 'Start'}</button></div>`}</div></div>`; }).join('') : '<div class="empty">No assignments right now.</div>'}</section>
        <section class="panel"><div class="panel-h"><div class="panel-title">${icon('megaphone')} Announcements</div></div>${h.posts.length ? h.posts.map(p => `<div class="tc-post"><b>${p.pinned ? icon('pin', 12) + ' ' : ''}${esc(p.title)}</b><div class="small muted">${esc(p.author)} · ${esc(ago(p.created))}</div>${p.body ? `<div class="small tc-post-body">${paras(p.body)}</div>` : ''}</div>`).join('') : '<div class="empty">Nothing yet.</div>'}</section></div>
      ${h.staff ? `<p class="small mt-2"><a href="#/teach/${c.id}">${icon('gear', 13)} Manage this class</a></p>` : `<p class="small muted mt-2">Your instructor sees your results on these assignments and your check-ins, nothing else. <button class="linkbtn small" data-action="leave">Leave this class</button></p>`}`;
    const f = $('#tc-checkin', body); if (f && $('#ci-code', f)) f.addEventListener('submit', async e => { e.preventDefault(); try { await api('teach_checkin', { id, code: $('#ci-code', f).value }); toast('Checked in.'); hub(body, id); } catch (err) { toast(err.message, 4000); } });
    bind(body, {
      start: (b) => startAssignment(h.assignments.find(a => a.id === Number(b.dataset.id)), c, () => hub(body, id)),
      leave: async () => { if (!confirm(`Leave ${c.code}? You can join again with the code.`)) return; try { await api('teach_leave', { id }); App.teachForget(); location.hash = '#/class'; } catch (err) { toast(err.message); } }
    });
  }
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** Runs an assignment in the source class's quizzer. Each student gets their own version; a retake gets a new one. */
  async function startAssignment(a, cls) {
    const C = a && global.Courses[a.course]; if (!C) { toast('The class these questions come from is not available.'); return; }
    try { if (App.loadCourse) await App.loadCourse(a.course); } catch (e) { toast(e.message, 4000); return; }
    const go = () => {
      const QZ = C.quiz; if (!QZ) { toast('That class has no question bank.'); return; }
      const topics = a.topics.filter(t => QZ.TOPICS[t]); const seed = (a.seed ^ hashStr(String(user().id) + ':' + ((a.mine && a.mine.attempts) || 0))) >>> 0;
      const qs = App.seededSet(topics.length ? topics : Object.keys(QZ.TOPICS), a.count, seed); if (!qs.length) { toast('Could not build the questions.'); return; }
      App.runTimedSet({ questions: qs, minutes: a.minutes || Math.max(10, a.count * 3), title: `${cls.code}: ${a.title}`, onSubmit: async (correct, total, seconds, per) => {
        const tp = {}; (per || []).forEach(x => { tp[x.topic] = tp[x.topic] || [0, 0]; tp[x.topic][1]++; if (x.ok) tp[x.topic][0]++; });
        try { const r = await api('teach_submit', { assignment_id: a.id, score: correct, seconds, topics: tp }); toast(`Sent to ${cls.instructor}: ${correct}/${total}${r.late ? ' (after the due date)' : ''}.`, 5000); } catch (e) { toast('Your score was not sent: ' + e.message, 6000); } } });
    };
    let fired = false; if (App.D && App.D.id === a.course) { fired = true; go(); }
    else { App.onCourse(D => { if (fired || !D || D.id !== a.course) return; fired = true; setTimeout(go, 60); }); location.hash = `#/${a.course}/practice`; }
  }

  /* ---------- #/syllabus/<CODE>: the published syllabus for anyone with the code ---------- */
  App.views.syllabus = {
    title: 'Syllabus',
    async render(root, param) {
      const code = String(param || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      root.innerHTML = `<div class="landing-wrap tc-wrap"><header class="landing-top no-print"><div><div class="eyebrow">Mathub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Syllabus</h1></div><div class="row gap-sm"><button class="btn" data-action="print">${icon('print', 14)} Print / PDF</button><a class="btn primary" href="#/class/join/${esc(code)}">${icon('users', 14)} Join this class</a></div></header><div id="sy-body"><div class="empty">Loading…</div></div></div>`;
      const b = $('#sy-body', root); let r;
      try { r = await api('teach_join_info&code=' + code); } catch (e) { b.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      if (!r.class.syllabus) { b.innerHTML = '<div class="empty">The instructor has not published this syllabus yet.</div>'; return; }
      b.innerHTML = `<div class="panel sy-panel">${docHtml(r.class.syllabus, r.class)}</div>`; document.title = `${r.class.code} ${r.class.title} · Syllabus · Mathub`;
      bind(root, { print: () => printDoc(docHtml(r.class.syllabus, r.class), `${r.class.code} ${r.class.title} syllabus`) });
    }
  };

  /* ---------- links from the rest of the site ---------- */
  App.teachLinks = () => `<a class="rq-link" href="#/class">${icon('users', 13)} Have a class code? Join your class</a><a class="rq-link" href="#/teach">${icon('file', 13)} Teaching? Build your syllabus on Mathub</a>`;
  /* On a class built in #/teach, its dashboard gets a strip to the class hub (announcements, assignments, check-in).
     Which classes those are comes from teach_me (the classes this person joined or teaches), cached for a few minutes. */
  const hubs = { map: null, at: 0, loading: null };
  const hubMap = () => { if (hubs.map && Date.now() - hubs.at < 300000) return Promise.resolve(hubs.map); if (!hubs.loading) hubs.loading = api('teach_me').then(me => { const m = {}; me.teaching.concat(me.enrolled).forEach(c => { if (c.pack_id) m[c.pack_id] = c.id; }); hubs.map = m; hubs.at = Date.now(); return m; }).catch(() => ({})).finally(() => { hubs.loading = null; }); return hubs.loading; };
  App.teachForget = () => { hubs.map = null; };
  App.onRender = App.onRender || [];
  App.onRender.push((root, r) => {
    if (!r.course || r.view !== 'dashboard' || signedOut()) return; const C = global.Courses[r.course]; if (!C || !C.pack) return;
    hubMap().then(m => { const cid = m[r.course]; if (!cid || !root.isConnected || $('.tc-strip', root)) return;
      const strip = document.createElement('a'); strip.className = 'tc-strip'; strip.href = '#/class/' + cid; strip.innerHTML = `${icon('megaphone', 15)}<span><b>Class hub</b> · announcements, assignments and check-in from your instructor</span>${icon('right', 14)}`;
      root.insertAdjacentElement('afterbegin', strip); });
  });

  /* ---------- admin panel: instructors ---------- */
  if (App.views.admin) App.views.admin.teach = async function (el) {
    el.innerHTML = '<div class="empty">Loading…</div>';
    let r; try { r = await api('admin_teach_requests'); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const open = r.requests.filter(x => x.status === 'new'); const rest = r.requests.filter(x => x.status !== 'new');
    const reqRow = x => `<div class="tc-adm-req"><div><b>${esc(x.name)}</b>${x.title ? ` · ${esc(x.title)}` : ''} · ${esc(x.department)}<div class="small">${esc(x.email)} · teaches ${esc(x.courses)}</div>${x.message ? `<div class="small muted">${esc(x.message)}</div>` : ''}<div class="small muted">${esc(ago(x.created))}</div></div>${x.status === 'new' ? `<div class="row gap-sm"><button class="btn sm primary" data-action="ok" data-id="${x.id}">Approve</button><button class="btn sm ghost" data-action="no" data-id="${x.id}">Decline</button></div>` : `<span class="chip xs ${x.status === 'approved' ? 'good' : 'muted'}">${esc(x.status)}</span>`}</div>`;
    el.innerHTML = `<div class="callout small mb-2">Approve only people you can confirm teach at Montana State (a faculty page, a department listing, or a reply from their montana.edu address). Approved instructors can publish classes for the students who join them, post to those classes and assign practice; nothing site-wide.</div>
      <div class="panel"><div class="panel-h"><div class="panel-title">${icon('shield')} Waiting <span class="chip xs">${open.length}</span></div></div>${open.length ? open.map(reqRow).join('') : '<div class="empty">No requests waiting.</div>'}</div>
      <div class="grid cols-2 mt-2"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('users')} Instructors</div></div>${r.instructors.length ? r.instructors.map(i => `<div class="row between tc-team"><span class="small"><b>${esc(i.name || i.email)}</b> · ${esc(i.email)}${i.scope === 'teach' ? '' : ' <span class="chip xs">all classes</span>'}</span><button class="btn xs ghost" data-action="revoke" data-email="${esc(i.email)}">Revoke</button></div>`).join('') : '<div class="empty">None yet.</div>'}</div>
      <div class="panel"><div class="panel-h"><div class="panel-title">${icon('book')} Classes</div></div>${r.classes.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Class</th><th>Instructor</th><th class="num">Students</th><th>Status</th></tr></thead><tbody>${r.classes.map(c => `<tr><td><a href="#/teach/${c.id}">${esc(c.code)} ${esc(c.title)}</a><div class="small muted">${esc(c.term)}</div></td><td class="small">${esc(c.instructor)}</td><td class="num">${c.students}</td><td>${c.status === 'published' ? '<span class="chip xs good">published</span>' : '<span class="chip xs warn">draft</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No classes yet.</div>'}</div></div>
      ${rest.length ? `<div class="panel mt-2"><div class="panel-h"><div class="panel-title">${icon('list')} Earlier requests</div></div>${rest.map(reqRow).join('')}</div>` : ''}`;
    bind(el, {
      ok: async (b) => { try { await api('admin_teach_decide', { id: Number(b.dataset.id), decision: 'approve' }); toast('Approved. They can build classes now.'); App.views.admin.teach(el); } catch (err) { toast(err.message); } },
      no: async (b) => { if (!confirm('Decline this request?')) return; try { await api('admin_teach_decide', { id: Number(b.dataset.id), decision: 'decline' }); App.views.admin.teach(el); } catch (err) { toast(err.message); } },
      revoke: async (b) => { if (!confirm(`Remove instructor access for ${b.dataset.email}? Their classes stay; they can no longer edit them.`)) return; try { await api('admin_teach_decide', { decision: 'revoke', email: b.dataset.email }); App.views.admin.teach(el); } catch (err) { toast(err.message); } }
    });
  };
})(window);
