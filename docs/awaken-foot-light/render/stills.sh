#!/bin/bash
# Stills of awaken (Vico's 3rd cut) as the film renders it. Through the lock:
#  IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh foot 1800 bash docs/awaken-foot-light/render/stills.sh <cut.json> <out dir> <fractions> [size]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO=/f/eng-foot; PORT=4983; CUTF=$1; out=$2; at=$3; size=${4:-1920x1080}
stop(){ powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs $PORT' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; }
stop; (cd $REPO && node tools/experience/render-server.cjs $PORT > "$out.server.log" 2>&1 &)
sleep 4; mkdir -p "$out"
(cd $REPO && timeout 1700 node tools/experience/_foot-still.cjs --cut "$CUTF" --shots awaken --at "$at" --size $size --out "$out" \
  --quality hq13 --storage exports/cinematic-intro-20261030/post/college-seed.json --state-keys ergoflex.sceneAssets.v1 \
  --probe docs/awaken-foot-light/render/probe-foot.js --server http://127.0.0.1:$PORT); rc=$?
stop; echo "render rc=$rc"; exit $rc
