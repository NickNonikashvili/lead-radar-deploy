"""Checks of the room builder that need no network and spend nothing.

    python tools/tour/test_rooms.py

A synthetic room with exact depth stands in for the service: a 6 x 4 m room with a sofa-sized
block in the middle, a doorway in one wall and a window (no depth) in another.
"""

from __future__ import annotations

import json
import math
import struct
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlas  # noqa: E402
import collider  # noqa: E402
import rooms  # noqa: E402

K = {"width": 320, "height": 180, "fx": 150.0, "fy": 150.0, "cx": 160.0, "cy": 90.0}


def room_points(step: float = 0.04, doorway: bool = True) -> np.ndarray:
    """World points of the test room: floor, four walls 2.8 m high, a block 2.0 x 0.9 x 0.8 m in
    the middle. One wall has a doorway 1 m wide and 2.05 m high with a corridor floor beyond it;
    another has a window from 0.3 to 2.1 m, through which a terrace floor is seen."""
    pts = []
    xs, zs = np.arange(-3, 3 + 1e-6, step), np.arange(-2, 2 + 1e-6, step)
    gx, gz = np.meshgrid(xs, zs)
    pts.append(np.stack([gx.ravel(), np.zeros(gx.size), gz.ravel()], axis=1))                 # floor
    ys = np.arange(0, 2.8 + 1e-6, step)
    for z in (-2.0, 2.0):                                                                      # long walls
        wx, wy = np.meshgrid(xs, ys)
        wall = np.stack([wx.ravel(), wy.ravel(), np.full(wx.size, z)], axis=1)
        if z == -2.0:   # the window: glass has no depth, only the wall under and over it
            wall = wall[~((np.abs(wall[:, 0]) < 1.5) & (wall[:, 1] > 0.3) & (wall[:, 1] < 2.1))]
        pts.append(wall)
    for x in (-3.0, 3.0):                                                                      # short walls
        wz, wy = np.meshgrid(zs, ys)
        wall = np.stack([np.full(wz.size, x), wy.ravel(), wz.ravel()], axis=1)
        if x == 3.0 and doorway:
            wall = wall[~((np.abs(wall[:, 2]) < 0.5) & (wall[:, 1] < 2.05))]
        pts.append(wall)
    bx, bz = np.meshgrid(np.arange(-1, 1 + 1e-6, step), np.arange(-0.45, 0.45 + 1e-6, step))  # the block's top
    pts.append(np.stack([bx.ravel(), np.full(bx.size, 0.8), bz.ravel()], axis=1))
    for y in np.arange(0.1, 0.8, step):                                                        # and its sides
        ring = [(x, y, z) for x in np.arange(-1, 1 + 1e-6, step) for z in (-0.45, 0.45)] + [(x, y, z) for z in np.arange(-0.45, 0.45 + 1e-6, step) for x in (-1.0, 1.0)]
        pts.append(np.array(ring))
    tx, tz = np.meshgrid(np.arange(-1.5, 1.5, step), np.arange(-4, -2.05, step))               # terrace beyond the glass
    pts.append(np.stack([tx.ravel(), np.zeros(tx.size), tz.ravel()], axis=1))
    if doorway:
        cx, cz = np.meshgrid(np.arange(3.05, 6, step), np.arange(-0.5, 0.5, step))             # corridor beyond the doorway
        pts.append(np.stack([cx.ravel(), np.zeros(cx.size), cz.ravel()], axis=1))
    return np.concatenate(pts)


class CameraMath(unittest.TestCase):
    def test_turning_right_is_a_negative_turn_about_up(self):
        # The API's own example: no rotation, then 30 degrees to the right.
        cam = atlas.look_at((0, 1, 0), (math.sin(math.radians(30)), 1, -math.cos(math.radians(30))), K)
        q = cam["extrinsics"]["quaternion"]
        for got, want in zip(q, [0, -0.2588, 0, 0.9659]):
            self.assertAlmostEqual(got, want, places=3)
        self.assertEqual(cam["extrinsics"]["coordinateSystem"], "rub")

    def test_a_camera_looks_along_minus_z_and_projection_undoes_unprojection(self):
        cam = atlas.look_at((1.0, 1.2, 2.0), (-2.0, 0.6, -1.0), K)
        f = atlas.forward(cam)
        want = np.array([-3.0, -0.6, -3.0]) / np.linalg.norm([-3.0, -0.6, -3.0])
        np.testing.assert_allclose(f, want, atol=1e-5)
        depth = np.full((K["height"], K["width"]), 3.0, dtype=np.float32)
        depth[:10] = np.nan                                  # no surface: skipped
        pts, idx = atlas.world_points(cam, depth, step=7)
        self.assertTrue((idx[:, 0] >= 10).all())
        u, v, z = atlas.project(cam, pts)
        np.testing.assert_allclose(z, 3.0, atol=1e-4)
        np.testing.assert_allclose(u, idx[:, 1], atol=1e-3)
        np.testing.assert_allclose(v, idx[:, 0], atol=1e-3)

    def test_the_api_s_depth_formula(self):
        # docs: the point at pixel (u, v) with depth z is ((u - cx) / fx * z, -(v - cy) / fy * z, -z) in camera axes
        cam = {"extrinsics": {"position": [0, 0, 0], "quaternion": [0, 0, 0, 1], "coordinateSystem": "rub"}, "intrinsics": K}
        depth = np.full((K["height"], K["width"]), np.nan, dtype=np.float32)
        depth[30, 200] = 2.0
        pts, _ = atlas.world_points(cam, depth, step=1)
        np.testing.assert_allclose(pts[0], [(200 - 160) / 150 * 2, -(30 - 90) / 150 * 2, -2.0], atol=1e-5)

    def test_a_quaternion_survives_the_round_trip(self):
        for q in ([0.0045, 0.8752, 0.0008, 0.4838], [-0.0045, 0.3225, 0.0102, 0.9465], [0, 0, 0, 1]):
            back = atlas.matrix_to_quat(atlas.quat_to_matrix(q))
            n = np.linalg.norm(q)
            self.assertTrue(np.allclose(back, np.array(q) / n, atol=1e-3) or np.allclose(back, -np.array(q) / n, atol=1e-3))

    def test_work_keys_are_stable_and_distinct(self):
        self.assertEqual(atlas.work_key("views", "home", {"a": 1}), atlas.work_key("views", "home", {"a": 1}))
        self.assertNotEqual(atlas.work_key("views", "home", {"a": 1}), atlas.work_key("views", "home", {"a": 2}))
        self.assertLessEqual(len(atlas.work_key("x" * 500)), 128)


class Collider(unittest.TestCase):
    def setUp(self):
        self.points = room_points()
        self.room = collider.plan(self.points)
        self.reach = collider.walkable(self.room, (-2.0, 1.2))

    def cell(self, x, z):
        x0, z0 = self.room["origin"]
        return int((z - z0) / self.room["cell"]), int((x - x0) / self.room["cell"])

    def test_the_visitor_can_lap_the_block_but_not_stand_in_it(self):
        for spot in ((-2.0, 1.2), (0.0, 1.3), (2.0, 1.2), (2.0, -1.2), (0.0, -1.3), (-2.0, -1.2), (-2.2, 0.0), (2.2, 0.0)):
            self.assertTrue(self.reach[self.cell(*spot)], f"free floor at {spot}")
        for spot in ((0.0, 0.0), (0.9, 0.3), (-0.9, -0.3)):
            self.assertFalse(self.reach[self.cell(*spot)], f"the block is solid at {spot}")
        # and keeps a body's width away from it and from the walls
        self.assertFalse(self.reach[self.cell(0.0, 0.6)])
        self.assertFalse(self.reach[self.cell(-2.9, 1.0)])

    def test_glass_and_doorways_keep_the_visitor_in_the_room(self):
        self.assertFalse(self.reach[self.cell(0.0, -3.0)], "the terrace seen through the window is not walked on")
        self.assertFalse(self.reach[self.cell(4.5, 0.0)], "nor the corridor through the doorway: it is only a backdrop")

    def test_floor_nobody_saw_is_closed(self):
        pts = self.points[~((self.points[:, 1] < 0.05) & (self.points[:, 0] < -1.6) & (self.points[:, 2] > 0.4) & (np.abs(self.points[:, 0]) < 2.99))]
        room = collider.plan(pts)
        reach = collider.walkable(room, (2.0, 1.2))
        x0, z0 = room["origin"]
        self.assertFalse(reach[int((1.3 - z0) / room["cell"]), int((-2.3 - x0) / room["cell"])])
        self.assertTrue(reach[int((1.3 - z0) / room["cell"]), int((0.0 - x0) / room["cell"])])

    def test_a_lamp_hanging_in_the_room_is_not_a_wall(self):
        lamp = np.array([[x, y, z] for x in np.arange(-0.1, 0.1, 0.02) for z in np.arange(1.1, 1.3, 0.02) for y in (2.2, 2.3, 2.4)])
        room = collider.plan(np.concatenate([self.points, lamp]))
        reach = collider.walkable(room, (-2.0, 1.2))
        x0, z0 = room["origin"]
        self.assertTrue(reach[int((1.2 - z0) / room["cell"]), int((0.0 - x0) / room["cell"])])

    def test_the_file_is_a_valid_glb_that_blocks_the_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "collider.glb"
            info = collider.build(self.points, (-2.0, 1.2), out)
            data = out.read_bytes()
            magic, version, total = struct.unpack("<4sII", data[:12])
            self.assertEqual((magic, version, total), (b"glTF", 2, len(data)))
            n, kind = struct.unpack("<I4s", data[12:20])
            doc = json.loads(data[20:20 + n])
            self.assertEqual(kind, b"JSON")
            self.assertEqual(doc["meshes"][0]["primitives"][0]["mode"], 4)
            acc = doc["accessors"]
            self.assertEqual(acc[1]["count"], info["triangles"] * 3)
            self.assertLess(acc[0]["min"][1], 0, "a floor slab lies under the floor")
            self.assertAlmostEqual(acc[0]["max"][1], collider.WALL_HEIGHT, places=4)
            self.assertGreater(info["floorArea"], 8)
            self.assertLess(info["floorArea"], 24 - 1.8)
            b = info["bounds"]
            self.assertTrue(-3 < b["min"][0] < -2.4 and 2.4 < b["max"][0] < 3 and -2 < b["min"][2] < -1.4 and 1.4 < b["max"][2] < 2)
            self.assertLess(info["bytes"], 400_000)

    def test_boxes_cover_exactly_the_solid_squares(self):
        grid = np.zeros((7, 9), dtype=bool)
        grid[1:4, 2:7] = True
        grid[5, 0] = True
        grid[3, 7] = True
        cover = np.zeros_like(grid, dtype=int)
        for r, c, h, w in collider.boxes(grid):
            cover[r:r + h, c:c + w] += 1
        np.testing.assert_array_equal(cover, grid.astype(int))


class Rooms(unittest.TestCase):
    def test_rooms_are_walked_and_facades_are_not(self):
        listing = {"photos": [
            {"file": "01", "room": "exterior"}, {"file": "15", "room": "aerial"}, {"file": "03", "room": "garden"},
            {"file": "06", "room": "living", "sameSpaceAs": ["07"]}, {"file": "07", "room": "living", "sameSpaceAs": ["06"]},
            {"file": "08", "room": "kitchen", "tour": False}, {"file": "09", "room": "bedroom", "world": False},
            {"file": "16", "room": "view", "world": True},
        ]}
        got = rooms.rooms_of(listing)
        self.assertEqual([(r["room"], r["photos"]) for r in got], [("03", ["03"]), ("06", ["06", "07"]), ("16", ["16"])],
                         "one room per space; a listing can switch a photo on or off")

    def test_a_photograph_is_posed_on_the_grid_closest_to_its_shape(self):
        self.assertEqual(rooms.grid_for(1748, 1165), (1280, 720))
        self.assertEqual(rooms.grid_for(1600, 1200), (960, 720))
        self.assertEqual(rooms.grid_for(1496, 1496), (960, 720))
        self.assertEqual(rooms.grid_for(1200, 1600), (528, 704))
        self.assertEqual(rooms.grid_for(1080, 1920), (720, 1280))
        for grid in ((1280, 720), (960, 720), (528, 704), (720, 1280)):
            self.assertIn(grid, atlas.GRIDS)

    def test_a_known_view_fills_and_an_unknown_one_does_not(self):
        pts = room_points()
        inside = atlas.look_at((-2.0, 1.35, 1.2), (0.0, 0.5, 0.0), K)
        self.assertGreater(rooms.preview_share(inside, pts), 0.75)    # the window and the open ceiling stay unknown
        away = atlas.look_at((8.0, 1.35, 6.0), (20.0, 1.0, 20.0), K)
        self.assertLess(rooms.preview_share(away, pts), 0.05)

    def test_planned_cameras_stand_on_free_floor_apart_from_each_other(self):
        pts = room_points()
        photo = {"name": "p00", "camera": atlas.look_at((-2.4, 1.15, 1.4), (0.5, 0.8, -0.5), K)}
        cams = rooms.plan_round(pts, [photo], K, (-2.4, 1.4), count=4, ring=True, height=1.6)
        self.assertEqual(len(cams), 4)
        room = collider.plan(pts)
        reach = collider.walkable(room, (-2.4, 1.4))
        x0, z0 = room["origin"]
        spots = []
        for cam in cams:
            x, y, z = cam["extrinsics"]["position"]
            self.assertAlmostEqual(y, 1.6)
            self.assertTrue(reach[int((z - z0) / room["cell"]), int((x - x0) / room["cell"])], "stands on floor a visitor can reach")
            f = atlas.forward(cam)
            to_block = np.array([-x, 0.4 - y, -z])
            self.assertGreater(float(np.dot(f, to_block / np.linalg.norm(to_block))), 0.9, "a ring view looks at what stands in the room")
            spots.append((x, z))
        for i, a in enumerate(spots):
            for b in spots[i + 1:]:
                self.assertGreater(math.hypot(a[0] - b[0], a[1] - b[1]), 0.34)
        sides = {(x > 0, z > 0) for x, z in spots}
        self.assertGreaterEqual(len(sides), 3, "the ring surrounds the block instead of crowding one side")

    def test_context_is_the_photographs_and_the_nearest_views(self):
        frames = [{"name": "p00", "camera": {"extrinsics": {"position": [0, 1, 0]}}}]
        frames += [{"name": f"v{i}", "generated": True, "camera": {"extrinsics": {"position": [i, 1, 0]}}} for i in range(1, 15)]
        cams = [{"extrinsics": {"position": [14, 1, 0]}}]
        picked = [f["name"] for f in rooms.nearest_context(frames, cams)]
        self.assertEqual(len(picked), rooms.MAX_CONTEXT)
        self.assertEqual(picked[0], "p00", "a real photograph is always shown to the model")
        self.assertEqual(picked[1:4], ["v14", "v13", "v12"])

    def test_the_tour_gets_one_room_for_all_its_photographs(self):
        with tempfile.TemporaryDirectory() as tmp:
            saved = (rooms.ROOMS, rooms.MEDIA)
            rooms.ROOMS, rooms.MEDIA = Path(tmp) / "rooms", Path(tmp) / "media"
            try:
                cam = lambda x: {"extrinsics": {"position": [x, 1.1, 0.5], "quaternion": [0, 0.6, 0, 0.8], "coordinateSystem": "rub"}, "intrinsics": K}
                record = {"room": "06", "photos": ["06", "07"], "frames": [{"name": "p00", "photo": "06", "camera": cam(2.0)}, {"name": "p01", "photo": "07", "camera": cam(-1.0)},
                                                                         {"name": "r1v00", "generated": True, "camera": cam(0.0)}],
                          "collider": {"bounds": {"min": [-3, 0, -2], "max": [3, 2.3, 2]}}, "splats": {"shown": "refined"}}
                rooms.save("home", "06", record)
                self.assertIsNone(rooms.scene_entry("home", "06"), "no files yet, no walkable room")
                folder = rooms.scene_dir("home", "06")
                folder.mkdir(parents=True)
                (folder / "world.spz").write_bytes(b"x")
                (folder / "collider.glb").write_bytes(b"x")
                first, second = rooms.scene_entry("home", "06"), rooms.scene_entry("home", "07")
                self.assertEqual((first["splat"], first["collider"]), ("world.spz", "collider.glb"))
                self.assertEqual((second["splat"], second["collider"]), ("../06/world.spz", "../06/collider.glb"), "the second photograph opens the same files")
                self.assertEqual(first["start"]["position"], [2.0, 1.1, 0.5])
                self.assertEqual(second["start"]["position"], [-1.0, 1.1, 0.5])
                self.assertEqual(first["convention"], "three")
                self.assertEqual(first["bounds"], record["collider"]["bounds"])
                self.assertIs(first["draft"], False)
                self.assertIsNone(rooms.scene_entry("home", "08"))
            finally:
                rooms.ROOMS, rooms.MEDIA = saved

    def test_a_photograph_is_never_dropped_and_a_drop_says_why(self):
        with tempfile.TemporaryDirectory() as tmp:
            saved = rooms.ROOMS
            rooms.ROOMS = Path(tmp)
            try:
                rooms.save("home", "06", {"room": "06", "frames": [{"name": "p00", "photo": "06"}, {"name": "r1v00", "generated": True}]})
                with self.assertRaises(RuntimeError):
                    rooms.drop("home", "06", "p00", "")
                rooms.drop("home", "06", "r1v00", "invents a second door")
                record = rooms.load("home", "06")
                self.assertEqual([f["name"] for f in rooms.kept(record)], ["p00"])
                self.assertEqual(record["frames"][1]["dropped"], "invents a second door")
            finally:
                rooms.ROOMS = saved


class FakeApi:
    def __init__(self, done_after=1):
        self.submitted, self.waited, self.downloads = [], [], []

    def submit(self, task, body, key):
        self.submitted.append((task, body, key))
        return {"id": "op-1", "done": False}

    def wait(self, op_id, limit=0, every=0):
        self.waited.append(op_id)
        return {"id": op_id, "done": True, "response": {"draftSplat": {"assetId": "asset-draft"}, "refinedSplats": {"2000000": {"assetId": "asset-refined"}}}}

    def download(self, asset_id, target):
        self.downloads.append(asset_id)
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        Path(target).write_bytes(b"spz")
        return 3


class Money(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.saved = (rooms.ROOMS, rooms.MEDIA)
        rooms.ROOMS, rooms.MEDIA = Path(self.tmp.name) / "rooms", Path(self.tmp.name) / "media"
        frame = lambda n: {"name": n, "camera": {"extrinsics": {"position": [0, 1, 0], "quaternion": [0, 0, 0, 1]}, "intrinsics": K},
                           "imageAsset": {"assetId": "img-" + n}, "depth": {"depthAsset": {"assetId": "dep-" + n}}}
        rooms.save("home", "06", {"room": "06", "photos": ["06"], "frames": [dict(frame("p00"), photo="06"), frame("r1v00"), dict(frame("r1v01"), dropped="disagrees")],
                                  "prompt": "A living room.", "operations": []})
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        rooms.ROOMS, rooms.MEDIA = self.saved
        self.tmp.cleanup()

    def test_a_room_is_reconstructed_once_from_the_frames_that_were_kept(self):
        api = FakeApi()
        rooms.splats(api, "home", "06", log=self.quiet)
        task, body, key = api.submitted[0]
        self.assertEqual(task, "posedImages2Splats")
        self.assertEqual([f["imageAsset"]["assetId"] for f in body["posedFrames"]], ["img-p00", "img-r1v00"], "a dropped view is left out")
        self.assertEqual(body["posedFrames"][0]["depth"], {"depthAsset": {"assetId": "dep-p00"}})
        self.assertEqual((body["prompt"], body["enhancePrompt"]), ("A living room.", False))
        self.assertNotIn("refine", body)
        self.assertEqual(api.downloads, ["asset-refined"])
        record = rooms.load("home", "06")
        self.assertEqual(record["splats"]["refined"]["splats"], 2_000_000)
        self.assertEqual(record["operations"][-1]["credits"], 5000)
        self.assertTrue((rooms.scene_dir("home", "06") / "world.spz").exists())
        again = FakeApi()
        rooms.splats(again, "home", "06", log=self.quiet)
        self.assertEqual(again.submitted, [], "a finished room is never paid for again")

    def test_a_started_reconstruction_is_picked_up_not_started_again(self):
        class Dies(FakeApi):
            def wait(self, op_id, limit=0, every=0):
                raise TimeoutError("still running")
        api = Dies()
        with self.assertRaises(TimeoutError):
            rooms.splats(api, "home", "06", log=self.quiet)
        state = rooms.load("home", "06")["splats"]["refined"]
        self.assertEqual((state["operation"], state["pending"]), ("op-1", True))
        later = FakeApi()
        rooms.splats(later, "home", "06", log=self.quiet)
        self.assertEqual(later.submitted, [])
        self.assertEqual(later.waited, ["op-1"])

    def test_a_draft_is_asked_for_as_a_draft(self):
        api = FakeApi()
        rooms.splats(api, "home", "06", draft=True, log=self.quiet)
        self.assertIs(api.submitted[0][1]["refine"], False)
        self.assertEqual(rooms.load("home", "06")["operations"][-1]["credits"], 500)

    def test_prices_match_the_documentation(self):
        self.assertEqual(rooms.SPLAT_CREDITS, {"refined": 5000, "draft": 500})
        self.assertEqual(rooms.CREDITS_PER_DOLLAR, 1000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
