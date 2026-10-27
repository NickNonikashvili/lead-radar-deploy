/* ============================================================
   Mathub — Docs, the document editor (assets/office.js opens it; #/docs/<id>)
   A page that is written on: styles (normal text, three headings, quote), fonts and sizes, bold, italic, underline,
   strikethrough, raised and lowered text, text colour and highlight, alignment, bulleted and numbered lists (nested),
   indents, links, pictures, tables, page breaks, find and replace, word count, page size, line spacing and page
   numbers (MLA's "Lastname 1" at the top right, or a number at the bottom). Saves as Word (.docx), text, or PDF by
   printing; Get Bo's feedback hands the text to draft feedback in a writing class.
   - Its own undo history (Ctrl+Z, Ctrl+Y): every change, typing grouped by the second, with where the cursor was.
   - Pictures are kept in the page as blob: addresses, so the history stays small; they are written back as data: URLs
     when the document is saved or exported. Pasted and opened content is cleaned to what a document can hold
     (App.OOXML.normalize: no scripts, styles or outside pictures).
   - The body: { html, page: letter | a4, spacing: 1 | 1.15 | 1.5 | 2, numbers: '' | top | bottom, header }.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, toast } = App;
  const O = () => App.OOXML; const KIT = () => App.Officekit;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const BLOCKS = [['P', 'Normal text'], ['H1', 'Heading 1'], ['H2', 'Heading 2'], ['H3', 'Heading 3'], ['BLOCKQUOTE', 'Quote']];
  const SPACING = [[1, 'Single'], [1.15, '1.15'], [1.5, '1.5'], [2, 'Double']];
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const K = s => (isMac ? s.replace('Ctrl', '⌘') : s).replace(/\b(Ctrl|Shift|Alt|Enter|Tab|Del|Backspace)\b/g, k => t(k));   // a shortcut as this keyboard writes it: ⌘ on a Mac, Strg in German

  function mount(host, ctx, body) {
    const S = { page: body.page === 'a4' ? 'a4' : 'letter', spacing: [1, 1.15, 1.5, 2].includes(+body.spacing) ? +body.spacing : 1.15, numbers: ['top', 'bottom'].includes(body.numbers) ? body.numbers : '', header: String(body.header || '').slice(0, 80), range: null, img: null, imgs: new Map(), undo: [], redo: [], lastPush: 0, lastKind: '', find: null };
    const tb = (c, ic, label, key, extra = '') => `<button type="button" class="of-tbtn" data-c="${c}" aria-label="${esc(t(label))}${key ? ` (${K(key)})` : ''}" title="${esc(t(label))}${key ? ` (${K(key)})` : ''}"${extra}>${ic}</button>`;
    const txt = (s, cls) => `<span class="of-glyph ${cls || ''}" aria-hidden="true">${s}</span>`;
    host.innerHTML = `
      <div class="of-tb" role="toolbar" aria-label="${esc(t('Formatting'))}" id="dt-tb">
        ${tb('undo', icon('undo', 17), 'Undo', 'Ctrl+Z')}${tb('redo', icon('redo', 17), 'Redo', 'Ctrl+Y')}<span class="of-sep"></span>
        <select class="of-sel" data-c="block" aria-label="${esc(t('Style'))}">${BLOCKS.map(([v, l]) => `<option value="${v}">${esc(t(l))}</option>`).join('')}</select>
        <select class="of-sel of-sel-font" data-c="font" aria-label="${esc(t('Font'))}">${O().FONTS.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}</select>
        <select class="of-sel of-sel-size" data-c="size" aria-label="${esc(t('Font size'))}">${O().SIZES.map(z => `<option value="${z}">${z}</option>`).join('')}</select><span class="of-sep"></span>
        ${tb('bold', txt('B', 'b'), 'Bold', 'Ctrl+B', ' aria-pressed="false"')}${tb('italic', txt('I', 'i'), 'Italic', 'Ctrl+I', ' aria-pressed="false"')}${tb('underline', txt('U', 'u'), 'Underline', 'Ctrl+U', ' aria-pressed="false"')}${tb('strikeThrough', txt('S', 's'), 'Strikethrough', '', ' aria-pressed="false"')}
        ${tb('superscript', txt('x<sup>2</sup>'), 'Superscript', 'Ctrl+.', ' aria-pressed="false"')}${tb('subscript', txt('x<sub>2</sub>'), 'Subscript', 'Ctrl+,', ' aria-pressed="false"')}
        ${tb('color', `<span class="of-cbtn">${icon('textcolor', 17)}<i id="dt-cbar" style="background:#c0392b"></i></span>`, 'Text colour', '', ' aria-haspopup="dialog"')}${tb('hilite', `<span class="of-cbtn">${icon('marker', 17)}<i id="dt-hbar" style="background:#fff59d"></i></span>`, 'Highlight', '', ' aria-haspopup="dialog"')}<span class="of-sep"></span>
        ${tb('justifyLeft', icon('alignl', 17), 'Align left', '', ' aria-pressed="false"')}${tb('justifyCenter', icon('alignc', 17), 'Center', '', ' aria-pressed="false"')}${tb('justifyRight', icon('alignr', 17), 'Align right', '', ' aria-pressed="false"')}${tb('justifyFull', icon('alignj', 17), 'Justify', '', ' aria-pressed="false"')}
        ${tb('insertUnorderedList', icon('ul', 17), 'Bulleted list', 'Ctrl+Shift+8', ' aria-pressed="false"')}${tb('insertOrderedList', icon('ol', 17), 'Numbered list', 'Ctrl+Shift+7', ' aria-pressed="false"')}${tb('outdent', icon('outdent', 17), 'Decrease indent', 'Shift+Tab')}${tb('indent', icon('indent', 17), 'Increase indent', 'Tab')}<span class="of-sep"></span>
        ${tb('link', icon('link', 17), 'Link', 'Ctrl+K')}${tb('pic', icon('image', 17), 'Picture')}<input type="file" id="dt-pic" accept="image/png,image/jpeg,image/gif,image/webp" hidden>${tb('table', icon('table2', 17), 'Table', '', ' aria-haspopup="dialog"')}${tb('pagebreak', icon('pagebreak', 17), 'Page break', 'Ctrl+Enter')}${tb('clear', icon('eraser', 17), 'Clear formatting', 'Ctrl+\\')}<span class="of-sep"></span>
        ${tb('find', icon('search', 17), 'Find and replace', 'Ctrl+F')}
      </div>
      <div class="of-sub of-findbar" id="dt-find" hidden role="search" aria-label="${esc(t('Find and replace'))}">
        <input class="input sm" id="dt-q" placeholder="${esc(t('Find'))}" aria-label="${esc(t('Find'))}" spellcheck="false"><input class="input sm" id="dt-r" placeholder="${esc(t('Replace with'))}" aria-label="${esc(t('Replace with'))}" spellcheck="false">
        <button type="button" class="btn sm" data-f="prev" aria-label="${esc(t('Previous'))}">${icon('up', 14)}</button><button type="button" class="btn sm" data-f="next" aria-label="${esc(t('Next'))}">${icon('down', 14)}</button>
        <button type="button" class="btn sm" data-f="one">${esc(t('Replace'))}</button><button type="button" class="btn sm" data-f="all">${esc(t('Replace all'))}</button>
        <label class="check small"><input type="checkbox" id="dt-case"> ${esc(t('Match case'))}</label><span class="small muted" id="dt-fcount" role="status" aria-live="polite"></span><button type="button" class="btn sm ghost" data-f="close" aria-label="${esc(t('Close'))}">${icon('x', 14)}</button>
      </div>
      <div class="of-sub of-ctxbar" id="dt-tbar" hidden role="toolbar" aria-label="${esc(t('Table'))}">
        <span class="small muted">${esc(t('Table'))}</span>
        <button type="button" class="btn sm" data-tb="rowAbove">${esc(t('Row above'))}</button><button type="button" class="btn sm" data-tb="rowBelow">${esc(t('Row below'))}</button><button type="button" class="btn sm" data-tb="colLeft">${esc(t('Column left'))}</button><button type="button" class="btn sm" data-tb="colRight">${esc(t('Column right'))}</button>
        <button type="button" class="btn sm" data-tb="delRow">${esc(t('Delete row'))}</button><button type="button" class="btn sm" data-tb="delCol">${esc(t('Delete column'))}</button><button type="button" class="btn sm" data-tb="head" aria-pressed="false">${esc(t('Header row'))}</button><button type="button" class="btn sm danger" data-tb="delTable">${esc(t('Delete table'))}</button>
      </div>
      <div class="of-sub of-ctxbar" id="dt-ibar" hidden role="toolbar" aria-label="${esc(t('Picture'))}">
        <span class="small muted">${esc(t('Picture'))}</span>${[25, 50, 75].map(v => `<button type="button" class="btn sm" data-iw="${v}" title="${esc(t('{1} of the page width', v + '%'))}">${v}%</button>`).join('')}<button type="button" class="btn sm" data-iw="100">${esc(t('Full width'))}</button>
        <button type="button" class="btn sm" data-ib="alt">${esc(t('Describe it'))}</button><button type="button" class="btn sm danger" data-ib="del">${esc(t('Remove'))}</button>
      </div>
      <div class="of-doc-scroll" id="dt-scroll"><div class="of-page" id="dt-page" translate="no"><div class="of-hdr" id="dt-hdr" aria-hidden="true"></div>
        <div class="of-doc-body" id="dt-body" contenteditable="true" tabindex="0" spellcheck="true" translate="no" role="textbox" aria-multiline="true" aria-label="${esc(t('Document'))}"></div></div></div>
      <div class="of-doc-foot"><span id="dt-words" class="small" role="status" aria-live="off"></span>
        <label class="small">${esc(t('Page'))} <select class="of-sel sm" id="dt-psize"><option value="letter">${esc(t('US Letter'))}</option><option value="a4">A4</option></select></label>
        <label class="small">${esc(t('Line spacing'))} <select class="of-sel sm" id="dt-spacing">${SPACING.map(([v, l]) => `<option value="${v}">${esc(t(l))}</option>`).join('')}</select></label>
        <label class="small">${esc(t('Page numbers'))} <select class="of-sel sm" id="dt-num"><option value="">${esc(t('None'))}</option><option value="top">${esc(t('Top right, after a name'))}</option><option value="bottom">${esc(t('Bottom'))}</option></select></label>
        <label class="small" id="dt-hwrap"${S.numbers === 'top' ? '' : ' hidden'}>${esc(t('Name before the number'))} <input class="input sm" id="dt-head" maxlength="80" spellcheck="false" translate="no"></label>
      </div>`;
    const ed = $('#dt-body', host), bar = $('#dt-tb', host), page = $('#dt-page', host);
    const TB = KIT().toolbar(bar);

    /* ---------- pictures: blob: here, data: in the file ---------- */
    function toBlobUrl(src) {
      if (!/^data:image\//.test(src)) return src;
      try { const bytes = O().unb64(src.split(',')[1]); const mime = /^data:([^;]+)/.exec(src)[1]; const url = URL.createObjectURL(new Blob([bytes], { type: mime })); S.imgs.set(url, src); return url; } catch (e) { return src; }
    }
    function localize(root) { $$('img', root).forEach(i => { const s = i.getAttribute('src') || ''; if (/^data:/.test(s)) i.setAttribute('src', toBlobUrl(s)); }); }
    function html() {   // the document as it is saved: data: pictures, cleaned
      const c = ed.cloneNode(true); $$('img', c).forEach(i => { const s = i.getAttribute('src') || ''; if (/^blob:/.test(s)) { const d = S.imgs.get(s); if (d) i.setAttribute('src', d); else i.remove(); } i.classList.remove('sel'); });
      $$('.of-hit', c).forEach(x => x.replaceWith(...x.childNodes));
      return O().normalize(c.innerHTML);
    }
    ed.innerHTML = O().normalize(body.html || '<p><br></p>'); localize(ed); ed.style.setProperty('--of-pb', JSON.stringify(t('Page break')));

    /* ---------- the page's look: size, spacing, the header line ---------- */
    function paintPage() {
      page.dataset.page = S.page; page.style.setProperty('--of-line', String(S.spacing)); page.classList.toggle('dbl', S.spacing >= 2);
      const h = $('#dt-hdr', host); h.textContent = S.numbers === 'top' ? `${S.header ? S.header + ' ' : ''}1` : ''; h.hidden = S.numbers !== 'top';
      $('#dt-psize', host).value = S.page; $('#dt-spacing', host).value = String(S.spacing); $('#dt-num', host).value = S.numbers; $('#dt-head', host).value = S.header; $('#dt-hwrap', host).hidden = S.numbers !== 'top';
    }
    paintPage();
    const setting = (k, v) => { S[k] = v; paintPage(); ctx.changed(); };
    $('#dt-psize', host).addEventListener('change', e => setting('page', e.target.value === 'a4' ? 'a4' : 'letter'));
    $('#dt-spacing', host).addEventListener('change', e => setting('spacing', +e.target.value));
    $('#dt-num', host).addEventListener('change', e => setting('numbers', e.target.value));
    $('#dt-head', host).addEventListener('input', e => setting('header', e.target.value.slice(0, 80)));

    /* ---------- selection: where it is, kept while the toolbar has focus ---------- */
    const inEd = n => !!n && (n === ed || ed.contains(n));
    function keepRange() { const s = getSelection(); if (s.rangeCount && inEd(s.anchorNode) && inEd(s.focusNode)) S.range = s.getRangeAt(0).cloneRange(); }
    function useRange() {   // the cursor where it was before a toolbar, a list or a dialog took the focus (not an older one: typing may not have told us yet)
      const s = getSelection(); const here = s.rangeCount && inEd(s.anchorNode) && inEd(s.focusNode);
      if (document.activeElement !== ed) ed.focus({ preventScroll: true });
      if (here && document.activeElement === ed) { S.range = s.getRangeAt(0).cloneRange(); return; }
      if (S.range && inEd(S.range.startContainer) && inEd(S.range.endContainer)) { s.removeAllRanges(); s.addRange(S.range); }
      else if (!s.rangeCount || !inEd(s.anchorNode)) { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
    }
    const path = (node, off) => { const p = []; let n = node; while (n && n !== ed) { const par = n.parentNode; if (!par) return null; p.unshift([...par.childNodes].indexOf(n)); n = par; } return n === ed ? { p, off } : null; };
    const unpath = x => { if (!x) return null; let n = ed; for (const i of x.p) { n = n.childNodes[i]; if (!n) return null; } return { n, off: Math.min(x.off, n.nodeType === 3 ? n.nodeValue.length : n.childNodes.length) }; };
    function saveSel() { const s = getSelection(); if (!s.rangeCount || !inEd(s.anchorNode)) return null; return { a: path(s.anchorNode, s.anchorOffset), f: path(s.focusNode, s.focusOffset) }; }
    function restoreSel(x) { const a = x && unpath(x.a), f = x && unpath(x.f); if (!a || !f) return; try { getSelection().setBaseAndExtent(a.n, a.off, f.n, f.off); } catch (e) {} }

    /* ---------- undo history ---------- */
    const snap = () => ({ html: ed.innerHTML, sel: saveSel(), page: S.page, spacing: S.spacing, numbers: S.numbers, header: S.header });
    function push(kind) {
      const now = Date.now();
      if (kind === 'type' && S.lastKind === 'type' && now - S.lastPush < 1200) { S.lastPush = now; return; }
      S.undo.push(snap()); S.redo = []; S.lastPush = now; S.lastKind = kind;
      let size = 0; for (let i = S.undo.length - 1; i >= 0; i--) { size += S.undo[i].html.length; if (size > 40e6 || S.undo.length - i > 300) { S.undo.splice(0, i + 1); break; } }
    }
    function restore(x) { ed.innerHTML = x.html; S.page = x.page; S.spacing = x.spacing; S.numbers = x.numbers; S.header = x.header; paintPage(); ed.focus({ preventScroll: true }); restoreSel(x.sel); afterChange(); }
    function undo() { if (!S.undo.length) { toast(t('Nothing to undo')); return; } S.redo.push(snap()); restore(S.undo.pop()); S.lastKind = ''; }
    function redo() { if (!S.redo.length) return; S.undo.push(snap()); restore(S.redo.pop()); S.lastKind = ''; }
    function afterChange() { ctx.changed(); countSoon(); paintState(); }

    /* ---------- commands ---------- */
    function exec(cmd, val) { useRange(); push('cmd'); document.execCommand('styleWithCSS', false, false); document.execCommand(cmd, false, val == null ? null : val); keepRange(); afterChange(); }
    /* a size goes on as <font size="7"> (what the browser can do), then becomes the size in points; typed after a
       size was picked with nothing selected, the new letters come in that <font> too, and are turned the same way */
    function sizeFonts() { const pt = S.size; if (!pt) return; $$('font[size="7"]', ed).forEach(f => { const sel = saveSel(); const sp = document.createElement('span'); sp.style.fontSize = pt + 'pt'; const face = f.getAttribute('face'), col = f.getAttribute('color'); if (face) sp.style.fontFamily = face; if (col) sp.style.color = col; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); $$('span', sp).forEach(x => { x.style.fontSize = ''; if (!x.getAttribute('style')) x.replaceWith(...x.childNodes); }); restoreSel(sel); }); }
    function fontSize(pt) {
      useRange(); const s = getSelection(); if (!s.rangeCount) return; push('cmd'); S.size = pt;
      document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7'); sizeFonts();
      keepRange(); afterChange();
    }
    function color(kind, c) {
      useRange(); push('cmd');
      if (kind === 'fore') { document.execCommand('styleWithCSS', false, false); document.execCommand('foreColor', false, c || '#000000'); }
      else { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, c || 'transparent'); document.execCommand('styleWithCSS', false, false); }
      keepRange(); afterChange();
    }
    /** the top-level blocks (paragraphs, headings, quotes) the selection touches */
    function blocksInSel() {
      const s = getSelection(); if (!s.rangeCount || !inEd(s.anchorNode)) return [];
      const r = s.getRangeAt(0); const top = n => { while (n && n.parentNode !== ed) n = n.parentNode; return n; };
      const a = top(r.startContainer === ed ? ed.childNodes[r.startOffset] || ed.lastChild : r.startContainer), b = top(r.endContainer === ed ? ed.childNodes[Math.max(0, r.endOffset - 1)] || ed.lastChild : r.endContainer);
      const out = []; let n = a; while (n) { if (n.nodeType === 1) out.push(n); if (n === b) break; n = n.nextSibling; } return out;
    }
    function setBlock(tag) {
      useRange(); const L = blocksInSel().filter(b => /^(P|H1|H2|H3|BLOCKQUOTE|DIV)$/.test(b.tagName)); if (!L.length) { toast(t('Put the cursor in a paragraph first (not in a list or table).')); return; }
      const sel = saveSel(); push('cmd');
      L.forEach(b => { if (b.tagName === tag) return; const n = document.createElement(tag); if (b.getAttribute('style')) n.setAttribute('style', b.getAttribute('style')); while (b.firstChild) n.appendChild(b.firstChild); b.replaceWith(n); });
      restoreSel(sel); keepRange(); afterChange();
    }
    function indent(dir) {
      useRange(); const s = getSelection(); const inList = s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('li');
      if (inList && inEd(inList)) { exec(dir > 0 ? 'indent' : 'outdent'); return; }
      const L = blocksInSel().filter(b => /^(P|H1|H2|H3|BLOCKQUOTE)$/.test(b.tagName)); if (!L.length) return; push('cmd');
      L.forEach(b => { const m = Math.max(0, Math.min(400, (parseFloat(b.style.marginLeft) || 0) + dir * 40)); b.style.marginLeft = m ? m + 'px' : ''; if (!b.getAttribute('style')) b.removeAttribute('style'); });
      afterChange();
    }
    function insertHtml(h) { useRange(); push('cmd'); document.execCommand('styleWithCSS', false, false); document.execCommand('insertHTML', false, h); localize(ed); keepRange(); afterChange(); }
    async function link() {
      useRange(); const s = getSelection(); const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('a'); const cur = a && inEd(a) ? a : null;
      const sel = saveSel(); const text = s.isCollapsed && !cur;
      const v = await KIT().dialog({ title: cur ? t('Edit link') : t('Add a link'), fields: [...(text ? [{ name: 'text', label: t('Text to show'), value: '' }] : []), { name: 'url', label: t('Web address'), value: cur ? cur.getAttribute('href') : '', placeholder: 'https://' }], ok: cur ? t('Save') : t('Add'),
        alt: cur ? { label: t('Remove the link'), value: 'unlink' } : null,
        check: v => { const u = fixUrl(v.url); return u ? '' : t('Write a web address, like https://www.montana.edu'); } });
      ed.focus({ preventScroll: true }); restoreSel(sel); keepRange();
      if (!v) return;
      if (v === 'unlink') { if (cur && inEd(cur)) { push('cmd'); cur.replaceWith(...cur.childNodes); afterChange(); } return; }
      const url = fixUrl(v.url);
      if (cur) { push('cmd'); cur.setAttribute('href', url); afterChange(); return; }
      if (text) insertHtml(`<a href="${esc(url)}">${esc(v.text.trim() || url)}</a>&nbsp;`); else exec('createLink', url);
    }
    const fixUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (/^(https?:\/\/|mailto:)/i.test(u)) return /^mailto:|^https?:\/\/[^\s/]+\.[^\s]+/i.test(u) ? u : ''; if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(u)) return 'mailto:' + u; if (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(u)) return 'https://' + u; return ''; };
    async function picture(file) {
      try { const src = await KIT().pictureFrom(file, 1600); const url = toBlobUrl(src); const w = await new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = url; }); const max = S.page === 'a4' ? 602 : 624; insertHtml(`<img src="${url}" width="${Math.min(w || max, max)}" alt="">`); }
      catch (e) { toast(e.message, 4500); }
    }
    function tablePicker(btn) {
      KIT().closeMenus(); const p = document.createElement('div'); p.className = 'of-pop of-tgrid'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', t('Table size'));
      p.innerHTML = `<div class="of-tg" role="grid">${Array.from({ length: 8 }, (_, r) => `<div role="row">${Array.from({ length: 8 }, (_, c) => `<button type="button" role="gridcell" data-r="${r + 1}" data-c="${c + 1}" aria-label="${esc(t('{1} by {2}', r + 1, c + 1))}" tabindex="-1"></button>`).join('')}</div>`).join('')}</div><p class="small muted of-tg-l" aria-live="polite">${esc(t('{1} by {2}', 1, 1))}</p>`;
      document.body.appendChild(p); const rc = btn.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(rc.left, innerWidth - p.offsetWidth - 8)) + 'px'; p.style.top = rc.bottom + 4 + 'px';
      const cells = $$('[data-r]', p); const show = (r, c) => { cells.forEach(b => b.classList.toggle('on', +b.dataset.r <= r && +b.dataset.c <= c)); $('.of-tg-l', p).textContent = t('{1} by {2}', r, c); };
      const close = () => { p.remove(); document.removeEventListener('pointerdown', away, true); };
      const away = e => { if (!p.contains(e.target) && !btn.contains(e.target)) close(); };
      p.addEventListener('pointerover', e => { const b = e.target.closest('[data-r]'); if (b) show(+b.dataset.r, +b.dataset.c); });
      p.addEventListener('focusin', e => { const b = e.target.closest('[data-r]'); if (b) show(+b.dataset.r, +b.dataset.c); });
      p.addEventListener('keydown', e => { const b = e.target.closest('[data-r]'); if (e.key === 'Escape') { close(); btn.focus(); return; } if (!b) return; let r = +b.dataset.r, c = +b.dataset.c; if (e.key === 'ArrowRight') c = Math.min(8, c + 1); else if (e.key === 'ArrowLeft') c = Math.max(1, c - 1); else if (e.key === 'ArrowDown') r = Math.min(8, r + 1); else if (e.key === 'ArrowUp') r = Math.max(1, r - 1); else return; e.preventDefault(); $(`[data-r="${r}"][data-c="${c}"]`, p).focus(); });
      p.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; close(); const r = +b.dataset.r, c = +b.dataset.c; const row = tag => `<tr>${Array.from({ length: c }, () => `<${tag}><br></${tag}>`).join('')}</tr>`; insertHtml(`<table><tbody>${row('th')}${Array.from({ length: r - 1 }, () => row('td')).join('')}</tbody></table><p><br></p>`); });
      setTimeout(() => { document.addEventListener('pointerdown', away, true); cells[0].focus(); show(1, 1); }, 0);
    }

    /* ---------- tables: rows and columns where the cursor is ---------- */
    function cellNow() { const s = getSelection(); const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentNode); const c = el && el.closest('td, th'); return c && inEd(c) ? c : null; }
    function tableOp(op) {
      const cell = cellNow() || S.lastCell; if (!cell || !inEd(cell)) return; const tr = cell.parentNode, table = cell.closest('table'); const rows = [...table.rows]; const ci = cell.cellIndex; push('cmd');
      const blank = tag => { const x = document.createElement(tag); x.innerHTML = '<br>'; return x; };
      if (op === 'rowAbove' || op === 'rowBelow') { const n = document.createElement('tr'); [...tr.cells].forEach(() => n.appendChild(blank('td'))); tr.parentNode.insertBefore(n, op === 'rowAbove' ? tr : tr.nextSibling); }
      else if (op === 'colLeft' || op === 'colRight') rows.forEach(r => { const ref = r.cells[Math.min(ci, r.cells.length - 1)]; const x = blank(ref && ref.tagName === 'TH' ? 'th' : 'td'); r.insertBefore(x, op === 'colLeft' ? ref : ref ? ref.nextSibling : null); });
      else if (op === 'delRow') { if (rows.length === 1) table.remove(); else tr.remove(); }
      else if (op === 'delCol') { if (tr.cells.length === 1) table.remove(); else rows.forEach(r => { if (r.cells[ci]) r.cells[ci].remove(); }); }
      else if (op === 'delTable') table.remove();
      else if (op === 'head') { const first = rows[0]; const to = first.cells[0] && first.cells[0].tagName === 'TH' ? 'td' : 'th'; [...first.cells].forEach(c => { const x = document.createElement(to); if (c.getAttribute('colspan')) x.setAttribute('colspan', c.getAttribute('colspan')); while (c.firstChild) x.appendChild(c.firstChild); c.replaceWith(x); }); }
      afterChange(); paintContext();
    }
    /* ---------- pictures: size, description, remove ---------- */
    function imgOp(op, v) {
      const im = S.img; if (!im || !inEd(im)) return; push('cmd');
      if (op === 'width') { const max = S.page === 'a4' ? 602 : 624; im.setAttribute('width', String(Math.round(max * v / 100))); im.removeAttribute('height'); im.style.width = ''; im.style.height = ''; }
      else if (op === 'del') { im.remove(); S.img = null; }
      afterChange(); paintContext();
    }
    function selectImg(im) { $$('img.sel', ed).forEach(x => { if (x !== im) x.classList.remove('sel'); }); S.img = im; if (im) im.classList.add('sel'); paintContext(); }
    function paintContext() {
      const c = cellNow(); if (c) S.lastCell = c; $('#dt-tbar', host).hidden = !c;
      if (c) { const first = c.closest('table').rows[0]; $('[data-tb="head"]', host).setAttribute('aria-pressed', String(!!(first.cells[0] && first.cells[0].tagName === 'TH'))); }
      $('#dt-ibar', host).hidden = !(S.img && inEd(S.img));
    }

    /* ---------- the toolbar's state follows the cursor ---------- */
    let paintQ = 0;
    function paintState() {
      cancelAnimationFrame(paintQ); paintQ = requestAnimationFrame(() => {
        const s = getSelection(); if (!s.rangeCount || !inEd(s.anchorNode)) return;
        ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].forEach(c => { const b = $(`[data-c="${c}"]`, bar); let on = false; try { on = document.queryCommandState(c); } catch (e) {} if (b) b.setAttribute('aria-pressed', String(!!on)); });
        const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode; let top = el; while (top && top.parentNode !== ed && top !== ed) top = top.parentNode;
        const bsel = $('[data-c="block"]', bar); bsel.value = top && BLOCKS.some(([v]) => v === top.tagName) ? top.tagName : 'P'; bsel.disabled = !!el.closest('li, td, th');
        const cs = getComputedStyle(el); const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); const f = O().FONTS.find(x => x.toLowerCase() === fam.toLowerCase()) || 'Calibri'; $('[data-c="font"]', bar).value = f;
        const pt = Math.round(parseFloat(cs.fontSize) * 0.75); const zs = $('[data-c="size"]', bar); if (![...zs.options].some(o => +o.value === pt)) { $$('option.x', zs).forEach(o => o.remove()); const o = document.createElement('option'); o.className = 'x'; o.value = String(pt); o.textContent = String(pt); zs.appendChild(o); } zs.value = String(pt);
        paintContext();
      });
    }
    /* ---------- words ---------- */
    let countT = 0;
    const countSoon = () => { clearTimeout(countT); countT = setTimeout(paintCount, 250); };
    function paintCount() {
      const words = s => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu) || []).length;
      const all = words(ed.innerText || ''); const s = getSelection(); const part = s.rangeCount && !s.isCollapsed && inEd(s.anchorNode) ? words(s.toString()) : 0;
      $('#dt-words', host).textContent = part ? t('{1} of {2} words', num(part), num(all)) : all === 1 ? t('1 word') : t('{1} words', num(all));
    }
    paintCount();

    /* ---------- find and replace ---------- */
    function findOpen(replace) {
      const f = $('#dt-find', host); f.hidden = false; const q = $('#dt-q', host); const s = getSelection();
      if (s.rangeCount && !s.isCollapsed && inEd(s.anchorNode) && s.toString().length < 80 && !/\n/.test(s.toString())) q.value = s.toString();
      (replace ? $('#dt-r', host) : q).focus(); q.select(); findCount();
    }
    function matches() {
      const q = $('#dt-q', host).value; if (!q) return []; const cs = $('#dt-case', host).checked; const out = [];
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; const needle = cs ? q : q.toLowerCase();
      while ((n = walker.nextNode())) { const v = cs ? n.nodeValue : n.nodeValue.toLowerCase(); let i = v.indexOf(needle); while (i >= 0) { out.push({ n, i, len: q.length }); i = v.indexOf(needle, i + Math.max(1, q.length)); } }
      return out;
    }
    function findCount() { const m = matches(); $('#dt-fcount', host).textContent = $('#dt-q', host).value ? (m.length === 1 ? t('1 match') : t('{1} matches', num(m.length))) : ''; return m; }
    function findGo(dir) {
      const M = findCount(); if (!M.length) return; const s = getSelection(); let cur = -1;
      if (s.rangeCount && inEd(s.anchorNode)) { const r = s.getRangeAt(0); cur = dir > 0 ? M.findIndex(m => { const x = document.createRange(); x.setStart(m.n, m.i); return x.compareBoundaryPoints(Range.START_TO_START, r) > 0 || (r.collapsed && x.compareBoundaryPoints(Range.START_TO_START, r) === 0); }) : (() => { let k = -1; M.forEach((m, j) => { const x = document.createRange(); x.setStart(m.n, m.i); if (x.compareBoundaryPoints(Range.START_TO_START, r) < 0) k = j; }); return k; })(); }
      const m = M[cur >= 0 ? cur : dir > 0 ? 0 : M.length - 1]; const r = document.createRange(); r.setStart(m.n, m.i); r.setEnd(m.n, m.i + m.len); s.removeAllRanges(); s.addRange(r); S.range = r.cloneRange();
      const el = m.n.parentNode; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      $('#dt-fcount', host).textContent = t('{1} of {2}', num(M.indexOf(m) + 1), num(M.length));
    }
    function findReplace(all) {
      const q = $('#dt-q', host).value, rep = $('#dt-r', host).value; if (!q) return; const cs = $('#dt-case', host).checked;
      if (all) { const M = matches(); if (!M.length) { findCount(); return; } push('cmd'); for (let k = M.length - 1; k >= 0; k--) { const m = M[k]; m.n.nodeValue = m.n.nodeValue.slice(0, m.i) + rep + m.n.nodeValue.slice(m.i + m.len); } afterChange(); $('#dt-fcount', host).textContent = M.length === 1 ? t('Replaced 1') : t('Replaced {1}', num(M.length)); return; }
      const s = getSelection(); const cur = s.rangeCount && inEd(s.anchorNode) ? s.toString() : '';
      if (cur && (cs ? cur === q : cur.toLowerCase() === q.toLowerCase())) { useRange(); push('cmd'); document.execCommand('insertText', false, rep); afterChange(); }
      findGo(1);
    }
    $('#dt-find', host).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; const f = b.dataset.f; if (f === 'next') findGo(1); else if (f === 'prev') findGo(-1); else if (f === 'one') findReplace(false); else if (f === 'all') findReplace(true); else if (f === 'close') { $('#dt-find', host).hidden = true; useRange(); } });
    $('#dt-q', host).addEventListener('input', findCount); $('#dt-case', host).addEventListener('change', findCount);
    $('#dt-find', host).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (e.target.id === 'dt-r') findReplace(false); else findGo(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); $('#dt-find', host).hidden = true; useRange(); } });

    /* ---------- toolbar ---------- */
    bar.addEventListener('mousedown', e => { const b = e.target.closest('button.of-tbtn'); if (b) e.preventDefault(); });   // the editor keeps its selection
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b || b.tagName === 'SELECT') return; const c = b.dataset.c;
      if (c === 'pic') { keepRange(); $('#dt-pic', host).click(); return; }   // the picture goes where the cursor was
      if (c === 'undo') undo(); else if (c === 'redo') redo();
      else if (c === 'color') KIT().colorPicker(b, { label: t('Text colour'), value: S.lastFore, none: t('Automatic'), pick: v => { S.lastFore = v; $('#dt-cbar', host).style.background = v || '#000'; color('fore', v); } });
      else if (c === 'hilite') KIT().colorPicker(b, { label: t('Highlight'), value: S.lastHi, none: t('No highlight'), colors: ['#fff59d', '#c8f7c5', '#b3ecf9', '#f8c4f2', '#e3e3e3', '#ffd8a8'], pick: v => { S.lastHi = v; $('#dt-hbar', host).style.background = v || 'transparent'; color('hili', v); } });
      else if (c === 'indent') indent(1); else if (c === 'outdent') indent(-1);
      else if (c === 'link') link(); else if (c === 'table') tablePicker(b);
      else if (c === 'pagebreak') insertHtml('<hr class="pb"><p><br></p>');
      else if (c === 'clear') { exec('removeFormat'); exec('unlink'); }
      else if (c === 'find') findOpen(false);
      else exec(c);
    });
    $('#dt-pic', host).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) picture(f); });
    bar.addEventListener('change', e => { const c = e.target.dataset.c; if (c === 'block') setBlock(e.target.value); else if (c === 'font') exec('fontName', e.target.value); else if (c === 'size') fontSize(+e.target.value); });
    $('#dt-tbar', host).addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    $('#dt-tbar', host).addEventListener('click', e => { const b = e.target.closest('[data-tb]'); if (b) { useRange(); tableOp(b.dataset.tb); } });
    $('#dt-ibar', host).addEventListener('click', async e => {
      const b = e.target.closest('[data-iw], [data-ib]'); if (!b) return;
      if (b.dataset.iw) imgOp('width', +b.dataset.iw);
      else if (b.dataset.ib === 'del') imgOp('del');
      else if (b.dataset.ib === 'alt' && S.img) { const im = S.img; const v = await KIT().dialog({ title: t('Describe the picture'), text: t('A sentence for people who cannot see it: screen readers read it out, and Word keeps it.'), fields: [{ name: 'alt', label: t('Description'), value: im.getAttribute('alt') || '', maxlength: 300 }], ok: t('Save') }); if (v) { push('cmd'); im.setAttribute('alt', v.alt.trim()); afterChange(); } }
    });

    /* ---------- typing, keys, paste, drop ---------- */
    ed.addEventListener('beforeinput', e => {
      if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); return; }
      if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); return; }
      if (/^format/.test(e.inputType)) { push('cmd'); return; }
      push(/^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward|insertReplacementText)$/.test(e.inputType) ? 'type' : 'cmd');
    });
    ed.addEventListener('input', () => { if (!ed.firstChild) ed.innerHTML = '<p><br></p>'; sizeFonts(); afterChange(); keepRange(); });
    ed.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (mod && !e.altKey) {
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (k === 'y') { e.preventDefault(); redo(); return; }
        if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); exec({ b: 'bold', i: 'italic', u: 'underline' }[k]); return; }
        if (k === 'k') { e.preventDefault(); link(); return; }
        if (k === 'f' || k === 'h') { e.preventDefault(); findOpen(k === 'h'); return; }
        if (k === 'enter') { e.preventDefault(); insertHtml('<hr class="pb"><p><br></p>'); return; }
        if (k === '.') { e.preventDefault(); exec('superscript'); return; } if (k === ',') { e.preventDefault(); exec('subscript'); return; }
        if (k === '\\') { e.preventDefault(); exec('removeFormat'); return; }
        if (e.shiftKey && (e.code === 'Digit7' || e.code === 'Digit8')) { e.preventDefault(); exec(e.code === 'Digit7' ? 'insertOrderedList' : 'insertUnorderedList'); return; }
        if (k === 'p') { e.preventDefault(); print(); return; }
        if (k === 's') { e.preventDefault(); KIT().save(); return; }
      }
      if (mod && e.altKey && /^Digit[0-3]$/.test(e.code)) { e.preventDefault(); setBlock(['P', 'H1', 'H2', 'H3'][+e.code.slice(5)]); return; }
      if (e.key === 'Tab') {
        const c = cellNow();
        if (c) { e.preventDefault(); const cells = [...c.closest('table').querySelectorAll('td, th')]; let i = cells.indexOf(c) + (e.shiftKey ? -1 : 1); if (i >= cells.length) { S.lastCell = c; tableOp('rowBelow'); const all = [...c.closest('table').querySelectorAll('td, th')]; i = all.indexOf(c) + 1; const n = all[i]; if (n) placeIn(n); return; } if (i >= 0) placeIn(cells[i]); return; }
        const s = getSelection(); const li = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('li');
        if (li && inEd(li)) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
        return;   // anywhere else Tab leaves the editor, as on any web page
      }
      if (e.key === 'Backspace' || e.key === 'Delete') { if (S.img && inEd(S.img) && getSelection().isCollapsed) { e.preventDefault(); imgOp('del'); } }
    });
    const placeIn = cell => { const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); keepRange(); paintContext(); };
    ed.addEventListener('paste', async e => {
      const cd = e.clipboardData; if (!cd) return;
      const files = [...(cd.files || [])].filter(f => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); for (const f of files) await picture(f); return; }
      const h = cd.getData('text/html'), p = cd.getData('text/plain'); e.preventDefault();
      if (h && h.trim()) { insertHtml(O().normalize(h.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, ''))); return; }
      if (p) { const parts = p.replace(/\r/g, '').split(/\n{2,}/); if (parts.length === 1 && !/\n/.test(p)) { useRange(); push('cmd'); document.execCommand('insertText', false, p); afterChange(); } else insertHtml(parts.map(x => `<p>${esc(x).replace(/\n/g, '<br>') || '<br>'}</p>`).join('')); }
    });
    ed.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    ed.addEventListener('drop', async e => {
      const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter(f => /^image\//.test(f.type)); if (!files.length) return; e.preventDefault();
      const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null; if (r && inEd(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); keepRange(); }
      for (const f of files) await picture(f);
    });
    ed.addEventListener('click', e => {
      const im = e.target.closest('img'); selectImg(im && inEd(im) ? im : null);
      const a = e.target.closest('a'); if (a && inEd(a) && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const u = a.getAttribute('href'); if (/^(https?:|mailto:)/i.test(u)) window.open(u, '_blank', 'noopener'); }
    });
    const onSel = () => { if (inEd(getSelection().anchorNode)) { keepRange(); paintState(); const s = getSelection(); if (s.rangeCount && !s.isCollapsed) countSoon(); else if (S.hadSel) paintCount(); S.hadSel = !s.isCollapsed; } };
    document.addEventListener('selectionchange', onSel);
    const keys = e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f' && host.contains(document.activeElement)) { e.preventDefault(); findOpen(false); } };
    document.addEventListener('keydown', keys);

    /* ---------- print, files, Bo ---------- */
    function printable() {
      const hdr = S.numbers === 'top' && S.header ? S.header.replace(/[\\"]/g, '\\$&').replace(/[\u0000-\u001f]/g, '') + ' ' : '';
      const style = `@page { size: ${S.page === 'a4' ? 'A4' : 'letter'}; margin: 1in; ${S.numbers === 'top' ? `@top-right { content: "${hdr}" counter(page); font: 11pt Calibri, Carlito, Arial, sans-serif; }` : S.numbers === 'bottom' ? '@bottom-center { content: counter(page); font: 11pt Calibri, Carlito, Arial, sans-serif; }' : ''} }`;
      return { style, html: `<div class="of-print-doc" style="--of-line:${S.spacing}">${html()}</div>` };
    }
    function print() { const p = printable(); KIT().printHtml(p.html, ctx.title(), 'doc', p.style); }
    async function word() { try { await KIT().save(); await KIT().download('doc', { title: ctx.title() }, api.body()); } catch (e) { toast(t('That file could not be made here.'), 4500); } }
    function text() { const s = O().docText(html()); App.Office.download(new Blob([s + '\n'], { type: 'text/plain;charset=utf-8' }), App.Office.safeName(ctx.title()) + '.txt'); }
    async function bo() {
      const words = (O().docText(html()).match(/\S+/g) || []).length;
      if (words < 60) { toast(t('Write a bit more first: Bo needs at least 60 words to give useful feedback.'), 4500); return; }
      const Courses = global.Courses || {}; const mine = (App.myCourses ? App.myCourses() : []).filter(id => Courses[id]);
      if (!mine.length) { toast(t('Add a class first.')); return; }
      const v = await KIT().dialog({ title: t('Get Bo’s feedback'), text: t('Bo reads it as a writing tutor, against a paper in one of your classes: he marks passages and asks questions, and never writes it for you. The text goes to draft feedback, where you pick the paper.'), fields: [{ name: 'c', label: t('Which class is it for?'), type: 'select', value: mine.includes('writ') ? 'writ' : mine[0], options: mine.map(id => [id, `${Courses[id].code} ${Courses[id].short || Courses[id].name || ''}`.trim()]) }], ok: t('Continue') });
      if (!v) return;
      try {
        if (App.loadCourse && !Courses[v.c].loaded) await App.loadCourse(v.c);
        if (!(Courses[v.c].DRAFTS || []).length) { toast(t('{1} has no papers for draft feedback.', Courses[v.c].code), 4500); return; }
        const key = 'mathub-draft-form-' + v.c; let f = {}; try { f = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) {}
        f.text = O().docText(html()); try { localStorage.setItem(key, JSON.stringify(f)); } catch (e) { toast(t('This document is too long to hand over. Copy its text into draft feedback instead.'), 5000); return; }
        await KIT().save(); location.hash = `#/${v.c}/drafts`;
      } catch (e) { toast(e.message || t('That class could not be opened.'), 4500); }
    }
    ctx.bar.innerHTML = `<button type="button" class="btn sm of-bo" id="dt-bo">${icon('chat', 15)} <span>${esc(t('Get Bo’s feedback'))}</span></button><button type="button" class="btn sm" id="dt-print" aria-label="${esc(t('Print'))}" title="${esc(t('Print'))}">${icon('print', 15)}</button><button type="button" class="btn sm" id="dt-file" data-menu aria-haspopup="menu" aria-expanded="false">${icon('download', 15)} <span>${esc(t('File'))}</span></button>`;
    $('#dt-bo', ctx.bar).addEventListener('click', bo); $('#dt-print', ctx.bar).addEventListener('click', print);
    $('#dt-file', ctx.bar).addEventListener('click', e => KIT().menu(e.currentTarget, ctx.fileMenu([
      { label: t('Download as Word (.docx)'), icon: 'download', run: word }, { label: t('Download as text (.txt)'), icon: 'file', run: text }, { label: t('Print or save as PDF'), icon: 'print', key: K('Ctrl+P'), run: print }, { sep: true }
    ]), { right: true, label: t('File') }));

    const api = {
      body: () => ({ html: html(), page: S.page, spacing: S.spacing, numbers: S.numbers, header: S.header }),
      focus: () => ed.focus(),
      unmount: () => { document.removeEventListener('selectionchange', onSel); document.removeEventListener('keydown', keys); S.imgs.forEach((v, k) => URL.revokeObjectURL(k)); }
    };
    setTimeout(() => { if (ed.isConnected) { ed.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); keepRange(); paintState(); TB.refresh(); } }, 30);
    return api;
  }
  App.OfficeEditors = App.OfficeEditors || {};
  App.OfficeEditors.doc = { mount };
})(window);
