#!/usr/bin/env python3
"""Round 6 (HQ11) ch 11 'storage': the library at closing, the desk folds and rolls to the wall.

    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-round6-storage.py exports/cinematic-intro-20261103-hq11

Findings (/home/ergo/logs/final_review_*_2026-11-04.md): motion M3/M4/M5, settings_education ch 11,
lighting MUST 3, cinematography 6 and 10. Values are absolute; safe to re-run. Edits only the storage shot
(review-cut.json and shots/12.json) and renders its monitor clip to <dir>/screens/11-main.mp4.

- Fold 0 -> 65 deg from 1.0 s over 10.0 s, trapezoid with 0.6 s ramps (cruise 6.9 deg/s, product fast tilt 7).
- Roll z 0 -> 95 in from 6.0 s over 9.4 s, trapezoid with 1.2 s ramps (cruise 11.6 in/s, product glide ~12),
  overlapping the fold 6-11 s (independent lanes). At rest 15.4 s, before the 15.5-17.0 dissolve; the end
  pose stays 43.5 in / 65 deg for the finale's match dissolve. The chapter stays 17 s.
- ledStatus: purple 'tilt-retract' while only the fold runs, red wheels mode 3 for the roll.
- Desktop cleared from 0 s (the student has packed up), so the app's auto-stow at 9 deg has nothing to pop:
  laptop, notebook, mouse + pad, keyboard; the headphones are put away too (overnight).
- The powered wheelchair leaves the window corner: pulled out to the aisle, angled toward the exit (world +x,
  down the hall), so it reads as someone's mobility device about to leave, not stored furniture. The spare
  Leap goes to the end of the project table (out of frame). The group-table chair that sat bottom-right over
  the parked beat is hidden (sceneEdits 'near' picks that one chair).
- Desk LED warm white #fff1dc at glow .15 (was stage cyan at .25): the wall cast came from it. Overrides
  build-round4-lighting.py's storage LED values; its room-light sceneEdits are kept.
- Camera: the 13.5 key moves to 14.3 (even key spacing after the hold, no brake).
- Monitor: steps follow the shot's clips (both active 6-11 s), 'Floor is yours' at rest, then it sleeps.
World units: the roll runs along world +x, 3.64 units for 95 in; room mm -> world: x = room_z * MM, z = -room_x * MM.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda *n: os.path.join(d, *n)
MM = 3.64 / 2413                      # world units per room mm
room = lambda x, z: (round(z * MM, 4), round(-x * MM, 4))

def trapezoid(total, dur, ramp):
    """Distance at t for a symmetric trapezoid velocity profile reaching `total` in `dur` with `ramp`-second ramps."""
    v = total / (dur - ramp); a = v / ramp
    def f(t):
        if t <= 0: return 0.0
        if t < ramp: return 0.5 * a * t * t
        if t <= dur - ramp: return 0.5 * a * ramp * ramp + v * (t - ramp)
        if t < dur: return total - 0.5 * a * (dur - t) ** 2
        return float(total)
    return f, v

def path(dur, key, f, step=0.1):
    n = round(dur / step)
    return [{'time': round(k / n, 6), 'pose': key(round(f(dur * k / n), 4))} for k in range(n + 1)]

cut = json.load(open(J('review-cut.json')))
i = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'storage')
s = cut['shots'][i]
s['seconds'] = 17

# ---------- motion (M3, M4) ----------
s['motion']['initial'] = {'height': 43.5, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}
clips = {c['id']: c for c in s['motion']['clips']}
FOLD = dict(start=1.0, duration=10.0, ramp=0.6)
ROLL = dict(start=6.0, duration=9.4, ramp=1.2)
ft, tilt_v = trapezoid(65, FOLD['duration'], FOLD['ramp'])
fz, roll_v = trapezoid(95, ROLL['duration'], ROLL['ramp'])
clips['builtin-tilt-0'].update(start=FOLD['start'], duration=FOLD['duration'], easing='linear', target=65, label='Fold to 65°',
                               path=path(FOLD['duration'], lambda v: {'tilt': v}, ft))
clips['storage-roll'].update(start=ROLL['start'], duration=ROLL['duration'], easing='linear', target={'x': 0, 'z': 95, 'yaw': 0},
                             label='Roll to the wall', path=path(ROLL['duration'], lambda v: {'x': 0, 'z': v, 'yaw': 0}, fz))
assert tilt_v <= 7 and roll_v <= 12.05, (tilt_v, roll_v)

# ---------- status light (M5) ----------
s['ledStatus'] = [{'at': FOLD['start'], 'dur': ROLL['start'] - FOLD['start'], 'kind': 'tilt-retract'},
                  {'at': ROLL['start'], 'dur': ROLL['duration'], 'kind': 'wheels', 'mode': 3}]
# At glow .15 the purple barely reaches the wall; a state-only fill (off at rest, so the regular look stays neutral).
s['ledFill'] = {'intensity': 4}

# ---------- lighting (lighting MUST 3) ----------
s['ledColor'] = '#fff1dc'; s['ledGlow'] = 0.15
s['ledSurfaces'] = {'floorStrength': 90, 'desktopStrength': 80}

# ---------- staging (settings_education MUST 1, SHOULD 3, NICE 4; cinematography 10) ----------
WHEELCHAIR = (-8.2976, -12.8236)               # authored world position (room [8500, -5500], turn 90: parked in the window corner)
WC_TO = (-6.75, -11.05)                        # out on the aisle, off the wall
WC_TURN = -165                                 # turned out of the corner: faces down the hall toward the exit (+x), 3/4 to camera
LEAP = (-3.0022, -10.6783)                     # authored: the desk's own task chair, in the roll path
LEAP_TO = room(4000, 1600)                     # the project table's open end (table l1, room x 4300-6700), out of frame
stage = [{'match': '^Prop:electric-wheelchair$', 'position': [round(WC_TO[0] - WHEELCHAIR[0], 4), 0, round(WC_TO[1] - WHEELCHAIR[1], 4)],
          'rotation': [0, WC_TURN, 0]},
         {'match': '^Prop:steelcase-leap-v2$', 'position': [round(LEAP_TO[0] - LEAP[0], 4), 0, round(LEAP_TO[1] - LEAP[1], 4)]},
         # The project-table chair (room [6100, 500]) that sat bottom-right through the parked beat.
         {'match': '^Oak study chair · forest$', 'near': [0.7456, -9.2028, 0.3], 'hide': True}]
# hide, and scale to nothing: the desk-object phase pass can set .visible again on some items (laptop, headphones).
stage += [{'match': m, 'hide': True, 'scale': 1e-4} for m in ('^Prop:kenney-furniture-laptop$', '^Workspace notebook$', '^Prop:ergoflex-mx-master-mouse$',
                                              '^Mouse pad$', '^Accessory:ergo-keyboard$', '^Prop:headphones$')]
s['sceneEdits'] = stage + [e for e in s.get('sceneEdits', []) if 'lightType' in e]   # room lights: build-round4-lighting.py
s.pop('deskObjects', None)

# ---------- camera (cinematography 6) ----------
keys = s['cameraPlan']['keys']
k = next((x for x in keys if round(x['at'], 2) in (13.5, 14.3)), None)
k['at'] = 14.3
keys.sort(key=lambda x: x['at'])

# ---------- monitor: storage-mode steps from the clips, then sleep (NICE 4) ----------
f = J('shots', '12.json'); json.dump(s, open(f, 'w'), indent=1, ensure_ascii=False)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
clip = os.path.join(d, 'screens', '11-main.mp4')
scene = os.path.join(root, 'tools/experience/screens/scenes/ch11.js')
stamp = json.dumps([s['seconds'], s['motion'], open(scene).read()], sort_keys=True)
if not os.path.exists(clip) or not os.path.exists(clip + '.stamp') or open(clip + '.stamp').read() != stamp:   # re-capture only when its inputs change
    subprocess.run(['node', os.path.join(root, 'tools/experience/screens/capture.mjs'), '11-main'], check=True, stdout=subprocess.DEVNULL,
                   env={**os.environ, 'CAPTURE_SHOT': os.path.abspath(f), 'CAPTURE_OUT': os.path.abspath(os.path.dirname(clip))})
    open(clip + '.stamp', 'w').write(stamp)
s = json.load(open(f))
s['screens'] = [{'target': 'main-landscape', 'src': os.path.relpath(clip, root)}]
json.dump(s, open(f, 'w'), indent=1, ensure_ascii=False)
cut['shots'][i] = s
json.dump(cut, open(J('review-cut.json'), 'w'))
print(f'storage: fold {FOLD["start"]}-{FOLD["start"] + FOLD["duration"]} s ({tilt_v:.2f} deg/s) | roll {ROLL["start"]}-{ROLL["start"] + ROLL["duration"]} s '
      f'({roll_v:.2f} in/s) | led #fff1dc .15 + status | desktop cleared, wheelchair to the aisle, Leap to table l1 | cam 13.5->14.3 | screen {s["screens"][0]["src"]}')
