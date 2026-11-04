#!/bin/bash
# HQ9: the safety chapter v3, one continuous camera (build-safety-chapter.py).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H9=exports/cinematic-intro-20261103-hq9
taskset -c 2-7,10-15 node tools/experience/render-cut.cjs --cut $H9/review-cut.json --shots 5 --out $H9/renders-new --video --blur 4 --ss 1.5
