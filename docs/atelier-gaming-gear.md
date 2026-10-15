# Atelier gaming, streaming and simulation gear

The owner-supplied **Atelier 3D Pro Gaming, Streaming & Esports Gear Studio** is adapted in `atelier-gaming-generator.mjs`. The preserved input is `models/supplied/atelier-gaming-studio.html`.

## Collection

**Prop library → Atelier Gaming** contains 42 optimized GLBs:

- 12 complete loadouts: PC and curved display, broadcast streaming gear, console lounge, and racing/flight controls, each in carbon/cyan/magenta, arctic white/ice/violet, and graphite/ember finishes.
- 30 independent pieces: 15 assemblies each in carbon and arctic. These include the PC, curved display/arm, XLR boom, macro keypad, mixer, ring light/camera, console, controller charger, individual controller, handheld dock, wheel, throttle, shifter, headset/stand, and compact keyboard/mouse pair.

Models are floor anchored in metres with measured millimetre catalog bounds. Materials include carbon normal maps, alloy hardware, cloth cushions, tempered glass, display textures and emissive RGB. No studio slab or backdrop is exported. Complete loadouts are manual choices so they do not replace authored ErgoFlex desk peripherals.

Source corrections include a GLB-compatible curved display front, a flush macro display with separate button paths, a weighted ring-light foot, and a raised mounting base for the racing wheel. The racing/flight loadout contains a throttle, not a joystick; the original source's HOTAS title does not correspond to a joystick model.

## Scene dressing

`atelier-scene-gaming.mjs` upgrades gaming controllers in Gaming and Lounge rooms, modern handheld docks in Gaming, and compact PCs in the three smaller Gaming rooms. The two larger rooms retain their existing PC assembly, leaving their VR display arrangement intact. Dedicated and streaming rooms gain a macro keypad on the display cabinet, clear of the compact PC and headphones. Additions are appended so previous room editor keys remain stable.

Upgrades keep original root IDs, keys and editable transforms. Dimensional fitting is below the editable root. Manual library props use the same selection, movement, deletion and undo tools as existing props.

RGB intensity follows the room daypart and Accent setting. Display materials are cloned per instance and participate in the existing Screens controls: curved/handheld displays use scene/time themes; macro keys retain their native layout. No extra real-time point lights are introduced.

## Regenerate and verify

- `npm run generate:gaming-gear` (supports `-- --only id,id`).
- `node tools/props/thumbnails.mjs --collection 'Atelier Gaming' --sheet /tmp/gaming-gear-sheet.png`.
- `npm run test:gaming-gear`: all 42 exports; footprint/support checks and saved editing identities across 20 room/size combinations; isolated RGB materials; daypart/Accent control; independent screen power and theme changes.

Collection preview: `scene-shots/gaming-gear-20261014.png`.
