# Set dresser — round 2

All code is in `child-lived-in-detail.mjs`. The only other change is in `tests/child-room-test.mjs`: the
lived-in visual bound goes from ≤ 50 to ≤ 70 meshes per activity, which Polish approved. No other bound
changed.

## What changed

The rack, nook, cabinet and bed keep their IDs, positions and footprints. Original frame meshes are hidden,
not removed, and each stage's piece is built inside the same group, so owner moves carry it along.

| Stage | Bed (`house-bed`) | Foreground rack (`story-rack`) | Nook (`reading-nook`) | Cabinet (`toy-cubby`) contents |
|---|---|---|---|---|
| Early | house bed kept; bear asleep, larger, head on the pillow | picture-book rack kept | 1.9× giant bear on the cushion | kept |
| Elementary | captain's bed: drawers, bookshelf headboard with books and dinosaurs, footboard | collection shelf: jars, dinosaurs, rocks, trophy, brick town on top | brick-building table with two builds in progress | red / yellow toy bins |
| Preteen | arched upholstered headboard, rolled foot | white hangout shelf: speaker, ring light, sticker mirror, fabric cubes | round shag cushion + beanbag | fabric drawers |
| Teen | dark platform; slatted headboard with a shelf; race bib "214", county medal and hanging spikes (the show-off) | sneaker wall: 8 pairs, turntable, speaker, sleeves | practice drum kit + road case | packed with LPs |
| College | walnut frame, tapered legs, tall linen headboard | plank-and-brick bookcase, turntable, pothos | reading armchair, ottoman, floor lamp | woven boxes, folded throws |

Other changes:
- **Duvet.** The kicked duvet is now one clean roll on a smooth incline. Its colour is the quilt's own: the quilt material's colour multiplied by the average of its printed map. The earlier version stretched the map and read as a blotch; a first fix copied only the material colour and came out white.
- **Bed-top items** are 40% larger.
- **Morning.** Every bed gets an outfit laid flat. Breakfast sits on the project table: bowl, toast and a drink, plus a lunchbox, banana, phone or cafetière depending on the stage. Morning is now distinct from afternoon in all five stages.
- **Early years.** The toy chest moves to the front strip, so the bed foot no longer piles up. The rocking horse has a carved head profile, ears, a mane, a saddle and dapples.
- **Preteen.** The beanbag is one slouched form instead of two buns. The skateboard was removed from the nook; it read as a black mirror slab.
- **Placement.** Every cluster can fall back to the front strip, except nightstands. Clusters stay clear of `childWallLife.rects` near walls. The walls layer's decor door on the right wall keeps a free zone of door.u ± 520 within 600 mm of the wall. Apartments now get 2 clusters each.
- **Cabinet carcass.** The cabinet frame and its paint stay with the materials layer. I first rebuilt the frame, but materials had already re-painted it, so I backed that out and change only the bay contents.

## Looked at (wide camera, combined tree)

- **`dresser/r2a-*.jpg`:** all 5 stages × morning, afternoon, evening, night and shared time, plus
  `r2a-contact-sheet-5x5.jpg`.
- **`dresser/r2b-*.jpg`:** re-renders after the fixes, at morning, afternoon and night, plus a teen bed close-up.

The five rooms now have different foreground silhouettes: picture-book rack, colour collection shelf, white
hangout shelf with ring light, sneaker wall with drums, and bookcase with armchair. The teen bib and the
duvet roll read in the close-up.

## Draw cost

Visible room meshes from the node build at house size (scene graph, not GPU calls):

| Stage | Without the lived-in layer | With it |
|---|---|---|
| Early | 245–314 | 255–329 (+10 to +19) |
| Elementary | 230–242 | 228–238 |
| Preteen | 223–239 | 223–239 |
| Teen | 230–252 | 238–266 (+3 to +16) |
| College | 226–246 | 226–246 |

The older stages are roughly neutral because the hidden originals (book covers and boards) were more meshes
than the merged replacements. Polish will measure actual draw calls.

## Tests

The four gates pass in the live tree: `npm run test:environment-finishes` (all 25 recipes), scene-desk-data,
child-screens and catalog. The earlier failure `wall-early-skirting overlaps wall-early-door` is gone. A
later `wall-preteen-painted-arch overlaps light-fairy-swag-preteen` failure reproduced with my hook removed,
so it was between the walls and lighting layers; it has since cleared.

## Still weak

- **Door.** With the decor door on the right wall, the house's right-wall clusters (scooter, guitar, mini fridge) have moved to the bed foot. There they partly hide behind the foreground rack, and the bed foot is busier again.
- **Floor lamp.** The college floor lamp is a tall pole in the foreground.
- **Black cabinet bays (fixed).** In the `r2a`/`r2b` stills, the cabinet's lower-bay contents render pure black in every school-age stage. A second bake stripped the vertex colours. Fixed and confirmed in `r2c-primary-house-afternoon-cabinet-closeup.jpg` (red and yellow bins). The other stages share the code path but were not re-rendered.
- **Early night.** The toddler's giant bear stays out at night.
- **Not addressed.** Repeated cabinet tops (the personality lamp) and the framed prints (walls). Sizes other than house were not rendered.
