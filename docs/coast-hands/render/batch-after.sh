#!/bin/bash
R=/f/eng-coast/docs/coast-hands/run.sh
bash $R probe 'C:\work\coast2\cutA-film.json' 'C:\work\coast2\probe-after' "$(cat /c/work/coast2/times.txt)" '^(Root|pelvis|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|middle_01_[lr]|index_03_[lr])$' --deltas '^(upperarm|lowerarm|hand)_[lr]$|^spine_0[123]$|^index_01_l$' --delta-ids '^people-ava-'
for c in closeL closeR filmR; do bash $R clip "C:\work\coast2\cutA-$c.json" "C:\work\coast2\after-$c" 1920x1080; done
