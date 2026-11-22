#!/usr/bin/env python3
"""Screen clips whose source is not on this machine are kept, not dropped (21 Nov 2026, the movie's edit list,
docs/screen-edit-list/CONTRACT.md section 7 item 2). build-round8-director.py's film_list() wrote the Director's film
shot with every screens entry whose src local_clip() could not find dropped: with an edit list that silently deleted
clips, and the next Export cut wrote the shorter list into the film. Now:
  local_screens   keeps such an entry (src as it was, missing: true) and names it on stderr; a clip that is here gets its
                  local path and no flag (a stale flag from before is taken off)
  export_screens  the import takes the flag off again (the film never carries it); run_import applies it
  film_list       uses local_screens for the chapter shot, the hero sub-shots and the version library
and the Director's live stage / Render still skip a missing clip with the other screens' targets pinned
(experience/film-chapters.mjs, film-render.mjs).
  python3 tests/screen-missing-import-test.py"""
import contextlib, io, importlib.util, json, re, subprocess, sys
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = REPO / 'exports/cinematic-intro-cut-vicos-3rd-cut'
spec = importlib.util.spec_from_file_location('b', BUILD); sys.argv = ['b', str(src), '--load-only']; b = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(b)
except SystemExit: pass
HERE = 'divi-editor/upload-to-promo/' + next(p.name for p in (REPO / 'divi-editor/upload-to-promo').glob('*.mp4'))   # a clip in git: on every machine
GONE = 'exports/nowhere/screens/not-here-20261121.mp4'
movie = [{'target': 'main-landscape', 'src': HERE, 'start': 0, 'end': 6, 'offset': 40, 'brightness': .9},
         {'target': 'main-landscape', 'src': GONE, 'start': 6, 'end': 11.5, 'offset': 70, 'transitionIn': {'type': 'dissolve', 'dur': 1}},
         {'target': 'main-landscape', 'src': HERE, 'start': 11.5, 'end': 17, 'offset': 12, 'missing': True}]
err = io.StringIO()
with contextlib.redirect_stderr(err): out = b.local_screens(movie, 'media')
assert len(out) == 3, 'nothing dropped'
assert out[0] == movie[0], 'a clip that is here: as it was'
assert out[1] == dict(movie[1], missing=True), ('the missing clip kept, src and transition as they were, flagged', out[1])
assert 'missing' not in out[2] and out[2]['src'] == HERE, 'a stale flag on a clip that is here: off'
assert GONE in err.getvalue() and 'media' in err.getvalue(), 'named on stderr: ' + err.getvalue()
assert movie[1].get('missing') is None, 'the input is not changed'
assert b.export_screens(out) == [movie[0], movie[1], {k: v for k, v in movie[2].items() if k != 'missing'}], 'the import takes the flag off'
assert b.export_screens(None) is None and b.export_screens([1, {'src': 'a'}]) == [{'src': 'a'}]
code = BUILD.read_text(encoding='utf-8')
fl = code[code.index('def film_list('):code.index('\ndef ', code.index('def film_list(') + 10)]
assert fl.count('local_screens(') == 3 and 'local_clip(' not in fl, 'film_list: the chapter, the hero sub-shots and the version library all keep missing clips'
assert re.search(r"if 'screens' in lighting: lighting\['screens'\] = export_screens\(lighting\['screens'\]\)", code), 'run_import strips the flag'
# the Director side (node): a missing clip is not played, the other screens keep their targets
js = r"""
import {liveFilmShot} from './experience/film-chapters.mjs';import {filmRenderShot} from './experience/film-render.mjs';
const screens=[{src:'a.mp4'},{src:'gone.mp4',missing:true},{src:'c.mp4'}];
const live=liveFilmShot({id:'media',seconds:17},{id:'media',seconds:17,screens}).screens,still=filmRenderShot({id:'media'},{id:'media',seconds:17,screens},[]).screens;
const plain=liveFilmShot({id:'media',seconds:17},{id:'media',seconds:17,screens:[{src:'a.mp4'}]}).screens;
console.log(JSON.stringify({live,still,plain}));"""
r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=REPO, capture_output=True, text=True, timeout=60)
assert r.returncode == 0, r.stderr[-1500:]
d = json.loads(r.stdout.strip().splitlines()[-1])
for k in ('live', 'still'):
    assert [(s['src'], s['target']) for s in d[k]] == [('a.mp4', 0), ('c.mp4', 2)], (k, d[k])
assert d['plain'] == [{'src': 'a.mp4'}], 'nothing missing: the screens exactly as they were (no target added)'
print('screen-missing-import-test: ok (a clip not on this machine is kept and flagged, named on stderr, the import takes the flag off; the Director skips it with the targets pinned)')
