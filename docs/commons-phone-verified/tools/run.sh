#!/bin/bash
# run.sh <logfile> <node script under tools/experience> <args...>
# Starts a render server for F:/eng-cphone on port 4961, runs the script against it, stops ONLY that server.
# Meant to be called through: IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh <name> <timeout> bash /c/work/cphone/run.sh ...
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
log=$1; script=$2; shift 2
cd /f/eng-cphone
node tools/experience/render-server.cjs 4961 > /c/work/cphone/server.log 2>&1 &
spid=$!
sleep 4
node "tools/experience/$script" --server http://127.0.0.1:4961 "$@" > "$log" 2>&1
rc=$?
echo "rc=$rc" >> "$log"
kill $spid 2>/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4961' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
exit $rc
