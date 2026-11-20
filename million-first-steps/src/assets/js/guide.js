/* Travel guide: topic filter and search across the article cards. */
(function () {
  var grid = document.getElementById('tg-grid'); if (!grid) return;
  var items = [].slice.call(grid.children), cat = 'all', qi = document.getElementById('tg-q'), feat = document.getElementById('tg-feat');
  function paint() {
    document.querySelectorAll('.fgrp .fchip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === cat); });
    var q = qi.value.trim().toLowerCase(), n = 0;
    items.forEach(function (li) { var ok = (cat === 'all' || li.dataset.cat === cat) && (!q || li.textContent.toLowerCase().indexOf(q) > -1); li.hidden = !ok; if (ok) n++; });
    if (feat) feat.hidden = cat !== 'all' || !!q;
    document.getElementById('tg-n').textContent = n.toLocaleString(MFS.locale);
    document.getElementById('tg-w').textContent = P('articles', n, 'article').replace(/^\s*\d+\s*/, '');
    document.getElementById('tg-empty').hidden = n > 0; document.getElementById('tg-reset').hidden = (cat === 'all' && !q);
    var qinfo = document.getElementById('tg-qinfo'); if (qinfo) qinfo.textContent = q ? ' ' + T('for “{q}”').replace('{q}', qi.value.trim()) : '';
  }
  document.querySelector('.fgrp').addEventListener('click', function (e) { var b = e.target.closest('.fchip'); if (!b) return; cat = b.dataset.v; paint(); });
  qi.addEventListener('input', paint);
  var fnd = document.querySelector('.tg-find');
  if (fnd) fnd.addEventListener('submit', function (e) { e.preventDefault(); paint(); document.getElementById('articles').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  function reset() { cat = 'all'; qi.value = ''; paint(); }
  document.getElementById('tg-reset').addEventListener('click', reset);
  document.getElementById('tg-all').addEventListener('click', function () { reset(); grid.querySelector('a').focus(); });
  paint();
})();
