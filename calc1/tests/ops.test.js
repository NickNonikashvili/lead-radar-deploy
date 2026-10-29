/* Running the site (api/ops.php; the Overview, Credits and Growth tabs,
   assets/admin-ops.js). Mail is in log mode here (api/data/mail.log).
   Covered: Bo's cost today and this month from the credits used; the daily, monthly and spike alerts, emailed to the
   administrators once each with who used most, and shown in the panel; the weekly report: what it says, emailed by
   housekeeping once from its day and hour, not when it is off, and to me on demand; the classes made in the class maker
   and the syllabi Bo read; how far the last 30 days' sign-ups got and Bo's cost by week; administrators only.
   The spending cap: a day (or month) over it pauses everything with Bo for members, never for administrators, with
   one email to the administrators and a line in the panel; a raised or cleared cap counts at once. (Every check sends
   an empty question, so no AI is ever asked.) */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const API = path.join(__dirname, '..', 'api'); const DB = path.join(API, 'data', 'mathub.sqlite'); const LOG = path.join(API, 'data', 'mail.log');
const sql = (q, ...a) => cp.spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const mailLen = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').length : 0);
const mailSince = n => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').slice(n) : '');
const idOf = email => +rows('SELECT id FROM users WHERE email = ?', email)[0].id;
(async () => {
  const { mk, login, go, txt, check, api } = await T.start({});
  const [c, a] = await mk(1360, 900); await go(a, '#/'); await login(a, 'admin.user@montana.edu');
  const KEY = 'ops-test-cron-key'; const cron = () => a.evaluate(async k => (await fetch('api/index.php?r=cron&key=' + k)).json(), KEY);
  const settings = v => api(a, 'admin_config_save', { password: 'password123', values: v });
  const unset = () => api(a, 'admin_config_save', { password: 'password123', clear: ['cost_alert_daily', 'cost_alert_monthly', 'cost_cap_daily', 'cost_cap_monthly', 'admin_report', 'admin_report_day', 'cron_key'] });
  await api(a, 'admin_ops');   // the tables
  const clean = () => { sql('DELETE FROM ops_alerts'); sql('DELETE FROM credit_use'); };
  clean(); await unset(); await settings({ cron_key: KEY });
  sql("INSERT OR REPLACE INTO ops_state (k, v) VALUES ('report_sent', ?)", Math.floor(Date.now() / 1000));   // not this week's yet

  // what Bo cost: $12 today, mostly Alice's; $1 a day the 14 days before (credits_markup 2: $1 = 200 credits)
  const now = Math.floor(Date.now() / 1000); const alice = idOf('alice.a@montana.edu'), bob = idOf('bob.bmu6j92pq@montana.edu');
  const use = (uid, at, feature, dollars) => sql('INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES (?, ?, ?, ?, 0, 0, "", "test")', uid, at, feature, Math.round(dollars * 200000));
  use(alice, now - 30, 'chat', 9); use(bob, now - 40, 'call', 3); for (let k = 1; k <= 14; k++) use(bob, now - k * 86400, 'chat', 1);
  let r = await api(a, 'admin_ops');
  check('Bo’s cost today and this month, from the credits used', r.json && r.json.ok && Math.abs(r.json.cost.today - 12) < 0.01 && r.json.cost.month >= 12 && r.json.cost.limit_day === 0 && r.json.alerts.length === 0, r.json.cost);

  // alerts
  let m0 = mailLen(); r = await cron();
  check('with no alerts set, none goes', r.ok && !r.did.some(x => /cost alert/.test(x)) && mailSince(m0) === '', r.did);
  await settings({ cost_alert_daily: '10', cost_alert_monthly: '5' });
  m0 = mailLen(); r = await cron(); const mail = mailSince(m0);
  check('a day over its alert, a month over its alert, and a spike: one alert each', ['cost alert: day', 'cost alert: month', 'cost alert: spike'].every(k => r.did.includes(k)), r.did);
  check('each emailed to the administrators, saying what and who used most', /to=admin\.user@montana\.edu subject="StudyCat: Bo has cost \$12\.00 today \(your alert: \$10\.00\)"/.test(mail) && /Most of it: alice\.a@montana\.edu \$9\.00 \(75%\)/.test(mail) && /three times a usual day/.test(mail) && /The 14 days before cost \$1\.00 a day on average/.test(mail) && /#\/admin\/credits/.test(mail), mail.slice(0, 900));
  m0 = mailLen(); r = await cron(); check('and only once a day (and month)', !r.did.some(x => /cost alert/.test(x)) && mailSince(m0) === '', r.did);
  r = await api(a, 'admin_ops'); check('the panel lists them while they stand', r.json.alerts.length === 3 && r.json.alerts.find(x => x.kind === 'day').limit === 10 && r.json.cost.limit_month === 5, r.json.alerts);

  // the weekly report
  r = await api(a, 'admin_ops'); const W = r.json.report.sections;
  check('this week’s report: people, Bo’s use and cost by feature, credits, classes made, what to look at, backups, answer tests, alerts', ['People', 'Bo', 'Credits sold', 'Classes made', 'To look at', 'Backups', 'Answer tests', 'Cost alerts'].every(k => Array.isArray(W[k])) && /costing about \$18\.00/.test(W.Bo[0]) && W.Bo.some(l => l === 'Chat with Bo: $15.00, 7 uses by 2 people') && W.Bo.some(l => l === 'Calls with Bo: $3.00, 1 use by 1 person'), W);
  check('it says when the off-site copies are not set up, and how to run the answer tests', W.Backups.some(l => /Off-site copies are not set up/.test(l)) && /Answer tests tab|No run yet/.test(W['Answer tests'][0]), [W.Backups, W['Answer tests']]);
  m0 = mailLen(); r = await api(a, 'admin_ops_send', {});
  check('Email me this report: to me', r.json && r.json.ok && r.json.to === 'admin.user@montana.edu' && r.json.logged === true && /to=admin\.user@montana\.edu subject="StudyCat this week \([A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+\): \d+ sign-ups, \d+ active, Bo \$18\.00"/.test(mailSince(m0)) && /BACKUPS\n- /.test(mailSince(m0)), mailSince(m0).slice(0, 300));
  sql("UPDATE ops_state SET v = '0' WHERE k = 'report_sent'"); sql("DELETE FROM rate WHERE key = 'ops:report'");
  m0 = mailLen(); r = await cron();
  check('housekeeping sends it to every administrator once its day and hour have come', r.did.includes('weekly report: 1 sent') && /subject="StudyCat this week/.test(mailSince(m0)), r.did);
  m0 = mailLen(); sql("DELETE FROM rate WHERE key = 'ops:report'"); r = await cron(); check('and not again that week', !r.did.some(x => /weekly report/.test(x)) && !/StudyCat this week/.test(mailSince(m0)), r.did);
  await settings({ admin_report: 'off' }); sql("UPDATE ops_state SET v = '0' WHERE k = 'report_sent'"); sql("DELETE FROM rate WHERE key = 'ops:report'");
  m0 = mailLen(); r = await cron(); check('not when it is turned off', !r.did.some(x => /weekly report/.test(x)) && !/StudyCat this week/.test(mailSince(m0)), r.did);
  r = await api(a, 'admin_ops'); check('the panel says it is off', r.json.report.on === false);
  await settings({ admin_report: 'on' }); sql("INSERT OR REPLACE INTO ops_state (k, v) VALUES ('report_sent', ?)", Math.floor(Date.now() / 1000));

  // classes made in the class maker this week, and syllabi Bo read for it
  const now2 = Math.floor(Date.now() / 1000);
  sql("DELETE FROM my_classes WHERE cid = 'my9191'");
  sql("INSERT INTO my_classes (user_id, cid, code, name, term, pack, bytes, free, created, updated) SELECT id, 'my9191', 'ZZ 919', 'Made this week', '', '{}', 2, 0, ?, ? FROM users WHERE email = 'alice.a@montana.edu'", now2, now2);
  sql("INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) SELECT id, ?, 'class', 30000, 30000, 0, '', 'Reading a syllabus' FROM users WHERE email = 'alice.a@montana.edu'", now2);
  r = await api(a, 'admin_ops'); const CM = r.json.report.sections['Classes made'] || [];
  check('the weekly report counts the classes made in the class maker and the syllabi Bo read', CM.some(l => /^\d+ class(es)? made in the class maker by \d+ (person|people)\.$/.test(l)) && CM.some(l => /^1 syllabus read by Bo\.$/.test(l)), CM);
  sql("DELETE FROM my_classes WHERE cid = 'my9191'");

  // usage
  r = await api(a, 'admin_growth'); const U = r.json.usage;
  check('Growth: how far the last 30 days’ sign-ups got, and Bo’s cost by week', U && ['signed_up', 'confirmed', 'returned', 'asked_bo', 'paid'].every(k => Number.isInteger(U.funnel[k])) && U.funnel.confirmed <= U.funnel.signed_up && U.weeks.length === 8 && U.weeks.reduce((s, w) => s + w.usd, 0) >= 25.99 && U.weeks[7].usd >= 12, U);

  // administrators only
  const [c2, b] = await mk(1000, 800); await go(b, '#/'); await login(b, 'alice.a@montana.edu');
  check('members cannot see the costs or the report', (await api(b, 'admin_ops')).status === 403 && (await api(b, 'admin_ops_send', {})).status === 403);

  // the spending cap ($12 so far today)
  const ask = async p => ((await api(p, 'ai_tutor', { q: '' })).json || {});
  check('with no cap, Bo is not paused', !(await ask(b)).resting);
  m0 = mailLen(); await settings({ cost_cap_daily: '11' });
  let rb = await api(b, 'ai_tutor', { q: '' });
  check('a day over its spending cap: Bo rests for members until tomorrow, and says their credits were not used', rb.status === 503 && rb.json.resting === 'day' && /^Bo is resting until tomorrow/.test(rb.json.error) && /None of your credits were used/.test(rb.json.error), rb);
  const capMail = mailSince(m0);
  check('the administrators get one email: Bo has paused, and who used most', /to=admin\.user@montana\.edu subject="StudyCat: Bo has paused for today: today cost \$12\.00 \(your cap: \$11\.00\)"/.test(capMail) && /Most of it: alice\.a@montana\.edu \$9\.00/.test(capMail) && /raise or clear the cap/.test(capMail), capMail.slice(0, 500));
  m0 = mailLen(); sql("DELETE FROM ops_state WHERE k = 'cap_now'"); await ask(b);
  check('and only once that day', !/Bo has paused/.test(mailSince(m0)));
  check('every use of Bo pauses, not only the chat', ((await api(b, 'ai_speak', { text: 'hello' })).json || {}).resting === 'day');
  const adm = await ask(a); check('administrators are never paused', !adm.resting && /Ask Bo something first/.test(adm.error || ''), adm);
  r = await api(a, 'admin_ops'); check('the panel shows Bo paused, with the cap', r.json.alerts.some(x => x.kind === 'cap_day' && x.limit === 11 && Math.abs(x.usd - 12) < 0.01), r.json.alerts);
  await settings({ cost_cap_daily: '50' }); check('a raised cap counts at once', !(await ask(b)).resting);
  await settings({ cost_cap_daily: '0', cost_cap_monthly: '5' }); rb = await api(b, 'ai_tutor', { q: '' });
  check('a month over its cap: Bo rests until the 1st', rb.status === 503 && rb.json.resting === 'month' && /until the 1st/.test(rb.json.error), rb.json);
  await api(a, 'admin_config_save', { password: 'password123', clear: ['cost_cap_daily', 'cost_cap_monthly'] }); check('a cleared cap: Bo is back', !(await ask(b)).resting);
  await c2.close();

  // the tabs
  await a.reload(); await a.waitForTimeout(800); await go(a, '#/admin/overview', 2000);
  let t = await txt(a, '#adm-body');
  check('Overview: the alerts standing, and the week', /Bo has cost \$12\.00 today \(your alert: \$10\.00\)/.test(t) && /The last seven days/.test(t) && /To look at/.test(t) && /Email me this report/.test(t), t.slice(0, 500));
  await go(a, '#/admin/credits', 2000); t = await txt(a, '#ops-cost');
  check('Credits: today and this month against the alerts', /Bo’s cost today/.test(t) && /\$12\.00/.test(t) && /alert at \$10\.00/.test(t) && /alert at \$5\.00/.test(t), t);
  await go(a, '#/admin/growth', 2000); t = await txt(a, '#ops-usage');
  check('Growth: how far new members get, and what Bo cost by week', /How far new members get/.test(t) && /Asked Bo something/.test(t) && /What Bo cost, by week/.test(t), t.slice(0, 300));
  check('the Class requests tab is gone (students make their own classes)', !(await a.$('.admin-tab[href="#/admin/classes"]')));
  check('the tabs fit and have no errors', await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  clean(); await unset(); await c.close(); await T.finish();
})();
