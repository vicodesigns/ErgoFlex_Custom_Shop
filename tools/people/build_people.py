"""Build one posed person as a static GLB (run inside Blender 4.2 with MPFB installed).

    BLENDER_USER_RESOURCES=~/blender/mpfb-user blender -b --python tools/people/build_people.py -- <output id> <out dir> [--preview png]

Prints `RESULT {json}` with the model's bounds (mm, Y up) and triangle count.
build.py runs this once per output and then optimises and indexes the models.
"""
import json, math, os, sys
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cast, pose_lib, held  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT_ID, OUT_DIR = argv[0], argv[1]
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
spec = cast.output(OUT_ID)
who = cast.CHARACTERS[spec['character']]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402


def asset(name, ext='mhclo'):
    return f'{name}/{name}.{ext}'


# ---- the person --------------------------------------------------------------------------------
info = HumanService._create_default_human_info_dict()
phen = dict(who['phenotype']); info['phenotype'].update({k: v for k, v in phen.items() if k != 'race'}); info['phenotype']['race'] = phen['race']
info['rig'] = 'game_engine'
info['eyes'] = 'low-poly/low-poly.mhclo'
info['eyebrows'] = asset(who.get('eyebrows', 'eyebrow001')); info['eyelashes'] = asset(who.get('eyelashes', 'eyelashes01'))
info['teeth'] = 'teeth_base/teeth_base.mhclo'
if who.get('hair'): info['hair'] = asset(who['hair'])
info['clothes'] = [asset(c) for c in who['clothes']]
info['skin_mhmat'] = asset(who['skin'], 'mhmat')
info['eyes_material_settings'] = {}
info['skin_material_type'] = 'MAKESKIN'; info['eyes_material_type'] = 'MAKESKIN'; info['clothes_material_type'] = 'MAKESKIN'
settings = HumanService.get_default_deserialization_settings(); settings['subdiv_levels'] = 0
base = HumanService.deserialize_from_dict(info, settings)
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
base_name = base.name

# Eye colour: the eye material's texture is swapped for the named iris.
for o in meshes:
    if 'low-poly' in o.name and who.get('eyes'):
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image:
                    folder = os.path.dirname(n.image.filepath_from_user()); want = os.path.join(folder, who['eyes'] + '_eye.png')
                    if os.path.exists(want): n.image = bpy.data.images.load(want)


# ---- materials: plain PBR that survives glTF ----------------------------------------------------
def tint_image(image, rgb):
    """Multiply a texture by a colour (clothes come in one colourway each)."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    lum = px[:, :3].mean(axis=1, keepdims=True); solid = px[:, 3:4] > .5
    mean = max(float(lum[solid].mean()) if solid.any() else float(lum.mean()), 1e-3)
    # Shading relative to the fabric's average, compressed so folds stay soft, times the colour.
    px[:, :3] = np.clip((.35 + .65 * lum / mean) * np.array(rgb, dtype=np.float32), 0, 1)
    copy = bpy.data.images.new(image.name + '_tint', w, h, alpha=True); copy.pixels.foreach_set(px.ravel())
    path = os.path.join(OUT_DIR, 'tex', f'{OUT_ID}-{image.name}.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
    copy.filepath_raw = path; copy.file_format = 'PNG'; copy.save(); return copy


ALPHA_CUT = ('hair', 'eyebrow', 'eyelash')
tints = who.get('tint', {})
for o in meshes:
    kind = o.name.split('.', 1)[-1]
    for m in o.data.materials:
        tree = m.node_tree; bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
        cut = any(k in o.name.lower() for k in ALPHA_CUT) or bool(who.get('hair')) and who['hair'] in o.name
        m['alpha'] = 'MASK' if cut else 'OPAQUE'
        if not cut:
            for link in list(bsdf.inputs['Alpha'].links): tree.links.remove(link)
            bsdf.inputs['Alpha'].default_value = 1
        rough = .5
        if o is base: rough = .58
        elif 'low-poly' in o.name: rough = .12
        elif 'shoes' in o.name or 'boots' in o.name or 'flats' in o.name: rough = .55
        elif cut: rough = .5
        else: rough = .82
        for link in list(bsdf.inputs['Roughness'].links): tree.links.remove(link)
        bsdf.inputs['Roughness'].default_value = rough
        for link in list(bsdf.inputs['Metallic'].links): tree.links.remove(link)
        bsdf.inputs['Metallic'].default_value = 0
        tint = tints.get(kind) or (who.get('hair_tint') if who.get('hair') and who['hair'] in o.name else None)
        if tint:
            for link in bsdf.inputs['Base Color'].links:
                node = link.from_node
                while node and node.type != 'TEX_IMAGE':
                    ins = [l.from_node for i in node.inputs for l in i.links]; node = next((n for n in ins if n.type == 'TEX_IMAGE'), ins[0] if ins else None)
                if node and node.image: node.image = tint_image(node.image, tint)

# ---- knee-length shorts: a pair of trousers loses everything that follows the calves and feet ---------
for o in meshes:
    kind = o.name.split('.', 1)[-1]
    if kind not in who.get('crop', []): continue
    groups = {g.index: g.name for g in o.vertex_groups}; lower = {'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'}
    gone = [v.index for v in o.data.vertices if sum(g.weight for g in v.groups if groups.get(g.group) in lower) > .5]
    vg = o.vertex_groups.new(name='cropped'); vg.add(gone, 1., 'REPLACE')
    mod = o.modifiers.new('Cropped', 'MASK'); mod.vertex_group = 'cropped'; mod.invert_vertex_group = True

# ---- limb difference: the lower leg below the knee is removed; held.prosthesis() replaces it ----------
amputee = who.get('prosthesis')
if amputee:
    groups = {g.index: g.name for g in base.vertex_groups}; lower = {f'calf_{amputee}', f'foot_{amputee}', f'ball_{amputee}'}
    gone = [v.index for v in base.data.vertices if sum(g.weight for g in v.groups if groups.get(g.group) in lower) > .55]
    vg = base.vertex_groups.new(name='amputated'); vg.add(gone, 1., 'REPLACE')
    mod = base.modifiers.new('Amputated', 'MASK'); mod.vertex_group = 'amputated'; mod.invert_vertex_group = True

# ---- pose ------------------------------------------------------------------------------------------
bpy.context.view_layer.objects.active = rig
pose = cast.DESK_POSES[spec['pose']](spec['height']) if spec['pose'] in cast.DESK_POSES else cast.POSES[spec['pose']]
if callable(pose):
    # Free-standing poses are written for a 1.70 m person and scale with the character.
    k = (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47
    if who.get('limbs'):
        k -= sum(rig.data.bones[b].length for b in ('thigh_l', 'calf_l')) * (1 - who['limbs'][0]) / 1.47
    pose = pose(k)
if who.get('limbs'):
    # Shorter legs: the pelvis comes down by what the thigh and calf lose.
    drop = sum(rig.data.bones[b].length for b in ('thigh_l', 'calf_l')) * (1 - who['limbs'][0])
    pose = dict(pose, limbs=who['limbs'])
    if 'pelvis' not in pose: off = pose.get('pelvis_offset', (0, 0, 0)); pose['pelvis_offset'] = (off[0], off[1], off[2] - drop)
pose_lib.apply_pose(rig, pose)
extras = held.build(rig, [(kind, dict(kw)) for kind, kw in spec.get('held', [])])

# ---- bake to one static mesh -------------------------------------------------------------------
dg = bpy.context.evaluated_depsgraph_get(); baked = []
for o in meshes:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if not len(me.polygons): continue
    b = bpy.data.objects.new(o.name + '.baked', me); b.matrix_world = o.matrix_world.copy(); bpy.context.scene.collection.objects.link(b); baked.append(b)
for o in meshes + [rig]: bpy.data.objects.remove(o)
baked += extras

# Skin under clothing pokes through once the body is posed. Any body face with cloth just outside it goes.
from mathutils.bvhtree import BVHTree  # noqa: E402
import bmesh  # noqa: E402
body = next(b for b in baked if b.name == base_name + '.baked')
SMALL = ('low-poly', 'teeth', 'tongue', 'eyebrow', 'eyelash', 'glasses')
cloth = [b for b in baked if b is not body and b not in extras and not any(k in b.name.lower() for k in SMALL) and not (who.get('hair') and who['hair'] in b.name)]
# Outer garments first, in the order the character lists them: each layer loses the faces a layer above it covers.
order = {name: i for i, name in enumerate(who['clothes'])}
cloth.sort(key=lambda b: order.get(b.name.split('.', 1)[-1].replace('.baked', ''), 99))


def tree_of(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world); t = BVHTree.FromBMesh(bm); bm.free(); return t


def cull_under(o, trees, reach, through=.018):
    if not trees: return
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world); bm.normal_update()
    # Covered: a layer above lies just outside the face (within `reach`), or the face has pushed out through that
    # layer (by up to `through`).
    def hidden(f):
        c = f.calc_center_median()
        return any(t.ray_cast(c + f.normal * .0005, f.normal, reach)[0] is not None or t.ray_cast(c - f.normal * .0005, -f.normal, through)[0] is not None for t in trees)
    covered = [f for f in bm.faces if hidden(f)]
    bmesh.ops.delete(bm, geom=covered, context='FACES'); bm.transform(o.matrix_world.inverted()); bm.to_mesh(o.data); bm.free()


# Heavy garments (knitwear, long skirts) come down to a budget; the silhouette survives it.
for c in cloth:
    c.data.calc_loop_triangles(); n = len(c.data.loop_triangles)
    if n > 14000:
        mod = c.modifiers.new('Budget', 'DECIMATE'); mod.ratio = 14000 / n
        me = bpy.data.meshes.new_from_object(c.evaluated_get(bpy.context.evaluated_depsgraph_get())); c.modifiers.clear(); old = c.data; c.data = me; bpy.data.meshes.remove(old)
trees = [tree_of(c) for c in cloth]
cull_under(body, trees, .035)
# A garment can push further out through the one over it than skin does (a trouser yoke through the back of a shirt).
for i, c in enumerate(cloth[1:], 1): cull_under(c, trees[:i], .025, .045)
bpy.ops.object.select_all(action='DESELECT')
for b in baked: b.select_set(True)
bpy.context.view_layer.objects.active = baked[0]; bpy.ops.object.join(); person = bpy.context.object; person.name = OUT_ID
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for g in list(person.vertex_groups): person.vertex_groups.remove(g)
bpy.ops.object.shade_smooth()
# Feet on the floor: the lowest point of the model sits at Z = 0.
low = min((person.matrix_world @ v.co).z for v in person.data.vertices)
if spec.get('ground', True): person.location.z -= low; bpy.ops.object.transform_apply(location=True)

person.data.calc_loop_triangles()
co = np.array([v.co[:] for v in person.data.vertices])
result = {'id': OUT_ID, 'ok': True, 'tris': len(person.data.loop_triangles),
          # glTF axes (Y up): x = x, y = z, z = -y; millimetres.
          'min': [round(float(co[:, 0].min()) * 1000, 1), round(float(co[:, 2].min()) * 1000, 1), round(float(-co[:, 1].max()) * 1000, 1)],
          'max': [round(float(co[:, 0].max()) * 1000, 1), round(float(co[:, 2].max()) * 1000, 1), round(float(-co[:, 1].min()) * 1000, 1)],
          'alpha': {m.name: m.get('alpha', 'OPAQUE') for m in person.data.materials}}
result['size'] = [round(result['max'][i] - result['min'][i], 1) for i in range(3)]

os.makedirs(OUT_DIR, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, OUT_ID + '.glb'), export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_materials='EXPORT', export_image_format='AUTO', export_animations=False, export_skins=False, export_morph=False)
print('RESULT ' + json.dumps(result))

if PREVIEW:
    scene = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=8); floor = bpy.context.object
    m = bpy.data.materials.new('floor'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs[0].default_value = (.62, .6, .58, 1); floor.data.materials.append(m)
    cam = bpy.data.cameras.new('c'); co_ = bpy.data.objects.new('c', cam); scene.collection.objects.link(co_); scene.camera = co_; cam.lens = 55
    sun = bpy.data.lights.new('s', 'SUN'); so = bpy.data.objects.new('s', sun); scene.collection.objects.link(so); so.rotation_euler = (math.radians(52), 0, math.radians(35)); sun.energy = 3.2; sun.angle = .15
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.82, .86, .92, 1)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True; scene.render.resolution_x = 560; scene.render.resolution_y = 760
    mid = Vector((0, 0, (result['max'][1] / 1000) * .55))
    for tag, loc in (('a', (1.9, -2.6, 1.35)), ('b', (-2.9, -.4, 1.2))):
        co_.location = loc; co_.rotation_euler = (mid - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{PREVIEW}-{tag}.png'; bpy.ops.render.render(write_still=True)
