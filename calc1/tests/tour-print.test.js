/* The tour of the layout (every account once, people who took the older tour too; steps for a computer and for a phone,
   keyboard, replay from settings, it waits for the welcome) and the print stylesheet/buttons. */
const T = require('./lib');
(async () => {
  const { mk, go, log, check, txt, login, api } = await T.start({ tour: true });
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });
  // someone who finished the older first-visit tour still gets the tour of the new layout
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); if (s.tourDone === undefined) { s.tourDone = true; s.courses = ['calc', 'physics']; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } } catch (e) {} });
  await go(p, '#/', 3400);
  const first = await txt(p, '.tour-card h3');
  check('the tour of the layout shows on the start page, also for people who took the older tour', !!(await p.$('.tour')) && first === 'The date, and where you are in the term', first);
  const spot = await p.$eval('.tour-spot', e => ({ shown: e.style.display !== 'none', w: parseFloat(e.style.width) })); const now = await p.$eval('#sb-now', e => e.getBoundingClientRect().width);
  check('the spotlight sits on the clock in the sidebar, and the card beside it', spot.shown && Math.abs(spot.w - now - 16) < 3 && !!(await p.$('.tour-card.side')), { spot, now });
  const n = await p.$$eval('.tour-dots i', d => d.length); const steps = await p.evaluate(() => App.tour.steps.length);
  check('a computer gets the sidebar, header, Your home and Bo steps, not the phone ones', n >= 7 && n < steps, { n, steps });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); check('next step: quick add', (await txt(p, '.tour-card h3')) === 'Add anything, from any page');
  await p.click('[data-action="tour-back"]'); await p.waitForTimeout(300); check('back step', (await txt(p, '.tour-card h3')) === 'The date, and where you are in the term');
  const titles = []; for (let i = 0; i < n; i++) { titles.push(await txt(p, '.tour-card h3')); await p.click('[data-action="tour-next"]').catch(() => {}); await p.waitForTimeout(380); }
  log('steps:', titles.join(' | '));
  check('it covers the sidebar, the header and Your home', ['Everything is in the sidebar', 'Your month at a glance', 'The header, on every page', 'Your home'].every(x => titles.includes(x)), titles);
  check('the tour finishes and is remembered with the layout it showed', !(await p.$('.tour')) && (await p.evaluate(() => App.settings().tourLayout === App.tour.version && App.settings().tourDone === true)));
  await p.reload(); await p.waitForTimeout(3000); check('the tour does not repeat', !(await p.$('.tour')));
  await go(p, '#/settings', 700); await p.click('[data-action="tour-again"]'); await p.waitForTimeout(2200);
  check('settings shows the tour again, on the start page', !!(await p.$('.tour')) && /^#\/?$/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); check('escape closes it, and it counts as seen', !(await p.$('.tour')) && (await p.evaluate(() => App.settings().tourLayout)) === (await p.evaluate(() => App.tour.version)));
  // a phone: the sidebar is the menu, so the steps are the menu, search, Your home and the tab bar
  const [cp, ph] = await mk(390, 844, { serviceWorkers: 'block', isMobile: true, hasTouch: true });
  await cp.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); if (!s.courses) { s.courses = ['calc']; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } } catch (e) {} });
  await go(ph, '#/', 3400);
  const pt = []; for (let i = 0; i < 8 && (await ph.$('.tour')); i++) { pt.push(await txt(ph, '.tour-card h3')); const r = await ph.$eval('.tour-card', e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1; }); if (!r) pt.push('(off screen)'); await ph.click('[data-action="tour-next"]').catch(() => {}); await ph.waitForTimeout(400); }
  log('phone steps:', pt.join(' | '));
  check('a phone gets the menu, search and tab bar steps, each card on the screen', pt[0] === 'Everything is in the menu' && pt.includes('Search everything') && pt.includes('Down here') && !pt.includes('(off screen)') && !pt.includes('Everything is in the sidebar'), pt);
  // a new account: the welcome first, then the tour
  const [cw, w] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(w, '#/', 800); await login(w, 'alice.a@montana.edu'); await w.reload(); await w.waitForTimeout(1200);
  await w.evaluate(() => { App.setSetting('tourLayout', 0); try { sessionStorage.clear(); } catch (e) {} }); await w.waitForTimeout(3200);   // as if she had not seen it (saved with her account)
  await w.reload(); await w.waitForTimeout(500); await w.evaluate(() => { try { sessionStorage.removeItem('mh-tour'); } catch (e) {} if (App.welcome && App.welcome.open) App.welcome.open(); }); await w.waitForTimeout(2600);   // a fresh visit
  const during = await w.evaluate(() => ({ welcome: !!document.querySelector('#welcome'), tour: !!document.querySelector('.tour') }));
  if (during.welcome) {
    check('the tour waits while the welcome is open', !during.tour, during);
    await w.evaluate(() => { const x = document.querySelector('#welcome'); if (App.welcome && App.welcome.close) App.welcome.close(); else if (x) x.remove(); document.querySelectorAll('.celebrate').forEach(c => c.remove()); }); await w.evaluate(() => { location.hash = '#/today'; });   // a league celebration (hidden in tests, but still open) would hold the tour back too await w.waitForTimeout(300); await w.evaluate(() => { location.hash = '#/'; }); await w.waitForTimeout(2600);
    check('and shows after it', !!(await w.$('.tour')), await w.evaluate(() => App.settings().tourLayout));
  } else log('(no welcome to open here; skipped the welcome check)');
  // leave her account as having seen it, so the tests after this one start without the tour
  if (await w.$('.tour')) await w.keyboard.press('Escape'); await w.evaluate(() => App.setSetting('tourLayout', App.tour.version)); await w.waitForTimeout(3200);
  check('closing it is saved with her account', ((await api(w, 'prefs')).json.prefs || {}).tourLayout === 1);
  await cw.close(); await cp.close();
  await go(p, '#/calc/formulas', 1200); check('print button on formulas', !!(await p.$('.page-actions .print-btn')));
  await go(p, '#/calc/notes/1.3', 900); check('print button on notes', !!(await p.$('.note-head .print-btn')));
  await p.emulateMedia({ media: 'print' }); check('print hides chrome', await p.evaluate(() => getComputedStyle(document.getElementById('sidebar')).display === 'none' && getComputedStyle(document.getElementById('topbar')).display === 'none')); await p.emulateMedia({ media: 'screen' });
  await go(p, '#/calc/dashboard', 900); check('no print button on dashboard', !(await p.$('.print-btn')));
  await c.close(); await T.finish();
})();
