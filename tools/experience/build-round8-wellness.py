#!/usr/bin/env python3
"""Round 11, chapter 7 (wellness, gym, 13 s): its own camera (Vico: the HQ10-HQ14 one "seems lazy").

The old camera sat high on the desk's right-front, looked down on a small desk for the whole lift and only drifted.
This one has a purpose: the lift (28 -> 43.5 in, 3-8 s, blue status light) and its floor light.
- Opens low on the right-front three-quarter, near the floor, so the casters, the base shelf and the floor light under
  the desk are big in frame, and pushes in slowly while the user sits (0-3 s).
- Through the lift it arcs round toward the front at low height and cranes up only as much as the rising monitor
  needs: the desk climbs against the training wall and the light pool on the floor stays in frame the whole way.
- After the lift it pulls back and round to the left-front for the gym reveal (window, bike), still moving into the
  dissolve (easeOut false). One continuous move, no holds or cuts; the desk sits right of frame under the title.
Usage: build-round8-wellness.py <hq dir> (sets only the wellness shot's cameraPlan + camera: bakes shots/08.json
with camera-spline.mjs and copies both into review-cut.json). Run it under the cut lock:
  flock /tmp/claude-1000/hq14-cut.lock python3 tools/experience/build-round8-wellness.py <hq dir>
If <hq>/director-camera-wellness.json exists (Director Mode), build-round8-director.py (run last) owns the
chapter's camera, length, motion and status lights, and this builder does nothing.
"""
import json, math, os, subprocess, sys

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS, SHOT_FILE = 13, '08.json'

# ---------------------------------------------------------------- desk geometry (world units, desk at 28 in)
# render-cut --list-objects: the gym desk's box centre is (-1.10, 0.64), front toward +x, long axis along z; the
# training wall is behind it (x -2.45), the window and entry wall at z +2.93 with the bike in front of it (x 0.6-2.4,
# z 1.87-2.75), the weight rack on the -z wall. The lift raises the desk 0.0406 u per inch.
LIFT = (3.0, 5.0, 43.5)
U = 0.0406
DESK_C = (-1.10, 0.64)


def sm(f): f = min(1, max(0, f)); return f * f * (3 - 2 * f)


def rise(t): return U * (LIFT[2] - 28) * sm((t - LIFT[0]) / LIFT[1])


def desk_points(t):
    """Whole-desk extremes: desktop corners, caster footprint on the floor, monitor tops."""
    d = rise(t)
    P = [(x, 1.03 + d, z) for x in (-1.79, -0.48) for z in (-0.26, 1.53)]
    P += [(x, 0.0, z) for x in (-1.92, -1.14) for z in (-0.21, 1.41)]
    P += [(x, 2.02 + d, z) for x in (-1.6, -0.9) for z in (-0.08, 1.35)]
    return P


def orbit(at, az, dist, cam_y, aim_y, shift, fov, label=None):
    """A key around the desk centre: az (deg) from the front (+x) toward +z (the window/bike side), horizontal
    distance, camera and aim heights, and shift (units) of the aim toward screen-left (+: desk right of frame)."""
    a = math.radians(az)
    px, pz = DESK_C[0] + dist * math.cos(a), DESK_C[1] + dist * math.sin(a)
    vx, vz = (DESK_C[0] - px) / dist, (DESK_C[1] - pz) / dist
    k = {'at': at, 'position': [round(px, 3), round(cam_y, 3), round(pz, 3)],
         'target': [round(DESK_C[0] + vz * shift, 3), round(aim_y, 3), round(DESK_C[1] - vx * shift, 3)], 'fov': fov}
    if label: k['label'] = label
    return k


# ---------------------------------------------------------------- camera: story keys (Director Mode edits these)
CAMERA = {'easeIn': False, 'easeOut': False, 'keys': [
    # 1. Seated: low and close on the base (casters, the pouf on the base shelf, the light on the floor).
    orbit(0.0, -38, 2.00, 0.35, 0.50, 0.10, 40, label='Low on the base: casters, floor light'),
    orbit(3.0, -31, 2.45, 0.45, 0.70, 0.20, 43, label='Lift starts: blue floor light'),
    # 2. The lift: pull back and arc toward the front, craning up with the rise; the light pool stays in frame.
    orbit(5.5, -18, 3.20, 0.72, 1.19, 0.30, 51.5, label='Arc with the rise'),
    orbit(8.0, -4, 3.60, 0.95, 1.33, 0.20, 49, label='Standing height: whole desk, light pool'),
    # 3. On out and round to the left-front: the gym around the desk.
    orbit(13.0, 14, 4.30, 1.30, 1.38, 0.0, 50, label='Pull back: the gym reveal')]}

DIRECTOR = os.path.join(H, 'director-camera-wellness.json')
OVERRIDE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'film-cameras', 'wellness.json')
if os.path.exists(OVERRIDE):   # HQ36: the chapter's camera, length and lift come from build-round8-cameras.py
    print(f'wellness: camera, length and lift from {OVERRIDE} (build-round8-cameras.py)'); sys.exit()
if os.path.exists(DIRECTOR):
    print(f'wellness: camera, length and moves from {DIRECTOR} (build-round8-director.py)'); sys.exit()

# Bake on shots/08.json, then copy cameraPlan + camera into the cut's wellness shot (nothing else changes).
shot_path = os.path.join(H, 'shots', SHOT_FILE)
sh = json.load(open(shot_path))
if sh.get('id') != 'wellness' or sh.get('seconds') != SECONDS: sys.exit(f'{shot_path}: not the {SECONDS} s wellness shot')
sh['cameraPlan'] = CAMERA
json.dump(sh, open(shot_path, 'w'), indent=1)
subprocess.run(['node', os.path.join(ROOT, 'tools/experience/camera-spline.mjs'), shot_path], check=True, stdout=subprocess.DEVNULL)
sh = json.load(open(shot_path))
cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
for s in cut['shots']:
    if s['id'] == 'wellness': s['cameraPlan'] = CAMERA; s['camera'] = sh['camera']
json.dump(cut, open(cut_path, 'w'), indent=1)


# ---------------------------------------------------------------- report: speed, view turn, framing
def project(v, X, W=960, Hh=540):
    p, t = v['position'], v['target']
    f = [t[i] - p[i] for i in range(3)]; n = math.hypot(*f); f = [c / n for c in f]
    r = [-f[2], 0, f[0]]; n = math.hypot(*r); r = [c / n for c in r]
    u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
    d = [X[i] - p[i] for i in range(3)]; z = sum(a * b for a, b in zip(d, f)); k = math.tan(math.radians(v['fov']) / 2)
    return (W / 2 * (1 + sum(a * b for a, b in zip(d, r)) / z / k / (W / Hh)), Hh / 2 * (1 - sum(a * b for a, b in zip(d, u)) / z / k))


ks = sh['camera']['keys']; prof = []
for a, b in zip(ks, ks[1:]):
    dt = (b['time'] - a['time']) * SECONDS
    if dt <= 1e-6: continue
    pa, pb = a['view']['position'], b['view']['position']
    da, db = (math.dist(k['view']['target'], k['view']['position']) for k in (a, b))
    aim = sum((a['view']['target'][i] - pa[i]) / da * (b['view']['target'][i] - pb[i]) / db for i in range(3))
    prof.append(((a['time'] + b['time']) / 2 * SECONDS, math.dist(pa, pb) / dt, math.degrees(math.acos(max(-1, min(1, aim)))) / dt))
pk = max(prof, key=lambda p: p[1]); rot = max(prof, key=lambda p: p[2])
WHOLE = 5.5   # the base detail opens wider until the whole desk is framed here
worst = None
for k in ks:
    t = k['time'] * SECONDS
    if t < WHOLE: continue
    xs, ys = zip(*[project(k['view'], X) for X in desk_points(t)])
    m = min(min(xs), 960 - max(xs), min(ys), 540 - max(ys))
    if worst is None or m < worst[0]: worst = (m, t, min(xs), max(xs), min(ys), max(ys))
print(f'wellness: {len(CAMERA["keys"])} story keys -> {len(ks)} baked; peak {pk[1]:.2f} u/s at {pk[0]:.1f} s; '
      f'view turns <= {rot[2]:.0f} deg/s; whole desk in frame from {WHOLE} s: tightest margin {worst[0]:.0f} px at {worst[1]:.1f} s')
for k in CAMERA['keys']:
    p = k['position']; az = math.degrees(math.atan2(p[2] - DESK_C[1], p[0] - DESK_C[0]))
    xs, ys = zip(*[project(k, X) for X in desk_points(k['at'])])
    print(f'  key {k["at"]:5.2f}  az {az:6.1f}  dist {math.hypot(p[0] - DESK_C[0], p[2] - DESK_C[1]):.2f}  y {p[1]:.2f}  fov {k.get("fov")}  '
          f'desk x {min(xs):4.0f}-{max(xs):4.0f} y {min(ys):4.0f}-{max(ys):4.0f}  {k.get("label", "")}')
print('  (az 0 = desk front, + toward the window/bike side; desk = casters to monitor tops, in 960x540 px)')
