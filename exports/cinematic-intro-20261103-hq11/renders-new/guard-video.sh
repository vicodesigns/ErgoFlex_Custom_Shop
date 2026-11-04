#!/bin/bash
# Polish round-5 rule (3): if PSI some avg10 > 10 for 20 s, SIGSTOP the newest *running* video render tree; resume the
# ones it paused when swap < 15000 MB and PSI < 5. The queue's own watchdog handles the first pause (stills probe).
psi() { awk '/^some/{split($2,a,"="); print a[2]}' /proc/pressure/memory; }
swap() { free -m | awk '/Swap/{print $3}'; }
tree() { local p=$1; echo $p; for c in $(pgrep -P $p); do tree $c; done; }
hot=0; mine=""
while sleep 5; do
  if awk -v p="$(psi)" 'BEGIN{exit !(p > 10)}'; then hot=$((hot+5)); else hot=0; fi
  if [ $hot -ge 20 ]; then
    v=$(ps -C node -o pid=,stat=,args= --sort=start_time | awk '$2 !~ /T/ && /render-cut[.]cjs/ && /--video/ {print $1}' | tail -1)
    [ -n "$v" ] && { kill -STOP $(tree $v) 2>/dev/null; mine="$mine $v"; hot=0; echo "$(date +%T) PAUSED video $v (psi $(psi), swap $(swap) MB)"; }
  elif [ -n "$mine" ] && [ "$(swap)" -lt 15000 ] && awk -v p="$(psi)" 'BEGIN{exit !(p < 5)}'; then
    for v in $mine; do kill -CONT $(tree $v) 2>/dev/null; echo "$(date +%T) RESUMED video $v (psi $(psi), swap $(swap) MB)"; done; mine=""
  fi
  { ps -C node -o args= | grep -q "render-cut[.]cjs.*--video" || ps -C bash -o args= | grep -q "render-queue-1440[.]sh"; } || { [ -z "$mine" ] && { echo "$(date +%T) queue and renders done; guard exits"; exit 0; }; }
done
