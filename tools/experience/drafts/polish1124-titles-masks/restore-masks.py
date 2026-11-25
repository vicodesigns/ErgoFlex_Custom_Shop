#!/usr/bin/env python3
"""DRAFT (polish1124-titles): bring Vico's hand-edited title shadow masks back onto the CURRENT titles-src.json.

Why: a rewrite of titles-src.json on 2026-11-24 ~21:50-21:54 (the backup titles-src.pre-typography-polish-20261124-2150.json
is the last copy that still has the masks) dropped 'shadow' from the 8 titles that had a hand-edited one, and in the same step
reset every title's typography to one uniform set. The masks were fitted to the OLD type sizes and copy, so putting them back
verbatim would not fit the new layout. This script keeps each hand edit as "how his quad differs from the auto box" and re-applies
that difference to the auto box of the CURRENT layout, so every mask follows the current copy, sizes and offsets:

    new corner = current auto block box corner + (his corner - auto block box corner of the OLD layout)

A "block" is the eyebrow, the headline (all its lines) or the supporting text, as his masks were drawn (3 quads per title).
Quads of one title that would still overlap are trimmed to meet halfway (never double dark); --no-trim keeps them as they come.
Titles whose block did not change come back exactly as he drew them.

It NEVER edits a file in place: it prints a report (dry run), and with --out writes a new full titles-src.json (copy it over the
live one yourself after looking at it; 'Reset to fitted' in the Director's Shadow layer still gives auto back per title).

    python tools/experience/drafts/polish1124-titles-masks/restore-masks.py \\
        --old  <cut>/titles-src.pre-typography-polish-20261124-2150.json \\
        --current <cut>/titles-src.json  [--out <new file>] [--only rise,create] [--no-trim]
"""
import argparse, copy, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FI_PATH = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'finish-intro.py')
spec = importlib.util.spec_from_file_location('finish_intro', FI_PATH); fi = importlib.util.module_from_spec(spec); spec.loader.exec_module(fi)

BASE = {'eyebrow': (812, 28, 600, 6), 'title': (912, 86, 600, -.6), 'detail': (970, 40, 400, .2)}   # y, size, weight, Style spacing
LINE_LEAD = .74


def block_boxes(t):
    """{block: [x0, y0, x1, y1]}: each block's auto box (union of its lines' tight boxes), relative to the title anchor, unscaled.
    Mirrors finish-intro.py title_dialogues (line steps, case, line height, offsets, alignment)."""
    ty = t.get('typography') or {}
    cfg = lambda k: ty.get(k) or {}
    size = lambda k: float(cfg(k).get('size', BASE[k][1]))
    step = lambda k: float(cfg(k)['lineHeight']) * size(k) / fi.FONT_REAL if cfg(k).get('lineHeight') is not None else size(k) * LINE_LEAD
    cased = lambda k, s: s.upper() if cfg(k).get('caps') == 'upper' else s.lower() if cfg(k).get('caps') == 'lower' else s
    parts = lambda k: (cased(k, (t.get(k) or '').replace('\r\n', '\n').replace('\r', '\n'))).split('\n') if t.get(k) else []
    n_title = len(parts('title'))
    extra = max(0, n_title - 1) * step('title')
    align = t.get('align') or ('right' if t.get('place') == 'top-right' else 'left')
    out = {}
    for key, (y, _, w0, sp0) in BASE.items():
        ps = parts(key); n = len(ps)
        base_y = y - extra if key == 'eyebrow' else y
        boxes = []
        for i, text in enumerate(ps):
            if not text: continue
            sub_y = round(base_y - (n - 1 - i) * step(key), 2) if key != 'detail' else round(base_y + i * step(key), 2)
            c = cfg(key); sz = size(key); weight = int(c.get('weight', w0)); spacing = float(c.get('spacing', max(0, sp0)))
            up = sz * max(0, fi.FALLBACK_ASC - fi.ASC) if fi.has_fallback(sz, weight, text) else 0
            b = fi.fitted_box(key, sz, sub_y + float(c.get('dy', 0)), float(c.get('dx', 0)), fi.text_width(sz, spacing, weight, text), align, up)
            boxes.append([b['x0'], b['y0'], b['x1'], b['y1']])
        if boxes: out[key] = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
    return out


corners = lambda b: [(b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]


def restore(old_t, new_t, trim=True):
    """The shadow of old_t re-seated on new_t's layout: (shadow dict, report dict)."""
    old, new = block_boxes(old_t), block_boxes(new_t)
    paths, moved, missing = [], 0.0, []
    for p in old_t['shadow']['paths']:
        k = p.get('line')
        if k not in old or k not in new: missing.append(k); continue
        pts, oc, nc = p['points'], corners(old[k]), corners(new[k])
        if len(pts) != 4:   # a hand-shaped outline (more points / curves): his box mapped onto the new block box (x and y scaled with it)
            ob, nb = old[k], new[k]; sx, sy = (nb[2] - nb[0]) / (ob[2] - ob[0]), (nb[3] - nb[1]) / (ob[3] - ob[1])
            q = []
            for pt in pts:
                e = {**pt, 'x': fi.r2(nb[0] + (pt['x'] - ob[0]) * sx), 'y': fi.r2(nb[1] + (pt['y'] - ob[1]) * sy)}
                for h in ('in', 'out'):
                    if h in pt: e[h] = [fi.r2(pt[h][0] * sx), fi.r2(pt[h][1] * sy)]
                q.append(e)
            moved = max(moved, max(max(abs(a['x'] - b['x']), abs(a['y'] - b['y'])) for a, b in zip(q, pts)))
            paths.append({**{kk: vv for kk, vv in p.items() if kk != 'points'}, 'points': q}); missing.append(f'{k}: {len(pts)}-point outline scaled onto the new box'); continue
        q = [{**pt, 'x': fi.r2(nx + (pt['x'] - ox)), 'y': fi.r2(ny + (pt['y'] - oy))} for pt, (ox, oy), (nx, ny) in zip(pts, oc, nc)]
        moved = max(moved, max(max(abs(a['x'] - b['x']), abs(a['y'] - b['y'])) for a, b in zip(q, pts)))
        paths.append({**{kk: vv for kk, vv in p.items() if kk != 'points'}, 'points': q})
    trimmed = 0
    if trim:   # quads whose boxes overlap vertically while sharing width meet halfway (corners 0,1 = top, 2,3 = bottom)
        bb = lambda p: (min(c['x'] for c in p['points']), min(c['y'] for c in p['points']), max(c['x'] for c in p['points']), max(c['y'] for c in p['points']))
        order = sorted(range(len(paths)), key=lambda i: bb(paths[i])[1])
        for a, b in zip(order, order[1:]):
            A, B = bb(paths[a]), bb(paths[b])
            if A[3] > B[1] and A[0] < B[2] and B[0] < A[2] and len(paths[a]['points']) == 4 and len(paths[b]['points']) == 4:
                mid = fi.r2((A[3] + B[1]) / 2); trimmed += 1
                for i in (2, 3): paths[a]['points'][i]['y'] = mid
                for i in (0, 1): paths[b]['points'][i]['y'] = mid
    return {**{k: v for k, v in old_t['shadow'].items() if k != 'paths'}, 'paths': paths}, dict(max_shift=round(moved, 1), trimmed=trimmed, missing=missing)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--old', required=True); ap.add_argument('--current', required=True); ap.add_argument('--out')
    ap.add_argument('--only', help='comma separated chapter ids'); ap.add_argument('--no-trim', action='store_true')
    a = ap.parse_args()
    if a.out and os.path.abspath(a.out) in (os.path.abspath(a.old), os.path.abspath(a.current)): sys.exit('--out must be a new file (this script never edits in place)')
    old, cur = json.load(open(a.old, encoding='utf-8')), json.load(open(a.current, encoding='utf-8'))
    only = set(a.only.split(',')) if a.only else None
    res = copy.deepcopy(cur); seen = {}
    print(f'{"title":<11}{"headline (now)":<34}{"his mask vs the new layout":<46}')
    done = 0
    for old_t in old['titles']:
        ch = old_t['chapter']; n = seen.get(ch, 0); seen[ch] = n + 1
        if not (old_t.get('shadow') or {}).get('paths') or (only and ch not in only): continue
        idx = [i for i, t in enumerate(res['titles']) if t['chapter'] == ch]
        if n >= len(idx): print(f'{ch:<11}no title #{n + 1} in the current file: skipped'); continue
        new_t = res['titles'][idx[n]]
        if new_t.get('shadow', {}).get('paths'): print(f'{ch:<11}the current title already has a custom shadow: left alone'); continue
        shadow, rep = restore(old_t, new_t, not a.no_trim); new_t['shadow'] = shadow; done += 1
        print(f'{ch:<11}{new_t["title"].replace(chr(10), " / ")[:32]:<34}restored 3 quads, up to {rep["max_shift"]} px from his drawing{", trimmed " + str(rep["trimmed"]) + " overlap(s)" if rep["trimmed"] else ""}{"; " + str(rep["missing"]) if rep["missing"] else ""}')
    print(f'{done} title(s) restored.' + ('' if a.out else ' Dry run: nothing written (add --out <new file>).'))
    if a.out and done:
        json.dump(res, open(a.out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); print('wrote', a.out)


if __name__ == '__main__':
    main()
