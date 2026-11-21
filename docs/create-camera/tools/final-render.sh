#!/bin/bash
# one GPU session: the imported seated chapter (480p clip), the imported standing chapter (480p clip), 720p stills of the seated one
cd /c/work/fixB
rm -rf r-final-seated r-final-standing st-final st-before
bash clip.sh c-final-seated r-final-seated 854x480
bash clip.sh c-final-standing r-final-standing 854x480
# stills at chapter seconds 0.5 3.0 4.6 7.5 10.5 12.7 15.5 19.2 21.5 (fractions of 23.5 s)
AT=0.021277,0.127660,0.195745,0.319149,0.446809,0.540426,0.659574,0.817021,0.914894
bash stills.sh c-final-seated st-final $AT 1280x720
bash stills.sh before st-before $AT 1280x720
