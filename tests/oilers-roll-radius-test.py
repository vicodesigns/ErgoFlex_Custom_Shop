#!/usr/bin/env python3
"""exports/cinematic-intro-cut-cine/build-oilers-story.py: Kai's rolls never ask rollPlan (room-people-motion.mjs) for a
turning radius it would clamp. check_roll_radius stops the build when a corner would be rounded with less than the
radius given (rollPlan caps a corner's tangent at half of either leg), it passes the chapter's own paths, and the cut
carries exactly those paths and radii.

    python tests/oilers-roll-radius-test.py
"""
import importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('oilers_story', os.path.join(ROOT, 'exports', 'cinematic-intro-cut-cine', 'build-oilers-story.py'))
story = importlib.util.module_from_spec(spec); spec.loader.exec_module(story)

# a 90 degree corner whose second leg is only 160 mm: a 500 mm radius would be clamped to about 80 mm (the whip turn the
# reviewer of 217890f9 found)
try:
    story.check_roll_radius('short leg', [[0, 0], [0, 1000], [160, 1000]], 500)
    raise AssertionError('a clamped corner must stop the build')
except SystemExit as e:
    assert 'would clamp' in str(e) and 'corner 1' in str(e), e
# the same corner with legs long enough passes; so does a straight path
story.check_roll_radius('long legs', [[0, 0], [0, 1000], [1000, 1000]], 500)
story.check_roll_radius('straight', [[0, 0], [0, 1000], [0, 2000]], 500)
# the chapter's own rolls pass
story.check_roll_radius('Kai rolling in', story.AISLE, round(story.R2 * story.ROUND))
# and the cut carries them as written
cut = json.load(open(os.path.join(ROOT, 'exports', 'cinematic-intro-cut-cine', 'review-cut.json'), encoding='utf-8'))
cast = {c['key']: c for c in next(s for s in cut['shots'] if s['id'] == 'oilers')['people']['cast']}
assert cast['kai-rolls']['roll']['path'] == story.AISLE and cast['kai-rolls']['roll']['radius'] == round(story.R2 * story.ROUND)
assert 'kai-docks' not in cast   # (round 6: one roll, all the way in)
for key in ('kai-rolls',):
    r = cast[key]['roll']; story.check_roll_radius(key, r['path'], r['radius'])
# Kai docks heading the desk: the roll ends on the featured desk's own heading (turned with it, round 6), and the
# typing placement stands turned that way
import math
d = cast['kai-rolls']['roll']['path']
assert abs(math.degrees(math.atan2(d[-1][0] - d[-2][0], d[-1][1] - d[-2][1])) - cast['kai']['turn']) < 5, (d[-2:], cast['kai']['turn'])
assert cast['kai']['turn'] == 180 + story.MAIN[2] and cast['kai']['at'] == story.DOCK
# Noah's walk ends where (and, by walkPlan's endYaw from the next placement, room-people.mjs walkEnd, as) he pulls
w = cast['noah-steps']['walk']
assert w['path'][-1] == cast['noah-pulls']['at'] and w['then'] == cast['noah-pulls']['id']
# the room's desks where Vico saved them (rev 3478), and none of the stale Director offsets
shot = next(s for s in cut['shots'] if s['id'] == 'oilers')
assert shot['motion']['initial']['yaw'] == story.MAIN[2] and shot['sceneDeskEdits'] == story.ROOM_DESKS
assert not [e for e in shot['sceneEdits'] if story.stale(e)]
print('oilers roll radius: ok')
