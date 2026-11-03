#!/usr/bin/env bash
# Reproduce the chapter-2 tablet app capture (see ../APP-CAPTURE.md). Read-only against the demo at :4190.
# Needs: free -m "available" >= 6000 MB, no other Chrome of yours running, ffmpeg, python3 + Pillow.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); WORK=${WORK:-/tmp/app-capture}; mkdir -p "$WORK"
avail=$(free -m | awk '/Mem/{print $7}'); [ "$avail" -ge 6000 ] || { echo "only ${avail} MB available; wait"; exit 1; }
VCLOCK=$HERE/vclock.js node "$HERE/ctl.cjs" > "$WORK/ctl.log" 2>&1 & CTL=$!; trap 'curl -s -X POST localhost:4799/quit >/dev/null || kill $CTL' EXIT
sleep 3
c(){ curl -s -m 120 -X POST "localhost:4799/$1" -d "$2" >/dev/null; sleep "${3:-2}"; }
# Demo onboarding at a 1600x1000 viewport (CSS px): Start the live demo, Next, Skip, age 36-45, mobility Full, Next x3, Done, Take me to my desk.
c vp '{"w":1600,"h":1000,"dpr":2}' 1; c goto '{"url":"http://127.0.0.1:4190/"}' 8
c click '{"x":800,"y":806}' 6; c click '{"x":1537,"y":964}' 3; c click '{"x":1454,"y":964}' 3
c click '{"x":800,"y":274}' 2; c click '{"x":200,"y":427}' 2; c click '{"x":800,"y":342}' 2; c click '{"x":200,"y":351}' 2
c click '{"x":1537,"y":964}' 4; c click '{"x":1537,"y":960}' 3; c click '{"x":1537,"y":960}' 3; c click '{"x":1535,"y":964}' 5; c click '{"x":800,"y":713}' 6
# (If the age/mobility dropdowns miss, the screen stays on "Comfort & Body Baseline": pick them by hand via /click and continue.)
for o in land port; do
  python3 -c "import json;c=json.load(open('$HERE/cfg-$o.json'));c['out']='$WORK/$o';json.dump(c,open('$WORK/cfg-$o.json','w'))"
  sed "s#process.env.CAPCFG#'$WORK/cfg-$o.json'#" "$HERE/capture.js" > "$WORK/cap-$o.js"
  python3 -c "import json;print(json.dumps({'code':open('$WORK/cap-$o.js').read()}))" > "$WORK/req-$o.json"
  curl -s -m 3600 -X POST localhost:4799/run -d @"$WORK/req-$o.json"; echo
done
python3 "$HERE/compose.py" "$WORK/cfg-land.json" "$WORK/02-tablet-app.mp4" 2160 1440 "$WORK/stills"
python3 "$HERE/compose.py" "$WORK/cfg-port.json" "$WORK/02-tablet-app-portrait.mp4" 1440 2160 "$WORK/stills"
