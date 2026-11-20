// Page shell around the designer's page bodies: <head>, header, footer and scripts.
// The header and footer markup come from src/design/_header.html and _footer.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import config from "../config.mjs";
import { LANGS } from "./i18n.mjs";

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

// Messaging channels in the order the design shows them; empty ones are left out everywhere.
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
  // Social icons: only the channels that are set up.
  const ch = channels();
  root.querySelectorAll(".sf-social li").forEach((li) => {
    const a = li.querySelector("a");
    const key = (a.getAttribute("aria-label") || "").toLowerCase();
    if (ch[key]) a.setAttribute("href", ch[key]);
    else li.remove();
  });
  if (!root.querySelector(".sf-social li")) root.querySelector(".sf-social")?.remove();
  // Contact column
  const cis = root.querySelectorAll(".sf-contact .sf-ci");
  const [addr, mail, tel, hours] = cis;
  addr.querySelector("span:last-child").set_content(config.address);
  if (config.email) mail.querySelector(".rv").setAttribute("data-v", seal(config.email));
  else mail.remove();
  if (config.phone) tel.querySelector(".rv").setAttribute("data-v", seal(config.phone));
  else tel.remove();
  if (config.officeHours) hours.querySelector("span:last-child").set_content(config.officeHours);
  else hours.remove();
  // Company line and legal links
  const reg = config.registrationNumber ? ` · <span>Identification code</span> <span translate="no">${config.registrationNumber}</span>` : "";
  root.querySelector(".sf-bottom p").set_content(`© ${new Date().getFullYear()} <span translate="no">${config.legalName}</span>${reg} · ${config.address}`);
  root.querySelector(".sf-legal").set_content(
    `<a href="privacy.html">Privacy</a><a href="terms.html">Booking terms</a><a href="cookies.html">Cookies</a><a href="credits.html">Credits</a>`
  );
  return root.toString();
}

/** Makes the page's relative links work from a subfolder (tours/…, guide/…). */
function rebase(html, root) {
  if (!root) return html;
  return html.replace(/(\s(?:href|src|poster|action|data-src)=")(?![a-z][a-z0-9+.-]*:|#|\/|\.\.\/)([^"]+)"/gi, `$1${root}$2"`);
}

export function layout({ page, title, description, main, scripts = [], rootClass = "", head = "", ogImage = "assets/img/og.jpg", noindex = false }) {
  const depth = page.split("/").length - 1;
  const root = "../".repeat(depth);
  const fullTitle = page === "index.html" ? `${config.brand} · ${title}` : `${title} · ${config.brand}`;
  const url = (lang) => `${config.siteUrl}/${lang === "en" ? "" : lang + "/"}${page === "index.html" ? "" : page}`;
  const alternates = config.siteUrl && page !== "404.html"
    ? LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${url(l.code)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${url("en")}">\n<link rel="canonical" href="${url("en")}">`
    : "";
  const og = config.siteUrl ? `<meta property="og:image" content="${config.siteUrl}/${ogImage}">` : "";
  const cfg = { email: config.email, brand: config.brand };

  const body = `<div id="root"${rootClass ? ` class="${rootClass}"` : ""} style="font-family: Manrope, system-ui, sans-serif; color: #2B2320; background: #FBF6EE;">
<a class="skip" href="#main">Skip to content</a>
${header(page)}
${main}
${footer()}
</div>
${["site.js", ...scripts].map((s) => `<script src="assets/js/${s}" defer></script>`).join("\n")}`;

  const doc = `<!doctype html>
<html lang="en" data-page="${page === "404.html" ? "" : page}" data-site-root="${root}">
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
<link rel="stylesheet" href="assets/css/site.css">
<link rel="stylesheet" href="assets/css/extra.css">
<script>
// Language: a visitor's saved choice wins, otherwise the first browser language the site speaks.
(function(d){var h=d.documentElement;try{var L=${JSON.stringify(LANGS.map((l) => l.code))},want=localStorage.getItem("mfs-lang"),page=h.getAttribute("data-page");
if(!want){var n=navigator.languages||[navigator.language||""];for(var i=0;i<n.length&&!want;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(L.indexOf(c)>-1)want=c}want=want||"en";localStorage.setItem("mfs-lang",want)}
if(page&&want!==h.lang&&L.indexOf(want)>-1)location.replace(h.getAttribute("data-site-root")+(want==="en"?"":want+"/")+page+location.search+location.hash);}catch(e){}})(document);
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
