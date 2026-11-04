#!/bin/bash
# HQ10 chapter renders at 2560x1440 (Vico: "slightly higher resolution").
# Polish's gate (round 5, approved 00:14): launch only while MemAvailable > 8 GB, /proc/pressure/memory some avg10 < 5
# and swap used < 15500 MB; at most 2 video renders machine-wide; cores 2-7,10-15 at nice 19; no swapoff / new swap.
# Round 7 (Polish, 2026-11-04): renders pinned to 4-7,12-15 (2,3,10,11 stay free for Vico's desktop); heavy.lock is
# held only for the launch-gate check; the gate adds CPU PSI some avg10 < 15; the 2nd slot starts >= 5 min after the 1st;
# touch /tmp/claude-1000/hq12-one-slot to drop to one slot at once (running renders finish, nothing new starts).
# Pressure rule: PSI avg10 > 10 for 20 s, or MemAvailable < 4 GB at any moment -> kill the newest render; its job requeues
# itself (never SIGSTOP: a long stop breaks puppeteer's CDP).
# Usage: render-queue-1440.sh chapterId[:seed] ...   seed occ|none|finale-a|finale-b, default college.
# The shot index is looked up by id at launch; each chapter renders into renders-new/1440/<id>/ (link by id).
# finale-a / finale-b render sub-shots 0,1,2 / 3,4,5 of shots/13-subshots.json into renders-new/1440/finale/.
cd /home/ergo/ErgoFlex_Custom_Shop; H=exports/cinematic-intro-20261104-hq12; O=$H/renders-new/1440; mkdir -p $O
COLLEGE=exports/cinematic-intro-20261030/post/college-seed.json; OCC=$H/post/occ-seed.json; FINALE=$H/post/finale-seed.json
RC="taskset -c 4-7,12-15 nice -n 19 node tools/experience/render-cut.cjs --video --blur 4 --ss 1.5 --size 2560x1440"
mem() { awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo; }
psi() { awk '/^some/{split($2,a,"="); print a[2]}' /proc/pressure/memory; }
swap() { free -m | awk '/Swap/{print $3}'; }
stat() { echo "mem $(mem) GB, psi $(psi), cpu psi $(cpsi), swap $(swap) MB"; }
videos() { ps -C node -o args= | grep -c "render-cut[.]cjs.*--video"; }
cpsi() { awk '/^some/{split($2,a,"="); print a[2]}' /proc/pressure/cpu; }
slots() { [ -e /tmp/claude-1000/hq12-one-slot ] && echo 1 || echo 2; }
gate() { awk -v p="$(psi)" -v c="$(cpsi)" 'BEGIN{exit !(p < 5 && c < 15)}' && [ "$(mem)" -gt 8 ] && [ "$(swap)" -lt 15500 ] && [ "$(videos)" -lt "$(slots)" ]; }
ok() { local r; exec 9>/tmp/claude-1000/heavy.lock; flock 9; gate; r=$?; flock -u 9; exec 9>&-; return $r; }   # heavy.lock only for the check
tree() { local p=$1; echo $p; for c in $(pgrep -P $p); do tree $c; done; }
watchdog() { local hot=0 newest   # round 7 (Polish): kill + requeue at once, never SIGSTOP
  while sleep 5; do
    if awk -v p="$(psi)" 'BEGIN{exit !(p > 10)}'; then hot=$((hot+5)); else hot=0; fi
    if [ $hot -ge 20 ] || [ "$(mem)" -lt 4 ]; then
      newest=$(ps -C node -o pid=,args= --sort=start_time | grep "render-cut[.]cjs.*--video" | tail -1 | awk '{print $1}')
      [ -n "$newest" ] && { kill -KILL $(tree $newest) 2>/dev/null; echo "$(date +%T) KILLED $newest under pressure; its job requeues ($(stat))"; hot=0; sleep 30; }
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
  sleep 300   # the next slot is gated on a settled host
done
wait $(jobs -rp | grep -v "^$WD$")
kill $WD; echo "$(date +%T) queue done"
