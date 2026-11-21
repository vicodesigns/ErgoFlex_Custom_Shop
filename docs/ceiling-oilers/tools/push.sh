#!/bin/bash
# usage: push.sh <file> <name>   one file to Desk 02's receiver (~/ErgoFlex-Renders), the way queue-watcher.ps1 Push-File does it:
# "put <name>" with the file on stdin; the reply "ok <name> <bytes> <sha256>" is checked against the local file. The key is only passed by path.
f=$1; name=$2
[ -f "$f" ] || { echo "PUSH skip $name (missing $f)"; exit 1; }
echo "$name" | grep -Eq '^[A-Za-z0-9._-]+\.(mp4|mkv|mov|jpg|png|txt|json)$' || { echo "PUSH skip $name (name not allowed by receiver)"; exit 1; }
reply=$(ssh -i 'F:\ErgoFlex_Render\queue\desk02_push' -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 ergo@192.168.8.10 put "$name" < "$f" 2>&1); ec=$?
lsha=$(sha256sum "$f" | cut -d' ' -f1); lsize=$(stat -c %s "$f")
rsize=$(echo "$reply" | tr -d '\r' | awk '/^ok /{print $3}'); rsha=$(echo "$reply" | tr -d '\r' | awk '/^ok /{print tolower($4)}')
if [ $ec -eq 0 ] && [ "$rsha" = "$lsha" ] && [ "$rsize" = "$lsize" ]; then echo "PUSH ok $name $lsize bytes sha verified (${lsha:0:12})"; else echo "PUSH FAILED $name exit=$ec reply=[$(echo "$reply" | head -c 200)] local $lsize/${lsha:0:12}"; exit 1; fi
