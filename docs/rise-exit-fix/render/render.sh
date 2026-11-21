#!/bin/bash
# One render job against this worktree's stage (its own static server on port 4961, stopped afterwards).
#   render.sh clip  <cut.json> <out dir> [size=854x480]          -> <out dir>/00.mkv (render-cut --video; the cut's renderRange)
#   render.sh still <cut.json> <out dir> <fractions> [size]       -> <out dir>/... (render-still)
# Run it through the GPU lock: IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh <name> <timeout> bash render.sh ...
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO=/f/eng-rexit; PORT=4973; mode=$1; cut=$2; out=$3
stop(){ powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs $PORT' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; }
stop; (cd $REPO && node tools/experience/render-server.cjs $PORT > "$out.server.log" 2>&1 &)
sleep 4; mkdir -p "$out"
if [ "$mode" = clip ]; then
  (cd $REPO && timeout 3000 node tools/experience/render-cut.cjs --cut "$cut" --shots all --out "$out" --size ${4:-854x480} --video --server http://127.0.0.1:$PORT); rc=$?
else
  (cd $REPO && timeout 1500 node tools/experience/render-still.cjs --cut "$cut" --shots 0 --at "$4" --size ${5:-854x480} --out "$out" --server http://127.0.0.1:$PORT); rc=$?
fi
stop; echo "render rc=$rc"; exit $rc
