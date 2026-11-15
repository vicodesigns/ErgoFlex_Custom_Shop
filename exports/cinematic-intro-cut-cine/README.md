# Cinematographer's cut (November 13, 2026; round 2 rebased on 9aef44f)

> **Since November 14 2026 this is the WORKING CUT** (Vico). People, props, screens, desk moves and cameras are
> edited here directly; it no longer has to stay camera-only against "Vico's cut with people", and nothing is synced
> from that cut (nor from it to the master cut hq14, the alternate cut or the cut with people, which are never
> written). Rules for editing `review-cut.json`:
> - Each stream writes only its own chapters' entries; keep the file's format (Python `json.dumps(cut, indent=1)`,
>   ensure_ascii, LF, no final newline) so a load-and-dump round-trips byte for byte and diffs stay per chapter.
> - Cameras: `build-cine-cut.py` still holds each chapter's camera story. Change a camera there and run it with
>   `--only <your chapters>`; if you set a chapter's camera by hand in review-cut.json, delete that chapter's
>   function from build-cine-cut.py in the same commit so a rerun cannot revert it.
> - `check-camera-only.py` is no longer a required check: it now only notes which chapters differ from the cut with
>   people outside the camera, and exits 0 (`--strict` gives the old exit status 1).
>
> The text below describes the camera-only round of November 13 and is kept as its record.

## November 14: commons and coast (Vico's notes 6, 6b and 7)

- **commons**: the desk starts at 39 in (was 43.5) and Yara types at it as `people-yara-stand-mid` (built for 39 in;
  she is 1.57 m: elbows about 90 degrees, forearms level, instead of reaching up). Her backpack is fitted to her body
  (tools/people/held.py `backpack`: the pack's top just under the shoulders, the straps over them); the bag on the
  desk's base shelf is hidden from 5.25 s, the cut where she has taken it (`accessories.add[].visible`). The desk
  lowers to 30 in for Mia (was 32), who types at it as `people-mia-power-type-30`; a side still at 30 in with that
  model shows her knees and the chair's armrests clear of the keyboard tray. The desktop keeps its -5 degree tilt
  until 9.9-12.9 s (unchanged): Yara and Mia are placed people, not the desk's actor, so the keyboard-following rule
  for a tilted top does not move them, and the stills show their hands on the keys (Mia types from 12.6 s, the top
  then within half a degree of flat). Camera unchanged.
- **coast**: one person's action from start to end, one continuous camera (no cut). Ava (the room's morning student
  at the featured suite, blue top) edits seated at 28 in; the suite rises 28 to 39 in (3.6-7.6 s), she gets up as it
  sets off (the room's desk actor: chair back, she stands, hands back on the keys as it arrives) and works standing
  at 39 in (`people-ava-stand-mid`). The camera starts on her seated from the front three-quarter, follows the rise,
  rounds behind her wide of her shoulder (about 25 degrees a second, 7.6-12.2 s) and ends on the desktop with the
  Orange Coast College mark and her at the keyboard. The board tilt (to +5 at 9.65 s) is gone: a tilt beyond 4
  degrees takes a typist's hands off the keys. Maya stays at her own bay (bay 1), out of this camera.
- **coast to oilers**: the film's EDL dissolves these two over 1.5 s (`transitions[4]` of the HQ14 EDL): coast
  13.0-14.5 s over oilers 0-1.5 s (30 fps: coast frames 390-434, oilers frames 0-44). Coast holds one slow push
  through it (no cut after 7.6 s). Hand-off frame: **oilers frame 45 (1.5 s)**, the first frame out of the dissolve.
  **Requirement on oilers (stream S5's chapter, its camera and `oilers()` in build-cine-cut.py are S5's):** its
  opening shot must run unbroken from frame 0 to at least frame 90 (3.0 s), so the dissolve opens on one readable
  frame and no cut falls inside it or right after it. In this branch's state oilers still has its old cut at 1.2 s
  (frame 36, inside the dissolve); S5's branch (cine/s5) replaces it with a class view from frame 0 and no cut
  before 4.5 s.

## November 14: Maya's standing height, rise and wellness (Vico's rule in note 6: elbows at 90 degrees, forearms level)

- **rise and wellness**: the desk stands at **41 in** (was 43.5, about 2.8 in too high for her: elbow 86 degrees,
  forearm +15) in rise (`comfortable-standing`) and wellness (`stand-break`); timing unchanged. Maya types standing as
  the new `people-maya-stand-type-41` (tools/people/cast.py: stand-type built for 41 in, her hands 40 mm nearer the
  body; rig measure elbow 90, forearm 0), cast at the featured desk as `maya-stand` (`desk: stand`, `reach: 850`) with
  `people-maya-stand-type` out of `people.only`, so the desk actor carries her from sit-type up to it. Cameras unchanged.
- The rise title and the rise shot's `detail` say Rise to 41″ (only the number; the title's detail shadow path is
  shortened to the shorter text). The monitors' height readouts follow the lift's target (screens ch02.js, ch07.js);
  the rise and wellness clips that show them come from stream S6 (captures that read the cut and end on 41.0); until
  S6 lands, the cut still points at the old clips, which end on 43.5.
- **Landing order**: the people commit that builds `people-maya-stand-type-41` (model, index.json, people.json,
  people-rigs/maya.json) must land before or with any branch whose cut casts it; without it Maya is missing standing.

## November 14 (working cut): awaken and create

- awaken: both titles (ERGOFLEX 3.6-9.2 s, SAFETY 13.2-18.4 s) sit lower left; the keys under them are aimed so the
  desk stands in the right part of the frame, clear of the title block (`frame_right` in build-cine-cut.py; Vico's
  img19).
- create: the ending from the 1080p render req-20261114T004013 (which was of the alternate cut): from 19.5 s Lin paints
  at the tilted canvas (`people.cast` lin-desk, people-lin-stand-paint, as in that cut; Lin at the wheel 0-14 s), with
  that render's two closing camera keys after a cut at 19.5 s. The opening keys are aimed a little left so the desk and
  stool clear the TILT title. Screens: offset 0 (clip time = chapter time). For the screen content: digital painting
  0-7.0 s, architecture on both screens 7.0-16.9 s, natural landscapes on both 16.9-23.5 s.

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
copied film-data files (titles-src.json, shots/13-subshots.json). director-camera-oilers.json was removed from this
cut on purpose: a Director pass would copy his oilers keys back into review-cut.json.
**Result at hand-off (against the new source, 9aef44f): OK, identical outside the camera; camera changed in 11
chapters, hero unchanged.**

## November 15: titles clear of the desk and of people (S12)

Vico: "the title shouldn't overlap the desk". The title block sits lower left (about x 0.07-0.43, y 0.70-0.92 of the
frame). Checked on stills with the titles burned in at each title's in (+0.7 s), middle and out (-0.3 s).

- Camera only (`frame(key, dx, dy, fov)` in build-cine-cut.py: the lens `fov` degrees wider, then the aim turned so
  the frame's content sits `dx` of the (widened) width further right and `dy` of the height higher): rise (4.3-9.45 s
  keys), commons (the two shots under the title), coast (the three keys under it, 3-4 degrees wider), awareness (the
  drive shot, 5 degrees wider, and the floor-level profile raised), music (the high shot and the front view), media
  (the first shot). Storage's camera is as it was (a turn of its walk-round wide opened the room's open left edge,
  the void, and Andre walks through the lower left there from 5.3 to 6.6 s).
- Timing (titles-src.json): storage's title plays on the fold shot, 11.75-14.75 s (was 2.75-9.75 s, over the desk at
  the hand-over and Andre in the phone insert): the floor in front of the folding desk is clear, and the line it
  carries ("One tap: fold to 65 degrees, roll to the wall") is what that shot shows; 3.0 s on screen, under the 3.5 s
  guide (the Director only notes it). create's TILT title ends at 9.2 s (was 9.6) before the stool comes under its
  last line.
- hero: `frame-hero-title.py` turns the aim of the one sub-shot on screen under the closing title (the architect desk,
  shots/13-subshots.json, 33.2-48 s) by up to 0.05 of the width, eased in over 34.2-34.8 s and out over 39.4-40.4 s,
  so the near leg clears the end of "day." at about 37 s; the other sub-shots and review-cut.json's hero camera are
  unchanged (none is on screen then).
- Title placement option (for wellness; the cut does not use it yet): a title's `place` in titles-src.json,
  `top-left` or `top-right` (absent or `lower-left` = the standing layout, drawn byte for byte as before:
  tests/cinematic-titles-test.mjs against tests/fixtures/titles-lower-left). Same type sizes, line spacing and safe
  margins: the eyebrow's top 110 px from the top edge (as the supporting line's bottom is from the bottom lower left),
  right placements flush right at 1792; the fitted boxes behind a top title are darker (56% black, for skies and
  windows). Honoured by finish-intro.py, the Director's title overlay and editor (experience/film-titles.mjs,
  title-editor.mjs) and the Director import (build-round8-director.py); a custom shadow shape is relative to the
  placed anchor. The score does not depend on these (it reads awaken's two titles and the logo only):
  build-cine-score.py's input digest is unchanged.
- create: the stool is drawn only until 19.5 s (`show`): from the cut, Lin (people-lin-stand-paint at [-200, -130])
  stands where it was; side and top stills showed her legs through its seat.
- Not changed here: wellness (the frame is full: Kai's bike, Maya, her chair and the desk span the width; a wider or
  turned lens brings the cyclist under the title; the placement option above is for it, Vico picks), oilers (S9
  retimes it).

## Score and EDL (Nov 14, S7)

This cut has its own `edl.json` (real chapter lengths: storage 24.978 s, the film 244.828 s) and its own score in `score/`,
both GENERATED from the cut by `python3 tools/experience/build-cine-score.py exports/cinematic-intro-cut-cine` (about 2
min, CPU). `score/score.wav` is gitignored and must be built on the desk; a render request for this cut is refused while
`--check` fails. How the music follows chapter lengths, cuts and titles: `score/SCORE-GUIDE.md`.

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
| commons (Humboldt) | (story of Nov 13: Yara at the desk as the night runs out, her booking ends, she takes her bag and goes; the desk lowers and drives itself to Mia in her red power wheelchair) his new bird's-eye and swoop, his drive keys from 8.6 s | an overhead of the whole commons craning down (0-2.4 s); **cut at 2.45 s** to a front three-quarter of Yara at the desk, the booking screen to the lens (slow push); **cut at 5.25 s** to a low view from the room that she walks toward with her bag, the desk lowering and turning off the wall behind her; **cut at 8.3 s** to the high wide that dollies in as the desk crosses the cork wall; **cut at 12.45 s** to the front: desk, Mia and the wheelchair whole | the overhead is the time-lapse; the screen tells the hand-over; she stays whole while she leaves; the drive reads across a plain wall; the arrival is a group frame with nobody cut |
| coast (OCC media lab) | a student cut by the right edge for 3 s; a chair silhouette cut in during the lift; the small tilt seen during a fast swing; his ending (from 11.25 s) the desktop with the Orange Coast College mark large | down the aisle to Maya at her bay (no window at the frame edge); **cut at 2.0 s** past her to a close three-quarter: the suite at half the frame height or more as it rises (4.4-7.4 s); **his ending from 11.25 s** with the OCC mark readable, as one slow push (his 2 s hold dropped) | the suite is the subject of the rise; the mark is the chapter's brand moment |
| oilers (high school) | craned off Kai (Kai cut by the frame); passed close behind a seated student; ended on standing Noah with his head cut by the top edge | his low opening on Kai (to 1.15 s); **cut at 1.2 s** to a high frame along the window, the class and Noah at the featured desk; **cut at 4.5 s** to a front three-quarter from the window side: the quiz screens face the lens, Noah whole beside the desk (seated, then standing, head whole), the desk at half the frame or more, rising against the lighter wall | screens that tell the story face the lens; the desk large; Noah whole |
| wellness (gym) | at Maya's height through the lift, so her stretching body covered the desk; the cyclist cut by the left edge; the closing push cut Priya; his closing view from her side read best | his wide from the mirror wall (Kai whole on the bike), a slow push; **cut at 2.5 s** to her side, closer: the column and desktop rise beside her, the stretch-coach screen facing the lens, Priya kept out of the frame edge; a slow push as she works standing | the desk and what it does is the subject, beside the person rather than behind her |
| awareness (product) | fixed high three-quarter for the roll, the dog near the frame edge; side profile at the stop; closing arc | 2 s low over the desk's shoulder from behind, the dog ahead; **cut at 2.0 s** to his three-quarter as it drives at the dog with the warning rings on the floor (a slow drift); **cut at 5.4 s** (the stop) to a floor-level profile at the dog's eye height, the gap a clean dark band; his closing front three-quarter (dog whole) | "it sees what's in its way": its view, the approach with the rings, then the proof |
| music (gaming room) | opened on the back of Kai's head; swung across during the lift and tilt, cutting Kai's head at the left edge | a steep high angle over the room, craning down the whole time: the desk's light playing on the floor, Kai whole on the sofa; **cut at 5.0 s** to a front view that pushes in through the rise and tilt into his symmetric frame and closing push | the LEDs on the floor are the subject and read from above; the cut comes before Kai would slide off the frame |
| media (movie night) | opened behind Omar with his head cut by the top edge; his wheelchair half in at the right edge for 9 s; his frontal push from 9 s with the LED colours mirrored on the desktop is the chapter's best image | front three-quarter from the window side, desk and Omar whole, the film's light on both, slow push; **cut at 9.0 s** to his front view (aimed a touch away from Omar so he stays out of the frame edge), his push to the end | his frontal is the image; the first half solves his Omar crop |
| storage (workshop) | skimmed the desktop at 1.5 s; saw the fold face-on (angle read late); desk filled the frame during the roll | a top-down opening on the desktop and its robots (Andre out of frame through his fade-in) instead of his skim; **cut at 2.5 s** (fold starts) to a side three-quarter from the far side: the 65° fold in profile, Andre whole with his phone; **cut at 8.9 s** on the roll to the outside view along the wall; his tracking and parking keys from 17.3 s | the fold needs profile; Andre is out of frame during his fade-in (1.0-1.5 s); cuts instead of panning him off the edge |
| hero (finale, product) | one continuous slow 48 s arc as six desk versions crossfade (sub-shots A-F) | **his, unchanged** | it already meets the rules: the desk is 0.6-0.8 of the frame height from 0 to 40 s and about half in the end card (40-48 s, room for the title), the camera never holds, and the single unbroken move is what makes six versions read as one desk. Changing it would also mean rewriting the six identical sub-shot cameras in shots/13-subshots.json for no gain |

Shot sizes across the film: macro (awaken, rise), low hero (awaken lift, awareness), profiles and side
three-quarters (awaken tilt, create, oilers, awareness floor level, storage), high angles (awaken turn, commons,
wellness, music, oilers), deep/long lens (create, coast), over-the-shoulder (awareness, media), group (commons end).

## Round 2 (rebase on 9aef44f and the desk's review of 28cc0ad)

- Rebase: review-cut.json restarted from the new "Vico's cut with people" (only wellness changed there: sceneEdits
  and people, one Maya while she stretches) and the cameras re-applied with build-cine-cut.py; titles-src.json and
  shots/13-subshots.json identical to the new source (as JSON); director-camera-oilers.json removed (see above).
- Kept as they were: awaken, rise, create, storage, music's opening, awareness's floor-level gap, commons' ending.
- Reworked so the desk is the subject (the pattern the desk named: people whole but the desk small, dark or
  edge-on): coast (no window at the edge, the suite large as it rises, his OCC-mark ending); oilers (front
  three-quarter from the window side, quiz screens to the lens, Noah whole); wellness (her side, closer, column and
  screen beside her); media (his frontal second half); commons (dolly in during the crossing); awareness (2 s
  opening, then his three-quarter with the rings); music (crane down the whole time, cut at 5.0 s).

## Fixes after the desk's review of chapters 1-3 (round 1)

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
| commons | library x -11.98..43.15, z -13.70..11.29 | wide-and-dolly keys z -2.4..-6.5 at height 3.5-4.6; the back wall (z -13.7) is always ahead of the lens |
| coast | occmedialab x -6.66..14.20, z -7.82..8.32 | all keys inside (x -0.7..0.9, z -3.5..6.8, his ending included), looking -x/+z toward the suite |
| oilers | highschool x -6.16..12.19, z -7.69..7.66 | all keys inside; window-side keys at z 7.15-7.3, inside the window wall (7.66), looking -z away from it |
| wellness | gym x -2.69..5.78, z -3.29..3.29 | opening his (x 5.18, inside); side keys x 1.65-2.1, z -2.05..-1.6 |
| music | gaming x -2.31..4.48, z -3.52..2.84 | high keys (2.9-2.95, z -1.0..-0.55) inside; front key (4.0, z -0.8) inside; then his |
| media | music x -2.31..4.65, z -3.06..3.51 | first shot (1.4-1.6, z 2.7-3.1) inside the +z wall; frontal x 2.3-2.75 (his), looking -x |
| storage | workshop x -2.84..5.73, z -4.11..4.83 | inside keys at z -3.4..-3.7 (the far wall at -4.11); outside keys (x 7.5-7.9, as his are) look about -x/-z and their far frame edge meets the z -4.11 wall at x 5.4-5.7, inside the corner |

Then every re-shot chapter was rendered as a 640x360 clip and checked frame by frame at 2 fps (contact sheets
`/c/work/cine-review/<chapter>/final/check-NN.jpg`, round 2's reworked chapters in `final2/`, outside the repo).
Result: see "Check results".

## Check results

Final 640x360 clips of the eleven re-shot chapters, 2 frames per second, every frame looked at
(`/c/work/cine-review/<chapter>/final/check-NN.jpg`; ten evenly spaced 960x540 stills per chapter in `s10*`):

- Void / back of a cutaway wall: **none seen** in any chapter.
- Round 2 (on 9aef44f): ten evenly spaced 960x540 stills of every re-shot chapter (`<chapter>/final10/`) and 2 fps
  clip sheets of the seven reworked chapters (`<chapter>/final2/check-NN.jpg`): no void, no back of a wall.
- People: whole, or a deliberate foreground. Edge exits while the camera travels were replaced by cuts. Remaining:
  coast, the walking student crosses the left edge at about 7.5-9 s (her walk, not the camera); commons, the
  teammates pass through the lower foreground during the dolly-in (about 8-10 s, briefly cut by the bottom edge);
  music, a sliver of Kai's hand at the bottom-left corner of the front view (5-8 s).
- Readouts: rise's portrait-screen height readout faces the lens through both moves (28.9 to 43.1 up, 38.0 to 28.0
  down); oilers' quiz and class dashboard and wellness's stretch coach face the lens; coast's ending shows the OCC
  mark large; awaken's and awareness's screens face the lens in the beats where they show the status.
- Holds: none longer than about 2 s except a chapter's last beat (oilers holds Kai 0.6-1.15 s; storage keeps his
  0.9 s rest at 19.6-20.5 s and his ending hold from 22.5 s; coast's 2 s hold in his ending was dropped).
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

- commons (Nov 13): Mia now sits in the red power wheelchair (moved under her); the end frame was re-checked with her
  in it (desk, Mia and wheelchair whole).
- People placements are being corrected in the source cut; every framing here was judged on the frozen inputs
  (studio state rev 3424). A moved person may need a key nudged.
- coast: the move from the lift view into his ending (7.4-11.25 s) passes close over the desktop around 9-10 s.
- wellness: Maya's raised hands come close to the top edge during the stretch (about 7 s).
- create keeps his tilt values (motion unchanged): its last tilt in motion is 55°.
- Seven chapters now contain a hard cut; on the score the cuts sit on desk actions (fold start, stop, rise), not on
  beats, which I could not hear here.

## Not checked

- No full-resolution or hq14 render; only 960x540 stills and 640x360 clips at hq13 (blur 1, 15 fps), so motion blur,
  fine flicker and exact title overlap were not judged.
- Titles were not composited over the new frames (the render path used here does not draw them).
- Dissolves between chapters were not previewed end to end (each chapter was rendered alone).
- Director import keeps only 64 camera keys; like his cut with people, these chapters carry more (dense splines).
