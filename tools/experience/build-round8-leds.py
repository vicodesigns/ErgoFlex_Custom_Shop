#!/usr/bin/env python3
"""Round 8 LED notes (Vico, 2026-11-04 afternoon), all status-light chapters.

- Neutral look: between status states the strips show a soft warm white (like the app's
  neutral look) instead of near-off grey; dark-stage chapters get a dimmer warm white.
- Lift: one wavefront per move, foot rest to top (film-status `sweep`, the default now).
- Floor: the desktop centre strip lights the floor too (film-fx floorLight `center`, defaults to wings).
Usage: build-round8-leds.py <hq dir>  (review-cut.json and shots/NN.json, in place)
"""
import glob, json, os, sys

H = sys.argv[1]
WARM_ROOM, WARM_STAGE = '#ffd8a8', '#5a4938'   # stage: halved after the HQ14 preview (Vico: too bright)
STAGE = {'awaken', 'awareness'}            # the black product stage


def fix(s):
    if not s.get('ledStatus') or s.get('id') == 'storage':   # storage already rests on warm white #fff1dc
        return s
    s['ledColor'] = WARM_STAGE if s['id'] in STAGE else WARM_ROOM
    if s['id'] == 'awaken':
        # Lights off while the camera finds the desk (wheel macro -> base -> silhouette + first title at 8.2 s),
        # then switch on (0.3 s) before the first move at 11 s.
        s['ledStatus'] = [{'at': 0, 'dur': 9.2, 'kind': 'off', 'fade': .3}] + [e for e in s['ledStatus'] if e.get('kind') != 'off']
        # The stage rig goes dark with them (it was the full product rig until 9.6 s, brighter than the LED part, so the
        # switch-on did not read): a dim rim-lit silhouette, then key, ambient and LEDs come up together at 9.2-9.5 s.
        rig = next(l for l in s['lights'] if l.get('preset') == 'productRig')
        rig['key'] = {'intensity': [[0, 6], [9.2, 6], [9.5, 22], [35.2, 22], [38, 40]]}
        rig['pool'] = {'strength': [[0, 0], [9.2, 0], [9.5, .1], [35.2, .1], [38, .3]]}
        for r in ('rimLeft', 'rimRight'): rig[r] = {'intensity': [[0, 120], [9.5, 120], [10.6, 0], [35.2, 0], [38, 200]]}
        s['sceneGlobals']['environmentScale'] = [[0, .15], [9.2, .15], [9.5, .35], [35.2, .35], [38, 1]]
    return s


paths = [os.path.join(H, 'review-cut.json')] + sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json')))
for p in paths:
    d = json.load(open(p))
    if 'shots' in d: d['shots'] = [fix(s) for s in d['shots']]
    else: d = fix(d)
    json.dump(d, open(p, 'w'), indent=1)
print('neutral warm white on', [s['id'] for s in json.load(open(paths[0]))['shots'] if s.get('ledColor') in (WARM_ROOM, WARM_STAGE)])
