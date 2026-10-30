/* Motion layer: staggered entrances, ring fills, the loading bar, skins and reduce-motion. */
const T = require('./lib');
(async () => {
  const { mk, login, go, log, check, txt } = await T.start({ freeHome: true });
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(p, '#/', 900);
  await p.evaluate(() => { const s = App.settings(); s.courses = ['calc']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(900);   // a visitor who picked a class: the widgets, not the class picker, open the page
  check('the home\'s widgets get a staggered entrance', (await p.$$('#dash-canvas .dw.mh-enter')).length >= 1, (await p.$$('#dash-canvas .dw')).length);
  check('hero panel has --i', await p.$eval('#view .panel.mh-enter', e => e.style.getPropertyValue('--i') !== '').catch(() => false));
  // the start page only draws a class's ring once there is progress in it, so check on a class dashboard (daily goal ring)
  await go(p, '#/calc', 900); check('rings animate', (await p.$$('.ring-fg.ring-anim')).length >= 1); await go(p, '#/', 600);
  // the page is drawn a frame or two after the address changes (the page-change animation snapshots the old one first): wait for the bar
  await go(p, '#/physics', 0); const on = await p.waitForFunction(() => { const b = document.querySelector('#loadbar'); return b && b.classList.contains('on'); }, null, { timeout: 1500, polling: 10 }).then(() => true).catch(() => false); await p.waitForTimeout(1500); const off = await p.$eval('#loadbar', e => !e.classList.contains('on')).catch(() => 'missing');
  check('loading bar shows during class download and hides after', on === true && off === true, { on, off });
  await go(p, '#/settings', 800); check('skin picker present', (await p.$$('.skin-opt')).length === 6); await p.click('.skin-opt[data-skin="bobcat"]'); await p.waitForTimeout(200);
  check('skin applied', await p.evaluate(() => document.documentElement.getAttribute('data-skin')) === 'bobcat');
  await p.click('#s-motion'); await p.waitForTimeout(200); check('reduce motion applied', await p.evaluate(() => document.documentElement.getAttribute('data-motion')) === 'off');
  await p.reload(); await p.waitForTimeout(600); check('skin + motion applied before paint on reload', await p.evaluate(() => document.documentElement.getAttribute('data-skin') === 'bobcat' && document.documentElement.getAttribute('data-motion') === 'off'));
  await p.click('.skin-opt[data-skin="default"]'); await p.click('#s-motion'); await p.waitForTimeout(100);
  // watch the class itself: the theme change restyles the whole page, which can take longer than the fade on a slow machine
  await p.evaluate(() => { window.__fade = []; new MutationObserver(() => window.__fade.push(document.documentElement.classList.contains('theme-fade'))).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); });
  await p.click('.landing-top .theme-btn, #topbar .theme-btn >> visible=true').catch(() => p.evaluate(() => App.toggleTheme())); await p.waitForTimeout(700);
  const fade = await p.evaluate(() => window.__fade); check('theme fade class toggles', fade.includes(true) && fade[fade.length - 1] === false, fade);
  await c.close(); await T.finish();
})();
