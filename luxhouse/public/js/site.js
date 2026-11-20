/* LUXHOUSE — site behaviour (no framework, no build step).
   Everything here is progressive: without it the pages are complete, readable and navigable.
   Page scripts (/js/pages/<page>.js) load after this file and may use window.LH. */
(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  root.classList.add("js");

  let data = {};
  try {
    data = JSON.parse(doc.getElementById("site-data").textContent);
  } catch (e) {
    data = { lang: root.lang || "en", rate: 2.7, strings: { form: {} } };
  }
  const S = data.strings || {};
  const LANG = data.lang || "en";
  const RATE = Number(data.rate) || 2.7;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, ctx) => (ctx || doc).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    }
  };

  // ------------------------------------------------------------ formatting
  function formatNumber(n) {
    const s = String(Math.round(Math.abs(n)));
    const sep = LANG === "en" ? "," : " ";
    return (n < 0 ? "−" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }
  const SYMBOL = { USD: "$", GEL: "₾", EUR: "€" };
  const formatMoney = (amount, currency) => (SYMBOL[currency] || currency + " ") + formatNumber(amount);

  // ------------------------------------------------------------ toast
  const toastEl = $("[data-toast]");
  let toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.hidden = true;
    toastEl.textContent = message;
    void toastEl.offsetWidth; // restart the entrance
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }

  // ------------------------------------------------------------ header
  // Transparent over the opening frame, a blurred bar once the page moves.
  const header = $("[data-header]");
  if (header) {
    const stick = () => header.classList.toggle("is-stuck", window.scrollY > 24);
    window.addEventListener("scroll", stick, { passive: true });
    stick();
  }

  // ------------------------------------------------------------ menu (below 1180px)
  const menu = $("[data-menu]");
  const menuBtn = $("[data-menu-btn]");
  if (menu && menuBtn) {
    const label = $("span", menuBtn);
    const behind = () => $$("body > main, body > footer, body > aside");
    const isOpen = () => menu.classList.contains("is-open");
    const setMenu = (open) => {
      menu.classList.toggle("is-open", open);
      if (header) header.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? menuBtn.dataset.close : menuBtn.dataset.open;
      root.classList.toggle("is-locked", open);
      behind().forEach((el) => { el.inert = open; });
    };
    menuBtn.addEventListener("click", () => setMenu(!isOpen()));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia("(min-width: 1180px)").addEventListener("change", (e) => { if (e.matches && isOpen()) setMenu(false); });
    // Returning with the back button must not show a stale open menu.
    window.addEventListener("pageshow", (e) => { if (e.persisted && isOpen()) setMenu(false); });
  }

  // ------------------------------------------------------------ currency
  let currency = store.get("lh-currency", "USD") === "GEL" ? "GEL" : "USD";
  function convert(amount, from, to) {
    if (from === to) return amount;
    if (from === "USD" && to === "GEL") return amount * RATE;
    if (from === "GEL" && to === "USD") return amount / RATE;
    return amount;
  }
  function applyCurrency(scope) {
    $$("[data-money]", scope).forEach((el) => {
      const amount = Number(el.getAttribute("data-money"));
      const from = el.getAttribute("data-currency") || "USD";
      if (!isFinite(amount)) return;
      const converted = from !== currency && (from === "USD" || from === "GEL");
      el.textContent = (converted ? "≈ " : "") + formatMoney(converted ? convert(amount, from, currency) : amount, converted ? currency : from);
    });
    $$("[data-currency-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-currency-set") === currency)));
    $$("[data-currency-label]").forEach((el) => { el.textContent = currency; });
  }
  function setCurrency(next) {
    currency = next === "GEL" ? "GEL" : "USD";
    store.set("lh-currency", currency);
    applyCurrency();
    doc.dispatchEvent(new CustomEvent("lh:currency", { detail: { currency } }));
  }
  doc.addEventListener("click", (e) => {
    const set = e.target.closest("[data-currency-set]");
    if (set) return setCurrency(set.getAttribute("data-currency-set"));
    if (e.target.closest("[data-currency-toggle]")) setCurrency(currency === "USD" ? "GEL" : "USD");
  });
  if (currency !== "USD") applyCurrency();

  // ------------------------------------------------------------ saved residences
  function savedList() {
    const list = store.get("lh-saved", []);
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  }
  function renderSaved(scope) {
    const list = savedList();
    $$("[data-save]", scope).forEach((btn) => {
      const on = list.includes(btn.getAttribute("data-save"));
      btn.setAttribute("aria-pressed", String(on));
      const label = $("[data-save-label]", btn);
      if (label) label.textContent = on ? S.saved : S.save;
    });
    $$("[data-saved-count]").forEach((el) => {
      el.textContent = String(list.length);
      el.hidden = list.length === 0;
    });
    $$("[data-saved-link]").forEach((el) => el.classList.toggle("is-on", list.length > 0));
  }
  doc.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save]");
    if (!btn) return;
    e.preventDefault();
    const slug = btn.getAttribute("data-save");
    const list = savedList();
    const idx = list.indexOf(slug);
    if (idx > -1) list.splice(idx, 1); else list.push(slug);
    store.set("lh-saved", list);
    renderSaved();
    if (idx === -1) toast(S.saved);
    doc.dispatchEvent(new CustomEvent("lh:saved", { detail: { saved: list } }));
  });
  renderSaved();

  const savedPage = $("[data-saved-page]");
  if (savedPage) {
    const grid = $("[data-saved-grid]", savedPage);
    const empty = $("[data-saved-empty]", savedPage);
    const loadSaved = () => {
      const list = savedList();
      if (!list.length) { grid.innerHTML = ""; grid.hidden = true; empty.hidden = false; return; }
      fetch(data.savedCardsUrl + "&slugs=" + encodeURIComponent(list.join(",")), { headers: { Accept: "application/json" } })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((res) => {
          grid.innerHTML = res.html;
          grid.hidden = res.count === 0;
          empty.hidden = res.count > 0;
          renderSaved(grid);
          applyCurrency(grid);
        })
        .catch(() => { grid.hidden = true; empty.hidden = false; });
    };
    loadSaved();
    doc.addEventListener("lh:saved", () => {
      // Remove un-saved homes at once.
      const list = savedList();
      $$("[data-card]", grid).forEach((card) => { if (!list.includes(card.getAttribute("data-card"))) card.remove(); });
      grid.hidden = list.length === 0;
      empty.hidden = list.length > 0;
    });
  }

  // ------------------------------------------------------------ forms
  const today = new Date();
  const todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  $$("[data-min-today]").forEach((el) => { el.min = todayIso; });

  const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

  function setFieldError(form, name, message) {
    // "contact" means neither a phone number nor an email was given: it belongs to both fields.
    const fields = (name === "contact" ? ["phone", "email"] : [name]).map((n) => $('[data-field="' + n + '"]', form)).filter(Boolean);
    const out = name === "contact" ? $('[data-error-for="contact"]', form) : fields[0] ? $("[data-error]", fields[0]) : null;
    if (out) { out.textContent = message || ""; out.hidden = !message; }
    fields.forEach((field) => {
      field.classList.toggle("has-error", Boolean(message));
      const input = $("input, textarea, select", field);
      if (!input) return;
      if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    });
  }

  function validateForm(values) {
    const F = S.form || {};
    const errors = {};
    if (values.name.trim().length < 2) errors.name = F.errName;
    const phone = values.phone.trim();
    const email = values.email.trim();
    if (!phone && !email) errors.contact = F.errContact;
    const digits = phone.replace(/\D/g, "");
    if (phone && (digits.length < 6 || digits.length > 16 || !/^[\d\s()+\-./]+$/.test(phone))) errors.phone = F.errPhone;
    if (email && !EMAIL_RE.test(email)) errors.email = F.errEmail;
    if (!values.consent) errors.consent = F.errConsent;
    return errors;
  }

  $$("[data-inquiry-form]").forEach((form) => {
    const status = $("[data-form-status]", form);
    const submit = $("[data-submit]", form);
    const submitText = (submit && $("[data-submit-label]", submit)) || submit;
    const submitLabel = submitText ? submitText.textContent : "";

    const showStatus = (kind, message) => {
      status.className = "form__status form__status--" + kind;
      status.textContent = message;
      status.hidden = false;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = {};
      new FormData(form).forEach((v, k) => { values[k] = typeof v === "string" ? v : ""; });
      values.name = values.name || "";
      values.phone = values.phone || "";
      values.email = values.email || "";
      values.consent = Boolean(form.elements.consent && form.elements.consent.checked);

      ["contact", "name", "phone", "email", "consent"].forEach((n) => setFieldError(form, n, ""));
      status.hidden = true;

      const errors = validateForm(values);
      const names = Object.keys(errors);
      if (names.length) {
        // The shared "phone or email" message goes first so a field's own message can still mark it.
        names.sort((a, b) => (a === "contact" ? -1 : b === "contact" ? 1 : 0)).forEach((n) => setFieldError(form, n, errors[n]));
        const order = ["name", "contact", "phone", "email", "consent"].filter((n) => errors[n]);
        const firstInput = $('[data-field="' + (order[0] === "contact" ? "phone" : order[0]) + '"] input', form);
        if (firstInput) firstInput.focus();
        return;
      }

      submit.disabled = true;
      submitText.textContent = S.sending || submitLabel;
      fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values)
      })
        .then((res) => res.json().catch(() => ({})).then((body) => ({ status: res.status, body })))
        .then((res) => {
          const F = S.form || {};
          if (res.status === 201 || (res.status === 200 && res.body.ok)) {
            showStatus("ok", F.success);
            const keep = { type: values.type, lang: values.lang, slug: values.slug };
            form.reset();
            Object.keys(keep).forEach((k) => { if (form.elements[k] && keep[k] !== undefined) form.elements[k].value = keep[k]; });
          } else if (res.status === 422 && res.body.fields) {
            Object.keys(res.body.fields).forEach((n) => setFieldError(form, n, F[res.body.fields[n]] || F.error));
          } else if (res.status === 429) {
            showStatus("error", F.tooMany);
          } else {
            showStatus("error", F.error);
          }
        })
        .catch(() => { showStatus("error", (S.form || {}).error); })
        .then(() => {
          submit.disabled = false;
          submitText.textContent = submitLabel;
        });
    });
  });

  // Filters apply as soon as a control changes.
  const filters = $("[data-filters]");
  if (filters) {
    filters.addEventListener("change", () => {
      // Drop empty parameters so shared URLs stay short.
      $$("select, input", filters).forEach((el) => {
        if ((el.tagName === "SELECT" && !el.value) || (el.name === "sort" && el.value === "newest")) el.disabled = true;
      });
      filters.submit();
    });
    // Restore the controls disabled above when the page comes back from the back/forward cache.
    window.addEventListener("pageshow", () => { $$("select, input", filters).forEach((el) => { el.disabled = false; }); });
  }

  // ------------------------------------------------------------ share
  const share = $("[data-share]");
  if (share) {
    const shareBtn = $("[data-share-toggle]", share);
    const shareMenu = $("[data-share-menu], .share__menu", share);
    const setShare = (open) => {
      shareMenu.hidden = !open;
      shareBtn.setAttribute("aria-expanded", String(open));
    };
    shareBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: doc.title, url: location.href }).catch(() => {});
        return;
      }
      setShare(shareMenu.hidden);
    });
    doc.addEventListener("click", (e) => { if (!share.contains(e.target)) setShare(false); });
    share.addEventListener("keydown", (e) => { if (e.key === "Escape" && !shareMenu.hidden) { setShare(false); shareBtn.focus(); } });
    $$("[data-copy-link]", share).forEach((b) => {
      b.addEventListener("click", () => {
        const link = b.getAttribute("data-copy-link") || location.href;
        const done = () => { toast(S.copied); setShare(false); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done, () => { window.prompt("", link); });
        } else {
          window.prompt("", link);
        }
      });
    });
  }

  // ------------------------------------------------------------ lightbox
  // Photographs come from <script type="application/json" id="lightbox-data">; any element with
  // data-lightbox-open="<index>" opens the viewer at that photograph.
  let openLightbox = () => {};
  const lbDataEl = doc.getElementById("lightbox-data");
  if (lbDataEl && "HTMLDialogElement" in window) {
    let photos = [];
    try { photos = JSON.parse(lbDataEl.textContent); } catch (e) { photos = []; }
    let dlg = null;
    let index = 0;

    const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#' + name + '"/></svg>';

    const show = (i) => {
      if (!photos.length) return;
      index = (i + photos.length) % photos.length;
      const p = photos[index];
      const img = $("[data-lb-img]", dlg);
      img.removeAttribute("srcset");
      img.src = p.src;
      if (p.srcset) { img.srcset = p.srcset; img.sizes = "100vw"; }
      if (p.w && p.h) { img.width = p.w; img.height = p.h; }
      img.alt = p.alt || "";
      $("[data-lb-counter]", dlg).textContent = (S.photoOf || "{i} / {n}").replace("{i}", index + 1).replace("{n}", photos.length);
      $("[data-lb-caption]", dlg).textContent = p.label || "";
      // Warm the neighbours.
      [index + 1, index - 1].forEach((n) => {
        const q = photos[(n + photos.length) % photos.length];
        if (q) { const pre = new Image(); pre.src = q.src; }
      });
    };

    const build = () => {
      dlg = doc.createElement("dialog");
      dlg.className = "lightbox";
      dlg.innerHTML =
        '<div class="lightbox__in">' +
        '<div class="lightbox__bar"><p class="label"><span class="num" data-lb-counter></span><span data-lb-caption></span></p>' +
        '<button class="round" type="button" data-lb-close>' + icon("i-close") + "</button></div>" +
        '<div class="lightbox__img" data-lb-stage><img data-lb-img alt=""></div>' +
        '<div class="lightbox__nav"><button class="round" type="button" data-lb-prev>' + icon("i-arrow-left") + "</button>" +
        '<button class="round" type="button" data-lb-next>' + icon("i-arrow-right") + "</button></div>" +
        "</div>";
      dlg.setAttribute("aria-label", S.gallery || "");
      $("[data-lb-close]", dlg).setAttribute("aria-label", S.close || "");
      $("[data-lb-prev]", dlg).setAttribute("aria-label", S.previous || "");
      $("[data-lb-next]", dlg).setAttribute("aria-label", S.next || "");
      doc.body.appendChild(dlg);

      $("[data-lb-close]", dlg).addEventListener("click", () => dlg.close());
      $("[data-lb-prev]", dlg).addEventListener("click", () => show(index - 1));
      $("[data-lb-next]", dlg).addEventListener("click", () => show(index + 1));
      const stage = $("[data-lb-stage]", dlg);
      stage.addEventListener("click", (e) => { if (e.target === stage) dlg.close(); });

      let startX = null;
      let startY = null;
      stage.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
      stage.addEventListener("touchend", (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(index + (dx < 0 ? 1 : -1));
        startX = null;
      });

      dlg.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") show(index - 1);
        else if (e.key === "ArrowRight") show(index + 1);
      });
      // Escape and the close button both end here; the browser returns focus to the opener.
      dlg.addEventListener("close", () => root.classList.remove("is-locked"));
    };

    openLightbox = (i) => {
      if (!dlg) build();
      show(Number(i) || 0);
      if (!dlg.open) dlg.showModal();
      root.classList.add("is-locked");
    };

    doc.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-lightbox-open]");
      if (!opener) return;
      e.preventDefault();
      openLightbox(opener.getAttribute("data-lightbox-open"));
    });
  }

  // ------------------------------------------------------------ maps (Leaflet, loaded only on pages that need it)
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  const BONE = "#ede8e0";
  // An approximate area: a dotted bone ring, barely filled. Exact addresses are never drawn.
  const AREA = { color: BONE, weight: 1.2, dashArray: "2 8", lineCap: "round", fillColor: BONE, fillOpacity: 0.06, interactive: false };

  function baseMap(el, options) {
    const L = window.L;
    const map = L.map(el, Object.assign({ scrollWheelZoom: false, zoomControl: true, attributionControl: true }, options || {}));
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer(TILE_URL, { maxZoom: 18, attribution: TILE_ATTR }).addTo(map);
    // Let the page scroll normally until the visitor clicks into the map.
    map.on("click", () => { map.scrollWheelZoom.enable(); });
    el.addEventListener("mouseleave", () => { map.scrollWheelZoom.disable(); });
    return map;
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const mapInits = {
    area(el) {
      const L = window.L;
      const lat = Number(el.getAttribute("data-lat"));
      const lng = Number(el.getAttribute("data-lng"));
      const radius = Number(el.getAttribute("data-radius")) || 1000;
      // A view must exist before Leaflet can project a metric circle.
      const map = baseMap(el).setView([lat, lng], 13);
      const circle = L.circle([lat, lng], Object.assign({ radius }, AREA)).addTo(map);
      L.circleMarker([lat, lng], { radius: 3.5, stroke: false, fillColor: BONE, fillOpacity: 1, interactive: false }).addTo(map);
      map.fitBounds(circle.getBounds().pad(0.9));
      return map;
    },
    office(el) {
      const L = window.L;
      const lat = Number(el.getAttribute("data-lat"));
      const lng = Number(el.getAttribute("data-lng"));
      const map = baseMap(el).setView([lat, lng], 16);
      L.circleMarker([lat, lng], { radius: 8, color: "#0b0a09", weight: 2, fillColor: BONE, fillOpacity: 1 }).addTo(map);
      return map;
    },
    residences(el) {
      const L = window.L;
      let points = [];
      try { points = JSON.parse(el.getAttribute("data-points")); } catch (e) { points = []; }
      const map = baseMap(el).setView([41.7151, 44.8271], 11);
      const bounds = [];
      const markers = [];
      points.forEach((p) => {
        if (!isFinite(p.lat) || !isFinite(p.lng)) return;
        L.circle([p.lat, p.lng], Object.assign({ radius: p.radius || 1000 }, AREA)).addTo(map);
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "map-pin-wrap", html: '<span class="map-pin">' + escapeHtml(p.price) + "</span>", iconSize: [0, 0] }),
          title: p.title,
          keyboard: true
        }).addTo(map);
        marker.bindPopup(
          '<a class="map-popup" href="' + escapeHtml(p.url) + '"><img src="' + escapeHtml(p.img) + '" alt="" width="92" height="70">' +
          "<span><strong>" + escapeHtml(p.title) + "</strong><span>" + escapeHtml(p.place) + " · " + escapeHtml(p.price) + "</span></span></a>",
          { closeButton: false, offset: [0, -12] }
        );
        markers.push(marker);
        bounds.push([p.lat, p.lng]);
      });
      // Price labels of neighbouring homes would cover each other: stack them vertically instead.
      const declutter = () => {
        const placed = [];
        markers
          .map((mk) => ({ mk, pt: map.latLngToContainerPoint(mk.getLatLng()) }))
          .sort((a, b) => a.pt.y - b.pt.y || a.pt.x - b.pt.x)
          .forEach((item) => {
            const pinEl = item.mk.getElement();
            const pin = pinEl && pinEl.querySelector(".map-pin");
            if (!pin) return;
            const w = pin.offsetWidth || 90;
            const h = pin.offsetHeight || 30;
            let y = item.pt.y;
            let moved = true;
            while (moved) {
              moved = false;
              for (const o of placed) {
                if (Math.abs(o.x - item.pt.x) < (o.w + w) / 2 + 4 && Math.abs(o.y - y) < (o.h + h) / 2 + 4) {
                  y = o.y + (o.h + h) / 2 + 4;
                  moved = true;
                }
              }
            }
            pin.style.setProperty("--dy", Math.round(y - item.pt.y) + "px");
            placed.push({ x: item.pt.x, y, w, h });
          });
      };
      map.on("zoomend moveend resize", declutter);
      if (bounds.length === 1) map.setView(bounds[0], 13);
      else if (bounds.length) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 13 });
      declutter();
      return map;
    }
  };

  const maps = new Map();
  function initMap(el) {
    if (maps.has(el) || !window.L) return;
    const kind = el.getAttribute("data-map");
    if (!mapInits[kind]) return;
    maps.set(el, mapInits[kind](el));
  }
  function initVisibleMaps() {
    $$("[data-map]").forEach((el) => {
      if (el.offsetParent === null) return; // hidden panel: created when shown
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) { initMap(el); io.disconnect(); }
          });
        }, { rootMargin: "300px" });
        io.observe(el);
      } else {
        initMap(el);
      }
    });
  }
  if ($("[data-map]")) {
    if (doc.readyState === "complete") initVisibleMaps();
    else window.addEventListener("load", initVisibleMaps);
  }

  // Two views of one list (grid / map on the residences index).
  const viewBtns = $$("[data-view-btn]");
  if (viewBtns.length) {
    const setView = (view) => {
      viewBtns.forEach((b) => {
        const on = b.getAttribute("data-view-btn") === view;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      $$("[data-view-panel]").forEach((panel) => { panel.hidden = panel.getAttribute("data-view-panel") !== view; });
      if (view === "map") {
        const el = $('[data-view-panel="map"] [data-map]');
        if (el) {
          initMap(el);
          const m = maps.get(el);
          if (m) m.invalidateSize();
        }
      }
    };
    viewBtns.forEach((b) => { b.addEventListener("click", () => setView(b.getAttribute("data-view-btn"))); });
  }

  // ------------------------------------------------------------ financing calculator
  const calc = $("[data-calc]");
  if (calc) {
    const price = Number(calc.getAttribute("data-price"));
    const priceCurrency = calc.getAttribute("data-currency") || "USD";
    const down = $("[data-calc-down]", calc);
    const years = $("[data-calc-years]", calc);
    const rate = $("[data-calc-rate]", calc);
    const put = (sel, text) => { const el = $(sel, calc); if (el) el.textContent = text; };
    const update = () => {
      const downPct = Math.min(90, Math.max(0, Number(down.value) || 0));
      const n = Math.max(1, Number(years.value) || 1) * 12;
      const r = Math.max(0, Number(String(rate.value).replace(",", ".")) || 0) / 100 / 12;
      const loan = price * (1 - downPct / 100);
      const monthly = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
      const conv = (v) => convert(v, priceCurrency, currency);
      const approx = currency !== priceCurrency ? "≈ " : "";
      put("[data-calc-down-out]", downPct + "% · " + approx + formatMoney(conv(price * downPct / 100), currency));
      put("[data-calc-years-out]", years.value + " " + (S.yearsUnit || ""));
      put("[data-calc-monthly]", approx + formatMoney(conv(monthly), currency));
      put("[data-calc-loan]", approx + formatMoney(conv(loan), currency));
    };
    [down, years, rate].forEach((el) => { el.addEventListener("input", update); });
    doc.addEventListener("lh:currency", update);
    update();
  }

  // ------------------------------------------------------------ sticky call to action
  // Steps aside (.is-hidden) while the enquiry form itself is on screen.
  const mobileCta = $("[data-mobile-cta]");
  const inquiry = doc.getElementById("inquiry");
  if (mobileCta && inquiry && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      mobileCta.classList.toggle("is-hidden", entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe(inquiry);
  }

  // ------------------------------------------------------------ reveal on scroll
  // Only blocks that start below the fold wait, and only once. The waiting state is set here and
  // nowhere else, so nothing is ever hidden when this script does not run.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.remove("rv--wait");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    $$(".rv").forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 1.02) {
        el.classList.add("rv--wait");
        io.observe(el);
      }
    });
  }

  // ------------------------------------------------------------ the 3D stage
  // A pool of light and a few pixels of parallax follow the pointer.
  $$("[data-stage]").forEach((stage) => {
    const scene = $("[data-scene]", stage);
    if (!scene || reduceMotion) return;
    const read = () => {
      const cs = getComputedStyle(stage);
      return { x: parseFloat(cs.getPropertyValue("--sx")) || 60, y: parseFloat(cs.getPropertyValue("--sy")) || 55 };
    };
    let home = read();
    const cur = { x: home.x, y: home.y, px: 0, py: 0 };
    const to = { x: home.x, y: home.y, px: 0, py: 0 };
    let raf = 0;
    let live = false;
    const tick = () => {
      let moving = false;
      for (const k in cur) {
        const d = to[k] - cur[k];
        if (Math.abs(d) > 0.02) { cur[k] += d * 0.085; moving = true; } else cur[k] = to[k];
      }
      stage.style.setProperty("--sx", cur.x.toFixed(2) + "%");
      stage.style.setProperty("--sy", cur.y.toFixed(2) + "%");
      stage.style.setProperty("--px", cur.px.toFixed(1) + "px");
      stage.style.setProperty("--py", cur.py.toFixed(1) + "px");
      if (moving) { raf = requestAnimationFrame(tick); return; }
      raf = 0;
      if (!live) {
        // At rest again: hand the light back to the stylesheet, so it follows the layout.
        ["--sx", "--sy", "--px", "--py"].forEach((p) => stage.style.removeProperty(p));
      }
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      if (!live) { home = read(); live = true; if (!raf) { cur.x = home.x; cur.y = home.y; } }
      const s = stage.getBoundingClientRect();
      const r = scene.getBoundingClientRect();
      to.x = ((e.clientX - r.left) / r.width) * 100;
      to.y = ((e.clientY - r.top) / r.height) * 100;
      to.px = (0.5 - (e.clientX - s.left) / s.width) * s.width * 0.022;
      to.py = (0.5 - (e.clientY - s.top) / s.height) * s.height * 0.022;
      go();
    });
    stage.addEventListener("pointerleave", () => {
      if (!live) return;
      live = false;
      to.x = home.x; to.y = home.y; to.px = 0; to.py = 0;
      go();
    });
  });

  // ------------------------------------------------------------ for page scripts
  window.LH = {
    lang: LANG,
    strings: S,
    store,
    toast,
    formatNumber,
    formatMoney,
    convert,
    get currency() { return currency; },
    setCurrency,
    saved: savedList,
    /** Call after inserting markup: applies the saved state and the chosen currency inside `scope`. */
    refresh(scope) { renderSaved(scope); applyCurrency(scope); },
    openLightbox: (i) => openLightbox(i)
  };
})();
