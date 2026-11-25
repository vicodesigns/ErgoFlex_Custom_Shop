#!/usr/bin/env python3
"""polish1124 coast (Nov 25 2026): Ava (the featured desk, chapter 5) types again once she stands up.

    python tools/experience/drafts/polish1124-coast/build.py <cut dir> [<out dir>] [--dry-run]

Root cause. The 'Coast hands' edit of Vico's 3rd cut (aaf6bb54) put pose keys on Ava's standing models that curl every
finger 4-10 degrees: people-ava-stand-low at 6.333 s (cast ava-sits) and people-ava-stand-mid at 6.367 s and 6.4 s (cast
ava-stands). A pose key holds after the last key that names a bone, so the fingers stay keyed to the end of the chapter,
and room-people-motion.mjs poseTapWeight takes any finger keyed past 0.08 rad (4.6 degrees) as a hand the Director has
posed (a gesture, a stretch) and switches its typing taps off: no typing from ~5.8 s to 14.5 s, the whole standing part.
(Her seated keys, 15 equal keys at 0-3.6 s on both sit-type models, are a constant turn of the arms on top of the motion:
the taps run under them, tap weight 0.95 / 1.0; they are left as they are.)

Fix (data only, the chapter's people): the finger channels (thumb/index/middle/ring/pinky) are taken out of the pose keys of
Ava's typing models that would switch the taps off; her arm, hand and spine keys (Vico's) are kept as they are. A key left
with no bone is dropped. Every other cast entry is untouched.

Writes <out>/Film-chapter-coast-polish1124-coast.json (default out: exports/drafts/polish1124-coast): a Director export
(schema ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch05-coast-director.json, its camera
and motion as they are) carrying peopleEdits (the chapter's whole `people`, v2): Director > Import cut on it, or
build-round8-director.py <cut> --import <it>, then the pass (build-round8-director.py <cut>). The chapter's length,
camera, motion and titles do not change: no EDL / score work.
--dry-run prints the changes and writes nothing.
"""
import copy, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')
TYPES = {'sit-type', 'stand-type', 'stand-mid', 'stand-low', 'stand-type-low', 'wheel-type', 'power-type', 'sit-laptop', 'sit-coffee', 'stand-coffee'}
WHO = ('ava-sits', 'ava-stands')
OFF = 0.015          # rad: poseTapWeight starts taking the taps off at a finger keyed this far


def angle(q): return 2 * math.acos(min(1.0, abs(q[3])))
def finger(bone): return bone.split('_')[0] in FINGERS
def posture(model):
    parts = model.split('-')[2:]
    if parts and parts[-1].isdigit(): parts = parts[:-1]
    return '-'.join(parts)


def fix_people(people):
    """-> (new people, [change text])"""
    people = copy.deepcopy(people); changes = []
    for e in people.get('cast', []):
        if e.get('key') not in WHO: continue
        for model, rec in (e.get('postures') or {}).items():
            keys = rec.get('poseKeys') or []
            if posture(model) not in TYPES or not any(finger(b) and angle(q) > OFF for k in keys for b, q in k['pose'].items()): continue
            out = []
            for k in keys:
                gone = sorted(b for b in k['pose'] if finger(b))
                pose = {b: q for b, q in k['pose'].items() if not finger(b)}
                if gone: changes.append(f"{e['key']} {model} key {k['t']} s: {len(gone)} finger channels removed (max {max(math.degrees(angle(k['pose'][b])) for b in gone):.1f} deg)" + ('' if pose else ', key dropped (nothing left)'))
                if pose: out.append(dict(k, pose=pose))
            rec['poseKeys'] = out
    return people, changes


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1124-coast'); dry = '--dry-run' in argv
    shot = json.load(open(os.path.join(cut, 'director-film', 'coast.json'), encoding='utf-8'))
    people, changes = fix_people(shot['people'])
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print('coast: nothing to do (no finger keys switch Ava\'s typing off)'); return
    if dry: print('dry run: nothing written'); return
    base = json.load(open(os.path.join(cut, 'director-import', 'ErgoFlex-film-ch05-coast-director.json'), encoding='utf-8'))
    s0 = copy.deepcopy(base['shots'][0]); s0['peopleEdits'] = dict(people, v=2)
    cutid = json.load(open(os.path.join(cut, 'cut.json'), encoding='utf-8'))['id']
    exp = dict(base, id=f'film-{cutid}-coast', name='DRAFT polish1124-coast: Ava types standing (finger keys no longer switch her taps off)', shots=[s0])
    os.makedirs(out, exist_ok=True); p = os.path.join(out, 'Film-chapter-coast-polish1124-coast.json')
    json.dump(exp, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
