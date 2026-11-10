# Lounge design reset · November 5, 2026

Five measured layouts, both desk widths and all five daily activities received a coordinated design pass.

## Design and arrangement

- Five distinct material palettes: soft ivory/copper, olive/nickel, ink/walnut, clay/copper and petrol/bronze.
- Catalog desk finishes now use Warm Ivory, Modern Grey or Brushed Silver Wrap, with graphite frames and restrained trim. The former Walnut/Sand/gold default upgrades once; later owner choices are preserved.
- Milano sofa upholstery now follows each room's palette. The compact room retains its correctly sized cognac two-seater.
- Original library coffee-table contents are replaced inside the same editable root with a honed-stone top, rounded timber supports, a low shelf and a closed design journal. Original model resources are not modified. The top remains at 391.2 mm, preserving daily-life support placement.
- Sofa/table separation improves; the main work bay moves farther from the hearth. The compact lamp moves away from the side table. The home jukebox and listening cabinet move apart from the media console.
- Timber slats occupy a localized bay; quiet matte wall areas frame the original landscape. Felt media panels, a single framed abstract study, simpler wool rugs and fewer gallery frames/bottles replace competing decoration.
- Imported arcade materials receive room-owned muted chassis/trim copies, retaining original screen and marquee artwork.

## Lighting

Daylight carries morning and afternoon. Evening balances warm reading, art and cabinet lights with restrained neon. Movie night uses soft cool screen bias and a small warm reading pool; game night brings back controlled arcade color. Candle flames switch off during daylight. Existing four practical lights remain, and no new shadow lights are added. Sky and window-pool textures redraw on activity changes only.

## Verification

- `npm run test:lounge-design`: all five room recipes pass actual RoundedBox geometry bounds, table support/ground contact, practical-light count, lamp/cabinet separation, one-time desk migrations, furniture transform preservation and desk-size persistence.
- `node tests/scene-desk-data-test.mjs`: existing desk identities, attachments, custom accessories, finishes, resizing and persistence pass.
- Browser review through `tools/lounge-review.html`: all 50 cases passed (five layouts × two desk widths × five activities), with rendered stills and `browser-report.json` retained here. No out-of-room props, broad floor-footprint overlaps or missing props were reported. All actual activities and desk sizes matched the requests; every desktop kit reported support with zero authored overlap. Daytime, evening and movie-night stills were visually inspected. This is a conservative review of authored arrangements, not a guarantee for arbitrary owner edits.
- Project-file validation, catalog and build-validation tests also passed.

An initial sweep identified the compact lamp/side-table proximity and the house listening/media pinch point; both were corrected and included in the final verification. Native artwork, screen content, custom owner transforms and the unrelated Product and institutional desk recipes retain their own systems.
