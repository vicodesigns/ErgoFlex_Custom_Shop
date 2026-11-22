#!/bin/bash
# batch.sh <tag>: the comparison stills + probes into F:/eng-gym-scratch/<tag>/<chapter>
#   IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh gym-alu 3600 bash docs/gym-aluminium/render/batch.sh before
R=/f/eng-gym/docs/gym-aluminium/render; W=F:/eng-gym-scratch/$1; mkdir -p $W
P=F:/eng-gym/docs/gym-aluminium/render/probe-materials.js
for job in ${JOBS:-"wellness 0.1,0.2,0.4,0.58,0.98" "rise 0.1,0.5" "create 0.3,0.7" "commons 0.5"}; do
  set -- $job; echo "== $1 $(date +%T)"
  bash $R/stills.sh $1 $W/$1 $2 1920x1080 $P > $W/$1.log 2>&1 || { echo "FAILED $1"; tail -5 $W/$1.log; }
done; echo "done $(date +%T)"
