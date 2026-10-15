# College artwork recovery — 14 October 2026

The local workspace includes the Library, OCC media lab and HBHS classroom
improvements from commit `7f580883e9b9141808c403d1100445c1779c1e9f`.

The owner's Library and OCC decal recipes survived in the live browser export
and matched the 13 October project backup exactly. The Library has its authored
desktop wordmark, right-panel seal and footrest wordmark. OCC has the college
title and circle on the desktop, circle on the left panel and pirate on the
right panel. OCC's 48-inch placements differ from its 60-inch placements.

## Changes

- Product preset installation now suppresses the outgoing room's size rebuild.
  Previously this rebuild could apply the old room palette to the new preset
  before it saved, producing a black Library desk despite its saved green finish.
- Studio → Editor tools → Project → **Restore Library & OCC graphics** restores
  those two builds' saved decals and green/navy palettes for both widths. The
  college-only source is `assets/artwork/saved-college-graphics-20261014.json`.
  Recovery retains the current accessory selections, object transforms, starting
  views and every other preset. It saves a pre-recovery autosave.
- OCC media lab desks seed graphics from the corresponding width of the saved
  OCC Product build. Room edits stay independent until the source revision changes.
  The lab's individual station equipment is retained.
- HBHS seal and original orange/white Oilers lettering are editable artwork
  samples. Official seal source and the lettering distinction are documented in
  `hbhs-classroom.md`.

## Verification

`npm run test:college-artwork-recovery` passed: High school → Library/OCC Product
transitions, both widths, all pilot-lab stations' rendered graphics, separate
room artwork edits, HBHS samples and reload, and recovery preserving an edited
Office build. The Library Product build and preset-size unit checks passed.

Native browser recovery was verified at Library revision 4 / OCC revision 190:
Forest Green / White / gold and Coast Navy / White / orange. Both original
width-specific OCC graphic placements were checked. A refreshed browser preview
uses `?view=product&v=college-graphics-recovery-20261014`.

Local full-project backups in `scene-shots/` preserve the original state. No
older whole-project snapshot was imported into the browser.
