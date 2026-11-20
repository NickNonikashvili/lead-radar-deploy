"""Self-test of the tour packer against the synthetic room, where the truth is known.

    python tools/tour/test_pack.py
"""

from __future__ import annotations

import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pack  # noqa: E402
import providers  # noqa: E402


class PackTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.est = providers.SyntheticProvider()(variant=0)
        h, w = cls.est["image"].shape[:2]
        cls.gw, cls.gh = pack.grid_size(w, h)
        cls.grid, cls.info = pack.build_grid(cls.est["depth"], cls.est["mask"], cls.gw, cls.gh)
        cls.raw, _ = pack.build_grid(cls.est["depth"], cls.est["mask"], cls.gw, cls.gh, tame=False)

    def test_grid_keeps_aspect_ratio(self):
        self.assertEqual(pack.grid_size(1748, 1165), (768, 512))
        self.assertEqual(pack.grid_size(1200, 1600), (576, 768))
        self.assertEqual(pack.grid_size(1496, 1496), (768, 768))

    def test_depth_round_trip_is_accurate(self):
        blob = pack.encode_geo(self.grid, self.info)
        geo = pack.decode_geo(blob)
        self.assertEqual((geo["gw"], geo["gh"]), (self.gw, self.gh))
        front = geo["front"].astype(np.float64)
        scale = math.log(geo["far"] / geo["near"]) / 65533.0
        decoded = geo["near"] * np.exp((front - 1) * scale)
        valid = self.grid["valid"]
        self.assertTrue((geo["front"][~valid] == pack.SKY_CODE).all(), "sky pixels keep the sky code")
        self.assertFalse((geo["front"][valid] == pack.SKY_CODE).any())
        rel = np.abs(decoded[valid] - self.grid["depth"][valid]) / self.grid["depth"][valid]
        self.assertLess(rel.max(), 1e-3, "depth is stored to better than 0.1 %")
        self.assertLess(len(blob), 400_000, "one scene's geometry stays small")

    def test_grid_matches_the_true_room(self):
        est = self.est
        sky = ~self.raw["valid"]
        self.assertGreater(sky.mean(), 0.01, "the window is sky")
        self.assertLess(sky.mean(), 0.1)
        ys, xs = np.nonzero(sky)
        centre = float(self.grid["depth"][int(ys.mean()), int(xs.mean())])
        self.assertGreater(centre, self.info["depthMax"], "and stays behind the room once the depth is tamed")
        # The back wall is 5.2 m away (measured along the pitched camera's axis it reads a little less).
        self.assertAlmostEqual(self.info["depthMax"], 5.2 / math.cos(est["pitch"]), delta=0.25)
        # A known point on the back wall (x = -0.5 m, 0.9 m above the eyes, 5.2 m ahead) and one on the
        # sofa back (-1.4, -0.5, 4.05): project them and compare with the grid.
        pitch = est["pitch"]
        for world in ((-0.5, 0.9, 5.2), (-1.4, -0.5, 4.05)):
            cam_y = -(world[1] * math.cos(pitch) + world[2] * math.sin(pitch))
            cam_z = -world[1] * math.sin(pitch) + world[2] * math.cos(pitch)
            gx = round((est["fx"] * world[0] / cam_z + 0.5) * (self.gw - 1))
            gy = round((est["fy"] * cam_y / cam_z + 0.5) * (self.gh - 1))
            self.assertAlmostEqual(float(self.grid["depth"][gy, gx]), cam_z, delta=0.06)

    def test_depth_is_tamed_for_a_moving_viewer(self):
        gh, gw = 200, 300
        d = np.full((gh, gw), 8.0, np.float32)
        d[:, 100:104] = 1.0            # a pole, 4 cells wide, 1 m away in front of a wall at 8 m
        d[120:, 180:260] = 2.0         # a sofa, 80 cells wide, 2 m away
        out = pack.tame_depth(d)
        self.assertGreater(out[60, 102], 4.5, "the pole is moved back towards the wall")
        self.assertLess(1 / out[60, 102] - 1 / 8.0, pack.THIN_EXCESS + 1e-3)
        self.assertLess(out[60, 102], 8.0, "but it still stands in front of the wall")
        self.assertAlmostEqual(float(out[160, 220]), 2.0, delta=1e-3, msg="the sofa keeps its depth")
        self.assertAlmostEqual(float(out[160, 178]), 2.0, delta=1e-3, msg="and is widened by a couple of cells")
        self.assertAlmostEqual(float(out[50, 30]), 8.0, delta=1e-3, msg="the wall away from any object is untouched")
        self.assertAlmostEqual(float(out[160, 170]), 8.0, delta=1e-3, msg="beyond that the wall is where it was")
        # A floor running smoothly towards the camera is not an object in front of anything.
        floor = np.tile(np.linspace(6.0, 1.2, gh, dtype=np.float32)[:, None], (1, gw))
        tamed = pack.tame_depth(floor)
        self.assertLess(float(np.abs(1 / tamed[:-40] - 1 / floor[:-40]).max()), 0.04)

    def test_extreme_values_do_not_set_the_range(self):
        depth = self.est["depth"].copy()
        depth[5, 5] = 4000.0
        depth[6, 6] = 0.001
        _, info = pack.build_grid(depth, self.est["mask"], self.gw, self.gh)
        self.assertLess(info["depthMax"], 6.0)
        self.assertGreater(info["depthMin"], 1.0)

    def test_gravity_and_eye_height(self):
        est = self.est
        up, eye = pack.estimate_up(est["points"], est["normal"], est["mask"])
        truth = np.array([0.0, -math.cos(est["pitch"]), -math.sin(est["pitch"])])
        angle = math.degrees(math.acos(float(np.clip(up @ truth, -1, 1))))
        self.assertLess(angle, 0.5, "up vector matches the true gravity direction")
        self.assertAlmostEqual(eye, est["eyeHeight"], delta=0.02)

    def test_gravity_falls_back_without_normals(self):
        up, eye = pack.estimate_up(None, None, self.est["mask"])
        self.assertEqual(list(up), [0.0, -1.0, 0.0])
        self.assertIsNone(eye)

    def test_pack_scene_writes_all_files(self):
        est = self.est
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "01"
            (out).mkdir(parents=True)
            (out / "bg.webp").write_bytes(b"stale")
            entry = pack.pack_scene(out, est["image"], est["depth"], est["mask"], est["normal"], est["fx"], est["fy"], est["points"])
            for name in ("color.webp", "geo.bin", "thumb.webp"):
                self.assertGreater((out / name).stat().st_size, 500, name)
            self.assertFalse((out / "bg.webp").exists(), "files of older versions are removed")
            self.assertEqual(entry["grid"], [self.gw, self.gh])
            self.assertAlmostEqual(entry["eyeHeight"], 1.45, delta=0.02)
            self.assertAlmostEqual(math.degrees(2 * math.atan(0.5 / entry["fx"])), 92.0, delta=0.01)

    def test_pack_scene_without_points_handles_sky(self):
        est = self.est
        with tempfile.TemporaryDirectory() as tmp:
            entry = pack.pack_scene(Path(tmp) / "01", est["image"], est["depth"], est["mask"], est["normal"], est["fx"], est["fy"], None)
            self.assertAlmostEqual(entry["eyeHeight"], 1.45, delta=0.03)


if __name__ == "__main__":
    unittest.main(verbosity=2)
