#!/usr/bin/env python3
"""Chapter 1 ('awaken'), round 6 (HQ11): the opening hero with the status lights folded in.

    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-opener.py exports/cinematic-intro-20261103-hq11

Writes <dir>/shots/01.json, replaces the 'awaken' shot in <dir>/review-cut.json, bakes the camera with
camera-spline.mjs, sets the 'awaken' grade bloom, and writes <dir>/post/opener-screen.png (a static
wordmark for the monitor) if it is missing. It does NOT touch the titles (round 6: build-round6-copy.py
owns the copy and card timing), the status chapter or the EDL. Safe to re-run: every value is absolute.

Round 6 (/home/ergo/logs/final_review_lighting_2026-11-04.md MUST 2, SHOULD 8; content trim): the black
tops read white on the dark stage, so the Desktop/Top_Shelf sheen is tamed (envMapIntensity .35, clearcoat
.25 / roughness .55), the overhead studio DirectionalLights (key 1.5) drop to 0.45, the env to .35 and the
rear rims (the mirrored hotspot, measured) to 0 for the light sequence; foot-LED base 170 for more floor spill; the static hold after the roll is trimmed,
41.0 -> 39.5 s, with the last two camera keys retimed so the push still moves at the end.

Vico (round 5, /home/ergo/logs/video_round5_brief_2026-11-03.md items 3, 4, 6, 7): the 360 was too fast
and jerky; fold the status lights (lift, tilt, turn, roll) into the opener; one continuous camera, no
fades; the "Safe for everyone around it." card takes the digital-twin slot. Gaming preset, black/red.
Light rule (real desk): lift up blue, lift down red, tilt steepening purple ('tilt-retract'), back toward
flat yellow-green ('tilt-extend'), rolling red; right turn wheels mode 6, left 5, forward 3.

Story: the desk sleeps in the clean studio look (wheel macro, crane to a silhouette, first title), then
wakes: the studio key dims as its own lights take over, it rises (blue, 3/4 from above with the floor
pool), steepens and levels its board in profile (purple, then yellow-green), turns right to face the
camera (mode 6), glides toward it (mode 3, red), and settles into the clean hero for the dissolve.
Review and numbers: /home/ergo/logs/cinematography_opener_round5_2026-11-03.md.
Lighting values for the light show: build-safety-chapter.py / lighting_review_round4 section 3.
"""
import json, math, os, subprocess, sys

d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 39.5

# ---------------------------------------------------------------- desk performance (chapter seconds)
LIFT = (11.0, 5.6)        # 28 -> 46 in, 3.2 in/s average (the real speed)
TILT_UP = (17.4, 3.6)     # 0 -> 15 deg, board steepening: purple
TILT_BACK = (21.8, 3.6)   # 15 -> 0 deg, back toward flat: yellow-green
TURN = (26.0, 5.0)        # 90 deg right (mode 6), 18 deg/s average, 27 peak
ROLL = (31.0, 3.4)        # 18 in forward (mode 3), toward the camera, 5.3 in/s average
TILT_DEG, TURN_DEG, ROLL_IN, LIFT_TO = 15, 90, 18, 46

def clip(id, lane, kind, start, dur, easing='smooth', label='', **kw):
    c = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; c.update(kw); return c

clips = [clip('op-lift', 'lift', 'lift', *LIFT, label='Lift up', target=LIFT_TO),
         clip('op-tilt-up', 'tilt', 'tilt', *TILT_UP, label='Tilt up', target=TILT_DEG),
         clip('op-tilt-back', 'tilt', 'tilt', *TILT_BACK, label='Tilt level', target=0),
         clip('op-turn', 'wheels', 'rotate', *TURN, label='Turn right', value=TURN_DEG, direction='right'),
         clip('op-roll', 'wheels', 'travel', *ROLL, label='Roll forward', value=ROLL_IN, direction='forward')]
status = [{'at': LIFT[0], 'dur': LIFT[1], 'kind': 'lift-up'},
          {'at': TILT_UP[0], 'dur': TILT_UP[1], 'kind': 'tilt-retract'},
          {'at': TILT_BACK[0], 'dur': TILT_BACK[1], 'kind': 'tilt-extend'},
          {'at': TURN[0], 'dur': TURN[1], 'kind': 'wheels', 'mode': 6},
          {'at': ROLL[0], 'dur': ROLL[1], 'kind': 'wheels', 'mode': 3}]

# ---------------------------------------------------------------- camera
# Desk box centre at rest (x, z). The turn pivots about (-0.10, 0) (from the monitor's position before and
# after the turn, render-cut --list-at), so the centre ends at (-0.10, -0.24); the 18 in roll (0.69 u) along
# the new front (-z) takes it to (-0.10, -0.93).
C0, C_TURNED, C_ROLLED = (0.14, 0.0), (-0.10, -0.24), (-0.10, -0.93)

def orbit(at, az, dist, cam_y, aim_y, shift, fov, centre=C0, label=None, hold=None):
    """A key placed around the desk: az (deg) from +x (desk front at rest) toward +z, horizontal distance,
    camera and aim heights, and shift (scene units) of the aim along screen-left, so +shift puts the desk
    right of frame centre (the title side stays clear)."""
    a = math.radians(az)
    px, pz = centre[0] + dist * math.cos(a), centre[1] + dist * math.sin(a)
    vx, vz = centre[0] - px, centre[1] - pz; n = math.hypot(vx, vz); vx, vz = vx / n, vz / n
    rx, rz = -vz, vx                      # screen-right on the floor plane (view x up)
    tx, tz = centre[0] - rx * shift, centre[1] - rz * shift
    k = {'at': at, 'position': [round(px, 3), round(cam_y, 3), round(pz, 3)], 'target': [round(tx, 3), round(aim_y, 3), round(tz, 3)], 'fov': fov}
    if label: k['label'] = label
    if hold: k['hold'] = hold
    return k

def key(at, pos, tgt, fov, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k

camera = {'easeIn': True, 'easeOut': False, 'keys': [
    key(0.0, [1.15, 0.10, -1.80], [0.12, 0.14, -0.97], 24, 'Wheel macro, desk asleep'),
    key(2.4, [1.70, 0.14, -1.85], [0.16, 0.16, -0.92], 24, 'Truck along the wheels'),
    key(5.0, [3.40, 0.38, -2.60], [0.20, 0.40, -0.70], 26, 'Pull back low: the base'),
    orbit(8.2, -27, 6.00, 1.45, 1.15, 0.52, 29, label='Silhouette, first title'),
    orbit(11.0, -31, 6.25, 3.30, 1.05, 0.85, 33, label='Rising as the desk wakes'),
    orbit(13.4, -38, 6.35, 4.45, 1.00, 1.05, 35, label='3/4 from above: blue lift, floor pool'),
    orbit(16.4, -50, 6.50, 4.35, 1.15, 1.00, 35, label='Lift lands'),
    orbit(19.4, -64, 6.80, 2.80, 1.30, 0.60, 34, label='Descending to the profile: purple'),
    orbit(23.4, -76, 6.35, 2.20, 1.25, 0.25, 34, label='Profile: yellow-green'),
    orbit(26.0, -80, 6.32, 2.15, 1.25, 0.22, 34, label='Turn begins'),
    orbit(31.0, -108, 6.30, 2.30, 1.25, 0.15, 34, centre=C_TURNED, label='Turned toward us; glide begins'),
    orbit(34.4, -120, 6.15, 2.45, 1.23, 0.12, 34, centre=C_ROLLED, label='Glide ends, front 3/4'),
    # Round 6 trim (41.0 -> 39.5): the same two poses, 0.9 s and 1.5 s earlier, so the push keeps moving
    # (about 0.25 -> 0.2 u/s) to the last frame instead of the old static-reading hold.
    orbit(36.8, -125, 5.85, 2.55, 1.30, 0.10, 33, centre=C_ROLLED),
    orbit(39.5, -130, 5.75, 2.65, 1.33, 0.08, 32, centre=C_ROLLED, label='Clean hero 3/4, slow push')]}

# ---------------------------------------------------------------- look
# Act 1 keeps the HQ9 opener's clean studio look (productRig at scale 1, env 1, stage light and pulse
# at 1). As the desk wakes (9.6-11.6) the studio settles to the safety chapter's values that let the
# status colours read (key 22, pool .1, env .6, stage light .35, pulse .4), and returns
# to the clean look for the final hero once the last light has faded (35.2-38.0): a bookend.
WAKE, SETTLE = (9.6, 11.6), (35.2, 38.0)
def cue(a, b):
    return [[0, a], [WAKE[0], a], [WAKE[1], b], [SETTLE[0], b], [SETTLE[1], a]]
RIMS = [[0, 200], [WAKE[0], 200], [10.6, 0], [SETTLE[0], 0], [SETTLE[1], 200]]   # productRig rim default 200

# Shared with build-awareness-chapter.py (lighting final review MUST 2a). Anchored: the review's '^(Desktop|Top_Shelf)'
# also hits 'Desktop LEDs*' (the strips and the red IC dots) and 'Desktop LED size fit' (render-cut --list-objects);
# this one hits only the wood: Desktop, Desktop_1-3, Top_Shelf, Top_Shelf_1-4 (their LED spill children are shader
# materials, which the edit leaves alone).
DESKTOP_SHEEN = {'match': '^(Desktop|Top_Shelf)(_\\d+)?$', 'material': {'envMapIntensity': 0.35, 'clearcoat': 0.25, 'clearcoatRoughness': 0.55}}

screen_png = os.path.join(d, 'post', 'opener-screen.png')
if not os.path.exists(screen_png):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'gradients=s=2560x1072:c0=0x0b1322:c1=0x05080f:x0=1280:y0=300:x1=1280:y1=1072:n=2,format=rgb24',
                    '-i', os.path.join(d, 'post', 'logo-white.png'), '-filter_complex',
                    '[1:v]scale=1000:-1,format=rgba,colorchannelmixer=aa=0.92[l];[0:v][l]overlay=(W-w)/2:(H-h)/2-20',
                    '-frames:v', '1', screen_png], check=True)

shot = {'id': 'awaken', 'room': 'product', 'kind': 'glide', 'seconds': SECONDS,
        'title': 'Level up your every day.', 'detail': 'Better health. Clearer focus. More joy in your work.',
        'preset': 'gaming', 'transition': 0.35, 'size': '60x30',
        'motion': {'version': 2, 'initial': {'height': 28, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
        'cameraPlan': camera, 'ledStatus': status,
        # Dim neutral standby: the strips read as off in the clean look, and blue / purple / red / yellow
        # don't fade through the stage cyan.
        'ledGlow': 1, 'ledColor': '#2b2b2b',
        # Floor spill (lighting SHOULD 8 asked floor 260 / reach 140 / width 150): the app clamps strengths at 200
        # and reach / width at 100 (studio.js setLedSurface), so the floor is already at its maximum; only the
        # base (foot shelf) strength goes up, 120 -> 170. The darker desktop does the rest.
        'ledSurfaces': {'desktopStrength': 140, 'desktopReach': 100, 'desktopWidth': 30, 'shelfStrength': 176, 'topStrength': 143,
                        'baseStrength': 170, 'floorStrength': 200, 'floorReach': 100, 'floorWidth': 100, 'floorSharpness': 10,
                        'leftWingStrength': 150, 'rightWingStrength': 150},
        # Round 6: the rear rims (az +-135, el 28, 200) mirror in the flat top as the camera cranes over it; rimRight
        # alone took the top from Y 36 to 126 at 13.5 even with the sheen edit, and 15 of 200 still left a hotspot.
        # They go out while the desk's own lights play (down by 10.6, before the lift at 11.0) and back with the clean look.
        'lights': [{'preset': 'productRig', 'key': {'intensity': cue(40, 22)}, 'pool': {'strength': cue(0.3, 0.1)},
                    'rimLeft': {'intensity': RIMS}, 'rimRight': {'intensity': RIMS}}],
        'sceneEdits': [
            {'match': '^Wheel_[FR]_[LR]', 'materialColor': '#a38c8c',
             'material': {'color': '#2a2a2e', 'roughness': 0.45, 'metalness': 0, 'clearcoat': 0.3, 'clearcoatRoughness': 0.25}},
            {'match': '^Wheel_[FR]_[LR]', 'materialColor': '#2a2a2a', 'materialType': 'Physical', 'material': {'metalness': 1, 'roughness': 0.3}},
            {'match': '@grid', 'opacity': 0.35, 'radialFade': [3, 8]},
            {'match': '@stageLight', 'intensity': cue(1, 0.35)},
            {'match': '@pulse', 'opacity': cue(1, 0.4)},
            # Black Birch tops: the glossy clearcoat mirrored the rims and env and read near-white (Y 196 at 13.5).
            DESKTOP_SHEEN,
            # The app's overhead studio DirectionalLights (key 1.5) as a multiplier: 0.3 puts the key at 0.45
            # through the light sequence, back to the clean look with the rig.
            {'lightType': 'DirectionalLight', 'intensity': cue(1, 0.3)}],
        'sceneGlobals': {'environmentScale': cue(1, 0.35)},
        'screens': [{'target': 'main-landscape', 'src': os.path.relpath(screen_png, root)}]}

f = os.path.join(d, 'shots', '01.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
shot = json.load(open(f))
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i0 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'awaken')
cut['shots'][i0] = shot
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))

# Titles: not written here any more (round 6). The awaken cards (3.6-9.2 ERGOFLEX, 12.4-18.8 SAFETY) are
# in titles-src.json, and build-round6-copy.py owns their text.

gp = os.path.join(d, 'grade.json'); grade = json.load(open(gp))
grade['awaken'] = {'gamma': 1.08, 'bloom': 0.06}   # bloom .1 -> .06: comets stay comets (lighting review r4 s3)
json.dump(grade, open(gp, 'w'), indent=1)

# ---------------------------------------------------------------- speed report from the baked keys
ks = shot['camera']['keys']
def v(k, f): return k['view'][f]
peak, prof = (0, 0), []
for a, b in zip(ks, ks[1:]):
    dt = (b['time'] - a['time']) * SECONDS
    if dt <= 1e-6: continue
    sp = math.dist(v(a, 'position'), v(b, 'position')) / dt
    ya = math.atan2(v(a, 'target')[2] - v(a, 'position')[2], v(a, 'target')[0] - v(a, 'position')[0])
    yb = math.atan2(v(b, 'target')[2] - v(b, 'position')[2], v(b, 'target')[0] - v(b, 'position')[0])
    yr = abs(math.degrees((yb - ya + math.pi) % (2 * math.pi) - math.pi)) / dt
    t = (a['time'] + b['time']) / 2 * SECONDS
    prof.append((t, sp, yr))
    if sp > peak[1]: peak = (t, sp)
print(f'awaken: {SECONDS:g} s (was 41). lift {LIFT[0]}-{sum(LIFT):.1f}, tilt up {TILT_UP[0]}-{sum(TILT_UP):.1f}, '
      f'tilt back {TILT_BACK[0]}-{sum(TILT_BACK):.1f}, right turn {TURN[0]}-{sum(TURN):.1f}, roll {ROLL[0]}-{sum(ROLL):.1f}')
print(f'camera peak {peak[1]:.2f} u/s at t {peak[0]:.1f}; max yaw rate {max(p[2] for p in prof):.1f} deg/s')
for t0 in range(0, int(SECONDS) + 1, 2):
    w = [p for p in prof if t0 <= p[0] < t0 + 2]
    if w: print(f'  t {t0:4.1f}-{t0 + 2:4.1f}  speed {min(p[1] for p in w):.2f}-{max(p[1] for p in w):.2f} u/s  yaw <= {max(p[2] for p in w):4.1f} deg/s')
