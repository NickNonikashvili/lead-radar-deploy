/**
 * Tour page wiring: reads the tour data embedded by the server, starts the
 * viewer and connects the on-screen controls to it.
 */

import { TourViewer } from "./viewer.js";

const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

function chooseDetail() {
  const param = new URLSearchParams(location.search).get("detail");
  if (param === "high" || param === "low") return param;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const phone = Math.max(screen.width, screen.height) < 1000;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return (coarse && phone) || lowMemory ? "low" : "high";
}

function start() {
  const stage = $("[data-tour]");
  const data = JSON.parse(document.getElementById("tour-data").textContent);
  const S = data.strings;
  const canvas = $(".tour-canvas", stage);
  const loader = $("[data-loader]", stage);
  const errorBox = $("[data-error]", stage);
  const intro = $("[data-intro]", stage);
  const fade = $("[data-fade]", stage);
  const edgeHint = $("[data-edge-hint]", stage);
  const strip = $("[data-strip]", stage);
  const thumbs = $$("[data-scene]", strip);
  const sceneName = $("[data-scene-name]", stage);
  const sceneCount = $("[data-scene-count]", stage);
  const autoBtn = $("[data-auto]", stage);
  const vrBtn = $("[data-vr]", stage);
  const fullBtn = $("[data-fullscreen]", stage);
  const joystick = $("[data-joystick]", stage);
  const touch = window.matchMedia("(pointer: coarse)").matches;

  stage.classList.toggle("is-touch", touch);

  if (!hasWebGL()) {
    loader.hidden = true;
    intro.hidden = true;
    $("[data-error-text]", errorBox).textContent = S.noWebgl;
    $("[data-retry]", errorBox).hidden = true;
    errorBox.hidden = false;
    return;
  }

  // When the viewer is embedded in another page (data.embedded), that page owns the address bar.
  const useHash = !data.embedded;
  const sceneFromHash = () => {
    const m = useHash ? /scene=([\w-]+)/.exec(location.hash) : null;
    const i = m ? data.scenes.findIndex((s) => s.id === m[1]) : -1;
    return i < 0 ? 0 : i;
  };
  // Page-level listeners are removed again by destroy().
  const page = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal: page.signal });

  let edgeTimer = 0;
  const viewer = new TourViewer(
    canvas,
    { base: data.base, scenes: data.scenes, detail: chooseDetail(), veil: $("[data-veil]", stage) },
    {
      onStatus(state, error) {
        loader.hidden = state !== "loading";
        errorBox.hidden = state !== "error";
        stage.setAttribute("data-state", state);
        if (state === "error") {
          $("[data-error-text]", errorBox).textContent = S.loadError;
          if (error) console.error(error);
        }
      },
      onScene(index) {
        const scene = data.scenes[index];
        sceneName.textContent = scene.label || "";
        sceneCount.textContent = index + 1 + " / " + data.scenes.length;
        thumbs.forEach((b, i) => {
          const on = i === index;
          b.classList.toggle("is-active", on);
          if (on) b.setAttribute("aria-current", "true");
          else b.removeAttribute("aria-current");
        });
        const active = thumbs[index];
        if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        if (useHash) history.replaceState(null, "", "#scene=" + scene.id);
      },
      onFade(out, ms) {
        fade.style.transitionDuration = ms + "ms";
        fade.classList.toggle("is-on", out);
        return new Promise((resolve) => setTimeout(resolve, ms));
      },
      onEdge() {
        edgeHint.hidden = false;
        edgeHint.classList.add("is-on");
        clearTimeout(edgeTimer);
        edgeTimer = setTimeout(() => {
          edgeHint.classList.remove("is-on");
        }, 1400);
      },
      onAuto(on) {
        autoBtn.setAttribute("aria-pressed", String(on));
        autoBtn.querySelector("use").setAttribute("href", on ? "#i-pause" : "#i-play");
        autoBtn.setAttribute("aria-label", on ? S.pause : S.auto);
        autoBtn.title = on ? S.pause : S.auto;
      },
      onXr(on) {
        stage.classList.toggle("is-xr", on);
      },
    }
  );
  window.luxhouseTour = viewer; // handy for debugging and used by the automated test
  window.luxhouseTourDestroy = () => {
    page.abort();
    viewer.dispose();
    if (window.luxhouseTour === viewer) window.luxhouseTour = null;
  };

  // ------------------------------------------------------------ controls
  $("[data-prev]", stage).addEventListener("click", () => { viewer.stopAuto(); viewer.previous(); });
  $("[data-next]", stage).addEventListener("click", () => { viewer.stopAuto(); viewer.next(); });
  thumbs.forEach((b) => b.addEventListener("click", () => { viewer.stopAuto(); viewer.goTo(Number(b.getAttribute("data-scene"))); }));
  $("[data-reset]", stage).addEventListener("click", () => { viewer.stopAuto(); viewer.resetView(false); });
  $("[data-retry]", errorBox).addEventListener("click", () => viewer.goTo(Math.max(0, viewer.index), { force: true, instant: true }));

  if (viewer.reducedMotion) autoBtn.hidden = true;
  autoBtn.addEventListener("click", () => viewer.toggleAuto());

  // Intro / help card
  const openIntro = () => { viewer.stopAuto(); intro.hidden = false; $("[data-start]", intro).focus(); };
  const closeIntro = () => { intro.hidden = true; canvas.focus({ preventScroll: true }); };
  $("[data-start]", intro).addEventListener("click", closeIntro);
  $("[data-help]", stage).addEventListener("click", openIntro);
  intro.addEventListener("click", (e) => { if (e.target === intro) closeIntro(); });

  // Fullscreen (not available on iPhone Safari: the button is hidden there)
  const fsTarget = stage;
  const fsEnabled = Boolean(fsTarget.requestFullscreen && document.fullscreenEnabled);
  fullBtn.hidden = !fsEnabled;
  fullBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else fsTarget.requestFullscreen().catch(() => {});
  });
  on(document, "fullscreenchange", () => {
    const on = Boolean(document.fullscreenElement);
    fullBtn.setAttribute("aria-pressed", String(on));
    fullBtn.setAttribute("aria-label", on ? S.exitFullscreen : S.fullscreen);
    fullBtn.title = on ? S.exitFullscreen : S.fullscreen;
    viewer.resize();
  });

  // VR headset entry, only where the browser reports support
  TourViewer.vrSupported().then((ok) => {
    vrBtn.hidden = !ok;
    if (ok) vrBtn.addEventListener("click", () => viewer.enterVR().catch((err) => console.error(err)));
  });

  // Keyboard shortcuts (movement keys are handled by the viewer)
  on(window, "keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" && !intro.hidden) closeIntro();
    else if (!intro.hidden) return;
    else if (e.code === "BracketRight" || e.code === "PageDown") viewer.next();
    else if (e.code === "BracketLeft" || e.code === "PageUp") viewer.previous();
    else if (e.code === "KeyR") viewer.resetView(false);
    else if (e.code === "KeyH") openIntro();
  });

  // Touch joystick
  if (touch) {
    joystick.hidden = false;
    const knob = $(".tour-joystick__knob", joystick);
    let active = null;
    const update = (e) => {
      const rect = joystick.getBoundingClientRect();
      const radius = rect.width / 2;
      let x = (e.clientX - (rect.left + radius)) / radius;
      let y = (e.clientY - (rect.top + radius)) / radius;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      knob.style.transform = "translate(" + x * radius * 0.6 + "px," + y * radius * 0.6 + "px)";
      viewer.setJoystick(x, -y);
    };
    const end = (e) => {
      if (active !== e.pointerId) return;
      active = null;
      knob.style.transform = "";
      viewer.setJoystick(0, 0);
    };
    joystick.addEventListener("pointerdown", (e) => {
      active = e.pointerId;
      try { joystick.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
      update(e);
      e.preventDefault();
    });
    joystick.addEventListener("pointermove", (e) => { if (active === e.pointerId) update(e); });
    joystick.addEventListener("pointerup", end);
    joystick.addEventListener("pointercancel", end);
  }

  on(document, "visibilitychange", () => { if (document.hidden) viewer.stopAuto(); });
  if (useHash) on(window, "hashchange", () => viewer.goTo(sceneFromHash()));

  viewer.goTo(sceneFromHash(), { instant: true });
}

// A page that embeds the viewer can start it again after putting a new tour on the page.
window.luxhouseTourStart = start;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else if (document.getElementById("tour-data")) start();
