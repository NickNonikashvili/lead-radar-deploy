/* ============================================================
   Mathub — Office files in the browser (App.Office). Zip and unzip (a .docx, .pptx, .xlsx or .odt is a zip of XML),
   the text of a .docx, .odt or PDF, the text of each slide of a .pptx or page of a PDF, and a simple .docx written
   from paragraphs. Used by draft feedback (assets/drafts.js), the writer's notebook (assets/notebook.js), the
   instructor's assignment sheets (assets/instruct.js) and notes from slides (assets/learn.js). PDFs are read with pdf.js
   (assets/vendor/pdfjs, Apache-2.0, its legacy build), loaded only when a PDF is opened.
   Nothing leaves the device: files are read and written here.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const enc = new TextEncoder(), dec = new TextDecoder();

  /* ---------- CRC-32 (zip) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const bytes = d => d instanceof Uint8Array ? d : typeof d === 'string' ? enc.encode(d) : new Uint8Array(d);
  async function deflate(u8) {
    if (typeof CompressionStream !== 'function') return null;
    try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; }
  }
  async function inflate(u8) {
    if (typeof DecompressionStream !== 'function') throw new Error('inflate');
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }

  /* ---------- zip: files [{ name, data (string | bytes) }] → bytes; deflated where the browser can, else stored ---------- */
  async function zip(files, opts = {}) {
    const d = new Date(); const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const data = bytes(f.data), name = enc.encode(f.name), crc = crc32(data);
      const packed = opts.store || f.store ? null : await deflate(data); const method = packed && packed.length < data.length ? 8 : 0; const body = method ? packed : data;
      const utf8 = /[^\x20-\x7e]/.test(f.name) ? 0x0800 : 0;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, utf8, true); lh.setUint16(8, method, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, utf8, true); ch.setUint16(10, method, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), name, body); central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)]; const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  /* ---------- unzip: the entries of a zip (names), and one entry's bytes or text ---------- */
  function entries(buf) {
    const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const dv = new DataView(ab); let eo = -1;
    for (let i = ab.byteLength - 22; i >= Math.max(0, ab.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    if (eo < 0) throw new Error('bad');
    let p = dv.getUint32(eo + 16, true); const n = dv.getUint16(eo + 10, true); const out = new Map();
    for (let k = 0; k < n; k++) {
      if (p + 46 > ab.byteLength || dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      out.set(dec.decode(new Uint8Array(ab, p + 46, nl)), { method, size, lo });
      p += 46 + nl + xl + cl;
    }
    return { ab, dv, list: out };
  }
  async function read(z, name) {
    const e = z.list.get(name); if (!e) return null;
    const start = e.lo + 30 + z.dv.getUint16(e.lo + 26, true) + z.dv.getUint16(e.lo + 28, true); const raw = new Uint8Array(z.ab, start, e.size);
    if (e.method === 0) return raw.slice();
    if (e.method !== 8) throw new Error('bad');
    return inflate(raw);
  }
  async function readText(z, name) { const b = await read(z, name); return b ? dec.decode(b) : null; }

  /* ---------- the text of a document: paragraphs separated by a blank line ---------- */
  function xmlText(xml, paraNames, map) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml'); const out = [];
    if (doc.getElementsByTagName('parsererror').length) throw new Error('bad');
    const walk = (node, acc) => { for (const c of node.childNodes) { if (c.nodeType === 3) { if (map.text(c.parentNode)) acc.push(c.nodeValue); continue; } if (c.nodeType !== 1) continue; const m = map.el(c); if (m != null) { acc.push(m); continue; } walk(c, acc); } };
    for (const el of doc.getElementsByTagName('*')) {
      if (!paraNames.includes(el.localName)) continue; if (el.parentNode && paraNames.includes(el.parentNode.localName)) continue;
      const acc = []; walk(el, acc); out.push(acc.join('').replace(/[ \t]+/g, ' ').trim());
    }
    return out.filter(Boolean).join('\n\n');
  }
  async function docxText(buf) {
    const xml = await readText(entries(buf), 'word/document.xml'); if (xml == null) throw new Error('bad');
    return xmlText(xml, ['p'], { text: el => el.localName === 't', el: c => c.localName === 'tab' ? ' ' : c.localName === 'br' || c.localName === 'cr' ? '\n' : ['delText', 'instrText'].includes(c.localName) ? '' : null });
  }
  async function odtText(buf) {
    const xml = await readText(entries(buf), 'content.xml'); if (xml == null) throw new Error('bad');
    return xmlText(xml, ['p', 'h'], { text: () => true, el: c => c.localName === 's' ? ' '.repeat(+(c.getAttribute('text:c') || 1)) : c.localName === 'tab' ? ' ' : c.localName === 'line-break' ? '\n' : c.localName === 'note' ? '' : null });
  }
  /* a PDF: its text, line by line, with a blank line where the gap between lines says a new paragraph starts;
     page numbers and running heads ("Smith 2") on a page's first or last line are left out */
  let PDF = null;
  async function pdfLib() {
    if (PDF) return PDF;
    const base = new URL('assets/vendor/pdfjs/', document.baseURI).href;
    const lib = await import(base + 'pdf.min.js'); lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
    return (PDF = lib);
  }
  async function pdfLines(buf) {
    let lib; try { lib = await pdfLib(); } catch (e) { throw new Error('pdflib'); }
    let doc; try { doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise; }
    catch (e) { throw new Error(e && e.name === 'PasswordException' ? 'pdfpass' : 'bad'); }
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 120); i++) {
      const tc = await (await doc.getPage(i)).getTextContent(); const lines = []; let cur = null;
      for (const it of tc.items) {
        if (typeof it.str !== 'string') continue; const y = it.transform ? it.transform[5] : 0, x = it.transform ? it.transform[4] : 0, h = Math.abs(it.height || (it.transform ? it.transform[3] : 0)) || 10;
        if (!cur || Math.abs(y - cur.y) > Math.max(2, h * 0.4)) { if (cur) lines.push(cur); cur = { y, x, h, s: '' }; }
        if (it.str) { if (cur.s && !/\s$/.test(cur.s) && !/^\s/.test(it.str) && x > (cur.endX || 0) + h * 0.15) cur.s += ' '; cur.s += it.str; cur.endX = x + (it.width || 0); }
        if (it.hasEOL) { lines.push(cur); cur = null; }
      }
      if (cur) lines.push(cur);
      const L = lines.map(l => Object.assign(l, { s: l.s.replace(/\s+/g, ' ').trim() })).filter(l => l.s);
      const runner = s => { if (/^(page\s*)?\d{1,3}$/i.test(s)) return true; const m = /^[A-Z][\w'’-]*\s+(\d{1,3})$/.exec(s); return !!m && Math.abs(+m[1] - i) <= 1; };   // "3", "Page 3", "Smith 2" (its number the page's)
      while (L.length && runner(L[0].s)) L.shift();
      while (L.length && runner(L[L.length - 1].s)) L.pop();
      pages.push(L);
    }
    return pages;
  }
  async function pdfText(buf) {
    const pages = await pdfLines(buf);
    const all = pages.flat(); if (!all.length) return '';
    const gaps = []; for (let i = 1; i < all.length; i++) { const g = all[i - 1].y - all[i].y; if (g > 0) gaps.push(g); }
    gaps.sort((a, b) => a - b); const step = gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : 14;   // the lower median: a short page still finds its line spacing
    const xs = all.map(l => l.x).sort((a, b) => a - b); const left = xs[Math.floor(xs.length / 4)];
    const paras = []; let p = '';
    pages.forEach((L, pi) => L.forEach((l, i) => {
      const prev = i ? L[i - 1] : pi && pages[pi - 1].length ? pages[pi - 1][pages[pi - 1].length - 1] : null;
      const gap = prev && i ? prev.y - l.y : step;
      const indent = l.x > left + 12 && /[.!?:"”’)]$/.test(prev ? prev.s : '');
      if (p && (gap > step * 1.45 || indent || (i === 0 && pi && /[.!?"”]$/.test(p) && l.x > left + 12))) { paras.push(p); p = ''; }
      p = p ? (/\w-$/.test(p) && /^[a-z]/.test(l.s) ? p + l.s : p + ' ' + l.s) : l.s;   // "well-" + "worn": the hyphen stays (word processors break at a hyphen; they do not hyphenate)
    }));
    if (p) paras.push(p);
    return paras.join('\n\n');
  }
  /* a PDF of slides: each page's lines, as they are */
  async function pdfPages(buf) { return (await pdfLines(buf)).map((L, i) => ({ n: i + 1, text: L.map(l => l.s).join('\n') })).filter(p => p.text.trim()); }
  /* a .pptx: each slide's text in the presentation's order, with its speaker notes */
  const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main', R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const parseXml = xml => { const d = new DOMParser().parseFromString(xml, 'application/xml'); if (d.getElementsByTagName('parsererror').length) throw new Error('bad'); return d; };
  const paras = doc => [...doc.getElementsByTagNameNS(A_NS, 'p')].map(p => [...p.getElementsByTagNameNS(A_NS, 't')].map(t => t.textContent).join('').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const relsOf = async (z, path) => { const x = await readText(z, path.replace(/([^/]+)$/, '_rels/$1.rels')); const m = {}; if (x) [...parseXml(x).getElementsByTagName('Relationship')].forEach(r => { m[r.getAttribute('Id')] = { target: r.getAttribute('Target') || '', type: r.getAttribute('Type') || '' }; }); return m; };
  const resolve = (from, target) => { if (target.startsWith('/')) return target.slice(1); const parts = from.split('/').slice(0, -1); target.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); }); return parts.join('/'); };
  async function pptxSlides(buf) {
    const z = entries(buf); let order = [];
    try {
      const pres = await readText(z, 'ppt/presentation.xml'); const rels = await relsOf(z, 'ppt/presentation.xml');
      if (pres) order = [...parseXml(pres).getElementsByTagName('*')].filter(e => e.localName === 'sldId').map(e => rels[e.getAttributeNS(R_NS, 'id') || e.getAttribute('r:id')]).filter(Boolean).map(r => resolve('ppt/presentation.xml', r.target));
    } catch (e) { order = []; }
    if (!order.length) order = [...z.list.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
    if (!order.length) throw new Error('bad');
    const out = [];
    for (let i = 0; i < order.length; i++) {
      const xml = await readText(z, order[i]); if (xml == null) continue;
      const lines = paras(parseXml(xml)); let notes = [];
      const rels = await relsOf(z, order[i]); const nr = Object.values(rels).find(r => /notesSlide$/.test(r.type));
      if (nr) { const nx = await readText(z, resolve(order[i], nr.target)); if (nx) notes = paras(parseXml(nx)).filter(l => !/^\d{1,3}$/.test(l)); }
      const text = lines.join('\n') + (notes.length ? '\nNotes: ' + notes.join(' ') : '');
      if (text.trim()) out.push({ n: i + 1, text });
    }
    return out;
  }
  /* lecture slides a student opens: .pptx or .pdf → [{ n, text }]; an Error whose message says what to do */
  async function slideText(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (f.size > 60 * 1024 * 1024) throw new Error('That file is too big. Save the slides as a PDF without the pictures, or split the lecture.');
    if (!['pptx', 'pdf'].includes(ext) && f.type !== 'application/pdf') throw new Error('Mathub reads slides as .pptx or .pdf. From Google Slides or Keynote, download them as PowerPoint or PDF.');
    const buf = await f.arrayBuffer();
    try { return ext === 'pptx' ? await pptxSlides(buf) : await pdfPages(buf); }
    catch (e) {
      const m = e && e.message;
      if (m === 'inflate' || m === 'pdflib') throw new Error('This browser cannot open that file. Try another browser, or save the slides as a PDF.');
      if (m === 'pdfpass') throw new Error('That PDF is locked with a password. Save it without one and try again.');
      throw new Error('Those slides could not be read. Save them again as .pptx or .pdf and try again.');
    }
  }
  /* any file a student opens: .txt/.md, .docx, .odt or .pdf → its text; an Error whose message says what to do */
  async function fileText(f, what = 'text') {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (f.size > 25 * 1024 * 1024) throw new Error('That file is too big. Paste the text instead.');
    if (['txt', 'md', 'markdown', 'text'].includes(ext) || f.type === 'text/plain') return (await f.text()).replace(/\r\n?/g, '\n');
    const buf = await f.arrayBuffer();
    try {
      if (ext === 'docx') return await docxText(buf);
      if (ext === 'odt') return await odtText(buf);
      if (ext === 'pdf' || f.type === 'application/pdf') {
        const t = await pdfText(buf); if (!t.trim()) throw new Error('scanned');
        return t;
      }
    } catch (e) {
      const m = e && e.message;
      if (m === 'inflate' || m === 'pdflib') throw new Error('This browser cannot open that file. Copy the text from it and paste it here.');
      if (m === 'pdfpass') throw new Error('That PDF is locked with a password. Open it, copy the text and paste it here.');
      if (m === 'scanned') throw new Error('That PDF has no text to read (it may be a scan). Copy the text from the original document and paste it here.');
      throw new Error('That file could not be read. Copy the text from it and paste it here.');
    }
    throw new Error('Mathub reads .docx, .pdf, .odt and .txt files. For a Google Doc, use File › Download › Microsoft Word, or copy the text and paste it here.');
  }

  /* ---------- writing a .docx from blocks: [{ style: 'title' | 'h1' | 'h2' | 'p' | 'note' | 'pagebreak', text, runs: [{ t, b, i }] }] ---------- */
  const X = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const run = r => { const pr = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : ''); return String(r.t).split('\n').map((line, k) => `${k ? '<w:r><w:br/></w:r>' : ''}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join(''); };
  const STYLE = { title: 'Title', h1: 'Heading1', h2: 'Heading2', note: 'Note' };
  async function docx(blocks, opts = {}) {
    const font = X(opts.font || 'Times New Roman'), half = Math.round((opts.size || 12) * 2), line = opts.double ? 480 : 276;
    const body = blocks.map(b => {
      if (b.style === 'pagebreak') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      const runs = (b.runs && b.runs.length ? b.runs : [{ t: b.text || '' }]).map(run).join('');
      return `<w:p>${STYLE[b.style] ? `<w:pPr><w:pStyle w:val="${STYLE[b.style]}"/></w:pPr>` : ''}${runs}</w:p>`;
    }).join('');
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const head = h => `<w:style w:type="paragraph" w:styleId="${h[0]}"><w:name w:val="${h[1]}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${h[2]}" w:after="120"/>${h[0] === 'Title' ? '<w:jc w:val="center"/>' : ''}</w:pPr><w:rPr><w:b/><w:sz w:val="${h[3]}"/><w:szCs w:val="${h[3]}"/></w:rPr></w:style>`;
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="${half}"/><w:szCs w:val="${half}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${[['Title', 'Title', 0, half + 12], ['Heading1', 'heading 1', 360, half + 6], ['Heading2', 'heading 2', 240, half + 2]].map(head).join('')}<w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style></w:styles>` },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(opts.title || '')}</dc:title><dc:creator>${X(opts.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Mathub</Application></Properties>' }
    ];
    return zip(files);
  }
  /* hand the viewer a file to save */
  function download(data, name, type) {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const safeName = s => String(s || 'Mathub').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Mathub';

  App.Office = { crc32, zip, entries, read, readText, docxText, odtText, pdfText, pdfPages, pptxSlides, slideText, fileText, docx, download, safeName, DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
})(window);
