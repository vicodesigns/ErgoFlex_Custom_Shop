# Window views: modelled places behind the glass (November 13, 2026)

Vico, November 12: the windows "are too bright and compete with the room environment"; "I am kinda liking the old
versions"; "open to 3D environments outside of the windows to make the depth and feeling of more immersion".
November 13, after the garden trial in the home room: "I like that 3D like environment for the outside of the window",
for all the environments. The default stays the photograph until he chooses (one line, below).

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
- **Its own light.** No textures, no shadows, the room's lamps do not reach it. Each vertex carries its daylight
  colour and the light the place's own lamps throw on it after dark (street lamps, lit windows, garden lights: pools
  baked per vertex), plus a mesh of what glows and soft halos round the lamps.
- **The hour** (`HOURS`, a scene's own `hours`, `setHour`): a tint, haze toward the colour of the air, the lamps, the
  sky (gradient, sun or moon, clouds, stars). All of it numbers, colours and vectors, so the film's time-of-day blend
  carries them (the sun's direction too: it is a uniform in the window's frame).
- **Calm**: `LEVEL` (.8) scales everything outside; colours are muted on purpose and the far ground goes into haze.
- **Cost**: per room about 45 000 to 77 000 triangles (the library, with glass on three sides, about 120 000); things the
  room's cameras cannot see through the openings are not built; built once
  and kept (the last four) for when a room is rebuilt.

## The places

| Room (film chapter) | Scene | Storey | Outside |
|---|---|---|---|
| home (rise) | `garden` | ground | planter under the sill, terrace, lawn, trees, bench, fence and hedge, neighbours' houses, a street lamp |
| creative (create) | `studio-garden` | ground | pots of herbs on gravel, a brick path to an arched gate in an old wall, lavender, a vine pergola with string lights, fruit tree, birch, glasshouse, carved stone, an easel |
| library humboldt (commons) | `humboldt` | ground | back glass: the redwood grove in the fog; long glass: ferns, a path, the lawn, a campus building, redwoods; vestibule: the entry plaza. Marine-layer hours |
| occmedialab (coast) | `socal-campus` | a floor up | succulents below, palms and benches on the walk, the quad's jacarandas, a mid-century block with sunshades, the car park, palms and hills in the haze |
| highschool (oilers) | `beach-school` | ground | succulents, the fence, the track and field, goalposts, bleachers, floodlights, rows of fan palms, low roofs, a pumpjack |
| gym (wellness) | `city` | ground (apartment: 4 floors up) | planter and railings, the pavement's plane trees and lamps, parked cars, the row across with shops, taller blocks, towers |
| gaming (music) | `city-neon` | upstairs (apartment: 5 floors) | the same street with neon signs over the shops and on the towers, a violet glow after dark |
| music (media, at night) | `city` | upstairs (apartment: 4 floors) | a different street of the same city (own seed) |
| workshop (storage) | `yard` | ground | concrete apron, sawhorses, a lumber lean-to, a shed, a trailer and a pickup, chain-link and board fence, fruit trees, a utility pole and wires, the neighbours |

## Trying it

`windowView(room)` picks the view: `?window=scenery` in the Studio's address (`?window=painted` for the canvas the
room paints itself, `?window=photo` for the photograph), `localStorage['ergoflex.windowView']`, or
`globalThis.__efWindowView`; otherwise `DEFAULT_VIEW` in `window-scenery.mjs`. Making scenery the default:
`DEFAULT_VIEW = { '*': 'scenery' }` for every room, or add one room, e.g. `music: 'scenery'`. A film chapter whose room
changes needs its re-render. Test stills of a chapter: add `"ergoflex.windowView": "scenery"` to a copy of the seed
passed to `render-cut.cjs --storage`.

`tests/window-scenery-test.mjs` checks the module without a browser (every scene, its cost, that it is outside the
wall, the hours, several openings, walls facing different ways, the opening test, reuse).

## Adding a room

Call `attachScenery(panes, scene, { floor, seed, storey })` after the panes are placed (rotation set), keep the photo
path unchanged (`view === 'photo' ? attachVista(...) : null`), and call `scenery?.setHour(mode)` where the room calls
`windowVista.setPhase`. A new kind of place is a function in `window-scenery-scenes.mjs` built from the kit.

## Known weaknesses

- Leaves are small faceted sprays over a lumpy mass: they read as foliage at a distance and a little papery close up.
- Conifers' branch tiers are regular; redwood sprays are flat layers.
- Cars, people and anything that moves: none (cars are parked; two have their lamps on after dark).
