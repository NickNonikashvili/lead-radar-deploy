/* Tours page: season, length and style filters, sorting, and the result count. */
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
      var ok = (st.dur === 'all' || li.dataset.dur === st.dur) && (st.type === 'all' || li.dataset.type.split(' ').indexOf(st.type) > -1) && (st.season === 'all' || li.dataset.season.split(' ').indexOf(st.season) > -1);
      li.hidden = !ok; if (ok) n++;
    });
    var s = sort.value;
    items.slice().sort(function (a, b) { return s === 'short' ? a.dataset.days - b.dataset.days : s === 'long' ? b.dataset.days - a.dataset.days : a.dataset.order - b.dataset.order; }).forEach(function (li) { grid.appendChild(li); });
    document.getElementById('tc-n').textContent = n.toLocaleString(MFS.locale);
    document.getElementById('tc-w').textContent = P('tours', n, 'tour').replace(/^\s*\d+\s*/, '');
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
  document.getElementById('tc-all').addEventListener('click', function () { reset(); grid.querySelector('a').focus(); });
  paint();
})();
