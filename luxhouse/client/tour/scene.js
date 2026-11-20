/**
 * One explorable space: a mesh rebuilt from a photograph and textured by
 * projecting that photograph back onto it, plus the rules that keep the
 * visitor where the picture still looks like the real room.
 *
 * Realism rules (learned on real rooms):
 *  - The mesh is continuous. Cutting it at furniture edges tears the picture
 *    as soon as the visitor moves; letting it stretch reads as a soft edge.
 *  - The visitor never sees outside what the photograph shows: the view
 *    direction and the standing position are limited so the picture always
 *    fills the screen.
 *  - Movement is limited to the range in which that stretching stays modest.
 *    The range is measured per photograph.
 */

import {
  BackSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  Vector3,
} from "three";
import { buildGeometry, decodeGeo } from "./geo.js";

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The photograph is the texture: every fragment looks up the pixel the original
// camera saw along the same ray, so from the original viewpoint the render is
// exactly the photo, whatever the mesh resolution.
const PROJECT_VERTEX = /* glsl */ `
  varying vec3 vCam;
  void main() {
    vCam = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PROJECT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform vec2 focal;
  uniform vec2 texel; // picture size in pixels
  varying vec3 vCam;
  void main() {
    float z = max(-vCam.z, 1e-4);
    vec2 uv = vec2(focal.x * vCam.x / z + 0.5, 0.5 + focal.y * vCam.y / z);
    // Where the surface is stretched across a gap (behind the edge of a nearer object) one
    // column of the picture would be pulled into streaks. Reading a softer copy of the picture
    // there turns the streaks into a quiet blur.
    vec2 dx = dFdx(uv) * texel;
    vec2 dy = dFdy(uv) * texel;
    float a = dot(dx, dx);
    float b = dot(dx, dy);
    float c = dot(dy, dy);
    float mid = 0.5 * (a + c);
    float spread = sqrt(max(mid * mid - (a * c - b * b), 0.0));
    float longest = mid + spread;
    float shortest = max(mid - spread, 1e-8);
    float stretch = 0.5 * log2(longest / shortest); // 0 where the picture is shown undistorted
    float soften = clamp(stretch - 1.2, 0.0, 6.0);
    gl_FragColor = vec4(texture2D(map, clamp(uv, 0.0, 1.0), soften).rgb, 1.0);
  }
`;

// Safety net behind the mesh (normally never on screen): a soft copy of the picture.
const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform vec2 halfFov;
  varying vec3 vCam;
  float mirror(float t) { return 1.0 - abs(mod(t, 2.0) - 1.0); }
  void main() {
    vec3 d = normalize(vCam);
    float yaw = atan(d.x, -d.z);
    float pitch = asin(clamp(d.y, -1.0, 1.0));
    vec2 uv = vec2(0.5 + 0.5 * yaw / halfFov.x, 0.5 + 0.5 * pitch / halfFov.y);
    float away = length(max(abs(uv - 0.5) - 0.5, 0.0));
    vec3 colour = texture2D(map, vec2(mirror(uv.x), mirror(uv.y)), 6.0).rgb;
    gl_FragColor = vec4(colour * mix(0.9, 0.25, smoothstep(0.0, 0.8, away)), 1.0);
  }
`;

function loadTexture(loader, url, anisotropy) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        // Shown as-is: no colour-space conversion on the way in or out.
        texture.colorSpace = NoColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = anisotropy;
        resolve(texture);
      },
      undefined,
      () => reject(new Error("Could not load " + url))
    );
  });
}

function percentile(values, count, p) {
  if (!count) return 0;
  const sorted = Float32Array.prototype.slice.call(values, 0, count).sort();
  return sorted[Math.min(count - 1, Math.max(0, Math.floor(p * (count - 1))))];
}

export class TourScene {
  /**
   * @param meta   scene entry from tour.json
   * @param base   URL of the tour folder (ends with "/")
   */
  constructor(meta, base) {
    this.meta = meta;
    this.url = base + meta.base;
    this.group = new Group();
    this.ready = false;
    this.disposed = false;

    this.fx = meta.fx;
    this.fy = meta.fy;
    this.tanH = 0.5 / meta.fx; // tangent of half the photograph's horizontal field of view
    this.tanV = 0.5 / meta.fy;
    this.hfov = 2 * Math.atan(this.tanH);
    this.vfov = 2 * Math.atan(this.tanV);
    this.depthMedian = meta.depth.depthMedian;
    this.eyeHeight = typeof meta.eyeHeight === "number" && meta.eyeHeight > 0.6 && meta.eyeHeight < 4 ? meta.eyeHeight : null;

    // Rotate camera space so that gravity points down the world's −y axis.
    const up = new Vector3(meta.up[0], -meta.up[1], -meta.up[2]).normalize();
    this.toWorld = new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0));
    this.toCamera = this.toWorld.clone().invert();
    this.group.quaternion.copy(this.toWorld);

    // Orientation of the original photograph in world space.
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.toWorld);
    this.baseYaw = Math.atan2(-forward.x, -forward.z);
    this.basePitch = Math.asin(clamp(forward.y, -1, 1));

    // Half-angles of the visitor's view; the viewer keeps these current.
    this.viewHalfH = 0.6;
    this.viewHalfV = 0.4;
    // Provisional until the depth grid is loaded and measured.
    this.limits = { side: 0.15, forward: 0.5, back: 0.1, lift: 0.08, speed: 0.5 };
    this._tmp = new Vector3();
  }

  async load(renderer, detail) {
    const loader = new TextureLoader();
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const [geoBuffer, colour] = await Promise.all([
      fetch(this.url + "geo.bin").then((res) => {
        if (!res.ok) throw new Error("Could not load geometry (" + res.status + ")");
        return res.arrayBuffer();
      }),
      loadTexture(loader, this.url + "color.webp", anisotropy),
    ]);
    if (this.disposed) {
      colour.dispose();
      return this;
    }

    const geo = decodeGeo(geoBuffer);
    this.geo = geo;
    this._measure();

    const step = detail === "low" ? 2 : 1;
    const front = buildGeometry(geo.front, geo.gw, geo.gh, this.fx, this.fy, step);
    this.frontMesh = new Mesh(
      front.geometry,
      new ShaderMaterial({
        uniforms: {
          map: { value: colour },
          focal: { value: { x: this.fx, y: this.fy } },
          texel: { value: { x: colour.image.width, y: colour.image.height } },
        },
        vertexShader: PROJECT_VERTEX,
        fragmentShader: PROJECT_FRAGMENT,
      })
    );
    this.frontMesh.frustumCulled = false;
    this.frontMesh.renderOrder = 1;

    this.backdrop = new Mesh(
      new SphereGeometry(geo.skyDistance * 1.5, 48, 32),
      new ShaderMaterial({
        uniforms: { map: { value: colour }, halfFov: { value: { x: this.hfov / 2, y: this.vfov / 2 } } },
        vertexShader: PROJECT_VERTEX,
        fragmentShader: BACKDROP_FRAGMENT,
        side: BackSide,
        depthWrite: false,
      })
    );
    this.backdrop.renderOrder = 0;
    this.backdrop.frustumCulled = false;

    this.group.add(this.backdrop, this.frontMesh);
    this.far = geo.skyDistance * 1.6;
    this.near = clamp(geo.near * 0.2, 0.02, 0.1);
    this.stats = { triangles: front.triangles, step };
    this.textures = [colour];
    this.ready = true;
    return this;
  }

  dispose() {
    this.disposed = true;
    if (!this.ready) return;
    for (const mesh of [this.frontMesh, this.backdrop]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const texture of this.textures) texture.dispose();
    this.group.clear();
    this.ready = false;
  }

  /**
   * Measure the photograph: how near its content comes at each edge of the frame, and how
   * far the visitor can move before the stretching at depth edges becomes noticeable.
   */
  _measure() {
    const { gw, gh, front: d } = this.geo;
    const buf = new Float32Array(gw * gh);
    const band = (x0, x1, y0, y1) => {
      let n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) buf[n++] = d[y * gw + x];
      return Math.max(0.2, percentile(buf, n, 0.06));
    };
    const bw = Math.max(4, Math.round(gw * 0.06));
    const bh = Math.max(4, Math.round(gh * 0.06));
    this.edgeNear = {
      left: band(0, bw, 0, gh),
      right: band(gw - bw, gw, 0, gh),
      top: band(0, gw, 0, bh),
      bottom: band(0, gw, gh - bh, gh),
    };

    // Depth edges: (1/near − 1/far) is how fast the two sides of an edge separate per metre of
    // sideways movement; weighted by the distance from the picture's centre it is the same for
    // a step forward. The gap that opens is filled by the background next to it, stretched.
    let n = 0;
    const lateral = new Float32Array(Math.ceil((gw * gh) / 4) + 8);
    const forward = new Float32Array(lateral.length);
    for (let y = 1; y < gh - 1; y += 2) {
      const yn = (y / (gh - 1) - 0.5) / this.fy;
      for (let x = 1; x < gw - 1; x += 2) {
        const a = d[y * gw + x];
        const b = d[y * gw + x + 1];
        const c = d[(y + 1) * gw + x];
        const rel = Math.max(Math.abs(a - b), Math.abs(a - c)) / Math.min(a, b, c);
        if (rel < 0.1) continue;
        const jump = Math.max(Math.abs(1 / a - 1 / b), Math.abs(1 / a - 1 / c));
        const xn = (x / (gw - 1) - 0.5) / this.fx;
        lateral[n] = jump;
        forward[n] = jump * Math.hypot(xn, yn);
        n++;
      }
    }
    // Widest gap allowed at the worst few edges, as a share of the picture's width. A step
    // forward may open a little more: its gaps lie towards the rim of the view.
    const GAP = 0.03;
    const edgeShare = n / ((gw * gh) / 4);
    const gLat = edgeShare > 0.0015 ? percentile(lateral, n, 0.93) : 0;
    const gFwd = edgeShare > 0.0015 ? percentile(forward, n, 0.93) : 0;
    const side = gLat > 0 ? GAP / (this.fx * gLat) : 1;
    const fwd = gFwd > 0 ? (GAP * 1.6) / (this.fx * gFwd) : 2;
    const nearest = Math.min(this.edgeNear.left, this.edgeNear.right, this.edgeNear.bottom);
    // Walking up to something enlarges it beyond what the photograph can show sharply, and
    // walking past what stands at the rim of the frame leaves the picture: stop well short of both.
    let m = 0;
    for (let y = Math.round(gh * 0.2); y < gh * 0.8; y += 2) for (let x = Math.round(gw * 0.2); x < gw * 0.8; x += 2) buf[m++] = d[y * gw + x];
    const nearCentre = Math.max(0.3, percentile(buf, m, 0.08));
    this.limits = {
      side: clamp(side, 0.05, Math.min(0.6, 0.3 * nearest)),
      forward: clamp(fwd, 0.15, Math.min(2.5, 0.4 * this.depthMedian, 0.3 * nearCentre, 0.5 * nearest)),
      back: clamp(side * 0.6, 0.03, 0.25),
      lift: clamp(side * 0.5, 0.03, 0.15),
      speed: 0,
    };
    this.limits.speed = clamp(this.limits.forward * 0.9, 0.3, 1.2);
    this.measured = { gLat, gFwd, edgeShare };
  }

  // ---------------------------------------------------------------- where may the visitor stand?

  /** Depth of the photographed surface along the ray through a camera-space point, or −1 if out of frame. */
  surfaceDepthAt(x, y, z) {
    const depth = -z;
    if (depth <= 1e-3) return -1;
    const u = (this.fx * x) / depth + 0.5;
    const v = 0.5 - (this.fy * y) / depth;
    if (u < 0 || u > 1 || v < 0 || v > 1) return -1;
    const geo = this.geo;
    const gx = Math.round(u * (geo.gw - 1));
    const gy = Math.round(v * (geo.gh - 1));
    return geo.front[gy * geo.gw + gx];
  }

  /** True when a world-space point is in space the photograph shows to be empty (or cannot judge). */
  isFree(world) {
    const p = this._tmp.copy(world).applyQuaternion(this.toCamera);
    const surface = this.surfaceDepthAt(p.x, p.y, p.z);
    if (surface < 0) return true; // outside the frame: unknown, handled by the outer limits
    return -p.z < surface - (0.05 + 0.02 * surface);
  }

  /**
   * Can the visitor's eyes be at `world`?
   * Returns "ok", "edge" (the picture would no longer fill the view) or "blocked" (furniture, a wall).
   */
  canStandAt(world) {
    const p = this._tmp.copy(world).applyQuaternion(this.toCamera);
    const forward = -p.z;
    const L = this.limits;
    if (forward < -L.back - 1e-6 || forward > L.forward + 1e-6) return "edge";
    if (Math.abs(p.x) > L.side + 1e-6) return "edge";
    if (Math.abs(p.y) > L.lift + 1e-6) return "edge";
    const range = this._range(p.x, p.y, p.z);
    if (range.yawMax < range.yawMin || range.pitchMax < range.pitchMin) return "edge";

    // The body is a column from the eyes down towards the floor; all of it must be in visibly empty space.
    const heights = this.eyeHeight ? [0, -0.4 * this.eyeHeight, -0.75 * this.eyeHeight] : [0];
    const r = 0.25;
    const probe = TourScene._probe;
    for (const h of heights) {
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI) / 4;
        const rr = i === 8 ? 0 : r;
        probe.set(world.x + Math.cos(a) * rr, world.y + h, world.z + Math.sin(a) * rr);
        if (!this.isFree(probe)) return "blocked";
      }
    }
    return "ok";
  }

  /**
   * Move from `from` by `delta` (world space), sliding along limits and obstacles.
   * Returns the status of the attempted move.
   */
  move(from, delta, out) {
    const target = TourScene._target.copy(from).add(delta);
    const first = this.canStandAt(target);
    if (first === "ok") {
      out.copy(target);
      return "ok";
    }
    target.set(from.x + delta.x, from.y, from.z);
    if (delta.x !== 0 && this.canStandAt(target) === "ok") {
      out.copy(target);
      return first;
    }
    target.set(from.x, from.y, from.z + delta.z);
    if (delta.z !== 0 && this.canStandAt(target) === "ok") {
      out.copy(target);
      return first;
    }
    out.copy(from);
    return first;
  }

  /**
   * View directions, relative to the photograph's own, for which the picture fills the whole
   * view from the camera-space eye position (px, py, pz). An empty range means it cannot.
   *
   * Each edge of the frame is a plane through the original camera. Content at depth D on the
   * left edge sits at x = −tanH·D; seen from a moved eye its direction changes, most for the
   * nearest content. The view's own edge has to stay inside both that and the far limit.
   */
  _range(px, py, pz) {
    const E = this.edgeNear;
    const fwd = -pz;
    const dir = (offset, depth) => Math.atan2(offset, Math.max(0.05, depth - fwd));
    const left = Math.max(dir(-this.tanH * E.left - px, E.left), -Math.atan(this.tanH));
    const right = Math.min(dir(this.tanH * E.right - px, E.right), Math.atan(this.tanH));
    const down = Math.max(dir(-this.tanV * E.bottom - py, E.bottom), -Math.atan(this.tanV));
    const top = Math.min(dir(this.tanV * E.top - py, E.top), Math.atan(this.tanV));
    // Yaw grows to the left in three.js; the picture's x grows to the right.
    return {
      yawMin: -(right - this.viewHalfH),
      yawMax: -(left + this.viewHalfH),
      pitchMin: down + this.viewHalfV,
      pitchMax: top - this.viewHalfV,
    };
  }

  /**
   * As _range, for a world-space eye position and the current view direction (offsets from the
   * photograph's own direction). A turned view is wider at its corners, so each axis is
   * tightened by how far the other one is turned.
   */
  lookRange(world, yawOffset, pitchOffset) {
    const p = this._tmp.copy(world).applyQuaternion(this.toCamera);
    const h = this.viewHalfH;
    const v = this.viewHalfV;
    const limit = 1.45; // radians: keeps the cosines below well away from zero
    const kH = Math.cos(v) / Math.cos(Math.min(limit, v + Math.abs(pitchOffset || 0)));
    const kV = Math.cos(h) / Math.cos(Math.min(limit, h + Math.abs(yawOffset || 0)));
    this.viewHalfH = Math.atan(Math.tan(h) * kH);
    this.viewHalfV = Math.atan(Math.tan(v) * kV);
    const range = this._range(p.x, p.y, p.z);
    this.viewHalfH = h;
    this.viewHalfV = v;
    if (range.yawMax < range.yawMin) range.yawMin = range.yawMax = (range.yawMin + range.yawMax) / 2;
    if (range.pitchMax < range.pitchMin) range.pitchMin = range.pitchMax = (range.pitchMin + range.pitchMax) / 2;
    return range;
  }

  /**
   * First surface hit by a world-space ray from `origin` along unit `dir`
   * (marching through the depth grid, then closing in on the crossing).
   * Returns the hit point or null.
   */
  raycast(origin, dir, out) {
    const o = TourScene._target.copy(origin).applyQuaternion(this.toCamera);
    const d = TourScene._probe.copy(dir).applyQuaternion(this.toCamera);
    const max = this.geo.skyDistance * 0.9;
    const behind = (t) => {
      const z = o.z + d.z * t;
      const surface = this.surfaceDepthAt(o.x + d.x * t, o.y + d.y * t, z);
      return surface > 0 && -z >= surface ? surface : 0;
    };
    let before = 0;
    let t = 0.1;
    for (let i = 0; i < 260 && t < max; i++) {
      const surface = behind(t);
      if (surface) {
        if (surface >= this.geo.skyDistance * 0.99) return null; // the sky is not a place
        let lo = before;
        let hi = t;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          if (behind(mid)) hi = mid;
          else lo = mid;
        }
        out.set(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi).applyQuaternion(this.toWorld);
        return out;
      }
      before = t;
      t += Math.max(0.03, t * 0.03);
    }
    return null;
  }

  /**
   * As raycast, and also gives the direction the surface faces (unit vector towards the
   * visitor), measured from the depth grid around the hit.
   */
  surfaceAt(origin, dir, outPoint, outNormal) {
    if (!this.raycast(origin, dir, outPoint)) return null;
    const { gw, gh, front } = this.geo;
    const p = this._tmp.copy(outPoint).applyQuaternion(this.toCamera);
    const depth = Math.max(1e-3, -p.z);
    const k = Math.max(3, Math.round(gw / 110));
    const gx = clamp(Math.round(((this.fx * p.x) / depth + 0.5) * (gw - 1)), k, gw - 1 - k);
    const gy = clamp(Math.round((0.5 - (this.fy * p.y) / depth) * (gh - 1)), k, gh - 1 - k);
    const at = (x, y, v) => {
      const dd = front[y * gw + x];
      return v.set(((x / (gw - 1) - 0.5) / this.fx) * dd, (-(y / (gh - 1) - 0.5) / this.fy) * dd, -dd);
    };
    const a = at(gx + k, gy, TourScene._a).sub(at(gx - k, gy, TourScene._b));
    const b = at(gx, gy - k, TourScene._b).sub(at(gx, gy + k, TourScene._c));
    const n = outNormal.copy(a).cross(b);
    const eye = TourScene._target.copy(origin).applyQuaternion(this.toCamera).sub(p).normalize();
    if (n.lengthSq() < 1e-12) n.copy(eye);
    else n.normalize();
    if (n.dot(eye) < 0) n.negate();
    // At the rim of furniture the grid spans two surfaces and the measured direction is
    // meaningless: there, face the visitor instead.
    if (n.dot(eye) < 0.12) n.copy(eye);
    n.applyQuaternion(this.toWorld);
    return outPoint;
  }

  /**
   * Widest vertical field of view (radians) for a screen of the given aspect ratio: the view
   * shows as much of the photograph as fits, with a margin so the visitor can lean without
   * reaching its edge. Zooming in from here gives room to look around.
   */
  viewFov(aspect) {
    const ROOM = 0.88; // share of the photograph's width or height the widest view may span
    const cap = (aspect >= 1 ? 64 : 76) * DEG;
    const tanHalf = Math.min(Math.tan(cap / 2), this.tanV * ROOM, (this.tanH * ROOM) / aspect);
    return 2 * Math.atan(tanHalf);
  }

  setView(halfH, halfV) {
    this.viewHalfH = halfH;
    this.viewHalfV = halfV;
  }
}

TourScene._probe = new Vector3();
TourScene._target = new Vector3();
TourScene._a = new Vector3();
TourScene._b = new Vector3();
TourScene._c = new Vector3();
