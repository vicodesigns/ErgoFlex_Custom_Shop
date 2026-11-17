# Brief: one person, one pose per posture (sitting, standing, exercising)

Written 2026-11-16 for the engineer who drafts the plan. Requested by Vico, who will test the result himself.
Deliverable of this task: **a plan first** (section 7), reviewed by Vico, then the build. Vico said the whole thing may
not get built in one go; the data model (section 4) is the part that has to be right, because it is for the long term.

## 1. Why

In the Director's People tab, Vico fine-tunes a person's joints (Pose mode) and keys them over the chapter. Today a
person has **one** fine-tune, so it only works for the one posture the cast entry names. Real case, Rise (chapter 2):

- Maya types at the desk. The desk rises (3.4 s to 7.6 s), she stands and types, the desk lowers (9.45 s) and she sits
  and types again. Vico fixed her *standing* hands (they were off the keyboard after he changed the lift to 39 in).
- He then wanted to raise her *seated* hands at the end of the chapter (playhead 16.6 s). **He cannot: the seated Maya
  has no cast entry, so no pose, no keys, no dots.** Pose mode shows nothing; the Keys panel says "NONE YET".

He wants this solved properly: each person keeps a separate pose (and separate keys) for each posture they take:
**sitting, standing, and exercising**, stored per person.

Then, as a follow-on (not part of this task, but the model must not block it): the exercises already built for the gym
scene should be usable in every scene, so a person stands, does the exercise, and sits down again (or does it seated).

## 2. How it works today (read these first)

- Cast entries live in the cut: `shot.peopleEdits` (Director) -> the chapter's `people` object in `director-film/<chapter>.json`.
  Since S31 (v2) it is the film's `people` object **verbatim** (`experience/people-edits.mjs`, header comment; the Python
  import `tools/experience/build-round8-director.py` does the same). Nothing is whitelisted, so a new field passes through,
  but the v1 path (`cleanPerson`) whitelists fields.
- A cast entry names ONE model (`id`, e.g. `people-maya-stand-type-41`), a desk role (`desk: 'stand'`), and holds ONE
  fine-tune: `pose: { '<bone>': [x,y,z,w] }` (a turn per bone, multiplied on top of the motion's pose) and `poseKeys:
  [{t, pose, ease?}]` (the same over time, `people-pose-keys.mjs`, `people-track.mjs`).
- The model changes with the desk. `RoomPeople.withFamilies` (`room-people.mjs`) builds a character's other desk postures
  from `deskFamily(id)` and marks them `variant`; `asVariant()` and the `withFamilies` push **set `pose: undefined,
  poseKeys: undefined`** on those ("the fine tuned joints belong to the posture the placement names"). A `DeskActor`
  (`room-people-motion.mjs`) holds all of a character's models, solves sit/stand with `solveDesk`, and picks the model
  drawn (`shown`) nearest the desk height. `drawPose()` multiplies the entry's pose (`poseNow(spec)`) onto each bone.
- Two facts that make Maya's case worse than a plain variant:
  1. `deskFamily('people-maya-stand-type-41')` is **empty** (the `-41` suffix does not match the family regex), so her
     standing model has no family at all.
  2. The seated Maya is not in the cast: Rise's `people` has `only: ['people-maya-sit-type']` (the room's own typist is
     shown), cast = `maya-stand` (id `people-maya-stand-type-41`, desk stand, reach 850) and `maya-waits`
     (`people-maya-stand-wait`, free spot, `when` windows). The People tab (`experience/scene-people-editor.mjs`
     `seed()`/`cast()`) lists only `cast`, so room-own people named in `only` can never be selected or edited.
- Pose mode already has a half-answer: `enterPose(key)` in `scene-people-editor.mjs` ("fine tuning is for the posture
  that is showing"): if the desk shows another posture than the entry names, it **rewrites the entry to that posture and
  deletes the pose** ("the fine tuning of their other posture is set aside (Undo brings it back)"). That destroys the
  other posture's edit; it is the thing to replace.
- Exercises: `solveWorkout` and `WORKOUTS` in `room-people-motion.mjs` (`gym-cycle`, `gym-pullup`, `gym-press`,
  `gym-curl`, `gym-box`, `sit-pottery`); models/poses defined in `tools/people/cast.py` (the `gym-*` entries, around
  lines 1406 and 1544); used in the gym room cast (`room-people.mjs`, `gym:` crew). They are a *posture* (a model and a
  solver), exactly like sit and stand.
- A separate, already-fixed cause of "she stopped typing" (not this task): a tilt over 4 degrees took the hands off the
  keys; raised to 9 (`b04e270a`).

## 3. What Vico wants (his words, trimmed)

"I want to have separate poses for each character: sitting, standing, and exercise ... how we store the poses ... that's
something that we can knock out tomorrow, and for now we can at least build out this whole sitting, standing,
exercising per person, how we store the poses." Option chosen by him: *keep one entry per person and store a separate
pose per posture* (not "copy the seated Maya into the cast as an extra").

## 4. Data model to design (the real work)

One person (one cast entry, one `key`) holds **a pose and keys per posture**. Candidate shape, for the engineer to
confirm or replace:

```
{ key: 'maya', id: <the model it is cast as>, desk: 'stand', ...,
  postures: {                                   // per model id (or per posture name: sit | stand | exercise:<id>)
    'people-maya-sit-type':       { pose: {...}, poseKeys: [...] },
    'people-maya-stand-type-41':  { pose: {...}, poseKeys: [...] },
    'people-maya-gym-curl':       { pose: {...}, poseKeys: [...] } } }
```

Decisions the plan must make and justify:
- Key the postures by **model id** (exact, survives nothing renaming) or by **posture name + desk height** (survives a
  model being rebuilt at another height)? Rise has `stand-type-41`, the library also has `stand-type`, `stand-low`,
  `stand-mid`, `sit-type`, `sit-type-30`.
- Legacy: existing cuts carry `pose`/`poseKeys` on the entry. Migration rule: they become the entry's own posture's
  record on first read, losslessly, and old cuts keep rendering identically (no epoch bump caused by the migration).
  Vico's cut `exports/cinematic-intro-cut-vicos-2nd-cut` has real data (Rise: static `pose` on `maya-stand`, six arm bones).
- The room's own people (named in `only`, or the Studio's crew): they must become **editable people** without
  changing how the chapter looks. Either the People tab lists them (with a stable key) and an edit adds a cast entry
  that *replaces* them (remove from `only`), or their postures are stored on the entry of the same character at the
  film desk. Whatever is chosen, the DeskActor's member set (which models can be drawn, and which is nearest at a given
  height) must not change for existing chapters: check Rise at 39 in and 28 in.
- Pose keys per posture and the **timeline**: one "Maya" row in the People lane; the keys shown are the posture on
  show at the playhead, or all postures with a marker. The change of posture at a desk move (sit <-> stand, about 1.5 s)
  needs a defined behaviour for keys that straddle it (blend? hold the last pose?).
- Exercises as postures: an exercise is a posture with a solver and often props (bike, rack, bag). Pose fine-tuning on
  top of `solveWorkout` must compose the same way `drawPose` composes on `solveStill`/`solveDesk`.
- The follow-on (stand -> exercise -> sit in any scene) means a posture change **along the chapter's time**, not only
  with the desk. The entry already has `change` (`room-people.mjs`, `pairUp`, `solveChange`) for a posture change in a
  shot; check how that interacts and keep the per-posture store compatible with it.

## 5. Files to read, and who owns them

`room-people.mjs` (`withFamilies`, `asVariant`, `current`, `keyPoses`, `rig`, `pose`, `cast`, `update`),
`room-people-motion.mjs` (`DeskActor`, `solveDesk`, `solveStill`, `solveWorkout`, `drawPose`),
`experience/people-edits.mjs`, `people-pose-keys.mjs`, `experience/people-track.mjs`,
`experience/scene-pose-editor.mjs`, `experience/scene-people-editor.mjs`, `experience/saved-poses.mjs`,
`tools/people/cast.py`, `tools/experience/build-round8-director.py`, `tools/experience/film-chapters.mjs` (people passes through).
Tests to extend: `tests/people-pose-keys-test.mjs`, `people-track-test.mjs`, `people-sheet-test.mjs`,
`room-people-test.mjs`, `room-people-motion-test.mjs`, `director-people-*-e2e.mjs`.
Ownership during the Nov 15 streams: people-track / scene-pose-editor / scene-people-editor were engineer A's, scene-prop-editor
engineer B's, scene-desk-editor / film-desk-edits S32's. Tell "org" (the merging session) before touching them so merges
do not collide.

## 6. Constraints (from how this project is run)

- **Renders must not change.** Chapter cache keys do not include code. A change that alters rendered pixels needs a
  render-epoch bump (`tools/experience/render-epoch.txt`), and **only Vico decides epoch bumps and render cost.** The
  migration and the editor work must be pixel-identical for existing chapters; prove it (a frame diff on Rise and one
  chapter with people on a gym or classroom cast).
- Frozen for the render PC: `tools/experience/film-fx.mjs`, `film-edits.mjs`, `film-status.mjs`: no new import paths there.
- Do not regenerate `director-film` on Windows for a merge. Never commit Vico's `exports/render-queue/queue.json`,
  `exports/film-cuts.json`, `studio-state.json`. Vico's own copy of the cut ("Vicos 2nd cut", untracked) is his: do not
  edit it; test on a scratch copy.
- The Linux desk (12 GB) cannot run the Director in a browser. Browser/e2e tests and renders run on the Windows render PC
  through the "3dmodeling" session. Pure tests (node) run anywhere.
- Credits are low: small steps, Sonnet-class engineer is fine, no fan-outs, no new stills or renders without Vico's ask.

## 7. What to hand back first (the plan, short)

1. The data model (section 4) with the decisions above made, one worked example for Maya in Rise, and the migration rule.
2. A file-by-file change list and what each test proves; which parts are pure-node testable and which need the Director
   in Chrome (Windows).
3. Milestones that each leave the Director working: M1 data model + migration + render identical; M2 Pose mode and keys
   per posture for sit/stand (the Maya case: select seated Maya at 16.6 s, pose her, keys appear on her row); M3
   exercises as postures in the same store; M4 (next day, separate) a posture change along the chapter's time using the gym
   exercises in other scenes.
4. Risks and what you could not verify.

## 8. Acceptance (Vico tests it)

- Rise: at 16.6 s select the seated Maya, enter Pose mode, raise her hands, key them; scrub to 8 s: her *standing*
  hand fix is still there, untouched. Play the chapter: she types in both postures and the change between them is clean.
- Undo/redo, Export cut, reload and re-import all keep both poses.
- A cut made before the change opens and renders exactly as before.
- Exercise postures can be fine-tuned the same way (even if the in-scene exercise sequences are tomorrow's work).
