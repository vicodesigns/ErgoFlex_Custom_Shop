#!/bin/bash
# job5: the final v2 renders (film camera stills, review cameras, swap frames, Yara take, 1080p pad stills, 540p clips)
W=/c/work/cphone; PY=/c/Python312/python; R=$W/r5; O=C:/work/cphone/r5; mkdir -p $R
F(){ $PY $W/tools/fr.py 16 "$@"; }
c(){ echo "C:/work/cphone/cuts/$1.json"; }
TIMES_FILM=$(F 0 2 4 4.75 5 5.25 5.5 5.75 6 7 8 9 9.5 10 10.5 11 11.5 11.75 12 12.25 12.5 12.75 13 13.25 13.5 13.75 14 14.25 14.5 14.75 15 15.5)
bash $W/run.sh $R/film.log render-cut.cjs --cut "$(c v2-film)" --shots 0 --out $O/film --at $TIMES_FILM
bash $W/run.sh $R/f2f-reach.log render-cut.cjs --cut "$(c v2-f2f)" --shots 0 --out $O/f2f-reach --at $(F range 11.5 15 0.25)
bash $W/run.sh $R/f2f-swap.log render-cut.cjs --cut "$(c v2-f2f)" --shots 0 --out $O/f2f-swap --at $(F 12.5 12.6 12.6333 12.6667 12.7 12.7333 12.7667 12.8 12.9 13.0 13.2 13.4)
bash $W/run.sh $R/top-reach.log render-cut.cjs --cut "$(c v2-top)" --shots 0 --out $O/top-reach --at $(F range 11.5 15 0.25)
for v in yara yarawide; do bash $W/run.sh $R/$v.log render-cut.cjs --cut "$(c v2-$v)" --shots 0 --out $O/$v --at $(F 4.75 5 5.2 5.2333 5.2667 5.5 5.75 6.5 8); done
bash $W/run.sh $R/appr.log render-cut.cjs --cut "$(c v2-f2f)" --shots 0 --out $O/appr --at $(F range 9 12 0.5)
bash $W/run.sh $R/pad1080.log render-still.cjs --cut "$(c v2-pad)" --shots 0 --at $(F 13.75),$(F 15.5) --size 1920x1080 --out $O/pad1080
bash $W/run.sh $R/clip-f2f.log render-cut.cjs --cut "$(c v2-f2f-clip)" --shots 0 --out $O/clip-f2f --video --size 960x540
bash $W/run.sh $R/clip-yara.log render-cut.cjs --cut "$(c v2-yarawide-clip)" --shots 0 --out $O/clip-yara --video --size 960x540
bash $W/run.sh $R/clip-film.log render-cut.cjs --cut "$(c v2-film)" --shots 0 --out $O/clip-film --video --size 960x540
echo job5 done
