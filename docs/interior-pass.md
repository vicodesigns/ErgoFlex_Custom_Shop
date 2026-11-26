# Interior pass (film and Director)

25 November 2026, branch `director/fable-interior`. Code: `interior-cinema.mjs` (tools and rules),
`interior-cinema-rooms.mjs` (one recipe per film room), hooked into `WorkspaceRoom.set` in `workspace-3d.mjs`.

## What it is

The rooms were lit evenly: every wall the same value from skirting to ceiling, every corner as bright as the middle of
the room. The pass shapes the light the way a set is flagged and washed, with overlays only:

| layer | what it does |
|---|---|
| `envelope` | shade under the ceiling line, in the corners and (for a wall that stands against the light) evenly on the window wall; the floor falls off toward the walls |
| `washes` | additive light landing on walls: daylight raking in from the window end, scallops under track heads and downlights |
| `pools` | additive light landing on the floor (tool exists; no recipe uses it yet) |
| `finishes` | corrections to architectural materials (tool exists; no recipe uses it yet) |
| `dressing` | plain built pieces (tool exists; no recipe uses it yet) |

No real lights, no shadow maps, no scene assets. Every overlay is transparent, writes no depth, is not a ray target, a
collider or a Groove obstacle, and is named `Interior pass: …`.

## Where it runs

* Only in the presentation stage (the Director's live view, Render still, bakes and film renders). The Studio's rooms
  are unchanged.
* Only for the room and layout a recipe names (the nine film rooms below). A room's Classic look gets no pass.
* **Off unless asked for.** `?interior=1` on the Director's or the stage's address switches it on; `?interior=1,-washes`
  (or `-envelope`, `-pools`, `-finishes`, `-dressing`) drops single layers. Only the coast recipe was seen in a still
  before the session was wound up; see `docs/fable-handoff-interior.md`. To make it the default: `DEFAULT_ON` in
  `interior-cinema.mjs` (then `?interior=0` is the off switch).
* Renders: `render-still.cjs` and `render-cut.cjs` take `--interior 1` (or `1,-washes`; `0` = off). Chapter cache keys do
  not hash code or this switch, so a cached chapter keeps its old frames until it is re-rendered (force, or an epoch
  bump).

## Rules it keeps

* Cameras, timings, choreography, people, props and saved Studio layouts are not touched. Nothing a room builds is
  moved, hidden or renamed, so Director prop edits and Layers hides keep their targets.
* Desk LEDs: the shade draws before every additive overlay (render order .5; contact shading 1, sun patch and lamp pools
  2, desk LED floor light 3). The LED light lands on top of it at full strength. The two night rooms (music, media) get
  a floor falloff only: their walls are lit by the desk and are left alone.
* Screens and lit signs on a wall are found when the room is built and cut out of that wall's shade, like the windows.
* Wall overlays are children of their cutaway wall and vanish with it. They stand 52 to 136 mm off the wall plane, clear
  of cladding (wainscot, slats) so they cannot fight it in depth at 4K.
* Dayparts: every layer has levels for morning, afternoon, evening, night, party, applied from the room's own
  atmosphere call, so a chapter's `timeOfDay` blend carries them.

## Rooms

| chapter | room / layout | steps |
|---|---|---|
| 2 rise | `home/house` | envelope (window wall against the light, side walls toward ceiling and far corners, floor under the walls); window light along both side walls |
| 3 create | `creative/premium` | envelope (brick wall toward ceiling and the materials corner, daylight wall against the light); three gallery track scallops on the brick |
| 4 commons | `library/humboldt` | envelope at the study end only (tackboard wall toward the pilot corner, carpet under the back and tackboard walls) |
| 5 coast | `occmedialab/house` | envelope (window wall against the light, teaching and display walls, carpet); daylight raking along the teaching wall |
| 6 oilers | `highschool/house` | envelope (as coast); daylight raking along the teaching wall |
| 7 wellness | `gym/house` | envelope (corners, ceiling line, rubber floor under the walls); four downlights grazing the slatted wall |
| 9 music | `gaming/house` | floor falloff only |
| 10 media | `music/house` | floor falloff only |
| 11 storage | `workshop/house` | envelope (block walls toward ceiling and corners, slab under the back and right walls) |

Chapters 1, 8 and 12 are the black product stage and have no room.

## Tools

* `node tools/experience/interior-probe.cjs --cut <cut.json> --shot <chapter id> [--match <regex>] [--eval <js>]`:
  what a chapter's room is made of (layout, walls, lights, big surfaces, furnishings with their boxes in room
  millimetres). Needs a render server (`node tools/experience/render-server.cjs 3017`).
* `node tests/interior-pass-test.mjs`: where the pass runs, that every film room has a recipe, that overlays are
  presentation only, draw order, wall orientation, dayparts.

## Adding to a recipe

A recipe is `{ steps: [...], shell(pass, room), furnished?(pass, room) }` under the key `room/layout`. `shell` runs when
the room's shell, ceiling and surfaces are built; `furnished` when props and room life are in. Sizes are room
millimetres (`pass.x0`, `pass.x1`, `pass.back`, `pass.front`, `pass.h`). Levels are
`[morning, afternoon, evening, night, party]`. Do not attach light to something Vico can move in the Director unless it
is parented to that thing.
