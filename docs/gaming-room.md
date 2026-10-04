# Gaming in Studio

Open `index.html?room=gaming&view=room` or choose **Gaming** in the scene bar.
Gaming uses the measured Home Office framework, with its own architecture,
lighting, furnishings, room selection, and saved edits. Evening is the initial
lighting mode; subsequent choices are remembered locally.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment gaming nook | 2.8 × 3.2 m | 2.6 m |
| Dedicated gaming room | 3.6 × 4.2 m | 2.7 m |
| Gaming & streaming room | 4.2 × 4.8 m | 2.8 m |
| Gaming lounge | 5.2 × 5.8 m | 3.0 m |
| Entertainment suite | 6.5 × 7.0 m | 3.2 m |

Room and desktop size are independent. A first visit with the 48″ desk starts
in the apartment; a first visit with the 60″ desk starts in the dedicated room.
Afterward, desktop changes retain the chosen room. The nominal desktop width
calibrates room millimetres; furniture retains its library dimensions.

## Layout and lighting

Each room includes a walnut slatted acoustic wall, original woven floor/rug
patterns and artwork, a real window opening, display joinery, RGB lighting,
a curved monitor, keyboard, mouse, controller, headphones, a gaming PC, and
the supplied Steelcase Leap V2 chair. The apartment has an ottoman/handheld
console corner. Larger rooms add a sofa, coffee table, and TV console lounge;
the two largest also gain a refreshment corner and extra seating.

| Mode | Height | Tilt | Desk LEDs |
| --- | --- | --- | --- |
| Morning | 43.5″ | −5° | Off |
| Afternoon | 28″ | 0° | Off |
| Evening | 28″ | 0° | Cyan |
| Night | 28″ | 0° | Violet |
| Party | 43.5″ | −5° | Pink |

Modes change window sky, daylight, ambient illumination, ceiling light, RGB
strips/practicals, desk LEDs, and posture together. Party turns the desk toward
the lounge; the shared controls can adjust it afterward. RGB uses four point
lights without extra shadow maps. The TV's otherwise untextured converted
display has original game-world artwork on this scene instance only.

The open-front cutaway hides individual walls when viewed from outside and
the ceiling fixture in overhead views. Full-room Glide uses the actual floor
and desk footprint. It constrains the desk at walls; it does not detect
collisions with furniture.

## Editing and projects

Furniture and desk dressing use the existing Studio asset editor/model picker.
Room edits are separated under `gaming:<layout-id>` and do not overwrite Home
Office edits. Projects save the gaming room, mode, all edited layouts, and
desk movement. Procedural architecture is authored in `gaming-room.mjs`;
scene props/dressing are composed in `workspace-3d.mjs`.

The website upload builder includes the new module. Publishing this scene
requires rebuilding and uploading the site bundle.

## Verification

Run `npm run test:gaming` with local networking/browser access. It covers all
five layouts, both desktops, furniture bounds and floor contact, calibration,
lighting/postures, room-specific edits, Home Office mode compatibility, and
project restore. Review images are saved in `/tmp/ef-gaming-review`.
`node tests/room-glide-test.cjs` checks the shared movement/controller behavior.
