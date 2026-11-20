/**
 * One explorable space: the meshes rebuilt from a photograph, textured by
 * projecting that photograph back onto them, plus the rules for where a
 * visitor may stand.
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
  uniform float opacity;
  varying vec3 vCam;
  void main() {
    float z = max(-vCam.z, 1e-4);
    vec2 uv = vec2(focal.x * vCam.x / z + 0.5, 0.5 + focal.y * vCam.y / z);
    gl_FragColor = vec4(texture2D(map, clamp(uv, 0.0, 1.0)).rgb, opacity);
  }
`;

// Everything the photograph never saw: a soft, darkened continuation of its
// edges so the surroundings read as "out of frame" rather than as a hole.
const DOME_FRAGMENT = /* glsl */ `
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
    vec2 outside = max(abs(uv - 0.5) - 0.5, 0.0);
    float away = length(outside);
    // Inside the frame this only shows through gaps: a soft copy of the picture is the kindest filler.
    // Outside the frame it darkens, so the edge of the photographed area reads as an edge.
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
    vec3 colour = texture2D(map, vec2(mirror(uv.x), mirror(uv.y)), 6.0).rgb;
    float fade = mix(0.82, 0.40, smoothstep(0.44, 0.56, edge));
    fade = mix(fade, 0.10, smoothstep(0.0, 1.2, away));
    gl_FragColor = vec4(colour * fade, 1.0);
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
    this.hfov = 2 * Math.atan(0.5 / meta.fx);
    this.vfov = 2 * Math.atan(0.5 / meta.fy);
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
    this.basePitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));

    // How far a visitor may wander from the camera position (metres).
    const d = this.depthMedian;
    this.limits = {
      radius: Math.min(4, Math.max(0.6, 0.45 * d)),
      back: Math.min(1, Math.max(0.3, 0.2 * d)),
      side: Math.min(1.2, Math.max(0.4, 0.25 * d)),
      speed: Math.min(2.4, Math.max(0.8, 0.45 * d)),
    };
    this._tmp = new Vector3();
  }

  async load(renderer, detail) {
    const loader = new TextureLoader();
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const [geoBuffer, colour, hiddenColour] = await Promise.all([
      fetch(this.url + "geo.bin").then((res) => {
        if (!res.ok) throw new Error("Could not load geometry (" + res.status + ")");
        return res.arrayBuffer();
      }),
      loadTexture(loader, this.url + "color.webp", anisotropy),
      loadTexture(loader, this.url + "bg.webp", anisotropy),
    ]);
    if (this.disposed) {
      colour.dispose();
      hiddenColour.dispose();
      return this;
    }

    const geo = decodeGeo(geoBuffer);
    this.geo = geo;
    const step = detail === "low" ? 2 : 1;

    const focal = { value: { x: this.fx, y: this.fy } };
    const material = (map) =>
      new ShaderMaterial({
        uniforms: { map: { value: map }, focal, opacity: { value: 1 } },
        vertexShader: PROJECT_VERTEX,
        fragmentShader: PROJECT_FRAGMENT,
      });

    const front = buildGeometry(geo.front, geo.gw, geo.gh, this.fx, this.fy, step, geo.cut, geo.hidden);
    const hidden = buildGeometry(geo.hidden, geo.gw, geo.gh, this.fx, this.fy, step, geo.cut * 2.5);

    const frontMaterial = material(colour);
    this.frontMesh = new Mesh(front.geometry, frontMaterial);
    this.seamMesh = new Mesh(front.seams.geometry, frontMaterial);
    this.hiddenMesh = new Mesh(hidden.geometry, material(hiddenColour));
    // The meshes are bounded by the photograph's own frustum, which is always in view.
    this.frontMesh.frustumCulled = this.seamMesh.frustumCulled = this.hiddenMesh.frustumCulled = false;
    // Draw order: surroundings, then the hidden layer, then the photograph's own surfaces.
    this.hiddenMesh.renderOrder = 1;
    this.seamMesh.renderOrder = 2;
    this.frontMesh.renderOrder = 3;

    const dome = new Mesh(
      new SphereGeometry(geo.skyDistance * 1.5, 48, 32),
      new ShaderMaterial({
        uniforms: { map: { value: colour }, halfFov: { value: { x: this.hfov / 2, y: this.vfov / 2 } } },
        vertexShader: PROJECT_VERTEX,
        fragmentShader: DOME_FRAGMENT,
        side: BackSide,
        depthWrite: false,
      })
    );
    dome.renderOrder = 0;
    dome.frustumCulled = false;
    this.dome = dome;

    this.group.add(dome, this.hiddenMesh, this.seamMesh, this.frontMesh);
    this.far = geo.skyDistance * 1.6;
    this.near = Math.max(0.03, Math.min(0.1, geo.near * 0.2));
    this.stats = { triangles: front.triangles + front.seams.triangles + hidden.triangles, seams: front.seams.triangles, step };
    this.textures = [colour, hiddenColour];
    this.ready = true;
    return this;
  }

  dispose() {
    this.disposed = true;
    if (!this.ready) return;
    for (const mesh of [this.frontMesh, this.seamMesh, this.hiddenMesh, this.dome]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const texture of this.textures) texture.dispose();
    this.group.clear();
    this.ready = false;
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
    const depth = -p.z;
    return depth < surface - (0.05 + 0.02 * surface);
  }

  /**
   * Can the visitor's eyes be at `world`?
   * Returns "ok", "edge" (outside the captured area) or "blocked" (furniture, a wall).
   */
  canStandAt(world) {
    const p = this._tmp.copy(world).applyQuaternion(this.toCamera);
    const forward = -p.z;
    const L = this.limits;
    if (forward < -L.back) return "edge";
    if (Math.hypot(p.x, forward, p.y) > L.radius) return "edge";
    const reach = L.side + Math.max(0, forward) * Math.tan(this.hfov / 2) * 0.75;
    if (Math.abs(p.x) > reach) return "edge";

    // The body is a column from the eyes down towards the floor; all of it must be in visibly empty space.
    const heights = this.eyeHeight ? [0, -0.4 * this.eyeHeight, -0.75 * this.eyeHeight] : [0];
    const r = 0.28;
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
   * Move from `from` by `delta` (world space, horizontal), sliding along obstacles.
   * Returns the status of the attempted move.
   */
  move(from, delta, out) {
    const target = TourScene._target.copy(from).add(delta);
    let status = this.canStandAt(target);
    if (status === "ok") {
      out.copy(target);
      return "ok";
    }
    // Slide: try each horizontal axis on its own.
    const first = status;
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
   * Range of view directions (relative to the photograph's own direction) that keep
   * the picture on screen, for an eye at `world` and a view of the given half-angles.
   */
  lookRange(world, halfH, halfV, slack) {
    const p = this._tmp.copy(world).applyQuaternion(this.toCamera);
    const ref = Math.max(this.depthMedian, 0.5);
    const dz = Math.max(0.3, ref + p.z); // distance from the eye to the reference depth
    const halfX = (0.5 / this.fx) * ref;
    const halfY = (0.5 / this.fy) * ref;
    const left = Math.atan2(-halfX - p.x, dz);
    const right = Math.atan2(halfX - p.x, dz);
    const down = Math.atan2(-halfY - p.y, dz);
    const top = Math.atan2(halfY - p.y, dz);
    const span = (lo, hi, half) => {
      let a = lo + half - slack;
      let b = hi - half + slack;
      if (a > b) {
        const mid = (lo + hi) / 2;
        a = mid - slack * 0.5;
        b = mid + slack * 0.5;
      }
      return [a, b];
    };
    const [yawMin, yawMax] = span(left, right, halfH);
    const [pitchMin, pitchMax] = span(down, top, halfV);
    // Yaw grows to the left in three.js, the picture's x grows to the right.
    return { yawMin: -yawMax, yawMax: -yawMin, pitchMin, pitchMax };
  }

  /**
   * First surface hit by a world-space ray from `origin` along unit `dir`
   * (marching through the depth grid). Returns the hit point or null.
   */
  raycast(origin, dir, out) {
    const o = TourScene._target.copy(origin).applyQuaternion(this.toCamera);
    const d = TourScene._probe.copy(dir).applyQuaternion(this.toCamera);
    const max = this.geo.skyDistance * 0.9;
    let t = 0.1;
    for (let i = 0; i < 260 && t < max; i++) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      const surface = this.surfaceDepthAt(x, y, z);
      if (surface > 0 && -z >= surface) {
        if (surface >= this.geo.skyDistance * 0.99) return null; // the sky is not a place
        out.set(x, y, z).applyQuaternion(this.toWorld);
        return out;
      }
      t += Math.max(0.03, t * 0.03);
    }
    return null;
  }

  /** Vertical field of view (radians) that suits this photograph on a screen of the given aspect ratio. */
  viewFov(aspect) {
    let vfov = (aspect >= 1 ? 52 : 72) * DEG;
    vfov = Math.min(vfov, this.vfov * 0.96);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    if (hfov > this.hfov * 0.96) vfov = 2 * Math.atan(Math.tan((this.hfov * 0.96) / 2) / aspect);
    return vfov;
  }
}

TourScene._probe = new Vector3();
TourScene._target = new Vector3();
