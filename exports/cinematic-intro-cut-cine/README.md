# Cinematographer's cut (November 13, 2026)

`review-cut.json` is "Vico's cut with people" (`exports/cinematic-intro-20261110-people`) re-shot: **only the camera
changes**. Every chapter keeps its length, its order, its desk moves (motion, status lights), titles, people, props,
lighting and time of day, field for field, so any chapter here replaces the same chapter of his cut one for one:
score, titles and dissolves stay where they are. What differs is where the camera stands, how it moves, its lens,
height and speed, what it looks at, and in three chapters a hard cut inside the chapter.

Rebuild the camera (in place; touches only `cameraPlan` and `camera`), and check that nothing else differs:

    python exports/cinematic-intro-cut-cine/build-cine-cut.py [--only id,id]
    python exports/cinematic-intro-cut-cine/check-camera-only.py

`build-cine-cut.py` writes story keys (`cameraPlan.keys`, stage units) and splines them with
`tools/experience/camera-spline.mjs`; where a key of his is kept, it is copied from his cut by its time (`his()`).
The check compares every field except `camera`/`cameraPlan` with the source cut, plus the copied film-data files.
Result at hand-off: **OK, identical outside the camera**; camera changed in 11 chapters, hero unchanged.

The film had a common pattern this cut works against: twelve similar slow orbits at one height, often at the
moment the desk moved, with a person standing between the lens and the moving part. Here each chapter picks the
one angle that makes its desk move readable (profile for height and tilt, high for a turn or a recede, low for
a lift), and the shot sizes and heights change across the film.

| Chapter | His camera | New camera | Why |
| --- | --- | --- | --- |
| awaken (opener, product) | wheel macro, pull-back; a high, far crane during the lift; the 65° tilt seen mostly from behind; turn and roll from three-quarters | his macro and reveal (0-7.4 s) and his level-lower-roll ending (35.85 s on) kept. Lift: down to a low three-quarter near the floor. Tilt to 65°: side three-quarter at board height, top surface lit. 100° turn: high wide over the floor ring | the low angle makes the climb read against the dark; the profile turns the tilt into a line on the frame; from above a turn is a turn |
| rise (home) | flew up and back while the desk rose, then looked at Maya's back while it moved (her body hid the column and legs); ended on the back of her head | his notebook/phone 8:00 macro, then one pull-back along the desk's length into a profile: Maya beside the rising column, the clock wall behind, window at left; arc to the front three-quarter as it lowers; slow widening into the evening room | the height change is visible next to a person; the end is a calm, whole frame for the dissolve |
| create (artist studio) | skimmed over Lin's head at the wheel (head cut by the frame corner for 3 s); the drafting tilt from a close low angle that stretched the board; screens cropped at the end | Lin whole at the wheel at the left of a deep frame, the desk at the back; glide past her side to the desk's front three-quarter for the 52 in lift; arc to a side three-quarter (far side, clear of Lin) for the 40° drafting tilt, window behind; round to the front for the painting, desk and screens whole | depth and a clean subject; the drafting angle is readable in profile; tilt stays his (motion unchanged) |
| commons (Humboldt) | the student in stripes hid the driving desk around 10.5 s; last frame cut the wheelchair at the right edge behind a big water bottle | his establishing over the double-height commons (0-2 s); down over the tables into a high lateral track parallel to the cork wall, so the desk drives across the frame toward Mia over the team's shoulders; **cut at 11.6 s** to the front: desk, Mia and the wheelchair whole, campus board behind | the drive is lateral movement against a plain wall; the arrival is a group frame with nobody cut |
| coast (OCC media lab) | a student cut by the right edge for 3 s; a chair silhouette cut in during the lift; the small tilt seen during a fast swing | longer lens down the aisle from its far end, Maya at the centre bay, the free suite at the end of the row; dolly down the aisle (clear of the bays) to the suite's front three-quarter as it rises; round to where its user would sit for the tilt | depth along the row of bays; the hero suite is the end of the line; slower, the tilt reads |
| oilers (high school) | craned off Kai (Kai cut by the frame); passed close behind a seated student; ended on standing Noah with his head cut by the top edge | his low opening on Kai; back off him clear of the set-design desk, along the window and across the room above the rows; a raised profile from the room side, window light from the left, so the desk rises beside Noah as he stands; small arc as he works standing | Noah stands right in front of the desk during the lift, so a frontal view is blocked; the profile shows both |
| wellness (gym) | at Maya's height through the lift, so her stretching body covered the desk; the cyclist cut by the left edge; the closing push cut Priya | his wide opening from the mirror wall (Kai whole on the bike); crane up to a high front three-quarter: Maya no longer hides the desk, the desktop climbs past her shoulders, Priya whole at the left; down to a mid-height three-quarter as she works | height change seen past the person instead of behind her |
| awareness (product) | fixed high three-quarter for the roll, the dog near the frame edge; side profile at the stop; closing arc | low over the desk's shoulder from behind, looking where it is going, the dog ahead; forward with the roll; **cut at 5.4 s** (the stop) to a floor-level profile at the dog's eye height, the gap a clean dark band; his closing front three-quarter (dog whole) | "it sees what's in its way": first its view, then the proof |
| music (gaming room) | opened on the back of Kai's head; swung across during the lift and tilt, cutting Kai's head at the left edge | a steep high angle over the room: the desk's light playing on the floor, Kai whole on the sofa; crane down through the lift and tilt into his symmetric front view (his last two keys) | the LEDs on the floor are the subject, and they read from above |
| media (movie night) | opened behind Omar with his head cut by the top edge; his wheelchair half in at the right edge for 9 s; one static frontal for 6 s | profile from the window side, desk and Omar in one frame with the guitar wall behind, the film's light on both; slow push; arc round behind Omar to an over-the-shoulder on the picture, his head and shoulder whole in the right foreground | the room lit by the film is the action; Omar is the audience, whole |
| storage (workshop) | skimmed the desktop at 1.5 s; saw the fold face-on (angle read late); desk filled the frame during the roll | his opening on the tool wall with a slow push instead of the skim; **cut at 2.5 s** (fold starts) to a side three-quarter from the far side: the 65° fold in profile, Andre whole with his phone; give way out through the open side as it rolls toward that spot; his tracking and parking keys from 17.3 s | the fold is the chapter's move and needs profile; Andre is out of frame during his fade-in (1.0-1.5 s) |
| hero (finale, product) | one continuous slow 48 s arc as six desk versions crossfade | **his, unchanged** | the single unbroken move is what makes six versions read as one desk; cuts or angle swings would fight the crossfades, and his composition leaves room for the title and end card |

Shot sizes across the film now run: macro (awaken, rise), low hero (awaken lift), profiles (awaken tilt, rise,
create, oilers, awareness floor level), high angles (awaken turn, commons track, wellness, music), deep/long-lens
(create, coast), over-the-shoulder (awareness opening, media), group (commons end).

## Walls and the void (checked)

Rooms are cutaways: the camera must never look out through a removed wall or from behind one. Every camera key was
placed against the room box printed by `render-cut.cjs --list-objects '^Room:'` (stage units):

| Chapter | Room box (x / z) | Checked |
| --- | --- | --- |
| rise | home x -2.31..4.87, z -2.99..3.49 | profile camera z 3.25-3.3 (inside the +z wall, looking -z), arc and wide x 2.3-3.4 inside; window behind the desk is a modelled window |
| create | creative x -2.91..6.44, z -4.04..4.57 | opening x 6.1 (inside), side three-quarter z -3.1 (inside the -z wall, looking +z) |
| commons | library x -11.98..43.15, z -13.70..11.29 | track z -6.1..-6.3, back wall at -13.7 always ahead of the lens |
| coast | occmedialab x -6.66..14.20, z -7.82..8.32 | all keys inside, looking -x/+z at the suite |
| oilers | highschool x -6.16..12.19, z -7.69..7.66 | all keys inside, z 1.1-3.6 |
| wellness | gym x -2.69..5.78, z -3.29..3.29 | high keys x 2.25-2.85, z -1.75..-0.55 |
| music | gaming x -2.31..4.48, z -3.52..2.84 | high key (2.9, 3.6, -0.9), inside; looks -x |
| media | music x -2.31..4.65, z -3.06..3.51 | profile z 2.55-2.9 (inside the +z wall); end x 2.95-3.15 inside, looking -x; never looks toward the open +x front |
| storage | workshop x -2.84..5.73, z -4.11..4.83; the +x side is open | keys outside x 5.73 (as his are) only look -x, and the frame's far edge was computed to meet the far wall inside the room's corner; side three-quarter (4.3, -3.4) inside |

Then every re-shot chapter was rendered as a 640x360 clip and checked frame by frame at 2 fps (contact sheets in
`/c/work/cine-review/<chapter>/final/check-NN.jpg`, outside the repo). Result: see "Check results" below.

## Check results

(filled in below)

## Unsure

- People whose pose changes inside a shot (rise, wellness, oilers) still cross-dissolve over about half a second; the
  camera does not hide it (known rough edge of the people pass).
- Brief exits at a frame edge while the camera moves, judged acceptable as wipes, not held cuts: coast (Maya leaves
  the right edge at about 2-2.5 s as the dolly passes her), wellness (Kai on the bike leaves the left edge at 3-4.5 s;
  his own opening), music (Kai leaves the bottom-left corner as the crane comes down, 8-9.5 s), storage (Andre leaves
  the left edge as the camera pans with the rolling desk, about 11.5-13 s), commons (Sofia large in the foreground of
  the track around 8.5-9.7 s).
- coast: the walking student stands beside the free suite around 8.5-9.5 s (whole, not blocking it); a chair edge
  at the left of that frame.
- commons: in the frozen state Mia sits in an office chair next to the parked wheelchair. The end frame holds desk,
  Mia and wheelchair whole; if the desk session moves Mia into the wheelchair at a different spot, re-check that frame.
- People placements are being corrected in the source cut by the desk session; every framing here was judged on the
  frozen inputs (studio state rev 3424). A moved person may need a key nudged.
- create keeps his tilt values (motion unchanged): the last tilt in motion is 55°.

## Not checked

- No full-resolution or hq14 render; only 960x540 stills and 640x360 clips at hq13 (blur 1, 15 fps), so motion blur,
  fine flicker and exact title overlap were not judged.
- Titles were not composited over the new frames (the render path used here does not draw them); title safe areas
  were judged by eye only.
- Dissolves between chapters were not previewed end to end (each chapter was rendered alone).
- Director import keeps only 64 camera keys; like his cut with people, these chapters carry more (dense splines).
