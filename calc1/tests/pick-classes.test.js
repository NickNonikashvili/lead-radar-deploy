/* Everyone picks their classes (October 2026). Nobody gets the Montana State classes by default:
   - a guest, and an account that never picked, has no classes; the home page asks "Which classes are you taking?"
     with every Montana State class unticked, and the sidebar's Your classes says Pick your classes;
   - saving needs at least one class, and then only those show (sidebar, home, search);
   - the sign-in class list starts unticked too, and Later adds nothing;
   - a class you made yourself is always yours, picked or not. */
const T = require('./lib');
(async () => {
  const { mk, go, login, check, hscroll } = await T.start();

  /* ---------- a guest ---------- */
  const [cg, g] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(g, '#/', 1800);
  const a = await g.evaluate(() => ({ mine: App.myCourses().length, pick: !!document.querySelector('#pick-classes'), tiles: document.querySelectorAll('#pick-classes .pk-c').length, ticked: document.querySelectorAll('#pick-classes .pk-c input:checked').length, rows: document.querySelectorAll('.sb-nav .sb-class').length, side: (document.querySelector('.sb-nav .sb-pick') || {}).textContent || '', disabled: document.querySelector('#pk-save').disabled }));
  check('a guest has no classes until they pick', a.mine === 0 && a.rows === 0, a);
  check('the home page asks which classes they take, every Montana State class there and none ticked', a.pick && a.tiles >= 13 && a.ticked === 0, a);
  check('the sidebar says Pick your classes', /Pick your classes/.test(a.side), a.side);
  check('saving needs at least one class', a.disabled && /Pick at least one/.test(await g.textContent('#pk-save')));
  await g.click('#pick-classes .pk-c:has(input[value="calc"])'); await g.click('#pick-classes .pk-c:has(input[value="writ"])'); await g.waitForTimeout(200);
  check('the button counts what is picked', /Save my 2 classes/.test(await g.textContent('#pk-save')));
  await g.click('#pk-save'); await g.waitForTimeout(1500);
  const b = await g.evaluate(() => ({ mine: App.myCourses(), saved: App.settings().courses, pick: !!document.querySelector('#pick-classes'), rows: [...document.querySelectorAll('.sb-nav .sb-class')].map(e => e.getAttribute('href')) }));
  check('then only those two are theirs: saved, in the sidebar, the picker gone', b.mine.join() === 'calc,writ' && b.saved.join() === 'calc,writ' && !b.pick && b.rows.join() === '#/calc/dashboard,#/writ/dashboard', b);
  await g.reload(); await g.waitForTimeout(1500);
  check('and it stays that way', await g.evaluate(() => App.myCourses().join() === 'calc,writ' && !document.querySelector('#pick-classes')));
  await cg.close();

  /* ---------- an account that never picked ---------- */
  const [cu, u] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(u, '#/', 900); await login(u, 'mod.user@montana.edu'); await u.reload(); await u.waitForTimeout(1500);
  const before = await u.evaluate(() => (App.auth.user && App.auth.user.courses) || null);   // put back at the end, for the suites after this one
  await u.evaluate(() => App.auth.savePrefs({ courses: [] }).catch(() => {}));
  await u.evaluate(() => { const s = App.settings(); delete s.courses; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await go(u, '#/', 1500);
  check('an account with no classes gets the same question', await u.evaluate(() => App.myCourses().length === 0 && !!document.querySelector('#pick-classes')));
  await u.evaluate(() => { try { localStorage.removeItem('mathub-onboarded'); } catch (e) {} delete App.auth.user.courses; App.auth.onboard(false); });   // as an account that never picked
  await u.waitForTimeout(500);
  const ob = await u.evaluate(() => ({ open: !!document.querySelector('#onboard-modal'), ticked: document.querySelectorAll('#onboard-modal input[data-course]:checked').length, later: [...document.querySelectorAll('#onboard-modal [data-action="close"]')].map(b => b.textContent.trim()).join() }));
  check('the class list after signing in starts with nothing ticked, and offers Later, not Skip', ob.open && ob.ticked === 0 && /Later/.test(ob.later) && !/Skip/.test(ob.later), ob);
  await u.click('#onboard-modal [data-action="close"]'); await u.waitForTimeout(800);
  check('Later adds no classes', await u.evaluate(() => App.myCourses().length === 0 && !(App.settings().courses || []).length));

  /* ---------- a class you made is always yours ---------- */
  const own = await u.evaluate(async () => { const pack = { format: 'mathub-class', version: 1, id: 'my7701', code: 'ZZ 101', name: 'Test class', short: 'ZZ 101', term: 'Fall 2026', kind: 'science', COURSE: { code: 'ZZ 101', name: 'Test class' }, SEMESTER: { start: '2026-08-24', end: '2026-12-18' }, UNITS: [{ n: 1, title: 'One', sections: ['a'] }], SECTIONS: [{ id: 'a', label: '1.1', title: 'A topic', unit: 1, ideas: ['An idea'] }], EXAMS: [], CALENDAR: [] }; try { await App.myClasses.add(pack); } catch (e) { return 'add failed: ' + e.message; } return App.myCourses(); });
  check('a class you made shows even before you pick any Montana State class', Array.isArray(own) && own.includes('my7701'), own);
  await u.evaluate(async () => { try { await App.myClasses.remove('my7701'); } catch (e) {} });
  await u.evaluate(c => App.auth.savePrefs({ courses: c }).catch(() => {}), before);

  /* ---------- phones ---------- */
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block' });
  await go(m, '#/', 1500);
  check('the picker fits a phone', !!(await m.$('#pick-classes')) && await hscroll(m));
  await cm.close(); await cu.close();
  await T.finish();
})();
