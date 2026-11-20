#!/usr/bin/env python3
"""The Director's Export cut, into the film: watches Downloads for Film-chapter-*.json and imports each one.

19 Nov 2026: Vico's Create chapter exports (5) to (8) (15:56 to 16:16) never reached his cut. The importer that used to
take them was a script in a Claude session's scratchpad (director-watch.sh), not a service, and nothing ran it any more;
the Director said "Cut exported" and dropped his draft. This is that importer as a tool of the repo, meant to run as a
user service (tools/experience/ergoflex-director-import.service), like the render-request bridge.

For every new or changed Film-chapter-*.json in the watched folders (default ~/Downloads), once it has stayed the same
for one poll:
  1. the cut it belongs to, from the export's id: film-<cut id>-<chapter> -> the exports/* folder whose cut.json has
     that id; film-<chapter> (no cut.json: the master) -> $HQ (exports/cinematic-intro-20261104-hq14). An id no folder
     has, or a file that is not a client cut: rejected (logged, never retried until the file changes).
  2. under flock $DIRECTOR_IMPORT_LOCK (default /tmp/claude-1000/hq14-cut.lock, the cut lock the builders and the render
     requests take): a copy in <cut>/director-exports/export-<sha12>-<name>.json (what render-request.sh waits for),
     then build-round8-director.py <cut> --import <copy>, the pass (build-round8-director.py <cut>) and the chapter's
     page (--pages <chapter> --downloads <cut>/director-import). The page's new filmVersion is what the Director waits
     for: it keeps the export's draft until the film has it (experience/film-fresh.mjs).
  3. the result in <cut>/director-exports/imports.json ({sha: {file, chapter, at, ok, error}}) and the log
     exports/director-imports.log. A failed import is retried after DIRECTOR_IMPORT_RETRY seconds (default 120).

  director-import-watch.py [--once] [--baseline-existing]
     --once               one scan, then exit (tests, a manual catch-up)
     --baseline-existing  on the first run, take the files already there as done (no import of old exports)
Env: DIRECTOR_IMPORT_DIRS (':'-separated, default ~/Downloads), DIRECTOR_IMPORT_STATE (seen file), DIRECTOR_IMPORT_POLL
(10 s), DIRECTOR_IMPORT_LOCK, HQ, DIRECTOR_IMPORT_BUILD (the build script; tests give a stand-in), DIRECTOR_IMPORT_ROOT (the repo tree; tests).
"""
import argparse, fcntl, hashlib, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(os.environ.get('DIRECTOR_IMPORT_ROOT') or Path(__file__).resolve().parents[2]).resolve()   # (tests: a scratch tree)
DIRS = [Path(p).expanduser() for p in os.environ.get('DIRECTOR_IMPORT_DIRS', str(Path.home() / 'Downloads')).split(os.pathsep) if p]
STATE = Path(os.environ.get('DIRECTOR_IMPORT_STATE', str(Path.home() / '.local/state/ergoflex-director-import/seen.json')))
POLL = float(os.environ.get('DIRECTOR_IMPORT_POLL', '10'))
RETRY = float(os.environ.get('DIRECTOR_IMPORT_RETRY', '120'))
LOCK = os.environ.get('DIRECTOR_IMPORT_LOCK', '/tmp/claude-1000/hq14-cut.lock')
HQ = os.environ.get('HQ', 'exports/cinematic-intro-20261104-hq14')
BUILD = os.environ.get('DIRECTOR_IMPORT_BUILD', str(ROOT / 'tools/experience/build-round8-director.py'))
LOG = ROOT / 'exports/director-imports.log'
ID = re.compile(r'^film-(?:(?P<cut>[a-z0-9][a-z0-9-]*)-)?(?P<chapter>[a-z][a-z0-9]*)$')


def log(level, event, name, detail=''):
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} level={level} event={event} export={name!r} {detail}\n"
    print(line, end='', flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open('a') as f: f.write(line)
    except OSError as e: print(f'log write failed: {e}', file=sys.stderr, flush=True)


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix('.tmp'); tmp.write_text(json.dumps(state, indent=1) + '\n'); os.replace(tmp, STATE)


def cuts():
    """{cut id: folder} for every exports/* with a cut.json; None: the master ($HQ)."""
    out = {None: ROOT / HQ}
    for cj in sorted((ROOT / 'exports').glob('*/cut.json')):
        try: cid = json.loads(cj.read_text()).get('id')
        except (OSError, ValueError): continue
        if isinstance(cid, str) and cid: out.setdefault(cid, cj.parent)
    return out


def target(export):
    """(cut folder, chapter id) the export belongs to, or raises ValueError with the reason."""
    d = json.loads(export.read_text())
    if not isinstance(d, dict) or d.get('schema') != 'ergoflex.client-cut' or not isinstance(d.get('shots'), list) or len(d['shots']) != 1:
        raise ValueError('not a one-chapter Director export')
    m = ID.match(str(d.get('id', '')))
    chapter = d['shots'][0].get('id')
    if not m or not chapter: raise ValueError(f"no film chapter id ({d.get('id')!r})")
    # the cut part is everything before the chapter id (cut ids have dashes: film-vicos-2nd-cut-create)
    full = str(d['id'])
    if not full.endswith('-' + chapter): raise ValueError(f'id {full!r} does not end with its chapter {chapter!r}')
    cut_id = full[len('film-'):-len(chapter) - 1] or None
    folder = cuts().get(cut_id)
    if not folder: raise ValueError(f'no cut folder has the id {cut_id!r} (exports/*/cut.json)')
    if not (folder / 'review-cut.json').is_file(): raise ValueError(f'{folder} has no review-cut.json')
    return folder, chapter


def run(args):
    p = subprocess.run(['python3', BUILD, *args], cwd=ROOT, capture_output=True, text=True)
    if p.returncode: raise RuntimeError(f"{' '.join(Path(a).name if os.sep in a else a for a in args)}: " + ((p.stderr or p.stdout).strip().splitlines() or ['failed'])[-1][:300])
    return p.stdout


def record(folder, sha, entry):
    f = folder / 'director-exports' / 'imports.json'
    try: all_ = json.loads(f.read_text()) if f.is_file() else {}
    except ValueError: all_ = {}
    all_[sha] = entry; tmp = f.with_suffix('.tmp'); tmp.write_text(json.dumps(all_, indent=1) + '\n'); os.replace(tmp, f)


def import_one(p, sha):
    folder, chapter = target(p)
    name = re.sub(r'[^A-Za-z0-9._-]', '_', p.stem)
    Path(LOCK).parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK, 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        out = folder / 'director-exports'; out.mkdir(exist_ok=True)
        copy = out / f'export-{sha[:12]}-{name}.json'
        if not copy.exists(): shutil.copyfile(p, copy)
        rel = os.path.relpath(folder, ROOT)
        try:
            run([rel, '--import', str(copy)]); run([rel]); run([rel, '--pages', chapter, '--downloads', str(folder / 'director-import')])
        except Exception as e:
            record(folder, sha, {'file': p.name, 'chapter': chapter, 'at': time.time(), 'ok': False, 'error': str(e)}); raise
        record(folder, sha, {'file': p.name, 'chapter': chapter, 'at': time.time(), 'ok': True})
    return folder, chapter


def scan(state, baseline=False):
    files = sorted((p for d in DIRS if d.is_dir() for p in d.glob('Film-chapter-*.json')), key=lambda p: (p.stat().st_mtime, p.name))
    if baseline and not state.get('_initialized'):
        for p in files:
            try: state[str(p)] = {'sha': digest(p), 'status': 'baseline', 'at': time.time()}
            except OSError: pass
        state['_initialized'] = True; save(state); log('info', 'BASELINED', f'{len(files)} file(s)', 'later exports are imported'); return
    state['_initialized'] = True
    for p in files:
        try: sha = digest(p); st = p.stat()
        except OSError as e: log('error', 'FAILED', p.name, f'reason=read:{e}'); continue
        key, old = str(p), state.get(str(p), {})
        if old.get('sha') == sha and old.get('status') in ('imported', 'rejected', 'baseline'): continue
        if old.get('sha') != sha or old.get('size') != st.st_size or old.get('mtime_ns') != st.st_mtime_ns:     # (wait for a finished download)
            state[key] = {'sha': sha, 'size': st.st_size, 'mtime_ns': st.st_mtime_ns, 'status': 'observed', 'at': time.time()}; save(state); continue
        if old.get('status') == 'failed' and time.time() - old.get('attempt', 0) < RETRY: continue
        base = {'sha': sha, 'size': st.st_size, 'mtime_ns': st.st_mtime_ns, 'at': time.time()}
        try:
            folder, chapter = import_one(p, sha)
            state[key] = {**base, 'status': 'imported', 'cut': str(folder.relative_to(ROOT)), 'chapter': chapter}; save(state)
            log('info', 'IMPORTED', p.name, f'cut={folder.relative_to(ROOT)} chapter={chapter} sha={sha[:12]}')
        except ValueError as e:
            state[key] = {**base, 'status': 'rejected', 'reason': str(e)}; save(state); log('warn', 'REJECTED', p.name, f'reason={e}')
        except Exception as e:
            state[key] = {**base, 'status': 'failed', 'attempt': time.time(), 'reason': str(e)}; save(state); log('error', 'FAILED', p.name, f'reason={e}')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--once', action='store_true'); ap.add_argument('--baseline-existing', action='store_true')
    a = ap.parse_args()
    try: state = json.loads(STATE.read_text())
    except (OSError, ValueError): state = {}
    log('info', 'START', '-', f"dirs={':'.join(map(str, DIRS))} root={ROOT}")
    if a.once:      # (a download is taken once it has stayed the same for one look: two looks, a moment apart)
        scan(state, baseline=a.baseline_existing); time.sleep(min(POLL, 1.0)); scan(state); return
    while True:
        scan(state, baseline=a.baseline_existing); time.sleep(POLL)


if __name__ == '__main__':
    main()
