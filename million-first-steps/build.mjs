// Builds the static site into dist/: `npm run build`.
// Pages are the designer's page bodies (src/design) filled with our content (src/data), wrapped in the
// shared layout, then translated into every language in src/lib/i18n.mjs. Links are turned into clean
// addresses (/about, /tours/, /ru/guide/visa) last, in src/lib/urls.mjs; MFS_HTML_LINKS=1 keeps .html links.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./src/config.mjs";
import { LANGS, extract, loadDict, translatePage, jsKeys, markWarnings } from "./src/lib/i18n.mjs";
import { cleanLinks, publicPath, HTML_LINKS } from "./src/lib/urls.mjs";
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
import { channelSprite } from "./src/lib/layout.mjs";

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
// What site.js gets while there's no api/live.json yet (the .htaccess, serve.mjs and router.php serve it).
fs.writeFileSync(path.join(out, "assets", "live-none.json"), "{}\n");
writeAdminFiles(out);

const pages = [
  ["index.html", home()],
  ["tours/index.html", toursPage()],
  ...TOURS.map((t) => [`tours/${t.id}.html`, tourPage(t)]),
  ["discover-georgia.html", discoverPage()],
  ["guide/index.html", guidePage()],
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
// Icons of the messaging channels that are built hidden: one shared file instead of a copy in every page.
const sprite = channelSprite();
fs.writeFileSync(path.join(out, "assets", "img", "channels.svg"), sprite.svg);
for (const [file, html] of pages) write(file, html);

// ── Languages ──────────────────────────────────────────────────────────────
// Every page is rebuilt in each language from src/i18n/<lang>*.json; untranslated text stays English.
const i18nDir = path.join(here, "src", "i18n");
const scriptKeys = (html) => {
  const keys = new Set();
  for (const m of html.matchAll(/<script src="(?:\.\.\/)*assets\/js\/([\w-]+\.js)(?:\?[^"]*)?"/g)) {
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
    const page = translatePage(html, { lang: code, dict, missing, js: scriptKeys(html) });
    write(path.join(code, file), file === "404.html" ? notFoundIn(code, page) : page);
  }
  report.push(`${code} ${Math.round((100 * (strings.size - missing.size)) / strings.size)}%`);
}
console.log(`${strings.size} strings · translated: ${report.join(", ")}`);
if (markWarnings.length) console.log(`! ${markWarnings.length} live price(s) not found in a translation (those stay as built): ${[...new Set(markWarnings)].join(", ")}`);

if (!config.siteUrl) console.log("! siteUrl is empty in src/config.mjs: no canonical links, hreflang, sitemap.xml or share image (og:image). Set it before building for the live site.");

// The admin panel isn't for search engines (it also says so in its own headers).
const robots = "User-agent: *\nAllow: /\nDisallow: /admin/\n";
if (config.siteUrl) {
  const urls = pages
    .filter(([f]) => f !== "404.html")
    .flatMap(([f]) => LANGS.map((l) => `<url><loc>${config.siteUrl}/${l.code === "en" ? "" : l.code + "/"}${publicPath(f)}</loc></url>`));
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`);
  fs.writeFileSync(path.join(out, "robots.txt"), `${robots}Sitemap: ${config.siteUrl}/sitemap.xml\n`);
} else {
  fs.writeFileSync(path.join(out, "robots.txt"), robots);
}

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Built ${pages.length} pages × ${LANGS.length} languages into ${path.relative(here, out) || "."}/ (${(size(out) / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms${HTML_LINKS ? " with .html links" : ""}`);

// Every page goes through cleanLinks last, so each internal link (also inside translations) is a clean address.
function write(file, html) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, cleanLinks(html.replaceAll("__CHANNELS_V__", sprite.version), file.split(path.sep).join("/")));
}

// The 404 page of one language (ru/404.html, served by the .htaccess for unknown addresses under /ru/): its
// links go to that language's pages, from the site root like the English one, and the site root stays "/".
function notFoundIn(code, html) {
  return html
    .replace('data-site-root="..//"', 'data-site-root="/"')
    .replace(/(\s(?:href|action)=")\/(?!\/|assets\/|api\/|admin\/|send\.php)/g, `$1/${code}/`);
}

// The footprint logo from the header, as the favicon.
function writeFavicon() {
  const header = fs.readFileSync(path.join(here, "src", "design", "_header.html"), "utf8");
  const svg = header.match(/<svg[^>]*class="brand__mark"[\s\S]*?<\/svg>/)[0]
    .replace(/ aria-hidden="true"| class="brand__mark"| focusable="false"/g, "")
    .replace(/ width="\d+" height="\d+"/, ' width="64" height="103"');
  fs.writeFileSync(path.join(out, "assets", "img", "favicon.svg"), svg);
}

// .htaccess, send.php, admin/ and api/ for Apache/LiteSpeed hosting with PHP (e.g. Hostinger).
// Never shipped: api/live.json (the owners' settings from the admin panel live there on the server, and
// uploading a new build must not wipe them) and any database file.
function writeServerFiles() {
  const root = path.join(here, "src", "root");
  const keep = (f) => {
    const rel = path.relative(root, f).split(path.sep).join("/");
    return rel !== "send.php" && rel !== "api/live.json" && !/\.(sqlite3?|sqlite-wal|sqlite-shm|db)$/i.test(rel);
  };
  fs.cpSync(root, out, { recursive: true, filter: keep });
  const php = fs.readFileSync(path.join(root, "send.php"), "utf8")
    .replace("__TO__", (config.formTo || config.email || "").replace(/'/g, ""))
    .replace("__BRAND__", config.brand.replace(/'/g, ""));
  fs.writeFileSync(path.join(out, "send.php"), php);
}
