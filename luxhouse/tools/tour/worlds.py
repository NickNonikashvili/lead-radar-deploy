#!/usr/bin/env python3
"""Generate a room as a 3D world a visitor can walk around in.

A photograph shows a room from one spot. This tool sends the photograph to a world model
(World Labs Marble, through its World API). The model builds the whole room as one 3D scene:
what the photograph shows is kept, and what it does not show (the wall behind the camera, the
backs of furniture, the far side of a kitchen island) is invented to fit. Two files come back
for each room: Gaussian splats, which the tour draws, and a collider mesh, which keeps the
visitor out of walls and furniture.

    python tools/tour/worlds.py --balance
    python tools/tour/worlds.py --listing dighomi-garden-house --dry-run
    python tools/tour/worlds.py --listing dighomi-garden-house --only 06
    python tools/tour/worlds.py --all
    python tools/tour/worlds.py --listing <slug> --only 06 --redo --model marble-1.1-plus

It writes

    public/media/listings/<slug>/tour/<photo>/{world.spz,world-low.spz,collider.glb}
    content/tour-worlds/<slug>.json            which world belongs to which photo, and what it cost
    content/tour-worlds/<slug>/<photo>.webp    the full panorama the model imagined, to look at

and then the tours have to be built again (build_tour.py), which adds the world to its scene.

Every world costs money (see COST below; about 1.3 US dollars at the time of writing), so:
the balance is read before each one and nothing is started that the balance does not cover; a
request that was started is written down at once and picked up again by the next run instead of
being paid for twice; and a finished world is never made again unless --redo is given.

Which photographs get a world depends on the room type. A photo entry in the listing file may set
"world": false or "world": true, "worldPrompt": "…" (a sentence about what the photograph does not
show, to steer the invention), and "sameSpaceAs": ["07"] (other photos of the same room: only the
first of them gets a world).

Look at every world before publishing it: walk around in it, and delete the scene's world files if
it misrepresents the home. The site marks these spaces as generated.

Needs a World API key in WORLDLABS_API_KEY (https://platform.worldlabs.ai, with API credits; the
Marble app's own credits do not count).
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
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LISTINGS = ROOT / "content" / "listings"
PHOTOS = ROOT / "content" / "source-photos"
RECORDS = ROOT / "content" / "tour-worlds"
MEDIA = ROOT / "public" / "media" / "listings"
EXTS = (".webp", ".jpg", ".jpeg", ".png")
API = "https://api.worldlabs.ai/marble/v1"

# Rooms a visitor walks around in. Façades, aerial pictures and views are looked at, not walked.
INDOORS = {"living", "dining", "kitchen", "bedroom", "fireplace", "winterGarden", "office", "bathroom",
           "hall", "corridor", "entrance", "staircase"}
OUTDOORS = {"patio", "garden", "pool", "pergola", "terrace"}

# Credits one world may cost, per model, from a single photograph (docs.worldlabs.ai/api/pricing):
# panorama from the photograph (80) + the world (1,500); the plus model may add up to 1,500 more.
COST = {"marble-1.1": 1580, "marble-1.1-plus": 3080, "marble-1.0": 1580, "marble-1.0-draft": 230}
CREDITS_PER_DOLLAR = 1250

# What the tour needs of a finished world: the name it gets in the scene folder, where to find it.
ASSETS = (
    ("world.spz", ("splats", "spz_urls", "500k")),
    ("world-low.spz", ("splats", "spz_urls", "100k")),
    ("collider.glb", ("mesh", "collider_mesh_url")),
)


class OutOfCredit(RuntimeError):
    """The account cannot pay for another world: stop instead of trying every remaining room."""


class ApiError(RuntimeError):
    def __init__(self, status: int, detail: str):
        super().__init__(f"HTTP {status}: {detail}")
        self.status = status
        self.detail = detail


class Api:
    """The few World API calls this tool makes. Tests put a stand-in in its place."""

    def __init__(self, key: str | None = None, base: str = API):
        self.key = key if key is not None else os.environ.get("WORLDLABS_API_KEY")
        self.base = base

    def call(self, method: str, path: str, body: dict | None = None) -> dict:
        headers = {"Accept": "application/json"}
        if self.key:
            headers["WLT-Api-Key"] = self.key
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        last: Exception | None = None
        for attempt in range(4):
            try:
                req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=120) as res:
                    return json.loads(res.read() or b"{}")
            except urllib.error.HTTPError as err:
                detail = err.read().decode("utf-8", "replace")[:600]
                if err.code == 402:
                    raise OutOfCredit("the World Labs account has no API credit left (platform.worldlabs.ai/billing)")
                last = ApiError(err.code, detail)
                # A request that starts a paid job is never sent twice on a doubtful answer.
                if err.code not in (429, 502, 503, 504) or (method == "POST" and err.code != 429):
                    break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
                last = RuntimeError(str(err))
                if method == "POST":
                    break
            time.sleep(6 * (attempt + 1))
        raise last

    def download(self, url: str, target: Path) -> int:
        """Fetch one finished asset. The links are signed: no key is sent with them."""
        tmp = target.with_suffix(target.suffix + ".part")
        last: Exception | None = None
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url), timeout=600) as res, open(tmp, "wb") as out:
                    while chunk := res.read(1 << 20):
                        out.write(chunk)
                tmp.replace(target)
                return target.stat().st_size
            except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
                last = err
                time.sleep(5 * (attempt + 1))
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"could not download {url.split('?')[0]}: {last}")


# ---------------------------------------------------------------- which photographs

def rooms_with_worlds(listing: dict) -> list[dict]:
    """The photographs of a listing that get a world, in gallery order."""
    chosen: list[dict] = []
    covered: set[str] = set()   # photos whose room is already covered by an earlier photo's world
    for photo in listing["photos"]:
        if photo.get("tour") is False:
            continue
        want = photo.get("world")
        if want is None:
            want = photo.get("room", "") in INDOORS | OUTDOORS and photo["file"] not in covered
        if want:
            chosen.append(photo)
            covered.update(photo.get("sameSpaceAs", []))
    return chosen


def find(folder: Path, name: str) -> Path | None:
    for ext in EXTS:
        p = folder / (name + ext)
        if p.exists():
            return p
    return None


def photo_png(path: Path, long_side: int = 1536) -> str:
    """The photograph as the model wants it: PNG, at most `long_side` pixels, base64."""
    im = Image.open(path).convert("RGB")
    scale = long_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def request_body(slug: str, photo: dict, image_b64: str, model: str, seed: int | None, prompt: str | None) -> dict:
    world_prompt: dict = {
        "type": "image",
        "image_prompt": {"source": "data_base64", "data_base64": image_b64, "extension": "png"},
        "is_pano": False,
    }
    text = prompt or photo.get("worldPrompt")
    if text:
        world_prompt["text_prompt"] = text
    body: dict = {
        "display_name": f"{slug} {photo['file']}"[:64],
        "model": model,
        "permission": {"public": False},
        "world_prompt": world_prompt,
    }
    if seed is not None:
        body["seed"] = seed
    return body


# ---------------------------------------------------------------- records

def records_file(slug: str) -> Path:
    return RECORDS / f"{slug}.json"


def load_records(slug: str) -> dict:
    f = records_file(slug)
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def save_records(slug: str, records: dict) -> None:
    f = records_file(slug)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(dict(sorted(records.items())), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def scene_dir(slug: str, name: str) -> Path:
    return MEDIA / slug / "tour" / name


def has_files(slug: str, name: str) -> bool:
    folder = scene_dir(slug, name)
    return (folder / "world.spz").exists() and (folder / "collider.glb").exists()


def scene_entry(slug: str, name: str) -> dict | None:
    """What build_tour.py writes into the scene of a photograph that has a finished world."""
    record = load_records(slug).get(name)
    if not record or record.get("pending") or not has_files(slug, name):
        return None
    entry = {"splat": "world.spz", "collider": "collider.glb", "scale": record.get("scale") or 1, "ground": record.get("ground")}
    if (scene_dir(slug, name) / "world-low.spz").exists():
        entry["splatLow"] = "world-low.spz"
    return entry


# ---------------------------------------------------------------- one world

def dig(obj, keys):
    for k in keys:
        obj = (obj or {}).get(k) if isinstance(obj, dict) else None
    return obj


def wait_for(api: Api, operation_id: str, every: float = 10.0, limit: float = 1800.0, log=print) -> dict:
    """Poll a started world until it is finished. Returns the operation."""
    t0 = time.time()
    said = None
    while True:
        op = api.call("GET", f"/operations/{operation_id}")
        if op.get("done"):
            if op.get("error"):
                raise RuntimeError(f"generation failed: {op['error'].get('message') or op['error']}")
            return op
        state = dig(op, ("metadata", "progress", "description")) or dig(op, ("metadata", "progress", "status"))
        if state and state != said:
            log(f"    {state}")
            said = state
        if time.time() - t0 > limit:
            raise TimeoutError(f"operation {operation_id} still running after {limit / 60:.0f} min; run again later to pick it up")
        time.sleep(every)


def fetch_assets(api: Api, slug: str, name: str, world: dict) -> dict:
    """Download a finished world into the scene folder. Returns the sizes in bytes."""
    assets = world.get("assets") or {}
    folder = scene_dir(slug, name)
    folder.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for filename, keys in ASSETS:
        url = dig(assets, keys)
        if not url:
            if filename == "world-low.spz":
                continue
            raise RuntimeError(f"the world has no {'/'.join(keys)} yet")
        sizes[filename] = api.download(url, folder / filename)
    pano = dig(assets, ("imagery", "pano_url"))
    if pano:   # the imagined panorama, kept beside the record for a quick look at what was invented
        raw = RECORDS / slug / f"{name}.pano"
        raw.parent.mkdir(parents=True, exist_ok=True)
        try:
            api.download(pano, raw)
            Image.open(raw).convert("RGB").save(RECORDS / slug / f"{name}.webp", "WEBP", quality=88, method=6)
        finally:
            raw.unlink(missing_ok=True)
    return sizes


def make_world(api: Api, slug: str, photo: dict, model: str, seed: int | None, prompt: str | None, redo: bool, log=print) -> str:
    """Generate (or pick up, or re-download) the world of one photograph. Returns a line for the log."""
    name = photo["file"]
    records = load_records(slug)
    record = records.get(name)
    if record and not record.get("pending") and not redo:
        if has_files(slug, name):
            return f"  {slug}/{name}: already made"
        world = api.call("GET", f"/worlds/{record['world_id']}").get("world") or {}
        sizes = fetch_assets(api, slug, name, world)
        return f"  {slug}/{name}: files fetched again ({sum(sizes.values()) / 1e6:.1f} MB)"

    t0 = time.time()
    if record and record.get("pending") and not redo:
        operation_id = record["operation_id"]
        log(f"  {slug}/{name}: picking up a world that was already started")
    else:
        source = find(PHOTOS / slug, name)
        if source is None:
            raise RuntimeError(f"{slug}/{name}: source photo missing")
        need = COST.get(model, max(COST.values()))
        have = float(api.call("GET", "/credits").get("remaining_credits", 0))
        if have < need:
            raise OutOfCredit(f"{have:.0f} credits left, a {model} world may cost {need}; add credit at platform.worldlabs.ai/billing")
        body = request_body(slug, photo, photo_png(source), model, seed, prompt)
        started = api.call("POST", "/worlds:generate", body)
        operation_id = started["operation_id"]
        records[name] = {"pending": True, "operation_id": operation_id, "model": model, "started": time.strftime("%Y-%m-%d %H:%M")}
        save_records(slug, records)   # written before waiting: a started world is paid for
        log(f"  {slug}/{name}: started ({model}), this takes about five minutes")

    op = wait_for(api, operation_id, log=log)
    world = op.get("response") or {}
    world_id = world.get("world_id") or world.get("id") or dig(op, ("metadata", "world_id"))
    if not dig(world, ("assets", "splats", "spz_urls")):
        world = api.call("GET", f"/worlds/{world_id}").get("world") or world
    sizes = fetch_assets(api, slug, name, world)
    meta = dig(world, ("assets", "splats", "semantics_metadata")) or {}
    records = load_records(slug)
    records[name] = {
        "world_id": world_id,
        "model": (record or {}).get("model") or model,
        "made": time.strftime("%Y-%m-%d"),
        "credits": dig(op, ("cost", "total_credits")),
        "scale": meta.get("metric_scale_factor"),
        "ground": meta.get("ground_plane_offset"),
        "caption": dig(world, ("assets", "caption")),
        "url": world.get("world_marble_url"),
        "bytes": sizes,
    }
    if seed is not None:
        records[name]["seed"] = seed
    save_records(slug, records)
    credits = records[name]["credits"]
    paid = f"{credits} credits (${credits / CREDITS_PER_DOLLAR:.2f})" if credits else "cost not reported"
    return f"  {slug}/{name}: {sum(sizes.values()) / 1e6:.1f} MB, {paid}, {time.time() - t0:.0f}s"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--listing", action="append", help="listing slug (repeatable)")
    ap.add_argument("--all", action="store_true", help="every listing in content/listings")
    ap.add_argument("--only", help="comma-separated photo names, e.g. 06,08")
    ap.add_argument("--model", default="marble-1.1", choices=sorted(COST))
    ap.add_argument("--seed", type=int, help="random seed, to get a different world with --redo")
    ap.add_argument("--prompt", help="a sentence about what the photograph does not show")
    ap.add_argument("--redo", action="store_true", help="make worlds again even if they exist (paid again)")
    ap.add_argument("--dry-run", action="store_true", help="list what would be made and what it may cost")
    ap.add_argument("--balance", action="store_true", help="print the credit balance and exit")
    args = ap.parse_args()

    api = Api()
    if args.balance:
        have = float(api.call("GET", "/credits").get("remaining_credits", 0))
        print(f"{have:.0f} credits (${have / CREDITS_PER_DOLLAR:.2f}); a {args.model} world may cost {COST[args.model]}")
        return

    slugs = sorted(p.stem for p in LISTINGS.glob("*.json") if not p.name.startswith("_")) if args.all else (args.listing or [])
    if not slugs:
        ap.error("give --listing <slug>, --all or --balance")
    only = set(args.only.split(",")) if args.only else None

    made = 0
    for slug in slugs:
        listing = json.loads((LISTINGS / f"{slug}.json").read_text(encoding="utf-8"))
        photos = [p for p in rooms_with_worlds(listing) if not only or p["file"] in only]
        if only:   # a photo named on the command line gets a world even if the rules would skip it
            named = {p["file"] for p in photos}
            photos += [p for p in listing["photos"] if p["file"] in only - named and p.get("tour") is not False]
        records = load_records(slug)
        todo = [p for p in photos if args.redo or not (p["file"] in records and not records[p["file"]].get("pending") and has_files(slug, p["file"]))]
        worst = len(todo) * COST[args.model]
        print(f"{slug}: {len(photos)} rooms, {len(todo)} to make (at most {worst} credits, ${worst / CREDITS_PER_DOLLAR:.2f})")
        if args.dry_run:
            for p in photos:
                state = "to make" if p in todo else "made"
                print(f"  {p['file']} ({p.get('room', '')}): {state}")
            continue
        for photo in photos:
            try:
                line = make_world(api, slug, photo, args.model, args.seed, args.prompt, args.redo)
            except OutOfCredit as err:
                raise SystemExit(f"stopped after {made} worlds: {err}")
            except (RuntimeError, TimeoutError) as err:
                print(f"  ! {slug}/{photo['file']}: {err}", file=sys.stderr, flush=True)
                continue
            print(line, flush=True)
            made += "already made" not in line
    if not args.dry_run:
        print(f"done: {made} worlds. Build the tours again: python tools/tour/build_tour.py --all")


if __name__ == "__main__":
    main()
