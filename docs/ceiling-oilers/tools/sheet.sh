#!/bin/bash
# usage: sheet.sh <video> <start s> <duration s> <step s> <out prefix> [cols=4] [rows=4] [w=480] [h=270] [label offset s=0]
v=$1; ss=$2; dur=$3; step=$4; out=$5; cols=${6:-4}; rows=${7:-4}; w=${8:-480}; h=${9:-270}; off=${10:-$2}
fpsexpr=$(/c/Python312/python -c "print(1/$step)")
ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$v" -vf "fps=$fpsexpr:start_time=0:round=down,scale=$w:$h,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65:x=6:y=6:text='%{eif\:(n*$step+$off)\:d}.%{eif\:mod((n*$step+$off)*100\,100)\:d\:2} s',tile=${cols}x${rows}" -q:v 3 "${out}-%02d.jpg"
ls ${out}-*.jpg
