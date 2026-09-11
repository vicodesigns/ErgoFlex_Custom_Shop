"""Blender batch converter: source models -> normalised, real-world-scaled GLB props.

Run by tools/convert-props.mjs; can be used directly:
  blender -b -P tools/props/blender-convert.py -- jobs.json
jobs.json is a list of {id, source, fit: {axis, mm}, anchor, rotateY, out}.
Each job is imported into an empty scene, scaled so the bounding box measures
`fit.mm` millimetres along `fit.axis` ('x' | 'y' | 'z' | 'max'), rotated by
`rotateY` degrees, re-anchored (floor: base at y=0, ceiling: top at y=0,
wall: back at z=0, center), centred, and exported as a Y-up GLB in metres
with the transforms baked. Results (mm bounds, triangle count) are printed as
one JSON line per job prefixed with `RESULT ` for the driver to collect.
"""
import bpy, sys, json, os, math, traceback
from mathutils import Vector, Matrix

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for col in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.objects):
        for item in list(col):
            col.remove(item)

def import_source(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.usdz', '.usd', '.usda', '.usdc'):
        bpy.ops.wm.usd_import(filepath=path, import_materials=True, import_usd_preview=True,
                              import_textures_mode='IMPORT_PACK', import_cameras=False, import_lights=False,
                              read_mesh_uvs=True, read_mesh_colors=True, import_subdiv=False,
                              set_frame_range=False)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y')
    elif ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        raise ValueError(f'unsupported source {path}')

def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']

def world_bounds(objs):
    lo = Vector((math.inf,) * 3); hi = Vector((-math.inf,) * 3)
    for o in objs:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi

def triangle_count(objs):
    n = 0
    for o in objs:
        for p in o.data.polygons: n += max(len(p.vertices) - 2, 0)
    return n

def clean_scene():
    # Drop anything that is not a mesh or the parent of one; empties without meshes below them add nothing.
    keep = set()
    for o in mesh_objects():
        p = o
        while p: keep.add(p); p = p.parent
    for o in list(bpy.context.scene.objects):
        if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
    for o in mesh_objects():
        if o.data.users > 1: o.data = o.data.copy()
        if len(o.data.polygons) == 0: bpy.data.objects.remove(o, do_unlink=True)

def exclude_objects(patterns):
    # Drop meshes whose own name or any ancestor's name contains a pattern:
    # Sketchfab exports often carry a ground disc or floor slab with the model.
    if not patterns: return
    for o in list(mesh_objects()):
        names = []
        p = o
        while p: names.append(p.name); p = p.parent
        if any(pat in n for pat in patterns for n in names): bpy.data.objects.remove(o, do_unlink=True)

def override_materials(spec):
    # Untextured sources (Rhino files with no materials) come through black;
    # give every image-free material the manifest's colour and finish.
    if not spec: return
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes): continue
        if 'color' in spec: bsdf.inputs['Base Color'].default_value = (*spec['color'], 1.0)
        if 'roughness' in spec: bsdf.inputs['Roughness'].default_value = spec['roughness']
        if 'metallic' in spec: bsdf.inputs['Metallic'].default_value = spec['metallic']
        if 'alpha' in spec: bsdf.inputs['Alpha'].default_value = spec['alpha']
        if 'emissive' in spec:
            bsdf.inputs['Emission Color'].default_value = (*spec['emissive'], 1.0)
            bsdf.inputs['Emission Strength'].default_value = spec.get('emissiveStrength', 1.0)

def decimate(objs, budget):
    # Decimate in Blender, not after export. glTF splits a vertex per unique
    # normal/UV, so a post-export simplifier sees mostly unshared vertices and
    # barely reduces these photogrammetry meshes; Blender keeps normals and UVs
    # as loop data over a shared vertex and collapses the real topology.
    total = triangle_count(objs)
    if not budget or total <= budget: return total
    ratio = max(budget / total, 0.02)
    for o in objs:
        if len(o.data.polygons) < 200: continue
        mod = o.modifiers.new('budget', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return triangle_count(objs)

def fix_materials():
    # Blender's USD importer leaves the Principled alpha at whatever the file said;
    # opaque surfaces with a stray alpha input still export as BLEND, which makes
    # three.js sort and shade them like glass. Force opaque unless a real texture
    # alpha or a below-1 constant is present.
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf: continue
        a = bsdf.inputs['Alpha']
        if not a.is_linked and a.default_value >= 0.999: m.blend_method = 'OPAQUE'
        elif not a.is_linked and a.default_value < 0.999: m.blend_method = 'BLEND'
        m.use_backface_culling = False

def bake_transforms():
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects()[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def run(job):
    reset()
    import_source(job['source'])
    exclude_objects(job.get('exclude'))
    clean_scene()
    override_materials(job.get('material'))
    objs = mesh_objects()
    if not objs: raise ValueError('no mesh geometry after import')
    # Blender is Z-up while the manifest (and the exported GLB) are Y-up:
    # manifest x -> Blender x, manifest y (up) -> Blender z, manifest z -> Blender -y.
    # Rotate about the origin first so the fit measures the final orientation.
    rot = Matrix.Rotation(math.radians(job.get('rotateY', 0)), 4, 'Z')
    if job.get('rotateX'): rot = Matrix.Rotation(math.radians(job['rotateX']), 4, 'X') @ rot
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    for o in roots: o.matrix_world = rot @ o.matrix_world
    bpy.context.view_layer.update()
    lo, hi = world_bounds(objs); size = hi - lo
    fit = job['fit']; axis = fit.get('axis', 'y')
    current = max(size) if axis == 'max' else size[{'x': 0, 'y': 2, 'z': 1}[axis]]
    if current <= 0: raise ValueError(f'degenerate bounds {tuple(size)}')
    s = (fit['mm'] / 1000.0) / current
    for o in roots: o.matrix_world = Matrix.Scale(s, 4) @ o.matrix_world
    bpy.context.view_layer.update()
    lo, hi = world_bounds(objs); size = hi - lo; centre = (lo + hi) / 2
    anchor = job.get('anchor', 'floor')
    shift = Vector((-centre.x, -centre.y, -centre.z))   # Blender space: z is up, -y is the manifest's +z
    if anchor == 'floor': shift.z = -lo.z
    elif anchor == 'ceiling': shift.z = -hi.z
    elif anchor == 'wall': shift.y = -hi.y          # back face on z=0, object extends toward +z (into the room)
    elif anchor == 'wall-floor': shift.y = -hi.y; shift.z = -lo.z
    for o in roots: o.matrix_world = Matrix.Translation(shift) @ o.matrix_world
    bpy.context.view_layer.update()
    bake_transforms()
    fix_materials()
    before = triangle_count(objs)
    reduced = decimate(objs, job.get('budget'))
    job['sourceTris'] = before
    lo, hi = world_bounds(objs)
    lo, hi = Vector((lo.x, lo.z, -hi.y)), Vector((hi.x, hi.z, -lo.y))   # report in Y-up
    os.makedirs(os.path.dirname(job['out']), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_lights=False, export_cameras=False, export_extras=False,
                              export_image_format='AUTO', export_materials='EXPORT', export_texcoords=True,
                              export_normals=True, export_tangents=False, use_selection=False)
    return {'id': job['id'], 'ok': True, 'tris': reduced, 'sourceTris': job.get('sourceTris'), 'meshes': len(objs),
            'materials': len({m for o in objs for m in o.data.materials if m}),
            'min': [round(v * 1000, 1) for v in lo], 'max': [round(v * 1000, 1) for v in hi],
            'size': [round(v * 1000, 1) for v in (hi - lo)]}

if __name__ == '__main__':
    jobs = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    for job in jobs:
        try:
            print('RESULT ' + json.dumps(run(job)), flush=True)
        except Exception as e:
            traceback.print_exc()
            print('RESULT ' + json.dumps({'id': job['id'], 'ok': False, 'error': str(e)}), flush=True)
