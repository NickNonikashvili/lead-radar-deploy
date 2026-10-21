/* Calls with Bo, paid for (api/calls.php, assets/calls.js, the admin panel's Calls tab): Mathub Max ($20) includes an
   hour of calls each month; more time is bought ahead, an hour for $10, through RevenueCat (a stand-in in
   tests/pyodide/router.php: rc-state.json's "hours" are the purchases). Covered: what is left and the purchase link;
   a purchase counted once, and taken back when refunded; a call using the month's hour first, then the hours bought;
   out of time, a call does not start and one going on ends, saying how to get more; administrators giving time (and
   the member told), and nobody else; without Max, what calls cost and the free minutes. The pages: #/calls for a Max
   member (time left, Buy an hour, I paid, the calls, what was bought, how Bo sounds) and without Max, Your plan and the
   start page's call time, the account menu, and the admin's Calls tab, on a phone too. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const STATE = path.join(__dirname, 'fixtures', 'rc-state.json');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=test\r\nt=0 0\r\n';
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, log, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu';
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const clean = () => { sql("DELETE FROM call_credit WHERE user_id IN (SELECT id FROM users WHERE email IN ('alice.a@montana.edu', 'bob.bmu6j92pq@montana.edu'))"); sql("DELETE FROM call_month WHERE user_id IN (SELECT id FROM users WHERE email IN ('alice.a@montana.edu', 'bob.bmu6j92pq@montana.edu'))"); sql("DELETE FROM ai_live WHERE user_id IN (SELECT id FROM users WHERE email IN ('alice.a@montana.edu', 'bob.bmu6j92pq@montana.edu'))"); sql("DELETE FROM rate WHERE key LIKE 'calls_sync%' OR key LIKE 'ai_live%'"); };

  // the administrator, and the purchase link
  const [cd, d] = await mk(1360, 900); await cd.addInitScript(quiet); await go(d, '#/'); await login(d, 'admin.user@montana.edu'); await d.reload(); await d.waitForTimeout(800);
  await api(d, 'admin_config_save', { password: 'password123', values: { call_hour_link: 'https://pay.rev.cat/sbx_hour_link' } });
  // Alice has Max (the stand-in RevenueCat says so)
  const [ca, a] = await mk(1360, 900); await ca.addInitScript(quiet); await go(a, '#/'); await login(a, ALICE); await a.reload(); await a.waitForTimeout(600);
  const aliceId = (await api(a, 'create_status')).customer; const uid = +aliceId.replace('mh_', '');
  fs.writeFileSync(STATE, JSON.stringify({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'max' } }));
  await api(a, 'create_status&refresh=1'); clean(); const tables = await api(a, 'calls_status'); clean();

  let S = await api(a, 'calls_status');
  check('with Max: an hour included this month, nothing bought, an hour left', S.ok && S.max === true && S.included === 3600 && S.included_left === 3600 && S.balance === 0 && S.left === 3600, S);
  check('the purchase: an hour for $10, through her own RevenueCat link', S.price === '$10' && S.pack === 3600 && S.buy === `https://pay.rev.cat/sbx_hour_link/${aliceId}` && S.max_price === '$20', { price: S.price, buy: S.buy });
  // she buys an hour
  fs.writeFileSync(STATE, JSON.stringify({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'max', hours: ['tx_one'] } }));
  S = await api(a, 'calls_sync', {});
  check('after paying, the purchase is found and adds an hour', S.added === 1 && S.balance === 3600 && S.left === 7200, { added: S.added, balance: S.balance, left: S.left });
  S = await api(a, 'calls_sync', {});
  check('and is counted once', S.added === 0 && S.balance === 3600, { added: S.added, balance: S.balance });
  const st = await api(a, 'ai_status');
  check('Bo\'s status tells the page what is left of her calls', st.calls && st.calls.left === 7200 && st.calls.price === '$10', st.calls);

  // a call: the month's hour first, then the hours bought
  let r = await api(a, 'ai_live_start', { class: 'calc', sdp: OFFER });
  check('a call starts, with what is left', r.ok && r.lid && r.left > 0, r);
  const lid = r.lid; const back = s => sql('UPDATE ai_live SET last = ? WHERE id = ?', Math.floor(Date.now() / 1000) - s, lid);
  back(30); r = await api(a, 'ai_live_tick', { lid });
  let L = await api(a, 'calls_status');
  check('its minutes come out of the month\'s hour', r.ok && L.included_left >= 3600 - 31 && L.included_left <= 3600 - 29 && L.balance === 3600, { inc: L.included_left, bal: L.balance });
  sql('UPDATE call_month SET included_used = 3590 WHERE user_id = ?', uid);
  back(40); r = await api(a, 'ai_live_tick', { lid }); L = await api(a, 'calls_status');
  check('past the month\'s hour, the rest comes out of the hours she bought', L.included_left === 0 && L.balance >= 3600 - 31 && L.balance <= 3600 - 29, { inc: L.included_left, bal: L.balance });
  const row = (L.calls || []).find(c => c.at && c.paid > 0);
  check('the call is listed with what it took from her hours', !!row && row.paid >= 29 && row.paid <= 31 && row.cid === 'calc', L.calls && L.calls[0]);
  // out of time while talking: the call ends and says how to get more
  sql("INSERT INTO call_credit (user_id, kind, secs, ref, created) VALUES (?, 'grant', ?, 'test-drain', ?)", uid, -L.balance, Math.floor(Date.now() / 1000));
  back(20); r = await api(a, 'ai_live_tick', { lid });
  check('when her time runs out on a call, it ends and says to buy another hour', r.ok && r.end === true && r.hours === true && /Buy another hour/.test(r.why), r);
  r = await api(a, 'ai_live_start', { class: 'calc', sdp: OFFER });
  check('and a new call does not start: it says how to get more (402)', r.status === 402 && r.hours === true && /Buy an hour \(\$10\)/.test(r.error), r);
  // a refund takes the hour back
  fs.writeFileSync(STATE, JSON.stringify({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'max', hours: [] } }));
  S = await api(a, 'calls_sync', {});
  const credits = JSON.parse(sql("SELECT kind, secs FROM call_credit WHERE user_id = ? AND kind IN ('buy', 'refund') ORDER BY id", uid));
  check('a refunded purchase is taken back, once', credits.length === 2 && credits[1].kind === 'refund' && +credits[1].secs === -3600, credits);
  S = await api(a, 'calls_sync', {});
  check('(and not twice)', JSON.parse(sql("SELECT COUNT(*) AS n FROM call_credit WHERE user_id = ? AND kind = 'refund'", uid))[0].n === 1);
  const owed = +JSON.parse(sql('SELECT COALESCE(SUM(secs), 0) AS b FROM call_credit WHERE user_id = ?', uid))[0].b;
  check('an hour refunded after she used it leaves her owing that time (shown as none left)', owed < 0 && (await api(a, 'calls_status')).balance === 0, owed);
  sql("INSERT INTO call_credit (user_id, kind, secs, ref, created) VALUES (?, 'grant', ?, 'test-zero', ?)", uid, -owed, Math.floor(Date.now() / 1000));   // back to nothing, for the checks below

  // the administrator: everyone's calls, and giving time
  const [cs, s] = await mk(1360, 900); await go(s, '#/'); await login(s, BOB); await s.reload(); await s.waitForTimeout(500);
  check('a student cannot open the admin call routes', (await api(s, 'admin_calls')).status === 403 && (await api(s, 'admin_calls_grant', { email: ALICE, minutes: 60 })).status === 403);
  r = await api(d, 'admin_calls_grant', { email: ALICE, minutes: 90, note: 'testing calls', tell: true });
  check('an administrator gives her 90 minutes', r.ok && r.balance === 90 * 60, r);
  check('and she is told in her inbox', ((await api(a, 'notif_list')).notifications || []).some(n => n.kind === 'calls' && /90 minutes/.test(n.snippet) && n.link === '#/calls'));
  r = await api(d, 'admin_calls_grant', { email: ALICE, minutes: -600 });
  check('taking back more than she has is refused', r.ok === false && /do not have that much/.test(r.error), r);
  r = await api(d, 'admin_calls');
  const me = (r.people || []).find(p => p.email === ALICE);
  check('the admin\'s Calls numbers: this month, what was sold and refunded, and her row', r.ok && r.totals.calls >= 1 && r.totals.secs >= 60 && r.totals.hours_sold >= 1 && r.totals.refunds >= 1 && me && me.plan === 'max' && me.balance === 5400 && me.month_calls >= 1, { totals: r.totals, me });
  check('the settings it shows: $20 Max with 60 minutes, 60 minutes for $10, the link set', r.settings.max_price === '$20' && r.settings.included_minutes === 60 && r.settings.pack_minutes === 60 && r.settings.price === '$10' && r.settings.link === true, r.settings);

  // without Max: what calls cost, and the free minutes
  S = await api(s, 'calls_status');
  check('without Max: no call time, the price of Max, and the free minutes', S.max === false && S.left === 0 && S.max_price === '$20' && S.trial && S.trial.left > 0, { max: S.max, trial: S.trial });

  // ---- the pages ----
  await go(a, '#/calls', 1600);
  check('#/calls for Max: time left as one number, the month\'s hour and the hours bought', /1 h 30 min/.test(await txt(a, '#cl-left')) && /This month’s hour/.test(await txt(a, '.cl-time')) && /Hours you bought/.test(await txt(a, '.cl-time')) && /Comes back on/.test(await txt(a, '.cl-time')), await txt(a, '.cl-time'));
  const buy = await a.$eval('[data-action="cl-buy"]', b => ({ href: b.getAttribute('href'), target: b.getAttribute('target'), text: b.textContent })).catch(() => null);
  check('Buy 1 h · $10 opens her checkout in a new tab', buy && buy.href === `https://pay.rev.cat/sbx_hour_link/${aliceId}` && buy.target === '_blank' && /Buy 1 h · \$10/.test(buy.text), buy);
  check('her calls are listed, with what each took from her hours', /from your hours/.test(await txt(a, '.cl-list')) && /Calc/.test(await txt(a, '.cl-list')));
  check('and what was bought, refunded and given', /Bought/.test(await txt(a, '.cl-credits')) && /Refunded/.test(await txt(a, '.cl-credits')) && /From Mathub/.test(await txt(a, '.cl-credits')));
  const pages = ca.pages().length;
  await a.click('[data-action="cl-buy"]'); await a.waitForTimeout(500); for (const pg of ca.pages().slice(pages)) await pg.close();
  check('after Buy, the page waits for the payment, with I paid', await a.isVisible('#cl-wait') && /I paid/.test(await txt(a, '#cl-wait')));
  fs.writeFileSync(STATE, JSON.stringify({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'max', hours: ['tx_two'] } }));
  await a.click('[data-action="cl-sync"]'); await a.waitForTimeout(1500);
  check('I paid finds the new hour, and the time left goes up', /2 h 30 min/.test(await txt(a, '#cl-left')), await txt(a, '#cl-left'));
  // how Bo sounds
  await a.click('#cl-set input[name="cl-voice"][value="marin"]'); await a.click('#cl-set [data-cl-rate="1.1"]'); await a.check('#cl-hs'); await a.waitForTimeout(200);
  const set = await a.evaluate(() => ({ v: App.settings().boLiveVoice, r: App.settings().boLiveRate, h: App.settings().boHeadset }));
  check('how Bo sounds on calls: his voice, pace and headphones, kept for the next call', set.v === 'marin' && +set.r === 1.1 && set.h === true, set);
  check('and who he is (the characters)', (await a.$$('#cl-set .bc-card')).length >= 5);
  // Your plan, the start page and the account menu
  await go(a, '#/plan', 1800);
  check('Your plan shows her calls: minutes left, the included hour and what she bought, with the way to the Calls page', /Calls with Bo/.test(await txt(a, '#pl-use')) && /minutes left/.test(await txt(a, '#pl-use')) && !!(await a.$('#pl-use a[href="#/calls"]')) && !/Classes Bo writes/.test(await txt(a, '#pl-use')), await txt(a, '#pl-use'));
  await go(a, '#/', 1800);
  check('the start page\'s Bo card shows her call time, linking to the Calls page', !!(await a.$('#bo-hub a.bh-plan[href="#/calls"]')) && /min/.test(await txt(a, '#bo-hub a.bh-plan[href="#/calls"]')));
  await a.click('[data-action="acct-toggle"]'); await a.waitForTimeout(300);
  check('the account menu has Calls with Bo', !!(await a.$('.acct-dd-item[href="#/calls"]')));
  await a.keyboard.press('Escape');
  // without Max
  await go(s, '#/calls', 1500);
  check('#/calls without Max: calls come with Max at $20, an hour a month, more at $10, and the free minutes', /come with Mathub Max/.test(await txt(s, '.cl-time')) && /\$20 a month/.test(await txt(s, '.cl-time')) && /\$10/.test(await txt(s, '.cl-time')) && /Call Bo free/.test(await txt(s, '.cl-time')));
  await s.click('[data-action="cl-max"]'); await s.waitForTimeout(900);
  check('Get Mathub Max opens the plans card for Max', !!(await s.$('#paywall')) && /\$20/.test(await txt(s, '#paywall')));
  await s.keyboard.press('Escape');
  // the admin's tab
  await go(d, '#/admin/calls', 1800);
  check('the admin panel has a Calls tab: this month, prices, giving time, members and purchases', /Talked this month/.test(await txt(d, '#adm-body')) && /Prices and limits/.test(await txt(d, '#adm-body')) && !!(await d.$('#cl-give')) && /alice/.test(await txt(d, '#adm-body table')) && /Bought|Refunded|Given/.test(await txt(d, '#adm-body .cl-list')));
  await d.click(`[data-action="cl-pick"][data-email="${ALICE}"]`); await d.fill('#cl-g-min', '15'); await d.fill('#cl-g-note', 'from the admin tab'); await d.click('#cl-give button[type="submit"]'); await d.waitForTimeout(1200);
  check('Give time from the tab adds it', /\b2 h 45 min|\b4 h 15 min/.test(await txt(d, '#adm-body table')) || JSON.parse(sql("SELECT COUNT(*) AS n FROM call_credit WHERE user_id = ? AND note = 'from the admin tab'", uid))[0].n === 1);
  // phones
  const [cm, m] = await mk(390, 844); await cm.addInitScript(quiet); await go(m, '#/'); await login(m, ALICE); await go(m, '#/calls', 1600);
  check('no sideways scroll on #/calls at 390px', await hscroll(m));
  await cm.close();

  // clean up
  await api(d, 'admin_config_save', { password: 'password123', clear: ['call_hour_link'] });
  clean(); fs.writeFileSync(STATE, '{}'); log(`(tables ready: ${tables.ok})`);
  await T.finish();
})().catch(e => { console.error(e); try { require('fs').writeFileSync(require('path').join(__dirname, 'fixtures', 'rc-state.json'), '{}'); } catch (x) {} process.exit(1); });
