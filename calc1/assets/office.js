/* ============================================================
   Mathub — Docs, Slides and Sheets (api/office.php): the file lists, and what the three editors share
   - #/docs, #/decks, #/sheets: your documents, presentations and spreadsheets, kept with your account. A new one is
     blank or from a template; a Word, PowerPoint, Excel or CSV file opens as a new one (read in the browser: nothing
     is uploaded to convert it). Each file can be renamed, copied, downloaded or deleted.
   - #/docs/<id>, #/decks/<id>, #/sheets/<id>: the editors (assets/office-docs.js, office-slides.js, office-sheets.js),
     loaded the first time one opens, with the file readers and writers they need (office-ooxml.js, office-pptx.js,
     office-xlsx.js, office-formula.js), so the rest of the site does not carry them.
   - Saving (one file at a time, the one open): an editor says when something changed; the file is saved a moment
     later and when the page closes. Until the server has it, it is also kept on this device when it is small enough,
     so a closed tab or a lost connection loses nothing. A save names the version it was written on; when the file
     changed on another device meanwhile, nothing is overwritten and the page asks what to keep.
   Private: the files are only their owner's, and nothing in them goes to Bo unless they ask (Docs: Get Bo's feedback).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation', XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  Object.assign(App.ICONS || {}, {
    present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 8h6M7 11h9"/>',
    docpage: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 11h6M9 14h6M9 17h4"/>',
    grid3: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    alignl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alignc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alignr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', alignj: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.5V9M3.5 9h3M3.5 13.5a1.5 1.5 0 1 1 2.6 1L3.5 17.5h3"/>',
    indent: '<path d="M10 6h10M10 10h10M10 14h10M4 18h16M4 8l3 2.5L4 13"/>', outdent: '<path d="M10 6h10M10 10h10M10 14h10M4 18h16M7 8l-3 2.5L7 13"/>',
    pagebreak: '<path d="M6 3v5h12V3M6 21v-5h12v5"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/>', eraser: '<path d="M8 20h12M5.5 14.5l7-7 5 5-6 6H9z"/><path d="M12.5 7.5l3-3 5 5-3 3"/>',
    marker: '<path d="M14 4l6 6-8 8H8v-4z"/><path d="M4 21h8"/>', textcolor: '<path d="M7 16l5-12 5 12M9 11h6"/><path d="M4 20h16"/>',
    fill: '<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5z"/>', table2: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M10 4v16"/>',
    shapes: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16.5" cy="7.5" r="4.5"/>', textbox: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 9h8M12 9v7"/>',
    front: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>', back: '<rect x="4" y="4" width="12" height="12" rx="1.5"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
    sortup: '<path d="M7 20V4M3 8l4-4 4 4M14 6h7M14 12h5M14 18h3"/>', sortdown: '<path d="M7 4v16M3 16l4 4 4-4M14 6h3M14 12h5M14 18h7"/>', sigma2: '<path d="M18 5H7l6 7-6 7h11"/>',
    freeze: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18" stroke-width="3"/>', wrap: '<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M15 16l-2 2 2 2M4 18h5"/>',
    rowplus: '<rect x="3" y="4" width="18" height="7" rx="1"/><path d="M12 14v6M9 17h6"/>', colplus: '<rect x="4" y="3" width="7" height="18" rx="1"/><path d="M14 12h6M17 9v6"/>',
    chart2: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>', notes: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>'
  });

  const KINDS = {
    doc: { view: 'docs', title: 'Docs', icon: 'docpage', ext: 'docx', mime: DOCX, accept: '.docx,.txt,.md,text/plain', libs: ['office-ooxml.js'], editor: 'office-docs.js',
      sub: 'Write and format documents, with pictures, tables and lists. Opens and saves Word files.', newOne: 'New document', openOne: 'Open a Word file', all: 'All documents', none: 'No documents yet. Start one above, or open a Word file.' },
    deck: { view: 'decks', title: 'Slides', icon: 'present', ext: 'pptx', mime: PPTX, accept: '.pptx', libs: ['office-ooxml.js', 'office-pptx.js'], editor: 'office-slides.js',
      sub: 'Make presentations with themes, pictures, shapes and speaker notes, and present them full screen. Opens and saves PowerPoint files.', newOne: 'New presentation', openOne: 'Open a PowerPoint file', all: 'All presentations', none: 'No presentations yet. Start one above, or open a PowerPoint file.' },
    sheet: { view: 'sheets', title: 'Sheets', icon: 'grid3', ext: 'xlsx', mime: XLSX, accept: '.xlsx,.csv,text/csv', libs: ['office-formula.js', 'office-ooxml.js', 'office-xlsx.js', 'office-chart.js'], editor: 'office-sheets.js',
      sub: 'Spreadsheets with formulas, formats, sorting and charts. Opens and saves Excel and CSV files.', newOne: 'New spreadsheet', openOne: 'Open an Excel or CSV file', all: 'All spreadsheets', none: 'No spreadsheets yet. Start one above, or open an Excel or CSV file.' }
  };
  const kindOfView = v => Object.keys(KINDS).find(k => KINDS[k].view === v);
  const href = (kind, id) => '#/' + KINDS[kind].view + (id ? '/' + id : '');

  async function api(route, body, keepalive) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store', keepalive: !!keepalive };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw Object.assign(new Error(t('Mathub cannot be reached right now.')), { network: true }); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || t('Something went wrong. Please try again.')), { status: res.status, data: json });
    return json;
  }
  let devId = '';
  function DEV() {
    if (devId) return devId;
    try { devId = localStorage.getItem('mathub-device') || ''; } catch (e) {}
    if (!/^[a-z0-9]{8,32}$/.test(devId)) { const b = new Uint8Array(10); crypto.getRandomValues(b); devId = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('mathub-device', devId); } catch (e) {} }
    return devId;
  }

  /* ---------- the editors' code, loaded when first needed ---------- */
  const loading = {};
  function script(name) {
    if (loading[name]) return loading[name];
    const v = document.documentElement.getAttribute('data-build') || '';
    loading[name] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = `assets/${name}?v=${encodeURIComponent(v)}`; s.onload = () => res(); s.onerror = () => { delete loading[name]; s.remove(); rej(new Error(t('This page could not load. Check your connection and try again.'))); }; document.head.appendChild(s); });
    return loading[name];
  }
  async function need(kind, editor) { for (const f of KINDS[kind].libs) await script(f); if (editor) await script(KINDS[kind].editor); }
  App.officeNeed = need;

  /* ---------- small pieces the editors share: a menu, a dialog, a colour picker, toolbar keys ---------- */
  /** A menu under a button: items [{ label, icon, run, disabled, checked, sep }]. Arrow keys, Home/End, Escape. */
  function menu(btn, items, opts = {}) {
    closeMenus();
    const m = document.createElement('div'); m.className = 'of-menu' + (opts.cls ? ' ' + opts.cls : ''); m.setAttribute('role', 'menu'); if (opts.label) m.setAttribute('aria-label', opts.label);
    m.innerHTML = items.map((it, i) => it.sep ? '<div class="of-menu-sep" role="separator"></div>' : `<button type="button" role="${it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}"${it.checked !== undefined ? ` aria-checked="${!!it.checked}"` : ''} class="of-menu-i${it.danger ? ' danger' : ''}" data-i="${i}"${it.disabled ? ' disabled' : ''} tabindex="-1">${it.icon ? icon(it.icon, 15) : '<span class="of-menu-ic"></span>'}<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}</button>`).join('');
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect(); const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = opts.right ? r.right - mw : r.left, y = r.bottom + 4; x = Math.max(8, Math.min(x, innerWidth - mw - 8)); if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const btns = () => $$('.of-menu-i:not([disabled])', m);
    const close = (refocus) => { m.remove(); btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', away, true); global.removeEventListener('resize', closeNow); if (refocus) btn.focus(); };
    const closeNow = () => close(false);
    const away = e => { if (!m.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(false); };
    m.addEventListener('click', e => { const b = e.target.closest('.of-menu-i'); if (!b || b.disabled) return; close(true); const it = items[+b.dataset.i]; if (it && it.run) it.run(); });
    m.addEventListener('keydown', e => {
      const L = btns(); const i = L.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (L[(i + 1) % L.length] || L[0]).focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (L[(i - 1 + L.length) % L.length] || L[0]).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); L[0].focus(); } else if (e.key === 'End') { e.preventDefault(); L[L.length - 1].focus(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true); }
    });
    setTimeout(() => { document.addEventListener('pointerdown', away, true); global.addEventListener('resize', closeNow); const L = btns(); if (L[0]) L[0].focus(); }, 0);
    return m;
  }
  function closeMenus() { $$('.of-menu, .of-pop').forEach(x => x.remove()); $$('[aria-expanded="true"][data-menu]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  /** A dialog: returns a promise of the value the form gives (or null when closed). fields: [{ name, label, value, type, placeholder, help, maxlength }] */
  function dialog(o) {
    return new Promise(resolve => {
      const el = document.createElement('div'); el.className = 'modal-backdrop of-dlg-back';
      el.innerHTML = `<form class="modal of-dlg" role="dialog" aria-modal="true" aria-labelledby="of-dlg-h" novalidate><h2 class="of-dlg-h" id="of-dlg-h">${esc(o.title)}</h2>${o.text ? `<p class="small muted">${esc(o.text)}</p>` : ''}${o.html || ''}
        ${(o.fields || []).map((f, i) => `<div class="field"><label for="of-f${i}">${esc(f.label)}</label>${f.type === 'select' ? `<select class="input" id="of-f${i}" name="${esc(f.name)}">${f.options.map(([v, l]) => `<option value="${esc(v)}"${v === f.value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input class="input" id="of-f${i}" name="${esc(f.name)}" type="${f.type || 'text'}" value="${esc(f.value || '')}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} maxlength="${f.maxlength || 300}" autocomplete="off" spellcheck="false">`}${f.help ? `<p class="small muted">${esc(f.help)}</p>` : ''}</div>`).join('')}
        <p class="of-dlg-err small" role="alert"></p><div class="of-dlg-go">${o.alt ? `<button type="button" class="btn of-dlg-alt" data-alt>${esc(o.alt.label)}</button>` : ''}<button type="button" class="btn" data-x>${esc(o.cancel || t('Cancel'))}</button><button type="submit" class="btn ${o.danger ? 'danger' : 'primary'}">${esc(o.ok || t('OK'))}</button></div></form>`;
      document.body.appendChild(el); const form = $('form', el); const back = document.activeElement;
      const done = v => { el.remove(); document.removeEventListener('keydown', key, true); if (back && back.isConnected && back.focus) back.focus(); resolve(v); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } else if (e.key === 'Tab') { const f = $$('input, select, button', form).filter(x => !x.disabled); if (!f.length) return; if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } } };
      document.addEventListener('keydown', key, true);
      el.addEventListener('pointerdown', e => { if (e.target === el) done(null); });
      $('[data-x]', el).addEventListener('click', () => done(null));
      if (o.alt) $('[data-alt]', el).addEventListener('click', () => done(o.alt.value));
      form.addEventListener('submit', e => {
        e.preventDefault(); const v = {}; (o.fields || []).forEach(f => { v[f.name] = form.elements[f.name].value; });
        const err = o.check ? o.check(v) : ''; if (err) { $('.of-dlg-err', el).textContent = err; return; } done(o.fields && o.fields.length ? v : true);
      });
      setTimeout(() => { const f = $('input, select', form) || $('[type="submit"]', form); if (f) { f.focus(); if (f.select && f.type !== 'select-one') f.select(); } }, 20);
    });
  }
  const confirmBox = (title, text, ok, danger) => dialog({ title, text, ok, danger });
  /** A colour grid under a button: colors as '#rrggbb'; '' is "none" (when allowed). */
  const COLORS = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff', '#c0392b', '#e4572e', '#f2c94c', '#2a9d8f', '#2f6fde', '#8e6bd8', '#fde2e1', '#ffe9d6', '#fff59d', '#c8f7c5', '#b3ecf9', '#e5dbff', '#7a1d12', '#8a4a1c', '#7a6100', '#145c52', '#1d3f8a', '#4b2f86'];
  function colorPicker(btn, o) {
    closeMenus();
    const p = document.createElement('div'); p.className = 'of-pop of-colors'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', o.label);
    const list = o.colors || COLORS;
    p.innerHTML = `${o.none ? `<button type="button" class="of-col-none" data-c="">${esc(o.none)}</button>` : ''}<div class="of-col-grid">${list.map(c => `<button type="button" class="of-col${c === o.value ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}" title="${c}"></button>`).join('')}</div><label class="of-col-own small"><span>${esc(t('Other'))}</span><input type="color" value="${/^#[0-9a-f]{6}$/i.test(o.value || '') ? o.value : '#2f6fde'}"></label>`;
    document.body.appendChild(p);
    const r = btn.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + 'px'; p.style.top = (r.bottom + 4 + p.offsetHeight > innerHeight ? Math.max(8, r.top - p.offsetHeight - 4) : r.bottom + 4) + 'px';
    const close = () => { p.remove(); document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key, true); };
    const away = e => { if (!p.contains(e.target) && !btn.contains(e.target)) close(); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); } };
    p.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; close(); o.pick(b.dataset.c); });
    $('input[type="color"]', p).addEventListener('change', e => { close(); o.pick(e.target.value.toLowerCase()); });
    setTimeout(() => { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', key, true); ($('.of-col.on', p) || $('.of-col, .of-col-none', p)).focus(); }, 0);
    p.addEventListener('keydown', e => { const L = $$('.of-col', p); const i = L.indexOf(document.activeElement); if (i < 0) return; const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 }[e.key]; if (d) { e.preventDefault(); const n = L[i + d]; if (n) n.focus(); } });
  }
  /** Arrow keys move between a toolbar's buttons (one Tab stop for the whole bar, as toolbars do). */
  function toolbar(bar) {
    const items = () => $$('button:not([disabled]):not([hidden]), select:not([disabled]), input:not([type="hidden"])', bar).filter(x => x.offsetParent !== null);
    const set = el => items().forEach(x => { x.tabIndex = x === el ? 0 : -1; });
    set(items()[0]);
    bar.addEventListener('focusin', e => { if (items().includes(e.target)) set(e.target); });
    bar.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && e.target.type !== 'color')) return;
      const L = items(); const i = L.indexOf(e.target); if (i < 0) return; e.preventDefault();
      const n = e.key === 'Home' ? L[0] : e.key === 'End' ? L[L.length - 1] : L[(i + (e.key === 'ArrowRight' ? 1 : -1) + L.length) % L.length]; set(n); n.focus();
    });
    return { refresh: () => { const cur = items().find(x => x.tabIndex === 0); set(cur || items()[0]); } };
  }
  /** Prints some HTML on its own (the page around it is hidden), then takes it away. page: the @page rule for it. */
  function printHtml(html, title, cls, page) {
    let host = $('#of-print'); if (!host) { host = document.createElement('div'); host.id = 'of-print'; document.body.appendChild(host); }
    let st = $('#of-print-page'); if (!st) { st = document.createElement('style'); st.id = 'of-print-page'; document.head.appendChild(st); } st.textContent = page ? `@media print { ${page} }` : '';
    host.className = cls || ''; host.innerHTML = html; document.body.classList.add('of-printing'); const old = document.title; if (title) document.title = title;
    const done = () => { document.body.classList.remove('of-printing'); host.innerHTML = ''; st.textContent = ''; document.title = old; global.removeEventListener('afterprint', done); };
    global.addEventListener('afterprint', done);
    const imgs = $$('img', host).filter(i => !i.complete); Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => { global.print(); setTimeout(() => { if (document.body.classList.contains('of-printing') && !matchMedia('print').matches) done(); }, 1500); });
  }
  /** A picture from a file, made smaller when it is big (longest side `max` px), as a data: URL. */
  async function pictureFrom(file, max = 1600) {
    if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.type)) throw new Error(t('That is not a picture this can use. Use a PNG, JPEG, GIF or WebP.'));
    if (file.size > 25 * 1024 * 1024) throw new Error(t('That picture is too big. Use one under 25 MB.'));
    const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error(t('That picture could not be read.'))); r.readAsDataURL(file); });
    if (file.type === 'image/gif' && file.size < 2 * 1024 * 1024) return src;   // keeps a small GIF moving
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(t('That picture could not be read.'))); i.src = src; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); if (k === 1 && file.size < 900 * 1024 && file.type !== 'image/webp' && file.type !== 'image/bmp') return src;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d'); if (file.type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === 'image/png' || file.type === 'image/gif'; const out = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
    return png && out.length > 1.6e6 ? c.toDataURL('image/jpeg', 0.86) : out;
  }
  App.Officekit = { menu, closeMenus, dialog, confirmBox, colorPicker, toolbar, printHtml, pictureFrom, api, COLORS, KINDS, href, t };

  /* ---------- templates ---------- */
  const today = () => new Date().toLocaleDateString(App.lang || 'en', { day: 'numeric', month: 'long', year: 'numeric' });
  const p = s => `<p>${esc(s)}</p>`;
  const TEMPLATES = {
    doc: [
      { id: 'blank', label: 'Blank document', body: () => ({ html: '<p><br></p>' }) },
      { id: 'essay', label: 'Essay (MLA)', body: () => { const u = user(); const last = u && u.name ? u.name.trim().split(/\s+/).pop() : t('Lastname'); return { spacing: 2, numbers: 'top', header: last, html: [u && u.name ? u.name : t('Your name'), t('Instructor’s name'), t('Course'), today()].map(p).join('') + `<p style="text-align:center">${esc(t('Title of your essay'))}</p>` + p(t('Start writing here. The page numbers and your last name go at the top right of each page, and the lines are double spaced, as MLA asks.')) }; } },
      { id: 'lab', label: 'Lab report', body: () => ({ html: `<h1>${esc(t('Lab report title'))}</h1>` + p([user() && user().name, today()].filter(Boolean).join(' · ')) + [['Introduction', 'What question the experiment asks, and why it matters.'], ['Methods', 'What you did, in enough detail that someone could repeat it.'], ['Results', 'What you measured: tables and graphs, with units.'], ['Discussion', 'What the results mean, how sure you are, and what went wrong.'], ['References', '']].map(([h, x]) => `<h2>${esc(t(h))}</h2>` + p(x ? t(x) : '')).join('') }) },
      { id: 'notes', label: 'Class notes', body: () => ({ html: `<h1>${esc(t('Class notes'))}</h1>` + p(today()) + `<h2>${esc(t('Key ideas'))}</h2><ul><li><br></li></ul><h2>${esc(t('Examples'))}</h2>` + p('') + `<h2>${esc(t('Questions to ask'))}</h2><ul><li><br></li></ul><h2>${esc(t('Summary'))}</h2>` + p('') }) }
    ],
    deck: [
      { id: 'blank', label: 'Blank presentation', body: () => deckBody('paper', [['title', t('Click to add a title'), t('Your name')]]) },
      { id: 'class', label: 'Class presentation', body: () => deckBody('ocean', [['title', t('Presentation title'), [user() && user().name, today()].filter(Boolean).join(' · ')], ['content', t('Overview'), [t('What we will cover'), t('Why it matters'), t('What we found')]], ['content', t('Context'), [t('The key idea, in one line'), t('A detail that supports it')]], ['two', t('Compare'), [t('One side')], [t('The other side')]], ['section', t('Questions?'), t('Thank you')]]) },
      { id: 'lab', label: 'Lab talk', body: () => deckBody('chalk', [['title', t('Lab talk title'), today()], ['content', t('Question'), [t('What we wanted to find out')]], ['content', t('Method'), [t('Setup'), t('What we measured, and how')]], ['content', t('Results'), [t('The main number, with its uncertainty')]], ['content', t('Conclusion'), [t('What it means'), t('What we would do next')]]]) }
    ],
    sheet: [
      { id: 'blank', label: 'Blank spreadsheet', body: () => ({ sheets: [{ name: t('Sheet1'), cells: {}, cols: {}, rows: {} }], active: 0 }) },
      { id: 'grades', label: 'Grade tracker', body: () => gradeBook() },
      { id: 'lab', label: 'Lab data', body: () => labBook() },
      { id: 'budget', label: 'Monthly budget', body: () => budgetBook() }
    ]
  };
  /** A deck from slide sketches: ['title', title, subtitle] | ['content', title, [bullets]] | ['two', title, [left], [right]] | ['section', title, sub] */
  function deckBody(theme, list) {
    const slides = list.map(([kind, a, b, c]) => newSlide(kind, it => it.role === 'title' ? [a] : it.role === 'subtitle' ? [typeof b === 'string' ? b : ''] : it.role === 'body' ? ((it.col === 2 ? c : b) || ['']) : null));
    return { theme, slides };
  }
  /** A new slide in one of the layouts, on the 960 × 540 slide; fill(item) may give each box its lines. */
  function newSlide(kind, fill) {
    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); let k = 0; const it = o => Object.assign({ id: id + '-' + (++k), type: 'text' }, o);
    const items = {
      title: [it({ role: 'title', x: 80, y: 150, w: 800, h: 120, valign: 'bottom', align: 'center' }), it({ role: 'subtitle', x: 80, y: 290, w: 800, h: 70, align: 'center' })],
      content: [it({ role: 'title', x: 60, y: 32, w: 840, h: 76, valign: 'middle' }), it({ role: 'body', x: 60, y: 124, w: 840, h: 372, list: 'bullet' })],
      two: [it({ role: 'title', x: 60, y: 32, w: 840, h: 76, valign: 'middle' }), it({ role: 'body', col: 1, x: 60, y: 124, w: 410, h: 372, list: 'bullet' }), it({ role: 'body', col: 2, x: 490, y: 124, w: 410, h: 372, list: 'bullet' })],
      section: [it({ role: 'title', x: 80, y: 190, w: 800, h: 100, valign: 'bottom' }), it({ role: 'subtitle', x: 80, y: 300, w: 800, h: 60 })],
      only: [it({ role: 'title', x: 60, y: 32, w: 840, h: 76, valign: 'middle' })],
      blank: []
    }[kind] || [];
    items.forEach(x => {
      const lines = (fill && fill(x)) || ['']; const attrs = (x.list ? ` data-list="${x.list}"` : '') + (x.align ? ` style="text-align:${x.align}"` : '');
      x.html = lines.map(l => `<p${attrs}>${esc(l) || '<br>'}</p>`).join(''); delete x.list; delete x.align; delete x.col;
    });
    return { id, items, notes: '', bg: '' };
  }
  App.Officekit.newSlide = newSlide;
  const cells = rows => { const out = {}; rows.forEach((r, ri) => r.forEach((v, ci) => { if (v === null || v === undefined || v === '') return; const a = App.Formula ? App.Formula.addr(ci, ri) : String.fromCharCode(65 + ci) + (ri + 1); out[a] = typeof v === 'object' ? v : { v: String(v) }; })); return out; };
  const B = (v, s) => ({ v: String(v), s: Object.assign({ b: true }, s || {}) });
  function gradeBook() {
    return { active: 0, sheets: [{ name: t('Grades'), freeze: 1, cols: { 0: 170, 1: 90, 2: 90, 3: 110 }, rows: {}, cells: cells([
      [B(t('Category'), { bg: '#e4ebfa' }), B(t('Weight'), { bg: '#e4ebfa', al: 'right' }), B(t('My score'), { bg: '#e4ebfa', al: 'right' }), B(t('Counts for'), { bg: '#e4ebfa', al: 'right' })],
      [t('Assignments'), { v: '20%' }, { v: '92%' }, { v: '=B2*C2', s: { fmt: 'pct' } }], [t('Quizzes and labs'), { v: '10%' }, { v: '85%' }, { v: '=B3*C3', s: { fmt: 'pct' } }], [t('Midterms'), { v: '40%' }, { v: '78%' }, { v: '=B4*C4', s: { fmt: 'pct' } }], [t('Final'), { v: '30%' }, { v: '' , s: { fmt: 'pct' } }, { v: '=B5*C5', s: { fmt: 'pct' } }],
      [], [B(t('Total so far')), { v: '=SUMIF(C2:C5,"<>",B2:B5)', s: { fmt: 'pct' } }, '', { v: '=SUM(D2:D5)', s: { fmt: 'pct', b: true } }], [B(t('Grade so far')), '', '', { v: '=IF(B7=0,"",D7/B7)', s: { fmt: 'pct', b: true } }]
    ]) }] };
  }
  function labBook() {
    return { active: 0, sheets: [{ name: t('Data'), freeze: 1, cols: { 0: 90, 1: 120, 2: 120, 4: 150, 5: 110 }, rows: {}, cells: cells([
      [B(t('Trial'), { bg: '#e4ebfa' }), B(t('x (units)'), { bg: '#e4ebfa' }), B(t('y (units)'), { bg: '#e4ebfa' }), '', B(t('Fit: y = m·x + b')), ''],
      ['1', '1', '2.1', '', t('Slope m'), { v: '=SLOPE(C2:C6,B2:B6)', s: { fmt: 'num' } }], ['2', '2', '3.9', '', t('Intercept b'), { v: '=INTERCEPT(C2:C6,B2:B6)', s: { fmt: 'num' } }], ['3', '3', '6.2', '', 'R²', { v: '=RSQ(C2:C6,B2:B6)' }], ['4', '4', '7.8', '', t('Mean of y'), { v: '=AVERAGE(C2:C6)' }], ['5', '5', '10.1', '', t('Std. dev. of y'), { v: '=STDEV.S(C2:C6)' }]
    ]), charts: [{ id: 'c1', type: 'scatter', range: 'B1:C6', title: t('y against x'), trend: true, x: 470, y: 170, w: 420, h: 280 }] }] };
  }
  function budgetBook() {
    return { active: 0, sheets: [{ name: t('Budget'), freeze: 1, cols: { 0: 180, 1: 110, 2: 110, 3: 110 }, rows: {}, cells: cells([
      [B(t('Item'), { bg: '#e4ebfa' }), B(t('Planned'), { bg: '#e4ebfa', al: 'right' }), B(t('Spent'), { bg: '#e4ebfa', al: 'right' }), B(t('Left over'), { bg: '#e4ebfa', al: 'right' })],
      [t('Rent'), { v: '$650' }, { v: '$650' }, { v: '=B2-C2', s: { fmt: 'usd' } }], [t('Food'), { v: '$300' }, { v: '$212.40' }, { v: '=B3-C3', s: { fmt: 'usd' } }], [t('Books and supplies'), { v: '$80' }, { v: '$45' }, { v: '=B4-C4', s: { fmt: 'usd' } }], [t('Transport'), { v: '$40' }, { v: '$18' }, { v: '=B5-C5', s: { fmt: 'usd' } }], [t('Fun'), { v: '$60' }, { v: '$72.50' }, { v: '=B6-C6', s: { fmt: 'usd' } }],
      [], [B(t('Total')), { v: '=SUM(B2:B6)', s: { fmt: 'usd', b: true } }, { v: '=SUM(C2:C6)', s: { fmt: 'usd', b: true } }, { v: '=SUM(D2:D6)', s: { fmt: 'usd', b: true } }]
    ]), charts: [{ id: 'c1', type: 'column', range: 'A1:C6', title: t('Planned and spent'), x: 470, y: 30, w: 420, h: 260 }] }] };
  }

  /* ---------- what a file holds, in a line: words, slides or filled cells ---------- */
  function countOf(kind, body) {
    if (kind === 'doc') return App.OOXML ? (App.OOXML.docText(body.html || '').match(/\S+/g) || []).length : 0;
    if (kind === 'deck') return (body.slides || []).length;
    return (body.sheets || []).reduce((n, s) => n + Object.values(s.cells || {}).filter(c => c && c.v !== '' && c.v != null).length, 0);
  }
  const countLabel = (kind, n) => kind === 'doc' ? (n === 1 ? t('1 word') : t('{1} words', num(n))) : kind === 'deck' ? (n === 1 ? t('1 slide') : t('{1} slides', num(n))) : (n === 1 ? t('1 cell') : t('{1} cells', num(n)));
  const sizeLabel = b => b < 1024 * 1024 ? t('{1} KB', num(Math.max(1, Math.round(b / 1024)))) : t('{1} MB', (b / 1048576).toLocaleString(App.lang || 'en', { maximumFractionDigits: 1 }));
  const stem = name => String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').trim().slice(0, 120);

  /* ---------- opening a file from the computer: it becomes a new one here ---------- */
  async function fromFile(kind, file) {
    await need(kind, false);
    const ext = (file.name.split('.').pop() || '').toLowerCase(); const O = App.OOXML;
    if (file.size > 60 * 1024 * 1024) throw new Error(t('That file is too big to open here.'));
    const buf = await file.arrayBuffer(); let body;
    try {
      if (kind === 'doc') {
        if (ext === 'docx') body = await O.docFromDocx(buf);
        else if (['txt', 'md'].includes(ext) || /^text\//.test(file.type)) { const text = new TextDecoder().decode(buf); body = { html: text.replace(/\r/g, '').split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br>') || '<br>'}</p>`).join('') || '<p><br></p>' }; }
        else throw new Error('type');
      } else if (kind === 'deck') { if (ext !== 'pptx') throw new Error('type'); body = await O.deckFromPptx(buf); }
      else { if (ext === 'csv' || /csv/.test(file.type)) body = O.bookFromCsv(new TextDecoder().decode(buf), stem(file.name)); else if (ext === 'xlsx' || ext === 'xlsm') body = await O.bookFromXlsx(buf); else throw new Error('type'); }
    } catch (e) {
      if (e.message === 'type') throw new Error({ doc: t('Docs opens Word files (.docx) and text files. For an old .doc file, save it as .docx in Word first.'), deck: t('Slides opens PowerPoint files (.pptx). For an old .ppt file, save it as .pptx in PowerPoint first.'), sheet: t('Sheets opens Excel files (.xlsx) and CSV files. For an old .xls file, save it as .xlsx in Excel first.') }[kind]);
      throw new Error(t('That file could not be read. It may be damaged, or not really a {1} file.', ext.toUpperCase()));
    }
    return body;
  }
  async function create(kind, title, body) {
    body.words = countOf(kind, body);
    const json = JSON.stringify(body); if (json.length > 8 * 1024 * 1024) throw new Error(t('That file is over 8 MB, the most one can be. Make the pictures in it smaller, or split it in two.'));
    const j = await api('office_save', { kind, title, body, device: DEV() }); return j.file;
  }
  async function download(kind, file, body) {
    await need(kind, false); const O = App.OOXML; const name = App.Office.safeName(file.title) + '.' + KINDS[kind].ext;
    const data = kind === 'doc' ? await O.docxFromHtml(body.html || '', { title: file.title, page: body.page, spacing: body.spacing, numbers: body.numbers, header: body.header })
      : kind === 'deck' ? await O.pptxFromDeck(body, { title: file.title }) : await O.xlsxFromBook(body, { title: file.title });
    App.Office.download(data, name, KINDS[kind].mime);
  }
  App.Officekit.download = download; App.Officekit.fromFile = fromFile; App.Officekit.countOf = countOf; App.Officekit.countLabel = countLabel; App.Officekit.create = create; App.Officekit.stem = stem;

  /* ======================= the list of files ======================= */
  async function listView(kind, root) {
    const K = KINDS[kind];
    const head = App.pageHead(esc(t(K.title)), esc(t(K.sub)));
    if (!user()) { root.innerHTML = `<div class="of-list">${head}<div class="mt-3">${App.lockCard(t('This is for members'), t('Sign up with your montana.edu email to keep documents, presentations and spreadsheets with your account.'))}</div></div>`; if (App.auth) App.auth.bindLocks(root); return; }
    root.innerHTML = `<div class="of-list" data-kind="${kind}">${head}
      <section class="of-new" aria-labelledby="of-new-h"><h2 class="of-sec-h" id="of-new-h">${esc(t('Start a new one'))}</h2><div class="of-tpls">${TEMPLATES[kind].map(x => `<button type="button" class="of-tpl" data-action="of-new" data-t="${x.id}"><span class="of-tpl-art ${kind} ${x.id}" aria-hidden="true">${tplArt(kind, x.id)}</span><span class="of-tpl-l">${esc(t(x.label))}</span></button>`).join('')}
        <label class="of-tpl of-open"><span class="of-tpl-art open" aria-hidden="true">${icon('upload', 26)}</span><span class="of-tpl-l">${esc(t(K.openOne))}</span><input type="file" class="sr-only" id="of-file" accept="${K.accept}"></label></div></section>
      <section class="of-files" aria-labelledby="of-files-h"><div class="of-files-top"><h2 class="of-sec-h" id="of-files-h">${esc(t('Your files'))}</h2><input class="input of-find" type="search" id="of-find" placeholder="${esc(t('Find a file'))}" aria-label="${esc(t('Find a file'))}"></div>
        <div id="of-rows" aria-busy="true"><div class="of-empty muted">${esc(t('Loading…'))}</div></div><p class="small muted of-use" id="of-use"></p></section></div>`;
    let files = [], all = null;
    const paint = () => {
      const q = ($('#of-find', root).value || '').trim().toLowerCase(); const L = files.filter(f => !q || f.title.toLowerCase().includes(q));
      const box = $('#of-rows', root); box.removeAttribute('aria-busy');
      box.innerHTML = !files.length ? `<div class="of-empty">${icon(K.icon, 28)}<p>${esc(t(K.none))}</p></div>` : !L.length ? `<div class="of-empty muted">${esc(t('No file is called that.'))}</div>`
        : `<ul class="of-rows">${L.map(f => `<li class="of-row"><a class="of-row-a" href="${href(kind, f.id)}"><span class="of-row-ic ${kind}" aria-hidden="true">${icon(K.icon, 18)}</span><span class="of-row-t"><b translate="no">${esc(f.title)}</b><small>${esc(t('Edited {1}', App.ago(f.updated * 1000)))} · ${esc(countLabel(kind, f.words))}</small></span></a><button type="button" class="btn sm ghost of-row-m" data-action="of-more" data-id="${f.id}" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('More for {1}', f.title))}">${icon('menu', 16)}</button></li>`).join('')}</ul>`;
      $('#of-use', root).textContent = all ? t('{1} of {2} files · {3} of {4} used', num(all.count), num(all.max_files), sizeLabel(all.bytes), sizeLabel(all.max_bytes)) : '';
    };
    const load = async () => { try { const j = await api('office_list&kind=' + kind); if (!root.isConnected) return; files = j.files; all = j; paint(); } catch (e) { if (!root.isConnected) return; $('#of-rows', root).innerHTML = `<div class="of-empty bad">${esc(e.message)} <button type="button" class="btn sm" data-action="of-retry">${esc(t('Try again'))}</button></div>`; } };
    $('#of-find', root).addEventListener('input', paint);
    const busy = (on, msg) => { const L = $('.of-list', root); if (L) { L.classList.toggle('of-busy', on); L.setAttribute('aria-busy', String(on)); } if (msg) toast(msg); };   // on the list, not the page: the next page is made from a copy of the page's element
    bind(root, {
      'of-retry': () => load(),
      'of-new': async b => {
        const tp = TEMPLATES[kind].find(x => x.id === b.dataset.t); const L = $('.of-list', root); if (!tp || (L && L.classList.contains('of-busy'))) return;
        busy(true); try { if (kind === 'deck' || kind === 'sheet') await need(kind, false); const body = tp.body(); const f = await create(kind, tp.id === 'blank' ? '' : t(tp.label), body); location.hash = href(kind, f.id); } catch (e) { busy(false); toast(e.message, 4500); }
      },
      'of-more': b => {
        const f = files.find(x => x.id === +b.dataset.id); if (!f) return;
        menu(b, [
          { label: t('Open'), icon: 'right', run: () => { location.hash = href(kind, f.id); } },
          { label: t('Rename'), icon: 'pen', run: async () => { const v = await dialog({ title: t('Rename'), fields: [{ name: 'title', label: t('Name'), value: f.title, maxlength: 120 }], ok: t('Rename'), check: v => v.title.trim() ? '' : t('Write a name.') }); if (!v) return; try { const j = await api('office_rename', { id: f.id, title: v.title }); Object.assign(f, j.file); paint(); } catch (e) { toast(e.message, 4000); } } },
          { label: t('Make a copy'), icon: 'copy', run: async () => { try { const j = await api('office_copy', { id: f.id, title: t('Copy of {1}', f.title) }); files.unshift(j.file); all && all.count++; paint(); toast(t('Copied')); } catch (e) { toast(e.message, 4000); } } },
          { label: t('Download as {1}', '.' + K.ext), icon: 'download', run: async () => { try { const j = await api('office_get&id=' + f.id); await download(kind, j.file, j.file.body); } catch (e) { toast(e.message || t('That file could not be made here.'), 4500); } } },
          { sep: true },
          { label: t('Delete'), icon: 'trash', danger: true, run: async () => { if (!await confirmBox(t('Delete “{1}”?', f.title), t('It is gone for good: it cannot be brought back.'), t('Delete'), true)) return; try { await api('office_delete', { id: f.id }); files = files.filter(x => x.id !== f.id); if (all) { all.count--; all.bytes -= f.size; } paint(); toast(t('Deleted')); } catch (e) { toast(e.message, 4000); } } }
        ], { right: true, label: f.title });
      }
    });
    $('#of-file', root).addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
      busy(true, t('Opening {1}…', file.name));
      try { const body = await fromFile(kind, file); const f = await create(kind, stem(file.name), body); if (body.skipped) toast(t('Opened. {1} cells past row 10,000 or column ZZ were left out.', num(body.skipped)), 5000); location.hash = href(kind, f.id); }
      catch (err) { busy(false); toast(err.message, 6000); }
    });
    load();
  }
  /** The little picture on each template's button: a sketch of what it starts with. */
  function tplArt(kind, id) {
    if (kind === 'doc') return `<span class="of-art-page">${id === 'blank' ? '' : id === 'essay' ? '<i class="w3"></i><i class="w4"></i><i class="w3"></i><i class="c"></i><i></i><i></i><i></i>' : id === 'lab' ? '<b></b><i class="w4"></i><em></em><i></i><i></i><em></em><i></i>' : '<b></b><i class="w3"></i><em></em><i class="dot"></i><i class="dot"></i><em></em><i></i>'}</span>`;
    if (kind === 'deck') return `<span class="of-art-slide ${id}"><b></b>${id === 'blank' ? '<i></i>' : '<i></i><i class="w3"></i>'}</span>`;
    return `<span class="of-art-grid ${id}">${Array.from({ length: 20 }, (_, i) => `<i${(id !== 'blank' && i < 4) ? ' class="h"' : ''}></i>`).join('')}${id === 'lab' || id === 'budget' ? '<em></em>' : ''}</span>`;
  }

  /* ======================= an open file: loading, saving, conflicts ======================= */
  const LOCAL = id => 'mathub-office-' + id;
  const readLocal = id => { try { return JSON.parse(localStorage.getItem(LOCAL(id)) || 'null'); } catch (e) { return null; } };
  const writeLocal = (id, v) => { try { if (v) localStorage.setItem(LOCAL(id), JSON.stringify(v)); else localStorage.removeItem(LOCAL(id)); } catch (e) { try { localStorage.removeItem(LOCAL(id)); } catch (x) {} } };
  let OPEN = null;   // the file being edited: { kind, id, file, version, ed, dirty, rev, busy, timer, root }

  async function editorView(kind, root, id) {
    const K = KINDS[kind];
    if (!user()) { listView(kind, root); return; }
    root.innerHTML = `<div class="of-ed of-${kind} tex2jax_ignore mathjax_ignore" aria-busy="true"><div class="of-loading">${icon(K.icon, 30)}<p>${esc(t('Opening…'))}</p></div></div>`;
    let j;
    try { [j] = await Promise.all([api('office_get&id=' + encodeURIComponent(id)), need(kind, true)]); }
    catch (e) { if (!root.isConnected) return; root.innerHTML = `<div class="of-ed of-${kind}"><div class="of-loading"><p class="bad">${esc(e.message)}</p><p><a class="btn" href="${href(kind)}">${icon('left', 14)} ${esc(t(K.all))}</a> <button type="button" class="btn" id="of-again">${esc(t('Try again'))}</button></p></div></div>`; const a = $('#of-again', root); if (a) a.addEventListener('click', () => editorView(kind, root, id)); return; }
    if (!root.isConnected || App.current !== App.views[K.view]) return;
    const file = j.file; let body = file.body || {}; if (file.kind !== kind) { location.hash = href(file.kind, file.id); return; }
    const S = OPEN = { kind, id: file.id, file, version: file.version, dirty: false, rev: 0, saved: 0, busy: false, timer: 0, root, conflict: null, lastLocal: 0 };
    // what this device typed and the server never got
    const L = readLocal(file.id); let restored = false, offer = null;
    if (L && L.body) { if (L.base === file.version) { body = L.body; restored = true; } else if (L.base < file.version) offer = L; else writeLocal(file.id, null); }
    root.innerHTML = `<div class="of-ed of-${kind} tex2jax_ignore mathjax_ignore">
      <header class="of-bar"><a class="btn sm ghost of-back" href="${href(kind)}" aria-label="${esc(t(K.all))}" title="${esc(t(K.all))}">${icon('left', 16)}</a><span class="of-kind ${kind}" aria-hidden="true">${icon(K.icon, 18)}</span>
        <input class="of-title" id="of-title" value="${esc(file.title)}" maxlength="120" aria-label="${esc(t('Name'))}" spellcheck="false" translate="no">
        <span class="of-state small muted" id="of-state" role="status" aria-live="polite">${esc(t('Saved'))}</span><div class="of-bar-r" id="of-bar-r"></div></header>
      <div class="of-conflict" id="of-conflict" hidden></div><div class="of-host" id="of-host"></div></div>`;
    const ctx = {
      kind, file, t, kit: App.Officekit, root,
      changed: () => changed(S),
      status: (msg, bad) => status(S, msg, bad),
      bar: $('#of-bar-r', root),
      title: () => $('#of-title', root).value.trim() || file.title,
      fileMenu: extra => fileMenu(S, extra)
    };
    try { S.ed = App.OfficeEditors[kind].mount($('#of-host', root), ctx, body); }
    catch (e) { console.error(e); $('#of-host', root).innerHTML = `<div class="of-loading"><p class="bad">${esc(t('This file could not be shown. It may be damaged.'))}</p><p><a class="btn" href="${href(kind)}">${esc(t(K.all))}</a></p></div>`; return; }
    if (restored) { S.dirty = true; S.rev = 1; status(S, t('Brought back what you changed before you left')); schedule(S, 600); }
    if (offer) conflictBox(S, { device: true, mine: offer.body, at: offer.at });
    const ti = $('#of-title', root);
    const rename = async () => { const v = ti.value.trim(); if (!v) { ti.value = S.file.title; return; } if (v === S.file.title) return; try { const r = await api('office_rename', { id: S.id, title: v }); S.file.title = r.file.title; ti.value = r.file.title; document.title = `${r.file.title} · Mathub`; } catch (e) { toast(e.message, 4000); ti.value = S.file.title; } };
    ti.addEventListener('change', rename); ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ti.blur(); if (S.ed.focus) S.ed.focus(); } else if (e.key === 'Escape') { ti.value = S.file.title; ti.blur(); } });
    document.title = `${file.title} · Mathub`;
    $('.of-ed', root).removeAttribute('aria-busy');
  }
  function status(S, msg, bad) { const el = S.root && $('#of-state', S.root); if (el) { el.textContent = msg; el.classList.toggle('bad', !!bad); } }
  function changed(S) {
    if (S !== OPEN) return; S.dirty = true; S.rev++; status(S, t('Editing…')); schedule(S, 1400);
    clearTimeout(S.localTimer); S.localTimer = setTimeout(() => keepLocal(S), 700);
  }
  function keepLocal(S) {   // a copy on this device until the server has it (not for big files: the browser's room is small)
    if (!S.dirty || !S.ed) return; const body = S.ed.body(); const s = JSON.stringify({ base: S.version, at: Date.now(), body });
    if (s.length < 1.8e6) { try { localStorage.setItem(LOCAL(S.id), s); } catch (e) { writeLocal(S.id, null); } } else writeLocal(S.id, null);
  }
  function schedule(S, ms) { clearTimeout(S.timer); S.timer = setTimeout(() => save(S), ms); }
  async function save(S, how = {}) {
    clearTimeout(S.timer); if (!S.dirty || S.conflict || !S.ed) return;
    if (S.busy && !how.keepalive) { S.again = true; return; }
    const body = S.ed.body(); body.words = countOf(S.kind, body); const rev = S.rev; const json = JSON.stringify(body);
    if (json.length > 8 * 1024 * 1024) { status(S, t('Not saved: this file is over 8 MB, the most one can be. Make the pictures in it smaller, or take some out.'), true); return; }
    if (how.keepalive && json.length > 60000) { keepLocal(S); return; }   // too big to send as the page closes: this device keeps it
    S.busy = true; status(S, t('Saving…'));
    try {
      const j = await api('office_save', { id: S.id, base: S.version, body, device: DEV() }, how.keepalive);
      S.version = j.file.version; S.file.updated = j.file.updated;
      if (S.rev === rev) { S.dirty = false; writeLocal(S.id, null); status(S, t('Saved')); } else keepLocal(S);
    } catch (e) {
      S.busy = false;
      if (e.status === 409 && e.data && e.data.conflict) { conflictBox(S, { other: e.data.file }); return; }
      if (e.network) { keepLocal(S); status(S, t('Offline: kept on this device, saved when you are back'), true); schedule(S, 20000); return; }
      status(S, e.message, true); if (e.status !== 413 && e.status !== 400) schedule(S, 30000); return;
    }
    S.busy = false; if (S.dirty && (S.again || S.rev !== rev)) { S.again = false; schedule(S, 400); }
  }
  /* the file changed on another device (or this device has older unsaved changes): nothing is overwritten until they pick */
  function conflictBox(S, o) {
    S.conflict = o; const box = $('#of-conflict', S.root); if (!box) return; box.hidden = false;
    box.innerHTML = `<div class="callout warn of-conf" role="alert">${icon('flag', 16)}<div><b>${esc(o.device ? t('This device has changes you made before ({1}) that were never saved, and the file has changed since.', new Date(o.at).toLocaleString(App.lang || 'en')) : t('This file was changed on another device since you opened it.'))}</b>
      <p class="small">${esc(o.device ? t('The saved version is open now. Pick what to keep.') : t('What you changed here is still on this page. Pick what to keep.'))}</p>
      <div class="row gap-sm mt-1" style="flex-wrap:wrap"><button type="button" class="btn sm primary" data-c="copy">${esc(t('Keep both: save mine as a copy'))}</button><button type="button" class="btn sm" data-c="mine">${esc(o.device ? t('Use this device’s changes') : t('Keep mine, replace theirs'))}</button><button type="button" class="btn sm" data-c="theirs">${esc(o.device ? t('Keep the saved version') : t('Open theirs (lose mine)'))}</button></div></div></div>`;
    box.onclick = async e => {
      const b = e.target.closest('[data-c]'); if (!b) return; $$('button', box).forEach(x => { x.disabled = true; });
      const mineBody = o.device ? o.mine : S.ed.body();
      try {
        if (b.dataset.c === 'copy') {
          const f = await create(S.kind, t('{1} (my copy)', S.file.title), mineBody); writeLocal(S.id, null); S.dirty = false; S.conflict = null; toast(t('Saved as “{1}”', f.title), 4000); location.hash = href(S.kind, f.id);
        } else if (b.dataset.c === 'mine') {
          mineBody.words = countOf(S.kind, mineBody); const j = await api('office_save', { id: S.id, base: S.version, body: mineBody, force: true, device: DEV() }); writeLocal(S.id, null); S.dirty = false; S.conflict = null;
          if (o.device) { S.version = j.file.version; App.views[KINDS[S.kind].view].render(S.root, String(S.id)); return; }
          S.version = j.file.version; box.hidden = true; box.innerHTML = ''; status(S, t('Saved'));
        } else {
          writeLocal(S.id, null); S.dirty = false; S.conflict = null;
          if (o.device) { box.hidden = true; box.innerHTML = ''; return; }
          App.views[KINDS[S.kind].view].render(S.root, String(S.id));
        }
      } catch (err) { $$('button', box).forEach(x => { x.disabled = false; }); toast(err.message, 4500); }
    };
  }
  /** The File menu: downloads, print, copy, and what the editor adds. */
  function fileMenu(S, extra) {
    const K = KINDS[S.kind];
    return [...(extra || []),
      { label: t('Make a copy'), icon: 'copy', run: async () => { try { await save(S); const body = S.ed.body(); const f = await create(S.kind, t('Copy of {1}', S.file.title), body); toast(t('Copied')); location.hash = href(S.kind, f.id); } catch (e) { toast(e.message, 4000); } } },
      { label: t('Delete this file'), icon: 'trash', danger: true, run: async () => { if (!await confirmBox(t('Delete “{1}”?', S.file.title), t('It is gone for good: it cannot be brought back.'), t('Delete'), true)) return; try { S.dirty = false; clearTimeout(S.timer); await api('office_delete', { id: S.id }); writeLocal(S.id, null); OPEN = null; toast(t('Deleted')); location.hash = href(S.kind); } catch (e) { toast(e.message, 4000); } } }
    ];
  }
  function leave() {
    const S = OPEN; if (!S) return; OPEN = null;
    if (S.dirty && !S.conflict) { keepLocal(S); save(S); }
    if (S.ed && S.ed.unmount) { try { S.ed.unmount(); } catch (e) {} }
    closeMenus();
  }
  global.addEventListener('pagehide', () => { const S = OPEN; if (S && S.dirty && !S.conflict) { keepLocal(S); save(S, { keepalive: true }); } });
  global.addEventListener('beforeunload', e => { const S = OPEN; if (S && S.dirty && !S.conflict && (S.busy || !navigator.onLine)) { keepLocal(S); e.preventDefault(); e.returnValue = ''; } });
  global.addEventListener('online', () => { const S = OPEN; if (S && S.dirty && !S.conflict) save(S); });
  App.Officekit.save = () => OPEN ? save(OPEN) : Promise.resolve();
  App.Officekit.isDirty = () => !!(OPEN && OPEN.dirty);

  /* ---------- the three pages ---------- */
  Object.keys(KINDS).forEach(kind => {
    const K = KINDS[kind];
    App.views[K.view] = { title: K.title, render(root, param) { leave(); if (param && /^\d+$/.test(param)) editorView(kind, root, param); else listView(kind, root); }, unmount: leave };
  });
  App.OfficeEditors = App.OfficeEditors || {};
})(window);
