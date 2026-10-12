/* The iOS app's web side, in Chromium with a stand-in for Capacitor (the phone's native layer): app/www is built by
   app/scripts/build-www.js and opened from the test server. Checks that the app marks itself, keeps the website-only
   pieces out, opens other sites in the in-app browser, and that Create a class works end to end: copy the instructions,
   paste a messy AI answer, the repairs and the checks, the preview, adding the class, its file on the device, reopening
   it after a restart, deleting it; a cut-off answer and a broken one; the example class; reminders after permission;
   haptics on answers; nothing of this on the website. Account calls to https://mathub.space go to the test server. */
const T = require('./lib');
const { execFileSync } = require('child_process'); const path = require('path');
(async () => {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'app', 'scripts', 'build-www.js')], { stdio: 'inherit' });
  const { mk, go: goSite, txt, log, check, hscroll, base } = await T.start();
  const APP = base.replace(/index\.html$/, 'app/www/index.html');
  const go = async (p, hash, wait = 1200) => { await p.goto(APP + hash, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(wait); };

  /* a stand-in for Capacitor and its plugins; what the app asks of them is recorded in window.__cap */
  const fakeCapacitor = (platform = 'ios') => {
    const rec = window.__cap = { haptics: [], browser: [], shared: [], scheduled: [], cancelled: [], clipboard: sessionStorage.getItem('fake-clip') || '', perm: sessionStorage.getItem('fake-perm') || 'prompt', status: [], bars: [], channels: [], listeners: {}, minimized: 0 };
    const fsKey = p => 'fakefs:' + p;
    const ok = v => Promise.resolve(v);
    const Plugins = {
      Haptics: { notification: o => { rec.haptics.push('n:' + o.type); return ok(); }, impact: o => { rec.haptics.push('i:' + o.style); return ok(); }, selectionChanged: () => { rec.haptics.push('s'); return ok(); } },
      Clipboard: { write: o => { rec.clipboard = o.string; sessionStorage.setItem('fake-clip', o.string); return ok(); }, read: () => ok({ value: rec.clipboard, type: 'text/plain' }) },
      Share: { share: o => { rec.shared.push(o); return ok({}); } },
      Filesystem: {
        writeFile: o => { localStorage.setItem(fsKey(o.directory + '/' + o.path), o.data); return ok({ uri: 'file:///' + o.directory + '/' + o.path }); },
        readFile: o => { const v = localStorage.getItem(fsKey(o.directory + '/' + o.path)); return v == null ? Promise.reject(new Error('File does not exist.')) : ok({ data: v }); },
        deleteFile: o => { localStorage.removeItem(fsKey(o.directory + '/' + o.path)); return ok(); },
        readdir: o => { const pre = fsKey(o.directory + '/' + o.path + '/'); const files = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) files.push({ name: k.slice(pre.length) }); } return ok({ files }); }
      },
      LocalNotifications: {
        checkPermissions: () => ok({ display: rec.perm }), requestPermissions: () => { rec.perm = 'granted'; sessionStorage.setItem('fake-perm', 'granted'); return ok({ display: 'granted' }); },
        schedule: o => { rec.scheduled = rec.scheduled.concat(o.notifications); return ok({ notifications: o.notifications.map(n => ({ id: n.id })) }); },
        createChannel: o => { rec.channels.push(o); return ok(); },
        getPending: () => ok({ notifications: rec.scheduled.map(n => ({ id: n.id, extra: n.extra })) }),
        cancel: o => { const ids = o.notifications.map(n => n.id); rec.cancelled.push(...ids); rec.scheduled = rec.scheduled.filter(n => !ids.includes(n.id)); return ok(); },
        addListener: () => ok({ remove() {} })
      },
      Browser: { open: o => { rec.browser.push(o.url); return ok(); } },
      StatusBar: { setStyle: o => { rec.status.push(o.style); return ok(); } },
      SystemBars: { setStyle: o => { rec.bars.push(o.style); return ok(); } },
      App: { addListener: (ev, fn) => { (rec.listeners[ev] = rec.listeners[ev] || []).push(fn); return ok({ remove() {} }); }, minimizeApp: () => { rec.minimized++; return ok(); } }, SplashScreen: { hide: () => ok() }, Keyboard: {}
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform, getServerUrl: () => location.origin, Plugins, registerPlugin: n => Plugins[n] };
  };
  const mkApp = async (w = 390, h = 844, platform = 'ios') => {
    const [c, p] = await mk(w, h, { serviceWorkers: 'block' });
    await c.addInitScript(fakeCapacitor, platform);
    await c.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); }); });
    // the app's account calls go to https://mathub.space; here they go to the test server
    await c.route('https://mathub.space/**', async route => { const u = route.request().url().replace('https://mathub.space/', base.replace(/index\.html$/, '')); try { const r = await route.fetch({ url: u }); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
    return [c, p];
  };

  const [ca, p] = await mkApp();
  await go(p, '#/', 2200);
  const shell = await p.evaluate(() => ({ app: document.documentElement.dataset.app, native: !!(window.MATHUB_APP && window.MATHUB_APP.native), py: window.PYODIDE_URL, mj: (document.getElementById('MathJax-script') || {}).src || '', sw: 'serviceWorker' in navigator && !!navigator.serviceWorker.controller, faculty: (() => { const b = document.querySelector('.hero-faculty'); return b ? getComputedStyle(b).display : 'none'; })(), cta: !!document.querySelector('.mk-cta[href="#/create"]') }));
  check('the app marks itself and points Python at its own copy', shell.app === 'ios' && shell.native && shell.py === 'assets/pyodide/', shell);
  check('MathJax loads from inside the app, not from a CDN', /\/app\/www\/assets\/mathjax\/tex-svg\.js$/.test(shell.mj), shell.mj);
  check('the start page offers "Create a class" and not the website-only "For professors"', shell.cta && shell.faculty === 'none', shell);
  check('no sideways scroll on the start page at 390px', await hscroll(p));
  check('a strip covers the status bar area, above the top bar and below dialogs', await p.evaluate(() => { const s = document.querySelector('.app-statusbar'); if (!s) return false; const cs = getComputedStyle(s); return cs.position === 'fixed' && cs.display !== 'none' && +cs.zIndex > 50 && +cs.zIndex < 60; }));
  const fetched = await p.evaluate(async () => { const r = await fetch('api/index.php?r=config', { headers: { 'X-Requested-With': 'MatHub' } }); return r.url; });
  check('account calls go to https://mathub.space', /^https:\/\/mathub\.space\/api\/index\.php\?r=config/.test(fetched), fetched);

  // links to other sites open in the in-app browser and the app stays put
  await p.evaluate(() => { const a = document.createElement('a'); a.href = 'https://example.org/page'; a.id = 'ext'; a.textContent = 'x'; a.style.cssText = 'position:fixed;top:120px;left:10px;z-index:99999'; document.body.appendChild(a); const b = document.createElement('a'); b.href = 'learn/'; b.id = 'web'; b.textContent = 'y'; b.style.cssText = 'position:fixed;top:160px;left:10px;z-index:99999'; document.body.appendChild(b); });
  const before = p.url(); await p.click('#ext'); await p.click('#web'); await p.waitForTimeout(300);
  const br = await p.evaluate(() => window.__cap.browser);
  check('an outside link opens in the in-app browser', br[0] === 'https://example.org/page' && p.url() === before, br);
  check('a website-only page opens on mathub.space', br[1] === 'https://mathub.space/learn/', br);

  // Create a class: the instructions
  await go(p, '#/create', 1200);
  check('#/create opens with three steps', (await p.$$('.mk-step')).length === 3 && /Create a class/.test(await txt(p, '#view')));
  check('no sideways scroll on #/create at 390px', await hscroll(p));
  await p.click('[data-action="copy-prompt"]'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => window.__cap.clipboard);
  check('Copy instructions puts the full instructions on the clipboard', /mathub-class-pack/.test(clip) && /THE SYLLABUS:\s*$/.test(clip) && /about 60/.test(clip), clip.slice(0, 120));
  await p.click('[data-action="size"][data-size="short"]'); await p.click('[data-action="copy-prompt"]'); await p.waitForTimeout(200);
  check('"Shorter answer" asks for less', /about 25/.test(await p.evaluate(() => window.__cap.clipboard)));
  check('copying gives a haptic tap', (await p.evaluate(() => window.__cap.haptics)).includes('n:SUCCESS'));

  // a messy answer, as a chat AI writes it: text around it, a trailing comma, a missing unit, a "quiz" calendar row, flashcards with front/back, an exam without a date, a question as an object
  const messy = `Sure! Here is your Mathub class:\n\n\`\`\`json\n${JSON.stringify({
    format: 'mathub-class-pack', version: 1, id: 'chmy121', code: 'CHMY 121', name: 'Introduction to General Chemistry', term: 'Fall 2026',
    COURSE: { instructor: 'Dr. Jane Smith', instructorEmail: 'jane.smith@montana.edu', officeHours: 'Tue 2-3 pm', lectures: 'MWF 9:00-9:50' },
    GRADING: { categories: [{ name: 'Homework', weight: 20 }, { name: 'Exams', weight: 50 }, { name: 'Final', weight: 30 }] },
    EXAMS: [{ id: 'exam1', name: 'Exam 1', date: '2026-10-28', units: [1] }, { id: 'final', name: 'Final exam', date: 'TBA' }],
    CALENDAR: [['2026-08-24', 'lecture', 'Atoms', 'atoms'], ['2026-09-18', 'quiz', 'Quiz 1'], ['2026-10-28', 'exam', 'Exam 1'], ['not a date', 'lecture', 'x']],
    UNITS: [{ n: 1, title: 'Atoms and molecules', sections: ['atoms', 'moles'] }],
    SECTIONS: [{ id: 'atoms', title: 'Atoms and isotopes', unit: 1, ideas: ['Protons and neutrons sit in the nucleus.', 'Isotopes differ in neutrons.'] }, { id: 'moles', title: 'The mole', ideas: 'A mole is $6.022 \\times 10^{23}$ particles.' }],
    FLASHCARDS: [{ front: 'Isotope', back: 'Same element, different number of neutrons' }, { f: 'Mole', b: '6.022 x 10^23 particles', sec: 'moles' }],
    QUIZ: { topics: { atoms: { unit: 1, sec: 'atoms', label: 'Atoms' }, moles: { sec: 'moles', label: 'Moles' } },
      questions: [{ type: 'bank', topic: 'atoms', items: [['Isotopes differ in their number of', 'neutrons', ['protons', 'electrons', 'charges'], 'Same protons, different neutrons.'], { q: 'The nucleus contains', a: 'protons and neutrons', wrong: ['electrons only', 'photons', 'electrons and protons'], why: 'Electrons are outside the nucleus.' }] },
        { type: 'bank', topic: 'moles', items: [['One mole is about how many particles?', '6.022 × 10^23', ['6.022 × 10^22', '3.14 × 10^23', '1000'], 'Avogadro’s number.']] }] }
  }, null, 2).replace('"Final exam",\n      "date": "TBA"', '"Final exam",\n      "date": "TBA",')}\n\`\`\`\n\nLet me know if you want more questions!`;
  await p.fill('#mk-text', messy); await p.click('[data-action="check"]'); await p.waitForTimeout(500);
  const pv = await txt(p, '#mk-result');
  check('a messy answer is repaired and previewed', /Introduction to General Chemistry/.test(pv) && /Add CHMY 121/.test(pv), pv.slice(0, 300));
  check('the preview counts what is in it and says what was left out', /2 topics/.test(pv) && /flashcards/.test(pv) && /notes? about this class/.test(pv), pv.slice(0, 300));
  await p.click('[data-add]'); await p.waitForTimeout(1600);
  const cid = (/#\/(my\d{4})\/dashboard/.exec(p.url()) || [])[1];
  check('adding the class opens its dashboard', !!cid, p.url());
  const saved = await p.evaluate(id => ({ file: !!localStorage.getItem('fakefs:DATA/classes/' + id + '.mathub.json'), idx: JSON.parse(localStorage.getItem('mh-my-classes') || '[]').map(e => e.id), local: App.packs.local.has(id), order: App.COURSE_ORDER.includes(id), strip: !!document.querySelector('.mk-strip') }), cid);
  check('the class is saved as a file in the app’s own folder and listed with the other classes', saved.file && saved.idx.includes(cid) && saved.local && saved.order && saved.strip, saved);
  check('an exam the syllabus gave no weight shows no made-up percent', !/undefined|NaN/.test(await txt(p, '#view')) && /Exam 1/.test(await txt(p, '#view')), (await txt(p, '#view')).slice(0, 200));
  log('class id:', cid);

  // after a restart the class is still there and opens from its file
  await go(p, `#/${cid}/flashcards`, 2200);
  const fc = await p.evaluate(id => ({ loaded: !!(window.Courses[id] && window.Courses[id].loaded), cards: ((window.Courses[id] || {}).FLASHCARDS || []).map(c => c.f) }), cid);
  check('after a restart the class loads from its saved file, flashcards and all', fc.loaded && fc.cards.includes('Isotope') && fc.cards.includes('Mole') && /Flashcards/.test(await txt(p, '#view')), fc);
  await go(p, `#/${cid}/notes`, 1800);
  check('its notes show the topics', /Atoms and isotopes/.test(await txt(p, '#view')) && /The mole/.test(await txt(p, '#view')));
  await go(p, `#/${cid}/calendar`, 1600);
  check('its calendar has the exam and the quiz row (filed as a deadline)', /Exam 1/.test(await txt(p, '#view')) && /Quiz 1/.test(await txt(p, '#view')));

  // haptics follow answers
  await p.evaluate(() => { window.__cap.haptics = []; App.sfx.play('correct'); App.sfx.play('wrong'); });
  check('right and wrong answers give the matching haptic', (await p.evaluate(() => window.__cap.haptics)).join() === 'n:SUCCESS,n:ERROR', await p.evaluate(() => window.__cap.haptics));

  // a cut-off answer and a broken one
  await go(p, '#/create', 1000);
  await p.fill('#mk-text', messy.slice(0, 900)); await p.click('[data-action="check"]'); await p.waitForTimeout(300);
  check('a cut-off answer is caught, with a message to send the AI', /stops before the end/.test(await txt(p, '#mk-result')) && !!(await p.$('#mk-result [data-copy]')));
  await p.click('#mk-result [data-copy]'); await p.waitForTimeout(200);
  check('that message asks for a shorter, complete answer', /cut off/.test(await p.evaluate(() => window.__cap.clipboard)));
  await p.fill('#mk-text', '```json\n{ "code": "X 101", "name": "Nothing in it" }\n```'); await p.click('[data-action="check"]'); await p.waitForTimeout(300);
  const broken = await txt(p, '#mk-result');
  check('an answer missing what a class needs lists what to fix', /Almost there/.test(broken) && /SECTIONS/.test(broken), broken.slice(0, 200));
  await p.fill('#mk-text', '```json\n{ "code": "X 101", "name": "Typo" "term": "Fall 2026" }\n```'); await p.click('[data-action="check"]'); await p.waitForTimeout(300);
  check('a JSON typo is caught', /typo/.test(await txt(p, '#mk-result')));
  await p.fill('#mk-text', '<script>alert(1)</script> { "code": "<img src=x onerror=alert(1)>" '); await p.click('[data-action="check"]'); await p.waitForTimeout(300);
  check('markup in a pasted answer is never put on the page', !(await p.$('#mk-result img, #mk-result script')));

  // the example class
  await p.click('[data-action="example"]'); await p.waitForTimeout(800);
  check('the example class checks clean', /Add SKIL 101/.test(await txt(p, '#mk-result')) && !/to fix/.test(await txt(p, '#mk-result')));
  await p.click('[data-add]'); await p.waitForTimeout(1500);
  const exId = (/#\/(my\d{4})\/dashboard/.exec(p.url()) || [])[1];
  await go(p, `#/${exId}/practice`, 2500);
  check('the example class has a working quizzer', !!(await p.$('#view .q-opt, #view [data-action="answer"], #view .quiz')) || /Retrieval|Spacing|Notes|Planning/.test(await txt(p, '#view')), (await txt(p, '#view')).slice(0, 160));

  // managing them: send, delete
  await go(p, '#/create', 1000);
  check('both classes are listed under "Classes you created"', (await p.$$('.mk-row')).length === 2);
  await p.click(`[data-share="${cid}"]`); await p.waitForTimeout(400);
  const sh = await p.evaluate(() => window.__cap.shared.slice(-1)[0]);
  check('Send shares the class as a file', sh && Array.isArray(sh.files) && /CHMY121\.mathub\.json$/.test(sh.files[0]), sh);
  await p.click(`[data-del="${exId}"]`); await p.waitForTimeout(800);
  const gone = await p.evaluate(id => ({ file: !!localStorage.getItem('fakefs:DATA/classes/' + id + '.mathub.json'), reg: !!window.Courses[id], rows: document.querySelectorAll('.mk-row').length }), exId);
  check('Delete removes the class and its file', !gone.file && !gone.reg && gone.rows === 1, gone);

  // reminders: asked only when turned on, then scheduled for the exams
  await go(p, '#/settings', 1600);
  check('Settings has the "On this iPhone" panel', /On this iPhone/.test(await txt(p, '#app-panel')));
  check('signed out, Settings says an account is optional and does not offer web push', /An account is optional/.test(await txt(p, '.acct-panel')) && !(await p.$('#acct-push')));
  await go(p, '#/calc/grapher', 1500);
  check('every study tool works without an account in the app (the grapher is open)', !(await p.$('#view .lock-card')) && !(await p.isVisible('#preview-banner')) && /Grapher/.test(await txt(p, '#view')) && !!(await p.$('#view canvas, #view svg')), (await txt(p, '#view')).slice(0, 120));
  await go(p, '#/settings', 1200);
  const before2 = await p.evaluate(() => window.__cap.perm);
  await p.check('#ap-exams'); await p.waitForTimeout(1200);
  const rem = await p.evaluate(() => ({ perm: window.__cap.perm, n: window.__cap.scheduled.length, titles: window.__cap.scheduled.map(n => n.title).slice(0, 4), on: App.settings().examReminders }));
  check('turning exam reminders on asks permission first, then schedules them', before2 === 'prompt' && rem.perm === 'granted' && rem.on && rem.n > 0 && rem.titles.some(t => /Exam 1 is (in 3 days|tomorrow)/.test(t)), rem);
  await p.check('#ap-daily'); await p.waitForTimeout(900);
  check('the daily reminder repeats at the chosen time', await p.evaluate(() => window.__cap.scheduled.some(n => n.id === 999 && n.schedule.repeats && n.schedule.on.hour === 19)));
  await p.uncheck('#ap-exams'); await p.uncheck('#ap-daily'); await p.waitForTimeout(900);
  check('turning them off cancels them', await p.evaluate(() => window.__cap.scheduled.filter(n => n.extra && n.extra.mh === 1).length === 0));

  // a web view cannot save files: files the page makes go to the share sheet, files on the server open in the Safari sheet
  await p.evaluate(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['{"x":1}'], { type: 'application/json' })); a.download = 'mathub-data.json'; document.body.appendChild(a); a.click(); a.remove(); });
  await p.waitForTimeout(700);
  const dl = await p.evaluate(() => ({ s: window.__cap.shared.slice(-1)[0], body: atob(localStorage.getItem('fakefs:CACHE/share/mathub-data.json') || '') }));
  check('a file the page makes (Download my data) opens the share sheet with that file', dl.s && /share\/mathub-data\.json$/.test(dl.s.files[0]) && dl.body === '{"x":1}', dl);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = 'https://mathub.space/api/index.php?r=ics&t=x'; a.download = 'mathub.ics'; a.id = 'dl-ics'; a.textContent = 'ics'; a.style.cssText = 'position:fixed;top:120px;left:10px;z-index:9999;padding:8px;background:#fff'; document.body.appendChild(a); });
  await p.click('#dl-ics'); await p.waitForTimeout(300);
  check('a file on the server (the .ics feed) opens in the in-app browser', (await p.evaluate(() => window.__cap.browser.slice(-1)[0])) === 'https://mathub.space/api/index.php?r=ics&t=x' && p.url().startsWith(APP));
  check('links people share point at mathub.space, not the app', await p.evaluate(() => App.siteBase()) === 'https://mathub.space/');

  // #/teach in the app points to the web
  await go(p, '#/teach', 1000); await p.click('[data-action="open-web"]'); await p.waitForTimeout(200);
  check('Mathub Faculty opens on the web from the app', (await p.evaluate(() => window.__cap.browser.slice(-1)[0])) === 'https://mathub.space/#/teach');

  // ---------- Android: the same app, with Android's conventions ----------
  const [cn, a] = await mkApp(412, 915, 'android');
  await go(a, '#/', 2200);
  const and = await a.evaluate(() => ({ app: document.documentElement.dataset.app, platform: MATHUB_APP.platform, bars: window.__cap.bars.slice(), back: (window.__cap.listeners.backButton || []).length }));
  check('Android: the app marks itself and colours the system bars through SystemBars', and.app === 'android' && and.platform === 'android' && and.bars.length > 0, and);
  check('Android: the back button and back gesture are handled', and.back === 1, and);
  await a.evaluate(() => { location.hash = '#/create'; }); await a.waitForTimeout(1000);
  check('Android: Create a class says the class stays on this phone', /saved on this phone/.test(await txt(a, '#view')));
  const back = () => a.evaluate(() => window.__cap.listeners.backButton.forEach(fn => fn({ canGoBack: true })));
  await a.evaluate(() => App.showShortcuts()); await a.waitForTimeout(300);
  await back(); await a.waitForTimeout(700);
  check('Android back: closes an open dialog first', !(await a.$('#shortcuts-modal')) && /#\/create$/.test(a.url()), a.url());
  await a.evaluate(() => document.querySelector('.app') && document.querySelector('.app').classList.add('nav-open'));
  await back(); await a.waitForTimeout(300);
  check('Android back: then closes the menu', await a.evaluate(() => !document.querySelector('.app.nav-open')) && /#\/create$/.test(a.url()));
  await back(); await a.waitForTimeout(1000);
  check('Android back: then goes back a page', /#\/$/.test(a.url()), a.url());
  await back(); await a.waitForTimeout(300);
  check('Android back: on the start page it leaves the app for the home screen', (await a.evaluate(() => window.__cap.minimized)) === 1);
  await a.evaluate(() => { location.hash = '#/settings'; }); await a.waitForTimeout(1400);
  check('Android: Settings has the "On this phone" panel', /On this phone/.test(await txt(a, '#app-panel')));
  await a.check('#ap-daily'); await a.waitForTimeout(1000);
  const arem = await a.evaluate(() => ({ ch: window.__cap.channels, n: window.__cap.scheduled.filter(n => n.id === 999) }));
  check('Android: reminders go in their own channel and are inexact (no exact-alarm permission needed)', arem.ch.some(c => c.id === 'reminders' && c.importance === 3) && arem.n.length === 1 && arem.n[0].channelId === 'reminders' && arem.n[0].isExactNotification === false, arem);
  check('no sideways scroll on Android at 412px', await hscroll(a));

  // the website has none of this
  const [cw, w] = await mk(1360, 900, { serviceWorkers: 'block' });
  await goSite(w, '#/create', 1400);
  const web = await w.evaluate(() => ({ app: document.documentElement.dataset.app || '', create: !!(window.App && App.views.create), scripts: [...document.scripts].map(s => s.src).filter(s => /app-(boot|native)/.test(s)).length }));
  check('the website has no Create a class page and loads no app code', web.app === '' && !web.create && web.scripts === 0 && /not found/i.test(await txt(w, '#view')), web);

  await goSite(w, '#/policy/delete', 1400);
  const del = await txt(w, '#pol-delete') + ' ' + await w.evaluate(() => { const h = document.querySelector('#pol-delete'); let t = ''; for (let n = h && h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) t += n.textContent + ' '; return t; });
  check('the website has a public "Deleting your Mathub account" page (Google Play asks for its link)', /Deleting your Mathub account/.test(del) && /Settings/.test(del) && /Delete account/.test(del) && /within 7 days/.test(del) && /Kept, but no longer linked/.test(del), del.slice(0, 160));
  await Promise.all([ca.close(), cn.close(), cw.close()]);
  await T.finish();
})();
