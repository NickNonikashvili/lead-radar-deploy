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
function helpers(page, start = [720, 450]) {
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
  let mouse = { x: start[0], y: start[1] };
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
  products: { ctx: DESKTOP, url: '/index.html', settle: 2500, mouseStart: [40, 700], async run(page, h) {
    await h.scrollTo('.tiles', 1400, 260);
    await h.wait(300);
    await h.moveToEl('.tiles .tile:nth-child(1)', 700, 0.6, 0.35);
    h.mark('evo');
    await h.wait(150);
    await h.moveToEl('.tiles .tile:nth-child(2)', 550, 0.6, 0.4);
    h.mark('mailtabs');
    await h.wait(250);
    await h.moveToEl('.tiles .tile:nth-child(3)', 550, 0.5, 0.35);
    h.mark('studycat');
    await h.wait(1900);
    // the empty lower part of the "Your project" card, so the pointer covers no text
    await h.moveToEl('.tiles .tile:nth-child(4)', 800, 0.5, 0.88);
    h.mark('yours');
    await h.wait(2600);
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
    await h.moveToEl('#evo .acct:nth-child(1) .cred div:nth-child(1) .copy', 800, 0.87);
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    h.mark('copied');
    await h.wait(450);
    await h.moveToEl('#evo .acct:nth-child(1) .cred div:nth-child(2) .copy', 450, 0.87);
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    await h.wait(350);
    await page.evaluate(() => document.querySelector('#evo .acct:nth-child(1) .acc-go').addEventListener('click', (e) => e.preventDefault(), true));
    await h.moveToEl('#evo .acct:nth-child(1) .acc-go', 650);
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    h.mark('toast');
    await h.wait(200);
    await h.moveTo(1395, 520, 650);
    await h.wait(1600);
  } },
  process: { ctx: DESKTOP, url: '/index.html', settle: 3000, cursor: false, setup: async (page) => {
    // only the four steps: the next section's content is hidden; the steps wait in grey and light up one at a time
    await page.addStyleTag({ content: `.sec:has(.trail) + .sec .wrap, .more { visibility: hidden }
      html .trail li .trail-n { filter: grayscale(1) brightness(1.35); }
      html .trail li:last-child .trail-n { filter: grayscale(1) brightness(0.97); }
      html .trail li.lit .trail-n { filter: none; animation: __lit .55s cubic-bezier(.3, 1.6, .5, 1) !important; }
      @keyframes __lit { from { transform: scale(.55); filter: grayscale(1) brightness(1.35); } }
      html .trail li.lit:last-child .trail-n { animation-name: __lit4 !important; }
      @keyframes __lit4 { from { transform: scale(.55); filter: grayscale(1) brightness(0.97); } }` });
    // the section sits centred under the header, with even margins above and below ("All services" above it is hidden)
    await page.evaluate(() => { const t = document.querySelector('.trail'); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 400); });
    await page.waitForFunction(() => document.querySelector('.trail').classList.contains('drawn'), null, { timeout: 20000 });
  }, async run(page, h) {
    await h.wait(800);
    for (let n = 1; n <= 4; n++) {
      h.mark('lit' + n);
      await page.evaluate((i) => document.querySelector(`.trail li:nth-child(${i})`).classList.add('lit'), n);
      await h.wait(1000);
    }
    h.mark('faq');
    await h.scrollTo('.faq', 1200, 240);
    await h.wait(300);
    await h.click('.faq details:nth-child(1) summary', 700);
    await h.wait(1300);
    await h.click('.faq details:nth-child(2) summary', 600);
    await h.wait(1500);
  } },
  languages: { ctx: DESKTOP, url: '/index.html', settle: 3200, staticCounts: true, async run(page, h) {
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
    h.mark('enmenu');
    await h.click('.lang-btn', 600);
    await h.wait(450);
    await h.moveToEl('.lang-menu a[data-lang="en"]', 500);
    await h.wait(200);
    h.mark('en');
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.mouse.down().then(() => page.mouse.up())]);
    await page.evaluate(() => { const c = document.querySelector('.demo-card'); if (c) c.style.setProperty('--dur', '3400ms'); });
    await h.wait(2600);
  } },
  assistant: { ctx: DESKTOP, url: '/index.html', settle: 2000, chatButton: true, staticCounts: true, mouseStart: [1400, 640], setup: async (page) => { await page.evaluate(() => sessionStorage.setItem('evo-chat-teaser', '1')); }, async run(page, h) {
    await h.wait(1000);
    await h.click('.chat-launch', 900);
    h.mark('open');
    await h.wait(900);
    await h.moveToEl('.chat-suggest button:last-child', 900);
    await h.wait(900);
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
    await h.scrollTo('textarea[name=message]', 900, 330);
    await h.click('textarea[name=message]', 600);
    h.mark('msg');
    await h.type('textarea[name=message]', 'We need a new website with an online store for our bakery.', 26);
    await h.wait(300);
    await h.moveToEl('.form-foot .btn', 700);
    h.mark('sent');
    await page.mouse.down(); await h.wait(90); await page.mouse.up();
    await h.wait(300);
    // into the empty space under the right-hand cards: off the button and clear of the thank-you text below it
    const side = await page.locator('.quote-side').first().boundingBox();
    await h.moveTo(side ? side.x + side.width * 0.6 : 1100, 620, 700);
    await h.wait(5200);
  } },
  mobile: { ctx: PHONE, url: '/index.html', cursor: false, staticCounts: true, chatButton: true, async run(page, h) {
    await page.waitForLoadState('domcontentloaded');
    await page.addStyleTag({ content: 'html .rv { opacity: 1 !important; transform: none !important; }' });
    await h.wait(2200);
    await h.scrollTo(700, 1500);
    await h.wait(700);
    await page.addStyleTag({ content: '*{transition:none!important}' });
    const tb = await page.locator('.theme-toggle').boundingBox();
    const tx = tb.x + tb.width / 2, ty = tb.y + tb.height / 2;
    await page.evaluate(([x, y]) => {
      const st = document.createElement('style');
      st.textContent = '@keyframes __tap{0%{transform:scale(.35);opacity:0}25%{opacity:.85}100%{transform:scale(1.5);opacity:0}}';
      document.head.appendChild(st);
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;background:rgba(26,100,214,.35);border:2px solid rgba(26,100,214,.7);pointer-events:none;z-index:2147483647;animation:__tap .7s ease-out forwards`;
      document.documentElement.appendChild(r);
    }, [tx, ty]);
    await h.wait(220);
    h.mark('dark');
    await page.touchscreen.tap(tx, ty);
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
  // The floating "Ask EvoSoft" button only belongs in the chat scene; elsewhere a zoom would clip it.
  if (!clip.chatButton) await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.chat-launch{display:none!important}'; document.head.appendChild(st); }); });
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
  const h = helpers(page, clip.mouseStart);
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
    await page.mouse.move(...(clip.mouseStart || [720, 450]));
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
