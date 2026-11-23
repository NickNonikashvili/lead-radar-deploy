// Screenshots of the EvoSoft site for the story version (served locally on :8400), in their settled state.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const shots = [
    ['home', '/index.html', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
    ['home_ka', '/ka/', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
    ['mobile', '/index.html', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
    ['mobile_ka', '/ka/', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
    ['services', '/services.html', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ];
  for (const [name, url, ctx] of shots) {
    const c = await b.newContext({ ...ctx, reducedMotion: 'reduce', colorScheme: 'light' });
    await c.route(/^https:\/\/(evo|mail|studycat)-demo\.evosoft\.solutions\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>demo</title>' }));
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8400' + url, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: '.chat-launch,.chat-teaser{display:none!important}' });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `shots/${name}.png` });
    console.log(name);
    await c.close();
  }
  await b.close();
})();
