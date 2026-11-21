"""Checks of the world-generating tool that need no network and spend nothing.

    python tools/tour/test_worlds.py
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import worlds  # noqa: E402


class FakeApi:
    """Stands in for the World API: remembers the calls, answers from a script."""

    def __init__(self, credits=5000.0, polls_until_done=2, fail=None):
        self.credits = credits
        self.polls = polls_until_done
        self.fail = fail
        self.calls = []
        self.downloads = []

    def world(self):
        return {
            "world_id": "w-1",
            "world_marble_url": "https://marble.worldlabs.ai/world/w-1",
            "assets": {
                "caption": "A living room.",
                "splats": {
                    "spz_urls": {"500k": "https://cdn.example/500k.spz", "100k": "https://cdn.example/100k.spz", "full_res": "https://cdn.example/full.spz"},
                    "semantics_metadata": {"metric_scale_factor": 1.5, "ground_plane_offset": 0.4},
                },
                "mesh": {"collider_mesh_url": "https://cdn.example/collider.glb"},
                "imagery": {"pano_url": None},
            },
        }

    def call(self, method, path, body=None):
        self.calls.append((method, path, body))
        if path == "/credits":
            return {"remaining_credits": self.credits}
        if path == "/worlds:generate":
            return {"operation_id": "op-1", "done": False}
        if path.startswith("/operations/"):
            self.polls -= 1
            if self.polls > 0:
                return {"operation_id": "op-1", "done": False, "metadata": {"progress": {"status": "IN_PROGRESS"}}}
            if self.fail:
                return {"operation_id": "op-1", "done": True, "error": {"message": self.fail}}
            return {"operation_id": "op-1", "done": True, "error": None, "response": self.world(), "cost": {"total_credits": 1580}}
        if path.startswith("/worlds/"):
            return {"world": self.world()}
        raise AssertionError(f"unexpected call {method} {path}")

    def download(self, url, target):
        self.downloads.append(url)
        Path(target).write_bytes(b"x" * 10)
        return 10


class WorldsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.saved = (worlds.PHOTOS, worlds.RECORDS, worlds.MEDIA, worlds.time.sleep)
        worlds.PHOTOS, worlds.RECORDS, worlds.MEDIA = root / "photos", root / "records", root / "media"
        worlds.time.sleep = lambda s: None
        (worlds.PHOTOS / "home").mkdir(parents=True)
        Image.new("RGB", (1800, 1200), (120, 110, 100)).save(worlds.PHOTOS / "home" / "06.webp")
        self.photo = {"file": "06", "room": "living"}
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        worlds.PHOTOS, worlds.RECORDS, worlds.MEDIA, worlds.time.sleep = self.saved
        self.tmp.cleanup()

    def test_rooms_are_walked_and_facades_are_not(self):
        listing = {"photos": [
            {"file": "01", "room": "exterior"}, {"file": "15", "room": "aerial"}, {"file": "03", "room": "garden"},
            {"file": "06", "room": "living", "sameSpaceAs": ["07"]}, {"file": "07", "room": "living", "sameSpaceAs": ["06"]},
            {"file": "08", "room": "kitchen", "tour": False}, {"file": "09", "room": "bedroom", "world": False},
            {"file": "16", "room": "view", "world": True},
        ]}
        self.assertEqual([p["file"] for p in worlds.rooms_with_worlds(listing)], ["03", "06", "16"],
                         "one world per room; a listing can switch a photo on or off")

    def test_the_request_is_private_and_carries_the_photograph(self):
        body = worlds.request_body("home", {"file": "06", "worldPrompt": "Behind the camera is a plain wall."}, "QUJD", "marble-1.1", 7, None)
        self.assertEqual(body["permission"], {"public": False})
        self.assertEqual(body["model"], "marble-1.1")
        self.assertEqual(body["seed"], 7)
        prompt = body["world_prompt"]
        self.assertEqual(prompt["type"], "image")
        self.assertIs(prompt["is_pano"], False)
        self.assertEqual(prompt["image_prompt"], {"source": "data_base64", "data_base64": "QUJD", "extension": "png"})
        self.assertEqual(prompt["text_prompt"], "Behind the camera is a plain wall.")
        self.assertNotIn("text_prompt", worlds.request_body("home", {"file": "06"}, "QUJD", "marble-1.1", None, None)["world_prompt"])

    def test_a_world_is_made_recorded_and_offered_to_the_tour(self):
        api = FakeApi()
        line = worlds.make_world(api, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)
        self.assertIn("1580 credits ($1.26)", line)
        folder = worlds.scene_dir("home", "06")
        self.assertEqual(sorted(p.name for p in folder.iterdir()), ["collider.glb", "world-low.spz", "world.spz"])
        self.assertEqual(api.downloads, ["https://cdn.example/500k.spz", "https://cdn.example/100k.spz", "https://cdn.example/collider.glb"],
                         "the two-million-splat file is not fetched: too heavy for a web page")
        record = worlds.load_records("home")["06"]
        self.assertEqual((record["world_id"], record["credits"], record["scale"], record["ground"]), ("w-1", 1580, 1.5, 0.4))
        self.assertEqual(worlds.scene_entry("home", "06"),
                         {"splat": "world.spz", "collider": "collider.glb", "scale": 1.5, "ground": 0.4, "splatLow": "world-low.spz"})
        # A second run costs nothing.
        again = FakeApi()
        self.assertIn("already made", worlds.make_world(again, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet))
        self.assertEqual(again.calls, [])

    def test_nothing_is_started_that_the_balance_does_not_cover(self):
        api = FakeApi(credits=1500)
        with self.assertRaises(worlds.OutOfCredit):
            worlds.make_world(api, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)
        self.assertEqual([c[1] for c in api.calls], ["/credits"], "no generation request was sent")
        self.assertIsNone(worlds.scene_entry("home", "06"))

    def test_a_started_world_is_picked_up_instead_of_paid_for_twice(self):
        api = FakeApi(fail=None, polls_until_done=10**6)
        saved = worlds.time.time
        clock = iter(range(0, 10**7, 400))
        worlds.time.time = lambda: next(clock)
        try:
            with self.assertRaises(TimeoutError):
                worlds.make_world(api, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)
        finally:
            worlds.time.time = saved
        record = worlds.load_records("home")["06"]
        self.assertTrue(record["pending"])
        self.assertEqual(record["operation_id"], "op-1")
        self.assertIsNone(worlds.scene_entry("home", "06"), "an unfinished world is not shown")
        later = FakeApi(polls_until_done=1)
        worlds.make_world(later, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)
        self.assertNotIn("/worlds:generate", [c[1] for c in later.calls])
        self.assertNotIn("pending", worlds.load_records("home")["06"])

    def test_a_failed_generation_says_so(self):
        api = FakeApi(fail="content policy")
        with self.assertRaisesRegex(RuntimeError, "content policy"):
            worlds.make_world(api, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)

    def test_lost_files_are_fetched_again_without_paying(self):
        worlds.make_world(FakeApi(), "home", self.photo, "marble-1.1", None, None, False, log=self.quiet)
        (worlds.scene_dir("home", "06") / "world.spz").unlink()
        api = FakeApi()
        self.assertIn("fetched again", worlds.make_world(api, "home", self.photo, "marble-1.1", None, None, False, log=self.quiet))
        self.assertEqual([c[1] for c in api.calls], ["/worlds/w-1"])

    def test_costs_match_the_price_list(self):
        self.assertEqual(worlds.COST["marble-1.1"], 1500 + 80)
        self.assertEqual(worlds.COST["marble-1.1-plus"], 3000 + 80)

    def test_the_photograph_is_sent_at_a_sensible_size(self):
        import base64, io
        im = Image.open(io.BytesIO(base64.b64decode(worlds.photo_png(worlds.PHOTOS / "home" / "06.webp"))))
        self.assertEqual((im.format, im.size), ("PNG", (1536, 1024)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
