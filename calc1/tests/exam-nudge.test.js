/* The heads-up a few days before an exam (api/growth.php, mh_exam_nudge_tick) and the review call it opens
   (Ask Bo's ?call=exam, assets/talk.js). Covered: one email per member and exam, 2 or 3 days before it, only in the
   classes they picked; its button opens a review call with Bo for anyone with credits for one (about five minutes'
   worth, api/credits.php), and the exam prep page for everyone else; the setting turns it off; the link opens the call with the exam card, and Bo is
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
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 9999999999; UPDATE users SET courses = '["calc"]', exam_checked = 0, exam_nudge = 1 WHERE email IN ('${BOB}', '${MOD}'); DELETE FROM credit_use WHERE ref = 'test-out'`);
  const OUT = `INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES ((SELECT id FROM users WHERE email = '${BOB}'), strftime('%s','now'), 'other', 100000, 100000, 0, 'test-out', 'test')`;   // his month's credits, used up

  // Calc I's Exam 1 is on Friday, September 18
  let m0 = mailLen(); let n = tick('2026-09-10');
  check('eight days before, nothing yet', n === 0 && mailSince(m0) === '', n);
  sqlite(`UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}')`);
  m0 = mailLen(); n = tick('2026-09-15'); const mail = mailSince(m0); log(mail.slice(0, 900));
  const to = (mail.match(/^\[[^\]]+\] to=\S+ subject="Calc I Exam 1 is in 3 days"/gm) || []).map(x => x.split('to=')[1].split(' ')[0]);
  check('three days before: one email each, with the exam in the subject', n === 2 && to.length === 2 && to.includes(BOB) && to.includes(MOD), { n, to });
  const part = who => mail.split(/^\[[^\]]+\] to=/m).find(x => x.startsWith(who)) || '';
  check('with the day, and a button that starts a review call with Bo (he has credits for one)', /Calc I Exam 1 is on Friday, Sep 18\./.test(part(BOB)) && /weakest topics/.test(part(BOB)) && /Start the review call with Bo: https?:\/\/\S+\/#\/tutor\/calc\?call=exam/.test(part(BOB)) && /Stop these emails: https?:\/\/\S+\/#\/unsubscribe\?k=exam&u=\d+&t=[0-9a-f]{32}/.test(part(BOB)), part(BOB).slice(0, 500));
  check('and for a Max member too', /#\/tutor\/calc\?call=exam/.test(part(MOD)));
  check('a mail app can unsubscribe in one click (List-Unsubscribe, for exam reminders only)', /List-Unsubscribe: <https?:\/\/\S+\/api\/index\.php\?r=news_unsub&k=exam&u=\d+&t=[0-9a-f]{32}>/.test(part(BOB)));
  check('each exam once: the calendar row and the exam itself are one heads-up', ask('SELECT COUNT(*) AS n FROM exam_nudges')[0].n === 2);
  sqlite(`UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}')`);
  m0 = mailLen(); n = tick('2026-09-16');
  check('the next day: not again', n === 0 && !/Exam 1 is in/.test(mailSince(m0)), n);
  // out of credits: the exam prep page instead; the setting off: nothing
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 0 WHERE email IN ('${BOB}', '${MOD}'); ${OUT}; UPDATE users SET exam_nudge = 0 WHERE email = '${MOD}'`);
  m0 = mailLen(); n = tick('2026-09-16'); const mail2 = mailSince(m0);
  check('two days before, without credits for a call: the exam prep page', n === 1 && /subject="Calc I Exam 1 is in 2 days"/.test(mail2) && /Open exam prep: https?:\/\/\S+\/#\/calc\/exam/.test(mail2) && !/call=exam/.test(mail2), mail2.slice(0, 400));
  check('and nobody who turned it off', !new RegExp(`to=${MOD.replace('.', '\\.')}`).test(mail2));
  sqlite(`DELETE FROM credit_use WHERE ref = 'test-out'`);

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

  // out of credits: the link says so and points to the exam prep page
  sqlite(OUT);
  const [cb, b] = await mk(390, 844, { serviceWorkers: 'block' }); await cb.addInitScript(quiet); await cb.addInitScript(live);
  await go(b, '#/', 500); await login(b, BOB); await b.reload(); await b.waitForTimeout(700);
  await go(b, '#/tutor/calc?call=exam', 2000);
  check('out of credits: no call, a note that points to the exam prep page', !(await b.$('#bo-talk')) && /Your exam is close/.test(await txt(b, '.bo-exam-note')) && (await b.getAttribute('.bo-exam-note a', 'href')) === '#/calc/exam');
  sqlite(`DELETE FROM credit_use WHERE ref = 'test-out'`);
  await go(b, '#/tutor/calc?call=exam', 2000);
  if (await b.$('.bo-consent [data-go="agree"]')) { await b.click('.bo-consent [data-go="agree"]'); await b.waitForTimeout(2200); }   // his first time with Bo: he agrees, then the call opens
  check('with credits, the review call opens, saying what it costs', !!(await b.$('#bo-talk .bt-exam')) && /credits · about \d+ minutes at 6 a minute/.test(await txt(b, '#bo-talk')), await txt(b, '#bo-talk .bt-free'));
  await b.keyboard.press('Escape'); await cb.close();

  // the administrator's switches (admin → Site settings → Email): off stops them for everyone
  const [ca, ad] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(ad, '#/', 500); await login(ad, 'admin.user@montana.edu');
  let sw = await api(ad, 'admin_config_save', { password: 'password123', values: { exam_emails: 'off', recap_emails: 'off' } });
  const fields = (await api(ad, 'admin_config')).json.groups.flatMap(g => g.fields); const fx = k => fields.find(f => f.key === k) || {};
  check('Site settings has both switches, under email, and saves them', sw.status === 200 && fx('exam_emails').value === 'off' && fx('recap_emails').value === 'off' && /Exam heads-ups/.test(fx('exam_emails').label) && /Recap emails/.test(fx('recap_emails').label), [fx('exam_emails'), fx('recap_emails')]);
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 0, exam_nudge = 1 WHERE email IN ('${BOB}', '${MOD}')`);
  m0 = mailLen(); n = tick('2026-09-15');
  check('exam heads-ups off: none go out, even three days before', n === 0 && !/Exam 1 is in/.test(mailSince(m0)) && ask('SELECT COUNT(*) AS n FROM exam_nudges')[0].n === 0, n);
  const [cs, st] = await mk(1360, 900, { serviceWorkers: 'block' }); await cs.addInitScript(quiet); await cs.addInitScript(live);
  await go(st, '#/', 500); await login(st, MOD); await st.reload(); await st.waitForTimeout(700);
  check('the account says both are off for the site', (await api(st, 'me')).json.user.exam_emails_on === false && (await api(st, 'me')).json.user.recap_emails_on === false);
  await go(st, '#/settings', 1200);
  check('and Settings no longer offers them', !(await st.$('#acct-exam')) && !(await st.$('#acct-recap')) && !!(await st.$('#acct-news')));
  sqlite("DELETE FROM rate WHERE key LIKE 'ai_recap:%' OR key LIKE 'ai_live:%'"); await api(st, 'ai_forget', { what: 'all' });
  const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=test\r\nt=0 0\r\n'; const since = Math.floor(Date.now() / 1000) - 2;
  const lv = (await api(st, 'ai_live_start', { class: 'calc', sdp: OFFER })).json;
  await api(st, 'ai_live_log', { lid: lv.lid, turns: [{ r: 'b', t: 'Good afternoon.' }, { r: 'u', t: 'x = 11 - 3 so x = 6' }, { r: 'b', t: 'No. Eleven minus three is eight.' }], end: 1 });
  m0 = mailLen(); const rc = (await api(st, 'ai_recap', { class: 'calc', since })).json;
  check('recap emails off: the recap is still in the chat, and no email goes out', rc.ok && !!rc.recap && rc.emailed === false && !/Your call with/.test(mailSince(m0)), rc);
  sw = await api(ad, 'admin_config_save', { password: 'password123', clear: ['exam_emails', 'recap_emails'] });
  check('cleared, both are back on', sw.status === 200 && (await api(st, 'me')).json.user.exam_emails_on === true && (await api(st, 'me')).json.user.recap_emails_on === true);
  await api(st, 'ai_forget', { what: 'all' }); await cs.close(); await ca.close();

  // put things back
  for (const k of keep) sqlite(`UPDATE users SET courses = ${k.courses === null ? 'NULL' : `'${String(k.courses).replace(/'/g, "''")}'`}, exam_checked = 0, exam_nudge = 1 WHERE id = ${k.id}`);
  sqlite(`DELETE FROM exam_nudges; UPDATE users SET exam_checked = 0; DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = '${BOB}'); DELETE FROM ai_live WHERE user_id IN (SELECT id FROM users WHERE email IN ('${BOB}', '${MOD}'))`);
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
