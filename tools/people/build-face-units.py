"""Rebuild the Director cast's UV-indexed facial poses from the CC0 MakeHuman MPFB data.
Run with python3 tools/people/build-face-units.py (BLENDER_USER_RESOURCES as for build.py).
UVs survive the Blender wardrobe masks, posing, glTF vertex splits and mesh compression.
"""
import json
import os
from pathlib import Path

import numpy as np

here = Path(__file__).resolve().parent
extensions = Path(os.environ.get('BLENDER_USER_RESOURCES', '~/blender/mpfb-user')).expanduser() / 'extensions'
data = extensions / 'user_default/mpfb/data'
proxies = extensions / '.user/user_default/mpfb/data'
landmarks = [14, 6798, 5192, 608]  # outer eye corners, centre of forehead, centre below lip


def obj(path, body=False):
    xyz, uv, faces = [], [], []
    group = ''
    for line in path.read_text().splitlines():
        words = line.split()
        if not words:
            continue
        if words[0] == 'v':
            xyz.append(list(map(float, words[1:4])))
        elif words[0] == 'vt':
            u, v = map(float, words[1:3])
            uv.append(round(u * 4095) * 4096 + round((1 - v) * 4095))
        elif words[0] == 'g':
            group = words[1]
        elif words[0] == 'f' and (not body or group == 'body'):
            faces.append([tuple(int(n) - 1 for n in corner.split('/')[:2]) for corner in words[1:]])
    return np.array(xyz), uv, faces


xyz, uvs, faces = obj(data / '3dobjs/base.obj', body=True)


def unit(name):
    # Use the mean of the three supplied fits, then size it to the actual actor's face.
    delta = np.zeros_like(xyz)
    for path in sorted((data / 'targets/expression/units').glob('*/' + name + '.target.gz')):
        rows = np.loadtxt(path)
        delta[rows[:, 0].astype(int)] += rows[:, 1:4] / 3
    return delta


def pair(name):
    return unit(name.replace('SIDE', 'left')) + unit(name.replace('SIDE', 'right'))


smile = (.86 * unit('mouth-corner-puller') + .12 * unit('mouth-upward-retraction')
         + .12 * unit('mouth-elevation') + .14 * pair('nose-SIDE-elevation') + .23 * pair('eye-SIDE-slit'))
# The malar pad rises under the outer eye. Feather the lift to the orbital rim and nose.
x, y, z = xyz.T
cheek = np.exp(-((abs(x) - .44) / .255) ** 2 - ((y - 7.04) / .22) ** 2) * np.clip((z - .90) / .42, 0, 1)
smile[:, 1] += .029 * cheek
smile[:, 2] += .020 * cheek
# Leave a small difference in how strongly the two mouth corners draw back.
smile *= (1 - .075 * np.tanh(4 * x))[:, None]
shapes = [smile, pair('eye-SIDE-closure'), .58 * pair('eyebrows-SIDE-inner-up') + .40 * pair('eyebrows-SIDE-up')]


def normals(points, polygons):
    triangles = np.array([(f[0][0], f[i][0], f[i + 1][0]) for f in polygons for i in range(1, len(f) - 1)])
    a, b, c = triangles.T
    areas = np.cross(points[b] - points[a], points[c] - points[a])
    result = np.zeros_like(points)
    for column in triangles.T:
        np.add.at(result, column, areas)
    return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-9)


def records(points, tex, polygons, deltas, skin=False):
    rest = normals(points, polygons)
    channels = []
    for delta in deltas:
        channels.append(np.rint(delta * 10000).astype(int))
        if skin:
            channels.append(np.rint((normals(points + delta, polygons) - rest) * 1000).astype(int))
    packed = np.column_stack(channels)
    rows = {}
    for poly in polygons:
        for vertex, vt in poly:
            row = packed[vertex]
            if row.any():
                # Some brow and lash cards reuse UVs on the other side of the face.
                key = tex[vt] * 2 + int(points[vertex, 0] > 0)
                rows[key] = row.tolist()
    return [[k, *rows[k]] for k in sorted(rows)]


# A small lip seal reads as concentration before a reach or a screen cue.
# It lives on the skin only. Brow and eyelash cards keep their three poses.
tables = {'body': records(xyz, uvs, faces, [*shapes, unit('mouth-compression')], True)}
keys = [next(uvs[t] for f in faces for i, t in f if i == idx) for idx in landmarks]
for path in sorted(list(proxies.glob('eyebrows/*/*.mhclo')) + list(proxies.glob('eyelashes/*/*.mhclo'))):
    if path.stem not in {'eyebrow001', 'eyebrow004', 'eyebrow005', 'eyebrow006', 'eyebrow009',
                         'eyebrow011', 'eyebrow012', 'eyelashes01', 'eyelashes02', 'eyelashes03'}:
        continue
    points, tex, polygons = obj(path.with_suffix('.obj'))
    fits = []
    for line in path.read_text().split('verts 0\n', 1)[1].splitlines():
        fields = line.split()
        if not fields or fields[0].startswith('#'):
            continue
        if not fields[0].isdigit():
            break
        ids = [int(v) for v in fields[:3]]
        fits.append((ids, [float(v) for v in fields[3:6]] if len(ids) == 3 else [1.]))
    assert len(fits) == len(points), path
    deltas = [np.array([np.average(d[ids], axis=0, weights=w) for ids, w in fits]) for d in shapes]
    tables[path.stem] = records(points, tex, polygons, deltas)

out = here.parent.parent / 'assets/motion/cast-face-units.mjs'
with out.open('w') as f:
    f.write('// Generated by tools/people/build-face-units.py from CC0 MakeHuman expression units.\n')
    f.write('export const landmarks = ' + json.dumps(keys) + ';\nexport const units = {\n')
    for name, rows in tables.items():
        f.write(json.dumps(name) + ':[\n')
        for row in rows:
            f.write(json.dumps(row, separators=(',', ':')) + ',\n')
        f.write('],\n')
    f.write('};\n')
