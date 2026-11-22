#!/usr/bin/env python3
"""Diagonal wheel moves through the importer (build-round8-director.py, 22 Nov 2026), on a scratch copy of Vico's 3rd
cut (made in the temp folder; the cut itself is only read): an export of chapter 11 storage whose wheel moves are the
"approach the landing spot" plan (a strafe, one diagonal forward-right, a turn) keeps each clip's kind, value and
direction (forward-right included) in director-camera-storage.json and in the film shot after the pass, and the film
shot's motion lands where the export's does (node experience/desk-clips.mjs sampleClipMotion).
  python3 tests/desk-diagonal-import-test.py [cut dir]"""
import base64, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]; BUILD = REPO / 'tools/experience/build-round8-director.py'
src = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / 'exports/cinematic-intro-cut-vicos-3rd-cut'
if not (src / 'review-cut.json').is_file(): print('desk-diagonal-import-test: skipped (no 3rd cut here)'); sys.exit(0)
tmp = Path(tempfile.mkdtemp(prefix='desk-diagonal-import-')); cut = tmp / 'cut'
shutil.copytree(src, cut, ignore=shutil.ignore_patterns('*.mp4'), symlinks=True)
m = re.search(r'#cut=([A-Za-z0-9_-]+)', next(cut.glob('director-ch*-storage.html')).read_text(encoding='utf-8'))
page = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
shot = page['shots'][0]; assert shot['id'] == 'storage'
# the plan, made by the Director's own module (experience/desk-approach.mjs) from the chapter's poses
js = r"""
import {cleanClipMotion,sampleClipMotion} from './experience/desk-clips.mjs';import {planApproach,approachClips} from './experience/desk-approach.mjs';
const shot=JSON.parse(process.argv[1]),m=cleanClipMotion(shot.motion,shot.seconds),from=sampleClipMotion(m,12.25),to=sampleClipMotion(m,shot.seconds);
const plan=planApproach(from,to),clips=approachClips(plan,12.25,{prefix:'approach-test'});
const motion={...m,clips:[...m.clips.filter(c=>c.lane!=='wheels'||c.start<12.25),...clips]};
console.log(JSON.stringify({motion,end:sampleClipMotion(cleanClipMotion(motion,shot.seconds),shot.seconds),clips}));"""
def node(code, *args):
    r = subprocess.run(['node', '--input-type=module', '-e', code, *args], cwd=REPO, capture_output=True, text=True, timeout=120); assert r.returncode == 0, r.stderr[-1500:]
    return json.loads(r.stdout.strip().splitlines()[-1])
made = node(js, json.dumps(shot))
assert any(c['direction'] == 'forward-right' for c in made['clips']), made['clips']
shot['motion'] = made['motion']
exp = tmp / 'Film-chapter-storage-diagonal.json'; exp.write_text(json.dumps(page), encoding='utf-8')
for args in (['--import', str(exp)], []):
    r = subprocess.run([sys.executable, str(BUILD), str(cut), *args], capture_output=True, text=True, timeout=900, encoding='utf-8'); assert r.returncode == 0, (args, r.stderr[-2000:])
dc = json.loads((cut / 'director-camera-storage.json').read_text(encoding='utf-8'))
film = next(s for s in json.loads((cut / 'review-cut.json').read_text(encoding='utf-8'))['shots'] if s['id'] == 'storage')
pick = lambda clips: {c['id']: (c['kind'], c.get('value'), c.get('direction')) for c in clips if c['id'].startswith('approach-test')}
want = {c['id']: (c['kind'], c['value'], c['direction']) for c in made['clips']}
assert pick(dc.get('clips') or []) == want, ('director-camera-storage.json', pick(dc.get('clips') or []), want)
assert pick(film['motion']['clips']) == want, ('the film shot', pick(film['motion']['clips']), want)
end = node(r"""import {cleanClipMotion,sampleClipMotion} from './experience/desk-clips.mjs';const s=JSON.parse(process.argv[1]);console.log(JSON.stringify(sampleClipMotion(cleanClipMotion(s.motion,s.seconds),s.seconds)));""", json.dumps(film))
off = ((end['x'] - made['end']['x']) ** 2 + (end['z'] - made['end']['z']) ** 2) ** .5
assert off < 1e-6 and abs(end['yaw'] - made['end']['yaw']) < 1e-6, ('the film lands where the export does', end, made['end'])
shutil.rmtree(tmp, ignore_errors=True)
print('desk-diagonal-import-test: ok (the approach\'s clips, diagonal forward-right included, kept by the import and in the film shot; it lands where the export does)', json.dumps(want))
