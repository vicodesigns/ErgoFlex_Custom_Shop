#!/bin/bash
# HQ9 renders, at most 3 at a time (Vico: max out; Polish's limits: <=3 headless renders,
# MemAvailable > 6 GB before each launch, cores 2-7,10-15). Swap gate (Polish, after the HQ9 window): launch only while
# `free -m` Swap used < 13000 MB, and run at most 2 at a time while it is above 12000 MB.
cd /home/ergo/ErgoFlex_Custom_Shop; H9=exports/cinematic-intro-20261103-hq9; O=$H9/renders-new; SEED=exports/cinematic-intro-20261030/post/college-seed.json
RC="taskset -c 2-7,10-15 node tools/experience/render-cut.cjs --video --blur 4 --ss 1.5"
jobs=(
 "finA|$RC --cut $H9/shots/13-subshots.json --shots 0,1,2 --out $O/finale --storage $H9/post/finale-seed.json"
 "finB|$RC --cut $H9/shots/13-subshots.json --shots 3,4,5 --out $O/finale --storage $H9/post/finale-seed.json"
 "ch03|$RC --cut $H9/review-cut.json --shots 2 --out $O --storage $SEED"
 "ch12|$RC --cut $H9/review-cut.json --shots 11 --out $O --storage $SEED"
 "ch02|$RC --cut $H9/review-cut.json --shots 1 --out $O --storage $SEED"
 "ch06|$RC --cut $H9/review-cut.json --shots 5 --out $O"
 "ch04|$RC --cut $H9/review-cut.json --shots 3 --out $O --storage $SEED"
 "ch09|$RC --cut $H9/review-cut.json --shots 8 --out $O --storage $SEED")
swap() { free -m | awk '/Swap/{print $3}'; }
ok() { local m s n; m=$(awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo); s=$(swap); n=$(jobs -rp | wc -l)
  [ "$m" -gt 6 ] && [ "$s" -lt 13000 ] && { [ "$n" -lt 2 ] || { [ "$n" -lt 3 ] && [ "$s" -le 12000 ]; }; }; }
for j in "${jobs[@]}"; do
  name=${j%%|*}; cmd=${j#*|}
  until ok; do sleep 5; done
  echo "$(date +%T) start $name (mem $(awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo) GB, swap $(swap) MB)"
  ( $cmd > $O/q-$name.log 2>&1 && echo "$(date +%T) done $name" || echo "$(date +%T) FAILED $name" ) &
  sleep 20
done
wait
taskset -c 2-7,10-15 python3 tools/experience/join-subshots.py $H9/shots/13-subshots.json $O/finale $O/13.mkv --transition fade && echo "$(date +%T) joined finale"
echo "$(date +%T) queue done"
