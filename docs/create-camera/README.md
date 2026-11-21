# Chapter 3 Create: camera re-key (Vico's 3rd cut, 21 Nov 2026)

Vico on the 4K film: he likes the Create move, but it is too fast and "skippy". This is the same move (fly in over
the studio, sweep round the desk to the window side, come back round to the front, cut to Lin painting), re-keyed as one
continuous move with an even speed. Camera only: the chapter stays **23.5 s**; desk moves, titles, people, props, screens,
status lights and the last shot (cut at 19.5 s, slow arc to 23.5 s) are untouched.

Base: `origin/cut/vicos-3rd-fixes-20261121` (7ffa208c). Nothing under `exports/` is changed on this branch: the two
export docs below are the patch, to be imported with the Director importer.

## What to import

| cut | doc | base it was made from |
| --- | --- | --- |
| seated (`exports/cinematic-intro-cut-vicos-3rd-cut`) | `create-camera-seated-export.json` | Vico's latest Create export, `director-exports/export-1316b83131e3-Film-chapter-create-23-5-s-__23_.json`; only `shots[0].camera.keys` replaced (and `updated` stamped) |
| standing (`exports/cinematic-intro-cut-vicos-3rd-cut-standing`) | `create-camera-standing-export.json` | that cut's latest Create export, `director-exports/export-2371867380a2-Film-chapter-create-carry.json`; only `shots[0].camera.keys` replaced |

    python3 tools/experience/build-round8-director.py <cut dir> --import docs/create-camera/create-camera-<seated|standing>-export.json
    python3 tools/experience/build-round8-director.py <cut dir>

The camera of the two cuts is the same (the standing cut's Create differs from the seated one only in props and a status light,
which stay as they are).

## The move

Story keys (`create-camera-plan.json`; before: 10 keys of which 2 were duplicates that stopped the camera; after: 11 keys, no
duplicate, no hold):

| at (s) | key | what happens on the desk |
| --- | --- | --- |
| 0 | Lin at the wheel, the desk at the back of the studio (Vico's opening view, unchanged) | dissolve in |
| 2.103 | Ease away from the wheel | board tilts to 7 deg (1.5-3.4 s) |
| 5.983 | Across the front as the desk lifts | title 3.6-9.2 s; lift to 52 in (4.2-6.8 s) |
| 9.294 | Round to the window side: drafting begins | drafting tilt (6.8-12.4 s) |
| 11.208 | Side three-quarter: the board tilts to drafting | |
| 12.7 | Lean in on the drafting board and turn back | drafting at 40 deg since 12.4 s |
| 13.856 | The arc goes on as the board tilts to the easel | |
| 18.244 | Settle to the front | easel tilt (16.9-19.5 s) |
| 19.467 | Round to the front: the board tilts on to the painting | |
| 19.5 | CUT: later, Lin paints at the tilted canvas (unchanged) | Lin at the desk |
| 23.5 | Slow arc around her brush hand (unchanged) | dissolve out |

What changed in the path (see `create-camera-path-before-after.png`):

- The fly-in used to run along the daylight wall (within 0.1 m of it at 1-2 s), pass right over Lin's wheel, hook 90 degrees at
  3 s with the aim swinging 2 m to the right and back (the pan direction flipped there), then cross the room at 2.1 m/s. Now it
  leaves the opening view on one curve past the wheel (1.0 m clear of Lin and the wheel) into the sweep; the aim travels straight to the desk.
- The stop at the window side (12.2-12.9 s) and the retrace are now a slow lean-in on the drafting board that turns back
  without stopping (0.35 m/s through the turn).
- The return used to wait at 0.4 m/s and then rush the last 3 s at 1.45 m/s into a hard stop (-1.7 m/s2). Now it is an even arc
  that settles into the frontal view exactly at the cut.
- Composition: more headroom over the monitors on the window side and on the way back (they touched or left the top of the
  frame at 12-16 s); the frontal end view is 0.25 m further back with the aim 4 cm higher, so the monitors, the whole desk and
  the stool are inside the frame; the camera is level all the way (horizon and verticals), the desk sits in the middle third
  under the title and on the right two thirds with the window on the left third at the lean-in.

## Numbers (camera as the render samples it, 30 fps; `measurements/`)

| | before (film) | after |
| --- | --- | --- |
| peak camera speed | 2.10 m/s at 4.4 s | 0.94 m/s at 4.8 s |
| peak look-direction (pan) speed | 45.0 deg/s at 4.1 s | 12.5 deg/s at 15.4 s |
| peak acceleration along the path, frame to frame | 3.48 m/s2 | 1.20 m/s2 (the settle before the cut) |
| the same over 5 frames | 1.99 m/s2 | 0.75 m/s2 |
| peak angular acceleration, frame to frame / over 5 frames | 119 / 78.5 deg/s2 | 26.0 / 19.6 deg/s2 (the turn at 12.7 s) |
| speed, first move (0-19.45 s): mean, spread (std) | 0.74, 0.64 m/s | 0.66, 0.22 m/s |
| rms acceleration / rms angular acceleration, first move (5 frames) | 0.55 m/s2 / 13.6 deg/s2 | 0.18 m/s2 / 3.3 deg/s2 |
| frames faster than 1.2 m/s / panning faster than 20 deg/s | 142 / 59 | 0 / 0 |
| camera at rest inside the chapter | 0.03-0.40, 12.23-12.87, 19.20-19.47 s | none |
| pan direction flips | 3.07 s (the hook), 13.3 s | 12.6 s (the turn back, by design) |
| path length | 14.96 m | 13.38 m |

Plots: `create-camera-motion-before-after.png` (speed, acceleration, pan speed, angular acceleration, lens) and
`create-camera-path-before-after.png` (top view, one dot per second).

The saw-tooth in the frame-to-frame acceleration of both curves is the bake: `camera-spline.mjs` writes 15 linear keys a
second, so the speed changes every second frame. It is the same before and after and was not touched.

## How the times were set

`tools/design.mjs` lays the keys on an authored speed curve by arc length (the bake's own metric), `tools/optimize.mjs` then
moves the interior key times (geometry untouched, the turn pinned at 12.7 s) to the least speed change of the BAKED camera.
The bake is the repo's `tools/experience/camera-spline.mjs` every time, and `cameraPlan.easeIn / easeOut` stay `false` as in
the film (the chapter dissolves in and out): the opening speed is 0.27 m/s, not zero, and rises evenly; before a cut the bake
always comes to rest, so the last key sits one frame before the cut.

    node docs/create-camera/tools/design.mjs docs/create-camera/create-camera-design.json plan.json
    node docs/create-camera/tools/optimize.mjs plan.json create-camera-plan.json 5 0.25
    node docs/create-camera/tools/analyze.mjs create-camera-plan.json after.csv --rebake
    node docs/create-camera/tools/mkdocs.mjs create-camera-plan.json <base export> <out doc>

The shell scripts in `tools/` are the ones used on the render PC and keep its paths (`C:\work\fixB`, `F:\eng-fixB`).

## Checked

- Importer: both docs imported with `build-round8-director.py --import` and the pass, on scratch copies outside the repo
  (`verify/import-*.log`). `tools/verify-import.mjs` then shows (`verify/verify-*.txt`, all ok): `director-camera-create.json`
  keys equal the plan; `review-cut.json` create `cameraPlan.keys` equal the plan and `camera` equals an independent bake of
  it; every other field of the Create shot, the other 11 chapters, `titles-src.json` and the other files are unchanged.
- Renders: the whole chapter through `render-cut.cjs` at 854x480, before (base data) and after (the shot taken from the
  IMPORTED scratch `review-cut.json`, seated and standing), and nine 1280x720 stills. Frame sequences looked at: before every
  0.5 s, after every 0.25 s (`frames/`), standing every 1 s.
- On the desk (`~/ErgoFlex-Renders`, `verify/push.log`): `create2-after-480p.mp4`, `create2-before-after-480p.mp4` (side by
  side), `create2-standing-after-480p.mp4`, `create2-still-*.jpg`, `create2-sheet-0N.jpg`, the two plots.

## Not checked

- No 4K render, no render with the film's motion blur (the watcher's blur 8), no title or dissolve composite: the title
  "One Surface. Zero Friction." (3.6-9.2 s, lower left) was not seen over the new frames. In that window the lower left
  holds the bust on its pedestal, the wainscot and the floor.
- The motion was judged from numbers and from frame sequences, not by watching the clip play.
- The ceiling is Agent C's. It is in frame as a thin strip at the top from about 7 s to 15.5 s (before: about 6 s to 9 s),
  more than before because of the added headroom.
- The Director page was not opened with the new keys.
- Running the pass on a copy of either cut also rewrites `shots/13-subshots.json` (hero desk versions) with no import at
  all; that is there on the base and has nothing to do with this patch.
