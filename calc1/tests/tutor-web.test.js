/* ============================================================
   Mathub Pro and Max, Ask Bo and "Let Bo write it", in the browser (assets/tutor.js, assets/create.js):
   - guests are asked to sign in; without Max the tutor shows what Bo does and offers Max only;
     Pro members are offered the move up to Max
   - a Max member agrees to what is sent to the AI first, then chats: Bo greets with the next exam and
     the weakest topic (from this device, free), answers with the progress snapshot sent along, keeps
     notes she can see and delete, takes a photo, and every answer can be reported
   - Bo writes a class from a pasted syllabus, step by step, and it is added like any other class
   The AI and RevenueCat are stand-ins (tests/pyodide/router.php); mod.user has Max through plan_grants.
   ============================================================ */
const T = require('./lib');
const fs = require('fs'); const path = require('path');
const STATE = path.join(__dirname, 'fixtures', 'rc-state.json'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAABJRU5ErkJggg==';
(async () => {
  const { mk, txt, login, api, go, hscroll, check } = await T.start();
  fs.writeFileSync(STATE, '{}');
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const setup = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['calc', 'physics']; s.asof = '2026-10-13'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} };
  const open = async (w, h, email) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(quiet); await c.addInitScript(setup); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };
  const last = () => JSON.parse(fs.readFileSync(LAST, 'utf8'));

  // a guest
  const [cg, g] = await open(1360, 900);
  await go(g, '#/tutor', 1500);
  check('a guest is asked to sign in to talk with Bo', /Sign in to talk with Bo/.test(await txt(g, '#bo-main')) && !!(await g.$('[data-go="login"]')));
  await go(g, '#/calc/dashboard', 1500);
  check('the website\'s top bar has Ask Bo, pointing at the class you are in', (await g.$eval('#bo-top', a => a.getAttribute('href'))) === '#/tutor/calc' && /Ask Bo/.test(await txt(g, '#bo-top')));
  await cg.close();

  // alice without a plan, then with Pro
  const [ca, a] = await open(1360, 900, 'alice.a@montana.edu');
  await api(a, 'create_status&refresh=1');
  await go(a, '#/tutor', 1800);
  check('without Max: Meet Bo, what he does, and Get Mathub Max', /Meet Bo, your tutor/.test(await txt(a, '#bo-main')) && (await a.$$('.bo-perks li')).length === 5 && /Call him/.test(await txt(a, '.bo-perks')) && /Get Mathub Max/.test(await txt(a, '[data-go="max"]')));
  await a.click('[data-go="max"]'); await a.waitForTimeout(1500);
  const pw = await a.evaluate(() => { const s = document.querySelector('#paywall'); return s && { h: s.querySelector('h2').textContent, plans: [...s.querySelectorAll('[data-plan]')].map(b => b.dataset.plan), buy: (s.querySelector('[data-action="pw-buy"]') || {}).textContent, href: (s.querySelector('[data-action="pw-buy"]') || {}).getAttribute && s.querySelector('[data-action="pw-buy"]').getAttribute('href'), why: s.querySelector('.pw-why').textContent }; });
  check('Bo\'s paywall offers Max only, at $50, with her Max checkout', pw && pw.h === 'Mathub Max' && pw.plans.join() === 'max' && /Get Max for \$50 a month/.test(pw.buy) && /^https:\/\/pay\.rev\.cat\/sbx_max_link\/mh_\d+$/.test(pw.href) && /part of Mathub Max/.test(pw.why), pw);
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  const aliceId = (await api(a, 'create_status')).json.customer;
  fs.writeFileSync(STATE, JSON.stringify({ [aliceId]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'pro' } }));
  await api(a, 'create_status&refresh=1'); await a.evaluate(() => App.subscription.refresh(true)); await a.waitForTimeout(500);
  await go(a, '#/create', 1500);
  check('with Pro, the Create page says Pro is on and Bo writes her classes, with the way up to Max for Ask Bo', /Mathub Pro is on: Bo writes your classes/.test(await txt(a, '#mk-sub')) && !!(await a.$('#mk-bo-text')) && /classes left this month/.test(await txt(a, '#mk-bo-left')), await txt(a, '#mk-sub'));
  await a.fill('#mk-bo-text', 'TEST 102 Pro writing, Fall 2026. Exam 1 Oct 20. Topics: ratios, percents, rates, growth.');
  await a.click('[data-bo-write]'); await a.waitForTimeout(5000);
  check('Bo writes a class for a Pro member too: no plans card, the steps run, then the preview with Add', !(await a.$('#paywall')) && (await a.$$eval('#mk-bo-steps li.done', l => l.length)) === 4 && /TEST 101/.test(await txt(a, '#mk-bo-result')) && !!(await a.$('#mk-bo-result [data-add]')) && /Your class is ready/.test(await txt(a, '#mk-prog-now')), await txt(a, '#mk-bo'));
  await a.click('#mk-sub [data-action="sub-max"]'); await a.waitForTimeout(1200);
  check('the move-up card: Max only, and a note to cancel Pro on the website so she is not billed twice', /Move up to Max/.test(await txt(a, '#paywall h2')) && /cancel Pro/.test(await txt(a, '#paywall .pw-fine')) && /Move up to Max for \$50 a month/.test(await txt(a, '#paywall [data-action="pw-buy"]')));
  await a.keyboard.press('Escape');
  fs.writeFileSync(STATE, '{}'); await api(a, 'create_status&refresh=1');
  await ca.close();

  // a Max member (granted)
  const [cm, m] = await open(1360, 900, 'mod.user@montana.edu');
  await api(m, 'ai_forget', { what: 'all' });
  for (const c of ((await api(m, 'myclasses')).json.classes || [])) await api(m, 'myclass_delete', { id: c.id });
  await m.evaluate(() => App.setSetting('aiConsent', 0));
  await go(m, '#/tutor/calc', 1800);
  const cons = await txt(m, '#bo-main');
  check('before the first question: what is sent to Anthropic, that it is not used for training, and where the chat is kept', /Before you start/.test(cons) && /Anthropic/.test(cons) && /does not train/.test(cons) && /saved with your Mathub account/.test(cons) && !!(await m.$('[data-go="agree"]')), cons.slice(0, 200));
  await m.click('[data-go="agree"]'); await m.waitForTimeout(1800);
  const greet = await txt(m, '#bo-log .bo-msg.bo');
  check('Bo greets from what the device knows (no AI call): the next exam and the weakest topic', /I'm Bo/.test(greet) && /Exam 2 is in 3 days/.test(greet) && /weakest topic/.test(greet), greet);
  check('suggestions to start from', (await m.$$('#bo-suggest .bo-chip')).length >= 3 && /Quiz me for Exam 2/.test(await txt(m, '#bo-suggest')));
  await m.fill('#bo-q', 'Please remember I like worked examples. And math: is x < 3?'); await m.click('.bo-send'); await m.waitForTimeout(2500);
  const reply = await txt(m, '#bo-log .bo-msg.bo:last-child');
  check('Bo answers in the chat, with what the device sent: her weakest topic', /Bo here\. Your weakest topic is/.test(reply) && /x < 3 here/.test(reply), reply.slice(0, 200));
  const q = last(); const sys = q.system.map(b => b.text).join('\n');
  check('the device sent a progress snapshot (readiness, topics, due cards) and the date it uses', /READINESS: Exam 2 on 2026-10-16 \(3 days\)/.test(sys) && /WEAKEST TOPICS: /.test(sys) && /TODAY: 2026-10-13/.test(sys) && /flashcards due/.test(sys), sys.slice(-600));
  check('a note Bo keeps shows under his answer, with Forget it', /Bo will remember: Likes worked examples first/.test(await txt(m, '#bo-log .bo-remember')));
  await m.click('#bo-log .bo-msg.bo:last-child [data-bo-report]'); await m.waitForTimeout(500);
  check('every answer can be reported', /Report this answer from Bo/.test(await txt(m, '#report-modal')));
  await m.keyboard.press('Escape'); await m.waitForTimeout(300);
  // a photo
  await m.setInputFiles('#bo-file', { name: 'problem.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }); await m.waitForTimeout(600);
  check('a photo shows before sending, and can be removed', !!(await m.$('#bo-photo-prev img')) && !!(await m.$('#bo-photo-prev [data-bo-unphoto]')));
  await m.fill('#bo-q', 'Help with this one'); await m.click('.bo-send'); await m.waitForTimeout(2500);
  const lq = last(); const lc = lq.messages[lq.messages.length - 1].content;
  check('the photo goes as a small JPEG made on the device, and Bo sees it', lc[0].type === 'image' && lc[0].source.media_type === 'image/jpeg' && /I see your photo/.test(await txt(m, '#bo-log .bo-msg.bo:last-child')) && /Photo/.test(await m.evaluate(() => { const y = document.querySelectorAll('#bo-log .bo-msg.you'); return y[y.length - 1].textContent; })), lc.map(b => b.type));
  // What Bo knows: a side panel next to the chat on a wide screen
  const side = await m.evaluate(() => { const s = document.querySelector('#bo-side'); const r = s.getBoundingClientRect(); const c = document.querySelector('.bo-col').getBoundingClientRect(); return { shown: getComputedStyle(s).display !== 'none' && r.width > 200, beside: r.left >= c.right, knowsBtn: getComputedStyle(document.querySelector('.bo-knows-btn')).display }; });
  check('on a wide screen, What Bo knows sits beside the chat (and the i button steps aside)', side.shown && side.beside && side.knowsBtn === 'none', side);
  const k = await txt(m, '#bo-side');
  check('What Bo knows: the class, the next exam, weakest topics, his notes and questions left', /The class/.test(k) && /Exam 2, in 3 days/.test(k) && /Weakest topics/.test(k) && /Likes worked examples first/.test(k) && /questions left/.test(k), k.slice(0, 300));
  await m.click('#bo-side [data-k-note="0"]'); await m.waitForTimeout(700);
  check('a note can be deleted there', !/Likes worked examples first/.test(await txt(m, '#bo-side .bo-k-notes')) && ((await api(m, 'ai_status')).json.notes || []).length === 0);
  // the chat is kept with the account
  await m.reload(); await m.waitForTimeout(2200);
  check('the chat is still there after a reload (kept with the account)', (await m.$$('#bo-log .bo-msg.you')).length === 2 && (await m.$$('#bo-log .bo-msg.bo')).length === 2);
  // exam week leads to Bo
  await go(m, '#/calc/dashboard', 1800);
  const quiz = await m.$eval('.xw-dash .xw-item[href^="#/tutor/"]', x => x.getAttribute('href'));
  check('exam week has "Ask Bo to quiz you"', quiz === '#/tutor/calc?q=quiz', quiz);
  await go(m, quiz, 2200);
  check('which opens Bo with the quiz request ready to send', /Quiz me for Exam 2/.test(await m.$eval('#bo-q', x => x.value)));
  // Bo writes a class
  await go(m, '#/create', 1500);
  check('with Max, the Create page says so, with the link to ask Bo, and the syllabus form', /Mathub Max is on/.test(await txt(m, '#mk-sub')) && !!(await m.$('#mk-sub a[href="#/tutor"]')) && !!(await m.$('#mk-bo-text')));
  await m.fill('#mk-bo-text', 'TEST 101 Testing Bo, Fall 2026. Exam 1 Oct 20. Topics: ratios, percents, rates, growth.');
  await m.click('[data-bo-write]'); await m.waitForTimeout(5000);
  const steps = await m.$$eval('#mk-bo-steps li', ls => ls.map(l => [l.textContent.trim(), l.className]));
  check('Bo shows his steps: reading the syllabus, each unit, checking', steps.length === 4 && steps.every(s => s[1] === 'done') && /Writing unit 1: Numbers/.test(steps[1][0]), steps);
  check('then the class preview with Add', /TEST 101/.test(await txt(m, '#mk-bo-result')) && /4 topics/.test(await txt(m, '#mk-bo-result')) && !!(await m.$('#mk-bo-result [data-add]')));
  await m.click('#mk-bo-result [data-add]'); await m.waitForTimeout(2000);
  check('adding it opens the class (no paywall: Max includes making classes)', !(await m.$('#paywall')) && /#\/my\d{4}\/dashboard/.test(m.url()), m.url());
  const saved = (await api(m, 'myclasses')).json.classes || [];
  check('and it is saved with the account', saved.some(c => c.code === 'TEST 101'), saved.map(c => c.code));
  await go(m, `#/${saved[0].id}/practice`, 1500);
  check('the class Bo wrote has a working quizzer', /Quizzer/.test(await txt(m, '#view')));
  await cm.close();

  // phones
  const [cp, ph] = await open(390, 844, 'mod.user@montana.edu');
  await ph.evaluate(() => App.setSetting('aiConsent', Date.now()));
  await go(ph, '#/tutor/calc', 2200);
  check('phone: Ask Bo does not scroll sideways', await hscroll(ph));
  const pos = await ph.evaluate(() => { const c = document.querySelector('.bo-compose').getBoundingClientRect(); const t = document.querySelector('#tabbar'); return { composer: Math.round(c.bottom), tabbar: t ? Math.round(t.getBoundingClientRect().top) : innerHeight }; });
  check('phone: the message box sits above the tab bar', pos.composer <= pos.tabbar + 1, pos);
  check('phone: no side panel; the i button opens What Bo knows as a sheet', (await ph.$eval('#bo-side', s => getComputedStyle(s).display)) === 'none');
  await ph.click('[data-bo="knows"]'); await ph.waitForTimeout(500);
  check('phone: the sheet has the class, the next exam and the notes', /The class/.test(await txt(ph, '#bo-knows')) && /Bo's notes about you/.test(await txt(ph, '#bo-knows')) && await hscroll(ph));
  await ph.keyboard.press('Escape'); await ph.waitForTimeout(300);
  await cp.close();

  // clean up
  const [cc, cl] = await open(1360, 900, 'mod.user@montana.edu');
  await api(cl, 'ai_forget', { what: 'all' }); for (const c of ((await api(cl, 'myclasses')).json.classes || [])) await api(cl, 'myclass_delete', { id: c.id });
  await cc.close();
  try { fs.unlinkSync(STATE); } catch (e) {}
  await T.finish();
})().catch(e => { console.error(e); try { require('fs').unlinkSync(require('path').join(__dirname, 'fixtures', 'rc-state.json')); } catch (x) {} process.exit(1); });
