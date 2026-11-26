#!/usr/bin/env python3
"""Chapter 12 (hero) desk prop fixes, 26 Nov 2026: architect plans / mug / ruler / house, two new architect
accessories, and the office photo frame and plant onto the desktop shelf unit. Data only, existing library props.

    python3 apply-heroprops.py <cut folder | json file ...>            # dry run: lists before -> after
    python3 apply-heroprops.py --apply <cut folder | json file ...>    # writes

A cut folder means its shots/13-subshots.json, review-cut.json, cut.json and director-film/hero.json (those that
exist). Every add entry is found by its id, wherever it sits in the file (sceneEdits or propEdits). The two new
props are appended to each list that holds the architect desk's mug (id hdarchcoff) and lacks them.
Idempotent: a second run reports nothing to change. Files are rewritten in their own indent and line ending.
"""
import json, os, re, sys

# id -> (desk, fields to set)
CHANGE = {
    # architect: the yellow tracing roll and its pulled-out sheet lie flat on the tilt surface, against the ledge
    # (it had the left side shelf's own -17.4 deg tip and ran through the desktop)
    'hdarchtrac': ('architect', {'parent': 'desk', 'position': [-0.9771, 0.0016, 0.1705], 'rotation': [0, 90, 0]}),
    # architect: the mug was sunk through the tilt surface by the lamp clamp (only its rim showed) -> level, on the
    # right small shelf of the desktop shelf unit
    'hdarchcoff': ('architect', {'parent': 'shelf', 'position': [0.945, -0.1395, 0.098], 'rotation': [0, -35, 0]}),
    # architect: the scale ruler (306 mm, longer than that shelf) makes room: flat on the drawing, right of the plan
    'hdarchscal': ('architect', {'parent': 'desk', 'position': [0.68, 0.0272, 0.08], 'rotation': [0, 90, 0]}),
    # architect: the study model and its trees square on the left small shelf (at 0.9), inside it and clear of the unit's side plate
    'hdarchmode': ('architect', {'position': [-0.9741, -0.1465, 0.116], 'rotation': [0, 0, 0], 'scale': [0.9, 0.9, 0.9]}),
    # office: framed photo and snake plant stand on the desktop shelf unit's small side shelves (they rode the tilt)
    'hdofficeph:herodesk-office-photo-frame': ('office', {'parent': 'shelf', 'position': [-0.9882, -0.1241, 0.217], 'rotation': [0, -18.8, 0]}),
    'hdofficepl': ('office', {'parent': 'shelf', 'position': [0.945, -0.1395, 0.098], 'rotation': [0, -90, 0]}),
}
SHOW = {'from': 0.3, 'to': 5.15, 'fadeIn': 0.25, 'fadeOut': 0.3}
def new(asset, ident, label, parent, position, rotation):
    return {'add': {'asset': asset}, 'id': ident, 'match': '^Added prop:%s#%s$' % (asset, ident), 'label': label,
            'parent': parent, 'position': position, 'rotation': rotation, 'scale': [1, 1, 1], 'desk': 'architect',
            'show': dict(SHOW), 'director': True}
NEW = [
    new('retro-camera', 'hpropcam', 'Site-survey camera (little side shelf)', 'base-shelf', [-0.923, 0.054, -0.113], [0, 55, 0]),
    new('paper-drawer', 'hpropflat', 'Drawing-sheet drawers (base shelf)', 'base-shelf', [0.4, 0.0, 0.0], [0, 0, 0]),
]

def find_change(e):
    asset = e['add']['asset'] if isinstance(e['add'], dict) else e['add']
    # the office frame and phone share the id 'hdofficeph' (cut to 10 characters): those are told apart by asset
    return CHANGE.get('%s:%s' % (e.get('id'), asset)) or CHANGE.get(e.get('id'))

def walk(node, where, log):
    if isinstance(node, dict):
        if 'add' in node and 'id' in node:
            hit = find_change(node)
            if hit and node.get('desk') == hit[0]:
                for k, v in hit[1].items():
                    if node.get(k) != v:
                        log.append('%s  %s %s: %s -> %s' % (where, node['id'], k, json.dumps(node.get(k)), json.dumps(v)))
                        node[k] = v
        for k, v in node.items():
            walk(v, where + '.' + k, log)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, '%s[%d]' % (where, i), log)
        anchor = next((x for x in node if isinstance(x, dict) and x.get('id') == 'hdarchcoff' and 'add' in x), None)
        if anchor:
            for n in NEW:
                have = next((x for x in node if isinstance(x, dict) and x.get('id') == n['id']), None)
                want = {k: v for k, v in n.items() if k != 'director' or 'director' in anchor}
                if have is None:
                    node.append(want)
                    log.append('%s  + %s %s on %s at %s' % (where, n['id'], n['add']['asset'], n['parent'], n['position']))
                elif any(have.get(k) != want[k] for k in ('parent', 'position', 'rotation')):
                    for k in ('parent', 'position', 'rotation'):
                        if have.get(k) != want[k]:
                            log.append('%s  %s %s: %s -> %s' % (where, n['id'], k, json.dumps(have.get(k)), json.dumps(want[k])))
                            have[k] = want[k]

def main():
    apply = '--apply' in sys.argv
    paths = []
    for a in [a for a in sys.argv[1:] if a not in ('--apply', '--dry-run')]:
        if os.path.isdir(a):
            paths += [p for p in (os.path.join(a, f) for f in ('shots/13-subshots.json', 'review-cut.json', 'cut.json', 'director-film/hero.json')) if os.path.isfile(p)]
        else:
            paths.append(a)
    if not paths:
        sys.exit(__doc__)
    total = 0
    for p in paths:
        raw = open(p, 'rb').read().decode('utf-8-sig')
        data, log = json.loads(raw), []
        walk(data, '$', log)
        total += len(log)
        print('%s: %d change(s)' % (p, len(log)))
        for line in log:
            print('   ' + line)
        if apply and log:
            m = re.search(r'\n( +)\S', raw)
            out = json.dumps(data, ensure_ascii=False, indent=len(m.group(1)) if m else None,
                             separators=None if m else (',', ':'))
            if raw.endswith('\n'):
                out += '\n'
            if '\r\n' in raw:
                out = out.replace('\n', '\r\n')
            open(p, 'wb').write(out.encode('utf-8'))
    print(('applied' if apply else 'dry run, nothing written') + ': %d change(s)' % total)

if __name__ == '__main__':
    main()
