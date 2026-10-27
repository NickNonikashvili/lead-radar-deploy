/* ============================================================
   Mathub — Excel files for Sheets (assets/office-sheets.js): App.OOXML.xlsxFromBook, bookFromXlsx
   A workbook: { sheets: [{ name, cells: { A1: { v, s, c } }, cols: { 0: px }, rows: { 0: px }, freeze }], active }.
   v is what was typed ("=" for a formula), s its look { b, i, u, al, wrap, fmt, color, bg }, c the value a file came
   with (kept for a function Sheets does not have, so it still shows what Excel worked out).
   - Writing: every sheet's cells (numbers, text, true/false, formulas with the value Sheets worked out, so a reader
     that does not calculate still shows them; Excel calculates again when it opens the file), bold, italic, underline,
     text and fill colours, alignment and wrapping, number formats, column widths, row heights and a frozen top row.
   - Reading: the same back, from Excel, Google Sheets, Numbers and LibreOffice files: shared and inline text, shared
     formulas (written out for each cell), the 1904 date system, and number formats sorted into Sheets' own.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App;
  const O = () => App.OOXML; const K = () => App.Office; const F = () => App.Formula;
  const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const DEF_W = 100, DEF_H = 24;   // a column's and a row's size on screen, in px
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); return m ? 'FF' + m[1].toUpperCase() : null; };
  /** A sheet's name as Excel allows it: 1–31 characters, none of []:*?/\ and no ' at either end; unique in the book. */
  function sheetName(name, taken) {
    let n = String(name || '').replace(/[[\]:*?/\\\u0000-\u001F]/g, ' ').replace(/^'+|'+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
    const base = n; let k = 2; while (taken && taken.has(n.toLowerCase())) { const tail = ` (${k++})`; n = base.slice(0, 31 - tail.length) + tail; }
    return n;
  }

  /* ======================= writing ======================= */
  async function xlsxFromBook(book, opts = {}) {
    const X = O().X, XML = O().XML; const sheets = book.sheets && book.sheets.length ? book.sheets : [{ name: 'Sheet1', cells: {} }];
    const values = F().evaluate({ sheets });
    // styles: each different look is one cellXfs entry
    const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'], fontKey = { '': 0 };
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], fillKey = { '': 0 };
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], xfKey = { '0|0|0||': 0 };
    const numFmt = (fmt, v) => ({ num: 4, int: 3, usd: 165, date: 164 })[fmt] || (fmt === 'pct' ? (typeof v === 'number' && Number.isInteger(+(v * 100).toFixed(8)) ? 9 : 10) : 0);
    function xfOf(s, v) {
      s = s || {}; const nf = numFmt(s.fmt, v);
      const fk = [s.b ? 'b' : '', s.i ? 'i' : '', s.u ? 'u' : '', hex(s.color) || ''].join('|'); let fi = fontKey[fk === '|||' ? '' : fk];
      if (fi === undefined) { fi = fonts.length; fontKey[fk] = fi; fonts.push(`<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.u ? '<u/>' : ''}<sz val="11"/>${hex(s.color) ? `<color rgb="${hex(s.color)}"/>` : '<color theme="1"/>'}<name val="Calibri"/><family val="2"/><scheme val="minor"/></font>`); }
      const bg = hex(s.bg) || ''; let li = fillKey[bg]; if (li === undefined) { li = fills.length; fillKey[bg] = li; fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${bg}"/><bgColor indexed="64"/></patternFill></fill>`); }
      const al = ['left', 'center', 'right'].includes(s.al) ? s.al : ''; const key = `${nf}|${fi}|${li}|${al}|${s.wrap ? 1 : ''}`;
      let x = xfKey[key]; if (x !== undefined) return x;
      x = xfs.length; xfKey[key] = x;
      xfs.push(`<xf numFmtId="${nf}" fontId="${fi}" fillId="${li}" borderId="0" xfId="0"${nf ? ' applyNumberFormat="1"' : ''}${fi ? ' applyFont="1"' : ''}${li ? ' applyFill="1"' : ''}${al || s.wrap ? ` applyAlignment="1"><alignment${al ? ` horizontal="${al}"` : ''}${s.wrap ? ' wrapText="1"' : ''}/></xf>` : '/>'}`);
      return x;
    }
    const strings = [], strIdx = new Map(); const sst = t => { let i = strIdx.get(t); if (i === undefined) { i = strings.length; strings.push(t); strIdx.set(t, i); } return i; };
    const taken = new Set(); const names = sheets.map(s => { const n = sheetName(s.name, taken); taken.add(n.toLowerCase()); return n; });
    const parts = [], extra = [], sheetRels = []; let chartN = 0;
    sheets.forEach((sh, si) => {
      const cells = sh.cells || {}; const byRow = new Map(); let maxR = 0, maxC = 0;
      for (const a of Object.keys(cells)) { const p = F().parseAddr(a); if (!p) continue; const c = cells[a]; if (!c || ((c.v == null || c.v === '') && !c.s)) continue; if (!byRow.has(p.r)) byRow.set(p.r, []); byRow.get(p.r).push([p.c, a, c]); maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); }
      const rowsOut = [];
      const rowSizes = sh.rows || {}; const allRows = new Set([...byRow.keys(), ...Object.keys(rowSizes).map(Number)]);
      for (const r of [...allRows].sort((a, b) => a - b)) {
        const list = (byRow.get(r) || []).sort((a, b) => a[0] - b[0]); let xml = '';
        for (const [, a, c] of list) {
          const raw = c.v == null ? '' : String(c.v); const val = values[si][a];
          if (raw === '') { xml += `<c r="${a}" s="${xfOf(c.s, null)}"/>`; continue; }
          if (raw[0] === '=' && raw.length > 1) {
            const f = `<f>${X(F().toFile(raw))}</f>`; const err = val && typeof val === 'object' && 'e' in val;
            if (err) xml += `<c r="${a}" s="${xfOf(c.s, null)}" t="e">${f}${val.e === '#CIRC!' ? '' : `<v>${X(val.e)}</v>`}</c>`;
            else if (typeof val === 'number') xml += `<c r="${a}" s="${xfOf(c.s, val)}">${f}<v>${val}</v></c>`;
            else if (typeof val === 'boolean') xml += `<c r="${a}" s="${xfOf(c.s, null)}" t="b">${f}<v>${val ? 1 : 0}</v></c>`;
            else xml += `<c r="${a}" s="${xfOf(c.s, null)}" t="str">${f}<v>${X(val == null ? '' : val)}</v></c>`;
            continue;
          }
          const lit = F().literal(raw); const s = Object.assign({}, c.s || {}); if (lit.fmt && !s.fmt) s.fmt = lit.fmt;
          if (typeof lit.v === 'number') xml += `<c r="${a}" s="${xfOf(s, lit.v)}"><v>${lit.v}</v></c>`;
          else if (typeof lit.v === 'boolean') xml += `<c r="${a}" s="${xfOf(s, null)}" t="b"><v>${lit.v ? 1 : 0}</v></c>`;
          else xml += `<c r="${a}" s="${xfOf(s, null)}" t="s"><v>${sst(String(lit.v))}</v></c>`;
        }
        const ht = rowSizes[r] ? ` ht="${(+rowSizes[r] * 0.75).toFixed(2)}" customHeight="1"` : '';
        if (xml || ht) rowsOut.push(`<row r="${r + 1}"${ht}>${xml}</row>`);
      }
      const colW = sh.cols || {}; const colKeys = Object.keys(colW).map(Number).filter(k => k >= 0 && k < F().MAX_COL).sort((a, b) => a - b);
      const cols = colKeys.length ? `<cols>${colKeys.map(k => `<col min="${k + 1}" max="${k + 1}" width="${Math.max(0.5, (+colW[k] - 5) / 7).toFixed(2)}" customWidth="1"/>`).join('')}</cols>` : '';
      const pane = sh.freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : '';
      const dim = byRow.size ? `A1:${F().addr(maxC, maxR)}` : 'A1';
      // charts: a drawing on the sheet with each chart anchored to the cells under it, pointing at the same cells
      let drawing = ''; const C = App.OfficeChart;
      if (C && Array.isArray(sh.charts) && sh.charts.length) {
        const anchors = [], dn = si + 1; const rels = [];
        sh.charts.forEach(ch => {
          const x = C.chartXml(ch, sh, values[si], names[si]); if (!x) return; chartN++;
          extra.push({ name: `xl/charts/chart${chartN}.xml`, data: x, type: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml' }); rels.push({ id: 'rId' + (rels.length + 1), type: 'chart', target: `../charts/chart${chartN}.xml` });
          const cw = {}, rh = {}; Object.keys(sh.cols || {}).forEach(k => { cw[k] = +sh.cols[k]; }); Object.keys(sh.rows || {}).forEach(k => { rh[k] = +sh.rows[k]; });
          anchors.push({ name: `Chart ${anchors.length + 1}`, descr: C.describe(ch, sh, values[si]), from: { c: C.cellAt(ch.x, cw, DEF_W), r: C.cellAt(ch.y, rh, DEF_H) }, to: { c: C.cellAt(ch.x + ch.w, cw, DEF_W), r: C.cellAt(ch.y + ch.h, rh, DEF_H) } });
        });
        if (anchors.length) {
          extra.push({ name: `xl/drawings/drawing${dn}.xml`, data: C.drawingXml(anchors), type: 'application/vnd.openxmlformats-officedocument.drawing+xml' }, { name: `xl/drawings/_rels/drawing${dn}.xml.rels`, data: O().RELS(rels) });
          sheetRels.push({ name: `xl/worksheets/_rels/sheet${si + 1}.xml.rels`, data: O().RELS([{ id: 'rId1', type: 'drawing', target: `../drawings/drawing${dn}.xml` }]) });
          drawing = '<drawing r:id="rId1"/>';
        }
      }
      parts.push(XML + `<worksheet xmlns="${S_NS}" xmlns:r="${R_NS}"><dimension ref="${dim}"/><sheetViews><sheetView workbookViewId="0"${si === (book.active || 0) ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rowsOut.join('')}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${drawing}</worksheet>`);
    });
    const active = Math.max(0, Math.min(sheets.length - 1, book.active || 0));
    const wb = XML + `<workbook xmlns="${S_NS}" xmlns:r="${R_NS}"><workbookPr/><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${names.map((n, i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    const wrels = O().RELS([...sheets.map((s, i) => ({ id: 'rId' + (i + 1), type: 'worksheet', target: `worksheets/sheet${i + 1}.xml` })), { id: 'rId' + (sheets.length + 1), type: 'styles', target: 'styles.xml' }, { id: 'rId' + (sheets.length + 2), type: 'sharedStrings', target: 'sharedStrings.xml' }, { id: 'rId' + (sheets.length + 3), type: 'theme', target: 'theme/theme1.xml' }]);
    const styles = XML + `<styleSheet xmlns="${S_NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
    const shared = XML + `<sst xmlns="${S_NS}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(t => `<si><t${/^\s|\s$|\n/.test(t) ? ' xml:space="preserve"' : ''}>${X(t)}</t></si>`).join('')}</sst>`;
    const types = XML + `<Types xmlns="${O().NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${extra.filter(e => e.type).map(e => `<Override PartName="/${e.name}" ContentType="${e.type}"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    return K().zip([
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: O().RELS([{ id: 'rId1', type: 'officeDocument', target: 'xl/workbook.xml' }, { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' }, { id: 'rId3', type: 'extended-properties', target: 'docProps/app.xml' }]) },
      { name: 'docProps/core.xml', data: O().CORE(opts.title || 'Spreadsheet', O().isoNow()) }, { name: 'docProps/app.xml', data: O().APP },
      { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: wrels }, { name: 'xl/styles.xml', data: styles }, { name: 'xl/sharedStrings.xml', data: shared },
      { name: 'xl/theme/theme1.xml', data: themeXml() },
      ...parts.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x })), ...sheetRels, ...extra.map(e => ({ name: e.name, data: e.data }))
    ]);
  }
  /** The Office colours and Calibri: what "theme 1" (the text colour) in the styles means. */
  function themeXml() {
    const c = v => `<a:srgbClr val="${v}"/>`; const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    return O().XML + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2>${c('44546A')}</a:dk2><a:lt2>${c('E7E6E6')}</a:lt2><a:accent1>${c('4472C4')}</a:accent1><a:accent2>${c('ED7D31')}</a:accent2><a:accent3>${c('A5A5A5')}</a:accent3><a:accent4>${c('FFC000')}</a:accent4><a:accent5>${c('5B9BD5')}</a:accent5><a:accent6>${c('70AD47')}</a:accent6><a:hlink>${c('0563C1')}</a:hlink><a:folHlink>${c('954F72')}</a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst><a:lnStyleLst><a:ln w="6350">${fill}</a:ln><a:ln w="12700">${fill}</a:ln><a:ln w="19050">${fill}</a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
  }

  /* ======================= reading ======================= */
  const BUILTIN_DATE = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  function fmtFrom(id, code) {   // a number format → Sheets' own
    if (id === 0 || id === 49) return ''; if (id === 9 || id === 10) return 'pct'; if (id === 1 || id === 3) return 'int'; if (id === 2 || id === 4 || id === 11 || id === 40 || id === 39 || id === 37 || id === 38) return 'num';
    if ([5, 6, 7, 8, 42, 44].includes(id)) return 'usd'; if (BUILTIN_DATE.has(id)) return 'date';
    const c = String(code || '').replace(/"[^"]*"/g, m => /\$/.test(m) ? '$' : '').replace(/\[[^\]]*\]/g, m => /\$/.test(m) ? '$' : '');
    if (!c) return ''; if (/%/.test(c)) return 'pct'; if (/\$|€|£/.test(c)) return 'usd'; if (/[dmy]/i.test(c) && !/h|s/i.test(c.replace(/mm(?=:)/g, ''))) return 'date';
    if (/0\.0/.test(c)) return 'num'; if (/#,##0|^0$/.test(c)) return 'int'; return '';
  }
  async function bookFromXlsx(buf) {
    const z = K().entries(buf); const parse = O().parseXml;
    const rels = await O().relsOf(z, 'xl/workbook.xml'); const wbx = await K().readText(z, 'xl/workbook.xml'); if (!wbx) throw new Error('bad');
    const wb = parse(wbx); const q = (el, name) => el ? [...el.getElementsByTagNameNS(S_NS, name)] : [];
    const d1904 = (q(wb, 'workbookPr')[0] || { getAttribute: () => '' }).getAttribute('date1904'); const dateShift = d1904 === '1' || d1904 === 'true' ? 1462 : 0;
    // shared strings
    const strings = []; const sx = await K().readText(z, Object.values(rels).find(r => /\/sharedStrings$/.test(r.type)) ? O().resolve('xl/workbook.xml', Object.values(rels).find(r => /\/sharedStrings$/.test(r.type)).target) : 'xl/sharedStrings.xml');
    if (sx) for (const si of q(parse(sx), 'si')) strings.push(textOf(si));
    // styles
    const XF = []; const stPath = Object.values(rels).find(r => /\/styles$/.test(r.type)); const stx = await K().readText(z, stPath ? O().resolve('xl/workbook.xml', stPath.target) : 'xl/styles.xml');
    if (stx) {
      const sd = parse(stx); const codes = {}; q(sd, 'numFmt').forEach(n => { codes[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
      const fonts = q(q(sd, 'fonts')[0], 'font').map(f => { const col = q(f, 'color')[0]; const rgb = col && col.getAttribute('rgb'); const on = n => { const e = q(f, n)[0]; return !!e && e.getAttribute('val') !== '0' && e.getAttribute('val') !== 'false' && e.getAttribute('val') !== 'none'; }; return { b: on('b'), i: on('i'), u: on('u'), color: rgb && /^[0-9A-F]{8}$/i.test(rgb) && rgb.slice(2).toUpperCase() !== '000000' ? '#' + rgb.slice(2).toLowerCase() : '' }; });
      const fills = q(q(sd, 'fills')[0], 'fill').map(f => { const p = q(f, 'patternFill')[0]; if (!p || p.getAttribute('patternType') !== 'solid') return ''; const fg = q(p, 'fgColor')[0]; const rgb = fg && fg.getAttribute('rgb'); return rgb && /^[0-9A-F]{8}$/i.test(rgb) && rgb.slice(2).toUpperCase() !== 'FFFFFF' ? '#' + rgb.slice(2).toLowerCase() : ''; });
      for (const x of q(q(sd, 'cellXfs')[0], 'xf')) {
        const id = +(x.getAttribute('numFmtId') || 0); const f = fonts[+(x.getAttribute('fontId') || 0)] || {}; const al = q(x, 'alignment')[0]; const s = {};
        const fmt = fmtFrom(id, codes[id]); if (fmt) s.fmt = fmt; if (f.b) s.b = true; if (f.i) s.i = true; if (f.u) s.u = true; if (f.color) s.color = f.color;
        const bg = fills[+(x.getAttribute('fillId') || 0)]; if (bg) s.bg = bg;
        if (al) { const h = al.getAttribute('horizontal'); if (['left', 'center', 'right'].includes(h)) s.al = h; if (al.getAttribute('wrapText') === '1' || al.getAttribute('wrapText') === 'true') s.wrap = true; }
        XF.push(s);
      }
    }
    const out = { sheets: [], active: 0 }; let skipped = 0;
    const taken = new Set();
    for (const sh of q(q(wb, 'sheets')[0], 'sheet')) {
      if (out.sheets.length >= 30) break;
      const r = rels[sh.getAttributeNS(R_NS, 'id') || sh.getAttribute('r:id')]; if (!r || !/\/worksheet$/.test(r.type)) continue;   // chart sheets and the like are left out
      const path = O().resolve('xl/workbook.xml', r.target); const x = await K().readText(z, path); if (!x) continue;
      const doc = parse(x); const name = sheetName(sh.getAttribute('name'), taken); taken.add(name.toLowerCase());
      const sheet = { name, cells: {}, cols: {}, rows: {}, freeze: 0 }; const shared = {};
      for (const c of q(doc, 'col')) { const w = +c.getAttribute('width'); if (!(w > 0) || c.getAttribute('customWidth') === '0') continue; const lo = +c.getAttribute('min') - 1, hi = Math.min(+c.getAttribute('max') - 1, lo + 100, F().MAX_COL - 1); for (let k = lo; k <= hi; k++) sheet.cols[k] = Math.max(24, Math.min(600, Math.round(w * 7 + 5))); }
      const pane = q(doc, 'pane')[0]; if (pane && pane.getAttribute('state') === 'frozen' && +(pane.getAttribute('ySplit') || 0) >= 1) sheet.freeze = 1;
      for (const row of q(doc, 'row')) {
        const ri = +row.getAttribute('r') - 1; if (ri >= F().MAX_ROW) { skipped++; continue; }
        if (row.getAttribute('customHeight') === '1' && row.getAttribute('ht')) sheet.rows[ri] = Math.max(12, Math.min(400, Math.round(+row.getAttribute('ht') / 0.75)));
        let col = -1;
        for (const c of q(row, 'c')) {
          const ref = c.getAttribute('r'); const p = ref ? F().parseAddr(ref) : { c: col + 1, r: ri }; if (!p) { skipped++; continue; } col = p.c;
          const a = F().addr(p.c, p.r); const t = c.getAttribute('t') || 'n'; const sIdx = +(c.getAttribute('s') || 0); const st = XF[sIdx] ? Object.assign({}, XF[sIdx]) : null;
          const vEl = q(c, 'v')[0]; const fEl = q(c, 'f')[0]; let raw = '', cached;
          const v = vEl ? vEl.textContent : '';
          if (t === 's') cached = strings[+v] ?? ''; else if (t === 'inlineStr') cached = textOf(q(c, 'is')[0]); else if (t === 'str') cached = v; else if (t === 'b') cached = v === '1' || v === 'true'; else if (t === 'e') cached = { e: v }; else if (v !== '') cached = +v + (st && st.fmt === 'date' ? dateShift : 0);
          if (fEl) {
            let f = fEl.textContent; const si = fEl.getAttribute('si');
            if (fEl.getAttribute('t') === 'shared' && si !== null) { if (f) shared[si] = { f, c: p.c, r: p.r }; else if (shared[si]) f = F().translate('=' + shared[si].f, p.r - shared[si].r, p.c - shared[si].c).slice(1); }
            if (f) raw = F().fromFile(f);
          }
          if (!raw) {
            if (cached === undefined || cached === '' || (cached && typeof cached === 'object')) { if (cached && typeof cached === 'object') raw = String(cached.e); else if (!st) continue; }
            else if (typeof cached === 'boolean') raw = cached ? 'TRUE' : 'FALSE';
            else if (typeof cached === 'number') raw = String(cached);
            else { const s = String(cached); const l = F().literal(s); raw = (l.v !== s || s[0] === '=' || s[0] === "'") ? "'" + s : s; }
          }
          const cell = { v: raw }; if (st && Object.keys(st).length) cell.s = st; if (raw[0] === '=' && cached !== undefined && !(cached && typeof cached === 'object')) cell.c = cached;
          sheet.cells[a] = cell;
        }
      }
      // charts on the sheet's drawing (assets/office-chart.js)
      if (App.OfficeChart) { try { const sr = await O().relsOf(z, path); const dr = Object.values(sr).find(x => /\/drawing$/.test(x.type)); if (dr) { const ch = await App.OfficeChart.fromXlsx(z, O().resolve(path, dr.target), sh.getAttribute('name') || sheet.name, sheet.cols, sheet.rows); if (ch.length) sheet.charts = ch; } } catch (e) {} }
      out.sheets.push(sheet);
    }
    if (!out.sheets.length) throw new Error('bad');
    const av = q(wb, 'workbookView')[0]; out.active = Math.max(0, Math.min(out.sheets.length - 1, +(av && av.getAttribute('activeTab')) || 0));
    if (skipped) out.skipped = skipped;
    return out;
  }
  function textOf(si) { if (!si) return ''; const rs = [...si.getElementsByTagNameNS(S_NS, 'r')]; if (rs.length) return rs.map(r => [...r.getElementsByTagNameNS(S_NS, 't')].map(t => t.textContent).join('')).join(''); const t = si.getElementsByTagNameNS(S_NS, 't')[0]; return t ? t.textContent : ''; }

  /* ======================= CSV ======================= */
  /** CSV text → rows of fields (RFC 4180: quotes, doubled quotes, line breaks in quotes); the separator is the one the
      first lines use most: comma, semicolon or tab. */
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, ''); const head = text.slice(0, 4000).split('\n').slice(0, 5).join('\n');
    const count = c => (head.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length; const sep = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
      if (ch === '"' && f === '') { q = true; continue; }
      if (ch === sep) { row.push(f); f = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; continue; }
      f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  /** CSV text → a workbook of one sheet. A field that would read as something else (a formula, or 007 as a number
      when it is text with a leading zero) is kept exactly as written. */
  function bookFromCsv(text, name) {
    const rows = parseCsv(text); const cells = {}; let skipped = 0;
    rows.forEach((r, ri) => r.forEach((v, ci) => {
      if (v === '') return; if (ri >= F().MAX_ROW || ci >= F().MAX_COL) { skipped++; return; }
      const keep = v[0] === '=' || v[0] === "'" || /^[-+]?0\d+$/.test(v.trim());
      cells[F().addr(ci, ri)] = { v: keep ? "'" + v : v };
    }));
    const out = { sheets: [{ name: sheetName(name || 'Sheet1'), cells, cols: {}, rows: {} }], active: 0 }; if (skipped) out.skipped = skipped; return out;
  }
  /** One sheet → CSV, each cell as it shows (as Excel writes CSV). */
  function csvFromSheet(sheet, values) {
    let maxR = -1, maxC = -1; for (const a of Object.keys(sheet.cells || {})) { const p = F().parseAddr(a); if (p && sheet.cells[a].v !== '' && sheet.cells[a].v != null) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); } }
    const out = [];
    for (let r = 0; r <= maxR; r++) { const line = []; for (let c = 0; c <= maxC; c++) { const a = F().addr(c, r); const cell = sheet.cells[a]; const v = values[a]; let s = v === undefined ? '' : F().show(v, F().fmtOf(cell)); if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; line.push(s); } out.push(line.join(',')); }
    return out.join('\r\n') + (out.length ? '\r\n' : '');
  }

  Object.assign(App.OOXML, { xlsxFromBook, bookFromXlsx, bookFromCsv, csvFromSheet, parseCsv, sheetName, DEF_W, DEF_H });
})(window);
