/* ============================================================
   Mathub — PowerPoint files for Slides (assets/office-slides.js): App.OOXML.pptxFromDeck, deckFromPptx, THEMES
   A deck: { theme, slides: [{ id, bg, items, notes }] } on a 960 × 540 slide (points, 16:9; PowerPoint's own size).
   Items: text { role: title | subtitle | body | text, html, size, font, color, valign, fill }, image { src, alt },
   shape { shape: rect | round | ellipse | triangle, fill, line, lineW, html, size, color } and line { x1, y1, x2, y2,
   color, lineW, arrow }; each but a line has x, y, w, h. A text's html is paragraphs (<p>, with data-list bullet or
   number and data-lvl 0–4) of bold, italic, underlined, struck, raised or lowered words, colours, sizes, fonts and links.
   - Writing: every slide on one blank layout with its background, boxes, pictures, shapes, lines and speaker notes
     written out in full (colours, fonts and sizes on each run), so it looks the same in PowerPoint, Keynote, Google
     Slides and LibreOffice, with the theme's colours and fonts in the file's theme too.
   - Reading: slides in presentation order; text boxes and placeholders (their place and type found on the layout or
     master when the slide does not say), groups flattened, pictures, shapes, lines, tables as text, backgrounds and
     notes; sizes, bullets, colours (theme colours too) and alignment as far as they are set.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App;
  const O = () => App.OOXML; const K = () => App.Office;
  const W = 960, H = 540, PT = 12700;   // EMU per point
  const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main', A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main', R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  /* ---------- themes: colours and fonts ---------- */
  const THEMES = {
    paper: { name: 'Paper', bg: '#ffffff', fg: '#1d2433', title: '#1d2433', muted: '#5b6478', accent: '#2f6fde', font: 'Calibri', titleFont: 'Calibri' },
    night: { name: 'Night', bg: '#151821', fg: '#e8ecf4', title: '#ffffff', muted: '#9aa3b5', accent: '#7aa2ff', font: 'Calibri', titleFont: 'Calibri' },
    chalk: { name: 'Chalkboard', bg: '#203b30', fg: '#f1f1e6', title: '#ffffff', muted: '#b9c4bb', accent: '#f2c94c', font: 'Verdana', titleFont: 'Verdana' },
    sand: { name: 'Sand', bg: '#f5efe4', fg: '#2c2a26', title: '#7a2e12', muted: '#6e665a', accent: '#c0562b', font: 'Georgia', titleFont: 'Georgia' },
    ocean: { name: 'Ocean', bg: '#0f3b5a', fg: '#eaf4fb', title: '#ffffff', muted: '#a9c6d8', accent: '#5fc6ea', font: 'Arial', titleFont: 'Arial' },
    bold: { name: 'Bold', bg: '#ffffff', fg: '#111111', title: '#111111', muted: '#555555', accent: '#e4572e', font: 'Arial', titleFont: 'Georgia' }
  };
  const ROLE_SIZE = { title: 40, subtitle: 24, body: 24, text: 20 };
  const themeOf = deck => THEMES[deck && deck.theme] || THEMES.paper;
  const hex = c => (O().X(String(c || '').replace('#', '')).toUpperCase().match(/^[0-9A-F]{6}$/) || ['000000'])[0];
  const emu = n => Math.round((+n || 0) * PT);

  /* ---------- a text's html, kept to what a slide can hold ---------- */
  function normSlide(html) {
    const src = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html').body;
    const out = document.createElement('div'); let para = null;
    const FONTS = O().FONTS;
    const newPara = (lvl, list, align) => { const p = document.createElement('p'); if (list) p.dataset.list = list; if (lvl) p.dataset.lvl = String(Math.max(0, Math.min(4, lvl))); if (align) p.style.textAlign = align; out.appendChild(p); return p; };
    function inline(n, parent) {
      for (const c of [...n.childNodes]) {
        if (c.nodeType === 3) { parent.appendChild(document.createTextNode(c.nodeValue.replace(/ /g, ' ').replace(/[\r\n]+/g, ' '))); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName;
        if (t === 'BR') { parent.appendChild(document.createElement('br')); continue; }
        if (/^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|EMBED|SVG|MATH|IMG|VIDEO|AUDIO|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t)) continue;
        const tag = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', INS: 'U' }[t] || t;
        let target = parent; const into = el => { target.appendChild(el); target = el; };
        if (/^(STRONG|EM|U|S|SUP|SUB)$/.test(tag)) into(document.createElement(tag));
        else if (tag === 'A') { const h = String(c.getAttribute('href') || '').trim(); if (/^(https?:|mailto:)/i.test(h)) { const a = document.createElement('a'); a.setAttribute('href', h); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); into(a); } }
        const st = c.style || {};
        if (tag !== 'STRONG' && /bold|[6-9]00/.test(st.fontWeight || '')) into(document.createElement('strong'));
        if (tag !== 'EM' && st.fontStyle === 'italic') into(document.createElement('em'));
        const keep = [];
        const col = hexColor(st.color || (tag === 'FONT' ? c.getAttribute('color') : '')); if (col) keep.push('color:' + col);
        const fs = String(st.fontSize || ''); const pt = /pt$/.test(fs) ? parseFloat(fs) : /px$/.test(fs) ? parseFloat(fs) * 0.75 : 0; if (pt >= 6 && pt <= 200) keep.push(`font-size:${Math.round(pt)}pt`);
        const ff = String(st.fontFamily || (tag === 'FONT' ? c.getAttribute('face') || '' : '')).split(',')[0].replace(/["']/g, '').trim(); const f = FONTS.find(x => x.toLowerCase() === ff.toLowerCase()); if (f) keep.push('font-family:' + f);
        if (keep.length) { const sp = document.createElement('span'); sp.setAttribute('style', keep.join(';')); into(sp); }
        inline(c, target);
      }
    }
    function block(n, lvl, list) {
      for (const c of [...n.childNodes]) {
        if (c.nodeType === 3) { if (!c.nodeValue.trim() && !para) continue; if (!para) para = newPara(lvl, list, ''); para.appendChild(document.createTextNode(c.nodeValue.replace(/ /g, ' ').replace(/[\r\n]+/g, ' '))); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName;
        if (t === 'UL' || t === 'OL') { para = null; block(c, n.tagName === 'LI' || /^(UL|OL)$/.test(n.tagName) ? lvl + 1 : lvl, t === 'OL' ? 'number' : 'bullet'); para = null; continue; }
        if (t === 'LI') { para = null; const own = c.cloneNode(true); own.querySelectorAll('ul, ol').forEach(x => x.remove()); para = newPara(lvl, list || 'bullet', c.style && ['center', 'right', 'justify'].includes(c.style.textAlign) ? c.style.textAlign : ''); inline(own, para); para = null; [...c.children].filter(x => /^(UL|OL)$/.test(x.tagName)).forEach(x => block({ childNodes: [x], tagName: 'LI' }, lvl, list)); continue; }
        if (/^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/.test(t)) {
          if (c.querySelector('p, div, ul, ol, li, h1, h2, h3')) { para = null; block(c, lvl, list); para = null; continue; }
          const l = c.dataset && c.dataset.lvl ? +c.dataset.lvl : lvl; const li = c.dataset && c.dataset.list ? (c.dataset.list === 'number' ? 'number' : c.dataset.list === 'bullet' ? 'bullet' : '') : (t === 'P' || t === 'DIV' ? list : '');
          const al = c.style && ['center', 'right', 'justify'].includes(c.style.textAlign) ? c.style.textAlign : '';
          para = newPara(l, li, al); inline(c, para); para = null; continue;
        }
        if (/^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|EMBED|SVG|MATH|IMG|TABLE)$/.test(t)) continue;
        if (!para) para = newPara(lvl, list, ''); inline({ childNodes: [c] }, para);
      }
    }
    block(src, 0, '');
    if (!out.firstChild) newPara(0, '', '');
    out.querySelectorAll('p').forEach(p => { if (!p.firstChild) p.appendChild(document.createElement('br')); });
    return out.innerHTML;
  }
  const hexColor = c => O().hexColor(c);
  const slideText = html => { const d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body; return [...d.querySelectorAll('p')].map(p => p.textContent.trim()).filter(Boolean).join('\n'); };

  /* ======================= writing ======================= */
  function runsOf(p, base) {   // a <p> → [{ text, b, i, u, s, sup, sub, color, size, font, link } | { br: true }]
    const out = [];
    const walk = (n, f) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (c.nodeValue) out.push(Object.assign({ text: c.nodeValue }, f)); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName; const g = Object.assign({}, f);
        if (t === 'BR') { out.push({ br: true, size: f.size }); continue; }
        if (t === 'STRONG' || t === 'B') g.b = true; if (t === 'EM' || t === 'I') g.i = true; if (t === 'U') g.u = true; if (t === 'S') g.s = true; if (t === 'SUP') g.sup = true; if (t === 'SUB') g.sub = true;
        if (t === 'A' && c.getAttribute('href')) g.link = c.getAttribute('href');
        const st = c.style; if (st) { const col = hexColor(st.color); if (col) g.color = col; if (/pt$/.test(st.fontSize)) g.size = parseFloat(st.fontSize); if (st.fontFamily) g.font = st.fontFamily.replace(/["']/g, '').split(',')[0].trim(); }
        walk(c, g);
      }
    };
    walk(p, Object.assign({}, base));
    while (out.length && out[out.length - 1].br) out.pop();   // a line ending in a break (what an editor leaves) or an empty one
    return out;
  }
  function txBody(html, o, rel) {   // o: { size, font, color, valign, center (default alignment) }
    const doc = new DOMParser().parseFromString('<body>' + normSlide(html) + '</body>', 'text/html').body;
    const X = O().X; let out = `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="${o.valign === 'middle' ? 'ctr' : o.valign === 'bottom' ? 'b' : 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>`;
    for (const p of doc.querySelectorAll('p')) {
      const lvl = Math.max(0, Math.min(4, +(p.dataset.lvl || 0))); const list = p.dataset.list || ''; const al = p.style.textAlign || o.align || '';
      const algn = { center: 'ctr', right: 'r', justify: 'just' }[al];
      let ppr = `<a:pPr${list ? ` marL="${285750 + lvl * 457200}" indent="-285750"` : lvl ? ` marL="${lvl * 457200}" indent="0"` : ' marL="0" indent="0"'}${lvl ? ` lvl="${lvl}"` : ''}${algn ? ` algn="${algn}"` : ''}>`;
      ppr += list === 'bullet' ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : list === 'number' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buNone/>';
      ppr += '</a:pPr>';
      const rpr = r => {
        const size = r.size || o.size; let a = `<a:rPr lang="en-US" sz="${Math.round(size * 100)}"${r.b ? ' b="1"' : ''}${r.i ? ' i="1"' : ''}${r.u || r.link ? ' u="sng"' : ''}${r.s ? ' strike="sngStrike"' : ''}${r.sup ? ' baseline="30000"' : r.sub ? ' baseline="-25000"' : ''} dirty="0">`;
        a += `<a:solidFill><a:srgbClr val="${hex(r.color || o.color)}"/></a:solidFill>`;
        const font = r.font || o.font; if (font) a += `<a:latin typeface="${X(font)}"/><a:cs typeface="${X(font)}"/>`;
        if (r.link && rel) a += `<a:hlinkClick r:id="${rel('hyperlink', r.link, true)}"/>`;
        return a + '</a:rPr>';
      };
      let body = '';
      for (const r of runsOf(p, {})) {
        if (r.br) { body += `<a:br><a:rPr lang="en-US" sz="${Math.round((r.size || o.size) * 100)}" dirty="0"/></a:br>`; continue; }
        body += `<a:r>${rpr(r)}<a:t>${X(r.text)}</a:t></a:r>`;
      }
      out += `<a:p>${ppr}${body}<a:endParaRPr lang="en-US" sz="${Math.round(o.size * 100)}" dirty="0"><a:solidFill><a:srgbClr val="${hex(o.color)}"/></a:solidFill></a:endParaRPr></a:p>`;
    }
    return out + '</p:txBody>';
  }
  const xfrm = (it, tag = 'a:xfrm', flip = '') => `<${tag}${flip}><a:off x="${emu(it.x)}" y="${emu(it.y)}"/><a:ext cx="${Math.max(1, emu(it.w))}" cy="${Math.max(1, emu(it.h))}"/></${tag}>`;
  const GEOM = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle' };

  async function pptxFromDeck(deck, opts = {}) {
    const T = themeOf(deck); const X = O().X; const XML = O().XML; const NS = O().NS;
    const slides = (deck.slides && deck.slides.length ? deck.slides : [{ items: [], notes: '' }]);
    const files = []; const media = []; const mediaKey = new Map();
    const PNS = `xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"`;
    const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
    const hasNotes = slides.some(s => String(s.notes || '').trim());
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i]; const n = i + 1; const rels = [{ id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }]; let rn = 2;
      const rel = (type, target, external) => { const id = 'rId' + rn++; rels.push({ id, type, target, external }); return id; };
      let shapes = ''; let sid = 2;
      for (const it of s.items || []) {
        const id = sid++;
        if (it.type === 'text') {
          const role = it.role || 'text'; const size = +it.size || ROLE_SIZE[role] || 20;
          const color = it.color || (role === 'title' ? T.title : role === 'subtitle' ? T.muted : T.fg); const font = it.font || (role === 'title' ? T.titleFont : T.font);
          shapes += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${{ title: 'Title', subtitle: 'Subtitle', body: 'Body' }[role] || 'Text'} ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(it)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${it.fill ? `<a:solidFill><a:srgbClr val="${hex(it.fill)}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr>${txBody(it.html, { size, font, color, valign: it.valign }, rel)}</p:sp>`;
        } else if (it.type === 'image') {
          const pic = await O().imageBytes(it.src); if (!pic) { sid--; continue; }
          const key = it.src.length + ':' + it.src.slice(-64); let m = mediaKey.get(key);
          if (!m) { m = { name: `image${media.length + 1}.${O().extOf(pic.mime)}`, data: pic.bytes, ext: O().extOf(pic.mime) }; media.push(m); mediaKey.set(key, m); }
          const rid = rel('image', '../media/' + m.name);
          shapes += `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}" descr="${X(it.alt || '')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(it)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
        } else if (it.type === 'shape') {
          const size = +it.size || 20; const fill = it.fill === 'none' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${hex(it.fill || T.accent)}"/></a:solidFill>`;
          const ln = it.line && it.line !== 'none' ? `<a:ln w="${Math.round((+it.lineW || 2) * PT)}"><a:solidFill><a:srgbClr val="${hex(it.line)}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
          shapes += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(it)}<a:prstGeom prst="${GEOM[it.shape] || 'rect'}"><a:avLst/></a:prstGeom>${fill}${ln}</p:spPr>${txBody(it.html || '', { size, font: T.font, color: it.color || '#ffffff', valign: 'middle', align: 'center' }, rel)}</p:sp>`;
        } else if (it.type === 'line') {
          const x = Math.min(it.x1, it.x2), y = Math.min(it.y1, it.y2), w = Math.abs(it.x2 - it.x1), h = Math.abs(it.y2 - it.y1);
          const flip = (it.x2 < it.x1 ? ' flipH="1"' : '') + (it.y2 < it.y1 ? ' flipV="1"' : '');
          shapes += `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm({ x, y, w: Math.max(w, 0.01), h: Math.max(h, 0.01) }, 'a:xfrm', flip)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${Math.round((+it.lineW || 2) * PT)}"><a:solidFill><a:srgbClr val="${hex(it.color || T.fg)}"/></a:solidFill>${it.arrow ? '<a:tailEnd type="triangle" w="med" len="med"/>' : ''}</a:ln></p:spPr></p:cxnSp>`;
        }
      }
      const bg = s.bg || T.bg;
      if (String(s.notes || '').trim()) rel('notesSlide', `../notesSlides/notesSlide${n}.xml`);
      files.push({ name: `ppt/slides/slide${n}.xml`, data: XML + `<p:sld ${PNS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(bg)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>` });
      files.push({ name: `ppt/slides/_rels/slide${n}.xml.rels`, data: O().RELS(rels) });
      if (String(s.notes || '').trim()) {
        const paras = String(s.notes).replace(/\r/g, '').split('\n').map(l => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${X(l)}</a:t></a:r></a:p>`).join('');
        files.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: XML + `<p:notes ${PNS}><p:cSld><p:spTree>${group}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>` });
        files.push({ name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, data: O().RELS([{ id: 'rId1', type: 'notesMaster', target: '../notesMasters/notesMaster1.xml' }, { id: 'rId2', type: 'slide', target: `../slides/slide${n}.xml` }]) });
      }
    }
    // the package around the slides
    const clrMap = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
    const lvl = (sz, font) => `<a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:buNone/><a:defRPr sz="${sz}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>`;
    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: XML + `<p:sldMaster ${PNS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${group}</p:spTree></p:cSld>${clrMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${lvl(4000, '+mj-lt')}</p:titleStyle><p:bodyStyle>${lvl(2400, '+mn-lt')}</p:bodyStyle><p:otherStyle>${lvl(1800, '+mn-lt')}</p:otherStyle></p:txStyles></p:sldMaster>` });
    files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: O().RELS([{ id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }, { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' }]) });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: XML + `<p:sldLayout ${PNS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
    files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: O().RELS([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]) });
    files.push({ name: 'ppt/theme/theme1.xml', data: themeXml(T, 'Mathub ' + T.name) });
    if (hasNotes) {
      files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: XML + `<p:notesMaster ${PNS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${group}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld>${clrMap}<p:notesStyle>${lvl(1200, '+mn-lt')}</p:notesStyle></p:notesMaster>` });
      files.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: O().RELS([{ id: 'rId1', type: 'theme', target: '../theme/theme2.xml' }]) });
      files.push({ name: 'ppt/theme/theme2.xml', data: themeXml(THEMES.paper, 'Notes') });
    }
    const prels = [{ id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' }];
    slides.forEach((s, i) => prels.push({ id: 'rId' + (i + 2), type: 'slide', target: `slides/slide${i + 1}.xml` }));
    let rx = slides.length + 2; const themeRid = 'rId' + rx++; prels.push({ id: themeRid, type: 'theme', target: 'theme/theme1.xml' });
    const notesRid = hasNotes ? 'rId' + rx++ : ''; if (hasNotes) prels.push({ id: notesRid, type: 'notesMaster', target: 'notesMasters/notesMaster1.xml' });
    prels.push({ id: 'rId' + rx++, type: 'presProps', target: 'presProps.xml' }, { id: 'rId' + rx++, type: 'viewProps', target: 'viewProps.xml' }, { id: 'rId' + rx++, type: 'tableStyles', target: 'tableStyles.xml' });
    files.push({ name: 'ppt/presentation.xml', data: XML + `<p:presentation ${PNS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${hasNotes ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesRid}"/></p:notesMasterIdLst>` : ''}<p:sldIdLst>${slides.map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W * PT}" cy="${H * PT}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle>${lvl(1800, '+mn-lt')}</p:defaultTextStyle></p:presentation>` });
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: O().RELS(prels) });
    files.push({ name: 'ppt/presProps.xml', data: XML + `<p:presentationPr ${PNS}/>` });
    files.push({ name: 'ppt/viewProps.xml', data: XML + `<p:viewPr ${PNS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
    files.push({ name: 'ppt/tableStyles.xml', data: XML + `<a:tblStyleLst xmlns:a="${A_NS}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
    const exts = [...new Set(media.map(m => m.ext))];
    const over = (part, type) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>`;
    const types = XML + `<Types xmlns="${NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map(e => `<Default Extension="${e}" ContentType="${e === 'jpeg' ? 'image/jpeg' : 'image/' + e}"/>`).join('')}`
      + over('ppt/presentation.xml', 'presentationml.presentation.main+xml') + over('ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster+xml') + over('ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout+xml')
      + slides.map((s, i) => over(`ppt/slides/slide${i + 1}.xml`, 'presentationml.slide+xml')).join('') + over('ppt/theme/theme1.xml', 'theme+xml')
      + (hasNotes ? over('ppt/notesMasters/notesMaster1.xml', 'presentationml.notesMaster+xml') + over('ppt/theme/theme2.xml', 'theme+xml') + slides.map((s, i) => String(s.notes || '').trim() ? over(`ppt/notesSlides/notesSlide${i + 1}.xml`, 'presentationml.notesSlide+xml') : '').join('') : '')
      + over('ppt/presProps.xml', 'presentationml.presProps+xml') + over('ppt/viewProps.xml', 'presentationml.viewProps+xml') + over('ppt/tableStyles.xml', 'presentationml.tableStyles+xml')
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' + over('docProps/app.xml', 'extended-properties+xml') + '</Types>';
    return K().zip([
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: O().RELS([{ id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' }, { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' }, { id: 'rId3', type: 'extended-properties', target: 'docProps/app.xml' }]) },
      { name: 'docProps/core.xml', data: O().CORE(opts.title || 'Presentation', O().isoNow()) }, { name: 'docProps/app.xml', data: O().APP },
      ...files, ...media.map(m => ({ name: 'ppt/media/' + m.name, data: m.data, store: true }))
    ]);
  }
  function themeXml(T, name) {
    const X = O().X; const c = v => `<a:srgbClr val="${hex(v)}"/>`;
    const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    return O().XML + `<a:theme xmlns:a="${A_NS}" name="${X(name)}"><a:themeElements><a:clrScheme name="${X(name)}"><a:dk1>${c(T.fg)}</a:dk1><a:lt1>${c(T.bg)}</a:lt1><a:dk2>${c(T.title)}</a:dk2><a:lt2>${c(T.muted)}</a:lt2><a:accent1>${c(T.accent)}</a:accent1><a:accent2>${c('#e4572e')}</a:accent2><a:accent3>${c('#2a9d8f')}</a:accent3><a:accent4>${c('#f2c94c')}</a:accent4><a:accent5>${c('#8e6bd8')}</a:accent5><a:accent6>${c('#5b6478')}</a:accent6><a:hlink>${c(T.accent)}</a:hlink><a:folHlink>${c(T.muted)}</a:folHlink></a:clrScheme>`
      + `<a:fontScheme name="${X(name)}"><a:majorFont><a:latin typeface="${X(T.titleFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${X(T.font)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
      + `<a:fmtScheme name="Office"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
  }

  /* ======================= reading ======================= */
  async function deckFromPptx(buf) {
    const z = K().entries(buf); const parse = O().parseXml; const X = O().X;
    const presXml = await K().readText(z, 'ppt/presentation.xml'); if (!presXml) throw new Error('bad');
    const pres = parse(presXml); const prels = await O().relsOf(z, 'ppt/presentation.xml');
    const sz = pres.getElementsByTagNameNS(P_NS, 'sldSz')[0]; const sw = sz ? +sz.getAttribute('cx') : W * PT, sh = sz ? +sz.getAttribute('cy') : H * PT;
    const fit = Math.min(W * PT / sw, H * PT / sh); const offX = (W * PT - sw * fit) / 2, offY = (H * PT - sh * fit) / 2;   // a 4:3 deck sits in the middle of 16:9
    const px = v => (v * fit + 0) / PT;
    const cache = {}; const xmlOf = async path => { if (!(path in cache)) { const t = await K().readText(z, path); cache[path] = t ? parse(t) : null; } return cache[path]; };
    const relCache = {}; const relsFor = async path => relCache[path] || (relCache[path] = await O().relsOf(z, path));
    const qa = (el, ns, name) => el ? [...el.getElementsByTagNameNS(ns, name)] : [];
    const kid = (el, ns, name) => el ? [...el.children].find(c => c.namespaceURI === ns && c.localName === name) || null : null;
    const kids = (el, ns, name) => el ? [...el.children].filter(c => c.namespaceURI === ns && (!name || c.localName === name)) : [];
    // the theme's colours, for schemeClr
    let scheme = {}; let themeFonts = { major: 'Calibri', minor: 'Calibri' };
    async function loadTheme(masterPath) {
      const mr = await relsFor(masterPath); const t = Object.values(mr).find(r => /\/theme$/.test(r.type)); if (!t) return;
      const th = await xmlOf(O().resolve(masterPath, t.target)); if (!th) return;
      const cs = qa(th, A_NS, 'clrScheme')[0]; scheme = {};
      if (cs) for (const c of cs.children) { const s = kid(c, A_NS, 'srgbClr'); const sys = kid(c, A_NS, 'sysClr'); scheme[c.localName] = s ? s.getAttribute('val') : sys ? (sys.getAttribute('lastClr') || '000000') : ''; }
      const maj = qa(th, A_NS, 'majorFont')[0], min = qa(th, A_NS, 'minorFont')[0];
      themeFonts = { major: (kid(maj, A_NS, 'latin') || { getAttribute: () => '' }).getAttribute('typeface') || 'Calibri', minor: (kid(min, A_NS, 'latin') || { getAttribute: () => '' }).getAttribute('typeface') || 'Calibri' };
    }
    const MAPC = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
    function colorOf(el) {   // a fill-like element (solidFill, a:fgClr…) → '#rrggbb' or ''
      if (!el) return ''; const s = kid(el, A_NS, 'srgbClr'); if (s) return '#' + (s.getAttribute('val') || '000000').toLowerCase();
      const sc = kid(el, A_NS, 'schemeClr'); if (sc) { const v = sc.getAttribute('val'); const c = scheme[MAPC[v] || v]; if (c) return '#' + c.toLowerCase(); }
      const pc = kid(el, A_NS, 'prstClr'); if (pc) return { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000' }[pc.getAttribute('val')] || '';
      const sys = kid(el, A_NS, 'sysClr'); if (sys) return '#' + (sys.getAttribute('lastClr') || '000000').toLowerCase();
      return '';
    }
    const fontOf = f => !f ? '' : f === '+mj-lt' ? themeFonts.major : f === '+mn-lt' ? themeFonts.minor : f;
    const schemeHex = v => scheme[MAPC[v] || v] ? '#' + scheme[MAPC[v] || v].toLowerCase() : '';
    function bgOf(doc) { const bg = qa(doc, P_NS, 'bg')[0]; if (!bg) return ''; const pr = kid(bg, P_NS, 'bgPr'); if (pr) return colorOf(kid(pr, A_NS, 'solidFill')); const ref = kid(bg, P_NS, 'bgRef'); return ref ? colorOf(ref) : ''; }
    // placeholders on the layout and master: their place and text defaults, by type and index
    function phOf(sp) { const nv = kid(sp, P_NS, 'nvSpPr') || kid(sp, P_NS, 'nvPicPr'); const ph = nv && kid(kid(nv, P_NS, 'nvPr'), P_NS, 'ph'); return ph ? { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || '' } : null; }
    function phMap(doc) { const m = []; if (!doc) return m; for (const sp of qa(doc, P_NS, 'sp')) { const ph = phOf(sp); if (ph) m.push({ ph, sp }); } return m; }
    const findPh = (list, ph) => list.find(x => ph.idx && x.ph.idx === ph.idx && x.ph.type === ph.type) || list.find(x => x.ph.type === ph.type || (ph.type === 'ctrTitle' && x.ph.type === 'title') || (ph.type === 'title' && x.ph.type === 'ctrTitle')) || (ph.idx ? list.find(x => x.ph.idx === ph.idx) : null) || (/^(body|obj)$/.test(ph.type) ? list.find(x => x.ph.type === 'body') : null);
    const deckOut = { theme: 'paper', slides: [] }; let firstMaster = '';
    const ids = qa(pres, P_NS, 'sldId');
    for (const sid of ids) {
      const r = prels[sid.getAttributeNS(R_NS, 'id') || sid.getAttribute('r:id')]; if (!r) continue;
      const path = O().resolve('ppt/presentation.xml', r.target); const doc = await xmlOf(path); if (!doc) continue;
      const srels = await relsFor(path);
      const layR = Object.values(srels).find(x => /\/slideLayout$/.test(x.type)); const layPath = layR ? O().resolve(path, layR.target) : ''; const lay = layPath ? await xmlOf(layPath) : null;
      const mR = layPath ? Object.values(await relsFor(layPath)).find(x => /\/slideMaster$/.test(x.type)) : null; const masPath = mR ? O().resolve(layPath, mR.target) : ''; const mas = masPath ? await xmlOf(masPath) : null;
      if (masPath && masPath !== firstMaster) { firstMaster = masPath; await loadTheme(masPath); }
      const layPh = phMap(lay), masPh = phMap(mas);
      const txStyle = kind => { const ts = mas && qa(mas, P_NS, 'txStyles')[0]; return ts ? kid(ts, P_NS, kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle') : null; };
      const slide = { id: 's' + (deckOut.slides.length + 1), bg: bgOf(doc) || bgOf(lay) || bgOf(mas) || '#ffffff', items: [], notes: '' };
      let n = 0; const nid = () => 'i' + (++n);
      async function addTree(tree, tf) {   // tf: the group transform: x' = (x - chOff) * scale + off
        for (const el of tree.children) {
          if (el.namespaceURI !== P_NS) { if (el.localName === 'AlternateContent') { const ch = [...el.children].find(c => c.localName === 'Choice') || [...el.children].find(c => c.localName === 'Fallback'); if (ch) await addTree(ch, tf); } continue; }
          const tag = el.localName;
          const box = (spPr, inherited) => {
            let xf = spPr && kid(spPr, A_NS, 'xfrm'); if (!xf && inherited) xf = inherited;
            const off = xf && kid(xf, A_NS, 'off'), ext = xf && kid(xf, A_NS, 'ext'); if (!off || !ext) return null;
            let x = +off.getAttribute('x'), y = +off.getAttribute('y'), w = +ext.getAttribute('cx'), h = +ext.getAttribute('cy');
            if (tf) { x = (x - tf.cx) * tf.sx + tf.ox; y = (y - tf.cy) * tf.sy + tf.oy; w *= tf.sx; h *= tf.sy; }
            return { x: (x * fit + offX) / PT, y: (y * fit + offY) / PT, w: px(w), h: px(h), flipH: xf.getAttribute('flipH') === '1', flipV: xf.getAttribute('flipV') === '1' };
          };
          if (tag === 'grpSp') {
            const gp = kid(el, P_NS, 'grpSpPr'); const xf = gp && kid(gp, A_NS, 'xfrm');
            const g = k => xf && kid(xf, A_NS, k); let t = tf;
            if (g('off') && g('ext') && g('chOff') && g('chExt')) {
              const ox = +g('off').getAttribute('x'), oy = +g('off').getAttribute('y'), ex = +g('ext').getAttribute('cx'), ey = +g('ext').getAttribute('cy'), cx = +g('chOff').getAttribute('x'), cy = +g('chOff').getAttribute('y'), cex = +g('chExt').getAttribute('cx') || 1, cey = +g('chExt').getAttribute('cy') || 1;
              const sx = ex / cex, sy = ey / cey; const inner = { cx, cy, sx, sy, ox, oy };
              t = tf ? { cx, cy, sx: sx * tf.sx, sy: sy * tf.sy, ox: (ox - tf.cx) * tf.sx + tf.ox, oy: (oy - tf.cy) * tf.sy + tf.oy } : inner;
            }
            await addTree(el, t); continue;
          }
          if (tag === 'pic') {
            const b = box(kid(el, P_NS, 'spPr')); const blip = qa(el, A_NS, 'blip')[0]; if (!b || !blip) continue;
            const rr = srels[blip.getAttributeNS(R_NS, 'embed') || blip.getAttribute('r:embed')]; if (!rr || rr.external) continue;
            const bytes = await K().read(z, O().resolve(path, rr.target)); const src = bytes ? O().dataUrl(bytes, rr.target) : null; if (!src) continue;
            const pr = qa(el, P_NS, 'cNvPr')[0];
            slide.items.push({ id: nid(), type: 'image', x: b.x, y: b.y, w: b.w, h: b.h, src: await shrink(src), alt: pr ? (pr.getAttribute('descr') || '').slice(0, 300) : '' }); continue;
          }
          if (tag === 'cxnSp' || (tag === 'sp' && /^(line|straightConnector1)$/.test((qa(el, A_NS, 'prstGeom')[0] || { getAttribute: () => '' }).getAttribute('prst')))) {
            const sp = kid(el, P_NS, 'spPr'); const b = box(sp); if (!b) continue; const ln = kid(sp, A_NS, 'ln');
            const x1 = b.flipH ? b.x + b.w : b.x, x2 = b.flipH ? b.x : b.x + b.w, y1 = b.flipV ? b.y + b.h : b.y, y2 = b.flipV ? b.y : b.y + b.h;
            slide.items.push({ id: nid(), type: 'line', x1, y1, x2, y2, color: colorOf(kid(ln, A_NS, 'solidFill')) || '#1d2433', lineW: ln && ln.getAttribute('w') ? Math.max(0.5, Math.min(20, +ln.getAttribute('w') / PT)) : 2, arrow: !!(kid(ln, A_NS, 'tailEnd') && kid(ln, A_NS, 'tailEnd').getAttribute('type') && kid(ln, A_NS, 'tailEnd').getAttribute('type') !== 'none') });
            continue;
          }
          if (tag === 'graphicFrame') {   // a table: its rows as lines of text
            const tbl = qa(el, A_NS, 'tbl')[0]; const b = box(null, kid(el, P_NS, 'xfrm')); if (!tbl || !b) continue;
            const rows = qa(tbl, A_NS, 'tr').map(tr => qa(tr, A_NS, 'tc').map(tc => qa(tc, A_NS, 't').map(t => t.textContent).join(' ').trim()).join(' · '));
            slide.items.push({ id: nid(), type: 'text', role: 'text', x: b.x, y: b.y, w: b.w, h: b.h, size: 16, html: rows.map(r => `<p>${X(r)}</p>`).join('') || '<p><br></p>' }); continue;
          }
          if (tag !== 'sp') continue;
          const ph = phOf(el); const spPr = kid(el, P_NS, 'spPr');
          const lp = ph ? findPh(layPh, ph) : null, mp = ph ? findPh(masPh, ph) || (lp ? findPh(masPh, lp.ph) : null) : null;
          const inh = (lp && qa(kid(lp.sp, P_NS, 'spPr'), A_NS, 'xfrm')[0]) || (mp && qa(kid(mp.sp, P_NS, 'spPr'), A_NS, 'xfrm')[0]) || null;
          const b = box(spPr, inh); if (!b) continue;
          if (ph && /^(sldNum|dt|ftr|hdr|sldImg)$/.test(ph.type)) continue;
          const nm = ((qa(el, P_NS, 'cNvPr')[0] || { getAttribute: () => '' }).getAttribute('name') || '').split(' ')[0];   // Mathub's own boxes say what they are in their names
          const role = ph ? (/^(title|ctrTitle)$/.test(ph.type) ? 'title' : ph.type === 'subTitle' ? 'subtitle' : 'body') : ({ Title: 'title', Subtitle: 'subtitle', Body: 'body' }[nm] || 'text');
          const geom = (qa(spPr, A_NS, 'prstGeom')[0] || { getAttribute: () => '' }).getAttribute('prst');
          const fillEl = kid(spPr, A_NS, 'solidFill'); const fill = colorOf(fillEl);
          const lnEl = kid(spPr, A_NS, 'ln'); const line = lnEl && !kid(lnEl, A_NS, 'noFill') ? colorOf(kid(lnEl, A_NS, 'solidFill')) : '';
          // text defaults: this shape's list style, then the layout's and master's placeholder, then the master's text styles
          const levels = [kid(kid(el, P_NS, 'txBody'), A_NS, 'lstStyle'), lp && kid(kid(lp.sp, P_NS, 'txBody'), A_NS, 'lstStyle'), mp && kid(kid(mp.sp, P_NS, 'txBody'), A_NS, 'lstStyle'), ph ? txStyle(role === 'title' ? 'title' : 'body') : txStyle('other')].filter(Boolean);
          const lvlDef = (lv, what) => { for (const L of levels) { const p = kid(L, A_NS, `lvl${lv + 1}pPr`); if (!p) continue; const v = what(p); if (v !== null && v !== undefined && v !== '') return v; } return null; };
          const body = kid(el, P_NS, 'txBody');
          const bp = body && kid(body, A_NS, 'bodyPr'); const bpOf = x => x && kid(kid(x.sp, P_NS, 'txBody'), A_NS, 'bodyPr');
          const anchor = (bp && bp.getAttribute('anchor')) || (bpOf(lp) && bpOf(lp).getAttribute('anchor')) || (bpOf(mp) && bpOf(mp).getAttribute('anchor')) || 't';
          const autofit = bp && kid(bp, A_NS, 'normAutofit'); const scale = autofit && autofit.getAttribute('fontScale') ? +autofit.getAttribute('fontScale') / 100000 : 1;
          let html = '', sizes = [], firstColor = '', firstFont = '';
          for (const p of (body ? kids(body, A_NS, 'p') : [])) {
            const pPr = kid(p, A_NS, 'pPr'); const lv = Math.max(0, Math.min(4, +(pPr && pPr.getAttribute('lvl')) || 0));
            const algn = (pPr && pPr.getAttribute('algn')) || lvlDef(lv, x => x.getAttribute('algn')) || '';
            const bu = el => el && (kid(el, A_NS, 'buNone') ? 'none' : kid(el, A_NS, 'buAutoNum') ? 'number' : kid(el, A_NS, 'buChar') || kid(el, A_NS, 'buBlip') ? 'bullet' : '');
            let list = bu(pPr) || lvlDef(lv, x => bu(x)) || ''; if (list === 'none') list = '';
            const defSz = lvlDef(lv, x => { const d = kid(x, A_NS, 'defRPr'); return d && d.getAttribute('sz') ? +d.getAttribute('sz') / 100 : null; });
            const defColor = lvlDef(lv, x => colorOf(kid(kid(x, A_NS, 'defRPr'), A_NS, 'solidFill')));
            const defFont = lvlDef(lv, x => { const l = kid(kid(x, A_NS, 'defRPr'), A_NS, 'latin'); return l ? fontOf(l.getAttribute('typeface')) : null; });
            let inner = '';
            for (const r of p.children) {
              if (r.namespaceURI !== A_NS) continue;
              if (r.localName === 'br') { inner += '<br>'; continue; }
              if (r.localName !== 'r' && r.localName !== 'fld') continue;
              const rp = kid(r, A_NS, 'rPr'); const t = (kid(r, A_NS, 't') || { textContent: '' }).textContent; if (!t) continue;
              const sz = rp && rp.getAttribute('sz') ? +rp.getAttribute('sz') / 100 : defSz || (role === 'title' ? 44 : 18);
              const size = Math.max(6, Math.round(sz * scale * fit)); sizes.push(size);
              const col = colorOf(kid(rp, A_NS, 'solidFill')) || defColor || schemeHex('tx1') || '#000000';
              const lat = kid(rp, A_NS, 'latin'); const font = (lat && fontOf(lat.getAttribute('typeface'))) || defFont || (role === 'title' ? themeFonts.major : themeFonts.minor);
              if (!firstColor) firstColor = col; if (!firstFont) firstFont = font;
              let open = '', close = ''; const wrap = (o, c) => { open += o; close = c + close; };
              const on = a => rp && rp.getAttribute(a) && rp.getAttribute(a) !== '0' && rp.getAttribute(a) !== 'none' && rp.getAttribute(a) !== 'noStrike';
              if (on('b')) wrap('<strong>', '</strong>'); if (on('i')) wrap('<em>', '</em>'); if (on('u')) wrap('<u>', '</u>'); if (on('strike')) wrap('<s>', '</s>');
              const bl = rp && +rp.getAttribute('baseline'); if (bl > 0) wrap('<sup>', '</sup>'); else if (bl < 0) wrap('<sub>', '</sub>');
              const st = [`font-size:${size}pt`, `color:${col}`, `font-family:${font}`];
              const hl = kid(rp, A_NS, 'hlinkClick'); const hr = hl && srels[hl.getAttributeNS(R_NS, 'id') || hl.getAttribute('r:id')]; const href = hr && hr.external && /^(https?:|mailto:)/i.test(hr.target) ? hr.target : '';
              inner += (href ? `<a href="${X(href)}">` : '') + `<span style="${st.join(';')}">` + open + X(t) + close + '</span>' + (href ? '</a>' : '');
            }
            const al = { ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[algn] || '';
            html += `<p${list ? ` data-list="${list}"` : ''}${lv ? ` data-lvl="${lv}"` : ''}${al ? ` style="text-align:${al}"` : ''}>${inner || '<br>'}</p>`;
          }
          const hasText = body && qa(body, A_NS, 't').some(t => t.textContent.trim());
          const common = sizes.length ? sizes.sort((a, b) => sizes.filter(v => v === b).length - sizes.filter(v => v === a).length)[0] : (role === 'title' ? 40 : 20);
          // the size, colour and font most of it has become the box's own; runs keep theirs only where they differ
          const tidy = h => normSlide(h.replace(new RegExp(`font-size:${common}pt;?`, 'g'), '').replace(firstColor ? new RegExp(`color:${firstColor};?`, 'g') : /^$/, '').replace(firstFont ? new RegExp(`font-family:${firstFont.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};?`, 'g') : /^$/, ''));
          const isShape = !ph && geom && geom !== 'rect' && GEOM_IN[geom];
          if (isShape || (!ph && (fill || line) && !hasText)) {
            slide.items.push({ id: nid(), type: 'shape', shape: GEOM_IN[geom] || 'rect', x: b.x, y: b.y, w: b.w, h: b.h, fill: fill || 'none', line: line || 'none', lineW: lnEl && lnEl.getAttribute('w') ? Math.max(0.5, Math.min(20, +lnEl.getAttribute('w') / PT)) : 2, html: hasText ? tidy(html) : '', size: common, color: firstColor || '#ffffff' });
            continue;
          }
          if (!hasText) continue;   // an empty placeholder ("Click to add text") shows nothing in a show either
          slide.items.push({ id: nid(), type: 'text', role, x: b.x, y: b.y, w: b.w, h: b.h, html: tidy(html), size: common, color: firstColor || '', font: firstFont || '', valign: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top', fill: fill || '' });
        }
      }
      const tree = qa(doc, P_NS, 'spTree')[0]; if (tree) await addTree(tree, null);
      const nr = Object.values(srels).find(x => /\/notesSlide$/.test(x.type));
      if (nr) { const nd = await xmlOf(O().resolve(path, nr.target)); if (nd) { for (const sp of qa(nd, P_NS, 'sp')) { const ph = phOf(sp); if (ph && ph.type === 'body') slide.notes = qa(sp, A_NS, 'p').map(p => qa(p, A_NS, 't').map(t => t.textContent).join('')).join('\n').trim(); } } }
      deckOut.slides.push(slide);
    }
    if (!deckOut.slides.length) throw new Error('bad');
    // the theme closest to the first slide's background, so new slides look like the rest
    const bg0 = deckOut.slides[0].bg; const dist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0); };
    deckOut.theme = Object.keys(THEMES).sort((a, b) => dist(THEMES[a].bg, bg0) - dist(THEMES[b].bg, bg0))[0];
    return deckOut;
  }
  const GEOM_IN = { rect: 'rect', roundRect: 'round', ellipse: 'ellipse', triangle: 'triangle', flowChartProcess: 'rect', flowChartAlternateProcess: 'round', snip1Rect: 'rect' };
  /** A big picture made smaller (at most 1920 px on its longer side) so a deck stays within its size. */
  async function shrink(src, max = 1920) {
    try {
      const img = await O().loadImage(src); const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return src;
      if (Math.max(w, h) <= max && src.length < 1.5e6) return src;
      const k = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const png = /^data:image\/png/.test(src) && c.width * c.height < 1.2e6; return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
    } catch (e) { return src; }
  }

  Object.assign(App.OOXML, { pptxFromDeck, deckFromPptx, THEMES, ROLE_SIZE, normSlide, slideText, shrink, SLIDE_W: W, SLIDE_H: H, themeOf });
})(window);
