/* Customize (#/customize, assets/modules.js, assets/custom.css): the whole site is modular.
   - Features: every feature is a module; one turned off leaves the sidebar, the class menus, the Tools page and search,
     and its address says it is off with a button that turns it back on. Presets turn many on or off at once.
   - Sidebar: groups and pages move up and down, pages move between groups, get pinned to the top or hidden; groups hide.
   - Class menus: the same for every class's menu, and pages hidden in one class only.
   - Look: accent colour (outside classes, or everywhere), text size, spacing, corners, font, theme, motion and parts
     of the frame hidden.
   - Start: the page Mathub opens on; a setup downloaded, loaded and reset; all of it synced with the account. */
const T = require('./lib');
(async () => {
  const { mk, go, login, api, check, hscroll, txt, base } = await T.start();
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', acceptDownloads: true });
  await go(p, '#/', 900); await login(p, 'alice.a@montana.edu');
  // start from Mathub as it came, here and on the account (an earlier run may have left a setup behind)
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(() => { const D = { modules: { off: [] }, navLayout: {}, classMenu: {}, look: {}, startPage: 'home', customizeTab: 'features', theme: 'system' }; Object.entries(D).forEach(([k, v]) => App.setSetting(k, v)); App.setSetting('courses', ['calc', 'physics']); });
  await p.waitForTimeout(2600); await p.reload(); await p.waitForTimeout(1500); if (await p.$('.celebrate')) await p.keyboard.press('Escape');
  const side = () => p.evaluate(() => ({ groups: [...document.querySelectorAll('#sb-nav .sb-group')].map(g => g.dataset.g), items: [...document.querySelectorAll('#sb-nav .sb-item')].map(a => a.dataset.sv), pinned: [...document.querySelectorAll('#sb-nav .sb-group[data-g="pinned"] .sb-item')].map(a => a.dataset.sv), byGroup: Object.fromEntries([...document.querySelectorAll('#sb-nav .sb-group')].map(g => [g.dataset.g, [...g.querySelectorAll('.sb-item')].map(a => a.dataset.sv)])) }));
  const tab = async k => { await p.click(`#view .dash-tabs .tab[data-tab="${k}"]`); await p.waitForTimeout(250); };

  /* ---------- the page and where it is linked ---------- */
  await go(p, '#/customize', 1000);
  check('Customize has Features, Sidebar, Class menus, Look and Start & backup', (await p.$$eval('#view .dash-tabs .tab', b => b.map(x => x.dataset.tab).join())) === 'features,sidebar,classes,look,start');
  check('the sidebar links it, at the bottom', !!(await p.$('#sb-nav .sb-custom a[href="#/customize"]')));
  await p.click('#topbar-account [data-action="acct-toggle"]'); await p.waitForTimeout(250);
  check('so does the account menu', !!(await p.$('.pop-account a[href="#/customize"]'))); await p.keyboard.press('Escape');
  const nMods = await p.$$eval('#view .pane[data-pane="features"] input[data-mod]', x => x.length);
  check('every feature has a switch (40 or more), all on to begin with', nMods >= 40 && (await p.$$eval('#view input[data-mod]', x => x.every(i => i.checked))), nMods);

  /* ---------- features ---------- */
  await p.uncheck('#view input[data-mod="habits"]'); await p.waitForTimeout(300);
  let s = await side();
  check('turning Habits off takes it out of the sidebar', !s.items.includes('habits') && s.items.includes('goals'), s.byGroup.tools);
  await go(p, '#/tools', 800);
  check('and off the Tools page', !(await p.$('.th-card[href="#/habits"]')) && !!(await p.$('.th-card[href="#/goals"]')));
  await go(p, '#/habits', 800);
  check('its address says it is off, and offers to turn it on', /Habits is turned off/.test(await txt(p, '#view')) && !!(await p.$('[data-action="cz-on"]')));
  await p.click('[data-action="cz-on"]'); await p.waitForTimeout(700);
  check('Turn it on brings the page back, and the sidebar link', /Habits/.test(await txt(p, '.page-title')) && (await side()).items.includes('habits'));
  await go(p, '#/customize', 800);
  await p.uncheck('#view input[data-mod="flashcards"]'); await p.waitForTimeout(300);
  await go(p, '#/calc/dashboard', 1200);
  const cmenu = await p.$$eval('#sidebar-nav .nav-item', b => b.map(x => x.dataset.view));
  check('a class feature turned off leaves every class’s menu', !cmenu.includes('flashcards') && cmenu.includes('practice'), cmenu);
  await go(p, '#/calc/flashcards', 900);
  check('and its page in a class says it is off', !!(await p.$('[data-action="cz-on"]')) && /Flashcards is turned off/.test(await txt(p, '#view')));
  const found = await p.evaluate(() => { App.searchReset(); const S = document.querySelector('.search-btn'); return true; });
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.type('flashcards'); await p.waitForTimeout(400);
  const res = await p.$$eval('.search-item, .s-item, [data-search-i]', r => r.map(x => x.textContent.trim().slice(0, 40)));
  check('search no longer offers the Flashcards page', found && !res.some(r => /^Flashcards\b.*Calc I · /.test(r) || r === 'Flashcards'), res.slice(0, 6));
  await p.keyboard.press('Escape');
  await go(p, '#/customize', 800);
  await p.click('#view [data-action="cz-preset"][data-p="study"]'); await p.waitForTimeout(400);
  s = await side();
  check('the Study only preset turns Life, Future and the community extras off', !s.items.some(v => ['habits', 'goals', 'career', 'portfolio', 'leagues', 'people'].includes(v)) && s.items.includes('tasks') && s.items.includes('forum'), s.items);
  check('Bo on every page can be turned off', await (async () => { await p.uncheck('#view input[data-mod="bofloat"]'); await go(p, '#/today', 900); const fab = await p.$('#bo-fab'); return !fab || !(await fab.isVisible()); })());
  await go(p, '#/customize', 800); await p.click('#view [data-action="cz-preset"][data-p="all"]'); await p.waitForTimeout(300);
  check('Everything turns every feature back on', await p.$$eval('#view input[data-mod]', x => x.every(i => i.checked)));

  /* ---------- the sidebar ---------- */
  await tab('sidebar');
  await p.click('#view [data-action="cz-move"][data-kind="group"][data-id="plan"][data-d="1"]'); await p.waitForTimeout(300);
  s = await side(); check('a group moves down: Planner after Tools', s.groups.indexOf('plan') > s.groups.indexOf('tools'), s.groups);
  await p.click('#view [data-action="cz-move"][data-kind="side"][data-id="focus"][data-d="-1"]'); await p.waitForTimeout(300);
  s = await side(); const pl = s.byGroup.plan; check('a page moves up within its group', pl.indexOf('focus') < pl.indexOf('projects'), pl);
  await p.selectOption('#view select[data-place="gpa"]', 'plan'); await p.waitForTimeout(300);
  s = await side(); check('a page moves to another group', s.byGroup.plan.includes('gpa') && !s.byGroup.tools.includes('gpa'), s.byGroup);
  await p.click('#view [data-action="cz-pin"][data-id="journal"]'); await p.waitForTimeout(300);
  s = await side(); check('a pinned page shows at the top', s.pinned.join() === 'journal' && s.groups[0] === 'pinned', s);
  await p.uncheck('#view input[data-sidehide="timelog"]'); await p.waitForTimeout(300);
  s = await side(); check('a page can be hidden from the sidebar', !s.items.includes('timelog'));
  await go(p, '#/timelog', 800); check('and still opens from its address (it is hidden, not off)', !(await p.$('[data-action="cz-on"]')));
  await go(p, '#/customize', 800); await tab('sidebar');
  await p.uncheck('#view input[data-grouphide="community"]'); await p.waitForTimeout(300);
  s = await side(); check('a whole group can be hidden', !s.groups.includes('community'));
  await p.click('#view [data-action="cz-reset"][data-what="navLayout"]'); await p.waitForTimeout(300);
  s = await side(); check('Reset the sidebar puts it back', s.groups.join() === 'classes,plan,tools,community,help' && !s.pinned.length && s.items.includes('timelog'), s.groups);

  /* ---------- class menus ---------- */
  await tab('classes');
  check('the class menus tab lists every class’s groups', (await p.$$eval('#view .pane[data-pane="classes"] .panel-title', h => h.map(x => x.textContent.trim()))).slice(0, 3).join() === 'Learn,Practice,Plan');
  await p.click('#view [data-action="cz-move"][data-kind="cgroup"][data-id="Practice"][data-d="-1"]'); await p.waitForTimeout(300);
  await p.selectOption('#view select[data-cplace="planner"]', 'Practice'); await p.waitForTimeout(300);
  await p.uncheck('#view input[data-classhide="mynotes"]'); await p.waitForTimeout(300);
  await p.selectOption('#cz-scope', 'physics'); await p.waitForTimeout(300);
  await p.uncheck('#view input[data-classhide="exam"]'); await p.waitForTimeout(300);
  const menuOf = async id => { await go(p, `#/${id}/dashboard`, 1200); return p.evaluate(() => ({ groups: [...document.querySelectorAll('#sidebar-nav .nav-toggle span')].map(x => x.textContent), byGroup: Object.fromEntries([...document.querySelectorAll('#sidebar-nav .nav-group')].map(g => [g.dataset.g, [...g.querySelectorAll('.nav-item')].map(b => b.dataset.view)])) })); };
  const calc = await menuOf('calc'), phys = await menuOf('physics');
  check('a class menu group moves: Practice before Learn', calc.groups[0] === 'Practice' && calc.groups[1] === 'Learn', calc.groups);
  check('a page moves to another group in every class', calc.byGroup.Practice.includes('planner') && phys.byGroup.Practice.includes('planner'), calc.byGroup);
  check('a page hidden for every class is gone from each', !Object.values(calc.byGroup).flat().includes('mynotes') && !Object.values(phys.byGroup).flat().includes('mynotes'));
  check('a page hidden in one class stays in the others', !Object.values(phys.byGroup).flat().includes('exam') && Object.values(calc.byGroup).flat().includes('exam'));
  await go(p, '#/customize', 800); await tab('classes'); await p.click('#view [data-action="cz-reset"][data-what="classMenu"]'); await p.waitForTimeout(300);
  check('Reset the class menus puts them back', (await menuOf('calc')).groups[0] === 'Learn');

  /* ---------- the look ---------- */
  await go(p, '#/customize', 800); await tab('look');
  const css = () => p.evaluate(() => { const cs = getComputedStyle(document.documentElement); const pnl = document.querySelector('#view .panel'); return { accent: cs.getPropertyValue('--accent').trim().toUpperCase(), zoom: getComputedStyle(document.querySelector('#view')).zoom, pad: pnl ? getComputedStyle(pnl).paddingTop : '', font: getComputedStyle(document.body).fontFamily, radius: pnl ? getComputedStyle(pnl).borderTopLeftRadius : '' }; });
  await p.click('#view [data-action="cz-look"][data-k="accent"][data-v="green"]'); await p.waitForTimeout(200);
  check('an accent colour changes the site', (await css()).accent === '#15803D', await css());
  await go(p, '#/calc/dashboard', 1100); check('but each class keeps its own colour', (await css()).accent !== '#15803D');
  await go(p, '#/customize', 800); await tab('look'); await p.check('#cz-accent-all'); await go(p, '#/calc/dashboard', 1100);
  check('unless the accent is used in classes too', (await css()).accent === '#15803D', await css());
  await go(p, '#/customize', 800); await tab('look');
  await p.click('#view [data-action="cz-look"][data-k="text"][data-v="xl"]'); await p.waitForTimeout(150);
  await p.click('#view [data-action="cz-look"][data-k="density"][data-v="compact"]'); await p.waitForTimeout(150);
  await p.click('#view [data-action="cz-look"][data-k="radius"][data-v="square"]'); await p.waitForTimeout(150);
  await p.click('#view [data-action="cz-look"][data-k="font"][data-v="serif"]'); await p.waitForTimeout(150);
  const L = await css();
  check('text size, spacing, corners and font all change', +L.zoom > 1.2 && L.pad === '12px' && L.radius === '4px' && /Charter|Georgia|serif/.test(L.font), L);
  await p.click('#view [data-action="cz-look"][data-k="theme"][data-v="dark"]'); await p.waitForTimeout(150);
  check('the theme can be set here', await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'));
  await p.uncheck('#view input[data-part="clock"]'); await p.uncheck('#view input[data-part="cal"]'); await p.waitForTimeout(150);
  check('parts of the frame can be hidden (the header clock, the month calendar)', await p.evaluate(() => { const ck = document.querySelector('#tb-clock'); const cal = document.querySelector('#sb-cal'); return (!ck || getComputedStyle(ck).display === 'none') && getComputedStyle(cal).display === 'none'; }));
  await p.click('#view [data-action="cz-reset"][data-what="look"]'); await p.waitForTimeout(200);
  const L2 = await css(); check('Reset the look puts it back', +L2.zoom === 1 && L2.radius !== '4px' && await p.evaluate(() => getComputedStyle(document.querySelector('#sb-cal')).display !== 'none'), L2);
  await p.click('#view [data-action="cz-look"][data-k="theme"][data-v="system"]'); await p.waitForTimeout(100);   // the account goes back to following the device (other suites sign in as alice)

  /* ---------- start page, backup, sync ---------- */
  await tab('start'); await p.selectOption('#cz-start', 'today'); await p.waitForTimeout(200);
  const [c2, p2] = await mk(1360, 900, { serviceWorkers: 'block', storageState: await c.storageState() });
  await p2.goto(base); await p2.waitForTimeout(1500);
  check('Mathub opens on the page picked', /#\/today$/.test(p2.url()) && /Today/.test(await txt(p2, '.page-title, h1')), p2.url());
  await p2.goto(p2.url().replace(/#.*$/, '') + '#/'); await p2.waitForTimeout(900);
  check('and Home is still Home after that', !/#\/today$/.test(p2.url()));
  await c2.close();
  await go(p, '#/customize/features', 800); await p.uncheck('#view input[data-mod="money"]'); await p.waitForTimeout(300);
  await go(p, '#/customize/start', 800);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#view [data-action="cz-export"]')]);
  const setup = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  check('Download my setup saves features, menus and look in one file', setup.mathubSetup === 1 && setup.modules.off.includes('money') && setup.startPage === 'today', setup);
  await p.waitForTimeout(2600);   // the synced preferences are sent a moment after the change
  const pr = await api(p, 'prefs');
  check('the setup is saved with the account', pr.json && pr.json.prefs && pr.json.prefs.modules && pr.json.prefs.modules.off.includes('money') && pr.json.prefs.startPage === 'today', pr.json && pr.json.prefs && pr.json.prefs.modules);
  await p.click('#view [data-action="cz-reset"][data-what="all"]'); await p.waitForTimeout(400);
  check('Reset everything turns every feature back on', await p.evaluate(() => App.moduleOn('money') && (App.settings().startPage || 'home') === 'home'));
  const file = require('path').join(require('os').tmpdir(), 'mathub-setup-test.json'); require('fs').writeFileSync(file, JSON.stringify(setup));
  await p.setInputFiles('#cz-import', file); await p.waitForTimeout(600);
  check('Load a setup brings it all back', await p.evaluate(() => !App.moduleOn('money') && App.settings().startPage === 'today'));
  await p.setInputFiles('#cz-import', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') }); await p.waitForTimeout(400);
  check('a file that is not a setup changes nothing', await p.evaluate(() => !App.moduleOn('money')));
  await p.click('#view [data-action="cz-reset"][data-what="all"]'); await p.waitForTimeout(300);

  await p.waitForTimeout(2600);   // the reset reaches the account before the page closes

  /* ---------- phones ---------- */
  const [cm, m] = await mk(390, 800, { serviceWorkers: 'block' });
  for (const k of ['features', 'sidebar', 'classes', 'look', 'start']) { await go(m, '#/customize/' + k, 900); check(`no sideways scroll on Customize › ${k} at 390px`, await hscroll(m)); }
  await cm.close(); await c.close();
  await T.finish();
})();
