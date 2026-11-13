#!/usr/bin/env python3
"""Cinematographer's cut: Vico's cut with people, re-shot. Camera only.

    python tools/experience/../../exports/cinematic-intro-cut-cine/build-cine-cut.py [--only id,id]

Rewrites `cameraPlan` and `camera` of chosen chapters in this folder's review-cut.json, in place, and nothing else:
every other field (seconds, motion, titles, people, props, light, time of day) stays exactly as it came from
"Vico's cut with people" (exports/cinematic-intro-20261110-people), so each chapter still replaces the same chapter
of his cut one for one. His cut is only read, for the story keys reused from his cameras.

Story keys here are in stage (world) units, the ones --list-screens / --list-objects print: about 0.0384 per inch,
y up. In the rooms, the room's own millimetres map as W(x, y, z) = (z, y, -x) / 662.84 (build-alt-cut.py).
camera-spline.mjs turns the story keys into the dense path (`camera.keys`).
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CUT = os.path.join(HERE, 'review-cut.json')
HIS = os.path.join(ROOT, 'exports', 'cinematic-intro-20261110-people', 'review-cut.json')
SPLINE = os.path.join(ROOT, 'tools', 'experience', 'camera-spline.mjs')
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
K = 1 / 662.84


def W(x, y, z):
    """Room millimetres to stage units."""
    return [round(K * z, 4), round(K * y, 4), round(-K * x, 4)]


def key(at, eye, look, fov, label, **more):
    """A story key in stage units: camera at `eye`, aimed at `look`, `fov` degrees vertical."""
    return dict(at=at, position=[round(v, 4) for v in eye], target=[round(v, 4) for v in look], fov=fov, label=label, **more)


def his(shot_id, *times):
    """His story keys at these seconds, unchanged (copied, labels kept)."""
    keys = HIS_SHOTS[shot_id]['cameraPlan']['keys']
    out = []
    for t in times:
        hit = [k for k in keys if abs(k['at'] - t) < 1e-3]
        if not hit: sys.exit('%s: no camera key of his at %s s' % (shot_id, t))
        out.append(dict(hit[0]))
    return out


def cam(shot, keys, ease_in=False, ease_out=False):
    """Replace the chapter's story keys and spline them into camera.keys (other plan options such as samples kept)."""
    plan = {k: v for k, v in shot['cameraPlan'].items() if k not in ('keys', 'easeIn', 'easeOut')}
    shot['cameraPlan'] = {'easeIn': ease_in, 'easeOut': ease_out, **plan, 'keys': sorted(keys, key=lambda k: k['at'])}
    fd, name = tempfile.mkstemp(suffix='.json'); os.close(fd)
    with open(name, 'w', newline='\n') as f: json.dump({'seconds': shot['seconds'], 'cameraPlan': shot['cameraPlan']}, f)
    subprocess.run(['node', SPLINE, name], check=True, stdout=subprocess.DEVNULL)
    with open(name, encoding='utf-8') as f: shot['camera'] = json.load(f)['camera']
    os.unlink(name)


CHAPTERS = {}
def chapter(fn): CHAPTERS[fn.__name__] = fn; return fn


@chapter
def awaken(s):
    # Product opener on the dark stage. His wheel macro and pull-back to the waking desk stay (0-7.4 s). Then each
    # move gets the one angle that reads it: the lift from low (the desktop climbs against the dark), the tilt to
    # 65 degrees in profile (the angle is a line on the frame), the 100 degree turn from above (a turn on the floor
    # ring), then his front three-quarter for the level-and-lower and his roll to the lens into the dissolve.
    # The desk's front (user side) faces +x until the turn, about +z after it.
    # Desk centre after the first roll: about (0.5, 0, 0.15).
    cam(s, his('awaken', 0, 1.8, 2, 4.4, 5.3, 6.2, 6.9, 7.4) + [
        key(9.25, (5.0, 1.4, 3.95), (0.5, 1.15, 0.15), 33, 'Lift starts: down toward the floor'),
        key(11.2, (5.0, 0.45, 3.75), (0.5, 1.22, 0.15), 35, 'Low three-quarter: the desktop climbs (blue)'),
        key(16.1, (4.6, 0.4, 3.5), (0.5, 1.42, 0.15), 35, 'Low, easing in: standing height'),
        key(18.5, (2.7, 1.3, 5.5), (0.5, 1.4, 0.15), 32, 'Side three-quarter: the board will tilt'),
        key(24.6, (2.45, 1.5, 5.05), (0.5, 1.45, 0.15), 33.5, 'Side three-quarter: 65 degrees, raised (purple)'),
        key(26.6, (4.4, 5.3, 4.3), (0.45, 1.35, 0.3), 37, 'Up and over: the turn starts'),
        key(31.25, (1.4, 5.6, 6.0), (0.45, 1.35, 0.4), 37, 'From above: the desk turns on its ring'),
    ] + his('awaken', 35.85, 37.2, 40.2, 42.5, 44.85), ease_in=True)


@chapter
def rise(s):
    # Home, 08:00 to 17:30. The desk (centre about (-0.67, 0, 0.25)) faces +x; the window is behind it, Maya stands
    # in front of it at x 0.6 with her chair on her right (-z), the armchair front left. His camera flew up and back
    # while the desk rose and then looked at Maya's back while it moved, so her body hid the column and the legs.
    # Here: his phone-and-notes macro, then one pull-back along the desk's length into a profile, so Maya and the
    # rising column stand side by side against the clock wall; an arc to the front three-quarter while it lowers,
    # window behind her; and a slow widening into the evening room, a calm frame for the dissolve.
    cam(s, his('rise', 0, 2) + [
        key(4.3, (0.55, 1.55, 3.3), (-0.25, 1.12, 0.25), 49, 'Back along the desk: Maya on her feet, the desk rises'),
        key(7.6, (0.6, 1.7, 3.28), (-0.25, 1.33, 0.25), 53, 'Profile: standing height, the clock wall behind'),
        key(9.45, (0.75, 1.69, 3.25), (-0.22, 1.32, 0.22), 53, 'Profile: midday, it starts down'),
        key(12.65, (2.3, 1.35, 2.75), (-0.4, 1.15, 0.12), 46, 'Front three-quarter: seated again, the window behind'),
        key(18, (3.4, 1.75, 3.05), (-0.7, 1.15, 0.0), 46, 'Evening: the whole room'),
    ])


@chapter
def create(s):
    # Artist studio. The desk (centre about (-1.37, 0, 0.31)) faces +x with the stool and palette in front of it;
    # Lin throws pots at the wheel at (2.4, 0, 2.1), the Leap chair and the coffee table between. His opening flew
    # over Lin's head (her head cut by the frame corner for three seconds) and he watched the drafting tilt from a
    # close low angle that stretched the board. Here: Lin whole at the left of a deep frame, the desk waiting at the
    # back; a glide past her side to the desk's front three-quarter for the lift; an arc to the side three-quarter
    # while the board tilts, so the 40 degree drafting angle is a clean line against the wall; and back round to
    # the front as the board goes on to the painting, desk, screens and stool whole for the dissolve.
    cam(s, [
        key(0, (6.1, 1.85, 1.95), (0.0, 1.25, 1.85), 40, 'Lin at the wheel, the desk at the back of the studio'),
        key(2.6, (4.3, 1.85, 0.65), (-1.2, 1.45, 0.35), 42, 'Past her, toward the desk'),
        key(4.2, (3.5, 1.95, -0.6), (-1.37, 1.45, 0.31), 45, 'Front three-quarter: the lift to 52 in'),
        key(6.8, (3.1, 2.1, -1.45), (-1.37, 1.6, 0.31), 45, 'Up with it; the arc begins'),
        key(12.4, (1.1, 2.0, -3.1), (-1.37, 1.6, 0.31), 47, 'Side three-quarter: the board tilts to drafting'),
        key(16.9, (1.3, 2.0, -2.95), (-1.37, 1.6, 0.31), 47, 'Drafting at 40 degrees'),
        key(19.5, (3.15, 2.05, 0.35), (-1.37, 1.6, 0.31), 42, 'Round to the front: the painting'),
        key(23.5, (2.9, 2.0, 0.35), (-1.37, 1.6, 0.31), 41, 'The painting, settled'),
    ])


def main():
    global HIS_SHOTS
    with open(HIS, encoding='utf-8') as f: HIS_SHOTS = {s['id']: s for s in json.load(f)['shots']}
    with open(CUT, 'rb') as f: raw = f.read()
    cut = json.loads(raw)
    for shot in cut['shots']:
        fn = CHAPTERS.get(shot['id'])
        if fn and (not ONLY or shot['id'] in ONLY): fn(shot)
    out = json.dumps(cut, indent=1).encode()                   # the cut's own style: one-space indent, LF, no final newline
    if out != raw:
        with open(CUT, 'wb') as f: f.write(out)
    print('cine cut:', CUT, 'chapters re-shot:', [k for k in CHAPTERS if not ONLY or k in ONLY])


if __name__ == '__main__':
    main()
