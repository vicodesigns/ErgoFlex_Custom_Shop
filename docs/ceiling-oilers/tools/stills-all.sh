#!/bin/bash
# usage: stills.sh <cutjson name in C:\work\fixC> <outdir name> <at fractions> [size] [extra args]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; at=$3; size=${4:-1280x720}; shift 4
(cd /f/eng-fixC && node tools/experience/render-server.cjs 4988 > /c/work/fixC/server.log 2>&1 &)
sleep 4
(cd /f/eng-fixC && timeout 1500 node tools/experience/render-still.cjs --cut 'C:\work\fixC\'"$cut"'.json' --shots all --at $at --size $size --out 'C:\work\fixC\'"$out" --server http://127.0.0.1:4988 "$@" > /c/work/fixC/$out.log 2>&1); echo "render rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4988' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
