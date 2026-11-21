#!/bin/bash
# usage: build-final.sh <plan name, e.g. d16o>   docs for both cuts -> importer + pass on scratch copies -> verify -> one-chapter cut files for the render
p=$1; cd /c/work/fixB
S=cinematic-intro-cut-vicos-3rd-cut; E=/f/eng-fixB/exports
mkdir -p final
node mkdocs.mjs p-$p.json "$E/$S/director-exports/export-1316b83131e3-Film-chapter-create-23-5-s-__23_.json" final/create-camera-seated-export.json || exit 1
node mkdocs.mjs p-$p.json "$E/$S-standing/director-exports/export-2371867380a2-Film-chapter-create-carry.json" final/create-camera-standing-export.json || exit 1
for c in $S $S-standing; do
  d=seated; [ "$c" = "$S-standing" ] && d=standing
  rm -rf imp/$c-imp; cp -r imp/$c-fp imp/$c-imp
  bash imp.sh "C:/work/fixB/imp/$c-imp" "C:/work/fixB/final/create-camera-$d-export.json" > final/import-$d.log 2>&1 || { cat final/import-$d.log; exit 1; }
  node verify-import.mjs p-$p.json imp/$c-fp imp/$c-imp > final/verify-$d.txt; echo "$d: $(tail -1 final/verify-$d.txt) ($(grep -c '^ok' final/verify-$d.txt) checks ok, $(grep -c '^FAIL' final/verify-$d.txt) failed)"
  node mkcut.mjs imp/$c-imp/review-cut.json C:/work/fixB/c-final-$d.json
done
