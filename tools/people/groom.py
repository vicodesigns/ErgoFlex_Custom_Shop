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


def brushed_roots(base, rig, out_dir, model, style):
    """A fitted, head-weighted foundation with fibres swept across the crown or back to the tie."""
    shape = garments._shape(base)
    helpers = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    faces = [tuple(f.vertices) for f in base.data.polygons if not any(i in helpers for i in f.vertices)]
    scalp = BVHTree.FromPolygons(shape, faces)
    weights = garments._weights(base)
    head = [shape[i] for i in {v for f in faces for v in f} if weights[i].get('head', 0) > .8]
    center_y = (min(p.y for p in head) + max(p.y for p in head)) * .5
    center = Vector((0, center_y, max(p.z for p in head) - .105))
    parted = style == 'parted'
    cols, rings = 88, 28
    points, coords, faces = [], [], []
    angles = [0, .48, .84, 1.12, 1.44, 1.72, 2.13, 2.58, math.pi]
    hairline = [.54, .51, .37, .13, -.025, .015, -.34, -.70, -.82]

    def add_point(azimuth, elevation, t):
        ray = Vector((math.sin(azimuth) * math.cos(elevation),
                      -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
        hit = scalp.ray_cast(center + ray * .23, -ray, .21)[0]
        if hit is None:
            raise ValueError('No scalp for ' + model)
        x, y, z = ray
        if parted:
            u, v = .5 + .35*y + .09*abs(x) + .04*x, .5 + .44*x
        else:
            u, v = .5 + .34*x - .16*x*y + .055*math.sin(azimuth)*(1-z), .5 + .44*y
        # The boundary starts under the skin so the temple and nape edges taper into it.
        volume = .004 if parted else .005
        lift = -.0007 + (volume + .0007) * _smoothstep(0, .12, t)
        points.append(hit + ray * lift)
        coords.append((u, v))

    for i in range(rings):
        t = i / rings
        for j in range(cols):
            angle = math.tau * j / cols
            edge = float(np.interp(min(angle, math.tau-angle), angles, hairline))
            edge += .016*math.sin(3*angle+.4) + .008*math.sin(11*angle)
            add_point(angle, edge + (math.pi*.5-edge)*t, t)
    add_point(0, math.pi*.5, 1)
    pole = len(points) - 1
    for i in range(rings):
        for j in range(cols):
            a, b = i*cols + j, i*cols + (j+1) % cols
            faces.append((a, b, pole) if i == rings-1 else (a, b, b+cols, a+cols))

    mesh = bpy.data.meshes.new('Brushed roots')
    mesh.from_pydata(points, [], faces)
    uv = mesh.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray([coords[loop.vertex_index] for loop in mesh.loops], np.float32).ravel())
    for face in mesh.polygons:
        face.use_smooth = True

    height, width = 256, 768
    y, x = np.mgrid[:height, :width]
    drift = 8*np.sin(y*.022 + x*.007) + 3*np.sin(y*.043 - x*.014)
    fibres = np.random.default_rng(431).uniform(-1, 1, width)
    strand = np.interp((x+drift) % width, np.arange(width), fibres, period=width)
    value = .91 + .25*strand + .22*np.cos((x+drift)*.16) + .05*np.sin((x+drift)*.46)
    color = (.11, .067, .042) if parted else (.096, .072, .059)
    pixels = np.ones((height, width, 4), np.float32)
    if parted:
        # The fitted scalp has a single continuous surface across the temples.
        # Paint the fine part and fibres directly in its crown projection.
        u, v = x/(width-1), y/(height-1)
        part = .473 + .018*np.sin(7*u)
        across = v-part
        sweep = x + 290*abs(across)**1.4 + 5*np.sin(12*across+8*u)
        fibres = np.random.default_rng(431).uniform(-1, 1, width)
        strand = np.interp(sweep % width, np.arange(width), fibres, period=width)
        value = .98+.26*strand+.17*np.cos(sweep*.11)+.07*np.sin(sweep*.32)
        root = np.array(color)*value[:, :, None]
        line = np.exp(-(across/.005)**2) * np.clip((.57-u)/.13,0,1)
        pixels[:, :, :3] = root*(1-line[:,:,None]) + np.array([.22,.125,.082])*line[:,:,None]
    else:
        pixels[:, :, :3] = value[:, :, None] * np.array(color)
    image = bpy.data.images.new('Brushed root fibres', width, height, alpha=False)
    image.pixels.foreach_set(pixels.ravel())
    path = Path(out_dir, 'tex', model + '--root-fibres.png')
    path.parent.mkdir(exist_ok=True, parents=True)
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()

    mat = bpy.data.materials.new('Human.brushed_roots_hair')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .82
    strand_map = mat.node_tree.nodes.new('ShaderNodeTexImage')
    strand_map.image = image
    mat.node_tree.links.new(strand_map.outputs['Color'], bsdf.inputs['Base Color'])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new('Brushed root hair', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.vertex_groups.new(name='head').add(range(len(points)), 1., 'REPLACE')
    obj.modifiers.new('Head', 'ARMATURE').object = rig
    return obj


def comb_layers(hair, rig, cut):
    """Soften the existing locks, retaining their painted UVs and bone weights."""
    # Subdivide the fitted cards before posing. The open ends retain their
    # corners so wisps keep the outline drawn by the original alpha texture.
    if cut == 'braid':
        # The braid and the sheets wrapped over the brow are disconnected islands.
        # Keep the continuous crown and the lower plait. Remove the narrow sheets crossing the brow.
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(hair.data)
        remaining = set(bm.verts)
        top = max((hair.matrix_world @ v.co).z for v in remaining)
        islands = []
        while remaining:
            island = [remaining.pop()]
            for v in island:
                for e in v.link_edges:
                    other = e.other_vert(v)
                    if other in remaining:
                        remaining.remove(other)
                        island.append(other)
            if max((hair.matrix_world @ v.co).z for v in island) > top-.065:
                islands.append(island)
        shell = max(islands, key=len)
        # The main shell has a painted fringe too. Tuck its lowest rows inside
        # the fitted foundation, keeping the swept texture above the temples.
        world = hair.matrix_world
        local = world.inverted()
        center = Vector((0, (min((world @ v.co).y for v in shell) + max((world @ v.co).y for v in shell))*.5, top-.105))
        for vertex in shell:
            point = world @ vertex.co
            ray = (point-center).normalized()
            angle = abs(math.atan2(ray.x, -ray.y))
            border = np.interp(angle, [0, .52, .90, 1.3, 1.8, 2.5, math.pi], [.54, .50, .34, .04, -.07, -.62, -.82])
            fade = 1 - _smoothstep(.12, .51, math.asin(ray.z)-border)
            vertex.co = local @ (point - ray*(.032*fade))
        bmesh.ops.delete(bm, geom=[v for island in islands if island is not shell for v in island], context='VERTS')
        bm.to_mesh(hair.data)
        bm.free()
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
        if cut == 'lob':
            # Keep the side part and jaw framing; the lowest locks finish above the collar
            # even when the shoulder comes up to answer a question.
            jaw = high - .085
            if p.z < jaw:
                drop = jaw - p.z
                p.z = jaw - drop * .46
                taper = _smoothstep(0,.105,drop)
                p.x *= 1 - .16*taper
                p.y = mid_y + (p.y - mid_y)*(1 - .12*taper)
            vertex.co = local @ p
            continue
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
    if cut == 'lob':
        hair.vertex_groups.clear()
        hair.vertex_groups.new(name='head').add(range(len(mesh.vertices)), 1., 'REPLACE')
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
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
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


LONG_LOCK_ROWS = 35
BACK_LOCK_TIERS = ((0, 33, .043), (1, 31, .032), (2, 18, .016))


def layered_long_hair(hair, base, rig, out_dir, model):
    """Build swept, scalp-fitted locks over the parted root foundation."""
    shape = garments._shape(base)
    helpers = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    base_faces = [tuple(p.vertices) for p in base.data.polygons if not any(i in helpers for i in p.vertices)]
    scalp_bvh = BVHTree.FromPolygons(shape, base_faces)

    weights_base = garments._weights(base)
    head_pts = [shape[i] for i in {v for f in base_faces for v in f} if weights_base[i].get('head', 0) > 0.8]
    crown_z = max(p.z for p in head_pts)
    head_y_mid = (max(p.y for p in head_pts) + min(p.y for p in head_pts)) * 0.5
    head_center = Vector((0.0, head_y_mid + 0.008, crown_z - 0.104))

    joint = lambda name: rig.matrix_world @ rig.data.bones[name].head_local
    z_head = joint('head').z
    z_neck = joint('neck_01').z
    z_shoulder = joint('upperarm_l').z

    # Use the swept roots for the forehead and part. The outer locks emerge on
    # the crown, turn behind each temple and fall to a U-shaped hem. Sampling
    # the ribbon across azimuth keeps both edges on the same scalp surface.
    rng = np.random.default_rng(7713)
    points, quads, uvs, v_weights, guide_normals = [], [], [], [], []
    rows = LONG_LOCK_ROWS

    def scalp_point(angle, elevation, clearance):
        ray = Vector((math.sin(angle)*math.cos(elevation),
                      -math.cos(angle)*math.cos(elevation), math.sin(elevation)))
        hit = scalp_bvh.ray_cast(head_center + ray*.24, -ray, .23)[0]
        return (hit if hit is not None else head_center + ray*.09) + ray*clearance

    def add_lock(angle, width, layer, face_lock=False):
        side = 1 if angle >= 0 else -1
        rear = (1 - math.cos(angle)) * .5
        start = len(points)
        depth = (.0046, .0068, .0082)[layer]
        end_z = (z_shoulder + rng.uniform(-.080, -.035) if face_lock else
                 z_shoulder - .060 - .18*rear + rng.uniform(-.014, .014))
        phase = 1.4*angle + rng.uniform(-.3, .3)
        # Finish the skull arc above the ears. Below it the locks take a
        # smooth path past the cheek without sampling the ear or jaw surface.
        elev0 = 1.31 + .08*math.cos(angle)
        elev1 = .19 if face_lock else .05
        spread = width / .092
        anchors = []
        for across in (-.5, 0., .5):
            a = angle + across*spread
            p = scalp_point(a, elev1, depth)
            anchors.append(p)
        col = layer
        for row in range(rows):
            t = row / (rows-1)
            u = max(0., (t-.40)/.60)
            ease = _smoothstep(0, 1, u)
            taper = 1 - .96*_smoothstep(.60, 1., u)
            for j, across in enumerate((-.5, 0., .5)):
                a = angle + across*spread
                if t <= .40:
                    v = t/.40
                    elev = elev0 + (elev1-elev0)*v
                    a -= side*(.42 if face_lock else .14)*(1-v)
                    if face_lock:
                        elev = .82+(elev1-.82)*v
                    # Emerge from beneath the root foundation above the ear.
                    p = scalp_point(a, elev, .0006+(depth-.0006)*_smoothstep(.25,.95,v))
                    normal = (p-head_center).normalized()
                else:
                    anchor = anchors[1].lerp(anchors[j], taper)
                    p = anchor.copy()
                    p.z += (end_z-anchor.z)*u
                    # Front pieces hang from the temples to the collar. Side
                    # pieces sweep around the shoulder into the back lengths.
                    end_x = side*(.087 + .025*(abs(angle)-1.0)) if face_lock else .126*math.sin(angle)
                    end_y = -.115 if face_lock else .092 + .045*math.cos(angle-math.pi)
                    p.x += (end_x-anchors[1].x)*ease
                    p.y += (end_y-anchors[1].y)*ease
                    if face_lock:
                        # Flatten the lower face-framing locks against the chest.
                        delta = anchors[j]-anchors[1]
                        p.x += (across*width-delta.x)*ease*taper
                        p.y -= delta.y*ease*taper
                    wave = math.sin(u*math.tau+phase)*(.010 if face_lock else .005)*math.sin(math.pi*u)
                    p.x += wave*math.sin(a)
                    p.y -= wave*math.cos(a)
                    normal = Vector((math.sin(a), -math.cos(a), .12)).normalized()
                points.append(p)
                guide_normals.append(normal)
                v_weights.append(_hair_bone_weights(p,z_head,z_neck,z_shoulder))
            if not row:
                continue
            prev = start + 3*(row-1)
            for j in range(2):
                k = prev+j
                quads.append([k,k+3,k+4,k+1])
                left = col*.25+.004 + j*.121
                right = left+.121
                v = 1-row/(rows-1)
                uvs.extend([(left,v+1/(rows-1)),(left,v),(right,v),(right,v+1/(rows-1))])

    for layer, count, width in BACK_LOCK_TIERS:
        for i in range(count):
            a = 1.46 + (math.tau-2*1.46)*(i+.3+.25*(layer%2))/count
            add_lock(a if a <= math.pi else a-math.tau, width, layer)
    for side in (-1, 1):
        for i in range(4):
            add_lock(side*(1.08+i*.085), .032-i*.003, i%2, face_lock=True)

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


def _posed_surface(objects):
    verts, faces = [], []
    for obj in objects:
        if obj.type != 'MESH' or not len(obj.data.polygons):
            continue
        offset = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(verts, faces) if faces else None


def _fit_back_lock(section, sweater, back, clearance):
    """Drape the three vertices of each row together against the knit."""
    rows = LONG_LOCK_ROWS
    release = math.ceil(.40*(rows-1))  # the last scalp row
    offsets = [None]*rows
    offsets[release] = 0.
    for row in range(release+1, rows):
        hits = []
        for point in section[3*row:3*row+3]:
            hit = sweater.ray_cast(point + back*.45, -back, .75)[0]
            if hit is not None:
                hits.append((hit-point).dot(back))
        if hits:
            offsets[row] = max(hits) + clearance
    # Interpolate the unsupported length from the skull to the first shoulder
    # contact. Signed distances allow a floating tip to settle onto the knit.
    known = [i for i in range(release, rows) if offsets[i] is not None]
    fitted = np.interp(range(rows), known, [offsets[i] for i in known])
    smooth = fitted.copy()
    for i in range(release+1, rows-1):
        smooth[i] = (fitted[i-1]+2*fitted[i]+fitted[i+1])*.25
        if offsets[i] is not None:
            smooth[i] = max(smooth[i], offsets[i]-.001)
    return smooth


def drape_hair_over_posed(hair_obj, obstacle_objs, rig, sweater, packed):
    """The back lengths rest on the sweater under carried gear."""
    obs_bvh = _posed_surface(obstacle_objs)
    knit = _posed_surface([sweater])
    if obs_bvh is None or knit is None:
        return
    shoulder = (rig.matrix_world @ rig.pose.bones['upperarm_l'].head).z
    chest = rig.matrix_world @ rig.pose.bones['spine_03'].head
    # Fit whole ribbon sections in the horizontal direction of the posed
    # torso. Independent closest-point projections can fold a card inside
    # out near a strap. Spread clearance over neighbouring sections instead.
    forward = rig.matrix_world.to_3x3() @ rig.pose.bones['spine_03'].matrix.to_3x3()
    back = forward @ (rig.data.bones['spine_03'].matrix_local.to_3x3().inverted() @ Vector((0,1,0)))
    back.z = 0
    back.normalize()
    mw = hair_obj.matrix_world
    inv = mw.inverted()
    me = hair_obj.data
    points = [mw @ v.co for v in me.vertices]
    rows = LONG_LOCK_ROWS
    back_clearances = [(.0015 + tier*.0008 if packed else .004 + tier*.0025)
                       for tier, count, width in BACK_LOCK_TIERS for _ in range(count)]
    for start in range(0, len(points), rows*3):
        section = points[start:start+rows*3]
        lock = start // (rows*3)
        if lock < len(back_clearances):
            # Compress the layers where the pack lies over them. Keep a small
            # amount of separation between tiers on the exposed sweater.
            shifts = _fit_back_lock(section, knit, back, back_clearances[lock])
            for j, shift in enumerate(shifts):
                for i in range(start+3*j, start+3*j+3):
                    me.vertices[i].co = inv @ (points[i]+back*shift)
            continue
        direction = back if (section[-2]-chest).dot(back) >= 0 else -back
        offsets = []
        for i in range(0, len(section), 3):
            offset = 0.
            for p in section[i:i+3]:
                if p.z > shoulder+.055:
                    continue
                # Ignore obstacles on the far side of the torso.
                hit = obs_bvh.ray_cast(p+direction*.32, -direction, .42)[0]
                if hit is not None:
                    d = (hit-p).dot(direction)+.006
                    offset = max(offset, d*_smoothstep(shoulder+.055, shoulder+.005, p.z))
            offsets.append(offset)
        for j in range(rows):
            dz = section[j*3+1].z
            lift = max(offset - .75*abs(dz-section[k*3+1].z)
                       for k, offset in enumerate(offsets))
            for i in range(start+3*j, start+3*j+3):
                me.vertices[i].co = inv @ (points[i]+direction*max(0., lift))
    me.update()


def _afro_coil_textures(out_dir, model):
    from afro_coil_texture import _build_all
    rgba, nrm_rgba = _build_all()
    height, width = rgba.shape[:2]

    img_col = bpy.data.images.new('Sculpted coils', width, height, alpha=True)
    img_col.pixels.foreach_set(rgba.ravel())
    p_col = Path(out_dir, 'tex', model + '--sculpted-coils.png')
    p_col.parent.mkdir(parents=True, exist_ok=True)
    img_col.filepath_raw = str(p_col)
    img_col.file_format = 'PNG'
    img_col.save()

    img_nrm = bpy.data.images.new('Sculpted coils normal', width, height, alpha=True)
    img_nrm.colorspace_settings.name = 'Non-Color'
    img_nrm.pixels.foreach_set(nrm_rgba.ravel())
    p_nrm = Path(out_dir, 'tex', model + '--sculpted-coils-nrm.png')
    img_nrm.filepath_raw = str(p_nrm)
    img_nrm.file_format = 'PNG'
    img_nrm.save()
    return img_col, img_nrm


def sculpted_afro_coils(hair, base, rig, out_dir, model, style='taper_afro'):
    """Replace the cracked afro01 shell with a sculpted 3D sponge-coil volume + 2 concentric airy micro-coil lace shells."""
    shape = garments._shape(base)
    helpers = garments._members(base, 'HelperGeometry') | garments._members(base, 'JointCubes')
    faces = [tuple(p.vertices) for p in base.data.polygons if not any(i in helpers for i in p.vertices)]
    scalp = BVHTree.FromPolygons(shape, faces)
    weights = garments._weights(base)
    head = [shape[i] for i in {v for f in faces for v in f} if weights[i].get('head', 0) > 0.8]
    crown = max(p.z for p in head)
    head_h = crown - min(p.z for p in head)
    head_scale = max(0.72, min(1.15, head_h / 0.225))
    center = Vector((0.0, (max(p.y for p in head) + min(p.y for p in head)) * 0.5 + 0.005 * head_scale, crown - 0.105 * head_scale))

    points, quads, uvs = [], [], []

    # Clean, natural hairline reaching smoothly around the ears and down to the nape (-0.70).
    angles = [0.0, 0.40, 0.78, 1.04, 1.24, 1.54, 1.84, 2.22, math.pi]
    if style == 'full_afro':
        # Softer, rounded natural hairline for Zoe / Tess (slightly fuller temples & nape wrap).
        edges = [0.34, 0.33, 0.23, -0.09, -0.19, -0.04, -0.17, -0.50, -0.72]
    else:
        edges = [0.36, 0.35, 0.25, -0.07, -0.17, -0.02, -0.15, -0.48, -0.70]

    def _coil_height(hit, t, a, seed_shift=0.0):
        # Smooth, natural tapered hairline (no chunky forehead shelf!) rising smoothly into a lush Afro crown.
        taper_edge = _smoothstep(0.0, 0.28 if style == 'full_afro' else 0.30, t) ** 1.25
        side_factor = abs(math.sin(a))
        crown_t = _smoothstep(0.16 if style == 'full_afro' else 0.18, 0.72, t)
        if style == 'full_afro':
            # Lush, rounded natural Afro volume with fuller sides (keeps a sleek, natural silhouette).
            base_len = (0.0018 + 0.0145 * taper_edge + (0.0215 - 0.0020 * side_factor) * crown_t) * head_scale
        else:
            base_len = (0.0014 + 0.0115 * taper_edge + (0.0175 - 0.0045 * side_factor) * crown_t) * head_scale
        p_n = (hit / head_scale) + Vector((seed_shift, seed_shift * 0.7, -seed_shift * 0.5))
        n1 = noise.noise(p_n * 72.0, noise_basis='PERLIN_ORIGINAL')
        n2 = noise.noise(p_n * 145.0, noise_basis='PERLIN_ORIGINAL')
        # Organic rounded sponge-coil pillows sculpted directly into geometry
        pillow = ((1.0 - abs(n1)) * 0.0048 + n2 * 0.0022) * head_scale
        return base_len + pillow * taper_edge

    def _add_shell(rings, columns, u_lo, u_hi, extra_offset=0.0, u_shift=0.0, seed_shift=0.0):
        base_v = len(points)
        for i in range(rings):
            t = i / rings
            shell_grow = _smoothstep(0.06, 0.34, t)
            for j in range(columns):
                a = math.tau * j / columns
                edge = float(np.interp(min(a, math.tau - a), angles, edges)) + 0.007 * math.sin(9.0 * a)
                elev = edge + (math.pi * 0.5 - edge) * t
                ray = Vector((math.sin(a) * math.cos(elev), -math.cos(a) * math.cos(elev), math.sin(elev)))
                hit, _, _, _ = scalp.ray_cast(center, ray, 0.35)
                if hit is None:
                    hit = center + ray * (0.095 * head_scale)
                length = _coil_height(hit, t, a, seed_shift=seed_shift) + extra_offset * head_scale * shell_grow
                if style == 'curly_bob':
                    length -= extra_offset * head_scale * shell_grow * .75
                    length += .0028 * noise.noise(hit*120) * shell_grow
                p = hit + ray * (length - 0.0005 * head_scale * (1.0 - min(1.0, t / 0.14)))
                if style == 'curly_bob':
                    back = _smoothstep(.45, 1.85, min(a, math.tau-a))
                    ends = back * (1-_smoothstep(.05,.78,t))
                    p.z -= ends * (.050+.004*math.cos(15*a))*head_scale
                    p += Vector((math.sin(a),-math.cos(a),0)) * ends * (.019+.003*math.cos(13*a))*head_scale
                points.append(p)

        top_hit, _, _, _ = scalp.ray_cast(center, Vector((0, 0, 1)), 0.35)
        top_p = top_hit if top_hit is not None else Vector((center.x, center.y, crown))
        pole = len(points)
        points.append(top_p + Vector((0, 0, _coil_height(top_p, 1.0, 0.0, seed_shift=seed_shift) + extra_offset * head_scale)))

        u_span = u_hi - u_lo
        for i in range(rings):
            v0, v1 = i / rings, (i + 1) / rings
            for j in range(columns):
                jn = (j + 1) % columns
                f0 = ((j / columns) + u_shift) % 1.0
                f1 = f0 + (1.0 / columns)
                if f1 > 1.0:
                    f1 = 1.0
                u0 = u_lo + u_span * f0
                u1 = u_lo + u_span * f1
                a0 = base_v + i * columns + j
                a1 = base_v + i * columns + jn
                if i + 1 == rings:
                    quads.append([a0, a1, pole])
                    uvs.extend([(u0, v0), (u1, v0), (0.5 * (u0 + u1), 1.0)])
                else:
                    b1 = base_v + (i + 1) * columns + jn
                    b0 = base_v + (i + 1) * columns + j
                    quads.append([a0, a1, b1, b0])
                    uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

    # Shell 0: Sculpted solid dense 4C coil base volume (left UV half)
    _add_shell(44, 132, 0.004, 0.494, extra_offset=0.0, u_shift=0.0, seed_shift=0.0)
    # Shell 1: Inner airy micro-coil lace parallax shell (+3.2mm, right UV half)
    _add_shell(32, 96, 0.506, 0.996, extra_offset=0.0032, u_shift=0.17, seed_shift=0.013)
    # Shell 2: Outer fuzzy micro-coil silhouette halo shell (+6.6mm, right UV half, phase-shifted)
    _add_shell(28, 84, 0.506, 0.996, extra_offset=0.0066, u_shift=0.61, seed_shift=0.029)

    mesh = bpy.data.meshes.new('Sculpted coils')
    local = hair.matrix_world.inverted()
    mesh.from_pydata([local @ p for p in points], [], quads)
    uv = mesh.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray(uvs, dtype=np.float32).ravel())
    for face in mesh.polygons:
        face.use_smooth = True

    mat = bpy.data.materials.new('Human.sculpted_coils_hair')
    mat.use_nodes = True
    mat['alpha'] = 'MASK'
    mat['cutoff'] = 0.28
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    # Natural velvety 4C coil finish (soft sheen, zero plastic glare!)
    bsdf.inputs['Roughness'].default_value = 0.80
    bsdf.inputs['Specular IOR Level'].default_value = 0.22
    img_col, img_nrm = _afro_coil_textures(out_dir, model)
    strand = mat.node_tree.nodes.new('ShaderNodeTexImage')
    strand.image = img_col
    mat.node_tree.links.new(strand.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(strand.outputs['Alpha'], bsdf.inputs['Alpha'])

    # Wire real tangent-space coil normal map so both Blender Cycles & Three.js shade every micro-coil!
    nrm_tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    nrm_tex.image = img_nrm
    nrm_node = mat.node_tree.nodes.new('ShaderNodeNormalMap')
    nrm_node.inputs['Strength'].default_value = 0.90
    mat.node_tree.links.new(nrm_tex.outputs['Color'], nrm_node.inputs['Color'])
    mat.node_tree.links.new(nrm_node.outputs['Normal'], bsdf.inputs['Normal'])
    mesh.materials.append(mat)

    hair.modifiers.clear()
    hair.data = mesh
    hair.vertex_groups.clear()
    hair.vertex_groups.new(name='head').add(range(len(points)), 1.0, 'REPLACE')
    hair.modifiers.new('Sculpted coils', 'ARMATURE').object = rig
