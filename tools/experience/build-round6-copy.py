#!/usr/bin/env python3
"""Round 6 (HQ11) copy and card timing, from the final expert panel.

    python3 tools/experience/build-round6-copy.py exports/cinematic-intro-20261103-hq11

/home/ergo/logs/final_review_copy_2026-11-04.md and final_review_content_2026-11-04.md. Vico's lines stay
("A place for everyone.", "Let's build yours." with a typographic apostrophe). Values are absolute.
"""
import json, os, sys
d = sys.argv[1]
J = lambda n: os.path.join(d, n)
# (chapter, field, old title for matching or None, new value)
TEXT = [('awaken', 'detail', 'Safe for everyone around it.', 'Light and sound tell the room when it moves.'),  # content: no triple "everyone"
        ('create', 'detail', None, 'From drafting to digital painting. Everything within reach.'),        # copy: "art" twice; screens show painting
        ('oilers', 'title', None, 'Space to discover.'),                                                    # copy: three titles used "room"
        ('wellness', 'detail', None, 'Pause. Stretch. Breathe. Reset.'),                                    # copy: the screen is a stretch guide
        ('storage', 'detail', None, 'One tap: fold to 65°, roll to the wall.')]                            # content: app control unnamed; copy: it rolls to the wall
TIMING = {'commons': (2.4, 8.2), 'awareness': (3.6, 9.8), 'storage': (2.6, 9.6), 'oilers': (None, 9.3)}   # copy: cards over what they describe
src = json.load(open(J('titles-src.json'))); cut = json.load(open(J('review-cut.json')))
for ch, field, title, new in TEXT:
    for t in src['titles']:
        if t['chapter'] == ch and (title is None or t['title'] == title): t[field] = new
    for s in cut['shots']:                       # the shot's own title/detail mirror the chapter's main card
        if s['id'] == ch and ch != 'awaken': s[field] = new
for ch, (a, b) in TIMING.items():
    t = next(t for t in src['titles'] if t['chapter'] == ch)
    if a is not None: t['rel_in'] = a
    t['rel_out'] = b
src['cta']['text'] = 'Let’s build yours.'
json.dump(src, open(J('titles-src.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(cut, open(J('review-cut.json'), 'w'))
print('copy:', '; '.join(f'{c} {f}' for c, f, _, _ in TEXT), '| timing:', ', '.join(TIMING), '| CTA apostrophe')
