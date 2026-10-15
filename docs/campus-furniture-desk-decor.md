# Atelier campus furniture and desk decor

Both owner-supplied HTML generators are retained in `models/supplied/`.
Reusable geometry builders are in `atelier-campus-generator.mjs` and
`atelier-desk-decor-generator.mjs`. All output uses metres, Y up, measured
millimetre catalog bounds, seeded textures and supported glTF normal maps.
Studio staging walls, desks and rugs are excluded.

## Collections

- **Atelier Campus**: 29 models. Acoustic call pods, tiered collaboration
  seating, locker/bench banks, rolling boards with poufs, separate pouf stools,
  compact boards/lockers, a Humboldt wall board and low office storage.
  Finishes include oak/moss/clay, walnut, campus terracotta, slate/silver,
  HBHS black/orange and OCC navy/orange editions.
- **Atelier Desk Decor**: 16 complete sets (writing, bookends/armillary,
  mechanical keyboard/tube audio and botanical/coffee) in four finishes,
  plus 16 individual pieces. Valets, journals with pens, clocks, bookends,
  armillary sculptures, terrariums, zen trays and tube amplifiers can be
  placed independently.

## Existing room upgrades

- Co-working: existing private call booths and rolling whiteboards.
- Office: existing credenzas where the full-size new cabinet fits; tabletop
  objects and the lamp remain in place.
- Library: the existing shared research wall board, retaining its live
  routine-specific writing texture.
- College: existing mobile team boards.
- High school / middle school: compact locker banks. HBHS end-panel graphics
  remain attached to the original editable fixture.
- Existing room book props become fitted bookend groups, Library/Study globes
  become armillary sculptures, and co-working tabletop plants become bonsai
  terrariums. These substitutions stay within the original X/Z footprints.

All native fixture roots, prop IDs, editor keys, parents and transforms remain
stable. The old native geometry is retired until room teardown because its
materials may be shared by live fixtures or routine effects. New sizing stays
below the editable root. Saved moves, rotations, scales and deletion identities
remain usable. Campus furniture verification covers **34 upgrades in 28 room /
layout / desk-size combinations**. Decor checks cover the intended room layouts
and actual loader bounds/support heights.

Wider tiered seating, pods and complete tabletop sets are available for manual
placement through the Prop library. Default upgrades use existing furniture
zones. Campus pod displays participate in the scene Screens controls. Pod
practicals, candle flames and tube heaters follow room dayparts and accent
lighting, using instance-owned materials rather than changing cached assets.

## Regenerate and check

```sh
npm run generate:campus-furniture
npm run generate:desk-decor
node tools/props/thumbnails.mjs --collection 'Atelier Campus'
node tools/props/thumbnails.mjs --collection 'Atelier Desk Decor'
npm run test:campus-furniture
npm run test:desk-decor
```

Both generators accept `--only id,id`; the main prop converter delegates their
manifest entries. Meshopt/WebP compression retains separate transformed parts
for correct editable bounds. The two collections total about **4.9 MiB**.
