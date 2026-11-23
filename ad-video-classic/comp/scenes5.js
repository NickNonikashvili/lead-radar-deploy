// EvoSoft ad, studio version: told in pictures in the same world as the client's 3D logo reveal (dark studio,
// glossy floor, blue and white spheres), so the reveal at the end feels like the same film.
// A sphere drops, a website draws itself out of the ripple -> it becomes the real EvoSoft site -> phones and pages ->
// the apps EvoSoft built -> an online store whose orders fall as spheres -> they grow into bars -> the site in Georgian
// -> everything collapses into a rain of spheres, which is where the logo reveal begins.
(() => {
  'use strict';
  const { ease, textures: T, clamp, lerp, D0 } = E;
  let TL, SC;
  const FY = -0.75;                       // floor height
  const k01 = (t, a, b, e = ease.io) => e((t - a) / Math.max(1e-6, b - a));
  const dur = (id) => SC[id][1] - SC[id][0];
  let CAM = [0, 0, D0];
  const cam = (o) => { CAM = o.pos; E.camera(o); };
  const float = (t, s = 1) => [Math.sin(t * 0.7) * 0.012 * s + Math.sin(t * 1.7 + 1) * 0.005 * s, Math.cos(t * 0.6) * 0.01 * s + Math.sin(t * 1.3 + 2) * 0.004 * s];

  window.ready = (async () => {
    TL = await (await fetch('../timeline5.json', { cache: 'no-store' })).json();
    SC = TL.scenes; window.DURATION = TL.duration;
    await Promise.all(['700 80px Figtree', '500 80px Figtree', '800 80px Gabarito'].map((f) => document.fonts.load(f, 'AaBb')));
    const img = {};
    await Promise.all(['home', 'services', 'mobile', 'mobile_ka', 'evo', 'mailtabs', 'studycat', 'store', 'reports'].map(async (k) => { const i = new Image(); i.src = `../shots/${k}.jpg`; await i.decode(); img[k] = i; }));
    await E.loadTex('glow', '../art/glow.png');
    for (const k of ['home', 'services', 'evo', 'mailtabs', 'studycat', 'store', 'reports']) T['p_' + k] = panelTex(img[k]);
    T.ph_en = phoneTex(img.mobile); T.ph_ka = phoneTex(img.mobile_ka);
    T.s_blue = sphereTex('blue'); T.s_white = sphereTex('white'); T.s_chrome = sphereTex('chrome');
    T.shadow = blobTex(); T.ring = ringTex(); T.floor = floorTex();
    const o = outlineTex(); T.outline = o.tex; T.outline_rev = o.rev;
    T.toast = [['New order', '2 items · 86.00 ₾'], ['New order', '1 item · 42.50 ₾'], ['Payment received', '128.00 ₾'], ['New order', '3 items · 64.00 ₾'], ['New order', '4 items · 152.00 ₾']].map(([a, b]) => toastTex(a, b));
    T.glass = glassTex(); T.sweep = sweepTex(); T.backdrop = backdropTex();
  })();

  // ---------- textures ----------
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  // a website/app screen on a dark glass slab with rounded corners and a fine bright rim
  function panelTex(im) {
    const W = 1600, H = 1000, [c, x] = cv(W, H);
    rr(x, 0, 0, W, H, 34); x.fillStyle = '#0b0e14'; x.fill();
    x.save(); rr(x, 14, 14, W - 28, H - 28, 24); x.clip(); x.drawImage(im, 0, 0, im.width, im.width / 1.6, 14, 14, W - 28, H - 28);
    const g = x.createLinearGradient(0, 0, W * 0.6, H); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
    rr(x, 2, 2, W - 4, H - 4, 33); x.strokeStyle = 'rgba(170,200,255,.55)'; x.lineWidth = 3; x.stroke();
    return E.texFromSource(c);
  }
  function phoneTex(im) {
    const W = 620, H = 1260, [c, x] = cv(W, H);
    rr(x, 0, 0, W, H, 92); x.fillStyle = '#0d1015'; x.fill();
    rr(x, 5, 5, W - 10, H - 10, 88); x.strokeStyle = '#5a6478'; x.lineWidth = 5; x.stroke();
    x.save(); rr(x, 26, 26, W - 52, H - 52, 70); x.clip();
    const sh = im.width * (H - 52) / (W - 52); x.drawImage(im, 0, 0, im.width, sh, 26, 26, W - 52, H - 52); x.restore();
    rr(x, W / 2 - 70, 46, 140, 38, 19); x.fillStyle = '#05060a'; x.fill();
    return E.texFromSource(c);
  }
  function sphereTex(kind) {
    const S = 256, [c, x] = cv(S, S), r = S / 2 - 2;
    x.beginPath(); x.arc(S / 2, S / 2, r, 0, Math.PI * 2); x.closePath(); x.save(); x.clip();
    const base = { blue: ['#9cc2ff', '#3b78e8', '#123f9e', '#06173d'], white: ['#ffffff', '#e8ebf2', '#a9afbd', '#4a4f5c'], chrome: ['#f4f7ff', '#8a93a6', '#2a2f3a', '#0b0d12'] }[kind];
    const g = x.createRadialGradient(S * 0.38, S * 0.32, S * 0.02, S * 0.5, S * 0.5, r);
    g.addColorStop(0, base[0]); g.addColorStop(0.35, base[1]); g.addColorStop(0.8, base[2]); g.addColorStop(1, base[3]);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    if (kind === 'chrome') { x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, S * 0.52, S, S * 0.05); x.fillStyle = 'rgba(120,160,255,.35)'; x.fillRect(0, S * 0.62, S, S * 0.12); }
    const rim = x.createRadialGradient(S * 0.5, S * 0.5, r * 0.75, S * 0.5, S * 0.5, r);
    rim.addColorStop(0, 'rgba(120,170,255,0)'); rim.addColorStop(1, kind === 'white' ? 'rgba(150,180,255,.35)' : 'rgba(110,160,255,.45)');
    x.fillStyle = rim; x.fillRect(0, 0, S, S);
    const hl = x.createRadialGradient(S * 0.36, S * 0.29, 0, S * 0.36, S * 0.29, S * 0.13);
    hl.addColorStop(0, 'rgba(255,255,255,.95)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = hl; x.fillRect(0, 0, S, S); x.restore();
    return E.texFromSource(c);
  }
  function blobTex() { const S = 128, [c, x] = cv(S, S); const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return E.texFromSource(c); }
  function ringTex() { const S = 512, [c, x] = cv(S, S); const g = x.createRadialGradient(S / 2, S / 2, S * 0.38, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(140,180,255,0)'); g.addColorStop(0.8, 'rgba(170,205,255,.9)'); g.addColorStop(1, 'rgba(140,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return E.texFromSource(c); }
  function floorTex() {
    const S = 1024, [c, x] = cv(S, S);
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#2a303c'); g.addColorStop(0.3, '#161a22'); g.addColorStop(0.7, '#0a0c10'); g.addColorStop(1, '#050608');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return E.texFromSource(c);
  }
  function backdropTex() {
    const [c, x] = cv(64, 512); const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#010102'); g.addColorStop(0.55, '#05070b'); g.addColorStop(0.9, '#121826'); g.addColorStop(1, '#161d2c');
    x.fillStyle = g; x.fillRect(0, 0, 64, 512); return E.texFromSource(c);
  }
  function glassTex() { const [c, x] = cv(64, 256); const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(70,120,230,.75)'); g.addColorStop(0.4, 'rgba(150,190,255,.85)'); g.addColorStop(0.7, 'rgba(60,110,220,.75)'); g.addColorStop(1, 'rgba(30,60,150,.8)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); return E.texFromSource(c); }
  function sweepTex() { const [c, x] = cv(256, 64); const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 64); return E.texFromSource(c); }
  // a browser-window outline drawn in light, and its reveal map (the order the line is drawn in)
  function outlineTex() {
    const W = 1600, H = 1000, [c, x] = cv(W, H), [rc, rx] = cv(W, H);
    rx.fillStyle = '#fff'; rx.fillRect(0, 0, W, H);
    const pts = [], R = 34, m = 8, bar = 92;
    const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
    const line = (x0, y0, x1, y1, n = 60) => { for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    // start bottom-centre, go both ways at once by drawing two halves with the same timing
    const half = (dir) => { const p = []; const L = W / 2 - m, B = H - m, T0 = m;
      const xs = (v) => W / 2 + dir * v;
      const push = (a, b) => p.push([xs(a), b]);
      for (let i = 0; i <= 40; i++) push((L - R) * i / 40, B);
      for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 * (1 - i / 10); push(L - R + Math.cos(a) * R, B - R + Math.sin(a) * R); }
      for (let i = 0; i <= 60; i++) push(L, B - R - (B - T0 - 2 * R) * i / 60);
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 * i / 10; push(L - R + Math.cos(a) * R, T0 + R + Math.sin(a) * R); }
      for (let i = 0; i <= 40; i++) push(L - R - (L - R) * i / 40, T0);
      return p; };
    const A = half(1), Bh = half(-1);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const draw = (P, ctx, val) => { for (let i = 1; i < P.length; i++) { ctx.beginPath(); ctx.moveTo(...P[i - 1]); ctx.lineTo(...P[i]); if (val) { const v = Math.round(255 * 0.85 * i / P.length); ctx.strokeStyle = `rgb(${v},${v},${v})`; } ctx.stroke(); } };
    x.strokeStyle = 'rgba(190,215,255,1)'; x.lineWidth = 7; draw(A, x); draw(Bh, x);
    rx.lineWidth = 11; rx.lineCap = 'round'; draw(A, rx, true); draw(Bh, rx, true);
    // the browser bar and its three dots appear last
    x.strokeStyle = 'rgba(190,215,255,.9)'; x.lineWidth = 5; x.beginPath(); x.moveTo(m, bar); x.lineTo(W - m, bar); x.stroke();
    rx.strokeStyle = 'rgb(225,225,225)'; rx.lineWidth = 9; rx.beginPath(); rx.moveTo(m, bar); rx.lineTo(W - m, bar); rx.stroke();
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(52 + i * 40, bar / 2 + 4, 11, 0, Math.PI * 2); x.fillStyle = 'rgba(190,215,255,.95)'; x.fill(); rx.beginPath(); rx.arc(52 + i * 40, bar / 2 + 4, 14, 0, Math.PI * 2); rx.fillStyle = `rgb(${232 + i * 6},${232 + i * 6},${232 + i * 6})`; rx.fill(); }
    return { tex: E.texFromSource(c), rev: E.texFromSource(rc, { mip: false }) };
  }
  function toastTex(title, sub) {
    const W = 820, H = 200, [c, x] = cv(W, H);
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 24; x.shadowOffsetY = 8;
    rr(x, 16, 12, W - 32, H - 40, 34); x.fillStyle = 'rgba(255,255,255,.97)'; x.fill(); x.shadowColor = 'transparent';
    x.fillStyle = '#22A447'; x.beginPath(); x.arc(96, H / 2 - 8, 44, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(74, H / 2 - 8); x.lineTo(90, H / 2 + 8); x.lineTo(120, H / 2 - 24); x.stroke();
    x.fillStyle = '#14213D'; x.font = '800 54px Gabarito'; x.fillText(title, 168, H / 2 - 14);
    x.fillStyle = '#536279'; x.font = '500 40px Figtree'; x.fillText(sub, 168, H / 2 + 38);
    x.fillStyle = '#94a3b8'; x.font = '500 34px Figtree'; x.textAlign = 'right'; x.fillText('now', W - 52, H / 2 - 20);
    return E.texFromSource(c);
  }

  // ---------- drawing in the studio: every object is drawn once mirrored under the glossy floor, then for real ----------
  function mirrored(o) {
    const r = o.rot || [0, 0, 0], uv = o.uv || [0, 0, 1, 1];
    return { ...o, pos: [o.pos[0], 2 * FY - o.pos[1], o.pos[2]], rot: [-r[0], r[1], -r[2]], uv: [uv[0], uv[3], uv[2], uv[1]], bright: (o.bright ?? 1) * 0.42, opacity: (o.opacity ?? 1) * 0.65 };
  }
  function billboardRot(p) {
    const dx = CAM[0] - p[0], dy = CAM[1] - p[1], dz = CAM[2] - p[2];
    return [-Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI, Math.atan2(dx, dz) * 180 / Math.PI, 0];
  }
  // a frame's contents: lists of panels, spheres, glows; drawn with reflections, floor, shadows
  function studio(t, out, { panels = [], spheres = [], glows = [], extra = null, floorBright = 1, bg = [0.012, 0.014, 0.02], rings = [] }) {
    E.begin(out, bg);
    // reflections
    for (const p of panels) if ((p.opacity ?? 1) > 0.01 && p.pos[1] - p.size[1] / 2 > FY - 0.4) E.draw(mirrored(p));
    for (const s of spheres) { const m = [s.p[0], 2 * FY - s.p[1], s.p[2]]; E.draw({ tex: T['s_' + s.k], size: [2 * s.r, 2 * s.r], pos: m, rot: billboardRot(m), uv: [0, 1, 1, 0], alphaCut: 0.4, bright: 0.5, opacity: (s.o ?? 1) * 0.8 }); }
    // the floor (glossy: partly see-through to the reflections)
    E.draw({ tex: T.backdrop, size: [40, 14], pos: [0, FY + 6.9, -9], bright: floorBright, depthWrite: false });
    E.draw({ tex: T.floor, size: [18, 18], pos: [0, FY, -1.5], rot: [-90, 0, 0], opacity: 0.87, bright: floorBright });
    for (const g of rings) E.draw({ tex: T.ring, size: [g.r * 2, g.r * 2], pos: [g.x, FY + 0.003, g.z], rot: [-90, 0, 0], opacity: g.o, add: true, depthWrite: false });
    for (const s of spheres) {
      const h = s.p[1] - s.r - FY, so = clamp(1 - h / 1.2, 0, 1) * 0.7 * (s.o ?? 1);
      if (so > 0.01) E.draw({ tex: T.shadow, size: [s.r * (2.4 + h * 1.5), s.r * (2.4 + h * 1.5)], pos: [s.p[0], FY + 0.002, s.p[2]], rot: [-90, 0, 0], opacity: so, depthWrite: false });
    }
    // the real things
    for (const p of panels) if ((p.opacity ?? 1) > 0.01) E.draw({ ...p, bright: p.bright ?? 0.9 });
    for (const s of spheres) E.draw({ tex: T['s_' + s.k], size: [2 * s.r, 2 * s.r], pos: s.p, rot: billboardRot(s.p), alphaCut: 0.4, opacity: s.o ?? 1 });
    if (extra) extra();
    for (const g of glows) if (g.o > 0.002) E.draw({ tex: T.glow, size: [g.s, g.s], pos: g.p, rot: billboardRot(g.p), opacity: g.o, tint: g.c || [0.6, 0.75, 1], add: true, depthWrite: false });
  }
  // a dropped sphere: falls from rest at t0 from height h0 (centre), bounces with restitution e, comes to rest
  function dropY(t, t0, h0, r, e = 0.5, g = 6.5) {
    const ground = FY + r;
    if (t <= t0) return h0;
    let tt = t - t0, h = h0 - ground;
    let tf = Math.sqrt(2 * h / g);
    if (tt < tf) return h0 - 0.5 * g * tt * tt;
    tt -= tf; let v = g * tf * e;
    for (let i = 0; i < 6; i++) { const tb = 2 * v / g; if (tt < tb) return ground + v * tt - 0.5 * g * tt * tt; tt -= tb; v *= e; }
    return ground;
  }
  const impactT = (t0, h0, r, g = 6.5) => t0 + Math.sqrt(2 * (h0 - FY - r) / g);
  const hover = (t, i, amp = 0.05) => Math.sin(t * (0.9 + 0.2 * E.hash(i)) + i * 2.1) * amp;
  const sweep = (p, t, t0, len = 0.8) => { const q = (t - t0) / len; if (q < 0 || q > 1) return; const r = p.rot || [0, 0, 0], ry = r[1] * Math.PI / 180, dx = lerp(-0.38, 0.38, q) * p.size[0]; E.draw({ tex: T.sweep, size: [p.size[0] * 0.22, p.size[1] * 0.97], pos: E.offsetAlong([p.pos[0] + dx * Math.cos(ry), p.pos[1], p.pos[2] - dx * Math.sin(ry)], r, 0.004), rot: r, opacity: 0.28 * Math.sin(q * Math.PI), add: true, depthWrite: false }); };
  // floating background spheres in the dark
  function drifters(t, n = 9, seed = 1, spread = [5.5, 1.3, 1.4], zc = -2.6) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const h1 = E.hash(i * 3.3 + seed), h2 = E.hash(i * 5.1 + seed), h3 = E.hash(i * 7.7 + seed);
      out.push({ k: h3 < 0.62 ? 'blue' : h3 < 0.85 ? 'white' : 'chrome', r: 0.04 + 0.1 * h2 * h2, p: [(h1 - 0.5) * spread[0], FY + 1.25 + h2 * spread[1] + hover(t, i, 0.06), zc + (h3 - 0.5) * spread[2]] });
    }
    return out;
  }

  const SHOT = {};
  const W16 = 1.6;

  // A — a white sphere falls onto the floor; from its ripple a browser window draws itself in light
  SHOT.A = (t, out) => {
    const d = dur('A'), f = float(t, 0.6);
    const A0 = (TL.impactA || 1.24) - Math.sqrt(2 * (3.2 - FY - 0.09) / 6.5), ti = impactT(A0, 3.2, 0.09);   // lands on the song's first bass hit
    cam({ pos: [f[0] + lerp(-0.15, 0.1, t / d), FY + lerp(0.22, 0.45, ease.sine(t / d)) + f[1], lerp(2.4, 2.9, ease.out(t / d))], target: [0, FY + 0.45, 0] });
    const sy = dropY(t, A0, 3.2, 0.09);
    const rq = clamp((t - ti) / 1.6, 0, 1);
    const pan = { tex: T.outline, reveal: T.outline_rev, revealT: k01(t, ti + 0.05, ti + 1.25, ease.out) * 1.02, size: [1.9, 1.9 / W16], pos: [0, FY + 0.62, -0.7], depthWrite: false, opacity: 1 };
    studio(t, out, {
      panels: [pan],
      spheres: [{ k: 'white', r: 0.09, p: [0.02, sy, 0.25] }],
      rings: t > ti ? [{ x: 0.02, z: 0.25, r: lerp(0.1, 3.2, ease.out(rq)), o: 0.8 * (1 - rq) }] : [],
      glows: [{ p: [0, FY + 0.62, -0.75], s: 3.2, o: 0.25 * k01(t, ti, ti + 1.2), c: [0.45, 0.6, 1] }, { p: [0.02, FY + 0.02, 0.25], s: 0.9, o: t > ti ? 0.6 * Math.exp(-(t - ti) * 3) : 0, c: [0.7, 0.85, 1] }],
      floorBright: lerp(0.4, 1, k01(t, 0, 1.0)),
    });
  };

  // B — the outline fills in with the real EvoSoft site; the camera pulls back; spheres drift in the dark
  SHOT.B = (t, out) => {
    const d = dur('B'), f = float(t);
    const k = ease.io(t / d);
    cam({ pos: [lerp(0.1, -0.55, k) + f[0], FY + lerp(0.5, 0.75, k) + f[1], lerp(2.9, 3.6, k)], target: [lerp(0, 0.1, k), FY + 0.62, -0.7] });
    const fill = k01(t, 0.0, 0.7, ease.out);
    const P = { tex: T.p_home, size: [1.9, 1.9 / W16], pos: [0, FY + 0.62, -0.7], opacity: fill };
    studio(t, out, {
      panels: [P, { tex: T.outline, size: P.size, pos: [0, FY + 0.62, -0.695], opacity: 1 - fill, depthWrite: false }],
      spheres: drifters(t, 8, 2).map((s) => ({ ...s, o: k01(t, 0.3, 1.3) })),
      glows: [{ p: [0, FY + 0.62, -0.8], s: 3.6, o: 0.22, c: [0.45, 0.6, 1] }],
      extra: () => sweep(P, t, 0.5, 0.9),
    });
  };

  // C — the same site on a phone and its other pages, rising out of the floor beside it
  SHOT.C = (t, out) => {
    const d = dur('C'), f = float(t);
    cam({ pos: [lerp(-1.1, 0.9, ease.io(t / d)) + f[0], FY + 0.6 + f[1], 3.1], target: [lerp(-0.4, 0.4, ease.io(t / d)), FY + 0.6, -0.8] });
    const r1 = ease.out(k01(t, 0.05, 0.75, ease.lin)), r2 = ease.out(k01(t, 0.35, 1.05, ease.lin));
    const ph = { tex: T.ph_en, size: [0.5, 0.5 * 1260 / 620], pos: [1.35, lerp(FY - 0.6, FY + 0.56, r1), -0.4], rot: [0, -18, 0] };
    const sv = { tex: T.p_services, size: [1.5, 1.5 / W16], pos: [-1.6, lerp(FY - 0.6, FY + 0.5, r2), -0.95], rot: [0, 22, 0] };
    studio(t, out, {
      panels: [{ tex: T.p_home, size: [1.9, 1.9 / W16], pos: [0, FY + 0.62, -0.7] }, ph, sv],
      spheres: drifters(t + 3, 9, 3),
      glows: [{ p: [1.35, FY + 0.6, -0.5], s: 1.6, o: 0.25 * r1, c: [0.5, 0.7, 1] }, { p: [-1.6, FY + 0.5, -1.05], s: 2.2, o: 0.2 * r2, c: [0.5, 0.65, 1] }],
      extra: () => { sweep(ph, t, 0.8, 0.7); },
    });
  };

  // D — the software EvoSoft builds: Evo, Mailtabs and StudyCat fly in and hang in an arc; the camera glides past
  SHOT.D = (t, out) => {
    const d = dur('D'), f = float(t);
    const k = ease.io(t / d);
    cam({ pos: [lerp(-1.6, 1.5, k) + f[0], FY + lerp(0.75, 0.6, k) + f[1], lerp(2.2, 2.5, k)], target: [lerp(-1.1, 1.0, k), FY + 0.68, -1.0] });
    const apps = [['p_evo', -1.75, 0.15], ['p_mailtabs', 0, 0.42], ['p_studycat', 1.75, 0.69]];
    const panels = apps.map(([tex, x, t0], i) => {
      const q = ease.back(k01(t, t0, t0 + 0.55, ease.lin));
      return { tex: T[tex], size: [1.5, 1.5 / W16], pos: [x, lerp(FY + 1.6, FY + 0.7, q), lerp(-3.5, -1.0 - Math.abs(x) * 0.18, q)], rot: [lerp(25, 0, q), -x * 12, lerp(i % 2 ? 10 : -10, 0, q)], opacity: clamp(q * 3, 0, 1) };
    });
    studio(t, out, {
      panels, spheres: drifters(t + 6, 11, 4, [7, 1.3, 1.4], -2.8),
      glows: apps.map(([, x, t0]) => ({ p: [x, FY + 0.7, -1.15], s: 2.2, o: 0.22 * k01(t, t0 + 0.3, t0 + 0.6), c: [0.5, 0.65, 1] })),
      extra: () => panels.forEach((p, i) => sweep(p, t, apps[i][2] + 0.5, 0.7)),
    });
  };

  // E — an online store: orders pop up one after another and each one drops a blue sphere to the floor
  SHOT.E = (t, out) => {
    const d = dur('E'), f = float(t);
    cam({ pos: [lerp(-0.5, 0.2, ease.io(t / d)) + f[0], FY + lerp(0.55, 0.7, t / d) + f[1], lerp(2.7, 2.35, ease.out(t / d))], target: [0.15, FY + 0.7, -0.8] });
    const P = { tex: T.p_store, size: [1.8, 1.8 / W16], pos: [-0.35, FY + 0.72, -1.0], rot: [0, 8, 0] };
    const N = T.toast.length, t0s = Array.from({ length: N }, (_, i) => (i + 1) * 0.4724 - 0.03);   // one order per beat
    const spheres = [], toasts = [];
    for (let i = 0; i < N; i++) {
      if (t < t0s[i]) continue;
      let slot = 0; for (let j = i + 1; j < N; j++) slot += ease.io(k01(t, t0s[j], t0s[j] + 0.22, ease.lin));
      const pop = ease.back(k01(t, t0s[i], t0s[i] + 0.28, ease.lin));
      const p = [0.95, FY + 0.55 + slot * 0.2, -0.55];
      toasts.push({ tex: T.toast[i], size: [0.8 * lerp(0.85, 1, pop), 0.8 * lerp(0.85, 1, pop) * 200 / 820], pos: p, opacity: clamp(pop * 1.5, 0, 1) * clamp((3.6 - slot) / 1, 0, 1), depthWrite: false });
      const r = 0.06 + 0.02 * E.hash(i);
      const x = 0.55 + (E.hash(i + 9) - 0.2) * 0.9, z = -0.1 + E.hash(i + 4) * 0.5;
      spheres.push({ k: i === 2 ? 'white' : 'blue', r, p: [x, dropY(t, t0s[i] + 0.1, FY + 0.6, r), z] });
    }
    studio(t, out, {
      panels: [P, ...toasts], spheres: [...spheres, ...drifters(t + 9, 6, 5)],
      glows: [{ p: [-0.35, FY + 0.72, -1.1], s: 3.0, o: 0.22, c: [0.5, 0.65, 1] }],
      extra: () => sweep(P, t, 0.2, 0.9),
    });
  };

  // F — growth: blue glass bars rise from the floor, spheres riding on top; the camera cranes up
  SHOT.F = (t, out) => {
    const d = dur('F'), f = float(t);
    cam({ pos: [lerp(1.5, -0.4, ease.io(t / d)) + f[0], FY + lerp(0.35, 1.3, ease.io(t / d)) + f[1], lerp(2.4, 2.9, t / d)], target: [0, FY + 0.6, -0.6] });
    const H = [0.35, 0.55, 0.78, 1.05, 1.4], X = [-1.2, -0.6, 0, 0.6, 1.2];
    const spheres = drifters(t + 12, 7, 6);
    const bars = [];
    H.forEach((h, i) => {
      const q = ease.back(k01(t, 0.15 + i * (d - 1.2) / 5, 0.75 + i * (d - 1.2) / 5, ease.lin));
      const hh = h * q;
      bars.push([X[i], hh]);
      if (q > 0.02) spheres.push({ k: i === 4 ? 'white' : 'blue', r: 0.075, p: [X[i], FY + hh + 0.075 + Math.max(0, Math.sin((t - i) * 7) * 0.03 * (1 - q)), -0.6] });
    });
    const extra = () => bars.forEach(([x, h]) => {
      if (h < 0.005) return;
      for (let j = 6; j >= 0; j--) E.draw({ tex: T.glass, size: [0.34, h], pos: [x, FY + h / 2, -0.6 - j * 0.04], opacity: j ? 0.35 : 0.9, depthWrite: !j });
      E.draw({ tex: T.white, size: [0.34, 0.28], pos: [x, FY + h, -0.74], rot: [-90, 0, 0], color: [0.75, 0.85, 1], opacity: 0.85 });
    });
    studio(t, out, {
      panels: [{ tex: T.p_reports, size: [2.6, 2.6 / W16], pos: [0, FY + 1.0, -2.4], opacity: 0.55, bright: 0.7 }],
      spheres, extra,
      glows: bars.map(([x, h]) => ({ p: [x, FY + h + 0.08, -0.5], s: 0.6, o: h > 0.05 ? 0.35 : 0, c: [0.55, 0.75, 1] })),
    });
  };

  // G — made in Georgia: the site in Georgian and in English on two phones, turning to face us
  SHOT.G = (t, out) => {
    const d = dur('G'), f = float(t);
    cam({ pos: [lerp(0.7, -0.3, ease.io(t / d)) + f[0], FY + 0.62 + f[1], lerp(2.2, 1.85, ease.out(t / d))], target: [0, FY + 0.6, -0.4] });
    const q1 = ease.out(k01(t, 0.0, 0.8, ease.lin)), q2 = ease.out(k01(t, 0.25, 1.05, ease.lin));
    const ka = { tex: T.ph_ka, size: [0.62, 0.62 * 1260 / 620], pos: [-0.38, lerp(FY - 0.9, FY + 0.7, q1), -0.35], rot: [0, lerp(70, 10, q1), 0] };
    const en = { tex: T.ph_en, size: [0.55, 0.55 * 1260 / 620], pos: [0.45, lerp(FY - 0.9, FY + 0.64, q2), -0.6], rot: [0, lerp(-70, -14, q2), 0] };
    studio(t, out, {
      panels: [en, ka], spheres: drifters(t + 15, 9, 7),
      glows: [{ p: [-0.38, FY + 0.7, -0.45], s: 2.0, o: 0.3 * q1, c: [0.5, 0.7, 1] }],
      extra: () => sweep(ka, t, 1.0, 0.7),
    });
  };

  // H — everything at once, then it all collapses into a rain of spheres; lights go down (the logo reveal follows)
  SHOT.H = (t, out) => {
    const d = dur('H'), f = float(t);
    const burst = TL.burstH ? TL.burstH - SC.H[0] : d - 1.9;   // the moment the screens break into spheres (on a downbeat)
    const kb = k01(t, 0, burst, ease.out), ka = k01(t, burst, d, ease.io);
    cam({ pos: [f[0], FY + lerp(lerp(0.95, 0.8, kb), 0.32, ka) + f[1], lerp(lerp(3.1, 4.0, kb), 2.5, ka)], target: [0, FY + lerp(0.8, 0.3, ka), lerp(-1.2, -1.5, ka)] });
    const items = [['p_home', 0, 0.85, -1.2, 1.5], ['p_evo', -1.75, 0.75, -1.6, 1.2], ['p_studycat', 1.75, 0.75, -1.6, 1.2], ['p_store', -0.95, 1.45, -2.2, 1.0], ['p_mailtabs', 0.95, 1.45, -2.2, 1.0]];
    const fade = 1 - k01(t, burst, burst + 0.25, ease.lin);
    const panels = items.map(([tex, x, y, z, w], i) => {
      const q = ease.out(k01(t, i * 0.12, i * 0.12 + 0.6, ease.lin));
      return { tex: T[tex], size: [w, w / W16], pos: [x, FY + lerp(y - 0.4, y, q), z], rot: [0, -x * 10, 0], opacity: q * fade };
    });
    const spheres = [];
    if (t > burst) {
      items.forEach(([, x, y, z, w], i) => {
        for (let j = 0; j < 9; j++) {
          const h1 = E.hash(i * 31 + j), h2 = E.hash(i * 17 + j * 3), h3 = E.hash(i * 7 + j * 11);
          const r = 0.04 + 0.09 * h3 * h3;
          const px = x + (h1 - 0.5) * w * 0.9, pz = z + (h2 - 0.5) * 0.3, py0 = FY + y + (h2 - 0.5) * w / W16 * 0.8;
          spheres.push({ k: h3 < 0.6 ? 'blue' : h3 < 0.85 ? 'white' : 'chrome', r, p: [px, dropY(t, burst + h1 * 0.15, py0, r, 0.45), pz] });
        }
      });
    }
    const lights = 1 - k01(t, d - 0.7, d, ease.in);
    studio(t, out, {
      panels, spheres: [...spheres, ...drifters(t + 18, 8, 8).map((s) => ({ ...s, o: fade }))],
      glows: [{ p: [0, FY + 0.9, -1.4], s: 5, o: 0.2 * fade + (t > burst ? 0.5 * Math.exp(-(t - burst) * 5) : 0), c: [0.55, 0.7, 1] }],
      floorBright: lights,
    });
  };

  // ---------- timeline ----------
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const IN = { A: 'cut', B: 'cut', C: ['fade', 0.25], D: ['fade', 0.25], E: 'cut', F: ['fade', 0.25], G: ['fade', 0.25], H: ['fade', 0.3] };
  const LOOK = { A: [0.6, 0], B: [0.35, 0], C: [0.3, 0], D: [0.3, 0], E: [0.3, 0], F: [0.45, 0], G: [0.3, 0], H: [0.45, 0] };
  function shotAt(t) { for (let i = ORDER.length - 1; i >= 0; i--) if (t >= SC[ORDER[i]][0]) return i; return 0; }
  function drawShot(i, t, fb) { const id = ORDER[i]; SHOT[id](t - SC[id][0], fb); }
  function composite(t, a, b) {
    const i = shotAt(t), id = ORDER[i];
    drawShot(i, t, a);
    const tin = IN[id];
    if (Array.isArray(tin) && i > 0 && t - SC[id][0] < tin[1]) { drawShot(i - 1, t, b); return { mix: 1 - ease.io((t - SC[id][0]) / tin[1]), other: true, id }; }
    return { mix: 0, other: false, id };
  }
  window.renderFrame = async (t) => {
    await window.ready;
    const A = E.fbo('A'), B = E.fbo('B');
    const res = composite(t, A, B);
    const f = (a, b) => clamp((t - a) / (b - a), 0, 1);
    let fade = [0, 0, 0], fadeAmt = 0;
    if (t < 0.25) fadeAmt = 1 - f(0, 0.25);
    if (t > TL.duration - 0.35) fadeAmt = f(TL.duration - 0.35, TL.duration - 0.03);
    if (TL.stop && t >= TL.stop[0] && t < TL.stop[1]) fadeAmt = Math.max(fadeAmt, 0.72 * f(TL.stop[0], TL.stop[0] + 0.07));   // the song's dead stop: lights drop
    let flash = 0;
    for (const h of TL.hits || []) if (t >= h) flash = Math.max(flash, 0.14 * Math.exp(-(t - h) / 0.18));
    const look = LOOK[res.id] || [0.5, 0];
    E.finish(res.other ? B : A, res.other ? A : null, { mixAB: 1 - res.mix, seed: Math.floor(t * 30) * 0.618, fade, fadeAmt, warm: 0.0, vig: 0.75, grain: 0.03, ca: 0.0012, contrast: 1.1, lift: 0.0, bloomAmt: look[0], bloomTh: 0.88, leak: look[1], time: t, flash });
  };
})();
