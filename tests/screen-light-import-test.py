#!/usr/bin/env python3
"""The screen light through the importer (build-round8-director.py, 21 Nov 2026; docs/screen-reflection/CONTRACT.md), on a
scratch copy of Vico's 3rd cut, chapter 10 (media): an export with sceneGlobals.screenLight keeps it (cleaned) in
director-camera-media.json 'lighting' and the pass writes it into the film shot's sceneGlobals; an export without the
field keeps the film's; an export with {} (reset) takes it off the film shot; clean_screen_light matches
experience/screen-light.mjs (defaults dropped, clamped, hex lower-cased, junk out).
  python3 tests/screen-light-import-test.py [cut dir]   (the scratch copy is made outside the repo, in the temp folder)"""
import base64, json, os, re, shutil, subprocess, sys, tempfile, importlib.util
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / 'exports/cinematic-intro-cut-vicos-3rd-cut'
if not (src / 'review-cut.json').is_file(): print('screen-light-import-test: skipped (no 3rd cut here)'); sys.exit(0)
# Loaded for clean_screen_light only: an unknown argument makes the script's main exit (with no argument it would run
# the pass on <src> itself) after every function is defined.
spec = importlib.util.spec_from_file_location('b', BUILD); sys.argv = ['b', str(src), '--load-only']; b = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(b)
except SystemExit: pass
assert b.clean_screen_light({'gain': 1, 'saturation': 1, 'contrast': 1, 'tint': '#FFFFFF', 'keepHue': False}) == {}, 'all defaults'
assert b.clean_screen_light({'gain': 9, 'saturation': -1, 'contrast': .25, 'tint': '#FFAA00', 'keepHue': True, 'x': 1}) == {'gain': 3, 'saturation': 0, 'contrast': .5, 'tint': '#ffaa00', 'keepHue': True}
assert b.clean_screen_light({'gain': '0.5', 'tint': 'red', 'keepHue': 1}) == {}, 'junk out'
assert b.clean_screen_light(None) is None and b.clean_screen_light([]) is None
tmp = Path(tempfile.mkdtemp(prefix='screen-light-import-')); cut = tmp / 'cut'; shutil.copytree(src, cut, ignore=shutil.ignore_patterns('*.mp4'))
m = re.search(r'#cut=([A-Za-z0-9_-]+)', next(cut.glob('director-ch*-media.html')).read_text(encoding='utf-8'))
page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
film0 = next(s for s in json.loads((cut / 'review-cut.json').read_text(encoding='utf-8'))['shots'] if s['id'] == 'media')
def film(): return next(s for s in json.loads((cut / 'review-cut.json').read_text(encoding='utf-8'))['shots'] if s['id'] == 'media')
def run(light, name):
    d = json.loads(json.dumps(page))
    if light is not None: d['shots'][0]['sceneGlobals'] = {**(d['shots'][0].get('sceneGlobals') or {}), 'screenLight': light}
    p = tmp / name; p.write_text(json.dumps(d), encoding='utf-8')
    for args in (['--import', str(p)], []):
        r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900, encoding='utf-8'); assert r.returncode == 0, r.stderr[-1500:]
    dc = json.loads((cut / 'director-camera-media.json').read_text(encoding='utf-8'))
    return (dc.get('lighting') or {}).get('screenLight', 'absent'), (film().get('sceneGlobals') or {}).get('screenLight', 'absent')
log = {'export_sceneGlobals_screenLight': {'gain': .6, 'saturation': 1.4, 'contrast': 1, 'tint': '#FFF0E0', 'keepHue': True}}
kept, f = run(log['export_sceneGlobals_screenLight'], 'a.json')
want = {'gain': .6, 'saturation': 1.4, 'tint': '#fff0e0', 'keepHue': True}
assert kept == want and f == want, (kept, f)
log['director_camera_lighting_screenLight'] = kept; log['film_shot_sceneGlobals_screenLight'] = f
kept, f = run(None, 'b.json'); assert f == want, ('an export without the field keeps the film\'s', kept, f)
kept, f = run({}, 'c.json'); assert kept == {} and f == 'absent', ('a reset takes it off the film', kept, f)
others = {k: v for k, v in film().items() if k not in ('sceneGlobals', 'directorEdited')}
before = {k: v for k, v in film0.items() if k not in ('sceneGlobals', 'directorEdited')}
log['other_fields_unchanged'] = others == before
log['film_sceneGlobals_after_reset'] = film().get('sceneGlobals')
if os.environ.get('SCREEN_LIGHT_LOG'): Path(os.environ['SCREEN_LIGHT_LOG']).write_text(json.dumps(log, indent=1), encoding='utf-8')
shutil.rmtree(tmp, ignore_errors=True)
print('screen-light-import-test: ok (kept in the director file, written into the film shot\'s sceneGlobals, kept without the field, removed by a reset)', json.dumps(log))
