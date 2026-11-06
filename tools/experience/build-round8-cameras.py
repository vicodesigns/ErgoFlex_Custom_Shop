#!/usr/bin/env python3
"""HQ36 (Vico, 2026-11-05: "get a cinematographer for each chapter to critique the cameras ... the camera flies around in
there and then it centers on the desk, but it kind of reveals more of the cool room and the details"): each chapter's
reviewed camera (and, where the chapter's story changed, its moves / status lights / props) as a small override file,
applied after every other room builder and before the Director pass (build-round8-director.py, which still wins for a
chapter with a director-camera-<id>.json).

    flock /tmp/claude-1000/hq14-cut.lock python3 tools/experience/build-round8-cameras.py exports/cinematic-intro-20261104-hq14

tools/experience/film-cameras/<id>.json:
  {"id": "<chapter id>", "notes": "...", "set": {<shot field>: <value>, ...},
   "sceneEditsAdd": [<sceneEdit>, ...],            # appended (an earlier copy with the same match/path/near replaced)
   "subshots": {"<index>": {"set": {...}}}}        # hero only: shots/13-subshots.json entries
"set" replaces whole fields (seconds, cameraPlan, motion, ledStatus, accessories, timeOfDay, screens, ...). A set
cameraPlan is baked to "camera" with camera-spline.mjs at the shot's (new) length. Values are absolute: re-runs are safe.
"""
import glob, json, os, subprocess, sys, tempfile

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
SPLINE = os.path.join(HERE, 'camera-spline.mjs')
_baked = {}


def bake(seconds, plan):
    k = json.dumps([seconds, plan])
    if k not in _baked:
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
            json.dump({'seconds': seconds, 'cameraPlan': plan}, f); tmp = f.name
        try:
            subprocess.run(['node', SPLINE, tmp], check=True, stdout=subprocess.DEVNULL)
            _baked[k] = json.load(open(tmp))['camera']
        finally:
            os.unlink(tmp)
    return json.loads(json.dumps(_baked[k]))


def same(a, b): return (a.get('match'), a.get('path'), a.get('near')) == (b.get('match'), b.get('path'), b.get('near'))


def apply(s, o):
    for k, v in o.get('set', {}).items(): s[k] = json.loads(json.dumps(v))
    if o.get('sceneEditsAdd'):
        add = o['sceneEditsAdd']
        s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if not any(same(e, a) for a in add)] + add
    if 'cameraPlan' in o.get('set', {}): s['camera'] = bake(s['seconds'], s['cameraPlan'])
    return s


over = {}
for p in sorted(glob.glob(os.path.join(HERE, 'film-cameras', '*.json'))):
    o = json.load(open(p)); over[o['id']] = o
cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
for s in cut['shots']:
    if s['id'] in over: apply(s, over[s['id']])
json.dump(cut, open(cut_path, 'w'), indent=1)
for f in sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json'))):
    d = json.load(open(f))
    if d.get('id') in over and 'shots' not in d: json.dump(apply(d, over[d['id']]), open(f, 'w'), indent=1)
hero = over.get('hero', {}).get('subshots')
if hero:
    sp = os.path.join(H, 'shots', '13-subshots.json'); sub = json.load(open(sp))
    shots = sub['shots'] if isinstance(sub, dict) else sub
    for i, o in hero.items(): apply(shots[int(i)], o)
    json.dump(sub, open(sp, 'w'), indent=1)
print('cameras:', ', '.join(sorted(over)) or 'none')
