/* Trip request: "When" (calendar or flexible months) and "Travellers" pop-ups.
   Used by the request forms on Home and Contact. Month and weekday names come from the browser
   in the page's language (Intl), so they need no translation. */
(function () {
  var form = document.querySelector('form#req-form'); if (!form || !document.getElementById('pop-when')) return;
  var LOC = (window.MFS && MFS.locale) || 'en-GB';
  var fmtMonth = new Intl.DateTimeFormat(LOC, { month: 'long' }), fmtMon = new Intl.DateTimeFormat(LOC, { month: 'short' });
  var fmtMY = new Intl.DateTimeFormat(LOC, { month: 'long', year: 'numeric' }), fmtDM = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short' });
  var fmtFull = new Intl.DateTimeFormat(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtWd = new Intl.DateTimeFormat(LOC, { weekday: 'short' });
  function d0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var today = d0(new Date());
  // Length chips are translated through their data-len value: T('A few days') T('A week') T('Two weeks')
  var st = { mode: 'dates', start: null, end: null, tol: 0, len: 'A week', months: [], view: new Date(today.getFullYear(), today.getMonth(), 1), who: { adults: 2, children: 0, infants: 0 } };
  var pops = { when: document.getElementById('pop-when'), who: document.getElementById('pop-who') };
  var trig = { when: document.getElementById('rq-when-btn'), who: document.getElementById('rq-people-btn') };
  var open = null;

  // Weekday initials in the page's language, Monday first.
  var wd = form.querySelectorAll('.cal-wd span');
  for (var i = 0; i < wd.length; i++) wd[i].textContent = fmtWd.format(new Date(2024, 0, 1 + i)).replace('.', '');

  function place(k) { var f = form.getBoundingClientRect(), t = trig[k].getBoundingClientRect(); pops[k].style.top = (t.bottom - f.top + 8) + 'px'; }
  function show(k) {
    if (open && open !== k) hide(open, false); open = k; pops[k].hidden = false; trig[k].setAttribute('aria-expanded', 'true'); place(k); if (k === 'when') renderWhen();
    try { pops[k].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    var first = pops[k].querySelector('[aria-selected="true"],button:not(:disabled)'); if (first) first.focus();
  }
  function hide(k, focus) { pops[k].hidden = true; trig[k].setAttribute('aria-expanded', 'false'); if (open === k) open = null; if (focus) trig[k].focus(); }
  Object.keys(trig).forEach(function (k) { trig[k].addEventListener('click', function () { open === k ? hide(k, false) : show(k); }); });
  document.addEventListener('mousedown', function (e) { if (!open) return; if (pops[open].contains(e.target) || trig[open].contains(e.target)) return; hide(open, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { e.preventDefault(); hide(open, true); } });
  window.addEventListener('resize', function () { if (open) place(open); });
  form.querySelectorAll('.pop-done').forEach(function (b) { b.addEventListener('click', function () { hide(open, true); }); });

  /* ---- When ---- */
  var grid = document.getElementById('cal-grid'), title = document.getElementById('cal-title'), prev = document.getElementById('cal-prev');
  function whenText() {
    if (st.mode === 'dates') {
      if (!st.start) return '';
      var t = (!st.end || +st.end === +st.start) ? fmtDM.format(st.start) : fmtDM.format(st.start) + ' – ' + fmtDM.format(st.end);
      return t + (st.tol ? ' (±' + st.tol + ')' : '');
    }
    var ms = st.months.slice().sort(function (a, b) { return a - b; }).map(function (i) { return fmtMon.format(new Date(today.getFullYear(), today.getMonth() + i, 1)); });
    var len = T(st.len);
    return ms.length ? T('{len} in {months}').replace('{len}', len).replace('{months}', ms.join(', ')) : T('{len}, any month').replace('{len}', len);
  }
  function syncWhen() { var t = whenText(), v = document.getElementById('rq-when-v'); v.textContent = t || T('Add dates'); v.classList.toggle('is-empty', !t); document.getElementById('rq-when').value = t; }
  function renderCal() {
    var y = st.view.getFullYear(), m = st.view.getMonth(); title.textContent = fmtMY.format(st.view);
    prev.disabled = (y === today.getFullYear() && m === today.getMonth());
    var first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), h = '';
    for (var i = 0; i < first; i++) h += '<span></span>';
    for (var d = 1; d <= n; d++) {
      var dt = new Date(y, m, d), c = [], past = dt < today;
      var S = st.start && +dt === +st.start, E = st.end && +dt === +st.end;
      if (S) c.push('s'); if (E || (S && !st.end)) c.push('e');
      if (st.start && st.end && dt > st.start && dt < st.end) c.push('in');
      h += '<button type="button" class="' + c.join(' ') + '" data-t="' + (+dt) + '"' + (past ? ' disabled' : '') + ' aria-pressed="' + !!(S || E) + '" aria-label="' + fmtFull.format(dt) + '"><span>' + d + '</span></button>';
    }
    grid.innerHTML = h;
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return; var dt = new Date(+b.dataset.t);
    if (!st.start || st.end || dt < st.start) { st.start = dt; st.end = null; } else { st.end = dt; }
    renderCal(); syncWhen(); var again = grid.querySelector('[data-t="' + (+dt) + '"]'); if (again) again.focus();
  });
  prev.addEventListener('click', function () { st.view = new Date(st.view.getFullYear(), st.view.getMonth() - 1, 1); renderCal(); });
  document.getElementById('cal-next').addEventListener('click', function () { st.view = new Date(st.view.getFullYear(), st.view.getMonth() + 1, 1); renderCal(); });
  function pressGroup(box, btn) { box.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === btn)); }); }
  document.getElementById('when-tol').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; st.tol = +b.dataset.tol; pressGroup(this, b); syncWhen(); });
  document.getElementById('flex-len').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; st.len = b.dataset.len; pressGroup(this, b); syncWhen(); });
  var mbox = document.getElementById('flex-months');
  function renderMonths() {
    var h = '';
    for (var i = 0; i < 12; i++) {
      var d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      h += '<button type="button" class="mon" data-i="' + i + '" aria-pressed="' + (st.months.indexOf(i) > -1) + '" aria-label="' + fmtMY.format(d) + '"><svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="3" y="5" width="20" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h20M8 3v4M18 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' + fmtMon.format(d) + '<small>' + d.getFullYear() + '</small></button>';
    }
    mbox.innerHTML = h;
  }
  mbox.addEventListener('click', function (e) {
    var b = e.target.closest('.mon'); if (!b) return; var i = +b.dataset.i, k = st.months.indexOf(i);
    if (k > -1) st.months.splice(k, 1); else st.months.push(i); b.setAttribute('aria-pressed', String(k === -1)); syncWhen();
  });
  var tabs = { dates: document.getElementById('tab-dates'), flex: document.getElementById('tab-flex') };
  function setMode(m) {
    st.mode = m; tabs.dates.setAttribute('aria-selected', String(m === 'dates')); tabs.flex.setAttribute('aria-selected', String(m === 'flex'));
    document.getElementById('when-dates').hidden = m !== 'dates'; document.getElementById('when-flex').hidden = m !== 'flex'; syncWhen();
  }
  tabs.dates.addEventListener('click', function () { setMode('dates'); }); tabs.flex.addEventListener('click', function () { setMode('flex'); });
  function renderWhen() { renderCal(); renderMonths(); }

  /* ---- Who ---- */
  var MIN = { adults: 1, children: 0, infants: 0 }, MAX = 16;
  function whoText() {
    var w = st.who, p = [P('{n} adults', w.adults, '{n} adult')];
    if (w.children) p.push(P('{n} children', w.children, '{n} child'));
    if (w.infants) p.push(P('{n} infants', w.infants, '{n} infant'));
    return p.join(', ');
  }
  function syncWho() {
    pops.who.querySelectorAll('.stp').forEach(function (r) {
      var k = r.dataset.k, v = st.who[k];
      r.querySelector('output').textContent = v; r.querySelector('[data-d="-1"]').disabled = v <= MIN[k]; r.querySelector('[data-d="1"]').disabled = v >= MAX;
    });
    var w = st.who, n = w.adults + w.children + w.infants;
    document.getElementById('rq-people-v').textContent = P('{n} travellers', n, '{n} traveller');
    document.getElementById('rq-people').value = whoText();
  }
  pops.who.addEventListener('click', function (e) { var b = e.target.closest('.stp-b'); if (!b || b.disabled) return; var k = b.closest('.stp').dataset.k; st.who[k] += +b.dataset.d; syncWho(); });
  window.mfsSetTravellers = function (n) { st.who = { adults: Math.max(1, Math.min(MAX, n)), children: 0, infants: 0 }; syncWho(); };

  /* ---- Clear / reset ---- */
  form.querySelectorAll('.pop-clear').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.clear === 'when') { st.start = st.end = null; st.tol = 0; st.months = []; pressGroup(document.getElementById('when-tol'), document.querySelector('#when-tol [data-tol="0"]')); renderWhen(); syncWhen(); }
      else { st.who = { adults: 2, children: 0, infants: 0 }; syncWho(); }
    });
  });
  form.addEventListener('reset', function () {
    setTimeout(function () { st.start = st.end = null; st.tol = 0; st.months = []; st.mode = 'dates'; setMode('dates'); st.who = { adults: 2, children: 0, infants: 0 }; syncWho(); syncWhen(); if (open) hide(open, false); }, 0);
  });
  syncWho(); syncWhen();
})();

/* Phone country code: a list of countries in the page's language, preselected from the visitor's
   time zone or browser language. Works for every .tel / .tel2 field. */
(function () {
  var selects = document.querySelectorAll('#rq-cc, .tel2 select'); if (!selects.length) return;
  var D = 'AF93 AL355 DZ213 AD376 AO244 AG1 AR54 AM374 AU61 AT43 AZ994 BS1 BH973 BD880 BB1 BY375 BE32 BZ501 BJ229 BT975 BO591 BA387 BW267 BR55 BN673 BG359 BF226 BI257 KH855 CM237 CA1 CV238 CF236 TD235 CL56 CN86 CO57 KM269 CG242 CD243 CR506 CI225 HR385 CU53 CY357 CZ420 DK45 DJ253 DM1 DO1 EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FJ679 FI358 FR33 GA241 GM220 GE995 DE49 GH233 GR30 GD1 GT502 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 IN91 ID62 IR98 IQ964 IE353 IL972 IT39 JM1 JP81 JO962 KZ7 KE254 KI686 KW965 KG996 LA856 LV371 LB961 LS266 LR231 LY218 LI423 LT370 LU352 MO853 MG261 MW265 MY60 MV960 ML223 MT356 MH692 MR222 MU230 MX52 FM691 MD373 MC377 MN976 ME382 MA212 MZ258 MM95 NA264 NR674 NP977 NL31 NZ64 NI505 NE227 NG234 KP850 MK389 NO47 OM968 PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 PL48 PT351 PR1 QA974 RO40 RU7 RW250 KN1 LC1 VC1 WS685 SM378 ST239 SA966 SN221 RS381 SC248 SL232 SG65 SK421 SI386 SB677 SO252 ZA27 KR82 SS211 ES34 LK94 SD249 SR597 SE46 CH41 SY963 TW886 TJ992 TZ255 TH66 TL670 TG228 TO676 TT1 TN216 TR90 TM993 TV688 UG256 UA380 AE971 GB44 US1 UY598 UZ998 VU678 VA39 VE58 VN84 YE967 ZM260 ZW263';
  var LOC = (window.MFS && MFS.locale) || 'en-GB';
  var names; try { names = new Intl.DisplayNames([LOC, 'en'], { type: 'region' }); } catch (e) { names = null; }
  function flag(c) { return String.fromCodePoint.apply(null, c.split('').map(function (ch) { return 127397 + ch.charCodeAt(0); })); }
  var list = D.split(' ').map(function (t) { var c = t.slice(0, 2); return { c: c, d: '+' + t.slice(2), n: names ? names.of(c) : c }; })
    .sort(function (a, b) { return a.n.localeCompare(b.n, LOC); });
  // The visitor's country from the time zone (zone → country for the most common zones), else the browser language.
  var TZ = { 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Athens': 'GR', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Moscow': 'RU', 'Europe/Minsk': 'BY', 'Europe/Istanbul': 'TR', 'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Baku': 'AZ', 'Asia/Jerusalem': 'IL', 'Asia/Tel_Aviv': 'IL', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA' };
  function has(c) { return !!c && list.some(function (x) { return x.c === c; }); }
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']), byLang = '';
  langs.some(function (l) { var r = (l.split('-')[1] || '').toUpperCase(); if (has(r)) { byLang = r; return true; } });
  var def = has(TZ[tz]) ? TZ[tz] : (byLang || 'GB');
  selects.forEach(function (sel) {
    var out = sel.parentNode.querySelector('#rq-cc-v, .ccv');
    sel.innerHTML = list.map(function (x) { return '<option value="' + x.c + '" data-d="' + x.d + '">' + x.n + ' (' + x.d + ')</option>'; }).join('');
    sel.value = def;
    function sync() { var o = sel.options[sel.selectedIndex]; if (out) out.textContent = flag(o.value) + ' ' + o.dataset.d; }
    sel.addEventListener('change', sync); sync();
    var f = sel.closest('form'); if (f) f.addEventListener('reset', function () { setTimeout(function () { sel.value = def; sync(); }, 0); });
  });
})();
