# Atelier fine art and illustration items

The supplied **Atelier 3D Fine Art & Digital Illustrator Studio** is adapted in `atelier-artist-generator.mjs`. Input is preserved in `models/supplied/atelier-artist-studio.html`.

## Prop library collection

**Studio → Prop library → Atelier Artist** contains 26 optimized models:

- 12 full sets: pen-display studio, tabletop painting studio, clay sculpture studio, digital illustration studio. Each is offered in oak/brass, pale ash/silver, and walnut/sage.
- 14 independent assemblies: pen display/express dial, table easel/painting, clay study/stand, illustration tablet/stylus, ceramic brush pot, palette/knife, and stylus, each in oak/brass and pale ash/silver.

Exports use metres and Y up, floor anchors, measured millimetre catalog dimensions, Meshopt/WebP and supported normal maps. Full studio backdrops and staging desktops are excluded. Complete sets remain manual library options so they do not replace the user's configured ErgoFlex desk build or painting.

## Source repairs and detail

- Fixed the undefined `headGroup` reference that prevented sculpture generation. Added clay neck, nose, chin and ears.
- Pen-display and illustration-tablet screens, controls and styluses move as rigid tilted assemblies; displays face up toward the user and stand on stable bases.
- The easel painting belongs to its stretcher, with its lower edge seated on the shelf behind the retaining lip.
- Brush pots are hollow ceramic with glazed rims, separate handles, metallic ferrules and varied bristles.
- Palettes have a thumb opening, oil-paint dabs and a flat palette knife.
- Shared PBR finishes retain wood, metal, canvas, leather and ceramic distinctions.

## Room integration and editing

`atelier-scene-artist.mjs` upgrades the brush pots in all five Artist studio layouts. The largest room's sculpture study is replaced above its existing plinth. The two larger layouts get illustration slates in the existing worktable paper footprints. Other background decorations and the main desk's artwork remain authored.

Existing editable roots, keys, parents and transforms survive the upgrades. Brush pots now have their own stable editing identities and can be moved/deleted separately. Retired shared native geometry is released at the next room teardown, avoiding mid-scene disposal of shared materials.

Digital illustrations use the existing Screens on/off controls, with separate material copies per instance. Their artwork remains intact across room dayparts. Physical paintings are not classified as screens.

## Regeneration and verification

- `npm run generate:artist-gear` (optional `-- --only id,id`).
- `node tools/props/thumbnails.mjs --collection 'Atelier Artist' --sheet /tmp/artist-gear-sheet.png`.
- `npm run test:artist-gear` covers 26 exports; actual Artist room builders at both widths (10 combinations); 32 fixture upgrades and 4 slates; fitted support contact; retained editable roots; delete/restore identity; teardown; easel lip alignment; tablet face orientation and isolated screen toggles.

Preview: `scene-shots/artist-gear-20261014.png`.
