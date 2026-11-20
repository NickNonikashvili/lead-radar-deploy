// Public addresses. Pages are files in dist/ (about.html, tours/index.html, ru/guide/visa.html), but visitors
// and search engines see clean addresses without ".html": /about, /tours/, /ru/guide/visa. The root .htaccess
// (and scripts/serve.mjs, scripts/router.php) map one to the other.
//
// The page builders keep writing links to files as before ("about.html", "tours.html", "tours/x.html"); the
// build turns every one of them into a clean, relative link at the very end (cleanLinks), so it also covers
// links inside translated text, the header, the footer and the 404 page.
// MFS_HTML_LINKS=1 keeps links to the .html files instead, for previews that can't rewrite addresses.
import path from "node:path";

export const HTML_LINKS = process.env.MFS_HTML_LINKS === "1";

// Pages that moved into a folder of their own (old file → new file).
const MOVED = { "tours.html": "tours/index.html", "travel-guide.html": "guide/index.html" };
const LANG_PREFIX = /^([a-z]{2}\/)?(.*)$/;

/** The file a link to `file` means today ("tours.html" → "tours/index.html", also under ru/ etc.). */
export function movedFile(file) {
  const [, lang = "", rest] = file.match(LANG_PREFIX);
  return MOVED[rest] ? lang + MOVED[rest] : file;
}

/** Public path of a page file, from the site root: "index.html" → "", "tours/index.html" → "tours/", "about.html" → "about". */
export function publicPath(file) {
  file = movedFile(file);
  if (HTML_LINKS) return file;
  if (file === "index.html") return "";
  if (file.endsWith("/index.html")) return file.slice(0, -"index.html".length);
  return file.replace(/\.html$/, "");
}

/** Relative link from the folder `fromDir` ("" = site root) to the public path `to` ("" = home, "x/" = folder). */
function relative(fromDir, to) {
  const dir = to === "" || to.endsWith("/");
  const r = path.posix.relative(fromDir || ".", dir ? to.replace(/\/$/, "") || "." : to);
  return dir ? (r ? r + "/" : "./") : r;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LINK = /(\s(?:href|action)=)(["'])([^"'<>]*)\2/gi;

/**
 * Rewrites every internal link to a page in the finished HTML of `file` (e.g. "ru/tours/index.html") to its
 * clean public address, relative to that file — keeping ?query and #hash. Links that start with "/" (the 404
 * page, which is served at any depth) stay absolute from the site root.
 */
export function cleanLinks(html, file) {
  const fromDir = path.posix.dirname(file) === "." ? "" : path.posix.dirname(file);
  return html.replace(LINK, (m, attr, q, value) => {
    if (!value || value.startsWith("#") || value.startsWith("//") || SCHEME.test(value)) return m;
    const cut = value.search(/[?#]/);
    const pathPart = cut < 0 ? value : value.slice(0, cut);
    const rest = cut < 0 ? "" : value.slice(cut);
    if (!/\.html$/.test(pathPart)) return m;
    const absolute = pathPart.startsWith("/");
    const target = absolute ? pathPart.slice(1) : path.posix.normalize(path.posix.join(fromDir, pathPart));
    if (target.startsWith("..")) return m; // outside the site: not ours to change
    const pub = publicPath(target);
    const link = absolute ? "/" + pub : relative(fromDir, pub);
    return `${attr}${q}${link}${rest}${q}`;
  });
}
