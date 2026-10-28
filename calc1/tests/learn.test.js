/* Learning tools with Bo (api/learn.php, assets/learn.js; the slide reader in assets/officekit.js).
   Covered: Check my work (members only, a photo needed, the lines as written, the math check finding the first wrong
   line exactly and Bo asked again about it, every line right, a photo he cannot read, credits); Notes from slides
   (a .pptx read in its presentation order with speaker notes, a PDF page by page, notes and flashcards kept,
   someone else's set, deleting, too much text); Office-hours prep is gone (its route answers 404, no page); and the
   pages: the sidebar, a photo checked with the slip marked and Ask Bo about it, slides opened into notes with cards
   to flip, Word and a CSV for Anki, a phone. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu';
const py = code => require('child_process').execFileSync('python3', ['-I', '-c', code]);
/* a small white photo (a real PNG, made here) */
const PNG = py(`import struct, sys, zlib
w = h = 16
raw = b''.join(b'\\x00' + b'\\xff\\xff\\xff' * w for _ in range(h))
chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
sys.stdout.buffer.write(b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))`);
/* slides as PowerPoint saves them, in miniature: the second file comes first in the presentation, the first has speaker notes */
const PPTX = py(`import io, sys, zipfile
P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
def sld(*paras): return '<p:sld %s><p:cSld><p:spTree><p:sp><p:txBody>%s</p:txBody></p:sp></p:spTree></p:cSld></p:sld>' % (P, ''.join('<a:p>%s</a:p>' % ''.join('<a:r><a:t>%s</a:t></a:r>' % r for r in p) for p in paras))
b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
z.writestr('ppt/presentation.xml', '<p:presentation %s><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>' % P)
z.writestr('ppt/_rels/presentation.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>')
z.writestr('ppt/slides/slide1.xml', sld(['Glycolysis'], ['Glucose is split ', 'into two pyruvate.']))
z.writestr('ppt/slides/slide2.xml', sld(['Cell respiration'], ['Makes ATP from glucose.']))
z.writestr('ppt/slides/_rels/slide1.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>')
z.writestr('ppt/notesSlides/notesSlide1.xml', '<p:notes %s><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Remember: net 2 ATP.</a:t></a:r></a:p><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>' % P)
z.close(); sys.stdout.buffer.write(b.getvalue())`);
function pdf(pages) {
  const o = []; const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  o[1] = '<< /Type /Catalog /Pages 2 0 R >>'; o[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`; o[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((lines, i) => { const s = lines.map(([x, y, t]) => `BT /F1 12 Tf ${x} ${y} Td (${t}) Tj ET`).join('\n'); o[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`; o[5 + i * 2] = `<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`; });
  let out = '%PDF-1.4\n'; const at = []; for (let n = 1; n < o.length; n++) { at[n] = Buffer.byteLength(out); out += `${n} 0 obj\n${o[n]}\nendobj\n`; }
  const x = Buffer.byteLength(out); out += `xref\n0 ${o.length}\n0000000000 65535 f \n` + at.slice(1).map(a => String(a).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${o.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const PDF = pdf([[[72, 700, 'Photosynthesis'], [72, 680, 'Light makes sugar.']], [[72, 700, 'Chlorophyll'], [72, 680, 'Absorbs red and blue.']]]);
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const last = () => JSON.parse(fs.readFileSync(LAST, 'utf8'));
  const userText = req => req.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('\n')).join('\n');
  const WHO = `(SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}'))`;
  const clean = () => { for (const q of [`DELETE FROM slide_sets WHERE user_id IN ${WHO}`, `DELETE FROM credit_use WHERE user_id IN ${WHO}`, "DELETE FROM rate WHERE key LIKE 'learn_%'"]) { try { sql(q); } catch (e) {} } };
  clean();
  const setup = new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['calc', 'writ']; s.boFloatSeen = 1; s.aiConsent = Date.now(); s.asof = '2026-10-30'; s.lang = 'en'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  const open = async (email, w = 1360, h = 900) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };
  const IMG = { type: 'image/png', data: PNG.toString('base64') };

  /* ---------- check my work ---------- */
  const [cg, g] = await open(null);
  check('signed out, nothing to check', (await api(g, 'learn_check', { class: 'calc', image: IMG })).status === 401);
  await cg.close();
  const [ca, a] = await open(ALICE);
  check('a photo is needed', (await api(a, 'learn_check', { class: 'calc', problem: 'solve 2x + 3 = 11' })).status === 400);
  let r = await api(a, 'learn_check', { class: 'calc', image: IMG, problem: 'solve 2x + 3 = 11' });
  const req = last(); const sys = req.system.map(b => b.text).join('\n');
  check('Bo is shown the photo and told to write the lines as written, find the first wrong one, and never give the answer', req.messages[0].content[0].type === 'image' && /Never fix a line while writing it down/.test(sys) && /Never write the corrected line, the steps after it or the final answer/.test(sys) && /THE PROBLEM, as they typed it: solve 2x \+ 3 = 11/.test(userText(req)), sys.slice(0, 200));
  check('the lines as written; the math check finds line 2 (Bo had said 3), and Bo is asked about line 2', r.ok && r.lines.map(l => l.text + ':' + l.state).join('|') === '2x + 3 = 11:ok|2x = 14:wrong|x = 7:after' && r.first_wrong === 2 && r.exact === true && /added 3/.test(r.why) && /take 3 from both sides/.test(r.hint) && /MATH CHECK \(exact arithmetic\): line 2 does not follow/.test(userText(req)), r);
  check('it is paid in credits, as Checking your work', rows(`SELECT feature FROM credit_use WHERE user_id = (SELECT id FROM users WHERE email = ?)`, ALICE).some(x => x.feature === 'check'));
  r = await api(a, 'learn_check', { class: 'calc', image: IMG, problem: 'ALLRIGHT' });
  check('every line right: it says so, with what to check last', r.ok && r.all_right === true && r.first_wrong === 0 && r.lines.every(l => l.state === 'ok') && /back into the first line/.test(r.hint), r);
  r = await api(a, 'learn_check', { class: 'calc', image: IMG, problem: 'UNREADABLE' });
  check('a photo he cannot read: it says so', r.ok && r.unreadable === true && r.lines.length === 0, r);

  /* ---------- notes from slides ---------- */
  const slides = await a.evaluate(async b => { const f = new File([new Uint8Array(b)], 'Lecture 7.pptx'); return App.Office.slideText(f); }, [...PPTX]);
  check('a .pptx is read in the presentation’s order, each slide’s text with its speaker notes (the slide number left out)', JSON.stringify(slides) === JSON.stringify([{ n: 1, text: 'Cell respiration\nMakes ATP from glucose.' }, { n: 2, text: 'Glycolysis\nGlucose is split into two pyruvate.\nNotes: Remember: net 2 ATP.' }]), slides);
  const pages = await a.evaluate(async b => App.Office.slideText(new File([new Uint8Array(b)], 'Lecture 8.pdf', { type: 'application/pdf' })), [...PDF]);
  check('a PDF of slides, page by page', JSON.stringify(pages) === JSON.stringify([{ n: 1, text: 'Photosynthesis\nLight makes sugar.' }, { n: 2, text: 'Chlorophyll\nAbsorbs red and blue.' }]), pages);
  check('other files are refused with what to do', /Mathub reads slides as \.pptx or \.pdf/.test(await a.evaluate(async () => { try { await App.Office.slideText(new File(['x'], 'notes.key')); return ''; } catch (e) { return e.message; } })));
  check('slides with no text: refused', (await api(a, 'learn_slides', { class: 'calc', slides: [{ n: 1, text: '   ' }] })).status === 400);
  check('too much text for one set: refused (413)', (await api(a, 'learn_slides', { class: 'calc', slides: [{ n: 1, text: 'word '.repeat(1200) }, ...Array.from({ length: 15 }, (_, i) => ({ n: i + 2, text: 'word '.repeat(1199) }))] })).status === 413);
  r = await api(a, 'learn_slides', { class: 'calc', source: 'Lecture 7.pptx', slides });
  const u3 = userText(last());
  check('Bo gets the slides by number and is told to use only what they say', /SLIDE 1:\nCell respiration/.test(u3) && /SLIDE 2:\nGlycolysis/.test(u3) && /Use only what the slides say/.test(last().system[0].text), u3.slice(0, 300));
  check('notes and flashcards, kept', r.ok && r.set.title === 'Cell respiration' && r.set.slides === 2 && r.set.notes.sections.map(s => s.heading).join() === 'Cell respiration,Glycolysis' && r.set.cards.length === 2 && r.set.count === 2, r.set);
  const sid = r.set.id;
  r = await api(a, 'learn_slides_list&class=calc'); check('her list', r.sets.length === 1 && r.sets[0].id === sid && r.sets[0].count === 2 && r.sets[0].cards === undefined, r.sets);
  const [cb, b] = await open(BOB);
  check('nobody else can open or delete them', (await api(b, `learn_slides_get&class=calc&id=${sid}`)).status === 404 && (await api(b, 'learn_slides_delete', { class: 'calc', id: sid })).status === 404 && (await api(b, 'learn_slides_list&class=calc')).sets.length === 0);
  await cb.close();

  /* ---------- office-hours prep: retired ---------- */
  check('office-hours prep is gone from the server', (await api(a, 'learn_officehours', { class: 'calc', mistakes: [{ topic: 'Limits', q: 'x', right: '2' }] })).status === 404);

  /* ---------- the pages ---------- */
  await go(a, '#/calc/dashboard', 1400);
  const nav = await a.evaluate(() => [...document.querySelectorAll('#sidebar-nav [data-view]')].map(x => x.dataset.view.split('/').pop()));
  check('a math class’s sidebar has Check my work and Notes from slides, and no Office-hours prep', ['checkwork', 'slides'].every(v => nav.includes(v)) && !nav.includes('officehours'), nav);
  await go(a, '#/writ/dashboard', 1400);
  const navW = await a.evaluate(() => [...document.querySelectorAll('#sidebar-nav [data-view]')].map(x => x.dataset.view.split('/').pop()));
  check('a writing class has the notes, not Check my work', navW.includes('slides') && !navW.includes('checkwork'), navW);
  await go(a, '#/calc/checkwork', 1400);
  check('Check it waits for a photo', await a.$eval('#lw-go', el => el.disabled));
  await a.setInputFiles('#lw-file', { name: 'work.png', mimeType: 'image/png', buffer: PNG }); await a.waitForTimeout(600);
  await a.fill('#lw-problem', 'solve 2x + 3 = 11'); await a.click('#lw-go');
  await a.waitForSelector('.lw-lines', { timeout: 15000 }).catch(() => {});
  const res = await a.evaluate(() => ({ lines: [...document.querySelectorAll('.lw-lines li')].map(li => li.className + ':' + li.querySelector('code').textContent).join('|'), focus: document.activeElement && document.activeElement.id, why: document.querySelector('.lw-why').textContent, prev: !document.querySelector('#lw-prev').hidden }));
  check('the photo is shown; the lines, the slip marked and focused, why and the hint, checked exactly', res.prev && res.lines === 'lw-ok:2x + 3 = 11|lw-wrong:2x = 14|lw-after:x = 7' && res.focus === 'lw-wrong' && /Line 2/.test(res.why) && /checked exactly/.test(res.why) && /Hint/.test(res.why), res);
  await a.click('[data-action="lw-ask"]'); await a.waitForTimeout(800);
  check('Ask Bo about this line: the floating Bo on that line', await a.evaluate(() => !document.querySelector('#bo-pop').hidden && /Line 2/.test(document.querySelector('#bf-chips').textContent) && document.querySelector('#bf-q').value === 'Why is that wrong?'));
  await a.click('[data-bf="close"]'); await a.click('[data-action="lw-again"]'); await a.waitForTimeout(300);
  check('Check another starts over', await a.evaluate(() => !document.querySelector('.lw-lines') && document.querySelector('#lw-go').disabled));
  check('the page fits and has no errors', await hscroll(a));

  await go(a, '#/calc/slides', 1400);
  check('Notes from slides: the notes kept so far', /Cell respiration/.test(await txt(a, '#sl-list')) && /2 slides · 2 flashcards/.test(await txt(a, '#sl-list')));
  await a.setInputFiles('#sl-file', { name: 'Lecture 8.pdf', mimeType: 'application/pdf', buffer: PDF });
  await a.waitForFunction(() => /#\/calc\/slides\/\d+$/.test(location.hash) && document.querySelector('.sl-notes'), null, { timeout: 15000 }).catch(() => {}); await a.waitForTimeout(400);
  const sv = await a.evaluate(() => ({ heads: [...document.querySelectorAll('.sl-notes h2')].map(x => x.textContent).join(), card: document.querySelector('#sl-card').textContent, pos: document.querySelector('#sl-pos').textContent }));
  check('a PDF opened into notes and flashcards', sv.heads === 'Photosynthesis,Chlorophyll' && /Question.*What is on slide 1\?/.test(sv.card) && sv.pos === '1 of 2', sv);
  await a.click('#sl-card'); check('the card turns over', /Answer.*Photosynthesis/.test(await txt(a, '#sl-card')));
  await a.focus('#sl-card'); await a.keyboard.press('ArrowRight'); check('and the arrow keys go on', (await txt(a, '#sl-pos')) === '2 of 2' && /Question/.test(await txt(a, '#sl-card')));
  const [dc] = await Promise.all([a.waitForEvent('download', { timeout: 10000 }), a.click('[data-action="sl-csv"]')]);
  const csv = fs.readFileSync(await dc.path(), 'utf8');
  check('flashcards as a CSV for Anki or Quizlet', dc.suggestedFilename() === 'Cell respiration flashcards.csv' && csv === '﻿What is on slide 1?,Photosynthesis\r\nWhat is on slide 2?,Chlorophyll\r\n', JSON.stringify(csv));
  const [dw] = await Promise.all([a.waitForEvent('download', { timeout: 10000 }), a.click('[data-action="sl-word"]')]);
  const docXml = require('child_process').execFileSync('unzip', ['-p', await dw.path(), 'word/document.xml']).toString();
  check('and the notes as a Word file', dw.suggestedFilename() === 'Cell respiration.docx' && /Photosynthesis/.test(docXml) && /What is on slide 2\?/.test(docXml));
  check('the notes fit and have no errors', await hscroll(a));

  const [cp, ph] = await open(ALICE, 390, 844);
  for (const h of ['#/calc/checkwork', '#/calc/slides', `#/calc/slides/${sid}`]) { await go(ph, h, 1500); check(`fits a phone: ${h}`, await hscroll(ph)); }
  await cp.close();
  r = await api(a, 'learn_slides_delete', { class: 'calc', all: 1 }); check('she can delete all her notes', r.ok && (await api(a, 'learn_slides_list&class=calc')).sets.length === 0);
  await a.evaluate(() => { App.store.poke('calc', d => { d.mistakes = []; }); });
  await ca.close();
  clean();
  await T.finish();
})();
