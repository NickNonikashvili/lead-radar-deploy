// Builds the static site into dist/: `npm run build`.
// Pages are the designer's page bodies (src/design) filled with our content (src/data), wrapped in the
// shared layout, then translated into every language in src/lib/i18n.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./src/config.mjs";
import { LANGS, extract, loadDict, translatePage, jsKeys } from "./src/lib/i18n.mjs";
import { TOURS } from "./src/data/tours.mjs";
import { ARTICLES } from "./src/data/guide.mjs";
import home from "./src/pages/home.mjs";
import toursPage from "./src/pages/tours.mjs";
import tourPage from "./src/pages/tour.mjs";
import discoverPage from "./src/pages/discover.mjs";
import { guidePage, articlePage } from "./src/pages/guide.mjs";
import aboutPage from "./src/pages/about.mjs";
import contactPage from "./src/pages/contact.mjs";
import partnersPage from "./src/pages/partners.mjs";
import { privacyPage, termsPage, cookiesPage, creditsPage, notFoundPage } from "./src/pages/legal.mjs";
import { writeAdminFiles } from "./scripts/admin-files.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// Output folder: dist/ (MFS_OUT=/some/dir builds elsewhere, e.g. for tests running side by side).
const out = process.env.MFS_OUT ? path.resolve(process.env.MFS_OUT) : path.join(here, "dist");
const t0 = Date.now();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(here, "src", "assets"), path.join(out, "assets"), {
  recursive: true,
  filter: (src) => !/photos[\\/].+\.(jpe?g|png|tiff?)$/i.test(src) && !src.endsWith("README.md"),
});
writeFavicon();
writeServerFiles();
writeAdminFiles(out);

const pages = [
  ["index.html", home()],
  ["tours.html", toursPage()],
  ...TOURS.map((t) => [`tours/${t.id}.html`, tourPage(t)]),
  ["discover-georgia.html", discoverPage()],
  ["travel-guide.html", guidePage()],
  ...ARTICLES.map((a) => [`guide/${a.slug}.html`, articlePage(a)]),
  ["about.html", aboutPage()],
  ["contact.html", contactPage()],
  ["partners.html", partnersPage()],
  ["privacy.html", privacyPage()],
  ["terms.html", termsPage()],
  ["cookies.html", cookiesPage()],
  ["credits.html", creditsPage()],
  ["404.html", notFoundPage()],
];
for (const [file, html] of pages) write(file, html);

// ── Languages ──────────────────────────────────────────────────────────────
// Every page is rebuilt in each language from src/i18n/<lang>*.json; untranslated text stays English.
const i18nDir = path.join(here, "src", "i18n");
const scriptKeys = (html) => {
  const keys = new Set();
  for (const m of html.matchAll(/<script src="(?:\.\.\/)*assets\/js\/([\w-]+\.js)"/g)) {
    for (const k of jsKeys(fs.readFileSync(path.join(here, "src", "assets", "js", m[1]), "utf8"))) keys.add(k);
  }
  return [...keys];
};
const strings = new Set();
for (const [, html] of pages) {
  extract(html, strings);
  scriptKeys(html).forEach((k) => strings.add(k));
}
fs.mkdirSync(i18nDir, { recursive: true });
fs.writeFileSync(path.join(i18nDir, "_strings.json"), JSON.stringify([...strings], null, 1) + "\n");
const report = [];
for (const { code } of LANGS.filter((l) => l.code !== "en")) {
  const dict = loadDict(i18nDir, code);
  const missing = new Set();
  for (const [file, html] of pages) {
    if (file === "404.html") continue;
    write(path.join(code, file), translatePage(html, { lang: code, dict, missing, js: scriptKeys(html) }));
  }
  report.push(`${code} ${Math.round((100 * (strings.size - missing.size)) / strings.size)}%`);
}
console.log(`${strings.size} strings · translated: ${report.join(", ")}`);

if (config.siteUrl) {
  const urls = pages
    .filter(([f]) => f !== "404.html")
    .flatMap(([f]) => LANGS.map((l) => `<url><loc>${config.siteUrl}/${l.code === "en" ? "" : l.code + "/"}${f === "index.html" ? "" : f}</loc></url>`));
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`);
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
} else {
  fs.writeFileSync(path.join(out, "robots.txt"), "User-agent: *\nAllow: /\n");
}

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Built ${pages.length} pages × ${LANGS.length} languages into ${path.relative(here, out) || "."}/ (${(size(out) / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);

function write(file, html) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

// The footprint logo from the header, as the favicon.
function writeFavicon() {
  const header = fs.readFileSync(path.join(here, "src", "design", "_header.html"), "utf8");
  const svg = header.match(/<svg[^>]*class="brand__mark"[\s\S]*?<\/svg>/)[0]
    .replace(/ aria-hidden="true"| class="brand__mark"| focusable="false"/g, "")
    .replace(/ width="\d+" height="\d+"/, ' width="64" height="103"');
  fs.writeFileSync(path.join(out, "assets", "img", "favicon.svg"), svg);
}

// .htaccess and send.php for Apache/LiteSpeed hosting with PHP (e.g. Hostinger).
function writeServerFiles() {
  const root = path.join(here, "src", "root");
  fs.cpSync(root, out, { recursive: true, filter: (f) => !f.endsWith("send.php") });
  const php = fs.readFileSync(path.join(root, "send.php"), "utf8")
    .replace("__TO__", (config.formTo || config.email || "").replace(/'/g, ""))
    .replace("__BRAND__", config.brand.replace(/'/g, ""));
  fs.writeFileSync(path.join(out, "send.php"), php);
}
