#!/usr/bin/env python3
"""Chapter 2 (rise) of Vico's 3rd cuts: the app's Overhead Triceps Stretch (overhead_triceps_stretch_01), Nov 20 2026.

  build-rise-stretch.py <cut dir> B|A
      B = seated (exports/cinematic-intro-cut-vicos-3rd-cut): she stands and works, the desk lowers (9.45 s as before),
          she sits and does the stretch seated (right arm ~1.5 s, left arm ~3 s, no pause), the congratulations, then types.
      A = standing (exports/cinematic-intro-cut-vicos-3rd-cut-standing): she stands, types ~2 s, stretches standing, the
          good job, then the desk lowers and she sits (everything from the old lift-down on moves 5.5 s later).
  Both: chapter 18 -> 23.5 s; pose keys on Maya's cast entry (tools/experience/rise-stretch-data.json), camera keys for the arms
  overhead (the plan's other keys are kept, later ones move), the rise screens point at <cut dir>/screens/. Data edits only.
Writes the chapter in review-cut.json, director-film/rise.json and director-camera-rise.json (format kept: indent 1, LF,
no final newline). Run build-cine-score.py on the cut afterwards.
"""
import copy, json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SKIN = 0.25
def load(p): return json.load(open(p, encoding='utf-8'))
def dump(p, d): open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=1, ensure_ascii=True))
def bake(seconds, plan):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
        json.dump({'seconds': seconds, 'cameraPlan': plan}, t); tmp = t.name
    try:
        subprocess.run(['node', os.path.join(HERE, 'camera-spline.mjs'), tmp], check=True, stdout=subprocess.DEVNULL)
        return load(tmp)['camera']
    finally: os.unlink(tmp)
def r3(x): return round(float(x), 4)

cut, mode = sys.argv[1].rstrip('/' + chr(92)), sys.argv[2]
D = load(os.path.join(HERE, 'rise-stretch-data.json'))[mode]
rel = 'exports/' + os.path.basename(os.path.abspath(cut))
rc = os.path.join(cut, 'review-cut.json'); cutd = load(rc)
shot = next(s for s in cutd['shots'] if s['id'] == 'rise')
OLD, NEW = 18.0, D['seconds']
if shot['seconds'] == NEW:   # already built: only the pose keys of the stretch are set again (arms rest before and after)
    cast = next(c for c in shot['people']['cast'] if c['key'] == 'maya-stand'); pk = cast['postures'][D['posture']]['poseKeys']
    first = D['poseKeys'][0]['t']; pk[:] = [k for k in pk if k['t'] < first - 1e-6] + copy.deepcopy(D['poseKeys']); pk.sort(key=lambda k: k['t'])
    shot['people']['skinRelief'] = SKIN   # Vico: Maya looks too HD in chapter 2 (the skin relief map at close framings): a quarter of the relief
    cutd['shots'] = [shot if s['id'] == 'rise' else s for s in cutd['shots']]; dump(rc, cutd); dump(os.path.join(cut, 'director-film', 'rise.json'), shot)
    dc = os.path.join(cut, 'director-camera-rise.json'); d = load(dc); d['people'] = {'v': 2, **shot['people']} if 'v' in d['people'] else shot['people']; dump(dc, d)
    print(f'rise: {mode}, pose keys set again ({len(pk)})'); sys.exit(0)
if shot['seconds'] != 18: sys.exit('rise is not the 18 s chapter')
shift, after = (D['shift'], D['after']) if mode == 'A' else (NEW - OLD, 12.65)   # B: only the closing 5.5 s are new, after she sits
shot['seconds'] = NEW
shot['people']['skinRelief'] = SKIN   # (see the rebuild branch above)
if mode == 'A':
    for c in shot['motion']['clips']:
        if c['start'] >= after - 1e-6: c['start'] = r3(c['start'] + shift)
    for e in shot['ledStatus']:
        if e['at'] >= after - 1e-6: e['at'] = r3(e['at'] + shift)
    for w in shot['people']['when']['maya-waits']:
        if w[0] >= after - 1e-6: w[0] = r3(w[0] + shift); w[1] = r3(w[1] + shift)
keys = []
for k in shot['cameraPlan']['keys']:
    keys.append({**k, 'at': r3(k['at'] + shift)} if k['at'] > after + 1e-6 else k)
    if abs(k['at'] - after) < 1e-6: keys.extend(copy.deepcopy(D['camera']))
    if k['at'] > after + 1e-6 and mode == 'A' and k is shot['cameraPlan']['keys'][-1]: pass
if mode == 'A':   # the lowering view is the plan's old key at `after`: it now begins at after + shift, so repeat it there
    old = next(k for k in shot['cameraPlan']['keys'] if abs(k['at'] - after) < 1e-6)
    i = max(j for j, k in enumerate(keys) if k['at'] < after + shift - 1e-6)
    keys.insert(i + 1, {**copy.deepcopy(old), 'at': r3(after + shift), 'label': 'Desk lowers: Maya sits again'})
keys.sort(key=lambda k: k['at'])
shot['cameraPlan']['keys'] = keys
shot['camera'] = bake(NEW, shot['cameraPlan'])
cast = next(c for c in shot['people']['cast'] if c['key'] == 'maya-stand')
pk = cast['postures'][D['posture']].setdefault('poseKeys', [])
pk.extend(copy.deepcopy(D['poseKeys'])); pk.sort(key=lambda k: k['t'])
# screens: this cut's own (regenerated with tools/experience/screens/capture.mjs, CINE_CUT=<cut>/review-cut.json)
for s in shot['screens']:
    kind = os.path.basename(s['src']).replace('.mp4', '').split('-')[-1]; s['src'] = f'{rel}/screens/cine3{mode.lower()}-rise-{kind}.mp4'
    if s['target'] == 'phone':   # the stretch push lights the phone: bright over the stretch and the cheer, then back to the quiet glow
        st = D['screens']; s['brightness'] = [[0, 1], [3.4, 1], [5, 0.6], [st[0] - .4, 0.6], [st[0], 1], [st[1], 1], [st[1] + .5, 0.6]]
cutd['shots'] = [shot if s['id'] == 'rise' else s for s in cutd['shots']]
dump(rc, cutd)
dump(os.path.join(cut, 'director-film', 'rise.json'), shot)
dc = os.path.join(cut, 'director-camera-rise.json'); d = load(dc)
d['seconds'] = NEW; d['keys'] = shot['cameraPlan']['keys']; d['clips'] = shot['motion']['clips']; d['people'] = {'v': 2, **shot['people']} if 'v' in d['people'] else shot['people']
dump(dc, d)
print(f'rise: {mode}, {OLD} -> {NEW} s, {len(shot["camera"]["keys"])} baked camera keys, {len(pk)} pose keys')
