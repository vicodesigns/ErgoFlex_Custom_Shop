#!/bin/bash
# usage: stills.sh <cut-name (in C:\work\rise-pull)> <outdir name> <at fractions> [size]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; at=$3; size=${4:-1280x720}
cutp='C:\work\rise-pull\'"$cut"'.json'; outp='C:\work\rise-pull\'"$out"
(cd /f/eng-pull && node tools/experience/render-server.cjs 4951 > /c/work/rise-pull/server.log 2>&1 &)
sleep 4
(cd /f/eng-pull && timeout 900 node tools/experience/render-still.cjs --cut "$cutp" --shots 0 --at $at --size $size --out "$outp" --server http://127.0.0.1:4951 > /c/work/rise-pull/$out.log 2>&1); echo "render rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4951' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
