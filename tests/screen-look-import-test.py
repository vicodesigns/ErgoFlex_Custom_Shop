#!/usr/bin/env python3
"""The screen look through the importer (build-round8-director.py, 19 Nov 2026), on a scratch copy of the
Cinematographer's cut, coast chapter: an export with screenLook keeps it (cleaned) in director-camera-coast.json and the
pass writes it onto the film shot; an export without the field keeps it; an export with {} (Reset every screen) takes it
off the film shot; clean_screen_look matches experience/screen-look.mjs (defaults dropped, clamped, bad targets out).
  python3 tests/screen-look-import-test.py"""
import base64, json, re, shutil, subprocess, sys, tempfile, importlib.util
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-cine'
if not (src / 'review-cut.json').is_file(): print('screen-look-import-test: skipped (no cine cut here)'); sys.exit(0)
spec = importlib.util.spec_from_file_location('b', BUILD); sys.argv = ['b', str(src)]; b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
assert b.clean_screen_look({'all': {'brightness': 1, 'contrast': 1}, 'per': {'x': {}}}) == {}, 'nothing that changes anything'
assert b.clean_screen_look({'all': {'brightness': .55, 'black': .9, 'saturation': 'x'}, 'per': {'main-landscape': {'warmth': -2}, 'bad\x00': {'glare': .5}}}) == {'all': {'brightness': .55, 'black': .25}, 'per': {'main-landscape': {'warmth': -1}}}
tmp = Path(tempfile.mkdtemp(prefix='screen-look-import-')); cut = tmp / 'cut'; shutil.copytree(src, cut)
m = re.search(r'#cut=([A-Za-z0-9_-]+)', next(cut.glob('director-ch*-coast.html')).read_text()); page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
def run(look, name):
    d = json.loads(json.dumps(page))
    if look is not None: d['shots'][0]['screenLook'] = look
    p = tmp / name; p.write_text(json.dumps(d))
    for args in (['--import', str(p)], []):
        r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900); assert r.returncode == 0, r.stderr[-800:]
    dc = json.loads((cut / 'director-camera-coast.json').read_text())
    return dc.get('screenLook'), next(s for s in json.loads((cut / 'review-cut.json').read_text())['shots'] if s['id'] == 'coast').get('screenLook')
kept, film = run({'all': {'brightness': .6, 'black': .04, 'contrast': 1}, 'per': {'main-landscape': {'saturation': .7}}}, 'a.json')
want = {'all': {'brightness': .6, 'black': .04}, 'per': {'main-landscape': {'saturation': .7}}}
assert kept == want and film == want, (kept, film)
kept, film = run(None, 'b.json'); assert kept == want and film == want, 'an export without the field keeps it'
kept, film = run({}, 'c.json'); assert kept == {} and film is None, 'Reset every screen takes it off the film'
shutil.rmtree(tmp, ignore_errors=True)
print('screen-look-import-test: ok (kept in the director file, written onto the film shot, kept without the field, removed by a reset)')
