/* ============================================================
   Mathub — Word, PowerPoint and Excel files for Docs, Slides and Sheets: App.OOXML
   Written and read in the browser (zip and unzip from assets/officekit.js); nothing is uploaded to convert a file.
   - .docx ⇄ a document's HTML: headings, paragraphs and quotes, alignment, bold, italic, underline, strikethrough,
     superscript and subscript, font, size, colour and highlight, links, bulleted and numbered lists (nested),
     tables, pictures and page breaks.
   - .pptx ⇄ a deck: each slide's title, text (with bullet levels), picture, background and speaker notes, 16:9.
   - .xlsx ⇄ a workbook: every sheet's cells (numbers, text, true/false, formulas with their last values), bold,
     italic, alignment, number formats and column widths.
   The packages are the parts Office itself needs and no more ([Content_Types].xml, relationships, document parts,
   styles, numbering, theme…), checked in the tests by unzipping them and by the python-docx, python-pptx and
   openpyxl readers.
   Docs' HTML is normalized first (normalize): only the tags and styles listed in ALLOW survive, so a pasted page or
   an opened file cannot carry scripts, event handlers or javascript: links into a document.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App;
  const K = () => App.Office;
  const X = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = {
    w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture', wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
    ct: 'http://schemas.openxmlformats.org/package/2006/content-types'
  };
  const RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const RELS = list => XML + `<Relationships xmlns="${NS.rel}">` + list.map(r => `<Relationship Id="${r.id}" Type="${r.type.startsWith('http') ? r.type : RT + r.type}" Target="${X(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') + '</Relationships>';
  const CORE = (title, now) => XML + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>Mathub</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const APP = XML + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Mathub</Application></Properties>';
  const isoNow = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const parseXml = s => { const d = new DOMParser().parseFromString(s, 'application/xml'); if (d.getElementsByTagName('parsererror').length) throw new Error('bad'); return d; };
  const kids = (el, ns, name) => [...(el ? el.children : [])].filter(c => c.namespaceURI === ns && (!name || c.localName === name));
  const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
  const attr = (el, ns, name) => el ? (el.getAttributeNS(ns, name) || el.getAttribute(ns === NS.w ? 'w:' + name : ns === NS.r ? 'r:' + name : name)) : null;
  const relsOf = async (z, path) => { const x = await K().readText(z, path.replace(/([^/]+)$/, '_rels/$1.rels')); const m = {}; if (x) [...parseXml(x).getElementsByTagName('Relationship')].forEach(r => { m[r.getAttribute('Id')] = { target: r.getAttribute('Target') || '', type: r.getAttribute('Type') || '', external: r.getAttribute('TargetMode') === 'External' }; }); return m; };
  const resolve = (from, target) => { if (target.startsWith('/')) return target.slice(1); const parts = from.split('/').slice(0, -1); target.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); }); return parts.join('/'); };
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  const extOf = mime => ({ 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'png', 'image/bmp': 'png' })[mime] || 'png';
  /** A data: URL → { mime, bytes } (WebP and BMP become PNG, which every Office opens). */
  async function imageBytes(src) {
    const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(src || ''); if (!m) return null;
    let mime = m[1].toLowerCase(), bytes = unb64(m[2]);
    if (mime === 'image/webp' || mime === 'image/bmp' || mime === 'image/svg+xml') {
      const img = await loadImage(src); const c = document.createElement('canvas'); c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1; c.getContext('2d').drawImage(img, 0, 0);
      bytes = unb64(c.toDataURL('image/png').split(',')[1]); mime = 'image/png';
    }
    return { mime, bytes };
  }
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });
  const dataUrl = (bytes, name) => { const ext = String(name).split('.').pop().toLowerCase(); const mime = MIME[ext]; return mime ? `data:${mime};base64,${b64(bytes)}` : null; };

  /* ======================= Docs: the HTML a document is kept in ======================= */
  const FONTS = ['Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
  const HIGHLIGHT = { yellow: '#fff59d', green: '#c8f7c5', cyan: '#b3ecf9', magenta: '#f8c4f2', lightGray: '#e3e3e3' };   // Word's names → what they look like here
  const ALLOW = { P: 1, H1: 1, H2: 1, H3: 1, BLOCKQUOTE: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, HR: 1, IMG: 1, STRONG: 1, EM: 1, U: 1, S: 1, SUP: 1, SUB: 1, A: 1, BR: 1, SPAN: 1 };
  const MAP = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', INS: 'U', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P', SECTION: 'P', ARTICLE: 'P', HEADER: 'P', FOOTER: 'P', PRE: 'P', THEAD: 'TBODY', TFOOT: 'TBODY', DL: 'P', DT: 'P', DD: 'P', FIGURE: 'P', FIGCAPTION: 'P' };
  const BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'HR']);
  const hexColor = c => { if (!c) return ''; c = String(c).trim(); let m = /^#([0-9a-f]{3})$/i.exec(c); if (m) return '#' + m[1].split('').map(x => x + x).join('').toLowerCase(); m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return '#' + m[1].toLowerCase(); m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(c); if (m) { if (m[4] !== undefined && +m[4] === 0) return ''; return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join(''); } return ''; };
  /** Any HTML (pasted, typed, opened) → the document's own: allowed tags only, inline styles only for font, size,
      colour, highlight and alignment, links only http(s) and mailto, pictures only data: images. */
  function normalize(html) {
    const src = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html').body;
    const out = document.createElement('div');
    const style = (from, to, inline) => {
      const st = from.style || {}; const keep = [];
      if (inline) {
        const color = hexColor(st.color); if (color && color !== '#000000') keep.push('color:' + color);
        const bg = hexColor(st.backgroundColor); if (bg && bg !== '#ffffff') keep.push('background-color:' + bg);
        const fs = String(st.fontSize || ''); let pt = /pt$/.test(fs) ? parseFloat(fs) : /px$/.test(fs) ? parseFloat(fs) * 0.75 : 0; if (pt) { pt = SIZES.reduce((b, s) => Math.abs(s - pt) < Math.abs(b - pt) ? s : b, 11); if (pt !== 11) keep.push(`font-size:${pt}pt`); }
        const ff = String(st.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(); const f = FONTS.find(x => x.toLowerCase() === ff.toLowerCase()); if (f && f !== 'Calibri') keep.push(`font-family:${f}`);
        if (/bold|[6-9]00/.test(st.fontWeight || '')) keep.push('font-weight:bold'); if (st.fontStyle === 'italic') keep.push('font-style:italic');
        const td = String(st.textDecoration || st.textDecorationLine || ''); if (/underline/.test(td)) keep.push('text-decoration:underline'); else if (/line-through/.test(td)) keep.push('text-decoration:line-through');
      } else { const al = st.textAlign; if (['center', 'right', 'justify'].includes(al)) keep.push('text-align:' + al); const ind = parseFloat(st.marginLeft || st.paddingLeft || 0); if (ind >= 20 && /^(P|H\d|BLOCKQUOTE)$/.test(to.tagName)) keep.push('margin-left:' + Math.min(10, Math.round(ind / 40)) * 40 + 'px'); }
      if (keep.length) to.setAttribute('style', keep.join(';'));
    };
    function copy(node, parent, inBlock) {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) { if (n.nodeValue) parent.appendChild(document.createTextNode(n.nodeValue.replace(/ /g, ' '))); continue; }
        if (n.nodeType !== 1) continue;
        let tag = n.tagName; if (['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'CANVAS', 'NOSCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM'].includes(tag)) continue;
        if (tag === 'FONT') { const sp = document.createElement('span'); const c = hexColor(n.getAttribute('color')); if (c) sp.style.color = c; const f = n.getAttribute('face'); if (f) sp.style.fontFamily = f; const k = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 }[n.getAttribute('size')]; if (k) sp.style.fontSize = k + 'pt'; tag = 'SPAN'; const el = document.createElement('span'); style(sp, el, true); parent.appendChild(el); copy(n, el, inBlock); continue; }
        tag = MAP[tag] || tag;
        if (!ALLOW[tag]) { copy(n, parent, inBlock); continue; }   // unknown: keep what is inside
        if (BLOCK.has(tag) && inBlock && !['UL', 'OL', 'TABLE'].includes(tag)) { copy(n, parent, inBlock); if (tag !== 'HR') parent.appendChild(document.createElement('br')); continue; }   // a paragraph inside a paragraph: its line
        const el = document.createElement(tag);
        if (tag === 'A') { const h = String(n.getAttribute('href') || '').trim(); if (/^(https?:|mailto:)/i.test(h)) { el.setAttribute('href', h); el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank'); } else { copy(n, parent, inBlock); continue; } }
        if (tag === 'IMG') { const s = String(n.getAttribute('src') || ''); if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) continue; el.setAttribute('src', s.replace(/\s+/g, '')); const w = parseInt(n.getAttribute('width') || n.style.width || 0, 10); if (w > 0) el.setAttribute('width', String(Math.min(1600, w))); el.setAttribute('alt', String(n.getAttribute('alt') || '').slice(0, 300)); parent.appendChild(el); continue; }
        if (tag === 'HR') { el.className = 'pb'; parent.appendChild(el); continue; }
        if (tag === 'TD' || tag === 'TH') { const cs = parseInt(n.getAttribute('colspan') || 1, 10); if (cs > 1) el.setAttribute('colspan', String(Math.min(20, cs))); }
        if (tag === 'SPAN' || tag === 'STRONG' || tag === 'EM' || tag === 'U' || tag === 'S') { style(n, el, true); if (tag === 'SPAN' && !el.getAttribute('style')) { copy(n, parent, inBlock); continue; } }
        if (/^(P|H1|H2|H3|BLOCKQUOTE|LI|TD|TH)$/.test(tag)) style(n, el, false);
        parent.appendChild(el); copy(n, el, inBlock || /^(P|H1|H2|H3|LI|TD|TH)$/.test(tag));
      }
    }
    copy(src, out, false);
    // loose text and inline pieces at the top go into paragraphs; empty lists and tables go
    const top = document.createElement('div'); let para = null;
    for (const n of [...out.childNodes]) {
      if (n.nodeType === 1 && (BLOCK.has(n.tagName) || n.tagName === 'IMG' && false)) { para = null; top.appendChild(n); continue; }
      if (n.nodeType === 1 && n.tagName === 'LI') { const ul = document.createElement('ul'); ul.appendChild(n); top.appendChild(ul); para = null; continue; }
      if (n.nodeType === 3 && !n.nodeValue.trim() && !para) continue;
      if (n.nodeType === 1 && n.tagName === 'BR' && !para) { top.appendChild(document.createElement('p')); continue; }
      if (!para) { para = document.createElement('p'); top.appendChild(para); } para.appendChild(n);
    }
    // a list straight inside a list (what a browser's indent makes) goes into the item above it, as Word nests them
    [...top.querySelectorAll('ul > ul, ul > ol, ol > ul, ol > ol')].reverse().forEach(l => { let prev = l.previousElementSibling; if (!prev || prev.tagName !== 'LI') { prev = document.createElement('li'); l.parentNode.insertBefore(prev, l); } prev.appendChild(l); });
    top.querySelectorAll('ul, ol').forEach(l => { [...l.childNodes].forEach(c => { if (c.nodeType === 1 && c.tagName !== 'LI' && c.tagName !== 'UL' && c.tagName !== 'OL') { const li = document.createElement('li'); l.replaceChild(li, c); li.appendChild(c); } else if (c.nodeType === 3) { if (c.nodeValue.trim()) { const li = document.createElement('li'); l.replaceChild(li, c); li.appendChild(c); } else c.remove(); } }); if (!l.querySelector('li')) l.remove(); });
    top.querySelectorAll('table').forEach(t => { if (!t.querySelector('td, th')) t.remove(); else if (!t.querySelector('tbody')) { const b = document.createElement('tbody'); [...t.querySelectorAll(':scope > tr')].forEach(r => b.appendChild(r)); t.appendChild(b); } });
    if (!top.firstChild) top.appendChild(document.createElement('p'));
    top.querySelectorAll('p, h1, h2, h3, li, td, th, blockquote').forEach(b => { if (!b.firstChild) b.appendChild(document.createElement('br')); });
    return top.innerHTML;
  }
  /** A document's words (for counts, and for draft feedback): its text, paragraph by paragraph. */
  function docText(html) {
    const d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body; const out = [];
    const walk = el => { for (const n of el.children) { if (/^(P|H1|H2|H3|BLOCKQUOTE|LI)$/.test(n.tagName) && !n.querySelector('p, li')) { const t = n.innerText !== undefined ? n.textContent : n.textContent; out.push(t.replace(/\s+/g, ' ').trim()); } else if (n.tagName === 'TABLE') n.querySelectorAll('tr').forEach(r => out.push([...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('\t'))); else walk(n); } };
    walk(d); return out.filter(Boolean).join('\n\n');
  }

  /* ======================= .docx: writing ======================= */
  const EMU = 9525;   // per CSS pixel
  const PAGES = { letter: { w: 12240, h: 15840, label: 'Letter' }, a4: { w: 11906, h: 16838, label: 'A4' } };
  async function docxFromHtml(html, opts = {}) {
    const page = PAGES[opts.page] || PAGES.letter; const usable = (page.w - 2 * 1440) / 1440 * 96;   // the text's width in px
    const root = new DOMParser().parseFromString('<body>' + normalize(html) + '</body>', 'text/html').body;
    const rels = [{ id: 'rId1', type: 'styles', target: 'styles.xml' }, { id: 'rId2', type: 'numbering', target: 'numbering.xml' }, { id: 'rId3', type: 'settings', target: 'settings.xml' }];
    const media = []; let relN = 4, picN = 1; const nums = [];   // numbered lists each start at 1: a w:num each
    const relFor = (type, target, external) => { const id = 'rId' + relN++; rels.push({ id, type, target, external }); return id; };
    const runProps = f => {
      const p = [];
      if (f.font) p.push(`<w:rFonts w:ascii="${X(f.font)}" w:hAnsi="${X(f.font)}" w:cs="${X(f.font)}"/>`);
      if (f.b) p.push('<w:b/>'); if (f.i) p.push('<w:i/>'); if (f.s) p.push('<w:strike/>');
      if (f.color) p.push(`<w:color w:val="${f.color.slice(1).toUpperCase()}"/>`);
      if (f.size) p.push(`<w:sz w:val="${Math.round(f.size * 2)}"/><w:szCs w:val="${Math.round(f.size * 2)}"/>`);
      if (f.hl) { const name = Object.keys(HIGHLIGHT).find(k => HIGHLIGHT[k] === f.hl); p.push(name ? `<w:highlight w:val="${name}"/>` : `<w:shd w:val="clear" w:color="auto" w:fill="${f.hl.slice(1).toUpperCase()}"/>`); }
      if (f.u) p.push('<w:u w:val="single"/>'); if (f.sup) p.push('<w:vertAlign w:val="superscript"/>'); else if (f.sub) p.push('<w:vertAlign w:val="subscript"/>');
      if (f.link) p.unshift('<w:rStyle w:val="Hyperlink"/>');
      return p.length ? `<w:rPr>${p.join('')}</w:rPr>` : '';
    };
    const textRuns = (text, f) => String(text).split(/(\t)/).map(part => part === '\t' ? `<w:r>${runProps(f)}<w:tab/></w:r>` : part ? `<w:r>${runProps(f)}<w:t xml:space="preserve">${X(part)}</w:t></w:r>` : '').join('');
    /** A block without the line break an editor leaves at its end (an empty line is one <br>): Word would show it as one more line. */
    const trim = el => { const c = el.cloneNode(true); for (;;) { let last = c; while (last.lastChild && last.lastChild.nodeType === 1 && last.lastChild.tagName !== 'BR' && last.lastChild.tagName !== 'IMG') last = last.lastChild; const b = last.lastChild; if (b && b.nodeType === 1 && b.tagName === 'BR') b.remove(); else if (b && b.nodeType === 3 && !b.nodeValue) b.remove(); else break; } return c; };
    async function inline(node, f) {
      let out = '';
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { out += textRuns(n.nodeValue.replace(/\n/g, ' '), f); continue; }
        if (n.nodeType !== 1) continue;
        const t = n.tagName; const g = Object.assign({}, f);
        if (t === 'BR') { out += `<w:r>${runProps(f)}<w:br/></w:r>`; continue; }
        if (t === 'IMG') { out += await picture(n); continue; }
        if (t === 'STRONG') g.b = true; if (t === 'EM') g.i = true; if (t === 'U') g.u = true; if (t === 'S') g.s = true; if (t === 'SUP') g.sup = true; if (t === 'SUB') g.sub = true;
        const st = n.style; if (st) { const c = hexColor(st.color); if (c) g.color = c; const bg = hexColor(st.backgroundColor); if (bg) g.hl = bg; if (st.fontSize) g.size = parseFloat(st.fontSize); if (st.fontFamily) g.font = st.fontFamily.replace(/["']/g, ''); if (st.fontWeight === 'bold') g.b = true; if (st.fontStyle === 'italic') g.i = true; if (/underline/.test(st.textDecoration)) g.u = true; if (/line-through/.test(st.textDecoration)) g.s = true; }
        if (t === 'A') { const href = n.getAttribute('href'); if (href) { g.link = true; out += `<w:hyperlink r:id="${relFor('hyperlink', href, true)}" w:history="1">${await inline(n, g)}</w:hyperlink>`; continue; } }
        out += await inline(n, g);
      }
      return out;
    }
    async function picture(img) {
      const pic = await imageBytes(img.getAttribute('src')); if (!pic) return '';
      let w = 0, h = 0; try { const im = await loadImage(img.getAttribute('src')); w = im.naturalWidth; h = im.naturalHeight; } catch (e) { return ''; }
      const want = Math.min(+img.getAttribute('width') || w, usable); const scale = w ? want / w : 1; const cx = Math.max(1, Math.round(w * scale * EMU)), cy = Math.max(1, Math.round(h * scale * EMU));
      const name = `image${media.length + 1}.${extOf(pic.mime)}`; media.push({ name: 'word/media/' + name, data: pic.bytes, ext: extOf(pic.mime) }); const rid = relFor('image', 'media/' + name); const id = picN++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}" descr="${X(img.getAttribute('alt') || '')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    const pPr = (el, extra) => { const p = [extra || '']; const al = el && el.style && el.style.textAlign; if (al) p.push(`<w:jc w:val="${{ center: 'center', right: 'right', justify: 'both' }[al] || 'left'}"/>`); const ml = el && el.style && parseFloat(el.style.marginLeft); if (ml) p.push(`<w:ind w:left="${Math.round(ml * 15)}"/>`); const s = p.join(''); return s ? `<w:pPr>${s}</w:pPr>` : ''; };
    async function blocks(parent) {
      let out = '';
      for (const el of parent.children) {
        const t = el.tagName;
        if (t === 'HR') { out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
        if (/^(P|H1|H2|H3|BLOCKQUOTE)$/.test(t)) { const style = { H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', BLOCKQUOTE: 'Quote' }[t]; out += `<w:p>${pPr(el, style ? `<w:pStyle w:val="${style}"/>` : '')}${await inline(trim(el), {})}</w:p>`; continue; }
        if (t === 'UL' || t === 'OL') { out += await list(el, 0, t === 'OL' ? newNum() : 1); continue; }
        if (t === 'TABLE') { out += await table(el); continue; }
      }
      return out;
    }
    const newNum = () => { const id = nums.length + 2; nums.push(id); return id; };   // w:num 1 is bullets; 2… numbered lists
    async function list(l, lvl, numId) {
      let out = '';
      for (const li of l.children) {
        if (li.tagName !== 'LI') continue;
        const own = document.createElement('li'); [...li.childNodes].forEach(c => { if (!(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL'))) own.appendChild(c.cloneNode(true)); });
        out += `<w:p>${pPr(li, `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(8, lvl)}"/><w:numId w:val="${numId}"/></w:numPr>`)}${await inline(trim(own), {})}</w:p>`;
        for (const sub of li.children) if (sub.tagName === 'UL' || sub.tagName === 'OL') out += await list(sub, lvl + 1, sub.tagName === 'OL' ? (l.tagName === 'OL' ? numId : newNum()) : 1);
      }
      return out;
    }
    async function table(tb) {
      const rows = [...tb.querySelectorAll(':scope > tbody > tr, :scope > tr')]; const cols = Math.max(1, ...rows.map(r => [...r.children].reduce((n, c) => n + (+c.getAttribute('colspan') || 1), 0)));
      const total = page.w - 2 * 1440, cw = Math.floor(total / cols);
      let out = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${cw * cols}" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${('<w:gridCol w:w="' + cw + '"/>').repeat(cols)}</w:tblGrid>`;
      for (const r of rows) {
        const head = [...r.children].every(c => c.tagName === 'TH'); out += `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`; let n = 0;
        for (const c of r.children) { const span = Math.min(cols - n, +c.getAttribute('colspan') || 1); n += span; const th = c.tagName === 'TH';
          out += `<w:tc><w:tcPr><w:tcW w:w="${cw * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}</w:tcPr><w:p>${pPr(c)}${await inline(trim(c), th ? { b: true } : {})}</w:p></w:tc>`; }
        if (n < cols) out += `<w:tc><w:tcPr><w:tcW w:w="${cw * (cols - n)}" w:type="dxa"/>${cols - n > 1 ? `<w:gridSpan w:val="${cols - n}"/>` : ''}</w:tcPr><w:p/></w:tc>`;
        out += '</w:tr>';
      }
      return out + '</w:tbl>';
    }
    let body = await blocks(root);
    if (!body || /<\/w:tbl>$/.test(body)) body += '<w:p/>';   // Word wants a paragraph last
    const W = `xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"`;
    // page numbers: at the top right after a name (MLA: "Smith 1"), or at the bottom in the middle
    const numbers = opts.numbers === 'top' || opts.numbers === 'bottom' ? opts.numbers : ''; let hf = '', hfPart = null;
    if (numbers) {
      const rid = relFor(numbers === 'top' ? 'header' : 'footer', numbers === 'top' ? 'header1.xml' : 'footer1.xml'); const tag = numbers === 'top' ? 'hdr' : 'ftr';
      const field = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
      const before = numbers === 'top' && String(opts.header || '').trim() ? `<w:r><w:t xml:space="preserve">${X(String(opts.header).trim().slice(0, 80))} </w:t></w:r>` : '';
      hfPart = { name: `word/${numbers === 'top' ? 'header1' : 'footer1'}.xml`, type: numbers === 'top' ? 'header' : 'footer', data: XML + `<w:${tag} ${W}><w:p><w:pPr><w:jc w:val="${numbers === 'top' ? 'right' : 'center'}"/></w:pPr>${before}${field}</w:p></w:${tag}>` };
      hf = `<w:${numbers === 'top' ? 'headerReference' : 'footerReference'} w:type="default" r:id="${rid}"/>`;
    }
    const doc = XML + `<w:document ${W}><w:body>${body}<w:sectPr>${hf}<w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const font = 'Calibri'; const spacing = [1, 1.15, 1.5, 2].includes(+opts.spacing) ? +opts.spacing : 1.15;
    const hstyle = (id, name, size, before) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="80"/><w:outlineLvl w:val="${+id.slice(-1) - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
    const styles = XML + `<w:styles xmlns:w="${NS.w}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${spacing >= 2 ? 0 : 160}" w:line="${Math.round(240 * spacing)}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
      + hstyle('Heading1', 'heading 1', 40, 360) + hstyle('Heading2', 'heading 2', 32, 280) + hstyle('Heading3', 'heading 3', 26, 200)
      + '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/><w:contextualSpacing/></w:pPr></w:style>'
      + '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>'
      + '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>'
      + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
      + '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style></w:styles>';
    const lvl = (i, fmt, text, font) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + 360 * i}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : ''}</w:lvl>`;
    const bullets = [...Array(9)].map((_, i) => lvl(i, 'bullet', ['•', '◦', '▪'][i % 3], ['Symbol', 'Courier New', 'Wingdings'][i % 3] === 'Symbol' ? '' : '')).join('');
    const decimals = [...Array(9)].map((_, i) => lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], `%${i + 1}.`)).join('');
    const numbering = XML + `<w:numbering xmlns:w="${NS.w}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decimals}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.map(id => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
    const settings = XML + `<w:settings xmlns:w="${NS.w}"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
    const exts = [...new Set(media.map(m => m.ext))];
    const types = XML + `<Types xmlns="${NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map(e => `<Default Extension="${e}" ContentType="${e === 'jpeg' ? 'image/jpeg' : 'image/' + e}"/>`).join('')}${hfPart ? `<Override PartName="/${hfPart.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${hfPart.type}+xml"/>` : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    return K().zip([
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: RELS([{ id: 'rId1', type: 'officeDocument', target: 'word/document.xml' }, { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' }, { id: 'rId3', type: 'extended-properties', target: 'docProps/app.xml' }]) },
      { name: 'word/document.xml', data: doc }, { name: 'word/_rels/document.xml.rels', data: RELS(rels) },
      { name: 'word/styles.xml', data: styles }, { name: 'word/numbering.xml', data: numbering }, { name: 'word/settings.xml', data: settings }, ...(hfPart ? [{ name: hfPart.name, data: hfPart.data }] : []),
      { name: 'docProps/core.xml', data: CORE(opts.title || 'Document', isoNow()) }, { name: 'docProps/app.xml', data: APP },
      ...media.map(m => ({ name: m.name, data: m.data, store: true }))
    ]);
  }

  /* ======================= .docx: reading ======================= */
  async function htmlFromDocx(buf) {
    const z = K().entries(buf);
    const main = (() => { for (const n of z.list.keys()) if (/^word\/document\d*\.xml$/.test(n)) return n; return 'word/document.xml'; })();
    const xml = await K().readText(z, main); if (!xml) throw new Error('bad');
    const doc = parseXml(xml); const rels = await relsOf(z, main);
    // styles: which paragraph styles are headings and quotes (by id, name or what they are based on)
    const S = {}; const sx = await K().readText(z, 'word/styles.xml');
    if (sx) { const sd = parseXml(sx); for (const st of sd.getElementsByTagNameNS(NS.w, 'style')) { const id = attr(st, NS.w, 'styleId'); const name = (attr(kid(st, NS.w, 'name'), NS.w, 'val') || '').toLowerCase(); const based = attr(kid(st, NS.w, 'basedOn'), NS.w, 'val'); const np = kid(kid(st, NS.w, 'pPr'), NS.w, 'numPr'); S[id] = { name, based, num: np ? { id: attr(kid(np, NS.w, 'numId'), NS.w, 'val'), lvl: +(attr(kid(np, NS.w, 'ilvl'), NS.w, 'val') || 0) } : null }; } }
    const styleNum = id => { for (let k = 0, s = id; s && k < 6; k++, s = S[s] && S[s].based) if (S[s] && S[s].num && S[s].num.id) return S[s].num; return null; };
    const kindOf = id => { for (let k = 0, s = id; s && k < 6; k++, s = S[s] && S[s].based) { const n = ((S[s] && S[s].name) || s).toLowerCase().replace(/\s+/g, ''); if (/^(heading1|title)$/.test(n)) return 'H1'; if (/^(heading2|subtitle)$/.test(n)) return 'H2'; if (/^heading[3-9]$/.test(n)) return 'H3'; if (/quote/.test(n)) return 'BLOCKQUOTE'; } return 'P'; };
    // numbering: which lists are numbered
    const NUM = {}; const nx = await K().readText(z, 'word/numbering.xml');
    if (nx) { const nd = parseXml(nx); const abs = {}; for (const an of nd.getElementsByTagNameNS(NS.w, 'abstractNum')) { const lv = {}; for (const l of kids(an, NS.w, 'lvl')) lv[attr(l, NS.w, 'ilvl')] = attr(kid(l, NS.w, 'numFmt'), NS.w, 'val') || 'decimal'; abs[attr(an, NS.w, 'abstractNumId')] = lv; }
      for (const n of nd.getElementsByTagNameNS(NS.w, 'num')) { const a = attr(kid(n, NS.w, 'abstractNumId'), NS.w, 'val'); NUM[attr(n, NS.w, 'numId')] = { lv: abs[a] || {}, abs: a, restart: !!n.getElementsByTagNameNS(NS.w, 'startOverride').length }; } }
    const HLS = { yellow: HIGHLIGHT.yellow, green: HIGHLIGHT.green, cyan: HIGHLIGHT.cyan, magenta: HIGHLIGHT.magenta, lightGray: HIGHLIGHT.lightGray, darkYellow: HIGHLIGHT.yellow, brightGreen: HIGHLIGHT.green, turquoise: HIGHLIGHT.cyan, pink: HIGHLIGHT.magenta };
    const imgCache = {};
    async function image(rid, cx, alt) { const r = rels[rid]; if (!r || r.external) return ''; const path = resolve(main, r.target); if (!(path in imgCache)) { const b = await K().read(z, path); imgCache[path] = b ? dataUrl(b, path) : null; } const src = imgCache[path]; if (!src) return ''; const w = cx ? Math.round(cx / EMU) : 0; return `<img src="${src}"${w ? ` width="${w}"` : ''} alt="${X(String(alt || '').slice(0, 300))}">`; }
    async function runs(p) {
      let out = '';
      const walk = async (el, link) => {
        for (const c of el.children) {
          if (c.namespaceURI !== NS.w) { if (c.localName === 'AlternateContent') { const ch = kid(c, c.namespaceURI, 'Choice') || kid(c, c.namespaceURI, 'Fallback'); if (ch) await walk(ch, link); } continue; }
          const n = c.localName;
          if (n === 'hyperlink') { const rid = attr(c, NS.r, 'id'); const r = rid && rels[rid]; const href = r && r.external && /^(https?:|mailto:)/i.test(r.target) ? r.target : ''; if (href) { out += `<a href="${X(href)}">`; await walk(c, true); out += '</a>'; } else await walk(c, link); continue; }
          if (n === 'ins' || n === 'smartTag' || n === 'customXml' || n === 'fldSimple' || n === 'sdt' || n === 'sdtContent') { await walk(n === 'sdt' ? (kid(c, NS.w, 'sdtContent') || c) : c, link); continue; }
          if (n !== 'r') continue;
          const pr = kid(c, NS.w, 'rPr'); const on = name => { const e = kid(pr, NS.w, name); if (!e) return false; const v = attr(e, NS.w, 'val'); return v !== 'false' && v !== '0' && v !== 'none'; };
          const style = []; let open = '', close = '';
          const wrap = (o, cl) => { open += o; close = cl + close; };
          if (on('b')) wrap('<strong>', '</strong>'); if (on('i')) wrap('<em>', '</em>'); if (on('u') && !link) wrap('<u>', '</u>'); if (on('strike') || on('dstrike')) wrap('<s>', '</s>');
          const va = attr(kid(pr, NS.w, 'vertAlign'), NS.w, 'val'); if (va === 'superscript') wrap('<sup>', '</sup>'); else if (va === 'subscript') wrap('<sub>', '</sub>');
          const col = attr(kid(pr, NS.w, 'color'), NS.w, 'val'); if (col && /^[0-9A-F]{6}$/i.test(col) && col !== '000000' && !link) style.push('color:#' + col.toLowerCase());
          const hl = attr(kid(pr, NS.w, 'highlight'), NS.w, 'val'); const shd = attr(kid(pr, NS.w, 'shd'), NS.w, 'fill'); if (hl && HLS[hl]) style.push('background-color:' + HLS[hl]); else if (shd && /^[0-9A-F]{6}$/i.test(shd) && shd.toUpperCase() !== 'FFFFFF') style.push('background-color:#' + shd.toLowerCase());
          const sz = attr(kid(pr, NS.w, 'sz'), NS.w, 'val'); if (sz && +sz !== 22) style.push(`font-size:${+sz / 2}pt`);
          const ff = attr(kid(pr, NS.w, 'rFonts'), NS.w, 'ascii'); if (ff && ff !== 'Calibri') style.push(`font-family:${ff}`);
          if (style.length) wrap(`<span style="${X(style.join(';'))}">`, '</span>');
          let inner = '';
          for (const e of c.children) {
            const ln = e.localName;
            if (ln === 'drawing' || ln === 'AlternateContent' || ln === 'pict') { const blip = e.getElementsByTagNameNS(NS.a, 'blip')[0]; const ext = e.getElementsByTagNameNS(NS.wp, 'extent')[0]; const pr = e.getElementsByTagNameNS(NS.wp, 'docPr')[0]; if (blip) inner += await image(attr(blip, NS.r, 'embed'), ext ? +ext.getAttribute('cx') : 0, pr ? pr.getAttribute('descr') || '' : ''); continue; }
            if (e.namespaceURI !== NS.w) continue;
            if (ln === 't') inner += X(e.textContent); else if (ln === 'tab') inner += '\t'; else if (ln === 'br') inner += attr(e, NS.w, 'type') === 'page' ? '\u0000PB\u0000' : '<br>'; else if (ln === 'noBreakHyphen') inner += '‑'; else if (ln === 'sym') inner += X(String.fromCharCode(parseInt(attr(e, NS.w, 'char') || '20', 16) & 0xFF || 32));
          }
          if (inner) out += open + inner + close;
        }
      };
      await walk(p, false); return out;
    }
    const html = []; const listStack = [];   // [{ tag, numId }]
    const closeLists = (to = 0) => { while (listStack.length > to) html.push(`</li></${listStack.pop().tag}>`); };
    async function para(p) {
      const pr = kid(p, NS.w, 'pPr'); const sid = attr(kid(pr, NS.w, 'pStyle'), NS.w, 'val'); const jc = attr(kid(pr, NS.w, 'jc'), NS.w, 'val');
      const align = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[jc] || '';
      const ind = kid(pr, NS.w, 'ind'); const left = ind ? +(attr(ind, NS.w, 'left') || attr(ind, NS.w, 'start') || 0) : 0;
      const css = [align ? `text-align:${align}` : '', left >= 300 ? `margin-left:${Math.round(left / 15)}px` : ''].filter(Boolean).join(';'); const st = css ? ` style="${css}"` : '';
      const np = kid(pr, NS.w, 'numPr'); const sn = styleNum(sid);   // a list from the paragraph, or from its style ("List Bullet")
      const numId = np && kid(np, NS.w, 'numId') ? attr(kid(np, NS.w, 'numId'), NS.w, 'val') : sn ? sn.id : null; const ilvl = np && kid(np, NS.w, 'ilvl') ? +(attr(kid(np, NS.w, 'ilvl'), NS.w, 'val') || 0) : sn ? sn.lvl : 0;
      let inner = await runs(p); const pageBreak = inner.includes('\u0000PB\u0000'); inner = inner.replace(/\u0000PB\u0000/g, '');
      if (numId && numId !== '0' && NUM[numId]) {
        const fmt = NUM[numId].lv[String(ilvl)] || 'decimal'; const tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol'; const depth = Math.min(8, ilvl) + 1;
        if (listStack.length > depth) closeLists(depth);
        if (listStack.length === depth) { const top = listStack[depth - 1]; const same = top.numId === numId || (NUM[top.numId] && NUM[top.numId].abs === NUM[numId].abs && !NUM[numId].restart);   // Word counts on through lists that share a definition, unless one starts again
          if (top.tag !== tag || (depth === 1 && tag === 'ol' && !same)) { closeLists(depth - 1); } else html.push('</li>'); }
        while (listStack.length < depth) { if (listStack.length && html[html.length - 1] === '</li>') html.pop(); listStack.push({ tag, numId }); html.push(`<${tag}>`); if (listStack.length < depth) html.push('<li>'); }
        html.push(`<li${st}>${inner || '<br>'}`); if (pageBreak) { closeLists(); html.push('<hr class="pb">'); } return;
      }
      closeLists();
      const tag = kindOf(sid).toLowerCase();
      if (pageBreak && !inner.replace(/<br>/g, '').trim()) { html.push('<hr class="pb">'); return; }   // a paragraph that only breaks the page
      html.push(`<${tag}${st}>${inner || '<br>'}</${tag}>`); if (pageBreak) html.push('<hr class="pb">');
    }
    async function tbl(t) {
      closeLists(); let out = '<table><tbody>';
      for (const tr of kids(t, NS.w, 'tr')) { out += '<tr>'; const th = !!kid(kid(tr, NS.w, 'trPr'), NS.w, 'tblHeader'); const cell = th ? 'th' : 'td'; for (const tc of kids(tr, NS.w, 'tc')) { const span = +(attr(kid(kid(tc, NS.w, 'tcPr'), NS.w, 'gridSpan'), NS.w, 'val') || 1); const vm = kid(kid(tc, NS.w, 'tcPr'), NS.w, 'vMerge'); if (vm && attr(vm, NS.w, 'val') !== 'restart') { out += `<${cell}><br></${cell}>`; continue; }
        const lines = []; for (const p of kids(tc, NS.w, 'p')) lines.push(await runs(p)); out += `<${cell}${span > 1 ? ` colspan="${span}"` : ''}>${lines.filter(Boolean).join('<br>') || '<br>'}</${cell}>`; } out += '</tr>'; }
      html.push(out + '</tbody></table>');
    }
    const body = doc.getElementsByTagNameNS(NS.w, 'body')[0]; if (!body) throw new Error('bad');
    const walkBody = async el => { for (const c of el.children) { if (c.namespaceURI !== NS.w) continue; if (c.localName === 'p') await para(c); else if (c.localName === 'tbl') await tbl(c); else if (c.localName === 'sdt') await walkBody(kid(c, NS.w, 'sdtContent') || c); else if (c.localName === 'customXml') await walkBody(c); } };
    await walkBody(body); closeLists();
    return normalize(html.join(''));
  }

  /** A Word file → a document: its html, and the page size, line spacing and page numbers it was set up with. */
  async function docFromDocx(buf) {
    const html = await htmlFromDocx(buf); const out = { html };
    try {
      const z = K().entries(buf); const main = [...z.list.keys()].find(n => /^word\/document\d*\.xml$/.test(n)) || 'word/document.xml';
      const doc = parseXml(await K().readText(z, main)); const rels = await relsOf(z, main);
      const sect = [...doc.getElementsByTagNameNS(NS.w, 'sectPr')].pop();
      const pg = sect && kid(sect, NS.w, 'pgSz'); if (pg && Math.abs(+attr(pg, NS.w, 'w') - PAGES.a4.w) < 200) out.page = 'a4';
      const sx = await K().readText(z, 'word/styles.xml'); if (sx) { const sd = parseXml(sx); const def = sd.getElementsByTagNameNS(NS.w, 'pPrDefault')[0]; const sp = def && def.getElementsByTagNameNS(NS.w, 'spacing')[0]; const line = sp ? +attr(sp, NS.w, 'line') : 0; const rule = sp ? attr(sp, NS.w, 'lineRule') : ''; if (line && (!rule || rule === 'auto')) { const v = line / 240; out.spacing = [1, 1.15, 1.5, 2].reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, 1.15); } }
      for (const ref of sect ? [...sect.children].filter(c => c.namespaceURI === NS.w && /^(header|footer)Reference$/.test(c.localName) && attr(c, NS.w, 'type') !== 'first' && attr(c, NS.w, 'type') !== 'even') : []) {
        const r = rels[attr(ref, NS.r, 'id')]; if (!r) continue; const x = await K().readText(z, resolve(main, r.target)); if (!x || !/PAGE/.test(x)) continue;
        const hd = parseXml(x); const text = [...hd.getElementsByTagNameNS(NS.w, 't')].map(t => t.textContent).join('').replace(/\d+\s*$/, '').trim();
        out.numbers = ref.localName === 'headerReference' ? 'top' : 'bottom'; if (out.numbers === 'top' && text) out.header = text.slice(0, 80); break;
      }
    } catch (e) {}
    return out;
  }

  App.OOXML = Object.assign(App.OOXML || {}, { normalize, docText, docxFromHtml, htmlFromDocx, docFromDocx, FONTS, SIZES, HIGHLIGHT, PAGES, X, XML, NS, RELS, CORE, APP, isoNow, parseXml, kids, kid, attr, relsOf, resolve, imageBytes, loadImage, dataUrl, b64, unb64, extOf, hexColor, EMU });
})(window);
