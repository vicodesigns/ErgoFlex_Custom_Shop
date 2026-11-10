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
    'grace': {
        'name': 'Grace', 'phenotype': {'gender': .0, 'age': .86, 'muscle': .35, 'weight': .56, 'height': .42, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'old_caucasian_female', 'eyes': 'grey', 'hair': 'rehmanpolanski_hair_bun_brown', 'hair_tint': (.62, .61, .6), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'toigo_flats', 'spamrakuen_tbm_glasses_frames_01'],
        'tint': {'toigo_fisherman_sweater': (.5, .3, .32), 'toigo_wool_pants': (.22, .2, .19), 'toigo_flats': (.12, .1, .1)},
    },
    'kai': {
        'name': 'Kai', 'phenotype': {'gender': 1., 'age': .33, 'muscle': .45, 'weight': .45, 'height': .45, 'proportions': .55, 'race': race(.1, 0, .9)},
        'skin': 'young_asian_male', 'eyes': 'brown', 'hair': 'short04', 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes06'],
        'tint': {'namuhekam_male_polo_shirt': (.72, .3, .12), 'toigo_wool_pants': (.13, .14, .17)},
    },
    'zoe': {
        'name': 'Zoe', 'phenotype': {'gender': .0, 'age': .33, 'muscle': .45, 'weight': .48, 'height': .48, 'proportions': .6, 'race': race(.05, .9, .05)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'afro01', 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['joepal_crude_t-shirt_female', 'toigo_wool_pants', 'shoes05'],
        'tint': {'joepal_crude_t-shirt_female': (.82, .6, .16), 'toigo_wool_pants': (.2, .27, .4)},
    },
    'hale': {
        'name': 'Mr Hale', 'phenotype': {'gender': 1., 'age': .7, 'muscle': .45, 'weight': .58, 'height': .52, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_male', 'eyes': 'blue', 'hair': 'short01', 'hair_tint': (.45, .44, .43), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit03', 'shoes01', 'spamrakuen_tbm_glasses_frames_01'],
    },
    'lin': {
        'name': 'Lin', 'phenotype': {'gender': .0, 'age': .55, 'muscle': .4, 'weight': .45, 'height': .45, 'proportions': .6, 'race': race(.05, 0, .95)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'toigo_blunt_bob_with_bangs', 'hair_tint': (.05, .045, .045), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'toigo_flats'],
        'tint': {'toigo_basic_tucked_t-shirt': (.2, .22, .26), 'toigo_wool_pants': (.36, .38, .28), 'toigo_flats': (.1, .1, .1)},
    },
    'omar': {
        'name': 'Omar', 'phenotype': {'gender': 1., 'age': .6, 'muscle': .6, 'weight': .55, 'height': .5, 'proportions': .55, 'race': race(.55, .15, .3)},
        'skin': 'middleage_asian_male', 'eyes': 'brown', 'hair': 'short02', 'hair_tint': (.06, .05, .05), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit05', 'shoes02'],
    },
    'sam': {
        'name': 'Sam', 'phenotype': {'gender': 1., 'age': .44, 'muscle': .55, 'weight': .48, 'height': .55, 'proportions': .6, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male2', 'eyes': 'green', 'hair': 'cortu_short_messy_hair', 'hair_tint': (.3, .2, .12), 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes05'], 'prosthesis': 'r', 'crop': ['cortu_cargo_pants'],
        'tint': {'namuhekam_male_polo_shirt': (.12, .13, .16), 'cortu_cargo_pants': (.42, .4, .34)},
    },
    'ben': {
        'name': 'Ben', 'phenotype': {'gender': 1., 'age': .8, 'muscle': .45, 'weight': .55, 'height': .5, 'proportions': .5, 'race': race(.3, .7, 0)},
        'skin': 'old_african_male', 'eyes': 'brown', 'hair': 'short03', 'hair_tint': (.5, .5, .5), 'eyebrows': 'eyebrow010', 'eyelashes': 'eyelashes01',
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes01', 'toigo_round_glasses_leopard'],
        'tint': {'toigo_fisherman_sweater': (.14, .2, .32), 'toigo_wool_pants': (.3, .27, .23), 'toigo_round_glasses_leopard': (.03, .03, .03)},
    },
    'rosa': {
        'name': 'Rosa', 'phenotype': {'gender': .0, 'age': .5, 'muscle': .5, 'weight': .55, 'height': .35, 'proportions': .5, 'race': race(.7, .1, .2)},
        'skin': 'young_caucasian_female', 'eyes': 'brown', 'hair': 'long01', 'hair_tint': (.12, .07, .05), 'eyebrows': 'eyebrow011', 'eyelashes': 'eyelashes03',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'toigo_flats'], 'limbs': (.6, .66),
        'tint': {'toigo_basic_tucked_t-shirt': (.6, .14, .32), 'toigo_wool_pants': (.12, .12, .14), 'toigo_flats': (.5, .12, .25)},
    },
    'priya': {
        'name': 'Priya', 'phenotype': {'gender': .0, 'age': .45, 'muscle': .55, 'weight': .45, 'height': .5, 'proportions': .65, 'race': race(.35, .15, .5)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'braid01', 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes02',
        'clothes': ['female_sportsuit01', 'shoes05'],
    },
    'jo': {
        'name': 'Jo', 'phenotype': {'gender': .0, 'age': .62, 'muscle': .55, 'weight': .55, 'height': .55, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_female', 'eyes': 'bluegreen', 'hair': 'bob01', 'hair_tint': (.42, .2, .1), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'clothes': ['male_worksuit01', 'shoes02'],
    },
}

_TYPE_L = {'fingers': (-.12, -1, -.2), 'palm': (0, 0, -1), 'curl': .45, 'thumb': .3, 'spread': .3}
_TYPE_R = {'fingers': (.12, -1, -.2), 'palm': (0, 0, -1), 'curl': .45, 'thumb': .3, 'spread': .3}
TABLE = .74          # classroom / library / cafe table top
CHAIR = .45          # side chair seat
LOUNGE = .42         # armchair and sofa seat


def _s(k, *v):
    return tuple(x * k for x in v)


def _hang(k, side, swing=0.):
    """An arm hanging at the side; swing moves the hand forward (-) or back (+)."""
    s = 1 if side == 'l' else -1
    return {'at': _s(k, s * .235, .03 + swing, .845), 'fingers': (0, -.12 + swing, -1), 'palm': (-s, 0, 0), 'elbow': (s * .08, .3, .05), 'curl': .4, 'thumb': .25}


def stand_phone(k):
    """Weight on one leg, phone in the right hand, eyes on it: the desk is driven from the app."""
    return {'pelvis_offset': (.02, 0, -.005), 'pelvis_roll': -2, 'spine': (1, 2, 3), 'neck': 12, 'head': 14,
            'hand_r': {'at': _s(k, -.11, -.25, 1.17), 'fingers': (.15, -.25, 1), 'palm': (.1, 1, .3), 'elbow': (-.22, .25, -.4), 'curl': .62, 'thumb': .45},
            'hand_l': _hang(k, 'l'),
            'foot_l': {'at': _s(k, .10, .0, .07 / k), 'toes': (.3, -1, 0)}, 'foot_r': {'at': _s(k, -.12, .04, .07 / k), 'toes': (-.35, -1, 0)}}


def stand_present(k):
    """Facing the room, right arm out toward the board, tablet on the left forearm."""
    return {'spine': (0, 1, 1), 'spine_twist': -10, 'neck': 0, 'head': -2, 'head_yaw': 12,
            'hand_r': {'at': _s(k, -.5, -.12, 1.2), 'fingers': (-1, -.05, .12), 'palm': (.1, -.55, 1), 'elbow': (-.05, .3, -.4), 'curl': .18, 'thumb': .1, 'spread': .3},
            'hand_l': {'at': _s(k, .17, -.24, 1.08), 'fingers': (-.75, -.65, .05), 'palm': (0, .15, 1), 'elbow': (.25, .25, -.3), 'curl': .25, 'thumb': .1},
            'foot_l': {'at': _s(k, .12, .0, .07 / k), 'toes': (.3, -1, 0)}, 'foot_r': {'at': _s(k, -.13, .03, .07 / k), 'toes': (-.45, -1, 0)}}


def walk(k):
    """Mid-stride: left heel down, right toe leaving the floor, arms swinging against the legs."""
    return {'pelvis_offset': (0, 0, -.03 * k), 'pelvis_yaw': 4, 'spine': (3, 2, 1), 'spine_twist': -8, 'neck': 2, 'head': 0, 'head_yaw': 4,
            'hand_l': _hang(k, 'l', .2), 'hand_r': _hang(k, 'r', -.22),
            'foot_l': {'at': _s(k, .085, -.33, .09 / k), 'toes': (.08, -1, 0), 'pitch': -14, 'knee': (.03, -.6, .1)},
            'foot_r': {'at': _s(k, -.085, .3, .15 / k), 'toes': (-.08, -1, 0), 'pitch': 42, 'knee': (-.03, -.7, -.1)}}


def stand_paint(k):
    """At an easel: brush out to the canvas, palette on the other hand, weight on the back foot."""
    return {'spine': (0, 1, 2), 'spine_twist': 8, 'neck': 2, 'head': 0, 'head_yaw': -6, 'head_roll': 5,
            'hand_r': {'at': _s(k, -.2, -.42, 1.22), 'fingers': (.15, -1, .1), 'palm': (.85, .1, -.5), 'elbow': (-.25, .2, -.35), 'curl': .72, 'thumb': .55},
            'hand_l': {'at': _s(k, .27, -.2, 1.03), 'fingers': (-.45, -.9, .1), 'palm': (0, .15, 1), 'elbow': (.25, .25, -.3), 'curl': .25, 'thumb': .2},
            'foot_l': {'at': _s(k, .12, -.12, .07 / k), 'toes': (.2, -1, 0)}, 'foot_r': {'at': _s(k, -.13, .1, .07 / k), 'toes': (-.5, -1, 0)}}


def stretch(k):
    """A standing break: both arms overhead, hands together, a gentle side bend."""
    return {'spine': (-2, -2, -3), 'spine_side': 12, 'neck': -4, 'head': -6,
            'hand_l': {'at': _s(k, .0, -.03, 1.97), 'fingers': (-.05, 0, 1), 'palm': (-1, 0, 0), 'elbow': (.3, .1, .2), 'curl': .1, 'thumb': .1},
            'hand_r': {'at': _s(k, -.07, -.03, 1.97), 'fingers': (.05, 0, 1), 'palm': (1, 0, 0), 'elbow': (-.3, .1, .2), 'curl': .1, 'thumb': .1},
            'foot_l': {'at': _s(k, .13, .0, .07 / k), 'toes': (.2, -1, 0)}, 'foot_r': {'at': _s(k, -.13, .0, .07 / k), 'toes': (-.2, -1, 0)}}


def cane_stand(k):
    """Standing with a walking stick in the right hand, a little weight on it."""
    return {'spine': (4, 6, 6), 'neck': -4, 'head': -6, 'pelvis_offset': (0, 0, -.01),
            'hand_r': {'at': _s(k, -.27, -.1, .87), 'fingers': (0, -1, -.1), 'palm': (0, 0, -1), 'elbow': (-.15, .3, .1), 'curl': .85, 'thumb': .6},
            'hand_l': _hang(k, 'l'),
            'foot_l': {'at': _s(k, .09, .0, .07 / k), 'toes': (.2, -1, 0)}, 'foot_r': {'at': _s(k, -.1, .05, .07 / k), 'toes': (-.25, -1, 0)}}


def white_cane(k):
    """Walking with a long white cane swept ahead in the right hand."""
    return {'pelvis_offset': (0, 0, -.02 * k), 'spine': (2, 2, 1), 'spine_twist': 5, 'neck': -2, 'head': -2,
            'hand_r': {'at': _s(k, -.14, -.3, .93), 'fingers': (.1, -1, -.5), 'palm': (1, 0, .1), 'elbow': (-.2, .3, -.2), 'curl': .85, 'thumb': .6},
            'hand_l': _hang(k, 'l', .1),
            'foot_l': {'at': _s(k, .085, .2, .12 / k), 'toes': (.08, -1, 0), 'pitch': 30, 'knee': (.03, -.7, -.1)},
            'foot_r': {'at': _s(k, -.085, -.22, .085 / k), 'toes': (-.08, -1, 0), 'pitch': -10, 'knee': (-.03, -.6, .1)}}


WHEEL_SEAT = .5      # manual wheelchair seat
KEYS_WHEEL = .808    # keyboard top with the desk at 31 in, raised so the knees clear the tray

POSES = {
    # In a manual wheelchair at the desk (desk at 31 in).
    'wheel-type': {
        'pelvis': (0, .03, WHEEL_SEAT + .095), 'pelvis_pitch': 2, 'spine': (3, 4, 4), 'neck': 2, 'head': -2,
        'hand_l': {'at': (.14, -.375, KEYS_WHEEL + .04), 'elbow': (.16, .28, -.3), **_TYPE_L},
        'hand_r': {'at': (-.14, -.375, KEYS_WHEEL + .04), 'elbow': (-.16, .28, -.3), **_TYPE_R},
        'foot_l': {'at': (.085, -.41, .235), 'toes': (.1, -1, 0)}, 'foot_r': {'at': (-.085, -.41, .235), 'toes': (-.1, -1, 0)},
    },
    # Rolling: both hands on the handrims, looking ahead.
    'wheel-roll': {
        'pelvis': (0, .03, WHEEL_SEAT + .095), 'pelvis_pitch': 6, 'spine': (5, 6, 4), 'neck': -8, 'head': -8, 'head_yaw': 10,
        'hand_l': {'at': (.305, .0, WHEEL_SEAT + .075), 'fingers': (0, -.6, -1), 'palm': (-1, 0, 0), 'elbow': (.2, .4, .2), 'curl': .7, 'thumb': .3},
        'hand_r': {'at': (-.305, .0, WHEEL_SEAT + .075), 'fingers': (0, -.6, -1), 'palm': (1, 0, 0), 'elbow': (-.2, .4, .2), 'curl': .7, 'thumb': .3},
        'foot_l': {'at': (.085, -.41, .235), 'toes': (.1, -1, 0)}, 'foot_r': {'at': (-.085, -.41, .235), 'toes': (-.1, -1, 0)},
    },
    # On a sofa, leaning in with a controller.
    'sit-controller': {
        'pelvis': (0, .0, LOUNGE + .09), 'pelvis_pitch': 14, 'spine': (8, 8, 6), 'neck': -8, 'head': -10,
        'hand_l': {'at': (.085, -.37, LOUNGE + .21), 'fingers': (-.45, -.85, .25), 'palm': (-.8, .2, .55), 'elbow': (.3, .1, -.2), 'curl': .6, 'thumb': .4},
        'hand_r': {'at': (-.085, -.37, LOUNGE + .21), 'fingers': (.45, -.85, .25), 'palm': (.8, .2, .55), 'elbow': (-.3, .1, -.2), 'curl': .6, 'thumb': .4},
        'foot_l': {'at': (.17, -.43, .075), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.17, -.43, .075), 'toes': (-.25, -1, 0)},
    },
    # At a workbench (0.92 m): one hand steadying the work, a tool in the other.
    'stand-work': {
        'spine': (6, 8, 6), 'neck': 10, 'head': 12,
        'hand_l': {'at': (.2, -.37, .95), 'fingers': (-.4, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.25, .3, -.2), 'curl': .2, 'thumb': .1, 'spread': .3},
        'hand_r': {'at': (-.1, -.36, 1.03), 'fingers': (.6, -.8, -.1), 'palm': (.3, .3, -1), 'elbow': (-.3, .25, -.2), 'curl': .8, 'thumb': .6},
        'foot_l': {'at': (.12, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.13, .07, .07), 'toes': (-.3, -1, 0)},
    },
    # Standing at the desk's lowest setting (28 in): the working height for a person of short stature.
    'stand-type-low': {
        'spine': (1, 2, 2), 'neck': 0, 'head': -4,
        'hand_l': {'at': (.13, -.27, KEYS_SIT + .04), 'elbow': (.2, .3, -.3), **_TYPE_L},
        'hand_r': {'at': (-.13, -.27, KEYS_SIT + .04), 'elbow': (-.2, .3, -.3), **_TYPE_R},
        'foot_l': {'at': (.1, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.11, .05, .07), 'toes': (-.3, -1, 0)},
    },
    'stand-paint': stand_paint,
    'stretch': stretch,
    'cane-stand': cane_stand,
    'white-cane': white_cane,
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
    # At a table, writing: leaning in, pen in the right hand, left forearm on the table.
    'sit-write': {
        'pelvis': (0, .0, CHAIR + .09), 'pelvis_pitch': 8, 'spine': (7, 9, 8), 'neck': 12, 'head': 14, 'head_yaw': -6,
        'hand_r': {'at': (-.1, -.36, TABLE + .035), 'fingers': (.45, -1, -.3), 'palm': (.45, .1, -1), 'elbow': (-.3, .15, -.25), 'curl': .7, 'thumb': .55},
        'hand_l': {'at': (.2, -.33, TABLE + .028), 'fingers': (-.55, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.3, .15, -.25), 'curl': .15, 'thumb': .1, 'spread': .3},
        'foot_l': {'at': (.13, -.3, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.12, -.2, .075), 'toes': (-.2, -1, 0)},
    },
    # At a table with a laptop.
    'sit-laptop': {
        'pelvis': (0, .0, CHAIR + .09), 'pelvis_pitch': 3, 'spine': (4, 5, 5), 'neck': 8, 'head': 8,
        'hand_l': {'at': (.11, -.36, TABLE + .05), 'elbow': (.2, .25, -.3), **_TYPE_L},
        'hand_r': {'at': (-.11, -.36, TABLE + .05), 'elbow': (-.2, .25, -.3), **_TYPE_R},
        'foot_l': {'at': (.12, -.36, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.14, -.27, .075), 'toes': (-.25, -1, 0)},
    },
    # Leaning back in an armchair or on a sofa with an open book.
    'sit-read': {
        'pelvis': (0, .03, LOUNGE + .09), 'pelvis_pitch': -9, 'spine': (-1, 3, 6), 'neck': 10, 'head': 10,
        'hand_l': {'at': (.105, -.25, LOUNGE + .4), 'fingers': (-.35, -.45, .8), 'palm': (-.25, .75, .6), 'elbow': (.25, .2, -.3), 'curl': .3, 'thumb': .1},
        'hand_r': {'at': (-.105, -.25, LOUNGE + .4), 'fingers': (.35, -.45, .8), 'palm': (.25, .75, .6), 'elbow': (-.25, .2, -.3), 'curl': .3, 'thumb': .1},
        'foot_l': {'at': (.15, -.42, .075), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.13, -.5, .075), 'toes': (-.2, -1, 0)},
    },
    'stand-phone': stand_phone,
    'stand-present': stand_present,
    'walk': walk,
}

# id -> character, pose, library name, what they hold.
OUTPUTS = [
    {'id': 'people-maya-sit-type', 'character': 'maya', 'pose': 'sit-type', 'name': 'Maya, typing at the desk (seated)'},
    {'id': 'people-maya-stand-type', 'character': 'maya', 'pose': 'stand-type', 'name': 'Maya, typing at the desk (standing)'},
    {'id': 'people-andre-sit-type', 'character': 'andre', 'pose': 'sit-type', 'name': 'Andre, typing at the desk (seated)'},
    {'id': 'people-andre-stand-type', 'character': 'andre', 'pose': 'stand-type', 'name': 'Andre, typing at the desk (standing)'},
    {'id': 'people-andre-stand-phone', 'character': 'andre', 'pose': 'stand-phone', 'name': 'Andre, with the desk app on his phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-grace-sit-read', 'character': 'grace', 'pose': 'sit-read', 'name': 'Grace, reading in an armchair', 'held': [('book', {'side': 'l'})]},
    {'id': 'people-kai-sit-write', 'character': 'kai', 'pose': 'sit-write', 'name': 'Kai, writing at a table', 'held': [('pen', {'side': 'r'})]},
    {'id': 'people-zoe-sit-laptop', 'character': 'zoe', 'pose': 'sit-laptop', 'name': 'Zoe, at a laptop'},
    {'id': 'people-zoe-walk', 'character': 'zoe', 'pose': 'walk', 'name': 'Zoe, walking with a backpack', 'held': [('backpack', {})]},
    {'id': 'people-hale-stand-present', 'character': 'hale', 'pose': 'stand-present', 'name': 'Mr Hale, presenting', 'held': [('tablet', {'side': 'l'})]},
    {'id': 'people-omar-wheel-type', 'character': 'omar', 'pose': 'wheel-type', 'name': 'Omar, typing at the desk (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-omar-wheel-roll', 'character': 'omar', 'pose': 'wheel-roll', 'name': 'Omar, rolling (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-lin-stand-paint', 'character': 'lin', 'pose': 'stand-paint', 'name': 'Lin, painting at an easel', 'held': [('brush', {'side': 'r'}), ('palette', {'side': 'l'})]},
    {'id': 'people-sam-sit-game', 'character': 'sam', 'pose': 'sit-type', 'name': 'Sam, gaming at the desk', 'held': [('headphones', {}), ('prosthesis', {'side': 'r'})]},
    {'id': 'people-sam-stand-type', 'character': 'sam', 'pose': 'stand-type', 'name': 'Sam, at the desk (standing)', 'held': [('prosthesis', {'side': 'r'})]},
    {'id': 'people-kai-sit-controller', 'character': 'kai', 'pose': 'sit-controller', 'name': 'Kai, on the sofa with a controller', 'held': [('gamepad', {})]},
    {'id': 'people-priya-stretch', 'character': 'priya', 'pose': 'stretch', 'name': 'Priya, stretching'},
    {'id': 'people-jo-stand-work', 'character': 'jo', 'pose': 'stand-work', 'name': 'Jo, working at the bench', 'held': [('screwdriver', {'side': 'r'})]},
    {'id': 'people-grace-cane-stand', 'character': 'grace', 'pose': 'cane-stand', 'name': 'Grace, standing with a walking stick', 'held': [('cane', {'side': 'r'})]},
    {'id': 'people-ben-white-cane', 'character': 'ben', 'pose': 'white-cane', 'name': 'Ben, walking with a white cane', 'held': [('cane', {'side': 'r', 'white': True})]},
    {'id': 'people-rosa-stand-type-low', 'character': 'rosa', 'pose': 'stand-type-low', 'name': 'Rosa, at the desk on its lowest setting (standing)'},
]
