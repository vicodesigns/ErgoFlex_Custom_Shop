# Materials, textiles & colour: round 2 (2026-11-05)

The review (`review-round1.md`) found the material work convincing close up but invisible at the wide promo camera, where all five stages read as one room re-skinned. This round fixes the specific defects it listed, makes the wear readable across the room, and widens the value and hue gaps between stages. Every change is in `child-material-detail.mjs`, except the two personality-palette wall colours.

## Fixes from the review

| Item | Result |
|---|---|
| Preteen floor read as tile with orange grout | The paint now covers each whole board: warm grey `#9d9284`, faint brush streaks, soft seams. There is no timber outline and there are no chips. Timber shows only along the walking lanes (patina). The cream rug now reads against a calmer mid-tone floor. |
| Beni rug read as a second tiled floor | Softer, thinner lattice lines (55 % alpha, 2–3 px) on wider, hand-wobbled diamonds, shag shading blotches, and fewer filled accents. The stain is smaller. |
| Grey squares on the preteen dado, tape and pins on the walls expert's mural, primary ball marks and tape | **Removed.** Everything above shoe height belongs to walls (`child-wall-life`). My wall layer now holds only skirting- and dado-height scuffs and splashes (rear wall max 340 mm, asserted in the test) plus the switch-plate smudges, which walls already claims. |
| Grid moiré on the toddler's upper rear wall | **The cause is found, and walls owns it.** Toggle renders: hiding `early-rear-mural` removes the grid; removing every bump map or the linen weave bump does not. In `early-years-wall-life.mjs` the mural's "dry-brush speckle" places 800 dots at `(sin(i*37.31), sin(i*91.7+6))`. Those are correlated sin sequences, so the dots fall on a Lissajous lattice, and that lattice reads as a woven grid once minified. The texture already has mipmaps (`LinearMipmapLinear`), so this is not a filtering setting. Fix (walls): use a hashed PRNG for the speckle, or delete it. Evidence: scratchpad `materials/diag/strip.jpg`. |
| Early curtain print aliasing | The dots are now 7 px on a 44 px grid (were 3 px on 22). |
| Dotted lines across the window wall | These are T-junction cracks in the wall shell, not a materials issue. Someone already fixed them in `child-room.mjs` this round (the side pieces are `wh+8` and overlap the sill and head bands). |
| College linen read as pinstripes | Fewer fine streaks; 46 large washed crinkles 5–13 px wide. |

## Wear you can see at the wide camera

- **Floor patina:**
  - The sun-bleach trapezoid from the window is about 2.5 m deep and stronger on dark floors.
  - Walking lanes depend on the floor's value: pale floors grey and dull, dark floors scuff lighter, painted boards wear back to timber.
  - The bed-side landing patch is denser.
  - Toddler toy-car tracks and crayon marks are about twice the size.
- **Rug:** a strong sun fade on the window side, a crushed-pile lane across the whole rug, a stain under the play table, and the curl raised to 30 mm (the test bound of 40 mm stays).
- **Bed:**
  - The foot corner nearest the room is turned back. A lining-coloured flap (`Quilt corner turned back`) sits above the throw, and the quilt texture shows sheet under the fold.
  - A large faded and pilled patch covers that corner.

## Five stories, further apart at distance

| Stage | Floor (value) | Furniture | Walls | Rug / bed contrast |
|---|---|---|---|---|
| Early | Warm natural pine, one step darker than round 1 (mid-light) | Pale birch | Profile buttermilk | Cream rug with teal scallops; gingham |
| Elementary | **Dark amber oak** (mid-dark) | **White-painted** (soft white, low roughness) | Sunny cream | Bright striped kilim; patchwork |
| Preteen | **Warm-grey painted boards** (mid) | Limed oak | Clay blush | Cream Beni; denim |
| High school | Smoked oak (dark) | Smoked oak | Putty grey, plus a **bottle-green `#40564b` window wall** | Indigo graphic rug; charcoal jersey and velvet |
| College | Grey-washed boards (mid) | Walnut | **Clay limewash**: `#e2d2ba` with a soft mottled map, tiled 3 x 1.6 | Jute; petrol linen |

- **Paint base for walls:** `root.userData.childMaterials.paint` publishes `{wall, dado, feature, trim, accentWall, finish, roughness, dadoRoughness}`. My pass runs before `enhanceChildWalls`, so the bed-wall statement can paint on it.
- **Coordination:** I touch only the shared `plaster`, `sage` and `cream` materials and, for teen only, a clone of `plaster` on the right-wall shell meshes. I do not touch walls' own panels.

## Files touched
- `child-material-detail.mjs`
- `child-personality-detail.mjs`: the college wall colour only.
- `tests/child-room-test.mjs`: three new assertions, all for my new elements:
  - rear-wall wear stays at shoe height
  - the paint base is published
  - the turned-back quilt corner exists

## Tests
All green on the combined tree at the time of writing:
- `npm run test:environment-finishes`: 25/25 layouts.
- `node tests/scene-desk-data-test.mjs`, `node tests/child-screens-test.mjs`, `node tests/catalog-test.cjs`: pass.

Mid-round, `child-room-test` failed twice: "Picture-book browsing approach" and "Hall light enters under the real door". Both came from other experts' edits in progress, and both pass now.

## Stills (`materials/r2-*.jpg`, combined tree, wide review camera)
- House size, all five stages, afternoon.
- Evening and night for every stage.
- Morning for early and college; shared time (party) for primary.
- Two other sizes: compact early and executive high school.
- Teen bed close-up showing the turned corner.
- Preteen rug close-up.

## Honest weak spots
- **Preteen board seams:** the floor still has a faint tiled rhythm. The cause is the 900 mm board length and its regular stagger, which is floor geometry in `child-room.mjs` and the same for all stages. Longer or random board lengths would help. I have not changed them, because shared floor geometry needs a Polish call.
- **Teen flap:** the turned-back corner lies over the knitted throw. It reads as a corner fold at distance, but up close it does not tuck under the throw.
- **Wall wear** is now deliberately minimal (shoe height plus the switch). The review asked for visible wear, and on walls that is walls' work.
- **Not rendered:** the spacious and premium sizes; the reading phase, if it differs from evening.

## Follow-up (Polish decisions)
- **Floor boards** (`child-room.mjs`, child room only): random-length boards of 1.3–2.3 m in 250 mm steps, with an irregular offset per row, replace the 900 mm boards and their regular stagger. The tiled rhythm is gone in the preteen and teen renders (`materials/r3-*-longboards.jpg`).
- **Spacious and premium sizes**, preteen and college: rendered. The tall wardrobe carcass in the left bay used the shared trim paint and read as a blank white monolith in front of the bed. It now takes the stage timber, and its painted doors are unchanged (`r3-preteen-spacious-afternoon.jpg`, `r3-college-premium-afternoon.jpg`; the two `-before-wardrobe-fix` stills show the old look).
- All four gate tests pass after both changes.
- Remaining: the limed-oak grain on the wardrobe's large side panel reads as strong vertical stripes. The cause is one shared timber map stretched over a 2 m face.
