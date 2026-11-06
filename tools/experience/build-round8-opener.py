#!/usr/bin/env python3
"""Round 10, chapter 1 (awaken): the opener's timeline, camera and look after Vico's 57 s round 9d preview (2026-11-04).

Runs after build-round8-leds.py (the neutral colour and the floor light; floorLight is owned there) and owns the
chapter's performance: motion clips, ledStatus, cameraPlan (+ the baked camera), seconds, the stage-rig cues and the
monitor clip. Every value is absolute, so it is safe to re-run.
Usage: build-round8-opener.py <hq dir>  (review-cut.json and shots/01.json in place; writes previews/awaken-v5-cut.json)
If <hq>/director-camera.json exists (director-bridge.py import, same chapter seconds) its keys replace CAMERA's.

Round 10 (Vico on 9d: hard cuts look bad, the lift start is a poor shot, the monitor crops mid-rise, the 3/4 at the
lowering is too frontal, 57 s is too long):
- One continuous camera, no cuts or holds: it flies between vantage points on smooth curves like a drone, and every
  vantage is reached while the desk is still or slowly moving, so nothing whips.
- The opener is HQ9's (wheel macro in the dark, the wheels roll, the camera trucks with them and pulls back), but the
  pull-back is shorter and lands on a low front 3/4 that already frames the whole desk, so the lights switch on there
  and the lift starts from the same view: no wide -> tight jump at the lift. The camera then cranes up with the rise
  and eases back so the monitor never touches the frame edge.
- Gaps between moves are 1.5 s (each status colour fades to the neutral white over 1 s, then 0.5 s settled).
- The turn (120 deg left) is watched from the +z side, so the front swings to the lens and past it; the back never
  shows. It lands on a true far-side three-quarter (~40 deg off the front), which the lowering, the lit roll and the
  hero all keep, with a slow low arc and push to the end.
"""
import glob, json, math, os, subprocess, sys

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------- desk performance (chapter seconds)
GAP = 1.5                 # between moves: the status colour's 1 s fade to white + 0.5 s settled
FADE = 1.0
ROLL = (1.8, 2.6)         # 12 in forward in the dark (no status light), HQ9's wheels: 4.6 in/s average, 6.9 peak
ON = (7.6, .3)            # lights off -> neutral white (the 'ding'), once the pull-back has the whole desk framed (7.5)
BEAT = .45                # Director clips: lit and still this long before the first lift (ON is re-derived from it)
LIFT = (round(sum(ON) + GAP, 3), 7.6)                       # 28 -> 52.5 in (full height), 3.2 in/s (the real speed)
TILT_DOWN = (round(sum(LIFT) + GAP, 3), 3.8)                # 0 -> 15 deg: purple ('tilt-retract'); 3.9 deg/s
TURN = (round(sum(TILT_DOWN) + GAP, 3), 6.7)                # 120 deg LEFT (mode 5): 18 deg/s average, 27 peak
TILT_BACK = (round(sum(TURN) - 3.8, 3), 3.8)                # 15 -> 0 deg under the second half of the turn, yellow-green
LOWER = (round(sum(TURN) + GAP, 3), 3.75)                   # 52.5 -> 40.5 in, about halfway down, red ('lift-down')
ROLL_LIT = (round(sum(LOWER) + GAP, 3), 3.4)                # 18 in forward with the lights on (mode 3), 5.3 in/s
LIFT_END = (round(sum(ROLL_LIT) + GAP, 3), 3.75)            # back up to full height for the hero, blue
SETTLE = (round(sum(LIFT_END) + .5, 3), round(sum(LIFT_END) + 1.9, 3))   # stage back to the clean product look
SECONDS = round(sum(LIFT_END) + 1.9, 2)                     # the hero settles as the chapter dissolves out
ROLL_IN, FULL, HALF, TILT_DEG, TURN_DEG, ROLL_LIT_IN = 12, 52.5, 40.5, 15, 120, 18
TAIL = 1.9          # the chapter ends this long after the last move (the settle), as the hero always did
FIRST_LIFT = 45.5   # Vico, Director Mode 2026-11-04: the first lift stops at 45.5 in (same 7.6 s), not full height


def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c


# Labels feed the monitor's activity log (ch01 reads 'Turn...' labels as pose turns, so the rotate says 'Rotating').
CLIPS = [clip('op-roll', 'wheels', 'travel', *ROLL, label='Move forward', value=ROLL_IN, direction='forward'),
         clip('op-lift', 'lift', 'lift', *LIFT, label='Lift up', target=FIRST_LIFT),
         clip('op-tilt-down', 'tilt', 'tilt', *TILT_DOWN, label='Tilt up', target=TILT_DEG),
         clip('op-turn', 'wheels', 'rotate', *TURN, label='Rotating left', value=TURN_DEG, direction='left'),
         clip('op-tilt-back', 'tilt', 'tilt', *TILT_BACK, label='Tilt level', target=0),
         clip('op-lower', 'lift', 'lift', *LOWER, label='Lift down', target=HALF),
         clip('op-roll-lit', 'wheels', 'travel', *ROLL_LIT, label='Move forward', value=ROLL_LIT_IN, direction='forward'),
         clip('op-lift-end', 'lift', 'lift', *LIFT_END, label='Lift up', target=FULL)]
# Director Mode edits (director-bridge.py import -> <hq>/director-camera.json 'clips'): Vico's movement changes override
# these clips by id (start, duration, target/value, easing, label); clips he adds are kept, clips he deletes are dropped.
# The timing constants below are re-read from the clips, so the status lights, the stage cues and the camera's desk
# model follow his edit.
DIRECTOR = os.path.join(H, 'director-camera.json')
_dc = json.load(open(DIRECTOR)) if os.path.exists(DIRECTOR) else {}
if _dc.get('clips'):
    mine = {c['id']: c for c in CLIPS}; out = []
    for d in sorted(_dc['clips'], key=lambda c: c['start']):
        c = dict(mine.get(d['id'], {})); c.update({k: v for k, v in d.items() if k in ('id', 'lane', 'kind', 'start', 'duration', 'easing', 'label', 'target', 'value', 'direction', 'path')})
        out.append(c)
    CLIPS = out; _by = {c['id']: c for c in CLIPS}; _t = lambda i, d: (_by[i]['start'], _by[i]['duration']) if i in _by else d
    ROLL, LIFT, TILT_DOWN, TURN, TILT_BACK = _t('op-roll', ROLL), _t('op-lift', LIFT), _t('op-tilt-down', TILT_DOWN), _t('op-turn', TURN), _t('op-tilt-back', TILT_BACK)
    LOWER, ROLL_LIT, LIFT_END = _t('op-lower', LOWER), _t('op-roll-lit', ROLL_LIT), _t('op-lift-end', LIFT_END)
    ROLL_IN = _by.get('op-roll', {}).get('value', ROLL_IN); ROLL_LIT_IN = _by.get('op-roll-lit', {}).get('value', ROLL_LIT_IN)
    TURN_DEG = _by.get('op-turn', {}).get('value', TURN_DEG)
    if _dc.get('seconds'): SECONDS = float(_dc['seconds'])
    # Derived from his clips, not the authored constants: the lights switch on a short beat before the first move
    # (Vico: dark until the whole desk is framed, then on, then the lift), and the stage settles after the last move.
    ON = (round(LIFT[0] - BEAT - ON[1], 3), ON[1])
    # HQ24 (Vico deleted the hero lift and cut the end): the stage settles after his LAST move, whichever it is, and the
    # chapter ends TAIL after it (or after his last camera key, if later), so a Director project left longer than the
    # cut has no dead hold at the end.
    LAST = max(c['start'] + c['duration'] for c in CLIPS)
    if 'op-lift-end' not in _by: LIFT_END = (LAST - LIFT_END[1], LIFT_END[1])   # only feeds the settle and the camera tail
    LAST = max([LAST] + [k['at'] for k in _dc.get('keys', [])])
    SECONDS = round(min(SECONDS, LAST + TAIL), 2)
    SETTLE = (round(LAST + .5, 3), round(min(SECONDS, LAST + 1.9), 3))
    print(f'awaken: {len(CLIPS)} movement clips from {DIRECTOR}, {SECONDS:g} s')

# One LED state at a time (film-status: first match, and the fade starts from the last event to end), so the events
# never overlap: the turn shows its wheels light until the tilt back starts under it, then yellow-green. The opening
# roll is in the dark (Vico: the light comes on once the desk is in full view); the lit roll comes later.
STATUS = [{'at': 0, 'dur': ON[0], 'kind': 'off', 'fade': ON[1]},
          {'at': LIFT[0], 'dur': LIFT[1], 'kind': 'lift-up', 'fade': FADE},
          {'at': TILT_DOWN[0], 'dur': TILT_DOWN[1], 'kind': 'tilt-retract', 'fade': FADE},
          {'at': TURN[0], 'dur': round(min(sum(TURN), TILT_BACK[0]) - TURN[0], 3), 'kind': 'wheels', 'mode': 5, 'fade': FADE},
          {'at': TILT_BACK[0], 'dur': TILT_BACK[1], 'kind': 'tilt-extend', 'fade': FADE},
          {'at': LOWER[0], 'dur': LOWER[1], 'kind': 'lift-down', 'fade': FADE},
          {'at': ROLL_LIT[0], 'dur': ROLL_LIT[1], 'kind': 'wheels', 'mode': 3, 'fade': FADE},
          {'at': LIFT_END[0], 'dur': LIFT_END[1], 'kind': 'lift-up', 'fade': FADE}]
if _dc.get('clips'):   # a movement Vico deleted in Director Mode takes its status light with it
    ids = [None, 'op-lift', 'op-tilt-down', 'op-turn', 'op-tilt-back', 'op-lower', 'op-roll-lit', 'op-lift-end']
    # The colour follows each clip's direction (his targets): lift up blue / down red; tilt angle increasing purple
    # ('tilt-retract'), back toward flat yellow-green ('tilt-extend').
    kind, h, tl = {}, 28, 0
    for c in sorted(CLIPS, key=lambda c: c['start']):
        if c.get('lane') == 'lift' and 'target' in c: kind[c['id']] = 'lift-up' if c['target'] >= h else 'lift-down'; h = c['target']
        if c.get('lane') == 'tilt' and 'target' in c: kind[c['id']] = 'tilt-retract' if c['target'] > tl else 'tilt-extend'; tl = c['target']
    STATUS = [dict(e, kind=kind.get(i, e['kind'])) for e, i in zip(STATUS, ids) if i is None or i in _by]
# Overlapping moves (his edit runs the turn under the tilt, the lowering under the tilt back, the rise under the lit
# roll): the strips show one state at a time, so each light hands over to the next move's at that move's start.
STATUS.sort(key=lambda e: e['at'])
for e, n in zip(STATUS, STATUS[1:]): e['dur'] = round(min(e['at'] + e['dur'], n['at']) - e['at'], 3)

# ---------------------------------------------------------------- desk geometry for the camera
# Desk box centre (x, z) at rest is (0.14, 0); its turn pivot (the model origin) is 0.24 u behind it (render-cut
# --list-at). The 12 in roll (0.46 u) goes along +x (forward at yaw 0, the monitor faces +x): centre (0.60, 0),
# pivot (0.36, 0). A left turn swings the front from +x toward +z (the camera side); after 120 deg the centre is
# (0.24, 0.21). The lit roll goes along the turned front, world az +120. 1 u ~ 26 in. The leg uprights stand 2.5 u
# (fixed); the monitor top is 1.96 u at 28 in and 2.9 u at full height.
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


def orbit(at, az, dist, cam_y, aim_y, shift, fov, centre=None, label=None):
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
    return k


def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k


# ---------------------------------------------------------------- camera: one continuous flight, no cuts
# az is world (the HQ9 side is +z, az ~ +90); the report prints the desk-relative angle (0 front, -: the far side).
# Story keys only (camera-spline.mjs bakes one centripetal spline through them), each labelled for Director Mode.
# The desk sits right of frame while the lower-left titles are up (A 3.6-9.2 s, SAFETY 12.4-18.8 s).
CAMERA = {'easeIn': True, 'easeOut': False, 'keys': [
    # 1. HQ9's opening, 1.4 s earlier: the wheel macro in the dark, the wheels roll, the camera trucks with them, then
    #    a shorter, slower pull-back that curves out to a low front 3/4 with the whole desk in frame (lights on there).
    key(0.0, [1.123, 0.10, 1.785], [0.093, 0.179, 0.972], 24, 'Wheel macro, desk dark'),
    key(ROLL[0], [1.400, 0.09, 1.300], [0.172, 0.154, 0.969], 24, 'Wheels start'),
    key(3.1, [1.844, 0.15, 1.250], [0.406, 0.324, 1.020], 24, 'Truck with the wheels'),
    key(sum(ROLL), [2.75, 0.28, 1.62], [0.52, 0.50, 0.86], 25, 'Roll lands, pull back'),
    orbit(6.1, 36, 4.25, 0.52, 1.00, 0.35, 28.5, label='Pull back, rising'),
    orbit(7.5, 35, 5.45, 0.72, 1.26, 0.50, 31.5, label='Whole desk framed: lights on'),
    # 2. The lift from the same low 3/4: the foot rest lights first (lower third), then the desktop layer; the camera
    #    keeps easing back as it cranes up with the rise and drifts round toward the profile, so the whole desk
    #    (monitor top 2.9 u at full height) keeps clear headroom.
    orbit(LIFT[0], 36, 5.85, 0.78, 1.30, 0.50, 31.5, label='Lift starts: foot rest lights'),
    orbit(LIFT[0] + 3.8, 43, 6.40, 1.08, 1.52, 0.45, 32, label='Desktop layer: crane with the rise'),
    orbit(sum(LIFT), 51, 6.90, 1.42, 1.64, 0.35, 32, label='Full height, whole desk'),
    # 3. On round toward the profile at the board's height for the tilt, the whole desk in frame: the board steepens.
    orbit(TILT_DOWN[0], 59, 7.05, 1.95, 1.50, 0.25, 31, label='Board height: tilt down (purple)'),
    orbit(sum(TILT_DOWN), 66, 6.95, 1.85, 1.46, 0.15, 31, label='Tilted'),
    # 4. Down and out for the turn: the front swings to the lens and on to the far side while the camera arcs slowly
    #    the same way, landing on a true far-side 3/4; the tilt levels under it.
    orbit(TURN[0], 71, 6.80, 1.50, 1.62, 0.0, 32, label='Low wide: the turn starts'),
    orbit(TILT_BACK[0], 75, 6.70, 1.42, 1.62, 0.0, 32, label='Front to the lens, tilt levels'),
    orbit(sum(TURN), 79, 6.40, 1.28, 1.62, 0.10, 32, label='Far-side 3/4'),
    # 5. The lowering (red) on the 3/4, the camera sinking with the board.
    orbit(LOWER[0], 80, 6.10, 1.12, 1.52, 0.10, 33, label='3/4: red lowering'),
    orbit(sum(LOWER), 81, 5.85, 0.82, 1.30, 0.10, 33, label='Half height, drop low'),
    # 6. The lit roll toward the lens at wheel height (the camera gives a little ground), then the blue rise and a
    #    slow low arc and push to the hero 3/4 (easeOut false: still moving into the dissolve).
    orbit(ROLL_LIT[0], 81, 5.90, 0.62, 1.12, 0.10, 33, label='Low: lit roll toward the lens'),
    orbit(sum(ROLL_LIT), 79, 5.70, 0.62, 1.18, 0.15, 33.5, label='Roll lands'),
    orbit(LIFT_END[0], 78, 5.80, 0.66, 1.32, 0.15, 33.5, label='Rise to full height: blue'),
    orbit(sum(LIFT_END), 75, 6.65, 0.74, 1.62, 0.20, 34, label='Full height'),
    orbit(SECONDS, 73, 6.40, 0.64, 1.56, 0.25, 35, label='Clean low hero 3/4, push')]}

# Vico's own camera from Director Mode (director-bridge.py import), if any, replaces the authored keys.
DIRECTOR = os.path.join(H, 'director-camera.json')
if os.path.exists(DIRECTOR):
    dc = json.load(open(DIRECTOR))
    if float(dc.get('seconds', SECONDS)) + 1e-6 < SECONDS or max(k['at'] for k in dc['keys']) > SECONDS + 1e-6:
        print(f'awaken: ignoring {DIRECTOR}: made for {dc.get("seconds")} s, the chapter is {SECONDS} s', file=sys.stderr)
    else:
        CAMERA['keys'] = dc['keys']; print(f'awaken: camera keys from {DIRECTOR}')

# ---------------------------------------------------------------- look
# Dark stage until the switch-on, the status levels while the desk's lights play, the clean product look at the end.
# The stage key dips to 4 over the turn (its 22 on top of the amber caution light turned the desktop hot cream; at 4 it
# reads the visualizer's red-orange), then comes back for the settle and the hero bookend.
TURN_KEY = (TURN[0] - .5, TURN[0] + .7, sum(TILT_BACK), sum(TILT_BACK) + 1.0)   # the turn and the tilt back under it (review 1: 22 on the yellow-green read white)
RIG_KEY = [[0, 6], [ON[0], 6], [sum(ON), 22], [TURN_KEY[0], 22], [TURN_KEY[1], 4], [TURN_KEY[2], 4], [TURN_KEY[3], 22], [SETTLE[0], 22], [SETTLE[1], 40]]
RIG_POOL = [[0, 0], [ON[0], 0], [sum(ON), .1], [SETTLE[0], .1], [SETTLE[1], .3]]
RIMS = [[0, 120], [sum(ON), 120], [max(LIFT[0] - .4, sum(ON) + .8), 0], [SETTLE[0], 0], [SETTLE[1], 200]]   # out before the crane mirrors them in the top
ENV = [[0, .15], [ON[0], .15], [sum(ON), .35], [SETTLE[0], .35], [SETTLE[1], 1]]
WAKE = (sum(ON) + .1, LIFT[0] + .6)        # the stage light, pulse ring and overhead key dim before the lift (build-opener.py cue())


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

# The round's one-chapter preview cut (like previews/awaken-v4-wellness-cut.json: the same monitor clip as v4's).
pv = os.path.join(H, 'previews')
if os.path.isdir(pv):
    prev = os.path.join(pv, 'awaken-v4-wellness-cut.json'); ps = dict(shot)
    if os.path.exists(prev): ps['screens'] = json.load(open(prev))['shots'][0].get('screens', ps.get('screens'))
    json.dump({'name': f'awaken round 10 ({SECONDS:g} s, continuous camera)', 'shots': [ps]}, open(os.path.join(pv, 'awaken-v5-cut.json'), 'w'), indent=1)

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
cuts = [k['at'] for k in CAMERA['keys'] if k.get('cut') or k.get('hold')]
print(f'awaken: {SECONDS:g} s; {len(CAMERA["keys"])} story keys; camera peak {pk[1]:.2f} u/s at {pk[0]:.1f}, yaw <= {max(p[2] for p in prof):.1f} deg/s (cuts/holds: {cuts or "none"})')
for t0 in range(0, int(SECONDS) + 1, 3):
    w = [p for p in prof if t0 <= p[0] < t0 + 3]
    if w: print(f'  t {t0:4.1f}-{t0 + 3:4.1f}  speed {min(p[1] for p in w):.2f}-{max(p[1] for p in w):.2f} u/s  yaw <= {max(p[2] for p in w):4.1f} deg/s')
for k in CAMERA['keys']:
    th, c = desk(k['at'])
    az = math.degrees(math.atan2(k['position'][2] - c[1], k['position'][0] - c[0]))
    rel = (az - th + 180) % 360 - 180
    print(f'  key {k["at"]:5.2f}  camera az {az:6.1f}  desk-relative {rel:6.1f}  (0 front, +90 the HQ9 side, 180 back)  {k.get("label", "")}')
