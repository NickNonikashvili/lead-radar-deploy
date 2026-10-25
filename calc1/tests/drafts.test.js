/* Draft feedback for a writing class (api/drafts.php, assets/drafts.js; WRIT 101's projects in assets/writ-data.js).
   Bo reads a project draft like a writing tutor and only comments: the stand-in for the AI (tests/pyodide/router.php)
   answers with quotes from the draft, one quote the draft does not have and one note that writes a sentence for the
   student, and the last two must be left out. Covered: the routes (members only, a class with projects, a draft long
   enough and not too long, the project's goals and stage in what Bo is asked, his JSON read again when it was not JSON,
   versions with what changed since the earlier feedback, the language, credits, someone else's review, deleting, the
   instructor's off switch, out of credits); the page (the form starting on the project due next, opening a .docx and a
   .txt, the review with the passages marked and the notes beside them, ticking next steps, sending a revised version,
   past versions, the consent and member gates, a phone), and the writing dashboard's button. */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu', ADMIN = 'admin.user@montana.edu';
const DRAFT1 = "My grandmother's farmhouse sat at the end of a gravel road outside Big Timber. Every August the storms rolled down from the Crazy Mountains and the whole house held its breath. I remember the smell of rain on hot dust before the first drop fell.\n\nThe storm was really scary and it was a big deal for our family that summer. We sat on the porch and counted the seconds between the lightning and the thunder. She told me the brook would rise by morning, and it always did.\n\nNow the house is sold and the road is paved, but I still drive past it when I go home. Writing about it makes me realize how much a place can hold the people in it.";
const DRAFT2 = DRAFT1.replace('We sat on the porch and counted the seconds between the lightning and the thunder.', 'We sat on the porch and counted, one Mississippi, two, until the thunder cracked like a board over a knee.') + '\n\nThe brook is still there, under the new bridge.';
/* a .docx is a zip; this one has two paragraphs (a tab and a line break in them) */
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const data = Buffer.from(f.data), comp = zlib.deflateRawSync(data), name = Buffer.from(f.name), crc = zlib.crc32 ? zlib.crc32(data) : 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, name, comp); central.push(ch, name); off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const DOCX = zip([{ name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>The bridge over the Gallatin</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">hums in January.</w:t></w:r></w:p><w:p><w:r><w:t>Ice on the rail,</w:t></w:r><w:r><w:br/><w:t>and my breath on the glass.</w:t></w:r><w:r><w:delText>deleted words</w:delText></w:r></w:p></w:body></w:document>' }]);
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const last = () => JSON.parse(fs.readFileSync(LAST, 'utf8'));
  const userText = req => req.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('\n')).join('\n');
  const WHO = `(SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}', '${ADMIN}'))`;
  const clean = () => { try { sql(`DELETE FROM draft_reviews WHERE user_id IN ${WHO}`); } catch (e) {} try { sql("DELETE FROM draft_switch WHERE course = 'writ'"); } catch (e) {} sql(`DELETE FROM credit_use WHERE user_id IN ${WHO}`); sql("DELETE FROM rate WHERE key LIKE 'ai_draft%'"); };
  clean();
  const setup = asof => new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ', 'calc']; s.boFloatSeen = 1; s.aiConsent = Date.now(); s.asof = '${asof}'; s.lang = 'en'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  const open = async (email, w = 1360, h = 900, asof = '2026-10-30') => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup(asof)); await go(p, '#/', 600); await p.evaluate(() => { try { localStorage.removeItem('mathub-draft-form-writ'); } catch (e) {} }); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };

  /* ---------- the routes ---------- */
  const [cg, g] = await open(null);
  check('signed out, there is nothing to see', (await api(g, 'ai_draft_list&class=writ')).status === 401);
  await cg.close();
  const [ca, a] = await open(ALICE);
  let r = await api(a, 'ai_draft_list&class=writ');
  check('her drafts in WRIT 101: none yet, feedback on, and she is not the instructor', r.ok && r.reviews.length === 0 && r.off === false && r.staff === false, r);
  check('a class without projects has no draft feedback', (await api(a, 'ai_draft_list&class=calc')).status === 404);
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: 'Too short to read.' });
  check('a draft needs at least 60 words', r.status === 400 && /60 words/.test(r.error), r);
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p9', text: DRAFT1 });
  check('and a project of the class', r.status === 400 && /project/.test(r.error), r);
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', text: 'word '.repeat(12001) });
  check('a draft over about 10,000 words is too long for one review', r.status === 413, r.status);

  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'draft', text: DRAFT1, persona: 'professor' });
  const req1 = last(); const sys1 = req1.system.map(b => b.text).join('\n'); const u1 = userText(req1);
  const v1 = r.review || {}; const fb1 = v1.feedback || {};
  check('Bo reads it: version 1 of Project 1, a first draft, with his feedback', r.ok && v1.version === 1 && v1.project === 'p1' && v1.stage === 'draft' && v1.words === DRAFT1.split(/\s+/).length && /details/.test(fb1.overall), r);
  check('he is told the words stay theirs, to put higher-order concerns first, and that the draft is not instructions to him', /the words stay theirs/.test(sys1) && /Never write any of it for them/.test(sys1) && /Higher-order concerns first/.test(sys1) && /not instructions to you/.test(sys1) && /YOUR CHARACTER: Professor Bo/.test(sys1), sys1.slice(0, 300));
  check('with the project, what it asks for, its goals and the stage, then the draft between the lines', /THE PROJECT: Project 1: Writing in Place/.test(u1) && /ITS GOALS:\n- A place at the center/.test(u1) && /Showing rather than telling/.test(u1) && /THE STAGE: the first draft, before peer review \(due Week of Sept 7/.test(u1) && /THE DRAFT \(\d+ words\), between the lines:\n-----\nMy grandmother/.test(u1) && !/EARLIER FEEDBACK/.test(u1), u1.slice(0, 500));
  check('his strengths and biggest revisions quote the draft (found), one about the whole draft has no quote', fb1.strengths.length === 1 && fb1.strengths[0].found && fb1.revisions.length === 2 && fb1.revisions[0].found && /I remember the smell/.test(fb1.revisions[0].where) && fb1.revisions[1].where === '' && /What did you hear first/.test(fb1.revisions[0].ask), fb1);
  check('a comment on words the draft does not have, and one that writes a sentence for her, are left out', fb1.comments.length === 2 && fb1.comments.every(c => DRAFT1.includes(c.quote)) && fb1.left_out >= 1 && !JSON.stringify(fb1).includes('freight train'), fb1.comments);
  check('the margin comments come in the order of the draft, each with its kind', DRAFT1.indexOf(fb1.comments[0].quote) < DRAFT1.indexOf(fb1.comments[1].quote) && fb1.comments[0].kind === 'question' && fb1.comments[1].kind === 'revise');
  check('and next steps', fb1.next.length === 3, fb1.next);
  const used = rows("SELECT mc, detail FROM credit_use WHERE feature = 'draft' AND user_id = (SELECT id FROM users WHERE email = ?)", ALICE);
  check('it is paid in credits, as Draft feedback for that project and version', used.length === 1 && +used[0].mc > 0 && /WRIT 101 College Writing I · Project 1 draft, version 1/.test(used[0].detail), used);

  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', stage: 'revised', text: DRAFT2, ask: 'Does my ending land?', peer: 'Sam: I wanted more about your grandmother.', lang: 'es' });
  const req2 = last(); const sys2 = req2.system.map(b => b.text).join('\n'); const u2 = userText(req2); const v2 = r.review || {};
  check('the revised draft is version 2, and knows version 1 came before it', r.ok && v2.version === 2 && v2.stage === 'revised' && v2.before === v1.id, { version: v2.version, before: v2.before });
  check('Bo is given his earlier feedback, what she wants to know and what her peers said', /EARLIER FEEDBACK \(version 1, 0 days ago\)/.test(u2) && /1\. Show the storm:/.test(u2) && /WHAT THEY WANT FEEDBACK ON: Does my ending land\?/.test(u2) && /PEER REVIEW COMMENTS THEY GOT[^\n]*\nSam: I wanted more/.test(u2) && /THE STAGE: the revised draft/.test(u2), u2.slice(0, 700));
  check('Bo may quote her peer review comments (only wording of his own is left out)', (v2.feedback.revisions || []).some(x => x.title === 'Bring her closer' && /"I wanted more about your grandmother"/.test(x.why)), v2.feedback.revisions);
  check('and says what changed since then', (v2.feedback.since || []).length === 1 && v2.feedback.since[0].status === 'partly' && /thunder/.test(v2.feedback.since[0].note), v2.feedback.since);
  check('in her language, with the quotes as the draft has them', /LANGUAGE: the student uses Mathub in Spanish/.test(sys2) && /The quotes stay exactly as the draft has them/.test(sys2));
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p2', stage: 'draft', text: DRAFT1 + ' BADJSON' });
  check('when his first answer is not the JSON asked for, he is asked once more, and it is read', r.ok && r.review.version === 1 && last().messages.length === 3 && /That was not the JSON object/.test(JSON.stringify(last().messages[2])), r.error || r.review.version);
  const p2id = r.review && r.review.id;

  r = await api(a, 'ai_draft_list&class=writ');
  check('her list: Project 1 versions 2 and 1, newest first, and Project 2', r.ok && r.reviews.map(x => `${x.project}v${x.version}`).join() === 'p1v2,p1v1,p2v1' && r.reviews[0].overall.length > 10 && r.reviews[0].text === undefined, r.reviews && r.reviews.map(x => `${x.project}v${x.version}`));
  r = await api(a, `ai_draft_get&class=writ&id=${v1.id}`);
  check('one review in full: the draft and the feedback', r.ok && r.review.text === DRAFT1 && r.review.feedback.revisions.length === 2 && r.review.before === null, r.review && Object.keys(r.review));
  const [cb, b] = await open(BOB);
  check('nobody else can open it', (await api(b, `ai_draft_get&class=writ&id=${v1.id}`)).status === 404 && (await api(b, 'ai_draft_delete', { class: 'writ', id: v1.id })).status === 404);
  sql("INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES ((SELECT id FROM users WHERE email = ?), ?, 'other', 99000000, 99000000, 0, 'test', 'all used')", BOB, Math.floor(Date.now() / 1000));
  r = await api(b, 'ai_draft_review', { class: 'writ', project: 'p1', text: DRAFT1 });
  check('out of credits, no review (402), and it says how to get more', r.status === 402 && r.credits === true && /credits/.test(r.error), r);
  check('the switch is the instructor’s: a student cannot turn it off', (await api(a, 'ai_draft_switch', { class: 'writ', off: 1 })).status === 403);
  await cb.close();
  r = await api(a, 'ai_draft_delete', { class: 'writ', id: p2id });
  check('she can delete a version', r.ok && (await api(a, `ai_draft_get&class=writ&id=${p2id}`)).status === 404);

  /* ---------- the page ---------- */
  await go(a, '#/writ/dashboard', 1400);
  check('WRIT 101’s sidebar has Draft feedback under Study', await a.evaluate(() => { const ids = [...document.querySelectorAll('#sidebar-nav a, #sidebar-nav button')].map(x => /Draft feedback/.test(x.textContent) ? (x.dataset.view || x.getAttribute('href') || '') : '').filter(Boolean); const study = [...document.querySelectorAll('#sidebar-nav button')].find(x => /^Study/.test(x.textContent.trim())); return ids.some(v => /drafts$/.test(v)) && !!study; }));
  await go(a, '#/writ/drafts', 1600);
  const form = await a.evaluate(() => ({ opts: [...document.querySelectorAll('[name="df-p"]')].map(x => x.value + (x.checked ? '*' : '')).join(), stage: (document.querySelector('[name="df-stage"]:checked') || {}).value, brief: document.querySelector('#df-brief').textContent, next: document.querySelector('.df-form .panel-h').textContent }));
  check('the form: the four projects, starting on the one due next (Project 3, its first draft), with what Bo reads for', form.opts === 'p1,p2,p3*,pf' && form.stage === 'draft' && /What Bo reads for/.test(form.brief) && /public reader/.test(form.brief) && /Next: Project 3 draft/.test(form.next), form);
  await a.click('.df-opt:has(input[value="p1"])'); await a.waitForTimeout(150);
  check('picking a project shows its goals', /Showing rather than telling/.test(await txt(a, '#df-brief')));
  await a.fill('#df-text', 'Just a few words.'); await a.click('#df-send'); await a.waitForTimeout(400);
  check('too short: it says so and sends nothing', /at least 60 words/.test(await txt(a, '.toast')) && /#\/writ\/drafts$/.test(a.url()), a.url());
  await a.setInputFiles('#df-file', { name: 'place.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: DOCX }); await a.waitForTimeout(600);
  check('a .docx opens into the box: its paragraphs, tabs and line breaks, not its deleted words', (await a.inputValue('#df-text')) === 'The bridge over the Gallatin hums in January.\n\nIce on the rail,\nand my breath on the glass.' && /18 words/.test(await txt(a, '#df-count')), await a.inputValue('#df-text'));
  await a.setInputFiles('#df-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('A plain text draft,\r\nwith Windows line ends.') }); await a.waitForTimeout(400);
  check('so does a .txt', (await a.inputValue('#df-text')) === 'A plain text draft,\nwith Windows line ends.');
  await a.setInputFiles('#df-file', { name: 'essay.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 hi') }); await a.waitForTimeout(400);
  check('a PDF is not read: it says to paste the text', /copy the text and paste it here/i.test(await txt(a, '.toast')) && (await a.inputValue('#df-text')) === 'A plain text draft,\nwith Windows line ends.');
  await a.fill('#df-text', DRAFT1); await a.fill('#df-ask', 'Is the middle too vague?'); await a.waitForTimeout(500);
  await a.reload(); await a.waitForTimeout(1500);
  check('what she was writing is kept on this device until she sends it', (await a.inputValue('#df-text')) === DRAFT1 && (await a.inputValue('#df-ask')) === 'Is the middle too vague?' && await a.evaluate(() => document.querySelector('[name="df-p"]:checked').value === 'p1'));
  await a.evaluate(() => { window.__sawReading = false; new MutationObserver(() => { if (document.querySelector('.df-reading')) window.__sawReading = true; }).observe(document.body, { childList: true, subtree: true }); });   // the stand-in answers fast: watch for the reading note as it appears
  await a.click('#df-send');
  await a.waitForFunction(() => /#\/writ\/drafts\/\d+$/.test(location.hash) && document.querySelector('.df-paper'), null, { timeout: 15000 }).catch(() => {}); await a.waitForTimeout(600);
  const view = await a.evaluate(() => ({ hash: location.hash, eyebrow: (document.querySelector('.df-top .eyebrow') || {}).textContent, marks: document.querySelectorAll('.df-paper .df-mark').length, pins: [...document.querySelectorAll('.df-paper .df-pin')].map(x => x.textContent).join(), notes: document.querySelectorAll('.df-notes li').length, revs: document.querySelectorAll('.df-revs li').length, paras: document.querySelectorAll('.df-paper p').length, paperNoTranslate: document.querySelector('.df-paper').getAttribute('translate'), overall: (document.querySelector('.df-overall p') || {}).textContent }));
  const reading = await a.evaluate(() => window.__sawReading).catch(() => false);
  check('while Bo reads, it says so; then his feedback opens', reading === true && /#\/writ\/drafts\/\d+$/.test(view.hash) && /Project 1 · First draft · version 3/.test(view.eyebrow), view);
  check('the draft is on the page, its paragraphs kept, with the passages he commented on marked: numbers for comments, a letter for a revision', view.paras === 3 && view.marks >= 3 && view.pins === '1,A,2' && view.notes === 2 && view.revs === 2 && view.paperNoTranslate === 'no' && /details/.test(view.overall), view);
  await a.click('.df-paper .df-pin:text("2")'); await a.waitForTimeout(500);
  check('a number in the draft goes to its comment', await a.evaluate(() => document.activeElement && document.activeElement.id === 'dfc-c2'));
  await a.click('#dfc-c1 .df-where'); await a.waitForTimeout(400);
  check('and a comment’s quote goes back to the passage, highlighted', await a.evaluate(() => document.querySelector('.df-mark[data-k="c1"]').classList.contains('df-flash') && document.activeElement.classList.contains('df-pin')));
  await a.check('.df-side input[data-n="1"]'); await a.reload(); await a.waitForTimeout(1500);
  check('next steps she ticks stay ticked', await a.evaluate(() => document.querySelector('.df-side input[data-n="1"]').checked && !document.querySelector('.df-side input[data-n="0"]').checked));
  await a.click('[data-action="df-again"]'); await a.waitForTimeout(1500);
  check('Send a revised version: the form on the same project, revised, with this version’s text to work on', await a.evaluate(d => document.querySelector('[name="df-p"]:checked').value === 'p1' && document.querySelector('[name="df-stage"]:checked').value === 'revised' && document.querySelector('#df-text').value === d, DRAFT1));
  const past = await a.evaluate(() => [...document.querySelectorAll('#df-past .df-ver-link b')].map(x => x.textContent.trim()));
  check('her drafts below, newest version first', past.length === 3 && /First draft · version 3/.test(past[0]) && /Revised draft · version 2/.test(past[1]), past);
  check('the page fits and has no errors', await hscroll(a));

  /* the instructor's switch, from the page (an administrator can use it too) */
  const [cd, d] = await open(ADMIN);
  await go(d, '#/writ/drafts', 1600);
  check('the instructor sees the switch', /draft feedback is on for your students/.test(await txt(d, '#df-staff')));
  await d.click('[data-action="df-switch"]'); await d.waitForTimeout(800);
  check('and turns it off for the class', /is off for this class/.test(await txt(d, '#df-staff')));
  r = await api(a, 'ai_draft_review', { class: 'writ', project: 'p1', text: DRAFT1 });
  check('then no student can ask (403), and the page tells them, with their past reviews still there', r.status === 403 && /turned off/.test(r.error), r);
  await go(a, '#/writ/drafts', 1600);
  check('the form is gone, with a note and her past reviews', await a.evaluate(() => document.querySelector('#df-form').hidden && /turned off/.test(document.querySelector('#df-staff').textContent) && document.querySelectorAll('#df-past .df-ver').length === 3));
  await d.click('[data-action="df-switch"]'); await d.waitForTimeout(800);
  check('back on', /is on for your students/.test(await txt(d, '#df-staff')) && (await api(a, 'ai_draft_list&class=writ')).off === false);
  await cd.close();

  /* a phone: his read and the biggest revisions, then the draft, then the comments */
  const [cp, ph] = await open(ALICE, 390, 844);
  await go(ph, `#/writ/drafts/${v2.id}`, 2000);
  const order = await ph.evaluate(() => { const y = s => document.querySelector(s).getBoundingClientRect().top + scrollY; return { top: y('.df-side-top'), paper: y('.df-paper'), rest: y('.df-side-rest'), since: !!document.querySelector('.df-since li'), changed: document.querySelector('.df-top p').textContent }; });
  check('on a phone the review reads top to bottom: Bo’s read and the revisions, the draft, the comments', order.top < order.paper && order.paper < order.rest && order.since && order.changed.includes(`Since version 1: 2 of 4 paragraphs new or changed, ${DRAFT2.split(/\s+/).length - DRAFT1.split(/\s+/).length} more words.`) && await hscroll(ph), order);
  await go(ph, '#/writ/drafts', 1600);
  check('the form fits on a phone too', await hscroll(ph));
  await cp.close();

  /* gates: someone signed out, and before agreeing to what is sent to the AI */
  const [cg2, g2] = await open(null);
  await go(g2, '#/writ/drafts', 1400);
  check('signed out: draft feedback is for members', /Draft feedback is for members/.test(await txt(g2, '#view, main')) && !(await g2.$('#df-form')));
  await cg2.close();
  const [ce, es] = await mk(1360, 900, { serviceWorkers: 'block' }); await ce.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ']; s.lang = 'es'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(es, '#/writ/drafts', 1800);
  check('in Spanish the page is in Spanish', /Comentarios sobre borradores/.test(await txt(es, '.page-title')) && /Los comentarios sobre borradores son para miembros/.test(await txt(es, '#view')), await txt(es, '.page-title'));
  await ce.close();
  const [cc, c] = await open(BOB); await c.evaluate(() => { const s = JSON.parse(localStorage.getItem('studyhub-settings')); delete s.aiConsent; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await go(c, '#/writ/drafts', 1400);
  check('before the first review, what is sent to the AI and the agreement', !!(await c.$('.df-gate [data-go="agree"]')) && !(await c.$('#df-form')));
  await c.click('.df-gate [data-go="agree"]'); await c.waitForTimeout(800);
  check('agreeing opens the form', !!(await c.$('#df-form')));
  await cc.close();

  /* the writing dashboard: a project draft due next has a button to Bo's feedback */
  const [cw, w] = await open(ALICE, 1360, 900, '2026-11-10');
  await go(w, '#/writ/dashboard', 1600);
  const btn = await w.evaluate(() => { const b = [...document.querySelectorAll('.hero-exam a.btn')].find(x => /Get feedback on your draft/.test(x.textContent)); return b ? b.getAttribute('href') : null; });
  check('the deadline tile: Get feedback on your draft, for Project 3’s first draft', btn === '#/writ/drafts?p=p3&stage=draft', btn);
  await cw.close();
  await ca.close();
  clean();
  await T.finish();
})();
