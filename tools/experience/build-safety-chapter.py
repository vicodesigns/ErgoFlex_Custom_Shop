#!/usr/bin/env python3
"""Redo chapter 6 ('status') as the safety chapter (HQ7).

    python3 tools/experience/build-safety-chapter.py exports/cinematic-intro-20261103-hq7

Edits <dir>/review-cut.json, edl.json and titles-src.json in place (the folder
starts as a copy of HQ6) and writes <dir>/shots/06.json plus
<dir>/shots/06-subshots.json, a cut with three copies of the chapter that share
the desk performance and differ only in camera and renderRange:

  A 0.0-5.0   low front 3/4, trucking left like coast's exit    lift up, blue wavefront
  B 4.2-11.0  the other front 3/4, higher, slow push            green on arrival, 90 deg turn
  C 10.2-16.0 low front 3/4 of the new heading, crane up        roll forward, amber comet, green
A>B and B>C are 0.8 s dips through black while the desk moves (join-subshots.py
--transition fadeblack: Vico's "fade out, fade in at a different angle"). In and out of the chapter are 1.5 s dissolves, like
every other dark-studio seam. The chapter stays 16 s, so nothing after it moves.
Direction: /home/ergo/logs/status_chapter_direction_2026-11-03.md. Light colours
and effects are the app's (film-status.mjs, unchanged); no pylon (ch 9 has the
proximity stop).
"""
import json, os, subprocess, sys, copy, math
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 16
SUB = {'A': (0.0, 5.0), 'B': (4.2, 11.0), 'C': (10.2, 16.0)}

def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c

# The lift lands (and the green flashes) on the beat at film 91.43 s, where the chime sits.
# Three motions, eased, at real-desk speeds (lift avg 2.7 in/s, turn peak 32 deg/s, roll peak 7.5 in/s).
clips = [clip('sf-lift', 'lift', 'lift', 0.4, 5.53, label='Lift up', target=43),
         clip('sf-turn', 'wheels', 'rotate', 7.2, 4.2, label='Turn', value=90, direction='left'),
         clip('sf-roll', 'wheels', 'travel', 11.4, 2.8, label='Roll forward', value=14, direction='forward')]
# One light state per beat: blue, green, comet, comet with amber, green. The left turn is drive
# mode 5 (HQ6 lit its right turn with mode 6).
status = [{'at': 0.4, 'dur': 5.53, 'kind': 'lift-up'}, {'at': 5.93, 'dur': 0.9, 'kind': 'target'},
          {'at': 7.2, 'dur': 4.2, 'kind': 'wheels', 'mode': 5}, {'at': 11.4, 'dur': 2.8, 'kind': 'wheels', 'mode': 3},
          {'at': 14.2, 'dur': 1.0, 'kind': 'target'}]

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
truck = [-0.3 * 5 * c for c in rA]            # 0.3 /s to camera-left
push = [0.15 * 5 * c for c in fA]
camA = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0.0, pA, tA0, 30, 'Low front 3/4, trucking left'),
    key(2.5, add(pA, add(truck, push), 0.5), add(tA0, truck, 0.5), 29),
    key(5.0, add(pA, add(truck, push)), add(tA0, truck), 28)]}
# B: the other front 3/4, higher, a slow push; the desk turns against a still frame.
pB, tB = [4.6, 2.7, 4.3], [0.0, 1.0, 0.0]
fB, rB = basis(pB, tB)
tB0 = add(tB, rB, -0.55)                      # desk right of centre (matches A's end)
camB = {'easeIn': False, 'easeOut': False, 'keys': [
    key(4.2, pB, tB0, 30, 'Other 3/4, higher'),
    key(7.6, add(pB, fB, 0.2), add(tB0, rB, 0.05), 30),
    key(11.0, add(pB, fB, 0.4), add(tB0, rB, 0.1), 30)]}
# C: after the left turn the desk faces world +z (director yaw +90 = right turns +x toward -z); low front-right 3/4 looking down the roll,
# still until the stop, then crane up and ease back into oilers' opening crane.
pC, tC = [-3.4, 1.75, 6.4], [0.0, 1.2, 0.6]
fC, rC = basis(pC, tC)
tC0 = add(tC, rC, -0.75)
camC = {'easeIn': False, 'easeOut': False, 'keys': [
    key(10.2, pC, tC0, 29, 'Low front 3/4, down the roll'),
    key(13.8, add(pC, fC, 0.25), tC0, 29),
    key(16.0, add(add(pC, fC, -2.4), [0, 0.9, 0]), add(add(tC0, rC, -0.25), [0, 0.15, 0]), 29, 'Crane up')]}

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i6 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'status')
old = cut['shots'][i6]
shot = {'id': 'status', 'room': 'product', 'kind': 'glide', 'seconds': SECONDS, 'title': 'Safe for everyone around it.',
        'detail': 'Light and sound let everyone know when it moves.', 'preset': old['preset'], 'transition': 1.5,
        'size': old['size'], 'lights': old['lights'],
        'motion': {'version': 2, 'initial': {'height': 28, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
        'ledGlow': 1, 'ledSurfaces': {'desktopStrength': 15, 'floorStrength': 160, 'baseStrength': 120},
        'ledStatus': status, 'sceneEdits': copy.deepcopy(old['sceneEdits'])}
os.makedirs(os.path.join(d, 'shots'), exist_ok=True)
subs = []
for name, cam in (('A', camA), ('B', camB), ('C', camC)):
    s = dict(copy.deepcopy(shot), cameraPlan=cam)
    f = os.path.join(d, 'shots', f'06{name.lower()}.json'); json.dump(s, open(f, 'w'), indent=1)
    subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
    s = json.load(open(f)); s['renderRange'] = list(SUB[name]); s['subshot'] = name; subs.append(s); os.remove(f)
json.dump({'name': 'HQ7 safety chapter sub-shots', 'shots': subs}, open(os.path.join(d, 'shots', '06-subshots.json'), 'w'))
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
