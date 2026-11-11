# Child room, round 3: leftovers closed by one finisher (2026-11-05)

Base: commit `7d1f592` plus the round-3 working tree (not committed, per the brief).
Studio: :3220, iframe harness `tools/child-growth-review.html`, iframe#stage 1280x720. Every render ran under `flock /home/ergo/logs/childrooms-render.lock nice -n 19`, one stage per lock hold.
Stills are in `leftovers/`. Contact sheets are cropped wide shots.

## Item table

| # | Leftover | Result | What was done (file) |
|---|---|---|---|
| 1 | Dotted lines across the window wall | **Fixed, confirmed by render.** | **Root cause: z-fighting, not seams.** At the wide camera (near 0.01 m, about 12 m away) one depth step is about 0.6 room-mm. The window-wall shell is four boxes. Their up-facing band faces at sill height (850) and window-head height (2300) sat 1 to 1.6 mm behind the round-2 plaster skin, and won every other pixel along the wall.<br>Bisect (college, wide): hiding the four shell boxes removed both lines; moving them 6 mm back did too. Stills: `dotted-bisect-shell-hidden.png` against `dotted-before-highpass.png`.<br>Fix: every shell box steps 6 mm back behind the skin. The window trim covers the reveal edges. (`child-wall-life.mjs`)<br>The fix also exposed a round-2 bug: the "strip the bump map" loop only ever matched the lower band, because it reassigned `shell.material` mid-loop. It now covers all four boxes.<br>Confirmed on the high-pass images `dotted-after-college-highpass.png` and `dotted-after-teen-highpass.png`. |
| 2a | Lighting finds the door from the reserved space | **Fixed.** | The hall light now reads only `root.userData.childWallLife.door`. The rect fallback is gone. Primary night still shows the under-door glow (`primary-night-hall-door.jpg`). (`child-lighting-detail.mjs`) |
| 2b | College lamp shade found by its size | **Fixed.** | The dresser tags the shade material `userData.lampShade`. The bake copies the tag onto the merged mesh, and lighting finds it by that tag.<br>The reading light hangs at the shade's real centre (a baked mesh sits at its group origin).<br>Round 2's size lookup was in fact failing silently after the bake: `childLighting.readingLamp` was missing in the baseline render. It now reads `'nook side-table lamp'`, and a test asserts it. |
| 2c | Teen night about 13% near-black | **Fixed (moody kept).** | Teen night: exposure 1.20 → 1.24, hemisphere light .27 → .34, a slightly lighter fill. Crush 12.9% → 7.95%, mean luma 59 → 67, clip 0%. What is still dark is the lower bottle-green wall and the black road case. (`child-lighting-profiles.mjs`; `teen-night-before/after.jpg`) |
| 2d | Early crescent too strong at night | **Fixed.** | Moon light at night .5 → .3 (evening .7 → .55). The halo decal shrinks 900 → 760 mm and its strength goes .1 → .045 (evening .06 → .03). It now reads as a nightlight, not a fire (`early-night-before/after.jpg`). The compact room's halo is still a little warmer, because the bed is closer. |
| 2e | Giant bear stays out at night | **Fixed.** | The nook bear is now a loose belonging, out for morning, afternoon, evening and party. At night it sits on the closed toy-chest lid (inside the chest's footprint, so the floor stays clear). Seen in house, compact and premium night. (`child-lived-in-detail.mjs`) |
| 3a | Cabinet tops and framed prints repeat | **Fixed.** | Each stage's cabinet top is now its own still life (`contact-cabinet-tops.jpg`):<br>• **Early:** unchanged.<br>• **Primary:** fanned comics, a pig money box, the globe and its trophy.<br>• **Preteen:** a lidded jewellery box, a pleated blush lamp, the old rabbit and a friendship-bracelet stand.<br>• **Teen:** textbooks with a cap, a lava lamp, a sneaker box, and a leaning record sleeve ("LATE BUS HOME", invented).<br>• **College:** upright books between bookends, a ginger-jar lamp with a drum shade, a pressed-fern print (the only framed piece on any cabinet) and the plant.<br>The second trophy (teen) and the two framed prints (preteen and teen) are gone.<br>(`child-growth-detail.mjs`, `child-personality-detail.mjs`, `child-lived-in-detail.mjs`) |
| 3b | Door pushes right-wall clusters to the bed foot, behind the rack | **Fixed.** | The scooter (primary), the guitar and amp (teen) and the mini fridge with its plant (college) now try the window wall first, then the camera-side front strip, then the bed foot. In every house and compact room they land in full view at the front right. The preteen cart was already there.<br>The college fridge has its own front-strip layout: its door faces the cabinet side, with magnets, a photo, a sticker and a side postcard. Spacious and premium rooms also use the front strip. |
| 3c | College floor lamp reads as a tall pole | **Fixed.** | The 1.5 m pole is now a low lamp on a little side table beside the armchair. The top of the shade is at 905 mm.<br>Because the light is now closer to the floor, the adopted reading light runs at 45% and the floor pool is halved. Evening clip is 0.35%, against round 2's 0.32%. (`college-nook-evening.jpg`, `college-afternoon-before/after.jpg`) |
| 3d | Toddler's walker mostly hidden | **Fixed (house size and up).** | The walker moves to the open back-right of the mat, turned side-on and scaled to 0.9. It is out for morning and afternoon. At party time the railway uses the mat, and the walker is put away.<br>I tried two spots first and rejected both: front-centre (behind the pouf) and back-left (behind the book rack).<br>The compact room keeps its old spot, because no other spot was clear. I did not judge that spot's visibility on its own. |
| 3e | Wardrobe limed-oak vertical stripes | **Fixed.** | The wardrobe gets its own tall 256x1024 panel grain: finer, lower-contrast lines and no rubbed tile edges. Other furniture keeps the shared map. (`child-material-detail.mjs`; `wardrobe-before-after-teen.png`: preteen before, preteen after, teen after) |
| 3f | Teen turned-back corner lies over the throw | **Fixed.** | The throw and its stitching are lifted over the folded triangle and ease back down within 70 mm. The fold now tucks under the throw. The teen lining is a pale grey, so the corner still reads. Applies to every stage. (`teen-flap-before-after.png`, `teen-bed-after.jpg`) |
| 4 | Verification gaps | **Done, except as noted below.** | (a) Morning and party, every stage, house: `contact-house-morning-party.jpg`.<br>(b) Left-wall pieces: `contact-left-walls.jpg`. See below on the wide camera.<br>(c) Early years and high school at the spacious and premium sizes: `contact-spacious-premium.jpg`.<br>(d) Compact (apartment), all stages: `contact-compact-all.jpg`.<br>(e) Each fix after it was made: the stills above, plus `contact-house-evening-night.jpg`. |

## Things found during verification and fixed

- **The teen wall guitar was lost.** The first version of the new cabinet-top lamps (the lava lamp was 1,048 mm tall) raised the cabinet's claimed wall rectangle. The walls layer then had no room left for the guitar above the cabinet, and dropped it.
  - All cabinet-top pieces now stay under 905 mm.
  - A test asserts the cabinet-top height and that the teen and college guitars keep their walls.
  - The wall fixture list matches the baseline in all 25 layouts.
- **Too many draw calls.** The first cabinet-top build cost about +40 draws in college. It was rebuilt as single boxes.
- **Preteen evening hot corner.** The cabinet-lamp wall scallop was lowered from .09 to .065. Clip is now 0.23%, against round 2's 0.26%.

## Draw calls (WebGL calls per presentation frame, wide camera, house)

| Stage | Round 2 | Round 3 |
|---|---|---|
| Early | 1,132-1,206 | 1,133-1,205 |
| Elementary | 1,111-1,118 | 1,114-1,121 |
| Preteen | 1,175-1,194 | 1,177-1,196 |
| Teen | 1,199-1,227 | 1,201-1,229 |
| College | 1,187-1,209 | 1,194-1,215 |

At most about +6 draws. No new lights and no new shadow casters.

## Files touched

- `child-wall-life.mjs`
- `child-lighting-detail.mjs`
- `child-lighting-profiles.mjs`
- `child-lived-in-detail.mjs`
- `child-material-detail.mjs`
- `child-personality-detail.mjs`
- `child-growth-detail.mjs`
- `tests/child-room-test.mjs` (new assertions only; no bound loosened):
  - the window-wall shell sits 5 mm or more behind the skin
  - cabinet tops stay at or below 906 mm
  - the teen and college house rooms keep their guitar
  - the giant bear is off the cushion and on the chest at night
  - the college shade is tagged and adopted, and is under 1 m

## Tests

All four gates are green on the final tree:

- `npm run test:environment-finishes`
- `node tests/scene-desk-data-test.mjs`
- `node tests/child-screens-test.mjs`
- `node tests/catalog-test.cjs`

## Honest gaps

- **The left wall is not visible at the wide camera.** The cutaway removes it. The left-wall pieces were checked only with a dedicated left-wall camera.
- **Thin dashes on the door slab.** The door's thin panel mouldings (14 mm) still render as short dashes at the wide camera. They are real geometry, not the wall bug, and I left them.
- **The college mini fridge is still a small white block at the wide camera.** Its magnets read only up close.
- **Compact walker.** The early compact room keeps its original walker spot, and I did not judge that spot on its own.
- **Not rendered:**
  - the executive size
  - spacious and premium sizes for elementary
  - spacious size for college; premium size for preteen
  - evening and party at any size other than house
- **First-shot race in the harness.** The first shot after a fresh page load can come out in the page's default (afternoon) state. One early-morning still did; it was re-rendered as a non-first shot (`r5`), and the morning stills used here are good.
