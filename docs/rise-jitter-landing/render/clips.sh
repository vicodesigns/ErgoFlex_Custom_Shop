#!/bin/bash
# The verification clips (854x480, 13.4-28.5 s of the chapter; the after film camera also the whole chapter), one GPU job:
#   IDLE_SECS=20 bash /f/eng-tools/gpuretry.sh rise3-clips 3500 bash docs/rise-jitter-landing/render/clips.sh
R=/f/eng-vrise/docs/rise-jitter-landing/render; W=C:/work/vrise/r
for c in after-film before-film after-A2 before-A2 after-C before-C after-film-full; do
  echo "== $c $(date +%T)"; bash $R/render.sh clip $W/$c.json $W/clip-$c 854x480 > $W/clip-$c.log 2>&1 || { echo "FAILED $c"; tail -5 $W/clip-$c.log; }
done; echo "done $(date +%T)"
