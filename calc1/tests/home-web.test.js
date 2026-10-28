/* ============================================================
   Your home, the website's start page (assets/dash.js) and exam week:
   - widgets instead of stacked sections and no learning path: Up next (the class picked: next exam, readiness, the
     next lesson), Today across all classes, Bo, what is due, today's schedule, this week and your classes; a first
     visit starts with the classes and the three steps
   - Arrange: drag a widget anywhere by its handle, resize it from its corner, let widgets overlap and bring one to
     the front or send it to the back, remove one, add one back (and a note), the arrow keys move and resize, Tidy up
     packs them without overlaps, Start over puts them back; the layout is kept after a reload
   - phones: the widgets stack in reading order, and move up and down
   - from 7 days before an exam: a plan for today and for each day until the exam, on the start page (Up next) and
     the class page; the timed practice exam opens the quizzer in exam mode
   ============================================================ */
const T = require('./lib');
(async () => {
  const { mk, txt, go, hscroll, check } = await T.start();
  const setup = asof => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['calc', 'physics', 'precalc']; s.lastVisit = { hash: '#/calc/notes/1.3', label: 'Calc I · Notes', course: 'calc', t: Date.now() - 3600000 }; s.appClass = 'calc'; if (asof) s.asof = asof; else delete s.asof; if (!sessionStorage.getItem('kept')) { delete s.homeLayout; sessionStorage.setItem('kept', '1'); } localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} };
  const open = async (w, h, asof) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup, asof); await go(p, '#/', 900); await p.evaluate(() => App.addXP(10, { course: 'calc', silent: true })); await p.reload(); await p.waitForTimeout(2200); return [c, p]; };
  const lay = p => p.evaluate(() => App.dash.layout().items);
  const at = (items, id) => items.find(i => i.id === id);
  const box = (p, sel) => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

  // calc's Exam 2 is on Oct 16, 2026: three days after Oct 13 is exam week, ten days before is not
  const [c1, p] = await open(1360, 900, '2026-10-13');
  const ids = await p.$$eval('#dash-canvas > .dw', w => w.map(x => x.dataset.w));
  check('returning students get Your home: Up next, Today, Bo, Due this week, the schedule, this week and their classes', ids.join() === 'next,today,bo,due,schedule,week,classes', ids);
  check('no learning path on the start page any more, and no stacked sections', !(await p.$('#view .ap-li, #view .ah-pathsec, #view .land-more, #view .land-next, #view .course-grid')));
  const next = await p.evaluate(() => { const h = document.querySelector('.dw[data-w="next"]'); return h && { tabs: [...h.querySelectorAll('.wh-tab')].map(t => t.textContent.trim()), on: (h.querySelector('.wh-tab.on') || {}).textContent, hero: (h.querySelector('.ah-hero h2') || {}).textContent, go: (h.querySelector('.ah-go') || {}).getAttribute ? h.querySelector('.ah-go').getAttribute('href') : '' }; });
  check('Up next: a tab for each class, the last one studied picked', next && next.tabs.join('|') === 'Calc I|Physics I|Precalc' && next.on === 'Calc I', next);
  check('the class card: its name and the next lesson', next && /Calculus I/.test(next.hero) && /#\/calc\/lesson\?topics=/.test(next.go), next);
  check('Today across all classes, and their classes with their next exams', /of 30 XP|XP/.test(await txt(p, '.dw[data-w="today"]')) && (await p.$$('.dw[data-w="classes"] .dwk')).length === 3);
  // exam week, in Up next
  const xw = await p.evaluate(() => { const x = document.querySelector('.dw[data-w="next"] .xw'); return x && { h: x.querySelector('h2').textContent, items: [...x.querySelectorAll('.xw-today .xw-item')].map(a => [a.querySelector('b').textContent, a.getAttribute('href')]), days: [...x.querySelectorAll('.xw-plan li')].map(li => li.querySelector('b').textContent), last: ([...x.querySelectorAll('.xw-plan li')].pop() || {}).textContent || '', heroExam: !!document.querySelector('.dw[data-w="next"] .ah-hero .ah-ex') }; });
  check('exam week: Up next names the exam and the days left', xw && /Exam week: Exam 2 in 3 days/.test(xw.h), xw && xw.h);
  check('today\'s plan starts with the weakest topic as a lesson', xw && /^Weakest topic: /.test(xw.items[0][0]) && /#\/calc\/lesson\?topics=/.test(xw.items[0][1]), xw && xw.items);
  check('with flashcards, a timed practice exam and the prep checklist', xw && xw.items.some(i => /flashcard/.test(i[0])) && xw.items.some(i => i[0] === 'Timed practice exam' && /#\/calc\/practice\?exam=.+&timed=1/.test(i[1])) && xw.items.some(i => /Prep checklist: \d+ of \d+/.test(i[0])), xw && xw.items);
  check('a plan for each day: today, tomorrow, the day before, exam day', xw && xw.days.length === 4 && xw.days[0] === 'Today' && xw.days[1] === 'Tomorrow' && /Exam day/.test(xw.last), xw && xw.days);
  check('the class card does not repeat the exam row during exam week', xw && !xw.heroExam);
  await p.click('.dw[data-w="next"] .wh-tab[data-id="physics"]'); await p.waitForTimeout(1500);
  check('picking another class in Up next shows its card', /Physics/.test(await txt(p, '.dw[data-w="next"] .ah-hero h2')) && await p.evaluate(() => document.querySelector('.dw[data-w="next"] .wh-tab.on').dataset.id === 'physics'));
  await p.click('.dw[data-w="next"] .wh-tab[data-id="calc"]'); await p.waitForTimeout(1200);

  // arranging
  check('the handles are hidden until Arrange', !(await p.isVisible('.dw[data-w="due"] .dw-grip')));
  await p.click('[data-dw="arrange"]'); await p.waitForTimeout(300);
  check('Arrange shows the grid, the handles, the corners and Tidy up and Start over', await p.evaluate(() => document.querySelector('#dash-canvas').classList.contains('editing')) && await p.isVisible('.dw[data-w="due"] .dw-grip') && await p.isVisible('.dw[data-w="due"] .dw-rs') && await p.isVisible('[data-dw="tidy"]'));
  let before = at(await lay(p), 'due');
  await p.$eval('.dw[data-w="due"] .dw-grip', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  let g = await box(p, '.dw[data-w="due"] .dw-grip'); const nb = await box(p, '.dw[data-w="next"]');
  await p.mouse.move(g.x + 12, g.y + 12); await p.mouse.down(); await p.mouse.move(nb.x + 120, nb.y + 60, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(500);
  let L1 = await lay(p); let due = at(L1, 'due'), nxt = at(L1, 'next');
  check('dragging a widget by its handle moves it, on the grid, and saves', (due.x !== before.x || due.y !== before.y) && Number.isInteger(due.x) && Number.isInteger(due.y), [before, due]);
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  check('widgets can overlap, and the one moved last is on top', overlap(due, nxt) && due.z > nxt.z && await p.evaluate(() => +getComputedStyle(document.querySelector('.dw[data-w="due"]')).zIndex > +getComputedStyle(document.querySelector('.dw[data-w="next"]')).zIndex), [due, nxt]);
  await p.click('.dw[data-w="due"] [data-dwe="back"]'); await p.waitForTimeout(200);
  L1 = await lay(p); check('Send to the back puts it under the others', at(L1, 'due').z < at(L1, 'next').z, [at(L1, 'due'), at(L1, 'next')]);
  await p.click('.dw[data-w="next"] [data-dwe="back"]'); await p.waitForTimeout(200); await p.click('.dw[data-w="due"] [data-dwe="front"]'); await p.waitForTimeout(200);
  L1 = await lay(p); check('Bring to the front puts it on top again', at(L1, 'due').z > Math.max(...L1.filter(i => i.id !== 'due').map(i => i.z)));
  before = at(L1, 'due'); await p.$eval('.dw[data-w="due"] .dw-rs', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const r = await box(p, '.dw[data-w="due"] .dw-rs'); await p.mouse.move(r.x + 8, r.y + 8); await p.mouse.down(); await p.mouse.move(r.x + 130, r.y + 100, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500);
  due = at(await lay(p), 'due');
  check('dragging the corner resizes it, on the grid', due.w > before.w && due.h > before.h, [before, due]);
  // the keyboard
  before = due; await p.focus('.dw[data-w="due"] .dw-grip'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  due = at(await lay(p), 'due'); check('the arrow keys move it a step on the grid', due.x === Math.max(0, before.x - 1) && due.y === before.y + 1, [before, due]);
  await p.focus('.dw[data-w="due"] .dw-grip'); await p.keyboard.press('Shift+ArrowDown'); await p.waitForTimeout(300);
  check('Shift with an arrow key resizes it', at(await lay(p), 'due').h === due.h + 1);
  // remove, add back, a note
  await p.click('.dw[data-w="schedule"] [data-dwe="remove"]'); await p.waitForTimeout(300);
  check('a widget can be removed', !(await p.$('.dw[data-w="schedule"]')) && !at(await lay(p), 'schedule'));
  await p.click('[data-dw="add"]'); await p.waitForTimeout(400);
  const boxes = await p.$$eval('.lf-check input[type="checkbox"]', x => x.length);
  check('Add a widget lists every widget (18), the ones shown ticked', boxes === 18, boxes);
  await p.check('.lf-check input[name="schedule"]'); await p.check('.lf-check input[name="note"]');
  await p.click('.lf-foot .btn.primary'); await p.waitForTimeout(700);
  L1 = await lay(p);
  check('and adds them back, below the others', !!at(L1, 'schedule') && !!at(L1, 'note') && at(L1, 'note').y >= Math.max(...L1.filter(i => !['schedule', 'note'].includes(i.id)).map(i => i.y)), L1.map(i => i.id));
  await p.fill('#dw-note', 'Ask about problem 4 in office hours'); await p.waitForTimeout(900);
  check('the note is saved as it is typed', (await p.evaluate(() => App.dash.layout().note)) === 'Ask about problem 4 in office hours');
  await p.click('[data-dw="tidy"]'); await p.waitForTimeout(500);
  L1 = await lay(p); check('Tidy up packs them into the grid with no overlaps', L1.every((a, i) => L1.every((b, j) => i === j || !overlap(a, b))), L1);
  await p.click('[data-dw="arrange"]'); await p.waitForTimeout(300);
  check('Done ends arranging', !(await p.evaluate(() => document.querySelector('#dash-canvas').classList.contains('editing'))));
  const kept = JSON.stringify(await lay(p)); await p.reload(); await p.waitForTimeout(2200);
  check('after a reload the home is as it was left, note and all', JSON.stringify(await lay(p)) === kept && (await p.inputValue('#dw-note')) === 'Ask about problem 4 in office hours');
  await p.click('[data-dw="arrange"]'); await p.waitForTimeout(200); await p.click('[data-dw="home-reset"]'); await p.waitForTimeout(600);
  check('Start over puts the home back as it came', (await p.$$eval('#dash-canvas > .dw', w => w.map(x => x.dataset.w).join())) === 'next,today,bo,due,schedule,week,classes');
  check('no sideways scroll with Arrange on', await hscroll(p));
  // the class page
  await go(p, '#/calc/dashboard', 1800);
  const dash = await p.evaluate(() => { const x = document.querySelector('.xw-dash .xw'); return x && { wide: x.classList.contains('xw-wide'), afterHead: x.parentElement.previousElementSibling && x.parentElement.previousElementSibling.classList.contains('page-head'), planOpen: x.querySelector('.xw-plan').open }; });
  check('the class page shows exam week right under its heading, with the plan open', dash && dash.wide && dash.afterHead && dash.planOpen, dash);
  const timed = await p.$eval('.xw-dash .xw-item[href*="timed=1"]', a => a.getAttribute('href'));
  await go(p, timed, 1500);
  check('"Timed practice exam" opens the quizzer in exam mode on the exam\'s topics', /practice/.test(p.url()) && await p.evaluate(() => (document.querySelector('#pq-mode') || {}).value === 'exam'), p.url());
  await c1.close();

  // ten days out: no exam week
  const [c2, q] = await open(1360, 900, '2026-10-06');
  check('more than 7 days before the exam there is no exam-week plan', !(await q.$('.xw')) && !!(await q.$('.dw[data-w="next"] .ah-hero .ah-ex')));
  await go(q, '#/calc/dashboard', 1500); check('nor on the class page', !(await q.$('.xw')));
  await c2.close();

  // phones
  const [c3, m] = await open(390, 844, '2026-10-13');
  const st = await m.evaluate(() => { const c = document.querySelector('#dash-canvas'); const ws = [...c.children].filter(x => x.classList.contains('dw')); return { stacked: c.classList.contains('stacked'), statics: ws.every(w => getComputedStyle(w).position === 'relative'), order: ws.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(w => w.dataset.w).join() }; });
  check('phone: the widgets stack in reading order, and nothing scrolls sideways', st.stacked && st.statics && st.order === 'next,today,bo,due,schedule,week,classes' && await hscroll(m), st);
  await m.click('[data-dw="arrange"]'); await m.waitForTimeout(300);
  await m.click('.dw[data-w="today"] [data-dwe="up"]'); await m.waitForTimeout(300);
  const order2 = await m.evaluate(() => [...document.querySelectorAll('#dash-canvas > .dw')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(w => w.dataset.w).slice(0, 2).join());
  check('phone: Arrange moves a widget up', order2 === 'today,next', order2);
  await go(m, '#/calc/dashboard', 1500); check('phone: the class page with exam week does not scroll sideways', await hscroll(m) && !!(await m.$('.xw')));
  await c3.close();

  // a first visit: the classes and the three steps
  const [c4, f] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(f, '#/', 1500);
  const fw = await f.$$eval('#dash-canvas > .dw', w => w.map(x => x.dataset.w));
  check('a first visit starts with the classes, Bo and the guides, and the three steps', fw[0] === 'classes' && fw.includes('bo') && !fw.includes('next') && (await f.$$('.start-steps .start-step')).length === 3, fw);
  await c4.close();
  await T.finish();
})();
