/**
 * A generated room the visitor walks through like a person.
 *
 * What is seen is a cloud of Gaussian splats (a whole room, generated from the listing
 * photographs by a world model); what is walked on is a collider mesh of the same room.
 * This file loads both, puts them in one metric, y-up frame, and answers the questions the
 * viewer asks while the visitor walks: where is the floor, what is in the way, what is under
 * the pointer, and how do I get from here to there around the furniture.
 *
 * It is loaded only when a tour has such a room (the splat renderer is large).
 *
 * A scene's `world` entry:
 *   splat, splatLow?   the splat file (and a lighter one for phones), relative to the scene folder;
 *                      may point into another scene's folder ("../06/world.spz")
 *   collider           GLB mesh of everything solid, same coordinates as the splats
 *   convention?        "three" (default): y up, metres, floor at y = `ground` (0);
 *                      "opencv": camera convention (+y down, +z forward), the model's own units,
 *                      the photograph's camera at the origin; `scale` turns the units into
 *                      metres and the floor is found from the mesh (`ground` is a hint)
 *   start?             { position, quaternion }: the photograph's camera in the room. The scene
 *                      opens exactly there, looking the same way
 *   eye?               walking eye height in metres (default 1.6, or the camera's own height
 *                      when that is a height a person stands at)
 *   radius?            the visitor's body radius against this collider (default 0.24; small
 *                      when the collider is already grown by a body's width)
 *   bounds?            { min, max }: the room; the visitor does not leave it
 *
 * Two scenes may show one room from two photographs: the room is loaded once and shared.
 * Whatever the convention, the viewer works in metres, y up, floor at y = 0.
 */

import { Box3, BufferAttribute, BufferGeometry, DoubleSide, Group, Line3, Quaternion, Ray, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshBVH } from "three-mesh-bvh";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const RADIUS = 0.24; // the visitor's body, metres
export const STEP = 0.25; // the highest edge they step over without noticing
const DROP = 0.5; // the deepest step down
const HEAD = 0.1; // room above the eyes
const EYE = 1.6; // eye height when the room does not say
const CELL = 0.12; // grid used to find a way around furniture
const REACH = 30; // metres: how far a click may send the visitor
const MANY = 900000; // splats: above this a room can be thinned for a machine that struggles
const LIGHT = 600000; // splats drawn on a phone from a room that has no lighter file

const vec3 = (a) => (Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every(Number.isFinite) ? a : null);

/** The renderer that draws every splat room of a tour. `onDirty` asks for another frame. */
export function createSplatRenderer(renderer, onDirty) {
  return new SparkRenderer({ renderer, onDirty });
}

/** The tour is over: free every room still held (the one kept for a step back included). */
export function closeRooms() {
  for (const room of Array.from(rooms.values())) room.destroy();
}

/** Download a file on the page's own fetch (never from a worker), reporting the share received. */
async function fetchBytes(url, onShare) {
  const res = await window.fetch(url);
  if (!res.ok) throw new Error("Could not load " + url + " (" + res.status + ")");
  const total = Number(res.headers && res.headers.get("Content-Length")) || 0;
  const encoded = res.headers && res.headers.get("Content-Encoding");
  if (!res.body || !res.body.getReader || !total || (encoded && encoded !== "identity")) {
    const buffer = await res.arrayBuffer();
    onShare(1);
    return new Uint8Array(buffer);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onShare(Math.min(1, received / total));
  }
  const bytes = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  onShare(1);
  return bytes;
}

function within(promise, ms, message) {
  let timer;
  const late = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Smallest-first queue for the path search. */
class Heap {
  constructor() {
    this.keys = [];
    this.values = [];
  }
  get size() {
    return this.keys.length;
  }
  push(key, value) {
    const { keys, values } = this;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      values[i] = values[parent];
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }
  pop() {
    const { keys, values } = this;
    const top = values[0];
    const key = keys.pop();
    const value = values.pop();
    const n = keys.length;
    if (n) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child];
        values[i] = values[child];
        i = child;
      }
      keys[i] = key;
      values[i] = value;
    }
    return top;
  }
}

// ---------------------------------------------------------------------------------------------
// A room: its splats and its collider, shared by every scene that shows it.
// ---------------------------------------------------------------------------------------------

const rooms = new Map(); // key → Room, while a scene holds it or it is kept as the spare
let spare = null; // the room the visitor has just left, kept in case they step back

class Room {
  /** The room a scene's `world` entry describes: the one already open, or a new one. */
  static open(world, sceneUrl, detail) {
    const file = (detail === "low" && world.splatLow) || world.splat;
    const absolute = (path) => new URL(sceneUrl + path, window.location.href).href;
    const splatUrl = absolute(file);
    const colliderUrl = absolute(world.collider);
    const key = JSON.stringify([splatUrl, colliderUrl, world.convention || "three", world.scale || 1, world.ground == null ? null : world.ground, world.radius || 0, world.bounds || null]);
    let room = rooms.get(key);
    if (!room) {
      room = new Room(key, world, splatUrl, colliderUrl, detail);
      rooms.set(key, room);
    }
    if (spare === room) spare = null;
    room.refs++;
    return room;
  }

  constructor(key, world, splatUrl, colliderUrl, detail) {
    this.key = key;
    this.splatUrl = splatUrl;
    this.colliderUrl = colliderUrl;
    this.detail = detail;
    this.refs = 0;
    this.loading = null;
    this.ready = false;
    this.gone = false;
    this.listeners = new Set();

    this.flipped = world.convention === "opencv";
    this.scale = typeof world.scale === "number" && world.scale > 0.01 && world.scale < 100 ? world.scale : 1;
    this.ground = typeof world.ground === "number" && Number.isFinite(world.ground) ? world.ground : null;
    this.radius = typeof world.radius === "number" && world.radius >= 0.02 && world.radius <= 0.5 ? world.radius : RADIUS;
    const box = world.bounds && vec3(world.bounds.min) && vec3(world.bounds.max) ? world.bounds : null;
    this.limit = box ? new Box3(new Vector3().fromArray(box.min), new Vector3().fromArray(box.max)) : null;

    this.holder = new Group(); // the splats, turned and raised into the viewer's frame
    this.lift = 0;
    this.bodyTop = EYE + HEAD; // set by the scene on screen
    this.solid = true; // false when the collider is unusable: the visitor then moves freely inside its bounds
    this.bounds = new Box3();
    this.cells = new Map();
    this.budget = 0; // splats drawn at most; 0 = all of them
    this.thinning = null;
    this.large = false;
    this.inward = false; // the collider's faces look into what is solid rather than out of it

    this._ray = new Ray(new Vector3(), new Vector3(0, -1, 0));
    this._level = new Ray();
    this._seg = new Line3();
    this._box = new Box3();
    this._onTri = new Vector3();
    this._onSeg = new Vector3();
    this._try = new Vector3();
    this._heights = [];
  }

  /** A point or direction of the room's own files, in the viewer's frame (before the lift). */
  turned(v, isPoint) {
    const k = isPoint ? this.scale : 1;
    const t = this.flipped ? -1 : 1;
    return v.set(v.x * k, v.y * k * t, v.z * k * t);
  }

  /**
   * Download and prepare the room, once; later calls wait for the same work.
   * `camera` is the first scene's photograph position (the room's own coordinates): the floor
   * is looked for under it.
   */
  load(camera, onProgress) {
    if (onProgress) this.listeners.add(onProgress);
    if (!this.loading) {
      this.loading = this._load(camera).then(
        () => {
          this.ready = !this.gone;
          this.listeners.clear();
          return this;
        },
        (err) => {
          this.listeners.clear();
          this.destroy();
          throw err;
        }
      );
    } else if (this.ready && onProgress) {
      onProgress(1);
    }
    return this.loading;
  }

  async _load(camera) {
    const shares = [0, 0];
    const report = (i) => (share) => {
      shares[i] = share;
      const total = shares[0] * 0.92 + shares[1] * 0.08;
      this.listeners.forEach((fn) => fn(total));
    };
    const [splatBytes, colliderBytes] = await Promise.all([fetchBytes(this.splatUrl, report(0)), fetchBytes(this.colliderUrl, report(1))]);
    if (this.gone) return;

    const gltf = await new GLTFLoader().parseAsync(colliderBytes.buffer, this.colliderUrl);
    if (this.gone) return;
    this._buildCollider(gltf, camera);

    // Decoding happens in the splat renderer's worker; the bytes were fetched here.
    this.mesh = new SplatMesh({ fileBytes: splatBytes, fileName: this.splatUrl.split(/[?#]/)[0].split("/").pop() });
    await within(this.mesh.initialized, 90000, "The 3D room took too long to prepare");
    if (this.gone) {
      this.mesh.dispose();
      this.mesh = null;
      return;
    }
    const count = this.mesh.splats && this.mesh.splats.getNumSplats ? this.mesh.splats.getNumSplats() : 0;
    this.large = count > MANY;
    // A phone given the full file of a large room draws a share of it from the start.
    if (this.detail === "low" && this.large) {
      await within(this.thin(LIGHT), 120000, "The 3D room took too long to prepare").catch(() => {});
      if (this.gone) return;
    }
    if (this.flipped) this.holder.rotation.x = Math.PI;
    this.holder.scale.setScalar(this.scale);
    this.holder.position.y = this.lift;
    this.holder.add(this.mesh);
    this.stats = { splats: count, triangles: this.triangles, bytes: splatBytes.length, lift: this.lift, solid: this.solid };
  }

  /** A scene no longer shows this room. The last room left is kept for a step back. */
  release() {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs > 0 || this.gone) return;
    if (!this.ready || this.detail === "low") {
      this.destroy();
      return;
    }
    if (spare && spare !== this && spare.refs === 0) spare.destroy();
    spare = this;
  }

  destroy() {
    if (this.gone) return;
    this.gone = true;
    this.ready = false;
    rooms.delete(this.key);
    if (spare === this) spare = null;
    if (this.holder.parent) this.holder.parent.remove(this.holder);
    if (this.mesh) this.mesh.dispose();
    if (this.geometry) this.geometry.dispose();
    this.holder.clear();
    this.mesh = null;
    this.bvh = null;
    this.geometry = null;
    this.cells.clear();
  }

  /**
   * Draw at most `count` splats of this room (nearer things keep more of theirs). The first
   * call builds the room's levels of detail, off the main thread, which takes some seconds.
   * Resolves to true when the limit is in force.
   */
  thin(count) {
    if (!this.mesh || this.gone) return Promise.resolve(false);
    if (!this.thinning) this.thinning = this.mesh.createLodSplats();
    return this.thinning.then(
      () => {
        if (this.gone) return false;
        this.budget = count;
        return true;
      },
      () => false
    );
  }

  // ---------------------------------------------------------------- the collider

  /** One mesh of everything solid, in metres, y up, floor at y = 0. */
  _buildCollider(gltf, cameraRaw) {
    const v = new Vector3();
    const parts = [];
    let length = 0;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const position = o.geometry.attributes.position;
      const index = o.geometry.index;
      const n = index ? index.count : position.count;
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        this.turned(v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(o.matrixWorld), true);
        out[i * 3] = v.x;
        out[i * 3 + 1] = v.y;
        out[i * 3 + 2] = v.z;
      }
      parts.push(out);
      length += out.length;
      o.geometry.dispose();
    });
    if (length < 27) throw new Error("The 3D room has no surfaces to walk on");
    const positions = new Float32Array(length);
    let at = 0;
    for (const part of parts) {
      positions.set(part, at);
      at += part.length;
    }

    // How far to raise the room so that its floor is at y = 0.
    const camera = this.turned(cameraRaw.clone(), true);
    const measured = this._floorLevel(positions, camera);
    if (this.flipped) {
      // The model's own figure is the camera's height over the floor; it is used when the mesh agrees.
      const said = this.ground === null ? null : Math.abs(this.ground);
      if (measured === null) this.lift = (said !== null && said > 0.2 ? said : EYE) - camera.y;
      else this.lift = said !== null && Math.abs(said - (camera.y - measured)) < 0.3 ? said - camera.y : -measured;
    } else {
      // The file says where its floor is; the mesh is believed over it only when they clearly differ.
      const said = this.ground === null ? 0 : this.ground;
      this.lift = measured !== null && Math.abs(measured - said) > 0.3 ? -measured : -said;
    }
    for (let i = 1; i < positions.length; i += 3) positions[i] += this.lift;

    if (this.limit) {
      const a = this.turned(this.limit.min.clone(), true);
      const b = this.turned(this.limit.max.clone(), true);
      this.limit.min.set(Math.min(a.x, b.x), Math.min(a.y, b.y) + this.lift, Math.min(a.z, b.z));
      this.limit.max.set(Math.max(a.x, b.x), Math.max(a.y, b.y) + this.lift, Math.max(a.z, b.z));
    }

    this.triangles = positions.length / 9;
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.bvh = new MeshBVH(this.geometry);
    this.geometry.computeBoundingBox();
    this.bounds.copy(this.geometry.boundingBox);

    // Which way do this collider's faces look: out of what is solid, or into it? The floor and
    // the furniture seen from the photograph's height, looking down, are seen from the air.
    const ray = this._ray;
    let fronts = 0;
    let backs = 0;
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        ray.origin.set(camera.x + i * 0.3, camera.y + this.lift, camera.z + j * 0.3);
        const hit = this.bvh.raycastFirst(ray, DoubleSide, 0, 6);
        if (!hit) continue;
        if (hit.face.normal.y < 0) backs++;
        else fronts++;
      }
    }
    this.inward = backs > fronts;
  }

  /**
   * Height of the floor around and below the photograph's camera: the lowest large level
   * surface there (a bed or a table can be larger than the floor seen around it). Null when
   * the mesh has no such surface.
   */
  _floorLevel(p, camera) {
    const BIN = 0.04;
    const DEPTH = 4;
    const top = camera.y + 0.2;
    const low = camera.y - DEPTH;
    const bins = new Float32Array(Math.ceil((top - low) / BIN));
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i], ay = p[i + 1], az = p[i + 2];
      const cy = (ay + p[i + 4] + p[i + 7]) / 3;
      if (cy > top || cy < low) continue;
      const cx = (ax + p[i + 3] + p[i + 6]) / 3 - camera.x;
      const cz = (az + p[i + 5] + p[i + 8]) / 3 - camera.z;
      if (cx * cx + cz * cz > 36) continue;
      const ux = p[i + 3] - ax, uy = p[i + 4] - ay, uz = p[i + 5] - az;
      const wx = p[i + 6] - ax, wy = p[i + 7] - ay, wz = p[i + 8] - az;
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12 || Math.abs(ny) / len < 0.85) continue;
      bins[Math.min(bins.length - 1, Math.floor((cy - low) / BIN))] += len / 2;
    }
    // Levels are a few bins wide (colliders are not perfectly flat): compare sums of three.
    const sum = (i) => bins[i] + (bins[i - 1] || 0) + (bins[i + 1] || 0);
    let best = 0;
    for (let i = 0; i < bins.length; i++) best = Math.max(best, sum(i));
    if (best < 0.5) return null;
    for (let i = 0; i < bins.length; i++) {
      if (sum(i) < best * 0.35 || bins[i] < (bins[i - 1] || 0) || bins[i] < (bins[i + 1] || 0)) continue;
      let weight = 0;
      let height = 0;
      for (let k = Math.max(0, i - 1); k <= Math.min(bins.length - 1, i + 1); k++) {
        weight += bins[k];
        height += bins[k] * (low + (k + 0.5) * BIN);
      }
      return height / weight;
    }
    return null;
  }

  // ---------------------------------------------------------------- floor and obstacles

  /** Inside the room's stated limits (when it states any), a body's width from their edge. */
  inside(x, z) {
    const b = this.limit;
    const r = this.radius;
    return !b || (x >= b.min.x + r && x <= b.max.x - r && z >= b.min.z + r && z <= b.max.z - r);
  }

  /** Height of the collider under (x, z), looking down from just above a step at height `y`; null if none. */
  _drop(x, z, y) {
    const ray = this._ray;
    ray.origin.set(x, y + STEP + 0.02, z);
    const hit = this.bvh.raycastFirst(ray, DoubleSide, 0, STEP + DROP + 0.02);
    return hit ? hit.point.y : null;
  }

  /**
   * Floor height for someone standing at (x, z) who was at height `y`, or null where there is
   * no floor to stand on. Small holes in the collider are walked over; its edge is not.
   */
  floor(x, z, y) {
    const heights = this._heights;
    heights.length = 0;
    const centre = this._drop(x, z, y);
    if (centre !== null) heights.push(centre);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const h = this._drop(x + Math.cos(a) * 0.28, z + Math.sin(a) * 0.28, y);
      if (h !== null) heights.push(h);
    }
    if (centre === null && heights.length < 3) return null;
    if (heights.length < 3) return centre;
    heights.sort((a, b) => a - b);
    return heights[heights.length >> 1];
  }

  /**
   * How deep the visitor's body, standing at `p` (feet), is inside the collider. With `push`
   * the position is moved sideways out of what it touches, which is what makes the visitor
   * slide along walls and furniture. The body is a capsule from a step above the floor to
   * just over the head.
   */
  collide(p, push) {
    const r = this.radius;
    const seg = this._seg;
    const low = p.y + STEP + r;
    seg.start.set(p.x, low, p.z);
    seg.end.set(p.x, Math.max(low + 0.01, p.y + this.bodyTop - r), p.z);
    const box = this._box;
    box.min.set(p.x - 2 * r, p.y + STEP, p.z - 2 * r);
    box.max.set(p.x + 2 * r, p.y + this.bodyTop, p.z + 2 * r);
    const onTri = this._onTri;
    const onSeg = this._onSeg;
    let deepest = 0;
    this.bvh.shapecast({
      intersectsBounds: (bounds) => bounds.intersectsBox(box),
      intersectsTriangle: (tri) => {
        const d = tri.closestPointToSegment(seg, onTri, onSeg);
        if (d >= r) return false;
        const depth = r - d;
        if (!push) {
          if (depth > deepest) deepest = depth;
          return false;
        }
        const hx = onSeg.x - onTri.x;
        const hz = onSeg.z - onTri.z;
        const flat = Math.hypot(hx, hz);
        // Touching from above or below (a bump under the foot, a beam over the head) pushes nowhere.
        if (flat < 0.3 * d || flat < 1e-5) {
          if (depth > deepest) deepest = depth;
          return false;
        }
        const k = Math.min(r, (depth * d) / flat) / flat;
        seg.start.x += hx * k;
        seg.start.z += hz * k;
        seg.end.x += hx * k;
        seg.end.z += hz * k;
        return false;
      },
    });
    if (push) {
      p.x = seg.start.x;
      p.z = seg.start.z;
    }
    return deepest;
  }

  /**
   * True when (x, z) at height `y` is inside something solid rather than in the room's air:
   * looking round at chest height, most of what is seen first is seen from behind.
   * (Relies on the collider's faces all looking the same way; `place` copes when they do not.)
   */
  buried(x, y, z) {
    const ray = this._level;
    ray.origin.set(x, y + 0.9, z);
    let fronts = 0;
    let backs = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.2;
      ray.direction.set(Math.cos(a), 0, Math.sin(a));
      const hit = this.bvh.raycastFirst(ray, DoubleSide, 0, 40);
      if (!hit) continue;
      if (hit.face.normal.dot(ray.direction) > 0 !== this.inward) backs++;
      else fronts++;
    }
    return backs > fronts;
  }

  /** One short step from `from` by (dx, dz). Writes the place reached to `out`; false when there is no way. */
  _stepTo(from, dx, dz, out) {
    const p = this._try.set(from.x + dx, from.y, from.z + dz);
    for (let i = 0; i < 4; i++) {
      this.collide(p, true);
      if (this.collide(p, false) < 0.004) break;
    }
    const limit = Math.min(0.045, this.radius * 0.5);
    let depth = this.collide(p, false);
    if (!this.inside(p.x, p.z) && this.inside(from.x, from.z)) return false;
    const y = this.floor(p.x, p.z, from.y);
    if (y === null) return false;
    if (Math.abs(y - p.y) > 1e-4) {
      // A different height brings different things into the body's way.
      p.y = y;
      depth = this.collide(p, false);
    }
    if (depth > limit) {
      // In the way; unless the visitor is already inside it and this step leads out.
      const x = p.x;
      const z = p.z;
      const before = this.collide(this._try.copy(from), false);
      p.set(x, y, z);
      if (before <= limit || depth > before - 1e-4) return false;
    }
    out.copy(p);
    return true;
  }

  /**
   * Walk from `pos` (feet, modified in place) by (dx, dz) metres, in short steps, sliding along
   * whatever is in the way. Returns the distance actually covered.
   */
  walk(pos, dx, dz) {
    const length = Math.hypot(dx, dz);
    if (length < 1e-7) return 0;
    const x0 = pos.x;
    const z0 = pos.z;
    if (!this.solid) {
      const b = this.limit || this.bounds;
      pos.x = clamp(pos.x + dx, b.min.x + 0.3, b.max.x - 0.3);
      pos.z = clamp(pos.z + dz, b.min.z + 0.3, b.max.z - 0.3);
      return Math.hypot(pos.x - x0, pos.z - z0);
    }
    const steps = Math.max(1, Math.ceil(length / Math.max(0.03, this.radius * 0.4)));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      // Straight on, or along one axis when the straight step ends at a place without floor.
      if (!this._stepTo(pos, sx, sz, pos) && !(Math.abs(sx) > 1e-6 && this._stepTo(pos, sx, 0, pos)) && !(Math.abs(sz) > 1e-6 && this._stepTo(pos, 0, sz, pos))) break;
    }
    return Math.hypot(pos.x - x0, pos.z - z0);
  }

  /** Floor height at (x, z) if a person can stand there (near height `y`), else null. */
  standing(x, z, y) {
    if (!this.inside(x, z)) return null;
    const h = this.floor(x, z, y);
    if (h === null) return null;
    return this.collide(this._try.set(x, h, z), false) < Math.min(0.03, this.radius * 0.4) ? h : null;
  }

  /**
   * Where a person can stand nearest to (x0, z0), looking first the way `yaw` faces.
   * Writes the feet position to `out`; false when there is no such place within reach.
   */
  place(x0, z0, yaw, out) {
    const find = (free) => {
      const at = (dx, dz) => {
        const y = this.standing(x0 + dx, z0 + dz, 0);
        if (y === null || (free && this.buried(x0 + dx, y, z0 + dz))) return false;
        out.set(x0 + dx, y, z0 + dz);
        return true;
      };
      if (at(0, 0)) return true;
      const ahead = Math.PI + yaw;
      for (let ring = 1; ring <= 24; ring++) {
        const r = ring * 0.125;
        const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.125));
        for (let k = 0; k < n; k++) {
          const a = ahead + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2 * Math.PI) / n;
          if (at(Math.sin(a) * r, Math.cos(a) * r)) return true;
        }
      }
      return false;
    };
    // In the room's air if possible; where the collider's faces say nothing about that, anywhere standable.
    return find(true) || find(false);
  }

  // ---------------------------------------------------------------- what is under the pointer

  /**
   * First surface of the room hit by a ray from `origin` along unit `dir`; `outNormal` faces
   * the visitor. Returns `outPoint` or null.
   */
  surfaceAt(origin, dir, outPoint, outNormal) {
    if (!this.bvh) return null;
    const ray = this._level;
    ray.origin.copy(origin);
    ray.direction.copy(dir);
    const hit = this.bvh.raycastFirst(ray, DoubleSide, 0.05, 80);
    if (!hit) return null;
    outPoint.copy(hit.point);
    if (outNormal) {
      outNormal.copy(hit.face.normal);
      if (outNormal.dot(dir) > 0) outNormal.negate();
    }
    return outPoint;
  }

  /**
   * What a click along the ray from `origin` (unit `dir`) by a visitor standing at height `y`
   * means: a place on the floor to walk to ("floor": `outPoint` is that place), or something
   * to walk up to ("surface": `outPoint` is on it). Null when the ray meets nothing.
   * The collider is a rough stand-in for furniture (often boxes wider and taller than the
   * thing itself), so floor that is seen past it counts as floor.
   */
  aim(origin, dir, y, outPoint, outNormal) {
    const hit = this.surfaceAt(origin, dir, outPoint, outNormal);
    if (hit && outNormal.y > 0.6 && Math.abs(outPoint.y - y) < STEP + 0.15) return "floor";
    if (dir.y < -0.02) {
      const t = (y - origin.y) / dir.y;
      if (t > 0.3 && t < 40) {
        const x = origin.x + dir.x * t;
        const z = origin.z + dir.z * t;
        const h = this.standing(x, z, y);
        if (h !== null) {
          outPoint.set(x, h, z);
          outNormal.set(0, 1, 0);
          return "floor";
        }
      }
    }
    return hit ? "surface" : null;
  }

  // ---------------------------------------------------------------- finding a way

  /** Floor height of grid cell (i, j) if a person can stand at its centre, else null. Remembered. */
  _cell(i, j, y) {
    const key = i * 65536 + j;
    let cell = this.cells.get(key);
    if (cell === undefined) {
      cell = this.standing(i * CELL, j * CELL, y);
      this.cells.set(key, cell);
    }
    return cell;
  }

  /** A straight walk between two cell centres with standing room all the way. */
  _clear(ai, aj, bi, bj, y) {
    const n = Math.max(Math.abs(bi - ai), Math.abs(bj - aj)) * 2;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const h = this._cell(Math.round(ai + (bi - ai) * t), Math.round(aj + (bj - aj) * t), y);
      if (h === null) return false;
      y = h;
    }
    return true;
  }

  /**
   * A way from `from` (feet) to the point `target` on the room's surface, as a list of
   * { x, z } to walk through in order; around furniture when there is a way around. A target
   * that is not floor (a wall, a sofa) is approached as near as a person can stand.
   * Returns null when there is nowhere to go.
   */
  route(from, target, normal) {
    const dxT = target.x - from.x;
    const dzT = target.z - from.z;
    const distance = Math.hypot(dxT, dzT);
    if (distance < 0.05) return null;
    if (!this.solid) return [{ x: target.x, z: target.z }];

    // Where to stand: on the spot when it is floor at walking level, else a little before it.
    let gx = target.x;
    let gz = target.z;
    const floorLike = (!normal || normal.y > 0.6) && Math.abs(target.y - from.y) < STEP + 0.15;
    if (!floorLike) {
      const back = Math.min(distance, this.radius + 0.25);
      gx -= (dxT / distance) * back;
      gz -= (dzT / distance) * back;
    }
    const far = Math.hypot(gx - from.x, gz - from.z);
    if (far > REACH) {
      gx = from.x + ((gx - from.x) / far) * REACH;
      gz = from.z + ((gz - from.z) / far) * REACH;
    }

    const si = Math.round(from.x / CELL);
    const sj = Math.round(from.z / CELL);
    this.cells.set(si * 65536 + sj, from.y); // the visitor is standing there
    let gi = Math.round(gx / CELL);
    let gj = Math.round(gz / CELL);
    // A spot nobody can stand on (too near a wall, under a table) is swapped for the nearest one that works.
    let snapped = false;
    if (this._cell(gi, gj, from.y) === null) {
      let best = Infinity;
      let pick = null;
      for (let di = -8; di <= 8; di++) {
        for (let dj = -8; dj <= 8; dj++) {
          const d = Math.hypot(gi + di - gx / CELL, gj + dj - gz / CELL);
          if (d < best && d <= 8 && this._cell(gi + di, gj + dj, from.y) !== null) {
            best = d;
            pick = [gi + di, gj + dj];
          }
        }
      }
      if (pick) {
        [gi, gj] = pick;
        snapped = true;
      }
    }

    // The search runs over grid cells, each tested once when first reached.
    const SPAN = 600;
    const span = 2 * SPAN + 1;
    const id = (i, j) => (i - si + SPAN) * span + (j - sj + SPAN);
    const cost = new Map();
    const parent = new Map();
    const height = new Map();
    const done = new Set();
    const open = new Heap();
    const startId = id(si, sj);
    cost.set(startId, 0);
    height.set(startId, from.y);
    const h = (i, j) => {
      const a = Math.abs(i - gi);
      const b = Math.abs(j - gj);
      return (Math.max(a, b) + 0.4142 * Math.min(a, b)) * 1.001;
    };
    open.push(h(si, sj), [si, sj]);
    let best = null; // the reached cell nearest to the goal
    let bestGap = Infinity;
    let found = null;
    let visited = 0;
    const LIMIT = 14000;
    while (open.size && visited < LIMIT) {
      const [i, j] = open.pop();
      const here = id(i, j);
      if (done.has(here)) continue;
      done.add(here);
      visited++;
      const gap = Math.hypot(i - gi, j - gj);
      if (gap < bestGap) {
        bestGap = gap;
        best = [i, j];
      }
      if (i === gi && j === gj) {
        found = [i, j];
        break;
      }
      const y = height.get(here);
      const g = cost.get(here);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (Math.abs(ni - si) >= SPAN || Math.abs(nj - sj) >= SPAN) continue;
          const next = id(ni, nj);
          if (done.has(next)) continue;
          const ny = this._cell(ni, nj, y);
          if (ny === null || Math.abs(ny - y) > STEP) continue;
          // No cutting corners between two blocked cells.
          if (di && dj && (this._cell(i + di, j, y) === null || this._cell(i, j + dj, y) === null)) continue;
          const ng = g + (di && dj ? 1.4142 : 1);
          if (cost.has(next) && cost.get(next) <= ng) continue;
          cost.set(next, ng);
          parent.set(next, here);
          height.set(next, ny);
          open.push(ng + h(ni, nj), [ni, nj]);
        }
      }
    }
    const end = found || best;
    if (!end || (end[0] === si && end[1] === sj)) return null;
    // A click on something unreachable takes the visitor as near as they can get, if that is nearer.
    if (!found && bestGap * CELL > Math.hypot(gx - from.x, gz - from.z) - 0.3) return null;

    // Back along the parents, then drop every corner that can be walked past in a straight line.
    const back = [];
    for (let at = id(end[0], end[1]); at !== undefined; at = parent.get(at)) {
      back.push([Math.floor(at / span) - SPAN + si, (at % span) - SPAN + sj]);
    }
    const cells = back.reverse();
    const points = [];
    let anchor = 0;
    while (anchor < cells.length - 1) {
      let next = cells.length - 1;
      while (next > anchor + 1 && !this._clear(cells[anchor][0], cells[anchor][1], cells[next][0], cells[next][1], from.y)) next--;
      points.push({ x: cells[next][0] * CELL, z: cells[next][1] * CELL });
      anchor = next;
    }
    // Finish on the exact spot asked for when it is inside the last cell.
    if (found && !snapped && points.length) {
      const last = points[points.length - 1];
      if (Math.hypot(last.x - gx, last.z - gz) <= CELL) {
        last.x = gx;
        last.z = gz;
      }
    }
    return points.length ? points : null;
  }
}

// ---------------------------------------------------------------------------------------------
// A scene of the tour that is a generated room: the room, and where its photograph was taken.
// ---------------------------------------------------------------------------------------------

export class WorldScene {
  /**
   * @param meta   scene entry from tour.json, with `meta.world` (see the top of this file)
   * @param base   URL of the tour folder (ends with "/")
   */
  constructor(meta, base) {
    this.meta = meta;
    this.url = base + meta.base;
    this.isWorld = true;
    this.group = new Group();
    this.ready = false;
    this.disposed = false;
    this.room = null;

    const world = meta.world || {};
    this.eyeGiven = typeof world.eye === "number" && world.eye > 0.8 && world.eye < 2.2 ? world.eye : null;
    // The photograph's camera in the room's own coordinates: where it stood and which way it looked.
    const pose = world.start || {};
    const flipped = world.convention === "opencv";
    this.cameraGiven = Boolean(vec3(pose.position));
    this.cameraRaw = new Vector3().fromArray(vec3(pose.position) || [0, 0, 0]);
    if (!this.cameraGiven && !flipped) this.cameraRaw.y = (Number.isFinite(world.ground) ? world.ground : 0) + EYE;
    const q = Array.isArray(pose.quaternion) && pose.quaternion.length === 4 && pose.quaternion.every(Number.isFinite) ? pose.quaternion : null;
    this.looksRaw = new Vector3(0, 0, flipped && !q ? 1 : -1);
    if (q) this.looksRaw.applyQuaternion(new Quaternion().fromArray(q).normalize());

    this.near = 0.05;
    this.far = 400;
    this.baseYaw = 0;
    this.basePitch = 0;
    this.eyeHeight = EYE;
    this.start = new Vector3(); // where the visitor's feet are on arriving
    this.camera = new Vector3(); // where the photograph was taken: the first view is from exactly here
    this.lead = new Vector3(); // from the walking eye position at `start` to `camera`
    this._v = new Vector3();
  }

  /**
   * @param renderer   the page's WebGLRenderer (WebGL2)
   * @param detail     "high" | "low": phones take the lighter file when the room has one
   * @param onProgress called with the share (0…1) of the files received
   */
  async load(renderer, detail, onProgress) {
    const world = this.meta.world;
    if (!world || !world.splat || !world.collider) throw new Error("This space has no 3D room");
    const room = Room.open(world, this.url, detail);
    this.room = room;
    try {
      await room.load(this.cameraRaw, onProgress);
    } catch (err) {
      this.room = null;
      room.release();
      throw err;
    }
    if (this.disposed || room.gone) return this;
    this._arrive();
    this.ready = true;
    return this;
  }

  /** Where this scene's photograph was taken in the prepared room, and where the visitor stands. */
  _arrive() {
    const room = this.room;
    const camera = room.turned(this.camera.copy(this.cameraRaw), true);
    camera.y += room.lift;
    const looks = room.turned(this.looksRaw.clone(), false);
    const flat = Math.hypot(looks.x, looks.z);
    this.baseYaw = flat > 1e-4 ? Math.atan2(-looks.x, -looks.z) : 0;
    this.basePitch = clamp(Math.atan2(looks.y, Math.max(flat, 1e-4)), -0.6, 0.6);

    // A photograph taken from outside the stated room makes the statement wrong, not the photograph.
    const b = room.limit;
    if (b && (camera.x < b.min.x || camera.x > b.max.x || camera.z < b.min.z || camera.z > b.max.z)) room.limit = null;

    // Eye height: as given; else the height the photograph was taken from, when a person stands that tall.
    this.eyeHeight = this.eyeGiven || (camera.y > 1.0 && camera.y < 2.2 ? clamp(camera.y, 1.45, 1.7) : EYE);
    room.bodyTop = this.eyeHeight + HEAD;
    if (!room.place(camera.x, camera.z, this.baseYaw, this.start)) {
      // Nothing to stand on near the photograph's position: do without collisions rather than without the room.
      room.solid = false;
      this.start.set(camera.x, 0, camera.z);
    }
    if (!this.cameraGiven && this.meta.world.convention !== "opencv") camera.y = this.start.y + this.eyeHeight;
    this.lead.set(camera.x - this.start.x, camera.y - (this.start.y + this.eyeHeight), camera.z - this.start.z);
    this.stats = Object.assign({ file: room.splatUrl.split("/").pop(), eyeHeight: this.eyeHeight, camera: camera.toArray(), start: this.start.toArray() }, room.stats, { solid: room.solid });
  }

  /** The scene is on screen: its room's splats join it (they can be in one scene at a time). */
  enter() {
    if (!this.room || this.disposed) return;
    this.room.bodyTop = this.eyeHeight + HEAD;
    this.group.add(this.room.holder);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    const room = this.room;
    this.room = null;
    if (room) {
      if (room.holder.parent === this.group) this.group.remove(room.holder);
      room.release();
    }
    this.group.clear();
  }

  // What the viewer asks while the visitor walks: all answered by the room.
  get large() {
    return Boolean(this.room && this.room.large);
  }
  get budget() {
    return this.room ? this.room.budget : 0;
  }
  thin(count) {
    return this.room ? this.room.thin(count) : Promise.resolve(false);
  }
  walk(pos, dx, dz) {
    return this.room ? this.room.walk(pos, dx, dz) : 0;
  }
  route(from, target, normal) {
    return this.room ? this.room.route(from, target, normal) : null;
  }
  surfaceAt(origin, dir, outPoint, outNormal) {
    return this.room ? this.room.surfaceAt(origin, dir, outPoint, outNormal) : null;
  }
  aim(origin, dir, y, outPoint, outNormal) {
    return this.room ? this.room.aim(origin, dir, y, outPoint, outNormal) : null;
  }
  canStand(p) {
    return Boolean(this.room && this.room.standing(p.x, p.z, p.y) !== null);
  }

  /** Vertical field of view (radians): wide like the photographs, wider on a tall screen. */
  viewFov(aspect) {
    const deg = Math.PI / 180;
    if (aspect >= 1.25) return 62 * deg;
    return clamp(2 * Math.atan(Math.tan(31 * deg) * Math.sqrt(1.25 / aspect)), 62 * deg, 86 * deg);
  }

  setView() {}
}
