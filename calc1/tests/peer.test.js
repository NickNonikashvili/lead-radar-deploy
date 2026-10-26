/* Peer review swaps (api/peer.php, assets/peer.js) and what the author sees (assets/drafts.js). Covered: off until the
   instructor turns them on; offering a version and waiting; pairing with a classmate offering the same project; one
   swap going at a time; what each reads (the other's draft, not Bo's feedback); comments must quote the draft; saving,
   sending (final) and being told; the author's review showing what came back, and their next request to Bo carrying
   it as peer review comments; never pairing two people again after a block; a report reaching the moderators (who
   see the draft, not a forum post, and can dismiss it); and the pages: the list, a swap with comments on selected
   words, the review's "From peer review", a phone. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec("PRAGMA foreign_keys=ON"); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu', ADMIN = 'admin.user@montana.edu';
const A_DRAFT = "My grandmother's farmhouse sat at the end of a gravel road outside Big Timber. Every August the storms rolled down from the Crazy Mountains and the whole house held its breath. I remember the smell of rain on hot dust before the first drop fell.\n\nThe storm was really scary and it was a big deal for our family that summer. We sat on the porch and counted the seconds between the lightning and the thunder. She told me the brook would rise by morning, and it always did.\n\nNow the house is sold and the road is paved, but I still drive past it when I go home.";
const B_DRAFT = "The Bozeman library has a corner by the window where the radiator ticks all winter. I go there when the dorm is too loud to think. The light comes in low and gold in the afternoon.\n\nPeople leave things behind in that corner: a pencil, a receipt, once a whole sandwich. I started keeping a list of what I found. The list says more about the town than any brochure I have read.\n\nWhen I graduate I will miss the radiator more than the dining hall, and I am not sure what that says about me.";
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const last = () => JSON.parse(fs.readFileSync(LAST, 'utf8'));
  const userText = req => req.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('\n')).join('\n');
  const WHO = `(SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}', '${ADMIN}'))`;
  const clean = () => { for (const q of [`DELETE FROM draft_reviews WHERE user_id IN ${WHO}`, "DELETE FROM class_ai WHERE course = 'writ'", `DELETE FROM peer_blocks WHERE user_id IN ${WHO}`, "DELETE FROM peer_queue WHERE course = 'writ'", `DELETE FROM credit_use WHERE user_id IN ${WHO}`, `DELETE FROM notifications WHERE user_id IN ${WHO} AND kind LIKE 'peer%'`, "DELETE FROM reports WHERE kind = 'peer'", "DELETE FROM rate WHERE key LIKE 'ai_draft%' OR key LIKE 'peer_%'"]) { try { sql(q); } catch (e) {} } };
  clean();
  const setup = new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ']; s.boFloatSeen = 1; s.aiConsent = Date.now(); s.asof = '2026-10-30'; s.lang = 'en'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  const open = async (email, w = 1360, h = 900) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };
  const [ca, a] = await open(ALICE); const [cb, b] = await open(BOB); const [cd, d] = await open(ADMIN);
  const va = (await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: A_DRAFT })).review;
  const vb = (await api(b, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: B_DRAFT })).review;
  const vd = (await api(d, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: B_DRAFT.replace('Bozeman', 'Belgrade') })).review;
  check('three first drafts of Project 1', va && vb && vd && va.project === 'p1');

  /* ---------- the routes ---------- */
  let r = await api(a, 'peer_status&class=writ');
  check('off until the instructor turns swaps on', r.ok && r.on === false && (await api(a, 'peer_join', { class: 'writ', review_id: va.id })).status === 403, r);
  await api(d, 'instruct_save', { class: 'writ', settings: { peer: true, peer_days: 3 } });
  r = await api(a, 'peer_status&class=writ'); check('on, with three days to write back', r.on === true && r.days === 3, r);
  check('a swap offers one of her own versions', (await api(a, 'peer_join', { class: 'writ', review_id: vb.id })).status === 404);
  r = await api(a, 'peer_join', { class: 'writ', review_id: va.id });
  check('nobody else is waiting: she waits', r.ok && r.waiting === true && (await api(a, 'peer_status&class=writ')).waiting.map(w => w.project + ':' + w.review_id).join() === 'p1:' + va.id, r);
  r = await api(b, 'peer_join', { class: 'writ', review_id: vb.id });
  check('Bob offers his: they are paired at once', r.ok && r.paired > 0, r); const sid = r.paired;
  check('neither is waiting any more, and Alice is told', (await api(a, 'peer_status&class=writ')).waiting.length === 0 && rows(`SELECT link FROM notifications WHERE kind LIKE 'peer%' AND user_id = (SELECT id FROM users WHERE email = ?)`, ALICE).some(n => n.link === `#/writ/peer/${sid}`));
  check('one swap at a time for a project', (await api(b, 'peer_join', { class: 'writ', review_id: vb.id })).status === 409);
  r = await api(a, `peer_get&class=writ&id=${sid}`);
  check('she reads his draft and only his draft: not Bo’s feedback on it', r.ok && r.draft.text === B_DRAFT && r.draft.version === 1 && /^Bob/.test(r.name) && !JSON.stringify(r).includes('feedback') && r.mine.sent === 0 && r.got === null, Object.keys(r));
  check('nobody else can open the swap', (await api(d, `peer_get&class=writ&id=${sid}`)).status === 404);
  r = await api(a, 'peer_save', { class: 'writ', id: sid, overall: '', comments: [{ quote: 'words that are not in his draft', note: 'Hm.' }] });
  check('a comment must quote his draft', r.status === 400 && /not in their draft/.test(r.error), r);
  r = await api(a, 'peer_save', { class: 'writ', id: sid, overall: '', comments: [], send: 1 });
  check('sending nothing is refused', r.status === 400, r);
  r = await api(a, 'peer_save', { class: 'writ', id: sid, overall: 'I could see that corner.', comments: [{ quote: 'the radiator  ticks all winter', note: 'I can hear this.' }, { quote: 'The list says more about the town', note: 'Show us one more thing on the list?' }, { quote: '', note: '' }] });
  check('saved for later (spaces in a quote do not matter; empty comments dropped), not sent', r.ok && r.mine.sent === 0 && r.mine.comments.length === 2 && (await api(b, `peer_get&class=writ&id=${sid}`)).got === null, r.mine);
  r = await api(a, 'peer_save', { class: 'writ', id: sid, overall: 'I could see that corner. The ending made me smile.', comments: [{ quote: 'the radiator ticks all winter', note: 'I can hear this.' }, { quote: 'The list says more about the town', note: 'Show us one more thing on the list?' }], send: 1 });
  check('sent: final', r.ok && r.mine.sent > 0 && (await api(a, 'peer_save', { class: 'writ', id: sid, overall: 'changed', send: 1 })).status === 409);
  r = await api(b, `peer_get&class=writ&id=${sid}`);
  check('Bob gets it, and is told, with a link to his review', r.got && r.got.comments.length === 2 && /ending made me smile/.test(r.got.overall) && rows(`SELECT link FROM notifications WHERE kind LIKE 'peer%' AND user_id = (SELECT id FROM users WHERE email = ?)`, BOB).some(n => n.link === `#/writ/drafts/${vb.id}`));
  r = await api(b, `ai_draft_get&class=writ&id=${vb.id}`);
  check('his review of that version shows what came back', r.review.peers.length === 1 && /^Alice/.test(r.review.peers[0].name) && r.review.peers[0].comments[0].quote === 'the radiator ticks all winter' && r.peer_on === true, r.review.peers);
  r = await api(b, 'peer_status&class=writ'); const st = r.swaps.find(x => x.id === sid);
  check('his list: the swap with Alice, hers came back, his not started', st && /^Alice/.test(st.name) && st.got.sent > 0 && st.gave.sent === 0 && st.gave.started === false && st.due - st.created === 3 * 86400, st);

  /* a block, then a report */
  r = await api(b, 'peer_block', { class: 'writ', id: sid });
  check('Bob ends the swap and never wants to be paired with her again', r.ok && (await api(a, `peer_get&class=writ&id=${sid}`)).draft === null && (await api(a, `peer_get&class=writ&id=${sid}`)).swap.closed > 0);
  check('once a swap has ended, what came back in it is no longer shown', (await api(b, `ai_draft_get&class=writ&id=${vb.id}`)).review.peers.length === 0);
  await api(a, 'peer_join', { class: 'writ', review_id: va.id }); r = await api(b, 'peer_join', { class: 'writ', review_id: vb.id });
  check('after a block, the two are never paired: both wait', r.ok && r.waiting === true && (await api(a, 'peer_status&class=writ')).waiting.length === 1, r);
  r = await api(d, 'peer_join', { class: 'writ', review_id: vd.id });
  check('a third classmate is paired with whoever waited first (Alice)', r.ok && r.paired > 0 && (await api(a, 'peer_status&class=writ')).swaps.some(x => x.id === r.paired && !x.closed)); const sid2 = r.paired;
  check('a report needs a reason', (await api(a, 'peer_report', { class: 'writ', id: sid2, reason: '' })).status === 400);
  r = await api(a, 'peer_report', { class: 'writ', id: sid2, reason: 'This is copied from a brochure.' });
  check('reported: the swap ends', r.ok && (await api(a, `peer_get&class=writ&id=${sid2}`)).swap.closed > 0);
  r = await api(d, 'forum_reports'); const rep = (r.reports || []).find(x => x.kind === 'peer');
  check('the moderators see the reported draft (not a forum post) and who wrote it', rep && /Belgrade library/.test(rep.snippet) && /admin\.user@montana\.edu/.test(rep.author) && rep.author_id > 0 && rep.post_id === 0, rep);
  r = await api(d, 'forum_mod', { action: 'resolve', report_id: rep.id });
  check('and can dismiss it', r.ok && !((await api(d, 'forum_reports')).reports || []).some(x => x.kind === 'peer'));
  r = await api(d, 'forum_mod', { action: 'remove', kind: 'peer', id: sid2 });
  check('a moderation action meant for posts never touches a post with the same number', r.status === 404, r);

  /* ---------- the pages ---------- */
  sql("DELETE FROM peer_blocks"); sql("DELETE FROM peer_queue WHERE course = 'writ'");
  r = await api(b, 'peer_join', { class: 'writ', review_id: vb.id }); const r2 = await api(a, 'peer_join', { class: 'writ', review_id: va.id }); const sid3 = r2.paired;
  check('Alice and Bob paired again for the pages', r.waiting === true && sid3 > 0, r2);
  await go(a, '#/writ/peer', 1600);
  const list = await a.evaluate(() => ({ swaps: [...document.querySelectorAll('.pr-swap')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), offer: !!document.querySelector('#pr-offer') }));
  check('the list: the new swap with Bob, due in 3 days, yours not started; Project 1 is not offered again', list.swaps.length >= 1 && /Project 1 with Bob/.test(list.swaps[0]) && /Yours: not started/.test(list.swaps[0]) && !list.offer, list);
  await a.click('.pr-swap a.btn.primary'); await a.waitForTimeout(1500);
  check('his draft on paper', /#\/writ\/peer\/\d+$/.test(a.url()) && /radiator ticks all winter/.test(await txt(a, '#pr-paper')) && (await a.$eval('[data-action="pr-add"]', b => b.disabled)));
  const pick = async words => { await a.evaluate(w => { const p = document.querySelector('#pr-paper'); const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { const i = n.nodeValue.indexOf(w); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } } }, words); await a.waitForTimeout(150); };
  await pick('People leave things behind in that corner');
  check('selecting words turns on Comment and shows them', !(await a.$eval('[data-action="pr-add"]', b => b.disabled)) && /People leave things behind/.test(await txt(a, '#pr-hint')));
  await a.click('[data-action="pr-add"]'); await a.keyboard.type('This is my favorite line.');
  check('a comment on those words, ready to write, and the passage marked', (await a.inputValue('[data-note="0"]')) === 'This is my favorite line.' && await a.evaluate(() => !CSS.highlights || (CSS.highlights.get('pr-quote') && [...CSS.highlights.get('pr-quote')][0].toString() === 'People leave things behind in that corner')));
  await a.fill('#pr-overall', 'A quiet, sure draft.');
  await a.reload(); await a.waitForTimeout(1500);
  check('what she wrote waits on the device after a reload', (await a.inputValue('[data-note="0"]')) === 'This is my favorite line.' && (await a.inputValue('#pr-overall')) === 'A quiet, sure draft.');
  await a.click('[data-action="pr-send"]'); await a.waitForTimeout(1500);
  r = await api(b, `peer_get&class=writ&id=${sid3}`);
  check('Send (after a confirm) sends it, and the page shows it as sent', r.got && r.got.overall === 'A quiet, sure draft.' && r.got.comments[0].quote === 'People leave things behind in that corner' && /You sent your peer review/.test(await txt(a, '.pr-sw')) && !(await a.$('#pr-overall')), r.got);
  check('the swap page fits and has no errors', await hscroll(a));
  await go(b, `#/writ/drafts/${vb.id}`, 1800);
  check('Bob’s review: From peer review, with Alice’s note and comment', /From peer review/.test(await txt(b, '.df-peer-got')) && /A quiet, sure draft\./.test(await txt(b, '.df-peer-got')) && /This is my favorite line\./.test(await txt(b, '.df-peer-got')));
  await b.click('[data-action="df-again"]'); await b.waitForTimeout(1500);
  check('Send a revised version carries it into the peer review comments for Bo', await b.evaluate(() => /Alice: A quiet, sure draft\./.test(document.querySelector('#df-peer').value) && /“People leave things behind in that corner”: This is my favorite line\./.test(document.querySelector('#df-peer').value) && document.querySelector('.df-peer').open));
  await b.fill('#df-text', B_DRAFT + ' I added this line.'); await b.click('#df-send');
  await b.waitForFunction(() => /#\/writ\/drafts\/\d+$/.test(location.hash) && document.querySelector('.df-paper'), null, { timeout: 15000 }).catch(() => {});
  check('and Bo is given it with the revised draft', /PEER REVIEW COMMENTS THEY GOT[^\n]*\nAlice: A quiet, sure draft\./.test(userText(last())));
  const [cp, ph] = await open(ALICE, 390, 844);
  for (const h of ['#/writ/peer', `#/writ/peer/${sid3}`]) { await go(ph, h, 1600); check(`fits a phone: ${h}`, await hscroll(ph)); }
  await cp.close();
  await ca.close(); await cb.close(); await cd.close();
  clean();
  await T.finish();
})();
