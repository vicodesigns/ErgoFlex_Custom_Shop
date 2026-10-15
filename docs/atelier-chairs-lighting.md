# Atelier chairs and lighting

The owner's two HTML generators are retained in `models/supplied/` (ignored
source models). Their reusable geometry builders are in
`atelier-chair-generator.mjs` and `atelier-lamp-generator.mjs`.

## Collections

- **Atelier Luxury Chairs**: 14 chair models and four independent matching
  ottomans. Molded swivel, Danish timber and cantilever frames each come in
  cognac leather, ivory bouclé, obsidian leather and moss velvet. Additional
  clay timber and OCC navy/orange cantilever models complement the scene sofas.
- **Atelier Lighting**: eight lamps, with walnut/warm brass and ivory
  stone/silver editions of arc, mushroom, tripod and halo designs.

All models are generated in metres and measured into the millimetre catalog.
They use supported glTF normal maps, physical upholstery/metal materials, and
floor/surface anchoring. No staging rugs, walls, tables, light cones or studio
lights are included. The chair adaptation also places backrest tufting on its
visible front face and adds the missing molded-chair swivel and arm supports.

## Scene behavior

Existing decorative lounge chairs are upgraded in 10 environments. Existing
round floor/table lamps in Music and Bedroom are upgraded where their original
footprints fit. Wider arc/halo lamps are available for manual placement in the
Prop library, preserving the tight circulation of existing rooms.

Original placement indices, prop IDs, editor keys, transforms and deletion
identities are preserved. Fit is uniform below the editable root so restoring a
user scale cannot undo unit normalization. Task/dining chairs remain in their
authored roles. The checks cover 38 chair/lamp placements across 26 layouts.

Lamp diffusers and local illumination follow morning, afternoon, evening,
night and party dayparts. Each lamp owns its glow material copies; the cached
asset remains unchanged. Accent lighting at zero disables both emissive glow
and the practical light. Custom lamps added through the room Prop library use
the same behavior. Repeated mode changes do not accumulate brightness.

## Regeneration and verification

```sh
npm run generate:atelier-chairs
npm run generate:atelier-lamps
node tools/props/thumbnails.mjs --collection 'Atelier Luxury Chairs'
node tools/props/thumbnails.mjs --collection 'Atelier Lighting'
npm run test:atelier-chairs
```

Both generators also support `--only id,id`. The ordinary converter delegates
their manifest entries to the corresponding generators. Compression preserves
separate transformed parts for tight runtime bounds. All 26 new chair/lamp
assets total about 3.8 MiB. Browser previews were checked in Lounge and Bedroom
(evening), alongside the new Milano sofas.
