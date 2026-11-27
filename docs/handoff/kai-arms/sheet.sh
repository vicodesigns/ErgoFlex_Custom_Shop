#!/bin/sh
# sheet.sh <dir> <out.jpg>: 5x3 contact sheet of the 15 stills with chapter seconds
D=$1; O=$2; i=0; args=""; f=""
for p in $(ls $D/01-still-960x540-t*.png | sort); do
  t=$(echo $p | sed 's/.*-t\([0-9.]*\)\.png/\1/'); s=$(awk "BEGIN{printf \"%.2f\", $t*15}")
  args="$args -i $p"; f="$f[$i:v]scale=480:270,drawtext=text='$s s':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6[v$i];"; i=$((i+1))
done
L=""; for k in $(seq 0 $((i-1))); do L="$L[v$k]"; done
ffmpeg -v error -y $args -filter_complex "${f}${L}xstack=inputs=$i:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|w0+w1+w2+w3_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0|w0+w1+w2+w3_h0|0_h0+h5|w0_h0+h5|w0+w1_h0+h5|w0+w1+w2_h0+h5|w0+w1+w2+w3_h0+h5" -q:v 3 $O
