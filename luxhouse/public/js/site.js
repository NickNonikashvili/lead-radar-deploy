/* Luxhouse — site behaviour (no framework, no build step). */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.add("js");

  var data = {};
  try {
    data = JSON.parse(doc.getElementById("site-data").textContent);
  } catch (e) {
    data = { lang: root.lang || "en", rate: 2.7, strings: { form: {} } };
  }
  var S = data.strings || {};
  var LANG = data.lang || "en";
  var RATE = Number(data.rate) || 2.7;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  var store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    }
  };

  // ------------------------------------------------------------ formatting
  function formatNumber(n) {
    var s = String(Math.round(Math.abs(n)));
    var sep = LANG === "en" ? "," : " ";
    return (n < 0 ? "−" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }
  var SYMBOL = { USD: "$", GEL: "₾", EUR: "€" };
  function formatMoney(amount, currency) { return (SYMBOL[currency] || currency + " ") + formatNumber(amount); }

  // ------------------------------------------------------------ toast
  var toastEl = $("[data-toast]");
  var toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  // ------------------------------------------------------------ header
  var header = $("[data-header]");
  if (header && header.classList.contains("site-header--overlay")) {
    var setSolid = function () { header.classList.toggle("is-solid", window.scrollY > 40); };
    setSolid();
    window.addEventListener("scroll", setSolid, { passive: true });
  }

  // ------------------------------------------------------------ mobile menu
  var menu = $("[data-menu]");
  var menuOpenBtn = $("[data-menu-open]");
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    doc.body.classList.toggle("is-locked", open);
    if (menuOpenBtn) menuOpenBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      var first = $("[data-menu-close]", menu);
      if (first) first.focus();
    } else if (menuOpenBtn) {
      menuOpenBtn.focus();
    }
  }
  if (menu && menuOpenBtn) {
    menuOpenBtn.addEventListener("click", function () { setMenu(true); });
    $$("[data-menu-close]", menu).forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
    menu.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    window.addEventListener("resize", function () { if (!menu.hidden && window.innerWidth > 1180) setMenu(false); });
  }

  // ------------------------------------------------------------ currency
  var currency = store.get("lh-currency", "USD") === "GEL" ? "GEL" : "USD";
  function convert(amount, from, to) {
    if (from === to) return amount;
    if (from === "USD" && to === "GEL") return amount * RATE;
    if (from === "GEL" && to === "USD") return amount / RATE;
    return amount;
  }
  function applyCurrency() {
    $$("[data-money]").forEach(function (el) {
      var amount = Number(el.getAttribute("data-money"));
      var from = el.getAttribute("data-currency") || "USD";
      if (!isFinite(amount)) return;
      var converted = from !== currency && (from === "USD" || from === "GEL");
      el.textContent = (converted ? "≈ " : "") + formatMoney(converted ? convert(amount, from, currency) : amount, converted ? currency : from);
    });
    $$("[data-currency-label]").forEach(function (el) { el.textContent = currency; });
    doc.dispatchEvent(new CustomEvent("lh:currency", { detail: { currency: currency } }));
  }
  $$("[data-currency-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      currency = currency === "USD" ? "GEL" : "USD";
      store.set("lh-currency", currency);
      applyCurrency();
    });
  });
  if (currency !== "USD") applyCurrency();

  // ------------------------------------------------------------ saved residences
  function savedList() {
    var list = store.get("lh-saved", []);
    return Array.isArray(list) ? list.filter(function (s) { return typeof s === "string"; }) : [];
  }
  function renderSaved(scope) {
    var list = savedList();
    $$("[data-save]", scope).forEach(function (btn) {
      var on = list.indexOf(btn.getAttribute("data-save")) > -1;
      btn.setAttribute("aria-pressed", String(on));
      var label = $("[data-save-label]", btn);
      if (label) label.textContent = on ? S.saved : S.save;
    });
    $$("[data-saved-count]").forEach(function (el) {
      el.textContent = String(list.length);
      el.hidden = list.length === 0;
    });
  }
  doc.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-save]");
    if (!btn) return;
    e.preventDefault();
    var slug = btn.getAttribute("data-save");
    var list = savedList();
    var idx = list.indexOf(slug);
    if (idx > -1) list.splice(idx, 1); else list.push(slug);
    store.set("lh-saved", list);
    renderSaved();
    if (idx === -1) toast(S.saved);
    doc.dispatchEvent(new CustomEvent("lh:saved"));
  });
  renderSaved();

  var savedPage = $("[data-saved-page]");
  if (savedPage) {
    var grid = $("[data-saved-grid]", savedPage);
    var empty = $("[data-saved-empty]", savedPage);
    var loadSaved = function () {
      var list = savedList();
      if (!list.length) { grid.innerHTML = ""; empty.hidden = false; return; }
      fetch(data.savedCardsUrl + "&slugs=" + encodeURIComponent(list.join(",")), { headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (res) {
          grid.innerHTML = res.html;
          empty.hidden = res.count > 0;
          renderSaved(grid);
          applyCurrency();
        })
        .catch(function () { empty.hidden = false; });
    };
    loadSaved();
    doc.addEventListener("lh:saved", function () {
      // Remove un-saved cards immediately.
      var list = savedList();
      $$("[data-card]", grid).forEach(function (card) { if (list.indexOf(card.getAttribute("data-card")) === -1) card.remove(); });
      empty.hidden = list.length > 0;
    });
  }

  // ------------------------------------------------------------ forms
  var today = new Date();
  var todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  $$("[data-min-today]").forEach(function (el) { el.min = todayIso; });

  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

  function setFieldError(form, name, message) {
    var field = $('[data-field="' + name + '"]', form);
    var out = field ? $("[data-error]", field) : null;
    if (name === "contact") out = $('[data-error-for="contact"]', form);
    if (field) field.classList.toggle("has-error", Boolean(message));
    if (out) { out.textContent = message || ""; out.hidden = !message; }
    var input = field ? $("input, textarea, select", field) : null;
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
  }

  function validateForm(form, values) {
    var F = S.form || {};
    var errors = {};
    if (values.name.trim().length < 2) errors.name = F.errName;
    var phone = values.phone.trim();
    var email = values.email.trim();
    if (!phone && !email) errors.contact = F.errContact;
    var digits = phone.replace(/\D/g, "");
    if (phone && (digits.length < 6 || digits.length > 16 || !/^[\d\s()+\-./]+$/.test(phone))) errors.phone = F.errPhone;
    if (email && !EMAIL_RE.test(email)) errors.email = F.errEmail;
    if (!values.consent) errors.consent = F.errConsent;
    return errors;
  }

  $$("[data-inquiry-form]").forEach(function (form) {
    var status = $("[data-form-status]", form);
    var submit = $("[data-submit]", form);
    var submitLabel = submit ? submit.textContent : "";

    function showStatus(kind, message) {
      status.className = "form__status form__status--" + kind;
      status.textContent = message;
      status.hidden = false;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var values = {};
      fd.forEach(function (v, k) { values[k] = typeof v === "string" ? v : ""; });
      values.name = values.name || "";
      values.phone = values.phone || "";
      values.email = values.email || "";
      values.consent = Boolean(form.elements.consent && form.elements.consent.checked);

      ["name", "phone", "email", "contact", "consent"].forEach(function (n) { setFieldError(form, n, ""); });
      status.hidden = true;

      var errors = validateForm(form, values);
      var names = Object.keys(errors);
      if (names.length) {
        names.forEach(function (n) { setFieldError(form, n, errors[n]); });
        var firstName = names[0] === "contact" ? "phone" : names[0];
        var firstInput = $('[data-field="' + firstName + '"] input', form);
        if (firstInput) firstInput.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = S.sending || submitLabel;
      fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { status: res.status, body: body }; });
        })
        .then(function (res) {
          var F = S.form || {};
          if (res.status === 201 || (res.status === 200 && res.body.ok)) {
            showStatus("ok", F.success);
            var keep = { type: values.type, lang: values.lang, slug: values.slug };
            form.reset();
            Object.keys(keep).forEach(function (k) { if (form.elements[k] && keep[k] !== undefined) form.elements[k].value = keep[k]; });
          } else if (res.status === 422 && res.body.fields) {
            Object.keys(res.body.fields).forEach(function (n) { setFieldError(form, n, F[res.body.fields[n]] || F.error); });
          } else if (res.status === 429) {
            showStatus("error", F.tooMany);
          } else {
            showStatus("error", F.error);
          }
        })
        .catch(function () { showStatus("error", (S.form || {}).error); })
        .then(function () {
          submit.disabled = false;
          submit.textContent = submitLabel;
        });
    });
  });

  // Auto-apply filters when a control changes.
  var filters = $("[data-filters]");
  if (filters) {
    filters.addEventListener("change", function () {
      // Drop empty parameters so shared URLs stay short.
      $$("select, input", filters).forEach(function (el) {
        if ((el.tagName === "SELECT" && !el.value) || (el.name === "sort" && el.value === "newest")) el.disabled = true;
      });
      filters.submit();
    });
  }
  // Restore controls disabled above when the page is shown again from the back/forward cache.
  window.addEventListener("pageshow", function () {
    if (filters) $$("select, input", filters).forEach(function (el) { el.disabled = false; });
  });

  // ------------------------------------------------------------ share
  var share = $("[data-share]");
  if (share) {
    var shareBtn = $("[data-share-toggle]", share);
    var shareMenu = $(".share__menu", share);
    var setShare = function (open) {
      shareMenu.hidden = !open;
      shareBtn.setAttribute("aria-expanded", String(open));
    };
    shareBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: doc.title, url: location.href }).catch(function () {});
        return;
      }
      setShare(shareMenu.hidden);
    });
    doc.addEventListener("click", function (e) { if (!share.contains(e.target)) setShare(false); });
    share.addEventListener("keydown", function (e) { if (e.key === "Escape") { setShare(false); shareBtn.focus(); } });
    $$("[data-copy-link]", share).forEach(function (b) {
      b.addEventListener("click", function () {
        var link = b.getAttribute("data-copy-link") || location.href;
        var done = function () { toast(S.copied); setShare(false); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done, function () { window.prompt("", link); });
        } else {
          window.prompt("", link);
        }
      });
    });
  }

  // ------------------------------------------------------------ lightbox
  var lbDataEl = doc.getElementById("lightbox-data");
  if (lbDataEl) {
    var photos = [];
    try { photos = JSON.parse(lbDataEl.textContent); } catch (e) { photos = []; }
    var lb = null;
    var lbIndex = 0;
    var lbOpener = null;

    var icon = function (name) { return '<svg class="icon" aria-hidden="true"><use href="#' + name + '"/></svg>'; };

    var build = function () {
      lb = doc.createElement("div");
      lb.className = "lightbox";
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-modal", "true");
      lb.innerHTML =
        '<div class="lightbox__top"><span class="lightbox__counter" data-lb-counter></span>' +
        '<button type="button" class="lightbox__btn" data-lb-close aria-label="' + S.close + '">' + icon("i-close") + "</button></div>" +
        '<div class="lightbox__stage" data-lb-stage>' +
        '<button type="button" class="lightbox__btn lightbox__nav lightbox__nav--prev" data-lb-prev aria-label="' + S.previous + '">' + icon("i-arrow-left") + "</button>" +
        '<img class="lightbox__img" data-lb-img alt="">' +
        '<button type="button" class="lightbox__btn lightbox__nav lightbox__nav--next" data-lb-next aria-label="' + S.next + '">' + icon("i-arrow-right") + "</button></div>" +
        '<p class="lightbox__caption" data-lb-caption></p>';
      doc.body.appendChild(lb);

      $("[data-lb-close]", lb).addEventListener("click", closeLb);
      $("[data-lb-prev]", lb).addEventListener("click", function () { show(lbIndex - 1); });
      $("[data-lb-next]", lb).addEventListener("click", function () { show(lbIndex + 1); });
      var stage = $("[data-lb-stage]", lb);
      stage.addEventListener("click", function (e) { if (e.target === stage) closeLb(); });

      var startX = null;
      var startY = null;
      stage.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
      stage.addEventListener("touchend", function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(lbIndex + (dx < 0 ? 1 : -1));
        startX = null;
      });

      lb.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeLb();
        else if (e.key === "ArrowLeft") show(lbIndex - 1);
        else if (e.key === "ArrowRight") show(lbIndex + 1);
        else if (e.key === "Tab") {
          var focusables = $$("button", lb);
          var first = focusables[0];
          var last = focusables[focusables.length - 1];
          if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
    };

    var show = function (i) {
      if (!photos.length) return;
      lbIndex = (i + photos.length) % photos.length;
      var p = photos[lbIndex];
      var img = $("[data-lb-img]", lb);
      img.removeAttribute("srcset");
      img.src = p.src;
      img.srcset = p.srcset;
      img.sizes = "100vw";
      img.width = p.w;
      img.height = p.h;
      img.alt = p.alt || "";
      $("[data-lb-counter]", lb).textContent = (S.photoOf || "{i} / {n}").replace("{i}", lbIndex + 1).replace("{n}", photos.length);
      $("[data-lb-caption]", lb).textContent = p.label || "";
      // Warm the neighbours.
      [lbIndex + 1, lbIndex - 1].forEach(function (n) {
        var q = photos[(n + photos.length) % photos.length];
        if (q) { var pre = new Image(); pre.src = q.src; }
      });
    };

    var openLb = function (i, opener) {
      if (!lb) build();
      lbOpener = opener || null;
      lb.hidden = false;
      doc.body.classList.add("is-locked");
      show(i);
      $("[data-lb-close]", lb).focus();
    };

    var closeLb = function () {
      if (!lb) return;
      lb.hidden = true;
      doc.body.classList.remove("is-locked");
      if (lbOpener && lbOpener.focus) lbOpener.focus();
    };

    doc.addEventListener("click", function (e) {
      var opener = e.target.closest && e.target.closest("[data-lightbox-open]");
      if (!opener) return;
      e.preventDefault();
      openLb(Number(opener.getAttribute("data-lightbox-open")) || 0, opener);
    });
  }

  // ------------------------------------------------------------ maps (Leaflet, loaded only on pages that need it)
  var TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  function baseMap(el, options) {
    var L = window.L;
    var map = L.map(el, Object.assign({ scrollWheelZoom: false, zoomControl: true, attributionControl: true }, options || {}));
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer(TILE_URL, { maxZoom: 18, attribution: TILE_ATTR }).addTo(map);
    // Let the page scroll normally until the visitor clicks into the map.
    map.on("click", function () { map.scrollWheelZoom.enable(); });
    el.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });
    return map;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  var mapInits = {
    area: function (el) {
      var L = window.L;
      var lat = Number(el.getAttribute("data-lat"));
      var lng = Number(el.getAttribute("data-lng"));
      var radius = Number(el.getAttribute("data-radius")) || 1000;
      // A view must exist before Leaflet can project a metric circle.
      var map = baseMap(el).setView([lat, lng], 13);
      var circle = L.circle([lat, lng], { radius: radius, color: "#7a5a31", weight: 1.5, fillColor: "#a5814f", fillOpacity: 0.2, interactive: false }).addTo(map);
      map.fitBounds(circle.getBounds().pad(0.9));
      return map;
    },
    office: function (el) {
      var L = window.L;
      var lat = Number(el.getAttribute("data-lat"));
      var lng = Number(el.getAttribute("data-lng"));
      var map = baseMap(el).setView([lat, lng], 16);
      L.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 2, fillColor: "#0f1113", fillOpacity: 1 }).addTo(map);
      return map;
    },
    residences: function (el) {
      var L = window.L;
      var points = [];
      try { points = JSON.parse(el.getAttribute("data-points")); } catch (e) { points = []; }
      var map = baseMap(el).setView([41.7151, 44.8271], 11);
      var bounds = [];
      var markers = [];
      points.forEach(function (p) {
        if (!isFinite(p.lat) || !isFinite(p.lng)) return;
        L.circle([p.lat, p.lng], { radius: p.radius || 1000, color: "#7a5a31", weight: 1, fillColor: "#a5814f", fillOpacity: 0.14, interactive: false }).addTo(map);
        var marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "map-pin-wrap", html: '<span class="map-pin">' + escapeHtml(p.price) + "</span>", iconSize: [0, 0] }),
          title: p.title,
          keyboard: true
        }).addTo(map);
        marker.bindPopup(
          '<a class="map-popup" href="' + escapeHtml(p.url) + '"><img src="' + escapeHtml(p.img) + '" alt="" width="92" height="70">' +
          "<span><strong>" + escapeHtml(p.title) + "</strong><span>" + escapeHtml(p.place) + " · " + escapeHtml(p.price) + "</span></span></a>",
          { closeButton: false, offset: [0, -8] }
        );
        markers.push(marker);
        bounds.push([p.lat, p.lng]);
      });
      // Price labels of neighbouring homes would cover each other: stack them vertically instead.
      var declutter = function () {
        var placed = [];
        markers
          .map(function (mk) { return { mk: mk, pt: map.latLngToContainerPoint(mk.getLatLng()) }; })
          .sort(function (a, b) { return a.pt.y - b.pt.y || a.pt.x - b.pt.x; })
          .forEach(function (item) {
            var el = item.mk.getElement();
            var pin = el && el.querySelector(".map-pin");
            if (!pin) return;
            var w = pin.offsetWidth || 90;
            var h = pin.offsetHeight || 26;
            var y = item.pt.y;
            var moved = true;
            while (moved) {
              moved = false;
              for (var i = 0; i < placed.length; i++) {
                var o = placed[i];
                if (Math.abs(o.x - item.pt.x) < (o.w + w) / 2 + 4 && Math.abs(o.y - y) < (o.h + h) / 2 + 4) {
                  y = o.y + (o.h + h) / 2 + 4;
                  moved = true;
                }
              }
            }
            pin.style.setProperty("--dy", Math.round(y - item.pt.y) + "px");
            placed.push({ x: item.pt.x, y: y, w: w, h: h });
          });
      };
      map.on("zoomend moveend resize", declutter);
      if (bounds.length === 1) map.setView(bounds[0], 13);
      else if (bounds.length) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 13 });
      declutter();
      return map;
    }
  };

  var maps = new Map();
  function initMap(el) {
    if (maps.has(el) || !window.L) return;
    var kind = el.getAttribute("data-map");
    if (!mapInits[kind]) return;
    maps.set(el, mapInits[kind](el));
  }
  function initVisibleMaps() {
    $$("[data-map]").forEach(function (el) {
      if (el.offsetParent === null) return; // hidden panel: created when shown
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
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

  // Grid / map toggle on the residences index.
  var viewBtns = $$("[data-view-btn]");
  if (viewBtns.length) {
    var setView = function (view) {
      viewBtns.forEach(function (b) {
        var on = b.getAttribute("data-view-btn") === view;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      $$("[data-view-panel]").forEach(function (panel) { panel.hidden = panel.getAttribute("data-view-panel") !== view; });
      if (view === "map") {
        var el = $('[data-view-panel="map"] [data-map]');
        if (el) {
          initMap(el);
          var m = maps.get(el);
          if (m) m.invalidateSize();
        }
      }
    };
    viewBtns.forEach(function (b) { b.addEventListener("click", function () { setView(b.getAttribute("data-view-btn")); }); });
  }

  // ------------------------------------------------------------ financing calculator
  var calc = $("[data-calc]");
  if (calc) {
    var price = Number(calc.getAttribute("data-price"));
    var priceCurrency = calc.getAttribute("data-currency") || "USD";
    var down = $("[data-calc-down]", calc);
    var years = $("[data-calc-years]", calc);
    var rate = $("[data-calc-rate]", calc);
    var update = function () {
      var downPct = Math.min(90, Math.max(0, Number(down.value) || 0));
      var n = Math.max(1, Number(years.value) || 1) * 12;
      var r = Math.max(0, Number(String(rate.value).replace(",", ".")) || 0) / 100 / 12;
      var loan = price * (1 - downPct / 100);
      var monthly = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
      var shown = currency;
      var conv = function (v) { return convert(v, priceCurrency, shown); };
      var approx = shown !== priceCurrency ? "≈ " : "";
      $("[data-calc-down-out]", calc).textContent = downPct + "% · " + approx + formatMoney(conv(price * downPct / 100), shown);
      $("[data-calc-years-out]", calc).textContent = years.value + " " + (S.yearsUnit || "");
      $("[data-calc-monthly]", calc).textContent = approx + formatMoney(conv(monthly), shown);
      $("[data-calc-loan]", calc).textContent = approx + formatMoney(conv(loan), shown);
    };
    [down, years, rate].forEach(function (el) { el.addEventListener("input", update); });
    doc.addEventListener("lh:currency", update);
    update();
  }

  // ------------------------------------------------------------ sticky mobile CTA
  var mobileCta = $("[data-mobile-cta]");
  var inquiry = doc.getElementById("inquiry");
  if (mobileCta && inquiry && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      mobileCta.classList.toggle("is-hidden", entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe(inquiry);
  }

  // ------------------------------------------------------------ reveal on scroll
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var revealTargets = $$(".section-head, .card, .trio__item, .service-list__item, .service-rows__item, .steps__item, .tour-feature__copy, .tour-feature__media, .cta-band__inner, .consult > *");
    var revealIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); revealIo.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    revealTargets.forEach(function (el) {
      // Anything already on screen is shown at once.
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) return;
      el.setAttribute("data-reveal", "");
      revealIo.observe(el);
    });
  }
})();
