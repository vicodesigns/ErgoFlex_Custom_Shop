#!/usr/bin/env python3
"""The Director's keyboard tray keys through the importer (build-round8-director.py, spec docs/keyboard-tray/SPEC.md 7.2).
clean_tray matches experience/tray-pose.mjs cleanTrayEdits (checked against node on the same inputs). On a SCRATCH copy of
exports/cinematic-intro-cut-vicos-3rd-cut in /tmp (the real cut is only read): an export whose shot has trayEdits keeps them in
director-camera-<id>.json as 'tray' and the pass writes them onto the chapter's film shot as sceneTray (hero: every sub-shot too);
an export without the field keeps them; [] keeps [] and takes sceneTray off the film shot; running the pass again rewrites nothing;
no other chapter's shot changes and no chapter without tray keys ever has the field.
  python3 tests/tray-import-test.py"""
import contextlib, io, json, shutil, subprocess, sys, tempfile, importlib.util, hashlib
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-vicos-3rd-cut'
if not (src / 'review-cut.json').is_file() or not (src / 'director-import').is_dir(): print('tray-import-test: skipped (no 3rd cut here)'); sys.exit(0)
tmp = Path(tempfile.mkdtemp(prefix='tray-import-')); cut = tmp / 'cut'; shutil.copytree(src, cut)
# (importing the module runs its pass: on the scratch copy)
spec = importlib.util.spec_from_file_location('b', BUILD); sys.argv = ['b', str(cut)]; b = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(b)

CASES = [None, 0, 'x', [], {}, [None, 3, 'x', {}], [{'keys': []}], [{'initial': {'tilt': 0}}],
    [{'keys': [{'t': 2, 'pose': {'tilt': -10, 'swing': 400, 'slide': 2, 'drop': 999}}]}],
    [{'desk': 'gaming', 'initial': {'tilt': 0, 'swing': 30.456}, 'keys': [{'t': 3, 'pose': {'tilt': 5}, 'ease': 'linear', 'label': ' Out '}, {'t': 1, 'pose': {'slide': 0.123456, 'junk': 1}, 'id': 'a'}, {'t': -1, 'pose': {'tilt': 1}}, {'t': 2, 'pose': {}}, {'t': 3.005, 'pose': {'swing': 20}, 'ease': 'smooth', 'route': 'direct'}, 'x', {'t': 'no', 'pose': {'tilt': 1}}, {'t': 2000, 'pose': {'tilt': 1}, 'id': 'a'}]}],
    [{'desk': 'BAD ID', 'keys': [{'t': 1, 'pose': {'tilt': 1}}]}, {'keys': [{'t': 2, 'pose': {'slide': 1}}]}, {'desk': 'gaming', 'keys': [{'t': 9, 'pose': {'tilt': -5}}]}, {'desk': 'gaming', 'keys': [{'t': 8, 'pose': {'tilt': -6}}]}],
    [{'keys': [{'t': i * 0.5, 'pose': {'tilt': (i % 7) - 3, 'drop': i}} for i in range(100)]}],
    [{'bracket': True}, {'desk': 'office', 'bracket': True, 'keys': [{'t': 1, 'pose': {'drop': 30}}]}, {'desk': 'gaming', 'bracket': False, 'keys': [{'t': 1, 'pose': {'tilt': 2}}]}],
    [{'bracket': 1, 'keys': [{'t': 1, 'pose': {'tilt': 2}}]}, {'desk': 'a', 'bracket': 'true', 'keys': [{'t': 1, 'pose': {'tilt': 2}}]}, {'desk': 'b', 'bracket': None, 'initial': {'swing': 5}}],
    [{'keys': [{'t': 1.0005, 'pose': {'tilt': 0.005}}, {'t': 2.0015, 'pose': {'swing': -0.004}}, {'t': 0.0004, 'pose': {'drop': 0.05}}, {'t': 3, 'pose': {'slide': 0.00005}}]}],
    [{'desk': 'd%d' % i, 'keys': [{'t': 1, 'pose': {'tilt': 1}}]} for i in range(30)]]
node = subprocess.run(['node', '--input-type=module', '-e', "import {cleanTrayEdits} from './experience/tray-pose.mjs';const c=JSON.parse(process.argv[1]);console.log(JSON.stringify(c.map(v=>cleanTrayEdits({trayEdits:v}).trayEdits??null)));", '--', json.dumps(CASES)], cwd=REPO, capture_output=True, text=True, timeout=60)
assert node.returncode == 0, node.stderr
for case, want in zip(CASES, json.loads(node.stdout)):
    got = b.clean_tray(case)
    if not isinstance(case, list): assert got == [] and want is None, (case, got, want); continue   # (the Director writes no field, the importer no edits)
    assert got == want, (case, got, want)

def page(name, ch, tray, drop=False):
    d = json.loads((cut / 'director-import' / f'ErgoFlex-film-ch{ch}-director.json').read_text())
    if tray is not None: d['shots'][0]['trayEdits'] = tray
    p = tmp / name; p.write_text(json.dumps(d)); return p
def run(*args):
    r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900); assert r.returncode == 0, r.stderr[-800:]; return r
def shots(): return {s['id']: s for s in json.loads((cut / 'review-cut.json').read_text())['shots']}
def sub(): return json.loads((cut / 'shots' / '13-subshots.json').read_text())['shots']
def dcam(cid): return json.loads((cut / f'director-camera-{cid}.json').read_text())
def digest():
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(cut.rglob('*')) if p.is_file() and p.suffix in ('.json',)}

run()                                                                       # the cut as the pass leaves it (a no-op on this cut)
base = shots(); base_sub = sub()
assert not any('sceneTray' in s for s in base.values()) and not any('sceneTray' in s for s in base_sub), 'no chapter has tray keys to begin with'
keys = [{'desk': 'gaming', 'bracket': True, 'keys': [{'t': 2, 'pose': {'swing': 90, 'slide': 0.3}, 'label': 'Side'}, {'t': 6, 'pose': {'swing': 0, 'slide': 0}, 'ease': 'linear'}]}]
want = b.clean_tray(keys); assert want[0]['keys'][0]['id'] == 'k1' and want[0]['keys'][1]['ease'] == 'linear' and want[0]['bracket'] is True

# an export without the field: nothing appears
run('--import', str(page('a.json', '08-awareness', None))); run()
assert 'tray' not in dcam('awareness') and 'sceneTray' not in shots()['awareness'], 'an export without the field: nothing appears'
after_a = digest()
# with keys: kept in the director file, written on the film shot (and only there)
run('--import', str(page('b.json', '08-awareness', keys))); r = run()
assert dcam('awareness')['tray'] == want, dcam('awareness').get('tray')
now = shots(); assert now['awareness']['sceneTray'] == want, now['awareness'].get('sceneTray')
for cid, s in now.items():
    if cid == 'awareness': continue
    assert s == base[cid], f'{cid} changed'        # every other chapter exactly as it was (so its chapter key is)
assert sub() == base_sub, 'only hero has sub-shots, and hero was not touched'
# the pass again: nothing is rewritten
d1 = digest(); run(); assert digest() == d1, 'the pass is a no-op the second time'
# an export without the field keeps them
run('--import', str(page('c.json', '08-awareness', None))); run(); assert dcam('awareness')['tray'] == want and shots()['awareness']['sceneTray'] == want
# [] keeps [] in the director file and takes the film's tray keys off
run('--import', str(page('d.json', '08-awareness', []))); run(); assert dcam('awareness')['tray'] == [] and 'sceneTray' not in shots()['awareness']
# hero: every sub-shot gets it (each desk's own keys are picked per sub-shot by the sampler)
run('--import', str(page('e.json', '12-hero', keys))); run()
assert shots()['hero']['sceneTray'] == want and sub() and all(s['sceneTray'] == want for s in sub() if s['id'] == 'hero'), 'hero and every sub-shot'
assert sum(1 for s in sub() if s['id'] == 'hero') >= 2, 'hero has sub-shots here'
run('--import', str(page('f.json', '12-hero', []))); run(); assert 'sceneTray' not in shots()['hero'] and not any('sceneTray' in s for s in sub())
shutil.rmtree(tmp, ignore_errors=True)
print('tray-import-test: ok (clean_tray = cleanTrayEdits on %d inputs; scratch copy of the 3rd cut: kept, written as sceneTray, hero sub-shots, absent keeps, [] removes, idempotent, other chapters untouched)' % len(CASES))
