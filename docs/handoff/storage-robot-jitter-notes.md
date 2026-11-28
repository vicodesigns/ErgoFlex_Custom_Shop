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
