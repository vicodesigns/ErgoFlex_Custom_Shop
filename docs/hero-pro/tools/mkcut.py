# usage: python mkcut.py <base 13-subshots.json> <plan.json> <out cut.json> [--lights lights.json] [--motion motion.json]
# Iteration renders only (the delivered data goes through the importer, see README): the hero's sub-shots with the plan's
# length + camera (baked with the repo's camera-spline.mjs), the last sub-shot running to the new length, and optionally the
# lights list / motion clips of a candidate.
import json, sys, subprocess, tempfile, os
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
a = sys.argv[1:]
def opt(k):
    if k in a: i = a.index(k); v = a[i + 1]; del a[i:i + 2]; return v
lights_f, motion_f = opt('--lights'), opt('--motion')
base, planf, out = a
sub = json.load(open(base, encoding='utf-8')); plan = json.load(open(planf, encoding='utf-8'))
T = plan['seconds']
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
    json.dump({'seconds': T, 'cameraPlan': plan['cameraPlan']}, t); tmp = t.name
subprocess.run(['node', os.path.join(REPO, 'tools', 'experience', 'camera-spline.mjs'), tmp], check=True, stdout=subprocess.DEVNULL)
cam = json.load(open(tmp))['camera']; os.unlink(tmp)
lights = json.load(open(lights_f)) if lights_f else None
motion = json.load(open(motion_f)) if motion_f else None
last = max(s['renderRange'][1] for s in sub['shots'])
for s in sub['shots']:
    s['seconds'] = T; s['cameraPlan'] = plan['cameraPlan']; s['camera'] = cam
    if abs(s['renderRange'][1] - last) < 1e-6: s['renderRange'] = [s['renderRange'][0], T]
    if lights is not None: s['lights'] = lights
    if motion is not None: s['motion'] = motion
json.dump(sub, open(out, 'w', encoding='utf-8'))
print(out, T, 's', len(cam['keys']), 'baked keys', [s['renderRange'] for s in sub['shots']])
