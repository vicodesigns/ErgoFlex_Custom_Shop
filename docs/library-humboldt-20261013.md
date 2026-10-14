# Humboldt-inspired Library pass — October 13, 2026

This pass focuses on the five Library layouts. It uses Cal Poly Humboldt's
published descriptions of quiet window study, collaboration stations,
portable whiteboards, Authors Hall and digital scholarship as inspiration.
It is an original concept, not a measured replica or a statement of operating
hours at the university.

## Layouts and materials

- Pilot nook: warm oak, forest green, brass,
  one shared reading table and the owner's Library Product desk.
- Campus reading room: one window carrel, a wall mounted discussion board,
  warm reading lamps, a lounge and shelving with separate catalog/returns.
- Learning commons: lighter oak, acoustic carpet, mineral/sage seating,
  linear task lamps, digital research and a powered collaborative zone.
- University study hall: quieter blue-grey carpet, four window carrels,
  three group tables and separated circulation/research functions.
- Flagship commons: six window carrels, four group tables, larger collection
  aisles, a research station and a discussion board.

Circulation counters move to the catalog/returns side of the larger layouts.
Untouched saved furniture defaults migrate to the revised floorplans; custom
positions, rotations and scale edits remain saved. The rolling stack ladder is now a separately editable fixture,
so its projecting feet do not block the whole bookcase in the route planner.

## Floorplan correction

- The campus reading room has one quiet carrel and one freestanding stack;
  the extra pair crowded the desk chair and table approach.
- Larger rooms put digital research in a rear service bay and separate the
  quiet window seats, collection aisles, lounge and shared reading tables.
- Shared seating zones leave at least 900 mm between neighboring groups,
  including chair pull-back space. Stacks retain separate browsing aisles.
- Smaller rugs stay within their zones, with no rug intersections.
- Discussion whiteboards are mounted on the right wall. Recycling is grouped
  against the right entrance wall instead of blocking the study-table approach.
- Desk builds, decals and peripheral adjustments are unchanged.

## Daily use and lighting

Five staged routines have distinct notice-board content and table materials:
book returns/reading lists, North Coast research, evening annotation, tidy
late study, and shared evidence/whiteboard discussion. Research terminals
change content with those settings, including GIS, archives and citation tools.

Books have visible page edges, tabs and printed notes. Table and carrel power
modules, a marker/earplug service caddy, whiteboard markers, Authors Hall art,
coast-redwood artwork and labelled recycling bins add operational detail.

Daylight stays diffuse. Evening and late-study ambient/bounce levels improve
legibility below the ceiling, with warm task pools and subdued secondary
tables at night. Ceiling fixtures use the existing cutaway system; practical
lights remain within the five-light room budget and add no shadow maps.

## Desk and asset fixes

- Both widths continue to use the owner's saved Library Product graphics,
  finishes and accessory placements.
- The supplied iPhone sits on the CAD wireless charging insert (`Power_7`).
  Its position is measured in the desktop mount's coordinates, so it follows
  lift/tilt and saves independently for each width. Editing or removing it
  persists across width changes and reloads.
- The supplied laptop's overlapping CAD base is replaced in the converted
  asset by a closed aluminium shell, thin display, hinge, keyboard, trackpad,
  speaker perforations and USB-C details. The original source is untouched.

## Verification

- `npm run test:library`: five physical layouts, both widths, all 25 time
  combinations, furniture bounds, tabletop contacts, editing and restore.
- `npm run test:library-product-build`: Product graphics and placements,
  additional desks, tilt, size isolation and reload.
- `npm run test:library-humboldt`: 50 layout/width/daypart combinations with
  rug/furnishing overlap checks, shared seating aisle widths, swept routine
  clearances, daily materials/notice boards, charger contact,
  independent phone edits, persistent removal and custom counter preservation.
- Groove planner unit checks and visual review of room/desk day and night views.
- `npm run test:item-shortcuts`: Delete, Ctrl+Z and redo for linked room
  furnishings, default and added desk objects, purchased peripherals, selection
  ownership and protected text/number inputs. These shortcuts work in all
  environments and Product view.

## Item editing

Window carrels participate in Rearrange items. Their journals can be selected,
dragged, rotated and deleted separately; moving or deleting a carrel carries its
linked journals. Delete and Ctrl+Z cover either selection, with persistent removal.
Tabletop props are selectable independently of their support furniture.

Down Arrow (or the selected item's Drop to surface button) lowers an item onto
upward-facing geometry beneath it. It also works for Product desk props, preserves
horizontal placement through transformed mounts, and records a single undo step.
It ignores invisible meshes, shader effects, the selected item and its linked
contents, and raycasts through shelf openings instead of using enclosing boxes.

Verification: `npm run test:item-surface-drop` covers real geometry, carrel/book
selection, linked and independent deletion, drop/undo, Product props and reload.
`npm run test:free-items` verifies free dragging and normal desk collision behavior.

## Expert lighting, materials and furnishing pass

An expert review (lighting, interiors/materials, academic library planning)
rendered all 5 layouts × 5 dayparts and close-ups; this pass acts on it.

- **Evening and Late study** now read as warm task light in a dimmer room:
  lower general light and bounce, stronger practical (lamp) levels. The
  evening window is graded with canvas blend modes (multiply/soft-light), so
  dusk also appears where `ctx.filter` is unsupported (older iOS Safari).
- **Visible light pools** (`room-light-pools.mjs`): additive pools under
  banker's lamps, carrel strips, the floor lamp (floor and wall scallop),
  sconce scallops and every stack aisle. They follow their furnishing, take
  no ray hits, add no collider and use no real lights or shadow maps.
- **Stacks**: linear fixtures over each double-sided stack, finished oak
  range-end panels with brass-framed signs, books instead of ornaments in
  working stacks, and 1090 mm aisles in the University study hall.
- **Seating**: the supplied designer chair replaces the low-poly reading chair
  (scale .82; green leather on bronze in traditional rooms, woven fabric per
  table in modern rooms). Carrel chairs now face their carrels.
  `room.propReplacements` keeps saved placement keys; untouched saved poses
  and scales migrate, edited ones are kept.
- **Materials**: oak table legs with brass caps and a dark lamp rail, oak and
  brass carrel sides, deeper commons carpet, subtle plaster on the long walls,
  a painted frieze and picture rail in the tall rooms, fabric acoustic panels,
  spine-coloured book blocks and an oak lounge table.
- **Objects**: a new-books browsing island in the Flagship commons (supplied
  low bookcases, chairs, plant), a bin beside the research table and a
  desk calendar on the help counter.

## Second expert review and polish

A second, independent panel signed the Library off with polish; this pass
applies it: seamless softer plaster, one carpet tone per tier, late-study task
lights lowered and tightened with less wash, stack sections joined into
continuous ranges in the two largest rooms (end panels only at open ends;
untouched saved stacks migrate), a canopy light on each stack instead of
ceiling rods, a lit discussion board for Study group, a lighter lounge table
and plain shelf-top plants. Study-hall stack rows sit at 4600/6250/7900 mm,
keeping 1090 mm aisles and more than 1 m to the reading tables.

## Research

- [Study Spaces](https://www.humboldt.edu/library/services/use-your-library/study-spaces)
- [Innovative Spaces](https://www.humboldt.edu/library/spaces/innovative-spaces)
- [Humboldt Scholars Lab](https://www.humboldt.edu/library/spaces/innovative-spaces/humboldt-scholars-lab)
- [Directions and Floor Maps](https://www.humboldt.edu/library/building/directions-floor-maps)

The library website describes a 24/7 study space in Nelson Hall East, outside
the Library. The scene's “Late study” setting does not imply Library hours.
