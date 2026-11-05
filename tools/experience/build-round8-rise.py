#!/usr/bin/env python3
"""Round 8, chapter 2 (rise): Vico's resent notes 1-3 (2026-11-04 afternoon).

- Remove the Surface tablet (and its app screen clip): the desk itself shows the lift.
- Back to the HQ9/HQ10 camera: open on the Daily Notes notebook and cup, look up to the
  monitor, then pull out to the whole desk (HQ10's spline; HQ11/HQ12 re-aimed it at the tablet).
- Hide the two painted mugs on the right; replace the plain cylinder cup by the day kit's
  notebook with the supplied insulated coffee cup, a little smaller, beside the pages.
Usage: build-round8-rise.py <hq dir> (edits review-cut.json and shots/02.json in place).
"""
import json, os, sys

H = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HQ10 = os.path.join(ROOT, 'exports/cinematic-intro-20261103-hq10/review-cut.json')
ref = next(s for s in json.load(open(HQ10))['shots'] if s['id'] == 'rise')

CUP_HIDE = {'match': '^$', 'near': [-0.5197, 0.787, 0.02], 'hide': True}   # day kit cup + lid (unnamed cylinders)
MUGS_HIDE = {'match': '^Prop:painted-mug$', 'hide': True}
CUP = {'id': 'ergoflex-thermal-cup', 'x': -330, 'z': 115, 'rotation': 30, 'scale': 72}


def fix(s):
    s['camera'] = ref['camera']; s['cameraPlan'] = ref['cameraPlan']
    s['accessories'] = {'add': [CUP]}
    s['screens'] = [x for x in s.get('screens', []) if 'tablet' not in json.dumps(x)]
    edits = [e for e in s.get('sceneEdits', []) if e.get('match') not in (CUP_HIDE['match'], MUGS_HIDE['match'])]
    s['sceneEdits'] = edits + [MUGS_HIDE, CUP_HIDE]
    return s


cut_path = os.path.join(H, 'review-cut.json'); cut = json.load(open(cut_path))
cut['shots'] = [fix(s) if s['id'] == 'rise' else s for s in cut['shots']]
json.dump(cut, open(cut_path, 'w'), indent=1)
shot_path = os.path.join(H, 'shots', '02.json')
if os.path.exists(shot_path):
    sh = json.load(open(shot_path))
    if sh.get('id') == 'rise': json.dump(fix(sh), open(shot_path, 'w'), indent=1)
print('rise: HQ10 camera, no tablet, painted mugs hidden, insulated cup by the notebook')
