#!/usr/bin/env python3
"""HQ36 (Vico, 2026-11-05): new rooms for two chapters, run FIRST in the chain (every later builder keys on the id).

    flock /tmp/claude-1000/hq14-cut.lock python3 tools/experience/build-round8-rooms.py exports/cinematic-intro-20261104-hq14

- media (ch 10): "use a music studio for when we're showing the movie ... show the movie in the large screen like it is on
  the video game", and after HQ34 "make that screen the same size as the one for the video games ... and center it":
  the music studio, the 'music' preset desk with the gaming chapter's single centred ultrawide on one arm, the movie on
  it (picture-driven LEDs, ledMode 'media'), the wide-studio camera (scout option 2).
- storage (ch 11): "use a different setting for the storage mode ... we already showed the library in two different
  chapters"; Vico left the pick to us: the garage workshop (scout option 3: the desk folds and rolls sideways to the
  window wall, the concrete floor left clear).
The shot is tools/experience/film-rooms/<id>.json (a full shot); title / detail / transition stay the cut's. Values are
absolute, so re-running is safe. Written into review-cut.json and the chapter's shots/NN.json.
"""
import glob, json, os, sys

if len(sys.argv) != 2: sys.exit(__doc__)
H = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
KEEP = ('title', 'detail', 'transition')


def room(cur):
    p = os.path.join(HERE, 'film-rooms', cur['id'] + '.json')
    if not os.path.exists(p): return cur
    new = json.load(open(p))
    for k in KEEP:
        if k in cur: new[k] = cur[k]
    new['id'] = cur['id']
    return new


cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
cut['shots'] = [room(s) for s in cut['shots']]
json.dump(cut, open(cut_path, 'w'), indent=1)
done = []
for f in sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json'))):
    d = json.load(open(f))
    if d.get('id') in ('media', 'storage') and 'shots' not in d:
        new = room(d)
        if new is not d: json.dump(new, open(f, 'w'), indent=1); done.append(f'{d["id"]} -> {os.path.basename(f)}')
print('rooms:', ', '.join(f'{s["id"]} in {s["room"]}' for s in cut['shots'] if s['id'] in ('media', 'storage')), '|', ', '.join(done))
