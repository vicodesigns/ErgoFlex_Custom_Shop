#!/usr/bin/env python3
"""Chapter 6 ('status') as the safety chapter, v3 (HQ9): one continuous camera.

    python3 tools/experience/build-safety-chapter.py exports/cinematic-intro-20261103-hq9

Edits <dir>/review-cut.json and grade.json and writes <dir>/shots/06.json (removing 06-subshots.json).
Vico (round 4): no fades between angles inside the chapter; the camera pans and flies like the rest of
the film; open on a not-too-high 3/4 looking down as it lifts, so the light reads on the floor; give the
lift, tilt and glide time; no proximity light here (it moved to ch 9).
Camera: /home/ergo/logs/cinematography_review_round4_2026-11-03.md (ch 6). Light levels:
/home/ergo/logs/lighting_review_round4_2026-11-03.md (section 3). The desk keeps Vico's round-3 start
at -5 deg (the tilt up to 0 shows the real desk's tilt-up yellow-green; Vico: tilt down is purple); the tilt runs 3 s so the FX35 sway shows twice.
HQ7/HQ8 versions (three sub-shots with dips) are in git history.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 16

def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c

clips = [clip('sf-lift', 'lift', 'lift', 0.4, 5.6, label='Lift up', target=46),
         clip('sf-tilt', 'tilt', 'tilt', 7.0, 3.0, label='Tilt level', target=0),
         clip('sf-turn', 'wheels', 'rotate', 10.3, 2.2, label='Turn', value=45, direction='right'),
         clip('sf-roll', 'wheels', 'travel', 12.5, 2.0, label='Roll forward', value=10, direction='forward')]
# A right turn is a positive Three.js yaw (+x toward -z), counter-clockwise from above: drive mode 6.
status = [{'at': 0.4, 'dur': 5.6, 'kind': 'lift-up'}, {'at': 7.0, 'dur': 3.0, 'kind': 'tilt-extend'},
          {'at': 10.3, 'dur': 2.2, 'kind': 'wheels', 'mode': 6}, {'at': 12.5, 'dur': 2.0, 'kind': 'wheels', 'mode': 3}]

def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k
camera = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0.0, [3.729, 4.281, -2.546], [0.132, 1.15, 0.423], 36, '3/4 from above, lift begins'),
    key(2.2, [4.036, 4.115, -2.068], [0.062, 1.2, 0.406], 36),
    key(4.4, [4.463, 3.835, -1.264], [-0.037, 1.3, 0.338], 36, 'Lift three-quarters done'),
    key(6.4, [4.86, 3.113, 0.137], [-0.123, 1.3, 0.2], 35, 'Fly down and round'),
    key(8.9, [4.757, 1.946, 2.021], [-0.12, 1.3, 0.05], 34, 'Side 3/4, desktop height: tilt'),
    key(10.3, [4.608, 1.946, 2.356], [-0.12, 1.3, 0.05], 34),
    key(12.5, [4.473, 2.095, 2.835], [0.0, 1.25, -0.07], 34, 'Turn done'),
    key(14.5, [4.468, 2.364, 3.151], [0.152, 1.2, -0.222], 34, 'Roll ends'),
    key(16.0, [4.389, 2.799, 3.406], [0.182, 1.2, -0.252], 34, 'Crane up into oilers')]}

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i6 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'status')
old = cut['shots'][i6]
wheels = [e for e in old['sceneEdits'] if str(e.get('match', '')).startswith('^Wheel')]
shot = {'id': 'status', 'room': 'product', 'kind': 'glide', 'seconds': SECONDS, 'title': 'Safe for everyone around it.',
        'detail': 'Light and sound let everyone know when it moves.', 'preset': old['preset'], 'transition': 1.5,
        'size': old['size'],
        'motion': {'version': 2, 'initial': {'height': 28, 'tilt': -5, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
        'cameraPlan': camera, 'ledStatus': status,
        # Dim neutral standby, so blue / purple / red don't fade through the stage cyan; spill on every receiver.
        'ledGlow': 1, 'ledColor': '#2b2b2b',
        'ledSurfaces': {'desktopStrength': 140, 'desktopReach': 100, 'desktopWidth': 30, 'shelfStrength': 176, 'topStrength': 143,
                        'baseStrength': 120, 'floorStrength': 200, 'floorReach': 100, 'floorWidth': 100, 'floorSharpness': 10,
                        'leftWingStrength': 150, 'rightWingStrength': 150},
        'lights': [{'preset': 'productRig', 'key': {'intensity': 22}, 'pool': {'strength': 0.1}}],
        'sceneEdits': wheels + [{'match': '@stageLight', 'intensity': 0.35}, {'match': '@pulse', 'opacity': 0.4}],
        'sceneGlobals': {'environmentScale': 0.6}}
f = os.path.join(d, 'shots', '06.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
cut['shots'][i6] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
sub = os.path.join(d, 'shots', '06-subshots.json')
if os.path.exists(sub): os.remove(sub)
grade = json.load(open(os.path.join(d, 'grade.json'))); grade.setdefault('status', {})['bloom'] = 0.06
json.dump(grade, open(os.path.join(d, 'grade.json'), 'w'), indent=1)
print('status v3: one camera, lift 0.4-6.0, tilt 7.0-10.0, right turn 10.3-12.5, roll 12.5-14.5')
