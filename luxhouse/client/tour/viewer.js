/**
 * The tour viewer: renderer, first-person camera, movement with collision,
 * scene switching, the automatic tour and the WebXR (VR headset) session.
 */

import { Group, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { TourScene } from "./scene.js";

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);

export class TourViewer {
  /**
   * @param canvas   <canvas> to draw into
   * @param tour     { base, scenes: [...] } as embedded by the server
   * @param hooks    { onScene(index, scene), onStatus(state, error), onEdge(), onAuto(on), onXr(on) }
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
    this.camera = new PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.rotation.order = "YXZ";
    this.rig.add(this.camera);
    this.world.add(this.rig);

    this.scene = null;
    this.index = -1;
    this.loadToken = 0;

    // Eye position and view direction (world space; yaw grows to the left).
    this.pos = new Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    this.keys = new Set();
    this.joystick = new Vector2();
    this.wheelImpulse = 0;
    this.glide = null;
    this.auto = null;
    this.dirty = true;
    this.lastEdge = 0;
    this.xrYaw = 0;
    this.xrSnapReady = true;

    this._delta = new Vector3();
    this._next = new Vector3();
    this._dir = new Vector3();
    this._hit = new Vector3();
    this._head = new Vector3();
    this._last = performance.now();

    this._bindInput();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this._status("error", new Error("Graphics context lost"));
    });
    canvas.addEventListener("webglcontextrestored", () => this.goTo(Math.max(0, this.index), { instant: true }));

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
    try {
      await Promise.all([next.load(this.renderer, this.detail), opts.instant || !this.scene ? null : this._fade(true)]);
    } catch (err) {
      next.dispose();
      if (token === this.loadToken) this._status("error", err);
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
    this.resetView(true);
    this.resize();
    this._status("ready");
    if (this.hooks.onScene) this.hooks.onScene(target, next);
    if (this.auto) this.auto.start = performance.now();
    this._fade(false);
    this._warm((target + 1) % n);
  }

  next() {
    return this.goTo(this.index + 1);
  }

  previous() {
    return this.goTo(this.index - 1);
  }

  /** Put the visitor back where the photograph was taken, looking the same way. */
  resetView(immediate) {
    if (!this.scene) return;
    this.pos.set(0, 0, 0);
    this.targetYaw = this.scene.baseYaw;
    this.targetPitch = this.scene.basePitch;
    this.glide = null;
    this.wheelImpulse = 0;
    this.xrYaw = this.scene.baseYaw;
    if (immediate) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
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
      new Image().src = url + "bg.webp";
    });
  }

  _status(state, error) {
    this.status = state;
    if (this.hooks.onStatus) this.hooks.onStatus(state, error);
  }

  _fade(out) {
    if (!this.hooks.onFade) return Promise.resolve();
    return this.hooks.onFade(out, this.reducedMotion ? 0 : 260);
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
      press = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this.stopAuto();
      canvas.focus({ preventScroll: true });
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
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
        this.wheelImpulse += (dist - pinch) * 0.012;
        pinch = dist;
      }
    });

    const release = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (press && press.moved < 6 && performance.now() - press.t < 450 && e.type === "pointerup") {
        this._walkTowards(e.clientX, e.clientY);
      }
      press = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 32 : 1;
        this.wheelImpulse += clamp(-e.deltaY * unit * 0.004, -1.5, 1.5);
        this.stopAuto();
      },
      { passive: false }
    );

    this._onKeyDown = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (TourViewer.MOVE_KEYS.has(e.code)) {
        this.keys.add(e.code);
        this.stopAuto();
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
      this.stopAuto();
      this.glide = null;
    }
  }

  /** Click or tap: walk towards the point under the pointer. */
  _walkTowards(clientX, clientY) {
    if (!this.scene || !this.scene.ready || this.renderer.xr.isPresenting) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.camera.updateMatrixWorld();
    const dir = this._dir.set(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.pos).normalize();
    const hit = this.scene.raycast(this.pos, dir, this._hit);
    if (!hit) return;
    const eye = this.scene.eyeHeight || 1.5;
    const onFloor = hit.y < this.pos.y - 0.55 * eye;
    const dx = hit.x - this.pos.x;
    const dz = hit.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    // Stand on a floor point; stop short of anything else.
    const travel = onFloor ? dist : Math.max(0, dist - 0.9);
    if (travel < 0.08) return;
    this.glide = { x: this.pos.x + (dx / dist) * travel, z: this.pos.z + (dz / dist) * travel, stalled: 0 };
    this.stopAuto();
  }

  // ---------------------------------------------------------------- automatic tour

  startAuto() {
    if (this.auto || this.reducedMotion) return;
    this.resetView(false);
    this.auto = { start: performance.now(), duration: 9000 };
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
    const k = ease(Math.min(1, t * 1.15));
    const reach = Math.min(1.6, scene.limits.radius * 0.45) * k;
    const fx = -Math.sin(scene.baseYaw);
    const fz = -Math.cos(scene.baseYaw);
    const want = this._next.set(fx * reach, 0, fz * reach);
    this._delta.copy(want).sub(this.pos);
    const maxStep = scene.limits.speed * 0.6 * dt;
    if (this._delta.length() > maxStep) this._delta.setLength(maxStep);
    scene.move(this.pos, this._delta, this.pos);
    this.targetYaw = scene.baseYaw + Math.sin(t * Math.PI * 2) * 7 * DEG;
    this.targetPitch = scene.basePitch;
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

    if (this.auto) this._autoStep(now, dt);

    // --- movement
    const K = this.keys;
    let forward = (K.has("KeyW") || K.has("ArrowUp") ? 1 : 0) - (K.has("KeyS") || K.has("ArrowDown") ? 1 : 0) + this.joystick.y;
    let strafe = (K.has("KeyD") ? 1 : 0) - (K.has("KeyA") ? 1 : 0) + this.joystick.x;
    const turn = (K.has("ArrowLeft") ? 1 : 0) - (K.has("ArrowRight") ? 1 : 0);
    const fast = K.has("ShiftLeft") || K.has("ShiftRight") ? 1.9 : 1;
    if (turn) {
      this.targetYaw += turn * 1.5 * dt;
      this.dirty = true;
    }

    let speed = scene.limits.speed * fast;
    const delta = this._delta.set(0, 0, 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    if (forward || strafe) {
      const len = Math.hypot(forward, strafe);
      if (len > 1) {
        forward /= len;
        strafe /= len;
      }
      delta.x += (-sin * forward + cos * strafe) * speed * dt;
      delta.z += (-cos * forward - sin * strafe) * speed * dt;
    }
    if (Math.abs(this.wheelImpulse) > 0.002) {
      const push = this.wheelImpulse * Math.min(1, dt * 9);
      this.wheelImpulse -= push;
      delta.x += -sin * push * scene.limits.speed * 0.45;
      delta.z += -cos * push * scene.limits.speed * 0.45;
    } else {
      this.wheelImpulse = 0;
    }
    if (this.glide) {
      const gx = this.glide.x - this.pos.x;
      const gz = this.glide.z - this.pos.z;
      const dist = Math.hypot(gx, gz);
      const stepLen = Math.min(dist, speed * 1.25 * dt);
      if (dist < 0.04) this.glide = null;
      else {
        delta.x += (gx / dist) * stepLen;
        delta.z += (gz / dist) * stepLen;
      }
    }

    if (delta.x !== 0 || delta.z !== 0) {
      const before = this._next.copy(this.pos);
      const status = scene.move(this.pos, delta, this.pos);
      const progressed = before.distanceToSquared(this.pos) > 1e-10;
      if (this.glide && !progressed && ++this.glide.stalled > 3) this.glide = null;
      if (status === "edge" && now - this.lastEdge > 400) {
        this.lastEdge = now;
        if (this.hooks.onEdge) this.hooks.onEdge();
      }
      if (progressed) this.dirty = true;
    }

    // --- view direction, kept on the photographed part of the room
    const halfV = (this.camera.fov * DEG) / 2;
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    const range = scene.lookRange(this.pos, halfH, halfV, 13 * DEG);
    this.targetYaw = clamp(this.targetYaw, scene.baseYaw + range.yawMin, scene.baseYaw + range.yawMax);
    this.targetPitch = clamp(this.targetPitch, scene.basePitch + range.pitchMin, scene.basePitch + range.pitchMax);
    const blend = 1 - Math.exp(-dt * 16);
    const dy = this.targetYaw - this.yaw;
    const dp = this.targetPitch - this.pitch;
    if (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5) {
      this.yaw += dy * blend;
      this.pitch += dp * blend;
      this.dirty = true;
    }

    if (!this.dirty) return;
    this.dirty = false;
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.renderer.render(this.world, this.camera);
    this.frames = (this.frames || 0) + 1;
  }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.scene) this.camera.fov = this.scene.viewFov(w / h) / DEG;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
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
    let space = "local-floor";
    try {
      await session.requestReferenceSpace("local-floor");
    } catch (e) {
      space = "local";
    }
    this.xrFloor = space === "local-floor";
    this.renderer.xr.setReferenceSpaceType(space);
    await this.renderer.xr.setSession(session);
    this.stopAuto();
    this.xrYaw = this.scene.baseYaw;
    session.addEventListener("select", () => this.next());
    session.addEventListener("squeeze", () => this.previous());
    session.addEventListener("end", () => {
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      if (this.hooks.onXr) this.hooks.onXr(false);
      this.resize();
    });
    if (this.hooks.onXr) this.hooks.onXr(true);
  }

  _xrStep(dt, frame) {
    const scene = this.scene;
    const rig = this.rig;
    // The real floor is placed at the photographed floor; the real head moves freely above it.
    rig.position.set(this.pos.x, this.xrFloor ? -(scene.eyeHeight || 1.5) : 0, this.pos.z);
    rig.rotation.set(0, this.xrYaw, 0);

    const session = frame && frame.session;
    if (!session) return;
    let moveX = 0;
    let moveY = 0;
    let turn = 0;
    for (const source of session.inputSources) {
      const pad = source.gamepad;
      if (!pad || pad.axes.length < 4) continue;
      const x = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
      const y = Math.abs(pad.axes[3]) > 0.15 ? pad.axes[3] : 0;
      if (source.handedness === "right" && session.inputSources.length > 1) turn += x;
      else {
        moveX += x;
        moveY += -y;
      }
    }
    // Snap turns are far more comfortable in a headset than smooth rotation.
    if (Math.abs(turn) > 0.7 && this.xrSnapReady) {
      this.xrYaw -= Math.sign(turn) * 30 * DEG;
      this.xrSnapReady = false;
    } else if (Math.abs(turn) < 0.3) {
      this.xrSnapReady = true;
    }
    if (!moveX && !moveY) return;

    const xrCamera = this.renderer.xr.getCamera();
    const head = this._head.setFromMatrixPosition(xrCamera.matrixWorld);
    const look = this._dir.set(0, 0, -1).transformDirection(xrCamera.matrixWorld);
    const heading = Math.atan2(-look.x, -look.z);
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const speed = scene.limits.speed * 0.8 * dt;
    const delta = this._delta.set((-sin * moveY + cos * moveX) * speed, 0, (-cos * moveY - sin * moveX) * speed);
    const before = this._next.copy(head);
    scene.move(head, delta, head);
    this.pos.x += head.x - before.x;
    this.pos.z += head.z - before.z;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    if (this.scene) this.scene.dispose();
    this.renderer.dispose();
  }
}

TourViewer.MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);
