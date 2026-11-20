/* LUXHOUSE — residences (the catalogue).
   Progressive: without this file the filters reload the page (site.js) and everything works.
   With it, a filter or a sort order is applied in place, the view the visitor chose (list, grid
   or map) stays put, and in the map view an index row and its price pin answer each other. */
(() => {
  "use strict";

  const doc = document;
  const form = doc.querySelector("[data-filters]");
  const results = doc.querySelector("[data-results]");
  const countEl = doc.querySelector("[data-results-count]");
  const switchEl = doc.querySelector("[data-view-switch]");
  if (!form || !results || !countEl || !switchEl) return;

  const LH = window.LH || {};
  const viewBtns = Array.from(switchEl.querySelectorAll("[data-view-btn]"));
  const resetLink = doc.querySelector(".results__bar [data-filters-reset]");
  const controls = () => Array.from(form.querySelectorAll("select, input[type='checkbox']"));

  // ------------------------------------------------------------ views
  // Until the visitor picks one, the page decides (a list for a few homes, the grid for many).
  const VIEW_KEY = "lh-view";
  const memory = {
    get() { try { return sessionStorage.getItem(VIEW_KEY); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(VIEW_KEY, v); } catch (e) { /* private mode */ } }
  };
  const button = (view) => viewBtns.find((b) => b.getAttribute("data-view-btn") === view);
  const currentView = () => {
    const on = viewBtns.find((b) => b.getAttribute("aria-pressed") === "true");
    return on ? on.getAttribute("data-view-btn") : "";
  };
  let chosen = null;
  let byScript = false;
  // site.js owns the switching (panels, pressed states, creating the map): press its button.
  const show = (view) => {
    const btn = button(view);
    if (!btn) return;
    byScript = true;
    btn.click();
    byScript = false;
  };
  viewBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (byScript) return;
      chosen = b.getAttribute("data-view-btn");
      memory.set(chosen);
    });
  });
  const remembered = memory.get();
  if (remembered && button(remembered)) {
    chosen = remembered;
    if (!switchEl.hidden && remembered !== currentView()) show(remembered);
  }

  // Leaflet maps made on this page, by container: a map is taken down before its panel is replaced.
  const mapsByEl = new WeakMap();
  if (window.L && window.L.Map && window.L.Map.addInitHook) {
    window.L.Map.addInitHook(function () { mapsByEl.set(this.getContainer(), this); });
  }

  // ------------------------------------------------------------ filters, applied in place
  const canSwap = "fetch" in window && "DOMParser" in window && "pushState" in history && "replaceChildren" in results;
  const pageUrl = () => location.pathname + location.search;
  let shown = pageUrl();
  let seq = 0;
  let pending = null;

  const markSet = () => {
    controls().forEach((el) => {
      if (el.tagName !== "SELECT") return;
      const cell = el.closest(".refine__cell");
      if (cell) cell.classList.toggle("is-set", el.name === "sort" ? el.value !== "newest" : el.value !== "");
    });
  };

  // Empty parameters and the default order are left out, so shared links stay short.
  const targetUrl = () => {
    const params = new URLSearchParams();
    controls().forEach((el) => {
      if (el.type === "checkbox") { if (el.checked) params.set(el.name, el.value); return; }
      if (el.value && !(el.name === "sort" && el.value === "newest")) params.set(el.name, el.value);
    });
    const qs = params.toString();
    return new URL(form.getAttribute("action"), location.href).pathname + (qs ? "?" + qs : "");
  };

  const readUrl = () => {
    const params = new URLSearchParams(location.search);
    controls().forEach((el) => {
      if (el.type === "checkbox") { el.checked = params.get(el.name) === el.value; return; }
      el.value = params.get(el.name) || (el.name === "sort" ? "newest" : "");
      if (el.selectedIndex < 0) el.selectedIndex = 0;
    });
  };

  function load(url, push) {
    const id = ++seq;
    if (pending) pending.abort();
    pending = "AbortController" in window ? new AbortController() : null;
    results.setAttribute("aria-busy", "true");
    fetch(url, { headers: { Accept: "text/html" }, credentials: "same-origin", signal: pending ? pending.signal : undefined })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.text(); })
      .then((html) => {
        if (id !== seq) return;
        const next = new DOMParser().parseFromString(html, "text/html");
        const nextResults = next.querySelector("[data-results]");
        const nextCount = next.querySelector("[data-results-count]");
        const nextSwitch = next.querySelector("[data-view-switch]");
        if (!nextResults || !nextCount) throw new Error("unexpected page");

        results.querySelectorAll("[data-map]").forEach((el) => {
          const map = mapsByEl.get(el);
          if (map) { try { map.remove(); } catch (e) { /* already gone */ } }
        });
        const fallbackView = nextResults.getAttribute("data-view") || "list";
        results.replaceChildren(...Array.from(nextResults.childNodes));
        results.setAttribute("data-view", fallbackView);
        countEl.textContent = nextCount.textContent;
        switchEl.hidden = nextSwitch ? nextSwitch.hidden : false;
        if (resetLink) {
          const nextReset = next.querySelector(".results__bar [data-filters-reset]");
          resetLink.hidden = nextReset ? nextReset.hidden : true;
        }
        if (LH.refresh) LH.refresh(results);
        if (!switchEl.hidden) show(chosen || fallbackView);
        markSet();
        if (push) history.pushState({ residences: true }, "", url);
        shown = pageUrl();
        results.removeAttribute("aria-busy");
      })
      .catch((err) => {
        if (err && err.name === "AbortError") return;
        location.assign(url); // the plain way always works
      });
  }

  if (canSwap) {
    // Ahead of site.js, which would submit the form and reload the page.
    doc.addEventListener("change", (e) => {
      if (!form.contains(e.target)) return;
      e.stopPropagation();
      markSet();
      load(targetUrl(), true);
    }, true);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      load(targetUrl(), true);
    });

    doc.addEventListener("click", (e) => {
      const link = e.target.closest("[data-filters-reset]");
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // Back to the whole collection in its default order, exactly where the link itself leads.
      controls().forEach((el) => {
        if (el.type === "checkbox") el.checked = false;
        else el.value = el.name === "sort" ? "newest" : "";
      });
      markSet();
      load(targetUrl(), true);
      const first = form.querySelector("select");
      if (link.closest("[data-results]") && first) first.focus({ preventScroll: true });
    });

    window.addEventListener("popstate", () => {
      if (pageUrl() === shown) return; // a hash change
      readUrl();
      markSet();
      load(pageUrl(), false);
    });
  }

  // ------------------------------------------------------------ map view: row and pin answer each other
  const titled = (selector, attr, title) => Array.from(results.querySelectorAll(selector)).find((el) => el.getAttribute(attr) === title);
  let hotTitle = null;
  const setHot = (title) => {
    if (title === hotTitle) return;
    results.querySelectorAll(".is-hot").forEach((el) => el.classList.remove("is-hot"));
    hotTitle = title;
    if (!title) return;
    const row = titled("[data-pin]", "data-pin", title);
    const pin = titled(".leaflet-marker-icon", "title", title);
    if (row) row.classList.add("is-hot");
    if (pin) pin.classList.add("is-hot");
  };
  const titleAt = (target) => {
    if (!target || !target.closest) return null;
    const row = target.closest("[data-pin]");
    if (row) return row.getAttribute("data-pin");
    const pin = target.closest(".leaflet-marker-icon");
    return pin ? pin.getAttribute("title") : null;
  };
  results.addEventListener("mouseover", (e) => setHot(titleAt(e.target)));
  results.addEventListener("mouseleave", () => setHot(null));
  results.addEventListener("focusin", (e) => setHot(titleAt(e.target)));
  results.addEventListener("focusout", (e) => { if (!results.contains(e.relatedTarget)) setHot(null); });
})();
