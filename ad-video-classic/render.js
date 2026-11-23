// Renders the ad to JPEG frames with headless Chromium (WebGL through SwiftShader).
//   node render.js <outDir> [fps=30] [workers=3] [fromFrame=0] [toFrame=end] [step=1] [port=8600]
//   node render.js --times <outDir> t1 t2 ...      (single frames at given seconds, for checks)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'];
const PORT = process.env.PORT || 8600;
const URL = `http://127.0.0.1:${PORT}/comp/index.html`;

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => window.ready);
  return p;
}

(async () => {
  const argv = process.argv.slice(2);
  const browser = await chromium.launch({ args: ARGS });
  if (argv[0] === '--times') {
    const out = argv[1]; fs.mkdirSync(out, { recursive: true });
    const p = await page(browser);
    for (const t of argv.slice(2).map(Number)) {
      const t0 = Date.now();
      await p.evaluate((t) => window.renderFrame(t), t);
      await p.screenshot({ path: path.join(out, `t${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 88 });
      console.log(`t=${t} ${Date.now() - t0} ms`);
    }
    await browser.close();
    return;
  }
  const [outDir, fpsArg, workersArg, fromArg, toArg, stepArg] = argv;
  const FPS = Number(fpsArg || 30), WORKERS = Number(workersArg || 3), STEP = Number(stepArg || 1);
  fs.mkdirSync(outDir, { recursive: true });
  const probe = await page(browser);
  const total = Math.round((await probe.evaluate(() => window.DURATION)) * FPS);
  await probe.close();
  const from = Number(fromArg || 0), to = Math.min(total, Number(toArg || total));
  const frames = []; for (let i = from; i < to; i += STEP) frames.push(i);
  let done = 0; const t0 = Date.now();
  const chunk = Math.ceil(frames.length / WORKERS);
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const mine = frames.slice(w * chunk, (w + 1) * chunk);
    if (!mine.length) return;
    const p = await page(browser);
    for (const i of mine) {
      await p.evaluate((t) => window.renderFrame(t), i / FPS);
      await p.screenshot({ path: path.join(outDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (++done % 120 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
    }
  }));
  console.log(`rendered ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})();
