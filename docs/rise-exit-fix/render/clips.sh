#!/bin/bash
# The verification clips (854x480, 20.4-28.5 s of the chapter: the end of hold 2, the exit, the last 6 s), BEFORE (Vico's
# export imported on a scratch copy) and AFTER (the fix doc imported on a scratch copy), film camera + close side (C) + back (A2):
#   IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh rise4-clips 4000 bash docs/rise-exit-fix/render/clips.sh
# A clip already rendered (its .done marker) is skipped, so a second run of the same job does nothing.
R=/f/eng-rexit/docs/rise-exit-fix/render; W=F:/eng-rexit-scratch/r
for c in ${CLIPS:-after-film before-film after-C before-C after-A2 before-A2}; do
  [ -f $W/clip-$c.done ] && { echo "== $c already rendered, skipped"; continue; }
  echo "== $c $(date +%T)"; bash $R/render.sh clip $W/$c.json $W/clip-$c 854x480 > $W/clip-$c.log 2>&1 && touch $W/clip-$c.done || { echo "FAILED $c"; tail -5 $W/clip-$c.log; }
done; echo "done $(date +%T)"
