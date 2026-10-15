# Atelier beds

The owner's bed generator is retained in `models/supplied/atelier-bed-studio.html`.
`atelier-bed-generator.mjs` adapts its geometry and seeded fabric textures for the
room prop pipeline. Geometry is in metres, Y up, with the headboard toward -Z.

## Bedroom defaults

| Layout | Bed |
| --- | --- |
| Apartment | Compact oak tatami, ivory bedding and sage throw |
| House | Milano upholstered platform, warm linen and clay accents |
| Spacious | Ivory wingback, layered pillows and clay knit throw |
| Premium | Walnut canopy with sage velvet and warm linen |
| Executive | Graphite platform, walnut headboard and tan accents |

The **Atelier Beds** Prop library collection also includes four larger king
models: platform with floating shelves, canopy, wingback and low tatami.
No source staging walls, rugs, sconces or extra end bench are exported. Rooms
retain their existing nightstands, bench and lighting. The premium room's art
is raised above the canopy beam; its editor identity stays unchanged.

## Fit and saved edits

`atelier-scene-beds.mjs` chooses a default per bedroom layout and uses a uniform
fit below the editable root. Existing prop IDs, placement indices, editor keys,
rotations, moves, scales and deletion identities remain stable. The old compact
bed had its headboard at +Z, so its replacement gets an inner 180-degree turn
while preserving the saved root rotation.

The bed bay allows up to 80 mm extra width in larger rooms and a maximum
2100 mm length, bounded by the measured wall and nightstand clearances. This
retains an adult mattress length of at least 1880 mm after fitting. Checks
verify floor contact, 10 mm at the back wall, at least 25 mm beside nightstands,
at least 100 mm before the existing bench and 300 mm below the ceiling.
Clinical beds retain their room-specific equipment models.

Generated bedding replaces the legacy procedural bedding overlay. Platform
cove strips own their glow materials and follow room dayparts: subtle in the
day, warmer in the evening and dim at night. Accent lighting at zero disables
them. Custom platform beds added from the Prop library use the same behavior.

## Rebuild and verify

```sh
npm run generate:atelier-beds
node tools/props/thumbnails.mjs --collection 'Atelier Beds'
npm run test:atelier-beds
```

The ordinary prop converter delegates `atelier-bed-generator` jobs to the new
generator. All nine assets use supported glTF normal maps and meshopt/WebP
compression, with separate transformed parts for tight runtime bounds.
