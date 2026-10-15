# Milano seating

The supplied three-seat GLB and Atelier 3D HTML generator are retained locally
under `models/supplied/`. `milano-couch-generator.mjs` adapts the owner's geometry
builder into a reusable module without the standalone studio UI, lighting,
floor rug or side table.

## Scene finishes

| Environment | Upholstery and accents |
| --- | --- |
| Lounge | Alabaster bouclé, walnut and warm metal |
| Library | Moss velvet, gold cushions and brass |
| Office | Graphite weave, sage cushions and silver hardware |
| Co-working | Petrol weave, clay cushions and warm wood |
| Music / Study | Cognac leather and dark walnut |
| Artist studio | Clay velvet and neutral cushions |
| Gallery | Chalk bouclé, sage and pale wood |
| Bedroom | Oat linen with muted green accents |
| Gaming | Midnight velvet and violet cushions |
| OCC media lab | Navy upholstery, orange cushions and silver hardware |

There are **21 selectable models** in the **Milano Seating** collection,
including two- and three-seat configurations, the OCC chaise, a shallow compact
leather sofa and the original 2560 mm three-seat configuration. Seat cushions,
back cushions and supporting legs are generated for the actual seat count.
Rounded cushions, contrast piping, arm bolsters, layered pillows, wood inlays
and metallic feet remain in the exported models.

## Placement and saved edits

`milano-scene-seating.mjs` upgrades existing sofa placements in eleven relevant
environments. It leaves rooms without a sofa zone unchanged. The model faces
the existing coffee table or OCC screening display. Existing placement indices,
editor keys and original prop IDs remain stable, preserving saved moves,
rotations, scales and deletions.

Two-seat versions are about 1700 mm wide; regular three-seat versions are
2200 mm wide. The shallow version fits the existing compact lounge footprint.
The selector uses a three-seat version only where it fits at 90% scale or
larger, otherwise choosing a real two-seat sofa. Both width and depth stay
inside the previous sofa's footprint. The dimensional fit is below the
editable root, so restoring a saved user scale cannot undo it. No individual
axis is stretched.

Legacy sofa pillow overlays and the old OCC sofa recolor are skipped for these
models, which already contain their own upholstery and tailored cushions.

## Asset pipeline

```sh
node tools/props/generate-milano.mjs
node tools/props/generate-milano.mjs --only milano-moss-3
node tools/props/thumbnails.mjs --collection 'Milano Seating'
node tests/milano-seating-test.cjs
```

`tools/props/milano/profiles.mjs` owns room palettes and dimensional parameters.
The ordinary prop converter dispatches Milano profiles to this generator.
Canvas textures are seeded for reproducibility. Bump textures become standard
glTF normal maps, with sheen, clearcoat and metal finishes preserved. Meshopt
and WebP keep each model below 500 KB. Joining and GPU instancing are disabled
for these exports so the viewer's ordinary mesh bounds remain tight around
the furniture, rather than around empty space between rotated cushions.

The placement test checks all layouts containing sofas, all eleven scene
families in the actual room prop loader, floor anchoring, normal maps, hardware,
footprint limits, editor identities and restoration of a saved root scale.
