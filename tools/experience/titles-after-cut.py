#!/usr/bin/env python3
"""HQ36 (Vico on HQ34: "the titles are being displayed for the new video before the video that is finishing ends, so
like they're too early"): every chapter title comes in at least LEAD s after its chapter's transition has fully finished
(edl transitions: duration, shift, centred on the EDL dissolve centre, as finish-intro.py cuts them), keeping its
on-screen time, and goes out at least TAIL s before the next transition starts (shortened if it must). Chapter 1's
own titles and the finale's (far from any cut) are left alone. Rewrites titles-src.json rel_in / rel_out in place.

    python3 tools/experience/titles-after-cut.py exports/cinematic-intro-20261104-hq14 [--dry]
"""
import json, os, sys

LEAD, TAIL, MIN_ON = 1.5, 0.8, 3.5
H = sys.argv[1]; dry = '--dry' in sys.argv
edl = json.load(open(os.path.join(H, 'edl.json'))); src_p = os.path.join(H, 'titles-src.json'); src = json.load(open(src_p))
ch = edl['chapters']; X = edl['dissolve']
tr = [v if isinstance(v, list) else [v, 0] for v in edl.get('transitions', [X] * (len(ch) - 1))]
cut_in, cut_out = {}, {}   # chapter-relative: transition in fully done, next transition starts
for i, c in enumerate(ch):
    if i: cut_in[c['id']] = X / 2 + tr[i - 1][1] + min(X, tr[i - 1][0]) / 2
    if i < len(ch) - 1:
        n = ch[i + 1]; cut_out[c['id']] = n['start'] - c['start'] + X / 2 + tr[i][1] - min(X, tr[i][0]) / 2
for t in src['titles']:
    cid = t['chapter']
    if cid not in cut_in: continue
    lo = cut_in[cid] + LEAD
    if t['rel_in'] >= lo - 1e-6: continue
    on = t['rel_out'] - t['rel_in']; a = round(lo, 2); b = round(min(a + on, cut_out.get(cid, 1e9) - TAIL), 2)
    if b - a < MIN_ON: print(f'  ! {cid}: only {b - a:.2f} s on screen')
    print(f'{cid:10s} {t["rel_in"]:5.2f}-{t["rel_out"]:5.2f} -> {a:5.2f}-{b:5.2f}  (cut done {cut_in[cid]:.2f}, next cut {cut_out.get(cid, 0):.2f})')
    t['rel_in'], t['rel_out'] = a, b
if not dry: json.dump(src, open(src_p, 'w'), indent=1, ensure_ascii=False)
