/* Your home as the October 2026 redesign draws it (assets/home-grid.js) and the daily word (assets/word-puzzle.js):
   - the hero says one thing: the soonest exam in the next three weeks, else the class you practised last, else pick a
     class; the exam's checklist shows up in the week before it
   - every card has a ⋮ menu that hides it (Escape closes it, focus comes back); Add to dashboard brings it back and
     lists the tools; what you hide stays hidden after a reload (synced setting homeGrid)
   - Arrange freely switches to the free-form dashboard; "Use the tidy layout" comes back
   - the daily word: six tries, the standard marking (a letter that is once in the word is marked once), every try
     read out in words, +20 XP and a streak for solving it, the word's meaning either way, the same word all day
   - the apps and the other looks keep the free-form home; axe finds nothing serious, by day and by night; a phone
     does not scroll sideways */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, login, api, check } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', bypassCSP: true, reducedMotion: 'reduce' });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(p, '#/', 600); await login(p, 'alice.a@montana.edu');
  // a clean start on the account too: an earlier run's puzzle and hidden cards are saved with it
  const fresh = async q => { const pr = (await api(q, 'prefs')).json.prefs || {}; pr.wordPuzzle = null; pr.homeGrid = { hidden: [], shown: [] }; await api(q, 'prefs', { prefs: pr, updated: Date.now() }, 'PUT'); await q.evaluate(() => { App.setSetting('homeMode', 'grid'); }); };
  await fresh(p);
  await p.reload(); await p.waitForTimeout(2200);

  // the hero
  const h = await p.evaluate(() => { const s = App.homeGrid.state(); const hero = document.querySelector('.hg-hero'); return { kind: s.kind, shown: hero && hero.dataset.state, title: (document.querySelector('.hg-title') || {}).textContent || '', short: s.C ? s.C.short : '', exam: s.ex ? s.ex.name : '', n: s.n, grid: !!document.querySelector('#hg-grid'), free: !!document.querySelector('#dash') }; });
  check('home is the tidy grid, not the free-form dashboard', h.grid && !h.free, h);
  check('the hero shows the state the page is in, and names the class', h.kind === h.shown && (h.kind === 'start' || h.title.includes(h.short)), h);
  if (h.kind === 'exam') check('an exam soon: "<class> <exam> in N days."', h.title.includes(h.exam) && h.n <= 21, h);
  // the checklist in the week before an exam (after the class's data arrives)
  if (h.kind === 'exam' && h.n <= 7) {
    await p.waitForTimeout(1500);
    const ck = await p.evaluate(() => { const card = document.querySelector('[data-hg="checklist"]'); const box = card && card.querySelector('input[type="checkbox"]'); return { card: !!card, boxes: card ? card.querySelectorAll('input').length : 0, label: box ? box.closest('label').textContent.trim() : '' }; });
    check('the exam’s checklist shows up in the week before it', ck.card && ck.boxes > 0 && ck.label.length > 0, ck);
    const was = await p.evaluate(() => document.querySelector('[data-hg="checklist"] input').checked);
    await p.click('[data-hg="checklist"] label.hg-ck >> nth=0'); await p.waitForTimeout(150);
    const saved = await p.evaluate(() => { const i = document.querySelector('[data-hg="checklist"] input'); const [cid, ex] = i.dataset.hgc.split('|'); const st = (App.store.peek(cid).checklists || {})[ex] || {}; return { on: i.checked, saved: !!st[0], cl: JSON.stringify(App.store.peek(cid).checklists) }; });
    check('ticking a box saves it to the class', saved.on === !was && saved.saved === saved.on, saved);
    if (saved.on) { await p.click('[data-hg="checklist"] label.hg-ck >> nth=0'); await p.waitForTimeout(100); }   // as it was
  }

  // ⋮ hide, Escape, Add to dashboard
  await p.click('[data-hgm="cards"]');
  let m = await p.evaluate(() => ({ menu: !!document.querySelector('.hg-menu[role="menu"]'), exp: document.querySelector('[data-hgm="cards"]').getAttribute('aria-expanded'), focus: document.activeElement && document.activeElement.getAttribute('role') }));
  check('⋮ opens a menu, says it is open, and focuses its item', m.menu && m.exp === 'true' && m.focus === 'menuitem', m);
  await p.keyboard.press('Escape');
  m = await p.evaluate(() => ({ menu: !!document.querySelector('.hg-menu'), focus: document.activeElement && document.activeElement.dataset.hgm, exp: document.querySelector('[data-hgm="cards"]').getAttribute('aria-expanded') }));
  check('Escape closes it and focus goes back to ⋮', !m.menu && m.focus === 'cards' && m.exp === 'false', m);
  await p.click('[data-hgm="cards"]'); await p.click('.hg-menu [data-hgh="cards"]'); await p.waitForTimeout(200);
  m = await p.evaluate(() => ({ card: !!document.querySelector('[data-hg="cards"]'), chip: !!document.querySelector('[data-hga="cards"]'), focus: document.activeElement && document.activeElement.dataset.hga, saved: (App.settings().homeGrid || {}).hidden }));
  check('Hide from dashboard: the card goes, it is listed under Add to dashboard, focus lands there', !m.card && m.chip && m.focus === 'cards' && m.saved.includes('cards'), m);
  await p.reload(); await p.waitForTimeout(2000);
  check('still hidden after a reload', await p.evaluate(() => !document.querySelector('[data-hg="cards"]') && !!document.querySelector('[data-hga="cards"]')));
  check('and the account has it: the change was sent as the page reloaded (assets/auth.js sendPrefs)', ((((await api(p, 'prefs')).json.prefs || {}).homeGrid || {}).hidden || []).includes('cards'));
  await p.click('[data-hga="cards"]'); await p.waitForTimeout(200);
  m = await p.evaluate(() => ({ card: !!document.querySelector('[data-hg="cards"]'), focus: document.activeElement && document.activeElement.id }));
  check('Add to dashboard brings it back and focuses its heading', m.card && m.focus === 'hg-cards-t', m);
  // a tool: hidden until added
  const tools = await p.evaluate(() => [...document.querySelectorAll('[data-hga]')].map(b => b.dataset.hga));
  check('the tools start under Add to dashboard', ['gpa', 'focus', 'calcs'].every(x => tools.includes(x)), tools);
  await p.click('[data-hga="gpa"]'); await p.waitForTimeout(200);
  check('adding GPA puts its card on the home, with its link', await p.evaluate(() => { const c = document.querySelector('[data-hg="gpa"]'); return !!c && c.querySelector('a.hg-go').getAttribute('href') === '#/gpa'; }));
  await p.click('[data-hgm="gpa"]'); await p.click('[data-hgh="gpa"]'); await p.waitForTimeout(200);
  check('and hiding it puts it back in the list', await p.evaluate(() => !document.querySelector('[data-hg="gpa"]') && !!document.querySelector('[data-hga="gpa"]')));
  // one click handler, however often you come home
  await go(p, '#/today', 900); await go(p, '#/', 1200); await go(p, '#/tools', 900); await go(p, '#/', 1200);
  await p.click('[data-hgm="week"]'); await p.waitForTimeout(150);
  check('after coming home a few times, ⋮ still opens one menu (no stacked handlers)', await p.evaluate(() => document.querySelectorAll('.hg-menu').length === 1));
  await p.mouse.click(5, 880); await p.waitForTimeout(150);
  check('a click elsewhere closes it', await p.evaluate(() => !document.querySelector('.hg-menu')));

  // Arrange freely, and back
  await p.click('[data-hg-free]'); await p.waitForTimeout(700);
  check('Arrange freely: the free-form dashboard', await p.evaluate(() => !!document.querySelector('#dash') && !document.querySelector('#hg-grid') && App.settings().homeMode === 'free'));
  await p.click('[data-dw="arrange"]'); await p.waitForTimeout(200);
  await p.click('[data-dw="grid"]'); await p.waitForTimeout(700);
  check('Use the tidy layout: back to the grid', await p.evaluate(() => !!document.querySelector('#hg-grid') && App.settings().homeMode === 'grid'));

  // the daily word: the marking
  const mk2 = await p.evaluate(() => { const M = App.wordPuzzle.mark; return [M('SPEED', 'ERASE').join(), M('LLAMA', 'LIMIT').join(), M('EERIE', 'THERE').join(), M('LIMIT', 'LIMIT').join()]; });
  check('the standard marking, with repeated letters marked once', mk2.join('|') === 'in,no,in,in,no|ok,no,no,in,no|in,no,in,no,ok|ok,ok,ok,ok,ok', mk2);
  const pool = await p.evaluate(() => { const P = App.wordPuzzle.pool(); const days = new Set(); for (let i = 0; i < P.length; i++) days.add(App.wordPuzzle.pick(App.toISO(App.addDays(new Date(), i))).w); return { n: P.length, distinct: days.size, ok: P.every(x => /^[A-Z]{5}$/.test(x.w) && x.m.length > 10) }; });
  check('every word is five letters with a meaning, and no word comes back until the list is used up', pool.ok && pool.distinct === pool.n, pool);

  // play: one miss, then the word
  const word = await p.evaluate(() => App.wordPuzzle.state().w);
  const xp0 = await p.evaluate(() => App.xpToday());
  await p.click('[data-wp="open"]'); await p.waitForTimeout(200);
  let g = await p.evaluate(() => ({ dlg: !!document.querySelector('#wp-modal [role="dialog"][aria-modal="true"]'), focus: document.activeElement && document.activeElement.classList.contains('wp-modal') }));
  check('Play opens the game as a dialog, focus on it (so typing and Enter go to the game)', g.dlg && g.focus, g);
  const miss = word === 'QWXYZ' ? 'ZYXWQ' : 'QWXYZ';
  await p.keyboard.type(miss.toLowerCase()); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  g = await p.evaluate(() => ({ row: document.querySelector('.wp-row').getAttribute('aria-label'), say: document.querySelector('#wp-say').textContent, marked: document.querySelectorAll('.wp-row')[0].querySelectorAll('.wp-cell.ok, .wp-cell.in, .wp-cell.no').length }));
  check('a try is marked letter by letter and read out in words', g.marked === 5 && /Try 1: Q (right place|in the word, wrong place|not in the word)/.test(g.row) && /tries left/.test(g.say), g);
  await p.keyboard.type('ab'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  check('fewer than five letters is not a try', await p.evaluate(() => App.wordPuzzle.state().g.length === 1 && /Five letters/.test(document.querySelector('#wp-say').textContent)));
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
  // the on-screen keys work too
  for (const L of word) await p.click(`.wp-key[data-k="${L}"]`);
  await p.click('.wp-key[data-k="Enter"]'); await p.waitForTimeout(300);
  g = await p.evaluate(() => ({ s: App.wordPuzzle.state(), end: (document.querySelector('.wp-end') || {}).textContent || '', xp: App.xpToday() }));
  check('the word: solved in 2, the meaning, +20 XP, a 1-day streak', g.s.done && g.s.won && g.s.g.length === 2 && g.s.streak === 1 && g.end.includes(g.s.m) && g.xp - xp0 >= 20, { s: g.s, xp: g.xp - xp0 });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  g = await p.evaluate(() => ({ modal: !!document.querySelector('#wp-modal'), card: (document.querySelector('.hg-puzzle h2') || {}).textContent, focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName) }));
  check('closing shows the result on the card, focus on the card', !g.modal && /Solved in 2 of 6/.test(g.card) && /wp-btn|H2/.test(g.focus), g);
  await p.reload(); await p.waitForTimeout(1800);
  check('the same word and result after a reload', await p.evaluate(w => { const s = App.wordPuzzle.state(); return s.w === w && s.done && /Solved in 2 of 6/.test(document.querySelector('.hg-puzzle h2').textContent); }, word));

  // streaks: solved yesterday → today adds a day; a missed day starts again; six misses end it
  const st = await p.evaluate(() => {
    const y = App.toISO(App.addDays(new Date(), -1)), y2 = App.toISO(App.addDays(new Date(), -2)); const P = App.wordPuzzle;
    App.setSetting('wordPuzzle', { d: y, w: 'LIMIT', m: 'x', c: 'calc', g: ['LIMIT'], done: true, won: true, streak: 3, best: 3, played: 3, wins: 3, lastWon: y });
    const a = P.state(); App.setSetting('wordPuzzle', Object.assign({}, a, { d: y2, lastWon: y2 })); const b = P.state();
    return { fresh: a.g.length === 0 && !a.done && a.d === App.todayISO(), keep: a.streak, lost: b.streak };
  });
  check('a new day is a new puzzle; solving yesterday keeps the streak, missing a day starts it again', st.fresh && st.keep === 3 && st.lost === 0, st);
  await p.evaluate(() => { const y = App.toISO(App.addDays(new Date(), -1)); App.setSetting('wordPuzzle', { d: y, w: 'LIMIT', m: 'x', c: 'calc', g: ['LIMIT'], done: true, won: true, streak: 3, best: 3, played: 3, wins: 3, lastWon: y }); });
  await go(p, '#/today', 600); await go(p, '#/', 1200);
  await p.click('[data-wp="open"]'); await p.waitForTimeout(150);
  for (const x of ['QQQQQ', 'ZZZZZ', 'XXXXX', 'JJJJJ', 'VVVVV', 'KKKKK']) { await p.keyboard.type(x.toLowerCase()); await p.keyboard.press('Enter'); await p.waitForTimeout(80); }   // none of them is a word in the list
  g = await p.evaluate(() => ({ s: App.wordPuzzle.state(), end: (document.querySelector('.wp-end') || {}).textContent || '' }));
  check('six misses: the word and its meaning, and the streak ends', g.s.done && !g.s.won && g.s.streak === 0 && g.end.includes(g.s.w), { s: g.s, end: g.end });
  await p.keyboard.press('Escape');

  // the apps and the other looks keep the free-form home
  check('not in the apps or another look', await p.evaluate(() => { const r = document.documentElement; r.dataset.app = 'ios'; const a = App.homeGrid.on(); delete r.dataset.app; r.dataset.skin = 'realm'; const b = App.homeGrid.on(); delete r.dataset.skin; return !a && !b && App.homeGrid.on(); }));
  await c.close();

  // axe by day and by night; a phone does not scroll sideways
  for (const [w, hh, scheme] of [[1360, 900, 'light'], [1360, 900, 'dark'], [390, 844, 'dark']]) {
    const [c2, q] = await mk(w, hh, { serviceWorkers: 'block', bypassCSP: true, colorScheme: scheme, reducedMotion: 'reduce', hasTouch: w < 500 });
    await c2.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
    await go(q, '#/', 600); await login(q, 'alice.a@montana.edu'); await fresh(q); await q.reload(); await q.waitForTimeout(2200);
    await q.addScriptTag({ content: AXE });
    const v = await q.evaluate(async () => (await axe.run('#view', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ': ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')));
    check(`axe finds nothing serious on the home (${w}px, ${scheme})`, v.length === 0, v);
    await q.click('[data-wp="open"]'); await q.waitForTimeout(200); await q.keyboard.type('qwxyz'); await q.keyboard.press('Enter'); await q.waitForTimeout(150);
    const v2 = await q.evaluate(async () => (await axe.run('#wp-modal', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ': ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')));
    check(`axe finds nothing serious in the game (${w}px, ${scheme})`, v2.length === 0, v2);
    if (w < 500) {
      const fit = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, keys: [...document.querySelectorAll('.wp-key')].every(k => { const r = k.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 44; }) }));
      check('phone: no sideways scroll, and every key is on screen and at least 44px tall', fit.sw <= fit.w && fit.keys, fit);
    }
    await c2.close();
  }
  await T.finish();
})();
