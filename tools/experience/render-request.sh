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

# ---- validate the request; prints: scope chapter resolution exportSha
read -r SCOPE CHAPTER RES EXPORT_SHA < <(python3 - "$REQ" <<'PY'
import json, re, sys
r = json.load(open(sys.argv[1]))
ok = r.get('v') == 1 and r.get('scope') in ('chapter', 'film') and r.get('resolution') in ('480p', '720p', '1080p', '4K') \
    and isinstance(r.get('chapter'), str) and re.fullmatch(r'[a-z0-9-]{1,40}', r['chapter'] or '')
if not ok: sys.exit('bad render request: need v:1, scope chapter|film, resolution 480p|720p|1080p|4K, chapter id')
sha = r.get('exportSha') or '-'
if sha != '-' and not re.fullmatch(r'[0-9a-f]{64}', sha): sys.exit('bad exportSha')
print(r['scope'], r['chapter'], r['resolution'], sha)
PY
)
STAMP=$(date -u +%Y%m%dT%H%M%S); ID=req-$STAMP
N=1; BASEID=$ID; while grep -q "\"id\": \"$ID\"" "$Q/queue.json" 2>/dev/null; do N=$((N+1)); ID=$BASEID-$N; done
TAG=$ID; WARN=

# ---- 1. wait for the Export cut that came with the request
if [ "$EXPORT_SHA" != "-" ] && [ "${RENDER_REQ_IMPORT_WAIT:-240}" -gt 0 ]; then
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
OUT=$("$HERE/freeze-inputs.sh" "$ROOT" "$TAG" "$HQ"); echo "$OUT"
MANIFEST=$(echo "$OUT" | tail -1 | cut -d: -f1); F=${MANIFEST%/manifest.txt}
LIVE=$(git -C "$ROOT" status --porcelain -- '*.mjs' '*.js' '*.cjs' | { grep -vE "exports/|tools/experience/|experience/|institutional-|campus-lived-in" || true; } | cut -c4- | sed 's/.* -> //')
python3 "$HERE/pin-inputs.py" "$ROOT" "$F" $PIN_ALWAYS $LIVE
mkdir -p "$ROOT/$F/request"; cp "$REQ" "$ROOT/$F/request/request.json"
python3 - "$ROOT" "$HQ" "$F" "$SCOPE" "$CHAPTER" "$RES" "$ID" "$WARN" <<'PY'
import hashlib, json, os, sys, time
root, hq, F, scope, chapter, res, jid, warn = sys.argv[1:9]
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
       'requestCreated': req.get('created'), 'clientSignature': req.get('signature'), 'status': 'queued'}
if req.get('estimateMinutes') is not None: job['estimateMinutes'] = req['estimateMinutes']
if warn: job['warning'] = warn
# queue.json: read-modify-write under its own lock, replaced atomically so the render PC never fetches half a file
import fcntl
qd = 'exports/render-queue'; os.makedirs(qd, exist_ok=True)
with open(f'{qd}/.queue.lock', 'w') as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    qp = f'{qd}/queue.json'; q = json.load(open(qp)) if os.path.exists(qp) else {'jobs': []}
    if any(j['id'] == jid for j in q['jobs']): sys.exit('duplicate job id ' + jid)
    q['jobs'].append(job); tmp = f'{qd}/.queue.json.{os.getpid()}.tmp'
    open(tmp, 'w').write(json.dumps(q, indent=1)); os.replace(tmp, qp)
print(f'queued {jid}: {scope} {chapter} {res} -> {mp}')
print(jid)
PY
