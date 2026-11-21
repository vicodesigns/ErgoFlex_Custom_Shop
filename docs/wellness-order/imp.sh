#!/bin/bash
# usage: imp.sh <scratch name> <export doc>   fresh copy of the worktree's cut in C:/work/vwell/imp/<name>/cinematic-intro-cut-vicos-3rd-cut, importer + pass
export PY3DIR=/c/Users/Vico/AppData/Local/Temp/claude/9f9a2178443cce16/9896766a-9d08-4fdf-b0bc-a6cdbccb1d61/scratchpad/py3
export PATH="$PY3DIR:$PATH" PYTHONIOENCODING=utf-8
name=$1; doc=$2; D=/c/work/vwell/imp/$name; rm -rf "$D"; mkdir -p "$D"
cp -r /f/eng-vwell/exports/cinematic-intro-cut-vicos-3rd-cut "$D/"
H="$D/cinematic-intro-cut-vicos-3rd-cut"
cd /f/eng-vwell
if [ -n "$doc" ]; then python3 tools/experience/build-round8-director.py "$H" --import "$doc" || exit 1; fi
python3 tools/experience/build-round8-director.py "$H" || exit 1
