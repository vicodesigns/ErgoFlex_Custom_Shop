#!/usr/bin/env python3
"""DRAFT, dry run by default: put the re-captured chapter 1 monitor clip (dashboard fully gone under the end logo,
bigger tagline) into a checkout. The clip is not in git; the film plays it, so the ch01.js change alone changes nothing.

  python install-clip.py --new <new cine-awaken-main.mp4> --root <checkout>            # dry run: prints the plan
  python install-clip.py --new <new cine-awaken-main.mp4> --root <checkout> --apply    # backs up, then copies

Run it on the checkout the film freezes from (the desk). The render PC's F: checkout is filled from the desk's manifest
(by sha), so a copy made only there would be overwritten by the next job.
The alternative to copying is to re-capture there after the merge (needs all four Poppins weights in app-reference):
  node tools/experience/screens/capture.mjs cine-awaken-main
only while the cine cut's awaken motion is unchanged (sidecar motion key 988e58dd23a85de4)."""
import argparse, hashlib, shutil, sys, time
from pathlib import Path

REL = Path('exports/cinematic-intro-cut-cine/screens/cine-awaken-main.mp4')
OLD = 'cad866803967635445ee6cf79e619975b1970d02db5a5bdddd9691859be98a1a'  # the Nov 16 clip in the 4K film
NEW = 'f725947b3fc7c20555e53fb1a43d16104bd23e403d1af18e96769aa98e5415a2'

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

a = argparse.ArgumentParser()
a.add_argument('--new', required=True, type=Path)
a.add_argument('--root', required=True, type=Path)
a.add_argument('--apply', action='store_true')
a = a.parse_args()
target = a.root / REL
if sha(a.new) != NEW:
    sys.exit(f'STOP: {a.new} is not the reviewed clip (sha256 {sha(a.new)})')
if not target.is_file():
    sys.exit(f'STOP: no {target}')
have = sha(target)
if have == NEW:
    sys.exit(print('already installed') or 0)
if have != OLD:
    sys.exit(f'STOP: {target} is neither the old nor the new clip (sha256 {have}); someone re-captured it, check first')
backup = target.with_name(f'{target.stem}.pre-logo-{time.strftime("%Y%m%d-%H%M%S")}.mp4')
sidecar = a.new.with_name(a.new.stem + '.capture.json')
if not sidecar.is_file():
    sidecar = a.new.with_name('polish1124-logo-cine-awaken-main.capture.json')
print(f'backup  {target} -> {backup}')
print(f'copy    {a.new} -> {target}')
if sidecar.is_file():
    print(f'copy    {sidecar} -> {target.with_suffix(".capture.json")}')
if not a.apply:
    sys.exit(print('DRY RUN: nothing written (add --apply)') or 0)
shutil.copy2(target, backup)
shutil.copyfile(a.new, target)
if sidecar.is_file():
    shutil.copyfile(sidecar, target.with_suffix('.capture.json'))
assert sha(target) == NEW
print('installed')
