#!/bin/bash
# One stage job against F:\eng-coast (its own static server on port 4967, stopped afterwards).
#   run.sh probe <cut.json> <out dir> <times csv> <bone regex>   -> <out dir>/probe.jsonl (probe-bones.cjs --list-screens)
#   run.sh clip  <cut.json> <out dir> [size=1920x1080]           -> <out dir>/01.mkv (render-cut --video; the cut's renderRange)
# Run it through the GPU lock: IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh <name> <timeout> bash run.sh ...
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO=/f/eng-coast; PORT=4967; mode=$1; cut=$2; out=$3
stop(){ powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs $PORT' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; }
stop; mkdir -p "$out"; (cd $REPO && node tools/experience/render-server.cjs $PORT > "$out/server.log" 2>&1 &)
sleep 4
if [ "$mode" = probe ]; then
  (cd $REPO && timeout 2400 node tools/experience/probe-bones.cjs (copy it there from docs/coast-hands/render/probe-bones.cjs) --cut "$cut" --shots 0 --list-screens --out "$out" --times "$4" --list-objects "$5" --paths 1 --server http://127.0.0.1:$PORT "${@:6}"); rc=$?
else
  (cd $REPO && timeout 3000 node tools/experience/render-cut.cjs --cut "$cut" --shots all --out "$out" --size ${4:-1920x1080} --video --server http://127.0.0.1:$PORT); rc=$?
fi
stop; echo "run rc=$rc"; exit $rc
