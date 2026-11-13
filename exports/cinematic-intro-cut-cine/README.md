# Cinematographer's cut (November 13, 2026)

`review-cut.json` is "Vico's cut with people" (`exports/cinematic-intro-20261110-people`) re-shot: **only the camera
changes**. Every chapter keeps its length, its order, its desk moves (motion, status lights), titles, people, props,
lighting and time of day, field for field, so any chapter here replaces the same chapter of his cut one for one:
score, titles and dissolves stay where they are. What differs is where the camera stands, how it moves, its lens,
height and speed, what it looks at, and in seven chapters a hard cut inside the chapter.

Rebuild the camera (in place; touches only `cameraPlan` and `camera`), and check that nothing else differs:

    python exports/cinematic-intro-cut-cine/build-cine-cut.py [--only id,id]
    python exports/cinematic-intro-cut-cine/check-camera-only.py

`build-cine-cut.py` writes story keys (`cameraPlan.keys`, stage units, as `--list-objects` prints them) and splines
them with `tools/experience/camera-spline.mjs`; a key of his that is kept is copied from his cut by its time
(`his()`). `check-camera-only.py` compares every field except `camera`/`cameraPlan` with the source cut, plus the
copied film-data files (titles-src.json, director-camera-oilers.json, shots/13-subshots.json).
**Result at hand-off: OK, identical outside the camera; camera changed in 11 chapters, hero unchanged.**

The film had a common pattern this cut works against: similar slow orbits at one height, often at the moment the
desk moved, with a person standing between the lens and the moving part, and people cut by the frame edge. Here
each chapter picks the angle that makes its desk move readable (profile or side three-quarter for height and
tilt, high for a turn, a drive or a person in front, low for a lift), shot sizes and heights vary across the film,
the readouts that tell the story face the lens, and where a person would have to slide off a frame edge while the
camera travels, the chapter cuts instead.

| Chapter | His camera | New camera | Why |
| --- | --- | --- | --- |
| awaken (opener, product) | wheel macro, pull-back; a high, far crane during the lift; the 65° tilt seen mostly from behind; turn and roll from three-quarters | his macro and reveal (0-7.4 s) and his level-lower-roll ending (35.85 s on) kept. Lift: in and down to a low three-quarter, then craning up with the rise until the desktop and its blue light read, headroom over the monitor. Tilt to 65°: side three-quarter at board height. 100° turn: from above and close, the desk filling the frame with its glow | low angle for the climb, profile for the tilt angle, above for the turn; on the dark stage the desk fills half to two-thirds of the frame |
| rise (home) | flew up and back while the desk rose, then looked at Maya's back while it moved (her body hid the column and legs); ended on the back of her head | his notebook/phone 8:00 macro; a pull-back to a front three-quarter on Maya's side (about 40° off the portrait screen), so the height readout faces the lens through both moves (28.9, 38.5, 42.3 up; 29.7, 28.0 down) with Maya and the column whole; arc to the front three-quarter as it lowers; a slow push toward the screens and the evening summary to the last frame | the readout is the proof that it rises; desk and person whole; the dissolve gets a clear subject |
| create (artist studio) | skimmed over Lin's head at the wheel (head cut by the frame corner for 3 s); the drafting tilt from a close low angle that stretched the board; screens cropped at the end | Lin whole at the wheel at the left of a deep frame, the desk at the back (slow push); **cut at 2.4 s** to the desk's front three-quarter for the 52 in lift; a continuous arc to a side three-quarter (far side, clear of Lin) through the 40° drafting tilt, window behind, never still; round to the front for the painting, desk and screens whole | depth and a clean subject; the drafting angle reads in profile; the cut replaces a pass that would slide Lin off the edge |
| commons (Humboldt) | the student in stripes hid the driving desk around 10.5 s; last frame cut the wheelchair at the right edge behind a big water bottle | his establishing over the double-height commons (0-2 s); down into a high, wide lateral track parallel to the cork wall, the desk driving across the frame toward Mia with the team at the table below; **cut at 11.6 s** to the front: desk, Mia and the wheelchair whole, campus board behind | the drive is lateral movement against a plain wall; the arrival is a group frame with nobody cut |
| coast (OCC media lab) | a student cut by the right edge for 3 s; a chair silhouette cut in during the lift; the small tilt seen during a fast swing | longer lens down the aisle from its far end, Maya at the centre bay, the free suite at the end of the row; **cut at 2.0 s** past her to the aisle; dolly to the suite's front three-quarter as it rises; round to where its user would sit for the tilt, easing in | depth along the row; the hero suite is the end of the line; slower, the tilt reads |
| oilers (high school) | craned off Kai (Kai cut by the frame); passed close behind a seated student; ended on standing Noah with his head cut by the top edge | his low opening on Kai (to 1.15 s); **cut at 1.2 s** to a high frame along the window, the class and Noah at the featured desk; **cut at 4.5 s** toward the featured desk, landing in a raised profile with window light, so the desk rises beside Noah as he stands; small arc as he works standing | Noah stands right in front of the desk during the lift, so a frontal view is blocked; the profile shows both; cuts instead of sliding Kai and the class off the edges |
| wellness (gym) | at Maya's height through the lift, so her stretching body covered the desk; the cyclist cut by the left edge; the closing push cut Priya | his wide from the mirror wall (Kai whole on the bike), a slow push; **cut at 2.5 s** to a high front three-quarter: Maya no longer hides the desk, the desktop climbs past her shoulders, Priya whole at the left; down to a mid-height three-quarter as she works | the height change seen past the person instead of behind her |
| awareness (product) | fixed high three-quarter for the roll, the dog near the frame edge; side profile at the stop; closing arc | low over the desk's shoulder from behind, looking where it is going, the dog ahead; forward with the roll; **cut at 5.4 s** (the stop) to a floor-level profile at the dog's eye height, the gap a clean dark band; his closing front three-quarter (dog whole) | "it sees what's in its way": first its view, then the proof |
| music (gaming room) | opened on the back of Kai's head; swung across during the lift and tilt, cutting Kai's head at the left edge | a steep high angle over the room: the desk's light playing on the floor, Kai whole on the sofa; craning down as it rises; **cut at 7.8 s** on the rise to the front view, then his closing push | the LEDs on the floor are the subject and read from above; no slide of Kai off the frame |
| media (movie night) | opened behind Omar with his head cut by the top edge; his wheelchair half in at the right edge for 9 s; one static frontal for 6 s | front three-quarter from the window side, desk and Omar in one frame, the film's light on both, slow push; **cut at 9.0 s** to an over-the-shoulder behind Omar, his head and shoulder whole in the right foreground, the picture clear, easing in | the room lit by the film is the action; Omar is the audience, whole |
| storage (workshop) | skimmed the desktop at 1.5 s; saw the fold face-on (angle read late); desk filled the frame during the roll | a top-down opening on the desktop and its robots (Andre out of frame through his fade-in) instead of his skim; **cut at 2.5 s** (fold starts) to a side three-quarter from the far side: the 65° fold in profile, Andre whole with his phone; **cut at 8.9 s** on the roll to the outside view along the wall; his tracking and parking keys from 17.3 s | the fold needs profile; Andre is out of frame during his fade-in (1.0-1.5 s); cuts instead of panning him off the edge |
| hero (finale, product) | one continuous slow 48 s arc as six desk versions crossfade (sub-shots A-F) | **his, unchanged** | it already meets the rules: the desk is 0.6-0.8 of the frame height from 0 to 40 s and about half in the end card (40-48 s, room for the title), the camera never holds, and the single unbroken move is what makes six versions read as one desk. Changing it would also mean rewriting the six identical sub-shot cameras in shots/13-subshots.json for no gain |

Shot sizes across the film: macro (awaken, rise), low hero (awaken lift, awareness), profiles and side
three-quarters (awaken tilt, create, oilers, awareness floor level, storage), high angles (awaken turn, commons,
wellness, music, oilers), deep/long lens (create, coast), over-the-shoulder (awareness, media), group (commons end).

## Fixes after the desk's review of chapters 1-3

- awaken: lift and turn brought closer (desk half to two-thirds of the frame height at about 10 s and 30 s); the
  low angle now cranes up with the rise so the desktop surface and its blue light read at about 15 s, with headroom
  over the monitor (aim raised, lens a little wider).
- rise: the lift is watched from a front three-quarter on Maya's side, so the portrait screen's height readout
  faces the lens during both moves; desk not clipped at 4 s (wider lens, re-aimed); the end pushes in toward the
  screens and the evening summary to the last frame instead of holding a room wide.
- create: no hold in 10-16 s, the arc continues through the drafting tilt; Lin's exit replaced by a cut at 2.4 s.
- all chapters: rules (a)-(d) applied and checked on ten evenly spaced stills per chapter plus a clip; edge exits of
  people while the camera travels replaced by cuts (create, coast, oilers, wellness, music, media, storage).

## Walls and the void (checked)

Rooms are cutaways: a wall facing a camera outside the room is hidden, so a camera outside must keep the frame
inside the room's extent. Every key was placed against the room box printed by `--list-objects '^Room:'` (stage
units) and the far frame edge computed against the room's corners where a camera stands outside:

| Chapter | Room box (x / z) | Checked |
| --- | --- | --- |
| rise | home x -2.31..4.87, z -2.99..3.49 | lift keys (1.55-1.7, z 2.5) and end (1.45, 1.95) inside; arc key z 2.75 inside; looks toward the window wall (a modelled window) |
| create | creative x -2.91..6.44, z -4.04..4.57 | opening x 6.1, side three-quarter z -3.1..-2.55, front x 2.75-3.75: all inside |
| commons | library x -11.98..43.15, z -13.70..11.29 | track z -5.6..-6.3 at height 3.2-3.45; the back wall (z -13.7) is always ahead of the lens |
| coast | occmedialab x -6.66..14.20, z -7.82..8.32 | all keys inside, looking -x/+z toward the suite |
| oilers | highschool x -6.16..12.19, z -7.69..7.66 | all keys inside (x -2.2..5.2, z 1.1..3.2) |
| wellness | gym x -2.69..5.78, z -3.29..3.29 | opening his (x 5.18, inside); high keys x 2.25-3.05, z -1.75..-0.55 |
| music | gaming x -2.31..4.48, z -3.52..2.84 | high keys (2.9, z -0.9..-0.3) inside; front keys his |
| media | music x -2.31..4.65, z -3.06..3.51 | first shot (1.4-1.6, z 2.7-3.1) inside the +z wall; over-the-shoulder x 2.95-3.3, z -1.0..-1.1, inside, looking -x |
| storage | workshop x -2.84..5.73, z -4.11..4.83 | inside keys at z -3.4..-3.7 (the far wall at -4.11); outside keys (x 7.5-7.9, as his are) look about -x/-z and their far frame edge meets the z -4.11 wall at x 5.4-5.7, inside the corner |

Then every re-shot chapter was rendered as a 640x360 clip and checked frame by frame at 2 fps (contact sheets
`/c/work/cine-review/<chapter>/final/check-NN.jpg`, outside the repo). Result: see "Check results".

## Check results

Final 640x360 clips of the eleven re-shot chapters, 2 frames per second, every frame looked at
(`/c/work/cine-review/<chapter>/final/check-NN.jpg`; ten evenly spaced 960x540 stills per chapter in `s10*`):

- Void / back of a cutaway wall: **none seen** in any chapter.
- People: whole, or a deliberate foreground (commons: the orange-shirted teammate in the lower foreground of the
  high wide, head and shoulders whole; media: Omar's head and shoulder in the over-the-shoulder). Edge exits while
  the camera travels were replaced by cuts. Remaining brief edge crossing: coast, the walking student enters and
  leaves the left edge at about 7.5-9 s (each crossing about half a second; her walk, not the camera).
- Readouts: rise's portrait-screen height readout faces the lens through both moves (28.9 to 43.1 up, 38.0 to 28.0
  down); awaken's and awareness's screens face the lens in the beats where they show the status.
- Holds: none longer than about 2 s except a chapter's last beat (oilers holds Kai 0.6-1.15 s; storage keeps his
  0.9 s rest at 19.6-20.5 s and his ending hold from 22.5 s).
- Hero size on the stage: awaken, awareness and hero keep the desk at half the frame height or more (hero's end
  card about half, his framing, kept for the title).

## Not ours (people data in the source cut)

Pose changes inside a shot cross-dissolve over about half a second (a known rough edge of the people pass, not the
camera); the camera keeps a medium or wider view at those moments: rise (Maya sits to standing at about 3.75 s,
standing to seated at about 12.5 s), wellness (Maya seated to stretching at 6.6 s, back to working at 10.35 s),
oilers (Noah seated to waiting at 8.3 s, to standing at 10.7 s), commons (Mia's phone to typing at 12.6-13.1 s,
seen in the wide front frame). Andre fades in at 1.0-1.5 s in storage (his `when`); the camera keeps him out of
frame until after it.

## Unsure

- commons: in the frozen state Mia sits in an office chair beside the parked wheelchair. The end frame holds desk,
  Mia and wheelchair whole; if the desk session moves Mia into the wheelchair elsewhere, re-check that frame.
- People placements are being corrected in the source cut; every framing here was judged on the frozen inputs
  (studio state rev 3424). A moved person may need a key nudged.
- coast: the walking student stands beside the free suite around 8.5-9.5 s (whole, not blocking it).
- create keeps his tilt values (motion unchanged): its last tilt in motion is 55°.
- Seven chapters now contain a hard cut; on the score the cuts sit on desk actions (fold start, stop, rise), not on
  beats, which I could not hear here.

## Not checked

- No full-resolution or hq14 render; only 960x540 stills and 640x360 clips at hq13 (blur 1, 15 fps), so motion blur,
  fine flicker and exact title overlap were not judged.
- Titles were not composited over the new frames (the render path used here does not draw them).
- Dissolves between chapters were not previewed end to end (each chapter was rendered alone).
- Director import keeps only 64 camera keys; like his cut with people, these chapters carry more (dense splines).
