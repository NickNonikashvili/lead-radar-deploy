/* Tooltips for the Dashboard and Statistics charts (modules/insights-lib.php → .ins-chart__plot[data-tips]).
   Hover (mouse) or tap (touch) a column: a small label shows that slot's figures and the slot is tinted.
   Without this script each slot still has an SVG <title>, and every chart has a "Show as table" list. */
(function () {
  'use strict';
  var plots = document.querySelectorAll('.ins-chart__plot[data-tips]');
  if (!plots.length) return;

  Array.prototype.forEach.call(plots, function (plot) {
    var tips;
    try { tips = JSON.parse(plot.getAttribute('data-tips') || '[]'); } catch (e) { return; }
    var svg = plot.querySelector('svg');
    var hits = plot.querySelectorAll('.ins-hit');
    if (!svg || !tips.length || hits.length !== tips.length) return;
    // The custom label replaces the browser's own tooltip.
    Array.prototype.forEach.call(hits, function (r) { var t = r.querySelector('title'); if (t) r.removeChild(t); });

    var tip = document.createElement('div');
    tip.className = 'ins-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.hidden = true;
    plot.appendChild(tip);
    var current = -1;

    function show(i) {
      if (i < 0 || i >= tips.length) { hide(); return; }
      if (i !== current) {
        if (current >= 0 && hits[current]) hits[current].classList.remove('is-active');
        hits[i].classList.add('is-active');
        tip.textContent = tips[i];
        current = i;
      }
      tip.hidden = false;
      var box = svg.getBoundingClientRect();
      var slot = box.width / tips.length;
      var x = slot * (i + 0.5);
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = Math.max(0, Math.min(box.width - w, x - w / 2));
      tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(-h - 8) + 'px)';
    }
    function hide() {
      if (current >= 0 && hits[current]) hits[current].classList.remove('is-active');
      current = -1;
      tip.hidden = true;
    }
    function indexAt(clientX) {
      var box = svg.getBoundingClientRect();
      if (box.width <= 0) return -1;
      return Math.floor((clientX - box.left) / box.width * tips.length);
    }

    svg.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') show(indexAt(e.clientX)); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      var i = indexAt(e.clientX);
      if (i === current && !tip.hidden) hide(); else show(i);
    });
    document.addEventListener('pointerdown', function (e) { if (!plot.contains(e.target)) hide(); });
    window.addEventListener('resize', function () { if (current >= 0) show(current); });
  });
})();
