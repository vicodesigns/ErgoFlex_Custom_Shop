#!/usr/bin/env python3
"""Round 4 (HQ9) camera fixes for ch 2, 3, 4 and 12, from the cinematography review.

    python3 tools/experience/build-round4-camera.py exports/cinematic-intro-20261103-hq9

/home/ergo/logs/cinematography_review_round4_2026-11-03.md: camera-spline passes through every key
without stopping, so a key where the path doubles back is a hairpin taken at speed (Vico's ch 3 "jerk").
Each fix makes the path one-way or rests on a `hold` key. Values are absolute, so re-running is safe.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cut = json.load(open(os.path.join(d, 'review-cut.json')))
by = {s['id']: (i, s) for i, s in enumerate(cut['shots'])}
key = lambda at, p, t, fov, **kw: dict(at=at, position=p, target=t, fov=fov, **kw)

# Ch 3: one-way path with a 1 s rest at the side profile while the desk keeps tilting.
by['create'][1]['cameraPlan'] = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0, [0.35, 4.0, 0.85], [-1.341, 1.821, 0.406], 50, label='Top shot'),
    key(1.4, [0.33, 3.98, 0.65], [-1.326, 1.818, 0.419], 50),
    key(4.0, [0.32, 3.88, 0.15], [-1.30, 1.80, 0.45], 50),
    key(7.4, [0.63, 3.0, -1.56], [-1.25, 1.78, 0.45], 48, label='Front-left 3/4, descending'),
    key(10.6, [-0.95, 1.95, -2.45], [-1.20, 1.70, 0.42], 46, hold=1.0, label='Side profile, rest'),
    key(15.4, [0.95, 1.66, -1.95], [-1.22, 1.74, 0.48], 40, label='Front 3/4 easel portrait'),
    key(18, [1.42, 1.60, -1.18], [-1.25, 1.74, 0.50], 36)]}

# Ch 2: the last two keys continue outward (they reversed the move: a cusp at film 45.9), and the aim
# drops and widens through both rises so the blue floor light is in frame.
k = {x['at']: x for x in by['rise'][1]['cameraPlan']['keys']}
k[3.4]['target'][1] = 1.25; k[6.4]['target'][1] = 1.30; k[7.4]['target'][1] = 1.30; k[10.6]['target'][1] = 1.50
for t in (6.4, 7.4, 10.6): k[t]['fov'] = 40
k[14.7].update(position=[3.36, 1.51, 1.82], fov=45.5); k[16].update(position=[3.42, 1.50, 1.84], fov=45)

# Ch 4: under the 1.35 u/s cap (the 10.6 key moves to 11.0), aimed at the new stop by the table, and the
# last key keeps drifting the same way (~0.2 u/s) instead of backing off on the out wipe.
c4 = by['commons'][1]['cameraPlan']['keys']
for x in c4:
    if abs(x['at'] - 10.6) < 1e-6 or abs(x['at'] - 11.0) < 1e-6: x.update(at=11.0, position=[3.6, 2.45, -7.4])
    if abs(x['at'] - 12.6) < 1e-6: x.update(position=[5.1, 2.27, -7.85], target=[2.291, 1.508, -11.62])
    if abs(x['at'] - 14) < 1e-6: x.update(position=[5.36, 2.24, -7.93], target=[2.42, 1.47, -11.78])

# Ch 12: settle at "Track the roll" (it reversed mildly at film 169.5) before the crane.
for x in by['storage'][1]['cameraPlan']['keys']:
    if abs(x['at'] - 11) < 1e-6: x['hold'] = 0.6

for n, name in (('02', 'rise'), ('03', 'create'), ('04', 'commons'), ('12', 'storage')):
    i, s = by[name]; f = os.path.join(d, 'shots', n + '.json'); json.dump(s, open(f, 'w'), indent=1)
    subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
    cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print('camera: ch2 outward ending + floor in frame, ch3 one-way with a rest, ch4 under the cap, ch12 hold')
