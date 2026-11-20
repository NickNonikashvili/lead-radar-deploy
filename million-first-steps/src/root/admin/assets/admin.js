/* Million First Steps — team area behaviours. No inline scripts are allowed (CSP), so pages use these
   data attributes instead. Module scripts go in admin/assets/<module>.js (render(…, ['js' => ['x.js']])).

   data-menu-toggle           button opening/closing the phone menu (sidebar); data-menu-close closes it
   data-confirm="Question?"   on a <form> (asked on submit), a submit <button>, or an <a>: asks before going on
   data-autosubmit            on a select/input/checkbox: submits its form when changed (filters)
   data-copy="text"           button copies the text; shows data-copied="Copied" (or "Copied") for a moment
   data-check-all="ids[]"     checkbox that ticks every input[name="ids[]"] in the same form; buttons with
                              data-bulk in that form are enabled only while something is ticked; elements with
                              data-bulk-count show how many; data-bulk-show elements appear while ticked
   data-dismiss               inside .flash (or any [data-dismissable]): removes it
   data-href="url"            on a table row/card: a click anywhere (except links, buttons, inputs) opens url
   data-toggle-password="#id" button showing/hiding a password field (label in aria-label / data-label-hide)
   data-toggle="#id"          button showing/hiding another element (sets aria-expanded)
   data-once                  on a <form>: disables its submit buttons after it was sent (no double posts)
   data-autofocus-end         on an input/textarea: focus it with the caret at the end
   .tabs                      a strip wider than the screen scrolls the chosen tab into view and fades the
                              edge(s) with more tabs (.has-more-l / .has-more-r)
   Also: sets localStorage 'mfs-nostat' = '1' so the website doesn't count the team's own visits. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  try { localStorage.setItem('mfs-nostat', '1'); } catch (e) { /* private mode */ }

  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }

  // ── Phone menu ─────────────────────────────────────────────────────────────────────────────────
  var side = d.getElementById('side'), toggle = d.querySelector('[data-menu-toggle]'), backdrop = d.querySelector('.backdrop');
  function setMenu(open) {
    html.classList.toggle('menu-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) backdrop.hidden = !open;
    if (open && side) { var first = side.querySelector('a, button'); if (first) setTimeout(function () { first.focus(); }, 60); }
    else if (!open && toggle && side && side.contains(d.activeElement)) toggle.focus();
  }
  d.addEventListener('click', function (e) {
    if (closest(e.target, '[data-menu-toggle]')) { e.preventDefault(); setMenu(!html.classList.contains('menu-open')); return; }
    if (closest(e.target, '[data-menu-close]')) { setMenu(false); return; }
    if (html.classList.contains('menu-open') && closest(e.target, '.side a')) setMenu(false);
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && html.classList.contains('menu-open')) setMenu(false);
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 960 && html.classList.contains('menu-open')) setMenu(false); });

  // ── Confirm dialogs ────────────────────────────────────────────────────────────────────────────
  var lastSubmitter = null;
  d.addEventListener('click', function (e) {
    var b = closest(e.target, 'button, input[type="submit"]');
    if (b && b.form) lastSubmitter = b;
    var a = closest(e.target, 'a[data-confirm], button[data-confirm]:not([type="submit"]):not([form])');
    if (a && !(a.tagName === 'BUTTON' && a.form && (a.type || 'submit') === 'submit')) {
      if (!window.confirm(a.getAttribute('data-confirm'))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }, true);
  d.addEventListener('submit', function (e) {
    var f = e.target, s = e.submitter || lastSubmitter;
    if (s && s.form !== f) s = null;
    var q = (s && s.getAttribute('data-confirm')) || f.getAttribute('data-confirm');
    if (q && !window.confirm(q)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (f.hasAttribute('data-once')) {
      setTimeout(function () {
        f.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]').forEach(function (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
      }, 0);
      // Back/forward cache: enable them again when the page is shown from history.
      window.addEventListener('pageshow', function () {
        f.querySelectorAll('[aria-busy="true"]').forEach(function (b) { b.disabled = false; b.removeAttribute('aria-busy'); });
      }, { once: true });
    }
    lastSubmitter = null;
  });

  // ── Auto-submitting filters ────────────────────────────────────────────────────────────────────
  d.addEventListener('change', function (e) {
    var el = closest(e.target, '[data-autosubmit]');
    if (!el || !el.form) return;
    if (el.form.requestSubmit) el.form.requestSubmit(); else el.form.submit();
  });

  // ── Copy buttons ───────────────────────────────────────────────────────────────────────────────
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var t = d.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      d.body.appendChild(t); t.select();
      try { d.execCommand('copy') ? ok() : fail(); } catch (err) { fail(err); }
      d.body.removeChild(t);
    });
  }
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-copy]');
    if (!b) return;
    e.preventDefault();
    copyText(b.getAttribute('data-copy')).then(function () {
      var label = b.querySelector('[data-copy-label]') || null, old = label ? label.textContent : b.getAttribute('aria-label');
      var done = b.getAttribute('data-copied') || 'Copied';
      b.classList.add('is-copied');
      if (label) label.textContent = done; else b.setAttribute('aria-label', done);
      var live = d.getElementById('mfs-live');
      if (!live) { live = d.createElement('div'); live.id = 'mfs-live'; live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); d.body.appendChild(live); }
      live.textContent = done;
      setTimeout(function () { b.classList.remove('is-copied'); if (label) label.textContent = old; else if (old) b.setAttribute('aria-label', old); }, 1600);
    }, function () { window.prompt('', b.getAttribute('data-copy')); });
  });

  // ── Bulk selection ─────────────────────────────────────────────────────────────────────────────
  function bulkScope(el) { return el.form || closest(el, 'form') || d; }
  function syncBulk(scope) {
    var all = scope.querySelectorAll('[data-check-all]');
    all.forEach(function (master) {
      var name = master.getAttribute('data-check-all');
      var boxes = scope.querySelectorAll('input[type="checkbox"][name="' + name + '"]');
      var n = 0; boxes.forEach(function (b) { if (b.checked) n++; });
      master.checked = n > 0 && n === boxes.length;
      master.indeterminate = n > 0 && n < boxes.length;
      scope.querySelectorAll('[data-bulk]').forEach(function (b) { b.disabled = n === 0; });
      scope.querySelectorAll('[data-bulk-count]').forEach(function (c) { c.textContent = String(n); });
      scope.querySelectorAll('[data-bulk-show]').forEach(function (c) { c.hidden = n === 0; });
    });
  }
  d.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-check-all]')) {
      var scope = bulkScope(t);
      scope.querySelectorAll('input[type="checkbox"][name="' + t.getAttribute('data-check-all') + '"]').forEach(function (b) { b.checked = t.checked; });
      syncBulk(scope);
    } else if (t.type === 'checkbox' && t.name) {
      var sc = bulkScope(t);
      if (sc.querySelector('[data-check-all="' + t.name + '"]')) syncBulk(sc);
    }
  });
  d.querySelectorAll('[data-check-all]').forEach(function (m) { syncBulk(bulkScope(m)); });

  // ── Dismissable messages ───────────────────────────────────────────────────────────────────────
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-dismiss]');
    if (!b) return;
    var box = closest(b, '.flash, [data-dismissable]');
    if (box) box.parentNode.removeChild(box);
  });

  // ── Clickable rows ─────────────────────────────────────────────────────────────────────────────
  d.addEventListener('click', function (e) {
    var row = closest(e.target, '[data-href]');
    if (!row || e.defaultPrevented || closest(e.target, 'a, button, input, select, textarea, label, summary')) return;
    if (window.getSelection && String(window.getSelection()).length > 0) return;
    var href = row.getAttribute('data-href');
    if (!href || /^\s*javascript:/i.test(href)) return;
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank'); else location.href = href;
  });

  // ── Show/hide password, toggles ────────────────────────────────────────────────────────────────
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-toggle-password]');
    if (b) {
      var inp = d.querySelector(b.getAttribute('data-toggle-password'));
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      if (!b.hasAttribute('data-label-show')) b.setAttribute('data-label-show', b.getAttribute('aria-label') || 'Show password');
      b.setAttribute('aria-label', show ? (b.getAttribute('data-label-hide') || 'Hide password') : b.getAttribute('data-label-show'));
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
      return;
    }
    var tg = closest(e.target, '[data-toggle]');
    if (tg) {
      var target = d.querySelector(tg.getAttribute('data-toggle'));
      if (!target) return;
      e.preventDefault();
      target.hidden = !target.hidden;
      tg.setAttribute('aria-expanded', target.hidden ? 'false' : 'true');
      if (!target.hidden) { var f = target.querySelector('input, select, textarea, button'); if (f) f.focus(); }
    }
  });

  // ── Tab strips that scroll sideways (phones): show the chosen tab, fade the edge that has more ──
  Array.prototype.forEach.call(d.querySelectorAll('.tabs'), function (strip) {
    function edges() {
      var more = strip.scrollWidth - strip.clientWidth > 2;
      strip.classList.toggle('has-more-l', more && strip.scrollLeft > 2);
      strip.classList.toggle('has-more-r', more && strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 2);
    }
    var cur = strip.querySelector('.is-active, [aria-current]');
    if (cur && strip.scrollWidth > strip.clientWidth) {
      var left = cur.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - (strip.clientWidth - cur.offsetWidth) / 2;
      strip.scrollLeft = Math.max(0, left);
    }
    edges();
    strip.addEventListener('scroll', edges, { passive: true });
    window.addEventListener('resize', edges);
  });

  // ── Focus with the caret at the end ────────────────────────────────────────────────────────────
  var fe = d.querySelector('[data-autofocus-end]');
  if (fe) { fe.focus(); try { var l = fe.value.length; fe.setSelectionRange(l, l); } catch (err) { /* not a text field */ } }
})();
