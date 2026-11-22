#!/bin/bash
# imp.sh <name> <export doc> <patch json>: scratch copy of the CURRENT seated cut (backup) -> importer (--import + pass, no pages) -> apply_hand -> diffs
n=$1; doc=$2; patch=$3
W=/c/work/cphone
export PYTHONUTF8=1 PYTHONHOME='C:\Python312' PATH="/c/work/cphone/py3:$PATH"
rm -rf $W/imp/$n && cp -a $W/backup/cut-d4cd5fb3 $W/imp/$n
python3 F:/eng-cphone/tools/experience/build-round8-director.py C:/work/cphone/imp/$n --import "$doc" > $W/imp/$n.import.log 2>&1 || { echo import failed; exit 1; }
python3 F:/eng-cphone/tools/experience/build-round8-director.py C:/work/cphone/imp/$n > $W/imp/$n.pass.log 2>&1 || { echo pass failed; exit 1; }
python3 C:/work/cphone/tools/apply_hand.py C:/work/cphone/imp/$n "$patch"
python3 $W/tools/dirdiff.py C:/work/cphone/imp/base C:/work/cphone/imp/$n > $W/imp/$n.dirdiff.txt
python3 $W/tools/chapdiff.py C:/work/cphone/imp/base C:/work/cphone/imp/$n > $W/imp/$n.chapdiff.txt
grep -v "no change" $W/imp/$n.pass.log
echo "files changed:"; grep "^FILE" $W/imp/$n.dirdiff.txt
