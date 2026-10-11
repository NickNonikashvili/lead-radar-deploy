import config from "../config.mjs";
import { esc, join } from "./html.mjs";
import { logoMark, wordmark } from "./logo.mjs";
import { icon } from "./icons.mjs";
import { TOURS } from "../data/tours.mjs";

export const NAV = [
  { href: "tours.html", label: "Tours", ka: "ტურები" },
  { href: "destinations.html", label: "Destinations", ka: "მიმართულებები" },
  { href: "history.html", label: "History", ka: "ისტორია" },
  { href: "about.html", label: "About us", ka: "ჩვენ შესახებ" },
  { href: "plan.html", label: "Plan your trip", ka: "დაგეგმე" },
];

const year = new Date().getFullYear();

function header(root, current) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="site-header__inner">
    <a class="brand" href="${root}index.html" aria-label="${config.brand} — home">${logoMark({ className: "brand__mark" })}${wordmark(true)}</a>
    <nav class="nav" aria-label="Main">
      <ul>${join(
        NAV,
        (n) => `<li><a href="${root}${n.href}"${n.href === current ? ' aria-current="page"' : ""}><span>${n.label}</span></a></li>`
      )}</ul>
    </nav>
    <div class="header-tools">
      <label class="currency"><span class="sr-only">Currency</span>
        <select data-currency>${join(Object.keys(config.currencies), (c) => `<option value="${c}">${c}</option>`)}</select>
        ${icon("arrow-down", "icon currency__chev")}
      </label>
      <a class="btn btn--gold btn--sm header-cta" href="${root}contact.html"><span class="btn__label">Plan my journey</span></a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle>
        <span class="sr-only">Menu</span><span class="burger__line"></span><span class="burger__line"></span>
      </button>
    </div>
  </div>
</header>
<div class="menu" id="menu" data-menu hidden>
  <div class="menu__inner">
    <nav aria-label="Mobile">
      <ol class="menu__list">
        <li><a href="${root}index.html"><span class="menu__ka">მთავარი</span>Home</a></li>
        ${join(NAV, (n) => `<li><a href="${root}${n.href}"><span class="menu__ka">${n.ka}</span>${n.label}</a></li>`)}
        <li><a href="${root}contact.html"><span class="menu__ka">კონტაქტი</span>Contact</a></li>
      </ol>
    </nav>
    <div class="menu__foot">
      ${config.email ? `<a href="mailto:${config.email}">${icon("mail")} ${config.email}</a>` : ""}
      ${config.whatsapp ? `<a href="https://wa.me/${config.whatsapp}">${icon("chat")} WhatsApp</a>` : ""}
    </div>
  </div>
</div>`;
}

function footer(root, { cta = true } = {}) {
  return `<footer class="site-footer">
  ${
    cta
      ? `<section class="footer-cta" data-footer-cta>
    <div class="container footer-cta__inner">
      <p class="eyebrow">გზა მშვიდობისა · Have a safe journey</p>
      <h2 class="footer-cta__title" data-split>Take your first step.</h2>
      <p class="footer-cta__text">Tell us when you'd like to come and how you like to travel. We reply personally — usually within a day — with a plan built around you.</p>
      <div class="footer-cta__actions">
        <a class="btn btn--gold btn--lg" href="${root}contact.html"><span class="btn__label">Plan my journey</span><span class="btn__icon">${icon("arrow")}</span></a>
        <a class="btn btn--ghost btn--lg" href="${root}tours.html"><span class="btn__label">Browse tours</span></a>
      </div>
    </div>
  </section>`
      : ""
  }
  <div class="footer-main">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand brand--footer" href="${root}index.html">${logoMark({ className: "brand__mark" })}${wordmark()}</a>
        <p>Private journeys through 1.8 million years of Georgia — planned by a father and son who can't stop showing it off.</p>
        <p class="footer-ka" lang="ka">გამარჯობა!</p>
      </div>
      <div>
        <h3 class="footer-h">Explore</h3>
        <ul class="footer-links">
          ${join(NAV, (n) => `<li><a href="${root}${n.href}">${n.label}</a></li>`)}
          <li><a href="${root}contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h3 class="footer-h">Journeys</h3>
        <ul class="footer-links">${join(TOURS, (t) => `<li><a href="${root}tours/${t.id}.html">${t.name}</a></li>`)}</ul>
      </div>
      <div>
        <h3 class="footer-h">Say hello</h3>
        <ul class="footer-links footer-contact">
          ${config.email ? `<li><a href="mailto:${config.email}">${icon("mail")}<span>${config.email}</span></a></li>` : ""}
          ${config.phone ? `<li><a href="tel:${config.phone.replace(/\s/g, "")}">${icon("phone")}<span>${config.phone}</span></a></li>` : ""}
          ${config.whatsapp ? `<li><a href="https://wa.me/${config.whatsapp}">${icon("chat")}<span>WhatsApp</span></a></li>` : ""}
          ${config.instagram ? `<li><a href="${config.instagram}">${icon("instagram")}<span>Instagram</span></a></li>` : ""}
          ${config.facebook ? `<li><a href="${config.facebook}">${icon("facebook")}<span>Facebook</span></a></li>` : ""}
          ${config.address ? `<li>${icon("pin")}<span>${config.address}</span></li>` : ""}
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>© ${year} ${esc(config.legalName)}${config.registrationNumber ? ` · Reg. no. ${esc(config.registrationNumber)}` : ""}</p>
      <ul>
        <li><a href="${root}privacy.html">Privacy</a></li>
        <li><a href="${root}terms.html">Booking terms</a></li>
        <li><a href="${root}credits.html">Credits & licences</a></li>
      </ul>
    </div>
  </div>
</footer>`;
}

/**
 * Wraps page content in the full document.
 * root: relative path back to the site root ("" or "../"), so the site works from any folder or host.
 */
export function layout({ title, description, root = "", path = "index.html", body, bodyClass = "", headerTheme = "light", cta = true, jsonld, ogImage }) {
  const fullTitle = title ? `${title} · ${config.brand}` : `${config.brand} — ${config.tagline}`;
  const canonical = config.siteUrl ? `${config.siteUrl}/${path === "index.html" ? "" : path}` : "";
  const og = ogImage || "assets/img/og.jpg";
  return `<!doctype html>
<html lang="en" data-tier="explorer" data-currency="EUR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#1b130c">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${config.brand}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${config.siteUrl ? `<meta property="og:image" content="${config.siteUrl}/${og}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/apple-touch-icon.png">
<link rel="preload" href="${root}assets/fonts/cinzel-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/css/main.css">
<script>
(function(d){var h=d.documentElement;h.classList.add("js");
try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)h.classList.add("motion");
var t=localStorage.getItem("mfs-tier"),c=localStorage.getItem("mfs-currency");if(t)h.dataset.tier=t;if(c)h.dataset.currency=c;}catch(e){}
setTimeout(function(){if(!window.__mfsReady)h.classList.remove("motion")},3000);})(document);
window.MFS=${JSON.stringify({ currencies: config.currencies, partyFactors: config.partyFactors, formEndpoint: config.formEndpoint, email: config.email, brand: config.brand })};
</script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body class="${bodyClass}" data-header-theme="${headerTheme}">
${header(root, path)}
<main id="main">
${body}
</main>
${footer(root, { cta })}
<script src="${root}assets/vendor/gsap.min.js" defer></script>
<script src="${root}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="${root}assets/vendor/SplitText.min.js" defer></script>
<script src="${root}assets/vendor/lenis.min.js" defer></script>
<script src="${root}assets/js/main.js" defer></script>
</body>
</html>`;
}
