/* ============================================================
   Mathub — instructors (api/instruct.php). Two pages:
   - #/<class>/instructor: for a class's instructors only (its syllabus email, its Mathub Faculty teaching team, or an
     administrator). Bo in this class (hints only, notes for Bo), draft feedback (on or off, sharing, peer review
     swaps, each project's assignment sheet and rubric), the versions students shared, patterns across the class
     (anonymous, from students who let their drafts count, once there are five) and credits for their students.
     #/<class>/instructor/share/<id> opens one shared version.
   - #/instructors: what Mathub does in a class and what an instructor controls, for anyone.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const cid = () => (App.D ? App.D.id : '');
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const dateOf = ts => App.fmtDate(new Date(ts * 1000).toLocaleDateString('en-CA'));
  const stageLabel = s => s === 'revised' ? 'Revised draft' : 'First draft';
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw new Error('Mathub cannot be reached right now.'); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }
  const q = s => encodeURIComponent(s);
  const S = { dirty: () => false };   // unsaved settings on the page: a closed tab asks first, and they wait on this device until saved
  const DRAFT = () => 'mathub-instr-' + cid();
  const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT()) || 'null'); } catch (e) { return null; } };
  const keepDraft = v => { try { if (v) localStorage.setItem(DRAFT(), JSON.stringify(v)); else localStorage.removeItem(DRAFT()); } catch (e) {} };
  global.addEventListener('beforeunload', e => { if (S.dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- the class's instructor page ---------- */
  const HEAD = () => App.pageHead('Instructor', 'For this class’s instructors: how Bo works in it, the drafts students shared with you, patterns across the class, and credits for your students.');
  const notStaff = root => { root.innerHTML = HEAD() + `<div class="callout mt-3">${icon('lock', 14)} <span>This page is for the class’s instructors. If you teach this class, sign in with the email address on its syllabus, or add the class in <a href="#/teach">Mathub Faculty</a>.</span></div><p class="mt-2"><a class="btn" href="#/instructors">${icon('info', 14)} What instructors can do on Mathub</a></p>`; };

  function settingsHtml(I) {
    const S = I.settings; const P = I.projects;
    const proj = p => { const x = (S.projects || {})[p.id] || { sheet: '', rubric: [] }; return `<details class="in-proj panel" data-p="${esc(p.id)}"><summary><b>${esc(p.name)}</b><span class="in-proj-sum small muted"></span></summary>
        <div class="in-proj-b">
          ${p.goals.length ? `<div class="small"><span class="eyebrow">Its goals, from the syllabus</span><ul class="in-goals">${p.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
          <div class="field"><label for="in-sheet-${esc(p.id)}">Assignment sheet <span class="muted">(optional)</span></label><textarea class="input in-sheet" id="in-sheet-${esc(p.id)}" rows="7" maxlength="8000" placeholder="Paste the assignment sheet, or open the file you give students." translate="no">${esc(x.sheet || '')}</textarea>
            <div class="row gap-sm mt-1"><label class="btn sm" for="in-file-${esc(p.id)}">${icon('upload', 13)} Open a file</label><input type="file" class="sr-only in-file" id="in-file-${esc(p.id)}" accept=".docx,.pdf,.odt,.txt,.md,text/plain,application/pdf"><span class="small muted">.docx, .pdf, .odt or .txt</span></div></div>
          <fieldset class="in-rub-f"><legend>Rubric <span class="muted">(optional, up to 12 criteria)</span></legend>
            <ol class="in-rub">${(x.rubric || []).map(r => rubRow(r)).join('')}</ol>
            <button type="button" class="btn sm" data-action="in-rub-add">${icon('plus', 13)} Add a criterion</button></fieldset>
        </div></details>`; };
    return `<form id="in-form" class="in-form" novalidate>
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('chat')} Bo in this class</div></div>
        <label class="check in-check"><input type="checkbox" name="hints"${S.hints ? ' checked' : ''}><span><b>Hints only</b><span class="small muted"> Bo gives one hint at a time and checks students’ steps, and never gives the final answer to a problem from this class.</span></span></label>
        <div class="field mt-2"><label for="in-notes">Notes for Bo <span class="muted">(optional)</span></label><textarea class="input" id="in-notes" name="notes" rows="4" maxlength="1500" placeholder="For example: We use MLA 9. Do not discuss the take-home exam before it is due." translate="no">${esc(S.notes || '')}</textarea>
          <span class="small muted" id="in-notes-n" aria-live="polite"></span></div>
        <p class="small muted">Bo reads these in every chat and call in this class. His own rules still come first: notes cannot make him write students’ work for them.</p>
      </section>
      ${P.length ? `<section class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('pen')} Draft feedback</div>
          <div class="row gap-sm">${I.drafts_off ? `<span class="chip bad">Off</span><button type="button" class="btn sm" data-action="in-switch" data-off="0">Turn it on</button>` : `<span class="chip good">On</span><button type="button" class="btn sm" data-action="in-switch" data-off="1">Turn it off</button>`}</div></div>
        <p class="small muted">Students share a draft and Bo comments on it like a writing tutor: he marks passages, names the biggest revisions and asks questions. He never writes any of it for them.</p>
        <label class="check in-check"><input type="checkbox" name="share"${S.share ? ' checked' : ''}><span><b>Students can share a version with you</b><span class="small muted"> They choose a version to share, with a note; you read it, with Bo’s feedback, under Shared with you.</span></span></label>
        <label class="check in-check"><input type="checkbox" name="peer"${S.peer ? ' checked' : ''}><span><b>Peer review swaps</b><span class="small muted"> A student offers a draft and is paired with a classmate offering one for the same project; each reads the other’s and writes back.</span></span></label>
        <div class="field in-days"><label for="in-days">Days to write back</label><select class="select" id="in-days" name="peer_days">${[1, 2, 3, 4, 5, 7, 10, 14].map(d => `<option value="${d}"${+S.peer_days === d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
        <h2 class="in-h">Assignment sheets and rubrics</h2>
        <p class="small muted">Bo reads each draft against these as well as the project’s goals. He never gives a grade, a score or a level.</p>
        <div class="in-projs">${P.map(proj).join('')}</div>
      </section>` : ''}
      <div class="in-save"><button type="submit" class="btn primary">${icon('check', 14)} Save</button><span class="small muted" id="in-state" role="status" aria-live="polite">${S.updated ? esc(t('Saved {1}', dateOf(S.updated))) : ''}</span></div>
    </form>`;
  }
  const rubRow = (r = { name: '', text: '' }) => `<li class="in-rub-row"><input class="input" data-rn maxlength="80" placeholder="${esc(t('Criterion, like Focus'))}" aria-label="${esc(t('Criterion'))}" value="${esc(r.name || '')}" translate="no"><textarea class="input" data-rt rows="2" maxlength="500" placeholder="${esc(t('What it looks like when it is done well'))}" aria-label="${esc(t('What it looks like when it is done well'))}" translate="no">${esc(r.text || '')}</textarea><button type="button" class="icon-btn" data-action="in-rub-del" aria-label="${esc(t('Remove this criterion'))}" title="${esc(t('Remove'))}">${icon('trash', 14)}</button></li>`;
  function readSettings(form) {
    const S = { hints: form.hints.checked, notes: $('#in-notes', form).value, share: form.share ? form.share.checked : true, peer: form.peer ? form.peer.checked : false, peer_days: form.peer_days ? +form.peer_days.value : 4, projects: {} };
    $$('.in-proj', form).forEach(d => { S.projects[d.dataset.p] = { sheet: $('.in-sheet', d).value, rubric: $$('.in-rub-row', d).map(li => ({ name: $('[data-rn]', li).value, text: $('[data-rt]', li).value })).filter(r => r.name.trim() || r.text.trim()) }; });
    return S;
  }
  function paintProjSums(form) {
    $$('.in-proj', form).forEach(d => { const sheet = $('.in-sheet', d).value.trim(); const n = $$('.in-rub-row', d).filter(li => $('[data-rn]', li).value.trim() || $('[data-rt]', li).value.trim()).length;
      $('.in-proj-sum', d).textContent = [sheet ? t('assignment sheet') : '', n ? (n === 1 ? t('1 criterion') : t('{1} criteria', n)) : ''].filter(Boolean).join(' · ') || t('nothing added yet'); });
  }
  function bindSettings(root, I) {
    const form = $('#in-form', root); if (!form) return; let dirty = false;
    const notesN = () => { const n = $('#in-notes', form).value.length; $('#in-notes-n', form).textContent = n ? t('{1} of 1,500 characters', num(n)) : ''; };
    notesN(); paintProjSums(form);
    const mark = () => { dirty = true; $('#in-state', form).textContent = t('Not saved yet'); paintProjSums(form); keepDraft(readSettings(form)); };
    if (I.draft) { dirty = true; $('#in-state', form).textContent = t('Not saved yet: your changes from last time'); }
    form.addEventListener('input', e => { if (e.target.id === 'in-notes') notesN(); mark(); });
    form.addEventListener('change', mark);
    form.addEventListener('submit', async e => {
      e.preventDefault(); const btn = $('button[type="submit"]', form); btn.disabled = true; $('#in-state', form).textContent = t('Saving…');
      try { const j = await api('instruct_save', { class: cid(), settings: readSettings(form) }); I.settings = j.settings; I.draft = false; dirty = false; keepDraft(null); $('#in-state', form).textContent = t('Saved'); toast('Saved'); }
      catch (err) { $('#in-state', form).textContent = err.message; toast(err.message, 4000); }
      btn.disabled = false;
    });
    on(form, 'change', '.in-file', async el => {
      const f = el.files && el.files[0]; el.value = ''; if (!f) return; const ta = $('.in-sheet', el.closest('.in-proj'));
      try { const text = (await App.Office.fileText(f)).trim(); if (!text) throw new Error('That file has no text to read. Copy the text from it and paste it here.'); ta.value = text.slice(0, 8000); mark(); toast(t('Opened {1}', f.name)); }
      catch (err) { toast(err.message, 5000); }
    });
    bind(form, {
      'in-rub-add': el => { const ol = $('.in-rub', el.closest('.in-proj')); if (ol.children.length >= 12) { toast('Up to 12 criteria.'); return; } ol.insertAdjacentHTML('beforeend', rubRow()); $('.in-rub-row:last-child [data-rn]', ol).focus(); mark(); },
      'in-rub-del': el => { const li = el.closest('li'); const ol = li.parentNode; li.remove(); mark(); const b = $('[data-action="in-rub-add"]', ol.closest('.in-proj')); if (b) b.focus(); },
      'in-switch': async el => {
        const off = el.dataset.off === '1';
        if (off && !confirm('Turn off Bo’s draft feedback for the whole class? Students keep their past reviews.')) return;
        try {
          await api('ai_draft_switch', { class: cid(), off: off ? 1 : 0 }); I.drafts_off = off; toast(off ? 'Draft feedback is off for the class' : 'Draft feedback is on for the class');
          const chip = el.previousElementSibling; chip.className = 'chip ' + (off ? 'bad' : 'good'); chip.textContent = t(off ? 'Off' : 'On');
          el.dataset.off = off ? '0' : '1'; el.textContent = t(off ? 'Turn it on' : 'Turn it off'); el.focus();
        } catch (err) { toast(err.message, 4000); }
      }
    });
    S.dirty = () => dirty;
  }

  async function sharedHtml() {
    const j = await api('instruct_shares&class=' + q(cid())); const P = {}; ((App.D && App.D.DRAFTS) || []).forEach(p => { P[p.id] = p; });
    if (!j.shares.length) return `<div class="empty">No shared drafts yet. When a student shares a version of a draft with you, it shows here, with Bo’s feedback on it and their note.</div>`;
    return `<ul class="in-shares">${j.shares.map(s => `<li><a class="in-share${s.seen ? '' : ' new'}" href="${App.link('instructor', 'share/' + s.id)}">
        <span class="in-share-who"><b>${esc(s.student.name)}</b><small class="mono">${esc(s.student.email)}</small></span>
        <span class="in-share-what"><b>${esc((P[s.project] || {}).short || s.project)}</b> · ${esc(t(stageLabel(s.stage)))} · ${esc(t('version {1}', s.version))}<small>${esc(t('{1} words', num(s.words)))} · ${esc(t('shared {1}', dateOf(s.created)))}</small></span>
        ${s.note ? `<span class="in-share-note small" translate="no">${esc(s.note.length > 140 ? s.note.slice(0, 140) + '…' : s.note)}</span>` : '<span></span>'}
        <span class="in-share-tags">${s.seen ? '' : '<span class="chip accent">New</span>'}${s.replied ? `<span class="chip good">${esc(t('Replied'))}</span>` : ''}</span></a></li>`).join('')}</ul>`;
  }

  function patternsHtml(j) {
    if (!j.projects.length) return '<div class="empty">This class has no projects for draft feedback.</div>';
    const bar = (n, of) => { const p = of ? Math.round(100 * n / of) : 0; return `<span class="in-bar" aria-hidden="true"><i style="width:${p}%"></i></span><span class="in-bar-n">${esc(t('{1} of {2}', num(n), num(of)))}</span>`; };
    return `<p class="small muted">Only from students who chose to let their drafts count, with no names, quotes or drafts, and only once ${j.projects[0] ? j.projects[0].min : 5} students have. What Bo said, not a grade.</p>` + j.projects.map(p => {
      if (!p.enough) return `<section class="panel mt-2 in-pat"><h2 class="in-h">${esc(p.name)}</h2><p class="small muted">${esc(p.students === 1 ? t('1 student has let their drafts count so far. Patterns show once {1} have, so they never point at anyone.', p.min) : t('{1} students have let their drafts count so far. Patterns show once {2} have, so they never point at anyone.', p.students, p.min))}</p></section>`;
      const sinceAll = p.since.done + p.since.partly + p.since['not yet'];
      return `<section class="panel mt-2 in-pat"><h2 class="in-h">${esc(p.name)}</h2>
        <p class="small">${esc(t('{1} drafts from {2} students: {3} first drafts and {4} revised. Middle length {5} words.', num(p.drafts), num(p.students), num(p.first), num(p.revised), num(p.words)))}</p>
        <h3 class="in-h3">What Bo named among the biggest revisions</h3>
        <ul class="in-goalbars">${p.goals.map(g => `<li><span class="in-goal" translate="no">${esc(g.goal)}</span>${bar(g.drafts, p.drafts)}</li>`).join('')}${p.other ? `<li><span class="in-goal">${esc(t('Something outside the goals'))}</span>${bar(p.other, p.drafts)}</li>` : ''}</ul>
        ${sinceAll ? `<h3 class="in-h3">At the next version, Bo’s earlier revisions were</h3><p class="small">${esc(t('done {1} · partly done {2} · not yet {3}', num(p.since.done), num(p.since.partly), num(p.since['not yet'])))}</p>` : ''}
        ${p.answers.done + p.answers.disagree ? `<h3 class="in-h3">Students’ answers to Bo’s notes</h3><p class="small">${esc(t('marked done {1} · disagreed {2}', num(p.answers.done), num(p.answers.disagree)))}</p>` : ''}
      </section>`;
    }).join('');
  }

  function creditsHtml(j) {
    if (!j.classes.length) return `<div class="callout">${icon('info', 14)} <span>To give your students credits, add this class in <a href="#/teach">Mathub Faculty</a> and give them its join code. Students who join show here.</span></div>`;
    const n = j.students.length;
    return `<p class="small">${esc(n === 1 ? t('1 student has joined {1}.', j.classes.map(c => c.code + (c.section ? ' ' + c.section : '')).join(', ')) : t('{1} students have joined {2}.', n, j.classes.map(c => c.code + (c.section ? ' ' + c.section : '')).join(', ')))}</p>
      ${n ? `<details class="in-roster"><summary>${esc(t('See who'))}</summary><ul class="small">${j.students.map(s => `<li>${esc(s.name)} <span class="muted mono">${esc(s.email)}</span></li>`).join('')}</ul></details>
      <form class="in-give panel mt-2" id="in-give" novalidate>
        <div class="field"><label for="in-each">Credits for each student</label><input class="input" id="in-each" type="number" min="1" max="${j.max}" step="1" value="100" inputmode="numeric"></div>
        <p class="small" id="in-total" aria-live="polite"></p>
        <p class="small muted">${j.admin ? esc(t('As an administrator, you give these from Mathub.')) : esc(t('They come out of the credits you bought or were given (not the month’s free ones): you have {1}.', num(j.paid)))} ${esc(t('Students keep them, and they never expire.'))}</p>
        <button type="submit" class="btn primary">${icon('gem', 14)} Give credits</button></form>` : ''}
      ${j.given.length ? `<h2 class="in-h mt-3">Given so far</h2><ul class="small in-given">${j.given.map(g => `<li>${esc(dateOf(g.created))} · ${esc(g.note)}${g.credits ? ` · ${esc(t('{1} credits', num(g.credits)))}` : ''}</li>`).join('')}</ul>` : ''}`;
  }
  function bindCredits(root, j) {
    const form = $('#in-give', root); if (!form) return; const each = $('#in-each', form), total = $('#in-total', form);
    const paint = () => { const e = Math.max(0, Math.floor(+each.value || 0)); const n = j.students.length; total.textContent = n === 1 ? t('1 student × {1} credits = {2} credits in all.', num(e), num(e)) : t('{1} students × {2} credits = {3} credits in all.', num(n), num(e), num(e * n)); };
    paint(); each.addEventListener('input', paint);
    form.addEventListener('submit', async e => {
      e.preventDefault(); const c = Math.floor(+each.value || 0);
      if (c < 1 || c > j.max) { toast(t('Give each student between 1 and {1} credits.', num(j.max)), 4000); each.focus(); return; }
      if (!confirm(t('Give {1} credits to each of your {2} students ({3} in all)? This cannot be undone.', num(c), num(j.students.length), num(c * j.students.length)))) return;
      const b = $('button[type="submit"]', form); b.disabled = true;
      try { const r = await api('instruct_sponsor', { class: cid(), credits: c, expect: j.students.length }); toast(t('Gave {1} credits to each of {2} students', num(r.each), num(r.students)), 4000); App.views.instructor.render(root, null, { tab: 'credits' }); }
      catch (err) { b.disabled = false; toast(err.message, 5000); }
    });
  }

  async function renderPage(root, I, tab) {
    const tabs = [['settings', 'Settings', 'gear'], ['shared', I.unseen ? t('Shared with you ({1})', I.unseen) : 'Shared with you', 'file'], ['patterns', 'Patterns', 'chart'], ['credits', 'Credits', 'gem']].filter(x => x[0] !== 'shared' && x[0] !== 'patterns' || I.projects.length);
    if (tab && tabs.some(x => x[0] === tab)) App.setSetting && App.setSetting('instrTab', tab);
    root.innerHTML = HEAD() + `<div class="in-page">
      <div class="dash-tabs" data-store="instrTab" role="tablist">${tabs.map(([k, l, ic]) => `<button class="tab" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${esc(l)}</span></button>`).join('')}</div>
      <div class="in-panes">
        <div class="pane" data-pane="settings">${settingsHtml(I)}</div>
        ${I.projects.length ? `<div class="pane" data-pane="shared" id="in-shared"><div class="empty">${esc(t('Opening…'))}</div></div><div class="pane" data-pane="patterns" id="in-patterns"><div class="empty">${esc(t('Opening…'))}</div></div>` : ''}
        <div class="pane" data-pane="credits" id="in-credits"><div class="empty">${esc(t('Opening…'))}</div></div>
      </div></div>`;
    App.initTabs(root); bindSettings(root, I);
    const fill = async (sel, make) => { const box = $(sel, root); if (!box) return; try { box.innerHTML = await make(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; } };
    if (I.projects.length) { fill('#in-shared', sharedHtml); fill('#in-patterns', async () => patternsHtml(await api('instruct_patterns&class=' + q(cid())))); }
    try { const j = await api('instruct_roster&class=' + q(cid())); const box = $('#in-credits', root); if (box) { box.innerHTML = creditsHtml(j); bindCredits(root, j); } }
    catch (e) { const box = $('#in-credits', root); if (box) box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  /* one shared version: the draft with Bo's marks, his notes with the student's answers, their note, and a reply */
  async function shareView(root, id) {
    root.innerHTML = `<div class="in-sv"><a class="btn sm" href="${App.link('instructor')}">${icon('left', 13)} Instructor</a><div class="empty mt-3">${esc(t('Opening…'))}</div></div>`;
    let j; try { j = await api(`instruct_share_get&class=${q(cid())}&id=${q(id)}`); } catch (e) { $('.empty', root).textContent = e.message; return; }
    if (App.current !== App.views.instructor) return;
    const r = j.review, fb = r.feedback || {}, R = r.responses || {}; const p = ((App.D && App.D.DRAFTS) || []).find(x => x.id === r.project);
    const LET = 'ABCD'; const ans = k => { const x = R[k]; return x ? `<span class="df-st${x.s === 'done' ? ' st-done' : ''}">${esc(x.s === 'done' ? t('They marked it done') : t('They disagree'))}</span>${x.why ? `<span class="small" translate="no"> “${esc(x.why)}”</span>` : ''}` : ''; };
    const paper = App.draftPaper ? App.draftPaper(r.text, fb) : r.text.split(/\n\s*\n/).map(x => `<p>${esc(x.trim())}</p>`).join('');
    const others = j.shared.filter(x => x.id !== r.id);
    root.innerHTML = `<div class="in-sv">
      <a class="btn sm" href="${App.link('instructor')}">${icon('left', 13)} Instructor</a>
      <div class="eyebrow mt-2">${esc(p ? p.short : r.project)} · ${esc(t(stageLabel(r.stage)))} · ${esc(t('version {1}', r.version))}</div>
      <h1 class="page-title">${esc(j.student.name)}</h1>
      <p class="small muted"><span class="mono">${esc(j.student.email)}</span> · ${esc(t('{1} words', num(r.words)))} · ${esc(t('shared {1}', dateOf(j.share.created)))}</p>
      ${j.share.note ? `<div class="callout mt-2"><span><b>${esc(t('Their note'))}</b> <span translate="no">${esc(j.share.note)}</span></span></div>` : ''}
      <div class="df-cols mt-3">
        <div class="df-side df-side-top">
          <section class="df-card"><h2 class="df-h">Bo’s read</h2><p translate="no">${esc(fb.overall || '')}</p></section>
          <section class="df-card"><h2 class="df-h">The biggest revisions</h2><ol class="df-revs">${(fb.revisions || []).map((x, i) => `<li><span class="df-letter" aria-hidden="true">${LET[i]}</span><div><h3 translate="no">${esc(x.title)}</h3><p translate="no">${esc(x.why)}</p>${x.where ? `<p class="small" translate="no">“${esc(x.where)}”</p>` : ''}${ans('r' + i)}</div></li>`).join('')}</ol></section>
        </div>
        <div class="df-paper-wrap"><article class="panel df-paper" aria-label="${esc(t('Their draft'))}" translate="no" lang="en">${paper}</article></div>
        <div class="df-side df-side-rest">
          ${(fb.comments || []).length ? `<section class="df-card"><h2 class="df-h">In the margins</h2><ol class="df-notes">${fb.comments.map((c, i) => `<li class="k-${esc(c.kind)}"><span class="df-num" aria-hidden="true">${i + 1}</span><div><p class="df-q small" translate="no">“${esc(c.quote)}”</p><p translate="no">${esc(c.note)}</p>${ans('c' + (i + 1))}</div></li>`).join('')}</ol></section>` : ''}
          <section class="df-card in-reply"><h2 class="df-h">${icon('chat', 15)} Your reply</h2>
            <p class="small muted">${esc(t('{1} sees it on this version and in their inbox.', j.student.name))}</p>
            <textarea class="input" id="in-reply" rows="5" maxlength="3000" aria-label="${esc(t('Your reply'))}" translate="no">${esc(j.share.reply || '')}</textarea>
            <div class="row gap-sm mt-1"><button type="button" class="btn primary sm" data-action="in-reply">${icon('send', 13)} ${esc(j.share.reply ? t('Update the reply') : t('Send the reply'))}</button><span class="small muted" id="in-reply-state" role="status">${j.share.replied ? esc(t('Sent {1}', dateOf(j.share.replied))) : ''}</span></div></section>
          ${others.length ? `<section class="df-card"><h2 class="df-h">${esc(t('Other versions they shared'))}</h2><ul class="in-others">${others.map(o => `<li><a href="${App.link('instructor', 'share/' + o.id)}">${esc(t('Version {1}', o.version))} · ${esc(t(stageLabel(o.stage)))}</a> <span class="small muted">${esc(dateOf(o.created))}</span></li>`).join('')}</ul></section>` : ''}
        </div>
      </div></div>`;
    bind(root, { 'in-reply': async el => {
      const text = $('#in-reply', root).value.trim(); el.disabled = true;
      try { const k = await api('instruct_reply', { class: cid(), id: r.id, text }); $('#in-reply-state', root).textContent = k.replied ? t('Sent {1}', dateOf(k.replied)) : t('Reply removed'); toast(k.replied ? 'Reply sent' : 'Reply removed'); }
      catch (e) { toast(e.message, 4000); }
      el.disabled = false;
    } });
  }

  App.views.instructor = {
    title: 'Instructor',
    async render(root, param, query) {
      S.dirty = () => false;
      if (!user()) { root.innerHTML = HEAD() + `<div class="mt-3">${App.lockCard('For the class’s instructors', 'Sign in with the email address on your class’s syllabus.')}</div>`; if (App.auth) App.auth.bindLocks(root); return; }
      if (param && /^share\/\d+$/.test(param)) { shareView(root, param.split('/')[1]); return; }
      root.innerHTML = HEAD() + `<div class="empty mt-3">${esc(t('Opening…'))}</div>`;
      let I; try { I = await api('instruct_get&class=' + q(cid())); } catch (e) { if (e.status === 403) notStaff(root); else root.innerHTML = HEAD() + `<div class="empty mt-3">${esc(e.message)}</div>`; return; }
      if (App.current !== App.views.instructor) return;
      const d = loadDraft(); if (d && typeof d === 'object') { I.saved = I.settings; I.settings = Object.assign({}, I.settings, d); I.draft = true; }
      renderPage(root, I, query && query.tab);
    },
    unmount() { S.dirty = () => false; }
  };

  /* which classes this account teaches: the sidebar's Teaching › Instructor (assets/app.js buildNav) */
  let asked = null;
  async function whoTeaches() {
    const u = user(); const key = u ? String(u.email || u.id || '') : '';
    if (key === asked) return; asked = key;
    if (!u) { if (App.teaches) { App.teaches = null; if (App.rebuildNav) App.rebuildNav(); } return; }
    try { const j = await api('instruct_me'); if (asked !== key) return; App.teaches = { admin: !!j.admin, courses: j.courses || [] }; if (App.rebuildNav) App.rebuildNav(); }
    catch (e) { asked = null; }
  }
  global.addEventListener('mathub-auth', whoTeaches); setTimeout(whoTeaches, 0);

  /* ---------- #/instructors: for anyone ---------- */
  App.views.instructors = {
    title: 'For instructors',
    render(root) {
      const card = (ic, h, body) => `<section class="panel ins-card"><h2 class="ins-h">${icon(ic, 18)} ${h}</h2>${body}</section>`;
      root.innerHTML = App.pageHead('Mathub for instructors', 'A study site for your class, with Bo, an AI tutor that teaches instead of doing the work. Here is what he does, what you control, and what you see.') + `<div class="ins-grid">
        ${card('chat', 'What Bo does', `<ul><li>He finds out where a student is, explains one idea at a time, shows a worked example and then hands the next step to them.</li><li>He checks the math before he agrees with an answer, and says so kindly when it is wrong.</li><li>In a writing class he only comments on drafts: he marks passages, names the biggest revisions and asks questions. He never writes a sentence of a student’s paper, and the server drops a comment that would.</li></ul>`)}
        ${card('gear', 'What you control', `<p>Each class has an Instructor page for its instructors:</p><ul><li><b>Hints only:</b> Bo gives hints and checks steps, never final answers.</li><li><b>Notes for Bo:</b> what he should know about your class, like your citation style.</li><li><b>Draft feedback</b> on or off for the class, with each project’s assignment sheet and rubric for Bo to read against. He never grades.</li><li><b>Sharing</b> and <b>peer review swaps</b> on or off.</li></ul>`)}
        ${card('eye', 'What you see', `<ul><li>A draft only when a student chooses to share it with you, with Bo’s feedback on it, their answers to his notes and their note to you. You can reply.</li><li>Patterns across the class: which goals Bo names most often among the biggest revisions. Only from students who let their drafts count, only once five have, and never a name, a quote or a draft.</li><li>Never a student’s chats with Bo, their notebook, or anything they did not share.</li></ul>`)}
        ${card('gem', 'Credits for your students', `<p>Bo runs on credits, and every account gets some free each month. Add your class in Mathub Faculty and give students its code; then you can give each of them credits from your Instructor page, out of credits you bought. They never expire.</p>`)}
        ${card('shield', 'Privacy', `<p>Students’ drafts, chats and notebooks are private to them. Drafts are sent to Anthropic, which makes the AI behind Bo, to be read, and are not used to train it. Everything goes when a student deletes their account. The full <a href="#/policy">privacy policy</a> says exactly what is kept.</p>`)}
        ${card('flag', 'Getting started', `<ol><li>Sign up with your school email.</li><li>If your class is on Mathub and its syllabus lists your email, the Instructor page is in its sidebar.</li><li>If not, add it in Mathub Faculty: write the syllabus there and publish it as a class.</li></ol><div class="row gap-sm mt-2"><a class="btn primary" href="#/teach">${icon('book', 14)} Open Mathub Faculty</a><a class="btn" href="#/contact">${icon('chat', 14)} Ask us</a></div>`)}
      </div>`;
    }
  };
})(window);
