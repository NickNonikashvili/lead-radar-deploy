// EvoSoft classical-art ad — the story version, told only in pictures (no voice, no captions), cut to the song:
// an idea sketched -> it becomes a real website, hung like a masterpiece -> EvoSoft -> technology brought to life ->
// code becomes software -> software for business -> an online store that sells at night -> the business grows ->
// people admire the work -> growth, ambition -> made in Georgia -> signed and sealed -> what EvoSoft does.
(() => {
  'use strict';
  const { ease, textures: T, clamp, lerp, D0 } = E;
  let TL, SC;
  const CROP = {
    hands: [0.219, 0.25, 0.539, 0.647],
    cards: [0, 0.04, 1, 0.812], cardsMask: [0.055, 0.085],
    feast: [0, 0.006, 1, 0.994], feastMask: [0.55, 0.62],
    hall: [0.19, 0.42, 0.80, 0.92],
    galleryWall: [0, 0.09, 1, 0.9045],
    night: [0, 0.19, 1, 0.937],
    wanderer: [0, 0.22, 1, 0.6585],
    sunrise: [0, 0.1, 1, 0.884],
    wheat: [0, 0.22, 1, 0.9],
    adamArm: [0.2, 0.36, 0.378, 0.52], adamMask: [0.2, 0.27],
    ui: [0, 0.069, 1, 0.931],                     // the sketch/website sheet at 1.74:1
  };
  const k01 = (t, a, b, e = ease.io) => e((t - a) / Math.max(1e-6, b - a));
  const float = (t, s = 1) => [Math.sin(t * 0.7) * 0.012 * s + Math.sin(t * 1.7 + 1) * 0.005 * s, Math.cos(t * 0.6) * 0.01 * s + Math.sin(t * 1.3 + 2) * 0.004 * s];
  const view = (d) => 2 * d * Math.tan((20 * Math.PI) / 180);
  const dur = (id) => SC[id][1] - SC[id][0];

  const PAINT = ['creation_adam', 'night', 'cards', 'pirosmani_feast', 'gallery', 'wheatfield', 'wanderer', 'sunrise'];
  window.ready = (async () => {
    TL = await (await fetch('../timeline3.json', { cache: 'no-store' })).json();
    SC = TL.scenes;
    window.DURATION = TL.duration;
    await Promise.all(['300px Anton', '200px Pinyon', '120px Fell', 'italic 120px Fell', '700 100px Cinzel', '400 100px Cinzel', '600 80px Cormorant', 'italic 500 80px Cormorant', '700 80px Figtree', '500 80px Figtree', '800 80px Gabarito', '60px Mono'].map((f) => document.fonts.load(f, 'AaBb')));
    await document.fonts.ready;
    const jobs = [];
    const safe = (key, url, o) => E.loadTex(key, url, o).catch(() => { console.warn('missing ' + url); T[key] = T.grey; });
    for (const k of PAINT) { jobs.push(safe(k, `../art/${k}.jpg`)); jobs.push(safe(k + '_d', `../art/${k}.depth.png`, { mip: false })); }
    for (const k of ['parchment_p', 'wood', 'ui_color']) jobs.push(safe(k, `../art/${k}.jpg`));
    for (const k of ['glow', 'giltframe', 'ui_lines']) jobs.push(E.loadTex(k, `../art/${k}.png`));
    jobs.push(E.loadTex('ui_reveal', '../art/ui_reveal.png', { mip: false }));
    for (const k of ['evo', 'mailtabs', 'studycat', 'register', 'reports', 'store']) jobs.push(E.loadTex('shot_' + k, `../shots/${k}.jpg`));
    const imgs = {};
    await Promise.all(['mobile', 'mobile_ka'].map(async (k) => { const i = new Image(); i.src = `../shots/${k}.jpg`; await i.decode(); imgs[k] = i; }));
    jobs.push(E.loadSvgTex('mark', '../art/mark.svg', 1024));
    await Promise.all(jobs);
    E.gradTex('vband', 'vband'); E.gradTex('radial', 'radial');
    T.parchment = T.parchment_p;
    T.phone_on = phoneTex(imgs.mobile); T.phone_ka = phoneTex(imgs.mobile_ka); T.phone_off = phoneTex(null);
    T.toast = [toastTex('New order', '2 items · 86.00 ₾', '23:14'), toastTex('New order', '1 item · 42.50 ₾', '23:41'), toastTex('Payment received', '128.00 ₾', '00:07'), toastTex('New order', '3 items · 64.00 ₾', '01:22'), toastTex('New order', '1 item · 39.90 ₾', '02:05'), toastTex('New order', '4 items · 152.00 ₾', '03:48')];
    T.seal = sealTex();
    T.gold = goldTex();
  })();

  // ---------- drawn props ----------
  function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  // a phone: dark body, screen with the mobile site (or dark), camera island
  function phoneTex(img) {
    const Wd = 620, Ht = 1260, c = document.createElement('canvas'); c.width = Wd; c.height = Ht; const x = c.getContext('2d');
    rr(x, 0, 0, Wd, Ht, 92); x.fillStyle = '#0f1115'; x.fill();
    rr(x, 6, 6, Wd - 12, Ht - 12, 88); x.strokeStyle = '#3a3f4a'; x.lineWidth = 6; x.stroke();
    x.save(); rr(x, 26, 26, Wd - 52, Ht - 52, 70); x.clip();
    if (img) { const sw = img.width, sh = Math.min(img.height, sw * (Ht - 52) / (Wd - 52)); x.drawImage(img, 0, 0, sw, sh, 26, 26, Wd - 52, Ht - 52); }
    else { const g = x.createLinearGradient(0, 0, Wd, Ht); g.addColorStop(0, '#14171d'); g.addColorStop(0.5, '#1d222b'); g.addColorStop(1, '#0c0e12'); x.fillStyle = g; x.fillRect(0, 0, Wd, Ht); }
    x.restore();
    rr(x, Wd / 2 - 70, 46, 140, 38, 19); x.fillStyle = '#05060a'; x.fill();
    return E.texFromSource(c);
  }
  // an order notification card
  function toastTex(title, sub, when) {
    const Wd = 820, Ht = 200, c = document.createElement('canvas'); c.width = Wd; c.height = Ht; const x = c.getContext('2d');
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 24; x.shadowOffsetY = 8;
    rr(x, 16, 12, Wd - 32, Ht - 40, 34); x.fillStyle = 'rgba(255,255,255,.96)'; x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = '#22A447'; x.beginPath(); x.arc(96, Ht / 2 - 8, 44, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(74, Ht / 2 - 8); x.lineTo(90, Ht / 2 + 8); x.lineTo(120, Ht / 2 - 24); x.stroke();
    x.fillStyle = '#14213D'; x.font = '800 54px Gabarito'; x.fillText(title, 168, Ht / 2 - 14);
    x.fillStyle = '#536279'; x.font = '500 40px Figtree'; x.fillText(sub, 168, Ht / 2 + 38);
    x.fillStyle = '#94a3b8'; x.font = '500 34px Figtree'; x.textAlign = 'right'; x.fillText(when, Wd - 52, Ht / 2 - 20);
    return E.texFromSource(c);
  }
  // red sealing wax with the mark struck in
  function sealTex() {
    const S = 600, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#7c0f12';
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, r = S * (0.39 + 0.05 * E.hash(i + 3)); x.beginPath(); x.arc(S / 2 + Math.cos(a) * r * 0.25, S / 2 + Math.sin(a) * r * 0.25, r * 0.78, 0, Math.PI * 2); x.fill(); }
    const g = x.createRadialGradient(S * 0.4, S * 0.36, 10, S / 2, S / 2, S * 0.46);
    g.addColorStop(0, 'rgba(255,120,110,.55)'); g.addColorStop(0.5, 'rgba(160,20,25,.0)'); g.addColorStop(1, 'rgba(40,0,0,.5)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.lineWidth = 10; x.strokeStyle = 'rgba(60,0,0,.6)'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2); x.stroke();
    const strokes = ['M10.5 32H53.5', 'M49 32A17 17 0 1 0 31.41 48.99', 'M31.41 48.99A17 17 0 0 0 45.02 42.93'];
    const k = S * 0.0088, ox = S / 2 - 32 * k, oy = S / 2 - 32 * k;
    for (const [dx, dy, col] of [[4, 4, 'rgba(50,0,0,.75)'], [-3, -3, 'rgba(255,140,130,.55)'], [0, 0, '#8e1418']]) {
      x.save(); x.translate(ox + dx, oy + dy); x.scale(k, k); x.lineWidth = 8; x.strokeStyle = col; for (const d of strokes) x.stroke(new Path2D(d)); x.restore();
    }
    return E.texFromSource(c);
  }
  function goldTex() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, '#8a5a12'); g.addColorStop(0.35, '#f6d27a'); g.addColorStop(0.6, '#e2a93c'); g.addColorStop(1, '#7a4b0c');
    x.fillStyle = g; x.fillRect(0, 0, 64, 512);
    return E.texFromSource(c);
  }

  // ---------- helpers ----------
  function glow(pos, size, opacity, tint = [1, 0.92, 0.8]) {
    if (opacity <= 0.001) return;
    E.draw({ tex: T.glow, size: [size, size], pos, opacity, tint, add: true, depthWrite: false });
  }
  function dust(t, { n = 40, c = [0, 0, 0.3], box = [3.6, 2.2, 1.2], size = 0.03, op = 0.55, tint = [1, 0.88, 0.7], seed = 1, rise = 0.05 } = {}) {
    for (let i = 0; i < n; i++) {
      const h1 = E.hash(i * 3.1 + seed), h2 = E.hash(i * 7.7 + seed), h3 = E.hash(i * 1.3 + seed * 2), h4 = E.hash(i * 5.9 + seed * 3);
      const y = ((h2 + t * rise * (0.5 + h4)) % 1) - 0.5;
      const p = [c[0] + (h1 - 0.5) * box[0] + Math.sin(t * 0.4 + i) * 0.04, c[1] + y * box[1], c[2] + (h3 - 0.5) * box[2]];
      glow(p, size * (0.6 + h4 * 1.2), op * (0.55 + 0.45 * Math.sin(t * (1.5 + h4 * 2) + i)) * (0.4 + 0.6 * h3), tint);
    }
  }
  function framed(content, { pos, rot = [0, 0, 0], w, h, opacity = 1, uv, bright = 1 }) {
    E.draw({ tex: content, size: [w, h], pos, rot, opacity, uv, bright });
    E.draw({ tex: T.giltframe, size: [w * 2400 / 1880, h * 1600 / 1080], pos: E.offsetAlong(pos, rot, 0.004), rot, opacity, alphaCut: 0.5 });
  }
  function calligraphy(key, lines, opts, place, revealT, extra = {}) {
    const tt = E.textTex(key, lines, { reveal: true, ...opts });
    const w = place.w, h = w / tt.aspect;
    E.draw({ tex: tt.tex, reveal: tt.reveal, revealT, size: [w, h], pos: place.pos, rot: place.rot || [0, 0, 0], depthWrite: false, curl: place.curl || 0, ...extra });
  }
  // a gold bar (a box) standing on y = base
  function bar(x, base, z, w, h, d, op = 1) {
    if (h <= 0.002) return;
    const cy = base + h / 2;
    for (let j = 10; j >= 1; j--) E.draw({ tex: T.white, size: [w, h], pos: [x, cy, z - d * j / 10], color: [0.55, 0.36, 0.08], alphaCut: 0.1, opacity: op });
    E.draw({ tex: T.white, size: [w, d], pos: [x, base + h, z - d / 2], rot: [-90, 0, 0], color: [1, 0.86, 0.5], opacity: op });
    E.draw({ tex: T.gold, size: [w, h], pos: [x, cy, z], opacity: op, bright: 1.05 });
  }

  const SHOT = {};

  // A — an idea: a pencil sketches a website on parchment
  SHOT.A = (t, out) => {
    E.begin(out, [0.9, 0.85, 0.76]);
    const d = dur('A'), f = float(t, 0.6);
    E.camera({ pos: [f[0] + lerp(0.12, -0.05, t / d), f[1] + lerp(-0.06, 0.02, t / d), lerp(D0 * 0.82, D0 * 0.95, ease.out(t / d))], target: [0, 0, 0], roll: lerp(-2, 0, t / d) });
    E.draw({ tex: T.parchment, size: [5.6, 3.4], pos: [0, 0, -0.05], bright: 1.0 });
    E.draw({ tex: T.ui_lines, reveal: T.ui_reveal, revealT: k01(t, 0.05, d - 0.3, (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 1.5)) * 1.02, uv: CROP.ui, size: [3.48, 2], pos: [0, 0, 0.002], depthWrite: false, opacity: 0.95 });
    dust(t, { n: 22, c: [0, 0, 0.5], op: 0.3, tint: [1, 0.85, 0.6], seed: 2 });
  };

  // B — the sketch fills in and becomes the real site, then the camera pulls back: it hangs in a gallery like a masterpiece
  SHOT.B = (t, out) => {
    E.begin(out, [0.06, 0.05, 0.04]);
    const d = dur('B');
    const fill = k01(t, 0.05, 0.9, ease.sine);
    const back = k01(t, 1.05, d - 0.15, ease.io);
    const f = float(t);
    E.camera({ pos: [f[0] + lerp(-0.05, 0.25, back), f[1] + lerp(0.02, 0.05, back), lerp(D0 * 0.95, D0 * 2.25, back)], target: [lerp(0, 0.1, back), 0, 0] });
    // the gallery around it (seen as the camera pulls back)
    E.draw({ tex: T.gallery, depth: T.gallery_d, size: [7.6 * 3840 / 2652, 7.6], pos: [0.15, -0.35, -1.8], depthAmt: 0.8, bright: 0.8 * back + 0.05 });
    // parchment edge fades as the frame appears
    E.draw({ tex: T.parchment, size: [5.6, 3.4], pos: [0, 0, -0.05], opacity: 1 - back, bright: 1.0 });
    E.draw({ tex: T.ui_color, uv: CROP.ui, size: [3.48, 2], pos: [0, 0, 0], opacity: fill });
    E.draw({ tex: T.ui_lines, uv: CROP.ui, size: [3.48, 2], pos: [0, 0, 0.002], opacity: (1 - fill) * 0.95, depthWrite: false });
    E.draw({ tex: T.giltframe, size: [3.48 * 2400 / 1880, 2 * 1600 / 1080], pos: [0, 0, 0.03], opacity: back, alphaCut: 0.5 });
    dust(t, { n: 40, c: [0, 0, 0.8], box: [5, 3, 1.5], op: 0.45 * back, seed: 3 });
  };

  // C — the name: EVOSOFT stands in Panini's gallery hall; the visitors in front of it
  SHOT.C = (t, out) => {
    E.begin(out, [0.08, 0.06, 0.05]);
    const k = t / dur('C'), f = float(t);
    E.camera({ pos: [lerp(0.18, -0.12, ease.sine(k)) + f[0], lerp(-0.05, 0.02, k) + f[1], lerp(D0 * 1.0, D0 * 0.84, ease.out(k))], target: [0, 0, -0.3] });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.hall, depthAmt: 0.9, margin: 1.15 });
    E.clearDepth();
    E.text3d(t, {
      str: 'EVOSOFT', font: 'Anton', sizePx: 300, color: '#c9643c', height: 0.95, depth: 0.24, layers: 22, letter: 18,
      pos: [0, 0.22, -0.32], side: [0.45, 0.18, 0.1],
      perLetter: (i) => { const q = ease.back((t - 0.12 - i * 0.118) / 0.6); return { dy: (1 - q) * -1.6, rx: (1 - q) * 25, o: t > 0.12 + i * 0.118 ? 1 : 0 }; },
    });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.hall, depthAmt: 0.9, margin: 1.15, mask: [0.62, 0.7] });
    dust(t, { n: 40, c: [0, 0.2, 0.2], op: 0.45, seed: 4 });
  };

  // D — technology brought to life: a phone rises between Michelangelo's hands; the touch wakes it
  SHOT.D = (t, out) => {
    E.begin(out, [0.9, 0.86, 0.8]);
    const d = dur('D'), touch = 1.42;
    const into = k01(t, d - 0.85, d, ease.in);
    const f = float(t, 0.8);
    E.camera({ pos: [f[0] + lerp(0, 0.0, into), f[1] + lerp(0, 0.02, into), lerp(lerp(D0 * 0.95, D0 * 0.72, k01(t, 0, d - 0.85, ease.sine)), D0 * 0.12, into)], target: [0, lerp(0, 0.02, into), 0] });
    E.painting(T.creation_adam, T.creation_adam_d, { crop: CROP.hands, margin: 1.15, depthAmt: 0.28 });
    const rise = ease.out(k01(t, 0.15, 1.15, ease.lin));
    const ph = 0.62, pw = ph * 620 / 1260;
    const pos = [0, lerp(-1.6, 0.03, rise), -0.05];
    const rot = [lerp(25, 0, rise), lerp(-30, 0, rise) + Math.sin(t * 1.2) * 3, lerp(-12, 0, rise)];
    E.draw({ tex: T.phone_off, size: [pw, ph], pos, rot });
    const on = k01(t, touch, touch + 0.35, ease.out);
    if (on > 0) E.draw({ tex: T.phone_on, size: [pw, ph], pos: E.offsetAlong(pos, rot, 0.002), rot, opacity: on });
    const burst = clamp(1 - (t - touch) / 0.7, 0, 1) * (t > touch ? 1 : 0);
    glow([0, 0.03, 0.05], lerp(0.4, 2.4, 1 - burst), burst * 0.9, [1, 0.92, 0.75]);
    glow([0, 0.03, 0.02], 1.1, 0.25 * on, [0.75, 0.85, 1]);
    dust(t, { n: 30, c: [0, 0, 0.3], op: 0.35, tint: [1, 0.85, 0.6], seed: 5 });
  };

  // E — made by hand: code is written on parchment in ink; then the parchment becomes the finished app
  SHOT.E = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const d = dur('E'), k = t / d;
    E.camera({ pos: [lerp(0.2, -0.05, ease.sine(k)), lerp(-0.1, 0.03, k), lerp(D0 * 0.95, D0 * 0.9, ease.out(k))], target: [0, 0, 0], roll: lerp(-3, 0, k) });
    E.draw({ tex: T.wood, size: [7, 7], pos: [0, 0, -0.05], bright: 0.85 });
    const prot = [0, 0, -2];
    const app = k01(t, 1.35, 1.9, ease.io);
    E.draw({ tex: T.parchment, size: [3.1, 1.9], pos: [0, 0, 0], rot: prot, curl: 0.04, bright: 1.05, opacity: 1 - app * 0.9 });
    calligraphy('Ecode', ['<header class="store">', '  <nav>Shop · Orders · Reports</nav>', '  <button>Buy now</button>', '</header>'],
      { font: 'italic|Fell', size: 96, color: '#3b1a10', align: 'left', lineH: 1.25, pad: 0.15 },
      { w: 2.3, pos: [0, 0.02, 0.01], rot: prot, curl: 0.04 }, k01(t, 0.05, 1.35, ease.lin) * 1.01, { opacity: 1 - app });
    if (app > 0) framed(T.shot_evo, { pos: [0, 0, 0.03], rot: prot, w: 1.85, h: 1.85 / 1.6, opacity: app });
    glow([0, 0, 0.3], lerp(0.5, 3.5, app), Math.sin(app * Math.PI) * 0.7, [1, 0.9, 0.7]);
    glow([0.5, 0.6, 0.4], 3.0, 0.18, [1, 0.78, 0.5]);
    dust(t, { n: 30, c: [0, 0, 0.5], op: 0.4, tint: [1, 0.82, 0.55], seed: 6 });
  };

  // F — software for business: SOFTWARE in the red room behind Caravaggio's players, app screens tumbling; then framed on a table
  SHOT.Fpop = (t, out) => {
    E.begin(out, [0.55, 0.04, 0.05]);
    E.camera({ pos: [lerp(0.08, -0.08, t / 2.4), 0, lerp(D0, D0 * 0.9, ease.out(t / 2.4))], target: [0, 0, -0.3] });
    E.draw({ tex: T.parchment, size: [9, 5.2], pos: [0, 0, -1.6], tint: [1.0, 0.16, 0.13], sat: 0.5, bright: 0.85 });
    E.text3d(t, {
      str: 'SOFTWARE', font: 'Anton', sizePx: 300, color: '#f4efe6', height: 0.9, depth: 0.2, layers: 22, pos: [0, 0.5, -0.75], side: [0.62, 0.58, 0.52],
      perLetter: (i) => { const q = ease.back((t - 0.02 - i * 0.04) / 0.45); return { dy: (1 - q) * 1.4, dz: (1 - q) * 0.6, rz: (1 - q) * (i % 2 ? 12 : -12), o: t > 0.02 + i * 0.04 ? 1 : 0 }; },
    });
    const shots = [T.shot_evo, T.shot_mailtabs, T.shot_studycat];
    for (let i = 0; i < 9; i++) {
      const h1 = E.hash(i + 1), h2 = E.hash(i + 11), h3 = E.hash(i + 21);
      const t0 = 0.15 + i * 0.14;
      if (t < t0) continue;
      const kk = (t - t0) / 2.2;
      const z = i % 3 === 0 ? 0.35 : -0.45 - h3 * 0.3;
      const pos = [lerp(-1.9, 1.9, h1), lerp(1.4, -1.6, kk) + h2 * 0.3, z];
      const rot = [lerp(-30, 40, h2) + kk * 160 * (h1 - 0.5), lerp(-40, 40, h3) + kk * 120, (h1 - 0.5) * 60 + kk * 80];
      E.draw({ tex: T.white, size: [0.56, 0.37], pos: E.offsetAlong(pos, rot, -0.002), rot, tint: [0.95, 0.95, 0.95] });
      E.draw({ tex: shots[i % 3], size: [0.52, 0.325], pos, rot });
    }
    E.painting(T.cards, T.cards_d, { crop: CROP.cards, depthAmt: 0.35, mask: CROP.cardsMask, margin: 1.1, pos: [0, -0.62] });
  };
  SHOT.F = (t, out) => {
    const pop = E.fbo('pop');
    SHOT.Fpop(t, pop);
    E.begin(out, [0.03, 0.02, 0.015]);
    const d = dur('F');
    const back = k01(t, d - 0.75, d, ease.io);
    E.camera({ pos: [lerp(0, 0.25, back), lerp(0, -0.35, back), lerp(D0, D0 * 2.6, back)], target: [0, 0, 0], roll: lerp(0, -6, back) });
    const rot = [lerp(0, -52, back), 0, lerp(0, 8, back)];
    E.draw({ tex: T.wood, size: [14, 10], pos: E.offsetAlong([0, 0, 0], rot, -0.03), rot, bright: 0.9 });
    framed(pop.tex, { pos: [0, 0, 0], rot, w: 16 / 9 * 2, h: 2, uv: [0, 1, 1, 0] });
  };

  // G — an online store that never sleeps: a lit window in Grimshaw's night lane shows the shop; orders rise like lanterns
  SHOT.G = (t, out) => {
    E.begin(out, [0.03, 0.05, 0.05]);
    const d = dur('G'), k = t / d, f = float(t);
    E.camera({ pos: [lerp(0.12, -0.1, ease.sine(k)) + f[0], lerp(-0.02, 0.03, k) + f[1], lerp(D0 * 1.0, D0 * 0.88, ease.out(k))], target: [lerp(0.08, -0.06, ease.sine(k)), 0, 0] });
    E.painting(T.night, T.night_d, { crop: CROP.night, depthAmt: 0.12, margin: 1.15, bright: 0.92 });
    // the shop, open in the middle of the night: a tablet glowing in the lane, showing the store's sales
    const tq = ease.out(k01(t, 0, 0.6, ease.lin));
    const tpos = [-0.62, lerp(-0.25, -0.08, tq), 0.32], trot = [0, 14, 0];
    glow([tpos[0], tpos[1], tpos[2] - 0.05], 2.2, 0.45 * tq, [1, 0.78, 0.45]);
    E.draw({ tex: T.white, size: [0.98, 0.64], pos: E.offsetAlong(tpos, trot, -0.004), rot: trot, color: [0.06, 0.07, 0.09], opacity: tq });
    E.draw({ tex: T.shot_store, size: [0.92, 0.575], pos: tpos, rot: trot, bright: 0.82, tint: [1, 0.96, 0.9], opacity: tq });
    // orders keep arriving, hour after hour, and stack up like notifications
    const N = T.toast.length, t0s = Array.from({ length: N }, (_, i) => 0.35 + i * 0.3);
    for (let i = 0; i < N; i++) {
      if (t < t0s[i]) continue;
      const pop = ease.back(k01(t, t0s[i], t0s[i] + 0.3, ease.lin));
      // how far later toasts have pushed this one up
      let slot = 0; for (let j = i + 1; j < N; j++) slot += ease.io(k01(t, t0s[j], t0s[j] + 0.25, ease.lin));
      const p = [0.5, -0.5 + slot * 0.215, 0.35 + i * 0.002];
      const o = clamp(pop * 1.5, 0, 1) * clamp((4.6 - slot) / 1.2, 0, 1);
      const sc = lerp(0.85, 1, pop);
      E.draw({ tex: T.toast[i], size: [0.82 * sc, 0.82 * sc * 200 / 820], pos: p, opacity: o, depthWrite: false });
      if (slot < 0.3) glow([p[0] - 0.28, p[1], p[2] - 0.01], 0.5, 0.35 * o * (1 - slot / 0.3), [0.6, 1, 0.7]);
    }
    dust(t, { n: 45, c: [0, 0.1, 0.3], box: [3.2, 2, 0.6], size: 0.02, op: 0.5, tint: [0.85, 0.9, 1], seed: 7, rise: -0.06 });
  };

  // H — the business grows: gold bars rise out of the sea of fog in front of Friedrich's wanderer
  SHOT.H = (t, out) => {
    E.begin(out, [0.8, 0.82, 0.84]);
    const k = t / dur('H'), f = float(t);
    E.camera({ pos: [lerp(-0.12, 0.2, ease.sine(k)) + f[0], lerp(0.02, 0.06, k) + f[1], lerp(D0 * 0.9, D0 * 0.78, ease.out(k))], target: [lerp(-0.12, 0.2, ease.sine(k)) * 0.4, 0.04, -0.2] });
    E.painting(T.wanderer, T.wanderer_d, { crop: CROP.wanderer, depthAmt: 0.9, margin: 1.2 });
    const H = [0.3, 0.45, 0.62, 0.8, 1.02], X = [-1.12, -0.7, 0.5, 0.92, 1.34];
    H.forEach((h, i) => {
      const q = ease.back(k01(t, 0.2 + i * 0.236, 0.85 + i * 0.236, ease.lin));
      const x = X[i];
      bar(x, -0.3, -0.42, 0.32, h * q, 0.22);
      if (q > 0.6) glow([x, -0.3 + h * q + 0.02, -0.3], 0.45, 0.35 * (q - 0.6) * 2.5, [1, 0.85, 0.5]);
    });
    E.draw({ tex: T.vband, size: [6, 0.42], pos: [0, -0.42, -0.3], tint: [0.86, 0.88, 0.9], opacity: 0.85, depthWrite: false });
    dust(t, { n: 30, c: [0, 0.3, 0.2], op: 0.4, tint: [1, 0.9, 0.7], seed: 8, rise: 0.12 });
  };

  // I — people come to see the work: the apps hang in gilt frames in the gallery; the middle frame opens onto the wheat field
  SHOT.I = (t, out) => {
    const portal = E.fbo('portal');
    SHOT.J(0, portal);
    E.begin(out, [0.05, 0.04, 0.03]);
    const d = dur('I');
    const into = k01(t, d - 1.25, d, ease.in);
    const fh = 0.66, fw = fh * 16 / 9, fpos = [0, 0.16, 0.6];
    const dFill = (fh / 2) / Math.tan((20 * Math.PI) / 180);
    const f = float(t);
    const cam0 = [lerp(-0.25, 0.05, k01(t, 0, 1.6, ease.sine)) + f[0], 0.02 + f[1], D0 * 1.08];
    const camE = [fpos[0], fpos[1], fpos[2] + dFill];
    const cam = cam0.map((v, i) => lerp(v, camE[i], into));
    E.camera({ pos: cam, target: [lerp(0, fpos[0], into), lerp(0, fpos[1], into), lerp(-0.5, fpos[2], into)] });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.galleryWall, depthAmt: 0.7, margin: 1.2, bright: 0.85 });
    const hang = [
      { tex: T.shot_evo, x: -1.12, y: 0.22, s: 0.46, t0: 0.1 },
      { tex: T.shot_studycat, x: 1.12, y: 0.22, s: 0.46, t0: 0.33 },
      { tex: T.shot_mailtabs, x: -0.62, y: -0.55, s: 0.34, t0: 0.57 },
      { tex: T.shot_reports, x: 0.62, y: -0.55, s: 0.34, t0: 0.75 },
    ];
    for (const fr of hang) {
      const q = ease.back(k01(t, fr.t0, fr.t0 + 0.55, ease.lin));
      if (q <= 0) continue;
      const pos = [lerp(fr.x * 2.4, fr.x, q), lerp(fr.y + 1.6, fr.y, q), lerp(1.5, 0.45, q)];
      const rot = [lerp(-40, 0, q), lerp(fr.x * 30, 0, q), lerp(fr.x * 20, 0, q)];
      framed(fr.tex, { pos, rot, w: fr.s * 1.74, h: fr.s, uv: [0, 0.03, 1, 0.97] });
    }
    const wq = ease.back(k01(t, 0.95, 1.5, ease.lin));
    if (wq > 0) {
      const pos = [fpos[0], lerp(fpos[1] + 1.4, fpos[1], wq), lerp(1.4, fpos[2], wq)];
      E.draw({ tex: portal.tex, uv: [0, 1, 1, 0], size: [fw, fh], pos });
      E.draw({ tex: T.giltframe, size: [fw * 2400 / 1880, fh * 1600 / 1080], pos: [pos[0], pos[1], pos[2] + 0.004], alphaCut: 0.5 });
      glow([pos[0], pos[1], pos[2] + 0.02], 2.2, 0.25 * wq, [1, 0.85, 0.5]);
    }
    dust(t, { n: 35, c: [0, 0.1, 0.7], op: 0.4, seed: 9 });
  };

  // J — the harvest: rushing over Van Gogh's wheat field
  SHOT.J = (t, out) => {
    E.begin(out, [0.9, 0.8, 0.5]);
    const k = t / dur('J');
    E.camera({ pos: [Math.sin(t * 3) * 0.04, lerp(-0.05, -0.2, k), lerp(D0 * 1.0, D0 * 0.42, ease.in(k))], target: [0, lerp(0.02, -0.12, k), -1] });
    E.painting(T.wheatfield, T.wheatfield_d, { crop: CROP.wheat, depthAmt: 0.8, margin: 1.25 });
  };

  // K — ambition: Adam's hand reaches for the sun over Aivazovsky's sea
  SHOT.K = (t, out) => {
    E.begin(out, [0.9, 0.6, 0.35]);
    const d = dur('K'), k = t / d, f = float(t);
    E.camera({ pos: [lerp(0, 0.3, ease.sine(k)) + f[0], lerp(0, -0.02, k) + f[1], lerp(D0, D0 * 0.74, ease.sine(k))], target: [lerp(0, 0.35, ease.sine(k)), -0.03, -1] });
    E.painting(T.sunrise, T.sunrise_d, { crop: CROP.sunrise, depthAmt: 0.6, margin: 1.2 });
    const sun = k01(t, 0.2, d - 0.4, ease.sine);
    glow([0.78, -0.07, 0.15], lerp(0.6, 2.6, sun), 0.55 * sun + 0.25, [1, 0.82, 0.55]);
    glow([0.78, -0.07, 0.16], 0.32, 0.6 + 0.4 * sun, [1, 0.97, 0.88]);
    const reach = k01(t, 0.1, d - 0.3, ease.out);
    const aw = 1.7, ah = aw * (0.16 * 1599) / (0.178 * 3524);
    E.draw({ tex: T.creation_adam, depth: T.creation_adam_d, uv: CROP.adamArm, size: [aw, ah], depthAmt: 0.12, mask: CROP.adamMask, pos: [lerp(-2.7, -0.55, reach), lerp(-0.5, -0.2, reach), 0.45], bright: 0.85, tint: [1, 0.86, 0.72] });
    dust(t, { n: 40, c: [0.4, 0, 0.5], op: 0.5, tint: [1, 0.8, 0.5], seed: 10 });
    const flash = k01(t, d - 0.45, d, ease.in);
    glow([0.7, -0.05, 0.4], lerp(0.5, 7, flash), flash, [1, 0.95, 0.85]);
  };

  // L — made in Georgia: over Pirosmani's valley a phone rises showing the site in Georgian; the procession walks below
  SHOT.L = (t, out) => {
    E.begin(out, [0.05, 0.04, 0.03]);
    const d = dur('L'), k = t / d, f = float(t);
    E.camera({ pos: [lerp(-0.2, 0.15, ease.sine(k)) + f[0], lerp(0.0, 0.04, k) + f[1], lerp(D0, D0 * 0.8, ease.io(k))], target: [lerp(-0.05, 0.1, k), 0.05, 0] });
    E.painting(T.pirosmani_feast, T.pirosmani_feast_d, { crop: CROP.feast, depthAmt: 0.5, margin: 1.15 });
    const rise = ease.out(k01(t, 0.25, 1.6, ease.lin));
    const ph = 1.25, pw = ph * 620 / 1260;
    const pos = [0.15, lerp(-2.2, 0.12, rise), -0.12];
    const rot = [lerp(18, 0, rise), lerp(-25, 0, rise) + Math.sin(t * 1.1) * 4, lerp(8, 0, rise)];
    glow([pos[0], pos[1], pos[2] - 0.05], 2.6, 0.35 * rise, [1, 0.85, 0.55]);
    E.draw({ tex: T.phone_ka, size: [pw, ph], pos, rot });
    // the people in the valley stay in front of it
    E.painting(T.pirosmani_feast, T.pirosmani_feast_d, { crop: CROP.feast, depthAmt: 0.5, margin: 1.15, mask: CROP.feastMask });
    dust(t, { n: 35, c: [0, 0.2, 0.4], op: 0.45, tint: [1, 0.85, 0.6], seed: 11 });
  };

  // M — signed and sealed: "EvoSoft" in ink, then a red wax seal with the mark is pressed onto the parchment
  SHOT.M = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const d = dur('M'), k = t / d;
    const stamp = 2.62;
    const shake = t > stamp ? Math.exp(-(t - stamp) * 9) * Math.sin((t - stamp) * 60) * 0.012 : 0;
    E.camera({ pos: [lerp(0.25, -0.05, ease.sine(k)) + shake, lerp(-0.12, 0.04, k), lerp(D0 * 0.98, D0 * 0.84, ease.out(k))], target: [0, -0.02, 0], roll: lerp(-3, 1, k) });
    E.draw({ tex: T.wood, size: [7, 7], pos: [0, 0, -0.05], bright: lerp(0.0, 0.85, k01(t, 0, 0.5)) });
    const pb = lerp(0.0, 1.0, k01(t, 0, 0.5));
    const prot = [0, 0, -3];
    E.draw({ tex: T.parchment, size: [3.1, 1.9], pos: [0, 0, 0], rot: prot, bright: 1.05 * pb, curl: 0.04 });
    calligraphy('Msig', ['EvoSoft'], { font: 'Pinyon', size: 240, color: '#2a160c', lineH: 1.3, pad: 0.3 }, { w: 2.2, pos: [-0.15, 0.12, 0.01], rot: prot, curl: 0.04 }, k01(t, 0.3, 2.2, ease.lin) * 1.01, { opacity: pb });
    const s = k01(t, stamp - 0.25, stamp, ease.in);
    if (s > 0) {
      const sc = lerp(2.2, 1, s);
      E.draw({ tex: T.seal, size: [0.62 * sc, 0.62 * sc], pos: [0.82, -0.42, lerp(0.6, 0.02, s)], rot: [0, 0, -12], opacity: clamp(s * 2, 0, 1), depthWrite: false });
    }
    glow([0.82, -0.42, 0.1], lerp(0.3, 1.6, k01(t, stamp, stamp + 0.5)), t > stamp ? 0.5 * Math.exp(-(t - stamp) * 4) : 0, [1, 0.6, 0.45]);
    glow([0.4, 0.5, 0.3], 3.2, 0.2 * pb, [1, 0.78, 0.5]);
    dust(t, { n: 35, c: [0, 0, 0.5], box: [3, 2, 0.8], op: 0.45 * pb, tint: [1, 0.82, 0.55], seed: 12 });
  };

  // N — end card: what EvoSoft does, where, and how to start
  SHOT.N = (t, out) => {
    E.begin(out, [0.95, 0.88, 0.86]);
    E.camera({ pos: [0, 0, lerp(D0 * 1.02, D0 * 0.97, ease.out(t / 3.6))], target: [0, 0, 0] });
    E.draw({ tex: T.parchment, size: [4.4, 2.5], pos: [0, 0, -0.02], tint: [1.0, 0.9, 0.88], sat: 0.35, bright: 1.15 });
    const r = (a) => ease.out(k01(t, a, a + 0.9, ease.lin));
    E.draw({ tex: T.mark, size: [0.32, 0.32], pos: [0, 0.64 - (1 - r(0.1)) * 0.06, 0], opacity: r(0.1) });
    const nm = E.textTex('Nname', ['EvoSoft'], { font: '700|Cinzel', size: 200, color: '#1d1410', pad: 0.05, letter: 8 });
    E.draw({ tex: nm.tex, size: [0.34 * nm.aspect, 0.34], pos: [0, 0.27 - (1 - r(0.3)) * 0.06, 0], opacity: r(0.3) });
    const tag = E.textTex('Ntag', ['Websites · Online stores · Apps · Business software'], { font: 'italic 500|Cormorant', size: 100, color: '#3a2a24', pad: 0.1 });
    E.draw({ tex: tag.tex, size: [0.14 * tag.aspect, 0.14], pos: [0, -0.02 - (1 - r(0.55)) * 0.05, 0], opacity: r(0.55) });
    const loc = E.textTex('Nloc', ['Built to order in Tbilisi, Georgia'], { font: 'italic 500|Cormorant', size: 100, color: '#5a4038', pad: 0.1 });
    E.draw({ tex: loc.tex, size: [0.11 * loc.aspect, 0.11], pos: [0, -0.2 - (1 - r(0.75)) * 0.05, 0], opacity: r(0.75) * 0.9 });
    const url = E.textTex('Nurl', ['evosoft.solutions'], { font: '600|Cormorant', size: 130, color: '#7a1d14', pad: 0.08 });
    E.draw({ tex: url.tex, size: [0.2 * url.aspect, 0.2], pos: [0, -0.46 - (1 - r(1.0)) * 0.05, 0], opacity: r(1.0) });
    const cta = E.textTex('Ncta', ['GET A FREE QUOTE'], { font: '400|Cinzel', size: 90, color: '#7a1d14', pad: 0.3, letter: 10 });
    E.draw({ tex: cta.tex, size: [0.14 * cta.aspect, 0.14], pos: [0, -0.72, 0], opacity: r(1.3) });
  };

  // ---------- timeline ----------
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
  const IN = { A: 'cut', B: 'cut', C: ['fade', 0.3], D: ['fade', 0.25], E: 'cut', F: ['fade', 0.25], G: ['fade', 0.3], H: ['fade', 0.3], I: ['fade', 0.25], J: 'cut', K: ['fade', 0.3], L: 'cut', M: ['fade', 0.35], N: 'cut' };
  const BLUR = [[(S) => S.J[0], (S) => S.J[1], 5, 0.05]];
  const HITS = [8.04, 12.3, 13.24, 15.55, 18.95, 23.18, 30.27, 32.9];
  const LOOK = { A: [0.12, 0.08], B: [0.2, 0.12], C: [0.45, 0.15], D: [0.5, 0.15], E: [0.45, 0.18], F: [0.35, 0.12], G: [0.45, 0.15], H: [0.35, 0.12], I: [0.5, 0.15], J: [0.4, 0.2], K: [0.8, 0.25], L: [0.5, 0.18], M: [0.3, 0.16], N: [0.1, 0.05] };

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
    let blur = null;
    for (const [f0, f1, n, sh] of BLUR) if (t >= f0(SC) && t < f1(SC)) blur = [n, sh];
    let res;
    if (blur) {
      const acc = E.fbo('acc'), accB = E.fbo('accB');
      const [n, sh] = blur;
      for (let s = 0; s < n; s++) {
        res = composite(t + (s / (n - 1) - 0.5) * sh, A, B);
        E.blit(A, acc, 1 / n, s === 0);
        if (res.other) E.blit(B, accB, 1 / n, s === 0);
      }
      E.blit(acc, A, 1, true); if (res.other) E.blit(accB, B, 1, true);
    } else res = composite(t, A, B);
    let fade = [0, 0, 0], fadeAmt = 0;
    const f = (a, b) => clamp((t - a) / (b - a), 0, 1);
    if (t > SC.E[0] - 0.2 && t < SC.E[0] + 0.3) { fade = [1, 0.97, 0.9]; fadeAmt = t < SC.E[0] ? f(SC.E[0] - 0.2, SC.E[0]) : 1 - f(SC.E[0], SC.E[0] + 0.3); }
    if (t > SC.J[0] - 0.15 && t < SC.J[0] + 0.3) { fade = [1, 0.95, 0.85]; fadeAmt = t < SC.J[0] ? f(SC.J[0] - 0.15, SC.J[0]) : 1 - f(SC.J[0], SC.J[0] + 0.3); }
    if (t > SC.L[0] - 0.12 && t < SC.L[0] + 0.35) { fade = [1, 0.96, 0.9]; fadeAmt = t < SC.L[0] ? f(SC.L[0] - 0.12, SC.L[0]) : 1 - f(SC.L[0], SC.L[0] + 0.35); }
    if (t > SC.N[0] - 0.25 && t < SC.N[0] + 0.5) { fade = [0.95, 0.72, 0.76]; fadeAmt = t < SC.N[0] ? f(SC.N[0] - 0.25, SC.N[0]) : 1 - f(SC.N[0], SC.N[0] + 0.5); }
    if (t > TL.duration - 0.8) { fade = [0, 0, 0]; fadeAmt = f(TL.duration - 0.8, TL.duration - 0.05); }
    if (t < 0.3) { fade = [0, 0, 0]; fadeAmt = 1 - f(0, 0.3); }
    let flash = 0;
    for (const h of HITS) if (t >= h) flash = Math.max(flash, 0.12 * Math.exp(-(t - h) / 0.2));
    const look = LOOK[res.id] || [0.5, 0.15];
    E.finish(res.other ? B : A, res.other ? A : null, { mixAB: 1 - res.mix, seed: Math.floor(t * 30) * 0.618, fade, fadeAmt, warm: 0.36, vig: 0.7, grain: 0.05, contrast: 1.08, lift: 0.025, bloomAmt: look[0], bloomTh: 0.8, leak: look[1], time: t, flash });
  };
})();
