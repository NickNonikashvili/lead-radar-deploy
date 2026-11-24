# The EvoSoft mark (upside down, as on the site) as a 3D object: an extruded, bevelled slab of glossy lacquered
# burgundy, lit by a soft white key from above and a neon-yellow rim from behind, on a transparent background.
#   python mark3d.py <mark.json> <out.png> [size] [yaw] [pitch]
import bpy, bmesh, json, math, sys, mathutils
src, out = sys.argv[1], sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
YAW = float(sys.argv[4]) if len(sys.argv) > 4 else -24
PITCH = float(sys.argv[5]) if len(sys.argv) > 5 else 8
M = json.load(open(src))
s = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 96; s.cycles.use_denoising = True
s.render.film_transparent = True; s.view_settings.view_transform = 'Standard'
s.render.resolution_x = s.render.resolution_y = SIZE
s.cycles.max_bounces = 8; s.cycles.glossy_bounces = 6; s.cycles.transparent_max_bounces = 8
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.002, 0.002, 0.002, 1)
# the mesh: three flat polygons, centred, 1 unit = the mark's height, extruded and bevelled
sc = 1.0 / M['H']
me = bpy.data.meshes.new('mark'); bm = bmesh.new()
for p in M['polys']:
    vs = [bm.verts.new(((x - M['W'] / 2) * sc, -(y - M['H'] / 2) * sc, 0)) for x, y in p]
    f = bm.faces.new(vs)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
ext = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
bmesh.ops.translate(bm, verts=ext, vec=(0, 0, -0.16))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('mark', me); s.collection.objects.link(ob)
bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 4; bv.limit_method = 'ANGLE'
ob.rotation_euler = (math.radians(PITCH), math.radians(YAW), 0)
bpy.context.view_layer.objects.active = ob
mat = bpy.data.materials.new('lacquer'); mat.use_nodes = True; P = mat.node_tree.nodes['Principled BSDF'].inputs
P['Base Color'].default_value = (0.075, 0.0, 0.01, 1); P['Roughness'].default_value = 0.34
P['Coat Weight'].default_value = 1.0; P['Coat Roughness'].default_value = 0.04
me.materials.append(mat)
for poly in me.polygons: poly.use_smooth = False
def area(name, loc, energy, color, size, sy=None):
    L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.color = color; L.shape = 'RECTANGLE'; L.size = size; L.size_y = sy or size
    o = bpy.data.objects.new(name, L); s.collection.objects.link(o); o.location = loc
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = (-mathutils.Vector(loc)).to_track_quat('-Z', 'Y')
    return o
area('key', (-1.4, 3.0, 1.1), 150, (1.0, 0.97, 0.94), 3.0, 1.0)              # a long soft white light grazing from above
area('top', (0.4, 3.2, -0.2), 70, (1.0, 0.98, 0.95), 4.0, 0.6)              # its sheen along the top edges
area('rim', (2.2, 0.4, -1.4), 240, (0.93, 1.0, 0.0), 0.35, 2.8)             # neon yellow from behind, right
area('rim2', (-2.3, -1.0, -1.0), 70, (0.93, 1.0, 0.0), 0.25, 1.6)           # a thinner yellow edge, low left
area('fill', (0.6, -2.4, 2.0), 12, (1.0, 0.35, 0.4), 2.4)                   # a faint warm fill from below
cam = bpy.data.cameras.new('c'); cam.lens = 95; co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
co.location = (0, 0, 4.6); co.rotation_euler = (0, 0, 0)
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
