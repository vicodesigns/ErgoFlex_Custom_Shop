#!/usr/bin/env python3
"""Chapter 12 (hero), 3rd cut, 28 Nov 2026: the Architect desk's plans come in WITH the Artist -> Architect desk dissolve
(the B -> C crossfade, chapter 6.54-7.14 s), not on their own clock after it. Data only, per-item values only.

    python3 apply-seam-props.py <cut folder | json file ...>                 # dry run: lists before -> after
    python3 apply-seam-props.py --apply <cut folder | json file ...>         # writes
    python3 apply-seam-props.py --with-rolls [--apply] <...>                 # also the rolled drawings and the side
                                                                             # cup holder they stand in (right side)

Why: a desk-scoped show window counts from its sub-shot's renderRange start (film-edits.mjs showFactor), and the
desk dissolve itself is the crossfade of the B and C renders. A prop that is already solid at C's first frame
therefore dissolves in exactly with the desk; any show fade-in on top of that multiplies the crossfade (it lags,
and the translucent yellow trace paper, two paper faces over an opaque card core, reads denser than the other props
at the same fade factor, so it looked "solid" next to them). So: show.from -> 0 and no fadeIn; to / fadeOut stay
as the user set them. Desk-version timing, sub-shot ranges, cameras, score and EDL are untouched.

A cut folder means its shots/13-subshots.json, review-cut.json, cut.json, director-film/hero.json,
director-film/hero-subshots.json and director-camera-hero.json (those that exist). Entries are found by id (with
desk 'architect') wherever they sit (sceneEdits, props, library). Idempotent. Only the show text of those entries changes; every other byte stays.
"""
import json, os, re, sys

IDS = ['hdarchtrac']                               # yellow tracing-paper roll with its pulled-out sheet (desk top, left)
ROLLS = ['hdarchroll', 'evb37kaue']                # rolled drawings + the side cup holder they stand in (right side)
FILES = ('shots/13-subshots.json', 'review-cut.json', 'cut.json', 'director-film/hero.json',
         'director-film/hero-subshots.json', 'director-camera-hero.json')

def walk(node, where, ids, log):
    if isinstance(node, dict):
        show = node.get('show')
        if node.get('id') in ids and node.get('desk') == 'architect' and isinstance(show, dict):
            want = {k: v for k, v in show.items() if k != 'fadeIn'}
            want['from'] = 0
            if want != show:
                log.append('%s  %s show: %s -> %s' % (where, node['id'], json.dumps(show), json.dumps(want)))
                node['show'] = want
        for k, v in node.items():
            walk(v, where + '.' + k, ids, log)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, '%s[%d]' % (where, i), ids, log)

NUM = r'-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?'
def edit_text(raw, ids):
    """The same change as walk(), made in the text (the rest of the file stays byte for byte): in every object with
    one of the ids, its show {...} gets from 0 and loses its fadeIn member."""
    out, pos = [], 0
    for m in re.finditer(r'"id"\s*:\s*"(%s)"' % '|'.join(map(re.escape, ids)), raw):
        if m.start() < pos:
            continue
        nxt = re.search(r'"id"\s*:', raw[m.end():])
        stop = m.end() + nxt.start() if nxt else len(raw)
        sm = re.compile(r'"show"\s*:\s*\{[^{}]*\}').search(raw, m.end(), stop)
        if not sm:
            continue
        body = sm.group(0)
        body = re.sub(r'("from"\s*:\s*)' + NUM, lambda x: x.group(1) + '0', body, count=1)
        if re.search(r',\s*"fadeIn"', body):
            body = re.sub(r',\s*"fadeIn"\s*:\s*' + NUM, '', body, count=1)
        else:
            body = re.sub(r'"fadeIn"\s*:\s*' + NUM + r'\s*,\s*', '', body, count=1)
        out.append(raw[pos:sm.start()]); out.append(body); pos = sm.end()
    out.append(raw[pos:])
    return ''.join(out)

def main():
    args = sys.argv[1:]
    apply, ids = '--apply' in args, IDS + (ROLLS if '--with-rolls' in args else [])
    paths = []
    for a in [a for a in args if not a.startswith('--')]:
        if os.path.isdir(a):
            paths += [p for p in (os.path.join(a, f) for f in FILES) if os.path.isfile(p)]
        else:
            paths.append(a)
    if not paths:
        sys.exit(__doc__)
    total = 0
    for p in paths:
        raw = open(p, 'rb').read().decode('utf-8-sig')
        data, log = json.loads(raw), []
        walk(data, '$', ids, log)
        total += len(log)
        print('%s: %d change(s)' % (p, len(log)))
        for line in log:
            print('   ' + line)
        if log:
            text = edit_text(raw, ids)
            if json.loads(text) != data:      # the text edit must land exactly the structural change
                sys.exit('%s: text edit does not match the change; nothing written' % p)
            if apply:
                open(p, 'wb').write(text.encode('utf-8'))
    print(('applied' if apply else 'dry run, nothing written') + ': %d change(s)' % total)

if __name__ == '__main__':
    main()
