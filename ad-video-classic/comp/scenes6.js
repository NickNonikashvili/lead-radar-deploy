// EvoSoft ad, one continuous take (no cuts). A chrome sphere wakes a dead EvoSoft site, the camera follows it through
// the glass: the site comes apart, a hall of phones turns to watch, a canyon of the apps EvoSoft built powers on and
// fills with ricocheting spheres; in the song's dead silence time freezes; on the drop the canyon explodes into a
// 360-degree wall of screens, orders stack into towers, everything spins into a vortex and drains into the sphere,
// which becomes a black orb the camera falls into. The client's logo reveal starts from that black.
(() => {
  'use strict';
  const { ease, textures: T, clamp, lerp, D0 } = E;
  let TL, ATLAS;
  const FY = -0.75, G = 6.5;
  const BEAT = 0.4724, H0 = 2.005, DROP = 17.16, FREEZE = 16.27;
  const beat = (k) => H0 + BEAT * k;
  const kk = (t, a, b, e = ease.io) => e(clamp((t - a) / Math.max(1e-6, b - a), 0, 1));
  let CAM = [0, 0, D0], CAMT = [0, 0, 0];
  function cam(o) {
    CAM = o.pos; CAMT = o.target;
    const f = norm(sub(o.target, o.pos));
    let r = cross(f, [0, 1, 0]); if (Math.hypot(...r) < 1e-3) r = cross(f, [0, 0, -1]); r = norm(r);
    const u0 = cross(r, f), a = (o.roll || 0) * Math.PI / 180;
    const up = [u0[0] * Math.cos(a) + r[0] * Math.sin(a), u0[1] * Math.cos(a) + r[1] * Math.sin(a), u0[2] * Math.cos(a) + r[2] * Math.sin(a)];
    E.camera({ ...o, up });
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  window.ready = (async () => {
    TL = await (await fetch('../timeline6.json', { cache: 'no-store' })).json();
    window.DURATION = TL.duration;
    await Promise.all(['700 80px Figtree', '500 80px Figtree', '800 80px Gabarito'].map((f) => document.fonts.load(f, 'AaBb')));
    const img = {};
    await Promise.all(['home', 'home_ka', 'services', 'mobile', 'mobile_ka', 'evo', 'mailtabs', 'studycat', 'store', 'reports', 'register'].map(async (k) => { const i = new Image(); i.src = `../shots/${k}.jpg`; await i.decode(); img[k] = i; }));
    await E.loadTex('glow', '../art/glow.png');
    ATLAS = await (await fetch('../spheres/atlas.json', { cache: 'no-store' })).json();
    for (const k of ['blue', 'white', 'chrome', 'hero', 'orb']) await E.loadTex('at_' + k, `../spheres/atlas_${k}.png`);
    for (const k of ['home', 'home_ka', 'services', 'evo', 'mailtabs', 'studycat', 'store', 'reports', 'register']) T['p_' + k] = panelTex(img[k]);
    T.ph_en = phoneTex(img.mobile); T.ph_ka = phoneTex(img.mobile_ka);
    T.s_blue = sphereTex('blue'); T.s_white = sphereTex('white'); T.s_chrome = sphereTex('chrome');
    T.hero = sphereTex('chrome', 512); T.orb = orbTex();
    T.shadow = blobTex(); T.ring = ringTex();
    const o = outlineTex(); T.outline = o.tex; T.outline_rev = o.rev;
    T.toast = [['New order', '2 items · 86.00 ₾'], ['New order', '1 item · 42.50 ₾'], ['Payment received', '128.00 ₾'], ['New order', '3 items · 64.00 ₾'], ['New order', '4 items · 152.00 ₾']].map(([a, b]) => toastTex(a, b));
    T.pool = E.gradTex('pool', 'radial', 256);
    build();
  })();

  // ---------- textures ----------
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
  function sphereTex(kind, S = 256) {
    const [c, x] = cv(S, S), r = S / 2 - 2;
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
  // ---------- one continuous camera: a smooth spline through timed keyframes ----------
  // keys: [{t, pos:[x,y,z], target:[x,y,z], fov, roll}], interpolated with a non-uniform Catmull-Rom (Barry-Goldman),
  // so the camera never stops or jerks at a keyframe; fov and roll the same way.
  function crPoint(P, T, t) {
    let i = 0; while (i < T.length - 2 && t > T[i + 1]) i++;
    const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(T.length - 1, i + 1), i3 = Math.min(T.length - 1, i + 2);
    const t0 = i0 === i1 ? T[i1] - (T[i2] - T[i1]) : T[i0], t1 = T[i1], t2 = T[i2], t3 = i3 === i2 ? T[i2] + (T[i2] - T[i1]) : T[i3];
    const p0 = i0 === i1 ? P[i1].map((v, k) => 2 * v - P[i2][k]) : P[i0], p1 = P[i1], p2 = P[i2], p3 = i3 === i2 ? P[i2].map((v, k) => 2 * v - P[i1][k]) : P[i3];
    const L = (a, b, ta, tb) => a.map((v, k) => (tb === ta ? v : ((tb - t) * v + (t - ta) * b[k]) / (tb - ta)));
    const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
    const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
    return L(B1, B2, t1, t2);
  }
  function camPath(keys, t) {
    const T = keys.map((k) => k.t), tc = clamp(t, T[0], T[T.length - 1]);
    const pos = crPoint(keys.map((k) => k.pos), T, tc), target = crPoint(keys.map((k) => k.target), T, tc);
    const [fov, roll] = crPoint(keys.map((k) => [k.fov ?? 40, k.roll ?? 0]), T, tc);
    return { pos, target, fov, roll };
  }
  function orbTex() {
    const S = 1024, [c, x] = cv(S, S), r = S / 2 - 4;
    x.beginPath(); x.arc(S / 2, S / 2, r, 0, Math.PI * 2); x.closePath(); x.save(); x.clip();
    const g = x.createRadialGradient(S * 0.4, S * 0.34, S * 0.02, S * 0.5, S * 0.5, r);
    g.addColorStop(0, '#1b2233'); g.addColorStop(0.45, '#06080d'); g.addColorStop(1, '#010103');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const rim = x.createRadialGradient(S / 2, S / 2, r * 0.86, S / 2, S / 2, r);
    rim.addColorStop(0, 'rgba(60,120,255,0)'); rim.addColorStop(1, 'rgba(90,150,255,.75)');
    x.fillStyle = rim; x.fillRect(0, 0, S, S);
    const hl = x.createRadialGradient(S * 0.36, S * 0.3, 0, S * 0.36, S * 0.3, S * 0.09);
    hl.addColorStop(0, 'rgba(200,220,255,.45)'); hl.addColorStop(1, 'rgba(200,220,255,0)');
    x.fillStyle = hl; x.fillRect(0, 0, S, S); x.restore();
    return E.texFromSource(c);
  }

  // ---------- helpers ----------
  const H = (i, s = 0) => E.hash(i * 12.9898 + s * 78.233);
  const smooth = (x) => x * x * (3 - 2 * x);
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // a screen powering on: dead, then a flicker, then full
  function powerOn(t, t0) {
    if (t < t0) return 0;
    const d = t - t0;
    if (d < 0.035) return 0.45; if (d < 0.065) return 0.08; if (d < 0.1) return 0.7; if (d < 0.13) return 0.25;
    return lerp(0.6, 1, kk(d, 0.13, 0.32, ease.out));
  }
  // a ball thrown from y0 with vertical speed vy, bouncing with restitution e, until it rests on the floor
  function bounceY(t, y0, vy, r, e = 0.45) {
    const ground = FY + r;
    if (t <= 0) return y0;
    let h = y0 - ground, v = vy;
    let tf = (v + Math.sqrt(v * v + 2 * G * Math.max(0, h))) / G;
    if (t < tf) return y0 + v * t - 0.5 * G * t * t;
    t -= tf; v = (G * tf - v) * e;
    for (let i = 0; i < 8; i++) { const tb = 2 * v / G; if (t < tb) return ground + v * t - 0.5 * G * t * t; t -= tb; v *= e; }
    return ground;
  }
  const slide = (t, k = 1.6) => (1 - Math.exp(-k * Math.max(0, t))) / k;          // distance travelled with friction (unit speed)
  const tri = (x) => { const f = x - Math.floor(x); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; };   // -1..1 zigzag, period 1

  // ---------- the world clock: time freezes in the song's dead silence ----------
  const FRZ_RATE = 0.03, DRIFT = (DROP - FREEZE) * (1 - FRZ_RATE);
  function tau(t) {
    if (t < FREEZE) return t;
    if (t < DROP) return FREEZE + (t - FREEZE) * FRZ_RATE;
    return t - DRIFT;
  }
  const TAU_DROP = tau(DROP);

  // ---------- one continuous camera ----------
  const S = [-0.3, 0.45, -32.6];                        // where everything ends: the orb
  const PI_ = [0, FY, -37.6];                           // impact point of the drop
  const V = [-0.3, 0, -32.6];                           // vortex axis
  const KEYS = [
    { t: 2.005, pos: [0, -0.45, 3.45], target: [0, 0.05, 0], fov: 50, roll: 0 },
    { t: 2.48, pos: [0.10, -0.25, 2.30], target: [0, 0.10, 0], fov: 46, roll: 1 },
    { t: 3.894, pos: [0.30, 0.00, 1.55], target: [-0.02, 0.12, 0], fov: 44, roll: 2 },
    { t: 4.839, pos: [0.06, 0.12, 0.95], target: [-0.04, 0.16, -1.0], fov: 46, roll: -4 },
    { t: 5.311, pos: [-0.02, 0.15, 0.60], target: [-0.04, 0.16, -1.5], fov: 46, roll: -6 },
    { t: 5.784, pos: [-0.04, 0.16, 0.0], target: [-0.02, 0.05, -2.0], fov: 46, roll: -4 },
    { t: 6.73, pos: [0.20, -0.35, -1.95], target: [0, 0.30, -7.0], fov: 50, roll: 4 },
    { t: 7.674, pos: [-0.05, -0.25, -3.70], target: [0, 1.30, -7.0], fov: 48, roll: 0 },
    { t: 8.62, pos: [0, 0.75, -5.05], target: [0, 1.20, -7.0], fov: 42, roll: 25 },
    { t: 9.09, pos: [0, 1.05, -6.05], target: [0, 1.20, -8.0], fov: 40, roll: 38 },
    { t: 9.563, pos: [0, 1.20, -7.00], target: [0, 1.00, -9.0], fov: 42, roll: 35 },
    { t: 10.50, pos: [0, 0.75, -9.90], target: [0, 0.45, -14.0], fov: 44, roll: 12 },
    { t: 11.453, pos: [0, 0.40, -12.6], target: [-0.3, 0.35, -17.0], fov: 44, roll: 0 },
    { t: 12.398, pos: [-0.45, 0.35, -16.6], target: [-0.8, 0.40, -21.0], fov: 44, roll: -16 },
    { t: 13.343, pos: [0.4, 0.30, -20.9], target: [0.6, 0.30, -26.0], fov: 44, roll: 14 },
    { t: 14.288, pos: [0, 0.15, -25.8], target: [0, 0.10, -31.0], fov: 56, roll: 4 },
    { t: 15.232, pos: [0, -0.45, -31.0], target: [0, -0.55, -36.0], fov: 68, roll: 0 },
    { t: 15.705, pos: [0, -0.60, -33.6], target: [0, -0.70, -37.5], fov: 62, roll: 0 },
    { t: 16.177, pos: [-0.35, -0.52, -36.5], target: [0, -0.62, -37.6], fov: 40, roll: 0 },
    // bullet time: a slow orbit around the frozen sphere, just above the floor
    { t: 16.42, pos: [-0.45, -0.47, -36.95], target: [0, -0.56, -37.6], fov: 30, roll: 0 },
    { t: 16.72, pos: [-0.05, -0.40, -36.78], target: [0, -0.56, -37.6], fov: 30, roll: 0 },
    { t: 17.0, pos: [0.52, -0.30, -37.0], target: [0, -0.56, -37.6], fov: 30, roll: 0 },
    { t: 17.16, pos: [0.70, -0.15, -37.35], target: [0, -0.40, -37.6], fov: 32, roll: 0 },
    // the drop: crane up out of the explosion, then a 180-degree whip to the wall of screens
    { t: 17.40, pos: [0.45, 0.35, -37.25], target: [0, 1.40, -38.6], fov: 50, roll: 0 },
    { t: 17.90, pos: [0, 1.35, -37.3], target: [0, 1.0, -42.3], fov: 50, roll: 0 },
    { t: 19.05, pos: [0, 1.60, -37.3], target: [0, 1.25, -32.3], fov: 46, roll: 0 },
    { t: 20.0, pos: [-0.4, 0.65, -36.6], target: [0, 0.70, -32.3], fov: 48, roll: 0 },
    { t: 20.939, pos: [0.6, -0.40, -35.9], target: [-0.1, 0.9, -34.3], fov: 54, roll: -3 },
    { t: 21.884, pos: [0, -0.25, -34.3], target: [0, 0.3, -31.5], fov: 52, roll: 3 },
    { t: 22.356, pos: [-0.3, 0.55, -33.4], target: [-0.2, 1.4, -31.0], fov: 50, roll: 0 },
    { t: 22.829, pos: [-0.3, 1.2, -33.0], target: [-0.3, 3.0, -31.5], fov: 54, roll: 10 },
    // inside the vortex, rising up its eye in a barrel roll
    { t: 23.774, pos: [-0.3, 2.3, -32.8], target: [-0.3, 4.6, -30.5], fov: 60, roll: 60 },
    { t: 24.718, pos: [-0.3, 3.3, -32.6], target: [-0.3, 5.6, -30.4], fov: 64, roll: 160 },
    { t: 25.663, pos: [-0.3, 4.4, -32.6], target: [-0.3, 6.6, -30.4], fov: 64, roll: 270 },
    { t: 26.608, pos: [-0.3, 5.6, -33.4], target: [-0.3, 3.6, -30.0], fov: 56, roll: 360 },
    // the drain: a spiral descent around the funnel to the orb
    { t: 27.08, pos: [-0.3, 6.6, -34.2], target: S, fov: 50, roll: 360 },
    { t: 27.553, pos: [2.6, 5.0, -33.6], target: S, fov: 46, roll: 360 },
    { t: 28.498, pos: [2.2, 2.8, -30.6], target: S, fov: 40, roll: 360 },
    { t: 29.442, pos: [2.0, 1.3, -26.4], target: S, fov: 30, roll: 360 },
    { t: 30.387, pos: [S[0], S[1] + 0.25, S[2] + 8.08], target: S, fov: 22, roll: 360 },
  ];
  const ORB_IN = 30.387, BLACK = 32.277;
  const orbPulse = (t) => { let p = 1; for (let n = 0; n < 4; n++) { const t0 = ORB_IN + n * BEAT; if (t >= t0) p = Math.max(p, 1 + 0.08 * Math.exp(-(t - t0) / 0.12)); } return p; };
  function camAt(t) {
    if (t < H0) {                                     // the opening: a slow dolly-zoom on the dead site
      const z = 10.15 - 6.70 * ease.sine(t / H0);
      return { pos: [0, -0.45, z], target: [0, 0.05, 0], fov: 2 * Math.atan(1.607 / z) * 180 / Math.PI, roll: 0 };
    }
    if (t >= ORB_IN) {                                // the orb: dolly-zoom in, then fall into it
      const d = lerp(8.08, 0.25, kk(t, ORB_IN, 32.15, (x) => x * x * x)), fov = lerp(22, 62, kk(t, ORB_IN, 32.15, ease.io));
      return { pos: [S[0], S[1] + 0.25 * d / 8.08, S[2] + d], target: S, fov, roll: 0 };
    }
    const c = camPath(KEYS, t);
    if (t > 17.9 && t < 19.05) {                      // the whip: turn the view 180 degrees
      const psi = Math.PI * ease.io((t - 17.9) / 1.15);
      c.target = [c.pos[0] + 5 * Math.sin(psi), c.pos[1] - 0.35, c.pos[2] - 5 * Math.cos(psi)];
    }
    c.roll = ((c.roll % 360) + 360) % 360;
    return c;
  }

  // ---------- the cast ----------
  const PANEL_W = 1.9, PANEL_H = 1.19;
  const APPS = ['p_evo', 'p_mailtabs', 'p_studycat', 'p_store', 'p_reports', 'p_register', 'p_services', 'p_home', 'p_home_ka'];
  // the website (B) and the pieces it comes apart into
  const BPOS = [0, 0.05, 0], BW = 2.4, BH = 1.5;
  const PIECES = [   // u0 v0 u1 v1 in the screenshot, lift time, offset [dx, dy, dz]
    [0, 0, 1, 0.075, 3.894, [0, 0.10, 0.30]],
    [0.075, 0.19, 0.44, 0.43, 4.367, [-0.12, 0.05, 0.45]],
    [0.075, 0.43, 0.47, 0.70, 4.60, [-0.16, -0.10, 0.25]],
    [0.495, 0.15, 0.92, 0.74, 4.839, [0.18, 0.0, 0.55]],
    [0.083, 0.775, 0.285, 0.91, 5.311, [-0.10, -0.12, 0.35]],
    [0.295, 0.775, 0.495, 0.91, 5.37, [-0.03, -0.16, 0.48]],
    [0.505, 0.775, 0.705, 0.91, 5.43, [0.04, -0.16, 0.6]],
    [0.715, 0.775, 0.915, 0.91, 5.49, [0.12, -0.12, 0.42]],
  ];
  const texUV = (u, v) => [(14 + u * 1572) / 1600, (14 + v * 972) / 1000];
  // the hall of phones and the giant Georgian phone
  const PHONES = [];
  [-1.4, -2.9, -4.4].forEach((z, k) => { PHONES.push({ x: -1.25, z, tex: k % 2 ? 'ph_ka' : 'ph_en', on: 5.311 + 0.118 * k }); PHONES.push({ x: 1.25, z, tex: k % 2 ? 'ph_en' : 'ph_ka', on: 5.311 + 0.118 * k + 0.06 }); });
  const GP = { pos: [0, 1.02, -6.93], size: [1.74, 3.54], on: 7.674 };
  // the canyon: 16 columns x 3 rows on each side
  const CANYON = [];
  for (let c = 0; c < 16; c++) for (let r = 0; r < 3; r++) for (const side of [-1, 1]) {
    const i = CANYON.length;
    let tex = APPS[Math.floor(H(i, 3) * APPS.length)];
    if (i > 0 && CANYON[i - 1].tex === tex) tex = APPS[(APPS.indexOf(tex) + 1) % APPS.length];
    CANYON.push({ c, r, side, z: -8.6 - 2.0 * c, y: -0.10 + 1.27 * r, tex, on: 9.12 + c * 0.118 + r * 0.03 + (side > 0 ? 0.059 : 0) });
  }
  const FLY = {};
  { const find = (c, r, side) => CANYON.findIndex((p) => p.c === c && p.r === r && p.side === side);
    FLY[find(5, 0, 1)] = { t0: 11.95, t1: 13.0, tex: 'p_mailtabs' }; FLY[find(9, 0, -1)] = { t0: 13.6, t1: 14.6, tex: 'p_studycat' };
    for (const i in FLY) CANYON[i].tex = FLY[i].tex; }
  function wallX(t, r) {
    const base = [1.55, 1.73, 1.95][r];
    let k = 0; for (let s = 0; s < 4; s++) k += ease.back(kk(t, 13.343 + s * BEAT, 13.343 + s * BEAT + 0.22, ease.lin));
    return lerp(base, base - 0.5, k / 4);
  }
  function canyonPose(p, t) {
    const x = p.side * wallX(t, p.r), lean = lerp([0, 8, 16][p.r], [0, 4, 4][p.r], kk(t, 13.343, 15.232));
    return { pos: [x, p.y + (p.r ? 0.04 * (wallX(t, 0) - 1.55) : 0), p.z], rot: [0, p.side < 0 ? 72 : -72, p.side < 0 ? lean : -lean] };
  }
  // the halo: 4 tiers x 24 screens in a ring around the impact point
  function haloSlot(i, t) {
    const k = Math.floor(i / 24), j = i % 24;
    const spin = (k % 2 ? -1 : 1) * 5 * clamp(t - 18.4, 0, 22.83 - 18.4);
    const phi = (15 * j + 7.5 * (k % 2) + spin) * Math.PI / 180;
    const pos = [PI_[0] + 7.5 * Math.sin(phi), [0.0, 1.32, 2.64, 3.96][k], PI_[2] - 7.5 * Math.cos(phi)];
    return { pos, rot: [0, Math.atan2(PI_[0] - pos[0], PI_[2] - pos[2]) * 180 / Math.PI, 0], phi };
  }
  // halo slot of each canyon screen (shuffled, so the explosion scatters them); slot 12 (tier 0, facing the camera
  // after the whip) is the store, which then flies forward
  const SLOT_OF = [];
  { const order = CANYON.map((_, i) => i).sort((a, b) => H(a, 9) - H(b, 9)); order.forEach((ci, s) => { SLOT_OF[ci] = s; }); }
  const STORE_SLOT = 12;
  { const ci = SLOT_OF.indexOf(STORE_SLOT); CANYON[ci].tex = 'p_store'; }
  // the towers of orders (spheres stacked in columns), the camera flies through the gap between x -0.25 and 0.25
  const TOWER_X = [-1.25, -0.8, -0.35, 0.35, 0.8, 1.25], TOWER_N = [12, 5, 8, 6, 10, 4], TOWER_Z = -34.3, TR = 0.075;
  const TOWER = [];
  TOWER_X.forEach((x, ti) => { for (let n = 0; n < TOWER_N[ti]; n++) TOWER.push({ x, n, ti, t0: 19.05 + ti * BEAT * 0.25 + n * 1.7 / TOWER_N[ti] + H(ti * 40 + n, 4) * 0.03 }); });

  // ---------- the hero sphere ----------
  const HR = 0.075, HY0 = FY + HR;
  function hop(t, t0, t1, a, b, apex = null) {      // a ballistic arc from a to b between t0 and t1
    const T = t1 - t0, k = clamp((t - t0) / T, 0, 1), tt = k * T;
    const vy = (b[1] - a[1]) / T + G * T / 2;
    return [lerp(a[0], b[0], k), a[1] + vy * tt - 0.5 * G * tt * tt, lerp(a[2], b[2], k)];
  }
  function canyonHero(t, c) {                         // ahead of the camera, ricocheting between the walls
    const fov = c.fov, d = t > 14.288 && t < 15.6 ? 1.495 / Math.tan(fov * Math.PI / 360) : 2.2;
    const per = 2 * BEAT;
    const A = wallX(t, 0) - 0.42;
    const x = A * tri((t - 9.563) / per + 0.25) * kk(t, 9.563, 10.2);
    const y = HY0 + 0.55 * Math.abs(Math.sin(Math.PI * (t - 9.563) / BEAT));
    return [x, y, c.pos[2] - d];
  }
  function heroAt(t) {
    // before the drop the hero lives on the frozen clock
    const u = tau(t);
    if (u < 1.533) return [-0.04, HY0, 0.6];
    if (u < H0) return hop(u, 1.533, H0, [-0.04, HY0, 0.6], [0, 0.05, 0]);
    if (u < 5.784) { const k = u - H0; if (k < 0.5) return hop(u, H0, H0 + 0.5, [0, 0.05, 0], [-0.04, HY0, -1.1]); return [-0.04, bounceY(k - 0.5, HY0, 1.2, HR, 0.4), -1.1 - 0.1 * kk(k, 0.5, 1.2, ease.out)]; }
    if (u < 8.62) { const n = Math.floor((u - 5.784) / BEAT), z0 = -1.2 - 0.733 * n; return hop(u, 5.784 + n * BEAT, 5.784 + (n + 1) * BEAT, [0, HY0, z0], [0, HY0, z0 - 0.733]); }
    if (u < 9.091) return hop(u, 8.62, 9.091, [0, HY0, -5.6], [0, 1.20, -6.925]);
    if (u < 9.563) return lerp3([0, 1.20, -6.925], canyonHero(9.563, camAt(9.563)), kk(u, 9.091, 9.563));
    if (u < 15.70) return canyonHero(u, camAt(u));
    if (u <= TAU_DROP) {                              // the last fall onto the impact point (frozen near the end)
      const a = canyonHero(15.70, camAt(15.70)), k = (u - 15.70) / (TAU_DROP - 15.70);
      return [lerp(a[0], PI_[0], k), lerp(a[1], HY0, k * k), lerp(a[2], PI_[2], smooth(k))];
    }
    // after the drop: bounce up, float to a hover over the tallest tower, crown it, then sink to the orb point
    const hover = [TOWER_X[0], 2.4, TOWER_Z];
    if (t < 20.639) {
      const b = [PI_[0], bounceY(t - DROP, HY0, 4.2, HR, 0.3), PI_[2]];
      const f = hover.map((v, i) => v + (i === 1 ? 0.05 * Math.sin(t * 3) : 0));
      return lerp3(b, f, kk(t, 17.5, 19.0, ease.io));
    }
    const top = [TOWER_X[0], FY + TR + (TOWER_N[0] - 1) * 2 * TR + 2 * TR, TOWER_Z];
    if (t < 20.939) return hop(t, 20.639, 20.939, hover, top);
    if (t < 22.83) return top;
    return lerp3(top, S, kk(t, 22.83, 24.2, ease.io));
  }

  // ---------- the swarm in the canyon (1 -> 100 spheres) ----------
  const SPAWN = [[11.453, 3], [12.398, 9], [13.343, 27], [14.288, 54], [15.232, 90], [15.705, 100]];
  const SWARM = [];
  { let prev = 0; for (const [ts, n] of SPAWN) { for (let i = prev; i < n; i++) SWARM.push({ i, t0: ts + (i - prev) / Math.max(1, n - prev) * 0.3, r: 0.05 + 0.06 * H(i, 5), k: H(i, 6) < 0.62 ? 'blue' : H(i, 6) < 0.85 ? 'white' : 'chrome', d: 0.9 + 2.6 * H(i, 7), per: H(i, 8) < 0.5 ? BEAT * 2 : BEAT * 4, ph: H(i, 9), hh: 0.15 + 1.1 * H(i, 10), ofs: (H(i, 11) - 0.5) * 0.6 }); prev = n; } }
  function swarmPos(s, t) {
    const u = Math.min(tau(t), TAU_DROP);
    if (u < s.t0) return null;
    const c = camAt(Math.min(u, FREEZE)), from = heroAt(s.t0), k = kk(u, s.t0, s.t0 + 0.45, ease.out);
    const A = wallX(u, 0) - 0.3 - s.r;
    const own = [A * tri((u - s.t0) / s.per + s.ph), FY + s.r + s.hh * Math.abs(Math.sin(Math.PI * (u - s.t0) / s.per + s.ph * 3)), c.pos[2] - s.d + s.ofs];
    let p = lerp3(from, own, k);
    if (t > DROP) {                                  // the drop blasts the swarm outwards
      const dt = t - DROP, dx = p[0] - PI_[0], dz = p[2] - PI_[2], dl = Math.hypot(dx, dz) + 0.3;
      const sp = 3.5 + 2.5 * H(s.i, 12);
      p = [p[0] + dx / dl * sp * slide(dt, 1.3), bounceY(dt, p[1], 2.0 + 2 * H(s.i, 13), s.r), p[2] + dz / dl * sp * slide(dt, 1.3)];
    }
    return p;
  }
  // the crown splash on the drop
  const SPLASH = Array.from({ length: 64 }, (_, i) => { const a = 2 * Math.PI * H(i, 20), rr = 0.35 + 0.25 * H(i, 21), hk = H(i, 24); return { i, a, rr, vy: 3.5 + 3 * H(i, 22), vo: 0.8 + 1.4 * H(i, 23), r: 0.03 + 0.08 * hk * hk, k: hk < 0.6 ? 'blue' : hk < 0.85 ? 'white' : 'chrome' }; });
  function splashPos(s, t) {
    if (t < DROP) return null;
    const dt = t - DROP, d = s.rr + s.vo * slide(dt, 0.55);
    return [PI_[0] + Math.sin(s.a) * d, bounceY(dt, FY + s.r + 0.02, s.vy, s.r), PI_[2] - Math.cos(s.a) * d];
  }
  function towerPos(s, t) {
    if (t < s.t0) return null;
    const y = FY + TR + s.n * 2 * TR, k = kk(t, s.t0, s.t0 + 0.16, ease.in);
    return [s.x + (H(s.ti * 40 + s.n, 14) - 0.5) * 0.01, lerp(y + 0.9, y, k), TOWER_Z];
  }

  // ---------- the vortex and the drain ----------
  const VSTART = 22.83;
  function omegaInt(t) {                              // integral of the vortex's angular speed since VSTART
    if (t < VSTART) return 0;
    const T1 = 24.718 - VSTART, u = Math.min(t - VSTART, T1);
    let a = 0.09 * u + 2.31 * T1 * Math.pow(u / T1, 3) / 3;
    if (t - VSTART > T1) a += 2.4 * (t - VSTART - T1);
    return a;
  }
  // every object gets an orbit slot in the vortex and a time it is swallowed by the orb
  function orbitOf(id, kind) {
    const h1 = H(id, 30), h2 = H(id, 31), h3 = H(id, 32);
    if (kind === 'panel') return { rho0: 7.5, rho: 3.4 + 0.6 * h1, y: -0.1 + 9.0 * h2, a0: 2 * Math.PI * h3, absorb: 27.6 + 2.6 * Math.pow(h2, 0.7), peel: VSTART + 0.9 * h1 };
    return { rho: 0.9 + 1.7 * h1, y: 0.0 + 9.0 * h2 * h2, a0: 2 * Math.PI * h3, absorb: 27.4 + 2.6 * Math.pow(h2, 0.8), peel: VSTART + 1.2 * h1 };
  }
  // where an object is in the vortex/drain (given its position when it was peeled off), plus its scale and light
  function vortexPos(o, start, t, speed = 1.5) {
    const k = kk(t, o.peel, o.peel + 0.9, ease.io);
    const dr = kk(t, o.absorb - 0.9, o.absorb, ease.in);
    const ang = o.a0 + speed * omegaInt(t) + 6 * dr * dr;
    const rho = lerp(o.rho, 0, dr), y = lerp(o.y, S[1], dr);
    const orbit = [V[0] + rho * Math.cos(ang), y + 0.08 * Math.sin(t * 2 + o.a0), V[2] + rho * Math.sin(ang)];
    return { p: lerp3(start, orbit, k), scale: lerp(1, 0.12, dr), light: lerp(1, 0.25, dr), gone: t >= o.absorb, ang };
  }
  const SPHERE_IDS = [];      // every sphere that ends up in the vortex: towers, splash, swarm
  TOWER.forEach((s, i) => SPHERE_IDS.push({ kind: 'tower', s, o: orbitOf(i, 's'), r: TR, k: H(i, 40) < 0.7 ? 'blue' : 'white' }));
  SPLASH.forEach((s, i) => SPHERE_IDS.push({ kind: 'splash', s, o: orbitOf(200 + i, 's'), r: s.r, k: s.k }));
  SWARM.forEach((s, i) => SPHERE_IDS.push({ kind: 'swarm', s, o: orbitOf(400 + i, 's'), r: s.r, k: s.k }));
  const ABSORBED = SPHERE_IDS.length + CANYON.length + 9;
  function absorbedFrac(t) {
    let n = 0;
    for (const x of SPHERE_IDS) if (t >= x.o.absorb) n++;
    for (let i = 0; i < CANYON.length; i++) if (t >= orbitOf(1000 + i, 'panel').absorb) n++;
    return n / ABSORBED;
  }
  function build() { /* everything above is precomputed at load */ }

  // ---------- drawing ----------
  let LIGHT = 1;              // global light level for everything but the hero
  // a sphere rendered in Blender: pick the four atlas views around the direction it is seen from and blend them,
  // so its highlights and reflections stay fixed in the world as the camera moves (flip: seen in the floor mirror)
  function atlasSphere(kind, pos, r, dir, flip, opacity, bright) {
    const NP = ATLAS.phi.length, NT = ATLAS.theta.length, TP = ATLAS.tiles[kind];
    const l = Math.hypot(...dir) || 1, d = dir.map((v) => v / l);
    let ph = Math.atan2(d[0], d[2]) * 180 / Math.PI; if (ph < 0) ph += 360;
    const th = Math.asin(clamp(d[1], -1, 1)) * 180 / Math.PI;
    const fp = ph / (360 / NP), i0 = Math.floor(fp) % NP, i1 = (i0 + 1) % NP, wp = fp - Math.floor(fp);
    const ft = clamp((th - ATLAS.theta[0]) / (ATLAS.theta[1] - ATLAS.theta[0]), 0, NT - 1), j0 = Math.min(NT - 2, Math.floor(ft)), wt = ft - j0;
    const eu = 0.5 / (TP * NP), ev = 0.5 / (TP * NT);
    const tile = (i, j) => { const u0 = i / NP + eu, u1 = (i + 1) / NP - eu, v0 = j / NT + ev, v1 = (j + 1) / NT - ev; return flip ? [u0, v1, u1, v0] : [u0, v0, u1, v1]; };
    const base = { tex: T['at_' + kind], tex2: T['at_' + kind], size: [2.04 * r, 2.04 * r], pos, rot: billboardRot(pos), alphaCut: 0.01, bright };
    E.draw({ ...base, uv: tile(i0, j0), uv2: tile(i1, j0), mix: wp, opacity });
    if (wt > 0.01) E.draw({ ...base, uv: tile(i0, j0 + 1), uv2: tile(i1, j0 + 1), mix: wp, opacity: opacity * wt, depthWrite: false });
  }
  function sphere(list, p, r, k, o = 1, light = 1) {
    if (!p) return;
    const dc = dist3(p, CAM);
    const near = clamp((dc - 0.12) / 0.3, 0, 1);
    if (near <= 0.01 || o <= 0.01) return;
    list.push({ p, r, k, o: o * near, light, orbMix: 0 });
  }
  function drawWorld(t, out, { panels, spheres, glows, rings, pools, hero }) {
    panels = panels.filter((p) => {
      if (p.back) return true;
      const r = (p.rot || [0, 0, 0]).map((v) => v * Math.PI / 180);
      let n = [Math.cos(r[0]) * Math.sin(r[1]), -Math.sin(r[0]), Math.cos(r[0]) * Math.cos(r[1])];
      n = [n[0] * Math.cos(r[2]) - n[1] * Math.sin(r[2]), n[0] * Math.sin(r[2]) + n[1] * Math.cos(r[2]), n[2]];
      const front = n[0] * (CAM[0] - p.pos[0]) + n[1] * (CAM[1] - p.pos[1]) + n[2] * (CAM[2] - p.pos[2]) > 0;
      if (!front && p.back === true && p.flip) { p.color = [0.045, 0.055, 0.075]; p.tex = T.white; delete p.uv; }
      return front || p.back === true;
    });
    E.begin(out, [0.008, 0.01, 0.016]);
    { const solid = panels.filter((p) => (p.opacity ?? 1) >= 0.999 && p.depthWrite !== false);
      const clear = panels.filter((p) => !((p.opacity ?? 1) >= 0.999 && p.depthWrite !== false)).sort((a, b) => dist3(b.pos, CAM) - dist3(a.pos, CAM));
      clear.forEach((p) => { p.depthWrite = false; });
      panels = [...solid, ...clear]; }
    // reflections under the glossy floor
    for (const p of panels) if ((p.opacity ?? 1) > 0.02 && p.pos[1] - p.size[1] / 2 > FY - 0.5) E.draw(mirrored({ ...p, bright: (p.bright ?? 0.9) * LIGHT }));
    spheres.sort((a, b) => dist3(b.p, CAM) - dist3(a.p, CAM));
    for (const s of spheres) {
      const m = [s.p[0], 2 * FY - s.p[1], s.p[2]], dir = [CAM[0] - m[0], -(CAM[1] - m[1]), CAM[2] - m[2]], b = 0.55 * s.light * (s.hero ? 1 : LIGHT);
      atlasSphere(s.hero ? 'hero' : s.k, m, s.r, dir, true, s.o * 0.8, b);
      if (s.orbMix > 0) atlasSphere('orb', m, s.r, dir, true, s.o * 0.8 * s.orbMix, b);
    }
    // the floor: dark glass, lit in pools
    E.draw({ color: [0.03, 0.035, 0.045], tex: T.white, size: [140, 140], pos: [CAM[0], FY, CAM[2] - 20], rot: [-90, 0, 0], opacity: 0.86 });
    for (const q of pools) if (q.o > 0.003) E.draw({ tex: T.pool, size: [q.s, q.s], pos: [q.p[0], FY + 0.001, q.p[2]], rot: [-90, 0, 0], opacity: q.o * LIGHT, tint: q.c || [0.35, 0.45, 0.7], add: true, depthWrite: false });
    for (const g of rings) if (g.o > 0.003) E.draw({ tex: T.ring, size: [g.r * 2, g.r * 2], pos: g.p, rot: g.rot || [-90, 0, 0], opacity: g.o, add: true, depthWrite: false });
    for (const s of spheres) {
      const h = s.p[1] - s.r - FY, so = clamp(1 - h / 1.2, 0, 1) * 0.7 * s.o;
      if (so > 0.01) E.draw({ tex: T.shadow, size: [s.r * (2.4 + h * 1.5), s.r * (2.4 + h * 1.5)], pos: [s.p[0], FY + 0.002, s.p[2]], rot: [-90, 0, 0], opacity: so, depthWrite: false });
    }
    // the real things
    for (const p of panels) if ((p.opacity ?? 1) > 0.01) E.draw({ ...p, bright: (p.bright ?? 0.9) * LIGHT });
    for (const s of spheres) {
      const dir = [CAM[0] - s.p[0], CAM[1] - s.p[1], CAM[2] - s.p[2]], b = s.light * (s.hero ? 1 : lerp(1, LIGHT, 0.85));
      if (s.orbMix < 1) atlasSphere(s.hero ? 'hero' : s.k, s.p, s.r, dir, false, s.o, b);
      if (s.orbMix > 0) atlasSphere('orb', s.p, s.r, dir, false, s.o * (s.orbMix < 1 ? s.orbMix : 1), b);
    }
    for (const g of glows) if (g.o > 0.002 && !(g.near && dist3(g.p, CAM) < 0.6 * g.s)) E.draw({ tex: T.glow, size: [g.s, g.s], pos: g.p, rot: billboardRot(g.p), opacity: g.o * (g.hero ? 1 : LIGHT) * (g.near ? clamp((dist3(g.p, CAM) - 0.6 * g.s) / (0.4 * g.s), 0, 1) : 1), tint: g.c || [0.6, 0.75, 1], add: true, depthWrite: false });
  }

  function scene(t, out) {
    const c = camAt(t); cam(c);
    const panels = [], spheres = [], glows = [], rings = [], pools = [];
    const u = tau(t);
    // light level: dim in the frozen silence, drained at the end
    LIGHT = 1;
    if (t >= FREEZE && t < DROP) LIGHT = lerp(1, 0.22, kk(t, FREEZE, FREEZE + 0.06, ease.lin));
    if (t >= 29.0) LIGHT = lerp(1, 0.3, kk(t, 29.0, 30.6, ease.io));
    const beatPulse = (t0) => { const b = (t - t0) / BEAT; return b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 6); };
    const camPool = { p: [CAMT[0] * 0.5 + CAM[0] * 0.5, FY, CAMT[2] * 0.5 + CAM[2] * 0.5], s: 12, o: 0.22 };
    pools.push(camPool);

    // --- the website, before the camera passes through it ---
    if (CAM[2] > BPOS[2] - 0.02 || t < 6) {
      const on = powerOn(u, H0), fB = t > 5.3 ? clamp(CAM[2] / 0.4, 0, 1) : 1;
      if (on <= 0) {
        panels.push({ color: [0.012, 0.016, 0.024], tex: T.white, size: [BW, BH], pos: BPOS });
        panels.push({ tex: T.outline, size: [BW, BH], pos: [BPOS[0], BPOS[1], BPOS[2] + 0.002], opacity: 0.3, bright: 0.6, depthWrite: false });
      } else {
        panels.push({ tex: T.p_home, size: [BW, BH], pos: BPOS, bright: 0.9 * on * lerp(1, 0.38, kk(u, 3.894, 5.0)), opacity: fB });
        for (const [u0, v0, u1, v1, tl, off] of PIECES) {
          const q = ease.back(kk(u, tl, tl + 0.35, ease.lin));
          if (q <= 0) continue;
          const cx = (u0 + u1) / 2 - 0.5, cy = 0.5 - (v0 + v1) / 2, w = (u1 - u0) * BW, h = (v1 - v0) * BH;
          const base = [BPOS[0] + cx * BW, BPOS[1] + cy * BH, BPOS[2]];
          const [tu0, tv0] = texUV(u0, v0), [tu1, tv1] = texUV(u1, v1);
          const pi = PIECES.findIndex((x) => x[4] === tl), tum = [(H(pi, 50) - 0.5) * 50, (H(pi, 51) - 0.5) * 60, (H(pi, 52) - 0.5) * 30];
          const pp = add3(base, off.map((v, i) => v * q * (i === 2 ? 1.7 : 1.3))).map((v, i) => (i === 2 ? v + 0.008 : v));
          const nearF = clamp((dist3(pp, CAM) - 0.3) / 0.35, 0, 1);
          panels.push({ tex: T.p_home, uv: [tu0, tv0, tu1, tv1], size: [w, h], pos: pp, rot: tum.map((v) => v * q), bright: 1.0, opacity: fB * nearF, back: true });
        }
      }
      if (u >= H0) rings.push({ p: [0, 0.05, 0.01], rot: [0, 0, 0], r: lerp(0.05, 2.2, kk(u, H0, H0 + 0.9, ease.out)), o: 0.9 * (1 - kk(u, H0, H0 + 0.9, ease.lin)) });
      glows.push({ p: [0, 0.05, -0.2], s: 4.5, o: 0.28 * powerOn(u, H0), near: true });
      pools.push({ p: [0, FY, 0.4], s: 3, o: 0.35 + 0.4 * powerOn(u, H0) });
    }
    // --- hall of phones ---
    if (t > 4 && t < 12) {
      const cd = camAt(Math.max(0, t - 0.12));
      for (const p of PHONES) {
        const on = powerOn(u, p.on), y = -0.10;
        const yaw = Math.atan2(cd.pos[0] - p.x, cd.pos[2] - p.z) * 180 / Math.PI;
        const pitch = -Math.atan2(cd.pos[1] - y, Math.hypot(cd.pos[0] - p.x, cd.pos[2] - p.z)) * 180 / Math.PI * 0.6;
        panels.push({ tex: T[p.tex], size: [0.62, 1.26], pos: [p.x, y, p.z], rot: [pitch, yaw, 0], bright: 0.1 + 0.85 * on * (1 + 0.1 * beatPulse(5.784)) });
        if (on > 0) glows.push({ p: [p.x, y, p.z - 0.15], s: 1.4, o: 0.25 * on, near: true });
      }
      const gon = powerOn(u, GP.on);
      if (CAM[2] > GP.pos[2] - 0.05) {
        const fG = clamp((CAM[2] - GP.pos[2]) / 0.6, 0, 1);
        panels.push({ tex: T.ph_ka, size: GP.size, pos: GP.pos, bright: 0.025 + 0.875 * gon, opacity: fG });
        glows.push({ p: [0, 1.0, -7.3], s: 5, o: 0.35 * gon, near: true });
        if (u > 9.091) rings.push({ p: [0, 1.20, -6.92], rot: [0, 0, 0], r: lerp(0.05, 1.4, kk(u, 9.091, 9.8, ease.out)), o: 0.9 * (1 - kk(u, 9.091, 9.8, ease.lin)) });
      }
      pools.push({ p: [0, FY, -3], s: 6, o: 0.3 });
    }
    // --- the canyon, and after the drop the halo, then the vortex ---
    if (t > 7.5 && t < 30.4) {
      CANYON.forEach((p, i) => {
        let pose = canyonPose(p, Math.min(u, TAU_DROP));
        const fl = FLY[i]; let flyOut = 0;
        if (fl && t < DROP) {
          flyOut = kk(u, fl.t0, fl.t0 + 0.45, ease.out) * (1 - kk(u, fl.t1 - 0.35, fl.t1, ease.io));
          pose = { pos: [lerp(pose.pos[0], p.side * 0.62, flyOut), pose.pos[1] + 0.15 * flyOut, pose.pos[2] + 0.2 * flyOut], rot: [0, lerp(pose.rot[1], p.side < 0 ? 26 : -26, flyOut), lerp(pose.rot[2], 0, flyOut)] };
        }
        const slot = SLOT_OF[i];
        let on = powerOn(u, p.on), opacity = 1, scale = 1, light = 1;
        if (t > DROP) {
          const dl = 0.45 * Math.min(1, Math.hypot(pose.pos[0] - PI_[0], pose.pos[2] - PI_[2]) / 30);
          const q = kk(t, DROP + dl, DROP + dl + 1.1, ease.io), hs = haloSlot(slot, t);
          const lift = 1.6 * Math.sin(Math.PI * q);
          const ry0 = pose.rot[1], ry1 = hs.rot[1];
          let dry = ((ry1 - ry0 + 540) % 360) - 180;
          pose = { pos: [lerp(pose.pos[0], hs.pos[0], q), lerp(pose.pos[1], hs.pos[1], q) + lift, lerp(pose.pos[2], hs.pos[2], q)], rot: [lerp(pose.rot[0], 0, q) + 180 * Math.sin(Math.PI * q) * (H(i, 15) < 0.5 ? 1 : 0), ry0 + dry * q, lerp(pose.rot[2], 0, q)] };
          on = 1;
          if (slot === STORE_SLOT && t > 19.05) return;      // the store flies out (drawn separately)
          if (t > VSTART) {
            const o = orbitOf(1000 + i, 'panel');
            const v = vortexPos(o, pose.pos, t, 1.0);
            if (v.gone) return;
            const k = kk(t, o.peel, o.peel + 0.9, ease.io);
            pose = { pos: v.p, rot: [0, lerp(pose.rot[1], Math.atan2(V[0] - v.p[0], V[2] - v.p[2]) * 180 / Math.PI, k), 0] };
            scale = v.scale; light = v.light;
          }
        }
        const dz = pose.pos[2] - CAM[2];
        if (t < DROP && (dz > 2.5 || dz < -26)) return;
        const pulse = 1 + 0.12 * beatPulse(9.563) * (t < FREEZE ? 1 : 0);
        const flying = t > DROP && t < DROP + 1.7;
        opacity *= clamp((scale - 0.14) / 0.3, 0, 1);
        if (flyOut > 0) { scale *= 1 + 0.15 * flyOut; on = Math.max(on, 1) * (1 + 0.12 * flyOut); }
        panels.push({ tex: T[p.tex], size: [PANEL_W * scale, PANEL_H * scale], pos: pose.pos, rot: pose.rot, bright: (0.07 + 0.78 * on * pulse) * (p.r === 2 ? 0.8 : 1) * light, opacity, back: flying, flip: flying });
      });
      if (t > 9.3 && t < DROP) pools.push({ p: [0, FY, CAM[2] - 4], s: 7, o: 0.3 });
    }
    // --- the hero ---
    const hp = heroAt(t);
    let hr = HR, hmix = 0;
    if (t > 26.5) { const f = absorbedFrac(t); hr = lerp(HR, 0.55, Math.cbrt(f)); hmix = clamp(f * 1.4, 0, 1); }
    const heroP = t > 26.5 ? [S[0], S[1] + (hr - HR) * 0.0, S[2]] : hp;
    spheres.push({ p: heroP, r: hr * (t > ORB_IN - 0.5 ? orbPulse(t) : 1), orbMix: hmix, o: t > ORB_IN ? 1 : clamp((dist3(heroP, CAM) - 0.03) / 0.1, 0, 1), light: 1, hero: true, k: 'chrome' });
    glows.push({ p: heroP, s: lerp(0.4, 0.2, hmix) * (t >= FREEZE && t < DROP ? 1.6 : 1), o: lerp(0.35, 0.0, hmix), c: [0.75, 0.85, 1], hero: true });
    // --- the swarm, the splash, the towers; all of them join the vortex and drain into the orb ---
    for (const x of SPHERE_IDS) {
      let p = x.kind === 'tower' ? towerPos(x.s, Math.min(t, x.o.peel)) : x.kind === 'splash' ? splashPos(x.s, Math.min(t, x.o.peel)) : swarmPos(x.s, Math.min(t, x.o.peel));
      if (!p) continue;
      let r = x.r, light = 1;
      if (t > x.o.peel) { const v = vortexPos(x.o, p, t); if (v.gone) { if (t < x.o.absorb + 0.12) glows.push({ p: S, s: 0.3, o: 0.6 * (1 - (t - x.o.absorb) / 0.12), hero: true }); continue; } p = v.p; r *= v.scale; light = v.light; }
      sphere(spheres, p, r, x.k, 1, light);
    }
    // --- after the drop: shockwaves, the store and its orders ---
    if (t >= DROP) {
      for (const [k, t0] of [[0, DROP], [1, DROP + BEAT], [2, DROP + 2 * BEAT]]) { const q = kk(t, t0, t0 + 1.3, ease.out); if (q > 0 && q < 1) rings.push({ p: [PI_[0], FY + 0.003, PI_[2]], r: 0.2 + 9 * q, o: (1 - q) * (k ? 0.5 : 1) }); }
      glows.push({ p: [PI_[0], FY + 0.3, PI_[2]], s: 6, o: 0.9 * Math.exp(-(t - DROP) * 3.5) });
      if (t < 28.5) pools.push({ p: PI_, s: 16, o: 0.35 });
      if (t > 19.05 && t < 30.4) {
        const from = haloSlot(STORE_SLOT, 19.05), q = ease.back(kk(t, 19.05, 19.05 + BEAT, ease.lin));
        let pos = lerp3(from.pos, [0, 1.25, -32.3], q), w = lerp(PANEL_W, 3.2, q), rot = [0, lerp(from.rot[1], 180, q), 0], light = 1;
        if (t > VSTART) { const o = orbitOf(1500, 'panel'); o.peel = VSTART + 0.2; o.absorb = 30.0; const v = vortexPos(o, pos, t, 1.0); if (!v.gone) { pos = v.p; w *= v.scale; light = v.light; rot = [0, Math.atan2(V[0] - pos[0], V[2] - pos[2]) * 180 / Math.PI, 0]; } else w = 0; }
        if (w > 0) panels.push({ tex: T.p_store, size: [w, w / 1.6], pos, rot, bright: 0.92 * light });
        // order notifications, one per beat
        for (let n = 0; n < 8; n++) {
          const t0 = 19.05 + n * BEAT; if (t < t0) continue;
          const pop = ease.back(kk(t, t0, t0 + 0.25, ease.lin));
          let slot = 0; for (let m = n + 1; m < 8; m++) slot += ease.io(kk(t, 19.05 + m * BEAT, 19.05 + m * BEAT + 0.2, ease.lin));
          if (slot > 3.6) continue;
          let p = [-1.0, 0.55 + 0.36 * slot, -32.42], sc = lerp(0.7, 1, pop) * 1.5 * clamp(3.6 - slot, 0, 1), lt = 1;
          if (t > VSTART) { const o = orbitOf(1600 + n, 'panel'); o.peel = VSTART + 0.1 * n; o.absorb = 28.2 + 0.2 * n; const v = vortexPos(o, p, t, 1.0); if (v.gone) continue; p = v.p; sc *= v.scale; lt = v.light; }
          panels.push({ tex: T.toast[n % 5], size: [0.85 * sc, 0.85 * sc * 200 / 820], pos: p, rot: [0, 180, 0], opacity: clamp(pop * 1.5, 0, 1), bright: lt, depthWrite: false });
        }
      }
    }
    // --- the vortex's light ---
    if (t > VSTART && t < 29) glows.push({ p: [V[0], 3, V[2]], s: 9, o: 0.25 * kk(t, VSTART, 24.7) * (1 - kk(t, 27.5, 29)), c: [0.4, 0.55, 1] });
    // --- the orb's heartbeat ---
    if (t >= ORB_IN - 0.5) {
      for (let n = 0; n < 4; n++) {
        const t0 = ORB_IN + n * BEAT, q = kk(t, t0, t0 + 1.2, ease.out);
        if (t >= t0 && q < 1) rings.push({ p: [S[0], FY + 0.003, S[2]], r: 0.3 + 2.7 * q, o: 0.45 * (1 - q) });
        if (t >= t0) glows.push({ p: S, s: 1.5, o: 0.55 * Math.exp(-(t - t0) / 0.15), c: [0.35, 0.55, 1], hero: true });
      }
      pools.push({ p: S, s: 3, o: 0.25 });
    }
    drawWorld(t, out, { panels, spheres, glows, rings, pools });
  }

  // ---------- frame: three sub-frames averaged (motion blur), then the film finish ----------
  window.renderFrame = async (t) => {
    await window.ready;
    const N = 8, SH = 0.4 / 30;           // 144-degree shutter, 8 samples
    const acc = E.fbo('ACC'), one = E.fbo('ONE');
    for (let i = 0; i < N; i++) {
      const ts = Math.max(0, t + (i / (N - 1) - 0.5) * SH);
      scene(ts, one);
      E.blit(one, acc, 1 / N, i === 0);
    }
    cam(camAt(t));
    let flash = 0, ca = 0.0012, bloomAmt = 0.45, vig = 0.75, fadeAmt = 0;
    for (const [h, a] of [[H0, 0.18], [DROP, 0.16]]) if (t >= h) { flash = Math.max(flash, a * Math.exp(-(t - h) / (h === DROP ? 0.1 : 0.2))); ca = Math.max(ca, 0.0012 + 0.003 * Math.exp(-(t - h) / 0.25)); }
    if (t >= DROP) bloomAmt = lerp(0.9, 0.5, kk(t, DROP, DROP + 0.6));
    if (t >= FREEZE && t < DROP) vig = 0.95;
    if (t >= 28.5) { bloomAmt = lerp(0.5, 0.3, kk(t, 28.5, ORB_IN)); vig = lerp(0.75, 0.95, kk(t, 28.5, ORB_IN)); }
    if (t < 0.3) fadeAmt = 1 - t / 0.3;
    if (t > 32.1) fadeAmt = kk(t, 32.1, BLACK, ease.lin);
    E.finish(acc, null, { seed: Math.floor(t * 30) * 0.618, fade: [0, 0, 0], fadeAmt, warm: 0, vig, grain: 0.03, ca, contrast: 1.1, lift: 0, bloomAmt, bloomTh: 0.85, leak: 0, time: t, flash });
  };
})();
