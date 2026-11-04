#!/usr/bin/env python3
"""Round 6 (HQ11) grade-only fixes, chapter trims and one seam, from the final expert panel.

    flock /tmp/claude-1000/hq11-cut.lock python3 tools/experience/build-round6-grade.py exports/cinematic-intro-20261103-hq11

Grade (final_review_lighting_2026-11-04.md): coast is the darkest daylight room (SHOULD 9); media halves the
desk-front shadows (NICE 10); music is 32% near-black (NICE 11). Trims (final_review_content_2026-11-04.md SHOULD 4):
coast 11 -> 9.5, music 14 -> 11, media 14 -> 11 s cut the static tails (renders are longer; finish-intro trims to
the EDL); wellness (13) and the opener (39.5) are trimmed by their own builders. Seam
(final_review_cinematography_2026-11-04.md 7): commons > coast becomes a plain 0.8 s dissolve, since the left
wipe ran against coast's opening drift. Run build-round5-edl.py afterwards to re-time the EDL. Values are absolute.
"""
import json, os, sys
d = sys.argv[1]
J = lambda n: os.path.join(d, n)
g = json.load(open(J('grade.json')))
g.setdefault('coast', {}).update(gamma=1.15, contrast=1.02)
g.setdefault('media', {}).update(gamma=1.0, contrast=1.02)
g.setdefault('music', {}).update(gamma=1.06)
json.dump(g, open(J('grade.json'), 'w'), indent=1)
cut = json.load(open(J('review-cut.json')))
TRIM = {'coast': 9.5, 'music': 11, 'media': 11}
for s in cut['shots']:
    if s['id'] in TRIM: s['seconds'] = TRIM[s['id']]
json.dump(cut, open(J('review-cut.json'), 'w'))
edl = json.load(open(J('edl.json')))
ids = [c['id'] for c in sorted(edl['chapters'], key=lambda c: c['index'])]
edl['transitions'][ids.index('commons')] = 0.8
json.dump(edl, open(J('edl.json'), 'w'), indent=1)
print('grade: coast/media/music | trims:', TRIM, '| commons > coast: 0.8 s dissolve')
