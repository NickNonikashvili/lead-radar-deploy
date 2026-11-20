/**
 * Geometry of one tour scene.
 *
 * geo.bin (written by tools/tour/pack.py) holds two depth grids for a photo:
 * the front layer (every pixel) and the hidden layer (the far surface
 * continued behind foreground silhouettes). This module decodes them and
 * builds the triangle meshes, cutting the mesh wherever two neighbouring
 * samples belong to different surfaces so nothing is stretched across a gap.
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
  const cut = view.getFloat32(20, true);
  const version = view.getUint16(24, true);
  if (version !== 1) throw new Error("Unsupported tour geometry version " + version);
  const n = gw * gh;
  if (raw.byteLength < HEADER_BYTES + 4 * n) throw new Error("Tour geometry file is truncated");

  const plane = (index) => raw.subarray(HEADER_BYTES + index * n, HEADER_BYTES + (index + 1) * n);
  const frontCodes = unpredict(plane(0), plane(1), gw, gh);
  const hiddenCodes = unpredict(plane(2), plane(3), gw, gh);

  // Codes -> metres. 0 = no surface, 65535 = sky (placed on a distant backdrop).
  const scale = Math.log(far / near) / 65533;
  const toDepth = (codes) => {
    const depth = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      depth[i] = c === 0 ? 0 : c === SKY ? skyDistance : near * Math.exp((c - 1) * scale);
    }
    return depth;
  };

  return { gw, gh, near, far, skyDistance, cut, front: toDepth(frontCodes), hidden: toDepth(hiddenCodes) };
}

/**
 * Build a mesh from a depth grid.
 *
 * @param depth  Float32Array gw*gh, 0 where there is no surface
 * @param step   use every `step`-th sample (level of detail)
 * @param cut    relative depth difference above which a grid cell is left open
 */
export function buildGeometry(depth, gw, gh, fx, fy, step, cut, seamDepth) {
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
  for (let r = 0; r < rows; r++) {
    const gy = ys[r];
    const v = gy / (gh - 1);
    const yFactor = (v - 0.5) / fy;
    for (let c = 0; c < cols; c++) {
      const gx = xs[c];
      const d = depth[gy * gw + gx];
      sampled[r * cols + c] = d;
      const u = gx / (gw - 1);
      positions[p++] = ((u - 0.5) / fx) * d;
      positions[p++] = -yFactor * d;
      positions[p++] = -d;
    }
  }

  // A coarser grid spans more pixels per cell, so allow a proportionally larger depth change.
  const tolerance = cut * (1 + 0.6 * (step - 1));
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  const open = seamDepth ? [] : null; // cells left open at a depth jump (filled by buildSeams)
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const e = a + cols;
      const f = e + 1;
      const da = sampled[a];
      const db = sampled[b];
      const de = sampled[e];
      const df = sampled[f];
      if (da <= 0 || db <= 0 || de <= 0 || df <= 0) continue;
      const lo = Math.min(da, db, de, df);
      const hi = Math.max(da, db, de, df);
      if (hi - lo > tolerance * lo) {
        if (open) open.push(r, c);
        continue;
      }
      // Split along the diagonal with the smaller depth difference.
      if (Math.abs(da - df) <= Math.abs(db - de)) {
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
  geometry.setIndex(new BufferAttribute(indices.subarray(0, k), 1));

  // Bounds from the data (cheaper and safer than three's generic pass on ~400k vertices).
  let maxDepth = 0;
  for (let i = 0; i < sampled.length; i++) if (sampled[i] > maxDepth) maxDepth = sampled[i];
  const halfX = (0.5 / fx) * maxDepth;
  const halfY = (0.5 / fy) * maxDepth;
  geometry.boundingBox = new Box3(new Vector3(-halfX, -halfY, -maxDepth), new Vector3(halfX, halfY, 0));
  geometry.boundingSphere = new Sphere();
  geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  const result = { geometry, triangles: k / 3, vertices: cols * rows };
  if (open) result.seams = buildSeams(open, sampled, seamDepth, xs, ys, gw, gh, fx, fy, tolerance);
  return result;
}

/**
 * Close the one-cell gap the front layer leaves at every silhouette.
 *
 * In each open cell the corners that belong to the nearer object are pushed
 * back onto the surface behind it, and the cell is drawn there. It is still
 * textured with the photograph, so from the original viewpoint the picture is
 * complete and exact; from elsewhere the far surface simply continues up to
 * the silhouette and meets the hidden layer.
 */
function buildSeams(open, sampled, hidden, xs, ys, gw, gh, fx, fy, tolerance) {
  const cols = xs.length;
  const cells = open.length / 2;
  const positions = new Float32Array(cells * 12);
  const indices = new Uint32Array(cells * 6);
  const d = [0, 0, 0, 0];
  let v = 0;
  let k = 0;
  let count = 0;
  for (let i = 0; i < open.length; i += 2) {
    const r = open[i];
    const c = open[i + 1];
    const corner = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
    let hi = 0;
    for (let j = 0; j < 4; j++) {
      d[j] = sampled[corner[j][0] * cols + corner[j][1]];
      if (d[j] > hi) hi = d[j];
    }
    let lo = Infinity;
    let top = 0;
    for (let j = 0; j < 4; j++) {
      if (hi - d[j] > tolerance * d[j]) {
        // A corner on the nearer object: push it back to the far side of this cell. The surface
        // recorded behind it is used when it agrees with that far side (it follows slopes better).
        const behind = hidden[ys[corner[j][0]] * gw + xs[corner[j][1]]];
        d[j] = behind > d[j] && Math.abs(behind - hi) <= 3 * tolerance * hi ? behind : hi;
      }
      if (d[j] < lo) lo = d[j];
      if (d[j] > top) top = d[j];
    }
    if (top - lo > 4 * tolerance * lo) continue; // two unrelated far surfaces: leave it to the hidden layer
    const base = count * 4;
    for (let j = 0; j < 4; j++) {
      const u = xs[corner[j][1]] / (gw - 1);
      const w = ys[corner[j][0]] / (gh - 1);
      positions[v++] = ((u - 0.5) / fx) * d[j];
      positions[v++] = -((w - 0.5) / fy) * d[j];
      positions[v++] = -d[j];
    }
    indices[k++] = base; indices[k++] = base + 2; indices[k++] = base + 3;
    indices[k++] = base; indices[k++] = base + 3; indices[k++] = base + 1;
    count++;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions.subarray(0, count * 12), 3));
  geometry.setIndex(new BufferAttribute(indices.subarray(0, count * 6), 1));
  return { geometry, triangles: count * 2 };
}
