#!/bin/bash
R=/f/eng-coast/docs/coast-hands/run.sh
bash $R probe 'C:\work\coast2\cut-film.json' 'C:\work\coast2\deltas-before' "$(cat /c/work/coast2/times-d.txt)" '^(hand_[lr])$' --deltas '^(upperarm|lowerarm|hand)_[lr]$|^spine_0[123]$|^index_01_l$' --delta-ids '^people-ava-'
for c in closeL closeR filmR; do bash $R clip "C:\work\coast2\cut-$c.json" "C:\work\coast2\before-$c" 1920x1080; done
