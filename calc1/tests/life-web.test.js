/* ============================================================
   Your planner and the frame on every page, in the browser
   (assets/shell.js, life.js, life-school.js, life-self.js, dash.js, api/life.php):
   - the sidebar and header on every page: Now (date, clock, semester, month and week), New and its
     shortcuts, Home / Today / Ask Bo, your classes, School, Life, Future, Explore, a month calendar
     with dots; on a class page its own menu first; the header's place, the soonest exam and a clock
     that opens a bigger one with the time back home; the faculty workspace keeps its own frame
   - quick add (Alt+N): task, assignment, exam, event, to-do, class time, spending, note
   - Tasks: this week by day, a line to add, ticking off, the board, deadlines from the syllabus
   - Timetable: meeting times read from each syllabus, a week grid, overlaps side by side, a calendar file
   - Calendar: a month with exams, the day from the sidebar's calendar, a week and a list
   - Time tracker, Projects & thesis, Habits, Goals, Wheel of life, Journal, Money, Internships & jobs, Portfolio
   - the start page: Your day (schedule, due this week, clock, pomodoro, to-dos, events, habits, goals,
     wheel, this week), Customize, class cards with their numbers
   - the account: the planner follows it to another browser, merges record by record, leaves on log out
   - phones: the drawer, nothing wider than the screen
   ============================================================ */
const T = require('./lib');
(async () => {
  const { mk, txt, login, api, go, hscroll, check } = await T.start();
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const setup = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.boFloatSeen = true; s.courses = s.courses || ['calc', 'physics', 'writ']; s.asof = '2026-10-13'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} };
  const open = async (w = 1440, h = 900, more = {}) => { const [c, p] = await mk(w, h, Object.assign({ serviceWorkers: 'block', reducedMotion: 'reduce' }, more)); await c.addInitScript(quiet); await c.addInitScript(setup); await go(p, '#/', 900); return [c, p]; };
  const hop = async (p, hash, wait = 900) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(wait); };
  const shown = (p, s) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
  const L = (p, fn, ...args) => p.evaluate(([f, a]) => (new Function('L', 'a', 'return (' + f + ')(L, a)'))(App.life, a), [fn.toString(), args]);

  /* ---------- the frame ---------- */
  const [c1, p] = await open();
  for (const h of ['#/', '#/today', '#/gpa', '#/tasks']) { await hop(p, h, 700); check(`${h}: the sidebar and the header are there`, await shown(p, '#sidebar') && await shown(p, '#topbar')); }
  const side = await p.evaluate(() => ({ date: (document.querySelector('.sb-date') || {}).textContent, time: (document.querySelector('.sb-time') || {}).textContent, bars: [...document.querySelectorAll('#sb-now .sb-bar')].map(b => b.querySelector('span').textContent + ' ' + b.querySelector('b').textContent), qa: [...document.querySelectorAll('.sb-qa-btn')].map(b => b.dataset.qa), groups: [...document.querySelectorAll('#sb-nav .sb-toggle')].map(b => b.textContent.replace(/\d+/g, '').trim()), today: (document.querySelector('.sb-day.today') || {}).textContent, dots: document.querySelectorAll('.sb-day i').length, exam: document.querySelectorAll('.sb-day.exam').length }));
  check('Now: the date and a live clock', /Oct 13/.test(side.date) && /\d:\d\d/.test(side.time), side);
  check('three bars: the week of the semester, the month and the week, in percent', side.bars.length === 3 && /^Week 8 of 17 \d+%$/.test(side.bars[0]) && /^October \d+%$/.test(side.bars[1]) && /^This week \d+%$/.test(side.bars[2]), side.bars);
  check('New, with shortcuts for a task, an assignment, an exam, an event, a to-do and class time', side.qa.join(',') === 'task,assignment,exam,event,todo,slot', side.qa);
  check('groups: your classes, School, Life, Future, Explore', ['Your classes', 'School', 'Life', 'Future', 'Explore'].every(g => side.groups.includes(g)), side.groups);
  check('the month calendar marks today, days with something due and exam days', /^13/.test(side.today) && side.dots > 5 && side.exam >= 1, side);
  const crumb = await txt(p, '#topbar-title');
  check('the header says where you are', /School\s*›\s*Tasks/.test(crumb), crumb);
  const chip = await p.evaluate(() => { const c = document.querySelector('#exam-chip'); return { shown: !c.hidden, text: c.textContent.replace(/\s+/g, ' ').trim(), href: c.dataset.href }; });
  check('the header shows the soonest exam of all your classes and goes to that class', chip.shown && /Exam 2/.test(chip.text) && /^#\/(calc|physics)\/dashboard$/.test(chip.href), chip);
  await p.click('.sb-time'); await p.waitForTimeout(300);
  const ck = await p.evaluate(() => { const pop = document.querySelector('.pop-clock'); return pop && { face: !!pop.querySelector('svg.ck-face'), hands: !!pop.querySelector('[data-hand="s"]').getAttribute('transform'), zones: pop.querySelectorAll('[data-zone] option').length }; });
  check('the clock opens a ticking face with the time back home to pick', ck && ck.face && ck.hands && ck.zones > 20, ck);
  await p.selectOption('.pop-clock [data-zone]', 'Asia/Tbilisi'); await p.waitForTimeout(400);
  const home = await p.evaluate(() => ({ side: (document.querySelector('.sb-home') || {}).textContent || '', cfg: App.life.cfg('homeZone') }));
  check('the time back home shows under the date', home.cfg === 'Asia/Tbilisi' && /Tbilisi\s+\d/.test(home.side), home);
  await p.keyboard.press('Escape');
  await hop(p, '#/calc/notes', 1400);
  const cls = await p.evaluate(() => ({ nav: !!document.querySelector('#sidebar-nav .nav-item[data-view="notes"]'), mine: getComputedStyle(document.querySelector('.sb-classbox .brand')).display !== 'none', classesGroup: !!document.querySelector('#sb-nav [data-g="classes"]'), qa: getComputedStyle(document.querySelector('.sb-qa')).display, crumb: document.querySelector('#topbar-title').textContent }));
  check('on a class page its own menu comes first, the shortcuts fold into New', cls.nav && cls.mine && !cls.classesGroup && cls.qa === 'none', cls);
  await hop(p, '#/teach', 1600);
  check('the faculty workspace keeps its own frame', !(await shown(p, '#sidebar')) && !(await shown(p, '#topbar')));
  await hop(p, '#/', 800);
  await p.click('#sb-hide'); await p.waitForTimeout(300);
  const hidState = () => p.evaluate(() => { const m = document.querySelector('#topbar .menu-btn').getBoundingClientRect(); return { hidden: document.querySelector('.app').classList.contains('side-hidden'), sidebar: getComputedStyle(document.querySelector('.sidebar')).display, menu: getComputedStyle(document.querySelector('#topbar .menu-btn')).display !== 'none' && m.top >= 0 && m.bottom <= 80, label: document.querySelector('#topbar .menu-btn').getAttribute('aria-label'), clock: getComputedStyle(document.querySelector('#tb-clock')).display !== 'none', page: Math.round(document.querySelector('#view').getBoundingClientRect().top) }; });
  const hid = await hidState();
  check('the sidebar tucks away on the start page (gone, not stretched over the page); the menu button at the top brings it back and the header shows the clock meanwhile', hid.hidden && hid.sidebar === 'none' && hid.menu && hid.label === 'Show the sidebar' && hid.clock && hid.page < 120, hid);
  await hop(p, '#/tasks', 900); const hid2 = await hidState();
  check('and on a planner page', hid2.sidebar === 'none' && hid2.menu && hid2.page < 140, hid2);
  await hop(p, '#/', 800);
  await p.click('#topbar .menu-btn'); await p.waitForTimeout(300);
  check('and it comes back', !(await p.evaluate(() => document.querySelector('.app').classList.contains('side-hidden'))));

  /* ---------- quick add ---------- */
  await hop(p, '#/tasks', 900);
  await p.keyboard.press('Alt+n'); await p.waitForTimeout(300);
  check('Alt+N opens quick add with its kinds', await p.evaluate(() => document.querySelectorAll('.lf-modal .lf-type').length === 8));
  await p.fill('.lf-modal input[name="title"]', 'Problem set 7'); await p.click('.lf-modal .lf-type[data-type="assignment"]'); await p.waitForTimeout(200);
  check('switching the kind keeps what was typed', (await p.inputValue('.lf-modal input[name="title"]')) === 'Problem set 7' && (await p.inputValue('.lf-modal select[name="kind"]')) === 'assignment');
  await p.selectOption('.lf-modal select[name="course"]', 'calc'); await p.fill('.lf-modal input[name="due"]', '2026-10-15'); await p.click('.lf-modal .lf-seg-opt.tone-high'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(500);
  const t1 = await L(p, L => L.all('tasks').find(x => x.title === 'Problem set 7'));
  check('the assignment is saved with its class, date and priority', t1 && t1.course === 'calc' && t1.due === '2026-10-15' && t1.priority === 'high' && t1.kind === 'assignment', t1);
  check('and it is on the page, on its day', /Problem set 7/.test(await txt(p, '#tk-week')));
  await p.click('.sb-qa-btn[data-qa="event"]'); await p.waitForTimeout(300);
  await p.fill('.lf-modal input[name="title"]', 'Study group'); await p.fill('.lf-modal input[name="date"]', '2026-10-14'); await p.fill('.lf-modal input[name="time"]', '18:00'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(400);
  await p.click('.sb-qa-btn[data-qa="todo"]'); await p.waitForTimeout(300); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(200);
  check('a required field says what is missing and keeps the dialog open', /To-do is needed/.test(await txt(p, '.lf-err')) && await shown(p, '.lf-modal'));
  await p.fill('.lf-modal input[name="title"]', 'Buy a blue book'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  check('Enter saves', await L(p, L => L.all('todos').some(x => x.title === 'Buy a blue book')) && !(await shown(p, '.lf-modal')));

  /* ---------- tasks ---------- */
  await p.fill('#tk-quick input[name="title"]', 'Email my advisor'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check('a line to add a task for today', /Email my advisor/.test(await txt(p, '#tk-week')) && await p.evaluate(() => document.activeElement && document.activeElement.name === 'title'));
  const stats0 = await txt(p, '#tk-stats');
  await p.click('.tk-row:has-text("Email my advisor") .tk-check'); await p.waitForTimeout(400);
  check('ticking a task marks it done and counts it', await L(p, L => L.all('tasks').find(x => x.title === 'Email my advisor').status === 'done') && (await txt(p, '#tk-stats')) !== stats0);
  await p.click('.dash-tabs .tab[data-tab="board"]'); await p.waitForTimeout(300);
  const board = await p.evaluate(() => [...document.querySelectorAll('.kb-col')].map(c => c.dataset.status + ':' + c.querySelectorAll('.kb-card').length));
  check('the board has To do, In progress and Done', board.length === 3 && /^todo:\d/.test(board[0]) && /^done:[1-9]/.test(board[2]), board);
  await p.click('.kb-col[data-status="todo"] .kb-card:has-text("Problem set 7") [data-to="doing"]'); await p.waitForTimeout(300);
  check('a card moves to In progress', await L(p, L => L.all('tasks').find(x => x.title === 'Problem set 7').status === 'doing'));
  await p.click('.lf-page [data-action="import"]'); await p.waitForTimeout(300);
  const imp = await p.evaluate(() => [...document.querySelectorAll('.lf-pick b')].map(b => b.textContent));
  check('deadlines from the classes\' syllabi can come in as tasks', imp.length >= 3 && imp.some(x => /WebWork/.test(x)) && imp.some(x => /Exam 2/.test(x)), imp.slice(0, 6));
  await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(500);
  const fromSyl = await L(p, L => L.all('tasks').filter(x => x.from === 'class').length);
  check('they are added', fromSyl === imp.length, { fromSyl, n: imp.length });
  const dupes = await L(p, L => { const it = L.items('2026-10-13', '2026-10-20'); const k = it.map(x => x.date + '|' + x.title.toLowerCase()); return k.length - new Set(k).size; });
  check('and the calendar shows each one once, not twice', dupes === 0, dupes);

  /* ---------- timetable ---------- */
  const parsed = await p.evaluate(() => ['Mon / Wed / Fri, 9:00–9:50 am, Lewis 306', 'Tue · Thu 9:25–10:40 am, Lewis 304. Labs in Harrison 101A (Mon, Tue, Wed or Thu by section)', 'Section 01: Tue · Thu 12:15–1:30 pm, Romney 315. Section 02: Mon · Wed 3:10–4:20 pm, Cheever 215', 'Mon · Wed · Fri in Barnard 103 · 11:00 am (Sect 1) or 1:10 pm (Sect 2)'].map(s => App.life.parseMeets(s).map(m => `${m.days.join('')} ${m.start}-${m.end} ${m.place}`.trim())));
  check('meeting times are read from syllabus text', parsed[0][0] === '135 09:00-09:50 Lewis 306' && parsed[1][0] === '24 09:25-10:40 Lewis 304' && parsed[2][0] === '24 12:15-13:30 Romney 315' && parsed[2][1] === '13 15:10-16:20 Cheever 215' && parsed[3].length === 2 && /^135 11:00-11:50/.test(parsed[3][0]) && /^135 13:10-14:00/.test(parsed[3][1]), parsed);
  await hop(p, '#/timetable', 900);
  check('an empty timetable offers to bring the classes in', await shown(p, '.tt-start'));
  await p.click('.tt-start [data-action="import"]'); await p.waitForTimeout(400);
  const rows = await p.evaluate(() => [...document.querySelectorAll('.tt-imp-row')].map(r => ({ c: r.dataset.c, on: r.querySelector('input[name="pick"]').checked, start: r.querySelector('input[name="start"]').value })));
  check('each class is listed with what its syllabus says, ready to add', rows.some(r => r.c === 'writ' && r.on && r.start === '09:00') && rows.some(r => r.c === 'physics'), rows);
  await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(600);
  const tt = await p.evaluate(() => ({ blocks: document.querySelectorAll('.tt-block').length, writ: [...document.querySelectorAll('.tt-block')].filter(b => /WRIT|Writing/.test(b.textContent)).length, today: document.querySelectorAll('.tt-dh.today').length }));
  check('the week grid shows a block per meeting, today marked', tt.blocks >= 6 && tt.writ === 3 && tt.today === 1, tt);
  await p.click('.tt-col[data-dow="2"] .tt-cell[data-h="15"]'); await p.waitForTimeout(300);
  check('an empty hour opens Add at that day and time', (await p.inputValue('.lf-modal input[name="start"]')) === '15:00' && await p.isChecked('.lf-modal .lf-day input[value="2"]'));
  await p.fill('.lf-modal input[name="title"]', 'Shift at the SUB'); await p.fill('.lf-modal input[name="end"]', '14:00'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(200);
  check('it has to end after it starts', /end after it starts/.test(await txt(p, '.lf-err')));
  await p.fill('.lf-modal input[name="end"]', '18:00'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('[data-action="ics"]')]);
  let ics = ''; if (dl) { const fs = require('fs'); ics = fs.readFileSync(await dl.path(), 'utf8'); }
  check('the timetable downloads as a calendar file with weekly repeats', /BEGIN:VCALENDAR/.test(ics) && /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261218/.test(ics) && /SUMMARY:Shift at the SUB/.test(ics), ics.slice(0, 200));

  /* ---------- calendar ---------- */
  await hop(p, '#/agenda?d=2026-10-16', 1000);
  const ag = await p.evaluate(() => ({ label: document.querySelector('#ag-label').textContent, sel: (document.querySelector('.ag-cell.sel .ag-n') || {}).textContent, exam: [...document.querySelectorAll('.ag-cell .ag-item.k-exam')].map(x => x.textContent.trim()), panel: document.querySelector('.ag-day h3').textContent }));
  check('the month, the day from the link picked, exams in coral', ag.label === 'October 2026' && ag.sel === '16' && ag.exam.some(x => /Exam 2/.test(x)) && ag.panel === 'Friday', ag);
  await p.click('[data-action="mode"][data-m="week"]'); await p.waitForTimeout(300);
  const wk = await p.evaluate(() => ({ days: document.querySelectorAll('.ag-wday').length, slots: document.querySelectorAll('.ag-wday .ag-slot').length, study: /Study group/.test(document.querySelector('.ag-week').textContent) }));
  check('the week shows timetable meetings and your events', wk.days === 7 && wk.slots >= 6 && wk.study, wk);
  await p.click('[data-action="mode"][data-m="list"]'); await p.waitForTimeout(300);
  check('and a list, day by day', (await p.$$('.ag-lday')).length >= 5);
  await p.click('[data-action="mode"][data-m="month"]'); await p.waitForTimeout(200);

  /* ---------- the rest of the planner ---------- */
  await hop(p, '#/timelog', 800);
  await p.selectOption('#tl-form select[name="course"]', 'physics'); await p.fill('#tl-form input[name="what"]', 'Lab prep'); await p.click('[data-action="start"]'); await p.waitForTimeout(300);
  await L(p, L => { const tm = L.cfg('timer'); L.setCfg('timer', Object.assign({}, tm, { start: Date.now() - 42 * 60000 })); });
  await p.reload(); await p.waitForTimeout(1200);
  check('the timer survives a reload', /00:4[12]:\d\d/.test(await txt(p, '#tl-clock')));
  await p.click('[data-action="stop"]'); await p.waitForTimeout(400);
  const tl = await L(p, L => L.all('timelog').find(x => x.what === 'Lab prep'));
  check('stopping saves the time for the class', tl && tl.course === 'physics' && tl.mins >= 41 && tl.mins <= 43, tl);
  check('the week and the class totals show it', /4[123] min/.test(await txt(p, '.tl-week')) && /Physics I/.test(await txt(p, '.tl-per')));

  await hop(p, '#/projects', 800);
  await p.click('[data-action="new"]'); await p.waitForTimeout(300);
  await p.fill('.lf-modal input[name="title"]', 'Senior thesis'); await p.selectOption('.lf-modal select[name="type"]', 'thesis'); await p.fill('.lf-modal input[name="due"]', '2026-12-10'); await p.fill('.lf-modal input[name="words"]', '8000'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(500);
  const pj = await p.evaluate(() => ({ steps: document.querySelectorAll('.pj-steps li').length, dates: [...document.querySelectorAll('.pj-steps li small')].map(s => s.textContent), words: !!document.querySelector('.pj-words') }));
  check('a thesis starts with its usual steps spread until the due date', pj.steps === 11 && pj.dates.length === 11 && pj.words, pj);
  await p.click('.pj-steps li:first-child .tk-check'); await p.waitForTimeout(300);
  check('ticking a step moves the bar', /1 of 11 steps/.test(await txt(p, '.pj-prog')));

  await hop(p, '#/habits', 800);
  await p.click('.hb-idea[data-i="0"]'); await p.waitForTimeout(300);
  await p.click('.hb-tile'); await p.waitForTimeout(300);
  const hb = await L(p, L => { const h = L.all('habits')[0]; return { today: !!(h.log || {})[L.today()], st: L.habitStats(h) }; });
  check('a suggested habit, ticked for today, starts a streak', hb.today && hb.st.day === 1, hb);
  await p.click('.hb-card .hb-sq:not([disabled])'); await p.waitForTimeout(300);
  check('past days of this week can be ticked too', await L(p, L => Object.keys(L.all('habits')[0].log).length === 2));

  await hop(p, '#/goals', 800);
  await p.click('.gl-q.now [data-action="new"]'); await p.waitForTimeout(300);
  await p.fill('.lf-modal input[name="title"]', 'B+ in Calculus I'); await p.fill('.lf-modal textarea[name="krs"]', 'Every WebWork on time\nOffice hours twice'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(400);
  await p.click('.gl-q.now .gl-kr'); await p.waitForTimeout(300);
  check('a goal in this quarter with its steps; ticking one makes it 50%', /50%/.test(await txt(p, '.gl-q.now .gl-goal')));

  await hop(p, '#/wheel', 800);
  await p.$eval('#wl-money', el => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(900);
  const wl = await L(p, L => (L.get('wheel', L.today().slice(0, 7)) || {}).scores);
  check('moving a slider saves this month\'s wheel', wl && wl.money === 3 && wl.health === 5, wl);
  await hop(p, '#/wheel', 600);
  check('the lowest part offers a goal', /Lowest right now: Money \(3\)/.test(await txt(p, '.wl-low')));

  await hop(p, '#/journal', 800);
  await p.click('.jr-mood.m4'); await p.fill('#jr-text', 'Finally understood the chain rule.'); await p.fill('#jr-form input[name="g1"]', 'Coffee with Sam'); await p.waitForTimeout(1100);
  const jr = await L(p, L => L.day('journal', L.today()));
  check('the page saves as you write: mood, words, good things', jr && jr.mood === 4 && /chain rule/.test(jr.text) && jr.grat[0] === 'Coffee with Sam', jr);
  await p.click('.dash-tabs .tab[data-tab="all"]'); await p.waitForTimeout(200); await p.fill('#jr-q', 'chain'); await p.waitForTimeout(300);
  check('every page is searchable', (await p.$$('.jr-row')).length === 1 && await p.evaluate(() => document.activeElement.id === 'jr-q'));

  await hop(p, '#/money', 800);
  for (const [type, amount, cat] of [['in', '900', 'Job'], ['out', '42.5', 'Food'], ['out', '650', 'Rent']]) { await p.click(`[data-action="add"][data-type="${type}"]`); await p.waitForTimeout(250); await p.fill('.lf-modal input[name="amount"]', amount); await p.selectOption('.lf-modal select[name="cat"]', cat); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(250); }
  const mn = await txt(p, '#mn-body .lf-stats');
  check('in, out and what is left this month', /\$900\.00/.test(mn) && /\$692\.50/.test(mn) && /\$207\.50/.test(mn), mn);
  await p.click('[data-action="budgets"]'); await p.waitForTimeout(300); await p.fill('.lf-modal input[name="b0"]', '30'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(300);
  check('a budget only counts its own category, and going over it shows', /Over budget/.test(await txt(p, '#mn-body .lf-stats')) && /-\$12\.50|−\$12\.50/.test(await txt(p, '#mn-body .lf-stats')) && await p.evaluate(() => !!document.querySelector('.mn-cat.over')));

  await hop(p, '#/career', 800);
  await p.click('.cr-start [data-action="new"]'); await p.waitForTimeout(300); await p.fill('.lf-modal input[name="company"]', 'Boeing'); await p.fill('.lf-modal input[name="deadline"]', '2026-10-25'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(400);
  await p.click('.kb-col[data-status="wish"] [data-to="applied"]'); await p.waitForTimeout(300);
  check('an application moves from the wishlist to applied', await L(p, L => L.all('apps')[0].status === 'applied') && /Boeing/.test(await txt(p, '.kb-col[data-status="applied"]')));
  await hop(p, '#/portfolio', 800);
  await p.click('[data-action="profile"]'); await p.waitForTimeout(300); await p.fill('.lf-modal input[name="name"]', 'Riley Hart'); await p.fill('.lf-modal input[name="headline"]', 'Engineering student'); await p.fill('.lf-modal textarea[name="links"]', 'https://github.com/riley\njavascript:alert(1)'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(300);
  const pf = await p.evaluate(() => ({ name: document.querySelector('.pf-h h2').textContent, links: [...document.querySelectorAll('.pf-contact a')].map(a => a.getAttribute('href')) }));
  check('the portfolio shows the details, and only real web links', pf.name === 'Riley Hart' && pf.links.length === 1 && pf.links[0] === 'https://github.com/riley', pf);

  /* ---------- the start page ---------- */
  await hop(p, '#/', 1200);
  const dash = await p.evaluate(() => ({ cards: [...document.querySelectorAll('#dash-grid > .dw')].map(c => c.dataset.w), due: document.querySelector('.dwc-due').textContent.replace(/\s+/g, ' '), sched: document.querySelectorAll('.dw-sched li').length, todo: /Buy a blue book/.test(document.querySelector('.dwc-todos').textContent), ev: /Study group/.test(document.querySelector('.dwc-events').textContent), habit: document.querySelectorAll('.dw-habit').length, goal: /50%/.test(document.querySelector('.dwc-goals').textContent), wheel: !!document.querySelector('.dwc-wheel svg.radar'), week: document.querySelectorAll('.dw-day').length, stats: [...document.querySelectorAll('.course-card .cc-stats')].length }));
  check('Your day: ten cards', dash.cards.join(',') === 'schedule,due,clock,pomo,todos,events,habits,goals,wheel,week', dash.cards);
  check('due this week, today\'s schedule, to-dos, events, habits, goals, the wheel and the week are filled from the planner', /Problem set 7/.test(dash.due) && dash.sched >= 1 && dash.todo && dash.ev && dash.habit === 1 && dash.goal && dash.wheel && dash.week === 7, dash);
  check('each class card has its numbers', dash.stats >= 3, dash.stats);
  await p.click('.dwc-pomo [data-dw="mode"][data-m="long"]'); await p.waitForTimeout(200);
  check('the pomodoro has a long break, and the sidebar\'s timer follows', (await txt(p, '#dw-pomo-time')) === '15:00' && (await txt(p, '#pomo-time')) === '15:00' && /Long break/.test(await txt(p, '#pomo-mode')));
  await p.click('.dwc-pomo [data-dw="pomo"]'); await p.waitForTimeout(2200);
  check('it runs in both places', /^14:5\d$/.test(await txt(p, '#dw-pomo-time')) && (await txt(p, '#pomo-time')) === (await txt(p, '#dw-pomo-time')));
  await p.click('.dwc-pomo [data-dw="reset"]');
  await p.fill('.dwc-todos input[name="title"]', 'Print the lab'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check('a to-do added on the start page', /Print the lab/.test(await txt(p, '.dwc-todos')) && await p.evaluate(() => document.activeElement && document.activeElement.closest('.dwc-todos') !== null));
  await p.click('[data-dw="custom"]'); await p.waitForTimeout(300); await p.uncheck('.lf-modal input[name="wheel"]'); await p.click('.lf-modal button[type="submit"]'); await p.waitForTimeout(300);
  check('Customize hides a card and remembers it', !(await p.$('.dwc-wheel')) && await p.evaluate(() => (App.settings().homeHide || []).includes('wheel')));
  const heroCtl = await p.evaluate(() => [...document.querySelectorAll('.landing-top .hero-actions > *')].map(e => e.className));
  check('the hero keeps Today and For professors; search, sounds, theme and the account are in the header', heroCtl.length === 2 && /hero-today/.test(heroCtl[0]) && /hero-faculty/.test(heroCtl[1]) && !!(await p.$('#topbar .amb-top')) && !!(await p.$('#topbar .theme-btn')), heroCtl);
  await c1.close();

  /* ---------- the account ---------- */
  const tag = 'Sync check ' + Date.now().toString(36);
  const [ca, a] = await open(); await login(a, 'alice.a@montana.edu'); await a.reload(); await a.waitForTimeout(1500);
  await L(a, (L, [tag]) => { L.saveTask({ title: tag, due: '2026-10-14', priority: 'medium', status: 'todo', kind: 'task' }); L.add('events', { title: tag + ' event', date: '2026-10-15', remind: '' }); }, tag);
  await a.waitForTimeout(3600);
  const srv = (await api(a, 'life')).json || {};
  check('the planner is saved to the account', srv.ok && (srv.life.tasks || []).some(x => x.title === tag) && (srv.life.events || []).some(x => x.title === tag + ' event'), srv.ok);
  const [cb, b] = await open(); await login(b, 'alice.a@montana.edu'); await b.reload(); await b.waitForTimeout(2200);
  check('it comes back in another browser', await L(b, (L, [tag]) => L.all('tasks').some(x => x.title === tag), tag));
  // both change at once: a ticks it, b adds another; neither loses the other's
  const id = await L(a, (L, [tag]) => L.all('tasks').find(x => x.title === tag).id, tag);
  await L(a, (L, [id]) => L.put('tasks', id, { status: 'done' }), id); await L(b, (L, [tag]) => L.saveTask({ title: tag + ' 2', due: '', priority: 'low', status: 'todo', kind: 'task' }), tag);
  await a.waitForTimeout(3600); await L(a, L => L.sync()); await L(b, L => L.sync()); await b.waitForTimeout(800);
  const merged = await L(b, (L, [tag, id]) => ({ done: (L.get('tasks', id) || {}).status, two: L.all('tasks').some(x => x.title === tag + ' 2') }), tag, id);
  check('two devices changing at once merge record by record', merged.done === 'done' && merged.two, merged);
  await L(b, (L, [id]) => L.remove('tasks', id), id); await b.waitForTimeout(3600); await L(a, L => L.sync()); await a.waitForTimeout(500);
  check('a deletion reaches the other device', await L(a, (L, [id]) => !L.get('tasks', id), id));
  const stale = (await api(a, 'life', { life: { tasks: [{ id, title: 'old copy', u: 1 }] } }, 'PUT')).json || {};
  check('the server keeps the newer copy when an old one arrives', stale.ok && (stale.life.tasks.find(x => x.id === id) || {}).del === 1, stale.ok && stale.life.tasks.find(x => x.id === id));
  const bigR = await api(a, 'life', { life: { journal: { '2026-01-01': { u: Date.now(), text: 'x'.repeat(700000) } } } }, 'PUT'); const big = bigR.json || {};
  check('and refuses a planner over its size', bigR.status === 413 && !big.ok && /too large/.test(big.error || ''), big.error);
  await a.evaluate(() => App.auth.logout()); await a.waitForTimeout(1200);
  check('logging out takes the planner off this computer', await L(a, (L, [tag]) => !L.all('tasks').some(x => x.title.startsWith(tag)) && !L.state().owner, tag));
  await ca.close(); await cb.close();

  /* ---------- phones ---------- */
  const [cm, m] = await open(390, 844);
  await L(m, L => { L.saveTask({ title: 'Read chapter 4', due: L.today(), priority: 'medium', status: 'todo', kind: 'task', course: 'physics' }); L.add('slots', { title: 'Calc lecture', course: 'calc', kind: 'lecture', days: [1, 3, 5], start: '09:00', end: '09:50' }); });
  for (const h of ['#/', '#/tasks', '#/timetable', '#/agenda', '#/habits', '#/goals', '#/wheel', '#/journal', '#/money', '#/career', '#/portfolio', '#/timelog', '#/projects']) { await hop(m, h, 800); check(`phone ${h}: nothing wider than the screen`, await hscroll(m)); }
  check('phone: the sidebar waits in the drawer', !(await m.evaluate(() => document.querySelector('.app').classList.contains('nav-open'))));
  await m.click('#topbar .menu-btn'); await m.waitForTimeout(300);
  check('the menu button opens it, with the planner in it', await m.evaluate(() => document.querySelector('.app').classList.contains('nav-open') && document.querySelector('#sidebar').getBoundingClientRect().left >= 0 && !!document.querySelector('#sb-nav a[href="#/tasks"]')));
  await m.click('#sb-nav a[href="#/habits"]'); await m.waitForTimeout(600);
  check('and a link in it closes it', !(await m.evaluate(() => document.querySelector('.app').classList.contains('nav-open'))) && /#\/habits$/.test(m.url()));
  await cm.close();
  await T.finish();
})();
