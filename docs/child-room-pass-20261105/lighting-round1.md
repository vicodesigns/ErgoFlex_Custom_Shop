# Lighting & atmosphere · round 1 (2026-11-05)

Role: lighting & atmosphere (residential lighting designer / cinematographer).
Goal: every life stage gets its own light character across morning, afternoon, evening and night,
not a re-tinted copy, at zero extra real-light cost.

## Approach and cost

- **No new Three lights, no new shadow casters.** Every new practical is an emissive mesh; the light it
  throws is an additive decal (the room-light-pools technique, own helper so it also works in the node
  test stub) parented to the wall or floor it lands on, so cutaway walls hide their light with them.
  Decals are `presentationOnly`, `grooveMarker`, no raycast, `depthWrite:false`.
- The existing point lights (reading sconce, moon/practical, personal cabinet lamp) are re-balanced and
  re-coloured per stage and phase. Night reading stays 0 (authored cue x stage factor).
- Per-stage mode overrides (exposure, key power, hemi ambient, sky, key/fill/rim colours) are merged
  into `childModesForStage`, so the studio's key/fill/hemi/exposure follow the stage.
- Each stage paints its own window view (canvas, same 512 texture as before).
- Bounce: `room-bounce-light.mjs` was not changed. It only runs with the ceiling preview on and reads the
  re-balanced point lights automatically. `room-light-pools.mjs` was not changed either (its radial
  gradient crashes the node test's canvas stub, so the child room uses a local helper with the same rules).

## Per stage

| Stage | Character | Morning / afternoon | Evening | Night (bedtime) |
|---|---|---|---|---|
| Early years | Nursery pastels, soft and enclosed | Soft fresh daylight, hills and round trees outside | Golden low sun on the floor by the desk, warm pool on the story cushion, first faint stars | **Plug-in star projector** beside the bed: stars, bokeh and a crescent drift over the sleeping bay; amber crescent; pale moonlight patch on the floor |
| Elementary | Bright, cheerful school days | Crisp bright daylight, picket fence; a red kite in the afternoon sky | Orange sunset, warm reading cushion, cabinet lamp scallop | **Rocket night-light** above the bedside table and the **hall door left ajar**: a warm wedge across the floor |
| Preteen | Rose and lilac dusk, dreamy | Pink-peach morning, suburban roofs | Rose/lilac sunset, **warm fairy lights with clipped photos** swagged over the bed, lit windows across the street | Fairy lights low as the bedtime practical, indigo sky |
| High school | Moody, saturated, a bit cooler by day | Cooler grey-blue daylight, rooftops, streetlight and wires | **Violet LED cove** along the ceiling line and an **original neon wave sign** above the desk; teal-to-orange dusk | LED cove in **amber sleep mode** (neon off), streetlight in the window |
| College | Grown-up, 2700 K, quiet late work | Neutral daylight, a city skyline across the street | **Brass swing-arm lamp with a glowing linen shade** over the bed (down scallop, up scallop, pool on the pillows), city at dusk with lit windows | Swing-arm low, lit city windows under the blind |

Stills (house size, all four phases each, 1280x720): `lighting/r1-<stage>-house-<phase>.jpg`, plus 2x2
contact sheets `lighting/r1-sheet-<stage>.jpg` and desk-LED-on checks `lighting/r1-leds-*.jpg`.

## Files

- NEW `child-lighting-detail.mjs`: stage practicals, light decals, point-light re-balance, window views.
- NEW `child-lighting-profiles.mjs`: pure per-stage mode table (no Three import, so
  `child-growth-profiles.mjs` and `tools/child-growth-review.html` still load without an import map).
- `child-growth-profiles.mjs`: one import + one spread in `childModesForStage`.
- `child-room.mjs`: one import, `lighting=enhanceChildLighting(...)` in the enhancer list, a one-line
  `paintSky` delegation and `lighting.update(phase,accent)` at the end of `roomAtmosphere`.
- `tests/child-room-test.mjs`: new coverage only (no extra/shadow lights, decals are overlay-only,
  stage fixtures stay on their wall inside the room, a bedtime practical is on, teen neon off at night).

New stable editor IDs: `light-star-projector-early`, `light-rocket-nightlight-primary`,
`light-fairy-swag-preteen`, `light-led-cove-teen`, `light-neon-sign-teen`, `light-swing-arm-college`.

## Tests

All green at the time of writing (shared tree, other experts' edits included):
`npm run test:environment-finishes` exit 0 (includes `tests/child-room-test.mjs` with the new lighting
assertions over all 25 stage/size layouts x 5 phases), `node tests/scene-desk-data-test.mjs` exit 0,
`node tests/child-screens-test.mjs` exit 0, `node tests/catalog-test.cjs` exit 0.

## Exposure check

Measured on the real render (room pixels only, black backdrop excluded; luma 0-255, clip = share > 250):

| Stage | Morning | Afternoon | Evening | Night |
|---|---|---|---|---|
| Early | 138 / 0.56% | 142 / 0.46% | 105 / 0% | 56 / 0% |
| Elementary | 127 / 0% | 133 / 0% | 97 / 0% | 47 / 0% |
| Preteen | 122 / 0% | 127 / 0.06% | 106 / 0.53% | 50 / 0.06% |
| High school | 88 / 0% | 93 / 0% | 73 / 0.34% | 36 / 0% |
| College | 108 / 0% | 115 / 0% | 92 / 0.49% | 42 / 0.03% |

Nothing washes out (the < 0.6% clipped pixels are lamp faces, the neon tube and the early-years
morning sun patch). Teen night is the darkest (13% of room pixels below luma 14) by design: amber cove
and cabinet lamp only. Desk LEDs on (`r1-leds-*`): the default cyan desk LEDs add a cool pool on the
desk side and lift night luma (teen 36 -> 50, college 42 -> 57, early evening 105 -> 116) with no
clipping; the amber cove and cyan desk light read as two separate sources rather than mud.

## Honest weak spots / round 2

- The camera used for review is far away; the small practicals (projector puck, rocket) read as dots.
  Their light (stars, wedge, wall glow) is what reads. Close-ups were not rendered.
- The authored "moon" point light behind the disc above every bed still makes a hot orange spot on the
  wall at night for elementary/teen/college (reduced to 0.45-0.7x, not removed: it is the tested
  bedtime practical). Round 2: turn it into a proper bedside lamp per stage or lower it further.
- Teen/preteen mornings are inherently darker than the younger rooms (navy/wood palette); I raised
  teen exposure to 1.07 but did not brighten the palette (not my area).
- No monitor glow on surfaces: the decals are static and the desk moves per phase, so a screen pool
  would drift off the desk. Round 2: parent a screen pool to the desk rig.
- Sun patches are approximate decals on top of the real shadow-mapped sun; they ignore furniture
  occlusion (kept faint for that reason). Larger sizes (spacious/premium/executive) and apartment were
  covered by the node test only; stills are house size only.
- The college room has another expert's festoon string along the rear wall top; it is unlit (their
  emissive). Worth making it glow in evening, coordinated with the walls/decor owner.
