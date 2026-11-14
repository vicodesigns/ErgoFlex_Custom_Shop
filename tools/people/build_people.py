"""Build one posed person as a GLB with its skeleton (run inside Blender 4.2 with MPFB installed).

The mesh is baked in the pose and the pose is made the skeleton's rest pose: untouched, the skeleton changes nothing
(the Studio and the film show the model as a plain mesh); the Director's pose mode turns its bones for fine tuning.

    BLENDER_USER_RESOURCES=~/blender/mpfb-user blender -b --python tools/people/build_people.py -- <output id> <out dir> [--preview png]

Prints `RESULT {json}` with the model's bounds (mm, Y up) and triangle count.
build.py runs this once per output and then optimises and indexes the models.
"""
import json, math, os, sys
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cast, pose_lib, held, garments, worn  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT_ID, OUT_DIR = argv[0], argv[1]
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
spec = cast.output(OUT_ID)
who = dict(cast.CHARACTERS[spec['character']], **spec.get('as', {}))       # ('as': this model's own outfit, cast.VARIANTS)
LOOK = who.get('look', 2)       # 3: round three's materials (cast.py); the people built before it keep theirs until they are given it

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402


def asset(name, ext='mhclo'):
    return f'{name}/{name}.{ext}'


# ---- the person --------------------------------------------------------------------------------
info = HumanService._create_default_human_info_dict()
phen = dict(who['phenotype']); info['phenotype'].update({k: v for k, v in phen.items() if k != 'race'}); info['phenotype']['race'] = phen['race']
info['rig'] = 'game_engine'
info['eyes'] = 'low-poly/low-poly.mhclo'
info['eyebrows'] = asset(who.get('eyebrows', 'eyebrow001')); info['eyelashes'] = asset(who.get('eyelashes', 'eyelashes01'))
info['teeth'] = 'teeth_base/teeth_base.mhclo'
if who.get('hair'): info['hair'] = asset(who['hair'])
info['clothes'] = [asset(c) for c in who['clothes']]
info['skin_mhmat'] = asset(who['skin'], 'mhmat')
info['eyes_material_settings'] = {}
# A face of their own (cast 'face': {target: value}; 'lr-...' is the left and the right target of a pair).
info['targets'] = [{'target': t.replace('lr-', side, 1) if t.startswith('lr-') else t, 'value': v}
                   for t, v in who.get('face', {}).items() for side in (('l-', 'r-') if t.startswith('lr-') else ('',))]
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402
for t in info['targets']:
    if not TargetService.target_full_path(t['target']): raise KeyError('no face target ' + t['target'])
info['skin_material_type'] = 'MAKESKIN'; info['eyes_material_type'] = 'MAKESKIN'; info['clothes_material_type'] = 'MAKESKIN'
settings = HumanService.get_default_deserialization_settings(); settings['subdiv_levels'] = 0
base = HumanService.deserialize_from_dict(info, settings)
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
base_name = base.name

_copies = [0]
def save_copy(image, px, tag):
    w, h = image.size; copy = bpy.data.images.new(image.name + tag, w, h, alpha=True); copy.pixels.foreach_set(px.ravel()); _copies[0] += 1
    path = os.path.join(OUT_DIR, 'tex', f'{OUT_ID}--{_copies[0]}-{image.name}.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
    copy.filepath_raw = path; copy.file_format = 'PNG'; copy.save(); return copy


def eye_image(image, colour):
    """Eyes that sit in the head instead of looking painted on: the white is shaded toward the lids and a little
    warm (a pure white eyeball glows in a room), the iris gets its dark rim, the reddish brown iris becomes brown."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    v, u = np.mgrid[0:h, 0:w]; u = (u + .5) / w; v = (v + .5) / h; lum = px[..., :3].mean(axis=2)
    for cu, cv in ((.29, .29), (.71, .705)):                      # the two eyeballs of the texture (rows from the bottom)
        near = (np.hypot(u - cu, v - cv) < .07) & (lum < .12)
        if near.sum() > 20: cu, cv = float(u[near].mean()), float(v[near].mean())      # the pupil's middle
        r = np.hypot(u - cu, v - cv); R = .118; ball = r < .27
        iris = np.clip((R - r) / .012, 0, 1)[..., None]; white = (1 - iris) * ball[..., None]
        shade = 1 - .5 * np.clip((r - R * .9) / (R * 1.5), 0, 1) ** .8           # darker away from the iris: under the lids, in the corners
        px[..., :3] = px[..., :3] * (1 - white) + px[..., :3] * shade[..., None] * np.array([.93, .9, .87], dtype=np.float32) * white
        rim = np.exp(-((r - R * .96) / (R * .09)) ** 2)[..., None] * ball[..., None]; px[..., :3] *= 1 - .45 * rim
        if colour.startswith('brown'): px[..., :3] = px[..., :3] * (1 - iris) + px[..., :3] * np.array([.62, .6, .56] if colour == 'brown' else [.8, .74, .62], dtype=np.float32) * iris
    return save_copy(image, px.reshape(-1, 4), '_eye')


# Eye colour: the eye material's texture is swapped for the named iris.
for o in meshes:
    if 'low-poly' in o.name and who.get('eyes'):
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image:
                    folder = os.path.dirname(n.image.filepath_from_user()); want = os.path.join(folder, who['eyes'] + '_eye.png')
                    if os.path.exists(want): n.image = bpy.data.images.load(want)
                    if LOOK >= 3: n.image = eye_image(n.image, who.get('eyes', ''))


# ---- an outfit in parts (cast 'parts': {outfit: 'top' | 'bottom' | 'both'}) -------------------------------------
# The one-piece outfits are a top and a bottom that do not touch. 'top' or 'bottom' keeps that half (jeans under
# another shirt); 'both' keeps both and gives the bottom a material of its own ('..._pants': the Studio's bottom).
def split_outfit(o, want):
    import bmesh as _bm
    waist = (rig.matrix_world @ rig.data.bones['spine_01'].head_local).z; k = (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47
    bm = _bm.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); world = o.matrix_world; seen = set(); parts = []
    for v in bm.verts:
        if v.index in seen: continue
        stack = [v]; seen.add(v.index); part = []
        while stack:
            x = stack.pop(); part.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); stack.append(y)
        parts.append(part)
    at = {v.index: world @ v.co for v in bm.verts}
    def low(part): zs = [at[v.index].z for v in part]; return sum(zs) / len(zs) < waist and max(zs) < waist + .1 * k and max(abs(at[v.index].x) for v in part) < .34 * k
    big = [(part, low(part)) for part in parts if len(part) >= 300]; bottom = {v.index for part, is_low in big if is_low for v in part}
    if not bottom or len(bottom) == sum(len(part) for part, _l in big): bm.free(); raise RuntimeError(o.name + ': no separate top and bottom')
    for part in parts:      # buttons, a belt, a tie: with the big piece they lie on
        if len(part) >= 300: continue
        c = sum((at[v.index] for v in part), Vector()) / len(part)
        if min(((at[v.index] - c).length, is_low) for big_part, is_low in big for v in big_part)[1]: bottom |= {v.index for v in part}
    is_low = lambda f: all(v.index in bottom for v in f.verts)
    if want != 'both': _bm.ops.delete(bm, geom=[f for f in bm.faces if is_low(f) != (want == 'bottom')], context='FACES')
    else:
        for f in bm.faces:
            if is_low(f): f.material_index = 1
    bm.to_mesh(o.data); bm.free(); m = o.data.materials[0]
    if want == 'bottom': m.name += '_pants'
    elif want == 'both': m2 = m.copy(); m2.name = m.name + '_pants'; o.data.materials.append(m2)
    # the outfit hid the skin under all of it: the skin under the half that is not worn comes back
    group = base.vertex_groups.get('Delete.' + o.name.split('.', 1)[-1])
    if group and want != 'both':
        names = {g.index: g.name for g in base.vertex_groups}; shape = garments._shape(base)
        def legs(v): return sum(g.weight for g in v.groups if names[g.group].startswith(('thigh', 'calf', 'foot', 'ball'))) > .5
        hidden = [v for v in base.data.vertices if any(g.group == group.index for g in v.groups)]
        group.remove([v.index for v in hidden if (legs(v) or shape[v.index].z < waist - .12 * k if want == 'top' else not legs(v) and shape[v.index].z > waist + .02 * k)])


for o in meshes:
    if o.name.split('.', 1)[-1] in who.get('parts', {}): split_outfit(o, who['parts'][o.name.split('.', 1)[-1]])


# ---- materials: plain PBR that survives glTF ----------------------------------------------------
def texel_mean(o, image, slot):
    """The average colour of a texture where this object's faces of one material slot use it."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(h, w, 4); uv = o.data.uv_layers.active.data
    at = [uv[i].uv for p in o.data.polygons if p.material_index == slot for i in p.loop_indices][::3]
    rows = np.clip((np.array([v.y for v in at]) % 1 * h).astype(int), 0, h - 1); cols = np.clip((np.array([v.x for v in at]) % 1 * w).astype(int), 0, w - 1)
    return px[rows, cols, :3].mean(axis=0)


def dye_image(image, rgb, mean):
    """Dye a texture: the fabric takes the colour, as light or dark as it was against its average; what was white on
    a darker fabric (the light stripe of a shirt, the wear on denim) stays white. Stripes, prints and seams survive."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    rel = px[:, :3].mean(axis=1, keepdims=True) / max(float(np.mean(mean)), .04)
    white = np.clip((px[:, :3].min(axis=1, keepdims=True) - .55) / .3, 0, 1) * np.clip((rel - 1.15) / .3, 0, 1)
    px[:, :3] = np.clip(np.array(rgb, dtype=np.float32) * np.minimum(rel, 1.7), 0, 1) * (1 - white) + .93 * white; return save_copy(image, px, '_dye')


def tone_image(image, rgb):
    """A skin tone: a factor per channel on the skin as it is (1 leaves the channel alone)."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    px[:, :3] = np.clip(px[:, :3] * np.array(rgb, dtype=np.float32), 0, 1); return save_copy(image, px, '_tone')


PRINTED = ('male_casualsuit02', 'male_casualsuit04', 'female_casualsuit01', 'female_casualsuit02', 'male_casualsuit06')      # the same logo on every chest (and across the back of the white T-shirt)


def plain_chest(o, image, mean):
    """Take the print off the chest: texels there that are not the fabric's colour are filled from the fabric beside them."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(h, w, 4); uv = o.data.uv_layers.active.data
    world = o.matrix_world; turn = world.to_3x3(); k = (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47
    low, high = (rig.matrix_world @ rig.data.bones['spine_01'].head_local).z + .04 * k, (rig.matrix_world @ rig.data.bones['neck_01'].head_local).z - .05 * k
    chest = np.zeros((h, w), dtype=bool)
    for f in o.data.polygons:
        c = world @ f.center
        if f.material_index or not low < c.z < high or abs(c.x) > .16 * k or abs((turn @ f.normal).y) < .3 or (turn @ f.normal).y > 0 and 'suit06' not in o.name: continue
        us = [uv[i].uv.x % 1 for i in f.loop_indices]; vs = [uv[i].uv.y % 1 for i in f.loop_indices]
        chest[max(0, int(min(vs) * h) - 2):int(max(vs) * h) + 3, max(0, int(min(us) * w) - 2):int(max(us) * w) + 3] = True
    rgb = px[..., :3]; cast_ = rgb / np.maximum(rgb.mean(axis=2, keepdims=True), .02); off = np.abs(cast_ - mean / max(float(mean.mean()), .02)).max(axis=2) > .28
    if 'suit06' in o.name: rel = rgb.mean(axis=2) / max(float(mean.mean()), .02); off |= (rel < .86) | (rel > 1.3)      # (grey letters on white)
    grown = off.copy()
    for d in range(1, 5):
        for axis in (0, 1): grown |= np.roll(off, d, axis) | np.roll(off, -d, axis)
    todo = chest & grown
    for dy, dx in ((0, 257), (0, -257), (211, 0), (-211, 0), (173, 173), (-173, -173), (0, 419), (397, 0)):      # the weave from beside it
        src = np.roll(px, (dy, dx), axis=(0, 1)); ok = todo & np.roll(chest & ~grown, (dy, dx), axis=(0, 1)); px[ok] = src[ok]; todo &= ~ok
    px[todo, :3] = mean
    return save_copy(image, px.reshape(-1, 4), '_plain')


def tint_image(image, rgb):
    """Multiply a texture by a colour (clothes come in one colourway each)."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    lum = px[:, :3].mean(axis=1, keepdims=True); solid = px[:, 3:4] > .5
    mean = max(float(lum[solid].mean()) if solid.any() else float(lum.mean()), 1e-3)
    # Shading relative to the fabric's average, compressed so folds stay soft, times the colour.
    px[:, :3] = np.clip((.35 + .65 * lum / mean) * np.array(rgb, dtype=np.float32), 0, 1)
    return save_copy(image, px, '_tint')


def hair_image(image, rgb):
    """Hair in a colour that still has strands: darker and lighter than the colour as the texture is, and the
    lightest strands catch the light (black hair tinted flat is a helmet)."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    lum = px[:, :3].mean(axis=1, keepdims=True); solid = px[:, 3:4] > .5; mean = max(float(lum[solid].mean()) if solid.any() else float(lum.mean()), 1e-3)
    spread = max(float(lum[solid].std()) if solid.any() else 0., 1e-3) / mean
    rel = np.clip(1 + (lum / mean - 1) * min(2.2, .3 / spread), .35, 1.9)           # (every texture's strands as far apart as a detailed one's)
    rel = 1 + (rel - 1) * np.clip((px[:, 3:4] - .5) / .4, 0, 1)                    # (a strand's soft edge carries the painter's matte, not hair)
    c = np.array(rgb, dtype=np.float32); c = c + max(0., .085 - float(c.mean())) * .5        # (black hair is not black: about a tenth)
    sheen = (c / max(float(c.max()), 1e-3) * .45 + .55) * (.16 + .2 * float(c.max()))
    px[:, :3] = np.clip(c * (.25 + .75 * rel) + sheen * np.clip(rel - 1.02, 0, .9) ** 1.2, 0, 1); return save_copy(image, px, '_hair')


def stripe_image(o, image, slot, colour, width=.022, gap=.03, upright=False):
    """Stripes woven into a fabric (cast 'stripes': {garment: {...}}): bands of a second colour by height on the body
    as it stands (or, upright, by the way round it), so they run level across seams whatever the garment's UV layout."""
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(h, w, 4); uv = o.data.uv_layers.active.data
    world = o.matrix_world; along = np.full((h, w), np.nan, dtype=np.float32)
    def place(v): p = world @ o.data.vertices[v].co; return (math.atan2(p.x, -p.y) * .16 if abs(p.x) < .2 else p.x) if upright else p.z
    for f in o.data.polygons:
        if f.material_index != slot: continue
        pts = [(uv[i].uv.x % 1 * w, uv[i].uv.y % 1 * h, place(o.data.loops[i].vertex_index)) for i in f.loop_indices]
        for a, b, c in ((pts[0], pts[i], pts[i + 1]) for i in range(1, len(pts) - 1)):
            x0, x1 = max(0, int(min(a[0], b[0], c[0])) - 1), min(w, int(max(a[0], b[0], c[0])) + 2); y0, y1 = max(0, int(min(a[1], b[1], c[1])) - 1), min(h, int(max(a[1], b[1], c[1])) + 2)
            det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(det) < 1e-9 or x1 <= x0 or y1 <= y0 or (x1 - x0) * (y1 - y0) > w * h / 6: continue
            yy, xx = np.mgrid[y0:y1, x0:x1]; xx = xx + .5; yy = yy + .5
            la = ((b[1] - c[1]) * (xx - c[0]) + (c[0] - b[0]) * (yy - c[1])) / det; lb = ((c[1] - a[1]) * (xx - c[0]) + (a[0] - c[0]) * (yy - c[1])) / det; lc = 1 - la - lb
            inside = (la >= -.15) & (lb >= -.15) & (lc >= -.15)                 # (a little over the edge: no bare seam between islands)
            along[y0:y1, x0:x1][inside] = (la * a[2] + lb * b[2] + lc * c[2])[inside]
    band = (np.nan_to_num(along, nan=-1.) % (width + gap)) < width; band &= ~np.isnan(along)
    lum = px[..., :3].mean(axis=2, keepdims=True); mean = float(lum[~np.isnan(along)].mean()) if (~np.isnan(along)).any() else 1.
    px[band, :3] = np.clip(np.array(colour, dtype=np.float32) * (.4 + .6 * lum[band] / max(mean, .02)), 0, 1)
    return save_copy(image, px.reshape(-1, 4), '_stripes')


ALPHA_CUT = ('hair', 'eyebrow', 'eyelash')
tints = who.get('tint', {})
for o in meshes:
    kind = o.name.split('.', 1)[-1]
    for m in o.data.materials:
        tree = m.node_tree; bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
        cut = any(k in o.name.lower() for k in ALPHA_CUT) or bool(who.get('hair')) and who['hair'] in o.name
        m['alpha'] = 'MASK' if cut else 'OPAQUE'
        # (round three: a brow keeps more of its soft edge, or it is a drawn line)
        if LOOK >= 3 and 'eyebrow' in o.name: m['cutoff'] = .3
        if 'eyebrow' in o.name and who.get('brow_cutoff'): m['cutoff'] = who['brow_cutoff']      # (cast: a character's own, softer brow edge)
        if not cut:
            for link in list(bsdf.inputs['Alpha'].links): tree.links.remove(link)
            bsdf.inputs['Alpha'].default_value = 1
        rough = .5
        if o is base: rough = .7 if LOOK >= 3 else .58
        elif 'low-poly' in o.name: rough = .3 if LOOK >= 3 else .12
        elif 'shoes' in o.name or 'boots' in o.name or 'flats' in o.name: rough = .55
        elif cut: rough = .5
        else: rough = .82
        for link in list(bsdf.inputs['Roughness'].links): tree.links.remove(link)
        bsdf.inputs['Roughness'].default_value = rough
        for link in list(bsdf.inputs['Metallic'].links): tree.links.remove(link)
        bsdf.inputs['Metallic'].default_value = 0
        # A height map is not a normal map: exported as one it turns the fabric nearly black (the tucked T-shirt).
        for link in list(bsdf.inputs['Normal'].links) if LOOK >= 3 else []:
            if link.from_node.type == 'BUMP' and link.from_node.inputs['Height'].links and not link.from_node.inputs['Normal'].links: tree.links.remove(link)
            # ... nor is an object-space normal map a tangent-space one (the messy short hair came out in grey patches)
            elif any(n.type == 'TEX_IMAGE' and n.image and 'objnorm' in n.image.name for n in tree.nodes): tree.links.remove(link)
        slot = list(o.data.materials).index(m); key = kind + (':bottom' if slot and kind in who.get('parts', {}) else '')
        tint = tints.get(key) or (who.get('hair_tint') if who.get('hair') and who['hair'] in o.name else None)
        dye = who.get('dye', {}).get(key) or (who.get('skin_tone') if o is base else None)
        # (round three: the brows are the hair's colour, a shade darker; fair or grey hair over black brows is a mask)
        if LOOK >= 3 and 'eyebrow' in o.name and (who.get('brow_tint') or who.get('hair_tint')): tint = who.get('brow_tint') or tuple(v * (.6 if max(who['hair_tint']) > .2 else 1) for v in who['hair_tint'])
        stripes = who.get('stripes', {}).get(key)
        if tint or dye or stripes or LOOK >= 3 and kind in PRINTED and not slot:
            for link in bsdf.inputs['Base Color'].links:
                node = LOOK >= 3 and tree.nodes.get('diffuseTexture') or link.from_node       # (not the ambient occlusion map mixed over it)
                while node and node.type != 'TEX_IMAGE':
                    ins = [l.from_node for i in node.inputs for l in i.links]; node = next((n for n in ins if n.type == 'TEX_IMAGE'), ins[0] if ins else None)
                if not node or not node.image: continue
                if LOOK >= 3 and kind in PRINTED and not slot: node.image = plain_chest(o, node.image, texel_mean(o, node.image, slot))
                if tint: node.image = (hair_image if LOOK >= 3 and tint is who.get('hair_tint') and key not in tints else tint_image)(node.image, tint)
                elif dye: node.image = tone_image(node.image, dye) if o is base else dye_image(node.image, dye, texel_mean(o, node.image, slot))
                if stripes: node.image = stripe_image(o, node.image, slot, **stripes)

# ---- glasses as frames only (safety glasses): the faces the texture leaves clear go (cast: 'frames': [glasses, ...])
for o in meshes:
    if o.name.split('.', 1)[-1] not in who.get('frames', []): continue
    image = next((n.image for m in o.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None); uv = o.data.uv_layers.active
    if not image or not uv: continue
    w, h = image.size; px = np.empty(w * h * 4, dtype=np.float32); image.pixels.foreach_get(px); alpha = px.reshape(h, w, 4)[..., 3]
    def clear(p):
        u = sum(uv.data[i].uv.x for i in p.loop_indices) / p.loop_total; v = sum(uv.data[i].uv.y for i in p.loop_indices) / p.loop_total
        return alpha[min(h - 1, max(0, int(v % 1 * h))), min(w - 1, max(0, int(u % 1 * w)))] < .6
    gone = {i for p in o.data.polygons if clear(p) for i in p.vertices} - {i for p in o.data.polygons if not clear(p) for i in p.vertices}
    faces = [p.index for p in o.data.polygons if clear(p)]
    if faces:
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); _bm.ops.delete(bm, geom=[bm.faces[i] for i in faces], context='FACES'); bm.to_mesh(o.data); bm.free()

# ---- garments made from the base mesh (a white coat, a gown, socks; gloves are the hands' own faces) ------
meshes += garments.build(who, base, rig, OUT_DIR, OUT_ID)

# ---- a shirt tucked in: it ends under the belt (cast: 'tuck': [garment, ...]) -------------------------------
for o in meshes:
    kind = o.name.split('.', 1)[-1]
    if kind not in who.get('tuck', []): continue
    line = (rig.matrix_world @ rig.data.bones['spine_01'].head_local).z + .008 * (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47
    gone = [v.index for v in o.data.vertices if (o.matrix_world @ v.co).z < line]
    vg = o.vertex_groups.new(name='tucked'); vg.add(gone, 1., 'REPLACE')
    mod = o.modifiers.new('Tucked', 'MASK'); mod.vertex_group = 'tucked'; mod.invert_vertex_group = True

# ---- knee-length shorts: a pair of trousers loses everything that follows the calves and feet ---------
for o in meshes:
    kind = o.name.split('.', 1)[-1]
    if kind not in who.get('crop', []): continue
    groups = {g.index: g.name for g in o.vertex_groups}; lower = {'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'}
    gone = [v.index for v in o.data.vertices if sum(g.weight for g in v.groups if groups.get(g.group) in lower) > .5]
    vg = o.vertex_groups.new(name='cropped'); vg.add(gone, 1., 'REPLACE')
    mod = o.modifiers.new('Cropped', 'MASK'); mod.vertex_group = 'cropped'; mod.invert_vertex_group = True

# ---- limb difference: the lower leg below the knee is removed; held.prosthesis() replaces it ----------
amputee = who.get('prosthesis')
if amputee:
    groups = {g.index: g.name for g in base.vertex_groups}; lower = {f'calf_{amputee}', f'foot_{amputee}', f'ball_{amputee}'}
    gone = [v.index for v in base.data.vertices if sum(g.weight for g in v.groups if groups.get(g.group) in lower) > .55]
    vg = base.vertex_groups.new(name='amputated'); vg.add(gone, 1., 'REPLACE')
    mod = base.modifiers.new('Amputated', 'MASK'); mod.vertex_group = 'amputated'; mod.invert_vertex_group = True

# ---- pose ------------------------------------------------------------------------------------------
bpy.context.view_layer.objects.active = rig
pose = cast.DESK_POSES[spec['pose']](spec['height']) if spec['pose'] in cast.DESK_POSES else cast.POSES[spec['pose']]
if callable(pose):
    # Free-standing poses are written for a 1.70 m person and scale with the character.
    k = (rig.matrix_world @ rig.data.bones['head'].head_local).z / 1.47
    if who.get('limbs'):
        k -= sum(rig.data.bones[b].length for b in ('thigh_l', 'calf_l')) * (1 - who['limbs'][0]) / 1.47
    pose = pose(k)
if who.get('limbs'):
    # Shorter legs: the pelvis comes down by what the thigh and calf lose.
    drop = sum(rig.data.bones[b].length for b in ('thigh_l', 'calf_l')) * (1 - who['limbs'][0])
    pose = dict(pose, limbs=who['limbs'])
    if 'pelvis' not in pose: off = pose.get('pelvis_offset', (0, 0, 0)); pose['pelvis_offset'] = (off[0], off[1], off[2] - drop)
for limb, by in getattr(cast, 'NUDGE', {}).get((spec['character'], spec['pose']), {}).items():
    # (a number: added to a number of the pose, 'hip_z'; a tuple: added to the limb's 'at')
    pose = dict(pose)
    if isinstance(by, (int, float)): pose[limb] = pose[limb] + by
    else: pose[limb] = dict(pose[limb], at=tuple(a + b for a, b in zip(pose[limb]['at'], by)))
pose_lib.apply_pose(rig, pose)
# A hand that rests on the body is kept outside this character's clothes (worn.clear_hands): posed again, moved out.
cleared = worn.clear_hands(rig, meshes, who, pose)
if cleared: pose = cleared; pose_lib.apply_pose(rig, pose)
# What each held thing follows when the Director fine-tunes the pose (the wheelchair stays where it is).
HELD_BONE = {'gamepad': 'hand_r', 'carton': 'hand_r', 'backpack': 'spine_03', 'headphones': 'head', 'wheelchair': None, 'laptop': None, 'prosthesis': 'calf_{side}'}
extras, extra_bone = [], {}
for kind, kw in list(spec.get('held', [])) + list(who.get('carry', {}).get(spec['pose'], [])):
    made = held.BUILDERS[kind](rig, **dict(kw)); extras += made
    for o in made: extra_bone[o.name] = (HELD_BONE[kind] if kind in HELD_BONE else 'hand_{side}')
    for o in made:
        if extra_bone[o.name]: extra_bone[o.name] = extra_bone[o.name].format(side=kw.get('side', 'r'))
# What the role wears on the body (belt, badge, lanyard...): found on the posed clothes, each following one bone.
for o, bone in worn.build(rig, meshes, who, spec): extras.append(o); extra_bone[o.name] = bone

# ---- bake to one static mesh -------------------------------------------------------------------
dg = bpy.context.evaluated_depsgraph_get(); baked = []
for o in meshes:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if not len(me.polygons): continue
    b = bpy.data.objects.new(o.name + '.baked', me); b.matrix_world = o.matrix_world.copy(); bpy.context.scene.collection.objects.link(b); baked.append(b)
for o in meshes: bpy.data.objects.remove(o)
# The pose becomes the rest pose, and the skeleton gets one bone that never moves (for what stands on the floor).
for o in bpy.context.selected_objects: o.select_set(False)
rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='EDIT')
still = rig.data.edit_bones.new('still'); still.head = (0, 0, 0); still.tail = (0, 0, .1)
bpy.ops.object.mode_set(mode='OBJECT'); rig.select_set(False)
for o in extras:
    if o.type != 'MESH': continue
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    o.vertex_groups.new(name=extra_bone.get(o.name) or 'still').add(range(len(o.data.vertices)), 1., 'REPLACE')
baked += extras

# Skin under clothing pokes through once the body is posed. Any body face with cloth just outside it goes.
from mathutils.bvhtree import BVHTree  # noqa: E402
import bmesh  # noqa: E402
body = next(b for b in baked if b.name == base_name + '.baked')
SMALL = ('low-poly', 'teeth', 'tongue', 'eyebrow', 'eyelash', 'glasses')
cloth = [b for b in baked if b is not body and b not in extras and not any(k in b.name.lower() for k in SMALL) and not (who.get('hair') and who['hair'] in b.name)]
# Outer garments first, in the order the character lists them: each layer loses the faces a layer above it covers.
order = {name: i for i, name in enumerate(garments.names(who) + who['clothes'])}
cloth.sort(key=lambda b: order.get(b.name.split('.', 1)[-1].replace('.baked', ''), 99))


def tree_of(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world); t = BVHTree.FromBMesh(bm); bm.free(); return t


def cull_under(o, trees, reach, through=.018, corners=False, whole=False, tuck=False):
    if not trees: return
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world); bm.normal_update()
    # Covered: a layer above lies just outside the face (within `reach`), or the face has pushed out through that
    # layer (by up to `through`). corners: a face with only a corner through the layer above goes too. whole: a face
    # goes only if all of it is covered (skin at the edge of a neckline stays, or the opening shows holes).
    # tuck (round three, instead of corners): a corner that has come through the layer above is put back under it.
    # Taking the whole face away for one corner left a notch at every hem (a sleeve's end, a sweater's edge); leaving
    # it left a fleck of skin or trouser on the garment. The hands are never under cloth: they are left alone.
    def behind(p, n, far): return any(t.ray_cast(p - n * .0005, -n, far)[0] is not None for t in trees)
    def under(p, n): return any(t.ray_cast(p + n * .0005, n, reach)[0] is not None or t.ray_cast(p - n * .0005, -n, through)[0] is not None for t in trees)
    weights = bm.verts.layers.deform.active; hand = {g.index for g in o.vertex_groups if g.name.startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_'))}
    def of_hand(v): return bool(tuck and weights and hand) and sum(w for g, w in v[weights].items() if g in hand) > .5
    def hidden(f):
        c = f.calc_center_median()
        if tuck and all(of_hand(v) for v in f.verts): return False
        if whole and tuck and behind(c, f.normal, max(through, .03)): return True          # (all of it has pushed out through the layer)
        if whole: return under(c, f.normal) and all(under(v.co, f.normal) for v in f.verts)
        if any(t.ray_cast(c + f.normal * .0005, f.normal, reach)[0] is not None or t.ray_cast(c - f.normal * .0005, -f.normal, through)[0] is not None for t in trees): return True
        return corners and not tuck and any(t.ray_cast(v.co - f.normal * .0005, -f.normal, through)[0] is not None for v in f.verts for t in trees)
    covered = [f for f in bm.faces if hidden(f)]
    bmesh.ops.delete(bm, geom=covered, context='FACES')
    if tuck:
        bm.normal_update()
        for v in bm.verts:
            if of_hand(v) or not v.link_faces: continue
            hits = [h for h in (t.ray_cast(v.co - v.normal * .0005, -v.normal, min(through, .02)) for t in trees) if h[0] is not None]
            if hits: v.co = min(hits, key=lambda h: h[3])[0] - v.normal * .003
    bm.transform(o.matrix_world.inverted()); bm.to_mesh(o.data); bm.free()


# Heavy garments (knitwear, long skirts) come down to a budget; the silhouette survives it.
for c in cloth:
    c.data.calc_loop_triangles(); n = len(c.data.loop_triangles)
    if n > 14000:
        mod = c.modifiers.new('Budget', 'DECIMATE'); mod.ratio = 14000 / n
        dg2 = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(c.evaluated_get(dg2), preserve_all_data_layers=True, depsgraph=dg2); c.modifiers.clear(); old = c.data; c.data = me; bpy.data.meshes.remove(old)
trees = [tree_of(c) for c in cloth]
made = len(garments.names(who))      # (garments made from the base mesh: smooth shells with cut necklines)
# (round three: skin goes only where all of a face is covered, so a collar's edge has no notches of missing neck)
cull_under(body, trees, .035, whole=made > 0 or LOOK >= 3, tuck=LOOK >= 3)
# A garment can push further out through the one over it than skin does (a trouser yoke through the back of a shirt).
# (what is under a shell shows at every corner that pokes through it)
# (a headscarf is laid over the clothes as they are: nothing under it needs to go)
# (round three: a corner of what is under a garment that pokes through it is tucked back under: the flecks of trouser along a sweater's hem)
for i, c in enumerate(cloth[1:], 1): cull_under(c, [t for t, b in zip(trees[:i], cloth) if b.name.split('.', 1)[-1].replace('.baked', '') not in garments.OVER], .025, .045, corners=i >= 1 and made > 0 and c.name.split('.', 1)[-1].replace('.baked', '') in who['clothes'], tuck=LOOK >= 3)
bpy.ops.object.select_all(action='DESELECT')
for b in baked: b.select_set(True)
bpy.context.view_layer.objects.active = baked[0]; bpy.ops.object.join(); person = bpy.context.object; person.name = OUT_ID
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bone_names = {b.name for b in rig.data.bones}
for g in list(person.vertex_groups):
    if g.name not in bone_names: person.vertex_groups.remove(g)
loose = [v.index for v in person.data.vertices if not v.groups]
if loose: (person.vertex_groups.get('still') or person.vertex_groups.new(name='still')).add(loose, 1., 'REPLACE')
bpy.ops.object.shade_smooth()
# Feet on the floor: the lowest point of the model sits at Z = 0.
low = min((person.matrix_world @ v.co).z for v in person.data.vertices)
if spec.get('ground', True): person.location.z -= low; rig.location.z -= low
rig.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); rig.select_set(False)
person.parent = rig; person.matrix_parent_inverse.identity()
person.modifiers.new('Skeleton', 'ARMATURE').object = rig

person.data.calc_loop_triangles()
co = np.array([v.co[:] for v in person.data.vertices])
result = {'id': OUT_ID, 'ok': True, 'tris': len(person.data.loop_triangles),
          # glTF axes (Y up): x = x, y = z, z = -y; millimetres.
          'min': [round(float(co[:, 0].min()) * 1000, 1), round(float(co[:, 2].min()) * 1000, 1), round(float(-co[:, 1].max()) * 1000, 1)],
          'max': [round(float(co[:, 0].max()) * 1000, 1), round(float(co[:, 2].max()) * 1000, 1), round(float(-co[:, 1].min()) * 1000, 1)],
          'alpha': {m.name: m.get('alpha', 'OPAQUE') for m in person.data.materials}, 'cutoff': {m.name: m['cutoff'] for m in person.data.materials if m.get('cutoff')}, 'bones': len(rig.data.bones), 'loose': len(loose)}
result['size'] = [round(result['max'][i] - result['min'][i], 1) for i in range(3)]

os.makedirs(OUT_DIR, exist_ok=True)
rig.select_set(True); person.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, OUT_ID + '.glb'), export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_materials='EXPORT', export_image_format='AUTO', export_animations=False, export_skins=True, export_morph=False,
                          export_def_bones=False, export_rest_position_armature=True)
print('RESULT ' + json.dumps(result))

if PREVIEW:
    scene = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=8); floor = bpy.context.object
    m = bpy.data.materials.new('floor'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs[0].default_value = (.62, .6, .58, 1); floor.data.materials.append(m)
    cam = bpy.data.cameras.new('c'); co_ = bpy.data.objects.new('c', cam); scene.collection.objects.link(co_); scene.camera = co_; cam.lens = 55
    sun = bpy.data.lights.new('s', 'SUN'); so = bpy.data.objects.new('s', sun); scene.collection.objects.link(so); so.rotation_euler = (math.radians(52), 0, math.radians(35)); sun.energy = 3.2; sun.angle = .15
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.82, .86, .92, 1)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True; scene.render.resolution_x = 560; scene.render.resolution_y = 760
    mid = Vector((0, 0, (result['max'][1] / 1000) * .55))
    for tag, loc in (('a', (1.9, -2.6, 1.35)), ('b', (-2.9, -.4, 1.2))):
        co_.location = loc; co_.rotation_euler = (mid - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{PREVIEW}-{tag}.png'; bpy.ops.render.render(write_still=True)
