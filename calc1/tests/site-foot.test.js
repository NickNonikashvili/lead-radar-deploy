/* The footer, and the website's phone layout without a tab bar or a header search button:
   the footer's brand, link columns, language pill and base line on a desk and a phone, nothing
   floating over it (Bo's button, "Back to top", a lesson's answer bar), and search still a
   keystroke away (Ctrl/⌘ K) with no button for it in the header. */
const T = require('./lib');
(async () => {
  const { mk, go, log, check, hscroll } = await T.start({});
  const pick = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); if (!s.courses) { s.courses = ['calc', 'writ']; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } } catch (e) {} };
  // what the footer holds, where its parts sit, and whether anything floating covers its words
  const read = p => p.evaluate(() => {
    window.scrollTo(0, 1e6);
    const q = s => document.querySelector(s); const box = el => el && el.getBoundingClientRect();
    const hit = (a, b) => a && b && a.width && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const shown = el => el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity !== '0';
    const words = [...document.querySelectorAll('.sf-base > *, .sf-col a, .sf-about, .sf-logo, .lang-pick')].map(box);
    const fab = q('#bo-fab'), top = q('.totop'), lf = q('.lesson-foot');
    const over = el => shown(el) ? words.filter(w => hit(w, box(el))).length : 0;
    const f = q('.site-foot');
    return {
      logo: !!q('.sf-logo[href="#/"] svg') && q('.sf-logo').textContent.trim() === 'StudyCat',
      about: !!q('.sf-about') && q('.sf-about').textContent.length > 40,
      heads: [...document.querySelectorAll('.sf-col .sf-h')].map(h => h.textContent.trim()),
      links: [...document.querySelectorAll('.sf-col a')].map(a => a.getAttribute('href')),
      underlined: [...document.querySelectorAll('.sf-col a')].some(a => getComputedStyle(a).textDecorationLine !== 'none'),
      langs: q('#lang-pick') ? q('#lang-pick').options.length : 0,
      base: q('.sf-base') ? q('.sf-base').textContent.replace(/\s+/g, ' ').trim() : '',
      side: (() => { const b = box(q('.sf-brand')), c = box(q('.sf-cols')); return b && c ? (Math.abs(b.top - c.top) < 4 ? 'beside' : c.top > b.bottom - 1 ? 'below' : 'other') : 'none'; })(),
      cols: (() => { const cs = [...document.querySelectorAll('.sf-col')].map(box); return cs.length === 2 && Math.abs(cs[0].top - cs[1].top) < 4 ? 'side by side' : 'stacked'; })(),
      inFoot: !!(f && f.contains(q('.px-sig'))),
      underFab: over(fab), underTop: over(top), topShown: !!(top && top.classList.contains('show')), underLesson: lf ? words.filter(w => hit(w, box(lf))).length : 0,
      fabLow: fab && shown(fab) ? Math.round(innerHeight - box(fab).bottom) : null,
      tabbar: !!q('#tabbar'), searchBtn: !!q('.search-btn, #topbar [data-action="search"]')
    };
  });

  // a desk
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await p.addInitScript(pick);
  await go(p, '#/calc/dashboard', 1800); await p.evaluate(() => window.scrollTo(0, 1e6)); await p.waitForTimeout(600);
  const d = await read(p); log('desk:', JSON.stringify(d));
  check('the footer has the logo, a line about StudyCat and the language pill with all seven languages', d.logo && d.about && d.langs === 7, d);
  check('two columns, Study and Help, with every link the old footer had', d.heads.join() === 'Study,Help' && ['learn/', '#/forum', '#/teach', '#/contact', '#/policy'].every(h => d.links.includes(h)), d);
  check('the base line: the signature, who made it and the term', d.inFoot && /Handmade with love in Bozeman/.test(d.base) && /Created by Nikoloz Nonikashvili/.test(d.base) && /Montana State · Fall 2026/.test(d.base), d.base);
  check('on a desk the brand and the columns sit side by side, the links plain until hovered', d.side === 'beside' && d.cols === 'side by side' && !d.underlined, d);
  check('Bo’s button and "Back to top" (showing) cover none of the footer’s words', d.topShown && d.underFab === 0 && d.underTop === 0, d);
  check('no search button in the header and no tab bar', !d.searchBtn && !d.tabbar, d);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  check('search is still a keystroke away (Ctrl K)', !!(await p.$('#search-modal')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.selectOption('#lang-pick', 'es'); await p.waitForTimeout(2200);
  const es = await p.evaluate(() => ({ lang: document.documentElement.lang, heads: [...document.querySelectorAll('.sf-col .sf-h')].map(h => h.textContent.trim()), about: document.querySelector('.sf-about').textContent.trim() }));
  check('the footer’s language pill switches the site, the footer included', es.lang === 'es' && es.heads.join() === 'Estudiar,Ayuda' && /^Clases que eliges/.test(es.about), es);
  await p.selectOption('#lang-pick', 'en'); await p.waitForTimeout(1500);
  await c.close();

  // a phone
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block', isMobile: true, hasTouch: true }); await m.addInitScript(pick);
  await go(m, '#/calc/dashboard', 1800);
  const ph = await read(m); log('phone:', JSON.stringify(ph));
  check('a phone has no tab bar and no header search button', !ph.tabbar && !ph.searchBtn, ph);
  check('Bo’s button sits low in the corner now that nothing is under it', ph.fabLow !== null && ph.fabLow >= 0 && ph.fabLow < 40, ph.fabLow);
  check('the footer stacks: the brand, then the two columns side by side', ph.side === 'below' && ph.cols === 'side by side', ph);
  check('nothing floats over the footer’s words and nothing scrolls sideways', ph.underFab === 0 && await hscroll(m), ph);
  await go(m, '#/no-such-page', 1000);
  check('the page-not-found screen offers the start page and a way to report the link, no search button', !!(await m.$('.landing-wrap a[href="#/"]')) && !!(await m.$('.landing-wrap a[href="#/contact"]')) && !(await m.$('.landing-wrap [data-action="search"]')));
  await go(m, '#/calc/lesson?n=3', 1500);
  const ls = await read(m);
  check('in a lesson the footer ends above the answer bar', !!(await m.$('.lesson-foot')) && ls.underLesson === 0, ls);
  await cm.close();
  await T.finish();
})();
