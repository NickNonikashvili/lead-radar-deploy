/* Instructors in a class (api/instruct.php, assets/instruct.js) and what students see of it (api/drafts.php,
   assets/drafts.js). Covered: who teaches a class (an administrator, the syllabus email, a StudyCat Faculty class's
   teaching team); the class settings (hints only and notes for Bo in his chat, each project's assignment sheet and
   rubric in a draft review, unknown projects dropped); sharing a version with the instructor (the shared list, one
   shared version, a reply the student sees and is told about, stopping, sharing switched off); patterns (nothing
   until five students let their drafts count, then counts by goal, never a name); the roster and credits given to it
   (from an administrator, and from an instructor's bought credits, refused when they have too few); and the pages:
   the Instructor item in the sidebar for staff only, the settings form (saved, kept on the device when not saved,
   rubric rows, an assignment sheet opened from a file), the shared list and a shared draft with a reply, patterns,
   credits, a student's share box and the reply on their review, the page for someone who does not teach, the
   #/instructors page, and a phone. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const php = (code, ...a) => require('child_process').spawnSync('php', ['-r', code, ...a.map(String)], { cwd: path.join(__dirname, '..') }).stdout.toString();
const sql = (q, ...a) => php('$d = new PDO("sqlite:" . $argv[1]); $d->exec("PRAGMA foreign_keys=ON"); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a);
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu', ADMIN = 'admin.user@montana.edu';
const PAT = [1, 2, 3, 4, 5].map(i => `pattern.student${i}@montana.edu`);
const DRAFT = "My grandmother's farmhouse sat at the end of a gravel road outside Big Timber. Every August the storms rolled down from the Crazy Mountains and the whole house held its breath. I remember the smell of rain on hot dust before the first drop fell.\n\nThe storm was really scary and it was a big deal for our family that summer. We sat on the porch and counted the seconds between the lightning and the thunder. She told me the brook would rise by morning, and it always did.\n\nNow the house is sold and the road is paved, but I still drive past it when I go home. Writing about it makes me realize how much a place can hold the people in it.";
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const last = () => JSON.parse(fs.readFileSync(LAST, 'utf8'));
  const sysOf = req => req.system.map(b => b.text).join('\n'); const userText = req => req.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('\n')).join('\n');
  const WHO = `(SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}', '${ADMIN}', '${PAT.join("', '")}'))`;
  const clean = () => {
    for (const q of [`DELETE FROM draft_reviews WHERE user_id IN ${WHO}`, "DELETE FROM class_ai WHERE course IN ('writ', 'calc')", "DELETE FROM draft_switch WHERE course = 'writ'", `DELETE FROM credit_use WHERE user_id IN ${WHO}`, `DELETE FROM credit_add WHERE user_id IN ${WHO} AND (kind IN ('sponsor', 'buy') AND ref LIKE 'test%' OR ref LIKE 'sponsor:%')`,
      `DELETE FROM notifications WHERE user_id IN ${WHO} AND kind IN ('draft_reply', 'draft_share', 'credits', 'peer_pair', 'peer_sent')`, "DELETE FROM rate WHERE key LIKE 'ai_draft%' OR key LIKE 'instruct%' OR key LIKE 'teachjoin%'", `DELETE FROM users WHERE email IN ('${PAT.join("', '")}')`]) { try { sql(q); } catch (e) {} }
  };
  clean();
  const setup = new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ', 'calc']; s.boFloatSeen = 1; s.aiConsent = Date.now(); s.asof = '2026-10-30'; s.lang = 'en'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  const open = async (email, w = 1360, h = 900) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };

  /* ---------- who teaches a class ---------- */
  const unit = php(`require "api/lib.php"; require "api/ai.php"; require "api/instruct.php";
    $C = ["COURSE" => ["email" => "Nicole.Hall4@montana.edu", "instructor" => "Dr. Nicole J. Hall"]];
    echo json_encode([mh_course_staff(["id" => 999999, "email" => "nicole.hall4@montana.edu"], "writ", $C), mh_course_staff(["id" => 999998, "email" => "someone@montana.edu"], "writ", $C), mh_course_staff(null, "writ", $C), mh_course_has_staff("writ", $C), mh_course_has_staff("zz", []), mh_course_staff_name($C)]);`);
  check('the syllabus email teaches the class (any letter case); someone else and no one signed in do not', unit.trim() === '[true,false,false,true,false,"Dr. Nicole J. Hall"]', unit);
  const [ca, a] = await open(ALICE); const [cd, d] = await open(ADMIN);
  for (const c of ((await api(d, 'teach_me')).teaching || []).filter(c => c.code === 'WRIT 101' && c.title === 'College Writing I')) await api(d, 'teach_class_delete', { id: c.id, confirm: 'WRIT 101' });   // left by an earlier run that stopped
  await api(d, 'admin_role', { email: ALICE, role: '' });
  sql(`DELETE FROM ai_threads WHERE user_id IN ${WHO}`);   // a short chat, so Bo's answer is the last request (not a summary of a long one)
  let r = await api(a, 'instruct_me');
  check('a student teaches no class', r.ok && r.admin === false && r.courses.length === 0, r);
  r = await api(d, 'instruct_me'); check('an administrator teaches every class', r.ok && r.admin === true, r);
  check('a student cannot open a class’s instructor settings', (await api(a, 'instruct_get&class=writ')).status === 403 && (await api(a, 'instruct_save', { class: 'writ', settings: { hints: true } })).status === 403 && (await api(a, 'instruct_shares&class=writ')).status === 403 && (await api(a, 'instruct_patterns&class=writ')).status === 403);
  r = await api(d, 'instruct_get&class=writ');
  check('the instructor’s view: the projects with their goals, and the defaults (sharing on, swaps off, Bo as usual)', r.ok && r.projects.map(p => p.id).join() === 'p1,p2,p3,pf' && r.projects[0].goals.length > 2 && r.settings.hints === false && r.settings.share === true && r.settings.peer === false && r.drafts_off === false && r.writing === true, r);

  /* ---------- the settings ---------- */
  const SHEET = 'Write 1,000 to 1,500 words about a place that matters to you. Use at least three scenes.';
  r = await api(d, 'instruct_save', { class: 'writ', settings: { hints: true, notes: 'We use MLA 9.\u0007 Never discuss the take-home exam.', share: true, peer: true, peer_days: 99, projects: { p1: { sheet: SHEET, rubric: [{ name: 'Focus', text: 'A clear sense of why the place matters.' }, { name: '', text: '' }, { name: 'Detail', text: 'Scenes a reader can see.' }] }, zz: { sheet: 'not a project' }, p2: { sheet: '', rubric: [] } } } });
  check('saved, cleaned: control characters out, days kept to 1 to 14, empty rubric rows, empty projects and unknown ones dropped', r.ok && r.settings.hints === true && r.settings.notes === 'We use MLA 9. Never discuss the take-home exam.' && r.settings.peer_days === 14 && Object.keys(r.settings.projects).join() === 'p1' && r.settings.projects.p1.rubric.length === 2 && r.settings.updated > 0, r.settings);
  r = await api(a, 'ai_tutor', { class: 'writ', q: 'Can you just give me the answer?' }); let s = sysOf(last());
  check('Bo’s chat in the class gets hints only and the instructor’s notes', r.ok && /HINTS ONLY/.test(s) && /NOTES FROM THIS CLASS'S INSTRUCTOR/.test(s) && /We use MLA 9\. Never discuss the take-home exam\./.test(s), s.slice(-600));
  r = await api(a, 'ai_tutor', { class: 'calc', q: 'hi' }); s = sysOf(last());
  check('another class’s chat does not', r.ok && !/HINTS ONLY/.test(s) && !/We use MLA 9/.test(s));
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: DRAFT, count: 1 }); const u1 = userText(last()); const v1 = r.review;
  check('a draft of that project is read against the assignment sheet and the rubric, without a grade', r.ok && u1.includes('THE ASSIGNMENT SHEET, from the instructor:\n' + SHEET) && /THE RUBRIC the instructor grades by \(read against it, but never give a grade, a score or a level\):\n- Focus: A clear sense of why the place matters\.\n- Detail: Scenes a reader can see\./.test(u1) && u1.indexOf('THE RUBRIC') < u1.indexOf('THE DRAFT ('), u1.slice(0, 900));
  check('Bo is asked which goal each revision is about, and the answer is kept as a goal number', /"goal": the number of the goal in ITS GOALS/.test(sysOf(last())) && v1.feedback.revisions.every(x => Number.isInteger(x.goal) && x.goal >= 0 && x.goal <= 5) && v1.feedback.revisions[0].goal === 2, v1.feedback.revisions);
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p2', stage: 'draft', text: DRAFT });
  check('another project has no sheet in its review', r.ok && !userText(last()).includes('THE ASSIGNMENT SHEET'));
  check('the draft she let count is counted, the other is not', rows(`SELECT counted FROM draft_reviews WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY id`, ALICE).map(x => +x.counted).join() === '1,0');

  /* ---------- sharing a version ---------- */
  r = await api(a, `ai_draft_get&class=writ&id=${v1.id}`);
  check('her review says she can share it, with whom, and that it is not shared', r.ok && r.can_share === true && r.staff_name === 'Dr. Nicole J. Hall' && r.review.share === null, { can: r.can_share, who: r.staff_name, share: r.review && r.review.share });
  r = await api(a, 'ai_draft_share', { class: 'writ', id: v1.id, note: 'Is my ending too quiet?' });
  check('she shares it with a note', r.ok && r.share.note === 'Is my ending too quiet?' && r.share.created > 0, r);
  const [cb, b] = await open(BOB);
  check('nobody else can share her version, or see the class’s shared drafts', (await api(b, 'ai_draft_share', { class: 'writ', id: v1.id })).status === 404 && (await api(b, `instruct_share_get&class=writ&id=${v1.id}`)).status === 403);
  r = await api(d, 'instruct_shares&class=writ');
  check('the instructor’s list: her version, new, with her note', r.ok && r.shares.length === 1 && r.shares[0].id === v1.id && r.shares[0].student.email === ALICE && r.shares[0].note === 'Is my ending too quiet?' && r.shares[0].seen === false && r.shares[0].project === 'p1', r.shares);
  r = await api(d, 'instruct_get&class=writ'); check('and a count of unseen ones', r.unseen === 1, r.unseen);
  r = await api(d, `instruct_share_get&class=writ&id=${v1.id}`);
  check('one shared version: the draft, Bo’s feedback, her answers, her note, and her other shared versions of that project', r.ok && r.review.text === DRAFT && r.review.feedback.revisions.length >= 2 && r.share.note === 'Is my ending too quiet?' && r.student.email === ALICE && r.shared.map(x => x.id).join() === String(v1.id), r);
  check('opening it marks it seen', (await api(d, 'instruct_shares&class=writ')).shares[0].seen === true);
  r = await api(d, 'instruct_reply', { class: 'writ', id: v1.id, text: 'The ending works. Try reading it aloud.' });
  check('the instructor replies', r.ok && r.reply === 'The ending works. Try reading it aloud.' && r.replied > 0, r);
  r = await api(a, `ai_draft_get&class=writ&id=${v1.id}`);
  check('she sees the reply on that version, and is told in her inbox', r.review.share.reply === 'The ending works. Try reading it aloud.' && rows(`SELECT link FROM notifications WHERE kind = 'draft_reply' AND user_id = (SELECT id FROM users WHERE email = ?)`, ALICE).some(n => n.link === `#/writ/drafts/${v1.id}`), r.review.share);
  r = await api(a, 'ai_draft_unshare', { class: 'writ', id: v1.id });
  check('she can stop sharing it: it leaves the instructor’s list', r.ok && (await api(d, 'instruct_shares&class=writ')).shares.length === 0 && (await api(d, `instruct_share_get&class=writ&id=${v1.id}`)).status === 404);
  await api(d, 'instruct_save', { class: 'writ', settings: { hints: true, notes: 'We use MLA 9.', share: false, projects: {} } });
  r = await api(a, 'ai_draft_share', { class: 'writ', id: v1.id, note: 'x' });
  check('with sharing switched off, nothing can be shared', r.status === 403 && (await api(a, `ai_draft_get&class=writ&id=${v1.id}`)).can_share === false, r);
  await api(d, 'instruct_save', { class: 'writ', settings: { hints: false, notes: '', share: true, projects: { p1: { sheet: SHEET, rubric: [{ name: 'Focus', text: 'Why the place matters.' }] } } } });
  await api(a, 'ai_draft_share', { class: 'writ', id: v1.id, note: 'Second look, please.' });

  /* ---------- patterns ---------- */
  r = await api(d, 'instruct_patterns&class=writ'); let p1 = r.projects.find(p => p.id === 'p1');
  check('patterns wait for five students who let their drafts count (one so far), with nothing about them', r.ok && p1.enough === false && p1.students === 1 && p1.min === 5 && p1.goals === undefined && !JSON.stringify(r).includes(ALICE), p1);
  for (const e of PAT) sql("INSERT INTO users (email, name, pass_hash, verified, created) VALUES (?, 'Pattern', 'x', 1, strftime('%s','now'))", e);
  const fb = goals => JSON.stringify({ overall: 'x', revisions: goals.map((g, i) => ({ title: 'R' + i, why: 'w', where: '', found: false, ask: '', goal: g })), comments: [], strengths: [], since: [{ point: 'R0', status: 'partly', note: '' }], next: [] });
  PAT.slice(0, 3).forEach((e, i) => sql("INSERT INTO draft_reviews (user_id, course, project, version, stage, words, text, ask, peer, feedback, created, responses, counted) VALUES ((SELECT id FROM users WHERE email = ?), 'writ', 'p1', 1, ?, ?, 'x', '', '', ?, strftime('%s','now'), ?, 1)", e, i ? 'revised' : 'draft', 400 + i * 100, fb(i === 2 ? [2, 0] : [2, 1]), i === 0 ? '{"r0":{"s":"done","why":""},"c1":{"s":"disagree","why":"no"}}' : '{}'));
  sql("INSERT INTO draft_reviews (user_id, course, project, version, stage, words, text, ask, peer, feedback, created, responses, counted) VALUES ((SELECT id FROM users WHERE email = ?), 'writ', 'p1', 1, 'draft', 900, 'x', '', '', ?, strftime('%s','now'), '{}', 0)", PAT[3], fb([3]));
  r = await api(d, 'instruct_patterns&class=writ'); p1 = r.projects.find(p => p.id === 'p1');
  check('four students counted: still nothing (a draft that was not let count is left out)', p1.enough === false && p1.students === 4, p1);
  sql("INSERT INTO draft_reviews (user_id, course, project, version, stage, words, text, ask, peer, feedback, created, responses, counted) VALUES ((SELECT id FROM users WHERE email = ?), 'writ', 'p1', 1, 'draft', 1000, 'x', '', '', ?, strftime('%s','now'), '{}', 1)", PAT[4], fb([2, 2, 5]));
  r = await api(d, 'instruct_patterns&class=writ'); p1 = r.projects.find(p => p.id === 'p1'); const g = p1.goals || [];
  check('five: how many drafts Bo named each goal in (once per draft), something else, the stages, the middle length', p1.enough === true && p1.students === 5 && p1.drafts === 5 && p1.first === 3 && p1.revised === 2 && g.length === 5 && g[1].drafts === 5 && g[0].drafts === 3 && g[4].drafts === 1 && p1.other === 1 && p1.words === 500, { g, other: p1.other, words: p1.words, first: p1.first });
  check('what became of his revisions and how students answered his notes, and still no names, quotes or drafts', p1.since.partly === 4 && p1.answers.done === 1 && p1.answers.disagree === 1 && !/Pattern|pattern\.student|grandmother/.test(JSON.stringify(r)), { since: p1.since, answers: p1.answers });

  /* ---------- the roster and credits ---------- */
  r = await api(d, 'instruct_roster&class=writ');
  check('without a StudyCat Faculty class there is no roster', r.ok && r.classes.length === 0 && r.students.length === 0, r);
  const made = await api(d, 'teach_class_create', { code: 'WRIT 101', title: 'College Writing I', term: 'Fall 2026', section: '030', link_course: 'writ' }); const tid = made.id;
  const syl = (await api(d, 'teach_class_get&id=' + tid)).syllabus; syl.people[0].name = syl.people[0].name || 'Admin User'; syl.people[0].hours = 'MWF 10'; syl.exams = [{ name: 'Portfolio', date: '2026-12-11', time: '', place: '', covers: '' }];
  syl.schedule = { start: '2026-08-24', end: '2026-12-11', rows: [{ date: '2026-08-24', type: 'lecture', title: 'Welcome', notes: '' }] };
  syl.papers = [{ name: 'Paper 1: Explaining a study', brief: 'Explain one study for a general reader.', goals: 'A clear claim\n- The study in plain words\n\n3. What it leaves out', draft: '2026-11-02', revised: '2026-11-16' }, { name: '', brief: 'no name', goals: '', draft: '', revised: '' }];
  syl.notebook = { count: 6, due: '2026-12-10' };
  r = await api(d, 'teach_class_save', { id: tid, syllabus: syl });
  check('the Faculty syllabus takes papers and a notebook; a paper with no name is flagged', r.ok && r.lint.some(x => x[2] === 'papers' && /Paper 2 needs a name/.test(x[1])), r.lint);
  r = await api(d, 'teach_class_publish', { id: tid });
  const code = (await api(d, 'teach_class_get&id=' + tid)).class.join_code;
  check('a Faculty class linked to WRIT 101 is published', r.ok && !!code, r);
  const pk = (await api(d, 'classpack_get&id=' + r.pack_id)).pack || {};
  check('its class gets draft feedback for its papers (goals one per line, bullets and numbers dropped), their due dates, and a writer’s notebook', JSON.stringify(pk.DRAFTS) === JSON.stringify([{ id: 'p1', short: 'Paper 1', name: 'Paper 1: Explaining a study', brief: 'Explain one study for a general reader.', goals: ['A clear claim', 'The study in plain words', 'What it leaves out'] }]) && pk.NOTEBOOK && pk.NOTEBOOK.count === 6 && pk.CALENDAR.some(e => e[0] === '2026-11-02' && /Paper 1: Explaining a study \(first draft\)/.test(e[2])) && pk.CALENDAR.some(e => e[0] === '2026-12-10' && /writer’s notebook/.test(e[2])), { DRAFTS: pk.DRAFTS, NOTEBOOK: pk.NOTEBOOK });
  const fpid = r.pack_id;
  check('Alice and Bob join it', (await api(a, 'teach_join', { code })).ok && (await api(b, 'teach_join', { code })).ok);
  r = await api(b, 'ai_draft_list&class=' + fpid); const nbk = await api(b, 'notebook_list&class=' + fpid);
  check('in that class Bob has draft feedback and a notebook of 6, and its instructor is the one he can share with', r.ok && r.can_share === true && nbk.ok && nbk.count === 6, { r, nbk });
  check('and its owner is its instructor', (await api(d, 'instruct_get&class=' + fpid)).ok && (await api(b, 'instruct_get&class=' + fpid)).status === 403);
  r = await api(d, 'instruct_roster&class=writ');
  check('the roster: its students, by name', r.ok && r.classes.length === 1 && r.classes[0].code === 'WRIT 101' && r.students.map(x => x.email).sort().join() === [ALICE, BOB].sort().join() && r.admin === true, r);
  check('a gift needs a number of credits in range and the roster as it is', (await api(d, 'instruct_sponsor', { class: 'writ', credits: 0, expect: 2 })).status === 400 && (await api(d, 'instruct_sponsor', { class: 'writ', credits: 99999, expect: 2 })).status === 400 && (await api(d, 'instruct_sponsor', { class: 'writ', credits: 50, expect: 3 })).status === 409);
  const before = await api(a, 'credits_status');
  r = await api(d, 'instruct_sponsor', { class: 'writ', credits: 50, expect: 2 });
  const after = await api(a, 'credits_status');
  check('an administrator gives 50 each: both students have them, as bought credits that never expire', r.ok && r.students === 2 && r.total === 100 && after.paid - before.paid === 50 && after.adds.some(x => /^From .* for WRIT 101/.test(x.note) && x.credits === 50), { r, paid: [before.paid, after.paid], adds: after.adds && after.adds.slice(0, 2) });
  check('they are told', rows(`SELECT COUNT(*) AS n FROM notifications WHERE kind = 'credits' AND user_id IN (SELECT id FROM users WHERE email IN (?, ?))`, ALICE, BOB)[0].n === 2);
  r = await api(d, 'instruct_roster&class=writ'); check('and it is in the list of gifts', r.given.length === 1 && /50 each for 2 students in WRIT 101/.test(r.given[0].note), r.given);
  // Alice helps teach it (a TA): an instructor who is not an administrator pays from the credits she bought
  r = await api(d, 'teach_staff_add', { id: tid, email: ALICE }); check('Alice is added as a TA', r.ok, r);
  r = await api(a, 'instruct_get&class=writ'); check('so she can open the class’s instructor settings', r.ok, r.status);
  r = await api(a, 'instruct_roster&class=writ'); check('her roster is the students (Bob), not herself', r.students.map(x => x.email).join() === BOB, r.students);
  r = await api(a, 'instruct_sponsor', { class: 'writ', credits: 100, expect: 1 });
  check('with only the 50 she was given she cannot give 100 (402)', r.status === 402 && r.credits === true && /takes 100 credits, and you have 50 you bought or were given/.test(r.error), r);
  sql("INSERT INTO credit_add (user_id, kind, mc, ref, note, created) VALUES ((SELECT id FROM users WHERE email = ?), 'buy', 150000, 'test-buy', 'test', strftime('%s','now'))", ALICE);
  const bobBefore = (await api(b, 'credits_status')).paid;
  r = await api(a, 'instruct_sponsor', { class: 'writ', credits: 100, expect: 1 });
  check('with 150 more bought, she gives Bob 100: hers go down by 100, his up', r.ok && (await api(a, 'credits_status')).paid === 100 && (await api(b, 'credits_status')).paid - bobBefore === 100, r);

  /* ---------- the pages ---------- */
  await go(d, '#/writ/dashboard', 1600);
  check('an instructor has Instructor in the class’s sidebar', await d.evaluate(() => [...document.querySelectorAll('#sidebar-nav [data-view]')].some(x => /instructor$/.test(x.dataset.view))));
  await go(b, '#/writ/dashboard', 1600);
  check('a student does not', !(await b.evaluate(() => [...document.querySelectorAll('#sidebar-nav [data-view]')].some(x => /instructor$/.test(x.dataset.view)))));
  await go(b, '#/writ/instructor', 1600);
  check('and the page tells them it is for the class’s instructors', /This page is for the class’s instructors/.test(await txt(b, '#view')) && !(await b.$('#in-form')));
  await d.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings')); s.instrTab = 'settings'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(d, '#/writ/instructor', 1800);
  const page = await d.evaluate(() => ({ tabs: [...document.querySelectorAll('.in-page .tab')].map(x => x.textContent.trim()).join('|'), hints: document.querySelector('[name="hints"]').checked, share: document.querySelector('[name="share"]').checked, sheet: document.querySelector('#in-sheet-p1').value, rub: document.querySelectorAll('.in-proj[data-p="p1"] .in-rub-row').length, sum: document.querySelector('.in-proj[data-p="p1"] .in-proj-sum').textContent, on: document.querySelector('[data-action="in-switch"]').textContent.trim() }));
  check('the page: four tabs (one new share), the saved settings, a project’s sheet and rubric', page.tabs === 'Settings|Shared with you (1)|Patterns|Credits' && page.hints === false && page.share === true && page.sheet === SHEET && page.rub === 1 && page.sum === 'assignment sheet · 1 criterion' && page.on === 'Turn it off', page);
  await d.check('[name="hints"]'); await d.fill('#in-notes', 'Use APA 7 for sources.');
  await d.click('.in-proj[data-p="p2"] > summary'); await d.click('.in-proj[data-p="p2"] [data-action="in-rub-add"]'); await d.fill('.in-proj[data-p="p2"] .in-rub-row [data-rn]', 'Sources'); await d.fill('.in-proj[data-p="p2"] .in-rub-row [data-rt]', 'Each source is introduced.');
  check('not saved yet, it says so', /Not saved yet/.test(await txt(d, '#in-state')) && (await txt(d, '.in-proj[data-p="p2"] .in-proj-sum')) === '1 criterion');
  await d.reload(); await d.waitForTimeout(1800);
  check('unsaved changes wait on this device after a reload', await d.evaluate(() => document.querySelector('[name="hints"]').checked && document.querySelector('#in-notes').value === 'Use APA 7 for sources.' && document.querySelectorAll('.in-proj[data-p="p2"] .in-rub-row').length === 1) && /your changes from last time/.test(await txt(d, '#in-state')));
  const DOCX = require('child_process').execFileSync('python3', ['-I', '-c', 'import io, sys, zipfile\nb = io.BytesIO()\nz = zipfile.ZipFile(b, "w")\nz.writestr("[Content_Types].xml", "<Types/>")\nz.writestr("word/document.xml", \'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Project 2 asks for an argument.</w:t></w:r></w:p><w:p><w:r><w:t>Use three sources.</w:t></w:r></w:p></w:body></w:document>\')\nz.close()\nsys.stdout.buffer.write(b.getvalue())']);
  await d.setInputFiles('#in-file-p2', { name: 'p2.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: DOCX }); await d.waitForTimeout(700);
  check('an assignment sheet opens from a file', (await d.inputValue('#in-sheet-p2')) === 'Project 2 asks for an argument.\n\nUse three sources.');
  await d.click('#in-form button[type="submit"]'); await d.waitForTimeout(900);
  r = await api(d, 'instruct_get&class=writ');
  check('Save keeps it all, and the device copy goes', r.settings.hints === true && r.settings.notes === 'Use APA 7 for sources.' && r.settings.projects.p2.sheet === 'Project 2 asks for an argument.\n\nUse three sources.' && r.settings.projects.p2.rubric[0].name === 'Sources' && r.settings.projects.p1.sheet === SHEET && (await txt(d, '#in-state')) === 'Saved' && await d.evaluate(() => !localStorage.getItem('mathub-instr-writ')), r.settings);
  await d.click('[data-action="in-switch"]'); await d.waitForTimeout(800);
  check('draft feedback switched off from here, in place', (await api(a, 'ai_draft_list&class=writ')).off === true && (await txt(d, '[data-action="in-switch"]')) === 'Turn it on');
  await d.click('[data-action="in-switch"]'); await d.waitForTimeout(800);
  await d.click('.in-page .tab[data-tab="shared"]'); await d.waitForTimeout(400);
  check('Shared with you: her version, new, with her note', /Alice/.test(await txt(d, '#in-shared')) && /Second look, please\./.test(await txt(d, '#in-shared')) && !!(await d.$('#in-shared .in-share.new')));
  await d.click('#in-shared .in-share'); await d.waitForTimeout(1500);
  const sv = await d.evaluate(() => ({ hash: location.hash, marks: document.querySelectorAll('.in-sv .df-paper .df-mark').length, note: (document.querySelector('.in-sv .callout') || {}).textContent || '', revs: document.querySelectorAll('.in-sv .df-revs li').length, reply: document.querySelector('#in-reply').value }));
  check('a shared draft: her draft with Bo’s marks, his revisions and her note (shared again after she stopped, so no reply yet)', /#\/writ\/instructor\/share\/\d+$/.test(sv.hash) && sv.marks >= 2 && sv.revs >= 2 && /Second look, please\./.test(sv.note) && sv.reply === '', sv);
  await d.fill('#in-reply', 'Better. Now trim the middle.'); await d.click('[data-action="in-reply"]'); await d.waitForTimeout(800);
  check('replying from the page', (await api(a, `ai_draft_get&class=writ&id=${v1.id}`)).review.share.reply === 'Better. Now trim the middle.' && /Sent/.test(await txt(d, '#in-reply-state')));
  check('the shared draft fits and has no errors', await hscroll(d));
  await go(d, '#/writ/instructor?tab=patterns', 1800);
  const pat = await d.evaluate(() => ({ on: !document.querySelector('#in-patterns').closest('.pane').hidden, bars: document.querySelectorAll('#in-patterns .in-goalbars li').length, text: document.querySelector('#in-patterns').textContent }));
  check('Patterns: Project 1 with a bar for each goal and something else; the others wait for five', pat.on && pat.bars === 6 && /5 drafts from 5 students/.test(pat.text) && /Patterns show once 5 have/.test(pat.text), pat);
  await go(d, '#/writ/instructor?tab=credits', 1800);
  check('Credits: the roster (Bob; Alice now helps teach) and a total as the number changes', /1 student has joined WRIT 101 030/.test(await txt(d, '#in-credits')) && /1 student × 100 credits = 100 credits in all/.test(await txt(d, '#in-total')), await txt(d, '#in-credits'));
  await d.fill('#in-each', '25'); check('the total follows', /1 student × 25 credits = 25 credits in all/.test(await txt(d, '#in-total')));
  await d.click('#in-give button[type="submit"]'); await d.waitForTimeout(1500);
  check('giving them from the page (after a confirm)', (await api(d, 'instruct_roster&class=writ')).given.length === 2);

  /* her side: the share box and the reply on her review */
  await go(a, `#/writ/drafts/${v1.id}`, 1800);
  const mine = await a.evaluate(() => ({ box: (document.querySelector('.df-share-box') || {}).textContent || '', reply: (document.querySelector('.df-reply') || {}).textContent || '' }));
  check('her review: shared with Dr. Hall, and his reply', /Shared with Dr\. Nicole J\. Hall/.test(mine.box) && /Better\. Now trim the middle\./.test(mine.reply), mine);
  await a.click('[data-action="df-unshare"]'); await a.waitForTimeout(800);
  check('Stop sharing, from the page', (await api(d, 'instruct_shares&class=writ')).shares.length === 0 && !!(await a.$('[data-action="df-share"]')));
  await a.click('[data-action="df-share"]'); await a.waitForTimeout(300);
  await a.fill('#df-share-note', 'One more time.'); await a.click('[data-action="df-share-send"]'); await a.waitForTimeout(900);
  check('and Share with your instructor, with a note', (await api(d, 'instruct_shares&class=writ')).shares[0].note === 'One more time.' && /Shared with Dr\. Nicole J\. Hall/.test(await txt(a, '.df-share-box')));
  await go(a, '#/writ/drafts', 1600);
  check('the form offers to let a draft count in the class’s patterns, off until she ticks it', await a.evaluate(() => { const c = document.querySelector('#df-counted'); return !!c && !c.closest('[hidden]') && !c.checked && /without your name/.test(c.closest('label').textContent); }));

  /* #/instructors, and a phone */
  await go(b, '#/instructors', 1200);
  check('#/instructors: what Bo does, what instructors control and see, credits, privacy, getting started', (await b.$$('.ins-card')).length === 6 && /Hints only/.test(await txt(b, '#view')) && /only once five have/.test(await txt(b, '#view')) && await hscroll(b));
  const [cp, ph] = await open(ADMIN, 390, 844);
  for (const h of ['#/writ/instructor', `#/writ/instructor/share/${v1.id}`, '#/instructors']) { await go(ph, h, 1800); check(`fits a phone: ${h}`, await hscroll(ph)); }
  await cp.close();

  /* clean up: the Faculty class, Alice's TA role, the rows made here */
  await api(d, 'teach_class_delete', { id: tid, confirm: 'WRIT 101' }); await api(d, 'admin_role', { email: ALICE, role: '' });
  await ca.close(); await cb.close(); await cd.close();
  clean();
  await T.finish();
})();
