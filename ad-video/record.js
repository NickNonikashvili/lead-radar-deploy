// Records smooth footage of the EvoSoft site: everything on the page (CSS animations, transitions, JS timers,
// requestAnimationFrame) runs at RATE speed while Chromium's screencast captures frames in real time; each frame's
// time is then scaled back, giving RATE-times-more frames per second of video.
//   node record.js <clip|all>
// Output: clips/<name>/f000123.jpg + clips/<name>/index.json [{ f, t }] with t in video seconds.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RATE = 0.25;
const BASE = 'http://127.0.0.1:8400';
const OUT = path.join(__dirname, 'clips');

const TIME_SCALE = `(() => {
  const RATE = ${RATE};
  const rNow = performance.now.bind(performance), rDate = Date.now, RD = Date;
  const p0 = rNow(), d0 = rDate();
  const v = () => (rNow() - p0) * RATE;
  performance.now = () => p0 + v();
  Date.now = () => d0 + v();
  const sT = window.setTimeout, sI = window.setInterval, rAF = window.requestAnimationFrame;
  window.setTimeout = function (fn, ms, ...a) { return sT(fn, (Number(ms) || 0) / RATE, ...a); };
  window.setInterval = function (fn, ms, ...a) { return sI(fn, (Number(ms) || 0) / RATE, ...a); };
  window.requestAnimationFrame = (cb) => rAF((ts) => cb(p0 + (ts - p0) * RATE));
  try { sessionStorage.setItem('evo-chat-teaser', '1'); } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'html{scroll-behavior:auto!important}::-webkit-scrollbar{display:none}';
    document.head.appendChild(s);
  });
})();`;

// ---------- helpers, in video time ----------
function helpers(page) {
  const wait = (ms) => page.waitForTimeout(ms / RATE);
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  async function scrollTo(y, ms = 1200, offset = 90) {
    const from = await page.evaluate(() => window.scrollY);
    const to = typeof y === 'number' ? y : await page.evaluate(([sel, off]) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top + window.scrollY - off : window.scrollY; }, [y, offset]);
    const steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((yy) => window.scrollTo(0, yy), from + (to - from) * ease(i / steps));
      await wait(ms / steps);
    }
  }
  let mouse = { x: 720, y: 450 };
  async function moveTo(x, y, ms = 600) {
    const steps = Math.max(2, Math.round(ms / 16));
    const sx = mouse.x, sy = mouse.y;
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      await page.mouse.move(sx + (x - sx) * k, sy + (y - sy) * k);
      await wait(ms / steps);
    }
    mouse = { x, y };
  }
  async function moveToEl(sel, ms = 600, dx = 0.5, dy = 0.5) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error('no element ' + sel);
    await moveTo(box.x + box.width * dx, box.y + box.height * dy, ms);
  }
  async function click(sel, ms = 600) {
    await moveToEl(sel, ms);
    await page.mouse.down(); await wait(90); await page.mouse.up();
  }
  async function type(sel, text, cps = 16) {
    await page.locator(sel).first().focus();
    for (const ch of Array.from(text)) { await page.keyboard.type(ch); await wait(1000 / cps); }
  }
  return { wait, scrollTo, moveTo, moveToEl, click, type };
}

// A visible pointer for the recording (the screencast doesn't show the system cursor).
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div');
    c.id = '__cur';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l16 9.5-7 1.6-3.6 6.6z" fill="#14213D" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))';
    document.documentElement.appendChild(c);
    document.addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 5) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
    document.addEventListener('mousedown', () => { c.firstChild.style.transform = 'scale(.85)'; }, true);
    document.addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`;

// ---------- the clips ----------
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 / 3 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true };

const CLIPS = {
  hero: { ctx: DESKTOP, url: '/index.html', cursor: false, async run(page, h) {
    await page.evaluate(() => { const c = document.querySelector('.demo-card'); if (c) c.style.setProperty('--dur', '3400ms'); });
    await h.wait(12500);
  } },
  services: { ctx: DESKTOP, url: '/index.html', settle: 2500, async run(page, h) {
    await h.wait(300);
    await h.scrollTo('.marquee', 1300, 420);
    await h.wait(1600);
    h.mark('grid');
    await h.scrollTo('.sec.alt .sec-head', 1500, 110);
    await h.wait(500);
    await h.moveToEl('.svc-grid .svc:nth-child(1)', 700);
    await h.wait(600);
    await h.moveToEl('.svc-grid .svc:nth-child(2)', 600);
    h.mark('stores');
    await h.wait(900);
    await h.moveToEl('.svc-grid .svc:nth-child(3)', 600);
    h.mark('booking');
    await h.wait(1300);
    await h.moveToEl('.svc-grid .svc:nth-child(8)', 700);
    h.mark('m365');
    await h.wait(1300);
    await h.moveTo(720, 860, 900);
    await h.wait(900);
  } },
  products: { ctx: DESKTOP, url: '/index.html', settle: 2500, async run(page, h) {
    await h.scrollTo('.tiles', 1400, 260);
    await h.wait(600);
    await h.moveToEl('.tiles .tile:nth-child(1)', 700, 0.6, 0.35);
    await h.moveToEl('.tiles .tile:nth-child(1)', 700, 0.3, 0.6);
    await h.moveToEl('.tiles .tile:nth-child(2)', 700, 0.6, 0.4);
    await h.moveToEl('.tiles .tile:nth-child(3)', 800, 0.5, 0.35);
    await h.moveToEl('.tiles .tile:nth-child(4)', 800);
    await h.wait(1200);
  } },
  evopage: { ctx: DESKTOP, url: '/work/evo.html', cursor: false, staticCounts: true, async run(page, h) {
    await h.wait(1600);
    await h.scrollTo(520, 2600);
    await h.wait(1200);
  } },
  demos: { ctx: DESKTOP, url: '/demos.html', settle: 2000, async run(page, h) {
    await h.scrollTo('#evo .accts', 1500);
    h.mark('cards');
    await h.wait(300);
    for (const n of [1, 2, 3, 5, 6]) { await h.moveToEl(`#evo .acct:nth-child(${n}) .role`, 650); await h.wait(250); }
    h.mark('tour');
    await h.moveToEl('#evo .acct:nth-child(1) .cred div:nth-child(1) .copy', 800);
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    h.mark('copied');
    await h.wait(450);
    await h.click('#evo .acct:nth-child(1) .cred div:nth-child(2) .copy', 450);
    await h.wait(350);
    await page.evaluate(() => document.querySelector('#evo .acct:nth-child(1) .acc-go').addEventListener('click', (e) => e.preventDefault(), true));
    await h.moveToEl('#evo .acct:nth-child(1) .acc-go', 650);
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    h.mark('toast');
    await h.wait(2400);
  } },
  process: { ctx: DESKTOP, url: '/index.html', settle: 2500, async run(page, h) {
    await h.scrollTo('.trail', 1700, 330);
    await h.wait(3000);
    h.mark('faq');
    await h.scrollTo('.faq', 1200, 240);
    await h.wait(300);
    await h.click('.faq details:nth-child(1) summary', 700);
    await h.wait(1300);
    await h.click('.faq details:nth-child(2) summary', 600);
    await h.wait(1500);
  } },
  languages: { ctx: DESKTOP, url: '/index.html', settle: 3200, async run(page, h) {
    const pick = async (code) => {
      await h.click('.lang-btn', 600);
      await h.wait(500);
      await h.moveToEl(`.lang-menu a[data-lang="${code}"]`, 500);
      await h.wait(200);
      h.mark(code);
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.mouse.down().then(() => page.mouse.up())]);
      await page.evaluate(() => { const c = document.querySelector('.demo-card'); if (c) c.style.setProperty('--dur', '3400ms'); });
      await h.wait(2300);
    };
    await h.wait(400);
    await pick('ka');
    await pick('ru');
    await pick('es');
    await h.wait(1200);
    h.mark('esmenu');
    await h.click('.lang-btn', 600);
    await h.wait(400);
    await h.moveToEl('.lang-menu a[data-lang="ka"]', 500);
    await h.wait(300);
    await h.moveToEl('.lang-menu a[data-lang="ru"]', 400);
    await h.wait(300);
    await h.moveToEl('.lang-menu a[data-lang="es"]', 400);
    await h.wait(900);
    await page.keyboard.press('Escape');
    await h.wait(1500);
  } },
  assistant: { ctx: DESKTOP, url: '/index.html', settle: 2000, setup: async (page) => { await page.evaluate(() => sessionStorage.setItem('evo-chat-teaser', '1')); }, async run(page, h) {
    await h.click('.chat-launch', 900);
    h.mark('open');
    await h.wait(900);
    await h.moveToEl('.chat-suggest button:nth-child(2)', 700);
    await h.wait(300);
    await h.moveToEl('.chat-suggest button:last-child', 600);
    await h.wait(700);
    h.mark('pick');
    await h.click('.chat-suggest button:last-child', 250);
    h.mark('sent');
    await h.wait(3800);
  } },
  quote: { ctx: DESKTOP, url: '/contact.html', settle: 1800, async run(page, h) {
    h.mark('form');
    await h.click('input[name=name]', 700);
    await h.type('input[name=name]', 'Nino Beridze', 16);
    await h.click('input[name=email]', 500);
    await h.type('input[name=email]', 'nino@example.ge', 18);
    await h.moveToEl('input[value="Website"] + span', 600);
    h.mark('chip');
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    await h.wait(250);
    await h.click('input[value="Online store"] + span', 500);
    await h.wait(250);
    await h.click('textarea[name=message]', 600);
    h.mark('msg');
    await h.type('textarea[name=message]', 'We need a new website with an online store for our bakery.', 26);
    await h.wait(300);
    await h.moveToEl('.form-foot .btn', 700);
    h.mark('sent');
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    await h.wait(2800);
  } },
  mobile: { ctx: PHONE, url: '/index.html', cursor: false, staticCounts: true, async run(page, h) {
    await h.wait(2200);
    await h.scrollTo(700, 1500);
    await h.wait(700);
    await page.addStyleTag({ content: '*{transition:none!important}' });
    const tb = await page.locator('.theme-toggle').boundingBox();
    h.mark('dark');
    await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await h.wait(1000);
    await h.scrollTo(1500, 1600);
    await h.wait(900);
    await h.scrollTo(0, 1200);
    await h.wait(400);
    h.mark('menu');
    await page.locator('.menu-toggle').tap();
    await h.wait(1600);
  } },
};

async function record(name) {
  const clip = CLIPS[name];
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...clip.ctx, colorScheme: 'light', locale: 'en-US', reducedMotion: 'no-preference' });
  await ctx.addInitScript(TIME_SCALE);
  if (clip.cursor !== false) await ctx.addInitScript(CURSOR);
  if (clip.staticCounts) await ctx.addInitScript(() => { const o = IntersectionObserver.prototype.observe; IntersectionObserver.prototype.observe = function (el) { if (el && el.hasAttribute && el.hasAttribute('data-count')) return; return o.call(this, el); }; });
  // The demos are live on the real server but unreachable from this sandbox: answer their status checks as the
  // live site would, so the cards show "Live" instead of "Offline right now".
  await ctx.route(/^https:\/\/(evo|mail|studycat)-demo\.evosoft\.solutions\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>demo</title>' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: RATE });
  const h = helpers(page);
  // Clips that start further down the page load it first, without recording.
  if (clip.settle) {
    await page.goto(BASE + clip.url, { waitUntil: 'networkidle' });
    if (clip.setup) await clip.setup(page);
    await h.wait(clip.settle);
  }
  const frames = [], marks = [];
  let n = 0, t0 = null, writing = Promise.resolve();
  h.mark = (label) => marks.push({ label, real: Date.now() });
  cdp.on('Page.screencastFrame', (f) => {
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    const ts = f.metadata.timestamp;
    if (t0 === null) t0 = ts;
    const file = `f${String(n++).padStart(6, '0')}.jpg`;
    frames.push({ f: file, t: Number(((ts - t0) * RATE).toFixed(5)), real: Date.now() });
    const buf = Buffer.from(f.data, 'base64');
    writing = writing.then(() => fs.promises.writeFile(path.join(dir, file), buf));
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  if (!clip.settle) {
    await page.goto(BASE + clip.url, { waitUntil: 'commit' });
    if (clip.setup) await clip.setup(page);
  } else {
    await page.mouse.move(720, 450);
  }
  await clip.run(page, h);
  await cdp.send('Page.stopScreencast');
  await writing;
  const markT = {};
  for (const m of marks) { const f = frames.find((x) => x.real >= m.real) || frames[frames.length - 1]; markT[m.label] = f.t; }
  frames.forEach((f) => delete f.real);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ name, rate: RATE, viewport: clip.ctx.viewport, dsf: clip.ctx.deviceScaleFactor, marks: markT, frames }));
  console.log('  marks', JSON.stringify(markT));
  const dur = frames.length ? frames[frames.length - 1].t : 0;
  console.log(`${name}: ${frames.length} frames, ${dur.toFixed(2)}s of video (${(frames.length / Math.max(dur, 0.01)).toFixed(0)} fps)${errors.length ? ' ERRORS: ' + errors.join(' | ') : ''}`);
  await browser.close();
}

(async () => {
  const which = process.argv[2] || 'all';
  const names = which === 'all' ? Object.keys(CLIPS) : which.split(',');
  for (const n of names) await record(n);
})();
