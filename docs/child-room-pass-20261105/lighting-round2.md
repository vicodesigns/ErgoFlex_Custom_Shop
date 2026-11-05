# Lighting & atmosphere · round 2 (2026-11-05)

Answers `review-round1.md` (lighting items + routing summary) and Polish's round-2 brief. Everything was
judged on the COMBINED render at the wide review camera (walls, dresser and materials round-2 work in the
tree at the same time). Stills: `lighting/r2-<stage>-house-<phase>.jpg` (morning, afternoon, evening
(= reading), night, party (= shared time)), 3x2 sheets `lighting/r2-sheet5-<stage>.jpg`, desk-LED-on
`lighting/r2-leds-*`, other sizes `lighting/r2-apt-*` (apartment) and `lighting/r2-exe-*` (executive).

## 1. Fixes from the review

| Review item | What changed |
|---|---|
| Moon disc blows out the bed wall in every stage; doubles with the college swing-arm | The disc mesh is hidden from elementary up. Its point light (the tested bedtime light, name unchanged) is re-parented into each stage's own practical: rocket lamp (elementary), fairy swag (preteen), LED cove (teen), swing-arm lamp (college), with a stage tint. Early keeps the crescent; its light is pulled 250 mm off the wall and lowered, plus a soft halo instead of a scorch. |
| Pink rectangles around the teen neon | Every wall glow now sits 55 mm proud of the wall (flat posters are <= 35 mm), so it lights the posters instead of cutting rectangles round them; the neon's glossy acrylic plate went from 18% to 5% opacity, matte. Rear-wall washes are clamped to the wall so none hang past the corner. |
| Teen night 13% crushed | Hemi 0.12 -> 0.27, exposure 1.12 -> 1.20, cove on BOTH visible walls plus behind the headboard, cool streetlight bars through the blind across the floor. Measured below. |
| Elementary hall wedge with no door | The wedge is gone. Walls built a real (closed) door on the right wall; lighting reads its claimed rectangle from `root.userData.childWallLife` (`door`, or `rects.right` id `wall-primary-door`) and lays a short warm fan of hall light on the floor under it plus a bright threshold line, at night only. No door, no light. |
| Elementary cabinet-lamp scallop with no lamp | The right-wall scallop is only built where the cabinet lamp light actually exists (preteen up), at that lamp's measured position, and toned down. |
| Primary day "moon" disc reads as a hole | Hidden (above). |
| Early stars cluster upper-left / lost with the ceiling | Star map rebuilt with crisp five-point stars + fewer bokeh blobs, spread across the rear wall down to bed height and carried round the corner onto the right wall. Cool moonlight bars through the blind on the floor. |
| College skyline aliases | Facades are soft gradients; unlit windows are no longer drawn; lit windows are sparse 11x13 px blocks (no fine dot grid). |
| Preteen night only "dark warm" | Lilac LED glow behind the headboard and a lilac wash from the ceiling line over the arch, fairy lights lower; crush 5% -> ~2%. |

## 2. Morning is not afternoon

- Morning: low warm-gold key (power about 1.7-1.85, key colour about 2700-3000 K), less hemi (0.38) and a
  cool blue fill, so the real shadow map's long raking shadows read; blind fully up; a visible sun shaft
  (one additive quad from the window to the floor, dust motes) and a long gold window patch
  aimed along the real morning sun direction.
- Afternoon: high white key (about 1.15-1.3), generous warm hemi (0.5+) and fill, blind 34% down
  (`CHILD_LIGHT_CUES.afternoon.blind` 0.1 -> 0.34), a short white patch close under the window, a paler sky.

## 3. The bed wall as the night hero (with walls' statement walls)

| Stage | Walls' statement | Lighting on it at night |
|---|---|---|
| Early | Tree and moon mural | Projector stars and crescent landing on the mural and round the corner; amber crescent halo |
| Elementary | Space mural with glow planets | Deep-blue night wash from the ceiling line over the mural, rocket lamp scallop at the bedside, hall glow under the door |
| Preteen | Arch with fairy swag | Fairy swag (lighting's) + warm wash on the arch, lilac LED from behind the headboard and the ceiling line |
| Teen | Gig-poster wall | Amber sleep-mode cove on both walls and behind the headboard lights the posters; neon (900 x 450, over the bed) on in the evening, off for sleep; streetlight bars on the floor |
| College | Gallery wall + string lights | Warm grazing wash from the string-light line over the gallery, swing-arm lamp (now the bedtime light), the nook floor lamp is now the real reading light (the reading point light is re-parented into its shade and the shade glows) |

## 4. Checks

Gate tests (combined tree, after walls/dresser/materials round-2 edits): `npm run test:environment-finishes`
exit 0, `node tests/scene-desk-data-test.mjs` exit 0, `node tests/child-screens-test.mjs` exit 0,
`node tests/catalog-test.cjs` exit 0. (Mid-round, child-room-test was red for a while on the dresser's
"Picture-book browsing approach" (teen stage shelf); that was theirs and is green now.)

Exposure, house size, room pixels only (luma 0-255 / % clipped > 250 / % crushed < 14):

| Stage | Morning | Afternoon | Evening (reading) | Night | Party (shared) |
|---|---|---|---|---|---|
| Early | 119 / 0.01 / 0.0 | 139 / 0.13 / 0.0 | 98 / 0 / 0.0 | 53 / 0.06 / 0.2 | 119 / 0 / 0.0 |
| Elementary | 106 / 0.03 / 2.8 | 124 / 0 / 1.2 | 87 / 0.01 / 4.9 | 48 / 0.08 / 5.8 | 99 / 0 / 2.4 |
| Preteen | 108 / 0.03 / 1.2 | 126 / 0.01 / 0.9 | 104 / 0.26 / 1.0 | 62 / 0.06 / 2.0 | 112 / 0.01 / 1.2 |
| Teen | 70 / 0.08 / 3.7 | 82 / 0 / 4.7 | 66 / 0.01 / 9.0 | 59 / 0 / 12.9 | 77 / 0.01 / 6.0 |
| College | 92 / 0 / 0.9 | 110 / 0.01 / 0.8 | 87 / 0.32 / 1.0 | 53 / 0.17 / 2.7 | 97 / 0 / 1.0 |

Teen night: luma 36 -> 59. The crush figure is still about 13% because materials repainted the teen
window wall bottle green and the door/dado navy in this round (it went to 22.6% before my lift; see
`lighting/r2-diag-teen-night-crush-before-lift.png`, red = crushed). What is left under 14 is that green
wall's lower half and black objects (road case, speaker); the posters, bed, rug and floor read.

Desk LEDs ON (default cyan), `r2-leds-*`: no clipping anywhere (max 0.43%); night luma rises (teen
59 -> 70, college 53 -> 66, preteen 62 -> 76, early 53 -> 70). Teen night becomes an amber-cove / cyan-desk
split that still reads as one room.

Other sizes: apartment (early, teen, college; morning + night) and executive (elementary, preteen;
evening + night) rendered and looked at: stars, cove, swing-arm, fairy and hall light all land on their
walls; no wash hangs past a corner.

Draw calls (WebGL draw calls counted around one presentation capture, wide camera, house):

| Stage | Before round 2 (frame) | After (frame) | My visible meshes before -> after |
|---|---|---|---|
| Early | 1,129-1,207 | 1,132-1,206 | 4-6 -> 4-8 |
| Elementary | 1,159-1,168 | 1,111-1,118 | 8-10 -> 7-11 |
| Preteen | 1,234-1,252 | 1,175-1,194 | 21-22 -> 7-12 |
| Teen | 1,245-1,261 | 1,199-1,227 | 10-13 -> 11-17 |
| College | 1,243-1,267 | 1,187-1,209 | 10-11 -> 7-13 |

"Before" is the same tree just before my round-2 edits (others' round-2 work was already arriving, so the
frame totals move with them too). My own net change is at most +4 meshes (teen: second cove + window spill);
preteen dropped 10 by instancing the clipped photos. All new meshes are non-shadow-casting; no new lights.

## Files

- `child-lighting-detail.mjs` (mine): all of the above.
- `child-lighting-profiles.mjs` (mine): morning/afternoon/night mode table.
- `child-room.mjs`: `CHILD_LIGHT_CUES` morning blind 0.04 -> 0.02, afternoon 0.1 -> 0.34 (two numbers).
- `tests/child-room-test.mjs`: new coverage only: the moon disc is early-only, the bedtime light lives in
  the stage practical, the elementary hall light enters under the real door when walls built one.

## Honest weak spots / next

- Teen crush is lifted visually but still about 13% by the number (green wall, above). Lifting further
  would need materials to lighten the green one step or me to flood it, which kills the mood.
- The college nook floor lamp: lighting adopts the dresser's lamp by geometry signature (cylinder shade
  r 150/190) and re-parents the reading light into it. If the dresser changes that shade, it silently
  falls back to the old left-wall sconce. Better: the dresser tags the shade (`userData.lampShade`).
- The hall light reads `childWallLife.door` if walls publish it, else the claimed rect `wall-primary-door`
  (walls compute `door` but do not put it in the summary yet).
- The early crescent still warms the canopy corner strongly at night; it is a halo now, not a scorch,
  but could go another step down.
- The moonlight bars on the floor read as a pale smear in the very large executive room.
- Morning is driven by colour, contrast, the shaft and the long patch; the real key-light elevation
  is shared in `room-refinement.mjs` (other rooms use it), so I did not lower the morning sun itself.
- Not checked: compact/spacious/premium beyond the two sizes above; close-up cameras.
