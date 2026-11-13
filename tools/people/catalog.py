#!/usr/bin/env python3
"""Write assets/props/people.json: who the people are and what they can do, for the Director's People tab.

    python3 tools/people/catalog.py        (build.py runs it after every build)

  characters: { id: { name, role?, sex, age, years, heritage, height (cm), outfit: [garments], colors: { top, bottom, shoes, hair } } }
              (age 'child' = one of cast.CHILDREN, who have the child postures; the middle-school students are 'teen')
  poses:      { id: { label, stance, desk: bool, seat (mm), heights: [inches] } }
  models:     { '<library id>': { character, pose, deskHeight?, aids: [...] } }       what is built (assets/props/index.json)
Any character can be built in any pose on request: python3 tools/people/build.py people-<character>-<pose>.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..')); sys.path.insert(0, HERE)
import cast  # noqa: E402


def years(a):      # MakeHuman's age setting: 0 = 1 year, .1875 = 10, .5 = 25, 1 = 90
    return 1 + a / .1875 * 9 if a < .1875 else 10 + (a - .1875) / .3125 * 15 if a < .5 else 25 + (a - .5) / .5 * 65


def age_group(y): return 'child' if y < 13 else 'teen' if y < 20 else 'young adult' if y < 40 else 'adult' if y < 62 else 'senior'


def heritage(race):
    top = max(race, key=race.get)
    return {'caucasian': 'European', 'african': 'African', 'asian': 'Asian'}[top] if race[top] >= .7 else 'Mixed'


def role(garment):
    g = garment.lower()
    return ('glasses' if 'glasses' in g else 'shoes' if 'shoe' in g or 'flats' in g or 'boot' in g else
            'bottom' if 'pants' in g or 'skirt' in g or 'jeans' in g or 'shorts' in g else 'top')


def hexc(c): return '#%02x%02x%02x' % tuple(round(max(0, min(1, v)) ** (1 / 2.2) * 255) for v in c)


index = json.load(open(os.path.join(ROOT, 'assets/props/index.json'), encoding='utf-8'))['props']
built = {p['id']: p for p in index if p.get('category') == 'people' and p.get('person')}
characters = {}
for cid, c in cast.CHARACTERS.items():
    ph = c['phenotype']; y = years(ph['age'])
    tall = max((p['size'][1] for p in built.values() if p['person']['character'] == cid and cast.POSE_INFO.get(p['person']['pose'], ('', ''))[1] in ('standing', 'walking') and not p['person']['pose'].startswith('stretch')), default=None)
    # (an outfit in parts, cast 'parts': its bottom half is '<outfit>:bottom', or the outfit itself when only that half is worn)
    part = lambda g: 'bottom' if g.endswith(':bottom') or c.get('parts', {}).get(g) == 'bottom' else role(g)
    colors = {part(g): hexc(v) for g, v in {**(c.get('tint') or {}), **(c.get('dye') or {})}.items()}
    # garments made from the base mesh (garments.py): a scrubs top or a gown is the top, socks are the shoes; the white coat keeps its colour
    for kind, kw in c.get('wear', []):
        if kind in ('scrubs', 'gown', 'socks') and 'color' in kw: colors['shoes' if kind == 'socks' else 'top'] = hexc(kw['color'])
        if kind == 'headscarf': colors['hair'] = hexc(kw.get('color', (.8, .76, .68)))       # (the Studio recolours a headscarf as the hair)
    if c.get('hair_tint'): colors['hair'] = hexc(c['hair_tint'])
    characters[cid] = {'name': c['name'], **({'role': c['role']} if c.get('role') else {}), 'sex': ('girl' if ph['gender'] < .5 else 'boy') if y < 14 else 'woman' if ph['gender'] < .5 else 'man',
                       'age': 'child' if cid in cast.CHILDREN else age_group(max(y, 13)), 'years': round(y), 'heritage': heritage(ph['race']),
                       'height': round(tall / 10) if tall else round((1.287 * ph['height'] + (.87 if ph['gender'] < .5 else 1.16)) * 100),
                       'outfit': [kind for kind, _kw in c.get('wear', [])] + c.get('clothes', []), 'colors': colors}
poses = {pid: {'label': label, 'stance': stance, 'desk': where == 'desk', 'seat': seat, **({'heights': list(cast.DESK_HEIGHTS[pid])} if pid in cast.DESK_HEIGHTS else {})}
         for pid, (label, stance, where, seat, _held) in cast.POSE_INFO.items()}
models = {}
for mid, p in built.items():
    try: o = cast.output(mid)
    except KeyError: o = {}
    aids = sorted({('white cane' if h[1].get('white') else 'walking stick') if h[0] == 'cane' else h[0] for h in o.get('held', []) if h[0] in ('wheelchair', 'cane', 'prosthesis')})
    models[mid] = {**p['person'], 'name': p['name'], 'aids': aids}
out = os.path.join(ROOT, 'assets/props/people.json')
json.dump({'v': 1, 'characters': characters, 'poses': poses, 'models': models}, open(out, 'w', encoding='utf-8', newline='\n'), indent=1); open(out, 'a', encoding='utf-8', newline='\n').write('\n')
print('people catalog: %d characters, %d poses, %d models built' % (len(characters), len(poses), len(models)))
