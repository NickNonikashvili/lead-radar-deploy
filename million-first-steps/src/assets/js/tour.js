/* Tour page: price calculator (travellers × travel style) and the map following the days.
   Prices and party factors can change from the admin panel: site.js updates data-prices / data-factors
   and fires mfs:live, and the calculator works it out again. */
(function () {
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var prices = JSON.parse(calc.dataset.prices), factors = JSON.parse(calc.dataset.factors);
    var out = calc.querySelector('[data-party-out]'), pp = calc.querySelector('[data-calc-pp]'), total = calc.querySelector('[data-calc-total]'), link = calc.querySelector('[data-calc-link]');
    var party = 2, names = {}, base = link.getAttribute('href').split('?')[0];
    calc.querySelectorAll('[data-set-tier]').forEach(function (b) { names[b.dataset.setTier] = b.querySelector('b').textContent; });
    var money = function (n) { return '€' + Math.round(n).toLocaleString(MFS.locale); };
    var update = function () {
      var tier = document.documentElement.getAttribute('data-tier') || 'explorer';
      var f = factors[Math.min(party, 8)] || 1, per = Math.round(prices[tier] * f / 10) * 10;
      out.textContent = party; pp.textContent = money(per); total.textContent = money(per * party);
      calc.removeAttribute('data-live-wait'); // site.js waits for this after new prices (api/live.json)
      calc.querySelector('[data-party="-1"]').disabled = party <= 1; calc.querySelector('[data-party="1"]').disabled = party >= 16;
      var u = new URL(link.getAttribute('href'), location.href);
      u.searchParams.set('tier', names[tier] || tier); u.searchParams.set('party', party);
      link.setAttribute('href', base + u.search + u.hash);
    };
    calc.addEventListener('click', function (e) { var b = e.target.closest('[data-party]'); if (!b) return; party = Math.max(1, Math.min(16, party + +b.dataset.party)); update(); });
    document.addEventListener('mfs:tier', update);
    document.addEventListener('mfs:live', function () {
      try { prices = JSON.parse(calc.dataset.prices); factors = JSON.parse(calc.dataset.factors); } catch (e) {}
      update();
    });
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

/* Route map: the solid line is drawn only up to the stop of the day in view, the rest of the route stays
   dotted, and every stop the line has passed is coloured (stops with no day of their own too). */
(function () {
  var svg = document.querySelector('.tour-pg .tr-map svg'); if (!svg) return;
  var line = svg.querySelector('.gmap__route'); if (!line) return;
  var stops = [].slice.call(svg.querySelectorAll('.gmap__stop'));
  function upd() {
    var a = svg.querySelector('.gmap__stop.is-active'), p = a ? parseFloat(a.getAttribute('data-at')) || 0 : 0;
    line.style.strokeDashoffset = String(1 - p);
    stops.forEach(function (st) { st.classList.toggle('is-passed', (parseFloat(st.getAttribute('data-at')) || 0) <= p + 1e-4); });
  }
  new MutationObserver(upd).observe(svg, { subtree: true, attributes: true, attributeFilter: ['class'] });
  upd();
})();

/* "Why this journey" photos: every few seconds the top photo slides out and is tucked back under the stack.
   Click the stack or the arrows to go on; the slideshow waits while the pointer or focus is on it, and stays
   still for visitors who ask for reduced motion. */
(function () {
  var box = document.querySelector('.tour-pg .hl-photos'); if (!box) return;
  var cards = [].slice.call(box.querySelectorAll('.hl-card')); if (cards.length < 2) return;
  var order = cards.map(function (_, i) { return i; }), busy = false, timer = null,
    count = box.querySelector('.hl-count b'), play = box.querySelector('[data-hl="pause"]'),
    still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), paused = still, hover = false;
  function paint() {
    order.forEach(function (c, p) { cards[c].setAttribute('data-pos', p); cards[c].setAttribute('aria-hidden', p ? 'true' : 'false'); });
    count.textContent = (order[0] + 1).toLocaleString(MFS.locale);
  }
  function move(out, turn) {
    if (busy) return; busy = true;
    var c = cards[out === 'is-out' ? order[0] : order[order.length - 1]]; c.classList.add(out);
    setTimeout(function () { turn(); paint(); c.classList.remove(out); setTimeout(function () { busy = false; }, still ? 0 : 450); }, still ? 0 : 420);
  }
  function next() { move('is-out', function () { order.push(order.shift()); }); }
  function prev() { move('is-outb', function () { order.unshift(order.pop()); }); }
  function arm() { clearInterval(timer); if (!paused && !hover) timer = setInterval(next, 4200); }
  function label() { play.setAttribute('aria-pressed', String(paused)); play.setAttribute('aria-label', paused ? T("Play slideshow") : T("Pause slideshow")); }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hl]');
    if (!b) { if (e.target.closest('.hl-stack')) { next(); arm(); } return; }
    var k = b.getAttribute('data-hl');
    if (k === 'next') next(); else if (k === 'prev') prev(); else { paused = !paused; label(); }
    arm();
  });
  box.addEventListener('mouseenter', function () { hover = true; arm(); });
  box.addEventListener('mouseleave', function () { hover = false; arm(); });
  box.addEventListener('focusin', function () { hover = true; arm(); });
  box.addEventListener('focusout', function () { hover = false; arm(); });
  box.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { next(); arm(); } else if (e.key === 'ArrowLeft') { prev(); arm(); } });
  if (still) label();
  paint(); arm();
})();
