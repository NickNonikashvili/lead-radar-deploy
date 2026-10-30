/* ============================================================
   StudyCat — the genie: a page you leave closes into the sidebar, like a window into the Dock on a Mac
   How the Mac does it (and the GNOME and KWin ports): the window is cut into thin strips across the way it goes, and
   each strip is bent onto a four-cornered piece of a funnel whose sides are curves, from the window down to the Dock
   icon; the funnel forms first, then the window slides through it into the icon, its far edge following its near one.
   Here each strip is a box holding the page, with a CSS matrix3d that lays it onto its piece (a projective map, the
   same per-strip homography the GNOME extension uses): straight lines stay straight, strips meet their neighbours
   exactly, and the text stays sharp, because nothing is redrawn.
   - The page you leave goes into a ghost over the new page: fixed, inert, hidden from screen readers, on an opaque
     sheet, without the ids, names and frames inside it, its animations at their end; the new page is there
     underneath at once. The ghost goes under the sidebar (on a phone, under the top bar), so the page disappears
     into it. The parts of the page outside the screen are emptied first (they keep their size), so the copies for
     the strips are small and quick to lay out; the last, widest strip (where the page is not bent) keeps the page
     itself.
   - On a computer the neck is at the sidebar's edge, level with the link of the page you leave (assets/app.js picks
     it): the funnel lies across the screen and the page flows left into it, and the sidebar's edge bulges out there
     and snaps back (.vt-bulge). On a phone the neck is at the menu button: the funnel stands up and the page flows up
     into it, and the button squashes and snaps back (.vt-snap).
   - Strips are thinner near the neck, where the sides bend most; the funnel's sides are smoothstep curves.
   About 0.48 s from the first frame drawn; nothing at all with Reduce motion (assets/app.js does not call it).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t;
  const NK = 18, REACH = 0.72;   // half the neck, in px; how far along the screen the funnel reaches
  const SHOWN = /^(block|flex|grid|flow-root|list-item|inline-block|inline-flex|inline-grid)$/;

  /* the funnel across the flow, at a distance along it (0 at the neck): from lo to hi, out of a span of `size`;
     A is how far it has formed (0: the page as it is, 1: down to the neck) */
  function sides(along, len, size, neck, A) {
    const k = A * (1 - smooth(along / (len * REACH)));
    return [k * (neck - NK), size - k * (size - neck - NK)];
  }

  // the matrix that lays a w × h box onto the corners q (top left, top right, bottom right, bottom left): Heckbert's
  // square-to-quad map, scaled to the box
  function onto(w, h, q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1; let g = 0, k = 0;
    if (Math.abs(den) > 1e-9 && (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6)) { g = (dx3 * dy2 - dx2 * dy3) / den; k = (dx1 * dy3 - dx3 * dy1) / den; }
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    const f = v => +v.toFixed(6);
    return `matrix3d(${f(a / w)},${f(d / w)},0,${f(g / w)},${f(b / h)},${f(e / h)},0,${f(k / h)},0,0,1,0,${f(x0)},${f(y0)},0,1)`;
  }

  /* what lies wholly outside the window r (the screen) keeps its size and loses what is inside it: measured while the
     page is still on the screen (assets/app.js, before the new page is drawn, so nothing is laid out again for it),
     emptied once it has left */
  function offscreen(root, r) {
    r = r || { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; const out = [];
    const walk = el => {
      for (const c of el.children) {
        const b = c.getBoundingClientRect(); if (!b.width && !b.height) continue;
        const off = b.bottom < r.top || b.top > r.bottom || b.right < r.left || b.left > r.right;
        if (off) { if (c.firstChild && SHOWN.test(getComputedStyle(c).display)) out.push([c, b.width, b.height]); }
        else if (b.top < r.top || b.bottom > r.bottom || b.left < r.left || b.right > r.right) walk(c);
      }
    };
    walk(root); return out;
  }
  const empty = list => list.forEach(([c, w, h]) => { c.style.cssText += `;box-sizing:border-box;width:${w}px;height:${h}px;min-width:0;min-height:0;max-width:none;max-height:none;flex:none;overflow:hidden`; c.replaceChildren(); });
  App.genieMeasure = page => offscreen(page);

  // a copy of the sheet for one strip: frames and players stay blank, canvases are drawn over
  function copy(sheet, canvases) {
    const c = sheet.cloneNode(true);
    c.querySelectorAll('iframe, video, audio, object, embed').forEach(n => { ['src', 'srcdoc', 'data', 'autoplay'].forEach(a => n.removeAttribute(a)); n.querySelectorAll('source').forEach(s => s.remove()); n.style.visibility = 'hidden'; });
    if (canvases.length) c.querySelectorAll('canvas').forEach((cv, i) => { const o = canvases[i]; if (!o || !o.width || !o.height) return; cv.width = o.width; cv.height = o.height; try { cv.getContext('2d').drawImage(o, 0, 0); } catch (e) {} });
    return c;
  }

  /* page: the element of the page you leave (detached by the router); rect: where it was on the screen
     aim: { x, y } the neck on the screen (fractions), rail (the sidebar, on a computer) or el (the menu button)
     offs: App.genieMeasure(page), taken while it was on the screen (else it is measured here) */
  App.genie = function (page, rect, aim, offs, done) {
    const de = document.documentElement; const app = document.querySelector('.app') || document.body;
    const tb = document.querySelector('.topbar'); const top = tb ? Math.max(0, Math.round(tb.getBoundingClientRect().bottom)) : 0;   // under the top bar
    const left = aim.rail ? Math.round(aim.rail.getBoundingClientRect().right) : 0;
    const W = Math.max(40, innerWidth - left), H = Math.max(40, innerHeight - top); const orient = aim.rail ? 'h' : 'v';
    const len = orient === 'h' ? W : H, size = orient === 'h' ? H : W;
    const neck = Math.max(NK + 4, Math.min(size - NK - 4, orient === 'h' ? aim.y * innerHeight - top : aim.x * innerWidth - left));
    const dur = App.genieMs || 480;   // App.genieMs: slowed down to look at it
    const ghost = document.createElement('div'); ghost.className = 'genie-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    Object.assign(ghost.style, { left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px` });
    // its own id stays (the styles for #view; the new page comes first in the document, so #view still finds that one);
    // the ids inside go (outside drawings, whose shapes point at them), and the names (radio buttons would share a group with the new page's)
    page.querySelectorAll('[id]').forEach(n => { if (!n.closest('svg')) n.removeAttribute('id'); });
    page.querySelectorAll('[name], [autofocus]').forEach(n => { n.removeAttribute('name'); n.removeAttribute('autofocus'); });
    Object.assign(page.style, { position: 'absolute', left: `${rect.left - left}px`, top: `${rect.top - top}px`, width: `${rect.width}px`, margin: '0' });
    const sheet = document.createElement('div'); sheet.className = 'genie-sheet'; sheet.style.width = `${W}px`; sheet.style.height = `${H}px`;
    if (offs) empty(offs);
    sheet.appendChild(page); ghost.appendChild(sheet);
    de.classList.add('genie-on'); app.appendChild(ghost);
    if (!offs) empty(offscreen(page, { left, top, right: left + W, bottom: top + H }));
    const nodes = page.getElementsByTagName('*').length;
    // strips: thin near the neck, fewer when the page is big (each is a copy to lay out), one wide one where the funnel ends
    const reach = len * REACH, n = Math.max(6, Math.min(orient === 'h' ? 16 : 10, Math.floor(1400 / Math.max(1, nodes))));
    const cuts = []; for (let j = 0; j <= n; j++) cuts.push(reach * Math.pow(j / n, 1.35)); cuts.push(len);
    const canvases = Array.from(page.querySelectorAll('canvas'));
    const strips = [];
    for (let j = 0; j < cuts.length - 1; j++) {
      const last = j === cuts.length - 2; const a0 = cuts[j], a1 = last ? cuts[j + 1] : cuts[j + 1] + 1;   // each overlaps the next by a pixel: no seams
      const box = document.createElement('div'); box.className = 'genie-strip';
      const bw = orient === 'h' ? a1 - a0 : W, bh = orient === 'h' ? H : a1 - a0;
      box.style.width = `${bw}px`; box.style.height = `${bh}px`;
      const s = last ? sheet : copy(sheet, canvases); box.appendChild(s); strips.push({ box, s, a0, a1, bw, bh });
    }
    ghost.replaceChildren(...strips.map(p => p.box));
    let t0 = 0, raf = 0;
    const draw = t => {
      // the funnel forms in the first 36%; from 26% the page slides through it, picking up speed, its far edge last
      const A = easeOut(Math.min(1, t / 0.36)), go = len * 1.02 * easeIn(Math.max(0, (t - 0.26) / 0.74));
      for (const p of strips) {
        const gone = p.a0 + go >= len; p.box.style.visibility = gone ? 'hidden' : ''; if (gone) continue;
        const [l0, h0] = sides(p.a0, len, size, neck, A), [l1, h1] = sides(p.a1, len, size, neck, A);
        p.box.style.transform = onto(p.bw, p.bh, orient === 'h' ? [[p.a0, l0], [p.a1, l1], [p.a1, h1], [p.a0, h0]] : [[l0, p.a0], [h0, p.a0], [h1, p.a1], [l1, p.a1]]);
        p.s.style.transform = orient === 'h' ? `translate3d(${-(p.a0 + go)}px,0,0)` : `translate3d(0,${-(p.a0 + go)}px,0)`;
      }
    };
    draw(0);
    /* the clock starts a frame late, once the strips have been drawn the first time (the costly frame), so the motion
       starts at its start; then the sidebar's edge stretches out where the page goes in, or the menu button squashes */
    const frame = now => {
      if (!t0) { t0 = now; if (aim.rail && App.genieBulge) App.genieBulge(aim, dur); else if (aim.el && App.burst) setTimeout(() => App.burst(aim.el, 'vt-snap'), dur * 0.78); }
      const t = Math.min(1, (now - t0) / dur); draw(t); if (t < 1) raf = requestAnimationFrame(frame); else finish();
    };
    const finish = () => { cancelAnimationFrame(raf); ghost.remove(); if (!document.querySelector('.genie-ghost')) de.classList.remove('genie-on'); if (done) done(); };
    raf = requestAnimationFrame(() => { raf = requestAnimationFrame(frame); });
    return { ghost, finish, strips: strips.length };
  };
})(window);
