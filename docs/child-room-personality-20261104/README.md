# Growing bedrooms — personality pass

Three specialist agents reviewed early-years/elementary rooms, preteen interests and spatial arrangement, and teen/college interiors and lighting. This pass addresses the previous shared cream/sage shell and tiny decorations that made the ages read alike.

## Changes

- A true opaque **Pearl White** catalog finish, with satin sheen, replaces the authored child-room wood desktop. A persisted one-time upgrade applies it to existing child-room desks; later owner finish edits remain editable.
- Each age has a different wall/dado/feature palette: sky/apricot, lagoon/ochre, denim/clay, indigo/terracotta, or petrol/warm stone. Curtains and bedding coordinate with those colours.
- Large original posters, pinned photographs/postcards, a painted sleep bay, mirrors, backpacks, older-room clothes hooks, extra bed cushions/throws, and cabinet-supported personal belongings make the room read at a wide camera angle.
- Larger rooms gain a grounded clothes wardrobe and linen storage boxes in the clear left-wall bay, so extra floor area has a bedroom purpose.
- The young mirror uses a stylised metallic reflective face; it does not introduce realtime mirror-rendering cost.
- Elementary craft/building, preteen comic/photo work, teen music/portfolio and college annotated research replace the identical tabletop models. Morning, shared-time, reading and bedtime arrangements differ. Bedtime materials remain closed/packed and floors clear.
- Desks have stage-specific work bays, pulled forward from the previous rear-wall default. Shared-time destinations bring the desk 500 mm inward in compact rooms and 650 mm inward in larger rooms. Morning, evening and reset poses differ as well. The Time tour applies these authored child-room poses; Groove can animate the routes.
- Only exact legacy default desk/chair locations move to the new work bays. Deliberately edited positions remain intact. New wall decor retains stable per-stage editor IDs.

## Verification

- `npm run test:environment-finishes`: all25 age/size recipes ×5activities; grounded furniture, room and furniture bounds, activity routes, bedtime states, finish ownership, pearl finish definition and one-time migration behavior.
- Per-layout base plus five activity poses are checked pairwise against furniture (900 route checks in total).
- `node tests/scene-desk-data-test.mjs`: upgrade revision persists and is retained across desk widths; owner accessories/finishes remain independent.
- `node tests/child-screens-test.mjs` and `node tests/catalog-test.cjs` pass.
- Specialist support audits used real RoundedBox geometry for all25rooms and checked125 activity states: wall/window clearance, room bounds, cabinet containment, and tabletop/nook support.
- Isolated browser review exercises45 rendered age/size/activity cases and records desk finish, actual pose, personality palette and desktop support. Rendered evidence and report are saved here after review.

These checks cover authored recipes; users can still intentionally rearrange them through the editor.
