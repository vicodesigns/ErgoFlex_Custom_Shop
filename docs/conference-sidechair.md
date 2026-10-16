# Supplied Atelier conference side chair

The owner's `atelier-conference-chair-sidechair.glb` is preserved under `models/supplied/` and imported by `tools/props/import-conference-chairs.mjs`.

## Finishes and placements

**Prop library → Atelier Conference Chairs** offers eight independently selectable finishes: Humboldt forest/bronze, sage/graphite, slate/silver, clay/bronze, graphite/steel, teal/charcoal, terracotta/oak and ivory/oak.

The existing `kenney-furniture-chair-modern-cushion` placement is replaced wherever it appears in Library, Office, Co-working and Kitchen rooms. Traditional Library rooms use forest finishes; modern Library reading groups alternate sage, slate and clay. Office uses graphite/steel, Co-working uses teal, and Kitchen tiers alternate terracotta and ivory. Ergonomic desk chairs and lounge chairs retain their separate models.

Frame, feet, molded shell and upholstery remain separate materials. Source bump textures are converted to supported normal maps. Each GLB is approximately 90 KB, with a 508 × 780 × 604 mm footprint/height/depth envelope and a seat around 478 mm high. Scaling is uniform; proportions are not stretched.

## Saved edits

Original prop IDs, placement indices, keys, positions and rotations remain intact. The Library's historical 0.82 editable root scale is retained, with compensation below that root so the new chair loads at its authored dimensions. Existing relative resize edits therefore remain relative edits. Legacy saves with scale 1 retain the existing Library migration path. The room's older designer-chair mapping remains as an offline fallback if a stale prop catalog lacks the new collection.

## Regenerate and verify

- `npm run import:conference-chairs` (supports `-- --only id,id`).
- `node tools/props/thumbnails.mjs --collection 'Atelier Conference Chairs' --sheet /tmp/conference-chairs-sheet.png`.
- `npm run test:conference-chairs` checks all eight assets; every matching chair across the four room families and both desk widths; floor contact and chair-bay dimensions; editing identity and facing; saved resizing and Library scale migration; varied upholstery finishes.
