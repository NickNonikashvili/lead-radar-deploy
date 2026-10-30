/* ============================================================
   StudyCat — your home, as the October 2026 redesign draws it (assets/design.css, .hg-*)
   - The hero says the one thing that matters now, in one of three states:
       1. an exam is coming up (the soonest in the next three weeks): "Calc I Exam 3 in 8 days.", what it covers,
          how ready you are, Start a quiz on it, See exam topics, and your other classes as chips
       2. no exam soon: "Back to Physics I?", the last class you practised and how that went, Continue, Retry the
          ones you missed
       3. nothing studied yet: "Pick a class, take a five-minute quiz." with your classes (or the catalog) to pick
   - Below it a tidy grid of cards: the daily word puzzle, today's plan, this week, the checklist of an exam in the
     coming week, your classes, flashcards due, mistakes to retry, discussions. Every card has a ⋮ menu that hides it;
     "Add to dashboard" lists what is hidden (the tools start there) and brings it back. Saved with the account
     (settings.homeGrid: { hidden: [...], shown: [...] }).
   - Arrange freely switches to the free-form dashboard (assets/dash.js: drag, resize, overlap) and keeps it
     (settings.homeMode = 'free', kept on this device: arranging freely is for a big screen); from there, Use the tidy
     layout comes back.
   Used by the start page in assets/app.js (Landing).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const Courses = global.Courses; if (!App) return;
  const { $, $$, esc, icon, settings, setSetting } = App;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const safe = f => { try { return f(); } catch (e) { return null; } };
  const L = () => App.life;
  const mine = () => App.myCourses().filter(id => Courses[id] && !Courses[id].preview);
  const dataOf = id => (App.store.id === id ? App.store.data : App.store.peek(id)) || {};
  const cc = id => (App.classStyle ? App.classStyle(id) : '');
  const iso = () => App.todayISO();
  const fmt = (d, o) => { try { return App.parseISO(d).toLocaleDateString(App.lang === 'en' ? 'en-US' : App.lang, o); } catch (e) { return d; } };
  const topicsOf = C => (C && ((C.quiz && C.quiz.TOPICS) || C.quizTopics)) || {};
  const HG = App.homeGrid = {};
  Object.assign(App.ICONS || {}, {
    dots: '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.3 9.3 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
  });

  /* ---------- where things stand ---------- */
  function soonestExam(ids) {
    const d0 = iso();
    return ids.map(id => { const C = Courses[id]; const ex = safe(() => App.nextExamOf(C)); return ex && ex.date && ex.date >= d0 ? { id, C, ex, n: App.daysBetween(d0, ex.date) } : null; }).filter(Boolean).sort((a, b) => a.n - b.n)[0] || null;
  }
  // the class practised last, and how its last day of practice went
  function lastStudied(ids) {
    let best = null;
    ids.forEach(id => { const h = dataOf(id).history || []; const last = h[h.length - 1]; if (last && (!best || last.d > best.d || (last.d === best.d && h.length > best.h.length))) best = { id, d: last.d, h }; });
    if (!best) return null;
    const day = best.h.filter(x => x.d === best.d); const T = topicsOf(Courses[best.id]);
    const by = {}; day.forEach(x => { by[x.t] = (by[x.t] || 0) + 1; }); const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
    const right = day.filter(x => x.ok).length, missed = day.length - right;
    return { id: best.id, C: Courses[best.id], d: best.d, topic: top && T[top] ? T[top].label : '', right, total: day.length, missed };
  }
  const whenWord = d => { const n = App.daysBetween(d, iso()); return n <= 0 ? t('Today') : n === 1 ? t('Yesterday') : fmt(d, { weekday: 'long' }); };
  function examTopics(C, ex) {
    if (ex.covers) { const c = String(ex.covers).replace(/\s*\([^)]*\)\s*$/, '').trim(); return c.charAt(0).toUpperCase() + c.slice(1) + (/[.!?]$/.test(c) ? '' : '.'); }
    const secs = (ex.sections || []).map(s => (C.SECTIONS || []).find(x => x.id === s)).filter(Boolean).map(s => s.title);
    if (secs.length) { const list = secs.slice(0, 3); return list.length === 1 ? list[0] + '.' : list.slice(0, -1).join(', ') + ' ' + t('and') + ' ' + list[list.length - 1].replace(/^./, c => c.toLowerCase()) + '.'; }
    return '';
  }
  const chip = id => { const C = Courses[id]; return `<a class="hg-chip" href="#/${esc(id)}/dashboard" style="${cc(id)}"><span class="hg-code">${esc(C.short || C.code)}</span><span>${esc(C.name)}</span></a>`; };

  /* ---------- the hero ---------- */
  // the art: two ranges of mountains, the pixel skyline and Bo (the sky and the moon are the hero's background)
  const art = HG.art = '<svg class="hg-peaks" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path class="far" d="M0 70L130 40 330 125 560 20 800 118 1010 32 1200 96V200H0z"/><path class="near" d="M0 120L210 82 420 140 640 74 880 136 1060 88 1200 118V200H0z"/><path class="hill" d="M0 168Q300 140 600 166T1200 160V200H0z"/></svg><div class="mascot-slot hg-bo" data-size="96" aria-hidden="true"></div><div class="px-skyline" aria-hidden="true"></div>';
  function heroHtml(state) {
    const d0 = iso(); const first = mine()[0]; const ss = first && App.semesterStateOf ? safe(() => App.semesterStateOf(Courses[first])) : null;
    const when = `${esc(fmt(d0, { weekday: 'short', month: 'short', day: 'numeric' }))}${ss && ss.week ? ` · ${esc(t('Week {1}', ss.week))}` : ''}`;
    const ids = mine();
    if (state.kind === 'exam') {
      const { id, C, ex, n } = state; const r = safe(() => App.readiness(id)); const pct = r && r.ok ? r.score : 0;
      const tail = n === 0 ? t('is today.') : n === 1 ? t('is tomorrow.') : t('in {1} days.', n);
      const others = ids.filter(x => x !== id).slice(0, 4);
      return `<header class="hg-hero" data-state="exam"><div class="hg-hero-in">
        <p class="hg-when">${when}<span class="hg-gold">${icon('calendar', 13)} ${esc(t('Next exam'))} · ${esc(fmt(ex.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</span></p>
        <h1 class="hg-title">${esc(C.short || C.code || C.name)} ${esc(ex.name)} <em>${esc(tail)}</em></h1>
        ${examTopics(C, ex) ? `<p class="hg-sub">${esc(examTopics(C, ex))}</p>` : ''}
        <div class="hg-ready"><span class="hg-track" role="progressbar" aria-label="${esc(t('Ready for {1}', ex.name))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span><span>${pct}%</span></div>
        <div class="hg-cta"><a class="btn primary lg" href="#/${esc(id)}/practice?exam=${esc(ex.id)}">${esc(t('Start {1} quiz', C.short || C.code || C.name))} ${icon('right', 16)}</a><a class="hg-link" href="#/${esc(id)}/exam/${esc(ex.id)}">${esc(t('See exam topics'))}</a></div>
        ${others.length ? `<div class="hg-chips">${others.map(chip).join('')}</div>` : ''}</div>${art}</header>`;
    }
    if (state.kind === 'back') {
      const { id, C, d, topic, right, total, missed } = state;
      const others = ids.filter(x => x !== id).slice(0, 4);
      const line = topic ? t('{1}: {2}, {3} of {4} correct.', whenWord(d), topic, right, total) : t('{1}: {2} of {3} correct.', whenWord(d), right, total);
      return `<header class="hg-hero" data-state="back"><div class="hg-hero-in">
        <p class="hg-when">${when} · ${esc(t('Pick up where you left off'))}</p>
        <h1 class="hg-title">${esc(t('Back to'))} <em class="hg-cls" style="${cc(id)}">${esc(C.name)}?</em></h1>
        <p class="hg-sub">${esc(line)}</p>
        <div class="hg-cta"><a class="btn primary lg" href="#/${esc(id)}/practice">${esc(t('Continue {1} quiz', C.short || C.code || C.name))} ${icon('right', 16)}</a>${missed ? `<a class="hg-link" href="#/${esc(id)}/mistakes">${esc(missed === 1 ? t('Retry the one I missed') : t('Retry the {1} I missed', missed))}</a>` : ''}</div>
        ${others.length ? `<div class="hg-chips">${others.map(chip).join('')}</div>` : ''}</div>${art}</header>`;
    }
    // nothing studied yet: your classes to start one; no classes yet: the class picker is right below the hero
    return `<header class="hg-hero" data-state="start"><div class="hg-hero-in">
      <p class="hg-when">${when}</p>
      <h1 class="hg-title">${esc(t('Pick a class, take a'))} <em>${esc(t('five-minute quiz.'))}</em></h1>
      <p class="hg-sub">${esc(t('Every question is solved step by step.'))}</p>
      ${ids.length ? `<div class="hg-pick">${ids.slice(0, 8).map(id => { const C = Courses[id]; return `<a class="hg-chip" href="#/${esc(id)}/practice" style="${cc(id)}"><span class="hg-code">${esc(C.short || C.code)}</span><span>${esc(C.name)}</span></a>`; }).join('')}</div>`
        : `<div class="hg-cta"><button type="button" class="btn primary lg" data-action="go-pick">${esc(t('Pick your classes'))} ${icon('right', 16)}</button></div>`}
      <a class="hg-link" href="#/maker">${esc(t('Class not here? Make it from your syllabus'))}</a></div>${art}</header>`;
  }
  HG.state = () => { const ids = mine(); const ex = soonestExam(ids); if (ex && ex.n <= 21) return Object.assign({ kind: 'exam' }, ex); const last = lastStudied(ids); return last ? Object.assign({ kind: 'back' }, last) : { kind: 'start' }; };

  /* ---------- the cards ---------- */
  const more = (id, title) => `<button type="button" class="hg-more" data-hgm="${id}" aria-label="${esc(t('More options for {1}', title))}" aria-haspopup="menu" aria-expanded="false">${icon('dots', 18)}</button>`;
  const shell = (id, w, title, body, extra = '', cls = '') => `<section class="hg-card hg-${id} w-${w}${cls ? ' ' + cls : ''}" data-hg="${id}" aria-labelledby="hg-${id}-t"><header class="hg-h"><h2 id="hg-${id}-t">${esc(title)}</h2>${extra}${more(id, title)}</header>${body}</section>`;
  const mini = (id, ic, tone, title, num, label, href, go) => `<section class="hg-card hg-mini hg-${id} w-third" data-hg="${id}" aria-labelledby="hg-${id}-t"><header class="hg-h"><span class="hg-ic tone-${tone}" aria-hidden="true">${icon(ic, 17)}</span><h2 id="hg-${id}-t">${esc(title)}</h2>${more(id, title)}</header><div class="hg-num">${esc(String(num))}</div><p class="hg-lab">${esc(label)}</p><a class="hg-go" href="${href}">${esc(go)}</a></section>`;

  function planCard() {
    const ids = mine(); const d0 = iso(); const p = App.todayPlan ? App.todayPlan() : { reviewed: 0 }; const items = [];
    const due = ids.map(id => ({ id, n: safe(() => { const x = App.dueCards(id); return x.count + (x.estimated || 0); }) || 0 })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const dueN = due.reduce((s, x) => s + x.n, 0);
    if (dueN || p.reviewed) items.push({ done: !dueN && p.reviewed > 0, title: due.length ? `${t('Flashcards')} · ${due.map(x => Courses[x.id].short || Courses[x.id].code).slice(0, 2).join(', ')}` : t('Flashcards'), sub: dueN ? t('{1} min · {2} cards', Math.max(5, Math.round(dueN * 0.4)), dueN) : t('{1} reviewed today', p.reviewed), href: '#/today', min: dueN ? Math.max(5, Math.round(dueN * 0.4)) : 0 });
    const weak = ids.map(id => ({ id, w: safe(() => App.weakestTopic(id)) })).filter(x => x.w)[0];
    if (weak) { const done = settings().lastLessonDay === d0; items.push({ done, title: `${weak.w.label} · ${Courses[weak.id].short || Courses[weak.id].code}`, sub: done ? t('Done today') : t('{1} min · a short lesson', 10), href: `#/${weak.id}/lesson?topics=${encodeURIComponent(weak.w.t)}`, min: done ? 0 : 10 }); }
    const m = App.mistakesSummary ? safe(() => App.mistakesSummary()) : null;
    if (m && (m.due || m.open)) items.push({ done: !m.due, title: m.due ? t('Retry {1} missed questions', m.due) : t('No mistakes due today'), sub: m.due ? t('{1} min · back with their explanations', Math.max(3, m.due * 2)) : t('{1} still open', m.open), href: '#/mistakes', min: m.due ? Math.max(3, m.due * 2) : 0 });
    const list = items.slice(0, 3); const done = list.filter(x => x.done).length; const mins = list.reduce((s, x) => s + x.min, 0);
    const first = list.findIndex(x => !x.done);
    const body = list.length ? `<div class="hg-plan">${list.map((x, k) => `<div class="hg-row${x.done ? ' done' : ''}"><span class="hg-box" aria-hidden="true">${x.done ? icon('check', 13) : ''}</span><div class="hg-row-t"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div>${k === first ? `<a class="btn sm hg-start" href="${x.href}">${esc(t('Start'))}</a>` : `<span class="sr-only">${esc(x.done ? t('Done') : t('Not done yet'))}</span>`}</div>`).join('')}</div><a class="hg-go" href="#/today">${esc(t('Open today’s plan'))}</a>`
      : `<p class="hg-none">${esc(t('Nothing planned yet. Pick a class and StudyCat plans the day for you.'))}</p>`;
    return shell('plan', 'half', t('Today’s plan'), body, list.length ? `<span class="hg-meta">${esc(t('{1} min · {2} of {3} done', mins, done, list.length))}</span>` : '');
  }
  function weekCard() {
    const Lf = L(); const d0 = iso(); let rows = [];
    if (Lf) rows = Lf.items(d0, Lf.addDaysISO(d0, 6)).filter(x => ['deadline', 'assignment', 'task', 'exam', 'lab', 'quiz'].includes(x.kind) && !x.done).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 4);
    const kind = k => ({ exam: t('Exam'), lab: t('Lab'), assignment: t('Assignment'), deadline: t('Deadline'), task: t('Task'), quiz: t('Quiz') })[k] || '';
    const body = rows.length ? `<div class="hg-week">${rows.map(x => { const C = x.course && Courses[x.course]; return `<div class="hg-wk${x.kind === 'exam' ? ' exam' : ''}" style="${x.course ? cc(x.course) : ''}"><span class="hg-day"><small>${esc(fmt(x.date, { weekday: 'short' }).toUpperCase())}</small><b>${esc(String(App.parseISO(x.date).getDate()))}</b></span><span class="hg-bar" aria-hidden="true"></span><span class="hg-wk-t"><b>${esc(x.title)}</b><small>${esc([C ? C.name : '', kind(x.kind)].filter(Boolean).join(' · '))}</small></span>${x.kind === 'exam' ? `<span class="hg-badge">${esc(t('Exam'))}</span>` : ''}</div>`; }).join('')}</div>`
      : `<p class="hg-none">${esc(t('Nothing due in the next seven days.'))}</p>`;
    return shell('week', 'half', t('This week'), body, `<a class="hg-head-link" href="#/agenda">${esc(t('Open calendar'))}</a>`);
  }
  function checklistCard() {
    const ex = soonestExam(mine()); if (!ex || ex.n > 7) return '';   // only in the week before an exam
    if (!ex.C.loaded) return `<i class="hg-later" data-hg-later="${esc(ex.id)}" hidden></i>`;   // filled in once the class's data is here (wire)
    const items = (ex.C.CHECKLISTS && ex.C.CHECKLISTS[ex.ex.id]) || []; if (!items.length) return '';
    const st = (dataOf(ex.id).checklists || {})[ex.ex.id] || {};
    const body = `<div class="hg-check">${items.map((it, i) => `<label class="hg-ck"><input type="checkbox" data-hgc="${esc(ex.id)}|${esc(ex.ex.id)}|${i}"${st[i] ? ' checked' : ''}><span>${esc(typeof it === 'string' ? it : it.t || it.text || '')}</span></label>`).join('')}</div><p class="hg-foot">${esc(t('Shows up in the week before an exam.'))}</p>`;
    return shell('checklist', 'half', t('{1} checklist', ex.ex.name), body, `<span class="hg-badge">${esc(ex.C.short || ex.C.code)} · ${esc(fmt(ex.ex.date, { weekday: 'short' }))}</span>`);
  }
  function pctOf(id) {
    const r = safe(() => App.readiness(id)); if (r && r.ok) return r.score;
    const nodes = App.pathNodes ? safe(() => App.pathNodes(Courses[id])) || [] : []; return nodes.length ? Math.round(100 * nodes.filter(n => n.state === 'done').length / nodes.length) : 0;
  }
  function classesCard() {
    const ids = mine(); if (!ids.length) return '';
    const body = `<div class="hg-classes">${ids.map(id => { const C = Courses[id]; const p = pctOf(id); return `<a class="hg-cl" href="#/${esc(id)}/dashboard" style="${cc(id)}"><span class="hg-cl-row"><span class="hg-dot" aria-hidden="true"></span><b>${esc(C.name)}</b><span class="hg-pct">${p}%</span></span><span class="hg-track" role="progressbar" aria-label="${esc(C.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></span></a>`; }).join('')}</div>${App.auth && App.auth.user && App.auth.onboard ? `<button type="button" class="hg-go linkbtn" data-hg-pick="1">${esc(t('Change your classes'))}</button>` : ''}`;
    return shell('classes', 'half', t('Your classes'), body);
  }
  function cardsCard() {
    const ids = mine(); const n = ids.reduce((s, id) => s + (safe(() => { const x = App.dueCards(id); return x.count + (x.estimated || 0); }) || 0), 0);
    return mini('cards', 'cards', 'violet', t('Flashcards'), n, n === 1 ? t('card to review today') : t('cards to review today'), '#/today', n ? t('Review now') : t('Open flashcards'));
  }
  function mistakesCard() {
    const m = App.mistakesSummary ? safe(() => App.mistakesSummary()) || {} : {}; const n = m.due || 0;
    return mini('mistakes', 'undo', 'orange', t('Mistakes'), n, n === 1 ? t('question to retry today') : t('questions to retry today'), '#/mistakes', n ? t('Retry them') : t('Open the notebook'));
  }
  function forumCard() {
    const u = App.auth && App.auth.user && !App.auth.user.local ? App.auth.user : null; const n = u ? (u.unread || 0) : 0;
    return mini('forum', 'chat', 'blue', t('Discussions'), n, n === 1 ? t('new reply or mention') : t('new replies and mentions'), u ? '#/forum/inbox' : '#/forum', n ? t('Read them') : t('Open discussions'));
  }
  // the tools: hidden until added
  const classFor = need => mine().find(id => { const C = Courses[id]; return need ? need(C) : true; });
  function toolCard(id) {
    const T = TOOLS[id]; const href = typeof T.href === 'function' ? T.href() : T.href; if (!href) return '';
    return `<section class="hg-card hg-mini hg-tool hg-${id} w-third" data-hg="${id}" aria-labelledby="hg-${id}-t"><header class="hg-h"><span class="hg-ic tone-${T.tone}" aria-hidden="true">${icon(T.ic, 17)}</span><h2 id="hg-${id}-t">${esc(t(T.t))}</h2>${more(id, t(T.t))}</header>${T.big ? `<div class="hg-num" data-hgbig="${id}">${esc(T.big())}</div>` : ''}<p class="hg-lab">${esc(t(T.lab))}</p><a class="hg-go" href="${href}">${esc(t(T.go))}</a></section>`;
  }
  const TOOLS = {
    gpa: { t: 'GPA', ic: 'calc', tone: 'green', lab: 'This term, from your grades', go: 'Open calculator', href: '#/gpa' },
    focus: { t: 'Focus timer', ic: 'timer', tone: 'orange', lab: 'One focused session', go: 'Start', href: '#/focus', big: () => '25:00' },
    toolkit: { t: 'Class tools', ic: 'calc', tone: 'blue', lab: 'Grade calculators and tools picked for each class', go: 'Open', href: () => { const id = classFor(); return id ? `#/${id}/toolkit` : '#/tools'; } },
    grapher: { t: 'Grapher', ic: 'chart', tone: 'violet', lab: 'Plot any equation', go: 'Open', href: () => { const id = classFor(C => C.id === 'calc' || C.id === 'precalc'); return id ? `#/${id}/grapher` : ''; } },
    calcs: { t: 'Calculators & converters', ic: 'sliders', tone: 'blue', lab: 'Draw up a quick number', go: 'Open', href: '#/tools' },
    formulas: { t: 'Formula sheets', ic: 'sigma', tone: 'green', lab: 'Every formula for each class', go: 'Open', href: () => { const id = classFor(C => (C.FORMULAS && C.FORMULAS.length) || C.formulaCount); return id ? `#/${id}/formulas` : ''; } },
    notes: { t: 'Notes', ic: 'book', tone: 'violet', lab: 'Short lessons for every topic', go: 'Open', href: () => { const id = classFor(); return id ? `#/${id}/notes` : ''; } }
  };
  const ORDER = ['puzzle', 'plan', 'week', 'checklist', 'classes', 'cards', 'mistakes', 'forum'];
  const MINI = ['cards', 'mistakes', 'forum'];
  const NAMES = { puzzle: 'Daily challenge', plan: 'Today’s plan', week: 'This week', checklist: 'Exam checklist', classes: 'Your classes', cards: 'Flashcards', mistakes: 'Mistakes', forum: 'Discussions' };
  function cardHtml(id) {
    if (TOOLS[id]) return toolCard(id);
    return ({ puzzle: () => (App.wordPuzzle ? App.wordPuzzle.card(more('puzzle', t('Daily challenge'))) : ''), plan: planCard, week: weekCard, checklist: checklistCard, classes: classesCard, cards: cardsCard, mistakes: mistakesCard, forum: forumCard })[id]();
  }

  /* ---------- a board of cards you can hide and add back (this home; StudyCat Faculty's home too, assets/teach.js) ----------
     o: key (the synced setting: { hidden, shown }), order (shown until hidden), optional (hidden until added), small (in the
     row of small cards), card(id) → html, name(id) → label, available(id) (an optional card that can be added here) */
  /* small motion for the boards (none when motion is reduced; assets/motion.js App.motionReduced): a menu leaves
     faster than it came, a hidden card fades where it was before the others glide into its place (FLIP), a card
     added back grows in. Quick and eased out, as interface motion should be: under 300 ms. */
  const still = () => !!(App.motionReduced && App.motionReduced());
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  // a closing menu stops being the menu at once (tests and handlers look for .hg-menu), then fades out
  HG.menuOut = m => { if (!m || !m.isConnected) return; if (still()) { m.remove(); return; } m.className = 'hg-menu-out'; m.removeAttribute('role'); m.setAttribute('aria-hidden', 'true'); m.inert = true; setTimeout(() => m.remove(), 130); };
  const places = W => { const m = new Map(); $$('[data-hg]', W).forEach(c => m.set(c.dataset.hg, c.getBoundingClientRect())); return m; };
  function glide(W, before, fresh) {
    if (still() || !Element.prototype.animate) return;
    $$('[data-hg]', W).forEach(c => {
      const a = before.get(c.dataset.hg);
      if (!a) { if (c.dataset.hg === fresh) c.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE }); return; }
      const b = c.getBoundingClientRect(); const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 280, easing: EASE });
    });
  }
  HG.board = function (o) {
    const prefs = () => { const g = settings()[o.key] || {}; return { hidden: Array.isArray(g.hidden) ? g.hidden : [], shown: Array.isArray(g.shown) ? g.shown : [] }; };
    const opt = id => o.optional.includes(id);
    const isShown = id => { const g = prefs(); return opt(id) ? g.shown.includes(id) : !g.hidden.includes(id); };
    const ids = () => o.order.concat(o.optional);
    // the big cards first, then the small ones in a row of their own
    const gridHtml = () => {
      const on = ids().filter(isShown); const html = id => safe(() => o.card(id)) || '';
      const minis = on.filter(id => o.small.includes(id)).map(html).join('');
      return on.filter(id => !o.small.includes(id)).map(html).join('') + (minis ? `<div class="hg-minis">${minis}</div>` : '');
    };
    const addHtml = () => ids().filter(id => !isShown(id) && (!opt(id) || !o.available || o.available(id))).map(id => `<button type="button" class="hg-add-b" data-hga="${id}"><span class="hg-plus" aria-hidden="true">${icon('plus', 13)}</span>${esc(o.name(id))}</button>`).join('') || `<span class="small muted">${esc(t('Everything is on your dashboard.'))}</span>`;
    const html = (foot = '') => `<div class="hg-grid" id="hg-grid">${gridHtml()}</div>
      <section class="hg-add" aria-labelledby="hg-add-t"><h2 class="hg-add-h" id="hg-add-t">${esc(t('Add to dashboard'))}</h2>
        <div class="hg-add-list" id="hg-add-list">${addHtml()}</div>${foot}</section>`;
    function closeMenu() { const m = $('.hg-menu'); if (m) { const b = $(`[data-hgm="${m.dataset.for}"]`); if (b) b.setAttribute('aria-expanded', 'false'); HG.menuOut(m); } }
    // W: the board's own wrapper (drawn fresh with each visit); after: called once the grid is drawn again in place
    function wire(W, after) {
      const repaint = () => { const g = $('#hg-grid', W), a = $('#hg-add-list', W); if (g) g.innerHTML = gridHtml(); if (a) a.innerHTML = addHtml(); if (after) after(); };   // in place: no jump to the top
      // a card onto the board (Add to dashboard, or Undo after hiding): it grows in, the others make room, focus on its heading
      const show = id => {
        const g = prefs(); if (opt(id)) { if (!g.shown.includes(id)) g.shown.push(id); } else g.hidden = g.hidden.filter(x => x !== id); setSetting(o.key, g);
        const before = places(W); repaint(); glide(W, before, id);
        const c = $(`[data-hg="${id}"]`, W); if (c) { c.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' }); const h = $('h2', c); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
      };
      W.addEventListener('click', e => {
        const mb = e.target.closest('[data-hgm]');
        if (mb) {
          e.preventDefault(); const id = mb.dataset.hgm; const open = $('.hg-menu'); const was = open && open.dataset.for === id; closeMenu(); if (was) return;
          const card = mb.closest('.hg-card'); const m = document.createElement('div'); m.className = 'hg-menu'; m.setAttribute('role', 'menu'); m.dataset.for = id;
          m.innerHTML = `<button type="button" role="menuitem" data-hgh="${id}">${icon('eyeoff', 16)} ${esc(t('Hide from dashboard'))}</button>`;
          card.appendChild(m); mb.setAttribute('aria-expanded', 'true'); m.querySelector('button').focus();
          // a click anywhere else, or Tab out of it, closes it
          m.addEventListener('focusout', ev => { const to = ev.relatedTarget; if (to && to.closest && to.closest('[data-hgm]')) return; if (!to || !m.contains(to)) setTimeout(() => { if (m.isConnected && !m.contains(document.activeElement)) closeMenu(); }, 0); });
          setTimeout(() => document.addEventListener('click', function off(ev) { document.removeEventListener('click', off, true); if (m.isConnected && !ev.target.closest('.hg-menu, [data-hgm]')) closeMenu(); }, true), 0);
          return;
        }
        const hb = e.target.closest('[data-hgh]');
        if (hb) {
          const id = hb.dataset.hgh; const g = prefs(); if (opt(id)) g.shown = g.shown.filter(x => x !== id); else if (!g.hidden.includes(id)) g.hidden.push(id); setSetting(o.key, g); closeMenu();
          const gone = () => { const before = places(W); repaint(); glide(W, before); const b = $(`[data-hga="${id}"]`, W); if (b) b.focus(); App.toast(t('Hidden. Add it back any time from Add to dashboard.'), 6000, { label: t('Undo'), run: () => show(id) }); };
          const card = $(`[data-hg="${id}"]`, W);
          if (still() || !card || !card.animate) gone(); else { card.style.pointerEvents = 'none'; card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = gone; }
          return;
        }
        const ab = e.target.closest('[data-hga]');
        if (ab) {
          show(ab.dataset.hga); return;
        }
        if (!e.target.closest('.hg-menu')) closeMenu();
      });
      W.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.hg-menu')) { const id = $('.hg-menu').dataset.for; closeMenu(); const b = $(`[data-hgm="${id}"]`, W); if (b) b.focus(); } });
    }
    return { html, wire, gridHtml, addHtml, isShown };
  };
  HG.more = more; HG.shell = shell; HG.mini = mini; HG.chip = chip;
  const board = HG.board({ key: 'homeGrid', order: ORDER, optional: Object.keys(TOOLS), small: MINI.concat(Object.keys(TOOLS)), card: cardHtml, name: id => t(TOOLS[id] ? TOOLS[id].t : NAMES[id]), available: id => !!(typeof TOOLS[id].href === 'function' ? TOOLS[id].href() : TOOLS[id].href) });   // synced with the account (assets/auth.js PREF_KEYS)

  /* ---------- the page ---------- */
  // the website's own look only: the apps keep their frame, the other looks (Realm and the rest) keep the free-form home
  HG.on = () => settings().homeMode !== 'free' && !document.documentElement.dataset.app && !document.documentElement.dataset.skin;
  HG.html = (o = {}) => {
    if (o.picking) return heroHtml({ kind: 'start' }) + (o.after || '');
    return `${heroHtml(HG.state())}${o.after || ''}
      ${board.html(`<button type="button" class="hg-free linkbtn small" data-hg-free="1">${icon('sliders', 13)} ${esc(t('Arrange freely: drag, resize and add more widgets'))}</button>`)}`;
  };
  HG.wire = function (root, rerender) {
    // listeners go on the home's own wrapper, drawn fresh with each visit (#view stays, so they would pile up there)
    const W = $('.hg-wrap', root); if (!W) return;
    function loadLater() {
      const later = $('[data-hg-later]', W);
      if (later && App.loadCourse) App.loadCourse(later.dataset.hgLater).then(() => { if (!later.isConnected) return; const tmp = document.createElement('div'); tmp.innerHTML = checklistCard(); if (tmp.firstElementChild && !tmp.firstElementChild.matches('[data-hg-later]')) later.replaceWith(tmp.firstElementChild); else later.remove(); }).catch(() => later.remove());
    }
    board.wire(W, loadLater);
    W.addEventListener('click', e => {
      if (e.target.closest('[data-hg-pick]')) { App.auth.onboard(true); return; }
      if (e.target.closest('[data-hg-free]')) { setSetting('homeMode', 'free'); rerender(); }
    });
    // checklists are keyed by exam; an empty set comes back from the server as [] (a list), so it is copied into an object first
    W.addEventListener('change', e => {
      const c = e.target.closest('[data-hgc]'); if (!c) return; const [cid, exid, i] = c.dataset.hgc.split('|');
      App.store.poke(cid, d => { const all = d.checklists = Object.assign({}, d.checklists); const st = all[exid] = all[exid] || {}; st[i] = c.checked; });
      if (c.checked && App.burst) App.burst(c, 'ck-pop');   // a small give when it is ticked (assets/motion.js)
    });
    if (App.wordPuzzle) App.wordPuzzle.wire(W);
    loadLater();
  };
  HG.backToGrid = () => setSetting('homeMode', 'grid');
})(window);
