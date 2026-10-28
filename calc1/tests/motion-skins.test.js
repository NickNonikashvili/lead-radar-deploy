/* Motion layer: staggered entrances, ring fills, the loading bar, skins and reduce-motion. */
const T = require('./lib');
(async () => {
  const { mk, login, go, log, check, txt } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(p, '#/', 900);
  check('the home\'s widgets get a staggered entrance', (await p.$$('#dash-canvas .dw.mh-enter')).length >= 1, (await p.$$('#dash-canvas .dw')).length);
  check('hero panel has --i', await p.$eval('#view .panel.mh-enter', e => e.style.getPropertyValue('--i') !== '').catch(() => false));
  // the start page only draws a class's ring once there is progress in it, so check on a class dashboard (daily goal ring)
  await go(p, '#/calc', 900); check('rings animate', (await p.$$('.ring-fg.ring-anim')).length >= 1); await go(p, '#/', 600);
  await go(p, '#/physics', 100); const on = await p.$eval('#loadbar', e => e.classList.contains('on')).catch(() => 'missing'); await p.waitForTimeout(1500); const off = await p.$eval('#loadbar', e => !e.classList.contains('on')).catch(() => 'missing');
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
