#!/usr/bin/env python3
"""Round 7 (HQ12): the floor under the desk is lit by the real strips, wings included (film-fx 'floorLight').

    flock /tmp/claude-1000/hq12-cut.lock python3 tools/experience/build-round7-floor.py exports/cinematic-intro-20261104-hq12

Vico's HQ11 note 1: "the lighting on the ground is not really reflecting the reality ... The two side wings are
not being represented on the ground reflection ... it looks like a weird sharp box underneath the desk."

The app's 'Foot LED floor glow' (studio.js addFootLedFloorGlow) is a 60 x 60 in plane whose X smoothstep and
plane edge cut a hard rectangle, saturated flat at the film's floor strengths; the wing strips light only the wing
panels. floorLight (tools/experience/film-fx.mjs, 'floor light') hides that plane for the shot and integrates the
foot strip (7) and the two wing strips (5/6, under the desktop's side edges) as Lambertian line sources onto the
floor, per LED pixel, from the strips' live matrices (lift, tilt, glide and turns are followed), with each wing
panel shadowing its strip inboard. Strength stays the app's (ledGlow x floor/leftWing/rightWing Strength), so
the status colours, chases and fades drive the pools exactly as they drive the strips.

Values are absolute; safe to re-run. Edits only the floorLight field of the chapters listed in FLOOR, in
review-cut.json and in the matching shots/NN.json. Every chapter whose floor shows the status lights is listed;
'hero' is left alone (it has no ledStatus and another expert owns it this round).
"""
import json, os, sys, glob
d = sys.argv[1]
J = lambda *n: os.path.join(d, *n)

# Tuned on opener/awareness stills (before/after contact sheets, round 7); gain 1 = film-fx's calibrated K.
# wings: the wing strips hang 27-45 in above the floor, so per unit power their pools are 6-10x dimmer than
# the foot strip's (E ~ 1/h); the gain brings them up to read beside the desk, as bright as the lit panels. footLift: the foot strip is .175 up under the footrest, whose
# true band the footrest itself hides; the virtual lift spreads the same energy into a pool that falls off past
# the base. max: alpha ceiling (hue-preserving roll-off, so a status colour never clips toward white).
BASE = {'gain': 1, 'foot': 6, 'wings': 5, 'footLift': .35, 'max': .6, 'radius': 3.2}
FLOOR = {
    'awaken': BASE,        # opener: blue lift, purple tilt, yellow-green tilt back, right turn, red roll
    'rise': BASE,          # home: lift
    'create': BASE,        # creative: tilt
    'commons': BASE,       # library: group
    'wellness': BASE,      # gym: blue lift (ledGlow .08, so the pools stay a whisper like its strips)
    'awareness': BASE,     # sensing: red roll, amber proximity
    'storage': BASE,       # library at closing: purple fold, red roll
}

cut = json.load(open(J('review-cut.json')))
files = {}
for f in sorted(glob.glob(J('shots', '*.json'))):
    s = json.load(open(f))
    if isinstance(s, dict) and s.get('id'): files[s['id']] = f
for sid, fl in FLOOR.items():
    i = next((i for i, s in enumerate(cut['shots']) if s['id'] == sid), None)
    if i is None: print('skip (not in cut):', sid); continue
    cut['shots'][i]['floorLight'] = dict(fl)
    if sid in files:
        s = json.load(open(files[sid])); s['floorLight'] = dict(fl)
        json.dump(s, open(files[sid], 'w'), indent=1, ensure_ascii=False)
    print(f"{sid:10s} floorLight {json.dumps(fl)}  -> review-cut.json{' + ' + os.path.basename(files[sid]) if sid in files else ''}")
json.dump(cut, open(J('review-cut.json'), 'w'))
