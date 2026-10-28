/* Steadier pages on a phone, and easier to tap (2026.10.28.6):
   - nothing jumps while a page opens (CLS under 0.1): the footer waits for the page (html.mh-booting, assets/boot.js
     and afterRender in assets/app.js), and the phone top bar keeps its height while the class name loads
   - text-style buttons answer taps over at least 24 × 24 px (WCAG 2.5.8) through an invisible ::after
   - keyboard focus and jumps land below the sticky top bar (scroll-padding-top)
   - the Quizzer's row of presets scrolls inside its panel: the page is never wider than the phone */
const T = require('./lib');
(async () => {
  const { mk, go, base, check, log } = await T.start({});
  const seed = c => c.addInitScript(() => {
    try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); Object.assign(s, { courses: ['calc'], boFloatSeen: 1, tourLayout: 99 }); localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}
    window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  });

  // a phone without isMobile, so a too-wide page shows as a wider scroll, not a zoomed-out layout
  const [c, p] = await mk(390, 844, { hasTouch: true, serviceWorkers: 'block' }); await seed(c);
  const PAGES = [['the class dashboard', '#/calc'], ['the Quizzer', '#/calc/practice'], ['a lesson', '#/calc/notes/1.1'], ['Today', '#/today'], ['Settings', '#/settings']];
  for (const [name, h] of PAGES) {
    await p.goto('about:blank'); await p.goto(base + h);   // a fresh load each time, so the page's own shifts are counted await p.waitForTimeout(2600);
    const r = await p.evaluate(() => ({ cls: +window.__cls.toFixed(3), wide: document.documentElement.scrollWidth, booting: document.documentElement.classList.contains('mh-booting'), foot: !!document.querySelector('.site-foot') && getComputedStyle(document.querySelector('.site-foot')).display !== 'none' }));
    log(name, JSON.stringify(r));
    check(`${name} on a phone: nothing jumps while it opens, the footer shows once it is drawn, and it is no wider than the screen`, r.cls < 0.1 && !r.booting && r.foot && r.wide <= 391, r);
  }

  // tap targets: every visible text-style button answers over 24 × 24
  await go(p, '#/calc', 1800);
  const t = await p.evaluate(() => [...document.querySelectorAll('.linkbtn, .linkish, .sb-time, .eyebrow a')].filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(), a = getComputedStyle(el, '::after'); return { what: el.textContent.trim().slice(0, 20), w: Math.max(r.width, parseFloat(a.width) || 0), h: Math.max(r.height, parseFloat(a.height) || 0), abs: a.position === 'absolute' }; }));
  check('text-style buttons answer taps over at least 24 × 24 px', t.length > 0 && t.every(x => x.abs && x.w >= 24 && x.h >= 24), t.filter(x => !(x.abs && x.w >= 24 && x.h >= 24)));
  const hit = await p.evaluate(() => { const el = [...document.querySelectorAll('.linkbtn, .linkish, .eyebrow a')].find(x => { const r = x.getBoundingClientRect(); return r.height && r.height < 22 && r.top > 70; }); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top - 2); return { what: el.textContent.trim(), ok: at === el || el.contains(at) }; });
  check('a tap just above a short one still reaches it', !hit || hit.ok, hit);
  await c.close();

  // focus below the sticky top bar
  const [c2, d] = await mk(1280, 860, { serviceWorkers: 'block' }); await seed(c2);
  await go(d, '#/calc/notes/1.1', 2400);
  const sp = await d.evaluate(() => ({ pad: parseFloat(getComputedStyle(document.querySelector('#view h1, #view h2')).scrollMarginTop), html: getComputedStyle(document.documentElement).scrollPaddingTop, bar: document.querySelector('.topbar').getBoundingClientRect().height }));
  check('the page keeps room under the sticky top bar for focus and jumps (on the page, not on html)', sp.pad >= sp.bar + 4 && sp.html === 'auto', sp);
  const f = await d.evaluate(async () => { window.scrollTo(0, 0); const els = [...document.querySelectorAll('#view a[href], #view button')].filter(e => e.getClientRects().length); const el = els.find(e => e.getBoundingClientRect().top > innerHeight * 1.5); if (!el) return null; el.focus(); await new Promise(r => setTimeout(r, 300)); el.blur(); window.scrollBy(0, -el.getBoundingClientRect().top + 20); await new Promise(r => setTimeout(r, 100)); el.focus(); await new Promise(r => setTimeout(r, 300)); return { top: Math.round(el.getBoundingClientRect().top), bar: Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom) }; });
  check('focus that scrolls up into the page lands below the top bar, not under it', !f || f.top >= f.bar, f);
  await d.evaluate(() => window.scrollTo(0, 600)); await d.waitForTimeout(200);
  const which = await d.locator('.topbar-actions button:visible').last().getAttribute('title'); await d.locator('.topbar-actions button:visible').last().click(); await d.waitForTimeout(400);
  const tb = await d.evaluate(() => ({ y: Math.round(scrollY), pop: !!document.querySelector('.popover') })); tb.which = which;
  check('clicking a top-bar button further down the page does not scroll it (a scroll would close its menu)', tb.y === 600, tb);
  await c2.close();
  await T.finish();
})();
