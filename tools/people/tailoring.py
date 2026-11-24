"""Fit the cast's shirts and trousers in Blender, before posing.

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


TOPS = {
    'toigo_basic_tucked_t-shirt',
    'joepal_crude_t-shirt_female',
    'namuhekam_male_polo_shirt',
    'toigo_fisherman_sweater',
    'elvs_crude_t-shirt_male',
}
TROUSERS = {
    'toigo_wool_pants',
    'cortu_cargo_pants',
    'male_casualsuit04',
    'female_casualsuit01',
    'toigo_harem_pants',
}
SUITS = {
    'female_casualsuit01',
    'female_casualsuit02',
    'male_casualsuit01',
    'male_casualsuit02',
    'male_casualsuit03',
    'male_casualsuit04',
    'male_casualsuit05',
    'male_casualsuit06',
    'male_worksuit01',
}
GARMENTS = TOPS | TROUSERS | SUITS


def ramp(low, high, value):
    t = max(0., min(1., (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def panel_projector(bm):
    """Project sewn pieces onto the fitted garment. Every stitch inherits the
    UV and skin weights of the exact triangle beneath it."""
    triangles = bm.calc_loop_triangles()
    bm.verts.index_update()
    tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts],
                                [tuple(loop.vert.index for loop in tri) for tri in triangles])
    uv_layer = bm.loops.layers.uv.active
    deform = bm.verts.layers.deform.active

    def weights_at(tri, b):
        out = {}
        for loop, k in zip(tri, b):
            if k <= 0:
                continue
            for group, w in loop.vert[deform].items():
                out[group] = out.get(group, 0.) + w * k
        return out

    def uv_at(tri, b):
        return sum((loop[uv_layer].uv * k for loop, k in zip(tri, b)), Vector((0, 0)))

    def bary(p, tri):
        a, b, c = [l.vert.co for l in tri]
        v0, v1, v2 = b - a, c - a, p - a
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        return (max(0., 1 - v - w), max(0., v), max(0., w))

    def stitch(rows, back=False, side=0):
        grid = []
        for row in rows:
            line = []
            for a, z, lift in row:
                if side:
                    origin = Vector((side * .55, a, z))
                    direction = Vector((-side, 0, 0))
                else:
                    origin = Vector((a, .55 if back else -.55, z))
                    direction = Vector((0, -1 if back else 1, 0))
                hit, normal, idx, _ = tree.ray_cast(origin, direction, 1.1)
                if hit is None:
                    return
                tri = triangles[idx]
                w = bary(hit, tri)
                vert = bm.verts.new(hit + normal * lift)
                for group, val in weights_at(tri, w).items():
                    vert[deform][group] = val
                line.append((vert, uv_at(tri, w)))
            grid.append(line)
        for r in range(len(grid) - 1):
            for c in range(len(grid[r]) - 1):
                quad = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]
                if back or side > 0:
                    quad.reverse()
                face = bm.faces.new([v for v, _ in quad])
                face.smooth = True
                for loop, (_, uv) in zip(face.loops, quad):
                    loop[uv_layer].uv = uv

    return stitch


def sew_studio_panels(bm, shoulder, chest, waist):
    patch = panel_projector(bm)
    rows = []
    for height, fullness in [(0, .001), (.12, .0035), (.78, .0055), (.92, .007), (1, .003)]:
        row = []
        for u in (-1, -.75, -.38, -.12, .18, .55, .82, 1):
            x = abs(shoulder.x) * .5 + u * .048
            z = chest.z + .018 + height * .096 + (1 - height) * .009 * abs(u)
            offset = .002 + fullness * (1 - abs(u) ** 4)
            row.append((x, z, .004 if u == -.38 else offset))
        rows.append(row)
    patch(rows)

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
            levels = [(0, .010), (.08, .014), (.82, .008), (1, .0025)] if flap else [
                (0, .0025), (.07, .010), (.22, .013), (.65, .014), (.90, .009), (1, .003)]
            for t, loft in levels:
                row = []
                for u in (-1, -.91, -.75, -.20, -.10, .08, .20, .75, .91, 1):
                    along = (.54 + .075 * t) if flap else (.30 + .28 * t)
                    z = knee.z + along * (hip.z - knee.z)
                    y = knee.y + along * (hip.y - knee.y) + .064 * u
                    z += .008 * abs(u) * (1 - t)
                    lift = loft * (1 - .85 * abs(u) ** 8)
                    if not flap:
                        lift *= .45 + .55 * ramp(.05, .20, abs(u))
                    overlap = .012 * (1 - t) if flap else 0
                    row.append((y, z, .002 + overlap + lift))
                rows.append(row)
            patch(rows, side=side)


def shape_neckline(bm, shoulder):
    """Ease the existing rib band in toward the neck and roll its outside lip."""
    rim = [v for v in bm.verts if v.is_boundary and abs(v.co.x) < abs(shoulder.x)
           and v.co.z > shoulder.z - .09]
    if not rim:
        return
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


def take_in(vertex, surface, ease, amount, max_pull=.022, min_ease=None):
    """Remove excess cloth locally, keeping ease over the actor's shaped skin.
    When min_ease is set, also gently clears cloth that sits too close to skin."""
    if amount <= 0 and min_ease is None:
        return
    point, normal, _, distance = surface.find_nearest(vertex.co)
    delta = vertex.co - point
    signed = delta.dot(normal)
    if amount > 0 and signed > 0 and distance > ease:
        vertex.co -= delta * (amount * min(max_pull, distance - ease) / distance)
    elif min_ease is not None and signed < min_ease:
        vertex.co = point + normal * min_ease


def covered_skin(base, cloth):
    """Find skin safely under a shirt/top in the neutral pose. An armpit or
    shoulder can cross the sleeve once an arm bends or reaches, so posed face
    normals alone miss it."""
    shell = BVHTree.FromBMesh(cloth)
    edges = [v for v in cloth.verts if v.is_boundary]
    openings = KDTree(len(edges)) if edges else None
    if openings:
        for i, v in enumerate(edges):
            openings.insert(v.co, i)
        openings.balance()
    groups = {g.index for g in base.vertex_groups if g.name.startswith(('spine_', 'clavicle_', 'upperarm_'))}
    hidden = []
    for v, point in zip(base.data.vertices, garments._shape(base)):
        if sum(g.weight for g in v.groups if g.group in groups) < .35:
            continue
        hit, normal, _, distance = shell.find_nearest(point, .052)
        if hit is None or (point - hit).dot(normal) > .0035:
            continue
        # Keep the skin around every opening (neckline, sleeve cuffs, waist hem).
        if not openings or openings.find(hit)[2] > .034:
            hidden.append(v.index)
    return hidden


def _leg_axis_point(z, hip, knee, ankle):
    """Piecewise-linear leg centerline from hip -> knee -> ankle."""
    if z >= knee.z:
        span = max(hip.z - knee.z, 1e-4)
        u = max(0., min(1., (z - knee.z) / span))
        return knee.lerp(hip, u)
    span = max(knee.z - ankle.z, 1e-4)
    u = max(0., min(1., (knee.z - z) / span))
    return knee.lerp(ankle, u)


def _smooth_underarms(bm, shoulder, factor=.42, push=.003):
    """Relax pinched underarm gusset quads so raised/reaching arms crease cleanly."""
    underarm = [v for v in bm.verts if not v.is_boundary
                and abs(shoulder.x) * .58 < abs(v.co.x) < abs(shoulder.x) * 1.22
                and shoulder.z - .145 < v.co.z < shoulder.z + .035]
    if underarm:
        bmesh.ops.smooth_vert(bm, verts=underarm, factor=factor,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bm.normal_update()
        for v in underarm:
            v.co += v.normal * push
        bm.normal_update()


def _fit_cargo_pants(bm, surface, rig, joint, has_untucked_top):
    """Transform low-poly cortu_cargo_pants from flared bell-bottom ruffles into
    clean, straight/tapered modern work cargo trousers with crisp cuffs."""
    pelvis, waist = joint('pelvis'), joint('spine_01')
    hip_l, knee_l, ankle_l = joint('thigh_l'), joint('calf_l'), joint('foot_l')
    hip_r, knee_r, ankle_r = joint('thigh_r'), joint('calf_r'), joint('foot_r')
    hem_floor = min(ankle_l.z, ankle_r.z) - .015

    # Smooth two-stage subdivision erases the faceted vertical ridges of the raw 196-poly mesh.
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, smooth=.35, use_grid_fill=True)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, smooth=.22, use_grid_fill=True)
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(3):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=.34,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()

    # Taper & circularize the flared lower legs/ankles and clean the waist + seat.
    for v in bm.verts:
        x, y, z = v.co
        # 1. Clean waistband under untucked polo/shirt so it never clips or bulges out.
        if z > waist.z - .075:
            w = ramp(waist.z - .075, waist.z - .015, z)
            take_in(v, surface, .0045 if has_untucked_top else .006, .82 * w, max_pull=.035, min_ease=.0035)
        # 2. Lift any hem verts hanging below the shoe collar cleanly up to hem_floor.
        if z < hem_floor + .045:
            low_w = 1 - ramp(hem_floor, hem_floor + .045, z)
            if v.co.z < hem_floor:
                v.co.z = hem_floor + (v.co.z - hem_floor) * .15
            elif low_w > 0:
                v.co.z = max(v.co.z, hem_floor + .004 * (1 - low_w))
        # 3. Eliminate the 90mm corrugated bell-bottom flare below the knee.
        hip, knee, ankle = (hip_l, knee_l, ankle_l) if x >= 0 else (hip_r, knee_r, ankle_r)
        if z < knee.z - .03:
            c = _leg_axis_point(v.co.z, hip, knee, ankle)
            dx, dy = v.co.x - c.x, v.co.y - c.y
            r = math.hypot(dx, dy)
            u = max(0., min(1., (knee.z - v.co.z) / max(knee.z - ankle.z, .1)))
            # Straight-tapered cargo profile: ~78mm at knee tapering smoothly to ~61mm at cuff.
            r_cap = .079 - .018 * u
            r_floor = .052 - .006 * u
            if r > 1e-4:
                if r > r_cap:
                    new_r = r_cap + (r - r_cap) * .12
                elif r < r_floor:
                    new_r = r_floor
                else:
                    # Gently blend toward a clean elliptical cuff to remove vertical accordion flutes.
                    blend = .52 * ramp(.15, .85, u)
                    target = .070 - .012 * u
                    new_r = r * (1 - blend) + target * blend
                scale = new_r / r
                v.co.x = c.x + dx * scale
                v.co.y = c.y + dy * scale
            # Keep comfortable clearance over shin/ankle skin & sock area.
            take_in(v, surface, .016 - .004 * u, .45 * ramp(.1, .8, u), max_pull=.028, min_ease=.009)
        elif z < pelvis.z + .02:
            # Tidy loose crotch/seat sag while keeping relaxed cargo fit.
            if y > .01 and z < hip.z + .01:
                take_in(v, surface, .014, .55, max_pull=.026, min_ease=.007)
            elif abs(x) < .065 and z < hip.z:
                take_in(v, surface, .015, .55, max_pull=.025, min_ease=.007)

    # Smooth the lower leg cuff so transitions are silky, then add subtle natural trouser break.
    lower = [v for v in bm.verts if v.co.z < knee_l.z + .02]
    for _ in range(2):
        bmesh.ops.smooth_vert(bm, verts=lower, factor=.30,
                              use_axis_x=True, use_axis_y=True, use_axis_z=False)
    bm.normal_update()
    for v in bm.verts:
        x, y, z = v.co
        side = 1 if x > 0 else -1
        across = abs(x) - abs(knee_l.x)
        drape = 0.
        for center, tilt, size, spread in [
            (knee_l.z + .035, .40, .0030, .022),
            (knee_l.z - .035, -.32, .0025, .020),
            (ankle_l.z + .055, .25, .0030, .022),
        ]:
            drape += size * math.exp(-((z - center - tilt * across - .008 * side) / spread) ** 2)
        v.co += v.normal * drape
    bm.normal_update()


def _fit_wool_pants(bm, surface, rig, joint, has_untucked_top):
    """Eliminate the 58mm hanging diaper-like under-butt/crotch void and lumpy
    rings on toigo_wool_pants, sculpting a clean, flattering tailored-trouser silhouette."""
    pelvis, waist = joint('pelvis'), joint('spine_01')
    hip_l, knee_l, ankle_l = joint('thigh_l'), joint('calf_l'), joint('foot_l')
    hip_r, knee_r, ankle_r = joint('thigh_r'), joint('calf_r'), joint('foot_r')
    hem_floor = min(ankle_l.z, ankle_r.z) - .014

    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bm.normal_update()

    for v in bm.verts:
        x, y, z = v.co
        hip, knee, ankle = (hip_l, knee_l, ankle_l) if x >= 0 else (hip_r, knee_r, ankle_r)

        # 1. Clean tailored waistband (snug whether shirt is tucked or untucked).
        if z > pelvis.z + .035:
            w = ramp(pelvis.z + .035, waist.z, z)
            ease = .0045 if has_untucked_top else .0055
            take_in(v, surface, ease, .82 * w, max_pull=.035, min_ease=.0035)

        # 2. Upper & mid glutes (back y > 0): follow the actor's natural curve cleanly.
        if y > .005 and hip.z - .015 <= z <= pelvis.z + .065:
            w = ramp(.005, .055, y)
            take_in(v, surface, .0075, .86 * w, max_pull=.042, min_ease=.005)

        # 3. Under-butt / gluteal fold -> upper back thigh: remove the 58mm flat/diaper drop!
        if y > 0. and hip.z - .16 <= z <= hip.z + .015:
            band = ramp(hip.z - .16, hip.z - .09, z) * (1 - ramp(hip.z - .02, hip.z + .015, z))
            back_w = ramp(0., .045, y)
            take_in(v, surface, .0095, .92 * max(band, .55) * back_w, max_pull=.058, min_ease=.0055)

        # 4. Crotch / inner upper thigh: lift the sagging center seat so standing & seated stay sleek.
        if abs(x) < .085 and hip.z - .17 <= z <= hip.z + .025:
            cx_w = 1 - ramp(.035, .085, abs(x))
            take_in(v, surface, .0095, .88 * cx_w, max_pull=.055, min_ease=.0055)

        # 5. Front & outer hip + upper thigh: clean tailored fit without puffiness.
        if hip.z - .18 <= z <= pelvis.z + .05:
            take_in(v, surface, .0105, .72, max_pull=.038, min_ease=.0055)

        # 6. Mid-thigh down to ankle: crisp straight/slim-tapered trouser drape that clears shoe collars cleanly.
        if z < hip.z - .12:
            u = max(0., min(1., (hip.z - .12 - z) / max(hip.z - .12 - ankle.z, .2)))
            # Keep tailored taper through calf, then open slightly at the cuff (bottom 9 cm) to clear sneakers/flats.
            cuff_open = ramp(ankle.z + .10, ankle.z - .01, z)
            ease = .012 - .0015 * u + .0055 * cuff_open
            min_e = .007 + .0065 * cuff_open
            take_in(v, surface, ease, .74 * (1 - .45 * cuff_open), max_pull=.040, min_ease=min_e)

        # 7. Clean level hem just over the shoe collar so flats/sneakers never clip.
        if v.co.z < hem_floor:
            v.co.z = hem_floor + (v.co.z - hem_floor) * .15

    # Smooth out lumpy rings while keeping boundary seams crisp.
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(2):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=.34,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # Re-enforce minimum skin/shoe-collar clearance after smoothing so no calf or sneaker tongue pokes through.
    for v in bm.verts:
        cuff_open = ramp(ankle_l.z + .10, ankle_l.z - .01, v.co.z)
        take_in(v, surface, .006, 0., min_ease=.006 + .0075 * cuff_open)
    bm.normal_update()

    # Subtle tailored cloth break near knee & ankle (replaces old heavy 7-8mm sausage rings).
    for v in bm.verts:
        x, y, z = v.co
        side = 1 if x > 0 else -1
        across = abs(x) - abs(knee_l.x)
        drape = 0.
        for center, tilt, size, spread in [
            (knee_l.z + .035, .42, .0018, .022),
            (knee_l.z - .035, -.34, .0015, .020),
            (ankle_l.z + .055, .25, .0020, .022),
        ]:
            drape += size * math.exp(-((z - center - tilt * across - .007 * side) / spread) ** 2)
        v.co += v.normal * drape
    bm.normal_update()


def _fit_denim_or_suit_bottom(bm, surface, rig, joint, garment, has_untucked_top, full_suit=False):
    """Smooth shin/seat contour, prevent flat upper-seat shelf, and clear shoes/ankles
    on female_casualsuit01 / male_casualsuit* trousers."""
    pelvis, waist = joint('pelvis'), joint('spine_01')
    hip_l, knee_l, ankle_l = joint('thigh_l'), joint('calf_l'), joint('foot_l')
    hip_r, knee_r, ankle_r = joint('thigh_r'), joint('calf_r'), joint('foot_r')
    hem_floor = min(ankle_l.z, ankle_r.z) - .015

    if not full_suit and len(bm.verts) < 2200:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
        bm.normal_update()

    for v in bm.verts:
        x, y, z = v.co
        if full_suit and z > waist.z + .025:
            continue
        hip, knee, ankle = (hip_l, knee_l, ankle_l) if x >= 0 else (hip_r, knee_r, ankle_r)

        # Clean upper waist & hip shelf transition (fixes Yara/Mia wide flat shelf under sweater).
        if z > pelvis.z + .015:
            w = ramp(pelvis.z + .015, waist.z, z)
            ease = .0045 if has_untucked_top else .0055
            take_in(v, surface, ease, .78 * w, max_pull=.026, min_ease=.004)
        # Smooth gluteal under-curve and crotch fit (fixes seated flat/wide bulge on Mia & Fern).
        if y > .005 and hip.z - .14 <= z <= pelvis.z + .05:
            take_in(v, surface, .007, .74, max_pull=.028, min_ease=.0045)
        if abs(x) < .075 and hip.z - .15 <= z <= hip.z + .02:
            take_in(v, surface, .008, .72, max_pull=.026, min_ease=.0045)
        # Clean ankle/calf clearance so shoes (shoes06 / ankle boots) never speckle through hems.
        if z < knee.z - .06:
            cuff_open = ramp(ankle.z + .11, ankle.z - .01, z)
            min_e = .007 + .0085 * cuff_open
            take_in(v, surface, .012 + .004 * cuff_open, .35 * (1 - cuff_open), max_pull=.018, min_ease=min_e)
        if v.co.z < hem_floor:
            v.co.z = hem_floor + (v.co.z - hem_floor) * .2

    seat_and_legs = [v for v in bm.verts if not v.is_boundary and v.co.z < waist.z - .01]
    if seat_and_legs:
        bmesh.ops.smooth_vert(bm, verts=seat_and_legs, factor=.24,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for v in seat_and_legs:
        cuff_open = ramp(ankle_l.z + .11, ankle_l.z - .01, v.co.z)
        min_e = .007 + .0085 * cuff_open if v.co.z < knee_l.z - .06 else .0045
        take_in(v, surface, .005, 0., min_ease=min_e)
    bm.normal_update()

    # Very gentle break right above the ankle only (no lumpy shin waves on slim jeans!).
    for v in bm.verts:
        x, y, z = v.co
        if full_suit and z > waist.z:
            continue
        if z > knee_l.z:
            continue
        side = 1 if x > 0 else -1
        across = abs(x) - abs(knee_l.x)
        drape = .0016 * math.exp(-((z - (ankle_l.z + .055) - .22 * across - .007 * side) / .022) ** 2)
        v.co += v.normal * drape
    bm.normal_update()


def fit(obj, rig, style, garment, base, part=None, has_untucked_top=False):
    style = style or 'default'
    full_suit = garment in SUITS and part is None
    trousers = (garment in ('toigo_wool_pants', 'cortu_cargo_pants', 'toigo_harem_pants')
                or (garment in SUITS and part == 'bottom'))
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
    surface = skin_surface(base)

    if garment == 'cortu_cargo_pants':
        _fit_cargo_pants(bm, surface, rig, joint, has_untucked_top)
        cargo_pockets(bm, joint('thigh_l'), joint('calf_l'))
        covered = []
    elif garment == 'toigo_wool_pants':
        _fit_wool_pants(bm, surface, rig, joint, has_untucked_top)
        covered = []
    elif garment == 'toigo_harem_pants':
        # Keep the relaxed yoga/harem drape on Priya while tidying the upper seat & waist seam.
        pelvis = joint('pelvis')
        for v in bm.verts:
            if v.co.z > pelvis.z + .02:
                take_in(v, surface, .006, .75 * ramp(pelvis.z + .02, waist.z, v.co.z), max_pull=.025, min_ease=.004)
        bm.normal_update()
        covered = []
    elif trousers:
        _fit_denim_or_suit_bottom(bm, surface, rig, joint, garment, has_untucked_top, full_suit=False)
        covered = []
    elif full_suit:
        # Full one-piece suit (e.g. Fern's jeans+tee, Hale/Omar/Leo/Eli casual suits):
        # refine trouser seat/ankles + smooth underarms + close shirt-to-pants waist gap.
        _fit_denim_or_suit_bottom(bm, surface, rig, joint, garment, has_untucked_top=False, full_suit=True)
        # On female_casualsuit01, extend the tee's lower hem slightly downward & outward so it overlaps
        # the jeans waistband cleanly with zero bare-skin strip across the lower back/hips.
        if garment == 'female_casualsuit01':
            # Separate top connected component(s) sitting above the jeans waistband
            seen = set()
            for start in bm.verts:
                if start.index in seen:
                    continue
                comp, stack = [], [start]
                seen.add(start.index)
                while stack:
                    cur = stack.pop()
                    comp.append(cur)
                    for e in cur.link_edges:
                        nxt = e.other_vert(cur)
                        if nxt.index not in seen:
                            seen.add(nxt.index)
                            stack.append(nxt)
                if len(comp) >= 200 and (sum(v.co.z for v in comp) / len(comp)) > waist.z:
                    top_lo = min(v.co.z for v in comp)
                    for v in comp:
                        if v.co.z < top_lo + .075:
                            w = 1 - ramp(top_lo, top_lo + .075, v.co.z)
                            v.co.z -= .024 * w
                            v.co += v.normal * (.005 * w)
        for v in bm.verts:
            if waist.z - .02 <= v.co.z <= waist.z + .065:
                take_in(v, surface, .005, 0., min_ease=.0055)
        _smooth_underarms(bm, shoulder, factor=.32, push=.0025)
        covered = covered_skin(base, bm)
    else:
        # Tops: polo, tucked t-shirt, female tee, male tee, fisherman sweater.
        if len(bm.verts) < 4000:
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
            bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=.18,
                                  use_axis_x=True, use_axis_y=True, use_axis_z=True)
            bm.normal_update()

        sleeves = {}
        if not knitted:
            for side in ('l', 'r'):
                origin = joint('upperarm_' + side)
                axis = (joint('lowerarm_' + side) - origin).normalized()
                arm_dots = [(v.co - origin).dot(axis) for v in bm.verts
                            if v.co.x * origin.x > 0 and abs(v.co.x) > abs(origin.x)]
                reach = max(arm_dots) if arm_dots else .25
                sleeves[side] = (origin, axis, reach)

        hem_z = min(v.co.z for v in bm.verts)
        close_tee = style in ('edit', 'breton')
        body_hem = min((v.co.z for v in bm.verts if abs(v.co.x) < abs(shoulder.x) * .78), default=hem_z)

        for v in bm.verts:
            x, y, z = v.co
            if knitted:
                sleeve = ramp(.78, 1.35, abs(x / shoulder.x))
                lower_body = 1 - ramp(waist.z + .08, chest.z + .05, z)
                take_in(v, surface, .006 + .005 * (1 - sleeve),
                        .84 * sleeve + .58 * (1 - sleeve) * lower_body, min_ease=.005)
                side = ramp(.38, .84, abs(x / shoulder.x)) * (1 - sleeve)
                depth = z - body_hem - .040 - .12 * x
                v.co += v.normal * (.002 * side * math.exp(-(depth / .021) ** 2))
            else:
                above = ramp(waist.z - .015, waist.z + .10, z)
                below = 1 - ramp(chest.z + .05, shoulder.z, z)
                trunk = 1 - ramp(abs(shoulder.x) * .86, abs(shoulder.x) * 1.24, abs(x))
                a = math.atan2(y, x)
                fan = (.5 + .5 * math.cos(6 * a + 6.5 * (z - waist.z) + .6 * math.sin(3 * a))) ** 2
                fullness = .016 if style == 'studio' else (.010 if polo else .012)
                ease = above * below * trunk * (.004 + fullness * fan)
                gather = math.exp(-((z - waist.z - .093 - .28 * x - .016 * math.cos(3 * a)) / .016) ** 2)
                origin, axis, reach = sleeves['l' if x * shoulder.x > 0 else 'r']
                along = (v.co - origin).dot(axis)
                cuff = 0.
                if along > .045 and abs(x) > abs(origin.x):
                    width = .024 if polo else {'studio': .028, 'edit': .019, 'home': .022, 'breton': .018}.get(style, .021)
                    distance = reach - along
                    cuff = .0038 * math.exp(-((distance - width) / .006) ** 2)
                    cuff += .0028 * ramp(0, .006, distance) * (1 - ramp(width - .004, width + .004, distance))
                    if polo:
                        # Subtle knitted rib welt instead of bulky doughnut bump.
                        cuff += .0032 * math.exp(-((distance - width - .018) / .016) ** 2)
                if polo:
                    depth = z - hem_z - .010 * abs(math.sin(a))
                    seam = .0035 * math.exp(-((depth - .022) / .010) ** 2)
                    folds = .007 * math.exp(-((depth - .085 - .28 * y) / .024) ** 2)
                    # Clean clearance along lower hem so the polo drapes cleanly over the cargo waistband.
                    hem_clear = .0065 * (1 - ramp(hem_z + .005, hem_z + .075, z))
                    ease += trunk * (seam + folds * abs(math.cos(a)) ** 4 + hem_clear)
                waist_fold = .0045 * gather * trunk * (.35 + .65 * abs(math.sin(a)))
                if close_tee:
                    take_in(v, surface, .005, .80 * trunk * (1 - ramp(chest.z, chest.z + .08, z)), min_ease=.0045)
                    ease = .16 * ease * abs(math.cos(a)) ** 2
                    waist_fold *= .18 * abs(math.cos(a)) ** 2
                    cuff *= .55
                v.co += v.normal * (ease + waist_fold + cuff)
                # Prevent chest/torso/armpit skin from poking through untucked tops.
                take_in(v, surface, .005, 0., min_ease=.0055 if polo else .0045)

        bm.normal_update()
        if (style == 'breton' and garment == 'toigo_basic_tucked_t-shirt') or (style == 'commons' and knitted):
            shape_neckline(bm, shoulder)
        # Smooth underarms across all tops so lifted/reaching arms crease smoothly without clipping.
        _smooth_underarms(bm, shoulder, factor=.44 if garment == 'joepal_crude_t-shirt_female' else .34,
                          push=.0035 if garment == 'joepal_crude_t-shirt_female' else .0028)
        if style == 'studio':
            sew_studio_panels(bm, shoulder, chest, waist)
        if polo and style == 'workshop':
            workshop_pocket(bm, shoulder, chest)
        # Hide neutral-pose covered torso/armpit skin under every fitted top so arms & chests never clip.
        covered = covered_skin(base, bm)

    bm.transform(world.inverted())
    bm.to_mesh(fitted)
    bm.free()
    obj.modifiers.clear()
    obj.data = fitted
    obj.modifiers.new('Tailored fabric', 'ARMATURE').object = rig
    return covered
