# Team rules for the institutional environment sweep

Repo: /home/ergo/ErgoFlex_Custom_Shop (ES modules + Three.js, no build step). Baseline commit d72d1c2.
Read first: docs/institutional-environments.md (incl. "Team structure"), your group's brief in docs/environment-briefs/,
and the reference furnished rooms office-room.mjs, coworking-room.mjs, library-room.mjs (the quality bar).

## Goal
Bring your environment group up to (or beyond) the reference rooms in layout, decoration, lighting across
all five dayparts, textures, materials and fine detail. Every layout must show several ErgoFlex desks in
distinct, believable roles, mixing 48x30 and 60x30 sizes (at least 3 desks per layout, more in bigger tiers/stages).

## Concurrency (another specialist team works on a different group at the same time)
- Own only your group's module file(s). Shared files (institutional-scenes.mjs, institutional-room.mjs kit,
  institutional-detail.mjs, room-life.mjs, room-polish.mjs, room-refinement.mjs, workspace-3d.mjs, studio.js,
  tests/institutional-room-test.cjs, docs) may be touched only with small targeted Edit-tool edits in your
  group's own entries; re-read right before editing; never rewrite whole shared files; never revert or
  "fix" other teams' in-progress changes. If a shared test breaks because of the other group, note it, don't fix it.
- Never run git checkout/reset/stash/clean/commit. The orchestrator commits.
- RAM is tight: at most ONE headless browser at a time, always closed when done (try/finally). Use --only=<your scene ids>.
  Never run the full 12-scene test suite while iterating; run only your scenes.

## Craft
- Use existing helpers, prop library IDs and patterns (canvas textures, batched/merged geometry, instancing).
  Merge small details into one geometry per furnishing, as the existing code does. Keep frame time reasonable.
- Respect the 5-real-light budget per room; use emissive fixtures and additive light pools for extra practicals.
- Keep required furnishing names and scene-asset keys used by tests. New furnishings get stable keys.
- Clearances: >= 900 mm walkways, door path clear, no overlaps (the test checks station/furniture overlap).
- Generic content only: no real logos, real names, or real operational/patient data.
- Bump the ?v= cache-busting strings for modules you change, consistently with how the codebase does it.

## Verify (mandatory before reporting)
- Render your scenes with the review tool (see docs "Team structure") into
  <your session scratchpad>/shots/<group>/<your-role>/ (never inside the repo)
  and LOOK at the PNGs (Read tool) for every layout and every daypart. Compare against the reference-room shots.
  Iterate until it looks right, not just until tests pass.
- Run node tests/institutional-room-test.cjs --only=<your ids> and report results honestly.
- Append a short dated note for your group under docs/institutional-environments.md (your group's section only).

## Report
Concise: what changed (by scene/tier), files touched, screenshots folder, test output, known remaining gaps
for the next specialist.
