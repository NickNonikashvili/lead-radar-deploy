/**
 * Tour page wiring: reads the tour data embedded by the server, starts the
 * viewer and connects the interface to it. The interface is deliberately thin
 * (the picture is the page): where the visitor is, the way on, and a few tools
 * that fade away while they are just looking.
 *
 * A space is a photograph with depth or a generated 3D room the visitor walks
 * through (the stage carries data-mode="photo" | "world"); the hints, the help
 * and the walking pad follow the kind of space on screen.
 */

import { TourViewer } from "./viewer.js";

const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
const pad = (n) => (n < 10 ? "0" + n : String(n));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
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
  const dataEl = document.getElementById("tour-data");
  if (!stage || !dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const S = data.strings;
  const scenes = data.scenes;
  const canvas = $(".tour-canvas", stage);
  const ui = $("[data-ui]", stage);
  const loader = $("[data-loader]", stage);
  const errorBox = $("[data-error]", stage);
  const fade = $("[data-fade]", stage);
  const hint = $("[data-hint]", stage);
  const strip = $("[data-strip]", stage);
  const stripBtn = $("[data-strip-toggle]", stage);
  const thumbs = $$("[data-scene]", strip);
  const sceneName = $("[data-scene-name]", stage);
  const sceneCount = $("[data-scene-count]", stage);
  const generatedMark = $("[data-generated]", stage);
  const nextBtn = $("[data-next]", stage);
  const prevBtn = $("[data-prev]", stage);
  const nextName = $("[data-next-name]", stage);
  const autoBtn = $("[data-auto]", stage);
  const vrBtn = $("[data-vr]", stage);
  const fullBtn = $("[data-fullscreen]", stage);
  const helpBtn = $("[data-help]", stage);
  const helpPanel = $("[data-help-panel]", stage);
  const progress = $("[data-progress]", stage);
  const stick = $("[data-stick]", stage);
  const noteWorld = $("[data-note-world]", stage);
  if (noteWorld && scenes.some((s) => s.world)) noteWorld.hidden = false;

  stage.setAttribute("data-first", ""); // the designed loader is for the first space only

  if (!hasWebGL()) {
    loader.hidden = true;
    stage.setAttribute("data-state", "error");
    $("[data-error-text]", errorBox).textContent = S.noWebgl;
    $("[data-retry]", errorBox).hidden = true;
    errorBox.hidden = false;
    return;
  }

  // When the viewer is embedded in another page (data.embedded), that page owns the address bar.
  const useHash = !data.embedded;
  const sceneFromHash = () => {
    const m = useHash ? /scene=([\w-]+)/.exec(location.hash) : null;
    const i = m ? scenes.findIndex((s) => s.id === m[1]) : -1;
    return i >= 0 ? i : data.start > 0 && data.start < scenes.length ? data.start : 0;
  };
  // Page-level listeners are removed again by destroy().
  const page = new AbortController();
  const on = (target, type, handler, options) => target.addEventListener(type, handler, Object.assign({ signal: page.signal }, options));

  // ------------------------------------------------------------ hint, shown once for each kind of space
  let hintTimer = 0;
  let hintLeaving = 0;
  const hintShown = { photo: false, world: false };
  const dropHint = () => {
    if (hint.hidden || hint.classList.contains("is-leaving")) return;
    clearTimeout(hintTimer);
    hint.classList.add("is-leaving");
    hintLeaving = setTimeout(() => { hint.hidden = true; }, 650);
  };
  const showHint = (mode) => {
    if (hintShown[mode]) return;
    hintShown[mode] = true;
    clearTimeout(hintTimer);
    clearTimeout(hintLeaving);
    hint.classList.remove("is-leaving");
    hint.hidden = false;
    hintTimer = setTimeout(dropHint, 9000);
  };

  // ------------------------------------------------------------ how much of a generated room has arrived
  let progressTimer = 0;
  const endProgress = () => {
    clearTimeout(progressTimer);
    progressTimer = 0;
    progress.hidden = true;
    stage.removeAttribute("data-loading-share");
    stage.style.removeProperty("--p");
  };

  // ------------------------------------------------------------ the interface rests while the visitor looks
  let idleTimer = 0;
  const busy = () => !strip.hidden || !helpPanel.hidden || !hint.hidden || ui.matches(":hover") || (ui.contains(document.activeElement) && document.activeElement.matches(":focus-visible"));
  const wake = () => {
    stage.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (busy()) wake();
      else stage.classList.add("is-idle");
    }, 4500);
  };

  const viewer = new TourViewer(
    canvas,
    { base: data.base, scenes, detail: chooseDetail(), veil: $("[data-veil]", stage) },
    {
      onStatus(state, error) {
        stage.setAttribute("data-state", state);
        loader.hidden = state !== "loading";
        errorBox.hidden = state !== "error";
        endProgress();
        if (state === "ready") {
          const mode = viewer.mode === "world" ? "world" : "photo";
          stage.setAttribute("data-mode", mode);
          const first = stage.hasAttribute("data-first");
          stage.removeAttribute("data-first");
          // The first space explains itself; so does the first room that is walked, if it comes later.
          if (first || mode === "world") showHint(mode);
          wake();
        }
        if (state === "error") {
          $("[data-error-text]", errorBox).textContent = S.loadError;
          if (error) console.error(error);
        }
      },
      onProgress(share) {
        stage.style.setProperty("--p", share.toFixed(3));
        stage.setAttribute("data-loading-share", "");
        // Arriving from another space, the hairline appears only when the room takes a moment.
        if (!stage.hasAttribute("data-first") && progress.hidden && !progressTimer && share < 0.9) {
          progressTimer = setTimeout(() => { progress.hidden = false; }, 350);
        }
      },
      onScene(index, shown) {
        const n = scenes.length;
        const scene = scenes[index];
        const room = Boolean(shown && shown.isWorld);
        stage.setAttribute("data-mode", room ? "world" : "photo");
        sceneName.textContent = scene.label || "";
        sceneCount.textContent = pad(index + 1) + " / " + pad(n);
        generatedMark.hidden = !room; // a room built by a model is always marked as such
        const next = scenes[(index + 1) % n];
        const prev = scenes[(index - 1 + n) % n];
        nextName.textContent = next.label || pad(((index + 1) % n) + 1);
        nextBtn.setAttribute("aria-label", S.nextTo.replace("{name}", next.label || S.next));
        prevBtn.setAttribute("aria-label", S.prevTo.replace("{name}", prev.label || S.prev));
        prevBtn.title = prev.label || S.prev;
        thumbs.forEach((b, i) => {
          const current = i === index;
          b.classList.toggle("is-active", current);
          if (current) b.setAttribute("aria-current", "true");
          else b.removeAttribute("aria-current");
        });
        const active = thumbs[index];
        if (active && !strip.hidden) active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        if (useHash) history.replaceState(null, "", "#scene=" + scene.id);
      },
      onFade(out, ms) {
        fade.style.transitionDuration = ms + "ms";
        fade.classList.toggle("is-on", out);
        return new Promise((resolve) => setTimeout(resolve, ms));
      },
      onAuto(playing) {
        autoBtn.setAttribute("aria-pressed", String(playing));
        autoBtn.querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
        autoBtn.setAttribute("aria-label", playing ? S.pause : S.auto);
        autoBtn.title = playing ? S.pause : S.auto;
      },
      onXr(inside) {
        stage.classList.toggle("is-xr", inside);
      },
    }
  );
  window.luxhouseTour = viewer; // handy for debugging and used by the automated test
  window.luxhouseTourDestroy = () => {
    page.abort();
    clearTimeout(idleTimer);
    clearTimeout(hintTimer);
    clearTimeout(hintLeaving);
    clearTimeout(progressTimer);
    viewer.dispose();
    if (window.luxhouseTour === viewer) window.luxhouseTour = null;
  };

  // ------------------------------------------------------------ moving between spaces
  const go = (fn) => {
    viewer.stopAuto();
    dropHint();
    fn();
  };
  if (scenes.length < 2) $(".tour-pad", stage).hidden = true;
  nextBtn.addEventListener("click", () => go(() => viewer.next()));
  prevBtn.addEventListener("click", () => go(() => viewer.previous()));
  thumbs.forEach((b) => b.addEventListener("click", () => go(() => viewer.goTo(Number(b.getAttribute("data-scene"))))));
  $("[data-retry]", errorBox).addEventListener("click", () => viewer.goTo(Math.max(0, viewer.index), { force: true, instant: true }));

  const setStrip = (open) => {
    strip.hidden = !open;
    stripBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      dropHint();
      const active = thumbs[Math.max(0, viewer.index)];
      if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
    }
    wake();
  };
  stripBtn.addEventListener("click", () => setStrip(strip.hidden));

  // ------------------------------------------------------------ the walking pad (touch screens, generated rooms)
  if (stick) {
    stick.hidden = false; // the stylesheet shows it where it belongs
    const REACH = 34;
    let held = null;
    const steer = (e) => {
      const box = stick.getBoundingClientRect();
      let x = e.clientX - (box.left + box.width / 2);
      let y = e.clientY - (box.top + box.height / 2);
      const length = Math.hypot(x, y);
      if (length > REACH) {
        x *= REACH / length;
        y *= REACH / length;
      }
      stick.style.setProperty("--x", x.toFixed(1) + "px");
      stick.style.setProperty("--y", y.toFixed(1) + "px");
      viewer.setJoystick(x / REACH, -y / REACH);
    };
    const letGo = () => {
      held = null;
      stick.classList.remove("is-held");
      stick.style.setProperty("--x", "0px");
      stick.style.setProperty("--y", "0px");
      viewer.setJoystick(0, 0);
    };
    stick.addEventListener("pointerdown", (e) => {
      if (held !== null) return;
      held = e.pointerId;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointer already released */
      }
      stick.classList.add("is-held");
      dropHint();
      steer(e);
      e.preventDefault();
    });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === held) steer(e); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => stick.addEventListener(type, (e) => { if (e.pointerId === held) letGo(); }));
    on(window, "blur", () => { if (held !== null) letGo(); });
  }

  // ------------------------------------------------------------ tools
  if (viewer.reducedMotion) autoBtn.hidden = true;
  autoBtn.addEventListener("click", () => { dropHint(); viewer.toggleAuto(); });

  const setHelp = (open) => {
    helpPanel.hidden = !open;
    helpBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      viewer.stopAuto();
      dropHint();
      $("[data-help-close]", helpPanel).focus();
    } else if (helpPanel.contains(document.activeElement)) {
      helpBtn.focus();
    }
    wake();
  };
  helpBtn.addEventListener("click", () => setHelp(helpPanel.hidden));
  $("[data-help-close]", helpPanel).addEventListener("click", () => setHelp(false));

  // Fullscreen (not available on iPhone Safari: the button is hidden there)
  const fsEnabled = Boolean(stage.requestFullscreen && document.fullscreenEnabled);
  fullBtn.hidden = !fsEnabled;
  const toggleFullscreen = () => {
    if (!fsEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen().catch(() => {});
  };
  fullBtn.addEventListener("click", toggleFullscreen);
  on(document, "fullscreenchange", () => {
    const full = Boolean(document.fullscreenElement);
    fullBtn.setAttribute("aria-pressed", String(full));
    fullBtn.setAttribute("aria-label", full ? S.exitFullscreen : S.fullscreen);
    fullBtn.title = full ? S.exitFullscreen : S.fullscreen;
    viewer.resize();
  });

  // VR headset entry, only where the browser reports support
  TourViewer.vrSupported().then((ok) => {
    vrBtn.hidden = !ok;
    if (ok) vrBtn.addEventListener("click", () => viewer.enterVR().catch((err) => console.error(err)));
  });

  // ------------------------------------------------------------ keyboard (movement keys are handled by the viewer)
  on(window, "keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
    wake();
    if (e.key === "Escape") {
      if (!helpPanel.hidden) setHelp(false);
      else if (!strip.hidden) setStrip(false);
      return;
    }
    if (e.code === "BracketRight" || e.code === "PageDown") go(() => viewer.next());
    else if (e.code === "BracketLeft" || e.code === "PageUp") go(() => viewer.previous());
    else if (e.code === "KeyR") viewer.resetView(false);
    else if (e.code === "KeyH") setHelp(helpPanel.hidden);
    else if (e.code === "KeyF") toggleFullscreen();
    else if (TourViewer.MOVE_KEYS.has(e.code)) dropHint();
  });

  // The first real gesture on the picture puts the hint away; any movement brings the interface back.
  on(canvas, "pointerdown", () => { dropHint(); if (!strip.hidden && window.matchMedia("(max-width: 760px)").matches) setStrip(false); });
  on(canvas, "wheel", dropHint, { passive: true });
  ["pointermove", "pointerdown", "touchstart", "wheel", "focusin"].forEach((type) => on(stage, type, wake, { passive: true }));

  on(document, "visibilitychange", () => { if (document.hidden) viewer.stopAuto(); });
  if (useHash) on(window, "hashchange", () => viewer.goTo(sceneFromHash()));

  viewer.goTo(sceneFromHash(), { instant: true });
}

// A page that embeds the viewer can start it again after putting a new tour on the page.
window.luxhouseTourStart = start;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
