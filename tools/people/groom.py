"""A close tapered crop fitted to the actor's shaped scalp before posing."""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

import garments


def fibre_texture(out_dir, model):
    # Tile of overlapping short, bent fibres. Wrap each stroke at both borders.
    size = 384
    rng = np.random.default_rng(8154)
    dy, dx = np.mgrid[-8:9, -8:9]
    tone = rng.uniform(.65, 1.0, (size, size))
    for _ in range(1250):
        cx, cy = rng.integers(0, size, 2)
        radius = rng.uniform(2., 6.)
        angle = rng.uniform(0, math.tau)
        ix = (cx + np.arange(-8, 9)) % size
        iy = (cy + np.arange(-8, 9)) % size
        arc = np.clip(np.cos(np.arctan2(dy, dx) - angle) + .35, 0, 1)
        strand = np.exp(-((np.hypot(dx, dy) - radius) / .85) ** 2) * arc
        tone[np.ix_(iy, ix)] += rng.uniform(.2, 1.0) * strand
    width, height = 1024, 512
    y, x = np.mgrid[:height, :width]
    fibres = tone[(y * size * 2 // height) % size, (x * size * 5 // width) % size]
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = fibres[:, :, None] * np.array([.105, .079, .062])
    # Thin the first few millimetres into the existing shaved hairline.
    rgba[:, :, 3] = np.clip(y / 13 + .42 * (fibres - 1) + rng.uniform(-.27, .27, fibres.shape), 0, 1)
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
    # Both cuts use long vertical strips of hair. Work at delivery resolution
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
