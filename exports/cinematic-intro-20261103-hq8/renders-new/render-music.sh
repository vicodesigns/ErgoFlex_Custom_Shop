#!/bin/bash
# HQ8 ch10 (game): HQ6 brightness + 1/3 of the HQ6->HQ7 rise, media-mode stripes kept.
# Tuned on test renders to mean luma 101/40/39 at 2:16/2:21/2:22 (targets 100/38.5/37.3).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H8=exports/cinematic-intro-20261103-hq8
nice -n 19 node tools/experience/render-cut.cjs --cut $H8/review-cut.json --shots 9 --out $H8/renders-new --video --blur 4 --ss 1.5 --storage exports/cinematic-intro-20261030/post/college-seed.json
