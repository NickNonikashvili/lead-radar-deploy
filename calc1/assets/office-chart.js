/* ============================================================
   Mathub — charts in Sheets (assets/office-sheets.js): App.OfficeChart
   A chart: { id, type: column | line | scatter | pie, range: 'A1:C6', title, xTitle, yTitle, trend, x, y, w, h } on its
   sheet (x, y, w, h in screen pixels over the cells, the way Excel anchors a chart to them).
   - Reading the range like Excel and Google Sheets do: the first column is the categories (the x values for a
     scatter chart), each other column a series named by its first row when that row is words.
   - Drawn as SVG (on the sheet, in print), with axes on round numbers; a scatter chart can show the line of best fit
     with its equation and R² (least squares, the same numbers as SLOPE, INTERCEPT and RSQ).
   - Written into the .xlsx as a real Excel chart (bar, line, scatter with a linear trendline, pie) that points at the
     same cells, so it stays live in Excel, Numbers, Google Sheets and LibreOffice; and read back from such files.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App;
  const F = () => App.Formula; const O = () => App.OOXML;
  const PALETTE = ['#2f6fde', '#e4572e', '#2a9d8f', '#f2b705', '#8e6bd8', '#5b6478', '#d6457a', '#3aa655'];
  const TYPES = [['column', 'Column'], ['line', 'Line'], ['scatter', 'Scatter (x and y)'], ['pie', 'Pie']];
  const KIND = { column: 'column chart', line: 'line chart', scatter: 'scatter chart', pie: 'pie chart' };   // in a sentence
  const t = (s, ...v) => (App && App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const X = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  function parseRange(r) { const m = /^\$?([A-Z]{1,2})\$?(\d{1,5})(?::\$?([A-Z]{1,2})\$?(\d{1,5}))?$/i.exec(String(r || '').trim()); if (!m) return null; const a = F().parseAddr(m[1] + m[2]), b = F().parseAddr((m[3] || m[1]) + (m[4] || m[2])); if (!a || !b) return null; return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; }

  /** The numbers a chart shows, from its range: { cats, xs, series: [{ name, vals, col }], head, rr } */
  function data(chart, sheet, values) {
    const rr = parseRange(chart.range); if (!rr) return null;
    const v = (r, c) => values[F().addr(c, r)]; const cells = sheet.cells || {};
    const label = (r, c) => { const x = v(r, c); return x === undefined || x === null ? '' : F().show(x, F().fmtOf(cells[F().addr(c, r)])); };
    const multi = rr.c2 > rr.c1; const firstSeries = multi ? rr.c1 + 1 : rr.c1;
    let head = false; for (let c = firstSeries; c <= rr.c2; c++) { const x = v(rr.r1, c); if (typeof x === 'string' && x.trim()) head = true; }
    if (!head && multi && typeof v(rr.r1, rr.c1) === 'string' && rr.r2 > rr.r1 && [...Array(rr.c2 - firstSeries + 1)].every((_, k) => !isNum(v(rr.r1, firstSeries + k)) || false)) head = true;
    const r0 = head ? rr.r1 + 1 : rr.r1; const rows = []; for (let r = r0; r <= rr.r2; r++) rows.push(r);
    const cats = multi ? rows.map(r => label(r, rr.c1)) : rows.map((r, i) => String(i + 1));
    const xs = multi ? rows.map(r => isNum(v(r, rr.c1)) ? v(r, rr.c1) : null) : rows.map((r, i) => i + 1);
    const series = []; for (let c = firstSeries; c <= rr.c2; c++) series.push({ name: head ? label(rr.r1, c) : t('Series {1}', series.length + 1), col: c, vals: rows.map(r => isNum(v(r, c)) ? v(r, c) : null) });
    return { cats, xs, series, head, rr, rows };
  }
  /** least squares through the points where both are numbers */
  function fit(xs, ys) {
    const P = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => isNum(x) && isNum(y)); if (P.length < 2) return null;
    const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length; let sxy = 0, sxx = 0, syy = 0;
    P.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }); if (!sxx) return null;
    const m = sxy / sxx, b = my - m * mx; return { m, b, r2: syy ? sxy * sxy / (sxx * syy) : 1, x0: Math.min(...P.map(p => p[0])), x1: Math.max(...P.map(p => p[0])) };
  }
  function nice(lo, hi, n = 5) {
    if (!isNum(lo) || !isNum(hi)) { lo = 0; hi = 1; } if (lo === hi) { const d = Math.abs(lo) || 1; lo -= d / 2; hi += d / 2; }
    const raw = (hi - lo) / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step };
  }
  const fmt = v => { const a = Math.abs(v); if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(1).replace('e+', 'e'); return String(+v.toFixed(6)).replace(/(\.\d{4})\d+$/, '$1'); };
  const sig = v => String(+v.toPrecision(4));

  /** The chart as SVG, w × h px. */
  function svg(chart, sheet, values, o = {}) {
    const w = Math.max(160, chart.w || 420), h = Math.max(120, chart.h || 280); const D = data(chart, sheet, values);
    const T = String(chart.title || '').trim(); const fam = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
    let out = `<svg xmlns="http://www.w3.org/2000/svg" class="ch-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${fam}" role="img" aria-label="${X((T || 'Chart') + (D ? '' : ''))}"><rect width="${w}" height="${h}" fill="#ffffff"/>`;
    if (T) out += `<text x="${w / 2}" y="22" text-anchor="middle" font-size="15" fill="#1d2433">${X(T)}</text>`;
    if (!D || !D.series.length || !D.series.some(s => s.vals.some(isNum))) return out + `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="#5b6478">${X(o.empty || 'No numbers in this range yet')}</text></svg>`;
    const top = T ? 36 : 14, legend = D.series.length > 1 || chart.type === 'pie';
    if (chart.type === 'pie') {
      const S = D.series[0]; const pts = S.vals.map((v, i) => ({ v: isNum(v) && v > 0 ? v : 0, l: D.cats[i] })).filter(p => p.v > 0); const tot = pts.reduce((s, p) => s + p.v, 0);
      const lw = Math.min(150, w * 0.36); const cx = (w - lw) / 2, cy = top + (h - top - 10) / 2, R = Math.max(20, Math.min((w - lw) / 2 - 14, (h - top - 20) / 2));
      let a = -Math.PI / 2; pts.forEach((p, i) => {
        const da = p.v / tot * Math.PI * 2; const c = PALETTE[i % PALETTE.length];
        if (pts.length === 1) out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}"/>`;
        else { const x1 = cx + R * Math.cos(a), y1 = cy + R * Math.sin(a), x2 = cx + R * Math.cos(a + da), y2 = cy + R * Math.sin(a + da); out += `<path d="M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${da > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z" fill="${c}" stroke="#fff" stroke-width="1.5"/>`; }
        const mid = a + da / 2; if (da > 0.25) out += `<text x="${(cx + R * 0.62 * Math.cos(mid)).toFixed(1)}" y="${(cy + R * 0.62 * Math.sin(mid) + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#fff" font-weight="600">${Math.round(p.v / tot * 100)}%</text>`;
        a += da;
      });
      pts.slice(0, 12).forEach((p, i) => { const y = top + 8 + i * 18; out += `<rect x="${w - lw + 4}" y="${y}" width="11" height="11" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="${w - lw + 21}" y="${y + 10}" font-size="12" fill="#1d2433">${X(String(p.l).slice(0, 22))}</text>`; });
      return out + '</svg>';
    }
    const scatter = chart.type === 'scatter';
    const allY = D.series.flatMap(s => s.vals.filter(isNum)); let ylo = Math.min(...allY), yhi = Math.max(...allY);
    if (chart.type === 'column') { ylo = Math.min(0, ylo); yhi = Math.max(0, yhi); }
    const fits = scatter && chart.trend ? D.series.map(s => fit(D.xs, s.vals)) : [];
    const Y = nice(ylo, yhi); const xsN = D.xs.filter(isNum); const Xn = scatter ? nice(Math.min(...xsN), Math.max(...xsN)) : null;
    const left = 14 + Math.max(...[Y.lo, Y.hi, Y.lo + Y.step].map(v => fmt(v).length)) * 6.6 + (chart.yTitle ? 18 : 0), right = 14, bottom = 28 + (chart.xTitle ? 18 : 0) + (legend ? 22 : 0);
    const pw = w - left - right, ph = h - top - bottom; if (pw < 40 || ph < 30) return out + '</svg>';
    const sy = v => top + ph - (v - Y.lo) / (Y.hi - Y.lo) * ph;
    for (let v = Y.lo; v <= Y.hi + Y.step / 2; v += Y.step) { const y = sy(v); out += `<line x1="${left}" x2="${left + pw}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e3e8ef"/><text x="${left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5b6478">${X(fmt(+v.toPrecision(12)))}</text>`; }
    let sx, n = D.cats.length;
    if (scatter) {
      sx = x => left + (x - Xn.lo) / (Xn.hi - Xn.lo) * pw;
      for (let v = Xn.lo; v <= Xn.hi + Xn.step / 2; v += Xn.step) { const x = sx(v); out += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${top + ph}" stroke="#eef1f5"/><text x="${x.toFixed(1)}" y="${top + ph + 16}" text-anchor="middle" font-size="11" fill="#5b6478">${X(fmt(+v.toPrecision(12)))}</text>`; }
    } else {
      const band = pw / Math.max(1, n); sx = i => left + band * (i + 0.5); const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 56))));
      D.cats.forEach((c, i) => { if (i % every === 0) out += `<text x="${sx(i).toFixed(1)}" y="${top + ph + 16}" text-anchor="middle" font-size="11" fill="#5b6478">${X(String(c).slice(0, 14))}</text>`; });
    }
    out += `<line x1="${left}" x2="${left + pw}" y1="${sy(Math.max(Y.lo, Math.min(Y.hi, 0))).toFixed(1)}" y2="${sy(Math.max(Y.lo, Math.min(Y.hi, 0))).toFixed(1)}" stroke="#9aa3b5"/><line x1="${left}" x2="${left}" y1="${top}" y2="${top + ph}" stroke="#9aa3b5"/>`;
    D.series.forEach((s, k) => {
      const c = PALETTE[k % PALETTE.length];
      if (chart.type === 'column') { const band = pw / Math.max(1, n), bw = band * 0.7 / D.series.length; s.vals.forEach((v, i) => { if (!isNum(v)) return; const x = left + band * i + band * 0.15 + bw * k, y0 = sy(Math.max(Y.lo, Math.min(Y.hi, 0))), y1 = sy(v); out += `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="${c}"/>`; }); }
      else if (chart.type === 'line') { const pts = s.vals.map((v, i) => isNum(v) ? `${sx(i).toFixed(1)},${sy(v).toFixed(1)}` : null); let seg = []; const segs = []; pts.forEach(p => { if (p) seg.push(p); else { if (seg.length) segs.push(seg); seg = []; } }); if (seg.length) segs.push(seg); segs.forEach(g => { out += `<polyline points="${g.join(' ')}" fill="none" stroke="${c}" stroke-width="2.2"/>`; }); pts.forEach(p => { if (p) { const [x, y] = p.split(','); out += `<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`; } }); }
      else { s.vals.forEach((v, i) => { const x = D.xs[i]; if (isNum(v) && isNum(x)) out += `<circle cx="${sx(x).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3.6" fill="${c}"/>`; }); const f = fits[k]; if (f) { const a = Math.max(Xn.lo, f.x0 - (f.x1 - f.x0) * 0.05), b = Math.min(Xn.hi, f.x1 + (f.x1 - f.x0) * 0.05); out += `<line x1="${sx(a).toFixed(1)}" y1="${sy(f.m * a + f.b).toFixed(1)}" x2="${sx(b).toFixed(1)}" y2="${sy(f.m * b + f.b).toFixed(1)}" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${left + 8}" y="${top + 14 + k * 16}" font-size="12" fill="${c}">y = ${X(sig(f.m))}x ${f.b < 0 ? '−' : '+'} ${X(sig(Math.abs(f.b)))}  ·  R² = ${X(f.r2.toFixed(4))}</text>`; } }
    });
    if (chart.xTitle) out += `<text x="${left + pw / 2}" y="${top + ph + 32}" text-anchor="middle" font-size="12" fill="#1d2433">${X(chart.xTitle)}</text>`;
    if (chart.yTitle) out += `<text transform="translate(14 ${top + ph / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#1d2433">${X(chart.yTitle)}</text>`;
    if (legend) { let x = left; const y = h - 10; D.series.forEach((s, k) => { const label = String(s.name).slice(0, 24); out += `<rect x="${x}" y="${y - 9}" width="11" height="11" rx="2" fill="${PALETTE[k % PALETTE.length]}"/><text x="${x + 15}" y="${y}" font-size="12" fill="#1d2433">${X(label)}</text>`; x += 26 + label.length * 6.6; }); }
    return out + '</svg>';
  }
  /** One sentence about the chart, for a screen reader. */
  function describe(chart, sheet, values) {
    const D = data(chart, sheet, values); const kind = t(KIND[chart.type] || KIND.column); const up = x => x.charAt(0).toUpperCase() + x.slice(1);
    if (!D) return chart.title ? chart.title + ': ' + kind : up(kind);
    const what = t('{1} of {2}, {3} points, from {4}.', kind, D.series.map(x => x.name).join(', '), D.rows.length, chart.range);
    let s = chart.title ? chart.title + ': ' + what : up(what);
    if (chart.type === 'scatter' && chart.trend) D.series.forEach(x => { const f = fit(D.xs, x.vals); if (f) s += ' ' + t('Line of best fit for {1}: y = {2}x + {3}, R² {4}.', x.name, sig(f.m), sig(f.b), f.r2.toFixed(4)); });
    return s;
  }

  /* ======================= in the .xlsx ======================= */
  const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart', A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main', XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const quoteSheet = n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !/^[A-Z]{1,3}\d+$/i.test(n) ? n : `'${n.replace(/'/g, "''")}'`;
  const absRef = (sheetName, c1, r1, c2, r2) => `${quoteSheet(sheetName)}!$${F().colName(c1)}$${r1 + 1}` + (c2 !== c1 || r2 !== r1 ? `:$${F().colName(c2)}$${r2 + 1}` : '');
  /** The chart's part (xl/charts/chartN.xml) for a sheet named sheetName. */
  function chartXml(chart, sheet, values, sheetName) {
    const D = data(chart, sheet, values); if (!D || !D.series.length) return null;
    const r0 = D.rows[0], r1 = D.rows[D.rows.length - 1]; const multi = D.rr.c2 > D.rr.c1;
    const strCache = list => `<c:strCache><c:ptCount val="${list.length}"/>${list.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = list => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${list.length}"/>${list.map((v, i) => isNum(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : '').join('')}</c:numCache>`;
    const tx = s => D.head ? `<c:tx><c:strRef><c:f>${X(absRef(sheetName, s.col, D.rr.r1, s.col, D.rr.r1))}</c:f>${strCache([s.name])}</c:strRef></c:tx>` : `<c:tx><c:v>${X(s.name)}</c:v></c:tx>`;
    const fill = (c, line) => line ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${c.slice(1).toUpperCase()}"/></a:solidFill><a:round/></a:ln></c:spPr>` : `<c:spPr><a:solidFill><a:srgbClr val="${c.slice(1).toUpperCase()}"/></a:solidFill></c:spPr>`;
    const catRef = multi ? `<c:cat><c:strRef><c:f>${X(absRef(sheetName, D.rr.c1, r0, D.rr.c1, r1))}</c:f>${strCache(D.cats)}</c:strRef></c:cat>` : '';
    const valRef = s => `<c:val><c:numRef><c:f>${X(absRef(sheetName, s.col, r0, s.col, r1))}</c:f>${numCache(s.vals)}</c:numRef></c:val>`;
    const ax = (id, cross, pos, cat, grid, title) => cat
      ? `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${title}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      : `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${grid ? '<c:majorGridlines/>' : ''}${title}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="${pos === 'b' ? 'midCat' : 'between'}"/></c:valAx>`;
    const axTitle = s => s ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="1000" b="0"/><a:t>${X(s)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : '';
    let plot = '';
    if (chart.type === 'pie') {
      const s = D.series[0];
      plot = `<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx(s)}${D.cats.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[i % PALETTE.length].slice(1).toUpperCase()}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('')}<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>${catRef}${valRef(s)}</c:ser><c:firstSliceAng val="0"/></c:pieChart>`;
    } else if (chart.type === 'scatter') {
      plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${D.series.map((s, k) => { const c = PALETTE[k % PALETTE.length]; return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx(s)}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${c.slice(1).toUpperCase()}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>${chart.trend ? `<c:trendline><c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${c.slice(1).toUpperCase()}"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr><c:trendlineType val="linear"/><c:dispRSqr val="1"/><c:dispEq val="1"/></c:trendline>` : ''}<c:xVal><c:numRef><c:f>${X(absRef(sheetName, D.rr.c1, r0, D.rr.c1, r1))}</c:f>${numCache(D.xs)}</c:numRef></c:xVal><c:yVal><c:numRef><c:f>${X(absRef(sheetName, s.col, r0, s.col, r1))}</c:f>${numCache(s.vals)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`; }).join('')}<c:axId val="500000001"/><c:axId val="500000002"/></c:scatterChart>${ax(500000001, 500000002, 'b', false, false, axTitle(chart.xTitle))}${ax(500000002, 500000001, 'l', false, true, axTitle(chart.yTitle))}`;
    } else {
      const line = chart.type === 'line';
      plot = `<c:${line ? 'lineChart' : 'barChart'}>${line ? '' : '<c:barDir val="col"/>'}<c:grouping val="${line ? 'standard' : 'clustered'}"/><c:varyColors val="0"/>${D.series.map((s, k) => { const c = PALETTE[k % PALETTE.length]; return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx(s)}${fill(c, line)}${line ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${c.slice(1).toUpperCase()}"/></a:solidFill></c:spPr></c:marker>` : '<c:invertIfNegative val="0"/>'}${catRef}${valRef(s)}${line ? '<c:smooth val="0"/>' : ''}</c:ser>`; }).join('')}${line ? '<c:marker val="1"/>' : '<c:gapWidth val="150"/>'}<c:axId val="500000001"/><c:axId val="500000002"/></c:${line ? 'lineChart' : 'barChart'}>${ax(500000001, 500000002, 'b', true, false, axTitle(chart.xTitle))}${ax(500000002, 500000001, 'l', false, true, axTitle(chart.yTitle))}`;
    }
    const title = String(chart.title || '').trim();
    return O().XML + `<c:chartSpace xmlns:c="${C_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:roundedCorners val="0"/><c:chart>${title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="1400" b="0"/><a:t>${X(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>'}<c:plotArea><c:layout/>${plot}</c:plotArea>${D.series.length > 1 || chart.type === 'pie' ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:chartSpace>`;
  }
  /** px over the cells → a cell and the offset in it (EMU), for the drawing's anchors */
  function cellAt(px, sizes, def) { let i = 0, at = 0; for (; i < 20000; i++) { const s = sizes[i] || def; if (at + s > px) break; at += s; } return { i, off: Math.round((px - at) * 9525) }; }
  function drawingXml(anchors) {
    return O().XML + `<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}">${anchors.map((a, k) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${a.from.c.i}</xdr:col><xdr:colOff>${a.from.c.off}</xdr:colOff><xdr:row>${a.from.r.i}</xdr:row><xdr:rowOff>${a.from.r.off}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${a.to.c.i}</xdr:col><xdr:colOff>${a.to.c.off}</xdr:colOff><xdr:row>${a.to.r.i}</xdr:row><xdr:rowOff>${a.to.r.off}</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${k + 2}" name="${X(a.name)}" descr="${X(a.descr || '')}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C_NS}"><c:chart xmlns:c="${C_NS}" xmlns:r="${R_NS}" r:id="rId${k + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('')}</xdr:wsDr>`;
  }
  /** Reading: the charts a sheet's drawing holds → chart objects (those that point at one block of this sheet). */
  async function fromXlsx(z, drawingPath, sheetName, colPx, rowPx) {
    const K = App.Office; const parse = O().parseXml; const out = [];
    const dx = await K.readText(z, drawingPath); if (!dx) return out; const doc = parse(dx); const rels = await O().relsOf(z, drawingPath);
    const px = (list, sizes, def) => { let at = 0; const i = +list.i; for (let k = 0; k < i; k++) at += sizes[k] || def; return at + (+list.off || 0) / 9525; };
    for (const an of [...doc.getElementsByTagNameNS(XDR_NS, 'twoCellAnchor'), ...doc.getElementsByTagNameNS(XDR_NS, 'oneCellAnchor')]) {
      const ch = an.getElementsByTagNameNS(C_NS, 'chart')[0]; if (!ch) continue; const r = rels[ch.getAttributeNS(R_NS, 'id') || ch.getAttribute('r:id')]; if (!r) continue;
      const cx = await K.readText(z, O().resolve(drawingPath, r.target)); if (!cx) continue; const cd = parse(cx);
      const get = (el, ns, n) => el.getElementsByTagNameNS(ns, n)[0];
      const plot = get(cd, C_NS, 'plotArea'); if (!plot) continue;
      const kind = [...plot.children].map(c => c.localName).find(n => /Chart$/.test(n)); const node = kind && get(plot, C_NS, kind);
      const type = kind === 'scatterChart' ? 'scatter' : kind === 'pieChart' || kind === 'doughnutChart' ? 'pie' : kind === 'lineChart' ? 'line' : kind === 'barChart' ? 'column' : null; if (!type) continue;
      const refs = [...node.getElementsByTagNameNS(C_NS, 'f')].map(f => f.textContent.trim());
      let box = null, ok = refs.length > 0;
      for (const f of refs) { const m = /^(?:(?:'((?:[^']|'')+)'|([^!]+))!)?(.+)$/.exec(f); const sn = m && (m[1] ? m[1].replace(/''/g, "'") : m[2]); if (!m || (sn && sn.toLowerCase() !== sheetName.toLowerCase())) { ok = false; break; } const rr = parseRange(m[3].replace(/\$/g, '')); if (!rr) { ok = false; break; } box = box ? { r1: Math.min(box.r1, rr.r1), c1: Math.min(box.c1, rr.c1), r2: Math.max(box.r2, rr.r2), c2: Math.max(box.c2, rr.c2) } : rr; }
      if (!ok || !box) continue;
      const titleEl = get(cd, C_NS, 'title'); const title = titleEl && !(titleEl.parentNode && titleEl.parentNode.localName !== 'chart') ? [...titleEl.getElementsByTagNameNS(A_NS, 't')].map(t => t.textContent).join('') : '';
      const from = get(an, XDR_NS, 'from'), to = get(an, XDR_NS, 'to'); const val = (el, n) => el ? (get(el, XDR_NS, n) || { textContent: '0' }).textContent : '0';
      const x = from ? px({ i: val(from, 'col'), off: val(from, 'colOff') }, colPx, 100) : 0, y = from ? px({ i: val(from, 'row'), off: val(from, 'rowOff') }, rowPx, 24) : 0;
      const x2 = to ? px({ i: val(to, 'col'), off: val(to, 'colOff') }, colPx, 100) : x + 420, y2 = to ? px({ i: val(to, 'row'), off: val(to, 'rowOff') }, rowPx, 24) : y + 280;
      const axT = pos => { for (const ax of [...plot.getElementsByTagNameNS(C_NS, 'valAx'), ...plot.getElementsByTagNameNS(C_NS, 'catAx')]) { const p = get(ax, C_NS, 'axPos'); const tt = get(ax, C_NS, 'title'); if (p && p.getAttribute('val') === pos && tt) return [...tt.getElementsByTagNameNS(A_NS, 't')].map(t => t.textContent).join(''); } return ''; };
      out.push({ id: 'c' + Math.random().toString(36).slice(2, 8), xTitle: axT('b'), yTitle: axT('l'), type, range: `${F().addr(box.c1, box.r1)}:${F().addr(box.c2, box.r2)}`, title, trend: !!node.getElementsByTagNameNS(C_NS, 'trendline').length, x: Math.round(x), y: Math.round(y), w: Math.max(200, Math.round(x2 - x)), h: Math.max(140, Math.round(y2 - y)) });
    }
    return out;
  }

  App.OfficeChart = { TYPES, PALETTE, data, fit, svg, describe, chartXml, drawingXml, cellAt, fromXlsx, parseRange };
})(window);
