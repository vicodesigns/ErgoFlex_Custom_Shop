# Ch 11 Storage: Robo-Pal clipping and the "drawing" on lift and shelf (branch `director/storage-robot-review`)

Base `origin/video/cinematic-intro-hq` 83c4f944. Studio state: committed `studio-state.json` rev 9671. Chapter: `storage`
(n 11, "Groove / Storage", 26.67 s), `exports/cinematic-intro-cut-vicos-3rd-cut/director-film/storage.json` and its copy in
`review-cut.json`. The 4th cut's `storage.json` / `review-cut.json` (titles-only duplicate) got the same change so the two stay in step.
Data only: no code, no GLB, no camera, timing, title, score or chapter-length change. The Ch 11 phone is untouched.

## What was wrong (measured in the stage, not guessed)
The robot Andre carries is not the toy story's procedural figure: it is the `Held.robo-pal` part baked into each of his three
posture models (`stand-robot-work` 0-1 s, `stand-robot-lift` 1-2 s, `stand-robot-shelf` 2-2.9 s; tools/people/held.py `robot`, same
triangles as the seated "stowed" figure). At 2.548 s (the `andre-lets-go` change, `swap` 0.06) the model swaps and the stowed
procedural figure on the top shelf (sceneEdits `show` 2.548-24.978) takes over. The desk tilt is 0 until 11.25 s, so the 7-10 deg
tilt cross-fade plays no part here (the shelf robot is excluded from it anyway). Measured (robot frame from a fit of its nine
material centroids, 0.06 mm residual):
- Feet in the shelf: the held robot's boots went 34-36 mm into the top shelf (2.43-2.55 s); the stowed figure that replaced it
  sat 18.6 mm into the shelf for the rest of the chapter (its root on the hidden maker mat's height). At 0-1 s the robot's feet were
  15.6 mm into the desk's maker mat.
- "Drawing"/rocking = pops at every model swap: 62 mm at 1.0 s (lift), 41 mm + 2.2 deg at 2.0 s, and at 2.548 s the hand-over to
  the shelf figure jumped 118 mm, turned 6.6 deg (the held one was tipped 4 deg) and grew 6 % (held scale 1.509 vs 1.599).
- Andre's right hand snapped 200 mm in one frame at 2.548 s (the shelf posture's arm pose keys end at the swap; `andre-lets-go`
  had none), 17 mm at 1.0 s and 34 mm at 2.0 s (the first key of the next posture differed from the last of the one before).
  After the release the body turn swept his right fingers sideways through the robot (2.65-2.9 s). Andre's root x/z and yaw were
  already continuous at 2.9 s and 4.0 s in this stage (the Stage 2 note about 131/125 mm root jumps did not reproduce).

## The change (storage shot data; all of it editable in the Director: People lane keys / Held offset, prop panel)
1. Pose keys continuous at the swaps: `andre-lift` key 1.0 = `andre-robot`'s pose; `andre-shelf` key 2.0 = `andre-lift`'s 1.967.
2. Held offsets (`postures[...].held.hand_r`) for the three robot postures solved as one chain so the robot is continuous in the
   world at 1.0 s and 2.0 s, and sits 0.5 mm above the maker mat at the start (it was 15.6 mm in). They are now nearly the same
   hand-relative offset in all three models (`at` about [0.062-0.069, 0.010-0.014, 0.034-0.037] m, turns under 0.3 deg).
3. `andre-shelf` right-arm keys 2.2-2.467 (upperarm/lowerarm/hand, changes of at most 7 deg) tuned in the stage so the robot
   comes down upright (tilt 0.01 deg), its lowest point 2.5 mm above the shelf at the release, set 30 mm further in than his
   hands now reached so the whole figure stands on the shelf (its bounding box ends 18 mm short of the front edge).
4. Stowed shelf figure (sceneEdit `Smart robot figure · Robo-Pal (stowed)`): position [0.09953, 0.01995, 0.20387] (local),
   rotation [0, -2.31, 0], scale 0.94366: exactly the held robot's last frame, so the hand-over moves it 0.0 mm / 0.01 deg.
5. `andre-lets-go`: pose keys on its model (`people-andre-stand-wait`) from the shelf's last arm pose at 2.548 s to none at 3.22 s;
   change parts arms [0.6,1] -> [0.06,0.9], turn [0,0.6] -> [0.45,1]: the hands come off and down first, then he turns, and the
   peak hand speed falls from ~4.8 to 3.2 m/s. Change start/length, the `when` windows and the walk are unchanged.

## Verification (after)
`clearance-120fps-after.txt` / `-summary.txt` in `storage-robot/`: 481 frames at 120 fps, 0.4-4.4 s, film-quality stage:
- never two robots at once; robot's lowest point never below the shelf (closest 0.7 mm above, 2.458 s; 2.5 mm above from the release on),
  0.4 mm above the maker mat while it rests there (0.4-0.7 s); at the hand-over 0.0 mm / 0.01 deg step; largest frame-to-frame change of the robot's step 5.9
  mm (2.008 s, it speeds up with the carry, no jump); hand bones: largest frame-to-frame change of a step 3.4 mm (was 200 mm);
  hand bones stay 23 mm or more outside the shelf robot's bounding box after the release.
- Phone: film frames at 9.6 s and 9.8 s before/after, PSNR 65 dB (identical up to render noise), `phone-9.8s-before-after.jpg`
  (taken on the previous iteration; the last iteration changed only the shelf arm keys before 2.55 s and the shelf robot's spot,
  nothing the phone shot shows). No other prop on the shelf overlaps the robot's box (checked at 3.0 s).
- Tests: people-pose-keys, room-people-robot, room-people-motion, people-held, cinematic-cuts, film-edits-show-screen pass.
  `people-motion-fields-test.mjs` fails on the base too on this PC (calls `python3`, not on PATH); its `clean_people` step run with
  `python` keeps the new held offsets, keys and change parts. No .mjs edited, so no ESLint run applies.
What this does not cover: the measure is the robot's lowest vertex against the shelf/mat surface under its root (flat surfaces)
and hand BONES against the robot's bounding box, not finger skin against robot triangles; Andre's other limbs, the 2.5 mm air
under the boots on the shelf (seen as contact at film size), the rest of the chapter after 4.4 s (the robot stays put; checked by
eye at 22.5 s), and 1080p/4K renders (none queued).

## Remaining
- The robot's own seated design has its boots below its root; it now rests on its boots and shins with the seat clear of the shelf (as designed, now without sinking).
- The phone close-up and everything after 4.4 s were not edited.
