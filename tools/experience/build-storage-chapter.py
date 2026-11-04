#!/usr/bin/env python3
"""Chapter 12 ('storage') for HQ8: the desk rolls fully off the rug, to its right.

    python3 tools/experience/build-storage-chapter.py exports/cinematic-intro-20261103-hq8

Edits the storage shot in <dir>/review-cut.json and writes <dir>/shots/12.json.
Direction: /home/ergo/logs/finale_and_film_direction_2026-11-03.md (A).

- Tilt 0 to 65 in 4.3 s (was 5.0), same path.
- Roll z 0 -> 95 in (was 55), 6.0-13.15 s, trapezoid (cruise 16 in/s), so the trailing
  casters stop past the rug's gold edge (53 in from the start) on carpet tile.
- The Leap chair moves off the rug, to room [8000, -3700] mm, 500 mm past the bay's far edge.
- Lights out at closing time (13.6-15.4 s, room lights to 0.15, ambient to 0.25); screen and underglow stay on.
- Warm gold LED (Humboldt #f19c00) instead of cyan, so the teal desk stands off the wall.
- Camera: tracks the longer roll; ends lower (y 3.2) on the parked desk instead of the 5.4 crane.
World units, measured with render-cut --list-screens --list-at --list-objects: the roll runs
along world +x, 3.64 units for 95 in (the room is about 1.51x metres); the room root is
yawed 90 deg (room +z = world +x, room +x = world -z).
"""
import json, os, subprocess, sys, copy
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
U = 3.64 / 95            # world units per inch along the roll
MM = 3.64 / 2413         # world units per room mm

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'storage')
s = copy.deepcopy(cut['shots'][i])
clips = {c['id']: c for c in s['motion']['clips']}
clips['builtin-tilt-0']['duration'] = 4.3

def z(t):  # inches at t seconds into the 7.15 s roll
    if t < 1.2: return 6.65 * t * t
    if t < 5.95: return 9.58 + 15.97 * (t - 1.2)
    return 95 - 6.65 * (7.15 - t) ** 2
D = 7.15
roll = clips['storage-roll']
roll.update(start=6.0, duration=D, easing='linear', target={'x': 0, 'z': 95, 'yaw': 0},
            path=[{'time': round(k * 0.1 / D, 6), 'pose': {'x': 0, 'z': round(z(k * 0.1), 4), 'yaw': 0}} for k in range(72)]
                 + [{'time': 1, 'pose': {'x': 0, 'z': 95, 'yaw': 0}}])
roll['path'] = [p for p in roll['path'] if p['time'] <= 1]

# Chair: room offset (+810, -1850) mm -> world (room x = -world z, room z = +world x).
chair = [round(-1850 * MM, 3), 0, round(-810 * MM, 3)]
s['sceneEdits'] = [{'match': '^Prop:steelcase-leap-v2$', 'position': chair},
                   {'lightType': '.', 'path': '^Room:', 'intensity': [[13.6, 1], [15.4, 0.15]]}]
s['ledColor'] = '#f19c00'
s['sceneGlobals'] = {'environmentScale': [[13.6, 1], [15.4, 0.25]]}   # the ambient dims with the lamps

k = {round(x['at'], 2): x for x in s['cameraPlan']['keys']}
add = lambda v, dx, y=None: [round(v[0] + dx, 3), v[1] if y is None else y, v[2]]
k[11]['position'] = add(k[11]['position'], 28 * U); k[11]['target'] = add(k[11]['target'], 28 * U)
k[13.5]['position'] = [0.2, 2.4, -7.1]; k[13.5]['target'] = add(k[13.5]['target'], 40 * U)   # left of the foreground table
# Parked desk centre about (0.75, -11.8); aim 0.6 m (0.9 units) to the rug side at 0.9 height.
k[17].update(position=[-0.6, 3.2, -7.2], target=[-0.15, 0.9, -11.8], fov=40, label='Parked off the rug')

f = os.path.join(d, 'shots', '12.json'); json.dump(s, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print('storage: roll 6.0-13.15 to 95 in | chair offset', chair, '| tilt 4.3 s | led #f19c00')
