/* ============================================================
   Your plan (#/plan) and Bo on the start page, in the browser (assets/create.js, api plan_cancel):
   - a guest is asked to sign in; without a plan: the free plan, the plans side by side, and the way to each
   - the start page has Bo and the plan in one card: Call Bo, Ask Bo and Add a class with Max; Ask Bo here (the
     floating Bo, part of Pro) and Add a class with Pro; the two plans and Add a class (free) without one; the
     account menu links to Your plan
   - with a website plan: how it is paid, when it renews, this month's use, Manage billing, and Cancel plan:
     an honest dialog (what changes and when, an optional reason, Keep my plan), cancelled right on StudyCat through
     RevenueCat's API v2, or the billing page when that cannot be done; an App Store plan is sent to the App Store;
     a plan given to a tester cannot be cancelled
   RevenueCat (v1 and v2) is a stand-in (tests/pyodide/router.php); mod.user has Max through plan_grants.
   ============================================================ */
const T = require('./lib');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]);
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const STATE = path.join(__dirname, 'fixtures', 'rc-state.json'); const CANCELS = path.join(__dirname, 'fixtures', 'rc-cancels.json');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const sql = (q, arg) => (spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute($argv[3] === "" ? [] : [$argv[3]]); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, arg === undefined ? '' : String(arg)], { encoding: 'utf8' }).stdout || '[]');
(async () => {
  const { mk, txt, login, api, go, hscroll, check } = await T.start({ freeHome: true });
  fs.writeFileSync(STATE, '{}'); try { fs.unlinkSync(CANCELS); } catch (e) {}
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const setup = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['calc', 'physics']; s.asof = '2026-10-13'; s.lastVisit = { course: 'calc', label: 'Calc I' }; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} };
  const open = async (w, h, email) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(quiet); await c.addInitScript(setup); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };
  const plan = async (p, id, o) => { fs.writeFileSync(STATE, JSON.stringify(o ? { [id]: Object.assign({ expires: new Date(Date.now() + 20 * 864e5).toISOString() }, o) } : {})); await api(p, 'create_status&refresh=1'); await p.evaluate(() => App.subscription.refresh(true)); await p.waitForTimeout(300); };

  // a guest
  const [cg, g] = await open(1360, 900);
  await go(g, '#/plan', 1200);
  check('a guest is asked to sign in to see a plan', /Sign in to see your plan/.test(await txt(g, '#pl-now')) && !!(await g.$('[data-pl="login"]')));
  check('the plans are there for a guest too: Free, Pro and Max', (await g.$$('.pl-card')).length === 3);
  await go(g, '#/', 1200);
  check('a guest\'s start page has no Bo card (it needs an account)', !(await g.$('#bo-hub')));
  await cg.close();

  // alice without a plan
  const [ca, a] = await open(1360, 900, 'alice.a@montana.edu');
  const aliceId = (await api(a, 'create_status')).json.customer;
  await plan(a, aliceId, null);
  await go(a, '#/', 1800);
  const hf = await a.evaluate(() => { const h = document.querySelector('#bo-hub'); return h && { h: h.querySelector('h2').textContent, acts: [...h.querySelectorAll('.bh-act b')].map(b => b.textContent), plan: h.querySelector('.bh-plan').getAttribute('href'), chip: h.querySelector('.bh-plan b').textContent, before: !!h.closest('.dwc-bo') }; });   // in the Bo widget of the home page (assets/dash.js)
  check('without a plan, the home page\'s Bo widget has Meet Bo: Call Bo, Ask Bo and Add a class, with her credits', hf && hf.h === 'Meet Bo, your tutor' && hf.acts.join() === 'Call Bo,Ask Bo,Add a class' && hf.plan === '#/plan' && hf.chip === 'Free' && hf.before && /\d+ credits left: about \d+ minutes on a call/.test(await txt(a, '#bh-sub')) && /Credits\s*\d+/.test(await txt(a, '#bo-hub a.bh-plan[href="#/usage"]')), Object.assign(hf, { sub: await txt(a, '#bh-sub'), pill: await txt(a, '#bo-hub a.bh-plan[href="#/usage"]') }));
  await a.click('#bo-hub [data-bh="call"]'); await a.waitForTimeout(1300);
  check('Call Bo opens the Call Bo sheet (pick the class, see the credits)', !!(await a.$('.cb .cb-classes')) && /credits/.test(await txt(a, '.cb-credits')));
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  // out of credits: Get credits comes first
  sqlite(`INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES ((SELECT id FROM users WHERE email = 'alice.a@montana.edu'), strftime('%s','now'), 'other', 100000, 100000, 0, 'test-out', 'test')`);
  await a.reload(); await a.waitForTimeout(1800);
  const hu = await a.evaluate(() => ({ acts: [...document.querySelectorAll('#bo-hub .bh-act b')].map(b => b.textContent), main: (document.querySelector('#bo-hub .bh-main b') || {}).textContent }));
  check('out of credits, it leads with Get credits (to Usage), then Call Bo and Ask Bo', hu.acts.join() === 'Get credits,Call Bo,Ask Bo' && hu.main === 'Get credits' && (await a.getAttribute('#bo-hub a.bh-act.bh-main', 'href')) === '#/usage' && /out of credits/.test(await txt(a, '#bh-sub')), hu);
  sqlite(`DELETE FROM credit_use WHERE ref = 'test-out'`);
  await go(a, '#/plan', 1500);
  check('Your plan without one: the free plan, Get Max and Get Pro, and her free credits', /You’re on the free plan/.test(await txt(a, '#pl-now')) && !!(await a.$('#pl-now [data-pl="buy-max"]')) && !!(await a.$('#pl-now [data-pl="buy-pro"]')) && /Credits this month/.test(await txt(a, '#pl-use')) && /of 100 left/.test(await txt(a, '#pl-use')), await txt(a, '#pl-use'));
  check('the free card is marked as hers', (await a.$eval('.pl-card.mine h3', h => h.textContent)) === 'Free');
  await a.click('.pl-card [data-pl="buy-pro"]'); await a.waitForTimeout(1200);
  check('Get Pro on its card opens both plans, Pro picked', (await a.$$eval('#paywall [data-plan]', b => b.map(x => x.dataset.plan).join())) === 'pro,max' && /Get Pro/.test(await txt(a, '#paywall [data-action="pw-buy"]')));
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);

  // alice with Pro
  await plan(a, aliceId, { plan: 'pro', store: 'rc_billing' });
  await go(a, '#/', 1800);
  const hp = await a.evaluate(() => { const h = document.querySelector('#bo-hub'); return { acts: [...h.querySelectorAll('.bh-act b')].map(b => b.textContent), main: h.querySelector('.bh-act.bh-main b').textContent, chip: h.querySelector('.bh-plan b').textContent, sub: h.querySelector('#bh-sub').textContent }; });
  check('with Pro: the same three, and her 1,000 credits', hp.main === 'Call Bo' && hp.acts.join() === 'Call Bo,Ask Bo,Add a class' && hp.chip === 'Pro' && /1,000 credits left: about 166 minutes on a call/.test(hp.sub), hp);
  await go(a, '#/plan', 1800);
  const mp = await a.$$eval('.pl-m', ms => ms.map(m => m.querySelector('b').textContent));
  check('Pro\'s credits on Your plan: this month\'s and the bought ones', mp.join() === 'Credits this month,Credits you bought' && /1,000 left/.test(await txt(a, '#pl-use')), mp);
  check('with Pro, the plan card has Move up to Max', !!(await a.$('#pl-now [data-pl="buy-max"]')));

  // alice with Max, bought on the website
  await plan(a, aliceId, { plan: 'max', store: 'rc_billing' });
  await go(a, '#/', 1800);
  const hm = await a.evaluate(() => { const h = document.querySelector('#bo-hub'); return { acts: [...h.querySelectorAll('.bh-act b')].map(b => b.textContent), main: h.querySelector('.bh-act.bh-main b').textContent, ask: h.querySelector('a.bh-act[href^="#/tutor"]').getAttribute('href'), chip: h.querySelector('.bh-plan b').textContent, sub: h.querySelector('#bh-sub').textContent, row: getComputedStyle(h.querySelector('.bh-act.bh-main')).flexDirection }; });
  check('with Max: Call Bo, Ask Bo (her class) and Add a class, with her 2,000 credits', hm.acts.join() === 'Call Bo,Ask Bo,Add a class' && hm.main === 'Call Bo' && hm.ask === '#/tutor/calc' && hm.chip === 'Max' && /2,000 credits left: about 117 minutes on a call/.test(hm.sub) && hm.row === 'row', hm);
  await a.click('#bo-hub [data-bh="call"]'); await a.waitForTimeout(1300);
  check('Call Bo before agreeing to Bo\'s terms: the sheet says what a call sends where', /OpenAI/.test(await txt(a, '.cb-consent')) && /Calc/i.test(await txt(a, '.cb-class.on')));
  await a.click('[data-cb-go]'); await a.waitForTimeout(900);
  check('Start opens the call right there, about her class, and counts as agreeing', !!(await a.$('#bo-talk')) && (await txt(a, '#bo-talk .bt-class')) === 'Calc I' && /^#\/$|^$/.test(new URL(a.url()).hash) && await a.evaluate(() => !!App.settings().aiConsent));
  await a.keyboard.press('Escape'); await a.waitForTimeout(500);
  // the account menu
  await a.click('#topbar-account [data-action="acct-toggle"]'); await a.waitForTimeout(300);
  const mi = await a.$eval('.pop-account a[href="#/plan"]', x => [x.querySelector('span').textContent, (x.querySelector('.plan-pill') || {}).textContent]).catch(e => String(e).slice(0, 120));
  check('the account menu has Your plan, with the plan on it', Array.isArray(mi) && mi[0] === 'Your plan' && mi[1] === 'Max', mi);
  await a.keyboard.press('Escape');
  await go(a, '#/plan', 1800);
  const now = await txt(a, '#pl-now');
  check('Your plan: Max, active, $20 a month, when it renews, paid on the website, her account', /Active/.test(now) && /StudyCat Max/.test(now) && /\$20 a month/.test(now) && /Renews/.test(now) && /the website \(card, through Stripe\)/.test(now) && /alice\.a@montana\.edu/.test(now), now);
  check('Manage billing opens the billing page in a new tab', (await a.$eval('#pl-now a[target="_blank"]', x => x.href)) === 'https://billing.example/manage');
  const mm = await a.$$eval('.pl-m', ms => ms.map(m => [m.querySelector('b').textContent, m.querySelector('[role="progressbar"]') ? m.querySelector('[role="progressbar"]').getAttribute('aria-valuetext') : '']));
  check('her credits: this month\'s as a labelled meter, the bought ones, when they come back, and the way to Usage', mm.length === 2 && mm[0][0] === 'Credits this month' && mm[1][0] === 'Credits you bought' && /come back on/.test(await txt(a, '#pl-use')) && /A call minute is 17 credits/.test(await txt(a, '#pl-use')) && !!(await a.$('#pl-use a[href="#/usage"]')), mm);
  check('the Max card is marked as hers', (await a.$eval('.pl-card.mine h3', h => h.textContent)) === 'StudyCat Max');
  await a.click('.pl-faq details:first-child summary'); await a.waitForTimeout(200);
  check('the questions open: how to cancel', /Cancel plan/.test(await txt(a, '.pl-faq details[open]')));
  // cancelling: Keep my plan, then cancel with a reason
  await a.click('[data-pl="cancel"]'); await a.waitForTimeout(500);
  const dlg = await txt(a, '#pl-cancel');
  check('Cancel plan asks first: when it ends, what stops, what is kept, an optional reason', /Cancel StudyCat Max\?/.test(dlg) && /stays on until/.test(dlg) && /free plan’s credits each month/.test(dlg) && /kept, locked/.test(dlg) && (await a.$$('#pl-cancel input[name="pl-why"]')).length === 5 && /Keep my plan/.test(dlg), dlg.slice(0, 300));
  check('Keep my plan has the focus', await a.evaluate(() => document.activeElement && document.activeElement.dataset.x === 'keep' && /Keep my plan/.test(document.activeElement.textContent)));
  await a.click('#pl-cancel .pl-cx-acts [data-x="keep"]'); await a.waitForTimeout(400);
  check('Keep my plan closes it, and nothing changed', !(await a.$('#pl-cancel')) && !fs.existsSync(CANCELS));
  await a.click('[data-pl="cancel"]'); await a.waitForTimeout(500);
  await a.click('#pl-cancel .pl-why-o:nth-child(3)'); await a.fill('#pl-cx-note', 'Great for exams, back in spring');
  await a.click('#pl-cancel [data-x="go"]'); await a.waitForTimeout(2200);
  check('cancelling on the website is done right on StudyCat, through RevenueCat', JSON.parse(fs.readFileSync(CANCELS, 'utf8')).includes(aliceId) && /is cancelled\. It stays on until/.test(await txt(a, '.toast')));
  const after = await txt(a, '#pl-now');
  check('the plan now says when it ends, that it will not renew, and how to turn it back on; Cancel is gone', /Ends /.test(after) && /will not renew/.test(after) && /Turn it back on/.test(after) && !(await a.$('[data-pl="cancel"]')), after);
  const fb = JSON.parse(sql('SELECT plan, store, reason, note FROM plan_feedback WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY id DESC LIMIT 1', 'alice.a@montana.edu'))[0] || {};
  check('her reason is kept with her account', fb.plan === 'max' && fb.store === 'rc_billing' && fb.reason === 'done' && fb.note === 'Great for exams, back in spring', fb);
  await go(a, '#/', 1800);
  check('the start page says the plan ends', /Your plan ends/.test(await txt(a, '#bh-sub')));
  // when RevenueCat cannot cancel it here: the billing page
  await plan(a, aliceId, { plan: 'max', store: 'rc_billing', v2fail: true });
  await go(a, '#/plan', 1800); await a.click('[data-pl="cancel"]'); await a.waitForTimeout(500); await a.click('#pl-cancel [data-x="go"]'); await a.waitForTimeout(1800);
  check('when it cannot be cancelled here, the billing page is one click away', /One more step/.test(await txt(a, '#pl-cancel')) && (await a.$eval('#pl-cancel a[target="_blank"]', x => x.href)) === 'https://billing.example/manage');
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  // a plan from the App Store
  await plan(a, aliceId, { plan: 'max', store: 'app_store' });
  await go(a, '#/', 600); await go(a, '#/plan', 1800);
  check('a plan bought in the iPhone app says so', /the App Store/.test(await txt(a, '#pl-now')), await txt(a, '#pl-now'));
  await a.click('[data-pl="cancel"]'); await a.waitForTimeout(500);
  check('its cancel button says it is done in the App Store', /Cancel in the App Store/.test(await txt(a, '#pl-cancel [data-x="go"]')));
  await a.click('#pl-cancel [data-x="go"]'); await a.waitForTimeout(1500);
  check('and the App Store subscriptions are one click away', (await a.$eval('#pl-cancel a[target="_blank"]', x => x.href)) === 'https://apps.apple.com/account/subscriptions');
  await a.keyboard.press('Escape');
  await plan(a, aliceId, null);
  await ca.close();

  // a plan given to a tester
  const [cm, m] = await open(1360, 900, 'mod.user@montana.edu');
  await go(m, '#/plan', 1800);
  check('a plan given to the account says so, and has nothing to cancel or manage', /Given to your account/.test(await txt(m, '#pl-now')) && /Free for you/.test(await txt(m, '#pl-now')) && !(await m.$('[data-pl="cancel"]')) && !(await m.$('#pl-now a[target="_blank"]')));
  const gr = await api(m, 'plan_cancel', {});
  check('and the server agrees: nothing to cancel', gr.json.ok && gr.json.how === 'granted', gr.json);
  await cm.close();

  // phones
  const [cp, ph] = await open(390, 844, 'mod.user@montana.edu');
  await go(ph, '#/plan', 1800);
  check('phone: Your plan does not scroll sideways', await hscroll(ph));
  check('phone: the plans stack', await ph.$$eval('.pl-card', cs => cs.length === 3 && cs[1].getBoundingClientRect().top > cs[0].getBoundingClientRect().bottom));
  await go(ph, '#/', 1800);
  check('phone: the start page with Bo does not scroll sideways, and his actions stack', await hscroll(ph) && await ph.$$eval('#bo-hub .bh-act', as => as.length === 3 && as[1].getBoundingClientRect().top >= as[0].getBoundingClientRect().bottom - 1 && as[0].getBoundingClientRect().height >= 60));
  await cp.close();

  fs.writeFileSync(STATE, '{}'); try { fs.unlinkSync(CANCELS); } catch (e) {}
  sqlite(`DELETE FROM ai_trial WHERE user_id = (SELECT id FROM users WHERE email = 'alice.a@montana.edu')`);   // her free minutes back, for the other tests
  await T.finish();
})().catch(e => { console.error(e); try { require('fs').writeFileSync(require('path').join(__dirname, 'fixtures', 'rc-state.json'), '{}'); } catch (x) {} process.exit(1); });
