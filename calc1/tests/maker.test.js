/* ============================================================
   The class maker (#/maker, assets/maker.js; api/ai.php ai_class, api/myclasses.php): every student's classes, their own way.
   - Anyone opens it (#/create and #/request lead there too); it is in the sidebar under Your classes, and in Settings.
   - From a syllabus: Bo reads it (any plan, paid in credits) and the maker opens filled in; a grocery list is refused
     with the reason. Signed out, reading asks to sign in.
   - From scratch: code and name, units and topics, an exam, grading weights that add up, meeting days that put the
     lectures on the calendar; saved free (no plan) with the account; edited again any time; Bo writes a unit's lessons.
   - The example class and an AI's answer open in the maker to check, then save; a class is shared by link and QR code,
     a classmate adds a copy, sharing stops; a new browser brings the class down; Delete removes it everywhere; signing
     out takes it off this browser.
   - Montana State's classes: the student's own section details, exam date and time, dates of their own and grading
     weights, saved with the account and shown on the class's pages; Undo puts it back. After picking classes, an offer
     to make each one yours, with Next to the following one.
   ============================================================ */
const T = require('./lib');
const fs = require('fs'); const path = require('path');
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start();
  const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu';
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const sample = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app-sample-class.json'), 'utf8');
  const other = sample.split('SKIL 101').join('WEBT 210').split('"SKIL').join('"WEBT');
  require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec("DELETE FROM rate WHERE key LIKE \'ai_class%\' OR key LIKE \'myclass_%\'");', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite')]);
  const tab = async (p, k) => { await p.click(`.mkr-tabs .tab[data-tab="${k}"]`); await p.waitForTimeout(250); };
  const hashId = p => (/#\/maker\/(my\d{4})/.exec(p.url()) || [])[1];

  /* ---------- a guest ---------- */
  const [cg, g] = await mk(1360, 900, { serviceWorkers: 'block' }); await cg.addInitScript(quiet);
  await go(g, '#/create', 1200);
  check('#/create leads to the class maker', /#\/maker$/.test(g.url()) && !!(await g.$('#mkr-bo')), g.url());
  await go(g, '#/request', 1000);
  check('so does the old Request a class', /#\/maker$/.test(g.url()), g.url());
  check('the class maker starts from a syllabus, a blank class or Montana State\'s classes', /Start from your syllabus/.test(await txt(g, '#mkr-bo')) && !!(await g.$('a.mkr-start[href^="#/maker/new?blank=1"]')) && !!(await g.$('button.mkr-start[data-mk="pick"]')));
  await g.click('.mkr-paste summary'); await g.fill('#mk-bo-text', 'TEST 101 Testing Bo.'); await g.click('[data-mk="read"]'); await g.waitForTimeout(700);
  check('signed out, Read my syllabus asks to sign in first', !!(await g.$('#auth-modal, .auth-modal')), await txt(g, 'body').then(t => t.slice(0, 80)));
  await g.keyboard.press('Escape'); await g.waitForTimeout(300);

  /* ---------- Alice: no plan ---------- */
  const [ca, a] = await mk(1360, 900, { serviceWorkers: 'block' }); await ca.addInitScript(quiet);
  await go(a, '#/'); check('Alice signs in', await login(a, ALICE));
  for (const c of ((await api(a, 'myclasses')).json.classes || [])) await api(a, 'myclass_delete', { id: c.id });
  await a.evaluate(() => { localStorage.removeItem('mh-maker-draft'); App.setSetting('classCustom', {}); });
  await a.reload(); await a.waitForTimeout(1500);
  const had = await a.evaluate(() => ({ courses: App.auth.user.courses, sections: App.auth.user.sections }));   // put back at the end
  check('the sidebar has the class maker under Your classes', !!(await a.$('#sb-nav .sb-add[href="#/maker"]')));
  await go(a, '#/settings', 1200);
  check('Settings links it from Your classes', !!(await a.$('#view a[href="#/maker"]')));

  // from a syllabus
  await go(a, '#/maker', 1400);
  check('signed in, the maker says how many credits are left', /credits left/.test(await txt(a, '#mkr-credit')), await txt(a, '#mkr-credit'));
  await a.click('.mkr-paste summary'); await a.fill('#mk-bo-text', 'Grocery list: milk, eggs and bread.'); await a.click('[data-mk="read"]'); await a.waitForTimeout(2500);
  check('a grocery list is refused with the reason, and a way to start blank', /does not look like a course syllabus/.test(await txt(a, '#mk-bo-result')) && !!(await a.$('#mk-bo-result a[href^="#/maker/new?blank=1"]')), await txt(a, '#mk-bo-result'));
  await a.fill('#mk-bo-text', 'TEST 101 Testing Bo. Fall 2026. Week 1: ratios. Exam 1 on October 20. Grading: homework 40, exams 60.'); await a.click('[data-mk="read"]'); await a.waitForTimeout(5000);
  check('Bo reads the syllabus and the maker opens filled in', /#\/maker\/new$/.test(a.url()) && (await a.inputValue('[data-f="code"]')) === 'TEST 101' && (await a.inputValue('[data-f="COURSE.instructor"]')) === 'Dr. Stand In', a.url());
  check('it says Bo filled it in, to check against the syllabus', /Bo filled this in from your syllabus/.test(await txt(a, '.mkr-ed-head')));
  await tab(a, 'topics');
  check('with its units and topics', (await a.$$('.mkr-unit')).length === 2 && (await a.$$('.mkr-topic')).length === 4);
  await tab(a, 'grading');
  check('and its grading, adding up to 100%', /Adds up to 100%/.test(await txt(a, '#mkr-sum')));
  await go(a, '#/maker', 1000);
  check('until it is saved, the maker offers to keep going', /is not saved yet/.test(await txt(a, '.mkr-resume')) && !!(await a.$('.mkr-resume a[href="#/maker/new"]')));
  await a.click('.mkr-resume a[href="#/maker/new"]'); await a.waitForTimeout(900);
  await a.click('[data-ed="save"]'); await a.waitForTimeout(2200);
  const sylId = hashId(a);
  check('saving it needs no plan: it is the student\'s own class, with the lessons next', !!sylId && !(await a.$('#paywall')) && /tab=lessons/.test(a.url()), a.url());
  await a.click('[data-ed="write-all"]'); await a.waitForTimeout(6000);
  check('Bo writes every unit\'s lessons', (await a.$$('.mkr-ls-dot.on')).length === 4 && /Every topic has a lesson/.test(await txt(a, '.mkr-bo-lessons')), await txt(a, '.mkr-bo-lessons'));
  check('then saving is the next step', /Unsaved changes/.test(await txt(a, '#mkr-bar')));
  await a.click('[data-ed="save"]'); await a.waitForTimeout(1600);
  await go(a, `#/${sylId}/notes`, 2000);
  check('the class\'s notes have Bo\'s lessons', /ratios explained simply/.test(await txt(a, '#view')), (await txt(a, '#view')).slice(0, 200));
  const own = await a.evaluate(() => ({ idea: !!document.querySelector('.lesson-idea .lesson-plain'), fig: !!document.querySelector('.lesson-fig svg'), qs: document.querySelectorAll('.lesson-qs > li').length, toc: document.querySelectorAll('.lesson-toc a').length }));
  check('in the same lesson format as the Montana State classes: the idea, a picture, a self-check', own.idea && own.fig && own.qs >= 1 && own.toc >= 3, own);
  await go(a, `#/${sylId}/flashcards`, 1500);
  check('and his flashcards', /flashcard|What is ratios/i.test(await txt(a, '#view')));

  // from scratch
  await go(a, '#/maker/new?blank=1&code=ZZ%20300', 1200);
  check('a blank class starts with the code it was opened with', (await a.inputValue('[data-f="code"]')) === 'ZZ 300' && /#\/maker\/new$/.test(a.url()), a.url());
  await a.click('[data-ed="save"]'); await a.waitForTimeout(500);
  check('saving without a name or topics says what is missing', /needs its name/.test(await txt(a, '#mkr-err')) && /at least one topic/.test(await txt(a, '#mkr-err')), await txt(a, '#mkr-err'));
  await a.fill('[data-f="name"]', 'Linear Things'); await a.fill('[data-f="COURSE.instructor"]', 'Dr. Vector'); await a.fill('[data-f="COURSE.officeHours"]', 'Tue 2–3 pm');
  await a.click('.mkr-col[data-col="#B91C1C"]');
  check('the tile follows the code and the colour', (await txt(a, '#mkr-tile')) === 'ZZ 300' && /185, 28, 28|#B91C1C/i.test(await a.$eval('#mkr-tile', t => t.style.getPropertyValue('--cc'))));
  await tab(a, 'topics');
  await a.click('[data-addtopic="0"]'); await a.waitForTimeout(150); await a.fill('[data-f="SECTIONS.0.title"]', 'Vectors'); await a.fill('[data-f="SECTIONS.0.about"]', 'Arrows with a size and a direction.');
  await a.click('[data-addtopic="0"]'); await a.waitForTimeout(150); await a.fill('[data-f="SECTIONS.1.title"]', 'Matrices');
  await a.click('[data-addrow="unit"]'); await a.waitForTimeout(150); await a.fill('[data-f="UNITS.1.title"]', 'Spaces'); await a.click('[data-addtopic="1"]'); await a.waitForTimeout(150); await a.fill('[data-f="SECTIONS.2.title"]', 'Subspaces');
  check('topics go in units, numbered', (await a.$$('.mkr-unit')).length === 2 && (await a.$$('.mkr-topic')).length === 3 && (await a.$eval('[data-f="SECTIONS.2.label"]', x => x.value)) === '2.1');
  await tab(a, 'exams');
  await a.click('[data-addrow="exam"]'); await a.waitForTimeout(150); await a.fill('[data-f="EXAMS.0.date"]', '2026-12-01'); await a.click('[data-exunit="0"][value="1"]');
  await tab(a, 'grading');
  await a.click('[data-addrow="category"]'); await a.waitForTimeout(100); await a.fill('[data-f="GRADING.categories.0.name"]', 'Homework'); await a.fill('[data-f="GRADING.categories.0.weight"]', '40');
  await a.click('[data-addrow="category"]'); await a.waitForTimeout(100); await a.fill('[data-f="GRADING.categories.1.name"]', 'Exams'); await a.fill('[data-f="GRADING.categories.1.weight"]', '50');
  check('the weights say when they do not add up', /Adds up to 90%/.test(await txt(a, '#mkr-sum')) && await a.$eval('#mkr-sum', x => x.classList.contains('warn')));
  await a.fill('[data-f="GRADING.categories.1.weight"]', '60');
  check('and when they do', /Adds up to 100%/.test(await txt(a, '#mkr-sum')) && await a.$eval('#mkr-sum', x => x.classList.contains('good')));
  await a.click('[data-scale="plus"]'); await a.waitForTimeout(150);
  check('one tap fills the letters with plus and minus', (await a.$$('.mkr-sc')).length === 11);
  await tab(a, 'schedule');
  await a.click('[data-day="1"]'); await a.click('[data-day="3"]'); await a.fill('[data-f="COURSE.meet.start"]', '09:00'); await a.fill('[data-f="COURSE.meet.end"]', '09:50'); await a.fill('[data-f="COURSE.room"]', 'Wilson 1-122');
  await a.click('[data-ed="lectures"]'); await a.waitForTimeout(400);
  const nLect = await a.evaluate(() => { const m = /(\d+) lectures? on the calendar now/.exec(document.querySelector('.pane[data-pane="schedule"]').textContent); return m ? +m[1] : 0; });
  check('meeting days put the lectures on the calendar, two a week for the term, skipping the exam day', nLect >= 28 && nLect <= 36, nLect);
  await a.click('[data-addrow="date"]'); await a.waitForTimeout(150);
  const di = await a.$$eval('.pane[data-pane="schedule"] [data-f$=".2"]', x => x.map(e => e.dataset.f).pop());
  await a.fill(`[data-f="${di.replace(/\.2$/, '.0')}"]`, '2026-11-13'); await a.fill(`[data-f="${di}"]`, 'Project due');
  await a.click('[data-ed="save"]'); await a.waitForTimeout(2200);
  const zzId = hashId(a);
  check('the blank class saves with no plan', !!zzId && !(await a.$('#paywall')), a.url());
  check('it is listed in the maker and the sidebar', await a.evaluate(id => !!document.querySelector(`#sb-nav a[href="#/${id}/dashboard"]`), zzId));
  await go(a, `#/${zzId}/calendar`, 2000);
  check('its calendar has the lectures, the exam and the due date', /Vectors/.test(await txt(a, '#view')) && /Project due/.test(await txt(a, '#view')) && /Exam 1/.test(await txt(a, '#view')), (await txt(a, '#view')).slice(0, 300));
  await go(a, `#/${zzId}/course`, 1500);
  check('its syllabus page shows the instructor, office hours and when it meets, with Edit', /Dr\. Vector/.test(await txt(a, '.own-panel')) && /Tue 2–3 pm/.test(await txt(a, '.own-panel')) && /Mon · Wed 9:00 am–9:50 am/.test(await txt(a, '.own-panel')) && !!(await a.$(`.own-panel a[href="#/maker/${zzId}"]`)), await txt(a, '.own-panel'));
  await go(a, `#/${zzId}/dashboard`, 1500);
  check('its page says it is your own class, with Edit', !!(await a.$(`.mk-strip a[href="#/maker/${zzId}"]`)));
  // edited any time
  await go(a, `#/maker/${zzId}?tab=basics`, 1500);
  await a.fill('[data-f="name"]', 'Linear Algebra'); await a.fill('[data-f="short"]', 'Lin Alg');
  check('a change shows Unsaved changes', /Unsaved changes/.test(await txt(a, '#mkr-bar')));
  await a.click('[data-ed="save"]'); await a.waitForTimeout(1500);
  check('saved, the class has its new name and nickname everywhere', /Saved/.test(await txt(a, '#mkr-bar')) && await a.evaluate(id => Courses[id].name === 'Linear Algebra' && Courses[id].short === 'Lin Alg', zzId) && /Lin Alg/.test(await txt(a, '#sb-nav')), [await txt(a, '#mkr-bar'), await a.evaluate(id => [Courses[id].name, Courses[id].short], zzId), await txt(a, '#sb-nav')]);
  const acct = (await api(a, 'myclasses')).json.classes || [];
  check('both classes are with her account', acct.some(c => c.id === zzId && c.name === 'Linear Algebra') && acct.some(c => c.id === sylId));

  // the example and an AI's answer open in the maker
  await go(a, '#/maker', 1000); await a.click('.mkr-more > summary'); await a.waitForTimeout(200);
  await a.fill('#mk-text', other); await a.click('[data-mk="check"]'); await a.waitForTimeout(900);
  check('an AI\'s answer opens in the maker to check', (await a.inputValue('[data-f="code"]')) === 'WEBT 210');
  await a.click('[data-ed="save"]'); await a.waitForTimeout(1800);
  const webId = hashId(a);
  check('and saves with no plan', !!webId && !(await a.$('#paywall')));

  // sharing
  await go(a, `#/maker/${webId}?tab=basics`, 1500); await a.click('[data-mkr="share"]'); await a.waitForTimeout(1800);
  const sh = await a.evaluate(() => { const s = document.querySelector('#share-sheet'); return s && { url: (s.querySelector('#share-url') || {}).value || '', qr: !!s.querySelector('svg.qr path') }; });
  check('Share gives a studycat.org/#/c/ link and a QR code', sh && /^https:\/\/mathub\.space\/#\/c\/[A-Z2-9]{8}$/.test(sh.url) && sh.qr, sh);
  const code = sh ? sh.url.slice(-8) : '';
  await a.keyboard.press('Escape'); await a.waitForTimeout(400);
  await go(g, '#/c/' + code.toLowerCase(), 1800);
  check('a guest opens the link and sees the class with Add, and nothing about who made it', /WEBT 210/.test(await txt(g, '#shared-box')) && !!(await g.$('[data-sc="add"]')) && !/alice/i.test(await txt(g, '#shared-box')));
  const [cb, b] = await mk(390, 844, { serviceWorkers: 'block' }); await cb.addInitScript(quiet); await go(b, '#/'); await login(b, BOB);
  for (const c of ((await api(b, 'myclasses')).json.classes || [])) await api(b, 'myclass_delete', { id: c.id });
  await b.reload(); await b.waitForTimeout(800);
  await go(b, '#/c/' + code, 1800);
  check('no sideways scroll on a shared class at 390px', await hscroll(b));
  await b.click('[data-sc="add"]'); await b.waitForTimeout(1800);
  check('a classmate adds a copy, with no plan, and it opens', /#\/my\d{4}\/dashboard/.test(b.url()) && !(await b.$('#paywall')), b.url());
  await go(b, '#/maker', 1200);
  check('the copy is theirs to edit in the maker', (await b.$$('.mkr-row a[href^="#/maker/my"]')).length === 1);
  check('no sideways scroll on the class maker at 390px', await hscroll(b));
  await go(b, `#/maker/${zzId}`, 1000);
  check('someone else\'s class is not there to edit', /not here/.test(await txt(b, '#view')));
  await go(a, `#/maker/${webId}?tab=basics`, 1500); await a.click('[data-mkr="share"]'); await a.waitForTimeout(1500);
  await a.click('#share-sheet [data-sh="stop"]'); await a.waitForTimeout(1200);
  await go(g, '#/c/' + code, 1800);
  check('after sharing stops, the link says it is not shared any more', /not shared any more/.test(await txt(g, '#shared-box')), await txt(g, '#shared-box'));

  /* ---------- Montana State's class, made hers ---------- */
  await a.evaluate(() => App.auth.savePrefs({ courses: ['calc', 'physics'] })); await a.waitForTimeout(400);
  await go(a, '#/maker/calc', 2000);
  check('a Montana State class opens with Your section, Your dates, Exams and Grading', (await a.$$eval('.mkr-tabs .tab', x => x.map(t => t.dataset.tab).join())) === 'basics,dates,exams,grading' && /Make Calc I yours/.test(await txt(a, '.mkr-ed-head')));
  check('it says the lessons and practice stay, and the changes are only hers', /keeps its lessons, practice and cards/.test(await txt(a, '.mkr-ed-head')) && /only for you/.test(await txt(a, '.mkr-ed-head')));
  await a.fill('[data-f="short"]', 'My Calc'); await a.fill('[data-f="instructor"]', 'Dr. Limit'); await a.fill('[data-f="officeHours"]', 'Wed 1 pm, Wilson 2-240'); await a.fill('[data-sec="section"]', '004');
  await tab(a, 'exams');
  const exk = await a.$eval('[data-exk]', x => x.dataset.exk);
  await a.fill(`[data-exk="${exk}"][data-exf="date"]`, '2026-11-20'); await a.fill(`[data-exk="${exk}"][data-exf="time"]`, '7 pm, Wilson 1-122');
  await tab(a, 'dates');
  await a.click('[data-addrow="event"]'); await a.waitForTimeout(150); await a.fill('[data-f="events.0.0"]', '2026-11-05'); await a.fill('[data-f="events.0.2"]', 'Quiz in my section');
  await tab(a, 'grading');
  const wk = await a.$eval('[data-w]', x => x.dataset.w); await a.fill(`[data-w="${wk}"]`, '12');
  await a.click('[data-ed="save"]'); await a.waitForTimeout(1600);
  const cc = await a.evaluate(ex => { const C = Courses.calc; const e = C.EXAMS.find(x => x.id === ex); return { K: App.settings().classCustom.calc, short: C.short, inst: C.COURSE.instructor, date: e.date, label: e.dateLabel, mine: C.CALENDAR.filter(r => r.mine).map(r => r[2]), sec: App.courseSetting('calc', 'section', '') }; }, exk);
  check('saved with her account: nickname, instructor, office hours, exam date and time, her own date, a weight and her section', cc.K && cc.K.short === 'My Calc' && cc.inst === 'Dr. Limit' && cc.date === '2026-11-20' && /7 pm, Wilson 1-122/.test(cc.label) && cc.mine.join() === 'Quiz in my section' && cc.K.weights[wk] === 12 && cc.sec === '004', cc);
  check('the sidebar shows her nickname', /My Calc/.test(await txt(a, '#sb-nav')));
  await go(a, '#/calc/calendar', 2000);
  check('the class calendar has her own date', /Quiz in my section/.test(await txt(a, '#view')));
  await go(a, '#/calc/course', 1500);
  check('the syllabus page shows her section\'s details and says the weights are hers', /Dr\. Limit/.test(await txt(a, '.own-panel')) && /weights below are the ones you set/.test(await txt(a, '.own-panel')));
  await a.waitForTimeout(2800);   // the account gets it (synced settings)
  const [cn, n] = await mk(1360, 900, { serviceWorkers: 'block' }); await cn.addInitScript(quiet); await go(n, '#/'); await login(n, ALICE); await n.reload(); await n.waitForTimeout(2500);
  check('in a new browser, her version of Calc I comes back', await n.evaluate(() => Courses.calc.short === 'My Calc' && (App.settings().classCustom || {}).calc && Courses.calc.CALENDAR.some(r => r.mine)), await n.evaluate(() => App.settings().classCustom));
  await go(n, '#/maker', 2500);
  check('and so do the classes she made', (await n.$$('.mkr-row a[href^="#/maker/my"]')).length === 3, [await txt(n, '.mkr-list'), await n.evaluate(() => ({ mine: App.myClasses.list().map(e => e.id), courses: App.settings().courses, last: App.classSync.last }))]);
  await go(a, '#/maker/calc', 1800); await a.click('[data-ed="reset"]'); await a.waitForTimeout(1200);
  check('Undo all my changes puts Calc I back as StudyCat has it', await a.evaluate(ex => !(App.settings().classCustom || {}).calc && Courses.calc.short === 'Calc I' && Courses.calc.EXAMS.find(x => x.id === ex).date !== '2026-11-20' && !Courses.calc.CALENDAR.some(r => r.mine), exk));

  // after picking classes: make them yours
  await go(a, '#/', 1200); await a.evaluate(() => App.auth.onboard(true)); await a.waitForTimeout(600);
  await a.click('#onboard-modal input[data-course="precalc"]').catch(() => {}); await a.waitForTimeout(150);
  await a.click('#onboard-modal [data-action="save"]'); await a.waitForTimeout(1500);
  check('after picking a new class, StudyCat offers to make it hers', !!(await a.$('#mkr-prompt')) && /Make your classes yours/.test(await txt(a, '#mkr-prompt')) && !!(await a.$('#mkr-prompt a[href^="#/maker/precalc"]')), await txt(a, 'body').then(t => t.slice(0, 100)));
  await a.click('#mkr-prompt a[href^="#/maker/precalc"]'); await a.waitForTimeout(1500);
  check('Make it yours opens its page in the class maker', /#\/maker\/precalc/.test(a.url()) && !(await a.$('#mkr-prompt')));
  await a.evaluate(() => App.auth.savePrefs({ courses: ['calc', 'physics'] })); await a.waitForTimeout(300);
  await go(a, '#/maker/calc?next=physics', 1800); await a.fill('[data-f="room"]', 'Wilson 1-125'); await a.click('[data-ed="save"]'); await a.waitForTimeout(1200);
  check('after saving, Next goes to the following class', !!(await a.$('#mkr-bar a[href^="#/maker/physics"]')));
  await a.click('[data-ed="reset"]'); await a.waitForTimeout(800);

  // unknown classes, and phones
  await go(a, '#/maker/zz9999', 1000);
  check('a class that is not there says so', /not here/.test(await txt(a, '#view')));
  const [cp, ph] = await mk(390, 844, { serviceWorkers: 'block' }); await cp.addInitScript(quiet); await go(ph, '#/'); await login(ph, ALICE); await ph.reload(); await ph.waitForTimeout(1500);
  for (const h of ['#/maker', `#/maker/${zzId}?tab=basics`, `#/maker/${zzId}?tab=schedule`, `#/maker/${zzId}?tab=topics`, '#/maker/calc?tab=dates']) { await go(ph, h, 1600); check(`no sideways scroll at 390px: ${h.replace(zzId, 'my class')}`, await hscroll(ph)); }
  await go(ph, `#/maker/${zzId}?tab=basics`, 1500); await ph.fill('[data-f="COURSE.room"]', 'x').catch(() => {}); await ph.fill('[data-f="name"]', 'Linear Algebra!'); await ph.waitForTimeout(200);
  const bar = await ph.evaluate(() => { const b = document.querySelector('#mkr-bar').getBoundingClientRect(); const t = document.querySelector('#tabbar'); const tr = t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect() : null; return { bottom: b.bottom, tabTop: tr ? tr.top : innerHeight, h: innerHeight }; });
  check('on a phone the save bar sits above the tab bar', bar.bottom <= bar.tabTop + 1 && bar.bottom > bar.h / 2, bar);

  // deleting, and signing out
  await go(a, `#/maker/${zzId}?tab=basics`, 1500); await a.click('[data-mkr="delete"]'); await a.waitForTimeout(1500);
  check('Delete removes the class from her account and goes back to the maker', !((await api(a, 'myclasses')).json.classes || []).some(c => c.id === zzId) && /#\/maker$/.test(a.url()));
  await n.evaluate(() => App.classSync.run(true)); await n.waitForTimeout(900);
  check('and the other browser drops it when it syncs', await n.evaluate(id => !Courses[id], zzId));
  await a.evaluate(() => App.auth.logout()); await a.waitForTimeout(1500);
  const left = await a.evaluate(() => ({ list: JSON.parse(localStorage.getItem('mh-my-classes') || '[]').length, reg: Object.keys(window.Courses).filter(k => /^my\d{4}$/.test(k)).length }));
  check('signing out takes her classes off this browser', left.list === 0 && left.reg === 0, left);

  // tidy up
  await go(a, '#/'); await login(a, ALICE);
  for (const c of ((await api(a, 'myclasses')).json.classes || [])) await api(a, 'myclass_delete', { id: c.id });
  await a.evaluate(h => { App.setSetting('classCustom', {}); return App.auth.savePrefs(h); }, had); await a.waitForTimeout(2800);
  for (const c of ((await api(b, 'myclasses')).json.classes || [])) await api(b, 'myclass_delete', { id: c.id });
  log('share code:', code);
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
