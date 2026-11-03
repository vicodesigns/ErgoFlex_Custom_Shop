# Surface contact and seating — 21 October 2026

## Improvements

- Daily activity kits resolve the actual nearby tabletop surface once during initial construction, before saved Studio edits are restored. Imported inset tops and thin runners are handled in millimetres. Unresolved kits are never dropped onto the floor.
- Large gallery kits now use the existing salon coffee table instead of the removed small side table. Music studio kits and loose journals follow the imported coffee table and its inset top.
- The compact office's triangular table now has coordinated oak, dark metal and upholstery-palette finishes. Its notebook kit sits on the usable left part of the top beside the existing journal. Materials are cloned per instance; cached GLBs are unchanged.
- Institutional editable journals use a clear front-left working bay, separated from the classrooms' science models, changing clipboards and project materials. OCC retains its authored storyboard anchor.
- Kitchen shared materials clear the existing serving arrangement. Humboldt shared materials use the end of the first reading table, clear of its afternoon student work.
- Meeting seats bind to the nearest table edge, including end seats. They pull outward during activity, tuck inward at night and follow the table's modest movement. Existing Humboldt choreography and library seat routines remain in their own systems.
- Activity notebook materials across all 28 environments gain subtle paper fibre, woven cover relief, bound-spine shading and inset stitching. Relief is expressed in world metres (0.045–0.10 mm), with small 128px generated maps and no extra geometry.

## Validation

- Full environment regression: **28 environments, 105 layouts, 525 activity states passed**. Checks include finite transforms, no daypart drift, one visible kit, contextual content, measured surface contact in every phase, notebook material relief, hidden-item preservation and cached-model material isolation.
- Office and Library lighting regression: **2 environments × 5 times passed**, including materials, shadow coverage and resource disposal.
- Rendered close-up and wide views of premium music/gallery, compact office, and house coworking/kitchen/HBHS. The final compact-office renders supersede its earlier placement/placeholder-colour images.
- Syntax and scoped whitespace checks passed. Local server confirmed serving `surface-seating-20261021`.

These changes update authored defaults and instance finishes; they do not write browser storage or rewrite saved layouts, artwork or Product builds.

Artifacts: `scene-shots/surface-seating-20261021/`. Full temporary captures: `/tmp/ergoflex-surface-seating-20261021/` and `/tmp/ergoflex-surface-office-final-20261021/`.
