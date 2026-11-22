#!/bin/bash
# Contact sheet of consecutive clip frames (every 1/30 s), full-resolution crops, labelled with chapter and film time.
#   sheet.sh <frames dir (NNN.jpg from ffmpeg, 001 = range start)> <range start s> <first frame> <count> <crop w:h:x:y> <out.jpg> [label] [cols=4]
dir=$1; t0=$2; first=$3; n=$4; crop=$5; out=$6; label=${7:-}; cols=${8:-4}
ins=(); f=""; lay=""
for ((i=0;i<n;i++)); do k=$((first+i)); ins+=(-i "$(printf '%s/%03d.jpg' "$dir" $k)");
  t=$(awk -v a=$t0 -v k=$k 'BEGIN{printf "%.4f", a+(k-1)/30}'); ft=$(awk -v t=$t 'BEGIN{printf "%.2f", t+106.85}')
  f+="[$i:v]crop=$crop,scale=-2:420,drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:x=6:y=6:text='$label ch $t s  film ~$ft s'[v$i];"
  lay+="$( [ $i -gt 0 ] && echo '|' )"'X'$((i%cols))'_Y'$((i/cols)); done
# xstack layout with widths/heights of the first cell
lay=$(echo "$lay" | sed -E 's/X([0-9]+)/\1/g')
L=""; for ((i=0;i<n;i++)); do c=$((i%cols)); r=$((i/cols)); xs=""; ys=""; for ((j=0;j<c;j++)); do xs+="${xs:++}w0"; done; for ((j=0;j<r;j++)); do ys+="${ys:++}h0"; done; L+="${L:+|}${xs:-0}_${ys:-0}"; done
ffmpeg -v error -y "${ins[@]}" -filter_complex "${f}$(for ((i=0;i<n;i++)); do printf '[v%d]' $i; done)xstack=inputs=$n:layout=$L:fill=black" -q:v 3 "$out" && echo "$out"
