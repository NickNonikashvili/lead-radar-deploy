/* The home page hero: 3D spheres on a black glossy floor, as in the EvoSoft film.
   The spheres are rendered in Blender (glossy blue, neon pink, white, chrome) from 7 angles around the front, seen from above and
   from below (the view below is their reflection in the floor). Each sphere shows the view that matches where the camera
   sees it from, so its highlights stay put in the world while the camera drifts with the pointer and the scroll.
   Now and then a sphere drops out of the dark and bounces. © 2026 EvoSoft Solutions. All rights reserved. */
(() => {
  'use strict';
  const canvas = document.querySelector('canvas.orbs');
  if (!canvas || !canvas.getContext) return;
  const hero = canvas.closest('.hero');
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 700px)').matches;
  const TILE = 128, VIEWS = 7, STEP = 20;            // the sprite strips: 7 views, every 20 degrees, from -60 to +60
  const G = 9.8, HORIZON = 0.73;                       // the floor's horizon sits where the CSS draws its line of light
  const KINDS = ['blue', 'pink', 'white', 'chrome'];
  const img = {};
  let W = 0, H = 0, DPR = 1, F = 1, ready = 0, raf = 0, visible = true, t0 = performance.now();

  // a seeded random, so the layout is the same on every visit
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // few, large and dark, at the edges of the frame: the middle belongs to the slogan
  const N = small ? 7 : 15;
  const cone = small ? [0.2, 0.42] : [0.52, 1.05];     // how far off the centre line (x / depth) a sphere may sit
  const spheres = [];
  for (let i = 0; i < N; i++) {
    const big = i < (small ? 1 : 3);
    const r = big ? 0.55 + rnd() * 0.5 : 0.12 + Math.pow(rnd(), 1.6) * 0.38;
    const z = big ? 6.5 + rnd() * 5 : 5 + rnd() * 22;
    const side = i % 2 ? -1 : 1, x = side * z * (cone[0] + rnd() * (cone[1] - cone[0]));
    const float = !big && !small && rnd() < 0.3;
    const k = rnd(), kind = i === 1 ? 'pink' : k < 0.48 ? 'blue' : k < 0.64 ? 'pink' : k < 0.82 ? 'white' : 'chrome';
    spheres.push({ x, z, r, kind, y0: float ? r + 0.6 + rnd() * 2.6 : r, float, ph: rnd() * 6.28, sp: 0.25 + rnd() * 0.4, drift: (rnd() - 0.5) * 0.05 });
  }
  // the occasional drop: a sphere falls out of the dark, bounces and comes to rest; a ring spreads on the floor
  const drops = [];
  let nextDrop = 2.6;
  function spawnDrop(t) {
    const side = rnd() < 0.5 ? -1 : 1, z = 7 + rnd() * 9, r = 0.16 + rnd() * 0.22;
    drops.push({ x: side * z * (cone[0] + rnd() * (cone[1] - cone[0]) * 0.6), z, r, kind: rnd() < 0.5 ? 'blue' : rnd() < 0.6 ? 'pink' : 'chrome', t, h: 7 + rnd() * 3 });
    if (drops.length > 6) drops.shift();
    nextDrop = t + 5 + rnd() * 5;
  }
  function dropY(d, t) {                               // height of a dropped sphere's centre above the floor
    let tt = t - d.t, h = d.h, v = 0, e = 0.42;
    const tf = Math.sqrt(2 * h / G);
    if (tt < tf) return { y: d.r + h - 0.5 * G * tt * tt, hit: -1 };
    tt -= tf; v = G * tf * e; let hits = 0, since = tt;
    for (let i = 0; i < 6; i++) { const tb = 2 * v / G; if (tt < tb) return { y: d.r + v * tt - 0.5 * G * tt * tt, hit: since }; tt -= tb; v *= e; hits++; }
    return { y: d.r, hit: since };
  }

  // camera: drifts with the pointer, rises a little as you scroll
  const cam = { x: 0, y: 1.05, tx: 0, ty: 1.05, scroll: 0 };
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; cam.tx = (e.clientX / innerWidth - 0.5) * 1.4; cam.ty = 1.05 + (e.clientY / innerHeight - 0.5) * -0.35; }, { passive: true });
  window.addEventListener('scroll', () => { cam.scroll = Math.min(1, scrollY / Math.max(1, hero.offsetHeight)); }, { passive: true });

  function resize() {
    const b = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = Math.max(1, Math.round(b.width * DPR)); H = Math.max(1, Math.round(b.height * DPR));
    canvas.width = W; canvas.height = H; F = H * 0.95;
    draw(performance.now());
  }
  // a point in the world -> the screen (a camera with a shifted lens: the horizon sits at HORIZON of the height)
  function project(x, y, z) {
    const cy = cam.y + cam.scroll * 0.9, dz = z + cam.scroll * 1.5;
    if (dz < 0.6) return null;
    return { sx: W / 2 + F * (x - cam.x) / dz, sy: H * HORIZON + F * (cy - y) / dz, s: F / dz };
  }
  function view(x, z) {                               // which Blender view, and how far between it and the next
    const a = Math.atan2(cam.x - x, z) * 180 / Math.PI;   // the direction the camera sees the sphere from
    const f = Math.max(0, Math.min(VIEWS - 1.001, a / STEP + (VIEWS - 1) / 2));
    return [Math.floor(f), f - Math.floor(f)];
  }
  function sprite(kind, x, z, sx, sy, d, row, alpha) {
    const [i, w] = view(x, z), im = img[kind];
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, i * TILE, row * TILE, TILE, TILE, sx - d / 2, sy - d / 2, d, d);
    if (w > 0.02) { ctx.globalAlpha = alpha * w; ctx.drawImage(im, (i + 1) * TILE, row * TILE, TILE, TILE, sx - d / 2, sy - d / 2, d, d); }
  }
  function ball(b, y, t) {
    const p = project(b.x, y, b.z), f = project(b.x, 0, b.z);
    if (!p || !f) return;
    const d = 2.04 * b.r * p.s, fog = Math.max(0.08, Math.min(1, 1.12 - b.z / 21)) * (b.kind === 'white' ? 0.78 : 0.95), lift = y - b.r;
    if (p.sx < -d || p.sx > W + d) return;
    // shadow on the floor
    const sh = Math.max(0, 0.6 - lift * 0.35) * fog;
    if (sh > 0.02) {
      const g = ctx.createRadialGradient(f.sx, f.sy, 0, f.sx, f.sy, b.r * p.s * 1.5);
      g.addColorStop(0, `rgba(0,0,0,${sh})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.save(); ctx.translate(f.sx, f.sy); ctx.scale(1, 0.22); ctx.translate(-f.sx, -f.sy);
      ctx.beginPath(); ctx.arc(f.sx, f.sy, b.r * p.s * 1.5, 0, 6.283); ctx.fill(); ctx.restore();
    }
    // reflection: the view from below, upside down, under the floor
    const m = project(b.x, -y, b.z);
    if (m) {
      ctx.save(); ctx.translate(m.sx, m.sy); ctx.scale(1, -1); ctx.translate(-m.sx, -m.sy);
      sprite(b.kind, b.x, b.z, m.sx, m.sy, d, 1, 0.3 * fog * Math.max(0, 1 - lift * 0.3));
      ctx.restore();
    }
    sprite(b.kind, b.x, b.z, p.sx, p.sy, d, 0, fog);
  }
  function ring(x, z, age) {
    const f = project(x, 0, z); if (!f) return;
    const k = Math.min(1, age / 1.6), rad = (0.2 + 2.4 * (1 - Math.pow(1 - k, 3))) * f.s;
    ctx.globalAlpha = 0.55 * (1 - k); ctx.strokeStyle = 'rgba(150,185,255,1)'; ctx.lineWidth = Math.max(1, 1.4 * DPR);
    ctx.beginPath(); ctx.ellipse(f.sx, f.sy, rad, rad * 0.16, 0, 0, 6.283); ctx.stroke();
  }
  function draw(now) {
    if (ready < KINDS.length) return;
    const t = (now - t0) / 1000;
    cam.x += (cam.tx - cam.x) * 0.035; cam.y += (cam.ty - cam.y) * 0.035;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!reduce && t > nextDrop) spawnDrop(t);
    const list = spheres.map((b) => {
      const x = reduce ? b.x : b.x + Math.sin(t * 0.05 + b.ph) * b.drift * 20;
      return { b: { ...b, x }, y: b.float && !reduce ? b.y0 + Math.sin(t * b.sp + b.ph) * 0.18 : b.y0 };
    });
    for (const d of drops) { const s = dropY(d, t); list.push({ b: d, y: s.y, ring: s.hit }); }
    list.sort((a, b) => b.b.z - a.b.z);
    for (const it of list) {
      if (it.ring !== undefined && it.ring >= 0 && it.ring < 1.6) ring(it.b.x, it.b.z, it.ring);
      ball(it.b, it.y, t);
    }
    ctx.globalAlpha = 1;
    canvas.style.opacity = String(1 - cam.scroll * 0.9);
  }
  function loop(now) { raf = 0; draw(now); if (visible && !reduce) raf = requestAnimationFrame(loop); }
  function start() { if (!raf && visible && !reduce) raf = requestAnimationFrame(loop); }

  // a strip that fails to load is replaced by the blue one, so the scene still draws
  const done = () => { if (++ready === KINDS.length) { KINDS.forEach((k) => { if (!img[k]) img[k] = img.blue || Object.values(img)[0]; }); if (Object.values(img)[0]) { resize(); canvas.classList.add('on'); start(); } } };
  KINDS.forEach((k) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { img[k] = im; done(); };
    im.onerror = done;
    im.src = canvas.dataset.src + k + '.webp';
  });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) start(); });
})();
