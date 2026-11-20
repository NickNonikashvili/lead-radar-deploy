"""Depth providers: turn a photo into metric depth, a validity mask, normals and focal length.

  moge       Microsoft MoGe-2 (MIT licence). Estimates metric geometry *and* the
             camera's field of view from a single photograph. Runs on CPU.
  synthetic  A ray-cast test room with exact depth, used by the automated tests
             so the packer and the viewer can be verified without any model.

Every provider returns a dict:
    image (HxWx3 uint8 RGB), depth (HxW float32 metres), mask (HxW bool),
    normal (HxWx3 float32 or None), points (HxWx3 float32 or None), fx, fy
with fx, fy as focal length divided by image width / height.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import cv2
import numpy as np

MOGE_MODEL = "Ruicheng/moge-2-vitl-normal"


def load_photo(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    bgr = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if bgr is None:
        raise OSError(f"cannot read image {path}")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


class MoGeProvider:
    """Wraps MoGe-2. The model is loaded once and reused for every photo."""

    name = "moge-2-vitl-normal"

    def __init__(self, model: str | None = None, threads: int | None = None):
        import torch  # imported lazily so the synthetic provider needs no ML stack

        try:
            from moge.model.v2 import MoGeModel
        except ImportError as err:  # pragma: no cover - depends on the local install
            raise SystemExit(
                "MoGe is not importable. Install it (see tools/tour/README.md), e.g.\n"
                "  pip install git+https://github.com/microsoft/MoGe.git\n"
                "or put a clone on PYTHONPATH."
            ) from err

        self.torch = torch
        if threads:
            torch.set_num_threads(threads)
        source = model or os.environ.get("MOGE_MODEL") or MOGE_MODEL
        self.model = MoGeModel.from_pretrained(source).eval()

    def __call__(self, photo: Path) -> dict:
        torch = self.torch
        image = load_photo(photo)
        tensor = torch.from_numpy(image).permute(2, 0, 1).float() / 255.0
        with torch.inference_mode():
            out = self.model.infer(tensor, resolution_level=9)
        depth = out["depth"].cpu().numpy().astype(np.float32)
        mask = out["mask"].cpu().numpy().astype(bool)
        k = out["intrinsics"].cpu().numpy()
        normal = out["normal"].cpu().numpy().astype(np.float32) if "normal" in out else None
        points = out["points"].cpu().numpy().astype(np.float32) if "points" in out else None
        return {"image": image, "depth": depth, "mask": mask, "normal": normal, "points": points, "fx": float(k[0, 0]), "fy": float(k[1, 1])}


# --------------------------------------------------------------------------- synthetic test room

def _box(origin, direction, lo, hi):
    """Slab test. Returns (t, normal) of the first hit of each ray with an axis-aligned box."""
    inv = 1.0 / np.where(np.abs(direction) < 1e-9, 1e-9, direction)
    t0 = (np.asarray(lo) - origin) * inv
    t1 = (np.asarray(hi) - origin) * inv
    tmin = np.minimum(t0, t1)
    tmax = np.maximum(t0, t1)
    t_enter = tmin.max(-1)
    t_exit = tmax.min(-1)
    hit = (t_exit > np.maximum(t_enter, 1e-4))
    axis = tmin.argmax(-1)
    normal = np.zeros(direction.shape, np.float32)
    sign = -np.sign(np.take_along_axis(direction, axis[..., None], -1))[..., 0]
    np.put_along_axis(normal, axis[..., None], sign[..., None], -1)
    return np.where(hit, t_enter, np.inf), normal


class SyntheticProvider:
    """A furnished room rendered analytically, so depth, normals and focal length are exact.

    World axes: x right, y up, z forward; the camera sits at the origin,
    1.45 m above the floor, pitched slightly down like a hand-held photo.
    `variant` moves the camera and furniture a little so several scenes differ.
    """

    name = "synthetic"

    def __init__(self, width: int = 1500, height: int = 1000, hfov_deg: float = 92.0):
        self.width, self.height, self.hfov = width, height, hfov_deg

    def __call__(self, photo: Path | None = None, variant: int = 0) -> dict:
        w, h = self.width, self.height
        fx_px = (w / 2) / math.tan(math.radians(self.hfov / 2))
        fx, fy = fx_px / w, fx_px / h
        pitch = math.radians(4.0 + variant)

        u = (np.arange(w, dtype=np.float32) + 0.5 - w / 2) / fx_px
        v = (np.arange(h, dtype=np.float32) + 0.5 - h / 2) / fx_px
        # Camera rays in camera coords (x right, y down, z forward), then to world (y up) with the pitch applied.
        cx, cy = np.meshgrid(u, v)
        cz = np.ones_like(cx)
        wy = -(cy * math.cos(pitch) + cz * math.sin(pitch))
        wz = -cy * math.sin(pitch) + cz * math.cos(pitch)
        direction = np.stack([cx, wy, wz], -1).astype(np.float32)
        origin = np.zeros(3, np.float32)

        eye = 1.45
        shift = 0.25 * variant
        room_lo, room_hi = (-2.7, -eye, -1.6), (2.5, 1.35, 5.2)
        boxes = [
            ((-2.4 + shift, -eye, 3.3), (-0.4 + shift, -0.72, 4.3), (0.55, 0.50, 0.46)),   # sofa
            ((-2.4 + shift, -0.72, 4.05), (-0.4 + shift, -0.30, 4.3), (0.50, 0.45, 0.42)),  # sofa back
            ((0.45, -eye, 2.0), (1.45, -1.02, 2.7), (0.36, 0.24, 0.16)),                    # coffee table
            ((1.95, -eye, 3.95), (2.03, 0.45, 4.03), (0.12, 0.12, 0.13)),                   # lamp pole
            ((1.72, 0.45, 3.72), (2.26, 0.85, 4.26), (0.92, 0.86, 0.70)),                   # lamp shade
        ]

        # Room: inside of a box -> take the exit distance.
        inv = 1.0 / np.where(np.abs(direction) < 1e-9, 1e-9, direction)
        t0 = (np.asarray(room_lo) - origin) * inv
        t1 = (np.asarray(room_hi) - origin) * inv
        tmax = np.maximum(t0, t1)
        t_room = tmax.min(-1)
        axis = tmax.argmin(-1)
        n_room = np.zeros(direction.shape, np.float32)
        np.put_along_axis(n_room, axis[..., None], -np.sign(np.take_along_axis(direction, axis[..., None], -1)), -1)

        t = t_room.copy()
        normal = n_room.copy()
        base = np.zeros(direction.shape, np.float32)
        hit_room = origin + direction * t_room[..., None]

        # Surfaces of the room: plank floor, plain ceiling, striped walls with a skirting board.
        floor = axis == 1
        is_floor = floor & (direction[..., 1] < 0)
        is_ceiling = floor & (direction[..., 1] > 0)
        plank = (np.floor(hit_room[..., 0] / 0.18) + np.floor(hit_room[..., 2] / 1.4 + np.floor(hit_room[..., 0] / 0.18) * 0.37)) % 3
        base[is_floor] = (np.array([0.50, 0.33, 0.20]) + 0.05 * plank[is_floor, None]).astype(np.float32)
        base[is_ceiling] = (0.93, 0.93, 0.91)
        wall = ~floor
        along = np.where(axis == 0, hit_room[..., 2], hit_room[..., 0])
        panel = (np.floor(along / 0.8) % 2)
        base[wall] = (np.array([0.82, 0.80, 0.74]) - 0.05 * panel[wall, None]).astype(np.float32)
        skirting = wall & (hit_room[..., 1] < -eye + 0.12)
        base[skirting] = (0.97, 0.97, 0.95)
        picture = (axis == 2) & (direction[..., 2] > 0) & (hit_room[..., 0] > -2.0) & (hit_room[..., 0] < -0.9) & (hit_room[..., 1] > -0.1) & (hit_room[..., 1] < 0.7)
        base[picture] = (0.20, 0.32, 0.45)

        # Window in the back wall: open to the sky (no surface).
        window = (axis == 2) & (direction[..., 2] > 0) & (hit_room[..., 0] > 0.3) & (hit_room[..., 0] < 1.9) & (hit_room[..., 1] > -0.45) & (hit_room[..., 1] < 0.95)
        mask = ~window

        for lo, hi, colour in boxes:
            tb, nb = _box(origin, direction, lo, hi)
            closer = tb < t
            t = np.where(closer, tb, t)
            normal = np.where(closer[..., None], nb, normal)
            hit = origin + direction * np.where(np.isfinite(tb), tb, 0.0)[..., None]
            stripe = (np.floor((hit[..., 0] + hit[..., 2]) / 0.25) % 2) * 0.06
            base = np.where(closer[..., None], np.asarray(colour, np.float32) - stripe[..., None], base)
            mask = mask | closer

        light = np.array([0.35, 0.85, -0.4], np.float32)
        light /= np.linalg.norm(light)
        shade = 0.55 + 0.45 * np.clip(normal @ light, 0, 1)
        colour = base * shade[..., None] * np.clip(1.08 - t[..., None] * 0.035, 0.6, 1.1)
        sky = np.stack([0.55 + 0.25 * (cy + 0.5), 0.70 + 0.15 * (cy + 0.5), np.full_like(cy, 0.93)], -1)
        colour = np.where(mask[..., None], colour, sky)
        image = (np.clip(colour, 0, 1) * 255).astype(np.uint8)

        # World -> camera coordinates (y down, pitch removed).
        pw = direction * t[..., None]
        cam_y = -(pw[..., 1] * math.cos(pitch) + pw[..., 2] * math.sin(pitch))
        cam_z = -pw[..., 1] * math.sin(pitch) + pw[..., 2] * math.cos(pitch)
        points = np.stack([pw[..., 0], cam_y, cam_z], -1).astype(np.float32)
        nw = normal
        n_cam = np.stack([nw[..., 0], -(nw[..., 1] * math.cos(pitch) + nw[..., 2] * math.sin(pitch)), -nw[..., 1] * math.sin(pitch) + nw[..., 2] * math.cos(pitch)], -1).astype(np.float32)
        depth = np.where(mask, cam_z, np.inf).astype(np.float32)
        return {"image": image, "depth": depth, "mask": mask, "normal": n_cam, "points": points, "fx": fx, "fy": fy, "eyeHeight": eye, "pitch": pitch}


def get(name: str, **kwargs):
    if name == "moge":
        return MoGeProvider(**kwargs)
    if name == "synthetic":
        return SyntheticProvider()
    raise SystemExit(f"unknown depth provider: {name}")
