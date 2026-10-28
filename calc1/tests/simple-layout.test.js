/* Simpler screens: the sidebar in five groups, a short start page (hero, Bo, classes and the next step, Your day, the rest folded under More to explore; a first visit sees its classes before the steps), short class cards, the class dashboard with five tabs, a quiet top bar for newcomers, and the one-line preview note. */
const T = require('./lib');
(async () => {
  const { mk, go, log, check, hscroll } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });

  // start page, first visit as a guest
  await go(p, '#/', 1200);
  const land = await p.evaluate(() => {
    const secs = [...document.querySelectorAll('.landing-wrap > .land-sec > .sec-title, .landing-wrap > .land-sec > .sec-h > .sec-title, .landing-wrap > .land-more .sec-title')].map(h => h.textContent.trim());
    const hero = [...document.querySelectorAll('.landing-top .hero-actions > *')].map(e => e.id || e.className.split(' ').filter(c => c !== 'btn' && c !== 'sm').join('.'));
    const card = document.querySelector('.course-card.calc'); const more = document.querySelector('#land-more');
    return { secs, hero, quick: !!document.querySelector('.quick-row, .land-next .hero-focus, .land-next [data-roll="all"]'), bo: (document.querySelector('.landing-wrap > .land-bo') || {}).getAttribute ? document.querySelector('.landing-wrap > .land-bo').getAttribute('href') : '', steps: document.querySelectorAll('.start-steps .start-step').length, ticker: !!document.querySelector('#landing-ticker'), meta: card.querySelectorAll('.course-meta, .cc-stats').length, buttons: card.querySelectorAll('.course-foot .btn').length, h: card.getBoundingClientRect().height, folded: !!more && more.tagName === 'DETAILS' && !more.open, tabs: [...document.querySelectorAll('#land-more .landing-tabs .tab')].map(t => t.dataset.tab), guides: document.querySelectorAll('#land-more .pane[data-pane="guides"] .guides-strip .guide-card').length, strip: !!document.querySelector('#land-more .pane[data-pane="inside"] .stat-strip'), presence: !!document.querySelector('#land-more .pane[data-pane="community"] #landing-presence'), league: !!document.querySelector('#land-more .pane[data-pane="community"] .league-slot') };
  });
  log('start page:', JSON.stringify(land));
  check('start page reads in a few groups: a first visit sees its classes, then the steps, Your day, and the rest folded away', land.secs.join('|') === 'Your classes|Start here|Your day|More to explore', land.secs);
  check('the hero keeps Today and For professors; search, focus sounds, the account and the theme are in the header on every page', land.hero.length === 2 && /hero-today/.test(land.hero[0]) && land.hero[1] === 'hero-faculty', land.hero);
  check('visitors get one line on Bo that opens the one-minute demo', land.bo === '#/max', land.bo);
  check('no row of extra buttons under the next step (the timer and the d20 are in the sidebar and on each class)', !land.quick);
  check('first-time visitors get three numbered steps', land.steps === 3);
  check('no scrolling ticker', !land.ticker);
  check('class cards are short: the class, its next exam and one button', land.meta === 0 && land.buttons === 1 && land.h < 360, { meta: land.meta, buttons: land.buttons, h: land.h });
  check('the extras are folded under More to explore: this week, classmates, guides, what is inside', land.folded && land.tabs.join(',') === 'week,community,guides,inside', land);
  check('guides, the stat strip, presence and the league are in its tabs', land.guides === 3 && land.strip && land.presence && land.league, land);
  await p.click('#land-more > summary'); await p.waitForTimeout(500);
  check('opening it shows the tabs and is remembered', await p.evaluate(() => document.querySelector('#land-more').open && App.settings().landMore === true && !!document.querySelector('#land-more .landing-tabs .tab.on')));
  await p.reload(); await p.waitForTimeout(1200); check('it stays open after a reload', await p.evaluate(() => document.querySelector('#land-more').open));
  await p.click('#land-more > summary'); await p.waitForTimeout(300);

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
  const back = await p.evaluate(() => ({ title: document.querySelector('.land-next .sec-title').textContent.trim(), steps: !!document.querySelector('.start-steps'), resume: !!document.querySelector('.land-next .resume-card'), hub: (() => { const h = document.querySelector('#topbar .hub-slot'); return !!h && getComputedStyle(h).display !== 'none'; })() }));
  check('returning students see "Your next step" with a resume card', back.title === 'Your next step' && !back.steps && back.resume, back);
  check('streak and XP widgets appear once there is something to show', back.hub, back);
  await c.close();

  // phones
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block' });
  await go(m, '#/', 1200); check('phone: start page does not scroll sideways', await hscroll(m));
  const cta = await m.evaluate(() => { const b = document.querySelector('.course-card.calc .course-open'); return b.scrollWidth <= b.clientWidth + 1; });
  check('phone: class buttons are not cut off', cta);
  await go(m, '#/calc', 1400); check('phone: dashboard does not scroll sideways', await hscroll(m));
  await cm.close();
  await T.finish();
})();
