#!/usr/bin/env python3
"""tools/experience/director-import-watch.py (19 Nov 2026: Vico's Create exports never reached his cut: nothing imported
them). In a scratch tree, with a stand-in for build-round8-director.py, then once with the real one on a copy of the
Cinematographer's cut:
  1. an export of a named cut (film-vicos-2nd-cut-create, the download name with a space and '(8)') goes to that cut:
     copied into <cut>/director-exports/export-<sha12>-<name>.json, then --import <copy>, the pass, --pages <chapter>
     --downloads <cut>/director-import, in that order; imports.json records it ok by the file's sha256
  2. the master (film-<chapter>, no cut.json) goes to $HQ
  3. a file seen once is taken only when it has stayed the same for a look (a download being written is not imported)
  4. not imported twice; a changed file is imported again
  5. not a client cut, a cut nobody has: rejected (logged, recorded nowhere, never retried until it changes)
  6. a failing build: imports.json records ok: false with the reason (the Director shows it); retried later
  7. --baseline-existing: the exports already there when it first starts are left alone
  8. the real build: a cine rise export with a prop edit lands in the cut's review-cut.json
  python3 tests/director-import-watch-test.py
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, base64, re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WATCH = REPO / 'tools/experience/director-import-watch.py'
tmp = Path(tempfile.mkdtemp(prefix='director-import-watch-'))
root, dl, calls = tmp / 'repo', tmp / 'Downloads', tmp / 'calls.txt'
for d in ('exports/cinematic-intro-cut-vicos-2nd-cut', 'exports/hq'): (root / d).mkdir(parents=True)
dl.mkdir()
(root / 'exports/cinematic-intro-cut-vicos-2nd-cut/cut.json').write_text(json.dumps({'id': 'vicos-2nd-cut', 'name': "Vico's 2nd cut"}))
for d in ('exports/cinematic-intro-cut-vicos-2nd-cut', 'exports/hq'): (root / d / 'review-cut.json').write_text('{"shots":[]}')
fake = tmp / 'fake-build.py'
fake.write_text("import sys,os\nopen(os.environ['CALLS'],'a').write(' '.join(sys.argv[1:])+'\\n')\n"
                "if os.environ.get('FAIL') and '--import' in sys.argv: print('director-bridge: the shot has no camera',file=sys.stderr); sys.exit(2)\n")
env = {**os.environ, 'DIRECTOR_IMPORT_ROOT': str(root), 'DIRECTOR_IMPORT_DIRS': str(dl), 'DIRECTOR_IMPORT_STATE': str(tmp / 'seen.json'),
       'DIRECTOR_IMPORT_LOCK': str(tmp / 'cut.lock'), 'HQ': 'exports/hq', 'DIRECTOR_IMPORT_BUILD': str(fake), 'CALLS': str(calls), 'DIRECTOR_IMPORT_POLL': '0.1', 'DIRECTOR_IMPORT_RETRY': '0'}
def run(*args, **extra):
    p = subprocess.run([sys.executable, str(WATCH), '--once', *args], env={**env, **extra}, capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    return p.stdout
def export(name, cid, chapter, extra=None):
    d = {'schema': 'ergoflex.client-cut', 'version': 1, 'id': cid, 'name': 'x', 'shots': [{'id': chapter, 'seconds': 23.5, **(extra or {})}]}
    p = dl / name; p.write_text(json.dumps(d, indent=2)); return p
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
cut = root / 'exports/cinematic-intro-cut-vicos-2nd-cut'
imports = lambda c: json.loads((c / 'director-exports/imports.json').read_text())
lines = lambda: calls.read_text().splitlines() if calls.exists() else []

# 7. baseline: what is there already stays alone
old = export('Film-chapter-create-23-5-s- (4).json', 'film-vicos-2nd-cut-create', 'create')
run('--baseline-existing'); assert not lines(), lines()
# 1. a named cut's export, a download name with a space and (8)
e8 = export('Film-chapter-create-23-5-s- (8).json', 'film-vicos-2nd-cut-create', 'create', {'propEdits': [{'match': 'Side shelf'}]})
out = run()
copy = cut / 'director-exports' / f'export-{sha(e8)[:12]}-Film-chapter-create-23-5-s-__8_.json'
assert copy.is_file() and copy.read_bytes() == e8.read_bytes(), 'the export is copied into the cut\'s director-exports'
rel = 'exports/cinematic-intro-cut-vicos-2nd-cut'
assert lines() == [f'{rel} --import {copy}', rel, f'{rel} --pages create --downloads {cut}/director-import'], lines()
rec = imports(cut)[sha(e8)]; assert rec['ok'] and rec['chapter'] == 'create' and rec['file'] == e8.name, rec
assert 'IMPORTED' in out and 'chapter=create' in out
# 4. not twice; a changed file again
run(); assert len(lines()) == 3, 'not imported twice'
e8.write_text(e8.read_text().replace('Side shelf', 'Side shelf · large')); run(); assert len(lines()) == 6 and imports(cut)[sha(e8)]['ok'], 'a changed export is imported again'
# 2. the master
m = export('Film-chapter-coast-14-5-s-.json', 'film-coast', 'coast'); run()
assert lines()[-3:] == [f'exports/hq --import {root}/exports/hq/director-exports/export-{sha(m)[:12]}-Film-chapter-coast-14-5-s-.json', 'exports/hq', f'exports/hq --pages coast --downloads {root}/exports/hq/director-import'], lines()[-3:]
# 5. rejected
n = len(lines()); (dl / 'Film-chapter-notes.json').write_text('{"hello": 1}'); export('Film-chapter-rise-18-s-.json', 'film-nobodys-cut-rise', 'rise')
out = run(); assert len(lines()) == n and out.count('REJECTED') == 2, out
assert "no cut folder has the id 'nobodys-cut'" in out and 'not a one-chapter Director export' in out
run(); assert len(lines()) == n, 'never retried until it changes'
# 3. a download still being written: seen once, not yet taken
p = dl / 'Film-chapter-create-23-5-s- (9).json'
subprocess.run([sys.executable, '-c', f"import json;open({str(p)!r},'w').write(json.dumps({{'schema':'ergoflex.client-cut','version':1,'id':'film-vicos-2nd-cut-create','shots':[{{'id':'create'}}]}}))"])
state = json.loads((tmp / 'seen.json').read_text()); state.pop(str(p), None); (tmp / 'seen.json').write_text(json.dumps(state))
import importlib.util
spec = importlib.util.spec_from_file_location('w', WATCH); os.environ.update(env); w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
st = json.loads((tmp / 'seen.json').read_text()); w.scan(st); assert st[str(p)]['status'] == 'observed' and len(lines()) == n, 'one look: only observed'
w.scan(st); assert st[str(p)]['status'] == 'imported' and len(lines()) == n + 3, 'the second look takes it'
# 6. a failing build
f = export('Film-chapter-create-23-5-s- (10).json', 'film-vicos-2nd-cut-create', 'create', {'n': 10})
out = run(FAIL='1'); r = imports(cut)[sha(f)]
assert r['ok'] is False and 'the shot has no camera' in r['error'] and 'FAILED' in out, (r, out)
run(); assert imports(cut)[sha(f)]['ok'] is True, 'retried, then imported'
assert old.exists() and sha(old) not in imports(cut), '(the baselined one never)'

# 8. the real build, on a copy of the Cinematographer's cut
src = REPO / 'exports/cinematic-intro-cut-cine'
if (src / 'review-cut.json').is_file() and (src / 'director-ch02-rise.html').is_file():
    real = tmp / 'real'; (real / 'exports').mkdir(parents=True); shutil.copytree(src, real / 'exports/cinematic-intro-cut-cine')
    m = re.search(r'#cut=([A-Za-z0-9_-]+)', (src / 'director-ch02-rise.html').read_text()); page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
    page['shots'][0]['propEdits'] = [{'match': '^Prop:monitor$', 'path': '', 'hide': True}]
    rdl = tmp / 'real-dl'; rdl.mkdir(); (rdl / 'Film-chapter-rise-18-s- (3).json').write_text(json.dumps(page, indent=2))
    p = subprocess.run([sys.executable, str(WATCH), '--once'], env={**env, 'DIRECTOR_IMPORT_ROOT': str(real), 'DIRECTOR_IMPORT_DIRS': str(rdl), 'DIRECTOR_IMPORT_STATE': str(tmp / 'real-seen.json'),
                       'DIRECTOR_IMPORT_BUILD': str(REPO / 'tools/experience/build-round8-director.py')}, capture_output=True, text=True, timeout=900)
    assert p.returncode == 0 and 'IMPORTED' in p.stdout, p.stdout + p.stderr
    rc = real / 'exports/cinematic-intro-cut-cine'
    rise = next(s for s in json.loads((rc / 'review-cut.json').read_text())['shots'] if s['id'] == 'rise')
    assert any(e.get('director') and e.get('hide') and 'monitor' in str(e.get('match')) for e in rise.get('sceneEdits') or []), 'the prop edit is in the cut'
    assert next(iter(imports(rc).values()))['ok']
    print('  (real build: the cine rise export with a prop edit is in the cut\'s review-cut.json)')
shutil.rmtree(tmp, ignore_errors=True)
print('director-import-watch-test: ok (named cut and master, the copy then import / pass / page under the lock, recorded by sha256; waits for a finished download; rejects and failures recorded)')
