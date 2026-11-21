/**
 * The tour viewer: renderer, first-person camera, movement, scene switching,
 * the automatic tour and the WebXR (VR headset) session.
 *
 * A space is one of two things:
 *  - a photograph with depth (scene.js): the visitor stands where it was taken, looks around
 *    inside the picture, leans and steps a little, within the range where it still looks real;
 *  - a generated 3D room (world.js, loaded on demand): the visitor walks through it freely,
 *    like a person, around the furniture, stopped by walls.
 * A room that cannot be shown (no WebGL2, a file missing) falls back to its photograph.
 */

import {
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { TourScene } from "./scene.js";

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Walking through a generated room (metres per second).
const WALK = 1.4;
const RUN = 2.6;
const STROLL = 1.7; // on the way to a clicked spot
const MAX_PITCH = 80 * DEG;
const RISE = 1.2; // metres walked while the view moves from the photograph's camera to the visitor's own eyes

/**
 * Generated rooms are drawn with the help of background workers running WebAssembly. Some
 * pages forbid one or the other; asked once, this resolves to null where rooms can run, or to
 * the reason they cannot (their photographs are shown instead).
 */
let roomsProbe = null;
function whyNoRooms() {
  if (roomsProbe) return roomsProbe;
  roomsProbe = new Promise((resolve) => {
    let worker = null;
    let url = null;
    let timer = 0;
    const done = (why) => {
      clearTimeout(timer);
      if (worker) worker.terminate();
      if (url) URL.revokeObjectURL(url);
      resolve(why);
    };
    try {
      if (typeof Worker === "undefined" || typeof WebAssembly === "undefined" || typeof Blob === "undefined") return done("Workers or WebAssembly are not available");
      timer = setTimeout(() => done("Workers do not start on this page"), 10000);
      // The smallest valid WebAssembly module, compiled inside a worker made the way the splat renderer makes its own.
      const code = "WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])).then(function(){postMessage(1)},function(){postMessage(0)})";
      url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      worker = new Worker(url);
      worker.onmessage = (e) => done(e.data === 1 ? null : "WebAssembly is blocked on this page");
      worker.onerror = () => done("Workers are blocked on this page");
    } catch (err) {
      done("Workers are blocked on this page");
    }
    return undefined;
  });
  return roomsProbe;
}

export class TourViewer {
  /**
   * @param canvas   <canvas> to draw into
   * @param tour     { base, scenes: [...], detail, veil } as embedded by the server; `veil` is an
   *                 optional 2D <canvas> laid over the picture, used to travel between spaces
   * @param hooks    { onScene(index, scene), onStatus(state, error), onFade(out, ms), onAuto(on), onXr(on) }
   */
  constructor(canvas, tour, hooks) {
    this.canvas = canvas;
    this.tour = tour;
    this.hooks = hooks || {};
    this.detail = tour.detail || "high";
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Generated rooms are drawn as splats, which gain nothing from multisampling and lose speed to it.
    const hasRooms = tour.scenes.some((s) => s.world);
    this.renderer = new WebGLRenderer({ canvas, antialias: !hasRooms, alpha: false, powerPreference: "high-performance" });
    this.photoRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.roomRatio = Math.min(window.devicePixelRatio || 1, this.detail === "low" ? 1.25 : 1.5);
    this.renderer.setPixelRatio(this.photoRatio);
    this.renderer.setClearColor(0x0b0c0d, 1);
    this.renderer.xr.enabled = true;

    this.world = new Scene();
    this.rig = new Group();
    this.camera = new PerspectiveCamera(48, 1, 0.05, 500);
    this.camera.rotation.order = "YXZ";
    this.rig.add(this.camera);
    this.world.add(this.rig);

    this.scene = null;
    this.index = -1;
    this.loadToken = 0;
    // Generated rooms: the code for them (loaded when first needed), the splat renderer they
    // share, and why a room fell back to its photograph, if one did.
    this.mode = "photo";
    this.roomCode = null;
    this.spark = null;
    this.roomsOff = false;
    this.worldError = null;
    this.velocity = new Vector2(); // walking speed in a room, world x and z
    this.route = null; // the way to a clicked spot
    // A room opens exactly where its photograph was taken; `lead` is what is left of the way
    // from the visitor's own eyes to that camera, and shrinks to nothing over the first steps.
    this.lead = new Vector3();
    this.walked = 0;
    this.floorY = 0;
    this.fast = false;
    this.slowFrames = 0;
    this.veil = tour.veil || null;
    this.veilAnim = null;

    // The pointer's footprint on the room: a ring that lies on whatever surface is under it.
    const ringMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: DoubleSide });
    const discMaterial = ringMaterial.clone();
    this.cursor = new Group();
    this.cursor.add(new Mesh(new RingGeometry(0.8, 1, 64), ringMaterial), new Mesh(new CircleGeometry(0.8, 48), discMaterial));
    this.cursor.children.forEach((m) => {
      m.renderOrder = 10;
      m.frustumCulled = false;
    });
    this.cursor.visible = false;
    this.cursorOn = 0;
    this.cursorSeen = false;
    this.pulse = null;
    this.world.add(this.cursor);

    // Where the visitor stands (world space, eye level) and looks; yaw grows to the left.
    this.pos = new Vector3();
    // Where the eyes actually are: `pos` plus the small lean that follows the pointer.
    this.eye = new Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    this.keys = new Set();
    this.joystick = new Vector2();
    this.hover = new Vector2();
    this.hoverActive = false;
    this.wheelImpulse = 0;
    // Zoom: 1 is the widest view of a space; scrolling on past the last step zooms in.
    this.zoom = 1;
    this.targetZoom = 1;
    this.baseFov = 48 * DEG;
    this.glide = null;
    this.auto = null;
    this.arrive = null;
    this.dirty = true;
    this.frames = 0;
    this.xrYaw = 0;
    this.xrSnapReady = true;

    this._delta = new Vector3();
    this._next = new Vector3();
    this._dir = new Vector3();
    this._hit = new Vector3();
    this._head = new Vector3();
    this._lean = new Vector3();
    this._normal = new Vector3();
    this._point = new Vector3();
    this._quat = new Quaternion();
    this._axis = new Vector3(0, 0, 1);
    this.pressing = 0;
    this.pushTime = 0;
    this.pushLock = false;
    this._last = performance.now();

    this._bindInput();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this._status("error", new Error("Graphics context lost"));
    });
    canvas.addEventListener("webglcontextrestored", () => this.goTo(Math.max(0, this.index), { instant: true, force: true }));

    this.renderer.setAnimationLoop((time, frame) => this._frame(time, frame));
    this.resize();
  }

  // ---------------------------------------------------------------- scenes

  get count() {
    return this.tour.scenes.length;
  }

  /** Switch to scene `index`. Resolves when it is on screen. */
  async goTo(index, options) {
    const opts = options || {};
    const n = this.count;
    const target = ((index % n) + n) % n;
    if (target === this.index && this.scene && this.scene.ready && !opts.force) return;
    const token = ++this.loadToken;
    this.glide = null;
    this._status("loading");

    const leaving = !opts.instant && this.scene && this.scene.ready;
    // Which way the visitor travels: on to the next space, or back to the one before.
    const forwardTrip = opts.direction ? opts.direction > 0 : target === (this.index + 1) % n || target > this.index;
    this.cursorOn = 0;
    this.cursor.visible = false;
    // Travelling: the picture freezes on a layer above the scene, drifts the way the visitor
    // is going and dissolves into the next space. Without that layer, a plain fade.
    const veiled = leaving && !this.reducedMotion && this._freeze(forwardTrip);
    this.route = null;
    this.velocity.set(0, 0);
    let next = null;
    try {
      [next] = await Promise.all([this._open(this.tour.scenes[target], token), leaving && !veiled ? this._fade(true) : null]);
    } catch (err) {
      this._thaw(0);
      if (token === this.loadToken) {
        this._fade(false);
        this._status("error", err);
      }
      return;
    }
    if (token !== this.loadToken) {
      next.dispose();
      return;
    }

    if (this.scene) {
      this.world.remove(this.scene.group);
      this.scene.dispose();
    }
    this.scene = next;
    this.index = target;
    this.world.add(next.group);
    if (next.enter) next.enter();
    this._setMode(next.isWorld ? "world" : "photo");
    this.camera.near = next.near;
    this.camera.far = next.far;
    this.resize();
    this.resetView(true);
    if (next.isWorld) {
      // The splats are sorted for the viewpoint off the main thread: wait until they are on screen.
      await this._settle(token);
      if (token !== this.loadToken) return;
    }
    // Arrive still moving: the first thing the visitor sees in a space is its depth.
    if (!next.isWorld && !this.reducedMotion && !this.renderer.xr.isPresenting) {
      // Start a little behind (or ahead of) the camera position, as far as the picture allows.
      let offset = forwardTrip ? -next.limits.back * 0.9 : next.limits.forward * 0.3;
      for (let i = 0; i < 5; i++) {
        this._place(offset);
        if (next.canStandAt(this.pos) === "ok") break;
        offset *= 0.5;
      }
      // A tall photograph shows only part of its height at once: arrive looking a little
      // down and rise to the middle, so the visitor sees there is more above and below.
      const range = next.lookRange(this.pos, 0, 0);
      const tilt = range.pitchMax - range.pitchMin > 24 * DEG ? range.pitchMin * 0.45 : 0;
      if (tilt) this.pitch = this.targetPitch = next.basePitch + tilt;
      this.arrive = { start: performance.now(), offset, tilt, duration: 1500 };
    }
    this._status("ready");
    if (this.hooks.onScene) this.hooks.onScene(target, next);
    if (this.auto) this.auto.start = performance.now();
    if (veiled) {
      // Draw the new space once before the frozen picture starts to dissolve.
      this._render();
      this._thaw(forwardTrip ? 1 : -1);
    } else {
      this._fade(false);
    }
    this._warm((target + 1) % n);
  }

  /**
   * Load a space. One that has a generated room opens as that room; if the room cannot be
   * shown here, its photograph is shown instead and `worldError` says why.
   */
  async _open(meta, token) {
    if (meta.world && !this.roomsOff) {
      let room = null;
      try {
        if (typeof WebGL2RenderingContext === "undefined" || !(this.renderer.getContext() instanceof WebGL2RenderingContext)) throw new Error("WebGL2 is not available");
        const why = await whyNoRooms();
        if (why) throw new Error(why);
        if (!this.roomCode) this.roomCode = await import("./world.js");
        room = new this.roomCode.WorldScene(meta, this.tour.base);
        await room.load(this.renderer, this.detail, (share) => {
          if (token === this.loadToken && this.hooks.onProgress) this.hooks.onProgress(share);
        });
        if (!this.spark) this.spark = this.roomCode.createSplatRenderer(this.renderer, () => { this.dirty = true; });
        return room;
      } catch (err) {
        if (room) room.dispose();
        this.worldError = String((err && err.message) || err);
        // Without the machinery itself no room will open: do not try the others.
        if (!this.roomCode || /WebGL2|WebAssembly|Worker/i.test(this.worldError)) this.roomsOff = true;
        if (typeof console !== "undefined") console.warn("3D room not shown, using the photograph: " + this.worldError);
      }
    }
    const scene = new TourScene(meta, this.tour.base);
    try {
      await scene.load(this.renderer, this.detail);
    } catch (err) {
      scene.dispose();
      throw err;
    }
    return scene;
  }

  /** Photographs and rooms are drawn differently: switch what the renderer is set up for. */
  _setMode(mode) {
    this.mode = mode;
    const room = mode === "world";
    if (this.spark) {
      if (room && !this.spark.parent) this.world.add(this.spark);
      if (!room && this.spark.parent) this.world.remove(this.spark);
    }
    const ratio = room ? this.roomRatio : this.photoRatio;
    if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    if (room && this.spark) this.spark.lodSplatCount = this.scene.budget || undefined;
    this.slowFrames = 0;
    if (room) {
      this.targetZoom = 1;
      this.zoom = 1;
      this.arrive = null;
    }
  }

  /** Draw a generated room until its splats are in place (or a few seconds have passed). */
  _settle(token) {
    const spark = this.spark;
    const started = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        if (token !== this.loadToken || !spark) return resolve();
        const waited = performance.now() - started;
        if ((spark.activeSplats > 0 && !spark.sorting && !spark.sortDirty && waited > 60) || waited > 6000) return resolve();
        this.dirty = true;
        if (!this.renderer.xr.isPresenting) this._render();
        setTimeout(check, 50);
      };
      check();
    });
  }

  /** Stand `offset` metres along the photograph's own direction (negative: behind the camera position). */
  _place(offset) {
    const scene = this.scene;
    this.pos.set(-Math.sin(scene.baseYaw) * offset, 0, -Math.cos(scene.baseYaw) * offset);
    this.eye.copy(this.pos);
  }

  /** Copy the picture on screen to the layer above it. Returns false when there is no such layer. */
  _freeze(forwardTrip) {
    const veil = this.veil;
    if (!veil || !veil.getContext || !veil.animate || this.renderer.xr.isPresenting) return false;
    try {
      this._render(); // a fresh frame: the drawing buffer is only valid right after rendering
      const scale = Math.min(1, 1600 / Math.max(1, this.canvas.width));
      veil.width = Math.max(1, Math.round(this.canvas.width * scale));
      veil.height = Math.max(1, Math.round(this.canvas.height * scale));
      veil.getContext("2d").drawImage(this.canvas, 0, 0, veil.width, veil.height);
    } catch (err) {
      return false;
    }
    if (this.veilAnim) this.veilAnim.cancel();
    veil.hidden = false;
    veil.style.opacity = "1";
    // A slow drift while the next space loads, so the picture is never completely still.
    this.veilAnim = veil.animate([{ transform: "scale(1)" }, { transform: forwardTrip ? "scale(1.07)" : "scale(0.95)" }], {
      duration: 900,
      easing: "cubic-bezier(0.3, 0, 0.6, 1)",
      fill: "forwards",
    });
    return true;
  }

  /** Dissolve the frozen picture: direction 1 walks into it, −1 backs out of it, 0 just removes it. */
  _thaw(direction) {
    const veil = this.veil;
    if (!veil || veil.hidden) return;
    const from = getComputedStyle(veil).transform;
    if (this.veilAnim) this.veilAnim.cancel();
    if (!direction) {
      veil.hidden = true;
      return;
    }
    const anim = veil.animate(
      [
        { transform: from === "none" ? "scale(1)" : from, opacity: 1 },
        { transform: direction > 0 ? "scale(1.22)" : "scale(0.86)", opacity: 0 },
      ],
      { duration: 760, easing: "cubic-bezier(0.33, 0, 0.3, 1)", fill: "forwards" }
    );
    this.veilAnim = anim;
    anim.onfinish = () => {
      if (this.veilAnim !== anim) return;
      veil.hidden = true;
      anim.cancel();
      this.veilAnim = null;
    };
  }

  _render() {
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.camera.position.copy(this.eye);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.renderer.render(this.world, this.camera);
    this.frames++;
  }

  next() {
    return this.goTo(this.index + 1, { direction: 1 });
  }

  previous() {
    return this.goTo(this.index - 1, { direction: -1 });
  }

  /** Put the visitor back where the photograph was taken, looking the same way. */
  resetView(immediate) {
    if (!this.scene) return;
    this.glide = null;
    this.arrive = null;
    this.wheelImpulse = 0;
    this.targetZoom = 1;
    if (immediate) this._setZoom(1);
    this.targetYaw = this.scene.baseYaw;
    this.targetPitch = this.scene.basePitch;
    this.xrYaw = this.scene.baseYaw;
    if (this.scene.isWorld) {
      // Back to where the photograph was taken: at once, or on foot.
      const room = this.scene;
      this.velocity.set(0, 0);
      this.route = null;
      if (immediate) {
        // The first view is the photograph's own: from its camera, the way it looked.
        this.pos.copy(room.start);
        this.lead.copy(room.lead);
        this.walked = 0;
        this.floorY = this.pos.y;
        this.eye.set(this.pos.x + this.lead.x, this.pos.y + room.eyeHeight + this.lead.y, this.pos.z + this.lead.z);
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
      } else if (this.reducedMotion) {
        this.pos.copy(room.start);
        this.floorY = this.pos.y;
      } else {
        // Keep the turn short: the visitor may have turned round several times.
        this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
        const points = room.route(this.pos, room.start, null);
        if (points) this.route = { points, i: 0, stalled: 0 };
      }
      this.dirty = true;
      return;
    }
    if (immediate) {
      this.pos.set(0, 0, 0);
      this.eye.set(0, 0, 0);
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    } else {
      this.glide = { x: 0, z: 0, stalled: 0 };
    }
    this.dirty = true;
  }

  /** Download the next scene's files in the background so the switch is instant. */
  _warm(index) {
    if (index === this.index) return;
    const meta = this.tour.scenes[index];
    const url = this.tour.base + meta.base;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    idle(() => {
      if (meta.world && !this.roomsOff) {
        // A room is many megabytes: fetch ahead only its small part, and its code.
        fetch(url + meta.world.collider).catch(() => {});
        if (!this.roomCode) import("./world.js").then((code) => { this.roomCode = this.roomCode || code; }).catch(() => {});
        return;
      }
      fetch(url + "geo.bin").catch(() => {});
      new Image().src = url + "color.webp";
    });
  }

  _status(state, error) {
    this.status = state;
    if (this.hooks.onStatus) this.hooks.onStatus(state, error);
  }

  _fade(out) {
    if (!this.hooks.onFade) return Promise.resolve();
    return this.hooks.onFade(out, this.reducedMotion ? 0 : out ? 320 : 520);
  }

  _userActed() {
    this.stopAuto();
    this.arrive = null;
  }

  // ---------------------------------------------------------------- input

  _bindInput() {
    const canvas = this.canvas;
    const pointers = new Map();
    let pinch = 0;
    let press = null;

    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointer already released */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pressing = pointers.size;
      press = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this._userActed();
      canvas.focus({ preventScroll: true });
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) {
        // A mouse moving over the picture without a button down: lean with it.
        if (e.pointerType === "mouse") {
          const rect = canvas.getBoundingClientRect();
          this.pointerX = e.clientX;
          this.pointerY = e.clientY;
          this.hover.set(clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1), clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1));
          this.hoverActive = true;
          this.dirty = true;
        }
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        if (press) press.moved += Math.abs(dx) + Math.abs(dy);
        // Drag the picture: it follows the pointer.
        const perPixel = (this.camera.fov * DEG) / Math.max(1, canvas.clientHeight);
        this.targetYaw += dx * perPixel;
        this.targetPitch += dy * perPixel;
        this.glide = null;
        this.dirty = true;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        this.wheelImpulse += (dist - pinch) * 0.014;
        pinch = dist;
      }
    });

    const release = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      this.pressing = pointers.size;
      if (e.pointerType === "mouse") {
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;
      }
      if (press && press.moved < 6 && performance.now() - press.t < 450 && e.type === "pointerup") {
        this._walkTowards(e.clientX, e.clientY);
      }
      press = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", () => {
      this.hoverActive = false;
      this.dirty = true;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 32 : 1;
        this.wheelImpulse += clamp(-e.deltaY * unit * 0.004, -1.5, 1.5);
        this._userActed();
      },
      { passive: false }
    );

    this._onKeyDown = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      this.fast = e.shiftKey;
      if (TourViewer.MOVE_KEYS.has(e.code)) {
        this.keys.add(e.code);
        this._userActed();
        this.glide = null;
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.fast = e.shiftKey;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.fast = false;
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
  }

  /** Joystick vector: x to the right, y forward, each in −1…1. */
  setJoystick(x, y) {
    this.joystick.set(clamp(x, -1, 1), clamp(y, -1, 1));
    if (x || y) {
      this._userActed();
      this.glide = null;
    }
  }

  /** World-space ray through a point of the page; returns the scene's surface there or null. */
  _surfaceUnder(clientX, clientY, point, normal) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    if (Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) return null;
    this.camera.updateMatrixWorld();
    const dir = this._dir.set(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.eye).normalize();
    if (this.scene.isWorld) {
      // In a room the pointer means a place on the floor, or something to walk up to.
      this.aimed = this.scene.aim(this.eye, dir, this.pos.y, point, normal);
      return this.aimed ? point : null;
    }
    return this.scene.surfaceAt(this.eye, dir, point, normal);
  }

  /** Click or tap: step towards the point under the pointer. */
  _walkTowards(clientX, clientY) {
    if (!this.scene || !this.scene.ready || this.renderer.xr.isPresenting) return;
    const hit = this._surfaceUnder(clientX, clientY, this._hit, this._normal);
    if (!hit) return;
    if (this.scene.isWorld) {
      // The ripple marks a place on the floor; furniture and walls are walked up to without one.
      if (this.aimed === "floor") this.pulse = { start: performance.now(), point: hit.clone(), normal: this._normal.clone() };
      this._userActed();
      this._walkTo(hit, this._normal);
      return;
    }
    this.pulse = { start: performance.now(), point: hit.clone(), normal: this._normal.clone() };
    const dx = hit.x - this.pos.x;
    const dz = hit.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const travel = Math.max(0, dist - 0.8);
    this._userActed();
    // How far along that line can the visitor actually go?
    let reach = 0;
    if (travel > 0.05) {
      const probe = this._next;
      for (let i = 1; i <= 24; i++) {
        const share = (travel * i) / 24;
        probe.set(this.pos.x + (dx / dist) * share, this.pos.y, this.pos.z + (dz / dist) * share);
        if (this.scene.canStandAt(probe) !== "ok") break;
        reach = share;
      }
    }
    if (reach > 0.08) {
      this.glide = { x: this.pos.x + (dx / dist) * reach, z: this.pos.z + (dz / dist) * reach, stalled: 0 };
      return;
    }
    // Nowhere left to step: bring the clicked point closer instead.
    if (this.targetZoom < TourViewer.MAX_ZOOM - 0.05) {
      this.targetZoom = Math.min(TourViewer.MAX_ZOOM, this.targetZoom * 1.45);
      const to = this._dir.copy(hit).sub(this.eye);
      const blend = 0.6;
      const yaw = Math.atan2(-to.x, -to.z);
      const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
      this.targetYaw += Math.atan2(Math.sin(yaw - this.targetYaw), Math.cos(yaw - this.targetYaw)) * blend;
      this.targetPitch += (pitch - this.targetPitch) * blend;
      this.dirty = true;
    }
  }

  /** In a room: walk to a point on its surface, around whatever stands in between. */
  _walkTo(point, normal) {
    const room = this.scene;
    const points = room.route(this.pos, point, normal);
    this.velocity.set(0, 0);
    if (!points) {
      this.route = null;
      return false;
    }
    if (this.reducedMotion) {
      // No travelling shot for those who asked for less motion: be there.
      for (const p of points) this.walked += room.walk(this.pos, p.x - this.pos.x, p.z - this.pos.z);
      this.floorY = this.pos.y;
      this.route = null;
      this.dirty = true;
      return true;
    }
    this.route = { points, i: 0, stalled: 0 };
    return true;
  }

  /** Apply a zoom factor: narrows the camera and tells the scene how much of the picture is in view. */
  _setZoom(zoom) {
    this.zoom = zoom;
    const half = Math.atan(Math.tan(this.baseFov / 2) / zoom);
    this.camera.fov = (2 * half) / DEG;
    this.camera.updateProjectionMatrix();
    if (this.scene) this.scene.setView(Math.atan(Math.tan(half) * this.camera.aspect), half);
    this.dirty = true;
  }

  /** Lay the ring on the surface under the pointer (or play the ripple of the last click). */
  _updateCursor(now, dt) {
    const cursor = this.cursor;
    const [ring, disc] = cursor.children;
    let show = 0;
    let grow = 1;
    if (this.pulse) {
      const t = (now - this.pulse.start) / 520;
      if (t >= 1) this.pulse = null;
      else {
        this._point.copy(this.pulse.point);
        this._normal.copy(this.pulse.normal);
        show = 1 - t;
        grow = 0.7 + 0.9 * easeOut(t);
        this.cursorSeen = true;
      }
    }
    if (!this.pulse && this.hoverActive && !this.pressing && !this.auto && !this.arrive && this.status === "ready") {
      // In a room the ring lies only where the visitor can walk to.
      if (this._surfaceUnder(this.pointerX, this.pointerY, this._point, this._normal) && (!this.scene.isWorld || this.aimed === "floor")) show = 1;
    }
    const target = show > 0 ? 1 : 0;
    const before = this.cursorOn;
    this.cursorOn += (target - this.cursorOn) * Math.min(1, dt * (target ? 12 : 9));
    if (this.cursorOn < 0.01 && !target) this.cursorOn = 0;
    if (!this.cursorOn && !before) {
      if (cursor.visible) {
        cursor.visible = false;
        this.dirty = true;
      }
      return;
    }
    if (show > 0) {
      const dist = this._point.distanceTo(this.eye);
      const size = clamp(dist * 0.042, 0.03, 1.2) * grow;
      this._quat.setFromUnitVectors(this._axis, this._normal);
      // The ring turns smoothly from one surface to the next instead of snapping.
      if (this.cursorSeen && !this.pulse) cursor.quaternion.slerp(this._quat, Math.min(1, dt * 14));
      else cursor.quaternion.copy(this._quat);
      cursor.position.copy(this._point).addScaledVector(this._normal, dist * 0.004);
      cursor.scale.setScalar(size);
      this.cursorSeen = true;
    }
    const strength = this.pulse ? show : this.cursorOn;
    ring.material.opacity = 0.9 * strength;
    disc.material.opacity = 0.16 * strength;
    cursor.visible = strength > 0.005;
    if (!cursor.visible) this.cursorSeen = false;
    this.dirty = true;
  }

  // ---------------------------------------------------------------- automatic tour

  startAuto() {
    if (this.auto || this.reducedMotion) return;
    if (!this.scene || !this.scene.isWorld) this.resetView(false);
    this.auto = { start: performance.now(), duration: 8000 };
    if (this.hooks.onAuto) this.hooks.onAuto(true);
  }

  stopAuto() {
    if (!this.auto) return;
    this.auto = null;
    if (this.hooks.onAuto) this.hooks.onAuto(false);
  }

  toggleAuto() {
    if (this.auto) this.stopAuto();
    else this.startAuto();
  }

  _autoStep(now, dt) {
    const scene = this.scene;
    const t = (now - this.auto.start) / this.auto.duration;
    if (t >= 1) {
      this.auto.start = now + 1e9; // wait for the next scene to restart the clock
      this.goTo(this.index + 1);
      return;
    }
    if (t < 0) return;
    this.glide = null;
    this.arrive = null;
    const reach = scene.limits.forward * 0.8 * ease(Math.min(1, t * 1.1));
    const fx = -Math.sin(scene.baseYaw);
    const fz = -Math.cos(scene.baseYaw);
    this._delta.set(fx * reach - this.pos.x, 0, fz * reach - this.pos.z);
    const maxStep = scene.limits.speed * dt;
    if (this._delta.length() > maxStep) this._delta.setLength(maxStep);
    scene.move(this.pos, this._delta, this.pos);
    const range = scene.lookRange(this.eye, 0, 0);
    const sweep = Math.min(6 * DEG, (range.yawMax - range.yawMin) / 2);
    this.targetYaw = scene.baseYaw + (range.yawMin + range.yawMax) / 2 + Math.sin(t * Math.PI * 2) * sweep;
    this.targetPitch = scene.basePitch + clamp(0, range.pitchMin, range.pitchMax);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- frame

  _frame(time, xrFrame) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    const scene = this.scene;
    if (!scene || !scene.ready) return;

    if (this.renderer.xr.isPresenting) {
      this._xrStep(dt, xrFrame);
      this.renderer.render(this.world, this.camera);
      return;
    }

    if (scene.isWorld) {
      this._walkFrame(now, dt);
      return;
    }

    const L = scene.limits;
    const fx = -Math.sin(scene.baseYaw);
    const fz = -Math.cos(scene.baseYaw);

    if (this.arrive) {
      const t = Math.min(1, (now - this.arrive.start) / this.arrive.duration);
      this._place(this.arrive.offset * (1 - easeOut(t)));
      if (this.arrive.tilt) this.targetPitch = scene.basePitch + this.arrive.tilt * (1 - ease(Math.min(1, t * 1.15)));
      this.dirty = true;
      if (t >= 1) this.arrive = null;
    } else if (this.auto) {
      this._autoStep(now, dt);
    }

    // --- stepping
    const K = this.keys;
    let forward = (K.has("KeyW") || K.has("ArrowUp") ? 1 : 0) - (K.has("KeyS") || K.has("ArrowDown") ? 1 : 0) + this.joystick.y;
    let strafe = (K.has("KeyD") ? 1 : 0) - (K.has("KeyA") ? 1 : 0) + this.joystick.x;
    const turn = (K.has("ArrowLeft") ? 1 : 0) - (K.has("ArrowRight") ? 1 : 0);
    if (turn) {
      this.targetYaw += turn * 0.9 * dt;
      this.dirty = true;
    }

    const delta = this._delta.set(0, 0, 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    if (forward || strafe) {
      const len = Math.hypot(forward, strafe);
      if (len > 1) {
        forward /= len;
        strafe /= len;
      }
      delta.x += (-sin * forward + cos * strafe) * L.speed * dt;
      delta.z += (-cos * forward - sin * strafe) * L.speed * dt;
    }
    // Scrolling goes deeper into the picture: real steps first, then zoom; and back out the same way.
    let wheelPush = 0;
    if (Math.abs(this.wheelImpulse) > 0.002) {
      wheelPush = this.wheelImpulse * Math.min(1, dt * 9);
      this.wheelImpulse -= wheelPush;
      if (wheelPush < 0 && this.targetZoom > 1.001) {
        this.targetZoom = Math.max(1, this.targetZoom * Math.exp(wheelPush * 0.55));
        wheelPush = 0;
      } else {
        delta.x += fx * wheelPush * L.speed * 0.5;
        delta.z += fz * wheelPush * L.speed * 0.5;
      }
    } else {
      this.wheelImpulse = 0;
    }
    if (this.glide) {
      const gx = this.glide.x - this.pos.x;
      const gz = this.glide.z - this.pos.z;
      const dist = Math.hypot(gx, gz);
      if (dist < 0.01) this.glide = null;
      else {
        const stepLen = Math.min(dist, Math.max(L.speed * 1.2 * dt, dist * Math.min(1, dt * 4)));
        delta.x += (gx / dist) * stepLen;
        delta.z += (gz / dist) * stepLen;
      }
    }
    let advanced = 0;
    if (delta.x !== 0 || delta.z !== 0) {
      const before = this._next.copy(this.pos);
      scene.move(this.pos, delta, this.pos);
      const progressed = before.distanceToSquared(this.pos) > 1e-12;
      advanced = (this.pos.x - before.x) * fx + (this.pos.z - before.z) * fz;
      if (this.glide && !progressed && ++this.glide.stalled > 3) this.glide = null;
      if (progressed) this.dirty = true;
      // Scrolled forward with nowhere left to step: zoom.
      if (wheelPush > 0 && advanced < wheelPush * L.speed * 0.5 * 0.3) {
        this.targetZoom = Math.min(TourViewer.MAX_ZOOM, this.targetZoom * Math.exp(wheelPush * 0.55));
      }
    }
    if (K.has("Equal") || K.has("NumpadAdd")) this.targetZoom = Math.min(TourViewer.MAX_ZOOM, this.targetZoom * Math.exp(dt * 1.2));
    if (K.has("Minus") || K.has("NumpadSubtract")) this.targetZoom = Math.max(1, this.targetZoom * Math.exp(-dt * 1.2));
    if (Math.abs(this.targetZoom - this.zoom) > 1e-4) {
      this._setZoom(this.zoom + (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 9)));
    }
    // Zooming out can leave the visitor where the picture no longer fills the view: ease back.
    if (!this.arrive && scene.canStandAt(this.pos) === "edge" && this.pos.lengthSq() > 1e-8) {
      this.pos.multiplyScalar(Math.exp(-dt * 5));
      this.glide = null;
      this.dirty = true;
    }

    // --- walking on: keep pressing forward where this space ends and the next one begins
    const push = Math.abs(forward) > 0.5 ? Math.sign(forward) : 0;
    if (!push) {
      this.pushTime = 0;
      this.pushLock = false;
    } else if (!this.pushLock && this.count > 1 && this.status === "ready" && !this.arrive) {
      if (advanced * push > L.speed * dt * 0.15) this.pushTime = 0;
      else this.pushTime += dt;
      if (this.pushTime > 0.45) {
        this.pushTime = 0;
        this.pushLock = true; // one space per press
        if (push > 0) this.next();
        else this.previous();
      }
    }

    // --- lean: the eyes follow the pointer by a few centimetres, like looking through a window
    const lean = this._lean.set(0, 0, 0);
    if (this.hoverActive && !this.auto) {
      const side = this.hover.x * L.side * 0.75;
      lean.set(cos * side, -this.hover.y * L.lift * 0.75, -sin * side);
    }
    const want = this._next.copy(this.pos);
    if (lean.lengthSq() > 0) {
      // As much of the lean as the picture allows.
      for (let share = 1; share > 0.2; share -= 0.25) {
        want.copy(this.pos).addScaledVector(lean, share);
        if (scene.canStandAt(want) === "ok") break;
        want.copy(this.pos);
      }
    }
    const follow = 1 - Math.exp(-dt * 7);
    if (this.eye.distanceToSquared(want) > 1e-10) {
      this.eye.lerp(want, this.arrive ? 1 : follow);
      this.dirty = true;
    }

    // --- view direction, kept inside the photograph
    const range = scene.lookRange(this.eye, this.targetYaw - scene.baseYaw, this.targetPitch - scene.basePitch);
    this.targetYaw = clamp(this.targetYaw, scene.baseYaw + range.yawMin, scene.baseYaw + range.yawMax);
    this.targetPitch = clamp(this.targetPitch, scene.basePitch + range.pitchMin, scene.basePitch + range.pitchMax);
    const blend = 1 - Math.exp(-dt * 14);
    const dy = this.targetYaw - this.yaw;
    const dp = this.targetPitch - this.pitch;
    if (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5) {
      this.yaw += dy * blend;
      this.pitch += dp * blend;
      this.dirty = true;
    }

    this._updateCursor(now, dt);

    if (!this.dirty) return;
    this.dirty = false;
    this._render();
  }

  /**
   * One frame in a generated room: the visitor walks where the keys, the stick, the wheel or
   * the clicked spot take them, as far as the room lets them, and looks wherever they like.
   */
  _walkFrame(now, dt) {
    const room = this.scene;
    const K = this.keys;

    if (this.auto) {
      // The automatic tour stands still and looks slowly round the room, then moves on.
      const t = (now - this.auto.start) / 16000;
      if (t >= 1) {
        this.auto.start = now + 1e9;
        this.goTo(this.index + 1);
      } else if (t >= 0) {
        this.targetYaw -= ((2 * Math.PI) / 16) * dt;
        this.targetPitch += (0 - this.targetPitch) * Math.min(1, dt * 2);
        this.route = null;
        this.dirty = true;
      }
    }

    // --- looking
    const turn = (K.has("ArrowLeft") ? 1 : 0) - (K.has("ArrowRight") ? 1 : 0);
    if (turn) this.targetYaw += turn * 1.6 * dt;
    this.targetPitch = clamp(this.targetPitch, -MAX_PITCH, MAX_PITCH);
    const blend = 1 - Math.exp(-dt * 14);
    const dy = this.targetYaw - this.yaw;
    const dp = this.targetPitch - this.pitch;
    if (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5) {
      this.yaw += dy * blend;
      this.pitch += dp * blend;
      this.dirty = true;
    }

    // --- where the visitor wants to go
    let forward = (K.has("KeyW") || K.has("ArrowUp") ? 1 : 0) - (K.has("KeyS") || K.has("ArrowDown") ? 1 : 0) + this.joystick.y;
    let strafe = (K.has("KeyD") ? 1 : 0) - (K.has("KeyA") ? 1 : 0) + this.joystick.x;
    const steering = Boolean(forward || strafe);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = 0;
    let wz = 0;
    if (steering) {
      const len = Math.hypot(forward, strafe);
      if (len > 1) {
        forward /= len;
        strafe /= len;
      }
      const speed = this.fast ? RUN : WALK;
      wx = (-sin * forward + cos * strafe) * speed;
      wz = (-cos * forward - sin * strafe) * speed;
      this.route = null;
    } else if (this.route) {
      // On the way to a clicked spot: towards the next corner of the way, slowing at the end.
      const route = this.route;
      let target = route.points[route.i];
      let gx = target.x - this.pos.x;
      let gz = target.z - this.pos.z;
      let dist = Math.hypot(gx, gz);
      while (dist < 0.1 && route.i < route.points.length - 1) {
        target = route.points[++route.i];
        gx = target.x - this.pos.x;
        gz = target.z - this.pos.z;
        dist = Math.hypot(gx, gz);
      }
      if (dist < 0.03) {
        this.route = null;
      } else {
        let left = dist;
        for (let i = route.i; i < route.points.length - 1; i++) left += Math.hypot(route.points[i + 1].x - route.points[i].x, route.points[i + 1].z - route.points[i].z);
        const speed = Math.min(STROLL, 0.35 + left * 2.4);
        wx = (gx / dist) * speed;
        wz = (gz / dist) * speed;
      }
    }
    // Speed is gathered and lost over a moment, as a person does.
    const gather = 1 - Math.exp(-dt * (steering || this.route ? 9 : 12));
    this.velocity.x += (wx - this.velocity.x) * gather;
    this.velocity.y += (wz - this.velocity.y) * gather;
    if (!steering && !this.route && this.velocity.lengthSq() < 1e-4) this.velocity.set(0, 0);
    let dx = this.velocity.x * dt;
    let dz = this.velocity.y * dt;
    if (this.route) {
      // Never past the corner being walked to.
      const target = this.route.points[this.route.i];
      const dist = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
      const step = Math.hypot(dx, dz);
      if (step > dist && step > 0) {
        dx *= dist / step;
        dz *= dist / step;
      }
    }
    // The wheel (or a pinch) walks forward and back.
    if (Math.abs(this.wheelImpulse) > 0.002) {
      const push = this.wheelImpulse * Math.min(1, dt * 9);
      this.wheelImpulse -= push;
      dx += -sin * push * 1.3;
      dz += -cos * push * 1.3;
      this.route = null;
    } else {
      this.wheelImpulse = 0;
    }

    const wanted = Math.hypot(dx, dz);
    if (wanted > 1e-6) {
      const moved = room.walk(this.pos, dx, dz);
      this.walked += moved;
      if (moved < wanted * 0.3) {
        // Stopped by something: do not keep pressing into it.
        this.velocity.multiplyScalar(Math.exp(-dt * 10));
        if (this.route && (this.route.stalled += dt) > 0.5) this.route = null;
      } else if (this.route) {
        this.route.stalled = 0;
      }
    }

    // --- the eyes: a fixed height above the floor, following it gently over steps and uneven
    // ground; over the first steps they come from the photograph's camera to that height
    const gap = this.pos.y - this.floorY;
    this.floorY = Math.abs(gap) < 0.002 || Math.abs(gap) > 1 ? this.pos.y : this.floorY + gap * (1 - Math.exp(-dt * 8));
    const left = this.walked >= RISE ? 0 : 1 - ease(this.walked / RISE);
    const ex = this.pos.x + this.lead.x * left;
    const ey = this.floorY + room.eyeHeight + this.lead.y * left;
    const ez = this.pos.z + this.lead.z * left;
    if (this.eye.x !== ex || this.eye.y !== ey || this.eye.z !== ez) {
      this.eye.set(ex, ey, ez);
      this.dirty = true;
    }

    this._updateCursor(now, dt);
    this._pace(dt);

    if (!this.dirty) return;
    this.dirty = false;
    this._render();
  }

  /**
   * A machine that cannot keep up with a room is given less to draw, in steps: first fewer of
   * a large room's splats (the far ones merge), then fewer pixels.
   */
  _pace(dt) {
    if (!this.dirty) return;
    if (dt > 0.045) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames <= 45) return;
    this.slowFrames = 0;
    const room = this.scene;
    if (room.large && (!room.budget || room.budget > 750000)) {
      if (this.thinningRoom) return;
      const count = room.budget ? 700000 : 1200000;
      this.thinningRoom = room;
      room.thin(count).then((ok) => {
        this.thinningRoom = null;
        if (!ok || this.scene !== room || !this.spark) return;
        this.spark.lodSplatCount = count;
        this.dirty = true;
      });
      return;
    }
    if (this.roomRatio > 0.8) {
      this.roomRatio = Math.max(0.75, this.roomRatio - 0.25);
      this.renderer.setPixelRatio(this.roomRatio);
      this.resize();
    }
  }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.scene) this.baseFov = this.scene.viewFov(w / h);
    this._setZoom(this.zoom);
  }

  // ---------------------------------------------------------------- VR headsets (WebXR)

  static async vrSupported() {
    try {
      return Boolean(navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr")));
    } catch (e) {
      return false;
    }
  }

  async enterVR() {
    if (!this.scene || this.renderer.xr.isPresenting) return;
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    // A photograph: "local", the headset starts exactly where it was taken, whatever the wearer's
    // height, and small real head movements show the room's real depth.
    // A generated room: "local-floor" where the headset offers it, so the wearer stands on its
    // floor at their own height and walks with the left stick.
    let floor = false;
    if (this.scene.isWorld) {
      try {
        await session.requestReferenceSpace("local-floor");
        floor = true;
      } catch (err) {
        floor = false;
      }
    }
    this.xrFloor = floor;
    this.xrHead = null;
    this.renderer.xr.setReferenceSpaceType(floor ? "local-floor" : "local");
    await this.renderer.xr.setSession(session);
    this._userActed();
    if (!this.scene.isWorld) this.pos.set(0, 0, 0);
    this.route = null;
    this.velocity.set(0, 0);
    this.cursor.visible = false;
    this.xrYaw = this.scene.baseYaw;
    session.addEventListener("select", () => this.next());
    session.addEventListener("squeeze", () => this.previous());
    session.addEventListener("end", () => {
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      if (this.hooks.onXr) this.hooks.onXr(false);
      this.resize();
      this.resetView(true);
    });
    if (this.hooks.onXr) this.hooks.onXr(true);
  }

  _xrStep(dt, frame) {
    const rig = this.rig;
    const scene = this.scene;
    const room = scene.isWorld;
    const session = frame && frame.session;
    let turn = 0;
    if (session) {
      for (const source of session.inputSources) {
        const pad = source.gamepad;
        if (!pad || pad.axes.length < 4) continue;
        if (room && source.handedness === "left") {
          // Walk the way the wearer faces.
          const ahead = Math.abs(pad.axes[3]) > 0.15 ? -pad.axes[3] : 0;
          const aside = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
          if (ahead || aside) {
            const facing = this.camera.getWorldDirection(this._dir);
            facing.y = 0;
            if (facing.lengthSq() > 1e-6) {
              facing.normalize();
              this.walked += scene.walk(this.pos, (facing.x * ahead - facing.z * aside) * WALK * dt, (facing.z * ahead + facing.x * aside) * WALK * dt);
            }
          }
          continue;
        }
        if (Math.abs(pad.axes[2]) > 0.15) turn += pad.axes[2];
      }
    }
    if (room) {
      rig.position.set(this.pos.x, this.pos.y + (this.xrFloor ? 0 : scene.eyeHeight), this.pos.z);
      rig.rotation.set(0, this.xrYaw, 0);
    } else {
      // In a floor-level session a photograph is still seen from where it was taken.
      if (this.xrFloor && this.xrHead === null && this.camera.position.y > 0.3) this.xrHead = this.camera.position.y;
      rig.position.set(0, this.xrFloor ? -(this.xrHead || 1.6) : 0, 0);
      rig.rotation.set(0, this.xrYaw - scene.baseYaw, 0);
    }
    if (!session) return;
    // Snap turns are far more comfortable in a headset than smooth rotation.
    if (Math.abs(turn) > 0.7 && this.xrSnapReady) {
      this.xrYaw -= Math.sign(turn) * 30 * DEG;
      this.xrSnapReady = false;
    } else if (Math.abs(turn) < 0.3) {
      this.xrSnapReady = true;
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    if (this.veilAnim) this.veilAnim.cancel();
    if (this.veil) this.veil.hidden = true;
    if (this.scene) this.scene.dispose();
    if (this.roomCode) this.roomCode.closeRooms();
    if (this.spark) {
      this.world.remove(this.spark);
      this.spark.dispose();
      this.spark = null;
    }
    this.cursor.children.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
    });
    this.renderer.dispose();
  }
}

TourViewer.MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Equal", "Minus", "NumpadAdd", "NumpadSubtract"]);
TourViewer.MAX_ZOOM = 2.4;
