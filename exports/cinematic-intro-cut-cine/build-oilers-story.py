#!/usr/bin/env python3
"""The high school chapter (oilers) as the approved story of Nov 14 (Vico: the standing student helps the one in the
wheelchair with the desk's onboard touchscreen), on S5's oilers (class view from frame 0, Nia, Finn, Mia):

    python exports/cinematic-intro-cut-cine/build-oilers-story.py
    python exports/cinematic-intro-cut-cine/build-cine-cut.py --only oilers        (its camera)

Rewrites, in place, these fields of the oilers chapter of review-cut.json and nothing else: seconds, motion,
ledStatus, touchscreen, sceneDeskEdits, the film's own sceneEdits (the aisle and the 'S9 story' hides; the stale Director
offsets dropped), and Kai's and Noah's placements in people (cast and when; everyone else kept). 15 s, in Vico's Studio
room as saved (studio-state rev 3478):
  0.0- 1.5  the dissolve from coast; the class view (no cut before 1.5 s). Kai rolls in down the aisle (from 0.2 s),
            along the cross-aisle in front of the first row and round into the featured desk (at rest by 5.6 s);
            Noah greets him from beside the desk's right end (stand-talk)
  3.2- 5.33 Noah turns and walks to the desk's front-right corner, arriving facing the screen
  5.3- 9.0  (the insert, over Kai's shoulder) his hand draws the touchscreen out (5.4-6.5), it turns up and asks
            'Lower to Kai's height'; his index finger lands on the button at TAP and it lights
  TAP+0.3   the desk starts down to Kai, 43.5 to 31 in over 3 s, the live height counting down on the screen
  9.4-15    Noah straightens up at the corner, turned a little to his right, and watches; Kai types from 12.75 s
Placements in room millimetres (room-people.mjs); the touchscreen field: experience/touchscreen-track.mjs.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(HERE, 'review-cut.json')

SECONDS = 15
TAP = 8.2                                   # the finger on the button
LIFT_AT, LIFT_FOR = TAP + .3, 3.0           # the desk starts within half a second of the tap
# Round 6 (Vico, Nov 15: 'the high school room is still not his room'): the room is Vico's Studio room as saved
# (studio-state rev 3478, highschool:house). The film's stage builds the room's desks from the room's own layout, not
# from the Studio's saved desks (ergoflex.sceneDesksBySizeV2 is not overlaid on a film render), so this chapter puts
# them where he saved them: the featured desk through motion.initial (MAIN_INITIAL below), the station desks through
# sceneDeskEdits (ROOM_DESKS). Every story position near the featured desk (Kai's dock, Noah at the screen, the insert
# cameras in build-cine-cut.py) is the old one carried rigidly with the desk: main(): at_main().
MAIN_WAS = (-3749, -2045, 0)                # the featured desk where the film's stage puts it (room mm, yaw deg)
MAIN = (-3350, -1950, -25)                  # where Vico saved it (rev 3478: turned 25 degrees toward the whiteboard)
# motion.initial x, z are inches along room +x, +z; yaw in degrees. Measured on the stage (render-cut --list-objects):
# turned -25 degrees the desk's origin lands at (-3800.2, -2055.3), so the offset that puts it at MAIN is:
MAIN_INITIAL = {'x': round((MAIN[0] + 3800.2) / 25.4, 3), 'z': round((MAIN[1] + 2055.3) / 25.4, 3), 'yaw': MAIN[2]}
def at_main(p):
    """A room point (x, z) placed against the featured desk where it was, carried with the desk to where it is."""
    th = math.radians(MAIN[2]); dx, dz = p[0] - MAIN_WAS[0], p[1] - MAIN_WAS[1]
    return [round(MAIN[0] + dx * math.cos(th) + dz * math.sin(th)), round(MAIN[1] - dx * math.sin(th) + dz * math.cos(th))]
# The station desks as saved (rev 3478, sceneDesksBySizeV2 rooms highschool/house): pose x, z mm, yaw radians.
def room_desk(desk, name, size, x, z, yaw, height, tilt):
    return {'desk': 'station-' + desk, 'name': name, 'size': size, 'pose': {'x': x, 'z': z, 'yaw': round(math.radians(yaw), 5)}, 'initial': {'height': height, 'tilt': tilt}}
ROOM_DESKS = [
    room_desk('demonstration-desk', 'Wave and energy demonstration desk', '60x30', 2700, -2100, 135, 43.5, 0),
    room_desk('accessible-student', 'Accessible student desk', '48x30', -4300, 1750, 0, 28, 0),
    room_desk('window-research', 'Coastal research nook', '48x30', -4300, 4500, 0, 43.5, 0),
]
# The film's own edits that were Director offsets copied from Vico's cut with people before his Nov 13 rework (they
# moved his desks and chairs off the places he saved; the reviewer's list, Nov 15): dropped on every run.
STALE = ('highschool:house:room:24:ergoflex-small-bookshelf', 'highschool:house:room:13:ergoflex-designer-chair',
         'highschool:house:room:7:water-bottle', 'highschool:house:fixture:mobile-desk-chair',
         'highschool:house:station:accessible-student', 'highschool:house:room:19:ergoflex-tall-office-chair',
         'highschool:house:station:project-review', 'highschool:house:room:1:ergoflex-office-chair',
         'highschool:house:station:demonstration-desk')
# (and an old floor-plan pass, 'fp3', that hid the back table by the window with its chairs and backpack: Vico's room
# has it: three rows of tables)
def stale(e):
    return (e.get('director') and e.get('asset') in STALE) or (e.get('fp3') and e.get('hide') and e.get('match') in ('^Student work table$', '^Student investigation & work in progress', '^Task chair$', '^Prop:backpack$'))
# Kai at the keyboard, turned 180 to the desk (S5's placement), carried with the desk
DOCK, DOCK_TURN = at_main([-3817, -1110]), 180 + MAIN[2]
# Round 5 (the reviewer of 217890f9): every turn of Kai's is a real arc (rollPlan rounds a corner by at most half of
# each leg: a short leg made a whip turn), so the paths are written as arcs: circles of points, each corner of a few
# degrees, rounded with the arc's own radius.
def arc_zx(cx, cz, r, n=8):
    """A quarter circle from heading room -z to heading room -x about (cx, cz)."""
    return [[round(cx + r * math.cos(math.pi / 2 * k / n)), round(cz - r * math.sin(math.pi / 2 * k / n))] for k in range(n + 1)]
def heading(deg):
    """The room direction (x, z) of a heading in degrees (a person's turn: 0 faces +z, 90 faces +x)."""
    return math.sin(math.radians(deg)), math.cos(math.radians(deg))
# The aisle (Vico, Nov 15: 'the students on the right should have been moved over to the right so that the ones on the
# left didn't encroach on the students on the left'): the middle and right-hand columns of student tables, each with its
# chairs and what lies on it, 300 mm toward the right-hand wall (nothing moves toward the window). The gap between the
# left-hand and middle columns is then 1192 mm (892 in the room as saved): Kai rolls down it (room x -850), round a
# 0.52 m arc into the cross-aisle in front of the first row, toward the window, and round a 0.36 m arc (115 degrees:
# the featured desk is turned 25 degrees toward the board) into the desk; he waits partway round it, on the window
# side of the corner where Noah will stand, and docks from there as the desk comes down.
AISLE_DX = 380
LANE_X, START_Z, R1, R2 = -850, 500, 520, 480
# the 115 degree arc: heading phi falls from 270 (room -x) to the dock's; points c + R (cos phi, -sin phi)
C2 = [DOCK[0] - R2 * math.cos(math.radians(DOCK_TURN)), DOCK[1] + R2 * math.sin(math.radians(DOCK_TURN))]
CROSS_Z = round(C2[1] + R2)                  # the cross-aisle: where that arc starts, heading room -x
def arc2(phi0, phi1, step=8):
    n = round((phi0 - phi1) / step)
    return [[round(C2[0] + R2 * math.cos(math.radians(phi0 - (phi0 - phi1) * k / n)), 1), round(C2[1] - R2 * math.sin(math.radians(phi0 - (phi0 - phi1) * k / n)), 1)] for k in range(n + 1)]
ROUND = .9
# (he rolls all the way in before Noah steps to the corner: the corner, with the desk turned, stands in his way along
# the cross-aisle, and a wait short of the desk leaves no room between him and Noah's arm)
AISLE = [[LANE_X, START_Z]] + arc_zx(LANE_X - R1, CROSS_Z + R1, R1) + arc2(270, DOCK_TURN)[:-1] + [DOCK]   # (the arc ends at the dock: heading the desk)
ROLL_AT, ROLL_SPEED = 0.2, 1.0               # rolling in; at the desk before Noah reaches its corner
NOAH_AT, NOAH_TURN = at_main([-2930, -1080]), -146 + MAIN[2]   # at the front-right corner, facing the screen
# where he greets Kai: beside the desk's right end, clear of Kai's way along the cross-aisle, turned toward Kai as he
# comes down the aisle; then he walks to the corner (the walk ends facing the screen: walkPlan, S19) once Kai is past it
NOAH_TALK, NOAH_TALK_TURN = [-2250,-1600], 20
# after the tap he straightens up where he stands, turned 16 degrees to his right (a change of posture: under the
# 17 degrees that pairs it), and watches the desk come down to Kai
NOAH_WATCH_TURN = NOAH_TURN - 16
TALK_TO = 3.2                               # he greets Kai until then (the change into his walk 2.9-3.6 s)
STEP_AT = 3.9                               # he sets off toward the corner
PULL_AT, PULL_FOR = 5.4, 1.1                # his hand takes the edge and draws the screen out (its slide: 120 mm)
DOCKED = 12.75                              # Kai at the keys


# The face (stream S15 owns these strings): the app's own look (tools/experience/film-touchscreen-modes.mjs). Key 0 is
# TouchscreenDisplay's built-in prompt while the screen is stowed, so the face never caches the app screen before the
# film modes are registered; the app-look prompt is up before the screen comes out (FACE_AT), the button answers the
# finger at TAP, and from just before the lift the HEIGHT tile counts the desk's real height down to Kai's 31.0 in.
FACE_AT = 5.0
PROMPT = {'title': "Kai's here", 'text': 'Lower the desk to his saved height', 'button': "Lower to Kai's height", 'sub': '31.0 in · saved for Kai', 'person': 'Kai', 'preset': 31}
SCREEN = [{'at': 0, 'mode': 'prompt', 'title': PROMPT['title'], 'text': PROMPT['text'], 'button': PROMPT['button'], 'sub': PROMPT['sub'], 'pressed': False},
          {'at': FACE_AT, 'mode': 'presetPrompt', **PROMPT, 'pressed': False},
          {'at': TAP, 'mode': 'presetPrompt', **PROMPT, 'pressed': True},
          {'at': round(LIFT_AT - .05, 3), 'mode': 'presetMoving', 'title': "Lowering to Kai's height", 'from': 43.5, 'target': 31, 'done': "At Kai's height", 'person': 'Kai'}]


def check_roll_radius(what, path, radius):
    """A corner of a roll that rollPlan (room-people-motion.mjs) would round with less than `radius` (mm): its tangent is
    capped at half of either leg. The film must not get a sharper turn than it asks for: the build stops."""
    bad = []
    for i in range(1, len(path) - 1):
        a, c, b = path[i - 1], path[i], path[i + 1]
        l1, l2 = math.dist(a, c), math.dist(c, b)
        if l1 < 1e-6 or l2 < 1e-6: continue
        d1, d2 = ((c[0] - a[0]) / l1, (c[1] - a[1]) / l1), ((b[0] - c[0]) / l2, (b[1] - c[1]) / l2)
        turn = math.acos(max(-1., min(1., d1[0] * d2[0] + d1[1] * d2[1])))
        if turn < 1e-4 or turn > math.pi - 1e-3: continue
        want = radius * math.tan(turn / 2)
        if want > min(l1, l2) / 2 + 1e-6: bad.append('corner %d at %s: %.0f deg wants %.0f mm of leg, has %.0f (radius %.0f mm, not %d)' % (i, c, math.degrees(turn), want, min(l1, l2) / 2, min(l1, l2) / 2 / math.tan(turn / 2), radius))
    if bad: raise SystemExit(what + ': rollPlan would clamp its turning radius:\n  ' + '\n  '.join(bad))


K = 662.84                                  # room millimetres to a stage unit
def stage(x, z):
    """A room point (mm) as the (x, z) a sceneEdit's `near` reads (stage units)."""
    return [round(z / K, 3), round(-x / K, 3)]
# What the aisle carries: a table, its dressing, its two chairs and what lies on it or by it (the people on the
# chairs follow them). Centres in room mm (Vico's room), radius 700 mm: a table's chairs stand 650 mm from its middle,
# the next table 2 m off.
AISLE_WHAT = '^(Student work table|Student investigation & work in progress.*|Task chair|Prop:(calculator|water-bottle|ergoflex-phone|backpack|backpack-daypack|ergoflex-violin))$'
# middle column; right column (its second row: two chairs, no table: 500 mm about them)
AISLE_AT = [(75, 500, 700), (75, 2500, 700), (75, 4500, 700), (2225, 500, 700), (2287, 2960, 500), (2225, 4500, 700)]
def story_edits():
    out = [{'match': AISLE_WHAT, 'near': stage(x, z) + [round(r / K, 3)], 'position': [0, 0, round(-AISLE_DX / K, 4)],
            'label': 'S9 aisle: the student table at room (%d, %d), its chairs and things, %d mm toward the right-hand wall' % (x, z, AISLE_DX)}
           for x, z, r in AISLE_AT]
    out += [
        # Vico's task chair at the featured desk stands where Kai docks (S5's story: Kai works at that desk)
        {'match': '^Task chair$', 'near': stage(-3614, -810) + [0.3], 'hide': True, 'label': "S9 story: the task chair at the featured desk (Kai docks where it stands)"},
        # (kept from earlier rounds, carried to where the desks now stand)
        {'match': '^Prop:kenney-furniture-books$', 'near': stage(-4300 + 400, 4500 - 100) + [0.3], 'hide': True, 'label': "S9 story: books on Mia's desk (they cut through the monitor shelf)"},
        # (a sceneEdit finds it before motion.initial turns the desk: where the desk's dressing stands unmoved)
        {'match': '^Prop:insulated-mug$', 'near': stage(-4349, -1895) + [0.3], 'hide': True, 'label': "S9 story: teal tumbler on Kai's desk (Vico, Nov 14: removed)"},
    ]
    return out


def main():
    with open(CUT, 'rb') as f: raw = f.read()
    cut = json.loads(raw)
    s = next(x for x in cut['shots'] if x['id'] == 'oilers')
    s['seconds'] = SECONDS
    # (the featured desk where Vico saved it; it starts at 43.5 in, not his saved 28: the story lowers it to Kai's 31)
    s['motion'] = {'version': 2, 'initial': {'height': 43.5, 'tilt': 0, **MAIN_INITIAL},
                   'clips': [{'id': 'oilers-demo-lift', 'lane': 'lift', 'kind': 'lift', 'start': round(LIFT_AT, 3), 'duration': LIFT_FOR, 'easing': 'smooth',
                              'label': "Noah taps 'Lower to Kai's height': down to his wheelchair height", 'target': 31}]}
    s['ledStatus'] = [{'at': round(LIFT_AT, 3), 'dur': LIFT_FOR, 'kind': 'lift-down', 'fade': 1, 'fadeIn': 0.6}]
    # The screen: out from under the desktop with his hand, turned up, the question, the touch, the live height.
    s['touchscreen'] = {
        'from': 0,
        'open': [{'at': PULL_AT, 'to': .5, 'dur': PULL_FOR, 'easing': 'smooth'}, {'at': PULL_AT + PULL_FOR, 'to': 1, 'dur': 1.1, 'easing': 'smooth'}],
        'screen': SCREEN}
    # the room's desks where Vico saved them
    s['sceneDeskEdits'] = ROOM_DESKS
    # the film's edits: the stale Director offsets and the old story moves dropped, the aisle and the story's own
    # edits (labelled 'S9 ...') replaced on every run
    old_story = lambda e: (str(e.get('label', '')).startswith('S9 ') or (e.get('match') == '^Task chair$' and e.get('near') in ([-1.222, 5.452, 0.3], [-0.452, 5.907, 0.3]))
                           or str(e.get('label', '')).startswith(('Books on Mia', 'Teal tumbler on Kai')))
    s['sceneEdits'] = [e for e in s['sceneEdits'] if not stale(e) and not old_story(e)] + story_edits()
    p = s['people']
    keep = [c for c in p['cast'] if not (c['key'].startswith('kai') or c['key'].startswith('noah'))]
    assert abs(STEP_AT - (TALK_TO + .7)) < 1e-9, 'he sets off as the change into his walk ends'
    check_roll_radius('Kai rolling in', AISLE, round(R2 * ROUND))   # (one radius for the roll: the smaller arc's)
    assert PULL_AT + PULL_FOR <= 7.2 - .7, 'the screen is out before the change into the tap begins'
    # (the dock roll, 0.58 m round the rest of the arc at 0.6 m/s, takes 1.62 s by rollPlan: at rest by 11.02, before the
    # change into typing begins at DOCKED - 0.7; the walk and roll timings: tests/oilers-roll-radius-test.py)
    toward_noah = ['noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches']
    cast = [
        {'key': 'kai-rolls', 'id': 'people-kai-wheel-roll', 'at': AISLE[0], 'turn': 0, 'roll': {'path': AISLE, 'start': ROLL_AT, 'speed': ROLL_SPEED, 'radius': round(R2 * ROUND)}, 'look': toward_noah},
        {'key': 'kai', 'id': 'people-kai-wheel-type-31', 'at': DOCK, 'turn': DOCK_TURN},
        {'key': 'noah-talks', 'id': 'people-noah-stand-talk', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'look': ['kai-rolls']},
        {'key': 'noah-steps', 'id': 'people-noah-stand-wait', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'walk': {'path': [NOAH_TALK, NOAH_AT], 'start': STEP_AT, 'pace': 2.8, 'then': 'people-noah-stand-screen-pull'}},
        {'key': 'noah-pulls', 'id': 'people-noah-stand-screen-pull', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': PULL_AT, 'dur': PULL_FOR, 'by': [0, 0, 120]}},
        {'key': 'noah-taps', 'id': 'people-noah-stand-screen-tap', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': TAP}},
        # (no `look`: Kai comes up behind and beside him, outside the gaze's 1.3 rad cone until about 11 s, and the head
        # would turn to him in one frame as he entered it; Noah's head keeps its own slow drift instead)
        {'key': 'noah-watches', 'id': 'people-noah-stand-wait', 'at': NOAH_AT, 'turn': NOAH_WATCH_TURN},
    ]
    when = {k: v for k, v in p['when'].items() if not (k.startswith('kai') or k.startswith('noah'))}
    when.update({
        'kai-rolls': [[0, DOCKED, 0, 0]], 'kai': [[DOCKED, 99, 0, 0]],
        'noah-talks': [[0, TALK_TO, 0, 0]], 'noah-steps': [[TALK_TO, PULL_AT, 0, 0]], 'noah-pulls': [[PULL_AT, 7.2, 0, 0]],
        'noah-taps': [[7.2, 9.4, 0, 0]], 'noah-watches': [[9.4, 99, 0, 0]],
    })
    # (Kai's when keys first, then Noah's, then everyone else's, as the cut had them)
    p['cast'] = keep[:1] + cast + keep[1:]
    p['when'] = {**{k: when[k] for k in ('kai-rolls', 'kai', 'noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches')}, **{k: v for k, v in when.items() if not (k.startswith('kai') or k.startswith('noah'))}}
    out = json.dumps(cut, indent=1).encode()
    sys.path.insert(0, HERE); from director_guard import guard; guard(json.loads(raw), cut, who='build-oilers-story.py')   # (a chapter edited in the Director is his)
    if out != raw:
        with open(CUT, 'wb') as f: f.write(out)
    print('oilers story written:', SECONDS, 's, tap', TAP, 'lift', LIFT_AT, '-', LIFT_AT + LIFT_FOR)


if __name__ == '__main__':
    main()
