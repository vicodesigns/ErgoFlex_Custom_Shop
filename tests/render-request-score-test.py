#!/usr/bin/env python3
"""A cut's own score in a render request (tools/experience/build-cine-score.py, render-request.sh), against a temp clone:

  1. a cut WITHOUT its own score (and without a generated edl.json) freezes byte-identical inputs to the render-request.sh
     of 04f24e0f (before cuts could carry a score): same manifest lines (sha, size, path; the freeze folder's name aside);
  2. a cut with a generated edl.json but no score is rejected (exit 2, "out of step"), and so is one whose score was built
     from other inputs;
  3. a cut whose score is in step has it laid over the master's score/score.wav (sha, size, a stored copy in render-blobs).

    python3 tests/render-request-score-test.py      (Linux desk: flock, rsync; ~2 min)
"""
import hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQ = 'exports/cinematic-intro-20261104-hq14'; SH = 'tools/experience/render-request.sh'; BASE = '04f24e0f'
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
tmp = tempfile.mkdtemp(prefix='render-request-score-test-'); R = os.path.join(tmp, 'repo')
env = {**os.environ, 'RENDER_LOCK': os.path.join(tmp, 'cut.lock'), 'RENDER_REQ_SETTLE': '0', 'RENDER_REQ_IMPORT_WAIT': '0', 'PIN_ALWAYS': ''}
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)
n_req = [0]
def req(cut, **kw):
    n_req[0] += 1
    r = {'v': 1, 'scope': 'film', 'chapter': 'rise', 'resolution': '480p', 'note': '', 'created': f'2026-11-14T12:00:{n_req[0]:02d}.000Z',
         'signature': 'abcd1234abcd1234', 'exportSha': None, 'cut': cut}
    r.update(kw); p = os.path.join(tmp, f'Render-request-{n_req[0]}.json'); json.dump(r, open(p, 'w')); return p
def manifest(job):
    F = os.path.dirname(job['manifest'])
    rows = []
    for l in open(f"{R}/{job['manifest']}").read().strip().split('\n')[1:]:
        c = l.split(' ')
        if '/request/' in c[2]: continue              # the request itself (its created stamp differs by design)
        rows.append(' '.join([c[0], c[1], c[2].replace(F, 'F')] + [x.replace(F, 'F') for x in c[3:]]))
    return sorted(rows)
def last_job(): return json.load(open(f'{R}/exports/render-queue/queue.json'))['jobs'][-1]
try:
    assert sh('git', 'clone', '-q', '--local', WT, R).returncode == 0
    sh('rsync', '-a', '--exclude=*.mp4', '--exclude=*.mkv', '--exclude=*.m4a', '--exclude=*.wav', '--exclude=final', '--exclude=renders*', f'{WT}/{HQ}/', f'{R}/{HQ}/')
    os.makedirs(f'{R}/{HQ}/score', exist_ok=True); open(f'{R}/{HQ}/score/score.wav', 'wb').write(b'RIFF master score stand-in')
    shutil.copytree(f'{WT}/tools/experience', f'{R}/tools/experience', dirs_exist_ok=True, ignore=shutil.ignore_patterns('screens', '__pycache__'))
    shutil.rmtree(f'{R}/exports/render-queue', ignore_errors=True)
    d = sh(sys.executable, f'{R}/tools/experience/film-cuts.py', 'duplicate', HQ, 'Score test', '--id', 'scoretest').stdout.strip().split('\n')[-1]
    check(os.path.exists(f'{R}/{d}/review-cut.json') and not os.path.exists(f'{R}/{d}/score'), 'a new cut without a score: ' + d)

    # 1. no score: today's inputs, byte for byte
    old = os.path.join(tmp, 'render-request-old.sh')
    o = sh('git', '-C', WT, 'show', f'{BASE}:{SH}')
    check(o.returncode == 0, f'render-request.sh of {BASE} is in the history')
    open(old, 'w').write(o.stdout); os.chmod(old, 0o755)
    shutil.copy(old, f'{R}/tools/experience/render-request-old.sh')
    p = sh(f'{R}/tools/experience/render-request-old.sh', req(d), R, env=env); check(p.returncode == 0, 'old script queues the request: ' + p.stderr.strip()[-300:])
    m_old = manifest(last_job())
    p = sh(f'{R}/{SH}', req(d), R, env=env); check(p.returncode == 0, 'new script queues the request: ' + p.stderr.strip()[-300:])
    m_new = manifest(last_job())
    diff = sorted(set(m_old) ^ set(m_new))
    check(not diff, f'a cut without a score freezes byte-identical inputs ({len(m_new)} lines, {len(diff)} differ){": " + diff[0] if diff else ""}')
    os.remove(f'{R}/tools/experience/render-request-old.sh')

    # 2. a generated edl.json without a score, then a score from other inputs: rejected
    g = sh(sys.executable, f'{R}/tools/experience/build-cine-score.py', f'{R}/{d}', '--edl-only'); check(g.returncode == 0, 'edl.json generated from the cut')
    p = sh(f'{R}/{SH}', req(d), R, env=env)
    check(p.returncode == 2 and 'out of step' in p.stderr and 'no score/score.wav' in p.stderr, 'a generated edl.json without a score is rejected')
    os.makedirs(f'{R}/{d}/score', exist_ok=True); wav = f'{R}/{d}/score/score.wav'; open(wav, 'wb').write(b'RIFF cut score stand-in ' + os.urandom(64))
    json.dump({'edl': 'cut', 'inputs_sha256': '0' * 64, 'wav_sha256': hashlib.sha256(open(wav, 'rb').read()).hexdigest()}, open(f'{R}/{d}/score/tempo-map.json', 'w'))
    p = sh(f'{R}/{SH}', req(d), R, env=env)
    check(p.returncode == 2 and 'other inputs' in p.stderr, 'a score built from other inputs is rejected')

    # 3. in step: laid over the master's score
    spec = importlib.util.spec_from_file_location('bcs', f'{R}/tools/experience/build-cine-score.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    json.dump({'edl': 'cut', 'inputs_sha256': m.inputs_digest(f'{R}/{d}', open(f'{R}/{d}/edl.json', 'rb').read()), 'wav_sha256': m.sha_file(wav)}, open(f'{R}/{d}/score/tempo-map.json', 'w'))
    c = sh(sys.executable, f'{R}/tools/experience/build-cine-score.py', f'{R}/{d}', '--check'); check(c.returncode == 0, 'the check passes: ' + c.stdout.strip()[-200:])
    p = sh(f'{R}/{SH}', req(d), R, env=env); check(p.returncode == 0, 'the request for the cut with its score is queued: ' + p.stderr.strip()[-300:])
    rows = [l.split(' ') for l in open(f"{R}/{last_job()['manifest']}").read().strip().split('\n')[1:]]
    row = next((l for l in rows if l[2] == f'{HQ}/score/score.wav'), None)
    sha = hashlib.sha256(open(wav, 'rb').read()).hexdigest()
    check(row is not None and row[0] == sha and int(row[1]) == os.path.getsize(wav) and row[3].startswith('exports/render-blobs/')
          and hashlib.sha256(open(f'{R}/{row[3]}', 'rb').read()).hexdigest() == sha, "the cut's score is on the master's path, stored by content")
    row = next((l for l in rows if l[2] == f'{HQ}/edl.json'), None)
    check(row is not None and row[0] == hashlib.sha256(open(f'{R}/{d}/edl.json', 'rb').read()).hexdigest(), "the cut's generated edl.json is on the master's path")
    check(sum(1 for l in rows if l[2] == f'{HQ}/score/score.wav') == 1, 'one score line')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
