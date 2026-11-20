"""Pack one photo and its depth estimate into the files the 3D viewer loads.

Input (from a depth provider, see providers.py), all in OpenCV camera
coordinates (x right, y down, z forward), same size as the photo:

    image    HxWx3 uint8 RGB
    depth    HxW float32, metres along z
    mask     HxW bool, False where there is no surface (sky, reflections)
    normal   HxWx3 float32 unit normals, or None
    fx, fy   focal lengths divided by image width / height (cx = cy = 0.5)

Output per scene, written next to each other:

    color.webp   the photograph (projective texture of the front layer)
    bg.webp      inpainted colours for the surfaces hidden behind foreground objects
    geo.bin      gzip of two depth grids (front layer + hidden layer), see encode_geo()
    thumb.webp   small preview for the scene strip

The viewer rebuilds the 3D mesh from the grids, so nothing here depends on
a mesh format and the level of detail can be chosen per device.
"""

from __future__ import annotations

import gzip
import math
import struct

import cv2
import numpy as np

GRID_LONG_SIDE = 768        # grid vertices along the longer image side
EDGE_RTOL = 0.04            # relative depth jump (per ~2 px) that separates two surfaces
BAND_FRACTION = 0.11        # width of the hidden-layer band behind silhouettes, as a share of the long side
SKY_CODE = 65535
MAGIC = b"LHT1"


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


def _jumps(d: np.ndarray, rtol: float):
    """Depth discontinuities between 4-neighbours.

    Returns (link_h, link_v, near, far): link_* is True where two neighbours
    belong to the same surface; near/far mark the closer and the farther
    pixel of every jump.
    """
    a, b = d[:, :-1], d[:, 1:]
    jump_h = np.abs(a - b) > rtol * np.minimum(a, b)
    c, e = d[:-1, :], d[1:, :]
    jump_v = np.abs(c - e) > rtol * np.minimum(c, e)

    near = np.zeros(d.shape, bool)
    far = np.zeros(d.shape, bool)
    near[:, :-1] |= jump_h & (a < b)
    far[:, 1:] |= jump_h & (a < b)
    near[:, 1:] |= jump_h & (b < a)
    far[:, :-1] |= jump_h & (b < a)
    near[:-1, :] |= jump_v & (c < e)
    far[1:, :] |= jump_v & (c < e)
    near[1:, :] |= jump_v & (e < c)
    far[:-1, :] |= jump_v & (e < c)
    return ~jump_h, ~jump_v, near, far


def _geodesic_band(seed: np.ndarray, link_h: np.ndarray, link_v: np.ndarray, steps: int) -> np.ndarray:
    """Grow `seed` by up to `steps` pixels without ever crossing a depth jump."""
    region = seed.copy()
    frontier = seed.copy()
    for _ in range(steps):
        grow = np.zeros_like(region)
        grow[:, 1:] |= frontier[:, :-1] & link_h
        grow[:, :-1] |= frontier[:, 1:] & link_h
        grow[1:, :] |= frontier[:-1, :] & link_v
        grow[:-1, :] |= frontier[1:, :] & link_v
        frontier = grow & ~region
        if not frontier.any():
            break
        region |= frontier
    return region


def build_layers(image: np.ndarray, depth: np.ndarray, mask: np.ndarray, gw: int, gh: int):
    """Front-layer and hidden-layer depth grids plus the hidden layer's colours.

    The hidden layer continues the *far* surface behind every silhouette, so
    that stepping sideways reveals plausible wall/floor/sky instead of a hole.
    """
    d = sample_vertices(depth.astype(np.float32), gw, gh).copy()
    valid = sample_vertices(mask, gw, gh) & np.isfinite(d) & (d > 0)
    if not valid.any():
        raise ValueError("depth map has no valid pixels")

    d_min = float(np.percentile(d[valid], 0.1))
    d_max = float(np.percentile(d[valid], 99.9))
    d = np.clip(d, d_min, d_max)
    sky_dist = d_max * 3.0
    d_full = np.where(valid, d, sky_dist).astype(np.float32)

    cell_px = max(image.shape[1] / gw, image.shape[0] / gh)
    rtol = float(np.clip(EDGE_RTOL * max(1.0, cell_px / 2.0), EDGE_RTOL, 0.09))

    link_h, link_v, near, far = _jumps(d_full, rtol)

    band = max(6, round(BAND_FRACTION * max(gw, gh)))
    region = _geodesic_band(near, link_h, link_v, band)                     # where the hidden layer exists
    region_wide = _geodesic_band(near, link_h, link_v, round(band * 1.6))   # inpainting source kept away from the object
    # Openings onto the sky (windows, the edge of a roof) reveal far more when the visitor moves,
    # and sky is the one thing that can be continued safely: give those edges a wider band.
    sky_far = far & ~valid
    sky_band = np.zeros(d_full.shape, bool)
    if sky_far.any():
        beside_sky = near & (cv2.dilate(sky_far.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        sky_band = _geodesic_band(beside_sky, link_h, link_v, round(band * 2.5))
        region |= sky_band
        region_wide |= _geodesic_band(beside_sky, link_h, link_v, round(band * 3.2))

    bg_depth = np.zeros_like(d_full)
    bg_valid = np.zeros(d_full.shape, bool)
    bg_sky = np.zeros(d_full.shape, bool)
    bg_color = cv2.resize(image, (gw, gh), interpolation=cv2.INTER_AREA)

    if far.any() and region.any():
        # Depth: copy the nearest far-side pixel (the surface continues behind the object).
        src = np.where(far, 0, 255).astype(np.uint8)
        _, labels = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        lut = np.zeros(int(labels.max()) + 1, np.int64)
        flat_far = np.flatnonzero(far)
        lut[labels.ravel()[flat_far]] = flat_far
        nearest = lut[labels]
        cand = d_full.ravel()[nearest]
        cand_sky = (~valid).ravel()[nearest]
        # A light blur removes the streaks of the nearest-pixel copy; sky stays sky.
        smooth = cv2.GaussianBlur(np.where(cand_sky, 0, cand).astype(np.float32), (0, 0), 2.0)
        weight = cv2.GaussianBlur((~cand_sky).astype(np.float32), (0, 0), 2.0)
        cand = np.where(cand_sky, sky_dist, smooth / np.maximum(weight, 1e-6))
        # Only keep it where it really lies behind the front surface.
        keep = region & (cand > d_full * (1.0 + rtol * 0.5))
        # Beside an opening onto the sky, whatever is not explained by a nearer surface is sky.
        sky_fill = sky_band & valid & ~keep
        cand = np.where(sky_fill, sky_dist, cand)
        keep = keep | sky_fill
        bg_depth = np.where(keep, cand, 0).astype(np.float32)
        bg_valid = keep
        bg_sky = keep & (cand_sky | sky_fill)

        inpaint_mask = (region_wide.astype(np.uint8)) * 255
        bgr = cv2.cvtColor(bg_color, cv2.COLOR_RGB2BGR)
        bgr = cv2.inpaint(bgr, inpaint_mask, 4, cv2.INPAINT_TELEA)
        bg_color = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    info = {
        "near": d_min * 0.98,
        "far": d_max * 1.02,
        "skyDistance": sky_dist,
        "cut": rtol,
        "depthMin": d_min,
        "depthMedian": float(np.median(d[valid])),
        "depthMax": d_max,
        "validShare": float(valid.mean()),
        "hiddenShare": float(bg_valid.mean()),
    }
    return {"depth": d_full, "valid": valid}, {"depth": bg_depth, "valid": bg_valid, "sky": bg_sky, "color": bg_color}, info


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


def encode_geo(fg: dict, bg: dict, info: dict) -> bytes:
    """Binary container read by client/tour/geo.js.

    gzip( "LHT1" | u16 gw | u16 gh | f32 near | f32 far | f32 skyDistance | f32 cut | u16 version | u16 flags
          | front codes (predicted) | hidden codes (predicted) )
    """
    gh, gw = fg["depth"].shape
    near, far = info["near"], info["far"]
    fg_codes = _encode_codes(fg["depth"], np.ones_like(fg["valid"]), ~fg["valid"], near, far)
    bg_codes = _encode_codes(bg["depth"], bg["valid"], bg["sky"], near, far)
    header = struct.pack("<4sHHffffHH", MAGIC, gw, gh, near, far, info["skyDistance"], info["cut"], 1, 1)
    return gzip.compress(header + _predict(fg_codes) + _predict(bg_codes), compresslevel=9, mtime=0)


def decode_geo(blob: bytes):
    """Inverse of encode_geo (used by the self-test)."""
    raw = gzip.decompress(blob)
    magic, gw, gh, near, far, sky, cut, version, flags = struct.unpack_from("<4sHHffffHH", raw, 0)
    assert magic == MAGIC and version == 1
    off = struct.calcsize("<4sHHffffHH")
    n = gw * gh
    layers = []
    for _ in range(2):
        lo = np.frombuffer(raw, np.uint8, n, off).astype(np.int64)
        hi = np.frombuffer(raw, np.uint8, n, off + n).astype(np.int64)
        off += 2 * n
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
        layers.append(out.astype(np.uint16))
    return {"gw": gw, "gh": gh, "near": near, "far": far, "skyDistance": sky, "cut": cut, "front": layers[0], "hidden": layers[1]}


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
    ok = length > 0.5
    n, p = n[ok] / length[ok, None], p[ok]

    def refine(sign: float):
        up = cam_up.copy()
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
    fg, bg, info = build_layers(image, depth, mask, gw, gh)

    if points is None:
        # Rebuild camera-space points from depth and intrinsics for the floor estimate.
        u = (np.arange(w, dtype=np.float32) + 0.5) / w
        v = (np.arange(h, dtype=np.float32) + 0.5) / h
        x = (u[None, :] - 0.5) / fx * depth
        y = (v[:, None] - 0.5) / fy * depth
        points = np.stack([x, y, depth], axis=-1)
    up, eye = estimate_up(points, normal, mask & np.isfinite(depth))

    blob = encode_geo(fg, bg, info)
    (out_dir / "geo.bin").write_bytes(blob)
    tw, th = write_webp(out_dir / "color.webp", image, max_side=2048, quality=90)
    write_webp(out_dir / "bg.webp", bg["color"], quality=82)
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
        "stats": {"valid": round(info["validShare"], 4), "hidden": round(info["hiddenShare"], 4), "cut": round(info["cut"], 4)},
        "texture": [tw, th],
    }
