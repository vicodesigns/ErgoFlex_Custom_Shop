# Coast: Ava's hands glitch while she stands up (Vico, 1:52-1:53)

Base: `cut/vicos-3rd-current-20261121-1545` d4cd5fb3 (Vico's current seated 3rd cut). Chapter coast (ch5), chapter starts at about 106.85 s of the film.

## Cause

The film draws Ava (blue top, white trousers) as four models of one person at the featured desk (DeskActor,
room-people-motion.mjs). It changes model as the desk rises: `people-ava-sit-type` (28 in), then `sit-type-30`
at 4.333 s, then `stand-low` (35.5 in) at 5.367 s, then `stand-mid` (39 in) at 6.367 s. The motion underneath is
continuous. Her pose corrections (pose keys) are stored per model, though, and two neighbouring models had
different ones:

| switch (chapter s / film s) | correction before | correction after | wrist jump in one frame | hand turn |
|---|---|---|---|---|
| 4.333 / ~111.18, sit-type -> sit-type-30 | ava-sits `people-ava-sit-type` (constant arm turns, e.g. upperarm_l -27 deg, lowerarm_l +36 deg) | none (no sit-type-30 record): the arms lose the correction | L 148 mm, R 80 mm (fingertip 173 mm) | 35 / 32 deg |
| 5.367 / ~112.22, sit-type-30 -> stand-low | blend toward ava-sits `people-ava-stand-low` | the same blend | 21 mm (normal motion) | 2 deg |
| 6.367 / ~113.22, stand-low -> stand-mid | ava-sits `people-ava-stand-low` (its 7.6 s key held: hand_l twisted out) | ava-stands `people-ava-stand-mid` (first key 6.367: hand flat at the thigh, spine) | L 94 mm (fingertip 140 mm, R fingertip 110 mm) | 58 / 33 deg |

The 6.367 s switch (113.22 s, standing up) is the "hand connect" glitch Vico describes: the left hand snaps from
turned out beside the thigh to flat against it in one frame. The 4.333 s one (111.18 s, as she starts to get up:
the left hand drops from the knee to the thigh in one frame) is the same kind of bug, a second earlier.
Seen in the frames (close cameras, every 1/30 s) and in the stage's own bone positions (probe-bones.cjs on the real
stage, `measurements/jumps-before.txt`, `measurements/shown-corrections-before.json`: which model is drawn and
which correction it carries, per frame). The stand-up swap itself (5.367 s) is smooth.

## Fix (data, cast entry `ava-sits` only; build-fix.mjs)

1. `postures['people-ava-sit-type-30']` = a copy of `postures['people-ava-sit-type']`: what the Director's
   pose mode "copy to the other desk height" button does (scene-people-editor.mjs copyToModel).
2. `postures['people-ava-stand-low'].poseKeys`: two keys added before the three that are there (5 keys now):
   5.35 s = the turns that record already gives every bone there (nothing before changes), and 6.333 s (the last
   frame stand-low is drawn) = the turns of ava-stands' stand-mid correction at 6.367 s, for every bone either record
   names (33 bones). The stand-low record is only seen 4.33-6.35 s (blended into the seated models, then drawn by
   stand-low), so its keys at 7.6, 7.7 and 11.3 s are left as they are.

Changes pixels only in Coast, only 4.333-6.35 s, only Ava. ava-stands (stand-mid), the camera, titles, the desk
and the other people are untouched. No code change, no epoch bump.

Export doc: `Film-chapter-coast-14-5-s-hands.json` (make-doc.mjs). There is no raw Coast export of Vico's in this cut
(director-exports/ has none for coast: the chapter came over unchanged from the 2nd cut), so the doc is the cut's own
Coast page doc (`director-import/ErgoFlex-film-ch05-coast-director.json`) plus `peopleEdits` = `{v: 2, ...people}`
(the fixed people object, imported verbatim by build-round8-director.py clean_people).

## Verification

Stage probe, every 1/30 s, 3.4-8.0 s (`measurements/probe-*.csv`, `jumps-*.txt`):

* the two switches: 4.333 s 148 -> 23 mm (L wrist), 35 -> 0.4 deg; 6.367 s 94 -> 3 mm, 58 -> 1.3 deg.
* largest one-frame values 4.1-6.8 s after: wrist 58.9 mm (right, 4.467 s), hand turn 7.4 deg, forearm 15.2 deg
  (5.467 s); none at a model switch. These are the motion's own fast moments (the hands leaving the thighs as the
  legs take the weight), present before as well (37.8 mm / 14.5 deg) and continuous in the frames.
* bone positions identical before/after (0.00 mm) up to 4.300 s and from 6.367 s on.

Renders (1920x1080, chapter 4.1-6.8 s, every frame): two fixed close cameras on her hands (render/mkcut.mjs; left
side -1.0,1.25,6.45 -> -1.65,1.05,5.0 fov 40; right side -0.95,1.25,3.5 -> -1.65,1.05,4.95) and the film camera.
Sheets coast2-sheet-*.jpg, clip coast2-closeup-before-after-halfspeed.mp4 (pushed to the desk).

Importer round trip on scratch copies (F:/eng-coast-scratch, import.sh): control doc (same page doc, people
unchanged) vs the fix doc: review-cut.json and director-film/coast.json differ only in
`ava-sits.postures.people-ava-sit-type-30` (added), `ava-sits.postures.people-ava-stand-low.poseKeys` and
`directorEdited.at` (`measurements/roundtrip-control-vs-fix.txt`). The control import left review-cut.json and
coast.json identical to the cut (`roundtrip-original-vs-control.txt`; the other differences there are the known
Windows pages-step artefacts: `screens` emptied in other chapters' director-film files, page paths).
