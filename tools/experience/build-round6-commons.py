#!/usr/bin/env python3
"""Round 6 (HQ11) ch 4 commons: one drive from the wall to the head of the table, square to the wheelchair.

    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-round6-commons.py exports/cinematic-intro-20261103-hq11

Supersedes build-round5-commons.py's motion, LED, wheelchair and camera end keys (its sub-line stays as set by
build-round6-copy.py). Needs experience/desk-track.mjs cleanPose at x/z +-240 (was +-120, which clamped HQ10's
z 155 to 120, so the desk only turned in place; final_review_motion M1).

Geometry, probed with render-cut --list-objects in this shot (world units, 0.0384 u per inch):
  - motion z is world +x, motion x is world -z, yaw 0 = keyboard front toward +z (away from the tackboard wall),
    yaw 90 = front toward +x, square to the electric wheelchair (yaw 180, facing -x).
  - Light laminate project table: x 1.353..3.514, z -10.123..-6.483. Its head is the z -10.123 end.
Motion (motion M1/M2/S1, cinematography 1, Vico HQ9 "just move forward ... straight on with the chair"):
  - The desk starts at the wall Z0 in further along it (so the trip fits <= 12 in/s), drives forward out of the
    wall bay on a quarter-circle turn (radius R, yaw 0 -> 90), then straight forward to the head of the table.
  - One clip, 1.2 -> 11.6 s (after the in-wipe, 1.35 s settled before the out-transition at 12.95), trapezoid
    speed with RAMP s ramps, cruise ~11.4 in/s; yaw rate in the turn ~26 deg/s.
  - Final pose: yaw 90; the desktop's front edge flush with the table's +x long side; the desk's end 5 in clear
    of the table head. ledStatus wheels mode 6 through the turn, mode 3 for the straight drive.
Staging (cinematography 2, education MUST 1-2, SHOULD 4):
  - The wheelchair stays at the desk's front, centred on the keyboard tray, about 2 in off the tray's front.
  - End camera keys after cinematography 2; opening keys follow the desk's new start.
  - The notice board ("Bring your desk to the group ... then Start Groove") is hidden for this shot.
Values are absolute, so re-running is safe.
"""
import json, math, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i, s = next((i, x) for i, x in enumerate(cut['shots']) if x['id'] == 'commons')

# ---- motion: arc + straight, trapezoid speed along the path ----
Z0 = 46.0                       # start, inches along the wall (world +x) from the authored spot
XF, ZF, YF = -25.25, 140.9, 90.0  # end: 25.25 in out from the wall, at the table head
R = -XF                         # quarter turn of radius R covers exactly the move out from the wall
T0, T1, RAMP = 1.2, 11.6, 0.8
ARC = math.pi * R / 2
D = ARC + (ZF - Z0 - R)
V = D / (T1 - T0 - RAMP)        # cruise speed, in/s

def dist(t):                    # distance along the path at chapter time t
    u = min(max(t - T0, 0.0), T1 - T0); a = V / RAMP; T = T1 - T0
    if u < RAMP: return 0.5 * a * u * u
    if u > T - RAMP: return D - 0.5 * a * (T - u) ** 2
    return 0.5 * V * RAMP + V * (u - RAMP)

def pose(sd):
    if sd <= ARC:
        th = sd / R
        return {'x': -R * math.sin(th), 'z': Z0 + R * (1 - math.cos(th)), 'yaw': math.degrees(th)}
    return {'x': XF, 'z': Z0 + R + (sd - ARC), 'yaw': YF}

N = 200
path = [{'time': k / N, 'pose': {a: round(v, 4) for a, v in pose(dist(T0 + (T1 - T0) * k / N)).items()}} for k in range(N + 1)]
s['motion'] = {'version': 2, 'initial': {'height': 30, 'tilt': 0, 'x': 0, 'z': Z0, 'yaw': 0},
               'clips': [{'id': 'builtin-wheels-0', 'lane': 'wheels', 'kind': 'pose', 'start': T0, 'duration': round(T1 - T0, 3),
                          'easing': 'linear', 'label': 'Drive to the table', 'target': {'x': XF, 'z': ZF, 'yaw': YF}, 'path': path}]}
# The turn ends where the path reaches the arc's end.
t_turn = next(T0 + (T1 - T0) * k / 2000 for k in range(2001) if dist(T0 + (T1 - T0) * k / 2000) >= ARC - 1e-9)
t_turn = round(t_turn, 2)
s['ledStatus'] = [{'at': T0, 'dur': round(t_turn - T0, 3), 'kind': 'wheels', 'mode': 6},
                  {'at': t_turn, 'dur': round(T1 - t_turn, 3), 'kind': 'wheels', 'mode': 3}]

# ---- staging ----
keep = [e for e in s.get('sceneEdits', []) if e.get('match') not in ('^Prop:electric-wheelchair$', '^Pilot daily activity and welcome board$')]
s['sceneEdits'] = keep + [
    {'match': '^Prop:electric-wheelchair$', 'position': [0.08, 0, 0]},
    {'match': '^Pilot daily activity and welcome board$', 'hide': True},
]

# ---- camera: follow the desk's new start, then cinematography 2's end keys ----
s['cameraPlan'] = {'keys': [
    {'at': 0,    'position': [-3.98, 1.45, -7.45], 'target': [-1.73, 1.58, -12.50], 'fov': 40, 'label': 'Inside the commons'},
    {'at': 2.65, 'position': [-2.98, 1.75, -7.15], 'target': [-1.38, 1.45, -12.00], 'fov': 44},
    {'at': 5.3,  'position': [-1.20, 2.35, -6.60], 'target': [0.20, 1.40, -11.70], 'fov': 46},
    {'at': 8.46, 'position': [1.70, 2.45, -7.20], 'target': [1.85, 1.38, -11.60], 'fov': 46},
    {'at': 11.6, 'position': [4.85, 2.55, -7.75], 'target': [3.00, 1.18, -11.50], 'fov': 47, 'label': 'Group'},
    {'at': 14,   'position': [5.90, 2.50, -7.10], 'target': [3.20, 1.15, -11.40], 'fov': 47},
], 'easeIn': False, 'easeOut': False}

f = os.path.join(d, 'shots', '04.json'); json.dump(s, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print(f'commons: drive {D:.1f} in (turn {ARC:.1f} in to {t_turn}s, straight) {T0}-{T1}s, cruise {V:.2f} in/s, '
      f'turn {math.degrees(V / R):.1f} deg/s; LED mode 6 {T0}-{t_turn}, mode 3 {t_turn}-{T1}; board hidden')
