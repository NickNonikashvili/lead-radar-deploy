/* Accessibility audit with axe-core on the main pages (WCAG 2.1 A/AA rules). Fails on serious/critical violations. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
(async () => {
  const { mk, login, txt, go, log, check } = await T.start({});
  const axe = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
  const PAGES = [['#/', 'landing'], ['#/today', 'today'], ['#/calc', 'dashboard'], ['#/calc/notes/1.3', 'notes'], ['#/calc/practice', 'practice'], ['#/calc/flashcards', 'flashcards'], ['#/calc/calendar', 'calendar'], ['#/forum', 'forum'], ['#/settings', 'settings'], ['#/gpa', 'gpa'], ['#/whatsnew', 'whatsnew'], ['#/csci/playground', 'playground'], ['#/writ/phonetics', 'phonetics']];
  const [c, p] = await mk(1360, 900); await go(p, '#/'); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1200); if (await p.$('.celebrate')) await p.keyboard.press('Escape');
  await p.evaluate(() => { const s = App.settings(); s.courses = ['calc', 'physics', 'writ', 'csci']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  const totals = {}; const serious = [];
  for (const [hash, name] of PAGES) {
    await go(p, hash, 900); await p.addScriptTag({ content: axe });
    const r = await p.evaluate(async () => { const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }); return res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 2).map(x => x.target.join(' ').slice(0, 90)) })); });
    totals[name] = r.length; const bad = r.filter(v => v.impact === 'serious' || v.impact === 'critical');
    log(`${name.padEnd(11)} ${r.length ? r.map(v => `${v.impact[0]}:${v.id}(${v.n})`).join(' ') : 'clean'}`);
    bad.forEach(v => { serious.push(`${name}: ${v.id} ×${v.n} — ${v.help} e.g. ${v.sample.join(' | ')}`); });
  }
  // static page too
  await p.goto(T.base.replace('index.html', 'learn/calc/index.html')); await p.waitForTimeout(400); await p.addScriptTag({ content: axe });
  const st = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations.map(v => `${v.impact[0]}:${v.id}(${v.nodes.length})`));
  log('static learn/calc:', st.length ? st.join(' ') : 'clean');
  // keyboard: skip link + focus visible + escape closes modals
  await go(p, '#/calc/notes/1.3', 600); await p.keyboard.press('Tab'); const first = await p.evaluate(() => document.activeElement && (document.activeElement.className + ' ' + document.activeElement.textContent.trim().slice(0, 30)));
  log('first tab stop:', first);
  check('a skip link is the first tab stop', /skip/i.test(first || ''), first);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200); check('search modal takes focus', await p.evaluate(() => document.activeElement && document.activeElement.id === 'search-input')); await p.keyboard.press('Escape'); await p.waitForTimeout(150); check('escape closes search', !(await p.$('#search-modal')));
  serious.forEach(s => log('  ! ' + s));
  check('no serious or critical axe violations', serious.length === 0, serious.length);
  await c.close(); await T.finish();
})();
