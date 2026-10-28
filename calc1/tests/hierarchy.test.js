/* The site's structure (revamp, October 2026).
   - Nine features are gone for good: Docs, Slides and Sheets (Office), the class grade calculator, office-hours prep,
     Blitz, the cheat sheet, the scratchpad, study sessions, mock exams and contributions. Their pages are not found
     (an old link inside a class opens the class), their files are not shipped or cached, and their routes answer 404.
   - The sidebar reads top to bottom: Home and Ask Bo, Your classes, Planner, Tools (the study tools, then Life and
     Future), Community and Resources. Inside a class its own menu is Learn, Practice, Plan, Explore and Class.
   - Every page has one icon of its own: no two pages in the sidebar, a class's menu or the account menu share one
     (the Study planner and the Learning path in particular), and the one icon follows the page everywhere.
   - The account menu holds the account only: no Today, Focus room, Character sheet or GPA calculator.
   - A class's syllabus page shows how the grade is made (it used to live in the grade calculator). */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const { mk, go, login, api, check, hscroll } = await T.start();

  /* ---------- gone from the files ---------- */
  const GONE = ['office.js', 'office-docs.js', 'office-slides.js', 'office-sheets.js', 'office-chart.js', 'office-formula.js', 'office-ooxml.js', 'office-pptx.js', 'office-xlsx.js', 'office.css', 'blitz.js', 'cheatsheet.js'];
  check('the removed features’ files are deleted', GONE.every(f => !fs.existsSync(path.join(ROOT, 'assets', f))) && !fs.existsSync(path.join(ROOT, 'api', 'office.php')));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  check('and neither loaded by the page nor cached by the service worker', GONE.every(f => !html.includes('assets/' + f) && !sw.includes("'assets/" + f + "'")));
  check('the slide reader the learning tools need stays', html.includes('assets/officekit.js') && fs.existsSync(path.join(ROOT, 'assets', 'officekit.js')));

  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(p, '#/', 1200);

  /* ---------- gone from the site ---------- */
  const found = [];
  for (const h of ['#/docs', '#/decks', '#/sheets', '#/meet', '#/mock', '#/badges']) { await go(p, h, 700); if (!(await p.evaluate(() => App.current === App.views.notfound))) found.push(h); }
  check('their pages are not found', found.length === 0, found);
  const kept = [];   // an old link inside a class still lands somewhere useful: the class's overview
  for (const h of ['#/calc/grades', '#/calc/blitz', '#/calc/cheatsheet', '#/calc/scratchpad', '#/calc/officehours', '#/calc/contribute', '#/calc/mock', '#/calc/meet']) { await go(p, h, 900); if (!(await p.evaluate(() => App.current === App.views.dashboard))) kept.push(h); }
  check('an old link to one inside a class opens the class overview', kept.length === 0, kept);
  const views = await p.evaluate(() => ['docs', 'decks', 'sheets', 'grades', 'blitz', 'cheatsheet', 'scratchpad', 'officehours', 'meet', 'mock', 'contribute', 'badges'].filter(v => App.views[v]));
  check('and no page is registered for them', views.length === 0, views);
  await login(p, 'alice.a@montana.edu');
  const routes = [];
  for (const [r, b] of [['office_list'], ['meet_list&course=all'], ['mock_list&course=all'], ['contrib_list&course=calc&kind=card'], ['contrib_queue'], ['mock_official', { course: 'calc' }], ['learn_officehours', { class: 'calc', stuck: 'limits' }]]) { const x = await api(p, r, b); if (x.status !== 404) routes.push(r + ' → ' + x.status); }
  check('their server routes answer 404', routes.length === 0, routes);
  /* badges are gone too: no route, no page, no award after a post or a challenge, nothing on the People page */
  check('badges are gone from the server', (await api(p, 'badges', {})).status === 404 && (await api(p, 'admin_badges&user_id=1')).status === 404);
  const ppl = await api(p, 'people&sort=helpful');
  check('the People page lists members without badges', ppl.status === 200 && Array.isArray(ppl.json.people) && ppl.json.people.length > 0 && ppl.json.people.every(x => x.badges === undefined) && ppl.json.catalog === undefined, ppl.json && ppl.json.people && ppl.json.people[0]);

  /* ---------- the sidebar ---------- */
  await p.reload(); await go(p, '#/', 1400); if (await p.$('.celebrate')) await p.keyboard.press('Escape');
  const side = await p.evaluate(() => ({
    top: [...document.querySelectorAll('#sb-nav > .sb-top-items:first-child .nav-item')].map(a => a.dataset.sv),
    groups: [...document.querySelectorAll('#sb-nav .sb-group')].map(g => ({ id: g.dataset.g, label: g.querySelector('.nav-toggle span').textContent, subs: [...g.querySelectorAll('.sb-sub-h')].map(x => x.textContent), items: [...g.querySelectorAll('.sb-item')].map(a => a.dataset.sv) })),
    icons: [...document.querySelectorAll('#sb-nav .sb-item')].map(a => [a.dataset.sv, (a.querySelector('svg') || {}).innerHTML || ''])
  }));
  check('the sidebar opens with Home and Ask Bo', side.top.join() === 'home,tutor', side.top);
  check('then Your classes, Planner, Tools, Community and Resources', side.groups.map(g => g.label).join() === 'Your classes,Planner,Tools,Community,Resources', side.groups.map(g => g.label));
  const G = id => side.groups.find(g => g.id === id) || { items: [], subs: [] };
  check('Planner has Today, tasks, calendars, time and the Focus room', ['today', 'tasks', 'agenda', 'timetable', 'timelog', 'projects', 'focus'].every(v => G('plan').items.includes(v)), G('plan').items);
  check('Tools holds the study tools, the GPA calculator, then Life and Future', G('tools').subs.join() === 'Life,Future' && ['tools', 'gpa', 'habits', 'goals', 'wheel', 'journal', 'money', 'career', 'portfolio'].every(v => G('tools').items.includes(v)), G('tools'));
  check('there is no Life, Future, School, Office or Explore group any more', !side.groups.some(g => ['life', 'future', 'school', 'office', 'explore'].includes(g.id)));
  const seen = {}; const dupS = []; side.icons.forEach(([v, svg]) => { if (v === 'tutor') return; if (seen[svg] && seen[svg] !== v) dupS.push(seen[svg] + ' = ' + v); seen[svg] = v; });
  check('every page in the sidebar has an icon of its own', side.icons.length >= 22 && dupS.length === 0, dupS);

  /* ---------- the account menu ---------- */
  await p.click('#topbar-account [data-action="acct-toggle"]'); await p.waitForTimeout(300);
  const menu = await p.evaluate(() => [...document.querySelectorAll('.pop-account .acct-dd-item')].map(a => [a.getAttribute('href') || a.dataset.action, a.textContent.trim(), (a.querySelector('svg') || {}).innerHTML || '']));
  check('the account menu holds the account: plan, usage, inbox, settings, Customize, what’s new, log out', ['#/plan', '#/usage', '#/customize', '#/whatsnew', 'landing-logout'].every(h => menu.some(m => m[0] === h)) && menu.some(m => /settings/.test(m[0])) && !menu.some(m => m[0] === '#/badges'), menu.map(m => m[0]));
  check('and not Today, the Focus room, the character sheet or the GPA calculator', !menu.some(m => ['#/today', '#/focus', '#/sheet', '#/gpa', '#/tools', '#/people', '#/resources', '#/recap'].includes(m[0])), menu.map(m => m[0]));
  check('its icons are all different', new Set(menu.map(m => m[2])).size === menu.length, menu.map(m => m[1]));
  await p.keyboard.press('Escape');

  /* ---------- a class's menu ---------- */
  for (const id of ['calc', 'physics', 'precalc', 'writ', 'csci']) {
    await go(p, `#/${id}/dashboard`, 1300);
    const m = await p.evaluate(() => ({ groups: [...document.querySelectorAll('#sidebar-nav .nav-toggle span')].map(x => x.textContent), items: [...document.querySelectorAll('#sidebar-nav .nav-item')].map(b => [b.dataset.view, (b.querySelector('svg') || {}).innerHTML || '']) }));
    const order = ['Learn', 'Practice', 'Plan', 'Explore', 'Class'];
    check(`${id}: the menu is Learn, Practice, Plan, Explore, Class (those it has, in that order)`, m.groups.length >= 3 && m.groups.every((g, i) => order.includes(g) && (i === 0 || order.indexOf(g) > order.indexOf(m.groups[i - 1]))), m.groups);
    const ic = {}; const dup = []; m.items.forEach(([v, svg]) => { if (ic[svg] && ic[svg] !== v) dup.push(ic[svg] + ' = ' + v); ic[svg] = v; });
    check(`${id}: every page in it has an icon of its own`, dup.length === 0, dup);
    const gone = m.items.map(x => x[0]).filter(v => ['grades', 'blitz', 'cheatsheet', 'scratchpad', 'officehours', 'meet', 'mock', 'contribute', 'gpa', 'leagues', 'people'].includes(v));
    check(`${id}: none of the removed pages, nor the site-wide ones, are in it`, gone.length === 0, gone);
  }
  await go(p, '#/calc/dashboard', 1200);
  const pp = await p.evaluate(() => { const svg = v => ((document.querySelector(`#sidebar-nav .nav-item[data-view="${v}"] svg`) || {}).innerHTML || ''); return { planner: svg('planner'), path: svg('path'), calendar: svg('calendar') }; });
  check('the Study planner and the Learning path look different (and the planner is not the calendar)', pp.planner && pp.path && pp.planner !== pp.path && pp.planner !== pp.calendar);
  const mapOk = await p.evaluate(() => { const V = App.VIEW_ICON; const by = {}; const dup = []; Object.entries(V).forEach(([v, ic]) => { if (by[ic] && !(['calendar', 'agenda'].includes(v) && ['calendar', 'agenda'].includes(by[ic]))) dup.push(by[ic] + ' = ' + v); by[ic] = v; }); const missing = Object.values(V).filter(ic => !App.ICONS[ic]); return { dup, missing }; });
  check('one icon per page across the site (only the two calendars share one), and every icon exists', mapOk.dup.length === 0 && mapOk.missing.length === 0, mapOk);

  /* ---------- grading on the syllabus page ---------- */
  await go(p, '#/calc/course', 1200);
  const gr = await p.evaluate(() => ({ rows: document.querySelectorAll('.grading-panel .grade-row').length, scale: document.querySelectorAll('.grading-panel .grade-scale tbody tr').length }));
  check('the syllabus page shows how the grade is made: the weights and the letter scale', gr.rows >= 8 && gr.scale >= 5, gr);
  await go(p, '#/m170/course', 1200);
  const g2 = await p.evaluate(() => ({ title: (document.querySelector('.grading-panel .panel-title') || {}).textContent || '', rows: document.querySelectorAll('.grading-panel .grade-row').length, text: (document.querySelector('.grading-panel') || {}).textContent || '' }));
  check('a class whose own Grading panel lists the weights gets the letter scale and rubric only', /Letter grades/.test(g2.title) && g2.rows === 0 && /Substantial/.test(g2.text), g2.title);

  /* ---------- phones ---------- */
  const [cm, m] = await mk(390, 800, { serviceWorkers: 'block' });
  for (const h of ['#/', '#/tools', '#/calc/course', '#/calc/dashboard']) { await go(m, h, 1000); check(`no sideways scroll on ${h} at 390px`, await hscroll(m)); }
  await cm.close(); await c.close();
  await T.finish();
})();
