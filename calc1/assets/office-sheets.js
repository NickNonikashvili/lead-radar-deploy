/* ============================================================
   Mathub — Sheets, the spreadsheet editor (assets/office.js opens it; #/sheets/<id>)
   A grid of cells as in Excel: what is typed is kept as typed (App.Formula reads it: numbers, text, dates, money,
   percents, TRUE/FALSE and "=" formulas), and every cell is worked out again after each change.
   - Moving and choosing: click, drag, Shift+click, the headers, the arrow keys (Ctrl to the edge of the data,
     Shift to choose), Home/End, Page Up/Down, Ctrl+A. Typing replaces a cell, F2 or a double click edits it, Enter,
     Tab and the arrows finish; Esc cancels. While a formula is typed, clicking or dragging over cells writes them in.
   - Copy, cut and paste (with Excel and Google Sheets too: text and tables come in, and go out as both); dragging the
     fill handle copies, counts on (1, 2, 3; Item 1, Item 2; dates), and moves formulas' references as Excel does;
     Ctrl+D and Ctrl+R fill down and right.
   - Formats (number, whole number, percent, currency, date), bold, italic, underline, colours, alignment, wrapping;
     column widths and row heights (drag, or double-click to fit); insert and delete rows and columns (formulas
     everywhere follow); sort A→Z and Z→A (a header row is kept in place); freeze the top row; AutoSum; find.
   - Several sheets (add, rename, copy, delete, reorder); charts (assets/office-chart.js) over the cells.
   - Saves as Excel (.xlsx), CSV or PDF (print). Its own undo history (Ctrl+Z, Ctrl+Y) for every change.
   The grid only draws the rows in view (and a few around), so a sheet of thousands of rows stays quick.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, toast } = App;
  const F = () => App.Formula; const O = () => App.OOXML; const KIT = () => App.Officekit; const CH = () => App.OfficeChart;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const HW = 46, HH = 24, DEF_W = 100, DEF_H = 24;
  const FMTS = [['', 'General'], ['num', 'Number (1,234.56)'], ['int', 'Whole number (1,235)'], ['pct', 'Percent (12.5%)'], ['usd', 'Currency ($1,234.56)'], ['date', 'Date (2026-10-26)']];
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const K = s => (isMac ? s.replace('Ctrl', '⌘') : s).replace(/\b(Ctrl|Shift|Alt|Enter|Tab|Del|Backspace)\b/g, k => t(k));   // a shortcut as this keyboard writes it: ⌘ on a Mac, Strg in German
  const cloneSheets = L => L.map(s => Object.assign({}, s, { cells: Object.assign({}, s.cells), cols: Object.assign({}, s.cols), rows: Object.assign({}, s.rows), charts: (s.charts || []).map(c => Object.assign({}, c)) }));

  function mount(host, ctx, body) {
    const B = { sheets: (Array.isArray(body.sheets) && body.sheets.length ? body.sheets : [{ name: t('Sheet1') }]).map(s => ({ name: String(s.name || 'Sheet'), cells: Object.assign({}, s.cells || {}), cols: Object.assign({}, s.cols || {}), rows: Object.assign({}, s.rows || {}), freeze: s.freeze ? 1 : 0, charts: Array.isArray(s.charts) ? s.charts.map(c => Object.assign({}, c)) : [] })), active: 0 };
    { const taken = new Set(); B.sheets.forEach(s => { s.name = O().sheetName(s.name, taken); taken.add(s.name.toLowerCase()); }); }
    B.active = Math.max(0, Math.min(B.sheets.length - 1, +body.active || 0));
    const S = { si: B.active, aR: 0, aC: 0, fR: 0, fC: 0, values: [], undo: [], redo: [], ed: null, win: null, extraRows: 0, chart: null, find: null, colX: [], rowY: [], nR: 0, nC: 0 };
    const sh = () => B.sheets[S.si];
    const A = (c, r) => F().addr(c, r);
    host.innerHTML = `
      <div class="of-tb" role="toolbar" aria-label="${esc(t('Spreadsheet tools'))}" id="sh-tb">
        ${btn('undo', icon('undo', 17), 'Undo', 'Ctrl+Z')}${btn('redo', icon('redo', 17), 'Redo', 'Ctrl+Y')}<span class="of-sep"></span>
        <select class="of-sel" data-c="fmt" aria-label="${esc(t('Number format'))}">${FMTS.map(([v, l]) => `<option value="${v}">${esc(t(l))}</option>`).join('')}</select><span class="of-sep"></span>
        ${btn('b', glyph('B'), 'Bold', 'Ctrl+B', ' aria-pressed="false"')}${btn('i', glyph('I'), 'Italic', 'Ctrl+I', ' aria-pressed="false"')}${btn('u', glyph('U'), 'Underline', 'Ctrl+U', ' aria-pressed="false"')}
        ${btn('color', `<span class="of-cbtn">${icon('textcolor', 17)}<i id="sh-cbar" style="background:#c0392b"></i></span>`, 'Text colour', '', ' aria-haspopup="dialog"')}${btn('bg', `<span class="of-cbtn">${icon('fill', 17)}<i id="sh-bbar" style="background:#fff59d"></i></span>`, 'Fill colour', '', ' aria-haspopup="dialog"')}<span class="of-sep"></span>
        ${btn('left', icon('alignl', 17), 'Align left', '', ' aria-pressed="false"')}${btn('center', icon('alignc', 17), 'Center', '', ' aria-pressed="false"')}${btn('right', icon('alignr', 17), 'Align right', '', ' aria-pressed="false"')}${btn('wrap', icon('wrap', 17), 'Wrap text', '', ' aria-pressed="false"')}<span class="of-sep"></span>
        ${btn('sum', icon('sigma2', 17), 'AutoSum', 'Alt+=', ' data-menu aria-haspopup="menu" aria-expanded="false"')}${btn('sort', icon('sortup', 17), 'Sort', '', ' data-menu aria-haspopup="menu" aria-expanded="false"')}${btn('rows', icon('rowplus', 17), 'Rows and columns', '', ' data-menu aria-haspopup="menu" aria-expanded="false"')}${btn('freeze', icon('freeze', 17), 'Freeze the top row', '', ' aria-pressed="false"')}${btn('chart', icon('chart2', 17), 'Chart', '', ' data-menu aria-haspopup="menu" aria-expanded="false"')}<span class="of-sep"></span>
        ${btn('find', icon('search', 17), 'Find', 'Ctrl+F')}
      </div>
      <div class="sh-fbar"><input class="sh-name" id="sh-name" aria-label="${esc(t('Cell address'))}" spellcheck="false" autocomplete="off"><span class="sh-fx" aria-hidden="true"><i>f</i>x</span><input class="sh-input" id="sh-input" aria-label="${esc(t('Contents of the cell'))}" spellcheck="false" autocomplete="off" translate="no"></div>
      <div class="of-sub of-findbar" id="sh-find" hidden role="search" aria-label="${esc(t('Find'))}"><input class="input sm" id="sh-q" placeholder="${esc(t('Find'))}" aria-label="${esc(t('Find'))}" spellcheck="false"><button type="button" class="btn sm" data-f="prev" aria-label="${esc(t('Previous'))}">${icon('up', 14)}</button><button type="button" class="btn sm" data-f="next" aria-label="${esc(t('Next'))}">${icon('down', 14)}</button><label class="check small"><input type="checkbox" id="sh-case"> ${esc(t('Match case'))}</label><span class="small muted" id="sh-fcount" role="status" aria-live="polite"></span><button type="button" class="btn sm ghost" data-f="close" aria-label="${esc(t('Close'))}">${icon('x', 14)}</button></div>
      <div class="sh-scroll" id="sh-scroll" tabindex="0" role="grid" aria-multiselectable="true" aria-describedby="sh-help" translate="no"><div class="sh-sheet" id="sh-sheet"><div class="sh-tbl" id="sh-tbl"></div>
        <div class="sh-sel" id="sh-sel" hidden></div><div class="sh-act" id="sh-act"></div><div class="sh-fill" id="sh-fill" title="${esc(t('Drag to fill'))}"></div><div class="sh-charts" id="sh-charts"></div><textarea class="sh-edit" id="sh-edit" hidden spellcheck="false" aria-label="${esc(t('Edit the cell'))}" translate="no"></textarea></div></div>
      <p class="sr-only" id="sh-help">${esc(t('Arrow keys move; type to fill a cell; F2 edits it; Enter and Tab finish. F6 moves to the formula bar and the sheet tabs.'))}</p>
      <div class="sh-foot"><div class="sh-tabs" id="sh-tabs" role="tablist" aria-label="${esc(t('Sheets'))}"></div><button type="button" class="btn sm ghost" id="sh-addsheet" aria-label="${esc(t('Add a sheet'))}" title="${esc(t('Add a sheet'))}">${icon('plus', 15)}</button><span class="sh-stat small" id="sh-stat" aria-live="polite"></span></div>
      <p class="sr-only" id="sh-live" role="status" aria-live="polite"></p>`;
    function btn(c, ic, label, key, extra = '') { return `<button type="button" class="of-tbtn" data-c="${c}" aria-label="${esc(t(label))}${key ? ` (${K(key)})` : ''}" title="${esc(t(label))}${key ? ` (${K(key)})` : ''}"${extra}>${ic}</button>`; }
    function glyph(s) { return `<span class="of-glyph ${s.toLowerCase()}" aria-hidden="true">${s}</span>`; }
    const sc = $('#sh-scroll', host), sheetEl = $('#sh-sheet', host), tbl = $('#sh-tbl', host), bar = $('#sh-tb', host), input = $('#sh-input', host), nameBox = $('#sh-name', host), edit = $('#sh-edit', host);
    KIT().toolbar(bar);
    const live = m => { $('#sh-live', host).textContent = m; };

    /* ---------- values ---------- */
    function recalc() { S.values = F().evaluate(B); }
    recalc();
    const val = (r, c, si = S.si) => S.values[si] ? S.values[si][A(c, r)] : undefined;
    const cellOf = (r, c) => sh().cells[A(c, r)];
    const fmtOf = cell => F().fmtOf(cell);
    const shown = (r, c) => { const v = val(r, c); return v === undefined ? '' : F().show(v, fmtOf(cellOf(r, c))); };
    const isErr = v => F().isErr(v);

    /* ---------- the grid's size ---------- */
    const colW = c => +sh().cols[c] || DEF_W, rowH = r => +sh().rows[r] || DEF_H;
    function used() { if (S.usedC && S.usedC.si === S.si && S.usedC.cells === sh().cells && S.usedC.n === Object.keys(sh().cells).length) return S.usedC; let r = -1, c = -1; for (const a of Object.keys(sh().cells)) { const p = F().parseAddr(a); if (p) { r = Math.max(r, p.r); c = Math.max(c, p.c); } } S.usedC = { r, c, si: S.si, cells: sh().cells, n: Object.keys(sh().cells).length }; return S.usedC; }
    function sizes() {
      const u = used(); const chartR = (sh().charts || []).reduce((m, ch) => Math.max(m, rowAtY(ch.y + ch.h)), 0), chartC = (sh().charts || []).reduce((m, ch) => Math.max(m, colAtX(ch.x + ch.w)), 0);
      S.nC = Math.min(F().MAX_COL, Math.max(26, u.c + 3, Math.max(S.aC, S.fC) + 2, chartC + 2)); S.nR = Math.min(F().MAX_ROW, Math.max(100, u.r + 30, Math.max(S.aR, S.fR) + 20, chartR + 5) + S.extraRows);
      S.colX = [0]; for (let c = 0; c < S.nC; c++) S.colX.push(S.colX[c] + colW(c));
      S.rowY = [0]; for (let r = 0; r < S.nR; r++) S.rowY.push(S.rowY[r] + rowH(r));
    }
    function colAtX(x) { let at = 0; for (let c = 0; c < F().MAX_COL; c++) { at += colW(c); if (at > x) return c; } return F().MAX_COL - 1; }
    function rowAtY(y) { let at = 0; for (let r = 0; r < F().MAX_ROW; r++) { at += rowH(r); if (at > y) return r; } return F().MAX_ROW - 1; }

    /* ---------- drawing the rows in view ---------- */
    function windowNow() {
      const top = Math.max(0, sc.scrollTop - HH), bottom = top + sc.clientHeight + 40; let r0 = 0, r1 = S.nR - 1;
      let lo = 0, hi = S.nR; while (lo < hi) { const m = (lo + hi) >> 1; if (S.rowY[m + 1] <= top) lo = m + 1; else hi = m; } r0 = Math.max(0, lo - 10);
      lo = r0; hi = S.nR - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S.rowY[m] >= bottom) hi = m - 1; else lo = m; } r1 = Math.min(S.nR - 1, lo + 10);
      return { r0, r1 };
    }
    function cellHtml(r, c) {
      const a = A(c, r), cell = sh().cells[a], v = S.values[S.si][a], st = (cell && cell.s) || {};
      const txt = v === undefined ? '' : F().show(v, fmtOf(cell));
      const al = st.al || (typeof v === 'number' ? 'right' : typeof v === 'boolean' || isErr(v) ? 'center' : 'left');
      let w = 0;   // text that runs on into empty cells to its right, as in Excel
      if (txt && !st.wrap && al === 'left' && typeof v === 'string') { let k = c + 1; w = colW(c); while (k < S.nC && w < 1200 && !sh().cells[A(k, r)]) { w += colW(k); k++; } if (w === colW(c)) w = 0; }
      const cls = [`a-${al[0]}`, st.b ? 'b' : '', st.i ? 'i' : '', st.u ? 'u' : '', st.wrap ? 'wrap' : '', isErr(v) ? 'err' : '', w ? 'over' : ''].filter(Boolean).join(' ');
      const style = (st.bg ? `background:${st.bg};` : '');
      return `<td role="gridcell" id="sh-${r}-${c}" data-c="${c}"${style ? ` style="${style}"` : ''}><div class="sh-v ${cls}" style="height:${rowH(r) - 1}px;${w ? `width:${w - 1}px;` : ''}${st.color ? `color:${st.color};` : ''}">${esc(txt)}</div></td>`;
    }
    function rowHtml(r, frz) { let s = `<tr data-r="${r}" role="row" aria-rowindex="${r + 2}"${frz ? ' class="sh-frz"' : ''}><th class="sh-rh" scope="row" data-r="${r}" role="rowheader" style="height:${rowH(r)}px">${r + 1}<i class="sh-rzr" data-rz="${r}" aria-hidden="true"></i></th>`; for (let c = 0; c < S.nC; c++) s += cellHtml(r, c); return s + '</tr>'; }
    function render(force) {
      sizes(); const w = windowNow(); if (!force && S.win && S.win.r0 === w.r0 && S.win.r1 === w.r1 && S.win.nC === S.nC && S.win.nR === S.nR) { place(); return; }
      S.win = Object.assign({}, w, { nC: S.nC, nR: S.nR });
      const totalW = HW + S.colX[S.nC]; const frz = sh().freeze ? 1 : 0;
      let h = `<table class="sh-t" style="width:${totalW}px" role="presentation"><colgroup><col style="width:${HW}px">${Array.from({ length: S.nC }, (_, c) => `<col style="width:${colW(c)}px">`).join('')}</colgroup>`;
      h += `<thead><tr role="row" aria-rowindex="1"><th class="sh-corner" data-all role="columnheader" aria-label="${esc(t('Choose all'))}"></th>${Array.from({ length: S.nC }, (_, c) => `<th class="sh-ch" scope="col" role="columnheader" data-c="${c}">${F().colName(c)}<i class="sh-rz" data-rz="${c}" aria-hidden="true"></i></th>`).join('')}</tr></thead><tbody>`;
      let r0 = w.r0; if (frz) { h += rowHtml(0, true); if (r0 === 0) r0 = 1; }
      const padTop = S.rowY[r0] - (frz ? S.rowY[1] : 0); if (padTop > 0) h += `<tr class="sh-pad" aria-hidden="true"><td colspan="${S.nC + 1}" style="height:${padTop}px"></td></tr>`;
      for (let r = r0; r <= w.r1; r++) h += rowHtml(r, false);
      const padBot = S.rowY[S.nR] - S.rowY[w.r1 + 1]; if (padBot > 0) h += `<tr class="sh-pad" aria-hidden="true"><td colspan="${S.nC + 1}" style="height:${padBot}px"></td></tr>`;
      h += '</tbody></table>';
      if (S.nR < F().MAX_ROW) h += `<div class="sh-more" role="row" aria-rowindex="${S.nR + 2}" style="top:${HH + S.rowY[S.nR] + 8}px"><div role="gridcell"><button type="button" class="btn sm" id="sh-more">${esc(t('Add 1,000 more rows'))}</button></div></div>`;
      tbl.innerHTML = h; sheetEl.style.width = totalW + 'px'; sheetEl.style.height = (HH + S.rowY[S.nR] + 52) + 'px';
      sc.setAttribute('aria-rowcount', String(S.nR + 1)); sc.setAttribute('aria-colcount', String(S.nC + 1)); sc.setAttribute('aria-label', sh().name);
      const more = $('#sh-more', tbl); if (more) more.addEventListener('click', () => { S.extraRows += 1000; render(true); });
      place(); paintCharts();
    }
    let scrollQ = 0; sc.addEventListener('scroll', () => { cancelAnimationFrame(scrollQ); scrollQ = requestAnimationFrame(() => render(false)); });
    const ro = global.ResizeObserver ? new ResizeObserver(() => render(false)) : null; if (ro) ro.observe(sc);

    /* ---------- the selection ---------- */
    const range = () => ({ r0: Math.min(S.aR, S.fR), r1: Math.max(S.aR, S.fR), c0: Math.min(S.aC, S.fC), c1: Math.max(S.aC, S.fC) });
    const rect = (r0, c0, r1, c1) => ({ x: HW + S.colX[c0], y: HH + S.rowY[r0], w: S.colX[c1 + 1] - S.colX[c0], h: S.rowY[r1 + 1] - S.rowY[r0] });
    function place() {
      if (S.aR >= S.nR || S.aC >= S.nC || S.fR >= S.nR || S.fC >= S.nC) { sizes(); }
      const g = range(); const R = rect(g.r0, g.c0, g.r1, g.c1); const sel = $('#sh-sel', host); const multi = g.r0 !== g.r1 || g.c0 !== g.c1;
      sel.hidden = !multi; Object.assign(sel.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
      const a = rect(S.aR, S.aC, S.aR, S.aC); Object.assign($('#sh-act', host).style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' });
      Object.assign($('#sh-fill', host).style, { left: (R.x + R.w - 4) + 'px', top: (R.y + R.h - 4) + 'px' });
      $$('.sh-ch.on, .sh-rh.on', tbl).forEach(x => x.classList.remove('on')); $$('.sh-ch', tbl).forEach(x => { const c = +x.dataset.c; if (c >= g.c0 && c <= g.c1) x.classList.add('on'); }); $$('.sh-rh', tbl).forEach(x => { const r = +x.dataset.r; if (r >= g.r0 && r <= g.r1) x.classList.add('on'); });
      const td = $(`#sh-${S.aR}-${S.aC}`, tbl); if (td) sc.setAttribute('aria-activedescendant', td.id); else sc.removeAttribute('aria-activedescendant');
      $$('td[aria-selected]', tbl).forEach(x => x.removeAttribute('aria-selected')); if (multi && (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) < 2000) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const x = $(`#sh-${r}-${c}`, tbl); if (x) x.setAttribute('aria-selected', 'true'); }
      if (S.ed) placeEditor();
    }
    function paintBar() {
      const g = range(); nameBox.value = g.r0 === g.r1 && g.c0 === g.c1 ? A(S.aC, S.aR) : `${A(g.c0, g.r0)}:${A(g.c1, g.r1)}`;
      if (!S.ed) input.value = rawForEdit(S.aR, S.aC);
      const st = (cellOf(S.aR, S.aC) || {}).s || {};
      $('[data-c="fmt"]', bar).value = st.fmt || ''; ['b', 'i', 'u', 'wrap'].forEach(k => $(`[data-c="${k}"]`, bar).setAttribute('aria-pressed', String(!!st[k])));
      ['left', 'center', 'right'].forEach(k => $(`[data-c="${k}"]`, bar).setAttribute('aria-pressed', String(st.al === k)));
      $('[data-c="freeze"]', bar).setAttribute('aria-pressed', String(!!sh().freeze));
      // the numbers chosen: sum, average, count
      let n = 0, s = 0, cnt = 0; const cells = (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1);
      if (cells > 1 && cells <= 200000) for (const [a, v] of Object.entries(S.values[S.si])) { const p = F().parseAddr(a); if (p.r < g.r0 || p.r > g.r1 || p.c < g.c0 || p.c > g.c1) continue; if (v !== null && v !== '') cnt++; if (typeof v === 'number') { n++; s += v; } }
      $('#sh-stat', host).textContent = cells > 1 && n ? t('Sum {1} · Average {2} · Count {3}', F().show(+s.toPrecision(15)), F().show(+(s / n).toPrecision(15)), num(cnt)) : cells > 1 && cnt ? t('Count {1}', num(cnt)) : '';
    }
    function rawForEdit(r, c) { const cell = cellOf(r, c); if (!cell || cell.v == null) return ''; const raw = String(cell.v); if (fmtOf(cell) === 'date' && /^\d+(\.\d+)?$/.test(raw)) return F().show(+raw, 'date'); return raw; }
    function announce() { const v = shown(S.aR, S.aC); const raw = rawForEdit(S.aR, S.aC); live(`${A(S.aC, S.aR)}${v ? ': ' + v : ': ' + t('empty')}${raw[0] === '=' ? ' (' + raw + ')' : ''}`); }
    function go(r, c, extend) {
      r = Math.max(0, Math.min(F().MAX_ROW - 1, r)); c = Math.max(0, Math.min(F().MAX_COL - 1, c));
      if (extend) { S.fR = r; S.fC = c; } else { S.aR = S.fR = r; S.aC = S.fC = c; }
      S.chart = null; paintChartSel();
      if (r >= S.nR - 5 || c >= S.nC - 1) render(true); else place();
      reveal(extend ? S.fR : S.aR, extend ? S.fC : S.aC); paintBar(); if (!extend) announce(); else live(nameBox.value);
    }
    function reveal(r, c) {
      const R = rect(r, c, r, c); const frzH = sh().freeze ? rowH(0) : 0;
      if (R.x - HW < sc.scrollLeft) sc.scrollLeft = R.x - HW; else if (R.x + R.w > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = R.x + R.w - sc.clientWidth;
      if (!(sh().freeze && r === 0)) { if (R.y - HH - frzH < sc.scrollTop) sc.scrollTop = R.y - HH - frzH; else if (R.y + R.h > sc.scrollTop + sc.clientHeight) sc.scrollTop = R.y + R.h - sc.clientHeight; }
    }
    /** the edge of the data from (r, c) going (dr, dc), as Ctrl+arrow does */
    function edge(r, c, dr, dc) {
      const has = (rr, cc) => { const v = val(rr, cc); return v !== undefined && v !== null && v !== ''; }; const maxR = Math.max(S.nR, used().r + 1), maxC = Math.max(S.nC, used().c + 1);
      const inside = (rr, cc) => rr >= 0 && cc >= 0 && rr < maxR && cc < maxC; let nr = r + dr, nc = c + dc; if (!inside(nr, nc)) return [r, c];
      if (has(r, c) && has(nr, nc)) { while (inside(nr + dr, nc + dc) && has(nr + dr, nc + dc)) { nr += dr; nc += dc; } return [nr, nc]; }
      while (inside(nr, nc) && !has(nr, nc)) { if (!inside(nr + dr, nc + dc)) return [nr, nc]; nr += dr; nc += dc; } return [nr, nc];
    }

    /* ---------- undo ---------- */
    function push() { S.undo.push({ sheets: cloneSheets(B.sheets), si: S.si, aR: S.aR, aC: S.aC, fR: S.fR, fC: S.fC }); if (S.undo.length > 100) S.undo.shift(); S.redo = []; }
    function restore(x) { B.sheets = x.sheets; S.si = Math.min(x.si, B.sheets.length - 1); S.aR = x.aR; S.aC = x.aC; S.fR = x.fR; S.fC = x.fC; done(true); paintTabs(); }
    function undo() { cancelEdit(); if (!S.undo.length) { toast(t('Nothing to undo')); return; } S.redo.push({ sheets: cloneSheets(B.sheets), si: S.si, aR: S.aR, aC: S.aC, fR: S.fR, fC: S.fC }); restore(S.undo.pop()); live(t('Undone')); }
    function redo() { cancelEdit(); if (!S.redo.length) return; S.undo.push({ sheets: cloneSheets(B.sheets), si: S.si, aR: S.aR, aC: S.aC, fR: S.fR, fC: S.fC }); restore(S.redo.pop()); live(t('Redone')); }
    function setCell(a, cell, si = S.si) { const s = B.sheets[si]; if (!cell || ((cell.v == null || cell.v === '') && (!cell.s || !Object.keys(cell.s).length))) delete s.cells[a]; else s.cells[a] = cell; }
    function done() { S.usedC = null; recalc(); render(true); paintBar(); ctx.changed(); }

    /* ---------- typing in a cell ---------- */
    function startEdit(mode, text, from) {
      if (S.ed) return; S.chart = null; paintChartSel();
      const raw = text !== undefined ? text : rawForEdit(S.aR, S.aC);
      S.ed = { r: S.aR, c: S.aC, mode, from: from || 'cell', orig: rawForEdit(S.aR, S.aC), point: null };
      edit.hidden = false; edit.value = raw; input.value = raw;
      const st = (cellOf(S.aR, S.aC) || {}).s || {}; edit.style.fontWeight = st.b ? '700' : ''; edit.style.fontStyle = st.i ? 'italic' : ''; edit.style.textAlign = st.al || 'left'; edit.style.background = st.bg || '#fff'; edit.style.color = st.color || '';
      placeEditor();
      if (from === 'bar') { input.focus(); } else { edit.focus({ preventScroll: true }); const n = edit.value.length; edit.setSelectionRange(n, n); }
      sizeEditor();
    }
    function placeEditor() { if (!S.ed) return; const R = rect(S.ed.r, S.ed.c, S.ed.r, S.ed.c); Object.assign(edit.style, { left: R.x + 'px', top: R.y + 'px', minWidth: R.w + 'px', minHeight: R.h + 'px' }); }
    function sizeEditor() { edit.style.width = '0px'; edit.style.height = '0px'; const R = rect(S.ed.r, S.ed.c, S.ed.r, S.ed.c); edit.style.width = Math.min(Math.max(R.w, edit.scrollWidth + 8), Math.max(R.w, sc.clientWidth - (R.x - sc.scrollLeft) - 8)) + 'px'; edit.style.height = Math.max(R.h, edit.scrollHeight) + 'px'; }
    function cancelEdit() { if (!S.ed) return; S.ed = null; edit.hidden = true; edit.value = ''; paintBar(); place(); }
    /** what was typed → the cell: a formula tidied (names in capitals, brackets closed), a value's format remembered */
    function tidyFormula(s) {
      let out = s; try { const T = F().tokenize(s.slice(1)); let o = '=', at = 1; for (const k of T) { if (k.t !== 'fn' && k.t !== 'ref' && k.t !== 'bool') continue; o += s.slice(at, k.at + 1); const piece = s.slice(k.at + 1, k.end + 1); o += k.t === 'ref' ? piece.replace(/(\$?[a-z]{1,2}\$?\d{1,5})/gi, m => m.toUpperCase()) : piece.toUpperCase(); at = k.end + 1; } out = o + s.slice(at); } catch (e) {}
      const open = (out.match(/\(/g) || []).length - (out.match(/\)/g) || []).length; if (open > 0 && open < 10 && !/"[^"]*$/.test(out)) out += ')'.repeat(open);
      return out;
    }
    function commit(dr, dc) {
      if (!S.ed) return; let raw = edit.value; const E = S.ed; S.ed = null; edit.hidden = true;
      raw = raw.replace(/\r/g, ''); if (raw[0] === '=' && raw.length > 1) raw = tidyFormula(raw);
      if (raw !== E.orig) {
        push(); const a = A(E.c, E.r); const old = sh().cells[a] || {}; const st = Object.assign({}, old.s || {});
        if (raw[0] !== '=') { const lit = F().literal(raw); if (lit.fmt && !st.fmt) st.fmt = lit.fmt; }
        else if (!st.fmt) { const m = /^=\s*(TODAY|NOW|DATE)\s*\(/i.exec(raw); if (m) st.fmt = 'date'; }
        setCell(a, Object.assign({ v: raw }, Object.keys(st).length ? { s: st } : {}));
        if (st.wrap) fitRow(E.r);
        done();
      } else { paintBar(); place(); }
      go(E.r + (dr || 0), E.c + (dc || 0)); sc.focus({ preventScroll: true });
    }
    edit.addEventListener('input', () => { input.value = edit.value; sizeEditor(); S.ed && (S.ed.point = null); });
    input.addEventListener('input', () => { if (!S.ed) startEdit('edit', input.value, 'bar'); edit.value = input.value; sizeEditor(); S.ed.point = null; });
    function editorKeys(e, el) {
      if (!S.ed) return; const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const s = el.selectionStart; el.setRangeText('\n', s, el.selectionEnd, 'end'); edit.value = el.value; input.value = el.value; sizeEditor(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (mod && fillWithAll()) return; commit(e.shiftKey ? -1 : 1, 0); return; }
      if (e.key === 'Tab') { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); sc.focus({ preventScroll: true }); return; }
      if (e.key === 'F2') { e.preventDefault(); S.ed.mode = 'edit'; return; }
      if (S.ed.mode === 'enter' && edit.value[0] !== '=' && /^Arrow/.test(e.key) && !e.shiftKey) { e.preventDefault(); const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; commit(d[0], d[1]); }
    }
    edit.addEventListener('keydown', e => editorKeys(e, edit));
    input.addEventListener('keydown', e => { if (!S.ed && e.key === 'Enter') { e.preventDefault(); startEdit('edit', input.value, 'bar'); } editorKeys(e, input); if (!S.ed && e.key === 'Escape') { input.value = rawForEdit(S.aR, S.aC); sc.focus(); } });
    input.addEventListener('blur', () => { setTimeout(() => { if (S.ed && S.ed.from === 'bar' && document.activeElement !== input && document.activeElement !== edit && !sc.contains(document.activeElement)) commit(0, 0); }, 0); });
    edit.addEventListener('blur', () => { setTimeout(() => { if (S.ed && S.ed.from !== 'bar' && document.activeElement !== edit && document.activeElement !== input && !(document.activeElement && document.activeElement.closest('.of-menu, .of-pop, .of-dlg'))) commit(0, 0); }, 0); });
    /** while a formula is typed, a click on a cell writes it in (point mode) */
    function canPoint() {
      if (!S.ed) return false; const el = S.ed.from === 'bar' ? input : edit; const v = el.value; if (v[0] !== '=') return false;
      if (S.ed.point && el.selectionStart === S.ed.point.end) return true;
      const before = v.slice(0, el.selectionStart).replace(/\s+$/, ''); return /[=(,+\-*/^&<>:]$/.test(before);
    }
    function pointAt(r0, c0, r1, c1) {
      const el = S.ed.from === 'bar' ? input : edit; const ref = r0 === r1 && c0 === c1 ? A(c0, r0) : `${A(Math.min(c0, c1), Math.min(r0, r1))}:${A(Math.max(c0, c1), Math.max(r0, r1))}`;
      const p = S.ed.point; let s = el.selectionStart, e2 = el.selectionEnd; if (p && s === p.end) { s = p.start; e2 = p.end; }
      el.setRangeText(ref, s, e2, 'end'); S.ed.point = { start: s, end: s + ref.length }; edit.value = el.value; input.value = el.value; sizeEditor(); el.focus();
    }

    /* ---------- changes to cells ---------- */
    function eachSel(fn) { const g = range(); const n = (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1); if (n > 200000) { toast(t('That is too many cells at once.')); return false; } for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) fn(r, c, A(c, r)); return true; }
    function style(patch) {
      cancelEdit(); push(); eachSel((r, c, a) => { const cell = sh().cells[a] || {}; const st = Object.assign({}, cell.s || {}, patch); Object.keys(st).forEach(k => { if (st[k] === '' || st[k] === false || st[k] == null) delete st[k]; }); setCell(a, Object.assign({}, cell, { v: cell.v == null ? '' : cell.v, s: st })); });
      if (patch.wrap) { const g = range(); for (let r = g.r0; r <= g.r1 && r < g.r0 + 500; r++) fitRow(r); }
      done();
    }
    function toggle(k) { const st = (cellOf(S.aR, S.aC) || {}).s || {}; style({ [k]: !st[k] }); }
    function clear() { cancelEdit(); push(); eachSel((r, c, a) => { const cell = sh().cells[a]; if (cell) setCell(a, cell.s ? { v: '', s: cell.s } : null); }); done(); live(t('Cleared')); }
    function fitRow(r) {   // a row as tall as its wrapped text needs
      const m = measurer(); let need = DEF_H;
      for (let c = 0; c < S.nC; c++) { const cell = cellOf(r, c); if (!cell || !cell.s || !cell.s.wrap) continue; const txt = shown(r, c); if (!txt) continue; m.style.width = (colW(c) - 8) + 'px'; m.style.fontWeight = cell.s.b ? '700' : ''; m.textContent = txt; need = Math.max(need, Math.ceil(m.scrollHeight) + 6); }
      if (need > DEF_H) sh().rows[r] = Math.min(400, need); else if (sh().rows[r] && sh().rows[r] < DEF_H + 1) delete sh().rows[r];
    }
    let meas = null; function measurer() { if (!meas) { meas = document.createElement('div'); meas.className = 'sh-measure'; document.body.appendChild(meas); } return meas; }
    function fitCol(c) {   // a column as wide as what it shows
      const g = document.createElement('canvas').getContext('2d'); let w = 40;
      for (const a of Object.keys(sh().cells)) { const p = F().parseAddr(a); if (!p || p.c !== c) continue; const st = (sh().cells[a].s) || {}; g.font = `${st.b ? '700 ' : ''}${st.i ? 'italic ' : ''}14.6px Calibri, Carlito, 'Segoe UI', Arial, sans-serif`; w = Math.max(w, g.measureText(shown(p.r, p.c)).width + 14); }
      push(); sh().cols[c] = Math.min(600, Math.ceil(w)); done();
    }

    /* ---------- copy, cut, paste ---------- */
    let CLIP = null; const marker = 'mathub-sheet-' + Math.random().toString(36).slice(2);
    function copy(e, cut) {
      const g = range(); if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 100000) { toast(t('That is too many cells at once.')); return; }
      const rows = [], html = [];
      for (let r = g.r0; r <= g.r1; r++) { const tr = [], th = []; for (let c = g.c0; c <= g.c1; c++) { const s = shown(r, c); tr.push(/[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s); th.push(`<td>${esc(s)}</td>`); } rows.push(tr.join('\t')); html.push(`<tr>${th.join('')}</tr>`); }
      const cells = []; for (let r = g.r0; r <= g.r1; r++) { const row = []; for (let c = g.c0; c <= g.c1; c++) row.push(cellOf(r, c) || null); cells.push(row); }
      CLIP = { cells, r: g.r0, c: g.c0, si: S.si, cut: !!cut, g };
      e.clipboardData.setData('text/plain', rows.join('\r\n')); e.clipboardData.setData('text/html', `<meta name="generator" content="${marker}"><table>${html.join('')}</table>`); e.preventDefault();
      live(cut ? t('Cut') : t('Copied')); $('#sh-sel', host).classList.add('ants');
    }
    function paste(e) {
      const h = e.clipboardData.getData('text/html'), p = e.clipboardData.getData('text/plain'); e.preventDefault(); cancelEdit();
      let grid = null, own = CLIP && h && h.includes(marker);
      if (!own) {
        if (h && /<table/i.test(h)) { const d = new DOMParser().parseFromString(h, 'text/html'); const tb = d.querySelector('table'); grid = [...tb.rows].map(tr => [...tr.cells].map(td => td.textContent.replace(/\u00a0/g, ' ').trim())); }
        else if (p) grid = tsv(p);
        if (!grid || !grid.length) return;
      }
      push(); const r0 = S.aR, c0 = S.aC; let h2 = 0, w2 = 0;
      if (own) {
        const C = CLIP; h2 = C.cells.length; w2 = C.cells[0].length;
        if (C.cut) for (let r = 0; r < h2; r++) for (let c = 0; c < w2; c++) setCell(A(C.c + c, C.r + r), null, C.si);
        for (let r = 0; r < h2; r++) for (let c = 0; c < w2; c++) { const cell = C.cells[r][c]; const R = r0 + r, Cc = c0 + c; if (R >= F().MAX_ROW || Cc >= F().MAX_COL) continue; if (!cell) { setCell(A(Cc, R), null); continue; } const v = String(cell.v == null ? '' : cell.v); setCell(A(Cc, R), Object.assign({}, cell, { v: v[0] === '=' && !C.cut ? F().translate(v, R - (C.r + r), Cc - (C.c + c)) : v })); }
        if (C.cut) CLIP = null;
      } else {
        h2 = grid.length; w2 = Math.max(...grid.map(r => r.length));
        grid.forEach((row, r) => row.forEach((v, c) => { const R = r0 + r, Cc = c0 + c; if (R >= F().MAX_ROW || Cc >= F().MAX_COL) return; const old = sh().cells[A(Cc, R)]; const lit = F().literal(v); const st = Object.assign({}, (old && old.s) || {}); if (lit.fmt && !st.fmt) st.fmt = lit.fmt; setCell(A(Cc, R), v === '' && !old ? null : Object.assign({ v }, Object.keys(st).length ? { s: st } : {})); }));
      }
      S.aR = r0; S.aC = c0; S.fR = Math.min(F().MAX_ROW - 1, r0 + h2 - 1); S.fC = Math.min(F().MAX_COL - 1, c0 + w2 - 1); $('#sh-sel', host).classList.remove('ants');
      done(); live(t('Pasted {1} by {2}', h2, w2));
    }
    function tsv(text) {   // tab-separated, with Excel's quotes around cells that hold tabs, line breaks or quotes
      const rows = []; let row = [], f = '', q = false; text = text.replace(/\r\n?/g, '\n'); if (text.endsWith('\n')) text = text.slice(0, -1);
      for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; } if (ch === '"' && f === '') { q = true; continue; } if (ch === '\t') { row.push(f); f = ''; continue; } if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; continue; } f += ch; }
      row.push(f); rows.push(row); return rows;
    }
    const clipOn = () => document.activeElement === sc && !S.ed;
    const onCopy = e => { if (clipOn()) copy(e, false); }, onCut = e => { if (clipOn()) { copy(e, true); } }, onPaste = e => { if (clipOn()) paste(e); };
    document.addEventListener('copy', onCopy); document.addEventListener('cut', onCut); document.addEventListener('paste', onPaste);

    /* ---------- filling ---------- */
    /** fills the target block from the source block: formulas move, numbers count on, "Item 1" goes to "Item 2" */
    function fill(src, dst) {
      const down = dst.r1 > src.r1 || dst.r0 < src.r0; const sizeAlong = down ? src.r1 - src.r0 + 1 : src.c1 - src.c0 + 1;
      push();
      for (let r = dst.r0; r <= dst.r1; r++) for (let c = dst.c0; c <= dst.c1; c++) {
        if (r >= src.r0 && r <= src.r1 && c >= src.c0 && c <= src.c1) continue;
        const k = down ? ((r - src.r0) % sizeAlong + sizeAlong) % sizeAlong : ((c - src.c0) % sizeAlong + sizeAlong) % sizeAlong;
        const sr = down ? src.r0 + k : r, scc = down ? c : src.c0 + k; const cell = cellOf(sr, scc);
        if (!cell) { setCell(A(c, r), null); continue; }
        const v = String(cell.v == null ? '' : cell.v); let out = v;
        if (v[0] === '=') out = F().translate(v, r - sr, c - scc);
        else {
          const line = []; for (let j = 0; j < sizeAlong; j++) { const x = down ? val(src.r0 + j, c) : val(r, src.c0 + j); line.push(x); }
          const step = down ? (r - src.r0) : (c - src.c0);   // the position along the fill, from the start of the source
          if (line.every(x => typeof x === 'number') && (sizeAlong > 1 || fmtOf(cell) === 'date')) {
            const d = sizeAlong > 1 ? (line[sizeAlong - 1] - line[0]) / (sizeAlong - 1) : 1; const n = +(line[0] + d * step).toPrecision(15);
            out = fmtOf(cell) === 'date' ? F().show(n, 'date') : fmtOf(cell) === 'pct' ? +(n * 100).toPrecision(15) + '%' : fmtOf(cell) === 'usd' ? (n < 0 ? '-$' : '$') + Math.abs(n) : String(n);
          } else if (sizeAlong === 1 && typeof line[0] === 'string') { const m = /^(.*?)(\d+)$/.exec(v); if (m && v[0] !== "'") out = m[1] + (+m[2] + step); }
        }
        setCell(A(c, r), Object.assign({}, cell, { v: out }));
      }
      done();
    }
    function fillDir(dir) { const g = range(); if (dir === 'down') { if (g.r0 === g.r1) { if (g.r0 === 0) return; fill({ r0: g.r0 - 1, r1: g.r0 - 1, c0: g.c0, c1: g.c1 }, { r0: g.r0 - 1, r1: g.r1, c0: g.c0, c1: g.c1 }); } else copyRow(g); } else { if (g.c0 === g.c1) { if (g.c0 === 0) return; fill({ r0: g.r0, r1: g.r1, c0: g.c0 - 1, c1: g.c0 - 1 }, { r0: g.r0, r1: g.r1, c0: g.c0 - 1, c1: g.c1 }); } else copyCol(g); } }
    function copyRow(g) { // Ctrl+D on a block: the top row of the block, copied down it
      push(); for (let r = g.r0 + 1; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const cell = cellOf(g.r0, c); if (!cell) { setCell(A(c, r), null); continue; } const v = String(cell.v == null ? '' : cell.v); setCell(A(c, r), Object.assign({}, cell, { v: v[0] === '=' ? F().translate(v, r - g.r0, 0) : v })); } done();
    }
    function copyCol(g) { push(); for (let c = g.c0 + 1; c <= g.c1; c++) for (let r = g.r0; r <= g.r1; r++) { const cell = cellOf(r, g.c0); if (!cell) { setCell(A(c, r), null); continue; } const v = String(cell.v == null ? '' : cell.v); setCell(A(c, r), Object.assign({}, cell, { v: v[0] === '=' ? F().translate(v, 0, c - g.c0) : v })); } done(); }
    function fillWithAll() {   // Ctrl+Enter: what was typed goes into every chosen cell
      const g = range(); if (g.r0 === g.r1 && g.c0 === g.c1) return false; const raw = edit.value; const E = S.ed; S.ed = null; edit.hidden = true; push();
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const old = cellOf(r, c) || {}; setCell(A(c, r), Object.assign({}, old, { v: raw[0] === '=' ? F().translate(raw, r - E.r, c - E.c) : raw })); }
      done(); sc.focus(); return true;
    }

    /* ---------- rows and columns ---------- */
    function moveCells(axis, at, n) {   // inserting (n > 0) or deleting (n < 0) rows or columns on this sheet; formulas everywhere follow
      const s = sh(); const out = {};
      for (const [a, cell] of Object.entries(s.cells)) { const p = F().parseAddr(a); if (!p) continue; let k = axis === 'r' ? p.r : p.c; if (n < 0 && k >= at && k < at - n) continue; if (k >= at) k += n; if (k < 0 || k >= (axis === 'r' ? F().MAX_ROW : F().MAX_COL)) continue; out[axis === 'r' ? A(p.c, k) : A(k, p.r)] = cell; }
      s.cells = out;
      B.sheets.forEach(o => { for (const [a, cell] of Object.entries(o.cells)) { const v = cell && String(cell.v == null ? '' : cell.v); if (v && v[0] === '=') { const w = F().shift(v, axis, at, n, s.name, o.name); if (w !== v) o.cells[a] = Object.assign({}, cell, { v: w }); } } (o.charts || []).forEach(ch => { if (o !== s) return; const w = F().shift('=' + ch.range, axis, at, n, s.name, o.name); if (/#REF!/.test(w)) ch.range = 'A1'; else ch.range = w.slice(1); }); });
      const sz = axis === 'r' ? s.rows : s.cols; const ns = {}; Object.keys(sz).forEach(k => { let i = +k; if (n < 0 && i >= at && i < at - n) return; if (i >= at) i += n; if (i >= 0) ns[i] = sz[k]; }); if (axis === 'r') s.rows = ns; else s.cols = ns;
    }
    function rowsCols(op) {
      cancelEdit(); const g = range(); const nr = g.r1 - g.r0 + 1, nc = g.c1 - g.c0 + 1; push();
      if (op === 'rowAbove') moveCells('r', g.r0, nr); else if (op === 'rowBelow') { moveCells('r', g.r1 + 1, nr); S.aR = S.fR = g.r1 + 1; }
      else if (op === 'colLeft') moveCells('c', g.c0, nc); else if (op === 'colRight') { moveCells('c', g.c1 + 1, nc); S.aC = S.fC = g.c1 + 1; }
      else if (op === 'delRow') { moveCells('r', g.r0, -nr); S.fR = S.aR = g.r0; } else if (op === 'delCol') { moveCells('c', g.c0, -nc); S.fC = S.aC = g.c0; }
      done(); live({ rowAbove: t('Row added'), rowBelow: t('Row added'), colLeft: t('Column added'), colRight: t('Column added'), delRow: t('Rows deleted'), delCol: t('Columns deleted') }[op]);
    }

    /* ---------- sort ---------- */
    function region(r, c) {   // the block of filled cells around (r, c), as Excel's current region
      let r0 = r, r1 = r, c0 = c, c1 = c; const has = (rr, cc) => rr >= 0 && cc >= 0 && !!cellOf(rr, cc) && cellOf(rr, cc).v !== '' && cellOf(rr, cc).v != null;
      for (let grew = true, k = 0; grew && k < 20000; k++) { grew = false;
        if (r0 > 0 && [...Array(c1 - c0 + 3)].some((_, i) => has(r0 - 1, c0 - 1 + i))) { r0--; grew = true; } if ([...Array(c1 - c0 + 3)].some((_, i) => has(r1 + 1, c0 - 1 + i))) { r1++; grew = true; }
        if (c0 > 0 && [...Array(r1 - r0 + 3)].some((_, i) => has(r0 - 1 + i, c0 - 1))) { c0--; grew = true; } if ([...Array(r1 - r0 + 3)].some((_, i) => has(r0 - 1 + i, c1 + 1))) { c1++; grew = true; } }
      return { r0, r1, c0, c1 };
    }
    function sort(desc) {
      cancelEdit(); let g = range(); const one = g.r0 === g.r1 && g.c0 === g.c1; if (one || g.r0 === g.r1) g = region(S.aR, S.aC);
      if (g.r1 <= g.r0) { toast(t('There is nothing to sort here.')); return; }
      const key = Math.max(g.c0, Math.min(g.c1, S.aC));
      const firstAllText = [...Array(g.c1 - g.c0 + 1)].every((_, i) => { const v = val(g.r0, g.c0 + i); return v === undefined || v === null || typeof v === 'string'; });
      // a header row, as Excel sees one: words on top of a column that has numbers (or TRUE/FALSE) under them
      const head = firstAllText && [...Array(g.c1 - g.c0 + 1)].some((_, i) => { const c = g.c0 + i; if (typeof val(g.r0, c) !== 'string') return false; for (let r = g.r0 + 1; r <= g.r1; r++) { const v = val(r, c); if (typeof v === 'number' || typeof v === 'boolean') return true; } return false; });
      const r0 = head ? g.r0 + 1 : g.r0; const rows = []; for (let r = r0; r <= g.r1; r++) rows.push(r);
      const rank = v => v === undefined || v === null || v === '' ? 9 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 3 : 4;
      const cmp = (x, y) => { const a = val(x, key), b = val(y, key); const ra = rank(a), rb = rank(b); if (ra === 9 || rb === 9) return ra === rb ? x - y : ra === 9 ? 1 : -1; if (ra !== rb) return (desc ? -1 : 1) * (ra - rb); let d = 0; if (ra === 2) d = String(a).localeCompare(String(b), App.lang || 'en', { sensitivity: 'base', numeric: true }); else d = a < b ? -1 : a > b ? 1 : 0; return (desc ? -d : d) || x - y; };
      const order = rows.slice().sort(cmp); push();
      const moved = order.map((from, i) => { const to = rows[i]; const row = []; for (let c = g.c0; c <= g.c1; c++) { const cell = cellOf(from, c); row.push(cell ? Object.assign({}, cell, { v: String(cell.v == null ? '' : cell.v)[0] === '=' ? F().translate(String(cell.v), to - from, 0) : cell.v }) : null); } return { to, row }; });
      moved.forEach(({ to, row }) => row.forEach((cell, i) => setCell(A(g.c0 + i, to), cell)));
      done(); toast(head ? t('Sorted rows {1}–{2} by column {3} (row {4} kept as the header)', r0 + 1, g.r1 + 1, F().colName(key), g.r0 + 1) : t('Sorted rows {1}–{2} by column {3}', r0 + 1, g.r1 + 1, F().colName(key)), 4000);
    }

    /* ---------- AutoSum ---------- */
    function autoSum(fn) {
      cancelEdit(); const g = range(); fn = fn || 'SUM';
      if (g.r0 === g.r1 && g.c0 === g.c1) {
        const r = S.aR, c = S.aC; let k = r - 1; while (k >= 0 && typeof val(k, c) === 'number') k--; if (k < r - 1) { startEdit('edit', `=${fn}(${A(c, k + 1)}:${A(c, r - 1)})`); return; }
        k = c - 1; while (k >= 0 && typeof val(r, k) === 'number') k--; if (k < c - 1) { startEdit('edit', `=${fn}(${A(k + 1, r)}:${A(c - 1, r)})`); return; }
        startEdit('edit', `=${fn}()`); const el = edit; el.setSelectionRange(el.value.length - 1, el.value.length - 1); return;
      }
      push(); for (let c = g.c0; c <= g.c1; c++) setCell(A(c, g.r1 + 1), { v: `=${fn}(${A(c, g.r0)}:${A(c, g.r1)})`, s: Object.assign({}, (cellOf(g.r1, c) || {}).s || {}) }); done(); go(g.r1 + 1, g.c0);
    }

    /* ---------- sheets ---------- */
    function paintTabs() {   // the same tabs are updated in place, so a double-click that first switched sheets still lands on its tab
      const box = $('#sh-tabs', host), old = $$('.sh-tab', box);
      if (old.length !== B.sheets.length) { box.innerHTML = B.sheets.map((s, i) => `<button type="button" role="tab" class="sh-tab" data-i="${i}" translate="no">${esc(s.name)}</button>`).join(''); }
      $$('.sh-tab', box).forEach((b, i) => { if (b.textContent !== B.sheets[i].name) b.textContent = B.sheets[i].name; b.classList.toggle('on', i === S.si); b.setAttribute('aria-selected', String(i === S.si)); b.tabIndex = i === S.si ? 0 : -1; });
    }
    function goSheet(i) { cancelEdit(); S.si = Math.max(0, Math.min(B.sheets.length - 1, i)); B.active = S.si; S.aR = S.aC = S.fR = S.fC = 0; S.extraRows = 0; S.win = null; sc.scrollTop = 0; sc.scrollLeft = 0; render(true); paintTabs(); paintBar(); live(t('Sheet {1}', sh().name)); }
    async function renameSheet(i) {
      const s = B.sheets[i]; const v = await KIT().dialog({ title: t('Rename the sheet'), fields: [{ name: 'n', label: t('Name'), value: s.name, maxlength: 31 }], ok: t('Rename'), check: v => { const n = O().sheetName(v.n); if (!v.n.trim()) return t('Write a name.'); if (B.sheets.some((o, j) => j !== i && o.name.toLowerCase() === n.toLowerCase())) return t('Another sheet has that name.'); return ''; } });
      if (!v) return; const n = O().sheetName(v.n); if (n === s.name) return; push(); const old = s.name; s.name = n;
      B.sheets.forEach(o => { for (const [a, cell] of Object.entries(o.cells)) { const f = String(cell.v == null ? '' : cell.v); if (f[0] === '=' && f.toLowerCase().includes(old.toLowerCase().replace(/'/g, "''"))) { const w = renameRefs(f, old, n); if (w !== f) o.cells[a] = Object.assign({}, cell, { v: w }); } } });
      done(); paintTabs();
    }
    /** a formula's references to sheet `old` pointed at `neu` (quoted when the name needs it); text in quotes untouched */
    function renameRefs(f, old, neu) {
      let T; try { T = F().tokenize(f.slice(1)); } catch (e) { return f; }
      const q = x => /^[A-Za-z_][A-Za-z0-9_]*$/.test(x) && !/^[A-Z]{1,2}\d+$/i.test(x) ? x : `'${x.replace(/'/g, "''")}'`;
      let out = '=', at = 1;
      for (const k of T) {
        if (k.t !== 'ref' || !k.sheet || k.sheet.toLowerCase() !== old.toLowerCase()) continue;
        const piece = f.slice(k.at + 1, k.end + 1); let cut = 0;
        if (piece[0] === "'") { let i = 1; for (; i < piece.length; i++) { if (piece[i] === "'") { if (piece[i + 1] === "'") { i++; continue; } break; } } cut = i + 1; } else cut = piece.indexOf('!');
        out += f.slice(at, k.at + 1) + q(neu) + piece.slice(cut); at = k.end + 1;
      }
      return out + f.slice(at);
    }
    function addSheet() { cancelEdit(); push(); const taken = new Set(B.sheets.map(s => s.name.toLowerCase())); let k = B.sheets.length + 1; let n = t('Sheet{1}', k); while (taken.has(n.toLowerCase())) n = t('Sheet{1}', ++k); B.sheets.push({ name: n, cells: {}, cols: {}, rows: {}, freeze: 0, charts: [] }); recalc(); goSheet(B.sheets.length - 1); ctx.changed(); }
    function dupSheet(i) { push(); const s = B.sheets[i]; const taken = new Set(B.sheets.map(x => x.name.toLowerCase())); const c = cloneSheets([s])[0]; c.name = O().sheetName(t('Copy of {1}', s.name), taken); B.sheets.splice(i + 1, 0, c); recalc(); goSheet(i + 1); ctx.changed(); }
    async function delSheet(i) { if (B.sheets.length === 1) { toast(t('A spreadsheet needs one sheet.')); return; } if (!await KIT().confirmBox(t('Delete the sheet “{1}”?', B.sheets[i].name), t('Formulas on other sheets that use it will show #REF!. Ctrl+Z brings it back.'), t('Delete'), true)) return; push(); B.sheets.splice(i, 1); recalc(); goSheet(Math.min(i, B.sheets.length - 1)); done(); }
    function moveSheet(i, to) { if (to < 0 || to >= B.sheets.length) return; push(); const [s] = B.sheets.splice(i, 1); B.sheets.splice(to, 0, s); recalc(); goSheet(to); ctx.changed(); }
    $('#sh-tabs', host).addEventListener('click', e => { const b = e.target.closest('.sh-tab'); if (b && +b.dataset.i !== S.si) goSheet(+b.dataset.i); });
    $('#sh-tabs', host).addEventListener('dblclick', e => { const b = e.target.closest('.sh-tab'); if (b) renameSheet(+b.dataset.i); });
    $('#sh-tabs', host).addEventListener('contextmenu', e => { const b = e.target.closest('.sh-tab'); if (!b) return; e.preventDefault(); const i = +b.dataset.i; if (i !== S.si) goSheet(i); sheetMenu($(`.sh-tab[data-i="${i}"]`, host), i); });
    $('#sh-tabs', host).addEventListener('keydown', e => { const b = e.target.closest('.sh-tab'); if (!b) return; const i = +b.dataset.i; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + B.sheets.length) % B.sheets.length; goSheet(j); $(`.sh-tab[data-i="${j}"]`, host).focus(); } else if (e.key === 'F2') { e.preventDefault(); renameSheet(i); } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); sheetMenu(b, i); } });
    const sheetMenu = (b, i) => KIT().menu(b, [{ label: t('Rename'), icon: 'pen', run: () => renameSheet(i) }, { label: t('Make a copy'), icon: 'copy', run: () => dupSheet(i) }, { label: t('Move left'), icon: 'left', disabled: i === 0, run: () => moveSheet(i, i - 1) }, { label: t('Move right'), icon: 'right', disabled: i === B.sheets.length - 1, run: () => moveSheet(i, i + 1) }, { sep: true }, { label: t('Delete'), icon: 'trash', danger: true, disabled: B.sheets.length === 1, run: () => delSheet(i) }], { label: B.sheets[i].name });
    $('#sh-addsheet', host).addEventListener('click', addSheet);

    /* ---------- charts ---------- */
    function paintCharts() {
      const layer = $('#sh-charts', host); const L = sh().charts || [];
      // inside the grid only rows may sit, so each chart is a row of one cell that says it is a chart
      if (L.length) layer.setAttribute('role', 'rowgroup'); else layer.removeAttribute('role');
      layer.innerHTML = L.map(ch => `<div role="row"><div class="sh-chart${S.chart === ch.id ? ' sel' : ''}" data-ch="${esc(ch.id)}" style="left:${HW + ch.x}px;top:${HH + ch.y}px;width:${ch.w}px;height:${ch.h}px" tabindex="0" role="gridcell" aria-roledescription="${esc(t('chart'))}" aria-label="${esc(CH().describe(ch, sh(), S.values[S.si]))}">${CH().svg(ch, sh(), S.values[S.si], { empty: t('No numbers in this range yet') }).replace(' role="img"', ' aria-hidden="true"')}${S.chart === ch.id ? ['nw', 'ne', 'se', 'sw'].map(h => `<i class="h ${h}" data-h="${h}"></i>`).join('') : ''}</div></div>`).join('');
    }
    function paintChartSel() { $$('.sh-chart', host).forEach(x => x.classList.toggle('sel', x.dataset.ch === S.chart)); if (S.chart) paintCharts(); }
    async function chartDialog(ch, isNew) {
      const v = await KIT().dialog({ title: isNew ? t('Make a chart') : t('Chart'), fields: [
        { name: 'type', label: t('Kind'), type: 'select', value: ch.type, options: CH().TYPES.map(([k, l]) => [k, t(l)]) },
        { name: 'range', label: t('Cells (the first column is the labels or x values)'), value: ch.range, maxlength: 20 },
        { name: 'title', label: t('Title'), value: ch.title || '', maxlength: 120 },
        { name: 'xTitle', label: t('Title under the bottom axis'), value: ch.xTitle || '', maxlength: 80 },
        { name: 'yTitle', label: t('Title beside the side axis'), value: ch.yTitle || '', maxlength: 80 },
        { name: 'trend', label: t('Line of best fit (scatter charts)'), type: 'select', value: ch.trend ? '1' : '', options: [['', t('No')], ['1', t('Yes, with its equation and R²')]] }
      ], ok: isNew ? t('Add the chart') : t('Save'), alt: isNew ? null : { label: t('Delete the chart'), value: 'delete' }, check: v => CH().parseRange(v.range) ? '' : t('Write cells like A1:B10.') });
      if (!v) return; push();
      if (v === 'delete') { sh().charts = sh().charts.filter(x => x !== ch && x.id !== ch.id); S.chart = null; done(); return; }
      const rr = CH().parseRange(v.range); Object.assign(ch, { type: v.type, range: `${A(rr.c1, rr.r1)}:${A(rr.c2, rr.r2)}`, title: v.title.trim(), xTitle: v.xTitle.trim(), yTitle: v.yTitle.trim(), trend: !!v.trend });
      if (isNew) sh().charts.push(ch); S.chart = ch.id; done(); live(t('Chart: {1}', CH().describe(ch, sh(), S.values[S.si])));
    }
    function newChart(type) {
      cancelEdit(); let g = range(); if (g.r0 === g.r1 && g.c0 === g.c1) g = region(S.aR, S.aC);
      if (g.r1 - g.r0 < 1) { toast(t('Choose the cells to chart first: a column of labels or x values, then the numbers.'), 4500); return; }
      const R = rect(g.r0, g.c1 + 1, g.r0, g.c1 + 1); const x = Math.max(0, R.x - HW + 16), y = Math.max(0, R.y - HH);
      chartDialog({ id: 'c' + Date.now().toString(36), type, range: `${A(g.c0, g.r0)}:${A(g.c1, g.r1)}`, title: '', trend: type === 'scatter', x, y, w: 440, h: 290 }, true);
    }
    $('#sh-charts', host).addEventListener('pointerdown', e => {
      const el = e.target.closest('.sh-chart'); if (!el) return; e.preventDefault(); e.stopPropagation(); commitIfEditing();
      const ch = (sh().charts || []).find(x => x.id === el.dataset.ch); if (!ch) return; if (S.chart !== ch.id) { S.chart = ch.id; paintCharts(); }
      const h = e.target.closest('.h'); const x0 = e.clientX, y0 = e.clientY; const start = Object.assign({}, ch); let moved = false;
      const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!moved && Math.hypot(dx, dy) < 3) return; if (!moved) { moved = true; push(); }
        if (!h) { ch.x = Math.max(0, start.x + dx); ch.y = Math.max(0, start.y + dy); } else { const d = h.dataset.h; if (d.includes('e')) ch.w = Math.max(200, start.w + dx); if (d.includes('s')) ch.h = Math.max(140, start.h + dy); if (d.includes('w')) { ch.w = Math.max(200, start.w - dx); ch.x = Math.max(0, start.x + start.w - ch.w); } if (d.includes('n')) { ch.h = Math.max(140, start.h - dy); ch.y = Math.max(0, start.y + start.h - ch.h); } }
        const node = $(`.sh-chart[data-ch="${CSS.escape(ch.id)}"]`, host); Object.assign(node.style, { left: HW + ch.x + 'px', top: HH + ch.y + 'px', width: ch.w + 'px', height: ch.h + 'px' }); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (moved) { paintCharts(); ctx.changed(); } const n = $(`.sh-chart[data-ch="${CSS.escape(ch.id)}"]`, host); if (n) n.focus({ preventScroll: true }); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    $('#sh-charts', host).addEventListener('dblclick', e => { const el = e.target.closest('.sh-chart'); if (!el) return; const ch = sh().charts.find(x => x.id === el.dataset.ch); if (ch) chartDialog(ch, false); });
    $('#sh-charts', host).addEventListener('keydown', e => { const el = e.target.closest('.sh-chart'); if (!el) return; const ch = sh().charts.find(x => x.id === el.dataset.ch); if (!ch) return; if (e.key === 'Enter') { e.preventDefault(); chartDialog(ch, false); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); push(); sh().charts = sh().charts.filter(x => x !== ch); S.chart = null; done(); sc.focus(); } else if (e.key === 'Escape') { S.chart = null; paintCharts(); sc.focus(); } else { const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (d) { e.preventDefault(); push(); const n = e.shiftKey ? 20 : 4; ch.x = Math.max(0, ch.x + d[0] * n); ch.y = Math.max(0, ch.y + d[1] * n); paintCharts(); ctx.changed(); const node = $(`.sh-chart[data-ch="${CSS.escape(ch.id)}"]`, host); if (node) node.focus(); } } });
    $('#sh-charts', host).addEventListener('focusin', e => { const el = e.target.closest('.sh-chart'); if (el && S.chart !== el.dataset.ch) { S.chart = el.dataset.ch; $$('.sh-chart', host).forEach(x => x.classList.toggle('sel', x === el)); } });
    function commitIfEditing() { if (S.ed) commit(0, 0); }

    /* ---------- pointer on the grid ---------- */
    const cellFrom = el => { const td = el && el.closest('td[data-c]'); if (!td || !tbl.contains(td)) return null; const tr = td.parentNode; return { r: +tr.dataset.r, c: +td.dataset.c }; };
    function autoscroll(ev) { const r = sc.getBoundingClientRect(); const dx = ev.clientX < r.left + HW ? -20 : ev.clientX > r.right - 20 ? 20 : 0, dy = ev.clientY < r.top + HH ? -20 : ev.clientY > r.bottom - 20 ? 20 : 0; if (dx || dy) { sc.scrollLeft += dx; sc.scrollTop += dy; } }
    sc.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.sh-chart, .sh-edit, .sh-more')) return;
      const rz = e.target.closest('[data-rz]');
      if (rz) {   // resizing a column or a row
        e.preventDefault(); const isCol = rz.classList.contains('sh-rz'); const k = +rz.dataset.rz; const x0 = e.clientX, y0 = e.clientY; const start = isCol ? colW(k) : rowH(k); let moved = false;
        const mv = ev => { const d = isCol ? ev.clientX - x0 : ev.clientY - y0; if (!moved && Math.abs(d) < 2) return; if (!moved) { moved = true; push(); } const v = Math.max(isCol ? 24 : 14, Math.min(isCol ? 800 : 400, Math.round(start + d))); if (isCol) sh().cols[k] = v; else sh().rows[k] = v; render(true); };
        const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (moved) { ctx.changed(); live(isCol ? t('Column {1}: {2} pixels', F().colName(k), colW(k)) : t('Row {1}: {2} pixels', k + 1, rowH(k))); } };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
      }
      const fh = e.target.closest('#sh-fill');
      if (fh) {   // the fill handle
        e.preventDefault(); const src = range(); let dst = Object.assign({}, src);
        const mv = ev => { autoscroll(ev); const at = cellFrom(document.elementFromPoint(ev.clientX, ev.clientY)); if (!at) return; const dr = at.r > src.r1 ? at.r - src.r1 : at.r < src.r0 ? at.r - src.r0 : 0, dc = at.c > src.c1 ? at.c - src.c1 : at.c < src.c0 ? at.c - src.c0 : 0; dst = Object.assign({}, src); if (Math.abs(dr) >= Math.abs(dc)) { if (dr > 0) dst.r1 = at.r; else if (dr < 0) dst.r0 = at.r; } else { if (dc > 0) dst.c1 = at.c; else if (dc < 0) dst.c0 = at.c; } const R = rect(dst.r0, dst.c0, dst.r1, dst.c1); Object.assign($('#sh-sel', host).style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' }); $('#sh-sel', host).hidden = false; };
        const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (dst.r0 !== src.r0 || dst.r1 !== src.r1 || dst.c0 !== src.c0 || dst.c1 !== src.c1) { fill(src, dst); S.aR = dst.r0; S.aC = dst.c0; S.fR = dst.r1; S.fC = dst.c1; place(); paintBar(); } else place(); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
      }
      const ch = e.target.closest('.sh-ch'), rh = e.target.closest('.sh-rh'), all = e.target.closest('[data-all]');
      if (all) { e.preventDefault(); commitIfEditing(); S.aR = S.aC = 0; S.fR = S.nR - 1; S.fC = S.nC - 1; place(); paintBar(); sc.focus({ preventScroll: true }); return; }
      if (ch || rh) {
        e.preventDefault(); commitIfEditing(); const k = ch ? +ch.dataset.c : +rh.dataset.r;
        if (ch) { if (!e.shiftKey) S.aC = k; S.aR = 0; S.fR = S.nR - 1; S.fC = k; } else { if (!e.shiftKey) S.aR = k; S.aC = 0; S.fC = S.nC - 1; S.fR = k; }
        place(); paintBar(); sc.focus({ preventScroll: true });
        const mv = ev => { autoscroll(ev); const el = document.elementFromPoint(ev.clientX, ev.clientY); const h2 = el && el.closest(ch ? '.sh-ch' : '.sh-rh'); if (h2) { if (ch) S.fC = +h2.dataset.c; else S.fR = +h2.dataset.r; place(); paintBar(); } };
        const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); live(nameBox.value); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
      }
      const at = cellFrom(e.target); if (!at) return;
      if (S.ed && canPoint()) { e.preventDefault(); const p0 = at; pointAt(p0.r, p0.c, p0.r, p0.c); const mv = ev => { const a2 = cellFrom(document.elementFromPoint(ev.clientX, ev.clientY)); if (a2) pointAt(p0.r, p0.c, a2.r, a2.c); }; const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return; }
      if (S.ed) commit(0, 0);
      e.preventDefault(); sc.focus({ preventScroll: true });
      if (e.shiftKey) { S.fR = at.r; S.fC = at.c; place(); paintBar(); return; }
      go(at.r, at.c);
      const mv = ev => { autoscroll(ev); const a2 = cellFrom(document.elementFromPoint(ev.clientX, ev.clientY)); if (a2 && (a2.r !== S.fR || a2.c !== S.fC)) { S.fR = a2.r; S.fC = a2.c; place(); paintBar(); } };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    sc.addEventListener('dblclick', e => { const rz = e.target.closest('[data-rz]'); if (rz) { if (rz.classList.contains('sh-rz')) fitCol(+rz.dataset.rz); else { push(); fitRow(+rz.dataset.rz); done(); } return; } const at = cellFrom(e.target); if (at && !S.ed) { go(at.r, at.c); startEdit('edit'); } });

    /* ---------- keys on the grid ---------- */
    sc.addEventListener('keydown', e => {
      if (S.ed || e.target !== sc) return; const mod = e.ctrlKey || e.metaKey; const k = e.key;
      const mv = (dr, dc) => { e.preventDefault(); if (mod) { const [r, c] = edge(e.shiftKey ? S.fR : S.aR, e.shiftKey ? S.fC : S.aC, dr, dc); go(r, c, e.shiftKey); } else go((e.shiftKey ? S.fR : S.aR) + dr, (e.shiftKey ? S.fC : S.aC) + dc, e.shiftKey); };
      if (k === 'ArrowUp') return mv(-1, 0); if (k === 'ArrowDown') return mv(1, 0); if (k === 'ArrowLeft') return mv(0, -1); if (k === 'ArrowRight') return mv(0, 1);
      if (k === 'Enter') { e.preventDefault(); const g = range(); if (g.r0 !== g.r1 || g.c0 !== g.c1) { let r = S.aR + (e.shiftKey ? -1 : 1), c = S.aC; if (r > g.r1) { r = g.r0; c = c + 1 > g.c1 ? g.c0 : c + 1; } if (r < g.r0) { r = g.r1; c = c - 1 < g.c0 ? g.c1 : c - 1; } S.aR = r; S.aC = c; place(); paintBar(); announce(); return; } go(S.aR + (e.shiftKey ? -1 : 1), S.aC); return; }
      if (k === 'Tab') { e.preventDefault(); go(S.aR, S.aC + (e.shiftKey ? -1 : 1)); return; }
      if (k === 'Home') { e.preventDefault(); go(mod ? 0 : S.aR, 0, e.shiftKey); return; }
      if (k === 'End') { e.preventDefault(); if (mod) { const u = used(); go(Math.max(0, u.r), Math.max(0, u.c), e.shiftKey); } else { let c = S.nC - 1; while (c > 0 && !cellOf(S.aR, c)) c--; go(S.aR, c, e.shiftKey); } return; }
      if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); const n = Math.max(1, Math.floor((sc.clientHeight - HH) / DEF_H) - 1); go(S.aR + (k === 'PageDown' ? n : -n), S.aC, e.shiftKey); return; }
      if (k === 'F2') { e.preventDefault(); startEdit('edit'); return; }
      if (k === 'F6') { e.preventDefault(); (e.shiftKey ? $('.sh-tab.on', host) : input).focus(); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clear(); return; }
      if (k === 'Escape') { CLIP = null; $('#sh-sel', host).classList.remove('ants'); return; }
      if (mod && !e.altKey) {
        const l = k.toLowerCase();
        if (l === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; } if (l === 'y') { e.preventDefault(); redo(); return; }
        if (l === 'b' || l === 'i' || l === 'u') { e.preventDefault(); toggle(l); return; }
        if (l === 'a') { e.preventDefault(); S.aR = S.aC = 0; S.fR = S.nR - 1; S.fC = S.nC - 1; place(); paintBar(); live(t('All cells chosen')); return; }
        if (l === 'd') { e.preventDefault(); fillDir('down'); return; } if (l === 'r') { e.preventDefault(); fillDir('right'); return; }
        if (l === 'f') { e.preventDefault(); findOpen(); return; }
        if (k === ';') { e.preventDefault(); const d = new Date(); startEdit('enter', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); return; }
        if (l === 's') { e.preventDefault(); KIT().save(); return; } if (l === 'p') { e.preventDefault(); print(); return; }
        if (k === ' ') { e.preventDefault(); S.aR = 0; S.fR = S.nR - 1; S.fC = S.aC; place(); paintBar(); return; }
        return;
      }
      if (e.shiftKey && k === ' ') { e.preventDefault(); S.aC = 0; S.fC = S.nC - 1; S.fR = S.aR; place(); paintBar(); return; }
      if (e.altKey && (k === '=' || e.code === 'Equal')) { e.preventDefault(); autoSum('SUM'); return; }
      if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit('enter', k); }
    });
    sc.addEventListener('focus', () => { if (!S.ed) announce(); });
    nameBox.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = nameBox.value.trim().toUpperCase(); const m = /^([A-Z]{1,2}\d{1,5})(?::([A-Z]{1,2}\d{1,5}))?$/.exec(v); const a = m && F().parseAddr(m[1]), b = m && m[2] ? F().parseAddr(m[2]) : a; if (!a || !b) { toast(t('Write a cell like B4, or cells like A1:C10.')); return; } S.aR = a.r; S.aC = a.c; S.fR = b.r; S.fC = b.c; render(true); reveal(b.r, b.c); reveal(a.r, a.c); paintBar(); sc.focus(); } else if (e.key === 'Escape') { paintBar(); sc.focus(); } });

    /* ---------- find ---------- */
    function findOpen() { $('#sh-find', host).hidden = false; $('#sh-q', host).focus(); $('#sh-q', host).select(); }
    function findGo(dir) {
      const q = $('#sh-q', host).value; if (!q) return; const cs = $('#sh-case', host).checked; const need = cs ? q : q.toLowerCase();
      const hits = []; for (const a of Object.keys(sh().cells)) { const p = F().parseAddr(a); if (!p) continue; const s1 = shown(p.r, p.c), s2 = String(sh().cells[a].v == null ? '' : sh().cells[a].v); if ((cs ? s1 : s1.toLowerCase()).includes(need) || (cs ? s2 : s2.toLowerCase()).includes(need)) hits.push(p); }
      hits.sort((x, y) => x.r - y.r || x.c - y.c); $('#sh-fcount', host).textContent = hits.length === 1 ? t('1 match') : t('{1} matches', num(hits.length)); if (!hits.length) return;
      const cur = hits.findIndex(p => p.r > S.aR || (p.r === S.aR && p.c > S.aC)); let i = dir > 0 ? (cur < 0 ? 0 : cur) : (() => { let j = -1; hits.forEach((p, k) => { if (p.r < S.aR || (p.r === S.aR && p.c < S.aC)) j = k; }); return j < 0 ? hits.length - 1 : j; })();
      go(hits[i].r, hits[i].c); $('#sh-fcount', host).textContent = t('{1} of {2}', num(i + 1), num(hits.length));
    }
    $('#sh-find', host).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; if (b.dataset.f === 'close') { $('#sh-find', host).hidden = true; sc.focus(); } else findGo(b.dataset.f === 'next' ? 1 : -1); });
    $('#sh-q', host).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findGo(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { $('#sh-find', host).hidden = true; sc.focus(); } });

    /* ---------- toolbar ---------- */
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b || b.tagName === 'SELECT') return; const c = b.dataset.c; commitIfEditing();
      if (c === 'undo') undo(); else if (c === 'redo') redo();
      else if (c === 'b' || c === 'i' || c === 'u' || c === 'wrap') toggle(c);
      else if (c === 'left' || c === 'center' || c === 'right') { const st = (cellOf(S.aR, S.aC) || {}).s || {}; style({ al: st.al === c ? '' : c }); }
      else if (c === 'color') KIT().colorPicker(b, { label: t('Text colour'), value: ((cellOf(S.aR, S.aC) || {}).s || {}).color, none: t('Automatic'), pick: v => { $('#sh-cbar', host).style.background = v || '#000'; style({ color: v }); } });
      else if (c === 'bg') KIT().colorPicker(b, { label: t('Fill colour'), value: ((cellOf(S.aR, S.aC) || {}).s || {}).bg, none: t('No fill'), pick: v => { $('#sh-bbar', host).style.background = v || 'transparent'; style({ bg: v }); } });
      else if (c === 'sum') KIT().menu(b, [['SUM', 'Sum'], ['AVERAGE', 'Average'], ['COUNT', 'Count numbers'], ['MIN', 'Smallest'], ['MAX', 'Largest']].map(([f, l]) => ({ label: t(l), run: () => autoSum(f) })), { label: t('AutoSum') });
      else if (c === 'sort') KIT().menu(b, [{ label: t('Sort A → Z (smallest first)'), icon: 'sortup', run: () => sort(false) }, { label: t('Sort Z → A (largest first)'), icon: 'sortdown', run: () => sort(true) }], { label: t('Sort') });
      else if (c === 'rows') KIT().menu(b, [{ label: t('Insert a row above'), icon: 'rowplus', run: () => rowsCols('rowAbove') }, { label: t('Insert a row below'), icon: 'rowplus', run: () => rowsCols('rowBelow') }, { label: t('Insert a column left'), icon: 'colplus', run: () => rowsCols('colLeft') }, { label: t('Insert a column right'), icon: 'colplus', run: () => rowsCols('colRight') }, { sep: true }, { label: t('Delete the rows'), icon: 'trash', danger: true, run: () => rowsCols('delRow') }, { label: t('Delete the columns'), icon: 'trash', danger: true, run: () => rowsCols('delCol') }, { sep: true }, { label: t('Fit the column to its text'), run: () => fitCol(S.aC) }], { label: t('Rows and columns') });
      else if (c === 'freeze') { push(); sh().freeze = sh().freeze ? 0 : 1; done(); live(sh().freeze ? t('Top row frozen') : t('Top row unfrozen')); }
      else if (c === 'chart') KIT().menu(b, CH().TYPES.map(([k, l]) => ({ label: t(l), icon: 'chart2', run: () => newChart(k) })), { label: t('Chart') });
      else if (c === 'find') findOpen();
    });
    bar.addEventListener('change', e => { if (e.target.dataset.c === 'fmt') { commitIfEditing(); style({ fmt: e.target.value }); sc.focus(); } });

    /* ---------- print and files ---------- */
    function sheetHtml(s, si) {
      let maxR = -1, maxC = -1; for (const a of Object.keys(s.cells)) { const p = F().parseAddr(a); if (p) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); } }
      let h = `<h2 class="of-print-h">${esc(s.name)}</h2>`;
      if (maxR >= 0) { h += `<table class="of-print-sheet"><colgroup>${[...Array(maxC + 1)].map((_, c) => `<col style="width:${+s.cols[c] || DEF_W}px">`).join('')}</colgroup>`; for (let r = 0; r <= maxR; r++) { h += '<tr>'; for (let c = 0; c <= maxC; c++) { const a = A(c, r), cell = s.cells[a], v = S.values[si][a], st = (cell && cell.s) || {}; const txt = v === undefined ? '' : F().show(v, fmtOf(cell)); const al = st.al || (typeof v === 'number' ? 'right' : 'left'); h += `<td style="text-align:${al};${st.b ? 'font-weight:700;' : ''}${st.i ? 'font-style:italic;' : ''}${st.u ? 'text-decoration:underline;' : ''}${st.color ? `color:${st.color};` : ''}${st.bg ? `background:${st.bg};` : ''}${st.wrap ? 'white-space:pre-wrap;' : ''}">${esc(txt)}</td>`; } h += '</tr>'; } h += '</table>'; }
      (s.charts || []).forEach(ch => { h += `<div class="of-print-chart">${CH().svg(ch, s, S.values[si])}</div>`; });
      return h;
    }
    function print() { commitIfEditing(); const wide = S.colX[Math.min(S.nC, used().c + 1)] > 700; KIT().printHtml(sheetHtml(sh(), S.si), ctx.title(), 'sheet', `@page { size: ${wide ? 'landscape' : 'portrait'}; margin: 0.5in; } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`); }
    async function xlsx() { try { commitIfEditing(); await KIT().save(); await KIT().download('sheet', { title: ctx.title() }, api.body()); } catch (e) { toast(t('That file could not be made here.'), 4500); } }
    function csv() { commitIfEditing(); App.Office.download(new Blob(['\uFEFF' + O().csvFromSheet(sh(), S.values[S.si])], { type: 'text/csv;charset=utf-8' }), App.Office.safeName(ctx.title() + (B.sheets.length > 1 ? ' - ' + sh().name : '')) + '.csv'); }
    async function importCsv() {
      const f = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,text/csv,.tsv,text/plain'; i.addEventListener('change', () => res(i.files && i.files[0])); i.click(); });
      if (!f) return; try { const book = O().bookFromCsv(await f.text(), KIT().stem(f.name)); const s = book.sheets[0]; s.name = O().sheetName(s.name, new Set(B.sheets.map(x => x.name.toLowerCase()))); s.freeze = 0; s.charts = []; push(); B.sheets.push(s); goSheet(B.sheets.length - 1); done(); toast(t('Added the sheet “{1}”', s.name)); } catch (e) { toast(t('That file could not be read.'), 4500); }
    }
    ctx.bar.innerHTML = `<button type="button" class="btn sm" id="sh-print" aria-label="${esc(t('Print'))}" title="${esc(t('Print'))}">${icon('print', 15)}</button><button type="button" class="btn sm" id="sh-file" data-menu aria-haspopup="menu" aria-expanded="false">${icon('download', 15)} <span>${esc(t('File'))}</span></button>`;
    $('#sh-print', ctx.bar).addEventListener('click', print);
    $('#sh-file', ctx.bar).addEventListener('click', e => KIT().menu(e.currentTarget, ctx.fileMenu([
      { label: t('Download as Excel (.xlsx)'), icon: 'download', run: xlsx }, { label: t('Download this sheet as CSV'), icon: 'file', run: csv }, { label: t('Print or save as PDF'), icon: 'print', key: K('Ctrl+P'), run: print }, { label: t('Add a sheet from a CSV file'), icon: 'upload', run: importCsv }, { sep: true }
    ]), { right: true, label: t('File') }));

    const api = {
      body: () => { if (S.ed) { /* what is being typed is not a change yet */ } return { active: S.si, sheets: B.sheets.map(s => ({ name: s.name, cells: s.cells, cols: s.cols, rows: s.rows, freeze: s.freeze ? 1 : 0, charts: s.charts || [] })) }; },
      focus: () => sc.focus(),
      unmount: () => { document.removeEventListener('copy', onCopy); document.removeEventListener('cut', onCut); document.removeEventListener('paste', onPaste); if (ro) ro.disconnect(); if (meas) meas.remove(); }
    };
    paintTabs(); render(true); paintBar(); setTimeout(() => { if (sc.isConnected) { render(true); sc.focus({ preventScroll: true }); } }, 30);
    return api;
  }
  App.OfficeEditors = App.OfficeEditors || {};
  App.OfficeEditors.sheet = { mount };
})(window);
