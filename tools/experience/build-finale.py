#!/usr/bin/env python3
"""Chapter 13 ('hero') as the finale, v2 (HQ9): six desks, six positions, one continuous performance.

    python3 tools/experience/build-finale.py exports/cinematic-intro-20261103-hq9

Writes <dir>/shots/13.json and <dir>/shots/13-subshots.json (six copies of the chapter that share ONE
desk performance, ONE camera and ONE light rig, and differ only in preset, exposure and renderRange) and
sets the chapter to 23 s in review-cut.json. Because pose and lens are identical in both renders at each
seam, join-subshots.py --transition fade (0.6 s, centred on the bar lines) only blends the finish and the
accessories: the desk never doubles. Vico (round 4): each desk in its own position (painter, drafter,
gamer near sitting, professional standing), a real blend, the two white desks split up, better light,
end on gaming at sitting with the ergonomic keyboard.

  A artist 0.00-3.12 (painter 65)   B occ 2.52-5.19 (tilting)      C architect 4.59-7.26 (drafting 35)
  D hbhs 6.66-9.33 (reading 10)     E office 8.73-11.40 (rises to standing 46 in)
  F gaming 10.80-23.00 (comes down to sitting 28 in, ergonomic keyboard: kind 'glide' triggers the
    stage's own keyboard swap)
Camera and timing: /home/ergo/logs/cinematography_review_round4_2026-11-03.md (ch 13). Light:
/home/ergo/logs/lighting_review_round4_2026-11-03.md (section 1): flag the top, light from the side,
edges for the black frames, expose per finish. Opens at 43.5 in / 65 deg, the pose of ch 12's folded
desk, so the ch 12 > 13 dissolve is a match dissolve. Render with post/finale-seed.json
(tools/studio-state/derive-seed.mjs --zero-preset-poses: the saved builds carry their own desk poses).
"""
import json, os, subprocess, sys, copy
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 23
LOOKS = [('A', 'artist', 0.00, 3.12), ('B', 'occ', 2.52, 5.19), ('C', 'architect', 4.59, 7.26),
         ('D', 'hbhs', 6.66, 9.33), ('E', 'office', 8.73, 11.40), ('F', 'gaming', 10.80, 23.00)]
LIGHT = {'artist', 'architect', 'office', 'occ'}                      # light finishes: softer rims
EXPOSURE = {'gaming': .95, 'hbhs': .95, 'office': .85, 'occ': .85, 'architect': .70, 'artist': .65}

def clip(id, lane, start, dur, target):
    return {'id': id, 'lane': lane, 'kind': lane, 'start': start, 'duration': dur, 'easing': 'smooth', 'label': '', 'target': target}
clips = [clip('f1', 'tilt', 2.4, 2.2, 35), clip('f2', 'lift', 2.6, 1.8, 40),       # painter to drafting, through seam 2.82
         clip('f3', 'tilt', 6.4, 1.8, 10), clip('f4', 'lift', 6.6, 1.2, 38),        # through seam 6.96
         clip('f5', 'tilt', 8.5, 1.0, 0), clip('f6', 'lift', 8.4, 2.4, 46),         # the professional rises to standing
         clip('f7', 'lift', 11.9, 5.1, 28)]                                           # gaming comes back down to sitting

key = lambda at, p, t, fov, **kw: dict(at=at, position=p, target=t, fov=fov, **kw)
camera = {'easeIn': False, 'easeOut': True, 'keys': [
    key(0.0, [4.5, 2.05, 8.3], [-1.276, 1.2, 0.744], 26, label='Ch 12 match: the painter'),
    key(2.8, [4.985, 2.677, 7.12], [-0.737, 1.3, 0.516], 27),
    key(4.9, [5.672, 2.807, 5.289], [-0.477, 1.3, 0.512], 28, label='Architect, drafting'),
    key(7.0, [6.076, 2.92, 3.508], [-0.25, 1.3, 0.433], 29),
    key(9.0, [6.217, 2.921, 1.901], [-0.088, 1.3, 0.287], 30, label='Office rises'),
    key(11.1, [6.309, 2.762, 0.552], [0.0, 1.3, 0.0], 30, label='Gaming, face-on'),
    key(13.6, [6.827, 2.316, -0.959], [0.084, 1.1, 0.594], 29),
    key(16.2, [7.783, 1.899, -2.38], [0.117, 0.9, 0.383], 28),
    key(19.9, [9.403, 1.275, -4.385], [0.0, 0.55, 0.0], 26, label='Pull back for the end card'),
    key(23.0, [9.875, 1.036, -5.251], [0.0, 0.45, 0.0], 26, label='Settle')]}

def rig(light):
    rim = 170 if light else 240
    return [{'preset': 'productRig', 'key': {'at': {'az': 35, 'el': 22, 'dist': 3.4}, 'width': 2.6, 'height': 1.3, 'intensity': 30},
             'rimLeft': {'intensity': rim}, 'rimRight': {'intensity': rim}, 'pool': {'strength': 0.18}, 'contact': {'opacity': 0.8}},
            {'type': 'rect', 'name': 'kicker', 'at': {'az': 180, 'el': 12, 'dist': 3.2}, 'width': 0.5, 'height': 2.0, 'color': '#eef1ff', 'intensity': 18},
            {'type': 'rect', 'name': 'frontLow', 'at': {'az': -45, 'el': 8, 'dist': 4.0}, 'width': 1.2, 'height': 0.6, 'color': '#fff0e0', 'intensity': 6}]

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i13 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'hero')
shot = copy.deepcopy(cut['shots'][i13])
for k in ('subshots', 'presets', 'renderRange', 'subshot'): shot.pop(k, None)
wheels = [e for e in shot['sceneEdits'] if str(e.get('match', '')).startswith('^Wheel')]
shot.update(seconds=SECONDS, cameraPlan=camera, kind='hero',
            motion={'version': 2, 'initial': {'height': 43.5, 'tilt': 65, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
            sceneEdits=wheels + [{'match': '@grid', 'opacity': [[0, 0.35], [11.5, 0.25], [16, 0]], 'radialFade': [3, 8]},
                                 {'match': '@pulse', 'opacity': [[0, 1], [11.5, 0.6], [16, 0]]},
                                 {'lightType': 'DirectionalLight', 'intensity': 0.45}, {'lightType': 'HemisphereLight', 'intensity': 0.5},
                                 {'match': '@stageLight', 'intensity': 0.5}],
            ledGlow=0.2, ledSurfaces={'desktopStrength': 35, 'shelfStrength': 70, 'baseStrength': 30, 'topStrength': 80,
                                      'floorStrength': 150, 'floorReach': 60, 'floorWidth': 80})
f = os.path.join(d, 'shots', '13-tmp.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
shot = json.load(open(f)); os.remove(f)
subs = []
for n, p, t0, t1 in LOOKS:
    x = dict(copy.deepcopy(shot), preset=p, renderRange=[t0, t1], subshot=n, lights=rig(p in LIGHT),
             sceneGlobals={'environmentScale': 0.4, 'exposure': EXPOSURE[p]})
    if p == 'gaming' and n == 'F': x['kind'] = 'glide'          # the stage swaps the mechanical keyboard for the ergonomic one
    if p == 'architect': x.pop('screens', None)                  # the drafting build has no monitor
    if p in ('artist', 'architect'):   # their shelf organizer lands on the floor: hide it and drop it under the floor
        x['sceneEdits'] = x['sceneEdits'] + [{'match': 'shelf-organizer|^Organizer ', 'hide': True}, {'match': '^Accessory:shelf-organizer$', 'position': [0, -20, 0]}]
    subs.append(x)
json.dump({'name': 'HQ9 finale sub-shots', 'shots': subs}, open(os.path.join(d, 'shots', '13-subshots.json'), 'w'))
# The cut keeps one shot for the chapter (F, the black-and-red title shot) so review tools still read it.
main = copy.deepcopy(subs[-1]); main.pop('renderRange'); main.pop('subshot')
main['subshots'] = {n: [t0, t1] for n, _, t0, t1 in LOOKS}; main['presets'] = [p for _, p, _, _ in LOOKS]
json.dump(main, open(os.path.join(d, 'shots', '13.json'), 'w'), indent=1)
cut['shots'][i13] = main
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
grade = json.load(open(os.path.join(d, 'grade.json')))
grade['hero'] = {'gamma': 1.0, 'temp': 0, 'curves': '0/0 0.5/0.5 0.85/0.83 1/0.95', 'bloom': 0.04}
json.dump(grade, open(os.path.join(d, 'grade.json'), 'w'), indent=1)
print('finale v2:', ' > '.join(f'{p} {t0}-{t1}' for _, p, t0, t1 in LOOKS))
