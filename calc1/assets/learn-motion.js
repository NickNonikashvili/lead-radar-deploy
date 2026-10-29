/* ============================================================
   StudyCat — motion on the study guides (learn/*.html, built by
   scripts/build-seo.js; styles at the end of assets/seo.css)
   The pages are complete without this: it only adds
   - a header that settles onto the page once you scroll
   - a reading line under it on a topic page (how far you are)
   - parts below the fold lifting in as they arrive (LIFT); on a wide
     screen GSAP + ScrollTrigger do it in batches (assets/vendor),
     on a phone a light IntersectionObserver fade
   - the counts on the class cards climbing to their number (COUNT)
   - the worked example's solution easing open
   With Reduce motion (the OS, or StudyCat's own setting) only the
   header and the reading line remain, and nothing is hidden.
   ============================================================ */
(function () {
  'use strict';
  var d = document, root = d.documentElement, w = window;
  var reduced = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  try { if ((JSON.parse(localStorage.getItem('studyhub-settings') || '{}') || {}).motion === 'off') reduced = true; } catch (e) {}
  var wide = (w.innerWidth || 0) >= 768;
  var $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };

  /* ---------- the header and the reading line ---------- */
  var head = d.querySelector('.s-head'), main = d.querySelector('.s-wrap');
  var topic = !!d.querySelector('.s-prevnext');
  var line = null;
  if (topic && main) { line = d.createElement('div'); line.className = 's-read'; line.setAttribute('aria-hidden', 'true'); d.body.appendChild(line); }
  var ticking = false;
  var paint = function () {
    ticking = false;
    if (head) head.classList.toggle('is-scrolled', (w.scrollY || 0) > 8);
    if (line) { var r = main.getBoundingClientRect(); var span = r.height - w.innerHeight; var k = span <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / span)); line.style.transform = 'scaleX(' + k.toFixed(4) + ')'; }   // full when the article's end is on screen
  };
  w.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();
  if (reduced) return;

  /* ---------- LIFT: only parts that start below the fold, so nothing on screen ever disappears ---------- */
  var vh = w.innerHeight || 800;
  var parts = $$('.s-wrap > section, .s-cards > .s-card, .s-prevnext').filter(function (el) { return el.getBoundingClientRect().top > vh * 0.92; });
  parts.forEach(function (el) { el.classList.add('s-mo'); });
  root.classList.add('s-mo-on');
  var show = function (el) { el.classList.add('s-in'); if (w.gsap) w.gsap.set(el, { clearProps: 'opacity,transform' }); };
  d.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('.s-mo:not(.s-in)'); if (el) { el.classList.add('s-now'); show(el); } });

  /* ---------- COUNT: the class cards' numbers ---------- */
  var fmt = function (n) { try { return Number(n).toLocaleString(root.lang || 'en'); } catch (e) { return String(n); } };
  var count = function (el) {
    var to = +el.getAttribute('data-count'); if (!to || el.getAttribute('data-counted')) return; el.setAttribute('data-counted', '1');
    var t0 = performance.now(), dur = 1100;
    var step = function (t) { var k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // (a scroll check rather than an IntersectionObserver: a jump past a part, by Tab or a link, still shows it)
  var light = function () {
    root.classList.add('s-io');
    $$('[data-count]').forEach(function (el) { if (!el.closest('.s-mo')) count(el); });
    var wait = parts.slice(), busy = false;
    var check = function () {
      busy = false; var line = (w.innerHeight || 800) * 0.92;
      wait = wait.filter(function (el) { if (el.getBoundingClientRect().top >= line) return true; el.classList.add('s-in'); $$('[data-count]', el).forEach(count); return false; });
      if (!wait.length) w.removeEventListener('scroll', on);
    };
    var on = function () { if (!busy) { busy = true; requestAnimationFrame(check); } };
    w.addEventListener('scroll', on, { passive: true }); check();
  };
  if (!wide) return light();

  /* ---------- wide screens: GSAP + ScrollTrigger, fetched now (the page is already readable) ---------- */
  var build = (d.querySelector('script[src*="learn-motion.js"]') || {}).src; var v = build && /[?&]v=([^&]+)/.exec(build); v = v ? v[1] : 'dev';
  var add = function (f) { return new Promise(function (ok, no) { var s = d.createElement('script'); s.src = '/assets/vendor/' + f + '?v=' + v; s.onload = ok; s.onerror = no; d.head.appendChild(s); }); };
  var timer = setTimeout(function () { timer = null; light(); }, 2500);   // a slow network gets the light version, not a wait
  add('gsap.min.js').then(function () { return add('ScrollTrigger.min.js'); }).then(function () {
    if (!timer) return; clearTimeout(timer); var gsap = w.gsap, ST = w.ScrollTrigger; if (!gsap || !ST) return light();
    gsap.registerPlugin(ST); gsap.config({ nullTargetWarn: false });
    // parts lift in, a few at a time as they arrive (ORGANIC ODYSSEY: 0.7 s, 120 ms apart)
    ST.batch(parts, { start: 'top 86%', once: true, onEnter: function (batch) {
      batch.forEach(function (el) { el.classList.add('s-in'); });
      gsap.fromTo(batch, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.12, overwrite: true, clearProps: 'opacity,transform' });
      batch.forEach(function (el) { $$('[data-count]', el).forEach(function (n) { var o = { v: 0 }, to = +n.getAttribute('data-count'); gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: function () { n.textContent = fmt(Math.round(o.v)); } }); }); });
    } });
    $$('[data-count]').forEach(function (el) { if (!el.closest('.s-mo')) { var o = { v: 0 }, to = +el.getAttribute('data-count'); gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', delay: 0.2, onUpdate: function () { el.textContent = fmt(Math.round(o.v)); } }); } });
    // the worked example: its solution eases open and shut
    $$('.s-callout details').forEach(function (det) {
      var sum = det.querySelector('summary'), body = det.querySelector('.s-solution'); if (!sum || !body) return;
      sum.addEventListener('click', function (e) {
        e.preventDefault(); gsap.killTweensOf(body);
        if (det.open) gsap.to(body, { height: 0, opacity: 0, overflow: 'hidden', duration: 0.3, ease: 'power2.inOut', onComplete: function () { det.open = false; gsap.set(body, { clearProps: 'height,opacity,overflow' }); } });
        else { det.open = true; var h = body.offsetHeight; gsap.fromTo(body, { height: 0, opacity: 0, overflow: 'hidden' }, { height: h, opacity: 1, duration: 0.45, ease: 'power2.out', onComplete: function () { gsap.set(body, { clearProps: 'height,opacity,overflow' }); } }); }
      });
    });
    // MathJax typesets after load and changes heights: keep the triggers where the parts are
    var t = null; if ('ResizeObserver' in w && main) new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { ST.refresh(); }, 200); }).observe(main);
  }).catch(function () { if (timer) { clearTimeout(timer); timer = null; light(); } });
})();
