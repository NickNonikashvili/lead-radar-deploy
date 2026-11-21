#!/usr/bin/env python3
"""The solid shapes of a generated room: where a visitor can stand and what stops them.

The splats of a room are only a picture. To walk in it the tour needs to know where the floor is
free and where walls and furniture stand. That is read from the same posed frames the room was
built from (each has a depth map), as a plan of the room in small squares:

    blocked   something stands there between shin and head height (furniture, a wall, a plant);
              or the room's outline passes there (found above door height, where walls are solid
              even over windows, glass doors and doorways); or nobody ever saw the floor there
    free      the floor was seen and nothing stands on it

Only the free squares that can be reached from the starting point without squeezing through a gap
narrower than a person are kept. So the visitor stays inside the room: glass they could see
through, a doorway to a part of the house that was only invented as a backdrop, and corners no
view looked into are all closed.

The result is written as collider.glb, an ordinary triangle mesh: one box per run of blocked
squares, from the floor up to above head height. The viewer slides the visitor along it.
"""

from __future__ import annotations

import json
import struct
from collections import deque
from pathlib import Path

import numpy as np

CELL = 0.06          # metres per square of the plan
BODY = (0.20, 1.90)  # things between these heights stop a person
OUTLINE = (2.15, 2.60)   # at this height walls are solid over windows and doors, and furniture is rare
FLOOR_BAND = 0.12    # points this close to the floor are floor
MIN_HITS = 3         # points needed in a square before it counts (single stray points are ignored)
PERSON = 0.25        # radius of the visitor, metres
WALL_HEIGHT = 2.3    # the boxes are this tall


def plan(points: np.ndarray, floor: float = 0.0, cell: float = CELL, margin: float = 0.6) -> dict:
    """The room in plan, from the world points of all its frames.

    Returns {"origin": (x0, z0), "cell": cell, "blocked": bool[rows(z), cols(x)], "seen": bool[...]}.
    """
    x, y, z = points[:, 0], points[:, 1] - floor, points[:, 2]
    x0, z0 = float(x.min()) - margin, float(z.min()) - margin
    cols = int(np.ceil((float(x.max()) + margin - x0) / cell))
    rows = int(np.ceil((float(z.max()) + margin - z0) / cell))
    cx = np.clip(((x - x0) / cell).astype(np.int64), 0, cols - 1)
    cz = np.clip(((z - z0) / cell).astype(np.int64), 0, rows - 1)

    def count(mask: np.ndarray) -> np.ndarray:
        grid = np.zeros(rows * cols, dtype=np.int32)
        np.add.at(grid, cz[mask] * cols + cx[mask], 1)
        return grid.reshape(rows, cols)

    body = count((y > BODY[0]) & (y < BODY[1])) >= MIN_HITS
    outline = _thin_out(count((y > OUTLINE[0]) & (y < OUTLINE[1])) >= MIN_HITS)
    seen = count(np.abs(y) < FLOOR_BAND) >= 1
    return {"origin": (x0, z0), "cell": cell, "blocked": body | outline, "seen": _close(seen, 2)}


def _shift_or(grid: np.ndarray, r: int) -> np.ndarray:
    """Dilate a boolean grid by r squares (a square neighbourhood)."""
    out = grid.copy()
    for d in range(1, r + 1):
        out[d:, :] |= grid[:-d, :]
        out[:-d, :] |= grid[d:, :]
    side = out.copy()
    for d in range(1, r + 1):
        out[:, d:] |= side[:, :-d]
        out[:, :-d] |= side[:, d:]
    return out


def _close(grid: np.ndarray, r: int) -> np.ndarray:
    """Fill holes up to r squares wide (the floor is sampled in stripes far from a camera)."""
    return ~_shift_or(~_shift_or(grid, r), r)


def _thin_out(grid: np.ndarray, min_cells: int = 40) -> np.ndarray:
    """Drop small islands: a lamp hanging in the room is not a wall."""
    rows, cols = grid.shape
    labels = np.zeros(grid.shape, dtype=np.int32)
    keep = np.zeros(grid.shape, dtype=bool)
    wide = _shift_or(grid, 2)          # squares two apart still belong to the same wall
    current = 0
    for r0, c0 in zip(*np.nonzero(wide)):
        if labels[r0, c0]:
            continue
        current += 1
        labels[r0, c0] = current
        queue = deque([(r0, c0)])
        members = []
        while queue:
            r, c = queue.popleft()
            members.append((r, c))
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < rows and 0 <= cc < cols and wide[rr, cc] and not labels[rr, cc]:
                    labels[rr, cc] = current
                    queue.append((rr, cc))
        real = [(r, c) for r, c in members if grid[r, c]]
        if len(real) >= min_cells:
            rr, cc = zip(*real)
            keep[list(rr), list(cc)] = True
    return keep


def walkable(room: dict, start: tuple[float, float], person: float = PERSON) -> np.ndarray:
    """The squares a person's centre can reach from `start` (x, z)."""
    cell = room["cell"]
    r = int(np.ceil(person / cell))
    free = room["seen"] & ~_shift_or(room["blocked"], r)
    rows, cols = free.shape
    c0 = int((start[0] - room["origin"][0]) / cell)
    r0 = int((start[1] - room["origin"][1]) / cell)
    if not (0 <= r0 < rows and 0 <= c0 < cols):
        raise ValueError("the starting point is outside the plan")
    if not free[r0, c0]:      # the photographer may have stood against a wall: start from the nearest free square
        rr, cc = np.nonzero(free)
        if not len(rr):
            raise ValueError("no free floor at all")
        i = int(np.argmin((rr - r0) ** 2 + (cc - c0) ** 2))
        r0, c0 = int(rr[i]), int(cc[i])
    reach = np.zeros_like(free)
    reach[r0, c0] = True
    queue = deque([(r0, c0)])
    while queue:
        a, b = queue.popleft()
        for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            aa, bb = a + da, b + db
            if 0 <= aa < rows and 0 <= bb < cols and free[aa, bb] and not reach[aa, bb]:
                reach[aa, bb] = True
                queue.append((aa, bb))
    return reach


def solid(room: dict, reach: np.ndarray, person: float = PERSON) -> np.ndarray:
    """Everything that is not floor the visitor's body can be over: the squares to build boxes on."""
    r = int(np.ceil(person / room["cell"]))
    return ~_shift_or(reach, r)     # the body reaches `person` beyond the centre


def boxes(grid: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Cover the true squares with rectangles (row, col, rows, cols), greedily, without overlap."""
    todo = grid.copy()
    out = []
    rows, cols = todo.shape
    for r in range(rows):
        c = 0
        while c < cols:
            if not todo[r, c]:
                c += 1
                continue
            w = 1
            while c + w < cols and todo[r, c + w]:
                w += 1
            h = 1
            while r + h < rows and todo[r + h, c:c + w].all():
                h += 1
            todo[r:r + h, c:c + w] = False
            out.append((r, c, h, w))
            c += w
    return out


def mesh(room: dict, grid: np.ndarray, floor: float = 0.0, height: float = WALL_HEIGHT, border: int = 8):
    """Triangles of the boxes over `grid`, and a floor under everything. Returns (positions, indices).

    Only boxes within `border` squares of floor the visitor can reach are built: the rest of the
    plan is far behind walls and would only make the file bigger.
    """
    near = _shift_or(~grid, border)
    x0, z0 = room["origin"]
    cell = room["cell"]
    pos: list[tuple[float, float, float]] = []
    idx: list[int] = []

    def box(xa, xb, za, zb, ya, yb):
        base = len(pos)
        for x, y, z in ((xa, ya, za), (xb, ya, za), (xb, ya, zb), (xa, ya, zb), (xa, yb, za), (xb, yb, za), (xb, yb, zb), (xa, yb, zb)):
            pos.append((x, y, z))
        for a, b, c in ((0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)):
            idx.extend((base + a, base + b, base + c))

    for r, c, h, w in boxes(grid & near):
        box(x0 + c * cell, x0 + (c + w) * cell, z0 + r * cell, z0 + (r + h) * cell, floor, floor + height)
    rows, cols = grid.shape
    box(x0, x0 + cols * cell, z0, z0 + rows * cell, floor - 0.2, floor)       # the floor, as a slab
    return np.asarray(pos, dtype=np.float32), np.asarray(idx, dtype=np.uint32)


def write_glb(path: Path, positions: np.ndarray, indices: np.ndarray) -> int:
    """A minimal binary glTF: one mesh, positions and indices, nothing else."""
    vb, ib = positions.astype("<f4").tobytes(), indices.astype("<u4").tobytes()
    blob = vb + ib
    blob += b"\0" * (-len(blob) % 4)
    doc = {
        "asset": {"version": "2.0", "generator": "luxhouse-tour collider"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "collider"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}]}],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(vb), "target": 34962},
            {"buffer": 0, "byteOffset": len(vb), "byteLength": len(ib), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions), "type": "VEC3",
             "min": [float(v) for v in positions.min(axis=0)], "max": [float(v) for v in positions.max(axis=0)]},
            {"bufferView": 1, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
    }
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(blob)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(text), b"JSON") + text)
        f.write(struct.pack("<I4s", len(blob), b"BIN\0") + blob)
    return total


def build(points: np.ndarray, start: tuple[float, float], out: Path, floor: float = 0.0) -> dict:
    """Plan, reachable floor and collider file for one room. Returns what the tour records about it."""
    room = plan(points, floor)
    reach = walkable(room, start)
    grid = solid(room, reach)
    positions, indices = mesh(room, grid, floor)
    size = write_glb(out, positions, indices)
    rr, cc = np.nonzero(reach)
    x0, z0 = room["origin"]
    cell = room["cell"]
    return {
        "bytes": size,
        "triangles": int(len(indices) // 3),
        "floorArea": round(float(reach.sum()) * cell * cell, 1),     # square metres the visitor's centre can reach
        "bounds": {
            "min": [round(x0 + float(cc.min()) * cell, 2), floor, round(z0 + float(rr.min()) * cell, 2)],
            "max": [round(x0 + float(cc.max() + 1) * cell, 2), floor + WALL_HEIGHT, round(z0 + float(rr.max() + 1) * cell, 2)],
        },
        "plan": {"room": room, "reach": reach, "solid": grid},
    }
