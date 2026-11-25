#!/usr/bin/env python3
"""Polish pass for chapter 4 (commons), 24 Nov 2026, branch director/polish-1124-commons. Takes the cut's own chapter file
(director-film/commons.json: Vico's 3rd cut) and writes a DRAFT elsewhere; nothing of the cut is changed.

  build-polish1124-commons.py <cut dir> <out dir> [--grip params.json] [--dock-cm 8]

  <out>/commons-shot.json      the chapter shot with the polish
  <out>/commons-cut.json       the same wrapped as a one-shot client cut, for render-still.cjs / render-cut.cjs (--cut)
  <out>/Film-chapter-commons-polish1124.json   a Director export (schema ergoflex.client-cut, one shot) carrying
                               peopleEdits (the whole `people` of the chapter, v2): Director > Import cut on this file,
                               or drop it in the folder tools/experience/director-import-watch.py watches.

Stream B, Mia's phone: the same prop (mph01, the phone the film puts on the desk's wireless charger) travels from her hands
to the charger. She looks at it while the desk drives in (it is in her hands from the first frame; the model's own baked
phone is hidden: room-people.mjs placeCarry), and when the desk docks she reaches with her LEFT hand, sets it down flat on
the charger (it comes to the prop's own rest, the film's edit: the charger's real place on that desk, not an estimate), the
hand withdraws, and the change into typing (people-mia-power-type-30) follows. Timings and grips are the numbers the
stills were checked with.

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
# pass 2 (Vico: she waits until the desk has docked): the desk's path ends at 13.4 s (wheels clip 7.2 + 6.2), so she notices and
# reaches 0.3 s later (13.7 s), the phone touches down at 14.25 s and is let go 0.06 s later, the hand withdraws, and the change into
# typing follows (hands on the keys at 15.4 s)
PLACE = {'at': 13.7, 'contact': 0.55, 'settle': 0.06, 'hold': 0.17, 'back': 0.35, 'lift': 0.05, 'bend': 0.93}
DOCK_CM = 8.0          # the desk docks this much nearer her wheelchair (cm): the wheels clip's last stretch, see dock()
INCH = 2.54
GRIP = {'at': [0.0673, 0.1531, 0.0321], 'q': [0.6977, 0.4778, -0.1066, 0.523]}      # the phone where her hands hold it (the baked phone's place, measured)
GRIP2 = {'at': [0.0, 0.08, 0.05], 'q': [0.0, 0.7071, -0.7071, 0.0]}                  # between thumb and fingers, the hand over it, to set it down
CHANGE_FROM, CHANGE_LEN = 14.8, 0.6


def mia(ppl, params):
    cast = {e['key']: e for e in ppl['cast']}
    waits, works = cast['mia-waits'], cast['mia-works']
    p = dict(PLACE, **params.get('place', {}))
    waits['act'] = {'kind': 'place', 'at': p['at'], 'prop': '^Added prop:ergoflex-phone#mph01$', 'hand': 'l', 'contact': p['contact'], 'hold': p['hold'],
                    'back': p['back'], 'lift': p['lift'], 'settle': p['settle'], 'bend': p['bend'], 'openFrom': 'people-mia-stretch', 'grip': params.get('grip', GRIP), 'grip2': params.get('grip2', GRIP2), 'regrip': [0.35, 0.85]}
    waits['postures']['people-mia-power-phone'].pop('poseKeys', None)      # (the old arm keys leaned her to the keyboard with the phone in her right hand)
    keys = works['postures']['people-mia-power-type-30']['poseKeys']
    final, first = keys[-1]['pose'], keys[0]['pose']
    bones = sorted(set(first) | set(final)); span = keys[-1]['t'] - keys[0]['t']
    works['postures']['people-mia-power-type-30']['poseKeys'] = [{'t': CHANGE_FROM, 'pose': {b: [0, 0, 0, 1] for b in bones}}, {'t': round(CHANGE_FROM + span, 3), 'pose': final}]
    works['change'] = {'seconds': CHANGE_LEN, 'arms': [0.15, 1]}
    works['handsBy'] = [0, 0, -round(params.get('dock_cm', DOCK_CM) * 10)]      # (her hands go to the keys where they now are: the desk docked nearer by this many mm)
    ppl['when']['mia-waits'] = [[0, round(CHANGE_FROM + CHANGE_LEN - 0.3, 3), 0, 0.5]]
    ppl['when']['mia-works'] = [[round(CHANGE_FROM + 0.3, 3), 99, 0.5, 0]]


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
    for row in SEATED:
        ppl['cast'].append(seated(row))
    for row in WALKERS:
        ppl['cast'].append(walker(row))
        if row[4] is not None:
            ppl.setdefault('when', {})[row[0]] = [[0, row[4], 0, 0.8]]


def chair_hides():
    """The model's own black swivel chair under each seated person is hidden (the film hides it for Sofia and Eli the same
    way): they sit on the table's oak chairs."""
    return [{'match': f"^Person chair:{row[1]}$", 'label': f"Person chair:{row[1]}", 'hide': True} for row in SEATED]


def dock(shot, cm):
    """The desk docks `cm` nearer her wheelchair: the last stretch of the wheels clip's path (and its target) gains the distance in
    proportion to how far along it is (so it still sets off and drives as before and only arrives further), in the clip's own
    inches. Nothing else of the desk's motion changes: it still comes to rest at 13.4 s."""
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
        p = dict(PLACE, **params.get('place', {})); params['cue'] = cue(shot, p['at'] + p['contact'] + p['settle'])
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
    shot0.update({'peopleEdits': people, 'propEdits': copy.deepcopy(props) + hides})
    exp = dict(base, id=f'film-{cutid}-commons', name='Film chapter: commons (polish 1124 draft)', shots=[shot0])
    json.dump(exp, open(os.path.join(out, 'Film-chapter-commons-polish1124.json'), 'w', encoding='utf8'), indent=1)
    if params.get('cue'):
        json.dump({'_doc': 'By hand, in the cut files: the sceneEdits entry of the chapter whose path is "Added prop:ergoflex-phone#mph01" and materialName "^hUlRcbieVuIiOXG$" (director-film/commons.json, review-cut.json and shots/*.json): replace material.emissiveIntensity with this. The Director import cannot carry it (prop edits have no material).',
                   'match': r'^Supplied_phone_part_\d+$', 'path': 'Added prop:ergoflex-phone#mph01', 'materialName': '^hUlRcbieVuIiOXG$', 'emissiveIntensity': params['cue']},
                  open(os.path.join(out, 'phone-cue-patch.json'), 'w', encoding='utf8'), indent=1)
    print('wrote', out, '| cast', len(new['people']['cast']), '| cut id', cutid)


if __name__ == '__main__':
    main(sys.argv[1:])
