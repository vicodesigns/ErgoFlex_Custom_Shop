# Set dresser / "lived-in" — round 1

Role: the objects and evidence of life. One new file, `child-lived-in-detail.mjs`, wired in with a
one-line hook at the end of `buildChildRoom` (same wrap-the-atmosphere pattern the walls pass uses). No wall,
lighting, textile or palette code was edited; belongings take their colours from the existing personality
palette and the duvet folds re-read the quilt's live material every activity change, so the textile pass
still drives the bedding.

## The five people

| Stage | Who lives here | Always there | Changes with the activity |
|---|---|---|---|
| Early years | a toddler; everything big, soft, chunky and at knee height | painted toy chest at the bed foot, rocking horse (right wall, beside the growth chart), rainbow stacker and chunky cups in the free cubby bay, two bears on the pillow | morning: duvet kicked down, pyjamas on the quilt, chest open, stacking rings on the mat, walker loaded with blocks; afternoon: big soft ball on the mat; story time: three board books + open book on the bed, chest shut, walker gone; bedtime: bear asleep under a little blanket with its head on the pillow, chest shut, floor clear; play together: two soft friends "watching" the railway |
| Elementary | an 8-year-old: school, a collection, a ball | storage bench with bins at the bed foot, scooter + football on the right wall, nightstand (alarm clock, books), rock collection in an egg-carton tray, first trophy, rabbit + dog on the pillow | morning: bed kicked open, pyjamas, backpack unpacked on the bench with lunchbox, shoes kicked off, half-done puzzle on the rug; afternoon: comic face-down on the quilt, brick house going up on the rug, juice box + apple + stickies on the project table; chapter time: open book + flashlight on the bed, bag packed; bedtime: rabbit tucked in, flashlight on the pillow, water by the clock, tomorrow's clothes over the chair; friends: board game, brick build, cushions and snacks on the rug, three cups on the table |
| Preteen | a 12-year-old: phone, hobby in progress, outgrowing toys | beanbag (+ skateboard) at the bed foot, rolling craft cart (markers, yarn, paper, a bracelet on top) on the right wall, nightstand with a trailing plant, figurine row, the old rabbit demoted to the cabinet top, two throw cushions | morning: hoodie + phone on an unmade bed; afternoon: sketchbook + pencils on the bed, sketchbook on the beanbag, floor drawing on the rug, cocoa + stickies + phone on the table; read & listen: graphic novel, phone, earbud case; bedtime: phone charging on the nightstand (cable to the floor), craft cart tidied; hangout: sleeping bag, rolled bag and snacks on the rug, cards on the bed |
| High school | a 16-year-old who plays guitar and runs track (the story told by the stuff) | electric guitar on its stand + practice amp on the right wall, laundry hamper overflowing at the bed foot, mixtapes, a medal and a small trophy on the cabinet, nightstand, the old rabbit on the nightstand's low shelf, duvet never quite made | morning: phone and yesterday's hoodie on the bed, floor-drobe clothes pile, trainers; afternoon: revision guide open, record crate + spread sleeves on the rug, track bag dumped, lead plugged in and pedal on the floor, two mugs + chips + charger + stickies on the table; portfolio & music: laptop open on the bed with a track on screen, headphones, phone; bedtime: bed flat, phone charging + headphones on the nightstand, trainers paired, two mugs left on the table; study group: pizza box, floor cushions, cups and notes on the rug, jackets thrown on the bed |
| College | home between terms: plants, coffee, a weekend bag | upholstered bench at the bed foot with boots, mini fridge with kettle + mugs and a big floor plant on the right wall, trailing pothos + candle + photo in the cabinet, nightstand, throw cushions + lumbar, the old rabbit on the bed | morning: tote packed on the bed, yoga mat out on the rug, weekend bag on the floor; afternoon: laptop + notebook on the bed, clean laundry folded in a basket on the bench, mug + highlighters + sticky tabs + charger on the table; reading: novel face-down and reading glasses; bedtime: books + glasses + water on the nightstand; shared project: cushions, snacks and a laptop on the rug, three mugs on the table, coats on the bed |

The same cloth rabbit (the early-years nook rabbit) travels through every stage: on the toddler's mat, on
the 8-year-old's pillow, demoted to the 12-year-old's cabinet top, kept on the teenager's nightstand shelf,
and brought back onto the bed by the college student.

Every stage also gets clothes over the study-chair back (a hoodie by day; tomorrow's outfit at bedtime).

## How it stays grounded and bounded

- **Measured placement.** Each floor cluster (toy chest, rocking horse, bench, scooter, beanbag, craft cart,
  hamper, guitar, mini fridge, nightstand) is offered a list of candidate spots (rows stepping away from the
  bed foot; positions along the right wall beyond the curtains; beside the bed head). A spot is accepted only
  if the vertex-exact bounds of the built cluster are grounded (min y = 0 ± 1 mm), inside the walls with a
  60 mm margin, 40 mm clear of every registered furnishing, off the play mat, clear of glazing and curtains
  if it is tall, and clear of every authored desk route using the same `segmentIsClear` swept-footprint test
  as the room test (plus 80 mm extra margin). If no spot fits (the compact rooms), the cluster is skipped
  rather than squeezed.
- **Footprints.** Accepted clusters push their measured footprint into the room's `furnitureBounds`, so the
  existing overlap test and the 900 desk-route checks in `tests/child-room-test.mjs` now include them.
- **Supported belongings** sit on surfaces they belong to: the sheet strip (345 mm) and quilt crown on the
  bed, the cabinet's upper bay (322 mm) and top (616 mm), the nightstand top/shelf, the project table's free
  corners (the table's central work and existing kits are untouched), the chair backrest.
- **Bedtime.** Everything flagged "loose" (piles, dropped bags, shoes kicked off, rug projects) is hidden at
  night; what remains is parked: chest shut, trainers paired, guitar on its stand, bag packed.
- **Performance.** No lights, no new texture sets (a few 256 px canvases: record sleeves, a puzzle, a board
  game, two laptop screens). Each phase group is baked: plain belongings are merged into one vertex-coloured
  material per finish band (matte / satin / metal); textured, glowing, transparent and shared room materials
  (oak, the quilt) stay separate so palette changes still reach them. Visible lived-in draw calls per
  activity in the house rooms: early 8–15, elementary 24–29, preteen 18–24, high school 23–39, college 23–29.

## Files touched

- `child-lived-in-detail.mjs` — new (all of the above).
- `child-room.mjs` — import + one hook line before `root.userData.childRoom`.
- `tests/child-room-test.mjs` — new block (does not loosen any bound): every lived-in floor cluster registers
  a footprint that encloses it and is grounded; loose belongings are put away at bedtime; ≤ 50 visible
  lived-in meshes per activity.

## Tests (all green at hand-off, 2026-11-05)

- `npm run test:environment-finishes` (includes `tests/child-room-test.mjs`, all 25 recipes x 5 activities): pass.
- `node tests/scene-desk-data-test.mjs`, `node tests/child-screens-test.mjs`, `node tests/catalog-test.cjs`: pass.
- Sabotage controls (temporary copies, never in the shared tree): shrinking a registered footprint by 60 mm
  fails `lived-rocker-early footprint encloses it`; leaving one loose group visible at night fails
  `Loose belongings put away at bedtime`.

## Stills (`dresser/`)

- `r1-<stage>-house-{afternoon,evening,night}.jpg`: all five stages, house size, final code (15 stills), plus
  `r1-contact-sheet.jpg` (rows = stages, columns = afternoon / evening / night).
- `r1-<stage>-house-afternoon-bed-closeup-earlier-iteration.jpg`: close-ups from the FIRST iteration (before
  the fixes below). They show the bed and bed-foot detail better than the wide view, but are not final.
- Harness: `/tmp/claude-1000/-home-ergo-ErgoFlex-Desk-Stack-Polish-Features/d7558b4f-5632-4cb5-a70c-758e44afe9b1/scratchpad/dresser/drender.mjs`
  (iframe harness, live-reload blocked, one stage per flock job).

What I looked at and fixed between the iterations: toys sat on top of a solid toy chest (it is now hollow,
with toys peeking over the rim); throw cushions read as beans (now square cushions leaning on the pillows);
rug projects were hidden behind the story rack (moved to the camera-facing half of the mat); a navy hoodie
vanished on a navy chair (now heather grey); the preteen beanbag matched the bedding (now clay); the duffel
was oversized. Placement went from a hand-written size per cluster to a measured one, which put the beanbag,
nightstands and college bench into the larger rooms as well.

## Honest weak spots

- At the wide film angle the bed-top stories (board books, comic, flashlight, glasses) are small; the
  laptop, bears, cushions and duvet read, the rest needs a closer camera. Bedtime is told mostly by absence.
- The kicked-down duvet uses the quilt's own material on a displaced sheet; it reads as rumpled cloth but its
  folds are soft and blotchy under the night key light.
- Compact (apartment) rooms get fewer floor clusters: the measured fit rejects most spots (teen: guitar
  only; college: none on the floor). Larger rooms reuse the house recipe rather than adding more.
- Not rendered in round 1: morning and shared-time wide shots (logic covered by tests, not seen), sizes other
  than house, and close-ups of the final code (the close-ups saved are from the first iteration).
- The skateboard (preteen) and walker (early) are mostly hidden behind the beanbag / story rack at the film
  angle.

## Push further (round 2)

- A closer "bed" and "desk" camera pass for the final code; tune bed-top props to read at the film angle
  (bigger, higher-contrast covers; a phone screen glow at night for the teen).
- Morning and shared-time renders for all stages; the morning school-bag / pyjama story is unseen so far.
- Per-size extras: the larger rooms have floor to spare (a teen drum pad or a college bike on the wall).
- Desk-surface life on the ErgoFlex itself (mug, sticky notes, headphones on the hook) needs coordination with
  the desk-kit owner because the desktop moves.

