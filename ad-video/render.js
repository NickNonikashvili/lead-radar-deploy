// Renders the timeline to JPEG frames with several headless browsers in parallel.
//   node render.js <outDir> [fps=30] [workers=3] [from=0] [to=end] [step=1]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [outDir, fpsArg, workersArg, fromArg, toArg, stepArg] = process.argv.slice(2);
const FPS = Number(fpsArg || 30), WORKERS = Number(workersArg || 3), STEP = Number(stepArg || 1);
const URL = 'http://127.0.0.1:8500/comp/index.html';
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const tl = JSON.parse(fs.readFileSync(path.join(__dirname, 'comp/timeline.json'), 'utf8'));
  const total = Math.round(tl.duration * FPS);
  const from = Number(fromArg || 0), to = Math.min(total, Number(toArg || total));
  const frames = [];
  for (let i = from; i < to; i += STEP) frames.push(i);
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  let done = 0; const t0 = Date.now();
  const chunk = Math.ceil(frames.length / WORKERS);
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const mine = frames.slice(w * chunk, (w + 1) * chunk);
    if (!mine.length) return;
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.ready);
    for (const i of mine) {
      await page.evaluate((t) => window.renderFrame(t), i / FPS);
      await page.screenshot({ path: path.join(outDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (++done % 150 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
    }
  }));
  await browser.close();
  console.log(`rendered ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
