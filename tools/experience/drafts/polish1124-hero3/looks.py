#!/usr/bin/env python3
"""polish1124 hero4: the hero's desk-version fades put on the score's bar lines, computed from the cut (no film times baked in).

    python3 tools/experience/drafts/polish1124-hero3/looks.py <cut> [--write <export.json>]

The score's tempo map (build-cine-score.py v2.5: the finale's looks do not steer the fit, so moving them cannot move any
bar line) gives the finale's bar lines. Each of Vico's three version fades (hero-relative, as he cut them before any
nudge: B->C 4.83 s and C->D 9.68 s, 0.6 s each, D->H 14.94 s, 2.0 s) moves by at most MAX_SHIFT so its centre (the
look) lands on the nearest bar line; the fade lengths and the looks themselves are unchanged. Prints the plan as JSON;
--write <file> writes a Director export of the hero (the cut's own director-import/ErgoFlex-film-ch12-hero-director.json,
which the pages step keeps equal to the film, plus 'deskVersions') for build-round8-director.py --import.
"""
import copy, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
ORIGINAL = [('B', 'C', 4.83, 0.6), ('C', 'D', 9.68, 0.6), ('D', 'H', 14.94, 2.0)]   # (from, to, fade start, fade length), hero s
MAX_SHIFT = 0.8


def score_module():
    spec = importlib.util.spec_from_file_location('bcs_looks', os.path.join(ROOT, 'tools', 'experience', 'build-cine-score.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.need_numpy(); return m


def plan(cut):
    """-> dict(bars=[film s], hero_start, versions=[{n, preset, name, start, end}], fades=[...], current=[...])."""
    b = score_module(); synth = b.load_synth()
    edl = b.generate_edl(cut)                                  # the EDL the score will use (from review-cut.json now)
    pic = b.picture(cut, edl); tempo, _ = b.fit_tempo(synth, edl, pic)
    t0, t1, n = tempo['anchors'][-2], tempo['anchors'][-1], tempo['seg_beats'][-1]
    bars = [t0 + (t1 - t0) * k / n for k in range(0, n + 1, 4)]
    hs = next(c['start'] for c in edl['chapters'] if c['id'] == 'hero'); seconds = next(c['duration'] for c in edl['chapters'] if c['id'] == 'hero')
    cur = json.load(open(os.path.join(cut, 'director-camera-hero.json'), encoding='utf-8')).get('versions') or []
    by = {v['n']: dict(v) for v in cur}
    if sorted(by) != ['B', 'C', 'D', 'H']: sys.exit(f'the hero has versions {sorted(by)}, not B C D H: no plan')
    fades = []
    for a, z, start, dur in ORIGINAL:
        centre = hs + start + dur / 2
        bar = min(bars, key=lambda x: abs(x - centre))
        shift = max(-MAX_SHIFT, min(MAX_SHIFT, bar - centre))
        new = round(start + shift, 2)
        by[z]['start'] = new; by[a]['end'] = round(new + dur, 2)
        fades.append(dict(fade=f'{a}->{z}', was_start=start, start=new, shift=round(new - start, 3), look_film=round(hs + new + dur / 2, 3),
                          bar_film=round(bar, 3), off_s=round(hs + new + dur / 2 - bar, 3)))
    by['B']['start'] = 0.0; by['H']['end'] = round(float(seconds), 2)
    versions = [by[k] for k in ('B', 'C', 'D', 'H')]
    return dict(hero_start=hs, hero_seconds=seconds, bars=[round(x, 3) for x in bars], fades=fades, versions=versions, current=cur,
                changed=any(abs(a[k] - c[k]) > 0.005 for a, c in zip(versions, sorted(cur, key=lambda v: v['start'])) for k in ('start', 'end')))


def export(cut, versions, out):
    src = json.load(open(os.path.join(cut, 'director-import', 'ErgoFlex-film-ch12-hero-director.json'), encoding='utf-8'))
    s = src['shots'][0]
    if abs(float(s['seconds']) - float(versions[-1]['end'])) > 1e-6: sys.exit(f"{cut}/director-import hero file is {s['seconds']} s, the versions end at {versions[-1]['end']}: run the pages step first")
    s['deskVersions'] = copy.deepcopy(versions)
    src['name'] = f"{src.get('name', 'Film chapter: hero')} (desk-version fades on the score's bar lines)"
    json.dump(src, open(out, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    p = plan(args[0]); print(json.dumps({k: v for k, v in p.items() if k != 'current'}, indent=1))
    if '--write' in sys.argv: export(args[0], p['versions'], sys.argv[sys.argv.index('--write') + 1])
