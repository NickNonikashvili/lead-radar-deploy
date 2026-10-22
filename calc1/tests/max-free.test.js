/* The call demo page (#/max) and calling Bo on credits without a plan. The page: the self-playing call (captions
   word by word, pause and replay, what they say as text, the still version for reduced motion), phones, and its
   button for each kind of visitor. Calls on credits, in the browser, for an account without a plan: the start page's
   Call Bo (the Call Bo sheet, assets/call-launch.js), what the call costs on its first screen, a real call (the
   stand-in from tests/talk-fakes.js) paid by the minute, and what changes once the credits are used. The server
   side is in ai-api.test.js and credits.test.js. */
const T = require('./lib'); const path = require('path');
const { live, quiet } = require('./talk-fakes');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]);
const ALICE = "(SELECT id FROM users WHERE email = 'alice.a@montana.edu')";
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start({ audio: true });
  const fresh = () => sqlite(`DELETE FROM ai_trial WHERE user_id = ${ALICE}; DELETE FROM ai_live WHERE user_id = ${ALICE}; DELETE FROM credit_use WHERE user_id = ${ALICE}; DELETE FROM credit_add WHERE user_id = ${ALICE}; DELETE FROM rate WHERE key LIKE 'ai_live:%'`);
  fresh();

  // a visitor on a laptop
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await c.addInitScript(quiet);
  await go(p, '#/max', 1200);
  check('the page says it in four words', (await txt(p, '#mx-h')) === 'Stuck? Call Bo.', await txt(p, '#mx-h'));
  check('a call plays by itself: Bo in the corner, the board, the dock', !!(await p.$('#mx-stage .mx-call')) && !!(await p.$('#mx-stage .mx-orb')) && !!(await p.$('#mx-stage .mx-dock')));
  await p.waitForTimeout(3800);
  const cap1 = await txt(p, '#mx-stage .mx-cc');
  check('captions come word by word, with who is talking', /^(Bo|You)\s+\S/.test(cap1), cap1);
  await p.waitForTimeout(2600); const cap2 = await txt(p, '#mx-stage .mx-cc');
  check('and move on', cap2 !== cap1 && cap2.length > 3, [cap1, cap2]);
  await p.click('[data-mx="toggle"]'); await p.waitForTimeout(300); const held = await txt(p, '#mx-stage .mx-cc'); await p.waitForTimeout(1500);
  check('Pause stops it where it is, and the button says Play', (await txt(p, '#mx-stage .mx-cc')) === held && /Play/.test(await txt(p, '[data-mx="toggle"]')) && (await p.getAttribute('[data-mx="toggle"]', 'aria-pressed')) === 'true');
  await p.click('.mx-ctl [data-mx="replay"]'); await p.waitForTimeout(400);
  check('Replay starts it over', /Pause/.test(await txt(p, '[data-mx="toggle"]')) && !(await p.evaluate(() => document.querySelector('#mx-stage .mx-call').classList.contains('mx-l3'))));
  check('what they say is also there as text', (await p.$$('.mx-script li')).length >= 6);
  const sec = await p.$$eval('.mx-h2', hs => hs.map(h => h.textContent.trim()));
  check('then three short parts: how it works, what you get, try it', sec.join('|') === 'How it works|What you get|Try it now. It’s free.', sec);
  const st = await api(p, 'ai_status'); log('visitor status:', JSON.stringify({ trial_minutes: st.json.trial_minutes }));
  check('the small print: every account gets free credits each month', /free credits each month\. No card\./.test(await txt(p, '[data-mx-fine]')) && /^Call Bo$/.test(await txt(p, '.mx-hero [data-mx-free]')), await txt(p, '[data-mx-fine]'));
  await p.click('.mx-hero [data-mx="free"]'); await p.waitForTimeout(500);
  check('a visitor who taps Call Bo is asked to sign up first', !!(await p.$('#auth-modal')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // the plans say where to see it, and so does the start page
  await go(p, '#/', 900); check('the start page has one line on Bo that opens the demo', (await p.getAttribute('.land-bo', 'href')) === '#/max');
  await c.close();

  // a phone, and someone who asked for less motion
  const [cp, ph] = await mk(390, 844, { serviceWorkers: 'block', isMobile: true, hasTouch: true }); await cp.addInitScript(quiet);
  await go(ph, '#/max', 1400);
  const box = await ph.$eval('#mx-stage', e => ({ w: e.clientWidth, h: e.clientHeight }));
  check('phone: the call is drawn upright, like a phone screen', box.h > box.w, box);
  check('phone: no sideways scroll', await hscroll(ph));
  await cp.close();
  const [cr, r] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' }); await cr.addInitScript(quiet);
  await go(r, '#/max', 900);
  check('less motion: the call is shown finished and still', await r.evaluate(() => { const e = document.querySelector('#mx-stage .mx-call'); return !!e && e.classList.contains('mx-still') && e.classList.contains('mx-l3'); }));
  await cr.close();

  // Alice has no plan: calls on her monthly credits
  const [ca, a] = await mk(1360, 900, { serviceWorkers: 'block' }); await ca.addInitScript(quiet); await ca.addInitScript(live);
  await go(a, '#/', 600); await login(a, 'alice.a@montana.edu'); await a.reload(); await a.waitForTimeout(1500);
  await a.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', 0); App.setSetting('boMode', ''); });
  const s0 = (await api(a, 'ai_status')).json; log('alice credits:', JSON.stringify(s0.credits));
  check('an account without a plan has its monthly credits, and no free minutes', s0.credits && s0.credits.allowance === 100 && s0.credits.left === 100 && s0.credits.call_rate === 6 && !s0.trial, s0.credits);
  await go(a, '#/', 1500);
  check('the start page offers Call Bo', /Call Bo/.test(await txt(a, '#bo-hub [data-bh="call"]')) && !/free/i.test(await txt(a, '#bo-hub [data-bh="call"]')), await txt(a, '#bo-hub'));
  await go(a, '#/max', 1200); check('the demo page says how long her credits last on a call', /You have 100 credits: about 16 minutes on a call\./.test(await txt(a, '[data-mx-fine]')), await txt(a, '[data-mx-fine]'));
  await a.click('.mx-hero [data-mx="free"]'); await a.waitForTimeout(1300);
  check('its Call Bo opens the Call Bo sheet', !!(await a.$('.cb .cb-classes')) && /about 16 minutes at 6 a minute/.test(await txt(a, '.cb-credits')), await txt(a, '.cb-credits'));
  await a.click('[data-cb-go]'); await a.waitForTimeout(800);
  check('Start the call opens the call, which says what it costs', !!(await a.$('#bo-talk')) && /100 credits · about 16 minutes at 6 a minute/.test(await txt(a, '.bt-free')), await txt(a, '#bo-talk .bt-free'));
  await a.click('#bt-start'); const t0 = Date.now(); let state = ''; while (Date.now() - t0 < 6000) { state = await a.evaluate(() => (document.querySelector('#bo-talk') || { dataset: {} }).dataset.state || ''); if (state === 'live') break; await a.waitForTimeout(80); }
  check('the call starts, on the light model', state === 'live', state);
  await a.waitForTimeout(1200); check('its clock runs (minutes left show only near the end)', /^\d+:\d\d$/.test((await txt(a, '#bt-clock')).replace(/\s/g, '')) || /\d:\d\d/.test(await txt(a, '#bt-clock')), await txt(a, '#bt-clock'));
  await a.click('#bo-talk [data-t="end"]'); await a.waitForTimeout(900);
  const after = (await api(a, 'ai_status')).json.credits; log('after the call:', JSON.stringify(after));
  check('after the call her credits are still there (a few seconds used at most)', after && after.left > 98 && after.left <= 100, after);
  // the credits run out
  sqlite(`INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES (${ALICE}, strftime('%s','now'), 'other', 100000, 100000, 0, 'test-out', 'test')`);
  await go(a, '#/tutor/calc', 1800);
  check('used up: Ask Bo says so, with Get credits', /out of credits/.test(await txt(a, '.bo-gate')) && !!(await a.$('.bo-gate a[href="#/usage"]')), await txt(a, '.bo-gate'));
  await go(a, '#/max', 1400);
  check('used up: the demo page says so', /out of credits/.test(await txt(a, '[data-mx-fine]')), await txt(a, '[data-mx-fine]'));
  await a.click('.mx-hero [data-mx="free"]'); await a.waitForTimeout(1300);
  check('and its Call Bo sheet offers Get credits instead of Start', !!(await a.$('.cb-acts a[href="#/usage"]')) && !(await a.$('[data-cb-go]')));
  await a.keyboard.press('Escape');
  const over = await api(a, 'ai_call_start', {});
  check('the server says no to another call (402, credits)', over.status === 402 && over.json.credits === true, over.json);
  await ca.close();
  fresh();
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
