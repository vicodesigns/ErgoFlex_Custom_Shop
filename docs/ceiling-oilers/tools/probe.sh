#!/bin/bash
# usage: probe.sh <cutjson name in C:\work\fixC> <outdir name> <times csv> [extra]
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; times=$3; shift 3
(cd /f/eng-fixC && node tools/experience/render-server.cjs 4988 > /c/work/fixC/server.log 2>&1 &)
sleep 4
mkdir -p /c/work/fixC/$out
(cd /f/eng-fixC && timeout 2400 node tools/experience/fixc-probe-tmp.cjs --cut 'C:\work\fixC\'"$cut"'.json' --shots 0 --times "$times" --out 'C:\work\fixC\'"$out" --server http://127.0.0.1:4988 "$@" > /c/work/fixC/$out.log 2>&1); echo "probe rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4988' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
