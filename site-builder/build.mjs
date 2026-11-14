#!/usr/bin/env node
// Builds the EvoSoft website into ../evosoft-site from the data in ./data. No dependencies:
//   node site-builder/build.mjs
// Run site-builder/images.mjs first whenever screenshots change (WebP sizes + images.json).
// © 2026 EvoSoft Solutions. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, nav, services, process as steps_, promises, faq, clients, quoteTypes, quoteTimelines, chat } from './data/site.mjs';
import { products } from './data/products.mjs';
import { icon } from './lib/icons.mjs';
import { logoInline, markInline } from './lib/logo.mjs';
import { knowledgeMarkdown, localKb } from './lib/knowledge.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../evosoft-site');
const BUILD = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const TODAY = new Date().toISOString().slice(0, 10);

let images = {};
try {
  images = JSON.parse(fs.readFileSync(path.join(HERE, 'data/images.json'), 'utf8'));
} catch {
  console.warn('No data/images.json yet: run node site-builder/images.mjs for WebP sizes.');
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const join = (arr, fn, sep = '') => (arr || []).map(fn).join(sep);
const tel = (p) => 'tel:' + p.replace(/[^+\d]/g, '');
const first = (name) => String(name).split(' ')[0];
const pad = (n) => String(n).padStart(2, '0');
const abs = (p) => `${site.url}/${p === 'index.html' ? '' : p}`;
const heroShot = (p) => p.shots.find((s) => s.hero) || p.shots.find((s) => !s.phone) || null;
const phoneShot = (p) => p.shots.find((s) => s.phone) || null;
const webp = (file, w = 800) => (images[file]?.webp?.includes(w) ? `assets/shots/${file.replace(/\.(jpe?g|png)$/i, '')}-${w}.webp` : `assets/shots/${file}`);

function picture(root, file, { alt = '', sizes = '100vw', eager = false, cls = '' } = {}) {
  const meta = images[file];
  const src = `${root}assets/shots/${file}`;
  const dims = meta ? ` width="${meta.w}" height="${meta.h}"` : '';
  const load = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  const img = `<img src="${attr(src)}" alt="${attr(alt)}"${dims}${load} decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  if (!meta?.webp?.length) return img;
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  return `<picture><source type="image/webp" srcset="${attr(meta.webp.map((w) => `${root}assets/shots/${base}-${w}.webp ${w}w`).join(', '))}" sizes="${attr(sizes)}">${img}</picture>`;
}

// ---------- structured data ----------
const ORG_ID = `${site.url}/#organization`;
const SITE_ID = `${site.url}/#website`;
const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: site.name,
  legalName: site.legalName,
  alternateName: ['EvoSoft Solutions', 'EVOSOFT'],
  url: site.url,
  logo: { '@type': 'ImageObject', url: `${site.url}/assets/img/icon-512.png`, width: 512, height: 512 },
  image: `${site.url}/assets/img/og.jpg`,
  description: site.description,
  email: site.email,
  telephone: site.phones[0],
  contactPoint: site.phones.map((t) => ({ '@type': 'ContactPoint', telephone: t, email: site.email, contactType: 'sales', areaServed: 'Worldwide' })),
  address: { '@type': 'PostalAddress', addressCountry: site.countryCode },
  areaServed: 'Worldwide',
  knowsAbout: ['Web development', 'Custom software development', 'Ecommerce development', 'Web application development', 'Point of sale systems', 'Search engine optimisation', 'Graphic design', 'Microsoft 365', 'IT support'],
  makesOffer: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.text } })),
};
const website = { '@type': 'WebSite', '@id': SITE_ID, url: site.url, name: site.name, inLanguage: 'en', publisher: { '@id': ORG_ID }, copyrightHolder: { '@id': ORG_ID }, copyrightYear: site.year };

function ldFor({ file, title, description, crumbs = [], extra = [] }) {
  const url = abs(file);
  const graph = [
    organization,
    website,
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { '@id': SITE_ID },
      about: { '@id': ORG_ID },
      inLanguage: 'en',
      dateModified: TODAY,
      copyrightHolder: { '@id': ORG_ID },
      copyrightYear: site.year,
      ...(crumbs.length ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    },
    ...(crumbs.length
      ? [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [['Home', 'index.html'], ...crumbs].map(([name, f], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(f) })) }]
      : []),
    ...extra,
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---------- layout ----------
function head({ file, title, description, root, ogImage, crumbs, ld = [], noindex = false, preload = '' }) {
  const canonical = abs(file);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${attr(canonical)}">`}
<meta name="author" content="${attr(site.legalName)}">
<meta name="copyright" content="${attr(site.copyright)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EvoSoft">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(ogImage || `${site.url}/assets/img/og.jpg`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F7FB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D1626" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${root}favicon.ico" sizes="32x32">
<link rel="icon" href="${root}assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/icon-180.png">
<link rel="manifest" href="${root}site.webmanifest">
<link rel="preload" href="${root}assets/fonts/gabarito.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="${root}assets/css/site.css?v=${BUILD}">
<script>try{var t=localStorage.getItem('evo-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">${ldFor({ file, title, description, crumbs, extra: ld })}</script>
</head>`;
}

function header(root, active) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="wrap bar">
    <a class="brand" href="${root}index.html" aria-label="EvoSoft, home">${logoInline}</a>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${join(nav, (n) => `<a href="${root}${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`)}
      <a class="btn primary nav-quote" href="${root}contact.html"${active === 'contact' ? ' aria-current="page"' : ''}>Get a quote</a>
    </nav>
    <button class="icon-btn theme-toggle" type="button" aria-label="Switch between light and dark" title="Light / dark">${icon('sun', 'i i-sun')}${icon('moon', 'i i-moon')}</button>
    <button class="icon-btn menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">${icon('menu', 'i i-menu')}${icon('x', 'i i-close')}</button>
  </div>
</header>`;
}

function footer(root) {
  return `<footer class="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="${root}index.html" aria-label="EvoSoft, home">${logoInline}</a>
        <p>${esc(site.short)}</p>
        <a class="btn primary sm" href="${root}contact.html">Get a free quote</a>
      </div>
      <div><h2>Products</h2><ul>${join(products, (p) => `<li><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></li>`)}<li><a href="${root}demos.html">All live demos</a></li></ul></div>
      <div><h2>Company</h2><ul><li><a href="${root}portfolio.html">Work</a></li><li><a href="${root}services.html">Services</a></li><li><a href="${root}about.html">About</a></li><li><a href="${root}legal.html">Copyright &amp; privacy</a></li></ul></div>
      <div><h2>Contact</h2><ul>${join(site.phones, (p) => `<li><a href="${tel(p)}">${esc(p)}</a></li>`)}<li><a href="mailto:${site.email}">${esc(site.email)}</a></li><li class="muted">Replies ${esc(site.responseTime)}</li></ul></div>
    </div>
    <div class="foot-base">
      <p>${esc(site.copyright)}</p>
      <p>Evo, Mailtabs and StudyCat are products of ${esc(site.legalName)}. Demo data is fictional.</p>
    </div>
  </div>
</footer>
<div class="chat" data-endpoint="${root}api/chat.php" data-kb="${root}assets/data/chat-kb.json?v=${BUILD}" data-root="${root}">
  <button class="chat-launch" type="button" aria-expanded="false" aria-controls="chat-panel">${markInline}<span>Ask EvoSoft</span></button>
  <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
    <header class="chat-head">
      ${markInline}
      <div><h2 id="chat-title">${esc(chat.name)}</h2><p>Questions about our work, demos or a project</p></div>
      <button class="icon-btn chat-close" type="button" aria-label="Close the assistant">${icon('x')}</button>
    </header>
    <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
    <div class="chat-suggest" aria-label="Suggested questions"></div>
    <form class="chat-form">
      <label class="sr-only" for="chat-input">Your question</label>
      <textarea id="chat-input" rows="1" maxlength="1000" placeholder="Ask a question" autocomplete="off"></textarea>
      <button type="submit" aria-label="Send">${icon('send')}</button>
    </form>
    <p class="chat-note">An AI assistant answers here, and it can make mistakes. Please don’t share sensitive information. <a href="${root}legal.html#privacy">Privacy</a></p>
  </section>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<dialog class="lightbox" aria-label="Screenshot">
  <button class="icon-btn lb-close" type="button" aria-label="Close">${icon('x')}</button>
  <button class="icon-btn lb-prev" type="button" aria-label="Previous">${icon('chevronLeft')}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="icon-btn lb-next" type="button" aria-label="Next">${icon('chevronRight')}</button>
</dialog>
<script src="${root}assets/js/site.js?v=${BUILD}" defer></script>
<script src="${root}assets/js/chat.js?v=${BUILD}" defer></script>
</body>
</html>`;
}

const pages = [];
function page(opts) {
  const { file, active, body, bodyClass = '' } = opts;
  const depth = file.split('/').length - 1;
  const root = opts.root ?? (depth ? '../'.repeat(depth) : '');
  const html = `${head({ ...opts, root })}
<body class="${bodyClass}">
${header(root, active)}
<main id="main">
${body(root)}
</main>
${footer(root)}`;
  const outFile = path.join(OUT, file);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html.replace(/\n\s*\n/g, '\n'));
  pages.push({ file, noindex: !!opts.noindex, images: opts.sitemapImages || [] });
}

// ---------- shared blocks ----------
const arrow = '<span class="arr" aria-hidden="true">→</span>';
const ext = '<span class="arr" aria-hidden="true">↗</span>';
// Each product gets its own colour, like StudyCat's classes.
const TILE = { evo: '#4F46E5', mailtabs: '#0F766E', studycat: '#1A64D6' };
const tileColor = (p) => p.tile || TILE[p.slug] || p.accent;
const SVC_ICON = ['globe', 'cart', 'code', 'register', 'layers', 'search', 'pen', 'mail', 'tool'];
const SVC_TONE = ['blue', 'green', 'purple', 'gold', 'teal', 'blue', 'coral', 'purple', 'green'];
const totalAccounts = products.reduce((n, p) => n + p.demo.accounts.length, 0);

const pageHead = (kicker, title, lede, extra = '') => `
<section class="page-head">
  <div class="wrap">
    <p class="chip">${esc(kicker)}</p>
    <h1>${title}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${extra}
  </div>
</section>`;

const secHead = (title, lede = '', center = false) =>
  `<div class="sec-head${center ? ' center' : ''}"><h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;

function statusPill(p) {
  if (!p.demo.url) return `<span class="status" data-state="soon">Coming soon</span>`;
  return `<span class="status" data-state="checking" data-status-url="${attr(p.demo.url)}"><i aria-hidden="true"></i><span>Checking</span></span>`;
}

const ctaCard = (root, title = 'Have a project in mind?', text = `Tell us what you need. Quotes are free, and we reply ${site.responseTime}.`) => `
<section class="sec">
  <div class="wrap">
    <div class="cta-card">
      <div>
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
      </div>
      <div class="cta-actions">
        <a class="btn primary lg" href="${root}contact.html">Get a free quote ${arrow}</a>
        <p class="cta-contacts">${join(site.phones, (p) => `<a href="${tel(p)}">${esc(p)}</a>`, ' · ')}<br><a href="mailto:${site.email}">${esc(site.email)}</a></p>
      </div>
    </div>
  </div>
</section>`;

function steps() {
  return `<ol class="trail">${join(stepsData, (s, i) => `<li><span class="trail-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol>`;
}

function productTile(root, p) {
  const shot = heroShot(p);
  return `<article class="tile" style="--c:${tileColor(p)}">
  <a class="tile-cover" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">
    <span class="tile-tag">${esc(p.category)}</span>
    ${shot ? `<span class="tile-shot">${picture(root, shot.file, { alt: '', sizes: '(min-width: 1100px) 380px, 90vw' })}</span>` : ''}
  </a>
  <div class="tile-body">
    <h3><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h3>
    <p class="tile-kind">${esc(p.kind)}</p>
    <p class="tile-text">${esc(p.tagline)}</p>
    <p class="tile-meta">${statusPill(p)}<span>${p.demo.accounts.length} demo account${p.demo.accounts.length === 1 ? '' : 's'}</span></p>
    <div class="tile-actions">
      ${p.demo.url ? `<a class="btn primary sm" href="${attr(p.demo.url)}" target="_blank" rel="noopener">Open demo ${ext}</a>` : ''}
      <a class="btn sm" href="${root}work/${p.slug}.html">Case study</a>
    </div>
  </div>
</article>`;
}

const yourTile = (root) => `<a class="tile tile-new" href="${root}contact.html">
  <span class="tile-plus" aria-hidden="true">+</span>
  <span class="tile-new-title">Your project</span>
  <span class="tile-new-text">Website, store, app or system. Tell us about it and get a free quote.</span>
</a>`;

function heroDemoCard(root) {
  return `<div class="demo-card" data-tabs>
  <div class="dc-tabs" role="tablist" aria-label="Live demos">
    ${join(products, (p, i) => `<button class="dc-tab" type="button" role="tab" id="dct-${p.slug}" aria-controls="dcp-${p.slug}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" style="--c:${tileColor(p)}"><i aria-hidden="true"></i>${esc(p.name)}</button>`)}
  </div>
  ${join(products, (p, i) => {
    const shot = heroShot(p);
    const a = p.demo.accounts[0];
    return `<div class="dc-panel" role="tabpanel" id="dcp-${p.slug}" aria-labelledby="dct-${p.slug}"${i ? ' hidden' : ''}>
    <a class="dc-shot" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">${shot ? picture(root, shot.file, { alt: '', sizes: '(min-width: 1100px) 560px, 92vw', eager: i === 0 }) : ''}</a>
    <div class="dc-foot">
      <div class="dc-info">
        <p class="dc-title">${esc(p.name)} <span>${esc(p.kind)}</span></p>
        ${a ? `<p class="dc-cred"><span class="muted">${esc(a.role)}:</span> <button class="copy" type="button" data-copy="${attr(a.login)}" aria-label="Copy ${attr(a.login)}"><code>${esc(a.login)}</code></button> <button class="copy" type="button" data-copy="${attr(a.password)}" aria-label="Copy the password"><code>${esc(a.password)}</code></button></p>` : ''}
      </div>
      ${p.demo.url ? `<a class="btn primary sm" href="${attr(p.demo.signinUrl || p.demo.url)}" target="_blank" rel="noopener">Open demo ${ext}</a>` : ''}
    </div>
  </div>`;
  })}
</div>`;
}

function accountCards(p) {
  const d = p.demo;
  const signin = d.signinUrl || d.url;
  const loginLabel = d.loginLabel || 'Email';
  const copy = (v, what) => `<button class="copy" type="button" data-copy="${attr(v)}" aria-label="Copy ${attr(what)} ${attr(v)}"><code>${esc(v)}</code><span class="copy-tag" aria-hidden="true">copy</span></button>`;
  return `<div class="accts">${join(d.accounts, (a) => `<article class="acct">
    <div class="acct-top"><span class="role">${esc(a.role)}</span>${a.badge ? `<span class="badge">${esc(a.badge)}</span>` : ''}</div>
    ${a.name ? `<h4>${esc(a.name)}</h4>` : ''}
    <dl class="cred">
      <div><dt>${esc(loginLabel)}</dt><dd>${copy(a.login, loginLabel.toLowerCase())}</dd></div>
      <div><dt>Password</dt><dd>${copy(a.password, 'password')}</dd></div>
    </dl>
    ${a.tries?.length ? `<ul class="tries">${join(a.tries, (t) => `<li>${esc(t)}</li>`)}</ul>` : ''}
    ${signin && a.signin !== false ? `<a class="btn sm acc-go" href="${attr(signin)}" target="_blank" rel="noopener" data-login="${attr(a.login)}" data-pass="${attr(a.password)}">Sign in as ${esc(first(a.name || a.role))} ${ext}</a>` : '<p class="muted small">Use it in Mailtabs’ “Add account”.</p>'}
  </article>`)}</div>`;
}

function demoNotes(p) {
  const d = p.demo;
  const blocks = [];
  if (d.steps) blocks.push(`<div class="note"><h4>${esc(d.steps.title)}</h4><ol class="steps-list">${join(d.steps.items, (s) => `<li>${esc(s)}</li>`)}</ol></div>`);
  if (d.extras?.length) blocks.push(`<div class="note"><h4>${esc(d.extrasTitle || 'Test data')}</h4><dl class="kv">${join(d.extras, ([k, v]) => `<div><dt>${esc(k)}</dt><dd><button class="copy" type="button" data-copy="${attr(v)}" aria-label="Copy ${attr(v)}"><code>${esc(v)}</code></button></dd></div>`)}</dl></div>`);
  const tables = join(d.tables, (t) => `<div class="note wide"><h4>${esc(t.title)}</h4>${t.text ? `<p class="muted">${esc(t.text)}</p>` : ''}<div class="table-wrap"><table class="table"><thead><tr>${join(t.columns, (c) => `<th scope="col">${esc(c)}</th>`)}</tr></thead><tbody>${join(t.rows, (r) => `<tr>${join(r, (c, i) => (i === 0 ? `<td><button class="copy" type="button" data-copy="${attr(c)}" aria-label="Copy ${attr(c)}"><code>${esc(c)}</code></button></td>` : `<td>${esc(c)}</td>`))}</tr>`)}</tbody></table></div></div>`);
  return blocks.length || tables ? `<div class="notes">${blocks.join('')}${tables}</div>` : '';
}

function demoBlock(root, p, { withTitle = true } = {}) {
  const d = p.demo;
  return `<div class="demo-block" style="--c:${tileColor(p)}">
    <div class="db-head">
      ${withTitle ? `<div class="db-id"><span class="db-dot" aria-hidden="true"></span><div><h3><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h3><p>${esc(p.kind)}</p></div></div>` : ''}
      <p class="db-where">${statusPill(p)}${d.url ? `<a href="${attr(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>` : ''}</p>
      ${d.url ? `<a class="btn primary" href="${attr(d.url)}" target="_blank" rel="noopener">Open the demo ${ext}</a>` : ''}
    </div>
    <ul class="db-facts">
      <li>${icon('users')}<span>${esc(d.company)}</span></li>
      ${d.note ? `<li>${icon('info')}<span>${esc(d.note)}</span></li>` : ''}
      <li>${icon('rotate')}<span>${esc(d.resets)}</span></li>
    </ul>
    ${accountCards(p)}
    ${demoNotes(p)}
    <p class="db-copy">${esc(p.name)} © ${site.year} ${esc(site.legalName)}. All rights reserved. Demo data is fictional.</p>
  </div>`;
}

// ---------- pages ----------
const stepsData = steps_;
const allShots = (p) => p.shots.map((s) => `${site.url}/assets/shots/${s.file}`);

page({
  file: 'index.html',
  active: 'home',
  title: site.title,
  description: site.metaDescription,
  bodyClass: 'home',
  sitemapImages: products.map((p) => heroShot(p) && `${site.url}/assets/shots/${heroShot(p).file}`).filter(Boolean),
  preload: `<link rel="preload" as="image" type="image/webp" href="${webp(heroShot(products[0]).file)}">\n`,
  body: (root) => `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="chip"><span class="dot" aria-hidden="true"></span>Software studio in ${esc(site.region)} · Free quotes</p>
      <h1>Websites, apps and business software, <span class="hl">built to order.</span></h1>
      <p class="lede">We take on projects of any size, from a five-page website to a point-of-sale system, and look after them once they’re live. Don’t take our word for it: sign in to the software we’ve built.</p>
      <div class="actions">
        <a class="btn primary lg" href="${root}contact.html">Get a free quote ${arrow}</a>
        <a class="btn lg" href="${root}demos.html">Try a live demo</a>
      </div>
      <p class="trust">Trusted by ${join(clients, (c) => `<a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`, ' · ')}</p>
    </div>
    ${heroDemoCard(root)}
  </div>
</section>

<section class="stats-band">
  <div class="wrap stats">
    <div class="stat"><span class="stat-n tone-blue">${products.length}</span><span class="stat-l">live demos you can sign in to</span></div>
    <div class="stat"><span class="stat-n tone-green">${totalAccounts}</span><span class="stat-l">ready-made test accounts</span></div>
    <div class="stat"><span class="stat-n tone-gold">${services.length}</span><span class="stat-l">kinds of work under one roof</span></div>
    <div class="stat"><span class="stat-n tone-coral">1 day</span><span class="stat-l">to hear back about your project</span></div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead('Software we built and run', 'Our own products, each with a live demo and an account for every role. Open one and click around.')}
    <div class="tiles">${join(products, (p) => productTile(root, p))}${yourTile(root)}</div>
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    ${secHead('Any kind of project, including tech', 'Most clients start with a website or an online store. Plenty stay for the software, the email setup and the support afterwards.')}
    <div class="svc-grid">${join(services, (s, i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(SVC_ICON[i % SVC_ICON.length])}</span><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p></article>`)}</div>
    <p class="more"><a class="btn" href="${root}services.html">All services ${arrow}</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead('How a project works', 'Four steps, and you always know which one you’re on.', true)}
    ${steps()}
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    ${secHead('Websites we’ve built for clients', '')}
    <div class="clients">${join(clients, (c) => clientCard(c))}</div>
  </div>
</section>

<section class="sec">
  <div class="wrap narrow">
    ${secHead('Questions people ask', '', true)}
    <div class="faq">${join(faq.slice(0, 5), (f) => `<details><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div>
  </div>
</section>
${ctaCard(root)}
`,
});

function clientCard(c) {
  return `<article class="client">
    <a class="client-shot" href="${attr(c.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="https://s.wordpress.com/mshots/v1/${encodeURIComponent(c.url)}?w=800&amp;h=500" alt="" width="800" height="500" loading="lazy" decoding="async"><span>${esc(c.name)}</span></a>
    <div class="client-body"><p class="badge">${esc(c.kind)}</p><h3><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)} ${ext}</a></h3><p>${esc(c.text)}</p></div>
  </article>`;
}

page({
  file: 'portfolio.html',
  active: 'portfolio',
  title: 'Our Work: Software Products and Client Websites | EvoSoft',
  description: 'Software and websites by EvoSoft: Evo (workforce and POS), Mailtabs (email client), StudyCat (study platform) and client sites such as Larifan and IPG.',
  crumbs: [['Work', 'portfolio.html']],
  sitemapImages: products.flatMap(allShots).slice(0, 12),
  body: (root) => `
${pageHead('Our work', 'Software we built, sites we shipped', 'Three products we designed, built and run ourselves, each with a live demo, and websites we’ve made for clients.')}
<section class="sec tight">
  <div class="wrap">
    <div class="work-list">${join(products, (p) => {
      const shot = heroShot(p);
      return `<article class="work-row" style="--c:${tileColor(p)}">
        <a class="work-shot" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">${shot ? picture(root, shot.file, { alt: '', sizes: '(min-width: 1100px) 640px, 100vw' }) : ''}</a>
        <div class="work-info">
          <p class="chip tone"><span class="dot" aria-hidden="true"></span>${esc(p.category)}</p>
          <h2><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h2>
          <p class="work-tag">${esc(p.tagline)}</p>
          <p>${esc(p.summary)}</p>
          <ul class="checks">${join(p.highlights.slice(0, 3), (h) => `<li>${icon('check')}<span>${esc(h.title)}</span></li>`)}</ul>
          <p class="tile-meta">${statusPill(p)}<span>${p.demo.accounts.length} demo accounts</span></p>
          <div class="tile-actions">${p.demo.url ? `<a class="btn primary" href="${attr(p.demo.url)}" target="_blank" rel="noopener">Open demo ${ext}</a>` : ''}<a class="btn" href="${root}work/${p.slug}.html">Case study ${arrow}</a></div>
        </div>
      </article>`;
    })}</div>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead('Client websites', 'Sites we’ve designed and built for clients in different industries.')}
    <div class="clients">${join(clients, (c) => clientCard(c))}</div>
  </div>
</section>
${ctaCard(root, 'Want to be next?')}
`,
});

page({
  file: 'demos.html',
  active: 'demos',
  title: 'Live Software Demos with Test Accounts | EvoSoft',
  description: 'Sign in to live demos of Evo (workforce and POS), Mailtabs (email client) and StudyCat (study platform) with a ready-made test account for every role.',
  crumbs: [['Live demos', 'demos.html']],
  body: (root) => `
${pageHead('Live demos', 'Try our software before you talk to us', 'Each demo is a real copy of the product with made-up data. Pick a role, copy its login and open the demo. The demos reset themselves, so you can’t break anything for good.',
  `<nav class="jump" aria-label="Jump to a demo">${join(products, (p) => `<a href="#${p.slug}" style="--c:${tileColor(p)}"><i aria-hidden="true"></i>${esc(p.name)}</a>`)}</nav>`)}
${join(products, (p, i) => `
<section class="sec${i % 2 ? ' alt' : ''} tight" id="${p.slug}">
  <div class="wrap">${demoBlock(root, p)}</div>
</section>`)}
${ctaCard(root, 'Like what you see?', 'We can build something like this for your business, or something completely different. Quotes are free.')}
`,
});

const appCategory = { evo: 'BusinessApplication', mailtabs: 'CommunicationApplication', studycat: 'EducationalApplication' };
const productTitles = {
  evo: 'Evo: Workforce Management and Point of Sale System | EvoSoft',
  mailtabs: 'Mailtabs: Unified Inbox for All Your Email Accounts | EvoSoft',
  studycat: 'StudyCat: Study Platform for University Courses | EvoSoft',
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
    ogImage: `${site.url}/assets/shots/${p.og || hero.file}`,
    crumbs: [['Work', 'portfolio.html'], [p.name, file]],
    sitemapImages: allShots(p),
    ld: [{
      '@type': 'SoftwareApplication',
      name: p.name,
      description: p.summary,
      applicationCategory: appCategory[p.slug] || 'BusinessApplication',
      operatingSystem: 'Web browser',
      url: abs(file),
      image: allShots(p).slice(0, 4),
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      copyrightHolder: { '@id': ORG_ID },
      copyrightYear: site.year,
      ...(p.live ? { sameAs: [p.live.url] } : {}),
    }],
    bodyClass: 'product',
    body: (root) => `
<section class="p-head" style="--c:${tileColor(p)}">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${root}portfolio.html">Work</a><span aria-hidden="true">›</span><span aria-current="page">${esc(p.name)}</span></nav>
    <div class="p-grid">
      <div class="p-intro">
        <p class="chip tone"><span class="dot" aria-hidden="true"></span>${esc(p.category)} · ${esc(p.kind)}</p>
        <h1>${esc(p.name)}</h1>
        <p class="p-tag">${esc(p.tagline)}</p>
        <p class="lede">${esc(p.intro)}</p>
        <div class="actions">${p.demo.url ? `<a class="btn primary lg" href="${attr(p.demo.url)}" target="_blank" rel="noopener">Open the live demo ${ext}</a>` : ''}<a class="btn lg" href="#demo">Demo accounts</a>${p.live ? `<a class="btn lg" href="${attr(p.live.url)}" target="_blank" rel="noopener">${esc(p.live.label)} ${ext}</a>` : ''}</div>
      </div>
      <aside class="p-side">
        <p class="side-title">Live demo</p>
        <p class="side-status">${statusPill(p)}</p>
        ${p.demo.url ? `<p class="side-url"><a href="${attr(p.demo.url)}" target="_blank" rel="noopener">${esc(p.demo.label)}</a></p>` : ''}
        <div class="side-stat"><span class="stat-n">${p.demo.accounts.length}</span><span>demo accounts, one per role</span></div>
        ${a0 ? `<p class="side-cred"><span class="muted">${esc(a0.role)}</span><button class="copy" type="button" data-copy="${attr(a0.login)}" aria-label="Copy ${attr(a0.login)}"><code>${esc(a0.login)}</code></button><button class="copy" type="button" data-copy="${attr(a0.password)}" aria-label="Copy the password"><code>${esc(a0.password)}</code></button></p>` : ''}
        <p class="side-title">Built with</p>
        <p class="stack">${join(p.stack, (s) => `<span>${esc(s)}</span>`)}</p>
      </aside>
    </div>
    ${hero ? `<figure class="shot-card hero-shot"><button class="shot" type="button" data-lightbox="${attr(root + 'assets/shots/' + hero.file)}" data-caption="${attr(hero.caption)}">${picture(root, hero.file, { alt: hero.caption, sizes: '(min-width: 1240px) 1200px, 100vw', eager: true })}</button><figcaption>${esc(hero.caption)}</figcaption></figure>` : ''}
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead('What it does')}
    <div class="svc-grid three">${join(p.highlights, (h, i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(h.icon)}</span><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></article>`)}</div>
  </div>
</section>

${desktop.length ? `<section class="sec alt">
  <div class="wrap">
    ${secHead('A look inside', 'Real screenshots from the demo. Select one to see it full size.')}
    <div class="gallery">${join(desktop, (s) => `<figure class="shot-card${s.wide ? ' wide' : ''}"><button class="shot" type="button" data-lightbox="${attr(root + 'assets/shots/' + s.file)}" data-caption="${attr(s.caption)}">${picture(root, s.file, { alt: s.caption, sizes: s.wide ? '(min-width: 1240px) 1160px, 100vw' : '(min-width: 1100px) 560px, 100vw' })}</button><figcaption>${esc(s.caption)}${s.as ? `<span class="badge">${esc(s.as)}</span>` : ''}</figcaption></figure>`)}</div>
    ${phones.length ? `<div class="phones-card"><div class="phones-text"><span class="ico tone-blue">${icon('smartphone')}</span><h3>${esc(p.phoneTitle || 'On a phone')}</h3><p>${esc(p.phoneText || 'The same app, laid out for a small screen.')}</p></div><div class="phones-shots">${join(phones, (s) => `<figure class="phone"><button class="shot" type="button" data-lightbox="${attr(root + 'assets/shots/' + s.file)}" data-caption="${attr(s.caption)}">${picture(root, s.file, { alt: s.caption, sizes: '240px' })}</button><figcaption>${esc(s.caption)}</figcaption></figure>`)}</div></div>` : ''}
  </div>
</section>` : ''}

<section class="sec">
  <div class="wrap">
    ${secHead('In detail')}
    <div class="feat-grid">${join(p.features, (g) => `<div class="feat"><h3>${esc(g.title)}</h3><ul class="checks">${join(g.items, (x) => `<li>${icon('check')}<span>${esc(x)}</span></li>`)}</ul></div>`)}</div>
  </div>
</section>

<section class="sec alt" id="demo">
  <div class="wrap">
    ${secHead(`Sign in to the ${esc(p.name)} demo`, 'Every account below works on the live demo. Select a login or password to copy it.')}
    ${demoBlock(root, p, { withTitle: false })}
  </div>
</section>

${ctaCard(root, `Need something like ${p.name}?`, 'We build business systems, web apps and websites to fit how you actually work. Tell us about your project for a free quote.')}

<section class="sec tight">
  <div class="wrap"><a class="next-card" href="${root}work/${next.slug}.html" style="--c:${tileColor(next)}"><span class="muted">Next product</span><span class="next-name">${esc(next.name)}</span><span class="next-tag">${esc(next.tagline)}</span>${arrow}</a></div>
</section>
`,
  });
}

page({
  file: 'services.html',
  active: 'services',
  title: 'Web Development, Custom Software and IT Services | EvoSoft Georgia',
  description: 'Websites, online stores, web apps, business systems, integrations, SEO, branding, Microsoft 365 and IT support from EvoSoft, a development studio in Georgia. Free quotes.',
  crumbs: [['Services', 'services.html']],
  ld: services.map((s) => ({ '@type': 'Service', name: s.name, description: s.text, provider: { '@id': ORG_ID }, areaServed: 'Worldwide', serviceType: s.name })),
  body: (root) => `
${pageHead('Services', 'Any kind of project, including tech', 'Websites are where many clients start, but we don’t stop there. If your business needs something built, connected, set up or fixed, one team handles it, and every project starts with a free quote.')}
<section class="sec tight">
  <div class="wrap">
    <div class="svc-detail">${join(services, (s, i) => `<article class="svc wide"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon(SVC_ICON[i % SVC_ICON.length])}</span><div><h2>${esc(s.name)}</h2><p>${esc(s.text)}</p><p class="tags">${join(s.examples, (e) => `<span>${esc(e)}</span>`)}</p></div><a class="btn sm" href="${root}contact.html?need=${encodeURIComponent(quoteTypes[i] || quoteTypes[quoteTypes.length - 1])}">Get a quote</a></article>`)}</div>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead('Judge the work, not the pitch', 'These are our own products. Each has a live demo with an account for every role.')}
    <div class="tiles three">${join(products, (p) => productTile(root, p))}</div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    ${secHead('How a project works', '', true)}
    ${steps()}
  </div>
</section>
${ctaCard(root)}
`,
});

page({
  file: 'about.html',
  active: 'about',
  title: 'About EvoSoft: Software Development Studio in Georgia',
  description: 'EvoSoft Solutions is a software development studio in Georgia building websites, online stores, web apps and business systems, and running its own products.',
  crumbs: [['About', 'about.html']],
  body: (root) => `
${pageHead('About us', 'A small studio that builds and runs software', '')}
<section class="sec tight">
  <div class="wrap about-grid">
    <div class="card prose">
      <p class="big">EvoSoft Solutions is a software development studio based in Georgia. We design and build websites, online stores, web apps and business systems, and we look after them once they’re live.</p>
      <p>We work with small and medium-sized businesses, startups, shops, schools and independent founders. Most of our work happens remotely over email and calls, so clients don’t need to be nearby.</p>
      <p>We also build our own products. <a href="${root}work/evo.html">Evo</a> runs time clocks, schedules, payroll and a campus store’s registers. <a href="${root}work/mailtabs.html">Mailtabs</a> puts every inbox in one place. <a href="${root}work/studycat.html">StudyCat</a> is a study platform for university courses, live at studycat.org. Running real software keeps us honest about what good software takes, and you can <a href="${root}demos.html">try all three</a>.</p>
    </div>
    <aside class="card about-side">
      <p class="side-title">Get in touch</p>
      ${join(site.phones, (p) => `<p class="big-line"><a href="${tel(p)}">${esc(p)}</a></p>`)}
      <p class="big-line"><a href="mailto:${site.email}">${esc(site.email)}</a></p>
      <p class="muted">Replies ${esc(site.responseTime)}.</p>
      <a class="btn primary" href="${root}contact.html">Get a free quote</a>
    </aside>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    ${secHead('What you can expect', '', true)}
    <div class="svc-grid three">${join(promises, ([t, d], i) => `<article class="svc"><span class="ico tone-${SVC_TONE[i % SVC_TONE.length]}">${icon('check')}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`)}</div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    ${secHead('How a project works', '', true)}
    ${steps()}
  </div>
</section>
${ctaCard(root)}
`,
});

page({
  file: 'contact.html',
  active: 'contact',
  title: 'Get a Free Quote for Your Website or Software Project | EvoSoft',
  description: `Get a free quote for your website, online store, app or IT project. Call ${site.phones[0]} or email ${site.email}. Replies within one business day.`,
  crumbs: [['Get a quote', 'contact.html']],
  ld: [{ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }],
  body: (root) => `
${pageHead('Get a quote', 'Tell us about your project', `Send a few lines and we’ll reply ${esc(site.responseTime)} with questions or a quote. It’s free, and there’s no obligation.`)}
<section class="sec tight">
  <div class="wrap quote-grid">
    <form class="card quote" id="quote" action="${root}api/quote.php" method="post" data-email="${attr(site.email)}" novalidate>
      <div class="row2">
        <label class="field"><span>Your name</span><input name="name" autocomplete="name" required maxlength="100"></label>
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required maxlength="200"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Phone <em>optional</em></span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
        <label class="field"><span>Company <em>optional</em></span><input name="company" autocomplete="organization" maxlength="120"></label>
      </div>
      <fieldset class="field">
        <legend>What do you need? <em>pick any</em></legend>
        <div class="chips">${join(quoteTypes, (t) => `<label class="pick"><input type="checkbox" name="types" value="${attr(t)}"><span>${esc(t)}</span></label>`)}</div>
      </fieldset>
      <label class="field"><span>Timeline</span><select name="timeline">${join(quoteTimelines, (t) => `<option>${esc(t)}</option>`)}</select></label>
      <label class="field"><span>About the project</span><textarea name="message" rows="6" required maxlength="5000" placeholder="What you need, who it’s for, and any sites or apps you like."></textarea></label>
      <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-foot"><button class="btn primary lg" type="submit">Send request ${arrow}</button><p class="muted small">We use your details only to answer you. <a href="${root}legal.html#privacy">Privacy</a></p></div>
      <div class="form-done" hidden><span class="ico tone-green">${icon('check')}</span><h2>Thanks, it’s on its way.</h2><p>We’ll reply ${esc(site.responseTime)}. If it’s urgent, call <a href="${tel(site.phones[0])}">${esc(site.phones[0])}</a>.</p></div>
    </form>
    <aside class="quote-side">
      <div class="card"><span class="ico tone-blue">${icon('phone')}</span><h2>Phone</h2>${join(site.phones, (p) => `<p class="big-line"><a href="${tel(p)}">${esc(p)}</a></p>`)}</div>
      <div class="card"><span class="ico tone-purple">${icon('mail')}</span><h2>Email</h2><p class="big-line"><a href="mailto:${site.email}">${esc(site.email)}</a></p></div>
      <div class="card"><span class="ico tone-green">${icon('clock')}</span><h2>What happens next</h2><ol class="steps-list"><li>We read your message and reply ${esc(site.responseTime)}.</li><li>A short call or a few emails to fill in the gaps.</li><li>A written quote with the scope, timeline and price.</li></ol></div>
    </aside>
  </div>
</section>
<section class="sec alt">
  <div class="wrap narrow">
    ${secHead('Questions people ask', '', true)}
    <div class="faq">${join(faq, (f) => `<details><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div>
  </div>
</section>
`,
});

page({
  file: 'legal.html',
  active: '',
  title: 'Copyright, Terms of Use and Privacy | EvoSoft',
  description: 'Copyright notice, terms of use and privacy information for the EvoSoft website, its chat assistant, the quote form and the live software demos.',
  crumbs: [['Copyright & privacy', 'legal.html']],
  body: () => `
${pageHead('Legal', 'Copyright and privacy', `Last updated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`)}
<section class="sec tight">
  <div class="wrap narrow legal">
    <div class="card prose">
      <h2>Copyright</h2>
      <p class="big">${esc(site.copyright)}</p>
      <p>This website and everything on it, including its text, design, logos, graphics, screenshots and code, belongs to ${esc(site.legalName)} unless stated otherwise. Evo, Mailtabs and StudyCat, their names, logos, screenshots and live demos are products of ${esc(site.legalName)}.</p>
      <p>You’re welcome to link to any page. You may not copy, republish, sell or reuse the content, the screenshots or the software shown here, in whole or in part, without our written permission. To ask, email <a href="mailto:${site.email}">${esc(site.email)}</a>.</p>
      <p>Client websites shown in our portfolio belong to their owners and appear here as examples of our work. Other product and company names may be trademarks of their respective owners.</p>
    </div>
    <div class="card prose">
      <h2>Live demos</h2>
      <p>The demos are provided so you can evaluate our software. All people, companies, emails and sales in them are fictional. The demo accounts are shared and the demos reset automatically, so don’t enter real personal information, passwords or payment details. Demos are provided as they are, may be unavailable at times, and may change without notice.</p>
    </div>
    <div class="card prose" id="privacy">
      <h2>Privacy</h2>
      <p><strong>Quote form.</strong> When you send a quote request we receive your name, email, optional phone and company, and your message. We use them only to reply about your project and keep them as long as needed for that.</p>
      <p><strong>Chat assistant.</strong> Questions you type into the assistant are sent to our AI provider (Anthropic) to generate an answer and are not used to identify you. Please don’t share sensitive personal information in the chat.</p>
      <p><strong>Cookies.</strong> This site sets no tracking or advertising cookies. It remembers your light or dark preference in your own browser, and the chat keeps the current conversation in your browser tab until you close it.</p>
      <p><strong>Your rights.</strong> To see, correct or delete anything you’ve sent us, email <a href="mailto:${site.email}">${esc(site.email)}</a>.</p>
    </div>
  </div>
</section>
`,
});

page({
  file: '404.html',
  active: '',
  title: 'Page not found | EvoSoft',
  description: 'This page does not exist.',
  root: '/',
  noindex: true,
  body: () => `
${pageHead('404', 'This page wandered off', 'The link may be old, or the page has moved.', '<div class="actions"><a class="btn primary" href="/index.html">Go home</a><a class="btn" href="/demos.html">Live demos</a><a class="btn" href="/contact.html">Get a quote</a></div>')}`,
});

// Old address: prices are gone, quotes replaced them.
fs.writeFileSync(
  path.join(OUT, 'pricing.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Get a quote | EvoSoft</title><meta name="robots" content="noindex"><link rel="canonical" href="${site.url}/contact.html"><meta http-equiv="refresh" content="0; url=contact.html"></head><body><p>Every project now gets its own free quote: <a href="contact.html">get a quote</a>.</p></body></html>\n`,
);

// ---------- generated files: chat knowledge, sitemap, robots, llms.txt, manifest ----------
const pageList = [
  ['/index.html', 'Home'],
  ['/portfolio.html', 'Work: products and client websites'],
  ['/demos.html', 'Live demos with every test account'],
  ...products.map((p) => [`/work/${p.slug}.html`, `${p.name} case study`]),
  ['/services.html', 'Services'],
  ['/about.html', 'About EvoSoft'],
  ['/contact.html', 'Get a quote (form, phone, email, FAQ)'],
  ['/legal.html', 'Copyright and privacy'],
];
const data = { site, services, process: steps_, promises, faq, clients, products, chat, pages: pageList };
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'api/knowledge.md'), knowledgeMarkdown(data));
fs.mkdirSync(path.join(OUT, 'assets/data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets/data/chat-kb.json'), JSON.stringify(localKb(data)));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages
  .filter((p) => !p.noindex)
  .map((p) => `  <url>\n    <loc>${abs(p.file)}</loc>\n    <lastmod>${TODAY}</lastmod>\n${p.images.map((img) => `    <image:image><image:loc>${img}</image:loc></image:image>\n`).join('')}  </url>`)
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`);

const llms = `# EvoSoft

> ${site.description}

${site.legalName} (EvoSoft) is a software development studio based in ${site.region}, working with clients anywhere. It takes on any kind of project: ${services.map((s) => s.name.toLowerCase()).join(', ')}. Every project gets a free quote, and the team replies ${site.responseTime}. Contact: ${site.email}, ${site.phones.join(', ')}.

## Pages

${pageList.map(([p, what]) => `- [${what}](${site.url}${p})`).join('\n')}

## Products with live demos

${products.map((p) => `- [${p.name}](${site.url}/work/${p.slug}.html): ${p.summary} Live demo: ${p.demo.url || 'coming soon'}. Built by EvoSoft.`).join('\n')}

## Client websites

${clients.map((c) => `- [${c.name}](${c.url}): ${c.text}`).join('\n')}

${site.copyright}
`;
fs.writeFileSync(path.join(OUT, 'llms.txt'), llms);

fs.writeFileSync(
  path.join(OUT, 'site.webmanifest'),
  JSON.stringify({ name: 'EvoSoft', short_name: 'EvoSoft', start_url: '/', display: 'browser', background_color: '#F4F1EA', theme_color: '#161412', icons: [{ src: '/assets/img/icon-180.png', sizes: '180x180', type: 'image/png' }, { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/assets/img/icon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2) + '\n',
);

console.log(`Built ${pages.length} pages into ${path.relative(process.cwd(), OUT) || OUT}`);
