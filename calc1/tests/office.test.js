/* Docs, Slides and Sheets (api/office.php, assets/office*.js).
   Covered: the server (members only, versions and the 409 when a file changed elsewhere, shapes and limits, rename,
   copy, delete, other members cannot reach a file, the data export, deleted with the account); each editor's own
   work (typing and formats, undo, lists, tables, find and replace, pasting cleaned, pictures, page setup; slides,
   layouts, text, shapes, moving, themes, notes, reordering, presenting; cells, formulas, formats, copy and paste,
   filling, rows, sorting, AutoSum, charts, sheets); saving, a copy kept on the device, two devices at once; Word,
   PowerPoint, Excel and CSV files written (every part of the package checked) and read back, and files from
   python-docx, python-pptx, openpyxl and LibreOffice opened; accessibility, phones, no errors.
   When MATHUB_OFFICE_PY names a Python with python-docx, python-pptx and openpyxl, the files are also opened with
   them; when LibreOffice (soffice) is installed, each is turned into a PDF to show it opens there. */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const API = path.join(__dirname, '..', 'api'); const DB = path.join(API, 'data', 'mathub.sqlite');
const FIX = path.join(__dirname, 'fixtures', 'office'); const OUT = path.join(__dirname, 'fixtures', 'office-out'); fs.mkdirSync(OUT, { recursive: true });
const sql = (q, ...a) => cp.spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const idOf = email => +rows('SELECT id FROM users WHERE email = ?', email)[0].id;
/* a package's every part: well-formed XML, a content type, and relationships that point at parts that are there */
const CHECK_PKG = `import sys, zipfile, posixpath, xml.etree.ElementTree as ET
z = zipfile.ZipFile(sys.argv[1]); names = set(n for n in z.namelist() if not n.endswith('/')); bad = []
for n in names:
    if n.endswith('.xml') or n.endswith('.rels'):
        try: ET.fromstring(z.read(n))
        except Exception as e: bad.append('xml %s: %s' % (n, e))
ns = '{http://schemas.openxmlformats.org/package/2006/content-types}'; ct = ET.fromstring(z.read('[Content_Types].xml'))
dft = {d.get('Extension').lower() for d in ct.findall(ns + 'Default')}; ovr = {o.get('PartName').lstrip('/') for o in ct.findall(ns + 'Override')}
for n in names:
    if n != '[Content_Types].xml' and n not in ovr and n.rsplit('.', 1)[-1].lower() not in dft: bad.append('no type: ' + n)
for o in ovr:
    if o not in names: bad.append('type for a missing part: ' + o)
for n in names:
    if not n.endswith('.rels'): continue
    src = posixpath.dirname(posixpath.dirname(n))
    for r in ET.fromstring(z.read(n)):
        if r.get('TargetMode') == 'External': continue
        t = r.get('Target'); p = t.lstrip('/') if t.startswith('/') else posixpath.normpath(posixpath.join(src, t))
        if p not in names: bad.append('%s %s -> missing %s' % (n, r.get('Id'), p))
print('OK' if not bad else '\\n'.join(bad))`;
const pkg = file => cp.execFileSync('python3', ['-I', '-c', CHECK_PKG, file]).toString().trim();
const part = (file, name) => cp.execFileSync('python3', ['-I', '-c', 'import sys, zipfile; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())', file, name]).toString();
const PYX = process.env.MATHUB_OFFICE_PY && fs.existsSync(process.env.MATHUB_OFFICE_PY) ? process.env.MATHUB_OFFICE_PY : '';
const pyx = (code, ...a) => cp.execFileSync(PYX, ['-I', '-c', code, ...a]).toString().trim();
const SOFFICE = cp.spawnSync('sh', ['-c', 'command -v soffice']).stdout.toString().trim();
const pdfPages = file => { const dir = fs.mkdtempSync(path.join(OUT, 'pdf-')); const r = cp.spawnSync(SOFFICE, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, file], { timeout: 180000 }); const pdf = path.join(dir, path.basename(file).replace(/\.\w+$/, '.pdf')); if (r.status !== 0 || !fs.existsSync(pdf)) return 0; const info = cp.spawnSync('pdfinfo', [pdf]).stdout.toString(); return +((/Pages:\s+(\d+)/.exec(info) || [])[1] || (fs.statSync(pdf).size > 800 ? 1 : 0)); };
const b64 = f => fs.readFileSync(f).toString('base64');

(async () => {
  const { mk, login, go, txt, check, api, log, hscroll } = await T.start({});
  const setup = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ', 'calc']; s.boFloatSeen = 1; s.aiConsent = Date.now(); s.lang = 'en'; s.motion = 'off'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} };
  const open = async (email, w = 1360, h = 900) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block', acceptDownloads: true }); await c.addInitScript(setup); await go(p, '#/', 500); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(800); } return [c, p]; };
  const saved = p => p.waitForFunction(() => { const s = document.querySelector('#of-state'); return s && s.textContent === 'Saved'; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  const fileOf = async (p, id) => (await api(p, 'office_get&id=' + id)).json.file;
  const idNow = p => p.evaluate(() => +location.hash.split('/').pop());
  const download = async (p, item, name) => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), (async () => { await p.click('#of-bar-r [data-menu]:last-child'); await p.click(`.of-menu-i:has-text("${item}")`); })()]); const f = path.join(OUT, name); await dl.saveAs(f); return f; };
  const clip = (p, type, data) => p.evaluate(([type, data]) => { const dt = new DataTransfer(); Object.entries(data || {}).forEach(([k, v]) => dt.setData(k, v)); const e = new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(e); const out = {}; dt.types.forEach(t => { out[t] = dt.getData(t); }); return out; }, [type, data]);

  // ---------------- the server ----------------
  const [c0, g] = await open(null);
  check('without an account the files cannot be listed', (await api(g, 'office_list')).status === 401);
  await go(g, '#/docs', 1200); check('and the page says what Docs is, with a way to sign up', /Write and format documents/.test(await txt(g, '#view')) && !!(await g.$('#view .lock-card')));
  await c0.close();
  const [ca, a] = await open('alice.a@montana.edu'); await api(a, 'office_list'); const alice = idOf('alice.a@montana.edu'); sql('DELETE FROM office_files WHERE user_id = ?', alice);
  let r = await api(a, 'office_save', { kind: 'doc', title: '  API   doc ', body: { html: '<p>Hello</p>', words: 1 }, device: 'test-a' });
  check('a document is saved: version 1, its name tidied', r.json.ok && r.json.file.version === 1 && r.json.file.kind === 'doc' && r.json.file.title === 'API doc', r.json);
  const apiId = r.json.file.id;
  r = await api(a, 'office_get&id=' + apiId); check('and opened with what is in it', r.json.file.body.html === '<p>Hello</p>' && r.json.file.words === 1);
  r = await api(a, 'office_save', { id: apiId, base: 1, body: { html: '<p>Hello again</p>' } }); check('a save on the version it was written on goes in (version 2)', r.json.ok && r.json.file.version === 2);
  r = await api(a, 'office_save', { id: apiId, base: 1, body: { html: '<p>From an old tab</p>' } }); check('a save on an older version is refused with 409, saying what the file is now', r.status === 409 && r.json.conflict === true && r.json.file.version === 2 && (await fileOf(a, apiId)).body.html === '<p>Hello again</p>');
  r = await api(a, 'office_save', { id: apiId, base: 1, force: true, body: { html: '<p>Mine wins</p>' } }); check('unless the person chose to replace it', r.json.ok && r.json.file.version === 3 && (await fileOf(a, apiId)).body.html === '<p>Mine wins</p>');
  check('a body of the wrong shape is refused, and an unknown kind', (await api(a, 'office_save', { kind: 'deck', body: { html: 'x' } })).status === 400 && (await api(a, 'office_save', { kind: 'nope', body: {} })).status === 400 && (await api(a, 'office_save', { kind: 'sheet', body: 'text' })).status === 400);
  r = await a.evaluate(async () => { const body = JSON.stringify({ kind: 'doc', title: 'Big', body: { html: '<p>' + 'x'.repeat(8.5 * 1024 * 1024) + '</p>' } }); const res = await fetch('api/index.php?r=office_save', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'MatHub' }, body }); return { status: res.status, json: await res.json() }; });
  check('a file over 8 MB is refused (413), saying so', r.status === 413 && /8 MB/.test(r.json.error), r);
  r = await api(a, 'office_rename', { id: apiId, title: 'Renamed doc' }); check('a file can be renamed (its version stays)', r.json.file.title === 'Renamed doc' && r.json.file.version === 3);
  r = await api(a, 'office_copy', { id: apiId, title: 'Copy of Renamed doc' }); const copyId = r.json.file.id; check('copied, with the same body', r.json.ok && copyId !== apiId && (await fileOf(a, copyId)).body.html === '<p>Mine wins</p>');
  r = await api(a, 'office_list&kind=doc'); check('the list: newest first, with the totals and the limits', r.json.files.length === 2 && r.json.count === 2 && r.json.max_files === 300 && r.json.max_bytes === 200 * 1024 * 1024 && r.json.bytes > 0);
  const [cb, b] = await open('bob.bmu6j92pq@montana.edu');
  check('another member cannot open, rename, copy, save over or delete it', (await api(b, 'office_get&id=' + apiId)).status === 404 && (await api(b, 'office_rename', { id: apiId, title: 'x' })).status === 404 && (await api(b, 'office_copy', { id: apiId })).status === 404 && (await api(b, 'office_save', { id: apiId, base: 3, body: { html: '<p>x</p>' } })).status === 404 && (await api(b, 'office_delete', { id: apiId })).status === 404 && !(await api(b, 'office_list')).json.files.some(f => f.id === apiId));
  r = await api(a, 'data_export'); const ex = (r.json.data || r.json).tables ? (r.json.data || r.json).tables.office_files : null;
  check('Download my data has the files, what is in them readable', Array.isArray(ex) && ex.some(f => f.id === apiId && f.body && f.body.html === '<p>Mine wins</p>') && !ex.some(f => 'dev' in f), ex && ex[0]);
  check('a file can be deleted, and is gone', (await api(a, 'office_delete', { id: copyId })).json.ok && (await api(a, 'office_get&id=' + copyId)).status === 404);
  // deleted with the account
  const [cad, ad] = await open('admin.user@montana.edu'); const tmp = `office.${Date.now().toString(36)}@montana.edu`;
  await api(ad, 'admin_user_add', { email: tmp, how: 'password', password: 'spreadsheet-cells-42' }); await cad.close();
  const [ct, tp] = await open(null); await api(tp, 'login', { email: tmp, password: 'spreadsheet-cells-42' });
  r = await api(tp, 'office_save', { kind: 'sheet', body: { sheets: [{ name: 'S', cells: { A1: { v: '1' } } }] } }); const tmpId = r.json.file && r.json.file.id;
  await api(tp, 'account_delete', { password: 'spreadsheet-cells-42' }); await ct.close();
  check('a member’s files are deleted with their account', !!tmpId && rows('SELECT id FROM office_files WHERE id = ?', tmpId).length === 0);

  // ---------------- Docs ----------------
  await go(a, '#/docs', 1500);
  check('Docs: four ways to start, opening a Word file, and your files', (await a.$$('.of-tpl[data-t]')).length === 4 && !!(await a.$('#of-file')) && /Renamed doc/.test(await txt(a, '#of-rows')) && /1 of 300 files/.test(await txt(a, '#of-use')));
  await a.fill('#of-find', 'zzz'); check('finding a file by name', /No file is called that/.test(await txt(a, '#of-rows'))); await a.fill('#of-find', '');
  await a.click('.of-tpl[data-t="blank"]'); await a.waitForSelector('#dt-body', { timeout: 15000 }); await a.waitForTimeout(400);
  const docId = await idNow(a);
  await a.click('#dt-body'); await a.keyboard.type('Pendulum lab');
  await a.selectOption('[data-c="block"]', 'H1'); await a.waitForTimeout(100);
  await a.click('#dt-body'); await a.keyboard.press('Control+End'); await a.keyboard.press('Enter');
  await a.selectOption('[data-c="block"]', 'P'); await a.click('#dt-body'); await a.keyboard.press('Control+End');
  await a.keyboard.type('The period '); await a.keyboard.press('Control+b'); await a.keyboard.type('grows'); await a.keyboard.press('Control+b'); await a.keyboard.type(' with length.');
  check('typing, a heading and bold go in as they would in Word', await saved(a) && /<h1>Pendulum lab<\/h1>/.test((await fileOf(a, docId)).body.html) && /<strong>grows<\/strong>/.test((await fileOf(a, docId)).body.html), (await fileOf(a, docId)).body.html);
  check('the words are counted', /^\d+ words$/.test(await txt(a, '#dt-words')) && +((await txt(a, '#dt-words')).split(' ')[0]) === 7, await txt(a, '#dt-words'));
  const before = await a.$eval('#dt-body', e => e.innerHTML);
  await a.keyboard.type(' Extra.'); await a.keyboard.press('Control+z'); await a.waitForTimeout(150);
  check('Ctrl+Z takes back what was just typed', (await a.$eval('#dt-body', e => e.innerHTML)) === before);
  await a.keyboard.press('Control+y'); await a.waitForTimeout(150); check('and Ctrl+Y puts it back', /Extra\./.test(await a.$eval('#dt-body', e => e.textContent)));
  await a.keyboard.press('Enter'); await a.click('[data-c="insertUnorderedList"]'); await a.keyboard.type('First point'); await a.keyboard.press('Enter'); await a.keyboard.type('Second point'); await a.keyboard.press('Enter'); await a.keyboard.press('Tab'); await a.keyboard.type('nested');
  await saved(a); check('a bulleted list, Tab making a level inside it (saved as a list in the item above)', /<ul><li>First point<\/li><li>Second point<ul><li>nested<\/li><\/ul><\/li><\/ul>/.test((await fileOf(a, docId)).body.html), (await fileOf(a, docId)).body.html);
  await a.keyboard.press('Enter'); await a.keyboard.press('Enter'); await a.keyboard.press('Enter');
  await a.click('[data-c="table"]'); await a.click('.of-tgrid [data-r="2"][data-c="3"]'); await a.waitForTimeout(150);
  check('a table of the size picked, a header row first', await a.$eval('#dt-body', e => { const t = e.querySelector('table'); return !!t && t.rows.length === 2 && t.rows[0].cells.length === 3 && t.rows[0].cells[0].tagName === 'TH'; }));
  await a.click('#dt-body table th'); await a.keyboard.type('Length'); await a.keyboard.press('Tab'); await a.keyboard.type('Period');
  for (let k = 0; k < 5; k++) await a.keyboard.press('Tab');
  check('Tab moves along the cells, and past the last one adds a row; the table tools show', await a.$eval('#dt-body table', t => t.rows.length === 3 && t.rows[0].cells[1].textContent === 'Period') && !(await a.$('#dt-tbar[hidden]')));
  await a.click('#dt-tbar [data-tb="colRight"]'); check('a column added from the table tools', await a.$eval('#dt-body table', t => t.rows[0].cells.length === 4));
  await a.click('#dt-tbar [data-tb="delCol"]'); check('and deleted', await a.$eval('#dt-body table', t => t.rows[0].cells.length === 3));
  await a.click('#dt-body h1'); await a.keyboard.press('Control+f'); await a.fill('#dt-q', 'period'); await a.waitForTimeout(100);
  check('find counts what it finds (any case)', /2 matches/.test(await txt(a, '#dt-fcount')), await txt(a, '#dt-fcount'));
  await a.fill('#dt-r', 'swing time'); await a.click('#dt-find [data-f="all"]'); await a.waitForTimeout(100);
  check('Replace all', /Replaced 2/.test(await txt(a, '#dt-fcount')) && !/period/i.test(await a.$eval('#dt-body', e => e.textContent)) && /swing time grows/.test(await a.$eval('#dt-body', e => e.textContent)));
  await a.click('#dt-find [data-f="close"]');
  await a.click('#dt-body h1'); await a.keyboard.press('End');
  await clip(a, 'paste', { 'text/html': '<p onclick="alert(1)">Pasted <b>bold</b><script>alert(2)</script><img src="http://example.com/x.png" onerror="alert(3)"> <a href="javascript:alert(4)">bad link</a> <a href="https://www.montana.edu">good link</a><span style="position:fixed;color:#c0392b">red</span></p>' });
  await a.waitForTimeout(200); const ph = await a.$eval('#dt-body', e => e.innerHTML);
  check('pasting from a web page keeps the words and formats, not scripts, handlers, outside pictures or javascript: links', /Pasted/.test(ph) && /good link/.test(ph) && /montana\.edu/.test(ph) && !/script|onclick|onerror|javascript:|example\.com|position/i.test(ph) && /color:\s*(#c0392b|rgb\(192, 57, 43\))/.test(ph), ph.slice(0, 400));
  const PNG = path.join(OUT, 'blue.png'); fs.writeFileSync(PNG, cp.execFileSync('python3', ['-I', '-c', `import struct, sys, zlib
w, h = 64, 40
raw = b''.join(b'\\x00' + b'\\x2f\\x6f\\xde' * w for _ in range(h))
chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
sys.stdout.buffer.write(b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))`]));
  await a.click('#dt-body'); await a.keyboard.press('Control+End'); { const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.click('[data-c="pic"]')]); await fc.setFiles(PNG); } await a.waitForTimeout(600);
  check('a picture goes in (kept small in the page, written out in full when saved)', await a.$eval('#dt-body', e => { const i = e.querySelector('img'); return !!i && /^blob:/.test(i.src); }) && await saved(a) && /<img src="data:image\/png;base64,/.test((await fileOf(a, docId)).body.html));
  await a.click('#dt-body img'); await a.click('#dt-ibar [data-iw="50"]'); check('a picture can be made smaller', await a.$eval('#dt-body img', i => i.getAttribute('width') === '312'));
  await a.selectOption('#dt-spacing', '2'); await a.selectOption('#dt-num', 'top'); await a.fill('#dt-head', 'Alice');
  check('page setup: double spacing, the name and page number at the top', await saved(a) && (await fileOf(a, docId)).body.spacing === 2 && (await fileOf(a, docId)).body.numbers === 'top' && (await fileOf(a, docId)).body.header === 'Alice' && /Alice 1/.test(await txt(a, '#dt-hdr')));
  await a.fill('#of-title', 'Lab report draft'); await a.press('#of-title', 'Enter'); await a.waitForTimeout(500);
  check('the name changes from the title box', (await fileOf(a, docId)).title === 'Lab report draft');
  await a.reload(); await a.waitForSelector('#dt-body'); await a.waitForTimeout(500);
  check('it is all still there after leaving and coming back', /Pendulum lab/.test(await a.$eval('#dt-body', e => e.textContent)) && !!(await a.$('#dt-body table')) && !!(await a.$('#dt-body img')) && (await a.$eval('#dt-spacing', s => s.value)) === '2');
  // the Word file
  const DOCX = await download(a, 'Download as Word', 'lab.docx');
  const docXml = part(DOCX, 'word/document.xml'); const hdrXml = part(DOCX, 'word/header1.xml'); const styXml = part(DOCX, 'word/styles.xml');
  check('the Word file: every part well formed and in its place', pkg(DOCX) === 'OK', pkg(DOCX));
  check('with the heading, bold, list, table, picture, link, double spacing and "Alice 1" at the top', /<w:pStyle w:val="Heading1"\/>/.test(docXml) && /<w:b\/>/.test(docXml) && /<w:numPr>/.test(docXml) && /<w:tbl>/.test(docXml) && /<a:blip r:embed=/.test(docXml) && /<w:hyperlink/.test(docXml) && /w:line="480"/.test(styXml) && /Alice <\/w:t>/.test(hdrXml) && /PAGE/.test(hdrXml));
  if (PYX) { const o = pyx(`import sys, docx\nd = docx.Document(sys.argv[1])\nprint(d.paragraphs[0].style.name, '|', len(d.tables), '|', len(d.inline_shapes), '|', d.sections[0].header.paragraphs[0].text)`, DOCX); check('python-docx opens it: the heading, the table, the picture, the header', /^Heading 1 \| 1 \| 1 \| Alice/.test(o), o); } else log('python-docx not given (MATHUB_OFFICE_PY): skipped');
  if (SOFFICE) check('LibreOffice opens the Word file', pdfPages(DOCX) >= 1); else log('LibreOffice not installed: skipped');
  // opening Word files
  await go(a, '#/docs', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'word-python.docx')); await a.waitForSelector('#dt-body', { timeout: 15000 }); await a.waitForTimeout(400);
  let html = await a.$eval('#dt-body', e => e.innerHTML);
  check('a Word file from python-docx opens as a new document: headings, bold and colour, lists from styles, the table, the page break, the quote', /<h1>Essay title<\/h1>/.test(html) && /<strong><span style="color:\s*(#c0392b|rgb\(192, 57, 43\))[^"]*">bold red<\/span><\/strong>/.test(html) && /<ul><li>Bullet one<\/li>/.test(html) && /<ol><li>Number one<\/li><li>Number two<\/li><\/ol>/.test(html) && /r1c2/.test(html) && /<hr class="pb">/.test(html) && /<blockquote>After the page break/.test(html) && (await a.$eval('#of-title', i => i.value)) === 'word-python', html.slice(0, 500));
  await go(a, '#/docs', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'word-libreoffice.docx')); await a.waitForSelector('#dt-body', { timeout: 15000 }); await a.waitForTimeout(400);
  html = await a.$eval('#dt-body', e => e.innerHTML);
  check('and one saved by LibreOffice: numbered lists that start again, the merged cell, the picture, the indent', /<ol><li>Step one<\/li><li>Step two<\/li><\/ol><ol><li>Again one/.test(html) && /colspan="2"/.test(html) && /<img /.test(html) && /margin-left:\s*40px/.test(html), html.slice(0, 400));
  // a copy on the device, brought back
  const v0 = (await fileOf(a, docId)).version;
  await go(a, '#/docs', 800); await a.evaluate(([id, v]) => localStorage.setItem('mathub-office-' + id, JSON.stringify({ base: v, at: Date.now(), body: { html: '<p>Written offline, never sent</p>' } })), [docId, v0]);
  await go(a, '#/docs/' + docId, 1800);
  check('what was changed and not saved (a lost connection, a closed tab) comes back, and is saved', /Written offline/.test(await a.$eval('#dt-body', e => e.textContent)) && /Brought back|Saving|Saved/.test(await txt(a, '#of-state')) && await saved(a) && /Written offline/.test((await fileOf(a, docId)).body.html));
  // two devices at once
  const [ca2, a2] = await open('alice.a@montana.edu'); await go(a2, '#/docs/' + docId, 1800);
  await a.click('#dt-body'); await a.keyboard.press('Control+End'); await a.keyboard.type(' From the laptop.'); await saved(a);
  await a2.click('#dt-body'); await a2.keyboard.press('Control+End'); await a2.keyboard.type(' From the phone.'); await a2.waitForSelector('#of-conflict:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('a file changed on another device meanwhile is not overwritten: the page asks', !!(await a2.$('#of-conflict:not([hidden]) [data-c="copy"]')) && /changed on another device/.test(await txt(a2, '#of-conflict')) && /From the laptop/.test((await fileOf(a, docId)).body.html) && !/From the phone/.test((await fileOf(a, docId)).body.html));
  await a2.click('#of-conflict [data-c="copy"]'); await a2.waitForTimeout(1800);
  const copy2 = await idNow(a2);
  check('Keep both saves this device’s as a copy', copy2 !== docId && /\(my copy\)/.test((await fileOf(a2, copy2)).title) && /From the phone/.test((await fileOf(a2, copy2)).body.html) && /From the laptop/.test((await fileOf(a, docId)).body.html));
  await ca2.close();
  // Bo's feedback
  await go(a, '#/docs/' + docId, 1500); await a.click('#dt-body'); await a.keyboard.press('Control+End');
  await a.keyboard.type(' ' + 'The pendulum swings back and forth while we time ten full swings with a stopwatch and divide by ten to find one period, '.repeat(3));
  await saved(a); await a.click('#dt-bo'); await a.waitForSelector('.of-dlg'); await a.selectOption('.of-dlg select', 'writ'); await a.click('.of-dlg [type="submit"]'); await a.waitForTimeout(2500);
  const handed = await a.evaluate(() => { try { return JSON.parse(localStorage.getItem('mathub-draft-form-writ')).text; } catch (e) { return ''; } });
  check('Get Bo’s feedback takes the document’s words to draft feedback in the class picked', (await a.evaluate(() => location.hash)) === '#/writ/drafts' && /divide by ten/.test(handed) && /From the laptop/.test(handed) && (!(await a.$('#df-text')) || /From the laptop/.test(await a.$eval('#df-text', t => t.value))), [await a.evaluate(() => location.hash), handed.slice(0, 80), await txt(a, '.toast')]);

  // ---------------- Slides ----------------
  await go(a, '#/decks', 1200); await a.click('.of-tpl[data-t="class"]'); await a.waitForSelector('#sl-stage .sl-it', { timeout: 15000 }); await a.waitForTimeout(500);
  const deckId = await idNow(a);
  check('Slides: a presentation from a template, its slides down the side', (await a.$$('#sl-rail .sl-r')).length === 5 && /Presentation title/.test(await a.$eval('#sl-stage', s => s.textContent)));
  await a.click('[data-c="newslide"]'); await a.click('.of-menu-i:has-text("Title and content")'); await a.waitForTimeout(300);
  check('a new slide goes in after the one open, in the layout picked', (await a.$$('#sl-rail .sl-r')).length === 6 && (await a.$eval('#sl-rail .sl-r.on', li => li.dataset.i)) === '1' && (await a.$$('#sl-stage .sl-text')).length === 2);
  await a.click('#sl-stage .sl-text.r-title'); await a.keyboard.press('Enter'); await a.keyboard.type('Results'); await a.keyboard.press('Escape');
  await a.click('#sl-stage .sl-text.r-body'); await a.keyboard.press('Enter'); await a.keyboard.type('Period grows with length'); await a.keyboard.press('Enter'); await a.keyboard.type('Mass does not matter'); await a.keyboard.press('Enter'); await a.keyboard.press('Tab'); await a.keyboard.type('within 2%'); await a.keyboard.press('Escape');
  await saved(a); let deck = (await fileOf(a, deckId)).body;
  check('typing in the title and the bullets, Tab making a second level', /Results/.test(deck.slides[1].items[0].html) && (deck.slides[1].items[1].html.match(/data-list="bullet"/g) || []).length === 3 && /<p data-list="bullet" data-lvl="1">within 2%<\/p>$/.test(deck.slides[1].items[1].html), deck.slides[1].items.map(i => i.html));
  await a.waitForTimeout(400); check('the slide down the side shows it', /Results/.test(await a.$eval('#sl-rail .sl-r.on', li => li.textContent)));
  await a.click('[data-c="shape"]'); await a.click('.of-menu-i:has-text("Ellipse")'); await a.waitForTimeout(200);
  for (let k = 0; k < 3; k++) await a.keyboard.press('Shift+ArrowRight');
  await saved(a); deck = (await fileOf(a, deckId)).body; let sh = deck.slides[1].items.find(i => i.type === 'shape');
  check('a shape added, and moved with the arrow keys (Shift: 10 points)', !!sh && sh.shape === 'ellipse' && sh.x === 410, sh);
  await a.keyboard.press('Control+z'); await saved(a); deck = (await fileOf(a, deckId)).body; sh = deck.slides[1].items.find(i => i.type === 'shape');
  check('one Ctrl+Z takes the moves back (nudges in a row are one step)', !!sh && sh.x === 380, sh);
  await a.keyboard.press('Delete'); await saved(a); check('Delete takes the shape away', !(await fileOf(a, deckId)).body.slides[1].items.some(i => i.type === 'shape'));
  await a.click('[data-c="textbox"]'); await a.keyboard.type('g = 9.81 m/s²'); await a.keyboard.press('Escape'); await saved(a);
  check('a text box', (await fileOf(a, deckId)).body.slides[1].items.some(i => i.type === 'text' && i.role === 'text' && /9\.81/.test(i.html)));
  { const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.click('[data-c="pic"]')]); await fc.setFiles(PNG); } await a.waitForTimeout(800); await saved(a);
  check('a picture, sized to fit the slide', (await fileOf(a, deckId)).body.slides[1].items.some(i => i.type === 'image' && /^data:image\/png/.test(i.src) && i.w <= 576 && i.h <= 378));
  await a.click('[data-c="theme"]'); await a.click('.of-menu-i:has-text("Night")'); await saved(a);
  check('a theme for the whole deck', (await fileOf(a, deckId)).body.theme === 'night' && /rgb\(21, 24, 33\)|#151821/.test(await a.$eval('#sl-stage .sl-bg', e => e.style.background)));
  await a.fill('#sl-notes', 'Say the result first.'); await saved(a); check('speaker notes for the slide', (await fileOf(a, deckId)).body.slides[1].notes === 'Say the result first.');
  await a.focus('#sl-rail .sl-r.on'); await a.keyboard.press('Alt+ArrowUp'); await saved(a); deck = (await fileOf(a, deckId)).body;
  check('Alt+↑ moves a slide up', /Results/.test(deck.slides[0].items[0].html) && deck.slides.length === 6);
  await a.keyboard.press('Delete'); await saved(a); check('Delete in the side list deletes the slide', (await fileOf(a, deckId)).body.slides.length === 5);
  await a.focus('#sl-stage'); await a.keyboard.press('Control+z'); await saved(a); check('and Ctrl+Z brings it back', (await fileOf(a, deckId)).body.slides.length === 6 && /Results/.test((await fileOf(a, deckId)).body.slides[0].items[0].html));
  await a.click('#sl-present'); await a.waitForSelector('.sl-show'); await a.waitForTimeout(300);
  const n1 = await txt(a, '.sl-show-n'); await a.keyboard.press('ArrowRight'); await a.waitForTimeout(150); const n2 = await txt(a, '.sl-show-n'); await a.keyboard.press('n'); await a.waitForTimeout(100);
  const notesShown = !(await a.$('.sl-show-notes[hidden]'));
  await a.keyboard.press('ArrowLeft'); await a.waitForTimeout(100); const notesText = await txt(a, '.sl-show-notes');
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  check('Present: the slides fill the screen, the arrows move through them, N shows the notes, Esc ends it', n1 === '1 of 6' && n2 === '2 of 6' && notesShown && notesText === 'Say the result first.' && !(await a.$('.sl-show')), [n1, n2, notesText]);
  const PPTX = await download(a, 'Download as PowerPoint', 'talk.pptx');
  check('the PowerPoint file: every part well formed and in its place', pkg(PPTX) === 'OK', pkg(PPTX));
  r = await a.evaluate(async b => { const d = await App.OOXML.deckFromPptx(App.OOXML.unb64(b).buffer); return { n: d.slides.length, t0: App.OOXML.slideText(d.slides[0].items[0].html), notes: d.slides[0].notes, theme: d.theme, img: d.slides[0].items.some(i => i.type === 'image'), lvl: /data-lvl="1"/.test(d.slides[0].items[1].html) }; }, b64(PPTX));
  check('it reads back as it was: the slides, the title, the levels, the picture, the notes, the theme', r.n === 6 && r.t0 === 'Results' && r.lvl && r.img && r.notes === 'Say the result first.' && r.theme === 'night', r);
  if (PYX) { const o = pyx(`import sys, pptx\np = pptx.Presentation(sys.argv[1])\nprint(len(p.slides), '|', p.slides[0].shapes[0].text_frame.text, '|', p.slides[0].notes_slide.notes_text_frame.text, '|', p.slide_width)`, PPTX); check('python-pptx opens it: six 16:9 slides, the title, the notes', o === '6 | Results | Say the result first. | 12192000', o); }
  if (SOFFICE) check('LibreOffice opens it: a page a slide', pdfPages(PPTX) === 6);
  await go(a, '#/decks', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'ppt-python.pptx')); await a.waitForSelector('#sl-stage .sl-it', { timeout: 15000 }); await a.waitForTimeout(500);
  deck = (await fileOf(a, await idNow(a))).body;
  check('a PowerPoint file from python-pptx opens: the 4:3 slides centred, titles and bullets from the layouts, a second level, the notes', deck.slides.length === 2 && /Python title/.test(deck.slides[0].items[0].html) && deck.slides[0].items[0].role === 'title' && deck.slides[1].items[1].role === 'body' && /data-list="bullet"/.test(deck.slides[1].items[1].html) && /data-lvl="1"/.test(deck.slides[1].items[1].html) && deck.slides[1].notes === 'Speaker notes here' && Math.round(deck.slides[0].items[0].x) === 174, deck.slides.map(s => s.items.map(i => [i.role, Math.round(i.x), i.html.slice(0, 60)])));
  await go(a, '#/decks', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'ppt-libreoffice.pptx')); await a.waitForSelector('#sl-stage .sl-it', { timeout: 15000 }); await a.waitForTimeout(400);
  check('and one saved by LibreOffice', (await fileOf(a, await idNow(a))).body.slides.length === 2);

  // ---------------- Sheets ----------------
  await go(a, '#/sheets', 1200); await a.click('.of-tpl[data-t="blank"]'); await a.waitForSelector('#sh-scroll td', { timeout: 15000 }); await a.waitForTimeout(400);
  const bookId = await idNow(a); const cellTxt = (r, c) => a.$eval(`#sh-${r}-${c}`, e => e.textContent).catch(() => null);
  const pick = async (r, c) => { await a.click(`#sh-${r}-${c}`); };
  await pick(0, 0); for (const v of ['1', '2', '3', '=sum(a1:a3']) { await a.keyboard.type(v); await a.keyboard.press('Enter'); }
  check('typing numbers and a formula; Enter goes down; the formula is tidied (capitals, the bracket closed)', (await cellTxt(3, 0)) === '6' && await saved(a) && (await fileOf(a, bookId)).body.sheets[0].cells.A4.v === '=SUM(A1:A3)');
  await pick(3, 0); check('the formula bar shows the formula, the box the cell', (await a.$eval('#sh-input', i => i.value)) === '=SUM(A1:A3)' && (await a.$eval('#sh-name', i => i.value)) === 'A4');
  await pick(0, 0); await a.keyboard.press('F2'); await a.keyboard.press('Backspace'); await a.keyboard.type('5'); await a.keyboard.press('Enter');
  check('F2 edits a cell; what depends on it is worked out again', (await cellTxt(3, 0)) === '10');
  await pick(0, 1); for (const v of ['0.25', '2026-10-26', "'007", '=1/0', '$1,234.5', 'TRUE']) { await a.keyboard.type(v); await a.keyboard.press('Enter'); }
  await pick(0, 1); await a.selectOption('[data-c="fmt"]', 'pct');
  check('formats: a percent, a date, text kept as typed, an error, money, true', (await cellTxt(0, 1)) === '25%' && (await cellTxt(1, 1)) === '2026-10-26' && (await cellTxt(2, 1)) === '007' && (await cellTxt(3, 1)) === '#DIV/0!' && (await cellTxt(4, 1)) === '$1,234.50' && (await cellTxt(5, 1)) === 'TRUE', [await cellTxt(0, 1), await cellTxt(1, 1), await cellTxt(2, 1), await cellTxt(3, 1), await cellTxt(4, 1)]);
  check('numbers to the right, text to the left, TRUE and errors in the middle', await a.$eval('#sh-1-1 .sh-v', e => e.classList.contains('a-r')) && await a.$eval('#sh-2-1 .sh-v', e => e.classList.contains('a-l')) && await a.$eval('#sh-3-1 .sh-v', e => e.classList.contains('a-c')));
  await pick(0, 1); await a.keyboard.press('Control+b'); check('Ctrl+B', await a.$eval('#sh-0-1 .sh-v', e => e.classList.contains('b')));
  await pick(3, 0); await a.focus('#sh-scroll'); let cpy = await clip(a, 'copy');
  check('copying a cell gives Excel its value as text and as a table', cpy['text/plain'] === '10' && /<table>/.test(cpy['text/html'] || ''), cpy);
  await pick(3, 2); await a.focus('#sh-scroll'); await clip(a, 'paste', cpy); await a.waitForTimeout(200);
  await saved(a); check('pasting it here moves the formula’s cells along, as Excel does', ((await fileOf(a, bookId)).body.sheets[0].cells.C4 || {}).v === '=SUM(C1:C3)');
  await pick(0, 7); await a.focus('#sh-scroll'); await clip(a, 'paste', { 'text/plain': 'Name\tScore\r\nCy\t70\r\nAl\t90\r\n"Bo, Jr."\t80\r\n' }); await a.waitForTimeout(200);
  check('pasting a table copied from Excel or Google Sheets (tabs, quotes)', (await cellTxt(0, 7)) === 'Name' && (await cellTxt(3, 7)) === 'Bo, Jr.' && (await cellTxt(2, 8)) === '90');
  await pick(1, 7); await a.click('[data-c="sort"]'); await a.click('.of-menu-i:has-text("Sort A")'); await a.waitForTimeout(300);
  check('Sort A → Z keeps the header row where it is', (await cellTxt(0, 7)) === 'Name' && (await cellTxt(1, 7)) === 'Al' && (await cellTxt(2, 7)) === 'Bo, Jr.' && (await cellTxt(3, 7)) === 'Cy' && (await cellTxt(1, 8)) === '90' && /row 1 kept as the header/.test(await txt(a, '.toast')), [await cellTxt(0, 7), await cellTxt(1, 7), await txt(a, '.toast')]);
  await pick(4, 8); await a.keyboard.press('Alt+='); await a.keyboard.press('Enter'); await a.waitForTimeout(200);
  await saved(a); check('AutoSum adds up the numbers above', (await cellTxt(4, 8)) === '240' && ((await fileOf(a, bookId)).body.sheets[0].cells.I5 || {}).v === '=SUM(I2:I4)');
  await pick(0, 11); await a.keyboard.type('1'); await a.keyboard.press('Enter'); await a.keyboard.type('2'); await a.keyboard.press('Enter');
  await pick(0, 11); await a.click('#sh-1-11', { modifiers: ['Shift'] });
  { const h = await a.$('#sh-fill'); const hb = await h.boundingBox(); const tb = await (await a.$('#sh-4-11')).boundingBox(); await a.mouse.move(hb.x + 4, hb.y + 4); await a.mouse.down(); await a.mouse.move(tb.x + 10, tb.y + 10, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(300); }
  check('dragging the fill handle counts on: 1, 2 → 3, 4, 5', (await cellTxt(2, 11)) === '3' && (await cellTxt(4, 11)) === '5', [await cellTxt(2, 11), await cellTxt(4, 11)]);
  await pick(0, 0); await a.click('[data-c="rows"]'); await a.click('.of-menu-i:has-text("Insert a row above")'); await a.waitForTimeout(300); await saved(a);
  let book = (await fileOf(a, bookId)).body.sheets[0].cells;
  check('inserting a row moves the cells down and every formula follows', book.A5.v === '=SUM(A2:A4)' && (await cellTxt(4, 0)) === '10' && book.C5.v === '=SUM(C2:C4)');
  await pick(0, 0); await a.click('[data-c="rows"]'); await a.click('.of-menu-i:has-text("Delete the rows")'); await a.waitForTimeout(300);
  check('and deleting it moves them back', (await cellTxt(3, 0)) === '10' && (await saved(a)) && (await fileOf(a, bookId)).body.sheets[0].cells.A4.v === '=SUM(A1:A3)');
  await pick(9, 0); await a.keyboard.type('oops'); await a.keyboard.press('Enter'); await a.focus('#sh-scroll'); await a.keyboard.press('Control+z'); await a.waitForTimeout(200);
  check('Ctrl+Z takes a cell back', (await cellTxt(9, 0)) === '');
  await pick(0, 7); await a.click('#sh-3-8', { modifiers: ['Shift'] }); await a.click('[data-c="chart"]'); await a.click('.of-menu-i:has-text("Column")'); await a.waitForSelector('.of-dlg');
  await a.fill('.of-dlg input[name="title"]', 'Scores'); await a.click('.of-dlg [type="submit"]'); await a.waitForTimeout(400);
  check('a chart of the cells chosen, drawn over the sheet and described for screen readers', !!(await a.$('.sh-chart svg rect[fill="#2f6fde"]')) && /Scores: column chart of Score, 3 points, from H1:I4/.test(await a.$eval('.sh-chart', e => e.getAttribute('aria-label'))));
  await a.click('#sh-addsheet'); await a.waitForTimeout(300); await pick(0, 0); await a.keyboard.type('=Sheet1!A4*2'); await a.keyboard.press('Enter');
  check('a second sheet, and a formula reading the first', (await a.$$('.sh-tab')).length === 2 && (await cellTxt(0, 0)) === '20');
  await a.dblclick('.sh-tab[data-i="0"]'); await a.waitForSelector('.of-dlg'); await a.fill('.of-dlg input', 'Lab data'); await a.click('.of-dlg [type="submit"]'); await a.waitForTimeout(400); await saved(a);
  book = (await fileOf(a, bookId)).body;
  await a.click('.sh-tab[data-i="1"]'); await a.waitForTimeout(200);
  check('renaming a sheet rewrites the formulas that use it', book.sheets[0].name === 'Lab data' && book.sheets[1].cells.A1.v === "='Lab data'!A4*2" && (await cellTxt(0, 0)) === '20', [book.sheets[0].name, book.sheets[1].cells, await cellTxt(0, 0)]);
  await a.click('.sh-tab[data-i="0"]'); await a.waitForTimeout(300); await a.click('[data-c="freeze"]'); await saved(a);
  check('freezing the top row', (await fileOf(a, bookId)).body.sheets[0].freeze === 1 && !!(await a.$('#sh-tbl tr.sh-frz')));
  const XLSX = await download(a, 'Download as Excel', 'lab.xlsx');
  check('the Excel file: every part well formed and in its place, the chart too', pkg(XLSX) === 'OK' && /<c:barChart>/.test(part(XLSX, 'xl/charts/chart1.xml')), pkg(XLSX));
  r = await a.evaluate(async b => { const k = await App.OOXML.bookFromXlsx(App.OOXML.unb64(b).buffer); const s = k.sheets[0]; return { names: k.sheets.map(x => x.name), a4: s.cells.A4.v, b1: s.cells.B1, b2: s.cells.B2.s, b3: s.cells.B3.v, s2: k.sheets[1].cells.A1.v, freeze: s.freeze, chart: s.charts && s.charts[0] && [s.charts[0].type, s.charts[0].range, s.charts[0].title] }; }, b64(XLSX));
  check('it reads back as it was: formulas, formats, bold, text kept, the second sheet, the frozen row, the chart', r.names.join() === 'Lab data,Sheet2' && r.a4 === '=SUM(A1:A3)' && r.b1.s.fmt === 'pct' && r.b1.s.b === true && r.b2.fmt === 'date' && r.b3 === "'007" && r.s2 === "='Lab data'!A4*2" && r.freeze === 1 && r.chart.join() === 'column,H1:I4,Scores', r);
  if (PYX) { const o = pyx(`import sys, openpyxl\nw = openpyxl.load_workbook(sys.argv[1]); v = openpyxl.load_workbook(sys.argv[1], data_only=True)\ns = w['Lab data']\nprint(s['A4'].value, '|', v['Lab data']['A4'].value, '|', s['B1'].number_format, '|', s.freeze_panes, '|', len(s._charts), '|', w['Sheet2']['A1'].value)`, XLSX); check('openpyxl opens it: the formula and its value, the format, the frozen row, the chart', o === "=SUM(A1:A3) | 10 | 0% | A2 | 1 | ='Lab data'!A4*2", o); }
  if (SOFFICE) check('LibreOffice opens it', pdfPages(XLSX) >= 1);
  const CSV = await download(a, 'Download this sheet as CSV', 'lab.csv'); const csv = fs.readFileSync(CSV, 'utf8');
  check('CSV: the sheet as it shows, quoted where it must be', /^﻿?5,25%,/.test(csv) && /"Bo, Jr\."/.test(csv) && /\r\n/.test(csv), csv.slice(0, 120));
  await go(a, '#/sheets', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'excel-python.xlsx')); await a.waitForSelector('#sh-scroll td', { timeout: 15000 }); await a.waitForTimeout(400);
  book = (await fileOf(a, await idNow(a))).body;
  check('an Excel file from openpyxl opens: sheets, values, formats, widths, the frozen row, bold blue text', book.sheets.map(s => s.name).join() === 'Grades,Other' && book.sheets[0].cells.D2.v === '=AVERAGE(B2:B3)' && book.sheets[0].cells.B2.s.fmt === 'num' && book.sheets[0].cells.C2.s.fmt === 'date' && book.sheets[0].cells.E2.s.fmt === 'pct' && book.sheets[0].cols[0] === 145 && book.sheets[0].freeze === 1 && book.sheets[0].cells.A2.s.b && book.sheets[0].cells.A2.s.color === '#0000ff' && (await cellTxt(1, 3)) === '84.75' && (await cellTxt(1, 2)) === '2026-10-26', book.sheets[0]);
  await go(a, '#/sheets', 1200); await a.setInputFiles('#of-file', path.join(FIX, 'excel-shared-1904.xlsx')); await a.waitForSelector('#sh-scroll td', { timeout: 15000 }); await a.waitForTimeout(400);
  check('it opens on the sheet that was showing in Excel, and its formulas read the other sheet', (await a.$eval('.sh-tab.on', e => e.textContent)) === "Sum's & more" && (await cellTxt(0, 0)) === '5.51' && (await cellTxt(2, 0)) === 'big' && (await cellTxt(3, 0)) === '1.55' && (await cellTxt(4, 0)) === '3.142', [await a.$eval('.sh-tab.on', e => e.textContent), await cellTxt(0, 0), await cellTxt(2, 0), await cellTxt(3, 0), await cellTxt(4, 0)]);
  await a.click('.sh-tab[data-i="0"]'); await a.waitForTimeout(300);
  book = (await fileOf(a, await idNow(a))).body.sheets[0].cells;
  check('shared formulas are written out for each cell, and 1904 dates moved to the usual day numbers', book.D3.v === '=A3*2+$B$2' && book.D5.v === '=A5*2+$B$2' && book.B12.v === '47783' && (await cellTxt(2, 3)) === '1.7', [book.D3, book.D5, book.B12, await cellTxt(2, 3)]);
  const CSVIN = path.join(OUT, 'grades.csv'); fs.writeFileSync(CSVIN, 'Name;Score;Note\r\nAnn;91,5;"said ""hi""; then left"\r\nZoe;007;=1+1\r\n');
  await go(a, '#/sheets', 1200); await a.setInputFiles('#of-file', CSVIN); await a.waitForSelector('#sh-scroll td', { timeout: 15000 }); await a.waitForTimeout(400);
  book = (await fileOf(a, await idNow(a))).body.sheets[0].cells;
  check('a CSV opens (semicolons found, quotes read), and nothing in it becomes a formula or loses its zeros', book.C2.v === 'said "hi"; then left' && book.B3.v === "'007" && book.C3.v === "'=1+1" && (await cellTxt(2, 2)) === '=1+1');
  // a long sheet stays quick: only the rows in view are drawn
  const big = {}; for (let i = 0; i < 3000; i++) big['A' + (i + 1)] = { v: String(i + 1) }; big.B1 = { v: '=SUM(A1:A3000)' };
  r = await api(a, 'office_save', { kind: 'sheet', title: 'Long', body: { sheets: [{ name: 'S', cells: big }] } }); await go(a, '#/sheets/' + r.json.file.id, 2000);
  const drawn = (await a.$$('#sh-tbl tr[data-r]')).length; await a.focus('#sh-scroll'); await a.keyboard.press('Control+End'); await a.waitForTimeout(400);
  check('a sheet of 3,000 rows draws only the rows in view, and Ctrl+End goes to the last', drawn < 120 && (await a.$eval('#sh-name', i => i.value)) === 'B3000' && (await cellTxt(0, 1)) === null && (await cellTxt(2999, 0)) === '3000', drawn);
  await a.keyboard.press('Control+Home'); await a.waitForTimeout(300); check('the formula over all of it, and Ctrl+Home goes back to A1', (await cellTxt(0, 1)) === '4501500' && (await a.$eval('#sh-name', i => i.value)) === 'A1', await cellTxt(0, 1));

  // ---------------- accessibility, phones, the menu ----------------
  const axe = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8'); const serious = [];
  const [cx, x] = await mk(1360, 900, { bypassCSP: true, serviceWorkers: 'block' }); await x.addInitScript(setup); await go(x, '#/', 500); await login(x, 'alice.a@montana.edu'); await x.reload(); await x.waitForTimeout(800);
  for (const [hash, name] of [['#/docs', 'docs list'], [`#/docs/${docId}`, 'docs editor'], ['#/decks', 'slides list'], [`#/decks/${deckId}`, 'slides editor'], ['#/sheets', 'sheets list'], [`#/sheets/${bookId}`, 'sheets editor']]) {
    await go(x, hash, 2000); await x.addScriptTag({ content: axe });
    const v = await x.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, s: v.nodes.slice(0, 2).map(n => n.html.slice(0, 120)) })));
    log(name.padEnd(14), v.length ? v.map(z => `${z.impact[0]}:${z.id}(${z.n})`).join(' ') : 'clean');
    v.filter(z => z.impact === 'serious' || z.impact === 'critical').forEach(z => serious.push(`${name}: ${z.id} ${z.s.join(' | ')}`));
  }
  check('no serious accessibility problems on the lists or in the editors', !serious.length, serious);
  await cx.close();
  const [cphone, ph2] = await open('alice.a@montana.edu', 390, 844);
  const wide = [];
  for (const hash of ['#/docs', `#/docs/${docId}`, `#/decks/${deckId}`, `#/sheets/${bookId}`]) { await go(ph2, hash, 1800); if (!(await hscroll(ph2))) wide.push(hash + ' ' + await ph2.evaluate(() => { const W = document.documentElement.clientWidth; const out = []; for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); if (b.right <= W + 1 || !b.width) continue; let q = e.parentElement, clip = false; while (q && q !== document.body) { if (getComputedStyle(q).overflowX !== 'visible') { clip = true; break; } q = q.parentElement; } if (!clip) out.push((e.id ? '#' + e.id : e.tagName) + '.' + String(e.className).replace(/ /g, '.') + ' ' + Math.round(b.right)); } return out.slice(0, 6).join(', '); })); }
  check('on a phone the pages do not scroll sideways', !wide.length, wide);
  await cphone.close();
  // in Spanish no English is left on the lists or in the editors (the person's own words aside)
  { const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'catalog.json'), 'utf8')).filter(e => !e.gone);
    const es = new Map(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'es.tsv'), 'utf8').split('\n').filter(l => l && l[0] !== '#').map(l => { const i = l.indexOf('\t'); return [+l.slice(0, i), l.slice(i + 1)]; }));
    const EN = cat.filter(e => es.has(e.id) && es.get(e.id) !== e.en && !/\{\d\}/.test(e.en)).map(e => e.en);
    const [ce, e] = await mk(1360, 900, { serviceWorkers: 'block' }); await ce.addInitScript(setup); await ce.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.lang = 'es'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (x) {} });
    await go(e, '#/', 500); await login(e, 'alice.a@montana.edu'); await e.reload(); await e.waitForTimeout(800);
    const left = [];
    for (const hash of ['#/docs', '#/decks', '#/sheets', `#/docs/${docId}`, `#/decks/${deckId}`, `#/sheets/${bookId}`]) {
      await go(e, hash, 2000);
      const found = await e.evaluate(EN => { const S = new Set(EN), out = new Set(), v = document.querySelector('#view'); const skip = el => el.closest('[translate="no"], [contenteditable="true"], [hidden]');
        const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const x = n.nodeValue.replace(/\s+/g, ' ').trim(); if (x && S.has(x) && !skip(n.parentElement)) out.add(x); }
        for (const el of v.querySelectorAll('[title], [aria-label], [placeholder]')) { if (skip(el)) continue; for (const at of ['title', 'aria-label', 'placeholder']) { const x = (el.getAttribute(at) || '').trim(); if (x && S.has(x)) out.add(at + ': ' + x); } }
        return [...out]; }, EN);
      found.forEach(f => left.push(hash + ' ' + f));
    }
    check('in Spanish, nothing on the lists or in the editors is left in English', !left.length, left);
    await ce.close(); }
  await go(a, '#/', 1000); check('the sidebar has Docs, Slides and Sheets', !!(await a.$('.sb-item[href="#/docs"]')) && !!(await a.$('.sb-item[href="#/decks"]')) && !!(await a.$('.sb-item[href="#/sheets"]')));

  sql('DELETE FROM office_files WHERE user_id = ?', alice);
  await cb.close(); await ca.close(); await T.finish();
})();
