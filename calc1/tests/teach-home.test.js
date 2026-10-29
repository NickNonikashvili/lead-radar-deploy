/* StudyCat Faculty's home in the same frame as the student side (assets/teach.js teachHome, the cards of assets/home-grid.js):
   - the sidebar's Learning or teaching switch on both sides; the faculty rail has Add to syllabus, Home, Your syllabi
   - the hero is the next class meeting from the syllabus (today, still to come), with its room, today's topic and
     the next exam; Coming up lists the schedule and the exams; Your syllabi lists the class with its status
   - cards hide from their ⋮ menu and come back from Add to dashboard (settings.teachGrid); office hours is one to add
   - Add to syllabus opens a short menu that goes straight to that part of the syllabus
   - Your syllabi lives at #/teach/syllabi; axe finds nothing serious, by day and by night
   The sample class is deleted at the end. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, login, api, check } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', bypassCSP: true, reducedMotion: 'reduce' });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(p, '#/', 600); await login(p, 'admin.user@montana.edu');
  // tidy up an earlier run, then a sample class that meets every weekday at 23:00 (so later today)
  const mine = (await api(p, 'teach_me')).json; for (const x of (mine.teaching || []).filter(x => x.code === 'M 171' && x.section === '988')) await api(p, 'teach_class_delete', { id: x.id, confirm: 'M 171' });
  await p.evaluate(() => App.setSetting('teachGrid', { hidden: [], shown: [] }));
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const plusDays = n => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const id = (await api(p, 'teach_class_create', { code: 'M 171', title: 'Calculus I', section: '988', term: 'Fall 2026' })).json.id;
  await api(p, 'teach_class_save', { id, syllabus: { course: { code: 'M 171', title: 'Calculus I', section: '988', term: 'Fall 2026', meets: [{ kind: 'Lecture', days: 'MTWRFSU', start: '23:00', end: '23:58', room: 'Wilson Hall 1-144' }] },
    people: [{ role: 'Instructor', name: 'Ada Admin', email: 'admin.user@montana.edu', office: 'Wilson 2-240', hours: 'Tue 2–3 pm' }],
    exams: [{ name: 'Midterm 2', date: plusDays(4), time: '18:10', place: 'Wilson 1-112', covers: 'Derivative rules' }],
    schedule: { rows: [{ date: today, type: 'lecture', title: 'Implicit differentiation', notes: '' }, { date: plusDays(1), type: 'lecture', title: 'Related rates', notes: '' }] } } });
  check('a sample class to teach', id > 0, id);

  // the switch on the student side, then the teaching home
  await p.reload(); await p.waitForTimeout(1500); await p.evaluate(() => App.setSetting('teachGrid', { hidden: [], shown: [] }));
  check('the sidebar has the Learning or teaching switch, on Learning', !!(await p.$('.sidebar .sb-mode a[data-side="learn"][aria-current="true"]')));
  await p.click('.sidebar .sb-mode a[data-side="teach"]'); await p.waitForTimeout(3500);
  const h = await p.evaluate(() => ({ hash: location.hash, on: !!document.querySelector('.fx-rail .sb-mode a[data-side="teach"][aria-current="true"]'), add: !!document.querySelector('.fx-rail [data-action="fx-add"]'), rail: [...document.querySelectorAll('.fx-rail .fx-nav')].map(a => a.textContent.trim()), title: (document.querySelector('.fx-home .hg-title') || {}).textContent || '', sub: (document.querySelector('.fx-home .hg-sub') || {}).textContent || '', room: (document.querySelector('.fx-home .fx-room') || {}).textContent || '', cards: [...document.querySelectorAll('.fx-home .hg-card')].map(x => x.dataset.hg), adds: [...document.querySelectorAll('.fx-home [data-hga]')].map(b => b.dataset.hga), side: App.settings().side }));
  check('Teaching opens the faculty home, the switch on Teaching, and it is remembered', h.hash === '#/teach' && h.on && h.side === 'teach', h);
  check('the rail: Add to syllabus, Home, Your syllabi, New syllabus, Faculty status, Light or dark', h.add && ['Home', 'Your syllabi', 'New syllabus', 'Faculty status', 'Light or dark'].every(x => h.rail.includes(x)), h.rail);
  check('the hero is the next class meeting: the class, the time, the room', /Calculus I lecture/.test(h.title) && /11 pm/.test(h.title) && /Wilson Hall 1-144/.test(h.room), h);
  check('and today’s topic and the exam coming up', /Today: Implicit differentiation\./.test(h.sub) && /Midterm 2 is on/.test(h.sub), h.sub);
  check('the cards: class activity, coming up, attendance, your syllabi, practice assignments; office hours to add', ['activity', 'coming', 'attendance', 'syllabi', 'assign'].every(x => h.cards.includes(x)) && h.adds.includes('hours'), h);
  const coming = await p.evaluate(() => [...document.querySelectorAll('[data-hg="coming"] .hg-wk-t b')].map(b => b.textContent));
  check('Coming up lists the schedule and the exam in order', coming[0] === 'Implicit differentiation' && coming.includes('Midterm 2') && coming.includes('Related rates'), coming);
  check('Your syllabi lists the class as a draft', await p.evaluate(() => /Calculus I/.test(document.querySelector('[data-hg="syllabi"]').textContent) && /Draft/.test(document.querySelector('[data-hg="syllabi"]').textContent)));

  // hide and add back; office hours from the syllabus
  await p.click('[data-hgm="attendance"]'); await p.click('[data-hgh="attendance"]'); await p.waitForTimeout(200);
  check('a card hides from its ⋮ menu, and is listed to add back', await p.evaluate(() => !document.querySelector('[data-hg="attendance"]') && !!document.querySelector('[data-hga="attendance"]') && App.settings().teachGrid.hidden.includes('attendance')));
  await p.click('[data-hga="attendance"]'); await p.click('[data-hga="hours"]'); await p.waitForTimeout(200);
  const hrs = await p.evaluate(() => ({ back: !!document.querySelector('[data-hg="attendance"]'), hours: (document.querySelector('[data-hg="hours"]') || {}).textContent || '' }));
  check('it comes back, and Office hours shows the hours from the syllabus', hrs.back && /Tue 2–3 pm/.test(hrs.hours) && /Wilson 2-240/.test(hrs.hours), hrs);

  // Add to syllabus
  await p.click('.fx-rail [data-action="fx-add"]'); await p.waitForTimeout(150);
  const menu = await p.evaluate(() => [...document.querySelectorAll('.fx-addmenu [role="menuitem"]')].map(b => b.textContent.trim()));
  check('Add to syllabus offers an exam, a class day, office hours, a reading, a policy', menu.length === 5 && /An exam/.test(menu[0]), menu);
  await p.click('.fx-addmenu [data-k="exams"]'); await p.waitForTimeout(2500);
  check('and goes straight to that part of the syllabus', new RegExp(`#/teach/${id}/exams$`).test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  await go(p, '#/teach/syllabi', 2500);
  check('Your syllabi lives at #/teach/syllabi', /Your syllabi/.test(await p.textContent('#tc-body')) && !!(await p.$(`a[href="#/teach/${id}"]`)));

  // axe, by day and by night
  for (const scheme of ['light', 'dark']) {
    await p.emulateMedia({ colorScheme: scheme }); await go(p, '#/teach', 3500);
    await p.addScriptTag({ content: AXE });
    const v = await p.evaluate(async () => (await axe.run('#view', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ': ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')));
    check(`axe finds nothing serious on the teaching home (${scheme})`, v.length === 0, v);
  }
  // back to learning, for the suites after this one
  await p.click('.fx-rail .sb-mode a[data-side="learn"]'); await p.waitForTimeout(1200);
  check('Learning goes back to the student home', await p.evaluate(() => (location.hash === '#/' || location.hash === '') && App.settings().side === 'learn'));
  const del = (await api(p, 'teach_class_delete', { id, confirm: 'M 171' })).json; check('the sample class is deleted', del.ok);
  await p.evaluate(() => App.setSetting('teachGrid', { hidden: [], shown: [] }));
  await c.close();
  await T.finish();
})();
