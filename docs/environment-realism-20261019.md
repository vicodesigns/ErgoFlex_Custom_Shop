# Environment realism pass — 19 October 2026

## Scope

All 28 measured environments inherit the detail pass across their existing room sizes and five activities. The Product desk build, branding, accessory configuration, and user transforms remain owned by their existing systems.

## Changes

- **Domestic and reading spaces:** notebook ribbons, bookmarks, reading tabs, a small key ring in the home office, ceramic cup rims and restrained coffee surface detail. Evening fill is less blue so local lamps remain the visible source of warmth.
- **Office, collaboration, and civic spaces:** layered review notes and pens, with tidier closed-notebook states at night.
- **Music, gaming, and lounge:** guitar picks, game cards, and more legible controller controls. These follow the existing activity furniture.
- **Art, gallery, and education:** material swatch fans, colour samples, a partially used paint tube, measurement tools, and annotated pages appropriate to each setting.
- **Technical, media, and scientific spaces:** small circuit boards, memory cards, metallic measuring tools, and handover notes. These are illustrative scene props.
- **Surfaces:** finer woven fabric relief, broader subtle roughness variation in wood/stone/metal, and 1–2 mm eased edges on eligible furniture slabs. Existing authored roundovers, mapped artwork, imported models, and desk CAD are excluded from geometry changes.
- **Printed work:** phase-specific handwritten marginal notes, completed checkboxes, and a folded page corner replace the pristine notebook appearance.

The earlier focused Humboldt/OCC/HBHS changes are documented in `campus-life-20261019.md`.

## Editing and performance

New parts are children of the existing daily activity books, cups, and controllers. They use the current activity visibility and saved arrangement system. They introduce no floor obstacles, furniture moves, shadow maps, or new real lights. Small solid parts are merged per parent and finish. Different phases have separate child geometry, only one phase is visible.

Eligible edge roundovers keep the original slab dimensions. They are applied only to explicitly tagged room furniture, not the user's desk finish or graphics.

## Activity positioning repair — 20 October

The visual sweep exposed a pre-existing tier-type mismatch: several room builders use numeric tier indexes, while daily staging expected string names. This yielded an undefined movement factor and non-finite table/chair transforms in larger lounge, kitchen, gym, sci-fi, bedroom, workshop, and gallery layouts. `RoomLife` now normalizes either representation before selecting anchors and movement amounts. Regression checks now explicitly reject non-finite furniture matrices in every activity.

## Verification

`node tests/environment-realism-test.cjs` passed:

- 28 environments, 105 authored layouts, 525 activity states.
- No missing prop loads or non-finite detail geometry.
- Exactly one active daily kit at a time.
- No furniture drift after a complete daypart cycle (0.00001 mm tolerance).
- Added notebook details remain within their support footprint.
- Hidden activity groups stay hidden when switching times.

The focused campus integration test additionally passed both 48-inch and 60-inch desk sizes, all five activities, saved build retention, moved-parent attachment, and hidden-item persistence.

Review artifacts are in `/tmp/ergoflex-environment-realism-20261019`, `/tmp/ergoflex-environment-visual-20261019`, and `/tmp/ergoflex-campus-life-20261019`.
