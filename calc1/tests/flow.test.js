/* Moving around (assets/app.js):
   - Back and Forward put you where you were on a page you saw (and a reload keeps your place); a new page starts at the top
   - a button whose action waits on the server is busy at once (a double tap sends it once), shows a spinner only if it
     takes a while, and is free again when the answer comes */
const T = require('./lib');
(async () => {
  const { mk, go, check } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
  await go(p, '#/resources', 1200);
  const tall = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await p.evaluate(() => window.scrollTo(0, 1100)); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/calc'; }); await p.waitForTimeout(1800);
  const atNew = await p.evaluate(() => Math.round(scrollY));
  check('a new page starts at the top', tall > 1200 && atNew === 0, { tall, atNew });
  await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(250);
  await p.goBack(); await p.waitForTimeout(1200);
  const back = await p.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  check('Back puts you where you were on the page you left', /^#\/resources/.test(back.hash) && Math.abs(back.y - 1100) <= 4, back);
  await p.goForward(); await p.waitForTimeout(1500);
  const fwd = await p.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  check('and Forward too', fwd.hash === '#/calc' && Math.abs(fwd.y - 300) <= 4, fwd);
  await p.goBack(); await p.waitForTimeout(1200); await p.evaluate(() => window.scrollTo(0, 800)); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(2200);
  const rl = await p.evaluate(() => Math.round(scrollY));
  check('a reload keeps your place', Math.abs(rl - 800) <= 4, rl);
  await p.click('a[href="#/"]').catch(() => p.evaluate(() => { location.hash = '#/'; })); await p.waitForTimeout(1200);
  check('a link to another page still starts at its top', await p.evaluate(() => Math.round(scrollY)) === 0);

  // a button that waits on the server
  const b = await p.evaluate(async () => {
    const box = document.createElement('div'); box.id = 'zz-flow'; box.innerHTML = '<button type="button" class="btn" data-action="slow">Save</button><button type="button" class="btn" data-action="quick">Now</button>'; document.querySelector('#view').appendChild(box);
    window.__calls = 0; App.bind(box, { slow: () => { window.__calls++; return new Promise(r => setTimeout(r, 900)); }, quick: () => { window.__calls += 10; } });
    const s = box.querySelector('[data-action="slow"]'); s.click(); s.click();
    const at0 = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    await new Promise(r => setTimeout(r, 500)); const at500 = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    await new Promise(r => setTimeout(r, 600)); const after = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    const q = box.querySelector('[data-action="quick"]'); q.click(); q.click();
    return { calls: window.__calls, at0, at500, after, quickBusy: q.getAttribute('aria-busy'), label: s.textContent };
  });
  check('a double tap on a button that waits sends it once', b.calls === 1 + 20, b);
  check('busy at once, the spinner only after a moment, both gone when the answer comes', b.at0.busy === 'true' && !b.at0.spin && b.at500.spin && b.after.busy === null && !b.after.spin && b.label === 'Save', b);
  check('a button whose action is instant is never marked busy', b.quickBusy === null, b);
  await c.close();

  // page changes: the old page closes like a Mac window (the genie); Back opens it again; the frame keeps still; Reduce motion: none
  const [c2, q] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'no-preference' });
  await q.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'on'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(q, '#/resources', 1200);
  const vtOn = await q.evaluate(() => typeof document.startViewTransition === 'function');
  const anims = () => q.evaluate(() => ({ nav: document.documentElement.dataset.nav || null, a: document.getAnimations().filter(a => a.effect && /view-transition/.test(a.effect.pseudoElement || '')).map(a => `${a.effect.pseudoElement}:${a.animationName}`) }));
  // the slide starts once the new page is drawn (a frame or a few later): wait for it
  const sliding = () => q.waitForFunction(() => document.getAnimations().some(a => a.effect && /view-transition-new\(root\)/.test(a.effect.pseudoElement || '')), null, { timeout: 1500 }).catch(() => {});
  await q.evaluate(() => { location.hash = '#/calc'; }); await sliding();
  const push = await anims();
  check('opening a page: the old one closes like a Mac window (the genie), the new one settles in under it', vtOn && push.nav === 'push' && push.a.includes('::view-transition-old(root):vtGenie') && push.a.includes('::view-transition-new(root):vtSettle'), push);
  const frame = await q.evaluate(() => ({ side: getComputedStyle(document.querySelector('.sidebar')).viewTransitionName, top: getComputedStyle(document.querySelector('.topbar')).viewTransitionName, bo: document.querySelector('#bo-fab') ? getComputedStyle(document.querySelector('#bo-fab')).viewTransitionName : 'bo-fab' }));
  check('the sidebar, the top bar and Ask Bo keep still (their own snapshots)', frame.side === 'side' && frame.top === 'top' && frame.bo === 'bo-fab', frame);
  await q.waitForTimeout(700);
  const after = await anims();
  check('and when it has settled, the page is just the page again', after.nav === null && after.a.length === 0 && /#\/calc/.test(await q.evaluate(() => location.hash)), after);
  await q.goBack(); await sliding();
  const pop = await anims();
  check('Back: the page you go back to comes up out of the genie and opens out', pop.nav === 'back' && pop.a.includes('::view-transition-new(root):vtGenie') && pop.a.includes('::view-transition-old(root):vtRecede'), pop);
  await q.waitForTimeout(700);
  await q.emulateMedia({ reducedMotion: 'reduce' });
  await q.evaluate(() => { location.hash = '#/calc'; }); await q.waitForTimeout(60);
  const still = await anims();
  check('with Reduce motion the page simply changes', still.nav === null && still.a.length === 0 && await q.evaluate(() => !!document.querySelector('#view').children.length), still);
  await c2.close();

  // a page starts loading before you click it: a class link you rest the pointer on, a page whose code loads the first time
  const [c3, w] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
  await w.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.courses = ['calc', 'physics']; s.boFloatSeen = 1; s.tourLayout = 9; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(w, '#/resources', 1500);
  const pre = await w.evaluate(() => ({ loaded: App.courseLoaded('physics'), link: !!document.querySelector('a[href^="#/physics"]'), lazy: !!(App.views.whatsnew && App.views.whatsnew.lazy) }));
  await w.hover('a[href^="#/physics"]'); await w.waitForTimeout(30);
  const early = await w.evaluate(() => App.courseLoaded('physics'));
  let bar = false; for (let i = 0; i < 20; i++) { bar = bar || await w.evaluate(() => { const b = document.querySelector('#loadbar'); return !!(b && b.classList.contains('on')); }); await w.waitForTimeout(40); }
  const post = await w.evaluate(() => ({ loaded: App.courseLoaded('physics'), hash: location.hash }));
  check('resting the pointer on a class link loads that class quietly (no loading bar), without opening it', pre.link && !pre.loaded && !early && post.loaded && !bar && /resources/.test(post.hash), { pre, early, bar, post });
  await w.evaluate(() => { const a = document.createElement('a'); a.href = '#/whatsnew'; a.id = 'zz-wn'; a.textContent = 'What is new'; a.style.cssText = 'position:fixed;top:120px;left:420px;z-index:999;padding:8px;background:#fff'; document.body.appendChild(a); });
  await w.hover('#zz-wn'); await w.waitForTimeout(800);
  const lz = await w.evaluate(() => ({ lazy: !!(App.views.whatsnew && App.views.whatsnew.lazy), hash: location.hash }));
  check('and a page whose code loads the first time (What’s new) is fetched ahead of the click', pre.lazy && !lz.lazy && /resources/.test(lz.hash), { pre, lz });
  await w.click('#zz-wn'); await w.waitForTimeout(500);
  check('so it opens at once', await w.evaluate(() => /whatsnew/.test(location.hash) && !/Loading…/.test(document.querySelector('#view').textContent) && document.querySelector('#view').textContent.length > 200));
  await c3.close();
  await T.finish();
})();
