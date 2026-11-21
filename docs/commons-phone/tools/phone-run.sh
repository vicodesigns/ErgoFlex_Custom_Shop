#!/bin/bash
# usage: phone-run.sh <mode> <args...>  (mode: still|clip|list). server on 4952 from /f/eng-phone
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
mode=$1; shift
(cd /f/eng-phone && node tools/experience/render-server.cjs 4952 > /c/work/commons-phone/server.log 2>&1 &)
sleep 4
cd /f/eng-phone
case $mode in
 still) timeout 1500 node tools/experience/render-still.cjs --server http://127.0.0.1:4952 "$@";;
 clip) timeout 2400 node tools/experience/render-cut.cjs --server http://127.0.0.1:4952 "$@";;
 probe) timeout 900 node tools/experience/probe-bones.cjs --server http://127.0.0.1:4952 "$@";;
 list) timeout 900 node tools/experience/render-cut.cjs --server http://127.0.0.1:4952 "$@";;
esac
echo "rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4952' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
