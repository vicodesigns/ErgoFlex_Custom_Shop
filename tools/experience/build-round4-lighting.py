#!/usr/bin/env python3
"""Round 4 (HQ9) lighting for ch 2, 3 and 12, from the lighting review.

    python3 tools/experience/build-round4-lighting.py exports/cinematic-intro-20261103-hq9

Direction: /home/ergo/logs/lighting_review_round4_2026-11-03.md (sections 2, 4, 6). The render never
plays the app's movement lights (bakeDraw skips ledMotion), so the lift and tilt light is given as
ledStatus events matching the motion clips; ledFill adds a point light at the desk in the state's
colour so the accessories (drafting board, paper, easel) and the room catch it too.
Edits review-cut.json, grade.json and shots/02.json, 03.json, 12.json in place (idempotent).
"""
import json, os, sys
d = sys.argv[1]
cut = json.load(open(os.path.join(d, 'review-cut.json'))); grade = json.load(open(os.path.join(d, 'grade.json')))
by = {s['id']: s for s in cut['shots']}

# Ch 2 rise: the app's blue lift wavefront on both rises, readable in daylight; rest white at ~22 %.
s = by['rise']
s['ledStatus'] = [{'at': 1.6, 'dur': 4.8, 'kind': 'lift-up', 'fade': 0.6}, {'at': 7.4, 'dur': 3.2, 'kind': 'lift-up', 'fade': 1.0}]
s['ledGlow'] = 0.75; s['ledColor'] = '#808080'; s['ledFill'] = {'intensity': 6}
s['ledSurfaces'] = {'desktopStrength': 180, 'desktopReach': 100, 'desktopWidth': 30, 'shelfStrength': 190, 'topStrength': 160,
                    'baseStrength': 110, 'floorStrength': 180, 'floorReach': 70, 'floorWidth': 90, 'floorSharpness': 20,
                    'leftWingStrength': 140, 'rightWingStrength': 140}
for sc in s['screens']:
    if sc['target'] == 'tablet': sc['offset'] = 2.0; sc['loop'] = False   # the tablet's lifts ran ~2 s behind the desk's

# Ch 3 create: the board steepens (12 -> 25 -> 45 deg). Vico (round 5): on the real desk steepening is the tilt DOWN, purple;
# back toward flat is yellow-green. So each tilt clip takes its colour from its direction (the Custom Shop mapping).
s = by['create']
def tilt_status(motion):
    a, out = motion['initial'].get('tilt', 0), []
    for c in sorted((c for c in motion['clips'] if c['lane'] == 'tilt'), key=lambda c: c['start']):
        out.append({'at': c['start'], 'dur': c['duration'], 'kind': 'tilt-retract' if c['target'] > a else 'tilt-extend'}); a = c['target']
    return out
s['ledStatus'] = tilt_status(s['motion'])
s['ledGlow'] = 0.9; s['ledColor'] = '#808080'; s['ledFill'] = {'intensity': 6}
s['ledSurfaces'] = {'desktopStrength': 200, 'desktopReach': 100, 'desktopWidth': 40, 'desktopCone': 100, 'shelfStrength': 200,
                    'topStrength': 180, 'baseStrength': 120, 'floorStrength': 190, 'floorReach': 80, 'floorWidth': 100,
                    'leftWingStrength': 170, 'rightWingStrength': 170}

# Ch 12 storage: a working library at night. Room lights carry it, the desk LED (stage cyan) is an accent.
s = by['storage']
s.pop('ledColor', None); s['ledGlow'] = 0.25; s['ledSurfaces'] = {'floorStrength': 90, 'desktopStrength': 80}
s['sceneEdits'] = [e for e in s['sceneEdits'] if 'lightType' not in e] + [
    {'lightType': '.', 'path': '^Room:', 'intensity': 2.2}, {'lightType': 'HemisphereLight', 'intensity': 1.5},
    {'lightType': 'DirectionalLight', 'intensity': 1.5}]
s['sceneGlobals'] = {'environmentScale': 1.5, 'exposure': 1.14}
grade['storage'] = {'temp': 0.03, 'gamma': 1.04, 'saturation': 0.95}

for n, key in (('02', 'rise'), ('03', 'create'), ('12', 'storage')): json.dump(by[key], open(os.path.join(d, 'shots', n + '.json'), 'w'), indent=1)
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w')); json.dump(grade, open(os.path.join(d, 'grade.json'), 'w'), indent=1)
print('ch2 lift light, ch3 tilt light (', len(by['create']['ledStatus']), 'events), ch12 working-library light')
