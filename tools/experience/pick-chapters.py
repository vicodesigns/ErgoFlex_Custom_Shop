#!/usr/bin/env python3
"""Mix two cuts chapter by chapter: Vico's cut with the chapters he picks from another one (the cut with people,
exports/cinematic-intro-20261110-people, or the alternate cut, exports/cinematic-intro-20261110-alt).

    python3 tools/experience/pick-chapters.py <his review-cut.json> <other review-cut.json> <out.json> --alt create,commons,storage
    python3 tools/experience/pick-chapters.py <his> <other> --list        what differs, chapter by chapter

Every chapter of those cuts has the same length as his, so a picked chapter drops into the film without touching
the titles, the score or the dissolves. The desk moves are his too, except where he asked for a change (commons:
the desk starts centred on the green carpet); --list says so. Neither input is written to.
"""
import json, sys

args = sys.argv[1:]
his, alt = json.load(open(args[0])), json.load(open(args[1]))
theirs = {s['id']: s for s in alt['shots']}
FIELDS = ('people', 'cameraPlan', 'sceneEdits', 'lights', 'obstacles')

if '--list' in args:
    for s in his['shots']:
        a = theirs.get(s['id'])
        if not a: print('%-10s only in his cut' % s['id']); continue
        diff = [k for k in sorted(set(s) | set(a)) if k != 'camera' and s.get(k) != a.get(k)]
        same = abs(s['seconds'] - a['seconds']) < 1e-6; moves = s.get('motion') == a.get('motion')
        cuts = sum(1 for k in a.get('cameraPlan', {}).get('keys', []) if k.get('cut'))
        cast = a.get('people') or {}
        who = len(cast.get('cast', [])) + len(cast.get('only', []) or [])
        print('%-10s %5.1f s  %s  %s%s' % (s['id'], s['seconds'], ('drop-in' if moves else 'drop-in, desk moves differ') if same else 'LENGTH DIFFERS',
                                             ('changes: ' + ', '.join(diff)) if diff else 'identical',
                                             ('  (%d cut%s)' % (cuts, '' if cuts == 1 else 's')) if cuts else ''))
    sys.exit(0)

out = args[2]
picked = [x for x in args[args.index('--alt') + 1].split(',') if x] if '--alt' in args else []
unknown = [x for x in picked if x not in theirs]
if unknown: sys.exit('Not in the alternate cut: ' + ', '.join(unknown))
for i, s in enumerate(his['shots']):
    if s['id'] not in picked: continue
    a = theirs[s['id']]
    if abs(s['seconds'] - a['seconds']) > 1e-6:
        sys.exit('%s: that chapter no longer has his length; rebuild the cut first (build-alt-cut.py).' % s['id'])
    his['shots'][i] = a
his['name'] = (his.get('name') or 'Review cut') + (' + %s: %s' % (alt.get('name') or 'other cut', ', '.join(picked)) if picked else '')
json.dump(his, open(out, 'w'), indent=1)
print('wrote', out, '- chapters taken from the other cut:', ', '.join(picked) or 'none')
