#!/usr/bin/env python3
"""tools/experience/render-request.sh against a temp clone of this worktree (never the live checkout): a clean clone of HEAD
plus this worktree's film data (exports/cinematic-intro-20261104-hq14 without video/audio) and two edited .mjs files.
Checks: the freeze (manifest sha/size for every line, edited file frozen, institutional-media.mjs pinned back to HEAD),
the one-shot / full cut, queue.json (atomic append, ids in time order, fields), waiting for the cut lock, waiting for the
export's import (and the warning when it never shows), a bad request, and that the live checkout got nothing.

  python3 tests/render-request-test.py        (~1 min; no browser)"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, threading, time
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQ = 'exports/cinematic-intro-20261104-hq14'; LIVE = '/home/ergo/ErgoFlex_Custom_Shop'
SH = os.path.join(WT, 'tools/experience/render-request.sh')
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
tmp = tempfile.mkdtemp(prefix='render-request-test-'); R = os.path.join(tmp, 'repo'); lock = os.path.join(tmp, 'cut.lock')
env = {**os.environ, 'RENDER_LOCK': lock, 'RENDER_REQ_SETTLE': '0', 'RENDER_REQ_IMPORT_WAIT': '0'}
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)
try:
    live_before = os.path.exists(os.path.join(LIVE, 'exports/render-queue'))
    assert sh('git', 'clone', '-q', '--local', WT, R).returncode == 0
    sh('rsync', '-a', '--exclude=*.mp4', '--exclude=*.mkv', '--exclude=*.m4a', '--exclude=*.wav', '--exclude=final', '--exclude=renders*', f'{WT}/{HQ}/', f'{R}/{HQ}/')
    # the tools under test come from the worktree (the clone has HEAD's, which may not have them yet)
    shutil.copytree(f'{WT}/tools/experience', f'{R}/tools/experience', dirs_exist_ok=True, ignore=shutil.ignore_patterns('screens', '__pycache__'))
    with open(f'{R}/campus-lived-in.mjs', 'a') as f: f.write('\n// the film owner edited this\n')      # not another session's: frozen as edited
    with open(f'{R}/scene-tour.mjs', 'a') as f: f.write('\n// another session is editing this too\n')   # live .mjs of another session: pinned back to HEAD
    os.makedirs(f'{R}/exports/cinematic-intro-20261030/screens', exist_ok=True)
    open(f'{R}/exports/cinematic-intro-20261030/screens/02-curved.mp4', 'wb').write(b'not really a video')   # a win-exports.txt screens line
    with open(f'{R}/institutional-media.mjs', 'a') as f: f.write('\n// another session is editing this\n')
    head_media = sh('git', 'show', 'HEAD:institutional-media.mjs', cwd=R).stdout; head_tour = sh('git', 'show', 'HEAD:scene-tour.mjs', cwd=R).stdout
    review = json.load(open(f'{R}/{HQ}/review-cut.json')); ids = [s['id'] for s in review['shots']]
    def req(**kw):
        r = {'v': 1, 'scope': 'chapter', 'chapter': 'create', 'resolution': '720p', 'note': 'hello', 'created': '2026-11-07T12:00:00.000Z', 'signature': 'abcd1234abcd1234', 'exportSha': None, 'estimateMinutes': 3.1}
        r.update(kw); p = os.path.join(tmp, f'req-{len(os.listdir(tmp))}.json'); json.dump(r, open(p, 'w')); return p
    # ---- chapter request
    p = sh(SH, req(), R, env=env); out = p.stdout.strip().split('\n')
    check(p.returncode == 0, 'chapter request runs: ' + (p.stderr.strip()[-300:] or 'ok'))
    jid = out[-1]; q = json.load(open(f'{R}/exports/render-queue/queue.json')); j = q['jobs'][0]
    check(len(q['jobs']) == 1 and j['id'] == jid and jid.startswith('req-'), 'queue.json has the job ' + jid)
    check(j['scope'] == 'chapter' and j['chapter'] == 'create' and j['chapterIndex'] == ids.index('create') and j['resolution'] == '720p' and j['height'] == 720 and j['note'] == 'hello' and j['status'] == 'queued', 'job fields: ' + json.dumps({k: j[k] for k in ('scope', 'chapter', 'chapterIndex', 'resolution', 'note', 'status')}))
    check(j['manifest'].startswith('exports/cinematic-intro-20261104-req-') and j['manifest'].endswith('/manifest.txt') and os.path.exists(f"{R}/{j['manifest']}"), 'manifest path ' + j['manifest'])
    cut = json.load(open(f"{R}/{j['cut']}"))
    check(len(cut['shots']) == 1 and cut['shots'][0] == review['shots'][ids.index('create')] and j['shots'] == '0', 'one-shot cut = review-cut.json entry for create (' + j['cut'] + ')')
    # ---- manifest
    lines = open(f"{R}/{j['manifest']}").read().rstrip('\n').split('\n'); F = j['manifest'].rsplit('/', 1)[0]
    check(lines[0].startswith('# req-') and 'frozen inputs' in lines[0], 'manifest header: ' + lines[0][:60])
    bad = []
    for l in lines[1:]:
        c = l.split(' '); sha, size, path = c[0], int(c[1]), c[2]; fetch = c[3] if len(c) > 3 else path
        fp = os.path.join(R, fetch)
        if not os.path.isfile(fp) or hashlib.sha256(open(fp, 'rb').read()).hexdigest() != sha or os.path.getsize(fp) != size: bad.append(l)
    check(not bad and len(lines) > 20, f'{len(lines)-1} manifest lines, every sha256/size matches its file' + (': ' + bad[0] if bad else ''))
    by = {l.split(' ')[2]: l.split(' ') for l in lines[1:]}
    check(by.get('campus-lived-in.mjs', [0, 0, 0, ''])[3] == f'{F}/campus-lived-in.mjs' and open(f'{R}/{F}/campus-lived-in.mjs').read().endswith('edited this\n'), 'a film-owner .mjs edit is frozen as edited, with a url-path')
    check(open(f'{R}/{F}/scene-tour.mjs', 'rb').read() == head_tour.encode(), "another session's live scene-tour.mjs pinned back to HEAD")
    check(open(f'{R}/{F}/institutional-media.mjs', 'rb').read() == head_media.encode(), 'institutional-media.mjs pinned back to HEAD')
    check(f'{HQ}/review-cut.json' in by and f'{F}/request/cut.json' in by and f'{F}/request/request.json' in by and 'studio-state.json' in by, 'manifest lists review-cut.json, studio-state.json, the cut and the request')
    check(len(by.get('exports/cinematic-intro-20261030/screens/02-curved.mp4', [])) == 3 and not any(p.endswith('.mp4') and p.startswith(HQ) for p in by), 'screens clip from win-exports.txt listed (url-path = path); film-dir videos are not')
    # ---- film request, sequential: ids in time order
    time.sleep(1.1); p2 = sh(SH, req(scope='film', chapter='hero', resolution='4K', note=''), R, env=env)
    check(p2.returncode == 0, 'film request runs: ' + (p2.stderr.strip()[-300:] or 'ok'))
    q = json.load(open(f'{R}/exports/render-queue/queue.json')); j2 = q['jobs'][1]
    check(len(q['jobs']) == 2 and j2['id'] > j['id'] and j2['scope'] == 'film' and j2['height'] == 2160 and j2['shots'] == 'all', 'second job appended after the first, 4K film')
    check(json.load(open(f"{R}/{j2['cut']}")) == review, 'film cut = the whole review-cut.json')
    # chapter cache keys: computed from the frozen copy, at the job's resolution, 12 for a film / 1 for a chapter; force defaults to false
    import importlib.util
    sp = importlib.util.spec_from_file_location('ck', f'{WT}/tools/experience/chapter-keys.py'); ck = importlib.util.module_from_spec(sp); sp.loader.exec_module(ck)
    want = {c: k for _, c, k in ck.chapter_keys(HQ, '4K', R, os.path.join(R, j2['manifest'].rsplit('/', 1)[0]))}
    check(list(j2.get('chapterKeys', {})) == ids and j2['chapterKeys'] == want and j2.get('epoch') == ck.read_epoch(f'{WT}/tools/experience') and j2.get('force') is False, 'film job: chapterKeys for all 12 chapters + epoch + force:false')
    check(j['chapterKeys'] == {'create': {**{c: k for _, c, k in ck.chapter_keys(HQ, '720p', R, os.path.join(R, F))}}['create']}, 'chapter job: only its own key, at 720p')
    check(j['chapterKeys']['create'] != j2['chapterKeys']['create'], 'the same chapter has another key at 4K')
    check(not [f for f in os.listdir(f'{R}/exports/render-queue') if f.endswith('.tmp')], 'no temp files left by the atomic write')
    # ---- waits for the cut lock
    held = subprocess.Popen(['flock', lock, 'sleep', '4']); time.sleep(.5); t0 = time.time()
    p3 = sh(SH, req(chapter='coast'), R, env=env); dt = time.time() - t0; held.wait()
    check(p3.returncode == 0 and dt >= 3, f'waits for the chapter-import lock ({dt:.1f}s while it was held 4s)')
    # ---- waits for the export's import: the file appears in director-exports/ after 3 s
    exp = b'{"export":"cut"}'; esha = hashlib.sha256(exp).hexdigest(); os.makedirs(f'{R}/{HQ}/director-exports', exist_ok=True)
    threading.Timer(3, lambda: open(f'{R}/{HQ}/director-exports/export-120000-Film-chapter-media.json', 'wb').write(exp)).start()
    t0 = time.time(); p4 = sh(SH, req(chapter='media', exportSha=esha), R, env={**env, 'RENDER_REQ_IMPORT_WAIT': '30'}); dt = time.time() - t0
    j4 = json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs'][3]
    check(p4.returncode == 0 and dt >= 2.5 and 'warning' not in j4, f'waits for the export to be imported ({dt:.1f}s), no warning')
    t0 = time.time(); p5 = sh(SH, req(chapter='music', exportSha='0' * 64), R, env={**env, 'RENDER_REQ_IMPORT_WAIT': '3'})
    j5 = json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs'][4]
    check(p5.returncode == 0 and 'warning' in j5 and 'importer' in j5['warning'], 'an export that never shows up: job still queued, with a warning')
    # ---- bad requests
    for what, r in [('bad resolution', req(resolution='999p')), ('bad scope', req(scope='both')), ('unknown chapter', req(chapter='nope'))]:
        b = sh(SH, r, R, env=env); check(b.returncode != 0, f'{what} is refused: ' + b.stderr.strip().split('\n')[-1][:90])
    check(len(json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs']) == 5, 'refused requests queued nothing')
    check(os.path.exists(os.path.join(LIVE, 'exports/render-queue')) == live_before, 'the live checkout got no render-queue')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print(f'\nrender-request test: {len(fails)} failure(s).' if fails else '\nrender-request test: all checks passed.')
sys.exit(1 if fails else 0)
