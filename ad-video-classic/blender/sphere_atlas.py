# Renders the ad's spheres in Blender (Cycles) as real 3D balls under one studio light rig, from every viewing angle,
# into atlases the WebGL film samples per sphere and per frame (so highlights and reflections stay fixed in the world).
#   python sphere_atlas.py <outdir> [kinds...]      (bpy 5.3 as a Python module)
# Directions use the film's coordinates (y up): azimuth phi from +z toward +x, elevation theta from the horizon.
import bpy, math, sys, os, json, time
OUT = sys.argv[1]; KINDS = sys.argv[2:] or ['blue', 'white', 'chrome', 'hero', 'orb']
PHI = list(range(0, 360, 20)); TH = list(range(-70, 71, 20))
if os.environ.get('TEST'): PHI = [0, 90, 180, 270]; TH = [-45, 0, 30, 60]
TILE = {'blue': 160, 'white': 160, 'chrome': 160, 'pink': 160, 'hero': 256, 'orb': 256}
os.makedirs(OUT, exist_ok=True)
s = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.use_denoising = True
s.render.film_transparent = True; s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'
s.cycles.max_bounces = 6; s.cycles.glossy_bounces = 4
def E2B(v): return (v[0], -v[2], v[1])      # film (y up) -> Blender (z up)
def norm(v): l = math.sqrt(sum(c * c for c in v)); return [c / l for c in v]
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.004, 0.005, 0.009, 1); bg.inputs[1].default_value = 1.0
# the ball
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1); ball = bpy.context.object; bpy.ops.object.shade_smooth()
# a dark glossy floor just under it, seen only in reflections (the horizon line on the lower half)
bpy.ops.mesh.primitive_plane_add(size=60, location=E2B((0, -1.0, 0))); floor = bpy.context.object
fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fb = fm.node_tree.nodes['Principled BSDF']
fb.inputs['Base Color'].default_value = (0.012, 0.014, 0.02, 1); fb.inputs['Roughness'].default_value = 0.22; floor.data.materials.append(fm)
floor.visible_camera = False
def area(name, dirn, dist, size, energy, color=(1, 1, 1), shape='RECTANGLE', sy=None):
    L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.color = color; L.shape = shape; L.size = size; L.size_y = sy or size
    o = bpy.data.objects.new(name, L); s.collection.objects.link(o)
    d = norm(dirn); o.location = E2B([c * dist for c in d])
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = (-__import__('mathutils').Vector(o.location)).to_track_quat('-Z', 'Y')
    o.visible_glossy = True
    return o
# the studio: a big softbox above and a little in front-left, a cool rim from behind, a soft fill, and a few screens
area('key', (-0.45, 1.0, 0.35), 6, 5.0, 2600, (1.0, 0.98, 0.95), sy=3.0)
area('rim', (0.25, 0.35, -1.0), 6, 4.0, 900, (0.45, 0.6, 1.0))
area('fill', (0.9, 0.2, 0.6), 7, 3.0, 260, (0.75, 0.82, 1.0))
for k, (az, el, wd, ht, e) in enumerate(((20, 8, 3.2, 2.0, 110), (95, 5, 2.6, 1.6, 80), (165, 10, 3.0, 1.9, 90), (235, 6, 2.6, 1.6, 80), (300, 9, 3.2, 2.0, 100))):
    a, b = math.radians(az), math.radians(el)
    area(f'screen{k}', (math.sin(a) * math.cos(b), math.sin(b), math.cos(a) * math.cos(b)), 7, wd, e, (0.85, 0.9, 1.0), sy=ht)
def mat(kind):
    m = bpy.data.materials.new(kind); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    P = b.inputs
    if kind == 'blue': P['Base Color'].default_value = (0.012, 0.11, 0.75, 1); P['Roughness'].default_value = 0.22; P['Coat Weight'].default_value = 1.0; P['Coat Roughness'].default_value = 0.03
    if kind == 'white': P['Base Color'].default_value = (0.36, 0.37, 0.4, 1); P['Roughness'].default_value = 0.35; P['Coat Weight'].default_value = 0.7; P['Coat Roughness'].default_value = 0.05
    if kind in ('chrome', 'hero'): P['Base Color'].default_value = (0.95, 0.96, 0.98, 1); P['Metallic'].default_value = 1.0; P['Roughness'].default_value = 0.05
    if kind == 'pink': P['Base Color'].default_value = (1.0, 0.02, 0.32, 1); P['Roughness'].default_value = 0.2; P['Coat Weight'].default_value = 1.0; P['Coat Roughness'].default_value = 0.03; P['Emission Color'].default_value = (1.0, 0.05, 0.4, 1); P['Emission Strength'].default_value = 0.08
    if kind == 'orb': P['Base Color'].default_value = (0.004, 0.005, 0.008, 1); P['Roughness'].default_value = 0.08; P['Coat Weight'].default_value = 1.0; P['Coat Roughness'].default_value = 0.02
    return m
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.04; co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
import mathutils
meta = {'phi': PHI, 'theta': TH, 'tiles': {}}
_old = os.path.join(OUT, 'atlas.json')
if os.path.exists(_old): meta['tiles'].update(json.load(open(_old)).get('tiles', {}))
for kind in KINDS:
    ball.data.materials.clear(); ball.data.materials.append(mat(kind))
    T = TILE[kind]; s.render.resolution_x = s.render.resolution_y = T
    s.cycles.samples = 40 if T <= 160 else 32
    from PIL import Image
    atlas = Image.new('RGBA', (T * len(PHI), T * len(TH)))
    t0 = time.time()
    for j, th in enumerate(TH):
        for i, ph in enumerate(PHI):
            a, b = math.radians(ph), math.radians(th)
            d = (math.sin(a) * math.cos(b), math.sin(b), math.cos(a) * math.cos(b))
            co.location = E2B([c * 10 for c in d])
            co.rotation_mode = 'QUATERNION'; co.rotation_quaternion = (-mathutils.Vector(co.location)).to_track_quat('-Z', 'Y')
            p = os.path.join(OUT, '_tile.png'); s.render.filepath = p
            bpy.ops.render.render(write_still=True)
            atlas.paste(Image.open(p).convert('RGBA'), (i * T, j * T))
    atlas.save(os.path.join(OUT, f'atlas_{kind}.png'), optimize=True)
    meta['tiles'][kind] = T
    print(kind, 'done in', round(time.time() - t0), 's', flush=True)
json.dump(meta, open(os.path.join(OUT, 'atlas.json'), 'w'))
