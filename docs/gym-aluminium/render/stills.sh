#!/bin/bash
# Stills (and a material probe) of one chapter of Vico's 3rd cut, as the film renders it (--quality hq13, the college seed,
# the Studio state's room slice), against this worktree's stage (own static server on port 4981, stopped afterwards).
#   stills.sh <chapter id> <out dir> <fractions> [size=1920x1080] [probe.js]
# Through the GPU lock:  IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh gym-alu 1800 bash docs/gym-aluminium/render/stills.sh wellness <out> 0.1,0.5
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO=/f/eng-gym; PORT=4981; ch=$1; out=$2; at=$3; size=${4:-1920x1080}; probe=$5
CUT=${CUT:-exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json}
stop(){ powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs $PORT' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; }
(cd $REPO && node docs/gym-aluminium/render/mkprobe.cjs) || exit 1
stop; (cd $REPO && node tools/experience/render-server.cjs $PORT > "$out.server.log" 2>&1 &)
sleep 4; mkdir -p "$out"
seed=college-seed; [ "$ch" = coast ] && seed=occ-seed; [ "$ch" = hero ] && seed=finale-seed
(cd $REPO && timeout 1500 node tools/experience/_gym-still.cjs --cut "$CUT" --shots "$ch" --at "$at" --size $size --out "$out" \
  --quality hq13 --storage exports/cinematic-intro-20261030/post/$seed.json --state-keys ergoflex.sceneAssets.v1 \
  ${probe:+--probe "$probe"} --server http://127.0.0.1:$PORT); rc=$?
stop; echo "render rc=$rc"; exit $rc
