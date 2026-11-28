# Ch 11 Storage: Robo-Pal "still jittery, clipping all over its body" (branch `director/storage-robot-jitter`)

Base `origin/video/cinematic-intro-hq` 470ab43c. Committed `studio-state.json` rev 9671 (the render froze rev 10000).
Render checked: `F:\ErgoFlex_Render\queue\req-20261128T044911\req-20261128T044911-storage-4K.mkv` (3840x2160, 60 fps, 26.67 s).

## Phase 1 findings (from the 4K frames first, then the data)

### Root cause: the earlier fix never reached the render
The frozen storage shot (`...-freeze-rev10000/request/cut.json`) equals the current 3rd-cut `storage.json` / `review-cut.json`,
and in those files the whole `people` block is back to the PRE-fix data. Commit 6e7e586d ("3rd cut: checkpoint Vico's live
Director exports (hero, storage regenerated files)", 27 Nov 20:16, after eea105af 19:10) re-exported storage from a Director
whose live state still held the old people data. Field-by-field diff vs the fixed file (447bc1d2 merge of eea105af):
- held offsets: `y` component zeroed and `turn` dropped on all three robot postures; lift/shelf `at` back to the old values;
- `andre-lift` key 1.0 and `andre-shelf` key 2.0 back to the discontinuous poses; `andre-shelf` arm keys 2.2-2.467 back to old;
- `andre-lets-go` lost its pose keys and its change parts are back to arms [0.6,1], turn [0,0.6].
- The stowed shelf figure's sceneEdit (position/rotation/scale) KEPT the fix. So the shelf figure now sits where the fixed
  hands would have released it, while the (reverted) hands deliver the held robot elsewhere: a new pop at the 2.548 s hand-over.
The prefix file (266837fc^) and the frozen file differ ONLY in that sceneEdit (`sceneEdits[16]`).

### What the 4K render shows (native-resolution crops, 60 fps)
Robot visible spans and its height on screen (4K px, measured on frames):
| span | what | height |
|---|---|---|
| 0-1.0 s | on the maker mat in Andre's hands (`stand-robot-work`), close camera | ~420 px |
| 1.0-2.0 s | lifted (`stand-robot-lift`) | ~400-450 px |
| 2.0-2.548 s | carried to the shelf (`stand-robot-shelf`) | ~420 px |
| 2.548-4.5 s | stowed figure on the top shelf, Andre's hands releasing | ~380-420 px |
| 4.5-9.5 s | stowed figure, wide shot | ~260 px |
| 9.5-9.9 s | phone close-up: robot not in frame | - |
| 10-15 s | stowed figure during the tilt | ~240 px |
| 15-26.67 s | stowed figure, second wide angle | ~180 px |
The robot is NOT small at 0-4.5 s in this cut's film camera: it is ~400 px tall, centre frame.

Defects seen in the frames:
1. **Pop + double exposure at 1.000 s** (`before-4k-0.95-1.07s-swap-pop.jpg`): one frame shows two ghosted robots and two
   ghosted right forearms (motion-blur sub-frames straddling the posture-model swap), then the robot is ~100 px left and turned
   ~30 deg vs the frame before. Head-dot track (orange visor dot): 1-1.7 px/frame before, 26 px then 18 px steps after.
2. **Same at 2.000 s** (`before-4k-1.95-2.07s-swap-pop.jpg`): ghost frame, robot offset ~50 px in the blended frame.
3. **Hand-over at 2.548 s** (`before-4k-2.52-2.60s-handover.jpg`): ghost frame, the robot turns ~40 deg and shifts on the swap
   to the stowed figure; afterwards Andre's fingers pass through the stowed robot's torso (2.55-3.0 s, also at 3.0 s in
   `before-4k-3-6-12-20s-overview.jpg`).
4. **Hands through the robot all through 0-2.5 s**: palms and fingers are drawn inside the torso, the robot's arm pokes out
   through the back of Andre's right hand (old held offsets: the robot sits 15-25 mm deeper into the hand than the fixed offsets).
These are exactly the defects the earlier notes measured and fixed (62/41/118 mm pops, 200 mm hand snap, fingers through
the robot after release); the render simply played the old data. Between the pops the head-dot track is smooth (no
frame-to-frame direction reversals over 0-0.98 s and 1.07-1.7 s: steps change by <=1 px per frame).

Robot part-vs-part: the held robot is a baked `Held.robo-pal` part skinned to Andre's hand, so its parts move rigidly
together (no per-part jitter is possible from animation); the stowed figure is static after 2.548 s. Nothing in the frames
after 4.5 s shows flicker or z-fighting at film size (checked at 6, 12, 20 s stills; measurement limit: stills, not 60 fps strips,
after 4.5 s). Only one robot is drawn at a time (desktop Robo-Pal hidden by sceneEdit 15; held/stowed swap at 2.548 s).

## Phase 2: change
`b2f57a3c` restores the `people` block of the storage shot exactly as merged in 447bc1d2 (eea105af), in
`director-film/storage.json` and the `review-cut.json` storage shot (3rd cut). Nothing else changed: no camera, title,
score, EDL, chapter length, sceneEdit or code. The 4th cut's storage.json already holds the fixed people block (checked by a
field diff), so it lacks nothing for this.
**Risk of a repeat:** the overwrite came from Vico's live Director state. If his browser still holds the old storage people
data, his next Director export of storage will undo this again. He should reload the storage chapter from the cut (or
re-import it) before he edits/exports it.

## Headless (CPU) measurements on the restored data
Tool: `docs/handoff/storage-robot-jitter/robot-motion-headless.mjs` - the production people code (room-people.mjs,
room-people-motion.mjs, people-held.mjs) as `people-ghost-audit.mjs` drives it, but with Andre's REAL posture GLBs
(textures stripped, meshopt decoder), at 60 fps / 240 Hz. It reports each robot material part (`Held.robo-pal 0-8`), and
Andre's body/shirt skin vertices inside any robot part (3-ray parity, majority, per part) with depth = distance to the
robot's nearest triangle.
- The held robot is skinned 100 % to `hand_r` in all three posture GLBs (2662 vertices): its parts cannot move relative to
  each other, so robot part-vs-part interpenetration or per-part jitter cannot come from the animation. Within a posture
  the part steps are smooth (4.3-5 mm per 1/240 s at the lift, step changes < 0.5 mm: no direction reversals).
- Andre's skin inside the robot, worst depth per posture span (before = frozen render data, after = restored):
  | span | before: samples with skin inside / max depth | after |
  |---|---|---|
  | work 0-1.0 s | 60/60, 17.9 mm (mean 17.3) | 60/60, 17.9 mm (mean 17.1) |
  | lift 1.0-2.0 s | 60/60, 16.0 mm | 44/60, 17.6 mm |
  | shelf 2.0-2.55 s | 33/33, 18.6 mm | 16/33, 18.5 mm |
  The deepest are Andre's LEFT index/middle fingers (index_01-03_l 17-18 mm, middle 6-9 mm) at 0-1.0 s and 2.05-2.13 s,
  and the left thumb/forearm during the lift. The right hand stays 9.6 mm off the robot at 0-1 s. This is the baked posture
  as built (the robot and the left hand in the same GLB), not the held offsets: the restore does not change it.
  Single-axis 4-16 deg turns of `hand_l`/`lowerarm_l` either still go in or lift the whole hand 35+ mm off the robot.
- **Measurement limit:** the headless room is a stand-in (furniture boxes), and across a posture-model swap its placement
  of the skinned mesh is not the stage's (the hand_r bone is continuous at 1.0 s but the skinned robot steps 250 mm in both
  before and after data: a headless artifact, since the earlier stage measurement found 0-6 mm). So the swap pops at 1.0/
  2.0/2.548 s and the shelf/mat clearances must be verified in the stage (GPU), below. Skin-inside numbers are within one
  model and are valid.

## Pending GPU verification (not run: the GPU was busy with film req-20261128T070608)
Preconditions each session: last line of `F:\ErgoFlex_Render\queue\watcher.log` reads `queue: N jobs, ... new=0`,
`C:\work\gpu.lock` absent, then `mkdir C:/Users/Vico/polish-wt/_stills-render.lock` (rmdir after).
```
cd C:/Users/Vico/polish-wt/storage-robot-jitter
# cut files: storage shot of the 3rd-cut review-cut (after) and of the frozen request cut (before), with renderRange
python -c "import json;d=json.load(open('exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json',encoding='utf8'));s=d['shots'][10];s['renderRange']=[0.5,3.3];json.dump({'name':'after','shots':[s]},open('scratch-cut-after.json','w'))"
node tools/experience/render-server.cjs 3017 &
node tools/experience/render-cut.cjs --cut scratch-cut-after.json --shots 0 --out scratch-after --video --fps 60 --blur 4 --size 3840x2160
# compare with the film (before) at the same times: 4K crops 0.95-1.07 s (crop=600:600:1800:700), 1.95-2.07 s
# (crop=700:700:1750:300), 2.52-2.60 s (crop=700:700:1450:300); look for the ghost frame at 1.000/2.000/2.548 s
# phone: renderRange [9.4,10.0] after vs film frames 9.6/9.8 s (expect identical up to noise)
# spans after 4.5 s: renderRange [11,13] (tilt) and [20,21] still crops of the shelf robot
```
