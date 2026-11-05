# Child room, round 1: art-director review (2026-11-05)

Reviewer: independent art director, not one of the four specialists. I changed no code.
State reviewed: commit `a1f101e` (the working tree was clean apart from my `review/` folder).
House size only. Desk sizes as the review page uses them: 48x30 for early, primary and preteen; 60x30 for teen and college.

Stills are in `review/`:
- 20 wide shots: `<stage>-house-<morning|afternoon|evening|night>.jpg`.
- `contact-20.jpg`: rows are the stages, columns are the four phases. **Look at this first.**
- 18 close-ups: `*-rearwall`, `*-floor`, `*-bedwall`, `*-deskwall`, `*-window`, `*-rightwall`.
- `diag/`: defect crops and on/off isolation tests.

The harness is `/tmp/claude-1000/-home-ergo-ErgoFlex-Desk-Stack-Polish-Features/d7558b4f-5632-4cb5-a70c-758e44afe9b1/scratchpad/review/rv.mjs`. It loads one stage per flock job and takes about 15 s per still. Close-up cameras are defined in room-local mm from `roomLayout`, in `views.js` next to it.

## Verdict in one paragraph

Round 1 is a real step up from the 11-04 baseline, which was an empty showroom. Every room now has evidence of a person:
- the elementary pinboard
- the teen gig posters and electric guitar
- the college whiteboard and string lights
- the preteen fairy-light swag
- the toddler's open toy chest

Lighting gives each stage a different evening. **But at the wide promo camera, all five rooms still read as the same room re-skinned.** The contact sheet shows the same layout in every stage:
- the bed on the left wall under an accent rectangle with one centred poster and a round "moon" disc
- the face-out picture-book rack and a floor cushion across the foreground
- the same low cabinet on the right wall
- the same two framed prints left of the desk
- (three stages) the same hoodie and backpack on two hooks under the same poster trio

Most of what the specialists added is small, and much of it sits in the far corner behind the desk uprights, where the camera cannot see it. The best new content only pays off in close-ups. Round 2 must change the silhouette and the big surfaces of each room, not add more A4 paper.

---

## Early years (toddler)

Stills: `early-house-*.jpg`, plus `-rearwall`, `-floor`, `-bedwall` (afternoon and night) and `-window`.

**(a) What works**
- The open toy chest (ball, block and bear peeking over the rim) and the pyjamas on the bed in the morning read as a toddler's morning.
- The gingham quilt, scalloped rug, cubby with rainbow stacker and window clings are on-brief.
- The crayon drawings (family, house, rainbow, hand prints) are charming close up. The taped corners are right.
- The star projector's bokeh over the sleeping bay at night is the most atmospheric thing in the room (`early-house-night-bedwall.jpg`).

**(b) Improvements, ranked**
1. **[walls] Make the rear wall the toddler's.** The upper rear wall is a pale, bland sunset band with tiny bunting. Replace it with a big hand-painted mural, 2.5 m wide and 1.2 m tall, above the dado: a tree with a swing, or a moon over hills that the projector stars "land" on at night. Then add a toddler-height scribble zone. Show 10 to 15 drawings, not 4, at 500 to 900 mm, overlapping, some of them A3, plus one crayon scribble straight on the paint that someone tried to wash off. Says: this kid draws on everything, and the parents gave up and framed it.
2. **[dresser] Clear the bed-foot pile-up.** The pretend market (awning and "sausage" boards), the toy chest and the story rack stack into one wall in front of the bed (`diag/early-bedfoot-crop.jpg`). At the wide angle you cannot read the bed. Move the toy chest to the play-mat edge or the right wall, so the market and the bed each get their own silhouette.
3. **[dresser] Give the soft toys real mass.** The bears are 150 mm dots. Add one oversized plush (a 500 to 600 mm bear or bunny) slumped in the reading nook or on the bed, plus a play tent or teepee by the cubbies. Toddler rooms are defined by things scaled for a giant baby.
4. **[dresser] Fix the rocking horse.** It is a white block on rockers that reads as a sawhorse. Give it a carved head, ears, a yarn mane and a painted saddle. It is right beside the window and very visible.
5. **[walls] Make the raincoat peg rail visible.** The raincoat is a yellow sliver behind the left desk upright and reads as a sign (`early-house-afternoon-window.jpg`). Move it to the right wall by the growth chart, at 900 mm, with the crown and a tiny pair of wellies under it on the floor (wellies from the dresser).
6. **[materials] Make the floor feel walked on by a toddler.** The limed boards are clean and cream, close to the wall colour, so the room floats. Darken or warm the boards one step, and make the toy-car tracks and crayon marks big enough to read at the wide angle. Add a stain on the rug under the play table.
7. **[lighting] Pull the projector stars down into the room at night.** They currently cluster on the upper-left wall, and with the ceiling cut away we lose them. Spread them across the rear and right walls down to bed height, with crisper star shapes (not round bokeh), and add a faint cool moonlight slash through the blind on the floor.

**(c) Defects**
- **Grid moiré on the upper rear wall in the wide shot** (morning and afternoon): a woven screen-door pattern from about 300 mm above the dado up (`diag/early-rear-wall-grid-toggles.jpg`). I isolated it:
  - It is NOT the new plaster stipple bump, NOT the sun shadow map and NOT any transparent decal. Each was turned off and the pattern stayed.
  - It does not appear in the close-up, so it is a minified fine-pattern texture: most likely the existing mural or painted-wall canvas without mipmaps or anisotropy.
  - The early curtains show the same aliasing.
  - Owner: walls (mural), with materials (curtain print).
- **Hot spot at night:** the authored "moon" disc light makes a blown orange halo on the rear wall behind the crescent (`early-house-night-bedwall.jpg`). It reads like a fire, not a nightlight. [lighting]
- **Kicked-down duvet:** a pale blue blob that reads as a puddle on the quilt (morning). [dresser/materials]
- **Night sleeping bear:** reads as an amorphous lump at the wide and the close camera. [dresser]

---

## Elementary (about 8)

Stills: `primary-house-*.jpg`, plus `-deskwall`, `-bedwall` and `-night-rightwall`.

**(a) What works**
- The cork pinboard is the best wall object of the round close up: STAR READER, class photo, rocket drawing, rosette and library card (`primary-house-afternoon-deskwall.jpg`).
- The jobs chart, medals on a hook, scooter and football, comic face-down on the quilt, and the striped kilim rug all work.
- At night the glow planets read immediately and are a genuine mood beat.
- Honey oak and the patchwork quilt give this room its own warmth.

**(b) Improvements, ranked**
1. **[walls] One loud obsession, wall-sized.** The 8-year-old has eight small things on the walls and no passion. Pick one, for example space, since the rocket, planets and "TO MARS!" are already here. Paint a 2 m solar-system mural, or a world-map mural with pins, across the upper rear wall, replacing the two small framed prints. Make the glow planets part of it so day and night tell the same story. Says: this kid is obsessed and the parents leaned in.
2. **[dresser] Build a collection display that reads at the wide angle.** The rock collection and trophies are cabinet-top crumbs. Use a 1 m shelf of jars, dinosaurs or a LEGO build, or a bug-hotel terrarium on the cabinet, at a size the camera can count.
3. **[dresser] Make the bed say "eight".** It is the same low platform used for the preteen and teen. Use a captain's bed with drawers, or a cabin bed with a little ladder, or at least a fort: a blanket draped from the headboard to a chair. Add a big plush and a sleeping bag.
4. **[lighting] The hall-door wedge at night has no door.** It is a bright trapezoid on the front-right floor at the cut edge and reads as a light leak (`diag/primary-night-hall-wedge-crop.jpg`). Either the walls owner adds a door jamb or reveal at the front edge, or move the wedge so it clearly enters past a jamb shadow. Otherwise cut it.
5. **[lighting] Fix the sourceless glow on the right wall.** The evening and night cabinet-lamp scallop has no lamp under it (`primary-house-night-rightwall.jpg`: glow above the cabinet, no lamp on the cabinet). Add a small lamp, or drop the scallop.
6. **[materials] Contrast between floor, furniture and walls.** Honey floor, honey furniture, mustard panel and cream walls all sit in one value band. Push the floor a touch redder or darker, or make the cabinets painted, so the silhouette separates.
7. **[walls] Glow planets by day.** They currently read as pale polka-dot stains on the upper wall. Either make them sticker-coloured by day (a real child would have the bright plastic ones) or hide them by day.

**(c) Defects**
- Tape-remnant rectangles and "ball mark" circles (the round bubbles on the teal dado) read as random decals, not wear (`primary-house-afternoon-deskwall.jpg`). [materials]
- The day-state "moon" practical is a white semicircle sitting on the dado rail. It reads like a hole in the wall. [lighting]
- The morning and afternoon wide shots are almost indistinguishable: only the props on the rug and bed change. [lighting]

---

## Preteen (about 12)

Stills: `preteen-house-*.jpg`, plus `-deskwall`, `-evening-bedwall` and `-floor`.

**(a) What works**
- The fairy-light swag with clipped photos over the bed is lovely at evening (`preteen-house-evening-bedwall.jpg`). It is the right object for this age.
- The rolling craft cart, the hoodie and backpack on hooks, the monitor on the desk, and the clay and denim palette all fit.
- The cabinet lamp pool on the right wall at night is a real, motivated practical.

**(b) Improvements, ranked**
1. **[materials] The floor is the worst surface in the whole set.** The pale blue-grey painted boards, with "worn back to timber" orange lines on every board edge, read as a bathroom tile with orange grout. There is also an orange scrape smear at the front-right (`diag/preteen-floor-crop.jpg`, `preteen-house-afternoon-floor.jpg`). Fix:
   - Warm oak or a warm-grey paint.
   - Wear only on the walking lanes, never outlining every board.
   - Remove the board-edge outline completely.
2. **[materials] Re-do the Beni rug.** It reads as a second tiled floor: a hard dark lattice on cream next to tiled-looking boards. Thin and soften the lattice lines, add irregular hand-knotted wobble and some shag shading, or swap to a round rug or a faux-sheepskin to break all the rectangles.
3. **[walls] Make the painted twin peaks a full-height statement.** They are 600 mm triangles in the far corner, half behind the monitor and uprights, so they are invisible at the wide angle. Paint a mountain or arch colour-block that runs behind the bed or across the whole upper rear wall from bed to desk, with the polaroid grid above it at three times the size.
4. **[walls] Clear the tape and pins left over from removed posters.** Floating washi-tape pieces and grey thumbtack dots sit on top of the mural with nothing attached (`preteen-house-afternoon-deskwall.jpg`). This is the materials "poster ghost and Blu-Tack" atlas colliding with the walls' mural. Materials must read `root.userData.childWallLife.rects` and stay out of them. [materials]
5. **[dresser] The beanbag reads as two terracotta buns.** Model one slouched beanbag with a crease and a dent where someone sits. Put the skateboard leaning against it where it is visible, not hidden.
6. **[dresser] Show the "outgrowing toys" moment.** The rabbit is on the cabinet. Add the shoebox of old toys half-pushed under the bed, a phone ring light, a vanity mirror with stickers, and a friendship-bracelet board. One object on the floor that says "I'm not a kid" (a mirror, a speaker).
7. **[lighting] Give preteen night its dreamy colour.** It currently reads only as dark warm. The brief promises rose and lilac: a lilac LED strip or a projector moon on the ceiling edge.

**(c) Defects**
- The dado "touch-up patch" is a flat grey square on the navy dado, in two places. It reads as a missing texture (`preteen-house-afternoon-deskwall.jpg`, `preteen-house-evening-bedwall.jpg`). [materials]
- The moon-disc hot spot sits under the fairy lights: two competing light sources at the bed head. [lighting]
- Night crush is 5%: the bed and rack go to mud. [lighting]

---

## High school (about 16)

Stills: `teen-house-*.jpg`, plus `-deskwall` (afternoon and evening) and `-bedwall`.

**(a) What works**
- The gig posters are the best original art of the round: Moth & Meridian, Saturday Satellites, Sound/Form, the quiet hours, a torn corner, stubs and a set list (`teen-house-afternoon-deskwall.jpg`).
- The electric guitar on its stand with the practice amp reads at the wide angle. So do the overflowing hamper, the record crate on the rug and the smoked oak floor with the indigo arc rug.
- The violet LED cove at evening is the only moment in the set where a room changes character by light alone.

**(b) Improvements, ranked**
1. **[walls] Explode the poster wall.** It is a tidy 900 mm cluster in the corner, half behind the desk uprights. A 16-year-old's wall is wall-to-wall: carry the gig posters across the whole upper rear wall and over the bed, overlapping, at angles, with 20 to 30 sheets including album sleeves. Make it the room's identity at the wide angle. This replaces the orange accent rectangle and the two framed prints.
2. **[lighting] Make the LED cove and neon read at the wide angle.** The cove is a short violet smear on one wall. Run the cove along both visible walls and behind the bed headboard. Double the neon's scale, about 600 mm, and put it over the bed, not lost in the poster cluster.
3. **[dresser] The bed must be a teenager's.** It is the same low platform as the preteen's. Use a double bed, a duvet half on the floor, a hoodie and a phone glow on it at night, and a charger cable. Add a messy pile by the bed and sneakers in a line along the wall (sneaker culture).
4. **[lighting] Teen night is 13% crushed.** It is unreadable apart from two lamps. Add a cool streetlight slash through the blind across the floor and bed, plus a monitor or phone standby glow. The night should be moody, not empty.
5. **[walls] Rescue the acoustic guitar from the corner.** It is wedged between the curtain and the desk upright, half-hidden at the wide angle. Hang it over the bed or on the left wall instead. Move the exam timetable from behind the monitor (walls already noted it) to the side of the desk at eye height.
6. **[dresser] Add one object that tells a story.** Track spikes on a nail with a race bib (the XC pennant is there but small), a skateboard deck on the wall, or a wall-mounted bike. Teens show off.
7. **[materials] Lift the putty grey walls.** The upper walls are big, flat and cold grey, so the room reads as a waiting room by day. Use a deep accent colour on one full wall (bottle green or ink), or make the poster wall cover it.

**(c) Defects**
- **Hard-edged pink rectangles around the neon and over "the quiet hours" poster at evening** (`teen-house-evening-deskwall.jpg`). The additive glow decal's quad edge is visible where it overlaps the posters. [lighting]
- **Dotted sparkle lines across the right (window) wall** at about sill and head height, in every stage, but most visible on the grey teen wall (`diag/teen-right-wall-dotted-seams-toggles.jpg`). Shadows off and transparent decals off do not remove them. They look like T-junction cracks between wall segments around the window opening, so they are probably in the baseline shell. [walls]
- The exam notes are behind the monitor (walls flagged this themselves).

---

## College (home between terms)

Stills: `college-house-*.jpg`, plus `-bedwall` (afternoon and night) and `-window` (afternoon and evening).

**(a) What works**
- This is the most convincing room. The whiteboard (THESIS, diagram, ticks) and the October calendar are excellent close up.
- The string lights with pegged photos glow at evening and night: lighting said they were unlit, but in the combined state they are lit.
- Also good: the picture ledge with the trailing plant, the big floor plant, the mini fridge with kettle and mugs, the yoga mat in the morning, the laptop on the bed, and the petrol linen.
- The window at evening (city with lit windows) is the best window in the set (`college-house-evening-window.jpg`).

**(b) Improvements, ranked**
1. **[dresser] Give the books and life a wall of their own.** A college student's room is defined by books and stuff from a life elsewhere. Add a full-height bookcase or plank-and-brick shelf on the right wall in place of the low cabinet, overstuffed, with a record player, and a weekend duffel spilling on the floor. Says: grown up, came home, the old room is now too small.
2. **[walls] Re-compose the bed wall.** The swing-arm lamp sits on a brown accent rectangle with one centred poster, the same template as three other stages. Remove the panel: a big unframed textile or tapestry, or a 3x3 gallery grid of mixed frames above the bed. Keep the ledge.
3. **[lighting] Remove the duplicate practical.** At night the swing-arm lamp AND the old moon disc both glow at the bed head, side by side (`college-house-night-bedwall.jpg`). Kill the disc for college; the swing-arm is the bedtime practical.
4. **[dresser] Fix two misreads.** The laundry basket reads as a cardboard box (make it wicker with folded clothes showing). The mini fridge reads as a white safe (add a door gap, a handle, a sticker and magnets).
5. **[walls] Rescue the guitar.** It is wedged behind the desk upright in the window corner again. It is invisible at the wide angle and duplicates the teen layout exactly.
6. **[materials] Make the linen look like linen.** The duvet reads as fine stripes, not washed crinkle. Increase the crinkle scale, and drape the duvet off the bed edge with a soft fold.
7. **[lighting] Separate morning from afternoon.** In the morning, raise the blind and add a low raking cool sun across the floor and bed with long shadows. Both phases currently look the same.

**(c) Defects**
- The skyline buildings are flat grey blocks with a fine dot texture that aliases at the wide angle. [lighting]
- Same hot-spot issue at night as above. [lighting]
- Night crush is 8%. [lighting]

---

## Cross-stage

**Do the five rooms read as five distinct people?** Close up, mostly yes: the content written into the textures is specific and charming, and the Noa and Pepper thread is a good idea. At the wide camera, which is what the promo and demo use, **no**. See `contact-20.jpg`: cover the colours and the five rows are the same room. These elements repeat:

| Repeated element | Stages | Fix (owner) |
|---|---|---|
| Accent rectangle over the bed, one centred poster, round "moon" disc on the dado | all 5 (`personality-bed-paint`, `moon-light`) | A different bed-wall composition per stage (walls). Disc only for early and primary (lighting). |
| Two small framed prints left of the desk (`personality-rear-gallery`) | primary, preteen, teen, college | Replace with the stage statement piece (walls). |
| Poster trio, hoodie hook and backpack hook at the same spot on the right wall (`personality-right-gallery`, `personality-hooks`, `personality-jumper`) | preteen, teen, college (the same 5-circles poster recoloured) | A different right-wall story per stage (walls); hooks only for primary and preteen (dresser). |
| Face-out picture-book rack and floor cushion in the foreground (`story-rack`, `reading-nook`) | all 5 | Keep the IDs and re-dress: a crate of vinyl for teen, a plank bookcase or plant stand for college, a bean-bag reading corner for preteen (dresser). A 16-year-old does not own a face-out picture-book rack. |
| Left-wall project board (`growth-project-board-*`) | 4 stages | Cut for teen and college, or make it a cork wall for teen (walls). |
| The same low platform bed | primary, preteen, teen, college | Per-stage frames (dresser; needs a Polish decision because it touches a stable furniture ID). |
| Guitar wedged in the window corner | teen, college | Move it (walls). |
| Morning equals afternoon light | all 5 | Morning gets low raking sun and a different blind position (lighting). |

**The single biggest "wow":** turn the **bed wall**, the largest and most camera-facing surface in every shot, into a floor-to-ceiling, stage-specific statement, and light it as the hero at night:
- toddler: a painted tree and moon mural that catches the projector stars
- elementary: a space or world-map mural with the glow planets in it
- preteen: a painted arch, fairy-light canopy and photo wall
- teen: a wall-to-wall gig-poster collage with neon and a violet cove
- college: a gallery or tapestry wall with string lights

Today that wall is the same coloured rectangle five times. This change alone would make the contact sheet read as five people. Owner: walls, with lighting for the night hero light and materials for the paint colour.

**Cut:**
- the moon disc in the preteen, teen and college rooms
- the hall-door wedge (unless a jamb is built)
- the materials tape and pin ghosts that land on other people's art
- the board-edge timber lines on the preteen floor
- the dado touch-up squares
- the polka-dot day-state glow planets
- the duplicate right-wall hook and poster cluster in teen and college
- the picture-book rack styling in the older stages

Also stop putting new wall content in the far corner behind the desk uprights: three of the four specialists' best pieces went there, and the wide camera cannot see it.

## Routing summary for round 2 (parallel)

- **walls**:
  - bed-wall statement per stage (the wow)
  - re-compose `personality-rear-gallery`, `personality-right-gallery` and the project board per stage
  - toddler mural and scribble zone (10 to 15 drawings)
  - elementary space or map mural with the glow planets in it
  - preteen full-height peaks or arch
  - teen poster explosion
  - college gallery or tapestry
  - raincoat rail moved
  - guitars out of the corner
  - teen exam notes moved
  - wall-segment seam cracks
  - early mural moiré (mipmaps or anisotropy)
- **dresser**:
  - early bed-foot pile-up
  - oversized plush and teepee
  - rocking horse
  - elementary collection shelf and fort or cabin bed
  - preteen beanbag, "outgrowing" props and visible skateboard
  - teen double bed, sneakers and a show-off object
  - college bookcase, wicker basket and mini-fridge detail
  - re-dress `story-rack` and `reading-nook` per stage
  - per-stage bed frames (ask Polish first)
- **lighting**:
  - moon-disc hot spot (lower it, or remove it for the older stages)
  - hall wedge with no door
  - elementary lamp scallop with no lamp
  - teen neon decal rectangles
  - teen cove and neon scale
  - night crush in teen, college and preteen (streetlight or moon slash, standby glow)
  - morning differs from afternoon
  - projector stars spread lower
  - skyline aliasing
- **materials**:
  - preteen floor (remove the board outlines, warm it)
  - Beni rug
  - wall-wear decals avoid `childWallLife.rects`
  - drop the dado patch squares and odd tape and ball-mark decals
  - elementary value separation
  - teen accent wall colour
  - toddler floor tone and readable marks
  - college linen crinkle
  - early curtain print aliasing

## What I could not verify

- **Sizes and phases I did not render:** compact, spacious, premium and executive sizes, and the party / shared-time phase. The morning shots are the same "morning" phase as the other specialists'. The reading activity was not separately rendered.
- **The early rear-wall grid:** I ruled out the bump map, shadows and transparent decals, but did not find the exact texture. The mural canvas is the main suspect.
- **The dotted wall lines:** the T-junction seam cause is an inference from position. I did not inspect the geometry, and did not confirm the lines were already in the baseline. The baseline stills are 640 px and too small to tell.
- **Draw calls:** about 1,130 to 1,280 per frame in these renders (`renderer.info.render.calls`, wide camera). I did not measure the baseline, so I cannot say how much round 1 added.
- **Crayon scribble and handprints on the toddler walls:** materials lists them, but I did not see them in my rear-wall close-up. They may be on the left wall, which the review camera cuts away.
- **Desk LEDs:** not checked. I rendered with the default state only.
