/* The heads-up a few days before an exam (api/growth.php, mh_exam_nudge_tick) and the review call it opens
   (Ask Bo's ?call=exam, assets/talk.js). Covered: one email per member and exam, 2 or 3 days before it, only in the
   classes they picked; its button opens a review call with Bo for Max members and anyone with free minutes, and the
   exam prep page for everyone else; the setting turns it off; the link opens the call with the exam card, and Bo is
   told it is an exam review (live and basic voice). The tick runs with a made-up "today"; mail is in log mode. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const { live, quiet } = require('./talk-fakes');
const API = path.join(__dirname, '..', 'api'); const DB = path.join(API, 'data', 'mathub.sqlite'); const LOG = path.join(API, 'data', 'mail.log');
const sh = (code, ...a) => require('child_process').spawnSync('php', ['-r', code, ...a]);
const sqlite = q => sh('$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', DB, q);
const ask = q => JSON.parse(String(sh('$d = new PDO("sqlite:" . $argv[1]); echo json_encode($d->query($argv[2])->fetchAll(PDO::FETCH_ASSOC));', DB, q).stdout) || '[]');
const tick = today => { const r = sh('chdir($argv[1]); require "lib.php"; require_once "social.php"; require_once "growth.php"; echo mh_exam_nudge_tick(80, true, $argv[2]);', API, today); return +String(r.stdout).trim() || 0; };
const BOB = 'bob.bmu6j92pq@montana.edu', MOD = 'mod.user@montana.edu';
const mailSince = n => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '').slice(n);
const mailLen = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').length : 0);
(async () => {
  const { mk, login, api, go, txt, check, log } = await T.start({ audio: true });
  const [c0, p0] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(p0, '#/', 500); await login(p0, MOD); await api(p0, 'me'); await c0.close();   // the columns and table exist
  const keep = ask(`SELECT id, courses, exam_checked FROM users WHERE email IN ('${BOB}', '${MOD}')`);
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 9999999999; UPDATE users SET courses = '["calc"]', exam_checked = 0, exam_nudge = 1 WHERE email IN ('${BOB}', '${MOD}'); DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = '${BOB}')`);

  // Calc I's Exam 1 is on Friday, September 18
  let m0 = mailLen(); let n = tick('2026-09-10');
  check('eight days before, nothing yet', n === 0 && mailSince(m0) === '', n);
  sqlite(`UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}')`);
  m0 = mailLen(); n = tick('2026-09-15'); const mail = mailSince(m0); log(mail.slice(0, 900));
  const to = (mail.match(/^\[[^\]]+\] to=\S+ subject="Calc I Exam 1 is in 3 days"/gm) || []).map(x => x.split('to=')[1].split(' ')[0]);
  check('three days before: one email each, with the exam in the subject', n === 2 && to.length === 2 && to.includes(BOB) && to.includes(MOD), { n, to });
  const part = who => mail.split(/^\[[^\]]+\] to=/m).find(x => x.startsWith(who)) || '';
  check('with the day, and a button that starts a review call with Bo on the free minutes', /Calc I Exam 1 is on Friday, Sep 18\./.test(part(BOB)) && /weakest topics/.test(part(BOB)) && /Start the review call with Bo: https?:\/\/\S+\/#\/tutor\/calc\?call=exam/.test(part(BOB)) && /Turn it off in Settings → Account/.test(part(BOB)), part(BOB).slice(0, 500));
  check('and for a Max member too', /#\/tutor\/calc\?call=exam/.test(part(MOD)));
  check('each exam once: the calendar row and the exam itself are one heads-up', ask('SELECT COUNT(*) AS n FROM exam_nudges')[0].n === 2);
  sqlite(`UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}')`);
  m0 = mailLen(); n = tick('2026-09-16');
  check('the next day: not again', n === 0 && !/Exam 1 is in/.test(mailSince(m0)), n);
  // used free minutes: the exam prep page instead; the setting off: nothing
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}'); INSERT OR REPLACE INTO ai_trial (user_id, used) VALUES ((SELECT id FROM users WHERE email = '${BOB}'), 100000); UPDATE users SET exam_nudge = 0 WHERE email = '${MOD}'`);
  m0 = mailLen(); n = tick('2026-09-16'); const mail2 = mailSince(m0);
  check('two days before, without Max or free minutes: the exam prep page', n === 1 && /subject="Calc I Exam 1 is in 2 days"/.test(mail2) && /Open exam prep: https?:\/\/\S+\/#\/calc\/exam/.test(mail2) && !/call=exam/.test(mail2), mail2.slice(0, 400));
  check('and nobody who turned it off', !new RegExp(`to=${MOD.replace('.', '\\.')}`).test(mail2));
  sqlite(`DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = '${BOB}')`);

  // the link: Ask Bo opens the call with the exam card; Start, and Bo is told it is an exam review
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await c.addInitScript(quiet); await c.addInitScript(live);
  await go(p, '#/', 500); await login(p, MOD); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', Date.now()); App.setSetting('boMode', ''); });
  await go(p, '#/settings', 1200);
  const box = await p.$('#acct-exam'); check('Settings → Account has the exam heads-up, off for this member', !!box && !(await box.isChecked()));
  await box.check(); await p.waitForTimeout(700); check('turning it on is saved', ask(`SELECT exam_nudge FROM users WHERE email = '${MOD}'`)[0].exam_nudge === 1);
  await go(p, '#/tutor/calc?call=exam', 2200);
  const card = await txt(p, '#bo-talk .bt-exam');
  check('the email’s link opens a call with Bo, with what the review is and Start', !!(await p.$('#bo-talk')) && /Exam review\./.test(card) && /weakest topics/.test(card) && !!(await p.$('#bo-talk .bt-exam [data-t="start"]')), card);
  check('and the address no longer asks for it, so a reload does not call again', /#\/tutor\/calc$/.test(p.url()), p.url());
  await p.click('#bo-talk .bt-exam [data-t="start"]'); await p.waitForTimeout(1500);
  const sess = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'live-last.json'), 'utf8')).session || {};
  check('Start: the call begins, and Bo is told it is an exam review, on their weakest topics', (await p.$eval('#bo-talk', e => e.dataset.state)) === 'live' && /THIS CALL IS AN EXAM REVIEW/.test(sess.instructions || '') && /WEAKEST TOPICS/.test(sess.instructions || ''));
  await p.click('.bt-end'); await p.waitForTimeout(800);
  await go(p, '#/tutor/calc', 1500); await p.click('.bo-talk-btn'); await p.waitForTimeout(400);
  check('an ordinary call has no exam card', !!(await p.$('#bo-talk')) && !(await p.$('#bo-talk .bt-exam')));
  await p.keyboard.press('Escape'); await c.close();

  // without Max and without free minutes: the link says so and points to the exam prep page
  sqlite(`INSERT OR REPLACE INTO ai_trial (user_id, used) VALUES ((SELECT id FROM users WHERE email = '${BOB}'), 100000)`);
  const [cb, b] = await mk(390, 844, { serviceWorkers: 'block' }); await cb.addInitScript(quiet); await cb.addInitScript(live);
  await go(b, '#/', 500); await login(b, BOB); await b.reload(); await b.waitForTimeout(700);
  await go(b, '#/tutor/calc?call=exam', 2000);
  check('without Max or free minutes: no call, a note that points to the exam prep page', !(await b.$('#bo-talk')) && /Your exam is close/.test(await txt(b, '.bo-exam-note')) && (await b.getAttribute('.bo-exam-note a', 'href')) === '#/calc/exam');
  sqlite(`DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = '${BOB}')`);
  await go(b, '#/tutor/calc?call=exam', 2000);
  check('with free minutes left, the review call opens on them', !!(await b.$('#bo-talk .bt-exam')) && /free minutes/.test(await txt(b, '#bo-talk')));
  await b.keyboard.press('Escape'); await cb.close();

  // put things back
  for (const k of keep) sqlite(`UPDATE users SET courses = ${k.courses === null ? 'NULL' : `'${String(k.courses).replace(/'/g, "''")}'`}, exam_checked = 0, exam_nudge = 1 WHERE id = ${k.id}`);
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 0; DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = '${BOB}'); DELETE FROM ai_live WHERE user_id IN (SELECT id FROM users WHERE email IN ('${BOB}', '${MOD}'))`);
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
