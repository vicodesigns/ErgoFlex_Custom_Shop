"""A close tapered crop fitted to the actor's shaped scalp before posing."""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

import garments


def fibre_texture(out_dir, model):
    from coil_texture import pixels
    rgba = pixels()
    height, width = rgba.shape[:2]
    image = bpy.data.images.new('Cropped coils', width, height, alpha=True)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(Path(out_dir, 'tex', model + '-cropped-coils.png'))
    image.file_format = 'PNG'
    image.save()
    return image


def cropped_coils(hair, base, rig, out_dir, model):
    shape = garments._shape(base)
    helpers = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    faces = [tuple(p.vertices) for p in base.data.polygons if not any(i in helpers for i in p.vertices)]
    scalp = BVHTree.FromPolygons(shape, faces)
    weights = garments._weights(base)
    head = [shape[i] for i in {v for f in faces for v in f} if weights[i].get('head', 0) > .8]
    crown = max(p.z for p in head)
    center = Vector((0., (max(p.y for p in head) + min(p.y for p in head)) * .5, crown - .105))
    rings, columns = 48, 160
    points, quads, tex = [], [], []
    # Elevation of the hairline from the forehead back around an ear to the nape.
    angles = [0, .43, .8, 1.05, 1.25, 1.54, 1.80, 2.20, math.pi]
    edges = [.34, .34, .25, -.09, -.18, -.01, -.09, -.38, -.51]
    for i in range(rings):
        t = i / rings
        for j in range(columns):
            a = math.tau * j / columns
            edge = np.interp(min(a, math.tau - a), angles, edges) + .014 * math.sin(7 * a)
            elevation = edge + (math.pi / 2 - edge) * t
            ray = Vector((math.sin(a) * math.cos(elevation), -math.cos(a) * math.cos(elevation), math.sin(elevation)))
            # From inside out, so the side of the crop passes under the ear.
            hit, _, _, _ = scalp.ray_cast(center, ray, .35)
            if hit is None:
                raise ValueError('Missing scalp for cropped hair')
            taper = min(1., t / .14)
            curl = noise.noise(hit * 245, noise_basis='PERLIN_ORIGINAL')
            length = taper * (.003 + .012 * t + (.001 + .002 * t) * curl)
            points.append(hit + ray * (length - .0007 * (1 - taper)))
    points.append(Vector((center.x, center.y, scalp.ray_cast(center, Vector((0, 0, 1)), .35)[0].z + .015)))
    pole = len(points) - 1
    for i in range(rings):
        for j in range(columns):
            right = (j + 1) % columns
            corners = [i * columns + j, i * columns + right]
            u, v = j / columns, i / rings
            coords = [(u, v), (u + 1 / columns, v)]
            if i + 1 == rings:
                corners.append(pole)
                coords.append((u + 0.5 / columns, 1))
            else:
                corners.extend([(i + 1) * columns + right, (i + 1) * columns + j])
                coords.extend([(u + 1 / columns, v + 1 / rings), (u, v + 1 / rings)])
            quads.append(corners)
            tex.extend(coords)
    mesh = bpy.data.meshes.new('Tapered coils')
    local = hair.matrix_world.inverted()
    mesh.from_pydata([local @ p for p in points], [], quads)
    uv = mesh.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray(tex, dtype=np.float32).ravel())
    for face in mesh.polygons:
        face.use_smooth = True
    mat = bpy.data.materials.new('Human.cropped_coil_hair')
    mat.use_nodes = True
    mat['alpha'] = 'MASK'
    mat['cutoff'] = .32
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .87
    bsdf.inputs['Specular IOR Level'].default_value = .20
    strand = mat.node_tree.nodes.new('ShaderNodeTexImage')
    strand.image = fibre_texture(out_dir, model)
    mat.node_tree.links.new(strand.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(strand.outputs['Alpha'], bsdf.inputs['Alpha'])
    mesh.materials.append(mat)
    hair.modifiers.clear()
    hair.data = mesh
    hair.vertex_groups.clear()
    hair.vertex_groups.new(name='head').add(range(len(points)), 1., 'REPLACE')
    hair.modifiers.new('Fitted crop', 'ARMATURE').object = rig


def strand_colour(source, save_copy):
    """Break up the broad painted highlight with fibres that follow the UV locks."""
    # These cuts use long vertical strips of hair. Work at delivery resolution
    # so the variation survives WebP and mipmapping.
    image = source.copy()
    image.scale(1024, 1024)
    pixels = np.empty((1024, 1024, 4), dtype=np.float32)
    image.pixels.foreach_get(pixels.ravel())
    rgb = pixels[:, :, :3]
    solid = pixels[:, :, 3] > .85
    light = rgb.mean(axis=2)
    row = (light * solid).sum(axis=1) / np.maximum(1, solid.sum(axis=1))
    average = light[solid].mean()
    level = np.clip(average / np.maximum(row, .001), .64, 1.45)
    y, x = np.mgrid[:1024, :1024]
    drift = 2.8 * np.sin(.008 * y + .018 * x) + 1.1 * np.sin(.021 * y - .011 * x)
    fibre = x + drift
    rng = np.random.default_rng(421)
    noise = rng.normal(0, 1, 1024)
    thread = np.interp(fibre % 1024, np.arange(1024), noise, period=1024)
    lock = np.sin(.096 * fibre + 1.3 * np.sin(.017 * fibre))
    rgb *= (level[:, None] ** .55 * np.clip(1 + .105 * thread + .095 * lock, .66, 1.38))[:, :, None]
    result = save_copy(image, pixels.ravel(), '_combed')
    bpy.data.images.remove(image)
    return result


def comb_layers(hair, rig, cut):
    """Soften the existing locks, retaining their painted UVs and bone weights."""
    # Subdivide the fitted cards before posing. The open ends retain their
    # corners so wisps keep the outline drawn by the original alpha texture.
    smooth = hair.modifiers.new('Smooth hair layers', 'SUBSURF')
    smooth.levels = 1
    smooth.render_levels = 1
    smooth.boundary_smooth = 'PRESERVE_CORNERS'
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(hair.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    world, local = hair.matrix_world, hair.matrix_world.inverted()
    points = [world @ v.co for v in mesh.vertices]
    low, high = min(v.z for v in points), max(v.z for v in points)
    mid_y = (max(v.y for v in points) + min(v.y for v in points)) * .5
    for vertex, p in zip(mesh.vertices, points):
        depth = (high - p.z) / (high - low)
        fall = depth * depth * (3 - 2 * depth)
        angle = math.atan2(p.x, mid_y - p.y)
        # Group the ends into soft, unequal locks; the part stays anchored.
        if cut == 'bob':
            wave = .006 * math.sin(7 * angle + 2 * depth) - .006 * depth
            p.y += .012 * fall * max(0., math.sin(angle))
        elif cut == 'braid':
            # Move whole cross-sections together to preserve the interleaved
            # plait. The nape stays fixed and the free length arcs off centre.
            drop = max(0., (depth - .32) / .68)
            p.x += .033 * drop * drop - .012 * math.sin(math.pi * drop)
            p.y += .012 * drop
            vertex.co = local @ p
            continue
        else:
            wave = .009 * math.sin(5 * angle + 3 * depth) + .003 * math.cos(9 * angle - depth)
            p.y += .022 * fall * max(0., math.sin(angle))
        p.x += math.sin(angle) * wave * fall
        p.y -= math.cos(angle) * wave * fall
        p.z += .004 * fall * math.cos(6 * angle)
        vertex.co = local @ p
    hair.modifiers.clear()
    hair.data = mesh
    hair.modifiers.new('Combed hair', 'ARMATURE').object = rig


def _long_wave_texture(out_dir, model):
    from long_wave_texture import pixels
    rgba = pixels()
    height, width = rgba.shape[:2]
    image = bpy.data.images.new('Layered long hair', width, height, alpha=True)
    image.pixels.foreach_set(rgba.ravel())
    tex_path = Path(out_dir, 'tex', model + '--layered-long-hair.png')
    tex_path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(tex_path)
    image.file_format = 'PNG'
    image.save()
    return image


def _smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / max(1e-6, edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def _hair_bone_weights(p, z_head, z_neck, z_shoulder):
    """Graduated multi-bone skin weights so head turns/tilts drape lower lengths naturally over the shoulders."""
    # Crown, part, and upper face-framing locks follow the head rigidly.
    if p.z >= z_head - 0.020:
        return {'head': 1.0}
    # Neck transition zone: head -> neck_01
    if p.z >= z_neck + 0.005:
        t = _smoothstep(z_head - 0.020, z_neck + 0.005, p.z)
        return {'head': 1.0 - t, 'neck_01': t}
    # Shoulder / collar transition: neck_01 -> spine_03 (+ subtle clavicle on outer shoulder locks)
    if p.z >= z_shoulder - 0.035:
        t = _smoothstep(z_neck + 0.005, z_shoulder - 0.035, p.z)
        w_neck = 1.0 - t
        w_body = t
        w_clav = w_body * 0.28 * _smoothstep(0.065, 0.145, abs(p.x))
        w_spine3 = w_body - w_clav
        out = {}
        if w_neck > 1e-4:
            out['neck_01'] = w_neck
        if w_spine3 > 1e-4:
            out['spine_03'] = w_spine3
        if w_clav > 1e-4:
            out['clavicle_l' if p.x > 0 else 'clavicle_r'] = w_clav
        return out
    # Lower mid-back / chest lengths stay anchored smoothly to upper torso.
    t_low = 0.25 * _smoothstep(z_shoulder - 0.035, z_shoulder - 0.140, p.z)
    return {'spine_03': 1.0 - t_low, 'spine_02': t_low}


def layered_long_hair(hair, base, cloth_objs, rig, out_dir, model):
    """Replace the flat long01 shell with a sleek, AAA guide-shell layered hair-card groom.

    Builds a smooth sculpted guide surface hugging Yara's scalp, neck, and tailored sweater
    (matching the sleek crown volume of the original silhouette while eliminating the flat cape),
    lays three concentric non-intersecting tiers of sculpted wavy hair cards onto that surface,
    and blends smooth guide-surface normals onto every vertex so light wraps like real brushed hair.
    """
    shape = garments._shape(base)
    helpers = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    base_faces = [tuple(p.vertices) for p in base.data.polygons if not any(i in helpers for i in p.vertices)]
    scalp_bvh = BVHTree.FromPolygons(shape, base_faces)

    # Combined collision BVH of body + tailored sweater torso/collar ONLY (excluding outstretched T-pose arms
    # so side hair cascades naturally down the shoulders & back instead of flaring out over the upper arms!).
    obs_verts = [v.copy() for v in shape]
    obs_faces = [f for f in base_faces if max(abs(shape[vi].x) for vi in f) < 0.195]
    deps = bpy.context.evaluated_depsgraph_get()
    for cobj in cloth_objs:
        me = bpy.data.meshes.new_from_object(cobj.evaluated_get(deps), preserve_all_data_layers=False, depsgraph=deps)
        off = len(obs_verts)
        mw = cobj.matrix_world
        cpts = [mw @ v.co for v in me.vertices]
        obs_verts.extend(cpts)
        # Keep collar, neck, shoulders, and torso; exclude outer T-pose sleeves (|x| >= 0.195)
        obs_faces.extend(tuple(off + vi for vi in p.vertices) for p in me.polygons
                         if max(abs(cpts[vi].x) for vi in p.vertices) < 0.195)
        bpy.data.meshes.remove(me)
    obs_bvh = BVHTree.FromPolygons(obs_verts, obs_faces)

    weights_base = garments._weights(base)
    head_pts = [shape[i] for i in {v for f in base_faces for v in f} if weights_base[i].get('head', 0) > 0.8]
    crown_z = max(p.z for p in head_pts)
    head_y_mid = (max(p.y for p in head_pts) + min(p.y for p in head_pts)) * 0.5
    head_center = Vector((0.0, head_y_mid + 0.008, crown_z - 0.104))

    joint = lambda name: rig.matrix_world @ rig.data.bones[name].head_local
    z_head = joint('head').z
    z_neck = joint('neck_01').z
    z_shoulder = joint('upperarm_l').z

    def _ray_scalp(az, elev):
        ray = Vector((math.sin(az) * math.cos(elev), -math.cos(az) * math.cos(elev), math.sin(elev)))
        hit, _, _, _ = scalp_bvh.ray_cast(head_center, ray, 0.35)
        return (hit if hit is not None else head_center + ray * 0.090), ray

    def _short_angle_lerp(a0, a1, t):
        d = (a1 - a0 + math.pi) % math.tau - math.pi
        return a0 + d * t

    def push_outside(p, min_clear, side_sign=0.0):
        """Keep point p cleanly outside head/neck/torso sweater and away from forehead/eyes."""
        # Open-face protection: sweep cleanly past temples and cheeks, never over eyes/brows.
        if p.y < -0.052 and 1.335 < p.z < 1.495:
            top_t = _smoothstep(1.455, 1.498, p.z)
            min_x = (0.075 if p.z > 1.385 else 0.068) * (1.0 - 0.85 * top_t)
            if abs(p.x) < min_x:
                sgn = side_sign if side_sign != 0.0 else (1.0 if p.x >= 0.0 else -1.0)
                p = Vector((sgn * min_x, max(p.y, -0.098), p.z))

        # Generous cushion over the knit sweater collar & upper back so ribs never poke through.
        eff_clear = min_clear + 0.009 * _smoothstep(z_neck + 0.035, z_neck - 0.030, p.z)

        # Outward ray from spine centerline ONLY pushes points that actually lie inside or within 2.5cm of the torso.
        axis_ref = Vector((0.0, head_center.y if p.z > z_neck + 0.03 else -0.015, p.z))
        rdir = p - axis_ref
        rlen = rdir.length
        if rlen > 1e-4:
            rdir_n = rdir / rlen
            rhit, _, _, rdist = obs_bvh.ray_cast(axis_ref, rdir_n, rlen + 0.025)
            if rhit is not None and rdist + eff_clear > rlen:
                p = axis_ref + rdir_n * (rdist + eff_clear)

        # Nearest surface check (only within 4cm) handles vertical collar rims and shoulder tops cleanly.
        hit, nrm, _, _ = obs_bvh.find_nearest(p, 0.040)
        if hit is not None:
            outward = hit - axis_ref
            if outward.length < 1e-5:
                outward = Vector((0.0, 1.0, 0.0))
            else:
                outward.normalize()
            if nrm.dot(outward) < 0.0:
                nrm = -nrm
            if (p - hit).dot(nrm) < eff_clear:
                p = hit + nrm * eff_clear
        return p

    points = []
    quads = []
    uvs = []
    v_weights = []
    guide_normals = []

    # ---- 1. Tightly recessed scalp under-cap (UV Col 3: u in [0.755, 0.995]) --------------------
    # Hugs 0.4mm off the skull strictly underneath the crown cards so it NEVER peeks above the crown
    # silhouette or across her forehead, while preventing bright skin showing through the parting line.
    rings, cols = 20, 64
    angles_ref = [0.0, 0.35, 0.72, 1.08, 1.38, 1.65, 1.98, 2.40, math.pi]
    edges_ref = [0.68, 0.62, 0.44, 0.16, 0.04, 0.06, -0.08, -0.32, -0.46]
    cap_start = len(points)
    for i in range(rings):
        t = i / rings
        for j in range(cols):
            a = math.tau * j / cols
            edge = float(np.interp(min(a, math.tau - a), angles_ref, edges_ref))
            elev = edge + (math.pi * 0.5 - edge) * t
            hit, ray = _ray_scalp(a, elev)
            lift = 0.0003 + 0.0005 * _smoothstep(0.0, 0.30, t)
            points.append(hit + ray * lift)
            v_weights.append({'head': 1.0})
            guide_normals.append(ray.copy())
    top_hit, _ = _ray_scalp(0.0, math.pi * 0.5)
    cap_pole = len(points)
    points.append(Vector((head_center.x, head_center.y, top_hit.z + 0.0008)))
    v_weights.append({'head': 1.0})
    guide_normals.append(Vector((0.0, 0.0, 1.0)))

    u_c0, u_c1 = 0.755, 0.995
    for i in range(rings):
        v0, v1 = i / rings, (i + 1) / rings
        for j in range(cols):
            jn = (j + 1) % cols
            u0 = u_c0 + (u_c1 - u_c0) * (j / cols)
            u1 = u_c0 + (u_c1 - u_c0) * ((j + 1) / cols)
            a0 = cap_start + i * cols + j
            a1 = cap_start + i * cols + jn
            if i + 1 == rings:
                quads.append([a0, a1, cap_pole])
                uvs.extend([(u0, v0), (u1, v0), (0.5 * (u0 + u1), 1.0)])
            else:
                b1 = cap_start + (i + 1) * cols + jn
                b0 = cap_start + (i + 1) * cols + j
                quads.append([a0, a1, b1, b0])
                uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

    # ---- 2. Sculpted guide-shell concentric hair-card builder -----------------------------------
    # Every card follows ONE smooth sleek guide surface S(fall_az, s), offset cleanly by tier
    # (0mm at root -> tier_offset along mid/ends) so cards NEVER randomly stab through each other.
    rng = np.random.default_rng(7713)
    part_x = -0.010  # clean, natural slightly-off-center part

    def _u_hemline(fall_az, lift=0.0):
        """Sleek long U-shaped salon cut: lower-mid-back (~1.02m) curving gracefully to ~1.18m at sides."""
        back_factor = 0.5 * (1.0 - math.cos(fall_az))
        return 1.195 - 0.175 * (back_factor ** 0.85) + lift

    # Smooth harmonic wave field around azimuth so adjacent locks flow together gracefully
    def _wave_phase(az):
        return 2.4 * math.sin(az * 2.0 + 0.5) + 1.1 * math.cos(az * 3.0 - 0.3)

    def add_card(fall_az, z_tip, width, tier_offset, col_idx, part_py,
                 front_drape=0.0, wave_amp=0.0045, wave_freq=1.05, phase_jit=0.0,
                 tip_curl=0.007, n_segs=22, flip_u=False, start_elev=None):
        """Generate one sleek, smooth-normal, concentric-tier wavy hair ribbon."""
        side_sign = 1.0 if math.sin(fall_az) >= 0 else -1.0
        fall_dir = Vector((math.sin(fall_az), -math.cos(fall_az), 0.0)).normalized()
        tan_dir = Vector((math.cos(fall_az), math.sin(fall_az), 0.0)).normalized()

        if start_elev is not None:
            p_root, r_nrm = _ray_scalp(fall_az, start_elev)
            root_az = fall_az
            root_elev = start_elev
        else:
            # Root right on the clean parting arc (reaching all the way forward to the forehead hairline!)
            px = part_x + side_sign * 0.0025
            ray_p = (Vector((px, part_py, crown_z + 0.055)) - head_center).normalized()
            hit_p, _, _, _ = scalp_bvh.ray_cast(head_center, ray_p, 0.35)
            p_root = hit_p if hit_p is not None else Vector((px, part_py, crown_z - 0.008))
            r_nrm = (p_root - head_center).normalized()
            root_az = math.atan2(r_nrm.x, -r_nrm.y) % math.tau
            root_elev = math.asin(max(-0.99, min(0.99, r_nrm.z)))

        wrap_end_s = 0.36 if start_elev is None else 0.26
        exit_elev = -0.22
        p_exit_surf, exit_ray = _ray_scalp(fall_az, exit_elev)
        # Sleek skull-hugging crown volume (3.5-9.5 mm off scalp — matches BEFORE's graceful silhouette!)
        crown_off = 0.0032 + tier_offset
        p_exit = p_exit_surf + exit_ray * crown_off

        if front_drape > 0.0:
            # Sleek collarbone-framing locks staying neatly inside her shoulder width (never sprawling over arms!)
            tip_x = side_sign * (0.082 + 0.010 * front_drape)
            tip_y = -0.056 - 0.018 * front_drape
        else:
            backness = 0.5 * (1.0 - math.cos(fall_az))
            # Flow smoothly inward off the deltoid slopes down her back in a clean, organic U-cascade
            taper_w = 0.86 - 0.10 * backness
            tip_x = max(-0.112, min(0.112, p_exit.x * taper_w))
            tip_y = max(p_exit.y + 0.020 * (backness ** 0.72), 0.068 * backness + p_exit.y * (1.0 - backness))

        phase0 = _wave_phase(fall_az) + phase_jit
        spine = []
        for k in range(n_segs + 1):
            s = k / n_segs
            if s <= wrap_end_s:
                u_w = s / max(1e-4, wrap_end_s)
                u_sm = u_w * u_w * (3.0 - 2.0 * u_w)
                # Sweep smoothly from the part out over the temples/crown toward fall_az
                az_k = _short_angle_lerp(root_az, fall_az, u_sm ** 0.58)
                el_k = root_elev + (exit_elev - root_elev) * (u_w ** 1.18)
                surf_p, ray_k = _ray_scalp(az_k, el_k)
                # Smoothly rise from 0.5mm at the part to sleek crown_off (zero floating root bumps!)
                off = 0.0005 + (crown_off - 0.0005) * _smoothstep(0.0, 0.35, u_w) + 0.0018 * math.sin(math.pi * u_w)
                p = surf_p + ray_k * off
            else:
                u_d = (s - wrap_end_s) / max(1e-4, 1.0 - wrap_end_s)
                u_xy = _smoothstep(0.0, 0.75, u_d)
                z_k = p_exit.z - (p_exit.z - z_tip) * (u_d ** 1.05)
                x_k = p_exit.x * (1.0 - u_xy) + tip_x * u_xy
                y_k = p_exit.y * (1.0 - u_xy) + tip_y * u_xy
                p = Vector((x_k, y_k, z_k))

            # Gentle, silky salon S-wave below ear level (never frizzy or spiky!)
            w_env = _smoothstep(wrap_end_s * 0.75, min(0.82, wrap_end_s + 0.32), s)
            ph = wave_freq * math.tau * max(0.0, s - 0.22) + phase0
            w_rad = wave_amp * math.sin(ph) * w_env
            w_tan = wave_amp * 0.65 * math.cos(ph + 0.4) * w_env
            curl_env = _smoothstep(0.78, 1.0, s) ** 1.6
            p += fall_dir * (w_rad - tip_curl * 0.45 * curl_env)
            p += tan_dir * (w_tan + side_sign * tip_curl * 0.20 * curl_env)

            if k >= 1:
                min_c = 0.0022 + tier_offset * _smoothstep(0.0, 0.30, s)
                p = push_outside(p, min_c, side_sign=side_sign)
            spine.append(p)

        # Gentle spline smoothing (preserving sleek root & obstacle clearance)
        for _ in range(4):
            nxt = [spine[0]]
            for k in range(1, n_segs):
                q = spine[k - 1] * 0.24 + spine[k] * 0.52 + spine[k + 1] * 0.24
                s = k / n_segs
                min_c = 0.0022 + tier_offset * _smoothstep(0.0, 0.30, s)
                nxt.append(push_outside(q, min_c, side_sign=side_sign))
            nxt.append(push_outside(spine[-1], 0.0022 + tier_offset, side_sign=side_sign))
            spine = nxt

        u_lo = col_idx * 0.25 + 0.004
        u_hi = (col_idx + 1) * 0.25 - 0.004
        if flip_u:
            u_lo, u_hi = u_hi, u_lo
        u_mid = 0.5 * (u_lo + u_hi)

        row_starts = []
        for k in range(n_segs + 1):
            s = k / n_segs
            p = spine[k]
            if k == 0:
                tang = (spine[1] - spine[0]).normalized()
            elif k == n_segs:
                tang = (spine[-1] - spine[-2]).normalized()
            else:
                tang = (spine[k + 1] - spine[k - 1]).normalized()

            # Smooth outward guide-shell normal (spherical on skull, cylindrical down back/shoulders)
            if p.z > z_neck + 0.03:
                shell_n = (p - head_center).normalized()
            else:
                shell_n = Vector((p.x, p.y - (-0.015), 0.10)).normalized()

            out_n = shell_n - tang * shell_n.dot(tang)
            if out_n.length < 1e-5:
                out_n = fall_dir.copy()
            out_n.normalize()

            side_v = tang.cross(out_n)
            if side_v.length < 1e-5:
                side_v = tan_dir.copy()
            side_v.normalize()

            # Sleek root taper -> full body -> gentle tip taper (zero floating crown corners)
            root_t = 0.42 + 0.58 * _smoothstep(0.0, 0.20, s)
            w_prof = root_t * (0.95 + 0.10 * math.sin(math.pi * (s ** 0.75)))
            if s > 0.78:
                w_prof *= 1.0 - 0.18 * _smoothstep(0.78, 1.0, s)
            hw = 0.5 * width * w_prof
            arch = hw * 0.08 * _smoothstep(0.08, 0.30, s)

            p_l = p - side_v * hw - out_n * (arch * 0.4)
            p_m = p + out_n * (arch * 0.6)
            p_r = p + side_v * hw - out_n * (arch * 0.4)

            if k == 0:
                p_l = p - side_v * hw - out_n * 0.0018
                p_r = p + side_v * hw - out_n * 0.0018
            elif k >= 2:
                edge_c = max(0.0018, tier_offset)
                p_l = push_outside(p_l, edge_c, side_sign=side_sign)
                p_r = push_outside(p_r, edge_c, side_sign=side_sign)

            row_starts.append(len(points))
            bw = _hair_bone_weights(p, z_head, z_neck, z_shoulder)
            # Safe blended AAA guide normals: 55% smooth shell normal + 45% ribbon geometric normal
            # (silky continuous sheen across cards with ZERO Cycles shadow-terminator dark rim!)
            base_n = (shell_n * 0.55 + out_n * 0.45).normalized()
            n_l = (base_n - side_v * 0.14).normalized()
            n_m = base_n
            n_r = (base_n + side_v * 0.14).normalized()
            for pt, vn in ((p_l, n_l), (p_m, n_m), (p_r, n_r)):
                points.append(pt)
                v_weights.append(bw)
                guide_normals.append(vn)

        for k in range(n_segs):
            v0 = 1.0 - k / n_segs
            v1 = 1.0 - (k + 1) / n_segs
            r0 = row_starts[k]
            r1 = row_starts[k + 1]
            quads.append([r0, r0 + 1, r1 + 1, r1])
            uvs.extend([(u_lo, v0), (u_mid, v0), (u_mid, v1), (u_lo, v1)])
            quads.append([r0 + 1, r0 + 2, r1 + 2, r1 + 1])
            uvs.extend([(u_mid, v0), (u_hi, v0), (u_hi, v1), (u_mid, v1)])

    # ---- Layer 0A: Back occiput / crown-to-nape inner foundation (22 wide cards, Col 0) ---------
    # Starts smoothly high on the back crown (0.50..0.82) so side profile has zero horizontal seam!
    for i in range(22):
        u_a = (i + 0.5) / 22.0
        fall_az = 1.18 + u_a * (math.tau - 2.36)
        add_card(
            fall_az=fall_az,
            z_tip=_u_hemline(fall_az, lift=rng.uniform(-0.008, 0.015)),
            width=0.060,
            tier_offset=0.0008,
            col_idx=0,
            part_py=0.0,
            wave_amp=0.0032,
            wave_freq=0.95,
            phase_jit=rng.uniform(-0.20, 0.20),
            flip_u=bool(i % 2),
            start_elev=0.50 + 0.30 * (i % 2),
        )

    # ---- Soft front-parting bridge pair (closes the tiny V-notch right at the forehead part) ----
    for side in (-1.0, 1.0):
        faz = 0.80 if side > 0 else (math.tau - 0.80)
        add_card(
            fall_az=faz,
            z_tip=1.225,
            width=0.044,
            tier_offset=0.0028,
            col_idx=0,
            part_py=-0.131,
            front_drape=0.38,
            wave_amp=0.0032,
            wave_freq=0.95,
            phase_jit=0.0,
            flip_u=(side < 0),
        )

    # Keep front-most temple locks sleek over collarbones; the majority flows cleanly behind shoulders.
    # ---- Layer 0B: Full crown-to-ends silky base shell (34 cards, Col 0) ------------------------
    # Roots cleanly from the front forehead hairline (py=-0.128) over the crown to the back (py=+0.024).
    for i in range(34):
        u_a = (i + 0.5) / 34.0
        fall_az = 0.82 + u_a * (math.tau - 1.64)
        part_t = min(1.0, abs(math.pi - fall_az) / (math.pi - 0.82))
        py = -0.128 * (part_t ** 1.05) + 0.024 * (1.0 - part_t ** 1.05)
        front_d = 0.35 if (fall_az < 1.02 or fall_az > math.tau - 1.02) else 0.0
        z_tip = rng.uniform(1.185, 1.235) if front_d > 0 else _u_hemline(fall_az, lift=rng.uniform(-0.010, 0.016))
        add_card(
            fall_az=fall_az,
            z_tip=z_tip,
            width=0.056,
            tier_offset=0.0022,
            col_idx=0,
            part_py=py,
            front_drape=front_d,
            wave_amp=0.0038,
            wave_freq=1.00,
            phase_jit=rng.uniform(-0.22, 0.22),
            flip_u=bool(i % 2),
        )

    # ---- Layer 1: Sculpted mid-body layered wave locks (46 cards, Col 1) ------------------------
    # Smoothly offset +4.2mm outside Layer 0B with graceful coherent S-waves and staggered layers.
    for i in range(46):
        u_a = (i + 0.35) / 46.0
        fall_az = 0.78 + u_a * (math.tau - 1.56)
        part_t = min(1.0, abs(math.pi - fall_az) / (math.pi - 0.78))
        py = -0.130 * (part_t ** 1.05) + 0.025 * (1.0 - part_t ** 1.05)
        front_d = rng.uniform(0.38, 0.55) if (fall_az < 1.00 or fall_az > math.tau - 1.00) else 0.0
        # Natural salon layering: subtle staggered lengths down the back & shoulders
        z_tip = rng.uniform(1.195, 1.255) if front_d > 0 else _u_hemline(fall_az, lift=rng.uniform(0.005, 0.055))
        add_card(
            fall_az=fall_az,
            z_tip=z_tip,
            width=rng.uniform(0.046, 0.056),
            tier_offset=0.0044 + rng.uniform(0.0, 0.0012),
            col_idx=1,
            part_py=py,
            front_drape=front_d,
            wave_amp=rng.uniform(0.0045, 0.0068),
            wave_freq=rng.uniform(1.00, 1.22),
            phase_jit=rng.uniform(-0.28, 0.28),
            tip_curl=rng.uniform(0.007, 0.011),
            flip_u=bool(i % 2),
        )

    # ---- Layer 2: Delicate outer accent locks & soft silhouette breakup wisps (32 cards, Col 2) -
    # Adds soft airy dimension along the face frame, shoulders, and layered mid-back without bulk!
    for i in range(32):
        u_a = (i + 0.5) / 32.0
        fall_az = 0.80 + u_a * (math.tau - 1.60)
        part_t = min(1.0, abs(math.pi - fall_az) / (math.pi - 0.80))
        py = -0.129 * (part_t ** 1.05) + 0.027 * (1.0 - part_t ** 1.05)
        front_d = rng.uniform(0.45, 0.65) if (fall_az < 0.98 or fall_az > math.tau - 0.98) else 0.0
        z_tip = rng.uniform(1.225, 1.295) if front_d > 0 else _u_hemline(fall_az, lift=rng.uniform(0.025, 0.095))
        add_card(
            fall_az=fall_az + rng.uniform(-0.03, 0.03),
            z_tip=z_tip,
            width=rng.uniform(0.036, 0.046),
            tier_offset=0.0066 + rng.uniform(0.0, 0.0016),
            col_idx=2,
            part_py=py,
            front_drape=front_d,
            wave_amp=rng.uniform(0.0052, 0.0080),
            wave_freq=rng.uniform(1.05, 1.30),
            phase_jit=rng.uniform(-0.35, 0.35),
            tip_curl=rng.uniform(0.008, 0.013),
            flip_u=bool(i % 2),
        )

    # ---- Assemble Blender mesh, custom guide-shell normals, UVs, material, & armature weights ---
    mesh = bpy.data.meshes.new('Layered long hair')
    local = hair.matrix_world.inverted()
    local_rot = local.to_3x3()
    mesh.from_pydata([local @ p for p in points], [], quads)
    uv = mesh.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray(uvs, dtype=np.float32).ravel())
    for face in mesh.polygons:
        face.use_smooth = True
    # Apply smooth guide-shell normals so light flows smoothly across overlapping hair cards!
    mesh.normals_split_custom_set_from_vertices([(local_rot @ n).normalized() for n in guide_normals])

    mat = bpy.data.materials.new('Human.layered_long_hair')
    mat.use_nodes = True
    mat['alpha'] = 'MASK'
    mat['cutoff'] = 0.26
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    # Silky natural dark chestnut sheen (Three.js layers anisotropic flow + sheen on top).
    bsdf.inputs['Roughness'].default_value = 0.56
    bsdf.inputs['Specular IOR Level'].default_value = 0.32
    strand = mat.node_tree.nodes.new('ShaderNodeTexImage')
    strand.image = _long_wave_texture(out_dir, model)
    mat.node_tree.links.new(strand.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(strand.outputs['Alpha'], bsdf.inputs['Alpha'])
    mesh.materials.append(mat)

    hair.modifiers.clear()
    hair.data = mesh
    hair.vertex_groups.clear()
    vg_cache = {}
    for vi, wdict in enumerate(v_weights):
        for bname, wval in wdict.items():
            if wval <= 1e-4:
                continue
            vg = vg_cache.get(bname)
            if vg is None:
                vg = hair.vertex_groups.new(name=bname)
                vg_cache[bname] = vg
            vg.add([vi], float(wval), 'REPLACE')
    hair.modifiers.new('Layered waves', 'ARMATURE').object = rig


def drape_hair_over_posed(hair_obj, obstacle_objs, rig):
    """After posing and adding carried gear (e.g. backpack), push lower hair cards cleanly outside."""
    if not obstacle_objs:
        return
    obs_verts = []
    obs_faces = []
    for o in obstacle_objs:
        if o.type != 'MESH' or not len(o.data.polygons):
            continue
        off = len(obs_verts)
        mw = o.matrix_world
        obs_verts.extend(mw @ v.co for v in o.data.vertices)
        obs_faces.extend(tuple(off + vi for vi in p.vertices) for p in o.data.polygons)
    if not obs_faces:
        return
    obs_bvh = BVHTree.FromPolygons(obs_verts, obs_faces)

    z_head = (rig.matrix_world @ rig.data.bones['head'].head_local).z
    z_neck = (rig.matrix_world @ rig.data.bones['neck_01'].head_local).z
    chest = rig.matrix_world @ rig.data.bones['spine_03'].head_local
    neck_p = rig.matrix_world @ rig.data.bones['neck_01'].head_local
    mw = hair_obj.matrix_world
    inv = mw.inverted()
    me = hair_obj.data
    pts = [mw @ v.co for v in me.vertices]

    adj = [[] for _ in range(len(pts))]
    for e in me.edges:
        a, b = e.vertices
        adj[a].append(b)
        adj[b].append(a)

    # 3 smooth push passes + 1 strict final clearance pass using BOTH outward spine-ray & nearest check
    for step in range(4):
        pushed = [False] * len(pts)
        for i, p in enumerate(pts):
            if p.z > z_head - 0.02:
                continue
            # Interpolate body centerline smoothly from chest to neck
            t_z = _smoothstep(chest.z, neck_p.z, p.z)
            ref = Vector((chest.x * (1 - t_z) + neck_p.x * t_z,
                          chest.y * (1 - t_z) + neck_p.y * t_z, p.z))
            clear = 0.0115 if p.z < z_neck + 0.04 else 0.006

            # 1) Outward ray ONLY pushes points that actually lie inside or within 2.5cm of the obstacle
            #    (never shoots past a side lock to hit an upper arm and flare the hair outward!)
            rdir = p - ref
            rlen = rdir.length
            if rlen > 1e-4:
                rdir_n = rdir / rlen
                rhit, _, _, rdist = obs_bvh.ray_cast(ref, rdir_n, rlen + 0.025)
                if rhit is not None and rdist + clear > rlen:
                    p = ref + rdir_n * (rdist + clear)
                    pts[i] = p
                    pushed[i] = True

            # 2) Nearest surface point check (within 3.5cm) handles vertical collar rims & backpack straps
            hit, nrm, _, _ = obs_bvh.find_nearest(p, 0.035)
            if hit is not None:
                out = hit - ref
                if out.length < 1e-5:
                    out = Vector((0.0, 1.0, 0.0))
                else:
                    out.normalize()
                if nrm.dot(out) < 0.0:
                    nrm = -nrm
                if (p - hit).dot(nrm) < clear:
                    pts[i] = hit + nrm * (clear + 0.0015)
                    pushed[i] = True

        if step < 3 and any(pushed):
            nxt = list(pts)
            for i, p in enumerate(pts):
                if p.z > z_head - 0.02 or not adj[i]:
                    continue
                if pushed[i] or any(pushed[nb] for nb in adj[i]):
                    avg = sum((pts[nb] for nb in adj[i]), Vector()) / len(adj[i])
                    nxt[i] = p.lerp(avg, 0.20 if pushed[i] else 0.14)
            pts = nxt

    for v, p in zip(me.vertices, pts):
        v.co = inv @ p
    me.update()
