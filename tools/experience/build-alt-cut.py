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
    # Humboldt commons: Rosa, who is of short stature, works standing at the desk; students at the tables, people
    # crossing the hall.
    people(s, only=['people-rosa-stand-type-30', 'people-leo-sit-write', 'people-zoe-sit-laptop', 'people-eli-sit-listen', 'people-zoe-walk', 'people-ben-white-cane', 'people-grace-cane-stand'])


@chapter
def coast(s):
    # OCC media lab: the other stations are in use; the featured desk stays free for the over-the-keyboard shots.
    people(s, **{'except': ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type']})


@chapter
def oilers(s):
    # High school: the whole class, minus the seat the camera flies through.
    people(s, **{'except': ['people-ava-sit-write']})


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
