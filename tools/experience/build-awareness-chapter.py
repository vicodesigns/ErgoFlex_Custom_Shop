#!/usr/bin/env python3
"""Chapter 9 ('awareness', SENSING) for HQ9: the desk visibly senses a pylon and shows the proximity light.

    python3 tools/experience/build-awareness-chapter.py exports/cinematic-intro-20261103-hq9

Vico (round 4): the proximity light moves here from the safety chapter: "this one talks about it, but
you can't really tell that it sensed it." One pylon in the path (the stage's three decorative pylons are
hidden: from a side angle one always stacks with it), the roll 1 s earlier, the desk's amber proximity
breathe from 8.0 (latched; first peak about 9.55, before the out dip), seen side-on on a near lock-off.
Camera: /home/ergo/logs/cinematography_review_round4_2026-11-03.md (ch 9). Light levels:
/home/ergo/logs/lighting_review_round4_2026-11-03.md (section 5). Edits review-cut.json, writes shots/09.json.

Round 6 (HQ11, chapter 8), under the cut lock:
    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-awareness-chapter.py exports/cinematic-intro-20261103-hq11
- motion final review S2: the desk was still rolling 0.8 s after the amber latched. Roll 6.0-8.4 (same 9.7 in),
  wheels red 6.0 for 2.4 s, proximity amber from 8.4 for 3.6 s: the stop and the amber coincide.
- lighting final review SHOULD 4: the amber clipped to pale yellow on the desktop. desktopStrength 160 -> 80,
  ledGlow 1 -> 0.7, colour unchanged; floor 200 / reach 100 carries the read.
- lighting MUST 2a: the Black Birch top read as light oak (Y 142); same sheen edit as the opener, env .35 -> .12.
The SENSING card (3.6-9.8) is set by build-round6-copy.py, not here.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'awareness')
s = cut['shots'][i]

s['motion']['clips'] = [{'id': 'aw-roll', 'lane': 'wheels', 'kind': 'travel', 'start': 6.0, 'duration': 2.4, 'easing': 'smooth',
                         'label': 'Roll toward the pylon', 'value': 9.7, 'direction': 'forward'}]
s['obstacles'] = [{'from': 'desk', 'x': 0, 'ahead': 0.70, 'radius': 0.12, 'height': 1.0, 'rise': [0.3, 1.3]}]
s['ledStatus'] = [{'at': 6.0, 'dur': 2.4, 'kind': 'wheels', 'mode': 3}, {'at': 8.4, 'dur': 3.6, 'kind': 'proximity'}]
# Same anchored match as build-opener.py's DESKTOP_SHEEN (wood only, not 'Desktop LEDs*').
SHEEN = {'match': '^(Desktop|Top_Shelf)(_\\d+)?$', 'material': {'envMapIntensity': 0.35, 'clearcoat': 0.25, 'clearcoatRoughness': 0.55}}
s['sceneEdits'] = [e for e in s['sceneEdits'] if e.get('match') not in ('@pylons', SHEEN['match'])] + [{'match': '@pylons', 'hide': True}, SHEEN]
s['ledGlow'] = 0.7; s['ledColor'] = '#2b2b2b'
s['ledSurfaces'] = {'desktopStrength': 80, 'floorStrength': 200, 'floorReach': 100, 'floorWidth': 100, 'baseStrength': 140,
                    'leftWingStrength': 160, 'rightWingStrength': 160}
s['lights'] = [{'preset': 'productRig', 'scale': 0.5, 'pool': False}]
# Env .35 -> .12 (round 6, measured): the black top read Y 92-107 before the amber with the sheen edit, and Y 27 with
# no env. The edit's envMapIntensity does nothing for materials lit by scene.environment (three r163 replaces it with
# scene.environmentIntensity), so the env scale is the knob: .15 gave Y 63, .08 gave 47; the pylon still reads.
s['sceneGlobals'] = {'environmentScale': 0.12}
# 08-main: the UI reads 'Moving' from clip 7.1 and 'Stopped safely' from 9.8. Offset 1.3 puts the stop at 8.5, 0.1 s
# after the desk stops and the amber starts (dark first), and 'Moving' at 5.8, 0.2 s before the roll. The clip ends
# (13 s) at chapter 11.7, inside the fade to black: hold its last frame rather than wrap to the start.
for sc in s['screens']: sc['offset'] = 1.3; sc['loop'] = False
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
print('awareness: roll 6.0-8.4 to one pylon, proximity amber from 8.4, side-on camera; desktop 80, glow .7, sheen tamed')
