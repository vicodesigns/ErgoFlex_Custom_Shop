# Humboldt commons: group work and daily life

The long commons/gallery shell and existing furniture editor keys are retained.

## Five settings

- **Opening / stand:** marine-layer daylight, one closed laptop ready for later, coffee, book returns and sparsely occupied reading tables.
- **Research / together:** the ErgoFlex rolls from its wall bay alongside a 2400 × 1400 mm shared table. Four conference chairs, individual research materials and a central annotation sheet place its user in the group.
- **Dusk / reading:** the desk returns to its wall position for an 8° reading surface. The shared table has one reader, laptop screens soften, and the reading nook gains a warm mushroom lamp, cups and books.
- **Closing / storage:** the desk returns to the wall and tilts to 65°. Existing storage above 9° remains active. Tables clear, chairs tuck, returns fill, and the gallery's secondary circuit switches off.
- **Project / together:** the desk rejoins the shared table at seated height for a mapping workshop. A folded field map, sample tray, ruler, notes and markers replace the afternoon annotation activity. Boards and welcome materials describe project night; warm collection and work lighting distinguish it from daylight research.

## Arrangement

The project table is at `[5500,1600]`; the desk's group destination is `[7600,1600]`, yaw 0, height 29.53″ (approximately the 750 mm shared worktop), tilt 0°. Both 48″ and 60″ desk footprints join its east end with a small gap. The user's position faces the same direction as the adjacent south-side peers, with the monitor and shelving toward the far edge.

The mobility chair moves into `[7600,2950]` for the two group sessions. The spare task chair parks at the wall. A 1500 mm turning circle at `[6500,4350]` and a tested approach route remain outside surrounding furniture. This is a design visualization, not a surveyed installation or a certification of accessibility.

The lounge pair and side table move to a separate reading nook; the second board faces the collaborative zone. No existing prop indices were reordered; new chairs, mobility seating and the reading lamp were appended. The lamp and small daily objects follow the side table when edited.

## Materials and light

Satin laminate and brushed metal distinguish the shared table from the maple reading tables. Fine woven bump relief improves the conference-chair pads; moss upholstery and satin bronze distinguish the four new shared-table seats from the aubergine reading chairs. The existing five room PointLights are retained, with one redirected to the collaborative zone; broad low-intensity work and reading pools add local contrast. The lamp's existing emissive lighting follows room time. Daylight, dusk, closing and project night retain distinct ambient, window and practical-light states.

## Saved work

`humboldt-furniture-migration.mjs` updates exact old default positions/rotations for the relocated table, two lounge seats, plant, board and side table. User position and rotation edits remain intact. Daily chair and mobility-seat staging uses reversible deltas, so saving in a group session does not freeze the furniture in that daypart. Saved personal Groove positions still take priority.

Product-linked Humboldt graphics and independent 48″/60″ builds remain in place. The earlier canvas/laptop storage fixes are unchanged.

## Verification

- `node tests/humboldt-furniture-migration-test.mjs`: exact defaults, idempotence, custom position/rotation preservation and no input mutation.
- `node tests/humboldt-group-study-test.cjs`: both widths, exact swept routes between every pair of five daily destinations, mobility-seat approach, 1500 mm turning area, level group height, five different table dressings/notice graphics/light states, decals and repeated reversible chair staging.
