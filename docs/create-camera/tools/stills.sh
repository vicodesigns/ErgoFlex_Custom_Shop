#!/bin/bash
# usage: stills.sh <cutjson name in C:\work\fixB> <outdir name> <at fractions> [size]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; at=$3; size=${4:-1280x720}
(cd /f/eng-fixB && node tools/experience/render-server.cjs 4977 > /c/work/fixB/server.log 2>&1 &)
sleep 4
(cd /f/eng-fixB && timeout 1500 node tools/experience/render-still.cjs --cut 'C:\work\fixB\'"$cut"'.json' --shots 0 --at $at --size $size --out 'C:\work\fixB\'"$out" --server http://127.0.0.1:4977 > /c/work/fixB/$out.log 2>&1); echo "render rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4977' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
