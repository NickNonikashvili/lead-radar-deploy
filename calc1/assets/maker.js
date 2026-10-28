/* ============================================================
   StudyCat — the class maker (#/maker): every class a student takes, their own way
   - #/maker: start a class from your syllabus (Bo reads it, api/ai.php ai_class step "outline", paid in credits,
     and fills in the maker), from scratch, or from Montana State's classes; the classes you have, each with Edit;
     and more ways in (a shared code, a class file, the AI you already use, the example class).
   - #/maker/new and #/maker/<id>: the editor. A class of your own (my####, assets/create.js) is edited whole:
     Basics, Schedule, Exams, Grading, Topics and Lessons (Bo writes a unit's lessons, cards and questions on
     request, step "unit"). Saving keeps it with the account (api/myclasses.php), so it can be changed any time.
     A class from StudyCat's catalog keeps its notes, practice and cards; the student changes what is only true for
     their section (nickname, colour, instructor, office hours, where and when it meets, exam dates and times, dates
     of their own, grading weights). That is saved with the account as classCustom[id] and applied in assets/app.js
     (applyVariant), so it reaches every page.
   - App.promptCustomize(ids): after picking classes (the class picker in assets/auth.js), an offer to make each one yours.
   - A new class in progress is kept in this browser (mh-maker-draft) until it is saved or thrown away.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const Courses = global.Courses; const Packs = global.MathubPacks;
  if (!App || !Packs) return;
  const { icon, esc, $, $$, toast, settings, setSetting } = App;
  const MK = () => App.classMake || {};
  const api = (route, body) => MK().api(route, body);
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const signIn = (state = 'login') => { if (App.auth && App.auth.open) App.auth.open(state); else location.hash = '#/settings'; };
  const lsGet = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const deep = o => JSON.parse(JSON.stringify(o));
  const mine = id => !!(App.packs && App.packs.local && App.packs.local.has(id));
  const NATIVE = !!(global.Native && global.MATHUB_APP && global.MATHUB_APP.native);   // the iOS and Android apps (on hold): classes are kept on the device too
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const DRAFT = 'mh-maker-draft';
  const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  const TYPES = [['lecture', 'Lecture'], ['lab', 'Lab'], ['review', 'Review'], ['exam', 'Exam'], ['admin', 'Due date'], ['holiday', 'No class']];
  const MY_TYPES = TYPES.filter(([k]) => k !== 'exam' && k !== 'holiday').concat([['holiday', 'No class']]);
  const SCALES = { plain: [['A', 90], ['B', 80], ['C', 70], ['D', 60], ['F', 0]], plus: [['A', 93], ['A-', 90], ['B+', 87], ['B', 83], ['B-', 80], ['C+', 77], ['C', 73], ['C-', 70], ['D+', 67], ['D', 60], ['F', 0]] };
  const LESSON = ['plain', 'ideas', 'examples', 'example', 'pitfalls', 'check', 'tip', 'figure'];
  const fmtDay = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return d; } };
  const clock = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`; };
  const lines = v => String(v || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  const plainOf = v => String(v == null ? '' : v).replace(/<[^>]+>/g, '');

  /* ---------- paths into the class: "COURSE.instructor", "EXAMS.2.date", "events.0.2" ---------- */
  const getP = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = String(p).split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

  /* ---------- a new class: blank, or what Bo read in a syllabus ---------- */
  function blank(code) {
    const M = MK(); const term = M.termGuess ? M.termGuess() : ''; const cols = M.COLORS || ['#1D4ED8'];
    return { format: 'mathub-class-pack', version: 1, id: '', code: code || '', name: '', short: '', term, color: { light: cols[Math.floor(Math.random() * cols.length)] },
      COURSE: { school: 'Montana State University', instructor: '', instructorEmail: '', officeHours: '', room: '', classDays: '', meet: { days: [], start: '', end: '' }, textbook: { title: '', url: '' }, deadlines: [] },
      SEMESTER: M.termDates ? M.termDates(term) : { start: '', end: '' }, GRADING: { categories: [], scale: SCALES.plain.map(([letter, min]) => ({ letter, min })) },
      EXAMS: [], CALENDAR: [], UNITS: [{ n: 1, title: 'Unit 1', sections: [] }], SECTIONS: [], FLASHCARDS: [] };
  }
  /* fills in what the editor reads, so every field has a place (a class from a file or an older class may lack some) */
  function shape(P) {
    P.COURSE = P.COURSE && typeof P.COURSE === 'object' ? P.COURSE : {};
    const C = P.COURSE; ['school', 'instructor', 'instructorEmail', 'officeHours', 'room', 'classDays'].forEach(k => { if (typeof C[k] !== 'string') C[k] = C[k] == null ? '' : String(C[k]); });
    if (!C.classDays && typeof C.lectures === 'string') C.classDays = C.lectures;
    C.meet = C.meet && typeof C.meet === 'object' ? C.meet : {}; C.meet.days = Array.isArray(C.meet.days) ? C.meet.days.map(Number) : []; C.meet.start = C.meet.start || ''; C.meet.end = C.meet.end || '';
    C.textbook = C.textbook && typeof C.textbook === 'object' ? C.textbook : { title: '', url: '' }; C.deadlines = Array.isArray(C.deadlines) ? C.deadlines : [];
    P.color = P.color && typeof P.color === 'object' ? P.color : { light: '#1D4ED8' };
    P.SEMESTER = P.SEMESTER && typeof P.SEMESTER === 'object' ? P.SEMESTER : { start: '', end: '' };
    P.GRADING = P.GRADING && typeof P.GRADING === 'object' ? P.GRADING : {}; P.GRADING.categories = Array.isArray(P.GRADING.categories) ? P.GRADING.categories : []; P.GRADING.scale = Array.isArray(P.GRADING.scale) ? P.GRADING.scale : [];
    ['EXAMS', 'CALENDAR', 'UNITS', 'SECTIONS', 'FLASHCARDS'].forEach(k => { if (!Array.isArray(P[k])) P[k] = []; });
    P.EXAMS.forEach(e => { if (!Array.isArray(e.units)) e.units = []; });
    P.SECTIONS.forEach(s => {
      if (!Array.isArray(s.examples)) s.examples = s.example && s.example.p ? [{ p: s.example.p, s: s.example.s || '' }] : [];
      ['ideas', 'pitfalls'].forEach(k => { if (!Array.isArray(s[k])) s[k] = s[k] ? [String(s[k])] : []; });
      if (!Array.isArray(s.check)) s.check = []; if (typeof s.plain !== 'string') s.plain = '';
    });
    if (!P.UNITS.length) P.UNITS.push({ n: 1, title: 'Unit 1', sections: [] });
    return P;
  }
  const meetText = m => { const d = DAYS.filter(([n]) => (m.days || []).includes(n)).map(x => x[1]); if (!d.length) return ''; const t = m.start ? ` ${clock(m.start)}${m.end ? '–' + clock(m.end) : ''}` : ''; return d.join(' · ') + t; };
  const hasLesson = s => !!(s && ((s.plain && s.plain.trim()) || (s.ideas || []).length || (s.examples || []).length));

  /* ============================================================
     The class open in the maker. kind: new (not saved yet), mine (a class of your own), catalog (StudyCat's class)
     ============================================================ */
  let S = null;
  const touch = () => { if (!S) return; S.dirty = true; if (S.kind === 'new') lsSet(DRAFT, { pack: S.obj, from: S.from, catalog: S.catalog || null, at: Date.now() }); paintBar(); };
  global.addEventListener('beforeunload', e => { if (S && S.dirty && S.kind !== 'new' && /^#\/maker\//.test(location.hash)) { e.preventDefault(); e.returnValue = ''; } });

  App.views.maker = {
    title: 'Class maker', blurb: 'Your classes, the way your section runs them.',
    render(root, param, query, standalone) {
      const wrap = inner => `<div class="${standalone ? 'landing-wrap ' : ''}mkr">${inner}</div>`;
      if (!param) return home(root, query, wrap);
      if (param === 'new') return open(root, 'new', query, wrap);
      if (mine(param) || Courses[param]) return open(root, param, query, wrap);
      root.innerHTML = wrap(`${App.pageHead('Class maker', '')}<div class="callout warn"><b>That class is not here.</b> It may have been deleted. <a href="#/maker">Back to the class maker</a></div>`);
    }
  };
  // the old ways in lead here now
  App.views.request = { title: 'Class maker', render() { location.replace('#/maker'); } };

  /* ============================================================
     #/maker: start a class, and the classes you have
     ============================================================ */
  function home(root, query, wrap) {
    S = S && S.dirty && S.kind !== 'new' ? S : null;
    const d = lsGet(DRAFT, null); const u = user();
    const size = settings().mkSize === 'short' ? 'short' : 'full';
    const ids = App.myCourses ? App.myCourses().filter(id => Courses[id]) : [];
    const own = (App.myClasses ? App.myClasses.list() : []).map(e => e.id).filter(id => Courses[id] && !ids.includes(id));
    const row = id => {
      const C = Courses[id]; const yours = mine(id); const K = App.classCustom ? App.classCustom(id) : null;
      const tile = String(C.code || '').replace(/^(\S+)\s+(.+)$/, '$1<br>$2');
      return `<li class="mkr-row" style="${App.classStyle ? App.classStyle(id) : ''}"><span class="mkr-tile" aria-hidden="true">${tile.includes('<br>') ? tile.split('<br>').map(esc).join('<br>') : esc(C.code || '')}</span>
        <div class="mkr-row-t"><b>${esc(C.short || C.code)}</b><span>${esc(C.name)}</span><span class="mkr-chips">${yours ? `<span class="chip">${icon('user', 11)} Your own class</span>` : `<span class="chip">${icon('cap', 11)} Montana State</span>`}${K ? `<span class="chip on">${icon('check', 11)} Made yours</span>` : ''}${!ids.includes(id) ? '<span class="chip">Not in your list</span>' : ''}</span></div>
        <div class="mkr-row-a"><a class="btn sm${yours || K ? '' : ' primary'}" href="#/maker/${esc(id)}">${icon(yours ? 'pen' : 'sliders', 13)} ${yours ? 'Edit' : K ? 'Change' : 'Make it yours'}</a><a class="btn sm ghost" href="#/${esc(id)}/dashboard">Open</a></div></li>`;
    };
    root.innerHTML = wrap(`${App.pageHead('Class maker', `Your classes, the way your section runs them. Start from your syllabus and Bo fills in the dates, exams, grading and topics, or start blank. Change anything, any time. Classes you make are saved ${esc(MK().where || 'with your account')}.`)}
      ${d && d.pack ? `<div class="callout mkr-resume"><div><b>${esc(d.pack.code || 'A new class')}${d.pack.name ? ' · ' + esc(d.pack.name) : ''}</b> is not saved yet.</div><div class="row gap-sm"><a class="btn sm primary" href="#/maker/new">Keep going</a><button type="button" class="btn sm ghost" data-mk="drop">Throw it away</button></div></div>` : ''}
      <section class="mkr-hero" id="mkr-bo" aria-labelledby="mkr-bo-h">
        <div class="mkr-hero-t"><span class="mkr-hero-av" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(64) : ''}</span><div><p class="mkr-kicker">${icon('maker', 13)} The fastest way</p><h2 id="mkr-bo-h">Start from your syllabus</h2><p>Drop in the PDF, a photo of it or its text. Bo reads the schedule, exams, grading and topics and fills in the class maker. You check every detail before it is saved.</p></div></div>
        <div class="mkr-hero-f">
          <label class="mk-drop" id="mk-drop"><input type="file" id="mk-bo-file" class="sr-only" accept=".pdf,application/pdf,image/*,.txt,text/plain"><span class="mk-drop-ic" aria-hidden="true">${icon('upload', 22)}</span><span class="mk-drop-t"><b>Drop your syllabus here</b><span>PDF, photo or text file · <u>choose a file</u></span></span></label>
          <div class="mk-drop-file" id="mk-bo-filechip" hidden><span class="mk-drop-ic" aria-hidden="true">${icon('file', 20)}</span><span class="mk-drop-t"><b id="mk-bo-fname"></b><span id="mk-bo-fsize"></span></span><button type="button" class="icon-btn" data-mk="unfile" aria-label="Remove the file">${icon('x', 16)}</button></div>
          <details class="mkr-paste"><summary>Or paste its text</summary><label class="sr-only" for="mk-bo-text">The syllabus text</label><textarea class="input" id="mk-bo-text" rows="5" placeholder="The schedule, topics, exams and grading"></textarea></details>
          <div class="mkr-go"><div class="mk-size" role="radiogroup" aria-label="How many topics?"><button type="button" role="radio" class="chip toggle${size === 'full' ? ' on' : ''}" aria-checked="${size === 'full'}" data-size="full">Every topic</button><button type="button" role="radio" class="chip toggle${size === 'short' ? ' on' : ''}" aria-checked="${size === 'short'}" data-size="short">Main topics only</button></div>
            <button type="button" class="btn primary lg" data-mk="read">${icon('wand', 17)} Read my syllabus</button></div>
          <p class="small muted mkr-credit" id="mkr-credit">${u ? 'Reading a syllabus is paid in credits, usually 20 to 40.' : 'Sign in to have Bo read it: your classes are saved with your account.'} The file is checked for malware and never kept. <a href="#/policy/privacy">Privacy</a></p>
          <div class="mk-prog" id="mk-bo-prog" hidden><div class="mk-prog-h"><span class="mk-prog-av" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(40) : ''}</span><div class="mk-prog-t" role="status"><b id="mk-prog-now"></b><span id="mk-prog-of"></span></div></div><div class="mk-prog-bar" aria-hidden="true"><i id="mk-prog-fill"></i></div></div>
          <div id="mk-bo-result" aria-live="polite"></div>
        </div>
      </section>
      <div class="mkr-starts">
        <a class="mkr-start" href="#/maker/new?blank=1${query.code ? '&code=' + encodeURIComponent(query.code) : ''}"><span class="mkr-start-ic" aria-hidden="true">${icon('pen', 20)}</span><span><b>Start blank${query.code ? ': ' + esc(query.code) : ''}</b><small>Type in the code, dates, exams, grading and topics yourself.</small></span></a>
        <button type="button" class="mkr-start" data-mk="pick"><span class="mkr-start-ic" aria-hidden="true">${icon('cap', 20)}</span><span><b>Montana State classes</b><small>Pick from StudyCat’s classes, with lessons and practice ready, then make each one yours.</small></span></button>
      </div>
      <section class="panel mkr-list-sec" aria-labelledby="mkr-list-h"><div class="panel-h"><h2 class="panel-title" id="mkr-list-h">${icon('grid')} Your classes</h2></div>
        ${ids.length || own.length ? `<ul class="mkr-list">${ids.concat(own).map(row).join('')}</ul>` : '<p class="small muted">No classes yet. Start one above.</p>'}</section>
      <details class="panel mkr-more"><summary><span class="panel-title">${icon('plus')} More ways to add a class</span><span class="mkr-chev" aria-hidden="true">${icon('chevron', 18)}</span></summary>
        <div class="mkr-ways">
          <div class="mk-way"><span class="mk-way-ic" aria-hidden="true">${icon('link', 18)}</span><div class="mk-way-t"><b>Open a shared class</b><span>The 8-character code from a classmate’s link.</span></div><form class="mk-way-act mk-code-form" id="mk-code-form"><label class="sr-only" for="mk-code">Share code</label><input class="input mono" id="mk-code" maxlength="40" placeholder="K7P2QX9M" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="btn" type="submit">Open</button></form></div>
          <div class="mk-way"><span class="mk-way-ic" aria-hidden="true">${icon('file', 18)}</span><div class="mk-way-t"><b>Import a class file</b><span>A .mathub.json file someone sent you, opened in the maker to check.</span></div><div class="mk-way-act"><label class="btn mk-file">${icon('upload', 15)} Choose a file<input type="file" id="mk-file" class="sr-only" accept=".json,application/json"></label></div></div>
          <div class="mk-way"><span class="mk-way-ic" aria-hidden="true">${icon('play', 18)}</span><div class="mk-way-t"><b>The example class</b><span>See a finished class, then change it as you like.</span></div><div class="mk-way-act"><button type="button" class="btn" data-mk="example">Open the example</button></div></div>
          <div class="mk-way mkr-diy"><span class="mk-way-ic" aria-hidden="true">${icon('copy', 18)}</span><div class="mk-way-t"><b>Use the AI you already use</b><span>Copy StudyCat’s instructions into any AI chat with your syllabus, then paste its whole answer here. StudyCat never sees your syllabus this way.</span>
            <div class="row gap-sm mt-1" style="flex-wrap:wrap"><button type="button" class="btn sm" data-mk="copy-prompt">${icon('copy', 13)} Copy the instructions</button></div>
            <label class="sr-only" for="mk-text">The AI's answer</label><textarea class="input mono mk-text mt-1" id="mk-text" rows="4" placeholder="Paste the AI’s answer here" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
            <div class="row gap-sm mt-1"><button type="button" class="btn sm primary" data-mk="check">${icon('check', 13)} Open it in the maker</button></div><div id="mk-result" aria-live="polite"></div></div></div>
        </div></details>`);
    wireHome(root);
  }

  function wireHome(root) {
    let file = null;
    const box = $('#mkr-bo', root), drop = $('#mk-drop', root), chip = $('#mk-bo-filechip', root), ta = $('#mk-bo-text', root);
    const setFile = (f, name) => { file = f; chip.hidden = !f; drop.hidden = !!f; if (f) { $('#mk-bo-fname', root).textContent = name; $('#mk-bo-fsize', root).textContent = `${f.type === 'application/pdf' ? 'PDF' : f.type === 'text/plain' ? 'Text file' : 'Photo'} · ${MK().fmtSize(f.data.length * 0.75)} · ready for Bo`; } };
    const take = async f => { if (!f) return; try { setFile(await MK().readFile(f), f.name); } catch (x) { toast(x.message, 4000); } };
    $('#mk-bo-file', root).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; take(f); });
    [drop, ta].forEach(z => {
      z.addEventListener('dragover', e => { if (![...(e.dataTransfer.types || [])].includes('Files')) return; e.preventDefault(); drop.classList.add('drag'); });
      z.addEventListener('dragleave', () => drop.classList.remove('drag'));
      z.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); drop.classList.remove('drag'); take(f); });
    });
    if (user()) api('ai_status').then(r => { const el = $('#mkr-credit', root); if (!el || !r || !r.credits || r.admin) return; const left = Math.floor(r.credits.left); el.insertAdjacentHTML('afterbegin', `<b>${left.toLocaleString('en-US')} credits left.</b> `); }).catch(() => {});
    const prog = $('#mk-bo-prog', root), res = $('#mk-bo-result', root);
    const STEPS = ['Checking the file', 'Reading your syllabus', 'Filling in the class maker'];
    const paint = (i, fail) => { prog.hidden = false; prog.classList.toggle('fail', !!fail); $('#mk-prog-now', root).textContent = fail ? 'Bo stopped' : STEPS[i] + '…'; $('#mk-prog-of', root).textContent = fail ? '' : `Step ${i + 1} of ${STEPS.length} · about a minute`; $('#mk-prog-fill', root).style.width = `${Math.round(((i + (fail ? 0 : 0.4)) / STEPS.length) * 100)}%`; };
    async function read(btn) {
      if (!user()) { toast('Sign in first: your classes are saved with your account.', 4000); signIn('login'); return; }
      const text = (ta.value || '').trim(); const size = settings().mkSize === 'short' ? 'short' : 'full';
      if (!text && !file) { toast('Drop in your syllabus or paste its text first.', 3500); return; }
      btn.disabled = true; res.innerHTML = ''; box.classList.add('busy'); paint(0);
      const t1 = setTimeout(() => paint(1), 5000);
      try {
        const r = await api('ai_class', { step: 'outline', size, syllabus: Object.assign({}, text ? { text } : {}, file ? { file } : {}) });
        clearTimeout(t1); paint(2);
        const { pack, notes } = MK().repair(deep(r.outline), 'my0000');
        if (r.checked && r.checked.school && !pack.COURSE.school) pack.COURSE.school = r.checked.school;
        lsSet(DRAFT, { pack: shape(pack), from: 'syllabus', notes, catalog: r.catalog || null, at: Date.now() });
        if (MK().plat) MK().plat.haptic('success');
        S = null; location.hash = '#/maker/new';
      } catch (x) {
        clearTimeout(t1); paint(0, true);
        const credits = x.data && x.data.credits;
        res.innerHTML = `<div class="callout warn mt-1"><b>${esc(x.message)}</b>${credits ? ' <a href="#/usage">Get credits</a>' : x.data && x.data.check === 'syllabus' ? ' <a href="#/maker/new?blank=1">Start a blank class</a>' : ''}</div>`;
      }
      btn.disabled = false; box.classList.remove('busy');
    }
    // a class from a file, the example or another AI's answer opens in the maker, to check before it is saved
    // returns '' when the class opened, or { msg, ask }: what went wrong, and the message to send the AI about it
    const openPack = (text, from) => {
      const M = MK(); const x = M.extract(text);
      if (x.error) return { msg: { empty: 'Paste the AI’s answer first.', none: 'No class in that text. Paste the AI’s whole answer, including the part that starts with {.', cut: 'The answer stops before the end: the AI ran out of room. Send it this message, or ask for “Main topics only”.', syntax: `The answer has a typo in it, so it cannot be read${x.near ? `, near “${x.near.slice(0, 60)}”` : ''}. Send the AI this message and paste its new answer.` }[x.error] || 'That could not be read.', ask: x.error === 'cut' ? M.cutPrompt() : x.error === 'syntax' ? `StudyCat could not read your JSON: ${x.message}${x.near ? ` (near: ${x.near})` : ''}. Send the complete corrected JSON again, in one \`\`\`json code block and nothing else.` : '' };
      const { pack, notes } = M.repair(x.data, 'my0000'); lsSet(DRAFT, { pack: shape(pack), from, notes, at: Date.now() }); S = null; location.hash = '#/maker/new'; return '';
    };
    const copy = async (text, msg) => { try { await MK().plat.copy(text); MK().plat.haptic('success'); toast(msg, 3500); } catch (x) { toast(x.message); } };
    root.addEventListener('click', async e => {
      const sz = e.target.closest('[data-size]'); if (sz) { setSetting('mkSize', sz.dataset.size); $$('[data-size]', root).forEach(x => { const on = x === sz; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
      const b = e.target.closest('[data-mk]'); if (!b) return; const k = b.dataset.mk;
      if (k === 'unfile') { setFile(null); $('#mk-bo-file', root).focus(); }
      else if (k === 'read') read(b);
      else if (k === 'drop') { if (confirm('Throw away the class you started? It was not saved.')) { lsSet(DRAFT, null); App.rerender(); } }
      else if (k === 'pick') { if (App.auth && App.auth.user && App.auth.onboard) App.auth.onboard(true); else signIn('signup'); }
      else if (k === 'example') { b.disabled = true; try { const r = openPack(await (await fetch('assets/app-sample-class.json')).text(), 'example'); if (r) toast(r.msg); } catch (x) { toast('The example could not be opened.'); } b.disabled = false; }
      else if (k === 'copy-prompt') copy(MK().prompt(settings().mkSize === 'short' ? 'short' : 'full'), 'Instructions copied. Paste them into your AI with your syllabus.');
      else if (k === 'copy-ask') copy(b.dataset.ask, 'Copied. Paste it into the same AI chat.');
      else if (k === 'check') { const r = openPack($('#mk-text', root).value, 'ai'); $('#mk-result', root).innerHTML = r ? `<div class="callout warn mt-1">${esc(r.msg)}${r.ask ? `<div class="mt-1"><button type="button" class="btn sm" data-mk="copy-ask" data-ask="${esc(r.ask)}">${icon('copy', 13)} Copy a message for your AI</button></div>` : ''}</div>` : ''; }
    });
    $('#mk-file', root).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 3e6) { toast('That file is too large to be a class.'); return; } const r = openPack(await f.text(), 'file'); if (r) toast(r.msg, 5000); });
    $('#mk-code-form', root).addEventListener('submit', e => { e.preventDefault(); const c = MK().codeOf($('#mk-code', root).value); if (!c) { toast('A share code has 8 letters and numbers, like K7P2QX9M.', 4000); return; } location.hash = '#/c/' + c; });
  }

  /* ============================================================
     The editor
     ============================================================ */
  async function open(root, id, query, wrap) {
    if (S && S.id === id && S.dirty && S.kind !== 'new') { S.kept = true; editor(root, query, wrap); S.kept = false; toast('Your changes are still here. Save them when you are done.', 3500); return; }
    if (id === 'new') {
      const d = lsGet(DRAFT, null);
      if (query.blank || !d || !d.pack) { const P = blank(query.code ? String(query.code).slice(0, 40) : ''); S = { id: 'new', kind: 'new', obj: P, from: 'blank', dirty: false }; lsSet(DRAFT, { pack: P, from: 'blank', at: Date.now() }); if (query.blank) history.replaceState(null, '', '#/maker/new'); }
      else S = { id: 'new', kind: 'new', obj: shape(d.pack), from: d.from || 'blank', notes: d.notes || [], catalog: d.catalog || null, dirty: true };
      return editor(root, query, wrap);
    }
    if (mine(id)) {
      root.innerHTML = wrap(`<p class="small muted">Opening your class…</p>`);
      try { const P = shape(await App.myClasses.read(id)); S = { id, kind: 'mine', obj: P, dirty: false }; } catch (x) { root.innerHTML = wrap(`<div class="callout warn"><b>${esc(x.message || 'This class could not be opened.')}</b></div>`); return; }
      return editor(root, query, wrap, true);
    }
    const C = Courses[id]; let late = false;
    if (!C.loaded) { root.innerHTML = wrap(`<p class="small muted">Opening ${esc(C.short || C.code)}…</p>`); try { await App.loadCourse(id); late = true; } catch (x) { root.innerHTML = wrap(`<div class="callout warn"><b>${esc(x.message)}</b></div>`); return; } }
    const K = deep((App.classCustom && App.classCustom(id)) || {});
    if (!Array.isArray(K.events)) K.events = []; K.exams = K.exams && typeof K.exams === 'object' ? K.exams : {}; K.weights = K.weights && typeof K.weights === 'object' ? K.weights : {};
    const sec = { section: App.courseSetting(id, 'section', ''), examTime: App.courseSetting(id, 'examTime', ''), labDay: App.courseSetting(id, 'labDay', '') };
    S = { id, kind: 'catalog', obj: K, sec, dirty: false };
    editor(root, query, wrap, late);
  }

  const TABS_MINE = [['basics', 'Basics', 'info'], ['schedule', 'Schedule', 'calendar'], ['exams', 'Exams', 'flag'], ['grading', 'Grading', 'reportcard'], ['topics', 'Topics', 'list'], ['lessons', 'Lessons', 'book']];
  const TABS_CAT = [['basics', 'Your section', 'user'], ['dates', 'Your dates', 'calendar'], ['exams', 'Exams', 'flag'], ['grading', 'Grading', 'reportcard']];

  /* late: drawn after the page's own render finished (a class read or loaded first), so its tabs are wired here */
  function editor(root, query, wrap, late) {
    const cat = S.kind === 'catalog'; const C = cat ? Courses[S.id] : null; const P = S.obj;
    const tabs = cat ? TABS_CAT : TABS_MINE;
    const title = cat ? `Make ${esc(C._own && C._own.short || C.short || C.code)} yours` : S.kind === 'new' ? 'A new class' : `Edit ${esc(P.short || P.code)}`;
    const sub = cat ? `Montana State’s ${esc(C.code)} keeps its lessons, practice and cards. What you change here is only for you: it follows you on every page and every device.` : S.kind === 'new' ? (S.from === 'syllabus' ? 'Bo filled this in from your syllabus. Check the dates, exams and grading against it, then save.' : S.from === 'blank' ? 'Fill in what your syllabus says. Only the code and the name are needed to save; add the rest any time.' : 'Check the class, change what you like, then save.') : 'Change anything, then save. It updates everywhere you use StudyCat.';
    const next = String(query.next || '').split(',').filter(id => Courses[id] && id !== S.id);
    S.next = next;
    root.innerHTML = wrap(`<div class="mkr-ed">
      <a class="mkr-back" href="#/maker">${icon('left', 14)} Class maker</a>
      <header class="mkr-ed-head"><span class="mkr-tile lg" id="mkr-tile" aria-hidden="true"></span><div class="mkr-ed-t"><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div></header>
      ${S.kind === 'new' && S.catalog ? `<div class="callout mkr-same">${icon('cap', 15)} <span><b>StudyCat has ${esc(S.catalog.code)} ${esc(S.catalog.name)}</b>, with its lessons and practice ready. You can use it and make it yours instead.</span> <a class="btn sm" href="#/maker/${esc(S.catalog.id)}" data-mk-same="${esc(S.catalog.id)}">Use StudyCat’s ${esc(S.catalog.code)}</a></div>` : ''}
      ${S.kind === 'new' && (S.notes || []).length ? `<details class="mkr-notes small"><summary>${S.notes.length} thing${S.notes.length === 1 ? '' : 's'} to check</summary><ul>${S.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
      <div class="dash-tabs mkr-tabs" data-store="${cat ? 'makerTabC' : 'makerTab'}" role="tablist">${tabs.map(([k, l, ic]) => `<button class="tab" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${l}</span></button>`).join('')}</div>
      <div class="panes">${tabs.map(([k]) => `<div class="pane" data-pane="${k}" role="tabpanel"></div>`).join('')}</div>
      <div class="mkr-bar" id="mkr-bar" role="region" aria-label="Save"></div>
    </div>`);
    // each class opens at its first tab, unless the link names one (a page left with unsaved changes keeps its tab)
    if (query.tab && tabs.some(t => t[0] === query.tab)) setSetting(cat ? 'makerTabC' : 'makerTab', query.tab); else if (!S.kept) setSetting(cat ? 'makerTabC' : 'makerTab', 'basics');
    paintAll(root); paintTile(root); paintBar();
    wireEditor(root);
    if (late && App.initTabs) App.initTabs(root);
  }

  function paintAll(root, only) {
    const cat = S.kind === 'catalog';
    const panes = cat ? { basics: catBasics, dates: catDates, exams: catExams, grading: catGrading } : { basics: basicsHtml, schedule: scheduleHtml, exams: examsHtml, grading: gradingHtml, topics: topicsHtml, lessons: lessonsHtml };
    Object.keys(panes).forEach(k => { if (only && !only.includes(k)) return; const el = $(`.pane[data-pane="${k}"]`, root); if (el) el.innerHTML = panes[k](); });
  }
  function paintTile(root) {
    const t = $('#mkr-tile', root || document); if (!t) return;
    if (S.kind === 'catalog') { const C = Courses[S.id]; t.setAttribute('style', App.classStyle ? App.classStyle(S.id) : ''); if (S.obj.color) t.style.setProperty('--cc', S.obj.color); t.textContent = S.obj.short || C.short || C.code; return; }
    t.style.setProperty('--cc', (S.obj.color && S.obj.color.light) || '#475569'); t.style.setProperty('--cc-ink', '#fff'); t.textContent = S.obj.short || S.obj.code || '?';
  }
  function paintBar() {
    const bar = $('#mkr-bar'); if (!bar || !S) return;
    const cat = S.kind === 'catalog'; const has = cat && (App.classCustom && App.classCustom(S.id));
    bar.classList.toggle('dirty', !!S.dirty);
    bar.innerHTML = `<span class="mkr-bar-t">${S.dirty ? `${icon('pen', 13)} ${S.kind === 'new' ? 'Not saved yet' : 'Unsaved changes'}` : `${icon('check', 13)} ${S.kind === 'new' ? 'Not saved yet' : 'Saved'}`}</span>
      <span class="mkr-bar-a">${cat && has ? '<button type="button" class="btn ghost sm" data-ed="reset">Undo all my changes</button>' : ''}${S.kind === 'mine' ? `<a class="btn sm ghost" href="#/${esc(S.id)}/dashboard">Open the class</a>` : ''}${S.kind === 'new' ? '<button type="button" class="btn ghost sm" data-ed="discard">Throw away</button>' : ''}
      ${S.next && S.next.length && !S.dirty && !(S.kind === 'new') ? `<a class="btn sm" href="#/maker/${esc(S.next[0])}?next=${esc(S.next.slice(1).join(','))}">Next: ${esc(Courses[S.next[0]].short || Courses[S.next[0]].code)} ${icon('right', 13)}</a>` : ''}
      <button type="button" class="btn primary" data-ed="save"${!S.dirty && S.kind !== 'new' ? ' disabled' : ''}>${icon('check', 15)} ${S.kind === 'new' ? 'Save the class' : 'Save'}</button></span><div class="mkr-bar-err" id="mkr-err" hidden></div>`;
  }

  /* ---------- form pieces: data-f is the path in the class (or in the student's changes) ---------- */
  const F = (label, body, help = '', cls = '') => `<label class="field mkr-f${cls ? ' ' + cls : ''}"><span>${label}</span>${body}${help ? `<small class="help">${help}</small>` : ''}</label>`;
  const I = (p, o = {}) => { const v = getP(S.obj, p); return `<input class="input${o.cls ? ' ' + o.cls : ''}" type="${o.type || 'text'}" data-f="${p}" value="${esc(v == null ? '' : v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.num ? ' inputmode="decimal"' : ''}${o.req ? ' required' : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>`; };
  const TA = (p, o = {}) => { const v = getP(S.obj, p); return `<textarea class="input" rows="${o.rows || 3}" data-f="${p}"${o.list ? ' data-lines="1"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>${esc(o.list ? (v || []).map(plainOf).join('\n') : v == null ? '' : v)}</textarea>`; };
  const SEL = (p, opts, o = {}) => { const v = String(getP(S.obj, p) == null ? '' : getP(S.obj, p)); return `<select class="select" data-f="${p}"${o.num ? ' data-num="1"' : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; };
  const DEL = (path, what) => `<button type="button" class="icon-btn mkr-del" data-del="${path}" aria-label="Remove ${esc(what)}">${icon('trash', 14)}</button>`;
  const ADD = (what, label) => `<button type="button" class="btn sm mkr-add" data-addrow="${what}">${icon('plus', 13)} ${label}</button>`;
  const MOVE = (path, i, n, what) => `<span class="mkr-move"><button type="button" class="icon-btn" data-move="${path}" data-i="${i}" data-d="-1" aria-label="Move ${esc(what)} up"${i === 0 ? ' disabled' : ''}>${icon('up', 13)}</button><button type="button" class="icon-btn" data-move="${path}" data-i="${i}" data-d="1" aria-label="Move ${esc(what)} down"${i === n - 1 ? ' disabled' : ''}>${icon('down', 13)}</button></span>`;
  const sec = (title, help, inner, ic) => `<section class="panel mkr-sec"><div class="panel-h"><h2 class="panel-title">${ic ? icon(ic) + ' ' : ''}${title}</h2></div>${help ? `<p class="small muted mkr-help">${help}</p>` : ''}${inner}</section>`;

  /* ---------- a class of your own ---------- */
  function basicsHtml() {
    const P = S.obj; const cols = MK().COLORS || [];
    return sec('The class', '', `<div class="mkr-grid">${F('Course code', I('code', { ph: 'CHMY 121', max: 40, req: true }), 'As on the syllabus.')}${F('Name', I('name', { ph: 'College Chemistry I', max: 160, req: true }))}${F('Short name', I('short', { ph: P.code || 'Chem I', max: 12 }), 'In the sidebar. 12 letters at most.')}${F('Term', I('term', { ph: 'Spring 2027', max: 40 }))}${F('School', I('COURSE.school', { max: 120 }), '', 'wide')}</div>
      <div class="mkr-f"><span class="mkr-lbl" id="mkr-col-l">Colour</span><div class="mkr-cols" role="radiogroup" aria-labelledby="mkr-col-l">${cols.map(c => `<button type="button" role="radio" class="mkr-col${(P.color && P.color.light || '').toUpperCase() === c ? ' on' : ''}" style="--c:${c}" data-col="${c}" aria-checked="${(P.color && P.color.light || '').toUpperCase() === c}" aria-label="${c}"></button>`).join('')}<label class="mkr-col-own" title="Another colour">${icon('plus', 13)}<input type="color" data-f="color.light" value="${esc((P.color && P.color.light) || '#1D4ED8')}" aria-label="Another colour"></label></div></div>`, 'info')
      + sec('Who teaches it', 'From the syllabus. It shows on the class’s syllabus page.', `<div class="mkr-grid">${F('Instructor', I('COURSE.instructor', { max: 120 }))}${F('Email', I('COURSE.instructorEmail', { type: 'email', max: 120 }))}${F('Office hours', I('COURSE.officeHours', { ph: 'Tue 2–3 pm, Gaines 110', max: 160 }), '', 'wide')}${F('Textbook', I('COURSE.textbook.title', { max: 160 }))}${F('Textbook link', I('COURSE.textbook.url', { type: 'url', ph: 'https://', max: 300 }))}</div>`, 'user')
      + (S.kind === 'mine' ? sec('Share, keep a copy or delete', 'A share link lets a classmate add their own copy. They never see who made it.', `<div class="row gap-sm" style="flex-wrap:wrap"><button type="button" class="btn" data-mkr="share">${icon('link', 14)} Share link</button><button type="button" class="btn" data-mkr="file">${icon(NATIVE ? 'external' : 'download', 14)} ${NATIVE ? 'Send the file' : 'Download the file'}</button><button type="button" class="btn danger" data-mkr="delete">${icon('trash', 14)} Delete the class</button></div>`, 'link') : '');
  }
  function scheduleHtml() {
    const P = S.obj; const m = P.COURSE.meet; const cal = P.CALENDAR; const lect = cal.filter(e => e[1] === 'lecture').length;
    const showLect = !!S.showLect;
    const rows = cal.map((e, i) => [e, i]).filter(([e]) => showLect || e[1] !== 'lecture');
    const secOpts = [['', 'No topic']].concat(P.SECTIONS.map(s => [s.id, `${s.label || ''} ${s.title}`.trim()]));
    return sec('When it meets', 'Tick the days and times, then put the lectures on the calendar. Holidays and exam days are skipped.', `<div class="mkr-grid">${F('First day of classes', I('SEMESTER.start', { type: 'date' }))}${F('Last day (with finals)', I('SEMESTER.end', { type: 'date' }))}</div>
        <div class="mkr-f"><span class="mkr-lbl">Days</span><div class="mkr-days">${DAYS.map(([n, l]) => `<label class="mkr-day"><input type="checkbox" data-day="${n}"${m.days.includes(n) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="mkr-grid">${F('Starts', I('COURSE.meet.start', { type: 'time' }))}${F('Ends', I('COURSE.meet.end', { type: 'time' }))}${F('Room', I('COURSE.room', { ph: 'Gaines 101', max: 80 }), '', 'wide')}</div>
        <div class="row gap-sm mt-1" style="flex-wrap:wrap"><button type="button" class="btn" data-ed="lectures">${icon('calendar', 14)} Put the lectures on the calendar</button><span class="small muted">${lect ? `${lect} lecture${lect === 1 ? '' : 's'} on the calendar now.` : 'No lectures on the calendar yet.'}</span></div>`, 'clock')
      + sec('Dates', 'Due dates, labs, reviews and days with no class. Exams have their own tab.', `${lect ? `<label class="check mkr-showl"><input type="checkbox" data-ed-toggle="showLect"${showLect ? ' checked' : ''}> <span>Show the ${lect} lectures too</span></label>` : ''}
        ${rows.length ? `<div class="mkr-table" role="table" aria-label="Dates"><div class="mkr-tr mkr-th" role="row"><span role="columnheader">Date</span><span role="columnheader">What</span><span role="columnheader">Title</span><span role="columnheader">Topic</span><span></span></div>${rows.map(([e, i]) => `<div class="mkr-tr" role="row"><span role="cell">${I(`CALENDAR.${i}.0`, { type: 'date', label: 'Date' })}</span><span role="cell">${SEL(`CALENDAR.${i}.1`, TYPES, { label: 'What' })}</span><span role="cell">${I(`CALENDAR.${i}.2`, { max: 120, label: 'Title', ph: 'Homework 3 due' })}</span><span role="cell">${SEL(`CALENDAR.${i}.3`, secOpts, { label: 'Topic' })}</span><span role="cell">${DEL(`CALENDAR.${i}`, 'this date')}</span></div>`).join('')}</div>` : '<p class="small muted">No dates yet.</p>'}
        <div class="row gap-sm mt-1">${ADD('date', 'Add a date')}</div>`, 'calendar')
      + sec('Standing due times', 'Rules that repeat, like “Homework is due Fridays at 11:59 pm”.', `${P.COURSE.deadlines.map((d, i) => `<div class="mkr-pair">${I(`COURSE.deadlines.${i}.name`, { ph: 'Homework', max: 80, label: 'What' })}${I(`COURSE.deadlines.${i}.rule`, { ph: 'Due Fridays at 11:59 pm', max: 200, label: 'When' })}${DEL(`COURSE.deadlines.${i}`, 'this rule')}</div>`).join('')}<div class="row gap-sm mt-1">${ADD('deadline', 'Add a rule')}</div>`, 'clock');
  }
  function examsHtml() {
    const P = S.obj;
    return sec('Exams', 'Each exam gets a countdown, a study plan and its own page. Tick the units it covers.', `${P.EXAMS.length ? P.EXAMS.map((e, i) => `<div class="mkr-card"><div class="mkr-grid">${F('Name', I(`EXAMS.${i}.name`, { ph: 'Exam 1', max: 60 }))}${F('Date', I(`EXAMS.${i}.date`, { type: 'date' }))}${F('Weight', I(`EXAMS.${i}.weight`, { type: 'number', num: true, ph: '%' }), 'Part of the grade, in %.')}${F('What it covers', I(`EXAMS.${i}.covers`, { ph: 'Units 1 and 2', max: 160 }), '', 'wide')}</div>
        ${P.UNITS.length ? `<div class="mkr-f"><span class="mkr-lbl">Units</span><div class="mkr-days">${P.UNITS.map(u => `<label class="mkr-day"><input type="checkbox" data-exunit="${i}" value="${u.n}"${(e.units || []).includes(u.n) ? ' checked' : ''}><span>${esc(String(u.n))}. ${esc(u.title)}</span></label>`).join('')}</div></div>` : ''}
        <div class="mkr-card-a">${DEL(`EXAMS.${i}`, e.name || 'this exam')}</div></div>`).join('') : '<p class="small muted">No exams yet.</p>'}<div class="row gap-sm mt-1">${ADD('exam', 'Add an exam')}</div>`, 'flag');
  }
  function gradingHtml() {
    const G = S.obj.GRADING; const sum = G.categories.reduce((n, c) => n + (Number(c.weight) || 0), 0);
    return sec('How the grade is made', 'The categories and their weights, from the syllabus.', `${G.categories.map((c, i) => `<div class="mkr-pair">${I(`GRADING.categories.${i}.name`, { ph: 'Homework', max: 80, label: 'Category' })}<span class="mkr-pct">${I(`GRADING.categories.${i}.weight`, { type: 'number', num: true, label: 'Weight in %' })}<i>%</i></span>${DEL(`GRADING.categories.${i}`, c.name || 'this category')}</div>`).join('')}
        <div class="row gap-sm mt-1" style="flex-wrap:wrap;align-items:center">${ADD('category', 'Add a category')}<span class="chip${Math.abs(sum - 100) < 0.01 ? ' good' : G.categories.length ? ' warn' : ''}" id="mkr-sum">${G.categories.length ? `Adds up to ${+sum.toFixed(1)}%` : 'No categories: one overall grade'}</span></div>`, 'reportcard')
      + sec('Letter grades', 'The lowest percent for each letter.', `<div class="mkr-scale">${G.scale.map((x, i) => `<div class="mkr-sc">${I(`GRADING.scale.${i}.letter`, { max: 3, label: 'Letter' })}<span class="mkr-pct">${I(`GRADING.scale.${i}.min`, { type: 'number', num: true, label: 'From %' })}<i>%</i></span>${DEL(`GRADING.scale.${i}`, x.letter || 'this letter')}</div>`).join('')}</div>
        <div class="row gap-sm mt-1" style="flex-wrap:wrap">${ADD('letter', 'Add a letter')}<button type="button" class="btn sm ghost" data-scale="plain">A 90, B 80, C 70, D 60</button><button type="button" class="btn sm ghost" data-scale="plus">With plus and minus</button></div>`, 'award');
  }
  function topicsHtml() {
    const P = S.obj; const exOpts = [['', 'No exam']].concat(P.EXAMS.map(e => [e.id || '', e.name || 'Exam'])).filter(([k], i) => i === 0 || k);
    return sec('Units and topics', 'Topics are what you study: each one gets a lesson, flashcards and practice. Group them in units, usually one unit per exam.', `${P.UNITS.map((u, ui) => { const secs = u.sections.map(id => P.SECTIONS.find(s => s.id === id)).filter(Boolean); return `<div class="mkr-unit"><div class="mkr-unit-h"><span class="mkr-unit-n">${u.n}</span>${I(`UNITS.${ui}.title`, { max: 80, label: `Unit ${u.n} title`, ph: `Unit ${u.n}` })}${SEL(`UNITS.${ui}.exam`, exOpts, { label: 'Exam at the end of this unit' })}${MOVE('UNITS', ui, P.UNITS.length, `unit ${u.n}`)}${DEL(`UNITS.${ui}`, `unit ${u.n}`)}</div>
        <ol class="mkr-topics">${secs.map((s, si) => { const i = P.SECTIONS.indexOf(s); return `<li class="mkr-topic"><div class="mkr-topic-r">${I(`SECTIONS.${i}.label`, { max: 8, label: 'Number', cls: 'mkr-lab', ph: `${u.n}.${si + 1}` })}${I(`SECTIONS.${i}.title`, { max: 100, label: 'Topic', ph: 'Atoms and isotopes' })}${MOVE(`UNITS.${ui}.sections`, si, secs.length, s.title || 'this topic')}${DEL(`topic.${s.id}`, s.title || 'this topic')}</div>${I(`SECTIONS.${i}.about`, { max: 240, label: 'What it covers', ph: 'What this topic covers, in a sentence (Bo writes its lesson from this)', cls: 'mkr-about' })}</li>`; }).join('')}</ol>
        <button type="button" class="btn sm ghost" data-addtopic="${ui}">${icon('plus', 13)} Add a topic</button></div>`; }).join('')}
      <div class="row gap-sm mt-1">${ADD('unit', 'Add a unit')}</div>`, 'list');
  }
  function lessonsHtml() {
    const P = S.obj; const cards = (P.FLASHCARDS || []).length; const qs = ((P.QUIZ && P.QUIZ.questions) || []).reduce((n, q) => n + ((q.items || []).length || 1), 0);
    if (!P.SECTIONS.length) return sec('Lessons', '', '<p class="small muted">Add the topics first (the Topics tab). Then Bo can write a lesson for each one, or you can write them.</p>', 'book');
    const done = P.SECTIONS.filter(hasLesson).length;
    return `<div class="callout mkr-bo-lessons"><span class="mkr-hero-av sm" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(40) : ''}</span><div><b>${done === P.SECTIONS.length ? 'Every topic has a lesson.' : `${done} of ${P.SECTIONS.length} topics have a lesson.`}</b> Bo writes a unit at a time: each topic’s idea in plain words, worked examples, common mistakes and a self-check, plus flashcards and practice questions. It is paid in credits, usually 20 to 40 a unit. ${cards || qs ? `<span class="small">Now: ${cards} flashcards, ${qs} practice questions.</span>` : ''}</div><button type="button" class="btn primary" data-ed="write-all"${done === P.SECTIONS.length ? '' : ''}>${icon('wand', 15)} ${done ? 'Write the missing lessons' : 'Write every lesson'}</button></div><div class="mk-prog" id="mkr-lprog" hidden><div class="mk-prog-h"><div class="mk-prog-t" role="status"><b id="mkr-lnow"></b><span id="mkr-lof"></span></div></div><div class="mk-prog-bar" aria-hidden="true"><i id="mkr-lfill"></i></div></div>`
      + P.UNITS.map(u => { const secs = u.sections.map(id => P.SECTIONS.find(s => s.id === id)).filter(Boolean); if (!secs.length) return ''; return `<section class="panel mkr-sec"><div class="panel-h"><h2 class="panel-title">${esc(String(u.n))}. ${esc(u.title)}</h2><button type="button" class="btn sm" data-write="${u.n}">${icon('wand', 13)} ${secs.every(hasLesson) ? 'Bo writes it again' : 'Bo writes this unit'}</button></div>
        ${secs.map(s => { const i = P.SECTIONS.indexOf(s); return `<details class="mkr-lesson"${S.openLesson === s.id ? ' open' : ''} data-lesson="${esc(s.id)}"><summary><span class="mkr-ls-dot${hasLesson(s) ? ' on' : ''}" aria-hidden="true"></span><b>${esc(s.label || '')} ${esc(s.title || 'Topic')}</b><span class="small muted">${hasLesson(s) ? 'Has a lesson' : 'No lesson yet'}</span></summary>
          <div class="mkr-ls-body">${F('The idea in plain words', TA(`SECTIONS.${i}.plain`, { rows: 3, ph: 'What this topic is about, as you would say it to a friend' }))}
          ${s.figure ? `<div class="mkr-f"><span class="mkr-lbl">Picture</span><div class="mkr-fig">${figHtml(s.figure)}</div><button type="button" class="btn sm ghost" data-delfig="${i}">${icon('trash', 13)} Remove the picture</button></div>` : ''}
          ${F('Key points', TA(`SECTIONS.${i}.ideas`, { rows: 4, list: true, ph: 'One point per line' }), 'One per line. Math goes between $ signs, like $x^2$.')}
          <div class="mkr-f"><span class="mkr-lbl">Worked examples</span>${s.examples.map((x, k) => `<div class="mkr-ex">${TA(`SECTIONS.${i}.examples.${k}.p`, { rows: 2, ph: 'A problem', label: 'Problem' })}${TA(`SECTIONS.${i}.examples.${k}.s`, { rows: 3, ph: 'Its solution, step by step', label: 'Solution' })}${DEL(`SECTIONS.${i}.examples.${k}`, 'this example')}</div>`).join('')}<button type="button" class="btn sm ghost" data-addex="${i}">${icon('plus', 13)} Add an example</button></div>
          ${F('Common mistakes', TA(`SECTIONS.${i}.pitfalls`, { rows: 3, list: true, ph: 'One mistake per line' }))}
          <div class="mkr-f"><span class="mkr-lbl">Check yourself</span>${s.check.map((x, k) => `<div class="mkr-pair">${I(`SECTIONS.${i}.check.${k}.q`, { ph: 'A quick question', max: 300, label: 'Question' })}${I(`SECTIONS.${i}.check.${k}.a`, { ph: 'Its answer', max: 300, label: 'Answer' })}${DEL(`SECTIONS.${i}.check.${k}`, 'this question')}</div>`).join('')}<button type="button" class="btn sm ghost" data-addcheck="${i}">${icon('plus', 13)} Add a question</button></div></div></details>`; }).join('')}</section>`; }).join('');
  }

  // a lesson's picture is a drawing spec (Bo writes them), drawn the way his board draws it
  const figHtml = f => { try { const sp = App.boDraw && App.boDraw.parse(f); return sp ? App.boDraw.html(sp, false) : ''; } catch (e) { return ''; } };

  /* ---------- StudyCat's class, made yours ---------- */
  function catBasics() {
    const C = Courses[S.id]; const own = C._own && C._own.course || C.COURSE || {}; const K = S.obj;
    const hasLab = (C.RECURRING || []).some(r => r.afterLabDay);
    const cols = MK().COLORS || [];
    return sec('Your section', 'What is true for your section. Leave a box empty to keep what StudyCat has.', `<div class="mkr-grid">${F('Section number', `<input class="input" data-sec="section" maxlength="20" placeholder="e.g. 002" value="${esc(S.sec.section)}">`)}${F('Your lecture or exam time', `<input class="input" data-sec="examTime" maxlength="60" placeholder="e.g. MWF 9:00 am" value="${esc(S.sec.examTime)}">`)}${hasLab ? F('Lab day', `<select class="select" data-sec="labDay"><option value="tue"${S.sec.labDay !== 'thu' ? ' selected' : ''}>Tuesday</option><option value="thu"${S.sec.labDay === 'thu' ? ' selected' : ''}>Thursday</option></select>`) : ''}
        ${F('Nickname', I('short', { max: 12, ph: (C._own && C._own.short) || C.short }), 'In the sidebar and the class switcher.')}${F('Instructor', I('instructor', { max: 120, ph: own.instructor || '' }))}${F('Email', I('instructorEmail', { type: 'email', max: 120, ph: own.instructorEmail || '' }))}${F('Office hours', I('officeHours', { max: 160, ph: own.officeHours || 'Tue 2–3 pm, Wilson 2-240' }), '', 'wide')}${F('When it meets', I('classDays', { max: 120, ph: own.classDays || 'Mon · Wed · Fri 9:00–9:50 am' }))}${F('Room', I('room', { max: 80, ph: own.room || 'Wilson 1-122' }))}</div>
      <div class="mkr-f"><span class="mkr-lbl" id="mkr-col-l">Colour</span><div class="mkr-cols" role="radiogroup" aria-labelledby="mkr-col-l"><button type="button" role="radio" class="mkr-col mkr-col-auto${!K.color ? ' on' : ''}" data-col="" aria-checked="${!K.color}" aria-label="StudyCat’s colour">${icon('rotate', 12)}</button>${cols.map(c => `<button type="button" role="radio" class="mkr-col${(K.color || '').toUpperCase() === c ? ' on' : ''}" style="--c:${c}" data-col="${c}" aria-checked="${(K.color || '').toUpperCase() === c}" aria-label="${c}"></button>`).join('')}</div></div>`, 'user');
  }
  function catDates() {
    const K = S.obj;
    return sec('Your own dates', 'Due dates, quizzes, labs or days off that are only in your section. They join the class calendar, Today and your reminders. The class’s own dates stay.', `${K.events.length ? `<div class="mkr-table" role="table" aria-label="Your dates"><div class="mkr-tr mkr-th c3" role="row"><span role="columnheader">Date</span><span role="columnheader">What</span><span role="columnheader">Title</span><span></span></div>${K.events.map((e, i) => `<div class="mkr-tr c3" role="row"><span role="cell">${I(`events.${i}.0`, { type: 'date', label: 'Date' })}</span><span role="cell">${SEL(`events.${i}.1`, MY_TYPES, { label: 'What' })}</span><span role="cell">${I(`events.${i}.2`, { max: 120, label: 'Title', ph: 'Quiz 2' })}</span><span role="cell">${DEL(`events.${i}`, 'this date')}</span></div>`).join('')}</div>` : '<p class="small muted">None yet.</p>'}<div class="row gap-sm mt-1">${ADD('event', 'Add a date')}</div>`, 'calendar');
  }
  function catExams() {
    const C = Courses[S.id]; const K = S.obj; const ex = (C.EXAMS || []).filter(e => e.id);
    return sec('Exams in your section', 'Your section’s date, time and room. Leave a box empty to keep StudyCat’s.', ex.length ? ex.map(e => { const o = (e._own) || e; const mineE = K.exams[e.id] || {}; return `<div class="mkr-card"><div class="mkr-card-h"><b>${esc(o.name || e.name)}</b><span class="small muted">StudyCat: ${esc(o.dateLabel || fmtDay(o.date || e.date))}</span></div><div class="mkr-grid">${F('Name', `<input class="input" data-exk="${esc(e.id)}" data-exf="name" maxlength="60" placeholder="${esc(o.name || '')}" value="${esc(mineE.name || '')}">`)}${F('Date', `<input class="input" type="date" data-exk="${esc(e.id)}" data-exf="date" value="${esc(mineE.date || '')}">`)}${F('Time and room', `<input class="input" data-exk="${esc(e.id)}" data-exf="time" maxlength="80" placeholder="6:00 pm, Wilson 1-122" value="${esc(mineE.time || '')}">`)}</div></div>`; }).join('') : '<p class="small muted">This class has no exams.</p>', 'flag');
  }
  function catGrading() {
    const C = Courses[S.id]; const K = S.obj; const cats = (C.GRADING && C.GRADING.categories) || [];
    if (!cats.length) return sec('Grading', '', '<p class="small muted">This class has no grading categories.</p>', 'reportcard');
    const sum = cats.reduce((n, c) => n + (K.weights[c.id] !== undefined && K.weights[c.id] !== '' ? Number(K.weights[c.id]) || 0 : Number(c._own !== undefined ? c._own : c.weight) || 0), 0);
    return sec('Grading weights in your section', 'If your instructor weighs things differently, set your weights. Leave a box empty to keep StudyCat’s.', `${cats.map(c => `<div class="mkr-pair"><span class="mkr-cat">${esc(c.name)}</span><span class="mkr-pct"><input class="input" type="number" inputmode="decimal" data-w="${esc(c.id)}" placeholder="${esc(String(c._own !== undefined ? c._own : c.weight))}" value="${esc(K.weights[c.id] === undefined ? '' : String(K.weights[c.id]))}" aria-label="${esc(c.name)} weight in %"><i>%</i></span></div>`).join('')}<p class="mt-1"><span class="chip${Math.abs(sum - 100) < 0.01 ? ' good' : ' warn'}" id="mkr-sum">Adds up to ${+sum.toFixed(1)}%</span></p>`, 'reportcard');
  }

  /* ---------- editing ---------- */
  function wireEditor(root) {
    const ed = $('.mkr-ed', root);
    const set = (p, v) => { setP(S.obj, p, v); touch(); };
    ed.addEventListener('input', e => {
      const x = e.target;
      if (x.dataset.f) {
        let v = x.value; if (x.dataset.lines) v = lines(v); else if (x.type === 'number' || x.dataset.num) v = v === '' ? '' : Number(v);
        if (x.tagName === 'SELECT' && x.dataset.f.endsWith('.exam') && v === '') v = undefined;
        set(x.dataset.f, v);
        if (/^(code|short|color\.light)$/.test(x.dataset.f)) paintTile(root);
        if (/^COURSE\.meet\./.test(x.dataset.f)) S.obj.COURSE.classDays = meetText(S.obj.COURSE.meet);
        if (/^GRADING\.categories\.\d+\.weight$/.test(x.dataset.f)) paintSum(root);
        if (x.dataset.f === 'color.light') $$('.mkr-col', root).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
        return;
      }
      if (x.dataset.sec) { S.sec[x.dataset.sec] = x.value.trim(); touch(); return; }
      if (x.dataset.exk) { const o = S.obj.exams[x.dataset.exk] = Object.assign({}, S.obj.exams[x.dataset.exk]); const v = x.value.trim(); if (v) o[x.dataset.exf] = v; else delete o[x.dataset.exf]; if (!Object.keys(o).length) delete S.obj.exams[x.dataset.exk]; touch(); return; }
      if (x.dataset.w) { const v = x.value.trim(); if (v === '') delete S.obj.weights[x.dataset.w]; else S.obj.weights[x.dataset.w] = Number(v); touch(); paintSum(root); return; }
    });
    ed.addEventListener('change', e => {
      const x = e.target;
      if (x.tagName === 'SELECT' && x.dataset.f) { let v = x.value; if (x.dataset.f.endsWith('.exam') && v === '') v = undefined; if (/^CALENDAR\.\d+\.3$/.test(x.dataset.f) && v === '') { const i = +x.dataset.f.split('.')[1]; S.obj.CALENDAR[i].length = 3; touch(); return; } set(x.dataset.f, v); return; }
      if (x.dataset.sec) { S.sec[x.dataset.sec] = x.value; touch(); return; }
      if (x.dataset.day !== undefined) { const m = S.obj.COURSE.meet; const n = +x.dataset.day; m.days = x.checked ? m.days.concat(n).filter((v, i, a) => a.indexOf(v) === i) : m.days.filter(d => d !== n); S.obj.COURSE.classDays = meetText(m); touch(); return; }
      if (x.dataset.exunit !== undefined) { const ex = S.obj.EXAMS[+x.dataset.exunit]; const n = +x.value; ex.units = x.checked ? (ex.units || []).concat(n).sort((a, b) => a - b) : (ex.units || []).filter(v => v !== n); touch(); return; }
      if (x.dataset.edToggle) { S[x.dataset.edToggle] = x.checked; paintAll(root, ['schedule']); return; }
    });
    ed.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.lesson && d.open) S.openLesson = d.dataset.lesson; }, true);
    ed.addEventListener('click', async e => {
      const b = e.target.closest('button, a'); if (!b) return;
      const P = S.obj; const cat = S.kind === 'catalog';
      if (b.dataset.mkSame !== undefined) { S = null; return; }   // the class in progress stays: Keep going brings it back
      if (b.dataset.col !== undefined) { if (cat) { if (b.dataset.col) S.obj.color = b.dataset.col; else delete S.obj.color; } else P.color = Object.assign({}, P.color, { light: b.dataset.col }); $$('.mkr-col', root).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); paintTile(root); touch(); return; }
      if (b.dataset.del) { removeAt(b.dataset.del); touch(); repaint(root); return; }
      if (b.dataset.move) { const list = getP(P, b.dataset.move); const i = +b.dataset.i, j = i + +b.dataset.d; if (!Array.isArray(list) || j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; if (b.dataset.move === 'UNITS') renumber(P); touch(); repaint(root); return; }
      if (b.dataset.addrow) { addRow(b.dataset.addrow); touch(); repaint(root); focusLast(root, b.dataset.addrow); return; }
      if (b.dataset.addtopic !== undefined) { addTopic(+b.dataset.addtopic); touch(); repaint(root); return; }
      if (b.dataset.delfig !== undefined) { const s2 = P.SECTIONS[+b.dataset.delfig]; delete s2.figure; S.openLesson = s2.id; touch(); repaint(root); return; }
      if (b.dataset.addex !== undefined) { const s = P.SECTIONS[+b.dataset.addex]; s.examples.push({ p: '', s: '' }); S.openLesson = s.id; touch(); repaint(root); return; }
      if (b.dataset.addcheck !== undefined) { const s = P.SECTIONS[+b.dataset.addcheck]; s.check.push({ q: '', a: '' }); S.openLesson = s.id; touch(); repaint(root); return; }
      if (b.dataset.scale) { if (P.GRADING.scale.length > 1 && !confirm('Replace the letter grades with these?')) return; P.GRADING.scale = SCALES[b.dataset.scale].map(([letter, min]) => ({ letter, min })); touch(); repaint(root); return; }
      if (b.dataset.write) { await writeUnits(root, [+b.dataset.write]); return; }
      if (b.dataset.mkr) { classActions(root, b); return; }
      const k = b.dataset.ed; if (!k) return;
      if (k === 'save') save(root, b);
      else if (k === 'discard') { if (confirm('Throw away this class? It was not saved.')) { lsSet(DRAFT, null); S = null; location.hash = '#/maker'; } }
      else if (k === 'reset') { if (!confirm(`Undo all your changes to ${Courses[S.id].code}? It goes back to StudyCat’s dates, details and weights.`)) return; S.obj = { events: [], exams: {}, weights: {} }; await saveCatalog(root, true); }
      else if (k === 'lectures') { fillLectures(); repaint(root); }
      else if (k === 'write-all') { const P2 = S.obj; const todo = P2.UNITS.filter(u => u.sections.some(id => !hasLesson(P2.SECTIONS.find(s => s.id === id)))).map(u => u.n); await writeUnits(root, todo.length ? todo : P2.UNITS.map(u => u.n)); }
    });
  }
  const repaint = root => { const y = global.scrollY; paintAll(root); paintBar(); global.scrollTo(0, y); };
  const paintSum = root => { const el = $('#mkr-sum', root); if (!el) return; if (S.kind === 'catalog') { const C = Courses[S.id]; const sum = (C.GRADING.categories || []).reduce((n, c) => n + (S.obj.weights[c.id] !== undefined ? Number(S.obj.weights[c.id]) || 0 : Number(c._own !== undefined ? c._own : c.weight) || 0), 0); el.textContent = `Adds up to ${+sum.toFixed(1)}%`; el.className = `chip${Math.abs(sum - 100) < 0.01 ? ' good' : ' warn'}`; return; } const G = S.obj.GRADING; const sum = G.categories.reduce((n, c) => n + (Number(c.weight) || 0), 0); el.textContent = `Adds up to ${+sum.toFixed(1)}%`; el.className = `chip${Math.abs(sum - 100) < 0.01 ? ' good' : ' warn'}`; };
  const focusLast = (root, what) => { const pane = { date: 'schedule', deadline: 'schedule', exam: 'exams', category: 'grading', letter: 'grading', unit: 'topics', event: 'dates' }[what]; const el = pane && $$(`.pane[data-pane="${pane}"] input:not([type=checkbox])`, root); if (el && el.length) { const inp = what === 'date' || what === 'event' ? el[el.length - 3] || el[el.length - 1] : el[el.length - 1]; if (what === 'unit') { const u = $$(`.pane[data-pane="topics"] .mkr-unit`, root).pop(); const t = u && $('input', u); if (t) t.focus(); return; } if (inp) inp.focus(); } };
  const uniq = (base, used) => { let id = base, n = 2; while (used.has(id)) id = `${base}-${n++}`; return id; };
  function renumber(P) {
    const map = {}; P.UNITS.forEach((u, i) => { map[u.n] = i + 1; u.n = i + 1; });
    P.SECTIONS.forEach(s => { if (map[s.unit]) s.unit = map[s.unit]; });
    P.EXAMS.forEach(e => { e.units = (e.units || []).map(n => map[n]).filter(Boolean); });
  }
  function addRow(what) {
    const P = S.obj;
    if (what === 'event') { S.obj.events.push([new Date().toISOString().slice(0, 10), 'admin', '']); return; }
    if (what === 'date') { P.CALENDAR.push([P.SEMESTER.start && P.SEMESTER.start > new Date().toISOString().slice(0, 10) ? P.SEMESTER.start : new Date().toISOString().slice(0, 10), 'admin', '']); return; }
    if (what === 'deadline') { P.COURSE.deadlines.push({ name: '', rule: '' }); return; }
    if (what === 'exam') { const used = new Set(P.EXAMS.map(e => e.id)); const n = P.EXAMS.length + 1; P.EXAMS.push({ id: uniq(`exam${n}`, used), name: n === 1 ? 'Exam 1' : `Exam ${n}`, date: '', covers: '', units: [] }); return; }
    if (what === 'category') { const used = new Set(P.GRADING.categories.map(c => c.id)); P.GRADING.categories.push({ id: uniq(`cat${P.GRADING.categories.length + 1}`, used), name: '', weight: '' }); return; }
    if (what === 'letter') { P.GRADING.scale.push({ letter: '', min: '' }); return; }
    if (what === 'unit') { const n = P.UNITS.length + 1; P.UNITS.push({ n, title: `Unit ${n}`, sections: [] }); return; }
  }
  function addTopic(ui) {
    const P = S.obj; const u = P.UNITS[ui]; if (!u) return;
    const used = new Set(P.SECTIONS.map(s => s.id)); const id = uniq(`topic-${u.n}-${u.sections.length + 1}`, used);
    P.SECTIONS.push({ id, label: `${u.n}.${u.sections.length + 1}`, title: '', unit: u.n, about: '', plain: '', ideas: [], examples: [], pitfalls: [], check: [] }); u.sections.push(id);
  }
  function removeAt(path) {
    const P = S.obj;
    if (path.startsWith('topic.')) { const id = path.slice(6); const s = P.SECTIONS.find(x => x.id === id); if (s && hasLesson(s) && !confirm(`Remove “${s.title}” and its lesson?`)) return; P.SECTIONS = P.SECTIONS.filter(x => x.id !== id); P.UNITS.forEach(u => { u.sections = u.sections.filter(x => x !== id); }); P.CALENDAR.forEach(e => { if (e[3] === id) e.length = 3; }); P.FLASHCARDS = (P.FLASHCARDS || []).filter(c => c.sec !== id); if (P.QUIZ && P.QUIZ.topics) { delete P.QUIZ.topics[id]; P.QUIZ.questions = (P.QUIZ.questions || []).filter(q => q.topic !== id); } return; }
    const ks = path.split('.'); const i = +ks.pop(); const list = getP(P, ks.join('.')); if (!Array.isArray(list)) return;
    if (ks.join('.') === 'UNITS') { const u = list[i]; if (P.UNITS.length === 1) { toast('A class needs at least one unit.'); return; } if (u.sections.length && !confirm(`Remove unit ${u.n} and its ${u.sections.length} topic${u.sections.length === 1 ? '' : 's'}?`)) return; P.SECTIONS = P.SECTIONS.filter(s => !u.sections.includes(s.id)); list.splice(i, 1); renumber(P); return; }
    if (ks.join('.') === 'EXAMS') { const ex = list[i]; P.UNITS.forEach(u => { if (u.exam === ex.id) delete u.exam; }); }
    list.splice(i, 1);
  }
  /* the lectures on the meeting days between the first and last day, skipping days with no class and exam days; each
     gets the next topic, in order, spread evenly over the term */
  function fillLectures() {
    const P = S.obj; const m = P.COURSE.meet; const days = m.days || [];
    if (!days.length) { toast('Tick the days the class meets first.', 3500); return; }
    const a = P.SEMESTER.start, z = P.SEMESTER.end; if (!ISO.test(a || '') || !ISO.test(z || '') || a > z) { toast('Set the first and last day of classes first.', 3500); return; }
    const old = P.CALENDAR.filter(e => e[1] === 'lecture').length;
    if (old && !confirm(`Replace the ${old} lectures on the calendar with new ones?`)) return;
    const off = new Set(P.CALENDAR.filter(e => e[1] === 'holiday').map(e => e[0]).concat(P.EXAMS.map(e => e.date)));
    const dates = []; const d = new Date(a + 'T12:00:00Z'); const end = new Date(z + 'T12:00:00Z');
    while (d <= end && dates.length < 400) { const iso = d.toISOString().slice(0, 10); if (days.includes(d.getUTCDay()) && !off.has(iso)) dates.push(iso); d.setUTCDate(d.getUTCDate() + 1); }
    const secs = P.UNITS.flatMap(u => u.sections).map(id => P.SECTIONS.find(s => s.id === id)).filter(Boolean);
    const rows = dates.map((iso, k) => { const s = secs.length ? secs[Math.min(secs.length - 1, Math.floor(k * secs.length / dates.length))] : null; return s ? [iso, 'lecture', s.title || 'Lecture', s.id] : [iso, 'lecture', 'Lecture']; });
    P.CALENDAR = P.CALENDAR.filter(e => e[1] !== 'lecture').concat(rows).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    P.COURSE.classDays = meetText(m); touch(); toast(`${rows.length} lectures are on the calendar.`, 3000);
  }

  /* ---------- Bo writes lessons, a unit at a time (api/ai.php ai_class step "unit", with the class as it is now) ---------- */
  function mergeUnit(P, n, data) {
    const u = P.UNITS.find(x => x.n === n); const secs = new Set(u ? u.sections : []);
    (data.SECTIONS || []).forEach(x => { const t = x && P.SECTIONS.find(s => s.id === x.id && secs.has(s.id)); if (!t) return; LESSON.forEach(k => { if (x[k] != null && x[k] !== '') t[k] = deep(x[k]); }); });
    P.SECTIONS.forEach(s => { if (!secs.has(s.id)) return; if (!Array.isArray(s.examples) || !s.examples.length) s.examples = s.example && s.example.p ? [{ p: s.example.p, s: s.example.s || '' }] : []; if (!Array.isArray(s.check)) s.check = []; if (!Array.isArray(s.ideas)) s.ideas = []; if (!Array.isArray(s.pitfalls)) s.pitfalls = []; if (typeof s.plain !== 'string') s.plain = ''; });
    P.FLASHCARDS = (P.FLASHCARDS || []).filter(c => !secs.has(c.sec)).concat((data.FLASHCARDS || []).filter(c => c && c.f && c.b && secs.has(c.sec)).map((c, i) => ({ id: `u${n}-${String(c.id || 'c' + i).replace(/[^a-z0-9_.-]/gi, '')}`, unit: n, sec: c.sec, f: c.f, b: c.b })));
    const Q = P.QUIZ && typeof P.QUIZ === 'object' ? P.QUIZ : {}; Q.topics = Q.topics && typeof Q.topics === 'object' && !Array.isArray(Q.topics) ? Q.topics : {}; Q.questions = (Q.questions || []).filter(q => !secs.has(q.topic));
    secs.forEach(id => { delete Q.topics[id]; });
    ((data.QUIZ || {}).questions || []).forEach(q => { const s = q && secs.has(q.topic) && P.SECTIONS.find(x => x.id === q.topic); if (!s || !Array.isArray(q.items) || !q.items.length) return; Q.topics[q.topic] = { unit: s.unit, sec: q.topic, label: s.title }; Q.questions.push({ type: 'bank', topic: q.topic, items: q.items }); });
    P.QUIZ = Q;
  }
  async function writeUnits(root, units) {
    if (!user()) { toast('Sign in first: Bo writes lessons for your account.', 4000); signIn('login'); return; }
    const P = S.obj; units = units.filter(n => { const u = P.UNITS.find(x => x.n === n); return u && u.sections.length; });
    if (!units.length) { toast('Add topics to the unit first.'); return; }
    if (!P.code && !P.name) { toast('Give the class its code and name first (Basics).', 3500); return; }
    const empty = P.SECTIONS.filter(s => units.includes(s.unit) && !s.title); if (empty.length) { toast('Give every topic a title first (Topics).', 3500); return; }
    if (units.some(n => P.SECTIONS.some(s => s.unit === n && hasLesson(s))) && !confirm(`Bo writes ${units.length === 1 ? `unit ${units[0]}` : `${units.length} units`} again, in place of the lessons there now${units.length === 1 ? '' : ''}. Go ahead?`)) return;
    const prog = $('#mkr-lprog', root); const btns = $$('[data-write], [data-ed="write-all"]', root); btns.forEach(b => { b.disabled = true; });
    const size = settings().mkSize === 'short' ? 'short' : 'full';
    const outline = () => ({ code: P.code, name: P.name, UNITS: P.UNITS.map(u => ({ n: u.n, title: u.title, sections: u.sections })), SECTIONS: P.SECTIONS.map(s => ({ id: s.id, label: s.label || '', title: s.title, unit: s.unit, about: s.about || '' })) });
    let done = 0;
    try {
      for (const n of units) {
        if (prog) { prog.hidden = false; $('#mkr-lnow', root).textContent = `Bo is writing unit ${n}…`; $('#mkr-lof', root).textContent = `${done + 1} of ${units.length}`; $('#mkr-lfill', root).style.width = `${Math.round(((done + 0.4) / units.length) * 100)}%`; }
        const r = await api('ai_class', { step: 'unit', unit: n, size, outline: outline() });
        mergeUnit(P, n, r.data || {}); done++; touch();
      }
      if (prog) prog.hidden = true;
      repaint(root);
      toast(S.kind === 'new' ? `Bo wrote ${done === 1 ? 'the unit' : `${done} units`}. Save the class to keep them.` : `Bo wrote ${done === 1 ? 'the unit' : `${done} units`}. Save to keep ${done === 1 ? 'it' : 'them'}.`, 4500);
    } catch (x) {
      if (prog) { prog.hidden = false; $('#mkr-lnow', root).textContent = x.message; $('#mkr-lof', root).innerHTML = x.data && x.data.credits ? '<a href="#/usage">Get credits</a>' : done ? `${done} unit${done === 1 ? ' is' : 's are'} written: save to keep ${done === 1 ? 'it' : 'them'}.` : ''; }
      if (done) repaint(root);
    }
    $$('[data-write], [data-ed="write-all"]', root).forEach(b => { b.disabled = false; });
  }

  /* ---------- a class of your own: share it, send its file, delete it ---------- */
  async function classActions(root, b) {
    const id = S.id; const e = App.myClasses.entry(id) || {}; const code = e.code || S.obj.code; const k = b.dataset.mkr;
    if (k === 'share') { if (S.dirty) { toast('Save your changes first.', 3000); return; } if (App.shareClass) App.shareClass(id); return; }
    if (k === 'file') { try { const pack = await App.myClasses.read(id); await MK().plat.shareFile(`${String(code || id).replace(/[^A-Za-z0-9]+/g, '')}.mathub.json`, JSON.stringify(pack), `${code} for StudyCat`); } catch (x) { if (!/cancel/i.test(x.message || '')) toast('Could not send the class: ' + x.message); } return; }
    if (k === 'delete') {
      if (!confirm(e.synced && user() ? `Delete ${code}? It is deleted from your account and from every device where you are signed in, with your progress in it.${e.share ? ' Its share link stops working.' : ''}` : `Delete ${code}? Your progress in it is deleted too.`)) return;
      try { await App.myClasses.remove(id); try { localStorage.removeItem('studyhub-' + id); } catch (x) {} S = null; toast(`${code} deleted.`); location.hash = '#/maker'; } catch (x) { toast(x.message); }
    }
  }

  /* ---------- saving ---------- */
  function showErr(list) { const el = $('#mkr-err'); if (!el) return; el.hidden = !list.length; el.innerHTML = list.length ? `<b>Not saved yet:</b><ul>${list.slice(0, 6).map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''; }
  async function save(root, btn) {
    if (S.kind === 'catalog') return saveCatalog(root);
    const M = MK(); const P = S.obj;
    if (!(await M.canAdd())) return;
    const errs = []; if (!String(P.code || '').trim()) errs.push('The class needs its course code (Basics).'); if (!String(P.name || '').trim()) errs.push('The class needs its name (Basics).');
    if (!P.SECTIONS.some(s => String(s.title || '').trim())) errs.push('Add at least one topic (Topics).');
    if (errs.length) { showErr(errs); return; }
    const id = S.kind === 'new' ? M.newId() : S.id;
    const raw = deep(P); raw.id = id;
    // empty rows the student left are dropped; a lesson's first example is also its "example" (older pages read that)
    raw.SECTIONS = raw.SECTIONS.filter(s => String(s.title || '').trim()); const keep = new Set(raw.SECTIONS.map(s => s.id)); raw.UNITS.forEach(u => { u.sections = u.sections.filter(x => keep.has(x)); });
    raw.SECTIONS.forEach(s => { s.examples = (s.examples || []).filter(x => x && String(x.p || '').trim()); s.check = (s.check || []).filter(x => x && String(x.q || '').trim()); if (s.examples.length) s.example = { p: s.examples[0].p, s: s.examples[0].s || '' }; else delete s.example; ['about', 'plain'].forEach(k => { if (!s[k]) delete s[k]; }); if (!s.examples.length) delete s.examples; if (!s.check.length) delete s.check; });
    raw.CALENDAR = raw.CALENDAR.filter(e => ISO.test(e[0] || '') && String(e[2] || '').trim());
    raw.EXAMS = raw.EXAMS.filter(e => String(e.name || '').trim() || e.date); const noDate = raw.EXAMS.filter(e => !ISO.test(e.date || '')); if (noDate.length) { showErr([`Give ${noDate.map(e => e.name || 'each exam').join(', ')} a date (Exams), or remove ${noDate.length === 1 ? 'it' : 'them'}.`]); return; }
    raw.EXAMS.forEach(e => { if (e.weight === '' || e.weight == null) delete e.weight; e.sections = raw.SECTIONS.filter(s => (e.units || []).includes(s.unit)).map(s => s.id); });
    // the exams are on the calendar as the Exams tab has them (an exam row the syllabus had for something else stays)
    const exNames = new Set(raw.EXAMS.map(e => String(e.name).trim().toLowerCase()));
    raw.CALENDAR = raw.CALENDAR.filter(e => !(e[1] === 'exam' && exNames.has(String(e[2]).trim().toLowerCase()))).concat(raw.EXAMS.map(e => [e.date, 'exam', e.name])).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    raw.GRADING.categories = raw.GRADING.categories.filter(c => String(c.name || '').trim()).map(c => Object.assign(c, { weight: Number(c.weight) || 0 }));
    raw.GRADING.scale = raw.GRADING.scale.filter(x => String(x.letter || '').trim() && x.min !== '' && x.min != null);
    raw.COURSE.deadlines = raw.COURSE.deadlines.filter(x => x && String(x.name || '').trim());
    if (!raw.COURSE.textbook.title) delete raw.COURSE.textbook; if (!raw.short) delete raw.short;
    const { pack } = M.repair(raw, id); const v = Packs.validate(pack);
    if (v.errors.length) { showErr(v.errors); return; }
    btn.disabled = true;
    try {
      const fresh = S.kind === 'new'; const entry = await App.myClasses.add(pack);
      if (fresh) lsSet(DRAFT, null);
      S = { id: entry.id, kind: 'mine', obj: shape(deep(pack)), dirty: false };
      if (M.plat) M.plat.haptic('success');
      toast(fresh ? `${pack.code} is saved. It is with your classes now.` : `${pack.code} is saved.`, 3500);
      if (fresh) { location.hash = `#/maker/${entry.id}?tab=${pack.SECTIONS.some(hasLesson) ? 'basics' : 'lessons'}`; return; }
      showErr([]); paintBar();
    } catch (x) { btn.disabled = false; showErr([x.message]); }
  }
  async function saveCatalog(root, reset) {
    const id = S.id; const K = deep(S.obj);
    ['short', 'instructor', 'instructorEmail', 'officeHours', 'classDays', 'room', 'color'].forEach(k => { if (typeof K[k] === 'string') K[k] = K[k].trim(); if (!K[k]) delete K[k]; });
    K.events = (K.events || []).filter(e => ISO.test(e[0] || '') && String(e[2] || '').trim()).slice(0, 120).map(e => [e[0], e[1] || 'admin', String(e[2]).trim().slice(0, 120)]);
    Object.keys(K.exams || {}).forEach(k => { const o = K.exams[k]; if (o.date && !ISO.test(o.date)) delete o.date; if (!Object.keys(o).length) delete K.exams[k]; });
    Object.keys(K.weights || {}).forEach(k => { const w = Number(K.weights[k]); if (!(w >= 0 && w <= 100)) delete K.weights[k]; });
    ['events', 'exams', 'weights'].forEach(k => { if (Array.isArray(K[k]) ? !K[k].length : !Object.keys(K[k] || {}).length) delete K[k]; });
    const all = Object.assign({}, settings().classCustom); if (Object.keys(K).length) all[id] = K; else delete all[id];
    setSetting('classCustom', all);
    // the section, its time and lab day go with the class list (Settings and the class picker show them too)
    const old = { section: App.courseSetting(id, 'section', ''), examTime: App.courseSetting(id, 'examTime', ''), labDay: App.courseSetting(id, 'labDay', '') };
    if (!reset && (old.section !== S.sec.section || old.examTime !== S.sec.examTime || (S.sec.labDay && old.labDay !== S.sec.labDay))) {
      const sections = Object.assign({}, (App.auth && App.auth.user && App.auth.user.sections) || {}); sections[id] = { section: S.sec.section, examTime: S.sec.examTime, labDay: S.sec.labDay || '' };
      try { if (App.auth && App.auth.savePrefs) await App.auth.savePrefs({ sections }); else { App.setCourseSetting(id, 'section', S.sec.section); App.setCourseSetting(id, 'examTime', S.sec.examTime); } } catch (x) { toast(x.message, 4000); }
    }
    App.applyVariant(Courses[id]); applyColors();
    if (App.rebuildNav) App.rebuildNav(); if (App.reminders) App.reminders.sync();
    S.dirty = false; if (reset) { S.obj = { events: [], exams: {}, weights: {} }; repaint(root); }
    toast(reset ? `${Courses[id].code} is back as StudyCat has it.` : `Saved. ${Courses[id].short || Courses[id].code} is yours now, on every page.`, 3500);
    paintTile(root); paintBar();
  }

  /* ---------- the colour a student picked for StudyCat's class (the class's own rules come from assets/classpacks.js) ---------- */
  function applyColors() {
    let el = document.getElementById('mh-class-colors'); const all = settings().classCustom || {};
    const css = Object.keys(all).filter(id => Courses[id] && all[id] && /^#[0-9a-f]{6}$/i.test(all[id].color || '')).map(id => Packs.css(id, { light: all[id].color }).replace(/:root/g, ':root:root').replace(new RegExp(`\\.course-card\\.${id}\\b`, 'g'), `.course-card.${id}.${id}`).replace(new RegExp(`\\.chip\\.course-${id}\\b`, 'g'), `.chip.course-${id}.course-${id}`)).join('\n');
    if (!css) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'mh-class-colors'; document.head.appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
    if (el.nextElementSibling) document.head.appendChild(el);   // stays last, after any class's own colours
  }
  App.applyClassColors = applyColors;
  applyColors();
  if (App.onSetting) { const prev = App.onSetting; App.onSetting = k => { prev(k); if (k === 'classCustom') { applyColors(); Object.keys(Courses).forEach(id => App.applyVariant(Courses[id])); } }; }

  /* ---------- after picking classes: make them yours ---------- */
  App.promptCustomize = ids => {
    ids = (ids || []).filter(id => Courses[id] && !mine(id)); if (!ids.length || $('#mkr-prompt')) return;
    const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'mkr-prompt';
    m.innerHTML = `<div class="modal mkr-modal" role="dialog" aria-modal="true" aria-labelledby="mkr-pr-h"><div class="mkr-modal-h"><span class="mkr-hero-av sm" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(44) : ''}</span><div><h2 id="mkr-pr-h">Make your classes yours</h2><p class="small muted">StudyCat has the lessons and practice. Add what is only true for your section: your instructor, exam dates and times, your own due dates and the grading weights.</p></div></div>
      <ul class="mkr-list">${ids.map((id, i) => `<li class="mkr-row" style="${App.classStyle ? App.classStyle(id) : ''}"><span class="mkr-tile" aria-hidden="true">${esc(Courses[id].short || Courses[id].code)}</span><div class="mkr-row-t"><b>${esc(Courses[id].code)}</b><span>${esc(Courses[id].name)}</span></div><div class="mkr-row-a"><a class="btn sm${i === 0 ? ' primary' : ''}" href="#/maker/${esc(id)}?next=${esc(ids.filter(x => x !== id).join(','))}">${icon('sliders', 13)} Make it yours</a></div></li>`).join('')}</ul>
      <div class="row gap-sm mt-2" style="justify-content:flex-end"><button type="button" class="btn" data-mkp="later">Later</button></div><p class="small muted mt-1">Any time: the class maker, in the sidebar under Your classes.</p></div>`;
    document.body.appendChild(m);
    const close = () => { if (App.dismiss) App.dismiss(m); else m.remove(); document.removeEventListener('keydown', esc1); };
    const esc1 = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc1);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-mkp="later"]') || e.target.closest('a[href^="#/maker/"]')) close(); });
    const first = $('a.btn', m); if (first) first.focus();
  };
})(window);
