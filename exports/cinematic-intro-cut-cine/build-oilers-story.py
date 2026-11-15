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
  9.4-11.8  Kai rolls the last half metre in under the desk and docks (wheel-type-31 from 12.75)
  9.4-15    Noah straightens up, steps back out of Kai's way (10.1-11.6) and watches; Kai starts the quiz
Placements in room millimetres (room-people.mjs); the touchscreen field: experience/touchscreen-track.mjs.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(HERE, 'review-cut.json')

SECONDS = 15
TAP = 8.2                                   # the finger on the button
LIFT_AT, LIFT_FOR = TAP + .3, 3.0           # the desk starts within half a second of the tap
DOCK = [-3757, -1110]                       # Kai at the keyboard, turned 180 (S5's placement)
# where he stops: 0.6 m short of the desk and 0.1 m to the window side of its line, clear of Noah at the corner (he
# docks on an easy S onto the line)
WAIT = [DOCK[0] - 100, DOCK[1] + 600]
DOCK_PATH = [WAIT, [WAIT[0], WAIT[1] - 140], [DOCK[0], DOCK[1] + 210], DOCK]
# Down the room: along the aisle between the two rows of tables (room x -693), then toward the window between the
# tables and the featured desk (room z -205, clear of Nia's table and of Mia's chair and desk), then in toward the desk
# along its front (the line of the dock), stopping half a metre short of it (measured on an overhead still)
AISLE = [[-930, 1300], [-930, -150], [-2000, -150], [WAIT[0], -350], WAIT]      # (round 4: the cross-aisle eases toward the
# desk's front line on a diagonal, clear of Mia's desk; at least 200 mm from every table, chair and seated student)
# The aisle (Vico, Nov 14: 'he rolls right through them ... a space for a wheelchair to get through the center'): the
# two student work tables at the window end of the room are moved apart for the film (this chapter only; Vico's Studio
# room is unchanged): the table by the board (Leo's) toward the board, the one Nia and Finn work at toward the back of
# the room and away from the featured desk, each with its chairs (the students sit on them and follow) and what lies on
# it. Offsets in stage units (x, y, z), applied to whatever stands within 0.3 of each origin (build: AISLE_MOVES).
AISLE_A, AISLE_B = (0, 0, -0.42), (0.55, 0, 0.10)
AISLE_MOVES = [
    ('^Student work table$', (0.75, -0.11), AISLE_A), ('^Student investigation & work in progress', (0.75, -0.11), AISLE_A),
    ('^Prop:calculator$', (0.585, 0.615), AISLE_A), ('^Task chair$', (1.61, 0.35), AISLE_A), ('^Task chair$', (1.61, -0.58), AISLE_A),
    ('^Student work table$', (0.75, 3.13), AISLE_B), ('^Student investigation & work in progress', (0.75, 3.13), AISLE_B),
    ('^Task chair$', (1.61, 2.66), AISLE_B), ('^Task chair$', (1.61, 3.60), AISLE_B),
]
ROLL1_AT, ROLL2_AT = .3, 9.6                # rolling in; the last metre as the desk comes down
NOAH_AT, NOAH_TURN = [-2930, -1080], -146   # at the front-right corner, facing the screen (cast.py SCREEN_*)
# where he greets Kai: 0.3 m to the right of the corner spot (clear of the aisle Kai comes down), turned to him; he
# steps round to the corner through a point 0.2 m behind it, so the last step faces the screen
NOAH_TALK, NOAH_TALK_TURN = [round(NOAH_AT[0] + .829 * 300), round(NOAH_AT[1] - .559 * 300)], 43
NOAH_VIA = [round(NOAH_AT[0] + .559 * 200), round(NOAH_AT[1] + .829 * 200)]
# after the tap he steps back out of Kai's way (0.25 m to his right), round through a point 0.2 m behind that, so
# the last step faces the desk again: a real walk (a change of posture across 200 mm slid him without a step)
NOAH_BACK = [round(NOAH_AT[0] + .829 * 250), round(NOAH_AT[1] - .559 * 250)]
NOAH_BACK_VIA = [round(NOAH_BACK[0] + .559 * 200), round(NOAH_BACK[1] + .829 * 200)]
BACK_AT = 10.1                              # (the change out of the tap posture is over by then; 1.5 s of steps)
STEP_AT = 4.2                               # he sets off toward the corner (after turning round, the change at 3.3; 1.2 s of steps;
                                            # Kai has passed the corner's side of the aisle by then)
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
    assert STEP_AT + 1.2 <= PULL_AT, 'his steps end before his hand takes the screen'
    assert PULL_AT + PULL_FOR <= 7.2 - .7, 'the screen is out before the change into the tap begins'
    # (the dock roll, 0.62 m on its S at 0.7 m/s, takes 2.40 s by rollPlan: at rest by 12.00, before the change into typing
    # begins at DOCKED - 0.7)
    assert ROLL2_AT + 2.40 <= DOCKED - .7, 'Kai comes to rest before the change into typing begins'
    toward_noah = ['noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches']
    cast = [
        {'key': 'kai-rolls', 'id': 'people-kai-wheel-roll', 'at': AISLE[0], 'turn': 0, 'roll': {'path': AISLE, 'start': ROLL1_AT, 'speed': 1.15, 'radius': 500}, 'look': toward_noah},
        {'key': 'kai-docks', 'id': 'people-kai-wheel-roll', 'at': WAIT, 'turn': 180, 'roll': {'path': DOCK_PATH, 'start': ROLL2_AT, 'speed': .7, 'radius': 400}, 'look': toward_noah},
        {'key': 'kai', 'id': 'people-kai-wheel-type-31', 'at': DOCK, 'turn': 180},
        {'key': 'noah-talks', 'id': 'people-noah-stand-talk', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'look': ['kai-rolls', 'kai-docks']},
        {'key': 'noah-steps', 'id': 'people-noah-stand-wait', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'walk': {'path': [NOAH_TALK, NOAH_VIA, NOAH_AT], 'start': STEP_AT, 'pace': 2.5, 'then': 'people-noah-stand-screen-pull'}},
        {'key': 'noah-pulls', 'id': 'people-noah-stand-screen-pull', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': PULL_AT, 'dur': PULL_FOR, 'by': [0, 0, 120]}},
        {'key': 'noah-taps', 'id': 'people-noah-stand-screen-tap', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': TAP}},
        {'key': 'noah-watches', 'id': 'people-noah-stand-wait', 'at': NOAH_AT, 'turn': NOAH_TURN, 'look': ['kai-docks', 'kai'], 'walk': {'path': [NOAH_AT, NOAH_BACK_VIA, NOAH_BACK], 'start': BACK_AT, 'pace': 2.0}},
    ]
    when = {k: v for k, v in p['when'].items() if not (k.startswith('kai') or k.startswith('noah'))}
    when.update({
        'kai-rolls': [[0, ROLL2_AT, 0, 0]], 'kai-docks': [[ROLL2_AT, DOCKED, 0, 0]], 'kai': [[DOCKED, 99, 0, 0]],
        'noah-talks': [[0, 3.3, 0, 0]], 'noah-steps': [[3.3, PULL_AT, 0, 0]], 'noah-pulls': [[PULL_AT, 7.2, 0, 0]],
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
