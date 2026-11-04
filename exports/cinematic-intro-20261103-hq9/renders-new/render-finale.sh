#!/bin/bash
# HQ9 ch13 (finale v2): six preset sub-shots sharing one performance and camera, joined with 0.6 s blends (build-finale.py).
# Seed: the shared state (rev 130) with every preset's saved desk pose zeroed (no jump inside a wipe).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H9=exports/cinematic-intro-20261103-hq9
taskset -c 2-7,10-15 node tools/experience/render-cut.cjs --cut $H9/shots/13-subshots.json --shots all --out $H9/renders-new/finale --video --blur 4 --ss 1.5 --storage $H9/post/finale-seed.json
taskset -c 2-7,10-15 python3 tools/experience/join-subshots.py $H9/shots/13-subshots.json $H9/renders-new/finale $H9/renders-new/13.mkv --transition fade
