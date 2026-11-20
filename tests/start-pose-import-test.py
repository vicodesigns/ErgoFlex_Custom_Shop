#!/usr/bin/env python3
"""The Chapter tab's starting rotation (and X / Z) through the importer (build-round8-director.py, 19 Nov 2026), on a
scratch copy of the Cinematographer's cut, coast chapter: an export whose motion.initial yaw differs from the film's
keeps it in director-camera-coast.json and the pass writes it into the film's motion.initial (x / z untouched); an
export whose x / z / yaw are the film's own keeps none of them (a builder's later placement is never overridden by a
copy of its old one); height and tilt as before.
  python3 tests/start-pose-import-test.py"""
import base64, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-cine'
if not (src / 'review-cut.json').is_file(): print('start-pose-import-test: skipped (no cine cut here)'); sys.exit(0)
tmp = Path(tempfile.mkdtemp(prefix='start-pose-import-')); cut = tmp / 'cut'; shutil.copytree(src, cut)
m = re.search(r'#cut=([A-Za-z0-9_-]+)', next(cut.glob('director-ch*-coast.html')).read_text()); page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
film = lambda: next(s for s in json.loads((cut / 'review-cut.json').read_text())['shots'] if s['id'] == 'coast')['motion']['initial']
was = dict(film())
def run(initial, name):
    d = json.loads(json.dumps(page)); d['shots'][0]['motion']['initial'] = initial
    p = tmp / name; p.write_text(json.dumps(d))
    for args in (['--import', str(p)], []):
        r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900); assert r.returncode == 0, r.stderr[-800:]
    return json.loads((cut / 'director-camera-coast.json').read_text()).get('initial'), film(), r.stdout
kept, now, log = run({**was, 'yaw': (was.get('yaw') or 0) + 45}, 'a.json')
assert kept.get('yaw') == (was.get('yaw') or 0) + 45 and 'x' not in kept and 'z' not in kept, kept
assert now['yaw'] == (was.get('yaw') or 0) + 45 and now.get('x', 0) == was.get('x', 0) and now.get('z', 0) == was.get('z', 0), (now, was)
assert f"starting yaw {was.get('yaw', 0)} -> {now['yaw']}" in log, log[-600:]
kept, now, _ = run({**now}, 'b.json')
assert not any(k in kept for k in ('x', 'z', 'yaw')), 'the film\'s own x / z / yaw are not kept: ' + json.dumps(kept)
assert now['yaw'] == (was.get('yaw') or 0) + 45, 'and the film keeps the yaw it has'
shutil.rmtree(tmp, ignore_errors=True)
print('start-pose-import-test: ok (a starting rotation he set reaches the film; the film\'s own x / z / yaw are never copied back)')
