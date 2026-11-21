#!/usr/bin/env python3
"""World Labs Atlas: the calls and the geometry the room builder needs.

Atlas works on *posed frames*: an image, the camera it was taken with, and a depth map, all in
one shared world. A room is built in four kinds of step (docs.atlas.worldlabs.ai):

    images2PosedRGBD     photographs -> posed frames (camera and depth are estimated)
    atlasGenerate        posed frames + new cameras -> new posed frames (what they do not show
                         is invented)
    posedImages2Splats   posed frames -> Gaussian splats (.spz), the thing the tour draws
    splats2Mesh          splats -> a mesh and collider boxes, which keep the visitor out of walls

This module holds the HTTP side (assets, tasks, operations, downloads) and the camera and depth
arithmetic (world points from a frame, a camera that looks at a point, how much of a new view is
already known). rooms.py decides what to build with them.

Conventions, as the API states them: the world is Y-up and level; a camera pose is
camera-to-world with an [x, y, z, w] quaternion; cameras look along their own -Z ("rub": right,
up, back); depth is the distance along the view axis, in the same unit as camera positions; a
depth of NaN, 0 or infinity means no surface.

Needs a project API key in WLT_API_KEY (atlas.worldlabs.ai -> Developers -> API keys, with the
scopes tasks.create, operations.read, assets.create, assets.read).
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

API = os.environ.get("WLT_API_BASE_URL", "https://api.atlas.worldlabs.ai/api/v2")
GRIDS = ((1280, 720), (960, 720), (528, 704), (720, 1280))   # the sizes Atlas generates at


class OutOfCredit(RuntimeError):
    """The project cannot pay for more work (HTTP 402): stop instead of trying the next step."""


class ApiError(RuntimeError):
    def __init__(self, status: int, detail: str):
        super().__init__(f"HTTP {status}: {detail}")
        self.status = status
        self.detail = detail


class TaskFailed(RuntimeError):
    """An accepted task ended with an error. Failed runs are not charged."""


# ---------------------------------------------------------------- HTTP

class Atlas:
    """The Atlas Developer API. Tests put a stand-in in its place."""

    def __init__(self, key: str | None = None, base: str = API, log=print):
        self.key = key if key is not None else os.environ.get("WLT_API_KEY")
        self.base = base
        self.log = log

    def call(self, method: str, path: str, body: dict | None = None, idempotency: str | None = None, timeout: float = 120) -> dict:
        headers = {"Accept": "application/json"}
        if self.key:
            headers["WLT-Api-Key"] = self.key
        if idempotency:
            headers["Idempotency-Key"] = idempotency
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        last: Exception | None = None
        for attempt in range(6):
            wait = min(60.0, 4.0 * 2 ** attempt)
            try:
                req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=timeout) as res:
                    return json.loads(res.read() or b"{}")
            except urllib.error.HTTPError as err:
                detail = err.read().decode("utf-8", "replace")[:1200]
                if err.code == 402:
                    raise OutOfCredit(f"the Atlas project is out of credit or over its spend limit ({detail[:200]})")
                last = ApiError(err.code, detail)
                # A submission is only repeated when it carries an idempotency key: the retry then
                # returns the first attempt's operation instead of starting (and charging) a second.
                retryable = err.code in (429, 500, 502, 503, 504) and (method != "POST" or idempotency or ":" not in path.rsplit("/", 1)[-1])
                if not retryable:
                    break
                after = err.headers.get("Retry-After")
                if after and after.isdigit():
                    wait = max(wait, float(after))
            except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as err:
                last = RuntimeError(str(err))
                if method == "POST" and not idempotency and path.startswith("/tasks"):
                    break
            time.sleep(wait)
        raise last

    # ---- assets

    def upload(self, data: bytes, name: str) -> str:
        """Store a file in the project (inline, so under 10 MiB). Returns its asset id."""
        if len(data) >= 10 * 1024 * 1024:
            raise ValueError(f"{name}: {len(data) / 1e6:.1f} MB is too large to send inline")
        asset = self.call("POST", "/assets", {"asset": {"displayName": name, "base64": base64.b64encode(data).decode()}})
        if asset.get("state") != "READY":
            raise RuntimeError(f"{name}: asset is {asset.get('state')}, not READY")
        return asset["id"]

    def read_url(self, asset_id: str) -> str:
        return self.call("POST", f"/assets/{asset_id}:createReadUrl", {})["readUrl"]

    def download(self, asset_id: str, target: Path) -> int:
        """Fetch an asset's bytes through a fresh signed link (no key is sent with it)."""
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + ".part")
        last: Exception | None = None
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(self.read_url(asset_id)), timeout=900) as res, open(tmp, "wb") as out:
                    while chunk := res.read(1 << 20):
                        out.write(chunk)
                tmp.replace(target)
                return target.stat().st_size
            except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
                last = err
                time.sleep(5 * (attempt + 1))
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"could not download {asset_id}: {last}")

    # ---- tasks and operations

    def submit(self, task: str, body: dict, key: str) -> dict:
        """Start a task. `key` names this piece of work: sending it again returns the same operation."""
        return self.call("POST", f"/tasks:{task}", body, idempotency=key)

    def operation(self, op_id: str) -> dict:
        return self.call("GET", f"/operations/{op_id}")

    def wait(self, op_id: str, limit: float = 3600.0, every: float = 5.0) -> dict:
        """Poll an operation until it is done. Raises TaskFailed if it ended with an error."""
        t0 = time.time()
        said = None
        while True:
            op = self.operation(op_id)
            if op.get("done"):
                if op.get("error"):
                    reason = next((d.get("reason") for d in op["error"].get("details", []) if d.get("reason")), "")
                    raise TaskFailed(f"{op_id}: {op['error'].get('message')} {reason}".strip())
                return op
            meta = op.get("metadata") or {}
            state = " ".join(str(meta[k]) for k in ("phase", "state", "progress") if meta.get(k) is not None)
            if state and state != said:
                self.log(f"    {state}")
                said = state
            if time.time() - t0 > limit:
                raise TimeoutError(f"operation {op_id} still running after {limit / 60:.0f} min; it keeps running, wait for it again later")
            time.sleep(min(every, 30.0))
            every *= 1.15

    def run(self, task: str, body: dict, key: str, limit: float = 3600.0) -> dict:
        op = self.submit(task, body, key)
        return op if op.get("done") and not op.get("error") else self.wait(op["id"], limit)


def work_key(*parts) -> str:
    """A stable idempotency key for one piece of work (128 characters at most)."""
    text = json.dumps(parts, sort_keys=True, default=str)
    return "luxhouse-" + hashlib.sha256(text.encode()).hexdigest()[:40]


# ---------------------------------------------------------------- frames on disk

def asset_ref(asset: dict) -> dict:
    """How a request names a stored file: by id only (links expire)."""
    return {"assetId": asset["assetId"]}


def frame_request(frame: dict) -> dict:
    """A posed frame as atlasGenerate (context) and posedImages2Splats want it."""
    return {
        "imageAsset": asset_ref(frame["imageAsset"]),
        "depth": {"depthAsset": asset_ref(frame["depth"]["depthAsset"])},
        "camera": frame["camera"],
    }


def save_frames(api: Atlas, frames: list[dict], folder: Path, prefix: str) -> list[dict]:
    """Download each frame's image, depth and confidence; return the frames with local paths."""
    out = []
    for i, frame in enumerate(frames):
        name = f"{prefix}{i:02d}"
        kept = {"name": name, "camera": frame["camera"], "imageAsset": asset_ref(frame["imageAsset"])}
        api.download(frame["imageAsset"]["assetId"], folder / f"{name}.jpg")
        depth = frame.get("depth") or {}
        if depth.get("depthAsset"):
            kept["depth"] = {"depthAsset": asset_ref(depth["depthAsset"])}
            api.download(depth["depthAsset"]["assetId"], folder / f"{name}.exr")
            if depth.get("confidenceAsset"):
                kept["depth"]["confidenceAsset"] = asset_ref(depth["confidenceAsset"])
                api.download(depth["confidenceAsset"]["assetId"], folder / f"{name}.conf.png")
        if frame.get("centroidWorld"):
            kept["centroidWorld"] = frame["centroidWorld"]
        out.append(kept)
    return out


def read_depth(path: Path) -> np.ndarray:
    """A linear-depth EXR as float32 rows from the top; no surface is NaN."""
    import OpenEXR

    with OpenEXR.File(str(path)) as f:
        channels = f.channels()
        name = next(iter(channels))
        depth = np.asarray(channels[name].pixels, dtype=np.float32)
    if depth.ndim == 3:
        depth = depth[..., 0]
    depth = depth.copy()
    depth[~np.isfinite(depth) | (depth <= 0)] = np.nan
    return depth


# ---------------------------------------------------------------- cameras

def quat_to_matrix(q) -> np.ndarray:
    x, y, z, w = (float(v) for v in q)
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def matrix_to_quat(m: np.ndarray) -> list[float]:
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        w, x, y, z = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, x, y, z = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, x, y, z = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, x, y, z = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    return [round(float(v), 6) for v in (x, y, z, w)]


def look_at(position, target, intrinsics: dict) -> dict:
    """A level camera (no roll) at `position` looking at `target`, in the API's shape."""
    eye = np.asarray(position, dtype=float)
    back = eye - np.asarray(target, dtype=float)          # the camera's +Z points away from what it sees
    back /= np.linalg.norm(back)
    right = np.cross([0.0, 1.0, 0.0], back)
    right /= np.linalg.norm(right)
    up = np.cross(back, right)
    m = np.stack([right, up, back], axis=1)
    return {
        "extrinsics": {"position": [round(float(v), 4) for v in eye], "quaternion": matrix_to_quat(m), "coordinateSystem": "rub"},
        "intrinsics": dict(intrinsics),
    }


def camera_axes(camera: dict) -> tuple[np.ndarray, np.ndarray]:
    """(position, rotation) with rotation columns = the camera's right, up and back in the world."""
    ext = camera["extrinsics"]
    m = quat_to_matrix(ext["quaternion"])
    if ext.get("coordinateSystem", "rub") == "rdf":       # right, down, forward -> right, up, back
        m = m @ np.diag([1.0, -1.0, -1.0])
    return np.asarray(ext["position"], dtype=float), m


def forward(camera: dict) -> np.ndarray:
    return -camera_axes(camera)[1][:, 2]


def world_points(camera: dict, depth: np.ndarray, step: int = 2, confidence: np.ndarray | None = None, min_conf: float = 0.0):
    """World positions of a frame's pixels (every `step`-th), and their (v, u) pixel indices."""
    k = camera["intrinsics"]
    h, w = depth.shape
    v, u = np.mgrid[0:h:step, 0:w:step]
    z = depth[::step, ::step]
    keep = np.isfinite(z)
    if confidence is not None:
        keep &= confidence[::step, ::step] >= min_conf
    u, v, z = u[keep].astype(np.float64), v[keep].astype(np.float64), z[keep].astype(np.float64)
    sx = w / k["width"]
    sy = h / k["height"]
    cam = np.stack([(u / sx - k["cx"]) / k["fx"] * z, -(v / sy - k["cy"]) / k["fy"] * z, -z], axis=1)
    pos, rot = camera_axes(camera)
    return cam @ rot.T + pos, np.stack([v, u], axis=1).astype(np.int32)


def project(camera: dict, points: np.ndarray):
    """Pixel coordinates (u, v) and view-axis depth of world points in a camera."""
    pos, rot = camera_axes(camera)
    cam = (points - pos) @ rot
    z = -cam[:, 2]
    k = camera["intrinsics"]
    with np.errstate(divide="ignore", invalid="ignore"):
        u = cam[:, 0] / z * k["fx"] + k["cx"]
        v = -cam[:, 1] / z * k["fy"] + k["cy"]
    return u, v, z


def known_share(camera: dict, points: np.ndarray, cell: int = 16, near: float = 0.15) -> tuple[float, float]:
    """How much of a new view is already known, and how close the nearest known surface is.

    The view is divided into cells of `cell` pixels; a cell is known when a point of the scene
    so far falls in it. Returns (share of cells known, 2nd-percentile depth of what is seen).
    """
    k = camera["intrinsics"]
    u, v, z = project(camera, points)
    ok = (z > near) & (u >= 0) & (u < k["width"]) & (v >= 0) & (v < k["height"])
    if not ok.any():
        return 0.0, float("inf")
    gw, gh = math.ceil(k["width"] / cell), math.ceil(k["height"] / cell)
    seen = np.zeros((gh, gw), dtype=bool)
    seen[(v[ok] // cell).astype(int), (u[ok] // cell).astype(int)] = True
    return float(seen.mean()), float(np.percentile(z[ok], 2))
