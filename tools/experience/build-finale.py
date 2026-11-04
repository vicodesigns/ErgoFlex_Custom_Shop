#!/usr/bin/env python3
"""Chapter 13 ('hero') as the finale: the desk changes through the shop's presets (HQ8).

    python3 tools/experience/build-finale.py exports/cinematic-intro-20261103-hq8

Writes <dir>/shots/13.json and <dir>/shots/13-subshots.json (six copies of the chapter
that share one camera path, one pose and one light rig, and differ only in preset and
renderRange), and sets the chapter to 23 s in review-cut.json. join-subshots.py
--transition smoothleft joins them with 0.7 s soft wipes centred on the bar lines
(bar 2.07 s, lines at 0.75 + 2.07 n); the orbit drifts the desk right to left, so the
edge travels with it.

  A gaming  0.00-3.17   B office 2.47-5.24   C artist 4.54-7.31
  D occ     6.61-9.39   E hbhs   8.69-11.46  F gaming 10.76-23.00, holds to the end

Order and timing: /home/ergo/logs/finale_and_film_direction_2026-11-03.md (B). The EDL
(23 s, total 197.0, end card 191.32) and the title times are set by hand in the folder.
Render with post/finale-seed.json (tools/studio-state/derive-seed.mjs --zero-preset-poses): the
saved office and OCC builds carry their own desk pose (office yaw 29 deg), which would jump
inside a wipe.
"""
import json, os, subprocess, sys, copy
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 23
LOOKS = [('A', 'gaming', 0.00, 3.17), ('B', 'office', 2.47, 5.24), ('C', 'artist', 4.54, 7.31),
         ('D', 'occ', 6.61, 9.39), ('E', 'hbhs', 8.69, 11.46), ('F', 'gaming', 10.76, 23.00)]

def key(at, pos, tgt, fov=26, label=None):
    k = {'at': at, 'position': pos, 'target': tgt, 'fov': fov}
    if label: k['label'] = label
    return k

# 37 -> 57 deg in 11.5 s (1.7 deg/s): less parallax, cleaner wipes; at 1.8 m the desktop,
# keyboard and mouse stay readable through the changes.
camera = {'easeIn': False, 'easeOut': True, 'keys': [
    key(0.0, [4.5, 2.05, 8.3], [-1.276, 1.2, 0.744], label='Reverent orbit'),
    key(5.8, [6.2, 1.95, 7.2], [-0.828, 1.099, 0.705]),
    key(11.5, [7.6, 1.8, 5.9], [-0.387, 1.0, 0.667], label='Back on black and red'),
    key(16.2, [8.6, 1.2, 6.2], [-0.1, 0.7, 0.35]),
    key(19.9, [9.9, 0.6, 6.6], [0.14, 0.4, 0], label='Push out for the end card'),
    key(23.0, [10.6, 0.42, 6.9], [0.14, 0.3, 0], label='Settle')]}

cut = json.load(open(os.path.join(d, 'review-cut.json')))
i13 = next(i for i, s in enumerate(cut['shots']) if s['id'] == 'hero')
old = cut['shots'][i13]
shot = copy.deepcopy(old)
shot.update(seconds=SECONDS, cameraPlan=camera,
            motion={'version': 2, 'initial': {'height': 30, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, 'clips': []},
            # The black frame sank into the background (HQ7 177.5, 185): stronger rims and pool.
            lights=[{'preset': 'productRig', 'scale': 1, 'rimLeft': {'intensity': 260}, 'rimRight': {'intensity': 260}, 'pool': {'strength': 0.4}}])
edits = [e for e in shot['sceneEdits'] if e['match'] not in ('@grid', '@pulse')]
shot['sceneEdits'] = edits + [{'match': '@grid', 'opacity': [[0, 0.35], [11.5, 0.25], [16, 0]], 'radialFade': [3, 8]},
                              {'match': '@pulse', 'opacity': [[0, 1], [11.5, 0.6], [16, 0]]}]
f = os.path.join(d, 'shots', '13-tmp.json'); json.dump(shot, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
shot = json.load(open(f)); os.remove(f)
subs = [dict(copy.deepcopy(shot), preset=p, renderRange=[t0, t1], subshot=n) for n, p, t0, t1 in LOOKS]
# The artist build is saved at its 65 deg start tilt; at tilt 0 its shelf organizer lands under
# the floor and shows as a loose box in front of the desk, so it sits this look out.
for x in subs:
    if x['preset'] == 'artist':   # the app re-shows it, so also drop it far under the floor
        x['sceneEdits'] = x['sceneEdits'] + [{'match': 'shelf-organizer|^Organizer ', 'hide': True}, {'match': '^Accessory:shelf-organizer$', 'position': [0, -20, 0]}]
json.dump({'name': 'HQ8 finale sub-shots', 'shots': subs}, open(os.path.join(d, 'shots', '13-subshots.json'), 'w'))
# The cut keeps one shot for the chapter (F, the black-and-red title shot) so review tools still read it.
main = copy.deepcopy(subs[-1]); main.pop('renderRange'); main.pop('subshot')
main['subshots'] = {n: [t0, t1] for n, _, t0, t1 in LOOKS}; main['presets'] = [p for _, p, _, _ in LOOKS]
json.dump(main, open(os.path.join(d, 'shots', '13.json'), 'w'), indent=1)
cut['shots'][i13] = main
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
print('finale:', ' > '.join(f'{p} {t0}-{t1}' for _, p, t0, t1 in LOOKS))
