#!/usr/bin/env python3
"""DRAFT (polish1124-titles-sizes, NOT applied): give every film title back the type Vico had before the 2026-11-24 ~21:50
rewrite of titles-src.json (sizes, letter spacing, line offsets), keeping everything else as it is now.

A three-way merge, field by field (typography.<eyebrow|title|detail>.<size|spacing|dy|dx|weight|color|italic>, and the
title's position, scale and place):
    old   = titles-src.pre-typography-polish-20261124-2150.json        (before the rewrite: what Vico had)
    after = titles-src.pre-director-awaken-20261124-215457.json        (right after the rewrite)
    now   = the current titles-src.json
  old == after          the rewrite did not touch the field: the current value stays
  now != after          changed since the rewrite (his Director edits): the current value stays
  otherwise             the field goes back to the old value (removed if it was not set)
Never touched: copy (eyebrow / title / detail), timing, shadow (the auto shadow stays), the 2026-11-25 text options
(lineHeight, caps, opacity, strokeW, strokeColor, shadowDist, shadowColor, shadowOpacity), align, cta, logo.

Dry run by default: prints old / now / what it would do per title, and a fit check of the result (text inside the frame and
the 5 % action-safe area, no two blocks' letters colliding). Writes only with --out <new file>; never edits in place.

    python tools/experience/drafts/polish1124-titles-sizes/restore-sizes.py \\
        --old <cut>/titles-src.pre-typography-polish-20261124-2150.json \\
        --after <cut>/titles-src.pre-director-awaken-20261124-215457.json \\
        --current <cut>/titles-src.json  [--out <new file>]
"""
import argparse, copy, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
masks = _load('restore_masks', os.path.join(os.path.dirname(HERE), 'polish1124-titles-masks', 'restore-masks.py'))
fi = masks.fi

BLOCKS = ('eyebrow', 'title', 'detail')
NAMES = {'eyebrow': 'eyebrow', 'title': 'headline', 'detail': 'supporting'}
TYPE_KEYS = ('size', 'spacing', 'dy', 'dx', 'weight', 'color', 'italic')
PLACE_KEYS = ('position', 'scale', 'place')


def keyed(src):
    seen, out = {}, {}
    for t in src['titles']:
        n = seen.get(t['chapter'], 0); seen[t['chapter']] = n + 1; out[(t['chapter'], n)] = t
    return out


def merge(old, after, now):
    """(patched title, [(field, old value, current value, 'restore' | 'keep: changed since')]) for one title."""
    res = copy.deepcopy(now); rows = []
    def decide(label, o, a, c):
        if o == a: return False, None
        action = 'keep: changed since the rewrite' if c != a else ('restore' if c != o else None)
        if action: rows.append((label, o, c, action))
        return action == 'restore', o
    typ = copy.deepcopy(res.get('typography') or {})
    for b in BLOCKS:
        for k in TYPE_KEYS:
            o, a, c = (((x.get('typography') or {}).get(b) or {}).get(k) for x in (old, after, now))
            put, v = decide(f'{NAMES[b]} {k}', o, a, c)
            if put:
                cfg = typ.setdefault(b, {})
                if v is None: cfg.pop(k, None)
                else: cfg[k] = v
    typ = {b: v for b, v in typ.items() if v}
    if typ: res['typography'] = typ
    else: res.pop('typography', None)
    for k in PLACE_KEYS:
        put, v = decide(f'title {k}', old.get(k), after.get(k), now.get(k))
        if put:
            if v is None: res.pop(k, None)
            else: res[k] = v
    return res, rows


def layout(t):
    """{block: (x0, y0, x1, y1)} of the letters (ascender line to descender line, no padding) in film pixels on screen."""
    s = float(t.get('scale', 1)); align = t.get('align') or ('right' if t.get('place') == 'top-right' else 'left')
    ax = (t.get('position') or {}).get('x', {'left': 128, 'center': 960, 'right': 1792}[align])
    ay = (t.get('position') or {}).get('y', 912 + (fi.PLACE_DY if t.get('place', '').startswith('top') else 0))
    out = {}
    for k, b in masks.block_boxes(t).items():
        ph, pv = fi.TIGHT_PAD[k]
        out[k] = (ax + (b[0] + ph) * s, ay + (b[1] + pv) * s, ax + (b[2] - ph) * s, ay + (b[3] - pv) * s)
    return out


def fit(t):
    """Plain-words problems of a title's layout (empty = it fits), and its right-most letter."""
    L = layout(t); notes = []
    if not L: return notes, 0
    x0, y0 = min(b[0] for b in L.values()), min(b[1] for b in L.values()); x1, y1 = max(b[2] for b in L.values()), max(b[3] for b in L.values())
    if x0 < 0 or y0 < 0 or x1 > 1920 or y1 > 1080: notes.append('runs off the frame')
    elif x0 < 96 or x1 > 1824 or y0 < 54 or y1 > 1026: notes.append(f'outside the 5 % safe area (letters x {x0:.0f}-{x1:.0f}, y {y0:.0f}-{y1:.0f})')
    for a, b in (('eyebrow', 'title'), ('title', 'detail')):
        if a in L and b in L and L[a][3] > L[b][1] and L[a][0] < L[b][2] and L[b][0] < L[a][2]:
            notes.append(f'{NAMES[a]} and {NAMES[b]} letters collide by {L[a][3] - L[b][1]:.0f} px')
    return notes, x1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    for n in ('--old', '--after', '--current'): ap.add_argument(n, required=True)
    ap.add_argument('--out')
    a = ap.parse_args()
    if a.out and os.path.abspath(a.out) in [os.path.abspath(p) for p in (a.old, a.after, a.current)]: sys.exit('--out must be a new file (this script never edits in place)')
    if a.out and os.path.exists(a.out): sys.exit(f'--out {a.out} already exists: choose a new file')
    old, after, now = (json.load(open(p, encoding='utf-8')) for p in (a.old, a.after, a.current))
    O, A = keyed(old), keyed(after)
    res = copy.deepcopy(now); R = keyed(res); changed = 0
    for key, title in R.items():
        name = f'{key[0]} #{key[1] + 1}  "{title["title"].replace(chr(10), " / ")}"'
        if key not in O or key not in A: print(f'{name}\n  not in the old files: left alone'); continue
        patched, rows = merge(O[key], A[key], title)
        title.clear(); title.update(patched)
        print(name)
        if not rows: print('  nothing the rewrite changed is still in place: left alone')
        for label, o, c, action in rows:
            show = lambda v: 'film default' if v is None else json.dumps(v)
            print(f'  {label:<18} old {show(o):<26} now {show(c):<26} -> {action}')
        changed += any(r[3] == 'restore' for r in rows)
        notes, right = fit(patched); now_notes, now_right = fit(keyed(now)[key])
        print(f'  fit with the old type: {"; ".join(notes) if notes else "fits"} (right-most letter x = {right:.0f}; now {now_right:.0f}{"; now: " + "; ".join(now_notes) if now_notes else ""})')
    print(f'{changed} title(s) would change.' + ('' if a.out else ' Dry run: nothing written (add --out <new file>).'))
    if a.out:
        json.dump(res, open(a.out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); print('wrote', a.out)


if __name__ == '__main__':
    main()
