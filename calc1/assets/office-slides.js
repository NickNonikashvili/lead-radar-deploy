/* ============================================================
   Mathub — Slides, the presentation editor (assets/office.js opens it; #/decks/<id>)
   A 16:9 slide (960 × 540 points, PowerPoint's own size) shown at whatever size fits, with the slides down the side.
   - Slides: six layouts, duplicate, delete, reorder (drag, or Alt+↑/↓), background colour, six themes for the deck.
   - On a slide: text boxes (bold, italic, underline, colour, size, font, alignment, bullets and numbering with five
     levels), pictures, rectangles, rounded boxes, ellipses, triangles, lines and arrows; move, resize (Shift keeps the
     shape), snap to the middle and edges, nudge with the arrow keys, bring to front or send to back, copy and paste.
   - Speaker notes under each slide; Present fills the screen (arrows, space, click; B for black; N for the notes).
   - Saves as PowerPoint (.pptx) or PDF by printing (one slide a page). Its own undo history (Ctrl+Z, Ctrl+Y);
     while a text box is being typed in, the browser's undo works inside it.
   The deck's shape is App.OOXML's (assets/office-pptx.js): { theme, slides: [{ id, bg, items, notes }] }.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, toast } = App;
  const O = () => App.OOXML; const KIT = () => App.Officekit;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const W = 960, H = 540;
  const STACK = { Calibri: "Calibri, Carlito, 'Segoe UI', Helvetica, Arial, sans-serif", Arial: "Arial, 'Liberation Sans', Helvetica, sans-serif", Georgia: "Georgia, 'DejaVu Serif', serif", 'Times New Roman': "'Times New Roman', 'Liberation Serif', Times, serif", 'Courier New': "'Courier New', 'Liberation Mono', monospace", Verdana: "Verdana, 'DejaVu Sans', sans-serif" };
  const stack = f => STACK[f] || (f ? `'${String(f).replace(/'/g, '')}', sans-serif` : STACK.Calibri);
  const LAYOUTS = [['title', 'Title slide'], ['content', 'Title and content'], ['two', 'Two columns'], ['section', 'Section header'], ['only', 'Title only'], ['blank', 'Blank']];
  const SHAPES = [['rect', 'Rectangle'], ['round', 'Rounded rectangle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['line', 'Line'], ['arrow', 'Arrow']];
  const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 80];
  const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = d => ({ theme: d.theme, slides: d.slides.map(s => Object.assign({}, s, { items: s.items.map(i => Object.assign({}, i)) })) });   // the strings (pictures) are shared, not copied
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const K = s => (isMac ? s.replace('Ctrl', '⌘').replace('Alt', '⌥') : s).replace(/\b(Ctrl|Shift|Alt|Enter|Tab|Del|Backspace)\b/g, k => t(k));   // a shortcut as this keyboard writes it: ⌘ on a Mac, Strg in German

  /* ---------- drawing an item (on the stage, in the thumbnails, in the show and in print) ---------- */
  function themeColor(T, it) { return it.color || (it.role === 'title' ? T.title : it.role === 'subtitle' ? T.muted : T.fg); }
  function itemHtml(it, T, live) {
    const box = `left:${it.x}pt;top:${it.y}pt;width:${it.w}pt;height:${it.h}pt;`;
    const data = live ? ` data-id="${esc(it.id)}"` : '';
    if (it.type === 'image') return `<img class="sl-it sl-img"${data} src="${esc(it.src)}" alt="${esc(it.alt || '')}" style="${box}" draggable="false">`;
    if (it.type === 'line') {
      const x = Math.min(it.x1, it.x2), y = Math.min(it.y1, it.y2), w = Math.max(1, Math.abs(it.x2 - it.x1)), h = Math.max(1, Math.abs(it.y2 - it.y1)); const pad = 12;
      const mk = it.arrow ? `<defs><marker id="ah-${esc(it.id)}${live ? '' : '-s'}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${esc(it.color || T.fg)}"/></marker></defs>` : '';
      return `<svg class="sl-it sl-line"${data} style="left:${x - pad}pt;top:${y - pad}pt;width:${w + 2 * pad}pt;height:${h + 2 * pad}pt" viewBox="${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}" aria-hidden="true">${mk}<line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="transparent" stroke-width="14" class="sl-hit"/><line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="${esc(it.color || T.fg)}" stroke-width="${+it.lineW || 2}" stroke-linecap="round"${it.arrow ? ` marker-end="url(#ah-${esc(it.id)}${live ? '' : '-s'})"` : ''}/></svg>`;
    }
    const size = +it.size || O().ROLE_SIZE[it.role] || 20;
    if (it.type === 'shape') {
      const fill = it.fill === 'none' ? 'none' : (it.fill || T.accent), line = it.line && it.line !== 'none' ? it.line : 'none', lw = +it.lineW || 2;
      const m = Math.max(1, Math.min(it.w, it.h)) / 6;   // PowerPoint's rounded rectangle: corners a sixth of the shorter side
      const g = it.shape === 'ellipse' ? '<ellipse cx="50" cy="50" rx="50" ry="50"/>' : it.shape === 'triangle' ? '<path d="M50 0L100 100H0z"/>' : it.shape === 'round' ? `<rect width="100" height="100" rx="${(m / Math.max(1, it.w) * 100).toFixed(2)}" ry="${(m / Math.max(1, it.h) * 100).toFixed(2)}"/>` : '<rect width="100" height="100"/>';
      return `<div class="sl-it sl-shape"${data} style="${box}"><svg class="sl-geom" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="${esc(fill)}" stroke="${esc(line)}" stroke-width="${(lw * 4 / 3).toFixed(2)}">${g.replace('/>', ' vector-effect="non-scaling-stroke"/>')}</g></svg><div class="sl-tx sl-mid" style="font-size:${size}pt;color:${esc(it.color || '#ffffff')};font-family:${esc(stack(T.font))}">${it.html || ''}</div></div>`;
    }
    const font = it.font || (it.role === 'title' ? T.titleFont : T.font);
    return `<div class="sl-it sl-text${it.role ? ' r-' + esc(it.role) : ''}"${data} style="${box}${it.fill ? `background:${esc(it.fill)};` : ''}"><div class="sl-tx v-${esc(it.valign || 'top')}" style="font-size:${size}pt;color:${esc(themeColor(T, it))};font-family:${esc(stack(font))}">${it.html || ''}</div></div>`;
  }
  const slideHtml = (s, T, live) => `<div class="sl-bg" style="background:${esc(s.bg || T.bg)}"></div>${s.items.map(it => itemHtml(it, T, live)).join('')}`;
  App.OfficeSlides = { itemHtml, slideHtml };

  function mount(host, ctx, body) {
    const D = { theme: O().THEMES[body.theme] ? body.theme : 'paper', slides: Array.isArray(body.slides) && body.slides.length ? body.slides.map(s => ({ id: s.id || uid(), bg: s.bg || '', notes: String(s.notes || ''), items: (s.items || []).filter(i => i && i.type).map(i => Object.assign({}, i, { id: i.id || uid() })) })) : [KIT().newSlide('title')] };
    const S = { cur: 0, sel: null, editing: null, undo: [], redo: [], clip: null, k: 1, lastKind: '', lastPush: 0 };
    const T = () => O().THEMES[D.theme] || O().THEMES.paper;
    const tb = (c, ic, label, key, extra = '') => `<button type="button" class="of-tbtn" data-c="${c}" aria-label="${esc(t(label))}${key ? ` (${K(key)})` : ''}" title="${esc(t(label))}${key ? ` (${K(key)})` : ''}"${extra}>${ic}</button>`;
    const glyph = s => `<span class="of-glyph ${s.toLowerCase()}" aria-hidden="true">${s}</span>`;
    host.innerHTML = `
      <div class="of-tb" role="toolbar" aria-label="${esc(t('Slide tools'))}" id="sl-tb">
        ${tb('undo', icon('undo', 17), 'Undo', 'Ctrl+Z')}${tb('redo', icon('redo', 17), 'Redo', 'Ctrl+Y')}<span class="of-sep"></span>
        <button type="button" class="of-tbtn wide" data-c="newslide" data-menu aria-haspopup="menu" aria-expanded="false">${icon('plus', 16)} <span>${esc(t('New slide'))}</span></button>
        ${tb('textbox', icon('textbox', 17), 'Text box')}${tb('pic', icon('image', 17), 'Picture')}<input type="file" id="sl-pic" accept="image/png,image/jpeg,image/gif,image/webp" hidden>${tb('shape', icon('shapes', 17), 'Shape', '', ' data-menu aria-haspopup="menu" aria-expanded="false"')}<span class="of-sep"></span>
        <select class="of-sel of-sel-font" data-c="font" aria-label="${esc(t('Font'))}">${O().FONTS.map(f => `<option value="${f}">${f}</option>`).join('')}</select><select class="of-sel of-sel-size" data-c="size" aria-label="${esc(t('Font size'))}">${SIZES.map(z => `<option value="${z}">${z}</option>`).join('')}</select>
        ${tb('bold', glyph('B'), 'Bold', 'Ctrl+B', ' aria-pressed="false"')}${tb('italic', glyph('I'), 'Italic', 'Ctrl+I', ' aria-pressed="false"')}${tb('underline', glyph('U'), 'Underline', 'Ctrl+U', ' aria-pressed="false"')}
        ${tb('color', `<span class="of-cbtn">${icon('textcolor', 17)}<i id="sl-cbar"></i></span>`, 'Text colour', '', ' aria-haspopup="dialog"')}${tb('align', icon('alignl', 17), 'Text alignment', '', ' data-menu aria-haspopup="menu" aria-expanded="false"')}${tb('bullet', icon('ul', 17), 'Bullets', '', ' aria-pressed="false"')}${tb('number', icon('ol', 17), 'Numbering', '', ' aria-pressed="false"')}${tb('outdent', icon('outdent', 17), 'Decrease level', 'Shift+Tab')}${tb('indent', icon('indent', 17), 'Increase level', 'Tab')}<span class="of-sep"></span>
        ${tb('fill', icon('fill', 17), 'Fill', '', ' aria-haspopup="dialog"')}${tb('line', `<span class="of-cbtn">${icon('pen', 17)}</span>`, 'Outline colour', '', ' aria-haspopup="dialog"')}${tb('front', icon('front', 17), 'Bring to front')}${tb('back', icon('back', 17), 'Send to back')}${tb('del', icon('trash', 17), 'Delete', 'Del')}<span class="of-sep"></span>
        <button type="button" class="of-tbtn wide" data-c="theme" data-menu aria-haspopup="menu" aria-expanded="false">${icon('sun', 16)} <span>${esc(t('Theme'))}</span></button>${tb('bg', icon('fill', 17), 'Slide background', '', ' aria-haspopup="dialog"')}
      </div>
      <div class="sl-main">
        <div class="sl-rail-w"><ol class="sl-rail" id="sl-rail" role="listbox" aria-label="${esc(t('Slides'))}" aria-orientation="vertical"></ol><button type="button" class="btn sm sl-add" id="sl-add">${icon('plus', 14)} ${esc(t('Slide'))}</button></div>
        <div class="sl-work">
          <div class="sl-stage-wrap" id="sl-wrap"><div class="sl-stage" id="sl-stage" tabindex="0" role="application" aria-roledescription="${esc(t('slide'))}" aria-label="${esc(t('Slide'))}" translate="no"></div></div>
          <div class="sl-notes-w"><label for="sl-notes" class="small muted">${esc(t('Speaker notes'))}</label><textarea class="input sl-notes" id="sl-notes" rows="3" placeholder="${esc(t('What to say on this slide. Only you see these.'))}" translate="no"></textarea></div>
          <p class="sr-only" id="sl-live" role="status" aria-live="polite"></p>
        </div>
      </div>`;
    const stage = $('#sl-stage', host), wrap = $('#sl-wrap', host), rail = $('#sl-rail', host), bar = $('#sl-tb', host), notes = $('#sl-notes', host);
    KIT().toolbar(bar);
    const cur = () => D.slides[S.cur];
    const itemOf = id => cur().items.find(i => i.id === id) || null;
    const live = msg => { $('#sl-live', host).textContent = msg; };

    /* ---------- undo ---------- */
    function push(kind) {
      const now = Date.now(); if (kind && kind === S.lastKind && now - S.lastPush < 1200) { S.lastPush = now; return; }
      S.undo.push({ d: clone(D), cur: S.cur, sel: S.sel }); if (S.undo.length > 150) S.undo.shift(); S.redo = []; S.lastKind = kind || ''; S.lastPush = now;
    }
    function apply(x) { D.theme = x.d.theme; D.slides = x.d.slides; S.cur = Math.min(x.cur, D.slides.length - 1); S.sel = x.sel; paintAll(); ctx.changed(); }
    function undo() { stopEdit(); if (!S.undo.length) { toast(t('Nothing to undo')); return; } S.redo.push({ d: clone(D), cur: S.cur, sel: S.sel }); apply(S.undo.pop()); S.lastKind = ''; }
    function redo() { stopEdit(); if (!S.redo.length) return; S.undo.push({ d: clone(D), cur: S.cur, sel: S.sel }); apply(S.redo.pop()); S.lastKind = ''; }
    const changed = () => { ctx.changed(); thumbSoon(); };

    /* ---------- the stage: the slide at the size that fits ---------- */
    function fit() { const w = wrap.clientWidth; if (!w) return; S.k = w / (W * 4 / 3); stage.style.transform = `scale(${S.k})`; wrap.style.height = Math.round(H * 4 / 3 * S.k) + 'px'; }
    const ro = global.ResizeObserver ? new ResizeObserver(() => fit()) : null; if (ro) ro.observe(wrap); else global.addEventListener('resize', fit);
    function paintStage() {
      if (S.editing) return;
      stage.innerHTML = slideHtml(cur(), T(), true) + '<div class="sl-guides" aria-hidden="true"><i class="gx"></i><i class="gy"></i></div><div class="sl-selbox" id="sl-selbox" hidden></div>';
      stage.setAttribute('aria-label', t('Slide {1} of {2}', S.cur + 1, D.slides.length) + (titleOf(cur()) ? ': ' + titleOf(cur()) : ''));
      paintSel(); notes.value = cur().notes || '';
    }
    const titleOf = s => { const it = s.items.find(i => i.role === 'title') || s.items.find(i => i.type === 'text'); return it ? O().slideText(it.html).split('\n')[0].slice(0, 80) : ''; };
    function paintSel() {
      const box = $('#sl-selbox', stage); if (!box) return; const it = S.sel && itemOf(S.sel); paintTools();
      $$('.sl-it', stage).forEach(e => e.classList.toggle('sel', !!it && e.dataset.id === it.id));
      if (!it) { box.hidden = true; return; }
      box.hidden = false; const hs = Math.max(6, 9 / S.k * 0.75);
      if (it.type === 'line') { box.className = 'sl-selbox line'; box.style.cssText = `left:0;top:0;width:0;height:0;--hs:${hs}pt`; box.innerHTML = `<i class="h" data-h="p1" style="left:${it.x1}pt;top:${it.y1}pt"></i><i class="h" data-h="p2" style="left:${it.x2}pt;top:${it.y2}pt"></i>`; return; }
      box.className = 'sl-selbox'; box.style.cssText = `left:${it.x}pt;top:${it.y}pt;width:${it.w}pt;height:${it.h}pt;--hs:${hs}pt`;
      box.innerHTML = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<i class="h ${h}" data-h="${h}"></i>`).join('');
    }
    function select(id) { if (S.editing && S.editing !== id) stopEdit(); S.sel = id; paintSel(); const it = id && itemOf(id); if (it) live(describe(it)); }
    const describe = it => it.type === 'text' ? t('Text box: {1}', O().slideText(it.html).slice(0, 80) || t('empty')) : it.type === 'image' ? t('Picture') + (it.alt ? ': ' + it.alt : '') : it.type === 'line' ? (it.arrow ? t('Arrow') : t('Line')) : t('Shape');

    /* ---------- the slides down the side ---------- */
    function paintRail() {
      rail.innerHTML = D.slides.map((s, i) => `<li class="sl-r${i === S.cur ? ' on' : ''}" role="option" aria-selected="${i === S.cur}" tabindex="${i === S.cur ? 0 : -1}" data-i="${i}" draggable="true" aria-label="${esc(t('Slide {1}', i + 1) + (titleOf(s) ? ': ' + titleOf(s) : ''))}"><span class="sl-rn" aria-hidden="true">${i + 1}</span><div class="sl-thumb" aria-hidden="true" translate="no"><div class="sl-mini">${slideHtml(s, T(), false)}</div></div></li>`).join('');
      fitThumbs();
    }
    function fitThumbs() { $$('.sl-thumb', rail).forEach(th => { const k = th.clientWidth / (W * 4 / 3); const m = $('.sl-mini', th); if (m && k) m.style.transform = `scale(${k})`; }); }
    let thumbT = 0;
    function thumbSoon() { clearTimeout(thumbT); thumbT = setTimeout(() => { const li = rail.children[S.cur]; if (!li) { paintRail(); return; } const m = $('.sl-mini', li); if (m) m.innerHTML = slideHtml(cur(), T(), false); li.setAttribute('aria-label', t('Slide {1}', S.cur + 1) + (titleOf(cur()) ? ': ' + titleOf(cur()) : '')); }, 250); }
    function go(i, focusRail) { stopEdit(); S.cur = Math.max(0, Math.min(D.slides.length - 1, i)); S.sel = null; paintStage(); $$('.sl-r', rail).forEach((li, j) => { li.classList.toggle('on', j === S.cur); li.setAttribute('aria-selected', String(j === S.cur)); li.tabIndex = j === S.cur ? 0 : -1; }); const li = rail.children[S.cur]; if (li) { li.scrollIntoView({ block: 'nearest' }); if (focusRail) li.focus(); } live(t('Slide {1} of {2}', S.cur + 1, D.slides.length)); }
    function paintAll() { paintRail(); paintStage(); fit(); }
    function addSlide(kind, at) { stopEdit(); push(); const s = KIT().newSlide(kind); const i = at == null ? S.cur + 1 : at; D.slides.splice(i, 0, s); S.cur = i; S.sel = null; paintAll(); changed(); go(i); }
    function dupSlide(i) { stopEdit(); push(); const s = D.slides[i]; const c = Object.assign({}, s, { id: uid(), items: s.items.map(x => Object.assign({}, x, { id: uid() })) }); D.slides.splice(i + 1, 0, c); S.cur = i + 1; paintAll(); changed(); live(t('Slide duplicated')); }
    function delSlide(i) { stopEdit(); push(); if (D.slides.length === 1) { D.slides[0] = KIT().newSlide('blank'); } else D.slides.splice(i, 1); S.cur = Math.min(S.cur, D.slides.length - 1); S.sel = null; paintAll(); changed(); live(t('Slide deleted. Ctrl+Z brings it back.')); }
    function moveSlide(i, to) { if (to < 0 || to >= D.slides.length || to === i) return; stopEdit(); push(); const [s] = D.slides.splice(i, 1); D.slides.splice(to, 0, s); S.cur = to; paintAll(); changed(); go(to, true); live(t('Moved to {1}', to + 1)); }
    rail.addEventListener('click', e => { const li = e.target.closest('.sl-r'); if (li) go(+li.dataset.i); });
    rail.addEventListener('keydown', e => {
      const li = e.target.closest('.sl-r'); if (!li) return; const i = +li.dataset.i;
      if ((e.altKey || e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveSlide(i, i + (e.key === 'ArrowUp' ? -1 : 1)); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); go(i + (e.key === 'ArrowDown' ? 1 : -1), true); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(e.key === 'Home' ? 0 : D.slides.length - 1, true); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSlide(i); go(S.cur, true); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dupSlide(i); go(S.cur, true); }
      else if (e.key === 'Enter') { e.preventDefault(); stage.focus(); }
    });
    rail.addEventListener('contextmenu', e => { const li = e.target.closest('.sl-r'); if (!li) return; e.preventDefault(); const i = +li.dataset.i; go(i); KIT().menu(li, [{ label: t('New slide'), icon: 'plus', run: () => addSlide('content', i + 1) }, { label: t('Duplicate slide'), icon: 'copy', key: K('Ctrl+D'), run: () => dupSlide(i) }, { label: t('Move up'), icon: 'up', disabled: i === 0, run: () => moveSlide(i, i - 1) }, { label: t('Move down'), icon: 'down', disabled: i === D.slides.length - 1, run: () => moveSlide(i, i + 1) }, { sep: true }, { label: t('Delete slide'), icon: 'trash', danger: true, run: () => delSlide(i) }], { label: t('Slide {1}', i + 1) }); });
    let dragFrom = -1;
    rail.addEventListener('dragstart', e => { const li = e.target.closest('.sl-r'); if (!li) return; dragFrom = +li.dataset.i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'slide'); } catch (x) {} });
    rail.addEventListener('dragover', e => { if (dragFrom < 0) return; e.preventDefault(); const li = e.target.closest('.sl-r'); $$('.sl-r', rail).forEach(x => x.classList.remove('drop-a', 'drop-b')); if (li) { const r = li.getBoundingClientRect(); li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-a' : 'drop-b'); } });
    rail.addEventListener('drop', e => { if (dragFrom < 0) return; e.preventDefault(); const li = e.target.closest('.sl-r'); if (li) { const r = li.getBoundingClientRect(); let to = +li.dataset.i + (e.clientY < r.top + r.height / 2 ? 0 : 1); if (to > dragFrom) to--; moveSlide(dragFrom, to); } dragFrom = -1; });
    rail.addEventListener('dragend', () => { dragFrom = -1; $$('.sl-r', rail).forEach(x => x.classList.remove('drop-a', 'drop-b')); });
    $('#sl-add', host).addEventListener('click', () => addSlide('content'));
    notes.addEventListener('input', () => { push('notes'); cur().notes = notes.value.slice(0, 20000); ctx.changed(); });

    /* ---------- items: add, change, remove ---------- */
    function addItem(it, quiet) { stopEdit(); push(); cur().items.push(it); paintStage(); select(it.id); changed(); stage.focus({ preventScroll: true }); if (!quiet) live(t('Added: {1}', describe(it))); return it; }   // the slide takes the keys: arrows move what was added
    function addText() { const it = addItem({ id: uid(), type: 'text', role: 'text', x: 300, y: 220, w: 360, h: 60, html: '<p><br></p>', size: 24 }); startEdit(it.id); }
    function addShape(kind) {
      if (kind === 'line' || kind === 'arrow') { addItem({ id: uid(), type: 'line', x1: 330, y1: 270, x2: 630, y2: 270, color: T().fg, lineW: 3, arrow: kind === 'arrow' }); return; }
      addItem({ id: uid(), type: 'shape', shape: kind, x: 380, y: 190, w: 200, h: kind === 'ellipse' || kind === 'triangle' ? 160 : 120, fill: T().accent, line: 'none', lineW: 2, html: '', size: 20, color: '#ffffff' });
    }
    async function addPicture(file, at) {
      try {
        const src = await KIT().pictureFrom(file, 1920); const img = await O().loadImage(src); const r = img.naturalWidth / img.naturalHeight || 1;
        let w = Math.min(560, W * 0.6), h = w / r; if (h > H * 0.7) { h = H * 0.7; w = h * r; }
        const x = at ? Math.max(0, Math.min(W - w, at.x - w / 2)) : (W - w) / 2, y = at ? Math.max(0, Math.min(H - h, at.y - h / 2)) : (H - h) / 2;
        addItem({ id: uid(), type: 'image', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), src, alt: '' });
      } catch (e) { toast(e.message, 4500); }
    }
    function delItem() { const it = S.sel && itemOf(S.sel); if (!it) return; stopEdit(); push(); cur().items = cur().items.filter(i => i !== it); S.sel = null; paintStage(); changed(); live(t('Deleted. Ctrl+Z brings it back.')); }
    function arrange(front) { const it = S.sel && itemOf(S.sel); if (!it) return; push(); const L = cur().items.filter(i => i !== it); cur().items = front ? L.concat(it) : [it].concat(L); paintStage(); changed(); }
    function dupItem(it) { const c = Object.assign({}, it, { id: uid() }); if (c.type === 'line') { c.x1 += 16; c.x2 += 16; c.y1 += 16; c.y2 += 16; } else { c.x = Math.min(W - 10, c.x + 16); c.y = Math.min(H - 10, c.y + 16); } return addItem(c, true); }

    /* ---------- text: typing in a box ---------- */
    function startEdit(id, at) {
      const it = itemOf(id); if (!it || (it.type !== 'text' && it.type !== 'shape')) return;
      if (S.editing === id) return; stopEdit(); select(id);
      const el = $(`.sl-it[data-id="${CSS.escape(id)}"] .sl-tx`, stage); if (!el) return;
      S.editing = id; S.editBefore = { d: clone(D), cur: S.cur, sel: id }; S.editHtml = it.html || '';
      if (!el.innerHTML.trim()) el.innerHTML = '<p><br></p>';
      el.contentEditable = 'true'; el.spellcheck = true; el.setAttribute('role', 'textbox'); el.setAttribute('aria-multiline', 'true'); el.setAttribute('aria-label', describe(it));
      $(`.sl-it[data-id="${CSS.escape(id)}"]`, stage).classList.add('editing'); document.execCommand('defaultParagraphSeparator', false, 'p');
      el.focus({ preventScroll: true });
      const s = getSelection(); let r = null;
      if (at && document.caretRangeFromPoint) { r = document.caretRangeFromPoint(at.x, at.y); if (r && !el.contains(r.startContainer)) r = null; }
      if (!r) { r = document.createRange(); r.selectNodeContents(el); r.collapse(false); }
      s.removeAllRanges(); s.addRange(r); paintTools();
    }
    function stopEdit() {
      const id = S.editing; if (!id) return; S.editing = null;
      const it = itemOf(id); const el = $(`.sl-it[data-id="${CSS.escape(id)}"] .sl-tx`, stage);
      if (it && el) {
        const h = O().normSlide(el.innerHTML); el.contentEditable = 'false'; el.removeAttribute('role'); el.removeAttribute('aria-multiline'); el.removeAttribute('aria-label'); el.parentNode.classList.remove('editing');
        if (h !== O().normSlide(S.editHtml || '')) { S.undo.push(S.editBefore); S.redo = []; it.html = h; grow(it); changed(); }
        else if (it.type === 'text' && it.role === 'text' && !O().slideText(h)) { cur().items = cur().items.filter(i => i !== it); S.sel = null; }   // an empty new box goes away
      }
      paintStage();
    }
    function grow(it) {   // a text box gets taller when its words need it, as PowerPoint's do
      if (it.type !== 'text') return; const el = $(`.sl-it[data-id="${CSS.escape(it.id)}"] .sl-tx`, stage); if (!el) return;
      const need = el.scrollHeight * 0.75 + 1; if (need > it.h) it.h = Math.min(H * 2, Math.ceil(need));
    }
    const editEl = () => S.editing ? $(`.sl-it[data-id="${CSS.escape(S.editing)}"] .sl-tx`, stage) : null;
    /** a format on the whole selected box (not being typed in): the browser does it on the box, with everything selected */
    function onBox(fn) {
      const it = S.sel && itemOf(S.sel); if (!it || (it.type !== 'text' && it.type !== 'shape')) { toast(t('Pick a text box first.')); return; }
      if (S.editing) { refocus(); fn(editEl(), true); return; }
      const el = $(`.sl-it[data-id="${CSS.escape(it.id)}"] .sl-tx`, stage); if (!el) return; push();
      el.contentEditable = 'true'; el.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      fn(el, false); it.html = O().normSlide(el.innerHTML); el.contentEditable = 'false'; s.removeAllRanges(); stage.focus({ preventScroll: true }); grow(it); paintStage(); changed();
    }
    const paras = (el, all) => { if (all) return $$('p', el); const s = getSelection(); if (!s.rangeCount) return []; const r = s.getRangeAt(0); return $$('p', el).filter(p => r.intersectsNode(p)); };
    function fmt(cmd) { onBox(() => { document.execCommand('styleWithCSS', false, false); document.execCommand(cmd, false, null); }); }
    function setSize(pt) {
      const it = S.sel && itemOf(S.sel); if (!it) return;
      if (!S.editing) { push(); it.size = pt; const tmp = document.createElement('div'); tmp.innerHTML = it.html || ''; $$('[style]', tmp).forEach(x => { x.style.fontSize = ''; if (!x.getAttribute('style')) x.removeAttribute('style'); }); it.html = O().normSlide(tmp.innerHTML); paintStage(); grow(it); changed(); return; }
      refocus(); document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7'); $$('font[size="7"]', editEl()).forEach(f => { const sp = document.createElement('span'); sp.style.fontSize = pt + 'pt'; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); });
    }
    function setFont(f) { const it = S.sel && itemOf(S.sel); if (!it) return; if (!S.editing) { push(); it.font = f; const tmp = document.createElement('div'); tmp.innerHTML = it.html || ''; $$('[style]', tmp).forEach(x => { x.style.fontFamily = ''; }); it.html = O().normSlide(tmp.innerHTML); paintStage(); changed(); return; } refocus(); document.execCommand('styleWithCSS', false, false); document.execCommand('fontName', false, f); }
    function setColor(c) { const it = S.sel && itemOf(S.sel); if (!it) return; if (!S.editing) { push(); it.color = c; const tmp = document.createElement('div'); tmp.innerHTML = it.html || ''; $$('[style]', tmp).forEach(x => { x.style.color = ''; }); $$('font[color]', tmp).forEach(x => x.removeAttribute('color')); it.html = O().normSlide(tmp.innerHTML); paintStage(); changed(); return; } refocus(); document.execCommand('styleWithCSS', false, false); document.execCommand('foreColor', false, c || themeColor(T(), it)); }
    function setAlign(a) { onBox((el, editing) => paras(el, !editing).forEach(p => { p.style.textAlign = a === 'left' ? '' : a; if (!p.getAttribute('style')) p.removeAttribute('style'); })); }
    function setList(kind) { onBox((el, editing) => { const L = paras(el, !editing); const on = L.length && L.every(p => p.dataset.list === kind); L.forEach(p => { if (on) delete p.dataset.list; else p.dataset.list = kind; }); }); }
    function level(d) { onBox((el, editing) => paras(el, !editing).forEach(p => { const v = Math.max(0, Math.min(4, (+p.dataset.lvl || 0) + d)); if (v) p.dataset.lvl = String(v); else delete p.dataset.lvl; })); }
    function paintTools() {
      const it = S.sel && itemOf(S.sel); const textual = !!it && (it.type === 'text' || it.type === 'shape');
      ['font', 'size', 'bold', 'italic', 'underline', 'color', 'align', 'bullet', 'number', 'outdent', 'indent'].forEach(c => { const b = $(`[data-c="${c}"]`, bar); if (b) b.disabled = !textual; });
      ['fill', 'line'].forEach(c => { const b = $(`[data-c="${c}"]`, bar); if (b) b.disabled = !it || !(it.type === 'shape' || it.type === 'text' || (c === 'line' && it.type === 'line')); });
      ['front', 'back', 'del'].forEach(c => { const b = $(`[data-c="${c}"]`, bar); if (b) b.disabled = !it; });
      if (textual) {
        $('[data-c="size"]', bar).value = String(SIZES.includes(+it.size) ? +it.size : nearest(+it.size || O().ROLE_SIZE[it.role] || 20));
        $('[data-c="font"]', bar).value = it.font || (it.role === 'title' ? T().titleFont : T().font);
        $('#sl-cbar', host).style.background = it.type === 'shape' ? (it.color || '#ffffff') : themeColor(T(), it);
        if (S.editing) ['bold', 'italic', 'underline'].forEach(c => { let on = false; try { on = document.queryCommandState(c); } catch (e) {} $(`[data-c="${c}"]`, bar).setAttribute('aria-pressed', String(!!on)); });
        else { const tmp = document.createElement('div'); tmp.innerHTML = it.html || ''; const txt = tmp.textContent.trim(); const all = tag => !!txt && $$(tag, tmp).map(x => x.textContent).join('').replace(/\s/g, '').length === txt.replace(/\s/g, '').length; [['bold', 'strong'], ['italic', 'em'], ['underline', 'u']].forEach(([c, tag]) => $(`[data-c="${c}"]`, bar).setAttribute('aria-pressed', String(all(tag)))); const ps = $$('p', tmp); $('[data-c="bullet"]', bar).setAttribute('aria-pressed', String(!!ps.length && ps.every(p => p.dataset.list === 'bullet'))); $('[data-c="number"]', bar).setAttribute('aria-pressed', String(!!ps.length && ps.every(p => p.dataset.list === 'number'))); }
      }
    }
    const nearest = v => SIZES.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, 20);

    /* ---------- pointer: select, move, resize, edit ---------- */
    const pt = e => { const r = stage.getBoundingClientRect(); const k = r.width / W; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
    const snap = (v, targets, tol) => { for (const s of targets) if (Math.abs(v - s) <= tol) return { v: s, hit: s }; return { v, hit: null }; };
    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; const h = e.target.closest('.h'); const el = e.target.closest('.sl-it');
      if (S.editing && el && el.dataset.id === S.editing && !h) return;   // typing in the box: the browser places the cursor
      if (!h && !el) { stopEdit(); select(null); stage.focus({ preventScroll: true }); return; }
      const id = h ? S.sel : el.dataset.id; if (!h && el.classList.contains('sl-line') && !e.target.closest('line')) { stopEdit(); select(null); return; }
      if (id !== S.sel) select(id); else if (S.editing) stopEdit();
      e.preventDefault(); stage.focus({ preventScroll: true });
      const it = itemOf(id); if (!it) return; const p0 = pt(e); const start = Object.assign({}, it); let moved = false;
      const guides = $('.sl-guides', stage); const gx = $('.gx', stage), gy = $('.gy', stage);
      const move = ev => {
        const p = pt(ev); let dx = p.x - p0.x, dy = p.y - p0.y; if (!moved && Math.hypot(dx, dy) * S.k < 3) return; if (!moved) { moved = true; push(); }
        const tol = 6 / Math.max(0.3, S.k * 4 / 3);
        if (!h) {
          if (it.type === 'line') { it.x1 = start.x1 + dx; it.x2 = start.x2 + dx; it.y1 = start.y1 + dy; it.y2 = start.y2 + dy; }
          else {
            let x = start.x + dx, y = start.y + dy; let sx = null, sy = null;
            if (!ev.altKey) { for (const [off, k] of [[0, 'l'], [it.w / 2, 'c'], [it.w, 'r']]) { const s = snap(x + off, [0, W / 2, W], tol); if (s.hit !== null) { x = s.v - off; sx = s.hit; break; } } for (const [off] of [[0], [it.h / 2], [it.h]]) { const s = snap(y + off, [0, H / 2, H], tol); if (s.hit !== null) { y = s.v - off; sy = s.hit; break; } } }
            it.x = Math.round(x * 10) / 10; it.y = Math.round(y * 10) / 10; guides.classList.toggle('on', sx !== null || sy !== null); gx.style.left = sx !== null ? sx + 'pt' : '-10pt'; gy.style.top = sy !== null ? sy + 'pt' : '-10pt';
          }
        } else if (h.dataset.h === 'p1' || h.dataset.h === 'p2') { const k = h.dataset.h === 'p1' ? '1' : '2'; let x = start['x' + k] + dx, y = start['y' + k] + dy; if (ev.shiftKey) { const ox = k === '1' ? it.x2 : it.x1, oy = k === '1' ? it.y2 : it.y1; const a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * Math.PI / 4; const d = Math.hypot(x - ox, y - oy); x = ox + d * Math.cos(a); y = oy + d * Math.sin(a); } it['x' + k] = x; it['y' + k] = y; }
        else {
          const d = h.dataset.h; let { x, y, w, h: hh } = start; const min = 12;
          if (d.includes('e')) w = Math.max(min, start.w + dx); if (d.includes('s')) hh = Math.max(min, start.h + dy);
          if (d.includes('w')) { w = Math.max(min, start.w - dx); x = start.x + start.w - w; } if (d.includes('n')) { hh = Math.max(min, start.h - dy); y = start.y + start.h - hh; }
          if ((ev.shiftKey || it.type === 'image') && d.length === 2 && !(it.type === 'image' && ev.shiftKey)) { const r = start.w / start.h; if (w / hh > r) w = hh * r; else hh = w / r; if (d.includes('w')) x = start.x + start.w - w; if (d.includes('n')) y = start.y + start.h - hh; }
          Object.assign(it, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(hh * 10) / 10 });
        }
        const node = $(`.sl-it[data-id="${CSS.escape(it.id)}"]`, stage); if (node) node.outerHTML = itemHtml(it, T(), true); paintSel();
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); guides.classList.remove('on'); if (moved) { paintStage(); changed(); live(it.type === 'line' ? t('Moved') : t('At {1}, {2}; {3} by {4}', Math.round(it.x), Math.round(it.y), Math.round(it.w), Math.round(it.h))); } };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
    stage.addEventListener('dblclick', e => { const el = e.target.closest('.sl-it'); if (!el) return; const it = itemOf(el.dataset.id); if (it && (it.type === 'text' || it.type === 'shape')) startEdit(it.id, { x: e.clientX, y: e.clientY }); else if (it && it.type === 'image') altText(it); });
    async function altText(it) { const v = await KIT().dialog({ title: t('Describe the picture'), text: t('A sentence for people who cannot see it: screen readers read it out, and PowerPoint keeps it.'), fields: [{ name: 'alt', label: t('Description'), value: it.alt || '', maxlength: 300 }], ok: t('Save') }); if (v) { push(); it.alt = v.alt.trim(); paintStage(); changed(); } }
    stage.addEventListener('input', e => { if (S.editing) { const it = itemOf(S.editing); const el = editEl(); if (it && el && it.type === 'text') { const need = el.scrollHeight * 0.75 + 1; if (need > it.h) { it.h = Math.ceil(need); el.parentNode.style.height = it.h + 'pt'; paintSel(); } } ctx.changed(); } });
    stage.addEventListener('focusout', e => { if (S.editing && !stage.contains(e.relatedTarget) && !(e.relatedTarget && (bar.contains(e.relatedTarget) || e.relatedTarget.closest('.of-pop, .of-menu')))) setTimeout(() => { if (S.editing && !stage.contains(document.activeElement) && !bar.contains(document.activeElement) && !document.activeElement.closest('.of-pop, .of-menu, .of-dlg')) stopEdit(); }, 0); });
    document.addEventListener('selectionchange', onSel);
    function onSel() { if (S.editing) { const el = editEl(); const s = getSelection(); if (el && s.rangeCount && s.anchorNode && el.contains(s.anchorNode)) { S.erange = s.getRangeAt(0).cloneRange(); paintTools(); } } }
    function refocus() { const el = editEl(); if (!el) return; const s = getSelection(); const here = s.rangeCount && el.contains(s.anchorNode); el.focus({ preventScroll: true }); if (here) return; if (S.erange && el.contains(S.erange.startContainer)) { s.removeAllRanges(); s.addRange(S.erange); } }

    /* ---------- keys ---------- */
    stage.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (S.editing) {
        if (e.key === 'Escape') { e.preventDefault(); stopEdit(); stage.focus({ preventScroll: true }); return; }
        if (e.key === 'Tab') { const el = editEl(); const s = getSelection(); const p = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('p'); if (p && el.contains(p) && p.dataset.list) { e.preventDefault(); level(e.shiftKey ? -1 : 1); } return; }
        if (mod && (k === 'b' || k === 'i' || k === 'u')) { e.preventDefault(); fmt({ b: 'bold', i: 'italic', u: 'underline' }[k]); paintTools(); }
        return;
      }
      const it = S.sel && itemOf(S.sel);
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod && k === 'c' && it) { e.preventDefault(); S.clip = Object.assign({}, it); toast(t('Copied')); return; }
      if (mod && k === 'x' && it) { e.preventDefault(); S.clip = Object.assign({}, it); delItem(); return; }
      if (mod && k === 'd' && it) { e.preventDefault(); dupItem(it); return; }
      if (mod && k === 'a') { e.preventDefault(); return; }
      if (e.key === 'Tab') { const L = cur().items; if (!L.length) return; e.preventDefault(); const i = L.findIndex(x => x.id === S.sel); select(L[(i + (e.shiftKey ? -1 : 1) + L.length) % L.length].id); return; }
      if (e.key === 'Escape') { select(null); return; }
      if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); go(S.cur + (e.key === 'PageDown' ? 1 : -1)); return; }
      if (!it) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delItem(); return; }
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); if (it.type === 'image') altText(it); else startEdit(it.id); return; }
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) { e.preventDefault(); push('nudge'); const n = e.shiftKey ? 10 : 1; if (it.type === 'line') { it.x1 += d[0] * n; it.x2 += d[0] * n; it.y1 += d[1] * n; it.y2 += d[1] * n; } else { it.x += d[0] * n; it.y += d[1] * n; } const node = $(`.sl-it[data-id="${CSS.escape(it.id)}"]`, stage); if (node) node.outerHTML = itemHtml(it, T(), true); paintSel(); changed(); return; }
      if (e.key.length === 1 && !mod && !e.altKey && (it.type === 'text' || it.type === 'shape')) { startEdit(it.id); }   // typing on a selected box types into it
    });
    stage.addEventListener('paste', async e => {
      if (S.editing) { const cd = e.clipboardData; if (!cd) return; e.preventDefault(); const h = cd.getData('text/html'), p = cd.getData('text/plain'); if (h) document.execCommand('insertHTML', false, O().normSlide(h)); else if (p) document.execCommand('insertText', false, p.replace(/\r/g, '')); return; }
      const cd = e.clipboardData; const files = cd ? [...(cd.files || [])].filter(f => /^image\//.test(f.type)) : [];
      if (files.length) { e.preventDefault(); for (const f of files) await addPicture(f); return; }
      if (S.clip) { e.preventDefault(); dupItem(S.clip); return; }
      const p = cd && cd.getData('text/plain'); if (p && p.trim()) { e.preventDefault(); addItem({ id: uid(), type: 'text', role: 'text', x: 200, y: 200, w: 560, h: 60, size: 24, html: p.replace(/\r/g, '').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('') }); }
    });
    stage.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    stage.addEventListener('drop', async e => { const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter(f => /^image\//.test(f.type)); if (!files.length) return; e.preventDefault(); const at = pt(e); for (const f of files) await addPicture(f, at); });
    const keys = e => {   // undo and redo anywhere in the editor except the boxes the browser handles
      if (!host.contains(document.activeElement) || S.editing || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || stage.contains(document.activeElement)) return;
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } else if (mod && k === 'y') { e.preventDefault(); redo(); }
    };
    document.addEventListener('keydown', keys);

    /* ---------- toolbar ---------- */
    bar.addEventListener('mousedown', e => { if (e.target.closest('button.of-tbtn') && S.editing) e.preventDefault(); });
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b || b.tagName === 'SELECT' || b.disabled) return; const c = b.dataset.c; const it = S.sel && itemOf(S.sel);
      if (c === 'pic') { $('#sl-pic', host).click(); return; }
      if (c === 'undo') undo(); else if (c === 'redo') redo();
      else if (c === 'newslide') KIT().menu(b, LAYOUTS.map(([k, l]) => ({ label: t(l), icon: k === 'blank' ? 'plus' : 'present', run: () => addSlide(k) })), { label: t('New slide') });
      else if (c === 'textbox') addText();
      else if (c === 'shape') KIT().menu(b, SHAPES.map(([k, l]) => ({ label: t(l), icon: k === 'line' ? 'pen' : k === 'arrow' ? 'right' : 'shapes', run: () => addShape(k) })), { label: t('Shape') });
      else if (c === 'bold' || c === 'italic' || c === 'underline') { fmt(c); paintTools(); }
      else if (c === 'color') KIT().colorPicker(b, { label: t('Text colour'), value: it && it.color, none: t('Theme colour'), pick: v => { setColor(v); paintTools(); } });
      else if (c === 'align') KIT().menu(b, [['left', 'Align left', 'alignl'], ['center', 'Center', 'alignc'], ['right', 'Align right', 'alignr'], ['justify', 'Justify', 'alignj']].map(([a, l, ic]) => ({ label: t(l), icon: ic, run: () => setAlign(a) })), { label: t('Text alignment') });
      else if (c === 'bullet' || c === 'number') { setList(c); paintTools(); }
      else if (c === 'indent' || c === 'outdent') level(c === 'indent' ? 1 : -1);
      else if (c === 'fill' && it) KIT().colorPicker(b, { label: t('Fill'), value: it.fill, none: t('No fill'), pick: v => { push(); it.fill = v || (it.type === 'shape' ? 'none' : ''); paintStage(); changed(); } });
      else if (c === 'line' && it) KIT().colorPicker(b, { label: t('Outline colour'), value: it.type === 'line' ? it.color : it.line, none: it.type === 'line' ? null : t('No outline'), pick: v => { push(); if (it.type === 'line') it.color = v || T().fg; else it.line = v || 'none'; paintStage(); changed(); } });
      else if (c === 'front' || c === 'back') arrange(c === 'front');
      else if (c === 'del') delItem();
      else if (c === 'theme') KIT().menu(b, Object.keys(O().THEMES).map(k => ({ label: t(O().THEMES[k].name), checked: D.theme === k, run: () => { push(); D.theme = k; paintAll(); changed(); } })), { label: t('Theme'), cls: 'of-theme-menu' });
      else if (c === 'bg') KIT().colorPicker(b, { label: t('Slide background'), value: cur().bg, none: t('Theme background'), pick: v => { push(); cur().bg = v; paintAll(); changed(); } });
    });
    bar.addEventListener('change', e => { const c = e.target.dataset.c; if (c === 'size') setSize(+e.target.value); else if (c === 'font') setFont(e.target.value); if (S.editing) refocus(); });
    $('#sl-pic', host).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) addPicture(f); });

    /* ---------- present ---------- */
    function present(from) {
      stopEdit(); let i = from || 0; let black = false, showNotes = false;
      const sh = document.createElement('div'); sh.className = 'sl-show'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', t('Presenting'));
      sh.innerHTML = `<div class="sl-show-st" translate="no"><div class="sl-stage sl-show-slide"></div></div><div class="sl-show-notes" hidden translate="no"></div><div class="sl-show-bar"><button type="button" class="btn sm" data-s="prev" aria-label="${esc(t('Previous slide'))}">${icon('left', 16)}</button><span class="sl-show-n" aria-live="polite"></span><button type="button" class="btn sm" data-s="next" aria-label="${esc(t('Next slide'))}">${icon('right', 16)}</button><button type="button" class="btn sm" data-s="notes" aria-pressed="false">${esc(t('Speaker notes'))} (N)</button><button type="button" class="btn sm" data-s="end">${esc(t('End show'))} (Esc)</button></div>`;
      document.body.appendChild(sh); const slide = $('.sl-show-slide', sh), st = $('.sl-show-st', sh);
      const fitShow = () => { const k = Math.min(st.clientWidth / (W * 4 / 3), st.clientHeight / (H * 4 / 3)); slide.style.transform = `scale(${k})`; slide.style.left = (st.clientWidth - W * 4 / 3 * k) / 2 + 'px'; slide.style.top = (st.clientHeight - H * 4 / 3 * k) / 2 + 'px'; };
      const paint = () => { const s = D.slides[i]; slide.innerHTML = black ? '' : slideHtml(s, T(), false); slide.classList.toggle('black', black); $('.sl-show-n', sh).textContent = t('{1} of {2}', i + 1, D.slides.length); const n = $('.sl-show-notes', sh); n.hidden = !showNotes; n.textContent = s.notes || t('No notes on this slide.'); fitShow(); };
      const end = () => { document.removeEventListener('keydown', key, true); global.removeEventListener('resize', fitShow); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); sh.remove(); S.cur = i; paintAll(); go(i); stage.focus({ preventScroll: true }); };
      let digits = '';
      const key = e => {
        const k = e.key; if (k === 'Escape') { e.preventDefault(); end(); return; }
        if (/^\d$/.test(k)) { digits += k; return; } if (k === 'Enter' && digits) { e.preventDefault(); i = Math.max(0, Math.min(D.slides.length - 1, +digits - 1)); digits = ''; paint(); return; } digits = '';
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); if (i < D.slides.length - 1) { i++; paint(); } else end(); }
        else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (i > 0) { i--; paint(); } }
        else if (k === 'Home') { i = 0; paint(); } else if (k === 'End') { i = D.slides.length - 1; paint(); }
        else if (k.toLowerCase() === 'b' || k === '.') { black = !black; paint(); }
        else if (k.toLowerCase() === 'n') { showNotes = !showNotes; $('[data-s="notes"]', sh).setAttribute('aria-pressed', String(showNotes)); paint(); }
      };
      document.addEventListener('keydown', key, true); global.addEventListener('resize', fitShow);
      sh.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { const s = b.dataset.s; if (s === 'next') { if (i < D.slides.length - 1) { i++; paint(); } else end(); } else if (s === 'prev') { if (i > 0) { i--; paint(); } } else if (s === 'notes') { showNotes = !showNotes; b.setAttribute('aria-pressed', String(showNotes)); paint(); } else end(); return; } if (e.target.closest('.sl-show-notes')) return; if (e.target.closest('a')) return; if (i < D.slides.length - 1) { i++; paint(); } else end(); });
      let hideT = 0; sh.addEventListener('pointermove', () => { sh.classList.add('ptr'); clearTimeout(hideT); hideT = setTimeout(() => sh.classList.remove('ptr'), 2200); });
      if (sh.requestFullscreen) sh.requestFullscreen().then(() => setTimeout(fitShow, 60)).catch(() => {});
      paint(); setTimeout(paint, 50); $('[data-s="next"]', sh).focus();
    }
    function print() { stopEdit(); KIT().printHtml(D.slides.map(s => `<div class="of-print-slide"><div class="sl-stage">${slideHtml(s, T(), false)}</div></div>`).join(''), ctx.title(), 'deck', '@page { size: 13.333in 7.5in; margin: 0; } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }'); }
    async function pptx() { try { stopEdit(); await KIT().save(); await KIT().download('deck', { title: ctx.title() }, api.body()); } catch (e) { toast(t('That file could not be made here.'), 4500); } }
    ctx.bar.innerHTML = `<button type="button" class="btn sm primary" id="sl-present">${icon('present', 15)} <span>${esc(t('Present'))}</span></button><button type="button" class="btn sm" id="sl-file" data-menu aria-haspopup="menu" aria-expanded="false">${icon('download', 15)} <span>${esc(t('File'))}</span></button>`;
    $('#sl-present', ctx.bar).addEventListener('click', e => present(e.shiftKey ? S.cur : 0));
    $('#sl-file', ctx.bar).addEventListener('click', e => KIT().menu(e.currentTarget, ctx.fileMenu([
      { label: t('Present from the start'), icon: 'present', run: () => present(0) }, { label: t('Present from this slide'), icon: 'present', run: () => present(S.cur) }, { sep: true },
      { label: t('Download as PowerPoint (.pptx)'), icon: 'download', run: pptx }, { label: t('Print or save as PDF'), icon: 'print', run: print }, { sep: true }
    ]), { right: true, label: t('File') }));

    const api = {
      body: () => { if (S.editing) { const it = itemOf(S.editing), el = editEl(); if (it && el) it.html = O().normSlide(el.innerHTML); } return { theme: D.theme, slides: D.slides.map(s => ({ id: s.id, bg: s.bg || '', notes: s.notes || '', items: s.items.map(i => Object.assign({}, i)) })) }; },
      focus: () => stage.focus(),
      unmount: () => { document.removeEventListener('selectionchange', onSel); document.removeEventListener('keydown', keys); if (ro) ro.disconnect(); else global.removeEventListener('resize', fit); const sh = $('.sl-show'); if (sh) sh.remove(); }
    };
    paintAll(); setTimeout(() => { fit(); fitThumbs(); }, 0);
    return api;
  }
  App.OfficeEditors = App.OfficeEditors || {};
  App.OfficeEditors.deck = { mount };
})(window);
