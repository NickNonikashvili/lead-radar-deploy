/* ============================================================
   Languages (assets/i18n.js): English, Español, Русский, Français, Italiano, Português, Deutsch
   - the page in each language: html lang, the navigation, the header globe, the footer picker; pages fit on a computer and a phone
   - the globe menu in the header: opens, lists all seven, works with the keyboard, switches the language and remembers it
   - the footer picker switches back to English
   - Bo greets and answers in the student's language
   ============================================================ */
const T = require('./lib');
const fs = require('fs'); const path = require('path'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const NAMES = 'English,Español,Русский,Français,Italiano,Português,Deutsch';
const SETTINGS = { es: 'Ajustes', ru: 'Настройки', fr: 'Paramètres', it: 'Impostazioni', pt: 'Configurações', de: 'Einstellungen' };   // "Settings" in the sidebar
(async () => {
  const { mk, go, check, hscroll, login, api } = await T.start();
  const settings = (L, extra) => new Function(`try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.courses = ['calc', 'physics']; s.asof = '2026-10-13'; s.boFloatSeen = 1; ${extra || ''} if (!s.lang) s.lang = '${L}'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}`);
  for (const L of Object.keys(SETTINGS)) {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await c.addInitScript(settings(L));
    await go(p, '#/calc/dashboard', 2200);
    const r = await p.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('#sidebar-nav').textContent, en: [...document.querySelectorAll('#sidebar-nav a, #sidebar-nav button')].map(a => a.textContent.trim()).filter(t => /^(Section notes|Formula sheet|Settings|Calendar|Mistakes)\d*$/.test(t)), pick: document.querySelector('#lang-pick').value, opts: [...document.querySelectorAll('#lang-pick option')].map(o => o.textContent), code: document.querySelector('#lang-top-code').textContent, label: document.querySelector('#lang-top-btn').getAttribute('aria-label') }));
    check(`${L}: the page is in ${L} (html lang, every sidebar link, the header globe, the footer picker with all seven)`, r.lang === L && r.nav.includes(SETTINGS[L]) && !r.en.length && r.code === L.toUpperCase() && /\(Language\)/.test(r.label) && r.pick === L && r.opts.join() === NAMES, r);
    for (const h of ['#/calc/practice', '#/today', '#/settings', '#/calc/flashcards']) { await go(p, h, 2600); check(`${L}: ${h} has no page error and fits`, await hscroll(p)); }
    // phone: the globe stays in the header, the page title keeps its room
    const [c2, ph] = await mk(390, 844, { serviceWorkers: 'block' }); await c2.addInitScript(settings(L));
    await go(ph, '#/calc/dashboard', 2200);
    const top = await ph.evaluate(() => { const b = document.querySelector('#lang-top-btn').getBoundingClientRect(); const t = document.querySelector('.topbar h1, .topbar .page-title, .topbar-title'); return { globe: b.width > 0 && b.right <= innerWidth, title: t ? t.getBoundingClientRect().width : -1 }; });
    check(`${L}: phone dashboard fits, the globe is in the header and the title has room`, await hscroll(ph) && top.globe && (top.title === -1 || top.title > 60), top);
    await c.close(); await c2.close();
  }

  // the globe menu in the header
  const [c3, e] = await mk(1360, 900, { serviceWorkers: 'block' }); await c3.addInitScript(settings('en'));
  await go(e, '#/calc/dashboard', 1800);
  check('in English the globe says EN and the menu is closed', await e.evaluate(() => document.querySelector('#lang-top-code').textContent === 'EN' && document.querySelector('#lang-menu').hidden && document.querySelector('#lang-top-btn').getAttribute('aria-expanded') === 'false'));
  await e.click('#lang-top-btn'); await e.waitForTimeout(200);
  const menu = await e.evaluate(() => { const m = document.querySelector('#lang-menu'); const it = [...m.querySelectorAll('[role="menuitemradio"]')]; return { open: !m.hidden && document.querySelector('#lang-top-btn').getAttribute('aria-expanded') === 'true', names: it.map(b => b.querySelector('.lm-name').textContent).join(), checked: it.filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.lang).join(), focus: document.activeElement.dataset.lang }; });
  check('the globe opens a menu of all seven languages, each in its own words, English ticked and focused', menu.open && menu.names === NAMES && menu.checked === 'en' && menu.focus === 'en', menu);
  await e.keyboard.press('ArrowDown'); await e.keyboard.press('ArrowDown');
  const f1 = await e.evaluate(() => document.activeElement.dataset.lang); await e.keyboard.press('End'); const f2 = await e.evaluate(() => document.activeElement.dataset.lang);
  await e.keyboard.press('Escape'); await e.waitForTimeout(150);
  check('arrow keys and End move through it; Escape closes it and goes back to the globe', f1 === 'ru' && f2 === 'de' && await e.evaluate(() => document.querySelector('#lang-menu').hidden && document.activeElement.id === 'lang-top-btn'), { f1, f2 });
  await e.click('#lang-top-btn'); await e.waitForTimeout(150); await e.mouse.click(700, 500); await e.waitForTimeout(150);
  check('a click anywhere else closes it', await e.evaluate(() => document.querySelector('#lang-menu').hidden));
  await e.click('#lang-top-btn'); await e.waitForTimeout(150);
  await Promise.all([e.waitForLoadState('load'), e.click('#lang-menu [data-lang="de"]')]); await e.waitForTimeout(2500);
  check('picking Deutsch puts the page in German and remembers it', await e.evaluate(() => document.documentElement.lang === 'de' && JSON.parse(localStorage.getItem('studyhub-settings')).lang === 'de' && document.querySelector('#lang-top-code').textContent === 'DE' && /Einstellungen/.test(document.querySelector('#sidebar-nav').textContent)));
  // switching back to English from the footer
  await e.selectOption('#lang-pick', 'en'); await e.waitForTimeout(2500);
  check('the footer picker switches the language (back to English) and remembers it', await e.evaluate(() => document.documentElement.lang === 'en' && JSON.parse(localStorage.getItem('studyhub-settings')).lang === 'en' && /Flashcards/.test(document.querySelector('#sidebar-nav').textContent) && document.querySelector('#lang-top-code').textContent === 'EN'));
  await c3.close();

  // Bo greets and answers in the student's language
  const [c4, m] = await mk(1360, 900, { serviceWorkers: 'block' }); await c4.addInitScript(settings('ru', 's.courses = [\'calc\']; s.aiConsent = Date.now();'));
  await go(m, '#/', 600); await login(m, 'mod.user@montana.edu'); await m.reload(); await m.waitForTimeout(900);
  // the account may carry another language from an earlier run, and the account's language wins on sign-in: pick Russian here, as a student would
  if (await m.evaluate(() => App.lang !== 'ru')) { await m.evaluate(() => MathubI18n.set('ru')).catch(() => {}); await m.waitForLoadState('load'); await m.waitForTimeout(1200); }
  await api(m, 'ai_forget', { what: 'all' });
  await go(m, '#/tutor/calc', 2200);
  const hello = await m.evaluate(() => ({ want: App.t('Ask me anything, or snap a photo of a problem.'), text: (document.querySelector('#bo-main') || document.body).textContent }));
  check('Bo greets in Russian', hello.want !== 'Ask me anything, or snap a photo of a problem.' && hello.text.includes(hello.want) && !/Ask me anything/.test(hello.text), hello.text.slice(0, 300));
  await m.evaluate(() => App.boAsk({ class: 'calc', q: 'What is a limit?', snapshot: {}, today: App.todayISO() }, () => {}));
  const sys = JSON.parse(fs.readFileSync(LAST, 'utf8')).system.map(b => b.text).join('\n');
  check('Bo is told to answer in Russian, with the English terms the class uses', /LANGUAGE: the student uses StudyCat in Russian\. Always answer in Russian/.test(sys) && /English term in brackets/.test(sys), sys.slice(-400));
  await api(m, 'ai_forget', { what: 'all' });
  await m.evaluate(() => MathubI18n.set('en')).catch(() => {}); await m.waitForLoadState('load'); await m.waitForTimeout(3500);   // leave the account in English for the tests after this one
  await T.finish();
})();
