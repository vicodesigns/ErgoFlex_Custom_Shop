# Chapter 12 hero desk props (polish1124 Stream D, Vico approved the phase-1 candidates on Nov 24 2026).
# Blender 3.6:  blender -b --factory-startup --python tools/props/hero-desks/build_props.py -- <textures dir> <out dir> [ids...]
# Run through tools/props/build-hero-desk-props.mjs (textures, then this, then gltf-transform optimize, then the index/manifest).
# Real-world millimetres, floor origin (bottom centre), front = +Z in glTF (toward the user). One mesh per prop (materials as
# primitives) to keep draw calls low; the mic arm keeps one node per joint (named J0..J6, pivot at the joint) in the pose
# baked for the office desk's right accessory port: it clears the screens (forward and outward, then turned toward the user).
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
TEX, OUT = argv[0], argv[1]
ONLY = set(argv[2:])
MM = 0.001
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
MATS, IMGS = {}, {}
def lin(c): return [((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]
def H(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
def image(name, color=True):
    key = (name, color)
    if key not in IMGS:
        im = bpy.data.images.load(os.path.join(TEX, name)); im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'; IMGS[key] = im
    return IMGS[key]
def mat(name, color='#ffffff', rough=.5, metal=0., alpha=1., tex=None, normal=None, nstrength=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(H(color)), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1: b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'; m.shadow_method = 'HASHED'
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(tex); nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(normal, False); n = nt.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value = nstrength
        nt.links.new(t.outputs['Color'], n.inputs['Color']); nt.links.new(n.outputs['Normal'], b.inputs['Normal'])
    MATS[name] = m; return m
ROOT = None
def put(o, x, y, z, rot, parent):
    o.location = (x * MM, y * MM, z * MM); o.rotation_euler = [math.radians(a) for a in rot]; o.parent = parent or ROOT
def finish(o, m, bevel=0, seg=3):
    if m: o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel * MM; mod.segments = seg; mod.limit_method = 'ANGLE'; mod.harden_normals = False
    return o
def smooth(o, angle=40):
    o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(angle)
    for p in o.data.polygons: p.use_smooth = True
def box(name, sx, sy, sz, x=0, y=0, z=0, m=None, bevel=0, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.name = name
    o.scale = (sx * MM, sy * MM, sz * MM); bpy.ops.object.transform_apply(scale=True)
    put(o, x, y, z, rot, parent); finish(o, m, bevel)
    if bevel: smooth(o, 35)
    return o
def cyl(name, r, h, x=0, y=0, z=0, m=None, rot=(0, 0, 0), verts=40, r2=None, parent=None, sm=True, bevel=0):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r * MM, depth=h * MM)
    else: bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r * MM, radius2=r2 * MM, depth=h * MM)
    o = bpy.context.active_object; o.name = name; put(o, x, y, z, rot, parent); finish(o, m, bevel, 2)
    if sm: smooth(o, 50)
    return o
def tor(name, R, r, x=0, y=0, z=0, m=None, rot=(0, 0, 0), arc=360, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R * MM, minor_radius=r * MM, major_segments=48, minor_segments=12)
    o = bpy.context.active_object; o.name = name
    if arc < 360:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if (math.degrees(math.atan2(v.co.y, v.co.x)) % 360) > arc + .5], context='VERTS'); bm.to_mesh(o.data); bm.free()
    put(o, x, y, z, rot, parent); finish(o, m); smooth(o, 80); return o
def sph(name, r, x=0, y=0, z=0, m=None, sc=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r * MM, segments=24, ring_count=12); o = bpy.context.active_object; o.name = name
    o.scale = sc; bpy.ops.object.transform_apply(scale=True); put(o, x, y, z, (0, 0, 0), parent); finish(o, m); smooth(o, 80); return o
def empty(name, x=0, y=0, z=0, rot=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None); scn.collection.objects.link(o); o.empty_display_size = .02; put(o, x, y, z, rot, parent); return o
def plane(name, w, h, x, y, z, m, rot=(90, 0, 0), uv=(0, 0, 1, 1), parent=None):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.active_object; o.name = name
    o.scale = (w * MM, h * MM, 1); bpy.ops.object.transform_apply(scale=True); put(o, x, y, z, rot, parent)
    u0, v0, u1, v1 = uv
    for loop in o.data.loops:
        co = o.data.vertices[loop.vertex_index].co; o.data.uv_layers.active.data[loop.index].uv = (u0 if co.x < 0 else u1, v0 if co.y < 0 else v1)
    o.data.materials.append(m); return o
# ---------------------------------------------------------------- shared materials (names follow the existing props: '<Kind> · <finish>')
LEATHER = lambda: mat('Leather · chestnut', '#5b3220', .52, normal='leather-normal.png', nstrength=.22)
LEATHER_D = lambda: mat('Leather · chestnut dark', '#46261a', .5, normal='leather-normal.png', nstrength=.22)
BRASS = lambda: mat('Metal · brushed brass', '#c9a24a', .3, 1)
ALU = lambda: mat('Metal · polished aluminium', '#e6e8ea', .16, 1)
PLUG = lambda: mat('Plug · polished aluminum', '#ffffff', .14, 1)    # the hook plug's own material name (the same plug)
BLACK_AL = lambda: mat('Metal · black anodised', '#1c1f23', .36, .85)
STEEL = lambda: mat('Metal · spring steel', '#8d959c', .28, 1)
RUBBER = lambda: mat('Rubber · black', '#111315', .82)
PAPER = lambda: mat('Paper · white', '#f2f0ea', .85, normal='paper-normal.png', nstrength=.4)
BEECH = lambda: mat('Wood · beech', '#ffffff', .55, tex='wood-beech.jpg', normal='wood-beech-normal.png', nstrength=.3)
WALNUT = lambda: mat('Wood · walnut', '#ffffff', .48, tex='wood-walnut.jpg', normal='wood-walnut-normal.png', nstrength=.3)
GLASS = lambda: mat('Glass · clear', '#e8f2f4', .05, 0, .28)
PROPS = {}
def prop(pid, name, desk, joints=False):
    def deco(fn): PROPS[pid] = (name, desk, fn, joints); return fn
    return deco
# ================================================================ office
@prop('herodesk-office-briefcase', 'Hero desk · Leather attaché briefcase (chestnut, brass)', 'office')
def _():
    L, LD = LEATHER(), LEATHER_D()
    box('body', 380, 100, 280, 0, 0, 148, L, 14)
    box('flap', 384, 104, 150, 0, 0, 218, LD, 10)
    box('welt', 386, 30, 6, 0, 0, 143, mat('Leather · stitch welt', '#3a1f12', .6), 2)
    S = mat('Thread · waxed cream', '#d8c7a0', .7)
    for z in (146.5, 289): box('stitch', 360, 106, 1.2, 0, 0, z, S)
    for s in (-1, 1):
        box('clasp', 30, 8, 36, s * 110, -54, 225, BRASS(), 2); box('clasp-pin', 10, 6, 10, s * 110, -58, 214, BRASS(), 1)
        for y in (-30, 30): cyl('foot', 7, 8, s * 160, y, 4, BRASS(), verts=16)
        box('lug', 14, 22, 14, s * 42, 0, 292, BRASS(), 2)
    tor('handle', 42, 8, 0, 0, 296, L, rot=(90, 0, 0), arc=180)
    box('lock', 26, 6, 20, 0, -54, 250, BRASS(), 2)
@prop('herodesk-office-files', 'Hero desk · Tidy files (2 lever-arch binders, slim file)', 'office')
def _():
    x0 = -97.5
    for w, c, lab in ((75, '#23395d', 'binder-a.png'), (75, '#5d6670', 'binder-b.png'), (45, '#1d1f22', 'binder-c.png')):
        x = x0 + w / 2; x0 += w
        box('binder', w - 2, 285, 318, x, 0, 159, mat('Plastic · binder ' + c, c, .55), 3)
        box('pages', w - 10, 270, 4, x, 4, 316.5, PAPER())
        plane('label', w * .62, 140, x, -143.6, 215, mat('Paper · label ' + lab, '#ffffff', .8, tex=lab))
        if w > 50: tor('ring', 11, 2.6, x, -143.2, 80, RUBBER(), rot=(90, 0, 0))
@prop('herodesk-office-photo-frame', 'Hero desk · Framed photo (5x7 in, walnut, beach at golden hour)', 'office')
def _():
    p = empty('lean', rot=(-12, 0, 0)); W = WALNUT()
    for sx, sz, x, z in ((130, 14, 0, 7), (130, 14, 0, 173), (14, 180, -58, 90), (14, 180, 58, 90)): box('frame', sx, 14, sz, x, 0, z, W, 1.5, parent=p)
    box('back', 118, 4, 168, 0, 5, 90, mat('Card · backing', '#3b3530', .9), parent=p)
    plane('mat', 104, 154, 0, -2.6, 90, mat('Card · mat white', '#f3f1ea', .9), parent=p)
    plane('photo', 84, 126, 0, -2.8, 90, mat('Print · beach photo', '#ffffff', .35, tex='photo-beach.jpg'), parent=p)
    box('strut', 20, 4, 128, 0, 70, 62, mat('Card · backing', '#3b3530', .9), rot=(25, 0, 0))
@prop('herodesk-office-plant', 'Hero desk · Snake plant in a white ceramic pot (fits the cubby cup)', 'office')
def _():
    cyl('pot', 44, 95, 0, 0, 47.5, mat('Ceramic · white gloss', '#f1f0ec', .18), r2=40, verts=48)
    tor('rim', 42.5, 2.5, 0, 0, 94, mat('Ceramic · white gloss', '#f1f0ec', .18))
    cyl('soil', 41, 4, 0, 0, 91, mat('Soil · bark mix', '#3a2a1e', 1), verts=32)
    random.seed(4); G1, G2 = mat('Leaf · sansevieria', '#2f6b3a', .5), mat('Leaf · sansevieria pale', '#5f8f3f', .5)
    for i in range(9):
        a = i * 40 + random.uniform(-15, 15); r = random.uniform(5, 24); h = random.uniform(150, 215)
        o = cyl('leaf', 13, h, r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), 91 + h / 2, G1 if i % 3 else G2, r2=1.2, verts=12,
                rot=(random.uniform(-9, 9), random.uniform(-9, 9), a)); o.scale = (1, .26, 1)
@prop('herodesk-office-pen-cup', 'Hero desk · Pens, pencil, highlighter and scissors (for the cubby cup)', 'office')
def _():
    for x, y, r, h, c, t in ((-18, -10, 4.5, 145, '#1f3b8f', 6), (16, -14, 4.5, 145, '#111111', -5), (0, 18, 3.6, 175, '#f2c230', 3),
                             (-22, 14, 4.5, 140, '#c62f2f', -8), (22, 12, 6, 120, '#f4ef3a', 7)):
        p = empty('tilt', x, y, 0, rot=(t, -t * .6, 0))
        cyl('body', r, h, 0, 0, h / 2, mat('Plastic · ' + c, c, .4), verts=6 if r < 4 else 20, sm=r >= 4, parent=p)
        if r < 4: cyl('eraser', r, 10, 0, 0, h + 5, mat('Rubber · pink eraser', '#e48a9a', .8), verts=12, parent=p); cyl('ferrule', r + .3, 6, 0, 0, h - 1, ALU(), verts=12, parent=p)
        else:
            cyl('cap', r + .6, 32, 0, 0, h - 12, mat('Plastic · cap ' + c, c, .35), verts=20, parent=p)
            box('clip', 2, 2, 26, 0, -(r + 1.2), h - 14, ALU(), parent=p)
    p = empty('scissors', 5, 0, 0, rot=(-6, 4, 30)); O = mat('Plastic · orange handle', '#e86a1c', .4)
    box('blade', 7, 2, 95, 0, 0, 48, ALU(), 1, parent=p)
    tor('ring', 13, 3.5, -9, 0, 108, O, rot=(90, 0, 0), parent=p); tor('ring2', 12, 3.5, 11, 0, 104, O, rot=(90, 0, 0), parent=p)
@prop('herodesk-office-sticky-notes', 'Hero desk · Sticky-note pads (yellow, pink) and a loose note', 'office')
def _():
    Y = mat('Paper · sticky yellow', '#f5e66a', .85, normal='paper-normal.png', nstrength=.4)
    box('pad', 76, 76, 16, 0, 0, 8, Y, .6, rot=(0, 0, 8)); box('pad2', 76, 76, 12, 45, 40, 6, mat('Paper · sticky pink', '#f39fb4', .85, normal='paper-normal.png', nstrength=.4), .6, rot=(0, 0, -14))
    box('note', 76, 76, .6, -30, 70, .3, Y, rot=(0, 0, 25))
    for k in range(4): box('ink', 40 - k * 6, 1.6, .2, -34 + k * 2, 60 + k * 9, .7, mat('Ink · blue pen', '#24408f', .6), rot=(0, 0, 25))
@prop('herodesk-office-phone', 'Hero desk · Smartphone (stands in the cubby slot)', 'office')
def _():
    p = empty('lean', rot=(-8, 0, 0))
    box('phone', 72, 8, 150, 0, 0, 75, mat('Metal · phone graphite', '#2a2d31', .3, .85), 4, parent=p)
    box('screen', 66, 1, 140, 0, -4.2, 75, mat('Glass · phone screen', '#0b0e12', .06), 1, parent=p)
    box('camera', 22, 2, 22, -20, 4.8, 128, mat('Glass · phone screen', '#0b0e12', .06), 3, parent=p)
# ================================================================ architect
@prop('herodesk-arch-tube', 'Hero desk · Telescoping drawing tube (black)', 'architect')
def _():
    K = mat('Plastic · tube black', '#1b1d20', .55); G = mat('Plastic · cap grey', '#4a4f55', .5)
    cyl('lower', 47.5, 360, 0, 0, 180, K, verts=48); cyl('upper', 45.5, 290, 0, 0, 505, K, verts=48)
    for z in (20, 630): cyl('cap', 50, 40, 0, 0, z, G, verts=48, bevel=3)
    for z in (5, 35, 615, 645): tor('ridge', 50, 1.5, 0, 0, z, G)
    cyl('ring', 49, 12, 0, 0, 362, G, verts=48)
    box('strap', 30, 3, 560, 0, -50, 330, mat('Webbing · black nylon', '#141414', .9, normal='canvas-normal.png', nstrength=.6))
    for z in (70, 590): box('strap-clip', 36, 8, 22, 0, -50, z, BLACK_AL(), 2)
@prop('herodesk-arch-rolls', 'Hero desk · Rolled drawings (white, blueprint, kraft)', 'architect')
def _():
    for x, y, r, h, c, t in ((-12, 0, 20, 460, '#f3f1ea', 4), (14, 6, 18, 440, '#2f5fa8', -5), (2, -18, 16, 420, '#d8c3a0', 2)):
        p = empty('tilt', x, y, 0, rot=(t, t * .7, 0))
        cyl('roll', r, h, 0, 0, h / 2, mat('Paper · ' + c, c, .85, normal='paper-normal.png', nstrength=.5), parent=p)
        cyl('end', r * .62, h + 1, 0, 0, h / 2, mat('Paper · roll end', '#bdb7a8', .9), verts=24, parent=p)
        tor('band', r + .3, 1.2, 0, 0, h * .62, mat('Rubber · red band', '#b8322a', .6), parent=p)
@prop('herodesk-arch-scale-ruler', 'Hero desk · Triangular architect scale ruler (1:100 / 1:200 / 1:500)', 'architect')
def _():
    # lying on a flat face (the prism's apex up): cylinder of 3 sides turned so its first corner points up
    R = 18.5; cyl('scale', R, 300, 0, 0, R / 2, mat('Aluminium · white scale', '#e9ecef', .35, .2), rot=(0, -90, 0), verts=3, sm=False)
    for s in (-1, 1): cyl('end', R + .2, 6, s * 150, 0, R / 2, mat('Plastic · scale end red', '#c7352c', .4), rot=(0, -90, 0), verts=3, sm=False)
    # the two upward faces (60 deg) carry the printed scales: texture rows 1:100 and 1:200
    face = R * math.sqrt(3); P = mat('Print · scale faces', '#ffffff', .4, tex='scale-ruler.png')
    for k, s in enumerate((-1, 1)):
        plane('print', 288, face * .9, 0, s * (R * math.sqrt(3) / 4 + .26), R / 2 + R / 4 + .15, P, rot=(-60 * s, 0, 0), uv=(0, 1 - (k + 1) / 3, 1, 1 - k / 3))
@prop('herodesk-arch-trace-roll', 'Hero desk · Yellow tracing-paper roll (12 in) with a pulled-out sheet', 'architect')
def _():
    T = mat('Paper · yellow trace', '#efe2a0', .7, 0, .9, normal='paper-normal.png', nstrength=.3)
    cyl('roll', 30, 305, 0, 0, 30, T, rot=(0, 90, 0), verts=40); cyl('core', 16, 307, 0, 0, 30, mat('Card · core', '#a07b52', .9), rot=(0, 90, 0), verts=24)
    box('tail', 300, 110, .5, 0, -80, .25, T)
    for k in range(3): box('sketch', 60 + k * 30, 1, .2, -60 + k * 40, -70 - k * 12, .6, mat('Ink · graphite sketch', '#4a4a4a', .8), rot=(0, 0, k * 20 - 10))
@prop('herodesk-arch-model-house', 'Hero desk · Study model house (white card, basswood; a variant of House A)', 'architect')
def _():
    box('base', 180, 150, 8, 0, 0, 4, mat('Wood · basswood', '#dcc49e', .65, normal='wood-beech-normal.png', nstrength=.3), 1)
    C = mat('Card · white museum board', '#f4f3ef', .85, normal='paper-normal.png', nstrength=.3); S = mat('Card · window shadow', '#3b4048', .9)
    box('walls', 110, 70, 52, -10, 5, 34, C); box('wing', 50, 45, 36, 52, -8, 26, C); box('wing-roof', 54, 49, 3, 52, -8, 45.5, mat('Wood · basswood roof', '#d2b383', .6))
    for x in (-40, -12, 18): box('win', 14, 2, 18, x, -30.5, 38, S); box('win-back', 14, 2, 18, x, 40.5, 38, S)
    box('door', 14, 2, 26, 52, -31, 21, S); box('step', 22, 8, 3, 52, -35, 9.5, C)
    RF = mat('Wood · basswood roof', '#d2b383', .6)
    for sy in (-1, 1): box('roof', 118, 50, 4, -10, 5 + sy * 20, 72, RF, rot=(sy * -35, 0, 0))
    for sx in (-1, 1):   # the gable ends, closed (card triangles flush with the end walls)
        g = cyl('gable', 16, 2, -10 + sx * 54, 5, 68, C, rot=(0, -90, 0), verts=3, sm=False); g.scale = (1, 2.4, 1)
    box('chimney', 10, 10, 22, -40, 15, 92, C)
    for x, y in ((-70, 55), (75, 50), (-75, -55)):
        cyl('trunk', 2, 20, x, y, 18, mat('Wood · basswood', '#dcc49e', .65), verts=8); sph('crown', 12, x, y, 36, mat('Felt · pale green', '#9cb98a', .95))
@prop('herodesk-arch-coffee', 'Hero desk · Coffee mug (charcoal ceramic)', 'architect')
def _():
    M = mat('Ceramic · charcoal glaze', '#2f3236', .35)
    cyl('mug', 41, 95, 0, 0, 47.5, M, verts=48); cyl('inside', 37, 2, 0, 0, 94.5, mat('Ceramic · inner glaze', '#e9e5dc', .2), verts=48)
    cyl('coffee', 37.5, 2, 0, 0, 84, mat('Coffee · with crema', '#5a3a22', .12), verts=48)
    tor('handle', 22, 6, 46, 0, 50, M, rot=(90, 0, 0))
@prop('herodesk-arch-cup-fill', 'Hero desk · Drafting pencils, fineliners and a compass (for the cubby cup)', 'architect')
def _():
    for x, y, r, h, c, t in ((-18, 0, 4, 160, '#2b3f63', 7), (-5, 18, 4, 150, '#2b2b2b', -4), (14, 10, 3.6, 175, '#5a6b4a', 5),
                             (18, -14, 4.5, 140, '#111111', -7), (0, -20, 4.5, 140, '#111111', 3)):
        p = empty('tilt', x, y, 0, rot=(t, -t * .5, 0))
        cyl('pen', r, h, 0, 0, h / 2, mat('Plastic · ' + c, c, .4), verts=8, sm=False, parent=p); cyl('tip', r * .5, 14, 0, 0, h + 7, ALU(), r2=.5, verts=12, parent=p)
        cyl('grip', r + .3, 30, 0, 0, 40, RUBBER(), verts=12, parent=p)
    p = empty('compass', 0, 2, 0, rot=(0, 0, 20))
    for s in (-1, 1): box('leg', 4, 4, 150, s * 9, 0, 75, ALU(), 1, rot=(0, s * -3, 0), parent=p)
    cyl('head', 7, 18, 0, 0, 158, BLACK_AL(), parent=p); cyl('knob', 3, 12, 0, 0, 172, ALU(), verts=16, parent=p)
# ================================================================ artist
@prop('herodesk-art-brushes', 'Hero desk · Paint brushes (8, for the cubby cup)', 'artist')
def _():
    random.seed(7)
    for i, c in enumerate(['#b5835a', '#a8322d', '#1d1d1f', '#b5835a', '#d9b27c', '#a8322d', '#1d1d1f', '#b5835a']):
        a = i * 45; r0 = 14 if i % 2 else 26; h = random.uniform(190, 290)
        p = empty('tilt', r0 * math.cos(math.radians(a)), r0 * math.sin(math.radians(a)), 0, rot=(random.uniform(-9, 9), random.uniform(-9, 9), 0))
        cyl('handle', 4.5, h * .72, 0, 0, h * .36, mat('Lacquer · ' + c, c, .28), r2=3.2, verts=16, parent=p)
        cyl('ferrule', 3.6, h * .14, 0, 0, h * .79, ALU(), verts=16, parent=p)
        o = cyl('bristle', 3.8, h * .12, 0, 0, h * .92, mat('Bristle · hog tan', '#c9a776', .9), r2=1.0, verts=12, parent=p)
        if i % 3 == 0: o.scale = (1.6, .5, 1)
        if i % 2 == 0: cyl('paint', 3.9, h * .03, 0, 0, h * .955, mat('Paint · ' + ['#2e3a9a', '#c8302a', '#3e9488', '#f2a36b'][i // 2], ['#2e3a9a', '#c8302a', '#3e9488', '#f2a36b'][i // 2], .3), r2=1.5, verts=12, parent=p)
@prop('herodesk-art-tools', 'Hero desk · Markers, palette knives and pencils (for the cubby)', 'artist')
def _():
    for x, y, c in ((-22, -40, '#3e9488'), (-22, -10, '#e8706a'), (-22, 20, '#2e3a7a'), (-22, 48, '#f2a36b')):
        cyl('marker', 7.5, 140, x, y, 70, mat('Plastic · marker grey', '#9aa0a6', .4), verts=20); cyl('cap', 7.8, 34, x, y, 128, mat('Plastic · ' + c, c, .4), verts=20)
    for y in (-30, 10):
        p = empty('knife', 18, y, 0, rot=(0, 6, 0))
        cyl('handle', 6, 100, 0, 0, 50, WALNUT(), verts=16, parent=p); cyl('ferrule', 6.2, 10, 0, 0, 102, BRASS(), verts=16, parent=p)
        box('blade', 18, 1, 70, 0, 0, 140, ALU(), 2, parent=p)
    for y in (40, 52): cyl('pencil', 3.6, 170, 18, y, 85, mat('Lacquer · pencil green', '#2f5d3a', .4), verts=6, sm=False); cyl('lead', 3.6, 10, 18, y, 175, BEECH(), r2=.8, verts=6)
@prop('herodesk-art-paint-jars', 'Hero desk · Paint jars (ultramarine, cadmium red, ochre, sap green)', 'artist')
def _():
    for (x, y), c in zip(((-25, -25), (25, -25), (-25, 25), (25, 25)), ('#2e3a9a', '#c8302a', '#c8902a', '#4b7a2e')):
        cyl('glass', 22.5, 45, x, y, 22.5, GLASS(), verts=32); cyl('paint', 21, 34, x, y, 18, mat('Paint · ' + c, c, .32), verts=32)
        cyl('lid', 23, 10, x, y, 50, mat('Plastic · lid white', '#f0efea', .4), verts=32, bevel=1.5)
        box('smear', 8, 1, 12, x + 10, y - 22.6, 40, mat('Paint · ' + c, c, .32))
        plane('label', 30, 14, x, y - 22.7, 26, mat('Paper · jar label', '#f4f0e4', .8), rot=(90, 0, 0))
@prop('herodesk-art-swatches', 'Hero desk · Colour swatch fan deck', 'artist')
def _():
    for i, c in enumerate(['#2e3a7a', '#6b4c9a', '#f2a36b', '#ffd89a', '#3e9488', '#1f4f5a', '#9ed4d6', '#e8706a']):
        s = empty('strip', 0, 0, 1 + i, rot=(0, 0, -36 + i * 10)); box('card', 40, 150, 1, 0, 65, 0, mat('Card · swatch ' + c, c, .7), parent=s)
        box('white', 40, 20, 1.05, 0, 130, 0, mat('Card · swatch white', '#f4f2ec', .8), parent=s)
    cyl('rivet', 4, 10, 0, 0, 5, BRASS(), verts=16)
@prop('herodesk-art-sketchbooks', 'Hero desk · Sketchbook stack (A4 hardcover, A5 kraft, pocket book)', 'artist')
def _():
    def book(w, d, t, z, c, rot):
        box('cover', w, d, t, 0, 0, z + t / 2, mat('Book · cloth ' + c, c, .75, normal='canvas-normal.png', nstrength=.2), 1.5, rot=(0, 0, rot))
        box('pages', w - 6, d - 4, t - 3, 2.5, 0, z + t / 2, mat('Paper · cream', '#efe7d2', .9, normal='paper-normal.png', nstrength=.6), rot=(0, 0, rot))
    book(210, 297, 15, 0, '#1d1d1f', 0); book(148, 210, 12, 15, '#b8946a', 7); book(90, 140, 13, 27, '#7a2e2e', -9)
    box('elastic', 92, 3, 14, 0, 30, 33.5, mat('Elastic · black', '#111111', .8), rot=(0, 0, -9))
    box('ribbon', 6, 40, .6, 30, -160, 1, mat('Ribbon · red', '#9c2a2a', .7))
@prop('herodesk-art-canvas', 'Hero desk · Small canvas on a table easel (lakeside dusk oil study)', 'artist')
def _():
    p = empty('lean', rot=(-14, 0, 0)); B = BEECH()
    box('canvas', 200, 18, 250, 0, 0, 160, mat('Canvas · primed linen', '#f3efe6', .9, normal='canvas-normal.png', nstrength=.6), 1, parent=p)
    plane('painting', 198, 248, 0, -9.15, 160, mat('Paint · lakeside dusk study', '#ffffff', .55, tex='painting-lakeside-dusk.jpg', normal='painting-normal.png', nstrength=.8), parent=p)
    box('mast', 18, 12, 330, 0, 15, 165, B, 1, parent=p); box('ledge', 220, 30, 12, 0, -8, 30, B, 1, parent=p); box('lip', 220, 4, 10, 0, -22, 38, B, parent=p)
    box('clamp', 30, 22, 14, 0, 6, 290, B, 1, parent=p)
    box('leg', 14, 12, 220, -70, 90, 100, B, 1, rot=(28, 0, 0)); box('leg', 14, 12, 220, 70, 90, 100, B, 1, rot=(28, 0, 0))
@prop('herodesk-art-case', 'Hero desk · Wooden art case (beech, brass corners, leather handle)', 'artist')
def _():
    box('bottom', 300, 190, 70, 0, 0, 35, BEECH(), 3); box('lid', 300, 190, 35, 0, 0, 87.5, BEECH(), 3)
    box('seam', 302, 192, 1.5, 0, 0, 70, mat('Wood · seam shadow', '#4a3420', .8))
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (6, 99): box('corner', 16, 16, 12, sx * 144, sy * 89, z, BRASS(), 1)
        box('latch', 22, 6, 26, sx * 90, -96, 70, BRASS(), 1); box('lug', 12, 18, 10, sx * 45, 0, 110, BRASS(), 1)
        box('hinge', 40, 4, 14, sx * 90, 96, 70, BRASS(), 1)
    tor('handle', 45, 7, 0, 0, 112, LEATHER(), rot=(90, 0, 0), arc=180)
# ================================================================ microphone boom arm on the accessory port (office, right port)
# Pose (prop frame = the headphone hook's: +X out of the side panel, x=0 its outer face, glTF +Z toward the user):
# the shoulder turns 62.4 deg forward-outward, lower arm up 30.9 deg, upper arm down 47.3 deg, so the mic hangs ~243 mm out of
# the panel and ~380 mm forward of the port, beside (not in front of) the wide monitor, then the gimbal turns it toward the user.
POSE = {'J1': -62.4, 'J2': -30.9, 'J3': 78.2, 'J4': 47.3, 'J5': -104.3, 'J6': -6.0}
@prop('ergoflex-mic-boom-arm', 'ErgoFlex mic boom arm on the accessory port (posed for the office desk, right port)', 'office', joints=True)
def _():
    A, P, K, R, SP = ALU(), PLUG(), BLACK_AL(), RUBBER(), STEEL()
    KN = mat('Metal · knurled aluminium', '#d9dcdf', .3, 1, normal='knurl-normal.png', nstrength=.9)
    # the supplied plug's shape, copied (nothing on the fitting is altered): shaft dia 28.30 through the 18.1 mm panel, retaining flange dia 37.85
    cyl('Plug shaft', 14.15, 18.5, -9.25, 0, 0, P, rot=(0, 90, 0), verts=40); cyl('Plug retaining flange', 18.92, 4.7, -20.9, 0, 0, P, rot=(0, 90, 0), verts=40)
    cyl('J0 locking collar (visual)', 20, 10, 5, 0, 0, KN, rot=(0, 90, 0), verts=40, bevel=1)
    cyl('Stub', 11, 34, 27, 0, 0, K, rot=(0, 90, 0), verts=24); sph('Elbow block', 13, 44, 0, 0, K); cyl('Post', 10, 40, 44, 0, 22, K, verts=24)
    j1 = empty('J1 yaw (vertical post)', 44, 0, 44, rot=(0, 0, POSE['J1']))
    cyl('Yaw hub', 16, 22, 0, 0, 8, K, verts=32, bevel=1.5, parent=j1)
    for s in (-1, 1): box('Clevis cheek', 26, 6, 30, 0, s * 12, 26, K, 2, parent=j1)
    j2 = empty('J2 shoulder pitch', 0, 0, 26, rot=(0, POSE['J2'], 0), parent=j1)
    cyl('Shoulder axle', 5, 34, 0, 0, 0, A, rot=(90, 0, 0), verts=16, parent=j2); cyl('Shoulder knob', 9, 6, 0, 18, 0, A, rot=(90, 0, 0), verts=24, parent=j2)
    for s in (-1, 1): cyl('Lower rod', 4, 280, 140, s * 8, 0, K, rot=(0, 90, 0), verts=16, parent=j2)
    cyl('Lower spring', 3, 200, 125, 0, 9, SP, rot=(0, 90, 0), verts=12, parent=j2)
    j3 = empty('J3 elbow pitch', 280, 0, 0, rot=(0, POSE['J3'], 0), parent=j2)
    cyl('Elbow axle', 7, 30, 0, 0, 0, A, rot=(90, 0, 0), verts=24, parent=j3)
    for s in (-1, 1): cyl('Upper rod', 4, 280, 140, s * 8, 0, K, rot=(0, 90, 0), verts=16, parent=j3)
    cyl('Upper spring', 3, 200, 150, 0, -9, SP, rot=(0, 90, 0), verts=12, parent=j3)
    cyl('Cable', 2.2, 270, 140, 0, 6, R, rot=(0, 90, 0), verts=8, parent=j3)
    j4 = empty('J4 wrist (level)', 280, 0, 0, rot=(0, POSE['J4'], 0), parent=j3)
    cyl('Wrist', 8, 24, 0, 0, -12, K, verts=24, parent=j4)
    j5 = empty('J5 gimbal yoke (yaw)', 0, 0, -30, rot=(0, 0, POSE['J5']), parent=j4)
    y = tor('Yoke', 46, 3.5, 0, 0, 0, K, arc=180, parent=j5); y.rotation_euler = (math.radians(90), 0, math.radians(180))
    for s in (-1, 1): cyl('Yoke knob', 6, 8, 0, s * 46, 0, A, rot=(90, 0, 0), verts=24, parent=j5)
    j6 = empty('J6 mic tilt (shock mount)', rot=(0, POSE['J6'], 0), parent=j5)
    tor('Shock ring', 40, 3, 0, 0, 0, K, rot=(0, 90, 0), parent=j6)
    for a in range(0, 360, 90):
        e = cyl('Elastic', .9, 16, 0, 33 * math.cos(math.radians(a)), 33 * math.sin(math.radians(a)), R, verts=6, sm=False, parent=j6); e.rotation_euler = (math.radians(a + 90), 0, 0)
    cyl('Mic body', 26, 150, 20, 0, 0, mat('Metal · mic body satin black', '#202326', .42, .85), rot=(0, 90, 0), verts=40, bevel=2, parent=j6)
    cyl('Mic grille', 28, 55, 115, 0, 0, mat('Metal · mic grille', '#2c3034', .55, .9, normal='grille-normal.png', nstrength=1.2), rot=(0, 90, 0), verts=40, bevel=3, parent=j6)
    cyl('Grille band', 28.5, 6, 88, 0, 0, A, rot=(0, 90, 0), verts=40, parent=j6)
    cyl('XLR end', 22, 14, -62, 0, 0, A, rot=(0, 90, 0), verts=32, parent=j6)
# ================================================================ build: consolidate meshes, export, report
def consolidate(joints):
    meshes = [o for o in scn.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.convert(target='MESH')
    groups = {}
    for o in meshes:
        if not joints:
            mw = o.matrix_world.copy(); o.parent = ROOT; o.matrix_world = mw
        groups.setdefault(o.parent.name, []).append(o)
    if not joints:
        for o in [e for e in scn.objects if e.type == 'EMPTY' and e is not ROOT]: bpy.data.objects.remove(o, do_unlink=True)
    for parent, objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1: bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active; o.name = (ROOT.name if parent == ROOT.name else parent) + ' · mesh'
def build(pid):
    global ROOT
    for o in list(scn.objects): bpy.data.objects.remove(o, do_unlink=True)
    ROOT = bpy.data.objects.new(pid, None); scn.collection.objects.link(ROOT)
    name, desk, fn, joints = PROPS[pid]; fn(); bpy.context.view_layer.update()
    consolidate(joints); bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in scn.objects if o.type == 'MESH' for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    ROOT['heroDesk'] = desk
    return lo, hi
report = {}
os.makedirs(OUT, exist_ok=True)
for pid in PROPS:
    if ONLY and pid not in ONLY: continue
    lo, hi = build(pid)
    bpy.ops.object.select_all(action='DESELECT')
    for o in scn.objects: o.select_set(True)
    path = os.path.join(OUT, pid + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_extras=True, export_image_format='AUTO')
    report[pid] = {'name': PROPS[pid][0], 'desk': PROPS[pid][1], 'raw': path}
    print('BUILT', pid)
json.dump(report, open(os.path.join(OUT, 'build-report.json'), 'w'), indent=1)
print('DONE', len(report))
