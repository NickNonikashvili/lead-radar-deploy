/* The Max page (#/max) and the free minutes with Bo. The page: the self-playing call (captions word by word,
   pause and replay, what they say as text, the still version for reduced motion), phones, and its button for
   each kind of visitor. The free minutes, in the browser, for an account without Max: the start page's Call Bo
   free, Ask Bo's free box, a real call on them (the call is the stand-in from tests/talk-fakes.js) with the
   minutes left on its clock, and what changes once they are used. The server side is in ai-api.test.js. */
const T = require('./lib'); const path = require('path');
const { live, quiet } = require('./talk-fakes');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]);
const ALICE = "(SELECT id FROM users WHERE email = 'alice.a@montana.edu')";
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start({ audio: true });
  const fresh = () => sqlite(`DELETE FROM ai_trial WHERE user_id = ${ALICE}; DELETE FROM ai_live WHERE user_id = ${ALICE}; DELETE FROM rate WHERE key LIKE 'ai_live:%'`);
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
  check('then three short parts: how it works, what Max gives you, try it', sec.join('|') === 'How it works|What Max gives you|Try it now. It’s free.' || sec.length === 3, sec);
  const st = await api(p, 'ai_status'); log('visitor status:', JSON.stringify({ trial_minutes: st.json.trial_minutes }));
  check('the small print follows the free minutes set in the admin panel', st.json.trial_minutes ? new RegExp(`^${st.json.trial_minutes} minutes free`).test(await txt(p, '[data-mx-fine]')) : /part of Mathub Max/.test(await txt(p, '[data-mx-fine]')), await txt(p, '[data-mx-fine]'));
  await p.click('.mx-hero [data-mx="free"]'); await p.waitForTimeout(500);
  check('a visitor who taps Call Bo free is asked to sign up first', !!(await p.$('#auth-modal')));
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

  // Alice has no plan: her free minutes
  const [ca, a] = await mk(1360, 900, { serviceWorkers: 'block' }); await ca.addInitScript(quiet); await ca.addInitScript(live);
  await go(a, '#/', 600); await login(a, 'alice.a@montana.edu'); await a.reload(); await a.waitForTimeout(1500);
  await a.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', 0); App.setSetting('boMode', ''); });
  const s0 = (await api(a, 'ai_status')).json; log('alice status:', JSON.stringify(s0.trial));
  check('an account without Max has its free minutes, none used', !!s0.trial && s0.trial.minutes === s0.trial_minutes && s0.trial.used === 0 && s0.trial.left === 60 * s0.trial.minutes, s0.trial);
  await go(a, '#/', 1500);
  check('the start page offers Call Bo free', /Call Bo free/.test(await txt(a, '#bo-hub [data-bh="trial"]')), await txt(a, '#bo-hub'));
  await go(a, '#/max', 1200); check('the Max page says how many free minutes she has', /free\. No card\./.test(await txt(a, '[data-mx-fine]')), await txt(a, '[data-mx-fine]'));
  await go(a, '#/tutor/calc', 1800);
  check('Ask Bo shows the free minutes and a Call Bo free button', /Talk to him free for \d+ minutes/.test(await txt(a, '.bo-free')) && !!(await a.$('.bo-free [data-go="trial"]')));
  await a.click('.bo-free [data-go="trial"]'); await a.waitForTimeout(700);
  check('it opens the call, which says the minutes are on us', !!(await a.$('#bo-talk')) && /free minutes with Bo, on us/.test(await txt(a, '.bt-free')), await txt(a, '#bo-talk .bt-free'));
  await a.click('#bt-start'); const t0 = Date.now(); let state = ''; while (Date.now() - t0 < 6000) { state = await a.evaluate(() => (document.querySelector('#bo-talk') || { dataset: {} }).dataset.state || ''); if (state === 'live') break; await a.waitForTimeout(80); }
  check('the call starts on the free minutes', state === 'live', state);
  await a.waitForTimeout(1200); check('its clock shows the free minutes left', /free min left/.test(await txt(a, '#bt-clock')), await txt(a, '#bt-clock'));
  await a.click('#bo-talk [data-t="end"]'); await a.waitForTimeout(900);
  const row = (await api(a, 'ai_status')).json.trial; log('after the call:', JSON.stringify(row));
  check('after the call the minutes are still there (a few seconds used at most)', row && row.left > 60 * (row.minutes - 1), row);
  // the minutes run out
  sqlite(`INSERT OR REPLACE INTO ai_trial (user_id, used, first) VALUES (${ALICE}, 100000, strftime('%s','now'))`);
  await a.reload(); await a.waitForTimeout(1800);
  check('used up: no free box in Ask Bo', !(await a.$('.bo-free')));
  await go(a, '#/max', 1400);
  check('used up: the Max page says so, and the button is Get Mathub Max', /used your free minutes/.test(await txt(a, '[data-mx-fine]')) && /Get Mathub Max/.test(await txt(a, '.mx-hero [data-mx="free"]')));
  await a.click('.mx-hero [data-mx="free"]'); await a.waitForTimeout(600);
  check('and it opens the plans', !!(await a.$('#paywall')));
  const over = await api(a, 'ai_call_start', {});
  check('the server says no to another free call', over.status === 402 && over.json.trial_over === true, over.json);
  await ca.close();
  fresh();
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
