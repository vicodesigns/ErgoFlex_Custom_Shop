#!/usr/bin/env python3
"""The commons chapter's story (chapter 4, 16 s) in "Vico's cut with people", in place:

    python exports/cinematic-intro-20261110-people/build-commons-story.py

Rewrites the shot "commons" of this folder's review-cut.json (and nothing else). Run again after
tools/experience/build-alt-cut.py --variant people rebuilds the cut (it would bring back the earlier story). Then carry
the chapter into the Cinematographer's cut: exports/cinematic-intro-cut-cine/build-cine-cut.py (it copies the
non-camera fields of this chapter and re-shoots it), and check it with its check-camera-only.py.

The story, second by second (stage units as --list-objects prints them; the room's millimetres are W(x, y, z) =
(z, y, -x) / 662.84):
  0-3.8    bird's-eye over the whole commons at the end of the night; the light runs from late study to morning
           (timeOfDay) and the desk's screen clock races from 5:40 to 8:00 (screens/04-reservation.mp4): Yara,
           standing at the desk (43.5 in), has it booked until 8:00
  0-4.6    the camera swoops down from the bird's-eye to the desk and Yara (new keys)
  4.6-6.0  time is up: Yara takes her bag (the backpack on the desk's base shelf goes as the one she wears appears, during
           her change of posture from typing to walking: room-people.mjs pairUp) and turns away
  6.0-     she walks off across the commons (walk path, clear of the task chair on the carpet and the tables' chairs) and
           stands at the far tables, out of the later frames
  6.2-8.2  the desk lowers to 32 in, Mia's preset (the screen: "Mia's turn")
  6.8-13.4 it drives itself along the cork wall to the head of the project table (his drive, re-timed) where Mia, who booked
           it from the team table, waits in her red power wheelchair with her phone; she types once it is there
  8.6-16   his camera keys (whole desk on the drive, track right toward the table, the group, the wheelchair whole)
Mia sits in the room's red power wheelchair (Prop:electric-wheelchair, moved under her and facing the desk) in postures
built on it: people-mia-power-phone and people-mia-power-type (tools/people/cast.py), feet on its footplate.
"""
import json, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CUT = os.path.join(HERE, 'review-cut.json')
SPLINE = os.path.join(ROOT, 'tools', 'experience', 'camera-spline.mjs')
K = 1 / 662.84


def room(x, z):
    """Stage x, z to the Humboldt room's millimetres [x, z]."""
    return [round(-z / K), round(x / K)]


def key(at, eye, look, fov, label):
    return dict(at=at, position=list(eye), target=list(look), fov=fov, label=label)


def commons(s):
    m = s['motion']
    m['initial']['height'] = 43.5                                   # Yara works standing (stand-type: 43.5 in)
    for c in m['clips']:
        if c['lane'] == 'lift': c['start'], c['duration'], c['target'] = 6.2, 2.0, 32    # down to Mia's preset
        if c['lane'] == 'wheels': c['start'], c['duration'] = 6.8, 6.6                  # his path, 13.4 s arrival kept
    s['ledStatus'] = [{'at': 6.8, 'dur': 1.947, 'kind': 'wheels', 'mode': 6}, {'at': 8.747, 'dur': 4.653, 'kind': 'wheels', 'mode': 3}]
    s['timeOfDay'] = [{'at': -1, 'mode': 'night'}, {'at': 0.2, 'mode': 'night'}, {'at': 3.8, 'mode': 'morning', 'ease': 'smooth'}]
    edits = [e for e in s['sceneEdits'] if e.get('match') not in ('^Prop:backpack-leather$', '^Prop:backpack-daypack$')]
    for e in edits:
        # the red power wheelchair under Mia, facing the desk (its model points -x: no turn needed)
        if e.get('match') == '^Prop:electric-wheelchair$': e['position'] = [-1.855, 0, 0.9805]
    s['sceneEdits'] = edits + [{'match': '^Prop:backpack-daypack$', 'opacity': [[0, 1], [5.1, 1], [5.4, 0]]}]   # Yara takes it
    s['accessories'] = {'add': [{'id': 'backpack-daypack', 'role': 'base-shelf', 'x': -280, 'z': 0, 'rotation': 15}]}   # (the colour of the one she wears)
    s['screens'][0].update({'src': 'exports/cinematic-intro-20261110-people/screens/04-reservation.mp4', 'offset': 0, 'loop': False})
    p = s['people']
    start = room(-2.50, -10.907)                                    # in front of the keyboard (415 mm), facing the desk
    path = [start, room(-3.7, -10.3), room(-4.6, -8.4), room(-5.2, -6.4), room(-5.3, -4.0), room(-5.4, -2.0)]
    cast = [c for c in p['cast'] if not c['key'].startswith('yara-')]
    for c in cast:
        if c['key'] in ('mia-waits', 'mia-works'):
            for k in ('at', 'y'): c.pop(k, None)
            c['id'] = {'mia-waits': 'people-mia-power-phone', 'mia-works': 'people-mia-power-type'}[c['key']]
            c.update({'on': 'electric-wheelchair', 'seat': 470, 'turn': 90, 'depth': -40})
    p['cast'] = [{'key': 'yara-works', 'id': 'people-yara-stand-type', 'at': start, 'turn': 90},
                 {'key': 'yara-leaves', 'id': 'people-yara-walk', 'at': start, 'turn': 90,
                  'walk': {'path': path, 'start': 6.0, 'then': 'people-yara-stand-wait'}}] + cast
    p['when'] = {'yara-works': [[0, 5.3, 0, 0.5]], 'yara-leaves': [[5.3, 99, 0.5, 0]],
                 'mia-waits': [[0, 13.1, 0, 0.5]], 'mia-works': [[12.6, 99, 0.5, 0]]}
    his = {k['at']: k for k in s['cameraPlan']['keys']}
    keys = [key(0, (3.0, 21, -5.6), (3.0, 0, -5.85), 40, "Bird's-eye: the whole commons as the night runs out"),
            key(1.6, (2.4, 18, -5.8), (1.9, 0, -6.6), 40, 'High over the commons, the light coming up'),
            key(3.1, (0.5, 8.5, -5.0), (-2.2, 0.9, -11.0), 44, 'Swooping down toward the desk'),
            key(4.6, (-0.6, 2.4, -8.0), (-2.5, 1.3, -11.9), 44, 'Yara at the desk, her booking running out'),
            key(6.6, (0.0, 2.7, -7.2), (-2.2, 1.1, -11.8), 46, 'She takes her bag and goes; the desk lowers for Mia')]
    keys += [dict(his[t]) for t in (8.6, 10.8, 13.4, 16.0)]      # his, unchanged
    plan = {k: v for k, v in s['cameraPlan'].items() if k != 'keys'}
    s['cameraPlan'] = {**plan, 'keys': keys}
    fd, name = tempfile.mkstemp(suffix='.json'); os.close(fd)
    with open(name, 'w', newline='\n') as f: json.dump({'seconds': s['seconds'], 'cameraPlan': s['cameraPlan']}, f)
    subprocess.run(['node', SPLINE, name], check=True, stdout=subprocess.DEVNULL)
    with open(name, encoding='utf-8') as f: s['camera'] = json.load(f)['camera']
    os.unlink(name)


def main():
    with open(CUT, 'rb') as f: raw = f.read()
    cut = json.loads(raw)
    commons(next(s for s in cut['shots'] if s['id'] == 'commons'))
    out = json.dumps(cut, indent=1).encode()                       # the cut's style: one-space indent, LF, no final newline
    if out != raw.replace(b'\r\n', b'\n'):
        with open(CUT, 'wb') as f: f.write(out)
    print('commons story written:', CUT)


if __name__ == '__main__':
    main()
