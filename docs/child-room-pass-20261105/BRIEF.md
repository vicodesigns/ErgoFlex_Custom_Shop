# Growing child room: "lived-in" pass (2026-11-05), shared brief

Owner: Vico. Orchestrator: Polish. The room is a bedroom that grows with its owner, with five life
stages: early years (toddler to ~5), elementary, preteen, high school, college. Stages x room sizes
(compact / house / larger) x five activities (morning, afternoon, reading, shared time, bedtime). It
is used for promo videos and the product demo. Vico: "They are at a good place, but they can be pushed:
the decorations, the walls, the lighting, more of a lived-in experience. It should look awesome."
Goal: every age reads as a DIFFERENT, specific kid's room that a real person has been living in for
a year. Not a showroom. Evidence of use, personality, imperfection, but always tidy enough to read well
at a wide camera angle and never clipping or floating.

## Where you work (IMPORTANT)
- ONLY in the isolated copy: `/home/ergo/ErgoFlex_Custom_Shop_ChildRooms` (own git repo, baseline commit
  "baseline: snapshot..."). Never edit `/home/ergo/ErgoFlex_Custom_Shop` (other sessions have uncommitted
  work there and the film renders from it).
- Do NOT run `git add` or `git commit` (Polish commits after each round to avoid races). `git diff` /
  `git status` are fine, and `git diff` shows exactly what every expert changed.
- Four experts work at the same time, in the same tree. Edit with small targeted Edit replacements, never
  rewrite or reformat a whole shared file, and re-read a region right before editing it. Prefer adding new
  code in a NEW file you own (named in your role below) and wiring it in with a one-line hook.
- Existing child-room files (read them first, ~1.3k lines): `child-room.mjs`, `child-room-activities.mjs`,
  `child-interior-detail.mjs`, `child-growth-detail.mjs`, `child-growth-profiles.mjs`,
  `child-personality-detail.mjs`, `early-years-life.mjs`, `early-years-art.mjs`, `early-years-profiles.mjs`,
  `early-years-wall-life.mjs`, plus shared `room-light-pools.mjs`, `room-bounce-light.mjs`,
  `room-finish-palettes.mjs`, `room-life*.mjs`, `room-polish.mjs`, `workspace-3d.mjs`. Docs from earlier passes:
  `docs/child-room-specialists-20261104/README.md`, `docs/child-room-personality-20261104/README.md`,
  `docs/early-years-*-20261104/`. Other rooms in the Shop (bedroom, study, gym) share some of these files;
  do not regress them.

## Do not touch / ports
- Studio for THIS work: http://127.0.0.1:3220 (already running from the copy, state file is the copy's).
  Never use :3000, :3017, :3100, :4190 (other sessions').
- If you start a browser or render, ONE at a time machine-wide: wrap it in
  `flock /home/ergo/logs/childrooms-render.lock nice -n 19 <command>`. This machine also runs a desk
  controller and other renders, so keep to headless Chrome software GL, a modest viewport, and never SIGSTOP
  any browser job. Reuse the review harness: `tools/environment-review.html`, `tools/child-growth-review.html`,
  `tools/environment-review-session.mjs` (see how docs/child-room-specialists-20261104/browser-review.json and
  the stills there were produced; the page is `window.EnvironmentReview`, room id `childroom`).
- No pushes, no network installs, no deleting files you did not create.

## Hard constraints (the room must keep passing)
- Real 48-inch desk and its real motion limits stay. Furniture grounded, inside room bounds, clear of
  windows and doors, no object overlap, nothing floating. Bedtime keeps floors clear and the reading lamp off
  with a low warm practical on. Existing editor IDs stay stable; new decor gets stable per-stage IDs.
- Performance: no realtime mirror rendering, no extra shadow-casting lights, no big new texture sets.
  Paint with canvas textures, emissive, merged geometry; keep draw calls modest (the room already batches).
- All original art: no copyrighted characters, logos, brands or real photos. Posters, book covers,
  drawings, album art are invented.
- Gate before you report: `npm run test:environment-finishes`, `node tests/scene-desk-data-test.mjs`,
  `node tests/child-screens-test.mjs`, `node tests/catalog-test.cjs` all green (update tests/child-room-test.mjs
  only to cover your new elements, never to loosen a bound).
- Verify by LOOKING: render stills of all five stages (at least house size, afternoon + evening + night) and
  actually view them; state honestly what still looks weak. A change you did not see rendered is not done.

## Output
Write `docs/child-room-pass-20261105/<your-role>-round1.md`: what you changed per stage (a table), files
touched, tests run with results, stills saved next to it (`docs/child-room-pass-20261105/<role>/r1-*.jpg`),
what you would push further. Final message to Polish: <= 12 lines, honest, list anything you could not verify.
