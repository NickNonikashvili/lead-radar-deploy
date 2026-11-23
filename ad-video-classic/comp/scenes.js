// The EvoSoft classical-art ad: 13 shots in the style of a painted lyric film. Each shot draws its 3D scene into a
// framebuffer at a local time; renderFrame() picks the shot(s) for time t, blends transitions and adds the film finish.
(() => {
  'use strict';
  const { track, ease, textures: T, clamp, lerp, D0 } = E;
  let TL, WD, SC;
  // what each shot frames at its start camera: [u0, v0, u1, v1] of the painting (16:9, or 1.74 for framed pictures)
  const CROP = {
    hands: [0.219, 0.25, 0.539, 0.647],          // must match prep.py CROP_HANDS
    flowers: [0.05, 0.2, 0.95, 0.56],
    eye: [0.295, 0.3125, 0.535, 0.4275],
    wanderer: [0, 0.22, 1, 0.6585],
    night: [0, 0.19, 1, 0.937],                  // framed (1.74)
    cards: [0, 0.04, 1, 0.812],
    cardsMask: [0.055, 0.085],                   // depth band that separates the three players (>=0.09) from the wall (<=0.04)
    feast: [0, 0.006, 1, 0.994],
    gallery: [0, 0.09, 1, 0.9045],
    sunrise: [0, 0.1, 1, 0.884],
    wheat: [0, 0.22, 1, 0.9],
    isle: [0, 0.1, 1, 0.889],
    isleGap: [0.07, -0.2],
  };
  // a spoken word's time in the video: line, word prefix (lowercase), nth occurrence
  function word(line, w, nth = 1) {
    let n = 0;
    for (const x of WD[line].words) {
      if (x.w.toLowerCase().replace(/[^a-z]/g, '').startsWith(w) && ++n === nth) return TL.vo[line] + x.s;
    }
    throw new Error(`no word ${w} in ${line}`);
  }
  const k01 = (t, a, b, e = ease.io) => e((t - a) / Math.max(1e-6, b - a));

  const PAINT = ['creation_adam', 'flowers', 'pearl', 'wanderer', 'night', 'cards', 'pirosmani_feast', 'gallery', 'wheatfield', 'isle', 'sunrise'];
  window.ready = (async () => {
    TL = await (await fetch('../timeline.json', { cache: 'no-store' })).json();
    WD = await (await fetch('../vo/words.json', { cache: 'no-store' })).json();
    SC = TL.scenes;
    window.DURATION = TL.duration;
    await Promise.all(['300px Anton', '200px Pinyon', '120px Fell', 'italic 120px Fell', '700 100px Cinzel', '400 100px Cinzel', '600 80px Cormorant', 'italic 500 80px Cormorant'].map((f) => document.fonts.load(f, 'AaBb')));
    await document.fonts.ready;
    const jobs = [];
    const safe = (key, url, o) => E.loadTex(key, url, o).catch(() => { console.warn('missing ' + url); T[key] = T.grey; window.MISSING = (window.MISSING || []).concat(key); });
    for (const k of PAINT) { jobs.push(safe(k, `../art/${k}.jpg`)); jobs.push(safe(k + '_d', `../art/${k}.depth.png`, { mip: false })); }
    for (const k of ['parchment_p', 'wood', 'stars']) jobs.push(safe(k, `../art/${k}.jpg`));
    for (const k of ['lines', 'glow', 'giltframe']) jobs.push(E.loadTex(k, `../art/${k}.png`));
    jobs.push(E.loadTex('lines_reveal', '../art/lines_reveal.png', { mip: false }));
    for (const k of ['evo', 'mailtabs', 'studycat']) jobs.push(E.loadTex('shot_' + k, `../shots/${k}.jpg`));
    jobs.push(E.loadSvgTex('mark', '../art/mark.svg', 1024));
    await Promise.all(jobs);
    E.gradTex('vband', 'vband'); E.gradTex('hfade', 'hfade'); E.gradTex('radial', 'radial');
    T.parchment = T.parchment2 = T.parchment_p;
  })();

  // ---------- helpers ----------
  const view = (d) => 2 * d * Math.tan((20 * Math.PI) / 180);        // visible height at distance d (fov 40)
  function glow(pos, size, opacity, tint = [1, 0.92, 0.8]) {
    if (opacity <= 0.001) return;
    E.draw({ tex: T.glow, size: [size, size], pos, opacity, tint, add: true, depthWrite: false });
  }
  // a plane that always covers the screen at distance d in front of the camera (camera looking down -z)
  function screenPlane(campos, d, o) {
    const h = view(d) * 1.02, w = h * 16 / 9;
    E.draw({ size: [w, h], pos: [campos[0], campos[1], campos[2] - d], depthWrite: false, noDepthTest: true, ...o });
  }
  // gilt frame around a content plane: content [w, h] at pos/rot; the frame art's opening is 1880x1080 of 2400x1600
  function framed(content, { pos, rot = [0, 0, 0], w, h, opacity = 1, uv, bright = 1, frameBright = 1 }) {
    E.draw({ tex: content, size: [w, h], pos, rot, opacity, uv, bright });
    E.draw({ tex: T.giltframe, size: [w * 2400 / 1880, h * 1600 / 1080], pos: E.offsetAlong(pos, rot, 0.004), rot, opacity, bright: frameBright, alphaCut: 0.5 });
  }
  function calligraphy(key, lines, opts, place, revealT, extra = {}) {
    const tt = E.textTex(key, lines, { reveal: true, ...opts });
    const w = place.w, h = w / tt.aspect;
    E.draw({ tex: tt.tex, reveal: tt.reveal, revealT, size: [w, h], pos: place.pos, rot: place.rot || [0, 0, 0], depthWrite: false, curl: place.curl || 0, ...extra });
  }

  // ---------- shots (t is local time in the shot, out the framebuffer) ----------
  const SHOT = {};

  // A — a pencil line becomes Michelangelo's hands, the camera slips into the gap between the fingers
  SHOT.A = (t, out) => {
    E.begin(out, [0.93, 0.91, 0.87]);
    const push = k01(t, 2.7, 4.5, ease.in);
    const cz = lerp(D0, D0 * 0.32, push), cx = lerp(0, 0.015, push), cy = lerp(0, -0.005, push);
    E.camera({ pos: [cx + Math.sin(t * 0.6) * 0.01, cy, cz], target: [cx, cy, 0], roll: lerp(0, 2.5, push) });
    // paper
    // the paper sits well behind the painting (so the painting's relief never sinks behind it) and goes once the paint is in
    if (t < 3.0) E.draw({ tex: T.parchment2, size: [4.4 * 1.2, 2.5 * 1.2], pos: [0, 0, -0.5], sat: 0.12, bright: 1.32 });
    // the painting comes in under the drawing, then takes on depth
    const paint = k01(t, 1.85, 2.9, ease.sine);
    if (paint > 0) E.painting(T.creation_adam, T.creation_adam_d, { crop: CROP.hands, margin: 1.15, depthAmt: lerp(0, 0.28, k01(t, 2.8, 3.8)), opacity: paint });
    // pencil lines drawn outward from the gap
    const lineO = 1 - k01(t, 2.6, 3.3);
    if (lineO > 0) E.draw({ tex: T.lines, reveal: T.lines_reveal, revealT: k01(t, 0.25, 2.1, ease.out) * 1.02, size: [16 / 9 * 2, 2], pos: [0, 0, 0.003], opacity: lineO * 0.95, depthWrite: false });
    // the spark where the fingers almost touch
    const sp = k01(t, 3.85, 4.35, ease.in);
    glow([0.005, -0.004, 0.05], lerp(0.05, 1.8, sp), clamp(sp * 1.6, 0, 1), [1, 0.9, 0.72]);
  };

  // B — a flower still life blooms out of the dark
  SHOT.B = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const k = t / 1.5;
    E.camera({ pos: [lerp(-0.3, 0.22, ease.sine(k)), lerp(0.05, -0.04, k), lerp(D0 * 0.98, D0 * 0.74, ease.out(k))], target: [0, 0, -0.15] });
    E.painting(T.flowers, T.flowers_d, { crop: CROP.flowers, depthAmt: 0.75, bright: lerp(0.0, 1.05, k01(t, 0, 0.6, ease.out)), margin: 1.25 });
  };

  // C — an eye through a slit of light
  SHOT.C = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const cam = [lerp(0.02, -0.02, t / 1.5), 0, lerp(D0 * 0.92, D0 * 0.82, t / 1.5)];
    E.camera({ pos: cam, target: [cam[0], 0, 0] });
    E.painting(T.pearl, T.pearl_d, { crop: CROP.eye, depthAmt: 0.25, margin: 1.15, bright: 1.08 });
    const half = lerp(0.0, 0.17, k01(t, 0.05, 0.6, ease.out));
    const d = 1.1, vh = view(d), cz = cam[2] - d;
    E.draw({ tex: T.white, color: [0, 0, 0], size: [vh * 2.2, vh], pos: [cam[0], half + vh / 2, cz], noDepthTest: true, depthWrite: false });
    E.draw({ tex: T.white, color: [0, 0, 0], size: [vh * 2.2, vh], pos: [cam[0], -half - vh / 2, cz], noDepthTest: true, depthWrite: false });
    // warm light spilling from the slit's edges
    for (const s of [1, -1]) E.draw({ tex: T.vband, size: [vh * 2.2, 0.05], pos: [cam[0], s * half, cz + 0.001], tint: [1, 0.72, 0.45], opacity: 0.35 * clamp(half / 0.17, 0, 1), add: true, noDepthTest: true });
  };

  // D — the wanderer above the sea of fog; WEBSITE rises out of the fog behind him
  SHOT.D = (t, out) => {
    E.begin(out, [0.8, 0.82, 0.84]);
    const k = t / 3;
    // the painting is portrait, so there is no spare width: a gentle sweep that never shows its edges
    E.camera({ pos: [lerp(-0.12, 0.24, ease.sine(k)), lerp(0.02, 0.06, k), lerp(D0 * 0.9, D0 * 0.78, ease.out(k))], target: [lerp(-0.12, 0.24, ease.sine(k)) * 0.4, 0.04, -0.2] });
    E.painting(T.wanderer, T.wanderer_d, { crop: CROP.wanderer, depthAmt: 0.9, margin: 1.2 });
    const w0 = word('L2', 'website') - SC.D[0] - 0.12;
    E.text3d(t, {
      str: 'WEBSITE', font: 'Anton', sizePx: 300, color: '#e9a33c', height: 0.62, depth: 0.16, layers: 20, letter: 34,
      pos: [0, 0.5, -0.35], side: [0.55, 0.27, 0.07],
      perLetter: (i, n) => { const q = ease.back((t - w0 - i * 0.06) / 0.8); return { dy: (1 - q) * -1.25, rx: (1 - q) * 40, o: t > w0 + i * 0.06 ? 1 : 0 }; },
    });
    // fog in front of the letters' feet
    E.draw({ tex: T.vband, size: [6, 0.7], pos: [0, -0.05, -0.3], tint: [0.86, 0.88, 0.9], opacity: 0.9, depthWrite: false });
  };

  // E — inside Grimshaw's moonlit lane (lit windows: a store that never sleeps), then out: it is a painting in a gilt frame on a green wall; a whip pan away
  SHOT.E = (t, out) => {
    E.begin(out, [0.05, 0.1, 0.08]);
    const pw = 3.48, ph = 2;                                          // the framed picture (opening aspect 1.74)
    const inside = k01(t, 0, 1.9, ease.sine);
    const pull = k01(t, 1.85, 2.75, ease.io);
    const whip = k01(t, 2.6, 3.0, ease.in);
    const cz = lerp(lerp(D0 * 0.5, D0 * 0.44, inside), D0 * 2.05, pull);
    const cx = lerp(lerp(-0.85, 0.62, inside), 0, pull) - whip * 4.5;
    const cy = lerp(lerp(-0.08, -0.16, inside), 0, pull);
    E.camera({ pos: [cx, cy, cz], target: [cx + whip * 0.8, cy, 0] });
    // wall
    E.draw({ tex: T.parchment, size: [40, 24], pos: [0, 0, -0.6], tint: [0.22, 0.42, 0.3], sat: 0.6, bright: 0.55 });   // wall, well behind the relief
    const rot = [0, lerp(0, 18, k01(t, 2.3, 3.0)), 0];
    E.painting(T.night, T.night_d, { crop: CROP.night, margin: 1.0, depthAmt: lerp(0.16, 0.05, pull), rot });
    E.draw({ tex: T.giltframe, size: [pw * 2400 / 1880, ph * 1600 / 1080], pos: [0, 0, 0.04], rot, alphaCut: 0.5 });
  };

  // F — the red room: SOFTWARE in giant letters behind Caravaggio's card players, app screens tumbling;
  //     then it is a framed picture lying on a wooden table
  SHOT.Fpop = (t, out) => {
    E.begin(out, [0.55, 0.04, 0.05]);
    E.camera({ pos: [lerp(0.08, -0.08, t / 3), 0, lerp(D0, D0 * 0.9, ease.out(t / 3))], target: [0, 0, -0.3] });
    E.draw({ tex: T.parchment, size: [9, 5.2], pos: [0, 0, -1.6], tint: [1.0, 0.16, 0.13], sat: 0.5, bright: 0.85 });
    const s0 = word('L4', 'software') - SC.F[0] - 0.08;
    E.text3d(t, {
      str: 'SOFTWARE', font: 'Anton', sizePx: 300, color: '#f4efe6', height: 0.9, depth: 0.2, layers: 22, pos: [0, 0.5, -0.75], side: [0.62, 0.58, 0.52],
      perLetter: (i, n) => { const q = ease.back((t - s0 - i * 0.04) / 0.5); return { dy: (1 - q) * 1.4, dz: (1 - q) * 0.6, rz: (1 - q) * (i % 2 ? 12 : -12), o: t > s0 + i * 0.04 ? 1 : 0 }; },
    });
    // tumbling app screens, some behind the men, some in front
    const shots = [T.shot_evo, T.shot_mailtabs, T.shot_studycat];
    for (let i = 0; i < 9; i++) {
      const h1 = E.hash(i + 1), h2 = E.hash(i + 11), h3 = E.hash(i + 21);
      const t0 = 0.25 + i * 0.17;
      if (t < t0) continue;
      const k = (t - t0) / 2.4;
      const z = i % 3 === 0 ? 0.35 : -0.45 - h3 * 0.3;
      const pos = [lerp(-1.9, 1.9, h1), lerp(1.4, -1.6, k) + h2 * 0.3, z];
      const rot = [lerp(-30, 40, h2) + k * 160 * (h1 - 0.5), lerp(-40, 40, h3) + k * 120, (h1 - 0.5) * 60 + k * 80];
      E.draw({ tex: T.white, size: [0.56, 0.37], pos: E.offsetAlong(pos, rot, -0.002), rot, tint: [0.95, 0.95, 0.95] });
      E.draw({ tex: shots[i % 3], size: [0.52, 0.325], pos, rot });
    }
    E.painting(T.cards, T.cards_d, { crop: CROP.cards, depthAmt: 0.35, mask: CROP.cardsMask, margin: 1.1, pos: [0, -0.62] });
  };
  SHOT.F = (t, out) => {
    const pop = E.fbo('pop');
    SHOT.Fpop(t, pop);
    E.begin(out, [0.03, 0.02, 0.015]);
    const back = k01(t, 2.2, 3.0, ease.io);
    const tilt = lerp(0, -52, back);
    E.camera({ pos: [lerp(0, 0.25, back), lerp(0, -0.35, back), lerp(D0, D0 * 2.6, back)], target: [0, 0, 0], roll: lerp(0, -6, back) });
    const rot = [tilt, 0, lerp(0, 8, back)];
    E.draw({ tex: T.wood, size: [14, 10], pos: E.offsetAlong([0, 0, 0], rot, -0.03), rot, bright: 0.9 });
    framed(pop.tex, { pos: [0, 0, 0], rot, w: 16 / 9 * 2, h: 2, uv: [0, 1, 1, 0] });
  };

  // G — Pirosmani's feast; a parchment flies in and writes "Built to order, by hand, in Georgia"
  SHOT.G = (t, out) => {
    E.begin(out, [0.05, 0.04, 0.03]);
    const k = t / 3.75;
    E.camera({ pos: [lerp(-0.15, 0.35, ease.sine(k)), lerp(0.02, -0.02, k), lerp(D0, D0 * 0.74, ease.io(k))], target: [lerp(0, 0.35, ease.io(k)), 0, 0] });
    E.painting(T.pirosmani_feast, T.pirosmani_feast_d, { crop: CROP.feast, depthAmt: 0.5, margin: 1.15 });
    const fly = ease.out(k01(t, 0.05, 0.8, ease.lin));
    const sway = Math.sin(t * 1.3) * 1.2;
    const ppos = [lerp(3.2, 0.62, fly), lerp(1.9, 0.02, fly), lerp(1.4, 0.55, fly)];
    const prot = [lerp(25, -6, fly) + sway * 0.4, lerp(-70, -14, fly) + sway, lerp(50, 4, fly)];
    E.draw({ tex: T.parchment, size: [1.55, 1.05], pos: ppos, rot: prot, curl: 0.05, bright: 1.08, uv: [0.04, 0.12, 0.96, 0.75] });
    const a0 = word('L5', 'build') - SC.G[0] - 0.12, a1 = word('L5', 'order') - SC.G[0] + 0.4;
    const b0 = word('L5', 'by') - SC.G[0] - 0.05, b1 = word('L5', 'georgia') - SC.G[0] + 0.55;
    const rv = t < b0 ? 0.5 * k01(t, a0, a1, ease.lin) : 0.5 + 0.5 * k01(t, b0, b1, ease.lin);
    calligraphy('G', ['Built to order,', 'by hand, in Georgia'], { font: 'italic|Fell', size: 150, color: '#6c1212', lineH: 1.2 },
      { w: 1.25, pos: E.offsetAlong(ppos, prot, 0.006), rot: prot, curl: 0.05 }, rv * 1.01);
  };

  // H — a picture gallery: EvoSoft's software hangs in gilt frames; the middle frame holds the whole world
  SHOT.H = (t, out) => {
    const portal = E.fbo('portal');
    SHOT.I(0, portal);
    E.begin(out, [0.05, 0.04, 0.03]);
    const into = k01(t, 1.55, 3.0, ease.in);
    const fh = 0.95, fw = fh * 16 / 9, fpos = [0, 0.08, 0.6];          // the centre frame (content exactly 16:9)
    const dFill = (fh / 2) / Math.tan((20 * Math.PI) / 180);
    const cam0 = [lerp(-0.25, 0.05, k01(t, 0, 1.6, ease.sine)), 0.02, D0 * 1.08];
    const camE = [fpos[0], fpos[1], fpos[2] + dFill];
    const cam = cam0.map((v, i) => lerp(v, camE[i], into));
    E.camera({ pos: cam, target: [lerp(0, fpos[0], into), lerp(0, fpos[1], into), lerp(-0.5, fpos[2], into)] });
    E.painting(T.gallery, T.gallery_d, { crop: CROP.gallery, depthAmt: 0.7, margin: 1.2 });
    const hang = [
      { tex: T.shot_evo, x: -1.32, y: 0.2, s: 0.62, t0: word('L6', 'hang') - SC.H[0] - 0.15 },
      { tex: T.shot_studycat, x: 1.32, y: 0.2, s: 0.62, t0: word('L6', 'hang') - SC.H[0] + 0.1 },
      { tex: T.shot_mailtabs, x: -0.02, y: -0.62, s: 0.5, t0: word('L6', 'where') - SC.H[0] - 0.05 },
    ];
    for (const f of hang) {
      const q = ease.back(k01(t, f.t0, f.t0 + 0.55, ease.lin));
      if (q <= 0) continue;
      const pos = [lerp(f.x * 2.4, f.x, q), lerp(f.y + 1.6, f.y, q), lerp(1.5, 0.45, q)];
      const rot = [lerp(-40, 0, q), lerp(f.x * 30, 0, q), lerp(f.x * 20, 0, q)];
      framed(f.tex, { pos, rot, w: f.s * 1.74, h: f.s, uv: [0, 0.03, 1, 0.97] });
    }
    // the world, framed, appears on "world"
    const wq = ease.back(k01(t, word('L6', 'world') - SC.H[0] - 0.45, word('L6', 'world') - SC.H[0] + 0.15, ease.lin));
    if (wq > 0) {
      const pos = [fpos[0], lerp(fpos[1] + 1.4, fpos[1], wq), lerp(1.4, fpos[2], wq)];
      E.draw({ tex: portal.tex, uv: [0, 1, 1, 0], size: [fw, fh], pos });
      E.draw({ tex: T.giltframe, size: [fw * 2400 / 1880, fh * 1600 / 1080], pos: [pos[0], pos[1], pos[2] + 0.004], alphaCut: 0.5 });
    }
  };

  // I — through the frame into the world: Aivazovsky's sea at sunset; the sun blooms until it whites out
  SHOT.I = (t, out) => {
    E.begin(out, [0.9, 0.6, 0.35]);
    const k = t / 3;
    E.camera({ pos: [lerp(0, 0.35, ease.sine(k)), lerp(0, -0.02, k), lerp(D0, D0 * 0.7, ease.sine(k))], target: [lerp(0, 0.4, ease.sine(k)), -0.03, -1] });
    E.painting(T.sunrise, T.sunrise_d, { crop: CROP.sunrise, depthAmt: 0.6, margin: 1.2 });
    const sun = k01(t, 0.3, 2.4, ease.sine);
    glow([0.78, -0.07, 0.15], lerp(0.5, 2.4, sun), 0.55 * sun + 0.25, [1, 0.85, 0.6]);
    glow([0.78, -0.07, 0.16], 0.3, 0.6 + 0.4 * sun, [1, 0.97, 0.88]);
    const flash = k01(t, 2.55, 3.0, ease.in);
    glow([0.7, -0.05, 0.4], lerp(0.5, 7, flash), flash, [1, 0.95, 0.85]);
  };

  // J — rushing over Van Gogh's wheat field
  SHOT.J = (t, out) => {
    E.begin(out, [0.9, 0.8, 0.5]);
    const k = t / 1.5;
    E.camera({ pos: [Math.sin(t * 3) * 0.04, lerp(-0.05, -0.2, k), lerp(D0 * 1.0, D0 * 0.42, ease.in(k))], target: [0, lerp(0.02, -0.12, k), -1] });
    E.painting(T.wheatfield, T.wheatfield_d, { crop: CROP.wheat, depthAmt: 0.8, margin: 1.25 });
  };

  // K — the Isle of the Dead in still water; the camera glides into the dark between the cypresses
  SHOT.K = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const k = t / 1.5;
    E.camera({ pos: [lerp(-0.1, 0.0, k), lerp(0, 0.04, k), lerp(D0 * 1.0, D0 * 0.42, ease.in(k))], target: [CROP.isleGap[0], CROP.isleGap[1], 0] });
    E.painting(T.isle, T.isle_d, { crop: CROP.isle, depthAmt: 0.6, margin: 1.2, bright: lerp(1, 0.15, k01(t, 0.8, 1.5)) });
  };

  // L — a parchment on a table; "EvoSoft" in a flowing hand, then "Your idea, made into a masterpiece."
  SHOT.L = (t, out) => {
    E.begin(out, [0, 0, 0]);
    const k = t / 5.25;
    E.camera({ pos: [lerp(0.25, -0.05, ease.sine(k)), lerp(-0.12, 0.04, k), lerp(D0 * 0.95, D0 * 0.78, ease.out(k)) + k01(t, 4.6, 5.25, ease.in) * -1.2], target: [0, 0, 0], roll: lerp(-3, 1, k) });
    E.draw({ tex: T.wood, size: [7, 7], pos: [0, 0, -0.05], bright: lerp(0.0, 0.85, k01(t, 0, 0.6)) });
    const pbright = lerp(0.0, 1.0, k01(t, 0, 0.6));
    const prot = [0, 0, -3];
    E.draw({ tex: T.parchment2, size: [3.1, 1.9], pos: [0, 0, 0], rot: prot, bright: 1.05 * pbright, curl: 0.04 });
    const e0 = word('L7', 'evo') - SC.L[0] - 0.1, e1 = word('L7', 'soft') - SC.L[0] + 0.55;
    calligraphy('L1', ['EvoSoft'], { font: 'Pinyon', size: 240, color: '#2a160c', lineH: 1.3, pad: 0.3 }, { w: 2.2, pos: [0, 0.2, 0.01], rot: prot, curl: 0.04 }, k01(t, e0, e1, ease.lin) * 1.01, { opacity: pbright });
    const y0 = word('L7', 'your') - SC.L[0] - 0.05, y1 = word('L7', 'masterpiece') - SC.L[0] + 0.75;
    calligraphy('L2', ['Your idea, made into a masterpiece.'], { font: 'italic|Fell', size: 110, color: '#5b1a12', pad: 0.2 }, { w: 2.2, pos: [0, -0.48, 0.01], rot: prot, curl: 0.04 }, k01(t, y0, y1, ease.lin) * 1.01, { opacity: pbright });
    glow([0.4, 0.5, 0.3], 3.2, 0.18 * pbright, [1, 0.8, 0.55]);
  };

  // M — end card
  SHOT.M = (t, out) => {
    E.begin(out, [0.95, 0.88, 0.86]);
    E.camera({ pos: [0, 0, lerp(D0 * 1.02, D0 * 0.97, ease.out(t / 4.5))], target: [0, 0, 0] });
    E.draw({ tex: T.parchment2, size: [4.4, 2.5], pos: [0, 0, -0.02], tint: [1.0, 0.9, 0.88], sat: 0.35, bright: 1.2 });
    const rise = (a) => ({ k: ease.out(k01(t, a, a + 0.9, ease.lin)) });
    const r1 = rise(0.15), r2 = rise(0.45), r3 = rise(0.8), r4 = rise(1.15);
    E.draw({ tex: T.mark, size: [0.34, 0.34], pos: [0, 0.56 - (1 - r1.k) * 0.06, 0], opacity: r1.k });
    const nm = E.textTex('Mname', ['EvoSoft'], { font: '700|Cinzel', size: 200, color: '#1d1410', pad: 0.05, letter: 8 });
    E.draw({ tex: nm.tex, size: [0.38 * nm.aspect, 0.38], pos: [0, 0.14 - (1 - r2.k) * 0.06, 0], opacity: r2.k });
    const url = E.textTex('Murl', ['evosoft.solutions'], { font: '600|Cormorant', size: 130, color: '#7a1d14', pad: 0.08 });
    E.draw({ tex: url.tex, size: [0.2 * url.aspect, 0.2], pos: [0, -0.22 - (1 - r3.k) * 0.05, 0], opacity: r3.k });
    const tag = E.textTex('Mtag', ['Websites · Online stores · Business software — built to order'], { font: 'italic 500|Cormorant', size: 90, color: '#3a2a24', pad: 0.1 });
    E.draw({ tex: tag.tex, size: [0.12 * tag.aspect, 0.12], pos: [0, -0.46 - (1 - r4.k) * 0.05, 0], opacity: r4.k * 0.9 });
    const cta = E.textTex('Mcta', ['GET A FREE QUOTE'], { font: '400|Cinzel', size: 90, color: '#7a1d14', pad: 0.3, letter: 10 });
    const r5 = ease.out(k01(t, 1.5, 2.3, ease.lin));
    E.draw({ tex: cta.tex, size: [0.15 * cta.aspect, 0.15], pos: [0, -0.74, 0], opacity: r5 });
  };

  // ---------- timeline and transitions ----------
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  // how each shot starts: 'cut', ['fade', seconds] (crossfade with the previous shot)
  const IN = { A: 'cut', B: 'cut', C: ['fade', 0.25], D: ['fade', 0.35], E: ['fade', 0.4], F: 'cut', G: ['fade', 0.45], H: ['fade', 0.4], I: 'cut', J: ['fade', 0.3], K: ['fade', 0.35], L: 'cut', M: 'cut' };
  // moments that get motion blur: [from, to, samples, shutter]
  const BLUR = [[SC_ => SC_.F[0] - 0.4, SC_ => SC_.F[0] + 0.12, 7, 0.06], [SC_ => SC_.J[0], SC_ => SC_.J[1], 5, 0.05]];

  function shotAt(t) {
    for (let i = ORDER.length - 1; i >= 0; i--) if (t >= SC[ORDER[i]][0]) return i;
    return 0;
  }
  function drawShot(i, t, fb) { const id = ORDER[i]; SHOT[id](t - SC[id][0], fb); }

  function composite(t, a, b) {
    const i = shotAt(t), id = ORDER[i];
    drawShot(i, t, a);
    const tin = IN[id];
    if (Array.isArray(tin) && i > 0 && t - SC[id][0] < tin[1]) {
      drawShot(i - 1, t, b);
      return { mix: 1 - ease.io((t - SC[id][0]) / tin[1]), other: true };
    }
    return { mix: 0, other: false };
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
        const ts = t + (s / (n - 1) - 0.5) * sh;
        res = composite(ts, A, B);
        E.blit(A, acc, 1 / n, s === 0);
        if (res.other) E.blit(B, accB, 1 / n, s === 0);
      }
      E.blit(acc, A, 1, true); if (res.other) E.blit(accB, B, 1, true);
    } else {
      res = composite(t, A, B);
    }
    // flashes: cream after the spark (A), white from the sun (I->J), dark at the isle, pink before the end card
    let fade = [0, 0, 0], fadeAmt = 0;
    const f = (a, b) => clamp((t - a) / (b - a), 0, 1);
    if (t < SC.B[0] + 0.25 && t > SC.A[1] - 0.3) { fade = [0.98, 0.93, 0.84]; fadeAmt = t < SC.B[0] ? f(SC.A[1] - 0.3, SC.A[1]) : 1 - f(SC.B[0], SC.B[0] + 0.25); }
    if (t > SC.J[0] - 0.12 && t < SC.J[0] + 0.3) { fade = [1, 0.97, 0.9]; fadeAmt = t < SC.J[0] ? f(SC.J[0] - 0.12, SC.J[0]) : 1 - f(SC.J[0], SC.J[0] + 0.3); }
    if (t > SC.K[1] - 0.35 && t < SC.L[0] + 0.5) { fade = [0, 0, 0]; fadeAmt = t < SC.L[0] ? f(SC.K[1] - 0.35, SC.K[1]) : 1 - f(SC.L[0], SC.L[0] + 0.5); }
    if (t > SC.M[0] - 0.3 && t < SC.M[0] + 0.45) { fade = [0.95, 0.74, 0.77]; fadeAmt = t < SC.M[0] ? f(SC.M[0] - 0.3, SC.M[0]) : 1 - f(SC.M[0], SC.M[0] + 0.45); }
    if (t > TL.duration - 0.6) { fade = [0, 0, 0]; fadeAmt = f(TL.duration - 0.6, TL.duration - 0.05); }
    if (t < 0.25) { fade = [0, 0, 0]; fadeAmt = 1 - f(0, 0.25); }
    E.finish(res.other ? B : A, res.other ? A : null, { mixAB: 1 - res.mix, seed: Math.floor(t * 30) * 0.618, fade, fadeAmt, warm: 0.3, vig: 0.62, grain: 0.05 });
  };
  window.CROP = CROP;
})();
