# S23: the artist studio (create), Lin at the desk in all three modes. A proposal, nothing built

Source: worktree `C:\work\ergoflex-cine-s23` (cine/s23 from 320530d4), read-only. Chapter `create`,
`exports/cinematic-intro-cut-cine/review-cut.json`, film 62.85-86.35 s (1:02.85-1:26.35), 23.5 s.

Chingon's note: from 1:02 to 1:17 the desk does digital painting and the drafting tilt with nobody at it. Lin is at
the pottery wheel and only comes in for the oil painting. "Angle it to your art" would read better with her at the
desk for all three modes.

## 1. What the chapter does today (chapter seconds)

| t (s) | Desk (motion) | Camera (cameraPlan) | Props and screens | People |
|---|---|---|---|---|
| 0-2.35 | 43.5 in, flat. 1.5-3.4: tilt to 7 deg (unlabelled clip) | Wide, deep: Lin at the wheel, desk at the back, slow push | screens: digital painting (clip 0-7.0) | lin-at-wheel (`when` 0-14) |
| 2.4 | | **CUT** to the desk, front three-quarter | pen display visible | nobody at the desk |
| 4.2-6.8 | lift 43.5 to 52 in ("stand-to-draw") | front three-quarter, the lift | TILT title 3.6-9.2 | nobody |
| 6.8-12.4 | tilt 7 to 40 deg ("Drafting") | arc to the side three-quarter (far side, keeps Lin out) | 7.0-7.4 pen display out, drafting kit and easel rail in. Screens: architecture (7.0-16.9). painter-shelf from 12.6 | nobody |
| 12.4-16.9 | holds 40 deg | the arc goes on | floor plan texture on the board | nobody |
| 16.9-19.5 | tilt 40 to 55 deg ("Easel") | round to the front | 16.9-18.7 kit and rail out, easel in 17.5-19.3. Screens: landscapes (16.9-23.5) | nobody |
| 19.5 | | **CUT** "later, Lin paints at the tilted canvas" | stool hidden from 19.5 (S12 `show`) | lin-desk = people-lin-stand-paint at [-200, -130], turn 180, `when` 19.5- |
| 19.5-23.5 | 52 in / 55 deg | slow arc round her brush hand | | |

History: in Vico's cut (`cinematic-intro-20261110-people`) the opener was the floor easel and the still life, and
his keys show the pen display at 52 in (7.4 and 9.05 s). The wheel took the floor easel's place in the room
(artist-room.mjs). The alternate cut (`-20261110-alt`) added "Lin at her easel" and the cut at 19.5 s to Lin
painting on the desk. S3 (beac6277) took that ending into the working cut. The cine re-shoot put the opener on Lin
at the wheel with the **cut at 2.4 s**. S6 cut the screens at 0-7.0 / 7.0-16.9 / 16.9-23.5. S12 took the stool out
from 19.5 s, because her legs showed through its seat.

## 2. Lin's postures: which exist, and what a tilted board does to the hands

There are 35 Lin models in `assets/props/people-lin-*.glb`. The ones that matter here:

| Posture | Exists | Notes |
|---|---|---|
| sit-pottery | yes | On the wheel's stool, seat 0.43 m, knees either side of the wheel (cast.py `sit_pottery`) |
| sit-type, sit-type-30 | yes | Desk postures at 28 and 30 in, task-chair seat 0.435 m |
| stand-mid (39 in), stand-type (43.5 in), stand-type-low (28/30) | yes | Desk postures. `deskFamily` links them |
| stand-wait, walk | yes | For the crossing from the wheel |
| sit-write | yes | Pen in hand, leaning in. Built for a 0.45 m chair at a table, not a desk height. Nearest to a stylus pose |
| stand-paint | yes | Not a desk posture. Brush hand fixed at `_s(k, -.2, -.42, 1.22)`, palette in the left hand. Fitted by eye to the 52 in / 55 deg board in the approved render (req-20261114T004013) |
| **sit-stylus / sit-draw** | **no** | Must be built |
| **stand-draft / stand-draw** | **no** | Must be built |
| sit-paint (seated at the easel) | no | Build it only if Vico wants her seated at the end |

Tilt behaviour (room-people-motion.mjs, room-people.mjs):
- `TILT_FLAT = 4`: past 4 deg the desk user's hands leave the keys and they stand by, arms loose. The keyboard home
  is only re-learned at |tilt| <= 2 (room-people.mjs:1693). A typist cannot follow a tilting board. This is why S4
  dropped the coast tilt.
- `DRAW_TILT = 12`: drawers keep their hands on the top up to 12 deg. Today only the kid desk postures count as
  drawers (`this.draws`, regex `-kid-(stand|sit)-desk`). This is the precedent for an adult drawing at the desk.
- Every model is a still, baked posture. Nothing moves the hands onto a sloped surface. At 40 deg or 55 deg, hands
  land on the board only if the posture was built for that height **and** that angle, and the board's surface
  (pivot, front edge) was measured first. stand-paint is that kind of posture: built for one easel and placed by
  eye.
- `deskFamily` already pairs `sit-X` with `stand-X` ("what is in the hand stays"). If the new postures are named
  `sit-draw` / `stand-draw`, they slot into the family with no code change.

Desk heights for Lin (155 cm):
- **Seated stylus.** 28-30 in on a task chair, matching her sit-type builds. On the artist stool (489 mm model,
  scaled 1.2225 and lowered by a sceneEdit) the seat height has to be measured. The current start height, 43.5 in,
  is her **standing** height, so she cannot sit at it.
- **Standing drafting.** About 39-41 in (stand-mid is built at 39; Maya stands at 41). 52 in puts the board's front
  edge near her shoulder (about 1.32 m), too high to draft at. 40 deg is below Vico's 50 deg drafting rule.
- **Painting at 55 deg.** Needs at least 36.9 in on the 60x30 (motion-limits `minimumHeightForTilt`). The approved
  painting frame is at 52 in. An easel's canvas centre sits near eye height, so 52 in suits painting.

## 3. Timeline proposal (recommended: option A, she walks from the wheel; chapter +3.0 s, 26.5 s)

All desk, prop, title and screen events move by D = +3.0 s. The opener is new.

| t (s) | What happens | How it is driven |
|---|---|---|
| 0-1.5 | Lin throwing at the wheel, desk at the back (the current wide and push) | lin-at-wheel, `when` [0, 2.4] |
| 1.2-3.6 | She gets up at the wheel | Pairing (solveChange, 2.4 s get-up) sit-pottery to stand-wait at the same spot. Windows meet at 2.4 |
| 3.4-5.6 | She walks about 2.2 m to the desk. The camera holds wide and pans after her | Walk cast with `path` / `start` / `then` (as commons' Yara and storage's Andre). Path drawn by hand round the worktable and stool |
| **5.4 CUT** | Front three-quarter: she is seated, stylus moving on the pen display, digital painting on the screens | Desk actor (lin-sits = **sit-draw-30**, lin-stands = stand-mid), `when` 5.4-22.5. Desk starts at **30 in** (was 43.5) and already at 7 deg (initial tilt 7: the old 1.5-3.4 clip is folded in) |
| 6.6-12.2 | TILT title (shifted). Re-check that it clears her (S12 rule) | titles-src.json |
| 7.2-9.8 | Lift 30 to **40 in**. She stands up with it. Chair or stool rolls back and parks aside | DeskActor stand-up (2.6 s) + `people.chair {back, side, turn}`, as in rise and wellness |
| 9.8-15.4 | Board 7 to 40 deg. She stands by and watches it come up (hands off past 4 deg) | stand-mid, life on. Pen display out / kit in at 10.0-10.4 |
| 15.0-19.9 | **She drafts**: pencil on the 40 deg board, parallel rule or set square in her left hand. Architecture on the screens | `fromDesk` step-out (S16) to **stand-draw-40** at her standing spot: one whole-model change at about 15.4, back at 19.9 |
| 19.9-22.5 | Board 40 to 55 deg (+ lift 40 to 52 in if the approved painting frame is reused). She steps back. Easel in at 20.5-22.3 | Same motion clips, shifted |
| **22.5 CUT** | "Later": she paints at the tilted canvas, slow arc round the brush hand, until 26.5 | lin-desk stand-paint, unchanged placement, `when` 22.5- (S12 stool `show` to 22.5) |

Notes on option A:
- **Screens.** Today's 23.5 s clips need no re-cut: set `offset: -3.0` (chapter time 3.0 = clip time 0). Negative
  offsets are already used (the oilers quiz is at -20.3). Check that clip time below 0 holds the first frame
  (film-texture-screens.mjs computes `raw = t*rate + offset`). The ranges move to 3.0-10.0 / 10.0-19.9 / 19.9-26.5.
- **Optional.** Add 1.5 s to the drafting hold (5.4 s of drafting instead of about 3.9 s). Vico relaxed the length.
- **Stool.** S12 hides the room stool from the painting cut. In act 1 she sits on the desk actor's chair. Today
  that is always the TASK_CHAIR (Leap). Seating her on the artist stool needs a small chair-id option, and the room
  stool hidden while hers is drawn.
- **Board angles.** Drafting at 40 deg (below 50) and painting at 55 deg, both as today. Only the heights change:
  30 / 40 / 52 (or 30 / 40 / 40, see question 3).

Alternatives:
- **B. No length change.** Lin is at the desk from 0 s. Same deep opener, but the wheel is empty in the foreground
  (pot on it, head still) and Lin draws at the back. Cut at 2.4 s as now, every other time unchanged (only `when`
  windows and motion heights change). No score, EDL or title-timing work. The wheel becomes set dressing.
- **C. Cheapest.** Keep the wheel opener and cut at 2.4 s straight to Lin seated: a time jump. This makes two
  "later" cuts in 23 s, and an empty wheel may show behind her. Not recommended.

## 4. Cost

New models (Blender 4.2.3, about 1.2 s per build, then `export-rigs.mjs` for lin.json, `index-people.mjs`,
people.json / index.json):
1. **people-lin-sit-draw-30**: required. Seated, stylus (held `pen`, recoloured) on the flat pen display, left hand
   resting on its edge. Built for the display surface at 30 in and 7 deg (measure the oak display's surface).
   Optional sit-draw (28 in) family variant.
2. **people-lin-stand-draw-40**: required. Standing at 40 in, board at 40 deg, pencil on the board, left hand on a
   rule or set square. There is no ruler in held.py: use `pen` + `clipboard`-like geometry, or add a `set-square`
   builder (about 20 lines).
3. people-lin-sit-paint: only if Vico wants her seated at the end. On the stool at the 55 deg board, desk about
   38-40 in, brush + palette (held items exist).

Most of the time goes into iterating hand placement on stills, not into the 1.2 s builds: about 2-3 rounds each.

Code:
- room-people-motion.mjs: widen the `draws` regex to `-sit-draw` (1 line), so her hands stay on at 7 deg. Test.
- Drafting at 40 deg: no new code with `fromDesk` (S16). The tidier alternative is a tilt-aware desk posture (a
  built `tilt` in people.json, hands on when |tilt - built| <= about 3 deg; about 30 lines + tests). It is not
  needed for this.
- Stool as her chair: `spec.chair` instead of TASK_CHAIR in `bring` (about 10 lines + test), only if the stool.
- review-cut.json create: people (desk actor, walk, pairing, fromDesk), motion heights, and in option A the +3.0
  retime of motion, accessories `visible`, sceneEdits `opacity` / `show`, ledStatus, screens `offset`.
  build-cine-cut.py create keys (new opener and pan, everything else +3.0) and re-spline. titles-src (TILT). Option
  A only: edl.json, score (build-cine-score.py), README hand-off frames into commons. Refresh the film-desk-hide
  fixture. room-people-motion-test cut-level checks (fromDesk window against her timing).

Risks:
- Hands on a sloped board: the pencil sinks into or floats over the board unless the pivot and front edge at 40 in /
  40 deg are measured first.
- The get-up from the wheel: her knees are either side of the wheel, so the solveChange can sweep her legs through
  it. Fallback: a short dissolve inside the wide, or open with her already standing at the wheel.
- The walk path through the worktable, rug and stool area. Her legs showing through the stool or chair again (the
  S12 issue) when the stool is parked.
- The title over a seated Lin at the front three-quarter.
- Option A: the score and EDL shift for every later chapter.

Estimate:
- Option A: engineer about 12-16 h (models 6-8 h with stills, code 2 h, retime, camera, screens, titles and score
  3-4 h, stills and checks 2 h). Reviewer about 4 h.
- Option B: engineer about 9-11 h, reviewer about 3 h.

Reused: lin-sit-pottery, lin-walk, lin-stand-wait, lin-stand-mid, lin-stand-paint and its approved placement and
closing camera; the DeskActor stand-up and `people.chair` park (rise, wellness); `fromDesk` (S16); pairing
solveChange; walk casts (commons, storage); held pen / brush / palette; the S6 screen clips (offset only); all motion
clips, props and LED status (shifted).

## 5. Storyboard (option A, 26.5 s)

1. 0.0-2.4: Deep wide. Lin throwing a pot at the wheel, the desk waiting at the back in the window light. Slow push.
2. 2.4-5.4: She rises from the wheel, wipes her hands and crosses the studio. The camera eases round after her.
3. 5.4-7.2: CUT to the front three-quarter. Seated at 30 in, stylus on the pen display, digital painting on both
   screens. TILT title.
4. 7.2-9.8: The desk lifts to 40 in. She stands with it as her seat rolls aside.
5. 9.8-15.4: The arc to the side three-quarter. The board rises to a 40 deg drafting angle while she watches it
   come up.
6. 15.4-19.9: She drafts at the board, pencil and set square, the floor plan under her hand, architecture on the
   screens.
7. 19.9-22.5: She steps back. The board tilts on to 55 deg (and rises to easel height). The easel arm comes in.
8. 22.5-26.5: CUT, later. She paints at the tilted canvas, palette in hand, slow arc round the brush. Landscapes on
   the screens.

## 6. Questions for Vico

1. At the end, does she paint **standing** (stand-paint, approved frame, no new model) or **seated on the stool**
   (new sit-paint, stool stays in shot, desk about 38-40 in)?
2. Does the pottery wheel stay in the story: option A (she walks from it, +3 s) or option B (she is already at the
   desk and the wheel is set dressing, no length change)?
3. Painting height: lift to 52 in with the 55 deg tilt (reuses the approved painting frame), or stay at 40 in and
   re-fit her and the closing camera?
4. Seated in act 1 on the **task chair** (the rise-style roll-aside, no code) or on the **artist stool** (small
   chair option)?
5. The start height changes from 43.5 to 30 in, so the lift is 30 to 40 in, not 43.5 to 52 in. Is that fine for the
   product story, or does the chapter need to show the 52 in figure?
6. Lengthen the drafting hold by about 1.5 s?
