/* ============================================================
   Mathub — the shared board (assets/bo-pad.js): a whiteboard as big as the screen, for you and Bo.
   - You write on it: a pen (pressure from a stylus), a highlighter, an eraser that takes away whole strokes,
     typed text (x^2 shows as x²) and photos of a problem. Undo and redo; Clear can be undone too.
   - It is a board, not a page: drag with the hand (or two fingers, the middle button, the wheel) to move
     around, pinch or Ctrl + wheel to zoom, Fit shows everything. With a stylus, fingers only move the board.
   - Bo writes on it too: his pages (App.boBoard, from a call: assets/talk.js) go up as cards next to your
     work, in free space, and can be dragged, folded or put away; he marks your writing like a tutor with a
     pen (circles, checks, crosses, underlines, arrows, notes), drawn stroke by stroke.
   - Bo reads it from a picture (look()): your writing, his marks and where his pages sit, with a grid over
     it (columns A, B, C… across, rows 1, 2, 3… down) so he can say where: a mark "at C3" or "B2:D3" lands
     on that part of your writing, wherever you have moved the board since.
   - Your writing is kept on this device for the class (localStorage, not photos) for the next call.
   App.boPad.create(host, options) → the board; App.boPad.sketch(options) → a board on the whole screen for
   the chat ("Write it out"), whose picture goes with your next question.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, toast } = App;
  const still = () => (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'off';
  if (App.ICONS) Object.assign(App.ICONS, {
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3 16.7a2 2 0 0 1 3-2.6L8 16"/>',
    marker: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    eraser: '<path d="M7 21L3 17a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11.8 21"/><path d="M22 21H7M5 11l9 9"/>',
    text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>',
    minus: '<path d="M5 12h14"/>'
  });
  // the pen's colours (ink is dark on the whiteboard, light on the dark board); Bo's marks have their own
  const INK = { ink: ['#0D1626', '#F1F5FA'], blue: ['#1864AB', '#74C0FC'], red: ['#E03131', '#FF8787'], green: ['#2B8A3E', '#69DB7C'], purple: ['#7048E8', '#B197FC'] };
  const HL = { ink: '#FFD43B', blue: '#74C0FC', red: '#FFA8A8', green: '#8CE99A', purple: '#D0BFFF' };
  const BO = { mark: ['#E8590C', '#FFA94D'], green: ['#2B8A3E', '#69DB7C'], red: ['#E03131', '#FF8787'], blue: ['#1864AB', '#74C0FC'], purple: ['#7048E8', '#B197FC'], orange: ['#E8590C', '#FFA94D'] };
  const SIZES = { s: 2, m: 3.4, l: 6.5 };
  const COLS = 'ABCDEFGHIJKL';
  const KINDS = ['circle', 'check', 'cross', 'underline', 'arrow', 'box', 'note'];
  const font = () => getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const pretty = s => (App.boDraw && App.boDraw.pretty ? App.boDraw.pretty(s) : String(s));
  let nid = 0; const newId = () => `p${Date.now().toString(36)}${(++nid).toString(36)}`;

  /* ---------- Bo's marks as strokes: a hand-drawn line, a little uneven, the same every time it is drawn ---------- */
  function rng(seed) { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function markShape(m, avoid) {
    const [x, y, w, h] = m.r; const R = rng(m.id); const j = a => (R() - 0.5) * a; const lines = []; let text = null;
    const big = Math.max(18, Math.min(30, h * 0.55));
    if (m.kind === 'circle') {
      const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 10 + w * 0.04, ry = h / 2 + 9 + h * 0.06; const a0 = -2.4 + j(0.4); const pts = [];
      for (let k = 0; k <= 64; k++) { const a = a0 + (k / 64) * Math.PI * 2.16; const wob = 1 + Math.sin(a * 3 + R()) * 0.025; pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]); }
      lines.push(pts);
    } else if (m.kind === 'box') {
      const p = 7; lines.push([[x - p + j(3), y - p + j(3)], [x + w + p + j(3), y - p + j(3)], [x + w + p + j(3), y + h + p + j(3)], [x - p + j(3), y + h + p + j(3)], [x - p + j(3), y - p + 4]]);
    } else if (m.kind === 'underline') {
      const yy = y + h + 6; const pts = []; for (let k = 0; k <= 24; k++) pts.push([x - 2 + (w + 4) * k / 24, yy + Math.sin(k * 0.9) * 1.6 + j(1)]); lines.push(pts);
    } else if (m.kind === 'cross') {
      lines.push([[x - 4 + j(4), y - 4 + j(4)], [x + w + 4 + j(4), y + h + 4 + j(4)]]); lines.push([[x + w + 4 + j(4), y - 4 + j(4)], [x - 4 + j(4), y + h + 4 + j(4)]]);
    } else if (m.kind === 'check') {
      const s = Math.max(22, Math.min(48, h * 0.9)); const bx = x + w + 10, by = y + h / 2;
      lines.push([[bx, by], [bx + s * 0.35, by + s * 0.38], [bx + s, by - s * 0.55]]);
    } else if (m.kind === 'arrow') {
      const tx = x + w + 6, ty = y + h / 2; const fx = tx + 80 + Math.min(60, w * 0.2), fy = y - 34; const mx = (fx + tx) / 2 + 10, my = Math.min(fy, ty) - 8; const pts = [];
      for (let k = 0; k <= 20; k++) { const t = k / 20; pts.push([(1 - t) * (1 - t) * fx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * my + t * t * ty]); }
      lines.push(pts); const a = Math.atan2(ty - pts[18][1], tx - pts[18][0]); const hs = 13;
      lines.push([[tx - hs * Math.cos(a - 0.5), ty - hs * Math.sin(a - 0.5)], [tx, ty], [tx - hs * Math.cos(a + 0.5), ty - hs * Math.sin(a + 0.5)]]);
      if (m.v) text = { x: fx + 6, y: fy - 4, size: Math.max(20, Math.min(28, big)), align: 'left' };
    }
    if (m.v && !text) {
      if (m.tp) text = { x: m.tp[0], y: m.tp[1], size: big, align: 'left' };   // where it was put when he wrote it
      else {
        // beside it, above, below or to the left: wherever it covers the least of your writing (avoid: its boxes)
        const tw = String(m.v).length * big * 0.56, gap = m.kind === 'check' ? Math.max(22, Math.min(48, h * 0.9)) + 20 : m.kind === 'note' ? 10 : 22;
        const spots = [[x + w + gap, y + h / 2 + big * 0.35], [x + w / 2 - tw / 2, y - 16], [x + w / 2 - tw / 2, y + h + big + 14], [x - gap - tw, y + h / 2 + big * 0.35], [x + w + gap, y - 10], [x + w + gap, y + h + big + 6]];
        const cost = ([tx, ty]) => (avoid || []).reduce((s, b) => s + Math.max(0, Math.min(tx + tw, b[0] + b[2]) - Math.max(tx, b[0])) * Math.max(0, Math.min(ty + 6, b[1] + b[3]) - Math.max(ty - big, b[1])), 0);
        let best = spots[0], bc = cost(spots[0]); spots.slice(1).forEach(sp => { const c = cost(sp); if (c < bc - 1) { best = sp; bc = c; } });
        text = { x: best[0], y: best[1], size: big, align: 'left' }; m.tp = [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10];
      }
    }
    const len = lines.reduce((a, l) => a + l.reduce((s, p, k) => k ? s + Math.hypot(p[0] - l[k - 1][0], p[1] - l[k - 1][1]) : 0, 0), 0);
    return { lines, text, len };
  }

  function create(host, o = {}) {
    const P = { items: [], marks: [], undo: [], redo: [], tool: 'pen', color: 'ink', size: 'm', tx: 0, ty: 0, k: 1, look: null, rev: 0, lookRev: -1, pen: false, dark: !!o.dark, anim: [], moved: 0, cards: new Set(), z: 10 };
    const root = document.createElement('div'); root.className = 'wb' + (P.dark ? ' dark' : ''); root.dataset.tool = 'pen';
    root.innerHTML = `<canvas class="wb-ink" aria-hidden="true"></canvas><div class="wb-world"></div>
      <div class="wb-tools" role="toolbar" aria-label="Board">
        <button type="button" class="wb-b" data-wb="hand" aria-pressed="false" title="Move the board (two fingers work too)">${icon('hand', 19)}<span>Move</span></button>
        <button type="button" class="wb-b" data-wb="pen" aria-pressed="true" title="Pen (P)">${icon('pen', 19)}<span>Pen</span></button>
        <button type="button" class="wb-b" data-wb="hl" aria-pressed="false" title="Highlighter (H)">${icon('marker', 19)}<span>Highlight</span></button>
        <button type="button" class="wb-b" data-wb="eraser" aria-pressed="false" title="Eraser (E)">${icon('eraser', 19)}<span>Erase</span></button>
        <button type="button" class="wb-b" data-wb="text" aria-pressed="false" title="Type on the board (T)">${icon('text', 19)}<span>Text</span></button>
        <i class="wb-sep" aria-hidden="true"></i>
        <button type="button" class="wb-b wb-col" data-wb="colors" aria-expanded="false" aria-haspopup="true" title="Colour and size"><i class="wb-dot" aria-hidden="true"></i><span>Colour</span></button>
        <i class="wb-sep" aria-hidden="true"></i>
        <button type="button" class="wb-b" data-wb="undo" title="Undo (Ctrl Z)" disabled>${icon('undo', 19)}<span>Undo</span></button>
        <button type="button" class="wb-b" data-wb="redo" title="Redo (Ctrl Shift Z)" disabled>${icon('redo', 19)}<span>Redo</span></button>
        <button type="button" class="wb-b" data-wb="fit" title="Show everything">${icon('fit', 19)}<span>Fit</span></button>
        <button type="button" class="wb-b" data-wb="clear" title="Clear your writing">${icon('trash', 19)}<span>Clear</span></button>
      </div>
      <div class="wb-pop" role="dialog" aria-label="Colour and size" hidden>
        <div class="wb-swatches" role="radiogroup" aria-label="Colour">${Object.keys(INK).map(c => `<button type="button" role="radio" class="wb-sw" data-wb-c="${c}" aria-checked="${c === 'ink'}" aria-label="${{ ink: 'Black', blue: 'Blue', red: 'Red', green: 'Green', purple: 'Purple' }[c]}" style="--sw:${INK[c][0]};--sw-d:${INK[c][1]}"></button>`).join('')}</div>
        <div class="wb-sizes" role="radiogroup" aria-label="Size">${Object.keys(SIZES).map(s => `<button type="button" role="radio" class="wb-sz" data-wb-s="${s}" aria-checked="${s === 'm'}" aria-label="${{ s: 'Thin', m: 'Medium', l: 'Thick' }[s]}"><i style="--d:${SIZES[s] * 2 + 2}px"></i></button>`).join('')}</div>
      </div>`;
    host.appendChild(root);
    const cv = $('.wb-ink', root), ctx = cv.getContext('2d'), worldEl = $('.wb-world', root), tools = $('.wb-tools', root), pop = $('.wb-pop', root);
    let W = 0, H = 0, dpr = 1, raf = 0;
    const insets = () => Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, typeof o.insets === 'function' ? o.insets() : o.insets || {});
    const ink = c => (INK[c] || INK.ink)[P.dark ? 1 : 0];
    const toWorld = (sx, sy) => [(sx - P.tx) / P.k, (sy - P.ty) / P.k];
    const local = e => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    /* ---------- drawing it ---------- */
    function size() { const r = root.getBoundingClientRect(); dpr = Math.min(2.5, global.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; draw(); }
    const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    function strokePath(c, it) {
      const p = it.p, n = p.length / 3; if (!n) return;
      if (n === 1) { c.beginPath(); c.arc(p[0], p[1], it.w * (it.hl ? 0.5 : 0.62), 0, Math.PI * 2); c.fillStyle = c.strokeStyle; c.fill(); return; }
      const pressure = !it.hl && it.pr;
      if (!pressure) {
        c.lineWidth = it.w; c.beginPath(); c.moveTo(p[0], p[1]);
        for (let i = 1; i < n - 1; i++) { const mx = (p[i * 3] + p[i * 3 + 3]) / 2, my = (p[i * 3 + 1] + p[i * 3 + 4]) / 2; c.quadraticCurveTo(p[i * 3], p[i * 3 + 1], mx, my); }
        c.lineTo(p[(n - 1) * 3], p[(n - 1) * 3 + 1]); c.stroke(); return;
      }
      // a stylus: each piece as wide as it was pressed
      let px = p[0], py = p[1];
      for (let i = 1; i < n; i++) {
        const mx = i < n - 1 ? (p[i * 3] + p[i * 3 + 3]) / 2 : p[i * 3], my = i < n - 1 ? (p[i * 3 + 1] + p[i * 3 + 4]) / 2 : p[i * 3 + 1];
        c.lineWidth = it.w * (0.45 + 0.9 * ((p[i * 3 + 2] + p[i * 3 - 1]) / 200)); c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(p[i * 3], p[i * 3 + 1], mx, my); c.stroke(); px = mx; py = my;
      }
    }
    const textLines = it => String(it.v).split('\n').map(l => pretty(l));
    function drawItem(c, it) {
      if (it.t === 's') { c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; if (it.hl) { c.globalAlpha = P.dark ? 0.42 : 0.5; c.globalCompositeOperation = P.dark ? 'screen' : 'multiply'; c.strokeStyle = HL[it.c] || HL.ink; } else c.strokeStyle = ink(it.c); strokePath(c, it); c.restore(); }
      else if (it.t === 'x') { c.save(); c.fillStyle = ink(it.c); c.font = `600 ${it.s}px ${font()}`; c.textBaseline = 'top'; textLines(it).forEach((l, k) => c.fillText(l, it.x, it.y + k * it.s * 1.25)); c.restore(); }
      else if (it.t === 'i') { if (!it.img) { it.img = new Image(); it.img.onload = later; it.img.src = it.src; } if (it.img.complete && it.img.naturalWidth) { c.save(); c.shadowColor = 'rgba(13,22,38,.18)'; c.shadowBlur = 12; c.drawImage(it.img, it.x, it.y, it.w, it.h); c.restore(); } }
    }
    function drawMark(c, m, prog) {
      const S = m.S || (m.S = markShape(m)); const col = (BO[m.c] || BO[m.kind === 'check' ? 'green' : m.kind === 'cross' ? 'red' : 'mark'])[P.dark ? 1 : 0];
      c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round';
      let left = S.len * Math.min(1, prog / 0.75);
      for (const l of S.lines) {
        if (left <= 0) break; c.beginPath(); c.moveTo(l[0][0], l[0][1]);
        for (let k = 1; k < l.length; k++) { const d = Math.hypot(l[k][0] - l[k - 1][0], l[k][1] - l[k - 1][1]); if (d >= left) { const t = left / d; c.lineTo(l[k - 1][0] + (l[k][0] - l[k - 1][0]) * t, l[k - 1][1] + (l[k][1] - l[k - 1][1]) * t); left = 0; break; } c.lineTo(l[k][0], l[k][1]); left -= d; }
        c.stroke();
      }
      if (S.text && prog > 0.6) { c.globalAlpha = Math.min(1, (prog - 0.6) / 0.3); c.font = `italic 800 ${S.text.size}px ${font()}`; c.textAlign = S.text.align; c.lineWidth = 5; c.strokeStyle = P.dark ? '#13213A' : '#FFFFFF'; c.strokeText(pretty(m.v), S.text.x, S.text.y); c.fillText(pretty(m.v), S.text.x, S.text.y); }
      c.restore();
    }
    function scene(c, now) {
      P.items.forEach(it => drawItem(c, it));
      let more = false;
      P.marks.forEach(m => { let prog = 1; if (m.at) { prog = (now - m.at) / 900; if (prog < 1) more = true; else m.at = 0; } if (prog > 0) drawMark(c, m, Math.min(1, prog)); });
      return more;
    }
    function draw() {
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // dots every 32 units, as on squared paper
      const g = 32 * P.k; if (g >= 9) { ctx.fillStyle = P.dark ? 'rgba(241,245,250,.13)' : 'rgba(13,22,38,.14)'; const r = Math.max(0.8, Math.min(1.6, P.k * 1.1)); const ox = ((P.tx % g) + g) % g, oy = ((P.ty % g) + g) % g; ctx.beginPath(); for (let x = ox; x < W; x += g) for (let y = oy; y < H; y += g) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } ctx.fill(); }
      ctx.setTransform(dpr * P.k, 0, 0, dpr * P.k, dpr * P.tx, dpr * P.ty);
      const more = scene(ctx, now);
      if (cur) drawItem(ctx, cur);
      worldEl.style.transform = `translate(${P.tx}px, ${P.ty}px) scale(${P.k})`;
      if (more) later();
    }

    /* ---------- what is where ---------- */
    function bbox(it) {
      if (it.bb) return it.bb;
      if (it.t === 's') { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < it.p.length; i += 3) { x0 = Math.min(x0, it.p[i]); x1 = Math.max(x1, it.p[i]); y0 = Math.min(y0, it.p[i + 1]); y1 = Math.max(y1, it.p[i + 1]); } const h = it.w / 2; return (it.bb = [x0 - h, y0 - h, x1 - x0 + it.w, y1 - y0 + it.w]); }
      if (it.t === 'x') { ctx.save(); ctx.font = `600 ${it.s}px ${font()}`; const ls = textLines(it); const w = Math.max(...ls.map(l => ctx.measureText(l).width)); ctx.restore(); return (it.bb = [it.x, it.y, Math.max(8, w), ls.length * it.s * 1.25]); }
      if (it.t === 'i') return [it.x, it.y, it.w, it.h];
      return [0, 0, 0, 0];
    }
    const markBox = m => { const S = m.S || (m.S = markShape(m)); let x0 = m.r[0] - 12, y0 = m.r[1] - 12, x1 = m.r[0] + m.r[2] + 12, y1 = m.r[1] + m.r[3] + 12; S.lines.forEach(l => l.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); })); if (S.text) { const w = String(m.v).length * S.text.size * 0.55; const tx = S.text.align === 'center' ? S.text.x - w / 2 : S.text.x; x0 = Math.min(x0, tx); x1 = Math.max(x1, tx + w); y0 = Math.min(y0, S.text.y - S.text.size); y1 = Math.max(y1, S.text.y + 6); } return [x0, y0, x1 - x0, y1 - y0]; };
    const cardBox = el => [parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0, el.offsetWidth, el.offsetHeight];
    const union = bs => { if (!bs.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; bs.forEach(b => { x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); }); return [x0, y0, x1 - x0, y1 - y0]; };
    const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const visibleCards = () => [...P.cards].filter(el => el.isConnected && !el.hidden);
    // the part of the board you can see, in board units (the call's bars and buttons cover the edges)
    // (where the board is going, while it glides there)
    function seen() { const I = insets(); const v = P.goal || P; const at = (sx, sy) => [(sx - v.tx) / v.k, (sy - v.ty) / v.k]; const [x0, y0] = at(I.left, I.top), [x1, y1] = at(W - I.right, H - I.bottom); return [x0, y0, Math.max(40, x1 - x0), Math.max(40, y1 - y0)]; }

    /* ---------- moving around ---------- */
    let glide = 0;
    function setView(tx, ty, k, smooth) {
      cancelAnimationFrame(glide); k = Math.max(0.2, Math.min(4, k));
      if (!smooth || still()) { P.goal = null; P.tx = tx; P.ty = ty; P.k = k; draw(); save(); return; }
      const a = { tx: P.tx, ty: P.ty, k: P.k }, t0 = performance.now(), D = 380; P.goal = { tx, ty, k };
      const step = now => { const t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3); P.tx = a.tx + (tx - a.tx) * e; P.ty = a.ty + (ty - a.ty) * e; P.k = a.k + (k - a.k) * e; draw(); if (t < 1) glide = requestAnimationFrame(step); else { P.goal = null; save(); } };
      glide = requestAnimationFrame(step);
    }
    function zoomAt(sx, sy, k) { k = Math.max(0.2, Math.min(4, k)); const [wx, wy] = toWorld(sx, sy); setView(sx - wx * k, sy - wy * k, k); }
    // show a part of the board (board units): a card Bo just put up, or everything (Fit)
    function show(b, o2 = {}) {
      const I = insets(); const aw = W - I.left - I.right, ah = H - I.top - I.bottom; if (aw < 50 || ah < 50 || !b) return;
      let k = o2.zoom ? Math.max(0.3, Math.min(1.4, Math.min((aw - 40) / b[2], (ah - 40) / b[3]))) : P.k;
      if (!o2.zoom) { const v = seen(); const hid = 1 - overlap(b, v) / Math.max(1, b[2] * b[3]); if (hid <= (o2.hidden != null ? o2.hidden : 0.001)) return; }
      const cx = b[0] + b[2] / 2, top = b[3] * k > ah - 40 ? b[1] - 20 / k : null;
      const tx = I.left + aw / 2 - cx * k, ty = top != null ? I.top - top * k : I.top + ah / 2 - (b[1] + b[3] / 2) * k;
      setView(tx, ty, k, true);
    }
    function fit() { const all = union(P.items.map(bbox).concat(P.marks.map(markBox), visibleCards().map(cardBox))); if (all) show(all, { zoom: true }); else setView(0, 0, 1, true); }

    /* ---------- you write ---------- */
    let cur = null, ptrs = new Map(), gesture = null, erased = null, dragCard = null;
    const record = (op, bo) => { P.undo.push(op); if (P.undo.length > 200) P.undo.shift(); P.redo = []; changed(bo); emit(op); };
    // bo: Bo's own marks, which do not count as you writing (no quiet look at the board for them)
    function changed(bo) { P.rev++; paintTools(); save(); if (o.onChange) o.onChange(); if (bo) return; clearTimeout(P.idleT); if (o.onIdle) P.idleT = setTimeout(() => o.onIdle(P.rev), o.idleMs || 2200); }
    function begin(e, x, y) {
      const [wx, wy] = toWorld(x, y); const pen = e.pointerType === 'pen';
      cur = { t: 's', id: newId(), c: P.color, w: (P.tool === 'hl' ? 18 : SIZES[P.size]) / P.k, hl: P.tool === 'hl', pr: pen && P.tool !== 'hl', p: [r2(wx), r2(wy), pen ? Math.round((e.pressure || 0.5) * 100) : 50], t0: Date.now() };
    }
    const r2 = v => Math.round(v * 10) / 10;
    function extend(e, x, y) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; const r = root.getBoundingClientRect();
      (evs.length ? evs : [e]).forEach(ev => {
        const [wx, wy] = toWorld(ev.clientX - r.left, ev.clientY - r.top); const p = cur.p; const n = p.length;
        if (Math.hypot(wx - p[n - 3], wy - p[n - 2]) * P.k < 1.2) return;
        p.push(r2(wx), r2(wy), cur.pr ? Math.round((ev.pressure || 0.5) * 100) : 50);
      });
      later();
    }
    function finish() { if (!cur) return; const it = cur; cur = null; delete it.t0; if (it.p.length >= 3) { P.items.push(it); record({ a: 'add', its: [it] }); } later(); }
    function eraseAt(x, y) {
      const [wx, wy] = toWorld(x, y); const r = 12 / P.k; const hit = [];
      P.items.forEach(it => {
        if (it.t === 'i') return; const b = bbox(it); if (wx < b[0] - r || wx > b[0] + b[2] + r || wy < b[1] - r || wy > b[1] + b[3] + r) return;
        if (it.t === 'x') { hit.push(it); return; }
        for (let i = 0; i < it.p.length; i += 3) { const ax = it.p[i], ay = it.p[i + 1], bx = it.p[i + 3] ?? ax, by = it.p[i + 4] ?? ay; const dx = bx - ax, dy = by - ay; const t = dx || dy ? Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy))) : 0; if (Math.hypot(wx - ax - t * dx, wy - ay - t * dy) <= r + it.w / 2) { hit.push(it); break; } }
      });
      P.marks.forEach(m => { const b = markBox(m); if (wx >= b[0] && wx <= b[0] + b[2] && wy >= b[1] && wy <= b[1] + b[3]) hit.push(m); });
      if (!hit.length) return;
      hit.forEach(it => { if (it.t === 'm') P.marks.splice(P.marks.indexOf(it), 1); else P.items.splice(P.items.indexOf(it), 1); erased.push(it); });
      later();
    }
    function typeAt(x, y) {
      const [wx, wy] = toWorld(x, y); const s = 26;
      const box = document.createElement('div'); box.className = 'wb-tin';
      box.innerHTML = `<label class="sr-only" for="wb-tin">Type on the board</label><textarea id="wb-tin" rows="1" maxlength="300" spellcheck="false" autocapitalize="off" placeholder="Type, then Enter"></textarea>`;
      box.style.left = x + 'px'; box.style.top = (y - 6) + 'px'; root.appendChild(box);
      const ta = $('textarea', box); ta.style.fontSize = (s * P.k) + 'px'; ta.style.color = ink(P.color);
      const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; ta.style.width = 'auto'; ta.style.width = Math.max(120, Math.min(W - x - 16, ta.scrollWidth + 24)) + 'px'; };
      let done = false; const commit = keep => { if (done) return; done = true; const v = ta.value.replace(/\s+$/, ''); box.remove(); if (keep && v.trim()) { const it = { t: 'x', id: newId(), c: P.color, x: r2(wx), y: r2(wy), s, v: v.slice(0, 300) }; P.items.push(it); record({ a: 'add', its: [it] }); later(); } };
      ta.addEventListener('input', grow); ta.addEventListener('blur', () => commit(true));
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(false); } });
      setTimeout(() => { ta.focus(); grow(); }, 0);
    }
    const onUi = t => t.closest('.wb-tools, .wb-pop, .wb-tin, .wb-card :is(button, input, select, textarea, a, label, .bd-live, .bb-chk-o, form)');
    root.addEventListener('pointerdown', e => {
      if (onUi(e.target) || (e.pointerType === 'mouse' && e.button > 1)) return;
      if (!pop.hidden && !e.target.closest('.wb-pop')) togglePop(false);
      const [x, y] = local(e); const card = e.target.closest('.wb-card');
      if (card) {   // a card: dragged by its bar, raised when touched
        card.style.zIndex = ++P.z;
        if (!e.target.closest('.bb-bar')) return;
        dragCard = { el: card, id: e.pointerId, x, y, l: parseFloat(card.style.left) || 0, t: parseFloat(card.style.top) || 0 }; card.classList.add('dragging'); try { root.setPointerCapture(e.pointerId); } catch (x2) {} e.preventDefault(); return;
      }
      if (e.target !== cv && e.target !== root && e.target !== worldEl) return;
      e.preventDefault(); try { root.setPointerCapture(e.pointerId); } catch (x2) {}
      if (e.pointerType === 'pen') P.pen = true;
      ptrs.set(e.pointerId, { x, y, type: e.pointerType });
      const touches = [...ptrs.values()].filter(p => p.type === 'touch');
      if (touches.length >= 2) {   // two fingers: move and zoom; a stroke just begun is taken back
        if (cur && (Date.now() - cur.t0 < 300 || cur.p.length < 30)) cur = null; else finish();
        const [a, b] = touches; gesture = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; later(); return;
      }
      const panning = P.tool === 'hand' || e.button === 1 || (e.pointerType === 'touch' && P.pen);
      if (panning) { gesture = { pan: true, x, y }; root.classList.add('panning'); return; }
      if (P.tool === 'pen' || P.tool === 'hl') { begin(e, x, y); later(); }
      else if (P.tool === 'eraser') { erased = []; eraseAt(x, y); }
      else if (P.tool === 'text') gesture = { tap: true, x, y };
    });
    root.addEventListener('pointermove', e => {
      const [x, y] = local(e);
      if (dragCard && e.pointerId === dragCard.id) { dragCard.el.style.left = (dragCard.l + (x - dragCard.x) / P.k) + 'px'; dragCard.el.style.top = (dragCard.t + (y - dragCard.y) / P.k) + 'px'; return; }
      const p = ptrs.get(e.pointerId); if (!p) return; p.x = x; p.y = y;
      if (gesture && gesture.d != null) {
        const touches = [...ptrs.values()].filter(q => q.type === 'touch'); if (touches.length < 2) return; const [a, b] = touches;
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const k = Math.max(0.2, Math.min(4, P.k * d / (gesture.d || d))); const [wx, wy] = toWorld(gesture.mx, gesture.my);
        P.tx = mx - wx * k; P.ty = my - wy * k; P.k = k; gesture.d = d; gesture.mx = mx; gesture.my = my; P.moved = Date.now(); later(); return;
      }
      if (gesture && gesture.pan) { if (P.goal) { cancelAnimationFrame(glide); P.goal = null; } P.tx += x - gesture.x; P.ty += y - gesture.y; gesture.x = x; gesture.y = y; P.moved = Date.now(); later(); return; }
      if (cur) extend(e, x, y); else if (erased) eraseAt(x, y);
    });
    const up = e => {
      if (dragCard && e.pointerId === dragCard.id) { dragCard.el.classList.remove('dragging'); dragCard = null; return; }
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      if (gesture && gesture.tap && e.type === 'pointerup') { const [x, y] = local(e); if (Math.hypot(x - gesture.x, y - gesture.y) < 10) typeAt(x, y); }
      if (gesture) { if (!ptrs.size || gesture.d != null) { gesture = null; root.classList.remove('panning'); save(); } if (P.later && !ptrs.size) { const el = P.later; P.later = null; setTimeout(() => reveal(el, true), 250); } return; }
      if (cur) finish();
      if (erased) { if (erased.length) record({ a: 'del', its: erased }); erased = null; }
      if (P.later && !ptrs.size) { const el = P.later; P.later = null; setTimeout(() => reveal(el, true), 250); }
    };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    // the wheel moves the board; Ctrl + wheel (and a trackpad pinch) zooms it
    root.addEventListener('wheel', e => {
      if (e.defaultPrevented || e.target.closest('.wb-tools, .wb-pop')) return;   // a graph you clicked zooms itself
      e.preventDefault(); const [x, y] = local(e); const d = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.ctrlKey || e.metaKey) zoomAt(x, y, P.k * Math.exp(-e.deltaY * d * 0.01)); else { P.tx -= e.deltaX * d; P.ty -= e.deltaY * d; P.moved = Date.now(); later(); clearTimeout(P.saveT2); P.saveT2 = setTimeout(save, 400); }
    }, { passive: false });

    /* ---------- the tools ---------- */
    function setTool(t) { P.tool = t; root.dataset.tool = t; $$('[data-wb]', tools).forEach(b => { if (['hand', 'pen', 'hl', 'eraser', 'text'].includes(b.dataset.wb)) b.setAttribute('aria-pressed', String(b.dataset.wb === t)); }); }
    function paintTools() {
      $('[data-wb="undo"]', tools).disabled = !P.undo.length; $('[data-wb="redo"]', tools).disabled = !P.redo.length; $('[data-wb="clear"]', tools).disabled = !P.items.length && !P.marks.length;
      root.style.setProperty('--wb-c', ink(P.color));
      $$('.wb-sw', pop).forEach(b => b.setAttribute('aria-checked', String(b.dataset.wbC === P.color))); $$('.wb-sz', pop).forEach(b => b.setAttribute('aria-checked', String(b.dataset.wbS === P.size)));
    }
    // the colours beside the button: to its right when the tools stand in a column, above or below it when they lie in a row
    function togglePop(on) {
      const b = $('[data-wb="colors"]', tools); const show = on === undefined ? pop.hidden : on; pop.hidden = !show; b.setAttribute('aria-expanded', String(show)); if (!show) return;
      const r = b.getBoundingClientRect(), rr = root.getBoundingClientRect(), tr = tools.getBoundingClientRect(); pop.style.top = ''; pop.style.bottom = '';
      if (tr.height > tr.width) { pop.style.left = (tr.right - rr.left + 10) + 'px'; pop.style.top = Math.max(8, Math.min(H - pop.offsetHeight - 8, r.top - rr.top + r.height / 2 - pop.offsetHeight / 2)) + 'px'; return; }
      pop.style.left = Math.max(8, Math.min(W - 236, r.left - rr.left - 90)) + 'px';
      if (r.top - rr.top > H / 2) pop.style.bottom = (rr.bottom - tr.top + 8) + 'px'; else pop.style.top = (tr.bottom - rr.top + 8) + 'px';
    }
    function undo() { const op = P.undo.pop(); if (!op) return; apply(op, true); P.redo.push(op); P.rev++; paintTools(); later(); save(); if (o.onChange) o.onChange(); emit({ a: op.a === 'add' ? 'del' : 'add', its: op.its }); }
    function redo() { const op = P.redo.pop(); if (!op) return; apply(op, false); P.undo.push(op); P.rev++; paintTools(); later(); save(); if (o.onChange) o.onChange(); emit(op); }
    function apply(op, back) {
      const add = its => its.forEach(it => { if (it.t === 'm') P.marks.push(it); else P.items.push(it); }), del = its => its.forEach(it => { const L = it.t === 'm' ? P.marks : P.items; const i = L.indexOf(it); if (i >= 0) L.splice(i, 1); });
      if (op.a === 'add') (back ? del : add)(op.its); else (back ? add : del)(op.its);
    }
    function clear() { const its = P.items.concat(P.marks); if (!its.length) return; P.items = []; P.marks = []; record({ a: 'clear', its }); later(); if (toast) toast('Board cleared. Undo brings it back.', 2600); }
    tools.addEventListener('click', e => {
      const b = e.target.closest('[data-wb]'); if (!b || b.disabled) return; const k = b.dataset.wb;
      if (['hand', 'pen', 'hl', 'eraser', 'text'].includes(k)) { setTool(k); togglePop(false); }
      else if (k === 'colors') togglePop(); else if (k === 'undo') undo(); else if (k === 'redo') redo(); else if (k === 'fit') fit(); else if (k === 'clear') clear();
    });
    pop.addEventListener('click', e => {
      const c = e.target.closest('[data-wb-c]'), s = e.target.closest('[data-wb-s]');
      if (c) { P.color = c.dataset.wbC; if (!['pen', 'hl', 'text'].includes(P.tool)) setTool('pen'); } if (s) { P.size = s.dataset.wbS; if (!['pen', 'hl'].includes(P.tool)) setTool('pen'); }
      paintTools(); if (c || s) save();
    });
    // keys: P, H, E, T, V for the tools; Ctrl Z, Ctrl Shift Z (and Ctrl Y) undo and redo; not while typing
    function keys(e) {
      if (!root.isConnected || root.offsetParent === null) return; const t = e.target;
      if (t.closest && t.closest('input, textarea, select, [contenteditable="true"], .bd-live')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'y')) { e.preventDefault(); e.stopPropagation(); if (k === 'y' || e.shiftKey) redo(); else undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map = { p: 'pen', h: 'hl', e: 'eraser', t: 'text', v: 'hand' }; if (map[k]) { setTool(map[k]); e.stopPropagation(); }
      if (e.key === 'Escape' && !pop.hidden) { togglePop(false); e.preventDefault(); e.stopPropagation(); }
    }
    global.addEventListener('keydown', keys, true);

    /* ---------- shared with others (a study room, assets/room.js): each change as it happens, and the whole board ----------
       o.onOp(op) gets every change made here ({ a: 'add' | 'del', its }); remote(op) applies one made elsewhere (not
       to undo); snap() and loadSnap() are the whole board. Photos stay on the device that has them. */
    const q1 = v => Math.round(v * 10) / 10;
    const ser = it => it.t === 's' ? { t: 's', id: it.id, c: it.c, w: q1(it.w), hl: it.hl ? 1 : 0, pr: it.pr ? 1 : 0, p: it.p } : it.t === 'x' ? { t: 'x', id: it.id, c: it.c, x: it.x, y: it.y, s: it.s, v: it.v } : it.t === 'm' ? Object.assign({ t: 'm', id: it.id, kind: it.kind, r: it.r.map(q1), v: it.v, c: it.c }, it.tp ? { tp: it.tp } : {}) : null;
    const deser = it => !it || typeof it.id !== 'string' ? null : it.t === 's' && Array.isArray(it.p) && it.p.length >= 3 ? Object.assign({}, it, { hl: !!it.hl, pr: !!it.pr }) : it.t === 'x' && typeof it.v === 'string' ? Object.assign({}, it) : it.t === 'm' && KINDS.includes(it.kind) && Array.isArray(it.r) && it.r.length === 4 ? Object.assign({}, it, { at: 0 }) : null;
    function emit(op) { if (!o.onOp || P.remoteNow) return; const its = op.its.map(ser).filter(Boolean); if (its.length) o.onOp({ a: op.a === 'add' ? 'add' : 'del', its }); }
    function remote(op) {
      if (!op || !Array.isArray(op.its)) return; const ids = new Set(P.items.concat(P.marks).map(it => it.id));
      if (op.a === 'add') op.its.map(deser).filter(it => it && !ids.has(it.id)).forEach(it => (it.t === 'm' ? P.marks : P.items).push(it));
      else { const gone = new Set(op.its.map(it => it && it.id)); P.items = P.items.filter(it => !gone.has(it.id)); P.marks = P.marks.filter(it => !gone.has(it.id)); }
      P.remoteNow = true; try { changed(false); } finally { P.remoteNow = false; } later();
    }
    const snap = () => ({ items: P.items.map(ser).filter(Boolean), marks: P.marks.map(ser).filter(Boolean) });
    function loadSnap(d) { if (!d) return; P.items = (d.items || []).map(deser).filter(Boolean).concat(P.items.filter(it => it.t === 'i')); P.marks = (d.marks || []).map(deser).filter(Boolean); P.rev++; paintTools(); later(); }

    /* ---------- kept for the next call (your writing and Bo's marks; not photos) ---------- */
    function save() { if (!o.store) return; clearTimeout(P.saveT); P.saveT = setTimeout(store, 500); }
    function store() {
      P.saveT = 0; const q = v => Math.round(v * 10) / 10;
      const data = { v: 1, tx: q(P.tx), ty: q(P.ty), k: q(P.k * 100) / 100, color: P.color, size: P.size, items: P.items.filter(it => it.t !== 'i').map(it => it.t === 's' ? { t: 's', id: it.id, c: it.c, w: q(it.w), hl: it.hl ? 1 : 0, pr: it.pr ? 1 : 0, p: it.p } : { t: 'x', id: it.id, c: it.c, x: it.x, y: it.y, s: it.s, v: it.v }), marks: P.marks.map(m => Object.assign({ t: 'm', id: m.id, kind: m.kind, r: m.r.map(q), v: m.v, c: m.c }, m.tp ? { tp: m.tp } : {})) };
      let s = JSON.stringify(data); while (s.length > 600000 && data.items.length) { data.items.shift(); s = JSON.stringify(data); }   // the oldest strokes go first if it gets very big
      try { localStorage.setItem(o.store, s); } catch (e) {}
    }
    function load() {
      if (!o.store) return; let d = null; try { d = JSON.parse(localStorage.getItem(o.store) || 'null'); } catch (e) {}
      if (!d || d.v !== 1) return;
      P.items = (d.items || []).filter(it => it && (it.t === 's' ? Array.isArray(it.p) && it.p.length >= 3 : it.t === 'x' && typeof it.v === 'string')).map(it => Object.assign({}, it, { hl: !!it.hl, pr: !!it.pr }));
      P.marks = (d.marks || []).filter(m => m && KINDS.includes(m.kind) && Array.isArray(m.r) && m.r.length === 4).map(m => Object.assign({}, m, { at: 0 }));
      if (Number.isFinite(d.tx) && Number.isFinite(d.ty) && d.k > 0) { P.tx = d.tx; P.ty = d.ty; P.k = Math.max(0.2, Math.min(4, d.k)); }
      if (INK[d.color]) P.color = d.color; if (SIZES[d.size]) P.size = d.size;
    }

    /* ---------- Bo's pages on the board ---------- */
    /* a card (an element) goes up next to the work it is about (near: a place from his last look, "C3"), or in the
       free space you can see (right of your writing first), or past everything; then the board shows it */
    function addCard(el, near) {
      el.classList.add('wb-card'); el.style.zIndex = ++P.z; worldEl.appendChild(el); P.cards.add(el);
      const cw = el.offsetWidth || 380, ch = Math.max(el.offsetHeight, 280); let at = null;
      const R = near && P.look ? cells(near) : null;
      if (R) at = [R[0] + R[2] + 30, R[1]];
      if (!at) {
        const [vx, vy, vw, vh] = seen(); const taken = P.items.map(bbox).concat(P.marks.map(markBox)); const others = visibleCards().filter(c => c !== el).map(cardBox);
        let best = null; const x0 = vx + vw - cw - 16, x1 = vx + 16; const xs = []; for (let x = x0; x >= x1; x -= 32) xs.push(x); if (!xs.length) xs.push(vx + Math.max(0, (vw - cw) / 2));   // a narrow screen: the middle
        scan: for (let y = vy + 16; y <= vy + Math.max(16, vh - ch - 16); y += 32) for (const x of xs) {
          const b = [x, y, cw, ch]; const cost = taken.reduce((s, t) => s + overlap(b, t), 0) + others.reduce((s, t) => s + overlap(b, t) * 3, 0);
          if (!best || cost < best.cost - 1) best = { x, y, cost }; if (best.cost === 0) break scan;
        }
        if (best && best.cost < cw * ch * 0.04) at = [best.x, best.y];
        else { const all = union(taken.concat(others)) || [vx, vy, 0, 0]; at = [all[0] + all[2] + 48, Math.max(vy + 16, all[1])]; }
      }
      el.style.left = Math.round(at[0]) + 'px'; el.style.top = Math.round(at[1]) + 'px';
      reveal(el, true);
      return el;
    }
    // bring a card into view, unless you are writing or just moved the board yourself
    function reveal(el, now) {
      if (!el || !el.isConnected) return;
      if (cur || ptrs.size) { if (now) P.later = el; return; }   // never while you write: a new page waits for the stroke to end
      if (!now && Date.now() - P.moved < 5000) return; const b = cardBox(el); show([b[0], b[1], b[2], Math.min(b[3], 560)], { hidden: 0.12 });   // a sliver out of sight is fine
    }
    function removeCard(el) { P.cards.delete(el); el.remove(); }

    /* ---------- Bo looks at the board: a picture of it with a grid, so he can say where ---------- */
    function cells(ref) {
      const L = P.look; if (!L) return null; const m = /^\s*([a-l])\s*(\d{1,2})(?:\s*(?:[:\-–—]|to|through)\s*([a-l])\s*(\d{1,2}))?\s*$/i.exec(String(ref || '')); if (!m) return null;
      const c1 = COLS.indexOf(m[1].toUpperCase()), r1 = +m[2] - 1, c2 = m[3] ? COLS.indexOf(m[3].toUpperCase()) : c1, r2 = m[4] ? +m[4] - 1 : r1;
      if ([c1, c2].some(c => c < 0 || c >= L.cols) || [r1, r2].some(r => r < 0 || r >= L.rows)) return null;
      const a = Math.min(c1, c2), b = Math.max(c1, c2), u = Math.min(r1, r2), v = Math.max(r1, r2);
      return [L.x + a * L.c, L.y + u * L.c, (b - a + 1) * L.c, (v - u + 1) * L.c];
    }
    /* the picture: what is written (with his marks and his pages as boxes), cropped to it, at most 1280 px; with
       grid: true, a grid over it with A, B, C… and 1, 2, 3… in the margins, kept for his marks (P.look) */
    function look(o2 = {}) {
      const own = P.items.map(bbox).concat(P.marks.map(markBox)); const cardsB = visibleCards().map(el => ({ b: cardBox(el), title: ($('.bb-title', el) || {}).textContent || '' }));
      let r = union(own);   // cropped to your writing (his pages show as boxes where they are in it)
      if (!own.length) { if (!o2.empty) return null; r = seen(); }
      const pad = 28; r = [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
      if (r[2] < 420) { r[0] -= (420 - r[2]) / 2; r[2] = 420; } if (r[3] < 280) { r[1] -= (280 - r[3]) / 2; r[3] = 280; }
      const grid = o2.grid !== false; const n = Math.max(1, Math.min(12, o2.cells || 10)); let c = Math.max(r[2], r[3]) / n; let cols = 1, rows = 1;
      if (grid) { cols = Math.min(12, Math.ceil(r[2] / c)); rows = Math.min(12, Math.ceil(r[3] / c)); c = Math.max(r[2] / cols, r[3] / rows); r = [r[0] - (cols * c - r[2]) / 2, r[1] - (rows * c - r[3]) / 2, cols * c, rows * c]; }
      const long = Math.max(r[2], r[3]); const s = Math.min(2, (o2.max || 1280) / long); const m = grid ? 30 : 0;
      const can = document.createElement('canvas'); can.width = Math.round(r[2] * s + m * 2); can.height = Math.round(r[3] * s + m * 2); const g = can.getContext('2d');
      g.fillStyle = P.dark ? '#13213A' : '#FFFFFF'; g.fillRect(0, 0, can.width, can.height);
      g.setTransform(s, 0, 0, s, m - r[0] * s, m - r[1] * s);
      if (o2.cards !== false) cardsB.forEach(cd => { g.save(); g.fillStyle = P.dark ? 'rgba(255,255,255,.08)' : '#F1F4F9'; g.strokeStyle = P.dark ? 'rgba(255,255,255,.3)' : '#AEB8C8'; g.lineWidth = 2; g.beginPath(); if (g.roundRect) g.roundRect(cd.b[0], cd.b[1], cd.b[2], cd.b[3], 16); else g.rect(cd.b[0], cd.b[1], cd.b[2], cd.b[3]); g.fill(); g.stroke(); g.fillStyle = P.dark ? '#C9D4E5' : '#5B6B82'; g.font = `700 18px ${font()}`; g.fillText(`Bo’s page${cd.title ? ': ' + cd.title.slice(0, 40) : ''}`, cd.b[0] + 16, cd.b[1] + 32); g.restore(); });
      P.items.forEach(it => drawItem(g, it)); P.marks.forEach(mk => drawMark(g, mk, 1));
      if (grid) {
        g.setTransform(1, 0, 0, 1, 0, 0); const cs = c * s; g.strokeStyle = P.dark ? 'rgba(116,192,252,.38)' : 'rgba(24,100,171,.30)'; g.lineWidth = 1; g.beginPath();
        for (let k = 0; k <= cols; k++) { g.moveTo(m + k * cs + 0.5, m); g.lineTo(m + k * cs + 0.5, m + rows * cs); } for (let k = 0; k <= rows; k++) { g.moveTo(m, m + k * cs + 0.5); g.lineTo(m + cols * cs, m + k * cs + 0.5); } g.stroke();
        g.fillStyle = P.dark ? '#74C0FC' : '#1864AB'; g.font = `800 17px ${font()}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let k = 0; k < cols; k++) { g.fillText(COLS[k], m + (k + 0.5) * cs, m / 2); g.fillText(COLS[k], m + (k + 0.5) * cs, can.height - m / 2); }
        for (let k = 0; k < rows; k++) { g.fillText(String(k + 1), m / 2, m + (k + 0.5) * cs); g.fillText(String(k + 1), can.width - m / 2, m + (k + 0.5) * cs); }
        P.look = { x: r[0], y: r[1], c, cols, rows, rev: P.rev };
      }
      P.lookRev = P.rev;
      // small enough to send down a call's data channel: smaller and softer until it is under about 140 KB
      let url = can.toDataURL('image/jpeg', 0.84);
      for (const [k, qy] of [[0.8, 0.8], [0.64, 0.76], [0.5, 0.72]]) { if (url.length < 190000) break; const c2 = document.createElement('canvas'); c2.width = Math.round(can.width * k); c2.height = Math.round(can.height * k); c2.getContext('2d').drawImage(can, 0, 0, c2.width, c2.height); url = c2.toDataURL('image/jpeg', qy); }
      return { type: 'image/jpeg', data: url.split(',')[1] || '', preview: url, cols, rows, size: url.length };
    }
    const range = () => (P.look ? `columns A–${COLS[P.look.cols - 1]}, rows 1–${P.look.rows}` : '');
    /* his marks: [{at: "C3" or "B2:D3", kind, text, color}] → how many went up, and what could not */
    function mark(list) {
      if (!P.look) return { error: 'There is no picture of the board yet, so there is nothing to mark. Look at it first.' };
      const out = { marked: 0, bad: [] }; const its = [];
      (Array.isArray(list) ? list : [list]).slice(0, 8).forEach(x => {
        if (!x || typeof x !== 'object') return; const R = cells(x.at ?? x.cell ?? x.where ?? x.place);
        const kind = KINDS.includes(String(x.kind || x.type || '').toLowerCase()) ? String(x.kind || x.type).toLowerCase() : (x.text ? 'note' : 'circle');
        if (!R) { out.bad.push(String(x.at ?? '?').slice(0, 12)); return; }
        const v = String(x.text ?? x.note ?? x.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (kind === 'note' && !v) { out.bad.push(String(x.at)); return; }
        const m = { t: 'm', id: newId(), kind, r: R.map(z => Math.round(z * 10) / 10), v, c: BO[String(x.color || '').toLowerCase()] ? String(x.color).toLowerCase() : '', at: still() ? 0 : performance.now() + its.length * 350 };
        m.S = markShape(m, P.items.map(bbox).concat(its.map(markBox))); P.marks.push(m); its.push(m); out.marked++;
      });
      if (its.length) { record({ a: 'add', its }, true); later(); show(union(its.map(markBox)), { hidden: 0.4 }); }   // the board moves only if most of them are out of sight
      if (out.bad.length) out.error = `These places are not on the picture: ${out.bad.join(', ')}. Use ${range()}, like "C3" or "B2:D3".`;
      return out;
    }
    /* a photo on the board, so you can write next to it and Bo can mark it */
    function addImage(p) {
      const img = new Image(); img.onload = () => {
        const [vx, vy, vw, vh] = seen(); const k = Math.min(1, (vw * 0.6) / img.width, (vh * 0.7) / img.height); const w = img.width * k, h = img.height * k;
        const it = { t: 'i', id: newId(), x: r2(vx + 24), y: r2(vy + 24), w: r2(w), h: r2(h), src: p.preview, img };
        const all = union(P.items.map(bbox)); if (all && overlap([it.x, it.y, w, h], all) > 0) { it.x = r2(all[0] + all[2] + 40); it.y = r2(all[1]); }
        P.items.push(it); record({ a: 'add', its: [it] }); show([it.x, it.y, w, h]); later();
      }; img.src = p.preview;
    }

    load(); setTool('pen'); paintTools();
    const ro = global.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(root); else global.addEventListener('resize', size);
    size();
    if (!P.items.length && o.center !== false) { const I = insets(); P.tx = I.left + 24; P.ty = I.top + 24; draw(); }
    return {
      el: root, tools, addCard, removeCard, reveal, look, mark, cells, range, addImage, fit, undo, redo, clear, setTool, show, remote, snap, loadSnap,
      cards: () => visibleCards(), hasInk: () => P.items.length > 0, rev: () => P.rev, lookedAt: () => P.lookRev,
      state: () => ({ items: P.items.length, marks: P.marks.length, tool: P.tool, color: P.color, k: P.k, look: P.look && Object.assign({}, P.look) }),
      dark(on) { P.dark = !!on; root.classList.toggle('dark', P.dark); paintTools(); draw(); },
      destroy() { if (P.saveT) { clearTimeout(P.saveT); store(); } global.removeEventListener('keydown', keys, true); if (ro) ro.disconnect(); else global.removeEventListener('resize', size); cancelAnimationFrame(raf); cancelAnimationFrame(glide); clearTimeout(P.idleT); root.remove(); }
    };
  }

  /* ---------- "Write it out", in the chat: the board on the whole screen; its picture goes with your next question ---------- */
  function sketch(o = {}) {
    if ($('.wb-sheet')) return;
    const back = document.activeElement;
    const el = document.createElement('div'); el.className = 'wb-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wb-sheet-h');
    el.innerHTML = `<header class="wb-sheet-top"><h2 id="wb-sheet-h">${icon('pen', 18)} Write it out for Bo</h2><p>Your working, a problem, a sketch: Bo sees it with your question.</p><span class="wb-sheet-sp"></span><button type="button" class="btn ghost" data-ps="close">Cancel</button><button type="button" class="btn primary" data-ps="send">${icon('send', 16)} Add to my question</button></header><div class="wb-sheet-b"></div>`;
    document.body.appendChild(el); document.documentElement.classList.add('wb-lock');
    const pad = create($('.wb-sheet-b', el), { store: o.store, dark: o.dark, insets: () => (global.innerWidth > 760 ? { left: 76 } : { bottom: 70 }) });
    const done = () => { pad.destroy(); el.remove(); document.documentElement.classList.remove('wb-lock'); global.removeEventListener('keydown', esc1, true); if (back && back.focus) try { back.focus(); } catch (e) {} };
    const esc1 = e => { if (e.key === 'Escape' && !e.target.closest('.wb-tin')) { e.preventDefault(); e.stopPropagation(); done(); } };
    global.addEventListener('keydown', esc1, true);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-ps]'); if (!b) return;
      if (b.dataset.ps === 'close') return done();
      const p = pad.look({ grid: false, cards: false }); if (!p) { toast('Write something on the board first.'); return; }
      done(); if (o.onDone) o.onDone(p);
    });
    setTimeout(() => { const b = $('[data-wb="pen"]', el); if (b) b.focus(); }, 30);
    return pad;
  }

  App.boPad = { create, sketch };
})(window);
