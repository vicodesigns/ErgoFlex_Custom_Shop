"""Things people hold or wear: built as small meshes in the hand's (or head's, back's) frame.

Hand frame: origin at the middle of the palm, `along` the fingers, `normal` out of
the palm, `side` toward the thumb side for both hands. Sizes in metres.
"""
import math
import bpy, bmesh
from mathutils import Matrix, Vector
import pose_lib

_materials = {}


def material(name, color, rough=.5, metal=0., emit=None):
    if name in _materials: return _materials[name]
    m = bpy.data.materials.new('Held.' + name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 1.
    m['alpha'] = 'OPAQUE'; _materials[name] = m; return m


def _obj(name, bm, mat, world):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); o.data.materials.append(mat)
    o.matrix_world = world; bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o


def box(name, size, mat, world, at=(0, 0, 0), bevel=0.):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts); bmesh.ops.translate(bm, vec=at, verts=bm.verts)
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES')
    return _obj(name, bm, mat, world)


def tube(name, radius, a, b, mat, world, segments=12, radius2=None):
    """Cylinder from a to b in the local frame."""
    a, b = Vector(a), Vector(b); d = b - a; bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius2 is None else radius2, depth=d.length)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return _obj(name, bm, mat, world)


def hand_frame(rig, side, lift=.028):
    """World matrix at the palm: X = side (thumb side), Y = along the fingers, Z = out of the palm."""
    hand = pose_lib.bone_world(rig, 'hand_' + side).translation; knuckle = pose_lib.bone_world(rig, 'middle_01_' + side).translation
    along = (knuckle - hand).normalized(); n = pose_lib.palm_normal(rig, side); n = (n - along * n.dot(along)).normalized()
    thumb = (pose_lib.bone_world(rig, 'index_01_' + side).translation - pose_lib.bone_world(rig, 'pinky_01_' + side).translation)
    s = (thumb - along * thumb.dot(along) - n * thumb.dot(n)).normalized()
    m = Matrix((s, along, n)).transposed().to_4x4(); m.translation = (hand + knuckle) / 2 + n * lift; return m


def frame_of(rig, bone):
    return pose_lib.bone_world(rig, bone)


def R(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def T(x, y, z):
    return Matrix.Translation((x, y, z))


# ---- items -------------------------------------------------------------------------------------------
def phone(rig, side, tilt=0, color=(.03, .03, .035), grip=None, screen=None):
    """A phone. grip None: lying on the palm along the fingers (the older postures). grip 'hold': held the way one holds
    a phone to use it with one hand: its back in the palm, its top toward the thumb side (the index finger), its far edge
    at the roots of the fingers so they curl round it, the thumb over the glass. screen: what the glass shows (phone_screen_image: the desk app's one-button Groove page)."""
    if grip == 'hold':      # (its top toward the thumb side, its far edge at the finger roots)
        w = hand_frame(rig, side, .018) @ T(.02, .05, 0) @ R('Z', -90) @ R('X', tilt)
    else: w = hand_frame(rig, side, .012) @ T(0, .035, 0) @ R('X', tilt)
    body = box('phone', (.072, .152, .008), material('phone', color, .35), w, bevel=.003)
    if not screen: return [body, box('phone screen', (.066, .142, .0012), material('phone screen', (.02, .02, .03), .1, emit=(.55, .7, .9)), w, at=(0, 0, .0046))]
    # the glass as a picture: a flat face with the page mapped on it, its top toward the phone's top (+Y)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap'); hw, hh, z = .033, .071, .0047
    f = bm.faces.new([bm.verts.new(v) for v in ((-hw, -hh, z), (hw, -hh, z), (hw, hh, z), (-hw, hh, z))])
    for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[uv].uv = t
    return [body, _obj('phone screen', bm, screen_material(screen), w)]


def phone_screen_image(state, size=(270, 580)):
    """The ErgoFlex app's Groove page as the phone shows it: one big round button. state 'ready' (an amber ring with
    the play mark), 'pressed' (the button filled and lit) or 'running' (lit, with the routine's progress ring).
    Rows run from the bottom of the glass (Blender's image order); the top of the glass is the phone's top."""
    import numpy as np
    W, H = size; y, x = np.mgrid[0:H, 0:W].astype(np.float32); px = np.zeros((H, W, 4), np.float32); px[..., 3] = 1
    y = H - 1 - y      # (from here on y counts down from the top of the glass)
    bg, amber, dark, white = np.array([.035, .05, .07]), np.array([.95, .61, .0]), np.array([.06, .08, .1]), np.array([.88, .9, .92])
    px[..., :3] = bg + (np.array([.07, .09, .12]) - bg) * (y / H)[..., None]
    def paint(mask, colour, a=1.): px[..., :3] = px[..., :3] * (1 - a * mask[..., None]) + colour * (a * mask[..., None])
    soft = lambda d, w=1.5: np.clip(.5 - d / w, 0, 1)
    def pill(x0, y0, x1, y1, colour, a=1.):
        r = (y1 - y0) / 2; cx = np.clip(x, x0 + r, x1 - r); paint(soft(np.hypot(x - cx, y - (y0 + y1) / 2) - r), colour, a)
    pill(18, 14, 110, 24, white, .5); pill(205, 15, 252, 23, white, .35)            # the status bar
    pill(28, 56, 196, 80, white, .92); pill(28, 92, 148, 104, white, .42)           # "Groove" and the room's name
    cx, cy, r = W / 2, H * .5, W * .34; d = np.hypot(x - cx, y - cy)
    if state == 'ready':
        paint(soft(np.abs(d - r) - 6), amber); paint(soft(d - (r - 12)), dark)
    else:
        paint(np.clip(1 - (d - r) / 28, 0, 1) * (d > r) * .5, amber); paint(soft(d - r), amber)      # lit, with a glow round it
        if state == 'running':
            turn = (np.arctan2(x - cx, -(y - cy)) + np.pi) / (2 * np.pi); paint(soft(np.abs(d - (r + 18)) - 3) * (turn < .32), white, .9)
    inside = (x > cx - r * .3) & (np.abs(y - cy) < (cx + r * .45 - x) * .6)              # the play mark, pointing right
    paint(inside.astype(np.float32), amber if state == 'ready' else dark)
    pill(52, H - 120, 218, H - 102, white, .78); pill(80, H - 90, 190, H - 78, white, .38)   # "Store: fold and roll"
    return px


_screens = {}
def screen_material(state):
    """The phone's glass with phone_screen_image(state) on it, lit (emission) like a screen."""
    if state in _screens: return _screens[state]
    W, H = 270, 580; img = bpy.data.images.new('phone-groove-' + state, W, H); img.pixels.foreach_set(phone_screen_image(state, (W, H)).ravel()); img.pack()
    m = bpy.data.materials.new('Held.phone screen ' + state); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 1.; b.inputs['Roughness'].default_value = .12
    m['alpha'] = 'OPAQUE'; _screens[state] = m; return m


def tablet(rig, side, color=(.12, .12, .13)):
    w = hand_frame(rig, side, .01) @ T(.03, .06, 0)
    return [box('tablet', (.178, .248, .007), material('tablet', color, .4), w, bevel=.003),
            box('tablet screen', (.166, .232, .001), material('tablet screen', (.03, .03, .04), .1, emit=(.6, .68, .75)), w, at=(0, 0, .0041))]


def book(rig, side, color=(.5, .16, .12), open_=True):
    w = hand_frame(rig, side, .014) @ T(.05 if open_ else 0, .03, 0)
    cover = material('book cover ' + str(color), color, .7); pages = material('book pages', (.93, .9, .82), .9)
    if not open_: return [box('book', (.15, .21, .028), cover, w, bevel=.002), box('book pages', (.142, .2, .022), pages, w, at=(.006, 0, 0))]
    out = []
    for s in (-1, 1):
        half = w @ T(s * .004, 0, 0) @ R('Y', -s * 14) @ T(s * .075, 0, 0)
        out += [box('book cover', (.15, .21, .004), cover, half), box('book pages', (.14, .198, .012), pages, half, at=(0, 0, .007))]
    return out


def pen(rig, side, color=(.1, .2, .5)):
    w = hand_frame(rig, side, .005) @ T(.035, .055, .012) @ R('X', -62) @ R('Y', 18)
    return [tube('pen', .0042, (0, 0, -.075), (0, 0, .065), material('pen ' + str(color), color, .4), w, 8),
            tube('pen tip', .0042, (0, 0, -.092), (0, 0, -.075), material('pen tip', (.75, .75, .78), .3, 1.), w, 8, radius2=.0008)]


def mug(rig, side, color=(.86, .84, .8)):
    w = hand_frame(rig, side, .045) @ R('X', 90)
    m = material('mug ' + str(color), color, .35)
    return [tube('mug', .04, (0, 0, -.045), (0, 0, .05), m, w, 20), tube('coffee', .035, (0, 0, .049), (0, 0, .051), material('coffee', (.16, .09, .05), .3), w, 20)]


def cup(rig, side, kind='mug', color=None):
    """A drink held the way people hold one: fingers round it, thumb on top, upright whatever the wrist does.
    kind: 'mug' (coffee), 'glass' (a tumbler), 'wine' (a stemmed glass)."""
    w = hand_frame(rig, side, 0); n = w.to_3x3() @ Vector((0, 0, 1))
    z = Vector((0, 0, 1)); x = n - z * n.dot(z)
    if x.length < 1e-3: x = Vector((1, 0, 0))
    x.normalize(); y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    if kind == 'mug':
        m.translation = w.translation + x * .05 + Vector((0, 0, .005)); mat = material('mug ' + str(color), color or (.86, .84, .8), .35)
        return [tube('mug', .04, (0, 0, -.05), (0, 0, .045), mat, m, 20), tube('coffee', .035, (0, 0, .041), (0, 0, .046), material('coffee', (.16, .09, .05), .3), m, 20),
                box('mug handle', (.012, .012, .055), mat, m, at=(-.046, 0, 0))]
    m.translation = w.translation + x * .045
    glass = material('glass', (.8, .86, .88), .05)
    if kind == 'wine':
        return [tube('wine stem', .004, (0, 0, -.11), (0, 0, .0), glass, m, 8), tube('wine foot', .032, (0, 0, -.114), (0, 0, -.11), glass, m, 16),
                tube('wine bowl', .024, (0, 0, .0), (0, 0, .085), glass, m, 16, radius2=.038), tube('wine', .029, (0, 0, .012), (0, 0, .045), material('wine ' + str(color), color or (.35, .03, .08), .15), m, 16)]
    return [tube('glass', .033, (0, 0, -.055), (0, 0, .055), glass, m, 16, radius2=.037), tube('drink', .031, (0, 0, -.05), (0, 0, .025), material('drink ' + str(color), color or (.62, .3, .08), .15), m, 16)]


def radio(rig, side, color=(.04, .04, .045)):
    """A handheld radio gripped in the fist, upright when the thumb is up: its length lies across the palm."""
    w = hand_frame(rig, side, .022) @ T(.012, .0, 0); m = material('radio', color, .5)
    return [box('handheld radio', (.105, .056, .03), m, w, bevel=.004), box('handheld radio grille', (.034, .036, .002), material('mic grille', (.2, .2, .21), .6), w, at=(.022, 0, -.016)),
            tube('handheld radio antenna', .0045, (.052, -.016, 0), (.125, -.016, 0), m, w, 8), tube('handheld radio knob', .007, (.052, .016, 0), (.068, .016, 0), m, w, 8)]


def clipboard(rig, side, color=(.34, .23, .13)):
    """A clipboard with a sheet on it, lying on the palm and along the fingers."""
    w = hand_frame(rig, side, .009) @ T(.03, .085, 0)
    return [box('clipboard', (.235, .325, .005), material('clipboard ' + str(color), color, .6), w, bevel=.002), box('clipboard sheet', (.21, .297, .002), material('paper', (.94, .94, .91), .9), w, at=(0, -.008, .0035)),
            box('clipboard clip', (.1, .028, .012), material('badge silver', (.8, .81, .83), .3, 1.), w, at=(0, .145, .008), bevel=.002)]


def carton(rig, size=(.42, .3, .28), color=(.62, .47, .3)):
    """A cardboard box carried in front in both hands, held by its sides."""
    a = hand_frame(rig, 'l', 0).translation; b = hand_frame(rig, 'r', 0).translation
    x = a - b; x.z = 0; x.normalize(); z = Vector((0, 0, 1)); y = z.cross(x)
    w = Matrix((x, y, z)).transposed().to_4x4(); w.translation = (a + b) / 2
    return [box('carton', (min(size[0], (a - b).length - .02), size[1], size[2]), material('cardboard', color, .85), w, bevel=.004),
            box('carton tape', (.06, size[1] + .002, .002), material('tape', (.72, .62, .46), .4), w, at=(0, 0, size[2] / 2))]


def gamepad(rig, color=(.08, .08, .09)):
    """Held between both hands."""
    a = hand_frame(rig, 'l', .03); b = hand_frame(rig, 'r', .03); mid = (a.translation + b.translation) / 2
    x = (a.translation - b.translation).normalized(); z = ((a.to_3x3() @ Vector((0, 1, 0))) + (b.to_3x3() @ Vector((0, 1, 0)))).normalized()
    z = (z - x * z.dot(x)).normalized(); y = z.cross(x)
    w = Matrix((x, y, z)).transposed().to_4x4(); w.translation = mid
    m = material('gamepad', color, .45)
    return [box('gamepad', (.15, .045, .075), m, w, bevel=.012), box('gamepad grip l', (.04, .05, .09), m, w, at=(.06, 0, -.045), bevel=.012),
            box('gamepad grip r', (.04, .05, .09), m, w, at=(-.06, 0, -.045), bevel=.012)]


def brush(rig, side):
    w = hand_frame(rig, side, .005) @ T(.03, .05, .012) @ R('X', -70)
    return [tube('brush handle', .004, (0, 0, -.02), (0, 0, .2), material('brush handle', (.5, .3, .15), .5), w, 8),
            tube('brush ferrule', .0045, (0, 0, -.045), (0, 0, -.02), material('brush ferrule', (.8, .8, .82), .3, 1.), w, 8),
            tube('brush hair', .005, (0, 0, -.07), (0, 0, -.045), material('brush hair', (.75, .25, .15), .8), w, 8, radius2=.0015)]


def palette(rig, side):
    w = hand_frame(rig, side, .012) @ T(.06, .06, 0)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=.15, radius2=.15, depth=.006); bmesh.ops.scale(bm, vec=(1, .72, 1), verts=bm.verts)
    out = [_obj('palette', bm, material('palette', (.72, .56, .36), .6), w)]
    for i, c in enumerate([(.8, .15, .12), (.95, .75, .15), (.15, .35, .7), (.95, .95, .92), (.2, .5, .3), (.45, .2, .5)]):
        ang = math.radians(20 + i * 32); out.append(tube('paint', .014, (math.cos(ang) * .1, math.sin(ang) * .07, .003), (math.cos(ang) * .1, math.sin(ang) * .07, .007), material('paint ' + str(i), c, .35), w, 10))
    return out


def cane(rig, side, white=False, length=None):
    """A stick from the hand to the floor; the hand grips its top."""
    # (the long cane lies across the base of the fingers, which close round it; the walking stick's handle in the palm)
    grip = (hand_frame(rig, side, .022) @ Vector((0, .035, 0)) if white else hand_frame(rig, side, .03).translation)
    foot = Vector((grip.x + (.05 if side == 'l' else -.05), grip.y - (.42 if white else .1), 0))
    world = Matrix.Identity(4)
    if white:
        out = [tube('white cane', .0065, grip + (grip - foot).normalized() * .09, foot + Vector((0, 0, .1)), material('white cane', (.93, .93, .93), .4), world, 10),
               tube('white cane tip', .0065, foot + Vector((0, 0, .1)) , foot + Vector((0, 0, .015)), material('white cane red', (.8, .08, .08), .4), world, 10),
               tube('white cane grip', .01, grip + (grip - foot).normalized() * .1, grip - (grip - foot).normalized() * .1, material('cane grip', (.06, .06, .06), .8), world, 10)]
    else:
        m = material('cane', (.25, .14, .08), .45)
        out = [tube('cane', .011, grip + Vector((0, 0, .0)), foot + Vector((0, 0, .012)), m, world, 12),
               tube('cane handle', .012, grip + Vector((0, .06, .005)), grip + Vector((0, -.07, -.005)), m, world, 12),
               tube('cane ferrule', .013, foot + Vector((0, 0, .03)), foot, material('rubber', (.05, .05, .05), .9), world, 12)]
    return out


def backpack(rig, color=(.16, .22, .3)):
    """On the back, with straps over the shoulders. Frame: X across, Y up the spine, Z out of the back."""
    w = frame_of(rig, 'spine_03'); y = (w.to_3x3() @ Vector((0, 1, 0))).normalized()
    back = Vector((0, 1, 0)); back = (back - y * back.dot(y)).normalized(); x = y.cross(back)
    m = Matrix((x, y, back)).transposed().to_4x4(); m.translation = w.translation + back * .17 - y * .02
    mat = material('backpack ' + str(color), color, .85); strap = material('strap', (.06, .06, .07), .9)
    out = [box('backpack', (.29, .4, .15), mat, m, bevel=.03), box('backpack pocket', (.2, .17, .05), mat, m, at=(0, -.09, .085), bevel=.02),
           tube('backpack handle', .008, (-.04, .21, -.03), (.04, .21, -.03), strap, m, 8)]
    for s in (-1, 1):
        path = [(s * .09, .19, -.05), (s * .1, .25, -.15), (s * .115, .2, -.27), (s * .13, .03, -.31), (s * .16, -.12, -.2), (s * .13, -.17, -.07)]
        for a, b in zip(path, path[1:]): out.append(tube('backpack strap', .014, a, b, strap, m, 8))
    return out


def headphones(rig, color=(.08, .08, .09)):
    """Over-ear headphones: cups on the ears, band over the crown."""
    w = frame_of(rig, 'head'); up = (w.to_3x3() @ Vector((0, 1, 0))).normalized()
    x = Vector((1, 0, 0)); x = (x - up * x.dot(x)).normalized() if False else (Vector((1, 0, 0)) - up * up.x).normalized(); fwd = up.cross(x)
    centre = w.translation + up * .06 - fwd * .012           # between the ears
    m = material('headphones', color, .5); pad = material('headphone pads', (.16, .16, .17), .9); world = Matrix.Identity(4); out = []
    half, rise, steps = .082, .128, 10
    for i in range(steps):
        a0, a1 = math.pi * i / steps, math.pi * (i + 1) / steps
        out.append(tube('headband', .007, centre + x * math.cos(a0) * (half + .006) + up * math.sin(a0) * rise, centre + x * math.cos(a1) * (half + .006) + up * math.sin(a1) * rise, m, world, 8))
    for s in (-1, 1):
        e = centre + x * s * half
        out += [tube('ear cup', .034, e, e + x * s * .026, m, world, 18), tube('ear pad', .037, e - x * s * .008, e + x * s * .004, pad, world, 18)]
    return out


def torus(name, major, minor, mat, world, seg=40, ring=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=ring)
    o = bpy.context.object; o.name = name; o.data.materials.append(mat); o.matrix_world = world
    for p in o.data.polygons: p.use_smooth = True
    return o


def wheelchair(rig, seat=.5, color=(.75, .1, .08)):
    """An active manual wheelchair under a seated person (character frame: faces -Y, pelvis over the origin)."""
    frame = material('chair frame ' + str(color), color, .35, .6); black = material('chair black', (.03, .03, .035), .7)
    steel = material('chair steel', (.7, .71, .73), .3, 1.); tyre = material('chair tyre', (.05, .05, .05), .9); W = Matrix.Identity(4); out = []
    half, r, axle_y = .215, .3, .07
    out.append(box('chair seat', (.42, .42, .035), black, W, at=(0, -.03, seat - .02), bevel=.01))
    out.append(box('chair cushion', (.4, .4, .045), material('chair cushion', (.1, .1, .11), .95), W, at=(0, -.03, seat + .012), bevel=.015))
    out.append(box('chair back', (.4, .025, .3), black, W @ T(0, .2, seat + .2) @ R('X', -6), bevel=.008))
    for s in (-1, 1):
        x = s * half
        out += [tube('chair rail', .012, (x, .19, seat - .03), (x, -.24, seat - .03), frame, W, 10),
                tube('chair front', .012, (x, -.24, seat - .03), (s * .17, -.4, .17), frame, W, 10),
                tube('chair back post', .012, (x, .2, seat - .03), (x, .235, seat + .37), frame, W, 10),
                tube('chair handle', .013, (x, .235, seat + .37), (x, .32, seat + .38), black, W, 10),
                tube('chair axle strut', .012, (x, .15, seat - .03), (x, axle_y, r), frame, W, 10),
                tube('chair caster fork', .01, (s * .17, -.34, .2), (s * .17, -.32, .065), steel, W, 8),
                tube('chair caster stem', .012, (s * .17, -.34, seat - .1), (s * .17, -.34, .2), frame, W, 8),
                tube('chair caster brace', .011, (x, -.2, seat - .03), (s * .17, -.34, seat - .1), frame, W, 8),
                box('chair side guard', (.006, .26, .15), black, W, at=(s * (half + .012), .02, seat + .07), bevel=.002)]
        # Rear wheel: tyre, handrim, hub and spokes, with a little camber.
        wheel = W @ T(s * (half + .055), axle_y, r) @ R('Y', -s * 3) @ R('Y', 90)
        out += [torus('chair tyre', r - .014, .014, tyre, wheel), torus('chair rim', r - .034, .008, steel, wheel), torus('chair handrim', r - .05, .007, steel, wheel @ T(0, 0, s * .03)),
                tube('chair hub', .022, (0, 0, -.03), (0, 0, .03), steel, wheel, 12)]
        for i in range(16):
            ang = math.tau * i / 16; out.append(tube('chair spoke', .0018, (0, 0, .012 if i % 2 else -.012), (math.cos(ang) * (r - .038), math.sin(ang) * (r - .038), 0), steel, wheel, 5))
        caster = W @ T(s * .17, -.32, .065) @ R('Y', 90)
        out += [torus('chair caster', .05, .015, tyre, caster, 20, 6), tube('chair caster hub', .04, (0, 0, -.012), (0, 0, .012), steel, caster, 12)]
    out += [tube('chair axle', .013, (-half - .04, axle_y, r), (half + .04, axle_y, r), frame, W, 10), tube('chair cross', .012, (-half, -.24, seat - .03), (half, -.24, seat - .03), frame, W, 10),
            tube('chair footbar', .012, (-.17, -.4, .17), (.17, -.4, .17), frame, W, 10), box('chair footplate', (.3, .13, .012), black, W, at=(0, -.43, .15), bevel=.004)]
    return out


def crutch(rig, side):
    """Forearm crutch: handle in the hand, cuff round the forearm, tip on the floor ahead and outside the foot."""
    s = 1 if side == 'l' else -1; grip = hand_frame(rig, side, .028).translation
    elbow = pose_lib.bone_world(rig, 'lowerarm_' + side).translation; up = (elbow - grip).normalized()
    tip = Vector((grip.x + s * .06, grip.y - .1, 0)); W = Matrix.Identity(4)
    alu = material('crutch', (.72, .73, .75), .3, 1.); grey = material('crutch grip', (.2, .22, .25), .8)
    top = grip + up * .2
    return [tube('crutch shaft', .011, grip, tip + Vector((0, 0, .02)), alu, W, 10), tube('crutch upper', .011, grip, top, alu, W, 10),
            tube('crutch handle', .016, grip + Vector((0, .02, 0)), grip + Vector((0, -.1, -.005)), grey, W, 10),
            torus('crutch cuff', .05, .011, grey, Matrix.Translation(top + Vector((0, .03, 0))) @ up.to_track_quat('Z', 'Y').to_matrix().to_4x4(), 20, 6),
            tube('crutch tip', .015, tip + Vector((0, 0, .03)), tip, material('rubber', (.05, .05, .05), .9), W, 10)]


def screwdriver(rig, side):
    w = hand_frame(rig, side, .03) @ R('Y', 90)
    return [tube('tool handle', .016, (0, 0, -.05), (0, 0, .05), material('tool handle', (.85, .45, .05), .5), w, 10),
            tube('tool shaft', .0035, (0, 0, .05), (0, 0, .17), material('tool steel', (.75, .75, .78), .3, 1.), w, 8)]


def prosthesis(rig, side):
    """A below-knee prosthesis: socket under the knee, pylon to the ankle (the shoe stays on the foot)."""
    knee = pose_lib.bone_world(rig, 'calf_' + side).translation; ankle = pose_lib.bone_world(rig, 'foot_' + side).translation; W = Matrix.Identity(4)
    d = (ankle - knee); mid = knee + d * .42
    carbon = material('prosthesis carbon', (.06, .06, .07), .35, .2); steel = material('prosthesis steel', (.75, .76, .78), .25, 1.)
    return [tube('socket', .062, knee - d * .06, mid, carbon, W, 16, radius2=.04), tube('socket adapter', .028, mid, mid + d * .05, steel, W, 12),
            tube('pylon', .015, mid + d * .05, ankle + d * .03, steel, W, 12), tube('ankle adapter', .03, ankle + d * .0, ankle + d * .08, steel, W, 12)]

def dumbbell(rig, side, color=(.035, .035, .04)):
    """A rubber hex dumbbell gripped in the fist: the handle lies across the palm."""
    w = hand_frame(rig, side, .03); rubber = material('dumbbell', color, .8); steel = material('dumbbell handle', (.62, .63, .65), .3, .9)
    return [tube('dumbbell handle', .013, (-.075, 0, 0), (.075, 0, 0), steel, w, 12)] + [
        tube('dumbbell head', .048, (s * .07, 0, 0), (s * .125, 0, 0), rubber, w, 6) for s in (-1, 1)]


def laptop(rig, color=(.6, .62, .65), table=.74, reach=-.36):
    """An open laptop on the table under typing hands (the 'sit-laptop' posture: wrists 0.36 m in front of the pelvis,
    0.05 above a 0.74 m table). It stands where the table is, not in a hand: palm rest toward the person, the keys
    under the fingers, the lid leaning back 18 degrees with a lit screen."""
    w = rig.matrix_world @ T(0, reach - .085, table); lid = w @ T(0, -.11, .012) @ R('X', 18)
    shell = material('laptop', color, .38, .85); keys = material('laptop keys', (.055, .055, .06), .6)
    screen = material('laptop screen', (.36, .45, .58), .25, 0., emit=(.34, .43, .56))
    return [box('laptop base', (.32, .22, .014), shell, w, at=(0, 0, .007), bevel=.004),
            box('laptop keys', (.27, .1, .002), keys, w, at=(0, -.035, .0146)),
            box('laptop pad', (.09, .055, .002), keys, w, at=(0, .065, .0143)),
            box('laptop lid', (.32, .008, .21), shell, lid, at=(0, 0, .105), bevel=.003),
            box('laptop screen', (.296, .002, .186), screen, lid, at=(0, .0048, .105))]



_robot = None
def robot(rig, at, turn=0., side='r'):
    """The workshop's Robo-Pal (tools/people/robo-pal.json: the toy story's own seated figure, the one on the desk's top
    shelf), its root (the point it sits on) at `at` (metres, the character's frame), facing the character and turned
    `turn` degrees about the vertical. It follows the hand (side) it is held in. Where it is set down on the shelf it is
    exactly where the film's shelf robot is, so the one can take over from the other."""
    global _robot
    import json, os, bmesh
    if _robot is None: _robot = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'robo-pal.json'), encoding='utf-8'))
    # the figure's frame (x across, y up, z the way it faces; mm) -> the character's (it faces +Y, toward the character)
    w = T(*at) @ R('Z', turn) @ Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1))) @ Matrix.Scale(.001, 4)
    lin = lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    rgb = lambda h: tuple(lin(int(h.lstrip('#')[i:i + 2], 16) / 255) for i in (0, 2, 4))
    out = []
    for n, part in enumerate(_robot['materials']):
        emit = tuple(c * min(1., part.get('emissiveIntensity', 1) / 2.5) for c in rgb(part['emissive'])) if part.get('emissive') else None
        mat = material('robo-pal %d' % n, rgb(part['color']), part['roughness'], part['metalness'], emit=emit)
        p = part['positions']; verts = [tuple(p[i:i + 3]) for i in range(0, len(p), 3)]
        me = bpy.data.meshes.new('Robo-Pal %d' % n); me.from_pydata(verts, [], [(i, i + 1, i + 2) for i in range(0, len(verts), 3)])
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.02); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('Robo-Pal %d' % n, me); o.data.materials.append(mat); o.matrix_world = w; bpy.context.scene.collection.objects.link(o)
        out.append(o)
    return out


BUILDERS = {'phone': phone, 'tablet': tablet, 'book': book, 'pen': pen, 'mug': mug, 'gamepad': gamepad, 'brush': brush, 'palette': palette,
            'cane': cane, 'backpack': backpack, 'headphones': headphones, 'cup': cup, 'carton': carton, 'radio': radio, 'clipboard': clipboard,
            'wheelchair': wheelchair, 'crutch': crutch, 'screwdriver': screwdriver, 'prosthesis': prosthesis, 'dumbbell': dumbbell, 'laptop': laptop,
            'robot': robot}


def build(rig, items):
    """items: [('phone', {'side': 'r'}), ('backpack', {}), ...] -> list of objects."""
    out = []
    for kind, kw in items: out += BUILDERS[kind](rig, **kw)
    return out
