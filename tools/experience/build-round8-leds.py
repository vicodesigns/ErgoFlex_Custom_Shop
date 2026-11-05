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
# HQ14k (Vico: every chapter too bright, "fix it to what we have now in chapter 1"): the room chapters use chapter 1's
# level too. The web demo he signed off shows white at a quarter of its light (WHITE_LIGHT_LEVEL .25,
# led-pixel-renderer.mjs, demo branch), which the film's renderer lacks; #dfdfdf (luminance-matched to the old warm)
# drew about 10x the light of chapter 1's #4c4c4c and blew the desktop out on close-ups.
# HQ14l (Vico: rise "really bright light" for its first 1.5 s, commons "way too bright", chapters 2-8 too bright; "fix it
# to what we have now in chapter 1"). The neutral's brightness does follow its value on the film's path (strip emissive and
# every receiver are colour x level; desk-region luma on the rise opener 168 / 148 / 136 / 120 for #4c4c4c / #363636 /
# #262626 / black), but at chapter 1's level the solid white roughly doubled the light on the light-grey office desktop
# at close range, and it vanished at 1.6 s when the lift indicator took the strips: that drop was the "bright, then normal".
# On the dark stage the neutral is the key light; in a daylit room it is an accent (the app's own daylight room looks
# switch the strips off). Room chapters therefore show the stage white at the web demo's white trim, a quarter of its
# light (WHITE_LIGHT_LEVEL .25, led-pixel-renderer.mjs): linear .072 -> .018 = #242424. Status indicators keep full level.
WHITE_LIGHT_LEVEL = .25
def _light(h): return [((c / 255 + .055) / 1.055) ** 2.4 if c / 255 > .04045 else c / 255 / 12.92 for c in (int(h[i:i + 2], 16) for i in (1, 3, 5))]
def _hex(l): return '#' + ''.join('%02x' % round(255 * (1.055 * v ** (1 / 2.4) - .055 if v > .0031308 else 12.92 * v)) for v in l)
WHITE_ROOM = _hex([v * WHITE_LIGHT_LEVEL for v in _light(WHITE_STAGE)])   # '#242424'
# Vico's saved "Evening" preset (user_settings, RGBW 255,129,98,98, bri 255 -> about #ffe3c4; Polish 11-04) at chapter 1's level: the "Daytime" true white (bri 221) is #4c4c4c.
WARM_EVENING = '#52483c'
# The app's time-based white (Vico): true white by day, warm white from sunset. Rise's clock runs 08:00 -> 17:30 and the
# room reaches evening at 15.25 s (timeOfDay), so the strips warm with it after the last move has faded (11.6 s).
NEUTRAL = {'rise': [[0, WHITE_ROOM], [13.4, WHITE_ROOM], [15.6, WARM_EVENING]]}
STAGE = {'awaken', 'awareness'}            # the black product stage
# HQ14l room grade (film-fx sceneGlobals.roomLight / exposureScale). The room chapters were lit and exposed as the app's
# daylight looks (exposure 1.05-1.1, NeutralToneMapping), so white and light-grey surfaces sat on the tone curve's shoulder
# (create: mean luma ~165, up to 20% of the frame clipped; commons up to 13%, its white study tables and walls blown), and
# the desk's status light on the floor washed to a pale tint against the daylit floor instead of the saturated pool
# chapter 1 shows. ROOM_LIGHT brings the room's own light (lights, IBL, bounce, painted lamp pools) down while the desk's
# LED light keeps its level, so the room is lower key and the LEDs read against it as on the stage; EXPOSURE trims the
# rooms that are still hot (all-white artist room; the commons' white tables and ceiling pools; the rise office).
ROOM_LIGHT = .55
EXPOSURE = {'rise': .9, 'create': .7, 'commons': .8}
# The visualizer's LED surface levels (app-reference/assets/desk_viewer/led/led-receivers.mjs LED_SURFACE_DEFAULTS,
# the same numbers as studio.js's): desk-viewer.js runs them with no overrides.
VIEWER_SURFACES = {'desktopStrength': 157, 'desktopReach': 100, 'desktopWidth': 5, 'desktopCone': 100, 'desktopEdgeFade': 46,
                   'desktopSharpness': 62, 'shelfStrength': 176, 'shelfReach': 98, 'baseStrength': 54, 'baseReach': 20,
                   'topStrength': 143, 'topReach': 77, 'floorStrength': 156, 'floorReach': 4, 'floorWidth': 50, 'floorSharpness': 73,
                   'leftWingStrength': 111, 'leftWingReach': 85, 'rightWingStrength': 110, 'rightWingReach': 87}

# HQ14q (Vico, 480p of chapter 1: "the status indicator lighting is a little bit too bright, especially the reflections
# on the ground ... tone it down ... maybe by a third"): the light the strips cast is scaled down from the visualizer's
# levels (surface strengths x LIGHT_LEVEL; the floor, the app's foot glow and the ported floor bounce, x FLOOR_LEVEL).
# The strips themselves keep their brightness.
LIGHT_LEVEL, FLOOR_LEVEL, FLOOR_BOUNCE = 2 / 3, .5, 130   # FLOOR_BOUNCE: film-viewer-leds APP_SURFACE_DEFAULTS


def fix(s):
    # Storage keeps its own look for now: it rests on the app's storage warm white #fff1dc, and at the visualizer's
    # levels the red roll washes the whole near-vertical Humboldt desktop red (HQ15 test stills); Vico to decide.
    if not s.get('ledStatus') or s.get('id') == 'storage':
        return s
    s['ledColor'] = WHITE_STAGE if s['id'] in STAGE else WHITE_ROOM
    if s['id'] in NEUTRAL: s['ledNeutral'] = NEUTRAL[s['id']]
    if s['id'] not in STAGE:
        g = s.setdefault('sceneGlobals', {}); g['roomLight'] = ROOM_LIGHT
        if s['id'] in EXPOSURE: g['exposureScale'] = EXPOSURE[s['id']]
        else: g.pop('exposureScale', None)
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
    s['ledReceivers'] = {'mode': 'viewer', 'stripMap': 'viewer', 'floorBounceStrength': round(FLOOR_BOUNCE * FLOOR_LEVEL, 1)}
    s['ledSurfaces'] = {k: (round(v * (FLOOR_LEVEL if k == 'floorStrength' else LIGHT_LEVEL), 1) if k.endswith('Strength') else v)
                        for k, v in VIEWER_SURFACES.items()}
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
print('visualizer LEDs on', [(s['id'], s.get('ledColor'), s.get('sceneGlobals')) for s in json.load(open(paths[0]))['shots'] if s.get('ledReceivers')])
