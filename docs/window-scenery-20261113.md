# Window views: modelled places behind the glass (November 13, 2026)

Vico, November 12: the windows "are too bright and compete with the room environment"; "I am kinda liking the old
versions"; "open to 3D environments outside of the windows to make the depth and feeling of more immersion".
November 13, after the garden trial in the home room: "I like that 3D like environment for the outside of the window",
for all the environments. The 3D scenery is the default since Nov 13 2026 (his choice; one line, below).

## What it is

Instead of a picture on the pane, the place outside is built: planting right outside the glass, a lawn or a street,
trees, the buildings across, far trees or towers in the haze, each at its own distance, so near things slide against
far ones as the camera moves (a photograph sits at the horizon; a painted pane sits on the wall).

- `window-scenery.mjs`: the switch (`windowView`, `DEFAULT_VIEW`), the hours (`HOURS`), `attachScenery`, the shaders.
- `window-scenery-kit.mjs`: what the places are built from: geometry with a colour per vertex and its daylight baked
  in, trees (a lumpy mass with a shell of leaf sprays, so the outline breaks up), conifers, redwoods, palms, shrubs,
  hedges, flowers, grass, houses, city blocks, street lamps, cars, fences, walls.
- `window-scenery-scenes.mjs`: the places, one per kind (below).

How it stays behind the room:

- **Seen only through the openings.** The rooms are cutaways, so geometry behind a wall would show beside and above
  it. Each fragment is kept only if the sight line from the camera to it crosses one of the wall's window rectangles
  (`throughWindow` in the shader: no stencil and no clipping planes, so it holds in perspective and orthographic
  cameras, the film's render targets and the reflection capture). From outside the wall nothing is drawn, the sky
  included.
- **One world per wall.** The panes given to `attachScenery` are grouped by the way they face. Each group is one scene
  seen through all of its openings (each opening a rectangle at its own depth, so a glazed door set back from the
  windows works), so window A and window B of a wall line up. A wall facing another way gets its own scene (its own
  seed, and the scene knows which wall it is: `ctx.facing`).
- **Its own light, from the hour's sky.** The room's lamps do not reach it. The shader lights the land with the hour's
  sun (its direction is the one the sky draws the sun at, so the shade falls on the side away from it) and a sky/ground
  hemisphere; the normals are uploaded (a byte each). Contact occlusion is baked into each vertex's colour: the ground
  darkens under cars, trees, benches and rocks and at a building's foot, and so do their feet. A grain from a small
  generated noise texture breaks up walls and ground. After dark the place's own lamps add their pools (baked per
  vertex; a sixth of it on leaves), lit windows and shopfronts glow (a quarter of the windows at most, dimmer and
  uneven, half of them curtained) and soft halos sit round the lamps; colours go greyer.
- **Foliage is cards**, quads cut out of a generated leaf atlas (512 px, four cells: single broad leaves near, a
  conifer spray, dense small leaves at middle distance, clumps far). Each card takes its crown's normal, so a crown is
  lit as one volume; a dark mass inside fills the gaps; the cut-out threshold follows the mip level so far crowns keep
  their mass. (The trial's tetrahedra read as paper confetti.)
- **Far blocks and towers** draw their windows as a grid in the shader (a normal of length .85 marks a facade), a few of
  them lit after dark, so a skyline of towers a kilometre off costs a box each.
- **The air.** Far things take the colour of the air with distance, and keep going into it beyond the scene's
  `hazeFar`, so towers a kilometre off are pale shapes.
- **The hour** (`HOURS`, a scene's own `hours`, `setHour`): tint, `light` (how much the sky and the sun light the land),
  haze and air, the lamps, the sky (gradient, sun or moon, clouds, stars). All numbers, colours and vectors, so the
  film's time-of-day blend carries them (the sun's direction too). Party is an ordinary navy late evening outside; a
  room whose party is daytime (the child's room, the bedroom) passes a daytime hour.
- **The sky** on the pane: clouds from two fetches of the noise texture, coloured from the sky itself (so they go dark
  at night) with soft edges; stars are soft points sized to the pixel; the sea's glitter is soft. `drift` moves the
  clouds; it is 0 (they stand still) unless a film animates it.
- **Calm**: `LEVEL` (.8) scales everything outside; colours are muted; nothing outside is lit like a stage.
- **Draw order**: the sky pane first (no depth), then the room, then the land (`ORDER`), so the room's walls reject what
  is behind them before it is shaded.
- **Cost**: 13 000 to 100 000 triangles per world (a city from high up is the cheapest: its far blocks are boxes);
  built in 25 to 200 ms in node; things the room's cameras cannot see through the openings are not built (a wedge that
  widens past 15 m for oblique cameras); built once and kept (the last four) for when a room is rebuilt. The meshes are
  marked `sharedProp`, so a room's disposal frees their materials and leaves the kept geometry; a world pushed out of
  the cache is freed on the GPU. The pane's own material is freed with the room.
- **Film**: `tools/experience/film-quality.mjs` hides the scenery from its GTAO pass and keeps it out of `bloomOnly`
  (the scenery sits under nodes named "Window ...").

## The outdoor pass (November 25, 2026)

Vico asked for the views out of the film's windows to be improved (skies, depth, light that matches the interior,
anything flat or fake at 4K). What changed, all of it in the four scenery modules (no room file):

- **What a surface is made of.** Besides `tone`, `normal` and `glow` a vertex carries `kind` (four bytes; kit `KIND`:
  facade, bark, brick, tiles; `Builder.add(..., { kind })`). The land shader gives every surface close-up detail: a
  fine grain, rain streaks down walls, grass in blades, tufts and sun-dried patches where the ground is green, grit on
  paving and duff; brick is coursed with recessed joints, tiles lap, bark is fibrous. Every pattern is faded out by
  the size of a pixel on the surface (`fwidth`) before it could shimmer, so far things are as calm as they were.
- **Facades.** A block's `kind` is its own make (`facadeKind(x, z)`: bay width, storey height and a number, from where
  it stands, not from the scene's random stream): punched windows in brick or render, ribbon windows, or a curtain
  wall. Near the glass each window has its frame and bars, a shaded head, a blind part way down on some, and more sky
  in the top of the pane. A far tower is the plain grid it was.
- **Redwoods.** The bole is one modelled surface: a flare that spreads into root buttresses, bark ridges with real
  relief, moss low down; the triangular root fins are gone (`redwoodRoots` is kept as an empty call). Nothing is
  drawn from the scene's random stream, so the Commons' trees stand and branch exactly where they did (checked: every
  leaf, light and halo of the nine film scenes is in the same place as before the pass).
- **Crowns.** The mass inside a crown takes the leaf atlas (laid on from the side it faces) and breaks up where it
  turns from the eye, instead of showing as a smooth dark bag between the sprays or from below.
- **Sky.** Low down it is warmer and brighter on the sun's side (the more so the lower the sun), a little deeper
  opposite; cloud banks have a shaded belly, thin edges that light up toward the sun, and go pale toward the horizon
  like the land does; a third octave breaks their edges.
- **Sea.** The swell's crests bend, run out and come in sets (two slow noises on the phase and the amplitude).
- **The sun is the room's.** By day the sun outside stands where the room's key light comes from: `RIG_SUN` is
  `room-refinement.mjs` `DAY_ANGLES` in degrees right of straight out and degrees up (morning -19.8 / 30.3, afternoon
  6.8 / 55.2, evening 25.6 / 16.1); a scene whose room has its own angles carries `rig` (the yard: the workshop's
  broad day light). In a built room `setHour` takes the rig's very direction from `root.userData.lighting` (published
  before the room's atmosphere runs), so a wall that is not the daylight wall has the sun where it really is (the
  Commons' back glass: off to the right; behind the building for a wall facing away). Before, the morning sun
  outside stood 52 degrees left and 13 up while the sun patch on the floor came from 20 left and 30 up. If
  `DAY_ANGLES` change, change `RIG_SUN` with them (`tests/window-scenery-test.mjs` holds the numbers together).
- **Cost.** No new pass or render target. Humboldt goes from 24 000 to 44 000 triangles (the modelled boles); the
  others are unchanged. With a window filling a 1080p frame the desk's GPU takes 4.2 -> 5.2 ms (city) and 5.1 -> 5.5 ms
  (grove); a film window is a fraction of the frame.
- **Film**: every room chapter's pixels change through its windows, so the film needs an epoch bump (Vico's call).
- **Still open**: fan palms are still simple fans; cars and houses are still plain models; no people or traffic
  outside; the towers' faces are one material each.

## The places

Scenes (`window-scenery-scenes.mjs`): `garden` (the home room), `back-garden` (other gardens; variants 'bedroom',
'kitchen', 'kids'), `studio-garden`, `humboldt`, `socal-campus` and `beach-school` (both with the Pacific beyond),
`city` and `city-neon`, `yard`, `campus` (variants 'quad', 'green', 'court'), `schoolyard` ('kinder', 'elementary',
'middle'). The city's variants say what stands nearest the glass ('balcony', 'glass', 'ledge', 'planters', 'louvres',
'flowerbox', 'bars', 'open', 'dock') and what is across the street (a composition: 'street', 'corner', 'low', 'square', 'civic', 'hospital'); from 12 m up a city room sees a roofscape below it and a skyline of towers far off; its facades are brick,
stone, render or panel. No two rooms share a view: each has its own seed, and storey and what is nearest the glass
differ.

| Room (film chapter) | Scene, variant | Storey | Outside |
|---|---|---|---|
| home (rise) | `garden` | ground | planter under the sill, terrace, lawn, trees, bench, fence and hedge, neighbours' houses |
| creative (create) | `studio-garden` | ground | herb pots, brick path to an arched gate in an old wall, pergola with string lights, glasshouse, an easel |
| library humboldt (commons) | `humboldt` | ground | three sides: the redwood grove; ferns, lawn and a campus building; the entry plaza. Marine layer |
| occmedialab (coast) | `socal-campus` | 8.4 m | the quad (jacarandas to its sides), a mid-century block, car park, over the mesa's edge the town's tile roofs, the beach and the sea |
| highschool (oilers) | `beach-school` | 4 m | over the fence: the lawn, track and bleachers to the left, palms in clumps, the bluff down to the town, the beach and the sea |
| gym (wellness) | `city` 'square' | 13 m | a high floor, like the photograph: roofs below the eye and the towers beyond (the ground-floor square read as near crowns against the sky through the film's low cameras) |
| gaming (music) | `city-neon` 'corner' | 3.4 m | the side street at the window's edge, neon |
| music (media, night) | `city` 'low' | 3.4 m | a low row of shops, a car park opposite, low roofs and towers far off under the sky |
| workshop (storage) | `yard` | ground | apron, lumber lean-to, shed, trailer, fences, fruit trees, utility pole |
| bedroom | `back-garden` 'bedroom' | 3 m | a slate porch roof below, the garden from above, a patio with a parasol |
| kitchen | `back-garden` 'kitchen' | ground | herb box on the sill, raised vegetable beds, bean poles, greenhouse |
| childroom | `back-garden` 'kids' | ground | sandpit, swing set, trampoline, a tree house (the room had no photograph) |
| office | `city` 'ledge' | 22 m | a stone ledge, the blocks' roofs, the towers |
| coworking | `city` 'planters' | 9 m | a terrace with planters |
| gallery | `city` 'open' | ground | a bench and bike stands on the pavement |
| lounge | `city` 'balcony' | 15 m | its balcony |
| lounge (contemporary) | `city` 'glass' | 30 m | a glass balustrade, roofs, the towers and sky |
| library room | `campus` 'quad' | ground | lawns, oaks and maples, brick wings |
| study | `campus` 'court' | 4 m | a paved court with a fountain |
| college / university | `campus` 'green' / 'quad' | ground / 8 m | an open green and a long wing / a quad |
| kindergarten / elementary / middleschool | `schoolyard` | ground / ground / 4 m | sunflowers and a sandpit / bike racks / a ball court |
| hospital | `city` 'hospital' | 12 m | a forecourt with a drop-off canopy before a white medical block |
| laboratory | `city` 'louvres' | 7.5 m | sun-shade louvres outside the glass |
| mobileit | `city` 'dock' | 1.2 m | a loading dock's edge and bollards |
| government | `city` 'civic+flowerbox' | 6 m | a window box; across, a plaza with flagpoles and a stone portico |
| police | `city` 'bars' | 3.6 m | a security grille |
| security | `city` 'ledge' | 38 m | the roofs below, towers level with the room |

The scifi room has no window to the outside (a space station), so it has no scenery.

## Trying it

`windowView(room)` picks the view: `?window=scenery` in the Studio's address (`?window=painted` for the canvas the
room paints itself, `?window=photo` for the photograph), `localStorage['ergoflex.windowView']`, or
`globalThis.__efWindowView`; otherwise `DEFAULT_VIEW` in `window-scenery.mjs`. The 3D scenery is the default for every
room since Nov 13 2026 (`DEFAULT_VIEW = { '*': 'scenery' }`); one room gets its photograph back with e.g. `library: 'photo'`. The Humboldt commons is
`library-humboldt` and the contemporary lounge `lounge-contemporary` (their own ids, so they can go first). A film chapter whose room
changes needs its re-render. Test stills of a chapter: add `"ergoflex.windowView": "scenery"` to a copy of the seed
passed to `render-cut.cjs --storage`.

`tests/window-scenery-test.mjs` checks the module without a browser (every scene, its cost, that it is outside the
wall, the hours, several openings, walls facing different ways, the opening test, reuse, draw order and sharing, the
land lit from the sky's sun, a navy party, leaves under lamps, three city compositions, sky from high floors, the sea in
view). `tests/window-scenery-rooms-test.cjs` builds every room in scenery mode in a browser (a world per wall, shaders
compiled, daytime parties, the window against the frame after dark, the photograph path without scenery).

## Adding a room

Call `attachScenery(panes, scene, { floor, seed, storey })` after the panes are placed (rotation set), keep the photo
path unchanged (`view === 'photo' ? attachVista(...) : null`), and call `scenery?.setHour(mode)` where the room calls
`windowVista.setPhase`. A new kind of place is a function in `window-scenery-scenes.mjs` built from the kit.

## Known weaknesses

- Facades nearest the glass are modelled boxes with flat colours and a grain; no brick or window texture.
- Cars are simple extrusions, parked; two have their lamps on after dark. No people outside.
- Conifer and redwood sprays are flat cards; seen edge-on from a grazing camera they thin out.
- The high school's beach is below the sill from a camera standing back in the room (the sea is what it sees); close
  to the glass, or in the film's camera, the roofs and the beach show.
- Blinds: many rooms lower theirs over the scenery at some hours (the owner's call, unchanged).
