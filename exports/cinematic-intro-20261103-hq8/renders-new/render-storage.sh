#!/bin/bash
# HQ8 ch12 (storage): roll fully off the rug, chair moved, gold LED, lights out (build-storage-chapter.py).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H8=exports/cinematic-intro-20261103-hq8
nice -n 19 node tools/experience/render-cut.cjs --cut $H8/review-cut.json --shots 11 --out $H8/renders-new --video --blur 4 --ss 1.5 --storage exports/cinematic-intro-20261030/post/college-seed.json
