#!/usr/bin/env python3
"""Round 8 LED notes (Vico, 2026-11-04 afternoon), all status-light chapters.

- Neutral look: between status states the strips show a soft warm white (like the app's
  neutral look) instead of near-off grey; dark-stage chapters get a dimmer warm white.
- Lift: one wavefront per move, foot rest to top (film-status `sweep`, the default now).
- Floor: the desktop centre strip lights the floor too (film-fx floorLight `center`, defaults to wings).
- Chapter 1 (HQ14g): the visualizer's LED receivers and levels (film-fx ledReceivers 'viewer') instead of floorLight.
Usage: build-round8-leds.py <hq dir>  (review-cut.json and shots/NN.json, in place)
"""
import glob, json, os, sys

H = sys.argv[1]
WARM_ROOM, WARM_STAGE = '#ffd8a8', '#5a4938'   # stage: halved after the HQ14 preview (Vico: too bright)
WHITE_STAGE = '#4c4c4c'   # Vico, HQ14c: true white instead of warm, same brightness as the halved warm (luminance-matched)
WHITE = {'awaken'}        # chapter 1 first; the other chapters follow once it is signed off
STAGE = {'awaken', 'awareness'}            # the black product stage
# The visualizer's LED surface levels (app-reference/assets/desk_viewer/led/led-receivers.mjs LED_SURFACE_DEFAULTS,
# the same numbers as studio.js's): desk-viewer.js runs them with no overrides.
VIEWER_SURFACES = {'desktopStrength': 157, 'desktopReach': 100, 'desktopWidth': 5, 'desktopCone': 100, 'desktopEdgeFade': 46,
                   'desktopSharpness': 62, 'shelfStrength': 176, 'shelfReach': 98, 'baseStrength': 54, 'baseReach': 20,
                   'topStrength': 143, 'topReach': 77, 'floorStrength': 156, 'floorReach': 4, 'floorWidth': 50, 'floorSharpness': 73,
                   'leftWingStrength': 111, 'leftWingReach': 85, 'rightWingStrength': 110, 'rightWingReach': 87}


def fix(s):
    if not s.get('ledStatus') or s.get('id') == 'storage':   # storage already rests on warm white #fff1dc
        return s
    s['ledColor'] = WHITE_STAGE if s['id'] in WHITE else WARM_STAGE if s['id'] in STAGE else WARM_ROOM
    if s['id'] == 'awaken':
        # Lights off while the camera finds the desk (wheel macro -> base -> silhouette + first title at 8.2 s),
        # then switch on (0.3 s) before the first move at 11 s.
        s['ledStatus'] = [{'at': 0, 'dur': 9.2, 'kind': 'off', 'fade': .3}] + [e for e in s['ledStatus'] if e.get('kind') != 'off']
        # Floor (Vico, HQ14c/d; the floorLight tuning below was superseded by HQ14g): the lift lights the foot rest first and the wide floor with the desktop layer; the foot
        # strip sits just above the floor, so its pool is a tight hot strip at the shelf (lift .02), not a wide wash.
        # HQ14e: the desktop centre strip lights the floor in front like the wings (aimed forward, else its pool lands
        # under the foot shelf and leaves a dark centre), and the foot strip lights only the floor: the app's spill on the
        # foot-rest top (Base_Panels_3, receiver 'base', row 7) is hidden; baseStrength stays (it also drives the centre
        # strip's underside spill, which the floor light's centre gain reads).
        # HQ14g (Vico, 18:16: "we already have the lighting down" in the visualizer): the desk's LED light is the app
        # visualizer's own, not the film's approximation. ledReceivers 'viewer' (film-viewer-leds.mjs) ports its floor
        # bounce (strips 4/5/6 + the lit wing faces, per pixel, rise gain), the wing glow down the side plates, its wing /
        # desktop constants and its indicator level; the app's foot floor glow stays, as in the visualizer. The surface
        # levels are the visualizer's (LED_SURFACE_DEFAULTS; it applies no overrides), so the film's floorLight and its
        # ledSurfaces overrides (desktop 140 / width 30, floor 200/100/100/10, wings 150, base 170) are gone. ledGlow 1 is
        # the visualizer's gain 1, the level it draws status indicators at. The foot strip still lights only the floor.
        s.pop('floorLight', None)
        # The visualizer's strip map (the Custom Shop's is its mirror image along Z): the visualizer is the reference look.
        s['ledReceivers'] = {'mode': 'viewer', 'stripMap': 'viewer'}
        s['ledSurfaces'] = dict(VIEWER_SURFACES)
        FOOT_TOP = {'match': '^Base_Panels_3 LED reflection$', 'hide': True}
        s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if e.get('match') != FOOT_TOP['match']] + [FOOT_TOP]
        # The stage rig cues (dark until the switch-on, settle, hero bookend) live in build-round8-opener.py,
        # which owns the chapter's timeline and runs after this script.
    return s


paths = [os.path.join(H, 'review-cut.json')] + sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json')))
for p in paths:
    d = json.load(open(p))
    if 'shots' in d: d['shots'] = [fix(s) for s in d['shots']]
    else: d = fix(d)
    json.dump(d, open(p, 'w'), indent=1)
print('neutral warm white on', [s['id'] for s in json.load(open(paths[0]))['shots'] if s.get('ledColor') in (WARM_ROOM, WARM_STAGE, WHITE_STAGE)])
