// The EvoSoft classical-art ad, music version: no voice, cut to the song, every cut on a beat; glow, light leaks
// and drifting dust for a more emotional film. Shot times are in timeline2.json.
(() => {
  'use strict';
  const { track, ease, textures: T, clamp, lerp, D0 } = E;
  let TL, SC;
  const CROP = {
    hands: [0.219, 0.25, 0.539, 0.647],
    flowers: [0.05, 0.2, 0.95, 0.56],
    eye: [0.295, 0.3125, 0.535, 0.4275],
    wanderer: [0, 0.22, 1, 0.6585],
    night: [0, 0.19, 1, 0.937],
    cards: [0, 0.04, 1, 0.812], cardsMask: [0.055, 0.085],
    feast: [0, 0.006, 1, 0.994],
    hall: [0.19, 0.42, 0.80, 0.92],                // the gallery's central arch with its visitors
    galleryWall: [0, 0.09, 1, 0.9045],
    sunrise: [0, 0.1, 1, 0.884],
    wheat: [0, 0.22, 1, 0.9],
    isle: [0, 0.1, 1, 0.889], isleGap: [0.07, -0.2],
    adamArm: [0.2, 0.36, 0.378, 0.52], adamMask: [0.2, 0.27],
  };
  const k01 = (t, a, b, e = ease.io) => e((t - a) / Math.max(1e-6, b - a));
  const float = (t, s = 1) => [Math.sin(t * 0.7) * 0.012 * s + Math.sin(t * 1.7 + 1) * 0.005 * s, Math.cos(t * 0.6) * 0.01 * s + Math.sin(t * 1.3 + 2) * 0.004 * s];

  const PAINT = ['creation_adam', 'flowers', 'pearl', 'wanderer', 'night', 'cards', 'pirosmani_feast', 'gallery', 'wheatfield', 'isle', 'sunrise'];
  window.ready = (async () => {
    TL = await (await fetch('../timeline2.json', { cache: 'no-store' })).json();
    SC = TL.scenes;
    window.DURATION = TL.duration;
    await Promise.all(['300px Anton', '200px Pinyon', '120px Fell', 'italic 120px Fell', '700 100px Cinzel', '400 100px Cinzel', '600 80px Cormorant', 'italic 500 80px Cormorant'].map((f) => document.fonts.load(f, 'AaBb')));
    await document.fonts.ready;
    const jobs = [];
    const safe = (key, url, o) => E.loadTex(key, url, o).catch(() => { console.warn('missing ' + url); T[key] = T.grey; });
    for (const k of PAINT) { jobs.push(safe(k, `../art/${k}.jpg`)); jobs.push(safe(k + '_d', `../art/${k}.depth.png`, { mip: false })); }
    for (const k of ['parchment_p', 'wood']) jobs.push(safe(k, `../art/${k}.jpg`));
    for (const k of ['lines', 'glow', 'giltframe']) jobs.push(E.loadTex(k, `../art/${k}.png`));
    jobs.push(E.loadTex('lines_reveal', '../art/lines_reveal.png', { mip: false }));
    for (const k of ['evo', 'mailtabs', 'studycat']) jobs.push(E.loadTex('shot_' + k, `../shots/${k}.jpg`));
    jobs.push(E.loadSvgTex('mark', '../art/mark.svg', 1024));
    await Promise.all(jobs);
    E.gradTex('vband', 'vband'); E.gradTex('radial', 'radial');
    T.parchment = T.parchment_p;
    T.coin = coinTex();
  })();

  // a gold medallion with the EvoSoft mark struck into it
  function coinTex() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const g = x.createRadialGradient(S * 0.38, S * 0.32, S * 0.05, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, '#fff3c2'); g.addColorStop(0.35, '#e8b74a'); g.addColorStop(0.8, '#a8711c'); g.addColorStop(1, '#5e3a0c');
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * 0.49, 0, Math.PI * 2); x.fill();
    for (const [r, w, col] of [[0.47, 10, 'rgba(90,55,10,.7)'], [0.455, 4, 'rgba(255,236,170,.6)'], [0.4, 6, 'rgba(90,55,10,.55)']]) { x.lineWidth = w; x.strokeStyle = col; x.beginPath(); x.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); x.stroke(); }
    // beading around the rim
    for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; x.fillStyle = 'rgba(255,230,160,.55)'; x.beginPath(); x.arc(S / 2 + Math.cos(a) * S * 0.43, S / 2 + Math.sin(a) * S * 0.43, 5, 0, Math.PI * 2); x.fill(); }
    // the mark (from mark.svg, 64-unit box), embossed: shadow, highlight, face
    const strokes = ['M10.5 32H53.5', 'M49 32A17 17 0 1 0 31.41 48.99', 'M31.41 48.99A17 17 0 0 0 45.02 42.93'];
    const k = S * 0.0105, ox = S / 2 - 32 * k, oy = S / 2 - 32 * k;
    for (const [dx, dy, col] of [[5, 6, 'rgba(70,40,5,.85)'], [-3, -4, 'rgba(255,245,200,.9)'], [0, 0, '#d9a23a']]) {
      x.save(); x.translate(ox + dx, oy + dy); x.scale(k, k); x.lineWidth = 9; x.lineCap = 'butt'; x.strokeStyle = col;
      for (const d of strokes) x.stroke(new Path2D(d));
      x.restore();
    }
    return E.texFromSource(c);
  }

  // ---------- helpers ----------
  const view = (d) => 2 * d * Math.tan((20 * Math.PI) / 180);
  function glow(pos, size, opacity, tint = [1, 0.92, 0.8]) {
    if (opacity <= 0.001) return;
    E.draw({ tex: T.glow, size: [size, size], pos, opacity, tint, add: true, depthWrite: false });
  }
  // dust drifting through the light: n motes in a box around `c`, rising slowly and twinkling
  function dust(t, { n = 40, c = [0, 0, 0.3], box = [3.6, 2.2, 1.2], size = 0.03, op = 0.55, tint = [1, 0.88, 0.7], seed = 1, rise = 0.05 } = {}) {
    for (let i = 0; i < n; i++) {
      const h1 = E.hash(i * 3.1 + seed), h2 = E.hash(i * 7.7 + seed), h3 = E.hash(i * 1.3 + seed * 2), h4 = E.hash(i * 5.9 + seed * 3);
      const y = ((h2 + t * rise * (0.5 + h4)) % 1) - 0.5;
      const p = [c[0] + (h1 - 0.5) * box[0] + Math.sin(t * 0.4 + i) * 0.04, c[1] + y * box[1], c[2] + (h3 - 0.5) * box[2]];
      const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + h4 * 2) + i);
      glow(p, size * (0.6 + h4 * 1.2), op * tw * (0.4 + 0.6 * h3), tint);
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
  const dur = (id) => SC[id][1] - SC[id][0];

  const SHOT = {};

  // A — the pencil line becomes Michelangelo's hands; the spark where the fingers meet (on the beat)
  SHOT.A = (t, out) => {
    E.begin(out, [0.93, 0.91, 0.87]);
    const d = dur('A');
    const push = k01(t, d - 1.3, d, ease.in);
    const cz = lerp(D0, D0 * 0.38, push), f = float(t, 0.6);
    E.camera({ pos: [f[0] + lerp(0, 0.015, push), f[1], cz], target: [lerp(0, 0.015, push), 0, 0], roll: lerp(0, 2.5, push) });
    if (t < d - 0.5) E.draw({ tex: T.parchment, size: [5.3, 3.0], pos: [0, 0, -0.5], sat: 0.15, bright: 1.25 });
    const paint = k01(t, 1.25, 2.1, ease.sine);
    if (paint > 0) E.painting(T.creation_adam, T.creation_adam_d, { crop: CROP.hands, margin: 1.15, depthAmt: lerp(0, 0.28, k01(t, 2.0, 2.9)), opacity: paint });
    const lineO = 1 - k01(t, 1.9, 2.5);
    if (lineO > 0) E.draw({ tex: T.lines, reveal: T.lines_reveal, revealT: k01(t, 0.15, 1.5, ease.out) * 1.02, size: [16 / 9 * 2, 2], pos: [0, 0, 0.003], opacity: lineO * 0.95, depthWrite: false });
    const sp = k01(t, d - 0.55, d - 0.05, ease.in);
    glow([0.005, -0.004, 0.05], lerp(0.05, 2.2, sp), clamp(sp * 1.6, 0, 1), [1, 0.88, 0.68]);
    dust(t, { n: 26, op: 0.35 * paint, tint: [1, 0.85, 0.6], seed: 2 });
  };

  // B — flowers bloom out of the dark
  SHOT.B = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const k = t / dur('B'), f = float(t);
    E.camera({ pos: [lerp(-0.3, 0.2, ease.sine(k)) + f[0], lerp(0.05, -0.04, k) + f[1], lerp(D0 * 0.98, D0 * 0.76, ease.out(k))], target: [0, 0, -0.15] });
    E.painting(T.flowers, T.flowers_d, { crop: CROP.flowers, depthAmt: 0.75, bright: lerp(0.0, 1.1, k01(t, 0, 0.5, ease.out)), margin: 1.25 });
    dust(t, { n: 30, c: [0, 0, 0.4], op: 0.5, tint: [1, 0.7, 0.55], seed: 3, size: 0.035 });
  };

  // C — the eye through a slit of light
  SHOT.C = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const k = t / dur('C');
    const cam = [lerp(0.02, -0.02, k), 0, lerp(D0 * 0.92, D0 * 0.8, k)];
    E.camera({ pos: cam, target: [cam[0], 0, 0] });
    E.painting(T.pearl, T.pearl_d, { crop: CROP.eye, depthAmt: 0.25, margin: 1.15, bright: 1.1 });
    const half = lerp(0.0, 0.17, k01(t, 0.05, 0.55, ease.out));
    const dd = 1.1, vh = view(dd), cz = cam[2] - dd;
    E.draw({ tex: T.white, color: [0, 0, 0], size: [vh * 2.2, vh], pos: [cam[0], half + vh / 2, cz], noDepthTest: true, depthWrite: false });
    E.draw({ tex: T.white, color: [0, 0, 0], size: [vh * 2.2, vh], pos: [cam[0], -half - vh / 2, cz], noDepthTest: true, depthWrite: false });
    for (const s of [1, -1]) E.draw({ tex: T.vband, size: [vh * 2.2, 0.06], pos: [cam[0], s * half, cz + 0.001], tint: [1, 0.68, 0.4], opacity: 0.45 * clamp(half / 0.17, 0, 1), add: true, noDepthTest: true });
  };

  // D — the title: EVOSOFT stands as giant letters in Panini's gallery hall, the visitors in front of them
  SHOT.D = (t, out) => {
    E.begin(out, [0.08, 0.06, 0.05]);
    const k = t / dur('D'), f = float(t);
    E.camera({ pos: [lerp(0.18, -0.12, ease.sine(k)) + f[0], lerp(-0.05, 0.02, k) + f[1], lerp(D0 * 1.0, D0 * 0.84, ease.out(k))], target: [0, 0, -0.3] });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.hall, depthAmt: 0.9, margin: 1.15 });
    E.clearDepth();                               // the letters stand in front of the hall...
    E.text3d(t, {
      str: 'EVOSOFT', font: 'Anton', sizePx: 300, color: '#c9643c', height: 0.95, depth: 0.24, layers: 22, letter: 18,
      pos: [0, 0.22, -0.32], side: [0.45, 0.18, 0.1],
      perLetter: (i, n) => { const q = ease.back((t - 0.12 - i * 0.118) / 0.6); return { dy: (1 - q) * -1.6, rx: (1 - q) * 25, o: t > 0.12 + i * 0.118 ? 1 : 0 }; },
    });
    // ...and behind the visitors at the bottom of the painting
    E.painting(T.gallery, T.gallery_d, { crop: CROP.hall, depthAmt: 0.9, margin: 1.15, mask: [0.62, 0.7] });
    dust(t, { n: 40, c: [0, 0.2, 0.2], op: 0.45, seed: 4 });
  };

  // E — into Grimshaw's moonlit lane (its lit windows), then out: a painting in a gilt frame; a whip pan away
  SHOT.E = (t, out) => {
    E.begin(out, [0.05, 0.1, 0.08]);
    const d = dur('E');
    const pw = 3.48, ph = 2;
    const inside = k01(t, 0, d - 1.0, ease.sine);
    const pull = k01(t, d - 1.05, d - 0.25, ease.io);
    const whip = k01(t, d - 0.38, d, ease.in);
    const cz = lerp(lerp(D0 * 0.5, D0 * 0.44, inside), D0 * 2.05, pull);
    const cx = lerp(lerp(-0.85, 0.62, inside), 0, pull) - whip * 4.5;
    const cy = lerp(lerp(-0.08, -0.16, inside), 0, pull);
    E.camera({ pos: [cx, cy, cz], target: [cx + whip * 0.8, cy, 0] });
    E.draw({ tex: T.parchment, size: [40, 24], pos: [0, 0, -0.6], tint: [0.22, 0.42, 0.3], sat: 0.6, bright: 0.5 });
    const rot = [0, lerp(0, 18, k01(t, d - 0.6, d)), 0];
    E.painting(T.night, T.night_d, { crop: CROP.night, margin: 1.0, depthAmt: lerp(0.16, 0.05, pull), rot });
    E.draw({ tex: T.giltframe, size: [pw * 2400 / 1880, ph * 1600 / 1080], pos: [0, 0, 0.04], rot, alphaCut: 0.5 });
    // the lit windows glow; snow-dust in the lamplight
    glow([-0.87, -0.12, 0.06], 0.9 * (1 - pull), 0.35, [1, 0.72, 0.35]);
    glow([0.77, -0.15, 0.06], 0.8 * (1 - pull), 0.3, [1, 0.72, 0.35]);
    if (pull < 0.5) dust(t, { n: 45, c: [cx, cy, 0.25], box: [2.2, 1.3, 0.6], size: 0.02, op: 0.5, tint: [0.85, 0.9, 1], seed: 5, rise: -0.08 });
  };

  // F — Pirosmani's Georgia; a parchment flies in and writes "Built to order, in Georgia"
  SHOT.F = (t, out) => {
    E.begin(out, [0.05, 0.04, 0.03]);
    const k = t / dur('F'), f = float(t);
    E.camera({ pos: [lerp(-0.15, 0.32, ease.sine(k)) + f[0], lerp(0.02, -0.02, k) + f[1], lerp(D0, D0 * 0.76, ease.io(k))], target: [lerp(0, 0.32, ease.io(k)), 0, 0] });
    E.painting(T.pirosmani_feast, T.pirosmani_feast_d, { crop: CROP.feast, depthAmt: 0.5, margin: 1.15 });
    const fly = ease.out(k01(t, 0.0, 0.6, ease.lin));
    const sway = Math.sin(t * 1.3) * 1.2;
    const ppos = [lerp(3.2, 0.62, fly), lerp(1.9, 0.02, fly), lerp(1.4, 0.55, fly)];
    const prot = [lerp(25, -6, fly) + sway * 0.4, lerp(-70, -14, fly) + sway, lerp(50, 4, fly)];
    E.draw({ tex: T.parchment, size: [1.55, 1.05], pos: ppos, rot: prot, curl: 0.05, bright: 1.08, uv: [0.06, 0.08, 0.94, 0.92] });
    const rv = t < 1.35 ? 0.5 * k01(t, 0.35, 1.35, ease.lin) : 0.5 + 0.5 * k01(t, 1.35, 2.15, ease.lin);
    calligraphy('F', ['Built to order,', 'in Georgia'], { font: 'italic|Fell', size: 150, color: '#6c1212', lineH: 1.2 },
      { w: 1.15, pos: E.offsetAlong(ppos, prot, 0.006), rot: prot, curl: 0.05 }, rv * 1.01);
    dust(t, { n: 30, c: [0.3, 0, 0.6], op: 0.4, seed: 6 });
  };

  // G — the red room: SOFTWARE behind Caravaggio's card players, app screens tumbling; then framed on a table
  SHOT.Gpop = (t, out) => {
    E.begin(out, [0.55, 0.04, 0.05]);
    E.camera({ pos: [lerp(0.08, -0.08, t / 2.4), 0, lerp(D0, D0 * 0.9, ease.out(t / 2.4))], target: [0, 0, -0.3] });
    E.draw({ tex: T.parchment, size: [9, 5.2], pos: [0, 0, -1.6], tint: [1.0, 0.16, 0.13], sat: 0.5, bright: 0.85 });
    E.text3d(t, {
      str: 'SOFTWARE', font: 'Anton', sizePx: 300, color: '#f4efe6', height: 0.9, depth: 0.2, layers: 22, pos: [0, 0.5, -0.75], side: [0.62, 0.58, 0.52],
      perLetter: (i, n) => { const q = ease.back((t - 0.02 - i * 0.04) / 0.45); return { dy: (1 - q) * 1.4, dz: (1 - q) * 0.6, rz: (1 - q) * (i % 2 ? 12 : -12), o: t > 0.02 + i * 0.04 ? 1 : 0 }; },
    });
    const shots = [T.shot_evo, T.shot_mailtabs, T.shot_studycat];
    for (let i = 0; i < 9; i++) {
      const h1 = E.hash(i + 1), h2 = E.hash(i + 11), h3 = E.hash(i + 21);
      const t0 = 0.15 + i * 0.14;
      if (t < t0) continue;
      const k = (t - t0) / 2.2;
      const z = i % 3 === 0 ? 0.35 : -0.45 - h3 * 0.3;
      const pos = [lerp(-1.9, 1.9, h1), lerp(1.4, -1.6, k) + h2 * 0.3, z];
      const rot = [lerp(-30, 40, h2) + k * 160 * (h1 - 0.5), lerp(-40, 40, h3) + k * 120, (h1 - 0.5) * 60 + k * 80];
      E.draw({ tex: T.white, size: [0.56, 0.37], pos: E.offsetAlong(pos, rot, -0.002), rot, tint: [0.95, 0.95, 0.95] });
      E.draw({ tex: shots[i % 3], size: [0.52, 0.325], pos, rot });
    }
    E.painting(T.cards, T.cards_d, { crop: CROP.cards, depthAmt: 0.35, mask: CROP.cardsMask, margin: 1.1, pos: [0, -0.62] });
  };
  SHOT.G = (t, out) => {
    const pop = E.fbo('pop');
    SHOT.Gpop(t, pop);
    E.begin(out, [0.03, 0.02, 0.015]);
    const d = dur('G');
    const back = k01(t, d - 0.75, d, ease.io);
    E.camera({ pos: [lerp(0, 0.25, back), lerp(0, -0.35, back), lerp(D0, D0 * 2.6, back)], target: [0, 0, 0], roll: lerp(0, -6, back) });
    const rot = [lerp(0, -52, back), 0, lerp(0, 8, back)];
    E.draw({ tex: T.wood, size: [14, 10], pos: E.offsetAlong([0, 0, 0], rot, -0.03), rot, bright: 0.9 });
    framed(pop.tex, { pos: [0, 0, 0], rot, w: 16 / 9 * 2, h: 2, uv: [0, 1, 1, 0] });
  };

  // H — the wanderer above the sea of fog; WEBSITE rises out of the fog behind him
  SHOT.H = (t, out) => {
    E.begin(out, [0.8, 0.82, 0.84]);
    const k = t / dur('H'), f = float(t);
    E.camera({ pos: [lerp(-0.12, 0.24, ease.sine(k)) + f[0], lerp(0.02, 0.06, k) + f[1], lerp(D0 * 0.9, D0 * 0.78, ease.out(k))], target: [lerp(-0.12, 0.24, ease.sine(k)) * 0.4, 0.04, -0.2] });
    E.painting(T.wanderer, T.wanderer_d, { crop: CROP.wanderer, depthAmt: 0.9, margin: 1.2 });
    E.text3d(t, {
      str: 'WEBSITE', font: 'Anton', sizePx: 300, color: '#e9a33c', height: 0.62, depth: 0.16, layers: 20, letter: 34,
      pos: [0, 0.5, -0.35], side: [0.55, 0.27, 0.07],
      perLetter: (i, n) => { const q = ease.back((t - 0.15 - i * 0.118) / 0.8); return { dy: (1 - q) * -1.25, rx: (1 - q) * 40, o: t > 0.15 + i * 0.118 ? 1 : 0 }; },
    });
    E.draw({ tex: T.vband, size: [6, 0.7], pos: [0, -0.05, -0.3], tint: [0.86, 0.88, 0.9], opacity: 0.9, depthWrite: false });
    dust(t, { n: 30, c: [0, 0.3, 0.2], op: 0.35, tint: [1, 0.95, 0.85], seed: 7 });
  };

  // I — a gold EvoSoft medallion turning in the dark; it flips on the hit and the camera falls into its light
  SHOT.I = (t, out) => {
    E.begin(out, [0.02, 0.012, 0.01]);
    const d = dur('I');
    const into = k01(t, d - 0.9, d, ease.in), f = float(t, 1.5);
    E.camera({ pos: [f[0], f[1], lerp(D0 * 1.05, D0 * 0.25, into)], target: [0, 0, 0] });
    const hit = 18.95 - SC.I[0];
    const spin = lerp(-40, 20, k01(t, 0, hit, ease.out)) + 360 * k01(t, hit, hit + 0.6, ease.out);
    const rot = [Math.sin(t * 0.8) * 8, spin, Math.sin(t * 0.5) * 4];
    const R = 0.78;
    for (let j = 16; j >= 1; j--) E.draw({ tex: T.coin, size: [R * 2, R * 2], pos: E.offsetAlong([0, 0, 0], rot, -0.06 * j / 16), rot, color: [0.55 * (0.6 + 0.4 * (1 - j / 16)), 0.36 * (0.6 + 0.4 * (1 - j / 16)), 0.1], alphaCut: 0.5 });
    E.draw({ tex: T.coin, size: [R * 2, R * 2], pos: [0, 0, 0], rot, alphaCut: 0.3, bright: 1.1 });
    // a sweep of light across the gold
    const sweep = (t * 0.6) % 1;
    glow([lerp(-0.9, 0.9, sweep), lerp(0.5, -0.5, sweep), 0.12], 0.7, 0.35, [1, 0.9, 0.6]);
    glow([0, 0, -0.4], 3.2, 0.25, [1, 0.6, 0.25]);
    dust(t, { n: 55, c: [0, 0, 0.3], box: [4, 2.4, 1.6], size: 0.03, op: 0.7, tint: [1, 0.8, 0.45], seed: 8, rise: 0.08 });
    glow([0, 0, 0.2], lerp(0.2, 6, into), into, [1, 0.92, 0.75]);
  };

  // J — the gallery wall: Evo, StudyCat and Mailtabs hang in gilt frames; the middle frame opens onto the wheat field
  SHOT.J = (t, out) => {
    const portal = E.fbo('portal');
    SHOT.K(0, portal);
    E.begin(out, [0.05, 0.04, 0.03]);
    const d = dur('J');
    const into = k01(t, d - 1.25, d, ease.in);
    const fh = 0.95, fw = fh * 16 / 9, fpos = [0, 0.08, 0.6];
    const dFill = (fh / 2) / Math.tan((20 * Math.PI) / 180);
    const f = float(t);
    const cam0 = [lerp(-0.25, 0.05, k01(t, 0, 1.6, ease.sine)) + f[0], 0.02 + f[1], D0 * 1.08];
    const camE = [fpos[0], fpos[1], fpos[2] + dFill];
    const cam = cam0.map((v, i) => lerp(v, camE[i], into));
    E.camera({ pos: cam, target: [lerp(0, fpos[0], into), lerp(0, fpos[1], into), lerp(-0.5, fpos[2], into)] });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.galleryWall, depthAmt: 0.7, margin: 1.2, bright: 0.85 });
    const hang = [
      { tex: T.shot_evo, x: -1.32, y: 0.2, s: 0.62, t0: 0.1 },
      { tex: T.shot_studycat, x: 1.32, y: 0.2, s: 0.62, t0: 0.33 },
      { tex: T.shot_mailtabs, x: -0.02, y: -0.62, s: 0.5, t0: 0.57 },
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

  // K — rushing over Van Gogh's wheat field
  SHOT.K = (t, out) => {
    E.begin(out, [0.9, 0.8, 0.5]);
    const k = t / dur('K');
    E.camera({ pos: [Math.sin(t * 3) * 0.04, lerp(-0.05, -0.2, k), lerp(D0 * 1.0, D0 * 0.42, ease.in(k))], target: [0, lerp(0.02, -0.12, k), -1] });
    E.painting(T.wheatfield, T.wheatfield_d, { crop: CROP.wheat, depthAmt: 0.8, margin: 1.25 });
  };

  // L — Aivazovsky's sunset; Adam's hand reaches into the sun, which blooms to white
  SHOT.L = (t, out) => {
    E.begin(out, [0.9, 0.6, 0.35]);
    const d = dur('L'), k = t / d, f = float(t);
    E.camera({ pos: [lerp(0, 0.3, ease.sine(k)) + f[0], lerp(0, -0.02, k) + f[1], lerp(D0, D0 * 0.74, ease.sine(k))], target: [lerp(0, 0.35, ease.sine(k)), -0.03, -1] });
    E.painting(T.sunrise, T.sunrise_d, { crop: CROP.sunrise, depthAmt: 0.6, margin: 1.2 });
    const sun = k01(t, 0.2, d - 0.4, ease.sine);
    glow([0.78, -0.07, 0.15], lerp(0.6, 2.6, sun), 0.55 * sun + 0.25, [1, 0.82, 0.55]);
    glow([0.78, -0.07, 0.16], 0.32, 0.6 + 0.4 * sun, [1, 0.97, 0.88]);
    // Adam's arm, cut from the fresco by its depth, reaches in from the left toward the sun
    const reach = k01(t, 0.1, d - 0.3, ease.out);
    const aw = 1.7, ah = aw * (0.16 * 1599) / (0.178 * 3524);
    E.draw({ tex: T.creation_adam, depth: T.creation_adam_d, uv: CROP.adamArm, size: [aw, ah], depthAmt: 0.12, mask: CROP.adamMask, pos: [lerp(-2.7, -0.55, reach), lerp(-0.5, -0.2, reach), 0.45], bright: 0.85, tint: [1, 0.86, 0.72] });
    dust(t, { n: 40, c: [0.4, 0, 0.5], op: 0.5, tint: [1, 0.8, 0.5], seed: 10 });
    const flash = k01(t, d - 0.45, d, ease.in);
    glow([0.7, -0.05, 0.4], lerp(0.5, 7, flash), flash, [1, 0.95, 0.85]);
  };

  // M — the Isle of the Dead; the camera glides into the dark between the cypresses
  SHOT.M = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const d = dur('M'), k = t / d, f = float(t);
    E.camera({ pos: [lerp(-0.1, 0.0, k) + f[0], lerp(0, 0.04, k) + f[1], lerp(D0 * 1.02, D0 * 0.4, ease.in(k))], target: [CROP.isleGap[0], CROP.isleGap[1], 0] });
    E.painting(T.isle, T.isle_d, { crop: CROP.isle, depthAmt: 0.6, margin: 1.2, bright: lerp(1, 0.12, k01(t, d - 0.9, d)) });
    dust(t, { n: 30, c: [0, 0, 0.5], op: 0.3, tint: [0.8, 0.85, 1], seed: 11, rise: 0.03 });
  };

  // N — a parchment on a table; "EvoSoft" in a flowing hand on "my darling Circe"
  SHOT.N = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const d = dur('N'), k = t / d;
    E.camera({ pos: [lerp(0.25, -0.05, ease.sine(k)), lerp(-0.12, 0.04, k), lerp(D0 * 0.95, D0 * 0.74, ease.out(k))], target: [0, 0, 0], roll: lerp(-3, 1, k) });
    E.draw({ tex: T.wood, size: [7, 7], pos: [0, 0, -0.05], bright: lerp(0.0, 0.85, k01(t, 0, 0.5)) });
    const pb = lerp(0.0, 1.0, k01(t, 0, 0.5));
    const prot = [0, 0, -3];
    E.draw({ tex: T.parchment, size: [3.1, 1.9], pos: [0, 0, 0], rot: prot, bright: 1.05 * pb, curl: 0.04 });
    calligraphy('N', ['EvoSoft'], { font: 'Pinyon', size: 240, color: '#2a160c', lineH: 1.3, pad: 0.3 }, { w: 2.4, pos: [0, 0.05, 0.01], rot: prot, curl: 0.04 }, k01(t, 0.3, 2.3, ease.lin) * 1.01, { opacity: pb });
    glow([0.4, 0.5, 0.3], 3.2, 0.2 * pb, [1, 0.78, 0.5]);
    dust(t, { n: 35, c: [0, 0, 0.5], box: [3, 2, 0.8], op: 0.45 * pb, tint: [1, 0.82, 0.55], seed: 12 });
  };

  // O — end card, in the song's last echo
  SHOT.O = (t, out) => {
    E.begin(out, [0.95, 0.88, 0.86]);
    E.camera({ pos: [0, 0, lerp(D0 * 1.02, D0 * 0.97, ease.out(t / 3.6))], target: [0, 0, 0] });
    E.draw({ tex: T.parchment, size: [4.4, 2.5], pos: [0, 0, -0.02], tint: [1.0, 0.9, 0.88], sat: 0.35, bright: 1.15 });
    const r = (a) => ease.out(k01(t, a, a + 0.9, ease.lin));
    E.draw({ tex: T.mark, size: [0.34, 0.34], pos: [0, 0.56 - (1 - r(0.15)) * 0.06, 0], opacity: r(0.15) });
    const nm = E.textTex('Oname', ['EvoSoft'], { font: '700|Cinzel', size: 200, color: '#1d1410', pad: 0.05, letter: 8 });
    E.draw({ tex: nm.tex, size: [0.38 * nm.aspect, 0.38], pos: [0, 0.14 - (1 - r(0.4)) * 0.06, 0], opacity: r(0.4) });
    const url = E.textTex('Ourl', ['evosoft.solutions'], { font: '600|Cormorant', size: 130, color: '#7a1d14', pad: 0.08 });
    E.draw({ tex: url.tex, size: [0.2 * url.aspect, 0.2], pos: [0, -0.22 - (1 - r(0.7)) * 0.05, 0], opacity: r(0.7) });
    const tag = E.textTex('Otag', ['Websites · Online stores · Business software — built to order'], { font: 'italic 500|Cormorant', size: 90, color: '#3a2a24', pad: 0.1 });
    E.draw({ tex: tag.tex, size: [0.12 * tag.aspect, 0.12], pos: [0, -0.46 - (1 - r(1.0)) * 0.05, 0], opacity: r(1.0) * 0.9 });
    const cta = E.textTex('Octa', ['GET A FREE QUOTE'], { font: '400|Cinzel', size: 90, color: '#7a1d14', pad: 0.3, letter: 10 });
    E.draw({ tex: cta.tex, size: [0.15 * cta.aspect, 0.15], pos: [0, -0.74, 0], opacity: r(1.35) });
  };

  // ---------- timeline ----------
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
  const IN = { A: 'cut', B: 'cut', C: ['fade', 0.2], D: ['fade', 0.3], E: ['fade', 0.25], F: 'cut', G: ['fade', 0.2], H: ['fade', 0.3], I: ['fade', 0.25], J: 'cut', K: 'cut', L: ['fade', 0.3], M: 'cut', N: 'cut', O: 'cut' };
  const BLUR = [[(S) => S.F[0] - 0.4, (S) => S.F[0] + 0.12, 7, 0.06], [(S) => S.K[0], (S) => S.K[1], 5, 0.05]];
  const HITS = [8.04, 12.3, 13.24, 15.55, 18.95, 23.18, 30.27];
  // how much glow and leak each shot gets
  const LOOK = { A: [0.22, 0.1], B: [0.8, 0.18], C: [0.55, 0.12], D: [0.45, 0.15], E: [0.9, 0.15], F: [0.22, 0.14], G: [0.35, 0.12], H: [0.3, 0.12], I: [1.0, 0.22], J: [0.5, 0.15], K: [0.4, 0.2], L: [0.8, 0.25], M: [0.7, 0.1], N: [0.28, 0.16], O: [0.1, 0.05] };

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
    if (t < SC.B[0] + 0.25 && t > SC.A[1] - 0.3) { fade = [0.98, 0.92, 0.82]; fadeAmt = t < SC.B[0] ? f(SC.A[1] - 0.3, SC.A[1]) : 1 - f(SC.B[0], SC.B[0] + 0.25); }
    if (t > SC.J[0] - 0.15 && t < SC.J[0] + 0.3) { fade = [1, 0.95, 0.85]; fadeAmt = t < SC.J[0] ? f(SC.J[0] - 0.15, SC.J[0]) : 1 - f(SC.J[0], SC.J[0] + 0.3); }
    if (t > SC.M[0] - 0.12 && t < SC.M[0] + 0.35) { fade = [1, 0.96, 0.9]; fadeAmt = t < SC.M[0] ? f(SC.M[0] - 0.12, SC.M[0]) : 1 - f(SC.M[0], SC.M[0] + 0.35); }
    if (t > SC.M[1] - 0.3 && t < SC.N[0] + 0.45) { fade = [0, 0, 0]; fadeAmt = t < SC.N[0] ? f(SC.M[1] - 0.3, SC.M[1]) : 1 - f(SC.N[0], SC.N[0] + 0.45); }
    if (t > SC.O[0] - 0.25 && t < SC.O[0] + 0.5) { fade = [0.95, 0.72, 0.76]; fadeAmt = t < SC.O[0] ? f(SC.O[0] - 0.25, SC.O[0]) : 1 - f(SC.O[0], SC.O[0] + 0.5); }
    if (t > TL.duration - 0.8) { fade = [0, 0, 0]; fadeAmt = f(TL.duration - 0.8, TL.duration - 0.05); }
    if (t < 0.3) { fade = [0, 0, 0]; fadeAmt = 1 - f(0, 0.3); }
    let flash = 0;
    for (const h of HITS) if (t >= h) flash = Math.max(flash, 0.14 * Math.exp(-(t - h) / 0.2));
    const look = LOOK[res.id] || [0.6, 0.15];
    E.finish(res.other ? B : A, res.other ? A : null, { mixAB: 1 - res.mix, seed: Math.floor(t * 30) * 0.618, fade, fadeAmt, warm: 0.38, vig: 0.72, grain: 0.055, contrast: 1.1, lift: 0.025, bloomAmt: look[0], bloomTh: 0.8, leak: look[1], time: t, flash });
  };
})();
