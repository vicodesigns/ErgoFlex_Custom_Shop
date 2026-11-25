#!/usr/bin/env python3
"""polish1124 Stream D: the three hero desk screens into the hero SUB-SHOTS (the film renders chapter 12 from them).

    python3 tools/experience/drafts/polish1124-hero-desks/add-desk-screens.py <cut dir> [--dry-run]

The Director import keeps hero screens out of the sub-shots (build-round8-director.py apply_lighting: each desk keeps its own
screens), so these go in here, idempotently, into <cut dir>/shots/13-subshots.json and <cut dir>/director-film/hero-subshots.json:
  artist sub-shot     + the portrait monitor (reference board + palette) and the wide monitor (the canvas)  offset 0
  architect sub-shot  + the wide monitor (House B model, floor plan, properties)                             offset -4.8
Each entry has afterEdits: true (film-fx.mjs installs it once the Director's added monitors exist). --dry-run (or --check) only reports. Nothing else changes:
an entry with the same target is replaced, every other entry and field is kept as it is. --check only reports.
The clips: exports/cinematic-intro-cut-cine/screens/cine-hero-desk-*.mp4 (tools/experience/screens/capture.mjs).
"""
import json, os, sys

CLIPS = 'exports/cinematic-intro-cut-cine/screens/'
SCREENS = {
    'artist': [{'target': 'added-prop-ergoflex-portrait-monitor-bvm1mxp20/monitor-screen', 'src': CLIPS + 'cine-hero-desk-artist-portrait.mp4', 'offset': 0, 'loop': False, 'afterEdits': True},
               {'target': 'added-prop-ergoflex-wide-monitor-j7rkts842/monitor-screen', 'src': CLIPS + 'cine-hero-desk-artist-wide.mp4', 'offset': 0, 'loop': False, 'afterEdits': True}],
    'architect': [{'target': 'added-prop-ergoflex-wide-monitor-gvmdrt6n4/monitor-screen', 'src': CLIPS + 'cine-hero-desk-architect-wide.mp4', 'offset': -4.8, 'loop': False, 'afterEdits': True}],
}


def patch(path, check):
    d = json.loads(open(path, 'rb').read())
    changed = []
    for s in d['shots']:
        add = SCREENS.get(s.get('preset'))
        if not add: continue
        targets = {a['target'] for a in add}
        before = s.get('screens') or []
        after = [sc for sc in before if sc.get('target') not in targets] + json.loads(json.dumps(add))
        if after != before: s['screens'] = after; changed.append(s['preset'])
    if changed and not check:
        txt = json.dumps(d)   # the cut's own format (build-round8-director.py dump(indent=None)): one line, ASCII, no newline
        open(path, 'wb').write(txt.encode('utf-8'))
    print(f'{path}: {"would change" if check else "changed"} {changed or "nothing"}')


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    cut, check = sys.argv[1], '--check' in sys.argv or '--dry-run' in sys.argv
    for rel in ('shots/13-subshots.json', 'director-film/hero-subshots.json'):
        p = os.path.join(cut, rel)
        if os.path.exists(p): patch(p, check)
        else: print(f'{p}: not there, skipped')


if __name__ == '__main__':
    main()
