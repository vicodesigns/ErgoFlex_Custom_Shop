# ErgoFlex model collection — October 11, 2026

## Customer controls

- **Store → Start from:** Office, Artist, Gaming, Music studio, Library & study. Each applies the desk size, wood, base, trim and accessory selection together. Existing presets remain available.
- **Store → Accessories:** landscape/portrait displays, dual monitor arm, keyboard tray, ergonomic/Apple keyboards, Logitech/Apple mice and artist accessories. Displays are purchased separately from arms.
- **Studio → Object library → Collection → ErgoFlex Collection:** all 14 supplied models, including chairs, bookshelves, artist stool and guitar/amplifier.
- **Product → Desk objects:** edit mounted purchase accessories or add library decoration to any of the four desk surfaces. Position, rotate, resize, drag and remove; changes save in this browser and travel with project files. Removing a purchased accessory also removes it from the purchase selection; Undo restores both the item and its placement.
- **Room → Desks → Objects on this desk → Add from the object library:** choose ErgoFlex Collection, a desk part, then an object. These are decoration placements, separate from purchased accessories. Scale, position, rotate and remove using the existing editor.
- **Save build** preserves the purchase configuration; project/room saves preserve decoration placements using the existing save system.

## Imported assets

Sources are the user's GLBs in `/home/ergo/Manifest-Share/ErgoFlex/`, copied locally to ignored `models/ergoflex-supplied/`. Runtime models and thumbnails are included in `assets/props/`.

| Source | Library ID | Role |
| --- | --- | --- |
| EassleAccessoryAndArt.glb | ergoflex-art-easel | Full-width art surface / easel accessory |
| bookshelsfsmaller.glb | ergoflex-small-bookshelf | Compact bookshelf |
| artistsStoolwithPalete.glb | ergoflex-artist-stool | Artist stool with palette |
| TallBookShelf.glb | ergoflex-tall-bookshelf | Tall bookshelf |
| PAinterAccesoryShelf.glb | ergoflex-painter-shelf | Painter tool shelf |
| officeChair3.glb | ergoflex-office-chair | Office task chair |
| KeyboardTray.glb | ergoflex-keyboard-tray | Keyboard tray |
| GuitarAndAmp.glb | ergoflex-guitar-amp | Guitar and amplifier |
| ErgoKeyboard.glb | ergoflex-ergo-keyboard | Ergonomic keyboard |
| GamerChair.glb | ergoflex-gamer-chair | Gaming chair |
| TallChairOffice.glb | ergoflex-tall-office-chair | Tall office chair |
| WideMonitor.glb | ergoflex-wide-monitor | Landscape display |
| PortraitMonitor.glb | ergoflex-portrait-monitor | Portrait display |
| DoubleMonitorArm.glb | ergoflex-dual-monitor-arm | Dual monitor arm |

## Preparation and rendering

`tools/props/manifest.json` records orientation, fit, anchor and mesh budget. Source exports use large CAD coordinates and mixed up directions. Blender recenters, corrects orientation, bakes transforms, sets floor/ceiling anchors and reduces heavy meshes. Models export in metres; PROP_LIBRARY instances use millimetres. The keyboard tray uses a ceiling anchor (mounting top at Y=0).

The fit dimensions are visualization estimates inferred from the CAD extents, mostly inch-based. They are not verified manufacturer mounting dimensions. Index bounds measure referenced vertices only, avoiding unused Draco/decimation vertices that disappear during GLB export.

`tools/props/supplied_model_repairs.py` applies walnut cabinetry and cloth book colors to bookshelf islands, reinforces the artist stool's gas lift and gives the dual arm a graphite metal finish. The keyboard tray uses charcoal metal (metallic 0.85, roughness 0.32), turned 80° to the right after fitting so its physical dimensions stay unchanged; input devices rest at the measured plate elevation when the tray is selected. Original source files stay untouched. Draco input becomes Meshopt output compatible with the existing loader. The guitar/amplifier remains relatively heavy (~140,000 triangles) to preserve its detail.

Purchase models load asynchronously through PROP_LIBRARY, with guards against stale preset/selection loads. `workspaceAccessories.ready` is awaited by AR preparation. Mounted purchases follow the existing desk/shelf attachment matrices during height, tilt and glide. Two supplied display panels receive locally owned UV geometry, screen materials and optional stands; shared cache models are never modified. Screen preview shaders are not baked into the input files.

## Pricing and compatibility

New unpriced products use `quoted: true` with numeric zero only as a pricing placeholder. UI and estimates show **On request** and **+ quote**, including saved builds and cart totals. No unverified product price is invented. Existing indicative accessory prices are preserved. Dual-arm, wide display and full-width art surface are restricted to the Extended 60-inch top. Input devices and display mounts use exclusive selection groups.

Floor decoration is not billed as a purchase accessory. Furniture models are available to decorate and rearrange through existing room controls.

## Verification

- `node tests/product-desk-objects-test.cjs`: Product editor and pointer dragging, purchase transforms, removal and Undo, surface transfers, resize, project import, reload and room switching.
- `node tests/catalog-test.cjs`: presets, compatibility, exclusive choices and quoted pricing.
- `node tests/ergoflex-collection-test.cjs`: all 14 models load at indexed bounds, five real UI presets, no stale duplicate models, tray follows lift/tilt, exported groups contain meshes, saved purchase build restores, room and desk object additions.
- `node tools/props/thumbnails.mjs --collection 'ErgoFlex Collection'`: regenerate collection thumbnails.
- Reference screenshots: `scene-shots/ergoflex-collection/`.
