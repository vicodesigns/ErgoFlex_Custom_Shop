# Lounge clearances and triangular tables — 21 October 2026

## Changes

- The supplied triangular table has two selectable Prop Library entries: **oak & brushed steel** and **clear acrylic**. The original ID remains the oak/steel version, so existing placements keep their editor identity. The acrylic variant uses the same geometry and dimensions, with transparent panels and steel hardware.
- Removed the cyan/purple placeholder materials. Instance-owned oak colour grain, steel roughness maps and generated surface UVs work on the supplied model, which has no UVs. The cached source GLB stays unchanged. Updated both library thumbnails and their cache revision.
- Daily arrangements now calculate lounge-seat/table clearance from authored footprints. Each phase reserves 65 mm between their bounding boxes. The planner first moves a chair locally; in a tight corner it can reposition a small side table with its books, cup and activity kit. Room boundaries and other furniture participate in the search. Plans are cached per phase and never accumulate previous phase transforms.
- The initial audit found chair/table intersections in 17 layouts, spanning offices, homes, artist rooms, bedrooms, studies and a gallery. The final audit finds no lounge-chair/table bounding-box intersections in any of the 105 layouts and five phases.
- Compact home-office seating needed a separate layout correction: the lounge chair now occupies a straight reading bay and the task chair pulls toward the open left aisle. Only exact untouched old defaults are migrated from saved projects; custom positions, rotations and scales are retained.
- Free item rearranging remains unrestricted. This clearance pass governs authored daily defaults, not arbitrary custom arrangements or a general room collision solver.

## Verification

- **28 environments / 105 layouts / 525 activity states passed** the full environment regression. It checks seating clearance, surface contact, finite geometry/transforms, round-trip phase drift, contextual kits, hidden-item preservation and source-cache isolation.
- Both table variants passed dimension, UV, physical-material, independent-instance and resource-disposal checks.
- Office and Home passed **2 × 5** lighting/finish/shadow/disposal checks.
- Rendered the compact Office, Home and Study reading corners at all five phases. After visual review, adjusted the compact Home chairs and re-rendered afternoon and social phases; the targeted five-layout Home regression also passed, including preservation of custom edits during migration.
- Syntax and scoped whitespace checks passed. The server at port 3000 serves the `table-clearance-20261021` entry point and updated material module.

Review files: `scene-shots/table-clearance-20261021/`. The full report precedes the targeted migration-only test, whose report is saved separately. Temporary full image sets are in `/tmp/ergoflex-table-clearance-20261021/` and `/tmp/ergoflex-table-home-final-20261021/`.

Preview: `http://localhost:3000/?room=office&view=room&layout=apartment&tour=1&v=table-clearance-20261021`.
