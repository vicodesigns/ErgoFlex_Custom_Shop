#!/usr/bin/env python3
"""Author the 'status' chapter (safety status indicator) and insert it into a cut.

    python3 tools/experience/build-status-chapter.py exports/cinematic-intro-20261103 exports/cinematic-intro-20261103-hq6

Reads <src>/review-cut.json, writes <dst>/shots/06.json (with camera compiled by
camera-spline.mjs) and <dst>/review-cut.json with the chapter at index 5, after
'coast'. Light and sound references (real app behaviour, read-only):
  led_status_indicator_service.go / ergoled_native_anim.go in the main API repo:
  lift up blue 0,0,255, lift down red 255,0,0 (FX34 wavefront), target reached
  solid green 0,255,0, wheels comet travel red with caution amber (drive modes 1-10),
  collision latched breathing red. film-status.mjs plays them with the app's own
  led-movement.mjs sampler.
"""
import json, os, subprocess, sys, copy
src, dst = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cut = json.load(open(os.path.join(src, 'review-cut.json')))
ch12 = next(s for s in cut['shots'] if s['id'] == 'hero')

def clip(id, lane, kind, start, dur, easing='linear', label='', **kw):
    d = {'id': id, 'lane': lane, 'kind': kind, 'start': start, 'duration': dur, 'easing': easing, 'label': label}; d.update(kw); return d

clips = [clip('st-lift-up', 'lift', 'lift', 0.8, 2.2, label='Lift up', target=46),
         clip('st-lift-down', 'lift', 'lift', 4.2, 1.7, label='Lift down', target=32)]
# A closed ring of the 8 drive directions (director x, z in inches; director +z is the desk's forward,
# director +x is the app's strafe left) with the app's wheel drive mode for each step.
ring = [(0, 6, 3, 'forward'), (-6, 12, 9, 'right-forward'), (-12, 12, 2, 'strafe right'), (-18, 6, 10, 'right-back'),
        (-18, 0, 4, 'back'), (-12, -6, 8, 'left-back'), (-6, -6, 1, 'strafe left'), (0, 0, 7, 'left-forward')]
status = [{'at': 0.8, 'dur': 2.2, 'kind': 'lift-up'}, {'at': 3.0, 'dur': 0.9, 'kind': 'target'}, {'at': 4.2, 'dur': 1.7, 'kind': 'lift-down'}]
for i, (x, z, mode, name) in enumerate(ring):
    st = round(6.0 + i * 0.45, 2)
    clips.append(clip(f'st-ring-{i}', 'wheels', 'pose', st, 0.45, label='Move ' + name, target={'x': x, 'z': z, 'yaw': 0}))
    status.append({'at': st, 'dur': 0.45, 'kind': 'wheels', 'mode': mode})
clips.append(clip('st-turn', 'wheels', 'rotate', 9.7, 1.3, 'smooth', 'Turn', value=360, direction='right'))
status.append({'at': 9.7, 'dur': 1.3, 'kind': 'wheels', 'mode': 6})
clips.append(clip('st-approach', 'wheels', 'travel', 11.2, 1.0, 'linear', 'Approach the obstacle', value=14, direction='forward'))
status.append({'at': 11.2, 'dur': 1.0, 'kind': 'wheels', 'mode': 3})
status.append({'at': 12.2, 'dur': 2.4, 'kind': 'collision'})
clips.append(clip('st-recover', 'wheels', 'travel', 14.8, 1.0, 'smooth', 'Back away', value=6, direction='backward'))
status.append({'at': 14.8, 'dur': 1.0, 'kind': 'wheels', 'mode': 4})

camera = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'status-camera.json')))
shot = {'id': 'status', 'room': 'product', 'kind': 'glide', 'seconds': 16, 'title': 'Know what your desk is doing.',
        'detail': 'Blue rises. Red lowers. Amber warns. Green arrives.', 'preset': 'gaming', 'transition': 1.1, 'size': '60x30',
        'lights': [{'preset': 'productRig', 'scale': 1}],
        'motion': {'version': 2, 'initial': {'height': 28, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips},
        'ledGlow': 1, 'ledSurfaces': {'desktopStrength': 35, 'floorStrength': 160, 'baseStrength': 120},
        'ledStatus': status,
        # Travel is 14 in x 0.0383 = 0.536 scene units; the pylon starts 0.556 ahead of the base's front, a 2 cm gap at the stop.
        'obstacles': [{'x': 0, 'ahead': 0.556, 'from': 'base', 'radius': 0.09, 'height': 0.55, 'rise': [9.2, 10.1]}],
        'cameraPlan': camera,
        'sceneEdits': copy.deepcopy([e for e in ch12['sceneEdits'] if e.get('match', '').startswith('^Wheel')])}
os.makedirs(os.path.join(dst, 'shots'), exist_ok=True)
f = os.path.join(dst, 'shots', '06.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True)
shot = json.load(open(f))
shots = [s for s in cut['shots'] if s['id'] != 'status']; shots.insert(5, shot); cut['shots'] = shots
json.dump(cut, open(os.path.join(dst, 'review-cut.json'), 'w'))
print('cut:', [s['id'] for s in shots])

# ---- EDL, titles and grade with the chapter inserted after 'coast' ----------
SECONDS = 16
edl = json.load(open(os.path.join(src, 'edl.json'))); X = edl['dissolve']
old = [c for c in edl['chapters'] if c['id'] != 'status']
pos = next(i for i, c in enumerate(old) if c['id'] == 'coast') + 1
durs = [(c['id'], c['duration']) for c in old]; durs.insert(pos, ('status', SECONDS))
chapters, t = [], 0.0
for i, (cid, d) in enumerate(durs):
    start = 0.0 if i == 0 else t - X
    chapters.append({'index': i + 1, 'id': cid, 'duration': d, 'start': round(start, 3), 'end': round(start + d, 3)}); t = start + d
shift = chapters[-1]['end'] - edl['total']
trans = [x for x in edl['transitions']]; trans.insert(pos, 0.8)   # coast -> status keeps its length; status -> oilers 0.8
edl.update(chapters=chapters, total=round(chapters[-1]['end'], 3), transitions=trans)
edl['beats'] = [dict(b, at=round(b['at'] + (shift if b['at'] > chapters[pos - 1]['end'] else 0), 3)) for b in edl['beats']]
json.dump(edl, open(os.path.join(dst, 'edl.json'), 'w'), indent=1)
titles = json.load(open(os.path.join(src, 'titles-src.json')))
titles['titles'] = [x for x in titles['titles'] if x['chapter'] != 'status']
at = next(i for i, x in enumerate(titles['titles']) if x['chapter'] == 'oilers')
titles['titles'].insert(at, {'chapter': 'status', 'rel_in': 1.6, 'rel_out': 7.2, 'eyebrow': 'STATUS', 'title': 'Know what your desk is doing.',
                             'detail': 'Blue rises. Red lowers. Amber warns. Green arrives.', 'scrim': '60'})
json.dump(titles, open(os.path.join(dst, 'titles-src.json'), 'w'), indent=1, ensure_ascii=False)
grade = json.load(open(os.path.join(src, 'grade.json'))); grade['status'] = {'gamma': 1.05, 'bloom': 0.1}
json.dump(grade, open(os.path.join(dst, 'grade.json'), 'w'), indent=1)
print('edl: total', edl['total'], 'status', chapters[pos]['start'], '-', chapters[pos]['end'], 'shift', round(shift, 3))
