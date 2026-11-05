#!/usr/bin/env python3
"""Round 8, chapter 1 monitor: the DIGITAL TWIN card's real 3D desk (Vico, 2026-11-04).

Vico: keep the dashboard's outer graphics, but put the actual visualizer of the desk in the twin card instead of the
drawn side view. This writes a one-shot cut, <hq>/post/twin-cut.json, of the same desk doing the awaken shot's moves
(motion.clips, ledStatus, LED colour/surfaces, floor light copied from shots/01.json every run), seen the way the app's
own 3D view shows it: one fixed 3/4 camera from slightly above, the desk evenly lit on a dark slate floor with its LED
floor glow, no stage cues (no dark start, no wake dim, no hero bookend, no grid or pulse ring), no titles.
Re-run it whenever the cinematographer changes the awaken shot; the framing is derived from the shot's motion.

  build-round8-twin.py [<hq dir>]       (default exports/cinematic-intro-20261104-hq14)

Then (render PC): render-cut --cut <hq>/post/twin-cut.json --shots 0 --video --size 1472x640 ... -> <out>/01.mkv,
and capture.mjs with TWIN=<that mkv> draws frame round(t * 30) of it into the card (screens/scenes/ch01.js).
"""
import copy, json, math, os, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
H = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'exports/cinematic-intro-20261104-hq14')
SRC = os.path.join(H, 'shots', '01.json')
OUT = os.path.join(H, 'post', 'twin-cut.json')

# The twin card in screens/scenes/ch01.js on the 2560x1072 01-main clip is 1458x635 px; the twin renders a hair larger
# at the same 2.3:1 aspect and is cover-fitted into it.
SIZE = (1472, 640)
U = 26.0                      # inches per scene unit (scene units are ~0.0384 per inch)
# Desk geometry on the product stage (build-round8-opener.py, measured with render-cut --list-at): the box centre at
# rest is (0.14, 0) and the turn pivot (model origin) is 0.24 u behind it; the desk's forward at yaw 0 is +x, a right
# turn swings the centre toward -z.
C_REST, OFF = (0.14, 0.0), 0.24
HALF_DIAG = math.hypot(30, 15) / U   # 60x30 footprint
TOP = 2.75                           # top of the monitors at full lift (u), for the vertical fit

# The app visualizer's view: front 3/4 from the HQ9 side (+z), slightly above.
AZ, EL, FOV = 38.0, 21.0, 30.0
FIT = .82                            # >1 = looser

# Look: the shot's clean product look held steady, less glare from the rims (the camera looks down on the top).
KEY, RIMS, ENV = 45, 90, 0.8
KEY_AT = {'az': -40, 'el': 62, 'dist': 3.4}   # high and off the camera's side: no key glare in the glossy top
SLATE = {'type': 'pool', 'name': 'slate', 'radius': 7.5, 'strength': .42, 'color': '#5a6a85'}   # the app's slate floor


def poses(shot, n=240):
    """Pose samples over the chapter via the app's own sampleClipMotion (experience/desk-clips.mjs)."""
    js = ("import {sampleClipMotion} from './experience/desk-clips.mjs';import fs from 'fs';"
          "const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),n=+process.argv[2];"
          "console.log(JSON.stringify(Array.from({length:n+1},(_,i)=>sampleClipMotion(s.motion,s.seconds*i/n))));")
    out = subprocess.run(['node', '--input-type=module', '-e', js, SRC, str(n)], cwd=root, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def centre(p):
    """Desk box centre (x, z) for a pose: pose z rolls forward (+x), pose x strafes right (-z), yaw turns right."""
    px, pz = C_REST[0] - OFF + p['z'] / U, C_REST[1] - p['x'] / U
    a = math.radians(-p['yaw'])
    return px + OFF * math.cos(a), pz + OFF * math.sin(a)


def camera(shot):
    cs = [centre(p) for p in poses(shot)]
    xs, zs = [c[0] for c in cs], [c[1] for c in cs]
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    r = max(math.hypot(x - cx, z - cz) for x, z in cs) + HALF_DIAG
    cy = TOP / 2
    # Fit the envelope's bounding cylinder (radius r, 0..TOP) in the vertical field of view; the card is wide.
    half = math.radians(FOV / 2)
    proj = r * math.sin(math.radians(EL)) + cy * math.cos(math.radians(EL))
    d = proj / math.tan(half) * FIT + r * math.cos(math.radians(EL))
    a, e = math.radians(AZ), math.radians(EL)
    pos = [cx + d * math.cos(e) * math.cos(a), cy + d * math.sin(e), cz + d * math.cos(e) * math.sin(a)]
    view = {'position': [round(v, 4) for v in pos], 'target': [round(cx, 4), round(cy, 4), round(cz, 4)], 'fov': FOV,
            'aspect': round(SIZE[0] / SIZE[1], 4)}
    keys = [{'id': f'twin-{i}', 'time': i, 'label': 'App visualizer view', 'easing': 'linear', 'view': view} for i in (0, 1)]
    return {'keys': keys}, (cx, cz, r, d)


def screens(shot):
    """The desk's own monitor: never the dashboard clip itself (the twin is an input to it), the stage logo instead."""
    out = []
    for s in shot.get('screens') or []:
        s = dict(s)
        if '/screens/01-main' in s.get('src', ''):
            s['src'] = os.path.relpath(os.path.join(H, 'post', 'opener-screen.png'), root)
            s['loop'] = False
        out.append(s)
    return out


def twin(shot):
    keep = ('room', 'kind', 'preset', 'size', 'seconds', 'transition', 'motion', 'ledStatus', 'ledGlow', 'ledColor',
            'ledSurfaces', 'ledFill', 'floorLight', 'ledPeriod', 'quality')
    t = {k: copy.deepcopy(shot[k]) for k in keep if k in shot}
    t.update({'id': 'awaken-twin', 'title': '', 'detail': ''})
    t['camera'], info = camera(shot)
    t['screens'] = screens(shot)
    # Material edits (wheels, desktop clearcoat) carry over; time-keyed stage cues do not.
    edits = [e for e in shot.get('sceneEdits', []) if not str(e.get('match', '')).startswith('@') and 'lightType' not in e]
    t['sceneEdits'] = edits + [{'match': '@grid', 'hide': True}, {'match': '@pulse', 'hide': True},
                               {'match': '@stageLight', 'intensity': .35}, {'lightType': 'DirectionalLight', 'intensity': .45}]
    t['lights'] = [{'preset': 'productRig', 'key': {'intensity': KEY, 'at': KEY_AT}, 'rimLeft': {'intensity': RIMS}, 'rimRight': {'intensity': RIMS},
                    'pool': False}, SLATE]
    t['sceneGlobals'] = {**{k: v for k, v in (shot.get('sceneGlobals') or {}).items() if not isinstance(v, list)}, 'environmentScale': ENV}
    return t, info


shot = json.load(open(SRC))
assert shot.get('id') == 'awaken', SRC
t, (cx, cz, r, d) = twin(shot)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'name': 'HQ14 digital twin (ch01 monitor card)', 'source': os.path.relpath(SRC, root), 'shots': [t]}, open(OUT, 'w'), indent=1)
print(f'{os.path.relpath(OUT, root)}: {t["seconds"]:g} s, {len(t["motion"]["clips"])} clips, {len(t.get("ledStatus", []))} LED states; '
      f'camera az {AZ:g} el {EL:g} fov {FOV:g} at {d:.2f} u, envelope centre ({cx:.3f}, {cz:.3f}) r {r:.2f}; render {SIZE[0]}x{SIZE[1]}')
