# Scene desk styling · 10 October 2026

## Design

All 27 furnished environments have catalog-based desktop, frame and trim
palettes. Natural Woods, Signature Stains & Finishes, and the Bespoke Collection
are used together. Finishes remain consistent across the five times of day;
lighting and the activity materials change instead of repainting the physical
desk at night.

| Environment | Desktop | Frame / trim |
| --- | --- | --- |
| Home office | White Oak | Sand / Green |
| Office | Modern Grey | Space Gray / Black |
| Library | Earthy Forest Green | Black / Gold |
| Co-working | White Oak | White / Green |
| Music studio | Black Birch | Black / Grey |
| Gaming | Carbon Weave Wrap | Black / Red |
| Artist studio | Warm Ivory | Sand / Grey |
| Study | Walnut | Forest / Green |
| Lounge | Walnut | Sand / Gold |
| Kitchen | White Birch | White / Green |
| Home gym | Modern Grey | Black / Green |
| Sci-fi bay | Brushed Silver Wrap | Space Gray / Black |
| Bedroom | White Oak | Sand / White |
| Workshop | Maple | Space Gray / Black |
| Gallery | Warm Ivory | Black / Black |
| Security operations | Deep Navy | Black / Grey |
| Police | Modern Grey | Navy / Grey |
| Government | Walnut | Black / Gold |
| Kindergarten | Natural Birch | White / Yellow |
| Elementary | Maple | White / Green |
| Middle school | Modern Grey | White / Green |
| High school | White Birch | Space Gray / Grey |
| College | White Oak | Navy / Black |
| University | Earthy Forest Green | Black / Gold |
| Hospital | White Birch | White / Forest Green |
| Laboratory | Modern Grey | White / Black |
| Mobile IT | Carbon Weave Wrap | Space Gray / Grey |

Supporting ErgoFlex stations retain their authored size, role, tools and pose.
Their instance-owned frame/trim material copies vary within the scene's palette;
they do not recolor the live desk or shared source model.

## Activity materials

The main desk's existing stable `scene:desktop:daily-kit` key now contains
five scene-specific variants: project and reading notes, music scores, art
studies, diagrams, workout logs, recipes, lesson materials, generic shift notes,
clinical workspace checklists, lab records and IT service logs. Night generally
closes the journal; early-education and art workshops add colored cards.

Printed content is original and generic. Clinical, laboratory, public-service,
technical and school kits use work materials without drinks. Selected lifestyle
morning kits retain a single cup beside the journal. Existing role
props, specialized procedural instruments and saved object keys are retained.
The ornate stock journal is replaced on main and supporting desks by a printed
scene-specific notebook, retaining its prop ID and horizontal footprint. The
daily kit chooses a clear front corner from the existing desktop props' bounds
and the individual triangles of merged procedural tools. Light-pool overlays
are excluded. Rear shelf-hidden placements are avoided; its
stable asset key still restores deliberate customer placement.
The kit follows its desktop through lift, tilt and driving; daypart selection
changes its child visibility rather than its mount or saved position.

## Custom designs

- Selecting a finish, trim or sheen records a custom palette for that room.
- The viewer's **Use scene palette** button returns to the suggested finish.
- Room switching restores custom room palettes. Product has its own remembered
  finish; changing between Store and Studio does not change the selected room.
- Explicit shared builds take precedence over older browser room palettes.
  Saved builds take precedence on an initial room without a newer room override. Importing
  projects preserves the actual recorded customer finish, including older files
  without the new optional field.
- `presentation.sceneDeskStyles` carries the room overrides; browser storage
  uses `ergoflex.sceneDeskStylesV1`. Size, accessories and uploaded artwork use
  their existing systems and are not replaced by a palette.

## Files

`room-desk-styles.mjs` owns the pure catalog palette registry and validation.
`studio.js` applies/records finishes and styles station snapshots.
`room-desk-details.mjs` builds the daily desk kits, using the original printed
textures from `room-activity-print.mjs`. `workspace-3d.mjs` mounts/disposes them.
The upload builder includes all new modules. Current import revision:
`scene-desk-styling-20261010`.

## Verification

The new desk-style browser test exercised all 27 palettes × five activities.
Catalog validation, station metadata, uploaded-artwork state preservation,
product return, custom room switching, current/legacy project import, palette
reset, browser reload and shared-build precedence passed. Five crowded desktop
placements failed initially; the targeted rerun cleared four, and the final
Kindergarten rerun passed after adding finer placement samples. The other
22 rooms' clear placements were unchanged. These are combined full and focused
results, rather than a claim that the original full run had no failures.
Catalog pricing, project-file validation and the pure Groove planner also passed.

Current render and regression evidence is in `/tmp/ef-desk-styling-20261010/`.

Visual review covered 225 room/layout/daypart combinations across all 27
environments: all 24 institutional layouts, all Home layouts, three Office
layouts and representative layouts for the other lifestyle rooms. No missing
props or browser errors were reported. All contact sheets were inspected,
followed by 54 final desktop close-ups (afternoon and night in every room).
This is not a claim that every lifestyle layout was rendered.

The institutional regression passed all 12 scenes, 24 layouts and 120
settings, including project restore and mobile layout. Room life passed 375
scene/size/phase combinations with saved transforms and removals. Lighting
passed 15 environments × five times, including finishes, shadow movement,
coverage and resource disposal.

## Controller drag repair

The viewer's `tabindex=-1` ancestor incorrectly caused the header drag handler
to reject every pointer. Operable targets are now checked inside the header
only. The center handle supports both dragging and tap-to-expand/minimize,
with the tap suppressed after a drag and pointer cancellation handled.

Verified through actual mouse drags in the user's open Hospital viewer:
collapsed `left:348px → 185px`, expanded `left:185px → 65px` and
`top:472px → 545px`. Dragging retained the collapsed/expanded state; tapping
still expanded the panel. Its position was saved by the existing dock storage.
`tests/studio-smoke.cjs` now uses the actual center handle rather than synthetic
events dispatched directly on the header. That full suite has not been rerun
for this repair; the real browser interaction is the verification evidence.
Screenshot: `/tmp/ef-desk-styling-20261010/controller-drag-fixed.jpg`.
