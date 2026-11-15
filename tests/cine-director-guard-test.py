"""The cut's generators leave what the Director edited alone (exports/cinematic-intro-cut-cine/director_guard.py).
   python3 tests/cine-director-guard-test.py"""
import copy, json, os, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'exports', 'cinematic-intro-cut-cine')
sys.path.insert(0, CUT)
from director_guard import clashes, guard, FLAG

cut = json.load(open(os.path.join(CUT, 'review-cut.json'), encoding='utf-8'))
oil = lambda c: next(s for s in c['shots'] if s['id'] == 'oilers')
after = copy.deepcopy(cut); oil(after)['seconds'] = 99; oil(after)['people']['cast'][0]['at'] = [1, 2]
assert clashes(cut, after) == [], 'a chapter the Director never touched is the generator\'s'
marked = copy.deepcopy(cut); oil(marked)['directorEdited'] = {'at': '2026-11-15T20:00:00Z', 'fields': ['people']}
assert clashes(marked, after) == [('oilers', ['people'])], 'only the fields he edited are his'
assert clashes(marked, marked) == []
whole = copy.deepcopy(cut); oil(whole)['directorEdited'] = {'at': 'x'}
assert clashes(whole, after) == [('oilers', ['people', 'seconds'])], 'no field list: the whole chapter'
assert guard(marked, after, ['x', FLAG]) == [('oilers', ['people'])], 'the flag lets it through'
try: guard(marked, after, ['x'], who='test'); raise AssertionError('must stop')
except SystemExit as e: assert 'oilers: people' in str(e) and 'Nothing was written' in str(e)

# The real generators on a copy of the cut: a Director edit of Noah's path survives a run; the run says why it stopped.
tmp = tempfile.mkdtemp(prefix='cine-guard-')
try:
    dst = os.path.join(tmp, 'exports', 'cinematic-intro-cut-cine'); os.makedirs(dst)
    for name in ('build-oilers-story.py', 'director_guard.py'): shutil.copy(os.path.join(CUT, name), dst)
    edited = copy.deepcopy(cut); o = oil(edited)
    noah = next(c for c in o['people']['cast'] if c['key'] == 'noah-steps'); noah['walk']['path'][1] = [-2800, -950]
    o['directorEdited'] = {'at': '2026-11-15T20:00:00Z', 'fields': ['people']}
    raw = json.dumps(edited, indent=1).encode(); open(os.path.join(dst, 'review-cut.json'), 'wb').write(raw)
    run = lambda *a: subprocess.run([sys.executable, os.path.join(dst, 'build-oilers-story.py'), *a], capture_output=True, text=True)
    r = run(); assert r.returncode != 0 and 'oilers: people' in r.stderr, r.stderr
    assert open(os.path.join(dst, 'review-cut.json'), 'rb').read() == raw, 'nothing was written'
    r = run(FLAG); assert r.returncode == 0, r.stderr
    back = json.load(open(os.path.join(dst, 'review-cut.json'), encoding='utf-8'))
    assert next(c for c in oil(back)['people']['cast'] if c['key'] == 'noah-steps')['walk']['path'][1] != [-2800, -950], 'with the flag the generator wins'
finally:
    shutil.rmtree(tmp)
print('cine director guard: untouched chapters are the generators\', edited fields are his, the flag overrides, build-oilers-story stops and writes nothing: OK')
