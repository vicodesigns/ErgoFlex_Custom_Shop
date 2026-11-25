#!/usr/bin/env python3
"""polish1124 hero3 (Nov 24 2026): the hero end card, after the DRAFT Director import has made the chapter 25.95 s.

    python3 tools/experience/drafts/polish1124-hero3/apply.py exports/cinematic-intro-cut-vicos-3rd-cut [--dry-run]

What the Director import cannot carry, as a documented patch. Run it once, AFTER the DRAFT
(ErgoFlex-film-ch12-hero-director-DRAFT-25.95s.json) is in the film, i.e. once review-cut.json says the hero is
25.95 s; it refuses otherwise. run-all.py next to it does this and the score in one go.
  1. titles-src.json 'cta' ("Let's build yours."; text and chapter unchanged; the wordmark stays at hero 19.87 s):
     rel_in 21.29 -> 20.94 (film 235.768 = the wordmark 234.698 + 2 beats at the finale's 112.38 BPM, 1.07 s later),
     fade_in 0.5 s, size 72 px on the 1080 frame, font Poppins SemiBold, letter-spacing 2.5, set 30 px under the
     wordmark on its axis (gap: finish-intro.py places it; libass scales it with the frame, so 720p / 1080p / 4K match).
     A backup is written first (titles-src.pre-polish1124-hero3-<time>.json).
  2. score-pins.json (new, next to edl.json): pins the storage -> hero dissolve bar line at 215.478, so the desk-version
     fades on the finale's bar lines do not retime the storage chapter's music (build-cine-score.py pins()).
Then rebuild the EDL and the score: python3 tools/experience/build-cine-score.py <cut>  (run-all.py does it).
--dry-run prints what would change and writes nothing.
"""
import datetime, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HERO_SECONDS = 25.95
CTA = {'rel_in': 20.94, 'fade_in': 0.5, 'size': 72, 'font': 'Poppins SemiBold', 'spacing': 2.5, 'gap': 30}


def plan(cut):
    """-> (changes [text], new titles-src or None, pins text or None); exits when the cut is not ready for the patch."""
    rc = json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))
    hero = next(s for s in rc['shots'] if s['id'] == 'hero')
    if abs(float(hero['seconds']) - HERO_SECONDS) > 1e-6:
        sys.exit(f"the hero is {hero['seconds']} s in {cut}/review-cut.json: import the DRAFT ({HERO_SECONDS} s) first")
    src = json.load(open(os.path.join(cut, 'titles-src.json'), encoding='utf-8'))
    if abs(float(src['logo']['rel_in']) - 19.87) > 1e-6 or src['cta']['chapter'] != 'hero':
        sys.exit(f"titles-src.json's wordmark / CTA are not where this patch expects them ({src['logo']}, {src['cta']}): not applied")
    want = dict(src['cta'], **CTA); changes = []
    new_src = None
    if want != src['cta']:
        changes.append(f"titles-src.json cta: {src['cta']} -> {want}"); new_src = dict(src, cta=want)
    pins = open(os.path.join(HERE, 'score-pins.json'), encoding='utf-8').read(); pp = os.path.join(cut, 'score-pins.json')
    if os.path.exists(pp) and open(pp, encoding='utf-8').read() == pins: pins = None
    else: changes.append('score-pins.json: storage -> hero bar line pinned at 215.478')
    return changes, new_src, pins


def apply(cut, dry=False):
    changes, new_src, pins = plan(cut)
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print('titles / pins: nothing to do (already applied)')
    if dry: return changes
    if new_src is not None:
        tp = os.path.join(cut, 'titles-src.json')
        shutil.copyfile(tp, os.path.join(cut, f"titles-src.pre-polish1124-hero3-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"))
        json.dump(new_src, open(tp, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    if pins is not None: open(os.path.join(cut, 'score-pins.json'), 'w', encoding='utf-8', newline='\n').write(pins)
    return changes


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    apply(args[0], '--dry-run' in sys.argv)
    if '--dry-run' not in sys.argv: print(f'now: python3 tools/experience/build-cine-score.py {args[0]}')
