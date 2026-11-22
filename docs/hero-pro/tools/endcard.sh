#!/bin/bash
# usage: endcard.sh <video> <chapter time s> <out.png>
# The end card as finish-intro.py composes it (post/shade.png over the frame, the colour wordmark 22 % of the width centred
# at 73 % of the height, the CTA line centred at y 904/1080), fully faded in, over one frame of a hero render: a framing check.
v=$1; t=$2; out=$3
P=/c/work/hero4/post   # copies of the render PC hq14/post shade.png and logo-color.png (Windows checkouts hold them as symlink text)
ffmpeg -v error -y -ss "$t" -i "$v" -i "$P/shade.png" -i "$P/logo-color.png" -filter_complex \
 "[0:v]scale=1920:1080:flags=lanczos,format=rgba[b];[1:v]scale=1920:1080,format=rgba[s];[b][s]overlay[bs];[2:v]scale=422:-1:flags=lanczos,format=rgba[l];[bs][l]overlay=x=(W-w)/2:y=H*0.73-h/2,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':fontsize=38:fontcolor=white:x=(w-text_w)/2:y=904-text_h/2:text='Let’s build yours.',scale=960:540" \
 -frames:v 1 "$out" && echo "$out"
