/* LUXHOUSE — residence page. Loads after site.js (window.LH).
   The page is complete without this file. It adds two small things:
   the position line under the photo strip that phones get instead of the long gallery,
   and a check that the lower third still fits when the price is unusually long. */
(() => {
  "use strict";

  const doc = document;
  const frame = (fn) => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    };
  };

  // ------------------------------------------------------------ the photo strip (phones)
  const strip = doc.querySelector("[data-strip]");
  const bar = doc.querySelector("[data-strip-bar]");
  if (strip && bar) {
    const draw = frame(() => {
      const range = strip.scrollWidth - strip.clientWidth;
      // Wider than a phone the frames are a grid and the line is not shown.
      if (range <= 0) return;
      bar.style.setProperty("--w", Math.max(0.08, strip.clientWidth / strip.scrollWidth).toFixed(4));
      bar.style.setProperty("--p", Math.min(1, Math.max(0, strip.scrollLeft / range)).toFixed(4));
    });
    strip.addEventListener("scroll", draw, { passive: true });
    window.addEventListener("resize", draw);
    window.addEventListener("load", draw);
    draw();
  }

  // ------------------------------------------------------------ the lower third
  // The bar is one line. A price in lari is a few characters longer than in dollars; if the line
  // no longer fits, the bar is set a size down (.is-tight) rather than letting anything overlap.
  const third = doc.querySelector("[data-third]");
  if (third) {
    const inner = third.firstElementChild;
    const price = third.querySelector(".third__price");
    const actions = third.querySelector(".third__actions");
    const fit = frame(() => {
      third.classList.remove("is-tight");
      if (!inner || !price || !actions) return;
      const pad = parseFloat(getComputedStyle(inner).paddingRight) || 0;
      const limit = inner.getBoundingClientRect().right - pad;
      const text = doc.createRange();
      text.selectNodeContents(price);
      const overlap = text.getBoundingClientRect().right > actions.getBoundingClientRect().left - 6;
      if (overlap || actions.getBoundingClientRect().right > limit + 0.5) third.classList.add("is-tight");
    });
    window.addEventListener("resize", fit);
    window.addEventListener("load", fit);
    doc.addEventListener("lh:currency", fit);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    fit();
  }
})();
