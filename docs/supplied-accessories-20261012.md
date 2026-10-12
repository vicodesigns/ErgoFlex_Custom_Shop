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
| DoubleMonitorArmsSM.glb | Dual monitor arms · compact |
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

`WorkspaceAccessories` locates the CAD clamp and arm heads in mount coordinates. Owned geometry copies adapt the outer arm runs to the selected display backs while retaining the clamp/mast and saved screen poses. Short VESA adapters bridge the final gap. This is a visual fitting approximation, not a joint-limit or load-bearing simulation. Library geometry remains unchanged. The fit is recomputed when relative accessory poses change, and rides the shelf during desk movement. A second display retains its stand when only one arm head is purchased.

The supplied monitor primitives combined display and enclosure faces. The screen texture is now limited to front-facing triangles; backs use graphite. Runtime fitting references stay outside glTF `userData`, preventing oversized export extras.

## Verification

`node tests/ergoflex-collection-test.cjs` checks all 29 supplied collection assets, presets, real MX Master loading, mounting endpoints before/after screen edits, single/dual arm behavior, GLB export, rapid selection changes, motion and saved builds. `node tests/product-desk-objects-test.cjs` checks edited placements, undo, library additions, reload and room/product switching.

## Editable Start From setups and rendering correction

Each Start From setup now keeps a separate edited version in `ergoflex.buildPresetsV1`: configuration, accessory and added-object placement, desk posture, LED settings and surface finish controls. Changes auto-save locally; **Save [setup] now** flushes immediately. **Save project** includes these versions for backup or transfer. Existing Office builds are adopted without resetting their edited object placements; the previous Lift mouse is replaced by the supplied MX Master.

Modern Grey uses a darker `#72777c` tint. The MX Master asset and conversion manifest now use the Ergo keyboard's graphite base color, roughness and metalness; its revision query prevents the prior light material from remaining cached.

The supplied monitor arm fitting path preserves each mesh's scalar or array material form. Previously it converted scalar materials to arrays on CAD geometry with no material groups, so Three.js skipped rendering the actual arms while still showing the VESA adapters. The shared single/dual arm preparation now renders the CAD assembly correctly.

`node tests/editable-build-presets-test.cjs` verifies independent setup versions, switch/reload persistence, existing Office migration, project export, exact keyboard/mouse material matching and draw calls for the actual dual-arm assembly.
