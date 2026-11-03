# OCC graphics isolation — 16 October 2026

Returning to Product with the scene picker previously retained the room's live artwork and accessories. A still-active named Product preset could then autosave that room state. Returning from Library therefore contaminated OCC with Humboldt decals.

Normal room-to-Product navigation now restores the selected named recipe before Product autosaving resumes. Explicit project and preset installations keep their supplied desk state. Both width variants remain independent.

**Studio → Editor tools → Project → Restore OCC graphics only** restores the owner's original width-specific OCC title, Coast circles and pirate graphics from `assets/artwork/saved-college-graphics-20261014.json`. It retains current finishes, accessories, object placements and starting cameras, saves a pre-repair autosave, and does not replace Library or other presets. The existing combined college graphics/palette recovery remains available.

Verification: `tests/occ-product-return-test.cjs` passes Library-to-Product navigation for 48″ and 60″, exact Product configuration retention, OCC-only repair, preservation of other presets and user edits, and reload. `tests/library-artwork-link-test.mjs` also passes. The in-app browser's OCC versions were repaired with the scoped action.
