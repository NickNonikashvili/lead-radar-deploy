/* Manage pages (owners): Tours & prices, Settings, Team, Activity. Small enhancements only — every form works
   without this file (no inline scripts are allowed: CSP).

   form[data-dirty-form]       tracks unsaved changes: shows [data-dirty-text] / hides [data-clean-text] inside it,
                               adds .is-dirty, and asks before leaving the page with unsaved changes
   [data-tour-show]            "On the website" switch: dims its [data-tour-row] card, shows its [data-off-note]
   [data-price-input]          price field: marks .tp-price.is-own while it differs from data-builtin
   [data-factor]               party-size factor field (same, .tp-factor.is-own); [data-example] recalculates
   [data-hide-toggle="#id"]    "Don't show on the website": disables the field and swaps its placeholder
                               (data-placeholder / data-hidden-placeholder)
   [data-reset-field="#id"]    "Use the built-in value": empties the field instead of sending the reset form;
                               the change is saved with the form (data-reset-note explains)
   [data-notice-form]          live preview of the website notice
   [data-maxchars="240"]       a small character counter under the field
   [data-copy-from="#id"]      copy button that copies the field's current value (admin.js does the copying)
   Also: focuses the first field with an error; highlights the Settings section in view. */
(function () {
  'use strict';
  var d = document;
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function fire(el, type) {
    var e;
    try { e = new Event(type, { bubbles: true }); } catch (x) { e = d.createEvent('Event'); e.initEvent(type, true, true); }
    el.dispatchEvent(e);
  }
  function money(n) { return '€' + Math.round(n).toLocaleString('en-US'); }
  /** Same rules as mg_parse_euros(): "1290", "1,290", "€ 1 290", "1290.00" → 1290; anything else → NaN. */
  function parsePrice(raw) {
    var s = String(raw || '').replace(/[€\s   '’]|eur/gi, '').replace(/[.,]00?$/, '');
    if (/^\d{1,3}([,.])\d{3}(\1\d{3})*$/.test(s)) return parseInt(s.replace(/\D/g, ''), 10);
    if (/^\d{1,7}$/.test(s)) return parseInt(s, 10);
    return NaN;
  }
  function parseFactor(raw) {
    var s = String(raw || '').replace(/\s/g, '').replace(',', '.');
    if (!/^(\d{1,2}(\.\d{0,3})?|\.\d{1,3})$/.test(s)) return NaN;
    var f = Math.round(parseFloat(s) * 100) / 100;
    return f >= 0.3 && f <= 3 ? f : NaN;
  }

  // ── Tours & prices ─────────────────────────────────────────────────────────────────────────────
  function syncTour(sw) {
    var card = closest(sw, '[data-tour-row]');
    if (!card) return;
    card.classList.toggle('is-off', !sw.checked);
    var note = card.querySelector('[data-off-note]');
    if (note) note.hidden = sw.checked;
  }
  function syncOwn(inp, wrapSel, parse) {
    var wrap = closest(inp, wrapSel);
    if (!wrap) return;
    var v = parse(inp.value), b = parseFloat(inp.getAttribute('data-builtin'));
    wrap.classList.toggle('is-own', inp.value.trim() !== '' && !isNaN(v) && Math.abs(v - b) > 0.0001);
  }
  var example = d.querySelector('[data-example]');
  function factorFor(n) {
    var inp = d.querySelector('[data-factor="' + n + '"]');
    if (!inp) return 1;
    var v = parseFactor(inp.value);
    return isNaN(v) ? parseFloat(inp.getAttribute('data-builtin')) : v;
  }
  function syncExample() {
    if (!example) return;
    var n = parseInt(example.getAttribute('data-n'), 10) || 4;
    var src = example.getAttribute('data-price-from'), pin = src ? d.querySelector(src) : null;
    var price = NaN;
    if (pin) price = pin.value.trim() === '' ? parseFloat(pin.getAttribute('data-builtin')) : parsePrice(pin.value);
    if (isNaN(price)) price = parseFloat(example.getAttribute('data-price'));
    var per = Math.round(price * factorFor(Math.min(8, n)) / 10) * 10;
    var out = example.querySelector('[data-example-text]');
    if (out && !isNaN(per)) {
      out.textContent = (example.getAttribute('data-tpl') || '').replace('{n}', String(n)).replace('{per}', money(per)).replace('{total}', money(per * n));
    }
  }
  all('[data-tour-show]').forEach(function (sw) { sw.addEventListener('change', function () { syncTour(sw); }); });
  all('[data-price-input]').forEach(function (inp) {
    inp.addEventListener('input', function () { syncOwn(inp, '.tp-price', parsePrice); syncExample(); });
  });
  all('[data-factor]').forEach(function (inp) {
    inp.addEventListener('input', function () { syncOwn(inp, '.tp-factor', parseFactor); syncExample(); });
  });

  // ── Settings: contact fields ───────────────────────────────────────────────────────────────────
  function syncHide(cb) {
    var inp = d.querySelector(cb.getAttribute('data-hide-toggle'));
    if (!inp) return;
    inp.disabled = cb.checked;
    var ph = cb.checked ? inp.getAttribute('data-hidden-placeholder') : inp.getAttribute('data-placeholder');
    if (ph !== null) inp.placeholder = ph;
    var field = closest(cb, '[data-cfield]');
    if (field) field.classList.toggle('is-hidden', cb.checked);
  }
  all('[data-hide-toggle]').forEach(function (cb) {
    syncHide(cb);
    cb.addEventListener('change', function () { syncHide(cb); });
  });
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-reset-field]');
    if (!b) return;
    var inp = d.querySelector(b.getAttribute('data-reset-field'));
    var field = closest(b, '[data-cfield]');
    if (!inp || !field) return;
    e.preventDefault();
    e.stopPropagation();
    var hide = field.querySelector('[data-hide-toggle]');
    if (hide && hide.checked) { hide.checked = false; syncHide(hide); fire(hide, 'change'); }
    inp.disabled = false;
    inp.value = '';
    fire(inp, 'input');
    var note = field.querySelector('.st-reset-note');
    if (!note) {
      note = d.createElement('p');
      note.className = 'st-reset-note';
      note.setAttribute('role', 'status');
      field.appendChild(note);
    }
    note.textContent = b.getAttribute('data-reset-note') || '';
    inp.focus();
  });
  d.addEventListener('input', function (e) {
    var field = closest(e.target, '[data-cfield]');
    if (!field || e.target.value === '') return;
    var note = field.querySelector('.st-reset-note');
    if (note) note.parentNode.removeChild(note);
  });

  // ── Settings: website notice preview and character counters ────────────────────────────────────
  var nf = d.querySelector('[data-notice-form]');
  if (nf) {
    var on = nf.querySelector('[data-notice-on]'), en = nf.querySelector('[data-notice-text="en"]');
    var bar = nf.querySelector('[data-notice-preview]'), txt = nf.querySelector('[data-notice-preview-text]');
    var offNote = nf.querySelector('[data-notice-off-note]');
    var syncNotice = function () {
      if (!on || !en || !bar || !txt) return;
      var v = en.value.trim();
      txt.textContent = v || txt.getAttribute('data-empty') || '';
      bar.classList.toggle('is-empty', !v);
      bar.classList.toggle('is-off', !on.checked);
      if (offNote) offNote.hidden = on.checked;
    };
    if (on) on.addEventListener('change', syncNotice);
    if (en) en.addEventListener('input', syncNotice);
    syncNotice();
  }
  all('[data-maxchars]').forEach(function (inp) {
    var max = parseInt(inp.getAttribute('data-maxchars'), 10);
    var field = closest(inp, '.field');
    if (!max || !field) return;
    var c = d.createElement('span');
    c.className = 'st-count';
    c.setAttribute('aria-hidden', 'true');
    var sync = function () {
      var n = Array.from ? Array.from(inp.value).length : inp.value.length;
      c.textContent = n + ' / ' + max;
      c.classList.toggle('is-over', n > max);
    };
    // Under the field, at the right: in its help line when it has one.
    var help = field.querySelector('.field__help');
    if (help) { help.classList.add('st-help-count'); help.appendChild(c); }
    else { var row = d.createElement('p'); row.className = 'field__help st-help-count'; row.appendChild(c); inp.parentNode.insertBefore(row, inp.nextSibling); }
    inp.addEventListener('input', sync);
    sync();
  });

  // ── Copy buttons that copy what the field holds now ────────────────────────────────────────────
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-copy-from]');
    if (!b) return;
    var src = d.querySelector(b.getAttribute('data-copy-from'));
    if (src && src.value) b.setAttribute('data-copy', src.value);
  }, true);

  // ── Unsaved changes ────────────────────────────────────────────────────────────────────────────
  function snapshot(form) {
    var out = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === '_csrf' || el.type === 'submit' || el.type === 'button' || el.type === 'hidden') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      out.push(el.name + '\u0001' + (el.disabled ? '\u0002' : '') + el.value);
    });
    return out.join('\u0000');
  }
  var forms = all('form[data-dirty-form]');
  function isDirty(f) { return f.mgFailed || snapshot(f) !== f.mgStart; }
  function syncDirty(f) {
    var dirty = isDirty(f);
    f.classList.toggle('is-dirty', dirty);
    all('[data-dirty-text]', f).forEach(function (el) { el.hidden = !dirty; });
    all('[data-clean-text]', f).forEach(function (el) { el.hidden = dirty; });
  }
  forms.forEach(function (f) {
    f.mgStart = snapshot(f);
    f.mgFailed = !!f.querySelector('[aria-invalid="true"], [data-error-summary]');
    syncDirty(f);
  });
  function onEdit(e) {
    var f = e.target && e.target.form;
    if (f && typeof f.mgStart === 'string') syncDirty(f);
  }
  d.addEventListener('input', onEdit);
  d.addEventListener('change', onEdit);
  var leaving = null;
  // Runs after admin.js's confirm step (which stops the event when someone answers "Cancel").
  window.addEventListener('submit', function (e) { if (!e.defaultPrevented) leaving = e.target; });
  window.addEventListener('beforeunload', function (e) {
    var pending = forms.filter(function (f) { return f !== leaving && isDirty(f); });
    leaving = null;
    if (!pending.length) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) forms.forEach(function (f) { f.mgStart = snapshot(f); syncDirty(f); });
  });

  // ── The first field that needs fixing ──────────────────────────────────────────────────────────
  var bad = d.querySelector('.content [aria-invalid="true"]');
  if (bad) {
    var det = closest(bad, 'details');
    if (det) det.open = true;
    try { bad.focus({ preventScroll: true }); } catch (x) { bad.focus(); }
    if (bad.scrollIntoView) bad.scrollIntoView({ block: 'center' });
  }

  // ── Settings: which section is in view ─────────────────────────────────────────────────────────
  var links = all('.st-nav__link[href^="#"]');
  if (links.length) {
    var targets = links.map(function (a) { return d.getElementById(a.getAttribute('href').slice(1)); });
    var ticking = false;
    var spy = function () {
      ticking = false;
      var cur = 0, limit = 140;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top - limit <= 0) cur = i; });
      if (window.innerHeight + window.pageYOffset >= d.documentElement.scrollHeight - 4) cur = targets.length - 1;
      links.forEach(function (a, i) {
        var active = i === cur;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      var nav = closest(links[cur], '.st-nav');
      if (nav && nav.scrollWidth > nav.clientWidth) {
        var l = links[cur], left = l.offsetLeft - 16;
        if (left < nav.scrollLeft || l.offsetLeft + l.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = left;
      }
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }
})();
