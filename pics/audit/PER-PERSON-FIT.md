# Proposal: per-person desk fit (read-only study; nothing in any repo changed)

Read: `C:\work\ergoflex-cine-s4` (cine/s4 @ 04f24e0). Companion: `ELBOW-AUDIT.md`.
An earlier version of this file (another agent, s5 @ a5bb91e) is kept as `PER-PERSON-FIT.prev-s5.md`. Its numbers are
reused below where I checked them.

## Problem
Desk poses put the hands at an absolute keyboard height for the desk setting: `keys_at(in) = 0.678 + (in − 28) × 0.0269 m`
(`tools/people/cast.py`: `sit_type`, `stand_type`, `wheel_type`, `power_type`, `sit_coffee`/`stand_coffee`, the
`DESK_POSES` lambdas, `DESK_HEIGHTS`). Only free poses get the body scale `k` (`build_people.py` line 328); desk poses get
only the height. So every character's hands are at 1.095 m at 43.5 in, and anyone under about 1.85 m reaches up.

**Hands cannot stay on the keys and keep the elbow at 90° at any desk height.** If the keys are above the relaxed elbow,
the forearm points up. Per-person fit has two parts:
- (a) the desk height comes from the person (a fit table);
- (b) the arms are solved from the person's own shoulder, so the posture shown at a nearby height is right and the hands
  meet the keys.

## Runtime IK vs more pre-built poses
**Runtime IK is cheaper, and most of it exists already.**
- `room-people-motion.mjs` has `PersonRig.reach`, a closed-form two-bone IK.
- `solveDesk` already moves desk users' hands with the live keyboard: ±1.4 in `HANDS_FIT`, +2 in `SIT_REACH_UP`,
  −6.5 in `STAND_REACH_DOWN`.
- In a film, everyone in shot is drawn skinned (`room-people.mjs`, about line 1819) and runs `solveStill`. So extra
  `reach` calls cost almost nothing, and there is no extra drawing cost.

What is missing:
1. **Per-character band.** Compute the relaxed elbow (shoulder − upper-arm length) once from the rig offsets
   (`assets/props/people-rigs/*.json`; the method is in `fk_elbow.py`). It replaces the global `HANDS_FIT`, `HEIGHT_FIT`
   and `HEIGHT_SOLID` for choosing and fading postures.
2. **Desk height for static desk extras.** `solveStill` (`room-people-motion.mjs`) pins hands as built and gets no desk
   height. People placed at a desk with `at`, such as Yara and Mia in commons, need the desk's live keyboard passed in.
   This also covers `room-people.mjs` around line 1862.
3. **Limits and warnings.** Allow a little clavicle shrug (about 8°), spine lean (about 6°) and knee bend (about 3 cm).
   Beyond the band the hands leave the keys (`deskWants`), and the Director or `build-cine-cut.py` warns that the desk
   is outside this person's fit.
4. **Determinism.** Closed form only, with inputs (height, tilt, time, seed) as now, so scrubbing stays exact.

Files: `room-people-motion.mjs` (`deskDescription`, `byHeight`, `solveDesk`, `solveStill`), `room-people.mjs` (the
fit/fade rule, `deskFamily`, the still-solve call), and optionally the Director lift-clip UI with `height: 'fit'`.
Rebuild: none. Effort: about 1 to 2 days, including `tests/room-people-test.mjs` and `tests/director-pose-e2e.mjs`.

Risk: medium.
- Every typist frame shifts by a few cm, so the film needs a re-review.
- Director `pose` deltas in existing cuts sit on a new base.
- MPFB skin weights may crease at the shoulder or wrist on large swings.
- Held cups follow the hand.
- Studio people beyond the lively budget (`LIVELY_DEFAULT = 12`) still show the baked posture.

## More pre-built poses (the alternative)
The library holds 78 characters (14 children), 1,546 GLBs (about 1.5 GB) and 390 adult desk models.

**Fixed-height steps.** Covering 35.5 to 52.5 in at ±1.4 in needs about 7 standing heights per posture. That is about
450 more models (+450 MB in git), and a short person at a high desk would still be shown reaching up.
- Build time: `docs/people-and-window-views-20261110.md` gives about 10 min for 495 models, roughly 1.2 s per model.
  450 models is therefore about 9 min, plus `export-rigs.mjs`, `people.json` and `index.json`.

**One fitted pose per character.** A `stand-fit`/`wheel-fit` at that character's own height is better: about 62 standing
plus about 20 wheelchair, so about 85 models, about 2 min. It adds a `FIT` table in `cast.py`, bootstrapped from the
current rigs, and the `-fit` id in `deskFamily` and `crewOf`.
- These ids are additive, so old cuts are unchanged.
- It still needs the reach (pelvis-to-keys) tuning per pose.

Rebuilding the 390 adult desk models once with `k`-relative hands takes about 8 min. Only the hand targets change, but
every typist in every film and Studio room changes.

## Recommendation
1. **Now, no build:** put the fit heights from `ELBOW-AUDIT.md` into the cut using existing postures: Yara at 39 in with
   `people-yara-stand-mid`, Zoe at 39, Omar at 31, Maya at 39 (`stand-mid`). Maya at 41 and Mia's power chair at 30
   would need a build.
2. **Next:** the runtime IK band with a per-character fit table (above). That is the real per-person fit, with no new
   assets.
3. **Later, optional:** one `-fit` posture per character (about 85 models, about 2 min) so the baked fallback matches.
4. **Do not** add more fixed-height steps.
