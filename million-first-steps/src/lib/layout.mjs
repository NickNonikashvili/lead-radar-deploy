// Page shell around the designer's page bodies: <head>, header, footer and scripts.
// The header and footer markup come from src/design/_header.html and _footer.html.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import config from "../config.mjs";
import { LANGS } from "./i18n.mjs";
import { publicPath, HTML_LINKS } from "./urls.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DESIGN = path.join(here, "..", "design");
const read = (f) => fs.readFileSync(path.join(DESIGN, f), "utf8");
export const PARSE = { comment: false, blockTextElements: { script: true, style: true, pre: true, textarea: true } };

/** The designer's "reveal on click" encoding: base64 of the reversed text, so plain scrapers miss it. */
export const seal = (v) => Buffer.from([...String(v)].reverse().join(""), "latin1").toString("base64");

export const ICONS = {
  instagram: `<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>`,
};
export const icons = (html) => html.replace(/\{\{icon:(\w+)\}\}/g, (m, k) => ICONS[k] || "");

// Messaging channels in the order the design shows them. The admin panel can switch them on and off without
// a rebuild (api/live.json, applied by site.js), so channels that aren't set up are built hidden, not left out.
export function channels() {
  const c = config;
  return {
    whatsapp: c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` : "",
    telegram: c.telegram ? (c.telegram.startsWith("http") ? c.telegram : `https://t.me/${c.telegram.replace(/^@/, "")}`) : "",
    signal: c.signal || "",
    email: c.email ? `mailto:${c.email}` : "",
    instagram: c.instagram || "",
    facebook: c.facebook || "",
  };
}

/**
 * Marks one messaging channel for site.js: `item` is what hides (a list item or the link itself), `link` the <a>.
 * Unconfigured channels are rendered hidden, without a link.
 */
export function markChannel(item, link, key) {
  const href = channels()[key];
  item.setAttribute("data-ch", key);
  const text = link.text.trim().toLowerCase();
  if (key !== "email" && (!text || text === key)) link.setAttribute("translate", "no"); // just the brand name
  if (href) link.setAttribute("href", href);
  else {
    link.removeAttribute("href");
    item.setAttribute("hidden", "");
    spriteIcons(item);
  }
}

// Icons of channels that are built hidden live once in assets/img/channels.svg (written by the build), not in
// every page: the hidden item keeps an <svg> that points into that file, which is only drawn if the admin
// panel switches the channel on. Ids are made unique per icon, since one file holds them all.
const SPRITE = new Map();
function spriteIcons(item) {
  item.querySelectorAll("svg").forEach((svg) => {
    const inner = svg.innerHTML;
    const id = "ch-" + crypto.createHash("sha256").update(inner).digest("hex").slice(0, 10);
    SPRITE.set(id, inner.replace(/\sid="([^"]+)"/g, ` id="$1-${id}"`).replace(/(url\(#|href="#)([^)"]+)/g, `$1$2-${id}`));
    svg.set_content(`<use href="assets/img/channels.svg?v=__CHANNELS_V__#${id}"></use>`);
  });
}
/** The shared icon file and its version (for ?v=, so browsers fetch it again when the icons change). */
export function channelSprite() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${[...SPRITE].map(([id, g]) => `<g id="${id}">${g}</g>`).join("")}</defs></svg>\n`;
  return { svg, version: crypto.createHash("sha256").update(svg).digest("hex").slice(0, 10) };
}

/** A list of channels that hides as a whole when none of them is shown. */
export function markChannelList(list) {
  if (!list) return;
  list.setAttribute("data-ch-list", "");
  if (!list.querySelectorAll("[data-ch]").some((el) => !el.hasAttribute("hidden"))) list.setAttribute("hidden", "");
}

/** Contact detail texts as built, so site.js can tell an admin change from the built value (see api/live.json). */
const BUILT_CONTACT = () => ({ address: config.address, officeHours: config.officeHours, legalName: config.legalName, registrationNumber: config.registrationNumber });

// Stylesheets and scripts get ?v=<content hash> so browsers fetch them again after an update.
const ASSETS = path.join(here, "..", "assets");
const versions = new Map();
export function asset(rel) {
  if (!versions.has(rel)) versions.set(rel, crypto.createHash("sha256").update(fs.readFileSync(path.join(ASSETS, rel))).digest("hex").slice(0, 10));
  return `assets/${rel}?v=${versions.get(rel)}`;
}

const NAV = ["tours.html", "discover-georgia.html", "travel-guide.html", "about.html", "contact.html", "partners.html"];
const SECTION = (page) => (page.startsWith("tours/") ? "tours.html" : page.startsWith("guide/") ? "travel-guide.html" : page);

function header(page) {
  const root = parse(read("_header.html"), PARSE);
  root.querySelectorAll("[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
  const cur = SECTION(page);
  if (NAV.includes(cur)) root.querySelectorAll(`a[href="${cur}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
  // One button per language the site has, in its own script.
  const list = root.querySelector(".sh-lang-list");
  list.set_content(
    LANGS.map((l) => `<li><button type="button" lang="${l.code}" data-lang="${l.code}" aria-pressed="${l.code === "en"}" translate="no">${l.name}<small>${l.code.toUpperCase()}</small></button></li>`).join("")
  );
  const btn = root.querySelector(".sh-lang-btn");
  btn.setAttribute("aria-label", "Language");
  btn.setAttribute("translate", "no");
  root.querySelector(".brand").setAttribute("translate", "no");
  return root.toString();
}

function footer() {
  const root = parse(icons(read("_footer.html")), PARSE);
  root.querySelector(".brand").setAttribute("translate", "no");
  // Social icons: one per channel, hidden when it isn't set up.
  root.querySelectorAll(".sf-social li").forEach((li) => {
    const a = li.querySelector("a");
    markChannel(li, a, (a.getAttribute("aria-label") || "").toLowerCase());
  });
  markChannelList(root.querySelector(".sf-social"));
  // Contact column: every row is built, empty ones hidden, so the admin panel can fill them in later.
  const [addr, mail, tel, hours] = root.querySelectorAll(".sf-contact .sf-ci");
  liveText(addr, addr.querySelector("span:last-child"), "address", config.address);
  liveReveal(mail, mail.querySelector(".rv"), "email", config.email);
  liveReveal(tel, tel.querySelector(".rv"), "phone", config.phone);
  liveText(hours, hours.querySelector("span:last-child"), "officeHours", config.officeHours);
  // Company line and legal links
  const wrap = (v, html) => `<span data-live-wrap${v ? "" : " hidden"}>${html}</span>`;
  root.querySelector(".sf-bottom p").set_content(
    `© ${new Date().getFullYear()} <span translate="no" data-live="legalName">${esc(config.legalName)}</span>` +
      wrap(config.registrationNumber, ` · <span>Identification code</span> <span translate="no" data-live="registrationNumber">${esc(config.registrationNumber)}</span>`) +
      wrap(config.address, ` · <span data-live="address">${esc(config.address)}</span>`)
  );
  root.querySelector(".sf-legal").set_content(
    `<a href="privacy.html">Privacy</a><a href="terms.html">Booking terms</a><a href="cookies.html">Cookies</a><a href="credits.html">Credits</a>`
  );
  return root.toString();
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A contact text the admin panel can change: `el` shows it, `wrap` is the row that hides when it's empty. */
export function liveText(wrap, el, key, value) {
  el.setAttribute("data-live", key);
  el.set_content(esc(value));
  if (wrap !== el) wrap.setAttribute("data-live-wrap", "");
  else el.setAttribute("data-live-wrap", "");
  if (!value) wrap.setAttribute("hidden", "");
}

/** The email or phone "Show …" reveal (sealed in data-v), with the row that hides when it's empty. */
export function liveReveal(wrap, rv, key, value) {
  rv.setAttribute("data-live", key);
  rv.setAttribute("data-v", value ? seal(value) : "");
  if (wrap !== rv) wrap.setAttribute("data-live-wrap", "");
  else rv.setAttribute("data-live-wrap", "");
  if (!value) wrap.setAttribute("hidden", "");
}

/** Makes the page's relative links work from a subfolder (tours/…, guide/…). */
function rebase(html, root) {
  if (!root) return html;
  return html.replace(/(\s(?:href|src|poster|action|data-src)=")(?![a-z][a-z0-9+.-]*:|#|\/|\.\.\/)([^"]+)"/gi, `$1${root}$2"`);
}

export function layout({ page, title, description, main, scripts = [], rootClass = "", head = "", ogImage = "assets/img/og.jpg", noindex = false, data = {} }) {
  const depth = page.split("/").length - 1;
  // The 404 page is served at any address, so its links start at the site root.
  const notFound = page === "404.html";
  const root = notFound ? "/" : "../".repeat(depth);
  const fullTitle = page === "index.html" ? `${config.brand} · ${title}` : `${title} · ${config.brand}`;
  const url = (lang) => `${config.siteUrl}/${lang === "en" ? "" : lang + "/"}${publicPath(page)}`;
  const alternates = config.siteUrl && !notFound
    ? LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${url(l.code)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${url("en")}">\n<link rel="canonical" href="${url("en")}">`
    : "";
  const og = config.siteUrl ? `<meta property="og:image" content="${config.siteUrl}/${ogImage}">${notFound ? "" : `\n<meta property="og:url" content="${url("en")}">`}` : "";
  // MFS_HTML_LINKS builds are for static previews: no server to load settings from or count visits.
  const cfg = { email: config.email, brand: config.brand, c: BUILT_CONTACT(), ...(HTML_LINKS ? { noServer: true } : {}), ...data };

  const body = `<div id="root"${rootClass ? ` class="${rootClass}"` : ""} style="font-family: Manrope, system-ui, sans-serif; color: #2B2320; background: #FBF6EE;">
<a class="skip" href="#main">Skip to content</a>
<div class="site-notice" role="status" hidden><div class="site-notice-in"><p class="site-notice-t" translate="no"></p><button type="button" class="site-notice-x" aria-label="Close"><span aria-hidden="true">✕</span></button></div></div>
${HTML_LINKS ? "" : `<script>(function(n,b){if(n&&b){b.querySelector(".site-notice-t").textContent=n[0];b.setAttribute("data-id",n[1]);b.hidden=false}})(window.MFS_NOTICE,document.querySelector(".site-notice"))</script>`}
${header(page)}
<script>(function(h,i){if(!i)return;function o(){return i.scrollWidth>i.clientWidth+1}function f(){var c=h.classList;c.remove("sh-tight","sh-narrow");if(innerWidth<=1140||!o())return;c.add("sh-tight");if(o()){c.remove("sh-tight");c.add("sh-narrow")}}f();addEventListener("resize",f);if(document.fonts)document.fonts.ready.then(f)})(document.documentElement,document.querySelector(".sh-in"))</script>
${main}
${footer()}
</div>
${["site.js", ...scripts].map((s) => `<script src="${asset("js/" + s)}" defer></script>`).join("\n")}`;

  const doc = `<!doctype html>
<html lang="en"${notFound ? "" : ` data-page="${publicPath(page)}"`} data-site-root="${root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#FBF6EE">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="${config.brand}">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
${og}
${alternates}
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preload" href="assets/fonts/fraunces-latin-standard-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset("css/site.css")}">
<link rel="stylesheet" href="${asset("css/extra.css")}">
<script>
// Language: a visitor's saved choice wins, otherwise the first browser language the site speaks. Only the
// English addresses move to it: an address in another language (/ru/…, from a link or a search result) was
// asked for and stays, so search engines see each language at its own address. Not for search engines.
(function(d){var h=d.documentElement,r=h.getAttribute("data-site-root")||"";try{var L=${JSON.stringify(LANGS.map((l) => l.code))},want=localStorage.getItem("mfs-lang"),page=h.getAttribute("data-page");
if(!want){var n=navigator.languages||[navigator.language||""];for(var i=0;i<n.length&&!want;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(L.indexOf(c)>-1)want=c}want=want||"en";localStorage.setItem("mfs-lang",want)}
if(page!=null&&h.lang==="en"&&want!=="en"&&L.indexOf(want)>-1&&!/bot|crawl|spider|slurp|preview|lighthouse/i.test(navigator.userAgent||"")){location.replace(r+want+"/"+page+location.search+location.hash);return}}catch(e){}
${HTML_LINKS ? "" : `// Then the settings the owners changed in the admin panel start loading (api/live.json, applied by site.js).
// The copy kept for this visit is used before the first paint: its hidden tours and its notice are there at
// once, and prices, contact details and channels wait for site.js (html.mfs-pending), so the values the page
// was built with never flash. On the first page of a visit they, and the tour cards (one may be hidden), wait
// for the file, two seconds at most.
var w=0,c=null;try{c=JSON.parse(sessionStorage.getItem("mfs-live")||"null");if(c&&typeof c==="object"){w=3000;var css="";(Array.isArray(c.hidden)?c.hidden:[]).forEach(function(x){if(/^[a-z0-9-]+$/.test(x))css+='[data-tour-card="'+x+'"]{display:none!important}[data-tour-unavailable="'+x+'"][hidden]{display:block!important}'});
if(css){var s=d.createElement("style");s.id="mfs-live-pre";s.textContent=css;d.head.appendChild(s)}
var o=c.notice&&typeof c.notice==="object"?c.notice:{},p=function(l){return typeof o[l]==="string"?o[l].trim():""},m=p(h.lang)||p("en");
if(m){for(var k=5381,i=0,j=JSON.stringify(o);i<j.length;i++)k=((k<<5)+k+j.charCodeAt(i))|0;k=(k>>>0).toString(36);var x=null;try{x=localStorage.getItem("mfs-notice")}catch(e){}if(x!==k)window.MFS_NOTICE=[m,k]}}else c=null}catch(e){c=null}
try{if(window.fetch&&location.protocol!=="file:"){window.MFS_LIVE=fetch(r+"api/live.json",{cache:"no-cache",credentials:"omit"}).then(function(x){return x.ok?x.json():null}).catch(function(){return null});
if(!c){w=2000;h.classList.add("mfs-first");window.MFS_LIVE.then(function(j){if(!j||typeof j!=="object"||!Object.keys(j).some(function(k){return k!=="rev"}))h.classList.remove("mfs-pending")})}}}catch(e){}
if(w){h.classList.add("mfs-pending");setTimeout(function(){h.classList.remove("mfs-pending")},w)}`}})(document);
window.MFS=${JSON.stringify(cfg)};
window.MFS.t={};
</script>
${head}
</head>
<body>
${body}
</body>
</html>
`.replace(/\n{2,}/g, "\n");
  return rebase(doc, root);
}
