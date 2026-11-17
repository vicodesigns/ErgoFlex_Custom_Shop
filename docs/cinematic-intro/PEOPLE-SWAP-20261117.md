# Swapping a person in a scene, keeping the animation (audit, Nov 17 2026)

Vico wants to swap anyone in any scene for someone else and keep the animation (path, walk, posture timing, pose
edits), then re-render. This is what works today, what is tied to one character, and the smallest change that would
make the animation travel with the slot. Measured on the storage chapter's Andre (branch cine/andre-walk), with the
production people code headless (room-people.mjs, room-people-motion.mjs) and the GLBs skinned on the CPU.

## What travels with the cast entry today

A film cast entry is `{ key, id, at, turn, walk, roll, change, act, look, colors, postures }` plus the chapter's
`when[key]`. Everything that is animation sits on the entry and is keyed by `key`, not by the model:

- `walk.path`, `walk.start`, `walk.pace`, `walk.step` (absolute mm), `walk.toes`, `walk.swing`, `walk.turn`;
- `when` windows (posture timing) and `change` (`seconds`, `arms`, `turn`, `step`, `hands`, `swap`);
- `look`, `act`.

The motion is solved from the rig of whatever model the entry names (`PersonRig` per character from
`assets/props/people-rigs/<who>.json`): footprints, hip height, knee bend and arm swing are recomputed for that rig.

Evidence (scratch measurement, every cast id `people-andre-*` replaced by `people-<who>-*`, the storage walk as now
committed): Ben, Noah, Raj (shortest man, leg 0.81 m) and Cole (leg 0.90 m) walk the same path in the same seconds
(4.2-5.0 turn, 5.0-7.67 walk, 6 steps), shins never closer than 114-118 mm, ankles never crossed, planted feet slide
0-3 mm in the walk, legs 164+ mm from the desk and props. The old route (before this branch) crossed Ben's legs exactly
as it did Andre's (shins 22 mm, ankles crossed by 202 mm): the clipping was the route and the solver, not the rig.
`tests/room-people-motion-test.mjs` (swing: 'path' block) checks Ben and Noah on Andre's route.

## What is tied to a character

1. **Story postures exist only for Andre.** Storage uses 9 posture models; 7 of them (`stand-robot-work`, `-lift`,
   `-shelf`, `stand-phone-pull`, `-up`, `-press`, `-watch`) are built only for Andre. `walk` and `stand-wait` exist
   for all 64 adult characters. In the swap test the other man was simply absent before 2.9 s and after 7.7 s (the
   placements whose model does not exist are not drawn). They can be built for anyone: `tools/people/cast.py` defines
   them by pose name with hand targets in the standing person's frame (`ROBOT_DESK`, `ROBOT_LIFT`, `ROBOT_SHELF`), and
   the Director's People editor asks the studio server to build a missing one (`/__people/build`, Blender). Not tried
   for another character: the arm IK of a shorter rig may not reach the shelf target (Raj is 90 mm shorter in the leg).
2. **A change of posture needs one character on both sides.** `RoomPeople.pairUp` pairs two placements only when
   `character(a) === character(b)`. The People editor's `swap()` (experience/scene-people-editor.mjs) rewrites one
   entry's `id`; swapping one entry of a chain (robot -> lift -> shelf -> lets-go -> walk -> phone) leaves the
   neighbours as Andre: those changes fall back to a dissolve (two people at once) or a cut. Measured: with only the
   walker's entry swapped to Ben, at 4.2 s Andre standing at 100, 1810 facing 194 deg is replaced in one frame by Ben
   at 60, 1935 facing -58 deg; the 1.6 s stepping turn between them is lost.
3. **`walk.then` is a model id** (`people-andre-stand-phone-pull`). `swap()` does not rewrite it. On another rig
   `rig.key(then)` is null, so the walk ends in the walker's own standing posture (no crash), and `walkEnd` still finds
   the end turn only while the `then` entry keeps Andre's id.
4. **Pose corrections are keyed by exact model id** (`postures['people-andre-…']`, people-postures.mjs). They are
   archived, not carried over, on a swap; and bone turns tuned for one rig would not fit another anyway.
5. **Screens bind to the character name**: storage's phone video is `screens: [{ person: 'andre', … }]`
   (tools/experience/film-texture-screens.mjs matches `people-<person>-`). Swapped, the phone shows nothing.
6. **Step length is absolute.** `walk.step: 425` (mm) suits any adult man (0.47-0.53 of the leg); a child or a much
   shorter adult would overstride. Without `step` walkPlan uses 0.64 x leg, which travels with the rig.
7. **Code keyed by name**: none by character in the motion code (life, gaze, intent and on-feet sets are keyed by pose
   name: `stand-robot-work`, `stand-phone-watch`); `tools/experience/build-alt-cut.py` hard-codes `ANDRE_DESK` for the
   older cuts; `cast.py` builds the story postures under `people-andre-*` ids only.

## Smallest safe change (proposal, not implemented)

Not implemented here: it lives in the People editor (engineer A's files, scene-people-editor.mjs / people-edits.mjs)
and needs the studio server's builds; the walk fix itself did not need it.

1. **Swap a character, not an entry** (scene-people-editor.mjs `swap()` with a new "everyone in this chapter" scope):
   for every cast entry of the old character in the chapter, rewrite `id` to the same pose for the new character
   (`modelFor(c, pose, deskHeight)`, building what is missing with the existing `build()`), rewrite `walk.then` the same
   way, rewrite `screens[].person`, and keep `key`, `at`, `turn`, `walk`, `roll`, `change`, `when`, `look`, `act`.
   One undo step. Risk: low; the solver already re-plans per rig. Test: people-sheet / people-edits unit test that a
   chapter swap keeps every animation field and pairs (`pairUp`) the same keys.
2. **`walk.then` resolved by pose** (room-people.mjs `walkAlong` / `walkEnd`): when `then` names another character's
   model, use the walker's own character's model of that pose. Two lines; keeps old cuts working if someone swaps only
   the walker. Risk: low.
3. **Step relative to the leg** (optional): `walk.stride: 0.47` (of the leg) as an alternative to `walk.step` in mm,
   so a slot's walk keeps its rhythm for a child. Risk: changes nothing unless used.
4. **Pose corrections**: on a chapter swap, copy `postures[oldId]` to `postures[newId]` only when the user asks
   (bone turns are rig-relative; usually better re-done in pose mode). Default: archive, as now.
5. **Story postures for a new character**: `python3 tools/people/build.py people-<who>-stand-robot-work …` (Blender,
   `--jobs 1` on the desk), then check the hands on the robot and the shelf with a still: cast.py's targets are in the
   standing frame, so the robot stays where it is in the room, but a shorter reach may need the person 20-40 mm closer.

Risks shared by all: a re-render of the chapter (pixels change), the phone insert framing (8.95-11.4 s) is built round
Andre's hand height, and the workshop toy story's robot hand-over (`swap: 0.06` on lets-go, 2.554 s) assumes the hands
reach the same spot.
