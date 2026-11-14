/* EvoSoft website behaviour. © 2026 EvoSoft Solutions. All rights reserved.
   No dependencies. Without JavaScript every link still works. */
(() => {
  'use strict';
  const doc = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* theme */
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  $$('.theme-toggle').forEach((b) => b.addEventListener('click', () => {
    const now = doc.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
    const next = now === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    store.set('evo-theme', next);
  }));

  /* header + menu */
  const header = $('.site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const menuBtn = $('.menu-toggle');
  const setMenu = (open) => {
    document.body.classList.toggle('nav-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
  };
  if (menuBtn) {
    menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
    $$('#site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* toast */
  const toastEl = $('.toast');
  let toastTimer;
  function toast(html, ms = 3200) {
    if (!toastEl) return;
    toastEl.innerHTML = html;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  window.evoToast = toast;

  /* copy */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const ok = await copyText(btn.dataset.copy);
    const tag = $('.copy-tag', btn);
    if (ok) {
      btn.classList.add('done');
      if (tag) tag.textContent = 'copied';
      setTimeout(() => { btn.classList.remove('done'); if (tag) tag.textContent = 'copy'; }, 1600);
    } else {
      toast('Couldn’t copy automatically. Select the text and copy it instead.');
    }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.acc-go');
    if (!a) return;
    copyText(a.dataset.login).then((ok) => toast(`${ok ? 'Copied' : 'Sign in with'} <code>${esc(a.dataset.login)}</code>. Password: <code>${esc(a.dataset.pass)}</code>`, 6000));
  });

  /* live demo status */
  const cache = new Map();
  function ping(url) {
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve) => {
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const t = setTimeout(() => { if (ctrl) ctrl.abort(); resolve(false); }, 8000);
      fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(() => { clearTimeout(t); resolve(true); })
        .catch(() => { clearTimeout(t); resolve(false); });
    });
    cache.set(url, p);
    return p;
  }
  $$('[data-status-url]').forEach((el) => ping(el.dataset.statusUrl).then((up) => {
    el.dataset.state = up ? 'online' : 'offline';
    const label = $('span', el);
    if (label) label.textContent = up ? 'Live' : 'Offline right now';
  }));

  /* work index: preview image follows the pointer */
  const preview = $('.ix-preview');
  if (preview && window.matchMedia('(hover: hover)').matches) {
    const img = $('img', preview);
    let x = 0, y = 0, raf = 0;
    const place = () => { raf = 0; preview.style.transform = `translate(${x + 24}px, ${y - 110}px)`; };
    $$('.index a[data-preview]').forEach((a) => {
      a.addEventListener('mouseenter', () => { if (a.dataset.preview) { img.src = a.dataset.preview; preview.classList.add('on'); } });
      a.addEventListener('mouseleave', () => preview.classList.remove('on'));
      a.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(place); });
    });
  }

  /* lightbox */
  const lb = $('.lightbox');
  const shots = $$('[data-lightbox]');
  if (lb && shots.length && typeof lb.showModal === 'function') {
    const img = $('img', lb), cap = $('figcaption', lb);
    let idx = 0;
    const show = (i) => {
      idx = (i + shots.length) % shots.length;
      img.src = shots[idx].dataset.lightbox;
      img.alt = shots[idx].dataset.caption || '';
      cap.textContent = shots[idx].dataset.caption || '';
    };
    shots.forEach((s, i) => s.addEventListener('click', () => { show(i); lb.showModal(); }));
    $('.lb-close', lb).addEventListener('click', () => lb.close());
    $('.lb-prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lb-next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); });
    if (shots.length < 2) $$('.lb-prev, .lb-next', lb).forEach((b) => (b.hidden = true));
  }

  /* client thumbnails: show the name if the preview service fails */
  $$('.client-shot img').forEach((im) => {
    const hide = () => { im.style.visibility = 'hidden'; };
    im.addEventListener('error', hide);
    if (im.complete && im.naturalWidth === 0) hide();
  });

  /* quote form: send to api/quote.php; if that isn't available, open the visitor's email app instead */
  const form = $('#quote');
  if (form) {
    const err = $('.form-error', form);
    const done = $('.form-done', form);
    const pre = new URLSearchParams(location.search).get('need');
    if (pre) $$('input[name="types"]', form).forEach((c) => { if (c.value === pre) c.checked = true; });
    const values = () => {
      const f = form.elements;
      return {
        name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), company: f.company.value.trim(),
        types: $$('input[name="types"]:checked', form).map((c) => c.value), timeline: f.timeline.value,
        message: f.message.value.trim(), website: f.website.value,
      };
    };
    const mailto = (v) => {
      const body = [`Name: ${v.name}`, `Email: ${v.email}`, v.phone ? `Phone: ${v.phone}` : null, v.company ? `Company: ${v.company}` : null,
        `Needs: ${v.types.join(', ') || 'Not specified'}`, `Timeline: ${v.timeline}`, '', v.message].filter((l) => typeof l === 'string').join('\n');
      location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`Quote request: ${v.types[0] || 'New project'} (${v.name})`)}&body=${encodeURIComponent(body)}`;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values();
      const bad = [];
      if (!v.name) bad.push('name');
      if (!/^\S+@\S+\.\S+$/.test(v.email)) bad.push('email');
      if (v.message.length < 10) bad.push('message');
      ['name', 'email', 'message'].forEach((n) => form.elements[n].setAttribute('aria-invalid', String(bad.includes(n))));
      if (bad.length) {
        err.hidden = false;
        err.textContent = bad.includes('email') && v.email ? 'Please check your email address.' : 'Please add your name, your email and a few words about the project.';
        form.elements[bad[0]].focus();
        return;
      }
      err.hidden = true;
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const res = await fetch(form.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          $$('.row2, .field, .form-foot, .hp', form).forEach((el) => (el.hidden = true));
          done.hidden = false;
          done.setAttribute('tabindex', '-1');
          done.focus();
          return;
        }
        if (res.status === 422 && data.fields) {
          err.hidden = false;
          err.textContent = Object.values(data.fields).join(' ');
          btn.disabled = false;
          return;
        }
        if (res.status === 429) {
          err.hidden = false;
          err.textContent = 'That’s a lot of requests in a short time. Please email us instead.';
          btn.disabled = false;
          return;
        }
        throw new Error('unavailable');
      } catch (ex) {
        btn.disabled = false;
        toast(`Opening your email app with the details filled in. If nothing happens, email <code>${esc(form.dataset.email)}</code>.`, 7000);
        mailto(v);
      }
    });
  }
})();
