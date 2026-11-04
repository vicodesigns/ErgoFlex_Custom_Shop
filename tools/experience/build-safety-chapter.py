#!/usr/bin/env python3
"""Chapter 6 ('status') as the safety chapter, v2 (HQ8).

    python3 tools/experience/build-safety-chapter.py exports/cinematic-intro-20261103-hq8

Edits <dir>/review-cut.json, edl.json and titles-src.json in place (the folder
starts as a copy of HQ7) and writes <dir>/shots/06.json plus
<dir>/shots/06-subshots.json, a cut with three copies of the chapter that share
the desk performance and differ only in camera and renderRange:

  A 0.0-3.2   low front 3/4, trucking left like coast's exit    lift up, blue (strip 2 dark)
  B 2.4-7.1   side 3/4 from the desk's right, desktop height     tilt -5 to 0 (purple), regular, 45 deg turn
  C 6.3-16.0  low 3/4 across the travel line, crane up           roll to one pylon, amber stop, back up, regular
A>B and B>C are 0.8 s dips through black while the desk moves (join-subshots.py
--transition fadeblack). In and out of the chapter are 1.5 s dissolves. The chapter
stays 16 s, so nothing after it moves.
Direction: /home/ergo/logs/safety_chapter_direction_v2_2026-11-03.md (and v1).
Light colours and effects are the desk's (film-status.mjs). No green and no arrival
flash: each state fades back to the regular look. The proximity stop holds two of the
desk's real breaths (one per ~3.1 s) for Vico's "flashes a couple of times".
"""
import json, os, subprocess, sys, copy, math
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 16
SUB = {'A': (0.0, 3.2), 'B': (2.4, 7.1), 'C': (6.3, 16.0)}

def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c

# Real-desk speeds: lift 3.2 in/s avg, tilt 4 deg/s, turn peak 31 deg/s, roll peak 6.6 in/s, back-up peak 3.8 in/s.
TURN, ROLL, BACK = 45, 7, 3
clips = [clip('sf-lift', 'lift', 'lift', 0.2, 3.8, label='Lift up', target=40),
         clip('sf-tilt', 'tilt', 'tilt', 3.4, 1.2, label='Tilt level', target=0),
         clip('sf-turn', 'wheels', 'rotate', 5.6, 2.2, label='Turn', value=TURN, direction='left'),
         clip('sf-roll', 'wheels', 'travel', 7.8, 1.6, label='Roll to the pylon', value=ROLL, direction='forward'),
         clip('sf-back', 'wheels', 'travel', 12.7, 1.2, label='Back away', value=BACK, direction='backward')]
# One light state per beat; the most recent axis wins (tilt replaces the lift's blue).
# Proximity starts dark, peaks at 10.95 and 14.05, latched through the back-up; released
# at 14.1, it fades back to the regular look by 15.1, before the out dissolve's midpoint.
status = [{'at': 0.2, 'dur': 3.2, 'kind': 'lift-up'}, {'at': 3.4, 'dur': 1.2, 'kind': 'tilt-retract'},
          {'at': 5.6, 'dur': 2.2, 'kind': 'wheels', 'mode': 5}, {'at': 7.8, 'dur': 1.6, 'kind': 'wheels', 'mode': 3},
          {'at': 9.4, 'dur': 4.7, 'kind': 'proximity'}]
# World placement, measured (render-cut --list-screens --list-at, the monitor's track): the turn
# pivots about (-0.119, 0.052), the stage is 0.0384 units per inch, and the roll runs along f.
PIVOT, UNIT = (-0.119, 0.052), 0.0384
f = [math.cos(math.radians(TURN)), 0, math.sin(math.radians(TURN))]
stop = [PIVOT[0] + ROLL * UNIT * f[0], PIVOT[1] + ROLL * UNIT * f[2]]
# The pylon stands 1.15 units ahead of the stopped pivot: the base's front plus a gap of
# more than one pylon diameter.
pylon = [round(stop[0] + 1.15 * f[0], 3), round(stop[1] + 1.15 * f[2], 3)]
obstacles = [{'at': pylon, 'radius': 0.09, 'height': 0.5, 'rise': [6.4, 7.0]}]

def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': [round(v, 3) for v in pos], 'target': [round(v, 3) for v in tgt], 'fov': fov}
    if label: k['label'] = label
    return k

def add(a, b, s=1.0): return [x + s * y for x, y in zip(a, b)]

def basis(pos, tgt):
    f = [t - p for p, t in zip(pos, tgt)]; f[1] = 0; n = math.hypot(f[0], f[2]); f = [f[0] / n, 0, f[2] / n]
    return f, [-f[2], 0, f[0]]  # forward (flat), right

# A: coast exits trucking left and pushing in with the desk centre-left, so A opens the same way.
pA, tA = [6.2, 1.45, -3.6], [0.0, 1.2, 0.0]
fA, rA = basis(pA, tA)
tA0 = add(tA, rA, 0.15)                       # aim right of the desk: desk sits centre-left
truck = [-0.25 * 3.2 * c for c in rA]         # 0.25 m/s to camera-left
push = [0.15 * 3.2 * c for c in fA]
camA = {'easeIn': False, 'easeOut': True, 'keys': [
    key(0.0, pA, tA0, 30, 'Low front 3/4, trucking left'),
    key(1.6, add(pA, add(truck, push), 0.5), add(tA0, truck, 0.5), 29),
    key(3.2, add(pA, add(truck, push)), add(tA0, truck), 28)]}
# B: side 3/4 from the desk's right (+z), lens at desktop height so the front edge reads as a
# line against black; still while it tilts level, then a 0.1 m/s push. Desk in the right 60 %.
pB, tB = [3.75, 1.05, 6.5], [0.0, 1.0, 0.0]                # 7.5 m out, 60 deg from the front
fB, rB = basis(pB, tB)
tB0 = add(tB, rB, -0.4)
camB = {'easeIn': False, 'easeOut': False, 'keys': [
    key(2.4, pB, tB0, 28, 'Side 3/4, desktop height'),
    key(4.6, pB, tB0, 28),
    key(7.1, add(pB, fB, 0.25), tB0, 28)]}
# C: after the 45 deg left turn the desk heads along f; the camera sits 65 deg off that line
# (front-left 3/4) so the closing gap to the pylon reads across frame. Still, then from 14.0
# a 0.3 m/s crane up and back into oilers' opening crane, desk ending centre-right.
desk_at = [stop[0] + 0.3 * f[0], stop[1] + 0.3 * f[2]]
M = [(desk_at[0] + pylon[0]) / 2, 0.75, (desk_at[1] + pylon[1]) / 2]   # between the desk and the pylon
a = math.radians(TURN + 65); pC = [M[0] + 7.2 * math.cos(a), 1.3, M[2] + 7.2 * math.sin(a)]
fC, rC = basis(pC, M)
desk_end = [desk_at[0] - BACK * UNIT * f[0], 0.85, desk_at[1] - BACK * UNIT * f[2]]
camC = {'easeIn': False, 'easeOut': False, 'keys': [
    key(6.3, pC, M, 30, 'Low 3/4 across the roll'),
    key(14.0, pC, M, 30),
    key(16.0, add(add(pC, fC, -0.5), [0, 0.45, 0]), add(desk_end, rC, -1.0), 30, 'Crane up')]}

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i6 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'status')
old = cut['shots'][i6]
shot = {'id': 'status', 'room': 'product', 'kind': 'glide', 'seconds': SECONDS, 'title': 'Safe for everyone around it.',
        'detail': 'Light and sound let everyone know when it moves.', 'preset': old['preset'], 'transition': 1.5,
        'size': old['size'], 'lights': old['lights'],
        'motion': {'version': 2, 'initial': {'height': 28, 'tilt': -5, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
        'ledGlow': 1, 'ledSurfaces': {'desktopStrength': 15, 'floorStrength': 160, 'baseStrength': 120},
        'ledStatus': status, 'obstacles': obstacles, 'sceneEdits': copy.deepcopy(old['sceneEdits'])}
os.makedirs(os.path.join(d, 'shots'), exist_ok=True)
subs = []
for name, cam in (('A', camA), ('B', camB), ('C', camC)):
    s = dict(copy.deepcopy(shot), cameraPlan=cam)
    f = os.path.join(d, 'shots', f'06{name.lower()}.json'); json.dump(s, open(f, 'w'), indent=1)
    subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
    s = json.load(open(f)); s['renderRange'] = list(SUB[name]); s['subshot'] = name; subs.append(s); os.remove(f)
json.dump({'name': 'HQ8 safety chapter sub-shots', 'shots': subs}, open(os.path.join(d, 'shots', '06-subshots.json'), 'w'))
# The cut keeps one shot for the chapter (B's camera, the title shot) so review tools still read it.
main = dict(copy.deepcopy(subs[1])); main.pop('renderRange'); main.pop('subshot'); main['subshots'] = {k: v for k, v in SUB.items()}
json.dump(main, open(os.path.join(d, 'shots', '06.json'), 'w'), indent=1)
cut['shots'][i6] = main
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))

# ---- EDL: 1.5 s dissolves in and out, same centres (86.25, 100.75) ----------
edl = json.load(open(os.path.join(d, 'edl.json')))
ids = [c['id'] for c in sorted(edl['chapters'], key=lambda c: c['index'])]
k = ids.index('status')
edl['transitions'][k - 1] = 1.5; edl['transitions'][k] = 1.5
json.dump(edl, open(os.path.join(d, 'edl.json'), 'w'), indent=1)
titles = json.load(open(os.path.join(d, 'titles-src.json')))
for t in titles['titles']:
    if t['chapter'] == 'status':
        t.update(eyebrow='SAFETY', title=shot['title'], detail=shot['detail'], rel_in=1.6, rel_out=7.2, scrim='60')
json.dump(titles, open(os.path.join(d, 'titles-src.json'), 'w'), indent=1, ensure_ascii=False)
print('status: transitions', edl['transitions'][k - 1], edl['transitions'][k], '| title', shot['title'], '/', shot['detail'])
