#!/bin/bash
# HQ10 chapter renders at 2560x1440 (Vico: "slightly higher resolution").
# Polish's gate (round 5, approved 00:14): launch only while MemAvailable > 8 GB, /proc/pressure/memory some avg10 < 5
# and swap used < 15500 MB; at most 2 video renders machine-wide; cores 2-7,10-15 at nice 19; no swapoff / new swap.
# Pressure rule: PSI avg10 > 10 for 20 s, or MemAvailable < 4 GB at any moment -> SIGSTOP the newest render for at most
# 2 min, then kill it; its job requeues itself (a SIGSTOP longer than a few minutes breaks puppeteer's CDP anyway).
# Usage: render-queue-1440.sh chapterId[:seed] ...   seed occ|none|finale-a|finale-b, default college.
# The shot index is looked up by id at launch; each chapter renders into renders-new/1440/<id>/ (link by id).
# finale-a / finale-b render sub-shots 0,1,2 / 3,4,5 of shots/13-subshots.json into renders-new/1440/finale/.
cd /home/ergo/ErgoFlex_Custom_Shop; H=exports/cinematic-intro-20261103-hq11; O=$H/renders-new/1440; mkdir -p $O
COLLEGE=exports/cinematic-intro-20261030/post/college-seed.json; OCC=$H/post/occ-seed.json; FINALE=$H/post/finale-seed.json
RC="taskset -c 2-7,10-15 nice -n 19 node tools/experience/render-cut.cjs --video --blur 4 --ss 1.5 --size 2560x1440"
mem() { awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo; }
psi() { awk '/^some/{split($2,a,"="); print a[2]}' /proc/pressure/memory; }
swap() { free -m | awk '/Swap/{print $3}'; }
stat() { echo "mem $(mem) GB, psi $(psi), swap $(swap) MB"; }
videos() { ps -C node -o args= | grep -c "render-cut[.]cjs.*--video"; }
ok() { [ "$(mem)" -gt 8 ] && awk -v p="$(psi)" 'BEGIN{exit !(p < 5)}' && [ "$(swap)" -lt 15500 ] && [ "$(videos)" -lt 2 ]; }
tree() { local p=$1; echo $p; for c in $(pgrep -P $p); do tree $c; done; }
watchdog() { local hot=0 stopped="" since=0
  while sleep 5; do
    if awk -v p="$(psi)" 'BEGIN{exit !(p > 10)}'; then hot=$((hot+5)); else hot=0; fi
    if [ -z "$stopped" ] && { [ $hot -ge 20 ] || [ "$(mem)" -lt 4 ]; }; then
      stopped=$(ps -C node -o pid=,args= --sort=start_time | grep "render-cut[.]cjs.*--video" | tail -1 | awk '{print $1}')
      [ -n "$stopped" ] && { kill -STOP $(tree $stopped) 2>/dev/null; since=$SECONDS; echo "$(date +%T) PAUSED $stopped ($(stat))"; }
    elif [ -n "$stopped" ] && [ $((SECONDS - since)) -ge 120 ]; then
      t=$(tree $stopped); kill -KILL $t 2>/dev/null; echo "$(date +%T) KILLED $stopped after 2 min paused; its job requeues ($(stat))"; stopped=""
    elif [ -n "$stopped" ] && ! ps -p $stopped >/dev/null; then stopped=""
    fi
  done; }
job() { local name=$1 seed=$2 st cut out shot n
  case "$seed" in occ) st="--storage $OCC";; finale-*) st="--storage $FINALE";; none) st="";; *) st="--storage $COLLEGE";; esac
  cut=$H/review-cut.json; out=$O/$name
  case "$seed" in finale-a) cut=$H/shots/13-subshots.json; out=$O/finale; shot=0,1,2;; finale-b) cut=$H/shots/13-subshots.json; out=$O/finale; shot=3,4,5;;
    *) shot=$(python3 -c "import json; print(next(i for i,s in enumerate(json.load(open('$cut'))['shots']) if s['id']=='$name'))");; esac
  for n in 1 2 3; do
    [ $n -gt 1 ] && { until ok; do sleep 5; done; echo "$(date +%T) retry $name #$n ($(stat))"; }
    $RC --cut $cut --shots $shot --out $out $st > $O/q-$name.log 2>&1 && { echo "$(date +%T) done $name"; return 0; }
    echo "$(date +%T) FAILED $name (attempt $n): $(grep -m1 -oE '[A-Za-z]+Error: [^.]*' $O/q-$name.log)"; sleep 10
  done; }
watchdog & WD=$!
for j in "$@"; do
  IFS=: read -r name seed <<< "$j"
  until ok; do sleep 5; done
  echo "$(date +%T) start $name ($(stat))"
  job "$name" "$seed" &
  sleep 30
done
wait $(jobs -rp | grep -v "^$WD$")
kill $WD; echo "$(date +%T) queue done"
