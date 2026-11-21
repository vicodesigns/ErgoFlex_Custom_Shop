#!/usr/bin/env python3
"""Chapter 2 (rise) of Vico's 3rd cuts, Nov 21 2026: the calm Overhead Triceps Stretch (Vico: 'it moves too fast into it and too wildly').

  apply-rise.py <cut dir> B|A <patch.json> [--only-extras]
      B = seated (exports/cinematic-intro-cut-vicos-3rd-cut), A = standing (exports/cinematic-intro-cut-vicos-3rd-cut-standing).
      patch.json: the by-key pose keys of docs/rise-wellness/build-rise.mjs ({ "<posture id>": [keys] }).
  The chapter grows 23.5 -> 28.5 s: everything from the stretch's end on moves 5 s later (the end beat is kept as it was, 5 s later).
  What is changed, and nothing else:
    seconds 23.5 -> 28.5
    cameraPlan keys after the 'stretch framing' key (B: 17.9, 23.5; A: 14.45, 14.95, 18.15, 23.5): + 5 s; camera re-baked (camera-spline.mjs)
    A only: motion clips, ledStatus and people.when.maya-waits from the old lift-down (14.95) on: + 5 s
    people.cast[maya-stand].postures[<posture>].poseKeys = the patch
    screens[phone].brightness: the 'bright until the cheer ends' pair + 5.2 s (B: 19.8, 20.3 -> 25.0, 25.5; A: 16.2, 16.7 -> 21.4, 21.9)
    timeOfDay 'evening' 16.5 -> 21.5; ledNeutral 14.9, 16.5 -> 19.9, 21.5
  --only-extras: after the Director importer (build-round8-director.py --import <export doc>, then the pass) has set seconds, camera, clips
      and people, set only the fields the Director does not carry (phone brightness, timeOfDay, ledNeutral; A: ledStatus is re-timed by the pass,
      people.when comes with the doc).
  Writes review-cut.json, director-film/rise.json and director-camera-rise.json (format kept: indent 1, LF, no final newline).
  The screens (cine3b-/cine3a-rise-*.mp4) follow the new beats in tools/experience/screens/clips.mjs (RISE_STRETCH_B / _A): re-capture them.
  Afterwards: build-round8-director.py <cut> --pages rise, build-cine-score.py <cut> (EDL + score: the film is 5 s longer).
"""
import copy, json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', '..', 'tools', 'experience')
OLD, NEW, SHIFT = 23.5, 28.5, 5.0
V = {'B': dict(posture='people-maya-sit-type', after=13.2, bright=(19.8, 20.3), cheer=5.2),
     'A': dict(posture='people-maya-stand-type-41', after=14.4, bright=(16.2, 16.7), cheer=5.2)}
def load(p): return json.load(open(p, encoding='utf-8'))
def dump(p, d):   # (the file's own style is kept: some of the cut's files escape non-ASCII, some do not)
    raw = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8', newline=chr(10)).write(json.dumps(d, indent=1, ensure_ascii=raw.isascii()))
def r3(x): return round(float(x), 4)
def bake(seconds, plan):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
        json.dump({'seconds': seconds, 'cameraPlan': plan}, t); tmp = t.name
    try:
        subprocess.run(['node', os.path.join(TOOLS, 'camera-spline.mjs'), tmp], check=True, stdout=subprocess.DEVNULL)
        return load(tmp)['camera']
    finally: os.unlink(tmp)

cut, mode, patch = sys.argv[1].rstrip('/' + chr(92)), sys.argv[2], load(sys.argv[3]); extras = '--only-extras' in sys.argv
D = V[mode]; after = D['after']
rc = os.path.join(cut, 'review-cut.json'); cutd = load(rc)
shot = next(s for s in cutd['shots'] if s['id'] == 'rise')
late = lambda t: t > after + 1e-6
if not extras:
    if abs(shot['seconds'] - OLD) > 1e-6 and abs(shot['seconds'] - NEW) > 1e-6: sys.exit('rise is neither the 23.5 s nor the 28.5 s chapter')
    first = abs(shot['seconds'] - OLD) < 1e-6
    if first:
        shot['seconds'] = NEW
        for k in shot['cameraPlan']['keys']:
            if late(k['at']): k['at'] = r3(k['at'] + SHIFT)
        shot['camera'] = bake(NEW, shot['cameraPlan'])
        if mode == 'A':
            for c in shot['motion']['clips']:
                if late(c['start']): c['start'] = r3(c['start'] + SHIFT)
            for e in shot['ledStatus']:
                if late(e['at']): e['at'] = r3(e['at'] + SHIFT)
            for w in shot['people']['when']['maya-waits']:
                if late(w[0]): w[0] = r3(w[0] + SHIFT); w[1] = r3(w[1] + SHIFT)
    cast = next(c for c in shot['people']['cast'] if c['key'] == 'maya-stand')
    cast['postures'][D['posture']]['poseKeys'] = copy.deepcopy(patch[D['posture']])
# the fields the Director does not carry (set by value, so a second run changes nothing)
b0, b1 = D['bright']
for s in shot['screens']:
    if s['target'] == 'phone':
        for pair in s['brightness']:
            if abs(pair[0] - b0) < 1e-6: pair[0] = r3(b0 + D['cheer'])
            elif abs(pair[0] - b1) < 1e-6: pair[0] = r3(b1 + D['cheer'])
for e in shot['timeOfDay']:
    if abs(e['at'] - 16.5) < 1e-6 and e['mode'] == 'evening': e['at'] = 21.5
for e in shot['ledNeutral']:
    if abs(e[0] - 14.9) < 1e-6: e[0] = 19.9
    elif abs(e[0] - 16.5) < 1e-6: e[0] = 21.5
cutd['shots'] = [shot if s['id'] == 'rise' else s for s in cutd['shots']]
dump(rc, cutd)
dump(os.path.join(cut, 'director-film', 'rise.json'), shot)
if not extras:
    dc = os.path.join(cut, 'director-camera-rise.json'); d = load(dc)
    d['seconds'] = shot['seconds']; d['keys'] = shot['cameraPlan']['keys']; d['clips'] = shot['motion']['clips']
    d['people'] = {'v': 2, **shot['people']} if 'v' in d['people'] else shot['people']
    dump(dc, d)
pk = next(c for c in shot['people']['cast'] if c['key'] == 'maya-stand')['postures'][D['posture']]['poseKeys']
print(f'rise: {mode}, {shot["seconds"]} s, camera keys at {[k["at"] for k in shot["cameraPlan"]["keys"]]}, {len(pk)} pose keys' + (' (extras only)' if extras else ''))
