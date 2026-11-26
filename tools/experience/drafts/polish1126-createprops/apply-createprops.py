#!/usr/bin/env python3
"""Chapter 3 (Create) desk dressing, 26 Nov 2026 (Vico's review). Data only except the drink cup's `level` field
(film-edits.mjs), existing library props, no model changes.

    python3 apply-createprops.py <cut folder | json file ...>            # dry run: lists before -> after
    python3 apply-createprops.py --apply <cut folder | json file ...>    # writes

A cut folder means its review-cut.json, cut.json and director-film/create.json (those that exist). Only lists that
hold Create's right cubby (id vima7dnnn) are touched, so every other chapter stays as it is. Idempotent.
  1. The triangle on the drafting plan: the drafting kit's own 45 degree set square, which the cut slid 224 mm
     right (onto ENTRY) -> hide:true.
  2. A drink cup in the right cup holder (drafting phase) and a plant on the desktop shelf unit's right small shelf.
"""
import json, os, re, sys

ANCHOR = 'vima7dnnn'
SQUARE_COLOR = '#bcd4d4'
DRAFT = {'from': 7.4, 'to': 17.3, 'fadeIn': 0.25, 'fadeOut': 0.4}    # the drafting phase's side accessories


def new(asset, ident, label, parent, position, rotation=(0, 0, 0), scale=1, show=None, **extra):
    e = {'add': {'asset': asset}, 'id': ident, 'match': '^Added prop:%s#%s$' % (asset, ident), 'label': label,
         'parent': parent, 'position': list(position), 'rotation': list(rotation), 'scale': [scale] * 3}
    if show:
        e['show'] = dict(show)
    e.update(extra)
    if 'level' not in extra:
        e['director'] = True    # (the level cup stays a film edit: the Director's prop cleaner does not know `level`)
    return e


NEW = [
    # plant on the desktop shelf unit's right small shelf (parent 'shelf': lifts with the desk, never tilts)
    new('ergoflex-side-shelf-small', 'cr26shfR', 'Side shelf · small (desktop shelf, right)', 'shelf', [0.945, -0.168, 0.098], [0, -90, 0]),
    new('herodesk-office-plant', 'cr26plant', 'Snake plant in a white ceramic pot (desktop shelf)', 'shelf', [1.025, -0.1395, 0.098], [0, -90, 0], 1.15),
    # drafting phase, right cubby: the drink cup in the round cup hole (upright while the board tilts: `level` hangs it
    # from the hole's rim centre, its base `drop` under the rim)
    new('tea-cup', 'cr26drink', 'Drink cup (right cup holder)', 'desk', [1.3269, -0.0551, 0.4417], [0, 30, 0], 1.35, DRAFT, level={'drop': 0.07}),
]


def walk(node, where, log):
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, where + '.' + k, log)
        return
    if not isinstance(node, list):
        return
    for i, v in enumerate(node):
        walk(v, '%s[%d]' % (where, i), log)
    if not any(isinstance(x, dict) and x.get('id') == ANCHOR and 'add' in x for x in node):
        return
    for x in list(node):
        if isinstance(x, dict) and 'add' not in x and str(x.get('materialColor', '')).lower() == SQUARE_COLOR and x.get('hide') is not True:
            log.append('%s  set square (materialColor %s, moved %s) hide: %s -> true' % (where, SQUARE_COLOR, x.get('position'), json.dumps(x.get('hide'))))
            x['hide'] = True
    for n in NEW:
        have = next((x for x in node if isinstance(x, dict) and x.get('id') == n['id']), None)
        if have is None:
            node.append(dict(n))
            log.append('%s  + %s %s on %s at %s' % (where, n['id'], n['add']['asset'], n['parent'], n['position']))
            continue
        for k in ('parent', 'position', 'rotation', 'scale', 'show', 'level'):
            if have.get(k) != n.get(k):
                log.append('%s  %s %s: %s -> %s' % (where, n['id'], k, json.dumps(have.get(k)), json.dumps(n.get(k))))
                if k in n:
                    have[k] = n[k]
                else:
                    have.pop(k, None)


def main():
    apply = '--apply' in sys.argv
    paths = []
    for a in [a for a in sys.argv[1:] if a not in ('--apply', '--dry-run')]:
        if os.path.isdir(a):
            paths += [p for p in (os.path.join(a, f) for f in ('review-cut.json', 'cut.json', 'director-film/create.json')) if os.path.isfile(p)]
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
