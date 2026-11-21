#!/bin/bash
# usage: clip.sh <cutjson name in C:\work\fixB> <outdir name> [size] [extra render-cut args]
# renders the cut's shots as video through the real render path (render-cut.cjs) from the F:\eng-fixB worktree
export CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
cut=$1; out=$2; size=${3:-854x480}; shift 3
(cd /f/eng-fixB && node tools/experience/render-server.cjs 4977 > /c/work/fixB/server.log 2>&1 &)
sleep 4
(cd /f/eng-fixB && node tools/experience/render-cut.cjs --cut 'C:\work\fixB\'"$cut"'.json' --shots all --out 'C:\work\fixB\'"$out" --size $size --video --server http://127.0.0.1:4977 "$@" > /c/work/fixB/$out.log 2>&1); echo "render rc=$?"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'render-server.cjs 4977' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
