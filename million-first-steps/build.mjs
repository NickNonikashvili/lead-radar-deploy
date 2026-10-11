// Builds the static site into dist/. No dependencies: `node build.mjs`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./src/config.mjs";
import { SCENES, sceneFile } from "./src/lib/scenes.mjs";
import { footprintMaskSVG, faviconSVG } from "./src/lib/logo.mjs";
import { TOURS } from "./src/data/tours.mjs";
import home from "./src/pages/home.mjs";
import toursPage from "./src/pages/tours.mjs";
import tourPage from "./src/pages/tour.mjs";
import historyPage from "./src/pages/history.mjs";
import destinationsPage from "./src/pages/destinations.mjs";
import aboutPage from "./src/pages/about.mjs";
import planPage from "./src/pages/plan.mjs";
import contactPage from "./src/pages/contact.mjs";
import { creditsPage, privacyPage, termsPage, notFoundPage } from "./src/pages/legal.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "dist");
const t0 = Date.now();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(here, "src", "assets"), path.join(out, "assets"), {
  recursive: true,
  filter: (src) => !/photos[\\/].+\.(jpe?g|png|tiff?)$/i.test(src) && !src.endsWith("README.md"),
});

// Generated assets: illustrated scenes as cacheable SVG files, the favicon and the footprint mask.
fs.mkdirSync(path.join(out, "assets", "scenes"), { recursive: true });
for (const name of SCENES) fs.writeFileSync(path.join(out, "assets", "scenes", `${name}.svg`), sceneFile(name));
fs.writeFileSync(path.join(out, "assets", "img", "favicon.svg"), faviconSVG());
fs.writeFileSync(path.join(out, "assets", "img", "footprint.svg"), footprintMaskSVG());
fs.writeFileSync(path.join(out, "assets", "img", "topo.svg"), topo());

const pages = [
  ["index.html", home()],
  ["tours.html", toursPage()],
  ...TOURS.map((t) => [`tours/${t.id}.html`, tourPage(t)]),
  ["history.html", historyPage()],
  ["destinations.html", destinationsPage()],
  ["about.html", aboutPage()],
  ["plan.html", planPage()],
  ["contact.html", contactPage()],
  ["credits.html", creditsPage()],
  ["privacy.html", privacyPage()],
  ["terms.html", termsPage()],
  ["404.html", notFoundPage()],
];
for (const [file, html] of pages) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

if (config.siteUrl) {
  const urls = pages.filter(([f]) => f !== "404.html").map(([f]) => `<url><loc>${config.siteUrl}/${f === "index.html" ? "" : f}</loc></url>`);
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`);
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
} else {
  fs.writeFileSync(path.join(out, "robots.txt"), "User-agent: *\nAllow: /\n");
}

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Built ${pages.length} pages into dist/ (${(size(out) / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);

// Topographic contour lines, used as a quiet texture on dark sections.
function topo() {
  let paths = "";
  const centres = [[180, 220], [620, 140], [470, 560], [860, 470]];
  for (const [cx, cy] of centres) {
    for (let r = 26; r < 260; r += 22) {
      let d = "";
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const k = r * (1 + 0.16 * Math.sin(3 * t + r * 0.05) + 0.08 * Math.cos(5 * t + cx));
        d += `${a ? "L" : "M"}${(cx + Math.cos(t) * k * 1.25).toFixed(1)},${(cy + Math.sin(t) * k).toFixed(1)}`;
      }
      paths += `<path d="${d}Z"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><g fill="none" stroke="#e3b25a" stroke-width="1.2">${paths}</g></svg>`;
}
