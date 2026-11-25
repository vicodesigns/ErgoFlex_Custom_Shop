#!/usr/bin/env python3
"""Chapter 1's render source follows the Director import (polish1125 score, Nov 25 2026).

The film renders awaken from <cut>/previews/awaken-v5-cut.json (chapter-keys.py, render-request.sh) and the Director's film shot
(director-film/awaken.json) is made from it, but the pass (build-round8-director.py <cut>) wrote an awaken import's length,
camera, desk moves and status lights into review-cut.json only: Vico's 48.3 s chapter 1 stayed 44.85 s in the render and the
Director. On a SCRATCH copy of exports/cinematic-intro-cut-vicos-3rd-cut (the real cut is only read): with the preview made stale
(shorter, other camera keys, clips and status lights), the pass puts review-cut's awaken seconds / cameraPlan / camera / motion /
ledStatus into it, leaves its own sceneEdits / sceneGlobals / screens alone, rewrites no other file, and a second pass rewrites
nothing; the pages step then gives the Director the same chapter.
  python3 tests/director-awaken-preview-test.py"""
import hashlib, json, shutil, subprocess, sys, tempfile
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-vicos-3rd-cut'
if not (src / 'previews/awaken-v5-cut.json').is_file() or not (src / 'cut.json').is_file(): print('director-awaken-preview-test: skipped (no 3rd cut here)'); sys.exit(0)
tmp = Path(tempfile.mkdtemp(prefix='awaken-preview-')); cut = tmp / 'cut'; shutil.copytree(src, cut)
PV = cut / 'previews/awaken-v5-cut.json'
def J(p): return json.loads(p.read_text(encoding='utf-8'))
def run(*args):
    r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, encoding='utf-8', timeout=900)
    assert r.returncode == 0, r.stderr[-1500:]; return r.stdout
def digest(): return {str(p.relative_to(cut)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(cut.rglob('*.json')) if p.is_file()}
try:
    run()                                                     # the cut as the pass leaves it
    aw = J(cut / 'review-cut.json')['shots'][0]; assert aw['id'] == 'awaken'
    T = float(aw['seconds'])
    d = J(PV); s = d['shots'][0]
    s['seconds'] = round(T - 3.45, 3)                         # stale: the length, camera, moves and lights of an earlier chapter
    s['cameraPlan'] = dict(s['cameraPlan'], keys=[dict(k, at=round(k['at'] * (T - 3.45) / T, 3)) for k in aw['cameraPlan']['keys']][:-2])
    s['camera'] = {'stale': True}
    s['motion'] = dict(aw['motion'], clips=aw['motion']['clips'][:-1])
    s['ledStatus'] = [dict(e, at=round(e['at'] * 0.9, 3)) for e in aw.get('ledStatus', [])]
    own = {'sceneEdits': [{'match': '^Wheel_test$', 'material': {'color': '#123456'}}] + (s.get('sceneEdits') or []),
           'sceneGlobals': dict(s.get('sceneGlobals') or {}, testMarker=1), 'screens': [{'target': 'main-landscape', 'src': 'test/only-the-preview.mp4'}]}
    s.update(own)
    PV.write_text(json.dumps(d, indent=1), encoding='utf-8')
    before = digest()
    out = run()
    assert 'previews/awaken-v5-cut.json' in out, out[-1500:]
    got = J(PV)['shots'][0]; aw2 = J(cut / 'review-cut.json')['shots'][0]
    for k in ('seconds', 'cameraPlan', 'camera', 'motion', 'ledStatus'):
        assert got.get(k) == aw2.get(k), f'previews awaken {k} is not review-cut\'s after the pass'
    for k, v in own.items(): assert got.get(k) == v, f'previews awaken {k} (its own look) was changed by the pass'
    assert aw2 == aw, 'review-cut.json awaken changed'
    after = digest()
    changed = sorted(k for k in after if before.get(k) != after[k])
    assert changed == ['previews/awaken-v5-cut.json'] or changed == ['previews\\awaken-v5-cut.json'], changed
    run(); assert digest() == after, 'a second pass rewrote something'
    if shutil.which('python3'):
        run('--pages', 'awaken', '--downloads', str(cut / 'director-import'))
        f = J(cut / 'director-film/awaken.json')
        assert float(f['seconds']) == T and f['cameraPlan'] == aw2['cameraPlan'], 'the Director film shot is not the imported chapter'
        print(f'pages: director-film/awaken.json {T:g} s')
    else: print('pages step skipped (no python3 on PATH)')
    print(f'director-awaken-preview-test: OK (awaken {T:g} s, {len(aw2["cameraPlan"]["keys"])} camera keys, {len(aw2["motion"]["clips"])} clips into the render source)')
finally: shutil.rmtree(tmp, ignore_errors=True)
