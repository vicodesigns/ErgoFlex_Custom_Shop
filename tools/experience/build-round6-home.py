#!/usr/bin/env python3
"""Round 6 (HQ11) ch 2 rise, ch 3 create and ch 7 wellness, from the final expert panel.

    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-round6-home.py exports/cinematic-intro-20261103-hq11

Sources in /home/ergo/logs/: final_review_cinematography_2026-11-04.md (3, 4, 5), final_review_settings_home_2026-11-04.md,
final_review_motion_2026-11-04.md (S3), final_review_lighting_2026-11-04.md (SHOULD 5). Every value is absolute and the
whole cameraPlan of each shot is rewritten, so re-running is safe. Writes shots/02.json, 03.json, 08.json (wellness keeps
the 13-shot numbering, where awareness is 09) and those three shots in review-cut.json; nothing else.
Owner rules kept: ch 3 stays drafting (45 deg max) with purple tilt light; lift up is blue.
"""
import json, math, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
key = lambda at, p, t, fov, **kw: dict(at=at, position=p, target=t, fov=fov, **kw)
WINDOW = {'match': '@window', 'material': {'brightness': 2.3, 'mapBlur': 3.5}}   # settings-home ch 2 #3: soft, not brighter than the room


def edits(s, drop, add):
    """The shot's sceneEdits without the entries this builder owns (drop(e) true), plus add."""
    return [e for e in s.get('sceneEdits', []) if not drop(e)] + add


# ---------- ch 2 rise ----------
TABLET = [-0.36, 1.19, 0.235]

def rise(s):
    # Cinematography 5 + settings-home MUST: open on the tablet (the tap that starts the rise). The panel's suggested
    # aim (19 deg right) still left the tablet half out at the frame edge (probed: tablet-pc box x -0.62..-0.07,
    # z -0.06..0.51, screen centre ~[-0.36, 1.19, 0.235]), so keys 0 / 1 / 1.6 look straight at it from the side the
    # 3.4 key looks from (8.5 deg apart): the pull-out under the title is a dolly back, not a whip pan.
    # Cinematography 3: the aim rises and widens with the desk so the "43.5" and "52.5" readouts stay in frame
    # (a little wider than the panel's values, which still touched the monitor top in stills).
    s['cameraPlan'] = {'easeIn': False, 'easeOut': False, 'keys': [
        key(0, [0.511, 1.527, 0.532], TABLET, 34, label='ErgoFlex app on the tablet'),
        key(1, [0.458, 1.506, 0.514], TABLET, 34, label='Tap Stand'),
        key(1.6, [0.431, 1.496, 0.505], TABLET, 34),
        key(3.4, [0.95, 1.6, 1.3], [-0.671, 1.25, 0.77], 34, label='Pull out as it rises'),
        key(6.4, [2.85, 1.85, 1.6], [-0.541, 1.58, -0.073], 47),
        key(7.4, [2.82, 1.87, 1.6], [-0.541, 1.58, -0.071], 47),
        key(10.6, [2.75, 2.15, 1.62], [-0.587, 1.72, 0.053], 48, label='Full height'),
        key(13.4, [3.3, 1.52, 1.8], [-0.787, 1.621, 0.55], 49, label='Low 3/4, floor to monitor top'),
        key(14.7, [3.36, 1.51, 1.82], [-0.78, 1.621, 0.534], 48.5),
        key(16, [3.42, 1.5, 1.84], [-0.773, 1.621, 0.517], 48)]}
    s['sceneEdits'] = edits(s, lambda e: e.get('match') == '@window', [WINDOW])


# ---------- ch 3 create ----------
# The drafting kit (workspace-3d.mjs 'drafting-kit', authored in mm) sits on the desktop at yaw 90 and scale 1.6:
# kit +x is world -z, kit +z (toward the front lip, the low edge when tilted) is world +x, tilted about world z.
# sceneEdits positions are world deltas applied once at install, and the edits install with the desktop still flat
# (probed: deltas computed for 0 deg land on the lip; for the shot's initial 12 deg they sink into the board).
KIT_SCALE = 0.0016

def kit_delta(dx, dy, dz, tilt):
    a = math.radians(tilt); s_, c = math.sin(a), math.cos(a)
    return [round(KIT_SCALE * (dy * s_ + dz * c), 4), round(KIT_SCALE * (dy * c - dz * s_), 4), round(-KIT_SCALE * dx, 4)]

# A floor-standing library prop, placed through the shot's accessories on the desk's base shelf (the base does not
# lift or tilt), then dropped to the floor and given back its catalogue size with sceneEdits: desk objects start at
# most 400 mm across (scene-desk-objects.mjs add), and the base shelf mount sits 0.1941 u above the floor (probed).
BASE_SHELF_Y = 0.1941

def floor_prop(pid, **at):
    return {'id': pid, 'role': 'base-shelf', **at}

def floor_prop_edits(pid, size_mm):
    return [{'match': '^Prop:' + pid + '$', 'position': [0, -BASE_SHELF_Y, 0], 'scale': round(max(1, size_mm / 400), 4)}]

def create(s):
    tilt0 = 0
    # Cinematography 4: the 45 deg beat and its 1 s rest, pulled back 0.6 u and aimed ~8 deg right. At the panel's
    # fov 52 / target y 1.70 the base and the monitor tops were still cut in stills, so fov 56 (its own fallback) and
    # the aim 0.2 lower: the whole desk, casters to monitors, at about x 0.5 of the frame.
    s['cameraPlan'] = {'easeIn': False, 'easeOut': False, 'keys': [
        key(0, [0.35, 4.0, 0.85], [-1.341, 1.821, 0.406], 50, label='Top shot'),
        key(1.4, [0.33, 3.98, 0.65], [-1.326, 1.818, 0.419], 50),
        key(4.0, [0.32, 3.88, 0.15], [-1.30, 1.80, 0.45], 50),
        key(7.4, [0.63, 3.0, -1.56], [-1.25, 1.78, 0.45], 48, label='Front-left 3/4, descending'),
        key(10.6, [-1.01, 2.02, -3.05], [-1.70, 1.50, 0.42], 56, hold=1.0, label='Side profile, rest'),
        key(15.4, [0.95, 1.66, -1.95], [-1.22, 1.74, 0.48], 40, label='Front 3/4 easel portrait'),
        key(18, [1.42, 1.60, -1.18], [-1.25, 1.74, 0.50], 36)]}
    own = lambda e: e.get('match') in ('^Prop:steelcase-leap-v2$', '^Drafting pencil$', '^Prop:ergoflex-artist-stool$') or e.get('materialColor') == '#bcd4d4'
    s['sceneEdits'] = edits(s, own, [
        # Settings-home ch 3 MUST: loose pencils roll off a 45 deg board. The two graphite ones go; the wooden one
        # (kit x -336, z -37.5, along the slope) lies along the lip at the board's lower edge, the one place it stays.
        {'match': '^Drafting pencil$', 'materialColor': '#36454c', 'hide': True},
        {'match': '^Drafting pencil$', 'materialColor': '#b5996d', 'rotation': [0, 0, 90],
         'position': kit_delta(-250 + 336, 13.2 - 14, 287.5 + 37.5, tilt0)},
        # The set square would slide too: its base now rests on the parallel rule (rule's upper edge, kit z 220).
        {'match': '', 'materialColor': '#bcd4d4', 'position': kit_delta(0, 0, 140, tilt0)},
        # Settings-home ch 3 #2: no task chair at a 43.5 in board.
        {'match': '^Prop:steelcase-leap-v2$', 'hide': True},
        # ... and the studio's own artist stool at the board's front-left, on the floor (see place_floor_prop).
        *floor_prop_edits('ergoflex-artist-stool', 489)])
    s['accessories'] = {'add': ['drafting-kit', floor_prop('ergoflex-artist-stool', x=-150, z=620, rotation=-15)]}


# ---------- ch 7 wellness ----------
def wellness(s):
    s['seconds'] = 13   # content review trim (coordinator): the static tail goes; card 1.6-7.4 and the lift are unchanged
    s['cameraPlan'] = {'easeIn': False, 'easeOut': False, 'keys': [
        key(0, [3.75, 1.26, -2.05], [-0.435, 0.82, 1.59], 36, label='Seated working view'),
        key(3, [3.3, 1.3, -2.02], [-0.357, 0.84, 1.594], 36),
        key(7.2, [3.15, 1.62, -1.88], [-0.52, 1.12, 1.398], 39.5, label='Rise with the user'),
        key(10.0, [3.5, 1.75, -1.1], [-0.934, 1.15, 0.714], 38),
        key(13, [3.85, 1.84, -0.31], [-0.975, 1.15, 0.20], 38.75, label='Reveal the gym')]}
    # Motion S3: the stand break shows the blue lift light like ch 2. Lighting SHOULD 5: the floor pool clipped. Probed:
    # the rest pool is the room LED spill (room-led-spill.mjs, gain 1.8 x ledGlow), which the floor slider barely
    # touches; at the panel's ledGlow 0.18 it still clipped (~9% of the pool >= 250). So the glow drops to 0.08, where
    # the rest pool is a soft accent (pool Y p50 ~97, p90 ~150, 0% clipped), and the lift event is carried by the
    # receivers at full strength plus ledFill: blue on the uprights, base and floor, and onto the wall behind.
    s.pop('ledColor', None)
    s['ledStatus'] = [{'at': 3, 'dur': 5, 'kind': 'lift-up', 'fade': 1}]
    s['ledGlow'] = 0.08; s['ledFill'] = {'intensity': 14, 'height': 0.3}
    s['ledSurfaces'] = {'floorStrength': 200, 'floorReach': 70, 'desktopStrength': 160, 'baseStrength': 200, 'shelfStrength': 200,
                        'topStrength': 200, 'leftWingStrength': 200, 'rightWingStrength': 200}
    # Settings-home ch 7 #3: something to sit on at 28 in: a low slate pouf stool (44 cm) at the desk's front-left
    # corner, clear of the base and the lift light. The base shelf mount does not lift (checked at 10.4 s).
    s['accessories'] = {'add': [floor_prop('campus-pouf-slate', x=-560, z=470, rotation=0)]}
    s['sceneEdits'] = edits(s, lambda e: e.get('match') == '^Prop:campus-pouf-slate$', floor_prop_edits('campus-pouf-slate', 439.4))

cut = json.load(open(os.path.join(d, 'review-cut.json')))
for n, name, fn in (('02', 'rise', rise), ('03', 'create', create), ('08', 'wellness', wellness)):
    i = next(i for i, x in enumerate(cut['shots']) if x['id'] == name)
    s = cut['shots'][i]; fn(s)
    f = os.path.join(d, 'shots', n + '.json'); json.dump(s, open(f, 'w'), indent=1)
    subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
    cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print('home: rise tablet open + readout framing + soft window; create 45 deg framing, pencils/set square, no Leap;'
      ' wellness 13 s, blue stand-break light, tamed floor pool')
