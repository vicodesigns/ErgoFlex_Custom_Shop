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
story.check_roll_radius('Kai rolling in', story.AISLE, round(story.R1 * story.ROUND))
story.check_roll_radius('Kai docking', story.DOCK_PATH, round(story.R2 * story.ROUND))
# and the cut carries them as written
cut = json.load(open(os.path.join(ROOT, 'exports', 'cinematic-intro-cut-cine', 'review-cut.json'), encoding='utf-8'))
cast = {c['key']: c for c in next(s for s in cut['shots'] if s['id'] == 'oilers')['people']['cast']}
assert cast['kai-rolls']['roll']['path'] == story.AISLE and cast['kai-rolls']['roll']['radius'] == round(story.R1 * story.ROUND)
assert cast['kai-docks']['roll']['path'] == story.DOCK_PATH and cast['kai-docks']['roll']['radius'] == round(story.R2 * story.ROUND)
for key in ('kai-rolls', 'kai-docks'):
    r = cast[key]['roll']; story.check_roll_radius(key, r['path'], r['radius'])
# Noah's walk to the corner ends on a leg longer than walkPlan's 0.35 m heading blend, along the way the pull faces
import math
w = cast['noah-steps']['walk']['path']; last = math.dist(w[-2], w[-1])
assert last > 350, last
assert abs(math.degrees(math.atan2(w[-1][0] - w[-2][0], w[-1][1] - w[-2][1])) - cast['noah-pulls']['turn']) < .5
print('oilers roll radius: ok')
