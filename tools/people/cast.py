"""The people who live and work in the rooms: who they are, how they stand or sit,
and which posed models are built (tools/people/build_people.py).

Characters are MakeHuman (MPFB) parameter sets, all CC0 assets. Poses are in the
character's frame, metres, Z up, facing -Y, floor at Z = 0, and the pelvis stays
over the origin, so a seated person drops onto a chair placed at the same spot
with the same turn. See pose_lib.py for the pose fields.

Furniture the seated and desk poses are built for (measured in the app):
  task chair seat 0.435 m; keyboard top 0.678 m at the 28 in desk height, 0.759 m
  at 31 in and 1.095 m at 43.5 in; wrists rest ~0.40 m in front of the pelvis.
"""

SEAT = .435          # Steelcase Leap seat
KEYS_SIT = .678      # keyboard top, desk at 28 in
KEYS_STAND = 1.095   # keyboard top, desk at 43.5 in


def race(caucasian=0., african=0., asian=0.):
    total = caucasian + african + asian
    return {'caucasian': caucasian / total, 'african': african / total, 'asian': asian / total}


# The role characters' outfits and the postures built of each (stage 1: the desk family and the everyday ones).
POLICE_NAVY, SECURITY_BLACK = (.055, .075, .15), (.04, .04, .045)
SCRUBS_TEAL, SCRUBS_BLUE, SCRUBS_PLUM = (.08, .42, .44), (.13, .27, .5), (.38, .13, .32)
# (items_in: where the belt's things are in one posture: at ease the thumbs are hooked where the keys and a pouch hang)
POLICE_GEAR = [('belt', {'items': [('keys', 42), ('radio', 118), ('cuffs', 172), ('light', -122), ('pouch', -52)],
                         'items_in': {'stand-brief': [('keys', 64), ('radio', 118), ('cuffs', 172), ('light', -126), ('pouch', -68)]}}), ('badge', {}), ('nameplate', {}), ('shoulder_patch', {}),
               ('shoulder_mic', {'not_in': ('stand-radio',)})]       # (calling in, the microphone is in the hand)
SECURITY_GEAR = [('belt', {'items': [('radio', 118), ('pouch', -55)], 'items_in': {'stand-brief': [('radio', 118), ('pouch', -68)]}, 'width': .045}), ('chest_patch', {}), ('back_text', {}), ('shoulder_patch', {'color': (.85, .85, .82), 'field': (.75, .12, .1)}), ('lanyard', {'color': (.85, .7, .1)})]
EVERYDAY = ['sit-type', 'stand-low', 'stand-mid', 'stand-type', 'stand-wait', 'stand-talk', 'stand-phone', 'stand-present', 'stand-work', 'walk', 'sit-write', 'sit-listen', 'sit-laptop', 'sit-read']
POLICE_POSTURES = EVERYDAY + ['stand-brief', 'stand-radio']
NURSE_POSTURES = EVERYDAY + ['stand-chart', 'push-cart']
DOCTOR_POSTURES = EVERYDAY + ['stand-chart']
LAB_POSTURES = EVERYDAY + ['stand-chart', 'sit-microscope']
IT_POSTURES = EVERYDAY + ['push-cart']
CLERK_POSTURES = EVERYDAY + ['stand-counter']
STUDENT_POSTURES = EVERYDAY + ['sit-raise']
PATIENT_POSTURES = ['sit-read', 'sit-listen', 'stand-wait', 'walk', 'lie-bed']
# Round three's everyday people: the desk family and what a room's hours ask of anyone.
CROWD = ['sit-type', 'stand-low', 'stand-mid', 'stand-type', 'stand-wait', 'stand-talk', 'stand-phone', 'stand-present', 'stand-work', 'stand-mug', 'stand-drink', 'walk',
         'sit-write', 'sit-listen', 'sit-laptop', 'sit-read', 'sit-phone', 'sit-chat']

CHARACTERS = {
    'maya': {
        'name': 'Maya', 'phenotype': {'gender': .0, 'age': .42, 'muscle': .45, 'weight': .5, 'height': .61, 'proportions': .6, 'race': race(.55, .2, .25)},
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
        'name': 'Zoe', 'phenotype': {'gender': .0, 'age': .33, 'muscle': .45, 'weight': .48, 'height': .59, 'proportions': .6, 'race': race(.05, .9, .05)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'afro01', 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes05'],
        'tint': {'toigo_basic_tucked_t-shirt': (.82, .6, .16), 'toigo_wool_pants': (.2, .27, .4)},
    },
    'hale': {
        'name': 'Mr Hale', 'phenotype': {'gender': 1., 'age': .7, 'muscle': .45, 'weight': .58, 'height': .52, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_male', 'eyes': 'blue', 'hair': 'short01', 'hair_tint': (.45, .44, .43), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit03', 'shoes01', 'spamrakuen_tbm_glasses_frames_01'],
    },
    'lin': {
        'name': 'Lin', 'phenotype': {'gender': .0, 'age': .55, 'muscle': .4, 'weight': .45, 'height': .535, 'proportions': .6, 'race': race(.05, 0, .95)},
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
        'name': 'Priya', 'phenotype': {'gender': .0, 'age': .45, 'muscle': .55, 'weight': .45, 'height': .6, 'proportions': .65, 'race': race(.35, .15, .5)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'braid01', 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes02',
        'clothes': ['female_sportsuit01', 'shoes05'],
    },
    'jo': {
        'name': 'Jo', 'phenotype': {'gender': .0, 'age': .62, 'muscle': .55, 'weight': .55, 'height': .55, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_female', 'eyes': 'bluegreen', 'hair': 'bob01', 'hair_tint': (.42, .2, .1), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'clothes': ['male_worksuit01', 'shoes02'],
    },
    'mia': {
        'name': 'Mia', 'phenotype': {'gender': .0, 'age': .32, 'muscle': .4, 'weight': .45, 'height': .59, 'proportions': .6, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_female', 'eyes': 'blue', 'hair': 'toigo_curled_under_bob', 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes06'],
        'tint': {'toigo_fisherman_sweater': (.3, .45, .4), 'toigo_wool_pants': (.2, .22, .3)},
    },
    'leo': {
        'name': 'Leo', 'phenotype': {'gender': 1., 'age': .32, 'muscle': .5, 'weight': .55, 'height': .4, 'proportions': .5, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_male', 'eyes': 'brown', 'hair': 'culturalibre_hair_01', 'hair_tint': (.07, .05, .04), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit06', 'shoes04'],
    },
    'noah': {
        'name': 'Noah', 'phenotype': {'gender': 1., 'age': .34, 'muscle': .55, 'weight': .45, 'height': .63, 'proportions': .6, 'race': race(.1, .85, .05)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'afro01', 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes05'],
        'tint': {'namuhekam_male_polo_shirt': (.85, .82, .76), 'cortu_cargo_pants': (.16, .18, .22)},
    },
    'ava': {
        'name': 'Ava', 'phenotype': {'gender': .0, 'age': .33, 'muscle': .4, 'weight': .42, 'height': .64, 'proportions': .6, 'race': race(.1, 0, .9)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'ponytail01', 'hair_tint': (.06, .05, .05), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes04'],
        'tint': {'toigo_basic_tucked_t-shirt': (.82, .8, .76), 'toigo_wool_pants': (.3, .2, .24)},
    },
    'eli': {
        'name': 'Eli', 'phenotype': {'gender': 1., 'age': .33, 'muscle': .45, 'weight': .5, 'height': .5, 'proportions': .55, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male', 'eyes': 'blue', 'hair': 'short01', 'hair_tint': (.5, .36, .2), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit01', 'shoes06'],
    },
    'sofia': {
        'name': 'Sofia', 'phenotype': {'gender': .0, 'age': .34, 'muscle': .45, 'weight': .52, 'height': .58, 'proportions': .55, 'race': race(.65, .15, .2)},
        'skin': 'young_caucasian_female2', 'eyes': 'brown', 'hair': 'braid01', 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes03',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'toigo_flats'],
        'tint': {'toigo_basic_tucked_t-shirt': (.2, .4, .55), 'toigo_wool_pants': (.72, .68, .6), 'toigo_flats': (.15, .15, .2)},
    },
    # Children (MakeHuman age: 0 = 1 year, .1875 = 10 years). Their poses scale with them (k) and sit on child furniture.
    # `height` is set so each stands about as tall as a child of that age (101 cm at four to 137 cm at ten).
    'tess': {
        'name': 'Tess', 'phenotype': {'gender': .0, 'age': .0625, 'muscle': .5, 'weight': .55, 'height': 0.71, 'proportions': .5, 'race': race(.4, .6, 0)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'afro01', 'hair_tint': (.06, .045, .04), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes05'],
        'tint': {'toigo_basic_tucked_t-shirt': (.85, .45, .5), 'toigo_wool_pants': (.3, .42, .62)},
    },
    'ravi': {
        'name': 'Ravi', 'phenotype': {'gender': 1., 'age': .125, 'muscle': .5, 'weight': .5, 'height': 0.625, 'proportions': .5, 'race': race(.3, .1, .6)},
        'skin': 'young_asian_male', 'eyes': 'brown', 'hair': 'short02', 'hair_tint': (.04, .035, .03), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes04'],
        'tint': {'namuhekam_male_polo_shirt': (.15, .5, .4), 'cortu_cargo_pants': (.25, .25, .3)},
    },
    'nora': {
        'name': 'Nora', 'phenotype': {'gender': .0, 'age': .1875, 'muscle': .45, 'weight': .48, 'height': 0.6, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_female', 'eyes': 'blue', 'hair': 'ponytail01', 'hair_tint': (.55, .38, .2), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes06', 'spamrakuen_tbm_glasses_frames_01'],
        'tint': {'toigo_fisherman_sweater': (.85, .62, .2), 'toigo_wool_pants': (.18, .22, .35)},
    },
    'jun': {
        'name': 'Jun', 'phenotype': {'gender': 1., 'age': .18, 'muscle': .5, 'weight': .45, 'height': 0.585, 'proportions': .5, 'race': race(.05, 0, .95)},
        'skin': 'young_asian_male', 'eyes': 'brown', 'hair': 'short04', 'hair_tint': (.04, .035, .035), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes06'],
        'tint': {'namuhekam_male_polo_shirt': (.75, .22, .15), 'toigo_wool_pants': (.2, .2, .22)},
    },
    'milo': {
        'name': 'Milo', 'phenotype': {'gender': 1., 'age': .083, 'muscle': .5, 'weight': .52, 'height': 0.66, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male', 'eyes': 'blue', 'hair': 'short03', 'hair_tint': (.62, .46, .26), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes05'],
        'tint': {'toigo_basic_tucked_t-shirt': (.2, .45, .75), 'cortu_cargo_pants': (.55, .45, .3)},
    },
    'lila': {
        'name': 'Lila', 'phenotype': {'gender': .0, 'age': .104, 'muscle': .45, 'weight': .5, 'height': 0.7, 'proportions': .5, 'race': race(.1, 0, .9)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'toigo_blunt_bob_with_bangs', 'hair_tint': (.05, .04, .04), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes04'],
        'tint': {'toigo_fisherman_sweater': (.55, .35, .65), 'toigo_wool_pants': (.85, .82, .75)},
    },
    'theo': {
        'name': 'Theo', 'phenotype': {'gender': 1., 'age': .146, 'muscle': .5, 'weight': .5, 'height': 0.55, 'proportions': .5, 'race': race(.05, .95, 0)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'short01', 'hair_tint': (.05, .04, .035), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes06'],
        'tint': {'namuhekam_male_polo_shirt': (.92, .48, .16), 'cortu_cargo_pants': (.2, .3, .45)},
    },
    'ines': {
        'name': 'Ines', 'phenotype': {'gender': .0, 'age': .167, 'muscle': .45, 'weight': .47, 'height': 0.635, 'proportions': .5, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_female', 'eyes': 'brown', 'hair': 'braid01', 'hair_tint': (.16, .1, .06), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes05'],
        'tint': {'toigo_basic_tucked_t-shirt': (.3, .6, .5), 'toigo_wool_pants': (.45, .25, .3)},
    },
    # ---- the institutional rooms' own people: police, security, hospital, laboratory, IT, government, middle school.
    # 'wear': garments made from the base mesh (garments.py: white coat, scrubs top, gown, socks, gloves);
    # 'gear': what the role wears on the body (worn.py: duty belt, badge, patches, radio, lanyard, stethoscope);
    # 'tuck': tops that end under the belt; 'carry': what they hold in one posture; 'postures': what is built of them.
    'reyes': {
        'name': 'Officer Reyes', 'role': 'police officer', 'phenotype': {'gender': .0, 'age': .57, 'muscle': .6, 'weight': .5, 'height': .55, 'proportions': .6, 'race': race(.6, .15, .25)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'rehmanpolanski_hair_bun_brown', 'hair_tint': (.07, .045, .03), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes03'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': POLICE_NAVY, 'toigo_wool_pants': POLICE_NAVY, 'shoes03': (.03, .03, .03)}, 'gear': POLICE_GEAR, 'postures': POLICE_POSTURES,
    },
    'cole': {
        'name': 'Officer Cole', 'role': 'police officer', 'phenotype': {'gender': 1., 'age': .52, 'muscle': .65, 'weight': .5, 'height': 0.52, 'proportions': .62, 'race': race(.05, .9, .05)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'short02', 'hair_tint': (.04, .035, .03), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes04'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': POLICE_NAVY, 'toigo_wool_pants': POLICE_NAVY, 'shoes04': (.03, .03, .03)}, 'gear': POLICE_GEAR, 'postures': POLICE_POSTURES,
    },
    'brandt': {
        'name': 'Sergeant Brandt', 'role': 'police sergeant', 'phenotype': {'gender': 1., 'age': .73, 'muscle': .55, 'weight': .62, 'height': .54, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_male', 'eyes': 'blue', 'hair': 'short01', 'hair_tint': (.42, .41, .4), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes03'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': POLICE_NAVY, 'toigo_wool_pants': POLICE_NAVY, 'shoes03': (.03, .03, .03)},
        'gear': [g if g[0] != 'shoulder_patch' else ('shoulder_patch', {'chevrons': 3}) for g in POLICE_GEAR], 'postures': POLICE_POSTURES,
    },
    'tran': {
        'name': 'Detective Tran', 'role': 'detective', 'phenotype': {'gender': .0, 'age': .655, 'muscle': .5, 'weight': .48, 'height': 0.535, 'proportions': .55, 'race': race(.05, 0, .95)},
        'skin': 'middleage_asian_female', 'eyes': 'brown', 'hair': 'toigo_blunt_bob', 'hair_tint': (.05, .045, .045), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_female_double-breasted_suit', 'shoes03'], 'tint': {'shoes03': (.03, .03, .03)},
        'gear': [('hip_badge', {}), ('lanyard', {'color': (.04, .04, .05), 'stripe': (.1, .2, .5)})], 'postures': POLICE_POSTURES,
    },
    'okoye': {
        'name': 'Okoye', 'role': 'security officer', 'phenotype': {'gender': .0, 'age': .57, 'muscle': .6, 'weight': .55, 'height': 0.56, 'proportions': .6, 'race': race(.05, .9, .05)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'braid01', 'hair_tint': (.04, .035, .03), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes04'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': SECURITY_BLACK, 'toigo_wool_pants': (.1, .1, .11), 'shoes04': (.03, .03, .03)}, 'gear': SECURITY_GEAR, 'postures': POLICE_POSTURES,
    },
    'walsh': {
        'name': 'Walsh', 'role': 'security officer', 'phenotype': {'gender': 1., 'age': .66, 'muscle': .6, 'weight': .6, 'height': 0.56, 'proportions': .55, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_male', 'eyes': 'green', 'hair': 'short01', 'hair_tint': (.3, .2, .12), 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes03'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': SECURITY_BLACK, 'toigo_wool_pants': (.1, .1, .11), 'shoes03': (.03, .03, .03)}, 'gear': SECURITY_GEAR, 'postures': POLICE_POSTURES,
    },
    'nina': {
        'name': 'Nina', 'role': 'nurse', 'phenotype': {'gender': .0, 'age': .51, 'muscle': .45, 'weight': .47, 'height': .56, 'proportions': .6, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_female', 'eyes': 'blue', 'hair': 'ponytail01', 'hair_tint': (.55, .4, .22), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'wear': [('scrubs', {'color': SCRUBS_TEAL})], 'clothes': ['toigo_wool_pants', 'shoes05'], 'tint': {'toigo_wool_pants': SCRUBS_TEAL},
        'gear': [('stethoscope', {}), ('id_badge', {'low': True})], 'postures': NURSE_POSTURES,
    },
    'mateo': {
        'name': 'Mateo', 'role': 'nurse', 'phenotype': {'gender': 1., 'age': .57, 'muscle': .55, 'weight': .55, 'height': .5, 'proportions': .55, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_male2', 'eyes': 'brown', 'hair': 'short04', 'hair_tint': (.06, .045, .035), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01',
        'wear': [('scrubs', {'color': SCRUBS_BLUE})], 'clothes': ['toigo_wool_pants', 'shoes06'], 'tint': {'toigo_wool_pants': SCRUBS_BLUE},
        'gear': [('id_badge', {})], 'postures': NURSE_POSTURES,
    },
    'amara': {
        'name': 'Amara', 'role': 'charge nurse', 'phenotype': {'gender': .0, 'age': .73, 'muscle': .45, 'weight': .62, 'height': .48, 'proportions': .5, 'race': race(.05, .95, 0)},
        'skin': 'middleage_african_female', 'eyes': 'brown', 'hair': 'culturalibre_hair_02', 'hair_tint': (.1, .09, .09), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'wear': [('scrubs', {'color': SCRUBS_PLUM})], 'clothes': ['toigo_wool_pants', 'shoes05', 'spamrakuen_tbm_glasses_frames_01'], 'tint': {'toigo_wool_pants': SCRUBS_PLUM},
        'gear': [('lanyard', {'color': (.75, .75, .78), 'stripe': (.45, .12, .35)})], 'postures': NURSE_POSTURES,
    },
    'patel': {
        'name': 'Dr Patel', 'role': 'doctor', 'phenotype': {'gender': .0, 'age': .655, 'muscle': .45, 'weight': .5, 'height': .52, 'proportions': .55, 'race': race(.4, .15, .45)},
        'skin': 'middleage_asian_female', 'eyes': 'brown', 'hair': 'rehmanpolanski_hair_bun_brown', 'hair_tint': (.05, .04, .035), 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes02',
        'wear': [('coat', {})], 'clothes': ['joepal_crude_t-shirt_female', 'toigo_wool_pants', 'toigo_flats'], 'tuck': ['joepal_crude_t-shirt_female'],
        'tint': {'joepal_crude_t-shirt_female': (.2, .5, .55), 'toigo_wool_pants': (.12, .13, .17), 'toigo_flats': (.05, .05, .05)},
        'gear': [('stethoscope', {}), ('id_badge', {})], 'postures': DOCTOR_POSTURES,
    },
    'stone': {
        'name': 'Dr Stone', 'role': 'doctor', 'phenotype': {'gender': 1., 'age': .8, 'muscle': .45, 'weight': .55, 'height': .56, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'old_caucasian_male', 'eyes': 'grey', 'hair': 'short03', 'hair_tint': (.62, .62, .62), 'eyebrows': 'eyebrow010', 'eyelashes': 'eyelashes01',
        'wear': [('coat', {})], 'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes03', 'spamrakuen_tbm_glasses_frames_01'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': (.55, .68, .8), 'toigo_wool_pants': (.16, .16, .18), 'shoes03': (.05, .04, .04)},
        'gear': [('stethoscope', {}), ('id_badge', {})], 'postures': DOCTOR_POSTURES,
    },
    'walter': {
        'name': 'Walter', 'role': 'patient', 'phenotype': {'gender': 1., 'age': .88, 'muscle': .35, 'weight': .5, 'height': .47, 'proportions': .45, 'race': race(.1, 0, .9)},
        'skin': 'old_asian_male', 'eyes': 'brown', 'hair': 'short01', 'hair_tint': (.7, .7, .7), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'wear': [('gown', {}), ('socks', {'color': (.55, .57, .6)})], 'clothes': [], 'postures': PATIENT_POSTURES,
    },
    'june': {
        'name': 'June', 'role': 'patient', 'phenotype': {'gender': .0, 'age': .57, 'muscle': .4, 'weight': .5, 'height': 0.54, 'proportions': .55, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_female', 'eyes': 'green', 'hair': 'long01', 'hair_tint': (.3, .15, .08), 'eyebrows': 'eyebrow011', 'eyelashes': 'eyelashes03',
        'wear': [('gown', {'color': (.7, .82, .72), 'print_color': (.42, .6, .5)})], 'clothes': [], 'postures': PATIENT_POSTURES,
    },
    'vega': {
        'name': 'Vega', 'role': 'lab scientist', 'phenotype': {'gender': .0, 'age': .57, 'muscle': .5, 'weight': .48, 'height': .5, 'proportions': .6, 'race': race(.6, .2, .2)},
        'skin': 'young_caucasian_female2', 'eyes': 'brown', 'hair': 'elvs_reverse_french_braid_bun', 'hair_tint': (.09, .06, .045), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes03',
        'wear': [('coat', {'hem': .03}), ('gloves', {})], 'clothes': ['joepal_crude_t-shirt_female', 'toigo_wool_pants', 'shoes04', 'kwnet_at_optical_glasses'], 'frames': ['kwnet_at_optical_glasses'], 'tuck': ['joepal_crude_t-shirt_female'],
        'tint': {'joepal_crude_t-shirt_female': (.6, .25, .35), 'toigo_wool_pants': (.15, .16, .2)}, 'gear': [('id_badge', {})], 'postures': LAB_POSTURES,
    },
    'yusuf': {
        'name': 'Yusuf', 'role': 'lab scientist', 'phenotype': {'gender': 1., 'age': .655, 'muscle': .5, 'weight': .58, 'height': 0.52, 'proportions': .5, 'race': race(.6, .25, .15)},
        'skin': 'middleage_caucasian_male', 'eyes': 'brown', 'hair': 'short02', 'hair_tint': (.05, .045, .04), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'wear': [('coat', {'hem': .03}), ('gloves', {'color': (.42, .28, .62)})], 'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes03', 'kwnet_at_optical_glasses'], 'frames': ['kwnet_at_optical_glasses'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': (.3, .36, .3), 'cortu_cargo_pants': (.3, .28, .25)}, 'gear': [('id_badge', {})], 'postures': LAB_POSTURES,
    },
    'chen': {
        'name': 'Chen', 'role': 'lab technician', 'phenotype': {'gender': 1., 'age': .51, 'muscle': .45, 'weight': .45, 'height': 0.54, 'proportions': .55, 'race': race(.05, 0, .95)},
        'skin': 'young_asian_male', 'eyes': 'brown', 'hair': 'cortu_short_messy_hair', 'hair_tint': (.05, .045, .045), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'wear': [('coat', {'hem': .03}), ('gloves', {})], 'clothes': ['elvs_crude_t-shirt_male', 'toigo_wool_pants', 'shoes06', 'kwnet_at_optical_glasses'], 'frames': ['kwnet_at_optical_glasses'], 'tuck': ['elvs_crude_t-shirt_male'],
        'tint': {'elvs_crude_t-shirt_male': (.36, .4, .46), 'toigo_wool_pants': (.2, .22, .3)}, 'gear': [('id_badge', {})], 'postures': LAB_POSTURES,
    },
    'devi': {
        'name': 'Devi', 'role': 'IT technician', 'phenotype': {'gender': .0, 'age': .51, 'muscle': .45, 'weight': .46, 'height': .5, 'proportions': .6, 'race': race(.4, .15, .45)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'elvs_double_mh_braid', 'hair_tint': (.045, .035, .03), 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes02',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes06'], 'tint': {'namuhekam_male_polo_shirt': (.08, .32, .42), 'cortu_cargo_pants': (.14, .15, .17)},
        'gear': [('lanyard', {'color': (.8, .15, .1)})], 'postures': IT_POSTURES,
    },
    'tomas': {
        'name': 'Tomas', 'role': 'IT technician', 'phenotype': {'gender': 1., 'age': .57, 'muscle': .55, 'weight': .56, 'height': .57, 'proportions': .55, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male2', 'eyes': 'blue', 'hair': 'culturalibre_hair_05', 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes04'], 'tuck': ['namuhekam_male_polo_shirt'],
        'tint': {'namuhekam_male_polo_shirt': (.2, .22, .26), 'toigo_wool_pants': (.42, .38, .3)},
        'gear': [('belt', {'color': (.1, .08, .06), 'items': [('tools', -62)], 'width': .04}), ('lanyard', {'color': (.15, .5, .25)})], 'postures': IT_POSTURES,
    },
    'helen': {
        'name': 'Helen', 'role': 'government clerk', 'phenotype': {'gender': .0, 'age': .73, 'muscle': .4, 'weight': .58, 'height': .48, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'middleage_caucasian_female', 'eyes': 'bluegreen', 'hair': 'toigo_curled_under_bob', 'hair_tint': (.5, .42, .34), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'clothes': ['female_elegantsuit01', 'toigo_flats', 'spamrakuen_tbm_glasses_frames_01'], 'tint': {'toigo_flats': (.05, .05, .05)},
        'gear': [('lanyard', {'color': (.1, .25, .6)})], 'postures': CLERK_POSTURES,
    },
    'darius': {
        'name': 'Darius', 'role': 'government clerk', 'phenotype': {'gender': 1., 'age': .57, 'muscle': .5, 'weight': .52, 'height': 0.53, 'proportions': .6, 'race': race(.1, .85, .05)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'short04', 'hair_tint': (.04, .035, .03), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit01', 'shoes03'], 'tint': {'male_casualsuit01': (.5, .55, .62)},
        'gear': [('lanyard', {'color': (.1, .25, .6)})], 'postures': CLERK_POSTURES,
    },
    'mei': {
        'name': 'Mei', 'role': 'government clerk', 'phenotype': {'gender': .0, 'age': .51, 'muscle': .45, 'weight': .44, 'height': 0.55, 'proportions': .6, 'race': race(.05, 0, .95)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'toigo_inverted_bob', 'hair_tint': (.05, .045, .045), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_female_suit', 'toigo_ballet_flats'], 'gear': [('lanyard', {'color': (.1, .25, .6)})], 'postures': CLERK_POSTURES,
    },
    # Middle-school students, 12 to 13 (MakeHuman age .23 to .25), in the adults' postures on the school's furniture.
    'aiden': {
        'name': 'Aiden', 'role': 'student', 'phenotype': {'gender': 1., 'age': .25, 'muscle': .5, 'weight': .48, 'height': 0.555, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male', 'eyes': 'blue', 'hair': 'cortu_short_messy_hair', 'hair_tint': (.4, .28, .16), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'clothes': ['male_casualsuit02', 'shoes02'], 'carry': {'walk': [('backpack', {'color': (.5, .12, .1)})]}, 'postures': STUDENT_POSTURES,
    },
    'bella': {
        'name': 'Bella', 'role': 'student', 'phenotype': {'gender': .0, 'age': .23, 'muscle': .45, 'weight': .48, 'height': 0.595, 'proportions': .5, 'race': race(.5, .3, .2)},
        'skin': 'young_caucasian_female2', 'eyes': 'brown', 'hair': 'ponytail01', 'hair_tint': (.14, .09, .06), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_fisherman_sweater', 'cortu_cargo_pants', 'shoes05'], 'tint': {'toigo_fisherman_sweater': (.85, .45, .4), 'cortu_cargo_pants': (.22, .3, .45)},
        'carry': {'walk': [('backpack', {'color': (.25, .45, .5)})]}, 'postures': STUDENT_POSTURES,
    },
    'carlos': {
        'name': 'Carlos', 'role': 'student', 'phenotype': {'gender': 1., 'age': .24, 'muscle': .5, 'weight': .55, 'height': 0.555, 'proportions': .5, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_male2', 'eyes': 'brown', 'hair': 'short04', 'hair_tint': (.05, .04, .03), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01',
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes06'], 'tint': {'namuhekam_male_polo_shirt': (.2, .5, .25), 'cortu_cargo_pants': (.3, .3, .34)},
        'carry': {'walk': [('backpack', {})]}, 'postures': STUDENT_POSTURES,
    },
    'dina': {
        'name': 'Dina', 'role': 'student', 'phenotype': {'gender': .0, 'age': .25, 'muscle': .45, 'weight': .45, 'height': 0.62, 'proportions': .5, 'race': race(.3, .1, .6)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'toigo_blunt_bob_with_bangs', 'hair_tint': (.05, .04, .04), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'clothes': ['toigo_fisherman_sweater', 'cortu_cargo_pants', 'shoes04', 'spamrakuen_tbm_glasses_frames_01'], 'tint': {'toigo_fisherman_sweater': (.6, .5, .78), 'cortu_cargo_pants': (.2, .2, .24)},
        'carry': {'walk': [('backpack', {'color': (.55, .3, .5)})]}, 'postures': STUDENT_POSTURES,
    },
    'emeka': {
        'name': 'Emeka', 'role': 'student', 'phenotype': {'gender': 1., 'age': .23, 'muscle': .5, 'weight': .5, 'height': 0.52, 'proportions': .5, 'race': race(.05, .95, 0)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'short02', 'hair_tint': (.04, .035, .03), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'clothes': ['elvs_crude_t-shirt_male', 'cortu_cargo_pants', 'shoes05'], 'tint': {'elvs_crude_t-shirt_male': (.9, .6, .15), 'cortu_cargo_pants': (.16, .2, .32)},
        'carry': {'walk': [('backpack', {'color': (.1, .1, .12)})]}, 'postures': STUDENT_POSTURES,
    },
    'fern': {
        'name': 'Fern', 'role': 'student', 'phenotype': {'gender': .0, 'age': .24, 'muscle': .45, 'weight': .47, 'height': 0.6, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_female', 'eyes': 'green', 'hair': 'braid01', 'hair_tint': (.5, .22, .1), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'clothes': ['female_casualsuit01', 'shoes06'], 'carry': {'walk': [('backpack', {'color': (.2, .5, .3)})]}, 'postures': STUDENT_POSTURES,
    },
    # ---- round three: more everyday people, so a crowd is not the same few faces. Each has a face of their own
    # ('face': MakeHuman's detail targets; 'lr-' = both sides), a skin tone where the three skin sets fall between
    # ('skin_tone': a factor on the skin texture), and outfits put together from halves of the one-piece suits
    # ('parts': {outfit: 'top' | 'bottom' | 'both'}; 'dye': a colour that keeps the fabric's stripes, print and seams;
    # '<outfit>:bottom' is the bottom half of an outfit worn whole).
    'elena': {
        'name': 'Elena', 'phenotype': {'gender': .0, 'age': .655, 'muscle': .45, 'weight': .56, 'height': .525, 'proportions': .55, 'race': race(.8, .1, .1)},
        'skin': 'middleage_caucasian_female', 'skin_tone': (.93, .84, .76), 'eyes': 'brown', 'hair': 'elvs_unkempt_french_braid', 'hair_tint': (.1, .06, .04), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes03',
        'face': {'head-oval': .5, 'nose-hump-incr': .4, 'nose-scale-vert-incr': .3, 'lr-cheek-bones-incr': .4, 'mouth-scale-horiz-incr': .3, 'chin-height-incr': .3, 'eyebrows-angle-up': .3, 'lr-eye-bag-incr': .3},
        'clothes': ['female_elegantsuit01', 'toigo_wool_pants', 'toigo_ankle_boots_female'], 'parts': {'female_elegantsuit01': 'top'},
        'dye': {'female_elegantsuit01': (.2, .4, .42)}, 'tint': {'toigo_wool_pants': (.1, .1, .12), 'toigo_ankle_boots_female': (.1, .07, .05)}, 'look': 3, 'postures': CROWD,
    },
    'kofi': {
        'name': 'Kofi', 'phenotype': {'gender': 1., 'age': .555, 'muscle': .62, 'weight': .5, 'height': .47, 'proportions': .62, 'race': race(0, 1, 0)},
        'skin': 'young_african_male', 'eyes': 'brown', 'hair': 'culturalibre_hair_02', 'hair_tint': (.035, .03, .028), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'face': {'head-square': .4, 'chin-width-incr': .5, 'chin-prominent-incr': .3, 'mouth-lowerlip-volume-incr': .4, 'forehead-scale-vert-incr': .3, 'lr-ear-scale-decr': .3, 'nose-width2-incr': .3},
        'clothes': ['male_casualsuit03', 'shoes04'], 'parts': {'male_casualsuit03': 'both'},
        'dye': {'male_casualsuit03': (.34, .46, .62), 'male_casualsuit03:bottom': (.1, .13, .2)}, 'look': 3, 'postures': CROWD + ['wheel-type', 'wheel-watch'],
    },
    'mina': {
        'name': 'Mina', 'phenotype': {'gender': .0, 'age': .525, 'muscle': .4, 'weight': .42, 'height': .55, 'proportions': .6, 'race': race(0, 0, 1)},
        'skin': 'young_asian_female', 'skin_tone': (.96, .88, .8), 'eyes': 'brown', 'hair': 'cortu_straight_bangs', 'hair_tint': (.04, .035, .035), 'eyebrows': 'eyebrow005', 'eyelashes': 'eyelashes02',
        'face': {'head-round': .5, 'lr-cheek-volume-incr': .4, 'nose-scale-horiz-decr': .2, 'nose-point-up': .4, 'mouth-scale-horiz-decr': .4, 'chin-triangle': .3, 'lr-eye-scale-incr': .2},
        'clothes': ['joepal_crude_t-shirt_female', 'toigo_harem_pants', 'toigo_ballet_flats'], 'tuck': ['joepal_crude_t-shirt_female'],
        'tint': {'toigo_ballet_flats': (.08, .07, .07)}, 'look': 3, 'postures': CROWD,
    },
    'raj': {
        'name': 'Raj', 'phenotype': {'gender': 1., 'age': .73, 'muscle': .45, 'weight': .6, 'height': .43, 'proportions': .5, 'race': race(.45, .15, .4)},
        'skin': 'middleage_asian_male', 'skin_tone': (.82, .7, .61), 'eyes': 'brown', 'hair': 'short01', 'hair_tint': (.2, .19, .185), 'eyebrows': 'eyebrow010', 'eyelashes': 'eyelashes01',
        'face': {'head-rectangular': .5, 'nose-hump-incr': .5, 'nose-scale-horiz-incr': .3, 'nose-point-down': .4, 'lr-eye-bag-incr': .6, 'eyebrows-trans-down': .3, 'neck-double-incr': .3, 'mouth-angles-down': .2, 'chin-width-incr': .2},
        'clothes': ['male_elegantsuit01', 'shoes03', 'frankyaye_glasses_library_male'], 'frames': ['frankyaye_glasses_library_male'], 'tint': {'shoes03': (.04, .035, .03)}, 'look': 3, 'postures': CROWD,
    },
    'sara': {
        'name': 'Sara', 'phenotype': {'gender': .0, 'age': .58, 'muscle': .42, 'weight': .5, 'height': .53, 'proportions': .55, 'race': race(.65, .15, .2)},
        'skin': 'young_caucasian_female2', 'skin_tone': (.9, .8, .7), 'eyes': 'brownlight', 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes03',
        'face': {'head-oval': .6, 'nose-scale-vert-incr': .4, 'nose-curve-convex': .3, 'lr-cheek-bones-incr': .3, 'mouth-lowerlip-volume-incr': .3, 'eyebrows-angle-up': .2, 'lr-eye-scale-incr': .25, 'chin-height-decr': .2},
        'wear': [('headscarf', {'color': (.38, .55, .58)})], 'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'toigo_flats'],
        'tint': {'toigo_fisherman_sweater': (.8, .7, .58), 'toigo_wool_pants': (.13, .15, .23), 'toigo_flats': (.1, .08, .07)}, 'look': 3, 'postures': CROWD,
    },
    'tom': {
        'name': 'Tom', 'phenotype': {'gender': 1., 'age': .83, 'muscle': .4, 'weight': .55, 'height': .47, 'proportions': .45, 'race': race(1, 0, 0)},
        'skin': 'old_caucasian_male', 'eyes': 'lightblue', 'hair': 'short02', 'hair_tint': (.7, .7, .69), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'face': {'head-square': .5, 'nose-volume-incr': .5, 'nose-scale-horiz-incr': .3, 'lr-ear-scale-incr': .5, 'lr-ear-lobe-incr': .5, 'lr-eye-bag-incr': .7, 'neck-double-incr': .4, 'mouth-angles-down': .3, 'chin-cleft-incr': .4,
                 'mouth-upperlip-volume-decr': .4, 'eyebrows-trans-down': .3},
        'clothes': ['male_casualsuit05', 'toigo_wool_pants', 'shoes01'], 'parts': {'male_casualsuit05': 'top'},
        'dye': {'male_casualsuit05': (.36, .31, .24)}, 'tint': {'toigo_wool_pants': (.13, .13, .15)}, 'look': 3, 'postures': CROWD + ['cane-stand'],
    },
    'ivy': {
        'name': 'Ivy', 'phenotype': {'gender': .0, 'age': .77, 'muscle': .4, 'weight': .6, 'height': .45, 'proportions': .5, 'race': race(.05, .95, 0)},
        'skin': 'middleage_african_female', 'eyes': 'brown', 'hair': 'rehmanpolanski_hair_bun_brown', 'hair_tint': (.42, .41, .4), 'eyebrows': 'eyebrow004', 'eyelashes': 'eyelashes01',
        'face': {'head-round': .4, 'lr-cheek-volume-incr': .5, 'nose-width2-incr': .3, 'mouth-scale-horiz-incr': .3, 'lr-eye-bag-incr': .4, 'chin-height-decr': .3, 'neck-double-incr': .25, 'mouth-angles-up': .3},
        'clothes': ['toigo_female_suit_2', 'toigo_flats', 'kwnet_at_optical_glasses'], 'frames': ['kwnet_at_optical_glasses'],
        'dye': {'toigo_female_suit_2': (.3, .19, .33)}, 'tint': {'toigo_flats': (.06, .05, .05)}, 'look': 3, 'postures': CROWD,
    },
    'luca': {
        'name': 'Luca', 'phenotype': {'gender': 1., 'age': .525, 'muscle': .55, 'weight': .44, 'height': .5, 'proportions': .62, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male2', 'skin_tone': (.95, .87, .79), 'eyes': 'green', 'hair': 'culturalibre_hair_05', 'hair_tint': (.09, .06, .04), 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'face': {'head-diamond': .5, 'nose-greek-incr': .5, 'nose-scale-vert-incr': .3, 'chin-prominent-incr': .4, 'chin-cleft-incr': .3, 'lr-cheek-bones-incr': .4, 'lr-cheek-inner-decr': .3, 'eyebrows-trans-down': .3, 'mouth-scale-horiz-incr': .2},
        'clothes': ['male_casualsuit06', 'toigo_ankle_boots_male'], 'parts': {'male_casualsuit06': 'both'},
        'dye': {'male_casualsuit06': (.17, .24, .2), 'male_casualsuit06:bottom': (.07, .07, .08)}, 'look': 3, 'postures': CROWD,
    },
    'bruno': {
        'name': 'Bruno', 'phenotype': {'gender': 1., 'age': .68, 'muscle': .5, 'weight': .9, 'height': .48, 'proportions': .45, 'race': race(.65, .15, .2)},
        'skin': 'middleage_caucasian_male', 'skin_tone': (.88, .77, .67), 'eyes': 'brown', 'hair': 'short04', 'hair_tint': (.1, .09, .085), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01',
        'face': {'head-fat-incr': .7, 'head-round': .5, 'neck-double-incr': .7, 'lr-cheek-volume-incr': .6, 'nose-volume-incr': .4, 'nose-scale-horiz-incr': .4, 'chin-width-incr': .5, 'mouth-scale-horiz-incr': .3, 'neck-scale-horiz-incr': .5},
        'clothes': ['namuhekam_male_polo_shirt', 'male_casualsuit04', 'shoes01'], 'parts': {'male_casualsuit04': 'bottom'},
        'tint': {'namuhekam_male_polo_shirt': (.45, .1, .09), 'shoes01': (.12, .08, .06)}, 'look': 3, 'postures': CROWD,
    },
    'dee': {
        'name': 'Dee', 'phenotype': {'gender': .0, 'age': .5, 'muscle': .8, 'weight': .42, 'height': .52, 'proportions': .7, 'race': race(.4, .5, .1)},
        'skin': 'young_caucasian_female', 'skin_tone': (.72, .59, .5), 'eyes': 'brown', 'hair': 'faydaen_hair_1', 'hair_tint': (.07, .045, .03), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'face': {'head-triangular': .4, 'lr-cheek-bones-incr': .5, 'chin-prominent-incr': .2, 'nose-scale-horiz-incr': .25, 'nose-point-up': .2, 'mouth-lowerlip-volume-incr': .3, 'mouth-upperlip-volume-incr': .3,
                 'forehead-scale-vert-decr': .2, 'lr-eye-corner2-up': .3},
        'clothes': ['joepal_crude_t-shirt_female', 'female_sportsuit01', 'shoes05'], 'parts': {'female_sportsuit01': 'bottom'},
        'dye': {'joepal_crude_t-shirt_female': (.85, .36, .3), 'female_sportsuit01': (.08, .08, .1)}, 'look': 3, 'postures': CROWD,
    },
    # Students of 16 to 19 (MakeHuman age .31 to .375).
    'nia': {
        'name': 'Nia', 'phenotype': {'gender': .0, 'age': .33, 'muscle': .45, 'weight': .47, 'height': .6, 'proportions': .55, 'race': race(.05, .95, 0)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'cortu_strawberry_cloud_hair', 'hair_tint': (.05, .035, .03), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'face': {'head-oval': .4, 'forehead-nubian-incr': .3, 'lr-cheek-volume-incr': .3, 'nose-point-up': .2, 'mouth-scale-horiz-decr': .2, 'chin-height-decr': .3, 'lr-eye-scale-incr': .3},
        'clothes': ['female_casualsuit01', 'shoes06'], 'parts': {'female_casualsuit01': 'both'}, 'dye': {'female_casualsuit01': (.9, .72, .2)},
        'carry': {'walk': [('backpack', {'color': (.3, .2, .45)})]}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'max': {
        'name': 'Max', 'phenotype': {'gender': 1., 'age': .355, 'muscle': .5, 'weight': .5, 'height': .635, 'proportions': .55, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male', 'eyes': 'blue', 'hair': 'short02', 'hair_tint': (.58, .45, .26), 'eyebrows': 'eyebrow008', 'eyelashes': 'eyelashes01',
        'face': {'head-rectangular': .4, 'chin-width-incr': .3, 'nose-scale-vert-incr': .3, 'nose-point-up': .3, 'lr-ear-wing-incr': .5, 'mouth-scale-horiz-incr': .3, 'eyebrows-angle-down': .2},
        'clothes': ['male_casualsuit02', 'cortu_cargo_pants', 'shoes05'], 'parts': {'male_casualsuit02': 'top'},
        'dye': {'male_casualsuit02': (.22, .4, .3)}, 'tint': {'cortu_cargo_pants': (.42, .38, .3)}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'yara': {
        'name': 'Yara', 'phenotype': {'gender': .0, 'age': .375, 'muscle': .45, 'weight': .5, 'height': .58, 'proportions': .6, 'race': race(.66, .17, .17)},
        'skin': 'young_caucasian_female', 'skin_tone': (.88, .76, .66), 'eyes': 'brown', 'hair': 'long01', 'hair_tint': (.09, .055, .035), 'eyebrows': 'eyebrow011', 'eyelashes': 'eyelashes03',
        'face': {'head-diamond': .4, 'nose-hump-incr': .25, 'nose-scale-vert-incr': .3, 'lr-cheek-bones-incr': .5, 'eyebrows-angle-up': .3, 'mouth-lowerlip-volume-incr': .4, 'chin-triangle': .3},
        'clothes': ['toigo_fisherman_sweater', 'female_casualsuit01', 'toigo_ankle_boots_female'], 'parts': {'female_casualsuit01': 'bottom'},
        'tint': {'toigo_fisherman_sweater': (.7, .28, .22), 'toigo_ankle_boots_female': (.4, .27, .17)}, 'dye': {'female_casualsuit01': (.12, .15, .22)},
        'carry': {'walk': [('backpack', {'color': (.6, .5, .3)})]}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'finn': {
        'name': 'Finn', 'phenotype': {'gender': 1., 'age': .3125, 'muscle': .45, 'weight': .42, 'height': .63, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male2', 'eyes': 'green', 'hair': 'short03', 'hair_tint': (.5, .2, .07), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'face': {'head-round': .5, 'lr-cheek-volume-incr': .4, 'nose-point-up': .5, 'nose-scale-vert-decr': .3, 'lr-ear-wing-incr': .6, 'lr-ear-scale-incr': .3, 'chin-height-decr': .3, 'mouth-scale-horiz-incr': .2},
        'clothes': ['male_casualsuit04', 'shoes06'], 'parts': {'male_casualsuit04': 'both'}, 'dye': {'male_casualsuit04': (.72, .2, .15)},
        'carry': {'walk': [('backpack', {'color': (.15, .2, .3)})]}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'suki': {
        'name': 'Suki', 'phenotype': {'gender': .0, 'age': .33, 'muscle': .4, 'weight': .4, 'height': .685, 'proportions': .55, 'race': race(0, 0, 1)},
        'skin': 'young_asian_female', 'skin_tone': (.97, .9, .83), 'eyes': 'brown', 'hair': 'elvs_french_braid_variation', 'hair_tint': (.045, .035, .04), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'face': {'head-invertedtriangular': .4, 'chin-triangle': .4, 'nose-scale-horiz-decr': .3, 'mouth-scale-horiz-decr': .3, 'lr-cheek-bones-incr': .2, 'lr-eye-corner2-up': .3, 'forehead-scale-vert-incr': .2},
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes04'],
        'dye': {'toigo_basic_tucked_t-shirt': (.7, .6, .85)}, 'tint': {'toigo_wool_pants': (.82, .8, .74)}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'diego': {
        'name': 'Diego', 'phenotype': {'gender': 1., 'age': .375, 'muscle': .6, 'weight': .55, 'height': .61, 'proportions': .55, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_male2', 'skin_tone': (.86, .74, .64), 'eyes': 'brown', 'hair': 'cortu_short_messy_hair', 'hair_tint': (.07, .05, .04), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'face': {'head-square': .4, 'chin-width-incr': .4, 'chin-prominent-incr': .3, 'nose-scale-horiz-incr': .3, 'nose-hump-incr': .2, 'eyebrows-trans-down': .4, 'mouth-lowerlip-volume-incr': .2, 'neck-scale-horiz-incr': .3},
        'clothes': ['male_casualsuit02', 'shoes05'], 'parts': {'male_casualsuit02': 'both'}, 'dye': {'male_casualsuit02': (.2, .2, .23)},
        'carry': {'walk': [('backpack', {'color': (.5, .15, .1)})]}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'amal': {
        'name': 'Amal', 'phenotype': {'gender': .0, 'age': .355, 'muscle': .42, 'weight': .46, 'height': .63, 'proportions': .55, 'race': race(.45, .15, .4)},
        'skin': 'young_asian_female', 'skin_tone': (.8, .67, .57), 'eyes': 'brown', 'hair': 'culturalibre_hair_01', 'hair_tint': (.04, .03, .03), 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes03',
        'face': {'head-oval': .5, 'nose-scale-vert-incr': .25, 'nose-point-down': .2, 'lr-eye-scale-incr': .35, 'eyebrows-trans-down': .2, 'mouth-upperlip-volume-incr': .3, 'lr-cheek-volume-incr': .2, 'chin-height-incr': .2},
        'clothes': ['female_elegantsuit01', 'female_casualsuit01', 'toigo_ballet_flats'], 'parts': {'female_elegantsuit01': 'top', 'female_casualsuit01': 'bottom'},
        'tint': {'toigo_ballet_flats': (.4, .1, .12)}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    'jack': {
        'name': 'Jack', 'phenotype': {'gender': 1., 'age': .375, 'muscle': .5, 'weight': .42, 'height': .6, 'proportions': .6, 'race': race(.4, .55, .05)},
        'skin': 'young_african_male', 'skin_tone': (1.4, 1.34, 1.28), 'eyes': 'brown', 'hair': 'afro01', 'hair_tint': (.06, .045, .04), 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01',
        'face': {'head-rectangular': .3, 'head-scale-vert-incr': .3, 'chin-height-incr': .4, 'nose-scale-vert-incr': .4, 'lr-cheek-inner-decr': .4, 'lr-cheek-bones-incr': .3, 'neck-scale-vert-incr': .4, 'mouth-scale-horiz-incr': .2},
        'clothes': ['male_casualsuit06', 'cortu_cargo_pants', 'shoes02'], 'parts': {'male_casualsuit06': 'top'}, 'tint': {'cortu_cargo_pants': (.2, .24, .19)},
        'carry': {'walk': [('backpack', {'color': (.12, .12, .13)})]}, 'look': 3, 'postures': CROWD + ['sit-raise'],
    },
    # ---- round three, part C: six more children (the kindergarten, the elementary classroom and the child's room
    # drew on eight). Zuri 4, Hugo 5, Yuki 6, Karim 7, Lucia 8, Kian 10; the child postures, like the other eight.
    # (their faces written out, as own_face() below would pick them, so the entries stand on their own)
    'zuri': {
        'name': 'Zuri', 'phenotype': {'gender': .0, 'age': .0625, 'muscle': .5, 'weight': .52, 'height': 0.72, 'proportions': .5, 'race': race(.05, .95, 0)},
        'skin': 'young_african_female', 'eyes': 'brown', 'hair': 'cortu_strawberry_cloud_hair', 'hair_tint': (.05, .035, .03), 'eyebrows': 'eyebrow007', 'eyelashes': 'eyelashes02',
        'look': 3,
        'face': {'head-triangular': .44, 'nose-greek-incr': .31, 'nose-scale-horiz-decr': .2, 'lr-cheek-bones-incr': .22, 'chin-height-decr': .38, 'mouth-angles-up': .24, 'eyebrows-trans-up': .21, 'lr-ear-lobe-incr': .35, 'asym-nose-1-l': .23},
        'clothes': ['toigo_fisherman_sweater', 'female_casualsuit01', 'shoes05'], 'parts': {'female_casualsuit01': 'bottom'}, 'tint': {'toigo_fisherman_sweater': (.9, .68, .2)},
    },
    'hugo': {
        'name': 'Hugo', 'phenotype': {'gender': 1., 'age': .083, 'muscle': .5, 'weight': .55, 'height': 0.68, 'proportions': .5, 'race': race(1, 0, 0)},
        'skin': 'young_caucasian_male2', 'eyes': 'green', 'hair': 'short02', 'hair_tint': (.5, .22, .08), 'eyebrows': 'eyebrow001', 'eyelashes': 'eyelashes01',
        'look': 3,
        'face': {'head-triangular': .34, 'nose-scale-vert-incr': .26, 'nose-scale-horiz-incr': .31, 'lr-cheek-bones-decr': .29, 'chin-height-decr': .23, 'mouth-scale-horiz-incr': .33, 'lr-eye-corner2-up': .21, 'forehead-scale-vert-decr': .18, 'asym-nose-2-r': .29},
        'clothes': ['male_casualsuit04', 'shoes06'], 'parts': {'male_casualsuit04': 'both'}, 'dye': {'male_casualsuit04': (.22, .5, .3)},
    },
    'yuki': {
        'name': 'Yuki', 'phenotype': {'gender': .0, 'age': .104, 'muscle': .45, 'weight': .46, 'height': 0.72, 'proportions': .5, 'race': race(0, 0, 1)},
        'skin': 'young_asian_female', 'eyes': 'brown', 'hair': 'ponytail01', 'hair_tint': (.05, .04, .04), 'eyebrows': 'eyebrow006', 'eyelashes': 'eyelashes02',
        'skin_tone': (.97, .92, .87), 'look': 3,
        'face': {'head-invertedtriangular': .35, 'nose-hump-incr': .24, 'nose-width2-incr': .29, 'lr-cheek-volume-decr': .19, 'chin-triangle': .2, 'mouth-upperlip-volume-decr': .33, 'eyebrows-trans-down': .18, 'forehead-scale-vert-incr': .33, 'asym-mouth-1-l': .34},
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes04'], 'dye': {'toigo_basic_tucked_t-shirt': (.82, .26, .26)}, 'tint': {'toigo_wool_pants': (.2, .25, .42)},
        'stripes': {'toigo_basic_tucked_t-shirt': {'colour': (.93, .92, .88), 'width': .012, 'gap': .022}},
    },
    'karim': {
        'name': 'Karim', 'phenotype': {'gender': 1., 'age': .125, 'muscle': .5, 'weight': .5, 'height': 0.625, 'proportions': .5, 'race': race(.6, .15, .25)},
        'skin': 'young_caucasian_male', 'skin_tone': (.86, .75, .65), 'eyes': 'brown', 'hair': 'cortu_short_messy_hair', 'hair_tint': (.06, .045, .035), 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01',
        'look': 3,
        'face': {'head-round': .4, 'nose-scale-vert-incr': .31, 'nose-point-down': .19, 'lr-cheek-volume-incr': .35, 'chin-height-decr': .33, 'mouth-scale-horiz-incr': .22, 'lr-eye-scale-incr': .3, 'lr-ear-lobe-incr': .19, 'asym-brown-1-l': .27},
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes05'], 'tint': {'namuhekam_male_polo_shirt': (.14, .2, .42), 'cortu_cargo_pants': (.6, .52, .38)},
    },
    'lucia': {
        'name': 'Lucia', 'phenotype': {'gender': .0, 'age': .146, 'muscle': .45, 'weight': .5, 'height': 0.655, 'proportions': .5, 'race': race(.6, .2, .2)},
        'skin': 'young_caucasian_female2', 'skin_tone': (.9, .8, .71), 'eyes': 'brown', 'hair': 'long01', 'hair_tint': (.1, .06, .04), 'eyebrows': 'eyebrow011', 'eyelashes': 'eyelashes03',
        'look': 3,
        'face': {'head-round': .31, 'nose-curve-concave': .27, 'nose-point-up': .36, 'lr-cheek-volume-incr': .31, 'chin-prominent-incr': .34, 'mouth-lowerlip-volume-incr': .2, 'lr-eye-corner2-down': .28, 'lr-ear-wing-incr': .21, 'asym-eye-3-l': .21},
        'clothes': ['female_casualsuit01', 'shoes06'], 'parts': {'female_casualsuit01': 'both'}, 'dye': {'female_casualsuit01': (.78, .3, .55)},
    },
    'kian': {
        'name': 'Kian', 'phenotype': {'gender': 1., 'age': .1875, 'muscle': .5, 'weight': .46, 'height': 0.535, 'proportions': .5, 'race': race(.35, .1, .55)},
        'skin': 'young_asian_male', 'skin_tone': (.86, .74, .64), 'eyes': 'brown', 'hair': 'culturalibre_hair_05', 'hair_tint': (.05, .04, .035), 'eyebrows': 'eyebrow002', 'eyelashes': 'eyelashes01',
        'look': 3,
        'face': {'head-diamond': .27, 'nose-greek-incr': .34, 'nose-point-up': .19, 'lr-cheek-inner-decr': .35, 'chin-triangle': .27, 'mouth-angles-up': .27, 'eyebrows-angle-down': .28, 'forehead-scale-vert-decr': .22, 'asym-jaw-1-l': .22},
        'clothes': ['male_casualsuit02', 'cortu_cargo_pants', 'shoes06'], 'parts': {'male_casualsuit02': 'top'}, 'dye': {'male_casualsuit02': (.15, .45, .5)}, 'tint': {'cortu_cargo_pants': (.24, .25, .3)},
    },
}
CHILDREN = ('tess', 'milo', 'lila', 'ravi', 'theo', 'ines', 'nora', 'jun', 'zuri', 'hugo', 'yuki', 'karim', 'lucia', 'kian')


# ---- a face of their own for the people of rounds one and two (round three's are written out above) -------------
# They were MakeHuman's average face for their sex, age and heritage, so several were near twins. Each gets a head
# shape and one trait of the nose (two), the cheeks, the chin, the mouth, the eyes and brows, the ears or forehead,
# and one small asymmetry, picked by the name (always the same for a name) and kept moderate: whoever knew them
# still knows them. Age shows from the fifties on (bags under the eyes, the corners of the mouth, a fuller neck).
_HEADS = ['head-oval', 'head-round', 'head-rectangular', 'head-square', 'head-triangular', 'head-invertedtriangular', 'head-diamond']
_TRAITS = [
    ['nose-scale-vert-incr', 'nose-scale-vert-decr', 'nose-hump-incr', 'nose-curve-concave', 'nose-greek-incr'],
    ['nose-scale-horiz-incr', 'nose-scale-horiz-decr', 'nose-point-up', 'nose-point-down', 'nose-width2-incr', 'nose-volume-incr'],
    ['lr-cheek-bones-incr', 'lr-cheek-bones-decr', 'lr-cheek-volume-incr', 'lr-cheek-volume-decr', 'lr-cheek-inner-decr'],
    ['chin-width-incr', 'chin-width-decr', 'chin-height-incr', 'chin-height-decr', 'chin-prominent-incr', 'chin-triangle', 'chin-cleft-incr'],
    ['mouth-scale-horiz-incr', 'mouth-scale-horiz-decr', 'mouth-lowerlip-volume-incr', 'mouth-upperlip-volume-incr', 'mouth-upperlip-volume-decr', 'mouth-angles-up'],
    ['lr-eye-scale-incr', 'lr-eye-scale-decr', 'lr-eye-corner2-up', 'lr-eye-corner2-down', 'eyebrows-angle-up', 'eyebrows-angle-down', 'eyebrows-trans-down', 'eyebrows-trans-up'],
    ['lr-ear-wing-incr', 'lr-ear-scale-incr', 'lr-ear-scale-decr', 'lr-ear-lobe-incr', 'forehead-scale-vert-incr', 'forehead-scale-vert-decr', 'forehead-temple-incr'],
    ['asym-nose-1-l', 'asym-nose-2-r', 'asym-mouth-1-l', 'asym-mouth-2-r', 'asym-jaw-1-l', 'asym-jaw-2-r', 'asym-brown-1-l', 'asym-brown-2-r', 'asym-eye-3-l', 'asym-eye-5-r', 'asym-cheek-1-r', 'asym-top-1-l'],
]


def own_face(name, age=.5):
    import hashlib
    h = hashlib.sha256(name.encode()).digest(); amount = lambda i, lo=.18, hi=.38: round(lo + (hi - lo) * h[i + 16] / 255, 2)
    face = {_HEADS[h[0] % len(_HEADS)]: amount(0, .25, .45)}
    for i, names in enumerate(_TRAITS, 1): face[names[h[i] % len(names)]] = amount(i)
    if age > .62: face.update({'lr-eye-bag-incr': round(min(.75, (age - .5) * 1.7), 2), 'mouth-angles-down': round(min(.35, (age - .55) * .9), 2)})
    if age > .75: face.update({'neck-double-incr': round(min(.4, (age - .7) * 1.6), 2), 'lr-ear-lobe-incr': .35})
    return face


# What else changed for them in round three (remove a line and that person is dressed and combed as before):
# jeans and a knit where everyone wore the same wool trousers, a stripe woven into a plain top ('stripes': bands by
# height on the body), a hair style of their own where five shared one, and a skin tone for those whose heritage
# lies between the pale and the dark skin sets.
_POLO, _TEE, _SWEATER, _JEANS_M, _JEANS_F = 'namuhekam_male_polo_shirt', 'toigo_basic_tucked_t-shirt', 'toigo_fisherman_sweater', 'male_casualsuit04', 'female_casualsuit01'
_ROUND3 = {
    'kai': {'clothes': [_POLO, _JEANS_M, 'shoes06'], 'parts': {_JEANS_M: 'bottom'}, 'tint': {_POLO: (.72, .3, .12)}, 'dye': {_JEANS_M: (.13, .15, .2)}},
    'mia': {'brow_tint': (.3, .16, .09), 'clothes': [_SWEATER, _JEANS_F, 'shoes06'], 'parts': {_JEANS_F: 'bottom'}, 'tint': {_SWEATER: (.3, .45, .4)}, 'dye': {_JEANS_F: (.2, .22, .3)}},
    'noah': {'stripes': {_POLO: {'colour': (.16, .2, .3), 'width': .012, 'gap': .05}}},
    'sofia': {'stripes': {_TEE: {'colour': (.86, .86, .82), 'width': .018, 'gap': .03}}, 'skin_tone': (.93, .84, .76)},
    'eli': {'hair': 'culturalibre_hair_05'},
    'omar': {'skin_tone': (.9, .8, .71)}, 'priya': {'skin_tone': (.88, .76, .65)}, 'leo': {'skin_tone': (.93, .84, .76)}, 'rosa': {'skin_tone': (.95, .87, .8)},
    'maya': {'brow_tint': (.22, .12, .07)},
    'theo': {'clothes': [_JEANS_M, 'shoes06'], 'parts': {_JEANS_M: 'both'}, 'tint': {}, 'dye': {_JEANS_M: (.92, .48, .16)}},
    'ines': {'stripes': {_TEE: {'colour': (.93, .93, .88), 'width': .014, 'gap': .024}}, 'skin_tone': (.94, .86, .78)},
    'ravi': {'skin_tone': (.88, .77, .68)},
    'reyes': {'skin_tone': (.92, .82, .74)}, 'patel': {'skin_tone': (.82, .7, .62)}, 'vega': {'skin_tone': (.93, .84, .76)}, 'devi': {'skin_tone': (.82, .7, .61)},
    'cole': {'hair': 'short04'},
    'yusuf': {'hair_tint': (.1, .09, .085), 'skin_tone': (.86, .76, .66)},
    'mateo': {'hair': 'short02', 'skin_tone': (.9, .8, .71)},
    'brandt': {'face': {'head-square': .4, 'nose-volume-incr': .3, 'lr-cheek-volume-incr': .3, 'chin-width-incr': .35, 'mouth-upperlip-volume-decr': .3, 'eyebrows-trans-down': .3, 'asym-nose-1-l': .25,
                        'lr-eye-bag-incr': .4, 'mouth-angles-down': .16}},
    'darius': {'hair': 'culturalibre_hair_02', 'tint': {}},        # (his tint never reached the denim: it went to the occlusion map)
    'bella': {'hair': 'toigo_curled_under_bob_with_bangs', 'skin_tone': (.84, .73, .64)},
    'carlos': {'hair': 'cortu_short_messy_hair', 'skin_tone': (.88, .78, .69), 'stripes': {_POLO: {'colour': (.88, .88, .82), 'width': .03, 'gap': .05}}},
    'dina': {'hair': 'toigo_inverted_bob_with_bangs', 'skin_tone': (.94, .86, .78)},
    'emeka': {'hair': 'culturalibre_hair_02'},
    'fern': {'hair': 'elvs_double_mh_braid'},
}
for _name, _c in CHARACTERS.items():
    _c.update(_ROUND3.get(_name, {}))
    _c.setdefault('look', 3)             # (round three's material handling for everyone: build_people.py LOOK)
    if 'face' not in _c: _c['face'] = own_face(_name, _c['phenotype']['age'])
    # the pale skin sets are chalk white on a woman or a girl: a little warmth
    if 'skin_tone' not in _c and 'female' in _c['skin'] and 'african' not in _c['skin']: _c['skin_tone'] = (.97, .92, .87)

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


def stand_wait(k):
    """Standing where the desk user stands, arms loose, eyes on the desktop: on their feet while the desk moves."""
    return {'spine': (1, 2, 2), 'neck': 7, 'head': 8, 'head_yaw': -4,
            'hand_l': _hang(k, 'l', -.03), 'hand_r': _hang(k, 'r', -.06),
            'foot_l': {'at': (.11, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.12, .06, .07), 'toes': (-.3, -1, 0)}}


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


def stretch_open(k):
    """A break at the desk: hands behind the head, elbows wide, chest open, a small arch back."""
    return {'spine': (-1, -2, -3), 'neck': -2, 'head': -3,
            'hand_l': {'at': _s(k, .13, .17, 1.585), 'fingers': (-1, -.1, .15), 'palm': (0, -1, .1), 'elbow': (.55, .1, .05), 'curl': .3, 'thumb': .25},
            'hand_r': {'at': _s(k, -.13, .17, 1.585), 'fingers': (1, -.1, .15), 'palm': (0, -1, .1), 'elbow': (-.55, .1, .05), 'curl': .3, 'thumb': .25},
            'foot_l': {'at': _s(k, .13, .0, .07 / k), 'toes': (.22, -1, 0)}, 'foot_r': {'at': _s(k, -.13, .02, .07 / k), 'toes': (-.25, -1, 0)}}


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


def _cup(k, side, at, lift=0.):
    """A hand round a cup in front of the body: thumb up, palm toward the middle, fingers forward."""
    s = 1 if side == 'l' else -1
    return {'at': _s(k, *at), 'fingers': (-s * .45, -.88, .15 + lift), 'palm': (-s, .1, 0), 'elbow': (s * .12, .35, -.8), 'curl': .6, 'thumb': .35}


def _feet(k, w=1.):
    return {'foot_l': {'at': _s(k, .10 * w, .0, .07 / k), 'toes': (.3, -1, 0)}, 'foot_r': {'at': _s(k, -.12 * w, .04, .07 / k), 'toes': (-.35, -1, 0)}}


def stand_mug(k):
    """Standing with a coffee in the right hand at chest height, weight on one leg, the other hand loose."""
    return {'pelvis_offset': (.015, 0, -.005), 'pelvis_roll': -2, 'spine': (0, 1, 2), 'neck': 5, 'head': 4, 'head_yaw': -4,
            'hand_r': _cup(k, 'r', (-.12, -.16, 1.13)), 'hand_l': _hang(k, 'l', -.02), **_feet(k)}


def stand_drink(k):
    """Standing with a drink, chatting: glass low in the right hand, head turned a little toward the other person."""
    return {'pelvis_offset': (-.015, 0, -.005), 'pelvis_roll': 2, 'spine': (0, 1, 1), 'spine_twist': 4, 'neck': 0, 'head': -2, 'head_yaw': 10,
            'hand_r': _cup(k, 'r', (-.15, -.15, 1.04)), 'hand_l': _hang(k, 'l', .01), **_feet(k)}


def stand_talk(k):
    """Standing in a conversation, explaining: the right hand out in front, palm up; the left hand loose."""
    return {'spine': (1, 1, 1), 'spine_twist': -5, 'neck': 2, 'head': 0, 'head_yaw': -6, 'head_roll': 3,
            'hand_r': {'at': _s(k, -.16, -.3, 1.0), 'fingers': (.25, -1, .05), 'palm': (.15, 0, 1), 'elbow': (-.25, .25, -.35), 'curl': .25, 'thumb': .15, 'spread': .35},
            'hand_l': _hang(k, 'l', .02),
            'foot_l': {'at': _s(k, .12, -.03, .07 / k), 'toes': (.25, -1, 0)}, 'foot_r': {'at': _s(k, -.11, .05, .07 / k), 'toes': (-.4, -1, 0)}}


def carry_box(k):
    """Carrying a box in front in both hands, on the way somewhere."""
    return {'spine': (-2, -1, 1), 'neck': 6, 'head': 6,
            'hand_l': {'at': _s(k, .19, -.3, .98), 'fingers': (-.1, -1, .05), 'palm': (-1, 0, .1), 'elbow': (.25, .25, -.2), 'curl': .3, 'thumb': .2},
            'hand_r': {'at': _s(k, -.19, -.3, .98), 'fingers': (.1, -1, .05), 'palm': (1, 0, .1), 'elbow': (-.25, .25, -.2), 'curl': .3, 'thumb': .2},
            'foot_l': {'at': _s(k, .1, -.1, .07 / k), 'toes': (.2, -1, 0)}, 'foot_r': {'at': _s(k, -.11, .1, .07 / k), 'toes': (-.25, -1, 0)}}


def kneel_shelf(k):
    """On one knee at a low shelf or crate, reaching into it with the right hand, the left forearm on the left knee."""
    return {'pelvis': _s(k, 0, .08, .5), 'pelvis_pitch': 10, 'spine': (8, 8, 6), 'neck': 12, 'head': 10,
            'hand_r': {'at': _s(k, -.12, -.5, .42), 'fingers': (.1, -1, -.4), 'palm': (0, -.2, -1), 'elbow': (-.3, .2, -.2), 'curl': .5, 'thumb': .3},
            'hand_l': {'at': _s(k, .2, -.28, .5), 'fingers': (-.1, -1, -.6), 'palm': (0, 0, -1), 'elbow': (.3, .3, 0), 'curl': .45, 'thumb': .3},
            'foot_l': {'at': _s(k, .14, -.3, .07 / k), 'toes': (.1, -1, 0), 'knee': (.15, -1, .3)},
            'foot_r': {'at': _s(k, -.12, .42, .05 / k), 'toes': (0, -.2, -1), 'pitch': 60, 'knee': (0, -1, -1)}}


def sit_floor(k):
    """Sitting cross-legged on the floor or a mat, hands resting on the knees."""
    return {'pelvis': _s(k, 0, .02, .16), 'pelvis_pitch': 6, 'spine': (4, 3, 2), 'neck': 6, 'head': 4,
            'hand_l': {'at': _s(k, .22, -.28, .2), 'fingers': (-.2, -1, -.3), 'palm': (0, 0, -1), 'elbow': (.4, .3, 0), 'curl': .35, 'thumb': .2},
            'hand_r': {'at': _s(k, -.22, -.28, .2), 'fingers': (.2, -1, -.3), 'palm': (0, 0, -1), 'elbow': (-.4, .3, 0), 'curl': .35, 'thumb': .2},
            'foot_l': {'at': _s(k, -.13, -.24, .07), 'toes': (-.6, -.6, 0), 'knee': (1, -.5, .3)},
            'foot_r': {'at': _s(k, .13, -.33, .07), 'toes': (.6, -.6, 0), 'knee': (-1, -.5, .3)}}


def floor_stretch(k):
    """On a mat, seated forward fold: legs out long, reaching for the toes."""
    return {'pelvis': _s(k, 0, .02, .14), 'pelvis_pitch': 30, 'spine': (12, 12, 10), 'neck': 6, 'head': 4,
            'hand_l': {'at': _s(k, .1, -.75, .17), 'fingers': (0, -1, -.2), 'palm': (0, 0, -1), 'elbow': (.3, .2, .2), 'curl': .3, 'thumb': .2},
            'hand_r': {'at': _s(k, -.1, -.75, .17), 'fingers': (0, -1, -.2), 'palm': (0, 0, -1), 'elbow': (-.3, .2, .2), 'curl': .3, 'thumb': .2},
            'foot_l': {'at': _s(k, .1, -.9, .08), 'toes': (0, -.3, 1), 'pitch': -70, 'knee': (0, 0, 1)}, 'foot_r': {'at': _s(k, -.1, -.9, .08), 'toes': (0, -.3, 1), 'pitch': -70, 'knee': (0, 0, 1)}}


def sit_mug(k):
    """In an armchair or on a sofa, sitting back with a mug in the right hand, the left hand on the thigh."""
    return {'pelvis': (0, .03, LOUNGE + .09), 'pelvis_pitch': -7, 'spine': (-1, 3, 5), 'neck': 6, 'head': 6, 'head_yaw': -5,
            'hand_r': {**_cup(1, 'r', (-.11, -.2, LOUNGE + .36)), 'elbow': (-.25, .3, -.6)},
            'hand_l': {'at': (.15, -.3, LOUNGE + .17), 'fingers': (-.2, -1, -.25), 'palm': (0, 0, -1), 'elbow': (.3, .3, -.1), 'curl': .35, 'thumb': .2},
            'foot_l': {'at': (.15, -.42, .075), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.13, -.46, .075), 'toes': (-.2, -1, 0)}}


def sit_chat(k):
    """On a sofa or chair, turned a little to talk, a glass in the right hand and the left forearm on the armrest side."""
    return {'pelvis': (0, .03, LOUNGE + .09), 'pelvis_pitch': -4, 'spine': (1, 3, 4), 'spine_twist': 8, 'neck': 0, 'head': -2, 'head_yaw': 14,
            'hand_r': {**_cup(1, 'r', (-.12, -.22, LOUNGE + .32)), 'elbow': (-.25, .3, -.6)},
            'hand_l': {'at': (.17, -.25, LOUNGE + .17), 'fingers': (-.1, -1, -.25), 'palm': (0, 0, -1), 'elbow': (.3, .3, -.1), 'curl': .35, 'thumb': .2},
            'foot_l': {'at': (.14, -.44, .075), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.12, -.4, .075), 'toes': (-.2, -1, 0)}}


# ---- the roles' own postures (any character can take them; built for the roles that list them) --------------
def stand_brief(k):
    """At ease at a briefing or on a post: feet apart, thumbs hooked at the belt, chest up, eyes on the room."""
    return {'spine': (-1, -1, -1), 'neck': 0, 'head': -2, 'head_yaw': 8,
            'hand_l': {'at': _s(k, .105, -.19, 1.035), 'fingers': (-.45, .1, -1), 'palm': (.1, 1, .15), 'elbow': (.45, .2, .0), 'curl': .45, 'thumb': .5, 'clear': .034},
            'hand_r': {'at': _s(k, -.105, -.19, 1.035), 'fingers': (.45, .1, -1), 'palm': (-.1, 1, .15), 'elbow': (-.45, .2, .0), 'curl': .45, 'thumb': .5, 'clear': .034},
            'foot_l': {'at': _s(k, .15, .0, .07 / k), 'toes': (.3, -1, 0)}, 'foot_r': {'at': _s(k, -.15, .0, .07 / k), 'toes': (-.3, -1, 0)}}


def stand_radio(k):
    """Calling in: the left hand holds the radio upright at the collarbone, the head turned and tipped toward it."""
    return {'pelvis_offset': (-.01, 0, -.004), 'pelvis_roll': 1.5, 'spine': (0, 1, 1), 'spine_twist': 4, 'neck': 6, 'head': 8, 'head_yaw': 30, 'head_roll': 9,
            'hand_l': {'at': _s(k, .235, -.19, 1.335), 'fingers': (-1, .15, .22), 'palm': (-.1, 1, -.1), 'elbow': (.35, .15, -.45), 'curl': .6, 'thumb': .3, 'clear': .055},
            'hand_r': _hang(k, 'r', -.02), **_feet(k)}


def stand_chart(k):
    """Reading a chart: a clipboard on the left hand at chest height, the right hand writing on it, eyes down."""
    return {'spine': (1, 2, 3), 'neck': 12, 'head': 14, 'head_yaw': 3,
            'hand_l': {'at': _s(k, .13, -.25, 1.1), 'fingers': (-.8, -.55, .2), 'palm': (.05, .45, .9), 'elbow': (.3, .25, -.35), 'curl': .2, 'thumb': .1},
            'hand_r': {'at': _s(k, -.13, -.27, 1.2), 'fingers': (.6, -.6, -.45), 'palm': (.5, .2, -.8), 'elbow': (-.3, .2, -.3), 'curl': .7, 'thumb': .55},
            **_feet(k)}


CART_HANDLE = .95    # a ward or equipment cart's push handle (m); it is 0.48 m in front of the pelvis


def push_cart(k):
    """Pushing a cart: both hands on its handle, leaning into it a little, mid-step."""
    def hand(s): return {'at': (s * .2 * k, -.4 * k, CART_HANDLE + .053), 'fingers': (-s * .1, -1, -.35), 'palm': (0, -.3, -1), 'elbow': (s * .25, .35, -.2), 'curl': .8, 'thumb': .55}
    return {'pelvis_offset': (0, 0, -.02 * k), 'pelvis_pitch': 4, 'spine': (4, 4, 2), 'neck': -2, 'head': -4, 'hand_l': hand(1), 'hand_r': hand(-1),
            'foot_l': {'at': _s(k, .09, -.16, .08 / k), 'toes': (.08, -1, 0), 'pitch': -6, 'knee': (.03, -.6, .1)},
            'foot_r': {'at': _s(k, -.09, .2, .11 / k), 'toes': (-.08, -1, 0), 'pitch': 26, 'knee': (-.03, -.7, -.1)}}


# The hospital's care bed (institutional-healthcare.mjs buildBed): the linen top is 663 mm up; the back section is
# hinged 250 mm toward the head from the bed's middle and raised .33 rad (19 degrees); a pillow lies on it, 105 mm thick.
BED, BED_HINGE = .663, .08     # the mattress top (m); how far behind the pelvis (toward the head) the hinge is


def lie_bed(k):
    """In the hospital bed, on the back: the trunk on the raised back section, head and shoulders on the pillow
    (about 25 degrees up), arms at the sides on the mattress, legs out long, heels on the folded blanket."""
    def hand(s): return {'at': (s * .27 * k, -.2 * k, BED + .032), 'fingers': (s * .08, -1, -.04), 'palm': (0, 0, -1), 'elbow': (s * .3, .3, .12), 'curl': .3, 'thumb': .2, 'spread': .2}
    def foot(s): return {'at': (s * .075 * k, -.8 * k, BED + .046 + .058), 'toes': (s * .18, -1, 0), 'pitch': -8, 'knee': (s * .03, 0, 1)}
    return {'pelvis': (0, 0, BED + .112), 'pelvis_pitch': -68, 'spine': (2, 1, 0), 'neck': 14, 'head': 10, 'head_yaw': -4,
            'hand_l': hand(1), 'hand_r': hand(-1), 'foot_l': foot(1), 'foot_r': foot(-1)}


STOOL, EYEPIECE = .65, 1.2     # a laboratory stool's seat and a bench microscope's eyepieces (m)


def sit_microscope(k):
    """On a lab stool, leaning in to a microscope: eyes at the eyepieces (1.2 m up, 0.40 to 0.44 m in front of the
    pelvis, looking down into them at 45 degrees), both hands at its focus knobs (0.97 m up, 0.55 m in front), feet on
    the stool's ring (0.25 m up)."""
    def hand(s): return {'at': (s * .13, -.47, EYEPIECE - .23), 'fingers': (-s * .25, -1, -.15), 'palm': (-s, .05, -.25), 'elbow': (s * .3, .25, -.3), 'curl': .5, 'thumb': .3}
    return {'pelvis': (0, .0, STOOL + .09), 'pelvis_pitch': 10, 'spine': (8, 9, 8), 'neck': 10, 'head': 6,
            'hand_l': hand(1), 'hand_r': hand(-1),
            'foot_l': {'at': (.11, -.14, .32), 'toes': (.2, -1, 0), 'pitch': 12}, 'foot_r': {'at': (-.11, -.1, .32), 'toes': (-.2, -1, 0), 'pitch': 12}}


COUNTER = 1.05       # a service counter's top (m); its near edge is 0.27 m in front of the pelvis


def stand_counter(k):
    """Serving at a counter: standing square to it, both hands resting on the top, head up to the person across."""
    def hand(s): return {'at': (s * .2 * k, -.36, COUNTER + .028), 'fingers': (-s * .3, -1, -.06), 'palm': (0, 0, -1), 'elbow': (s * .3, .3, -.25), 'curl': .25, 'thumb': .15, 'spread': .3}
    return {'spine': (3, 3, 2), 'neck': -2, 'head': -4, 'head_yaw': -3, 'hand_l': hand(1), 'hand_r': hand(-1),
            'foot_l': {'at': (.12, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.12, .04, .07), 'toes': (-.3, -1, 0)}}


WHEEL_SEAT = .5      # manual wheelchair seat


def keys_at(inches):
    """Keyboard top (m) at a desk height setting: measured 0.678 at 28 in, 0.759 at 31 in, 1.095 at 43.5 in."""
    return .678 + (inches - 28) * .0269


def sit_type(inches=28):
    """Seated at the desk, both hands on the keyboard, eyes on the screen."""
    keys = keys_at(inches)
    return {'pelvis': (0, .02, SEAT + .09), 'pelvis_pitch': 2, 'spine': (3, 4, 4), 'neck': 2, 'head': -2,
            'hand_l': {'at': (.14, -.385, keys + .04), 'elbow': (.16, .28, -.3), **_TYPE_L},
            'hand_r': {'at': (-.14, -.385, keys + .04), 'elbow': (-.16, .28, -.3), **_TYPE_R},
            'foot_l': {'at': (.12, -.40, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.13, -.33, .075), 'toes': (-.22, -1, 0)}}


def stand_type(inches=43.5, reach=.33):
    """Standing at the raised desk, typing. The feet sit a little behind the pelvis line: weight forward."""
    keys = keys_at(inches)
    return {'spine': (2, 3, 3), 'neck': 5, 'head': 4,
            'hand_l': {'at': (.14, -reach, keys + .04), 'elbow': (.2, .3, -.35), **_TYPE_L},
            'hand_r': {'at': (-.14, -reach, keys + .04), 'elbow': (-.2, .3, -.35), **_TYPE_R},
            'foot_l': {'at': (.11, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.12, .06, .07), 'toes': (-.3, -1, 0)}}


def wheel_type(inches=31):
    """In a manual wheelchair at the desk; 31 in lets the knees roll under the keyboard tray."""
    keys = keys_at(inches)
    return {'pelvis': (0, .03, WHEEL_SEAT + .095), 'pelvis_pitch': 2, 'spine': (3, 4, 4), 'neck': 2, 'head': -2,
            'hand_l': {'at': (.14, -.375, keys + .04), 'elbow': (.16, .28, -.3), **_TYPE_L},
            'hand_r': {'at': (-.14, -.375, keys + .04), 'elbow': (-.16, .28, -.3), **_TYPE_R},
            'foot_l': {'at': (.085, -.41, .235), 'toes': (.1, -1, 0)}, 'foot_r': {'at': (-.085, -.41, .235), 'toes': (-.1, -1, 0)}}


def sit_coffee(inches=28):
    """Seated at the desk, sitting back a little: the left hand on the keyboard, a mug in the right, reading the screen."""
    keys = keys_at(inches)
    return {'pelvis': (0, .03, SEAT + .09), 'pelvis_pitch': -2, 'spine': (1, 2, 3), 'neck': 2, 'head': -1,
            'hand_l': {'at': (.12, -.39, keys + .04), 'elbow': (.16, .28, -.3), **_TYPE_L},
            'hand_r': {**_cup(1, 'r', (-.13, -.27, max(keys + .1, SEAT + .4))), 'elbow': (-.25, .25, -.35)},
            'foot_l': {'at': (.12, -.40, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.13, -.36, .075), 'toes': (-.22, -1, 0)}}


def stand_coffee(inches=43.5):
    """Standing at the raised desk with the first coffee: the left hand on the keyboard, the mug in the right."""
    keys = keys_at(inches)
    return {'spine': (1, 2, 2), 'neck': 6, 'head': 4, 'pelvis_roll': -1,
            'hand_l': {'at': (.13, -.33, keys + .04), 'elbow': (.2, .3, -.35), **_TYPE_L},
            'hand_r': {**_cup(1, 'r', (-.13, -.24, keys + .02)), 'elbow': (-.22, .25, -.45)},
            'foot_l': {'at': (.11, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': (-.13, .07, .07), 'toes': (-.35, -1, 0)}}


# ---- children: poses take the child's size (k) and the measured child furniture ---------------------------------
def kid_sit_table(seat, table):
    """A child on a small chair at a low table, drawing with a crayon, the other hand holding the paper."""
    def pose(k):
        return {'pelvis': (0, .0, seat + .075 * k), 'pelvis_pitch': 6, 'spine': (6, 8, 8), 'neck': 14, 'head': 14, 'head_yaw': -5,
                'hand_r': {'at': (-.07 * k, -.27 * k, table + .03), 'fingers': (.45, -1, -.3), 'palm': (.45, .1, -1), 'elbow': (-.3, .15, -.25), 'curl': .7, 'thumb': .55},
                'hand_l': {'at': (.14 * k, -.25 * k, table + .022), 'fingers': (-.55, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.3, .15, -.25), 'curl': .15, 'thumb': .1, 'spread': .3},
                'foot_l': {'at': (.09 * k, -.2 * k, .07 * k), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.09 * k, -.16 * k, .07 * k), 'toes': (-.2, -1, 0)}}
    return pose


def kid_read_floor(k):
    """Cross-legged on the floor or a rug with a picture book open in both hands."""
    p = sit_floor(k); p.update({'neck': 16, 'head': 16, 'spine': (8, 6, 4),
        'hand_l': {'at': _s(k, .1, -.26, .34), 'fingers': (-.35, -.45, .8), 'palm': (-.25, .75, .6), 'elbow': (.25, .2, -.3), 'curl': .3, 'thumb': .1},
        'hand_r': {'at': _s(k, -.1, -.26, .34), 'fingers': (.35, -.45, .8), 'palm': (.25, .75, .6), 'elbow': (-.25, .2, -.3), 'curl': .3, 'thumb': .1}})
    return p


def kid_play_floor(k):
    """Kneeling up on the floor, building: both hands down at a toy in front."""
    return {'pelvis': _s(k, 0, .12, .36), 'pelvis_pitch': 18, 'spine': (12, 12, 8), 'neck': 18, 'head': 14,
            'hand_l': {'at': _s(k, .1, -.3, .12), 'fingers': (-.1, -1, -.5), 'palm': (0, 0, -1), 'elbow': (.3, .3, 0), 'curl': .45, 'thumb': .3},
            'hand_r': {'at': _s(k, -.12, -.33, .15), 'fingers': (.1, -1, -.4), 'palm': (0, 0, -1), 'elbow': (-.3, .3, 0), 'curl': .55, 'thumb': .4},
            'foot_l': {'at': _s(k, .1, .42, .05), 'toes': (0, -.2, -1), 'pitch': 70, 'knee': (0, -1, -1)},
            'foot_r': {'at': _s(k, -.1, .42, .05), 'toes': (0, -.2, -1), 'pitch': 70, 'knee': (0, -1, -1)}}


def kid_sit_stool(seat, top):
    """A child on a stool or study chair too high for their feet (they rest on the rung), drawing on the desk."""
    def pose(k):
        rung = max(.07 * k, seat - .37 * k)
        return {'pelvis': (0, .0, seat + .075 * k), 'pelvis_pitch': 4, 'spine': (4, 6, 5), 'neck': 10, 'head': 11, 'head_yaw': -4,
                'hand_r': {'at': (-.07 * k, -.29 * k, top + .03), 'fingers': (.45, -1, -.3), 'palm': (.45, .1, -1), 'elbow': (-.3, .15, -.25), 'curl': .7, 'thumb': .55},
                'hand_l': {'at': (.14 * k, -.27 * k, top + .022), 'fingers': (-.55, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.3, .15, -.25), 'curl': .15, 'thumb': .1, 'spread': .3},
                'foot_l': {'at': (.085 * k, -.12 * k, rung), 'toes': (.15, -1, -.25)}, 'foot_r': {'at': (-.085 * k, -.09 * k, rung), 'toes': (-.15, -1, -.25)}}
    return pose


def kid_kneel_table(top):
    """Kneeling at a low craft table, both hands on the work."""
    def pose(k):
        p = kid_play_floor(k)
        p.update({'pelvis_pitch': 8, 'spine': (6, 6, 5), 'neck': 14, 'head': 12,
                  'hand_l': {'at': (.11 * k, -.3 * k, top + .025), 'fingers': (-.2, -1, -.1), 'palm': (0, 0, -1), 'elbow': (.3, .25, -.2), 'curl': .3, 'thumb': .2, 'spread': .3},
                  'hand_r': {'at': (-.1 * k, -.32 * k, top + .035), 'fingers': (.4, -1, -.3), 'palm': (.4, .1, -1), 'elbow': (-.3, .25, -.2), 'curl': .7, 'thumb': .55}})
        return p
    return pose


def kid_stand(k):
    """A child standing, looking up a little, one hand half raised as if showing or asking."""
    return {'spine': (0, 1, 1), 'neck': -6, 'head': -8, 'head_yaw': 8,
            'hand_r': {'at': _s(k, -.2, -.2, 1.02), 'fingers': (-.1, -.5, .85), 'palm': (.3, -.9, .2), 'elbow': (-.25, .3, -.4), 'curl': .3, 'thumb': .2, 'spread': .3},
            'hand_l': _hang(k, 'l'),
            'foot_l': {'at': _s(k, .09, .0, .07 / k), 'toes': (.25, -1, 0)}, 'foot_r': {'at': _s(k, -.1, .03, .07 / k), 'toes': (-.3, -1, 0)}}


def kid_stand_desk(inches=28):
    """A child standing at the desk on its lowest setting, drawing on it (the top at chest height for a small child)."""
    top = keys_at(inches) + .04
    return lambda k: {'spine': (2, 3, 3), 'neck': 6, 'head': 8,
                      'hand_r': {'at': (-.08 * k, -.36 * k, top), 'fingers': (.45, -1, -.3), 'palm': (.45, .1, -1), 'elbow': (-.35, .1, -.3), 'curl': .7, 'thumb': .55},
                      'hand_l': {'at': (.14 * k, -.34 * k, top - .008), 'fingers': (-.55, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.35, .1, -.3), 'curl': .15, 'thumb': .1, 'spread': .3},
                      'foot_l': {'at': _s(k, .09, .0, .07), 'toes': (.25, -1, 0)}, 'foot_r': {'at': _s(k, -.09, .05, .07), 'toes': (-.3, -1, 0)}}


# Desk poses take the desk height (inches) from the output's 'height'.
DESK_POSES = {'sit-type': sit_type, 'stand-type': stand_type, 'wheel-type': wheel_type, 'sit-coffee': sit_coffee, 'stand-coffee': stand_coffee,
              # Standing at the desk's lowest setting: the working height for a person of short stature.
              'stand-type-low': lambda inches=28: dict(stand_type(inches, .27), spine=(1, 2, 2), neck=0, head=-4),
              # Standing at a desk set between sitting and standing (35-36 in, bench height): leaning in over the work.
              'kid-stand-desk': kid_stand_desk,
              # A school-age child on the room's stool or study chair (seat 495 mm) at the desk on its lowest setting.
              'kid-sit-desk': lambda inches=28: kid_sit_stool(.495, keys_at(inches) + .012),
              'stand-low': lambda inches=35.5: dict(stand_type(inches, .3), pelvis_pitch=9, spine=(4, 5, 4), neck=10, head=8),
              # Standing at a desk set a hand below full standing height (38 to 40 in): the stations that stand there.
              'stand-mid': lambda inches=39: dict(stand_type(inches, .31), pelvis_pitch=3, spine=(3, 4, 3), neck=8, head=6)}
KEYS_WHEEL = .759    # keyboard top with the desk at 31 in, raised so the knees clear the tray

POSES = {
    # Rolling: both hands on the handrims, looking ahead.
    'wheel-roll': {
        'pelvis': (0, .03, WHEEL_SEAT + .095), 'pelvis_pitch': 6, 'spine': (5, 6, 4), 'neck': -8, 'head': -8, 'head_yaw': 10,
        'hand_l': {'at': (.305, .0, WHEEL_SEAT + .075), 'fingers': (0, -.6, -1), 'palm': (-1, 0, 0), 'elbow': (.2, .4, .2), 'curl': .7, 'thumb': .3},
        'hand_r': {'at': (-.305, .0, WHEEL_SEAT + .075), 'fingers': (0, -.6, -1), 'palm': (1, 0, 0), 'elbow': (-.2, .4, .2), 'curl': .7, 'thumb': .3},
        'foot_l': {'at': (.085, -.41, .235), 'toes': (.1, -1, 0)}, 'foot_r': {'at': (-.085, -.41, .235), 'toes': (-.1, -1, 0)},
    },
    # In a wheelchair, at ease: sitting back, hands on the thighs, eyes up on a screen.
    'wheel-watch': {
        'pelvis': (0, .03, WHEEL_SEAT + .095), 'pelvis_pitch': -3, 'spine': (0, 2, 3), 'neck': -4, 'head': -6,
        'hand_l': {'at': (.15, -.3, WHEEL_SEAT + .19), 'fingers': (-.2, -1, -.25), 'palm': (0, 0, -1), 'elbow': (.3, .3, -.1), 'curl': .35, 'thumb': .2},
        'hand_r': {'at': (-.15, -.3, WHEEL_SEAT + .19), 'fingers': (.2, -1, -.25), 'palm': (0, 0, -1), 'elbow': (-.3, .3, -.1), 'curl': .35, 'thumb': .2},
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
    'stand-paint': stand_paint,
    'stretch': stretch,
    'stretch-open': stretch_open,
    'cane-stand': cane_stand,
    'white-cane': white_cane,
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
    # At a table, listening: forearms on the table, head up toward the front of the room.
    'sit-listen': {
        'pelvis': (0, .0, CHAIR + .09), 'pelvis_pitch': 4, 'spine': (3, 4, 3), 'neck': -4, 'head': -6, 'head_yaw': 8,
        'hand_l': {'at': (.15, -.32, TABLE + .028), 'fingers': (-.6, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.3, .15, -.25), 'curl': .25, 'thumb': .15},
        'hand_r': {'at': (-.05, -.36, TABLE + .05), 'fingers': (.7, -.9, -.05), 'palm': (.2, 0, -1), 'elbow': (-.3, .15, -.25), 'curl': .3, 'thumb': .2},
        'foot_l': {'at': (.13, -.34, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.12, -.26, .075), 'toes': (-.2, -1, 0)},
    },
    # At a table with a hand up.
    'sit-raise': {
        'pelvis': (0, .0, CHAIR + .09), 'pelvis_pitch': 2, 'spine': (1, 1, 0), 'neck': -6, 'head': -8,
        'hand_r': {'at': (-.24, -.05, CHAIR + 1.08), 'fingers': (.05, -.05, 1), 'palm': (.2, -1, 0), 'elbow': (-.3, -.1, .1), 'curl': .1, 'thumb': .1, 'spread': .3},
        'hand_l': {'at': (.14, -.33, TABLE + .028), 'fingers': (-.5, -1, -.05), 'palm': (0, 0, -1), 'elbow': (.3, .15, -.25), 'curl': .2, 'thumb': .1},
        'foot_l': {'at': (.13, -.3, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.13, -.3, .075), 'toes': (-.2, -1, 0)},
    },
    # Seated anywhere (bench, lounge chair, power wheelchair), phone in both hands in the lap.
    'sit-phone': {
        'pelvis': (0, .02, LOUNGE + .09), 'pelvis_pitch': 0, 'spine': (4, 6, 6), 'neck': 14, 'head': 16,
        'hand_r': {'at': (-.05, -.3, LOUNGE + .3), 'fingers': (.3, -.5, .8), 'palm': (.3, .8, .5), 'elbow': (-.3, .15, -.2), 'curl': .6, 'thumb': .4},
        'hand_l': {'at': (.09, -.27, LOUNGE + .27), 'fingers': (-.5, -.6, .6), 'palm': (-.3, .7, .6), 'elbow': (.3, .15, -.2), 'curl': .5, 'thumb': .3},
        'foot_l': {'at': (.12, -.4, .075), 'toes': (.2, -1, 0)}, 'foot_r': {'at': (-.12, -.36, .075), 'toes': (-.2, -1, 0)},
    },
    'stand-phone': stand_phone,
    'stand-wait': stand_wait,
    'stand-present': stand_present,
    'walk': walk,
    'stand-mug': stand_mug,
    'stand-drink': stand_drink,
    'stand-talk': stand_talk,
    'carry-box': carry_box,
    'kneel-shelf': kneel_shelf,
    'sit-floor': sit_floor,
    'floor-stretch': floor_stretch,
    'sit-mug': sit_mug,
    'sit-chat': sit_chat,
    # Children (cast.CHILDREN): on the floor, at child furniture (heights measured in the rooms), on their feet.
    'kid-sit-floor': sit_floor,
    'kid-read-floor': kid_read_floor,
    'kid-play-floor': kid_play_floor,
    'kid-stand': kid_stand,
    'kid-stand-wait': stand_wait,
    'kid-sit-k': kid_sit_table(.26, .52),          # kindergarten: 260 mm seat, 520 mm table
    'kid-sit-e': kid_sit_table(.36, .62),          # elementary: 360 mm seat, 620 mm table
    'kid-kneel-craft': kid_kneel_table(.45),       # the child's room craft table, 450 mm
    'stand-brief': stand_brief,
    'stand-radio': stand_radio,
    'stand-chart': stand_chart,
    'push-cart': push_cart,
    'lie-bed': lie_bed,
    'sit-microscope': sit_microscope,
    'stand-counter': stand_counter,
}

# id -> character, pose, library name, what they hold.
OUTPUTS = [
    {'id': 'people-maya-sit-type', 'character': 'maya', 'pose': 'sit-type', 'height': 28, 'name': 'Maya, typing at the desk (seated)'},
    {'id': 'people-maya-sit-type-30', 'character': 'maya', 'pose': 'sit-type', 'height': 30, 'name': 'Maya, typing at the desk at 30 in (seated)'},
    {'id': 'people-maya-stretch', 'character': 'maya', 'pose': 'stretch-open', 'name': 'Maya, stretching at her desk'},
    {'id': 'people-maya-stand-phone', 'character': 'maya', 'pose': 'stand-phone', 'name': 'Maya, with the desk app on her phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-maya-stand-type', 'character': 'maya', 'pose': 'stand-type', 'height': 43.5, 'name': 'Maya, typing at the desk (standing)'},
    {'id': 'people-maya-stand-wait', 'character': 'maya', 'pose': 'stand-wait', 'name': 'Maya, on her feet while the desk moves'},
    {'id': 'people-andre-sit-type', 'character': 'andre', 'pose': 'sit-type', 'height': 28, 'name': 'Andre, typing at the desk (seated)'},
    {'id': 'people-andre-sit-type-30', 'character': 'andre', 'pose': 'sit-type', 'height': 30, 'name': 'Andre, typing at the desk at 30 in (seated)'},
    {'id': 'people-andre-stand-type', 'character': 'andre', 'pose': 'stand-type', 'height': 43.5, 'name': 'Andre, typing at the desk (standing)'},
    {'id': 'people-andre-stand-phone', 'character': 'andre', 'pose': 'stand-phone', 'name': 'Andre, with the desk app on his phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-grace-sit-read', 'character': 'grace', 'pose': 'sit-read', 'name': 'Grace, reading in an armchair', 'held': [('book', {'side': 'l'})]},
    {'id': 'people-grace-cane-stand', 'character': 'grace', 'pose': 'cane-stand', 'name': 'Grace, standing with a walking stick', 'held': [('cane', {'side': 'r'})]},
    {'id': 'people-kai-sit-write', 'character': 'kai', 'pose': 'sit-write', 'name': 'Kai, writing at a table', 'held': [('pen', {'side': 'r'})]},
    {'id': 'people-kai-sit-controller', 'character': 'kai', 'pose': 'sit-controller', 'name': 'Kai, on the sofa with a controller', 'held': [('gamepad', {})]},
    {'id': 'people-kai-wheel-type', 'character': 'kai', 'pose': 'wheel-type', 'height': 28, 'name': 'Kai, at the desk (wheelchair)', 'held': [('wheelchair', {'color': (.1, .35, .7)})]},
    {'id': 'people-kai-wheel-roll', 'character': 'kai', 'pose': 'wheel-roll', 'name': 'Kai, rolling (wheelchair)', 'held': [('wheelchair', {'color': (.1, .35, .7)})]},
    {'id': 'people-zoe-sit-laptop', 'character': 'zoe', 'pose': 'sit-laptop', 'name': 'Zoe, at a laptop'},
    {'id': 'people-zoe-walk', 'character': 'zoe', 'pose': 'walk', 'name': 'Zoe, walking with a backpack', 'held': [('backpack', {})]},
    {'id': 'people-zoe-stand-type', 'character': 'zoe', 'pose': 'stand-type', 'height': 41, 'name': 'Zoe, at a standing desk (41 in)'},
    {'id': 'people-mia-sit-listen', 'character': 'mia', 'pose': 'sit-listen', 'name': 'Mia, listening at a table'},
    {'id': 'people-mia-sit-type', 'character': 'mia', 'pose': 'sit-type', 'height': 28, 'name': 'Mia, typing at the desk (seated)'},
    {'id': 'people-leo-sit-raise', 'character': 'leo', 'pose': 'sit-raise', 'name': 'Leo, hand up at a table'},
    {'id': 'people-leo-sit-write', 'character': 'leo', 'pose': 'sit-write', 'name': 'Leo, writing at a table', 'held': [('pen', {'side': 'r'})]},
    {'id': 'people-noah-sit-laptop', 'character': 'noah', 'pose': 'sit-laptop', 'name': 'Noah, at a laptop'},
    {'id': 'people-noah-sit-type', 'character': 'noah', 'pose': 'sit-type', 'height': 28, 'name': 'Noah, typing at the desk (seated)'},
    {'id': 'people-hale-stand-present', 'character': 'hale', 'pose': 'stand-present', 'name': 'Mr Hale, presenting', 'held': [('tablet', {'side': 'l'})]},
    {'id': 'people-omar-wheel-type', 'character': 'omar', 'pose': 'wheel-type', 'height': 31, 'name': 'Omar, typing at the desk (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-omar-wheel-type-28', 'character': 'omar', 'pose': 'wheel-type', 'height': 28, 'name': 'Omar, typing at the desk at 28 in (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-lin-stand-type', 'character': 'lin', 'pose': 'stand-type', 'height': 43.5, 'name': 'Lin, typing at the desk (standing)'},
    {'id': 'people-noah-sit-type-30', 'character': 'noah', 'pose': 'sit-type', 'height': 30, 'name': 'Noah, typing at the desk at 30 in (seated)'},
    {'id': 'people-noah-stand-type', 'character': 'noah', 'pose': 'stand-type', 'height': 43.5, 'name': 'Noah, typing at the desk (standing)'},
    {'id': 'people-noah-stand-wait', 'character': 'noah', 'pose': 'stand-wait', 'name': 'Noah, on his feet while the desk moves'},
    {'id': 'people-mia-sit-type-30', 'character': 'mia', 'pose': 'sit-type', 'height': 30, 'name': 'Mia, typing at the desk at 30 in (seated)'},
    {'id': 'people-mia-stand-type', 'character': 'mia', 'pose': 'stand-type', 'height': 43.5, 'name': 'Mia, typing at the desk (standing)'},
    {'id': 'people-mia-sit-phone', 'character': 'mia', 'pose': 'sit-phone', 'name': 'Mia, seated with her phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-lin-sit-type-30', 'character': 'lin', 'pose': 'sit-type', 'height': 30, 'name': 'Lin, typing at the desk at 30 in (seated)'},
    {'id': 'people-lin-sit-phone', 'character': 'lin', 'pose': 'sit-phone', 'name': 'Lin, seated with her phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-ava-sit-write', 'character': 'ava', 'pose': 'sit-write', 'name': 'Ava, writing at a table', 'held': [('pen', {'side': 'r'})]},
    {'id': 'people-eli-sit-listen', 'character': 'eli', 'pose': 'sit-listen', 'name': 'Eli, listening at a table'},
    {'id': 'people-sofia-sit-laptop', 'character': 'sofia', 'pose': 'sit-laptop', 'name': 'Sofia, at a laptop'},
    {'id': 'people-omar-wheel-watch', 'character': 'omar', 'pose': 'wheel-watch', 'name': 'Omar, watching a screen (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-omar-wheel-roll', 'character': 'omar', 'pose': 'wheel-roll', 'name': 'Omar, rolling (wheelchair)', 'held': [('wheelchair', {})]},
    {'id': 'people-lin-stand-paint', 'character': 'lin', 'pose': 'stand-paint', 'name': 'Lin, painting at an easel', 'held': [('brush', {'side': 'r'}), ('palette', {'side': 'l'})]},
    {'id': 'people-lin-sit-type', 'character': 'lin', 'pose': 'sit-type', 'height': 28, 'name': 'Lin, typing at the desk (seated)'},
    {'id': 'people-sam-sit-game', 'character': 'sam', 'pose': 'sit-type', 'height': 28, 'name': 'Sam, gaming at the desk', 'held': [('headphones', {}), ('prosthesis', {'side': 'r'})]},
    {'id': 'people-sam-sit-game-30', 'character': 'sam', 'pose': 'sit-type', 'height': 30, 'name': 'Sam, gaming at the desk at 30 in', 'held': [('headphones', {}), ('prosthesis', {'side': 'r'})]},
    {'id': 'people-sam-stand-type', 'character': 'sam', 'pose': 'stand-type', 'height': 43.5, 'name': 'Sam, at the desk (standing)', 'held': [('prosthesis', {'side': 'r'})]},
    {'id': 'people-priya-stretch', 'character': 'priya', 'pose': 'stretch', 'name': 'Priya, stretching'},
    {'id': 'people-priya-sit-phone', 'character': 'priya', 'pose': 'sit-phone', 'name': 'Priya, seated with her phone', 'held': [('phone', {'side': 'r'})]},
    {'id': 'people-jo-stand-work', 'character': 'jo', 'pose': 'stand-work', 'name': 'Jo, working at the bench', 'held': [('screwdriver', {'side': 'r'})]},
    {'id': 'people-ben-white-cane', 'character': 'ben', 'pose': 'white-cane', 'name': 'Ben, walking with a white cane', 'held': [('cane', {'side': 'r', 'white': True})]},
    {'id': 'people-rosa-stand-type-low', 'character': 'rosa', 'pose': 'stand-type-low', 'height': 28, 'name': 'Rosa, at the desk on its lowest setting (standing)'},
    {'id': 'people-andre-sit-mix', 'character': 'andre', 'pose': 'sit-type', 'height': 28, 'name': 'Andre, mixing at the desk with headphones (seated)', 'held': [('headphones', {})]},
    {'id': 'people-andre-sit-mix-30', 'character': 'andre', 'pose': 'sit-type', 'height': 30, 'name': 'Andre, mixing at the desk at 30 in with headphones (seated)', 'held': [('headphones', {})]},
    {'id': 'people-rosa-stand-type-30', 'character': 'rosa', 'pose': 'stand-type-low', 'height': 30, 'name': 'Rosa, at the desk at 30 in (standing)'},
]


# ---- every pose, for the people catalog (assets/props/people.json) and for models built on request
# label, stance (standing | seated | wheelchair | walking), where it belongs ('desk' = at the featured desk, built
# for a desk height), the seat height it was posed on (mm), and what the person holds unless the output says otherwise.
POSE_INFO = {
    'sit-type': ('Typing at the desk, seated', 'seated', 'desk', 435, []),
    'stand-type': ('Typing at the desk, standing', 'standing', 'desk', 0, []),
    'stand-type-low': ('At the desk on a low setting, standing', 'standing', 'desk', 0, []),
    'wheel-type': ('Typing at the desk, in a wheelchair', 'wheelchair', 'desk', 0, [('wheelchair', {})]),
    'stand-wait': ('Standing by, arms loose', 'standing', '', 0, []),
    'stand-phone': ('Standing, phone in hand', 'standing', '', 0, [('phone', {'side': 'r'})]),
    'stand-present': ('Presenting, tablet on the arm', 'standing', '', 0, [('tablet', {'side': 'l'})]),
    'stand-work': ('Working at a bench', 'standing', '', 0, [('screwdriver', {'side': 'r'})]),
    'stand-paint': ('Painting at an easel', 'standing', '', 0, [('brush', {'side': 'r'}), ('palette', {'side': 'l'})]),
    'stretch': ('Stretching, arms overhead', 'standing', '', 0, []),
    'stretch-open': ('Stretching, hands behind the head', 'standing', '', 0, []),
    'cane-stand': ('Standing with a walking stick', 'standing', '', 0, [('cane', {'side': 'r'})]),
    'white-cane': ('Walking with a white cane', 'walking', '', 0, [('cane', {'side': 'r', 'white': True})]),
    'walk': ('Walking', 'walking', '', 0, []),
    'sit-write': ('Writing at a table', 'seated', '', 450, [('pen', {'side': 'r'})]),
    'sit-laptop': ('At a laptop', 'seated', '', 450, []),
    'sit-read': ('Reading', 'seated', '', 420, [('book', {'side': 'l'})]),
    'sit-listen': ('Listening at a table', 'seated', '', 450, []),
    'sit-raise': ('Hand raised', 'seated', '', 450, []),
    'sit-phone': ('Seated, phone in hand', 'seated', '', 420, [('phone', {'side': 'r'})]),
    'sit-controller': ('On a sofa with a game controller', 'seated', '', 420, [('gamepad', {})]),
    'wheel-roll': ('Rolling, in a wheelchair', 'wheelchair', '', 0, [('wheelchair', {})]),
    'wheel-watch': ('Watching a screen, in a wheelchair', 'wheelchair', '', 0, [('wheelchair', {})]),
    'stand-low': ('Working standing at a bench-height desk', 'standing', 'desk', 0, []),
    'sit-coffee': ('Coffee at the desk, seated', 'seated', 'desk', 435, [('cup', {'side': 'r'})]),
    'stand-coffee': ('Coffee at the desk, standing', 'standing', 'desk', 0, [('cup', {'side': 'r'})]),
    'stand-mug': ('Standing with a coffee', 'standing', '', 0, [('cup', {'side': 'r'})]),
    'stand-drink': ('Standing with a drink, chatting', 'standing', '', 0, [('cup', {'side': 'r', 'kind': 'glass'})]),
    'stand-talk': ('Standing, explaining something', 'standing', '', 0, []),
    'carry-box': ('Carrying a box', 'standing', '', 0, [('carton', {})]),
    'kneel-shelf': ('Kneeling at a low shelf', 'seated', '', 0, []),
    'sit-floor': ('Sitting cross-legged on the floor', 'seated', '', 0, []),
    'floor-stretch': ('Stretching on a mat', 'seated', '', 0, []),
    'sit-mug': ('Sitting back with a mug', 'seated', '', 420, [('cup', {'side': 'r'})]),
    'sit-chat': ('On a sofa with a drink, chatting', 'seated', '', 420, [('cup', {'side': 'r', 'kind': 'glass'})]),
    'kid-stand-desk': ('Drawing at the desk, standing', 'standing', 'desk', 0, [('pen', {'side': 'r'})]),
    'kid-sit-desk': ('Drawing at the desk, on the stool', 'seated', 'desk', 495, [('pen', {'side': 'r'})]),
    'kid-sit-floor': ('Sitting cross-legged on the floor', 'seated', '', 0, []),
    'kid-read-floor': ('On the floor with a picture book', 'seated', '', 0, [('book', {'side': 'l'})]),
    'kid-play-floor': ('Kneeling, building on the floor', 'seated', '', 0, []),
    'kid-stand': ('Standing, showing something', 'standing', '', 0, []),
    'kid-stand-wait': ('Standing by', 'standing', '', 0, []),
    'kid-sit-k': ('Drawing at a kindergarten table', 'seated', '', 260, [('pen', {'side': 'r'})]),
    'kid-sit-e': ('Drawing at an elementary school table', 'seated', '', 360, [('pen', {'side': 'r'})]),
    'kid-kneel-craft': ('Kneeling at a low craft table', 'seated', '', 0, [('pen', {'side': 'r'})]),
    'stand-mid': ('Typing standing at a mid-height desk', 'standing', 'desk', 0, []),
    'stand-brief': ('Standing at ease, thumbs at the belt', 'standing', '', 0, []),
    'stand-radio': ('On the radio, hand at the shoulder', 'standing', '', 0, [('radio', {'side': 'l'})]),
    'stand-chart': ('Reading a chart on a clipboard', 'standing', '', 0, [('clipboard', {'side': 'l'}), ('pen', {'side': 'r'})]),
    'push-cart': ('Pushing a cart', 'walking', '', 0, []),
    'lie-bed': ('Lying in a hospital bed', 'seated', '', 663, []),
    'sit-microscope': ('At a microscope, on a lab stool', 'seated', '', 650, []),
    'stand-counter': ('Serving at a counter', 'standing', '', 0, []),
}
# The roles' postures: built for the characters that list them ('postures'), for anyone else on request.
ROLE_POSES = {'stand-brief', 'stand-radio', 'stand-chart', 'push-cart', 'lie-bed', 'sit-microscope', 'stand-counter'}
# Built where the pose puts them, not dropped until something touches the floor (a body lying on a bed has nothing on it).
RAISED = {'lie-bed', 'sit-microscope'}       # (and feet on a stool's ring are not on the floor either)
DESK_HEIGHTS = {'sit-type': (28, 30), 'stand-type': (43.5,), 'stand-type-low': (28, 30), 'wheel-type': (28, 31), 'sit-coffee': (28, 30), 'stand-coffee': (43.5,), 'stand-low': (35.5,), 'stand-mid': (39,), 'kid-stand-desk': (28,), 'kid-sit-desk': (28,)}
# Who a posture is for: adult poses are built on adult furniture, child poses on child furniture.
CHILD_POSES = {p for p in POSE_INFO if p.startswith('kid-')}
def suits(who, pose): return (who in CHILDREN) == (pose in CHILD_POSES)
# What the library holds of a character: everything that suits them, or, for a role character, their own list
# ('postures'). Any other posture is still built on request (output()).
# (the mid-height desk is at the shoulders of someone of short stature: Rosa works at 28 and 30 in)
def listed(who, pose): return pose in CHARACTERS[who]['postures'] if 'postures' in CHARACTERS[who] else pose not in ROLE_POSES and not (pose == 'stand-mid' and CHARACTERS[who].get('limbs'))


# Built besides: Sam's listed seated desk models wear his gaming headphones (sit-game), these are him at any other
# desk; Grace and Ben in a hospital bed, so a ward of three has three different people.
ALSO = ['people-sam-sit-type', 'people-sam-sit-type-30', 'people-grace-lie-bed', 'people-ben-lie-bed']
# A posture nudged for one person (metres added to a hand's or a foot's place): the clipboard lies as the left hand
# holds it, and on Yusuf's broader chest it tips into the writing hand.
NUDGE = {('yusuf', 'stand-chart'): {'hand_r': (.02, .0, .035)}}
# A model in an outfit of its own ('as' on its output: these keys replace the character's): in a hospital bed Grace
# and Ben wear a gown like the ward's patients, not their day clothes.
VARIANTS = {
    'people-grace-lie-bed': {'wear': [('gown', {'color': (.76, .72, .86), 'print_color': (.54, .48, .7)})], 'clothes': ['spamrakuen_tbm_glasses_frames_01'], 'tint': {}},
    'people-ben-lie-bed': {'wear': [('gown', {'color': (.84, .8, .68), 'print_color': (.62, .54, .4)})], 'clothes': ['toigo_round_glasses_leopard'], 'tint': {'toigo_round_glasses_leopard': (.03, .03, .03)}},
}


def output(model_id):
    """The output for a model id: one of OUTPUTS, or, for a character and pose nobody listed, one made up from the id
    'people-<character>-<pose>' ('-<inches>' after a desk pose for another desk height)."""
    known = next((o for o in OUTPUTS if o['id'] == model_id), None)
    if known: return known
    if not model_id.startswith('people-'): raise KeyError(model_id)
    rest = model_id[len('people-'):]
    who = next((c for c in sorted(CHARACTERS, key=len, reverse=True) if rest.startswith(c + '-')), None)
    if not who: raise KeyError(model_id)
    tail = rest[len(who) + 1:]
    pose = next((p for p in sorted(POSE_INFO, key=len, reverse=True) if tail == p or tail.startswith(p + '-')), None)
    if not pose: raise KeyError(model_id)
    label, _stance, where, _seat, held = POSE_INFO[pose]
    out = {'id': model_id, 'character': who, 'pose': pose, 'name': '%s: %s' % (CHARACTERS[who]['name'], label[0].lower() + label[1:]), 'held': list(held)}
    if CHARACTERS[who].get('prosthesis'): out['held'].append(('prosthesis', {'side': CHARACTERS[who]['prosthesis']}))
    if pose in RAISED: out['ground'] = False
    if model_id in VARIANTS: out['as'] = VARIANTS[model_id]
    if where == 'desk':
        extra = tail[len(pose) + 1:]; out['height'] = float(extra.replace('_', '.')) if extra else DESK_HEIGHTS[pose][0]
        if out['height'] == int(out['height']): out['height'] = int(out['height'])
        if out['height'] != DESK_HEIGHTS[pose][0]: out['name'] += ' (desk at %s in)' % out['height']
    elif tail not in (pose, pose + '-2'): raise KeyError(model_id)      # '-2': the plain id is a listed model in another pose
    return out


def all_outputs():
    """Every character in every posture, desk postures at each of their desk heights: the listed OUTPUTS, then the rest
    under ids output() understands (python3 tools/people/build.py --all)."""
    have = {(o['character'], o['pose'], o.get('height')) for o in OUTPUTS}; ids = {o['id'] for o in OUTPUTS}; out = list(OUTPUTS)
    for who in CHARACTERS:
        for pose, (_label, _stance, where, _seat, _held) in POSE_INFO.items():
            if not suits(who, pose) or not listed(who, pose): continue
            for h in (DESK_HEIGHTS[pose] if where == 'desk' else (None,)):
                if (who, pose, h) in have: continue
                inches = None if h is None else str(h).replace('.', '_')
                mid = 'people-%s-%s' % (who, pose) + ('' if h is None or h == DESK_HEIGHTS[pose][0] else '-' + inches)
                if mid in ids: mid = 'people-%s-%s-%s' % (who, pose, inches or '2')
                o = output(mid); assert (o['character'], o['pose'], o.get('height')) == (who, pose, h), mid
                ids.add(mid); out.append(o)
    return out + [output(mid) for mid in ALSO if mid not in ids]

