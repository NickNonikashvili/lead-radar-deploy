// Procedural, hand-tuned landscape illustrations of Georgia.
// Every scene is generated from seeded noise at build time, so the artwork is entirely
// original to this site (no third-party image rights involved) and weighs only a few KB.
//
//   scene("svaneti")                    → one <svg>, groups tagged with data-depth for parallax
//   scene("hero", { layered: true })    → stacked <svg> layers the hero animation moves separately

let uid = 0;
const r1 = (n) => Math.round(n * 10) / 10;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── geometry ────────────────────────────────────────────────────────────────
function ridge(rand, W, { base, amp = 60, rough = 0.55, detail = 7, peaks = [] }) {
  const n = 2 ** detail;
  const ys = new Float64Array(n + 1);
  ys[0] = (rand() - 0.5) * amp;
  ys[n] = (rand() - 0.5) * amp;
  for (let step = n, scale = amp; step > 1; step /= 2, scale *= rough) {
    const half = step / 2;
    for (let i = half; i < n; i += step) ys[i] = (ys[i - half] + ys[i + half]) / 2 + (rand() - 0.5) * scale;
  }
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    let y = base - ys[i];
    for (const p of peaks) {
      const d = Math.abs(x - p.x) / p.w;
      if (p.shape === "round") y -= p.h * Math.exp(-d * d * 2.4);
      else if (d < 1) y -= p.h * Math.pow(1 - d, p.pow || 1.45);
    }
    pts.push([x, y]);
  }
  return pts;
}

const yAt = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return pts[pts.length - 1][1];
};

function line(pts, smooth) {
  if (!smooth) return pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)},${r1(y)}`).join("");
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d;
}
const area = (pts, W, H, smooth) => `${line(pts, smooth)}L${W},${H}L0,${H}Z`;

// ── builder ─────────────────────────────────────────────────────────────────
function makeCtx(W, H, seed) {
  const id = `sc${++uid}`;
  let g = 0;
  const ctx = {
    W,
    H,
    id,
    rand: mulberry32(seed * 9973 + 17),
    defs: [],
    lin(stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, user } = {}) {
      const gid = `${id}g${++g}`;
      const units = user ? ` gradientUnits="userSpaceOnUse"` : "";
      ctx.defs.push(
        `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units}>${stops
          .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ""}/>`)
          .join("")}</linearGradient>`
      );
      return `url(#${gid})`;
    },
    rad(stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
      const gid = `${id}g${++g}`;
      ctx.defs.push(
        `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}">${stops
          .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
          .join("")}</radialGradient>`
      );
      return `url(#${gid})`;
    },
    clip(d) {
      const cid = `${id}c${++g}`;
      ctx.defs.push(`<clipPath id="${cid}"><path d="${d}"/></clipPath>`);
      return `url(#${cid})`;
    },
  };
  return ctx;
}

// ── painters ────────────────────────────────────────────────────────────────
function sky(ctx, stops) {
  return `<rect width="${ctx.W}" height="${ctx.H}" fill="${ctx.lin(stops)}"/>`;
}

function sun(ctx, { x, y, r, core = "#fff6df", glow = "#ffd27a", glowR = 9, glowA = 0.85 }) {
  const R = r * glowR;
  return `<circle cx="${x}" cy="${y}" r="${R}" fill="${ctx.rad([
    [0, glow, glowA],
    [0.25, glow, glowA * 0.45],
    [1, glow, 0],
  ])}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${core}"/>`;
}

function clouds(ctx, list, color = "#fff3dc") {
  const fill = ctx.rad([
    [0, color, 0.75],
    [0.6, color, 0.25],
    [1, color, 0],
  ]);
  return list.map(([x, y, rx, ry, o = 1]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${o}"/>`).join("");
}

function stars(ctx, count, maxY, color = "#fff7e6") {
  let s = "";
  for (let i = 0; i < count; i++) {
    const x = ctx.rand() * ctx.W, y = ctx.rand() * maxY, r = 0.4 + ctx.rand() ** 3 * 1.8;
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" opacity="${r1(0.3 + ctx.rand() * 0.7)}"/>`;
  }
  return `<g fill="${color}" class="stars">${s}</g>`;
}

function birds(ctx, list, color = "#3a2614") {
  return `<g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" class="birds">${list
    .map(([x, y, s]) => `<path d="M${x - 9 * s},${y - 3 * s}q${4.5 * s},${-4 * s} ${9 * s},${3 * s}q${4.5 * s},${-7 * s} ${9 * s},${-3 * s}"/>`)
    .join("")}</g>`;
}

function mist(ctx, y, h, color, a = 0.7) {
  const fill = ctx.lin([
    [0, color, 0],
    [0.55, color, a],
    [1, color, 0],
  ]);
  return `<rect x="0" y="${y - h / 2}" width="${ctx.W}" height="${h}" fill="${fill}"/>`;
}

function haze(ctx, top, color, a = 0.6) {
  const fill = ctx.lin([
    [0, color, 0],
    [1, color, a],
  ]);
  return `<rect x="0" y="${top}" width="${ctx.W}" height="${ctx.H - top}" fill="${fill}"/>`;
}

// A mountain range with optional snow caps, facet shading and a sunlit rim.
function range(ctx, pts, o) {
  const { W, H } = ctx;
  const minY = Math.min(...pts.map((p) => p[1]));
  const fill = Array.isArray(o.color)
    ? ctx.lin(
        [
          [0, o.color[0]],
          [1, o.color[1]],
        ],
        { user: true, y1: minY, y2: o.fadeTo ?? H }
      )
    : o.color;
  let s = `<path d="${area(pts, W, H, o.smooth)}" fill="${fill}"/>`;

  const facets = o.shade || o.snow?.shadow ? shadowFacets(ctx, pts, o.shade?.dir ?? 1, o.shade?.reach ?? 2.2) : "";
  if (o.shade) s += `<path d="${facets}" fill="${o.shade.color}" opacity="${o.shade.opacity ?? 0.35}"/>`;

  if (o.snow) {
    const { line: sl, color = "#fff4e2", jag = 26, shadow } = o.snow;
    const top = pts.map(([x, y]) => [x, y]);
    const bottom = pts.map(([x, y], i) => {
      const n = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.53 + 1) * 0.5 + (ctx.rand() - 0.5) * 1.4;
      return [x, Math.max(y, sl + n * jag)];
    });
    const d = `M${top.map((p) => `${r1(p[0])},${r1(p[1])}`).join("L")}L${bottom
      .reverse()
      .map((p) => `${r1(p[0])},${r1(p[1])}`)
      .join("L")}Z`;
    s += `<path d="${d}" fill="${color}"/>`;
    if (shadow) s += `<path d="${d}" fill="${shadow}" opacity=".55" clip-path="${ctx.clip(facets || "M0,0Z")}"/>`;
  }

  if (o.rim) s += `<path d="${line(pts, o.smooth)}" fill="none" stroke="${o.rim}" stroke-width="${o.rimW ?? 1.6}" opacity="${o.rimA ?? 0.7}"/>`;
  return s;
}

// Wedge-shaped facets on the side of each prominent summit that faces away from the light:
// summit → down the ridge to the next saddle → back under the summit along a jittered crease.
function shadowFacets(ctx, pts, dir, reach) {
  let d = "";
  const win = 5;
  for (let i = win; i < pts.length - win; i++) {
    const [x, y] = pts[i];
    let isTop = true;
    for (let k = i - win; k <= i + win; k++) if (k !== i && pts[k][1] <= y) isTop = false;
    if (!isTop) continue;
    let j = i;
    while (pts[j + dir] && pts[j + dir][1] >= pts[j][1] - 3 && Math.abs(j - i) < 60) j += dir;
    if (Math.abs(j - i) < 3) continue;
    const [vx, vy] = pts[j];
    const drop = vy - y;
    const bx = x + dir * Math.abs(vx - x) * 0.12;
    const by = y + drop * reach + 40;
    const seg = (dir > 0 ? pts.slice(i, j + 1) : pts.slice(j, i + 1).reverse()).map((p) => `${r1(p[0])},${r1(p[1])}`);
    const crease = [];
    for (let k = 5; k >= 1; k--) {
      const t = k / 6;
      crease.push(`${r1(x + (bx - x) * t + (ctx.rand() - 0.5) * 10)},${r1(y + (by - y) * t)}`);
    }
    d += `M${seg.join("L")}L${r1(bx)},${r1(by)}L${crease.join("L")}Z`;
  }
  return d;
}

// ── landmarks (silhouettes anchored at bottom-centre) ────────────────────────
function church(x, y, s, fill) {
  const P = (pts) => "M" + pts.map(([a, b]) => `${r1(x + a * s)},${r1(y + b * s)}`).join("L") + "Z";
  return `<g fill="${fill}"><path d="${P([[-34, 4], [-34, -20], [-26, -27], [26, -27], [34, -20], [34, 4]])}${P([[-8.5, -26], [-8.5, -46], [8.5, -46], [8.5, -26]])}${P([[-10.5, -45], [0, -61], [10.5, -45]])}${P([[-60, 4], [-60, -26], [-53, -34], [-46, -26], [-46, 4]])}"/><path d="M${x},${y - 61 * s}v${-7 * s}M${x - 3 * s},${y - 65 * s}h${6 * s}" stroke="${fill}" stroke-width="${1.6 * s}"/></g>`;
}

function tower(x, y, s, h = 1, wide = 1) {
  const H = 62 * s * h, k = s * wide;
  return `M${r1(x - 5.2 * k)},${r1(y + 4)}L${r1(x - 4.3 * k)},${r1(y - H)}L${r1(x - 5.6 * k)},${r1(y - H)}L${r1(x)},${r1(
    y - H - 7.5 * k
  )}L${r1(x + 5.6 * k)},${r1(y - H)}L${r1(x + 4.3 * k)},${r1(y - H)}L${r1(x + 5.2 * k)},${r1(y + 4)}Z`;
}

function house(x, y, s, w = 1) {
  const W = 16 * s * w, h = 9 * s;
  return `M${r1(x - W / 2)},${r1(y + 4)}V${r1(y - h)}L${r1(x)},${r1(y - h - 6 * s)}L${r1(x + W / 2)},${r1(y - h)}V${r1(y + 4)}Z`;
}

function village(ctx, pts, { from, to, towers = 5, houses = 8, s = 1, fill, lights }) {
  let d = "", win = "";
  for (let i = 0; i < houses; i++) {
    const x = from + ctx.rand() * (to - from);
    d += house(x, yAt(pts, x) + 6, s * (0.8 + ctx.rand() * 0.5), 0.8 + ctx.rand() * 0.8);
    if (lights && ctx.rand() > 0.4) win += `<rect x="${r1(x - 1.5 * s)}" y="${r1(yAt(pts, x) - 3 * s)}" width="${r1(3 * s)}" height="${r1(3 * s)}"/>`;
  }
  for (let i = 0; i < towers; i++) {
    const x = from + ((i + 0.5) / towers) * (to - from) + (ctx.rand() - 0.5) * 20;
    const ty = yAt(pts, x) + 4;
    d += tower(x, ty, s * (0.85 + ctx.rand() * 0.3), 0.85 + ctx.rand() * 0.35);
    if (lights && ctx.rand() > 0.5) win += `<rect x="${r1(x - 1 * s)}" y="${r1(ty - 52 * s)}" width="${r1(2 * s)}" height="${r1(3.5 * s)}"/>`;
  }
  return `<path d="${d}" fill="${fill}"/>${lights ? `<g fill="${lights}" class="lights">${win}</g>` : ""}`;
}

function trees(ctx, pts, { from, to, count, size = 22, fill, sink = 4, kind = "pine" }) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = from + ctx.rand() * (to - from);
    const y = yAt(pts, x) + sink + ctx.rand() * sink;
    const h = size * (0.65 + ctx.rand() * 0.7);
    if (kind === "round") {
      const w = h * 0.42;
      d += `M${r1(x - w)},${r1(y)}C${r1(x - w * 1.5)},${r1(y - h * 0.7)} ${r1(x - w * 0.3)},${r1(y - h * 1.05)} ${r1(x)},${r1(y - h)}C${r1(x + w * 0.3)},${r1(y - h * 1.05)} ${r1(x + w * 1.5)},${r1(y - h * 0.7)} ${r1(x + w)},${r1(y)}Z`;
    } else if (kind === "cypress") {
      const w = h * 0.16;
      d += `M${r1(x - w)},${r1(y)}Q${r1(x - w * 1.4)},${r1(y - h * 0.55)} ${r1(x)},${r1(y - h)}Q${r1(x + w * 1.4)},${r1(y - h * 0.55)} ${r1(x + w)},${r1(y)}Z`;
    } else {
      const w = h * 0.34;
      d += `M${r1(x - w)},${r1(y)}L${r1(x - w * 0.35)},${r1(y - h * 0.45)}L${r1(x - w * 0.7)},${r1(y - h * 0.45)}L${r1(x)},${r1(y - h)}L${r1(x + w * 0.7)},${r1(y - h * 0.45)}L${r1(x + w * 0.35)},${r1(y - h * 0.45)}L${r1(x + w)},${r1(y)}Z`;
    }
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

function fortress(ctx, pts, { from, to, s = 1, fill, wall = 16 }) {
  let top = [], d = "";
  const step = 7 * s;
  for (let x = from; x <= to; x += step) {
    const y = yAt(pts, x) - wall * s;
    const up = Math.round((x - from) / step) % 2 === 0;
    top.push([x, y - (up ? 5 * s : 0)], [x + step, y - (up ? 5 * s : 0)]);
  }
  d += `M${r1(from)},${r1(yAt(pts, from) + 6)}L${top.map((p) => `${r1(p[0])},${r1(p[1])}`).join("L")}L${r1(to + step)},${r1(yAt(pts, to) + 6)}Z`;
  for (const tx of [from, (from + to) / 2, to]) {
    const ty = yAt(pts, tx);
    const w = 14 * s, h = (wall + 22) * s;
    d += `M${r1(tx - w / 2)},${r1(ty + 6)}V${r1(ty - h)}h${r1(w / 5)}v${r1(-4 * s)}h${r1(w / 5)}v${r1(4 * s)}h${r1(w / 5)}v${r1(-4 * s)}h${r1(w / 5)}v${r1(4 * s)}h${r1(w / 5)}V${r1(ty + 6)}Z`;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

function hikers(x, y, s, fill) {
  const T = (a, b) => `${r1(x + a * s)},${r1(y + b * s)}`;
  return `<g fill="${fill}" class="hikers">
    <circle cx="${r1(x)}" cy="${r1(y - 55 * s)}" r="${r1(5.6 * s)}"/>
    <path d="M${T(-6, -48)}L${T(6, -48)}L${T(7.5, -24)}L${T(5, 0)}L${T(1.2, 0)}L${T(0, -21)}L${T(-1.6, 0)}L${T(-5.4, 0)}L${T(-7.2, -24)}Z"/>
    <rect x="${r1(x - 14 * s)}" y="${r1(y - 47 * s)}" width="${r1(9 * s)}" height="${r1(20 * s)}" rx="${r1(3 * s)}"/>
    <path d="M${T(7, -32)}L${T(16, 0)}" stroke="${fill}" stroke-width="${r1(1.4 * s)}"/>
    <circle cx="${r1(x + 30 * s)}" cy="${r1(y - 46 * s)}" r="${r1(5.2 * s)}"/>
    <path d="M${T(24.5, -40)}L${T(35.5, -40)}L${T(36.5, -18)}L${T(34, 0)}L${T(30.5, 0)}L${T(30, -17)}L${T(28.6, 0)}L${T(25, 0)}L${T(23.5, -18)}Z"/>
    <path d="M${T(35, -38)}L${T(44, -30)}" stroke="${fill}" stroke-width="${r1(2.6 * s)}" stroke-linecap="round"/>
    <ellipse cx="${r1(x + 56 * s)}" cy="${r1(y - 8 * s)}" rx="${r1(9.5 * s)}" ry="${r1(8.5 * s)}"/>
    <circle cx="${r1(x + 61 * s)}" cy="${r1(y - 20 * s)}" r="${r1(5.4 * s)}"/>
    <ellipse cx="${r1(x + 65.5 * s)}" cy="${r1(y - 19 * s)}" rx="${r1(3.6 * s)}" ry="${r1(2.6 * s)}"/>
    <ellipse cx="${r1(x + 58 * s)}" cy="${r1(y - 18 * s)}" rx="${r1(2.2 * s)}" ry="${r1(4.4 * s)}"/>
    <path d="M${T(47, -6)}q${r1(-9 * s)},${r1(-2 * s)} ${r1(-7 * s)},${r1(-12 * s)}" fill="none" stroke="${fill}" stroke-width="${r1(3.4 * s)}" stroke-linecap="round"/>
  </g>`;
}

function river(ctx, { x0, y0, x1, y1, w0 = 3, w1 = 140, wiggle = 0.12, turns = 2.2, fill }) {
  const N = 48, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const e = t * t;
    const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI * turns + 0.6) * ctx.W * wiggle * (0.25 + t);
    const y = y0 + (y1 - y0) * (1 - Math.pow(1 - t, 1.6));
    const w = w0 + (w1 - w0) * e;
    L.push([x - w / 2, y]);
    R.push([x + w / 2, y]);
  }
  return `<path d="M${L.map((p) => `${r1(p[0])},${r1(p[1])}`).join("L")}L${R.reverse()
    .map((p) => `${r1(p[0])},${r1(p[1])}`)
    .join("L")}Z" fill="${fill}"/>`;
}

function caves(ctx, { x0, x1, y0, y1, rows = 6, fill, s = 1 }) {
  let d = "";
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((r + 0.5) / rows) * (y1 - y0);
    for (let x = x0 + ctx.rand() * 30; x < x1; x += (26 + ctx.rand() * 40) * s) {
      if (ctx.rand() < 0.45) continue;
      const w = (7 + ctx.rand() * 9) * s, h = (9 + ctx.rand() * 10) * s;
      d += `M${r1(x)},${r1(y)}v${r1(-h)}a${r1(w / 2)},${r1(w / 2)} 0 0 1 ${r1(w)},0v${r1(h)}Z`;
    }
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

function vines(ctx, hillPts, { vx, vy, rows = 26, spread = 2.6, color, width = 3 }) {
  const { W, H } = ctx;
  const clip = ctx.clip(area(hillPts, W, H, true));
  let d = "";
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const bx = vx + (t - 0.5) * W * spread;
    d += `M${r1(vx)},${r1(vy)}L${r1(bx)},${H + 40}`;
  }
  return `<g clip-path="${clip}"><path d="${d}" stroke="${color}" stroke-width="${width}" stroke-dasharray="3 6" stroke-linecap="round" fill="none"/></g>`;
}

function cityLights(ctx, { x0, x1, yTop, yBottom, count, colors = ["#ffd58a", "#ffb85c", "#fff1c9"] }) {
  let s = "", glow = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + ctx.rand() * (x1 - x0);
    const yt = typeof yTop === "function" ? yTop(x) : yTop;
    const y = yt + ctx.rand() ** 0.8 * (yBottom - yt);
    const c = colors[Math.floor(ctx.rand() * colors.length)];
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.8 + ctx.rand() * 1.8)}" fill="${c}"/>`;
    if (ctx.rand() < 0.1) glow += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(3 + ctx.rand() * 4)}" fill="${c}" opacity=".14"/>`;
  }
  return `<g class="lights">${glow}${s}</g>`;
}

function palms(ctx, list, fill) {
  return list
    .map(([x, y, s, lean = 1]) => {
      const tx = x + lean * 18 * s, ty = y - 120 * s;
      let fr = "";
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.55 + (ctx.rand() - 0.5) * 0.2;
        const L = (46 + ctx.rand() * 18) * s;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + L * 0.35;
        const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.6 - 10 * s;
        fr += `M${r1(tx)},${r1(ty)}Q${r1(mx)},${r1(my - 6 * s)} ${r1(ex)},${r1(ey)}Q${r1(mx)},${r1(my + 4 * s)} ${r1(tx)},${r1(ty)}Z`;
      }
      return `<path d="M${r1(x - 4 * s)},${r1(y)}Q${r1(x + lean * 4 * s)},${r1(y - 70 * s)} ${r1(tx - 2 * s)},${r1(ty)}L${r1(tx + 2 * s)},${r1(ty)}Q${r1(
        x + lean * 8 * s
      )},${r1(y - 70 * s)} ${r1(x + 4 * s)},${r1(y)}Z${fr}" fill="${fill}"/>`;
    })
    .join("");
}

function road(ctx, pts, color, width = 2.4) {
  return `<path d="${line(pts, true)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity=".8"/>`;
}

// ── presets ─────────────────────────────────────────────────────────────────
const P = {};

P.hero = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.6, amp: 110, rough: 0.63, peaks: [{ x: W * 0.12, h: 120, w: 190 }, { x: W * 0.27, h: 90, w: 150 }, { x: W * 0.9, h: 120, w: 200 }] });
  const main = ridge(rand, W, {
    base: H * 0.66,
    amp: 130,
    rough: 0.63,
    peaks: [
      { x: W * 0.77, h: 350, w: W * 0.19 },
      { x: W * 0.55, h: 150, w: W * 0.1 },
      { x: W * 0.93, h: 170, w: W * 0.1 },
      { x: W * 0.06, h: 160, w: W * 0.12 },
    ],
  });
  const mid = ridge(rand, W, { base: H * 0.73, amp: 60, rough: 0.5, detail: 6, peaks: [{ x: W * 0.2, h: 80, w: 260, shape: "round" }, { x: W * 0.95, h: 70, w: 260, shape: "round" }] });
  const hill = ridge(rand, W, { base: H * 0.83, amp: 26, rough: 0.45, detail: 6, peaks: [{ x: W * 0.76, h: 130, w: 150, shape: "round" }, { x: W * 0.1, h: 40, w: 220, shape: "round" }] });
  const nearL = ridge(rand, W, { base: H * 1.02, amp: 30, rough: 0.5, detail: 6, peaks: [{ x: W * 0.06, h: 220, w: 520, shape: "round" }] });
  const nearR = ridge(rand, W, { base: H * 1.04, amp: 30, rough: 0.5, detail: 6, peaks: [{ x: W * 0.98, h: 200, w: 480, shape: "round" }] });
  const fg = ridge(rand, W, { base: H * 1.12, amp: 46, rough: 0.66, detail: 7, peaks: [{ x: W * 0.11, h: 215, w: 290, shape: "round" }, { x: W * 0.2, h: 120, w: 160, shape: "round" }] });
  const sunX = W * 0.405, sunY = H * 0.58;
  return [
    { depth: 0, cls: "sky", svg: sky(c, [[0, "#f6dcae"], [0.45, "#f4c27f"], [0.66, "#eb9f5f"], [1, "#d98a52"]]) + sun(c, { x: sunX, y: sunY, r: 34, glowR: 14 }) + clouds(c, [[W * 0.22, H * 0.2, 260, 26], [W * 0.62, H * 0.13, 340, 30], [W * 0.85, H * 0.3, 220, 20, 0.8], [W * 0.4, H * 0.36, 300, 18, 0.7]]) + birds(c, [[W * 0.6, H * 0.43, 1], [W * 0.63, H * 0.4, 0.8], [W * 0.645, H * 0.45, 0.7]], "#6b4527") },
    { depth: 0.08, cls: "far", svg: range(c, far, { color: ["#efcfa6", "#eab886"], snow: { line: H * 0.52, color: "#fbeedd", jag: 14 }, rim: "#fff2d6", rimA: 0.6 }) + haze(c, H * 0.5, "#f0b77a", 0.5) },
    { depth: 0.16, cls: "main", svg: range(c, main, { color: ["#dcae80", "#c48f60"], shade: { color: "#8a5634", opacity: 0.32, dir: 1, depth: 0.5 }, snow: { line: H * 0.47, color: "#fff4e3", jag: 22, shadow: "#d8b79a" }, rim: "#fff3d8", rimA: 0.75 }) + haze(c, H * 0.55, "#e9a467", 0.55) + mist(c, H * 0.7, 70, "#f7cf95", 0.6) },
    { depth: 0.28, cls: "mid", svg: range(c, mid, { color: ["#b07c4f", "#93603a"], smooth: true, rim: "#f2c78d", rimA: 0.45 }) + trees(c, mid, { from: W * 0.02, to: W * 0.4, count: 60, size: 16, fill: "#7b4f2f" }) + haze(c, H * 0.7, "#d9905a", 0.35) },
    { depth: 0.42, cls: "hill", svg: range(c, hill, { color: ["#7a5232", "#5d3c22"], smooth: true, rim: "#e9b779", rimA: 0.4 }) + river(c, { x0: sunX + 30, y0: H * 0.78, x1: W * 0.5, y1: H * 1.02, w0: 2, w1: 260, wiggle: 0.05, turns: 2.6, fill: c.lin([[0, "#ffe3a8"], [1, "#f0b25f"]]) }) + church(W * 0.76, yAt(hill, W * 0.76) + 2, 0.95, "#3c2513") + trees(c, hill, { from: W * 0.62, to: W * 0.7, count: 14, size: 18, fill: "#4c3019" }) + mist(c, H * 0.86, 60, "#f5c98d", 0.45) },
    { depth: 0.62, cls: "near", svg: range(c, nearL, { color: ["#4f331d", "#3a2414"], smooth: true, rim: "#d79c5e", rimA: 0.35 }) + range(c, nearR, { color: ["#4a2f1b", "#352011"], smooth: true, rim: "#d79c5e", rimA: 0.35 }) + trees(c, nearL, { from: 0, to: W * 0.3, count: 34, size: 34, fill: "#2f1d10", sink: 8 }) + trees(c, nearR, { from: W * 0.74, to: W, count: 30, size: 36, fill: "#2c1b0f", sink: 8 }) },
    { depth: 0.85, cls: "fg", svg: range(c, fg, { color: "#1f140b", rim: "#c98a4c", rimA: 0.5, rimW: 2 }) + hikers(W * 0.1, yAt(fg, W * 0.1) + 6, 1.15, "#1f140b") },
  ];
};

P.kazbegi = (c) => {
  const { W, H, rand } = c;
  const main = ridge(rand, W, { base: H * 0.62, amp: 130, rough: 0.63, peaks: [{ x: W * 0.55, h: 400, w: W * 0.2 }, { x: W * 0.3, h: 160, w: W * 0.12 }, { x: W * 0.85, h: 200, w: W * 0.14 }] });
  const mid = ridge(rand, W, { base: H * 0.76, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.3, h: 120, w: 160, shape: "round" }] });
  const near = ridge(rand, W, { base: H * 0.95, amp: 30, rough: 0.5, detail: 6, peaks: [{ x: W * 0.85, h: 120, w: 340, shape: "round" }] });
  return [
    { depth: 0, svg: sky(c, [[0, "#d9e1d8"], [0.5, "#f3dcb4"], [1, "#f1b979"]]) + sun(c, { x: W * 0.8, y: H * 0.24, r: 26, glow: "#ffe2a0", glowR: 10, glowA: 0.6 }) + clouds(c, [[W * 0.2, H * 0.2, 240, 24], [W * 0.7, H * 0.4, 260, 22, 0.8]]) },
    { depth: 0.15, svg: range(c, main, { color: ["#c9b4a0", "#9c7a5c"], shade: { color: "#5b4636", opacity: 0.35, dir: -1, depth: 0.55 }, snow: { line: H * 0.48, color: "#fffaf1", jag: 26, shadow: "#c8c3c4" }, rim: "#fff", rimA: 0.6 }) + haze(c, H * 0.5, "#f3d7ae", 0.5) },
    { depth: 0.35, svg: range(c, mid, { color: ["#8a7650", "#6a5636"], smooth: true }) + church(W * 0.3, yAt(mid, W * 0.3) + 2, 1.05, "#2e2316") + trees(c, mid, { from: W * 0.45, to: W * 0.9, count: 40, size: 16, fill: "#4f4128" }) + mist(c, H * 0.8, 60, "#f4e2c1", 0.5) },
    { depth: 0.6, svg: range(c, near, { color: ["#4b3d25", "#2f2616"], smooth: true }) + trees(c, near, { from: W * 0.6, to: W, count: 30, size: 30, fill: "#231b0f" }) },
  ];
};

P.svaneti = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, {
    base: H * 0.6,
    amp: 120,
    rough: 0.63,
    peaks: [{ x: W * 0.36, h: 330, w: 125, pow: 1.05 }, { x: W * 0.5, h: 360, w: 135, pow: 1.05 }, { x: W * 0.82, h: 190, w: 260 }, { x: W * 0.08, h: 170, w: 240 }],
  });
  const mid = ridge(rand, W, { base: H * 0.74, amp: 50, rough: 0.5, detail: 6, peaks: [{ x: W * 0.62, h: 110, w: 380, shape: "round" }] });
  const near = ridge(rand, W, { base: H * 0.9, amp: 26, rough: 0.5, detail: 6, peaks: [{ x: W * 0.15, h: 90, w: 420, shape: "round" }] });
  return [
    { depth: 0, svg: sky(c, [[0, "#cfdad2"], [0.55, "#f2e1bd"], [1, "#efc68e"]]) + sun(c, { x: W * 0.2, y: H * 0.3, r: 24, glow: "#ffe6ad", glowR: 9, glowA: 0.6 }) + clouds(c, [[W * 0.62, H * 0.18, 300, 22], [W * 0.3, H * 0.42, 260, 18, 0.7]]) + birds(c, [[W * 0.66, H * 0.3, 0.9], [W * 0.69, H * 0.27, 0.7]], "#4a4436") },
    { depth: 0.12, svg: range(c, far, { color: ["#b9b2a6", "#8d8a7b"], shade: { color: "#4f5049", opacity: 0.35, dir: 1, depth: 0.6 }, snow: { line: H * 0.44, color: "#fdfaf3", jag: 34, shadow: "#bfc3c4" }, rim: "#fff", rimA: 0.6 }) + haze(c, H * 0.52, "#efe0bf", 0.55) },
    { depth: 0.32, svg: range(c, mid, { color: ["#7d8456", "#59603b"], smooth: true, rim: "#e9dca8", rimA: 0.4 }) + trees(c, mid, { from: 0, to: W * 0.35, count: 50, size: 20, fill: "#3f4a2b" }) + village(c, mid, { from: W * 0.5, to: W * 0.76, towers: 7, houses: 12, s: 1.2, fill: "#3b3122", lights: "#ffd88a" }) + mist(c, H * 0.79, 70, "#efe4c6", 0.5) },
    { depth: 0.58, svg: range(c, near, { color: ["#3f4a2b", "#26301b"], smooth: true }) + trees(c, near, { from: 0, to: W * 0.45, count: 40, size: 36, fill: "#1c2414", sink: 10 }) + trees(c, near, { from: W * 0.8, to: W, count: 16, size: 30, fill: "#1c2414", sink: 10 }) },
  ];
};

P.kakheti = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.52, amp: 80, rough: 0.63, peaks: [{ x: W * 0.18, h: 140, w: 260 }, { x: W * 0.44, h: 110, w: 200 }, { x: W * 0.78, h: 170, w: 300 }] });
  const valley = ridge(rand, W, { base: H * 0.64, amp: 12, rough: 0.4, detail: 5 });
  const hills = ridge(rand, W, { base: H * 0.72, amp: 30, rough: 0.45, detail: 6, peaks: [{ x: W * 0.15, h: 90, w: 300, shape: "round" }] });
  const vine = ridge(rand, W, { base: H * 0.84, amp: 20, rough: 0.4, detail: 6, peaks: [{ x: W * 0.62, h: 70, w: 520, shape: "round" }] });
  return [
    { depth: 0, svg: sky(c, [[0, "#f2c590"], [0.45, "#e7955f"], [0.7, "#c8603f"], [1, "#9b4434"]]) + sun(c, { x: W * 0.62, y: H * 0.46, r: 36, core: "#ffe7bd", glow: "#ffb46b", glowR: 12 }) + clouds(c, [[W * 0.3, H * 0.16, 320, 22], [W * 0.75, H * 0.24, 260, 16, 0.8]], "#ffd9ad") + birds(c, [[W * 0.42, H * 0.22, 0.9], [W * 0.45, H * 0.2, 0.7], [W * 0.47, H * 0.24, 0.6]], "#5a2a1e") },
    { depth: 0.1, svg: range(c, far, { color: ["#c98a7f", "#b46c62"], snow: { line: H * 0.42, color: "#ffe6d0", jag: 16 }, shade: { color: "#7d3d38", opacity: 0.3, dir: 1 }, rim: "#ffe2c4", rimA: 0.6 }) + haze(c, H * 0.42, "#d47758", 0.6) },
    { depth: 0.2, svg: range(c, valley, { color: ["#a35d45", "#8c4c38"], smooth: true }) + haze(c, H * 0.6, "#b4593f", 0.4) + mist(c, H * 0.64, 40, "#e9a07a", 0.5) },
    { depth: 0.34, svg: range(c, hills, { color: ["#7a3f2e", "#5e2f22"], smooth: true, rim: "#f0a678", rimA: 0.5 }) + fortress(c, hills, { from: W * 0.08, to: W * 0.26, s: 1, fill: "#4a2219", wall: 12 }) + trees(c, hills, { from: W * 0.3, to: W * 0.5, count: 12, size: 40, fill: "#4a2219", kind: "cypress", sink: 2 }) },
    { depth: 0.55, svg: range(c, vine, { color: ["#5c3a26", "#3b2416"], smooth: true, rim: "#e9a06c", rimA: 0.45 }) + vines(c, vine, { vx: W * 0.62, vy: yAt(vine, W * 0.62) - 6, rows: 44, spread: 3.4, color: "#56692c", width: 6 }) + trees(c, vine, { from: W * 0.02, to: W * 0.2, count: 6, size: 70, fill: "#2a170d", kind: "cypress", sink: 3 }) },
  ];
};

P.tbilisi = (c) => {
  const { W, H, rand } = c;
  const hills = ridge(rand, W, { base: H * 0.6, amp: 40, rough: 0.45, detail: 6, peaks: [{ x: W * 0.32, h: 150, w: 380, shape: "round" }, { x: W * 0.85, h: 80, w: 300, shape: "round" }] });
  const town = ridge(rand, W, { base: H * 0.78, amp: 18, rough: 0.4, detail: 6, peaks: [{ x: W * 0.72, h: 50, w: 200, shape: "round" }] });
  const bank = ridge(rand, W, { base: H * 0.95, amp: 12, rough: 0.4, detail: 5 });
  const riverY = H * 0.86;
  return [
    { depth: 0, svg: sky(c, [[0, "#141a22"], [0.45, "#2b2a33"], [0.72, "#7b4a3a"], [1, "#d48a55"]]) + stars(c, 120, H * 0.45) + `<circle cx="${W * 0.82}" cy="${H * 0.16}" r="22" fill="#fbecc9"/><circle cx="${W * 0.82}" cy="${H * 0.16}" r="90" fill="${c.rad([[0, "#fbecc9", 0.25], [1, "#fbecc9", 0]])}"/>` },
    { depth: 0.18, svg: range(c, hills, { color: ["#2a2220", "#1d1715"], smooth: true, rim: "#d58c58", rimA: 0.35 }) + fortress(c, hills, { from: W * 0.2, to: W * 0.44, s: 1.3, fill: "#120d0b", wall: 18 }) + cityLights(c, { x0: W * 0.46, x1: W, yTop: (x) => yAt(hills, x) + 30, yBottom: H * 0.8, count: 160 }) + `<path d="M${W * 0.28},${yAt(hills, W * 0.28) - 28}h3v-14h-3z" fill="#ffd58a" opacity=".8"/>` },
    { depth: 0.36, svg: range(c, town, { color: ["#1a1412", "#120e0c"], smooth: true }) + church(W * 0.72, yAt(town, W * 0.72) + 2, 1.1, "#0d0a08") + cityLights(c, { x0: 0, x1: W, yTop: (x) => yAt(town, x) + 10, yBottom: riverY - 6, count: 260 }) + `<rect x="0" y="${riverY}" width="${W}" height="${H - riverY}" fill="${c.lin([[0, "#3b2a26"], [1, "#1a1311"]])}"/>` + cityLights(c, { x0: 0, x1: W, yTop: riverY + 6, yBottom: H * 0.94, count: 80, colors: ["#ffb85c"] }).replace('class="lights"', 'class="lights" opacity=".45"') },
    { depth: 0.6, svg: range(c, bank, { color: "#0c0907" }) + trees(c, bank, { from: 0, to: W * 0.25, count: 10, size: 50, fill: "#0c0907", kind: "cypress" }) },
  ];
};

P.adjara = (c) => {
  const { W, H, rand } = c;
  const hills = ridge(rand, W, { base: H * 0.56, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.82, h: 200, w: 420, shape: "round" }, { x: W * 0.55, h: 70, w: 200, shape: "round" }] });
  const coast = ridge(rand, W, { base: H * 0.74, amp: 20, rough: 0.4, detail: 6, peaks: [{ x: W * 0.92, h: 140, w: 360, shape: "round" }] });
  const horizon = H * 0.62;
  let shimmer = "";
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const y = horizon + 4 + t * t * (H - horizon);
    const w = 16 + t * 160 * c.rand() + 10;
    shimmer += `<rect x="${r1(W * 0.34 - w / 2 + (c.rand() - 0.5) * (40 + t * 220))}" y="${r1(y)}" width="${r1(w)}" height="${r1(1 + t * 2.2)}" rx="1" opacity="${r1(0.35 + c.rand() * 0.6)}"/>`;
  }
  return [
    { depth: 0, svg: sky(c, [[0, "#f3d8ae"], [0.6, "#f2b678"], [1, "#e88b5a"]]) + sun(c, { x: W * 0.34, y: horizon - 30, r: 40, glowR: 12 }) + clouds(c, [[W * 0.6, H * 0.18, 330, 26], [W * 0.15, H * 0.3, 260, 20, 0.8]]) + birds(c, [[W * 0.5, H * 0.3, 0.9], [W * 0.53, H * 0.27, 0.7]], "#6b3f25") },
    { depth: 0.1, svg: range(c, hills, { color: ["#9a8a62", "#6f6844"], smooth: true, rim: "#ffe0a6", rimA: 0.5 }) + haze(c, H * 0.45, "#f0b77c", 0.6) + `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${c.lin([[0, "#e5a36c"], [0.4, "#a8674a"], [1, "#4d3a33"]])}"/><g fill="#ffe7b5" opacity=".8">${shimmer}</g>` },
    { depth: 0.4, svg: range(c, coast, { color: ["#3f5a3a", "#24361f"], smooth: true }).replace(/M0,[^L]+L/, `M${W * 0.62},${H}L`) + trees(c, coast, { from: W * 0.7, to: W, count: 26, size: 34, fill: "#1d2c19" }) },
    { depth: 0.7, svg: palms(c, [[W * 0.08, H * 1.02, 1.6, 1], [W * 0.17, H * 1.04, 1.25, -0.6], [W * 0.9, H * 1.04, 1.5, -1]], "#1b1712") },
  ];
};

P.vardzia = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.42, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.8, h: 60, w: 300, shape: "round" }] });
  const cliff = [];
  for (let i = 0; i <= 64; i++) {
    const x = (i / 64) * W;
    cliff.push([x, H * 0.24 + Math.sin(i * 0.4) * 6 + (rand() - 0.5) * 8 + Math.pow(Math.max(0, (x - W * 0.82) / (W * 0.18)), 2) * H * 0.3]);
  }
  const bank = ridge(rand, W, { base: H * 0.86, amp: 16, rough: 0.4, detail: 5 });
  let strata = "";
  for (let i = 0; i < 16; i++) {
    const y = H * 0.3 + i * 22 + rand() * 8;
    strata += `M0,${r1(y)}C${W * 0.3},${r1(y + (rand() - 0.5) * 20)} ${W * 0.6},${r1(y + (rand() - 0.5) * 20)} ${W},${r1(y + (rand() - 0.5) * 16)}`;
  }
  return [
    { depth: 0, svg: sky(c, [[0, "#e7d7b7"], [1, "#f1c88d"]]) + sun(c, { x: W * 0.9, y: H * 0.1, r: 20, glowR: 10, glowA: 0.5 }) },
    { depth: 0.08, svg: range(c, far, { color: ["#c9a578", "#b98e60"], smooth: true }) + haze(c, H * 0.3, "#f0cf9b", 0.6) },
    { depth: 0.22, svg: `<path d="${area(cliff, W, H)}" fill="${c.lin([[0, "#d5a165"], [0.5, "#b97c45"], [1, "#8a5730"]])}"/><path d="${strata}" stroke="#7a4a26" stroke-width="2" opacity=".35" fill="none" clip-path="${c.clip(area(cliff, W, H))}"/>` + caves(c, { x0: W * 0.05, x1: W * 0.8, y0: H * 0.32, y1: H * 0.66, rows: 8, fill: "#3b2212", s: 0.85 }) + `<path d="M${W * 0.12},${H * 0.66}h${W * 0.6}" stroke="#5a3519" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>` + trees(c, cliff.map(([x, y]) => [x, y + 2]), { from: 0, to: W * 0.8, count: 30, size: 12, fill: "#6d6a3a" }) },
    { depth: 0.42, svg: `<rect x="0" y="${H * 0.76}" width="${W}" height="${H * 0.24}" fill="${c.lin([[0, "#7fa39a"], [1, "#3f5652"]])}"/>` + range(c, bank, { color: ["#5c4a2c", "#3a2e1b"], smooth: true }) + trees(c, bank, { from: 0, to: W, count: 40, size: 26, fill: "#2f3a1f" }) },
  ];
};

P.tusheti = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.52, amp: 120, rough: 0.63, peaks: [{ x: W * 0.25, h: 190, w: 260 }, { x: W * 0.7, h: 230, w: 300 }] });
  const mid = ridge(rand, W, { base: H * 0.72, amp: 70, rough: 0.56, detail: 7, peaks: [{ x: W * 0.62, h: 150, w: 330, shape: "round" }] });
  const near = ridge(rand, W, { base: H * 0.88, amp: 26, rough: 0.5, detail: 6, peaks: [{ x: W * 0.15, h: 110, w: 380, shape: "round" }] });
  const top = mid.reduce((a, p) => (p[1] < a[1] ? p : a));
  const zig = [];
  for (let i = 0; i < 9; i++) zig.push([W * 0.2 + (i % 2 ? 260 : 0) + i * 14, H * 0.98 - i * 32]);
  return [
    { depth: 0, svg: sky(c, [[0, "#b9c7c6"], [0.5, "#e9dcc0"], [1, "#eec48e"]]) + sun(c, { x: W * 0.84, y: H * 0.32, r: 26, glowR: 11, glowA: 0.6 }) + clouds(c, [[W * 0.3, H * 0.15, 300, 24], [W * 0.62, H * 0.32, 220, 16, 0.7]]) },
    { depth: 0.12, svg: range(c, far, { color: ["#a8a69a", "#7f7f72"], shade: { color: "#3f423e", opacity: 0.3, dir: -1 }, snow: { line: H * 0.4, color: "#fbf8f1", jag: 18 }, rim: "#fff", rimA: 0.5 }) + haze(c, H * 0.42, "#e9dcc0", 0.6) },
    { depth: 0.3, svg: range(c, mid, { color: ["#768060", "#525a3f"], smooth: true, shade: { color: "#2e3324", opacity: 0.3, dir: -1 } }) + `<path d="${tower(top[0] - 30, yAt(mid, top[0] - 30) + 6, 1.1, 0.75, 2)}${tower(top[0] + 4, yAt(mid, top[0] + 4) + 6, 1.25, 0.8, 2)}${tower(top[0] + 38, yAt(mid, top[0] + 38) + 6, 1, 0.7, 2)}${house(top[0] + 70, yAt(mid, top[0] + 70) + 6, 1.4)}${house(top[0] - 60, yAt(mid, top[0] - 60) + 6, 1.3)}" fill="#2b2a20"/>` + mist(c, H * 0.74, 60, "#eadfc3", 0.5) },
    { depth: 0.55, svg: range(c, near, { color: ["#5c6440", "#353b24"], smooth: true }) + road(c, zig, "#d9c79a", 3) + trees(c, near, { from: W * 0.55, to: W, count: 24, size: 28, fill: "#262c19" }) },
  ];
};

P.colchis = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.5, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.7, h: 110, w: 380, shape: "round" }] });
  const mid = ridge(rand, W, { base: H * 0.64, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.32, h: 130, w: 260, shape: "round" }] });
  const near = ridge(rand, W, { base: H * 0.84, amp: 30, rough: 0.5, detail: 6, peaks: [{ x: W * 0.85, h: 130, w: 360, shape: "round" }, { x: W * 0.05, h: 120, w: 300, shape: "round" }] });
  return [
    { depth: 0, svg: sky(c, [[0, "#dfe3cf"], [0.6, "#f0dbb0"], [1, "#e9be86"]]) + sun(c, { x: W * 0.55, y: H * 0.3, r: 26, glowR: 12, glowA: 0.55 }) },
    { depth: 0.12, svg: range(c, far, { color: ["#8f9a78", "#6e7a5a"], smooth: true }) + haze(c, H * 0.4, "#efe0bd", 0.6) + mist(c, H * 0.56, 80, "#f3ead2", 0.8) },
    { depth: 0.3, svg: range(c, mid, { color: ["#4f6a42", "#38512e"], smooth: true, rim: "#efe2b0", rimA: 0.4 }) + church(W * 0.32, yAt(mid, W * 0.32) + 2, 0.9, "#24311c") + trees(c, mid, { from: W * 0.45, to: W, count: 70, size: 20, fill: "#2c4024", kind: "round" }) + mist(c, H * 0.7, 70, "#eef0dc", 0.6) },
    { depth: 0.55, svg: range(c, near, { color: ["#2f4628", "#1b2a17"], smooth: true }) + river(c, { x0: W * 0.5, y0: H * 0.74, x1: W * 0.46, y1: H * 1.02, w0: 4, w1: 240, wiggle: 0.04, fill: c.lin([[0, "#d8e4cf"], [1, "#89a99a"]]) }) + trees(c, near, { from: 0, to: W * 0.3, count: 30, size: 40, fill: "#16230f" }) + trees(c, near, { from: W * 0.68, to: W, count: 30, size: 40, fill: "#16230f" }) },
  ];
};

P.dmanisi = (c) => {
  const { W, H, rand } = c;
  const far = ridge(rand, W, { base: H * 0.66, amp: 40, rough: 0.5, detail: 6, peaks: [{ x: W * 0.2, h: 60, w: 300, shape: "round" }, { x: W * 0.78, h: 90, w: 320, shape: "round" }] });
  const mesa = [];
  for (let i = 0; i <= 64; i++) {
    const x = (i / 64) * W;
    const e = x < W * 0.3 ? H * 0.9 - ((x / (W * 0.3)) ** 0.5) * H * 0.18 : x > W * 0.86 ? H * 0.72 + ((x - W * 0.86) / (W * 0.14)) ** 2 * H * 0.2 : H * 0.72;
    mesa.push([x, e + (rand() - 0.5) * 4]);
  }
  return [
    { depth: 0, svg: sky(c, [[0, "#070a10"], [0.55, "#1a1d26"], [0.82, "#4a3328"], [1, "#9a5b36"]]) + `<ellipse cx="${W * 0.55}" cy="${H * 0.28}" rx="${W * 0.7}" ry="70" transform="rotate(-18 ${W * 0.55} ${H * 0.28})" fill="${c.rad([[0, "#e8dccb", 0.22], [1, "#e8dccb", 0]])}"/>` + stars(c, 260, H * 0.62) },
    { depth: 0.15, svg: range(c, far, { color: ["#2b2425", "#1c1718"], smooth: true, rim: "#c27b4c", rimA: 0.4 }) },
    { depth: 0.38, svg: `<path d="${area(mesa, W, H)}" fill="#120e0c"/>` + church(W * 0.6, H * 0.72 + 2, 1.2, "#120e0c") + `<path d="M${W * 0.4},${H * 0.72}v-26h8v-6h6v6h8v26zM${W * 0.46},${H * 0.72}v-14h30v14zM${W * 0.72},${H * 0.72}v-20h6v-4h5v4h6v20z" fill="#120e0c"/>` + `<circle cx="${W * 0.34}" cy="${H * 0.715}" r="70" fill="${c.rad([[0, "#ff9a3c", 0.55], [1, "#ff9a3c", 0]])}" class="ember"/><circle cx="${W * 0.34}" cy="${H * 0.712}" r="4" fill="#ffc46b"/>` },
  ];
};

export const SCENES = Object.keys(P);

export function scene(name, { layered = false, className = "", label = "", W = 1600, H = 1000, seed } = {}) {
  const c = makeCtx(W, H, seed ?? [...name].reduce((a, ch) => a + ch.charCodeAt(0), 7));
  const layers = P[name](c);
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const defs = `<defs>${c.defs.join("")}</defs>`;
  if (!layered) {
    return `<svg class="scene ${className}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" ${aria} focusable="false">${defs}${layers
      .map((l) => `<g data-depth="${l.depth}">${l.svg}</g>`)
      .join("")}</svg>`;
  }
  // Layered: every layer is its own SVG so it can move on the GPU independently.
  return `<div class="scene scene--layered ${className}" ${aria}>${layers
    .map(
      (l, i) =>
        `<svg class="scene__layer${l.cls ? ` scene__layer--${l.cls}` : ""}" data-depth="${l.depth}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${
          i === 0 ? defs : ""
        }${l.svg}</svg>`
    )
    .join("")}</div>`;
}

// Standalone SVG document, written to assets/scenes/<name>.svg and used via <img>.
export const sceneFile = (name) =>
  scene(name).replace('<svg class="scene "', '<svg').replace(/data-depth="[^"]*"/g, "");

// Scenes with a dark sky — pages using them get a light header.
export const isNight = (name) => name === "tbilisi" || name === "dmanisi";
