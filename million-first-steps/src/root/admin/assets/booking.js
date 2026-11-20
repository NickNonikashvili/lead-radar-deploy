/* Booking page (?p=booking). No inline scripts are allowed (CSP), so the page marks its parts with data attributes:
   [data-bk-form]            the details form; data-prices = {tours: {id: {days, prices: {tier: €}}}, factors: {"1".."8"}},
                             data-t-price / data-t-noprice / data-t-day / data-t-days = translated texts
   [data-bk-tour] [data-bk-tier] [data-bk-party] (adults, children) [data-bk-start] [data-bk-end] [data-bk-total]
   [data-bk-custom]          the "custom trip" name field (shown only for "Custom trip…")
   [data-bk-days]            "5 days" under the tour
   [data-bk-suggest]         button: total = the website calculator's price (per person rounded to €10 × travellers)
   [data-bk-suggest-text]    the live price hint
   [data-bk-fills] > [data-fill-amount="900"]   quick amounts in "Record a payment"
   Also: the last day follows the first day + the tour's length until it's changed by hand, the first field with an
   error gets the focus, and leaving the page with unsaved changes in the details form asks first. */
(function () {
  'use strict';
  var d = document;

  function addDays(ymd, n) {
    var p = ymd.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function money(n) { return '€' + Math.round(n).toLocaleString('en-US'); }

  var form = d.querySelector('[data-bk-form]');
  if (form) {
    var data = {};
    try { data = JSON.parse(form.getAttribute('data-prices') || '{}'); } catch (e) { data = {}; }
    var tours = data.tours || {}, factors = data.factors || {};
    var tour = form.querySelector('[data-bk-tour]'), tier = form.querySelector('[data-bk-tier]');
    var custom = form.querySelector('[data-bk-custom]'), daysHint = form.querySelector('[data-bk-days]');
    var start = form.querySelector('[data-bk-start]'), end = form.querySelector('[data-bk-end]');
    var party = form.querySelectorAll('[data-bk-party]'), total = form.querySelector('[data-bk-total]');
    var btn = form.querySelector('[data-bk-suggest]'), hint = form.querySelector('[data-bk-suggest-text]');

    var days = function () { var t = tours[tour.value]; return t ? (t.days | 0) : 0; };
    // The last day follows the first day while it's empty or still what the tour's length gives.
    var autoEnd = !end.value || (isDate(start.value) && days() > 0 && end.value === addDays(start.value, days() - 1));

    var lastStart = start.value;
    var syncEnd = function () {
      end.min = isDate(start.value) ? start.value : '2000-01-01';
      if (!isDate(start.value)) { lastStart = start.value; return; }
      var n = days();
      if (autoEnd && n > 0) end.value = addDays(start.value, n - 1);
      else if (isDate(end.value) && isDate(lastStart) && lastStart !== start.value) {
        // The first day moved: move the last day with it, so the trip keeps its length.
        var len = Math.round((Date.parse(end.value) - Date.parse(lastStart)) / 864e5);
        end.value = addDays(start.value, Math.max(0, len));
      } else if (isDate(end.value) && end.value < start.value) end.value = start.value;
      lastStart = start.value;
    };
    var partySize = function () {
      var n = 0;
      party.forEach(function (i) { n += Math.max(0, parseInt(i.value, 10) || 0); });
      return n;
    };
    var suggestion = function () {
      var t = tours[tour.value], n = partySize(), price = t && t.prices ? +t.prices[tier.value] : 0;
      if (!t || !tier.value || !(price > 0) || n < 1) return null;
      var f = +factors[String(Math.min(n, 8))] || 1, per = Math.round(price * f / 10) * 10;
      return { per: per, n: n, total: per * n };
    };
    var syncHint = function () {
      var s = suggestion();
      hint.textContent = s
        ? form.getAttribute('data-t-price').replace('{per}', money(s.per)).replace('{n}', String(s.n)).replace('{total}', money(s.total))
        : form.getAttribute('data-t-noprice');
      if (btn) btn.disabled = !s;
    };
    var syncTour = function () {
      var isCustom = tour.value === '_custom';
      if (custom) custom.hidden = !isCustom && !custom.classList.contains('has-error');
      var n = days();
      if (daysHint) daysHint.textContent = n > 0 ? form.getAttribute(n === 1 ? 'data-t-day' : 'data-t-days').replace('{n}', String(n)) : '';
    };

    tour.addEventListener('change', function () {
      syncTour(); syncEnd(); syncHint();
      if (tour.value === '_custom' && custom) { var i = custom.querySelector('input'); if (i && !i.value) i.focus(); }
    });
    tier.addEventListener('change', syncHint);
    party.forEach(function (i) { i.addEventListener('input', syncHint); i.addEventListener('change', syncHint); });
    start.addEventListener('change', syncEnd);
    end.addEventListener('change', function () { autoEnd = !end.value; syncEnd(); });
    if (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var s = suggestion();
        if (!s) return;
        total.value = String(s.total);
        total.dispatchEvent(new Event('input', { bubbles: true }));
        total.focus();
        total.select();
      });
    }
    syncTour(); syncHint();
    end.min = isDate(start.value) ? start.value : '2000-01-01';

    // Unsaved changes: ask before leaving (also when another form on the page is sent).
    var dirty = false, sending = false;
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('change', function () { dirty = true; });
    form.addEventListener('submit', function () { sending = true; });
    window.addEventListener('beforeunload', function (e) {
      if (!dirty || sending) return;
      e.preventDefault();
      e.returnValue = '';
    });
    // Another form on the page (payment, note, delete): ask here, before admin.js disables its button.
    d.querySelectorAll('form').forEach(function (f) {
      if (f === form) return;
      f.addEventListener('submit', function (e) {
        if (dirty && !window.confirm(form.getAttribute('data-t-unsaved'))) { e.preventDefault(); e.stopPropagation(); return; }
        sending = true;
      });
    });
    var undo = form.querySelector('.bk-savebar a');
    if (undo) undo.addEventListener('click', function () { dirty = false; });
  }

  // Quick amounts when recording a payment.
  d.querySelectorAll('[data-bk-fills]').forEach(function (box) { box.hidden = false; });
  d.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-fill-amount]') : null;
    if (!b) return;
    var inp = d.getElementById('pay-amount');
    if (!inp) return;
    inp.value = b.getAttribute('data-fill-amount');
    inp.focus();
  });

  // After a failed save: put the focus on the first field that needs attention.
  var bad = d.querySelector('[aria-invalid="true"]');
  if (bad) {
    var box = bad.closest('details');
    if (box) box.open = true;
    setTimeout(function () { bad.focus(); if (bad.scrollIntoView) bad.scrollIntoView({ block: 'center' }); }, 30);
  }
})();
