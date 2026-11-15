#!/usr/bin/env python3
"""The high school chapter (oilers) as the approved story of Nov 14 (Vico: the standing student helps the one in the
wheelchair with the desk's onboard touchscreen), on S5's oilers (class view from frame 0, Nia, Finn, Mia):

    python exports/cinematic-intro-cut-cine/build-oilers-story.py
    python exports/cinematic-intro-cut-cine/build-cine-cut.py --only oilers        (its camera)

Rewrites, in place, these fields of the oilers chapter of review-cut.json and nothing else: seconds, motion,
ledStatus, touchscreen, and Kai's and Noah's placements in people (cast and when; everyone else kept). 15 s:
  0.0- 1.5  the dissolve from coast; the class view (no cut before 1.5 s). Kai rolls in down the aisle (from 0.3 s)
            and stops half a metre short of the desk; Noah, at its right end, turns to him and greets him (stand-talk)
  3.3- 5.4  Noah turns round to the desk and steps to its front-right corner
  5.3- 8.2  (the insert) his hand draws the touchscreen out (5.4-6.5), it turns up and asks
            'Lower to Kai's height'; his index finger lands on the button at TAP and it lights
  TAP+0.3   the desk starts down, 43.5 to 31 in over 3 s, the live height counting down on the screen
  8.0-11.77 Kai rolls along the cross-aisle and round into the desk as it comes down, and docks (wheel-type-31 from 12.75)
  9.4-15    Noah straightens up at the corner, turned a little to his right, and watches; Kai starts the quiz
Placements in room millimetres (room-people.mjs); the touchscreen field: experience/touchscreen-track.mjs.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(HERE, 'review-cut.json')

SECONDS = 15
TAP = 8.2                                   # the finger on the button
LIFT_AT, LIFT_FOR = TAP + .3, 3.0           # the desk starts within half a second of the tap
# Kai at the keyboard, turned 180 (S5's placement, 60 mm to the window side since round 5: the room it leaves between
# him and Noah at the desk's corner)
DOCK = [-3817, -1110]
# Round 5 (the reviewer of 217890f9): every turn of Kai's is a real arc (rollPlan rounds a corner by at most half of
# each leg: a short leg made a whip turn), so the paths are written as arcs: quarter circles of points, each corner of
# a few degrees, rounded with the arc's own radius.
def arc_zx(cx, cz, r, n=8):
    """A quarter circle from heading room -z to heading room -x about (cx, cz)."""
    return [[round(cx + r * math.cos(math.pi / 2 * k / n)), round(cz - r * math.sin(math.pi / 2 * k / n))] for k in range(n + 1)]
def arc_xz(x0, z0, r, n=8):
    """A quarter circle from heading room -x at (x0, z0) to heading room -z."""
    return [[round(x0 - r * math.sin(math.pi / 2 * k / n)), round(z0 - r + r * math.cos(math.pi / 2 * k / n))] for k in range(n + 1)]
LANE_X, CROSS_Z, R1, R2 = -930, -300, 520, 700
# Down the aisle between the two tables (room x -930), round a 0.52 m arc into the cross-aisle (room z -300), where
# he waits at its end, well clear of Noah (room x -1500); from 8.0 s on along the cross-aisle and
# round a 0.7 m arc into the desk's front line, docking along it.
WAIT = [-1500, CROSS_Z]
# rollPlan rounds each corner with at most half of either leg: the radius it is given is under the arc's (the chord of
# an eighth of a quarter circle, rounded to the millimetre, leaves a little less than R tan of half its angle),
# so no corner of the arcs is clamped (check_roll_radius below fails the build otherwise)
ROUND = .9
AISLE = [[LANE_X, 1300]] + arc_zx(LANE_X - R1, CROSS_Z + R1, R1) + [WAIT]
DOCK_PATH = [WAIT] + arc_xz(DOCK[0] + R2, CROSS_Z, R2) + [DOCK]
# The aisle (Vico, Nov 14: 'he rolls right through them ... a space for a wheelchair to get through the center'): the
# two student work tables at the window end of the room are moved apart for the film (this chapter only; Vico's Studio
# room is unchanged): the table by the board (Leo's) toward the board, the one Nia and Finn work at toward the back of
# the room and away from the featured desk, each with its chairs (the students sit on them and follow) and what lies on
# it. Offsets in stage units (x, y, z), applied to whatever stands within 0.3 of each origin (build: AISLE_MOVES).
AISLE_A, AISLE_B = (0, 0, -0.42), (0.65, 0, 0.10)
AISLE_MOVES = [
    ('^Student work table$', (0.75, -0.11), AISLE_A), ('^Student investigation & work in progress', (0.75, -0.11), AISLE_A),
    ('^Prop:calculator$', (0.585, 0.615), AISLE_A), ('^Task chair$', (1.61, 0.35), AISLE_A), ('^Task chair$', (1.61, -0.58), AISLE_A),
    ('^Student work table$', (0.75, 3.13), AISLE_B), ('^Student investigation & work in progress', (0.75, 3.13), AISLE_B),
    ('^Task chair$', (1.61, 2.66), AISLE_B), ('^Task chair$', (1.61, 3.60), AISLE_B),
]
ROLL1_AT, ROLL2_AT = .3, 8.0                # rolling in (at rest by 3.42 s); into the desk as it comes down (8.0-11.81 s)
NOAH_AT, NOAH_TURN = [-2930, -1080], -146   # at the front-right corner, facing the screen (cast.py SCREEN_*)
# where he greets Kai: on the cross-aisle, facing Kai as he comes in and waits (turned 90: toward room +x); then he
# turns (the change into his walk: at most 116 degrees a second) and walks to the corner through a point 0.4 m behind
# it, so the last leg (longer than walkPlan's 0.35 m heading blend) ends facing the screen exactly as the pull
# placement is turned: no turn at the hand-over (round 5, the reviewer: a 47 degree snap at 5.4 s)
NOAH_TALK, NOAH_TALK_TURN = [-2800, CROSS_Z], 90
NOAH_VIA = [round(NOAH_AT[0] + .559 * 400), round(NOAH_AT[1] + .829 * 400)]
# after the tap he straightens up where he stands, turned 16 degrees to his right (a change of posture: under the
# 17 degrees that pairs it), his left arm out of the way of Kai rolling in, and watches the desk come down to him
NOAH_WATCH_TURN = -162
TALK_TO = 2.9                               # he greets Kai until then (the change into his walk 2.2-3.6 s)
STEP_AT = 3.6                               # he sets off toward the corner (1.43 s of steps: at the corner by 5.03 s)
PULL_AT, PULL_FOR = 5.4, 1.1                # his hand takes the edge and draws the screen out (its slide: 120 mm)
DOCKED = 12.75                              # Kai at the keys (the change centred here: he has come to rest by 12.05)


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


def main():
    with open(CUT, 'rb') as f: raw = f.read()
    cut = json.loads(raw)
    s = next(x for x in cut['shots'] if x['id'] == 'oilers')
    s['seconds'] = SECONDS
    s['motion'] = {'version': 2, 'initial': {'height': 43.5, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0},
                   'clips': [{'id': 'oilers-demo-lift', 'lane': 'lift', 'kind': 'lift', 'start': round(LIFT_AT, 3), 'duration': LIFT_FOR, 'easing': 'smooth',
                              'label': "Noah taps 'Lower to Kai's height': down to his wheelchair height", 'target': 31}]}
    s['ledStatus'] = [{'at': round(LIFT_AT, 3), 'dur': LIFT_FOR, 'kind': 'lift-down', 'fade': 1, 'fadeIn': 0.6}]
    # The screen: out from under the desktop with his hand, turned up, the question, the touch, the live height.
    s['touchscreen'] = {
        'from': 0,
        'open': [{'at': PULL_AT, 'to': .5, 'dur': PULL_FOR, 'easing': 'smooth'}, {'at': PULL_AT + PULL_FOR, 'to': 1, 'dur': 1.1, 'easing': 'smooth'}],
        'screen': SCREEN}
    # the aisle: the room's furniture moved apart (sceneEdits labelled 'S9 aisle', replaced on every run)
    s['sceneEdits'] = [e for e in s['sceneEdits'] if not str(e.get('label', '')).startswith('S9 aisle')] + [
        {'match': m, 'near': [at[0], at[1], 0.3], 'position': list(by), 'label': 'S9 aisle: ' + m.strip('^$') + ' at (%g, %g)' % at} for m, at, by in AISLE_MOVES]
    p = s['people']
    keep = [c for c in p['cast'] if not (c['key'].startswith('kai') or c['key'].startswith('noah'))]
    assert STEP_AT + 1.43 <= PULL_AT, 'his steps end before his hand takes the screen'
    assert abs(STEP_AT - (TALK_TO + .7)) < 1e-9, 'he sets off as the change into his walk ends'
    check_roll_radius('Kai rolling in', AISLE, round(R1 * ROUND)); check_roll_radius('Kai docking', DOCK_PATH, round(R2 * ROUND))
    assert PULL_AT + PULL_FOR <= 7.2 - .7, 'the screen is out before the change into the tap begins'
    # (the dock roll, 2.84 m along the cross-aisle and its arc at 1.1 m/s, takes 3.81 s by rollPlan: at rest by 11.81, before
    # the change into typing begins at DOCKED - 0.7)
    assert ROLL2_AT + 3.81 <= DOCKED - .7, 'Kai comes to rest before the change into typing begins'
    toward_noah = ['noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches']
    cast = [
        {'key': 'kai-rolls', 'id': 'people-kai-wheel-roll', 'at': AISLE[0], 'turn': 0, 'roll': {'path': AISLE, 'start': ROLL1_AT, 'speed': 1.0, 'radius': round(R1 * ROUND)}, 'look': toward_noah},
        {'key': 'kai-docks', 'id': 'people-kai-wheel-roll', 'at': WAIT, 'turn': 180, 'roll': {'path': DOCK_PATH, 'start': ROLL2_AT, 'speed': 1.1, 'radius': round(R2 * ROUND)}, 'look': toward_noah},
        {'key': 'kai', 'id': 'people-kai-wheel-type-31', 'at': DOCK, 'turn': 180},
        {'key': 'noah-talks', 'id': 'people-noah-stand-talk', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'look': ['kai-rolls', 'kai-docks']},
        {'key': 'noah-steps', 'id': 'people-noah-stand-wait', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'walk': {'path': [NOAH_TALK, NOAH_VIA, NOAH_AT], 'start': STEP_AT, 'pace': 2.8, 'then': 'people-noah-stand-screen-pull'}},
        {'key': 'noah-pulls', 'id': 'people-noah-stand-screen-pull', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': PULL_AT, 'dur': PULL_FOR, 'by': [0, 0, 120]}},
        {'key': 'noah-taps', 'id': 'people-noah-stand-screen-tap', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': TAP}},
        # (no `look`: Kai comes up behind and beside him, outside the gaze's 1.3 rad cone until about 11 s, and the head
        # would turn to him in one frame as he entered it; Noah's head keeps its own slow drift instead)
        {'key': 'noah-watches', 'id': 'people-noah-stand-wait', 'at': NOAH_AT, 'turn': NOAH_WATCH_TURN},
    ]
    when = {k: v for k, v in p['when'].items() if not (k.startswith('kai') or k.startswith('noah'))}
    when.update({
        'kai-rolls': [[0, ROLL2_AT, 0, 0]], 'kai-docks': [[ROLL2_AT, DOCKED, 0, 0]], 'kai': [[DOCKED, 99, 0, 0]],
        'noah-talks': [[0, TALK_TO, 0, 0]], 'noah-steps': [[TALK_TO, PULL_AT, 0, 0]], 'noah-pulls': [[PULL_AT, 7.2, 0, 0]],
        'noah-taps': [[7.2, 9.4, 0, 0]], 'noah-watches': [[9.4, 99, 0, 0]],
    })
    # (Kai's when keys first, then Noah's, then everyone else's, as the cut had them)
    p['cast'] = keep[:1] + cast + keep[1:]
    p['when'] = {**{k: when[k] for k in ('kai-rolls', 'kai-docks', 'kai', 'noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches')}, **{k: v for k, v in when.items() if not (k.startswith('kai') or k.startswith('noah'))}}
    out = json.dumps(cut, indent=1).encode()
    if out != raw:
        with open(CUT, 'wb') as f: f.write(out)
    print('oilers story written:', SECONDS, 's, tap', TAP, 'lift', LIFT_AT, '-', LIFT_AT + LIFT_FOR)


if __name__ == '__main__':
    main()
