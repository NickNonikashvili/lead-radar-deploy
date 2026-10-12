// Inline SVG map of Georgia (Natural Earth outline, see scripts/make-geo.mjs) with tour routes.
import fs from "node:fs";
import { PLACES } from "../data/places.mjs";

const geo = JSON.parse(fs.readFileSync(new URL("../data/geo.json", import.meta.url), "utf8"));
const { lon0, lat0, k, cos, pad } = geo.projection;
export const project = (lat, lon) => [(lon - lon0) * cos * k + pad, (lat0 - lat) * k + pad];
const r1 = (n) => Math.round(n * 10) / 10;

// Peaks of the Greater and Lesser Caucasus, drawn as small glyphs.
const RIDGE = [
  [43.25, 40.75], [43.2, 41.2], [43.15, 41.7], [43.12, 42.2], [43.05, 42.6], [43.02, 43.0], [42.9, 43.4], [42.82, 43.8],
  [42.74, 44.25], [42.7, 44.52], [42.58, 44.95], [42.48, 45.3], [42.42, 45.65], [42.3, 46.0],
  [41.58, 42.25], [41.52, 42.75], [41.7, 43.0], [41.62, 43.55], [41.75, 43.85],
];

function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    d += `C${r1(p1[0] + (p2[0] - p0[0]) * t)},${r1(p1[1] + (p2[1] - p0[1]) * t)} ${r1(p2[0] - (p3[0] - p1[0]) * t)},${r1(
      p2[1] - (p3[1] - p1[1]) * t
    )} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d;
}

const LABEL = {
  r: (x, y) => ({ x: x + 13, y: y + 6, a: "start" }),
  l: (x, y) => ({ x: x - 13, y: y + 6, a: "end" }),
  t: (x, y) => ({ x, y: y - 14, a: "middle" }),
  b: (x, y) => ({ x, y: y + 25, a: "middle" }),
};

/** Cumulative share (0–1) of the route's length at each point of `route`. */
export function routeFractions(route) {
  const pts = route.filter((id) => PLACES[id]).map((id) => project(PLACES[id].lat, PLACES[id].lon));
  const seg = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) seg.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
  return seg.map((v) => (total ? v / total : 0));
}

/**
 * route:  ordered list of place ids (repeats allowed — e.g. back to Tbilisi)
 * stops:  extra place ids to show without a route
 */
export function georgiaMap({ route = [], stops = [], className = "", label = "Map of Georgia", regions = false, ridge = true } = {}) {
  const ids = [...new Set([...route, ...stops])].filter((id) => PLACES[id]);
  const pts = route.filter((id) => PLACES[id]).map((id) => project(PLACES[id].lat, PLACES[id].lon));

  // Fraction of the route's length at which each stop is first reached (drives the scroll sync).
  const at = {};
  let total = 0;
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
  route.forEach((id, i) => {
    if (!(id in at)) at[id] = total ? seg[i] / total : 0;
  });

  const ridgeGlyphs = ridge
    ? RIDGE.map(([la, lo]) => {
        const [x, y] = project(la, lo);
        return `M${r1(x - 9)},${r1(y + 5)}L${r1(x)},${r1(y - 7)}L${r1(x + 9)},${r1(y + 5)}`;
      }).join("")
    : "";

  // Tour maps also carry a landscape crop around their stops; small screens switch to it (main.js fitMaps).
  let crop = "";
  if (className.includes("gmap--tour") && ids.length > 1) {
    const xy = ids.map((id) => project(PLACES[id].lat, PLACES[id].lon));
    const [fx, fy, fw, fh] = geo.viewBox.split(/\s+/).map(Number);
    let x0 = Math.min(...xy.map((p) => p[0])) - 110, x1 = Math.max(...xy.map((p) => p[0])) + 110;
    let y0 = Math.min(...xy.map((p) => p[1])) - 50, y1 = Math.max(...xy.map((p) => p[1])) + 45;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < 2.2) { x0 -= (h * 2.2 - w) / 2; w = h * 2.2; }
    if (w >= fw) { x0 = fx; w = fw; } else x0 = Math.max(fx, Math.min(x0, fx + fw - w));
    if (h >= fh) { y0 = fy; h = fh; } else y0 = Math.max(fy, Math.min(y0, fy + fh - h));
    crop = ` data-crop="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}"`;
  }

  return `<svg class="gmap ${className}" viewBox="${geo.viewBox}"${crop} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  <path class="gmap__land" d="${geo.outline}"/>
  ${regions ? `<g class="gmap__regions">${geo.regions.map((r) => `<path d="${r.d}" data-region="${r.name}"><title>${r.name}</title></path>`).join("")}</g>` : ""}
  ${geo.rivers.map((d) => `<path class="gmap__river" d="${d}"/>`).join("")}
  <path class="gmap__ridge" d="${ridgeGlyphs}"/>
  <text class="gmap__sea" x="${r1(project(42.1, 40.75)[0])}" y="${r1(project(42.1, 40.75)[1])}" text-anchor="middle">Black Sea</text>
  <text class="gmap__range" x="${r1(project(43.42, 43.6)[0])}" y="${r1(project(43.42, 43.6)[1])}" text-anchor="middle">Greater Caucasus</text>
  ${pts.length > 1 ? `<path class="gmap__route-bg" d="${smoothPath(pts)}"/><path class="gmap__route" d="${smoothPath(pts)}" pathLength="1"/>` : ""}
  ${ids
    .map((id) => {
      const p = PLACES[id];
      const [x, y] = project(p.lat, p.lon);
      const l = LABEL[p.label || "r"](x, y);
      return `<g class="gmap__stop${p.major ? " is-major" : ""}" data-stop="${id}"${id in at ? ` data-at="${at[id].toFixed(4)}"` : ""}>
      <circle class="gmap__halo" cx="${r1(x)}" cy="${r1(y)}" r="14"/><circle class="gmap__dot" cx="${r1(x)}" cy="${r1(y)}" r="${p.major ? 7 : 5.5}"/>
      <text x="${r1(l.x)}" y="${r1(l.y)}" text-anchor="${l.a}">${p.name}</text></g>`;
    })
    .join("")}
</svg>`;
}
