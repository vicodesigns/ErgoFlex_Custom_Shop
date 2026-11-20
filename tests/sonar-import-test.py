#!/usr/bin/env python3
"""The Director's Sonar through the importer (build-round8-director.py, 19 Nov 2026): clean_sonar matches
experience/sonar.mjs cleanSonar (checked against node on the same inputs); on a scratch copy of the Cinematographer's cut,
awareness chapter, an export with sonar keeps it (cleaned) in director-camera-awareness.json and the pass writes it onto the
film shot; an export without the field keeps it; an export with {} (put back to the film's) takes it off the film shot.
  python3 tests/sonar-import-test.py"""
import base64, json, re, shutil, subprocess, sys, tempfile, importlib.util
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-cine'
if not (src / 'review-cut.json').is_file(): print('sonar-import-test: skipped (no cine cut here)'); sys.exit(0)
spec = importlib.util.spec_from_file_location('b', BUILD); sys.argv = ['b', str(src)]; b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
CASES = [None, 0, 'x', [], True, {}, {'enabled': True, 'rings': 3, 'x': 0, 'z': 0}, {'enabled': False}, {'radius': 96.04, 'rings': 5, 'x': -12.26, 'z': 7},
         {'radius': 1, 'rings': 99}, {'radius': 9999, 'rings': 0, 'x': 1e9, 'z': -1e9}, {'rings': 2.6, 'junk': 1, 'preview': True}, {'rings': 4.4},
         {'radius': '60', 'rings': None, 'x': 1e308, 'z': None, 'enabled': 'no'}, {'radius': 12.25, 'x': -12.25, 'z': 0.05}, {'radius': 60, 'rings': 2.5}]
node = subprocess.run(['node', '--input-type=module', '-e', "import {cleanSonar} from './experience/sonar.mjs';const c=JSON.parse(process.argv[1]);console.log(JSON.stringify(c.map(v=>cleanSonar(v)||{})));", '--', json.dumps(CASES)],
                      cwd=REPO, capture_output=True, text=True, timeout=60)
assert node.returncode == 0, node.stderr
for case, want in zip(CASES, json.loads(node.stdout)):
    assert b.clean_sonar(case) == want, (case, b.clean_sonar(case), want)
tmp = Path(tempfile.mkdtemp(prefix='sonar-import-')); cut = tmp / 'cut'; shutil.copytree(src, cut)
m = re.search(r'#cut=([A-Za-z0-9_-]+)', next(cut.glob('director-ch*-awareness.html')).read_text()); page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
def run(sonar, name):
    d = json.loads(json.dumps(page))
    if sonar is not None: d['shots'][0]['sonar'] = sonar
    p = tmp / name; p.write_text(json.dumps(d))
    for args in (['--import', str(p)], []):
        r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900); assert r.returncode == 0, r.stderr[-800:]
    dc = json.loads((cut / 'director-camera-awareness.json').read_text())
    return dc.get('sonar'), next(s for s in json.loads((cut / 'review-cut.json').read_text())['shots'] if s['id'] == 'awareness').get('sonar')
kept, film = run(None, 'a.json'); assert kept is None and film is None, 'an export without the field: nothing appears'
want = {'radius': 84, 'rings': 5, 'x': 6, 'z': -2.5}
kept, film = run({**want, 'rings': 5, 'preview': True}, 'b.json'); assert kept == want and film == want, (kept, film)
kept, film = run(None, 'c.json'); assert kept == want and film == want, 'an export without the field keeps it'
kept, film = run({}, 'd.json'); assert kept == {} and film is None, 'put back to the film\'s takes it off the film'
shutil.rmtree(tmp, ignore_errors=True)
print('sonar-import-test: ok')
