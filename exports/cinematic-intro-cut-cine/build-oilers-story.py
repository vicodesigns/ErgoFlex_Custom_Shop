#!/usr/bin/env python3
"""The high school chapter (oilers) as the approved story of Nov 14 (Vico: the standing student helps the one in the
wheelchair with the desk's onboard touchscreen), on S5's oilers (class view from frame 0, Nia, Finn, Mia):

    python exports/cinematic-intro-cut-cine/build-oilers-story.py
    python exports/cinematic-intro-cut-cine/build-cine-cut.py --only oilers        (its camera)

Rewrites, in place, these fields of the oilers chapter of review-cut.json and nothing else: seconds, motion,
ledStatus, touchscreen, and Kai's and Noah's placements in people (cast and when; everyone else kept). 15 s:
  0.0- 1.5  the dissolve from coast; the class view (no cut before 1.5 s). Kai rolls in down the aisle (from 0.3 s)
            and stops half a metre short of the desk; Noah, at its right end, turns to him and greets him (stand-talk)
  4.3- 5.6  Noah turns to the desk and steps to its front-right corner
  5.6- 8.2  (insert over his right shoulder) his hand draws the touchscreen out, it turns up and asks
            'Lower to Kai's height'; his index finger lands on the button at TAP and it lights
  TAP+0.3   the desk starts down, 43.5 to 31 in over 3 s, the live height counting down on the screen
  9.4-11.8  Kai rolls the last half metre in under the desk and docks (wheel-type-31 from 12.75)
  10-15     Noah steps back and watches; Kai starts the quiz
Placements in room millimetres (room-people.mjs); the touchscreen field: experience/touchscreen-track.mjs.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(HERE, 'review-cut.json')

SECONDS = 15
TAP = 8.2                                   # the finger on the button
LIFT_AT, LIFT_FOR = TAP + .3, 3.0           # the desk starts within half a second of the tap
DOCK = [-3757, -1110]                       # Kai at the keyboard, turned 180 (S5's placement)
WAIT = [DOCK[0], DOCK[1] + 500]             # where he stops, half a metre short, on the line of the last leg
# Down the room: along the aisle between the two rows of tables (room x -693), then toward the window between the
# tables and the featured desk (room z -205, clear of Nia's table and of Mia's chair and desk), then in toward the desk
# along its front (the line of the dock), stopping half a metre short of it (measured on an overhead still)
AISLE = [[-693, 1700], [-693, -205], [WAIT[0], -205], WAIT]
ROLL1_AT, ROLL2_AT = .3, 9.4                # rolling in; the last metre as the desk comes down
NOAH_AT, NOAH_TURN = [-2930, -1080], -146   # at the front-right corner, facing the screen (cast.py SCREEN_*)
# where he greets Kai: 362 mm behind the corner spot, so the step there ends facing the screen
NOAH_TALK, NOAH_TALK_TURN = [round(NOAH_AT[0] + .559 * 362), round(NOAH_AT[1] + .829 * 362)], 10
NOAH_BACK = [round(NOAH_AT[0] + .559 * 200), round(NOAH_AT[1] + .829 * 200)]    # 200 mm back from it: watching
STEP_AT = 4.3                               # he sets off toward the corner (after turning, the change at 3.6)
PULL_AT, PULL_FOR = 5.9, 1.1                # his hand takes the edge and draws the screen out (its slide: 120 mm)
DOCKED = 12.75                              # Kai at the keys (the change centred here: he has come to rest by 12.05)


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
        'screen': [{'at': 0, 'mode': 'prompt', 'title': 'Kai is here', 'text': 'Desk at 43.5 in', 'button': "Lower to Kai's height", 'sub': '31.0 in', 'pressed': False},
                   {'at': TAP, 'mode': 'prompt', 'title': 'Kai is here', 'text': 'Desk at 43.5 in', 'button': "Lower to Kai's height", 'sub': '31.0 in', 'pressed': True},
                   {'at': round(LIFT_AT - .05, 3), 'mode': 'moving', 'title': "Lowering to Kai's height", 'from': 43.5, 'target': 31, 'done': "At Kai's height"}]}
    p = s['people']
    keep = [c for c in p['cast'] if not (c['key'].startswith('kai') or c['key'].startswith('noah'))]
    assert ROLL2_AT + max(.5 / .7, 1.2) + 1.2 <= DOCKED - .7, 'Kai comes to rest before the change into typing begins'
    toward_noah = ['noah-talks', 'noah-steps', 'noah-pulls', 'noah-taps', 'noah-watches']
    cast = [
        {'key': 'kai-rolls', 'id': 'people-kai-wheel-roll', 'at': AISLE[0], 'turn': 0, 'roll': {'path': AISLE, 'start': ROLL1_AT, 'speed': 1.0, 'radius': 350}, 'look': toward_noah},
        {'key': 'kai-docks', 'id': 'people-kai-wheel-roll', 'at': WAIT, 'turn': 180, 'roll': {'path': [WAIT, DOCK], 'start': ROLL2_AT, 'speed': .7}, 'look': toward_noah},
        {'key': 'kai', 'id': 'people-kai-wheel-type-31', 'at': DOCK, 'turn': 180},
        {'key': 'noah-talks', 'id': 'people-noah-stand-talk', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'look': ['kai-rolls', 'kai-docks']},
        {'key': 'noah-steps', 'id': 'people-noah-stand-wait', 'at': NOAH_TALK, 'turn': NOAH_TALK_TURN, 'walk': {'path': [NOAH_TALK, NOAH_AT], 'start': STEP_AT, 'pace': 2.2, 'then': 'people-noah-stand-screen-pull'}},
        {'key': 'noah-pulls', 'id': 'people-noah-stand-screen-pull', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': PULL_AT, 'dur': PULL_FOR, 'by': [0, 0, 120]}},
        {'key': 'noah-taps', 'id': 'people-noah-stand-screen-tap', 'at': NOAH_AT, 'turn': NOAH_TURN, 'act': {'at': TAP}},
        {'key': 'noah-watches', 'id': 'people-noah-stand-wait', 'at': NOAH_BACK, 'turn': NOAH_TURN, 'look': ['kai-docks', 'kai']},
    ]
    when = {k: v for k, v in p['when'].items() if not (k.startswith('kai') or k.startswith('noah'))}
    when.update({
        'kai-rolls': [[0, ROLL2_AT, 0, 0]], 'kai-docks': [[ROLL2_AT, DOCKED, 0, 0]], 'kai': [[DOCKED, 99, 0, 0]],
        'noah-talks': [[0, 3.6, 0, 0]], 'noah-steps': [[3.6, PULL_AT - .15, 0, 0]], 'noah-pulls': [[PULL_AT - .15, 7.3, 0, 0]],
        'noah-taps': [[7.3, 9.4, 0, 0]], 'noah-watches': [[9.4, 99, 0, 0]],
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
