# Supplied accessories · October 12, 2026

## Library and product options

15 active GLB files were added to the **ErgoFlex Collection**. Backups (`.glbbak`) and the standalone MTL are not duplicate library entries. The original files remain in `models/ergoflex-supplied/`; the normalized, compressed viewer assets and thumbnails are in `assets/props/`.

| Source | Library entry |
|---|---|
| Triangle_Table.glb | Triangular meeting table |
| skeaker.glb | Slim studio speaker |
| singleMonitorArm.glb | Single monitor arm |
| ShelvingOrganizing.glb | Shelf organizer |
| MxMasterMouse.glb | MX Master mouse |
| Mouse2.glb | Mouse · alternate style |
| MechanicalKeyboard.glb | Mechanical keyboard |
| Headphone2.glb | Over-ear headphones |
| GameTable.glb | Gaming table |
| EaselAccesssory.glb | Easel accessory rail |
| DrawingTablet.glb | Drawing tablet |
| DoubleMonitorArmsExtended.glb | Dual monitor arms · extended |
| DesktopPc.glb | Desktop PC |
| coffeetable.glb | Coffee table · dark wood |
| AppleVisionPro.glb | Apple Vision Pro headset |

Product options now use the real MX Master, single arm and dual arm models. The mechanical keyboard, drawing tablet, shelf organizer and easel rail are also quote accessories. Existing accessory IDs, including `logitech-mx-master`, are retained so saved builds and user-edited placements survive.

## Scene use

- Office and Home office: MX Master; Office design stations use the new tablet, prototype shelves use the organizer, and compact Office has the triangular side table.
- Gaming: new keyboard and alternate mouse on the main desk; supplied PC on the equipment cabinet; the gaming table and VR headset in larger rooms. Both Gaming and Music use the new headphones.
- Artist: supplied drawing tablet on the desk; new coffee table in large studios. The Artist preset includes the supplied easel rail.
- Music: supplied slim speakers on existing speaker stands; new coffee table in large studios.
- Every new asset remains selectable from the object library for floor or desk decoration.

## Conversion and fit

CAD world offsets are removed; all props use a floor origin and export in metres. The library instances them in millimetres. Physical dimensions are visualization estimates and are recorded in the manifest/index, not verified manufacturer mounting specifications. The gaming table’s open CAD rim is closed with a fitted working top, retaining the shell and footprint. Pure-black materials on the mouse, keyboard and PC were lifted to a dark graphite so their original geometry remains legible. The dual-arm source includes a much larger scene; only its `MonitorArms` assembly is retained.

`WorkspaceAccessories` locates the CAD clamp and arm heads in mount coordinates. Owned geometry copies adapt the outer arm runs to the selected display backs while retaining the clamp/mast and saved screen poses. The native CAD VESA heads meet the authored panel mount points; no extra adapter plates are added. This is a visual fitting approximation, not a joint-limit or load-bearing simulation. Library geometry remains unchanged. The fit is recomputed when relative accessory poses change, and rides the shelf during desk movement. A second display retains its stand when only one arm head is purchased.

The supplied monitor primitives combined display and enclosure faces. The screen texture is now limited to front-facing triangles; backs use graphite. Runtime fitting references stay outside glTF `userData`, preventing oversized export extras.

## Verification

`node tests/ergoflex-collection-test.cjs` checks all 29 supplied collection assets, presets, real MX Master loading, mounting endpoints before/after screen edits, single/dual arm behavior, GLB export, rapid selection changes, motion and saved builds. `node tests/product-desk-objects-test.cjs` checks edited placements, undo, library additions, reload and room/product switching.

## Editable Start From setups and rendering correction

Each Start From setup now keeps a separate edited version in `ergoflex.buildPresetsV1`: configuration, accessory and added-object placement, desk posture, LED settings and surface finish controls. Changes auto-save locally; **Save [setup] now** flushes immediately. **Save project** includes these versions for backup or transfer. Existing Office builds are adopted without resetting their edited object placements; the previous Lift mouse is replaced by the supplied MX Master.

Modern Grey uses a darker `#72777c` tint. The MX Master asset and conversion manifest now use the Ergo keyboard's graphite base color, roughness and metalness; its revision query prevents the prior light material from remaining cached.

The supplied monitor arm fitting path preserves each mesh's scalar or array material form. Previously it converted scalar materials to arrays on CAD geometry with no material groups, so Three.js skipped rendering the actual arms while still showing the VESA adapters. The shared single/dual arm preparation now renders the CAD assembly correctly.

`node tests/editable-build-presets-test.cjs` verifies independent setup versions, switch/reload persistence, existing Office migration, project export, exact keyboard/mouse material matching and draw calls for the actual dual-arm assembly.

## Extended arms and supplied ProVision display

The dual-arm accessory now uses `DoubleMonitorArmsExtended.glb`. Its anonymous CAD faces are joined before Blender conversion, then normalized and compressed. Clamp and VESA reference points in `prepareSuppliedArm` were remeasured for the extended geometry. The internal prop ID remains `ergoflex-dual-monitor-arm-compact` for saved-object compatibility; the public label is Extended.

The landscape panel is now **ProVision Ultra 32″**, adapted from the user-supplied HTML model, including chassis, front screen artwork, bezels, rear VESA disk, I/O bay, indicator and rear ambient dots. `node tools/props/build-provision-monitor.mjs` regenerates its source GLB from the portable geometry module, then `tools/convert-props.mjs --only ergoflex-wide-monitor` normalizes and compresses it. Store and Office retain `wide-monitor` / `ergoflex-wide-monitor`, so edited placements survive. The assets have revision queries to refresh cached models. The attached design is an illustrative panel; specification text in its artwork is part of that supplied design.


## Curved right / portrait left and fine alignment

The Office pair now uses the supplied **AETHER 34UW curved panel on the right** and **ProVision Ultra 32″ flat panel in portrait on the left**. Store IDs stay `wide-monitor` and `portrait-monitor`. Both screen faces start as dark glass. Shared media still uses the existing temporary preview screen.

`tools/props/aether-monitor-model.mjs` extracts the AETHER panel geometry from the supplied HTML; the source's stand, page, environment and lights are excluded. `tools/props/provision-monitor-model.mjs` produces the flat portrait variant. Rebuild with:

```sh
node tools/props/build-provision-monitor.mjs
BLENDER=/path/to/blender node tools/convert-props.mjs --only ergoflex-wide-monitor,ergoflex-portrait-monitor
node tools/props/thumbnails.mjs --only ergoflex-wide-monitor,ergoflex-portrait-monitor
```

The builder records `displayMountMm` from each authored VESA centre, using the same floor origin, bounding-box centring and scale as prop conversion. The converter forwards it to the library index. A converted mesh origin is not a mounting centre because conversion bakes and merges geometry. Arm fitting chooses the nearest available left/right head and moves that native head to the mount; the extra procedural rods and plates were removed. This remains a visualization approximation.

**Desk objects → Objects on this desk** offers 0.5 mm position steps and 0.1° Turn, Tilt and Roll adjustments. Full transforms persist in edited Start From setups and project files. Existing saved pairs receive a one-time left/right upgrade, retaining other transforms; subsequent edits are preserved.

Model loading now pauses motion and constructs the CAD, overlays and saved tilt rigs at the same reference height before restoring the live height. Previously loading at a saved raised height could attach overlay meshes below the wings and separate desktop and wing trims. The regression checks both desktop sizes' trim transforms before and after export/reload, fine adjustment persistence, dark screens and the absence of extra adapters.

## Artist materials, clamp light and starting posture

The Artist easel rails use brushed aluminum and a beige plastic retaining lip. The painter shelf has a planar wood UV map and its purchased instance follows the desktop material, including stain, grain and surface finish. Its cup holders use transmissive clear acrylic (IOR 1.49). Three replacement brushes have colored wooden handles, nickel ferrules and individual bristle strands. Named material roles survive compression with palette merging disabled for these three assets; owned runtime material copies keep cached library assets unchanged.

The task light now uses a padded C-clamp on the rear desktop edge. Both clamp and articulated lamp remain in the desktop mount coordinates, following height and tilt. Existing saved freestanding lamps are snapped to the rear edge once, keeping their left/right position; the `clampMount` marker preserves later adjustments.

Artist starts at **65°**, raising the 60″ desktop to at least **42.5″** for the existing clearance envelope. LEDs start enabled at **40%** with **My looks → Daytime**, using an imported Daytime override when present. Existing Artist drafts receive these defaults once, retaining accessory transforms. Further saved posture and lighting edits are preserved by the `startPose` / `startLighting` markers. Project exports include these markers.

Rebuild the Artist assets with:

```sh
BLENDER=/path/to/blender node tools/convert-props.mjs --only ergoflex-art-easel,ergoflex-easel-accessory,ergoflex-painter-shelf
node tools/props/thumbnails.mjs --only ergoflex-art-easel,ergoflex-easel-accessory,ergoflex-painter-shelf
```

## Owner-edited Start From defaults and mounting pass

The October 12 owner edits were exported through the live app's Save project control and promoted to `preset-defaults.mjs`. Office, Artist, Gaming, Music, Library, Compact and Creative now retain the supplied finishes, surface sheen/grain, posture, LED look/brightness and mount-local accessory transforms on a fresh browser. Local edits continue to take priority. Named Daytime and Night City strip settings were checked against `led-saved-library.mjs` before reusing those definitions. Transforms were rounded to six decimal places and quaternions normalized.

Standing workstation is replaced by Architect drafting table: a 35° drawing surface, an architectural plan, parallel ruler, set square, drawing pencils, clamp light and shelf organizer. The drawing kit is separately selectable in the store. The Artist canvas now uses the owner-supplied `PAinting_small.jpg`, stored as `assets/artwork/artist-painting.jpg`, with its aspect ratio retained.

The flat ProVision display also has a separate landscape accessory/library model (`flat-monitor` / `ergoflex-flat-monitor`). It uses the original flat panel geometry rather than the curved AETHER model. Compact's procedural 27-inch display has a 16 mm enclosure and a shallow rear electronics housing.

Native monitor heads now use a measured front-face orientation and extent. Their housings rotate to follow a screen's yaw, pitch and roll, meet its rear mounting point, and stay behind the rear mounting plane. The clamp remains fixed and the outer arm geometry adapts without changing any saved monitor or arm root transforms. This remains a visualization fit, not a mechanical reach certification.

Artist's saved 65° posture was already present; restoration now refreshes the controller readout and prevents an initial neutral pose from overwriting a pending restore. Legacy Office builds retain their own object edits rather than inheriting the new shared placement.

Verification:

```sh
node tests/start-from-defaults-test.cjs
node tests/editable-build-presets-test.cjs
node tests/catalog-test.cjs
node tests/scene-desk-data-test.mjs
node tests/project-io-test.cjs
node tests/validation-test.cjs
```

Visual review captures: `scene-shots/preset-review/{artist,architect,gaming,compact,office}.png` (ignored local artifacts).

## Single arm reset and Artist finish follow-up

The single arm now retains the supplied clamp, lower link, upper link and VESA head as separate rigid parts. Two joint rotations fit the links to the display position; screen roll rotates the head alone. Link geometry is never stretched or rewritten. The dual arm retains its existing fitting. Rebuild the segmented single-arm asset with `node tools/props/build-single-monitor-arm.mjs` after a generic prop conversion.

Artist uses the actual flat landscape ProVision panel. Existing saved Artist drafts receive a one-time `singleArm: rigid-landscape-v1` migration: replace the rolled portrait panel while retaining its visible centre, reset the single clamp pose, and preserve all other objects, finishes, posture and lighting. Later object adjustments remain saved.

The painting uses centred cover sizing to fill the whole canvas, cropping excess height. The shelf organizer's outer box, floors and mounting hooks copy the current desktop material. Both long and short internal dividers use clear acrylic, separated from the joined CAD mesh without changing the organizer placement.

The Start From browser test checks rigid arm geometry under a 90° screen roll, head contact, one-time saved-preset migration, matching organizer material and acrylic divider assignments.

Artist's **Show painting** checkbox sits beneath the preset save status. Off displays a grey primed canvas; on restores the same full-canvas image. `artworkVisible` is stored on the easel object and survives preset switching, page reloads and project serialization. The object edit participates in the existing undo history.

## Accessory colors, Orange Coast College and restored LEDs

The Ergo keyboard, MX Master and keyboard tray each have an independent Black/White selector on their accessory card. `accessoryFinishes` is validated and saved with the build and named preset. Render instances own their color materials, preserving the shared source model and accessory transforms. White tray parts use a powder-coat appearance; switching back restores the original dark metal. Mouse pads rotate 90° around their own centre and use darker charcoal cloth and stitching.

**Orange Coast College** is available under Start From, the inspiration buttons, and Premium artwork & wraps. It uses the Library desktop layout with Coast Navy, Coast Orange trim, a white frame and white inputs/tray. Official transparent college artwork is embedded as editable decals. Source URLs and official digital color references are recorded in `assets/artwork/orange-coast-college-sources.md`. Subsequent changes save as the user's own OCC version. Restoring a named preset skips the global free-build artwork draft, which could otherwise replace its saved logos.

Project restoration previously rebuilt the primary tilt rig from registered part IDs and left the generated Desktop LEDs and touchscreen behind. Those overlay groups have no editor IDs. The primary rig now reclaims both groups whenever it is created, including project import and undo/redo rig restoration.

Verification: `node tests/accessory-college-options-test.cjs` and `node tests/desktop-led-attachment-test.cjs`. The latter checks fixed strip-to-desktop transforms through imports, saved-rig reloads, six preset changes, both desk sizes and −5° to 65° tilt.

## Per-preset starting camera and refined accessory finishes

**Save starting view** records the current camera position, orbit target and lens for the selected Start From preset. The saved view is restored on selection and initial page load; accessory edits and autosaves preserve it without replacing it with the current inspection angle. Each preset stores its own `initialView`, which also travels in the project’s preset collection. Camera restores stop active camera tweens and automatic orbit.

Keyboard tray has a third **Brushed steel / silver** option. OCC upgrades its original white tray once (`trayFinish: occ-steel-v1`) while preserving the owner’s placement, artwork and other edits. Later finish choices remain saved. Its silver material uses metallic reflectance and a subtle directional roughness texture.

The supplied MX Master geometry now has separate shell, rubber grip, trim and roller material roles. White finish keeps metallic main and thumb rollers, graphite trim and a softer grey grip. Black restores graphite shell and grip while retaining metal rollers. `node tools/props/refine-mx-master.mjs` separates these existing connected pieces without changing vertices, dimensions or placements; rerun it after a generic conversion of the mouse.

Verification: `tests/accessory-college-options-test.cjs` checks two independent starting views, exact selection/reload restores, preservation during ordinary edits, tray material, contrasting mouse roles and existing artwork persistence. Catalog tests check OCC’s one-time finish migration and reject invalid camera data.

## OBSBOT Tiny 2 webcam / mic

Added the local `/home/ergo/Downloads/obsbot-refined.html` reference as `obsbot-tiny-2` in **Make it yours → Desktop** and the desk/scene object library's **ErgoFlex Collection**. Its geometry and canvas textures are adapted in `tools/props/obsbot-tiny-2-model.mjs`; `tools/props/build-obsbot-tiny-2.mjs` exports and compresses the GLB. The generated reference retains its gimbal, detailed lens, red trim, dual mic openings, rear connector and emissive green status strip. The status strip adds no light to the scene's light budget. This is a decorative model; it does not open a physical camera or microphone.

The envelope is calibrated to 47 × 44 × 62.02 mm from [OBSBOT's Tiny 2 specifications](https://www.obsbot.com/obsbot-tiny-2-4k-webcam/specs), which also confirm built-in dual microphones. Price is **On request**. The accessory starts on the front-left of the upper shelf; **Desk objects** can change its surface, position, rotation and scale. It uses the existing per-preset placement persistence.

`tests/obsbot-webcam-test.cjs` checks selection, loading, size, no added lights, placement edits, reload persistence, object library addition and removal from the build.

## Saved preset reload and desktop LEDs

- Named Start From recipes seed the Product palette on load and keep the cached main-desk style consistent with their saved configuration. A stale generic Product style can no longer replace OCC’s navy finish. Object transforms, artwork placements and starting views retain their saved values.
- Each recipe carries a save revision. Saving merges other recipes from the latest browser store; an older tab refuses to overwrite a newer copy of its active recipe. Selecting the recipe again loads the latest version. Switching an unchanged recipe still remembers the active selection.
- The generated desktop LED overlay replaces the original CAD Leds meshes. Accessory selection keeps those old meshes hidden instead of exposing a floating second set.
- Verified with accessory-college-options-test (including stale Product palette and older-tab writes), editable-build-presets-test (edited objects, positions, isolation, reload and export), and desktop-led-attachment-test (preset switches, project restore, both sizes and -5 to 65 degree tilt).

## Independent Standard and Extended setups

Each Start From preset now owns a 48-inch and a 60-inch recipe. Existing owner-authored data remains the source; the second width is seeded once with the same accessories, artwork, lighting and view. Lateral object positions follow the width ratio, while monitor and input device dimensions remain physical. Paired displays retain a gap, and full-width Artist inserts adapt inside their editable root. Later edits, additions, removals, finishes and saved starting views belong to the chosen size.

The last selected size stays in the existing top-level preset fields for project compatibility. `sizeSetups` stores the other size without duplicating the active recipe. Both are included in Save project. Recipe revision protection still prevents stale tabs from replacing newer owner edits. Both the Product size selector and the desk editor use the same size-setup restore path.

The old size change and startup filters no longer delete accessories. Narrow dual-monitor clearance is an advisory Build check. A one-time OCC recovery restores a legacy setup's missing display when it still has a monitor mount, before seeding the two widths; subsequent authored removals carry a migration marker.

Verification: build-preset-sizes-test checks migration, no mutation of owner data, one-time placement adaptation, physical scale, independent camera data and OCC recovery. preset-size-switch-test covers all nine presets, different positions/colors/lighting per width, OCC artwork edits and size-specific object removal/addition, reload, and distinct per-size starting views. Editable preset/project export regression also passes.

The Architect recipe also restores its brushed aluminum easel support rail with the beige retaining lip in both saved widths. The rail sits at the drafting board’s lower edge, follows the tilting desktop and adapts to the smaller width. The one-time `architectRail` marker keeps future manual removals from being undone. Seeded 48-inch and 60-inch Architect previews were rendered and reviewed.
