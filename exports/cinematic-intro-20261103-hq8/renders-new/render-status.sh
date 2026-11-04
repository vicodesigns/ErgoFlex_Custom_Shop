#!/bin/bash
# HQ8: the safety chapter v2, three sub-shots (renderRange), joined into renders/06.mkv with dips through black.
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H8=exports/cinematic-intro-20261103-hq8
nice -n 19 node tools/experience/render-cut.cjs --cut $H8/shots/06-subshots.json --shots 0,1,2 --out $H8/renders-new/status --video --blur 4 --ss 1.5
nice -n 19 python3 tools/experience/join-subshots.py $H8/shots/06-subshots.json $H8/renders-new/status $H8/renders-new/06.mkv --transition fadeblack
