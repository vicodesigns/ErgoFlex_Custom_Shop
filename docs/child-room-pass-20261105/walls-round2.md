# Walls & architecture: round 2 (2026-11-05)

Brief: make the bed wall the hero, unique per stage. Move the best pieces into the wide camera.
Dress the left wall. Stop the repeated hooks and poster trio. Build a real door with height marks.
Fix the moiré, the seam lines, the dado squares, and the tape/pins on my murals.

All five stages now look like different rooms at the wide promo camera
(`walls/r2-<stage>-house-{afternoon,night}-over.jpg`).

## The shared template is retired (ids kept, objects hidden)

`child-wall-life.mjs` now hides, before it measures the walls:
- in every stage: `personality-bed-paint` (the accent rectangle) and `personality-rear-gallery` (the centred poster)
- early: `sleeping-arch`, and `growth-chart` when the door's frame takes over the height marks
- elementary to college: `rainbow-print` and `forest-print` (the two framed prints) and `personality-right-gallery` (the poster trio)
- teen and college: `personality-hooks` (hoodie and backpack) and the left-wall project board

The list is in `root.userData.childWallLife.retired`. Lighting hides the moon-disc artwork from
elementary up. I drew no disc of my own; the toddler keeps the crescent night-light.

## Bed wall: the hero (`childWallLife.hero` = {wall:'rear', u0, u1, v0, v1, kind})

| Stage | Hero | What else moved into view |
|---|---|---|
| Early | Rear mural repainted in true mm (no stretch): a big tree whose crown spreads over the bed, a rope swing, a moon and painted stars where lighting's projector stars land at night, clouds, and stronger hills. | The scribble zone: 14 drawings (3 new crayon designs, two A3), taped crooked, overlapping, at 400–1000 mm, with a washed-off crayon loop on the paint. Raincoat and crown hang on pegs on the door. "NOA" letters on the door. |
| Elementary | Hand-painted space mural over the bed (2.0 × 1.8 m): sun, ringed planet, Earth and moon, Mars, a rocket on a dotted "TO MARS!" trail, a tethered astronaut, the Big Dipper. Glow stickers are bright plastic colours by day and phosphor green at night, on the mural and trailing towards the desk. | Pinboard centred over the desk. Jobs chart. KEEP OUT sign and medals on the door. World map and pennant past the door. Solar-system poster on the left wall. |
| Preteen | Floor-to-ceiling painted arch: clay over a denim arch, an ochre sun and a cream inner line. It is painted across the dado and rail too. Lighting's fairy swag hangs across it. | A photo wall at 3× the size (12 polaroids) where the prints were. KNOCK FIRST sign and the photo-booth strips on the door. Sketches and the film poster past the door. Cork vision board on the left wall. |
| High school | About 40 overlapping sheets wall to wall across the upper rear wall and over the bed, in three layers: 14 invented gig posters, album sleeves, set list, stubs, some torn, some curled. Lighting's neon sits over them. | Exam timetable at seated eye height beside the desk. The guitar is out of the corner, next to the door. Record ledge and pennant past the door. DO NOT DISTURB hanger and band stickers on the door, hoodie on an over-door hook. Posters continue round the corner onto the left wall. |
| College | Salon-hung gallery wall over the bed: 8 mixed frames (black, oak, white, brass) and a round mirror. It keeps clear of lighting's swing-arm lamp. The string lights with pegged photos stay on top. | The guitar (with stickers) hangs beside the gallery. Picture ledge. Whiteboard and calendar centred over the desk. Term timetable and a robe on the door. Posters past the door. Block-printed tapestry on the left wall. |

## The door (`childWallLife.door` = {wall:'right', u, width:860, height:2040, frame:1020, threshold})

- **What it is:** a cased frame, a recessed panelled slab, a lever, hinges and plinth blocks. Pencil
  height marks with ages run up the hinge-side casing (to 4, 9, 12, 16, 18 by stage), and there is an
  emissive gap under the door for the hall light (0.35 in the evening, 0.6 at night, 1.4 at
  elementary night).
- **Decor only:** a closed slab, nothing on the floor, no route change.
- **Placement:** one rule for every stage: on the window wall, just before the toy cubby. House:
  z 1068–2112.
- **Knock-on effects:** the clothes hooks slide along the wall to clear it, and the window-wall
  skirting stops at the casing.
- **Apartment:** no room for a door, so it falls back to the rear-wall marks strip.
- **Lighting** reads the door for the elementary hall wedge. **The dresser** has been told to keep
  floor items clear. The rocking horse briefly stood in front of it; it is clear now.

## Fixes

- **Toddler moiré (fixed, confirmed by render):**
  - Two causes, both mine.
  - (1) The dry-brush speckle used `sin(i*k)` positions, which fall on a lattice. It now uses a
    seeded random sequence. A dump of the canvas confirms it is clean.
  - (2) The grid was still there after that. Isolation renders showed:
    - hide the mural: grid gone
    - stop it receiving shadows: grid stays
    - move the plane 8 mm off the wall: grid gone
  - So the painted plane at 0.7 mm was z-fighting a coplanar wall layer. The rear mural is now 5 mm
    proud, and early paper items sit at 6.6 mm. Stills: `walls/r3-early-house-*`.
- **Dotted lines on the window wall (much fainter, NOT fully gone):**
  - What I did: the window side boxes overlap the sill and head bands (`child-room.mjs`, one line).
    A seamless plaster skin with a window hole now covers the wall face, using the wall's own
    material, 1 mm proud. The shell boxes underneath lose the stipple bump.
  - Ruled out by isolation renders: T-junction cracks, shadow receive on the skin, transparent
    decals, and the bump map on the skin.
  - Still there: faint dashes at head height (2300 mm). Root cause is not found.
- **Preteen dado grey squares, and tape/pins on my art:** materials removed theirs this round. As a
  safety net, walls also clears any wear quad that lands on a walls cluster, plus the preteen
  touch-up cell on the dado (`childWallLife.wearRemoved`; now usually 0).
- **Teen exam notes:** moved beside the desk at seated eye height.

## Files

- `child-wall-life.mjs` (mine): template retirement, door, heroes, re-composed walls, left-wall
  pieces, window-wall plaster skin, wear clean-up, door/hero/rects export.
- `early-years-wall-life.mjs` (mine): new tree/moon sleeping-wall painting, and the lattice
  speckle fix.
- `early-years-art.mjs` (mine): `drawChildCrayon` now has 8 designs.
- `child-room.mjs`: one edited line, where the window side boxes overlap the sill/head bands (the hook line is from round 1).
- `tests/child-room-test.mjs`, walls block only:
  - The door: skirting stops at the casing.
  - Paint layers (arch, mural) stay within 31 mm of the wall.
  - Composite clusters (poster walls, gallery, string lights) are checked per vertex against other
    fixtures, so a bounding box spanning the wall doesn't false-flag.
  - No existing bound was loosened.

## Tests

All four gates are green: `npm run test:environment-finishes`, `node tests/scene-desk-data-test.mjs`,
`node tests/child-screens-test.mjs`, `node tests/catalog-test.cjs`.

## Stills (`walls/`)

- `r2final-contact.jpg`: all five stages × afternoon/night at the wide camera. **Look at this first.**
- `r2final-<stage>-house-{afternoon,night}-over.jpg`: the full-size frames.
- `r2-<stage>-house-afternoon-{bedwall,door}.jpg`: bed-wall and door close-ups.
- `r3-*`: moiré confirmation, the elementary mural with its stickers, and the teen poster wall at
  evening under the neon.

## Honest read

- **Strong at the wide camera:**
  - early tree mural (at night the projector stars land in its branches)
  - elementary space mural with its glow stickers
  - preteen arch with the swag
  - teen poster wall under the violet cove and neon
  - college gallery wall with the guitar
  - the door in every stage, with its dressing changing by age
- **Weak or unverified:**
  - Faint dotted lines at head height on the window wall (see above).
  - The preteen arch's lower dado band is mostly hidden by the headboard.
  - The college gallery reads small at the wide camera.
  - The elementary mural is a rectangle with a wobbly edge; a shaped silhouette would read more
    painted.
  - The apartment has no door (no room for one).
  - Only house size was rendered; the other sizes were checked by the test and the wall map. Morning
    and party were not rendered.
  - The left-wall pieces are not visible in the review camera; only a bed-wall close-up shows them.

## Push further

- Paint the elementary mural as a shaped silhouette (a planet-edge curve).
- Give the toddler mural the profile-specific foreground on the far hills (market stalls, bridge,
  books) at a larger scale.
- A teen skateboard deck on the wall (dresser idea): wall-mounted, my side.
- Have lighting light the door's under-gap glow as a real wedge in every stage at night.
