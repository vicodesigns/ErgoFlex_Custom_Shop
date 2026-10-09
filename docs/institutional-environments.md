# Public service, education, clinical and technical environments

Open `index.html?room=security&view=room`. The **Scenes** picker groups the
collection into Product & lifestyle, Public service, Educational, and Clinical &
technical. **Educational** is one environment button. Its **School stage**
selector progresses through Kindergarten, Elementary school, Middle school,
High school, College classroom, and University classroom. **Government** and
**Healthcare** also have one environment button each, with a setting selector
inside the room controls.

## Added settings

| Group | Scene IDs / settings |
| --- | --- |
| Government | `government` Government office; `police` Police / PD; `security` Security operations (one environment, three settings) |
| Educational | `kindergarten`; `elementary`; `middleschool`; `highschool`; `college`; `university` (one environment, six stages) |
| Healthcare | `hospital` Hospital workspace; `laboratory` Science laboratory (one environment, two settings) |
| Technical | `mobileit` Mobile IT |

Public service, clinical and technical settings have three measured layouts:
Small (`apartment`), Medium (`house`), Large (`spacious`). Each step adds 1.8 m
of width and 2.2 m of depth, with additional furniture appropriate to the setting.
Use **Government setting** or **Healthcare setting** to change the workspace,
then **Room size** to choose Small, Medium or Large. Each group remembers its
last selected setting in this browser. Existing scene IDs, project files,
decor and Groove keys stay compatible. `room=publicservice` opens Government;
`room=healthcare` opens Healthcare. Older direct room URLs still select the
specified workspace (including `room=government` for Government office).

Educational uses school stages instead of a separate room-size menu:

| School stage | Room dimensions | Default desk |
| --- | --- | --- |
| Kindergarten | 6 × 7.2 m | 48-inch |
| Elementary school | 8.2 × 9.8 m | 60-inch |
| Middle school | 9 × 11 m | 60-inch |
| High school | 10 × 12 m | 60-inch |
| College classroom | 11 × 13 m | 60-inch |
| University classroom | 12 × 14 m | 60-inch |

Each stage grows the physical space and changes the teaching content and
furniture. The six existing scene IDs remain the keys for saved decor, lighting
and Grooves; an old, unavailable size falls back to that stage's authored size.
The last school stage is remembered when returning to Educational. Visitors
can still choose either desktop size.

Classrooms progress from low learning tables and child chairs through student
workstations to college and university seminar tables and presentation displays.
Public service rooms have purpose-built consoles, workstations, planning boards,
and storage. Lab benches include schematic microscope assemblies and a hood.
Hospital rooms have care beds, observation monitors, privacy screens, and a
clinical cart. Mobile IT is a field-service depot: a rack row, staging carts,
parts storage and a tech bar. Monitor graphics are generated examples, with no real operational data.

## Shared behavior

- Five named time/activity settings per scene, with daylight, window sky,
  practical lighting, screen glow, room surface detail, and desk LEDs.
- Groove routing and **Save Groove position** use the existing physical planner.
- Floor furniture can move and rotate; wall boards can move along the wall.
  Rearrange toggle, Undo/Redo, collision alerts, and shield behavior use the
  existing systems. Chairs and small carts are pushable; substantial equipment
  and cabinets remain collision obstacles.
- Scene assets have stable keys containing the scene, layout, and fixture ID.
- Room choice, size, time, decor, and saved Grooves use existing project and
  browser persistence. `presentation.institutionalRooms` records each new
  scene's selected layout and activity. Projects predating this field remain
  supported.

## Implementation

- `institutional-scenes.mjs`: scene registry, dimensions, five lighting/motion
  profiles, captions, and daily stories. No DOM or Three.js dependency.
- `institutional-room.mjs`: procedural architecture and furnishings, registered
  with the existing workspace, surface refinement, interaction, and LED systems.
- `workspace-3d.mjs` / `studio.js`: registry integration and grouped scene picker.
- `room-life.mjs` / `room-polish.mjs`: activity staging and finish/light profiles.
- `divi-editor/build-site-upload.py`: includes the institutional modules in future bundles.

Run `node tests/institutional-room-test.cjs` for all 12 scenes, 24 layouts, and
120 lighting/Groove combinations, plus asset bounds, desk sizes, interaction
registration, project round-trip, reload persistence, and mobile layout checks.
Screenshots are written to `/tmp/ef-institutional-review/`.

## Second visual pass · 8 October 2026

The institutional collection now uses authored carpet tile, natural oak, and
clinical flooring rather than flat shared surfaces. Window recesses, blinds,
skirting, upper rails, acoustic panels, clocks, and framed displays give the
shells depth. Daylight views include a campus courtyard and illuminated
buildings at night.

- Operations and PD: illustrative camera views and shift boards, dual-screen
  consoles, keyboard/mouse detail, equipment storage, and team briefing tables.
- Government: service displays, a public counter and visitor bench.
- Kindergarten and elementary: low tables, cubbies, reading shelves, alphabet
  artwork, learning materials and circle-time rugs.
- Middle and high school: city-design and energy diagrams, project materials,
  resource shelves and presentation screens.
- College and university: seminar workstations, laptop keyboards, research
  galleries and books; their colors and teaching content remain distinct.
- Laboratory: extraction hood with an open work enclosure and sash, wash
  station, sample racks, microscopes and analysis displays.
- Hospital: layered bed linen, detailed rails and footboards, pleated mobile
  privacy screens, illustrative observation displays and bedside services.
- Mobile IT: network topology displays, vented racks, patch connections,
  diagnostic carts, service tools and cable dressing.

New small details are merged into one geometry per furnishing. They travel with
that furnishing and do not create individual collision obstacles. The detailed
Steelcase task chair replaces its procedural fallback inside the existing
`mobile-desk-chair` fixture, retaining that fixture's saved scene-asset key.
Retired fallback geometry is released; its materials are disposed with the room.

Night profiles distinguish operational watch, neutral clinical task light and
warm teaching/planning spaces. Work surfaces stay legible while desk LEDs remain
visible. Daily staging also uses context-specific materials: sample tubes,
diagnostic hardware and cables, clipboards, or learning blocks.

`institutional-detail.mjs` owns generated textures, illustrative displays and
batched furnishing detail, and is included in the site upload builder.

For a complete cross-environment image review:

```sh
node tools/props/daypart-review.mjs --out /tmp/ef-environment-review
```

This reads the scene registry, captures all 27 rooms at five authored settings,
and writes a report of missing assets, light profiles, render calls and triangle
counts. `--only security,hospital` selects a smaller review. The test browser
uses isolated storage, so reviewing does not modify a user's saved project.

Verification for this pass: all 12 institutional scenes, 36 layouts and 180
lighting/Groove combinations passed the integration check, including project
restore and mobile layout. Targeted hospital and Mobile IT checks passed after
their final spacing adjustments. The cross-environment review covered all 27
rooms at five settings (135 images), with no missing props. Collision, safety,
Groove planning and project serialization checks also passed. The image-review
tool starts a fresh browser process per room to release software-renderer
resources between larger scenes.

Educational stage verification: all six fixed stage layouts passed five
lighting/Groove settings each (30 combinations), including stage selection,
desktop defaults, furnishing bounds, project restore and mobile layout.

Grouped Government and Healthcare verification covered all five settings,
remembered selection and project restoration, with three activity/Groove
presets per setting. Healthcare setting selectors passed mobile bounds checks;
the Hospital subset also completed the shared project round-trip, reload and
mobile checks. Browser tests now release renderer resources between rooms.

## Atmosphere and decoration pass — 8 October 2026

Each setting now has its own practical-light and background-wash profile, with
separate balances for early learning, primary, secondary, college, university,
public service, PD, operations, laboratory, hospital and IT. Hospital observation
and operations watch lower general illumination while retaining local task pools.
Screen emission is restrained at night. Daylight, room LED spill and the existing
lighting sliders still combine with these profiles.

One or two compact local lamps are attached to the actual planning table,
workstation, laboratory bench, IT bench or hospital bed. Their geometry and light
source follow that furnishing when rearranged. No additional floor blockers are
introduced. The five daily activity setups are also attached to their table.

New decoration includes child-scale learning bags and pegs, older students'
satchels, operations headsets, folded bedside linen, clinical supply organisers,
wall hand-hygiene supplies and framed garden, community, science and project
illustrations. Clinical rooms use organised supplies instead of the generic
storage-top books and plants. The window opening and entry remain clear.

The clock reads 09:00, 14:00, 18:00, 22:00 or 16:00 for the selected authored
activity. Planning boards, monitor captions and supported activity materials
change with that selection. These are illustrative scene props, not live data
or an assertion of clinical, educational or public-service compliance.

`root.userData.institutionalAtmosphere` exposes the selected phase, clock hour,
local-light count and activity variants for inspection. Small furnishings remain
batched, and existing scene IDs and saved furnishing keys are retained. The
module cache revision was `institutional-atmosphere-20261008` (now `institutional-sweep-20261009`, see Team structure).

Verification of this pass: all 12 settings passed the quick integration matrix
(12 layouts × 3 activities = 36 lighting/Groove combinations), furnishing bounds,
desktop defaults, interaction registration, grouped-setting recall, project
restoration and mobile control bounds. All 12 settings were rendered at all five
activities (60 images), with zero missing assets or reported shader/page errors.
The integration harness pauses continuous rendering during state and bounds
checks to reduce software-GPU contention; the separate image review renders each
view explicitly.

## Team structure · 8 October 2026

The builder is split so that one specialist team per group can work in its own
file. Refactor verified as a no-op: meshes, bounds, materials, canvas texture
content, lights, scene-asset keys and interaction entries are identical for
all 12 scenes before and after (stations aside).

| File | Owns |
| --- | --- |
| `institutional-government.mjs` | `security`, `police`, `government`: consoles, workstations, briefing table, lockers, counter, bench, boards, screens, gallery, staging |
| `institutional-education.mjs` | `kindergarten` … `university`: learning/student tables and chairs, circle rug, shelves, galleries, pegs, presentation display |
| `institutional-healthcare.mjs` | `hospital`, `laboratory`: beds, monitors, privacy screens, benches, hood, wash station, hygiene station, bed lamp |
| `institutional-it.mjs` | `mobileit`: rack row, staging carts, parts shelving / locker / cage, tool wall, depot signage and floor markings |
| `institutional-room.mjs` (shared) | shell (floor, walls, window, door, sign, planning board, ceiling, 3 room lights) and the `kit` helpers: `asset`, `table`, `chair`, `monitor`, `cabinet`, `cart`, `label`, `canvasMat`, `byId`, materials |
| `institutional-detail.mjs` (shared) | drawing/dressing helpers (`detailKit`, `books`, `notebook`, `plant`, `boardFrame/Columns/Grid/Curve`, `screenHeader/Slides/Footer`, `institutionalFloor`, `identityGallery`), shell detail, lamps, clock and board per-phase redraw |
| `institutional-scenes.mjs` (shared) | registry rows; merges each group's data |

Each group module exports (all optional except `furnish`, `drawBoard`,
`drawScreen`, `floor`):

- Data, merged by `institutional-scenes.mjs`: `SCENES`; `lighting` (per-kind
  practical/wash per phase, task/bounce colours); `sceneOverrides[id]`
  (replace any row field: `name`, `caption`, `wall`, `accent`, `dimensions`,
  `labels`, plus `boardTitle`; `modes: { night: { power: .2, … } }` merges over
  the generated mode; `layout(tier, layout)` edits a generated layout;
  `desk` / `shelf` replace the main desk's generic dressing);
  `finish(spec)` (room-polish surface profile); `stations(sceneId, layout)`.
- Builder hooks, in call order: `options(spec)` (shell knobs: trim colour,
  sign, rug, planter, board placement/name/footer, storage size, night
  background, second lamp support), `floor`, `drawBoard`, `drawScreen`,
  `furnish(kit)`, `dressProp(id, k, g, kit)`, `decorate(kit)`,
  `finishDecor(kit)`, `activityMaterials(k, phase, y, kit)`,
  `extraLamps(kit)`, `atmosphere(phase, gain, kit)`.
- Staging (`room-life.mjs`): `stageKit({ h, m, g, y, phase, active, social,
  quiet, small, spec, THREE })` and optional `stageAnchor(layout)`.
- Procedural detail: `stationDetail(spec, mount, THREE, { role, layout,
  sceneId })` runs for each station's `desktop`/`shelf` mount (detail moves and
  is disposed with the station); `mainDeskDetail({ sceneId, role, THREE,
  add(object, phases?) })` adds to the live main desk's dressing.

### Extra ErgoFlex desks (stations)

`stations(sceneId, layout)` returns, per layout:

```js
{ id: 'teacher-desk', name: 'Teacher desk', size: '60x30', // or '48x30'
  at: [x, z], turn: 180,           // degrees about vertical; 0 = user faces the back wall
  height: 28, tilt: 0,             // inches / degrees (pose snapshot)
  chair: false,                    // omit for a Steelcase chair 1050 mm in front, turned with the desk
  desktop: [{ id: 'kenney-furniture-laptop', at: [-140, 0, -30] }], shelf: [], plan: false }
```

Each station is a batched snapshot of the live desk at its own size (the
48/60 desktop parts are swapped only during the synchronous capture and
restored), keyed `${scene}:${layout}:station:${id}` and registered as a floor
collider by `RoomInteractions.bind`. Desktop frame: x across the top
(±600 on 48, ±750 on 60), +z toward the user. Main-desk dressing placements
and `add()` objects accept `phases: ['evening', 'night']` to show only in those
dayparts. Current placements are placeholders: every layout has a seated
48x30 and a 60x30 (Educational: teacher desk facing the class).

### Pitfalls

- Light budget: 5 real lights per room (3 room PointLights + at most 2 local
  lamps in `kit.lamps`; the test requires 1–2 local lamps). Use emissive
  material and additive light pools for everything else; stations get no real lights.
- Keep the test-required furnishing names (see `purpose` in the test), the
  `activity-table`, and stable `asset()` ids; asset keys are saved in projects.
- Group modules are imported by `institutional-scenes.mjs`; never import the
  registry or `institutional-room.mjs` from a group module (cycle).
- Cache revision `institutional-sweep-20261009` is shared by all
  institutional modules and their importers (`institutional-scenes/room`,
  group modules, `room-life`, `room-polish`, `room-refinement`,
  `room-interactions`, `workspace-3d`, `studio.js`, `index.html`,
  `product-demo.html`, the test). Bump it everywhere together. New module
  files must also be added to `divi-editor/build-site-upload.py`.
- Stations are added asynchronously after the room build: `kit.byId` and
  `kit.taskLamp` cannot reach them; use `stationDetail`.
- Tests check that stations do not overlap floor furniture, the main desk or
  each other, sit inside the room, and render at ~48 in / ~60 in.

### Review renders

```sh
node tools/props/institutional-review.mjs --only security,police --out /tmp/review-gov \
  [--tiers house] [--phases night,party] [--angles hero] [--reference none] [--ratio 0.75]
```

Writes `<scene>-<tier>-<phase>-<angle>.png` (angles `wide`, `hero`,
`reverse`) for every tier and all five dayparts, plus
`ref-<room>-house-<phase>-<angle>.png` for office, coworking and library and
a `report.json`. Viewport 1280×800; one Chromium process at a time,
relaunched per scene and always closed.

## Educational group · layout, desk roles and storytelling — 9 October 2026

`institutional-education.mjs` now describes each school stage in one
`STAGES` table: ErgoFlex desk roles, main-desk dressing and pose per daypart,
planning-table position and loose library props. Each stage has its own plan,
age-appropriate furniture and wall story, and gains ErgoFlex desks as it
progresses:

| Stage | ErgoFlex desks (main + stations) | Plan |
| --- | --- | --- |
| Kindergarten | 3: teacher's observation station; discovery light table (60, 28 in, children stand); painting easel (48, 28 in, 35°) | Learning centres round the circle carpet: 8-child shared table, nature shelf, story rocker and big-book easel, front-facing book display, block rug, art vinyl, family sign-in table |
| Elementary | 5: teacher; document-camera cart; guided-reading table with four child stools; science and grow table; accessible desk | Three 4-child pods, meeting carpet with library bins and beanbags, maths shelf, teacher and family table |
| Middle school | 5: teacher; maker and 3D-print bench (38 in); presentation desk; student standing desk; accessible desk | Five 4-seat STEM clusters, robotics mat on a rubber maker zone, city model table, lockers |
| High school | 7: teacher; physics demonstration desk; standing desk; research nook; accessible desk; poster review (25°); research and data desk | 3 × 3 paired rows, slate demonstration inlay, lab bench with sink, goggles rack, poster gallery, lockers, project table |
| College | 6: instructor; teaching podium with document camera; practical bench; TA office hours (student stool); accessible desk; standing pitch desk | Four 6-seat team tables with mobile whiteboards and pendant clusters, lounge edge, prototype table, bench seat under the glazing |
| University | 7: lecturer's research desk; lectern; accessible seminar seat set into the hollow square; research assistant; poster review; two graduate carrels | Hollow-square `Seminar table` (16 seats), lectern stage strip, library bookcases, archive cabinet, lounge with globe, refreshments |

- `stationDetail` adds the role equipment (lightbox and colour tiles, painting
  and paint pots, document cameras, seed trays and grow light, printer status
  ring, Newton's cradle, review posters and lecture notes, sticky notes,
  banker's lamps). Its glow follows the daypart through `atmosphere`.
- Daypart staging: chairs go up on the tables for kindergarten's room reset,
  after-school in middle school and the high-school evening. Kindergarten's
  block tower is put away at night, and each stage has its own planning-table
  kit. Kindergarten's tilted family-evening pose swaps the laptop for a
  portfolio.
- Wall content (frieze, word wall, number line, anchor charts, design cycle,
  periodic table, Sankey, research posters, campus map) is generated canvas
  with generic content only. Ceiling decor (lanterns, bunting, planets,
  baffles, pendants) is a non-asset `Ceiling classroom decor` group.
- Pitfall: `RoomInteractions` skips any object whose name matches
  `/ceiling|window|curtain|door|daylight|…/`, so a station or floor furnishing
  named "Window …" silently loses its collider. The test then times out
  waiting for station colliders.
- The test also checks the educational desk progression and an accessible
  28 in desk from elementary up.

### Materials, finishes and fine detail · 9 October 2026

Each stage now has its own surface palette, built from canvas maps at a
physical scale. `uvBox` writes box-projected UVs in millimetres, so one
material covers a 2.5 m table and a stool without stretching. Materials
carry their repeat in `userData.eduUV`, and `applyUV` projects them after
the build. Plank floors also carry a matching roughness map.

| Stage | Floor | Walls | Furniture / textiles | Window view |
| --- | --- | --- | --- | --- |
| Kindergarten | Pale ash planks; flecked sheet-vinyl art zone with metal edge | Birch-ply wainscot (900, grooves at 100) with honey cap rail | Birch tops, glossy polypropylene shells, printed picture-book covers | Playground: play tower and slide, sandpit, raised beds, picket fence; lamp post and two lit windows at night |
| Elementary | Light oak; marbled lino wet zone under the grow table | Green tack-board (1000) with oak cap, pinned work and push pins | Birch pod tops; guided-reading stools re-tinted sage, honey and blue | Garden beds, hopscotch, climbing dome, bike rack |
| Middle | Oak; studded rubber maker zone with a safety-orange edge | 300 rubber skirting; gloss write-on wall with marker sketches, aluminium frame and marker tray | White HPL with teal edge bands | Running track, pitch and goals, bus loop with a school bus |
| High | Deeper oak; cleft-slate demonstration inlay with metal edge | Painted slate dado (900) and cork strip (900–1100) with pinned notices; glazed 1900 equipment cabinet showing kits, glassware and meters | HPL with graphite edge; textured book spines on the resource shelf | Staff car park, gymnasium (lit in the evening), floodlit field |
| College | Carpet tile; oak teaching stage with aluminium nosing | Oak slat wainscot to 1100 on the teaching wall (the podium bay is the `oak-slat-panel` asset); limewash terracotta panel; painted side dado | Oak-veneer tops, woven upholstery, re-tinted TA stool | Brick hall across the quad (lit in the evening), paths, bike racks |
| University | Darker carpet tile; oak lectern stage with brass edge | Panelled green wainscot (900) with walnut chair rail; plaster cornice on all three walls | Walnut tops, pebbled leather, spine-textured library runs; glazed archive cabinet | Stone hall with clock tower, glass laboratory (mostly lit at night), fountain |

- The stage's window view replaces the shared campus drawing on the daylight
  pane. It is redrawn per daypart in `atmosphere`, and its aspect follows the
  opening. The emissive level for each daypart is set in `drawView`, for the
  lighting pass to tune.
- Every stage has a column of door-side services: switches, a fire-alarm
  call point, a thermostat and a strobe.
- Wall finishes are plain meshes on the cutaway wall groups, not assets, so
  they add no collision and no saved keys. New flat zones are
  `science-floor-zone` (elementary) and `teaching-stage` (college).
  `oak-slat-panel` now starts at floor level; its saved key is unchanged.
- Library props that ship with a coral seat are re-tinted through the room's
  `decorateProp` hook. The cloned materials are owned by the room.

### Lighting and time of day · 9 October 2026

Each stage has one `LIGHT` entry in `institutional-education.mjs`. It holds
the five registry modes (sun key and fill colour and power, ambient, sky,
exposure, practical and wash for the three room lights with their task and
bounce colours, and desk LEDs). It also holds the module's own levels: the
sun patch, the window-view emission, the shell's linear fixtures, the local
lamps and a scale for the room light over the main desk. `sceneOverrides`
merges these modes with the main-desk pose for each daypart.

| Daypart | Intent |
| --- | --- |
| Morning (09:00) | Low warm sun: a long, soft window patch across the floor; practicals low; LEDs off |
| Afternoon (14:00) | Neutral daylight, short high sun patch; brightest, practicals at rest; LEDs off |
| Evening (18:00) | Golden hour: a long amber patch, lower key, lanterns, pendants, picture lights and lamps full; warm LEDs |
| Night (22:00) | Low cool ceiling wash (exposure about 1.2), a faint lamp-post patch, only the after-hours practicals lit; warm LEDs |
| Shared event (16:00) | Warm late-afternoon light with pendants, pools and lanterns on; LEDs in a muted stage accent |

- Real lights stay within the budget: the 3 room lights, the planning-table
  lamp, and one second lamp. The second lamp is a procedural reading floor
  lamp by the elementary meeting carpet (`reading-floor-lamp`, which replaces
  the library floor-lamp prop) or the lounge floor lamp at college and
  university. Each lamp carries a floor pool.
- Everything else is an emissive fixture plus an additive pool (`E.pool`, a
  shared radial falloff map) levelled per daypart. These are KG picture lights
  on the learning cards and art line, the story-carpet lantern (the only one
  left on at night), the light-table spill and table pools. Elementary has a
  word-wall picture light and pod pools; the science-table grow strip pools on
  the seed trays. Middle school has 4000K linears under the baffles (only the
  two clusters in use after school), cluster pools, a screen halo and the
  maker task strip. High school has a ceiling can and a pool on the slate
  inlay, a gallery rail light, a screen halo, a lit glazed cabinet and a
  periodic-table light. College has track spots (terracotta scallops, slat
  grazing), a stage pool, team-table pendant pools (one table during
  independent study) and screen halos. University has one long seminar
  pendant with pools on every table segment, poster picture-light pools,
  campus-map and bookcase lights, and a lit archive cabinet.
- Stations get role light in `stationDetail`: compact LED task lamps
  (`STATION_LAMPS`) with desk pools, the maker task strip, grow-light,
  demonstration and banker's-lamp pools. Pools use `userData.eduPool`
  (levels) and `eduPoolColor`. Keep station detail at or above the floor:
  `RoomInteractions` only treats an object as floor furniture when its bounds
  start within 5 mm of the floor. Hidden geometry counts too, so a floor pool
  under a station silently drops its collider and the test times out. Put
  floor spill on a room asset instead (e.g. the KG `block-rug`).
- The sun patch is the glazing's silhouette, including the blind band,
  projected on the floor along the shared rig's sun direction (`SUN_ANGLE`
  mirrors `room-refinement` `DAY_ANGLES`) and clipped to the room.
- The window outlook is unlit by the room: black base colour, emissive map,
  with a per-daypart level in `LIGHT[id].view`.
- Desk LED colours are chosen for the spill they throw: the room spill scales
  with LED colour, so evening, night and event colours are deliberately
  mid-value to keep the black desktops reading black.
- Review renders: the shared review tool pauses the render loop, so a desk
  that just moved keeps the blue "Lift up" motion pixels. For lighting reviews
  disable LED motion and re-apply the mode colour before each shot
  (`setLedMotionEnabled(false)` then `setLedColor`).

### Principal review · 9 October 2026

- Desk LEDs and the black desktop: the shelf strips wash the desktop in the
  LED colour (desk reflection bands), so in daylight any warm colour turns
  the desktop tan, and the room spill throws a peach gradient on the
  window wall beside the main desk. Educational desk LEDs are now off for
  morning, afternoon and the golden-hour evening. At night they glow a
  low-value warm white (`#5a3e2a`). For the shared event they use a deep
  ErgoFlex red (`#4a1813`, KG `#4a1a14`), or a deep teal in the middle-school
  studio (`#0e3036`). The desktop reads black/red in every daypart.
- Every room surface material is dithered (`material.dithering`), which
  removes 8-bit banding in lamp falloff across large plain walls.
- Carpet tile loop rows are fainter, so the 500 mm tiles no longer mip to a
  checkerboard in wide shots.
- University front half: a reading commons (walnut library table with two
  banker's lamps, eight chairs, oxblood rug, `reading-table`), low library
  bookcases on the window wall's front bay (`reading-room-shelves`, books,
  bust, lamp), a glass vitrine with a campus model (`model-vitrine`), and
  three framed engravings behind the lecturer's desk.
- College: each team has a colour (terracotta, ochre, sage, slate) shown by
  a carpet-tile inlay (`team-zone-n`) and a table flag. There is also a
  standing-height breakout table with three stools on a rug
  (`collab-table`), a cork project pin-up board and a bag rail on the window
  wall's front bay, and a course calendar behind the instructor's desk.
- Teacher-corner content on the window wall behind the main desk, so hero
  frames are composed: the project timetable and city poster (middle school),
  the lab safety poster and timetable (high school), the course calendar
  (college) and the engravings (university).
- Shared event (16:00) is now clearly its own daypart. It has a warmer, lower
  key, more practicals and pools, a longer sun patch, and a double-sided
  `Ceiling event banner` shown only for the event: WORKSHOP DAY, STEM
  SHOWCASE, PROJECT FAIR, DEMO DAY or RESEARCH SYMPOSIUM.
- Station task-lamp and banker's-lamp pools are stronger. The university's
  night seminar pendant stays dimly on, and its reading lamps carry the
  night reverse view.
- Pitfall: `kit.lights` (the three room PointLights) is created after
  `furnish`/`decorate`, so per-room light changes belong in `atmosphere`.

## Government group · layout and furnishing pass · 9 October 2026

`institutional-government.mjs` now gives the three settings distinct plans,
ErgoFlex desk roles and storytelling (all content generic and illustrative).

- **Security operations**: an operator console row (main desk = lead operator,
  48x30 video operator, the fixed `Security console table`, Large adds a 60x30
  access-control operator) faces a framed 3 × 2 video wall with a bias halo,
  status ledge and per-daypart lead feed. A supervision row stands on a darker
  floor field with an LED nosing line: 60x30 standing shift supervisor, plus
  60x30 analyst and a 48x30 incident lead (plan review, 20° tilt) in M/L; Large
  adds a 48x30 radio dispatch facing the door wall and an incident map table.
  Key and radio cabinet (radio bank, key box, ivy), equipment cabinet and AED
  (M/L), incident status board, evacuation plan, card reader, extinguisher,
  coffee point, zone clocks, backlit OPERATIONS header and blackout blinds.
- **Police / PD**: a squad room with a report-writing bench (main desk, the
  fixed `Case review workstation`, 48x30 report desk M/L, 60x30 crime analyst L),
  a standing 60x30 duty sergeant, and a seated 48x30 intake counter facing the
  door (transaction shelf, ticket dispenser, wait sign). M/L add a briefing
  lectern (48x30, plan tilt) facing tablet-arm seats (2 × 3 M, 3 × 3 L) and a
  wall briefing display; Large adds a case-file desk, case boxes and an
  evidence review table. Locker bank with radio charger, vest rail, property
  drop locker, walk-off vinyl, notices board, first aid, beat-map/roster board.
- **Government office**: a one-stop service centre. Caseworker bench (main
  desk, standing 48x30 plan review, 60x30 records lead M/L), the fixed
  `Public service workstation` with a privacy screen, and ErgoFlex public
  counters facing the door: accessible 28 in (60x30 S, 48x30 M/L) and standing
  43.5 in (60x30 M/L), with counter number signs, wait decals, a queue kiosk and
  display, porcelain public zone and wall waiting bench. Large adds a standing
  team huddle, a consultation desk and a language-access desk with visitor
  chairs. Oak slat feature, How-we-can-help board, community prints, sheer
  blinds and sill plants.

Role detail on the extra desks is procedural (`stationDetail`): generic dual
screens, radio docks, trays, plan sheets, counter plates; the main desk gets
role dressing via `sceneOverrides[id].desk/shelf` and `mainDeskDetail`. Main
desk poses per daypart are set in `sceneOverrides[id].modes` (yaw stays 0:
the main desk sits in a benching row). Desk envelopes on the plan are about
±545 mm deep with shelf and feet, wider than the 762 mm top suggests.
Verified with the review renderer (3 settings × 3 sizes × 5 dayparts) and
`node tests/institutional-room-test.cjs --only=government,police,security`.

### Government group · materials, textures and fine detail · 9 October 2026

Specialist 2 pass in `institutional-government.mjs` (no shared files touched).

- **Material classes.** Batched detail is no longer all flat vertex colour:
  `ck(kind)` collects parts per class (`steel` powder coat with a roughness
  map and slight metalness, `brushed` metal, `oak` / `oakV` grain in two
  directions, `hpl` speckle, `fabric` weave, `rubber`, `glass`, `print`
  labels, `paper`) and `K.build` merges one mesh per class per furnishing.
  Class maps are near white so vertex colours still set the hue; UVs are
  box-projected in millimetres (`uvBox`). Room classes are cached per room
  (`kit.gov`), station / main-desk classes per kind at module level.
- **Shell surfaces.** Per-scene carpet tiles (500 mm quarter-turn; security
  darker with a cross-hatch and a darker supervision field), limewash wall
  paint, woven seat fabric (security seats graphite, not cyan), grained oak for
  the door, frames and government tables, HPL tops with edge bands.
  `finishDecor` box-projects every material that carries `userData.govUV`.
- **Wall systems.** Security dark dado with a cyan light line at 1100 and a
  staggered fabric acoustic grid; police navy wipe-clean wainscot with 600 mm
  reveals and a brushed chair rail; government sage raised panels (1300 pitch)
  with an oak cap rail, oak battens with vertical grain on dark felt. Wainscots
  are non-asset children of the wall groups (door span and sill respected).
- **Blinds and window views.** Blackout roller fabric (security), aluminium
  venetian slats with alpha gaps (police), sheer weave (government); texture
  repeat follows the drop. Each scene paints its own outlook into the window
  pane per daypart: perimeter fence, car park and gatehouse; station yard with
  plain white / blue patrol cars and a flagless pole; civic plaza with a
  columned hall and bus shelter. No text, insignia or real places.
- **Fine detail.** Printed label atlas (lockers, records A–F, keys, PPE,
  property drawers, console numbers) and paper atlas (forms, rosters, site
  plans, radio-code cards, checklists, notes) replace grey bar placeholders;
  door reveals, hinges, louvres, padlocks, label holders, cable trays and
  bundles, glazed key box, evidence bags, brochure rack, marker trays,
  stand-off sign fixings, monitor VESA plates and cables.

Main-desk dressing verified at the default 60x30 size (house layout).

### Government group · lighting and time of day · 9 October 2026

Specialist 3 pass, all in `institutional-government.mjs` (no shared files).

- **One `LIGHT` entry per kind** (operations / police / government) holds the
  five registry modes from the brief (sun key and fill, power, ambient, sky,
  exposure, practical and wash for the 3 room lights with task and bounce
  colours, desk LEDs) and the module's own levels: window `view` emission,
  floor `sun` patch, `ceiling` strip lenses (per strip), `desk` scale on the
  room light over the main desk, the two local `lamps`, the emissive-line
  `glow` scale, wall `screens` and desk-monitor `station` brightness.
  `sceneOverrides[id].modes` merges these with the main-desk pose.
- **Desk LEDs**: off by day everywhere. Security evening / night / handover
  `#1a4f57` / `#1d5961` / `#3c6763`, police evening / night `#2a4c53` /
  `#27474e`, government evening only `#5a4630`. They are the brief's hues at
  low value: the LED spill scales with the colour and washed the small rooms.
- **Ceiling** (restyled on the first `atmosphere()` call, when the shell's
  ceiling group exists; one lens material per strip): security cove strips at
  40 % length plus Ø120 downlight discs over every console seat and the
  supervision row; police 4000K linears suspended at 2600 on cables (only the
  rear one, over the report bench, stays on at night); government oak-trimmed
  linears at 2650 and opal globes over the public counters (off when closed).
  Group ceiling fixtures live in the shell's ceiling group, so they hide with
  the camera cutaway.
- **Practicals without real lights**: additive pools (shared radial map) for
  the downlight floor pools, table-top task light, video-wall bias spill on
  the wall and floor, the sodium slot under the security blackout blind,
  police strip pools and exit-sign glow, government globe pools. Slim linear
  picture lights / wall-washers with a scallop pool: security incident board,
  police beat board and briefing display, government service board (stays on
  after hours) and community gallery. Room pools live in one overlay layer
  (`Daylight and lamp light pools`, `grooveMarker`, no ray hits); pools that
  belong to an asset copy its transform before drawing, so asset bounds,
  colliders and the Groove planner are untouched.
- **Stations and main desk**: a task pool inside the desktop footprint,
  console screen spill (security), the records lead's LED arm lamp
  (government). Desk-monitor screens repaint per daypart (content, footer
  label, brightness); government counter screens show CLOSED at night; the
  security supervisor's screen dims at night watch. Levels travel in
  `userData` (`govPool`, `govGlow`, `govScreen`) and stations take the room's
  current daypart when they are added.
- **Window**: the outlook is unlit (black base, emissive map) with a level
  per daypart; a floor sun patch follows the shared rig's sun angle and the
  blinds (blackout passes only the sill slot, venetian 30 %, sheer 50 %).
- Carpet quarter-turn contrast softened for all three scenes.

Verified with `tools/props/institutional-review.mjs` (3 settings × 3 sizes ×
5 dayparts × wide / hero / reverse, plus close interior angles) and
`node tests/institutional-room-test.cjs --only=government,police,security`.

### Government group · principal review · 9 October 2026

Principal pass in `institutional-government.mjs` (no shared files touched).

- **Cutaway / collider fix.** The wainscot groups (all three scenes) and the
  government oak slat feature and the security video wall (its cable trunking) reach the floor, so `RoomInteractions` took them
  for floor furniture: re-parented to the room root (the cut-away window
  wall's panelling stayed standing in wide views), draggable, colliders along
  every wall. The wainscot groups are now `presentationOnly`; the slat feature
  and the video wall are `propAnchor: 'wall'`.
- **Government office re-zoned.** Public counters move toward the centre
  (`GOV_COUNTER_X`: S 1200, M 1300, L 2300; L language desk to x −1350), so the
  porcelain public zone is about 2 m wide in M/L. Visitor flow: door → ticket
  kiosk with the queue display above → four-seat wall bench under the
  community gallery (monstera at its start) → called to the counters; a front
  waiting corner with a lounge chair, round wool rug, fig and wall brochure
  rack; L adds a self-service point (two lit form tablets). Back office: a
  deeper carpet-tile field with an oak edge under the caseworker bench, a sage
  wool rug under the public service workstation, a print-and-supply credenza
  (printer, reams, archive box, plant) under the service board, a fig by the
  slat wall and a tall tree at the glazing (M/L). Carpet re-tinted warm taupe.
- **Security / police.** Security M gains the standing incident map table
  (front right, two stools); L a leather armchair by the coffee point. Police
  M/L get a navy carpet-tile briefing field with a signal-yellow edge and a
  kit-check bench (duty bags, vest, boots).
- **Brief items.** Security shift briefing: main desk standing, turned 16°
  and 150 mm back (`pose` now carries yaw / offset). Supervisor's tablet is a
  procedural lit screen (site plan, dims at night). Police lectern carries a
  procedural laptop showing the daypart's briefing slide ("BRIEFING 09:00",
  "TEAM BRIEFING 16:00"); the wall briefing display repaints per daypart
  (`kit.govRedraw`). Government workshop: main desk turned 16°.
- **Dayparts apart at a glance.** Handover / team briefing / team workshop are
  now 16:00 warm late-afternoon modes with practicals up, blinds raised or
  half-drawn (security .32, police .45, government .42) and a strong sun
  patch; security's lead video-wall tile shows the shift-handover checklist,
  the government service board becomes a service-journey workshop wall and the
  queue display announces the workshop. Nights for police / government are
  lifted (ambient ~.2, exposure 1.24, warmer task light, night background .72,
  the rear linear stays on dimly).

## Healthcare group · layout, desk roles and storytelling · 9 October 2026

`institutional-healthcare.mjs` turns `hospital` into an inpatient ward bay and
`laboratory` into a teaching and research wet lab with a dry write-up zone.
Plans live in `hospitalPlan(layout)` / `labPlan(layout)` (one row per size),
shared by `stations`, the builder hooks and `sceneOverrides[id].layout`.

| Setting | ErgoFlex desks (main + stations; S / M / L = 3 / 5 / 7) | Plan |
| --- | --- | --- |
| Hospital | Main desk = nurse workstation on wheels beside bed 1 (eMAR screen, barcode scanner, sanitiser, gloves); standing 48x30 medication station (unit-dose drawers, scanner, med cups, sharps bin, gloves, 4000K under-shelf task light); standing 60x30 physician charting (stethoscope on the shelf); M/L add a seated 60x30 charge nurse (census screen, wristband printer, call headset) and 48x30 telehealth (video-call screen, webcam bar); L adds a standing 60x30 pharmacist verification and a seated 48x30 discharge planning desk with a visitor chair | Beds head to the back wall (L: bed 3 to the door wall) on a services headwall: oak-look panel, gas outlets and flowmeter, suction, nurse call, sockets, reading light, vitals monitor arm, care board ("my care today", pain scale; no patient data), bed plate, wall-wash strip, amber night-lights. Per-bed bay set (key `patient-monitor-n`): locker with personal book / photo / card, recliner facing the bed, IV pole and pump, overbed table. Ceiling-track cubicle curtains; clean supply cabinet, clinical cart with portable vitals, linen trolley (M/L), handover table, unit huddle board on the door wall, gloves / sharps / PPE point and lanyards, hand-hygiene points at each bed entry and the door, waste and soiled-linen bins, wayfinding, family corner with armchairs (M/L) |
| Laboratory | Main desk = analysis and write-up in the dry zone (no drinks; safety glasses, notebooks); seated 60x30 instrument control (spectrophotometer, cuvettes); seated 48x30 microscopy by the window (compound microscope, camera feed); M/L add a standing 60x30 sample prep (pipette carousel, tube racks, vortex, mini centrifuge) and a standing 48x30 teaching demonstration desk facing the benches (molecular model, document camera); L adds a 48x30 data review (plan tilt, chromatograms) and a 60x30 PI review desk (the lab's only mug) | Warmer dry-zone floor along the window with a yellow tape line; 1–3 island benches (epoxy top, drawer pedestals, two-tier reagent shelf on a gas / power spine, four stools each); fume hood with sash, airflow monitor and duct, hazard tape round it; flammables cabinet behind the main desk; sample fridge (no-food sign); ventilated reagent cabinet; L adds a CO2 incubator stack and a floor centrifuge; wash station with eyewash and a plumbed safety shower on a green floor square; PPE station after the door; safety information board, spill kit, periodic table, hazard pictograms, sill growth experiment A–F under a grow light |

- Daypart staging: curtains open and stacked at the headwall by day; at night
  they are drawn on the bay side and half the foot (the working side stays
  open for observation from the workstation). Hospital blinds: sheer and
  blackout rollers (blackout down at night). Bay sets show a water jug in the
  morning, a visitor's coat in the afternoon / team review, a blanket on the
  recliner in the evening and at night. Handover table: rounds list, discharge
  folders, SBAR card with two mugs, the night log, huddle cards. Lab: reagents
  set out for preparation, glassware with coloured liquid and lit burners for
  the practical, cleared benches for analysis, an overnight tube rack and
  timer for instrument watch; the hood sash rises for the practical.
- Main desk poses: hospital morning rounds standing, turned 24° toward bed 1;
  evening handover turned 12°; night observation perched (35 in). Lab
  practical session standing, turned 18° toward the benches. Positive `yaw`
  turns the user toward the door wall (+x).
- Station role detail and the main desk's dressing are procedural
  (`stationDetail`, `mainDeskDetail`) with screens repainted per daypart;
  pools, lenses, visibility and the sash use `userData.hcPool / hcGlow /
  hcShow / hcY / hcScreen`, refreshed by `applyPhase` from `atmosphere`.
- Pitfalls met: detail batched in `furnish` needs a dress material
  (`kit.dress` is only created by the shared enrichment pass afterwards, so
  `furnish` creates one first); headwalls are `propAnchor: 'wall'`; curtain
  tracks, floor zones and the pool layer are `presentationOnly` groups.
- The test checks one bed and one headwall (hospital) or one island bench
  (lab) per size step, the lab safety set, and a clear door path.
- Left for the materials pass: oak-look HPL texture on headwalls and bay
  inlays, bed-guard rail / coved skirting, tile splashback, epoxy fleck, lab
  floor re-tone, curtain and blind fabrics, healing-garden / research-park
  window views (the shared campus view still shows). Left for the lighting
  pass: the `MODES` and pool / lens levels are the brief's starting values;
  desk LEDs tint the black desktop in evening / night / party (lab party
  `#4a1813` reads red, hospital teal); night-light, headwall wash, bench
  strip, hood and grow-light levels; ceiling fixtures are still the shell's.

## Mobile IT group · layout, desk roles and storytelling · 9 October 2026

`institutional-it.mjs` turns `mobileit` into a field-service depot and tech
bar. Devices flow intake (tech bar, asset intake) → repair (ESD bench) →
imaging → staging carts → deployment through the door. Blue floor chevrons
mark devices coming in; green chevrons mark deployments going out.

| Tier | ErgoFlex desks (main + stations) | Plan |
| --- | --- | --- |
| Small | 3: field tech diagnostic desk (48); laptop imaging and deployment (60, standing); tech bar walk-up (48, standing, faces the door) | 2 bayed racks, cold aisle, parts shelving, 2 staging carts in a deployment bay by the window, briefing table |
| Medium | 5: + rack-side console (48, 40 in, faces the racks); ESD repair bench (60, seated) | 3 racks, charging locker, 3 carts, boxed devices, ficus |
| Large | 7: + network monitoring (60, dual screens); asset intake and returns (48) | 4 racks, secure parts cage, 2 × 2 carts, packing and dispatch bench, e-waste bins, tool cart, boxes, tree |

- **Rack row**: 600 × 1000 × 2000 (42U) racks `IT equipment rack` /
  `server-rack-n`, bayed against the back wall on a dark rack-wall paint zone.
  Each has perforated front doors, servers, storage shelves, switches, patch
  panels with patch cords into cable managers, a UPS with blue display, side
  cable bundles, an asset label and a top-of-rack cable ladder. The status LEDs
  are one unlit vertex-coloured mesh per rack (`I.ledMat`). The ceiling-hung
  ladder run to the door wall moves into the shell's ceiling group on the first
  `atmosphere()` call, so it hides with the cutaway. `cold-aisle` is a flat
  1.2 m marking with yellow and black tape.
- **Stable keys**: the shell's `storage` is rebuilt in place as wire `Parts
  shelving` (labelled bins, boxed SSDs, cable spools, anti-static bags,
  pothos and a work light, which is the second real lamp). `diagnostic-cart-n`
  are laptop staging carts (pushable). `identity-gallery` is the topology mural
  and `diagnostic-wall` is the sign-out tool pegboard on the window wall.
  `desk-zone-rug` is an ESD mat. The `service-bench` was removed because it
  blocked the Small door path.
- **New assets**: `charging-locker`, `parts-cage`, `packing-bench`,
  `ewaste-bins`, `rack-elevation`, `fire-extinguisher`, `queue-display`,
  `device-drop-box`, `deployment-bay`, `briefing-zone`, the `mat-<station>`
  anti-fatigue mats and `deployment-bags`. Wall features are created by `I.wall`
  with `propAnchor: 'wall'`. Floor chevrons and tape sit in one
  `presentationOnly` group.
- **Station detail** (`stationDetail`, by `role`): procedural laptops with
  imaging-progress screens, an 8-port switch with patch leads, and an imaging
  tower. The tech bar has a check-in tablet and a queue screen facing the
  visitor, plus a loaner basket. The console has a terminal screen, a KVM and a
  console cable. The repair bench has an ESD mat with a wrist strap, a board,
  a parts tray, drivers, a multimeter, a magnifier ring, a power supply and a
  scope. The NOC desk has topology and alert screens. Intake has a label
  printer, a scanner and a returns tote. Screens repaint per daypart
  (`userData.itScreen`). Glows, LEDs, pools and phase-only objects use
  `itGlow`, `itLed`, `itPool` and `itShow`. The main desk gets a procedural
  checklist monitor, a USB-C dock, cable coils, a multimeter and a parts tray
  (`mainDeskDetail`).
- **Dayparts**: checks have half-loaded carts and the rack checklist on the
  console. The service session has queue 12/13, a laptop open on the ESD mat
  and a box at the tech bar. In maintenance, rack 02's door stands open with
  a cable tester and an amber LED shows. The tech bar sign and queue read
  CLOSED in the evening and overnight. Overnight, the topology and NOC show a
  SITE 05 amber alert. For the team deployment, the carts are full, the board
  shows every site READY, field bags wait by the door and the briefing table
  has the site map. The open door sits in an overlay that follows the rack
  (`I.follow`), so rack bounds and colliders do not change by daypart.
- **Test**: for `mobileit`, no station or floor collider may enter the cold
  aisle or the door path. The cold aisle is about 1.2 m deep and the rack row
  has 2 + tier racks.
- **Brand-name models**: avoid library props with real brand models
  (oscilloscope, graphics card, AirTag). Equivalents are procedural.

### Mobile IT group · materials, textures and fine detail · 9 October 2026

Specialist 2 pass, all in `institutional-it.mjs` (no shared files touched).

- **Material classes.** As in the Government module, batched detail is split
  by class (`ck()`): powder coat (orange-peel map and roughness map), polished
  chrome wire, brushed / galvanised metal, anodised aluminium, HPL, rubber,
  corrugated card, polypropylene, perforated vent steel, shielding foil, wound
  cable, PVC cable jacket, printed labels and rack equipment fronts. `K.build`
  merges one mesh per class per furnishing; UVs are box-projected in mm
  (`uvBox`). Room classes are cached on `kit.it.C`, station classes at module
  level (`stationMats`). Tables (packing bench, briefing table) use the
  non-vertex-colour `hplTop` with a graphite ABS edge band (`hplTop()`): a
  vertex-colour material on a plain shell box renders black.
- **Floor.** ESD vinyl tile, 600 × 600: conductive veining quarter-turned per
  tile, dark welded joints with a highlight, faint scuffs, plus a linear
  roughness map (satin tile, rougher joints) set in `finishFloor`. The cold
  aisle decal paints lighter tiles on the room's 600 grid (aligned to the
  floor map's origin at x = −w/2 and the open front edge), a worn 50 mm
  yellow / black border and a weathered stencil. The deployment bay is now a
  transparent tape decal over the real floor; a faint caster-track wear decal
  runs from the bay to the door.
- **Walls.** 1200 perforated-steel wainscot (1.5 mm holes at 12 mm, 600 mm
  modules with reveals, brushed aluminium cap) on all three walls, 780 under
  the glazing, skipping the door span and the rack zone. It is a
  `presentationOnly` group per wall; the shell's accent band and side kick
  strip are hidden. The rack wall is dark acoustic cladding (600 × 1200
  modules) with aluminium edge trims. Data / power outlet plates with leads at
  the desks and the locker.
- **Racks.** Powder-coated frame, split side panels, roof brush-strip entries
  with cable drops from the ladder, levelling feet, hex-perforated door (alpha
  map, about 70 % open), swing handle and lock, hinges, rack ID and asset tag.
  Equipment fronts come from an atlas drawn at 2 px / mm (`FRONT_CELLS`):
  2U servers with 12 drive carriers and vents, 3U / 4U storage shelves, UPS,
  48-port switch with SFP cages, numbered 24-port patch panel, KVM and vented
  blanks. `frontLeds()` places the status LEDs on the drawn indicators, and
  patch cords plug into the drawn jacks (`portX`). Servers and shelves have
  pull handles; side bundles have hook-and-loop ties.
- **Storage and carts.** Chrome wire shelving with split-sleeve collars, post
  grooves, truss wires and feet; open-front hopper bins with label windows and
  visible contents; taped, labelled cartons; cable reels; shielding bags.
  Charging locker with perforated doors, numbered labels, key locks and LEDs.
  Staging carts with chrome posts, rubber casters, a rubber grip and tagged
  laptops. Secure cage with padlock and cage label. Wheeled e-waste
  containers with lids, slots, wheels and pictogram labels.
- **Signage and print.** Canvas text uses a neo-grotesque stack (`SANS`) and a
  mono stack, with tracking on capitals. The room sign, tech-bar light box
  (icon, OPEN / CLOSED state), drop-box, locker header, extinguisher sign and
  planning board (now a 2× canvas; `drawBoard` lays out on a 768 grid and
  scales) are redrawn crisp. A label atlas (`PRINT_LABELS`) holds bin labels
  with barcodes, rack IDs, locker numbers, asset tags, carton labels, ESD,
  feed, outlet and e-waste labels.
- **Window.** A service-yard outlook replaces the campus drawing: business
  park block (30 % lit at night), trees, palisade fence, depot with two roller
  shutters (one open by day), dock bumpers, hatched apron and dock lights,
  two plain white vans, pallet, roll cage, bollards and lamp posts. Unlit pane
  (black base, emissive map) redrawn per daypart; `VIEW_LEVEL` sets the
  emission for the lighting pass. The yard sits low in the frame because the
  roller blind (now a screen weave) covers the top half.
- **Stations.** Role detail uses the classes: textured ESD mat with ground
  snap and label, anodised laptops with printed asset tags, the repair laptop
  shown open (battery, board, fan, heat pipe, RAM, SSD, cover and screws),
  powder-coated switch / KVM / imaging tower with vents, carton and tote labels.
- **Left for the next pass.** Rack fronts read dark through the door mesh in
  daylight: give them a lit cold aisle or a soft fill. Window `VIEW_LEVEL` and
  blind drop per daypart are untuned. The sill laptop sorter is still simple.
  The intake `tablet-pc` library prop shows a tiled start screen. The shared
  cache revision has not been bumped.
