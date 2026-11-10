#!/usr/bin/env python3
"""The alternate cut: Vico's hq14 review cut, reworked chapter by chapter, written beside it.

    python3 tools/experience/build-alt-cut.py <hq14 review-cut.json> <out review-cut.json> [--only id,id]

Nothing in the source cut is changed. Every chapter keeps its length and its desk moves (clips, status lights,
screens, daypart keys) to the frame, so any chapter of this cut can replace the same chapter of his one for one:
titles, score and dissolves stay where they are. What changes is who is in the room and when (`people`,
room-people.mjs), where the camera goes (`cameraPlan`, splined into `camera` by camera-spline.mjs), and a few props.

Positions below are room millimetres (x to the right, z toward the room's front, y up), the unit people and props
are placed in. cam() turns them into the stage's world units.
"""
import json, math, os, subprocess, sys, tempfile

src, out = sys.argv[1], sys.argv[2]
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
HERE = os.path.dirname(os.path.abspath(__file__))
cut = json.load(open(src))

K = 1 / 662.84                                    # world units per room millimetre (every room; the root turns x → -z)
def W(x, y, z): return [round(K * z, 4), round(K * y, 4), round(-K * x, 4)]


def key(at, eye, look, fov, label, **more):
    """A story key: camera at `eye`, looking at `look` (room mm), `fov` degrees vertical."""
    return dict(at=at, position=W(*eye), target=W(*look), fov=fov, label=label, **more)


def cam(shot, keys, ease_in=False, ease_out=False):
    """Replace the chapter's camera with these story keys and spline them."""
    shot['cameraPlan'] = {'easeIn': ease_in, 'easeOut': ease_out, 'keys': keys}
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump({'seconds': shot['seconds'], 'cameraPlan': shot['cameraPlan']}, f); name = f.name
    subprocess.run(['node', os.path.join(HERE, 'camera-spline.mjs'), name], check=True, stdout=subprocess.DEVNULL)
    shot['camera'] = json.load(open(name))['camera']; os.unlink(name)


def people(shot, **cast):
    shot['people'] = cast


CHAPTERS = {}
def chapter(fn): CHAPTERS[fn.__name__] = fn; return fn


@chapter
def rise(s):
    # Home, one day in 18 seconds (the clock runs 08:00 to 17:30). Maya types seated in the morning, is on her feet
    # at the raised desk at midday, and sits again as the light turns to evening. Her chair stays in the room,
    # pushed back while she stands.
    people(s, only=['people-maya-sit-type', 'people-maya-stand-type'], chair={'back': 300, 'side': 760, 'turn': -42})


@chapter
def create(s):
    # Artist studio, his three acts (digital, drafting, oil) with the painter in them. Lin is at her easel as the
    # chapter opens and the camera passes beside her to the desk. After the board has tilted into the oil painting
    # the film cuts: it is later, and she is painting on the desk.
    people(s, only=['people-lin-stand-paint'], cast=[{'key': 'lin-desk', 'id': 'people-lin-stand-paint', 'at': [-200, -130], 'turn': 180}],
           when={'lin-desk': [[19.5, 99, 0, 0]], 'people-lin-stand-paint': [[0, 14]]})
    cam(s, [
        key(0, (-900, 1600, 4000), (-1500, 1200, 1200), 42, 'Lin at her easel, the desk across the studio'),
        key(2.4, (-1150, 1320, 2150), (-420, 1150, -700), 43, 'Past her, toward the desk'),
        key(4.2, (-1432, 1211, 1727), (-246, 1004, -620), 44, 'Desk: lift (blue)'),
        key(7.4, (-1113, 1823, 1790), (-225, 1167, -884), 46, 'Pen display at 52 in'),
        key(9.05, (-1113, 1823, 1790), (-225, 1167, -884), 46, 'Pen display at 52 in: hold'),
        key(12.4, (1033, 1491, 571), (-152, 1112, -943), 44, 'Front-right: board rises to drafting'),
        key(15.25, (2214, 1103, 991), (-215, 1012, -918), 44, 'Front-right 3/4: drafting'),
        key(19.45, (2214, 1103, 991), (-215, 1012, -918), 44, 'The board tilts on into the oil painting (hold)'),
        key(19.5, (520, 1520, 720), (-350, 1400, -800), 42, 'Later: Lin paints on the desk', cut=True),
        key(23.5, (860, 1330, 660), (-230, 1180, -900), 43, 'Slow arc around her brush hand'),
    ])

@chapter
def commons(s):
    # Humboldt commons. Mia, in the power wheelchair at the head of the table, calls the desk from her phone; her
    # teammates are already working. The desk leaves the wall and drives to her. As it docks the film cuts to her
    # side of the table: hands on the keyboard, the team across from her, the hall behind.
    people(s, only=['people-leo-sit-write', 'people-zoe-sit-laptop', 'people-eli-sit-listen', 'people-zoe-walk', 'people-ben-white-cane', 'people-grace-cane-stand'],
           cast=[{'key': 'mia-waits', 'id': 'people-mia-sit-phone', 'at': [7600, 2760], 'turn': 180, 'y': 75},
                 {'key': 'mia-works', 'id': 'people-mia-sit-type-30', 'at': [7600, 2740], 'turn': 180, 'y': 60},
                 {'key': 'mate-right', 'id': 'people-sofia-sit-laptop', 'at': [6100, 476], 'turn': -3, 'y': 20},
                 {'key': 'mate-left', 'id': 'people-kai-sit-write', 'at': [4868, 297], 'turn': -19, 'y': 20}],
           when={'mia-waits': [[0, 12.785, 0, 0]], 'mia-works': [[12.785, 99, 0, 0]]})
    # Her wheelchair is drawn up to where the desk will stop (400 mm nearer than his cut has it), so she is seated
    # in it with her hands on the keyboard when the desk arrives.
    for e in s['sceneEdits']:
        if e.get('match') == '^Prop:electric-wheelchair$': e['position'] = [round(e['position'][0] - 400 * K, 4), e['position'][1], e['position'][2]]
    # His route to the table, a little higher and wider over it so the teammates are whole in the frame.
    cam(s, [
        key(0, (1435, 1489, -6399), (6795, -27, -1308), 58, 'Eagle eye: the double-height commons'),
        key(2, (2785, 2058, -2840), (7735, 970, -1411), 55, 'Glide in high over the tables'),
        key(5.6, (2350, 2450, 650), (8153, 597, -1392), 46, 'The desk turns off the wall; the team at the table below'),
        key(8.6, (3050, 2300, 180), (8153, 530, -928), 42, 'Whole desk on the drive'),
        key(10.8, (3977, 1955, 1591), (8020, 563, 133), 41, 'Track right along the table'),
        key(12.75, (4850, 1560, 2800), (7560, 760, 1650), 43, 'The desk reaches the table head, Mia waiting'),
        key(12.8, (8350, 1450, 3350), (6500, 850, 1500), 42, 'Her side: hands on the keyboard, the team across the table', cut=True),
        key(16, (8470, 1340, 3080), (6380, 900, 1640), 40, 'Slow push over her shoulder'),
    ])

@chapter
def coast(s):
    # OCC media lab: the bays are in use (Maya edits at the centre one, which the camera comes down the aisle
    # over); the featured suite is the free one. It rises for whoever is watching, and the camera ends where its
    # user would stand. His camera, unchanged.
    people(s, **{'except': ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type', 'people-noah-sit-laptop']},
           cast=[{'key': 'bay-1', 'id': 'people-maya-sit-type', 'station': 'film-edit-01', 'desk': 'sit'}])

@chapter
def oilers(s):
    # High school: the whole class, minus the seat the camera flies through. Kai, in his wheelchair, is at the
    # set-design desk (tilted up as a drafting board in the film, so he is not typing). Noah has the featured desk.
    # His tour of the room lands on Noah seated at it; the film cuts to the desktop as it rises, then to the window
    # side: Noah on his feet at the raised desk, the class behind him.
    people(s, **{'except': ['people-ava-sit-write', 'people-maya-sit-type', 'people-maya-stand-type', 'people-kai-wheel-type', 'people-noah-sit-type']},
           cast=[{'key': 'kai', 'id': 'people-kai-wheel-roll', 'at': [-4300, 4735], 'turn': 180},
                 {'key': 'noah-sits', 'id': 'people-noah-sit-type-30', 'desk': 'sit'},
                 {'key': 'noah-stands', 'id': 'people-noah-stand-type', 'desk': 'stand'}],
           when={'noah-sits': [[0, 8.25, 0, 0]], 'noah-stands': [[10.69, 99, 0, 0]]}, chair={'back': 250, 'side': -780, 'turn': 35})
    cam(s, [
        key(0, (-2148, 398, 3318), (-5190, 1104, 6660), 42, 'Home of the Oilers: banner, longboard, Kai at the set-design desk'),
        key(0.6, (-2148, 398, 3318), (-5190, 1104, 6660), 42, 'Home of the Oilers (hold)'),
        key(3, (-2121, 1624, 4772), (-7404, 1067, 5235), 42, 'Over the set-design desk: crane up'),
        key(5.6, (156, 1989, 2996), (-4642, 1301, -378), 42, 'Along the window'),
        key(7.8, (-1650, 1063, 765), (-3861, 944, -1879), 42, 'Noah at the featured desk'),
        key(8.2, (-1650, 1063, 765), (-3861, 944, -1879), 42, 'The lift starts (hold)'),
        key(8.25, (-3000, 1000, -900), (-3800, 800, -2000), 40, 'The desktop, rising', cut=True),
        key(10.65, (-2950, 1330, -950), (-3800, 1130, -2000), 40, 'Up with the desktop'),
        key(10.7, (-4900, 1550, -1700), (-3600, 1150, -1400), 52, 'Noah on his feet, the class behind him', cut=True),
        key(14, (-4790, 1500, -1640), (-3600, 1160, -1400), 50, 'Slow push'),
    ])

@chapter
def wellness(s):
    # Gym: Maya works seated, then standing; Priya stretches by the mirrors, clear of the opening frame.
    people(s, only=['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type', 'people-priya-stretch'],
           place={'people-priya-stretch': {'at': [780, -1050], 'turn': 180}})


@chapter
def awareness(s):
    # "It sees what's in its way": the thing in the way is a person, not a pylon. Grace stands with her walking
    # stick where the pylon rose; the desk rolls toward her and stops. A person is deeper than the pylon, so she
    # stands further ahead: the desk's stopping point is unchanged and ends a hand's width from her stick.
    if s.get('obstacles'):
        s['obstacles'] = [dict(o, person='people-grace-cane-stand', ahead=1.1) if i == 0 else o for i, o in enumerate(s['obstacles'])]


@chapter
def music(s):
    # Gaming room: a friend on the sofa; the desk's screen is the subject, so nobody sits in front of it.
    people(s, only=['people-kai-sit-controller'])


@chapter
def storage(s):
    # Workshop. Andre has stepped to the left of the desk with the app on his phone: one tap, the desk folds, rolls
    # past him and parks at the wall. Jo works at the bench behind. The desk's path (x -660..860 while it rolls to
    # the front, then right to the rack) stays clear of both.
    people(s, only=['people-jo-stand-work', 'people-andre-stand-phone'], place={'people-andre-stand-phone': {'at': [-1350, 1550], 'turn': 100}})
    # The chapter opens on the tap, then pulls back and up to his wide as the board starts to fold. From there on
    # the camera is his.
    cam(s, [
        key(0, (-500, 1500, 2720), (-1500, 1330, 1400), 40, 'Andre, the desk app on his phone'),
        key(1.5, (-590, 1500, 2600), (-1500, 1335, 1400), 39, 'The tap'),
        key(3.5, (494, 1939, 4414), (174, 428, 273), 40, 'Back and up: the board starts to fold'),
        key(4.3, (494, 1939, 4414), (174, 428, 273), 40, 'Fold, wide (hold)'),
        key(6, (1911, 1335, 2916), (-160, 690, 840), 44, 'Desk folding, centred'),
        key(8.3, (1911, 1335, 2916), (-160, 690, 840), 44, 'Desk folding, centred (hold)'),
        key(10, (182, 1137, 4882), (254, 781, 434), 42, 'Roll begins'),
        key(13.2, (-1500, 984, 4500), (1400, 600, 1300), 40, 'Track the roll'),
        key(14, (-1500, 984, 4500), (1400, 600, 1300), 40, 'Track the roll (hold)'),
        key(17.3, (-932, 964, 4724), (598, 864, 2598), 42, 'Parked: floor clear'),
        key(19.6, (-1612, 923, 4279), (392, 883, 2352), 42, 'Drift with the turn'),
        key(20.5, (-1612, 923, 4279), (392, 883, 2352), 42, 'Drift with the turn (hold)'),
        key(22.1, (-1140, 678, 4444), (1027, 938, 2179), 42, 'Ending hold'),
        key(24.978, (-1140, 678, 4444), (1027, 938, 2179), 42, 'Ending hold'),
    ])


for shot in cut['shots']:
    fn = CHAPTERS.get(shot['id'])
    if fn and (not ONLY or shot['id'] in ONLY): fn(shot)
cut['name'] = (cut.get('name') or 'Review cut') + ' · alternate'
json.dump(cut, open(out, 'w'), indent=1)
print('alternate cut:', out, {s['id']: bool(s.get('people')) for s in cut['shots']})
