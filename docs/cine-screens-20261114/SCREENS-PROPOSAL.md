# Screens proposal, all chapters (stream S6, phase 1: research and proposal only)

Cut: `exports/cinematic-intro-cut-cine/review-cut.json` (the Cinematographer's cut). Notes: `docs/reference/cine-notes-20261114/NOTES.md`
sections 4 and 5, img30-32. Nothing has been built or rendered yet, and the cut has not been changed.

## How the screens work now (what a change has to touch)

- Each monitor in a chapter gets an MP4 from the shot's `screens` list: `{target, src, offset, loop, base, brightness, rate}`.
  `tools/experience/film-fx.mjs` maps chapter time to clip time as `t*rate + offset`. With `loop:false` the clip time
  is clamped to the clip, so a negative offset **freezes frame 0** until the clip time reaches 0.
- Clips are drawn by deterministic canvas scenes: `tools/experience/screens/scenes/chNN.js` plus the toolkit in `lib.js`
  (text, cards, rings, toasts, avatars, procedural `footage()` kinds 0-5, pre-decoded video frames). The manifest is
  `clips.mjs`, and `capture.mjs` renders them. Desk readouts come from `SHOT.clips`, sampled with `CAPTURE_SHOT=<shot.json>`,
  and `CAPTURE_OUT=<dir>` sets where the clips go. It all runs in headless Chrome on the CPU (no GPU). Commons has its own scene and
  renderer beside its cut (`exports/cinematic-intro-20261110-people/screens/04-reservation.js`, `render-04-reservation.mjs`).
- Each scene's `draw(t, opts)` already receives `clipInfo.opts`, which comes from the manifest entry. That makes
  **names and per-chapter variants a parameter** (`opts: {name, initials, ...}`). No scene has to be copied to get them.
- A library phone prop takes a clip as target `phone` (`PROP_SCREENS`). A held phone in a person's hand is not a screen target.
- The MP4s are not in git. hq14/hq12/1102/1110 `screens/` hold only `.stamp` files here, so I could not watch the clips. What is
  written below about "what is on screen" comes from the scene code, `screens/CONTENT.md` and the cut's offsets.

## (a) Every name shown on a screen, and who is at that desk

| Chapter | Where (code / clip) | Shows now | Who is at the desk (cut + room-people.mjs) | Should become |
|---|---|---|---|---|
| rise | `ch02.js` `ch02p` (portrait, `hq14/screens/02-portrait.mp4`): greeting + avatar (img30) | "Good morning, Alex" / "Good afternoon, Alex", avatar "AK" | **Maya** (`people-maya-sit-type` / `-stand-type`, rise `people.only`; `maya-waits` cast) | "Good morning, Maya" / "Good afternoon, Maya" (+ "Good evening, Maya" after 5 PM: the chapter ends at 17:30), avatar "M" |
| rise | `ch02.js` `ch02l` `secMorning` (curved, `02-curved.mp4`, 0-4 s) | "Good morning, Alex" | Maya | "Good morning, Maya" |
| rise | `ch02.js` `ch02l` video call tiles (8-12 s) | "Alex (you)" plus a tile "Maya Chen" | Maya | "Maya (you)". Rename the "Maya Chen" tile to a colleague who does not appear in the film (e.g. "Dana Ortiz" is taken, so use "Rosa Kim"), so Maya is not on her own call twice |
| rise | `ch02.js` `ch02l` toast at 15 s | "Great day, Alex" | Maya | "Great day, Maya" |
| hero | `ch12.js` (`hq12/screens/13-main.mp4`, `homeUntil 1e3`): the whole 48 s on sub-shots gaming, artist, hbhs, occ | "Good evening, Alex" | nobody (product finale, six desk versions A-F) | per version, from its chapter: A gaming "Kai", B artist "Lin", D hbhs "Kai", E occ (the coast person, see below). C office already shows the analyst screens (13-fin), and F architect has no screen. Fallback: "Good evening" with no name |
| commons | `04-reservation.js` | Yara, then "Up next · Mia", "Welcome, Mia", table "Mia, Kai, Sofia" | Yara (`yara-works`/`yara-leaves`), then **Mia** (`mia-waits`/`mia-works`). Teammates: `mate-left` Kai, `mate-right` Sofia | **already correct**. Keep it |
| commons (old, not in the cut) | `ch04.js` whiteboard cursors | Maya, Jordan, Sam, "Priya is typing" | n/a | not used by the cut (it uses 04-reservation). No change |
| coast | `ch05.js` wall reel credits / NLE | Dana Ortiz, Marcus Bell, Ivy Tran, Leo Martins, Sofia Reyes (student credits) | Maya at the centre bay `film-edit-01` (cast `bay-1`). The featured suite: see "could not determine" | credits can stay (they are other students' work). Add the suite user's name to the suite (see coast) |
| music | `ch09.js` TV chat handles | pixelpanda, nova_kai, ... | **Kai** on the sofa (`people-kai-sit-controller`) | not a greeting. Optional: the streamer card reads "kai_plays · LIVE" |
| awaken, create, oilers, wellness, awareness, media, storage | ch01/ch01w, ch03, ch06, ch07, ch08, movie clip, none | no person's name anywhere | awaken: nobody · create: **Lin** · oilers: **Kai** at the featured desk (lowers to his wheelchair, 8-11 s), Fern at the project-review desk, Noah presenting, teacher Hale · wellness: **Maya** (Priya stretching, Kai on the bike) · awareness: the dog · media: **Omar** · storage: **Andre** (phone), Jo at the bench | nothing to fix. The per-chapter proposals below add the person's name where it helps the story |

"Good night, Alex" (Vico's words) does not exist in the code. He probably remembered the hero's "Good evening, Alex".

**Build:** add `opts.name` / `opts.initials` to ch02 (`ch02p`, `ch02l`) and ch12, set them in `clips.mjs` (`02-*` Maya; `13-main` one clip
per hero version, or `opts.names` keyed by sub-shot window), and re-capture with `CAPTURE_SHOT` = the cut's rise/hero shot and `CAPTURE_OUT`
= a new folder (e.g. `exports/cinematic-intro-cut-cine/screens/`). Hero: give gaming/artist/hbhs/occ in `shots/13-subshots.json` each its own
`13-home-<name>.mp4` (the same 48 s, a different name).

## Problems found in the current screens (timing)

- **create:** both clips have `offset -4.7, loop:false`. Frame 0 is held for the first 4.7 s: a **white canvas** and a **black
  reference board**, because the references fade in at clip time 0.2-1.9 (that is img31/32). The painting then runs at
  chapter 5.7-21.9 s, straight through the drafting and the painting. The toasts are hard-coded "Drafting · 25°" (now at 9.0 s, while the
  desk goes to 40°) and "Creative angle" (now 17.2 s). The surface pill was sampled from the 11/02 motion, not the cut's (7°, 40°, 55°).
- **coast:** the four 05 clips are 13 s long and have no `loop:false` (so they loop by default). They **wrap at 13.0 s** of a 14.5 s chapter, during the
  ending push on the OCC mark: the review footage jumps back and the export % falls back to 38 %. The scenes say "no desk motion", but the
  suite rises at 4.4-7.4 and tilts at 9.65-11.25.
- **oilers:** the clips were made for the 11 s chapter with no desk motion (`offset -2`, so frame 0 is held for 0-2 s). The desk lowering to
  Kai at 8-11 s does not show on any screen. The quiz reveal falls at 8.6 s and the dashboard comes at 10.2 s.
- **awareness:** `08-main` has `offset +1.3`. The radar's roll (clip 7-9.8 s) plays at chapter 5.7-8.5 s, but the desk rolls at 2.7-5.4 s
  and stops at 5.4 s. The radar is about 3 s late and says "Stopped safely" after the cut has already shown the stop.
- **wellness:** `07-main` (`offset -3`) lines up: the countdown runs to 6 s and "Desk rising" plays during the 6-11 s lift. From 11 s it shows a desk-squats
  demo while Maya works standing (the camera label says "Working standing").
- **storage:** no film screens at all (`screens: null`). The desk's monitors, if any are in frame, show the app's built-in workshop theme.
  Andre's phone is part of his rig.

## (b) Per-chapter proposals

Principle: each chapter's screens show the one thing that chapter's story is about, name the person it is for, and change
**on that chapter's own beats** (from the cut's motion clips, people windows and camera cuts). Each chapter gets its own colour and app identity, so
no two chapters share the same dark blue ErgoFlex dashboard look. Every clip gets `loop:false` and is exactly chapter seconds + 1 s long, with no held frame 0.

### 1. awaken (44.85 s, product void, nobody)
**Now:** `hq14/01-main.mp4` (ch01, the digital-twin control screen: twin card, position map, height graph, activity log, end wordmark at the
end). Blue ErgoFlex dashboard. The same visual language as rise, hero and storage.
**Proposal:** keep the digital twin. It is the film's introduction of "the app mirrors the desk", and it is the only chapter without a person. To make it
its own: "Studio Desk 60×30 · first start" in the header, a short **setup checklist** (wheels ✓ 2.0-4.6, lift ✓ 9.25-16.15, tilt ✓ 18.65-24.6, turn ✓
25.55-32.25, level ✓ 31.55-35.7, lower ✓ 33.8-38.35) in place of the generic log, so the opener reads "every axis, tested". Keep the boot black until the lights come on (7.45 s).
**Changes over time:** each line checks off as its move ends. "All systems ready" lands at ~38.4 s, then the wordmark.
**Build:** ch01.js copy edits plus a re-capture from the cut's awaken shot (`TWIN=` as before). No new screen type.

### 2. rise (18 s, home, Maya, 08:00 → 17:30)
**Now:** curved `02-curved` (the workday: plan 0-4, calendar 4-8, call 8-12, focus 12-17, "Great day, Alex"), portrait `02-portrait`
(the wellness height app, img30), phone `02-phone` (charge 100 %, lock screen with Daily notes). All three are synced to the lifts (3.4-7.6 up to 43.5, 9.45-12.65 down to 28).
**Proposal:** fix the names (table above). Make the curved screen **Maya's** day: her name, her calendar ("Stand-up" lands as the desk rises at 3.4 s,
"Deep work" as it lowers at 9.45 s), and the call tile "Maya (you)" shown standing, because she is. The portrait screen stays the hero readout (it is the
chapter's proof). Its line changes from the generic "Time to stand" to "Maya, 52 min seated, time to stand" at ~3.0 s, and "Back to focus" at 9.45 s.
At the end, the evening summary **"Great day, Maya · 3 h 10 m standing · 4 stand breaks"** is the frame the camera pushes into (the 18 s key is
"in toward the screens and the summary of the day"), so it should be on screen from ~15.5 s.
**Build:** ch02.js `opts.name`, text and timing. Re-capture with the cut's rise shot.

### 3. create (23.5 s, artist studio, Lin): see (c) for the full plan
**Now:** right/landscape `1102/03-landscape` (a painting app that paints "Lakeside dusk" stroke by stroke), left/portrait `1030/03-portrait` (reference board +
palette). Both are offset -4.7 (frozen white/black for 4.7 s), and the painting runs 5.7-21.9 s across all three parts.
**Proposal (summary):** three acts that match the desk's three uses. **Digital painting** from frame 0 to just before the architecture part, already in progress at
the 2.4 s cut. **Architecture**: left screen the floor plan, right screen a floating, turning 3D house of that plan. **Oil painting**:
natural landscapes on both screens as the oil painter's references. The file/project bar reads "Lin" in all three acts.

### 4. commons (16 s, library, Yara → Mia)
**Now:** `04-reservation` (Vico's favourite). Yara's booking clock races 5:40 → 8:00, "Time's up. Thanks, Yara!", "Up next · Mia", then "Mia's
turn", the height going to her preset of 32 in, a drive bar to table 4, "Welcome, Mia".
**Proposal:** keep it. It is the model for every other chapter. Small changes so it reads in the cut's shots: (1) in the 2.45-5.2 s front three-quarter
the screen is to the lens, so make "Booked until 8:00 AM" and the countdown the biggest elements (the analog clock is secondary). (2) At 5.25-8.3 s Yara walks
away and the desk lowers behind her: put "Thanks, Yara · see you tomorrow" over the handover. (3) From 12.45 s ("docks at Mia"), add Mia's
saved workspace opening ("Group project · Commons" notes with Kai's and Sofia's cursors, i.e. the old ch04 whiteboard, re-cast) after "Welcome, Mia", so
the last frame shows the team working, not a status screen. (4) Check the timing against the cut: the lift is at 6.2-8.2 and the drive at 7.2-13.4, the same as the scene constants.
**Build:** edit `04-reservation.js` (it can draw `SCENES.ch04` with new names/cursors inside a card). No new type.

### 5. coast (14.5 s, OCC media lab)
**Now:** featured suite `05-main` (review playback, "REVIEW", timeline), the film-edit-01 curved screen `05-curved` (NLE) and portrait `05-portrait` (colour + export
"COAST_final_4K.mp4"), wall `05-wall` (Portfolio Review reel). The 13 s clips wrap at 13.0 s. Nothing reacts to the suite rising or tilting.
**Proposal:** the story is "your own edit suite inside a shared lab". (1) The centre bay (Maya, 0-2 s): her NLE as now, with "Maya · COAST rough cut" in the
title bar. (2) The featured suite (2.0 s on, "the free suite"): it **wakes as a booking/sign-in** ("Suite 3 · free", then "<name> signed in" with the
student's project and bins appearing), then switches to her edit. During the 4.4-7.4 s rise the suite shows "Raising to your standing height
· 38 in" with the live number (the same pattern as rise and commons). At the 9.65-11.25 s tilt, "Board tilted 5° · colour mode", and the screen changes to the colour
grade. (3) The 11.25-14.5 s ending, on the OCC mark: the export finishes "COAST_final_4K.mp4 · 100 % · sent to Portfolio Review", and the wall
reel shows that same film as its first title. That makes the room one story: edited here, screened there.
**Build:** extend ch05.js (a sign-in card, a height overlay from `pose()`, export → wall hand-off), add `loop:false` and length 15.5 s, and re-capture with the cut's
coast shot. The person at the suite has to be decided first (see below and note 6b, where this shot is being reworked).

### 6. oilers (14 s, high school, Kai at the featured desk, 10:05-10:20)
**Now:** curved `06-curved` (orbit simulation, Sun-mass slider), portrait `06-portrait` (live quiz "Which planet orbits fastest?", then the class
dashboard), laptop `06-laptop` (A-D answer pad, +100). Vico likes it. Clips are offset -2, and the 8-11 s lower to Kai is not reflected.
**Proposal:** keep the lesson. Make it Kai's desk and Kai's moment. (1) The laptop answer pad header "Kai · Period 2 · Physics". He taps A at about
clip 3 s (chapter 5 s). (2) The quiz reveal is moved so it lands **after** the desk is at his height: the desk starts down at 8.0 s with a portrait overlay "Lowering to Kai's
height · 31 in" (live number), and at 11.0 s "Mercury ✓, Kai +100" with his tile lighting in the class grid. The grid gets real first
names from the room's class (Fern, Noah, Zoe, Mia, Leo, Eli, Sofia, ...), with Kai highlighted. (3) The curved orbit sim gets the teacher's cursor labelled "Ms./Mr.
Hale". (4) Fern's project-review desk (`station-project-review`, cast `fern`) has its own monitor if it is in frame. Show her set/costume design
board ("Fern · APA set design") so the class desks don't blend with the featured desk.
**Build:** ch06.js retime from `SHOT.clips` (the lift at 8-11 s), a names list, an overlay. `clips.mjs` 06-* length 15 s, offset 0. No new type.

### 7. wellness (16 s, gym, Maya)
**Now:** main `07-main` (coach with demo clips: countdown, "Desk rising to standing" 6-11 s with live height, then desk squats + rep counter +
heart rate), tablet `07-tablet` (box breathing, HR calming). Synced to the lift.
**Proposal:** the story is "a break built into Maya's day", and she stretches 6.6-10.35 s while the desk rises. (1) The main screen opens on Maya's work
("Maya · Q4 report, 52 min") with the nudge "Time to move, Maya" at ~3 s and the 3-2-1. (2) During 6-11 s: the stretch she is doing
(the shoulder-squeeze demo clip, which already exists) beside the live height ring, so the screen shows what she does. (3) From 11 s, when she works standing: back to
her report with a small "Reset done · +4 min standing · next break 45 min" card. Drop the squat set (nobody does squats in the shot). Tablet: the breathing
coach during her stretch, then "HR 92 → 74 · nice reset, Maya".
**Build:** ch07.js re-sequenced, using the existing demo-clip frames. No new type.

### 8. awareness (12 s, product, the dog)
**Now:** `08-main` proximity radar with blips "Chair, Wall, Planter, Bag". About 3 s late against the cut (see above).
**Proposal:** sync it to the cut's roll (2.7-5.4 s) and stop (5.4 s), and make the obstacle **the dog**: one blip labelled "Pet · 16″" that the
beam picks up at about 3.5 s, "Slowing", then "Stopped · pet ahead" at 5.4 s, held through the 9.4 s floor-level gap. Remove the generic chair/wall/bag
blips (or keep them faint as the room). Teal/amber, not the blue dashboard. Check whether the monitor is in frame in this cut. If it is not, this is a
low-priority chapter.
**Build:** ch08.js reading `clipsOf('wheels')` instead of constants, plus a label change. No new type.

### 9. music (12.5 s, gaming room, Kai)
**Now:** main game montage, arcade "Orbit Runner", marquee, macro keys, TV stream dashboard with chat. All beat-synced to the score. This is the most
distinct chapter already.
**Proposal:** small changes only: the TV's stream card reads "kai_plays · LIVE", and a chat burst "desk lights synced 🔥" lands on the 6.3 s rise/tilt.
Re-run the audio analysis after the S-music rework (note 3) changes the score.
**Build:** ch09.js text, plus a re-capture after the score is final.

### 10. media (17 s, movie night, Omar)
**Now:** the ultrawide plays `app-reference/assets/desk_viewer/media/ambient-clip.mp4` at offset 40. The LEDs sample it.
**Proposal:** keep the film. It is the chapter's image, and the 9 s frontal depends on it. Optional: a 1.5 s "Movie mode · lights follow the film" pill at
0-1.5 s, drawn over the clip (a compositing scene that plays the clip's frames like `09-tv` does with the montage). No name needed.
**Build:** optional new scene `ch10` (video-frame passthrough + overlay), with the `ledSource` still the clip.

### 11. storage (24.98 s, workshop, Andre)
**Now:** no film screens. Andre taps "the one button" on his phone (the insert at 8.95-11.45 s, "the button lights" at 11.14 s, from the rig).
**Proposal:** this is the chapter where a screen tells the story best, and right now none does. (1) **Andre's phone** in the 8.95 s insert: "Storage
mode" with one big button, pressed at 11.14 s, then "Folding · 65°", "Rolling to the wall", "Parked" (ch11.js already draws this exact
sequence for a monitor). (2) If the desk's monitor is in frame (a camera check is needed), the existing `11-main` storage clip, re-timed to the cut (fold
11.25-21.25, roll 12.25-22.15), dimming to "Floor is yours" after the park.
**Build:** needs **a new screen target**: a phone in a person's hand. Option A: film-fx attaches a glass plane to the rig's phone mesh (like `PROP_SCREENS`
does for the library phone). Option B: the phone is not a rig mesh, so add `ergoflex-phone` as an accessory parented to his hand. A portrait variant of ch11 (`11-phone`,
720×1516 like `02-phone`). This needs the harness owner's agreement.

### 12. hero (48 s, finale, six desk versions)
**Now:** gaming/artist/hbhs/occ show `13-main` ("Good evening, Alex", 4 tiles), office shows the financial analyst wide + portrait, hbhs also shows the 06 quiz
portrait, architect has no screen.
**Proposal:** the finale says "one desk, every part of your day", so each version's screen should echo **its own chapter and person**: A gaming (0-5.3):
"Good evening, Kai" + the game montage tile. B artist (4.7-13.1): "Lin" + the finished Lakeside dusk. C office: unchanged (analyst). D hbhs: "Kai" +
the quiz result. E occ: the COAST export / reel still. F architect (33.2-48): the floating house from create (re-use the new scene) if the version has a
monitor. Otherwise nothing. Keep the screens quiet (≈60 % brightness) from 40 s for the end card.
**Build:** one `ch12` home with `opts.name` + `opts.tile` per version (one clip per sub-shot). These are existing types plus the create house scene.

## (c) create: the new content in detail (waiting for S3's three time ranges)

S3 will give three ranges: **R1** digital painting (shot open → just before the architecture), **R2** architecture, **R3** oil painting. Until then, the
provisional values from the cut are: R1 = 0-6.8 s (the lift ends at 6.8; the drafting kit fades in 7.0-7.4), R2 = 6.8-16.9 s (drafting tilt to 40° 6.8-12.4,
kit visible to 16.9 and fading by 18.7), R3 = 16.9-23.5 s (easel tilt to 55° 16.9-19.5, easel fades in 17.5-19.3). The scene takes R1/R2/R3 as
`opts` so S3's numbers drop straight in. Clips: `offset 0, loop:false`, length 24.5 s. Lin's name is on both screens in all acts.

**R1, digital painting (right = landscape `main-landscape` 1920×1120; left = portrait `main-portrait` 1080×1856).**
Right: the existing "Lakeside dusk" stroke timelapse, **re-paced to R1**. At t = 0 the sky and sun are already laid in (≈25 % of strokes, so
the first visible frame after the 2.4 s cut is a painting in progress and not a white canvas). The remaining strokes are spread across R1 so the last
highlight lands ≈0.4 s before R1 ends, followed by a 0.3 s "Saved · Lakeside dusk.psd · Lin" toast. The "Surface" pill reads the cut's own tilt (7° at 1.5-3.4).
Left: the reference board already populated at t = 0 (no fade-in from black), with the eyedropper hopping in time with the strokes' colours.

**R2, architecture.** Both screens about one house, crossfading over 0.4 s at R2's start.
- Left (portrait): **the floor plan**, i.e. the same plan as the paper on the drafting board (`workspace-3d.mjs` drafting-kit sheet: a 1040×540
  outline, five rooms, a door arc, "A-101 · 1:100"), drawn as a CAD plan app ("Lin · House A · Level 1") on blueprint navy. A highlight follows the room the
  3D model is currently turning toward. Dimension lines draw in during the 40° drafting tilt (6.8-12.4).
- Right (landscape): **a floating, turning 3D house** extruded from that plan: floor slab, walls (2.7 m, door and window openings), gable roofs that
  hover a little above the walls (an "exploded" roof, so the rooms read), room labels on the floors, a soft shadow ellipse below. It floats (a ±10 px
  slow bob) and turns about ¾ to one full revolution over R2. A section plane sweeps through once at ~R2+60 % to show the rooms, matching the left
  screen's highlight. Viewer chrome: "Model · House A", orbit/section/plan tool icons, "Synced with A-101".
- **Plan vs "a home":** the paper today says "WORKSPACE STUDY / FLOOR PLAN" with STUDIO, LIBRARY, MEETING/PROJECT SPACE, ENTRY, SERVICES. Vico
  asked for a home. Option 1 (no app change): model exactly that plan as a small house and keep the labels. Option 2 (recommended): relabel to a home
  (LIVING, KITCHEN, BEDROOM, ENTRY, BATH; "HOUSE A · FLOOR PLAN"). That needs a film-only way to replace the sheet's texture. The harness has no
  map-from-file sceneEdit today. Either add one small sceneEdits op (`mapSrc` on `^Architect floor plan$`) or a screen alias for that mesh (screens accept PNGs). Option 2 makes
  the paper, the left screen and the 3D model one plan.
- **How the 3D is drawn:** new `lib.js` helper `mesh3d(faces, rot, cam)`: rotation + perspective projection, back-face cull, depth-sorted
  flat-shaded polygons with one key light and edge lines (a few hundred faces). It stays deterministic, CPU-only, in the same capture pipeline. (Alternative:
  render the house in three.js and pre-decode frames like the TWIN card. Heavier, and not needed for this look.)

**R3, oil painting.** Both screens become **natural landscapes**, the painter's references, matching the easel painting (`assets/artwork/artist-painting.jpg`:
sunlit reeds and grasses at a meadow's edge, a strip of blue sky).
- Right: a large reference "Meadow edge · late afternoon": painterly procedural landscape (new `footage()` kinds: meadow with reeds in the foreground and
  a sunlit field, rolling green hills under blue sky), with a slow Ken Burns push. A small swatch row is sampled from it.
- Left (portrait): a second, vertical landscape (a creek through grasses, or a hillside oak at golden hour) with "Lin · references · 2 pins".
- Crossfade from R2 at R3's start. Keep brightness modest so the screens don't compete with the easel and (per note 5) the painter on the stool at the end.
- The room vistas (`assets/rooms/vistas/*.jpg`) are photographs with buildings in them, so they are not natural landscapes. They are not used.

**New things the build needs (create):** `mesh3d` helper + house model data (from the plan rects); a CAD-plan drawing; two new landscape `footage` kinds;
a `ch03` rewrite as a three-act scene with `opts.R1/R2/R3`; `clips.mjs` entries `03-landscape-cine`, `03-portrait-cine` (24.5 s); the cut's create
`screens` changed to the new clips with `offset 0, loop:false`; optional: the floor-plan texture swap (option 2).

## New screen types / harness work, all chapters

1. `opts.name` / `opts.initials` in ch02 and ch12 (and the other person-facing scenes). This is a parameter, not a new type.
2. `mesh3d` (lib.js) + house scene (create R2, hero F).
3. Landscape footage kinds (create R3).
4. Phone-in-hand screen target (storage). This is a harness change (film-fx / rig).
5. Optional: a floor-plan texture swap (create, option 2). Optional: a video-passthrough + overlay scene (media).
6. Re-capture every changed clip with `CAPTURE_SHOT` = the cut's shot for that chapter. Clips go to a new `exports/cinematic-intro-cut-cine/screens/`, and only
   then are the cut's `screens` entries pointed at them (`offset 0`, `loop:false`, length = chapter + 1 s).

## Could not determine

- **Who uses the featured suite in coast.** The cut casts only Maya at `film-edit-01` (the centre bay). The camera label calls the featured suite "the free suite".
  `room-people.mjs` puts `people-ava-stand-low` at the featured desk in the morning, and the cut does not exclude her, so she is probably the
  "standing student who appears for one second" in img39. Note 6b is reworking this shot. The name follows that decision.
- The actual pixels of the clips in use (hq14 01/02, 1102 03, 1110 04, hq12 13). The MP4s are not in this checkout, so I read the scene code. That the
  hq14 01-main is the TWIN variant (not `01-wellness`) is inferred from `build-round8-twin.py` and the opener script.
- Whether the awareness, storage, Fern's desk and hero-architect monitors are in frame in this cut (needs `render-cut --list-screens` and stills, GPU, phase 2).
- S3's three time ranges for create (provisional values above).
- Which plan Vico wants for the house: the existing "workspace study" sheet or a relabelled home (option 1 or 2).
