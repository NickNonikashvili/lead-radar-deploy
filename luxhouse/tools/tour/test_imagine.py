"""Checks of the view-imagining tool that need no network.

    python tools/tour/test_imagine.py
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import imagine  # noqa: E402


class ImagineTest(unittest.TestCase):
    def test_views_depend_on_the_room(self):
        self.assertEqual(imagine.views_for({"room": "living"}), ["left", "back", "right"])
        self.assertEqual(imagine.views_for({"room": "bathroom"}), ["back"])
        self.assertEqual(imagine.views_for({"room": "garden"}), ["back"])
        self.assertEqual(imagine.views_for({"room": "exterior"}), [], "a façade is not walked around")
        self.assertEqual(imagine.views_for({"room": "aerial"}), [])

    def test_a_listing_can_choose_its_own_views(self):
        self.assertEqual(imagine.views_for({"room": "living", "views": False}), [])
        self.assertEqual(imagine.views_for({"room": "living", "views": ["back"]}), ["back"])
        self.assertEqual(imagine.views_for({"room": "exterior", "views": ["back", "left"]}), ["left", "back"], "always in walking order")

    def test_prompts_keep_the_room_and_say_where_to_stand(self):
        back = imagine.prompt_for("back", "living", 1)
        self.assertIn("SAME room", back)
        self.assertIn("opposite end", back)
        self.assertIn("No people, no text, no watermark", back)
        left = imagine.prompt_for("left", "kitchen", 2)
        self.assertIn("90 degrees to the LEFT", left)
        self.assertIn("second image", left)
        self.assertIn("must agree", left)
        self.assertIn("outdoor space", imagine.prompt_for("back", "pool", 1))

    def test_output_follows_the_photo_s_shape(self):
        self.assertEqual(imagine.output_size(1748, 1165), "1536x1024")
        self.assertEqual(imagine.output_size(1200, 1600), "1024x1536")
        self.assertEqual(imagine.output_size(1496, 1496), "1024x1024")

    def test_order_matches_the_tour_builder(self):
        import build_tour

        self.assertEqual(tuple(imagine.ORDER), tuple(build_tour.VIEW_ORDER))


if __name__ == "__main__":
    unittest.main(verbosity=2)
