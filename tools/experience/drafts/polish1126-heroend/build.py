#!/usr/bin/env python3
"""polish1126 hero (Nov 26 2026): ALL of chapter 12's changes as one importable Director export.

    python tools/experience/drafts/polish1126-heroend/build.py <cut dir> [<out dir>] [--dry-run]

Carries the desk props patch (../polish1126-heroprops/apply-heroprops.py) and the office / ending patch
(apply-heroend.py, which says what each change is). Writes <out>/polish1126-heroend-hero.json (default out:
exports/drafts/polish1126-heroend): the cut's own director-import/ErgoFlex-film-ch12-hero-director.json (camera and
desk moves as they are) as an ergoflex.client-cut export with
    propEdits      the chapter's whole Director prop list (review-cut.json), patched
    subshotMotion  sub-shot D alone: c-tilt 7.6 s + 1.2 s (the office desk is level before it is seen)
    finishFades    sub-shot H: the cross-fade to Pearl White / White frame / White trim
    endCard        logo.show_delay 1.0 s, cta.rel_in 22.23 s
Import it with THIS BRANCH's build-round8-director.py (subshotMotion, finishFades and logo.show_delay are new):
    python tools/experience/build-round8-director.py <cut dir> --import <it>     then the pass: ... <cut dir>
The film also needs this branch's render-cut.cjs + finish-fade.cjs and finish-intro.py. Length, camera, EDL and score do
not change (the score's logo hit stays on logo.rel_in). The cut itself is only read. Running it on a cut that already has
the changes writes the same export again. --dry-run lists the changes and writes nothing.
"""
import copy, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def J(*p):
    with open(os.path.join(*p), encoding='utf-8-sig') as f:
        return json.load(f)


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    cut = args[0]; out = args[1] if len(args) > 1 else os.path.join(ROOT, 'exports', 'drafts', 'polish1126-heroend'); dry = '--dry-run' in argv
    props_patch = module('heroprops', os.path.join(HERE, '..', 'polish1126-heroprops', 'apply-heroprops.py'))
    end_patch = module('heroend', os.path.join(HERE, 'apply-heroend.py'))
    film = next(s for s in J(cut, 'review-cut.json')['shots'] if s['id'] == 'hero')
    shown = J(cut, 'director-film', 'hero.json'); shown = shown['shots'][0] if 'shots' in shown else shown
    if abs(float(film['seconds']) - 25.95) > 1e-6 or abs(float(shown.get('seconds', film['seconds'])) - 25.95) > 1e-6:
        sys.exit('the hero is not 25.95 s in this cut: nothing done')
    subshots = copy.deepcopy(J(cut, 'shots', '13-subshots.json'))
    titles = copy.deepcopy(J(cut, 'titles-src.json'))

    # 1. the whole Director prop list, with the desk props patch
    edits = [copy.deepcopy(e) for e in film['sceneEdits'] if e.get('director')]
    log = []
    props_patch.walk(edits, 'propEdits', log)

    # 2. office items on from the first frame, gaming items gone earlier: the same entries apply-heroend.py changes in D / H
    p = end_patch.Patch()
    for e in edits:
        w = e.get('show'); name = e.get('label') or e.get('match')
        if not w: continue
        if e.get('desk') == 'office':
            if w.get('from') != 0: p.set(f'{name} show.from', w, 'from', 0.3, 0)
            if 'fadeIn' in w: p.set(f'{name} show.fadeIn', w, 'fadeIn', 0.25, None)
        elif e.get('desk') == 'gaming':
            p.set(f'{name} show.to', w, 'to', *end_patch.GAMING_TO)

    # 3. D's own desk move, H's finish fade, the end card (apply-heroend.py is the one place the values live)
    end_patch.patch_subshots(p, subshots)
    end_patch.patch_titles(p, titles)
    h = next(s for s in subshots['shots'] if s.get('subshot') == 'H')
    for line in log + p.changes:
        print(('would change: ' if dry else 'change: ') + line[:260])
    if not log and not p.changes: print('the cut already has every change')
    if dry: print('dry run: nothing written'); return

    base = J(cut, 'director-import', 'ErgoFlex-film-ch12-hero-director.json')
    shot = copy.deepcopy(base['shots'][0])
    if shot.get('id') != 'hero': sys.exit('director-import hero export: not the hero')
    shot['propEdits'] = edits
    shot['subshotMotion'] = {'D': {'c-tilt': dict(end_patch.C_TILT[1])}}
    shot['finishFades'] = {'H': copy.deepcopy(h['finishFade'])}
    shot['endCard'] = {'logo': {'show_delay': end_patch.LOGO_DELAY}, 'cta': {'rel_in': end_patch.CTA_REL_IN[1]}}
    cutid = J(cut, 'cut.json')['id']
    exp = dict(base, id=f'film-{cutid}-hero', name='DRAFT polish1126 hero: desk props, level office desk, pearl white ending', shots=[shot])
    os.makedirs(out, exist_ok=True); path = os.path.join(out, 'polish1126-heroend-hero.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(exp, f, indent=1, ensure_ascii=False)
    print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1:])
