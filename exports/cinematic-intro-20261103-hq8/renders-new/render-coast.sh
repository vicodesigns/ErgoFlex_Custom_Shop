#!/bin/bash
# HQ8 ch5 (coast, OCC multimedia art lab, house layout) with Vico's desktop arrangement from the shared state:
# the stage resets layout rooms to their authored desks, so the shot carries deskObjects (his four moved
# items from studio-state rev 130, occmedialab/premium main desk), placed after prepare by film-fx.
# Seed post/occ-seed.json (the shared state). Wall display at 0.6 brightness (finale doc C4).
set -e; cd /home/ergo/ErgoFlex_Custom_Shop; H8=exports/cinematic-intro-20261103-hq8
nice -n 19 node tools/experience/render-cut.cjs --cut $H8/review-cut.json --shots 4 --out $H8/renders-new --video --blur 4 --ss 1.5 --storage $H8/post/occ-seed.json
