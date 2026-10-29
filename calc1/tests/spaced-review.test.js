/* Spaced review (App.srs in assets/app.js, shared by the Flashcards page and Today in assets/today.js):
   - a card's box sets when it comes back: at once, then after a day, 3 days, a week, 16 and 35 days
   - "Got it" moves a card up only when it was due (or new); going through the deck again in one sitting keeps its box
     and its date; "Again" sends it to box 0 and brings it back a few cards later in the same sitting
   - the page shows the cards due now, says on the button how far "Got it" sends a card, and says "All caught up"
     with when the next card comes back; "Go through all anyway" still shows every card
   - Today counts the same cards as due; old boxes (up to 3) keep working */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, login, check } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', bypassCSP: true, reducedMotion: 'reduce' });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.courses = ['calc']; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(p, '#/', 600); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1800);   // a member: every card, not the preview's five

  // the schedule itself
  const u = await p.evaluate(() => {
    const S = App.srs, D = 86400000, t0 = Date.UTC(2026, 9, 1, 12);
    return {
      fresh: S.grade(undefined, undefined, true, t0), again: S.grade(4, t0 - 40 * D, false, t0),
      early: S.grade(2, t0 - D, true, t0), due: S.grade(2, t0 - 3 * D, true, t0), top: S.grade(5, t0 - 40 * D, true, t0),
      gaps: [0, 1, 2, 3, 4, 5].map(b => (S.dueAt(b, t0) - t0) / D), say: [S.gap(undefined), S.gap(0, t0, t0), S.gap(2, t0 - 3 * D, t0), S.gap(2, t0, t0)],
      when: [S.when(t0 + 2 * 3600000, t0), S.when(t0 + D, t0), S.when(t0 + 3 * D, t0)], t0
    };
  });
  check('a new card that you know comes back tomorrow (box 1)', u.fresh[0] === 1 && u.fresh[1] === u.t0, u.fresh);
  check('the gaps widen: today, a day, 3 days, a week, 16 days, 35 days', u.gaps.join() === '0,1,3,7,16,35', u.gaps);
  check('"Again" sends a card to box 0', u.again[0] === 0 && u.again[1] === u.t0, u.again);
  check('"Got it" before a card is due keeps its box and date; when due it moves up; box 5 is the top', u.early[0] === 2 && u.early[1] === u.t0 - 86400000 && u.due[0] === 3 && u.top[0] === 5, { early: u.early, due: u.due, top: u.top });
  check('the button says how far "Got it" sends a card, or that it is not due yet', u.say.join('|') === 'in 1 day|in 1 day|in 1 week|not due yet', u.say);
  check('and when the next card comes back, in plain words', u.when.join('|') === 'later today|tomorrow|in 3 days', u.when);

  // the Flashcards page, from a clean start
  await p.evaluate(() => App.store.poke('calc', d => { d.flashcards = {}; d.fcAt = {}; }));
  await go(p, '#/calc/flashcards', 2200);
  const s0 = await p.evaluate(() => ({ stats: document.querySelector('#fc-stats').textContent, total: Courses.calc.FLASHCARDS.length, btn: document.querySelector('[data-action="good"]').textContent }));
  check('every card is new, so every card is due now; "Got it" sends it a day out', new RegExp(`${s0.total} due now`).test(s0.stats) && /Got it in 1 day/.test(s0.btn.replace(/\s+/g, ' ')), s0);
  const first = await p.evaluate(() => App.views.flashcards.state.calc.deck[0].id);
  await p.click('#fc-card'); await p.click('[data-action="good"]'); await p.waitForTimeout(200);
  const g1 = await p.evaluate(id => ({ box: App.store.get('flashcards', {})[id], due: App.dueCards('calc').list.some(c => c.id === id) }), first);
  check('"Got it" on a new card: box 1, and it is not due again today (Today agrees)', g1.box === 1 && !g1.due, g1);
  // a miss comes back a few cards later
  const second = await p.evaluate(() => { const st = App.views.flashcards.state.calc; return st.deck[st.i].id; });
  await p.click('#fc-card'); await p.click('[data-action="again"]'); await p.waitForTimeout(200);
  const g2 = await p.evaluate(id => { const st = App.views.flashcards.state.calc; return { box: App.store.get('flashcards', {})[id], back: st.deck.slice(st.i).findIndex(c => c.id === id) }; }, second);
  check('"Again": box 0, and the card comes back a few cards later in this sitting', g2.box === 0 && g2.back >= 2 && g2.back <= 4, g2);
  // going through every card again in the same sitting does not fake mastery
  await go(p, '#/calc', 600); await go(p, '#/calc/flashcards', 1800);
  const left = await p.evaluate(() => App.views.flashcards.state.calc.deck.length);
  check('back on the page: the card you knew is not in the due cards', left === s0.total - 1, { left, total: s0.total });
  await p.click('[data-action="mode"]'); await p.waitForTimeout(500);
  await p.evaluate(id => { const st = App.views.flashcards.state.calc; st.i = st.deck.findIndex(c => c.id === id); }, first);
  await p.click('[data-action="reshuffle"]').catch(() => {});
  await p.evaluate(id => { const st = App.views.flashcards.state.calc; const k = st.deck.findIndex(c => c.id === id); st.deck.unshift(st.deck.splice(k, 1)[0]); st.i = 0; }, first);
  await p.click('[data-action="next"]'); await p.click('[data-action="prev"]'); await p.waitForTimeout(150);   // repaint on that card
  const btnEarly = await p.textContent('[data-action="good"]');
  await p.click('#fc-card'); await p.click('[data-action="good"]'); await p.waitForTimeout(150);
  const g3 = await p.evaluate(id => App.store.get('flashcards', {})[id], first);
  check('all cards, the same sitting: the button says it is not due yet, and "Got it" keeps it in box 1', /not due yet/.test(btnEarly) && g3 === 1, { btnEarly, g3 });

  // nothing due: all caught up, and when the next card comes back
  await p.evaluate(() => { App.views.flashcards.state.calc.mode = 'due'; App.store.poke('calc', d => { const now = Date.now(); Courses.calc.FLASHCARDS.forEach(c => { d.flashcards[c.id] = 1; d.fcAt[c.id] = now; }); }); });
  await go(p, '#/calc', 600); await go(p, '#/calc/flashcards', 1800);
  const done = await p.evaluate(() => ({ text: (document.querySelector('.fc-done') || {}).textContent || '', today: App.dueCards('calc').reviews }));
  check('nothing due: "All caught up", the next card comes back tomorrow, and Today has none either', /All caught up: nothing is due right now\./.test(done.text) && /The next card comes back tomorrow\./.test(done.text) && done.today === 0, done);
  await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async () => (await axe.run('#view', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
  check('axe finds nothing serious on the caught-up page', v.length === 0, v);
  await p.click('.fc-done [data-action="mode"]'); await p.waitForTimeout(500);
  check('"Go through all anyway" shows every card', await p.evaluate(() => App.views.flashcards.state.calc.deck.length === Courses.calc.FLASHCARDS.length && !!document.querySelector('#fc-card')));

  // old boxes keep working, and Today and the page agree
  await p.evaluate(() => { App.views.flashcards.state.calc.mode = 'due'; });
  const old = await p.evaluate(() => { const D = 86400000, now = Date.now(), ids = Courses.calc.FLASHCARDS.map(c => c.id); App.store.poke('calc', d => { d.flashcards[ids[0]] = 3; d.fcAt[ids[0]] = now - 8 * D; d.flashcards[ids[1]] = 3; d.fcAt[ids[1]] = now - 6 * D; }); const due = App.dueCards('calc').list.map(c => c.id); return { a: due.includes(ids[0]), b: due.includes(ids[1]) }; });
  check('a mastered card (box 3) comes back after a week, not before', old.a && !old.b, old);
  await go(p, '#/calc', 600); await go(p, '#/calc/flashcards', 1800);
  check('the page shows the same card due', await p.evaluate(() => { const ids = Courses.calc.FLASHCARDS.map(c => c.id); const deck = App.views.flashcards.state.calc.deck.map(c => c.id); return deck.includes(ids[0]) && !deck.includes(ids[1]); }));
  await p.evaluate(() => App.store.poke('calc', d => { d.flashcards = {}; d.fcAt = {}; }));
  await c.close();
  await T.finish();
})();
