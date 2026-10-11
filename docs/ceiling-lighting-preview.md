# Ceiling and bounced-light preview

Open `/?setup&room=library&view=room&layout=house&ceiling=on&v=ceiling-bounce-20261011`.

## Comparing the result

- **Ceiling preview** adds a ceiling at the room's declared height. Choose
  **Camera → Inside room** to inspect it; **Whole room** provides the overhead
  cutaway. The ceiling and suspended fixtures hide when the camera is above
  the ceiling plane, using room-local coordinates.
- **Bounced lighting** compares the revised light balance with the original
  direct lighting while retaining the ceiling. It starts enabled with the
  ceiling preview. Both preferences are remembered in this browser.
- Change the scene's time/activity buttons. Existing Main light and Accent
  light sliders also affect the reflected light. Music and Game LED colours
  contribute to the bounce through the existing visible LED pixel atlas.

All 27 measured environments support the preview. Rooms such as Library use
pale plaster; Music, Gaming and Sci-fi use an absorbing dark ceiling. The
ceiling receives existing light and shadows, remains an architectural surface,
and is not draggable furniture or a collision obstacle. It does not change
desk configuration, project placements, purchase pricing or AR output.

## Implementation

- `workspace-3d.mjs` owns the ceiling plane and camera cutaway.
- `room-bounce-light.mjs` samples twelve architectural patches: four ceiling,
  four floor, three walls and one zero-area open front. Floor and wall colour
  come from the actual large architectural materials; readable textures are
  averaged in linear colour space. Dark finishes absorb more energy.
- Patch illumination uses the current key/fill/rim/hemisphere lights and the
  room's existing practical lights. A bounded diffuse view factor adds their
  reflected colour to opaque, non-emissive room Standard/Physical materials.
  Receiver albedo and metalness control the response.
- `room-led-spill.mjs` shares the material/shader binding with the existing LED
  spill. The average visible sRGB pixels of each strip are converted to linear
  colour for secondary bounce; disabled LEDs contribute zero. Direct strip
  spill keeps its spatial pixel sampling.
- `studio.js` configures bounce from the authored daypart and current sliders,
  reducing flat hemisphere/fill/environment light slightly when bounce is on.
  Repeated toggles rebuild from the profile and do not accumulate brightness.
  The shader uses world normals, including instance transforms.

This is a single, unoccluded diffuse-bounce approximation. It does not trace
rays around furniture, simulate multiple reflections, produce mirror
reflections or make the ceiling block the existing daylight rig. The virtual
architecture continues to supply bounce when its camera cutaway is hidden.
The ceiling adds one mesh. Bounce introduces no additional Three lights,
shadow maps, draw calls or post-processing passes; the added material shader
calculations have a runtime cost.

## Verification

`npm run test:room-ceilings` checks bounds and translated-camera cutaways in
all 27 environments, bounce stability across five dayparts, LED atlas colour
response and LED-off reset. It renders all five dayparts in Library,
Co-working, Lounge and Music Studio, checks toggles and unchanged light counts,
and captures comparisons in `/tmp/ef-ceiling-preview`.

`npm run test:notebook-restoration` reproduces legacy saved journal scales in
Library and Co-working and verifies edited placements, sizes and a second
reload. The metre-to-millimetre migration applies only to the authored notebook
replacement; stock or uploaded GLBs keep their own scale convention.
