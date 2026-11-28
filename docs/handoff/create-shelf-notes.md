# Ch 03 Create: side shelf clipping (branch `director/create-shelf-review`)

Base `origin/video/cinematic-intro-hq` 83c4f944. Studio state: committed `studio-state.json` rev 9671. Chapter `create` (23.5 s).
Edited **only the 3rd cut** (`exports/cinematic-intro-cut-vicos-3rd-cut`), per the scope update: `director-film/create.json`,
the `create` shot in `review-cut.json`, and the `props` list in `director-camera-create.json` (kept identical). Data only. These are the
Director's own add-prop edits (`director: true`, position / rotation in the desk-dressing frame), so they stay editable in the prop panel.
No code, GLB, camera, clip, tilt target (drafting stays 40, easel 55; the desk's own tilt reads 44.5 / 60), title, score or EDL change.

## What was wrong (measured in the stage, film-quality hq13)
The desk "wings" are the two curved side panels under the desktop (`tiltWrapper_tilting > Desktop_1 / Desktop_2`, 27 mm thick, at
x = -/+0.798 to 0.826 m in the dressing frame, x being the tilt axis). Every added shelf rides the tilting desktop frame
(`Desk dressing:desktop`). Gemini's reading that the right shelf "stays horizontal" did not hold: it tilts with the desktop.
- **Right wing (7.4-17.3 s), `Side shelf · large, cubby and cups` (vima7dnnn)**: its inner edge sat at x 0.797, so the board went
  through the whole thickness of the right wing panel; the easel rail's end (`Prop:ergoflex-easel-accessory`, hangs to y -0.106)
  passed 2.4 mm into the board. Inside the cubby: the steel ruler went 6 mm into / through the outer wall at the floor, the drafting
  pen and the tape 2.0 / 1.6 mm into a divider, the pen and tape floated 37 / 42 mm above the cubby floor. The stylus (leans 28 deg
  toward the front, above the rim) was already inside its compartment (12.5 mm margin): its "poke through" was the shelf/rail clip.
- **Left wing (17.3-23.5 s), `... (left wing)` (crdraftL)**: deliberately counter-rotated to stay level at the easel tilt, but
  -56.9 deg against the 55 deg tilt left it 1.9 deg past level, and the cup (-58.8) 3.8 deg. Its inner edge (x -0.779) also went
  right through the left wing panel, and its top touched the tilted desktop's underside.
- **Left painter accessory shelf (7.4-17.3 s, crpaintL)** (found on the way): 20 of its vertices inside the left wing panel.
- **Duplicate Lin: not reproduced.** `room-lin-v5n086` is a pose-only entry (`poseSource` lin-at-wheel), not an extra person
  (room-people.mjs drops poseSource entries from the extra cast); lin-at-wheel is shown 0-14 s. Visible people named Lin:
  5.0 s only the potter at the wheel, 17.5 / 18.7 s none, 19.6-23.4 s only the painter at the desk. Nothing changed.
- **"Right wing crowds two cups": not reproduced.** 0-7.4 s the right cup holder carries one tea cup (frames 2.0 / 4.5 / 7.0 s);
  7.4-17.3 s the shelf's cup ring is empty. Nothing changed.

## The change (all values in the desk-dressing frame, metres / degrees, as the Director stores them)
| Prop | Was | Now |
|---|---|---|
| Side shelf (right) vima7dnnn | pos [1.133,-0.183,0.485] | [1.164,-0.239,0.485] (31 mm out off the wing, 56 mm down under the rail end) |
| Steel ruler crdrRrul | [1.399,-0.065,0.66] rot [76,8,-5] | [1.4146,-0.1178,0.6939] rot [-93.1,-8.45,89.77] (right compartment, 9 deg lean) |
| Drafting pen crdrRpen1 | [1.33,-0.039,0.676] rot [78,-20,8] | [1.3604,-0.1171,0.6885] rot [-95.55,-9.51,29.54] (middle compartment, 11 deg) |
| Masking tape crdrRtap | [1.326,-0.135,0.64] rot [0,18,0] | [1.347,-0.2309,0.655] rot [0,90,0] (on edge, on the floor) |
| Stylus crdrRpen2 | [1.248,-0.058,0.618] | [1.279,-0.114,0.618] (same pose, moved with the shelf) |
| Side shelf (left) crdraftL | [-1.115,-0.035,0.292] rot [-56.9,90,0] | [-1.1635,-0.0465,0.3084] rot [-55,90,0] |
| Cup crdrLcup | [-1.326,-0.062,0.266] rot [-58.8,-35,0] | [-1.3745,-0.0726,0.2815] rot [-55,-35,0] |
| Multi-tool / shears / compass stylus | (see diff) | same rigid move as the left shelf (+1.9 deg about the tilt axis through the shelf origin, 48.5 mm out, 20 mm down in the shelf's own down) |
| Painter shelf (left) crpaintL | [-1.249,-0.325,0.263] | [-1.2865,-0.325,0.263] (37.5 mm out) |

## Verification (after)
Probes and scripts are in the session scratch folder (`create-shelf/probe*.js`, `plan.py`, `apply.py`).
- Static, exact (closest-triangle distance plus 3-ray parity), 12.0 s and 21.0 s: right shelf 2.3 mm from the right wing panel,
  55.7 mm from the rail, 87.5 mm from the desktop; left shelf 1.9 mm from the left wing panel, 6.5 mm under the desktop; painter
  shelf 2.9 mm from the left wing panel; no vertex of either inside the other (before: through the panels, rail 2.4 mm in).
- Cubby, real vertices against the measured compartments (dividers / walls from mesh slices, floor 6 mm): ruler 2.4, pen 4.2,
  tape 2.0, stylus 5.4 mm worst margin, all resting 2.0-5.4 mm above the floor. Pen to tape: touching (0.1-0.4 mm).
- 120 fps, 8.7-23.5 s (1777 frames, film camera): the dressing frame is NOT rigid to the desk's tilt wrapper (up to 0.066 matrix
  change), so clearance was measured per frame: shelf vertices against each panel's and the rail's own bounding box (conservative):
  right shelf / right wing >= 2.3 mm, rail >= 8.2 mm; left shelf / left wing >= 1.9 mm; painter shelf / left wing >= 2.1 mm. Exact
  desktop check at 120 fps 17.3-19.7 s (the easel tilt, 289 frames): left shelf >= 6.6 mm, no vertex inside; right shelf at 10 Hz
  8.7-17.3 s >= 87.5 mm.
- World tilt at the settled easel tilt (19.9-23.5 s): left shelf 0.0 deg, cup 0.0 deg (were 1.9 / 3.8). During 17.3-19.5 s it
  still swings to level with the desk (fixed rotation, as before).
- Strips in `create-shelf/`: film camera 8.7-17.4 s, close right shelf 8.7-17.4 s, close left shelf 17.5-23.4 s, film 12.0 s and
  19.5-20.5 s (before / after rows).
- Tests: cinematic-cuts, film-edits-clone, film-edits-show-screen, side-shelving, people-pose-keys pass. No .mjs edited, so no ESLint run.

What this does not cover: the per-frame panel / rail measure uses their bounding boxes (conservative; the exact distances above are
for 12.0 / 21.0 s); the cubby check is against the compartments' straight walls and floor, not fillets; the left cubby's own contents
were moved rigidly and not re-checked against their cubby (unchanged relative to it); Lin's hands and the camera's view of the
moved shelves were checked by eye only; 1080p / 4K renders: none requested.

## 4th cut: NOT ported (scope: 3rd cut only)
`exports/cinematic-intro-cut-vicos-4th-cut/director-film/create.json`, its `review-cut.json` (`create` shot) and
`director-camera-create.json` still carry the old values for vima7dnnn, crdrRrul, crdrRpen1, crdrRtap, crdrRpen2, crdraftL, crdrLmto,
crdrLcup, crdrLsci, crdrLsty, crpaintL. Port = apply the table above to those three files (same ids; the 4th cut differs only in titles).
