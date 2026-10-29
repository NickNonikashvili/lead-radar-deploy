/* ============================================================
   StudyCat — is the whole upload in place?
   index.html, the scripts and styles in assets/ and the study guides in learn/ each say which build they belong to
   (scripts/release.js writes all four). An upload that leaves a folder behind (a zip extracted without replacing
   the files already there) would run new pages on old code, so this compares them a moment after the page loads:
   - all the same: nothing happens;
   - not the same: this device's saved copies of the site are dropped and the page reloads once (the service worker
     may have kept old files under the new build's name);
   - still not the same after that: a strip at the top says the site is being updated, and an admin sees which
     folder is behind and what to upload again.
   It lives next to index.html, not in assets/, so it is replaced along with the page. Not in the apps (they carry
   their own copy of the site).
   ============================================================ */
(function () {
  'use strict';
  var BUILD = '2026.10.29.4';   // written by scripts/release.js
  var html = document.documentElement;
  if (html.hasAttribute('data-app') || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]buildcheck\b/.test(location.search) && !window.MATHUB_BUILDCHECK) return;
  var KEY = 'mathub-buildcheck-' + BUILD;

  function behind() {
    var out = [];
    var page = html.getAttribute('data-build') || '';
    if (page !== BUILD) out.push({ part: 'index.html', has: page || 'older' });
    var js = window.MATHUB_ASSETS_BUILD || '';
    if (js !== BUILD) out.push({ part: 'assets/ (scripts)', has: js || 'older' });
    var css = '';
    try { css = getComputedStyle(html).getPropertyValue('--assets-build').replace(/["'\s]/g, ''); } catch (e) {}
    if (css !== BUILD) out.push({ part: 'assets/ (styles)', has: css || 'older' });
    return fetch('learn/build.json?v=' + BUILD + '&t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) { var b = j && j.build; if (b !== BUILD) out.push({ part: 'learn/', has: b || 'older' }); return out; });
  }

  function dropSavedCopies() {
    var jobs = [];
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('mathub-') === 0; }).map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); })); })); } catch (e) {}
    return Promise.all(jobs).catch(function () {});
  }

  /* the strip is styled inline: when assets/ is behind, the site's stylesheet may not know it */
  function strip(parts, admin) {
    if (document.getElementById('build-strip')) return;
    var el = document.createElement('div'); el.id = 'build-strip'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483000;padding:10px 16px;background:#B42318;color:#fff;font:600 14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.25)';
    var line = document.createElement('div'); line.textContent = 'StudyCat is being updated. If something looks wrong, reload the page in a minute.'; el.appendChild(line);
    if (admin) {
      var d = document.createElement('div'); d.style.cssText = 'margin-top:4px;font-weight:500;font-size:13px';
      d.textContent = 'Upload incomplete: the page is build ' + BUILD + ', but ' + parts.map(function (p) { return p.part + ' is ' + p.has; }).join(', ') + '. Upload the whole zip again and replace every file, including inside assets/ and learn/.';
      el.appendChild(d);
    }
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Hide this');
    x.style.cssText = 'position:absolute;right:8px;top:6px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#fff;font:700 20px/1 system-ui,sans-serif;cursor:pointer';
    x.addEventListener('click', function () { el.remove(); });
    el.appendChild(x);
    (document.body || html).appendChild(el);
  }

  function isAdmin() {
    return fetch('api/index.php?r=me', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.user && j.user.admin); }).catch(function () { return false; });
  }

  function run() {
    behind().then(function (parts) {
      var tried = false; try { tried = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
      if (!parts.length) { try { sessionStorage.removeItem(KEY); } catch (e) {} return; }
      if (!tried) { try { sessionStorage.setItem(KEY, '1'); } catch (e) { tried = true; } }
      if (!tried) { dropSavedCopies().then(function () { location.reload(); }); return; }
      isAdmin().then(function (admin) { strip(parts, admin); });
    });
  }
  window.MathubBuildCheck = { BUILD: BUILD, behind: behind, run: run };
  if (document.readyState === 'complete') setTimeout(run, 1500); else window.addEventListener('load', function () { setTimeout(run, 1500); });
})();
