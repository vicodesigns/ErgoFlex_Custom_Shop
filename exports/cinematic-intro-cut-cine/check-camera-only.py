#!/usr/bin/env python3
"""Check that this cut differs from its source ("Vico's cut with people") only in camera fields.

    python exports/cinematic-intro-cut-cine/check-camera-only.py [source review-cut.json]

Compares every field of every chapter (and the top level) of this folder's review-cut.json with the source cut,
except `camera` and `cameraPlan`; also the chapter order and seconds, and the other film-data files this folder
copied from the source (compared as JSON, so line endings do not matter). Exit status 1 on any difference.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC_DIR = os.path.join(ROOT, 'exports', 'cinematic-intro-20261110-people')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SRC_DIR, 'review-cut.json')
CAMERA = {'camera', 'cameraPlan'}


def load(p):
    with open(p, encoding='utf-8') as f: return json.load(f)


def diff(a, b, path, out):
    if type(a) != type(b): out.append(f'{path}: type {type(a).__name__} != {type(b).__name__}'); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append(f'{path}.{k}: only in {"source" if k in a else "cine"}')
            else: diff(a[k], b[k], f'{path}.{k}', out)
    elif isinstance(a, list):
        if len(a) != len(b): out.append(f'{path}: length {len(a)} != {len(b)}')
        for i, (x, y) in enumerate(zip(a, b)): diff(x, y, f'{path}[{i}]', out)
    elif a != b: out.append(f'{path}: {a!r} != {b!r}')


src, cine = load(SRC), load(os.path.join(HERE, 'review-cut.json'))
problems = []
diff({k: v for k, v in src.items() if k != 'shots'}, {k: v for k, v in cine.items() if k != 'shots'}, 'cut', problems)
if [s['id'] for s in src['shots']] != [s['id'] for s in cine['shots']]: problems.append('chapter order differs')
changed = []
for a, b in zip(src['shots'], cine['shots']):
    diff({k: v for k, v in a.items() if k not in CAMERA}, {k: v for k, v in b.items() if k not in CAMERA}, a['id'], problems)
    if any(a.get(k) != b.get(k) for k in CAMERA): changed.append(a['id'])
for rel in ('titles-src.json', 'director-camera-oilers.json', os.path.join('shots', '13-subshots.json')):
    p, q = os.path.join(SRC_DIR, rel), os.path.join(HERE, rel)
    # director-camera-oilers.json was removed from this cut on purpose (a Director pass would put his oilers keys back)
    if os.path.exists(p) and os.path.exists(q) and load(p) != load(q): problems.append(f'{rel} differs from the source')
    if os.path.exists(p) and not os.path.exists(q) and rel != 'director-camera-oilers.json': problems.append(f'{rel} missing')

print('source:', os.path.relpath(SRC, ROOT))
print('chapters:', len(cine['shots']), 'seconds:', [s['seconds'] for s in cine['shots']], 'total', round(sum(s['seconds'] for s in cine['shots']), 3))
print('camera changed in:', ', '.join(changed) or 'none')
print('camera unchanged in:', ', '.join(s['id'] for s in cine['shots'] if s['id'] not in changed) or 'none')
if problems:
    print('DIFFERENCES OUTSIDE THE CAMERA:'); [print('  ' + p) for p in problems[:200]]; sys.exit(1)
print('OK: every field other than camera/cameraPlan is identical to the source.')
