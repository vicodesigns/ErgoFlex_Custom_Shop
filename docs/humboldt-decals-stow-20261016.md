# Humboldt commons: Product decals and tilt stowing

The commons repairs an empty Library artwork link independently of its Product
recipe revision. It uses the owner's matching-width Product artwork first and
otherwise restores the saved Cal Poly Humboldt desktop, right-panel and footrest
artwork. Existing room artwork and object transforms are preserved. A persisted
repair marker prevents a later deliberate removal from being undone on reload.

Rearrange Items no longer pauses all automatic stowing. Above 9°, loose desktop
items are organized in shelving; the selected item remains available while it is
being edited at a stationary angle. Tilting finishes that edit and stows the selected item too. The open laptop closes its lid to fit the upper unit. Lowering to 9° or less restores the authored layout. Temporary
storage positions are excluded from saved object transforms.

Verification:

- `node tests/library-artwork-link-test.mjs`
- `node tests/library-product-build-test.mjs`
- `node tests/humboldt-decals-stow-test.cjs`

The browser regression exercises both widths, recovered and owner-edited Product
artwork, visible decal meshes, the 9° boundary, 24.1° and 65° postures, daily
materials, Rearrange Items, exact original placements and the persisted tilted state. The in-app browser is also reviewed after a reload.
