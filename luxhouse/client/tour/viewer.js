/**
 * The tour viewer: renderer, first-person camera, movement, scene switching,
 * the automatic tour and the WebXR (VR headset) session.
 *
 * The visitor stands where the photograph was taken. They can look around
 * inside the picture, lean and step a little (real depth, kept within the
 * range where the room still looks real), and travel from space to space.
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

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

    const next = new TourScene(this.tour.scenes[target], this.tour.base);
    const leaving = !opts.instant && this.scene && this.scene.ready;
    // Which way the visitor travels: on to the next space, or back to the one before.
    const forwardTrip = opts.direction ? opts.direction > 0 : target === (this.index + 1) % n || target > this.index;
    this.cursorOn = 0;
    this.cursor.visible = false;
    // Travelling: the picture freezes on a layer above the scene, drifts the way the visitor
    // is going and dissolves into the next space. Without that layer, a plain fade.
    const veiled = leaving && !this.reducedMotion && this._freeze(forwardTrip);
    try {
      await Promise.all([next.load(this.renderer, this.detail), leaving && !veiled ? this._fade(true) : null]);
    } catch (err) {
      next.dispose();
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
    this.camera.near = next.near;
    this.camera.far = next.far;
    this.resize();
    this.resetView(true);
    // Arrive still moving: the first thing the visitor sees in a space is its depth.
    if (!this.reducedMotion && !this.renderer.xr.isPresenting) {
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
    const url = this.tour.base + this.tour.scenes[index].base;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    idle(() => {
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
      if (TourViewer.MOVE_KEYS.has(e.code)) {
        this.keys.add(e.code);
        this._userActed();
        this.glide = null;
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();
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
    return this.scene.surfaceAt(this.eye, dir, point, normal);
  }

  /** Click or tap: step towards the point under the pointer. */
  _walkTowards(clientX, clientY) {
    if (!this.scene || !this.scene.ready || this.renderer.xr.isPresenting) return;
    const hit = this._surfaceUnder(clientX, clientY, this._hit, this._normal);
    if (!hit) return;
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
      if (this._surfaceUnder(this.pointerX, this.pointerY, this._point, this._normal)) show = 1;
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
    this.resetView(false);
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
    const session = await navigator.xr.requestSession("immersive-vr");
    // "local": the headset starts exactly where the photograph was taken, whatever the wearer's
    // height. Small real head movements then show the room's real depth.
    this.renderer.xr.setReferenceSpaceType("local");
    await this.renderer.xr.setSession(session);
    this._userActed();
    this.pos.set(0, 0, 0);
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
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, this.xrYaw - this.scene.baseYaw, 0);

    const session = frame && frame.session;
    if (!session) return;
    let turn = 0;
    for (const source of session.inputSources) {
      const pad = source.gamepad;
      if (!pad || pad.axes.length < 4) continue;
      if (Math.abs(pad.axes[2]) > 0.15) turn += pad.axes[2];
    }
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
    this.cursor.children.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
    });
    this.renderer.dispose();
  }
}

TourViewer.MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Equal", "Minus", "NumpadAdd", "NumpadSubtract"]);
TourViewer.MAX_ZOOM = 2.4;
