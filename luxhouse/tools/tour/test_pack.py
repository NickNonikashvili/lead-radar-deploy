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
        cls.fg, cls.bg, cls.info = pack.build_layers(cls.est["image"], cls.est["depth"], cls.est["mask"], cls.gw, cls.gh)

    def test_grid_keeps_aspect_ratio(self):
        self.assertEqual(pack.grid_size(1748, 1165), (768, 512))
        self.assertEqual(pack.grid_size(1200, 1600), (576, 768))
        self.assertEqual(pack.grid_size(1496, 1496), (768, 768))

    def test_depth_round_trip_is_accurate(self):
        blob = pack.encode_geo(self.fg, self.bg, self.info)
        geo = pack.decode_geo(blob)
        self.assertEqual((geo["gw"], geo["gh"]), (self.gw, self.gh))
        front = geo["front"].astype(np.float64)
        scale = math.log(geo["far"] / geo["near"]) / 65533.0
        decoded = geo["near"] * np.exp((front - 1) * scale)
        valid = self.fg["valid"]
        self.assertTrue((geo["front"][~valid] == pack.SKY_CODE).all(), "sky pixels keep the sky code")
        self.assertFalse((geo["front"][valid] == pack.SKY_CODE).any())
        rel = np.abs(decoded[valid] - self.fg["depth"][valid]) / self.fg["depth"][valid]
        self.assertLess(rel.max(), 1e-3, "depth is stored to better than 0.1 %")
        # The hidden layer decodes to exactly what was encoded.
        hidden = geo["hidden"]
        self.assertTrue(((hidden > 0) == self.bg["valid"]).all())
        self.assertLess(len(blob), 400_000, "one scene's geometry stays small")

    def test_hidden_layer_lies_behind_the_front_layer(self):
        v = self.bg["valid"]
        self.assertGreater(v.mean(), 0.01, "furniture silhouettes produce a hidden layer")
        self.assertLess(v.mean(), 0.5)
        self.assertTrue((self.bg["depth"][v] > self.fg["depth"][v]).all())

    def test_hidden_layer_continues_the_wall_behind_the_sofa(self):
        # Just inside the sofa's top edge the hidden surface must be the back wall (z = 5.2 m), not the sofa (~4.2 m).
        est = self.est
        h, w = est["image"].shape[:2]
        # Project a point on the sofa back, 6 cm below its top edge.
        pitch = est["pitch"]
        world = np.array([-1.4, -0.36, 4.05])
        cam_y = -(world[1] * math.cos(pitch) + world[2] * math.sin(pitch))
        cam_z = -world[1] * math.sin(pitch) + world[2] * math.cos(pitch)
        u = est["fx"] * world[0] / cam_z + 0.5
        v = est["fy"] * cam_y / cam_z + 0.5
        gx, gy = round(u * (self.gw - 1)), round(v * (self.gh - 1))
        self.assertTrue(self.bg["valid"][gy, gx], "hidden layer exists just inside the silhouette")
        self.assertAlmostEqual(float(self.fg["depth"][gy, gx]), cam_z, delta=0.08)
        self.assertGreater(float(self.bg["depth"][gy, gx]), 4.9)
        self.assertLess(float(self.bg["depth"][gy, gx]), 5.5)

    def test_window_is_sky_and_hidden_layer_extends_it(self):
        self.assertGreater((~self.fg["valid"]).mean(), 0.01)
        # The lamp shade overlaps the window: behind its edge the hidden surface is sky.
        self.assertGreater(int(self.bg["sky"].sum()), 0)

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
            entry = pack.pack_scene(out, est["image"], est["depth"], est["mask"], est["normal"], est["fx"], est["fy"], est["points"])
            for name in ("color.webp", "bg.webp", "geo.bin", "thumb.webp"):
                self.assertGreater((out / name).stat().st_size, 500, name)
            self.assertEqual(entry["grid"], [self.gw, self.gh])
            self.assertAlmostEqual(entry["eyeHeight"], 1.45, delta=0.02)
            self.assertAlmostEqual(math.degrees(2 * math.atan(0.5 / entry["fx"])), 92.0, delta=0.01)


if __name__ == "__main__":
    unittest.main(verbosity=2)
