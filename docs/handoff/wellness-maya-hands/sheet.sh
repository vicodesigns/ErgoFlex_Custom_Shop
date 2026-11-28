#!/bin/sh
# sheet.sh <dir> <out.jpg> [crop w:h:x:y]: 5-wide contact sheet of the stills, chapter seconds stamped
D=$1; O=$2; C=${3:-}; i=0; args=""; f=""
for p in $(ls $D/01-still-960x540-t*.png | sort); do
  t=$(echo $p | sed 's/.*-t\([0-9.]*\)\.png/\1/'); s=$(awk "BEGIN{printf \"%.2f\", $t*22.5}")
  cr=""; [ -n "$C" ] && cr="crop=$C,"
  args="$args -i $p"; f="$f[$i:v]${cr}scale=384:216,drawtext=text='$s s':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6[v$i];"; i=$((i+1))
done
while [ $((i % 5)) -ne 0 ]; do f="$f color=black:s=384x216:d=1[v$i];"; i=$((i+1)); done
L=""; for k in $(seq 0 $((i-1))); do L="$L[v$k]"; done
ffmpeg -v error -y $args -filter_complex "${f}${L}xstack=inputs=$i:grid=5x$((i/5))" -frames:v 1 -q:v 4 $O
