"""The people who live and work in the rooms: who they are, how they stand or sit,
and which posed models are built (tools/people/build_people.py).

Characters are MakeHuman (MPFB) parameter sets, all CC0 assets. Poses are in the
character's frame, metres, Z up, facing -Y, floor at Z = 0, and the pelvis stays
over the origin, so a seated person drops onto a chair placed at the same spot
with the same turn. See pose_lib.py for the pose fields.

Furniture the seated and desk poses are built for (measured in the app):
  task chair seat 0.435 m; keyboard top 0.732 m at the 28 in desk height and
  1.126 m at 43.5 in; wrists rest ~0.40 m in front of the pelvis.
"""

SEAT = .435          # Steelcase Leap seat
KEYS_SIT = .732      # keyboard top, desk at 28 in
KEYS_STAND = 1.126   # keyboard top, desk at 43.5 in


def race(caucasian=0., african=0., asian=0.):
    total = caucasian + african + asian
    return {'caucasian': caucasian / total, 'african': african / total, 'asian': asian / total}


CHARACTERS = {
    'maya': {
        'name': 'Maya', 'phenotype': {'gender': .0, 'age': .42, 'muscle': .45, 'weight': .5, 'height': .5, 'proportions': .6, 'race': race(.55, .2, .25)},
        'skin': 'young_caucasian_female2', 'eyes': 'brown', 'hair': 'ponytail01', 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes05'],
        'tint': {'toigo_basic_tucked_t-shirt': (.8, .76, .68), 'toigo_wool_pants': (.2, .26, .34)},
    },
    'andre': {
        'name': 'Andre', 'phenotype': {'gender': 1., 'age': .5, 'muscle': .6, 'weight': .52, 'height': .5, 'proportions': .6, 'race': race(.05, .9, .05)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'short02', 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes04'],
        'hair_tint': (.05, .045, .04),
        'tint': {'namuhekam_male_polo_shirt': (.16, .36, .34), 'cortu_cargo_pants': (.5, .45, .37)},
    },
}

_TYPE_L = {'fingers': (-.12, -1, -.2), 'palm': (0, 0, -1), 'curl': .45, 'thumb': .3, 'spread': .3}
_TYPE_R = {'fingers': (.12, -1, -.2), 'palm': (0, 0, -1), 'curl': .45, 'thumb': .3, 'spread': .3}

POSES = {
    # Seated at the desk, both hands on the keyboard, eyes on the screen.
    'sit-type': {
        'pelvis': (0, .02, SEAT + .09), 'pelvis_pitch': 2, 'spine': (3, 4, 4), 'neck': 2, 'head': -2,
        'hand_l': {'at': (.14, -.385, KEYS_SIT + .04), 'elbow': (.16, .28, -.3), **_TYPE_L},
        'hand_r': {'at': (-.14, -.385, KEYS_SIT + .04), 'elbow': (-.16, .28, -.3), **_TYPE_R},
        'foot_l': {'at': (.12, -.40, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.13, -.33, .075), 'toes': (-.22, -1, 0)},
    },
    # Standing at the raised desk, typing. The feet sit a little behind the pelvis line: weight forward.
    'stand-type': {
        'spine': (2, 3, 3), 'neck': 5, 'head': 4,
        'hand_l': {'at': (.14, -.33, KEYS_STAND + .04), 'elbow': (.2, .3, -.35), **_TYPE_L},
        'hand_r': {'at': (-.14, -.33, KEYS_STAND + .04), 'elbow': (-.2, .3, -.35), **_TYPE_R},
        'foot_l': {'at': (.11, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.12, .06, .07), 'toes': (-.3, -1, 0)},
    },
}

# id -> character, pose, library name, rooms that use it.
OUTPUTS = [
    {'id': 'people-maya-sit-type', 'character': 'maya', 'pose': 'sit-type', 'name': 'Maya, typing at the desk (seated)'},
    {'id': 'people-maya-stand-type', 'character': 'maya', 'pose': 'stand-type', 'name': 'Maya, typing at the desk (standing)'},
    {'id': 'people-andre-sit-type', 'character': 'andre', 'pose': 'sit-type', 'name': 'Andre, typing at the desk (seated)'},
    {'id': 'people-andre-stand-type', 'character': 'andre', 'pose': 'stand-type', 'name': 'Andre, typing at the desk (standing)'},
]
