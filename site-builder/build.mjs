#!/usr/bin/env node
// Builds the EvoSoft website into ../evosoft-site from the data in ./data.
// No dependencies:  node site-builder/build.mjs
// Run site-builder/images.mjs first whenever screenshots change (it makes the WebP sizes and images.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, nav, services, pricing, faq, process as steps, clients } from './data/site.mjs';
import { products } from './data/products.mjs';
import { icon, mark } from './lib/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../evosoft-site');
const BUILD = new Date().toISOString().slice(0, 10).replace(/-/g, '');

let images = {};
try {
  images = JSON.parse(fs.readFileSync(path.join(HERE, 'data/images.json'), 'utf8'));
} catch {
  console.warn('No data/images.json yet: run node site-builder/images.mjs for WebP sizes.');
}

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const join = (arr, fn, sep = '') => (arr || []).map(fn).join(sep);
const tel = (p) => 'tel:' + p.replace(/[^+\d]/g, '');
const first = (name) => String(name).split(' ')[0];

function shotPicture(root, file, { alt = '', sizes = '(min-width: 1100px) 60vw, 100vw', cls = '', eager = false } = {}) {
  const meta = images[file];
  const src = `${root}assets/shots/${file}`;
  const dims = meta ? ` width="${meta.w}" height="${meta.h}"` : '';
  const load = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  const img = `<img src="${attr(src)}" alt="${attr(alt)}"${dims}${load} decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  if (!meta || !meta.webp || !meta.webp.length) return img;
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  const srcset = meta.webp.map((w) => `${root}assets/shots/${base}-${w}.webp ${w}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${attr(srcset)}" sizes="${attr(sizes)}">${img}</picture>`;
}

function frame(root, p, shot, opts = {}) {
  if (!shot) return placeholderFrame(root, p);
  const url = opts.url ?? p.demo.label ?? '';
  const phone = shot.phone;
  const pic = shotPicture(root, shot.file, { alt: shot.caption, sizes: opts.sizes, eager: opts.eager });
  if (phone) return `<figure class="phone ${opts.cls || ''}" style="--pa:${p.accent}">${pic}</figure>`;
  return `<figure class="frame ${opts.cls || ''}" style="--pa:${p.accent}"><div class="frame-bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(url)}</span></div>${pic}</figure>`;
}

function placeholderFrame(root, p) {
  return `<figure class="frame frame-empty" style="--pa:${p.accent}"><div class="frame-bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(p.demo.label)}</span></div><div class="frame-ph"><img src="${root}${p.icon}" alt="" width="64" height="64"><strong>${esc(p.name)}</strong><span>${esc(p.kind)}</span></div></figure>`;
}

const heroShot = (p) => p.shots.find((s) => s.hero) || p.shots.find((s) => !s.phone) || null;
const phoneShot = (p) => p.shots.find((s) => s.phone) || null;
const accountCount = (p) => p.demo.accounts.length;

// ---------- layout ----------
function head({ title, description, pathName, root, ogImage }) {
  const canonical = `${site.url}/${pathName === 'index.html' ? '' : pathName}`;
  const og = ogImage || `${site.url}/assets/img/og.jpg`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: site.legalName,
    alternateName: 'EVOSOFT',
    url: site.url,
    email: site.email,
    telephone: site.phones,
    description: site.description,
    areaServed: 'Worldwide',
    address: { '@type': 'PostalAddress', addressCountry: 'GE' },
    priceRange: '$50–$2500+',
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EvoSoft">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(og)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFFCF9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0A09" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${root}assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/icon-180.png">
<link rel="preload" href="${root}assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/jakarta.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/css/site.css?v=${BUILD}">
<script>try{var t=localStorage.getItem('evo-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function header(root, active) {
  const links = join(nav, (n) => `<a href="${root}${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`);
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="${root}index.html" aria-label="EvoSoft home">${mark}<span>EVOSOFT</span></a>
    <nav class="nav-links" id="site-nav" aria-label="Main">${links}<a class="nav-cta-m" href="${root}contact.html">Start a project</a></nav>
    <div class="nav-actions">
      <button class="icon-btn theme-toggle" type="button" aria-label="Switch colour theme" title="Switch colour theme">${icon('sun', 'i i-sun')}${icon('moon', 'i i-moon')}</button>
      <a class="btn btn-primary btn-sm nav-cta" href="${root}contact.html"${active === 'contact' ? ' aria-current="page"' : ''}>Start a project</a>
      <button class="icon-btn menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">${icon('menu', 'i i-menu')}${icon('x', 'i i-close')}</button>
    </div>
  </div>
</header>`;
}

function footer(root) {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="${root}index.html" aria-label="EvoSoft home">${mark}<span>EVOSOFT</span></a>
      <p>${esc(site.tagline)} Websites, online stores, business systems, web apps and the tech behind them.</p>
      <p class="muted small">Based in ${esc(site.region)}. Working with clients anywhere, remotely.</p>
    </div>
    <div>
      <h2 class="footer-h">Products</h2>
      <ul class="footer-list">${join(products, (p) => `<li><a href="${root}work/${p.slug}.html">${esc(p.name)}</a></li>`)}<li><a href="${root}demos.html">All live demos</a></li></ul>
    </div>
    <div>
      <h2 class="footer-h">Company</h2>
      <ul class="footer-list">${join(nav.filter((n) => n.key !== 'home' && n.key !== 'demos'), (n) => `<li><a href="${root}${n.href}">${esc(n.label)}</a></li>`)}<li><a href="${root}contact.html">Contact</a></li></ul>
    </div>
    <div>
      <h2 class="footer-h">Get in touch</h2>
      <ul class="footer-list">
        ${join(site.phones, (p) => `<li><a href="${tel(p)}">${icon('phone')}<span>${esc(p)}</span></a></li>`)}
        <li><a href="mailto:${site.email}">${icon('mail')}<span>${esc(site.email)}</span></a></li>
        <li class="muted">${icon('clock')}<span>Replies ${esc(site.responseTime.toLowerCase())}</span></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-base">
    <span>© ${site.year} ${esc(site.legalName)}. All rights reserved.</span>
    <span class="muted">Demo data on this site is fictional.</span>
  </div>
</footer>
<div class="toast" role="status" aria-live="polite"></div>
<dialog class="lightbox" aria-label="Screenshot viewer">
  <button class="icon-btn lb-close" type="button" aria-label="Close">${icon('x')}</button>
  <button class="icon-btn lb-prev" type="button" aria-label="Previous screenshot">${icon('chevronLeft')}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="icon-btn lb-next" type="button" aria-label="Next screenshot">${icon('chevronRight')}</button>
</dialog>
<script src="${root}assets/js/site.js?v=${BUILD}" defer></script>
</body>
</html>`;
}

function page({ file, title, description, active, body, bodyClass = '', ogImage, root: rootOverride }) {
  const depth = file.split('/').length - 1;
  const root = rootOverride ?? (depth ? '../'.repeat(depth) : '');
  const html = `${head({ title, description, pathName: file, root, ogImage })}
<body class="${bodyClass}">
${header(root, active)}
<main id="main">
${body(root)}
</main>
${footer(root)}`;
  const outFile = path.join(OUT, file);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html.replace(/\n\s*\n/g, '\n'));
  pages.push(file);
}
const pages = [];

// ---------- shared blocks ----------
const sectionHead = (eyebrow, title, text, { center = false, id = '' } = {}) =>
  `<div class="section-head${center ? ' center' : ''}"${id ? ` id="${id}"` : ''}>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2>${title}</h2>${text ? `<p class="lead">${text}</p>` : ''}</div>`;

const ctaBand = (root, title = 'Let’s build something great together', text = 'Whether it’s a website, an online store, a business system or something nobody has built yet, tell us about it. The first consultation is free.') => `
<section class="section">
  <div class="wrap">
    <div class="cta-band" data-reveal>
      <div>
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-primary btn-lg" href="${root}contact.html">Start your project ${icon('arrowRight')}</a>
        <a class="btn btn-ghost btn-lg" href="mailto:${site.email}">${icon('mail')} ${esc(site.email)}</a>
      </div>
    </div>
  </div>
</section>`;

function statusPill(p) {
  if (!p.demo.url) return `<span class="status" data-state="soon"><i></i>Coming soon</span>`;
  return `<span class="status" data-state="checking" data-status-url="${attr(p.demo.url)}"><i></i><span>Checking…</span></span>`;
}

function demoButton(p, { cls = 'btn-primary', label = 'Open live demo' } = {}) {
  if (!p.demo.url) return `<span class="btn ${cls} is-disabled" aria-disabled="true">Demo coming soon</span>`;
  return `<a class="btn ${cls}" href="${attr(p.demo.url)}" target="_blank" rel="noopener">${icon('play')} ${esc(label)}</a>`;
}

function accountCard(p, a) {
  const signin = p.demo.signinUrl || p.demo.url;
  const loginLabel = a.loginLabel || p.demo.loginLabel || 'Email';
  const passLabel = a.passwordLabel || p.demo.passwordLabel || 'Password';
  const go = signin && a.signin !== false
    ? `<a class="btn btn-soft btn-sm acct-go" href="${attr(signin)}" target="_blank" rel="noopener" data-login="${attr(a.login)}" data-pass="${attr(a.password)}">${icon('login')} Sign in as ${esc(first(a.name || a.role))}</a>`
    : '';
  return `<article class="acct" data-reveal>
  <div class="acct-top"><span class="acct-role">${esc(a.role)}</span>${a.badge ? `<span class="acct-badge">${esc(a.badge)}</span>` : ''}</div>
  ${a.name ? `<h4 class="acct-name">${esc(a.name)}</h4>` : ''}
  <dl class="cred">
    <div><dt>${esc(loginLabel)}</dt><dd><code>${esc(a.login)}</code><button class="copy" type="button" data-copy="${attr(a.login)}" aria-label="Copy ${attr(loginLabel.toLowerCase())} ${attr(a.login)}">${icon('copy')}${icon('check', 'i i-done')}</button></dd></div>
    <div><dt>${esc(passLabel)}</dt><dd><code>${esc(a.password)}</code><button class="copy" type="button" data-copy="${attr(a.password)}" aria-label="Copy ${attr(passLabel.toLowerCase())}">${icon('copy')}${icon('check', 'i i-done')}</button></dd></div>
  </dl>
  ${a.tries && a.tries.length ? `<div class="tries"><p>Try this</p><ul>${join(a.tries, (t) => `<li>${esc(t)}</li>`)}</ul></div>` : ''}
  ${go}
</article>`;
}

function demoBlock(root, p, { headingLevel = 'h3', withHeader = true } = {}) {
  const d = p.demo;
  const H = headingLevel;
  const accounts = d.accounts.length
    ? `<div class="acct-grid">${join(d.accounts, (a) => accountCard(p, a))}</div>`
    : `<p class="note">${icon('info')} Demo accounts are being prepared.</p>`;
  const tables = join(d.tables, (t) => `
    <div class="demo-table" data-reveal>
      <${H}>${esc(t.title)}</${H}>
      ${t.text ? `<p class="muted">${esc(t.text)}</p>` : ''}
      <div class="table-scroll"><table>
        <thead><tr>${join(t.columns, (c) => `<th scope="col">${esc(c)}</th>`)}</tr></thead>
        <tbody>${join(t.rows, (r) => `<tr>${join(r, (c, i) => (i === 0 ? `<td><code>${esc(c)}</code>${t.copyFirst === false ? '' : `<button class="copy copy-sm" type="button" data-copy="${attr(c)}" aria-label="Copy ${attr(c)}">${icon('copy')}${icon('check', 'i i-done')}</button>`}</td>` : `<td>${esc(c)}</td>`))}</tr>`)}</tbody>
      </table></div>
    </div>`);
  const stepsHtml = d.steps
    ? `<div class="demo-steps" data-reveal><${H}>${esc(d.steps.title)}</${H}><ol>${join(d.steps.items, (s) => `<li>${esc(s)}</li>`)}</ol></div>`
    : '';
  const extras = d.extras && d.extras.length
    ? `<div class="demo-extras" data-reveal><${H}>${esc(d.extrasTitle || 'Handy test data')}</${H}><ul>${join(d.extras, ([k, v]) => `<li><span>${esc(k)}</span><code>${esc(v)}</code></li>`)}</ul></div>`
    : '';
  const side = stepsHtml || extras || tables ? `<div class="demo-more">${stepsHtml}${extras}</div>${tables}` : '';
  const head = withHeader === 'compact'
    ? `<div class="demo-bar"><p class="demo-url">${statusPill(p)}<span>${esc(d.label || '')}</span></p>${demoButton(p)}</div>`
    : withHeader
    ? `<div class="demo-head">
        <div class="demo-id"><img src="${root}${p.icon}" alt="" width="44" height="44"><div><${H} class="demo-title">${esc(p.name)} <span>${esc(p.kind)}</span></${H}><p class="demo-url">${statusPill(p)}<span>${esc(d.label || '')}</span></p></div></div>
        <div class="demo-actions">${demoButton(p)}<a class="btn btn-ghost" href="${root}work/${p.slug}.html">Case study ${icon('arrowRight')}</a></div>
      </div>`
    : '';
  return `${head}
  <div class="demo-about">
    <p>${icon('users')}<span>${esc(d.company)}</span></p>
    ${d.note ? `<p>${icon('info')}<span>${esc(d.note)}</span></p>` : ''}
    <p>${icon('rotate')}<span>${esc(d.resets)}</span></p>
  </div>
  ${accounts}
  ${side}`;
}

function productRow(root, p, i) {
  const shot = heroShot(p);
  return `<article class="prow${i % 2 ? ' flip' : ''}" style="--pa:${p.accent}" data-reveal>
  <div class="prow-text">
    <p class="chip"><img src="${root}${p.icon}" alt="" width="20" height="20">${esc(p.category)} · ${esc(p.kind)}</p>
    <h3>${esc(p.name)}</h3>
    <p class="prow-tag">${esc(p.tagline)}</p>
    <p>${esc(p.summary)}</p>
    <ul class="ticks">${join(p.highlights.slice(0, 3), (h) => `<li>${icon('check')}<span><strong>${esc(h.title)}.</strong> ${esc(h.text)}</span></li>`)}</ul>
    <div class="prow-actions">${demoButton(p, { label: 'Try the live demo' })}<a class="btn btn-ghost" href="${root}work/${p.slug}.html">Case study ${icon('arrowRight')}</a></div>
    <p class="prow-meta">${statusPill(p)}${accountCount(p) ? `<span>${accountCount(p)} demo account${accountCount(p) > 1 ? 's' : ''}</span>` : ''}</p>
  </div>
  <div class="prow-media">${frame(root, p, shot, { sizes: '(min-width: 1100px) 640px, 100vw' })}</div>
</article>`;
}

function clientCard(c) {
  const thumb = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(c.url)}?w=800&h=500`;
  return `<article class="client" data-reveal>
  <a class="client-shot" href="${attr(c.url)}" target="_blank" rel="noopener" aria-label="Visit ${attr(c.name)} (opens in a new tab)"><img src="${attr(thumb)}" alt="Homepage of ${attr(c.name)}" width="800" height="500" loading="lazy" decoding="async"><span class="client-fallback">${esc(c.name)}</span></a>
  <div class="client-body">
    <p class="eyebrow">${esc(c.kind)}</p>
    <h3><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)} ${icon('arrowUpRight')}</a></h3>
    <p>${esc(c.text)}</p>
    <ul class="dots">${join(c.points, (x) => `<li>${esc(x)}</li>`)}</ul>
  </div>
</article>`;
}

const planLabel = (lane, t) => `${lane.key === 'email' ? 'Email: ' : ''}${t.name} (${t.price})`;
const tierCard = (lane) => (t) => {
  return `<article class="tier${t.popular ? ' popular' : ''}" data-reveal>
  ${t.popular ? '<span class="tier-flag">Most popular</span>' : ''}
  <h3>${esc(t.name)}</h3>
  <p class="tier-for">${esc(t.for)}</p>
  <p class="tier-price">${esc(t.price)}</p>
  <ul class="ticks">${join(t.features, (f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`)}</ul>
  <a class="btn ${t.popular ? 'btn-primary' : 'btn-ghost'} btn-block" href="contact.html?plan=${encodeURIComponent(planLabel(lane, t))}">Get started</a>
</article>`;
};

function customCard(c) {
  return `<article class="tier tier-custom" data-reveal>
  <span class="tier-flag">Any project</span>
  <h3>${esc(c.name)}</h3>
  <p class="tier-for">${esc(c.for)}</p>
  <p class="tier-price">${esc(c.price)}</p>
  <p class="tier-text">${esc(c.text)}</p>
  <ul class="ticks">${join(c.features, (f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`)}</ul>
  <a class="btn btn-primary btn-block" href="contact.html?plan=${encodeURIComponent('Custom project')}">Tell us about it</a>
</article>`;
}

const shotButton = (root, s) => `<button class="shot${s.phone ? ' is-phone' : ''}${s.wide ? ' is-wide' : ''}" type="button" data-lightbox="${attr(root + 'assets/shots/' + s.file)}" data-caption="${attr(s.caption)}"${s.phone ? '' : ' data-reveal'}>
      ${shotPicture(root, s.file, { alt: s.caption, sizes: s.phone ? '280px' : '(min-width: 1100px) 560px, 100vw' })}
      <span class="shot-cap"><strong>${esc(s.caption)}</strong>${s.as ? `<small>Signed in as ${esc(s.as)}</small>` : ''}</span>
    </button>`;

const faqList = (items) =>
  `<div class="faq">${join(items, (f) => `<details data-reveal><summary>${esc(f.q)}<span class="plus" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`)}</div>`;

const serviceCard = (s) => `<article class="svc" data-reveal>
  <span class="svc-icon">${icon(s.icon)}</span>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.text)}</p>
  <ul class="dots">${join(s.points, (x) => `<li>${esc(x)}</li>`)}</ul>
</article>`;

const processBlock = () => `<ol class="process">${join(steps, (s, i) => `<li data-reveal><span class="step-n">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`)}</ol>`;

// ---------- pages ----------
function heroCollage(root) {
  const [a, b, c] = products;
  const sa = heroShot(a), sb = heroShot(b), sc = phoneShot(c) || phoneShot(a);
  const phoneOwner = phoneShot(c) ? c : a;
  return `<div class="collage" aria-hidden="false">
    <div class="collage-back">${frame(root, b, sb, { sizes: '(min-width: 1100px) 520px, 80vw' })}</div>
    <div class="collage-main">${frame(root, a, sa, { sizes: '(min-width: 1100px) 640px, 92vw', eager: true })}</div>
    ${sc ? `<div class="collage-phone">${frame(root, phoneOwner, sc, { sizes: '220px' })}</div>` : ''}
    <div class="float-badge fb-1">${icon('play')}<span><strong>Live demos</strong> Sign in and click around</span></div>
    <div class="float-badge fb-2">${icon('users')}<span><strong>${products.reduce((n, p) => n + accountCount(p), 0)} test accounts</strong> Every role, ready to use</span></div>
  </div>`;
}

page({
  file: 'index.html',
  active: 'home',
  title: 'EvoSoft: any kind of project, built properly',
  description: site.description,
  bodyClass: 'home',
  body: (root) => `
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow"><span class="pulse" aria-hidden="true"></span>Software studio · ${esc(site.region)} · Remote worldwide</p>
      <h1>Any kind of project. <span class="grad">Built to work for you.</span></h1>
      <p class="hero-lead">Websites, online stores, business systems, web apps and the tech behind them. Don’t take our word for it: sign in to the software we’ve built, with real test accounts.</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="${root}contact.html">Start your project ${icon('arrowRight')}</a>
        <a class="btn btn-ghost btn-lg" href="${root}demos.html">${icon('play')} Try a live demo</a>
      </div>
      <p class="trusted"><span>Trusted by businesses across Georgia</span>${join(clients, (c) => `<a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`)}</p>
    </div>
    ${heroCollage(root)}
  </div>
</section>

<section class="section" id="products">
  <div class="wrap">
    ${sectionHead('Built in-house', 'Proof, not mock-ups', 'Three products we designed, built and run ourselves. Each one has a live demo with an account for every role, so you can see exactly how we work.')}
    <div class="prows">${join(products, (p, i) => productRow(root, p, i))}</div>
  </div>
</section>

<section class="section band">
  <div class="wrap demo-band" data-reveal>
    <div>
      <p class="eyebrow">Live demo centre</p>
      <h2>Every role. Every test account.</h2>
      <p class="lead">Sign in as an owner, a cashier, a student or a moderator and see what each of them sees. The demos are real installs with fictional data, and they reset themselves, so you can’t break anything.</p>
      <a class="btn btn-primary btn-lg" href="${root}demos.html">Open the demo centre ${icon('arrowRight')}</a>
    </div>
    <ul class="demo-band-list">
      ${join(products, (p) => `<li><a href="${root}demos.html#${p.slug}"><img src="${root}${p.icon}" alt="" width="36" height="36"><span><strong>${esc(p.name)}</strong><small>${esc(p.kind)}</small></span><em>${accountCount(p) || '—'} <small>accounts</small></em>${icon('arrowRight')}</a></li>`)}
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead('What we do', 'Any kind of project, including tech', 'From a first website to the system your business runs on, one team handles the whole picture.')}
    <div class="svc-grid">${join(services, serviceCard)}</div>
    <p class="center-link"><a class="link" href="${root}services.html">All services ${icon('arrowRight')}</a></p>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    ${sectionHead('Client work', 'Recent websites', 'A few of the sites we’ve shipped for clients across different industries.')}
    <div class="client-grid">${join(clients, clientCard)}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead('How we work', 'From first call to launch', 'A straightforward process, so you always know what’s next.')}
    ${processBlock()}
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    ${sectionHead('Pricing', 'Packages for every stage', 'Clear prices for the most common projects, and a free, fixed quote for everything else.')}
    <div class="tier-grid four">${join(pricing.lanes[0].tiers, tierCard(pricing.lanes[0]))}${customCard(pricing.lanes[0].custom)}</div>
    <p class="center-link"><a class="link" href="${root}pricing.html">Full pricing, add-ons and email plans ${icon('arrowRight')}</a></p>
  </div>
</section>
${ctaBand(root)}
`,
});

page({
  file: 'portfolio.html',
  active: 'portfolio',
  title: 'Work: products and client websites · EvoSoft',
  description: 'Products built in-house by EvoSoft (Evo, Mailtabs, StudyCat) with live demos, plus recent client websites: Larifan, BabyCalm Georgia and IPG.',
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Our work</p>
    <h1>Software we built, sites we shipped</h1>
    <p class="hero-lead">Our own products, each with a live demo and test accounts, and a selection of client websites.</p>
  </div>
</section>
<section class="section tight-top">
  <div class="wrap">
    ${sectionHead('Products', 'Built and run in-house', '')}
    <div class="prows">${join(products, (p, i) => productRow(root, p, i))}</div>
  </div>
</section>
<section class="section alt">
  <div class="wrap">
    ${sectionHead('Client websites', 'Recent builds', 'Sites we’ve designed and built for clients across different industries.')}
    <div class="client-grid">${join(clients, clientCard)}</div>
  </div>
</section>
${ctaBand(root, 'Want to be next?')}
`,
});

page({
  file: 'demos.html',
  active: 'demos',
  title: 'Live demos with test accounts · EvoSoft',
  description: 'Sign in to live demos of Evo, Mailtabs and StudyCat with a ready-made test account for every role. Real installs, fictional data, automatic resets.',
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Live demo centre</p>
    <h1>Sign in and look around</h1>
    <p class="hero-lead">Every product below is a real install with fictional data. Pick a role, copy its account and open the demo. Nothing you do reaches real people, and each demo resets itself.</p>
    <ol class="how">
      <li>${icon('users')}<span><strong>Pick a role</strong> Owner, cashier, student, moderator…</span></li>
      <li>${icon('copy')}<span><strong>Copy the account</strong> One tap copies the email or password</span></li>
      <li>${icon('play')}<span><strong>Open the demo</strong> Sign in and try the suggestions</span></li>
    </ol>
    <nav class="jump" aria-label="Jump to a demo">${join(products, (p) => `<a href="#${p.slug}"><img src="${root}${p.icon}" alt="" width="22" height="22">${esc(p.name)}${statusPill(p)}</a>`)}</nav>
  </div>
</section>
${join(products, (p, i) => `
<section class="section demo-section${i % 2 ? ' alt' : ''}" id="${p.slug}" style="--pa:${p.accent}">
  <div class="wrap">${demoBlock(root, p)}</div>
</section>`)}
${ctaBand(root, 'Like what you see?', 'We can build something like this for your business, or something completely different. Tell us what you need and we’ll give you a free, fixed quote.')}
`,
});

for (const [idx, p] of products.entries()) {
  const next = products[(idx + 1) % products.length];
  const hero = heroShot(p);
  const gallery = p.shots.filter((s) => s !== hero || p.shots.length === 1);
  page({
    file: `work/${p.slug}.html`,
    active: 'portfolio',
    title: `${p.name}: ${p.tagline.replace(/\.$/, '')} · EvoSoft`,
    description: `${p.summary} Try the live demo with ready-made test accounts.`,
    ogImage: p.og || hero ? `${site.url}/assets/shots/${p.og || hero.file}` : undefined,
    bodyClass: 'product',
    body: (root) => `
<section class="p-hero" style="--pa:${p.accent}">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${root}portfolio.html">Work</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>
    <div class="p-hero-grid">
      <div>
        <p class="chip"><img src="${root}${p.icon}" alt="" width="20" height="20">${esc(p.category)} · ${esc(p.kind)}</p>
        <h1>${esc(p.name)}</h1>
        <p class="p-tag">${esc(p.tagline)}</p>
        <p class="hero-lead">${esc(p.intro)}</p>
        <div class="hero-actions">${demoButton(p)}<a class="btn btn-ghost" href="#demo">${icon('key')} Demo accounts</a>${p.live ? `<a class="btn btn-ghost" href="${attr(p.live.url)}" target="_blank" rel="noopener">${icon('globe')} ${esc(p.live.label)}</a>` : ''}</div>
        <ul class="stack" aria-label="Built with">${join(p.stack, (s) => `<li>${esc(s)}</li>`)}</ul>
      </div>
      <dl class="p-stats">${join(p.stats, (s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)}</dl>
    </div>
    <div class="p-hero-shot" data-reveal>${frame(root, p, hero, { sizes: '(min-width: 1240px) 1200px, 100vw', eager: true })}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead('What it does', `Everything in one ${esc(p.kind.toLowerCase())}`, '')}
    <div class="hl-grid">${join(p.highlights, (h) => `<article class="hl" data-reveal style="--pa:${p.accent}"><span class="svc-icon">${icon(h.icon)}</span><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></article>`)}</div>
  </div>
</section>

${gallery.length ? `<section class="section alt">
  <div class="wrap">
    ${sectionHead('Screens', 'A look inside', 'Real screenshots from the demo install. Click any of them to enlarge.')}
    <div class="gallery">${join(gallery.filter((s) => !s.phone), (s) => shotButton(root, s))}</div>
    ${gallery.some((s) => s.phone) ? `<div class="phone-row" data-reveal>
      <div class="phone-row-text"><span class="svc-icon">${icon('smartphone')}</span><h3>${esc(p.phoneTitle || 'On a phone, too')}</h3><p>${esc(p.phoneText || 'The same app, laid out for a small screen.')}</p></div>
      <div class="phone-row-shots">${join(gallery.filter((s) => s.phone), (s) => shotButton(root, s))}</div>
    </div>` : ''}
  </div>
</section>` : ''}

<section class="section">
  <div class="wrap">
    ${sectionHead('Features', 'The details', '')}
    <div class="feat-grid">${join(p.features, (g) => `<div class="feat" data-reveal><h3>${esc(g.title)}</h3><ul class="ticks">${join(g.items, (x) => `<li>${icon('check')}<span>${esc(x)}</span></li>`)}</ul></div>`)}</div>
  </div>
</section>

<section class="section alt demo-section" id="demo" style="--pa:${p.accent}">
  <div class="wrap">
    ${sectionHead('Try it yourself', `Sign in to the ${esc(p.name)} demo`, `Use the accounts below on the live demo at <strong>${esc(p.demo.label)}</strong>. Tap a value to copy it.`)}
    ${demoBlock(root, p, { headingLevel: 'h3', withHeader: 'compact' })}
  </div>
</section>

${ctaBand(root, `Need something like ${esc(p.name)}?`, 'We build business systems, web apps and websites to fit how you actually work. Tell us about your project for a free, fixed quote.')}

<section class="section tight-top">
  <div class="wrap">
    <a class="next-product" href="${root}work/${next.slug}.html" style="--pa:${next.accent}">
      <span class="muted">Next product</span>
      <span class="np-name"><img src="${root}${next.icon}" alt="" width="36" height="36">${esc(next.name)}<small>${esc(next.tagline)}</small></span>
      ${icon('arrowRight')}
    </a>
  </div>
</section>
`,
  });
}

page({
  file: 'services.html',
  active: 'services',
  title: 'Services: any kind of project, including tech · EvoSoft',
  description: 'Custom software, web apps, business systems, websites, ecommerce, SEO, graphic design, Microsoft 365 email and IT support from EvoSoft.',
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Our services</p>
    <h1>Any kind of project, including tech</h1>
    <p class="hero-lead">Websites are where many clients start, but we don’t stop there. If your business needs it built, connected, set up or fixed, one team handles the whole picture.</p>
  </div>
</section>
<section class="section tight-top">
  <div class="wrap"><div class="svc-grid">${join(services, serviceCard)}</div></div>
</section>
<section class="section alt">
  <div class="wrap">
    ${sectionHead('Proof', 'Products we built ourselves', 'The best way to judge a studio is to use its software. These three are live, with test accounts for every role.')}
    <div class="mini-products">${join(products, (p) => `<a class="mini-p" href="${root}work/${p.slug}.html" style="--pa:${p.accent}" data-reveal><img src="${root}${p.icon}" alt="" width="44" height="44"><span><strong>${esc(p.name)}</strong><small>${esc(p.tagline)}</small></span>${icon('arrowRight')}</a>`)}</div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${sectionHead('How we work', 'From first call to launch', '')}
    ${processBlock()}
  </div>
</section>
${ctaBand(root)}
`,
});

page({
  file: 'pricing.html',
  active: 'pricing',
  title: 'Pricing: clear packages, no surprises · EvoSoft',
  description: 'Transparent project and email pricing from EvoSoft: Basic $300–500, Standard $700–1000, Premium $1500–2500, Microsoft 365 from $50, and free quotes for custom software.',
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Pricing</p>
    <h1>Straightforward packages, no surprises</h1>
    <p class="hero-lead">Pick a lane and see exactly what’s included before you commit. Anything that doesn’t fit a package gets a free, fixed quote.</p>
  </div>
</section>
<section class="section tight-top">
  <div class="wrap">
    <div class="tabs" role="tablist" aria-label="Pricing">${join(pricing.lanes, (l, i) => `<button class="tab" type="button" role="tab" id="tab-${l.key}" aria-controls="lane-${l.key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(l.label)}</button>`)}</div>
    ${join(pricing.lanes, (l, i) => `
    <div class="lane" role="tabpanel" id="lane-${l.key}" aria-labelledby="tab-${l.key}"${i ? ' hidden' : ''}>
      <p class="lane-intro">${esc(l.intro)}</p>
      <div class="tier-grid${l.custom ? ' four' : ''}">${join(l.tiers, tierCard(l))}${l.custom ? customCard(l.custom) : ''}</div>
      <div class="addons" data-reveal>
        <h2>Add-ons</h2>
        <ul>${join(l.addons, ([k, v]) => `<li><span>${esc(k)}</span><strong>${esc(v)}</strong></li>`)}</ul>
      </div>
    </div>`)}
  </div>
</section>
<section class="section alt">
  <div class="wrap narrow">
    ${sectionHead('FAQ', 'Pricing questions, answered', '', { center: true })}
    ${faqList(faq.slice(0, 5))}
  </div>
</section>
${ctaBand(root)}
`,
});

page({
  file: 'about.html',
  active: 'about',
  title: 'About EvoSoft: your partner for projects that perform',
  description: 'EvoSoft builds websites, online stores, business systems, web apps and tech setups for businesses that want things that actually work.',
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">About us</p>
    <h1>Your partner for projects that actually perform</h1>
    <p class="hero-lead">EvoSoft Solutions takes on any kind of project: websites and online stores, business software, web apps, SEO, graphic design, Microsoft 365 email and the tech in between. Every project is built to look sharp and work without friction, from the first click to the last.</p>
  </div>
</section>
<section class="section tight-top">
  <div class="wrap about-grid">
    <article class="about-card" data-reveal><span class="svc-icon">${icon('users')}</span><h2>Who we serve</h2><p>Small and medium-sized businesses, startups, entrepreneurs, ecommerce brands, local shops, schools, bloggers and creators who need something built, redesigned, connected or fixed.</p></article>
    <article class="about-card" data-reveal><span class="svc-icon">${icon('zap')}</span><h2>Our mission</h2><p>We build things that look great and run flawlessly: responsive, user-friendly and ready to grow from day one, because your software should work as hard as you do.</p></article>
    <article class="about-card" data-reveal><span class="svc-icon">${icon('code')}</span><h2>We build our own products</h2><p>Evo, Mailtabs and StudyCat are designed, built and run in-house. They’re how we keep our skills sharp, and you can try every one of them with real test accounts.</p></article>
  </div>
</section>
<section class="section alt">
  <div class="wrap">
    ${sectionHead('How we work', 'From first call to launch', 'A straightforward process, so you always know what’s next.')}
    ${processBlock()}
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${sectionHead('Why us', 'Built around your business, not a template', '')}
    <div class="values">${join(
      [
        ['Made for your brand', 'Every project is designed around your identity and goals, not a reused theme.'],
        ['Transparent pricing', 'Clear packages for common projects and fixed quotes for everything else.'],
        ['Fast turnaround', 'We move quickly without cutting corners on quality.'],
        ['Any kind of project', 'Websites, stores, business systems, apps, email and IT: one team for all of it.'],
        ['Built to last', 'Clean, documented work that is easy to extend, with SEO and security built in.'],
        ['Long-term relationships', 'Ongoing maintenance and support keep things running long after launch.'],
      ],
      ([t, d]) => `<div class="value" data-reveal>${icon('check')}<div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></div>`,
    )}</div>
  </div>
</section>
${ctaBand(root)}
`,
});

page({
  file: 'contact.html',
  active: 'contact',
  title: 'Contact EvoSoft: free consultation',
  description: `Call ${site.phones.join(' or ')}, or email ${site.email}. Free consultation for websites, online stores, software, email and tech projects. We reply within 1 business day.`,
  body: (root) => `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Contact us</p>
    <h1>Ready to start your project?</h1>
    <p class="hero-lead">Reach out for a free consultation. Tell us what you need and we’ll come back with a realistic scope and price.</p>
  </div>
</section>
<section class="section tight-top">
  <div class="wrap contact-grid">
    <div class="contact-cards">
      <div class="ccard" data-reveal><span class="svc-icon">${icon('phone')}</span><div><h2>Phone</h2>${join(site.phones, (p) => `<p><a href="${tel(p)}">${esc(p)}</a></p>`)}</div></div>
      <div class="ccard" data-reveal><span class="svc-icon">${icon('mail')}</span><div><h2>Email</h2><p><a href="mailto:${site.email}">${esc(site.email)}</a></p></div></div>
      <div class="ccard" data-reveal><span class="svc-icon">${icon('clock')}</span><div><h2>Response time</h2><p>${esc(site.responseTime)}</p></div></div>
      <div class="ccard" data-reveal><span class="svc-icon">${icon('globe')}</span><div><h2>Where</h2><p>Based in ${esc(site.region)}, working with clients anywhere, remotely.</p></div></div>
    </div>
    <form class="brief" id="brief" data-email="${attr(site.email)}" novalidate data-reveal>
      <h2>Tell us about your project</h2>
      <p class="muted small">This opens your email app with everything filled in, ready to send to ${esc(site.email)}.</p>
      <div class="field-row">
        <label class="field"><span>Your name</span><input name="name" autocomplete="name" required></label>
        <label class="field"><span>Your email</span><input name="email" type="email" autocomplete="email" required></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Phone <em>(optional)</em></span><input name="phone" type="tel" autocomplete="tel"></label>
        <label class="field"><span>What do you need?</span><select name="type">
          <option>A website</option><option>An online store</option><option>A web app or custom software</option><option>A business system (POS, HR, inventory…)</option><option>Microsoft 365 / business email</option><option>SEO or a redesign</option><option>Graphic design or branding</option><option>IT or tech help</option><option>Something else</option>
        </select></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Package or budget</span><select name="plan">
          <option>Not sure yet</option><option>Basic ($300–500)</option><option>Standard ($700–1000)</option><option>Premium ($1500–2500)</option><option>Custom project</option><option>Email: Basic ($50)</option><option>Email: Standard ($150)</option><option>Email: Premium ($300)</option>
        </select></label>
        <label class="field"><span>Timeline</span><select name="timeline"><option>Flexible</option><option>As soon as possible</option><option>Within a month</option><option>In 1–3 months</option></select></label>
      </div>
      <label class="field"><span>About the project</span><textarea name="message" rows="5" required placeholder="What you need, who it’s for, and any sites or apps you like."></textarea></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('send')} Write the email</button>
      <p class="muted small center">Prefer to talk? Call <a href="${tel(site.phones[0])}">${esc(site.phones[0])}</a>.</p>
    </form>
  </div>
</section>
<section class="section alt">
  <div class="wrap narrow">
    ${sectionHead('FAQ', 'Before you reach out', '', { center: true })}
    ${faqList([faq[5], faq[6], faq[7], faq[0]])}
  </div>
</section>
`,
});

page({
  file: '404.html',
  active: '',
  title: 'Page not found · EvoSoft',
  description: 'This page does not exist.',
  root: '/',
  body: () => `
<section class="page-hero notfound">
  <div class="wrap">
    <p class="eyebrow">404</p>
    <h1>This page wandered off</h1>
    <p class="hero-lead">The link may be old, or the page has moved.</p>
    <div class="hero-actions"><a class="btn btn-primary" href="/index.html">Go home ${icon('arrowRight')}</a><a class="btn btn-ghost" href="/demos.html">${icon('play')} Live demos</a></div>
  </div>
</section>`,
});

// ---------- sitemap & robots ----------
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((p) => p !== '404.html')
  .map((p) => `  <url><loc>${site.url}/${p === 'index.html' ? '' : p}</loc><lastmod>${today}</lastmod></url>`)
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

console.log(`Built ${pages.length} pages into ${path.relative(process.cwd(), OUT) || OUT}`);
