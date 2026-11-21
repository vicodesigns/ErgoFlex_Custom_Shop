#!/bin/bash
# usage: clip.sh <cutjson name in C:\work\rise-pull> <outdir name> [size] [extra render-cut args]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; size=${3:-854x480}; shift 3
(cd /f/eng-pull && node tools/experience/render-server.cjs 4951 > /c/work/rise-pull/server.log 2>&1 &)
sleep 4
(cd /f/eng-pull && node tools/experience/render-cut.cjs --cut 'C:\work\rise-pull\'"$cut"'.json' --shots all --out 'C:\work\rise-pull\'"$out" --size $size --video --server http://127.0.0.1:4951 "$@" > /c/work/rise-pull/$out.log 2>&1); echo "render rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4951' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
