/* Million First Steps — interactions and scroll choreography.
   Everything works without JavaScript; this layer adds the motion and the conveniences. */
(function () {
  "use strict";
  window.__mfsReady = true;

  var html = document.documentElement;
  var cfg = window.MFS || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var motion = html.classList.contains("motion") && hasGsap;
  if (!motion) html.classList.remove("motion");

  /* ───────────────────────── Tier + currency ───────────────────────── */
  // Interface text; the build fills in cfg.t for each language.
  var T = cfg.t || {};
  var tr = function (key, fallback) { return T[key] || fallback; };
  var TIER_NAMES = { wanderer: tr("wanderer", "Wanderer"), explorer: tr("explorer", "Explorer"), "golden-fleece": tr("golden-fleece", "Golden Fleece") };

  function setTier(id, persist) {
    if (!TIER_NAMES[id]) return;
    html.dataset.tier = id;
    if (persist !== false) store.set("mfs-tier", id);
    $$("[data-set-tier]").forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.setTier === id)); });
    $$("[data-tier-radio]").forEach(function (r) { r.checked = r.dataset.tierRadio === id; });
    updateCalc();
  }

  function formatMoney(eur) {
    var code = html.dataset.currency || "EUR";
    var c = (cfg.currencies || {})[code] || { symbol: "€", rate: 1 };
    var v = eur * c.rate;
    v = code === "EUR" ? Math.round(v) : Math.round(v / 10) * 10;
    var n = v.toLocaleString("en-US");
    return code === "GEL" ? n + " " + c.symbol : c.symbol + n;
  }
  function renderPrices(root) {
    $$(".price[data-eur]", root).forEach(function (el) { el.textContent = formatMoney(+el.dataset.eur); });
  }
  function setCurrency(code) {
    if (!(cfg.currencies || {})[code]) return;
    html.dataset.currency = code;
    store.set("mfs-currency", code);
    /* ───────────────────────── Language ───────────────────────── */
  function goToLang(code) {
    store.set("mfs-lang", code);
    if (code === html.lang) return;
    var page = html.getAttribute("data-page") || "index.html";
    location.href = (html.getAttribute("data-site-root") || "") + (code === "en" ? "" : code + "/") + page + location.hash;
  }
  $$("select[data-lang-switch]").forEach(function (s) {
    s.value = html.lang;
    s.addEventListener("change", function () { goToLang(s.value); });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-set-lang]");
    if (a) store.set("mfs-lang", a.getAttribute("data-set-lang"));
  });

  $$("select[data-currency]").forEach(function (s) { s.value = code; });
    renderPrices();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-set-tier]");
    if (t) setTier(t.dataset.setTier);
  });
  // Arrow keys move between options in a tier radiogroup.
  document.addEventListener("keydown", function (e) {
    var t = e.target.closest("[data-set-tier]");
    if (!t || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    var group = $$("[data-set-tier]", t.parentElement);
    var i = group.indexOf(t) + (e.key === "ArrowRight" ? 1 : -1);
    var next = group[(i + group.length) % group.length];
    next.focus();
    setTier(next.dataset.setTier);
    e.preventDefault();
  });
  /* ───────────────────────── Language ───────────────────────── */
  function goToLang(code) {
    store.set("mfs-lang", code);
    if (code === html.lang) return;
    var page = html.getAttribute("data-page") || "index.html";
    location.href = (html.getAttribute("data-site-root") || "") + (code === "en" ? "" : code + "/") + page + location.hash;
  }
  $$("select[data-lang-switch]").forEach(function (s) {
    s.value = html.lang;
    s.addEventListener("change", function () { goToLang(s.value); });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-set-lang]");
    if (a) store.set("mfs-lang", a.getAttribute("data-set-lang"));
  });

  $$("select[data-currency]").forEach(function (s) {
    s.value = html.dataset.currency || "EUR";
    s.addEventListener("change", function () { setCurrency(s.value); });
  });

  /* ───────────────────────── Calculator (tour pages) ───────────────────────── */
  var calc = $("[data-calc]");
  var party = 2;
  function factor(n) {
    var f = cfg.partyFactors || {};
    var keys = Object.keys(f).map(Number).sort(function (a, b) { return a - b; });
    var k = keys.filter(function (x) { return x <= n; }).pop() || 2;
    return f[k] || 1;
  }
  function updateCalc() {
    if (!calc) return;
    var prices = JSON.parse(calc.dataset.prices);
    var tier = html.dataset.tier || "explorer";
    var pp = prices[tier] * factor(party);
    var ppEl = $("[data-calc-pp] .price", calc), totEl = $("[data-calc-total] .price", calc);
    ppEl.dataset.eur = Math.round(pp);
    totEl.dataset.eur = Math.round(pp * party);
    renderPrices(calc);
    $("[data-party-out]", calc).textContent = party;
    $("[data-calc-tier]", calc).textContent = TIER_NAMES[tier];
    $("[data-calc-link]", calc).href = "../contact.html?tour=" + calc.dataset.tour + "&tier=" + tier + "&party=" + party;
  }
  if (calc) {
    $$("[data-party]", calc).forEach(function (b) {
      b.addEventListener("click", function () {
        party = Math.max(1, Math.min(16, party + +b.dataset.party));
        updateCalc();
      });
    });
  }

  /* ───────────────────────── Header + menu ───────────────────────── */
  var header = $("[data-header]");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (!header) return;
    header.classList.toggle("is-solid", y > 60);
    var menuOpen = document.body.classList.contains("menu-open");
    header.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 2);
    if (y < lastY - 2) header.classList.remove("is-hidden");
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var menu = $("[data-menu]"), toggle = $("[data-menu-toggle]");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) menu.hidden = false;
    else setTimeout(function () { if (!document.body.classList.contains("menu-open")) menu.hidden = true; }, 800);
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  }
  if (menu && toggle) {
    toggle.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); toggle.focus(); } });
  }

  /* ───────────────────────── Tour filters ───────────────────────── */
  var filter = $("[data-filter]");
  if (filter) {
    filter.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-filter-value]");
      if (!chip) return;
      var v = chip.dataset.filterValue;
      $$(".chip", filter).forEach(function (c) { var on = c === chip; c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", String(on)); });
      var grid = $("[data-filter-grid]");
      grid.classList.toggle("is-filtered", v !== "all");
      $$(".tour-card", grid).forEach(function (card) {
        var show = v === "all" || card.dataset.styles.split(" ").indexOf(v) > -1;
        card.classList.toggle("is-hidden", !show);
        if (show && motion) gsap.fromTo(card, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
      });
      if (hasGsap) ScrollTrigger.refresh();
    });
  }

  /* ───────────────────────── Write your name in Georgian ───────────────────────── */
  var alpha = $("[data-alphabet]");
  if (alpha) {
    var MAP = [
      ["sh", "შ"], ["ch", "ჩ"], ["kh", "ხ"], ["zh", "ჟ"], ["gh", "ღ"], ["ts", "ც"], ["dz", "ძ"], ["th", "თ"], ["ph", "ფ"], ["ck", "ქ"], ["ee", "ი"], ["oo", "უ"], ["qu", "კვ"],
      ["a", "ა"], ["b", "ბ"], ["c", "ქ"], ["d", "დ"], ["e", "ე"], ["f", "ფ"], ["g", "გ"], ["h", "ჰ"], ["i", "ი"], ["j", "ჯ"], ["k", "ქ"], ["l", "ლ"], ["m", "მ"],
      ["n", "ნ"], ["o", "ო"], ["p", "პ"], ["q", "ქ"], ["r", "რ"], ["s", "ს"], ["t", "ტ"], ["u", "უ"], ["v", "ვ"], ["w", "ვ"], ["x", "ქს"], ["y", "ი"], ["z", "ზ"],
    ];
    var input = $("[data-alphabet-input]", alpha), out = $("[data-alphabet-out]", alpha);
    var cells = $$(".alphabet__grid li", alpha);
    input.addEventListener("input", function () {
      var s = input.value.toLowerCase().replace(/(.)\1+/g, "$1"), r = "", i = 0;
      while (i < s.length) {
        var ch = s[i];
        if (ch === "c" && /[eiy]/.test(s[i + 1] || "")) { r += "ს"; i++; continue; }
        var hit = null;
        for (var k = 0; k < MAP.length; k++) if (s.substr(i, MAP[k][0].length) === MAP[k][0]) { hit = MAP[k]; break; }
        if (hit) { r += hit[1]; i += hit[0].length; } else { r += /[\s\-']/.test(ch) ? ch : ""; i++; }
      }
      out.textContent = r || "მოგზაური";
      cells.forEach(function (c) { c.classList.toggle("is-lit", !!r && r.indexOf(c.firstElementChild.textContent) > -1); });
    });
  }

  /* ───────────────────────── Destinations map ↔ list ───────────────────────── */
  var REGION_OF = { Tbilisi: "tbilisi", "Mtskheta-Mtianeti": "kazbegi", "Samegrelo-Zemo Svaneti": "svaneti", Kakheti: "kakheti", "Samtskhe–Javakheti": "samtskhe", Imereti: "colchis", Adjara: "adjara", "Kvemo Kartli": "dmanisi" };
  $$(".gmap__regions path").forEach(function (p) {
    var id = REGION_OF[p.dataset.region];
    if (!id) return;
    var link = $('[data-region-link="' + id + '"]');
    p.style.cursor = "pointer";
    p.addEventListener("mouseenter", function () { link && link.classList.add("is-hot"); });
    p.addEventListener("mouseleave", function () { link && link.classList.remove("is-hot"); });
    p.addEventListener("click", function () { scrollToTarget("#" + id); });
    if (link) {
      link.addEventListener("mouseenter", function () { p.classList.add("is-hot"); });
      link.addEventListener("mouseleave", function () { p.classList.remove("is-hot"); });
    }
  });

  /* ───────────────────────── Booking request form ───────────────────────── */
  var form = $("[data-enquiry]");
  if (form) {
    var params = new URLSearchParams(location.search);
    if (params.get("tour")) form.tour.value = params.get("tour");
    if (params.get("tier")) setTier(params.get("tier"), false);
    if (params.get("party")) form.adults.value = params.get("party");
    $$("[data-tier-radio]", form).forEach(function (r) { r.checked = r.dataset.tierRadio === (html.dataset.tier || "explorer"); });

    var status = $("[data-form-status]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form__status";
      var bad = $$("[required]", form).filter(function (f) { return f.type === "checkbox" ? !f.checked : !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value)); });
      $$("[required]", form).forEach(function (f) { f.setAttribute("aria-invalid", String(bad.indexOf(f) > -1)); });
      if (bad.length) {
        status.textContent = tr("fill", "Please fill in the highlighted fields.");
        status.classList.add("is-err");
        bad[0].focus();
        return;
      }
      if (form.company.value) { status.textContent = tr("thanks", "Thank you!"); return; } // spam trap

      var data = new FormData(form);
      var tourSel = form.tour.options[form.tour.selectedIndex];
      if (cfg.formEndpoint) {
        status.textContent = tr("sending", "Sending…");
        fetch(cfg.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error(r.status);
            form.reset();
            status.textContent = tr("sent", "Gmadlobt — thank you! We'll reply within a day.");
            status.classList.add("is-ok");
          })
          .catch(function () {
            status.textContent = tr("failed", "Sorry, that didn't send. Please email us at") + " " + cfg.email + ".";
            status.classList.add("is-err");
          });
        return;
      }
      var lines = [
        "Journey: " + tourSel.text,
        "Travel style: " + data.get("tier"),
        "Arrival: " + (data.get("arrival") || "flexible"),
        "Adults: " + data.get("adults") + "   Children: " + data.get("children"),
        "",
        "Name: " + data.get("name"),
        "Email: " + data.get("email"),
        "Phone/WhatsApp: " + (data.get("phone") || "-"),
        "Country: " + (data.get("country") || "-"),
        "",
        data.get("message") || "",
      ];
      location.href = "mailto:" + cfg.email + "?subject=" + encodeURIComponent("Journey request: " + tourSel.text) + "&body=" + encodeURIComponent(lines.join("\n"));
      status.textContent = tr("mailto", "Your email app should open with everything filled in — just press send.");
      status.classList.add("is-ok");
    });
  }

  /* ───────────────────────── Smooth anchor scrolling ───────────────────────── */
  function scrollToTarget(hash) {
    var el = $(hash);
    if (!el) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -80, duration: 1.6 });
    else el.scrollIntoView({ behavior: motion ? "smooth" : "auto" });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("href").length < 2) return;
    e.preventDefault();
    scrollToTarget(a.getAttribute("href"));
    history.replaceState(null, "", a.getAttribute("href"));
  });

  setTier(html.dataset.tier || "explorer", false);
  setCurrency(html.dataset.currency || "EUR");

  /* ───────────────────────── Itinerary ↔ map (works without motion too) ───────────────────────── */
  var itin = $("[data-itinerary]");
  var routeSync = null;
  if (itin) {
    var map = $("[data-route-sync]", itin);
    var routePath = $(".gmap__route", map);
    var days = $$(".day", itin);
    var stops = $$(".gmap__stop", map);
    var nowDay = $("[data-now-day]", itin), nowPlace = $("[data-now-place]", itin);
    var current = -1;
    routeSync = function (i) {
      if (i === current) return;
      current = i;
      var d = days[i], at = +d.dataset.at;
      days.forEach(function (x, j) { x.classList.toggle("is-active", j === i); x.classList.toggle("is-past", j < i); });
      stops.forEach(function (s) {
        s.classList.toggle("is-reached", +s.dataset.at <= at + 0.0001);
        s.classList.toggle("is-active", s.dataset.stop === d.dataset.stop);
      });
      var label = $('.gmap__stop[data-stop="' + d.dataset.stop + '"] text', map);
      nowDay.textContent = tr("day", "Day") + " " + d.dataset.day;
      nowPlace.textContent = label ? label.textContent : "";
      if (routePath) {
        if (motion) gsap.to(routePath, { strokeDashoffset: 1 - Math.max(at, 0.002), duration: 1.1, ease: "power2.inOut" });
        else routePath.style.strokeDashoffset = 1 - at;
      }
    };
    if (routePath) { routePath.style.strokeDasharray = "1"; routePath.style.strokeDashoffset = "1"; }
    if (!motion) {
      routeSync(0);
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) routeSync(days.indexOf(en.target)); });
        }, { rootMargin: "-45% 0px -50% 0px" });
        days.forEach(function (d) { io.observe(d); });
      }
    }
  }

  if (!motion) {
    $$("[data-route-draw]:not([data-route-sync]) .gmap__stop").forEach(function (s) { s.classList.add("is-reached"); });
    return;
  }

  /* =====================================================================
     Motion
     ===================================================================== */
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  // Smooth scrolling, synced with ScrollTrigger.
  if (window.Lenis) {
    var lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var mm = gsap.matchMedia();

  /* ---- Intro overlay: five footprints, once per visit ---- */
  var heroEl = $("[data-hero]");
  var introDone = Promise.resolve();
  var seen = false;
  try { seen = sessionStorage.getItem("mfs-intro") === "1"; sessionStorage.setItem("mfs-intro", "1"); } catch (e) { seen = true; }
  if (heroEl && !seen) {
    var ov = document.createElement("div");
    ov.className = "intro";
    ov.setAttribute("aria-hidden", "true");
    var step = '<svg viewBox="0 0 20 32"><ellipse cx="10" cy="20" rx="6.5" ry="10"/><circle cx="6" cy="6" r="2.2"/><circle cx="10.5" cy="4.6" r="2.4"/><circle cx="14.6" cy="6.6" r="2"/></svg>';
    ov.innerHTML = '<div><div class="intro__steps">' + step + step + step + step + step + '</div><p class="intro__count">1,000,000</p></div>';
    document.body.appendChild(ov);
    if (window.__lenis) window.__lenis.stop();
    var count = $(".intro__count", ov);
    introDone = new Promise(function (resolve) {
      gsap.timeline({ onComplete: function () { ov.remove(); if (window.__lenis) window.__lenis.start(); resolve(); } })
        .to($$(".intro__steps svg", ov), { opacity: 1, duration: 0.25, stagger: 0.16, ease: "power1.out" })
        .add(function () { count.textContent = "1,000,001"; }, "-=0.1")
        .to(count, { color: "#e3b25a", duration: 0.2 }, "<")
        .to(ov, { yPercent: -100, duration: 1, ease: "expo.inOut" }, "+=0.35");
    });
  }

  /* ---- Home hero: dolly into the mountains, then step through the footprint ---- */
  if (heroEl) {
    var layers = $$(".scene__layer", heroEl);
    var sceneWrap = $(".scene--layered", heroEl);
    var titleBits = $$("[data-hero-title]", heroEl);
    var heroIn = $$("[data-hero-in]", heroEl);
    var reveal = $(".hero__reveal", heroEl);

    // Entrance (animates inner elements and the scene wrapper)…
    gsap.set(titleBits, { opacity: 0, yPercent: 60 });
    gsap.set(heroIn, { opacity: 0, y: 30 });
    gsap.set(sceneWrap, { scale: 1.12, transformOrigin: "40% 58%" });
    introDone.then(function () {
      gsap.to(sceneWrap, { scale: 1, duration: 2.8, ease: "expo.out" });
      gsap.to(titleBits, { opacity: 1, yPercent: 0, duration: 1.8, ease: "expo.out", stagger: 0.12, delay: 0.15 });
      gsap.to(heroIn, { opacity: 1, y: 0, duration: 1.4, ease: "expo.out", stagger: 0.1, delay: 0.7 });
    });

    // …while scrolling animates the layers and outer containers, so the two never collide.
    var tl = gsap.timeline({
      defaults: { ease: "none", immediateRender: false },
      scrollTrigger: { trigger: heroEl, start: "top top", end: "+=220%", pin: true, scrub: 0.8, anticipatePin: 1 },
    });
    layers.forEach(function (l) {
      var d = +l.dataset.depth;
      tl.fromTo(l, { scale: 1, yPercent: 0 }, { scale: 1 + d * 1.15, yPercent: d * 10, duration: 0.6 }, 0);
    });
    tl.fromTo(".hero__title", { yPercent: 0, scale: 1 }, { yPercent: 75, scale: 0.92, duration: 0.6 }, 0)
      .fromTo(".hero__ka, .hero__tag", { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0)
      .fromTo(".hero__content, .hero__scroll", { opacity: 1, y: 0 }, { opacity: 0, y: 60, duration: 0.18 }, 0)
      .fromTo(reveal, { "--ms": "0%" }, { "--ms": "1300%", duration: 0.5, ease: "power2.in" }, 0.42)
      .fromTo(".hero__reveal-inner", { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, 0.62);
  }

  /* ---- Deep time: pinned counter ---- */
  var dt = $("[data-deeptime]");
  if (dt) {
    dt.classList.add("is-enhanced");
    var dtSteps = $$(".dt-step", dt);
    var numEl = $("[data-dt-num]", dt), unitEl = $("[data-dt-unit]", dt);
    var ticks = $$(".deeptime__tick", dt), bar = $(".deeptime__bar", dt);
    var shown = -1, counter = { v: +dtSteps[0].dataset.value };
    var showStep = function (i) {
      if (i === shown) return;
      var prev = dtSteps[shown], next = dtSteps[i], down = i > shown;
      if (prev) gsap.to(prev, { autoAlpha: 0, y: down ? -40 : 40, duration: 0.5, ease: "power2.in", overwrite: true });
      gsap.fromTo(next, { autoAlpha: 0, y: down ? 50 : -50 }, { autoAlpha: 1, y: 0, duration: 0.9, delay: prev ? 0.25 : 0, ease: "expo.out", overwrite: true });
      gsap.to(counter, {
        v: +next.dataset.value,
        duration: 1.4,
        ease: "expo.out",
        overwrite: true,
        onUpdate: function () { numEl.textContent = Math.round(counter.v).toLocaleString("en-US"); },
      });
      gsap.fromTo(unitEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", onStart: function () { unitEl.textContent = next.dataset.unit; } });
      ticks.forEach(function (t, j) { t.classList.toggle("is-on", j <= i); });
      shown = i;
    };
    showStep(0);
    ScrollTrigger.create({
      trigger: dt,
      start: "top top",
      end: "+=" + dtSteps.length * 85 + "%",
      pin: true,
      scrub: true,
      onUpdate: function (self) {
        gsap.set(bar, { scaleX: self.progress });
        showStep(Math.min(dtSteps.length - 1, Math.floor(self.progress * dtSteps.length * 0.9999)));
      },
    });
    gsap.fromTo(".deeptime__sky", { yPercent: 0 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: dt, start: "top top", end: "+=" + dtSteps.length * 85 + "%", scrub: true } });
  }

  /* ---- Worlds: horizontal journey on wide screens ---- */
  var worlds = $("[data-worlds]");
  if (worlds) {
    mm.add("(min-width: 900px)", function () {
      worlds.classList.add("is-enhanced");
      var track = $("[data-worlds-track]", worlds);
      var wbar = $("[data-worlds-bar]", worlds);
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: "none",
        scrollTrigger: {
          trigger: worlds,
          start: "top top",
          end: function () { return "+=" + dist(); },
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: function (s) { gsap.set(wbar, { scaleX: s.progress }); },
        },
      });
      $$(".world", track).forEach(function (w) {
        var img = $("img", w);
        if (img) gsap.fromTo(img, { xPercent: 7 }, { xPercent: -7, ease: "none", scrollTrigger: { trigger: w, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
        gsap.from($(".world__text", w), { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: w, containerAnimation: tween, start: "left 85%" } });
      });
      return function () { worlds.classList.remove("is-enhanced"); gsap.set(track, { clearProps: "transform" }); };
    });
  }

  /* ---- Wine: the qvevri fills as 8,000 years pass ---- */
  var wine = $("[data-wine]");
  if (wine) {
    var yearEl = $("[data-wine-year]", wine), yr = { v: -6000 };
    var thisYear = new Date().getFullYear();
    var wineTrigger = { trigger: wine, start: "top 65%", end: "bottom 75%", scrub: 0.6 };
    gsap.fromTo("[data-qvevri-wine]", { y: 420 }, { y: 36, ease: "none", scrollTrigger: wineTrigger });
    gsap.to(yr, {
      v: thisYear,
      ease: "none",
      scrollTrigger: wineTrigger,
      onUpdate: function () { var v = Math.round(yr.v); yearEl.textContent = v < 0 ? -v + " BC" : v === 0 ? "1 AD" : "AD " + v; },
    });
    $$("[data-qvevri-bubbles] circle", wine).forEach(function (c, i) {
      gsap.to(c, { attr: { cy: "-=" + (90 + i * 7) }, opacity: 0, duration: 3 + (i % 4), repeat: -1, delay: i * 0.3, ease: "sine.in" });
    });
  }

  /* ---- Map route draws itself (home) ---- */
  $$("[data-route-draw]:not([data-route-sync])").forEach(function (wrap) {
    var path = $(".gmap__route", wrap);
    var stopsEls = $$(".gmap__stop[data-at]", wrap);
    if (!path) return;
    gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(path, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: wrap,
        start: "top 75%",
        end: "bottom 35%",
        scrub: 0.8,
        onUpdate: function (s) { stopsEls.forEach(function (st) { st.classList.toggle("is-reached", +st.dataset.at <= s.progress); }); },
      },
    });
    gsap.from($$(".gmap__stop:not([data-at])", wrap), { opacity: 0, scale: 0.4, transformOrigin: "center", stagger: 0.04, duration: 0.8, ease: "back.out(2)", scrollTrigger: { trigger: wrap, start: "top 70%" } });
  });

  /* ---- Itinerary days drive the map ---- */
  if (itin && routeSync) {
    var dayEls = $$(".day", itin);
    routeSync(0);
    dayEls.forEach(function (d, i) {
      ScrollTrigger.create({
        trigger: d,
        start: "top 60%",
        end: "bottom 60%",
        onToggle: function (self) { if (self.isActive) routeSync(i); },
      });
    });
  }

  /* ---- Inner page heroes: layers drift apart ---- */
  $$("[data-page-hero]").forEach(function (hero) {
    var groups = $$(".scene > g[data-depth]", hero);
    var photo = $(".page-hero__photo", hero);
    gsap.from($(".scene, .page-hero__photo", hero), { scale: 1.12, duration: 2.4, ease: "expo.out" });
    if (photo) gsap.to(photo, { yPercent: 12, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    groups.forEach(function (g) {
      var d = +g.dataset.depth;
      gsap.to(g, { y: d * 320, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    });
    gsap.to($(".page-hero__content", hero), { y: -80, opacity: 0.2, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
  });

  /* ---- History timeline ---- */
  var tlEl = $("[data-timeline]");
  if (tlEl) {
    gsap.to("[data-timeline-fill]", { scaleY: 1, ease: "none", scrollTrigger: { trigger: tlEl, start: "top 60%", end: "bottom 60%", scrub: true } });
    $$("[data-era]", tlEl).forEach(function (era) {
      ScrollTrigger.create({ trigger: era, start: "top 60%", end: "bottom 60%", toggleClass: "is-active" });
      var medal = $(".era__medal", era);
      if (medal) gsap.fromTo(medal, { rotate: -12, scale: 0.85 }, { rotate: 0, scale: 1, ease: "none", scrollTrigger: { trigger: era, start: "top bottom", end: "center center", scrub: true } });
    });
  }

  /* ---- Clip-path reveals (destinations) ---- */
  $$("[data-clip-reveal]").forEach(function (el) {
    var img = $("img", el);
    var trig = { trigger: el, start: "top 90%", end: "top 30%", scrub: 0.6 };
    gsap.to(el, { clipPath: "inset(0% 0% 0% 0% round 28px)", ease: "none", scrollTrigger: trig });
    if (img) gsap.to(img, { scale: 1, ease: "none", scrollTrigger: trig });
  });

  /* ---- Footprint trails walk across the page ---- */
  $$(".trail").forEach(function (trail) {
    gsap.from($$(".trail__step", trail), { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.18, ease: "power2.out", scrollTrigger: { trigger: trail, start: "top 95%" } });
  });

  // Generic effects are created last so their positions account for the pinned sections above them.
  /* ---- Generic reveals ---- */
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 90%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.09, overwrite: true });
    },
  });

  /* ---- Split headings ---- */
  if (window.SplitText) {
    $$("[data-split]").forEach(function (el) {
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit: function (self) {
          el.classList.add("is-split");
          return gsap.from(self.lines, {
            yPercent: 115,
            duration: 1.3,
            ease: "expo.out",
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        },
      });
    });
  } else {
    $$("[data-split]").forEach(function (el) { el.classList.add("is-split"); });
  }

  /* ---- Words light up as you read ---- */
  $$("[data-scrub-words]").forEach(function (el) {
    gsap.to($$(".w", el), {
      opacity: 1,
      stagger: 0.12,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: true },
    });
  });

  /* ---- Count-ups ---- */
  $$("[data-count]").forEach(function (el) {
    var end = +el.dataset.count, o = { v: 0 };
    gsap.to(o, {
      v: end,
      duration: 2,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString("en-US"); },
    });
  });

  // Fonts change line lengths; measure again once they are in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
