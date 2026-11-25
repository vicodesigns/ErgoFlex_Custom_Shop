#!/usr/bin/env python3
"""polish1124 hero3/hero4 (Nov 24 2026): the hero end card's titles, after the DRAFT Director import made the hero 25.95 s.

    python3 tools/experience/drafts/polish1124-hero3/apply.py <cut> [--dry-run]

Works on any cut (no film times baked in: everything is hero-relative or computed from the cut). Refuses unless
review-cut.json says the hero is 25.95 s. run-all.py next to it does this, the desk-version fades and the score in one go.
  1. titles-src.json 'cta' ("Let's build yours."; text and chapter unchanged; the wordmark stays at hero 19.87 s):
     rel_in = the wordmark + 2 beats of the finale's tempo (the score's fit of this cut; 20.94 s for the 24.978 s
     storage, 20.93 s for the 26.67 s one), fade_in 0.5 s, size 72 px on the 1080 frame, Poppins SemiBold, letter-spacing
     2.5, set 30 px under the wordmark on its axis (finish-intro.py 'gap'; libass scales it with the frame). A backup is
     written first (titles-src.pre-polish1124-hero3-<time>.json).
  2. score-pins.json: a pin file whose bar lines all sit in the storage -> hero dissolve (the 215.478 of hero3 or the
     desk's 217.395) is removed (backup score-pins.pre-polish1124-hero4-<time>.json): build-cine-score.py v2.5 keeps the
     earlier chapters where they are by itself (the finale's looks no longer steer the fit), so no pin is needed.
--dry-run prints what would change and writes nothing.
"""
import datetime, importlib.util, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
HERO_SECONDS = 25.95
LOGO_REL = 19.87
CTA = {'fade_in': 0.5, 'size': 72, 'font': 'Poppins SemiBold', 'spacing': 2.5, 'gap': 30}


def score_module():
    spec = importlib.util.spec_from_file_location('bcs_apply', os.path.join(ROOT, 'tools', 'experience', 'build-cine-score.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.need_numpy(); return m


def finale(cut):
    """-> (hero tempo BPM from the score's fit of this cut, (lo, hi) film s of the storage -> hero dissolve window)."""
    b = score_module(); edl = b.generate_edl(cut); pic = dict(b.picture(cut, edl), pins=[])
    t, _ = b.fit_tempo(b.load_synth(), edl, pic)
    bpm = 60 * t['seg_beats'][-1] / (t['anchors'][-1] - t['anchors'][-2])
    c, d = pic['dissolves'][-1]; w = min(b.DISSOLVE_SLACK, 0.45 * d)
    return bpm, (c - w, c + w)


def plan(cut):
    """-> (changes [text], new titles-src or None, remove the pin file: bool); exits when the cut is not ready."""
    rc = json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))
    hero = next(s for s in rc['shots'] if s['id'] == 'hero')
    if abs(float(hero['seconds']) - HERO_SECONDS) > 1e-6:
        sys.exit(f"the hero is {hero['seconds']} s in {cut}/review-cut.json: import the DRAFT ({HERO_SECONDS} s) first")
    src = json.load(open(os.path.join(cut, 'titles-src.json'), encoding='utf-8'))
    if abs(float(src['logo']['rel_in']) - LOGO_REL) > 1e-6 or src['cta']['chapter'] != 'hero':
        sys.exit(f"titles-src.json's wordmark / CTA are not where this patch expects them ({src['logo']}, {src['cta']}): not applied")
    bpm, (lo, hi) = finale(cut)
    want = dict(src['cta'], rel_in=round(LOGO_REL + 2 * 60 / bpm, 2), **CTA); changes = []; new_src = None
    if want != src['cta']:
        changes.append(f"titles-src.json cta: {src['cta']} -> {want} (wordmark + 2 beats at the finale's {bpm:.2f} BPM)"); new_src = dict(src, cta=want)
    pp = os.path.join(cut, 'score-pins.json'); drop = False
    if os.path.exists(pp):
        pins = [float(x['at']) for x in json.load(open(pp, encoding='utf-8')).get('bar_lines', [])]
        if pins and all(lo - 1e-6 <= p <= hi + 1e-6 for p in pins):
            drop = True; changes.append(f'score-pins.json ({pins}: the storage -> hero dissolve) removed: build-cine-score.py v2.5 needs no pin')
        else: print(f'score-pins.json kept: {pins} are not (only) the storage -> hero dissolve [{lo:.3f}, {hi:.3f}]')
    return changes, new_src, drop


def apply(cut, dry=False):
    changes, new_src, drop = plan(cut)
    for c in changes: print(('would change: ' if dry else 'change: ') + c)
    if not changes: print('titles / pins: nothing to do (already applied)')
    if dry: return changes
    stamp = f'{datetime.datetime.now():%Y%m%d-%H%M%S}'
    if new_src is not None:
        tp = os.path.join(cut, 'titles-src.json')
        shutil.copyfile(tp, os.path.join(cut, f'titles-src.pre-polish1124-hero3-{stamp}.json'))
        json.dump(new_src, open(tp, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    if drop:
        pp = os.path.join(cut, 'score-pins.json')
        shutil.copyfile(pp, os.path.join(cut, f'score-pins.pre-polish1124-hero4-{stamp}.json')); os.remove(pp)
    return changes


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    apply(args[0], '--dry-run' in sys.argv)
    if '--dry-run' not in sys.argv: print(f'now: python3 tools/experience/build-cine-score.py {args[0]}')
