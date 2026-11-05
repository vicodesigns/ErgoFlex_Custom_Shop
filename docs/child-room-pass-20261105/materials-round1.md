# Materials, textiles & colour: round 1 (2026-11-05)

Goal: each life stage has its own surfaces, not one shared cream-and-sage shell, and every surface shows about a year of use. Everything is canvas-generated (about 10 to 14 modest textures per room). The pass changes materials and adds flat, merged wear layers. No furniture, desk, wall-art or lighting transforms change.

## Colour story per stage (60 neutral / 30 textile / 10 accent)

| Stage | Story (`CHILD_MATERIAL_STORIES`) | Walls / floor | Bedding & soft goods | Rug | Curtains | Timber |
|---|---|---|---|---|---|---|
| Early | Limed pine · gingham · scalloped play rug | Profile buttermilk walls (unchanged per profile), limed whitewashed boards, toy-car tracks and crayon on floor | Gingham quilt (profile colour) with accent binding and appliqué stars, cable-knit throw, corduroy nook and cushion | Cream chunky-loop rug, scalloped profile-colour border, dotted inner line, juice stain; interest motif now a translucent dye layer | Small two-colour dot print | Pale birch |
| Elementary | Honey oak · patchwork · striped flat-weave | Sunny cream `#f3e6c6`, honey oak boards | Patchwork quilt (7x8 prints, hand-stitch lines), ochre waffle throw, lagoon canvas headboard, chair and cushion | Lagoon/ochre/coral striped kilim with diamond rows and knotted fringe | Lagoon ticking stripe | Honey oak |
| Preteen | Painted boards · denim · Beni lattice | Clay-blush `#ecdbd0`, pale blue-grey painted boards worn back to timber at edges and along walking lanes | Denim quilt with tan topstitch grid and patch pocket, clay chunky knit, denim headboard/chair/nook | Oatmeal shag with hand-drawn dark lattice, clay/denim diamonds, fringe | Chambray slub | Limed oak |
| High school | Smoked oak · charcoal jersey & velvet · graphic wool | Putty grey `#d8d7d1`, smoked dark oak boards, caster arcs near the chair | Charcoal heather jersey with terracotta band, terracotta waffle throw, indigo velvet headboard and nook (physical sheen), terracotta velvet cushions | Indigo graphic rug with terracotta/peach arcs and slate bars | Slate blackout cotton with lined hem | Smoked oak |
| College | Grey-washed boards · washed linen · jute & petrol | Warm stone `#e1d6c4`, grey-washed wide boards, mug rings | Petrol washed-linen duvet with crinkles and oatmeal hem stripes, oatmeal chunky knit, boucle headboard and nook, caramel velvet cushion | Jute herringbone with petrol binding and stitch line | Oatmeal linen with a petrol hem band | Oiled walnut |

All stages:
- Walls have stage-specific paint roughness, from chalky matt to an eggshell dado, plus a faint roller-stipple bump.
- Trim paint follows each stage's neutral.
- The shared `green` upholstery, previously sage in every room, now follows the stage.

## A year of use (all stages)
- **Floor boards**: each board is drawn in one of four orientations, so the grain never repeats in line. Seams are darkened and tones are warm/cool jittered.
- **Floor patina** is one 512 px transparent layer:
  - dust at the skirting
  - a sun-bleached patch under the window
  - walking lanes from the door side to the bed and the desk chair
  - a rubbed landing by the bed
  - heel scuffs
  - stool rub (young stages) or caster arcs (older stages)
  - stage extras: crayons and toy-car tracks; felt-tip dots and mud; paint worn back to timber; mug rings
- **Rug**:
  - sun-faded on the window side, with a crushed-pile walking lane
  - the front corner curls up by up to 26 mm on a segmented body; the fringe follows the curl
  - the old flat border bands are hidden and painted into the weave instead
- **Bedding**: the quilt corner nearest the room (the one sat on) is faded and pilled.
- **Curtains**: the leading edge beside the glass is sun-faded. The front panel's UVs are mirrored so both faded edges sit beside the glass.
- **Furniture timber**: one luminance grain map with lighter, irregular rubbed edges. The stage tone stays in `material.color`, so existing clones keep their own tint.
- **Walls**: one 4x4 wear atlas, merged into one mesh per wall and parented to that wall, so cutaway walls take their marks with them.
  - All stages: skirting scuffs, plus fingerprints round a new light-switch plate on the right wall.
  - Early: crayon scribble, handprints, a half-peeled star sticker, splashes.
  - Elementary: tape remnants, ball marks, pencil doodle and tally, felt-tip dots.
  - Preteen: poster ghost with tape corners, Blu-Tack stains, a dado touch-up patch.
  - High school: pin and nail holes, tape, a chair or bag rub band.
  - College: filler patches, a sun-ghost where a frame hung, a touch-up patch.

## Files
- NEW `child-material-detail.mjs` (341 lines): `CHILD_MATERIAL_STORIES`, pure canvas painters (`drawPlank`, `drawTimber`, `drawRug`, `drawQuilt`, `drawThrow`, `drawCurtain`, `drawWearAtlas`) and `enhanceChildMaterials`. `root.userData.childMaterials` reports the stage story, decal count and texture count.
- `child-room.mjs`: an import line, plus one call on its own line after the existing enhancer line, before `room.roomAtmosphere`. It has no per-phase update.
- `child-personality-detail.mjs`:
  - New wall paints for the four older stages.
  - The early "Woven interest mat" is now a translucent motif layer at 30 % opacity, sized inside the scalloped border, over the new rug weave. It used to be an opaque plane that hid the rug.
- `room-finish-palettes.mjs`: the `childroom` library-prop textile is now oat `#b5a58f` instead of sage.
- `tests/child-room-test.mjs`: coverage for the new elements only. Each stage has a distinct floor, rug, quilt, curtain and wood; story present; patina on the floor group; wear decals on cutaway walls and inside the wall faces; curled rug grounded and under 40 mm; switch plate on the wall face.

Draw calls added per room: 1 floor patina, 3 wall-wear meshes, 1 fringe (elementary and preteen only), 2 switch-plate meshes. No lights or shadow casters were added. The pearl-white desk and its one-time migration are untouched.

## Tests (all green)
- `npm run test:environment-finishes`: 25/25 layouts pass, including the new assertions.
- `node tests/scene-desk-data-test.mjs` passes.
- `node tests/child-screens-test.mjs` passes.
- `node tests/catalog-test.cjs` passes.

## Stills (`materials/`)
- `r1-<stage>-afternoon|evening|night.jpg`: all five stages at house size, rendered with `child-growth-review.html` (iframe), live-reload blocked, one stage per lock hold.
- Close-ups: `r1-early-afternoon-bed-closeup.jpg`, `r1-preteen-afternoon-rug-closeup.jpg`, `r1-college-afternoon-rug-closeup.jpg`.

## Honest weak spots / next round
- **Wall wear** reads in close-ups but is nearly invisible in the wide promo camera. That is by design (subtle), but tape ghosts and the bag-rub band could be a touch stronger.
- **Preteen painted floor** is pale and cool. Its wear streaks read as worn paint up close, but at wide angle the floor slightly competes with the oatmeal rug. A warmer grey paint is worth trying.
- **Rug curl** is subtle at the wide angle. I did not verify it in a dedicated corner close-up.
- **Beni lattice** is still fairly regular. The shag pile does not read at distance.
- **Jute** reads well up close and as a fine texture at distance.
- **Not verified**: compact, spacious, premium and executive sizes were not rendered in the browser (they pass the node bounds tests); the morning and party phases; and the final Beni and paint-chip tweak in a close-up (the wide preteen still is after the tweak).
- **Next**: worn bed-frame corner and rubbed cabinet tops via a small per-object edge mask; scuffed lower wardrobe doors; pilled knit on the chair seat; stronger metal and plastic finishes on chair frames, the kitchen and toy plastics.
