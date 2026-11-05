#!/usr/bin/env python3
"""Round 8 LED notes (Vico, 2026-11-04 afternoon), all status-light chapters.

- Neutral look: between status states the strips show a soft warm white (like the app's
  neutral look) instead of near-off grey; dark-stage chapters get a dimmer warm white.
- Lift: one wavefront per move, foot rest to top (film-status `sweep`, the default now).
- Floor: the desktop centre strip lights the floor too (film-fx floorLight `center`, defaults to wings).
- Chapter 1 (HQ14g): the visualizer's LED receivers and levels (film-fx ledReceivers 'viewer') instead of floorLight.
- HQ15 (Vico, 2026-11-04 evening): the chapter 1 lighting carries to every status-light chapter: true white neutral
  (room chapters luminance-matched to the old warm), the visualizer's receivers / surface levels / gain, no film fill
  light or floorLight, foot-rest top dark.
Usage: build-round8-leds.py <hq dir>  (review-cut.json and shots/NN.json, in place)
"""
import glob, json, os, sys

H = sys.argv[1]
WARM_ROOM, WARM_STAGE = '#ffd8a8', '#5a4938'   # stage: halved after the HQ14 preview (Vico: too bright)
WHITE_STAGE = '#4c4c4c'   # Vico, HQ14c: true white instead of warm, same brightness as the halved warm (luminance-matched)
WHITE_ROOM = '#dfdfdf'    # HQ15: the same true white for the room chapters, luminance-matched to WARM_ROOM
STAGE = {'awaken', 'awareness'}            # the black product stage
# The visualizer's LED surface levels (app-reference/assets/desk_viewer/led/led-receivers.mjs LED_SURFACE_DEFAULTS,
# the same numbers as studio.js's): desk-viewer.js runs them with no overrides.
VIEWER_SURFACES = {'desktopStrength': 157, 'desktopReach': 100, 'desktopWidth': 5, 'desktopCone': 100, 'desktopEdgeFade': 46,
                   'desktopSharpness': 62, 'shelfStrength': 176, 'shelfReach': 98, 'baseStrength': 54, 'baseReach': 20,
                   'topStrength': 143, 'topReach': 77, 'floorStrength': 156, 'floorReach': 4, 'floorWidth': 50, 'floorSharpness': 73,
                   'leftWingStrength': 111, 'leftWingReach': 85, 'rightWingStrength': 110, 'rightWingReach': 87}


def fix(s):
    # Storage keeps its own look for now: it rests on the app's storage warm white #fff1dc, and at the visualizer's
    # levels the red roll washes the whole near-vertical Humboldt desktop red (HQ15 test stills); Vico to decide.
    if not s.get('ledStatus') or s.get('id') == 'storage':
        return s
    s['ledColor'] = WHITE_STAGE if s['id'] in STAGE else WHITE_ROOM
    if s['id'] == 'awaken':
        # Lights off while the camera finds the desk (wheel macro -> base -> silhouette + first title at 8.2 s),
        # then switch on (0.3 s) before the first move at 11 s.
        s['ledStatus'] = [{'at': 0, 'dur': 9.2, 'kind': 'off', 'fade': .3}] + [e for e in s['ledStatus'] if e.get('kind') != 'off']
    # Floor (Vico, HQ14c-g): the desk's LED light is the app visualizer's own ("we already have the lighting down"),
    # not the film's approximation. ledReceivers 'viewer' (film-viewer-leds.mjs) ports its floor bounce (strips 4/5/6
    # + the lit wing faces, per pixel, rise gain), the wing glow down the side plates, its wing / desktop constants and
    # its indicator level; the app's foot floor glow stays, as in the visualizer. The surface levels are the
    # visualizer's (LED_SURFACE_DEFAULTS; it applies no overrides), so the film's floorLight, its ledFill point light
    # and its ledSurfaces overrides are gone. ledGlow 1 is the visualizer's gain 1. The foot strip lights only the
    # floor: the app's spill on the foot-rest top (Base_Panels_3, receiver 'base') is hidden.
    s.pop('floorLight', None); s.pop('ledFill', None)
    # The visualizer's strip map (the Custom Shop's is its mirror image along Z): the visualizer is the reference look.
    s['ledReceivers'] = {'mode': 'viewer', 'stripMap': 'viewer'}
    s['ledSurfaces'] = dict(VIEWER_SURFACES)
    s['ledGlow'] = 1
    FOOT_TOP = {'match': '^Base_Panels_3 LED reflection$', 'hide': True}
    s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if e.get('match') != FOOT_TOP['match']] + [FOOT_TOP]
    # Chapter 1's stage rig cues (dark until the switch-on, settle, hero bookend) live in build-round8-opener.py,
    # which owns its timeline and runs after this script.
    return s


paths = [os.path.join(H, 'review-cut.json')] + sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json')))
for p in paths:
    d = json.load(open(p))
    if 'shots' in d: d['shots'] = [fix(s) for s in d['shots']]
    else: d = fix(d)
    json.dump(d, open(p, 'w'), indent=1)
print('visualizer LEDs on', [(s['id'], s.get('ledColor')) for s in json.load(open(paths[0]))['shots'] if s.get('ledReceivers')])
