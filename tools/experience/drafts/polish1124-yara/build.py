#!/usr/bin/env python3
"""polish1124 yara (Nov 25 2026): Yara (Commons, chapter 4) types while the camera is on her.

    python tools/experience/drafts/polish1124-yara/build.py <cut dir> [<out dir>] [--dry-run]

Root cause (the data has nothing switching her off: no pose keys, no typeStyle). The stock finger taps
(room-people-motion.mjs tapKeys) come in phrases with a 'reading' pause, timed from the cast key's seed. For 'yara-works'
(seed 2517416609, a 5.93 s cycle) she taps 0-1.7 s, under the overhead shot, then rests from ~1.7 s to ~4.7 s with her
fingers and wrists dead still: the whole of her close shot (2.45 s on) up to the moment her hands leave the keys to go
(~4.55 s). Same fault as Mia's (Commons5b).

Fix (data only, one field): typeStyle 'busy' on the cast entry 'yara-works' (the natural typist's keys in back-to-back
phrases, 1.45-1.9 s of keys and 0.3-0.95 s of rest; room-people-motion.mjs, already in the engine for Mia). Nothing else:
where she stands, her window, the walk away, the camera and the chapter's length stay as they are.

Writes <out>/polish1124-yara-commons-DRAFT.json (default out: exports/drafts/polish1124-yara): a Director export (schema
ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch04-commons-director.json, its camera and
motion as they are) carrying peopleEdits (the chapter's whole `people`, v2, as the cut has it NOW): Director > Import cut
on it, or build-round8-director.py <cut> --import <it>, then the pass (build-round8-director.py <cut>). It carries the
whole cast, so build it again from the cut just before importing. No EDL / score work.
Re-run safe: when Yara is already 'busy' it says so and writes nothing. --dry-run prints the change and writes nothing.
"""
import copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
WHO, MODEL, STYLE = 'yara-works', 'people-yara-stand-mid', 'busy'


def fix_people(people):
    """-> (new people, [change text]). Stops if the chapter no longer has Yara at the desk as this fix expects her."""
    people = copy.deepcopy(people)
    mine = [e for e in people.get('cast', []) if e.get('key') == WHO]
    if len(mine) != 1 or mine[0].get('id') != MODEL: sys.exit(f"commons: expected one cast entry '{WHO}' ({MODEL}): not patched")
    e = mine[0]
    if e.get('typeStyle') == STYLE: return people, []
    was = e.get('typeStyle'); e['typeStyle'] = STYLE
    return people, [f"{WHO}: typeStyle {was or '(stock taps)'} -> {STYLE}"]


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1124-yara'); dry = '--dry-run' in argv
    load = lambda *p: json.load(open(os.path.join(cut, *p), encoding='utf-8'))
    shot = load('director-film', 'commons.json')
    people, changes = fix_people(shot['people'])
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print(f'commons: nothing to do ({WHO} already types {STYLE})'); return
    if dry: print('dry run: nothing written'); return
    base = load('director-import', 'ErgoFlex-film-ch04-commons-director.json')
    s0 = copy.deepcopy(base['shots'][0])
    if abs(float(s0['seconds']) - float(shot['seconds'])) > 1e-6:
        sys.exit(f"director-import/ch04 is {s0['seconds']} s, director-film/commons.json {shot['seconds']} s: run the pages step first")
    s0['peopleEdits'] = dict(people, v=2)
    cutid = load('cut.json')['id']
    exp = dict(base, id=f'film-{cutid}-commons', name='DRAFT polish1124-yara: Yara types in her close shot (typeStyle busy)', shots=[s0])
    os.makedirs(out, exist_ok=True); p = os.path.join(out, 'polish1124-yara-commons-DRAFT.json')
    json.dump(exp, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
