#!/usr/bin/env python3
"""A render request for another cut of the film (tools/experience/film-cuts.py, the Director's Cut menu), against a temp
clone: the request's "cut" picks the folder, an export of that cut's chapter is imported into it (not into the master),
the job's cut is that folder's review-cut and the freeze carries its film data on the master's paths; a request without
"cut" still renders the master; an unknown cut is rejected.     python3 tests/render-request-cut-test.py   (~1 min)"""
import hashlib, json, os, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQ = 'exports/cinematic-intro-20261104-hq14'; SH = 'tools/experience/render-request.sh'
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
tmp = tempfile.mkdtemp(prefix='render-request-cut-test-'); R = os.path.join(tmp, 'repo')
env = {**os.environ, 'RENDER_LOCK': os.path.join(tmp, 'cut.lock'), 'RENDER_REQ_SETTLE': '0', 'RENDER_REQ_IMPORT_WAIT': '0', 'PIN_ALWAYS': ''}
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)
try:
    assert sh('git', 'clone', '-q', '--local', WT, R).returncode == 0
    sh('rsync', '-a', '--exclude=*.mp4', '--exclude=*.mkv', '--exclude=*.m4a', '--exclude=*.wav', '--exclude=final', '--exclude=renders*', f'{WT}/{HQ}/', f'{R}/{HQ}/')
    shutil.copytree(f'{WT}/tools/experience', f'{R}/tools/experience', dirs_exist_ok=True, ignore=shutil.ignore_patterns('screens', '__pycache__'))
    shutil.rmtree(f'{R}/exports/render-queue', ignore_errors=True)
    d = sh(sys.executable, f'{R}/tools/experience/film-cuts.py', 'duplicate', HQ, 'Test cut', '--id', 'test').stdout.strip().split('\n')[-1]
    check(d == 'exports/cinematic-intro-cut-test' and os.path.exists(f'{R}/{d}/director-chapters.json') and os.path.exists(f'{R}/{d}/shots/13-subshots.json'), 'duplicate makes a cut folder with its film data and Director pages: ' + d)
    cuts = json.load(open(f'{R}/exports/film-cuts.json'))['cuts']
    check([c['id'] for c in cuts][0] == 'vico' and any(c['id'] == 'test' and c['dir'] == '/' + d for c in cuts), 'film-cuts.json lists the master first and the new cut')
    # the new cut differs from the master in one chapter title, and gets a Director export of its own
    rc = json.load(open(f'{R}/{d}/review-cut.json')); master = json.load(open(f'{R}/{HQ}/review-cut.json')); before_master = open(f'{R}/{HQ}/review-cut.json', 'rb').read()
    page = json.load(open(next(os.path.join(f'{R}/{d}/director-import', n) for n in os.listdir(f'{R}/{d}/director-import') if '-rise-' in n)))
    check(page['id'] == 'film-test-rise', "the cut's chapters are projects of their own: " + page['id'])
    page['shots'][0]['peopleEdits'] = {'cast': [{'key': 'maya', 'id': 'people-maya-stand-wait', 'at': [100, 200], 'turn': 30, 'pose': {'head': [0.1, 0, 0, 0.995]}}]}
    exp = os.path.join(tmp, 'Film-chapter-rise-18-s-.json'); json.dump(page, open(exp, 'w'))
    def req(**kw):
        r = {'v': 1, 'scope': 'chapter', 'chapter': 'rise', 'resolution': '480p', 'note': '', 'created': '2026-11-10T12:00:00.000Z', 'signature': 'abcd1234abcd1234', 'exportSha': hashlib.sha256(open(exp, 'rb').read()).hexdigest()}
        r.update(kw); p = os.path.join(tmp, f'Render-request-{len(os.listdir(tmp))}.json'); json.dump(r, open(p, 'w')); return p
    p = sh(f'{R}/{SH}', req(cut=d), R, env=env)
    check(p.returncode == 0, 'a request for the cut runs: ' + (p.stderr.strip()[-400:] or 'ok'))
    j = json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs'][-1]
    check(j.get('cutDir') == d and j.get('cutName') == 'Test cut', 'the job names the cut')
    rise = next(s for s in json.load(open(f'{R}/{d}/review-cut.json'))['shots'] if s['id'] == 'rise')
    check(rise.get('people', {}).get('cast', [{}])[0].get('pose', {}).get('head') == [0.1, 0, 0, 0.995], "the export went into the cut's own film data (people with a pose)")
    check(open(f'{R}/{HQ}/review-cut.json', 'rb').read() == before_master, 'the master cut is untouched')
    jc = json.load(open(f"{R}/{j['cut']}"))
    check(len(jc['shots']) == 1 and jc['shots'][0].get('people', {}).get('cast', [{}])[0].get('key') == 'maya', "the job renders the cut's chapter")
    lines = [l.split(' ') for l in open(f"{R}/{j['manifest']}").read().strip().split('\n')[1:]]
    row = next((l for l in lines if l[2] == f'{HQ}/review-cut.json'), None)
    check(row and hashlib.sha256(open(f'{R}/{d}/review-cut.json', 'rb').read()).hexdigest() == row[0] and os.path.exists(f'{R}/{row[3]}'), "the freeze has the cut's review-cut on the master's path")
    bad = [l for l in lines if len(l) >= 4 and not (os.path.exists(f'{R}/{l[3]}') and hashlib.sha256(open(f'{R}/{l[3]}', 'rb').read()).hexdigest() == l[0])]
    check(not bad, f'every manifest line matches its file ({len(lines)} lines, {len(bad)} bad)')
    # a request without a cut is the master's; an unknown cut is refused
    p = sh(f'{R}/{SH}', req(exportSha=None, created='2026-11-10T12:00:01.000Z'), R, env=env)
    j2 = json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs'][-1]
    check(p.returncode == 0 and 'cutDir' not in j2 and 'people' not in json.load(open(f"{R}/{j2['cut']}"))['shots'][0].get('people', {}).get('cast', [{}])[0].get('pose', {}) and j2['id'] != j['id'], 'a request without a cut renders the master')
    p = sh(f'{R}/{SH}', req(cut='exports/nope', created='2026-11-10T12:00:02.000Z'), R, env=env)
    check(p.returncode == 2 and 'not a film cut' in p.stderr, 'an unknown cut is rejected')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
