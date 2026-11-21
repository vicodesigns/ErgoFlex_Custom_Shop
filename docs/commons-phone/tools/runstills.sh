#!/bin/bash
# runstills.sh <cut.json> <outdir> <size> <times...>   (times in chapter seconds, 16 s chapter)
cut=$1; out=$2; size=$3; shift 3
at=$(/c/Python312/python -c "import sys;print(','.join(str(round(float(t)/16,5)) for t in sys.argv[1:]))" "$@")
bash /f/eng-tools/gpuretry.sh phone-still 1700 bash /c/work/commons-phone/phone-run.sh still --cut "$cut" --shots 0 --at $at --size $size --out "$out"
