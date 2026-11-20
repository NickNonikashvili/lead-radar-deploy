/**
 * Geometry of one tour scene.
 *
 * geo.bin (written by tools/tour/pack.py) holds the depth of a photograph on
 * a regular grid. This module decodes it and builds the triangle mesh: one
 * continuous surface, which the photograph is then projected onto.
 *
 * Coordinates: "camera space" of the original photograph in three.js
 * convention — x right, y up, the camera looks down −z.
 */

import { gunzipSync } from "fflate";
import { BufferAttribute, BufferGeometry, Box3, Sphere, Vector3 } from "three";

const SKY = 65535;
const HEADER_BYTES = 4 + 2 + 2 + 4 * 4 + 2 + 2;

/** Undo the plane predictor + byte-plane split of pack.py. */
function unpredict(lo, hi, gw, gh) {
  const out = new Uint16Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    const row = y * gw;
    const up = row - gw;
    let left = 0;
    let upLeft = 0;
    for (let x = 0; x < gw; x++) {
      const above = y ? out[up + x] : 0;
      const residual = lo[row + x] | (hi[row + x] << 8);
      const value = (residual + left + above - upLeft) & 0xffff;
      out[row + x] = value;
      left = value;
      upLeft = above;
    }
  }
  return out;
}

/** Decode geo.bin into { gw, gh, near, far, skyDistance, front } with `front` in metres per grid vertex. */
export function decodeGeo(arrayBuffer) {
  const raw = gunzipSync(new Uint8Array(arrayBuffer));
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const magic = String.fromCharCode(raw[0], raw[1], raw[2], raw[3]);
  if (magic !== "LHT1") throw new Error("Unknown tour geometry format");
  const gw = view.getUint16(4, true);
  const gh = view.getUint16(6, true);
  const near = view.getFloat32(8, true);
  const far = view.getFloat32(12, true);
  const skyDistance = view.getFloat32(16, true);
  const version = view.getUint16(24, true);
  if (version !== 2) throw new Error("Unsupported tour geometry version " + version);
  const n = gw * gh;
  if (raw.byteLength < HEADER_BYTES + 2 * n) throw new Error("Tour geometry file is truncated");

  const codes = unpredict(raw.subarray(HEADER_BYTES, HEADER_BYTES + n), raw.subarray(HEADER_BYTES + n, HEADER_BYTES + 2 * n), gw, gh);
  // Codes -> metres. 65535 = sky, placed just behind the farthest surface.
  const scale = Math.log(far / near) / 65533;
  const front = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = codes[i];
    front[i] = c === SKY || c === 0 ? skyDistance : near * Math.exp((c - 1) * scale);
  }
  return { gw, gh, near, far, skyDistance, front };
}

/**
 * Build the mesh from a depth grid.
 *
 * @param depth  Float32Array gw*gh, metres
 * @param step   use every `step`-th sample (level of detail)
 */
export function buildGeometry(depth, gw, gh, fx, fy, step) {
  // Sample positions along each axis; the last row/column is always included.
  const axis = (count) => {
    const idx = [];
    for (let i = 0; i < count - 1; i += step) idx.push(i);
    idx.push(count - 1);
    return idx;
  };
  const xs = axis(gw);
  const ys = axis(gh);
  const cols = xs.length;
  const rows = ys.length;

  const positions = new Float32Array(cols * rows * 3);
  const sampled = new Float32Array(cols * rows);
  let p = 0;
  let maxDepth = 0;
  for (let r = 0; r < rows; r++) {
    const gy = ys[r];
    const yFactor = (gy / (gh - 1) - 0.5) / fy;
    for (let c = 0; c < cols; c++) {
      const gx = xs[c];
      const d = depth[gy * gw + gx];
      sampled[r * cols + c] = d;
      if (d > maxDepth) maxDepth = d;
      positions[p++] = ((gx / (gw - 1) - 0.5) / fx) * d;
      positions[p++] = -yFactor * d;
      positions[p++] = -d;
    }
  }

  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const e = a + cols;
      const f = e + 1;
      // Split each cell along the diagonal with the smaller depth difference.
      if (Math.abs(sampled[a] - sampled[f]) <= Math.abs(sampled[b] - sampled[e])) {
        indices[k++] = a; indices[k++] = e; indices[k++] = f;
        indices[k++] = a; indices[k++] = f; indices[k++] = b;
      } else {
        indices[k++] = a; indices[k++] = e; indices[k++] = b;
        indices[k++] = b; indices[k++] = e; indices[k++] = f;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));

  // Bounds from the data (cheaper and safer than three's generic pass on ~400k vertices).
  const halfX = (0.5 / fx) * maxDepth;
  const halfY = (0.5 / fy) * maxDepth;
  geometry.boundingBox = new Box3(new Vector3(-halfX, -halfY, -maxDepth), new Vector3(halfX, halfY, 0));
  geometry.boundingSphere = new Sphere();
  geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  return { geometry, triangles: k / 3, vertices: cols * rows };
}
