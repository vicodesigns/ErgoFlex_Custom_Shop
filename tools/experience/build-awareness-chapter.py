#!/usr/bin/env python3
"""Chapter 9 ('awareness', SENSING) for HQ9: the desk visibly senses a pylon and shows the proximity light.

    python3 tools/experience/build-awareness-chapter.py exports/cinematic-intro-20261103-hq9

Vico (round 4): the proximity light moves here from the safety chapter: "this one talks about it, but
you can't really tell that it sensed it." One pylon in the path (the stage's three decorative pylons are
hidden: from a side angle one always stacks with it), the roll 1 s earlier, the desk's amber proximity
breathe from 8.0 (latched; first peak about 9.55, before the out dip), seen side-on on a near lock-off.
Camera: /home/ergo/logs/cinematography_review_round4_2026-11-03.md (ch 9). Light levels:
/home/ergo/logs/lighting_review_round4_2026-11-03.md (section 5). Edits review-cut.json, writes shots/09.json.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'awareness')
s = cut['shots'][i]

s['motion']['clips'] = [{'id': 'aw-roll', 'lane': 'wheels', 'kind': 'travel', 'start': 6.0, 'duration': 2.8, 'easing': 'smooth',
                         'label': 'Roll toward the pylon', 'value': 9.7, 'direction': 'forward'}]
s['obstacles'] = [{'from': 'desk', 'x': 0, 'ahead': 0.70, 'radius': 0.12, 'height': 1.0, 'rise': [0.3, 1.3]}]
s['ledStatus'] = [{'at': 6.0, 'dur': 2.0, 'kind': 'wheels', 'mode': 3}, {'at': 8.0, 'dur': 4.0, 'kind': 'proximity'}]
s['sceneEdits'] = [e for e in s['sceneEdits'] if e.get('match') != '@pylons'] + [{'match': '@pylons', 'hide': True}]
s['ledGlow'] = 1; s['ledColor'] = '#2b2b2b'
s['ledSurfaces'] = {'desktopStrength': 160, 'floorStrength': 200, 'floorReach': 100, 'floorWidth': 100, 'baseStrength': 140,
                    'leftWingStrength': 160, 'rightWingStrength': 160}
s['lights'] = [{'preset': 'productRig', 'scale': 0.5, 'pool': False}]
s['sceneGlobals'] = {'environmentScale': 0.35}
for sc in s['screens']: sc['offset'] = 1.0   # 08-main was timed to the old 7.0-9.8 roll
key = lambda at, p, t, fov, label=None: dict(at=at, position=p, target=t, fov=fov, **({'label': label} if label else {}))
s['cameraPlan'] = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0.0, [-1.896, 0.876, 2.661], [0.054, 0.5, -0.401], 30, 'Low behind the wheels, pylon ahead'),
    key(1.0, [-1.761, 0.971, 2.854], [0.084, 0.52, -0.378], 30),
    key(5.4, [-0.589, 2.349, 5.299], [-0.008, 0.9, -0.131], 34, 'Crane up and round to the flank'),
    key(6.2, [-0.375, 2.349, 5.341], [0.065, 0.9, -0.096], 34),
    key(8.8, [0.044, 2.248, 5.187], [0.507, 0.85, -0.028], 34, 'Stopped: amber'),
    key(12.0, [0.408, 2.123, 4.649], [0.753, 0.8, 0.038], 33, 'Slow push on the gap')]}
f = os.path.join(d, 'shots', '09.json'); json.dump(s, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print('awareness: roll 6.0-8.8 to one pylon, proximity amber from 8.0, side-on camera')
