/* ============================================================
   StudyCat — modules and customization (#/customize)
   Every feature is a module the student can turn off; a module that
   is off leaves the sidebar, every class's menu, the Tools page,
   search and home, and its address shows a page that turns it back on.
   The rest is arrangement and look, all saved with the account (the
   synced preferences, assets/auth.js PREF_KEYS):
   - modules:   { off: [module ids] }
   - navLayout: the sidebar: { order: [group ids], hidden: [group ids],
                items: { group or sub-list id: [page ids] },
                place: { page id: group or sub-list id }, pinned: [page ids],
                hide: [page ids] }   (shell.js asks App.arrangeSidebar)
   - classMenu: every class's menu: { order: [group labels],
                items: { label: [page ids] }, place: { page id: label },
                hidden: [page ids], per: { class id: [page ids] } }
                (app.js groupNav asks App.arrangeClassMenu)
   - look:      { accent, accentAll, text, density, radius, font, hide: [parts] }
                (html data-accent, data-text, data-density, data-radius,
                data-font, data-hide; assets/custom.css)
   - startPage: what opening StudyCat shows ('home', 'today', 'tutor',
                'agenda', 'tasks' or 'class:<id>')
   Some things are always on: home, a class's overview, its lessons and
   syllabus, Settings and this page.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast, settings, setSetting } = App;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const vi = v => (App.viewIcon ? App.viewIcon(v) : 'file');

  /* ---------- the modules ---------- */
  const GROUPS = [['bo', 'Bo'], ['class', 'In every class'], ['plan', 'Planner'], ['tools', 'Tools'], ['life', 'Life'], ['future', 'Future'], ['community', 'Community'], ['help', 'Resources'], ['extras', 'Extras']];
  const MODULES = [
    { id: 'tutor', g: 'bo', label: 'Ask Bo', desc: 'Chat with Bo about anything in your classes, and call him.', views: ['tutor'] },
    { id: 'bofloat', g: 'bo', label: 'Bo on every page', desc: 'The Bo button in the corner, for questions about the page you are on.', views: [] },
    { id: 'path', g: 'class', label: 'Learning path', desc: 'A class’s topics as a trail of short lessons, one step at a time.', views: ['path'] },
    { id: 'practice', g: 'class', label: 'Practice questions', desc: 'Endless questions on the topics you pick, with explanations.', views: ['practice'] },
    { id: 'flashcards', g: 'class', label: 'Flashcards', desc: 'Cards that come back when you are about to forget them.', views: ['flashcards'] },
    { id: 'exam', g: 'class', label: 'Exam prep', desc: 'What each exam covers, practice sets and how ready you are.', views: ['exam'] },
    { id: 'formulas', g: 'class', label: 'Formula sheets', desc: 'The formulas and key terms of a class, searchable.', views: ['formulas'] },
    { id: 'textbook', g: 'class', label: 'Textbook & links', desc: 'The class’s reading and sites.', views: ['textbook'] },
    { id: 'readings', g: 'class', label: 'Readings', desc: 'A writing class’s readings, read aloud if you like.', views: ['readings'] },
    { id: 'mistakes', g: 'class', label: 'Mistakes', desc: 'Every question you got wrong, to try again.', views: ['mistakes'] },
    { id: 'checkwork', g: 'class', label: 'Check my work', desc: 'A photo of your work; Bo finds the first line that goes wrong.', views: ['checkwork'] },
    { id: 'slides', g: 'class', label: 'Notes from slides', desc: 'Lecture slides turned into notes and flashcards.', views: ['slides'] },
    { id: 'mynotes', g: 'class', label: 'My notes', desc: 'Your own notes and highlights on each topic.', views: ['mynotes'] },
    { id: 'planner', g: 'class', label: 'Study planner', desc: 'A day-by-day plan to the next exam.', views: ['planner'] },
    { id: 'calendar', g: 'class', label: 'Class calendar', desc: 'Lectures, labs, due dates and exams of a class.', views: ['calendar'] },
    { id: 'explore', g: 'class', label: 'Class tools and simulators', desc: 'Each class’s own Tools page, grapher, labs and simulators.', views: ['toolkit', 'grapher', 'labs', 'motion', 'solvers', 'explorer', 'unitcircle'] },
    { id: 'playground', g: 'class', label: 'Code playground', desc: 'Python in the browser, for coding classes.', views: ['playground'] },
    { id: 'drafts', g: 'class', label: 'Draft feedback', desc: 'Bo’s coaching on a draft, for writing classes.', views: ['drafts', 'draft-history'] },
    { id: 'notebook', g: 'class', label: 'Writer’s notebook', desc: 'The notebook entries of a writing class.', views: ['notebook'] },
    { id: 'phonetics', g: 'class', label: 'Phonetics lab', desc: 'Sounds, transcription and minimal pairs.', views: ['phonetics'] },
    { id: 'today', g: 'plan', label: 'Today', desc: 'What to do today, across your classes.', views: ['today'] },
    { id: 'tasks', g: 'plan', label: 'Tasks', desc: 'Assignments and to-dos, by due date or on a board.', views: ['tasks'] },
    { id: 'agenda', g: 'plan', label: 'Calendar', desc: 'Your month and week, with every class.', views: ['agenda'] },
    { id: 'timetable', g: 'plan', label: 'Timetable', desc: 'Your weekly schedule of classes and shifts.', views: ['timetable'] },
    { id: 'timelog', g: 'plan', label: 'Time tracker', desc: 'Hours studied, by class.', views: ['timelog'] },
    { id: 'projects', g: 'plan', label: 'Projects & thesis', desc: 'Long projects with milestones and sources.', views: ['projects'] },
    { id: 'focus', g: 'plan', label: 'Focus room', desc: 'Focus blocks with a timer and quiet sounds.', views: ['focus'] },
    { id: 'tools', g: 'tools', label: 'Calculators & converters', desc: 'Calculator, units, citations, word counter, sig figs.', views: ['tools'] },
    { id: 'gpa', g: 'tools', label: 'GPA calculator', desc: 'Semester and cumulative GPA, and what a goal takes.', views: ['gpa'] },
    { id: 'habits', g: 'life', label: 'Habits', desc: 'Daily habits and streaks.', views: ['habits'] },
    { id: 'goals', g: 'life', label: 'Goals', desc: 'Goals for the quarter and their steps.', views: ['goals'] },
    { id: 'wheel', g: 'life', label: 'Wheel of life', desc: 'How each part of life is going.', views: ['wheel'] },
    { id: 'journal', g: 'life', label: 'Journal', desc: 'A page a day and a look back each week.', views: ['journal'] },
    { id: 'money', g: 'life', label: 'Money', desc: 'What came in and what went out.', views: ['money'] },
    { id: 'career', g: 'future', label: 'Internships & jobs', desc: 'Applications, interviews and offers.', views: ['career'] },
    { id: 'portfolio', g: 'future', label: 'Portfolio', desc: 'Projects, skills and your résumé.', views: ['portfolio'] },
    { id: 'forum', g: 'community', label: 'Discussions', desc: 'Each class’s board for questions and answers.', views: ['forum'] },
    { id: 'challenge', g: 'community', label: 'Daily challenge', desc: 'One problem a day, the same for everyone.', views: ['challenge'] },
    { id: 'leagues', g: 'community', label: 'Leagues', desc: 'Weekly XP boards.', views: ['leagues'] },
    { id: 'people', g: 'community', label: 'People', desc: 'Everyone on StudyCat, and who helps on the boards.', views: ['people'] },
    { id: 'sheet', g: 'community', label: 'Character sheet', desc: 'Your study stats as a tabletop character.', views: ['sheet'] },
    { id: 'presence', g: 'community', label: 'Who is studying now', desc: 'The live count of classmates on StudyCat.', views: [] },
    { id: 'resources', g: 'help', label: 'Resources', desc: 'Tutoring, help and links for every class.', views: ['resources'] },
    { id: 'guides', g: 'help', label: 'Study guides', desc: 'Short guides on studying, exams and focus.', views: ['guides'] },
    { id: 'whatsnew', g: 'help', label: 'What’s new', desc: 'The changes to StudyCat.', views: ['whatsnew'] },
    { id: 'celebrate', g: 'extras', label: 'Celebrations', desc: 'Confetti for a goal reached, a level up or an exam set aced.', views: [] }
  ];
  const ALWAYS = ['home', 'dashboard', 'notes', 'course', 'settings', 'customize', 'off', 'notfound'];
  const BY_VIEW = {}; MODULES.forEach(m => m.views.forEach(v => { BY_VIEW[v] = m.id; }));
  const PRESETS = [
    ['all', 'Everything', 'Every feature on.', []],
    ['study', 'Study only', 'Your classes, Bo and the planner; no life, future or community pages.', ['habits', 'goals', 'wheel', 'journal', 'money', 'career', 'portfolio', 'leagues', 'people', 'sheet', 'presence', 'celebrate']],
    ['minimal', 'The essentials', 'Lessons, practice, flashcards, the calendars, tasks and Bo.', MODULES.map(m => m.id).filter(id => !['tutor', 'practice', 'flashcards', 'exam', 'calendar', 'agenda', 'tasks', 'today', 'forum', 'readings', 'drafts'].includes(id))]
  ];
  App.MODULES = MODULES; App.MODULE_GROUPS = GROUPS;

  const offList = () => { const m = settings().modules; return m && Array.isArray(m.off) ? m.off : []; };
  /** Is this module (or the module that holds this page) on? Pages that belong to no module are always on. */
  App.moduleOn = idOrView => { if (ALWAYS.includes(idOrView)) return true; const id = MODULES.some(m => m.id === idOrView) ? idOrView : BY_VIEW[idOrView]; return !id || !offList().includes(id); };
  App.moduleOf = view => MODULES.find(m => m.id === (BY_VIEW[view] || view)) || null;
  function setModules(off) { setSetting('modules', { off: [...new Set(off)].filter(id => MODULES.some(m => m.id === id)) }); refresh(); }
  App.setModule = (id, on) => { const off = offList().filter(x => x !== id); if (!on) off.push(id); setModules(off); };

  /* ---------- the sidebar's arrangement (shell.js) ---------- */
  const nav = () => Object.assign({ order: [], hidden: [], items: {}, place: {}, pinned: [], hide: [] }, settings().navLayout || {});
  const byOrder = (list, order, key = x => x) => { const at = id => { const i = (order || []).indexOf(id); return i < 0 ? 1e6 : i; }; return list.map((x, i) => [x, i]).sort((a, b) => (at(key(a[0])) - at(key(b[0]))) || (a[1] - b[1])).map(a => a[0]); };
  /** groups: [{ id, label, items: [[view, label]], subs: [{ id, label, items }] }] → the same, arranged, plus the pinned pages.
      `all` keeps hidden groups and pages, marked, for the Customize page. */
  App.arrangeSidebar = function (groups, all) {
    const L = nav(); const lists = []; groups.forEach(g => { lists.push(g); (g.subs || []).forEach(s => lists.push(s)); });
    const moved = {}; Object.entries(L.place || {}).forEach(([v, to]) => { if (lists.some(x => x.id === to)) moved[v] = to; });
    const pool = []; lists.forEach(x => x.items.forEach(it => pool.push([it[0], it[1], x.id])));
    const itemsOf = id => byOrder(pool.filter(([v, , from]) => (moved[v] || from) === id).map(([v, l]) => [v, l]), (L.items || {})[id], x => x[0])
      .filter(([v]) => all || (App.views[v] && App.moduleOn(v) && !L.hide.includes(v)));
    const out = byOrder(groups.map(g => Object.assign({}, g, { items: itemsOf(g.id), subs: (g.subs || []).map(s => Object.assign({}, s, { items: itemsOf(s.id) })), hidden: L.hidden.includes(g.id) })), L.order, g => g.id)
      .filter(g => all || !g.hidden);
    const pinned = (L.pinned || []).map(v => pool.find(p => p[0] === v)).filter(p => p && App.views[p[0]] && App.moduleOn(p[0])).map(([v, l]) => [v, l]);   // a pinned page shows at the top and stays in its group
    return { groups: out, pinned };
  };
  App.sideGroupOrder = ids => byOrder(ids, nav().order);
  App.sideGroupHidden = id => nav().hidden.includes(id);
  const setNav = patch => { setSetting('navLayout', Object.assign(nav(), patch)); refresh(); };

  /* ---------- every class's menu (app.js groupNav) ---------- */
  const cm = () => Object.assign({ order: [], items: {}, place: {}, hidden: [], per: {} }, settings().classMenu || {});
  /** groups: [{ label, items: [[view, label, icon]] }] for class `cid` → arranged; `all` keeps hidden pages, marked. */
  App.arrangeClassMenu = function (groups, cid, all) {
    const M = cm(); const labels = groups.map(g => g.label);
    const pool = []; groups.forEach(g => g.items.forEach(it => pool.push([it, g.label])));
    const hidden = new Set([...(M.hidden || []), ...((M.per || {})[cid] || [])]);
    const out = groups.map(g => ({ label: g.label, items: byOrder(pool.filter(([it, from]) => ((labels.includes((M.place || {})[it[0]]) && M.place[it[0]]) || from) === g.label).map(([it]) => it), (M.items || {})[g.label], x => x[0])
      .filter(it => all || (App.moduleOn(it[0]) && !hidden.has(it[0]) || ALWAYS.includes(it[0]))) }));
    return byOrder(out, M.order, g => g.label).filter(g => all || g.items.length);
  };
  const setCm = patch => { setSetting('classMenu', Object.assign(cm(), patch)); refresh(); };

  /* ---------- the look ---------- */
  const ACCENTS = [['default', 'StudyCat blue', '#1A64D6'], ['indigo', 'Indigo', '#4F46E5'], ['violet', 'Violet', '#7C3AED'], ['pink', 'Pink', '#DB2777'], ['red', 'Red', '#DC2626'], ['orange', 'Orange', '#EA580C'], ['amber', 'Amber', '#B45309'], ['green', 'Green', '#15803D'], ['teal', 'Teal', '#0F766E'], ['slate', 'Slate', '#334155']];
  const TEXT = [['sm', 'Smaller'], ['md', 'Normal'], ['lg', 'Larger'], ['xl', 'Largest']];
  const DENSITY = [['compact', 'Compact'], ['cozy', 'Comfortable'], ['roomy', 'Roomy']];
  const RADIUS = [['square', 'Square'], ['soft', 'Soft'], ['round', 'Round']];
  const FONTS = [['default', 'StudyCat'], ['system', 'Your device’s'], ['readable', 'Easy to read'], ['serif', 'Book']];
  const PARTS = [['now', 'Date, clock and how far through the term (sidebar)'], ['quick', 'The New button and shortcuts (sidebar)'], ['cal', 'Month calendar (sidebar)'], ['pomo', 'Focus timer (sidebar)'], ['clock', 'Clock (header)'], ['exam', 'Next exam (header)'], ['sounds', 'Sounds button (header)'], ['lang', 'Language button (header)']];
  const look = () => Object.assign({ accent: 'default', accentAll: false, text: 'md', density: 'cozy', radius: 'soft', font: 'default', hide: [] }, settings().look || {});
  function applyLook() {
    const L = look(); const h = document.documentElement;
    const set = (k, v, dflt) => { if (v && v !== dflt) h.setAttribute(k, v); else h.removeAttribute(k); };
    set('data-accent', ACCENTS.some(a => a[0] === L.accent) ? L.accent : '', 'default'); if (L.accentAll && L.accent !== 'default') h.setAttribute('data-accent-all', ''); else h.removeAttribute('data-accent-all');
    set('data-text', L.text, 'md'); set('data-density', L.density, 'cozy'); set('data-radius', L.radius, 'soft'); set('data-font', L.font, 'default');
    set('data-hide', (L.hide || []).filter(p => PARTS.some(x => x[0] === p)).join(' '), '');
    h.toggleAttribute('data-calm', !App.moduleOn('celebrate'));
  }
  App.applyLook = applyLook; App.lookOf = look;
  const setLook = patch => { setSetting('look', Object.assign(look(), patch)); applyLook(); };
  applyLook(); document.addEventListener('DOMContentLoaded', applyLook);

  /* ---------- where opening StudyCat lands ---------- */
  const entry = location.hash.replace(/^#\/?/, '');
  let started = false; try { started = sessionStorage.getItem('mh-started') === '1'; sessionStorage.setItem('mh-started', '1'); } catch (e) {}
  /** Called by the router before the start page draws: a start page other than home, once, when StudyCat was opened at its root. */
  App.startRedirect = function () {
    if (started || entry) return false; started = true; const sp = settings().startPage || 'home'; if (sp === 'home') return false;
    const hash = sp.startsWith('class:') ? (global.Courses[sp.slice(6)] ? `#/${sp.slice(6)}/dashboard` : '') : (App.views[sp] && App.moduleOn(sp) ? '#/' + sp : '');
    if (!hash) return false; try { history.replaceState(null, '', hash); } catch (e) { location.hash = hash; return true; } return true;
  };

  /* ---------- after a change: the menus and the open page follow ---------- */
  function refresh() {
    applyLook();
    try { if (App.rebuildNav) App.rebuildNav(); } catch (e) {}
    try { if (App.paintSidebar) App.paintSidebar(); } catch (e) {}
    if (App.searchReset) App.searchReset();
  }
  App.customizeRefresh = refresh;

  /* ---------- a page whose module is off ---------- */
  App.views.off = {
    title: 'Turned off',
    render(root, param) {
      const m = App.moduleOf(param); const name = m ? t(m.label) : t('This page');
      root.innerHTML = `<div class="landing-wrap cz-off"><div class="panel cz-off-card"><span class="cz-off-ic" aria-hidden="true">${icon(vi(param) || 'sliders', 30)}</span><h1 class="page-title">${esc(t('{1} is turned off', name))}</h1>${m ? `<p class="muted">${esc(t(m.desc))}</p>` : ''}<p class="small muted">${esc(t('You turned it off in Customize, so it is out of your menus. Turn it back on any time.'))}</p>
        <div class="row gap-sm" style="flex-wrap:wrap"><button class="btn primary" type="button" data-action="cz-on">${icon('check', 15)} ${esc(t('Turn it on'))}</button><a class="btn" href="#/customize">${icon(vi('customize'), 15)} ${esc(t('Customize'))}</a><a class="btn ghost" href="#/">${icon('home', 15)} ${esc(t('Home'))}</a></div></div></div>`;
      bind(root, { 'cz-on': () => { if (m) App.setModule(m.id, true); toast(t('{1} is on again', name)); global.dispatchEvent(new HashChangeEvent('hashchange')); } });
    }
  };

  /* ---------- the Customize page ---------- */
  const TABS = [['features', 'Features', 'grid'], ['sidebar', 'Sidebar', 'menu'], ['classes', 'Class menus', 'book'], ['look', 'Look', 'sun'], ['start', 'Start & backup', 'download']];
  const sw = (id, on, label, extra = '') => `<label class="cz-switch"><input type="checkbox" role="switch" ${id}${on ? ' checked' : ''}${extra}><span class="cz-track" aria-hidden="true"></span><span class="sr-only">${esc(label)}</span></label>`;
  const arrows = (kind, id, i, n, label) => `<span class="cz-arrows"><button type="button" class="icon-btn xs" data-action="cz-move" data-kind="${kind}" data-id="${esc(id)}" data-d="-1" aria-label="${esc(t('Move {1} up', label))}"${i === 0 ? ' disabled' : ''}>${icon('up', 13)}</button><button type="button" class="icon-btn xs" data-action="cz-move" data-kind="${kind}" data-id="${esc(id)}" data-d="1" aria-label="${esc(t('Move {1} down', label))}"${i === n - 1 ? ' disabled' : ''}>${icon('down', 13)}</button></span>`;
  const choice = (name, opts, cur, cls = '') => `<div class="cz-choice ${cls}" role="radiogroup" aria-label="${esc(t(name))}">${opts.map(([v, l, c]) => `<button type="button" class="cz-opt${v === cur ? ' on' : ''}" role="radio" aria-checked="${v === cur}" data-action="cz-look" data-k="${esc(name)}" data-v="${esc(v)}">${c ? `<i class="cz-dot" style="background:${c}"></i>` : ''}<span>${esc(t(l))}</span></button>`).join('')}</div>`;

  function featuresHtml() {
    const off = offList();
    return `<div class="cz-presets">${PRESETS.map(([k, l, d]) => `<button type="button" class="cz-preset" data-action="cz-preset" data-p="${k}"><b>${esc(t(l))}</b><small>${esc(t(d))}</small></button>`).join('')}</div>
      <p class="small muted cz-note">${icon('lock', 13)} ${esc(t('Always on: home, each class’s overview, lessons and syllabus, Settings and this page.'))}</p>
      ${GROUPS.map(([g, gl]) => { const ms = MODULES.filter(m => m.g === g); return `<section class="panel cz-sec" aria-labelledby="cz-g-${g}"><div class="panel-h"><h2 class="panel-title" id="cz-g-${g}">${esc(t(gl))}</h2><span class="small muted">${esc(t('{1} of {2} on', ms.filter(m => !off.includes(m.id)).length, ms.length))}</span></div>
        <ul class="cz-list">${ms.map(m => `<li class="cz-row${off.includes(m.id) ? ' is-off' : ''}"><span class="cz-ic" aria-hidden="true">${icon(m.views[0] ? vi(m.views[0]) : ({ bofloat: 'chat', presence: 'users', celebrate: 'sparkle' }[m.id] || 'sliders'), 17)}</span><span class="cz-t"><b id="cz-m-${m.id}">${esc(t(m.label))}</b><small>${esc(t(m.desc))}</small></span>${sw(`data-mod="${m.id}" aria-labelledby="cz-m-${m.id}"`, !off.includes(m.id), m.label)}</li>`).join('')}</ul></section>`; }).join('')}`;
  }
  function sidebarHtml() {
    const S = App.shellGroups || []; const L = nav(); const A = App.arrangeSidebar(S, true);
    const lists = []; A.groups.forEach(g => { lists.push([g.id, g.label]); (g.subs || []).forEach(s => lists.push([s.id, s.label])); });
    const home = {}; A.groups.forEach(g => { g.items.forEach(it => { home[it[0]] = g.id; }); (g.subs || []).forEach(s => s.items.forEach(it => { home[it[0]] = s.id; })); });
    const row = (v, l, i, n) => { const on = App.views[v] && App.moduleOn(v); const shown = !L.hide.includes(v); const pin = L.pinned.includes(v); const from = [home[v]]; return `<li class="cz-row${on ? '' : ' is-off'}${shown ? '' : ' is-hidden'}"><span class="cz-ic" aria-hidden="true">${icon(vi(v), 16)}</span><span class="cz-t"><b id="cz-s-${esc(v)}">${esc(t(l))}</b>${on ? '' : `<small>${esc(t('Turned off in Features'))}</small>`}</span>
        ${arrows('side', v, i, n, t(l))}<select class="select xs cz-place" data-place="${esc(v)}" aria-label="${esc(t('Group for {1}', t(l)))}">${lists.map(([id, gl]) => `<option value="${id}"${from && from[0] === id ? ' selected' : ''}>${esc(t(gl))}</option>`).join('')}</select>
        <button type="button" class="icon-btn xs cz-pin${pin ? ' on' : ''}" data-action="cz-pin" data-id="${esc(v)}" aria-pressed="${pin}" aria-label="${esc(pin ? t('Unpin {1}', t(l)) : t('Pin {1} to the top', t(l)))}">${icon('pin', 13)}</button>${sw(`data-sidehide="${esc(v)}" aria-labelledby="cz-s-${esc(v)}"`, shown, l)}</li>`; };
    const list = (id, items) => `<ul class="cz-list" data-list="${id}">${items.map(([v, l], i) => row(v, l, i, items.length)).join('') || `<li class="small muted cz-empty">${esc(t('Nothing here yet'))}</li>`}</ul>`;
    const fixed = [['classes', 'Your classes']];
    const order = App.sideGroupOrder(fixed.map(x => x[0]).concat(A.groups.map(g => g.id)));
    const gs = order.map(id => fixed.find(x => x[0] === id) ? { id, label: 'Your classes', items: null } : A.groups.find(g => g.id === id)).filter(Boolean);
    return `<p class="small muted cz-note">${esc(t('Arrange the sidebar: move groups and pages, pin pages to the top, hide what you do not use. Hidden pages stay on the Tools page and in search.'))}</p>
      ${L.pinned.length ? `<section class="panel cz-sec"><div class="panel-h"><h2 class="panel-title">${icon('pin')} ${esc(t('Pinned'))}</h2></div><ul class="cz-list">${L.pinned.map(v => { const it = (App.arrangeSidebar(S, true).groups.flatMap(g => g.items.concat(...(g.subs || []).map(s => s.items)))).find(x => x[0] === v); return it ? `<li class="cz-row"><span class="cz-ic" aria-hidden="true">${icon(vi(v), 16)}</span><span class="cz-t"><b>${esc(t(it[1]))}</b></span><button type="button" class="btn xs" data-action="cz-pin" data-id="${esc(v)}">${esc(t('Unpin'))}</button></li>` : ''; }).join('')}</ul></section>` : ''}
      ${gs.map((g, gi) => `<section class="panel cz-sec${App.sideGroupHidden(g.id) ? ' is-hidden' : ''}"><div class="panel-h"><h2 class="panel-title" id="cz-sg-${g.id}">${esc(t(g.label))}</h2><span class="row gap-sm">${arrows('group', g.id, gi, gs.length, t(g.label))}${sw(`data-grouphide="${g.id}" aria-labelledby="cz-sg-${g.id}"`, !App.sideGroupHidden(g.id), g.label)}</span></div>
        ${g.items ? list(g.id, g.items) + (g.subs || []).map(s => `<h3 class="cz-sub">${esc(t(s.label))}</h3>${list(s.id, s.items)}`).join('') : `<p class="small muted">${esc(t('Your classes, in the order you picked them.'))} <a href="#/settings">${esc(t('Choose classes'))}</a></p>`}</section>`).join('')}
      <button type="button" class="btn ghost" data-action="cz-reset" data-what="navLayout">${icon('rotate', 14)} ${esc(t('Reset the sidebar'))}</button>`;
  }
  let scope = 'all';
  function classesHtml() {
    const mine = App.myCourses().filter(id => global.Courses[id]); if (scope !== 'all' && !mine.includes(scope)) scope = 'all';
    const C = scope !== 'all' ? global.Courses[scope] : (App.D || global.Courses[mine[0]]); const M = cm();
    const base = C && C.NAV && App.groupNavBase ? App.groupNavBase(C.NAV) : [];
    const groups = App.arrangeClassMenu(base, scope === 'all' ? '' : scope, true); const labels = groups.map(g => g.label);
    const hid = new Set(scope === 'all' ? M.hidden : ((M.per || {})[scope] || []));
    const row = (it, i, n, gl) => { const [v, l] = it; const fixed = ALWAYS.includes(v); const on = App.moduleOn(v); const shown = !hid.has(v); return `<li class="cz-row${on ? '' : ' is-off'}${shown ? '' : ' is-hidden'}"><span class="cz-ic" aria-hidden="true">${icon(vi(v), 16)}</span><span class="cz-t"><b id="cz-c-${esc(v)}">${esc(t(l))}</b>${on ? '' : `<small>${esc(t('Turned off in Features'))}</small>`}</span>
      ${arrows('class', v, i, n, t(l))}<select class="select xs cz-cplace" data-cplace="${esc(v)}" aria-label="${esc(t('Group for {1}', t(l)))}">${labels.map(x => `<option value="${esc(x)}"${x === gl ? ' selected' : ''}>${esc(t(x))}</option>`).join('')}</select>${fixed ? `<span class="small muted cz-always">${esc(t('Always on'))}</span>` : sw(`data-classhide="${esc(v)}" aria-labelledby="cz-c-${esc(v)}"`, shown, l)}</li>`; };
    return `<div class="field cz-scope"><label for="cz-scope">${esc(t('Which classes'))}</label><select class="select" id="cz-scope"><option value="all">${esc(t('Every class'))}</option>${mine.map(id => `<option value="${esc(id)}"${scope === id ? ' selected' : ''} translate="no">${esc(global.Courses[id].short || id)}</option>`).join('')}</select></div>
      <p class="small muted cz-note">${esc(scope === 'all' ? t('The order and groups apply to every class. Showing or hiding here applies to every class; pick one class to hide pages in it alone.') : t('Showing or hiding here applies to this class only. The order and groups are the same in every class.'))}</p>
      ${C ? groups.map((g, gi) => `<section class="panel cz-sec"><div class="panel-h"><h2 class="panel-title">${esc(t(g.label))}</h2>${arrows('cgroup', g.label, gi, groups.length, t(g.label))}</div><ul class="cz-list">${g.items.map((it, i) => row(it, i, g.items.length, g.label)).join('') || `<li class="small muted cz-empty">${esc(t('Nothing here yet'))}</li>`}</ul></section>`).join('') : `<p class="muted">${esc(t('Pick your classes first.'))} <a href="#/settings">${esc(t('Choose classes'))}</a></p>`}
      <button type="button" class="btn ghost" data-action="cz-reset" data-what="classMenu">${icon('rotate', 14)} ${esc(t('Reset the class menus'))}</button>`;
  }
  function lookHtml() {
    const L = look(); const s = settings();
    const field = (h, body, sub = '') => `<section class="cz-field"><h3 class="cz-h">${esc(t(h))}</h3>${sub ? `<p class="small muted">${esc(t(sub))}</p>` : ''}${body}</section>`;
    return `<div class="panel cz-sec cz-look">
      ${field('Theme', choice('theme', [['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], s.theme || 'system'))}
      ${App.SKINS ? field('Style', `<div class="cz-skins">${App.SKINS.map(([id, name, sub, [bg, ac]]) => `<button type="button" class="cz-skin${(App.skinOf ? App.skinOf() : 'default') === id ? ' on' : ''}" data-action="cz-skin" data-v="${esc(id)}" aria-pressed="${(App.skinOf ? App.skinOf() : 'default') === id}"><span class="cz-skin-sw" style="background:${bg}"><i style="background:${ac}"></i></span><b>${esc(t(name))}</b><small>${esc(t(sub))}</small></button>`).join('')}</div>`) : ''}
      ${field('Accent colour', choice('accent', ACCENTS, L.accent, 'cz-accents') + `<label class="check mt-1" style="padding:0"><input type="checkbox" id="cz-accent-all"${L.accentAll ? ' checked' : ''}><span>${esc(t('Use it inside classes too, instead of each class’s own colour'))}</span></label>`)}
      ${field('Text size', choice('text', TEXT, L.text))}
      ${field('Spacing', choice('density', DENSITY, L.density))}
      ${field('Corners', choice('radius', RADIUS, L.radius))}
      ${field('Font', choice('font', FONTS, L.font))}
      ${field('Motion', choice('motion', [['on', 'Full'], ['off', 'Reduced']], s.motion === 'off' ? 'off' : 'on'), 'Reduced turns off animations and transitions.')}
      ${field('Animated background', choice('livebg', [['off', 'Off'], ['on', 'On']], s.liveBg === true ? 'on' : 'off'))}
      ${field('On the screen', `<ul class="cz-list cz-parts">${PARTS.map(([k, l]) => `<li class="cz-row"><span class="cz-t"><b id="cz-p-${k}">${esc(t(l))}</b></span>${sw(`data-part="${k}" aria-labelledby="cz-p-${k}"`, !(L.hide || []).includes(k), l)}</li>`).join('')}</ul>`)}
      <button type="button" class="btn ghost" data-action="cz-reset" data-what="look">${icon('rotate', 14)} ${esc(t('Reset the look'))}</button></div>`;
  }
  function startHtml() {
    const sp = settings().startPage || 'home'; const mine = App.myCourses().filter(id => global.Courses[id]);
    const opts = [['home', 'Home'], ['today', 'Today'], ['tutor', 'Ask Bo'], ['agenda', 'Calendar'], ['tasks', 'Tasks']].filter(([v]) => v === 'home' || App.moduleOn(v)).concat(mine.map(id => ['class:' + id, global.Courses[id].short || id]));
    return `<section class="panel cz-sec"><div class="panel-h"><h2 class="panel-title">${icon('home')} ${esc(t('When you open StudyCat'))}</h2></div><div class="field"><label for="cz-start">${esc(t('Open on'))}</label><select class="select" id="cz-start">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === sp ? ' selected' : ''}>${esc(t(l))}</option>`).join('')}</select></div></section>
      <section class="panel cz-sec"><div class="panel-h"><h2 class="panel-title">${icon('download')} ${esc(t('Back up or move your setup'))}</h2></div><p class="small muted">${esc(t('Your features, menus and look in one file, to keep or to load on another account.'))}</p>
        <div class="row gap-sm" style="flex-wrap:wrap"><button type="button" class="btn" data-action="cz-export">${icon('download', 14)} ${esc(t('Download my setup'))}</button><label class="btn cz-import">${icon('upload', 14)} ${esc(t('Load a setup'))}<input type="file" id="cz-import" accept="application/json,.json" class="sr-only"></label></div></section>
      <section class="panel cz-sec"><div class="panel-h"><h2 class="panel-title">${icon('rotate')} ${esc(t('Start over'))}</h2></div><p class="small muted">${esc(t('Every feature on, the menus and the look as they came.'))}</p><button type="button" class="btn danger" data-action="cz-reset" data-what="all">${icon('rotate', 14)} ${esc(t('Reset everything'))}</button></section>`;
  }
  const KEYS = ['modules', 'navLayout', 'classMenu', 'look', 'startPage'];
  const AS_CAME = { modules: { off: [] }, navLayout: {}, classMenu: {}, look: {}, startPage: 'home' };   // written out (not deleted) so other devices take the reset too
  App.views.customize = {
    title: 'Customize', blurb: 'Make StudyCat yours: turn features on or off, arrange the sidebar and every class’s menu, and change the look. It is saved with your account.',
    render(root, param, query, standalone) {
      const head = App.pageHead(t('Customize StudyCat'), t(this.blurb));
      root.innerHTML = `<div class="${standalone ? 'landing-wrap ' : ''}cz-wrap">${head}<div class="dash-tabs" data-store="customizeTab" role="tablist">${TABS.map(([k, l, ic]) => `<button class="tab" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${esc(t(l))}</span></button>`).join('')}</div><div class="panes">${TABS.map(([k]) => `<div class="pane" data-pane="${k}" role="tabpanel"></div>`).join('')}</div></div>`;
      if (param && TABS.some(x => x[0] === param)) setSetting('customizeTab', param);
      this.paint(root); this.wire(root);
    },
    paint(root, only) {
      const html = { features: featuresHtml, sidebar: sidebarHtml, classes: classesHtml, look: lookHtml, start: startHtml };
      Object.keys(html).forEach(k => { if (only && !only.includes(k)) return; const pane = $(`.pane[data-pane="${k}"]`, root); if (pane) pane.innerHTML = html[k](); });
    },
    wire(root) {
      const again = (...k) => { const y = global.scrollY; const f = document.activeElement && document.activeElement.closest('[data-action],[data-mod],[data-sidehide],[data-grouphide],[data-classhide],[data-part]'); const sel = f ? ['data-mod', 'data-sidehide', 'data-grouphide', 'data-classhide', 'data-part', 'data-id'].map(a => f.getAttribute(a) != null ? `[${a}="${f.getAttribute(a)}"]` : '').join('') + (f.dataset.d ? `[data-d="${f.dataset.d}"]` : '') + (f.dataset.action ? `[data-action="${f.dataset.action}"]` : '') : ''; this.paint(root, k.length ? k : null); global.scrollTo(0, y); if (sel) { const n = $(sel, root); if (n && !n.disabled) n.focus(); } };
      const move = (list, id, d) => { const i = list.indexOf(id); const j = i + d; if (i < 0 || j < 0 || j >= list.length) return list; const out = list.slice(); out.splice(i, 1); out.splice(j, 0, id); return out; };
      root.addEventListener('change', e => {
        const x = e.target;
        if (x.dataset.mod) { App.setModule(x.dataset.mod, x.checked); again(); return; }
        if (x.dataset.sidehide) { const L = nav(); setNav({ hide: x.checked ? L.hide.filter(v => v !== x.dataset.sidehide) : L.hide.concat(x.dataset.sidehide) }); again('sidebar'); return; }
        if (x.dataset.grouphide) { const L = nav(); setNav({ hidden: x.checked ? L.hidden.filter(v => v !== x.dataset.grouphide) : L.hidden.concat(x.dataset.grouphide) }); again('sidebar'); return; }
        if (x.dataset.place) { const L = nav(); setNav({ place: Object.assign({}, L.place, { [x.dataset.place]: x.value }) }); again('sidebar'); return; }
        if (x.dataset.classhide) { const M = cm(); const v = x.dataset.classhide; if (scope === 'all') setCm({ hidden: x.checked ? M.hidden.filter(y => y !== v) : M.hidden.concat(v) }); else { const per = Object.assign({}, M.per); const l = per[scope] || []; per[scope] = x.checked ? l.filter(y => y !== v) : l.concat(v); setCm({ per }); } again('classes'); return; }
        if (x.dataset.cplace) { const M = cm(); setCm({ place: Object.assign({}, M.place, { [x.dataset.cplace]: x.value }) }); again('classes'); return; }
        if (x.dataset.part) { const L = look(); setLook({ hide: x.checked ? L.hide.filter(p => p !== x.dataset.part) : L.hide.concat(x.dataset.part) }); return; }
        if (x.id === 'cz-scope') { scope = x.value; again('classes'); return; }
        if (x.id === 'cz-accent-all') { setLook({ accentAll: x.checked }); return; }
        if (x.id === 'cz-start') { setSetting('startPage', x.value); toast(t('StudyCat will open there next time')); return; }
        if (x.id === 'cz-import' && x.files && x.files[0]) { const f = x.files[0]; f.text().then(txt => { let j; try { j = JSON.parse(txt); } catch (err) { toast(t('That file is not a StudyCat setup.')); return; } if (!j || j.mathubSetup !== 1) { toast(t('That file is not a StudyCat setup.')); return; } KEYS.forEach(k => { if (j[k] !== undefined && j[k] !== null && (typeof j[k] === 'object' || typeof j[k] === 'string')) setSetting(k, j[k]); }); refresh(); again(); toast(t('Setup loaded')); }); x.value = ''; }
      });
      bind(root, {
        'cz-preset': b => { const p = PRESETS.find(x => x[0] === b.dataset.p); if (p) { setModules(p[3]); again(); toast(t('{1}: done', t(p[1]))); } },
        'cz-move': b => {
          const { kind, id } = b.dataset; const d = +b.dataset.d;
          if (kind === 'group') { const ids = App.sideGroupOrder(['classes'].concat((App.shellGroups || []).map(g => g.id))); setNav({ order: move(ids, id, d) }); again('sidebar'); return; }
          if (kind === 'side') { const A = App.arrangeSidebar(App.shellGroups || [], true); const lists = []; A.groups.forEach(g => { lists.push(g); (g.subs || []).forEach(s => lists.push(s)); }); const l = lists.find(x => x.items.some(it => it[0] === id)); if (!l) return; const L = nav(); setNav({ items: Object.assign({}, L.items, { [l.id]: move(l.items.map(it => it[0]), id, d) }) }); again('sidebar'); return; }
          const C = scope !== 'all' ? global.Courses[scope] : (App.D || global.Courses[App.myCourses()[0]]); const groups = App.arrangeClassMenu(C && C.NAV && App.groupNavBase ? App.groupNavBase(C.NAV) : [], '', true); const M = cm();
          if (kind === 'cgroup') { setCm({ order: move(groups.map(g => g.label), id, d) }); again('classes'); return; }
          if (kind === 'class') { const g = groups.find(x => x.items.some(it => it[0] === id)); if (!g) return; setCm({ items: Object.assign({}, M.items, { [g.label]: move(g.items.map(it => it[0]), id, d) }) }); again('classes'); }
        },
        'cz-pin': b => { const L = nav(); const v = b.dataset.id; setNav({ pinned: L.pinned.includes(v) ? L.pinned.filter(x => x !== v) : L.pinned.concat(v) }); again('sidebar'); },
        'cz-look': b => {
          const { k, v } = b.dataset;
          if (k === 'theme') { setSetting('theme', v); if (App.applyTheme) App.applyTheme(); }
          else if (k === 'motion') { setSetting('motion', v === 'off' ? 'off' : 'on'); if (App.applyMotion) App.applyMotion(); }
          else if (k === 'livebg') { setSetting('liveBg', v === 'on'); if (App.liveBg && App.liveBg.apply) App.liveBg.apply(); }
          else setLook({ [k]: v });
          again('look');
        },
        'cz-skin': b => { setSetting('skin', b.dataset.v); if (App.applySkin) App.applySkin(); if (App.applyTheme) App.applyTheme(); again('look'); },
        'cz-export': () => { const out = { mathubSetup: 1, saved: new Date().toISOString() }; const s = settings(); KEYS.forEach(k => { if (s[k] !== undefined) out[k] = s[k]; }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = 'mathub-setup.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); },
        'cz-reset': b => {
          const w = b.dataset.what; if (w === 'all' && !confirm(t('Turn every feature back on and put the menus and the look back as they came?'))) return;
          (w === 'all' ? KEYS : [w]).forEach(k => setSetting(k, AS_CAME[k])); refresh(); again(); toast(t('Back as it came'));
        }
      });
    }
  };
})(window);
