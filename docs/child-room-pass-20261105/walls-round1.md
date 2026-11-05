# Walls & architecture: round 1 (2026-11-05)

Role: walls and the room shell, all five life stages. All new work is in ONE new file,
`child-wall-life.mjs`, wired in with one hook line in `child-room.mjs`. It runs LAST in the decor
chain. Before placing anything it measures the walls (root-local boxes of every visible fixture
within 420 mm of a wall, plus the glazing, curtains, curtain pole and the materials layer's switch
plate). Each cluster then slides, and shrinks through fallback widths, until it is clear. So it adapts
to all 25 stage x size layouts and to what the other experts added this round (lighting's neon
sign, star projector, rocket light, fairy swag and swing-arm lamp; the dresser's cart).

## What changed, per stage (house size; other sizes adapt or drop a cluster)

| Stage | Rear wall | Window wall | Window | Story thread |
|---|---|---|---|---|
| Early years | 3 to 5 crayon drawings (new `drawChildCrayon`: family, house, rainbow, hand prints, "PEPR" the dog) taped crooked at 4-year-old eye height on the dado. One has slipped to a 22° tilt on its last tape. Another has a curled corner. | Low oak peg rail in the corner: yellow raincoat with hood and buttons, and a felt dress-up crown on a string | Gel star and fish clings on the glass (behind the blind at night). Sill: cress egg-head, pebble line-up, pine cone, small dinosaur | Existing murals kept |
| Elementary | Cork pinboard over the homework desk, crowded: STAR READER certificate, class photo, "TO MARS!" rocket drawing, 10/10 spelling list, weekly timetable, tooth-fairy note, library card, science-fair rosette. Jobs chart with star stickers at child height. Glow-in-the-dark planets (one with a ring) and stars across the top: pale by day, green at night. | World map with family-trip pins. Harbor Otters team pennant. Race-day medals on a hook in the corner. | Bean sprout in a cup, rock collection, toy rocket. Star and dinosaur clings | Height marks to 9 ("6 · lost tooth!") |
| Preteen | Hand-painted twin-peaks mural (denim, clay, navy, snow cap, ochre sun) behind the desk, taller than the monitor. A loose grid of 11 polaroids washi-taped above it, plus an aquarium ticket. No bulbs (lighting owns the fairy swag over the bed). | Pencil sketches (eye study, "hands are HARD", Pepper asleep, 1-point street) and a FOUND zine, all washi-taped. Poster for an invented film. Photo-booth strips in the corner. | Succulent, snow globe, two paperbacks. Washi heart and a prism suncatcher on a thread | Height marks to 12 |
| High school | Overlapping gig-poster wall over the desk (6 invented bands and venues: one torn corner, two curled, pins and tape mixed), plus a set list and two ticket stubs. It hangs BEHIND lighting's neon sign (the sign stands off on studs). Exam timetable and sticky notes at chair eye level. | Acoustic guitar on a wall hanger in the window corner. Record ledge with leaning sleeves and a record. NORTH RIDGE XC pennant. | Cactus, cross-country trophy, earbud case. Band sticker on the glass | Height marks to 16 ("14 growth spurt!!"); the LOW TIDE STATIC poster carries on into college |
| College | Whiteboard (thesis deadline, systems diagram, Q = C·i·A, to-do list with ticks, a ghost of a wiped-off note) with marker tray, markers, eraser and a magnet-held article. October calendar on a nail with crossed-off days. Warm string lights across the top with 7 pegged photos. Picture ledge with leaning frames and a trailing plant beside the bed. | Exhibition, film-night, LOCAL TO GLOBAL lecture and screen-print posters, plus the torn LOW TIDE STATIC poster kept from school. Three postcards. The same guitar, now with stickers. | Herb pots, petrol mug, book stack. Permit decal on the glass | Height marks to 18 ("18 → off to uni!") |
| All | Curtain pole with rings, brackets and finials (the curtains used to hang from nothing). Painted skirting on the window wall (only the rear and left walls had it). | | | One owner, "Noa", and the dog Pepper run through every age |

The height marks are a pencil-marked door-frame offcut on the rear wall by the window corner. The
room has no door, so this stands in for the classic door-frame growth chart.

## Cost

- One 2048² canvas atlas per room build holds every paper item of that stage (posters, photos,
  sketches, notes, cork, whiteboard). The textures are original and procedural: no image files,
  brands or real photos.
- Each cluster is merged into at most 3 meshes: paper, vertex-coloured hardware, and emissive glow.
  The test asserts this. A stage adds 5 to 10 clusters, about 15 to 25 draw calls.
- No lights, no shadow-casting paper. Glow is emissive only. Phosphor stickers are 0 by day,
  0.12 in the evening and 0.55 at night. String lights are 1.6 in the evening, 1.2 at party, 0.25 at
  night for teen/college and 0 otherwise. The lighting expert may want to retune these.

## Files

- NEW `child-wall-life.mjs`: everything above.
- `child-room.mjs`: an import plus one hook line (after the lighting hook, before lived-in).
- `early-years-art.mjs`: added an exported `drawChildCrayon()`; `drawEarlyMotif` is untouched.
- `tests/child-room-test.mjs`: one new block. It checks, for every layout: the clusters are present
  (at least 5 early, at least 7 older), inside the shell, clear of the glazing and curtains, and not
  overlapping any other fixture or each other. The string lights are checked per vertex. Sill and
  stickers stay in the window opening, the pole is above the glazing, paper casts no shadows, meshes
  are merged, glow is on at bedtime and off in the morning, and the string lights are at most a low
  glow for sleep. No existing bound was changed.
- `early-years-wall-life.mjs`: not changed. It already had the murals, bunting, paintings and
  stars, and lighting's star projector covers the bedtime sky.

## Tests (all green, run 2026-11-05)

- `npm run test:environment-finishes`: pass (all 25 layouts x 5 activities, with the new wall checks)
- `node tests/scene-desk-data-test.mjs`: pass
- `node tests/child-screens-test.mjs`: pass
- `node tests/catalog-test.cjs`: pass

## Stills (`walls/`)

`r1-<stage>-house-{afternoon,evening,night}-over.jpg` are the review-camera overviews.
`r1-<stage>-house-afternoon-rear.jpg` and `-right.jpg` are wall close-ups. `r2-*` are re-renders
after the fixes below: taller preteen peaks, the teen poster wall moved behind the neon sign, and
larger glow planets. The render harness is in `walls-render-harness.mjs.txt` (iframe-based, studio
live-reload blocked, one flock job per stage).

## Honest read of the stills

- Strong: elementary night (the green glow planets read right away), college (string lights with
  photos, whiteboard and calendar, guitar), preteen painted peaks with the photo grid, and the window
  pole, clings and sill in every stage.
- Weak:
  - At the wide review camera, small paper items (pinboard contents, sketches, sticky notes) read
    as texture, not content. They only pay off in close-ups.
  - The teen exam notes sit partly behind the monitor.
  - The apartment layouts drop one or two clusters; the walls really are full there.
  - The glow planets by day look like faint dots. That is realistic, but not much of a statement.
- Not verified: compact / spacious / premium / executive were checked only geometrically (the
  wall-map and test), not rendered. Party and morning were not rendered. The left wall gets nothing
  from me; the review camera cuts it away.

## Push further (round 2)

- Use the left wall above the bed (posters and pennants for teen/college, a bedtime-story shelf for
  early). It is hidden by the review camera but is in film angles.
- A real door with a painted frame (and the height marks on its jamb) on the front-left wall. That
  needs a floor-plan decision from Polish/furniture, as lighting already implies a hall door "ajar".
- Bigger, bolder statement pieces at wide angle: a painted arch or colour-block behind the teen desk,
  and an elementary world-map mural instead of a poster.
- Coordination: wall wear, skirting scuffs and the switch plate belong to the materials layer, and
  this layer does not duplicate them. Its "ghost poster" decals can peek out from behind my
  clusters; `root.userData.childWallLife.rects` now exports my claimed wall rectangles so it can avoid
  or deliberately frame them. Modules added after mine (lived-in) should check
  `root.userData.childWallLife.rects` before placing wall items.
