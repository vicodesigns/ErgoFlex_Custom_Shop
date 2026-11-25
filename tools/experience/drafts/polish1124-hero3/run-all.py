#!/usr/bin/env python3
"""polish1124 hero3/hero4: the hero ending after the Director import, in one command, for any cut.

    python3 tools/experience/drafts/polish1124-hero3/run-all.py <cut> [--dry-run] [--import]

  1. (only with --import) the DRAFT into the film without the Director: build-round8-director.py <cut> --import
     ErgoFlex-film-ch12-hero-director-DRAFT-25.95s.json (hero 25.95 s, camera; no desk versions), the pass and the
     hero's Director page (--pages hero --downloads <cut>/director-import): the steps the director-import watcher runs for
     an export. Without --import the hero must already be 25.95 s.
  2. apply.py: titles-src.json CTA (timing from this cut's score), and the storage -> hero pin file removed if present.
     An end card edited in the Director (titles-src 'edited': true on the CTA or the wordmark) is left as he set it.
  3. looks.py: the desk-version fades on this cut's score bar lines (each moved at most 0.8 s from Vico's own); when they
     change, the hero's own Director export (director-import/ErgoFlex-film-ch12-hero-director.json) plus those
     deskVersions goes through build-round8-director.py --import, the pass and the pages step (camera unchanged).
  4. build-cine-score.py <cut>: edl.json and score/score.wav, then its --check.
Do not run it while the director-import watcher is importing (it takes the cut lock; this does not).
--dry-run: prints the steps and the planned changes, writes nothing (with --import the later previews are skipped while
the hero is not yet 25.95 s).
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))   # the repo (tools/experience/drafts/<this>)
DRAFT = os.path.join(HERE, 'ErgoFlex-film-ch12-hero-director-DRAFT-25.95s.json')
B8 = os.path.join(ROOT, 'tools', 'experience', 'build-round8-director.py')
SCORE = os.path.join(ROOT, 'tools', 'experience', 'build-cine-score.py')


def load(name):
    spec = importlib.util.spec_from_file_location('hero_' + name, os.path.join(HERE, name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def step(cmd, dry):
    print('$ ' + ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) and c.startswith(ROOT) else c for c in cmd), flush=True)
    if not dry: subprocess.run(cmd, check=True)


def director_import(cut, export, dry):
    py = sys.executable
    step([py, B8, cut, '--import', export], dry)
    step([py, B8, cut], dry)
    step([py, B8, cut, '--pages', 'hero', '--downloads', os.path.join(cut, 'director-import')], dry)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    cut, dry, imp = args[0], '--dry-run' in sys.argv, '--import' in sys.argv
    ap, lk = load('apply'), load('looks')
    seconds = lambda: float(next(s for s in json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))['shots'] if s['id'] == 'hero')['seconds'])
    if imp: director_import(cut, DRAFT, dry)
    elif abs(seconds() - ap.HERO_SECONDS) > 1e-6:
        sys.exit(f'the hero is {seconds()} s: import the DRAFT in the Director first (or add --import)')
    if dry and abs(seconds() - ap.HERO_SECONDS) > 1e-6:
        print(f'(apply.py and looks.py previews skipped: the hero is {seconds()} s until the import has run)')
    else:
        print('$ apply.py ' + cut, flush=True); ap.apply(cut, dry)
        p = lk.plan(cut)
        print('$ looks.py ' + cut + ': ' + '; '.join(f"{f['fade']} {f['was_start']} -> {f['start']} s (look {f['look_film']}, bar {f['bar_film']})" for f in p['fades']), flush=True)
        if p['changed']:
            fd, tmp = tempfile.mkstemp(suffix='-hero-versions-export.json'); os.close(fd)
            try:
                if not dry: lk.export(cut, p['versions'], tmp)
                director_import(cut, tmp, dry)
            finally: os.remove(tmp)
        else: print('desk-version fades: already on the bar lines')
    step([sys.executable, SCORE, cut], dry)
    step([sys.executable, SCORE, cut, '--check'], dry)
    print('dry run: nothing written' if dry else 'done')


if __name__ == '__main__':
    main()
