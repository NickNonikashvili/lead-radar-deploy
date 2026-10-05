/* Shared header, footer and helpers for every page. Requires data.js and photos.js first. */
(function () {
  const S = window.STORE;
  const PHOTOS = window.PHOTOS || {};
  const L = S.links;
  const page = document.body.dataset.page || '';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ext = 'target="_blank" rel="noopener"';
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  const catById = Object.fromEntries(S.categories.map(c => [c.id, c]));
  const byId = Object.fromEntries(S.products.map(p => [p.id, p]));

  // ---------- icons
  const ICONS = {
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
    shirt: '<path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z" stroke-linejoin="round"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
    cap: '<path d="M4 15c0-6 3.5-9 8-9s8 3 8 9z"/><path d="M2 15h18c1 0 2 1 1 2H3c-1 0-2-1-1-2z"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1"/>',
    laptop: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    brush: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="m13 6 5 5"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" stroke-linejoin="round"/>',
    grad: '<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    rent: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    dollar: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>',
    pin: '<path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/>',
    store: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
  };
  const icon = (k, s = 24, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round">${ICONS[k]}</svg>`;

  // ---------- fallback illustrations (shown until real photos are downloaded)
  const shirt = (c, a = '#e8b521') => `<path d="M62 40c6 8 30 8 36 0l28 14-10 26-14-6v76H58V74l-14 6-10-26z" fill="${c}"/><path d="M60 110l14-18 8 10 6-6 14 14z" fill="${a}"/>`;
  const hood = (c, t = '#fff') => `<path d="M60 40c6 10 34 10 40 0l26 12 14 40-18 6v52H38v-52l-18-6 14-40z" fill="${c}"/><path d="M68 40c4 12 20 12 24 0" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/><rect x="62" y="114" width="36" height="16" rx="3" fill="rgba(0,0,0,.15)"/><text x="80" y="96" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${t}">MSU</text>`;
  const crew = (c, t = '#e8b521') => `<path d="M62 40c6 6 30 6 36 0l28 12 14 40-18 6v52H38v-52l-18-6 14-40z" fill="${c}"/><path d="M62 40c6 6 30 6 36 0" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="4"/><text x="80" y="96" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${t}">MSU</text>`;
  const cap = (c, a = '#e8b521') => `<path d="M40 104c0-30 18-48 40-48s40 18 40 48z" fill="${c}"/><path d="M36 104h90c6 0 10 4 6 10H40c-6 0-8-6-4-10z" fill="${c}" opacity=".85"/><path d="M60 96l12-16 8 10 6-6 14 12z" fill="${a}"/>`;
  const ART = {
    'tee-navy': () => shirt('#0b2a4a'), 'tee-gold': () => shirt('#c9a640', '#0b2a4a'), 'tee-slate': () => shirt('#5d7186'),
    'tee-indigo': () => shirt('#34407a'), 'tee-gray': () => shirt('#9aa4ae', '#0b2a4a'), 'tee-cream': () => shirt('#efe6d2', '#0b2a4a'), 'tee-white': () => shirt('#ffffff', '#0b2a4a') + '<path d="M62 40c6 8 30 8 36 0l28 14-10 26-14-6v76H58V74l-14 6-10-26z" fill="none" stroke="#cfd6de" stroke-width="2"/>',
    'hoodie-navy': () => hood('#0b2a4a', '#e8b521'), 'hoodie-gray': () => hood('#8d99a6'), 'hoodie-gold': () => hood('#d9ae3b', '#0b2a4a'),
    zip: () => hood('#1b2430') + '<path d="M80 52v96" stroke="#e8b521" stroke-width="2.5"/>',
    'crew-navy': () => crew('#0b2a4a'), 'crew-gray': () => crew('#a3adb7', '#0b2a4a'), 'crew-gold': () => crew('#d9ae3b', '#0b2a4a'),
    jacket: () => `<path d="M60 40c6 6 34 6 40 0l26 12 14 40-18 6v52H38v-52l-18-6 14-40z" fill="#efe9df"/><path d="M80 46v104" stroke="#b9ad98" stroke-width="2.5"/><circle cx="96" cy="70" r="6" fill="#0b2a4a"/>`,
    'cap-navy': () => cap('#0b2a4a'), 'cap-gold': () => cap('#d9ae3b', '#0b2a4a'), 'cap-gray': () => cap('#7c8a99'),
    'cap-camo': () => cap('#6b7350') + '<g fill="#4f5a3a" opacity=".8"><circle cx="66" cy="84" r="7"/><circle cx="96" cy="78" r="6"/><circle cx="84" cy="98" r="5"/></g>',
    beanie: () => `<path d="M42 112c0-34 16-56 38-56s38 22 38 56z" fill="#4a5059"/><rect x="38" y="104" width="84" height="22" rx="6" fill="#3a3f47"/><circle cx="80" cy="50" r="10" fill="#e8b521"/><path d="M68 98l8-10 6 6 4-4 10 8z" fill="#e8b521"/>`,
    blanket: () => `<rect x="34" y="48" width="92" height="76" rx="6" fill="#0b2a4a"/><path d="M34 70h92M34 102h92" stroke="#e8b521" stroke-width="5"/><path d="M110 124c10 0 16-6 16-16v16z" fill="#123a63"/>`,
    plush: () => `<circle cx="80" cy="74" r="30" fill="#c79a5b"/><path d="M56 54l-6-18 18 10zM104 54l6-18-18 10z" fill="#c79a5b"/><ellipse cx="80" cy="124" rx="34" ry="28" fill="#c79a5b"/><circle cx="70" cy="72" r="4" fill="#2b2b2b"/><circle cx="90" cy="72" r="4" fill="#2b2b2b"/><path d="M76 84q4 4 8 0" stroke="#2b2b2b" stroke-width="2.5" fill="none"/><path d="M50 52h60l-30-14z" fill="#0b2a4a"/><path d="M102 50v14" stroke="#e8b521" stroke-width="3"/>`,
    sticker: () => `<rect x="38" y="44" width="84" height="84" rx="18" fill="#fff" stroke="#d7dde4" stroke-width="3"/><path d="M56 110l16-22 10 12 8-8 16 18z" fill="#0b2a4a"/><circle cx="96" cy="70" r="8" fill="#e8b521"/>`,
    mug: () => `<rect x="44" y="52" width="62" height="78" rx="8" fill="#d7c8a8"/><path d="M106 70h10a12 12 0 0 1 0 24h-10" fill="none" stroke="#d7c8a8" stroke-width="8"/><path d="M52 80h46M52 92h46M52 104h46" stroke="#0b2a4a" stroke-width="4" stroke-dasharray="6 5"/>`,
    towel: () => `<rect x="44" y="34" width="72" height="104" rx="4" fill="#f4f1ea" stroke="#d6cfbf" stroke-width="2"/><path d="M44 52h72M44 122h72" stroke="#0b2a4a" stroke-width="4"/><path d="M58 104l12-16 8 10 6-6 18 12z" fill="#e8b521"/>`,
    ornament: () => `<path d="M80 30v18" stroke="#9aa6b2" stroke-width="2"/><path d="M48 60h64l-6 40-26 30-26-30z" fill="#3b4652"/><text x="80" y="92" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#e8b521">MSU</text>`,
    socks: () => `<path d="M58 36h24v62l18 18a12 12 0 0 1-17 17L58 108z" fill="#0b2a4a"/><g fill="#e8b521"><circle cx="66" cy="54" r="3"/><circle cx="74" cy="70" r="3"/><circle cx="64" cy="86" r="3"/><circle cx="86" cy="118" r="3"/></g>`,
    laptop: () => `<rect x="36" y="46" width="88" height="58" rx="5" fill="#c9ced6"/><rect x="42" y="52" width="76" height="46" rx="2" fill="#1b2430"/><path d="M26 108h108l-6 10H32z" fill="#aeb5bf"/>`,
    calculator: () => `<rect x="54" y="30" width="52" height="110" rx="8" fill="#2b3440"/><rect x="62" y="40" width="36" height="26" rx="3" fill="#b9c7a8"/><g fill="#59636f">${[0,1,2].map(r => [0,1,2].map(c => `<rect x="${62 + c * 13}" y="${76 + r * 18}" width="10" height="12" rx="2"/>`).join('')).join('')}</g>`,
    headphones: () => `<path d="M46 96c0-36 68-36 68 0" fill="none" stroke="#1b2430" stroke-width="7"/><rect x="38" y="90" width="18" height="30" rx="8" fill="#1b2430"/><rect x="104" y="90" width="18" height="30" rx="8" fill="#1b2430"/>`,
    presenter: () => `<rect x="68" y="34" width="26" height="104" rx="13" fill="#2b3440"/><circle cx="81" cy="62" r="6" fill="#e8b521"/><rect x="75" y="80" width="12" height="18" rx="4" fill="#59636f"/>`,
    cable: () => `<path d="M50 40c0 40 60 30 60 70v20" fill="none" stroke="#eef0f3" stroke-width="7"/><path d="M50 40c0 40 60 30 60 70v20" fill="none" stroke="#c9ced6" stroke-width="2"/><rect x="42" y="24" width="16" height="22" rx="3" fill="#c9ced6"/><rect x="102" y="126" width="16" height="22" rx="3" fill="#c9ced6"/>`,
    pencil: () => `<g transform="rotate(-35 80 85)"><rect x="34" y="78" width="46" height="14" fill="#c0392b"/><rect x="80" y="78" width="46" height="14" fill="#2457a6"/><path d="M34 78l-12 7 12 7zM126 78l12 7-12 7z" fill="#e9d3a7"/></g>`,
    bottle: () => `<rect x="66" y="40" width="28" height="16" rx="3" fill="#2b3440"/><rect x="58" y="56" width="44" height="80" rx="8" fill="#ef7d22"/><rect x="64" y="80" width="32" height="30" rx="3" fill="#fff" opacity=".85"/>`,
    brush: () => `<g transform="rotate(-30 80 85)"><rect x="74" y="20" width="12" height="90" rx="5" fill="#b5651d"/><rect x="72" y="108" width="16" height="14" fill="#c9ced6"/><path d="M72 122h16l-4 26h-8z" fill="#59636f"/></g>`,
    tweezers: () => `<path d="M76 30l-14 110M84 30l14 110" stroke="#9aa4ae" stroke-width="6" stroke-linecap="round"/><path d="M72 30h16" stroke="#7c8692" stroke-width="8" stroke-linecap="round"/>`,
    jar: () => `<rect x="54" y="44" width="52" height="16" rx="3" fill="#2b3440"/><rect x="50" y="58" width="60" height="78" rx="8" fill="#f3f4f6" stroke="#cfd6de" stroke-width="2"/><rect x="58" y="80" width="44" height="30" rx="3" fill="#0b2a4a"/>`,
    board: () => `<rect x="30" y="50" width="100" height="70" rx="4" fill="#9cc9b0"/><path d="M30 64h100M30 78h100M30 92h100M30 106h100" stroke="#86b79c" stroke-width="1.5"/>`,
    book: () => `<rect x="50" y="32" width="64" height="104" rx="4" fill="#5a7d3a"/><rect x="50" y="32" width="10" height="104" fill="#46632d"/><path d="M68 54h36M68 64h28" stroke="#f1e6c8" stroke-width="4"/><circle cx="86" cy="104" r="14" fill="#e8b521"/>`
  };
  const artBg = k => /gold|mug|towel|plush|jacket/.test(k) ? '#f6eed8' : /book|pencil|bottle|brush|jar|board|tweezers/.test(k) ? '#f1efe9' : '#e9eef3';
  const illustration = p => `<svg viewBox="0 0 160 170" aria-hidden="true">${(ART[p.art] || ART.sticker)()}</svg>`;

  // Photo if downloaded, otherwise illustration. A broken photo falls back to the illustration.
  function media(p) {
    const photo = PHOTOS[p.id];
    if (!photo) return { bg: artBg(p.art), html: illustration(p) };
    return { bg: '#fff', html: `<img class="photo" src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" data-fallback="${p.id}">` };
  }
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    const p = byId[img.dataset.fallback];
    img.parentElement.style.background = artBg(p.art);
    img.outerHTML = illustration(p);
  }, true);

  const badgeClass = b => b === 'Clearance' ? 'sale' : b === 'Champs' ? 'gold' : '';
  const productUrl = p => `product.html?id=${encodeURIComponent(p.id)}`;
  function card(p) {
    const m = media(p);
    return `<a class="prod" href="${productUrl(p)}">
      <div class="ph" style="background:${m.bg}">${p.badge ? `<span class="tag ${badgeClass(p.badge)}">${esc(p.badge)}</span>` : ''}${m.html}</div>
      <div class="body">
        <div class="brand">${esc(p.brand || catById[p.cat].name)}</div>
        <div class="name">${esc(p.name)}</div>
        <div class="price">${p.price ? `<b>${money(p.price)}</b>` : '<span class="see">See price</span>'}<span class="go" aria-hidden="true">${icon('arrow', 15, 2.4)}</span></div>
      </div></a>`;
  }

  // ---------- hours
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fmtTime = h => { const hr = Math.floor(h), m = Math.round((h - hr) * 60); return `${((hr + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${hr >= 12 ? 'pm' : 'am'}`; };
  function mountainNow() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const g = t => parts.find(x => x.type === t).value;
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), hour: (+g('hour') % 24) + (+g('minute')) / 60 };
  }
  // Summer schedule runs mid-May through mid-August.
  const defaultSchedule = () => { const m = new Date().getMonth(); return m >= 4 && m <= 7 ? 'summer' : 'semester'; };
  function openStatus(name) {
    const s = S.hours[name], now = mountainNow(), t = s[now.day];
    const open = !!t && now.hour >= t[0] && now.hour < t[1];
    return { open, text: open ? `Open now · until ${fmtTime(t[1])}` : 'Closed now', now };
  }
  function renderStatus(el, name) {
    const st = openStatus(name);
    el.className = 'status ' + (st.open ? 'open' : 'closed');
    el.innerHTML = `<i></i><span>${st.text}</span>`;
  }
  function renderHoursTable(el, name) {
    const s = S.hours[name], now = mountainNow();
    el.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<tr class="${d === now.day ? 'today' : ''}"><td>${DAYS[d]}</td><td>${s[d] ? fmtTime(s[d][0]) + ' – ' + fmtTime(s[d][1]) : 'Closed'}</td></tr>`).join('');
  }

  // ---------- shell
  const NAV = [
    ['shop', 'Shop all', 'shop.html'],
    ['textbooks', 'Textbooks', 'textbooks.html'],
    ['champs', 'National Champions', 'shop.html?cat=champs', 'hot'],
    ['sweatshirts', 'Apparel', 'shop.html?cat=sweatshirts'],
    ['gifts', 'Gifts', 'shop.html?cat=gifts'],
    ['tech', 'Tech', 'shop.html?cat=tech'],
    ['about', 'About', 'about.html', 'push'],
    ['visit', 'Visit', 'visit.html'],
    ['help', 'Help', 'help.html']
  ];
  const currentCat = new URLSearchParams(location.search).get('cat');
  const isCurrent = key => (page === 'shop' ? (currentCat ? key === currentCat : key === 'shop') : key === page) ? ' aria-current="page"' : '';
  const searchForm = cls => `<form class="${cls}" role="search" action="shop.html">
      ${icon('search', 18, 2)}
      <input type="search" name="q" placeholder="Search Bobcat gear, gifts, tech…" aria-label="Search products"></form>`;

  const header = `
    <a class="skip" href="#main">Skip to content</a>
    <div class="concept">Redesign concept, not the official site. Checkout and accounts go to the real store at <a href="${L.site}" ${ext}>msubookstore.org</a>.</div>
    <div class="announce"><div class="wrap">
      <div><strong>Fall rentals</strong> are due back the last day of finals week · <a href="help.html#rentals">Rental &amp; buyback FAQ →</a></div>
      <div class="right"><a href="visit.html">Hours &amp; location</a><a href="textbooks.html#faculty">Faculty adoptions</a><a href="visit.html#contact">Contact</a></div>
    </div></div>
    <header class="site">
      <div class="wrap bar">
        <button class="icon-btn menu-toggle" aria-label="Open menu" id="openMenu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        <a class="logo" href="index.html">
          <span class="logo-mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 19 9 8l4 6 3-4 6 9z" fill="#e8b521"/><path d="M4 19h16" stroke="#fff" stroke-width="1.6"/></svg></span>
          <span class="logo-text"><b>MSU Bookstore</b><span>Bozeman · Since 1931</span></span>
        </a>
        ${searchForm('search')}
        <div class="head-actions">
          <a class="icon-btn" aria-label="My account (msubookstore.org)" href="${L.account}" ${ext}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg></a>
          <a class="icon-btn" aria-label="Cart (msubookstore.org)" href="${L.cart}" ${ext}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg></a>
        </div>
      </div>
      <nav class="cats" aria-label="Main"><div class="wrap"><ul>
        ${NAV.map(([k, t, u, c]) => `<li class="${c || ''}"><a href="${u}"${isCurrent(k)}>${t}</a></li>`).join('')}
      </ul></div></nav>
    </header>
    <div class="drawer" id="drawer" aria-hidden="true">
      <div class="scrim" data-close></div>
      <div class="panel" role="dialog" aria-label="Menu">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-family:var(--serif);font-size:20px;color:var(--navy)">Menu</b>
          <button class="icon-btn" aria-label="Close menu" data-close><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        <form role="search" action="shop.html"><input type="search" name="q" placeholder="Search products" aria-label="Search products"></form>
        <ul>${NAV.map(([k, t, u]) => `<li><a href="${u}"${isCurrent(k)}>${t}</a></li>`).join('')}
          <li><a href="${L.cart}" ${ext}>Cart ↗</a></li><li><a href="${L.account}" ${ext}>My account ↗</a></li></ul>
      </div>
    </div>`;

  const fl = (items) => items.map(([t, u, x]) => `<li><a href="${u}" ${x ? ext : ''}>${t}${x ? ' ↗' : ''}</a></li>`).join('');
  const footer = `
    <footer class="site"><div class="wrap">
      <div class="foot-grid">
        <div class="brand">
          <div class="logo" style="margin-bottom:14px">
            <span class="logo-mark" aria-hidden="true" style="background:#123a63"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 19 9 8l4 6 3-4 6 9z" fill="#e8b521"/></svg></span>
            <span class="logo-text"><b style="color:#fff">MSU Bookstore</b><span style="color:#a9b8c9">Bozeman · Since 1931</span></span>
          </div>
          <p style="max-width:340px;margin:0 0 14px">Independent, not-for-profit and owned by the students and faculty of Montana State University.</p>
          <a href="${L.facebook}" ${ext}>Facebook ↗</a>
        </div>
        <div><h4>Shop</h4><ul>${fl([['All products', 'shop.html'], ['National Champions', 'shop.html?cat=champs'], ['Hoodies & Crews', 'shop.html?cat=sweatshirts'], ['Gifts', 'shop.html?cat=gifts'], ['Computers & Tech', 'shop.html?cat=tech']])}</ul></div>
        <div><h4>Course materials</h4><ul>${fl([['Find textbooks', 'textbooks.html'], ['Rent & sell back', 'textbooks.html#rent'], ['Inclusive Access', 'textbooks.html#inclusive-access'], ['Faculty adoptions', 'textbooks.html#faculty'], ['Returns', 'help.html#returns']])}</ul></div>
        <div><h4>About</h4><ul>${fl([['Our mission', 'about.html'], ['Hours & location', 'visit.html'], ['Contact', 'visit.html#contact'], ['FAQ', 'help.html']])}</ul></div>
      </div>
      <div class="foot-bottom"><span>125 Strand Union Building · Bozeman, MT 59717 · <a href="tel:+14069942811">(406) 994-2811</a></span><span>Redesign concept · <a href="${L.site}" ${ext}>Official site ↗</a></span></div>
    </div></footer>`;

  const h = $('#site-header'), f = $('#site-footer');
  if (h) h.outerHTML = header;
  if (f) f.outerHTML = footer;

  const drawer = $('#drawer');
  if (drawer) {
    $('#openMenu').addEventListener('click', () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); });
    drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); } });
  }

  window.SITE = { S, L, $, $$, esc, ext, icon, money, card, media, catById, byId, productUrl, renderStatus, renderHoursTable, defaultSchedule };
})();
