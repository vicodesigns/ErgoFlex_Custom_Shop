#!/bin/bash
# usage: clip.sh <cut json (C:/...)> <out dir (C:/...)> [size] [extra render-cut args]   server 4978 from F:/eng-vwell, killed after
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; size=${3:-854x480}; shift 3
(cd /f/eng-vwell && node tools/experience/render-server.cjs 4978 > /c/work/vwell/server-clip.log 2>&1 &)
sleep 4
(cd /f/eng-vwell && node tools/experience/render-cut.cjs --cut "$cut" --shots all --out "$out" --size $size --server http://127.0.0.1:4978 "$@"); rc=$?; echo "render rc=$rc"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4978' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
exit $rc
