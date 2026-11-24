#!/usr/bin/env node
// Builds the EvoSoft website into ../evosoft-site from the data in ./data, in every language listed in lib/i18n.mjs.
//   node site-builder/build.mjs
// English pages are at the site root; Georgian, Russian and Spanish under /ka/, /ru/ and /es/. Translations live in
// site-builder/i18n/<lang>/*.json (English text → translation). Each build rewrites site-builder/i18n/source.json,
// the list of every string the site uses, and dist/i18n-missing-<lang>.json for any language with gaps.
// Run site-builder/images.mjs first whenever screenshots change (WebP sizes + images.json).
// © 2026 EvoSoft Solutions. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as SRC from './data/site.mjs';
import { products as SRC_PRODUCTS } from './data/products.mjs';
import { icon } from './lib/icons.mjs';
import { logoInline, markInline } from './lib/logo.mjs';
import { knowledgeMarkdown, localKb } from './lib/knowledge.mjs';
import { LANGS, loadDict, makeT, translateData } from './lib/i18n.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../evosoft-site');
const I18N = path.join(HERE, 'i18n');
const DIST = path.resolve(HERE, '../dist');
const TODAY = new Date().toISOString().slice(0, 10);
const SITE_URL = SRC.site.url;

let images = {};
try {
  images = JSON.parse(fs.readFileSync(path.join(HERE, 'data/images.json'), 'utf8'));
} catch {
  console.warn('No data/images.json yet: run node site-builder/images.mjs for WebP sizes.');
}

// ---------- helpers ----------
// The slogan, in the page's language. sloganHtml() splits it into words (each rises in on its own) and lights up
// "evolution" wherever the language puts it.
const slogan = () => site.slogan;
function sloganHtml() {
  const words = t('Your digital {evolution} starts here', undefined, 'the slogan; {evolution} is the word “evolution”, lit up in blue').split(/\s+/);
  return words.map((w, i) => (w.includes('{evolution}')
    ? `<span class="w hl" style="--i:${i}">${esc(w.replace('{evolution}', t('evolution', undefined, 'the word in the slogan “Your digital evolution starts here”')))}</span>`
    : `<span class="w" style="--i:${i}">${esc(w)}</span>`)).join(' ');
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const join = (arr, fn, sep = '') => (arr || []).map(fn).join(sep);
const tel = (p) => 'tel:' + p.replace(/[^+\d]/g, '');
const first = (name) => String(name).split(' ')[0];
const heroShot = (p) => p.shots.find((s) => s.hero) || p.shots.find((s) => !s.phone) || null;
const urlFor = (lang, file) => `${SITE_URL}/${lang.prefix}${file === 'index.html' ? '' : file}`;

// ---------- the language being built ----------
// t(): plain text; h(): HTML-escaped text (placeholders may carry markup). Both translate English into L.
let L = LANGS[0];
let t;
let h;
let DICTS = {};
let site, nav, services, steps_, promises, faq, clients, quoteTypes, quoteTimelines, chat, products;
// The page being built: `up` leads from it to the site root (assets, api), `file` is its name inside the language.
let cur = { up: '', file: 'index.html' };
const A = (p) => cur.up + p;
const abs = (file) => urlFor(L, file);
const webp = (file, w = 800) => A(images[file]?.webp?.includes(w) ? `assets/shots/${file.replace(/\.(jpe?g|png)$/i, '')}-${w}.webp` : `assets/shots/${file}`);

// eager: load first, at high priority. lazy: false loads it with the page without lazy-loading (for images that
// appear without scrolling, like the demo card's other tabs).
function picture(file, { alt = '', sizes = '100vw', eager = false, lazy = true, cls = '' } = {}) {
  const meta = images[file];
  const src = A(`assets/shots/${file}`);
  const dims = meta ? ` width="${meta.w}" height="${meta.h}"` : '';
  const load = eager ? ' fetchpriority="high"' : lazy ? ' loading="lazy"' : ' fetchpriority="low"';
  const img = `<img src="${attr(src)}" alt="${attr(alt)}"${dims}${load} decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  if (!meta?.webp?.length) return img;
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  return `<picture><source type="image/webp" srcset="${attr(meta.webp.map((w) => `${A(`assets/shots/${base}-${w}.webp`)} ${w}w`).join(', '))}" sizes="${attr(sizes)}">${img}</picture>`;
}

// ---------- structured data ----------
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    legalName: site.legalName,
    alternateName: ['EvoSoft Solutions', 'EVOSOFT'],
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/icon-512.png`, width: 512, height: 512 },
    image: `${SITE_URL}/assets/img/og.jpg`,
    slogan: slogan(),
    description: site.description,
    email: site.email,
    telephone: site.phones[0],
    contactPoint: site.phones.map((tp) => ({ '@type': 'ContactPoint', telephone: tp, email: site.email, contactType: 'sales', areaServed: 'Worldwide', availableLanguage: ['English', 'Georgian', 'Russian', 'Spanish'] })),
    address: { '@type': 'PostalAddress', addressCountry: site.countryCode },
    areaServed: 'Worldwide',
    knowsAbout: ['Web development', 'Custom software development', 'Ecommerce development', 'Web application development', 'Point of sale systems', 'Search engine optimisation', 'Graphic design', 'Microsoft 365', 'IT support'],
    makesOffer: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.text } })),
  };
}

function ldFor({ file, title, description, crumbs = [], extra = [] }) {
  const url = abs(file);
  const graph = [
    organization(),
    { '@type': 'WebSite', '@id': SITE_ID, url: SITE_URL, name: site.name, inLanguage: LANGS.map((x) => x.code), publisher: { '@id': ORG_ID }, copyrightHolder: { '@id': ORG_ID }, copyrightYear: site.year },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { '@id': SITE_ID },
      about: { '@id': ORG_ID },
      inLanguage: L.code,
      dateModified: TODAY,
      copyrightHolder: { '@id': ORG_ID },
      copyrightYear: site.year,
      ...(crumbs.length ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    },
    ...(crumbs.length
      ? [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [[t('Home'), 'index.html'], ...crumbs].map(([name, f], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(f) })) }]
      : []),
    ...extra,
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---------- layout ----------
const FONTS = { en: ['inter'], es: ['inter'], ka: ['noto-georgian', 'inter'], ru: ['inter-cyrillic', 'inter'] };

function head({ file, title, description, ogImage, crumbs, ld = [], noindex = false, preload = '' }) {
  const canonical = abs(file);
  const alternates = noindex
    ? ''
    : `${join(LANGS, (x) => `<link rel="alternate" hreflang="${x.code}" href="${attr(urlFor(x, file))}">\n`)}<link rel="alternate" hreflang="x-default" href="${attr(urlFor(LANGS[0], file))}">\n`;
  return `<!doctype html>
<html lang="${L.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${attr(canonical)}">`}
${alternates}<meta name="author" content="${attr(site.legalName)}">
<meta name="copyright" content="${attr(site.copyright)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EvoSoft">
<meta property="og:locale" content="${L.locale}">
${join(LANGS.filter((x) => x !== L), (x) => `<meta property="og:locale:alternate" content="${x.locale}">\n`)}<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(ogImage || `${SITE_URL}/assets/img/og.jpg`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#040507">
<link rel="icon" href="${A('favicon.ico')}" sizes="32x32">
<link rel="icon" href="${A('assets/img/icon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${A('assets/img/icon-180.png')}">
<link rel="manifest" href="${A('site.webmanifest')}">
${join(FONTS[L.code] || FONTS.en, (f) => `<link rel="preload" href="${A(`assets/fonts/${f}.woff2`)}" as="font" type="font/woff2" crossorigin>\n`)}${typeof preload === 'function' ? preload() : preload}<link rel="stylesheet" href="${A('assets/css/site.css')}">
<script>(function(d){d.className+=' js';try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.className+=' motion';var t=localStorage.getItem('evo-theme')}catch(e){}d.setAttribute('data-theme',t==='light'?'light':'dark')})(document.documentElement)</script>
<script type="application/ld+json">${ldFor({ file, title, description, crumbs, extra: ld })}</script>
</head>`;
}

function langLinks(file, cls) {
  const target = file === '404.html' ? 'index.html' : file;
  return join(LANGS, (x) => `<a class="${cls}" href="${attr(A(x.prefix + target))}" hreflang="${x.code}" lang="${x.code}" data-lang="${x.code}"${x === L ? ' aria-current="true"' : ''}><span class="lang-code">${x.short}</span><span class="lang-name">${esc(x.native)}</span></a>`);
}

function header(root, file, active) {
  return `<a class="skip" href="#main">${h('Skip to content')}</a>
<header class="topbar">
  <div class="wrap bar">
    <a class="brand" href="${root}index.html" aria-label="${attr(t('EvoSoft, home'))}">${logoInline}</a>
    <nav class="nav" id="site-nav" aria-label="${attr(t('Main'))}">
      ${join(nav, (n) => `<a href="${root}${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`)}
      <a class="btn primary nav-quote" href="${root}contact.html"${active === 'contact' ? ' aria-current="page"' : ''}>${h('Get a quote')}</a>
      <div class="nav-langs" aria-label="${attr(t('Language'))}">${langLinks(file, 'nav-lang')}</div>
    </nav>
    <div class="lang">
      <button class="icon-btn lang-btn" type="button" aria-expanded="false" aria-controls="lang-menu" aria-label="${attr(t('Language: {name}', { name: L.native }))}" title="${attr(t('Language'))}">${icon('globe')}<span>${L.short}</span></button>
      <div class="lang-menu" id="lang-menu" hidden>${langLinks(file, 'lang-item')}</div>
    </div>
    <button class="icon-btn theme-toggle" type="button" aria-label="${attr(t('Switch between light and dark'))}" title="${attr(t('Light / dark'))}">${icon('sun', 'i i-sun')}${icon('moon', 'i i-moon')}</button>
    <button class="icon-btn menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="${attr(t('Open menu'))}">${icon('menu', 'i i-menu')}${icon('x', 'i i-close')}</button>
  </div>
  <div class="progress" aria-hidden="true"></div>
</header>`;
}

// Strings the page's JavaScript needs, in this language.
function jsStrings() {
  const s = {
    lang: L.code,
    copy: t('copy'),
    copied: t('copied'),
    copyFail: t('Couldn’t copy automatically. Select the text and copy it instead.'),
    copiedLogin: t('Copied {login}. Password: {password}'),
    signInWith: t('Sign in with {login}. Password: {password}'),
    live: t('Live'),
    offline: t('Offline right now'),
    formMissing: t('Please add your name, your email and a few words about the project.'),
    formEmail: t('Please check your email address.'),
    formRate: t('That’s a lot of requests in a short time. Please try again in a few minutes, or email us.'),
    formFail: t('Sorry, your request couldn’t be sent just now. Please try again in a minute, or email us at {email}.'),
    sending: t('Sending…'),
    chatTyping: t('The assistant is typing'),
    chatRate: t('You’re sending messages quickly, so I’ll take a short break. Meanwhile, here’s what I can tell you:'),
    chatNoAi: t('Automatic answers from this website. For anything else, contact us directly.'),
    chatError: t('Sorry, I can’t answer right now. Please email {email}.'),
    teaser: t('Questions? Ask me about our work, the demos or your project.'),
    close: t('Close'),
  };
  // English pages offer the visitor's own language, worded in that language.
  if (L.code === 'en') {
    s.suggest = Object.fromEntries(
      LANGS.filter((x) => x.code !== 'en').map((x) => {
        const tx = (k) => (typeof DICTS[x.code][k] === 'string' ? DICTS[x.code][k] : null);
        return [x.code, { text: tx('Read this site in English'), go: tx('Switch language'), no: tx('No thanks') }];
      }).filter(([, v]) => v.text && v.go && v.no),
    );
    // Make sure these keys are listed for the translators.
    t('Read this site in English', undefined, 'language suggestion (shown in the visitor’s language: means “read this site in YOUR language”)');
    t('Switch language');
    t('No thanks');
  }
  return JSON.stringify(s).replace(/</g, '\\u003c');
}

function footer(root) {
  return `<footer class="footer">
  <div class="wrap">
    <p class="foot-slogan">${sloganHtml()}</p>
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="${root}index.html" aria-label="${attr(t('EvoSoft, home'))}">${logoInline}</a>
        <p>${esc(site.short)}</p>
        <a class="btn primary sm" href="${root}contact.html">${h('Get a free quote')}</a>
      </div>
      <div><h2>${h('Products')}</h2><ul>${join(products, (p) => `<li><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></li>`)}<li><a href="${root}demos.html">${h('All live demos')}</a></li></ul></div>
      <div><h2>${h('Company')}</h2><ul><li><a href="${root}portfolio.html">${h('Work')}</a></li><li><a href="${root}services.html">${h('Services')}</a></li><li><a href="${root}about.html">${h('About')}</a></li><li><a href="${root}legal.html">${h('Copyright & privacy')}</a></li></ul></div>
      <div><h2>${h('Contact')}</h2><ul>${join(site.phones, (p) => `<li><a href="${tel(p)}">${esc(p)}</a></li>`)}<li><a href="mailto:${site.email}">${esc(site.email)}</a></li><li class="muted">${h('Replies {when}', { when: esc(site.responseTime) })}</li></ul></div>
    </div>
    <div class="foot-base">
      <p>${esc(site.copyright)}</p>
      <p class="foot-langs">${langLinks(cur.file, 'foot-lang')}</p>
      <p>${h('Evo, Mailtabs and StudyCat are products of {company}. Demo data is fictional.', { company: esc(site.legalName) })}</p>
    </div>
  </div>
</footer>
<div class="chat" data-endpoint="${A('api/chat.php')}" data-kb="${A(`assets/data/chat-kb.${L.code}.json`)}" data-root="${root}">
  <div class="chat-teaser" hidden><button class="chat-teaser-close" type="button" aria-label="${attr(t('Close'))}">${icon('x')}</button><p></p></div>
  <button class="chat-launch" type="button" aria-expanded="false" aria-controls="chat-panel">${markInline}<span>${h('Ask EvoSoft')}</span></button>
  <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
    <header class="chat-head">
      ${markInline}
      <div><h2 id="chat-title">${esc(chat.name)}</h2><p>${h('Questions about our work, demos or a project')}</p></div>
      <button class="icon-btn chat-close" type="button" aria-label="${attr(t('Close the assistant'))}">${icon('x')}</button>
    </header>
    <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
    <div class="chat-suggest" aria-label="${attr(t('Suggested questions'))}"></div>
    <form class="chat-form">
      <label class="sr-only" for="chat-input">${h('Your question')}</label>
      <textarea id="chat-input" rows="1" maxlength="1000" placeholder="${attr(t('Ask a question'))}" autocomplete="off"></textarea>
      <button type="submit" aria-label="${attr(t('Send'))}">${icon('send')}</button>
    </form>
    <p class="chat-note"><span>${h('An AI assistant answers here, and it can make mistakes. Please don’t share sensitive information.')}</span> <a href="${root}legal.html#privacy">${h('Privacy')}</a></p>
  </section>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<div class="lang-hint" role="dialog" aria-live="polite" hidden><p></p><div><a class="btn primary sm" href="#"></a><button class="btn sm" type="button"></button></div></div>
<dialog class="lightbox" aria-label="${attr(t('Screenshot'))}">
  <button class="icon-btn lb-close" type="button" aria-label="${attr(t('Close'))}">${icon('x')}</button>
  <button class="icon-btn lb-prev" type="button" aria-label="${attr(t('Previous'))}">${icon('chevronLeft')}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="icon-btn lb-next" type="button" aria-label="${attr(t('Next'))}">${icon('chevronRight')}</button>
</dialog>
<script type="application/json" id="evo-i18n">${jsStrings()}</script>
<script src="${A('assets/js/site.js')}" defer></script>
<script src="${A('assets/js/chat.js')}" defer></script>
</body>
</html>`;
}

const built = [];
function page(opts) {
  const { file, active, body, bodyClass = '' } = opts;
  const outFile = L.prefix + file;
  const absolute = opts.root === '/';
  cur = { up: absolute ? '/' : '../'.repeat(outFile.split('/').length - 1), file };
  const root = absolute ? `/${L.prefix}` : '../'.repeat(file.split('/').length - 1);
  const html = `${head(opts)}
<body class="${bodyClass}">
${header(root, file, active)}
<main id="main">
${body(root)}
</main>
${footer(root)}`;
  built.push({ lang: L.code, file, outFile, html: html.replace(/\n\s*\n/g, '\n'), noindex: !!opts.noindex, images: opts.sitemapImages || [] });
}

// ---------- shared blocks ----------
const arrow = '<span class="arr" aria-hidden="true">→</span>';
const ext = '<span class="arr" aria-hidden="true">↗</span>';
// Each product gets its own colour, like StudyCat's classes.
// Product colours: burgundy, neon yellow and off-white, each with the text colour that reads on it.
const TILE = { evo: '#7A0019', mailtabs: '#EEFF00', studycat: '#F2F2EE' };
const TILE_INK = { evo: '#F2F2EE', mailtabs: '#050505', studycat: '#050505' };
const tileColor = (p) => p.tile || TILE[p.slug] || p.accent;
const SVC_ICON = ['globe', 'cart', 'code', 'register', 'layers', 'search', 'pen', 'mail', 'tool'];
const SVC_TONE = ['blue', 'green', 'purple', 'gold', 'teal', 'blue', 'coral', 'purple', 'green'];
const accountsWord = (n) => t.n(n, '{n} demo account', '{n} demo accounts');

const pageHead = (kicker, title, lede, extra = '') => `
<section class="page-head">
  <div class="wrap">
    <p class="chip">${kicker}</p>
    <h1 class="split">${title}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${extra}
  </div>
</section>`;

const secHead = (title, lede = '', center = false) =>
  `<div class="sec-head${center ? ' center' : ''}"><h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;

function statusPill(p) {
  if (!p.demo.url) return `<span class="status" data-state="soon">${h('Coming soon')}</span>`;
  return `<span class="status" data-state="checking" data-status-url="${attr(p.demo.url)}"><i aria-hidden="true"></i><span>${h('Checking')}</span></span>`;
}

const ctaCard = (root, title = h('Have a project in mind?'), text = h('Tell us what you need. Quotes are free, and we reply {when}.', { when: esc(site.responseTime) })) => `
<section class="sec">
  <div class="wrap">
    <div class="cta-card">
      <div>
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
      <div class="cta-actions">
        <a class="btn primary lg" href="${root}contact.html">${h('Get a free quote')} ${arrow}</a>
        <p class="cta-contacts">${join(site.phones, (p) => `<a href="${tel(p)}">${esc(p)}</a>`, ' · ')}<br><a href="mailto:${site.email}">${esc(site.email)}</a></p>
      </div>
    </div>
  </div>
</section>`;

const steps = () => `<ol class="trail">${join(steps_, (s, i) => `<li><span class="trail-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol>`;

function productTile(root, p) {
  const shot = heroShot(p);
  return `<article class="tile" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}">
  <a class="tile-cover" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">
    <span class="tile-tag">${esc(p.category)}</span>
    ${shot ? `<span class="tile-shot">${picture(shot.file, { alt: '', sizes: '(min-width: 1100px) 380px, 90vw' })}</span>` : ''}
  </a>
  <div class="tile-body">
    <h3><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h3>
    <p class="tile-kind">${esc(p.kind)}</p>
    <p class="tile-text">${esc(p.tagline)}</p>
    <p class="tile-meta">${statusPill(p)}<span>${esc(accountsWord(p.demo.accounts.length))}</span></p>
    <div class="tile-actions">
      ${p.demo.url ? `<a class="btn primary sm" href="${attr(p.demo.url)}" target="_blank" rel="noopener">${h('Open demo')} ${ext}</a>` : ''}
      <a class="btn sm" href="${root}work/${p.slug}.html">${h('Case study')}</a>
    </div>
  </div>
</article>`;
}

const yourTile = (root) => `<a class="tile tile-new" href="${root}contact.html">
  <span class="tile-plus" aria-hidden="true">+</span>
  <span class="tile-new-title">${h('Your project')}</span>
  <span class="tile-new-text">${h('Website, store, app or system. Tell us about it and get a free quote.')}</span>
</a>`;

// Logins may wrap after the @ rather than in the middle of a word.
const breakable = (v) => esc(v).replace(/@/g, '@<wbr>');
function copyBtn(value, label) {
  return `<button class="copy" type="button" data-copy="${attr(value)}" aria-label="${attr(label)}"><code>${breakable(value)}</code></button>`;
}

function heroDemoCard(root) {
  return `<div class="demo-card" data-tabs data-autoplay>
  <div class="dc-tabs" role="tablist" aria-label="${attr(t('Live demos'))}">
    ${join(products, (p, i) => `<button class="dc-tab" type="button" role="tab" id="dct-${p.slug}" aria-controls="dcp-${p.slug}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}"><i aria-hidden="true"></i>${esc(p.name)}<b class="dc-progress" aria-hidden="true"></b></button>`)}
  </div>
  ${join(products, (p, i) => {
    const shot = heroShot(p);
    const a = p.demo.accounts[0];
    return `<div class="dc-panel" role="tabpanel" id="dcp-${p.slug}" aria-labelledby="dct-${p.slug}"${i ? ' hidden' : ''}>
    <a class="dc-shot" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">${shot ? picture(shot.file, { alt: '', sizes: '(min-width: 1100px) 560px, 92vw', eager: i === 0, lazy: false }) : ''}<span class="dc-live" aria-hidden="true"><i></i>${h('Live demo')}</span></a>
    <div class="dc-foot">
      <div class="dc-info">
        <p class="dc-title">${esc(p.name)} <span>${esc(p.kind)}</span></p>
        ${a ? `<p class="dc-cred"><span class="muted">${esc(a.role)}:</span> ${copyBtn(a.login, t('Copy {value}', { value: a.login }))} ${copyBtn(a.password, t('Copy the password'))}</p>` : ''}
      </div>
      ${p.demo.url ? `<a class="btn primary sm" href="${attr(p.demo.signinUrl || p.demo.url)}" target="_blank" rel="noopener">${h('Open demo')} ${ext}</a>` : ''}
    </div>
  </div>`;
  })}
</div>`;
}

function accountCards(p) {
  const d = p.demo;
  const signin = d.signinUrl || d.url;
  const loginLabel = d.loginLabel || t('Email');
  const copy = (v, label) => `<button class="copy" type="button" data-copy="${attr(v)}" aria-label="${attr(label)}"><code>${breakable(v)}</code><span class="copy-tag" aria-hidden="true">${icon('copy', 'i i-copy')}${icon('check', 'i i-done')}</span></button>`;
  return `<div class="accts">${join(d.accounts, (a) => `<article class="acct">
    <div class="acct-top"><span class="role">${esc(a.role)}</span>${a.badge ? `<span class="badge">${esc(a.badge)}</span>` : ''}</div>
    ${a.name ? `<h4>${esc(a.name)}</h4>` : ''}
    <dl class="cred">
      <div><dt>${esc(loginLabel)}</dt><dd>${copy(a.login, t('Copy {value}', { value: a.login }))}</dd></div>
      <div><dt>${h('Password')}</dt><dd>${copy(a.password, t('Copy the password'))}</dd></div>
    </dl>
    ${a.tries?.length ? `<ul class="tries">${join(a.tries, (x) => `<li>${esc(x)}</li>`)}</ul>` : ''}
    ${signin && a.signin !== false ? `<a class="btn sm acc-go" href="${attr(signin)}" target="_blank" rel="noopener" data-login="${attr(a.login)}" data-pass="${attr(a.password)}">${h('Sign in as {name}', { name: esc(first(a.name || a.role)) })} ${ext}</a>` : `<p class="muted small">${h('Use it in Mailtabs’ “Add account”.')}</p>`}
  </article>`)}</div>`;
}

function demoNotes(p) {
  const d = p.demo;
  const blocks = [];
  if (d.steps) blocks.push(`<div class="note"><h4>${esc(d.steps.title)}</h4><ol class="steps-list">${join(d.steps.items, (s) => `<li>${esc(s)}</li>`)}</ol></div>`);
  if (d.extras?.length) blocks.push(`<div class="note"><h4>${esc(d.extrasTitle || t('Test data'))}</h4><dl class="kv">${join(d.extras, ([k, v]) => `<div><dt>${esc(k)}</dt><dd>${copyBtn(v, t('Copy {value}', { value: v }))}</dd></div>`)}</dl></div>`);
  const tables = join(d.tables, (tb) => `<div class="note wide"><h4>${esc(tb.title)}</h4>${tb.text ? `<p class="muted">${esc(tb.text)}</p>` : ''}<div class="table-wrap"><table class="table"><thead><tr>${join(tb.columns, (c) => `<th scope="col">${esc(c)}</th>`)}</tr></thead><tbody>${join(tb.rows, (r) => `<tr>${join(r, (c, i) => (i === 0 ? `<td>${copyBtn(c, t('Copy {value}', { value: c }))}</td>` : `<td>${esc(c)}</td>`))}</tr>`)}</tbody></table></div></div>`);
  return blocks.length || tables ? `<div class="notes">${blocks.join('')}${tables}</div>` : '';
}

function demoBlock(root, p, { withTitle = true } = {}) {
  const d = p.demo;
  return `<div class="demo-block" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}">
    <div class="db-head">
      ${withTitle ? `<div class="db-id"><span class="db-dot" aria-hidden="true"></span><div><h3><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h3><p>${esc(p.kind)}</p></div></div>` : ''}
      <p class="db-where">${statusPill(p)}${d.url ? `<a href="${attr(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>` : ''}</p>
      ${d.url ? `<a class="btn primary" href="${attr(d.url)}" target="_blank" rel="noopener">${h('Open the demo')} ${ext}</a>` : ''}
    </div>
    <ul class="db-facts">
      <li>${icon('users')}<span>${esc(d.company)}</span></li>
      ${d.note ? `<li>${icon('info')}<span>${esc(d.note)}</span></li>` : ''}
      <li>${icon('rotate')}<span>${esc(d.resets)}</span></li>
    </ul>
    ${accountCards(p)}
    ${demoNotes(p)}
    <p class="db-copy">${h('{product} © {year} {company}. All rights reserved. Demo data is fictional.', { product: esc(p.name), year: site.year, company: esc(site.legalName) })}</p>
  </div>`;
}

function clientCard(c) {
  return `<article class="client">
    <a class="client-shot" href="${attr(c.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="https://s.wordpress.com/mshots/v1/${encodeURIComponent(c.url)}?w=800&amp;h=500" alt="" width="800" height="500" loading="lazy" decoding="async"><span>${esc(c.name)}</span></a>
    <div class="client-body"><p class="badge">${esc(c.kind)}</p><h3><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)} ${ext}</a></h3><p>${esc(c.text)}</p></div>
  </article>`;
}

// A band of words that scrolls sideways (decoration: the same words are on the page as text).
function marquee() {
  const words = services.flatMap((s) => s.examples);
  const half = Math.ceil(words.length / 2);
  const row = (list, rev) => {
    const items = join(list, (w) => `<span>${esc(w)}</span>`);
    return `<div class="mq-row${rev ? ' rev' : ''}"><div class="mq-track">${items}${items}</div></div>`;
  };
  return `<section class="marquee" aria-hidden="true">${row(words.slice(0, half))}${row(words.slice(half), true)}</section>`;
}

// ---------- pages ----------
function buildPages() {
  const allShots = (p) => p.shots.map((s) => `${SITE_URL}/assets/shots/${s.file}`);
  const totalAccounts = products.reduce((n, p) => n + p.demo.accounts.length, 0);
  const typerWords = [t('websites'), t('online stores'), t('web apps'), t('POS systems'), t('booking systems'), t('dashboards'), t('integrations'), t('business software')];

  page({
    file: 'index.html',
    active: 'home',
    title: site.title,
    description: site.metaDescription,
    bodyClass: 'home',
    sitemapImages: products.map((p) => heroShot(p) && `${SITE_URL}/assets/shots/${heroShot(p).file}`).filter(Boolean),
    preload: () => `<link rel="preload" as="image" type="image/webp" href="${webp(heroShot(products[0]).file)}">\n`,
    body: (root) => `
<section class="hero">
  <img class="monolith" src="${A('assets/img/mark-3d.webp')}" alt="" width="1250" height="1229" fetchpriority="high" decoding="async">
  <div class="wrap hero-center">
    <p class="kicker">${h('Software studio in {region} · Free quotes', { region: esc(site.region) })}</p>
    <h1 class="slogan">${sloganHtml()}</h1>
    <p class="hero-sub">${h('Websites, apps and business software,')} ${h('built to order.')}</p>
    <p class="typer" aria-hidden="true"><span class="typer-pre">${h('We build')}</span> <span class="typer-word" data-words="${attr(JSON.stringify(typerWords))}">${esc(typerWords[0])}</span><span class="caret"></span></p>
    <div class="actions">
      <a class="btn primary lg" href="${root}contact.html">${h('Get a free quote')} ${arrow}</a>
      <a class="btn lg" href="${root}demos.html">${h('Try a live demo')}</a>
    </div>
    <p class="trust">${h('Trusted by {clients}', { clients: join(clients, (c) => `<a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`, ' · ') })}</p>
  </div>
  <div class="scroll-cue" aria-hidden="true"></div>
</section>

<section class="stage">
  <div class="wrap">
    <p class="kicker">${h('Live demos')}</p>
    <p class="stage-lede">${h('We take on projects of any size, from a five-page website to a point-of-sale system, and look after them once they’re live. Don’t take our word for it: sign in to the software we’ve built.')}</p>
    <div class="stage-frame">${heroDemoCard(root)}</div>
  </div>
</section>

<section class="stats-band">
  <div class="wrap stats">
    <div class="stat"><span class="stat-n tone-blue" data-count="${products.length}">${products.length}</span><span class="stat-l">${esc(t.n(products.length, 'live demo you can sign in to', 'live demos you can sign in to'))}</span></div>
    <div class="stat"><span class="stat-n tone-green" data-count="${totalAccounts}">${totalAccounts}</span><span class="stat-l">${esc(t.n(totalAccounts, 'ready-made test account', 'ready-made test accounts'))}</span></div>
    <div class="stat"><span class="stat-n tone-gold" data-count="${services.length}">${services.length}</span><span class="stat-l">${esc(t.n(services.length, 'kind of work under one roof', 'kinds of work under one roof'))}</span></div>
    <div class="stat"><span class="stat-n tone-coral">${h('1 day')}</span><span class="stat-l">${h('to hear back about your project')}</span></div>
  </div>
</section>
${marquee()}

<section class="sec">
  <div class="wrap">
    ${secHead(h('Software we built and run'), h('Our own products, each with a live demo and an account for every role. Open one and click around.'))}
    <div class="tiles">${join(products, (p) => productTile(root, p))}${yourTile(root)}</div>
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    ${secHead(h('Any kind of project, including tech'), h('Most clients start with a website or an online store. Plenty stay for the software, the email setup and the support afterwards.'))}
    <div class="svc-grid">${join(services, (s, i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(SVC_ICON[i % SVC_ICON.length])}</span><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p></article>`)}</div>
    <p class="more"><a class="btn" href="${root}services.html">${h('All services')} ${arrow}</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead(h('How a project works'), h('Four steps, and you always know which one you’re on.'), true)}
    ${steps()}
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    ${secHead(h('Websites we’ve built for clients'))}
    <div class="clients">${join(clients, clientCard)}</div>
  </div>
</section>

<section class="sec">
  <div class="wrap narrow">
    ${secHead(h('Questions people ask'), '', true)}
    <div class="faq">${join(faq.slice(0, 5), (f) => `<details><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div>
  </div>
</section>
${ctaCard(root)}
`,
  });

  page({
    file: 'portfolio.html',
    active: 'portfolio',
    title: t('Our Work: Software Products and Client Websites | EvoSoft'),
    description: t('Software and websites by EvoSoft: Evo (workforce and POS), Mailtabs (email client), StudyCat (study platform) and client sites such as Larifan and IPG.'),
    crumbs: [[t('Work'), 'portfolio.html']],
    sitemapImages: products.flatMap(allShots).slice(0, 12),
    body: (root) => `
${pageHead(h('Our work'), h('Software we built, sites we shipped'), h('Three products we designed, built and run ourselves, each with a live demo, and websites we’ve made for clients.'))}
<section class="sec tight">
  <div class="wrap">
    <div class="work-list">${join(products, (p) => {
      const shot = heroShot(p);
      return `<article class="work-row" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}">
        <a class="work-shot" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">${shot ? picture(shot.file, { alt: '', sizes: '(min-width: 1100px) 640px, 100vw' }) : ''}</a>
        <div class="work-info">
          <p class="chip tone"><span class="dot" aria-hidden="true"></span>${esc(p.category)}</p>
          <h2><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h2>
          <p class="work-tag">${esc(p.tagline)}</p>
          <p>${esc(p.summary)}</p>
          <ul class="checks">${join(p.highlights.slice(0, 3), (x) => `<li>${icon('check')}<span>${esc(x.title)}</span></li>`)}</ul>
          <p class="tile-meta">${statusPill(p)}<span>${esc(accountsWord(p.demo.accounts.length))}</span></p>
          <div class="tile-actions">${p.demo.url ? `<a class="btn primary" href="${attr(p.demo.url)}" target="_blank" rel="noopener">${h('Open demo')} ${ext}</a>` : ''}<a class="btn" href="${root}work/${p.slug}.html">${h('Case study')} ${arrow}</a></div>
        </div>
      </article>`;
    })}</div>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead(h('Client websites'), h('Sites we’ve designed and built for clients in different industries.'))}
    <div class="clients">${join(clients, clientCard)}</div>
  </div>
</section>
${ctaCard(root, h('Want to be next?'))}
`,
  });

  page({
    file: 'demos.html',
    active: 'demos',
    title: t('Live Software Demos with Test Accounts | EvoSoft'),
    description: t('Sign in to live demos of Evo (workforce and POS), Mailtabs (email client) and StudyCat (study platform) with a ready-made test account for every role.'),
    crumbs: [[t('Live demos'), 'demos.html']],
    body: (root) => `
${pageHead(h('Live demos'), h('Try our software before you talk to us'), h('Each demo is a real copy of the product with made-up data. Pick a role, copy its login and open the demo. The demos reset themselves, so you can’t break anything for good.'),
  `<nav class="jump" aria-label="${attr(t('Jump to a demo'))}">${join(products, (p) => `<a href="#${p.slug}" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}"><i aria-hidden="true"></i>${esc(p.name)}</a>`)}</nav>`)}
${join(products, (p, i) => `
<section class="sec${i % 2 ? ' alt' : ''} tight" id="${p.slug}">
  <div class="wrap">${demoBlock(root, p)}</div>
</section>`)}
${ctaCard(root, h('Like what you see?'), h('We can build something like this for your business, or something completely different. Quotes are free.'))}
`,
  });

  const appCategory = { evo: 'BusinessApplication', mailtabs: 'CommunicationApplication', studycat: 'EducationalApplication' };
  const productTitles = {
    evo: t('Evo: Workforce Management and Point of Sale System | EvoSoft'),
    mailtabs: t('Mailtabs: Unified Inbox for All Your Email Accounts | EvoSoft'),
    studycat: t('StudyCat: Study Platform for University Courses | EvoSoft'),
  };
  for (const [idx, p] of products.entries()) {
    const next = products[(idx + 1) % products.length];
    const hero = heroShot(p);
    const desktop = p.shots.filter((s) => s !== hero && !s.phone);
    const phones = p.shots.filter((s) => s.phone);
    const file = `work/${p.slug}.html`;
    const a0 = p.demo.accounts[0];
    page({
      file,
      active: 'portfolio',
      title: productTitles[p.slug] || `${p.name} | EvoSoft`,
      description: p.metaDescription || p.summary,
      ogImage: `${SITE_URL}/assets/shots/${p.og || hero.file}`,
      crumbs: [[t('Work'), 'portfolio.html'], [p.name, file]],
      sitemapImages: allShots(p),
      ld: [{
        '@type': 'SoftwareApplication',
        name: p.name,
        description: p.summary,
        applicationCategory: appCategory[p.slug] || 'BusinessApplication',
        operatingSystem: 'Web browser',
        url: abs(file),
        image: allShots(p).slice(0, 4),
        inLanguage: L.code,
        author: { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
        copyrightHolder: { '@id': ORG_ID },
        copyrightYear: site.year,
        ...(p.live ? { sameAs: [p.live.url] } : {}),
      }],
      bodyClass: 'product',
      body: (root) => `
<section class="p-head" style="--c:${tileColor(p)};--c-ink:${TILE_INK[p.slug] || '#050505'}">
  <div class="wrap">
    <nav class="crumbs" aria-label="${attr(t('Breadcrumb'))}"><a href="${root}portfolio.html">${h('Work')}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(p.name)}</span></nav>
    <div class="p-grid">
      <div class="p-intro">
        <p class="chip tone"><span class="dot" aria-hidden="true"></span>${esc(p.category)} · ${esc(p.kind)}</p>
        <h1 class="split">${esc(p.name)}</h1>
        <p class="p-tag">${esc(p.tagline)}</p>
        <p class="lede">${esc(p.intro)}</p>
        <div class="actions">${p.demo.url ? `<a class="btn primary lg" href="${attr(p.demo.url)}" target="_blank" rel="noopener">${h('Open the live demo')} ${ext}</a>` : ''}<a class="btn lg" href="#demo">${h('Demo accounts')}</a>${p.live ? `<a class="btn lg" href="${attr(p.live.url)}" target="_blank" rel="noopener">${esc(p.live.label)} ${ext}</a>` : ''}</div>
      </div>
      <aside class="p-side">
        <p class="side-title">${h('Live demo')}</p>
        <p class="side-status">${statusPill(p)}</p>
        ${p.demo.url ? `<p class="side-url"><a href="${attr(p.demo.url)}" target="_blank" rel="noopener">${esc(p.demo.label)}</a></p>` : ''}
        <div class="side-stat"><span class="stat-n" data-count="${p.demo.accounts.length}">${p.demo.accounts.length}</span><span>${esc(t.n(p.demo.accounts.length, 'demo account, one per role', 'demo accounts, one per role'))}</span></div>
        ${a0 ? `<p class="side-cred"><span class="muted">${esc(a0.role)}</span>${copyBtn(a0.login, t('Copy {value}', { value: a0.login }))}${copyBtn(a0.password, t('Copy the password'))}</p>` : ''}
        <p class="side-title">${h('Built with')}</p>
        <p class="stack">${join(p.stack, (s) => `<span>${esc(s)}</span>`)}</p>
      </aside>
    </div>
    ${hero ? `<figure class="shot-card hero-shot"><button class="shot" type="button" data-lightbox="${attr(A('assets/shots/' + hero.file))}" data-caption="${attr(hero.caption)}">${picture(hero.file, { alt: hero.caption, sizes: '(min-width: 1240px) 1200px, 100vw', eager: true })}</button><figcaption>${esc(hero.caption)}</figcaption></figure>` : ''}
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead(h('What it does'))}
    <div class="svc-grid three">${join(p.highlights, (x, i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(x.icon)}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`)}</div>
  </div>
</section>

${desktop.length ? `<section class="sec alt">
  <div class="wrap">
    ${secHead(h('A look inside'), h('Real screenshots from the demo. Select one to see it full size.'))}
    <div class="gallery">${join(desktop, (s) => `<figure class="shot-card${s.wide ? ' wide' : ''}"><button class="shot" type="button" data-lightbox="${attr(A('assets/shots/' + s.file))}" data-caption="${attr(s.caption)}">${picture(s.file, { alt: s.caption, sizes: s.wide ? '(min-width: 1240px) 1160px, 100vw' : '(min-width: 1100px) 560px, 100vw' })}</button><figcaption>${esc(s.caption)}${s.as ? `<span class="badge">${esc(s.as)}</span>` : ''}</figcaption></figure>`)}</div>
    ${phones.length ? `<div class="phones-card"><div class="phones-text"><span class="ico tone-blue">${icon('smartphone')}</span><h3>${esc(p.phoneTitle || t('On a phone'))}</h3><p>${esc(p.phoneText || t('The same app, laid out for a small screen.'))}</p></div><div class="phones-shots">${join(phones, (s) => `<figure class="phone"><button class="shot" type="button" data-lightbox="${attr(A('assets/shots/' + s.file))}" data-caption="${attr(s.caption)}">${picture(s.file, { alt: s.caption, sizes: '240px' })}</button><figcaption>${esc(s.caption)}</figcaption></figure>`)}</div></div>` : ''}
  </div>
</section>` : ''}

<section class="sec">
  <div class="wrap">
    ${secHead(h('In detail'))}
    <div class="feat-grid">${join(p.features, (g) => `<div class="feat"><h3>${esc(g.title)}</h3><ul class="checks">${join(g.items, (x) => `<li>${icon('check')}<span>${esc(x)}</span></li>`)}</ul></div>`)}</div>
  </div>
</section>

<section class="sec alt" id="demo">
  <div class="wrap">
    ${secHead(h('Sign in to the {name} demo', { name: esc(p.name) }), h('Every account below works on the live demo. Select a login or password to copy it.'))}
    ${demoBlock(root, p, { withTitle: false })}
  </div>
</section>

${ctaCard(root, h('Need something like {name}?', { name: esc(p.name) }), h('We build business systems, web apps and websites to fit how you actually work. Tell us about your project for a free quote.'))}

<section class="sec tight">
  <div class="wrap"><a class="next-card" href="${root}work/${next.slug}.html" style="--c:${tileColor(next)};--c-ink:${TILE_INK[next.slug] || '#050505'}"><span class="muted">${h('Next product')}</span><span class="next-name">${esc(next.name)}</span><span class="next-tag">${esc(next.tagline)}</span>${arrow}</a></div>
</section>
`,
    });
  }

  page({
    file: 'services.html',
    active: 'services',
    title: t('Web Development, Custom Software and IT Services | EvoSoft Georgia'),
    description: t('Websites, online stores, web apps, business systems, integrations, SEO, branding, Microsoft 365 and IT support from EvoSoft, a development studio in Georgia. Free quotes.'),
    crumbs: [[t('Services'), 'services.html']],
    ld: services.map((s) => ({ '@type': 'Service', name: s.name, description: s.text, provider: { '@id': ORG_ID }, areaServed: 'Worldwide', serviceType: s.name })),
    body: (root) => `
${pageHead(h('Services'), h('Any kind of project, including tech'), h('Websites are where many clients start, but we don’t stop there. If your business needs something built, connected, set up or fixed, one team handles it, and every project starts with a free quote.'))}
<section class="sec tight">
  <div class="wrap">
    <div class="svc-detail">${join(services, (s, i) => `<article class="svc wide"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(SVC_ICON[i % SVC_ICON.length])}</span><div><h2>${esc(s.name)}</h2><p>${esc(s.text)}</p><p class="tags">${join(s.examples, (e) => `<span>${esc(e)}</span>`)}</p></div><a class="btn sm" href="${root}contact.html?need=${encodeURIComponent(SRC.quoteTypes[i] || SRC.quoteTypes[SRC.quoteTypes.length - 1])}">${h('Get a quote')}</a></article>`)}</div>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead(h('Judge the work, not the pitch'), h('These are our own products. Each has a live demo with an account for every role.'))}
    <div class="tiles three">${join(products, (p) => productTile(root, p))}</div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    ${secHead(h('How a project works'), '', true)}
    ${steps()}
  </div>
</section>
${ctaCard(root)}
`,
  });

  page({
    file: 'about.html',
    active: 'about',
    title: t('About EvoSoft: Software Development Studio in Georgia'),
    description: t('EvoSoft Solutions is a software development studio in Georgia building websites, online stores, web apps and business systems, and running its own products.'),
    crumbs: [[t('About'), 'about.html']],
    body: (root) => `
${pageHead(h('About us'), h('A small studio that builds and runs software'), '')}
<section class="sec tight">
  <div class="wrap about-grid">
    <div class="card prose">
      <p class="big">${h('EvoSoft Solutions is a software development studio based in Georgia. We design and build websites, online stores, web apps and business systems, and we look after them once they’re live.')}</p>
      <p>${h('We work with small and medium-sized businesses, startups, shops, schools and independent founders. Most of our work happens remotely over email and calls, so clients don’t need to be nearby.')}</p>
      <p>${h('We also build our own products. {evo} runs time clocks, schedules, payroll and a campus store’s registers. {mailtabs} puts every inbox in one place. {studycat} is a study platform for university courses, live at studycat.org. Running real software keeps us honest about what good software takes, and you can {try}.', {
        evo: `<a href="${root}work/evo.html">Evo</a>`,
        mailtabs: `<a href="${root}work/mailtabs.html">Mailtabs</a>`,
        studycat: `<a href="${root}work/studycat.html">StudyCat</a>`,
        try: `<a href="${root}demos.html">${h('try all three')}</a>`,
      })}</p>
    </div>
    <aside class="card about-side">
      <p class="side-title">${h('Get in touch')}</p>
      ${join(site.phones, (p) => `<p class="big-line"><a href="${tel(p)}">${esc(p)}</a></p>`)}
      <p class="big-line"><a href="mailto:${site.email}">${esc(site.email)}</a></p>
      <p class="muted">${h('Replies {when}.', { when: esc(site.responseTime) })}</p>
      <a class="btn primary" href="${root}contact.html">${h('Get a free quote')}</a>
    </aside>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead(h('What you can expect'), '', true)}
    <div class="svc-grid three">${join(promises, ([pt, pd], i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon('check')}</span><h3>${esc(pt)}</h3><p>${esc(pd)}</p></article>`)}</div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    ${secHead(h('How a project works'), '', true)}
    ${steps()}
  </div>
</section>
${ctaCard(root)}
`,
  });

  page({
    file: 'contact.html',
    active: 'contact',
    title: t('Get a Free Quote for Your Website or Software Project | EvoSoft'),
    description: t('Get a free quote for your website, online store, app or IT project. Call {phone} or email {email}. Replies within one business day.', { phone: site.phones[0], email: site.email }),
    crumbs: [[t('Get a quote'), 'contact.html']],
    ld: [{ '@type': 'FAQPage', inLanguage: L.code, mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }],
    body: (root) => `
${pageHead(h('Get a quote'), h('Tell us about your project'), h('Send a few lines and we’ll reply {when} with questions or a quote. It’s free, and there’s no obligation.', { when: esc(site.responseTime) }))}
<section class="sec tight">
  <div class="wrap quote-grid">
    <form class="card quote" id="quote" action="${A('api/quote.php')}" method="post" data-email="${attr(site.email)}" novalidate>
      <div class="row2">
        <label class="field"><span>${h('Your name')}</span><input name="name" autocomplete="name" required maxlength="100"></label>
        <label class="field"><span>${h('Email')}</span><input name="email" type="email" autocomplete="email" required maxlength="200"></label>
      </div>
      <div class="row2">
        <label class="field"><span>${h('Phone')} <em>${h('optional')}</em></span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
        <label class="field"><span>${h('Company')} <em>${h('optional')}</em></span><input name="company" autocomplete="organization" maxlength="120"></label>
      </div>
      <fieldset class="field">
        <legend>${h('What do you need?')} <em>${h('pick any')}</em></legend>
        <div class="chips">${join(SRC.quoteTypes, (v, i) => `<label class="pick"><input type="checkbox" name="types" value="${attr(v)}"><span>${esc(quoteTypes[i])}</span></label>`)}</div>
      </fieldset>
      <label class="field"><span>${h('Timeline')}</span><select name="timeline">${join(SRC.quoteTimelines, (v, i) => `<option value="${attr(v)}">${esc(quoteTimelines[i])}</option>`)}</select></label>
      <label class="field"><span>${h('About the project')}</span><textarea name="message" rows="6" required maxlength="5000" placeholder="${attr(t('What you need, who it’s for, and any sites or apps you like.'))}"></textarea></label>
      <label class="hp" aria-hidden="true">${h('Leave this empty')} <input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-foot"><button class="btn primary lg" type="submit"><span class="btn-label">${h('Send request')}</span> ${arrow}</button><p class="muted small">${h('We use your details only to answer you.')} <a href="${root}legal.html#privacy">${h('Privacy')}</a></p></div>
      <div class="form-done" hidden><span class="ico tone-green">${icon('check')}</span><h2>${h('Thanks, it’s on its way.')}</h2><p>${h('We’ll reply {when}. If it’s urgent, call {phone}.', { when: esc(site.responseTime), phone: `<a href="${tel(site.phones[0])}">${esc(site.phones[0])}</a>` })}</p></div>
    </form>
    <aside class="quote-side">
      <div class="card"><span class="ico tone-blue">${icon('phone')}</span><h2>${h('Phone')}</h2>${join(site.phones, (p) => `<p class="big-line"><a href="${tel(p)}">${esc(p)}</a></p>`)}</div>
      <div class="card"><span class="ico tone-purple">${icon('mail')}</span><h2>${h('Email')}</h2><p class="big-line"><a href="mailto:${site.email}">${esc(site.email)}</a></p></div>
      <div class="card"><span class="ico tone-green">${icon('clock')}</span><h2>${h('What happens next')}</h2><ol class="steps-list"><li>${h('We read your message and reply {when}.', { when: esc(site.responseTime) })}</li><li>${h('A short call or a few emails to fill in the gaps.')}</li><li>${h('A written quote with the scope, timeline and price.')}</li></ol></div>
    </aside>
  </div>
</section>
<section class="sec alt">
  <div class="wrap narrow">
    ${secHead(h('Questions people ask'), '', true)}
    <div class="faq">${join(faq, (f) => `<details><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div>
  </div>
</section>
`,
  });

  const mail = `<a href="mailto:${site.email}">${esc(site.email)}</a>`;
  page({
    file: 'legal.html',
    active: '',
    title: t('Copyright, Terms of Use and Privacy | EvoSoft'),
    description: t('Copyright notice, terms of use and privacy information for the EvoSoft website, its chat assistant, the quote form and the live software demos.'),
    crumbs: [[t('Copyright & privacy'), 'legal.html']],
    body: () => `
${pageHead(h('Legal'), h('Copyright and privacy'), h('Last updated {date}.', { date: new Intl.DateTimeFormat(L.dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(SRC.site.legalUpdated)) }))}
<section class="sec tight">
  <div class="wrap narrow legal">
    <div class="card prose">
      <h2>${h('Copyright')}</h2>
      <p class="big">${esc(site.copyright)}</p>
      <p>${h('This website and everything on it, including its text, design, logos, graphics, screenshots and code, belongs to {company} unless stated otherwise. Evo, Mailtabs and StudyCat, their names, logos, screenshots and live demos are products of {company}.', { company: esc(site.legalName) })}</p>
      <p>${h('You’re welcome to link to any page. You may not copy, republish, sell or reuse the content, the screenshots or the software shown here, in whole or in part, without our written permission. To ask, email {email}.', { email: mail })}</p>
      <p>${h('Client websites shown in our portfolio belong to their owners and appear here as examples of our work. Other product and company names may be trademarks of their respective owners.')}</p>
      <p>${h('Translations of this website are provided for convenience. If a translation differs from the English text, the English text applies.')}</p>
    </div>
    <div class="card prose">
      <h2>${h('Live demos')}</h2>
      <p>${h('The demos are provided so you can evaluate our software. All people, companies, emails and sales in them are fictional. The demo accounts are shared and the demos reset automatically, so don’t enter real personal information, passwords or payment details. Demos are provided as they are, may be unavailable at times, and may change without notice.')}</p>
    </div>
    <div class="card prose" id="privacy">
      <h2>${h('Privacy')}</h2>
      <p><strong>${h('Quote form.')}</strong> ${h('When you send a quote request we receive your name, email, optional phone and company, and your message. We use them only to reply about your project and keep them as long as needed for that.')}</p>
      <p><strong>${h('Chat assistant.')}</strong> ${h('Questions you type into the assistant are sent to our AI provider (Anthropic) to generate an answer and are not used to identify you. Please don’t share sensitive personal information in the chat.')}</p>
      <p><strong>${h('Cookies.')}</strong> ${h('This site sets no tracking or advertising cookies. It remembers your light or dark preference and your language in your own browser, and the chat keeps the current conversation in your browser tab until you close it.')}</p>
      <p><strong>${h('Your rights.')}</strong> ${h('To see, correct or delete anything you’ve sent us, email {email}.', { email: mail })}</p>
    </div>
  </div>
</section>
`,
  });

  page({
    file: '404.html',
    active: '',
    title: t('Page not found | EvoSoft'),
    description: t('This page does not exist.'),
    root: '/',
    noindex: true,
    body: (root) => `
${pageHead('404', h('This page wandered off'), h('The link may be old, or the page has moved.'), `<div class="actions"><a class="btn primary" href="${root}index.html">${h('Go home')}</a><a class="btn" href="${root}demos.html">${h('Live demos')}</a><a class="btn" href="${root}contact.html">${h('Get a quote')}</a></div>`)}`,
  });
}

// ---------- build every language ----------
const source = new Map();
const report = [];
DICTS = Object.fromEntries(LANGS.map((x) => [x.code, loadDict(I18N, x.code)]));
fs.mkdirSync(path.join(OUT, 'assets/data'), { recursive: true });

for (const lang of LANGS) {
  L = lang;
  const sink = L.code === 'en' ? (key, info) => { if (!source.has(key)) source.set(key, { ctx: info.ctx || cur.file, plural: !!info.plural }); } : null;
  t = makeT(L.code, DICTS[L.code], sink);
  h = t.html;
  const D = translateData({ site: SRC.site, nav: SRC.nav, services: SRC.services, steps: SRC.process, promises: SRC.promises, faq: SRC.faq, clients: SRC.clients, quoteTypes: SRC.quoteTypes, quoteTimelines: SRC.quoteTimelines, chat: SRC.chat, products: SRC_PRODUCTS }, t);
  ({ site, nav, services, steps: steps_, promises, faq, clients, quoteTypes, quoteTimelines, chat, products } = D);
  buildPages();
  cur = { up: '', file: 'chat assistant: built-in answers (Markdown; keep [text](/path) links and **bold**)' };
  const kb = localKb({ site, services, process: steps_, faq, clients, products, chat }, t, L.code);
  fs.writeFileSync(path.join(OUT, `assets/data/chat-kb.${L.code}.json`), JSON.stringify(kb));
  if (L.code !== 'en') report.push([L.code, t.missing]);
}

// ---------- write the pages, with every local file linked by a hash of its contents ----------
// A changed file gets a new address, so browsers never mix a new page with an old stylesheet.
const hashes = new Map();
function hashOf(rel) {
  if (!hashes.has(rel)) {
    const file = path.join(OUT, rel);
    hashes.set(rel, fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10) : null);
  }
  return hashes.get(rel);
}
const ASSET = /((?:\.\.\/)+|\/|(?<=["'\s,(]))((?:assets\/[\w\-./]+\.(?:css|js|json|svg|png|jpe?g|webp|woff2|ico))|favicon\.ico|site\.webmanifest)(?=["'\s,)])/g;
const versioned = (html) => html.replace(ASSET, (m, pre, rel) => {
  const v = hashOf(rel);
  return v ? `${pre}${rel}?v=${v}` : m;
});

// The manifest is written before the pages so they link the current version; its icons carry their own hashes,
// so a changed icon is fetched again instead of being served from a month-long cache.
const manifestIcon = (rel, sizes, type) => ({ src: `/${rel}?v=${hashOf(rel)}`, sizes, type });
fs.writeFileSync(
  path.join(OUT, 'site.webmanifest'),
  JSON.stringify({ name: 'EvoSoft', short_name: 'EvoSoft', start_url: '/', display: 'browser', background_color: '#040507', theme_color: '#040507', icons: [manifestIcon('assets/img/icon-180.png', '180x180', 'image/png'), manifestIcon('assets/img/icon-512.png', '512x512', 'image/png'), manifestIcon('assets/img/icon.svg', 'any', 'image/svg+xml')] }, null, 2) + '\n',
);

for (const p of built) {
  const outFile = path.join(OUT, p.outFile);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, versioned(p.html));
}
for (const x of LANGS.filter((x) => x.prefix)) {
  fs.writeFileSync(path.join(OUT, x.prefix, '.htaccess'), `# ${x.native}: this folder's own "page not found" page. © ${SRC.site.year} EvoSoft Solutions.\nErrorDocument 404 /${x.prefix}404.html\n`);
}

// Old address: prices are gone, quotes replaced them.
fs.writeFileSync(
  path.join(OUT, 'pricing.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Get a quote | EvoSoft</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}/contact.html"><meta http-equiv="refresh" content="0; url=contact.html"></head><body><p>Every project now gets its own free quote: <a href="contact.html">get a quote</a>.</p></body></html>\n`,
);

// ---------- generated files: chat knowledge, sitemap, robots, llms.txt, manifest ----------
const pageList = [
  ['/index.html', 'Home'],
  ['/portfolio.html', 'Work: products and client websites'],
  ['/demos.html', 'Live demos with every test account'],
  ...SRC_PRODUCTS.map((p) => [`/work/${p.slug}.html`, `${p.name} case study`]),
  ['/services.html', 'Services'],
  ['/about.html', 'About EvoSoft'],
  ['/contact.html', 'Get a quote (form, phone, email, FAQ)'],
  ['/legal.html', 'Copyright and privacy'],
];
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'api/knowledge.md'), knowledgeMarkdown({ site: SRC.site, services: SRC.services, process: SRC.process, promises: SRC.promises, faq: SRC.faq, clients: SRC.clients, products: SRC_PRODUCTS, chat: SRC.chat, pages: pageList }));
fs.rmSync(path.join(OUT, 'assets/data/chat-kb.json'), { force: true });

const byFile = new Map();
for (const p of built.filter((b) => !b.noindex)) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...byFile.entries()]
  .flatMap(([file, versions]) => versions.map((p) => {
    const lang = LANGS.find((x) => x.code === p.lang);
    const alts = versions.map((v) => `    <xhtml:link rel="alternate" hreflang="${v.lang}" href="${urlFor(LANGS.find((x) => x.code === v.lang), file)}"/>\n`).join('')
      + `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(LANGS[0], file)}"/>\n`;
    return `  <url>\n    <loc>${urlFor(lang, file)}</loc>\n    <lastmod>${TODAY}</lastmod>\n${alts}${p.images.map((img) => `    <image:image><image:loc>${img}</image:loc></image:image>\n`).join('')}  </url>`;
  }))
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const llms = `# EvoSoft

> ${SRC.site.description}

${SRC.site.legalName} (EvoSoft) is a software development studio based in ${SRC.site.region}, working with clients anywhere. It takes on any kind of project: ${SRC.services.map((s) => s.name.toLowerCase()).join(', ')}. Every project gets a free quote, and the team replies ${SRC.site.responseTime}. Contact: ${SRC.site.email}, ${SRC.site.phones.join(', ')}.

The site is in English, with Georgian (${SITE_URL}/ka/), Russian (${SITE_URL}/ru/) and Spanish (${SITE_URL}/es/) versions of every page.

## Pages

${pageList.map(([p, what]) => `- [${what}](${SITE_URL}${p})`).join('\n')}

## Products with live demos

${SRC_PRODUCTS.map((p) => `- [${p.name}](${SITE_URL}/work/${p.slug}.html): ${p.summary} Live demo: ${p.demo.url || 'coming soon'}. Built by EvoSoft.`).join('\n')}

## Client websites

${SRC.clients.map((c) => `- [${c.name}](${c.url}): ${c.text}`).join('\n')}

${SRC.site.copyright}
`;
fs.writeFileSync(path.join(OUT, 'llms.txt'), llms);


// ---------- translation bookkeeping ----------
fs.mkdirSync(I18N, { recursive: true });
fs.writeFileSync(path.join(I18N, 'source.json'), JSON.stringify([...source.entries()].map(([s, i]) => ({ s, ...(i.plural ? { plural: true } : {}), ctx: i.ctx })), null, 1) + '\n');
fs.mkdirSync(DIST, { recursive: true });
for (const [code] of report) {
  const file = path.join(DIST, `i18n-missing-${code}.json`);
  const missing = [...source.entries()].filter(([k]) => DICTS[code][k] === undefined);
  if (missing.length) fs.writeFileSync(file, JSON.stringify(missing.map(([s, i]) => ({ s, ...(i.plural ? { plural: true } : {}), ctx: i.ctx })), null, 1) + '\n');
  else fs.rmSync(file, { force: true });
  const stale = Object.keys(DICTS[code]).filter((k) => !source.has(k)).length;
  console.log(`${LANGS.find((x) => x.code === code).native}: ${source.size - missing.length}/${source.size} strings translated${missing.length ? ` (missing list: ${path.relative(process.cwd(), file)})` : ''}${stale ? `, ${stale} no longer used` : ''}`);
}
console.log(`Built ${built.length} pages in ${LANGS.length} languages into ${path.relative(process.cwd(), OUT) || OUT}`);
