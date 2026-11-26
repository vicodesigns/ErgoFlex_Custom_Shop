#!/bin/bash
# v-cuts-sync.sh [--no-score]
# Brings the two V cuts (tools/experience/build-v-cuts.py) in step with the live "Vicos 3rd cut" and hands them to the
# main checkout for rendering. Run from the V cuts worktree, after rebasing film/v-cuts onto the tip the film renders from.
#   1. copies the main checkout's live 3rd cut data (its working state, backups left out) and studio-state.json here
#   2. rebuilds both cuts from it (grade, mix, titles, opener trim, order, score, Director pages)
#   3. copies the two cut folders into the main checkout's exports/ (new, untracked folders; nothing else is written there)
#   4. prints each cut's 4K 60 fps chapter keys, by the render PC's fixed slot list for the directors cut
# It queues nothing: render requests go through Orch (see the request drafts next to the cuts' notes).
set -euo pipefail
WT=$(cd "$(dirname "$0")/../.." && pwd); MAIN=${MAIN:-/home/ergo/ErgoFlex_Custom_Shop}
BASE=exports/cinematic-intro-cut-vicos-3rd-cut; HQ=exports/cinematic-intro-20261104-hq14
[ "$WT" != "$MAIN" ] || { echo "run this from the V cuts worktree, not the main checkout" >&2; exit 1; }
rsync -a --delete --exclude='*.pre-*' --exclude='director-exports/' "$MAIN/$BASE/" "$WT/$BASE/"
cp "$MAIN/studio-state.json" "$WT/studio-state.json"
python3 "$WT/tools/experience/build-v-cuts.py" "$@" | grep -Ev "screen clip not on this machine|^  master iter|^ch[0-9]+ .*no change$" || true
for c in v-polish v-directors; do
  python3 "$WT/tools/experience/build-cine-score.py" "$WT/exports/cinematic-intro-cut-$c" --check
  rsync -a --delete "$WT/exports/cinematic-intro-cut-$c/" "$MAIN/exports/cinematic-intro-cut-$c/"
done
T=$(mktemp -d)
for c in vicos-3rd-cut v-polish v-directors; do
  O=$T/$c/$HQ; mkdir -p "$O/shots" "$O/previews" "$O/post"; S=$MAIN/exports/cinematic-intro-cut-$c
  cp "$S/review-cut.json" "$S/titles-src.json" "$S/edl.json" "$O/"; cp "$S"/shots/*.json "$O/shots/"; cp "$S/previews/awaken-v5-cut.json" "$O/previews/"
  [ ! -f "$S/post/finale-seed.json" ] || cp "$S/post/finale-seed.json" "$O/post/"
  python3 "$WT/tools/experience/chapter-keys.py" "$HQ" --root "$MAIN" --overlay "$T/$c" --resolution 4K --fps 60 --json > "$T/$c.json"
done
python3 - "$T" <<'PY'
import json, sys
T = sys.argv[1]; k = {c: json.load(open(f'{T}/{c}.json')) for c in ('vicos-3rd-cut', 'v-polish', 'v-directors')}
fixed = ['awaken', 'rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'awareness', 'music', 'media', 'storage', 'hero']
live = k['vicos-3rd-cut']['keys']
print(f"epoch {k['v-polish']['epoch']}; 4K 60 fps keys")
print('polish: ' + ', '.join(c for c in live if k['v-polish']['keys'][c] != live[c]) + ' differ from the live 3rd cut' if any(k['v-polish']['keys'][c] != live[c] for c in live) else 'polish: all 12 keys equal the live 3rd cut')
print('directors (slot | slot name | chapter there | key | equal to the live 3rd cut):')
for i, (sl, cid) in enumerate(zip(fixed, k['v-directors']['keys'])):
    key = k['v-directors']['keys'][cid]; print(f"{i + 1:02d} | {sl} | {cid} | {key} | {'yes' if key == live[cid] else 'NO: renders'}")
PY
rm -rf "$T"
