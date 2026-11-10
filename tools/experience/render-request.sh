#!/bin/bash
# render-request.sh <request json> [repo root]   (repo root default /home/ergo/ErgoFlex_Custom_Shop)
#
# Turns the Render-request-*.json that Director's "Render preview" button downloads into a job for the render PC:
#   1. waits for the Export cut that came with the request to be imported (the director watcher copies every export into
#      <hq>/director-exports/, so the request's exportSha shows up there; then the import holds the cut lock, which
#      step 2 waits for),
#   2. under flock $RENDER_LOCK (default /tmp/claude-1000/hq14-cut.lock, the chapter-import lock): freeze-inputs.sh with tag
#      req-<UTC stamp>, pin-inputs.py for the files other sessions have open (institutional-media.mjs + the live .mjs/.js/.cjs
#      files, same filter as the manual flow), and the cut the render PC renders: <freeze>/request/cut.json (chapter scope:
#      a one-shot cut, shots[chapterIndex] of review-cut.json; film scope: all of review-cut.json) plus request.json,
#      both listed in the manifest,
#      The job also carries chapterKeys (chapter id -> cache key, all 12 for a film, one for a chapter; chapter-keys.py over the
#      FROZEN film data at the job's resolution), epoch (render-epoch.txt) and force (the request's "force": true = ignore the
#      render PC's chapter cache). Without keys (chapter-keys.py failed) the render PC renders everything.
#   3. appends the job to <root>/exports/render-queue/queue.json (atomic write; exports/ is served and not watched).
# Protocol for the render PC: tools/experience/RENDER-QUEUE.md. Prints the job id on the last line.
#
# Env: HQ (exports/cinematic-intro-20261104-hq14), RENDER_LOCK, PIN_ALWAYS (institutional-media.mjs),
#      RENDER_REQ_IMPORT_WAIT (240 s to see the export in director-exports/; 0 = don't wait), RENDER_REQ_SETTLE (10 s the
#      watcher gets to take the lock after it copied the export), RENDER_REQ_LOCK_WAIT (900 s).
set -euo pipefail
REQ=${1:?usage: render-request.sh <request json> [repo root]}; ROOT=${2:-/home/ergo/ErgoFlex_Custom_Shop}
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$ROOT" && pwd); REQ=$(cd "$(dirname "$REQ")" && pwd)/$(basename "$REQ")
HQ=${HQ:-exports/cinematic-intro-20261104-hq14}; LOCK=${RENDER_LOCK:-/tmp/claude-1000/hq14-cut.lock}
PIN_ALWAYS=${PIN_ALWAYS-institutional-media.mjs}
[ -f "$ROOT/$HQ/review-cut.json" ] || { echo "no $HQ/review-cut.json under $ROOT" >&2; exit 1; }
Q=$ROOT/exports/render-queue; mkdir -p "$Q"

# shared-folder bridge: idempotency + durable event log
BRIDGE_LOG=$Q/bridge.log
REQUEST_SHA=$(sha256sum "$REQ" | cut -d' ' -f1)
BRIDGE_STATE=processing
bridge_log() { printf '%s level=%s event=%s request=%s sha=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$(basename "$REQ")" "$REQUEST_SHA" "${3:-}" >> "$BRIDGE_LOG"; }
bridge_exit() { local rc=$?; if [ "$rc" -ne 0 ] && [ "$BRIDGE_STATE" = processing ]; then bridge_log error FAILED "exit=$rc"; fi; }
trap bridge_exit EXIT

if [ ! -f "$ROOT/$HQ/review-cut.json" ]; then bridge_log error REJECTED "reason=missing-review-cut"; echo "no $HQ/review-cut.json under $ROOT" >&2; BRIDGE_STATE=rejected; exit 1; fi

# Serialize enqueues and check the request fingerprint before freezing expensive inputs.
exec 8>"$Q/.bridge.lock"
flock -w "${RENDER_REQ_LOCK_WAIT:-900}" 8 || { bridge_log error FAILED "reason=bridge-lock-timeout"; exit 1; }
if [ -f "$Q/queue.json" ]; then
  EXISTING=$(python3 - "$Q/queue.json" "$REQUEST_SHA" <<'PY'
import json,sys
try: jobs=json.load(open(sys.argv[1])).get('jobs',[])
except Exception: jobs=[]
for j in jobs:
    if j.get('requestSha')==sys.argv[2]:
        print(j.get('id','')); break
PY
)
  if [ -n "$EXISTING" ]; then BRIDGE_STATE=duplicate; bridge_log info ALREADY_QUEUED "job=$EXISTING"; echo "already queued $EXISTING"; echo "$EXISTING"; exit 0; fi
fi

# ---- validate the request; prints: scope chapter resolution exportSha
if ! META=$(python3 - "$REQ" <<'PY'
import datetime, json, re, sys
try:
    r=json.load(open(sys.argv[1]))
except Exception as e:
    sys.exit('invalid JSON: '+str(e))
ok = r.get('v') == 1 and r.get('scope') in ('chapter', 'film') and r.get('resolution') in ('480p', '720p', '1080p', '4K') and isinstance(r.get('chapter'), str) and re.fullmatch(r'[a-z0-9-]{1,40}', r.get('chapter',''))
if not ok: sys.exit('need v:1, scope chapter|film, a valid chapter id, and resolution 480p|720p|1080p|4K')
if not isinstance(r.get('created'),str): sys.exit('created must be an ISO timestamp')
try: datetime.datetime.fromisoformat(r['created'].replace('Z','+00:00'))
except Exception: sys.exit('created must be an ISO timestamp')
if not isinstance(r.get('signature'),str) or not re.fullmatch(r'[0-9a-f]{16}',r['signature']): sys.exit('signature must be 16 lowercase hex characters')
sha=r.get('exportSha')
if sha is not None and (not isinstance(sha,str) or not re.fullmatch(r'[0-9a-f]{64}',sha)): sys.exit('exportSha must be null or 64 lowercase hex characters')
print(r['scope'],r['chapter'],r['resolution'],sha or '-')
PY
); then
  bridge_log warning REJECTED "reason=$(printf '%s' "$META" | tr '\n' ' ' | cut -c1-240)"
  echo "rejected render request: $META" >&2; BRIDGE_STATE=rejected; exit 2
fi
read -r SCOPE CHAPTER RES EXPORT_SHA <<< "$META"
STAMP=$(date -u +%Y%m%dT%H%M%S); ID=req-$STAMP
N=1; BASEID=$ID; while grep -q "\"id\": \"$ID\"" "$Q/queue.json" 2>/dev/null; do N=$((N+1)); ID=$BASEID-$N; done
TAG=$ID; WARN=

# ---- 1. wait for the Export cut that came with the request (or import it from the request's folder if the watcher didn't)
REQ_DIR=$(dirname "$REQ")
FOUND_EXPORT=$(python3 - "$ROOT/$HQ/director-exports" "$REQ_DIR" "$EXPORT_SHA" "$CHAPTER" "$ROOT/$HQ/review-cut.json" <<'PY'
import glob, hashlib, os, sys, time
exp_dir, req_dir, sha, chapter, rev_cut = sys.argv[1:6]
def file_sha(p):
    try: return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.isfile(p) else ''
    except OSError: return ''
if sha != '-':
    if os.path.isdir(exp_dir) and any(file_sha(os.path.join(exp_dir, n)) == sha for n in os.listdir(exp_dir)):
        sys.exit(0)
    if os.path.isdir(req_dir):
        for n in sorted(os.listdir(req_dir)):
            p = os.path.join(req_dir, n)
            if n.endswith('.json') and not n.startswith('Render-request-') and file_sha(p) == sha:
                print(p); sys.exit(0)
else:
    # When the user clicked Export cut just before Send to render PC, exportSha is null; pick up a newer Film-chapter-<chapter>*.json in REQ_DIR.
    rev_mtime = os.path.getmtime(rev_cut) if os.path.isfile(rev_cut) else 0
    existing = {file_sha(os.path.join(exp_dir, n)) for n in os.listdir(exp_dir)} if os.path.isdir(exp_dir) else set()
    candidates = []
    if os.path.isdir(req_dir):
        for p in glob.glob(os.path.join(req_dir, f'Film-chapter-{chapter}-*.json')):
            try:
                m = os.path.getmtime(p)
                if m > rev_mtime and time.time() - m < 3600 and file_sha(p) not in existing:
                    candidates.append((m, p))
            except OSError: pass
    if candidates:
        print( max(candidates)[1] )
PY
)
if [ -z "$FOUND_EXPORT" ] && [ "$EXPORT_SHA" != "-" ] && [ "${RENDER_REQ_IMPORT_WAIT:-240}" -gt 0 ]; then
  echo "waiting for the import of export ${EXPORT_SHA:0:12}…"
  if python3 - "$ROOT/$HQ/director-exports" "$EXPORT_SHA" "${RENDER_REQ_IMPORT_WAIT:-240}" <<'PY'
import hashlib, os, sys, time
d, sha, limit = sys.argv[1], sys.argv[2], float(sys.argv[3]); end = time.time() + limit
while True:
    if os.path.isdir(d):
        now = time.time()
        for n in os.listdir(d):
            p = os.path.join(d, n)
            try:
                if os.path.isfile(p) and now - os.path.getmtime(p) < 3600 and hashlib.sha256(open(p, 'rb').read()).hexdigest() == sha: sys.exit(0)
            except OSError: pass
    if time.time() > end: sys.exit(1)
    time.sleep(2)
PY
  then sleep "${RENDER_REQ_SETTLE:-10}"
  else WARN="the importer never copied this request's export into director-exports/ (watcher not running?); frozen without it"; echo "WARNING: $WARN" >&2; fi
fi

# ---- 2. freeze under the cut lock
exec 9>"$LOCK"
flock -w "${RENDER_REQ_LOCK_WAIT:-900}" 9 || { echo "cut lock busy for too long: $LOCK" >&2; exit 1; }
if [ -n "$FOUND_EXPORT" ] && [ -f "$FOUND_EXPORT" ]; then
  mkdir -p "$ROOT/$HQ/director-exports"
  FSHA=$(sha256sum "$FOUND_EXPORT" | cut -d' ' -f1)
  SAFE_BASE=$(basename "$FOUND_EXPORT" | tr ' ()' '___')
  DEST="$ROOT/$HQ/director-exports/export-${FSHA:0:12}-$SAFE_BASE"
  cp -p "$FOUND_EXPORT" "$DEST"
  echo "importing export $(basename "$FOUND_EXPORT") (${FSHA:0:12}) into $HQ…"
  python3 "$HERE/build-round8-director.py" "$ROOT/$HQ" --import "$DEST"
  python3 "$HERE/build-round8-director.py" "$ROOT/$HQ"
  python3 "$HERE/build-round8-director.py" "$ROOT/$HQ" --pages "$CHAPTER"
fi
python3 "$HERE/finish-intro.py" "$ROOT/$HQ" --titles-only
OUT=$("$HERE/freeze-inputs.sh" "$ROOT" "$TAG" "$HQ"); echo "$OUT"
MANIFEST=$(echo "$OUT" | tail -1 | cut -d: -f1); F=${MANIFEST%/manifest.txt}
LIVE=$(git -C "$ROOT" status --porcelain -- '*.mjs' '*.js' '*.cjs' | { grep -vE "exports/|tools/experience/|experience/|workshop-room\.mjs|workspace-3d\.mjs|catalog\.mjs|scene-product-reference\.mjs|preset-defaults\.mjs|scene-peripheral-layouts\.mjs|institutional-|campus-lived-in" || true; } | cut -c4- | sed 's/.* -> //')
python3 "$HERE/pin-inputs.py" "$ROOT" "$F" $PIN_ALWAYS $LIVE
python3 "$HERE/render-source-fixes.py" "$ROOT/$F"
mkdir -p "$ROOT/$F/request"; cp "$REQ" "$ROOT/$F/request/request.json"
RENDER_REQ_HERE="$HERE" python3 - "$ROOT" "$HQ" "$F" "$SCOPE" "$CHAPTER" "$RES" "$ID" "$WARN" "$REQUEST_SHA" <<'PY'
import hashlib, json, os, sys, time
root, hq, F, scope, chapter, res, jid, warn, request_sha = sys.argv[1:10]
os.chdir(root)
review = json.load(open(f'{hq}/review-cut.json'))
ids = [s['id'] for s in review['shots']]
if chapter not in ids: sys.exit(f'chapter {chapter!r} is not in {hq}/review-cut.json ({", ".join(ids)})')
index = ids.index(chapter); req = json.load(open(f'{F}/request/request.json'))
cut = review if scope == 'film' else {**{k: v for k, v in review.items() if k != 'shots'}, 'name': f'{review.get("name", "cut")} {chapter} (render request)', 'shots': [review['shots'][index]]}
cutp = f'{F}/request/cut.json'; open(cutp, 'w').write(json.dumps(cut, indent=1))
# the cut and the request join the freeze's manifest (sha256 size path url-path), so the render PC fetches them with the rest
mp = f'{F}/manifest.txt'; lines = open(mp).read().rstrip('\n').split('\n')
for p in (cutp, f'{F}/request/request.json'):
    b = open(p, 'rb').read(); lines.append(f'{hashlib.sha256(b).hexdigest()} {len(b)} {p} {p}')
open(mp, 'w').write('\n'.join(lines) + '\n')
H = {'480p': 480, '720p': 720, '1080p': 1080, '4K': 2160}
job = {'id': jid, 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'scope': scope, 'chapter': chapter, 'chapterIndex': index,
       'resolution': res, 'height': H[res], 'note': req.get('note') or '', 'manifest': mp, 'cut': cutp, 'shots': '0' if scope == 'chapter' else 'all',
       'requestCreated': req.get('created'), 'clientSignature': req.get('signature'), 'requestSha': request_sha, 'force': req.get('force') is True, 'status': 'queued'}
# chapter cache keys from the frozen copy of the film data (the freeze overlays the repo: freeze file first, live file otherwise)
import subprocess
kp = subprocess.run([sys.executable, os.path.join(os.environ['RENDER_REQ_HERE'], 'chapter-keys.py'), hq, '--root', root, '--overlay', F,
                     '--resolution', res, '--json'] + ([] if scope == 'film' else ['--chapter', chapter]), capture_output=True, text=True)
if kp.returncode == 0:
    ck = json.loads(kp.stdout); job['chapterKeys'] = ck['keys']; job['epoch'] = ck['epoch']
else: print('WARNING: chapter keys not computed (the render PC renders every chapter): ' + kp.stderr.strip()[-300:], file=sys.stderr)
if req.get('estimateMinutes') is not None: job['estimateMinutes'] = req['estimateMinutes']
if warn: job['warning'] = warn
# queue.json: read-modify-write under its own lock, replaced atomically so the render PC never fetches half a file
import fcntl
qd = 'exports/render-queue'; os.makedirs(qd, exist_ok=True)
with open(f'{qd}/.queue.lock', 'w') as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    qp = f'{qd}/queue.json'; q = json.load(open(qp)) if os.path.exists(qp) else {'jobs': []}
    if any(j.get('requestSha') == request_sha for j in q['jobs']):
        print('duplicate request already queued: ' + next(j['id'] for j in q['jobs'] if j.get('requestSha') == request_sha)); sys.exit(0)
    if any(j['id'] == jid for j in q['jobs']): sys.exit('duplicate job id ' + jid)
    q['jobs'].append(job); tmp = f'{qd}/.queue.json.{os.getpid()}.tmp'
    open(tmp, 'w').write(json.dumps(q, indent=1)); os.replace(tmp, qp)
print(f'queued {jid}: {scope} {chapter} {res} -> {mp}')
print(jid)
PY

BRIDGE_STATE=accepted
bridge_log info ACCEPTED "job=$ID scope=$SCOPE chapter=$CHAPTER resolution=$RES"
