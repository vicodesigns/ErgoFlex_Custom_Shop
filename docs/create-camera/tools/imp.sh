#!/bin/bash
# usage: imp.sh <scratch cut dir> [export doc]   runs the Director importer (if a doc is given) and then the pass, on a scratch copy outside the repo
export PY3DIR=/c/Users/Vico/AppData/Local/Temp/claude/9f9a2178443cce16/9896766a-9d08-4fdf-b0bc-a6cdbccb1d61/scratchpad/py3
export PATH="$PY3DIR:$PATH"
H=$1; doc=$2
cd /f/eng-fixB
if [ -n "$doc" ]; then python3 tools/experience/build-round8-director.py "$H" --import "$doc" || exit 1; fi
python3 tools/experience/build-round8-director.py "$H" || exit 1
