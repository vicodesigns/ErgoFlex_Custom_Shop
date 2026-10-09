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
clinical cart. Mobile IT has equipment racks, diagnostic carts, and a service
bench. Monitor graphics are generated examples, with no real operational data.

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
module cache revision is `institutional-atmosphere-20261008`.

Verification of this pass: all 12 settings passed the quick integration matrix
(12 layouts × 3 activities = 36 lighting/Groove combinations), furnishing bounds,
desktop defaults, interaction registration, grouped-setting recall, project
restoration and mobile control bounds. All 12 settings were rendered at all five
activities (60 images), with zero missing assets or reported shader/page errors.
The integration harness pauses continuous rendering during state and bounds
checks to reduce software-GPU contention; the separate image review renders each
view explicitly.
