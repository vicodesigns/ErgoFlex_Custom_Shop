# Early-years rooms: murals and collected artwork

This pass makes the existing five early-years interest portraits read as warm children's rooms at a wide camera angle. It adds painted wall area and collected personal details without changing the authored furniture layout.

## Visible changes

- Two broad matte murals per early-years room: a rear-wall landscape and a side-wall scene beyond the window/curtains.
- Each profile supplies a different story: woodland animals, a pretend village, bridges and delivery trucks, storybook towers and balloons, or a rhythm forest.
- Broad painted hills, clouds, sun and a subtle dry-brush speckle treatment soften the clean graphic edges.
- High fabric bunting follows the rear wall, above the existing displays.
- Three little taped paintings use imperfect crayon strokes, finger-paint marks and a crooked signature: flowers/sun, family figures and a house.
- Larger-room wardrobes gain two taped drawings so the tall storage furniture feels personal.
- Small bedtime star stickers have a quiet emissive finish; the pass adds no lights or animation loops.

The murals occupy measured solid wall faces. They do not cross the window opening, curtain bay or floor. Existing furniture and owner-edited transforms are retained; new decorative groups have stable per-layout editor IDs. Older age stages do not receive this layer.

## Verification

- `npm run test:environment-finishes` covers all 25 stage/size recipes × 5 activities using the actual RoundedBox geometry helper. It includes new mural/gallery/bunting/star bounds and window clearance, plus existing furniture placement, desk routes, ground contact, finish ownership and bedtime behavior.
- Scene-desk data and child-screen tests pass.
- The browser's 25-case early-years review passed across all five sizes and activities. All cases retained both murals, matching activity metadata, the Pearl White desk and supported activity kits with zero reported overlap. Rendered stills and the DOM-derived `browser-report.json` are retained here; daytime and bedtime views were visually inspected.
- All new canvas textures are created once per built room, cached within it and registered for room disposal. No per-frame canvas redraw, realtime mirror or additional shadow light is introduced.
