/* Tours page: season, length and style filters, sorting, and the result count. Tours the owners take off
   the website (site.js marks them data-live-off and fires mfs:live) never show. */
(function () {
  var grid = document.getElementById('tc-grid'); if (!grid) return;
  var items = [].slice.call(grid.children), st = { dur: 'all', type: 'all', season: 'all' };
  var sort = document.getElementById('tc-sort'), sd = document.getElementById('tc-dur'), ss = document.getElementById('tc-type');
  var q = new URLSearchParams(location.search); Object.keys(st).forEach(function (k) { if (q.get(k)) st[k] = q.get(k); }); if (q.get('sort')) sort.value = q.get('sort');
  function paint() {
    document.querySelectorAll('.tp-seasons .fchip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === st.season); });
    sd.value = st.dur; ss.value = st.type;
    var n = 0;
    items.forEach(function (li) {
      var ok = !li.hasAttribute('data-live-off') && (st.dur === 'all' || li.dataset.dur === st.dur) && (st.type === 'all' || li.dataset.type.split(' ').indexOf(st.type) > -1) && (st.season === 'all' || li.dataset.season.split(' ').indexOf(st.season) > -1);
      li.hidden = !ok; if (ok) n++;
    });
    var s = sort.value;
    items.slice().sort(function (a, b) { return s === 'short' ? a.dataset.days - b.dataset.days : s === 'long' ? b.dataset.days - a.dataset.days : a.dataset.order - b.dataset.order; }).forEach(function (li) { grid.appendChild(li); });
    document.getElementById('tc-n').textContent = n.toLocaleString(MFS.locale);
    document.getElementById('tc-w').textContent = P('tours', n, 'tour').replace(/^\s*\d+\s*/, '');
    ['tc-n', 'tc-w'].forEach(function (id) { document.getElementById(id).removeAttribute('data-live-wait'); }); // see site.js
    document.getElementById('tc-empty').hidden = n > 0; grid.hidden = n === 0;
    document.getElementById('tc-reset').hidden = !(st.dur !== 'all' || st.type !== 'all' || st.season !== 'all');
    var p = new URLSearchParams(); Object.keys(st).forEach(function (k) { if (st[k] !== 'all') p.set(k, st[k]); }); if (s !== 'featured') p.set('sort', s);
    try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); } catch (e) {}
  }
  document.querySelector('.tp-seasons').addEventListener('click', function (e) { var b = e.target.closest('.fchip'); if (!b) return; st.season = b.dataset.v; paint(); });
  sd.addEventListener('change', function () { st.dur = sd.value; paint(); });
  ss.addEventListener('change', function () { st.type = ss.value; paint(); });
  sort.addEventListener('change', paint);
  function reset() { st = { dur: 'all', type: 'all', season: 'all' }; paint(); }
  document.getElementById('tc-reset').addEventListener('click', reset);
  document.getElementById('tc-all').addEventListener('click', function () { reset(); var a = grid.querySelector('li:not([hidden]) a'); if (a) a.focus(); });
  document.addEventListener('mfs:live', paint);
  paint();
})();

/* Travel-style switch under the title: the highlight slides to the chosen style (site.js sets the style). */
(function () {
  var seg = document.querySelector('.ts-seg'); if (!seg) return;
  var th = seg.querySelector('.ts-thumb');
  function place() { var b = seg.querySelector('.ts-opt[aria-checked="true"]'); if (!b) return; th.style.width = b.offsetWidth + 'px'; th.style.setProperty('--tx', b.offsetLeft + 'px'); }
  place(); requestAnimationFrame(function () { seg.classList.add('ts-ready'); });
  document.addEventListener('mfs:tier', function () { requestAnimationFrame(place); });
  addEventListener('resize', place); if (document.fonts) document.fonts.ready.then(place);
})();

/* Each card's "Explorer price ⓘ" opens the tour's price in all three travel styles. Picking another style switches
   the whole page at once (through the switch under the title) and shows a short note at the bottom holding a working
   copy of that switch, so it can be changed back straight away. The style names and icons come from the switch, so
   they are in the page's language. */
(function () {
  var opts = [].slice.call(document.querySelectorAll('.ts-opt[data-set-tier]')); if (!opts.length) return;
  var keys = opts.map(function (b) { return b.dataset.setTier; }), names = {}, icons = {}, open = null, n = 0;
  opts.forEach(function (b) {
    names[b.dataset.setTier] = b.querySelector('span').textContent;
    var ic = b.querySelector('svg'); icons[b.dataset.setTier] = ic ? ic.outerHTML.replace('class="ts-ic"', 'class="mt-ic"') : '';
  });
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  function cur() { return document.documentElement.getAttribute('data-tier') || 'explorer'; }
  function setTier(k) { MFS.setTier(k); }

  var toast = document.createElement('div'); toast.className = 'tc-toast'; toast.setAttribute('role', 'region'); toast.setAttribute('aria-label', T("Travel style"));
  toast.innerHTML = '<span class="tc-toast-t" aria-live="polite">' + esc(T("All tours switched to")) + '</span><span class="mt" role="radiogroup" aria-label="' + esc(T("Show prices for travel style")) + '"><span class="mt-thumb"></span>' +
    keys.map(function (k) { return '<button type="button" role="radio" aria-checked="false" class="mt-o" data-t="' + k + '">' + icons[k] + '<span>' + esc(names[k]) + '</span></button>'; }).join('') +
    '</span><button type="button" class="tc-x" aria-label="' + esc(T("Close")) + '"><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
  document.body.appendChild(toast);
  var thumb = toast.querySelector('.mt-thumb'), hideT = null;
  function moveTo(k, instant) {
    var o = toast.querySelector('.mt-o[data-t="' + k + '"]'); if (!o) return;
    thumb.style.transition = instant ? 'none' : ''; thumb.style.transform = 'translate(' + o.offsetLeft + 'px,' + o.offsetTop + 'px)';
    thumb.style.width = o.offsetWidth + 'px'; thumb.style.height = o.offsetHeight + 'px'; if (instant) thumb.getBoundingClientRect();
    toast.querySelectorAll('.mt-o').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-t') === k)); });
  }
  function arm(ms) { clearTimeout(hideT); hideT = setTimeout(hide, ms); }
  function show(from, to) { toast.classList.add('is-on'); moveTo(from, true); requestAnimationFrame(function () { requestAnimationFrame(function () { moveTo(to); }); }); arm(7000); }
  function hide() { toast.classList.remove('is-on'); clearTimeout(hideT); }
  toast.addEventListener('mouseenter', function () { clearTimeout(hideT); });
  toast.addEventListener('mouseleave', function () { arm(3000); });
  toast.addEventListener('focusin', function () { clearTimeout(hideT); });
  toast.addEventListener('click', function (e) {
    var o = e.target.closest('.mt-o');
    if (o) { var k = o.getAttribute('data-t'); if (k !== cur()) { setTier(k); moveTo(k); } return; }
    if (e.target.closest('.tc-x')) hide();
  });
  document.addEventListener('mfs:tier', function () { if (toast.classList.contains('is-on')) moveTo(cur()); });
  addEventListener('resize', function () { if (toast.classList.contains('is-on')) moveTo(cur(), true); });

  function close() { if (!open) return; open.btn.setAttribute('aria-expanded', 'false'); open.pop.hidden = true; open = null; }
  document.querySelectorAll('#tc-grid .tc-price').forEach(function (price) {
    var btn = price.querySelector('.tc-tier'); if (!btn) return;
    var pop = document.createElement('div'); pop.className = 'tc-pop'; pop.hidden = true; pop.id = 'tc-pop-' + (++n);
    pop.innerHTML = '<p>' + esc(T("Price per person, from")) + '</p><ul>' + keys.map(function (k) {
      return '<li data-t="' + k + '"><button type="button" class="tc-row" data-t="' + k + '"><span>' + esc(names[k]) + '</span><b></b></button></li>';
    }).join('') + '</ul>';
    // The amounts are read when the list opens, so prices changed in the admin panel (site.js) are always current.
    function fill() { keys.forEach(function (k) { var t = price.querySelector('.tp[data-tier="' + k + '"][data-price]'); pop.querySelector('.tc-row[data-t="' + k + '"] b').textContent = t ? t.textContent : ''; }); }
    price.appendChild(pop); btn.setAttribute('aria-controls', pop.id);
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); var was = open && open.pop === pop; close();
      if (!was) { fill(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = { btn: btn, pop: pop }; }
    });
    pop.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var r = e.target.closest('.tc-row'); if (!r) return;
      var k = r.getAttribute('data-t'), from = cur();
      if (k !== from) { setTier(k); show(from, k); }
      var b = btn; close(); b.focus();
    });
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { var b = open.btn; close(); b.focus(); } });
})();
