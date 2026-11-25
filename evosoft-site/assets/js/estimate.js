/* EvoSoft quote builder (/estimate): the price estimate and the page that builds a design with it.
   © 2026 EvoSoft Solutions. All rights reserved. No dependencies.

   window.EvoEstimate = { estimate(design, pricing), normalise(design, pricing), encode(design), decode(text) }
   estimate() follows the rules written out in site-builder/data/pricing.mjs, exactly as api/lib.php's evo_estimate()
   does on the server (the server's figure is the one that counts; this one is for the live price). Every amount is
   rounded half up to whole dollars before the lines are added up. The range is rounded to the nearest 50, halves up,
   after the product is snapped to 6 decimals, so a value like 574.99999999 counts as the 575 it really is.

   The page keeps the visitor's design in the address (#d=<base64url JSON>), never in browser storage, so a reload or a
   shared link brings it back. */
(function () {
  'use strict';

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
  const roundUp = (x) => Math.floor(x + 0.5); // half up (every amount here is positive)
  const snap = (x) => Math.round(x * 1e6) / 1e6;
  const round50 = (x) => Math.floor(snap(x) / 50 + 0.5) * 50;

  // A design as the rules allow it: unknown keys and values dropped, numbers clamped, "home" always there.
  function normalise(input, P) {
    const d = isObj(input) ? input : {};
    const b = isObj(d.business) ? d.business : {};
    const l = isObj(d.look) ? d.look : {};
    const c = isObj(d.content) ? d.content : {};
    const pick = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def);
    const int = (v, lo, hi, def) => {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.trunc(n))) : def;
    };
    const text = (v, max) => (typeof v === 'string' ? Array.from(v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim() : '');
    const list = (v) => (Array.isArray(v) ? v : []);
    const type = pick(d.type, Object.keys(P.types), 'business');
    const features = Object.keys(P.features).filter((f) => list(d.features).includes(f));
    return {
      v: 1,
      type,
      business: { name: text(b.name, 60), industry: pick(b.industry, P.industries, 'other'), tagline: text(b.tagline, 120) },
      look: {
        palette: pick(l.palette, P.palettes, 'navy'),
        accent: typeof l.accent === 'string' && /^#[0-9a-f]{6}$/i.test(l.accent) ? l.accent.toLowerCase() : '#ff6b5b',
        font: pick(l.font, P.fonts, 'modern'),
        layout: pick(l.layout, P.layouts, 'clean'),
        mode: pick(l.mode, P.modes, 'light'),
      },
      pages: ['home'].concat(P.pages.filter((p) => p !== 'home' && list(d.pages).includes(p))),
      extraPages: int(d.extraPages, 0, P.maxExtraPages, 0),
      features,
      languages: features.includes('multilingual') ? int(d.languages, 1, P.maxLanguages, 1) : 1,
      products: type === 'store' ? pick(d.products, Object.keys(P.products), 'small') : 'small',
      content: { copywriting: c.copywriting === true, logo: c.logo === true, photos: c.photos === true },
      care: pick(d.care, Object.keys(P.care), 'none'),
      timeline: pick(d.timeline, Object.keys(P.timeline), 'standard'),
    };
  }

  function estimate(design, P) {
    const d = normalise(design, P);
    const T = P.types[d.type];
    const lines = [];
    const add = (key, amount, qty) => {
      const a = roundUp(amount);
      if (a > 0) lines.push(qty === undefined ? { key, amount: a } : { key, amount: a, qty });
    };
    lines.push({ key: 'base', amount: roundUp(T.base) });
    const pages = d.pages.length + d.extraPages;
    const extra = Math.max(0, pages - T.pages);
    add('extraPages', extra * T.extraPage, extra);
    let priced = 0;
    for (const f of d.features) {
      const F = P.features[f];
      let amount = (F.includedIn || []).includes(d.type) ? 0 : F.price;
      if (f === 'multilingual') amount = amount ? F.price * (d.languages - 1) : 0;
      if (amount > 0) {
        priced++;
        add('feature:' + f, amount, f === 'multilingual' ? d.languages - 1 : undefined);
      }
    }
    if (d.type === 'store') add('products', P.products[d.products].price);
    if (d.content.copywriting) add('copywriting', P.content.copywriting.perPage * pages, pages);
    if (d.content.logo) add('logo', P.content.logo.price);
    if (d.content.photos) add('photos', P.content.photos.price);
    const subtotal = lines.reduce((s, x) => s + x.amount, 0);
    const tl = P.timeline[d.timeline] || {};
    const factor = typeof tl.factor === 'number' ? tl.factor : 1;
    if (factor !== 1) {
      const rush = roundUp(snap(subtotal * factor)) - subtotal;
      if (rush !== 0) lines.push({ key: 'rush', amount: rush });
    }
    const total = lines.reduce((s, x) => s + x.amount, 0);
    const more = Math.ceil(extra / 5) + Math.floor(priced / 3);
    let wmin = T.weeks[0] + more;
    let wmax = T.weeks[1] + more;
    if (typeof tl.weeksFactor === 'number') {
      wmin = Math.ceil(snap(wmin * tl.weeksFactor));
      wmax = Math.ceil(snap(wmax * tl.weeksFactor));
    }
    wmin = Math.max(1, wmin);
    wmax = Math.max(wmax, wmin + 1);
    return {
      currency: P.currency || 'USD',
      total,
      low: round50(total * P.range.low),
      high: round50(total * P.range.high),
      monthly: (P.care[d.care] || { monthly: 0 }).monthly,
      weeks: [wmin, wmax],
      pages,
      extraPages: extra,
      lines,
    };
  }

  // The design in the address: base64url of its JSON (UTF-8), so names in any language survive.
  function encode(design) {
    const bytes = new TextEncoder().encode(JSON.stringify(design));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(text) {
    try {
      let s = String(text || '').replace(/^#/, '').replace(/^d=/, '');
      if (!s || s.length > 6000 || /[^A-Za-z0-9_-]/.test(s)) return null;
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return isObj(obj) && obj.v === 1 ? obj : null;
    } catch (e) {
      return null;
    }
  }

  const API = { estimate, normalise, encode, decode };
  if (typeof window !== 'undefined') window.EvoEstimate = API;
  if (typeof document === 'undefined') return;

  /* ===================================== the /estimate page ===================================== */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = $('#est');
  const dataEl = $('#est-data');
  if (!root || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
  const P = DATA.pricing;
  const T = DATA.strings;
  const PVS = DATA.preview || {};
  let G = {};
  try { G = JSON.parse($('#evo-i18n').textContent); } catch (e) { G = {}; }
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (has(vars, k) ? vars[k] : m));
  const plural = (pair, n, more) => fill(n === 1 ? pair[0] : pair[1], Object.assign({ n: num(n) }, more || {}));
  let nf, cf;
  try { nf = new Intl.NumberFormat(T.locale); cf = new Intl.NumberFormat(T.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 }); } catch (e) { nf = new Intl.NumberFormat('en-US'); cf = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  const num = (n) => nf.format(n);
  const usd = (n) => cf.format(n);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.documentElement.classList.contains('motion');
  const wide = window.matchMedia('(min-width: 1000px)');

  const designForm = $('#est-design');
  const reqForm = $('#est-request');
  const F = designForm.elements;
  const PRESET = DATA.presets;

  // ---------- the form <-> the design ----------
  const radio = (name) => { const el = designForm.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ''; };
  const included = (f, type) => ((P.features[f] || {}).includedIn || []).includes(type);
  function readForm() {
    const type = radio('type') || 'business';
    return {
      v: 1,
      type,
      business: { name: F.bname.value, industry: F.industry.value, tagline: F.tagline.value },
      look: { palette: radio('palette'), accent: F.accent.value, font: radio('font'), layout: radio('layout'), mode: radio('mode') },
      pages: $$('input[name="page"]', designForm).filter((x) => x.checked).map((x) => x.value),
      extraPages: Number(F.extraPages.value) || 0,
      features: $$('input[name="feature"]', designForm).filter((x) => (x.disabled ? x.dataset.user === '1' : x.checked)).map((x) => x.value),
      languages: Number(F.languages.value) || 2,
      products: radio('products') || 'small',
      content: { copywriting: F.copywriting.checked, logo: F.logo.checked, photos: F.photos.checked },
      care: radio('care') || 'none',
      timeline: radio('timeline') || 'standard',
    };
  }
  function setRadio(name, value) { $$(`input[name="${name}"]`, designForm).forEach((x) => { x.checked = x.value === value; }); }
  function writeForm(raw) {
    const d = normalise(raw, P);
    setRadio('type', d.type);
    F.bname.value = d.business.name;
    F.industry.value = d.business.industry;
    F.tagline.value = d.business.tagline;
    setRadio('palette', d.look.palette);
    F.accent.value = d.look.accent;
    setRadio('font', d.look.font);
    setRadio('layout', d.look.layout);
    setRadio('mode', d.look.mode);
    $$('input[name="page"]', designForm).forEach((x) => { x.checked = d.pages.includes(x.value); });
    F.extraPages.value = String(d.extraPages);
    $$('input[name="feature"]', designForm).forEach((x) => { x.checked = d.features.includes(x.value); x.disabled = false; delete x.dataset.user; });
    F.languages.value = String(Math.max(2, has(raw, 'languages') ? d.languages : 2));
    setRadio('products', d.type === 'store' ? d.products : (raw && raw.products) || 'small');
    if (!radio('products')) setRadio('products', 'small');
    F.copywriting.checked = d.content.copywriting;
    F.logo.checked = d.content.logo;
    F.photos.checked = d.content.photos;
    setRadio('care', d.care);
    setRadio('timeline', d.timeline);
    pagesTouched = true;
    syncType(d.type);
  }

  // ---------- what depends on the type, the industry and the picks ----------
  let pagesTouched = false;
  let lastType = null;
  function syncType(type) {
    $$('input[name="feature"]', designForm).forEach((x) => {
      const inc = included(x.value, type);
      if (inc && !x.disabled) { x.dataset.user = x.checked ? '1' : '0'; x.checked = true; x.disabled = true; }
      if (!inc && x.disabled) { x.disabled = false; x.checked = x.dataset.user === '1'; delete x.dataset.user; }
      const price = $(`[data-price-for="${x.value}"]`, designForm);
      if (price) price.textContent = inc ? T.included : x.value === 'multilingual' ? fill(T.perLanguage, { price: usd(P.features.multilingual.price) }) : fill(T.plus, { price: usd(P.features[x.value].price) });
      x.closest('.opt').classList.toggle('is-included', inc);
    });
    const prod = $('#est-products');
    if (prod) prod.hidden = type !== 'store';
    if (!pagesTouched && lastType !== null && type !== lastType && PRESET[type]) {
      $$('input[name="page"]', designForm).forEach((x) => { x.checked = x.value === 'home' || PRESET[type].includes(x.value); });
    }
    lastType = type;
  }
  function syncPicks(raw, est) {
    const langs = $('#est-langs');
    if (langs) langs.hidden = !raw.features.includes('multilingual');
    const T0 = P.types[raw.type];
    const stat = $('[data-est="pagestat"]');
    if (stat) stat.textContent = fill(T.pageStat, { n: num(T0.pages), m: num(est.pages), price: usd(T0.extraPage) });
    const cw = $('[data-price-for="copywriting"]');
    if (cw) cw.textContent = plural(T.copyFor, est.pages, { price: usd(P.content.copywriting.perPage * est.pages) });
    const ind = PVS.industries && PVS.industries[raw.business.industry];
    if (ind && ind.name) F.bname.placeholder = fill(T.namePlaceholder, { name: ind.name });
    // a stepper's buttons say when they can't go further (they stay focusable)
    $$('.stepper', designForm).forEach((s) => {
      const input = $('input', s);
      const v = Number(input.value), min = Number(input.min), max = Number(input.max);
      $$('[data-step]', s).forEach((bt) => bt.setAttribute('aria-disabled', String(Number(bt.dataset.step) < 0 ? v <= min : v >= max)));
    });
    $$('.sw-pick').forEach((el) => el.classList.toggle('on', raw.look.palette === 'custom'));
  }

  // ---------- the price ----------
  function lineLabel(x, d) {
    const L = T.lines;
    const screens = d.type === 'webapp';
    if (x.key === 'base') return [T.typeNames[d.type], plural(screens ? T.count.screens : T.count.pages, P.types[d.type].pages)];
    if (x.key === 'extraPages') return [L.extraPages, plural(screens ? T.count.extraScreens : T.count.extraPages, x.qty)];
    if (x.key === 'products') return [L.products, T.productSizes[d.products]];
    if (x.key === 'copywriting') return [L.copywriting, plural(T.count.copyPages, x.qty)];
    if (x.key === 'rush') return [L.rush, fill(L.rushPct, { p: num(Math.round(((P.timeline.rush || {}).factor - 1) * 100)) })];
    if (x.key.startsWith('feature:')) {
      const f = x.key.slice(8);
      return [T.featureNames[f] || f, f === 'multilingual' ? plural(T.count.langs, x.qty) : ''];
    }
    return [L[x.key] || x.key, ''];
  }
  function priceRows(est, d) {
    return est.lines.map((x) => {
      const [label, detail] = lineLabel(x, d);
      return `<tr><th scope="row">${esc(label)}${detail ? ` <span>${esc(detail)}</span>` : ''}</th><td>${esc(usd(x.amount))}</td></tr>`;
    }).join('');
  }
  function summaryRows(d, est) {
    const pageNames = d.pages.map((p) => T.pageNames[p] || p);
    if (d.extraPages) pageNames.push(plural(T.count.extraPages, d.extraPages));
    const feats = d.features.map((f) => T.featureNames[f]).concat(Object.keys(P.features).filter((f) => included(f, d.type) && !d.features.includes(f)).map((f) => T.featureNames[f]));
    if (d.features.includes('multilingual') && d.languages > 1) feats[feats.indexOf(T.featureNames.multilingual)] += ` (${plural(T.count.langsTotal, d.languages)})`;
    if (d.type === 'store') feats.push(T.productSizes[d.products]);
    const content = ['copywriting', 'logo', 'photos'].filter((k) => d.content[k]).map((k) => T.contentNames[k]);
    const biz = [d.business.name, T.industryNames[d.business.industry]].filter(Boolean).join(', ');
    const look = [T.paletteNames[d.look.palette], T.fontNames[d.look.font], T.layoutNames[d.look.layout], T.modeNames[d.look.mode]].join(' · ');
    const rows = [
      [T.sum.type, T.typeNames[d.type]],
      [T.sum.business, biz],
      [T.sum.look, look],
      [T.sum.pages, `${num(est.pages)}: ${pageNames.join(', ')}`],
      [T.sum.features, feats.length ? feats.join(', ') : T.none],
      [T.sum.content, content.length ? content.join(', ') : T.none],
      [T.sum.timeline, T.timelineNames[d.timeline]],
      [T.sum.care, d.care === 'none' ? T.careNames.none : `${T.careNames[d.care]}, ${fill(T.perMonth, { price: usd(est.monthly) })}`],
    ];
    return rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  }
  const setAll = (key, fn) => $$(`[data-est="${key}"]`, root).forEach(fn);
  let lastRange = '';
  let current = null;
  function showPrice(d, est) {
    const range = fill(T.range, { low: usd(est.low), high: usd(est.high) });
    setAll('range', (el) => { el.textContent = range; });
    setAll('weeks', (el) => { el.textContent = fill(T.weeks, { min: num(est.weeks[0]), max: num(est.weeks[1]) }); });
    setAll('monthly', (el) => { el.hidden = !est.monthly; el.textContent = est.monthly ? fill(T.monthly, { price: usd(est.monthly) }) : ''; });
    setAll('lines', (el) => { el.innerHTML = priceRows(est, d); });
    setAll('total', (el) => { el.textContent = usd(est.total); });
    setAll('summary', (el) => { el.innerHTML = summaryRows(d, est); });
    if (range !== lastRange) {
      $$('.est-range', root).forEach((el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
      lastRange = range;
    }
  }
  // the new price is read out once the visitor pauses, not on every click or key
  const live = $('#est-live');
  let announced = '';
  let announceTimer = 0;
  function announce(est) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const text = fill(T.announce, { low: usd(est.low), high: usd(est.high) }) + (est.monthly ? ' ' + fill(T.monthly, { price: usd(est.monthly) }) + '.' : '');
      if (text !== announced && live) { live.textContent = text; announced = text; }
    }, 1200);
  }

  // ---------- the preview ----------
  let device = wide.matches ? 'desktop' : 'phone';
  let pvTimer = 0;
  let pvFocus = null;
  // only the previews that can be seen are drawn (the desktop panel, the phone panel or the full-screen one)
  const targets = () => $$('.est-pv', root).filter((el) => el.getClientRects().length > 0);
  function drawPreview() {
    pvTimer = 0;
    if (!window.EvoPreview || !current) return;
    const focus = pvFocus;
    pvFocus = null;
    targets().forEach((el) => window.EvoPreview.render(el, current, PVS, { device, focus }));
    const sum = $('#est-pv-sum');
    if (sum) sum.textContent = window.EvoPreview.summary(current, PVS);
  }
  function schedulePreview(focus) {
    if (focus) pvFocus = focus;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(drawPreview, 60);
  }

  // ---------- the address ----------
  let hashTimer = 0;
  let written = location.hash;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = 0;
    if (!current) return;
    const h = '#d=' + encode(current);
    if (h !== location.hash) {
      try { history.replaceState(history.state, '', h); } catch (e) { /* a sandboxed frame */ }
    }
    written = h;
  }

  // ---------- one change ----------
  function update(focus, opts) {
    const raw = readForm();
    if (raw.type !== lastType) { syncType(raw.type); }
    const raw2 = readForm();
    const d = normalise(raw2, P);
    const est = estimate(d, P);
    current = d;
    syncPicks(raw2, est);
    showPrice(d, est);
    schedulePreview(focus);
    if (!opts || !opts.quiet) {
      announce(est);
      clearTimeout(hashTimer);
      hashTimer = setTimeout(writeHash, 500);
    }
  }
  function focusFor(el) {
    const n = el.name;
    if (n === 'type' || n === 'bname' || n === 'industry' || n === 'tagline' || n === 'layout') return 'top';
    if (n === 'page') return el.checked ? 'page:' + el.value : null;
    if (n === 'extraPages') return 'page:extra';
    if (n === 'feature') return el.checked ? 'feature:' + el.value : null;
    if (n === 'languages') return 'feature:multilingual';
    if (n === 'products') return 'products';
    return null;
  }
  function onChange(e) {
    const el = e.target;
    if (!el || !el.name) return;
    if (el.name === 'page' || el.name === 'extraPages') pagesTouched = true;
    if (el.name === 'accent') setRadio('palette', 'custom');
    if (el.name === 'feature' && el.value === 'multilingual' && el.checked && Number(F.languages.value) < 2) F.languages.value = '2';
    if (el.type === 'number') {
      const v = Math.trunc(Number(el.value));
      if (e.type === 'change' || (el.value !== '' && Number.isFinite(v))) el.value = String(Math.max(Number(el.min), Math.min(Number(el.max), Number.isFinite(v) ? v : Number(el.min))));
    }
    update(focusFor(el));
  }
  designForm.addEventListener('input', onChange);
  designForm.addEventListener('change', onChange);
  designForm.addEventListener('submit', (e) => e.preventDefault()); // Enter in a field mustn't send anything

  // steppers
  designForm.addEventListener('click', (e) => {
    const bt = e.target.closest('[data-step]');
    if (!bt) return;
    const input = document.getElementById(bt.dataset.for);
    if (!input || bt.getAttribute('aria-disabled') === 'true') return;
    const v = Math.max(Number(input.min), Math.min(Number(input.max), (Number(input.value) || 0) + Number(bt.dataset.step)));
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // the device buttons (there is a set beside each preview; they move together)
  root.addEventListener('click', (e) => {
    const bt = e.target.closest('[data-device]');
    if (!bt) return;
    device = bt.dataset.device;
    $$('[data-device]', root).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.device === device)));
    schedulePreview('top');
  });

  // the breakdown and the phone preview open and close
  root.addEventListener('click', (e) => {
    const bt = e.target.closest('[data-toggle]');
    if (!bt) return;
    const box = document.getElementById(bt.getAttribute('aria-controls'));
    if (!box) return;
    const open = bt.getAttribute('aria-expanded') !== 'true';
    bt.setAttribute('aria-expanded', String(open));
    box.hidden = !open;
    const label = $('.btn-label', bt) || bt;
    label.textContent = open ? bt.dataset.hide : bt.dataset.show;
    if (open) schedulePreview();
  });

  // the full-screen preview on phones
  const dlg = $('#est-dlg');
  $$('[data-open-preview]', root).forEach((bt) => bt.addEventListener('click', () => {
    if (!dlg || typeof dlg.showModal !== 'function') { const m = $('#est-mpv'); if (m) m.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    dlg.showModal();
    drawPreview();
  }));
  if (dlg) {
    $$('[data-close]', dlg).forEach((bt) => bt.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  // "Request this website" goes to the form and puts the cursor in the first field
  $$('[data-go-request]', root).forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const sec = $('#q-request');
    if (sec) sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const first = reqForm && reqForm.elements.name;
    if (first && !reqForm.classList.contains('done')) first.focus({ preventScroll: true });
  }));

  // copy a link to this design
  const toast = (text) => { if (typeof window.evoToast === 'function') window.evoToast(esc(text), 4200); if (live) { live.textContent = text; announced = ''; } };
  async function copy(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* below */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.setProperty('position', 'fixed'); ta.style.setProperty('left', '-9999px'); ta.style.setProperty('top', '0');
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  $$('[data-copy-link]', root).forEach((bt) => bt.addEventListener('click', async () => {
    writeHash();
    const ok = await copy(location.href);
    toast(ok ? T.linkCopied : T.linkFail);
  }));

  // a link with a design in it, opened in this tab (or edited in the address bar)
  window.addEventListener('hashchange', () => {
    if (location.hash === written) return;
    const d = decode(location.hash);
    if (!d) return;
    written = location.hash;
    writeForm(d);
    update('top', { quiet: true });
  });
  // moving between the phone and desktop layouts draws the preview in the other place
  const onWide = () => { schedulePreview(); };
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);

  // ---------- sending the request (like the contact form: per-field errors, focus on the first one) ----------
  if (reqForm) {
    const err = $('.form-error', reqForm);
    const done = $('.form-done', reqForm);
    const btn = $('button[type="submit"]', reqForm);
    const label = $('.btn-label', btn) || btn;
    const idle = label.textContent;
    const email = root.dataset.email;
    const FIELD_MSG = { name: G.errName || 'Please enter your name.', email: G.errEmail || 'Please enter an email address, like name@example.com.' };
    const markFields = (bad) => {
      ['name', 'email'].forEach((n) => {
        const on = bad.includes(n);
        reqForm.elements[n].setAttribute('aria-invalid', String(on));
        const note = $(`#est-err-${n}`, reqForm);
        if (note) { note.textContent = on ? FIELD_MSG[n] : ''; note.hidden = !on; }
      });
      return bad.length ? reqForm.elements[bad[0]] : null;
    };
    const showError = (html) => { err.innerHTML = html; err.hidden = false; };
    const busy = (on) => { btn.setAttribute('aria-disabled', String(on)); label.textContent = on ? (G.sending || 'Sending…') : idle; reqForm.classList.toggle('sending', on); };
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (reqForm.classList.contains('sending')) return;
      const f = reqForm.elements;
      const v = {
        name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), company: f.company.value.trim(),
        message: f.message.value.trim(), website: f.website.value, lang: G.lang || document.documentElement.lang || 'en',
        design: normalise(readForm(), P), source: 'estimate',
      };
      const bad = [];
      if (!v.name) bad.push('name');
      if (!/^\S+@\S+\.\S+$/.test(v.email)) bad.push('email');
      const first = markFields(bad);
      if (first) {
        showError(esc(bad.includes('email') && v.email ? (G.formEmail || 'Please check your email address.') : T.formMissing));
        first.focus();
        return;
      }
      err.hidden = true;
      busy(true);
      let res = null, data = {};
      try {
        res = await fetch(root.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(v) });
        data = await res.json().catch(() => ({}));
      } catch (ex) { res = null; }
      busy(false);
      if (res && res.ok && data.ok) {
        $$('.est-fields, .form-foot, .hp', reqForm).forEach((el) => { el.hidden = true; });
        reqForm.classList.add('done');
        done.hidden = false;
        done.setAttribute('tabindex', '-1');
        done.focus();
        return;
      }
      if (res && res.status === 422 && data.fields) {
        const firstBad = markFields(['name', 'email'].filter((n) => n in data.fields));
        showError(esc(data.fields.email ? (G.formEmail || 'Please check your email address.') : T.formMissing));
        if (firstBad) firstBad.focus();
        return;
      }
      if (res && res.status === 429) { showError(esc(G.formRate || 'That’s a lot of requests in a short time. Please try again in a few minutes, or email us.')); return; }
      showError(fill(esc(G.formFail || 'Sorry, your request couldn’t be sent just now. Please try again in a minute, or email us at {email}.'), { email: `<a href="mailto:${esc(email)}">${esc(email)}</a>` }));
    });
  }

  // ---------- start: a design from the address, a type from ?type=, or the defaults ----------
  root.classList.add('ready');
  const fromHash = decode(location.hash);
  const qType = new URLSearchParams(location.search).get('type');
  if (fromHash) {
    writeForm(fromHash);
  } else {
    if (qType && P.types[qType]) {
      setRadio('type', qType);
      $$('input[name="page"]', designForm).forEach((x) => { x.checked = x.value === 'home' || (PRESET[qType] || []).includes(x.value); });
    }
    syncType(radio('type') || 'business');
  }
  $$('[data-device]', root).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.device === device)));
  update(null, { quiet: true });
  drawPreview();
})();
