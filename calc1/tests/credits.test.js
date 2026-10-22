/* Credits (api/credits.php, assets/usage.js, the admin panel's Credits tab): everything with Bo uses credits, on any
   plan. Each month free accounts get 100, Pro 1,000 and Max 2,000; more are bought ahead, 1,000 for $10, through
   RevenueCat (a stand-in in tests/pyodide/router.php: rc-state.json's "credits" are the packs bought). Covered: what is
   left and the purchase link; a pack counted once, and taken back when refunded; answers paid by what they took; a call
   by the minute at its plan's rate (Max's stronger model costs more), ending when the credits run out and saying how to
   get more; nothing starting without credits (402); pictures (api/images.php: paid once, kept, the safety check);
   administrators giving credits (and the member told) and never paying; old call hours becoming credits once; the
   student file (api/students.php) and a long call's summary (ai_compact). The pages: #/usage (and #/calls, its old
   name), the Call Bo sheet (assets/call-launch.js) from the top bar and the start page, Ask Bo when out of credits,
   and the admin's Credits tab, on a phone too. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const STATE = path.join(__dirname, 'fixtures', 'rc-state.json');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const STUDENTS = path.join(__dirname, '..', 'api', 'data', 'students');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=test\r\nt=0 0\r\n';
const NOW = () => Math.floor(Date.now() / 1000);
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, log, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu';
  const quiet = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
  const WHO = "(SELECT id FROM users WHERE email IN ('alice.a@montana.edu', 'bob.bmu6j92pq@montana.edu'))";
  const clean = () => {
    for (const t of ['credit_use', 'credit_add', 'ai_live']) sql(`DELETE FROM ${t} WHERE user_id IN ${WHO}`);
    try { sql(`DELETE FROM call_credit WHERE user_id IN ${WHO}`); } catch (e) {}
    sql(`DELETE FROM ai_threads WHERE user_id IN ${WHO}`);
    for (const r of rows(`SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}')`)) { try { fs.unlinkSync(path.join(STUDENTS, r.id + '.json')); } catch (e) {} }
  };
  const paidRaw = uid => +rows('SELECT (SELECT COALESCE(SUM(mc), 0) FROM credit_add WHERE user_id = ?) - (SELECT COALESCE(SUM(paid_mc), 0) FROM credit_use WHERE user_id = ?) AS p', uid, uid)[0].p;
  // uses up the month's credits and the bought ones, as if spent
  const drain = uid => { const p = Math.max(0, paidRaw(uid)); sql("INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES (?, ?, 'other', ?, ?, ?, ?, 'test')", uid, NOW(), 5000000 + p, 5000000, p, 'drain' + Date.now()); };
  // a refund after the credits were used leaves the account owing them; back to nothing, for the checks after it
  const zero = uid => { const p = paidRaw(uid); if (p !== 0) sql("INSERT INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'gift', ?, ?, 'test zero', ?)", uid, -p, 'zero' + Date.now(), NOW()); };

  // the administrator, and the purchase link
  const [cd, d] = await mk(1360, 900); await cd.addInitScript(quiet); await go(d, '#/'); await login(d, 'admin.user@montana.edu'); await d.reload(); await d.waitForTimeout(800);
  await api(d, 'admin_config_save', { password: 'password123', values: { credits_link: 'https://pay.rev.cat/sbx_credits_link' } });
  // Bob: a free account. Alice: Max, later
  const [cb, b] = await mk(1360, 900); await cb.addInitScript(quiet); await go(b, '#/'); await login(b, BOB); await b.reload(); await b.waitForTimeout(600);
  const [ca, a] = await mk(1360, 900); await ca.addInitScript(quiet); await go(a, '#/'); await login(a, ALICE); await a.reload(); await a.waitForTimeout(600);
  const bobCust = (await api(b, 'create_status')).customer; const bobId = +bobCust.replace('mh_', '');
  const aliceCust = (await api(a, 'create_status')).customer; const aliceId = +aliceCust.replace('mh_', '');
  fs.writeFileSync(STATE, '{}'); await api(b, 'create_status&refresh=1'); await api(a, 'create_status&refresh=1');
  await api(b, 'credits_status'); clean();

  let S = await api(b, 'credits_status');
  check('a free account: 100 credits this month, nothing bought, 100 left', S.ok && S.plan === '' && S.allowance === 100 && S.paid === 0 && S.left === 100 && S.admin === false, { plan: S.plan, allowance: S.allowance, left: S.left });
  check('the purchase: 1,000 credits for $10, through his own RevenueCat link', S.pack === 1000 && S.price === '$10' && S.buy === `https://pay.rev.cat/sbx_credits_link/${bobCust}`, { pack: S.pack, price: S.price, buy: S.buy });
  check('what things cost: a message, a minute on a call (6), a picture (15)', (S.prices || []).some(p => p.k === 'chat' && p.c > 0) && (S.prices || []).some(p => p.k === 'call' && p.c === 6) && (S.prices || []).some(p => p.k === 'image' && p.c === 15), S.prices);
  check('the plans: free 100, Pro 1,000, Max 2,000', S.plans && S.plans.free === 100 && S.plans.pro === 1000 && S.plans.max === 2000, S.plans);
  // he buys a pack
  fs.writeFileSync(STATE, JSON.stringify({ [bobCust]: { credits: ['tx_c1'] } }));
  S = await api(b, 'credits_sync', {});
  check('after paying, the pack is found and adds 1,000 credits', S.added === 1 && S.paid === 1000 && S.left === 1100, { added: S.added, paid: S.paid, left: S.left });
  S = await api(b, 'credits_sync', {});
  check('and is counted once', S.added === 0 && S.paid === 1000, { added: S.added, paid: S.paid });
  let st = await api(b, 'ai_status');
  check('Bo\'s status tells every page what is left, and that he is not out', st.credits && st.credits.left === 1100 && st.credits.out === false && st.credits.call_rate === 6 && st.credits.plans && st.credits.plans.max === 2000, st.credits);

  // an answer is paid by what it took
  let r = await api(b, 'ai_tutor', { class: 'calc', q: 'What is a derivative, in one line?', snapshot: { name: 'Bob' } });
  const chat = rows("SELECT feature, mc, month_mc, paid_mc, detail FROM credit_use WHERE user_id = ? AND feature = 'chat'", bobId);
  check('an answer uses credits: one row, from the month\'s credits first', r.ok && chat.length === 1 && +chat[0].mc > 0 && +chat[0].month_mc === +chat[0].mc && +chat[0].paid_mc === 0, { ok: r.ok, chat });
  check('and the answer says what is left', r.credits && r.credits.left < 1100 && r.credits.left > 1090, r.credits);

  // a call, by the minute, at the light model's rate
  r = await api(b, 'ai_live_start', { class: 'calc', sdp: OFFER });
  check('a call starts on a free account, on the light model, with what his credits allow', r.ok && r.lid && r.left > 0, r);
  const live = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'live-last.json'), 'utf8'));
  check('(the light model)', /mini/.test(live.session.model || ''), live.session.model);
  const lid = r.lid; const back = s => sql('UPDATE ai_live SET last = ? WHERE id = ?', NOW() - s, lid);
  back(30); r = await api(b, 'ai_live_tick', { lid }); back(30); r = await api(b, 'ai_live_tick', { lid });
  const call = rows("SELECT mc, detail FROM credit_use WHERE user_id = ? AND feature = 'call'", bobId);
  check('a minute of calling is 6 credits, kept as one row for the call', call.length === 1 && Math.abs(+call[0].mc - 6000) <= 250 && /Calc|calc|Calculus/.test(call[0].detail) && /6 credits a minute/.test(call[0].detail), call);
  // out of credits while talking: the call ends and says how to get more
  drain(bobId);
  back(20); r = await api(b, 'ai_live_tick', { lid });
  check('when his credits run out on a call, it ends and says to get more', r.ok && r.end === true && r.credits === true && /all your credits/.test(r.why || ''), r);
  r = await api(b, 'ai_live_start', { class: 'calc', sdp: OFFER });
  check('a new call does not start (402, credits)', r.status === 402 && r.credits === true && /out of credits/.test(r.error || ''), r);
  r = await api(b, 'ai_tutor', { class: 'calc', q: 'One more?' });
  check('nor an answer', r.status === 402 && r.credits === true, { status: r.status });
  r = await api(b, 'ai_call_start', { class: 'calc' });
  check('nor a basic voice call', r.status === 402 && r.credits === true, { status: r.status });
  st = await api(b, 'ai_status');
  check('Bo\'s status says he is out', st.credits && st.credits.out === true, st.credits);
  // a refund takes the pack back
  fs.writeFileSync(STATE, JSON.stringify({ [bobCust]: { credits: [] } }));
  await api(b, 'credits_sync', {});
  const adds = rows("SELECT kind, mc FROM credit_add WHERE user_id = ? AND kind IN ('buy', 'refund') ORDER BY id", bobId);
  check('a refunded pack is taken back, once', adds.length === 2 && adds[1].kind === 'refund' && +adds[1].mc === -1000000, adds);
  await api(b, 'credits_sync', {});
  check('(and not twice)', rows("SELECT COUNT(*) AS n FROM credit_add WHERE user_id = ? AND kind = 'refund'", bobId)[0].n === 1);
  check('a pack refunded after it was used leaves him owing it (shown as none bought left)', paidRaw(bobId) < 0 && (await api(b, 'credits_status')).paid === 0, paidRaw(bobId)); zero(bobId);

  // Max: 2,000 a month and the stronger call model, at its rate
  fs.writeFileSync(STATE, JSON.stringify({ [aliceCust]: { expires: new Date(Date.now() + 30 * 864e5).toISOString(), plan: 'max' } }));
  await api(a, 'create_status&refresh=1');
  S = await api(a, 'credits_status');
  check('Max: 2,000 credits a month, and a call costs 17 a minute', S.plan === 'max' && S.allowance === 2000 && S.left === 2000 && S.call_rate === 17, { plan: S.plan, allowance: S.allowance, rate: S.call_rate });
  r = await api(a, 'ai_live_start', { class: 'calc', sdp: OFFER });
  const live2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'live-last.json'), 'utf8'));
  check('her call is on the stronger model', r.ok && !/mini/.test(live2.session.model || ''), live2.session.model);
  sql('UPDATE ai_live SET last = ? WHERE id = ?', NOW() - 30, r.lid); await api(a, 'ai_live_tick', { lid: r.lid }); await api(a, 'ai_live_tick', { lid: r.lid, end: 1 });
  const call2 = rows("SELECT mc FROM credit_use WHERE user_id = ? AND feature = 'call'", aliceId);
  check('half a minute on Max is about 8.5 credits', call2.length === 1 && Math.abs(+call2[0].mc - 8500) <= 300, call2);

  // pictures: paid once, kept, refused by the safety check
  const pic = { prompt: 'A right triangle with sides 3, 4 and 5, the right angle marked', style: 'diagram', shape: 'square', cid: 'calc' };
  const kept = path.join(__dirname, '..', 'api', 'data', 'ai-img', require('crypto').createHash('sha256').update(JSON.stringify(['gpt-image-2', 'medium', '1024x1024', 'diagram', pic.prompt])).digest('hex') + '.webp');
  try { fs.unlinkSync(kept); } catch (e) {}   // made by an earlier run
  r = await api(a, 'ai_image', pic);
  check('Bo makes a picture: a link to it on Mathub', r.ok && /^api\/index\.php\?r=ai_image_file&id=[a-f0-9]{64}$/.test(r.url || ''), r);
  const sent = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'image-last.json'), 'utf8'));
  check('the image model is asked for it, with the style and what Bo knows about the class', /right triangle/.test(sent.prompt) && /textbook figure/.test(sent.prompt) && sent.size === '1024x1024' && sent.model === 'gpt-image-2', { model: sent.model, size: sent.size });
  const img = rows("SELECT mc, detail FROM credit_use WHERE user_id = ? AND feature = 'image'", aliceId);
  check('a picture costs 15 credits', img.length === 1 && +img[0].mc === 15000 && /right triangle/.test(img[0].detail), img);
  const again = await api(a, 'ai_image', pic);
  check('the same picture again is kept, and free', again.ok && again.kept === true && again.url === r.url && rows("SELECT COUNT(*) AS n FROM credit_use WHERE user_id = ? AND feature = 'image'", aliceId)[0].n === 1, again);
  const file = await a.evaluate(async u => { const x = await fetch(u, { credentials: 'same-origin' }); return { status: x.status, type: x.headers.get('content-type'), size: (await x.arrayBuffer()).byteLength }; }, r.url);
  check('the picture is served to members, as WebP', file.status === 200 && file.type === 'image/webp' && file.size > 20, file);
  const [co, o] = await mk(800, 600); await go(o, '#/');
  check('and not to someone signed out', (await o.evaluate(async u => (await fetch(u)).status, r.url)) === 401);
  check('nor made for them', (await api(o, 'ai_image', pic)).status === 401);
  await co.close();
  r = await api(a, 'ai_image', { prompt: 'REFUSE-SAFETY something', style: 'photo', shape: 'wide' });
  check('a picture the safety check turns down says so, and costs nothing', r.status === 422 && /safety check/.test(r.error || '') && rows("SELECT COUNT(*) AS n FROM credit_use WHERE user_id = ? AND feature = 'image'", aliceId)[0].n === 1, r);
  r = await api(b, 'ai_image', { prompt: 'A unit circle', style: 'diagram' });
  check('out of credits, no picture (402)', r.status === 402 && r.credits === true, { status: r.status });

  // the student file, and a long call's summary
  const sf = path.join(STUDENTS, aliceId + '.json');
  r = await api(a, 'ai_tutor', { class: 'calc', q: 'How do I find the slope of a tangent line?', snapshot: { name: 'Alice', weak: [{ t: 'Limits' }] } });
  let F = await api(a, 'ai_student');
  check('her student file: kept on the server, with the class and the picture Bo made', r.ok && fs.existsSync(sf) && F.ok && F.file && F.file.classes && F.file.classes.calc && (F.file.pictures || []).some(p => /right triangle/.test(p.what)), F.file && Object.keys(F.file));
  const ai = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ai-last.json'), 'utf8'));
  check('and what Bo knows from it goes with her questions', JSON.stringify(ai).includes('THE STUDENT FILE'), JSON.stringify(ai.system || '').slice(0, 300));
  const items = Array.from({ length: 12 }, (_, i) => ({ r: i % 2 ? 'b' : 'u', t: i % 2 ? `Bo: step ${i} of the chain rule` : `Alice: what about ${i}?` }));
  r = await api(a, 'ai_compact', { class: 'calc', items, summary: '' });
  F = await api(a, 'ai_student');
  check('a long call\'s older turns become a summary, kept in her file', r.ok && r.summary && r.summary.length > 10 && (F.file.memory.calls || []).some(c => c.summary === r.summary), { summary: r.summary });
  check('and the summary is paid for too', rows("SELECT COUNT(*) AS n FROM credit_use WHERE user_id = ? AND feature = 'memory' AND detail LIKE '%summary of a long call%'", aliceId)[0].n >= 1, rows("SELECT feature, detail FROM credit_use WHERE user_id = ?", aliceId));
  // a long chat: the turns behind the last ten are folded into a summary after the answer
  const old = Array.from({ length: 30 }, (_, i) => ({ r: i % 2 ? 'b' : 'u', t: i % 2 ? `Answer ${i}` : `Question ${i} about limits`, at: NOW() - 3600 + i }));
  sql('UPDATE ai_threads SET turns = ? WHERE user_id = ? AND cid = ?', JSON.stringify(old), aliceId, 'calc');
  await api(a, 'ai_tutor', { class: 'calc', q: 'And the next one?' }); await a.waitForTimeout(1500);
  F = await api(a, 'ai_student');
  check('a long chat is folded into a summary after the answer, so Bo stays sharp', F.file.memory.chat && F.file.memory.chat.calc && F.file.memory.chat.calc.summary && F.file.memory.chat.calc.upto > 0, F.file.memory.chat);
  r = await api(a, 'ai_student', { what: 'memory' });
  check('she can clear what Bo remembers', r.ok && !(r.file.memory.chat || {}).calc && !(r.file.memory.calls || []).length);
  const exp = await api(a, 'data_export');
  check('her student file and credits are in Download my data', exp.what_bo_knows && exp.tables && exp.tables.credit_use && exp.tables.credit_use.length >= 3, exp.tables && Object.keys(exp.tables));

  // administrators: giving credits, never paying
  check('a student cannot open the admin credits routes', (await api(b, 'admin_credits')).status === 403 && (await api(b, 'admin_credits_grant', { email: ALICE, credits: 500 })).status === 403);
  r = await api(d, 'admin_credits_grant', { email: BOB, credits: 500, note: 'testing credits', tell: true });
  check('an administrator gives him 500 credits', r.ok && r.paid === 500, r);
  check('and he is told in his inbox, with the way to Usage', ((await api(b, 'notif_list')).notifications || []).some(n => n.kind === 'credits' && /500 credits/.test(n.snippet) && n.link === '#/usage'));
  r = await api(d, 'admin_credits_grant', { email: BOB, credits: -5000 });
  check('taking back more than he has is refused', r.ok === false && /do not have that many/.test(r.error), r);
  r = await api(d, 'admin_credits');
  const me = (r.people || []).find(p => p.email === ALICE), him = (r.people || []).find(p => p.email === BOB);
  check('the admin\'s numbers: this month by feature, packs sold and refunded, and each member', r.ok && r.totals.credits > 0 && r.totals.packs_sold >= 1 && r.totals.refunds >= 1 && (r.by || []).some(x => x.k === 'call') && me && me.plan === 'max' && him && him.paid === 500, { totals: r.totals, me, him });
  check('the settings it shows: the plans, the pack, the rates and the link', r.settings.free === 100 && r.settings.max === 2000 && r.settings.pack === 1000 && r.settings.call_strong === 17 && r.settings.image === 15 && r.settings.link === true, r.settings);
  const ADM = "(SELECT id FROM users WHERE email = 'admin.user@montana.edu')"; sql(`DELETE FROM credit_use WHERE user_id = ${ADM}`);
  await api(d, 'ai_tutor', { class: 'calc', q: 'Admin question' });
  st = await api(d, 'ai_status'); const au = rows(`SELECT mc, month_mc, paid_mc FROM credit_use WHERE user_id = ${ADM}`);
  check('administrators are never charged: what they used is written down, taken from nothing', st.admin === true && st.credits.out === false && au.length >= 1 && au.every(x => +x.mc > 0 && +x.month_mc === 0 && +x.paid_mc === 0), au);

  // call hours bought before credits become credits, once
  try { sql("INSERT INTO call_credit (user_id, kind, secs, ref, created) VALUES (?, 'buy', 5400, 'test-old-hours', ?)", bobId, NOW()); } catch (e) {}
  if (rows("SELECT COUNT(*) AS n FROM call_credit WHERE user_id = ?", bobId)[0]) {
    S = await api(b, 'credits_status'); const S2 = await api(b, 'credits_status');
    check('call time bought before credits became credits, once: an hour and a half is 1,500', S.paid === 2000 && S2.paid === 2000 && (S.adds || []).some(x => /Call time bought before/.test(x.note) && x.credits === 1500), { paid: S.paid, adds: S.adds });
  }

  // ---- the pages ----
  await go(b, '#/usage', 1600);
  check('#/usage: credits left as one big number, the month\'s and the bought ones', /credits left/.test(await txt(b, '.us-big')) && /monthly credits/.test(await txt(b, '.us-meters')) && /Credits you bought/.test(await txt(b, '.us-meters')), await txt(b, '.us-left'));
  const buy = await b.$eval('[data-action="us-buy"]', x => ({ href: x.getAttribute('href'), target: x.getAttribute('target'), text: x.textContent })).catch(() => null);
  check('Buy 1,000 credits · $10 opens his checkout in a new tab', buy && buy.href === `https://pay.rev.cat/sbx_credits_link/${bobCust}` && buy.target === '_blank' && /1,000 credits · \$10/.test(buy.text), buy);
  check('what he used them on this month, the last 30 days, and what things cost', (await b.$$('.us-by li')).length >= 2 && !!(await b.$('svg.us-days')) && /A minute|call/i.test(await txt(b, '.us-prices')), await txt(b, '.us-by'));
  check('everything he used, and what was bought, refunded and given', /Calc|Calculus|call/i.test(await txt(b, '#us-rec-h + *, .us-list')) && /Refunded/.test(await txt(b, '#us')) && /From Mathub/.test(await txt(b, '#us')));
  const pages = cb.pages().length;
  await b.click('[data-action="us-buy"]'); await b.waitForTimeout(500); for (const pg of cb.pages().slice(pages)) await pg.close();
  check('after Buy, the page waits for the payment, with I paid', await b.isVisible('#us-wait') && /I paid/.test(await txt(b, '#us-wait')));
  fs.writeFileSync(STATE, JSON.stringify({ [bobCust]: { credits: ['tx_c2'] } }));
  const before = await txt(b, '#us-left');
  await b.click('[data-action="us-sync"]'); await b.waitForTimeout(1500);
  check('I paid finds the new pack, and the credits go up by 1,000', parseFloat((await txt(b, '#us-left')).replace(/,/g, '')) - parseFloat(before.replace(/,/g, '')) === 1000, { before, after: await txt(b, '#us-left') });
  await go(b, '#/calls', 1200);
  check('#/calls (the old page) shows Usage', !!(await b.$('#us .us-big')));
  await b.click('[data-action="acct-toggle"]').catch(() => {}); await b.waitForTimeout(300);
  check('the account menu has Usage & credits', !!(await b.$('.acct-dd-item[href="#/usage"]')));
  await b.keyboard.press('Escape');

  // the Call Bo sheet: the phone in the top bar, the class to talk about, the credits, start
  await go(a, '#/', 1800);
  check('the top bar has Call Bo when signed in', await a.isVisible('#call-top'));
  await a.click('#call-top'); await a.waitForSelector('.cb.open .cb-class', { timeout: 6000 }).catch(() => {}); await a.waitForTimeout(400);
  const sheet = await a.evaluate(() => ({ classes: [...document.querySelectorAll('.cb-class')].map(x => x.textContent.trim()), on: (document.querySelector('.cb-class.on b') || {}).textContent, credits: (document.querySelector('.cb-credits') || {}).textContent, go: !!document.querySelector('[data-cb-go]'), role: (document.querySelector('.cb') || {}).getAttribute && document.querySelector('.cb').getAttribute('role') }));
  check('Call Bo opens a sheet: her classes and Anything else to pick from, one picked', sheet.classes.length >= 2 && sheet.classes.some(x => /Anything else/.test(x)) && !!sheet.on && sheet.role === 'dialog', sheet);
  check('with her credits and about how many minutes they make at 17 a minute', /credits/.test(sheet.credits || '') && /about \d+ minutes at 17 a minute/.test(sheet.credits || ''), sheet.credits);
  await a.click('.cb-class.cb-any'); await a.waitForTimeout(150);
  check('picking a class marks it (a radio group)', (await a.getAttribute('.cb-class.cb-any', 'aria-checked')) === 'true' && (await a.$$('.cb-class[aria-checked="true"]')).length === 1);
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  check('Escape closes it', !(await a.$('.cb')));
  check('the start page\'s Bo card shows her credits, linking to Usage', !!(await a.$('#bo-hub a.bh-plan[href="#/usage"]')));
  const callAct = await a.$('#bo-hub [data-bh="call"]');
  if (callAct) { await callAct.click(); await a.waitForTimeout(900); check('its Call Bo opens the same sheet', !!(await a.$('.cb .cb-classes'))); await a.keyboard.press('Escape'); }
  await go(a, '#/calc/dashboard', 1500);
  const dash = await a.$('.page-actions [data-action="call-bo"][data-cid="calc"]');
  check('each class page has Call Bo about that class', !!dash);
  if (dash) { await dash.click(); await a.waitForTimeout(1200); check('which opens the sheet with that class picked', /Calc/i.test(await txt(a, '.cb-class.on'))); await a.keyboard.press('Escape'); }
  // out of credits: Ask Bo and the sheet say how to get more
  drain(bobId);
  await go(b, '#/tutor/calc', 1800);
  check('Ask Bo out of credits: says so, with Get credits', /out of credits/.test(await txt(b, '.bo-gate')) && !!(await b.$('.bo-gate a[href="#/usage"]')), await txt(b, '.bo-gate'));
  await go(b, '#/', 1200); await b.click('#call-top'); await b.waitForTimeout(1500);
  check('the Call Bo sheet out of credits: Get credits instead of Start', /not enough for a call/.test(await txt(b, '.cb-credits')) && !!(await b.$('.cb-acts a[href="#/usage"]')) && !(await b.$('[data-cb-go]')));
  await b.keyboard.press('Escape');
  // the admin's tab
  await go(d, '#/admin/credits', 1800);
  check('the admin panel has a Credits tab: this month, what things cost, giving credits, members and purchases', /Used this month/.test(await txt(d, '#adm-body')) && /What things cost/.test(await txt(d, '#adm-body')) && !!(await d.$('#cl-give')) && /alice/.test(await txt(d, '#adm-body')) && /Bought|Refunded|Given/.test(await txt(d, '#adm-body .cl-list')), (await txt(d, '#adm-body')).slice(0, 300));
  await d.click(`[data-action="cl-pick"][data-email="${ALICE}"]`); await d.fill('#cl-g-n', '250'); await d.fill('#cl-g-note', 'from the admin tab'); await d.click('#cl-give button[type="submit"]'); await d.waitForTimeout(1200);
  check('Give credits from the tab adds them', rows("SELECT COUNT(*) AS n FROM credit_add WHERE user_id = ? AND note = 'from the admin tab' AND mc = 250000", aliceId)[0].n === 1);
  await go(d, '#/admin/calls', 1200);
  check('(the old Calls tab link opens Credits)', /Used this month/.test(await txt(d, '#adm-body')));
  // phones
  const [cm, m] = await mk(390, 844); await cm.addInitScript(quiet); await go(m, '#/'); await login(m, ALICE); await m.reload(); await m.waitForTimeout(600); await go(m, '#/usage', 1600);
  check('no sideways scroll on #/usage at 390px', await hscroll(m));
  await go(m, '#/', 1500);
  check('the top bar\'s Call Bo is a round phone button on a phone', await m.isVisible('#call-top') && (await m.evaluate(() => document.getElementById('call-top').getBoundingClientRect().width)) <= 44);
  await m.click('#call-top'); await m.waitForTimeout(1200);
  const box = await m.evaluate(() => { const s = document.querySelector('.cb-sheet'); const r = s.getBoundingClientRect(); return { b: Math.round(r.bottom), h: innerHeight, w: Math.round(r.width) }; });
  check('and the sheet comes up from the bottom, full width', Math.abs(box.b - box.h) <= 2 && box.w >= 388, box);
  check('no sideways scroll with the sheet open', await hscroll(m));
  await cm.close();

  // clean up
  await api(d, 'admin_config_save', { password: 'password123', clear: ['credits_link'] });
  clean(); fs.writeFileSync(STATE, '{}'); try { sql("DELETE FROM call_credit WHERE ref = 'test-old-hours'"); } catch (e) {} try { fs.unlinkSync(kept); } catch (e) {}
  log('(credits checked)');
  await T.finish();
})().catch(e => { console.error(e); try { require('fs').writeFileSync(require('path').join(__dirname, 'fixtures', 'rc-state.json'), '{}'); } catch (x) {} process.exit(1); });
