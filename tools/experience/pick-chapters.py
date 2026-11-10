#!/usr/bin/env python3
"""Mix two cuts chapter by chapter: Vico's cut with the chapters he picks from the alternate one.

    python3 tools/experience/pick-chapters.py <his review-cut.json> <alternate review-cut.json> <out.json> --alt create,commons,storage
    python3 tools/experience/pick-chapters.py <his> <alternate> --list        what differs, chapter by chapter

Every chapter of the alternate cut has the same length and the same desk moves as his, so a picked chapter drops
into the film without touching the titles, the score or the dissolves. Neither input is written to.
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
        same = abs(s['seconds'] - a['seconds']) < 1e-6 and s.get('motion') == a.get('motion')
        cuts = sum(1 for k in a.get('cameraPlan', {}).get('keys', []) if k.get('cut'))
        cast = a.get('people') or {}
        who = len(cast.get('cast', [])) + len(cast.get('only', []) or [])
        print('%-10s %5.1f s  %s  %s%s' % (s['id'], s['seconds'], 'drop-in' if same else 'LENGTH OR MOVES DIFFER',
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
    if abs(s['seconds'] - a['seconds']) > 1e-6 or s.get('motion') != a.get('motion'):
        sys.exit('%s: the alternate chapter no longer has his length and desk moves; rebuild the alternate cut first.' % s['id'])
    his['shots'][i] = a
his['name'] = (his.get('name') or 'Review cut') + (' + alternate: ' + ', '.join(picked) if picked else '')
json.dump(his, open(out, 'w'), indent=1)
print('wrote', out, '- alternate chapters:', ', '.join(picked) or 'none')
