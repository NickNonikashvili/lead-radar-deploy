"""Pack one photo and its depth estimate into the files the 3D viewer loads.

Input (from a depth provider, see providers.py), all in OpenCV camera
coordinates (x right, y down, z forward), same size as the photo:

    image    HxWx3 uint8 RGB
    depth    HxW float32, metres along z
    mask     HxW bool, False where there is no surface (sky, reflections)
    normal   HxWx3 float32 unit normals, or None
    fx, fy   focal lengths divided by image width / height (cx = cy = 0.5)

Output per scene, written next to each other:

    color.webp   the photograph (projected back onto the mesh as its texture)
    geo.bin      gzip of the depth grid, see encode_geo()
    thumb.webp   small preview for the scene strip

The viewer rebuilds the 3D mesh from the grid, so nothing here depends on a
mesh format and the level of detail can be chosen per device. The mesh is one
continuous surface: on real rooms, cutting it at furniture edges and filling
the gaps looked torn as soon as the visitor moved, while a surface that simply
stretches a little reads as a soft edge. tame_depth() prepares the depth for
that.
"""

from __future__ import annotations

import gzip
import math
import struct

import cv2
import numpy as np

GRID_LONG_SIDE = 768        # grid vertices along the longer image side
SKY_CODE = 65535
MAGIC = b"LHT1"
GEO_VERSION = 2
HEADER = "<4sHHffffHH"


def grid_size(width: int, height: int, long_side: int = GRID_LONG_SIDE) -> tuple[int, int]:
    if width >= height:
        return long_side, max(2, round(long_side * height / width))
    return max(2, round(long_side * width / height)), long_side


def sample_vertices(arr: np.ndarray, gw: int, gh: int) -> np.ndarray:
    """Nearest-neighbour sample at grid vertices that span the full frame, corner to corner."""
    h, w = arr.shape[:2]
    xs = np.rint(np.linspace(0, w - 1, gw)).astype(np.intp)
    ys = np.rint(np.linspace(0, h - 1, gh)).astype(np.intp)
    return arr[ys[:, None], xs[None, :]]


THIN_SHARE = 0.10           # "thin" = narrower than this share of the grid's longer side
THIN_EXCESS = 0.06          # how far (1/m) a thin object may stand in front of what is behind it
EDGE_GROW = 2               # grid cells by which objects in front are widened


def tame_depth(d: np.ndarray) -> np.ndarray:
    """Make the depth grid kind to a viewer that moves.

    The viewer shows one continuous surface, so wherever something stands in front of something
    far away the surface stretches between them as the visitor moves. Two corrections keep that
    from showing:

      * Thin things in front of a distant background (leaves at the edge of the frame, pendant
        lamps, taps, chair legs) would smear right across it. They are moved back to just in
        front of what is behind them. They stay sharp and merely show less depth.
      * Objects in front are widened by a couple of cells, so the stretching happens in the
        background next to an object and its own outline stays rigid.

    Edges are deliberately left as steps. Sloping the background up to an object spreads the
    stretch but bends every straight line that passes behind it, which is worse in a building.
    """
    disp = (1.0 / d).astype(np.float32)
    border = cv2.BORDER_REPLICATE

    def disc(size: int):
        return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))

    # Opening removes everything nearer than its surroundings that is narrower than the kernel:
    # what is left is the scene without its thin foreground.
    k = max(3, int(round(max(d.shape) * THIN_SHARE))) | 1
    behind = cv2.morphologyEx(disp, cv2.MORPH_OPEN, disc(k), borderType=border)
    disp = np.minimum(disp, behind + THIN_EXCESS)
    disp = cv2.dilate(disp, disc(2 * EDGE_GROW + 1), borderType=border)
    return (1.0 / disp).astype(np.float32)


def build_grid(depth: np.ndarray, mask: np.ndarray, gw: int, gh: int, tame: bool = True):
    """Depth grid for the viewer: metres at every vertex, with the sky marked as such."""
    d = sample_vertices(depth.astype(np.float32), gw, gh).copy()
    valid = sample_vertices(mask, gw, gh) & np.isfinite(d) & (d > 0)
    if not valid.any():
        raise ValueError("depth map has no valid pixels")

    # Clamp the extreme 0.1 % at both ends: single wild pixels would otherwise set the range.
    d_min = float(np.percentile(d[valid], 0.1))
    d_max = float(np.percentile(d[valid], 99.9))
    d = np.clip(np.where(valid, d, d_max), d_min, d_max)
    # The sky is drawn just behind the farthest real surface: far enough to sit behind
    # everything, near enough that roof lines do not smear across it when the visitor moves.
    sky_dist = d_max * 1.5
    d_full = np.where(valid, d, sky_dist).astype(np.float32)
    if tame:
        d_full = np.clip(tame_depth(d_full), d_min, sky_dist).astype(np.float32)
    # Sky that an object was widened over belongs to that object now.
    surface = valid | (d_full < sky_dist * 0.999)

    info = {
        "near": d_min * 0.98,
        "far": sky_dist,
        "skyDistance": sky_dist,
        "depthMin": float(d_full[surface].min()),
        "depthMedian": float(np.median(d_full[valid])),
        "depthMax": d_max,
        "validShare": float(valid.mean()),
    }
    return {"depth": d_full, "valid": surface}, info


def _encode_codes(depth: np.ndarray, valid: np.ndarray, sky: np.ndarray, near: float, far: float) -> np.ndarray:
    """Log-depth codes: 0 = nothing here, 65535 = sky, 1..65534 = depth between near and far."""
    scale = 65533.0 / math.log(far / near)
    safe = np.clip(depth, near, far)
    codes = np.rint(np.log(safe / near) * scale).astype(np.int64) + 1
    codes = np.clip(codes, 1, 65534)
    codes[~valid] = 0
    codes[sky] = SKY_CODE
    return codes.astype(np.uint16)


def _predict(codes: np.ndarray) -> bytes:
    """Plane predictor (left + up - up-left), then low bytes and high bytes as separate planes."""
    c = codes.astype(np.int64)
    pred = np.zeros_like(c)
    pred[:, 1:] += c[:, :-1]
    pred[1:, :] += c[:-1, :]
    pred[1:, 1:] -= c[:-1, :-1]
    res = ((c - pred) & 0xFFFF).astype(np.uint16)
    return (res & 0xFF).astype(np.uint8).tobytes() + (res >> 8).astype(np.uint8).tobytes()


def encode_geo(grid: dict, info: dict) -> bytes:
    """Binary container read by client/tour/geo.js.

    gzip( "LHT1" | u16 gw | u16 gh | f32 near | f32 far | f32 skyDistance | f32 reserved | u16 version | u16 flags
          | depth codes (predicted; low bytes, then high bytes) )
    """
    gh, gw = grid["depth"].shape
    near, far = info["near"], info["far"]
    codes = _encode_codes(grid["depth"], np.ones_like(grid["valid"]), ~grid["valid"], near, far)
    header = struct.pack(HEADER, MAGIC, gw, gh, near, far, info["skyDistance"], 0.0, GEO_VERSION, 0)
    return gzip.compress(header + _predict(codes), compresslevel=9, mtime=0)


def decode_geo(blob: bytes):
    """Inverse of encode_geo (used by the self-test)."""
    raw = gzip.decompress(blob)
    magic, gw, gh, near, far, sky, _reserved, version, _flags = struct.unpack_from(HEADER, raw, 0)
    assert magic == MAGIC and version == GEO_VERSION
    off = struct.calcsize(HEADER)
    n = gw * gh
    lo = np.frombuffer(raw, np.uint8, n, off).astype(np.int64)
    hi = np.frombuffer(raw, np.uint8, n, off + n).astype(np.int64)
    res = (lo | (hi << 8)).reshape(gh, gw)
    out = np.zeros((gh, gw), np.int64)
    for y in range(gh):
        up = out[y - 1] if y else np.zeros(gw, np.int64)
        left = 0
        upleft = 0
        row = out[y]
        r = res[y]
        for x in range(gw):
            v = (r[x] + left + up[x] - upleft) & 0xFFFF
            row[x] = v
            left = v
            upleft = up[x]
    return {"gw": gw, "gh": gh, "near": near, "far": far, "skyDistance": sky, "front": out.astype(np.uint16)}


def estimate_up(points: np.ndarray | None, normal: np.ndarray | None, mask: np.ndarray):
    """Gravity direction and camera height from the floor (or ceiling) normals.

    Returns (up, eye_height). `up` is a unit vector in camera coordinates;
    `eye_height` is metres above the floor, or None when no floor is visible.
    Falls back to the camera's own up axis when the scene gives no evidence.
    """
    cam_up = np.array([0.0, -1.0, 0.0])
    if normal is None or points is None:
        return cam_up, None
    step = max(1, int(math.sqrt(mask.size / 120_000)))
    m = mask[::step, ::step]
    n = normal[::step, ::step][m].astype(np.float64)
    p = points[::step, ::step][m].astype(np.float64)
    if len(n) < 500:
        return cam_up, None
    length = np.linalg.norm(n, axis=1)
    ok = (length > 0.5) & np.isfinite(p).all(axis=1) & np.isfinite(n).all(axis=1)
    n, p = n[ok] / length[ok, None], p[ok]

    def refine(sign: float):
        up = cam_up.copy()
        sel = None
        for limit in (30.0, 15.0, 8.0):
            sel = (n @ up) * sign > math.cos(math.radians(limit))
            if sel.sum() < 0.004 * len(n):
                return None, None
            mean = (n[sel] * sign).mean(0)
            up = mean / np.linalg.norm(mean)
        return up, sel

    up, sel = refine(1.0)          # floor: normals point up
    if up is None:
        up, _ = refine(-1.0)       # no floor visible: use the ceiling
        if up is None or math.degrees(math.acos(float(np.clip(up @ cam_up, -1, 1)))) > 35:
            return cam_up, None
        return up, None
    if math.degrees(math.acos(float(np.clip(up @ cam_up, -1, 1)))) > 35:
        return cam_up, None

    below = -(p[sel] @ up)         # distance of floor points below the camera
    below = below[below > 0.3]
    eye = float(np.median(below)) if len(below) > 0.003 * len(n) else None
    return up, eye


def write_webp(path, rgb: np.ndarray, max_side: int | None = None, quality: int = 88) -> tuple[int, int]:
    h, w = rgb.shape[:2]
    if max_side and max(w, h) > max_side:
        s = max_side / max(w, h)
        rgb = cv2.resize(rgb, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    ok = cv2.imwrite(str(path), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_WEBP_QUALITY, quality])
    if not ok:
        raise OSError(f"could not write {path}")
    return rgb.shape[1], rgb.shape[0]


def pack_scene(out_dir, image, depth, mask, normal, fx, fy, points=None):
    """Write all files for one scene into `out_dir`; returns the scene's entry for tour.json."""
    out_dir.mkdir(parents=True, exist_ok=True)
    h, w = image.shape[:2]
    gw, gh = grid_size(w, h)
    grid, info = build_grid(depth, mask, gw, gh)

    finite = mask & np.isfinite(depth)
    if points is None:
        # Rebuild camera-space points from depth and intrinsics for the floor estimate.
        safe = np.where(finite, depth, 0).astype(np.float32)
        u = (np.arange(w, dtype=np.float32) + 0.5) / w
        v = (np.arange(h, dtype=np.float32) + 0.5) / h
        points = np.stack([(u[None, :] - 0.5) / fx * safe, (v[:, None] - 0.5) / fy * safe, safe], axis=-1)
    up, eye = estimate_up(points, normal, finite)

    blob = encode_geo(grid, info)
    (out_dir / "geo.bin").write_bytes(blob)
    for stale in ("bg.webp",):   # written by earlier versions of this tool
        (out_dir / stale).unlink(missing_ok=True)
    tw, th = write_webp(out_dir / "color.webp", image, max_side=2048, quality=92)
    write_webp(out_dir / "thumb.webp", image, max_side=360, quality=78)

    return {
        "width": w,
        "height": h,
        "fx": round(float(fx), 6),
        "fy": round(float(fy), 6),
        "grid": [gw, gh],
        "up": [round(float(c), 5) for c in up],
        "eyeHeight": None if eye is None else round(eye, 3),
        "depth": {k: round(float(info[k]), 4) for k in ("depthMin", "depthMedian", "depthMax")},
        "bytes": {"geo": len(blob)},
        "stats": {"valid": round(info["validShare"], 4)},
        "texture": [tw, th],
    }
