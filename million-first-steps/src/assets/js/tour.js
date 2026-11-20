/* Tour page: price calculator (travellers × travel style) and the map following the days. */
(function () {
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var prices = JSON.parse(calc.dataset.prices), factors = JSON.parse(calc.dataset.factors);
    var out = calc.querySelector('[data-party-out]'), pp = calc.querySelector('[data-calc-pp]'), total = calc.querySelector('[data-calc-total]'), link = calc.querySelector('[data-calc-link]');
    var party = 2, names = {};
    calc.querySelectorAll('[data-set-tier]').forEach(function (b) { names[b.dataset.setTier] = b.querySelector('b').textContent; });
    var money = function (n) { return '€' + Math.round(n).toLocaleString(MFS.locale); };
    var update = function () {
      var tier = document.documentElement.getAttribute('data-tier') || 'explorer';
      var f = factors[Math.min(party, 8)] || 1, per = Math.round(prices[tier] * f / 10) * 10;
      out.textContent = party; pp.textContent = money(per); total.textContent = money(per * party);
      calc.querySelector('[data-party="-1"]').disabled = party <= 1; calc.querySelector('[data-party="1"]').disabled = party >= 16;
      var u = new URL(link.getAttribute('href'), location.href);
      u.searchParams.set('tier', names[tier] || tier); u.searchParams.set('party', party);
      link.setAttribute('href', u.pathname.split('/').pop() + u.search + u.hash);
    };
    calc.addEventListener('click', function (e) { var b = e.target.closest('[data-party]'); if (!b) return; party = Math.max(1, Math.min(16, party + +b.dataset.party)); update(); });
    document.addEventListener('mfs:tier', update);
    update();
  }

  // The stop of the day in view lights up on the map; the stops before it count as reached.
  var days = [].slice.call(document.querySelectorAll('.tr-day')), map = document.querySelector('.tr-map svg');
  if (!days.length || !map || !('IntersectionObserver' in window)) return;
  var stops = [].slice.call(map.querySelectorAll('.gmap__stop'));
  function light(i) {
    var seen = days.slice(0, i + 1).map(function (d) { return d.dataset.stop; });
    stops.forEach(function (s) { s.classList.toggle('is-active', s.dataset.stop === days[i].dataset.stop); s.classList.toggle('is-reached', seen.indexOf(s.dataset.stop) > -1); });
    days.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
  }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) light(days.indexOf(e.target)); }); }, { rootMargin: '-45% 0px -50% 0px' });
  days.forEach(function (d) { io.observe(d); });
  light(0);
})();
