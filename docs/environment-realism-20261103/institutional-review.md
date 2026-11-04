# Institutional environment placement review

Reviewed the institutional scene recipes and the Humboldt commons dressings. Changes apply to default furniture-local decor; no saved Product layout, desk build or headphone arrangement is edited.

- OCC print counter: expanded its worktop from 420 to 650 mm deep to support the catalogued 563.4 mm printer. Settled floating proof stock and reference swatches onto the 900 mm worktop. Added a tape dispenser and two binding clips in a clear rear corner.
- Humboldt commons: moved café table 7 reading matter into a separate quadrant from the central stoneware vase. Settled the separate open notebook and faceted pens/highlighters onto their study table. Lifted tilted floor bags and umbrellas by their actual rotated base extent to remove floor intersections.
- Education: moved middle-school worksheets/ruler entirely onto the table and separated showcase towers from the city model. Separated kindergarten clipboards/portfolios from the supply basket. Moved HBHS paperwork and binder stacks away from the solar panel supports; removed pens buried inside the night notebook stack. Separated college working notes from its architectural model and the university notebook from its coffee service.
- IT: raised the clipboard paper above its 12 mm board, with printing above the paper.
- Healthcare: corrected the tilted timer's base using its actual rotated vertical extent; its display now follows the tilted front face. Corrected handover clipboard and cup contact heights.
- Government: corrected activity tablets, cup bases and an eraser's lower pad to meet their support without intersecting it.

## Verification

All seven edited modules pass `node --check`; `git diff --check` passes.

A pure Node recipe audit executed 60 institutional daypart kits, covering 526 primitive parts. It checked their rotated bounding boxes against the 1300 × 650 mm activity table and found no below-surface geometry or overhanging kit bounds. A separate static-versus-daypart check found no intersecting bounding boxes between educational activity kits and permanent basket, model, solar panel or coffee-service details. Report: `institutional-geometry-audit.json`.

A Three.js r163 geometry check executed the OCC counter/finishing recipes and all five café table 7 dayparts. It verified printer/tray support using the prop catalog dimensions; checked finishing kit bounds against the new counter; and checked 592 café detail vertices against the 520 mm round top, its surface height and the central vase footprint. Both checks pass.

The one-off runners remain at `/tmp/institutional-geometry-audit.cjs` and `/tmp/institutional-support-audit.mjs`. These checks cover the specified recipes, rather than every loaded GLB triangle or user-created arrangement. Browser visual review is coordinated by the parent task.
