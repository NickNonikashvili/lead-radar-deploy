#!/usr/bin/env python3
"""Imagine a room from other standpoints.

A photograph shows a room from one spot. To let a visitor walk around in it, this tool asks an
image model for new photographs of the same room from other standpoints: turned to the left,
turned to the right, and from the far end looking back (so a sofa shows its back, and the wall
behind the photographer comes into view). Each result becomes its own space in the 3D tour,
right after the photograph it was made from, and is marked there as an AI-completed view.

    python tools/tour/imagine.py --listing dighomi-garden-house
    python tools/tour/imagine.py --all
    python tools/tour/imagine.py --listing <slug> --only 06,07 --views back --redo

The pictures are written to content/tour-views/<slug>/<photo>-<view>.webp and are content from
then on: look at every one, delete any that misrepresents the home, and run again if you like
(existing pictures are kept unless --redo is given). Then build the tours (build_tour.py).

What is imagined and what is not: the model keeps what the photograph shows and invents what it
does not show (the wall behind the camera, the backs of furniture). The site says so on every
such view. Which views a photo gets depends on its room type; a photo entry in the listing file
may set "views": ["back"] or "views": false, and "sameSpaceAs": ["07"] to name other photos of
the same room, which are then given to the model as well.

Needs an OpenAI API key in OPENAI_API_KEY (Images API, model gpt-image-2 by default).
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LISTINGS = ROOT / "content" / "listings"
PHOTOS = ROOT / "content" / "source-photos"
VIEWS = ROOT / "content" / "tour-views"
EXTS = (".webp", ".jpg", ".jpeg", ".png")
API = "https://api.openai.com/v1/images/edits"

# The order is the order of the walk: to one side, on to the far end, back along the other side.
ORDER = ("left", "back", "right")
AROUND = {"living", "dining", "kitchen", "bedroom", "fireplace", "winterGarden", "office"}
ACROSS = {"bathroom", "hall", "corridor", "entrance", "staircase", "patio", "garden", "pool", "pergola", "terrace"}
OUTDOORS = {"patio", "garden", "pool", "pergola", "terrace"}

STYLE = (
    "Wide-angle real estate photograph, camera at about chest height, level horizon, straight vertical lines, "
    "sharp, natural colours. No people, no text, no watermark, no logos."
)


def views_for(photo: dict) -> list[str]:
    chosen = photo.get("views")
    if chosen is False:
        return []
    if isinstance(chosen, list):
        return [v for v in ORDER if v in chosen]
    room = photo.get("room", "")
    if room in AROUND:
        return list(ORDER)
    if room in ACROSS:
        return ["back"]
    return []


def prompt_for(view: str, room: str, references: int) -> str:
    outdoors = room in OUTDOORS
    place = "outdoor space" if outdoors else "room"
    intro = f"The first image is a real estate photograph of {'an' if outdoors else 'a'} {place}."
    if references == 2:
        intro += f" The second image shows the same {place} from another standpoint."
    elif references > 2:
        intro += f" The other images show the same {place} from other standpoints."
    if view == "back":
        where = (
            f"taken from the opposite end of the {place}: the camera now stands at the far side that the first image "
            "faces, and looks back toward the place where the first image was taken from."
        )
        unseen = (
            "What was behind the first camera is now in view: complete it as a plausible, modest continuation of this "
            + ("property (the house itself, or the edge of the plot), consistent with what the images show."
               if outdoors else "room, consistent with its architecture.")
        )
    else:
        other = "right" if view == "left" else "left"
        where = (
            f"taken from the middle of the {place} with the camera turned 90 degrees to the {view.upper()} compared with "
            f"the first image: it now looks squarely at the side that is on the {view}-hand side of the first image. "
            f"What was straight ahead in the first image is now at the {other} edge of the frame, and what was behind "
            f"the first camera is toward the {view} edge."
        )
        unseen = "Parts that no image shows are completed as a plausible, modest continuation, consistent with the rest."
    keep = (
        f"Keep the {place} itself identical: the same "
        + ("ground, paving, planting, walls, fences, buildings and every object" if outdoors
           else "floor, walls, ceiling, windows, doors, built-in furniture and every piece of furniture")
        + ", in the same places, with the same materials, colours and style, seen from the new standpoint "
        "(things that showed their front now show their side or back). "
        + ("Wherever the images show the same part, the new photograph must agree with them. " if references > 1 else "")
        + "Keep the same daylight and time of day."
    )
    return f"{intro}\n\nCreate a new photorealistic photograph of the SAME {place}, {where}\n\n{keep} {unseen}\n\n{STYLE}"


def find(folder: Path, name: str) -> Path | None:
    for ext in EXTS:
        p = folder / (name + ext)
        if p.exists():
            return p
    return None


def png_bytes(path: Path, long_side: int = 1536) -> tuple[bytes, tuple[int, int]]:
    im = Image.open(path).convert("RGB")
    size = im.size
    scale = long_side / max(size)
    if scale < 1:
        im = im.resize((round(size[0] * scale), round(size[1] * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue(), size


def output_size(width: int, height: int) -> str:
    ratio = width / height
    return "1536x1024" if ratio > 1.15 else "1024x1536" if ratio < 0.87 else "1024x1024"


class OutOfCredit(RuntimeError):
    """The account cannot pay for more pictures: stop instead of trying every remaining view."""


def request_image(model: str, quality: str, size: str, prompt: str, images: list[bytes]) -> bytes:
    """One call to the Images API. Returns the picture as PNG bytes."""
    boundary = uuid.uuid4().hex
    parts = []

    def field(name: str, value: str):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())

    field("model", model)
    field("prompt", prompt)
    field("size", size)
    field("quality", quality)
    for i, data in enumerate(images):
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="image{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
            + data + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode())
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(API, data=b"".join(parts), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=600) as res:
                body = json.loads(res.read())
            return base64.b64decode(body["data"][0]["b64_json"])
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:400]
            last = RuntimeError(f"HTTP {err.code}: {detail}")
            if "insufficient_quota" in detail or "credit_balance" in detail:
                raise OutOfCredit("the OpenAI account has no credit left; add credit and run again (finished views are kept)")
            if err.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as err:
            last = RuntimeError(str(err))
        time.sleep(8 * (attempt + 1))
    raise last


def imagine_photo(slug: str, photo: dict, wanted: list[str], model: str, quality: str, redo: bool, log: dict) -> list[str]:
    """Make the views of one photograph. The far-end view is made first and then shown to the
    model for the two side views, so that what it invented stays the same in all three."""
    name = photo["file"]
    source = find(PHOTOS / slug, name)
    if source is None:
        return [f"  ! {slug}/{name}: source photo missing"]
    out_dir = VIEWS / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    first, (w, h) = png_bytes(source)
    size = output_size(w, h)
    same = [find(PHOTOS / slug, other) for other in photo.get("sameSpaceAs", [])]
    extra = [png_bytes(p)[0] for p in same if p is not None]
    lines = []
    for view in sorted(wanted, key=lambda v: v != "back"):
        target = out_dir / f"{name}-{view}.webp"
        if target.exists() and not redo:
            continue
        refs = [first] + extra
        back = out_dir / f"{name}-back.webp"
        if view != "back" and back.exists():
            refs.append(png_bytes(back)[0])
        refs = refs[:4]
        t0 = time.time()
        try:
            png = request_image(model, quality, size, prompt_for(view, photo.get("room", ""), len(refs)), refs)
        except OutOfCredit:
            raise
        except RuntimeError as err:
            lines.append(f"  ! {slug}/{name}-{view}: {err}")
            continue
        Image.open(io.BytesIO(png)).convert("RGB").save(target, "WEBP", quality=92, method=6)
        log[f"{name}-{view}"] = {"of": name, "view": view, "model": model, "quality": quality, "made": time.strftime("%Y-%m-%d")}
        lines.append(f"  {slug}/{name}-{view}: {size}  {time.time() - t0:.0f}s")
    return lines


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--listing", action="append", help="listing slug (repeatable)")
    ap.add_argument("--all", action="store_true", help="every listing in content/listings")
    ap.add_argument("--only", help="comma-separated photo names, e.g. 06,07")
    ap.add_argument("--views", help="comma-separated views to make (left,back,right); default depends on the room")
    ap.add_argument("--model", default="gpt-image-2")
    ap.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    ap.add_argument("--parallel", type=int, default=3, help="photos worked on at the same time")
    ap.add_argument("--redo", action="store_true", help="make views again even if they exist")
    ap.add_argument("--dry-run", action="store_true", help="list what would be made, and print one prompt")
    args = ap.parse_args()

    slugs = sorted(p.stem for p in LISTINGS.glob("*.json") if not p.name.startswith("_")) if args.all else (args.listing or [])
    if not slugs:
        ap.error("give --listing <slug> or --all")
    only = set(args.only.split(",")) if args.only else None
    limit = set(args.views.split(",")) if args.views else None

    made = 0
    for slug in slugs:
        listing = json.loads((LISTINGS / f"{slug}.json").read_text(encoding="utf-8"))
        jobs = []
        for photo in listing["photos"]:
            if photo.get("tour") is False or (only and photo["file"] not in only):
                continue
            wanted = [v for v in views_for(photo) if not limit or v in limit]
            if wanted:
                jobs.append((photo, wanted))
        print(f"{slug}: {sum(len(w) for _, w in jobs)} views of {len(jobs)} photographs")
        if args.dry_run:
            for photo, wanted in jobs:
                print(f"  {photo['file']} ({photo.get('room', '')}): {', '.join(wanted)}")
            if jobs:
                print("\n" + prompt_for(jobs[0][1][0], jobs[0][0].get("room", ""), 1) + "\n")
            continue
        log_file = VIEWS / slug / "views.json"
        log = json.loads(log_file.read_text(encoding="utf-8")) if log_file.exists() else {}
        stopped = None
        pool = ThreadPoolExecutor(max_workers=max(1, args.parallel))
        try:
            for lines in pool.map(lambda job: imagine_photo(slug, job[0], job[1], args.model, args.quality, args.redo, log), jobs):
                for line in lines:
                    print(line, file=sys.stderr if line.lstrip().startswith("!") else sys.stdout, flush=True)
                    made += not line.lstrip().startswith("!")
        except OutOfCredit as err:
            stopped = err
        finally:
            pool.shutdown(wait=True, cancel_futures=True)
            if log:
                log_file.parent.mkdir(parents=True, exist_ok=True)
                log_file.write_text(json.dumps(dict(sorted(log.items())), indent=1) + "\n", encoding="utf-8")
        if stopped:
            raise SystemExit(f"stopped after {made} views: {stopped}")
    if not args.dry_run:
        print(f"done: {made} views")


if __name__ == "__main__":
    main()
