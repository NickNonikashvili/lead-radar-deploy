#!/usr/bin/env python3
"""Build the 3D tour of a residence from its photographs.

    python tools/tour/build_tour.py --listing dighomi-stone-villa
    python tools/tour/build_tour.py --all
    python tools/tour/build_tour.py --fixture test/fixtures/tour      (synthetic test scenes)

For every photo of the listing (in gallery order) this estimates depth with
the chosen provider, packs the result (see pack.py) and writes

    public/media/listings/<slug>/tour/<photo>/{color.webp,geo.bin,thumb.webp}
    public/media/listings/<slug>/tour/tour.json

A photo is skipped when the listing marks it with "tour": false.
Depth estimates are cached in .cache/tour/ so re-packing does not re-run the model.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pack  # noqa: E402
import providers  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
LISTINGS = ROOT / "content" / "listings"
PHOTOS = ROOT / "content" / "source-photos"
MEDIA = ROOT / "public" / "media" / "listings"
CACHE = ROOT / ".cache" / "tour"
EXTS = (".webp", ".jpg", ".jpeg", ".png")
VERSION = 1


def find_photo(slug: str, name: str) -> Path | None:
    for ext in EXTS:
        p = PHOTOS / slug / (name + ext)
        if p.exists():
            return p
    return None


def cached(provider, slug: str, name: str, photo: Path, refresh: bool) -> dict:
    """Run the depth provider, or load its saved output for this photo."""
    file = CACHE / provider.name / slug / f"{name}.npz"
    if file.exists() and not refresh and file.stat().st_mtime >= photo.stat().st_mtime:
        z = np.load(file)
        return {
            "image": providers.load_photo(photo),
            "depth": z["depth"].astype(np.float32),
            "mask": z["mask"],
            "normal": z["normal"].astype(np.float32) if "normal" in z.files else None,
            "points": None,
            "fx": float(z["fx"]),
            "fy": float(z["fy"]),
        }
    out = provider(photo)
    file.parent.mkdir(parents=True, exist_ok=True)
    save = {"depth": out["depth"].astype(np.float32), "mask": out["mask"], "fx": out["fx"], "fy": out["fy"]}
    if out.get("normal") is not None:
        save["normal"] = out["normal"].astype(np.float16)
    np.savez_compressed(file, **save)
    return out


def build_listing(slug: str, provider, only: set[str] | None, refresh: bool) -> int:
    listing_file = LISTINGS / f"{slug}.json"
    if not listing_file.exists():
        raise SystemExit(f"no such listing: {slug}")
    listing = json.loads(listing_file.read_text(encoding="utf-8"))
    out_root = MEDIA / slug / "tour"
    out_root.mkdir(parents=True, exist_ok=True)
    manifest_file = out_root / "tour.json"
    previous = {}
    if manifest_file.exists():
        previous = {s["id"]: s for s in json.loads(manifest_file.read_text(encoding="utf-8")).get("scenes", [])}

    scenes = []
    for photo in listing["photos"]:
        name = photo["file"]
        if photo.get("tour") is False:
            continue
        if only and name not in only:
            if name in previous:
                scenes.append(previous[name])   # keep scenes we were not asked to rebuild
            continue
        src = find_photo(slug, name)
        if src is None:
            print(f"  ! {slug}/{name}: source photo missing, skipped", file=sys.stderr)
            continue
        t0 = time.time()
        est = cached(provider, slug, name, src, refresh)
        entry = pack.pack_scene(out_root / name, est["image"], est["depth"], est["mask"], est.get("normal"), est["fx"], est["fy"], est.get("points"))
        scene = {"id": name, "photo": name, "room": photo.get("room", ""), "base": f"{name}/"}
        scene.update(entry)
        scenes.append(scene)
        hfov = np.degrees(2 * np.arctan(0.5 / est["fx"]))
        eye = "-" if entry["eyeHeight"] is None else f'{entry["eyeHeight"]:.2f} m'
        print(f"  {slug}/{name}: hfov {hfov:5.1f}°  depth {entry['depth']['depthMin']:.2f}–{entry['depth']['depthMax']:.2f} m  eye {eye}  "
              f"geo {entry['bytes']['geo'] / 1024:.0f} kB  {time.time() - t0:.1f}s")

    if not scenes:
        raise SystemExit(f"{slug}: no scenes were built")
    manifest = {"version": VERSION, "generator": f"luxhouse-tour/{VERSION} ({provider.name})", "scenes": scenes}
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"  -> {manifest_file.relative_to(ROOT)} ({len(scenes)} scenes)")
    return len(scenes)


def build_fixture(out_root: Path, count: int = 2) -> None:
    """Synthetic scenes with exact depth, for the automated viewer test."""
    provider = providers.SyntheticProvider()
    rooms = ["living", "bedroom", "kitchen"]
    scenes = []
    for i in range(count):
        est = provider(variant=i)
        name = f"{i + 1:02d}"
        entry = pack.pack_scene(out_root / name, est["image"], est["depth"], est["mask"], est["normal"], est["fx"], est["fy"], est["points"])
        scene = {"id": name, "photo": name, "room": rooms[i % len(rooms)], "base": f"{name}/"}
        scene.update(entry)
        scenes.append(scene)
    manifest = {"version": VERSION, "generator": f"luxhouse-tour/{VERSION} (synthetic)", "fixture": True, "scenes": scenes}
    (out_root / "tour.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"fixture -> {out_root} ({count} scenes)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--listing", action="append", default=[], help="listing slug (repeatable)")
    ap.add_argument("--all", action="store_true", help="every listing in content/listings")
    ap.add_argument("--only", default="", help="comma-separated photo names to rebuild, e.g. 01,07")
    ap.add_argument("--provider", default="moge", choices=["moge", "synthetic"])
    ap.add_argument("--model", default=None, help="MoGe model id or local checkpoint path")
    ap.add_argument("--threads", type=int, default=None, help="CPU threads for the depth model")
    ap.add_argument("--refresh", action="store_true", help="ignore cached depth estimates")
    ap.add_argument("--fixture", default=None, help="write synthetic test scenes into this folder and exit")
    args = ap.parse_args()

    if args.fixture:
        build_fixture(Path(args.fixture))
        return

    slugs = sorted(p.stem for p in LISTINGS.glob("*.json")) if args.all else args.listing
    if not slugs:
        ap.error("give --listing <slug>, --all or --fixture <dir>")
    provider = providers.get(args.provider, model=args.model, threads=args.threads) if args.provider == "moge" else providers.get("synthetic")
    only = {s.strip() for s in args.only.split(",") if s.strip()} or None
    total = 0
    for slug in slugs:
        print(slug)
        total += build_listing(slug, provider, only, args.refresh)
    print(f"done: {total} scenes")


if __name__ == "__main__":
    main()
