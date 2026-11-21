#!/bin/bash
tag=$1
bash /c/work/vwell/probe.sh C:/work/vwell/$tag.json C:/work/vwell/$tag.jsonl --step 0.0333333 || exit 1
bash /c/work/vwell/clip.sh C:/work/vwell/$tag.json C:/work/vwell/r-$tag-854x480 854x480 --video || exit 1
bash /c/work/vwell/clip.sh C:/work/vwell/$tag.json C:/work/vwell/r-$tag-1920x1080 1920x1080 --video
