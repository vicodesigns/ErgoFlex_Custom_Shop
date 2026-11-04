#!/usr/bin/env python3
"""Chapter 'hero' (the finale), v4 (round 7, HQ12): six desks, each with its own pose, its own move at the real
desk's speeds, and the time to be seen.

    flock /tmp/claude-1000/hq12-cut.lock python3 tools/experience/build-round7-finale.py exports/cinematic-intro-20261104-hq12

v3.1 (build-finale.py, HQ11) stays as it was and still reproduces HQ11. v4 keeps its architecture: sub-shots that
share ONE desk performance, ONE camera and ONE light rig, joined by join-subshots.py --transition fade, so the
desk never doubles in a blend. v4 changes the timing, the poses, the camera's clock and the office desk.

Vico's HQ11 notes (round 7):
  14 (A artist or B OCC; fragment) "...this one should be around 48 inches in height"   -> POSE (one line per look)
  15 C architect: "full sitting position, 28 inches ... negative 5 degrees in tilt ... give them more time"
  16 E office:    "barely gets any screen time ... a few more items on the desktop ... financial analyst ...
                   change the graphic on both monitors ... calculator, pen ..."
  17 "I like the last hero shots ... can be expanded ... We can increase the time as it needs to be ... not too rushed"

Design (/home/ergo/logs/ reviews of v3/v3.1 are the base; numbers printed by this script):
  - Every desk performs ITS OWN move under its own finish: the blend to look k is centred on the moment the desk
    starts moving into k's pose (0.3 s after the blend has finished), then k holds its pose at rest before the next
    blend. v3 blended mid-move; at real speeds the moves are 2-6 s, so they now belong to the desk that makes them.
  - Real speeds: tilt trapezoid paths cruising at TILT_V (<= 7 deg/s, motion-limits TILT_SPEEDS fast), lifts at
    LIFT_V (<= 4.94 in/s, studio.js LIFT_SPEEDS fast), soft-start/stop ramps (motion review N1). No montage tilts.
  - The height/tilt interlock (max tilt 39 deg at 28 in, rising linearly to 65 at 42.5 in) is asserted.
  - The camera is v3's approved orbit (one monotone path, 62 > -26 deg about the desk, framed for the tallest
    portrait monitor and for the end card) re-timed: camera(t) = v3(tau(t)). tau(t) is a smooth monotone clock
    solved so the pan rate is a calm ~PAN deg/s over A-E (v3 cruised 5.4 to fit 11 s) and then speeds up smoothly into
    the gaming hero, which plays v3's F at 1/F_RATE of its speed (titles, lift-down, end card all expand together).
  - Lights, grade and finishes: v3.1's rig (dark-top edit, rims 170 at el 45, kicker, key dip over the OCC board's
    steep tilt, now re-timed to the new tilt), exposures per finish.
  - E is a financial analyst: market/portfolio screens (tools/experience/screens/scenes/ch13.js, clips 13-fin-*)
    and an analyst's desktop (calculator, padfolio and pen, reading glasses, coffee mug). E holds flat
    (tilt <= the app's 9 deg auto-stow angle through its whole window), so nothing is stowed or pops.
Writes <dir>/shots/13.json, <dir>/shots/13-subshots.json, the 'hero' shot (seconds, subshots) in review-cut.json and
the hero entries' times in titles-src.json. Hold flock /tmp/claude-1000/hq12-cut.lock (another expert edits other chapters).
"""
import json, os, subprocess, sys, copy, math, tempfile
import numpy as np
d = sys.argv[1]
DRY = '--dry' in sys.argv          # print the plan, write nothing
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REL = os.path.relpath(os.path.abspath(d), root)

# ---------------- the looks: ONE line per desk (height in, tilt deg) ----------------
OPEN = (43.5, 65)            # ch 11 storage ends folded at 43.5 in / 65 deg: the match dissolve
POSE = {
    'A': (43.5, 65),         # artist, painter at the easel angle. Item 14 if it is A: (48, 65)
    'B': (48.0, 30),         # OCC student, standing, board at 30 deg (wordmark reads). Item 14 guess: 48 in
    'C': (28.0, -5),         # architect, full sitting, -5 deg (Vico, item 15)
    'D': (40.0, 8),          # HBHS, reading tilt (8: under the 9 deg auto-stow, so the office's items never stow)
    'E': (46.0, 0),          # office / financial analyst, standing, flat
    'F': (28.0, 0),          # gaming, sitting, ergonomic keyboard (owner: end here)
}
LOOKS = [('A', 'artist'), ('B', 'occ'), ('C', 'architect'), ('D', 'hbhs'), ('E', 'office'), ('F', 'gaming')]
REST = {'A': 2.0, 'B': 1.85, 'C': 2.85, 'D': 2.3, 'E': 4.15}   # s at rest in pose before the next blend
A_START, A_MIN_SEAM = 1.5, 5.0      # A's own move (if its pose differs from OPEN) starts after the 1.5 s ch 11 dissolve
BLEND, MOVE_DELAY = 0.6, 0.3        # 0.6 s fade centred on the seam; the move starts as the blend ends
TILT_V, TILT_RAMP = 6.8, 0.5        # deg/s cruise (product fast 7), s ramps
LIFT_V, LIFT_RAMP = 4.5, 0.5        # in/s cruise (product fast 4.94), s ramps
F_RATE = 0.85                       # F plays v3's hero section at 0.85x (expanded by 1/0.85)
PAN = 1.7                           # deg/s view pan over A-E (v3: 5.4)

DARK = {'gaming', 'hbhs'}
DARK_TOP = {'clearcoat': 0, 'specularIntensity': 0.05}
EXPOSURE = {'gaming': .95, 'hbhs': .95, 'office': .85, 'occ': .85, 'architect': .70, 'artist': .65}
SCR = 'exports/cinematic-intro-20261030/screens/'
MAIN = REL + '/screens/13-main.mp4'          # ch12 scene (home > brand loop) rendered for the whole new chapter
FIN_P, FIN_W = REL + '/screens/13-fin-portrait.mp4', REL + '/screens/13-fin-wide.mp4'

# E's desktop: library props on the office desk (desk-local mm: +z = front edge, -x = the user's left; rotation deg)
ANALYST = [   # checked from above and from the front (pass 1-3 stills): clear of the portrait-monitor stand and the cutout.
              # A printed report ('papers') was tried on both wings: white on the white top, and the right wing has no room
              # beside the mouse pad and calculator without hanging over the curved edge. The padfolio carries the notes.
    {'id': 'tablet-folder', 'x': -500, 'z': 300, 'rotation': 6},          # leather padfolio, left wing
    {'id': 'pen', 'x': -470, 'y': 13.2, 'z': 300, 'rotation': 35},        # lying on the padfolio (13.2 mm thick)
    {'id': 'glasses-3', 'x': -330, 'z': 215, 'rotation': 20},             # reading glasses, by the keyboard cutout
    {'id': 'calculator', 'x': 390, 'z': 165, 'rotation': -12},            # behind the mouse pad, right wing
    {'id': 'insulated-mug', 'x': 610, 'z': 50, 'rotation': 0},            # coffee, right rear corner
]

# ---------------- motion ----------------
def trapezoid(total, dur, ramp):
    v = total / (dur - ramp); a = v / ramp
    def f(t):
        if t <= 0: return 0.0
        if t < ramp: return 0.5 * a * t * t
        if t <= dur - ramp: return 0.5 * a * ramp * ramp + v * (t - ramp)
        if t < dur: return total - 0.5 * a * (dur - t) ** 2
        return float(total)
    return f, v

def move_time(dist, v, ramp):
    return 0.0 if abs(dist) < 1e-6 else math.ceil((abs(dist) / v + ramp) * 20) / 20

def axis_clip(cid, lane, start, a, b, v, ramp, dur=None):
    dur = dur or move_time(b - a, v, ramp); f, cruise = trapezoid(abs(b - a), dur, ramp); s = 1 if b >= a else -1
    field = 'height' if lane == 'lift' else 'tilt'; n = max(2, round(dur / 0.1))
    path = [{'time': round(k / n, 6), 'pose': {field: round(a + s * f(dur * k / n), 4)}} for k in range(n + 1)]
    return {'id': cid, 'lane': lane, 'kind': lane, 'start': round(start, 3), 'duration': dur, 'easing': 'linear',
            'label': '', 'target': b, 'path': path}, cruise

clips, seams, moves, prev, t = [], {}, {}, OPEN, A_START
for k, (n, _) in enumerate(LOOKS[:-1]):
    h, a = POSE[n]
    ml, mt = move_time(h - prev[0], LIFT_V, LIFT_RAMP), move_time(a - prev[1], TILT_V, TILT_RAMP)
    start = t if n == 'A' else t + MOVE_DELAY
    if ml: c, v = axis_clip(f'{n.lower()}-lift', 'lift', start, prev[0], h, LIFT_V, LIFT_RAMP); clips.append(c); assert v <= 4.94
    if mt: c, v = axis_clip(f'{n.lower()}-tilt', 'tilt', start, prev[1], a, TILT_V, TILT_RAMP); clips.append(c); assert v <= 7
    moves[n] = (start, start + max(ml, mt))
    nxt = start + max(ml, mt) + REST[n]
    if n == 'A': nxt = max(nxt, A_MIN_SEAM)
    seams[LOOKS[k + 1][0]] = t = round(nxt, 2)
    prev = (h, a)
T_F = seams['F']

# ---------------- camera: v3's orbit on a new clock ----------------
V3_KEYS = [  # build-finale.py v3/v3.1 story keys (23 s chapter), unchanged
    (0.0, [4.500, 2.050, 8.300], [-1.276, 1.200, 0.744], 26), (2.8, [5.150, 2.450, 6.852], [-0.646, 1.202, 0.562], 27),
    (4.9, [5.468, 2.800, 5.259], [-0.417, 1.139, 0.546], 28), (7.0, [6.440, 2.900, 4.039], [-0.261, 1.317, 0.597], 28),
    (9.0, [7.043, 2.850, 2.751], [-0.146, 1.346, 0.670], 28), (11.1, [7.324, 2.800, 1.692], [-0.134, 1.342, 1.080], 28),
    (13.6, [7.620, 2.550, 0.014], [0.118, 1.128, 1.114], 28), (16.2, [8.179, 2.250, -1.515], [0.318, 0.881, 1.055], 28),
    (19.4, [8.316, 2.100, -3.596], [0.158, 0.518, 0.086], 27), (23.0, [8.395, 2.050, -4.021], [0.157, 0.500, 0.076], 27)]
def spline(shot):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as fh: json.dump(shot, fh); tmp = fh.name
    subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), tmp], check=True, stdout=subprocess.DEVNULL)
    out = json.load(open(tmp)); os.remove(tmp); return out
v3 = spline({'seconds': 23, 'cameraPlan': {'easeIn': False, 'easeOut': True,
             'keys': [dict(at=a, position=p, target=q, fov=f) for a, p, q, f in V3_KEYS]}})['camera']['keys']
vt = np.array([k['time'] * 23 for k in v3]); vv = np.array([k['view']['position'] + k['view']['target'] + [k['view']['fov']] for k in v3])
view = lambda tau: np.array([np.interp(tau, vt, vv[:, i]) for i in range(7)])
def pan_at(tau, h=0.05):
    a, b = view(tau), view(min(23, tau + h)); da, db = a[3:6] - a[:3], b[3:6] - b[:3]
    c = da @ db / np.linalg.norm(da) / np.linalg.norm(db); return math.degrees(math.acos(min(1, c))) / h
DT = 0.01
def clock(pan):
    """tau(t): over A-E the view pans at pan * shape(t); from T_F-6 it blends smoothly to F_RATE x v3 and holds that."""
    ss = lambda x: 0 if x <= 0 else 1 if x >= 1 else x * x * (3 - 2 * x)
    taus, tau, tt = [0.0], 0.0, 0.0
    while tau < 23 - 1e-9:
        shape = 0.65 + 0.35 * ss(tt / 6)                         # eases up out of the ch 11 dissolve
        r_ae = pan * shape / max(0.3, pan_at(tau))
        w = ss((tt - (T_F - 6)) / 8)                            # 6 s before F to 2 s after: blend to F's clock
        tau = min(23, tau + DT * ((1 - w) * r_ae + w * F_RATE)); tt += DT; taus.append(tau)
    return np.array(taus)
lo, hi = 0.3, 6.0                                               # solve PAN scale so tau(T_F) = 11.1 (v3's F seam)
for _ in range(40):
    mid = (lo + hi) / 2; tau = clock(mid)
    if np.interp(T_F, np.arange(len(tau)) * DT, tau) < 11.1: lo = mid
    else: hi = mid
pan_scale = mid; tau = clock(pan_scale); tgrid = np.arange(len(tau)) * DT
SECONDS = math.ceil(tgrid[-1] * 2) / 2
t_of = lambda x: float(np.interp(x, tau, tgrid))               # chapter time at which v3's tau is reached
tau_of = lambda x: float(np.interp(x, tgrid, tau))
keys = []
for at in list(np.arange(0, SECONDS, 1.0)) + [SECONDS]:
    v = view(tau_of(min(at, tgrid[-1]))); keys.append(dict(at=round(float(at), 3), position=[round(x, 4) for x in v[:3]],
                                                            target=[round(x, 4) for x in v[3:6]], fov=round(float(v[6]), 3)))
camera = {'easeIn': False, 'easeOut': True, 'keys': keys}

# F: v3's gaming section on F's clock: lift-down 46 > 28 (v3 11.5-17.0), titles, end card
f0, f1 = round(t_of(11.5), 2), round(t_of(17.0), 2)
c, v_f = axis_clip('f-lift', 'lift', f0, POSE['E'][0], POSE['F'][0], LIFT_V, 0.8, dur=round(f1 - f0, 2)); clips.append(c)
assert v_f <= 4.94, v_f
moves['F'] = (f0, f1)
TITLES = {'title_in': t_of(11.7), 'title_out': t_of(16.2), 'logo': t_of(17.7), 'cta': t_of(18.9)}

# ---------------- checks: interlock, limits ----------------
sys.path.insert(0, root)
def sample(motion, s):
    p = {'height': motion['initial']['height'], 'tilt': motion['initial']['tilt']}
    for lane, field in (('lift', 'height'), ('tilt', 'tilt')):
        for c in sorted([c for c in motion['clips'] if c['lane'] == lane], key=lambda c: c['start']):
            if s < c['start']: break
            u = min(1, (s - c['start']) / c['duration']); ts = [k['time'] for k in c['path']]; vs = [k['pose'][field] for k in c['path']]
            p[field] = float(np.interp(u, ts, vs))
            if u < 1: break
    return p
motion = {'version': 2, 'initial': {'height': OPEN[0], 'tilt': OPEN[1], 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips}
maxtilt = lambda h: 39 + max(0, min(1, (h - 28) / 14.5)) * 26
for s in np.arange(0, SECONDS, 0.02):
    p = sample(motion, s); assert p['tilt'] <= maxtilt(p['height']) + 1e-6, ('interlock', s, p)
    q = sample(motion, s + 0.02)
    assert abs(q['height'] - p['height']) / 0.02 <= 4.94 + 1e-3 and abs(q['tilt'] - p['tilt']) / 0.02 <= 7 + 1e-3, ('speed', s)
for n, _ in LOOKS:   # every look reaches its pose
    end = moves.get(n, (0, 0))[1] + 0.01; p = sample(motion, end)
    assert abs(p['height'] - POSE[n][0]) < .01 and abs(p['tilt'] - POSE[n][1]) < .01, (n, p)
E_win = (seams['E'] - BLEND / 2, seams['F'] + BLEND / 2)
assert all(sample(motion, s)['tilt'] <= 9 for s in np.arange(*E_win, 0.05)), 'office would auto-stow its desk items'

# ---------------- light ----------------
def tilt_time(target):   # when B's tilt (65 > 30) passes `target`
    c = next(c for c in clips if c['id'] == 'b-tilt'); u = np.interp(-target, [-k['pose']['tilt'] for k in c['path']], [k['time'] for k in c['path']])
    return round(float(c["start"] + u * c["duration"]), 2)
# v3.1: the key dipped 30 > 12 while the OCC board passed ~64 > 44 deg and was back to 30 by 35 deg (its mirror veiled the board)
# v4: at 65 deg the OCC board mirrors the key straight into this lens (pass-2 probe: the hot spot goes only with the key off;
# 12 is not enough). So the key is nearly out (4) from just before the A > B blend until the board passes 56 deg, 12 to 44 deg,
# 10 while the board rests at 30 (a broad sheen at 30 even at 18), and back to 30 as C starts down. Shared by every sub-shot (seams match).
KEY = [[0, 30], [round(seams['B'] - 1.0, 2), 30], [round(seams['B'] - 0.45, 2), 4], [tilt_time(56), 4], [tilt_time(44), 12],
       [tilt_time(35), 10], [round(seams['C'] + 0.5, 2), 10], [round(seams['C'] + 2.2, 2), 30]]
KICKER_F = [[0, 18], [round(t_of(12), 2), 18], [round(t_of(16.5), 2), 30]]
def rig(kicker=18):
    rim = 170
    return [{'preset': 'productRig', 'key': {'at': {'az': 35, 'el': 22, 'dist': 3.4}, 'width': 2.6, 'height': 1.3, 'intensity': KEY},
             'rimLeft': {'at': {'az': 135, 'el': 45, 'dist': 3.6}, 'intensity': rim}, 'rimRight': {'at': {'az': -135, 'el': 45, 'dist': 3.6}, 'intensity': rim},
             'pool': {'strength': 0.18}, 'contact': {'opacity': 0.8}},
            {'type': 'rect', 'name': 'kicker', 'at': {'az': 180, 'el': 25, 'dist': 3.2}, 'width': 0.5, 'height': 2.0, 'color': '#eef1ff', 'intensity': kicker},
            {'type': 'rect', 'name': 'frontLow', 'at': {'az': -45, 'el': 8, 'dist': 4.0}, 'width': 1.2, 'height': 0.6, 'color': '#fff0e0', 'intensity': 6}]

# ---------------- windows ----------------
win = {}
for k, (n, _) in enumerate(LOOKS):
    a = 0.0 if n == 'A' else seams[n] - BLEND / 2
    b = SECONDS if n == 'F' else seams[LOOKS[k + 1][0]] + BLEND / 2
    win[n] = (round(a, 2), round(b, 2))

# ---------------- shots ----------------
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i13 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'hero')
shot = copy.deepcopy(cut['shots'][i13])
for k in ('subshots', 'presets', 'renderRange', 'subshot', 'accessories'): shot.pop(k, None)
wheels = [e for e in shot['sceneEdits'] if str(e.get('match', '')).startswith('^Wheel')]
g0, g1 = round(t_of(11.5), 2), round(t_of(16), 2)
shot.update(seconds=SECONDS, cameraPlan=camera, kind='hero', motion=motion,
            sceneEdits=wheels + [{'match': '@grid', 'opacity': [[0, 0.35], [g0, 0.25], [g1, 0]], 'radialFade': [3, 8]},
                                 {'match': '@pulse', 'opacity': [[0, 1], [g0, 0.6], [g1, 0]]},
                                 {'lightType': 'DirectionalLight', 'intensity': 0.45}, {'lightType': 'HemisphereLight', 'intensity': 0.5},
                                 {'match': '@stageLight', 'intensity': 0.5}],
            ledGlow=0.2, ledSurfaces={'desktopStrength': 35, 'shelfStrength': 70, 'baseStrength': 30, 'topStrength': 80,
                                      'floorStrength': 150, 'floorReach': 60, 'floorWidth': 80})
shot = spline(shot)
subs = []
for n, p in LOOKS:
    x = dict(copy.deepcopy(shot), preset=p, renderRange=list(win[n]), subshot=n,
             lights=rig(KICKER_F if n == 'F' else 18), sceneGlobals={'environmentScale': 0.4, 'exposure': EXPOSURE[p]})
    x['screens'] = [{'target': 'main-landscape', 'src': MAIN}]
    if p == 'hbhs':   # the class quiz: play the same 2.7 s of the 12 s clip v3 showed (6.66-9.33), slowed to fit the window
        span = win[n][1] - win[n][0]; rate = min(1, 10.5 / span)
        x['screens'].append({'target': 'main-portrait', 'src': SCR + '06-portrait.mp4', 'rate': round(rate, 4), 'offset': round(1.0 - win[n][0] * rate, 3)})
    if p == 'office':  # financial analyst: both monitors; clip time 0 = the start of E's window
        x['screens'] = [{'target': 'main-landscape', 'src': FIN_W, 'offset': -win[n][0]}, {'target': 'main-portrait', 'src': FIN_P, 'offset': -win[n][0]}]
        x['accessories'] = {'add': copy.deepcopy(ANALYST)}
    if p in DARK: x['sceneEdits'] = x['sceneEdits'] + [{'match': r'^(Desktop|Top_Shelf)(_\d+)?$', 'material': DARK_TOP}]
    if p == 'gaming' and n == 'F': x['kind'] = 'glide'          # the stage swaps the mechanical keyboard for the ergonomic one
    if p == 'architect': x.pop('screens', None)                  # the drafting build has no monitor
    if p in ('artist', 'architect'):
        x['sceneEdits'] = x['sceneEdits'] + [{'match': 'shelf-organizer|^Organizer ', 'hide': True}, {'match': '^Accessory:shelf-organizer$', 'position': [0, -20, 0]}]
    subs.append(x)
if not DRY:
  json.dump({'name': 'HQ12 finale sub-shots (v4)', 'shots': subs}, open(os.path.join(d, 'shots', '13-subshots.json'), 'w'))
main = copy.deepcopy(subs[-1]); main.pop('renderRange'); main.pop('subshot')
main['subshots'] = {n: list(win[n]) for n, _ in LOOKS}; main['presets'] = [p for _, p in LOOKS]
if not DRY:
    json.dump(main, open(os.path.join(d, 'shots', '13.json'), 'w'), indent=1)
    cut = json.load(open(os.path.join(d, 'review-cut.json')))   # re-read: other chapters may have changed meanwhile
    cut['shots'][i13] = main
    json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
    tf = os.path.join(d, 'titles-src.json'); ts = json.load(open(tf))
    for x in ts['titles']:
        if x['chapter'] == 'hero': x['rel_in'], x['rel_out'] = round(TITLES['title_in'], 2), round(TITLES['title_out'], 2)
    ts['logo']['rel_in'] = round(TITLES['logo'], 2); ts['cta']['rel_in'] = round(TITLES['cta'], 2)
    json.dump(ts, open(tf, 'w'), indent=1)

# ---------------- report ----------------
print(f'finale v4: {SECONDS} s (v3.1 23 s); A-E view pan {pan_scale:.2f} deg/s; F at {F_RATE}x v3' + (' [dry run]' if DRY else ''))
for n, p in LOOKS:
    mv = moves.get(n); print(f'  {n} {p:9s} window {win[n][0]:6.2f}-{win[n][1]:6.2f} ({win[n][1] - win[n][0]:4.1f} s)  pose {POSE[n][0]} in / {POSE[n][1]} deg'
                             + (f'  move {mv[0]:.2f}-{mv[1]:.2f}' if mv and mv[1] > mv[0] else ''))
print('  clips:', ', '.join(f"{c['id']} {c['start']}+{c['duration']}" for c in clips))
print('  titles (chapter s):', {k: round(v, 2) for k, v in TITLES.items()}, ' key', KEY, ' kicker', KICKER_F)
