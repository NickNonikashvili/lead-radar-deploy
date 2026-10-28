/* A Tools page for every class (October 2026): #/<class>/toolkit, in every class's Explore menu.
   - each Montana State class gets its own kit (Calculus: Riemann sums and a limit table; Biology: a Punnett square and a
     chi-square test; Writing: revision checklists; Japanese culture: a timeline…), and every tool works;
   - the math is right: the formula solver finds any one letter, Riemann sums, limits, series, χ², crosses, bases, games;
   - a student changes a class's tools for themselves (hide, add, a formula of their own), and it sticks;
   - a class you make gets the tools Bo suggested, or the tools of its subject, and the class maker's Tools tab edits them;
   - it fits a phone. */
const T = require('./lib');
(async () => {
  const { mk, go, login, check, log, hscroll } = await T.start();
  const errs = [];
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });
  p.on('pageerror', e => errs.push(e.message));
  await go(p, '#/', 900);
  await p.evaluate(() => { const s = App.settings(); s.courses = ['calc', 'physics', 'precalc', 'writ', 'csci', 'biob', 'kin', 'psyx', 'emec100', 'jpns150d', 'm170', 'm172', 'psci230d']; s.motion = 'off'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  const open = async (cid, id) => { await go(p, `#/${cid}/toolkit${id ? '?t=' + id : ''}`, 1600); };
  const pick = async id => { await p.click(`.ct-card[data-id="${id}"]`); await p.waitForTimeout(400); };
  const fill = async (sel, v) => { await p.fill(sel, String(v)); await p.waitForTimeout(350); };
  const ans = () => p.evaluate(() => [...document.querySelectorAll('#ct-pane .ct-ans, #ct-pane .ct-bad')].map(x => x.textContent.trim()).join(' | '));
  const cells = sel => p.$$eval(sel, els => els.map(e => e.textContent.trim()));

  /* ---------- every class has its own kit ---------- */
  const kits = {};
  for (const cid of ['calc', 'physics', 'precalc', 'writ', 'csci', 'biob', 'kin', 'psyx', 'emec100', 'jpns150d', 'm170', 'm172', 'psci230d']) {
    await open(cid);
    kits[cid] = await p.evaluate(() => ({ menu: !!document.querySelector('.nav-item[data-view="toolkit"]'), explore: (() => { const b = document.querySelector('.nav-item[data-view="toolkit"]'); const g = b && b.closest('.nav-group'); return g ? g.dataset.g : ''; })(), tools: [...document.querySelectorAll('.ct-card')].map(x => x.dataset.id || 'go-' + x.getAttribute('href').split('/').pop()), open: !!document.querySelector('#ct-pane .ct-body') }));
  }
  log('kits:', JSON.stringify(Object.fromEntries(Object.entries(kits).map(([k, v]) => [k, v.tools.join(',')]))));
  check('every class has Tools in its Explore menu, and the page opens a tool', Object.values(kits).every(k => k.menu && k.explore === 'Explore' && k.open && k.tools.length >= 3), kits);
  check('each class gets tools of its own subject', kits.calc.tools.includes('integral') && kits.calc.tools.includes('limit') && kits.calc.tools.includes('go-grapher') && kits.physics.tools.includes('solver') && kits.physics.tools.includes('go-motion') && kits.biob.tools.includes('punnett') && kits.biob.tools.includes('chisq') && kits.writ.tools.includes('checklist') && kits.jpns150d.tools[0] === 'timeline' && kits.psci230d.tools.includes('game') && kits.m172.tools.includes('series') && kits.m170.tools[0] === 'unitcircle' && kits.emec100.tools[0] === 'matrix' && kits.csci.tools.includes('base') && kits.psyx.tools[0] === 'checklist', kits);

  /* ---------- the formula solver ---------- */
  await open('physics', 'solver');
  await p.selectOption('#cts-pick', { label: 'Newton’s second law' }); await p.waitForTimeout(200);
  await fill('#cts-v0', 10); await fill('#cts-v1', 2); await p.click('[data-action="cts-go"]'); await p.waitForTimeout(250);
  const a1 = await ans(); check('Physics: F = 10 N and m = 2 kg give a = 5 m/s²', /a = 5\b/.test(a1) && /m\/s²/.test(a1), a1);
  await p.selectOption('#cts-pick', { label: 'Position with constant acceleration' }); await p.waitForTimeout(200);
  for (const [i, v] of [[0, 0], [1, 10], [2, 0], [3, -9.8]]) await fill(`#cts-v${i}`, v);
  await p.click('[data-action="cts-go"]'); await p.waitForTimeout(250);
  const a2 = await ans(); check('a dropped ball: the time it hits the ground, the positive answer (t ≥ 0)', /t = 1\.4286/.test(a2) && !/−1\.4286/.test(a2), a2);
  await p.click('[data-action="cts-clear"]'); await fill('#cts-v0', 1); await p.click('[data-action="cts-go"]'); await p.waitForTimeout(200);
  check('two empty boxes: it asks for just one', /Leave just one box empty, not x0, v0, a, t\./.test(await ans()), await ans());
  await open('m170', 'solver');
  for (const [i, v] of [[1, 3], [2, 4], [3, 90]]) await fill(`#cts-v${i}`, v);
  await p.click('[data-action="cts-go"]'); await p.waitForTimeout(250);
  const a3 = await ans(); check('Trig: the law of cosines with a = 3, b = 4, C = 90° gives c = 5', /c = 5\b/.test(a3), a3);
  await fill('#cts-v0', 5); await fill('#cts-v3', ''); await p.click('[data-action="cts-go"]'); await p.waitForTimeout(250);
  const a4 = await ans(); check('and solved the other way, the angle is 90 degrees', /C = 90\b/.test(a4), a4);

  /* ---------- calculus ---------- */
  await open('calc', 'integral');
  const rs = await cells('#ct-pane .ct-table tbody td.mono:nth-child(2)');
  check('Riemann sums of x² on [0, 2] with 4 pieces: left 1.75, right 3.75, midpoint 2.625, trapezoid 2.75, Simpson 2.6667', rs[0] === '1.75' && rs[1] === '3.75' && rs[2] === '2.625' && rs[3] === '2.75' && /^2\.66666/.test(rs[4]), rs);
  check('and it draws the rectangles', await p.evaluate(() => !!document.querySelector('#ct-pane .ct-fig svg')));
  await open('calc', 'limit'); await fill('#ctl-f', 'sin(x)/x'); await fill('#ctl-a', '0');
  check('sin(x)/x as x → 0: the limit is 1, and f(0) is undefined', /limit is 1\b/.test(await ans()) && /undefined/.test(await p.textContent('#ct-pane')));
  await fill('#ctl-f', '1/x');
  check('1/x at 0: the two sides disagree, so there is no limit', /does not exist/.test(await ans()));
  await open('m172', 'series');
  check('the sum of 1/n² settles near 1.6449', /converges/.test(await ans()) && /1\.644/.test(await ans()), await ans());
  await fill('#ctr-a', 'n');
  check('the sum of n diverges (the terms do not shrink)', /diverges/.test(await ans()));
  await fill('#ctr-a', '(1/2)^n');
  check('a geometric series converges by the ratio test, to 1', /ratio test/.test(await ans()) && /\b1\b/.test(await ans()), await ans());
  await open('m170', 'unitcircle'); await fill('#ctu-a', 150);
  const uc = (await cells('#ct-pane .ct-table td')).join('|'); check('the unit circle at 150°: 5π/6, quadrant II, reference angle 30°, cos −√3/2, sin 1/2, tan −√3/3', /\|5π\/6 ≈/.test(uc) && /\|quadrant II\|/.test(uc) && /\|30°\|/.test(uc) && /cos θ\|−√3\/2\|/.test(uc) && /sin θ\|1\/2\|/.test(uc) && /tan θ\|−√3\/3$/.test(uc), uc);

  /* ---------- biology, statistics, code ---------- */
  await open('biob', 'chisq');
  check('Mendel’s peas against 9:3:3:1: χ² ≈ 0.47, p ≈ 0.925, fail to reject', /χ² = 0\.47/.test(await ans()) && /p = 0\.92/.test(await ans()) && /fail to reject/.test(await p.textContent('#ct-pane')), await ans());
  await open('biob', 'punnett'); await fill('#ctp-1', 'AaBb'); await fill('#ctp-2', 'AaBb');
  const pn = await p.textContent('#ct-pane'); check('AaBb × AaBb: a 4 × 4 square and the 9 : 3 : 3 : 1 ratio', (await p.$$('#ct-pane .ct-punnett tbody td')).length === 16 && /9 : 3 : 3 : 1/.test(pn), pn.slice(-300));
  await open('csci', 'base');
  const bs = await cells('#ct-pane .ct-table td.mono'); check('202 in binary, octal and hex: 1100 1010, 312 and CA, in 8 bits', bs[0] === '202' && bs[1] === '1100 1010' && bs[2] === '312' && bs[3] === 'CA' && bs[4] === '8', bs);
  await open('csci', 'stats'); await fill('#ctt-in', '2 4 4 4 5 5 7 9');
  const st = await cells('#ct-pane .ct-table td.mono'); check('statistics of 2 4 4 4 5 5 7 9: mean 5, median 4.5, mode 4, σ 2', st[1] === '5' && st[2] === '4.5' && st[3] === '4' && st[5] === '2', st);
  check('with a box plot and a histogram', (await p.$$('#ct-pane .ct-fig svg')).length >= 2);

  /* ---------- writing, history, politics, engineering ---------- */
  await open('writ', 'checklist');
  await p.click('#ct-pane .ct-ck input[data-i="0"]'); await p.waitForTimeout(200);
  check('a revision checklist counts what is ticked', /1 of 6 ticked/.test(await ans()));
  await open('writ', 'checklist'); check('and keeps the ticks for the class', /1 of 6 ticked/.test(await ans()));
  await open('psyx', 'checklist');
  check('DSM practice says it is for studying, never for diagnosing, and counts against the criterion', /never for diagnosing/.test(await p.textContent('#ct-pane')) && /count needed is 5/.test(await ans()));
  await open('jpns150d', 'timeline');
  const tl = await cells('#tl-list li b'); check('the Japan timeline is in order, from the Jōmon to Reiwa', tl[0].startsWith('c. 14,000') && tl[tl.length - 1] === '2019' && tl.indexOf('794') < tl.indexOf('1603'), tl.slice(0, 4));
  await fill('#ctl-q', 'Meiji'); check('search finds the Meiji dates', (await p.$$('#tl-list li')).length >= 2 && (await p.$$('#tl-list li')).length < 6);
  await fill('#ctl-q', ''); await p.click('[data-action="tl-quiz"]'); await p.waitForTimeout(200);
  check('the order quiz shows four events', (await p.$$('.ct-order li')).length === 4);
  await p.click('[data-action="tl-check"]'); await p.waitForTimeout(200);
  check('and checks the order, then shows the right one with the dates', /order/.test(await p.textContent('.ct-quiz')) && (await p.$$('.ct-order li b.mono')).length === 4);
  await p.click('.ct-add summary'); await fill('#ctl-w', '1999'); await fill('#ctl-e', 'My own date'); await p.click('[data-action="tl-add"]'); await p.waitForTimeout(200);
  check('a student adds a date of their own', (await cells('#tl-list li.mine span')).includes('My own date'));
  await open('psci230d', 'game');
  check('the prisoner’s dilemma: (Defect, Defect) is the Nash equilibrium, and both would rather cooperate', /\(Defect, Defect\)/.test(await ans()) && /dilemma/.test(await p.textContent('#gm-out')));
  await p.click('[data-action="gm-pick"][data-k="chicken"]'); await p.waitForTimeout(200);
  check('chicken has two equilibria and a mixed one', /Two Nash equilibria/.test(await ans()) && /Mixed equilibrium/.test(await p.textContent('#gm-out')));
  await open('emec100', 'matrix');
  const sels = await p.$$('#ct-pane select[data-mx="s"]'); await sels[0].selectOption('5'); await p.waitForTimeout(150);
  check('the decision matrix totals weight × score and names the best', /Concept A/.test(await ans()));

  /* ---------- a student's own changes ---------- */
  await open('calc'); await p.click('[data-action="ct-edit"]'); await p.waitForTimeout(300);
  await p.uncheck('[data-hide="calculator"]'); await p.click('[data-action="ce-add"][data-k="base"]'); await p.waitForTimeout(500);
  await p.click('[data-action="ct-edit"]'); await p.waitForTimeout(300);
  await p.fill('#ce-n', 'Ohm’s law'); await p.fill('#ce-eq', 'V = I*R'); await p.fill('#ce-vars', 'V = voltage, V\nI = current, A\nR = resistance, Ω'); await p.click('[data-action="ce-formula"]'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(1800);
  const mine = await cells('.ct-card b');
  check('hide one, add one and add a formula: the page keeps all three changes', !mine.includes('Calculator') && mine.includes('Number bases') && mine.includes('Ohm’s law'), mine);
  await p.click('.ct-card[data-id="my-1"]'); await p.waitForTimeout(300); await fill('#cts-v0', 12); await fill('#cts-v1', 2); await p.click('[data-action="cts-go"]'); await p.waitForTimeout(250);
  check('their own formula solves like any other: V = 12, I = 2 gives R = 6 Ω', /R = 6\b/.test(await ans()) && /Ω/.test(await ans()), await ans());
  await p.click('[data-action="ct-edit"]'); await p.waitForTimeout(300); await p.click('[data-action="ce-reset"]'); await p.waitForTimeout(400);
  check('and going back restores the class’s own tools', (await cells('.ct-card b')).includes('Calculator') && !(await cells('.ct-card b')).includes('Ohm’s law'));

  /* ---------- classes you make ---------- */
  const [cu, u] = await mk(1360, 900, { serviceWorkers: 'block' }); u.on('pageerror', e => errs.push(e.message));
  await go(u, '#/', 900); await login(u, 'mod.user@montana.edu'); await u.reload(); await u.waitForTimeout(1500);
  const base = { format: 'mathub-class', version: 1, term: 'Fall 2026', kind: 'science', SEMESTER: { start: '2026-08-24', end: '2026-12-18' }, UNITS: [{ n: 1, title: 'One', sections: ['a'] }], SECTIONS: [{ id: 'a', label: '1.1', title: 'A topic', unit: 1, ideas: ['An idea'] }], EXAMS: [], CALENDAR: [] };
  const made = await u.evaluate(async b => {
    const out = {};
    const bo = Object.assign({}, b, { id: 'my7711', code: 'ZZ 201', name: 'Tools from Bo', short: 'ZZ 201', COURSE: { code: 'ZZ 201', name: 'Tools from Bo' }, TOOLS: [{ kind: 'solver', title: 'Growth formulas', formulas: [{ n: 'Percent change', eq: 'pct = (b - a)/a*100', vars: [['pct', 'percent change', '%'], ['b', 'new value', ''], ['a', 'old value', '']] }] }, { kind: 'calculator' }, { kind: 'stats' }, { kind: 'hologram' }] });
    const chem = Object.assign({}, b, { id: 'my7712', code: 'CHMY 121', name: 'College Chemistry', short: 'CHMY 121', COURSE: { code: 'CHMY 121', name: 'College Chemistry' } });
    try { await App.myClasses.add(bo); await App.myClasses.add(chem); out.ok = true; } catch (e) { out.err = e.message; }
    return out;
  }, base);
  check('two classes of one’s own are made', made.ok, made);
  await go(u, '#/my7711/toolkit', 1800);
  check('a class keeps the tools Bo suggested from its syllabus, and drops a kind that does not exist', (await u.$$eval('.ct-card b', e => e.map(x => x.textContent))).join() === 'Growth formulas,Calculator,Statistics', await u.$$eval('.ct-card b', e => e.map(x => x.textContent)));
  await go(u, '#/my7712/toolkit', 1800);
  await u.click('.ct-card[data-id="solver"]').catch(() => {}); await u.waitForTimeout(300);
  check('a chemistry class with none set gets chemistry’s tools: the ideal gas law, sig figs, units', /Ideal gas law/.test(await u.textContent('#ct-pane')) && (await u.$$eval('.ct-card b', e => e.map(x => x.textContent))).includes('Sig figs'));
  await go(u, '#/maker/my7712?tab=tools', 1800);
  check('the class maker has a Tools tab that shows the subject’s tools', /Choose the tools myself/.test(await u.textContent('.pane[data-pane="tools"]')));
  await u.click('[data-tl-own]'); await u.waitForTimeout(300); await u.click('[data-tl-add="timeline"]'); await u.waitForTimeout(300);
  await u.fill('[data-tlev]', '1869 | Mendeleev’s periodic table\n1897 | Thomson finds the electron'); await u.waitForTimeout(200);
  await u.click('[data-ed="save"]'); await u.waitForTimeout(1500);
  await go(u, '#/my7712/toolkit?t=timeline', 1800);
  check('tools chosen in the maker are on the class’s Tools page after saving', (await u.$$eval('#tl-list li span', e => e.map(x => x.textContent))).includes('Mendeleev’s periodic table'));
  await u.evaluate(async () => { for (const id of ['my7711', 'my7712']) { try { await App.myClasses.remove(id); } catch (e) {} } });

  /* ---------- phones ---------- */
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block' }); m.on('pageerror', e => errs.push(e.message));
  await go(m, '#/', 600); await m.evaluate(() => { const s = App.settings(); s.courses = ['physics', 'jpns150d', 'psci230d', 'biob']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  const fits = [];
  for (const [cid, id] of [['physics', 'solver'], ['jpns150d', 'timeline'], ['psci230d', 'game'], ['biob', 'chisq'], ['biob', 'punnett']]) { await go(m, `#/${cid}/toolkit?t=${id}`, 1600); fits.push([cid + ':' + id, await hscroll(m)]); }
  check('every tool fits a phone without scrolling sideways', fits.every(f => f[1]), fits);
  check('no page errors', !errs.length, errs);
  await cm.close(); await cu.close(); await c.close();
  await T.finish();
})();
