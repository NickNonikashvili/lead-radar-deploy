#!/usr/bin/env python3
"""Build a room as a 3D space a visitor can walk around in.

A photograph shows a room from one spot. This tool has a world model (World Labs Atlas) build
the whole room from the listing's photographs of it. What the photographs show is kept; what
they do not show (the wall behind the photographer, the far side of a sofa, a hallway through a
door) is invented to fit. The tour then opens the room where the photographer stood and the
visitor walks freely: around the sofa, up to the window, back to the door.

A room is built in stages, each of which can be looked at before the next:

    python tools/tour/rooms.py --listing dighomi-garden-house --dry-run
    python tools/tour/rooms.py --listing <slug> --room 06 pose        photographs -> cameras and depth
    python tools/tour/rooms.py --listing <slug> --room 06 views       new viewpoints around the room
    python tools/tour/rooms.py --listing <slug> --room 06 check       do the views agree? + contact sheet
    python tools/tour/rooms.py --listing <slug> --room 06 drop r2v03 --why "invents a second door"
    python tools/tour/rooms.py --listing <slug> --room 06 splats      the 3D room itself (the paid step)
    python tools/tour/rooms.py --listing <slug> --room 06 collider    walls and furniture become solid
    python tools/tour/build_tour.py --listing <slug>                  the tour picks the room up

`views` places its own cameras (a few at a time, standing on floor the frames so far show as
free and looking at what they have not shown); `--plan file.json` gives them by hand instead, as
rounds of {"at": [x, y, z], "look": [x, y, z]}.

What is written:

    content/tour-worlds/<slug>/<room>/room.json     everything about the room: frames, cameras,
                                                    which were invented, operations, what was dropped
    content/tour-worlds/<slug>/<room>/views.jpg     all views on one sheet: look at it before `splats`
    public/media/listings/<slug>/tour/<room>/world.spz, collider.glb     what the tour loads
    .cache/tour-worlds/<slug>/<room>/               the frames and depth maps (fetched again if lost)

A room is named after the first photograph of it; photographs listed in that photo's
"sameSpaceAs" belong to the same room and open the same 3D space from their own viewpoint.

Money. `splats` costs 5,000 credits (5 US dollars) per room with refinement, 500 as a draft
(--draft); the other stages are small. Nothing that was started is ever started twice: every
piece of work carries a key derived from its content, a started reconstruction is written down
before waiting, and an interrupted run picks it up. Atlas has no call that reads the balance, so
a run that the account cannot pay for stops with a clear message (HTTP 402) and loses nothing.

Look before you publish. A generated room is plausible, not true. `check` drops nothing by
itself: read the sheet, compare with the photographs at full size, and drop a view that
contradicts them. The site marks these spaces as generated.

Needs WLT_API_KEY (see atlas.py).
"""

from __future__ import annotations

import argparse
import io
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlas  # noqa: E402
import collider  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
LISTINGS = ROOT / "content" / "listings"
PHOTOS = ROOT / "content" / "source-photos"
ROOMS = ROOT / "content" / "tour-worlds"
CACHE = ROOT / ".cache" / "tour-worlds"
MEDIA = ROOT / "public" / "media" / "listings"
EXTS = (".webp", ".jpg", ".jpeg", ".png")

# Rooms a visitor walks around in. Façades, aerial pictures and views are looked at, not walked.
INDOORS = {"living", "dining", "kitchen", "bedroom", "fireplace", "winterGarden", "office", "bathroom",
           "hall", "corridor", "entrance", "staircase"}
OUTDOORS = {"patio", "garden", "pool", "pergola", "terrace"}

SPLAT_CREDITS = {"refined": 5000, "draft": 500}     # docs.atlas.worldlabs.ai/posed-images-to-splats
CREDITS_PER_DOLLAR = 1000
EYE = 1.55            # walking eye height, metres
VIEW_HEIGHT = 1.35    # generated views stand between the photographer's tripod and a standing eye
RING_HEIGHT = 1.6     # the last round looks down at the room's centre from standing height
MAX_CONTEXT = 11      # more context frames than this and Atlas reconstructs depth in a second step


# ---------------------------------------------------------------- which rooms

def rooms_of(listing: dict) -> list[dict]:
    """The rooms of a listing: [{"room": first photo, "photos": [all photos of it], "type": room type}]."""
    out: list[dict] = []
    taken: set[str] = set()
    by_file = {p["file"]: p for p in listing["photos"]}
    for photo in listing["photos"]:
        name = photo["file"]
        if name in taken or photo.get("tour") is False:
            continue
        want = photo.get("world")
        if want is None:
            want = photo.get("room", "") in INDOORS | OUTDOORS
        if not want:
            continue
        group = [name] + [n for n in photo.get("sameSpaceAs", []) if n in by_file and n not in taken and by_file[n].get("tour") is not False]
        taken.update(group)
        out.append({"room": name, "photos": group, "type": photo.get("room", "")})
    return out


def grid_for(width: int, height: int) -> tuple[int, int]:
    """The Atlas grid a photograph is posed on: the closest in shape (landscape 3:2 goes to 16:9,
    which keeps the most pixels across the room)."""
    ratio = width / height
    if ratio >= 1.45:
        return (1280, 720)
    if ratio >= 1.0:
        return (960, 720)
    return (528, 704) if ratio >= 0.65 else (720, 1280)


# ---------------------------------------------------------------- the record

def room_dir(slug: str, room: str) -> Path:
    return ROOMS / slug / room


def cache_dir(slug: str, room: str) -> Path:
    return CACHE / slug / room


def scene_dir(slug: str, name: str) -> Path:
    return MEDIA / slug / "tour" / name


def load(slug: str, room: str) -> dict:
    f = room_dir(slug, room) / "room.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def save(slug: str, room: str, record: dict) -> None:
    f = room_dir(slug, room) / "room.json"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(record, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def kept(record: dict) -> list[dict]:
    return [f for f in record.get("frames", []) if not f.get("dropped")]


def find(folder: Path, name: str) -> Path | None:
    for ext in EXTS:
        p = folder / (name + ext)
        if p.exists():
            return p
    return None


def frame_files(api, slug: str, room: str, frame: dict) -> tuple[Path, Path]:
    """A frame's picture and depth map on disk, fetched from the project again if they are gone."""
    folder = cache_dir(slug, room)
    jpg, exr = folder / f"{frame['name']}.jpg", folder / f"{frame['name']}.exr"
    if not jpg.exists():
        api.download(frame["imageAsset"]["assetId"], jpg)
    if not exr.exists():
        api.download(frame["depth"]["depthAsset"]["assetId"], exr)
    return jpg, exr


def scene_points(api, slug: str, room: str, frames: list[dict], step: int = 2, colors: bool = False):
    """World points of the given frames (and their colours)."""
    pts, cols = [], []
    for frame in frames:
        jpg, exr = frame_files(api, slug, room, frame)
        depth = atlas.read_depth(exr)
        p, idx = atlas.world_points(frame["camera"], depth, step)
        pts.append(p)
        if colors:
            im = np.asarray(Image.open(jpg).convert("RGB").resize((depth.shape[1], depth.shape[0])))
            cols.append(im[idx[:, 0], idx[:, 1]])
    return (np.concatenate(pts), np.concatenate(cols)) if colors else np.concatenate(pts)


# ---------------------------------------------------------------- stage: pose

def pose(api, slug: str, room: dict, log=print) -> dict:
    """Upload the room's photographs and have their cameras and depth estimated, in one world."""
    record = load(slug, room["room"])
    if record.get("frames"):
        return record
    sources = []
    for name in room["photos"]:
        src = find(PHOTOS / slug, name)
        if src is None:
            raise RuntimeError(f"{slug}/{name}: source photo missing")
        sources.append((name, src))
    first = Image.open(sources[0][1])
    grid = grid_for(*first.size)
    assets = []
    for name, src in sources:
        buf = io.BytesIO()
        Image.open(src).convert("RGB").save(buf, "JPEG", quality=95)
        assets.append(api.upload(buf.getvalue(), f"{slug}-{name}.jpg"))
    body = {"frames": [{"imageAsset": {"assetId": a}} for a in assets], "targetResolution": list(grid)}
    if len(assets) > 1:
        body["refinePoses"] = True          # two views of one room are compared against each other later
    t0 = time.time()
    op = api.run("images2PosedRGBD", body, atlas.work_key("pose", slug, room["room"], assets, grid))
    frames = atlas.save_frames(api, op["response"]["frames"], cache_dir(slug, room["room"]), "p")
    for frame, (name, _) in zip(frames, sources):
        frame["photo"] = name
    cams = [f["camera"]["intrinsics"] for f in frames]
    focal = float(np.mean([c["fx"] for c in cams]))
    record = {
        "room": room["room"], "photos": room["photos"], "type": room["type"], "grid": list(grid),
        "intrinsics": {"width": grid[0], "height": grid[1], "fx": round(focal, 2), "fy": round(focal, 2), "cx": grid[0] / 2, "cy": grid[1] / 2},
        "frames": frames,
        "operations": [{"task": "images2PosedRGBD", "id": op["id"], "seconds": round(time.time() - t0)}],
        "made": time.strftime("%Y-%m-%d"),
    }
    save(slug, room["room"], record)
    log(f"  {slug}/{room['room']}: {len(frames)} photographs posed on {grid[0]}x{grid[1]} in {time.time() - t0:.0f}s")
    return record


# ---------------------------------------------------------------- stage: views

def preview_share(camera: dict, points: np.ndarray, scale: float = 0.25) -> float:
    """Share of a new view that the scene so far already fills (points drawn as small squares)."""
    k = camera["intrinsics"]
    w, h = int(k["width"] * scale), int(k["height"] * scale)
    u, v, z = atlas.project(camera, points)
    ok = (z > 0.15) & (u >= 0) & (u < k["width"]) & (v >= 0) & (v < k["height"])
    seen = np.zeros((h, w), dtype=bool)
    uu, vv = (u[ok] * scale).astype(int), (v[ok] * scale).astype(int)
    for du in (-1, 0, 1):
        for dv in (-1, 0, 1):
            seen[np.clip(vv + dv, 0, h - 1), np.clip(uu + du, 0, w - 1)] = True
    return float(seen.mean())


def standing_spots(points: np.ndarray, start: tuple[float, float], spacing: float = 0.5, clearance: float = 0.45):
    """Places to put a camera: floor a visitor can reach from the start, on a grid, with nothing
    nearer than `clearance` (a camera close to a thing gets it large and invented in its lens).
    Returns (spots, the room's plan, the floor a visitor can reach)."""
    room = collider.plan(points)
    reach = collider.walkable(room, start)
    cell = room["cell"]
    clear = reach & ~collider._shift_or(room["blocked"], int(math.ceil(clearance / cell)))
    step = max(1, round(spacing / cell))
    rr, cc = np.nonzero(clear[::step, ::step])
    x0, z0 = room["origin"]
    return [(x0 + (c * step + 0.5) * cell, z0 + (r * step + 0.5) * cell) for r, c in zip(rr, cc)], room, reach


def subject_of(points: np.ndarray, reach: np.ndarray, room: dict) -> tuple[float, float]:
    """The middle of what stands in the room: the centre of the largest thing a visitor can walk
    all the way around (a sofa group, a table, a bed with floor on every side). A room with
    nothing to walk around has its middle as subject."""
    cell = room["cell"]
    x0, z0 = room["origin"]
    rows, cols = reach.shape
    outside = np.zeros_like(reach)
    stack = [(r, c) for r in range(rows) for c in (0, cols - 1)] + [(r, c) for c in range(cols) for r in (0, rows - 1)]
    while stack:                      # everything that is not walkable floor and touches the edge of the plan
        r, c = stack.pop()
        if r < 0 or c < 0 or r >= rows or c >= cols or outside[r, c] or reach[r, c]:
            continue
        outside[r, c] = True
        stack.extend(((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)))
    islands = ~reach & ~outside       # not floor, and cut off from the walls by floor: something to walk around
    best: list[tuple[int, int]] = []
    seen = np.zeros_like(reach)
    for r0, c0 in zip(*np.nonzero(islands)):
        if seen[r0, c0]:
            continue
        seen[r0, c0] = True
        todo, members = [(r0, c0)], []
        while todo:
            r, c = todo.pop()
            members.append((r, c))
            for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= rr < rows and 0 <= cc < cols and islands[rr, cc] and not seen[rr, cc]:
                    seen[rr, cc] = True
                    todo.append((rr, cc))
        if len(members) > len(best):
            best = members
    if len(best) * cell * cell < 0.3:     # nothing bigger than a stool: look at the middle of the floor
        rr, cc = np.nonzero(reach)
        return x0 + (float(cc.mean()) + 0.5) * cell, z0 + (float(rr.mean()) + 0.5) * cell
    rr, cc = zip(*best)
    return x0 + (float(np.mean(cc)) + 0.5) * cell, z0 + (float(np.mean(rr)) + 0.5) * cell


def plan_round(points: np.ndarray, frames: list[dict], intrinsics: dict, start: tuple[float, float], count: int = 4,
               height: float = VIEW_HEIGHT, band: tuple[float, float] = (0.45, 0.9), ring: bool = False) -> list[dict]:
    """Cameras for one round, each standing on free floor.

    A `ring` round surrounds what stands in the room: its cameras are spread around the subject
    as evenly as the free floor allows, each looking down at it from standing height. Any other
    round explores: a camera stands away from the cameras so far and from the others of its
    round, and looks wherever its view is filled to between `band` by what is known (a view that
    is nearly full shows nothing new; one that is nearly empty gives the model nothing to hold
    on to)."""
    spots, room, reach = standing_spots(points, start)
    if not spots:
        return []
    subject = subject_of(points, reach, room)
    have = [np.array([f["camera"]["extrinsics"]["position"][0], f["camera"]["extrinsics"]["position"][2]]) for f in frames]

    def novelty(here: np.ndarray, cam: dict) -> float:
        """How different a view is from every frame so far: far away, or looking another way."""
        fwd = atlas.forward(cam)
        return min((float(np.linalg.norm(here - p)) + 2.0 * (1 - float(np.dot(fwd, atlas.forward(f["camera"])))) for p, f in zip(have, frames)), default=5.0)

    if ring:
        around = []
        for x, z in spots:
            dist = math.hypot(x - subject[0], z - subject[1])
            if not 1.0 <= dist <= 3.5:
                continue
            cam = atlas.look_at((x, height, z), (subject[0], 0.4, subject[1]), intrinsics)
            around.append((math.atan2(z - subject[1], x - subject[0]), novelty(np.array([x, z]), cam), cam))
        chosen: list[tuple[float, dict]] = []
        while around and len(chosen) < count:
            if not chosen:
                pick = max(around, key=lambda c: c[1])
            else:       # the spot whose direction from the subject is farthest from those taken
                gap = lambda c: min(abs(math.remainder(c[0] - a, 2 * math.pi)) for a, _ in chosen)
                pick = max(around, key=lambda c: (round(gap(c), 2), c[1]))
                if gap(pick) < 0.35:
                    break
            chosen.append((pick[0], pick[2]))
            around.remove(pick)
        return [cam for _, cam in chosen]

    candidates = []
    for x, z in spots:
        here = np.array([x, z])
        targets = [(x + 4 * math.cos(a), 0.9, z + 4 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)]
        targets.append((subject[0], 0.8, subject[1]))
        for target in targets:
            if math.hypot(target[0] - x, target[2] - z) < 0.8:
                continue
            cam = atlas.look_at((x, height, z), target, intrinsics)
            share = preview_share(cam, points)
            if not band[0] <= share <= band[1]:
                continue
            candidates.append((novelty(here, cam) + 1.0 - abs(share - (band[0] + band[1]) / 2), here, cam))
    picked: list[tuple[np.ndarray, dict]] = []
    candidates.sort(key=lambda c: -c[0])
    for _, here, cam in candidates:
        if len(picked) == count:
            break
        if all(np.linalg.norm(here - p) >= 1.2 for p, _ in picked):
            picked.append((here, cam))
    return [cam for _, cam in picked]


def nearest_context(frames: list[dict], cameras: list[dict], limit: int = MAX_CONTEXT) -> list[dict]:
    """The frames to show the model: all of them, or the ones nearest the new cameras."""
    if len(frames) <= limit:
        return frames
    targets = np.array([c["extrinsics"]["position"] for c in cameras])
    photos = [f for f in frames if not f.get("generated")]
    rest = sorted((f for f in frames if f.get("generated")),
                  key=lambda f: float(np.min(np.linalg.norm(targets - np.array(f["camera"]["extrinsics"]["position"]), axis=1))))
    return (photos + rest)[:limit]


def generate(api, slug: str, room: str, cameras: list[dict], tag: str, log=print) -> list[dict]:
    """One round of new views, with depth, added to the room's record."""
    record = load(slug, room)
    frames = kept(record)
    context = nearest_context(frames, cameras)
    body = {"contextFrames": [atlas.frame_request(f) for f in context], "targetCameras": cameras, "returnDepth": True}
    if record.get("prompt"):      # the scene's description from the first round: the same room, and no re-captioning
        body["prompt"], body["enhancePrompt"] = record["prompt"], False
    t0 = time.time()
    op = api.run("atlasGenerate", body, atlas.work_key("views", slug, room, tag, body), limit=1800)
    new = atlas.save_frames(api, op["response"]["frames"], cache_dir(slug, room), f"{tag}v")
    for frame in new:
        frame["generated"], frame["round"] = True, tag
    record = load(slug, room)
    record["frames"] += new
    if op["response"].get("promptUsed") and not record.get("prompt"):
        record["prompt"] = op["response"]["promptUsed"]
    record["operations"].append({"task": "atlasGenerate", "id": op["id"], "round": tag, "views": len(new), "context": [f["name"] for f in context], "seconds": round(time.time() - t0)})
    save(slug, room, record)
    log(f"  {slug}/{room}: round {tag}, {len(new)} views in {time.time() - t0:.0f}s")
    return new


def views(api, slug: str, room: str, plan: list[list[dict]] | None = None, rounds: int = 3, log=print) -> dict:
    """Build the room out: rounds of a few views each, until it is seen from all around."""
    record = load(slug, room)
    if not record.get("frames"):
        raise RuntimeError("pose the room first")
    done = {f.get("round") for f in record["frames"] if f.get("generated")}
    start_cam = record["frames"][0]["camera"]["extrinsics"]["position"]
    start = (start_cam[0], start_cam[2])
    for i in range(rounds if plan is None else len(plan)):
        tag = f"r{i + 1}"
        if tag in done:
            continue
        frames = kept(load(slug, room))
        if plan is not None:
            cameras = [atlas.look_at(c["at"], c["look"], record["intrinsics"]) for c in plan[i]]
        else:
            points = scene_points(api, slug, room, frames)
            last = i == rounds - 1
            cameras = plan_round(points, frames, record["intrinsics"], start, count=4,
                                 height=RING_HEIGHT if last else VIEW_HEIGHT, ring=last,
                                 band=(0.45, 0.85) if i == 0 else (0.5, 0.95))
        if not cameras:
            log(f"  {slug}/{room}: no place left to stand for round {tag}")
            break
        generate(api, slug, room, cameras, tag, log)
    return load(slug, room)


# ---------------------------------------------------------------- stage: check

def agreement(api, slug: str, room: str) -> list[dict]:
    """How well each frame's depth agrees with the points of all the others.

    For every frame: `agree` is the share of the other frames' points that land on its surface
    (within 5 %), `floating` the share that hang in front of it by more than 15 % (a sign that
    the view disagrees with the others; things behind its surface are simply hidden), and
    `depth` the share of the frame that has depth at all.
    """
    record = load(slug, room)
    frames = kept(record)
    depths, points = {}, {}
    for frame in frames:
        _, exr = frame_files(api, slug, room, frame)
        depths[frame["name"]] = atlas.read_depth(exr)
        points[frame["name"]] = atlas.world_points(frame["camera"], depths[frame["name"]], 4)[0]
    rows = []
    for frame in frames:
        name, d, k = frame["name"], depths[frame["name"]], frame["camera"]["intrinsics"]
        others = np.concatenate([p for n, p in points.items() if n != name]) if len(points) > 1 else np.zeros((0, 3))
        u, v, z = atlas.project(frame["camera"], others)
        ok = (z > 0.2) & (u >= 0) & (u < k["width"] - 1) & (v >= 0) & (v < k["height"] - 1)
        own = d[v[ok].astype(int), u[ok].astype(int)]
        m = np.isfinite(own)
        rel = (z[ok][m] - own[m]) / own[m] if m.any() else np.zeros(0)
        rows.append({
            "name": name, "depth": round(float(np.isfinite(d).mean()), 2),
            "agree": round(float((np.abs(rel) < 0.05).mean()), 2) if len(rel) else None,
            "floating": round(float((rel < -0.15).mean()), 3) if len(rel) else None,
        })
    return rows


def contact_sheet(api, slug: str, room: str, width: int = 640, cols: int = 3) -> Path:
    """All frames of the room on one sheet: the photographs first, then each round of views."""
    record = load(slug, room)
    tiles = []
    for frame in record["frames"]:
        jpg, _ = frame_files(api, slug, room, frame)
        im = Image.open(jpg).convert("RGB")
        im = im.resize((width, round(im.height * width / im.width)))
        label = f"{frame['name']}  photograph {frame['photo']}" if frame.get("photo") else f"{frame['name']}  generated"
        if frame.get("dropped"):
            label += "  DROPPED"
            im = Image.blend(im, Image.new("RGB", im.size, (120, 0, 0)), 0.45)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 8 + 7 * len(label), 20], fill=(0, 0, 0))
        d.text((5, 4), label, fill=(255, 255, 255) if frame.get("photo") else (255, 220, 0))
        tiles.append(im)
    tw, th = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols, th * rows), (18, 18, 18))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
    out = room_dir(slug, room) / "views.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=82)
    return out


def drop(slug: str, room: str, name: str, why: str) -> None:
    record = load(slug, room)
    for frame in record["frames"]:
        if frame["name"] == name:
            if frame.get("photo"):
                raise RuntimeError("a photograph is never dropped")
            frame["dropped"] = why or "disagrees with the other views"
            save(slug, room, record)
            return
    raise RuntimeError(f"no frame called {name}")


# ---------------------------------------------------------------- stage: splats

def splats(api, slug: str, room: str, draft: bool = False, log=print) -> dict:
    """Reconstruct the room as Gaussian splats and put the file where the tour loads it."""
    record = load(slug, room)
    frames = kept(record)
    kind = "draft" if draft else "refined"
    names = [f["name"] for f in frames]
    state = record.setdefault("splats", {}).get(kind) or {}
    target = scene_dir(slug, room) / "world.spz"
    if state.get("assetId") and state.get("frames") == names:
        if not target.exists() or record["splats"].get("shown") != kind:
            api.download(state["assetId"], target)
            record["splats"]["shown"] = kind
            save(slug, room, record)
        return record
    if len(frames) < 2:
        raise RuntimeError("a room needs at least two frames")
    if not state.get("operation") or state.get("frames") != names:
        body: dict = {"posedFrames": [atlas.frame_request(f) for f in frames]}
        if record.get("prompt"):
            body["prompt"], body["enhancePrompt"] = record["prompt"], False
        if record.get("regionOfInterest"):      # a box around the room and where it is viewed from, when one was set
            body["regionOfInterest"] = record["regionOfInterest"]
        if draft:
            body["refine"] = False
        op = api.submit("posedImages2Splats", body, atlas.work_key("splats", slug, room, kind, body))
        state = {"operation": op["id"], "frames": names, "pending": True, "started": time.strftime("%Y-%m-%d %H:%M")}
        record["splats"][kind] = state
        record["operations"].append({"task": "posedImages2Splats", "id": op["id"], "kind": kind, "credits": SPLAT_CREDITS[kind]})
        save(slug, room, record)        # written before waiting: a started reconstruction is paid for
        log(f"  {slug}/{room}: {kind} reconstruction started" + ("" if draft else ", this takes 15 to 25 minutes"))
    op = api.wait(state["operation"], limit=5400, every=15)
    response = op["response"]
    if response.get("refinedSplats"):
        count, asset = max(response["refinedSplats"].items(), key=lambda kv: int(kv[0]))
    else:
        count, asset = None, response["draftSplat"]
    size = api.download(asset["assetId"], target)
    record = load(slug, room)
    record["splats"][kind] = {"operation": state["operation"], "frames": names, "assetId": asset["assetId"],
                              "splats": int(count) if count else None, "bytes": size, "made": time.strftime("%Y-%m-%d")}
    record["splats"]["shown"] = kind
    save(slug, room, record)
    log(f"  {slug}/{room}: {kind} splats, {size / 1e6:.1f} MB")
    return record


# ---------------------------------------------------------------- stage: collider

def collide(api, slug: str, room: str, log=print) -> dict:
    """Work out where the visitor can stand and write the solid shapes."""
    record = load(slug, room)
    frames = kept(record)
    points = scene_points(api, slug, room, frames)
    start = record["frames"][0]["camera"]["extrinsics"]["position"]
    info = collider.build(points, (start[0], start[2]), scene_dir(slug, room) / "collider.glb")
    record["collider"] = {k: v for k, v in info.items() if k != "plan"}
    save(slug, room, record)
    log(f"  {slug}/{room}: {info['floorArea']} m2 of floor to walk on, {info['triangles']} triangles")
    return record


# ---------------------------------------------------------------- what the tour gets

def scene_entry(slug: str, photo: str) -> dict | None:
    """The `world` of a tour scene: the room's files and where this photograph stood in it."""
    folder = ROOMS / slug
    if not folder.exists():
        return None
    for f in sorted(folder.glob("*/room.json")):
        record = json.loads(f.read_text(encoding="utf-8"))
        if photo not in record.get("photos", []):
            continue
        room = record["room"]
        if not (scene_dir(slug, room) / "world.spz").exists() or not (scene_dir(slug, room) / "collider.glb").exists():
            return None
        frame = next((fr for fr in record["frames"] if fr.get("photo") == photo), None)
        if frame is None or not record.get("collider"):
            return None
        prefix = "" if photo == room else f"../{room}/"
        ext = frame["camera"]["extrinsics"]
        return {
            "splat": prefix + "world.spz", "collider": prefix + "collider.glb", "convention": "three",
            "start": {"position": [round(v, 4) for v in ext["position"]], "quaternion": [round(v, 5) for v in ext["quaternion"]]},
            "eye": EYE, "radius": 0.08, "bounds": record["collider"]["bounds"],
            "draft": record.get("splats", {}).get("shown") == "draft",
        }
    return None


# ---------------------------------------------------------------- command line

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", nargs="?", choices=["pose", "views", "check", "drop", "splats", "collider"])
    ap.add_argument("name", nargs="?", help="for `drop`: the frame to drop, e.g. r2v03")
    ap.add_argument("--listing", help="listing slug")
    ap.add_argument("--room", help="the room, by its first photograph, e.g. 06")
    ap.add_argument("--plan", help="for `views`: a JSON file of rounds of cameras placed by hand")
    ap.add_argument("--why", default="", help="for `drop`: what is wrong with the view")
    ap.add_argument("--draft", action="store_true", help="for `splats`: the quick, cheap, rougher reconstruction")
    ap.add_argument("--dry-run", action="store_true", help="list the rooms of the listing and what they would cost")
    args = ap.parse_args()
    if not args.listing:
        ap.error("give --listing <slug>")
    listing = json.loads((LISTINGS / f"{args.listing}.json").read_text(encoding="utf-8"))
    rooms = rooms_of(listing)
    if args.dry_run or not args.stage:
        total = 0
        for r in rooms:
            record = load(args.listing, r["room"])
            state = "built" if record.get("splats", {}).get("refined", {}).get("assetId") else "draft" if record.get("splats", {}).get("draft", {}).get("assetId") else "views" if any(f.get("generated") for f in record.get("frames", [])) else "posed" if record.get("frames") else "to do"
            total += 0 if state == "built" else SPLAT_CREDITS["refined"]
            print(f"  {r['room']} ({r['type']}), photographs {', '.join(r['photos'])}: {state}")
        print(f"{args.listing}: {len(rooms)} rooms; reconstructing the rest costs {total} credits (${total / CREDITS_PER_DOLLAR:.0f}) plus the small steps")
        return
    room = next((r for r in rooms if r["room"] == args.room), None)
    if room is None:
        ap.error(f"--room must be one of: {', '.join(r['room'] for r in rooms)}")
    api = atlas.Atlas()
    try:
        if args.stage == "pose":
            pose(api, args.listing, room)
        elif args.stage == "views":
            plan = json.loads(Path(args.plan).read_text(encoding="utf-8")) if args.plan else None
            views(api, args.listing, room["room"], plan)
            print(f"  sheet: {contact_sheet(api, args.listing, room['room']).relative_to(ROOT)}")
        elif args.stage == "check":
            for row in agreement(api, args.listing, room["room"]):
                print(f"  {row['name']:7s} depth {row['depth']:.2f}  agrees {row['agree']}  floating {row['floating']}")
            print(f"  sheet: {contact_sheet(api, args.listing, room['room']).relative_to(ROOT)}")
        elif args.stage == "drop":
            if not args.name:
                ap.error("drop needs the frame's name")
            drop(args.listing, room["room"], args.name, args.why)
        elif args.stage == "splats":
            splats(api, args.listing, room["room"], args.draft)
        elif args.stage == "collider":
            collide(api, args.listing, room["room"])
    except atlas.OutOfCredit as err:
        raise SystemExit(f"stopped: {err}. Add credit at atlas.worldlabs.ai (Settings, Developer Platform) and run the same command again; nothing is lost or paid twice.")


if __name__ == "__main__":
    main()
