/* EvoSoft site behaviour. No dependencies. Everything degrades: without JS every link still works. */
(() => {
  'use strict';
  const doc = document.documentElement;
  doc.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  /* ---------- theme ---------- */
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => doc.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
  $$('.theme-toggle').forEach((b) =>
    b.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      store.set('evo-theme', next);
    }),
  );

  /* ---------- header ---------- */
  const header = $('.site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 8);
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

  /* ---------- toast ---------- */
  const toastEl = $('.toast');
  let toastTimer;
  function toast(html, ms = 3200) {
    if (!toastEl) return;
    toastEl.innerHTML = html;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ---------- copy ---------- */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const ok = await copyText(btn.dataset.copy);
    if (ok) {
      btn.classList.add('done');
      setTimeout(() => btn.classList.remove('done'), 1600);
      toast(`Copied <code>${esc(btn.dataset.copy)}</code>`, 1800);
    } else {
      toast('Couldn’t copy automatically. Select the text and copy it instead.');
    }
  });

  /* "Sign in as …": copy the login on the way out, and remind the password. */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.acct-go');
    if (!a) return;
    copyText(a.dataset.login).then((ok) => {
      toast(
        `${ok ? 'Copied' : 'Sign in with'} <code>${esc(a.dataset.login)}</code>. Password: <code>${esc(a.dataset.pass)}</code>`,
        6000,
      );
    });
  });

  /* ---------- live demo status ---------- */
  const statusCache = new Map();
  function checkStatus(url) {
    if (statusCache.has(url)) return statusCache.get(url);
    const p = new Promise((resolve) => {
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const t = setTimeout(() => { if (ctrl) ctrl.abort(); resolve(false); }, 8000);
      fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(() => { clearTimeout(t); resolve(true); })
        .catch(() => { clearTimeout(t); resolve(false); });
    });
    statusCache.set(url, p);
    return p;
  }
  $$('[data-status-url]').forEach((el) => {
    checkStatus(el.dataset.statusUrl).then((up) => {
      el.dataset.state = up ? 'online' : 'offline';
      const label = el.querySelector('span');
      if (label) label.textContent = up ? 'Live' : 'Offline right now';
      el.title = up ? 'The demo is up' : 'The demo is not answering right now. Screenshots are on the case study page.';
    });
  });

  /* ---------- reveal on scroll ---------- */
  const reveal = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    reveal.forEach((el) => {
      const sibs = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal')) : [];
      const i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', `${Math.min(i, 6) * 60}ms`);
      io.observe(el);
    });
  } else {
    reveal.forEach((el) => el.classList.add('in'));
  }

  /* ---------- tabs (pricing) ---------- */
  $$('[role="tablist"]').forEach((list) => {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.hidden = !on;
          if (on) $$('[data-reveal]', panel).forEach((el) => el.classList.add('in'));
        }
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft') {
          e.preventDefault();
          select(tabs[(i + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
        }
      });
    });
    const want = location.hash && tabs.find((t) => t.getAttribute('aria-controls') === 'lane-' + location.hash.slice(1));
    if (want) select(want);
  });

  /* ---------- lightbox ---------- */
  const lb = $('.lightbox');
  const shots = $$('[data-lightbox]');
  if (lb && shots.length && typeof lb.showModal === 'function') {
    const img = $('img', lb);
    const cap = $('figcaption', lb);
    let idx = 0;
    const show = (i) => {
      idx = (i + shots.length) % shots.length;
      const s = shots[idx];
      img.src = s.dataset.lightbox;
      img.alt = s.dataset.caption || '';
      cap.textContent = s.dataset.caption || '';
    };
    shots.forEach((s, i) => s.addEventListener('click', () => { show(i); lb.showModal(); }));
    $('.lb-close', lb).addEventListener('click', () => lb.close());
    $('.lb-prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lb-next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    if (shots.length < 2) $$('.lb-prev, .lb-next', lb).forEach((b) => (b.hidden = true));
  } else {
    shots.forEach((s) => s.addEventListener('click', () => window.open(s.dataset.lightbox, '_blank', 'noopener')));
  }

  /* ---------- project brief → email ---------- */
  const form = $('#brief');
  if (form) {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      const sel = form.elements.plan;
      const opt = Array.from(sel.options).find((o) => o.value === plan || o.text === plan);
      if (opt) sel.value = opt.value;
      if (/^Email:/.test(plan)) form.elements.type.value = 'Microsoft 365 / business email';
      if (plan === 'Custom project') form.elements.type.value = 'A web app or custom software';
    }
    const err = $('.form-error', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const bad = ['name', 'email', 'message'].filter((n) => !f[n].value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(f[n].value.trim())));
      ['name', 'email', 'message'].forEach((n) => f[n].setAttribute('aria-invalid', String(bad.includes(n))));
      if (bad.length) {
        err.hidden = false;
        err.textContent = bad.includes('email') && f.email.value.trim() ? 'Please check your email address.' : 'Please fill in your name, email and a few words about the project.';
        f[bad[0]].focus();
        return;
      }
      err.hidden = true;
      const subject = `Project enquiry: ${f.type.value} (${f.name.value.trim()})`;
      const body = [
        `Name: ${f.name.value.trim()}`,
        `Email: ${f.email.value.trim()}`,
        f.phone.value.trim() ? `Phone: ${f.phone.value.trim()}` : '',
        `Project: ${f.type.value}`,
        `Package / budget: ${f.plan.value}`,
        `Timeline: ${f.timeline.value}`,
        '',
        f.message.value.trim(),
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast('Opening your email app… If nothing happens, email us at <code>' + esc(form.dataset.email) + '</code>.', 6000);
    });
  }

  /* ---------- client thumbnails: show the name if the preview service fails ---------- */
  $$('.client-shot img').forEach((im) => {
    const hide = () => { im.style.visibility = 'hidden'; };
    im.addEventListener('error', hide);
    if (im.complete && im.naturalWidth === 0) hide();
  });
})();
