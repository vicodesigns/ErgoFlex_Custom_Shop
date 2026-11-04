#!/bin/bash
# HQ8 ch13 (finale): six preset sub-shots on one camera, joined with 0.7 s soft wipes (build-finale.py).
# Seed: the shared state (rev 130) with every preset's saved desk pose zeroed (no jump inside a wipe).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H8=exports/cinematic-intro-20261103-hq8
nice -n 19 node tools/experience/render-cut.cjs --cut $H8/shots/13-subshots.json --shots all --out $H8/renders-new/finale --video --blur 4 --ss 1.5 --storage $H8/post/finale-seed.json
nice -n 19 python3 tools/experience/join-subshots.py $H8/shots/13-subshots.json $H8/renders-new/finale $H8/renders-new/13.mkv --transition smoothleft
