#!/usr/bin/env node
/**
 * Make the small generated room the browser tests walk through (test/fixtures/world).
 *
 *   node tools/tour/make-world-fixture.mjs
 *
 * A real generated room is a file of Gaussian splats (what is seen) and a collider mesh (what
 * is walked on) in one y-up, metric world, plus the pose of the photograph's camera in that
 * world. This fixture is written the same way, with known geometry, so the tests can prove
 * the viewer starts the visitor where the photograph would have been taken, facing the way it
 * looked, and keeps them out of the walls and the furniture.
 *
 * The room, in metres, y up, as the visitor sees it on arriving (they stand at x = 0, z = 0 and
 * look at −z). In the files the room is turned a quarter turn and moved away from the origin
 * (see FRAME), as a generated room is wherever the model put it.
 *
 *        z = −6  ┌──────────── far wall (cream, with a dark picture) ────────────┐
 *                │                                                                │
 *                │                ┌────── sofa (ember) ──────┐                   │
 *   left wall    │                │  2.0 × 0.9, 0.8 high     │   z = −3          │  right wall
 *   (green)      │                └──────────────────────────┘                   │  (blue)
 *                │                                                                │
 *                │                          ● start                              │
 *        z = +2  └──────────────────────── back wall (grey) ─────────────────────┘
 *              x = −3                                                          x = +3
 *
 * The floor is at y = 0 (checkered), the ceiling at 2.8, the camera of the imaginary
 * photograph at 1.5. A 0.3 m hole in the collider's floor at (1.8, −1) stands for the small
 * gaps real colliders have: the visitor walks over it. The room's stated limits (`bounds`)
 * end half a metre before the back wall, as if that wall were glass with the garden mesh
 * continuing behind it: the visitor is stopped there.
 *
 * Output: world.ply (3D Gaussian splats, the common binary PLY layout), collider.glb,
 * and world.json (the scene's `world` entry, as the tour builder would write it, and the
 * numbers the tests need).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "world");

const CAMERA = 1.5; // height of the photograph's camera above the floor, metres
// Where the model put the room: turned a quarter turn about the vertical, then moved.
const FRAME = { turn: 90, shift: [10, 0, 20] };
const LIMIT_BACK = 1.5; // the stated limits end here (visitor's z), before the back wall at 2
const ROOM = { x0: -3, x1: 3, z0: -6, z1: 2, height: 2.8 };
const SOFA = { x0: -1, x1: 1, z0: -3.45, z1: -2.55, height: 0.8 };
const HOLE = { x0: 1.65, x1: 1.95, z0: -1.15, z1: -0.85 };

/** The visitor's frame → the file's world (a quarter turn about y: x' = z, z' = −x; then the shift). */
const toFile = ([x, y, z]) => [z + FRAME.shift[0], y + FRAME.shift[1], -x + FRAME.shift[2]];

// ---------------------------------------------------------------- collider (GLB)

const triangles = [];
/**
 * A flat rectangle given by a corner and two edge vectors. Its front looks towards the point
 * `seenFrom` (as a collider's faces look out of what is solid, into the air of the room).
 */
function quad(o, u, v, seenFrom) {
  const a = o;
  const b = [o[0] + u[0], o[1] + u[1], o[2] + u[2]];
  const c = [b[0] + v[0], b[1] + v[1], b[2] + v[2]];
  const d = [o[0] + v[0], o[1] + v[1], o[2] + v[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const side = n[0] * (seenFrom[0] - o[0]) + n[1] * (seenFrom[1] - o[1]) + n[2] * (seenFrom[2] - o[2]);
  if (side >= 0) triangles.push(a, b, c, a, c, d);
  else triangles.push(a, c, b, a, d, c);
}
function box({ x0, x1, z0, z1, height }) {
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  quad([x0, height, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [mx, height + 1, mz]); // top
  quad([x0, 0, z0], [x1 - x0, 0, 0], [0, height, 0], [mx, 0, z0 - 1]);
  quad([x0, 0, z1], [x1 - x0, 0, 0], [0, height, 0], [mx, 0, z1 + 1]);
  quad([x0, 0, z0], [0, 0, z1 - z0], [0, height, 0], [x0 - 1, 0, mz]);
  quad([x1, 0, z0], [0, 0, z1 - z0], [0, height, 0], [x1 + 1, 0, mz]);
}

const AIR = [0, 1.4, -0.5]; // a point in the room's air: every wall, the floor and the ceiling face it
// Floor: strips around the hole.
quad([ROOM.x0, 0, ROOM.z0], [ROOM.x1 - ROOM.x0, 0, 0], [0, 0, HOLE.z0 - ROOM.z0], AIR);
quad([ROOM.x0, 0, HOLE.z1], [ROOM.x1 - ROOM.x0, 0, 0], [0, 0, ROOM.z1 - HOLE.z1], AIR);
quad([ROOM.x0, 0, HOLE.z0], [HOLE.x0 - ROOM.x0, 0, 0], [0, 0, HOLE.z1 - HOLE.z0], AIR);
quad([HOLE.x1, 0, HOLE.z0], [ROOM.x1 - HOLE.x1, 0, 0], [0, 0, HOLE.z1 - HOLE.z0], AIR);
// Ceiling and walls.
quad([ROOM.x0, ROOM.height, ROOM.z0], [ROOM.x1 - ROOM.x0, 0, 0], [0, 0, ROOM.z1 - ROOM.z0], AIR);
quad([ROOM.x0, 0, ROOM.z0], [ROOM.x1 - ROOM.x0, 0, 0], [0, ROOM.height, 0], AIR);
quad([ROOM.x0, 0, ROOM.z1], [ROOM.x1 - ROOM.x0, 0, 0], [0, ROOM.height, 0], AIR);
quad([ROOM.x0, 0, ROOM.z0], [0, 0, ROOM.z1 - ROOM.z0], [0, ROOM.height, 0], AIR);
quad([ROOM.x1, 0, ROOM.z0], [0, 0, ROOM.z1 - ROOM.z0], [0, ROOM.height, 0], AIR);
box(SOFA);

function writeGlb(file) {
  const positions = new Float32Array(triangles.length * 3);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  triangles.forEach((p, i) => {
    const q = toFile(p);
    for (let k = 0; k < 3; k++) {
      positions[i * 3 + k] = q[k];
      min[k] = Math.min(min[k], positions[i * 3 + k]);
      max[k] = Math.max(max[k], positions[i * 3 + k]);
    }
  });
  const bin = Buffer.from(positions.buffer);
  const json = {
    asset: { version: "2.0", generator: "luxhouse make-world-fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "world", children: [1] }, { name: "geometry_0", mesh: 0 }],
    meshes: [{ name: "geometry_0", primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: triangles.length, type: "VEC3", min, max }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length, target: 34962 }],
    buffers: [{ byteLength: bin.length }],
  };
  let text = Buffer.from(JSON.stringify(json));
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "latin1");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(text.length, 0);
  jsonHead.write("JSON", 4, "latin1");
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.write("BIN\0", 4, "latin1");
  fs.writeFileSync(file, Buffer.concat([header, jsonHead, text, binHead, bin]));
  return triangles.length / 3;
}

// ---------------------------------------------------------------- splats (PLY)

const splats = [];
/**
 * Cover a rectangle with flat splats. `axis` is the one the surface faces (0 x, 1 y, 2 z);
 * `colour(u, v, p)` gives the colour (0…1) at a point.
 */
function cover(o, u, v, axis, colour, step = 0.3) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const nu = Math.max(1, Math.round(lu / step));
  const nv = Math.max(1, Math.round(lv / step));
  const size = [0, 0, 0].map((_, k) => (k === axis ? 0.012 : (Math.max(lu / nu, lv / nv) * 0.62)));
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = (i + 0.5) / nu;
      const b = (j + 0.5) / nv;
      const p = [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b];
      // The quarter turn swaps which way a splat is wide.
      splats.push({ p, size: [size[2], size[1], size[0]], colour: colour(a, b, p) });
    }
  }
}
const shade = (rgb, k) => rgb.map((c) => Math.min(1, c * k));
const W = ROOM.x1 - ROOM.x0;
const D = ROOM.z1 - ROOM.z0;
// Floor: a checkerboard of metre squares, so walking is seen.
cover([ROOM.x0, 0, ROOM.z0], [W, 0, 0], [0, 0, D], 1, (a, b, p) => ((Math.floor(p[0] + 100) + Math.floor(p[2] + 100)) % 2 ? [0.62, 0.52, 0.4] : [0.36, 0.29, 0.22]), 0.25);
cover([ROOM.x0, ROOM.height, ROOM.z0], [W, 0, 0], [0, 0, D], 1, () => [0.86, 0.85, 0.82], 0.5);
// Far wall: cream, with a dark picture in the middle.
cover([ROOM.x0, 0, ROOM.z0], [W, 0, 0], [0, ROOM.height, 0], 2, (a, b, p) => (Math.abs(p[0]) < 0.8 && p[1] > 1.2 && p[1] < 2.2 ? [0.12, 0.14, 0.2] : shade([0.92, 0.88, 0.78], 0.85 + 0.15 * b)));
cover([ROOM.x0, 0, ROOM.z1], [W, 0, 0], [0, ROOM.height, 0], 2, (a, b) => shade([0.5, 0.5, 0.52], 0.8 + 0.2 * b));
cover([ROOM.x0, 0, ROOM.z0], [0, 0, D], [0, ROOM.height, 0], 0, (a, b) => shade([0.2, 0.62, 0.3], 0.8 + 0.2 * b));
cover([ROOM.x1, 0, ROOM.z0], [0, 0, D], [0, ROOM.height, 0], 0, (a, b) => shade([0.2, 0.36, 0.86], 0.8 + 0.2 * b));
// The sofa.
const ember = [0.9, 0.33, 0.18];
cover([SOFA.x0, SOFA.height, SOFA.z0], [SOFA.x1 - SOFA.x0, 0, 0], [0, 0, SOFA.z1 - SOFA.z0], 1, () => ember, 0.2);
cover([SOFA.x0, 0, SOFA.z0], [SOFA.x1 - SOFA.x0, 0, 0], [0, SOFA.height, 0], 2, () => shade(ember, 0.7), 0.2);
cover([SOFA.x0, 0, SOFA.z1], [SOFA.x1 - SOFA.x0, 0, 0], [0, SOFA.height, 0], 2, () => shade(ember, 0.85), 0.2);
cover([SOFA.x0, 0, SOFA.z0], [0, 0, SOFA.z1 - SOFA.z0], [0, SOFA.height, 0], 0, () => shade(ember, 0.6), 0.2);
cover([SOFA.x1, 0, SOFA.z0], [0, 0, SOFA.z1 - SOFA.z0], [0, SOFA.height, 0], 0, () => shade(ember, 0.6), 0.2);

function writePly(file) {
  const fields = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"];
  const header = ["ply", "format binary_little_endian 1.0", `element vertex ${splats.length}`, ...fields.map((f) => `property float ${f}`), "end_header", ""].join("\n");
  const body = Buffer.alloc(splats.length * fields.length * 4);
  const SH0 = 0.28209479177387814;
  splats.forEach((s, i) => {
    const p = toFile(s.p);
    const values = [
      ...p,
      ...s.colour.map((c) => (c - 0.5) / SH0),
      6, // opacity before the sigmoid: opaque
      ...s.size.map((m) => Math.log(m)),
      1, 0, 0, 0, // no rotation: every surface here faces along an axis
    ];
    values.forEach((value, k) => body.writeFloatLE(value, (i * fields.length + k) * 4));
  });
  fs.writeFileSync(file, Buffer.concat([Buffer.from(header, "latin1"), body]));
}

fs.mkdirSync(OUT, { recursive: true });
const count = writeGlb(path.join(OUT, "collider.glb"));
writePly(path.join(OUT, "world.ply"));
const corners = [toFile([ROOM.x0, 0, ROOM.z0]), toFile([ROOM.x1, ROOM.height, LIMIT_BACK])];
const world = {
  splat: "world.ply",
  collider: "collider.glb",
  convention: "three",
  ground: 0,
  // The photograph's camera: at the visitor's start, looking at their −z, which is the world's −x.
  start: { position: toFile([0, CAMERA, 0]), quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
  bounds: { min: corners[0].map((c, k) => Math.min(c, corners[1][k])), max: corners[0].map((c, k) => Math.max(c, corners[1][k])) },
};
fs.writeFileSync(path.join(OUT, "world.json"), JSON.stringify({ world, frame: FRAME, room: ROOM, sofa: SOFA, hole: HOLE, camera: CAMERA, limitBack: LIMIT_BACK }, null, 1) + "\n");
console.log(`world fixture: ${splats.length} splats, ${count} collider triangles -> ${path.relative(process.cwd(), OUT)}`);
