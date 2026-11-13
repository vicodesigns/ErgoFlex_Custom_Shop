#!/bin/bash
# freeze-inputs.sh <repo root> <tag> <extra export dir>...  -> <root>/exports/cinematic-intro-20261104-<tag>-freeze-rev<N>/manifest.txt
# The scratchpad freeze.sh, parameterised by the repo root (so the render-request flow can be tested in a copy), with the
# two file lists it read from the scratchpad kept next to this script in freeze-lists/ (win-exports.txt: the exports the
# Windows renderer needs, screens clips included; untracked-app-reference.txt: the app-reference files that are not in git).
# exports/render-queue/ (the queue itself and its lock files, tracked in git) never goes into a manifest: it changes with
# every job, and the render PC's check of a job failed on it (2026-11-10).
# Every file the freeze does not copy into its own folder (models, images, sound, clips: about 2.3 GB) gets a stored copy
# by content in exports/render-blobs/ and a url-path to it (freeze-blobs.py), so nothing a manifest lists is read from the
# live checkout: a merge or a rebuild after the freeze cannot fail the render PC's sha check (2026-11-13). FREEZE_BLOBS=0
# leaves those lines as they were (path only).
# Override the lists dir with FREEZE_LISTS=<dir>. Prints "<manifest>: N files, rev R" as its last line.
HERE=$(cd "$(dirname "$0")" && pwd); S=${FREEZE_LISTS:-$HERE/freeze-lists}
[ -d "$1" ] || { echo "usage: freeze-inputs.sh <repo root> <tag> <extra export dir>..." >&2; exit 2; }
cd "$1" || exit 1; TAG=$2; shift 2
REV=$(python3 -c "import json;print(json.load(open('studio-state.json'))['rev'])"); F=exports/cinematic-intro-20261104-$TAG-freeze-rev$REV; [ -e $F ] && { echo "exists $F"; exit 1; }
MUT=$( { git diff --name-only; git ls-files --others --exclude-standard -- '*.mjs' '*.js' '*.cjs' ':!exports' ':!node_modules' ':!app-reference' ':!divi-editor' ':!docs';
  git ls-files --others --exclude-standard -- 'assets/props/people-*.glb' 'assets/props/people.json';   # people the Director built on request (not committed yet)
  echo studio-state.json;   # always frozen (it was inside the comment above: a clean studio-state.json made the freeze fail)
  # Also freeze committed code changed since Win's base and the film's JSON: a later commit or Director import here must not
  # change what a queued job renders (2026-11-07: HEAD moved after a freeze and Win's sha checks failed on 11 files).
  git diff --name-only 650da42 HEAD -- '*.mjs' '*.js' '*.cjs' '*.py' '*.css' '*.html' ':!exports' 2>/dev/null; for d in "$@"; do find -L "$d" -type f -name '*.json' ! -path '*/renders*' ! -path '*/director-exports/*'; done; } | sort -u | while read f; do [ -f "$f" ] && echo "$f"; done)
mkdir -p $F; for f in $MUT; do mkdir -p $F/$(dirname $f); cp -p "$f" "$F/$f"; done
EXTRA=$(for d in "$@"; do find -L "$d" -type f ! -name '*.mkv' ! -name '*.mp4' ! -path '*/renders*' ! -path '*/final/*.mp4'; done)
FREV=$(python3 -c "import json;print(json.load(open('$F/studio-state.json'))['rev'])"); M=$F/manifest.txt
{ echo "# $TAG frozen inputs: Desk 02 $(git rev-parse --short HEAD), studio-state rev $FREV, frozen $(date -Is). Columns: sha256 size path [url-path]; fetch base+url-path (default path), write to path. Overlay onto a clone at 036ccc1 or later."
  for p in $( { grep -v '\.html$' $S/win-exports.txt; grep -E '^app-reference/' $S/untracked-app-reference.txt | grep -vE '^app-reference/demo_tts/|\.html$|\.last_build_id$'; git diff --name-only 650da42 HEAD 2>/dev/null | grep -v '^exports/render-queue/'; echo "$EXTRA"; } | sort -u); do [ -f "$p" ] || continue; echo "$MUT" | grep -qxF "$p" && continue; printf '%s %s %s\n' "$(sha256sum < "$p" | cut -d' ' -f1)" "$(stat -Lc %s "$p")" "$p"; done
  for p in $MUT; do printf '%s %s %s %s\n' "$(sha256sum < "$F/$p" | cut -d' ' -f1)" "$(stat -c %s "$F/$p")" "$p" "$F/$p"; done; } > $M
[ "${FREEZE_BLOBS:-1}" = 0 ] || python3 "$HERE/freeze-blobs.py" . "$F" || { echo "freeze-blobs.py failed for $F" >&2; exit 1; }
echo "$F/manifest.txt: $(($(wc -l < $M)-1)) files, rev $FREV"
