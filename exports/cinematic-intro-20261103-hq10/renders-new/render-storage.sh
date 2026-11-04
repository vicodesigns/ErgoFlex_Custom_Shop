#!/bin/bash
# HQ9 (from HQ8) ch12 (storage): roll fully off the rug, chair moved, gold LED, lights out (build-storage-chapter.py).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H9=exports/cinematic-intro-20261103-hq10
taskset -c 2-7,10-15 node tools/experience/render-cut.cjs --cut $H9/review-cut.json --shots 11 --out $H9/renders-new --video --blur 4 --ss 1.5 --storage exports/cinematic-intro-20261030/post/college-seed.json
