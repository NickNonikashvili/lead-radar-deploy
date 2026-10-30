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
  await T.finish();
})();
