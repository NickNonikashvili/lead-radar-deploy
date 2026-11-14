#!/usr/bin/env node
// Builds the EvoSoft website into ../evosoft-site from the data in ./data. No dependencies:
//   node site-builder/build.mjs
// Run site-builder/images.mjs first whenever screenshots change (WebP sizes + images.json).
// © 2026 EvoSoft Solutions. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, nav, services, process as steps, promises, faq, clients, quoteTypes, quoteTimelines, chat } from './data/site.mjs';
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
<meta name="theme-color" content="#F4F1EA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131211" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${root}favicon.ico" sizes="32x32">
<link rel="icon" href="${root}assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/icon-180.png">
<link rel="manifest" href="${root}site.webmanifest">
<link rel="preload" href="${root}assets/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/plex-sans.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="${root}assets/css/site.css?v=${BUILD}">
<script>try{var t=localStorage.getItem('evo-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">${ldFor({ file, title, description, crumbs, extra: ld })}</script>
</head>`;
}

function header(root, active) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${root}index.html" aria-label="EvoSoft, home">${logoInline}</a>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${join(nav, (n) => `<a href="${root}${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`)}
      <a class="nav-quote" href="${root}contact.html"${active === 'contact' ? ' aria-current="page"' : ''}>Get a quote</a>
    </nav>
    <button class="icon-btn theme-toggle" type="button" aria-label="Switch between light and dark" title="Light / dark">${icon('sun', 'i i-sun')}${icon('moon', 'i i-moon')}</button>
    <button class="icon-btn menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">${icon('menu', 'i i-menu')}${icon('x', 'i i-close')}</button>
  </div>
</header>`;
}

function footer(root) {
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a class="brand" href="${root}index.html" aria-label="EvoSoft, home">${logoInline}</a>
        <p>${esc(site.short)}</p>
      </div>
      <div class="foot-cols">
        <div><h2>Work</h2><ul>${join(products, (p) => `<li><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></li>`)}<li><a href="${root}portfolio.html">Client websites</a></li><li><a href="${root}demos.html">Live demos</a></li></ul></div>
        <div><h2>Company</h2><ul><li><a href="${root}services.html">Services</a></li><li><a href="${root}about.html">About</a></li><li><a href="${root}contact.html">Get a quote</a></li><li><a href="${root}legal.html">Copyright &amp; privacy</a></li></ul></div>
        <div><h2>Contact</h2><ul>${join(site.phones, (p) => `<li><a href="${tel(p)}">${esc(p)}</a></li>`)}<li><a href="mailto:${site.email}">${esc(site.email)}</a></li><li class="muted">Replies ${esc(site.responseTime)}</li></ul></div>
      </div>
    </div>
    <div class="foot-base">
      <p>${esc(site.copyright)}</p>
      <p>Evo, Mailtabs and StudyCat are products of ${esc(site.legalName)}. Demo data is fictional. <a href="${root}legal.html">Copyright &amp; privacy</a></p>
    </div>
  </div>
</footer>
<div class="chat" data-endpoint="${root}api/chat.php" data-kb="${root}assets/data/chat-kb.json?v=${BUILD}" data-root="${root}">
  <button class="chat-launch" type="button" aria-expanded="false" aria-controls="chat-panel">${markInline}<span>Ask EvoSoft</span></button>
  <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
    <header class="chat-head">
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
const label = (n, text) => `<p class="sec-label"><span class="num">${pad(n)}</span>${esc(text)}</p>`;
const arrow = '<span class="arr" aria-hidden="true">→</span>';
const ext = '<span class="arr" aria-hidden="true">↗</span>';

function statusPill(p) {
  if (!p.demo.url) return `<span class="status" data-state="soon">Coming soon</span>`;
  return `<span class="status" data-state="checking" data-status-url="${attr(p.demo.url)}"><i aria-hidden="true"></i><span>Checking</span></span>`;
}

const quoteCta = (root, title = 'Have a project in mind?', em = 'Tell us about it.') => `
<section class="sec cta">
  <div class="wrap cta-grid">
    <h2 class="cta-title">${esc(title)} <em>${esc(em)}</em></h2>
    <div class="cta-side">
      <p>Quotes are free, and we reply ${esc(site.responseTime)}. Websites, online stores, software, email or IT: if you need it built or fixed, ask.</p>
      <a class="btn btn-lg" href="${root}contact.html">Get a quote ${arrow}</a>
      <ul class="cta-contacts">${join(site.phones, (p) => `<li><a href="${tel(p)}">${esc(p)}</a></li>`)}<li><a href="mailto:${site.email}">${esc(site.email)}</a></li></ul>
    </div>
  </div>
</section>`;

function workIndex(root) {
  const rows = [
    ...products.map((p) => ({ href: `${root}work/${p.slug}.html`, name: p.name, kind: p.kind, meta: 'Our product · live demo', preview: heroShot(p) ? root + webp(heroShot(p).file) : '', external: false })),
    ...clients.map((c) => ({ href: c.url, name: c.name, kind: c.kind, meta: 'Client website', preview: `https://s.wordpress.com/mshots/v1/${encodeURIComponent(c.url)}?w=800&h=500`, external: true })),
  ];
  return `<ol class="index">${join(rows, (r, i) => `<li><a href="${attr(r.href)}"${r.external ? ' target="_blank" rel="noopener"' : ''} data-preview="${attr(r.preview)}"><span class="ix-num">${pad(i + 1)}</span><span class="ix-name">${esc(r.name)}</span><span class="ix-kind">${esc(r.kind)}</span><span class="ix-meta">${esc(r.meta)}</span>${r.external ? ext : arrow}</a></li>`)}</ol>
  <div class="ix-preview" aria-hidden="true"><img alt=""></div>`;
}

function feature(root, p, n) {
  const shot = heroShot(p);
  return `<article class="feature" id="${p.slug}">
  <a class="feature-img" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">${shot ? picture(root, shot.file, { alt: '', sizes: '(min-width: 1360px) 1280px, 100vw' }) : ''}</a>
  <div class="feature-text">
    <div class="ft-title"><p class="mono">Fig. ${n}</p><h3><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></h3><p class="ft-tag">${esc(p.tagline)}</p></div>
    <div class="ft-body"><p>${esc(p.summary)}</p><p class="ft-links"><a class="link" href="${root}work/${p.slug}.html">Read the case study ${arrow}</a>${p.demo.url ? `<a class="link" href="${attr(p.demo.url)}" target="_blank" rel="noopener">Open the live demo ${ext}</a>` : ''}</p></div>
    <dl class="spec">
      <div><dt>Type</dt><dd>${esc(p.category)}</dd></div>
      <div><dt>Built with</dt><dd>${esc(p.stack.slice(0, 4).join(', '))}</dd></div>
      <div><dt>Demo</dt><dd>${p.demo.accounts.length} account${p.demo.accounts.length === 1 ? '' : 's'} · ${statusPill(p)}</dd></div>
    </dl>
  </div>
</article>`;
}

function accountsTable(p) {
  const d = p.demo;
  const signin = d.signinUrl || d.url;
  const loginLabel = d.loginLabel || 'Email';
  const copyBtn = (v, what) => `<button class="copy" type="button" data-copy="${attr(v)}" aria-label="Copy ${attr(what)} ${attr(v)}"><code>${esc(v)}</code><span class="copy-tag" aria-hidden="true">copy</span></button>`;
  return `<div class="table-wrap"><table class="accounts">
    <caption class="sr-only">${esc(p.name)} demo accounts</caption>
    <thead><tr><th scope="col">Role</th><th scope="col">${esc(loginLabel)}</th><th scope="col">Password</th><th scope="col"><span class="sr-only">Sign in</span></th></tr></thead>
    <tbody>${join(d.accounts, (a) => `<tr>
      <th scope="row"><span class="acc-role">${esc(a.role)}</span>${a.name ? `<span class="acc-name">${esc(a.name)}</span>` : ''}${a.badge ? `<span class="acc-badge">${esc(a.badge)}</span>` : ''}${a.tries?.length ? `<span class="acc-try">${esc(a.tries.join(' · '))}</span>` : ''}</th>
      <td data-label="${attr(loginLabel)}">${copyBtn(a.login, loginLabel.toLowerCase())}</td>
      <td data-label="Password">${copyBtn(a.password, 'password')}</td>
      <td class="acc-go-cell">${signin && a.signin !== false ? `<a class="acc-go" href="${attr(signin)}" target="_blank" rel="noopener" data-login="${attr(a.login)}" data-pass="${attr(a.password)}">Sign in as ${esc(first(a.name || a.role))} ${ext}</a>` : '<span class="muted small">Use in “Add account”</span>'}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function demoDetails(p) {
  const d = p.demo;
  const blocks = [];
  if (d.steps) blocks.push(`<div class="note-block"><h4>${esc(d.steps.title)}</h4><ol>${join(d.steps.items, (s) => `<li>${esc(s)}</li>`)}</ol></div>`);
  if (d.extras?.length) blocks.push(`<div class="note-block"><h4>${esc(d.extrasTitle || 'Test data')}</h4><dl class="kv">${join(d.extras, ([k, v]) => `<div><dt>${esc(k)}</dt><dd><button class="copy" type="button" data-copy="${attr(v)}" aria-label="Copy ${attr(v)}"><code>${esc(v)}</code><span class="copy-tag" aria-hidden="true">copy</span></button></dd></div>`)}</dl></div>`);
  const tables = join(d.tables, (t) => `<div class="note-block wide"><h4>${esc(t.title)}</h4>${t.text ? `<p class="muted">${esc(t.text)}</p>` : ''}<div class="table-wrap"><table class="plain"><thead><tr>${join(t.columns, (c) => `<th scope="col">${esc(c)}</th>`)}</tr></thead><tbody>${join(t.rows, (r) => `<tr>${join(r, (c, i) => (i === 0 ? `<td><button class="copy" type="button" data-copy="${attr(c)}" aria-label="Copy ${attr(c)}"><code>${esc(c)}</code></button></td>` : `<td>${esc(c)}</td>`))}</tr>`)}</tbody></table></div></div>`);
  return blocks.length || tables ? `<div class="notes">${blocks.join('')}${tables}</div>` : '';
}

function demoSection(root, p, { compact = false } = {}) {
  const d = p.demo;
  return `<div class="demo">
    <div class="demo-head">
      ${compact ? '' : `<h3 class="demo-name"><a href="${root}work/${p.slug}.html">${esc(p.name)}</a> <span>${esc(p.kind)}</span></h3>`}
      <p class="demo-where">${statusPill(p)} ${d.url ? `<a href="${attr(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>` : ''}</p>
      ${d.url ? `<a class="btn" href="${attr(d.url)}" target="_blank" rel="noopener">Open the demo ${ext}</a>` : ''}
    </div>
    <ul class="demo-facts"><li>${esc(d.company)}</li>${d.note ? `<li>${esc(d.note)}</li>` : ''}<li>${esc(d.resets)}</li></ul>
    ${accountsTable(p)}
    ${demoDetails(p)}
    <p class="demo-copy">${esc(p.name)} © ${site.year} ${esc(site.legalName)}. All rights reserved. Demo data is fictional.</p>
  </div>`;
}

// ---------- pages ----------
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
  <div class="wrap">
    <p class="kicker mono">Software development studio · ${esc(site.region)}</p>
    <h1 class="display">Websites, apps and business software, <em>built to order.</em></h1>
    <div class="hero-row">
      <p class="lede">EvoSoft is a development studio in Georgia. We take on projects of any size, from a five-page website to a point-of-sale system, and we look after them once they’re live. Three of our own products are online right now, with demo accounts you can sign in to.</p>
      <div class="hero-cta"><a class="btn btn-lg" href="${root}contact.html">Get a quote ${arrow}</a><a class="link" href="${root}demos.html">Try the live demos ${arrow}</a></div>
    </div>
  </div>
  <div class="wrap strip">
    ${join(products, (p, i) => {
      const s = i === 2 && phoneShot(p) ? phoneShot(p) : heroShot(p);
      return `<a class="strip-item${s?.phone ? ' is-phone' : ''}" href="${root}work/${p.slug}.html">${s ? picture(root, s.file, { alt: `${p.name}: ${s.caption}`, sizes: s.phone ? '240px' : '(min-width: 1100px) 560px, 80vw', eager: i === 0 }) : ''}<span class="cap mono">${esc(p.name)} <span>${esc(p.kind)}</span></span></a>`;
    })}
  </div>
</section>

<section class="sec">
  <div class="wrap grid">
    ${label(1, 'Selected work')}
    <div class="sec-body">
      <h2>Our own products, and sites we’ve built for clients.</h2>
      ${workIndex(root)}
    </div>
  </div>
</section>

<section class="sec flush">
  <div class="wrap">${join(products, (p, i) => feature(root, p, i + 1))}</div>
</section>

<section class="sec">
  <div class="wrap grid">
    ${label(2, 'Services')}
    <div class="sec-body">
      <h2>Any kind of project, including tech.</h2>
      <p class="intro">Most clients come to us for a website or an online store. Plenty stay for the software, the email setup and the support afterwards.</p>
      <ol class="svc-list">${join(services, (s, i) => `<li><span class="num">${pad(i + 1)}</span><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p></li>`)}</ol>
      <p><a class="link" href="${root}services.html">More about our services ${arrow}</a></p>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap grid">
    ${label(3, 'How it works')}
    <div class="sec-body">
      <h2>From the first call to launch, and after.</h2>
      <ol class="steps">${join(steps, (s, i) => `<li><span class="step-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol>
    </div>
  </div>
</section>
${quoteCta(root)}
`,
});

page({
  file: 'portfolio.html',
  active: 'portfolio',
  title: 'Our Work: Software Products and Client Websites | EvoSoft',
  description: 'Software and websites by EvoSoft: Evo (workforce and POS), Mailtabs (email client), StudyCat (study platform) and client sites such as Larifan and IPG.',
  crumbs: [['Work', 'portfolio.html']],
  sitemapImages: products.flatMap(allShots).slice(0, 12),
  body: (root) => `
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">Work</p>
    <h1 class="display">Software we built, <em>sites we shipped.</em></h1>
    <p class="lede">Three products we designed, built and run ourselves, each with a live demo, and a few of the websites we’ve made for clients.</p>
  </div>
</section>
<section class="sec flush">
  <div class="wrap">${join(products, (p, i) => feature(root, p, i + 1))}</div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(products.length + 1, 'Client websites')}
    <div class="sec-body">
      <h2>Recent sites for clients.</h2>
      <div class="clients">${join(clients, (c) => `<article class="client"><a class="client-shot" href="${attr(c.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="https://s.wordpress.com/mshots/v1/${encodeURIComponent(c.url)}?w=800&amp;h=500" alt="" width="800" height="500" loading="lazy" decoding="async"><span>${esc(c.name)}</span></a><p class="mono">${esc(c.kind)}</p><h3><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)} ${ext}</a></h3><p>${esc(c.text)}</p></article>`)}</div>
    </div>
  </div>
</section>
${quoteCta(root, 'Want to be next?', 'Let’s talk.')}
`,
});

page({
  file: 'demos.html',
  active: 'demos',
  title: 'Live Software Demos with Test Accounts | EvoSoft',
  description: 'Sign in to live demos of Evo (workforce and POS), Mailtabs (email client) and StudyCat (study platform) with a ready-made test account for every role.',
  crumbs: [['Live demos', 'demos.html']],
  body: (root) => `
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">Live demos</p>
    <h1 class="display">Try our software <em>before you talk to us.</em></h1>
    <p class="lede">Each demo is a real copy of the product with made-up data. Pick a role, copy its login and open the demo. The demos reset themselves, so you can’t break anything for good.</p>
    <nav class="jump mono" aria-label="Jump to a demo">${join(products, (p) => `<a href="#${p.slug}">${esc(p.name)}</a>`)}</nav>
  </div>
</section>
${join(products, (p, i) => `
<section class="sec" id="${p.slug}">
  <div class="wrap grid">
    ${label(i + 1, p.name)}
    <div class="sec-body">${demoSection(root, p)}</div>
  </div>
</section>`)}
${quoteCta(root, 'Like what you see?', 'We can build yours.')}
`,
});

const appCategory = { evo: 'BusinessApplication', mailtabs: 'CommunicationApplication', studycat: 'EducationalApplication' };
for (const [idx, p] of products.entries()) {
  const next = products[(idx + 1) % products.length];
  const hero = heroShot(p);
  const desktop = p.shots.filter((s) => s !== hero && !s.phone);
  const phones = p.shots.filter((s) => s.phone);
  const file = `work/${p.slug}.html`;
  const titles = {
    evo: 'Evo: Workforce Management and Point of Sale System | EvoSoft',
    mailtabs: 'Mailtabs: Unified Inbox for All Your Email Accounts | EvoSoft',
    studycat: 'StudyCat: Study Platform for University Courses | EvoSoft',
  };
  page({
    file,
    active: 'portfolio',
    title: titles[p.slug] || `${p.name} | EvoSoft`,
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
<section class="page-head product-head">
  <div class="wrap">
    <nav class="crumbs mono" aria-label="Breadcrumb"><a href="${root}portfolio.html">Work</a> / <span aria-current="page">${esc(p.name)}</span></nav>
    <div class="ph-grid">
      <div>
        <h1 class="display">${esc(p.name)}</h1>
        <p class="ph-tag">${esc(p.tagline)}</p>
        <p class="lede">${esc(p.intro)}</p>
        <p class="ph-cta">${p.demo.url ? `<a class="btn btn-lg" href="${attr(p.demo.url)}" target="_blank" rel="noopener">Open the live demo ${ext}</a>` : ''}<a class="link" href="#demo">Demo accounts ${arrow}</a>${p.live ? `<a class="link" href="${attr(p.live.url)}" target="_blank" rel="noopener">${esc(p.live.label)} ${ext}</a>` : ''}</p>
      </div>
      <dl class="spec spec-col">
        <div><dt>Type</dt><dd>${esc(p.category)}, ${esc(p.kind.toLowerCase())}</dd></div>
        <div><dt>Built with</dt><dd>${esc(p.stack.join(', '))}</dd></div>
        <div><dt>Demo accounts</dt><dd>${p.demo.accounts.length} ready to use</dd></div>
        ${p.live ? `<div><dt>Live product</dt><dd><a href="${attr(p.live.url)}" target="_blank" rel="noopener">${esc(p.live.label)}</a></dd></div>` : ''}
        <div><dt>Demo status</dt><dd>${statusPill(p)}</dd></div>
      </dl>
    </div>
  </div>
  ${hero ? `<div class="wrap"><figure class="fig fig-hero">${picture(root, hero.file, { alt: hero.caption, sizes: '(min-width: 1360px) 1280px, 100vw', eager: true })}<figcaption class="mono">Fig. 1 · ${esc(hero.caption)}</figcaption></figure></div>` : ''}
</section>

<section class="sec">
  <div class="wrap grid">
    ${label(1, 'What it does')}
    <div class="sec-body">
      <ol class="hl-list">${join(p.highlights, (h) => `<li><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></li>`)}</ol>
    </div>
  </div>
</section>

${desktop.length ? `<section class="sec">
  <div class="wrap grid">
    ${label(2, 'Screens')}
    <div class="sec-body">
      <p class="intro">Real screenshots from the demo install. Select one to see it full size.</p>
      <div class="gallery">${join(desktop, (s, i) => `<figure class="fig${s.wide ? ' wide' : ''}"><button class="shot" type="button" data-lightbox="${attr(root + 'assets/shots/' + s.file)}" data-caption="${attr(s.caption)}">${picture(root, s.file, { alt: s.caption, sizes: s.wide ? '(min-width: 1360px) 960px, 100vw' : '(min-width: 1100px) 470px, 100vw' })}</button><figcaption class="mono">Fig. ${i + 2} · ${esc(s.caption)}${s.as ? ` <span>Signed in as ${esc(s.as)}</span>` : ''}</figcaption></figure>`)}</div>
      ${phones.length ? `<div class="phones"><div class="phones-text"><h3>${esc(p.phoneTitle || 'On a phone')}</h3><p>${esc(p.phoneText || 'The same app, laid out for a small screen.')}</p></div>${join(phones, (s, i) => `<figure class="fig phone"><button class="shot" type="button" data-lightbox="${attr(root + 'assets/shots/' + s.file)}" data-caption="${attr(s.caption)}">${picture(root, s.file, { alt: s.caption, sizes: '260px' })}</button><figcaption class="mono">Fig. ${desktop.length + i + 2} · ${esc(s.caption)}</figcaption></figure>`)}</div>` : ''}
    </div>
  </div>
</section>` : ''}

<section class="sec">
  <div class="wrap grid">
    ${label(3, 'In detail')}
    <div class="sec-body"><div class="feat-cols">${join(p.features, (g) => `<div><h3>${esc(g.title)}</h3><ul class="dash">${join(g.items, (x) => `<li>${esc(x)}</li>`)}</ul></div>`)}</div></div>
  </div>
</section>

<section class="sec" id="demo">
  <div class="wrap grid">
    ${label(4, 'Try it')}
    <div class="sec-body">
      <h2>Sign in to the ${esc(p.name)} demo.</h2>
      ${demoSection(root, p, { compact: true })}
    </div>
  </div>
</section>

${quoteCta(root, `Need something like ${p.name}?`, 'We build to order.')}

<section class="sec tight">
  <div class="wrap"><a class="next" href="${root}work/${next.slug}.html"><span class="mono">Next</span><span class="next-name">${esc(next.name)}</span><span class="next-tag">${esc(next.tagline)}</span>${arrow}</a></div>
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
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">Services</p>
    <h1 class="display">Any kind of project, <em>including tech.</em></h1>
    <p class="lede">Websites are where many clients start, but we don’t stop there. If your business needs something built, connected, set up or fixed, one team handles it, and every project starts with a free quote.</p>
  </div>
</section>
<section class="sec flush">
  <div class="wrap">
    <ol class="svc-detail">${join(services, (s, i) => `<li><span class="num mono">${pad(i + 1)}</span><h2>${esc(s.name)}</h2><div><p>${esc(s.text)}</p><p class="mono small muted">${esc(s.examples.join(' · '))}</p></div></li>`)}</ol>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(1, 'Proof')}
    <div class="sec-body">
      <h2>Judge the work, not the pitch.</h2>
      <p class="intro">These are our own products. Each one has a live demo with an account for every role.</p>
      <ul class="mini">${join(products, (p) => `<li><a href="${root}work/${p.slug}.html"><span class="mini-name">${esc(p.name)}</span><span>${esc(p.tagline)}</span>${arrow}</a></li>`)}</ul>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(2, 'How it works')}
    <div class="sec-body"><ol class="steps">${join(steps, (s, i) => `<li><span class="step-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol></div>
  </div>
</section>
${quoteCta(root)}
`,
});

page({
  file: 'about.html',
  active: 'about',
  title: 'About EvoSoft: Software Development Studio in Georgia',
  description: 'EvoSoft Solutions is a software development studio in Georgia building websites, online stores, web apps and business systems, and running its own products.',
  crumbs: [['About', 'about.html']],
  body: (root) => `
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">About</p>
    <h1 class="display">A small studio that <em>builds and runs software.</em></h1>
  </div>
</section>
<section class="sec flush">
  <div class="wrap grid">
    ${label(1, 'Who we are')}
    <div class="sec-body prose">
      <p class="big">EvoSoft Solutions is a software development studio based in Georgia. We design and build websites, online stores, web apps and business systems, and we look after them once they’re live.</p>
      <p>We work with small and medium-sized businesses, startups, shops, schools and independent founders. Most of our work happens remotely over email and calls, so clients don’t need to be nearby.</p>
      <p>We also build our own products. <a href="${root}work/evo.html">Evo</a> runs time clocks, schedules, payroll and a campus store’s registers. <a href="${root}work/mailtabs.html">Mailtabs</a> puts every inbox in one place. <a href="${root}work/studycat.html">StudyCat</a> is a study platform for university courses, live at studycat.org. Running real software keeps us honest about what good software takes, and you can <a href="${root}demos.html">try all three</a>.</p>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(2, 'What to expect')}
    <div class="sec-body"><dl class="promises">${join(promises, ([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`)}</dl></div>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(3, 'How it works')}
    <div class="sec-body"><ol class="steps">${join(steps, (s, i) => `<li><span class="step-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol></div>
  </div>
</section>
${quoteCta(root)}
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
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">Get a quote</p>
    <h1 class="display">Tell us about <em>your project.</em></h1>
    <p class="lede">Send a few lines and we’ll reply ${esc(site.responseTime)} with questions or a quote. It’s free, and there’s no obligation.</p>
  </div>
</section>
<section class="sec flush">
  <div class="wrap quote-grid">
    <form class="quote" id="quote" action="${root}api/quote.php" method="post" data-email="${attr(site.email)}" novalidate>
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
        <div class="chips">${join(quoteTypes, (t, i) => `<label class="chip"><input type="checkbox" name="types" value="${attr(t)}"><span>${esc(t)}</span></label>`)}</div>
      </fieldset>
      <label class="field"><span>Timeline</span><select name="timeline">${join(quoteTimelines, (t) => `<option>${esc(t)}</option>`)}</select></label>
      <label class="field"><span>About the project</span><textarea name="message" rows="6" required maxlength="5000" placeholder="What you need, who it’s for, and any sites or apps you like."></textarea></label>
      <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-foot"><button class="btn btn-lg" type="submit">Send request ${arrow}</button><p class="muted small">We use your details only to answer you. <a href="${root}legal.html#privacy">Privacy</a></p></div>
      <div class="form-done" hidden><h2>Thanks, it’s on its way.</h2><p>We’ll reply ${esc(site.responseTime)}. If it’s urgent, call <a href="${tel(site.phones[0])}">${esc(site.phones[0])}</a>.</p></div>
    </form>
    <aside class="quote-side">
      <div><h2 class="mono">Phone</h2>${join(site.phones, (p) => `<p class="big-line"><a href="${tel(p)}">${esc(p)}</a></p>`)}</div>
      <div><h2 class="mono">Email</h2><p class="big-line"><a href="mailto:${site.email}">${esc(site.email)}</a></p></div>
      <div><h2 class="mono">What happens next</h2><ol class="next-steps"><li>We read your message and reply ${esc(site.responseTime)}.</li><li>A short call or a few emails to fill in the gaps.</li><li>A written quote with the scope, timeline and price.</li></ol></div>
    </aside>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(1, 'Questions')}
    <div class="sec-body"><div class="faq">${join(faq, (f) => `<details><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div></div>
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
  body: (root) => `
<section class="page-head">
  <div class="wrap">
    <p class="kicker mono">Legal</p>
    <h1 class="display">Copyright <em>and privacy.</em></h1>
    <p class="lede">Last updated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
  </div>
</section>
<section class="sec flush">
  <div class="wrap grid">
    ${label(1, 'Copyright')}
    <div class="sec-body prose">
      <p class="big">${esc(site.copyright)}</p>
      <p>This website and everything on it, including its text, design, logos, graphics, screenshots and code, belongs to ${esc(site.legalName)} unless stated otherwise. Evo, Mailtabs and StudyCat, their names, logos, screenshots and live demos are products of ${esc(site.legalName)}.</p>
      <p>You’re welcome to link to any page. You may not copy, republish, sell or reuse the content, the screenshots or the software shown here, in whole or in part, without our written permission. To ask, email <a href="mailto:${site.email}">${esc(site.email)}</a>.</p>
      <p>Client websites shown in our portfolio belong to their owners and appear here as examples of our work. Other product and company names may be trademarks of their respective owners.</p>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap grid">
    ${label(2, 'Live demos')}
    <div class="sec-body prose">
      <p>The demos are provided so you can evaluate our software. All people, companies, emails and sales in them are fictional. The demo accounts are shared and the demos reset automatically, so don’t enter real personal information, passwords or payment details. Demos are provided as they are, may be unavailable at times, and may change without notice.</p>
    </div>
  </div>
</section>
<section class="sec" id="privacy">
  <div class="wrap grid">
    ${label(3, 'Privacy')}
    <div class="sec-body prose">
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
<section class="page-head notfound">
  <div class="wrap">
    <p class="kicker mono">404</p>
    <h1 class="display">This page <em>wandered off.</em></h1>
    <p class="lede">The link may be old, or the page has moved. Try the <a href="/index.html">home page</a>, the <a href="/demos.html">live demos</a> or <a href="/contact.html">get a quote</a>.</p>
  </div>
</section>`,
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
const data = { site, services, process: steps, promises, faq, clients, products, chat, pages: pageList };
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
