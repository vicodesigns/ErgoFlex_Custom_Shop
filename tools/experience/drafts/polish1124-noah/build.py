#!/usr/bin/env python3
"""polish1124 noah (Nov 25 2026): the high school chapter, Noah's right wrist between the screen pull and the tap.

    python tools/experience/drafts/polish1124-noah/build.py <cut dir> [<out dir>] [--dry-run]

Root cause. The change from `noah-pulls` to `noah-taps` (7.2 s, 6.49-7.91 s) blends the hand's turn on the forearm as one
quaternion. The two built postures hold all their forearm rotation in the hand bone (the pose builder aims the hand and
never rolls the forearm): +71 degrees at the end of the pull (palm up), -102 at the tap. The shortest quaternion path
between them rolled the hand +187 degrees, further palm up and round the back (+71, +120 at 7.2 s, +174 at 7.4 s, -158
at 7.5 s, -102): the knot. A hand goes 173 degrees the other way, back through thumb up (to its owner's left).

Fix (needs room-people-motion.mjs turnWrist, the same commit). One field on `noah-taps`:
    change: { wrist: { r: { turn: 'pronate', over: [0.06, 0.96], relax: 0.6, arc: { lift: 0.06, k: 1, p: 0.4 } } } }
The hand's roll and bend are blended apart: the roll the named way, starting as the pull ends, the wrist eased toward
straight on the way, and the arm moving the wrist so the index fingertip goes on one arc from the screen's edge to over
the button (a straighter wrist alone swept it 14 cm past the button). Both postures, the timing, the swap, the tap, the
screen and the camera are as they were; only his right arm between 6.58 and 7.86 s differs.

Writes <out>/polish1124-noah-oilers.json (default out: exports/drafts/polish1124-noah): a Director export (schema
ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch06-oilers-director.json, its camera and
motion as they are) carrying peopleEdits (the chapter's whole `people`, v2): Director > Import cut on it, or
build-round8-director.py <cut> --import <it>, then the pass. The chapter's length, camera, motion and titles do not
change: no EDL / score work. The cut itself is only read.
--dry-run prints the change and writes nothing.
"""
import copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
WRIST = {'r': {'turn': 'pronate', 'over': [0.06, 0.96], 'relax': 0.6, 'arc': {'lift': 0.06, 'k': 1, 'p': 0.4}}}


def fix_people(people):
    """-> (new people, [change text])"""
    people = copy.deepcopy(people); changes = []
    cast = {e.get('key'): e for e in people.get('cast', [])}
    pull, tap = cast.get('noah-pulls'), cast.get('noah-taps')
    if not pull or not tap or not pull.get('id', '').endswith('-screen-pull') or not tap.get('id', '').endswith('-screen-tap'):
        sys.exit('oilers: noah-pulls (screen-pull) and noah-taps (screen-tap) are not both cast as expected: nothing done')
    if (tap.get('change') or {}).get('wrist') != WRIST:
        tap['change'] = dict(tap.get('change') or {}, wrist=copy.deepcopy(WRIST))
        changes.append(f"noah-taps change.wrist = {json.dumps(WRIST)}")
    return people, changes


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1124-noah'); dry = '--dry-run' in argv
    shot = json.load(open(os.path.join(cut, 'director-film', 'oilers.json'), encoding='utf-8'))
    people, changes = fix_people(shot['people'])
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print('oilers: nothing to do (the wrist is already turned this way)'); return
    if dry: print('dry run: nothing written'); return
    base = json.load(open(os.path.join(cut, 'director-import', 'ErgoFlex-film-ch06-oilers-director.json'), encoding='utf-8'))
    s0 = copy.deepcopy(base['shots'][0]); s0['peopleEdits'] = dict(people, v=2)
    cutid = json.load(open(os.path.join(cut, 'cut.json'), encoding='utf-8'))['id']
    exp = dict(base, id=f'film-{cutid}-oilers', name="DRAFT polish1124-noah: Noah's wrist turns left from the screen into the tap", shots=[s0])
    os.makedirs(out, exist_ok=True); p = os.path.join(out, 'polish1124-noah-oilers.json')
    json.dump(exp, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
