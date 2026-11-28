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
    k = next((k for k in keys if abs(k['t'] - r['t']) < 1 / 60 - 1e-9), None)
    if k is None: k = {'t': round(r['t'], 3), 'pose': {}}; keys.append(k); added += 1
    for bone, d in r['turns'].items():
        if bone in ('hand_r', 'lowerarm_r', 'upperarm_r') and 'robot' in r['id']: raise SystemExit('tuner must not move the robot arm: ' + bone)
        base = k['pose'].get(bone, [0, 0, 0, 1])
        k['pose'][bone] = clean(qmul(base, d))
    keys.sort(key=lambda k: k['t'])
# the release (andre-lets-go, model stand-wait, 2.548-3.22 s): the shelf's last extra turns carried into its first key and
# eased out to none by its last key, as its right-arm keys already do (the drawn base is continuous at 2.548 s)
last = max((r for r in rows if r['id'] == 'people-andre-stand-robot-shelf'), key=lambda r: r['t'], default=None)
if last:
    lg = next(c for c in people['cast'] if c.get('key') == 'andre-lets-go')
    rec = lg['postures']['people-andre-stand-wait']; ks = sorted(rec['poseKeys'], key=lambda k: k['t'])
    first, final = ks[0], ks[-1]; assert abs(first['t'] - 2.548) < 1e-6 and abs(final['t'] - 3.22) < 1e-6, (first['t'], final['t'])
    for bone, d in last['turns'].items():
        if bone in ('hand_r', 'lowerarm_r', 'upperarm_r'): continue
        first['pose'][bone] = clean(qmul(first['pose'].get(bone, [0, 0, 0, 1]), d)); final['pose'].setdefault(bone, [0, 0, 0, 1])
    print('lets-go carries', len(last['turns']), 'bones from', last['t'])
print('keys added', added, 'merged', len(rows) - added)
if go:
    open(FILM, 'wb').write((dump(film) + film_tail).encode('utf8'))
    rc, rc_tail = load(RC); assert rc['shots'][10]['id'] == 'storage'; rc['shots'][10]['people'] = people
    open(RC, 'wb').write((dump(rc) + rc_tail).encode('utf8'))
    cam, cam_tail = load(CAM); v = cam['people'].get('v'); cam['people'] = dict(people);
    if v is not None: cam['people']['v'] = v
    open(CAM, 'wb').write((dump(cam) + cam_tail).encode('utf8'))
    print('wrote', FILM, RC, CAM)
