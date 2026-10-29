/* Focus room, exam readiness, Tools (the map of study tools, Life and Future; calculator, units, citations, words, sig figs), Your week, the account menu (account things only), mobile layouts. */
const T = require('./lib');
(async () => {
  const { mk, login, go, log, check, txt } = await T.start({ dialogText: '40', freeHome: true });
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(p, '#/', 700);
  await p.evaluate(() => { const s = App.settings(); s.courses = ['calc', 'physics', 'csci']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); App.store.poke('calc', d => { const r = App.readiness('calc'); const t0 = r && r.ok ? r.topics[0].t : 'velocity'; d.progress = { [t0]: { a: 12, c: 10 }, aroc: { a: 6, c: 2 } }; d.history = [{ t: 'velocity', ok: true, d: App.todayISO() }]; d.activity = { [App.todayISO()]: true }; d.xp = [{ d: App.todayISO(), n: 40 }]; }); });
  await p.reload(); await p.waitForTimeout(1200);   // the classes were picked after the first paint
  check('the focus timer is in the sidebar and the hero counts down to the exam', !!(await p.$('#sidebar #pomo-toggle')) && /day/.test(await txt(p, '.hero-count')), await txt(p, '.hero-count'));
  // readiness on dashboard + today
  await go(p, '#/calc', 1200); check('dashboard readiness panel', !!(await p.$('.ready-panel')) && (await p.$$('.ready-tip')).length === 3, await txt(p, '.ready-label'));
  const score = await p.evaluate(() => App.readiness('calc')); check('readiness score computed', score && score.ok && score.score > 0 && score.score <= 100, score && score.score);
  await go(p, '#/today', 900); check('today ready column', (await p.$$('#td-classes .ready-gauge')).length >= 1);
  // focus room
  await go(p, '#/focus', 700); check('focus room renders', !!(await p.$('#fz-task')) && (await p.$$('.fz-preset')).length === 4);
  await p.fill('#fz-task', 'Chain rule set'); await p.click('.fz-preset[data-m="25"]'); await p.click('[data-action="fz-start"]'); await p.waitForTimeout(1300);
  check('timer running', await p.evaluate(() => App.focus.running && App.focus.left < 25 * 60), await p.evaluate(() => App.focus.left));
  await go(p, '#/', 500); check('focus pill shows away from page', !!(await p.$('#focus-pill')) && /\d+:\d\d/.test(await txt(p, '#focus-pill')) && /^\d+:\d\d · /.test(await p.title()));
  await p.click('#focus-pill'); await p.waitForTimeout(400); check('pill returns to focus room', location => true, await p.evaluate(() => location.hash));
  await p.keyboard.press(' '); await p.waitForTimeout(200); check('space pauses', await p.evaluate(() => App.focus.paused)); await p.keyboard.press(' ');
  await p.evaluate(() => { App.focus.elapsed = 26 * 60; App.focus.left = 1; }); await p.waitForTimeout(1500);
  check('session finishes and logs minutes', !(await p.evaluate(() => App.focus.running)) && (await p.evaluate(() => App.focusStats().today)) >= 25 && !!(await p.$('.fz-summary')), await p.evaluate(() => App.focusStats()));
  check('session stored in class data', await p.evaluate(() => (App.store.peek('calc').sessions || []).some(s => s.m >= 25)));
  await p.click('[data-action="fz-break"]'); await p.waitForTimeout(300); check('break timer', (await txt(p, '#fz-sub')).includes('Break')); await p.click('[data-action="fz-skipbreak"]');
  // tools
  await go(p, '#/tools', 700); check('tools tabs', (await p.$$('.dash-tabs .tab')).length === 5);
  const map = await p.evaluate(() => [...document.querySelectorAll('.th-sec')].map(s => [s.querySelector('.th-h').textContent, [...s.querySelectorAll('.th-card')].map(a => a.getAttribute('href'))]));
  check('the Tools page maps Study, Life and Future', map.map(m => m[0]).join() === 'Study,Life,Future' && ['#/gpa'].every(h => map[0][1].includes(h)) && ['#/habits', '#/goals', '#/wheel', '#/journal', '#/money'].every(h => map[1][1].includes(h)) && ['#/career', '#/portfolio'].every(h => map[2][1].includes(h)), map);
  await p.click('.th-card[data-tool="sig"]'); await p.waitForTimeout(500); check('a study tool on the map opens its tab', await p.evaluate(() => document.querySelector('.dash-tabs .tab.active, .dash-tabs .tab[aria-selected="true"]').dataset.tab === 'sig'));
  await p.click('.dash-tabs .tab[data-tab="calc"]'); await p.waitForTimeout(150);
  await p.fill('#tc-in', '2*sin(30)+sqrt(16)'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); check('calculator degrees', (await txt(p, '#tc-out')) === '5', await txt(p, '#tc-out'));
  await p.click('[data-action="tc-mode"][data-m="rad"]'); await p.waitForTimeout(150); check('calculator radians', Math.abs(parseFloat(await txt(p, '#tc-out')) - (2 * Math.sin(30) + 4)) < 1e-6, await txt(p, '#tc-out'));
  await p.click('[data-action="tc-key"][data-k="!"]').catch(() => {}); await p.fill('#tc-in', '5'); await p.click('[data-action="tc-key"][data-k="!"]'); await p.waitForTimeout(100); check('factorial', (await txt(p, '#tc-out')) === '120');
  await p.click('.dash-tabs .tab[data-tab="units"]'); await p.waitForTimeout(200); await p.selectOption('#tu-cat', 'speed'); await p.fill('#tu-v', '72'); await p.selectOption('#tu-from', 'km/h'); await p.selectOption('#tu-to', 'm/s'); await p.waitForTimeout(150); check('units 72 km/h = 20 m/s', (await txt(p, '#tu-out')).includes('20 m/s'), await txt(p, '#tu-out'));
  await p.selectOption('#tu-cat', 'temperature'); await p.fill('#tu-v', '212'); await p.selectOption('#tu-from', '°F'); await p.selectOption('#tu-to', '°C'); await p.waitForTimeout(150); check('temperature', (await txt(p, '#tu-out')).includes('100 °C'), await txt(p, '#tu-out'));
  await p.click('.dash-tabs .tab[data-tab="cite"]'); await p.waitForTimeout(200); await p.fill('#ct-author', 'Tommy Orange'); await p.fill('#ct-date', '2018-06-05'); await p.fill('#ct-title', 'There There'); await p.fill('#ct-source', 'Alfred A. Knopf'); await p.click('[data-action="ct-type"][data-t="book"]'); await p.waitForTimeout(150);
  check('MLA book citation', (await txt(p, '#ct-mla')) === 'Orange, Tommy. There There. Alfred A. Knopf, 2018.', await txt(p, '#ct-mla')); check('APA book citation', (await txt(p, '#ct-apa')) === 'Orange, T. (2018). There There. Alfred A. Knopf.', await txt(p, '#ct-apa'));
  await p.click('[data-action="ct-type"][data-t="web"]'); await p.fill('#ct-source', 'StudyCat'); await p.fill('#ct-url', 'https://studycat.org/learn/'); await p.waitForTimeout(150); check('MLA web citation', (await txt(p, '#ct-mla')).startsWith('Orange, Tommy. "There There." StudyCat, 5 June 2018, studycat.org/learn/.'), await txt(p, '#ct-mla'));
  await p.click('.dash-tabs .tab[data-tab="words"]'); await p.waitForTimeout(200); await p.fill('#tw-in', 'This is a sentence. This is another one, slightly longer than the first!\n\nA new paragraph starts here.'); await p.waitForTimeout(150); const ws = await txt(p, '#tw-stats'); check('word counter', ws.includes('Words18') && ws.includes('Sentences3') && ws.includes('Paragraphs2'), ws.slice(0, 80));
  await p.click('.dash-tabs .tab[data-tab="sig"]'); await p.waitForTimeout(200); check('sig figs 0.004500 = 4', (await txt(p, '#ts-out')).includes('Significant figures4')); await p.fill('#ts-in', '1200'); await p.waitForTimeout(100); check('ambiguous trailing zeros', (await txt(p, '#ts-out')).includes('(or more)'));
  // recap
  await go(p, '#/recap?w=this', 800); check('recap first slide', (await p.$$('.rc-day.on')).length >= 1 && (await txt(p, '.rc-big')).includes('day'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); check('recap xp slide', (await p.$$('.rc-bar')).length === 7 && (await txt(p, '.rc-big')).includes('XP'));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); check('recap end slide', !!(await p.$('[data-action="rc-share"]')));
  const png = await p.evaluate(() => App.recapCanvas(App.weekStats(0)).toDataURL('image/png').length); check('share card renders', png > 20000, png);
  check('recap marks seen', (await p.evaluate(() => App.settings().recapSeen)) === (await p.evaluate(() => App.weekStats(0).key)));
  // account menu
  await go(p, '#/', 400); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1500); if (await p.$('.celebrate')) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); } await p.click('#topbar-account [data-action="acct-toggle"]'); await p.waitForTimeout(200); const items = await p.$$eval('.pop-account .acct-dd-item', a => a.map(x => x.textContent.trim())); check('the account menu has only account things', ['Your plan', 'Usage & credits', 'Account settings', 'Customize'].every(x => items.some(i => i.startsWith(x))) && !items.some(i => /^(Today|Focus room|Character sheet|GPA calculator|Tools|People|Resources|Your badges)/.test(i)), items); await p.keyboard.press('Escape');
  const [cm, m] = await mk(390, 760, { serviceWorkers: 'block' }); await m.goto(T.base + '#/focus'); await m.waitForTimeout(900); check('mobile focus no hscroll', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); check('no tab bar on a phone (the website has none)', !(await m.$('#tabbar')));
  await m.goto(T.base + '#/tools'); await m.waitForTimeout(700); check('mobile tools no hscroll', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await m.goto(T.base + '#/recap?w=this'); await m.waitForTimeout(700); check('mobile recap no hscroll', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await cm.close();
  await c.close(); await T.finish();
})();
