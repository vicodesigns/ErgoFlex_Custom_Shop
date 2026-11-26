#!/usr/bin/env python3
"""polish1126 miaphone (Nov 26 2026): the Commons changes as an importable Director export.

    python tools/experience/drafts/polish1126-miaphone/build.py <cut dir> [<out dir>] [--dry-run]

The values come from draft.cjs (same folder), run on a temporary copy of the chapter: the phone turned 180 degrees
(on the charger and in both grips), mia-waits .glances (two look-ups) and the softer last stretch of the desk's drive.
The cut is only read (the chapter is taken from review-cut.json, what the film renders).

Writes <out>/polish1126-miaphone-commons.json (default out: exports/drafts/polish1126-miaphone): a Director export
(schema ergoflex.client-cut, one shot: the cut's own director-import/ErgoFlex-film-ch04-commons-director.json, its camera
as it is) carrying
  peopleEdits  the chapter's whole `people`, v2 (glances and the turned grips in it)
  motion       the film's clips, only the wheels clip's duration and path changed
  propEdits    every Director prop edit the chapter has now, as it is, plus one offset that turns Mia's phone on the
               charger by 180 degrees (the hand-made mph01 entry is not touched: Director entries are offsets)
Then: build-round8-director.py <cut> --import <it>, the pass, --pages commons. Idempotent: on a cut that already has
the changes it writes nothing. --dry-run prints the changes and writes nothing.
"""
import copy, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
PHONE = '^Added prop:ergoflex-phone#mph01$'
CLIP_FIELDS = ('id', 'lane', 'kind', 'start', 'duration', 'easing', 'label', 'target', 'value', 'direction', 'path')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def turns_phone(e):
    return (e.get('director') and e.get('match') == PHONE and e.get('add') is None
            and e.get('rotation') == [0, 180, 0])


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    cut = args[0]
    out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1126-miaphone')
    dry = '--dry-run' in argv
    shot = next(s for s in load(os.path.join(cut, 'review-cut.json'))['shots'] if s['id'] == 'commons')
    director = [e for e in shot.get('sceneEdits') or [] if e.get('director')]
    stored_path = os.path.join(cut, 'director-camera-commons.json')
    stored = load(stored_path).get('props') if os.path.exists(stored_path) else None
    turned = any(turns_phone(e) for e in director)

    # draft.cjs sees the phone as it renders: a Director offset from an earlier import counts as turned
    work = copy.deepcopy(shot)
    hand = next((e for e in work['sceneEdits'] if e.get('id') == 'mph01'), None)
    if hand is None:
        sys.exit('commons: the phone edit mph01 is not in the chapter: nothing done')
    if turned:
        if hand.get('rotation') != [0, 0, 0]:
            sys.exit('commons: mph01 and a Director offset both turn the phone: nothing done')
        hand['rotation'] = [0, 180, 0]
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = os.path.join(tmp, 'in.json'), os.path.join(tmp, 'out.json')
        with open(src, 'w', encoding='utf-8') as f:
            json.dump({'shots': [work]}, f)
        run = subprocess.run(['node', os.path.join(HERE, 'draft.cjs'), src, '--apply', '--out', dst],
                             capture_output=True, text=True, encoding='utf-8')
        print(run.stdout.rstrip())
        if run.returncode:
            sys.exit('draft.cjs failed, nothing done:\n' + run.stderr)
        new = load(dst)['shots'][0]

    if new == work:
        print('commons: nothing to do (the cut already has these changes)')
        return
    props = copy.deepcopy(stored if stored is not None else director)
    if not turned:
        if new['sceneEdits'] == work['sceneEdits']:
            print('note: the hand-made mph01 entry already turns the phone: no Director offset added')
        else:
            props.append({'match': PHONE, 'label': "Mia's phone on the charger, the right way up",
                          'rotation': [0, 180, 0], 'director': True})
    base = load(os.path.join(cut, 'director-import', 'ErgoFlex-film-ch04-commons-director.json'))
    s0 = copy.deepcopy(base['shots'][0])
    s0['peopleEdits'] = dict(new['people'], v=2)
    s0['motion'] = dict(s0.get('motion') or {}, version=new['motion'].get('version', 2),
                        clips=[{k: copy.deepcopy(v) for k, v in c.items() if k in CLIP_FIELDS}
                               for c in new['motion']['clips']])
    s0['propEdits'] = props
    print(f'export: {len(props)} Director prop edits ({len(director)} in the chapter now)')
    if dry:
        print('dry run: nothing written')
        return
    cutid = load(os.path.join(cut, 'cut.json'))['id']
    exp = dict(base, id=f'film-{cutid}-commons',
               name="DRAFT polish1126-miaphone: Mia's phone, two look-ups, softer desk stop", shots=[s0])
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, 'polish1126-miaphone-commons.json')
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(exp, f, indent=1, ensure_ascii=False)
    print('wrote', p)


if __name__ == '__main__':
    main(sys.argv[1:])
