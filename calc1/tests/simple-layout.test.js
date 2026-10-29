/* Simpler screens: the sidebar in five groups, a short start page (the hero, the steps on a first visit, and Your home: widgets the student arranges), the class dashboard with five tabs, a quiet top bar for newcomers, and the one-line preview note. */
const T = require('./lib');
(async () => {
  const { mk, go, log, check, hscroll } = await T.start({ freeHome: true });
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });

  // start page, first visit as a guest: first the question of which classes they take, then (once picked) the hero, the steps and the widgets
  await go(p, '#/', 1500);
  check('a brand-new visitor is asked which classes they take', await p.evaluate(() => !!document.querySelector('#pick-classes') && !document.querySelector('.start-steps')));
  const first = await p.evaluate(() => ({ widgets: document.querySelectorAll('#dash-canvas > .dw').length, story: !!document.querySelector('.mo-page'), bo: !!document.querySelector('.mo-page a[href="#/max"]'), guides: !!document.querySelector('.mo-page a[href="/learn/"]') }));   // a first visit, before any class is picked: the story of StudyCat (assets/start.js)
  const pick = pg => pg.evaluate(() => { const s = App.settings(); s.courses = ['calc', 'physics', 'writ', 'csci']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await pick(p); await p.reload(); await p.waitForTimeout(1500);
  const land = await p.evaluate(() => {
    const secs = [...document.querySelectorAll('.landing-wrap > .land-sec > .sec-title, .landing-wrap > .land-sec > .sec-h > .sec-title')].map(h => h.textContent.trim());
    const hero = [...document.querySelectorAll('.landing-top .hero-actions > *')].map(e => e.id || e.className.split(' ').filter(c => c !== 'btn' && c !== 'sm').join('.'));
    return { secs, hero, widgets: [...document.querySelectorAll('#dash-canvas > .dw')].map(w => w.dataset.w), bo: (document.querySelector('.dw[data-w="bo"] .land-bo') || {}).getAttribute ? document.querySelector('.dw[data-w="bo"] .land-bo').getAttribute('href') : '', steps: document.querySelectorAll('.start-steps .start-step').length, ticker: !!document.querySelector('#landing-ticker'), path: !!document.querySelector('#view .ap-li, #view .ah-pathsec'), rows: document.querySelectorAll('.dw[data-w="classes"] .dwk').length };
  });
  log('start page:', JSON.stringify(land));
  check('the start page is the hero, three steps and Your home: one section of widgets', land.secs.join('|') === 'Your home' && land.steps === 3, land.secs);
  check('a first visit gets the story of StudyCat instead of empty widgets, with Bo\'s demo and the guides; once picked, their rows', first.story && first.widgets === 0 && first.bo && first.guides && land.rows > 3, { first, rows: land.rows });
  check('the hero keeps Today and For professors; search, focus sounds, the account and the theme are in the header on every page', land.hero.length === 2 && /hero-today/.test(land.hero[0]) && land.hero[1] === 'hero-faculty', land.hero);
  check('visitors get one line on Bo that opens the one-minute demo', land.bo === '#/max', land.bo);
  check('no learning path and no scrolling ticker on the start page', !land.path && !land.ticker);

  // top bar and preview note on a class page
  await go(p, '#/calc', 1500);
  const top = await p.evaluate(() => { const b = document.querySelector('#preview-banner'); const vis = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }; return { bell: vis('#notif-btn'), hub: vis('#topbar-hub'), bannerBtns: b ? b.querySelectorAll('.btn').length : -1, signup: b ? !!b.querySelector('[data-action="b-signup"]') : false, hide: b ? !!b.querySelector('[data-action="b-hide"]') : false }; });
  check('guests do not see the inbox bell', !top.bell, top);
  check('newcomers do not see streak and XP widgets yet', !top.hub, top);
  check('the preview note is one line with a sign-up link and a close button', top.bannerBtns === 0 && top.signup && top.hide, top);
  await p.click('#preview-banner [data-action="b-hide"]'); await p.waitForTimeout(150); await p.reload(); await p.waitForTimeout(1200);
  check('closing the preview note sticks', !(await p.$('#preview-banner')));

  // sidebar: five groups, Learn, Practice and Plan open, every tool listed once
  const nav = await p.evaluate(() => ({ groups: [...document.querySelectorAll('#sidebar-nav .nav-label')].map(l => [l.dataset.g, l.classList.contains('open')]), items: [...document.querySelectorAll('#sidebar-nav .nav-item')].map(b => b.dataset.view), all: App.D.NAV.flatMap(g => g.items.map(x => x[0])) }));
  log('sidebar:', JSON.stringify(nav.groups));
  check('sidebar has five groups by intent', nav.groups.map(g => g[0]).join('|') === 'Learn|Practice|Plan|Explore|Class', nav.groups);
  check('only Learn, Practice and Plan start open', nav.groups.filter(g => g[1]).map(g => g[0]).join('|') === 'Learn|Practice|Plan', nav.groups);
  check('every tool appears exactly once', nav.items.length === new Set(nav.items).size && nav.all.every(id => nav.items.includes(id)), { items: nav.items.length, all: nav.all.length });

  // class dashboard: two panels up top, five tabs, readiness one click away
  const dash = await p.evaluate(() => ({ main: [...document.querySelectorAll('.dash-main > .panel .panel-title')].map(t => t.textContent.trim()), tabs: [...document.querySelectorAll('#view .dash-tabs .tab')].map(t => t.dataset.tab), coach: !!document.querySelector('#view .mascot-slot.coach'), readyShown: (() => { const r = document.querySelector('.ready-panel'); return !!r && !r.closest('.pane[hidden]'); })(), line: (document.querySelector('.hero-exam .ready-line') || {}).textContent || '', quests: !!document.querySelector('.pane[data-pane="progress"] .quests-slot'), league: !!document.querySelector('.pane[data-pane="progress"] .league-slot'), canvas: !!document.querySelector('.pane[data-pane="week"] #dash-canvas'), roll: !!document.querySelector('.page-actions [data-roll="calc"]') }));
  log('dashboard:', JSON.stringify(dash));
  check('dashboard opens on two panels: Today and Keep going', dash.main.length === 2 && /Today/.test(dash.main[0]) && /Keep going/.test(dash.main[1]), dash.main);
  check('five tabs: this week, readiness, progress, planner, community', dash.tabs.join(',') === 'week,ready,progress,plan,community', dash.tabs);
  check('no extra mascot on the dashboard, the d20 stays', !dash.coach && dash.roll, dash);
  check('the exam card sums up readiness in one line', /% ready/.test(dash.line) && /How to raise it/.test(dash.line), dash.line);
  check('quests and the league live in Progress, Canvas in This week', dash.quests && dash.league && dash.canvas, dash);
  await p.click('.ready-line [data-action="tab-ready"]'); await p.waitForTimeout(300);
  check('"How to raise it" opens the Readiness tab', await p.evaluate(() => { const r = document.querySelector('.ready-panel'); return !!r && !r.closest('.pane[hidden]') && document.querySelectorAll('.ready-tip').length === 3; }));
  await p.evaluate(() => App.setSetting('dashTab', 'week'));

  // after some studying the start page switches to "Your next step" and the widgets appear
  await p.evaluate(() => { App.addXP(10, { course: 'calc', silent: true }); const s = App.settings(); s.lastVisit = { hash: '#/calc/notes/1.3', label: 'Calc I · Notes', course: 'calc', t: Date.now() - 3600000 }; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await go(p, '#/', 1200);
  const back = await p.evaluate(() => ({ widgets: [...document.querySelectorAll('#dash-canvas > .dw')].map(w => w.dataset.w), steps: !!document.querySelector('.start-steps'), hub: (() => { const h = document.querySelector('#topbar .hub-slot'); return !!h && getComputedStyle(h).display !== 'none'; })() }));
  check('returning students get their home: Up next, Today and Bo first, no first-visit steps', back.widgets.slice(0, 3).join() === 'next,today,bo' && !back.steps, back);
  check('streak and XP widgets appear once there is something to show', back.hub, back);
  await c.close();

  // phones
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block' });
  await go(m, '#/', 600); await pick(m); await m.reload(); await m.waitForTimeout(1200); check('phone: start page does not scroll sideways', await hscroll(m));
  const cta = await m.evaluate(() => { const b = document.querySelector('.dwk[data-c="calc"]'); return !!b && b.scrollWidth <= b.clientWidth + 1; });
  check('phone: class buttons are not cut off', cta);
  await go(m, '#/calc', 1400); check('phone: dashboard does not scroll sideways', await hscroll(m));
  await cm.close();
  await T.finish();
})();
