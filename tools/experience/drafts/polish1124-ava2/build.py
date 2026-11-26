#!/usr/bin/env python3
"""polish1124 ava2 (Nov 25 2026): Ava (Coast, chapter 5) keeps typing once she stands at the moving desk.

    python tools/experience/drafts/polish1124-ava2/build.py <cut dir> [<out dir>] [--dry-run]

Needs the engine commit "typeStyle 'busy' / 'natural' also works at the moving desk" (30462e43, from
director/polish-1125-maya). Without it the field is ignored and nothing changes on screen.

Root cause: the stock finger taps (room-people-motion.mjs tapKeys) come in phrases with 'reading' pauses of 2-3 s. On
'ava-stands' (people-ava-stand-mid, drawn from about 6.4 s) two of them fall while the camera is on her hands, about
7.6-9.7 s and 12.8-14.4 s.

Fix (data only, one field): typeStyle 'busy' on the cast entry 'ava-stands'. Not on 'ava-sits': the other models it
draws on the way up (sit-type-30, stand-low) have her hands off the keys, so the field would change nothing there; it
would only change her seated typing (0-3.7 s).

Writes <out>/polish1124-ava2-coast-DRAFT.json (default out: exports/drafts/polish1124-ava2): a Director export (schema
ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch05-coast-director.json, its camera and
motion as they are) carrying peopleEdits (the chapter's whole `people`, v2, as the cut has it NOW): Director > Import cut
on it, or build-round8-director.py <cut> --import <it>, then the pass (build-round8-director.py <cut>). It carries the
whole cast, so build it again from the cut just before importing. No EDL / score work.
Re-run safe: when Ava is already 'busy' it says so and writes nothing. --dry-run prints the change and writes nothing.
"""
import copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
WHO, MODEL, STYLE = 'ava-stands', 'people-ava-stand-mid', 'busy'


def fix_people(people):
    """-> (new people, [change text]). Stops if the chapter no longer has Ava at the desk as this fix expects her."""
    people = copy.deepcopy(people)
    mine = [e for e in people.get('cast', []) if e.get('key') == WHO]
    if len(mine) != 1 or mine[0].get('id') != MODEL: sys.exit(f"coast: expected one cast entry '{WHO}' ({MODEL}): not patched")
    e = mine[0]
    if e.get('typeStyle') == STYLE: return people, []
    was = e.get('typeStyle'); e['typeStyle'] = STYLE
    return people, [f"{WHO}: typeStyle {was or '(stock taps)'} -> {STYLE}"]


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1124-ava2'); dry = '--dry-run' in argv
    load = lambda *p: json.load(open(os.path.join(cut, *p), encoding='utf-8'))
    shot = load('director-film', 'coast.json')
    people, changes = fix_people(shot['people'])
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print(f'coast: nothing to do ({WHO} already types {STYLE})'); return
    if dry: print('dry run: nothing written'); return
    base = load('director-import', 'ErgoFlex-film-ch05-coast-director.json')
    s0 = copy.deepcopy(base['shots'][0])
    if abs(float(s0['seconds']) - float(shot['seconds'])) > 1e-6:
        sys.exit(f"director-import/ch05 is {s0['seconds']} s, director-film/coast.json {shot['seconds']} s: run the pages step first")
    s0['peopleEdits'] = dict(people, v=2)
    cutid = load('cut.json')['id']
    exp = dict(base, id=f'film-{cutid}-coast', name='DRAFT polish1124-ava2: Ava keeps typing standing (typeStyle busy)', shots=[s0])
    os.makedirs(out, exist_ok=True); p = os.path.join(out, 'polish1124-ava2-coast-DRAFT.json')
    json.dump(exp, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
