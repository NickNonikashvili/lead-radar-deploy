/* The writer's notebook (assets/notebook.js, api/notebook.php; WRIT 101's fifteen entries in assets/writ-data.js).
   Covered: the routes (members only, a class with a notebook, entries in range, not too long, kept apart per student,
   two devices: a save on an entry changed elsewhere is refused with the saved one); the page (the list with this
   week's entries, the editor opening on this week's first empty one, saving as she types with the word count, a
   reflection entry's link to the revision history, offline and back, a copy never confirmed going up when the page
   opens again, a conflict with another device and choosing a version, Word, text and print for handing in, a phone,
   members only, no floating Bo), and the class pack checks for DRAFTS and NOTEBOOK. */
const T = require('./lib'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const sql = (q, ...a) => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const ALICE = 'alice.a@montana.edu', BOB = 'bob.bmu6j92pq@montana.edu';
(async () => {
  const { mk, go, txt, login, api: raw, hscroll, check } = await T.start();
  const api = async (...a) => { const r = await raw(...a); return Object.assign(r.json || {}, { status: r.status }); };
  const clean = () => { try { sql(`DELETE FROM notebook_entries WHERE user_id IN (SELECT id FROM users WHERE email IN ('${ALICE}', '${BOB}'))`); } catch (e) {} sql("DELETE FROM rate WHERE key LIKE 'notebook:%'"); };
  const setup = asof => new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['writ', 'calc']; s.boFloatSeen = 1; s.asof = '${asof}'; s.lang = 'en'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  const open = async (email, w = 1360, h = 900) => { const [c, p] = await mk(w, h, { serviceWorkers: 'block' }); await c.addInitScript(setup('2026-10-30')); await go(p, '#/', 600); if (email) { await login(p, email); await p.reload(); await p.waitForTimeout(900); } return [c, p]; };
  const saved = async (p, n) => ((await api(p, 'notebook_list&class=writ')).entries || []).find(e => e.n === n) || null;
  clean();

  /* ---------- the routes ---------- */
  const [cg, g] = await open(null);
  check('signed out, there is no notebook', (await api(g, 'notebook_list&class=writ')).status === 401);
  await cg.close();
  const [ca, a] = await open(ALICE);
  let r = await api(a, 'notebook_list&class=writ');
  check('her notebook in WRIT 101: fifteen entries, none written', r.ok && r.count === 15 && r.entries.length === 0, r);
  check('a class without a notebook has none', (await api(a, 'notebook_list&class=calc')).status === 404);
  r = await api(a, 'notebook_save', { class: 'writ', n: 1, prompt: 'Get outside.', text: 'The river\r\nwas loud\u0007 that spring.' });
  check('an entry is saved with its prompt and word count (line ends and control characters cleaned)', r.ok && r.entry.n === 1 && r.entry.text === 'The river\nwas loud that spring.' && r.entry.words === 6 && r.entry.prompt === 'Get outside.' && r.entry.updated > 0, r);
  check('entries are 1 to 15', (await api(a, 'notebook_save', { class: 'writ', n: 16, text: 'x' })).status === 400 && (await api(a, 'notebook_save', { class: 'writ', n: 0, text: 'x' })).status === 400);
  check('an entry of more than about 7,000 words is too long to keep', (await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'a'.repeat(40001) })).status === 413);
  /* two devices */
  const A = 'laptop000001', P = 'phone0000001';
  let s1 = await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'Written on the laptop.', base: 0, dev: A });
  r = await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'Written on the phone, offline.', base: 0, dev: P });
  check('another device’s save on an entry changed since its copy is refused (409), with the saved entry', s1.ok && r.status === 409 && r.conflict === true && r.entry.text === 'Written on the laptop.', r);
  r = await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'Written on the phone, after seeing the laptop’s.', base: s1.entry.updated, dev: P });
  check('written on the saved version, it is taken', r.ok && r.entry.updated > s1.entry.updated, r);
  const s2 = r;
  check('the laptop’s copy is now behind: refused', (await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'More from the laptop.', base: s1.entry.updated, dev: A })).status === 409);
  check('the same device saving again on an older version is its own: taken', (await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'More from the phone.', base: s1.entry.updated, dev: P })).ok);
  check('and a copy the same as the saved one is never a conflict', (await api(a, 'notebook_save', { class: 'writ', n: 2, text: 'More from the phone.', base: s2.entry.updated - 5, dev: A })).ok);
  r = await api(a, 'notebook_delete', { class: 'writ', n: 2 });
  check('an entry can be deleted', r.ok && r.deleted === 1 && (await api(a, 'notebook_list&class=writ')).entries.map(e => e.n).join() === '1');
  const [cb, b] = await open(BOB);
  check('private: another student sees only their own', (await api(b, 'notebook_list&class=writ')).entries.length === 0);
  await cb.close();
  clean();

  /* ---------- the page ---------- */
  await go(a, '#/writ/dashboard', 1400);
  check('WRIT 101’s sidebar has the writer’s notebook', await a.evaluate(() => [...document.querySelectorAll('#sidebar-nav [data-view]')].some(x => /Writer’s notebook/.test(x.textContent) && /notebook$/.test(x.dataset.view))));
  check('the writing dashboard links to it', await a.evaluate(() => [...document.querySelectorAll('#view a')].some(x => /#\/writ\/notebook$/.test(x.getAttribute('href') || ''))));
  await go(a, '#/writ/notebook', 1600);
  const first = await a.evaluate(() => ({ items: document.querySelectorAll('.nb-item').length, now: [...document.querySelectorAll('.nb-item.now')].map(x => x.getAttribute('href').split('/').pop()).join(), cur: (document.querySelector('.nb-item.cur') || {}).textContent, eyebrow: (document.querySelector('.nb-ed .eyebrow') || {}).textContent, sum: document.querySelector('.nb-sum-row').textContent, fab: !!document.querySelector('#bo-fab:not([hidden])') }));
  check('the list of fifteen, this week’s marked, and the editor open on this week’s first empty entry', first.items === 15 && first.now === '12' && /12/.test(first.cur) && first.eyebrow === 'Notebook 12 · Week 10: Project 3: remixing for a public audience', first);
  check('what is written so far, and when it is handed in', first.sum === '0 of 15 written · 0 words · hand in all of them with Portfolio draft and final notebook, Week of Dec 7 (day TBD)', first.sum);
  check('private, no AI: the floating Bo is not on this page', first.fab === false);
  await a.click('#nb-text'); await a.keyboard.type('The bridge hums in January.\n\nIce on the rail.');
  check('the words are counted as she types', (await txt(a, '#nb-words')) === '9 words' && /Editing/.test(await txt(a, '#nb-state')));
  await a.waitForFunction(() => document.querySelector('#nb-state').textContent === 'Saved', null, { timeout: 8000 }).catch(() => {});
  r = await saved(a, 12);
  check('and saved as she goes', r && r.text === 'The bridge hums in January.\n\nIce on the rail.' && r.words === 9 && (await txt(a, '#nb-state')) === 'Saved', r);
  check('the list shows it written', await a.evaluate(() => { const i = document.querySelector('.nb-item[href$="/notebook/12"]'); return i.classList.contains('has') && /9 words/.test(i.textContent) && /1 of 15 written · 9 words/.test(document.querySelector('#nb-sum').textContent); }));
  await a.fill('#nb-prompt', 'Write about a place where you go to think.'); await a.waitForTimeout(1500);
  check('the prompt she copies in is kept with the entry', (await saved(a, 12)).prompt === 'Write about a place where you go to think.');
  await a.reload(); await a.waitForTimeout(1600);
  check('after a reload: the entry and its prompt', (await a.inputValue('#nb-text')) === 'The bridge hums in January.\n\nIce on the rail.' && (await a.inputValue('#nb-prompt')) === 'Write about a place where you go to think.' && (await txt(a, '#nb-state')) === 'Saved');

  /* offline and back */
  await ca.setOffline(true);
  await a.click('#nb-text'); await a.keyboard.press('End'); await a.keyboard.type(' The water is black.');
  await a.waitForFunction(() => /Offline/.test(document.querySelector('#nb-state').textContent), null, { timeout: 8000 }).catch(() => {});
  check('offline: it says the words are kept on this device', /Offline: kept on this device, saved when you are back/.test(await txt(a, '#nb-state')) && await a.evaluate(() => /The water is black\./.test(localStorage.getItem('mathub-notebook-writ'))));
  await ca.setOffline(false);
  await a.waitForFunction(() => document.querySelector('#nb-state').textContent === 'Saved', null, { timeout: 8000 }).catch(() => {});
  check('back online, they are saved at once', /The water is black\.$/.test((await saved(a, 12)).text) && await a.evaluate(() => !localStorage.getItem('mathub-notebook-writ')));

  /* the tab closed before the server had it: the copy on this device goes up when the notebook opens again */
  let block = false; await a.route('**/api/index.php?r=notebook_save*', rt => block ? rt.abort() : rt.continue());
  block = true;
  await a.click('#nb-text'); await a.keyboard.press('End'); await a.keyboard.type(' Nobody else is up.');
  await a.waitForTimeout(1300);
  await a.reload({ waitUntil: 'commit' }); block = false;
  await a.waitForFunction(() => document.querySelector('#nb-state') && document.querySelector('#nb-state').textContent === 'Saved', null, { timeout: 10000 }).catch(() => {});
  check('a copy the server never confirmed is saved when the notebook opens again', /Nobody else is up\.$/.test((await saved(a, 12)).text) && /Nobody else is up\.$/.test(await a.inputValue('#nb-text')));
  await a.unroute('**/api/index.php?r=notebook_save*');

  /* another device writes the same entry while this page has it open */
  let cur = await saved(a, 12);
  r = await api(a, 'notebook_save', { class: 'writ', n: 12, prompt: cur.prompt, text: 'Rewritten on my phone.', base: cur.updated, dev: 'phone0000002' });
  await a.click('#nb-text'); await a.keyboard.press('End'); await a.keyboard.type(' And the laptop goes on.');
  await a.waitForSelector('.nb-conflict', { timeout: 8000 }).catch(() => {});
  const conf = await a.evaluate(() => ({ note: (document.querySelector('.nb-conflict') || {}).textContent || '', text: document.querySelector('#nb-text').value }));
  check('this page’s next save is not written over it: the saved one shows, with a note and a choice', r.ok && /changed on another device, so what you typed here/.test(conf.note) && conf.text === 'Rewritten on my phone.' && (await saved(a, 12)).text === 'Rewritten on my phone.', conf);
  await a.reload(); await a.waitForTimeout(1600);
  check('the choice waits after a reload', !!(await a.$('.nb-conflict [data-action="nb-use-local"]')));
  await a.click('[data-action="nb-use-local"]');
  await a.waitForFunction(() => !document.querySelector('.nb-conflict') && document.querySelector('#nb-state').textContent === 'Saved', null, { timeout: 8000 }).catch(() => {});
  check('Use this device’s version: it becomes the entry, saved', /And the laptop goes on\.$/.test(await a.inputValue('#nb-text')) && /And the laptop goes on\.$/.test((await saved(a, 12)).text) && await a.evaluate(() => !localStorage.getItem('mathub-notebook-conflicts-writ')));
  cur = await saved(a, 12);
  await api(a, 'notebook_save', { class: 'writ', n: 12, prompt: cur.prompt, text: 'The phone again.', base: cur.updated, dev: 'phone0000002' });
  await a.click('#nb-text'); await a.keyboard.press('End'); await a.keyboard.type(' x');
  await a.waitForSelector('.nb-conflict', { timeout: 8000 }).catch(() => {});
  await a.click('[data-action="nb-keep-saved"]'); await a.waitForTimeout(1200);
  check('Keep the saved one: the note goes, the saved one stays', !(await a.$('.nb-conflict')) && (await a.inputValue('#nb-text')) === 'The phone again.' && (await saved(a, 12)).text === 'The phone again.');

  /* other entries */
  await a.click('.nb-step a[href$="/notebook/13"]'); await a.waitForTimeout(900);
  check('the next entry is a step away', /#\/writ\/notebook\/13$/.test(a.url()) && /Notebook 13/.test(await txt(a, '.nb-ed .eyebrow')));
  await go(a, '#/writ/notebook/1', 1400);
  check('an entry the class data gives a prompt for starts with it', (await a.inputValue('#nb-prompt')) === 'Get outside and write about what you notice. The full prompt is on Canvas.' && /“Get Out\(side\)”/.test(await txt(a, '.nb-title')));
  await a.fill('#nb-text', 'Outside the library the wind does what it wants. I stood there for a while and listened.'); await a.waitForTimeout(1600);
  await go(a, '#/writ/notebook/5', 1400);
  check('a reflection entry links to the project’s revision history', await a.evaluate(() => { const l = document.querySelector('.nb-reflect a'); return !!l && /#\/writ\/draft-history\/p1$/.test(l.getAttribute('href')) && /Project 1/.test(document.querySelector('.nb-reflect').textContent); }) && (await txt(a, '.nb-title')) === 'Project 1 reflection');

  /* handing it in: Word, text, print */
  const [dl] = await Promise.all([a.waitForEvent('download', { timeout: 10000 }), a.click('[data-action="nb-word"]')]);
  const docPath = await dl.path(); const unz = n => require('child_process').execFileSync('unzip', ['-p', docPath, n]).toString();
  const docXml = unz('word/document.xml'); const docTxt = docXml.replace(/<w:br w:type="page"\/>/g, '\n[page]\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').trim();
  const wellFormed = require('child_process').spawnSync('python3', ['-I', '-c', 'import sys, zipfile, xml.dom.minidom as m\nz = zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\n[m.parseString(z.read(n)) for n in z.namelist()]\nprint("ok")', docPath]).stdout.toString().trim();
  check('Word: the written entries in order, each on its own page, with its prompt, double-spaced', dl.suggestedFilename() === 'WRIT 101 writer\'s notebook.docx' && wellFormed === 'ok' && docTxt.split('\n').filter(Boolean).join('|') === 'Writer’s notebook|Alice · WRIT 101 College Writing I · Fall 2026|Notebook 1: “Get Out(side)”|Get outside and write about what you notice. The full prompt is on Canvas.|Outside the library the wind does what it wants. I stood there for a while and listened.|[page]|Notebook 12|Write about a place where you go to think.|The phone again.' && /w:line="480"/.test(unz('word/styles.xml')), { name: dl.suggestedFilename(), wellFormed, docTxt });
  check('and it says how many are in it', /2 entries in the file; 13 still empty\./.test(await txt(a, '.toast')));
  const [dt] = await Promise.all([a.waitForEvent('download', { timeout: 10000 }), a.click('[data-action="nb-text"]')]);
  const plain = require('fs').readFileSync(await dt.path(), 'utf8');
  check('or plain text', dt.suggestedFilename() === 'WRIT 101 writer\'s notebook.txt' && plain === 'Writer’s notebook\nAlice · WRIT 101 College Writing I · Fall 2026\n\n\nNotebook 1: “Get Out(side)”\n(Get outside and write about what you notice. The full prompt is on Canvas.)\n\nOutside the library the wind does what it wants. I stood there for a while and listened.\n\n\nNotebook 12\n(Write about a place where you go to think.)\n\nThe phone again.\n', plain.slice(0, 300));
  await a.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printHtml = document.querySelector('#nb-print').innerHTML; window.__printClass = document.body.classList.contains('nb-printing'); window.dispatchEvent(new Event('afterprint')); }; });
  await a.click('[data-action="nb-print"]'); await a.waitForTimeout(300);
  check('or printed: just the written entries', await a.evaluate(() => window.__printed === 1 && window.__printClass && (window.__printHtml.match(/<section>/g) || []).length === 2 && /The phone again\./.test(window.__printHtml) && !document.body.classList.contains('nb-printing')));
  check('the page fits and has no errors', await hscroll(a));

  /* a phone: the list first, then one entry with a way back */
  const [cp, ph] = await open(ALICE, 390, 844);
  await go(ph, '#/writ/notebook', 1600);
  check('on a phone the notebook opens on the list', await ph.evaluate(() => !document.querySelector('.nb-wrap').classList.contains('editing') && document.querySelector('.nb-list').getBoundingClientRect().width > 300 && !document.querySelector('#nb-text')) && await hscroll(ph));
  await ph.click('.nb-item[href$="/notebook/12"]'); await ph.waitForTimeout(1200);
  check('an entry fills the screen, with All entries to go back', await ph.evaluate(() => document.querySelector('.nb-wrap').classList.contains('editing') && getComputedStyle(document.querySelector('.nb-list')).display === 'none' && document.querySelector('#nb-text').value === 'The phone again.' && !!document.querySelector('.nb-back')) && await hscroll(ph));
  await cp.close();

  /* members only; a class without a notebook has no page */
  const [cg2, g2] = await open(null);
  await go(g2, '#/writ/notebook', 1400);
  check('signed out: the notebook is for members', /The notebook is for members/.test(await txt(g2, '#view')) && !(await g2.$('#nb-text')));
  await go(g2, '#/calc/notebook', 1400);
  check('a class without a notebook goes to its dashboard, with no notebook in the sidebar', /#\/calc\/dashboard$/.test(g2.url()) && await g2.evaluate(() => ![...document.querySelectorAll('#sidebar-nav [data-view]')].some(x => /notebook$/.test(x.dataset.view))), g2.url());

  /* class packs: DRAFTS and NOTEBOOK are class data any writing class can have */
  const Packs = require('../assets/classpacks.js'); const pack = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'fixtures', 'zzp101.mathub.json'), 'utf8'));
  const run = x => { const r = Packs.validate(Object.assign(JSON.parse(JSON.stringify(pack)), x)); return { errors: r.errors.join(' | '), warnings: r.warnings.join(' | ') }; };
  const v = {
    ok: run({ DRAFTS: [{ id: 'e1', short: 'Essay 1', name: 'Essay 1: Explaining a finding', brief: 'Explain one finding for a general reader.', goals: ['A clear claim'] }], NOTEBOOK: { count: 10, entries: [{ n: 3, title: 'Essay 1 reflection', reflect: 'e1' }] } }),
    bad: run({ DRAFTS: [{ id: 'Essay One', name: 'One' }, { id: 'e2', name: '' }, { id: 'e3', name: 'Three', brief: 'b', goals: ['g'] }, { id: 'e3', name: 'Again', brief: 'b', goals: ['g'] }], NOTEBOOK: { count: 0 } })
  };
  check('a pack’s projects and notebook are checked: good ones pass', v.ok.errors === '' && !/Project|Notebook/.test(v.ok.warnings), v.ok);
  check('a bad id, a missing name, a repeated id and a notebook with no entries are errors; a project with no brief or goals is a warning', /DRAFTS\[0\] needs an id/.test(v.bad.errors) && /Project "e2" needs a name/.test(v.bad.errors) && /Project id "e3" is used twice/.test(v.bad.errors) && /"NOTEBOOK" needs a "count"/.test(v.bad.errors) && /Project "e2" has no "brief"/.test(v.bad.warnings), v.bad);
  await cg2.close();
  await ca.close();
  clean();
  await T.finish();
})();
