#!/usr/bin/env python3
"""polish1124 maya (Nov 25 2026): Maya in Wellness (chapter 7): her hands no longer snap, and she types at the standing desk.

    python tools/experience/drafts/polish1124-maya/build.py <cut dir> [<out dir>] [--dry-run]

A) The snap. maya-break (her step away for the squats) carries Vico's pose keys: fingers curled a little and the right
hand turned 20.7 degrees, the last key at 11.267 s. A pose key HOLDS after the last key that names a bone, so the curl
stayed on through the squats and the step back to the desk. At 17.40 s the step ends and the model that is drawn changes
to maya-stand, which has no such keys: in ONE frame, her hands hanging by her sides, the right wrist turned 20.7 degrees
and the fingertips jumped 52 mm (left) and 48 mm (right). In the film req-20261125T071448 (Commons still 16 s, wellness
from 133.35 s) that is 150.75 s. A small twin at 10.10 s: the first key (10.31) also holds backwards (right fingers, 5.5 mm).
Fix (data only): on maya-break's keyed bones, 'as the motion has it' (identity) where the step out starts (10.1 s), Vico's
keys as they are, held to the end of the squats (16.0 s), then eased off during the step back, gone at 17.35 s.

B) The pauses. maya-stand types with the stock finger taps, whose 'reading' pauses left her still 5.4-7.5 s and 8.3-10.0 s
with her hands in view. Fix: typeStyle 'busy' on the cast entry 'maya-stand' (needs the engine change that came with this
draft: the moving desk's solver honours typeStyle, room-people-motion.mjs solveDesk / DeskActor). Without that engine
the field is simply ignored. Rise's maya-stand is not touched.

What she does, the squats' timing, the camera, the motion, the titles and the chapter's length stay as they are.

Writes <out>/polish1124-maya-wellness-DRAFT.json (default out: exports/drafts/polish1124-maya): a Director export (schema
ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch07-wellness-director.json, its camera and
motion as they are) carrying peopleEdits (the chapter's whole `people`, v2, as the cut has it NOW): Director > Import cut
on it, or build-round8-director.py <cut> --import <it>, then the pass (build-round8-director.py <cut>). It carries the
whole cast, so build it again from the cut just before importing. No EDL / score work.
Re-run safe: what is already in is left alone and said so; nothing to do writes nothing. --dry-run prints the changes and
writes nothing.
"""
import copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
DESK, DESK_MODEL, STYLE = 'maya-stand', 'people-maya-stand-type-41', 'busy'
BREAK, BREAK_MODEL = 'maya-break', 'people-maya-stand-type'
HALF = .7        # s: half the shortest step out / back (room-people.mjs changeLength: 1.4 s and up), centred on the window's ends
SHORT = .05      # s: the keys are gone this long before the step back can end (the frame the desk model takes over)
ID = [0, 0, 0, 1]


def one(people, key, model):
    mine = [e for e in people.get('cast', []) if e.get('key') == key]
    if len(mine) != 1 or mine[0].get('id') != model: sys.exit(f"wellness: expected one cast entry '{key}' ({model}): not patched")
    return mine[0]


def release_keys(e, spans):
    """maya-break's pose keys let go at both ends of the step -> change texts."""
    keys = ((e.get('postures') or {}).get(BREAK_MODEL) or {}).get('poseKeys')
    if not keys: return []
    if len(spans or []) != 1: sys.exit('wellness: expected one window for maya-break: not patched')
    act = e.get('act') or {}
    if e.get('fromDesk') is not True or act.get('kind') != 'squat': sys.exit('wellness: maya-break is no longer a squat step from the desk: not patched')
    t0, t1 = spans[0][0], spans[0][1]
    start, hold, end = round(t0 - HALF, 3), round(act['at'] + act['dur'], 3), round(t1 + HALF - SHORT, 3)
    bones = sorted({b for k in keys for b in k['pose']})
    # what each bone holds from its last key on, and whether it is already released at both ends
    last = {}
    for k in sorted(keys, key=lambda k: k['t']):
        for b, q in k['pose'].items(): last[b] = (k['t'], q, k)
    first = {}
    for k in sorted(keys, key=lambda k: k['t'], reverse=True):
        for b, q in k['pose'].items(): first[b] = (k['t'], q)
    is_id = lambda q: sum(abs(c) for c in q[:3]) < 1e-3
    if all(is_id(q) for _, q, _ in last.values()) and all(is_id(q) for _, q in first.values()): return []
    if any(t > hold + 1e-6 for t, _, _ in last.values()) or any(t < start - 1e-6 for t, _ in first.values()):
        sys.exit(f'wellness: maya-break has pose keys outside {start}-{hold} s (new Director keys?): look before patching; not patched')
    if any(k.get('ease') for _, _, k in last.values()): sys.exit('wellness: a maya-break key has its own ease: look before patching; not patched')

    def put(t, pose):
        at = next((k for k in keys if abs(k['t'] - t) < 1 / 60 - 1e-9), None)
        if at: at['pose'].update(pose)
        else: keys.append({'t': t, 'pose': pose})
    held = {b: list(last[b][1]) for b in bones if last[b][0] < hold - 1 / 60}
    put(start, {b: list(ID) for b in bones if first[b][0] > start + 1 / 60})
    if held: put(hold, held)
    put(end, {b: list(ID) for b in bones})
    keys.sort(key=lambda k: k['t'])
    worst = max(2 * __import__('math').degrees(__import__('math').acos(min(1, abs(q[3])))) for _, q, _ in last.values())
    return [f"{BREAK}: {len(bones)} keyed bones: as the motion has them at {start} s, Vico's keys held to {hold} s, eased off by {end} s (they used to hold to the end of the chapter, up to {worst:.1f} deg, and snap off when the desk model took over)"]


def fix_people(people):
    """-> (new people, [change text]). Stops if the chapter no longer has Maya as this fix expects her."""
    people = copy.deepcopy(people); changes = []
    desk = one(people, DESK, DESK_MODEL)
    if desk.get('typeStyle') != STYLE:
        changes.append(f"{DESK}: typeStyle {desk.get('typeStyle') or '(stock taps)'} -> {STYLE}"); desk['typeStyle'] = STYLE
    changes += release_keys(one(people, BREAK, BREAK_MODEL), (people.get('when') or {}).get(BREAK))
    return people, changes


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1124-maya'); dry = '--dry-run' in argv
    load = lambda *p: json.load(open(os.path.join(cut, *p), encoding='utf-8'))
    shot = load('director-film', 'wellness.json')
    people, changes = fix_people(shot['people'])
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print('wellness: nothing to do (Maya already types busy and her break keys let go)'); return
    if dry: print('dry run: nothing written'); return
    base = load('director-import', 'ErgoFlex-film-ch07-wellness-director.json')
    s0 = copy.deepcopy(base['shots'][0])
    if abs(float(s0['seconds']) - float(shot['seconds'])) > 1e-6:
        sys.exit(f"director-import/ch07 is {s0['seconds']} s, director-film/wellness.json {shot['seconds']} s: run the pages step first")
    s0['peopleEdits'] = dict(people, v=2)
    cutid = load('cut.json')['id']
    exp = dict(base, id=f'film-{cutid}-wellness', name='DRAFT polish1124-maya: Wellness Maya, no hand snap, types at the standing desk', shots=[s0])
    os.makedirs(out, exist_ok=True); p = os.path.join(out, 'polish1124-maya-wellness-DRAFT.json')
    json.dump(exp, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
