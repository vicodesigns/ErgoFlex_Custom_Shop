"""Fit the film cast's shirts and trousers in Blender, before posing.

The cut panels inherit UVs and armature weights from the cloth beneath them
so a Director recolour and the character's animation also apply to the pockets.
"""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import garments


GARMENTS = {'toigo_basic_tucked_t-shirt', 'joepal_crude_t-shirt_female',
            'namuhekam_male_polo_shirt', 'toigo_fisherman_sweater', 'toigo_wool_pants', 'cortu_cargo_pants'}


def ramp(low, high, value):
    t = max(0., min(1., (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def panel_projector(bm):
    """Project sewn pieces onto the fitted garment. Every stitch inherits the
    UV and skin weights of the exact triangle beneath it."""
    triangles = bm.calc_loop_triangles()
    bm.verts.index_update()
    tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts],
                                [[l.vert.index for l in tri] for tri in triangles], all_triangles=True)
    deform = bm.verts.layers.deform.active
    uv = bm.loops.layers.uv.active

    def patch(rows, back=False, side=0):
        outward = Vector((side, 0, 0)) if side else Vector((0, 1 if back else -1, 0))
        previous = []
        for pattern in rows:
            row = []
            for x, z, lift in pattern:
                origin = Vector((0, x, z) if side else (x, 0, z)) + outward * .7
                hit, normal, idx, _ = tree.ray_cast(origin, -outward, 1.4)
                if hit is None:
                    raise ValueError('Pattern extends beyond the fitted garment')
                tri = triangles[idx]
                a, b, c = [l.vert.co for l in tri]
                ab, ac, h = b - a, c - a, hit - a
                n = ab.cross(ac)
                wb = h.cross(ac).dot(n) / n.length_squared
                wc = ab.cross(h).dot(n) / n.length_squared
                if normal.dot(outward) < 0:
                    normal.negate()
                v = bm.verts.new(hit + normal * lift)
                groups = v[deform]
                texcoord = Vector((0, 0))
                for loop, factor in zip(tri, [1 - wb - wc, wb, wc]):
                    texcoord += loop[uv].uv * factor
                    for group, w in loop.vert[deform].items():
                        groups[group] = groups.get(group, 0.) + factor * w
                row.append((v, texcoord))
            if previous:
                for i in range(len(row) - 1):
                    corners = [previous[i], previous[i + 1], row[i + 1], row[i]]
                    if back or side < 0:
                        corners.reverse()
                    face = bm.faces.new([v for v, _ in corners])
                    face.smooth = True
                    for loop, (_, coord) in zip(face.loops, corners):
                        loop[uv].uv = coord
            previous = row

    return patch


def sew_studio_panels(bm, shoulder, chest, waist):
    patch = panel_projector(bm)
    half = .052
    top = chest.z + .117
    rows = []
    for t, lift in [(0, .001), (.48, .005), (.86, .006), (.90, .008), (.99, .009), (1, .004)]:
        row = []
        for u in [-1, -.72, -.38, 0, .38, .72, 1]:
            x = abs(shoulder.x) * .52 + u * half * (.80 if t == 0 else 1)
            z = top - .112 * (1 - t) + (.009 * abs(u) if t == 0 else .002 * u)
            offset = .004 + lift * (1 - abs(u) ** 4)
            row.append((x, z, .004 if u == -.38 else offset))
        rows.append(row)
    patch(rows)

    # Lin is filmed from behind while she reaches for the canvas. A shoulder
    # yoke carries a box pleat; its two raised returns release across the back.
    seam_z = shoulder.z - .076
    pleat = []
    for j in range(12):
        t = j / 11
        reach = .016 + .009 * (1 - t)
        strength = ramp(0, .22, t)
        pleat.append([(u * reach, waist.z + .041 + (seam_z - waist.z - .039) * t,
                       .002 + strength * lift) for u, lift in
                      [(-1, .001), (-.77, .008), (-.58, .005), (0, .005),
                       (.58, .005), (.77, .008), (1, .001)]])
    patch(pleat, back=True)
    yoke = []
    for height, loft in [(-.003, .003), (.001, .009), (.005, .007), (.013, .004),
                         (.025, .003), (.039, .0025), (.052, .002)]:
        row = []
        for i in range(21):
            u = (i - 10) / 10
            x = u * abs(shoulder.x) * .94
            z = seam_z + height + .025 * u * u
            row.append((x, z, loft * (1 - .55 * abs(u) ** 6)))
        yoke.append(row)
    patch(yoke, back=True)


def workshop_pocket(bm, shoulder, chest):
    # A narrow stitched pencil division on the mechanic's breast pocket.
    patch = panel_projector(bm)
    rows = []
    for height, fullness in [(0, .001), (.12, .004), (.75, .006), (.92, .008), (1, .004)]:
        row = []
        for u in (-1, -.7, -.35, .05, .39, .55, .76, 1):
            x = abs(shoulder.x) * .52 + u * .052
            z = chest.z + .028 + height * .108 + (1 - height) * .010 * abs(u)
            depth = .003 if u == .55 else .003 + fullness * (1 - abs(u) ** 4)
            row.append((x, z, depth))
        rows.append(row)
    patch(rows)


def cargo_pockets(bm, hip, knee):
    # Bellows and an overlapping flap sit on the long outer face of each thigh.
    # Lay them out from the leg centreline so both pieces bend with that thigh.
    patch = panel_projector(bm)
    for side in (-1, 1):
        for flap in (False, True):
            rows = []
            levels = [(0, .012), (.08, .017), (.82, .010), (1, .003)] if flap else [
                (0, .003), (.07, .012), (.22, .016), (.65, .017), (.90, .011), (1, .004)]
            for t, loft in levels:
                row = []
                for u in (-1, -.91, -.75, -.20, -.10, .08, .20, .75, .91, 1):
                    along = (.54 + .075 * t) if flap else (.30 + .28 * t)
                    z = knee.z + along * (hip.z - knee.z)
                    y = knee.y + along * (hip.y - knee.y) + .066 * u
                    # The flap edge drops in the middle. The main panel has a
                    # vertical inverted pleat and narrows where it is stitched.
                    z += .009 * abs(u) * (1 - t)
                    lift = loft * (1 - .85 * abs(u) ** 8)
                    if not flap:
                        lift *= .45 + .55 * ramp(.05, .20, abs(u))
                    overlap = .015 * (1 - t) if flap else 0
                    row.append((y, z, .002 + overlap + lift))
                rows.append(row)
            patch(rows, side=side)


def shape_neckline(bm, shoulder):
    """Ease the existing rib band in toward the neck and roll its outside lip."""
    rim = [v for v in bm.verts if v.is_boundary and abs(v.co.x) < abs(shoulder.x)
           and v.co.z > shoulder.z - .09]
    center = sum((v.co for v in rim), Vector((0, 0, 0))) / len(rim)
    tree = KDTree(len(rim))
    for i, v in enumerate(rim):
        tree.insert(v.co, i)
    tree.balance()
    for v in bm.verts:
        _, _, distance = tree.find(v.co)
        if distance > .04:
            continue
        taper = 1 - ramp(.003, .038, distance)
        v.co.x -= (v.co.x - center.x) * .055 * taper
        v.co.y -= (v.co.y - center.y) * .055 * taper
        v.co += v.normal * (.0028 * math.exp(-((distance - .013) / .005) ** 2))


def skin_surface(base):
    hidden = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    faces = [tuple(face.vertices) for face in base.data.polygons if not any(i in hidden for i in face.vertices)]
    return BVHTree.FromPolygons(garments._shape(base), faces)


def take_in(vertex, surface, ease, amount):
    """Remove excess cloth locally, keeping ease over the actor's shaped skin."""
    if amount <= 0:
        return
    point, normal, _, distance = surface.find_nearest(vertex.co)
    delta = vertex.co - point
    if distance > ease and delta.dot(normal) > 0:
        vertex.co -= delta * (amount * min(.022, distance - ease) / distance)


def covered_skin(base, cloth):
    """Find skin safely under the shirt in the neutral pose. An armpit can
    cross the sleeve after an elbow bends, so posed face normals alone miss it."""
    shell = BVHTree.FromBMesh(cloth)
    edges = [v for v in cloth.verts if v.is_boundary]
    openings = KDTree(len(edges))
    for i, v in enumerate(edges):
        openings.insert(v.co, i)
    openings.balance()
    groups = {g.index for g in base.vertex_groups if g.name.startswith(('spine_', 'clavicle_', 'upperarm_'))}
    hidden = []
    for v, point in zip(base.data.vertices, garments._shape(base)):
        if sum(g.weight for g in v.groups if g.group in groups) < .35:
            continue
        hit, normal, _, distance = shell.find_nearest(point, .045)
        if hit is None or (point - hit).dot(normal) > .003:
            continue
        # Keep the skin around every opening, including its adjacent triangles.
        if openings.find(hit)[2] > .037:
            hidden.append(v.index)
    return hidden


def fit(obj, rig, style, garment, base):
    trousers = garment in ('toigo_wool_pants', 'cortu_cargo_pants', 'male_casualsuit04', 'female_casualsuit01')
    polo = garment == 'namuhekam_male_polo_shirt'
    knitted = garment == 'toigo_fisherman_sweater'
    deps = bpy.context.evaluated_depsgraph_get()
    # Evaluate the MPFB fitting modifiers in the neutral pose. Reuse the
    # original vertex-group indices when the armature is put back on the mesh.
    fitted = bpy.data.meshes.new_from_object(obj.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    world = obj.matrix_world.copy()
    joint = lambda name: rig.matrix_world @ rig.data.bones[name].head_local
    waist, chest, shoulder = [joint(b) for b in ('spine_01', 'spine_03', 'upperarm_l')]
    bm = bmesh.new()
    bm.from_mesh(fitted)
    bm.transform(world)
    cuts = 3 if garment == 'cortu_cargo_pants' else 1
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=.18,
                          use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    # A rolled cuff is part of the existing sleeve. Measure along each upper
    # arm, including on a character whose shoulder line is asymmetric.
    sleeves = {}
    if not trousers and not knitted:
        for side in ('l', 'r'):
            origin = joint('upperarm_' + side)
            axis = (joint('lowerarm_' + side) - origin).normalized()
            reach = max((v.co - origin).dot(axis) for v in bm.verts
                        if v.co.x * origin.x > 0 and abs(v.co.x) > abs(origin.x))
            sleeves[side] = (origin, axis, reach)
    hem_z = min(v.co.z for v in bm.verts)
    knee, ankle = joint('calf_l'), joint('foot_l')
    close_tee = not trousers and style in ('edit', 'breton')
    if knitted or close_tee:
        surface = skin_surface(base)
    if knitted:
        body_hem = min(v.co.z for v in bm.verts if abs(v.co.x) < abs(shoulder.x) * .78)
    for v in bm.verts:
        x, y, z = v.co
        if knitted:
            # The fitted arm and the ribbed cuff already carry the bend.
            # Leave the underarm room to flex, then taper over the arm itself.
            sleeve = ramp(.78, 1.35, abs(x / shoulder.x))
            lower_body = 1 - ramp(waist.z + .08, chest.z + .05, z)
            take_in(v, surface, .006 + .005 * (1 - sleeve),
                    .84 * sleeve + .58 * (1 - sleeve) * lower_body)
            # One shallow release above the ribbing, mainly at the side seams.
            side = ramp(.38, .84, abs(x / shoulder.x)) * (1 - sleeve)
            depth = z - body_hem - .040 - .12 * x
            v.co += v.normal * (.002 * side * math.exp(-(depth / .021) ** 2))
        elif trousers:
            # Breaks of woven wool above the shoe and on either side of the knee.
            side = 1 if x > 0 else -1
            across = abs(x) - abs(knee.x)
            drape = 0.
            for center, tilt, size, spread in [(knee.z + .04, .48, .007, .019),
                    (knee.z - .04, -.38, .006, .016), (ankle.z + .065, .31, .008, .018),
                    (ankle.z + .115, -.37, .005, .02)]:
                drape += size * math.exp(-((z - center - tilt * across - .009 * side) / spread) ** 2)
            v.co += v.normal * drape
        else:
            # Suspended cloth bridges the lower ribs, then gathers where it
            # meets the waistband. The neck and tucked edge keep their fit.
            above = ramp(waist.z - .015, waist.z + .10, z)
            below = 1 - ramp(chest.z + .05, shoulder.z, z)
            trunk = 1 - ramp(abs(shoulder.x) * .86, abs(shoulder.x) * 1.24, abs(x))
            a = math.atan2(y, x)
            fan = (.5 + .5 * math.cos(6 * a + 6.5 * (z - waist.z) + .6 * math.sin(3*a))) ** 2
            fullness = .019 if style == 'studio' else .014
            ease = above * below * trunk * (.004 + fullness * fan)
            gather = math.exp(-((z - waist.z - .093 - .28*x - .016*math.cos(3*a)) / .016) ** 2)
            origin, axis, reach = sleeves['l' if x * shoulder.x > 0 else 'r']
            along = (v.co - origin).dot(axis)
            cuff = 0.
            if along > .045 and abs(x) > abs(origin.x):
                width = .026 if polo else {'studio': .031, 'edit': .019, 'home': .024, 'breton': .018}[style]
                distance = reach - along
                cuff = .006 * math.exp(-((distance - width) / .005) ** 2)
                cuff += .004 * ramp(0, .006, distance) * (1 - ramp(width - .004, width + .004, distance))
                if polo:
                    cuff += .009 * math.exp(-((distance - width - .02) / .015) ** 2)
            if polo:
                # A knitted welt gathers the sleeve into its band. The lower
                # edge hangs free, with shallow diagonal folds at the side vents.
                depth = z - hem_z - .012 * abs(math.sin(a))
                seam = .006 * math.exp(-((depth - .024) / .009) ** 2)
                folds = .012 * math.exp(-((depth - .09 - .32 * y) / .022) ** 2)
                ease += trunk * (seam + folds * abs(math.cos(a)) ** 4)
            waist_fold = .006 * gather * trunk * (.35 + .65 * abs(math.sin(a)))
            if close_tee:
                # Follow the waistband around a seated or standing editor.
                # Concentrate the little remaining fullness at the side seam.
                take_in(v, surface, .005, .80 * trunk * (1 - ramp(chest.z, chest.z + .08, z)))
                ease = .16 * ease * abs(math.cos(a)) ** 2
                waist_fold *= .18 * abs(math.cos(a)) ** 2
                cuff *= .55
            v.co += v.normal * (ease + waist_fold + cuff)
    bm.normal_update()
    if (style == 'breton' and garment == 'toigo_basic_tucked_t-shirt') or (style == 'commons' and knitted):
        shape_neckline(bm, shoulder)
    if garment == 'joepal_crude_t-shirt_female':
        # Ease & smooth the underarm gusset so raised-arm poses (e.g. Priya's stretch) never pinch or fold black spikes.
        underarm = [v for v in bm.verts if not v.is_boundary
                    and abs(shoulder.x) * .62 < abs(v.co.x) < abs(shoulder.x) * 1.18
                    and shoulder.z - .14 < v.co.z < shoulder.z + .03]
        if underarm:
            bmesh.ops.smooth_vert(bm, verts=underarm, factor=.48, use_axis_x=True, use_axis_y=True, use_axis_z=True)
            bm.normal_update()
            for v in underarm:
                v.co += v.normal * .0035
            bm.normal_update()
    if not trousers and style == 'studio':
        sew_studio_panels(bm, shoulder, chest, waist)
    if polo and style == 'workshop':
        workshop_pocket(bm, shoulder, chest)
    if garment == 'cortu_cargo_pants':
        cargo_pockets(bm, joint('thigh_l'), knee)
    covered = covered_skin(base, bm) if (knitted or garment == 'joepal_crude_t-shirt_female') else []
    bm.transform(world.inverted())
    bm.to_mesh(fitted)
    bm.free()
    obj.modifiers.clear()
    obj.data = fitted
    obj.modifiers.new('Tailored fabric', 'ARMATURE').object = rig
    return covered
