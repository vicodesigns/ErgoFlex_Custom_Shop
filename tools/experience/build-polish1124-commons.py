#!/usr/bin/env python3
"""Polish pass for chapter 4 (commons), 24 Nov 2026, branch director/polish-1124-commons. Takes the cut's own chapter file
(director-film/commons.json: Vico's 3rd cut) and writes a DRAFT elsewhere; nothing of the cut is changed.

  build-polish1124-commons.py <cut dir> <out dir> [--grip params.json] [--dock-cm 0]

  <out>/commons-shot.json      the chapter shot with the polish
  <out>/commons-cut.json       the same wrapped as a one-shot client cut, for render-still.cjs / render-cut.cjs (--cut)
  <out>/Film-chapter-commons-polish1124.json   a Director export (schema ergoflex.client-cut, one shot) carrying
                               peopleEdits (the whole `people` of the chapter, v2): Director > Import cut on this file,
                               or drop it in the folder tools/experience/director-import-watch.py watches.

Stream B, Mia's phone: the same prop (mph01, the phone the film puts on the desk's wireless charger) travels from her hands
to the charger. She looks at it while the desk drives in (it is in her hands from the first frame; the model's own baked
phone is hidden: room-people.mjs placeCarry). Pass 3: when the desk has docked she tips it flat with her right hand, the
left hand takes it from above, sets it down on the charger (the prop's own rest, the film's edit) and goes straight on to
the keys; the action ends in the typing posture (room-people-motion.mjs placeToKeys), so the change to the typing model
after it moves nothing. Vico's desk (lift, dock) is the cut's own and is not touched. Re-run on a cut that already has the
pass-2 import: Mia's two entries are replaced, the extras are kept as they are (not added twice).

Stream C, the commons' other tables: seated people (laptop, reading, talking, coffee) at the empty tables and three
walkers, from the library's cast, none of a face already in the chapter.
"""
import copy, json, math, os, sys

S = 0.0015086610977927  # the room's scale: world metres per room millimetre (Room:library, turned 90 degrees)


def mm(x, z):
    """world (x, z) metres -> room mm [x, z]"""
    return [round(-z / S), round(x / S)]


def turn_for(fx, fz):
    """a world facing direction -> a placement's `turn` (degrees)"""
    return round(math.degrees(math.atan2(-fz, fx)), 1)


# ---- Stream B ---------------------------------------------------------------------------------------------------------
# pass 3 (Vico's notes on 1:46.55-1:48.05, after his own desk edit: lift 29 in, the wheels clip ending at z 150.5; his desk is
# kept as it is, nothing here moves it). The desk comes to rest at 13.4 s; at 13.65 s she tips the phone flat with her right
# hand while the left comes over it from above and takes it (13.95 s), carries it to the charger (touches down 14.25 s), lets
# go 0.06 s later, and the left hand goes straight on to the keys (on them at 14.94 s), the right hand already there; the eyes
# go from the phone to the screen. The action ends exactly in the typing posture (room-people-motion.mjs placeToKeys), so the
# change to the typing model after it moves nothing. Grip: the phone under the left palm, the ring and middle finger pads on
# its glass at the far end, the thumb 1-2 mm off its inner long edge, 8 mm down it; found by search against the phone's box
# (scratch work of the pass, checked frame by frame in tests/people-place-test.mjs).
PLACE = {'at': 13.6, 'grab': 0.5, 'contact': 0.85, 'settle': 0.06, 'hold': 0.08, 'back': 0.55, 'lift': 0.045, 'lift2': 0.035, 'bend': 0.9,
         'approach': 0.07, 'clear': 0.07, 'rightBack': 0.5, 'look': 0.5, 'turn': 0.7, 'side': 0.16, 'reachOut': 0.3, 'handover': [0.07, -0.08, 0.04], 'handoverTurn': -1.6, 'rightNudge': [0.007, 0, 0]}
TYPING = 'people-mia-power-type-30'
# Commons4 (Vico's three yeses on the Commons3 'not fixed' list): her seat 5 mm lower so the keyboard tray clears her thighs (the tray
# sat 3.1 to 3.8 mm into them at the desk's 29 in), and the wheelchair 20 mm further back from the desk (from the chair's own
# placement, a Director prop edit on the chair: the desk is not moved) so its right armrest / joystick no longer reaches into the
# keyboard's right end. She sits in that chair, so she goes back with it; the keys are then 20 mm further ahead of her and 5 mm
# higher in her own frame, which handsBy carries (the hands were [0, -41, -91] mm: [0, -32, -71], found so the fingertips sit as high
# above the key tops as before: the arm solve gives only about 4 mm of a 5 mm raise, so the y is 9, not 5).
SEAT = 475             # the cast's `seat` (mm, the pose's seat height the real seat is met at: a person stands this much lower the larger it is; was 470: 5 mm lower)
CHAIR_BACK_MM = 20     # mm the wheelchair rolls back from the desk (her frame -z, the world +x), at the film's 1.5087 scale: 30.17 mm world
CHAIR_SCALE = 1.5087
HANDS_BY = [0, -32, -71]   # mm, her frame: the keys from where the typing posture was built for (the desk 3.6 in nearer than the 3rd cut's 146.9 and 1 in lower), checked with the fingertips on the keys; Commons4: her seat 5 mm lower, 20 mm further back
DOCK_CM = 0.0          # pass 2 docked the desk 8 cm nearer here; Vico has set the dock himself since (z 150.5): 0, nothing moved
INCH = 2.54
GRIP = {'at': [0.0673, 0.1531, 0.0321], 'q': [0.6977, 0.4778, -0.1066, 0.523]}      # the phone where her hands hold it (the baked phone's place, measured)
GRIP2 = {'at': [0.03858, 0.11135, 0.07742], 'q': [-0.56274, 0.73644, -0.36599, -0.08389]}    # set down: under the left palm, pads on the glass, thumb at the inner edge
FINGERS = {'from': TYPING, 'thumb': [20, 10, 0]}
# the right index and thumb as the posture holds the phone sink 6 mm into the film's phone (a thicker prop than the posture's own):
# the index curled 20 degrees and the thumb lifted 28 degrees off its glass while she holds it (a correction, not a motion: the
# same all through the hold), back to the posture's own as the hand goes to the keys
INDEX_R = {'index_01_r': [0, 0, 0.17365, 0.98481], 'thumb_01_r': [-0.24192, 0, 0, 0.9703]}


def times(p):
    grab = p['grab']; contact = max(grab + 0.15, p['contact']); release = contact + p['settle']
    return {'grab': p['at'] + grab, 'contact': p['at'] + contact, 'release': p['at'] + release, 'end': p['at'] + release + p['hold'] + p['back']}


def mia(ppl, params):
    cast = {e['key']: e for e in ppl['cast']}
    waits, works = cast['mia-waits'], cast['mia-works']
    p = dict(PLACE, **params.get('place', {})); by = params.get('hands_by', HANDS_BY); t = times(p)
    waits['seat'] = works['seat'] = params.get('seat', SEAT)
    waits['act'] = {'kind': 'place', 'prop': '^Added prop:ergoflex-phone#mph01$', 'hand': 'l', **{k: p[k] for k in ('at', 'grab', 'contact', 'settle', 'hold', 'back', 'lift', 'lift2', 'bend', 'approach', 'clear', 'rightBack', 'look', 'turn', 'side', 'reachOut', 'handover', 'handoverTurn', 'rightNudge')},
                    'openFrom': 'people-mia-stretch', 'grip': params.get('grip', GRIP), 'grip2': params.get('grip2', GRIP2), 'fingers': params.get('fingers', FINGERS), 'to': TYPING, 'handsBy': by}
    # the typing posture's arm keys (Vico's, the last of them: the arms as he set them for typing) hold from the start of the typing
    # model, and come into the waiting model while the hand travels from the charger to the keys (both models then end in the same pose)
    keys = works['postures'][TYPING]['poseKeys']; final = keys[-1]['pose']
    end = round(t['end'], 3)
    works['postures'][TYPING]['poseKeys'] = [{'t': end, 'pose': final}]
    post = waits['postures']['people-mia-power-phone']; post.pop('poseKeys', None)
    let = t['grab'] + 0.03
    post['poseKeys'] = [{'t': 0, 'pose': dict(INDEX_R)}, {'t': round(let, 3), 'pose': dict(INDEX_R)}, {'t': round(let + 0.25, 3), 'pose': {b: [0, 0, 0, 1] for b in INDEX_R}},
                        {'t': round(t['release'] + p['hold'], 3), 'pose': {b: [0, 0, 0, 1] for b in final}}, {'t': end, 'pose': final}]
    works['change'] = {'seconds': 0.6, 'arms': [0.15, 1]}
    works['handsBy'] = by
    # the change of model right after the action ends (centred 0.3 s after it: the change is 0.6 s): nothing moves in it
    ppl['when']['mia-waits'] = [[0, round(end + 0.3, 3), 0, 0.5]]
    ppl['when']['mia-works'] = [[round(end + 0.3, 3), 99, 0.5, 0]]
    params['times'] = t


# ---- Stream C ---------------------------------------------------------------------------------------------------------
# world chair centres (x, z) and the way each faces (towards the table), as the stills showed them
SEATED = [
    # (key, model, chair x, z, facing (fx, fz), note)
    ('c4-dee-read',   'people-dee-sit-read',    -9.01, -5.96, (1, 0),   'reading, left table, the west chair'),
    ('c4-diego-chat', 'people-diego-sit-chat',  -3.62, -4.19, (0, 1),   'talking across the wide table'),
    ('c4-ivy-chat',   'people-ivy-sit-chat',    -3.64, -1.77, (0, -1),  'talking across the wide table'),
    ('c4-jack-lap',   'people-jack-sit-laptop', -1.20, -1.88, (0, -1),  'laptop'),
    ('c4-nia-lap',    'people-nia-sit-laptop',   4.37, -2.17, (1, 0),   'laptop, the table east of the project table'),
    ('c4-rosa-mug',   'people-rosa-sit-mug',     6.86, -2.19, (-1, 0),  'coffee'),
    ('c4-raj-lap',    'people-raj-sit-laptop',   2.47,  0.49, (0, 1),   'laptop, the long table at the bottom of the top-down'),
    ('c4-lin-mug',    'people-lin-sit-mug',      8.29, -10.03, (0, -1), 'coffee, the first round table'),
    ('c4-elena-chat', 'people-elena-sit-chat',  10.74, -11.83, (1, 0),  'talking, the second round table'),
    ('c4-amal-chat',  'people-amal-sit-chat',   12.78, -11.83, (-1, 0), 'talking, the second round table'),
    ('c4-bruno-read', 'people-bruno-sit-read',  15.84, -5.58, (0, -1),  'reading, the far round table'),
]
FORWARD = 60      # mm a seated person sits ahead of the chair's middle (the film's own Kai and Sofia are placed so)


def seated(row):
    key, model, x, z, (fx, fz), _ = row
    t = turn_for(fx, fz); ax, az = mm(x, z); yaw = math.radians(t)
    return {'key': key, 'id': model, 'at': [round(ax + FORWARD * math.sin(yaw)), round(az + FORWARD * math.cos(yaw))], 'turn': t, 'y': 20}


# walkers: (key, who, path in world metres, start s, seconds they are gone by (a short fade) | None: they stay, standing)
WALKERS = [
    ('c4-max-walks',  'max',  [(-6.2, -5.6), (-3.0, -5.7), (0.2, -5.5)],  0.0, 7.4),
    ('c4-finn-walks', 'finn', [(12.6, -3.6), (9.2, -2.6), (7.9, -1.2)],   0.5, None),
    ('c4-luca-walks', 'luca', [(-7.9, 1.4), (-7.9, -1.6), (-6.2, -2.4)],  0.0, 6.0),
]


def walker(row):
    key, who, path, start, gone = row
    pts = [mm(x, z) for x, z in path]
    return {'key': key, 'id': f'people-{who}-walk', 'at': pts[0], 'turn': turn_for(path[1][0] - path[0][0], path[1][1] - path[0][1]),
            'walk': {'path': pts, 'start': start, **({'then': f'people-{who}-stand-wait'} if gone is None else {})}}


def others(ppl):
    have = {e.get('key') for e in ppl['cast']}      # (a cut that has them already, the pass-2 import Vico made: kept as they are, not added twice)
    for row in SEATED:
        if row[0] not in have: ppl['cast'].append(seated(row))
    for row in WALKERS:
        if row[0] in have: continue
        ppl['cast'].append(walker(row))
        if row[4] is not None:
            ppl.setdefault('when', {})[row[0]] = [[0, row[4], 0, 0.8]]


CHAIR_LABEL = 'Wheelchair: 20 mm back from the desk (Commons4: its armrest clear of the keyboard)'


def chair_edit(params):
    """The Director's own prop edit on Mia's wheelchair (world metres from where the film puts it; she sits on it and goes with it)."""
    back = params.get('chair_back_mm', CHAIR_BACK_MM)
    return {'match': '^Prop:electric-wheelchair$', 'label': CHAIR_LABEL, 'position': [round(back * CHAIR_SCALE / 1000, 4), 0, 0]}


def chair_hides():
    """The model's own black swivel chair under each seated person is hidden (the film hides it for Sofia and Eli the same
    way): they sit on the table's oak chairs."""
    return [{'match': f"^Person chair:{row[1]}$", 'label': f"Person chair:{row[1]}", 'hide': True} for row in SEATED]


def dock(shot, cm):
    """The desk docks `cm` nearer her wheelchair: the last stretch of the wheels clip's path (and its target) gains the distance in
    proportion to how far along it is (so it still sets off and drives as before and only arrives further), in the clip's own
    inches. Nothing else of the desk's motion changes: it still comes to rest at 13.4 s."""
    if not cm: return
    inches = cm / INCH
    for c in shot.get('motion', {}).get('clips', []):
        if c.get('lane') != 'wheels' or not c.get('path'): continue
        z0, z1 = c['path'][0]['pose']['z'], c['path'][-1]['pose']['z']
        for k in c['path']: k['pose']['z'] = round(k['pose']['z'] + inches * max(0.0, (k['pose']['z'] - z0) / (z1 - z0)), 4)
        if isinstance(c.get('target'), dict) and 'z' in c['target']: c['target']['z'] = round(c['target']['z'] + inches, 4)


def cue(shot, release):
    """Mia's phone screen (the film's hand-made edit: lit in her hand, dims, wakes with the charging flash, then a glow) follows the new
    set-down. The Director import cannot carry this edit: see the patch file written beside the export."""
    keys = [[round(release + d, 2), v] for d, v in ((0, 0.7), (0.25, 0.7), (0.4, 0.25), (0.65, 1.0), (1.2, 1.0))] + [[16.0, 0.6]]
    for e in shot.get('sceneEdits', []):
        if e.get('materialName') == '^hUlRcbieVuIiOXG$' and e.get('path') == 'Added prop:ergoflex-phone#mph01':
            e['material']['emissiveIntensity'] = keys; return keys
    return None


def build(shot, params):
    shot = copy.deepcopy(shot); ppl = shot['people']
    if not params.get('skip_mia'):
        mia(ppl, params); dock(shot, params.get('dock_cm', DOCK_CM))
        if params.get('chair_back_mm', CHAIR_BACK_MM):
            shot['sceneEdits'] = [e for e in shot.get('sceneEdits', []) if e.get('label') != CHAIR_LABEL] + [dict(chair_edit(params), director=True)]
        params['cue'] = cue(shot, params['times']['release'])
    if not params.get('skip_others'):
        others(ppl)
        have = {e.get('match') for e in shot.get('sceneEdits', [])}
        shot.setdefault('sceneEdits', []).extend(dict(h, director=True) for h in chair_hides() if h['match'] not in have)
    return shot


def main(argv):
    cut, out = argv[0], argv[1]; params = {}
    if '--grip' in argv: params = json.load(open(argv[argv.index('--grip') + 1]))
    if '--dock-cm' in argv: params['dock_cm'] = float(argv[argv.index('--dock-cm') + 1])
    shot = json.load(open(os.path.join(cut, 'director-film/commons.json'), encoding='utf8'))
    new = build(shot, params); os.makedirs(out, exist_ok=True)
    json.dump(new, open(os.path.join(out, 'commons-shot.json'), 'w', encoding='utf8'), indent=1)
    cutid = json.load(open(os.path.join(cut, 'cut.json'), encoding='utf8'))['id']
    wrap = {'schema': 'ergoflex.client-cut', 'version': 1, 'id': 'commons-film', 'name': 'commons film (polish 1124 draft)', 'volume': 0, 'shots': [new]}
    json.dump(wrap, open(os.path.join(out, 'commons-cut.json'), 'w', encoding='utf8'))
    people = dict(new['people']); people['v'] = 2
    # the export is the Director's own file for the chapter (director-import/, its camera and motion as they are) with the
    # whole cast, and the whole prop list (the import replaces the list: Vico's own director props stay, the chair hides join)
    base = json.load(open(os.path.join(cut, 'director-import/ErgoFlex-film-ch04-commons-director.json'), encoding='utf8'))
    shot0 = copy.deepcopy(base['shots'][0])
    if not params.get('skip_mia'): dock(shot0, params.get('dock_cm', DOCK_CM))      # (the Director's own copy of the wheels clip: the import writes it back)
    props = json.load(open(os.path.join(cut, 'director-camera-commons.json'), encoding='utf8')).get('props', [])
    have = {e.get('match') for e in props}
    hides = [] if params.get('skip_others') else [h for h in chair_hides() if h['match'] not in have]
    props = [e for e in copy.deepcopy(props) if e.get('label') != CHAIR_LABEL]
    if not params.get('skip_mia') and params.get('chair_back_mm', CHAIR_BACK_MM): props.append(chair_edit(params))
    shot0.update({'peopleEdits': people, 'propEdits': props + hides})
    exp = dict(base, id=f'film-{cutid}-commons', name='Film chapter: commons (polish 1124 draft)', shots=[shot0])
    json.dump(exp, open(os.path.join(out, 'Film-chapter-commons-polish1124.json'), 'w', encoding='utf8'), indent=1)
    if params.get('cue'):
        json.dump({'_doc': 'By hand, in the cut files: the sceneEdits entry of the chapter whose path is "Added prop:ergoflex-phone#mph01" and materialName "^hUlRcbieVuIiOXG$" (director-film/commons.json, review-cut.json and shots/*.json): replace material.emissiveIntensity with this. The Director import cannot carry it (prop edits have no material).',
                   'match': r'^Supplied_phone_part_\d+$', 'path': 'Added prop:ergoflex-phone#mph01', 'materialName': '^hUlRcbieVuIiOXG$', 'emissiveIntensity': params['cue']},
                  open(os.path.join(out, 'phone-cue-patch.json'), 'w', encoding='utf8'), indent=1)
    print('wrote', out, '| cast', len(new['people']['cast']), '| cut id', cutid)


if __name__ == '__main__':
    main(sys.argv[1:])
