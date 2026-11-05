#!/usr/bin/env python3
"""Round 8+, chapter 2 (rise): the props (Vico's notes, 2026-11-04 afternoon) and, since round 11, its own camera.

Props (round 8):
- Remove the Surface tablet (and its app screen clip): the desk itself shows the lift.
- Hide the two painted mugs on the right; replace the plain cylinder cup by the day kit's
  notebook with the supplied insulated coffee cup, a little smaller, beside the pages.

Camera (round 11; HQ10's spline was aimed at the removed tablet and pushed in, then pulled out):
- It STARTS close on the open DAILY NOTES notebook and the insulated cup under the portrait monitor (header legible
  at 960x540) and only pulls out from there: the camera's distance to the notebook grows from the first frame.
- One continuous move, no holds or cuts: it pulls up and back off the notebook while the desk starts to rise, swings
  out to the desk's left-front (the portrait-monitor end, +z) and is on a whole-desk wide by the comfortable-standing
  stop (6.4 s), with the desk right of frame while the lower-left title is up (1.6-7.4 s). Through the second rise it
  sinks as the desk climbs (the two moves add up, so the rise reads strongly against the window), and lands on a low
  three-quarter of the desk at full height, the chair kept off the lift columns, with a slow lateral drift into the
  dissolve (easeOut false).
- From the wide on, the whole desk (casters to the portrait monitor's top) stays inside the frame: the report prints
  the margins and the camera speed of the baked keys.
Usage: build-round8-rise.py <hq dir> (edits review-cut.json and shots/02.json in place; bakes the camera on
shots/02.json with camera-spline.mjs and copies camera + cameraPlan into the review-cut's rise shot).
If <hq>/director-camera-rise.json exists (Director Mode), build-round8-director.py (run last) owns the chapter's
camera, length, motion and status lights: this builder then sets only the props and skips the camera and its report.
"""
import json, math, os, subprocess, sys

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 16

CUP_HIDE = {'match': '^$', 'near': [-0.5197, 0.787, 0.02], 'hide': True}   # day kit cup + lid (unnamed cylinders)
MUGS_HIDE = {'match': '^Prop:painted-mug$', 'hide': True}
CUP = {'id': 'ergoflex-thermal-cup', 'x': -330, 'z': 115, 'rotation': 30, 'scale': 72}

# ---------------------------------------------------------------- desk geometry (world units, desk at 28 in)
# Measured with render-cut --list-objects and checked by projecting into stills: the desk's front faces +x (the
# chair side), its long axis runs along z; the window wall is behind it (x -2.3), the entry wall at z +2.47.
# The lift raises everything on the desk by 0.0406 u per inch (portrait monitor top 2.27 u at 28 in, 3.27 at 52.5).
# HQ18 (Vico, 2026-11-05: "start with the lights off, like the user is not there, and then the lights come on and the
# screens come on, and then it pans out"): the chapter opens on the notebook with the desk asleep (strips off, both
# monitors black), the strips switch on at LIGHTS_ON and the monitors wake just after, and only then does the camera pull
# out and the desk rise. Everything after the wake is the round 11 chapter moved WAKE s later (the length stays 16 s:
# the hold at full height before the evening warm-up gives the time). This builder owns the chapter's moves, status
# lights, screen wake and daypart keys (absolute values, so re-runs are idempotent).
WAKE, LIGHTS_ON, LIGHTS_FADE, SCREENS_ON = 2.0, 1.4, .5, (1.7, 2.3)
LIFT1, LIFT2 = (1.6 + WAKE, 4.8, 43.5), (7.4 + WAKE, 3.2, 52.5)      # (start, duration, target in)
U = 0.0406
DESK_C = (-0.70, 0.25)                                 # desk centre (x, z): the orbit pivot
BOOK = (-0.50, 1.05, 0.90)                             # the open DAILY NOTES notebook + the insulated cup, at 28 in


def sm(f): f = min(1, max(0, f)); return f * f * (3 - 2 * f)


def rise(t):
    """Lift above 28 in (world units) at chapter time t."""
    h = 28 + (LIFT1[2] - 28) * sm((t - LIFT1[0]) / LIFT1[1]) + (LIFT2[2] - LIFT1[2]) * sm((t - LIFT2[0]) / LIFT2[1])
    return U * (h - 28)


def desk_points(t):
    """Whole-desk extremes: desktop corners and keyboard tray, caster footprint on the floor, monitor tops."""
    d = rise(t)
    P = [(x, 1.03 + d, z) for x in (-1.37, -0.06) for z in (-0.65, 1.14)]
    P += [(0.24, 0.98 + d, z) for z in (-0.16, 0.69)]
    P += [(x, 0.0, z) for x in (-1.5, -0.72) for z in (-0.6, 1.02)]
    P += [(x, 2.27 + d, z) for x in (-0.82, -0.46) for z in (0.58, 1.23)]          # portrait monitor top
    P += [(x, 1.91 + d, z) for x in (-0.85, -0.47) for z in (-0.75, 0.56)]          # wide monitor top
    return P


def near(at, az, el, dist, fov, aim=BOOK, label=None):
    """A close key on the notebook: az (deg) around it from the desk front (+x) toward +z, elevation, distance."""
    aim = (aim[0], aim[1], aim[2]); a, e = math.radians(az), math.radians(el)
    pos = [aim[0] + dist * math.cos(e) * math.cos(a), aim[1] + dist * math.sin(e), aim[2] + dist * math.cos(e) * math.sin(a)]
    return key(at, pos, list(aim), fov, label)


def orbit(at, az, dist, cam_y, aim_y, shift, fov, label=None):
    """A key around the desk centre: az (deg) from the front (+x) toward +z (the portrait-monitor end), horizontal
    distance, camera and aim heights, and shift (units) of the aim toward screen-left, so +shift puts the desk right
    of frame."""
    a = math.radians(az)
    px, pz = DESK_C[0] + dist * math.cos(a), DESK_C[1] + dist * math.sin(a)
    vx, vz = (DESK_C[0] - px) / dist, (DESK_C[1] - pz) / dist
    lx, lz = vz, -vx                                    # screen-left (camera looking along v, y up)
    return key(at, [px, cam_y, pz], [DESK_C[0] + lx * shift, aim_y, DESK_C[1] + lz * shift], fov, label)


def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': [round(v, 3) for v in pos], 'target': [round(v, 3) for v in tgt], 'fov': fov}
    if label: k['label'] = label
    return k


# ---------------------------------------------------------------- camera: story keys (Director Mode edits these)
CAMERA = {'easeIn': False, 'easeOut': False, 'keys': [
    # 1. On the notebook: DAILY NOTES upright and legible, the cup beside it, the monitor's foot at the top. The
    #    camera is already drifting back (the chapter dissolves in), straight out along its line of sight.
    #    HQ18: framed a little wider (the notebook low in frame, the desk's front edge and the portrait monitor above it),
    #    so the desk waking reads: the strips and both monitors come on while the camera drifts back.
    near(0.0, 8, 22, 1.30, 40, aim=(-0.55, 1.32, 0.87), label='DAILY NOTES and the sleeping desk'),
    near(WAKE, 9, 22, 1.45, 41, aim=(-0.55, 1.34, 0.87), label='Desk wakes: lights and screens on'),
    near(1.6 + WAKE, 11, 23, 1.75, 43, aim=(-0.56, 1.36, 0.86), label='Pull out: the lift starts'),
    # 2. Back and round to the desk's left-front while it rises, near its eye line: the desktop edge and the left lift
    #    column climb against the window, the desk right of frame (title lower-left).
    orbit(3.6 + WAKE, 31, 2.70, 1.66, 1.55, 0.65, 50, label='Desktop and left column rising'),
    orbit(6.4 + WAKE, 30, 3.90, 1.78, 1.52, 0.45, 52, label='Comfortable standing: whole desk'),
    # 3. The second rise: the camera sinks as the desk climbs to full height.
    orbit(7.4 + WAKE, 30.5, 4.05, 1.74, 1.52, 0.40, 51, label='Second rise starts'),
    orbit(10.6 + WAKE, 29, 4.30, 1.62, 1.70, 0.15, 53.5, label='Full height 52.5 in'),
    # 4. Low hero three-quarter, a slow lateral drift into the dissolve.
    orbit(13.4 + WAKE, 27, 4.60, 1.52, 1.69, 0.0, 50, label='Low 3/4 at full height'),
    orbit(16.0, 25, 4.75, 1.48, 1.69, -0.05, 48.5, label='Hero 3/4, drifting')]}

DIRECTOR = os.path.join(H, 'director-camera-rise.json')
OWN_CAMERA = not os.path.exists(DIRECTOR)    # else build-round8-director.py sets it (and may change the length)


def wake(s):
    if not OWN_CAMERA: return
    s['motion']['clips'] = [{**c, 'start': (LIFT1 if c['id'] == 'comfortable-standing' else LIFT2)[0]} for c in s['motion']['clips']]
    lifts = [{'at': LIFT1[0], 'dur': LIFT1[1], 'kind': 'lift-up', 'fade': .6}, {'at': LIFT2[0], 'dur': LIFT2[1], 'kind': 'lift-up', 'fade': 1}]
    s['ledStatus'] = [{'at': 0, 'dur': LIGHTS_ON, 'kind': 'off', 'fade': LIGHTS_FADE}] + lifts
    for sc in s.get('screens', []):
        b = sc.get('brightness'); b = b[-1][1] if isinstance(b, list) else (1 if b is None else b)
        sc['brightness'] = [[0, 0], [SCREENS_ON[0], 0], [SCREENS_ON[1], b]]
        # The clips show the desk app following the lift (portrait: height and "Rising to standing"): WAKE s later too,
        # holding their first frame until then (loop false: no wrap to the clip's end).
        sc['offset'], sc['loop'] = -WAKE, False
    s['timeOfDay'] = [{'at': 0.75, 'mode': 'morning'}, {'at': 8 + WAKE / 2, 'mode': 'afternoon'}, {'at': 15.25, 'mode': 'evening', 'ease': 'smooth'}]


def fix(s):
    wake(s)
    if OWN_CAMERA: s['cameraPlan'] = CAMERA
    s['accessories'] = {'add': [CUP]}
    s['screens'] = [x for x in s.get('screens', []) if 'tablet' not in json.dumps(x)]
    # Keep the edits' order (other builders append theirs): replace ours in place, append only when missing.
    edits = list(s.get('sceneEdits', []))
    for mine in (MUGS_HIDE, CUP_HIDE):
        at = [i for i, e in enumerate(edits) if (e.get('match'), e.get('near'), e.get('path')) == (mine['match'], mine.get('near'), mine.get('path'))]   # '^$' + near / path: several edits share a match
        if at: edits[at[0]] = mine; edits = [e for i, e in enumerate(edits) if i not in at[1:]]
        else: edits.append(mine)
    s['sceneEdits'] = edits
    return s


# Bake on shots/02.json, then copy camera + cameraPlan into the cut (only the rise shot's camera fields change there).
shot_path = os.path.join(H, 'shots', '02.json')
sh = json.load(open(shot_path))
if sh.get('id') != 'rise' or (OWN_CAMERA and sh.get('seconds') != SECONDS): sys.exit(f'{shot_path}: not the {SECONDS} s rise shot')
if OWN_CAMERA:
    json.dump(fix(sh), open(shot_path, 'w'), indent=1)
    subprocess.run(['node', os.path.join(ROOT, 'tools/experience/camera-spline.mjs'), shot_path], check=True, stdout=subprocess.DEVNULL)
elif json.load(open(shot_path)) != fix(json.loads(json.dumps(sh))):
    json.dump(fix(sh), open(shot_path, 'w'), indent=1)
sh = json.load(open(shot_path))
cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
for s in cut['shots']:
    if s['id'] == 'rise':
        fix(s)
        if OWN_CAMERA: s['camera'] = sh['camera']
json.dump(cut, open(cut_path, 'w'), indent=1)
if not OWN_CAMERA:
    print(f'rise: props set; camera, length and moves from {DIRECTOR} (build-round8-director.py)'); sys.exit()


# ---------------------------------------------------------------- report: speed, outward start, framing
def project(v, X, W=960, Hh=540):
    p, t = v['position'], v['target']
    f = [t[i] - p[i] for i in range(3)]; n = math.hypot(*f); f = [c / n for c in f]
    r = [-f[2], 0, f[0]]; n = math.hypot(*r); r = [c / n for c in r]
    u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
    d = [X[i] - p[i] for i in range(3)]; z = sum(a * b for a, b in zip(d, f)); k = math.tan(math.radians(v['fov']) / 2)
    return (W / 2 * (1 + sum(a * b for a, b in zip(d, r)) / z / k / (W / Hh)), Hh / 2 * (1 - sum(a * b for a, b in zip(d, u)) / z / k))


ks = sh['camera']['keys']
prof = []
for a, b in zip(ks, ks[1:]):
    dt = (b['time'] - a['time']) * SECONDS
    if dt <= 1e-6: continue
    pa, pb = a['view']['position'], b['view']['position']
    da, db = (math.dist(k['view']['target'], k['view']['position']) for k in (a, b))
    aim = sum((a['view']['target'][i] - pa[i]) / da * (b['view']['target'][i] - pb[i]) / db for i in range(3))
    prof.append(((a['time'] + b['time']) / 2 * SECONDS, math.dist(pa, pb) / dt, [(pb[i] - pa[i]) / dt for i in range(3)],
                 math.degrees(math.acos(max(-1, min(1, aim)))) / dt))
pk = max(prof, key=lambda p: p[1]); rot = max(prof, key=lambda p: p[3])
turn = max(math.degrees(math.acos(max(-1, min(1, sum(x * y for x, y in zip(p[2], q[2])) / (p[1] * q[1]) if p[1] * q[1] > 1e-9 else 1))))
           for p, q in zip(prof, prof[1:]))
book = lambda t: (BOOK[0], BOOK[1] + rise(t), BOOK[2])
dist = [(k['time'] * SECONDS, math.dist(k['view']['position'], book(k['time'] * SECONDS))) for k in ks if k['time'] * SECONDS <= 2.0]
outward = all(b[1] > a[1] for a, b in zip(dist, dist[1:]))
print(f'rise: {len(CAMERA["keys"])} story keys -> {len(ks)} baked; peak {pk[1]:.2f} u/s at {pk[0]:.1f} s; '
      f'max heading change between samples {turn:.1f} deg; view turns <= {rot[3]:.0f} deg/s (at {rot[0]:.1f} s); 0-2 s distance to the notebook {dist[0][1]:.2f} -> {dist[-1][1]:.2f} '
      f'({"only outward" if outward else "NOT monotone"})')
for t0 in range(0, SECONDS, 2):
    w = [p for p in prof if t0 <= p[0] < t0 + 2]
    if w: print(f'  t {t0:4.1f}-{t0 + 2:4.1f}  speed {min(p[1] for p in w):.2f}-{max(p[1] for p in w):.2f} u/s  view turn <= {max(p[3] for p in w):4.1f} deg/s')
worst = None
for k in ks:
    t = k['time'] * SECONDS
    if t < 6.4 + WAKE: continue
    xs, ys = zip(*[project(k['view'], X) for X in desk_points(t)])
    m = min(min(xs), 960 - max(xs), min(ys), 540 - max(ys))
    if worst is None or m < worst[0]: worst = (m, t, min(xs), max(xs), min(ys), max(ys))
print(f'  whole desk in frame from {6.4 + WAKE:g} s: tightest margin {worst[0]:.0f} px at {worst[1]:.1f} s '
      f'(x {worst[2]:.0f}-{worst[3]:.0f}, y {worst[4]:.0f}-{worst[5]:.0f} of 960x540)')
for k in CAMERA['keys']:
    p = k['position']; az = math.degrees(math.atan2(p[2] - DESK_C[1], p[0] - DESK_C[0]))
    xs, ys = zip(*[project(k, X) for X in desk_points(k['at'])])
    box = f'desk x {min(xs):4.0f}-{max(xs):4.0f} y {min(ys):4.0f}-{max(ys):4.0f}' if k['at'] >= 3 else 'notebook close-up' + ' ' * 13
    print(f'  key {k["at"]:5.2f}  az {az:5.1f}  dist {math.hypot(p[0] - DESK_C[0], p[2] - DESK_C[1]):.2f}  y {p[1]:.2f}  fov {k.get("fov")}  '
          f'{box}  {k.get("label", "")}')
print('  (az 0 = desk front, + toward the portrait-monitor end; desk = casters to monitor tops, in 960x540 px)')
