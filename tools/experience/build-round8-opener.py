#!/usr/bin/env python3
"""Round 8, chapter 1 (awaken): the opener's timeline, camera and look after Vico's HQ14 previews (2026-11-04).

Runs after build-round8-leds.py (the neutral colour and the floor light; floorLight is owned there) and owns the
chapter's performance: motion clips, ledStatus, cameraPlan (+ the baked camera), seconds, the stage-rig cues and the
monitor clip. Every value is absolute, so it is safe to re-run.
Usage: build-round8-opener.py <hq dir>  (review-cut.json and shots/01.json, in place)

HQ14e (Vico, after the HQ14 preview and a rewatch of HQ9):
- The start is HQ9's again: the wheel macro on the +z side, the wheels start rolling (12 in forward, wheels
  mode 3) while the camera trucks along them and pulls back to the silhouette, and the monitor runs the digital-twin
  dashboard (screens/01-main.mp4, made by the screen-clip owner from this shot's motion clips).
  Folded into it: the desk is dark while the camera finds the wheel, switches on (0.3 s, white) at 1.4 s, settles,
  and the wheels start at 3.2 s.
- A pause between moves: each status colour fades to the neutral white over 1 s and the white then holds 1.5 s
  before the next move (gaps of 2.5 s), so every light settles and the camera has room to adjust.
- The other side: everything up to the tilts is seen from the desk's +z side (HQ9's side). The camera then keeps
  orbiting left while the desk turns 180 deg right (18 deg/s average, 27 peak: the real desk), so the two add up to
  a slow ~230 deg reveal (profile, back, far profile) that lands on the far side's front 3/4: the desk ends pointed
  the opposite way, on the side never shown before. The forward roll moved to the opening (HQ9's wheels), so the
  chapter ends on the turn and the clean hero push.
"""
import glob, json, math, os, subprocess, sys

H = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 46.5

# ---------------------------------------------------------------- desk performance (chapter seconds)
ON = (1.4, .3)            # lights off -> neutral white (the switch-on)
ROLL = (3.2, 2.6)         # 12 in forward (mode 3), HQ9's wheels start: 4.6 in/s average, 6.9 peak
LIFT = (11.0, 5.6)        # 28 -> 46 in, 3.2 in/s (the real speed)
TILT_UP = (19.1, 3.8)     # 0 -> 15 deg, board steepening: purple; 3.9 deg/s
TILT_BACK = (25.4, 3.8)   # 15 -> 0 deg, back toward flat: yellow-green
TURN = (31.7, 10.0)       # 180 deg right (mode 6), 18 deg/s average, 27 peak
FADE = 1.0                # each state's fade back to the neutral white; + 1.5 s settled = the 2.5 s gaps
ROLL_IN, LIFT_TO, TILT_DEG, TURN_DEG = 12, 46, 15, 180
SETTLE = (42.5, 45.0)     # stage back to the clean product look once the turn's light has faded (42.7)


def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c


# Labels feed the monitor's activity log (ch01: 'Turn...' labels are read as pose turns, so the rotate says 'Rotating').
CLIPS = [clip('op-roll', 'wheels', 'travel', *ROLL, label='Move forward', value=ROLL_IN, direction='forward'),
         clip('op-lift', 'lift', 'lift', *LIFT, label='Lift up', target=LIFT_TO),
         clip('op-tilt-up', 'tilt', 'tilt', *TILT_UP, label='Tilt up', target=TILT_DEG),
         clip('op-tilt-back', 'tilt', 'tilt', *TILT_BACK, label='Tilt level', target=0),
         clip('op-turn', 'wheels', 'rotate', *TURN, label='Rotating right', value=TURN_DEG, direction='right')]
STATUS = [{'at': 0, 'dur': ON[0], 'kind': 'off', 'fade': ON[1]},
          {'at': ROLL[0], 'dur': ROLL[1], 'kind': 'wheels', 'mode': 3, 'fade': FADE},
          {'at': LIFT[0], 'dur': LIFT[1], 'kind': 'lift-up', 'fade': FADE},
          {'at': TILT_UP[0], 'dur': TILT_UP[1], 'kind': 'tilt-retract', 'fade': FADE},
          {'at': TILT_BACK[0], 'dur': TILT_BACK[1], 'kind': 'tilt-extend', 'fade': FADE},
          {'at': TURN[0], 'dur': TURN[1], 'kind': 'wheels', 'mode': 6, 'fade': FADE}]

# ---------------------------------------------------------------- camera
# Desk box centre (x, z) at rest is (0.14, 0) and its turn pivot (the model origin) is 0.24 u behind it (build-opener.py,
# measured with render-cut --list-at). The 12 in roll (0.46 u) goes along +x (the desk's forward at yaw 0), so the
# centre is (0.60, 0) and the pivot (0.36, 0) until the turn; a right turn swings the centre about the pivot toward -z,
# and after 180 deg it is at (0.12, 0).
C_REST, PIVOT, OFF, ROLL_U = (0.14, 0.0), (0.36, 0.0), 0.24, 12 / 26
C_ROLL = (C_REST[0] + ROLL_U, 0.0)


def turned(t):
    """Yaw turned so far (deg) and the desk box centre at chapter time t during or after the turn."""
    f = min(1, max(0, (t - TURN[0]) / TURN[1])); th = TURN_DEG * f * f * (3 - 2 * f)
    a = math.radians(-th)
    return th, (round(PIVOT[0] + OFF * math.cos(a), 4), round(PIVOT[1] + OFF * math.sin(a), 4))


def orbit(at, az, dist, cam_y, aim_y, shift, fov, centre, label=None):
    """A key around the desk: az (deg) from +x toward +z (world), horizontal distance, camera and aim heights, and
    shift (scene units) of the aim along screen-left, so +shift puts the desk right of frame (the title side clear)."""
    a = math.radians(az)
    px, pz = centre[0] + dist * math.cos(a), centre[1] + dist * math.sin(a)
    vx, vz = centre[0] - px, centre[1] - pz; n = math.hypot(vx, vz); vx, vz = vx / n, vz / n
    rx, rz = -vz, vx
    tx, tz = centre[0] - rx * shift, centre[1] - rz * shift
    k = {'at': at, 'position': [round(px, 3), round(cam_y, 3), round(pz, 3)], 'target': [round(tx, 3), round(aim_y, 3), round(tz, 3)], 'fov': fov}
    if label: k['label'] = label
    return k


def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k


def tk(at, az, *a, label=None):
    """A key during or after the turn, around the desk's centre at that moment."""
    return orbit(at, az, *a, centre=turned(at)[1], label=label)


# Act 1 is HQ9's (exports/cinematic-intro-20261103-hq9 cameraPlan, same 12 in roll), its keys from the wheel start on
# shifted +1.8 s to the new wheel start (HQ9 1.4 -> 3.2). Then the crane and the lift are HQ14's, mirrored to this side.
CAMERA = {'easeIn': True, 'easeOut': False, 'keys': [
    key(0.0, [1.123, 0.10, 1.785], [0.093, 0.179, 0.972], 24, 'Wheel macro, desk dark'),
    key(3.2, [1.400, 0.09, 1.300], [0.172, 0.154, 0.969], 24, 'Wheels start'),
    key(4.5, [1.844, 0.15, 1.250], [0.406, 0.324, 1.020], 24),
    key(5.8, [3.179, 0.32, 1.567], [0.515, 0.545, 0.891], 24, 'Roll lands, pull back'),
    key(7.2, [5.150, 0.95, 2.050], [0.416, 1.160, 0.581], 25),
    key(8.7, [6.903, 1.50, 2.606], [0.224, 1.369, 0.644], 26.5, 'Silhouette, first title'),
    orbit(11.0, 31, 6.25, 3.30, 1.05, 0.85, 33, C_ROLL, 'Rising as the lift starts'),
    orbit(13.4, 38, 6.35, 4.45, 1.00, 1.05, 35, C_ROLL, '3/4 from above: blue lift, floor pool'),
    orbit(16.4, 50, 6.50, 4.35, 1.15, 1.00, 35, C_ROLL, 'Lift lands'),
    orbit(18.8, 63, 6.55, 3.05, 1.28, 0.65, 34, C_ROLL, 'Settled white, descending'),
    orbit(21.0, 73, 6.40, 2.30, 1.25, 0.30, 34, C_ROLL, 'Profile: purple'),
    orbit(24.2, 80, 6.35, 2.20, 1.25, 0.22, 34, C_ROLL),
    orbit(27.3, 86, 6.33, 2.18, 1.25, 0.18, 34, C_ROLL, 'Profile: yellow-green'),
    orbit(30.2, 92, 6.30, 2.20, 1.25, 0.15, 34, C_ROLL, 'Settled white before the turn'),
    tk(31.7, 95, 6.30, 2.22, 1.25, 0.12, 34, label='Turn begins: camera keeps arcing left'),
    tk(34.2, 103, 6.30, 2.28, 1.25, 0.10, 34),
    tk(36.7, 113, 6.25, 2.34, 1.26, 0.08, 34, label='The back'),
    tk(39.2, 124, 6.20, 2.40, 1.27, 0.08, 34, label='Far profile'),
    tk(41.7, 133, 6.10, 2.48, 1.29, 0.08, 33.5, label='Turn lands: far side front 3/4'),
    tk(44.0, 138, 5.90, 2.56, 1.31, 0.08, 33),
    tk(SECONDS, 141, 5.75, 2.65, 1.33, 0.08, 32, label='Clean hero 3/4, slow push')]}

# ---------------------------------------------------------------- look
# Dark stage until the switch-on, the status levels while the desk's lights play, the clean product look at the end.
RIG_KEY = [[0, 6], [ON[0], 6], [sum(ON), 22], [SETTLE[0], 22], [SETTLE[1], 40]]
RIG_POOL = [[0, 0], [ON[0], 0], [sum(ON), .1], [SETTLE[0], .1], [SETTLE[1], .3]]
RIMS = [[0, 120], [9.5, 120], [10.6, 0], [SETTLE[0], 0], [SETTLE[1], 200]]   # out before the crane mirrors them in the top
ENV = [[0, .15], [ON[0], .15], [sum(ON), .35], [SETTLE[0], .35], [SETTLE[1], 1]]
WAKE = (9.6, 11.6)        # the stage light, pulse ring and overhead key dim before the lift (build-opener.py cue())


def cue(a, b):
    return [[0, a], [WAKE[0], a], [WAKE[1], b], [SETTLE[0], b], [SETTLE[1], a]]


# The monitor: HQ9's digital-twin dashboard, regenerated from this timeline by the screen-clip owner (its readouts
# sample motion.clips). OPENER_PREVIEW_SCREEN=1 points it at HQ9's clip for stills while the HQ14 one is not made yet.
SCREEN = {'target': 'main-landscape', 'src': 'exports/cinematic-intro-20261104-hq14/screens/01-main.mp4'}
PREVIEW_SCREEN = {'target': 'main-landscape', 'src': 'exports/cinematic-intro-20261030/screens/01-main.mp4'}


def fix(s):
    if s.get('id') != 'awaken':
        return s
    s['seconds'] = SECONDS
    s['motion'] = {'version': 2, 'initial': {'height': 28, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': CLIPS}
    s['ledStatus'] = STATUS
    s['cameraPlan'] = CAMERA
    rig = next(l for l in s['lights'] if l.get('preset') == 'productRig')
    rig['key'] = {'intensity': RIG_KEY}
    rig['pool'] = {'strength': RIG_POOL}
    for r in ('rimLeft', 'rimRight'): rig[r] = {'intensity': RIMS}
    s['sceneGlobals']['environmentScale'] = ENV
    for e in s['sceneEdits']:
        if e.get('match') == '@stageLight': e['intensity'] = cue(1, .35)
        elif e.get('match') == '@pulse': e['opacity'] = cue(1, .4)
        elif e.get('lightType') == 'DirectionalLight': e['intensity'] = cue(1, .3)
    s['screens'] = [dict(PREVIEW_SCREEN if os.environ.get('OPENER_PREVIEW_SCREEN') else SCREEN)]
    return s


paths = [os.path.join(H, 'review-cut.json')] + sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json')))
for p in paths:
    d = json.load(open(p))
    if 'shots' in d: d['shots'] = [fix(s) for s in d['shots']]
    else: d = fix(d)
    json.dump(d, open(p, 'w'), indent=1)

# Bake the camera on shots/01.json and copy it into the cut.
f = os.path.join(H, 'shots', '01.json')
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
shot = json.load(open(f))
cp = os.path.join(H, 'review-cut.json'); cut = json.load(open(cp))
for s in cut['shots']:
    if s['id'] == 'awaken': s['camera'] = shot['camera']
json.dump(cut, open(cp, 'w'), indent=1)

# ---------------------------------------------------------------- report: camera speed and the view around the desk
ks = shot['camera']['keys']
def v(k, n): return k['view'][n]
prof = []
for a, b in zip(ks, ks[1:]):
    dt = (b['time'] - a['time']) * SECONDS
    if dt <= 1e-6: continue
    sp = math.dist(v(a, 'position'), v(b, 'position')) / dt
    ya = math.atan2(v(a, 'target')[2] - v(a, 'position')[2], v(a, 'target')[0] - v(a, 'position')[0])
    yb = math.atan2(v(b, 'target')[2] - v(b, 'position')[2], v(b, 'target')[0] - v(b, 'position')[0])
    prof.append(((a['time'] + b['time']) / 2 * SECONDS, sp, abs(math.degrees((yb - ya + math.pi) % (2 * math.pi) - math.pi)) / dt))
pk = max(prof, key=lambda p: p[1])
print(f'awaken: {SECONDS:g} s. on {ON[0]}, roll {ROLL[0]}-{sum(ROLL):.1f}, lift {LIFT[0]}-{sum(LIFT):.1f}, tilt up {TILT_UP[0]}-{sum(TILT_UP):.1f}, '
      f'tilt back {TILT_BACK[0]}-{sum(TILT_BACK):.1f}, turn {TURN[0]}-{sum(TURN):.1f}; camera peak {pk[1]:.2f} u/s at {pk[0]:.1f}, '
      f'yaw <= {max(p[2] for p in prof):.1f} deg/s')
for t0 in range(0, int(SECONDS) + 1, 3):
    w = [p for p in prof if t0 <= p[0] < t0 + 3]
    if w: print(f'  t {t0:4.1f}-{t0 + 3:4.1f}  speed {min(p[1] for p in w):.2f}-{max(p[1] for p in w):.2f} u/s  yaw <= {max(p[2] for p in w):4.1f} deg/s')
for k in CAMERA['keys']:
    th, c = turned(k['at']) if k['at'] >= TURN[0] else (0, C_ROLL if k['at'] >= sum(ROLL) else C_REST)
    az = math.degrees(math.atan2(k['position'][2] - c[1], k['position'][0] - c[0]))
    rel = (az + th + 180) % 360 - 180
    print(f'  key {k["at"]:5.1f}  camera az {az:6.1f}  desk-relative {rel:6.1f}  (0 front, +90 the HQ9 side, 180 back)  {k.get("label", "")}')
