/* Bo quality (api/ai.php: ai_flag, ai_admin_quality, the bo_* counts; admin → Bo quality; the thumbs down in Ask Bo
   and in the floating Bo). Covered: the counts the math check keeps (a student's slip, Bo's slip rewritten before it is
   kept, the answers, a live call's counts at hang-up), the thumbs down (the answer and the question before it go to the
   review queue once; what was wrong can follow; an answer that is not theirs is refused), the admin tab (only
   administrators; the tiles, the weeks, the queue; Done), and Forget everything taking the marks too. */
const T = require('./lib'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const sh = (code, ...a) => require('child_process').spawnSync('php', ['-r', code, ...a]);
const ask = q => JSON.parse(String(sh('$d = new PDO("sqlite:" . $argv[1]); echo json_encode($d->query($argv[2])->fetchAll(PDO::FETCH_ASSOC));', DB, q).stdout) || '[]');
const sqlite = q => sh('$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', DB, q);
const counts = () => Object.fromEntries(ask("SELECT key, SUM(n) AS n FROM metrics WHERE key LIKE 'bo_%' GROUP BY key").map(r => [r.key.slice(3), +r.n]));
const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=test\r\nt=0 0\r\n';
(async () => {
  const { mk, login, api, go, txt, check, log } = await T.start({});
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const [cm, m] = await mk(1360, 900, { serviceWorkers: 'block' }); await cm.addInitScript(quiet);
  await go(m, '#/', 500); await login(m, 'mod.user@montana.edu'); await m.reload(); await m.waitForTimeout(700);
  await api(m, 'ai_forget', { what: 'all' }); sqlite("DELETE FROM rate WHERE key LIKE 'ai_%'; DELETE FROM ai_flags");
  await m.evaluate(() => { App.setSetting('aiConsent', Date.now()); });

  // the counts
  let c0 = counts();
  let r = (await api(m, 'ai_tutor', { class: 'calc', q: 'SLIPTEST seven eights' })).json;
  let c1 = counts(); const d = k => (c1[k] || 0) - (c0[k] || 0);
  check('Bo’s slip is counted, and so is the rewrite that fixed it, and the answer', /56/.test(r.reply) && d('chat_bo') === 1 && d('chat_fixed') === 1 && d('answers') === 1, { d: [d('chat_bo'), d('chat_fixed'), d('answers')] });
  check('the answer comes back with its time, so it can be marked', typeof r.at === 'number' && r.at > 1e9, r.at);
  const at1 = r.at;
  await m.waitForTimeout(1100);   // the next answer gets its own second
  c0 = counts(); await api(m, 'ai_tutor', { class: 'calc', q: 'so x = 11 - 3, so x = 6?' }); c1 = counts();
  check('a student’s slip caught in the chat is counted', d('chat_you') === 1 && d('answers') === 1, c1);
  r = (await api(m, 'ai_live_start', { class: 'calc', sdp: OFFER })).json; const lid = r.lid;
  c0 = counts(); await api(m, 'ai_live_log', { lid, turns: [], end: 1, mc: { you: 2, bo: 1, page: 1 } }); c1 = counts();
  check('a live call’s counts arrive when it ends', d('calls') === 1 && d('call_you') === 2 && d('call_bo') === 1 && d('call_page') === 1, c1);

  // the thumbs down, from the server's side
  r = await api(m, 'ai_flag', { class: 'calc', at: 12345, text: 'x' });
  check('an answer that is not in their chat cannot be marked', r.status === 404);
  c0 = counts(); r = await api(m, 'ai_flag', { class: 'calc', at: at1, text: 'Here it is.' }); await api(m, 'ai_flag', { class: 'calc', at: at1, text: 'Here it is.' }); c1 = counts();
  let rows = ask('SELECT * FROM ai_flags');
  check('marking an answer keeps it and the question before it, once', r.status === 200 && rows.length === 1 && /7 \\cdot 8 = 56/.test(rows[0].answer) && /SLIPTEST/.test(rows[0].q) && d('flags') === 1, rows);
  await api(m, 'ai_flag', { class: 'calc', at: at1, text: 'Here it is.', why: 'It said 54 first' });
  check('what was wrong can follow', ask('SELECT why FROM ai_flags')[0].why === 'It said 54 first');

  // in Ask Bo: the thumbs down under an answer
  await go(m, '#/tutor/calc', 2200);
  const bads = await m.$$('.bo-msg.bo [data-bo-bad]');
  check('Bo’s answers have a thumbs down (Not right?)', bads.length >= 2, bads.length);
  await bads[bads.length - 1].click(); await m.waitForTimeout(700);
  check('one tap marks it and asks what was wrong, optionally', (await m.$eval('.bo-msg.bo:last-of-type [data-bo-bad]', b => b.getAttribute('aria-pressed')).catch(() => null)) === 'true' || (await m.$$('.bo-bad')).length === 1);
  check('the box says the team will look at it and offers to report something worse', /StudyCat’s team will look at this answer/.test(await txt(m, '.bo-bad')) && !!(await m.$('.bo-bad [data-bo-report]')));
  await m.fill('.bo-bad input', 'Wrong answer for 11 - 3'); await m.click('.bo-bad button[type="submit"]'); await m.waitForTimeout(600);
  rows = ask('SELECT * FROM ai_flags ORDER BY id');
  check('Send adds what was wrong to that answer', rows.length === 2 && rows[1].why === 'Wrong answer for 11 - 3' && /11 - 3/.test(rows[1].q), rows.map(x => [x.q.slice(0, 30), x.why]));
  check('a moderator who is not an administrator cannot open the queue', (await api(m, 'ai_admin_quality')).status === 403);

  // the admin's tab
  const [ca, a] = await mk(1360, 900, { serviceWorkers: 'block' }); await ca.addInitScript(quiet);
  await go(a, '#/', 500); await login(a, 'admin.user@montana.edu'); await a.reload(); await a.waitForTimeout(700);
  r = (await api(a, 'ai_admin_quality')).json;
  check('the numbers: totals over eight weeks, by week, with what each one is', r.total.chat_bo >= 1 && r.total.chat_fixed >= 1 && r.total.call_you >= 2 && r.total.flags >= 2 && Object.keys(r.weeks).length >= 1 && /Slips by Bo/.test(r.labels.chat_bo), r.total);
  check('and the queue: open ones first, with who, the class, the question, what was wrong and the answer', r.open === 2 && r.flags[0].status === 'open' && r.flags.some(f => f.why === 'Wrong answer for 11 - 3' && f.cid === 'calc' && /mod/i.test(f.email)), r.flags.map(f => f.why));
  await go(a, '#/admin/bo', 1800);
  const tab = await a.evaluate(() => ({ tiles: document.querySelectorAll('.bq-tile').length, rows: document.querySelectorAll('.bq-table tbody tr').length, flags: document.querySelectorAll('.bq-flag').length, why: (document.querySelector('.bq-why') || {}).textContent || '', open: (document.querySelector('.panel-title .chip') || {}).textContent }));
  log('tab:', JSON.stringify(tab));
  check('admin → Bo quality shows the tiles, the weeks and the two marked answers', tab.tiles === 5 && tab.rows >= 1 && tab.flags === 2 && /What was wrong/.test(tab.why), tab);
  await a.click('.bq-flag [data-action="bq-mark"]'); await a.waitForTimeout(800);
  check('Done moves it down and greys it out', (await a.$$('.bq-flag.done')).length === 1 && ask("SELECT COUNT(*) AS n FROM ai_flags WHERE status = 'done'")[0].n === 1);
  await ca.close();

  // Forget everything takes the marks too
  await api(m, 'ai_forget', { what: 'all' });
  check('Forget everything removes their marked answers too', ask('SELECT COUNT(*) AS n FROM ai_flags')[0].n === 0);
  await cm.close();
  sqlite("DELETE FROM ai_live WHERE user_id = (SELECT id FROM users WHERE email = 'mod.user@montana.edu')");
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
