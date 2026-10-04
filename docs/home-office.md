# Home Office in Studio

Open `index.html?room=home&view=room` to start in the architectural view.

| Room | Interior floor dimensions | Ceiling |
| --- | --- | --- |
| Apartment office | 2.8 × 3.2 m, approximately 9′2″ × 10′6″ | 2.6 m |
| Dedicated home office | 3.6 × 4.2 m, approximately 11′10″ × 13′9″ | 2.7 m |
| Spacious home office | 4.2 × 4.8 m, approximately 13′9″ × 15′9″ | 2.8 m |
| Premium home office | 5.2 × 5.8 m, approximately 17′1″ × 19′0″ | 3.0 m |
| Executive office suite | 6.5 × 7.0 m, approximately 21′4″ × 23′0″ | 3.2 m |

The **Room** selector and **48″ / 60″ desk** buttons are independent. Room
changes load a new architecture and arrangement, retaining the selected desk
size and day mode. Furniture keeps its actual library dimensions. The room's
millimetre scale is calibrated to the selected desktop's nominal width,
independently of any phone AR calibration preference. Room selection is
remembered locally and saved in projects.

The room uses an open front and walls that disappear when viewed from outside.
The pendant is hidden from above so it does not cover the floor plan. This is a
cutaway of a full-size room, not an enclosed camera-navigation environment.

## Day modes

Mode buttons set the window sky, daylight, ambient light, task and ceiling lights,
desk LEDs, and desk pose. The shared lift and tilt rigs animate the posture.
The room placement/turn changes immediately; the normal desk controls remain
available for further adjustments.

| Mode | Height | Tilt | Desk LEDs |
| --- | --- | --- | --- |
| Morning | 43.5″ | −5° | Off |
| Afternoon | 28″ | 0° | Off |
| Evening | 28″ | 12° | Warm |
| Night | 28″ | 0° | Warm |
| Party | 43.5″ | 0° | Violet |

Choosing a mode restores its lighting preset. Light & quality allows manual
adjustment afterward; Accent light also controls the room's practical lamps.

Library furniture is selectable and editable through the existing scene editor.
Each room has separate edits under `home:<layout-id>`. Project files preserve
all edited layouts, the selected room, the selected day mode, and
the desk's position and turn. Existing older Home Office edit data remains in
storage under its original `home` key; it is not applied to these new layouts.

The desk chair is the supplied Steelcase Leap V2 with headrest. Its source DWG
is in `models/chairs/`; the GLB and thumbnail are in `assets/props/`. Its authored
inch units are preserved, with floor anchoring and +Z front orientation. The
local converter is `tools/props/dwg-chair.mjs`; it requires the LibreDWG WASM
reader in a temporary directory (see its usage header). CAD layers are assigned
charcoal upholstery, black polymer and satin metal.

Architecture, floors, curtains, joinery, side tables, and artwork are generated
in `home-office.mjs`. The prop library supplies chairs, plants, lamps, monitor,
keyboard, mouse, mug, and journals. Floor and artwork textures are original,
deterministic canvas patterns and need no additional downloads.

The October model packs add books and a small plant to the display shelves,
plus a floor lamp beside the reading area. Its light follows the day modes.
The four larger offices also have a coffee maker on the storage cabinet and
a wall-mounted Quaternius guitar. These are editable library assets, with
consistent dimensions across room sizes; the Steelcase chair is retained.

## Verification

Run `node tests/home-office-test.cjs` with local networking/browser access.
It checks real desktop/room scale, furniture floor contact and bounds, all five
postures, size switching, separate edits, project import, and leaving the room.
Rendered review images are saved to `/tmp/ef-home-office-review`.
