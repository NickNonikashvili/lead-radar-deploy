/* Million First Steps — shared on every page: translations, header and menu, languages,
   revealed contact details, sending forms, the settings the owners change in the admin panel
   (api/live.json) and the cookieless visit counter. Page scripts load after this one. */
(function () {
  var html = document.documentElement;
  var MFS = (window.MFS = window.MFS || {});
  MFS.root = html.getAttribute('data-site-root') || '';
  MFS.lang = html.lang || 'en';
  MFS.locale = { en: 'en-GB', ru: 'ru-RU', ka: 'ka-GE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT', de: 'de-DE', zh: 'zh-CN' }[MFS.lang] || 'en-GB';

  // T(english) → this page's translation. P(key, n, oneForm) picks the plural form for n;
  // a translation may hold forms as "one: … | few: … | other: …" (or just "other: …").
  window.T = function (s) { return (MFS.t && MFS.t[s]) || s; };
  var rules; try { rules = new Intl.PluralRules(MFS.locale); } catch (e) { rules = null; }
  window.P = function (key, n, one) {
    var cat = rules ? rules.select(n) : (n === 1 ? 'one' : 'other'), t = MFS.t && MFS.t[key];
    if (t && /^\s*(zero|one|two|few|many|other)\s*:/.test(t)) {
      var forms = {};
      t.split('|').forEach(function (f) { var i = f.indexOf(':'); forms[f.slice(0, i).trim()] = f.slice(i + 1).trim(); });
      t = forms[cat] || forms.other || key;
    } else if (!t) t = cat === 'one' && one ? one : key;
    return t.replace('{n}', n.toLocaleString(MFS.locale));
  };

  /* ---------- Header: menu and language list ---------- */
  var b = document.querySelector('.sh-burger'), m = document.getElementById('sh-menu');
  var lb = document.querySelector('.sh-lang-btn'), ll = document.getElementById('sh-lang-list');
  if (b) b.addEventListener('click', function () { var o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', o); m.classList.toggle('open', o); });
  // The same page in another language: data-page is its address inside a language ("" for home, "tours/",
  // "tours/cradle-of-wine", "about"); the 404 page has none and goes to that language's home page.
  function goToLang(code) {
    try { localStorage.setItem('mfs-lang', code); } catch (e) {}
    if (code === MFS.lang) return;
    var page = html.getAttribute('data-page');
    location.href = (MFS.root + (code === 'en' ? '' : code + '/') + (page == null ? '' : page + location.search + location.hash)) || './';
  }
  if (lb) {
    var close = function (f) { ll.hidden = true; lb.setAttribute('aria-expanded', 'false'); if (f) lb.focus(); };
    lb.addEventListener('click', function (e) { e.stopPropagation(); var o = ll.hidden; ll.hidden = !o; lb.setAttribute('aria-expanded', o); if (o) ll.querySelector('[aria-pressed="true"]').focus(); });
    ll.addEventListener('click', function (e) { var x = e.target.closest('button[data-lang]'); if (!x) return; close(true); goToLang(x.dataset.lang); });
    ll.addEventListener('keydown', function (e) {
      var bs = [].slice.call(ll.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      if (e.key === 'Tab' && !ll.hidden) close();
    });
    document.addEventListener('click', function (e) { if (!ll.hidden && !e.target.closest('.sh-lang')) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!ll.hidden) close(true); else if (m.classList.contains('open')) { b.click(); b.focus(); }
    });
  }

  /* ---------- Contact details revealed on click (kept out of the page text for scrapers) ---------- */
  function dec(v) { try { return atob(v).split('').reverse().join(''); } catch (e) { return ''; } }
  // The shown link, built as elements: the value may come from the admin panel (api/live.json).
  MFS.revealed = function (kind, v) {
    var s = document.createElement('span'), a = document.createElement('a');
    s.className = 'revealed'; a.href = kind === 'mail' ? 'mailto:' + v : 'tel:' + v.replace(/[^+0-9]/g, ''); a.textContent = v;
    s.appendChild(a); return s;
  };
  document.addEventListener('click', function (e) {
    var x = e.target.closest('.rv .reveal'); if (!x) return;
    var r = x.parentNode, v = dec(r.dataset.v);
    r.textContent = ''; r.appendChild(MFS.revealed(r.dataset.k, v)); r.querySelector('a').focus();
  });

  /* ---------- Header hides while scrolling down; back-to-top after ~1.5 screens ---------- */
  var h = document.querySelector('.sh'), top = document.querySelector('.totop'), mini = document.getElementById('mini');
  var last = window.scrollY, tick = false;
  function frame() {
    tick = false;
    var y = window.scrollY, busy = (m && m.classList.contains('open')) || (ll && !ll.hidden) || (h && h.contains(document.activeElement));
    if (h) {
      h.classList.toggle('sh-shadow', y > 8);
      if (y > last + 4 && y > 240 && !busy) h.classList.add('sh-hide'); else if (y < last - 4 || y <= 240 || busy) h.classList.remove('sh-hide');
      html.classList.toggle('sh-hidden', h.classList.contains('sh-hide'));
    }
    if (top) {
      top.hidden = y < window.innerHeight * 1.5;
      var off = (mini && !mini.hidden && getComputedStyle(mini).display !== 'none') ? mini.getBoundingClientRect().height + 12 : 0;
      top.style.setProperty('--lift', off + 'px');
    }
    last = y;
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(frame); } }, { passive: true });
  if (h) h.addEventListener('focusin', function () { h.classList.remove('sh-hide'); });
  if (top) top.addEventListener('click', function () { window.scrollTo(0, 0); var a = document.querySelector('.sh .brand'); if (a) a.focus({ preventScroll: true }); });
  frame();

  /* ---------- Travel style (tier): prices on the page follow it ---------- */
  var TIERS = ['wanderer', 'explorer', 'golden-fleece'];
  MFS.setTier = function (id, keep) {
    if (TIERS.indexOf(id) < 0) return;
    html.setAttribute('data-tier', id);
    if (keep !== false) { try { localStorage.setItem('mfs-tier', id); } catch (e) {} }
    document.querySelectorAll('[data-tier-select]').forEach(function (s) { s.value = id; });
    document.querySelectorAll('[data-set-tier]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.setTier === id)); });
    document.dispatchEvent(new CustomEvent('mfs:tier', { detail: id }));
  };
  var savedTier; try { savedTier = localStorage.getItem('mfs-tier'); } catch (e) {}
  MFS.setTier(savedTier || html.getAttribute('data-tier') || 'explorer', false);
  document.addEventListener('change', function (e) { if (e.target.matches('[data-tier-select]')) MFS.setTier(e.target.value); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-set-tier]'); if (b) MFS.setTier(b.dataset.setTier); });

  /* ---------- Sending forms ----------
     MFS.send(form, kind) posts every named field to send.php, which emails it to us. Labels go in
     English (data-en) so we can read every request. Where PHP isn't available (a preview, a static
     host), the visitor's email app opens with the request filled in. Resolves to the reference number. */
  function summary(form) {
    var lines = [], seen = {};
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      var n = el.name; if (!n || seen[n] || el.closest('.hp') || el.closest('[hidden]')) return; // a hidden section (e.g. the contact page's trip details when only a message is sent) isn't part of the request
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      var v = el.tagName === 'SELECT' ? (el.options[el.selectedIndex] || {}).text : el.value;
      if (el.type === 'checkbox') v = 'Yes';
      if (!v || !String(v).trim()) return;
      seen[n] = 1; lines.push([el.dataset.en || n, String(v).trim(), n]);
    });
    return lines;
  }
  function ref(prefix) { var d = new Date(); return (prefix || 'MFS') + '-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + Math.floor(1000 + Math.random() * 9000); }
  MFS.send = function (form, kind, prefix) {
    var lines = summary(form), id = ref(prefix);
    var data = new FormData();
    data.append('kind', kind); data.append('ref', id); data.append('lang', MFS.lang); data.append('page', location.pathname);
    data.append('started', form.dataset.started || ''); data.append('website2', (form.querySelector('[name="website2"]') || {}).value || '');
    // Seconds the form was open, by this device's own clock (a wrong clock can't make a person look like a bot).
    if (form.dataset.started) data.append('elapsed', String(Math.max(0, Math.floor(Date.now() / 1000) - +form.dataset.started)));
    // Each field: English label (l), value (v) and the form field's name (n), which the admin panel files it by.
    lines.forEach(function (l, i) { data.append('f[' + i + '][l]', l[0]); data.append('f[' + i + '][v]', l[1]); data.append('f[' + i + '][n]', l[2]); });
    var email = (form.querySelector('input[type="email"]') || {}).value || '';
    data.append('email', email);
    function mailto() {
      var body = lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
      location.href = 'mailto:' + (MFS.email || '') + '?subject=' + encodeURIComponent('[' + id + '] ' + kind) + '&body=' + encodeURIComponent(body);
      return { ref: id, mailto: true };
    }
    if (!window.fetch || location.protocol === 'file:') return Promise.resolve(mailto());
    // Too many messages → an error the page shows; any other failure → the email app, so nothing is lost.
    return fetch(MFS.root + 'send.php', { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 429) throw { busy: true };
        return r.json().then(function (j) { if (!r.ok || !j.ok) throw { failed: true }; return { ref: j.ref || id }; });
      })
      .catch(function (e) { if (e && e.busy) throw e; return mailto(); });
  };
  // Time trap: send.php ignores forms submitted within a couple of seconds of the page opening.
  document.querySelectorAll('form').forEach(function (f) { f.dataset.started = String(Math.floor(Date.now() / 1000)); });

  /* ---------- Settings from the admin panel (api/live.json) ----------
     Prices, hidden tours, contact details, messaging channels and the site notice can change without a
     rebuild. The head script starts loading api/live.json (window.MFS_LIVE); once the page is ready it's
     applied over what the page was built with. Anything missing or broken means "as built", and every
     element is worked out from its built state, so applying the same values twice changes nothing.
     A copy is kept for the visit (sessionStorage) so the next pages show it straight away. */
  var TIER_IDS = TIERS, own = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  var isObj = function (o) { return !!o && typeof o === 'object' && !Array.isArray(o); };
  var each = function (sel, fn) { [].forEach.call(document.querySelectorAll(sel), function (el) { try { fn(el); } catch (e) {} }); };
  // What an element looked like as built, kept the first time it's touched.
  function built(el, what, value) { var b = el.__mfsBuilt || (el.__mfsBuilt = {}); if (!own(b, what)) b[what] = value; return b[what]; }
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
  function setHidden(el, hide) { if (el.hidden !== hide) el.hidden = hide; }
  function setAttr(el, name, value) {
    if (value == null) { if (el.hasAttribute(name)) el.removeAttribute(name); }
    else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
  function seal(v) { try { return btoa(String(v).split('').reverse().join('')); } catch (e) { return null; } }
  function hashOf(s) { for (var h = 5381, i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function safeUrl(v) { v = String(v || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : ''; }

  // A price in the page's own number format: only the digits change ("1 390 €" → "1 490 €", "€1,390" → "€1,490").
  var NUM = /\d(?:[\d,.\s\u00a0\u202f'’]*\d)?/, SEP = { de: '.', it: '.', es: '.', fr: '\u202f' };
  function group(n, sep) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
  function setNum(el, n) {
    var text = built(el, 'text', el.textContent), m = text.match(NUM);
    if (n == null || !m || n === +m[0].replace(/\D/g, '')) return setText(el, text);
    var sep = (m[0].match(/\d([,.\s\u00a0\u202f'’])\d{3}(?!\d)/) || [])[1];
    if (sep == null) sep = MFS.lang === 'es' && n < 10000 ? '' : (SEP[MFS.lang] || ',');
    setText(el, text.replace(m[0], group(n, sep)));
  }

  function applyLive(live) {
    live = isObj(live) ? live : {};
    var contact = isObj(live.contact) ? live.contact : {}, prices = isObj(live.prices) ? live.prices : {};
    var hidden = Array.isArray(live.hidden) ? live.hidden.map(String) : [], B = MFS.c || {};
    var price = function (id, tier) { var p = prices[id], n = isObj(p) ? Math.round(+p[tier]) : NaN; return n > 0 ? n : null; };
    MFS.live = live;

    // Contact details: email and phone (sealed for the "Show …" buttons), texts, and the rows they sit in.
    // The email app fallback for forms writes to the admin's address (or the built one if that's hidden).
    var builtEmail = built(html, 'email', MFS.email || '');
    MFS.email = (typeof contact.email === 'string' && contact.email.trim()) || builtEmail;
    var empty = function (el) { return el.__mfsValue != null ? !el.__mfsValue : !(el.getAttribute('data-v') || el.textContent.trim()); };
    each('[data-live]', function (el) {
      var k = el.getAttribute('data-live'), has = own(contact, k) && typeof contact[k] === 'string', v = has ? contact[k].trim() : '';
      if (k === 'email' || k === 'phone') {
        var orig = built(el, 'v', el.getAttribute('data-v') || ''), sealed = has ? (v ? seal(v) : '') : orig;
        if (sealed == null) sealed = orig;
        setAttr(el, 'data-v', sealed);
        el.__mfsValue = sealed;
        var a = el.querySelector('.revealed a'), plain = a && dec(sealed); // already shown: show the current one
        if (plain && a.textContent !== plain) { a.textContent = plain; a.setAttribute('href', k === 'email' ? 'mailto:' + plain : 'tel:' + plain.replace(/[^+\d]/g, '')); }
      } else {
        var text = built(el, 'text', el.textContent);
        var show = has && v !== (B[k] || '') ? v : text;
        setText(el, show);
        el.__mfsValue = show.trim();
      }
    });
    each('[data-live-wrap]', function (w) {
      var items = w.hasAttribute('data-live') ? [w] : [].slice.call(w.querySelectorAll('[data-live]'));
      if (items.length) setHidden(w, items.every(empty));
    });
    each('[data-live-map]', function (a) {
      var href = built(a, 'href', a.getAttribute('href')), addr = typeof contact.address === 'string' ? contact.address.trim() : '';
      setAttr(a, 'href', addr && addr !== B.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : href);
    });

    // Messaging channels: the link follows the admin's value, "" hides it; lists with nothing left hide too.
    each('[data-ch]', function (item) {
      var k = item.getAttribute('data-ch'), a = item.matches('a') ? item : item.querySelector('a');
      var href = built(item, 'href', a.getAttribute('href')), url = href;
      if (own(contact, k) && typeof contact[k] === 'string') {
        var v = contact[k].trim();
        url = k === 'email' ? (/^[^\s@<>"]+@[^\s@<>"]+$/.test(v) ? 'mailto:' + v : '') : safeUrl(v);
      }
      setAttr(a, 'href', url || null);
      setHidden(item, !url);
    });
    each('[data-ch-alt]', function (el) {
      var ch = document.querySelector('[data-ch="' + el.getAttribute('data-ch-alt') + '"]');
      setHidden(el, !!ch && !ch.hidden);
    });
    each('[data-ch-list]', function (list) {
      setHidden(list, ![].some.call(list.querySelectorAll('[data-ch]'), function (c) { return !c.hidden; }));
    });

    // Prices: every tier price, "From" (the lowest tier), and the FAQ's per-day ranges over the tours on show.
    each('[data-price]', function (el) { var p = el.getAttribute('data-price').split(':'); setNum(el, price(p[0], p[1])); });
    each('[data-from]', function (el) {
      var id = el.getAttribute('data-from'), ns = TIER_IDS.map(function (t) { return price(id, t); });
      setNum(el, ns.every(function (n) { return n; }) ? Math.min.apply(null, ns) : null);
    });
    each('[data-perday]', function (el) {
      var p = el.getAttribute('data-perday').split(':'), tours = MFS.tours || {}, v = [];
      Object.keys(tours).forEach(function (id) {
        if (hidden.indexOf(id) < 0) v.push((price(id, p[0]) || tours[id][1][p[0]]) / tours[id][0]);
      });
      if (!v.length) return setNum(el, null);
      setNum(el, p[1] === 'min' ? Math.floor(Math.min.apply(null, v) / 10) * 10 : Math.ceil(Math.max.apply(null, v) / 10) * 10);
    });
    // The tour page calculator (tour.js recalculates on mfs:live).
    var factors = null;
    if (isObj(live.partyFactors)) {
      factors = {};
      Object.keys(live.partyFactors).forEach(function (k) { var f = +live.partyFactors[k]; if (/^[1-8]$/.test(k) && f > 0 && f < 10) factors[k] = f; });
    }
    each('[data-calc][data-tour]', function (el) {
      var id = el.getAttribute('data-tour'), was = [el.getAttribute('data-prices'), el.getAttribute('data-factors')];
      var bp = built(el, 'prices', el.getAttribute('data-prices')), bf = built(el, 'factors', el.getAttribute('data-factors'));
      var p = JSON.parse(bp), f = JSON.parse(bf), same = true;
      TIER_IDS.forEach(function (t) { var n = price(id, t); if (n && n !== p[t]) { p[t] = n; same = false; } });
      setAttr(el, 'data-prices', same ? bp : JSON.stringify(p));
      same = true;
      if (factors) Object.keys(factors).forEach(function (k) { if (factors[k] !== f[k]) { f[k] = factors[k]; same = false; } });
      setAttr(el, 'data-factors', same ? bf : JSON.stringify(f));
      // Its totals stay out of sight until tour.js has worked them out again (it removes data-live-wait).
      if (el.getAttribute('data-prices') !== was[0] || el.getAttribute('data-factors') !== was[1]) el.setAttribute('data-live-wait', '');
    });

    // Tours taken off the website: their cards hide (tours.js repaints the tours page and its count), the
    // "You might also love" lists move up a spare, and the tour's own page says it isn't on offer.
    var recount = false;
    each('[data-tour-card]', function (el) {
      var off = hidden.indexOf(el.getAttribute('data-tour-card')) > -1;
      if (el.hasAttribute('data-live-off') !== off && el.closest('#tc-grid')) recount = true;
      setAttr(el, 'data-live-off', off ? '' : null);
      if (el.closest('[data-tour-more]')) return;
      if (el.closest('#tc-grid')) { if (off) setHidden(el, true); return; }
      setHidden(el, off);
    });
    // The tours page count waits for tours.js to count again (it removes data-live-wait).
    if (recount) each('#tc-n, #tc-w', function (el) { el.setAttribute('data-live-wait', ''); });
    each('[data-tour-more]', function (list) {
      var max = +list.getAttribute('data-tour-more') || 3, n = 0;
      [].forEach.call(list.querySelectorAll('[data-tour-card]'), function (li) {
        var show = !li.hasAttribute('data-live-off') && n < max; if (show) n++; setHidden(li, !show);
      });
      var sec = list.closest('section'); if (sec) setHidden(sec, n === 0);
    });
    each('[data-tour-unavailable]', function (el) { setHidden(el, hidden.indexOf(el.getAttribute('data-tour-unavailable')) < 0); });
    each('[data-tour-count]', function (el) {
      var ids = el.getAttribute('data-tour-count').split(' ');
      setNum(el, ids.filter(function (id) { return hidden.indexOf(id) < 0; }).length || null);
    });
    // The head script's stand-in for the cards above (the visit's copy, before the page was there).
    var pre = document.getElementById('mfs-live-pre'); if (pre) pre.parentNode.removeChild(pre);

    // The site notice, in the page's language (else English), until the visitor closes it.
    var bar = document.querySelector('.site-notice');
    if (bar) {
      var nt = isObj(live.notice) ? live.notice : {}, pick = function (l) { return typeof nt[l] === 'string' ? nt[l].trim() : ''; };
      var msg = pick(MFS.lang) || pick('en'), id = msg ? hashOf(JSON.stringify(nt)) : '', closed = null;
      try { closed = localStorage.getItem('mfs-notice'); } catch (e) {}
      setText(bar.querySelector('.site-notice-t'), msg);
      setAttr(bar, 'data-id', id);
      setHidden(bar, !msg || closed === id);
    }
    document.dispatchEvent(new CustomEvent('mfs:live', { detail: live }));
  }
  document.addEventListener('click', function (e) {
    var x = e.target.closest('.site-notice-x'); if (!x) return;
    var bar = x.closest('.site-notice'); bar.hidden = true;
    try { localStorage.setItem('mfs-notice', bar.getAttribute('data-id') || ''); } catch (err) {}
    var a = document.querySelector('.sh .brand'); if (a) a.focus({ preventScroll: true });
  });
  // As soon as this (deferred) script runs, i.e. once the page is parsed: the visit's copy straight away, then
  // the fresh file when it differs. Page scripts load after this one and start from what's on the page, and
  // they recalculate on mfs:live for whatever arrives later. Until then the head script keeps the values that
  // may change out of sight (html.mfs-pending).
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }
  function settled() { html.classList.remove('mfs-pending'); }
  onReady(function () {
    var cached = null, applied = '';
    try { cached = sessionStorage.getItem('mfs-live'); } catch (e) {}
    if (cached) { try { applyLive(JSON.parse(cached)); applied = cached; } catch (e) { applied = ''; } }
    var p = window.MFS_LIVE;
    if (applied || !p || typeof p.then !== 'function') settled();
    if (!p || typeof p.then !== 'function') return;
    p.then(function (live) {
      try {
        var raw = isObj(live) && Object.keys(live).some(function (k) { return k !== 'rev'; }) ? JSON.stringify(live) : '';
        try { if (raw) sessionStorage.setItem('mfs-live', raw); else sessionStorage.removeItem('mfs-live'); } catch (e) {}
        if (raw !== applied) applyLive(raw ? live : null);
      } finally { settled(); }
    });
  });

  /* ---------- Visit counter: one anonymous count per page view, no cookies ----------
     Sent after the page has loaded (or when the visitor leaves first), never in the way of the page.
     Not sent when the browser asks not to be tracked (Do Not Track, Global Privacy Control), from the
     owners' own browsers (the admin panel sets mfs-nostat), from automated browsers, for the 404 page or in
     static previews (MFS_HTML_LINKS builds). */
  var counted = false;
  function countView() {
    if (counted) return; counted = true;
    try {
      if (location.protocol === 'file:' || MFS.noServer || !html.hasAttribute('data-page')) return;
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true || navigator.webdriver) return;
      try { if (localStorage.getItem('mfs-nostat') === '1') return; } catch (e) {}
      var url = MFS.root + 'api/hit.php';
      var body = JSON.stringify({ p: location.pathname, l: MFS.lang, r: document.referrer || '', w: window.innerWidth || 0 });
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
      if (window.fetch) fetch(url, { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === 'complete') setTimeout(countView, 0);
  else window.addEventListener('load', function () { setTimeout(countView, 0); });
  window.addEventListener('pagehide', countView);
})();
