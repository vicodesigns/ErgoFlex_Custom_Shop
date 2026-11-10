# Lounge styles · November 5, 2026

Open `/?room=lounge&view=room&layout=premium&style=contemporary&tour=1`.
Use **Style** in the full-screen toolbar, or **Lounge style** in scene controls.
Both styles preserve their own furniture/desk edits and retain the same base room size when switched.

## Design and review

- Ultra-contemporary: mineral floor and plaster, centered illuminated desk bay, abstract art, flush media console, stone tables, neutral Milano seating and curved upholstered swivel chairs. Larger rooms add refreshments and four-seat games settings.
- Earthy & textured: timber and textiles, collected art, vinyl listening and games. The hearth moves away from the centered desk; Executive billiards moves out of its approach.
- Both bars and their complete shelf assemblies sit beyond the window and its 200 mm clear margin. Browser measurements found at least 205 mm separation.
- A specialist agent reviewed the initial design, ten first-round stills, ten revised stills, both inside/window views and the final contemporary evening view. Feedback drove chair replacement, TV repair, softer evening shadows, reduced compact wall clutter and clearer circulation.

## Verified

100 browser-rendered combinations: two styles × five room sizes × two desk widths × five activities. `browser-report.json` records each measured result; `final/` contains a still for every combination.

All 100 had no missing props, no detected room-boundary violations and no pairwise floor-furniture bounding-box overlaps. All requested modes and desk widths matched. All visible measured desktop dressing kits were supported. Window views were also inspected visually. These are authored-arrangement checks; arbitrary later user edits and animated furniture collision avoidance are not covered.

The Style dropdown and full-screen Style button were exercised in the actual app; switching retained Premium size and Evening activity. Node checks passed for all ten authored layouts, surface support, migration/owner-edit preservation, desk persistence and project validation. Syntax and diff-whitespace checks passed. The older Puppeteer suite was not run; visual browser checks used the supported browser-control interface.
