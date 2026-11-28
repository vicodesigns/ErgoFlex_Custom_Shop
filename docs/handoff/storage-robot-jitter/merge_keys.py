"""Merge tune-hands.mjs results (extra turns per bone at key times) into the storage people block, in every 3rd-cut store.
usage: python merge_keys.py tune.json [more.json ...] [--go]   (run from the worktree root)
Each tuned bone's key value = (its keyed turn at that time, if any) x (extra turn). The tuned bones have no keys of their own
in these postures today, so the value is the extra turn itself; an existing key within 1/60 s is merged, else a key is added."""
import json, sys, math

FILM = 'exports/cinematic-intro-cut-vicos-3rd-cut/director-film/storage.json'
RC = 'exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json'
CAM = 'exports/cinematic-intro-cut-vicos-3rd-cut/director-camera-storage.json'
args = [a for a in sys.argv[1:] if a != '--go']; go = '--go' in sys.argv

def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return [aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz]

def clean(q):
    n = math.sqrt(sum(c*c for c in q)); s = (-1 if q[3] < 0 else 1) / n
    u = [round(c*s, 4) + 0.0 for c in q]
    return [0, 0, 0, 1] if math.hypot(u[0], u[1], u[2]) < 1e-4 else u

def slerp(a, b, t):
    d = sum(x*y for x, y in zip(a, b))
    if d < 0: b = [-x for x in b]; d = -d
    if d > 0.9995: q = [x + t*(y - x) for x, y in zip(a, b)]
    else:
        th = math.acos(d); s0 = math.sin((1-t)*th)/math.sin(th); s1 = math.sin(t*th)/math.sin(th); q = [s0*x + s1*y for x, y in zip(a, b)]
    n = math.sqrt(sum(x*x for x in q)); return [x/n for x in q]

def value_at(keys, bone, t):   # people-pose-keys.mjs: per bone, between the keys that name it (smooth by default; hold)
    named = sorted((k for k in keys if bone in k['pose']), key=lambda k: k['t'])
    if not named: return [0, 0, 0, 1]
    before = [k for k in named if k['t'] <= t + 1e-9]; after = [k for k in named if k['t'] > t + 1e-9]
    if not before: return named[0]['pose'][bone]
    if not after: return before[-1]['pose'][bone]
    a, b = before[-1], after[0]; u = (t - a['t']) / (b['t'] - a['t']); e = a.get('ease', 'smooth')
    u = 0 if e == 'hold' else u if e == 'linear' else u*u*(3 - 2*u)
    return slerp(a['pose'][bone], b['pose'][bone], u)

def dump(o): return json.dumps(o, indent=1).replace('\n', '\r\n')

def load(path):
    raw = open(path, 'rb').read().decode('utf8'); d = json.loads(raw); tail = raw[len(raw.rstrip()):]
    assert dump(d) + tail == raw, 'round trip differs: ' + path
    return d, tail

film, film_tail = load(FILM)
people = film['people']
rows = []
for a in args: rows += json.load(open(a, encoding='utf8'))['results']
added = 0
for r in rows:
    rec = next((c['postures'][r['id']] for c in people['cast'] if r['id'] in (c.get('postures') or {})), None)
    assert rec is not None, r['id']
    keys = rec.setdefault('poseKeys', [])
    k = next((k for k in keys if abs(k['t'] - r['t']) < 1e-3), None)
    assert all(abs(x['t'] - r['t']) >= 1 / 60 - 1e-9 for x in keys if x is not k), ('keys nearer than 1/60 s merge in the Director', r['t'])
    if k is None: k = {'t': round(r['t'], 3), 'pose': {}}; keys.append(k); added += 1
    for bone, d in r['turns'].items():
        if bone in ('hand_r', 'lowerarm_r', 'upperarm_r') and 'robot' in r['id']: raise SystemExit('tuner must not move the robot arm: ' + bone)
        base = k['pose'][bone] if bone in k['pose'] else value_at(keys, bone, k['t'])
        k['pose'][bone] = clean(qmul(base, d))
    keys.sort(key=lambda k: k['t'])
# the release (andre-lets-go, model stand-wait, 2.548-3.22 s): the shelf's last extra turns carried into its first key and
# eased out to none by its last key, as its right-arm keys already do (the drawn base is continuous at 2.548 s)
last = max((r for r in rows if r['id'] == 'people-andre-stand-robot-shelf'), key=lambda r: r['t'], default=None)
if last and last['t'] > 2.5:   # (only the shelf's final key, 2.533 s, hands over to the release)
    lg = next(c for c in people['cast'] if c.get('key') == 'andre-lets-go')
    rec = lg['postures']['people-andre-stand-wait']; ks = sorted(rec['poseKeys'], key=lambda k: k['t'])
    first, final = ks[0], ks[-1]; assert abs(first['t'] - 2.548) < 1e-6 and abs(final['t'] - 3.22) < 1e-6, (first['t'], final['t'])
    for bone, d in last['turns'].items():
        if bone in ('hand_r', 'lowerarm_r', 'upperarm_r'): continue
        first['pose'][bone] = clean(qmul(first['pose'].get(bone, [0, 0, 0, 1]), d)); final['pose'].setdefault(bone, [0, 0, 0, 1])
    print('lets-go carries', len(last['turns']), 'bones from', last['t'])
# a bone keyed only by the new release keys must end eased out (none) at the release's last key, not hold
lg = next(c for c in people['cast'] if c.get('key') == 'andre-lets-go')['postures']['people-andre-stand-wait']['poseKeys']
lg.sort(key=lambda k: k['t'])
for b in set(b for k in lg for b in k['pose']): lg[-1]['pose'].setdefault(b, [0, 0, 0, 1])
print('keys added', added, 'merged', len(rows) - added)
if go:
    open(FILM, 'wb').write((dump(film) + film_tail).encode('utf8'))
    rc, rc_tail = load(RC); assert rc['shots'][10]['id'] == 'storage'; rc['shots'][10]['people'] = people
    open(RC, 'wb').write((dump(rc) + rc_tail).encode('utf8'))
    cam, cam_tail = load(CAM); v = cam['people'].get('v'); cam['people'] = dict(people);
    if v is not None: cam['people']['v'] = v
    open(CAM, 'wb').write((dump(cam) + cam_tail).encode('utf8'))
    print('wrote', FILM, RC, CAM)
