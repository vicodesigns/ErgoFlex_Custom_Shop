#!/usr/bin/env python3
"""Note what this cut changes against "Vico's cut with people" outside the camera (informational since Nov 14).

    python exports/cinematic-intro-cut-cine/check-camera-only.py [--strict] [source review-cut.json]

Since November 14 2026 this cut is the WORKING CUT: people, props, screens, desk moves and cameras are edited here
directly, and it no longer has to match the cut with people outside the camera. This script now only reports what
differs (every field except `camera`/`cameraPlan`, the chapter order and seconds, and the film-data files first
copied from the source, compared as JSON), so a reviewer can see which chapters carry their own staging. It exits 0;
`--strict` restores the old rule (exit 1 on any difference outside the camera).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC_DIR = os.path.join(ROOT, 'exports', 'cinematic-intro-20261110-people')
STRICT = '--strict' in sys.argv
ARGS = [a for a in sys.argv[1:] if a != '--strict']
SRC = ARGS[0] if ARGS else os.path.join(SRC_DIR, 'review-cut.json')
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
    staged = sorted({p.split('.')[0].split('[')[0] for p in problems})
    print('NOTE: differences outside the camera (expected: this is the working cut), in:', ', '.join(staged))
    [print('  ' + p) for p in problems[:200]]
    if STRICT: sys.exit(1)
else:
    print('OK: every field other than camera/cameraPlan is identical to the source.')
