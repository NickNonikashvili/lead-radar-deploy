/* ============================================================
   Classes on the website (assets/create.js, api/myclasses.php): classes are added by Mathub's team, so the Create
   page is for administrators. Guests and students who open it land on Request a class; a shared class link offers a
   student "Request it" instead of a copy. An administrator writes a class with Bo (a grocery list is refused), adds the
   example and a class from an AI's answer (no plan needed), shares one by link and QR code, and stops sharing. A class a
   student made before stays theirs: listed on Request a class with Open, Download and Delete (no Share), it opens with
   their plan and is locked without one, it comes back in a new browser, and Delete removes it everywhere. Mathub Pro is
   still bought through the RevenueCat web checkout (a stand-in RevenueCat answers in the tests).
   ============================================================ */
const T = require('./lib');
const fs = require('fs'); const path = require('path');
const STATE = path.join(__dirname, 'fixtures', 'rc-state.json');
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start();
  const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu', ADMIN = 'admin.user@montana.edu';
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const setRc = v => fs.writeFileSync(STATE, JSON.stringify(v));
  setRc({});
  const sample = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app-sample-class.json'), 'utf8');
  const other = sample.split('SKIL 101').join('WEBT 210').split('"SKIL').join('"WEBT');
  const paste = async (p, text) => { await p.evaluate(() => { document.querySelector('#mk-diy').open = true; }); await p.fill('#mk-text', text); await p.click('[data-action="check"]'); await p.waitForTimeout(400); };

  // a guest: the Create page is not for them
  const [cg, g] = await mk(1360, 900); await cg.addInitScript(quiet);
  await go(g, '#/create', 1200);
  check('a guest who opens Create a class lands on Request a class', /#\/request$/.test(g.url()) && !(await g.$('#mk-bo')), g.url());

  // the administrator: the Create page, with Bo
  const [cd, d] = await mk(1360, 900); await cd.addInitScript(quiet); await go(d, '#/'); check('the administrator signs in', await login(d, ADMIN)); await d.reload(); await d.waitForTimeout(800);
  for (const c of ((await api(d, 'myclasses')).json.classes || [])) await api(d, 'myclass_delete', { id: c.id });
  check('the administrator\'s sidebar has Add a class', !!(await d.$('.sb-add[href="#/create"]')));
  await go(d, '#/create', 1400);
  check('Create a class: Bo writes it from the syllabus first, the three do-it-yourself steps folded away', /Create a class/.test(await txt(d, '#view')) && /Bo writes it from your syllabus/.test(await txt(d, '#mk-bo')) && !!(await d.$('#mk-drop #mk-bo-file')) && !(await d.isVisible('#mk-diy .mk-step')));
  check('the other ways: the example, a share code, a class file, and your own AI', !!(await d.$('.mk-ways [data-action="example"]')) && !!(await d.$('.mk-ways #mk-code-form')) && !!(await d.$('.mk-ways #mk-file')) && /Use the AI you already use/.test(await txt(d, '#mk-diy summary')));
  check('the page says what is checked first and that the class is for everyone', /scanned for malware/.test(await txt(d, '.mk-bo-checks')) && /real course/.test(await txt(d, '.mk-bo-checks')) && /for everyone/.test(await txt(d, '.mk-bo-checks')));
  await d.fill('#mk-bo-text', 'TEST 101, Fall 2026'); await d.click('[data-bo-write]'); await d.waitForTimeout(4800);
  check('Write my class: Bo checks the syllabus and writes it, with Add to Mathub', !(await d.$('#paywall')) && (await d.$$eval('#mk-bo-steps li.done', l => l.length)) >= 3 && !!(await d.$('#mk-bo-result [data-publish]')), await txt(d, '#mk-bo'));
  await d.fill('#mk-bo-text', 'Grocery list: milk, eggs and bread.'); await d.click('[data-bo-write]'); await d.waitForTimeout(1600);
  check('a grocery list is refused with the reason', /does not look like a course syllabus/.test(await txt(d, '#mk-bo-result')) && !(await d.$('#mk-bo-result [data-publish]')), await txt(d, '#mk-bo-result'));
  // classes of their own: the example, and a class from an AI's answer, with no plan
  await d.click('[data-action="example"]'); await d.waitForTimeout(700); await d.click('#mk-alt-result [data-add]'); await d.waitForTimeout(1500);
  check('the example class is added and opens', !(await d.$('#paywall')) && /#\/my\d{4}\/dashboard/.test(d.url()), d.url());
  await go(d, '#/create', 1200); await paste(d, other);
  await d.click('#mk-result [data-add]'); await d.waitForTimeout(1500);
  check('a class from an AI\'s answer is added without a plan (administrators add classes)', !(await d.$('#paywall')) && /#\/my\d{4}\/dashboard/.test(d.url()), d.url());
  const myId = (/#\/(my\d{4})\//.exec(d.url()) || [])[1];
  check('the class page says where it is kept, with the way to manage it', /saved with your account/.test(await txt(d, '.mk-strip')) && !!(await d.$('.mk-strip a[href="#/create"]')));

  // sharing: a link, a code and a QR code
  await go(d, '#/create', 1200);
  await d.click(`[data-sharelink="${myId}"]`); await d.waitForTimeout(1800);
  const sh = await d.evaluate(() => { const s = document.querySelector('#share-sheet'); return s && { url: (s.querySelector('#share-url') || {}).value || '', qr: !!s.querySelector('svg.qr path'), code: (s.querySelector('.share-code b') || {}).textContent || '', text: s.textContent }; });
  check('Share gives a mathub.space/#/c/ link, its code and a QR code', sh && /^https:\/\/mathub\.space\/#\/c\/[A-Z2-9]{8}$/.test(sh.url) && sh.qr && sh.code.replace(/\s| /g, '') === sh.url.slice(-8), sh);
  const code = sh ? sh.url.slice(-8) : '';
  await d.keyboard.press('Escape'); await d.waitForTimeout(400);

  // the link, for a guest and a student: the class, and a way to request it (not a copy)
  await go(g, '#/c/' + code.toLowerCase(), 1800);
  check('a guest opens the link and sees the class, with Request WEBT 210 instead of Add', /WEBT 210/.test(await txt(g, '#shared-box')) && !(await g.$('[data-sc="add"]')) && !!(await g.$('#shared-box a[href^="#/request?code=WEBT"]')), (await txt(g, '#view')).slice(0, 160));
  check('the shared page shows nothing about who made it', !/admin/i.test(await txt(g, '#shared-box')));
  await g.click('[data-sc="report"]'); await g.waitForTimeout(500);
  check('Report opens the report form for this shared class', /Report this shared class/.test(await txt(g, '#report-modal')));
  await g.keyboard.press('Escape'); await g.waitForTimeout(300);
  const [cb, b] = await mk(390, 844); await cb.addInitScript(quiet); await go(b, '#/'); await login(b, BOB); await b.reload(); await b.waitForTimeout(800);
  await go(b, '#/c/' + code, 1800);
  check('a student gets Request WEBT 210 too', !!(await b.$('#shared-box a[href^="#/request?code=WEBT"]')) && !(await b.$('[data-sc="add"]')));
  check('no sideways scroll on a shared class at 390px', await hscroll(b));
  await b.click('#shared-box a[href^="#/request?code="]'); await b.waitForTimeout(900);
  check('which opens Request a class with the code filled in', /#\/request\?code=/.test(b.url()) && /WEBT 210/.test(await b.inputValue('#rq-code')), b.url());
  await go(b, '#/create', 1200);
  check('a student who opens Create a class lands on Request a class', /#\/request$/.test(b.url()) && !!(await b.$('#rq-form')));
  check('no sideways scroll on Request a class at 390px', await hscroll(b));
  await cb.close();

  // the administrator stops sharing: the link stops working
  await go(d, '#/create', 1200); await d.click(`[data-sharelink="${myId}"]`); await d.waitForTimeout(1500);
  await d.click('#share-sheet [data-sh="stop"]'); await d.waitForTimeout(1200);
  await go(g, '#/c/' + code, 1800);
  check('after sharing stops, the link says it is not shared any more', /not shared any more/.test(await txt(g, '#shared-box')), await txt(g, '#shared-box'));

  // Alice made a class before classes were added only by Mathub's team: it stays hers
  const [ca, a] = await mk(1360, 900); await ca.addInitScript(quiet); await go(a, '#/'); check('Alice signs in', await login(a, ALICE)); await a.reload(); await a.waitForTimeout(800);
  for (const c of ((await api(a, 'myclasses')).json.classes || [])) await api(a, 'myclass_delete', { id: c.id });
  const old = JSON.parse(other); Object.assign(old, { id: 'my4242', format: 'mathub-class-pack', version: 1 });
  check('her earlier class is in her account', (await api(a, 'myclass_save', { id: 'my4242', pack: old })).json.ok === true);
  const aliceId = (await api(a, 'create_status')).json.customer;
  setRc({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), store: 'rc_billing' } });
  await a.evaluate(() => App.subscription.refresh(true)); await a.evaluate(() => App.classSync.run(true)); await a.waitForTimeout(900);
  await go(a, '#/request', 1400);
  check('Request a class lists the classes she made before, with Open, Download and Delete, and no Share', /Classes you made before/.test(await txt(a, '#rq-own')) && !!(await a.$('#rq-own a[href="#/my4242/dashboard"]')) && !!(await a.$('#rq-own [data-file="my4242"]')) && !!(await a.$('#rq-own [data-del="my4242"]')) && !(await a.$('#rq-own [data-sharelink]')), await txt(a, '#rq-own'));
  check('her sidebar has Request a class, not Add a class', !!(await a.$('.sb-add[href="#/request"]')) && !(await a.$('.sb-add[href="#/create"]')));
  await go(a, '#/my4242/flashcards', 2000);
  check('with her plan, it opens', !(await a.$('.sublock')) && /flashcard/i.test(await txt(a, '#view')));
  check('its page points to managing it on Request a class', !!(await a.$('.mk-strip a[href="#/request"]')) || !(await a.$('.mk-strip')));
  // the Pro checkout on the website: the plans card from Settings, with her own RevenueCat link
  setRc({ [aliceId]: { expires: new Date(Date.now() - 864e5).toISOString(), store: 'rc_billing' } });
  await go(a, '#/settings', 1400); await a.click('#create-panel [data-cp="check"]'); await a.waitForTimeout(1800);
  check('after her plan ends, Settings says there is no plan', /No plan\./.test(await txt(a, '#create-panel')), await txt(a, '#create-panel'));
  await go(a, '#/my4242/dashboard', 1500);
  check('her class is locked, kept with the account', !!(await a.$('.sublock')) && /saved with your account/.test(await txt(a, '.sublock')) && /I already subscribed/.test(await txt(a, '.sublock')));
  await a.click('[data-lock="buy"]'); await a.waitForTimeout(800);
  const pw = await a.evaluate(() => { const s = document.querySelector('#paywall'); if (!s) return null; const b = s.querySelector('[data-action="pw-buy"]'); return { price: s.querySelector('#pw-price').textContent, tag: b.tagName, href: b.getAttribute('href'), target: b.getAttribute('target'), fine: (s.querySelector('.pw-fine') || {}).textContent || '' }; });
  check('the plans card: Pro $15 and Max $20 a month, with her own Pro checkout at RevenueCat in a new tab', pw && /Pro \$15 · Max \$20/.test(pw.price) && pw.tag === 'A' && /^https:\/\/pay\.rev\.cat\/sbx_pro_link\/mh_\d+$/.test(pw.href) && pw.target === '_blank' && /Stripe/.test(pw.fine), pw);
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);

  // a new browser: her class comes back from the account; deleting it removes it everywhere
  const [cn, n] = await mk(1360, 900); await cn.addInitScript(quiet); await go(n, '#/'); await login(n, ALICE); await n.reload(); await n.waitForTimeout(800); await go(n, '#/request', 2500);
  check('in a new browser, signing in brings her class down from the account', !!(await n.$('#rq-own [data-del="my4242"]')), await txt(n, '#rq-own'));
  await go(a, '#/request', 1400); await a.click('#rq-own [data-del="my4242"]'); await a.waitForTimeout(1500);
  check('Delete removes it from her account', ((await api(a, 'myclasses')).json.classes || []).length === 0);
  await n.evaluate(() => App.classSync.run(true)); await n.waitForTimeout(800); await go(n, '#/request', 1500);
  check('and the other browser drops it when it syncs', !(await n.$('#rq-own [data-del="my4242"]')) && await n.evaluate(() => document.querySelector('#rq-own').hidden), await n.evaluate(() => ({ hidden: document.querySelector('#rq-own') && document.querySelector('#rq-own').hidden, list: JSON.parse(localStorage.getItem('mh-my-classes') || '[]').map(e => e.id), url: location.hash })));

  // signing out on the website clears classes from this browser
  await d.evaluate(() => App.auth.logout()); await d.waitForTimeout(1500);
  const left = await d.evaluate(() => ({ list: JSON.parse(localStorage.getItem('mh-my-classes') || '[]').length, reg: Object.keys(window.Courses).filter(k => /^my\d{4}$/.test(k)).length }));
  check('signing out takes the classes off this browser', left.list === 0 && left.reg === 0, left);
  await go(d, '#/'); await login(d, ADMIN);
  for (const c of ((await api(d, 'myclasses')).json.classes || [])) await api(d, 'myclass_delete', { id: c.id });
  try { fs.unlinkSync(STATE); } catch (e) {}
  log('share code:', code);
  await T.finish();
})().catch(e => { console.error(e); try { require('fs').unlinkSync(require('path').join(__dirname, 'fixtures', 'rc-state.json')); } catch (x) {} process.exit(1); });
