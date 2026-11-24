#!/usr/bin/env python3
"""polish1124 hero2 (Nov 24 2026): the hero end card, after the DRAFT Director import has made the chapter 25.5 s.

    python3 tools/experience/drafts/polish1124-hero2/apply.py exports/cinematic-intro-cut-vicos-3rd-cut [--dry-run]

What the Director import cannot carry, as a documented patch (run it once, AFTER Vico has imported
ErgoFlex-film-ch12-hero-director-DRAFT-25s.json in Director ch12 and exported it, i.e. once review-cut.json says the
hero is 25.5 s; it refuses otherwise):
  1. titles-src.json 'cta' ("Let's build yours."): rel_in 21.29 -> 20.94 (hero s; film 235.768 = the wordmark 234.698 +
     2 beats at the finale's 112.38 BPM), fade_in 0.6 s (was finish-intro.py's fixed 0.9), size 54 px on a 1080 frame
     (was 46). Text, chapter and the wordmark (logo rel_in 19.87) unchanged. A backup is written first
     (titles-src.pre-polish1124-hero2-<time>.json).
  2. score-pins.json (new, next to edl.json): pins the storage -> hero dissolve bar line at 215.478, so moving the desk-
     version fades onto the finale's bar lines does not retime the storage chapter's music (build-cine-score.py pins()).
Then rebuild the EDL and the score: python3 tools/experience/build-cine-score.py <cut>   (and --check).
--dry-run prints what would change and writes nothing.
"""
import datetime, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CTA = {'rel_in': 20.94, 'fade_in': 0.6, 'size': 54}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    cut, dry = args[0], '--dry-run' in sys.argv
    rc = json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))
    hero = next(s for s in rc['shots'] if s['id'] == 'hero')
    if abs(float(hero['seconds']) - 25.5) > 1e-6:
        sys.exit(f"the hero is {hero['seconds']} s in {cut}/review-cut.json: import the DRAFT (25.5 s) in the Director first")
    tp = os.path.join(cut, 'titles-src.json'); src = json.load(open(tp, encoding='utf-8'))
    if abs(float(src['logo']['rel_in']) - 19.87) > 1e-6 or src['cta']['chapter'] != 'hero':
        sys.exit(f"titles-src.json's wordmark / CTA are not where this patch expects them ({src['logo']}, {src['cta']}): not applied")
    want = dict(src['cta'], **CTA)
    changes = []
    if want != src['cta']: changes.append(f"titles-src.json cta: {src['cta']} -> {want}")
    pp = os.path.join(cut, 'score-pins.json'); pins = open(os.path.join(HERE, 'score-pins.json'), encoding='utf-8').read()
    if not os.path.exists(pp) or open(pp, encoding='utf-8').read() != pins: changes.append('score-pins.json: storage -> hero bar line pinned at 215.478')
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if dry or not changes:
        if not changes: print('nothing to do (already applied)')
        return
    if want != src['cta']:
        shutil.copyfile(tp, os.path.join(cut, f"titles-src.pre-polish1124-hero2-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"))
        src['cta'] = want
        json.dump(src, open(tp, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    open(pp, 'w', encoding='utf-8', newline='\n').write(pins)
    print(f'now: python3 tools/experience/build-cine-score.py {cut}')


if __name__ == '__main__':
    main()
