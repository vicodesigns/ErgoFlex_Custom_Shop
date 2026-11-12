"""What a role wears on the body: duty belt, badge, shoulder patches, radio, lanyard, ID card, stethoscope, lettering.

held.py puts things in a hand; these sit on the clothes, so they are found on the posed body itself. Each item is
described where it would be on the character standing in the rest pose (metres, Z up, facing -Y, left side +X,
relative to the joints so it fits every build), carried into the pose by the bone it hangs on, and then dropped onto
the posed surface with a ray: a badge lies on the chest whatever the spine does, a belt follows the waist seated or
standing.

    build(rig, meshes, who, spec) -> [(object, bone)]        (after posing; cast.CHARACTERS[...]['gear'])

Materials are held.material() ones ('Held.<name>'): the Studio's recolouring leaves them alone.
"""
import math
import bpy, bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import held

ARM = ('upperarm', 'lowerarm', 'hand', 'index', 'middle', 'ring', 'pinky', 'thumb'); LEG = ('thigh', 'calf', 'foot', 'ball')
SKIP = ('low-poly', 'teeth', 'tongue', 'eyebrow', 'eyelash', 'glasses')
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FRONT, BACK = Vector((0, -1, 0)), Vector((0, 1, 0))


class Body:
    """The posed person's surface, by region ('trunk', 'arm_l', 'arm_r'), and the way from the rest pose to the pose."""
    def __init__(self, rig, meshes, who):
        self.rig = rig; dg = bpy.context.evaluated_depsgraph_get(); parts = {'trunk': ([], []), 'arm_l': ([], []), 'arm_r': ([], [])}
        for o in meshes:
            if any(k in o.name.lower() for k in SKIP) or (who.get('hair') and who['hair'] in o.name): continue
            ev = o.evaluated_get(dg); me = ev.to_mesh(); names = {g.index: g.name for g in o.vertex_groups}; world = o.matrix_world
            kinds = []
            for v in me.vertices:
                w = {'trunk': 0., 'arm_l': 0., 'arm_r': 0., 'leg': 0., 'head': 0.}
                for g in v.groups:
                    n = names.get(g.group, ''); base = n[:-2] if n.endswith(('_l', '_r')) else n; base = base.split('_0')[0]
                    if base in ARM: w['arm_' + n[-1]] += g.weight
                    elif base in LEG: w['leg'] += g.weight
                    elif base == 'head': w['head'] += g.weight
                    elif base in ('pelvis', 'spine', 'clavicle', 'neck'): w['trunk'] += g.weight
                kinds.append(max(w, key=w.get))
            for p in me.polygons:
                votes = [kinds[i] for i in p.vertices]; kind = max(set(votes), key=votes.count)
                if kind not in parts: continue
                verts, polys = parts[kind]; start = len(verts); verts += [world @ me.vertices[i].co for i in p.vertices]; polys.append(tuple(range(start, start + len(p.vertices))))
            ev.to_mesh_clear()
        self.trees = {k: BVHTree.FromPolygons(v, p) if p else None for k, (v, p) in parts.items()}
        self.k = (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47       # 1 for a 1.70 m person

    def joint(self, bone):
        return self.rig.matrix_world @ self.rig.data.bones[bone].head_local

    def carry(self, bone):
        """Rest-pose world -> posed world, for what hangs on that bone."""
        w = self.rig.matrix_world; return w @ self.rig.pose.bones[bone].matrix @ self.rig.data.bones[bone].matrix_local.inverted() @ w.inverted()

    def drop(self, bone, at, toward, region='trunk', reach=.6, start=.3):
        """A ray in rest-pose terms: from `start` metres before `at` along `toward`. -> (point, normal out of the surface, toward in the pose) or None."""
        m = self.carry(bone); d = (m.to_3x3() @ Vector(toward)).normalized(); o = m @ Vector(at) - d * start
        tree = self.trees.get(region); hit = tree.ray_cast(o, d, reach) if tree else (None,) * 4
        if hit[0] is None: return None
        n = hit[1].normalized(); return hit[0], (n if n.dot(d) < 0 else -n), d

    def frame(self, bone, at, toward, up=Z, region='trunk', lift=.0, **kw):
        """A world matrix lying on the surface: Z out of it, Y as near `up` (rest pose) as the surface allows."""
        hit = self.drop(bone, at, toward, region, **kw)
        if not hit: return None
        p, n, _d = hit; u = (self.carry(bone).to_3x3() @ Vector(up)).normalized(); u = u - n * u.dot(n)
        if u.length < 1e-4: return None
        u.normalize(); x = u.cross(n); m = Matrix((x, u, n)).transposed().to_4x4(); m.translation = p + n * lift; return m


# ---- small mesh makers -------------------------------------------------------------------------------
def _mesh(name, verts, faces, mat, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    o = bpy.data.objects.new(name, me); o.data.materials.append(mat); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = smooth
    return o


def cord(name, points, radius, mat, sides=6, steps=3, closed=False, flat=1.):
    """A tube through the points (a smooth curve through them). flat < 1 squashes it toward the surface (a ribbon)."""
    pts = [Vector(p) for p in points]; n = len(pts); path = []
    get = (lambda i: pts[i % n]) if closed else (lambda i: pts[max(0, min(n - 1, i))])
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = get(i - 1), get(i), get(i + 1), get(i + 2)
        for s in range(steps):
            t = s / steps; path.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed: path.append(pts[-1])
    m = len(path); verts, faces = [], []; side = None
    for i, p in enumerate(path):
        a = path[(i - 1) % m] if closed or i > 0 else p; b = path[(i + 1) % m] if closed or i < m - 1 else p; t = (b - a).normalized()
        if side is None: side = t.cross(Z if abs(t.z) < .9 else X).normalized()
        side = (side - t * side.dot(t)).normalized(); other = t.cross(side)
        for j in range(sides):
            ang = math.tau * j / sides; verts.append(p + (side * math.cos(ang) + other * math.sin(ang) * flat) * radius)
    rings = m if closed else m - 1
    for i in range(rings):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides; c, d = ((i + 1) % m) * sides + (j + 1) % sides, ((i + 1) % m) * sides + j; faces.append((a, b, c, d))
    if not closed: faces += [tuple(range(sides - 1, -1, -1)), tuple(range((m - 1) * sides, m * sides))]
    return _mesh(name, verts, faces, mat)


def plate(name, outline, thick, mat, world, bevel=0.):
    """A flat shape (outline in the frame's XY, metres), `thick` out of the surface."""
    bm = bmesh.new(); face = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in outline])
    out = bmesh.ops.extrude_face_region(bm, geom=[face]); bmesh.ops.translate(bm, vec=(0, 0, thick), verts=[g for g in out['geom'] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return held._obj(name, bm, mat, world)


def decal(body, name, outline, mat, bone, at, toward, up=Z, region='trunk', lift=.0025, cuts=2, flip=False):
    """A flat shape laid on the surface, every point dropped onto it: outline in metres (x to the wearer's left seen
    from outside along `toward`... x across, y up), centred on `at`."""
    bm = bmesh.new(); bm.faces.new([bm.verts.new((x, y, 0)) for x, y in outline])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(cuts): bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=False)
    return _laid(body, name, bm, mat, bone, at, toward, up, region, lift, flip)


def _laid(body, name, bm, mat, bone, at, toward, up, region, lift, flip=False):
    t = Vector(toward).normalized(); u = Vector(up); u = (u - t * u.dot(t)).normalized(); x = u.cross(-t)      # seen from outside: x to the right
    verts, lost = [], 0; centre = body.drop(bone, at, t, region)
    if not centre: bm.free(); return None
    for v in bm.verts:
        rest = Vector(at) + x * v.co.x * (-1 if flip else 1) + u * v.co.y; hit = body.drop(bone, rest, t, region)
        # off the edge of the surface (or onto something far behind it): as deep along the ray as the centre is
        if not hit or abs((hit[0] - centre[0]).dot(centre[2])) > .04: lost += 1; m = body.carry(bone); p = m @ rest; verts.append(p - centre[2] * ((p - centre[0]).dot(centre[2]) + lift))
        else: verts.append(hit[0] - hit[2] * lift)
    bm.verts.index_update(); faces = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    o = _mesh(name, verts, faces, mat, smooth=False)
    # facing out of the surface
    o.data.calc_loop_triangles(); n = sum((p.normal for p in o.data.polygons), Vector()).normalized()
    if n.dot(centre[2]) > 0: o.data.flip_normals()
    return o


def lettering(body, name, text, width, mat, bone, at, toward, up=Z, region='trunk', lift=.003, bold=.012):
    """Letters laid on the surface (the built-in font), `width` metres across, centred on `at`."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = text; cu.resolution_u = 2; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.offset = bold; cu.space_character = 1.08
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); bpy.data.objects.remove(o); bpy.data.curves.remove(cu)
    bm = bmesh.new(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    if not bm.verts: bm.free(); return None
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; s = width / (max(xs) - min(xs)); cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in bm.verts: v.co = Vector(((v.co.x - cx) * s, (v.co.y - cy) * s, 0))
    for _ in range(2):
        long = [e for e in bm.edges if e.calc_length() > .022]
        if long: bmesh.ops.subdivide_edges(bm, edges=long, cuts=1)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    return _laid(body, name, bm, mat, bone, at, toward, up, region, lift)


def _box(name, size, mat, world, at=(0, 0, 0), bevel=0.):
    return held.box(name, size, mat, world, at=at, bevel=bevel)


SHIELD = [(-.027, .026), (-.012, .03), (0, .036), (.012, .03), (.027, .026), (.025, -.006), (.014, -.026), (0, -.036), (-.014, -.026), (-.025, -.006)]
GOLD = lambda: held.material('badge gold', (.83, .62, .22), .32, 1.)
SILVER = lambda: held.material('badge silver', (.8, .81, .83), .3, 1.)
BLACK = lambda: held.material('duty black', (.025, .025, .028), .6)


def _points(body, k):
    """Landmarks in the rest pose."""
    j = body.joint; chest, neck, sh = j('spine_03'), j('neck_01'), j('upperarm_l')
    return {'chest': chest.z, 'neck': neck.z, 'rise': neck.z - chest.z, 'shoulder': sh.x, 'belt': j('spine_01').z + .022 * k, 'y': chest.y, 'pelvis_y': j('pelvis').y}


# ---- items ------------------------------------------------------------------------------------------------
def badge(body, side='l', metal='gold', **_):
    """A shield on the chest."""
    P = _points(body, body.k); s = 1 if side == 'l' else -1
    m = body.frame('spine_03', (s * P['shoulder'] * .56, P['y'], P['chest'] + P['rise'] * .6), BACK, lift=.001)
    if not m: return []
    mat = GOLD() if metal == 'gold' else SILVER()
    return [(plate('badge', SHIELD, .004, mat, m), 'spine_03'), (plate('badge boss', [(math.cos(a) * .011, math.sin(a) * .011) for a in [math.tau * i / 10 for i in range(10)]], .0065, SILVER() if metal == 'gold' else GOLD(), m), 'spine_03')]


def nameplate(body, side='r', **_):
    P = _points(body, body.k); s = 1 if side == 'l' else -1
    m = body.frame('spine_03', (s * P['shoulder'] * .56, P['y'], P['chest'] + P['rise'] * .62), BACK, lift=.001)
    return [(_box('name plate', (.062, .014, .003), GOLD(), m, at=(0, 0, .0015)), 'spine_03')] if m else []


def chest_patch(body, text='SECURITY', side='l', color=(.9, .78, .1), ink=(.03, .03, .03), **_):
    """A sewn-on patch with a word on it."""
    P = _points(body, body.k); s = 1 if side == 'l' else -1; at = (s * P['shoulder'] * .5, P['y'], P['chest'] + P['rise'] * .6)
    out = [(decal(body, 'chest patch', [(-.042, -.013), (.042, -.013), (.042, .013), (-.042, .013)], held.material('patch ' + str(color), color, .8), 'spine_03', at, BACK, cuts=3, lift=.004), 'spine_03'),
           (lettering(body, 'chest patch text', text, .072, held.material('patch ink ' + str(ink), ink, .8), 'spine_03', at, BACK, lift=.0065, bold=.02), 'spine_03')]
    return [o for o in out if o[0]]


def back_text(body, text='SECURITY', color=(.93, .93, .9), width=.3, **_):
    """Big letters across the shoulder blades."""
    P = _points(body, body.k); w = min(width, P['shoulder'] * 1.75)
    o = lettering(body, 'back text', text, w, held.material('lettering ' + str(color), color, .75), 'spine_03', (0, P['y'], P['chest'] + P['rise'] * .52), FRONT, lift=.0035, bold=.028)
    return [(o, 'spine_03')] if o else []


def shoulder_patch(body, sides='lr', color=(.78, .6, .15), field=(.12, .25, .55), chevrons=0, **_):
    """A patch high on the sleeve (both sides), with a sergeant's chevrons under it."""
    out = []
    for side in sides:
        s = 1 if side == 'l' else -1; bone = 'upperarm_' + side; a, b = body.joint(bone), body.joint('lowerarm_' + side); along = (b - a).normalized()
        outer = Vector((-along.z * s, 0, along.x * s)).normalized()                   # the top of the arm in the rest pose: its outer side when it hangs
        if outer.z < 0: outer = -outer
        up = -along; at = a + along * (b - a).length * .3; region = 'arm_' + side
        shape = [(x * 1.15, y * 1.1) for x, y in SHIELD]
        out += [(decal(body, 'shoulder patch', shape, held.material('patch ' + str(color), color, .8), bone, at, -outer, up, region), bone),
                (decal(body, 'shoulder patch field', [(x * .78, y * .78) for x, y in shape], held.material('patch ' + str(field), field, .8), bone, at, -outer, up, region, lift=.0035), bone)]
        for i in range(chevrons):
            c = at + along * (.062 + i * .019); v = [(-.032, .012), (0, -.004), (.032, .012), (.032, .023), (0, .007), (-.032, .023)]
            out.append((decal(body, 'chevron', v, held.material('chevron', (.85, .68, .2), .7), bone, c, -outer, up, region, cuts=1), bone))
    return [o for o in out if o[0]]


def _ring(body, z, n=36, bone='pelvis'):
    """The waist at height z (rest pose): points round it on the posed surface, with out and up directions. Angle 0 is the front, growing toward the left side."""
    c = Vector((0, body.joint('pelvis').y + .01, z)); m = body.carry(bone); up = (m.to_3x3() @ Z).normalized(); centre = m @ c; hits = []
    for i in range(n):
        a = math.tau * i / n; d = Vector((math.sin(a), -math.cos(a), 0)); hit = body.drop(bone, c + d * .45, -d, 'trunk', reach=.45, start=0)
        hits.append((hit[0] - centre).dot((m.to_3x3() @ d).normalized()) if hit else None)
    known = [h for h in hits if h is not None]
    if len(known) < n * .6: return None
    mean = sum(known) / len(known); r = [h if h is not None else mean for h in hits]
    # a belt is taut: no dents (a gap between shirt and trousers), and no sharp steps
    for _ in range(2): r = [max(r[i], (r[i - 1] + r[(i + 1) % n]) / 2 - .004) for i in range(n)]
    r = [(r[i - 1] + 2 * r[i] + r[(i + 1) % n]) / 4 for i in range(n)]
    def spot(a):
        f = (a % math.tau) / math.tau * n; i = int(f) % n; t = f - int(f); rad = r[i] * (1 - t) + r[(i + 1) % n] * t
        d = (m.to_3x3() @ Vector((math.sin(a), -math.cos(a), 0))).normalized(); return centre + d * rad, d, up
    return spot, n


def belt(body, color=(.03, .03, .032), width=.05, buckle='silver', items=(), tuck=True, **_):
    """A belt round the waist with what hangs on it. items: [(kind, degrees round from the front toward the left hip), ...]:
    'radio', 'pouch', 'cuffs', 'light', 'tools', 'badge', 'keys'."""
    k = body.k; P = _points(body, k); ring = _ring(body, P['belt'])
    if not ring: return []
    spot, n = ring; mat = held.material('belt ' + str(color), color, .55); thick = .006; verts, faces = [], []
    for i in range(n):
        p, d, up = spot(math.tau * i / n)
        verts += [p + up * width / 2 + d * .001, p + up * width / 2 + d * thick, p - up * width / 2 + d * thick, p - up * width / 2 + d * .001]
    for i in range(n):
        a, b = i * 4, ((i + 1) % n) * 4; faces += [(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2), (a + 2, b + 2, b + 3, a + 3)]
    out = [(_mesh('belt', verts, faces, mat, smooth=False), 'pelvis')]
    def at(deg, lift=0.):
        p, d, up = spot(math.radians(deg)); x = up.cross(d).normalized(); m = Matrix((x, up, d)).transposed().to_4x4(); m.translation = p + d * (thick + lift); return m
    if buckle: out.append((_box('belt buckle', (.05, width + .006, .006), SILVER() if buckle == 'silver' else GOLD(), at(0), at=(0, 0, .003), bevel=.002), 'pelvis'))
    black = BLACK()
    for kind, deg in items:
        m = at(deg)
        if kind == 'radio':
            out += [(_box('radio', (.058, .105, .034), held.material('radio', (.04, .04, .045), .5), m, at=(0, .012, .017), bevel=.004), 'pelvis'),
                    (held.tube('radio antenna', .0045, (-.017, .06, .017), (-.017, .135, .017), black, m, 8), 'pelvis'),
                    (held.tube('radio knob', .007, (.015, .06, .017), (.015, .078, .017), black, m, 8), 'pelvis')]
        elif kind == 'pouch':
            out += [(_box('belt pouch', (.085, .09, .036), black, m, at=(0, -.008, .018), bevel=.006), 'pelvis'), (_box('belt pouch flap', (.087, .04, .006), black, m, at=(0, .02, .038), bevel=.002), 'pelvis')]
        elif kind == 'cuffs':
            out += [(_box('cuff case', (.095, .1, .03), black, m, at=(0, -.012, .015), bevel=.008), 'pelvis'), (held.tube('cuff case snap', .006, (0, .0, .03), (0, .0, .034), SILVER(), m, 8), 'pelvis')]
        elif kind == 'light':
            out += [(held.tube('torch', .015, (0, -.1, .022), (0, .045, .022), black, m, 10), 'pelvis'), (held.tube('torch head', .02, (0, .045, .022), (0, .075, .022), black, m, 10), 'pelvis')]
        elif kind == 'keys':
            out += [(_box('key clip', (.02, .05, .012), SILVER(), m, at=(0, -.02, .006), bevel=.002), 'pelvis'), (_box('keys', (.03, .05, .008), SILVER(), m, at=(.004, -.065, .008)), 'pelvis')]
        elif kind == 'tools':
            tan = held.material('tool pouch', (.42, .27, .13), .8)
            out += [(_box('tool pouch', (.12, .15, .045), tan, m, at=(0, -.06, .0225), bevel=.006), 'pelvis'), (_box('tool pouch pocket', (.1, .085, .02), tan, m, at=(0, -.085, .055), bevel=.004), 'pelvis')]
            for i, c in enumerate([(.85, .45, .05), (.75, .1, .08), (.1, .3, .65)]):
                x = -.035 + i * .035; out += [(held.tube('tool grip', .011, (x, .0, .025), (x, .075, .025), held.material('tool grip ' + str(c), c, .5), m, 8), 'pelvis')]
        elif kind == 'badge':
            out += [(_box('badge holder', (.06, .095, .008), black, m, at=(0, -.015, .004), bevel=.003), 'pelvis'), (plate('belt badge', [(x * .95, y * .95 - .018) for x, y in SHIELD], .004, GOLD(), m @ held.T(0, 0, .008)), 'pelvis')]
    return out


def hip_badge(body, deg=28, **_):
    """A detective's badge clipped at the waist (no belt of its own: it sits on the jacket or the trousers)."""
    P = _points(body, body.k); ring = _ring(body, P['belt'] - .01)
    if not ring: return []
    p, d, up = ring[0](math.radians(deg)); x = up.cross(d).normalized(); m = Matrix((x, up, d)).transposed().to_4x4(); m.translation = p + d * .002
    return [(_box('badge holder', (.06, .095, .008), BLACK(), m, at=(0, -.015, .004), bevel=.003), 'pelvis'), (plate('belt badge', [(x_ * .95, y_ * .95 - .018) for x_, y_ in SHIELD], .004, GOLD(), m @ held.T(0, 0, .008)), 'pelvis')]


def _collar(body, P, drop, spread=.05, lift=.006, back=True):
    """Points of something hung round the neck, from the wearer's right end, round the back of the neck, to the left end.
    drop: how far down the chest the ends reach (0 = the neck, 1 = the bottom of the ribs); spread: metres apart there."""
    chest, rise, y = P['chest'], P['rise'], P['y']; nx = P['shoulder'] * .36; out = []
    def front(x, t):
        hit = body.drop('spine_03', (x, y, chest + rise * (1 - t)), BACK); return hit and hit[0] + hit[1] * lift
    def top(x, yy):
        hit = body.drop('spine_03', (x, yy, P['neck'] + .02), -Z, start=.25); return hit and hit[0] + hit[1] * lift
    def behind(x, t):
        hit = body.drop('spine_03', (x, y, chest + rise * (1 - t)), FRONT); return hit and hit[0] + hit[1] * lift
    steps = 5; half = []
    for i in range(steps + 1):
        t = drop * (1 - i / steps) + .06 * (i / steps); x = spread / 2 + (nx - spread / 2) * (i / steps) ** .8; half.append((x, t))
    right = [front(-x, t) for x, t in half]; left = [front(x, t) for x, t in reversed(half)]
    over = [top(-nx * 1.05, y + .0), behind(-nx * .8, .02), behind(0, .0), behind(nx * .8, .02), top(nx * 1.05, y + .0)] if back else []
    pts = [p for p in right + over + left if p is not None]
    return pts if len(pts) >= 6 else None


def lanyard(body, color=(.1, .25, .6), card=(.95, .95, .93), stripe=None, drop=.72, **_):
    """A lanyard round the neck with an ID card on the chest."""
    P = _points(body, body.k); pts = _collar(body, P, drop, spread=.012, lift=.004)
    if not pts: return []
    out = [(cord('lanyard', pts, .0055, held.material('lanyard ' + str(color), color, .7), sides=4, steps=2, flat=.45), 'spine_03')]
    m = body.frame('spine_03', (0, P['y'], P['chest'] + P['rise'] * (1 - drop) - .05), BACK, lift=.004)
    if m: out += _card(m, card, stripe or color)
    return out


def _card(m, card=(.95, .95, .93), stripe=(.1, .25, .6)):
    return [(_box('id card', (.056, .088, .002), held.material('id card ' + str(card), card, .4), m, at=(0, 0, .001)), 'spine_03'),
            (_box('id card stripe', (.056, .02, .0006), held.material('id stripe ' + str(stripe), stripe, .4), m, at=(0, .034, .0023)), 'spine_03'),
            (_box('id card photo', (.022, .028, .0006), held.material('id photo', (.55, .5, .46), .5), m, at=(-.012, .003, .0023)), 'spine_03'),
            (_box('id card clip', (.012, .016, .004), SILVER(), m, at=(0, .05, .002)), 'spine_03')]


def id_badge(body, side='l', low=False, stripe=(.1, .45, .5), **_):
    """An ID card clipped to the chest (or, low, to the hem at the hip)."""
    P = _points(body, body.k); s = 1 if side == 'l' else -1
    m = body.frame('spine_03', (s * P['shoulder'] * .6, P['y'], P['chest'] + P['rise'] * (.02 if low else .42)), BACK, lift=.004)
    return _card(m, stripe=stripe) if m else []


def stethoscope(body, color=(.06, .06, .07), **_):
    """Draped round the neck: the chest piece hangs on the wearer's left, the ear tubes on the right."""
    P = _points(body, body.k); pts = _collar(body, P, .58, spread=.15, lift=.008)
    if not pts: return []
    tube = held.material('stethoscope ' + str(color), color, .45); steel = SILVER(); out = [(cord('stethoscope', pts, .0052, tube, sides=6, steps=3), 'spine_03')]
    a, b = pts[-1], pts[-2]; d = (a - b).normalized(); n = body.drop('spine_03', (P['shoulder'] * .3, P['y'], P['chest'] + P['rise'] * .42), BACK)
    out_n = n[1] if n else Vector((0, -1, 0))
    rot = Z.rotation_difference(out_n).to_matrix().to_4x4(); rot.translation = a + d * .02 + out_n * .004
    out += [(held.tube('stethoscope stem', .004, a, a + d * .02, steel, Matrix.Identity(4), 8), 'spine_03'), (held.tube('chest piece', .023, (0, 0, -.006), (0, 0, .006), steel, rot, 16), 'spine_03'),
            (held.tube('chest piece ring', .0235, (0, 0, .006), (0, 0, .009), tube, rot, 16), 'spine_03')]
    a, b = pts[0], pts[1]; d = (a - b).normalized(); side = d.cross(out_n).normalized()
    for s in (-1, 1):
        tip = a + d * .1 + side * s * .028 + out_n * .004
        out += [(held.tube('ear tube', .0032, a, tip, steel, Matrix.Identity(4), 6), 'spine_03'), (held.tube('ear tip', .006, tip, tip + d * .012, tube, Matrix.Identity(4), 8), 'spine_03')]
    return out


def shoulder_mic(body, side='l', **_):
    """A radio's speaker microphone clipped by the collarbone, its cord over the shoulder."""
    P = _points(body, body.k); s = 1 if side == 'l' else -1
    m = body.frame('spine_03', (s * P['shoulder'] * .68, P['y'], P['chest'] + P['rise'] * .8), BACK, lift=.001)
    if not m: return []
    black = held.material('radio', (.04, .04, .045), .5)
    out = [(_box('shoulder mic', (.036, .068, .024), black, m, at=(0, 0, .012), bevel=.004), 'spine_03'), (_box('shoulder mic grille', (.024, .026, .002), held.material('mic grille', (.2, .2, .21), .6), m, at=(0, .012, .025)), 'spine_03'),
           (_box('shoulder mic key', (.006, .022, .012), held.material('mic key', (.75, .2, .08), .5), m, at=(-.02 * s, -.008, .012)), 'spine_03')]
    # the cord goes up over the shoulder and down the back to the radio on the belt
    pts = [m @ Vector((0, .034, .012))]; x = s * P['shoulder'] * .66
    for at, toward, start in (((x, P['y'], P['neck'] + .02), -Z, .25), ((x, P['y'], P['chest'] + P['rise'] * .78), FRONT, .3), ((x, P['y'], P['chest'] + P['rise'] * .4), FRONT, .3), ((x * .95, P['y'], P['chest'] + P['rise'] * .02), FRONT, .3)):
        hit = body.drop('spine_03', at, toward, start=start)
        if hit: pts.append(hit[0] + hit[1] * .005)
    if len(pts) > 2: out.append((cord('mic cord', pts, .0035, black, sides=5, steps=3), 'spine_03'))
    return out


BUILDERS = {'badge': badge, 'nameplate': nameplate, 'chest_patch': chest_patch, 'back_text': back_text, 'shoulder_patch': shoulder_patch, 'belt': belt, 'hip_badge': hip_badge,
            'lanyard': lanyard, 'id_badge': id_badge, 'stethoscope': stethoscope, 'shoulder_mic': shoulder_mic}


def build(rig, meshes, who, spec):
    gear = [g for g in who.get('gear', []) if spec['pose'] not in g[1].get('not_in', ())]
    if not gear: return []
    body = Body(rig, meshes, who); out = []
    for kind, kw in gear: out += [(o, bone) for o, bone in BUILDERS[kind](body, **kw) if o is not None]
    return out
