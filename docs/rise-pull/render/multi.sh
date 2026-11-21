#!/bin/bash
# multi.sh <at> <size> <cut1> <cut2> ... : one still run per cut json (out dir = cut name)
at=$1; size=$2; shift 2
for c in "$@"; do bash /c/work/rise-pull/stills.sh $c $c "$at" $size; done
