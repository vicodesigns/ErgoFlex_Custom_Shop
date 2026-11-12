"""Garments MakeHuman has no asset for (a white coat, a hospital gown, socks, gloves), made from the base mesh itself.

The MakeHuman base mesh carries helper geometry that clothes are fitted to: `helper-tights` (a second skin from the
neck to the wrists and toes) and `helper-skirt` (a tube from the waist to the ankles). Both are weighted to the
skeleton like the body, so a garment cut out of them follows every pose the way the installed clothes do.

    build(who, base, rig, out_dir, out_id) -> [mesh objects]      (before posing; cast.CHARACTERS[...]['wear'])

  ('coat', {...})    torso and sleeves from the tights, the skirt below the hips, an open V at the neck: a white coat
  ('gown', {...})    the same cut, knee length, short sleeves, a round neck, a small print: a hospital gown
  ('scrubs', {...})  the same cut ending at the hips, short sleeves, a V neck: a scrubs top (the trousers are an
                     installed pair in the same colour)
  ('socks', {...})   the tights' feet and ankles
  ('gloves', {...})  not a mesh: the body's hand faces take a second material (thin gloves are skin tight)

Every garment gets a texture of its own (the fabric's colour with a little shading, plus painted seams, buttons and
pockets), mapped front and back from the rest pose, so the Studio's recolouring reads it like any other garment.
Material names: 'Human.<name>' is recoloured by room-people.mjs (`partOf`: a name with 'shoe' in it is the shoes,
anything else the top); a name outside 'Human.' keeps its colour (the white coat, the gloves).
"""
import math, os
import bpy, bmesh
import numpy as np
from mathutils import Vector
import held

HAND = ('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')
SPAN, TALL, N = 1.3, 2.0, 1024          # metres the texture covers across (each of front and back) and up; pixels


def _weights(obj):
    """Per vertex: {bone kind: weight} ('upperarm', 'lowerarm', 'hand' (with the fingers), 'thigh', 'calf', 'foot', 'spine_01', ...)."""
    names = {g.index: g.name for g in obj.vertex_groups}; out = []
    for v in obj.data.vertices:
        w = {}
        for g in v.groups:
            n = names.get(g.group, ''); kind = n[:-2] if n.endswith(('_l', '_r')) else n
            if kind.split('_0')[0] in HAND: kind = 'hand'
            if kind == 'ball': kind = 'foot'
            w[kind] = w.get(kind, 0) + g.weight
        out.append(w)
    return out


def _members(obj, group):
    g = obj.vertex_groups.get(group); return {v.index for v in obj.data.vertices if any(x.group == g.index for x in v.groups)} if g else set()


def _joint(rig, bone):
    return rig.matrix_world @ rig.data.bones[bone].head_local


def _shape(base):
    """Where the base mesh's vertices are in the character's shape (world, rest pose): its shape keys mixed."""
    keys = base.data.shape_keys; world = base.matrix_world
    if not keys: return [world @ v.co for v in base.data.vertices]
    n = len(base.data.vertices); read = lambda block: (lambda a: (block.data.foreach_get('co', a), a.reshape(n, 3))[1])(np.empty(n * 3, dtype=np.float32))
    mix = read(keys.reference_key).copy()
    for block in keys.key_blocks:
        if block != keys.reference_key and block.value: mix += block.value * (read(block) - read(block.relative_key))
    return [world @ Vector(c) for c in mix.tolist()]


class Cloth:
    """A garment's texture: the fabric's colour with soft shading, painted in rest-pose metres (x across, z up)."""
    def __init__(self, color, seed=1, grain=.035):
        rng = np.random.default_rng(seed)
        low = rng.random((9, 9)).astype(np.float32); ys = np.linspace(0, 8, N); i = np.clip(ys.astype(int), 0, 7); f = (ys - i).astype(np.float32)
        rows = low[i] * (1 - f[:, None]) + low[i + 1] * f[:, None]; soft = rows[:, i] * (1 - f[None, :]) + rows[:, i + 1] * f[None, :]
        shade = 1 + (soft - .5) * .1 + (rng.random((N, N)).astype(np.float32) - .5) * grain
        self.px = np.empty((N, N, 4), dtype=np.float32); self.px[..., :3] = np.clip(shade[..., None] * np.array(color, dtype=np.float32), 0, 1); self.px[..., 3] = 1

    @staticmethod
    def uv(x, z, back=False):
        return ((.75 if back else .25) + x / SPAN * .5, z / TALL)

    def _box(self, x0, x1, z0, z1, back):
        (u0, v0), (u1, v1) = self.uv(min(x0, x1), min(z0, z1), back), self.uv(max(x0, x1), max(z0, z1), back)
        return slice(max(0, int(v0 * N)), max(int(v0 * N) + 1, int(v1 * N))), slice(max(0, int(u0 * N)), max(int(u0 * N) + 1, int(u1 * N)))

    def rect(self, x0, x1, z0, z1, color, back=False, mix=1.):
        rows, cols = self._box(x0, x1, z0, z1, back); self.px[rows, cols, :3] = self.px[rows, cols, :3] * (1 - mix) + np.array(color, dtype=np.float32) * mix

    def frame(self, x0, x1, z0, z1, color, t=.005, back=False):
        for a in ((x0, x1, z0, z0 + t), (x0, x1, z1 - t, z1), (x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1)): self.rect(*a, color, back)

    def dot(self, x, z, r, color, back=False):
        u, v = self.uv(x, z, back); cy, cx = v * N, u * N; ry, rx = r / TALL * N, r / SPAN * .5 * N
        y0, y1, x0, x1 = int(cy - ry) - 1, int(cy + ry) + 2, int(cx - rx) - 1, int(cx + rx) + 2
        yy, xx = np.mgrid[y0:y1, x0:x1]; inside = ((yy + .5 - cy) / max(ry, .6)) ** 2 + ((xx + .5 - cx) / max(rx, .6)) ** 2 <= 1
        self.px[y0:y1, x0:x1, :3][inside] = np.array(color, dtype=np.float32)

    def line(self, x0, z0, x1, z1, width, color, back=False):
        n = max(2, int(((x1 - x0) ** 2 + (z1 - z0) ** 2) ** .5 / (width * .4)))
        for i in range(n + 1): t = i / n; self.dot(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, width / 2, color, back)

    def scatter(self, color, step=.045, r=.006):
        """A small all-over print (hospital gown): dots on a staggered grid, front and back."""
        for back in (False, True):
            for j, z in enumerate(np.arange(.3, 1.7, step)):
                for x in np.arange(-SPAN / 2 + .02, SPAN / 2 - .02, step): self.dot(x + (step / 2 if j % 2 else 0), z, r, color, back)

    def save(self, name, out_dir, out_id):
        img = bpy.data.images.new(name, N, N, alpha=True); img.pixels.foreach_set(self.px.ravel())
        path = os.path.join(out_dir, 'tex', f'{out_id}--{name}.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
        img.filepath_raw = path; img.file_format = 'PNG'; img.save(); return img


def _material(name, image, rough=.85):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; m.node_tree.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0; m['alpha'] = 'OPAQUE'; return m


def _shell(base, rig, name, keep, bridge=None):
    """A copy of the base mesh with only `keep` (vertex indices) left, still weighted and following the skeleton.
    bridge: z (m): the two open edges near that height (tights above, skirt below) are joined."""
    o = base.copy(); o.data = base.data.copy(); o.name = 'Human.' + name
    for c in base.users_collection: c.objects.link(o)
    for m in list(o.modifiers):
        if m.type != 'ARMATURE': o.modifiers.remove(m)
    # MPFB keeps the phenotype as shape keys on the base mesh. The copy becomes a plain mesh in the character's shape:
    # edited with its keys still on, what the armature deforms is the keys' mix, not the edit.
    keys = o.data.shape_keys
    if keys:
        n = len(o.data.vertices); read = lambda block: (lambda a: (block.data.foreach_get('co', a), a.reshape(n, 3))[1])(np.empty(n * 3, dtype=np.float32))
        mix = read(keys.reference_key).copy()
        for block in keys.key_blocks:
            if block != keys.reference_key and block.value: mix += block.value * (read(block) - read(block.relative_key))
        o.shape_key_clear(); o.data.vertices.foreach_set('co', mix.ravel()); o.data.update()
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context='VERTS')
    # stray pieces (a face or two left by the cut) go: only what hangs together with the largest part stays
    if bridge is not None:
        world = o.matrix_world; near = [e for e in bm.edges if e.is_boundary and all(abs((world @ v.co).z - bridge) < .09 and abs((world @ v.co).x) < .3 for v in e.verts)]
        try: bmesh.ops.bridge_loops(bm, edges=near)
        except Exception as e: print('garments: bridge failed', e)
        # what the bridge left open along the seam (the tights dip in between the buttocks)
        left = [e for e in bm.edges if e.is_boundary and all(abs((world @ v.co).z - bridge) < .06 and abs((world @ v.co).x) < .3 for v in e.verts)]
        if left: bmesh.ops.holes_fill(bm, edges=left, sides=12)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return o, bm


def _finish(o, bm, material, push, smooth=2):
    """Push the shell out from the body (push(vertex world position) -> metres), soften it, map it front and back."""
    world = o.matrix_world; inv = world.inverted(); bm.normal_update()
    # outward: away from the body's middle line (the helpers' faces are not all wound the same way after a cut)
    for v in bm.verts:
        p = world @ v.co; n = (world.to_3x3() @ v.normal).normalized(); d = push(p)
        if d: v.co = inv @ (p + n * d)
    inner = [v for v in bm.verts if not v.is_boundary]          # (the cut edges stay where they were cut: hem, cuffs, neckline)
    for _ in range(smooth): bmesh.ops.smooth_vert(bm, verts=inner, factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update(); uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        back = (world.to_3x3() @ f.normal).y > 0
        for loop in f.loops: p = world @ loop.vert.co; loop[uv].uv = Cloth.uv(p.x, p.z, back)
        f.smooth = True; f.material_index = 0
    bm.to_mesh(o.data); bm.free()
    o.data.materials.clear(); o.data.materials.append(material); return o


def _outward(bm, world):
    """Face normals point away from the body: flip the shell if most of it looks inward."""
    bm.normal_update(); inward = 0
    for f in bm.faces:
        c = world @ f.calc_center_median(); n = world.to_3x3() @ f.normal
        if abs(c.x) < .17 and n.dot(Vector((c.x, c.y, 0))) < 0: inward += 1     # (the trunk: its middle line is the origin's vertical)
        elif abs(c.x) >= .17: inward += 0
    if inward > len(bm.faces) * .3: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])


def _robe(who, base, rig, out_dir, out_id, name, color, hem=.02, sleeve='long', neck='v', push=.022, paint=None, material=None, seed=3, flare=.035, length=None, open_v=.42, smooth=3):
    """Torso and sleeves from the tights, the skirt below the hips. hem: metres above (+) or below (-) the knee;
    length: instead, metres below the hip joint. open_v: how far down the chest the V opens (0 = the neck, 1 = the ribs' end)."""
    W = _weights(base); world = base.matrix_world; at = _shape(base)
    tights, skirt = _members(base, 'helper-tights'), _members(base, 'helper-skirt')
    hip, knee, wrist, elbow, neck_z, chest = (_joint(rig, b) for b in ('thigh_l', 'calf_l', 'hand_l', 'lowerarm_l', 'neck_01', 'spine_03'))
    join = hip.z + .035; hem_z = knee.z + hem if length is None else hip.z - length
    def arm_ok(i):
        w = W[i]; lower, hand = w.get('lowerarm', 0), w.get('hand', 0)
        if sleeve == 'long': return hand < .35
        if w.get('upperarm', 0) + lower + hand < .5: return True          # the trunk
        # short: to just above the elbow
        s = 1 if at[i].x > 0 else -1; along = (Vector((at[i].x * s, at[i].y, at[i].z)) - _joint(rig, 'upperarm_l')).dot((elbow - _joint(rig, 'upperarm_l')).normalized())
        return lower + hand < .5 and along < (elbow - _joint(rig, 'upperarm_l')).length * .8
    keep = {i for i in tights if at[i].z >= join and arm_ok(i) and W[i].get('head', 0) < .3}
    keep |= {i for i in skirt if hem_z <= at[i].z < join - .012}
    o, bm = _shell(base, rig, name, keep, bridge=join)
    _outward(bm, world)
    # the neck: an open V down the chest (coat), or as the tights have it (gown)
    if neck == 'v':
        top = neck_z.z + .03; low = chest.z + (neck_z.z - chest.z) * open_v; half = .075
        front = lambda f: (world.to_3x3() @ f.normal).y < .2 and (world @ f.calc_center_median()).z > low - .05 and abs((world @ f.calc_center_median()).x) < half + .06
        bm.normal_update(); inv3 = world.to_3x3().transposed()
        for s in (-1, 1):
            # the edge of the V on that side: the faces it crosses are cut along it, so the neckline is a clean line
            faces = [f for f in bm.faces if front(f)]; geom = faces + list({e for f in faces for e in f.edges}) + list({v_ for f in faces for v_ in f.verts})
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=world.inverted() @ Vector((0, 0, low)), plane_no=(inv3 @ Vector((s * (top - low), 0, -half))).normalized(), clear_inner=False, clear_outer=False)
        bm.normal_update()
        def in_v(f):
            c = world @ f.calc_center_median(); return front(f) and low < c.z and abs(c.x) < half * (c.z - low) / (top - low)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if in_v(f)], context='FACES')
    # the skirt hangs straight from the hips instead of flaring like the helper
    hips = max(abs(at[i].x) for i in tights if abs(at[i].z - hip.z) < .06 and W[i].get('hand', 0) + W[i].get('lowerarm', 0) < .1)
    wide = max((abs(at[i].x) for i in skirt if abs(at[i].z - hem_z) < .05), default=hips)
    inv = world.inverted()
    for v in bm.verts:
        p = world @ v.co
        if p.z < hip.z and abs(p.x) < .32:
            t = min(1, (hip.z - p.z) / max(hip.z - hem_z, .05)); p.x *= 1 + ((hips + flare) / wide - 1) * t; v.co = inv @ p
    # it hangs from the chest and the shoulder blades: nowhere below them is it closer to the middle than it is there
    arms = {1: (_joint(rig, 'upperarm_l'), elbow), -1: (_joint(rig, 'upperarm_r'), _joint(rig, 'lowerarm_r'))}
    def sleeve_of(p):
        a, b = arms[1 if p.x > 0 else -1]; t = (p - a).dot(b - a) / (b - a).length_squared; return t > .12 and abs(p.x) > abs(a.x) * .92
    bust = chest.z + (neck_z.z - chest.z) * .45; trunk = [(v_, world @ v_.co) for v_ in bm.verts]; trunk = [(v_, p) for v_, p in trunk if not sleeve_of(p)]
    ring = [p for _v, p in trunk if abs(p.z - bust) < .035]
    if ring:
        cy = sum(p.y for p in ring) / len(ring); BINS = 24; ref = [0.] * BINS
        which = lambda p: int((math.atan2(p.y - cy, p.x) + math.pi) / math.tau * BINS) % BINS
        for p in ring: ref[which(p)] = max(ref[which(p)], math.hypot(p.x, p.y - cy))
        ref = [r or max(ref) for r in ref]; ref = [(ref[i - 1] + 2 * ref[i] + ref[(i + 1) % BINS]) / 4 for i in range(BINS)]
        for v_, p in trunk:
            if p.z >= bust: continue
            r = math.hypot(p.x, p.y - cy); want = ref[which(p)] * (1 - .05 * min(1, (bust - p.z) / .3))
            if 1e-4 < r < want: p.x *= want / r; p.y = cy + (p.y - cy) * want / r; v_.co = inv @ p
    cloth = Cloth(color, seed)
    if paint: paint(cloth, {'hip': hip.z, 'knee': knee.z, 'hem': hem_z, 'chest': chest.z, 'neck': neck_z.z, 'shoulder': _joint(rig, 'upperarm_l').x, 'v': chest.z + (neck_z.z - chest.z) * open_v, 'top': neck_z.z + .03})
    mat = _material(material or 'Human.' + name, cloth.save(name, out_dir, out_id))
    # sleeves a little closer than the body of the garment; at the neck it lies on the collar bones
    def out(p):
        if abs(p.x) > hips + .05 and p.z > hip.z: return push * (.75 if sleeve == 'short' else 1.)
        return push * max(.3, min(1, (neck_z.z + .01 - p.z) / .06))
    return _finish(o, bm, mat, out, smooth)


def _coat_paint(c, at):
    """A buttoned white coat: placket, buttons, a chest pocket, two hip pockets, a seam down the back."""
    line = (.62, .64, .68); top, low = at['v'], at['hem'] + .02
    for s in (-1, 1): c.line(s * .012, at['v'] - .01, s * .1, at['top'] - .02, .006, line)                 # lapels
    c.rect(-.004, .004, low, top, line, mix=.8); c.rect(-.003, .003, at['hem'], at['neck'], line, back=True, mix=.5)
    for i in range(4): c.dot(.018, top - .05 - i * (top - at['hip'] + .02) / 3.6, .008, (.5, .52, .56))
    c.frame(.045, .135, at['chest'] + .1, at['chest'] + .21, line)                                  # chest pocket, the wearer's left
    for s in (-1, 1): c.frame(s * .05, s * .17, at['hip'] - .16, at['hip'] - .02, line)             # hip pockets
    c.rect(-SPAN / 2, SPAN / 2, at['hem'], at['hem'] + .012, line, mix=.5); c.rect(-SPAN / 2, SPAN / 2, at['hem'], at['hem'] + .012, line, back=True, mix=.5)


def coat(who, base, rig, out_dir, out_id, color=(.93, .93, .91), hem=-.03, name='coat', recolour=False, push=.026):
    # (not 'Human.': the white coat stays white when a placement recolours the top under it)
    return [_robe(who, base, rig, out_dir, out_id, name, color, hem=hem, sleeve='long', neck='v', push=push, paint=_coat_paint, open_v=.58, smooth=5, material=('Human.' if recolour else 'Worn.') + name)]


def scrubs(who, base, rig, out_dir, out_id, color=(.1, .45, .47), name='scrubs', length=.1):
    def paint(c, at):
        trim = tuple(v * .72 for v in color); half = .075
        for s in (-1, 1): c.line(0, at['v'], s * (half + .004), at['top'], .016, trim)                 # the neck band
        c.frame(.04, .13, at['chest'] + .1, at['chest'] + .2, trim, t=.004)                            # chest pocket, the wearer's left
        for back in (False, True): c.rect(-SPAN / 2, SPAN / 2, at['hem'], at['hem'] + .012, trim, back=back)
    return [_robe(who, base, rig, out_dir, out_id, name, color, sleeve='short', neck='v', push=.017, paint=paint, seed=11, flare=.03, length=length, open_v=.64)]


def gown(who, base, rig, out_dir, out_id, color=(.62, .76, .8), print_color=(.36, .52, .62), hem=-.06, name='gown'):
    def paint(c, at):
        c.scatter(print_color)
        band = tuple(v * .8 for v in color); c.rect(-SPAN / 2, SPAN / 2, at['hem'], at['hem'] + .015, band); c.rect(-SPAN / 2, SPAN / 2, at['hem'], at['hem'] + .015, band, back=True)
        c.rect(-.004, .004, at['hem'], at['neck'], band, back=True)          # it ties at the back
        for z in (at['chest'] + .2, at['hip'] + .1): c.rect(-.05, .05, z - .004, z + .004, band, back=True)
    return [_robe(who, base, rig, out_dir, out_id, name, color, hem=hem, sleeve='short', neck='round', push=.014, paint=paint, seed=5, flare=.05)]


def socks(who, base, rig, out_dir, out_id, color=(.82, .82, .8), name='socks_shoes', height=.11):
    """The tights' feet and ankles (the name has 'shoe' in it: the Studio recolours them as the shoes)."""
    world = base.matrix_world; at = _shape(base); ankle = _joint(rig, 'foot_l').z
    keep = {i for i in _members(base, 'helper-tights') if at[i].z < ankle + height}
    o, bm = _shell(base, rig, name, keep)
    bm.normal_update(); flip = sum(1 for f in bm.faces if (world.to_3x3() @ f.normal).z < -.5 and (world @ f.calc_center_median()).z > ankle * .6)
    if flip > len(bm.faces) * .15: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    cloth = Cloth(color, 7, grain=.05)
    return [_finish(o, bm, _material('Human.' + name, cloth.save(name, out_dir, out_id), .9), lambda p: .004, smooth=0)]


def gloves(who, base, rig, out_dir, out_id, color=(.25, .42, .72), cuff=.07):
    """Thin gloves: the hands' own faces (and a cuff's length of wrist) in another material."""
    W = _weights(base); shape = _shape(base); wrists = {1: _joint(rig, 'hand_l'), -1: _joint(rig, 'hand_r')}
    def gloved(i):
        if W[i].get('hand', 0) >= .5: return True
        p = shape[i]; return W[i].get('lowerarm', 0) > .3 and (p - wrists[1 if p.x > 0 else -1]).length < cuff
    picked = [gloved(v.index) for v in base.data.vertices]
    base.data.materials.append(held.material('gloves ' + str(color), color, .42)); slot = len(base.data.materials) - 1
    for p in base.data.polygons:
        if all(picked[i] for i in p.vertices): p.material_index = slot
    return []


def headscarf(who, base, rig, out_dir, out_id, color=(.8, .76, .68), name='headscarf', push=.011):
    """A wrapped headscarf: over the hair line, the ears and the neck, open round the face, falling onto the chest
    and between the shoulder blades. Not cut from the helpers (there is none round the head): a surface laid over
    the head and neck by rays from outside, hanging straight where the body goes in under the jaw and at the nape,
    weighted like the skin nearest to it. The material is 'Human.headscarf_hair': the Studio recolours it as the hair."""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    at = _shape(base); W = _weights(base); helper = _members(base, 'HelperGeometry') | _members(base, 'JointCubes')
    polys = [tuple(p.vertices) for p in base.data.polygons if not any(i in helper for i in p.vertices)]
    skin = sorted({i for p in polys for i in p}); points = [tuple(v) for v in at]; faces = list(polys)
    for c in bpy.data.objects:          # it lies over what is worn: a thick collar would come through a scarf laid on the skin
        if c.type != 'MESH' or c.name.split('.', 1)[-1] not in who['clothes'] or 'glasses' in c.name: continue
        first = len(points); points += [tuple(c.matrix_world @ v.co) for v in c.data.vertices]; faces += [tuple(first + i for i in f.vertices) for f in c.data.polygons]
    bare = BVHTree.FromPolygons([tuple(v) for v in at], polys); tree = BVHTree.FromPolygons(points, faces)
    head = [at[i] for i in skin if W[i].get('head', 0) > .8]; top = max(p.z for p in head); front = min(p.y for p in head)
    chin = min(p.z for p in head if abs(p.x) < .02 and p.y < front + .045); tall = top - chin; k = tall / .235
    cy = (front + max(p.y for p in head)) / 2; C = Vector((0, cy, chin + .58 * tall)); neck = _joint(rig, 'neck_01').z

    def reach(origin, to):
        d = to - origin; hit = tree.ray_cast(origin, d.normalized(), d.length)[0]; return (hit - to).length if hit is not None else 0.

    n, up, down = 48, 8, 26; rows = []; aim = lambda j: (math.sin(math.tau * j / n), math.cos(math.tau * j / n))       # column 0 is the back of the head
    full = lambda j: .008 * k * max(0, aim(j)[1])                       # the hair under it: a little fuller at the back
    for i in range(up + 1):                                              # over the skull, from near the crown down to ear height
        e = math.radians(80) * (1 - i / up); row = []
        for j in range(n):
            d = Vector((math.cos(e) * aim(j)[0], math.cos(e) * aim(j)[1], math.sin(e))); row.append(C + d * (reach(C + d * .6, C) + push + full(j)))
        rows.append(row)
    crown = C + Vector((0, 0, reach(C + Vector((0, 0, .6)), C) + push))
    last = [math.hypot(p.x, p.y - cy) for p in rows[-1]]
    for i in range(1, down + 1):                                         # down the neck: each column to its own hem
        row = []
        for j in range(n):
            x, y = aim(j); hem = neck - k * (.04 + (.1 if y < 0 else .06) * abs(y) ** 1.5); z = C.z + (hem - C.z) * i / down; step = (C.z - hem) / down
            axis = Vector((0, cy, z)); body = reach(axis + Vector((x, y, 0)) * .6, axis) + push + (full(j) if z > chin else 0) + .018 * min(1, max(0, (neck + .02 - z) / .06))
            # under the jaw it goes in to the neck; anywhere else it hangs nearly straight from what is above
            r = min(.21 * k, max(body, last[j] - step * (1.15 if y < -.25 and chin - .05 * k < z < chin + .005 else .1))); last[j] = r
            row.append(Vector((x * r, cy + y * r, z)))
        rows.append(row)
    bm = bmesh.new(); grid = [[bm.verts.new(p) for p in row] for row in rows]; tip = bm.verts.new(crown)
    for j in range(n): bm.faces.new((tip, grid[0][(j + 1) % n], grid[0][j]))
    for i in range(len(grid) - 1):
        for j in range(n): bm.faces.new((grid[i][j], grid[i][(j + 1) % n], grid[i + 1][(j + 1) % n], grid[i + 1][j]))
    uv = bm.loops.layers.uv.verify(); where = {v: (j / n, 1 - i / (len(grid) - 1)) for i, row in enumerate(grid) for j, v in enumerate(row)}; where[tip] = (.5, 1)
    for f in bm.faces:
        wrap = max(where[l.vert][0] for l in f.loops) - min(where[l.vert][0] for l in f.loops) > .5
        for l in f.loops: u, v = where[l.vert]; l[uv].uv = (u + (1 if wrap and u < .5 else 0), v)
        f.smooth = True
    # the face: an oval seen from the front, from the middle of the forehead to under the chin, in front of the ears
    half, zt, zb, sides = .057 * k, chin + .75 * tall, chin - .006, 28; zc, hz = (zt + zb) / 2, (zt - zb) / 2
    oval = [Vector((half * math.copysign(abs(math.cos(t)) ** .8, math.cos(t)), 0, zc + hz * math.copysign(abs(math.sin(t)) ** .8, math.sin(t)))) for t in (math.tau * s / sides for s in range(sides))]
    planes = [(a, Vector((b.z - a.z, 0, a.x - b.x)).normalized()) for a, b in zip(oval, oval[1:] + oval[:1])]            # normals point out of the oval
    inside = lambda p, slack=0.: p.y < cy and all((p - a).dot(no) < slack for a, no in planes)
    for a, no in planes:
        faces = [f for f in bm.faces if inside(f.calc_center_median(), .03)]
        bmesh.ops.bisect_plane(bm, geom=faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}), dist=1e-5, plane_co=a, plane_no=no)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if inside(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    rim = [v for v in bm.verts if v.is_boundary and v.co.z > zb - .01 and v.co.y < cy and abs(v.co.x) < half + .01]
    for v in rim:                                                        # the edge round the face lies on the skin
        q = bare.find_nearest(v.co)[0]
        if q is not None and (v.co - q).length > 1e-5: v.co = q + (v.co - q).normalized() * .003
    for _ in range(3): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update(); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Human.' + name, me); o.parent = base.parent; o.matrix_world = base.matrix_world.copy()
    for c in base.users_collection: c.objects.link(o)
    inv = base.matrix_world.inverted()
    for v in me.vertices: v.co = inv @ v.co
    # it follows the skin nearest to it (the four nearest, by distance)
    kd = KDTree(len(skin)); [kd.insert(at[i], i) for i in skin]; kd.balance(); names = {g.index: g.name for g in base.vertex_groups}; groups = {}
    for v in me.vertices:
        near = kd.find_n(base.matrix_world @ v.co, 4); total = {}
        for _co, i, dist in near:
            for g in base.data.vertices[i].groups:
                if names[g.group] in rig.data.bones: total[names[g.group]] = total.get(names[g.group], 0) + g.weight / (dist + .004)
        norm = sum(total.values()) or 1
        for bone, w in total.items(): (groups.get(bone) or groups.setdefault(bone, o.vertex_groups.new(name=bone))).add([v.index], w / norm, 'REPLACE')
    o.modifiers.new('Armature', 'ARMATURE').object = rig
    cloth = Cloth(color, 13, grain=.03)
    o.data.materials.append(_material('Human.' + name + '_hair', cloth.save(name, out_dir, out_id), .88)); return [o]


OVER = {'headscarf'}        # laid over the clothes, not fitted round the body: the clothes under them stay whole
BUILDERS = {'coat': coat, 'gown': gown, 'scrubs': scrubs, 'socks': socks, 'gloves': gloves, 'headscarf': headscarf}


def build(who, base, rig, out_dir, out_id):
    out = []
    for kind, kw in who.get('wear', []): out += BUILDERS[kind](who, base, rig, out_dir, out_id, **kw)
    return out


def names(who):
    """The generated garments' layer names, outermost first (build_people.py culls what lies under them)."""
    return [kw.get('name', {'socks': 'socks_shoes'}.get(kind, kind)) for kind, kw in who.get('wear', []) if kind != 'gloves']
