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
- HQ14h: lights off through the macro and the dark 12 in roll; the 'ding' at 9.2 s once the desk is in full view; a
  lit 18 in roll toward the camera (mode 3) after the lowering, then the rise to full height for the hero.
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
SECONDS = 57.0

# ---------------------------------------------------------------- desk performance (chapter seconds)
ON = (9.2, .3)            # lights off -> neutral white (the 'ding'), once the desk is in full view at the silhouette
ROLL = (3.2, 2.6)         # 12 in forward in the dark (no status light), HQ9's wheels start: 4.6 in/s average, 6.9 peak
LIFT = (11.0, 7.6)        # 28 -> 52.5 in (full height), 3.2 in/s (the real speed)
TILT_DOWN = (21.1, 3.8)   # 0 -> 15 deg, board steepening: purple ('tilt-retract'); 3.9 deg/s
TURN = (27.4, 6.7)        # 120 deg LEFT (mode 5): the front swings to the camera and on to the far side; 18 deg/s average
TILT_BACK = (30.3, 3.8)   # 15 -> 0 deg under the second half of the turn (Vico), yellow-green; ends with the turn
LOWER = (36.6, 3.75)      # 52.5 -> 40.5 in, about halfway down, red ('lift-down')
ROLL_LIT = (42.85, 3.4)   # 18 in forward toward the camera with the lights on (mode 3, foot-rest comet), 5.3 in/s
LIFT_END = (48.75, 3.75)  # back up to full height for the hero, blue
FADE = 1.0                # each state's fade back to the neutral white; + 1.5 s settled = the 2.5 s gaps
ROLL_IN, FULL, HALF, TILT_DEG, TURN_DEG, ROLL_LIT_IN = 12, 52.5, 40.5, 15, 120, 18
SETTLE = (53.25, 55.65)   # stage back to the clean product look once the last light has faded (53.5)


def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c


# Labels feed the monitor's activity log (ch01 reads 'Turn...' labels as pose turns, so the rotate says 'Rotating').
CLIPS = [clip('op-roll', 'wheels', 'travel', *ROLL, label='Move forward', value=ROLL_IN, direction='forward'),
         clip('op-lift', 'lift', 'lift', *LIFT, label='Lift up', target=FULL),
         clip('op-tilt-down', 'tilt', 'tilt', *TILT_DOWN, label='Tilt up', target=TILT_DEG),
         clip('op-turn', 'wheels', 'rotate', *TURN, label='Rotating left', value=TURN_DEG, direction='left'),
         clip('op-tilt-back', 'tilt', 'tilt', *TILT_BACK, label='Tilt level', target=0),
         clip('op-lower', 'lift', 'lift', *LOWER, label='Lift down', target=HALF),
         clip('op-roll-lit', 'wheels', 'travel', *ROLL_LIT, label='Move forward', value=ROLL_LIT_IN, direction='forward'),
         clip('op-lift-end', 'lift', 'lift', *LIFT_END, label='Lift up', target=FULL)]
# One LED state at a time (film-status: first match, and the fade starts from the last event to end), so the events
# never overlap: the turn shows its wheels light until the tilt back starts under it, then yellow-green. The opening
# roll is in the dark (Vico: the light comes on once the desk is in full view); the lit roll comes later.
STATUS = [{'at': 0, 'dur': ON[0], 'kind': 'off', 'fade': ON[1]},
          {'at': LIFT[0], 'dur': LIFT[1], 'kind': 'lift-up', 'fade': FADE},
          {'at': TILT_DOWN[0], 'dur': TILT_DOWN[1], 'kind': 'tilt-retract', 'fade': FADE},
          {'at': TURN[0], 'dur': round(TILT_BACK[0] - TURN[0], 3), 'kind': 'wheels', 'mode': 5, 'fade': FADE},
          {'at': TILT_BACK[0], 'dur': TILT_BACK[1], 'kind': 'tilt-extend', 'fade': FADE},
          {'at': LOWER[0], 'dur': LOWER[1], 'kind': 'lift-down', 'fade': FADE},
          {'at': ROLL_LIT[0], 'dur': ROLL_LIT[1], 'kind': 'wheels', 'mode': 3, 'fade': FADE},
          {'at': LIFT_END[0], 'dur': LIFT_END[1], 'kind': 'lift-up', 'fade': FADE}]

# ---------------------------------------------------------------- desk geometry for the camera
# Desk box centre (x, z) at rest is (0.14, 0); its turn pivot (the model origin) is 0.24 u behind it (build-opener.py,
# measured with render-cut --list-at). The 12 in roll (0.46 u) goes along +x (forward at yaw 0): centre (0.60, 0),
# pivot (0.36, 0). A left turn swings the front from +x toward +z (the camera side); after 120 deg the centre is
# (0.24, 0.21). The lit roll goes along the turned front, world az +120 (toward the camera). 1 u ~ 26 in.
C_REST, PIVOT, OFF, U = (0.14, 0.0), (0.36, 0.0), 0.24, 1 / 26
C_ROLL = (C_REST[0] + ROLL_IN * U, 0.0)


def sm(f): f = min(1, max(0, f)); return f * f * (3 - 2 * f)


def desk(t):
    """Yaw turned left so far (deg) and the desk box centre (x, z) at chapter time t."""
    if t < TURN[0]:
        k = sm((t - ROLL[0]) / ROLL[1]); return 0, (C_REST[0] + ROLL_IN * U * k, 0.0)
    th = TURN_DEG * sm((t - TURN[0]) / TURN[1]); a = math.radians(th)
    c = (PIVOT[0] + OFF * math.cos(a), PIVOT[1] + OFF * math.sin(a))
    s = ROLL_LIT_IN * U * sm((t - ROLL_LIT[0]) / ROLL_LIT[1]); r = math.radians(TURN_DEG)   # forward = the turned front
    return th, (round(c[0] + s * math.cos(r), 4), round(c[1] + s * math.sin(r), 4))


def orbit(at, az, dist, cam_y, aim_y, shift, fov, centre=None, label=None, cut=False):
    """A key around the desk: az (deg) from +x toward +z (world), horizontal distance, camera and aim heights, and
    shift (scene units) of the aim along screen-left, so +shift puts the desk right of frame (the title side clear).
    The centre defaults to the desk's centre at that moment."""
    centre = centre or desk(at)[1]
    a = math.radians(az)
    px, pz = centre[0] + dist * math.cos(a), centre[1] + dist * math.sin(a)
    vx, vz = centre[0] - px, centre[1] - pz; n = math.hypot(vx, vz); vx, vz = vx / n, vz / n
    rx, rz = -vz, vx
    tx, tz = centre[0] - rx * shift, centre[1] - rz * shift
    k = {'at': at, 'position': [round(px, 3), round(cam_y, 3), round(pz, 3)], 'target': [round(tx, 3), round(aim_y, 3), round(tz, 3)], 'fov': fov}
    if label: k['label'] = label
    if cut: k['cut'] = True
    return k


def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k


# ---------------------------------------------------------------- camera: five shots, each with one job
# az is world (the HQ9 side is +z, az ~ +90); the report prints the desk-relative angle (0 front, -: the far side).
# Each shot settles before its cut (camera-spline: a cut ends the move at rest) and starts from rest.
CUTS = (9.8, 20.6, 26.6, 42.2)
CAMERA = {'easeIn': True, 'easeOut': False, 'keys': [
    # 1. HQ9's opening (its cameraPlan, same 12 in roll; keys from the wheel start shifted +1.8 s): wheel macro in the
    #    dark, the switch-on, the wheels roll, pull back to the silhouette under the first title.
    key(0.0, [1.123, 0.10, 1.785], [0.093, 0.179, 0.972], 24, 'Wheel macro, desk dark'),
    key(3.2, [1.400, 0.09, 1.300], [0.172, 0.154, 0.969], 24, 'Wheels start'),
    key(4.5, [1.844, 0.15, 1.250], [0.406, 0.324, 1.020], 24),
    key(5.8, [3.179, 0.32, 1.567], [0.515, 0.545, 0.891], 24, 'Roll lands, pull back'),
    key(7.2, [5.150, 0.95, 2.050], [0.416, 1.160, 0.581], 25),
    key(8.7, [6.903, 1.50, 2.606], [0.224, 1.369, 0.644], 26.5, 'Silhouette, first title'),
    orbit(CUTS[0] - .05, 20.5, 6.75, 1.52, 1.37, 0.62, 26.5),
    # 2. The lift from the floor: a low, close 3/4 on the foot rest (its LED lights first), then a jib that rises
    #    with the desk and past it, pulling back to the 3/4 from above (the desktop wash and floor pool) as it lands
    #    at full height. Desk right of frame for the SAFETY card.
    orbit(CUTS[0], 34, 3.30, 0.28, 0.42, 0.30, 30, label='Low on the foot rest', cut=True),
    orbit(11.4, 36, 3.30, 0.30, 0.50, 0.32, 30, label='Foot rest lights'),
    orbit(13.8, 40, 4.40, 1.15, 1.00, 0.55, 32, label='Jib up with the desktop'),
    orbit(16.6, 46, 5.70, 2.90, 1.40, 0.80, 34),
    orbit(19.4, 52, 6.40, 4.10, 1.45, 0.85, 35, label='Full height, 3/4 from above'),
    orbit(CUTS[1] - .05, 54, 6.45, 4.15, 1.45, 0.85, 35),
    # 3. The tilt in tight profile at the board's height: the edge steepens against black, a slow lateral dolly
    #    for parallax.
    orbit(CUTS[1], 80, 3.70, 2.30, 1.95, -0.10, 28, label='Board edge, profile', cut=True),
    orbit(23.0, 85, 3.60, 2.25, 1.95, -0.05, 28, label='Purple, steepening'),
    orbit(CUTS[2] - .05, 92, 3.50, 2.20, 1.92, 0.00, 28),
    # 4. The turn, wide and low: the front swings to the lens and on to the far side, the camera arcs the other way;
    #    the tilt levels under it. Then it rises above the desktop and rides the lowering down (the red sweep).
    orbit(CUTS[2], 68, 6.40, 1.35, 1.50, 0.00, 32, label='Low wide: the turn', cut=True),
    orbit(TURN[0], 69, 6.40, 1.36, 1.50, 0.00, 32),
    orbit(30.8, 75, 6.30, 1.50, 1.55, 0.00, 32, label='Face on, tilt levels'),
    orbit(34.1, 82, 6.15, 1.80, 1.60, 0.00, 32, label='Far side 3/4'),
    orbit(36.6, 85, 6.00, 3.10, 1.60, 0.00, 32, label='Above the desktop'),
    orbit(40.4, 88, 5.90, 1.85, 1.35, 0.00, 32, label='Rides the red sweep down'),
    orbit(CUTS[3] - .05, 89, 5.90, 1.80, 1.33, 0.00, 32),
    # 5. The finale: a front 3/4 just above the desktop as the desk glides toward the lens (red comet from the foot rest
    #    across the floor), the camera easing back less than the desk comes so it grows in frame; the rise back to full
    #    height in blue; then, as the light settles and the clean look returns, a crane down into a low far-side 3/4.
    orbit(CUTS[3], 96, 7.10, 1.95, 1.00, 0.00, 30, label='Lit roll toward the lens', cut=True),
    orbit(sum(ROLL_LIT), 92, 6.35, 1.85, 1.05, 0.00, 31),
    orbit(LIFT_END[0], 90, 6.35, 2.45, 1.20, 0.00, 32, label='Rise to full height: blue'),
    orbit(sum(LIFT_END), 88, 6.40, 2.35, 1.45, 0.02, 33),
    orbit(54.6, 86, 6.40, 1.60, 1.42, 0.04, 33),
    orbit(SECONDS, 84, 6.35, 1.05, 1.40, 0.05, 33, label='Clean low hero, full height')]}

# ---------------------------------------------------------------- look
# Dark stage until the switch-on, the status levels while the desk's lights play, the clean product look at the end.
# The stage key dips to 4 over the turn (its 22 on top of the amber caution light turned the desktop hot cream; at 4 it
# reads the visualizer's red-orange), then comes back for the settle and the hero bookend.
TURN_KEY = (TURN[0] - .5, TURN[0] + .7, TILT_BACK[0], TILT_BACK[0] + .8)   # over the turn's wheels light only
RIG_KEY = [[0, 6], [ON[0], 6], [sum(ON), 22], [TURN_KEY[0], 22], [TURN_KEY[1], 4], [TURN_KEY[2], 4], [TURN_KEY[3], 22], [SETTLE[0], 22], [SETTLE[1], 40]]
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
    if dt <= 1e-6 or a.get('easing') == 'hold': continue   # a cut
    sp = math.dist(v(a, 'position'), v(b, 'position')) / dt
    ya = math.atan2(v(a, 'target')[2] - v(a, 'position')[2], v(a, 'target')[0] - v(a, 'position')[0])
    yb = math.atan2(v(b, 'target')[2] - v(b, 'position')[2], v(b, 'target')[0] - v(b, 'position')[0])
    prof.append(((a['time'] + b['time']) / 2 * SECONDS, sp, abs(math.degrees((yb - ya + math.pi) % (2 * math.pi) - math.pi)) / dt))
pk = max(prof, key=lambda p: p[1])
print(f'awaken: {SECONDS:g} s; camera peak {pk[1]:.2f} u/s at {pk[0]:.1f}, yaw <= {max(p[2] for p in prof):.1f} deg/s (cuts at {CUTS})')
for t0 in range(0, int(SECONDS) + 1, 3):
    w = [p for p in prof if t0 <= p[0] < t0 + 3]
    if w: print(f'  t {t0:4.1f}-{t0 + 3:4.1f}  speed {min(p[1] for p in w):.2f}-{max(p[1] for p in w):.2f} u/s  yaw <= {max(p[2] for p in w):4.1f} deg/s')
for k in CAMERA['keys']:
    th, c = desk(k['at'])
    az = math.degrees(math.atan2(k['position'][2] - c[1], k['position'][0] - c[0]))
    rel = (az - th + 180) % 360 - 180
    print(f'  key {k["at"]:5.2f}{" CUT" if k.get("cut") else "    "}  camera az {az:6.1f}  desk-relative {rel:6.1f}  (0 front, +90 the HQ9 side, 180 back)  {k.get("label", "")}')
