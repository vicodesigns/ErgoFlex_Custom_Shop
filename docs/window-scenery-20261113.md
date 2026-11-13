# Window views: a modelled garden behind the glass (trial, November 13, 2026)

Vico, November 12: the windows "are too bright and compete with the room environment"; "I am kinda liking the old
versions"; "open to 3D environments outside of the windows to make the depth and feeling of more immersion".
The photographs were calmed that night (`window-vista.mjs` `CALM`). This is the other route, tried in one room.

## What it is

`window-scenery.mjs`: in the home room a garden is built outside the window instead of a picture on the pane.
Planting in a timber planter just above the sill, a stone terrace, a lawn, three trees and a bench, a flower border,
a board fence with a hedge at 15 m, two neighbouring houses and their trees beyond, a low wood at the horizon. Near
things slide against far ones when the camera moves, which a photograph (at the horizon) and a painted pane (on the
wall) cannot do.

- **Seen only through the opening.** The rooms are cutaways, so geometry behind a wall would show beside and above
  it. Each fragment is kept only if the sight line from the camera to it crosses the window's rectangle
  (`throughWindow` in the shader; no stencil and no clipping planes, so it holds in the film's render targets and the
  reflection capture). From outside the wall nothing is drawn.
- **Its own light.** One mesh, a colour per vertex with a fixed daylight baked in (`Builder`), no textures, no
  shadows, about 60 000 triangles. The room's lamps do not touch it.
- **The hour** (`HOURS`, `setHour`): a tint over the garden, haze toward the colour of the air, lit windows and
  garden lights after dark, and the sky. All of it is uniforms, so the film's time-of-day blend carries them.
- **The sky** is drawn on the pane by view direction (it is at infinity): a gradient, a soft sun or moon, clouds.
  The pane writes no depth and is drawn first; the garden shows in front of it.
- **Calm**: `LEVEL` (.8) scales everything outside. Greens are muted on purpose.

## Trying it

The default is unchanged (the photograph). `windowView()` picks the view:

- `?window=scenery` in the Studio's address (or `?window=painted` for the canvas the room paints itself, the look
  before the photographs), e.g. `http://localhost:3000/?room=home&window=scenery`;
- `localStorage['ergoflex.windowView'] = 'scenery'` (stays until removed);
- `globalThis.__efWindowView` for a test or a film; test stills of a film chapter: add
  `"ergoflex.windowView": "scenery"` to a copy of the seed passed to `render-cut.cjs --storage`.

Only the home room (`home-office.mjs`) has scenery. `tests/window-scenery-test.mjs` checks the module without a
browser. Comparison: `exports/slides/windows-20261113/`.

## If Vico takes it

- Make it the default per room (a film chapter whose room changes needs its re-render: his call).
- A scene per kind of place, reusing `Builder`: city (facades across a street, for the gym, office, music room,
  lounges), campus (lawns and a building wing), coast (the high school's beach), yard (the workshop).
- Better foliage would be the first thing to spend on (the trees are clumps of rounded masses).
