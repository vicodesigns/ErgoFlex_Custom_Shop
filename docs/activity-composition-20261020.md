# Activity content and room composition — 20 October 2026

## Changes

- Whole-room camera fitting uses the measured architectural shell and visible, editable furnishings. Hidden variants and presentation overlays no longer enlarge the framing. A visible furnishing moved beyond the shell remains included. Saved cameras are not rewritten.
- All 28 room types have contextual work-note headings and checklists. Original graphics distinguish field-study maps, film storyboards, wave studies, circuit sketches, fabrication drawings, game routes, orbital surveys, recipe notes, and planning boards. The existing music notation, art swatches, and training charts remain, with matching contextual notes.
- Closed notebooks receive small annotated cover notes. Activity phases change the completion marks and selected note.
- Corrected invisible music notes: note heads and stems were using the paper fill colour.
- Serving props now have shaped popcorn kernels, fruit stems and leaves, and a subtle glazed rim. Food is merged into one coloured mesh per serving group to keep draw calls modest.

## Verification

- `tests/environment-realism-test.cjs`: 28 environments, 105 layouts, 525 activity checks passed. New checks cover all room-topic entries, hidden/overlay framing isolation, and visible moved furniture extending the frame.
- Inspected 28 open-page graphics and 28 annotated covers.
- Inspected room and activity close-up renders for home, Library, OCC media lab, kitchen, gaming and workshop. No missing assets or reported browser errors.
- Syntax and scoped whitespace checks passed.

Artifacts: `scene-shots/activity-composition-20261020/`. Build marker: `activity-composition-20261020`.
