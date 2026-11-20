/* Million First Steps — shared on every page: translations, header and menu, languages,
   revealed contact details and sending forms. Page scripts load after this one. */
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
  function goToLang(code) {
    try { localStorage.setItem('mfs-lang', code); } catch (e) {}
    if (code === MFS.lang) return;
    var page = html.getAttribute('data-page') || 'index.html';
    location.href = MFS.root + (code === 'en' ? '' : code + '/') + page + location.search + location.hash;
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
  document.addEventListener('click', function (e) {
    var x = e.target.closest('.rv .reveal'); if (!x) return;
    var r = x.parentNode, v = dec(r.dataset.v), href = r.dataset.k === 'mail' ? 'mailto:' + v : 'tel:' + v.replace(/[^+0-9]/g, '');
    r.innerHTML = '<span class="revealed"><a href="' + href + '">' + v + '</a></span>'; r.querySelector('a').focus();
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
      var n = el.name; if (!n || seen[n] || el.closest('.hp') || el.closest('[hidden]') && el.type !== 'hidden') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      var v = el.tagName === 'SELECT' ? (el.options[el.selectedIndex] || {}).text : el.value;
      if (el.type === 'checkbox') v = 'Yes';
      if (!v || !String(v).trim()) return;
      seen[n] = 1; lines.push([el.dataset.en || n, String(v).trim()]);
    });
    return lines;
  }
  function ref(prefix) { var d = new Date(); return (prefix || 'MFS') + '-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + Math.floor(1000 + Math.random() * 9000); }
  MFS.send = function (form, kind, prefix) {
    var lines = summary(form), id = ref(prefix);
    var data = new FormData();
    data.append('kind', kind); data.append('ref', id); data.append('lang', MFS.lang); data.append('page', location.pathname);
    data.append('started', form.dataset.started || ''); data.append('website2', (form.querySelector('[name="website2"]') || {}).value || '');
    lines.forEach(function (l, i) { data.append('f[' + i + '][l]', l[0]); data.append('f[' + i + '][v]', l[1]); });
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
})();
