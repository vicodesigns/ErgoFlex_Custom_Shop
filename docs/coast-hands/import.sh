#!/bin/bash
# The Director importer's own steps for one export doc (what tools/experience/director-import-watch.py does with a download):
#   1. a copy in <cut>/director-exports/export-<sha12>-<name>.json
#   2. build-round8-director.py <cut> --import <copy>
#   3. the pass: build-round8-director.py <cut>
#   4. the chapter's page: build-round8-director.py <cut> --pages coast --downloads <cut>/director-import
#   5. the result in <cut>/director-exports/imports.json ({sha: {file, chapter, at, ok}})
# usage (from the repo root, or any folder holding exports/<cut>):  bash <repo>/docs/coast-hands/import.sh <repo> <cut dir> <doc>
# Windows: the scripts call `python3`; PY3DIR is a folder with python3.exe (a copy of Python 3.12's launcher).
set -e
REPO=$1; CUT=$2; DOC=$3
PY3DIR=${PY3DIR:-/c/work/vrise/py3}; export PATH="$PY3DIR:$PATH"; export PYTHONHOME=${PYTHONHOME:-'C:\Python312'}; export PYTHONIOENCODING=utf-8 PYTHONUTF8=1   # (UTF-8 mode: the scripts decode node output as text; cp1252 garbled the hero labels)
B="$REPO/tools/experience/build-round8-director.py"
name=$(basename "$DOC"); sha=$(sha256sum "$DOC" | cut -d' ' -f1); copy="$CUT/director-exports/export-${sha:0:12}-$name"
cp "$DOC" "$copy"
python3 "$B" "$CUT" --import "$copy"
python3 "$B" "$CUT"
python3 "$B" "$CUT" --pages coast --downloads "$CUT/director-import"
python3 - "$CUT/director-exports/imports.json" "$sha" "$name" <<'EOF'
import json, sys, time
p, sha, name = sys.argv[1:4]; d = json.load(open(p, encoding='utf-8'))
d[sha] = {'file': name, 'chapter': 'coast', 'at': time.time(), 'ok': True}
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=1) + '\n')   # (the watcher's own format)
EOF
echo "imported $name ($copy)"
