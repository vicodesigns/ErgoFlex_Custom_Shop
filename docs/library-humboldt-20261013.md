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

## Research

- [Study Spaces](https://www.humboldt.edu/library/services/use-your-library/study-spaces)
- [Innovative Spaces](https://www.humboldt.edu/library/spaces/innovative-spaces)
- [Humboldt Scholars Lab](https://www.humboldt.edu/library/spaces/innovative-spaces/humboldt-scholars-lab)
- [Directions and Floor Maps](https://www.humboldt.edu/library/building/directions-floor-maps)

The library website describes a 24/7 study space in Nelson Hall East, outside
the Library. The scene's “Late study” setting does not imply Library hours.
