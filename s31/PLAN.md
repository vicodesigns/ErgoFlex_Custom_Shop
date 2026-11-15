# S31: pro-style actor editor in the Director (plan and estimate)

Branch cine/s31 (from cine/integration-4b 33840c9b). Worktree C:\work\ergoflex-cine-s31.

## Estimate
- Stage A (safe round trip + People track + moving people / walk and roll paths): about 10-12 hours of work.
- Stage B (pose keys on the timeline, auto-key, slerp, copy/paste/retime/ease, film parity test, undo): about 8-10 hours after A.

## What I found (33840c9b)
- The cine cut's Director pages / director-film/*.json are Nov 13 copies; `film-cuts.py pages` regenerates them
  from review-cut.json (build-round8-director.py --pages -> director-bridge.py link).
- Director people edits (people-edits.mjs cleanPerson, build-round8-director.py clean_people) keep only
  key/id/desk/station/reach/at/turn/y/beside/scale/colors/pose/look; the People tab seeds its copy from the live
  stage's resolved() list. Any people edit therefore drops walk, roll, act, on, seat, depth, change, fromDesk, the
  film's only/except/place, and the room's own people become fixed spots. apply_people writes {only: [], cast}.
- The import pass re-bakes the camera from the (rounded) key times on every import, and rewrites seconds/motion.
- build-cine-cut.py / build-oilers-story.py / build-screens.py rewrite their chapters with no knowledge of Director edits.

## Stage A plan
1. Regenerate the cine cut's pages + director-film from the current review-cut.json (all 12 chapters); a test fails
   when a director-film shot differs from its review-cut.json chapter (stale pages).
2. Lossless people: peopleEdits v2 = the film's whole `people` object (only/except/place/chair/fade/when + every
   cast field verbatim: walk, roll, act, on, seat, depth, change, fromDesk, look, when, pose, colours...). Seeded
   from film.people, not from the stage. JS and Python cleaners keep every field. Old v1 edits keep their meaning.
3. Import pass changes nothing it was not asked to: camera keys that equal the plan's (by id, within rounding) keep
   the plan's exact keys and the existing bake (no re-bake, no thinning); motion/seconds untouched when equal.
   Test: open-then-export of every chapter with no edit -> review-cut.json byte-identical.
4. `directorEdited` marker: the import pass stamps a chapter it really changed
   (shot.directorEdited = {at, fields}); build-cine-cut.py / build-oilers-story.py / build-screens.py refuse to
   overwrite a marked chapter unless run with --over-director (README section).
5. People track (dope sheet): a row per person with diamonds for: in / out, posture change, walk / roll start,
   each waypoint, arrival, each act (screen pull, tap). Click: playhead + select. Drag: retime (links documented).
6. Paths on the floor: walk and roll drawn with a handle per waypoint; drag a handle, click a segment to add a
   point, Delete removes one; inspector fields: start, pace / speed, corner radius, end facing. Undo for each step.

## Stage B plan
Pose keys per person: poseKeys [{t, pose, ease}] in the cast entry; auto-key toggle, key all / key this limb;
slerp between keys on top of the programmed motion (desk arms, walk, roll, acts) in room-people.mjs (live, Render
still, film); copy / paste / delete / drag / ease per key; undo; film-path parity test.
