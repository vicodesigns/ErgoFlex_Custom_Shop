#!/bin/bash
# HQ7: re-render ch10 (game, music) and ch11 (movie, media) with the video-driven LED path.
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H7=exports/cinematic-intro-20261103-hq7
nice -n 19 node tools/experience/render-cut.cjs --cut $H7/review-cut.json --shots 9,10 --out $H7/renders-new --video --blur 4 --ss 1.5 --storage exports/cinematic-intro-20261030/post/college-seed.json
