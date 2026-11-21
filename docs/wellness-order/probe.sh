#!/bin/bash
# usage: probe.sh <cut json path (C:/...)> <log path> [extra probe args]   server 4977 from F:/eng-vwell, killed after
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; log=$2; shift 2
(cd /f/eng-vwell && node tools/experience/render-server.cjs 4977 > /c/work/vwell/server-probe.log 2>&1 &)
sleep 4
(cd /f/eng-vwell && node docs/wellness-order/wellness-probe.cjs --cut "$cut" --log "$log" --server http://127.0.0.1:4977 "$@"); rc=$?; echo "probe rc=$rc"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4977' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
exit $rc
