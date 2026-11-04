#!/usr/bin/env python3
"""Round 5 (HQ10) ch 4 commons: the desk drives straight to the head of the table without touching it.

    python3 tools/experience/build-round5-commons.py exports/cinematic-intro-20261103-hq10

Vico (round 5): in HQ9 the last move slid the desk 12.5 in to its own right into the white table, and the
app's room safety latched the red collision light; the glide itself showed no status light. Probed from
above (render-cut --list-objects): the first clip ends with the desk's front (keyboard side) facing world +x,
square to the electric wheelchair; motion z is world +x and motion x is world -z in this shot.
  - The last clip now drives forward only (motion z 120 -> 155, 35 in), finishing the turn to 90 deg: the
    desk lands at x 1.27..3.59, lined up with the table's head (1.35..3.51), 0.24 u (6 in) off its edge.
  - The wheelchair moves 0.7 u back (+x) so the desk stops ~20 in from it, still facing it.
  - One red glide light (wheels mode 3) for the whole move, 1.2-12.6 s.
  - Sub-line from /home/ergo/logs/copy_commons_round5_2026-11-03.md.
Values are absolute, so re-running is safe.
"""
import json, os, subprocess, sys
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SUB = 'Same table. Same project. Same team.'
cut = json.load(open(os.path.join(d, 'review-cut.json')))
i, s = next((i, x) for i, x in enumerate(cut['shots']) if x['id'] == 'commons')

first, last = s['motion']['clips'][0], s['motion']['clips'][1]
p0 = dict(first['target']); p1 = {'x': p0['x'], 'z': 155.0, 'yaw': 90.0}
smooth = lambda u: u * u * (3 - 2 * u)
n = 27
last.update(label='Drive to the table', start=9.8, duration=2.8, target=p1,
            path=[{'time': k / n, 'pose': {a: p0[a] + (p1[a] - p0[a]) * smooth(k / n) for a in ('x', 'z', 'yaw')}} for k in range(n + 1)])
s['ledStatus'] = [{'at': first['start'], 'dur': round(last['start'] + last['duration'] - first['start'], 3), 'kind': 'wheels', 'mode': 3}]
edits = [e for e in s.get('sceneEdits', []) if e.get('match') != '^Prop:electric-wheelchair$']
s['sceneEdits'] = edits + [{'match': '^Prop:electric-wheelchair$', 'position': [0.7, 0, 0]}]
s['detail'] = SUB
# The last two camera keys aim a little toward +x, so the wheelchair the desk now faces shares the frame.
for k in s['cameraPlan']['keys']:
    if abs(k['at'] - 12.6) < 1e-6: k['target'] = [2.75, 1.45, -11.55]
    if abs(k['at'] - 14) < 1e-6: k['target'] = [2.9, 1.40, -11.65]
f = os.path.join(d, 'shots', '04.json'); json.dump(s, open(f, 'w'), indent=1)
subprocess.run(['node', os.path.join(root, 'tools/experience/camera-spline.mjs'), f], check=True, stdout=subprocess.DEVNULL)
cut['shots'][i] = json.load(open(f))
json.dump(cut, open(os.path.join(d, 'review-cut.json'), 'w'))
t = json.load(open(os.path.join(d, 'titles-src.json')))
for c in t['titles']:
    if c['chapter'] == 'commons': c['detail'] = SUB
json.dump(t, open(os.path.join(d, 'titles-src.json'), 'w'), indent=1)
print('commons: drive forward 35 in to the table head (9.8-12.6), wheelchair +0.7 u, red glide light 1.2-12.6')
