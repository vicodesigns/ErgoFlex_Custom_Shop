#!/bin/bash
# HQ7: the safety chapter's three sub-shots (renderRange), joined into renders/06.mkv.
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H7=exports/cinematic-intro-20261103-hq7
nice -n 19 node tools/experience/render-cut.cjs --cut $H7/shots/06-subshots.json --shots 0,1,2 --out $H7/renders-new/status --video --blur 4 --ss 1.5
nice -n 19 python3 tools/experience/join-subshots.py $H7/shots/06-subshots.json $H7/renders-new/status $H7/renders/06.mkv --transition fadeblack
