#!/usr/bin/env python3
"""The alternate cut: Vico's hq14 review cut with people in the rooms (and the notes below), written beside it.

    python3 tools/experience/build-alt-cut.py <hq14 review-cut.json> <out review-cut.json>

Nothing in the source cut is changed. Each chapter gets `people` (room-people.mjs): who is in the room for this
chapter, and where a chapter's camera needs someone out of its path. Chapters on the dark product stage have no people.
"""
import json, sys

src, out = sys.argv[1], sys.argv[2]
cut = json.load(open(src))

PEOPLE = {
    # Home: Maya is at the desk when it is at sitting height; she fades as it rises and is back when it returns.
    'rise': {'only': ['people-maya-sit-type']},
    # Artist studio: Lin paints at the easel while the desk shows its tilt.
    'create': {'only': ['people-lin-stand-paint']},
    # Humboldt commons: Rosa, who is of short stature, works standing at the desk; students at the tables, people
    # crossing the hall.
    'commons': {'only': ['people-rosa-stand-type-30', 'people-leo-sit-write', 'people-zoe-sit-laptop', 'people-eli-sit-listen', 'people-zoe-walk', 'people-ben-white-cane', 'people-grace-cane-stand']},
    # OCC media lab: the other stations are in use; the featured desk stays free for the over-the-keyboard shots.
    'coast': {'except': ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type']},
    # High school: the whole class, minus the seat the camera flies through.
    'oilers': {'except': ['people-ava-sit-write']},
    # Gym: Maya works seated, then standing; Priya stretches by the mirrors, clear of the opening frame.
    'wellness': {'only': ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type', 'people-priya-stretch'],
                 'place': {'people-priya-stretch': {'at': [780, -1050], 'turn': 180}}},
    # Gaming room: a friend on the sofa; the desk's screen is the subject, so nobody sits in front of it.
    'music': {'only': ['people-kai-sit-controller']},
    # Workshop: Jo at the bench; Andre drives the fold-and-roll from his phone, back from the desk's path.
    'storage': {'only': ['people-jo-stand-work', 'people-andre-stand-phone'], 'place': {'people-andre-stand-phone': {'at': [900, 2300], 'turn': 215}}},
}
for shot in cut['shots']:
    if shot['id'] in PEOPLE: shot['people'] = PEOPLE[shot['id']]
    # "It sees what's in its way": the thing in the way is a person, not a pylon. Grace stands with her walking
    # stick where the pylon rose; the desk rolls toward her and stops.
    if shot['id'] == 'awareness' and shot.get('obstacles'):
        shot['obstacles'] = [dict(o, person='people-grace-cane-stand') if i == 0 else o for i, o in enumerate(shot['obstacles'])]
cut['name'] = (cut.get('name') or 'Review cut') + ' · alternate (people)'
json.dump(cut, open(out, 'w'), indent=1)
print('alternate cut:', out, {s['id']: bool(s.get('people')) for s in cut['shots']})
