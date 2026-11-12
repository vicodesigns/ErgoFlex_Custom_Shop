# Humboldt-inspired Library commons — 15 October 2026

A sixth Library layout, **Humboldt-inspired commons** (`?room=library&layout=humboldt`),
recreates the ground-floor commons of Cal Poly Humboldt Library from the owner's
reference photos. The owner's ErgoFlex desk stands at the spot they marked:
against the right wall, just left of the long tackboard, where the red armchair
was. It is inspired by the space, not a survey. The pilot signage identifies it as a proposed concept, rather than an installed university program.

Built from three expert specs (architecture, lighting design, materials), then
reviewed by an independent expert. Code: `library-humboldt-commons.mjs`.

## Space (mm, room-local)

Rebuilt the evening of 15 October 2026 from the owner's feedback. They wrote
that the space is "more narrow", to "make it longer for the white sculptures",
and that "the canoe is in between the two". It is now one long, narrow
building instead of a wide box.

- **Commons, 13 400 wide**, z −7 000 to 5 000, charcoal carpet tile.
  - The right (desk) wall stays at x +9 000, so the desk bay keeps its place.
  - The left wall moved in to x −4 400, about 8 ft beyond the furniture the
    owner arranged on that side. That arrangement was measured from their
    screenshot with a camera solve against the pilot inset, the wall corners
    and the prints. The default tables keep about 2.3 m clear of that wall.
- **Junction**, z 5 000 to 12 000, on beige broadloom.
  - The canoe stands on a 1 400 × 420 × 6 000 plinth parallel to the olive
    wall. The hull is 5.2 m long with a 1 m beam.
  - Glass runs along the right side, and the mezzanine sits overhead
    (z −3 000 to 12 000), with a honey-oak fascia band.
- **Figure hall**, to z 28 000.
  - It is narrower, 10.4 m: the glass steps in to x 6 000 at z 9 000 behind a
    white return wall and an olive corner column. This follows the Humboldt
    expert's reading of photo 2 (about a 1:4 tunnel).
  - Eight bleached-wood figures stand on five plinths along the white wall:
    one seated, a pair, one standing, one seated, and a triad.
  - Café tables run along a silver-aluminium curtain wall under a 3 m
    acoustic-tile soffit, with two two-seat tables out in the hall.
  - The end wall has a glass storefront (vestibule view pane), exit signs, and
    a lounge pair on the figure side.
- **Ceiling:** sloped over the commons (4.8 m to 7.2 m), flat down the
  junction and the hall's high zone. A white transfer beam marks the start of
  the figures. The commons band (3.6 m) and the café soffit (3 m) each meet the
  high zone with a clerestory wall and a linear grazer.
- **Shared systems:** the shell is asymmetric about x = 0. `layout.left`
  carries the left wall, and these honour it:
  - floor bounds;
  - the Groove planner;
  - desk fitting;
  - routine clamps;
  - the key-light shadow fit;
  - bounce-light patches.

  Daylight (`layout.daylight`) now enters from the +x glass.
- **Saved edits:** furniture edits are keyed by placement index. The first
  commons' prop order is kept, and new props are appended at the end.
  `room.migrateSavedTransform` pulls any saved item that now lies beyond the
  walls back onto the floor.

## The desk

- `desk: [8240, -1850]`, `deskTurn: -90`.
- The desk's long side runs along the wall. The user sits on the room side,
  facing the wall, with a task chair.
- Both 48×30 and 60×30 fit between the glass slot and the tackboard, with
  300 mm to each and a 2.5 m aisle in front.
- `positionHomeDesk` now adds `layout.deskTurn` to the desk yaw. Other layouts
  default to 0, so they are unchanged.
- Groove poses come from `layout.groovePoses`, relative to the desk; every
  routine steps back into the room (−x) and never into the wall.
  `grooveDestination` uses them before its generic rules.

## Lighting (five dayparts, `HUMBOLDT_MODES`)

- North Coast overcast by day: a soft key and a higher ambient share.
- **Evening** matches the reference photo: all frames and washers on, at
  3500 K.
- **Late study:** the second frame circuit is off, the glass is a dark mirror,
  and the desk's own wall scallop and pool stay up.
- **Commons event:** full frames, with the canoe and the figures lit.

Fixtures:
- Three suspended black frames (a 2×2 grid plus two rectangles), on two
  circuits.
- Recessed downlights in one instanced draw: two rows in the commons band,
  one can over each café table, and a circulation row.
- Washers, grazers, the hall ceiling and the tackboard wash are additive light
  pools, merged per level. Long washes use smooth one-axis ramps rather than
  radial scallops.
- **Exactly five PointLights, none casting shadows**, each with explicit
  daypart levels:
  - the desk task light (within 1.4 m of the desk);
  - the commons frame grid;
  - the figure hall and café;
  - the canoe and the first plinths;
  - the long table run (dimmed at closing).
- Figure accents come from five virtual spots in the figure material's
  shader. They cost no draws and no lights.

**VSM note.** With VSM shadows, three.js also draws shadow *receivers* into the
shadow map. So the frames, soffits, glass and trim are set to neither cast nor
receive. The shell walls are kept out of the shadow pass as well, so daylight
reads as entering through the glass rather than the 7.2 m back wall shading the
whole commons. Furniture, plinths and the canoe still cast.

## Integration

- `library-room.mjs` appends the layout to `LIBRARY_LAYOUTS` and hands
  `layout.humboldt` to `buildHumboldtCommons`. The five existing layouts are
  unchanged.
- `studio.js` uses `layout.modes` when present, so the commons has its own
  dayparts.
- `room-life.mjs` maps `layout.tier` (`'executive'`) for daily-life detail.
- **Chairs:** placements use `kenney-furniture-chair-modern-cushion`, so the
  Library's seating replacement applies. `decorateProp` gives them honey-oak
  frames and dark aubergine-charcoal pads. Conference chairs are tinted by
  `conferencePart`.

## Test

`node tests/library-humboldt-commons-test.cjs`

## Independent review pass (same day)

An independent reviewer rated the first build about 6/10 against the photos.
Every fix below was applied, except pinning the graphite side-chair family,
which lives in another session's seating module.

- **Ceiling:** a sloped white plaster ceiling (4.8 m at the back wall, rising
  to 7.2 m by z 5 000) with frame uplight on it. The glass bay is lowered to
  4.6 m to meet it.
- **Brighter dusk:** evening exposure 1.22, a lighter olive (`#7d7e68`) and
  lighter bay columns, a neutral grey floor tint (`layout.finish`), and a
  night backdrop at the commons event.
- **Canoe:** moved beside the gallery wall (x −5 000). It is deeper, with
  rounded ends, two cradles that meet the hull, a warm matte redwood finish
  and grain along the hull. The photo-match camera is eye [−6600, 1500, 11300]
  → target [1025, 1000, −442], fov 45.
- **Window view:** the campus photograph is replaced by a drawn North Coast
  view (marine-layer sky and conifers). Each pane samples it at its own
  aspect.
- **Dayparts:**
  - real daylight pools by day;
  - darker late study;
  - brighter event, with the canoe and figure light (L4) moved to reach them;
  - a gallery track with four heads.
- **Frames:** matte black, with only a narrow, dim down lens.
- **Figures:** angular abstract figures (standing and seated) on taller
  plinths.
- **Desk:**
  - nudged to z −1 850, under the red dot;
  - task light moved back from the wall, with a softer wall scallop;
  - `room-life.mjs` turns the chair's routine offsets by `deskTurn`, so the
    chair pulls back from the desk instead of sliding along the wall.
- **Finishes and safety:**
  - tackboard: evenly lit tan, raised 150 mm, honey-oak trim;
  - neutral warm-grey carpet tile;
  - uniform broadloom;
  - dark upholstered chair backs;
  - mezzanine guard infill at 100 mm.

## Focused pilot pass · 15 October 2026

- The marked right-wall bay now has a **3.2 × 2.7 m flush forest-green inset**,
  a fine brass border and floor lettering. The wall header reads “Flexible study /
  ErgoFlex · proposed pilot”. There is no floor-standing sign in the pullback zone.
- A framed welcome/activity notice and a smaller materials-study card use the
  existing tackboard. Five distinct notices explain the selected activity.
- Seven tables gain editable, table-attached study kits: stacked bound books,
  paper edges, handwritten line work, pencils and a ceramic project-table pot.
  Active papers clear at closing. Three café tables gain small ceramic mugs and reading booklets; mugs also clear at closing. Original fixture/prop identities stay stable.
- Carpet and broadloom now have subtle fibre bump detail. Forest, brass, honey
  oak, matte charcoal and warm ceramic finishes tie the pilot to the room.
- **Opening / stand:** 43.5 inches, level; a small move out from the wall.
- **Research / sit:** 28 inches, level; close to the home bay.
- **Dusk / reading:** 32 inches, 8° tilt; in the wall bay, with its task chair nearby.
- **Closing / storage:** 43 inches, 65° tilt; wall-facing, in the original bay;
  the secondary frame circuit dims, with lower task-light output.
- **Commons event:** 43.5 inches, level; rolls diagonally 2.74 m out and 2 m along the bay, then turns 23° for a
  shared demonstration, while the gallery receives warmer accent light.
- The existing “Inside room” camera now looks closely at this pilot bay.
- User-saved Groove poses continue to take priority. Choosing a time changes the
  atmosphere and activity notice; **Start Groove** executes the physical move.

Verification: `node tests/library-humboldt-commons-test.cjs` checks both
48/60-inch builds, ten daypart setups, 50 ordered pose routes, changing notice
artwork, synchronized table kits, shell/fixture shadow flags, five practical
lights, missing assets, and actual closing motion to 65°. The browser-reviewed pilot view is saved in
`scene-shots/humboldt-pilot-browser-20261015.png`.

## Expert pass: architecture, student life, lighting, materials, critique (15 October 2026, evening)

Four expert specs were implemented, then an independent critic reviewed the
result. The specs are kept outside the repo; the summary follows.

- **Humboldt place:**
  - A North Coast Journal walking tour of the library art describes the white
    figures as larger-than-life bleached-redwood statues, seated, in pairs and
    in triads. They are now tall, carved-block forms in bone white with a
    faint grain and seasoning checks.
  - The window view is marine-layer fog, layered conifers, redwood trunks, a
    damp lawn and a path, offset per glass run.
- **Student life** (`library-humboldt-life.mjs`):
  - one shared atlas material, about 22 visible draws at the afternoon peak;
  - laptops with lit screens, chargers to power modules, open books, bottles
    and cups, table tents;
  - bags on floors and seats, jackets over chair backs;
  - whiteboard writing, 13 tackboard flyers, a returns cart that fills through
    the day;
  - a recycling station and magazine rack on the junction return wall;
  - a party welcome table and easel, and a wet-floor sign at closing.
  - `room-life.mjs` adds Humboldt-gated chair states (tucked, free, used,
    stepped-away, turned to the event).
- **Lighting:**
  - ramp-pool grazers on both clerestories (the hall grazer previously sat
    behind its wall);
  - a hall-ceiling uplight from the aisle pendant;
  - figure accents from five virtual spots in the figure material only (no
    draws, no lights);
  - evening glass with reflections instead of black;
  - per-light daypart levels, with the five PointLights re-placed: desk,
    commons, hall, canoe, long table;
  - café cans aligned over the tables at 3000 K;
  - warm event uplights on the olive columns; night reduced to work light.
- **Materials:**
  - world-locked plaster with roller laps (refine's `uv1`);
  - taupe broadloom with heather;
  - cooler random-course carpet tile at a 3 m period;
  - olive eggshell, silver aluminium, matte powder-coat frames;
  - an oiled canoe with scattered adze facets and a gunwale rim;
  - stave maple tops; a real 24 mm ceiling grid;
  - multiply wear decals (traffic lanes, walk-off, base grime).
- **Critic fixes applied:**
  - saved-edit index order and an out-of-bounds pull-in;
  - the default 8 ft gallery-side clearance;
  - a full-height hall wall above the café soffit (no hole from a raised
    camera);
  - softer, offset window trees;
  - carved figures and a lower party accent;
  - a calmer night;
  - lighter wall reveals and softer broadloom fleck.
- **Not done:** sword ferns. There is no fern asset; the planters use the
  existing plant props.


## Seating and reading detail — 23 October 2026

The Commons now uses a dedicated family of 64 oak study chairs with curved,
upholstered backs, padded seats, tapered timber legs and graphite glides. Forest,
lichen, oat and clay fabrics distinguish the shared study and café areas. Four
shared geometry batches keep this upgrade economical. Existing placement keys
remain unchanged, so moved, scaled and hidden chairs keep their identities.

Café tables have warm timber tops with rounded edges and a weighted bronze
pedestal, clearing leg space. The second café group and one square study group
have more separation. Chair activity poses have smaller, reversible pull-outs
and turns; all five activities are checked for chair-to-chair intersections.
Only exact old position/rotation defaults migrate to the revised floorplan.

Twelve cordless table lamps and five small stoneware greenery vases dress the
existing tables. The lamps have warm lenses and subtle tabletop pools, with
stronger reading light at dusk and subdued closing light. No extra point lights
or shadow maps are added. Closing ambient and hall illumination remain readable
for the cleaning routine. The new objects are editable children of their tables.

Checks: `tests/humboldt-seating-detail-test.cjs`,
`tests/humboldt-furniture-migration-test.mjs`,
`tests/library-humboldt-commons-test.cjs`, and
`tests/humboldt-group-study-test.cjs`. Visual review uses the authored desk
positions, including the shared table for afternoon research and project work.

Verified 24 October: all seating and access checks passed on both widths;
the complete closing movement reached 65° after the setup checks. Fifteen
review views cover all five activities with no browser errors or missing props.
Results are in `scene-shots/humboldt-seating-20261024/`.

## Sun and night circuit (environment push, 10 November 2026)

- Afternoon and evening sun through the junction and hall curtain walls: each pane
  between mullions, transoms and the sill heater is projected along the room's own
  key-light direction (`DAY_ANGLES` in `room-refinement.mjs`), with the hall
  columns' shadows cut out. A short near-white patch in the afternoon; long golden
  bars across the café and up the gallery wall at dusk. Morning stays overcast.
  Two overlays (floor and gallery wall), redrawn on a daypart change.
- Closing (night) runs on a night circuit: most downlights and track heads off,
  wall scallops low, the three table task lamps on, less ambient and bounce; the
  custodian's cart and mop bucket stand behind the wet-floor sign.
- Evening has less ambient and bounce so the frames and task lights carry the room.

## Architecture pass: receded bays (11 November 2026)

The owner's note: the real walls are not flat planes; "the place where the demo unit
is, is receded, like 5 feet", and the wall behind the canoe steps too. Read from the
three reference photos and built by evolution: the desk, the tackboard, the glass
slot, the film cameras and every saved furniture key keep their places; the walls
around them moved.

- **The tackboard bay is set back 1.5 m.** In photo 3 the far, scalloped end of the
  right wall and the tackboard wall do not share a plane (their wall-top and base
  lines miss each other by about 17 % of the distance), and the olive pier between
  them shows a side face wider than its front. So the far end of the right wall
  (z −7000 to −5100) now stands proud at **x 7500** (`PROUD_X`), solid to the soffit,
  with a full-height dark glazed door (z −6160 to −5150, lever by the pier) and the
  olive pier as a 500 mm wide fin running the full 1.5 m back to the glass
  (`FIN_Z` −5100 to −4600). The bay itself (glass slot, desk place, tackboard) stays
  at x 9000. The glass slot is now one lite, z −4600 to −3200, with a transom at 950. The pier
  stops at z −4600 so the spare task chair's park (8500, −4200), which the film's chair
  position is measured from, stays clear of it.
- **The pier at the junction end of the bay** (z 3400 to 4000) is 900 deep (was 450).
- **Moved with the wall:** the wheelchair's default park is (6500, −6550), same turn (the
  old spot is inside the proud wall; its place at the group table is unchanged); the
  outer downlight row steps in to x 6900 beside the proud wall; the back wall's right
  scallop moved to x 6200. `migrateSavedTransform` pulls a saved item out of the proud
  wall (z < −4600, x > 7150).
- **The balcony overhangs the canoe wall by 600 mm** on a white 300 mm edge beam
  (photo 2: the wood fascia and a white downstand stand in front of the olive wall).
  Fascia, guard and floor moved out with it; the guard returns to the wall at both
  ends. The olive wall's face did not move (the saved pictures hang on it).
- **Olive piers carry the edge beam:** the two along the commons are 560 deep (were
  300), and a new 300 mm wide pier stands where the olive wall meets the white figure
  wall (z 11700 to 12000), proud of it, with a return face toward the hall.
- **Two short bronze datum rails** (950 and 2100, 1.5 m long, at the hall end)
  replace the full-length reveals on the olive wall; the canoe track hangs under the
  edge beam.
- **Not built, for the owner to choose:** in photo 2 the olive wall is frontal to the
  camera while the figure wall recedes, so in the real building the figure hall
  leaves the junction at 90° (an L-shaped plan with an outside corner at the canoe
  wall). The build stays linear, as asked for on 15 October.
