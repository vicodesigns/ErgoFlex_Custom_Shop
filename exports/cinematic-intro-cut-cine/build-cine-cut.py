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
        key(9.25, (4.1, 1.3, 3.25), (0.5, 1.15, 0.15), 33, 'Lift starts: in and down toward the floor'),
        key(11.2, (4.0, 0.55, 3.1), (0.5, 1.25, 0.15), 36, 'Low three-quarter: the desktop climbs (blue)'),
        key(16.1, (3.95, 1.9, 3.05), (0.5, 1.68, 0.15), 39, 'Craning up with it: the desktop and its light, standing height'),
        key(18.5, (2.7, 1.3, 5.5), (0.5, 1.4, 0.15), 32, 'Side three-quarter: the board will tilt'),
        key(24.6, (2.45, 1.5, 5.05), (0.5, 1.45, 0.15), 33.5, 'Side three-quarter: 65 degrees, raised (purple)'),
        key(26.6, (3.2, 4.1, 3.1), (0.45, 1.6, 0.3), 38, 'Up and over: the turn starts'),
        key(31.25, (1.1, 4.3, 4.3), (0.45, 1.6, 0.4), 38, 'From above: the desk turns on its ring'),
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
        key(4.3, (1.55, 1.62, 2.5), (-0.6, 1.3, 0.35), 54, 'Back off the notes to the front three-quarter: Maya up, the readout climbs'),
        key(7.6, (1.6, 1.72, 2.5), (-0.6, 1.42, 0.35), 54, 'Standing height on the readout, Maya beside the column'),
        key(9.45, (1.7, 1.7, 2.5), (-0.58, 1.42, 0.3), 54, 'Midday: it starts down'),
        key(12.65, (2.3, 1.4, 2.75), (-0.4, 1.2, 0.15), 46, 'Front three-quarter: seated again, the window behind'),
        key(18, (1.45, 1.5, 1.95), (-0.6, 1.35, 0.4), 44, 'Evening: in toward the screens and the summary of the day'),
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
        key(2.35, (5.7, 1.82, 1.9), (0.0, 1.25, 1.75), 39, 'Lin at the wheel: slow push'),
        key(2.4, (3.75, 1.9, -0.3), (-1.37, 1.45, 0.31), 45, 'Cut: the desk, front three-quarter', cut=True),
        key(4.2, (3.5, 1.95, -0.6), (-1.37, 1.45, 0.31), 45, 'Front three-quarter: the lift to 52 in'),
        key(6.8, (3.1, 2.1, -1.45), (-1.37, 1.6, 0.31), 45, 'Up with it; the arc begins'),
        key(12.4, (1.1, 2.0, -3.1), (-1.37, 1.6, 0.31), 47, 'Side three-quarter: the board tilts to drafting'),
        key(16.9, (2.0, 2.0, -2.55), (-1.37, 1.6, 0.31), 46, 'Drafting at 40 degrees, the arc goes on'),
        key(19.5, (3.15, 2.05, 0.35), (-1.37, 1.6, 0.31), 42, 'Round to the front: the painting'),
        key(23.5, (2.75, 1.98, 0.35), (-1.37, 1.6, 0.31), 40, 'The painting: easing in'),
    ])


@chapter
def commons(s):
    # Humboldt commons. The desk waits on the green carpet at (-2.5, 0, -12.2) by the back wall (z -13.7), turns
    # and drives +x along the wall to dock at about (2.8, -11.5); Mia, who called it, waits at (4.16, -11.47)
    # facing it, the wheelchair parked at (6.03, -12.45); her teammates work at the project table on the +z side.
    # His route crossed the drive behind the student at the near table (her head hid the desk at 10.5 s) and his
    # last frame cut the wheelchair at the right edge behind a large water bottle. Here: his establishing over the
    # double-height commons, then a high wide from behind the tables that dollies in as the desk turns off the wall
    # and drives across the frame to Mia (the desk grows to about half the frame by the cut), everyone whole. As it
    # arrives, a cut to the front: desk, Mia and the wheelchair whole, the campus board behind.
    cam(s, his('commons', 0, 2) + [
        key(5.0, (-0.6, 4.6, -2.4), (-1.0, 0.8, -11.6), 38, 'High over the tables: the desk turns off the wall'),
        key(11.55, (1.3, 3.5, -6.5), (2.2, 1.1, -11.5), 40, 'Dollying in as it drives across the cork wall to Mia'),
        key(11.6, (5.7, 1.75, -7.5), (3.9, 0.95, -11.9), 52, 'Front: the desk docks at Mia, the wheelchair beside', cut=True),
        key(16, (5.6, 1.7, -7.8), (3.9, 0.95, -11.9), 50, 'Slow push into the dissolve'),
    ])


@chapter
def coast(s):
    # OCC media lab. The free, featured edit suite stands at (-2.78, 0, 4.98) facing +x, at the end of the row of
    # bays (Maya edits at the centre bay, z 0; Andre at z -5); the aisle runs along +x of them. His opening had a
    # student cut by the right edge and the small tilt happened during a fast swing in; his ending (from 11.25 s, the
    # desktop and the Orange Coast College mark large) is the chapter's brand moment. Here: down the aisle to Maya at
    # her bay, no window at the frame edge; a cut past her to a close three-quarter, the suite at half the frame or
    # more as it rises; then his ending from 11.25 s, without his 2 s hold (one slow push to the end).
    cam(s, [
        key(0, (0.9, 1.7, -3.5), (-1.7, 1.1, 0.3), 32, 'Down the aisle: Maya at the centre bay'),
        key(1.95, (0.85, 1.68, -3.1), (-1.75, 1.1, 0.5), 32, 'Down the aisle: slow push'),
        key(2.0, (0.2, 1.75, 2.0), (-2.8, 1.25, 5.0), 40, 'Cut past her: the free suite', cut=True),
        key(4.4, (-0.2, 1.75, 2.9), (-2.8, 1.25, 5.0), 42, 'Close three-quarter: the suite rises'),
        key(7.4, (-0.35, 1.85, 3.25), (-2.85, 1.3, 5.0), 42, 'Lift lands'),
    ] + his('coast', 11.25, 14.5))


@chapter
def oilers(s):
    # High school. The featured desk (centre about (-3.03, 0, 5.66)) faces +x, 0.85 in front of the ocean window
    # wall (z 7.66). Noah sits at it, then stands to wait at (-1.7, 5.67) while it rises (8.0-11 s). Kai rolls in by the
    # window at the far end. His camera craned up off Kai (Kai cut by the frame), passed close behind a seated student,
    # and ended on standing Noah with his head cut by the top edge. Here: his low opening on Kai; a cut to a high frame
    # along the window, the class and Noah at the desk; a cut to a front three-quarter from the window side: the quiz
    # screens face the lens, Noah whole beside the desk, the desk at half the frame or more, rising against the wall.
    cam(s, his('oilers', 0, 0.6) + [
        key(1.15, (5.02, 0.62, 3.22), (10.05, 1.67, 7.83), 42, 'Kai (hold)'),
        key(1.2, (5.2, 2.2, 2.0), (-2.0, 1.3, 5.6), 42, 'Cut: along the window, the class, Noah at the featured desk', cut=True),
        key(4.45, (4.6, 2.3, 2.35), (-2.4, 1.3, 5.6), 42, 'Drifting along the window'),
        key(4.5, (-0.5, 1.95, 7.15), (-3.0, 1.45, 5.45), 50, 'Cut: front three-quarter from the window side, Noah at the desk', cut=True),
        key(8.0, (-0.6, 1.95, 7.2), (-3.0, 1.5, 5.45), 50, 'Noah gets up'),
        key(11, (-0.55, 2.05, 7.3), (-3.0, 1.78, 5.45), 53, 'The desk rises beside him, the quiz on the screens'),
        key(14, (-0.7, 2.05, 7.3), (-3.0, 1.8, 5.45), 52, 'He works standing'),
    ])


@chapter
def wellness(s):
    # Gym, a small room (x -2.69..5.78, z -3.29..3.29). The desk (centre about (-1.1, 0, 0.64)) faces +x; Maya gets
    # up and stretches at (0.53, 0.64), in front of it, while it rises (6-11 s), then works standing; Priya stretches at
    # the mobility board at (-1.5, -1.9), Kai cycles at (1.95, 2.31). His camera stayed at Maya's height through the
    # lift with her body over the desk; his closing view from her side read best. Here: his wide opening from the
    # mirror wall (Kai whole on the bike); a cut at 2.5 s to her side, closer: the column and desktop rise beside her,
    # the screens to the lens (Priya may sit at the frame edge); a slow push as she works standing.
    cam(s, his('wellness', 0) + [
        key(2.45, (4.95, 1.85, -1.9), (-0.9, 0.79, 0.78), 47, 'Wide from the mirror wall: slow push'),
        key(2.5, (2.1, 1.45, -2.05), (-0.95, 1.38, 0.72), 37, 'Cut: from her side, the desk and Maya'),
        key(6.0, (2.0, 1.5, -1.95), (-0.95, 1.6, 0.7), 40, 'The desk begins to rise, Maya gets up'),
        key(11, (1.85, 1.55, -1.8), (-0.95, 1.62, 0.62), 41, 'The column and desktop climb beside her'),
        key(16, (1.65, 1.55, -1.6), (-0.95, 1.55, 0.6), 40, 'Working standing'),
    ])


@chapter
def awareness(s):
    # "It sees what's in its way." Product stage: the desk (front facing +x) rolls 0.77 units forward (2.7-5.4 s)
    # toward the Labrador standing ahead of it and stops short; the amber proximity light holds to 9 s. His camera
    # watched the roll from a fixed high three-quarter with the dog near the frame edge. Here: two seconds low over the
    # desk's shoulder from behind, looking where it is going, the dog ahead (the desk "sees" it); a cut to his
    # three-quarter as it drives at the dog with the warning rings on the floor; a hard cut on the stop to a floor-level profile at the dog's eye height, where the gap between desk and dog is
    # a clean dark band; then his closing front three-quarter (dog whole) into the fade.
    cam(s, [
        key(0, (-2.3, 1.75, 2.6), (2.8, 0.5, -0.2), 40, "Over the desk's shoulder: the dog ahead"),
        key(1.95, (-2.2, 1.73, 2.6), (2.8, 0.5, -0.2), 40, 'Over the shoulder: slow push'),
        key(2.0, (3.0, 2.38, 5.27), (0.59, 1.11, -0.16), 36, 'Cut: three-quarter, the desk drives at the dog, rings on the floor', cut=True),
        key(5.35, (2.75, 2.25, 4.85), (0.9, 1.0, -0.1), 36, 'Rolling toward it'),
        key(5.4, (1.4, 0.35, 4.9), (1.4, 0.55, 0.0), 36, 'Floor level, side on: it stops short, amber', cut=True),
        key(9.4, (1.45, 0.42, 4.4), (1.45, 0.6, 0.0), 36, 'The gap holds'),
    ] + his('awareness', 12))


@chapter
def music(s):
    # Gaming room (x -2.31..4.48, z -3.52..2.84). The desk (centre about (-0.69, 0, 0.37)) faces +x, its LEDs
    # following the game; the Orbit Runner arcade stands on its -z side; Kai plays from the sofa at (1.86, 2.11),
    # turned to the desk's screen. It rises and tilts at 6.3-9.3 s. His camera opened on the back of Kai's head
    # and swung across during the lift, cutting Kai's head at the left edge. Here: a steep high angle over the
    # room, the desk's light playing on the floor and Kai whole on the sofa answering it, craning down the whole
    # time; a cut at 5.0 s (before Kai would slide off the edge) to a front view that pushes in through the rise
    # and tilt to his symmetric frame.
    cam(s, [
        key(0, (2.9, 3.75, -1.0), (0.2, 0.55, 1.0), 52, 'High over the room: the floor light plays, Kai on the sofa'),
        key(4.95, (2.95, 3.05, -0.55), (-0.1, 0.85, 0.8), 50, 'Craning down the whole time'),
        key(5.0, (4.0, 2.5, -0.8), (-0.73, 1.4, 0.1), 38, 'Cut: front view, it rises and tilts with the game', cut=True),
    ] + his('music', 10.65, 12.5))


@chapter
def media(s):
    # Movie night in the music studio (x -2.31..4.65, z -3.06..3.51). No desk moves here: its LEDs and the room's
    # light follow the film. The desk (centre about (-0.77, 0, 0.18)) faces +x; Omar watches from his wheelchair at
    # (1.09, -1.40). His camera opened behind Omar with his head cut by the top edge and kept the wheelchair half in at
    # the right edge; his frontal push from 9 s, the LED colours on the desktop, is the chapter's best image. Here: a
    # front three-quarter from the window side, desk and Omar whole, slow push; a cut at 9.0 s to his front view
    # (lens a little longer at the cut so Omar stays out of the frame edge) pushing on to the end.
    cam(s, [
        key(0, (1.6, 1.45, 3.1), (-0.4, 1.15, -0.8), 52, 'Window side: the desk and Omar, the film lighting the room'),
        key(8.95, (1.4, 1.45, 2.7), (-0.4, 1.15, -0.8), 51, 'Slow push'),
        key(9.0, (2.75, 1.41, 0.24), (-0.75, 1.26, 0.34), 35, 'Cut: his front view, the LED colours on the desktop', cut=True),
        key(11, (2.5, 1.39, 0.2), (-0.75, 1.26, 0.26), 35, 'His push on the ultrawide'),
        key(17, (2.32, 1.38, 0.17), (-0.75, 1.27, 0.18), 35.5, 'Pushing on into the dissolve'),
    ])


@chapter
def storage(s):
    # Workshop (x -2.84..5.73, z -4.11..4.83; the +x side is the open cutaway, the void beyond it). Seen from above:
    # the desk starts at about (1.9, 0, -0.3) facing +x; Andre (who fades in at 1.0-1.5 s) taps the app at
    # (2.3, 2.0); the board folds to 65 degrees (2.5-12.5 s) and lifts (6.9-9.9); the desk rolls +x to (4.0, -0.5)
    # (7.7-13.2), then -z to about (3.9, -3.5) (13.2-18.3) and turns to park against the far wall (18.3-21.9). Jo
    # works at the tool wall. His camera skimmed the desktop at 1.5 s, saw the fold face-on (the angle only read late)
    # and let the desk fill the frame during the roll. Here: a top-down opening on the desktop and its robots (Andre out of
    # frame during his fade) with a slow push instead of his skim; a hard cut on the action at 2.5 s to a side three-quarter
    # from the far (-z) side, which reads the fold's angle with Andre clear of the desk; giving way out through the
    # open side as the desk rolls toward that spot; then his tracking and parking keys from 17.3 s. Every view looks into the room (-x), and the frame's far edge stays
    # inside the room's corner.
    cam(s, [
        key(0, (2.45, 3.5, 0.15), (1.9, 1.0, -0.3), 36, 'From above: the desktop and its robots'),
        key(2.45, (2.4, 3.25, 0.1), (1.9, 1.0, -0.3), 35, 'Easing down (Andre is out of frame through his fade-in)'),
        key(2.5, (4.3, 1.8, -3.4), (2.65, 1.15, 0.1), 42, 'Side three-quarter: Andre has tapped, the board folds', cut=True),
        key(7.7, (4.0, 1.9, -3.65), (2.5, 1.25, 0.1), 44, 'Folded toward 65 degrees, lifted'),
        key(8.85, (4.1, 1.9, -3.65), (2.6, 1.25, 0.1), 45, 'It starts to roll'),
        key(8.9, (7.5, 1.75, 1.2), (3.5, 1.45, -1.4), 40, 'Cut on the roll: from outside, along the wall', cut=True),
        key(13.2, (7.9, 1.8, 0.85), (3.7, 1.4, -1.35), 42, 'It turns along the wall'),
    ] + his('storage', 17.3, 19.6, 20.5, 22.1, 22.5, 24.978))


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
