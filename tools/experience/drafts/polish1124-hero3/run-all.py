#!/usr/bin/env python3
"""polish1124 hero3: everything after the Director import, in one command.

    python3 tools/experience/drafts/polish1124-hero3/run-all.py exports/cinematic-intro-cut-vicos-3rd-cut [--dry-run] [--import]

  1. (only with --import) the DRAFT into the film without the Director: build-round8-director.py <cut> --import
     ErgoFlex-film-ch12-hero-director-DRAFT-25.95s.json, then the pass (build-round8-director.py <cut>) and the hero's
     Director page (--pages hero --downloads <cut>/director-import): the same three steps the director-import watcher
     runs for an export. Without --import, the hero must already be 25.95 s (Vico imported and exported it in the
     Director). Do not run --import while the watcher is importing (it takes the cut lock; this does not).
  2. apply.py: titles-src.json CTA timing and size, score-pins.json.
  3. build-cine-score.py <cut>: edl.json (240.778 s) and score/score.wav, then its --check.
--dry-run: prints the steps and apply.py's changes, writes nothing (with --import: the import is not tried, so the
apply.py preview is skipped while the hero is not yet 25.95 s).
"""
import importlib.util, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))   # the repo (tools/experience/drafts/<this>)
DRAFT = os.path.join(HERE, 'ErgoFlex-film-ch12-hero-director-DRAFT-25.95s.json')
B8 = os.path.join(ROOT, 'tools', 'experience', 'build-round8-director.py')
SCORE = os.path.join(ROOT, 'tools', 'experience', 'build-cine-score.py')


def step(cmd, dry):
    print('$ ' + ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) and c.startswith(ROOT) else c for c in cmd), flush=True)
    if not dry: subprocess.run(cmd, check=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    cut, dry, imp = args[0], '--dry-run' in sys.argv, '--import' in sys.argv
    spec = importlib.util.spec_from_file_location('hero3_apply', os.path.join(HERE, 'apply.py')); ap = importlib.util.module_from_spec(spec); spec.loader.exec_module(ap)
    hero = next(s for s in json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))['shots'] if s['id'] == 'hero')
    ready = abs(float(hero['seconds']) - ap.HERO_SECONDS) < 1e-6
    py = sys.executable
    if imp:
        step([py, B8, cut, '--import', DRAFT], dry)
        step([py, B8, cut], dry)
        step([py, B8, cut, '--pages', 'hero', '--downloads', os.path.join(cut, 'director-import')], dry)
    elif not ready:
        sys.exit(f"the hero is {hero['seconds']} s: import the DRAFT in the Director first (or add --import)")
    if dry and not ready:
        print(f"(apply.py preview skipped: the hero is {hero['seconds']} s until the import has run)")
    else:
        print('$ apply.py ' + cut); ap.apply(cut, dry)
    step([py, SCORE, cut], dry)
    step([py, SCORE, cut, '--check'], dry)
    print('dry run: nothing written' if dry else 'done')


if __name__ == '__main__':
    main()
