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
EXPOSURE = {'rise': .9, 'create': .7}   # commons .8 until HQ16 (see DAYLIGHT)
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
# HQ14r (Vico: "all chapters have the right lighting"): storage joins the approved look at the dimmed levels. Its desktop
# folds to 65 deg and then faces the desktop strip head-on, so at the full desktop level the roll's amber/red turned the
# whole green Humboldt top gold (test stills); its desktop receiver runs at 30% of the others' (the status light still
# reads on the floor, the wall and the desktop's edge). Its room keeps its own grade (environmentScale / exposure) under roomLight.
SURFACE_TRIM = {'storage': {'desktopStrength': .3}}
# HQ16 (Vico, 2026-11-05: the library "looks like at night, it should be a day setting ... make that also for the day",
# both library chapters). Director Mode's routes light the room for the route's daypart, not the shot's mode: the group
# route (commons) prepares 'party' (an evening workshop: dusk-navy windows, power .22) and the storage route 'night'
# (closing). DAYLIGHT keys film-tod's lighting-only daypart blend (dressing, props and the route stay as prepared): the
# route's own mode before the chapter starts, morning from 0 s (one key alone blends nothing). Under morning light
# the rooms take roomLight .8 (full: the white study table clips in the close frames); storage drops its old night
# brightening (environmentScale 1.5, exposure 1.14, build-round4-lighting.py). The status light stays at the approved
# level: at half it read washed out against the daylit floor (HQ16a, Vico).
DAYLIGHT = {'commons': 'party', 'storage': 'night'}
# HQ17 (lighting review): the gym at .55 was the film's biggest exposure drop (mean luma ~51 after the high school's ~113),
# muddy blue-grey under a near-clipping window; .8 lifts it to daytime without more clipping.
ROOM_LIGHT_BY = {'commons': .8, 'storage': .8, 'wellness': .8}
# HQ16c (Vico on HQ16b: the full yellow/red status light "bounces off too many walls", and off the desktop too much; the
# monitor too bright). Picked variant B of peak-pulse stills: the app's room LED spill (walls/floor within ~2 m and the
# LEDs' share of the architectural bounce; film-fx ledRoomSpill) at 25%, the desktop receiver at half (on top of
# storage's SURFACE_TRIM) and the monitor clip at 75%. The floor glow and the strips keep their level.
LIBRARY_LED = {'desktopStrength': .5, 'screenBrightness': .75}   # its room spill: DAY_SPILL (was .25, HQ16c)
# HQ16f (Vico, after the OCC / high school 480p: in daylit rooms the walls should take much less of the desk's LED light,
# the ambient light washes it out; the floor less too; "do the 15%"): every daylit room chapter's room LED spill
# (walls and floor within ~2 m, and the LEDs' share of the architectural bounce) at 15%. Night rooms (music, media) keep theirs.
DAY_ROOMS, DAY_SPILL = ('rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'storage'), .15
MONTAGE = .55   # music: video-game montage screens + their LED light; lighting expert picked B of A .7 / B .55 / C .4 (A still clipped the screen whites)
GYM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gym-black-red.json')


def fix(s):
    # HQ16d (Vico: the OCC headphones "not on the headphone hook"): coast's deskObjects (Vico's 2026-11-03 OCC desktop,
    # saved before the plug-mounted hook, 7f0d77a) placed the headphones by hand at their old spot on the hutch post, over
    # the app's hook migration (desk-headphone-hook.mjs). Without that entry they hang on the hook in the side panel's port.
    if s['id'] == 'coast':
        s.get('deskObjects', {}).pop('default-desktop-1', None)
    # HQ16e (Vico: in storage "it's moving to the right, but the status indicator lighting says it's going to the left",
    # the floor comet especially): on the visualizer's strip map the roll's comets ran against the travel; they run with it.
    if s['id'] in DAY_ROOMS: s.setdefault('sceneGlobals', {})['ledRoomSpill'] = DAY_SPILL
    # HQ16h (Vico: "all working environments should have that soft white ... during the day a true white, and in the
    # evening the warm white"). The status chapters already show true white (WHITE_ROOM; rise warms with its clock); the
    # two rooms without a status light showed the app's blue: they take the app's true white.
    if s['id'] in ('coast', 'oilers'): s['ledColor'] = '#ffffff'
    # HQ16h (Vico, high school row 3): the window view had been boosted 2.5x and bloomed to white; at 0.7x it keeps a
    # soft glow, and the room's own light runs at 75%.
    if s['id'] == 'oilers':
        s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if e.get('match') != '@window'] + [{'match': '@window', 'material': {'brightness': .7, 'mapBlur': 1.5}}]
        s.setdefault('sceneGlobals', {})['roomLight'] = .75
    # HQ16g (Vico, movie night "pretty good, bring that to 90%"): the stage's curved media screen and the picture-driven
    # LED light it feeds (ledGain), both at 90%. Idempotent: the base gain is kept in mediaBaseGain.
    if s['id'] == 'media':
        MOVIE = .9
        s['sceneEdits'] = [e for e in s.get('sceneEdits', []) if e.get('match') != '^Curved media screen$'] + [{'match': '^Curved media screen$', 'material': {'brightness': MOVIE}}]
        s['ledGain'] = round(s.setdefault('mediaBaseGain', s['ledGain']) * MOVIE, 3)
    # HQ17 (Vico: the video-game montage "too bright"): the gaming room's main monitor and arcade screen, and the
    # picture-driven LED light (ledGain) they feed, at MONTAGE. Idempotent via musicBaseGain.
    if s['id'] == 'music':
        for sc in s.get('screens', []):
            if sc.get('target') in ('main-landscape', 'arcade'): sc['brightness'] = MONTAGE
        s['ledGain'] = round(s.setdefault('musicBaseGain', s['ledGain']) * MONTAGE, 3)
    # HQ17 (Vico: "replace the green and gray gym with a black and red gym" in the film): the gym recolor's
    # sceneEdits / lights (tools/experience/gym-black-red.json), replacing any earlier copy (tagged gymBlackRed).
    if s['id'] == 'wellness' and os.path.exists(GYM):
        g = json.load(open(GYM))
        # The lighting review: the window at 2.75 was near clipping (and read late-afternoon); 2.2 in place.
        for e in s.get('sceneEdits', []):
            if e.get('match') == '@window' and 'brightness' in e.get('material', {}): e['material']['brightness'] = g.get('windowBrightness', 2.2)
        s['sceneEdits'] =[e for e in s.get('sceneEdits', []) if not e.get('gymBlackRed')] + [{**e, 'gymBlackRed': True} for e in g.get('sceneEdits', [])]
        if g.get('lights'): s['lights'] = [l for l in s.get('lights', []) if not l.get('gymBlackRed')] + [{**l, 'gymBlackRed': True} for l in g['lights']]
    if s['id'] == 'storage':
        for e in s.get('ledStatus', []):
            if e.get('kind') == 'wheels': e['reverse'] = True
    # (Storage stayed on its old look, warm white #fff1dc + floorLight, until HQ14r: see SURFACE_TRIM.)
    if not s.get('ledStatus'):
        return s
    s['ledColor'] = WHITE_STAGE if s['id'] in STAGE else WHITE_ROOM
    if s['id'] in NEUTRAL: s['ledNeutral'] = NEUTRAL[s['id']]
    if s['id'] not in STAGE:
        g = s.setdefault('sceneGlobals', {}); g['roomLight'] = ROOM_LIGHT_BY.get(s['id'], ROOM_LIGHT)
        if s['id'] in EXPOSURE: g['exposureScale'] = EXPOSURE[s['id']]
        else: g.pop('exposureScale', None)
    if s['id'] in DAYLIGHT:
        s['timeOfDay'] = [{'at': -1, 'mode': DAYLIGHT[s['id']]}, {'at': 0, 'mode': 'morning'}]
        s['sceneGlobals'].pop('environmentScale', None); s['sceneGlobals'].pop('exposure', None)
        for sc in s.get('screens', []): sc['brightness'] = LIBRARY_LED['screenBrightness']
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
    for k, f in SURFACE_TRIM.get(s['id'], {}).items(): s['ledSurfaces'][k] = round(s['ledSurfaces'][k] * f, 1)
    if s['id'] in DAYLIGHT: s['ledSurfaces']['desktopStrength'] = round(s['ledSurfaces']['desktopStrength'] * LIBRARY_LED['desktopStrength'], 1)
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
