#!/usr/bin/env python3
"""Round 5 (HQ10): cut the safety chapter and re-time the film around the merged opener.

    python3 tools/experience/build-round5-edl.py exports/cinematic-intro-20261103-hq10

Vico (round 5): the status-indicator lighting moved into the opener (build-opener.py), so the 'status'
chapter goes. Removes it from review-cut.json and titles-src.json (and its shots/06*.json), then rebuilds
edl.json from the cut: chapter i runs `seconds`, consecutive chapters overlap by the EDL's dissolve, the
coast > oilers seam takes over the coast > status transition, title B (the score's beat 0) is the opener's
second card, and the end-card beat keeps its HQ9 offset from the logo. Re-running is safe.
Renders are still named by their HQ9 shot numbers; link them by chapter id (see REVIEW-NOTES).
"""
import json, os, sys
d = sys.argv[1]
J = lambda n: os.path.join(d, n)
cut = json.load(open(J('review-cut.json'))); edl = json.load(open(J('edl.json'))); src = json.load(open(J('titles-src.json')))
ids = [c['id'] for c in sorted(edl['chapters'], key=lambda c: c['index'])]
if 'status' in ids:                      # drop the transition into the cut chapter; the one out of it stays
    k = ids.index('status'); del edl['transitions'][k - 1]
cut['shots'] = [s for s in cut['shots'] if s['id'] != 'status']
src['titles'] = [t for t in src['titles'] if t['chapter'] != 'status']
for n in ('06.json', '06-subshots.json'):
    if os.path.exists(J('shots/' + n)) and json.load(open(J('shots/' + n))).get('id') in ('status', None): os.remove(J('shots/' + n))
chs, t = [], 0.0
for i, s in enumerate(cut['shots']):
    start = 0.0 if i == 0 else round(t - edl['dissolve'], 3)
    t = round(start + s['seconds'], 3)
    chs.append({'index': i + 1, 'id': s['id'], 'duration': s['seconds'], 'start': start, 'end': t})
assert len(edl['transitions']) == len(chs) - 1, (len(edl['transitions']), len(chs))
start = {c['id']: c['start'] for c in chs}
awaken = [x for x in src['titles'] if x['chapter'] == 'awaken']
logo_at = start[src['logo']['chapter']] + src['logo']['rel_in']
edl.update(chapters=chs, total=t, beats=[
    {'at': 1.5, 'what': f"awaken title A: {awaken[0]['title']}"},
    {'at': awaken[1]['rel_in'], 'what': f"awaken title B: {awaken[1]['title']}"},
    {'at': round(logo_at - 0.38, 3), 'what': 'end card: ErgoFlex wordmark'},
    {'at': t, 'what': 'cut to black / onboarding'}])
json.dump(cut, open(J('review-cut.json'), 'w'))
json.dump(src, open(J('titles-src.json'), 'w'), indent=1)
json.dump(edl, open(J('edl.json'), 'w'), indent=1)
print(f'{len(chs)} chapters, {t:.1f} s:', ' '.join(f"{c['id']} {c['start']}" for c in chs))
