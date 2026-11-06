#!/usr/bin/env python3
"""Round 10, chapters 3 (create, artist room, 18 s) and 4 (commons, Humboldt commons, 14 s): Vico's notes (2026-11-04).

    flock /tmp/claude-1000/hq14-cut.lock python3 tools/experience/build-round8-create-commons.py exports/cinematic-intro-20261104-hq14

Edits review-cut.json and shots/03.json / shots/04.json in place. Owns only: create's motion, ledStatus, cameraPlan
(+ the baked camera), its palette sceneEdits and the painted palette accessory; commons' cameraPlan (+ camera).
Every other field (LED look, lights, screens, other sceneEdits) is left to its owner (build-round8-leds.py ...).
Values are absolute, so re-running is safe.
With <hq>/director-camera-<create|commons>.json (Director Mode) that chapter's camera is left to
build-round8-director.py (run last; it may change the length too); create's authored motion + ledStatus are still
set here and that pass re-times them from Vico's clips.

Chapter 3, create ("the second time it tilts down it should also raise up to about 50 in, because it comes down and
clips the little stool with the painter's palette; the palette is all white"):
- The desk lifts 43.5 -> 52 in before the second tilt, then tilts 25 -> 45 deg at that height, so the board's low
  front edge (the keyboard tray under it) stays above the stool and its palette for the whole tilt. At 50 in the
  tray's corner passes ~1.4 in over the seat's back edge (reads as touching from the film camera); 52 in (still
  under the 52.5 in full height) leaves ~3.5 in of visible daylight. Lift then tilt, one status light at a time:
  drafting tilt (purple) 1.4-4.4, lift (blue) 5.9-8.5 at 3.27 in/s, tilt (purple) 10.0-14.3 at 4.65 deg/s; 1.5 s
  between moves (each colour's 1 s fade to the regular look, then 0.5 s settled). Tilt stays < 50 deg (drafting
  design: the app's auto-stow swaps props at >= 50 deg).
- The stool's palette (the stool GLB's Mesh_2: one untextured white oval, no paint wells to colour) is hidden and
  the Atelier painted palette prop (oak, six oil pigments and a knife) sits on the seat in its place.
- Camera: the same overhead opening on the drafting tilt, a front-left 3/4 descent that watches the lift, a side
  profile that rests through the first half of the tilt (the clearance over the stool reads best from the side),
  then HQ14's front 3/4 portrait. The monitor clip (exports/cinematic-intro-20261102/screens/03-landscape.mp4)
  still shows the old motion's readouts.

Chapter 4, commons ("the camera work got worse ... at the very last shot a chair gets in the way"):
- The cameraPlan is HQ11's (unchanged since), but over its last ~0.6 s the camera drifts to [5.9, 2.5, -7.1],
  through the mobile campus board 'Prop:campus-board-compact-nordic' (oak frame, green felt panel at world
  x 5.59..5.70, z -7.38..-5.71, 2.59 u tall): from inside it reads as a chair back filling the left half of the
  frame. The shared studio state (library:humboldt rev 313) has the board ~0.2 u nearer that path than the authored
  layout; renders that load it (--state-keys ergoflex.sceneAssets.v1) all show it, HQ12's delivered clip did not.
- HQ11's keys are kept up to and including 'Group' (the drive Vico liked); only the end key changes: the same drift
  right, stopped 0.6 u short, in front of the board, on the group (desk at the table head, the red wheelchair whole).
"""
import json, math, os, subprocess, sys, tempfile

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPLINE = os.path.join(ROOT, 'tools/experience/camera-spline.mjs')

# ================================================================ chapter 3: create
# HQ35 (Vico, 2026-11-05: every pause "like a second and a quarter", the white settled and the camera stopped): each
# colour's 1 s fade back, then 1.25 s of settled white (was 0.5 s); the next colour fades in over 0.6 s like chapters 1
# and 2. The length stays 18 s (the closing portrait shortens).
PAUSE, FADE = 1.25, 1.0
GAP = FADE + PAUSE
H0, T0, H_LIFT, T_DRAFT, T_TILT = 43.5, 12, 52, 25, 45
DRAFT = (1.4, 3.0)                                   # 12 -> 25 deg, 4.3 deg/s
LIFT = (round(sum(DRAFT) + GAP, 3), 2.6)             # 43.5 -> 52 in, 3.27 in/s (the real desk's ~3.2)
TILT = (round(sum(LIFT) + GAP, 3), 4.3)              # 25 -> 45 deg, 4.65 deg/s


def clip(id, lane, kind, start, dur, label, target):
    return {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': 'smooth', 'label': label, 'target': target}


CREATE_MOTION = {'version': 2, 'initial': {'height': H0, 'tilt': T0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': [
    clip('drafting', 'tilt', 'tilt', *DRAFT, f'Drafting · {T_DRAFT}°', T_DRAFT),
    clip('lift-clear', 'lift', 'lift', *LIFT, f'Lift up · {H_LIFT} in', H_LIFT),
    clip('easel', 'tilt', 'tilt', *TILT, f'Tilt · {T_TILT}°', T_TILT)]}
# Tilt angle increasing (board steepening) = purple 'tilt-retract' (Vico, real desk); lift up = blue.
CREATE_STATUS = [{'at': DRAFT[0], 'dur': DRAFT[1], 'kind': 'tilt-retract', 'fade': FADE},
                 {'at': LIFT[0], 'dur': LIFT[1], 'kind': 'lift-up', 'fade': FADE, 'fadeIn': .6},
                 {'at': TILT[0], 'dur': TILT[1], 'kind': 'tilt-retract', 'fade': FADE, 'fadeIn': .6}]


def key(at, pos, tgt, fov, label=None, **kw):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    k.update(kw); return k


CREATE_CAMERA = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0.0, [0.35, 4.0, 0.85], [-1.341, 1.821, 0.406], 50, 'Top shot'),
    key(DRAFT[0], [0.33, 3.98, 0.65], [-1.326, 1.818, 0.419], 50, 'Drafting tilt (purple)'),
    # HQ35: at rest on each pause (hold from the move's end to the next move's start), moving only with the desk.
    key(sum(DRAFT) + .6, [0.32, 3.88, 0.15], [-1.30, 1.80, 0.45], 50, 'Drafting angle (rest)', hold=round(GAP - .6, 3)),
    key(LIFT[0] + 1.6, [0.55, 3.25, -1.15], [-1.26, 1.82, 0.45], 49, 'Front-left 3/4: lift (blue)'),
    key(sum(LIFT) + .6, [0.45, 2.70, -2.05], [-1.35, 1.80, 0.45], 50, 'Lifted to 52 in (rest)', hold=round(GAP - .6, 3)),
    key(TILT[0] + 2.2, [-1.01, 2.02, -3.05], [-1.70, 1.50, 0.42], 56, 'Side profile: tilt clears the stool', hold=.6),
    key(16.6, [0.95, 1.66, -1.95], [-1.22, 1.74, 0.48], 40, 'Front 3/4 easel portrait'),
    key(18.0, [1.42, 1.60, -1.18], [-1.25, 1.74, 0.50], 36, 'Portrait push')]}

# The stool's own palette is one untextured white mesh (no paint wells to colour): hide it, and set the Atelier
# painted palette on the seat. Placement is desk-local mm on the base-shelf mount, like the stool itself.
PALETTE_HIDE = {'match': '^Mesh_2$', 'path': 'ergoflex-artist-stool', 'hide': True}
PALETTE = {'id': 'atelier-artist-palette-oak', 'role': 'base-shelf', 'x': -150, 'z': 620, 'y': 335, 'rotation': 20}


def director(cid): return os.path.exists(os.path.join(H, f'director-camera-{cid}.json'))


def fix_create(s):
    s['motion'] = CREATE_MOTION
    s['ledStatus'] = CREATE_STATUS
    if not director('create'):
        s['cameraPlan'] = CREATE_CAMERA
        s['camera'] = bake(s['seconds'], CREATE_CAMERA)
    s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if not (e.get('match') == PALETTE_HIDE['match'] and e.get('path') == PALETTE_HIDE['path'])] + [PALETTE_HIDE]
    acc = s.setdefault('accessories', {}); add = acc.setdefault('add', [])
    acc['add'] = [a for a in add if not (isinstance(a, dict) and a.get('id') == PALETTE['id'])] + [PALETTE]
    return s


# ================================================================ chapter 4: commons
# HQ11's keys (build-round6-commons.py) through 'Group'; the end stays in front of the campus board.
COMMONS_CAMERA = {'easeIn': False, 'easeOut': False, 'keys': [
    key(0.0, [-3.98, 1.45, -7.45], [-1.73, 1.58, -12.50], 40, 'Inside the commons'),
    key(2.65, [-2.98, 1.75, -7.15], [-1.38, 1.45, -12.00], 44, 'Desk leaves the wall'),
    key(5.3, [-1.20, 2.35, -6.60], [0.20, 1.40, -11.70], 46, 'Rise over the table'),
    key(8.46, [1.70, 2.45, -7.20], [1.85, 1.38, -11.60], 46, 'Drive along the table'),
    key(11.6, [4.85, 2.55, -7.75], [3.00, 1.18, -11.50], 47, 'Group: desk at the table head'),
    key(14.0, [5.45, 2.45, -7.62], [3.25, 1.10, -11.40], 47, 'Group, wheelchair whole (stops before the board)')]}


def fix_commons(s):
    if not director('commons'):
        s['cameraPlan'] = COMMONS_CAMERA
        s['camera'] = bake(s['seconds'], COMMONS_CAMERA)
    return s


# ================================================================ bake + write
_baked = {}


def bake(seconds, plan):
    k = json.dumps([seconds, plan])
    if k not in _baked:
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
            json.dump({'seconds': seconds, 'cameraPlan': plan}, f); tmp = f.name
        try:
            subprocess.run(['node', SPLINE, tmp], check=True, stdout=subprocess.DEVNULL)
            _baked[k] = json.load(open(tmp))['camera']
        finally:
            os.unlink(tmp)
    return json.loads(json.dumps(_baked[k]))


FIX = {'create': fix_create, 'commons': fix_commons}


def fix(s):
    return FIX[s['id']](s) if s.get('id') in FIX else s


cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
cut['shots'] = [fix(s) for s in cut['shots']]
json.dump(cut, open(cut_path, 'w'), indent=1)
for n, sid in (('03', 'create'), ('04', 'commons')):
    p = os.path.join(H, 'shots', n + '.json')
    if os.path.exists(p):
        sh = json.load(open(p))
        if sh.get('id') == sid: json.dump(fix(sh), open(p, 'w'), indent=1)

print(f'create: drafting tilt {DRAFT}, lift {H0}->{H_LIFT} in {LIFT}, tilt {T_DRAFT}->{T_TILT} deg {TILT}; '
      f'{len(CREATE_CAMERA["keys"])} story keys; stool palette swapped for {PALETTE["id"]}')
print(f'commons: HQ11 camera with the end in front of the campus board; {len(COMMONS_CAMERA["keys"])} story keys')
